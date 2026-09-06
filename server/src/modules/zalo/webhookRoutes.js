// Webhook Zalo Bot — máy-đối-máy, mount TRƯỚC `issueCsrfCookie`/`verifyCsrf` trong app.js (cùng chỗ
// với `task-files-ds`): Zalo gọi về không có cookie phiên/CSRF. Xác thực BẰNG HEADER
// `X-Bot-Api-Secret-Token` — đúng giá trị đã đưa cho Zalo khi `setWebhook` — so bằng `safeEqual`
// của `auth/cookies.js` (so byte an toàn thời gian, KHÔNG tự chế trên độ dài chuỗi).
//
// HAI QUY TẮC SỐNG CÒN của webhook (sai là Zalo đánh dấu hỏng và ngừng gửi sự kiện):
//   1. TRẢ 2xx cho MỌI sự kiện hợp lệ, kể cả tin ta không hiểu — `bocSuKien` trả `null` thì xác nhận
//      rồi bỏ qua, không ném lỗi.
//   2. TRẢ NHANH: chỉ chờ phần ghi CSDL (chục ms), còn tin nhắn lại cho người dùng thì gửi SAU khi
//      đã trả lời — một lời gọi Zalo 10 giây nằm trước phản hồi là tự đưa mình vào chỗ bị timeout.
//
// Sai/không có header ⇒ 403: đây là ngoại lệ cố ý của quy tắc 2xx — từ chối thẳng kẻ gọi nhầm cửa
// tốt hơn là giả vờ nhận, và Zalo chỉ đo thời gian của các request nó GỬI (luôn kèm đúng header).
import { Router } from 'express';
import { env } from '../../config/env.js';
import * as zaloApi from '../../services/zalo.js';
import { forbidden } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { safeEqual } from '../auth/cookies.js';
import * as service from './service.js';

export const zaloWebhookRouter = Router();

zaloWebhookRouter.post('/', async (req, res, next) => {
  try {
    if (!safeEqual(req.get('X-Bot-Api-Secret-Token'), env.ZALO_BOT_SECRET_TOKEN)) {
      throw forbidden('Sai mã bí mật của webhook');
    }

    // Sự kiện không phải tin văn bản (ảnh, sticker, thoại, `unsupported`…) thì xác nhận và bỏ qua:
    // chúng không mang mã liên kết, và đây cũng không phải trợ lý hội thoại.
    const tin = service.bocSuKien(req.body);
    if (!tin) return res.status(200).json({ ok: true, xuLy: 'bo-qua' });

    const { xuLy, traLoi } = await service.xuLyTinDen({ chatId: tin.chatId, text: tin.text });

    if (traLoi) {
      // Gửi tin trả lời KHÔNG chờ: phản hồi webhook phải đi trước. Lỗi gửi chỉ ghi log — kênh phụ.
      // KHÔNG log `chatId`: ai đọc được log cũng không được biết định danh Zalo của người khác.
      void zaloApi.guiTin({ chatId: tin.chatId, text: traLoi }).then((kq) => {
        if (!kq.ok) logger.warn({ xuLy, loi: kq.loi }, 'Không gửi được tin trả lời Zalo');
      });
    }
    return res.status(200).json({ ok: true, xuLy });
  } catch (err) {
    return next(err);
  }
});

export default zaloWebhookRouter;

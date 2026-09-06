// Route Thông báo (§5.2 `POST /api/v1/notifications` + ba đường ĐỌC của chuông, 2026-09-06).
//
// Đường ĐỌC mở theo §13.4 mục 16 (chốt phương án b): `GET /`, `GET /unread-count`, `PATCH /read`.
// Cả ba **không có tên RPC** tương ứng — giao diện gọi thẳng REST như phần ủy quyền, nên cầu tương
// thích vẫn đúng 37 tên (§5.2 đã ghi bảng «REST không có tên RPC»).
//
// KHÔNG ghi nhật ký kiểm toán cho lần ĐỌC: chuông hỏi lại mỗi 60 giây, mỗi người một dòng/phút sẽ
// nhấn chìm `activity_logs` — cùng lý lẽ đã ghi ở `chat/routes.js`. `PATCH /read` cũng không ghi:
// "đã xem thông báo của mình" không phải việc cần dấu vết, và nó xảy ra mỗi lần mở hộp chuông.
//
// Chặn quyền nằm ở service (`assertAdmin` cho ghi, `assertDangNhap` cho đọc), KHÔNG ở middleware:
// lời gọi qua cầu RPC và lời gọi REST phải đi cùng một cổng, hai chỗ chặn là hai bộ luật.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { text } from '../../utils/zodTypes.js';
import * as service from './service.js';

/** Người nhận: id, mã nhân sự, email hay họ tên — service dò ra `user_id`. Trống = tất cả. */
const recipientInput = z.union([z.string().trim().max(200), z.number(), z.null()]);

const createSchema = z.object({
  content: text(5000).optional(),
  recipient: recipientInput.optional(),
  type: text(60).optional(),
});

// `ids` rỗng hoặc thiếu = đánh dấu TẤT CẢ của mình (nút «đọc hết»). Chặn trên 500 để một request
// không đẩy 100k phần tử vào `= ANY($2::bigint[])`.
const readSchema = z.object({
  ids: z
    .array(z.union([z.number(), z.string()]))
    .max(500)
    .optional(),
});

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res, next) => {
  try {
    // `limit`/`onlyUnread` đọc thô rồi để repo kẹp về miền hợp lệ (`Math.min(200, …)`): tham số
    // hiển thị sai một chữ không đáng trả 400 và làm hộp chuông trắng.
    const data = await service.docCuaToi(req.user, {
      limit: req.query.limit,
      onlyUnread: String(req.query.onlyUnread ?? '') === 'true',
    });
    return ok(res, data);
  } catch (err) {
    return next(err);
  }
});

notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    return ok(res, await service.demChuaDoc(req.user));
  } catch (err) {
    return next(err);
  }
});

notificationsRouter.patch('/read', validate(readSchema), async (req, res, next) => {
  try {
    return ok(res, await service.danhDauDaDoc(req.user, req.body.ids ?? null));
  } catch (err) {
    return next(err);
  }
});

notificationsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const result = await service.create(req.user, req.body);
    res.locals.audit = {
      action: 'notification.create',
      entityType: 'notification',
      entityId: result.notifications[0]?.id ?? null,
      // KHÔNG ghi `content` vào nhật ký: thông báo có thể chứa chuyện nội bộ, mà nhật ký thì ai
      // đọc được nhật ký cũng thấy. Chỉ ghi số người nhận và loại.
      details: {
        total: result.total,
        type: result.notifications[0]?.type ?? '',
        toAll: result.toAll,
      },
    };
    return ok(res, { notifications: result.notifications, total: result.total }, 201);
  } catch (err) {
    return next(err);
  }
});

export default notificationsRouter;

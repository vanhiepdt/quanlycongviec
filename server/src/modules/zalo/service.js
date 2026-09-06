// Nghiệp vụ ZALO (017) — liên kết tài khoản và đẩy thông báo.
//
// Bốn nguyên tắc chặn, quyết trước khi viết dòng nào (docs/KE-HOACH-THONG-BAO.md §B1):
//
//  1. **Zalo là kênh PHỤ.** Thông báo trong CSDL + chuông là nguồn chính. Zalo lỗi / token sai /
//     mạng chết ⇒ chỉ ghi log và tăng bộ đếm, TUYỆT ĐỐI không làm đổ hành động duyệt.
//  2. **Mặc định TẮT.** `ZALO_BOT_TOKEN` trống ⇒ không gọi mạng, giao diện không hiện gì.
//  3. **Không gửi trong transaction.** `approvals/service.js` ghi thông báo bên trong
//     `withTransaction` đang giữ khoá dòng công việc; một lời gọi HTTP ở đó là giữ khoá theo độ trễ
//     của Zalo. Nên đẩy đọc từ HÀNG ĐỢI sau khi commit (`dayMotLo`, lịch chạy gọi).
//  4. **Không đưa nội dung nhạy cảm ra ngoài.** Tin Zalo chỉ có: loại việc, tên đầu việc, ai gửi,
//     và một câu «mở hệ thống để xem». KHÔNG gửi mô tả, ý kiến, tên file, lý do từ chối.
import { randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as zaloApi from '../../services/zalo.js';
import * as logsRepo from '../activityLogs/repo.js';
import * as repo from './repo.js';

/** Từ khoá người dùng nhắn cho bot. Chấp nhận cả bản có dấu và bản viết liền. */
const TU_KHOA = /^(?:li[êe]n\s*k[êế]t|lienket)\s*[:\s-]*(\d{6})$/i;

/** Tin nhắn chỉ có 6 chữ số cũng tính là mã — người dùng thường gõ đúng con số họ thấy. */
const CHI_SO = /^(\d{6})$/;

/**
 * Chặn thử mã bừa, theo `chat_id`, trong BỘ NHỚ tiến trình.
 *
 * Vì sao chỉ trong bộ nhớ: đây là lớp phòng thủ THỨ HAI. Lớp thứ nhất mạnh hơn nhiều — mã 6 số
 * (1.000.000 khả năng), hạn 15 phút, dùng một lần, và tối đa vài chục mã sống cùng lúc. Khởi động
 * lại tiến trình làm bộ đếm này mất, nhưng kẻ thử mã cũng không biết lúc nào ta khởi động lại, và
 * cơ hội của họ vẫn là ~2/100.000 mỗi lần thử. Dựng một bảng CSDL cho việc này là thêm lược đồ để
 * canh một rủi ro đã nhỏ.
 */
const THU_SAI = new Map();
const THU_SAI_TOI_DA = 8;
const THU_SAI_CUA_SO_MS = 10 * 60 * 1000;

function ghiThuSai(chatId) {
  const now = Date.now();
  const cu = (THU_SAI.get(chatId) || []).filter((t) => now - t < THU_SAI_CUA_SO_MS);
  cu.push(now);
  THU_SAI.set(chatId, cu);
  // Dọn các khoá đã nguội để Map không phình mãi.
  if (THU_SAI.size > 500) {
    for (const [k, v] of THU_SAI) {
      if (v.every((t) => now - t >= THU_SAI_CUA_SO_MS)) THU_SAI.delete(k);
    }
  }
}

function daThuQuaNhieu(chatId) {
  const now = Date.now();
  const cu = (THU_SAI.get(chatId) || []).filter((t) => now - t < THU_SAI_CUA_SO_MS);
  return cu.length >= THU_SAI_TOI_DA;
}

/** Chỉ dùng trong test — xoá bộ đếm giữa các ca. */
export function xoaBoDemThuSai() {
  THU_SAI.clear();
}

// ------------------------------------------------------------------------------------------
// Liên kết tài khoản
// ------------------------------------------------------------------------------------------

function assertDangNhap(user) {
  if (!user || user.id == null) throw new AppError('UNAUTHENTICATED', 'Bạn chưa đăng nhập');
  return Number(user.id);
}

function assertDaBat() {
  if (!zaloApi.daBat()) {
    throw new AppError(
      'BAD_REQUEST',
      'Máy chủ chưa cấu hình Zalo Bot — liên hệ quản trị để bật tính năng này'
    );
  }
}

/**
 * Sinh mã 6 số bằng `crypto.randomInt` (không phải `Math.random`).
 *
 * `Math.random` đoán được từ các giá trị trước — với một mã cho phép chiếm kênh thông báo của một
 * người thì đó là khác biệt thật, không phải sự cẩn thận hình thức. Thử lại tối đa 20 lần nếu trùng
 * (UNIQUE toàn bảng `zalo_link_codes.code`); trùng là chuyện gần như không xảy ra với ~20 mã sống.
 */
async function sinhMaChuaDung(client) {
  for (let i = 0; i < 20; i += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!(await repo.maDaTonTai(code, client))) return code;
  }
  throw new AppError('CONFLICT', 'Không sinh được mã liên kết, hãy thử lại');
}

/** Câu hướng dẫn kèm theo mã. Gộp vào service để giao diện và bot nói cùng một câu. */
export function huongDan(code) {
  return `Mở Zalo, nhắn tin cho bot rồi gửi đúng dòng: LIENKET ${code}`;
}

/**
 * Lấy mã liên kết cho người đang đăng nhập.
 *
 * KHÔNG xoá mã cũ: người dùng có thể đã nhắn mã cũ đi rồi mới bấm lại nút; cả hai mã đều dùng được
 * cho tới khi hết hạn. Đã liên kết rồi thì vẫn cấp mã mới được — dùng để chuyển sang tài khoản Zalo
 * khác (mã mới ghi đè `zalo_chat_id`).
 */
export function layMa(user) {
  const userId = assertDangNhap(user);
  assertDaBat();
  return withPgErrors(() =>
    withTransaction(async (client) => {
      const code = await sinhMaChuaDung(client);
      const dong = await repo.themMa({ userId, code }, client);
      const daLienKet = await repo.trangThaiLienKet(userId, client);
      return {
        code,
        expiresAt: dong.expires_at,
        hanPhut: repo.HAN_MA_PHUT,
        huongDan: huongDan(code),
        daLienKet,
      };
    })
  );
}

/** Bỏ liên kết của chính mình. Trả `changed: 0` khi vốn chưa liên kết — không phải lỗi. */
export function boLienKet(user) {
  const userId = assertDangNhap(user);
  return withPgErrors(async () => {
    const changed = await repo.boChatId(userId);
    if (changed > 0) {
      // Router webhook không đi qua middleware `audit` (mount trước nó), và đây là hành động của
      // người dùng thật nên vẫn nên có dấu vết — ghi thẳng, không dựa vào `res.locals.audit`.
      await logsRepo.writeLog({
        actorId: userId,
        actorName: user.full_name ?? user.code ?? '',
        action: 'zalo.bo-lien-ket',
        entityType: 'user',
        entityId: userId,
        details: {},
      });
    }
    return { changed, daLienKet: false };
  });
}

/**
 * Trạng thái cho giao diện. KHÔNG trả `chat_id` — chỉ cờ.
 *
 * `bat` để giao diện biết máy chủ đã cấu hình gì: bẫy đã ghi ở §13.5 («cờ cấu hình phải đi cùng dữ
 * liệu») — trình duyệt không có cách nào tự đoán máy chủ có token hay không.
 */
export function trangThai(user) {
  const userId = assertDangNhap(user);
  return withPgErrors(async () => ({
    bat: zaloApi.daBat(),
    cachNhan: env.ZALO_BOT_NHAN,
    daLienKet: zaloApi.daBat() ? await repo.trangThaiLienKet(userId) : false,
  }));
}

// ------------------------------------------------------------------------------------------
// Xử lý tin người dùng nhắn cho bot (webhook và polling dùng CHUNG hàm này)
// ------------------------------------------------------------------------------------------

/** Bóc mã 6 số từ nội dung tin. `null` nếu tin không phải yêu cầu liên kết. */
export function bocMa(text) {
  const s = String(text ?? '').trim();
  const a = s.match(TU_KHOA);
  if (a) return a[1];
  const b = s.match(CHI_SO);
  return b ? b[1] : null;
}

/**
 * Một tin đến. Trả `{ xuLy, traLoi }` — `traLoi` là câu bot nhắn lại (rỗng = không nhắn gì).
 *
 * KHÔNG ném với tin lạ: webhook phải trả 2xx nhanh cho MỌI sự kiện, nếu không Zalo coi là hỏng
 * (`webhook.err.timeout` / `webhook.http.5xx` ở `testWebhook`). Tin không liên quan thì bỏ qua im
 * lặng — bot này không phải trợ lý hội thoại.
 */
export function xuLyTinDen({ chatId, text }) {
  const chat = String(chatId ?? '').trim();
  if (chat === '') return { xuLy: 'thieu-chat-id', traLoi: '' };

  const code = bocMa(text);
  if (!code) return { xuLy: 'bo-qua', traLoi: '' };

  if (daThuQuaNhieu(chat)) {
    return {
      xuLy: 'thu-qua-nhieu',
      traLoi: 'Bạn đã thử quá nhiều mã. Hãy đợi ít phút rồi lấy mã mới trong phần mềm.',
    };
  }

  return withPgErrors(() =>
    withTransaction(async (client) => {
      const ma = await repo.timMaConHieuLuc(code, client);
      if (!ma) {
        ghiThuSai(chat);
        return {
          xuLy: 'ma-khong-hop-le',
          traLoi:
            'Mã không đúng hoặc đã hết hạn (mã chỉ dùng một lần, trong 15 phút). ' +
            'Hãy vào phần mềm, trang «Quản lý tài khoản», bấm «Lấy mã liên kết» để lấy mã mới.',
        };
      }

      // `chat_id` này đã thuộc người khác? Nói rõ thay vì để lỗi UNIQUE thô đi lên.
      const chuCu = await repo.nguoiGiuChatId(chat, client);
      if (chuCu && Number(chuCu.id) !== Number(ma.user_id)) {
        ghiThuSai(chat);
        return {
          xuLy: 'chat-da-thuoc-nguoi-khac',
          traLoi:
            'Tài khoản Zalo này đang nhận thông báo cho một người khác trong hệ thống. ' +
            'Người đó cần bấm «Bỏ liên kết» trước, rồi bạn thử lại.',
        };
      }

      await repo.danhDauMaDaDung({ id: ma.id, chatId: chat }, client);
      const nguoi = await repo.ganChatId({ userId: ma.user_id, chatId: chat }, client);
      await logsRepo.writeLog(
        {
          actorId: ma.user_id,
          actorName: (nguoi && nguoi.full_name) || '',
          action: 'zalo.lien-ket',
          entityType: 'user',
          entityId: ma.user_id,
          // KHÔNG ghi `chat_id` vào nhật ký: ai đọc được nhật ký cũng thấy định danh Zalo của người
          // khác. Đủ để biết «người này đã liên kết lúc nào».
          details: {},
        },
        client
      );
      logger.info({ userId: ma.user_id }, 'Đã liên kết Zalo cho một người dùng');
      return {
        xuLy: 'da-lien-ket',
        userId: ma.user_id,
        traLoi:
          `Đã liên kết xong, ${(nguoi && nguoi.full_name) || 'bạn'} nhé. ` +
          'Từ giờ bot sẽ nhắn cho bạn khi có việc chờ bạn phê duyệt, việc bị trả lại, hoặc việc quá hạn.',
      };
    })
  );
}

/**
 * Bóc `{chatId, text}` từ một gói sự kiện của Zalo (dùng chung cho webhook và `getUpdates`).
 *
 * Hình dạng theo tài liệu: `{ ok, result: { event_name, message: { chat: { id }, text } } }`.
 * Chỉ nhận `message.text.received` — ảnh/sticker/thoại không mang mã liên kết.
 *
 * `message.unsupported.received` là sự kiện Zalo gửi khi người nhắn thuộc nhóm đối tượng đặc biệt
 * (trẻ em, người khuyết tật…) — theo tài liệu, ta KHÔNG nhận được nội dung, nên không có gì để bóc.
 */
export function bocSuKien(goi) {
  const kq = (goi && goi.result) || goi || {};
  const ten = String(kq.event_name || '');
  if (ten !== 'message.text.received') return null;
  const msg = kq.message || {};
  const chat = (msg.chat && msg.chat.id) || (msg.from && msg.from.id) || '';
  return {
    chatId: String(chat),
    text: String(msg.text ?? ''),
    chatType: (msg.chat && msg.chat.chat_type) || '',
  };
}

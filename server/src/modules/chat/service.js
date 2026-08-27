// Nghiệp vụ Chat nội bộ (§2.8 nhóm H, §7 việc 7.3).
//
// Chat là kênh CHUNG của cả đơn vị: mọi người đăng nhập đều đọc và gửi được, không có phạm vi
// phòng — nên ở đây KHÔNG gọi `can()`. §6 không có thực thể `chat`; thêm vào chỉ để trả về "mọi
// vai trò đều được" là nới ma trận mà không thêm luật nào (§6 không được nới).
//
// Nội dung tin KHÔNG bị lọc thẻ HTML ở máy chủ: lưu đúng nguyên văn người gõ, việc thoát ký tự do
// giao diện làm khi vẽ (`escapeHtml` trong `renderChatMessages`) — TC-MISC-08. Lọc ở máy chủ thì
// tin nhắn kỹ thuật kiểu `if (a < b)` bị cắt mất, mà lỗ XSS vẫn còn ở mọi chỗ vẽ khác.
import { AppError } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as repo from './repo.js';

/** Dài nhất một tin — ô nhập của giao diện không giới hạn, nên chặn ở đây. */
export const DAI_NHAT = 2000;

/** Mốc `since` cho lần hỏi kế tiếp: thời điểm tin cuối, hoặc null nếu khoảng rỗng. */
function mocKeTiep(rows, since) {
  if (rows.length === 0) return since ?? null;
  const cuoi = rows[rows.length - 1].created_at;
  return (cuoi instanceof Date ? cuoi : new Date(cuoi)).toISOString();
}

function docSince(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Mốc thời gian "since" không hợp lệ', {
      field: 'since',
    });
  }
  return d;
}

/**
 * Đọc tin. `since` là mốc của lần hỏi trước — giao diện hỏi lại mỗi 10 giây nên phần lớn lần gọi
 * trả mảng rỗng; khoảng 3 ngày / 50 tin do repo canh, `since` không nới được ra ngoài khoảng đó.
 *
 * `_user` không dùng: chat là kênh chung, ai đăng nhập cũng đọc đúng một tập tin như nhau. Vẫn giữ
 * tham số để chữ ký giống mọi service khác — chỗ gọi không phải nhớ module này là ngoại lệ.
 */
export async function list(_user, { since = null } = {}) {
  const moc = docSince(since);
  const rows = await withPgErrors(() => repo.list({ since: moc }));
  return {
    messages: rows,
    total: rows.length,
    since: mocKeTiep(rows, moc?.toISOString() ?? null),
    soNgay: repo.SO_NGAY,
    soTin: repo.SO_TIN,
  };
}

/** Gửi tin. Tên người gửi chép vào dòng để xoá người không mất lịch sử (001_init.sql). */
export async function send(user, message) {
  const text = String(message ?? '').trim();
  if (text === '') {
    throw new AppError('VALIDATION_ERROR', 'Tin nhắn không được để trống', { field: 'message' });
  }
  if (text.length > DAI_NHAT) {
    throw new AppError('VALIDATION_ERROR', `Tin nhắn tối đa ${DAI_NHAT} ký tự`, {
      field: 'message',
    });
  }
  const row = await withPgErrors(() =>
    repo.insert({ userId: user.id, userName: user.full_name ?? '', message: text })
  );
  return row;
}

/** Dọn tin cũ — gọi bởi lịch chạy hằng tuần của việc 7.4. */
export function donTinCu(soNgay) {
  return withPgErrors(() => repo.deleteOlderThan(soNgay));
}

// Kiểu zod dùng lại cho các API nghiệp vụ. Gom vào một chỗ để 5 module không có 5 cách hiểu
// khác nhau về "ngày trống" hay "tiến độ hợp lệ".
import { z } from 'zod';

/**
 * Ngày dạng `YYYY-MM-DD`. Nhận cả chuỗi rỗng và `null` rồi trả về `null`: form của bản cũ gửi ô
 * ngày chưa điền thành `""`, chặn cứng thì người dùng không xoá được ngày đã nhập sai.
 */
export const dateInput = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    const text = String(v ?? '').trim();
    return text === '' ? null : text;
  })
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Ngày phải theo dạng YYYY-MM-DD');

/**
 * Tiến độ 0–100. ÉP về miền hợp lệ thay vì trả 400 (TC-TREE-32) — đúng như `parseTaskCompletion`
 * bản cũ: `-5` thành 0, `150` thành 100, chữ không phải số thành 0. Lý do giữ hành vi ép: ô tiến
 * độ trên giao diện cũ là text tự do, dữ liệu nhập tay có cả "50%" và "chưa xong"; trả lỗi ở đây
 * chỉ làm người dùng mất cả biểu mẫu đang điền.
 */
export const completionInput = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || String(v).trim() === '') return 0;
    const n = Number(String(v).replace('%', '').trim());
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  });

/** Id tham chiếu tới một dòng khác: số dương, hoặc `null` để bỏ liên kết. */
export const idInput = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : Number.NaN;
  })
  .refine((v) => v === null || Number.isInteger(v), 'Mã tham chiếu không hợp lệ');

/** Chuỗi có cắt trắng hai đầu, giới hạn độ dài để không ai nhét 1MB vào một cột text. */
export const text = (max = 500) => z.string().trim().max(max);

/** Danh sách liên kết kết quả — phải là MẢNG (CHECK `links_is_array` cũng đòi thế). */
export const resultLinksInput = z.array(z.unknown()).max(50).optional();

export const KHOA_DUYET = Object.freeze(['Chờ duyệt', 'Đã duyệt', 'Từ chối']);
export const approvalInput = z.enum(KHOA_DUYET).optional();

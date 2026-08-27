// Nghiệp vụ Thông báo — đường TẠO (§2.10 nhóm J1, §5.2 `notifications.create`).
//
// Đây là tên RPC cuối cùng còn `pending()` của cầu tương thích. Ba quyết định của nó:
//
//  1. **Chỉ admin.** Bản cũ chặn bằng `checkUserPermission('create', 'notification')`, và CẢ BA
//     nhánh vai (Phó Giám đốc, Trưởng/Phó phòng, Quản lý công việc) đều trả đúng một câu
//     "Chỉ admin mới có thể quản lý thông báo" (`Code.gs.moi` dòng 1348 / 1374 / 1395). Đây là
//     port nguyên luật cũ, không phải luật mới. §6 KHÔNG có thực thể `notification` và không được
//     nới, nên chỗ siết nằm ở đây — cùng cách làm như `apps/service.js` và `reminders/service.js`.
//  2. **Người nhận dò ra `user_id`** (§4.3: "`Người nhận` dò ra `user_id`"). Bảng cũ lưu chuỗi
//     họ tên, bảng mới có `user_id NOT NULL REFERENCES users(id)` — nên tên phải dò được ra đúng
//     MỘT người, không thì báo lỗi. Trùng tên là chuyện thật của dữ liệu cũ (§13.5), ở đây KHÔNG
//     đoán hộ: hai người cùng tên ⇒ 400 mời chọn bằng email.
//  3. **"Tất cả mọi người" = trải thành từng dòng.** Form cũ để trống ô người nhận nghĩa là gửi
//     chung; lược đồ mới không có dòng "gửi chung" (mỗi thông báo thuộc một người), nên một lời
//     gọi sinh N dòng trong MỘT câu INSERT (`repo.insertMany`). Chỉ người còn hoạt động
//     (`is_active`) mới nhận — người đã nghỉ không đăng nhập được thì không có ai đọc.
//
// KHÔNG có email ở đây: chốt §13.4 mục 4 (2026-08-24) là bỏ hẳn khâu gửi thư.
import { AppError, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as usersRepo from '../users/repo.js';
import * as repo from './repo.js';

/** Dài nhất một nội dung thông báo. Ô nhập của form cũ là `<textarea>` không giới hạn. */
export const DAI_NHAT = 2000;

/**
 * Bốn nhãn của ô "Loại thông báo" trong form cũ → khoá lưu trong cột `type`.
 *
 * Cột `type` là KHOÁ để giao diện chọn biểu tượng, không phải câu chữ cho người đọc, nên không lưu
 * nguyên văn người gõ: dữ liệu mẫu và `repo.LOAI` chỉ dùng các khoá `info|success|warning|error` và
 * `approval_*|overdue`. Nhãn lạ ⇒ `info`, chứ không phải lỗi 400: loại thông báo sai một chữ không
 * đáng chặn cả việc gửi.
 *
 * "Công việc" và "Hệ thống" cùng về `info` vì giao diện chưa có biểu tượng riêng cho hai loại đó —
 * mất phân biệt ở đây là mất một nhãn trang trí, không mất dữ liệu người dùng gõ (nội dung).
 */
export const LOAI_FORM = Object.freeze({
  'Thông báo': 'info',
  'Công việc': 'info',
  'Hệ thống': 'info',
  'Khẩn cấp': 'warning',
});

/** Khoá được phép lưu thẳng vào cột `type` (giao diện/lịch chạy đã biết đọc). */
const KHOA_HOP_LE = Object.freeze([
  'info',
  'success',
  'warning',
  'error',
  ...Object.values(repo.LOAI),
]);

export function chuanHoaLoai(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return 'info';
  if (KHOA_HOP_LE.includes(raw)) return raw;
  return LOAI_FORM[raw] ?? 'info';
}

/** Cổng ghi duy nhất của module. */
function assertAdmin(user) {
  if (!user) throw new AppError('UNAUTHENTICATED', 'Bạn chưa đăng nhập');
  if (user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Chỉ admin mới được tạo thông báo');
  }
}

/**
 * Dò người nhận. Nhận id, mã nhân sự (`NV001`), email, hoặc HỌ TÊN — form cũ gửi họ tên vì ô
 * `<select name="recipient">` lấy `value` là tên người.
 *
 * Trả về MẢNG id (một phần tử) để chỗ gọi xử lý "một người" và "tất cả" bằng cùng một đường.
 */
async function timNguoiNhan(recipient, client = null) {
  const raw = String(recipient ?? '').trim();
  if (raw.includes('@')) {
    const row = await usersRepo.findByEmail(raw, client);
    if (!row) throw notFound(`Không tìm thấy người nhận "${raw}"`);
    return [row.id];
  }
  if (/^\d+$/.test(raw) || /^NV\d+$/i.test(raw)) {
    const row = await usersRepo.findByRef(raw, client);
    if (!row) throw notFound(`Không tìm thấy người nhận "${raw}"`);
    return [row.id];
  }
  const trungTen = await usersRepo.findIdsByFullName(raw, client);
  if (trungTen.length === 1) return [trungTen[0].id];
  if (trungTen.length === 0) throw notFound(`Không tìm thấy người nhận "${raw}"`);
  throw new AppError(
    'VALIDATION_ERROR',
    `Có ${trungTen.length} người tên "${raw}" — hãy chọn người nhận bằng email`,
    { field: 'recipient' }
  );
}

/** Mọi người còn hoạt động, kể cả người đang gửi: "Tất cả mọi người" của form cũ là tất cả. */
async function tatCaMoiNguoi(client = null) {
  const rows = await usersRepo.listAll(client);
  return rows.filter((r) => r.is_active !== false).map((r) => r.id);
}

/**
 * Tạo thông báo. `recipient` để trống ⇒ gửi cho tất cả.
 *
 * Không dùng `withTransaction`: cả hàm chỉ có MỘT câu ghi (`insertMany` gộp N dòng vào một câu),
 * nên transaction không thêm bảo đảm nào.
 */
export function create(user, input = {}) {
  assertAdmin(user);
  return withPgErrors(async () => {
    const content = String(input.content ?? '').trim();
    if (content === '') {
      throw new AppError('VALIDATION_ERROR', 'Nội dung thông báo không được để trống', {
        field: 'content',
      });
    }
    if (content.length > DAI_NHAT) {
      throw new AppError('VALIDATION_ERROR', `Nội dung thông báo tối đa ${DAI_NHAT} ký tự`, {
        field: 'content',
      });
    }
    const type = chuanHoaLoai(input.type);
    const guiTatCa = String(input.recipient ?? '').trim() === '';
    const ids = guiTatCa ? await tatCaMoiNguoi() : await timNguoiNhan(input.recipient);
    if (ids.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Không có người nhận nào đang hoạt động', {
        field: 'recipient',
      });
    }
    const notifications = await repo.insertMany(
      ids.map((userId) => ({ userId, content, type, refType: '', refId: null }))
    );
    return { notifications, total: notifications.length, toAll: guiTatCa };
  });
}

// Nghiệp vụ Quản lý App (§7 việc 7.2). Vỏ HTTP không có logic nào.
//
// Hai luật của phase, mỗi luật một dòng lệnh:
//   1. **Chỉ admin thêm / sửa / xoá** (TC-MISC-05). §6 không có thực thể `app` và KHÔNG được nới,
//      nên ở đây không gọi `can()` mà so thẳng `user.role === 'admin'` — app là dữ liệu cấu hình
//      của hệ thống, không có phòng, không có người thực hiện, nên không có gì để xét phạm vi.
//   2. **`allowed_roles` quyết định ai thấy app nào** (TC-MISC-06). Mảng rỗng = mọi vai trò đều
//      thấy (đúng chú thích cột trong 001_init.sql). Lọc làm ở SQL, không ở giao diện: ẩn thẻ bằng
//      JavaScript thì dữ liệu vẫn đã đi qua dây.
//
// `allowed_roles` chứa **tên vai trò**, không phải tên người. Form cũ vốn tích theo tên nhân sự —
// đó là chỗ lệch với lược đồ mới, đã sửa ở `createAppModal` của `web/assets/js/app.js` cùng việc
// này; nhãn `Admin` / `Quản lý` của form cũ vẫn nhận được nhờ `FORM_ROLE_MAP`.
import { withTransaction } from '../../db/pool.js';
import { ROLES } from '../../middleware/rbac.js';
import { AppError, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import { FORM_ROLE_MAP } from '../users/service.js';
import * as repo from './repo.js';

/** Cổng ghi duy nhất của module. */
function assertAdmin(user, viec) {
  if (!user) throw new AppError('UNAUTHENTICATED', 'Bạn chưa đăng nhập');
  if (user.role !== 'admin') {
    throw new AppError('FORBIDDEN', `Chỉ admin được ${viec} ứng dụng`);
  }
}

/**
 * Chuẩn hoá danh sách vai trò được xem.
 *
 * Nhận mảng, hoặc chuỗi ngăn bằng dấu phẩy (giao diện cũ gửi `"admin, Trưởng phòng"`). Trả mảng
 * đã bỏ trùng, giữ thứ tự nhập. `undefined` = không gửi ⇒ PATCH không đụng cột.
 *
 * Tên vai trò sai một chữ thì lọc app lặng lẽ trả rỗng và không ai biết vì sao app biến mất — nên
 * ở đây là lỗi 400 nói rõ tên sai, không phải bỏ qua.
 */
export function chuanHoaVaiTro(value) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const out = [];
  for (const item of raw) {
    const trimmed = String(item ?? '').trim();
    if (trimmed === '') continue;
    const mapped = FORM_ROLE_MAP[trimmed] ?? trimmed;
    if (!ROLES.includes(mapped)) {
      throw new AppError('VALIDATION_ERROR', `Vai trò "${trimmed}" không hợp lệ`, {
        field: 'allowedRoles',
      });
    }
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}

/** Người này có thấy app này không — dùng lại được cho cả lời gọi lẻ, cùng luật với `repo.list`. */
export function xemDuoc(user, row) {
  if (user?.role === 'admin') return true;
  const roles = row.allowed_roles ?? [];
  return roles.length === 0 || roles.includes(user?.role);
}

async function mustFind(ref, client = null) {
  const row = await repo.findByRef(ref, client);
  if (!row) throw notFound(`Không tìm thấy ứng dụng "${ref}"`);
  return row;
}

/** Danh sách app người này được thấy. Admin thấy tất cả (kể cả app đã phân quyền hẹp). */
export async function list(user) {
  const apps = await repo.list(user?.role === 'admin' ? {} : { role: user?.role ?? null });
  return { apps, total: apps.length };
}

export async function getOne(user, ref) {
  const row = await mustFind(ref);
  if (!xemDuoc(user, row)) {
    throw new AppError('FORBIDDEN', 'Ứng dụng này chưa được phân quyền cho bạn');
  }
  return row;
}

/**
 * Thêm app. `category` viết hoa như bản cũ ("Sẽ tự động viết hoa khi lưu" ghi ngay dưới ô nhập)
 * để nhóm trong lưới không tách thành "Nhân sự" và "NHÂN SỰ".
 */
export function create(user, input) {
  assertAdmin(user, 'thêm');
  return withPgErrors(() =>
    withTransaction(async (client) => {
      const data = {
        name: input.name ?? '',
        url: input.url ?? '',
        icon_url: input.iconUrl ?? '',
        description: input.description ?? '',
        category: (input.category ?? '').trim().toUpperCase(),
        allowed_roles: chuanHoaVaiTro(input.allowedRoles) ?? [],
        created_by: user.id,
      };
      if (data.name.trim() === '') {
        throw new AppError('VALIDATION_ERROR', 'Tên ứng dụng không được để trống', {
          field: 'name',
        });
      }
      const created = await repo.insert(data, client);
      return created;
    })
  );
}

/** Sửa. Trường nào không gửi thì không ghi (§5.2). `created_by` không bao giờ đổi. */
export function update(user, ref, patch) {
  assertAdmin(user, 'sửa');
  return withPgErrors(() =>
    withTransaction(async (client) => {
      const hienTai = await mustFind(ref, client);
      const data = {};
      for (const [key, cot] of Object.entries({
        name: 'name',
        url: 'url',
        iconUrl: 'icon_url',
        description: 'description',
      })) {
        if (Object.hasOwn(patch, key)) data[cot] = patch[key];
      }
      if (Object.hasOwn(patch, 'category')) {
        data.category = String(patch.category ?? '')
          .trim()
          .toUpperCase();
      }
      if (Object.hasOwn(patch, 'allowedRoles')) {
        data.allowed_roles = chuanHoaVaiTro(patch.allowedRoles) ?? [];
      }
      if (Object.hasOwn(data, 'name') && String(data.name).trim() === '') {
        throw new AppError('VALIDATION_ERROR', 'Tên ứng dụng không được để trống', {
          field: 'name',
        });
      }
      const updated = await repo.update(hienTai.id, data, client);
      return { app: updated, before: hienTai };
    })
  );
}

export function remove(user, ref) {
  assertAdmin(user, 'xoá');
  return withPgErrors(() =>
    withTransaction(async (client) => {
      const hienTai = await mustFind(ref, client);
      const code = await repo.remove(hienTai.id, client);
      return { deletedApp: code };
    })
  );
}

// Nghiệp vụ Ủy quyền có thời hạn (kế hoạch: `docs/KE-HOACH-UY-QUYEN.md`, lược đồ:
// `006_delegations.sql`).
//
// Bốn luật gốc và chỗ chặn của từng luật:
//
//   L1 không tự ủy quyền cho mình → `DELEGATION_SELF` (dưới) + CHECK `delegation_not_self`
//   L2 không ủy quyền vai admin   → `DELEGATION_ADMIN_FORBIDDEN` (dưới) + lớp mượn quyền của
//                                   `middleware/rbac.js` chặn lần hai
//   L3 không rộng hơn quyền mình  → `DELEGATION_SCOPE_TOO_WIDE` (dưới), đối chiếu với
//                                   `department_managers` chứ không tin danh sách gửi lên
//   L4 không ủy quyền dây chuyền  → `middleware/rbac.js`: chỉ mượn cho work/subwork/task
//
// Vì sao L2 chặn ở đây chứ không ở `can()`: `can()` là hàm THUẦN, không biết ai đang tạo bản ghi
// nào. Còn vì sao `can()` VẪN chặn vai admin lần nữa: dữ liệu cũ hoặc một câu UPDATE bằng tay
// trong CSDL không được trở thành đường vòng lên quyền toàn hệ thống.
import { AppError, forbidden, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as departmentsRepo from '../departments/repo.js';
import * as usersRepo from '../users/repo.js';
import * as repo from './repo.js';

/**
 * Vai được ủy quyền = vai CÓ PHẠM VI để cho mượn. `Nhân viên` không có gì để ủy quyền (chỉ có
 * nhiệm vụ của chính mình, mà đó là việc chuyển người thực hiện, không phải ủy quyền).
 *
 * `admin` KHÔNG có trong danh sách: đó là L2, không phải bỏ sót. Admin vẫn tạo hộ được cho người
 * khác (`fromUserId`), chỉ không cho mượn quyền của CHÍNH admin.
 *
 * Giả định đang chờ người dùng chốt — §13.4 mục 17: có thu hẹp về đúng Phó Giám đốc + Trưởng phòng
 * hay không.
 */
export const VAI_DUOC_UY_QUYEN = Object.freeze([
  'Phó Giám đốc',
  'Trưởng phòng',
  'Phó phòng',
  'Quản lý công việc',
]);

const NGAY_HOP_LE = /^\d{4}-\d{2}-\d{2}$/;

/** Chuỗi ngày `YYYY-MM-DD` — không đổi sang `Date` ở bất kỳ đâu (§13.5 bẫy múi giờ). */
function ngay(value, field) {
  const raw = String(value ?? '').trim();
  if (!NGAY_HOP_LE.test(raw)) {
    throw new AppError('VALIDATION_ERROR', 'Ngày phải theo dạng YYYY-MM-DD', { field });
  }
  return raw;
}

/**
 * Phạm vi phòng mà một người CÓ THỂ cho mượn.
 *
 * Không đọc `user.managedDepartmentIds` của phiên: người tạo có thể là admin đang tạo hộ, và
 * `managedDepartmentIds` của phiên chỉ có dòng `deputy_director`. Ở đây tra thẳng CSDL theo đúng
 * vai của NGƯỜI ỦY QUYỀN.
 *
 * - `Phó Giám đốc`  → các phòng có dòng `department_managers.role = 'deputy_director'` (đúng thứ
 *                     `inScope()` dùng, rbac.js:161)
 * - `Trưởng phòng` / `Phó phòng` → phòng của chính họ ∪ các phòng họ phụ trách với vai head/vice
 * - `Quản lý công việc` → phòng của chính họ. Phạm vi thật của vai này là các công việc mình quản
 *                     lý (`works.manager_id`), không theo phòng; cho mượn rộng hơn phòng mình là
 *                     nới quyền, nên chặn ở mức phòng.
 */
async function phamViChoMuon(fromUser) {
  const ids = new Set();
  if (fromUser.role === 'Phó Giám đốc') {
    for (const id of await departmentsRepo.listDepartmentIdsManagedBy(
      fromUser.id,
      'deputy_director'
    )) {
      ids.add(Number(id));
    }
    return ids;
  }
  if (fromUser.department_id != null) ids.add(Number(fromUser.department_id));
  if (fromUser.role === 'Trưởng phòng' || fromUser.role === 'Phó phòng') {
    for (const role of ['head', 'vice']) {
      for (const id of await departmentsRepo.listDepartmentIdsManagedBy(fromUser.id, role)) {
        ids.add(Number(id));
      }
    }
  }
  return ids;
}

/** Người nhận: id, mã nhân sự, email hoặc họ tên — cùng cách dò như `notifications/service.js`. */
async function timNguoi(ref, field) {
  const raw = String(ref ?? '').trim();
  if (raw === '') {
    throw new AppError('VALIDATION_ERROR', 'Thiếu người được ủy quyền', { field });
  }
  if (raw.includes('@')) {
    const row = await usersRepo.findByEmail(raw, null);
    if (!row) throw notFound(`Không tìm thấy người dùng "${raw}"`);
    return row;
  }
  if (/^\d+$/.test(raw) || /^NV\d+$/i.test(raw)) {
    const row = await usersRepo.findByRef(raw, null);
    if (!row) throw notFound(`Không tìm thấy người dùng "${raw}"`);
    return row;
  }
  const trungTen = await usersRepo.findIdsByFullName(raw, null);
  if (trungTen.length === 1) return usersRepo.findById(trungTen[0].id);
  if (trungTen.length === 0) throw notFound(`Không tìm thấy người dùng "${raw}"`);
  throw new AppError(
    'VALIDATION_ERROR',
    `Có ${trungTen.length} người tên "${raw}" — hãy chọn bằng email`,
    {
      field,
    }
  );
}

function assertDangNhap(user) {
  if (!user) throw new AppError('UNAUTHENTICATED', 'Bạn chưa đăng nhập');
}

/** Chỉ người ủy quyền hoặc admin được sửa/huỷ. Người NHẬN cũng không được — họ không cho quyền. */
function assertChuBanGhi(user, row) {
  if (user.role === 'admin') return;
  if (Number(row.from_user_id) !== Number(user.id)) {
    throw forbidden('Chỉ người ủy quyền hoặc admin mới sửa/huỷ được bản ghi này');
  }
}

/** Danh sách của tôi (hai chiều). Admin thêm `?all=1` để xem tất cả. */
export function list(user, { all = false } = {}) {
  assertDangNhap(user);
  return withPgErrors(async () => {
    const rows =
      all && user.role === 'admin' ? await repo.listAll() : await repo.listForUser(user.id);
    return { delegations: rows, total: rows.length };
  });
}

/**
 * Tạo bản ủy quyền.
 *
 * `fromUserId` chỉ admin được đặt khác mình (tạo hộ người đi công tác gấp). Người thường luôn là
 * chính mình — nếu không, ai cũng tự viết cho mình một bản "được A ủy quyền".
 */
export function create(user, input = {}) {
  assertDangNhap(user);
  return withPgErrors(async () => {
    const fromRef = input.fromUserId ?? input.from ?? user.id;
    if (user.role !== 'admin' && Number(fromRef) !== Number(user.id)) {
      throw forbidden('Bạn chỉ được ủy quyền phần quyền của chính mình');
    }
    const fromUser =
      Number(fromRef) === Number(user.id)
        ? await usersRepo.findById(user.id)
        : await timNguoi(fromRef, 'fromUserId');
    if (!fromUser) throw notFound('Không tìm thấy người ủy quyền');
    const toUser = await timNguoi(input.toUserId ?? input.to, 'toUserId');

    // L1 — CHECK `delegation_not_self` cũng chặn, nhưng câu lỗi của CSDL không nói được tiếng Việt
    // cho người dùng, và bắt ở đây thì không tốn một vòng tới CSDL.
    if (Number(fromUser.id) === Number(toUser.id)) {
      throw new AppError('DELEGATION_SELF', 'Không thể tự ủy quyền cho chính mình', {
        field: 'toUserId',
      });
    }
    // L2
    if (fromUser.role === 'admin') {
      throw new AppError(
        'DELEGATION_ADMIN_FORBIDDEN',
        'Không ủy quyền được vai admin — quyền toàn hệ thống không được cho mượn'
      );
    }
    if (!VAI_DUOC_UY_QUYEN.includes(fromUser.role)) {
      throw forbidden(`Vai trò "${fromUser.role}" không có phạm vi nào để ủy quyền`);
    }
    if (toUser.is_active === false) {
      throw new AppError('VALIDATION_ERROR', 'Người được ủy quyền đang bị vô hiệu hoá', {
        field: 'toUserId',
      });
    }

    const fromDate = ngay(input.fromDate, 'fromDate');
    const toDate = ngay(input.toDate, 'toDate');
    if (toDate < fromDate) {
      throw new AppError('VALIDATION_ERROR', 'Ngày kết thúc không được trước ngày bắt đầu', {
        field: 'toDate',
      });
    }

    // L3 — phạm vi. Không gửi gì ⇒ để rỗng, nghĩa là "theo phòng người ủy quyền đang phụ trách"
    // (repo.listEffectiveFor tính lúc kiểm quyền), không phải "toàn bộ".
    const departmentIds = await chuanHoaPhamVi(fromUser, input.departmentIds);

    return {
      delegation: await repo.insert({
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        departmentIds,
        fromDate,
        toDate,
        note: String(input.note ?? '').trim(),
        createdBy: user.id,
      }),
    };
  });
}

/** Kiểm phạm vi gửi lên có nằm trong phạm vi người ủy quyền không (L3). */
async function chuanHoaPhamVi(fromUser, raw) {
  if (raw === undefined || raw === null) return null;
  const xin = (Array.isArray(raw) ? raw : [raw])
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
  if (xin.length === 0) return null;
  const duoc = await phamViChoMuon(fromUser);
  const vuot = xin.filter((id) => !duoc.has(id));
  if (vuot.length > 0) {
    throw new AppError(
      'DELEGATION_SCOPE_TOO_WIDE',
      `Bạn không phụ trách phòng ${vuot.join(', ')} nên không ủy quyền được phạm vi đó`,
      { field: 'departmentIds' }
    );
  }
  return [...new Set(xin)];
}

/** Sửa `to_date` / `note` / `department_ids`. Hai đầu người và `from_date` không sửa (xem repo). */
export function update(user, id, patch = {}) {
  assertDangNhap(user);
  return withPgErrors(async () => {
    const row = await repo.findById(id);
    if (!row) throw notFound('Không tìm thấy bản ủy quyền');
    assertChuBanGhi(user, row);
    if (row.status !== repo.TRANG_THAI.HIEU_LUC) {
      throw new AppError('CONFLICT', 'Bản ủy quyền đã huỷ thì không sửa được nữa');
    }
    const next = {};
    if (patch.toDate !== undefined) {
      next.toDate = ngay(patch.toDate, 'toDate');
      if (next.toDate < String(row.from_date)) {
        throw new AppError('VALIDATION_ERROR', 'Ngày kết thúc không được trước ngày bắt đầu', {
          field: 'toDate',
        });
      }
    }
    if (patch.note !== undefined) next.note = String(patch.note ?? '').trim();
    if (patch.departmentIds !== undefined) {
      const fromUser = await usersRepo.findById(row.from_user_id);
      if (!fromUser) throw notFound('Không tìm thấy người ủy quyền');
      next.departmentIds = (await chuanHoaPhamVi(fromUser, patch.departmentIds)) ?? [];
    }
    return { delegation: await repo.update(row.id, next) };
  });
}

/**
 * Huỷ (mềm). Trả về dòng đã đổi trạng thái; huỷ lại lần hai trả về chính dòng cũ chứ không lỗi —
 * bấm hai lần trên giao diện chậm mạng là chuyện thường, và kết quả cuối vẫn là "đã huỷ".
 */
export function cancel(user, id) {
  assertDangNhap(user);
  return withPgErrors(async () => {
    const row = await repo.findById(id);
    if (!row) throw notFound('Không tìm thấy bản ủy quyền');
    assertChuBanGhi(user, row);
    const updated = await repo.cancel(row.id);
    return { delegation: updated ?? row, cancelled: updated !== null };
  });
}

/**
 * Các ủy quyền đang hiệu lực CHO một người — gọi ở `attachSession` mỗi request có phiên.
 *
 * Trả về hình dạng mà `can()` cần (camelCase), và **không bao giờ** trả bản ghi mượn vai `admin`:
 * L2 đã chặn từ lúc tạo, đây là lớp chặn thứ hai cho dữ liệu cũ hoặc sửa tay trong CSDL.
 */
export async function hieuLucCho(userId, client = null) {
  const rows = await repo.listEffectiveFor(userId, client);
  return rows
    .filter((r) => r.from_role !== 'admin')
    .map((r) => ({
      id: Number(r.id),
      fromUserId: Number(r.from_user_id),
      fromUserName: r.from_user_name,
      fromRole: r.from_role,
      toDate: String(r.to_date),
      departmentIds: (r.department_ids ?? []).map((v) => Number(v)),
    }));
}

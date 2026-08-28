// Nghiệp vụ Ủy quyền có thời hạn (kế hoạch: `docs/KE-HOACH-UY-QUYEN.md`, lược đồ:
// `006_delegations.sql` + `007_delegations_approval.sql`).
//
// Bốn luật gốc và chỗ chặn của từng luật:
//
//   L1 không tự ủy quyền cho mình → `DELEGATION_SELF` (dưới) + CHECK `delegation_not_self`
//   L2 không cho mượn quyền TOÀN CỤC → `hieuLucCho()` hạ vai `admin` xuống `Phó Giám đốc` trong
//                                   đúng các phòng đã ghi, + `middleware/rbac.js` chặn vai admin
//                                   lần hai (xem chú thích của `hieuLucCho`)
//   L3 không rộng hơn quyền mình  → `DELEGATION_SCOPE_TOO_WIDE` (dưới), đối chiếu với
//                                   `department_managers` chứ không tin danh sách gửi lên
//   L4 không ủy quyền dây chuyền  → `middleware/rbac.js`: chỉ mượn cho work/subwork/task
//
// Ba luật thêm ngày 2026-08-28 theo chốt §13.4 (mục 17, 18, 20):
//
//   R1 MỌI cán bộ đều ủy quyền được — không còn danh sách vai được phép (mục 17)
//   R2 chỉ ủy quyền TỪ CAO XUỐNG THẤP hoặc NGANG BẰNG theo thứ bậc `BAC_VAI` (mục 17)
//   R3 phải CÙNG PHÒNG, trừ hai ngoại lệ cấp trên: Giám đốc → Phó Giám đốc, và Phó Giám đốc →
//      Phó Giám đốc hoặc Trưởng phòng (mục 18)
//   R4 tạo ra bản `pending` + thông báo; chỉ NGƯỜI NHẬN phê duyệt mới thành `active` (mục 20)
//
// Vì sao L2 không còn là "admin không ủy quyền được": mục 18 chốt rằng Giám đốc ủy quyền được cho
// Phó Giám đốc. Nhưng "cho mượn quyền admin" thì vẫn KHÔNG: bản ghi từ admin bắt buộc phải liệt kê
// phòng, và lúc kiểm quyền nó được đọc như quyền `Phó Giám đốc` trong đúng các phòng đó. Người mượn
// vì thế không bao giờ có quyền toàn hệ thống (không quản lý được người dùng/phòng — L4 vẫn chặn).
import { AppError, forbidden, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as departmentsRepo from '../departments/repo.js';
import * as notificationsRepo from '../notifications/repo.js';
import * as usersRepo from '../users/repo.js';
import * as repo from './repo.js';

/**
 * Thứ bậc để xét R2 — số NHỎ là cấp CAO. Nguyên văn chốt §13.4 mục 17: «Giám đốc, phó giám đốc,
 * trưởng phòng, phó phòng, cán bộ».
 *
 * `Quản lý công việc` và `Nhân viên` cùng bậc 5: cả hai đều là "cán bộ" trong câu chốt —
 * `Quản lý công việc` không phải một cấp lãnh đạo, nó là vai được giao quản lý một số công việc
 * (`works.manager_id`). Hệ quả: hai vai này ủy quyền được cho nhau (ngang bằng).
 *
 * Vai lạ (dữ liệu cũ, sửa tay) không có trong bảng ⇒ `bacVai()` trả `null` ⇒ không ủy quyền được.
 * Cấm im lặng cho qua: một vai không biết bậc thì không biết ai cao hơn ai.
 */
export const BAC_VAI = Object.freeze({
  admin: 1,
  'Phó Giám đốc': 2,
  'Trưởng phòng': 3,
  'Phó phòng': 4,
  'Quản lý công việc': 5,
  'Nhân viên': 5,
});

/** Bậc của một vai, `null` nếu vai không có trong `BAC_VAI`. */
export function bacVai(role) {
  const key = String(role ?? '');
  return Object.hasOwn(BAC_VAI, key) ? BAC_VAI[key] : null;
}

/**
 * Các cặp (vai người ủy quyền → vai người nhận) được phép KHÁC PHÒNG — ngoại lệ của R3, nguyên văn
 * §13.4 mục 18: «Phải cùng phòng, còn giám đốc có thể ủy quyền cho phó giám đốc, phó giám đốc có
 * thể ủy quyền cho nhau hoặc trưởng phòng».
 *
 * Vì sao chỉ có ba cặp này: hai vai trên cùng làm việc theo ĐƠN VỊ, không theo phòng — Giám đốc
 * không thuộc phòng nào, Phó Giám đốc phụ trách nhiều phòng. Bắt họ cùng phòng với người nhận thì
 * luật thành vô nghĩa. Từ Trưởng phòng trở xuống, phạm vi là phòng, nên cùng phòng là bắt buộc.
 */
const NGOAI_LE_KHAC_PHONG = Object.freeze({
  admin: ['Phó Giám đốc'],
  'Phó Giám đốc': ['Phó Giám đốc', 'Trưởng phòng'],
});

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
 * - `admin`          → mọi phòng. Nhưng bản ghi từ admin BẮT BUỘC liệt kê phòng (xem `create`), nên
 *                     "mọi phòng" ở đây là tập được phép CHỌN TỪ, không phải phạm vi được cấp.
 * - `Phó Giám đốc`  → các phòng có dòng `department_managers.role = 'deputy_director'` (đúng thứ
 *                     `inScope()` dùng, rbac.js:161)
 * - `Trưởng phòng` / `Phó phòng` → phòng của chính họ ∪ các phòng họ phụ trách với vai head/vice
 * - `Quản lý công việc` → phòng của chính họ. Phạm vi thật của vai này là các công việc mình quản
 *                     lý (`works.manager_id`), không theo phòng; cho mượn rộng hơn phòng mình là
 *                     nới quyền, nên chặn ở mức phòng.
 * - `Nhân viên`      → phòng của chính họ. Mượn quyền `Nhân viên` chỉ tới được nhiệm vụ do chính
 *                     người ủy quyền thực hiện (`inScopeMuon` của rbac.js), phòng chỉ là rào ngoài.
 */
async function phamViChoMuon(fromUser) {
  const ids = new Set();
  if (fromUser.role === 'admin') {
    for (const row of await departmentsRepo.listAll()) ids.add(Number(row.id));
    return ids;
  }
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

/**
 * R2 + R3 — thứ bậc và cùng phòng. Hai luật đi cùng một hàm vì chúng cùng trả lời một câu hỏi của
 * người dùng ("tôi ủy quyền cho ai được") và cùng đọc đúng hai bản ghi người.
 *
 * Thứ tự kiểm có ý: bậc trước, phòng sau. Ủy quyền LÊN cấp trên là sai nguyên tắc, còn khác phòng
 * chỉ là sai phạm vi — báo cái sai nặng hơn trước thì câu lỗi khớp với điều người dùng cần sửa.
 */
function assertBacVaPhong(fromUser, toUser) {
  const bacTu = bacVai(fromUser.role);
  const bacDen = bacVai(toUser.role);
  if (bacTu === null) {
    throw forbidden(`Phân quyền "${fromUser.role}" không hợp lệ nên không ủy quyền được`);
  }
  if (bacDen === null) {
    throw forbidden(`Phân quyền "${toUser.role}" của người nhận không hợp lệ`);
  }
  // R2 — số nhỏ là cấp cao, nên "cao xuống thấp hoặc ngang bằng" là `bacTu <= bacDen`.
  if (bacTu > bacDen) {
    throw new AppError(
      'DELEGATION_RANK_UP',
      `Chỉ ủy quyền được cho cấp thấp hơn hoặc ngang bằng: "${fromUser.role}" không ủy quyền được cho "${toUser.role}"`,
      { field: 'toUserId' }
    );
  }
  // R3 — ngoại lệ trước, vì hai vai cấp trên không làm việc theo phòng.
  const duocKhacPhong = NGOAI_LE_KHAC_PHONG[fromUser.role] ?? [];
  if (duocKhacPhong.includes(toUser.role)) return;
  const phongTu = fromUser.department_id == null ? null : Number(fromUser.department_id);
  const phongDen = toUser.department_id == null ? null : Number(toUser.department_id);
  if (phongTu === null || phongDen === null || phongTu !== phongDen) {
    throw new AppError(
      'DELEGATION_DIFFERENT_DEPARTMENT',
      'Chỉ ủy quyền được cho người cùng phòng (trừ Giám đốc ủy quyền cho Phó Giám đốc, và Phó Giám đốc ủy quyền cho Phó Giám đốc hoặc Trưởng phòng)',
      { field: 'toUserId' }
    );
  }
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
 * Tạo bản ủy quyền — ra bản `pending`, CHƯA cho mượn quyền gì (R4 · §13.4 mục 20).
 *
 * `fromUserId` chỉ admin được đặt khác mình (tạo hộ người đi công tác gấp). Người thường luôn là
 * chính mình — nếu không, ai cũng tự viết cho mình một bản "được A ủy quyền".
 *
 * Người nhận được một thông báo trong bảng `notifications` ngay trong lời gọi này. Không dùng
 * `withTransaction`: nếu câu thông báo lỗi thì bản ủy quyền vẫn nên tồn tại (người nhận thấy nó ở
 * trang «Ủy quyền của tôi»), còn quay lui cả hai thì người ủy quyền phải làm lại từ đầu vì một dòng
 * thông báo — đổi một bất tiện nhỏ thành một mất mát lớn hơn.
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
    // R2 + R3 — thứ bậc rồi cùng phòng. Thay cho danh sách `VAI_DUOC_UY_QUYEN` cũ: mục 17 chốt
    // «mọi cán bộ đều được ủy quyền», nên cái chặn không còn là vai mà là HƯỚNG của ủy quyền.
    assertBacVaPhong(fromUser, toUser);
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

    // L2 — quyền toàn cục không cho mượn. Admin KHÔNG có dòng `department_managers` nào, nên bản ghi
    // để phạm vi rỗng sẽ được `listEffectiveFor` đọc là "không phòng nào" (vô nghĩa) hoặc — nếu ai
    // đó sửa cách đọc đó — thành toàn hệ thống. Bắt liệt kê phòng ngay từ lúc tạo là chặn cả hai.
    if (fromUser.role === 'admin' && (departmentIds === null || departmentIds.length === 0)) {
      throw new AppError(
        'DELEGATION_ADMIN_SCOPE_REQUIRED',
        'Giám đốc phải ghi rõ (các) phòng khi ủy quyền — quyền toàn hệ thống không cho mượn được',
        { field: 'departmentIds' }
      );
    }

    const delegation = await repo.insert({
      fromUserId: fromUser.id,
      toUserId: toUser.id,
      departmentIds,
      fromDate,
      toDate,
      note: String(input.note ?? '').trim(),
      createdBy: user.id,
    });
    await thongBao(
      toUser.id,
      `${tenNguoi(fromUser)} đề nghị ủy quyền cho bạn từ ${delegation.from_date} đến ${delegation.to_date}. Vào «Ủy quyền của tôi» để đồng ý hoặc từ chối.`,
      delegation.id
    );
    return { delegation };
  });
}

/** Tên hiện cho người đọc thông báo. Dữ liệu cũ có dòng thiếu họ tên nên phải có đường lùi. */
function tenNguoi(row) {
  return String(row?.full_name || row?.email || row?.code || 'Một người dùng');
}

/**
 * Một dòng thông báo cho đúng một người, gắn `ref_type='delegation'` để giao diện mở được đúng bản
 * ghi. Lỗi ở đây KHÔNG được làm đổ lời gọi chính: bản ủy quyền (hoặc câu trả lời) đã ghi xong và
 * vẫn hiện ở trang «Ủy quyền của tôi» — mất một dòng thông báo không đáng đánh sập cả hành động.
 */
async function thongBao(userId, content, delegationId) {
  try {
    await notificationsRepo.insert({
      userId,
      content,
      type: notificationsRepo.LOAI.CHO_DUYET,
      refType: 'delegation',
      refId: delegationId,
    });
  } catch {
    // Cố ý im lặng: đường thông báo là phụ trợ, không phải nguồn sự thật của quyền.
  }
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
    // Sửa được cả bản `pending` (chỉnh đề nghị trước khi người ta bấm) và bản `active`. Bản đã huỷ
    // hoặc bị từ chối thì không: sửa chúng là hồi sinh một bản ghi đã có kết cục.
    if (!repo.TRANG_THAI_CON_HAN.includes(row.status)) {
      throw new AppError('CONFLICT', 'Bản ủy quyền đã kết thúc thì không sửa được nữa');
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
 * Người nhận trả lời đề nghị ủy quyền (R4 · §13.4 mục 20). Một hàm cho cả hai câu trả lời vì chúng
 * chỉ khác nhau ở trạng thái đích và ở câu chữ thông báo — tách hai bản sao là hai chỗ để quên
 * kiểm "đúng người" hoặc quên báo lại cho người ủy quyền.
 *
 * **Chỉ người được ủy quyền** bấm được, kể cả admin cũng không. Đây không phải chuyện quản trị:
 * cả tính năng này tồn tại để không ai bị gán quyền của người khác mà chưa đồng ý, nên nếu admin
 * đồng ý hộ được thì luật vừa chốt thành hình thức.
 *
 * Bấm hai lần: lần thứ hai `repo.accept/decline` trả `null` (bản ghi không còn `pending`) ⇒ trả về
 * `{ changed: false }` chứ không lỗi, và KHÔNG gửi thông báo thứ hai.
 */
function traLoi(user, id, dongY) {
  assertDangNhap(user);
  return withPgErrors(async () => {
    const row = await repo.findById(id);
    if (!row) throw notFound('Không tìm thấy bản ủy quyền');
    if (Number(row.to_user_id) !== Number(user.id)) {
      throw forbidden('Chỉ người được ủy quyền mới đồng ý hoặc từ chối bản ủy quyền này');
    }
    if (row.status !== repo.TRANG_THAI.CHO_PHE_DUYET) {
      // Đã trả lời rồi (hoặc bản ghi đã bị huỷ): trả về nguyên trạng, không đổi gì.
      return { delegation: row, changed: false };
    }
    const updated = dongY ? await repo.accept(row.id) : await repo.decline(row.id);
    if (!updated) return { delegation: row, changed: false };
    await thongBao(
      updated.from_user_id,
      `${tenNguoi(user)} đã ${dongY ? 'ĐỒNG Ý' : 'TỪ CHỐI'} bản ủy quyền từ ${updated.from_date} đến ${updated.to_date}.`,
      updated.id
    );
    return { delegation: updated, changed: true };
  });
}

/** Đồng ý — bản ghi thành `active`, từ lúc này `listEffectiveFor` mới thấy nó. */
export function accept(user, id) {
  return traLoi(user, id, true);
}

/** Từ chối — bản ghi thành `declined`, giữ lại để người ủy quyền thấy câu trả lời. */
export function decline(user, id) {
  return traLoi(user, id, false);
}

/**
 * Các ủy quyền đang hiệu lực CHO một người — gọi ở `attachSession` mỗi request có phiên.
 *
 * Trả về hình dạng mà `can()` cần (camelCase). Hai chỗ siết ở đây, cả hai đều là L2:
 *
 *  - Bản ghi từ vai `admin` KHÔNG được cho mượn vai `admin`. Nó được hạ xuống `Phó Giám đốc` —
 *    quyền cao nhất còn BÓ THEO PHÒNG — nên người mượn làm được đúng việc của một Phó Giám đốc
 *    trong các phòng đã ghi, và không bao giờ có quyền toàn hệ thống. `middleware/rbac.js` vẫn bỏ
 *    qua mọi `fromRole === 'admin'`, nên nếu ai đó xoá phép hạ vai này thì kết quả là MẤT quyền
 *    mượn, không phải nới quyền — hướng an toàn.
 *  - Bản ghi từ admin mà phạm vi rỗng thì bỏ hẳn: rỗng nghĩa là "các phòng người ủy quyền phụ
 *    trách", mà admin không phụ trách phòng nào theo `department_managers` — đọc nó thành "mọi
 *    phòng" là đúng cái L2 cấm. `create` đã bắt buộc liệt kê phòng; đây là lớp thứ hai cho dữ liệu
 *    cũ hoặc câu UPDATE viết tay.
 */
export async function hieuLucCho(userId, client = null) {
  const rows = await repo.listEffectiveFor(userId, client);
  return rows
    .filter((r) => r.from_role !== 'admin' || (r.department_ids ?? []).length > 0)
    .map((r) => ({
      id: Number(r.id),
      fromUserId: Number(r.from_user_id),
      fromUserName: r.from_user_name,
      fromRole: r.from_role === 'admin' ? 'Phó Giám đốc' : r.from_role,
      toDate: String(r.to_date),
      departmentIds: (r.department_ids ?? []).map((v) => Number(v)),
    }));
}

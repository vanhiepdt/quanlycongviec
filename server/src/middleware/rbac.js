// Phân quyền — port của `checkUserPermission` (Code.gs.moi:1313) theo ma trận §6.
//
// Ba điều khác bản cũ, mỗi điều sửa một lỗi thật:
//
//  1. **So khớp vai trò CHÍNH XÁC.** Bản cũ dùng `String(role).toLowerCase().includes('admin')`
//     nên `"Trợ lý admin"` được quyền admin và `"Phó Giám đốc"` khớp cả `"giám đốc"`
//     (bẫy §13.5 · TC-RBAC-07/08). Ở đây vai trò phải nằm đúng trong `ROLES`.
//  2. **`can()` là hàm THUẦN** — không đọc CSDL, không cần `req`, không gọi `getCurrentUser()`.
//     Vào là `(user, action, entityType, row)`, ra là `{ok, code, message}`. Nhờ vậy 120 phép
//     kiểm của ma trận chạy được mà không cần dựng máy chủ.
//  3. **Quyền và phạm vi tách làm hai lớp.** Lớp 1 `PERMISSIONS`: vai này có được làm hành động
//     này trên loại thực thể này hay không. Lớp 2 `inScope()`: dòng cụ thể có thuộc phạm vi của
//     người đó hay không. Bản cũ trộn hai lớp vào một chuỗi `if` dài nên không ai đọc ra được
//     "Nhân viên có sửa được công việc không".
//
// Người gọi phải chuẩn hoá `row` trước (xem `normalizeRow`): `can()` không biết tên cột của
// bảng nào, chỉ biết các khoá phạm vi.
import { AppError } from '../utils/errors.js';

/** 6 vai trò của cột `users.role` — khớp đúng CHECK `users_role_valid` trong 001_init.sql. */
export const ROLES = Object.freeze([
  'admin',
  'Phó Giám đốc',
  'Trưởng phòng',
  'Phó phòng',
  'Quản lý công việc',
  'Nhân viên',
]);

/**
 * 5 loại thực thể được canh cổng.
 *  - `work`     công việc cấp 1 (bảng works)
 *  - `subwork`  công việc con cấp 2 (work_items level = 2)
 *  - `task`     nhiệm vụ cấp 3 (work_items level = 3)
 *  - `user`     người dùng
 *  - `department` phòng
 * Cấp 2 và cấp 3 phải tách ra vì §6 cho Nhân viên tạo **Nhiệm vụ** nhưng không cho tạo
 * **Công việc con** — một loại thực thể chung sẽ xoá mất đúng chỗ khác biệt đó.
 */
export const ENTITIES = Object.freeze(['work', 'subwork', 'task', 'user', 'department']);

/** 4 hành động của ma trận §6. `approve` là hành động thứ 5, xét riêng vì chỉ có ở 3 thực thể. */
export const ACTIONS = Object.freeze(['read', 'create', 'update', 'delete']);
export const ACTION_APPROVE = 'approve';

// ============================================================================
// BẢNG KHAI BÁO DUY NHẤT — nguồn sự thật của phân quyền.
//
// Đọc bảng này là biết hết quyền của hệ thống; không có điều kiện quyền nào rải rác ở service.
// Bộ test sinh 6 vai × 5 thực thể × 4 hành động = 120 phép kiểm **từ chính bảng này**, nên bảng
// và test không thể lệch nhau: sửa bảng là test đổi theo, và nếu `can()` không khớp bảng thì đỏ.
//
// Ý nghĩa: "vai này ĐƯỢC PHÉP hành động này trên loại thực thể này, **khi dòng nằm trong phạm
// vi của họ**". Phạm vi là việc của `inScope()` bên dưới.
// ============================================================================
export const PERMISSIONS = Object.freeze({
  // Toàn quyền toàn đơn vị (§6 dòng 1).
  admin: {
    work: ['read', 'create', 'update', 'delete', 'approve'],
    subwork: ['read', 'create', 'update', 'delete', 'approve'],
    task: ['read', 'create', 'update', 'delete', 'approve'],
    user: ['read', 'create', 'update', 'delete'],
    department: ['read', 'create', 'update', 'delete'],
  },
  // Như admin nhưng **chỉ trong các phòng mình phụ trách** (department_managers.role =
  // 'deputy_director'). Duyệt được — đây là vai duy nhất ngoài admin có quyền duyệt (§6).
  'Phó Giám đốc': {
    work: ['read', 'create', 'update', 'delete', 'approve'],
    subwork: ['read', 'create', 'update', 'delete', 'approve'],
    task: ['read', 'create', 'update', 'delete', 'approve'],
    user: ['read'],
    department: ['read'],
  },
  // Cả phòng mình. Tạo được nhưng công việc vào trạng thái `Chờ duyệt` (việc của service, không
  // phải của rbac). KHÔNG duyệt được — kể cả việc do chính mình tạo.
  'Trưởng phòng': {
    work: ['read', 'create', 'update', 'delete'],
    subwork: ['read', 'create', 'update', 'delete'],
    task: ['read', 'create', 'update', 'delete'],
    user: ['read'],
    department: ['read'],
  },
  // Quyết định số 5: Phó phòng có quyền **giống hệt** Trưởng phòng (TC-RBAC-06). Viết lặp lại
  // thay vì trỏ tham chiếu để bảng đọc được bằng mắt và test so được từng ô.
  'Phó phòng': {
    work: ['read', 'create', 'update', 'delete'],
    subwork: ['read', 'create', 'update', 'delete'],
    task: ['read', 'create', 'update', 'delete'],
    user: ['read'],
    department: ['read'],
  },
  // Phạm vi là các công việc mình quản lý (`works.manager_id`), không phải theo phòng.
  'Quản lý công việc': {
    work: ['read', 'create', 'update', 'delete'],
    subwork: ['read', 'create', 'update', 'delete'],
    task: ['read', 'create', 'update', 'delete'],
    user: ['read'],
    department: ['read'],
  },
  // Đọc cả phòng mình; chỉ **nhiệm vụ cấp 3 của mình** là sửa được (§6 dòng cuối).
  // Không tạo/sửa công việc (TC-RBAC-02) và không tạo công việc con.
  'Nhân viên': {
    work: ['read'],
    subwork: ['read'],
    task: ['read', 'create', 'update', 'delete'],
    user: ['read'],
    department: ['read'],
  },
});

// ============================================================================
// Lớp 2 — phạm vi
// ============================================================================

/** So hai id: null/undefined **không** khớp nhau. Người không thuộc phòng nào (TC-RBAC-09) mà
 *  khớp được với dòng cũng không có phòng thì hoá ra thấy hết dữ liệu chưa gán phòng. */
function sameId(a, b) {
  return a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);
}

/**
 * Chuẩn hoá một dòng CSDL thành các khoá phạm vi mà `can()` hiểu. Gọi hàm này ở service, đừng
 * truyền thẳng dòng của `pg` vào `can()` — tên cột của works và work_items khác nhau.
 *
 * `assigned_in_work`: người này có nhiệm vụ nào khác trong cùng công việc hay không. Chỉ dùng
 * cho Nhân viên tạo nhiệm vụ mới (§6 "Chỉ trong công việc được giao") — service phải tự tra CSDL
 * rồi đặt cờ, vì `can()` không được truy vấn.
 *
 * Phòng: cả `works` và `work_items` đều có `department_id` riêng và luôn khớp nhau (§4.1,
 * 002_work_items_department.sql), nên cột của chính dòng là nguồn chính. `work_department_id` chỉ
 * còn là đường dự phòng cho những chỗ chỉ JOIN lấy phòng của công việc cha.
 */
export function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id ?? null,
    level: row.level ?? null,
    department_id: row.department_id ?? row.work_department_id ?? null,
    manager_id: row.manager_id ?? row.work_manager_id ?? null,
    assignee_id: row.assignee_id ?? null,
    created_by: row.created_by ?? null,
    assigned_in_work: row.assigned_in_work === true,
  };
}

/** Người này có quyền trên đúng dòng này không. Chỉ gọi sau khi bảng `PERMISSIONS` đã cho phép. */
function inScope(user, action, entityType, row) {
  // Người dùng và phòng: quản lý chỉ admin làm được (bảng đã chặn). Riêng `read` không giới hạn
  // phạm vi — ai cũng cần danh sách người để chọn người thực hiện và danh sách phòng để lọc.
  if (entityType === 'user' || entityType === 'department') return true;

  const dept = row.department_id;
  const mine = user.department_id;

  switch (user.role) {
    case 'admin':
      return true;

    // Chỉ các phòng có dòng trong department_managers với role='deputy_director' (TC-RBAC-05).
    case 'Phó Giám đốc':
      return (user.managedDepartmentIds ?? []).some((id) => sameId(id, dept));

    case 'Trưởng phòng':
    case 'Phó phòng':
      return sameId(dept, mine);

    // Phạm vi theo công việc mình quản lý, không theo phòng. Vẫn đọc được cả phòng mình và vẫn
    // sửa được nhiệm vụ của chính mình (họ cũng là người thực hiện như mọi người khác).
    case 'Quản lý công việc':
      if (sameId(row.manager_id, user.id)) return true;
      if (sameId(row.assignee_id, user.id)) return true;
      return action === 'read' ? sameId(dept, mine) : false;

    case 'Nhân viên':
      if (action === 'read') return sameId(dept, mine) || sameId(row.assignee_id, user.id);
      // Tạo nhiệm vụ mới: phải đã có việc trong công việc đó, hoặc tự nhận việc cho mình.
      if (action === 'create') return row.assigned_in_work || sameId(row.assignee_id, user.id);
      return sameId(row.assignee_id, user.id);

    default:
      return false;
  }
}

// ============================================================================
// Lớp 3 — MƯỢN quyền qua ủy quyền có thời hạn (006_delegations.sql)
//
// Người đi công tác cho người khác mượn quyền của mình trong một khoảng ngày. Các bản ghi đang
// hiệu lực được `attachSession` nạp sẵn vào `user.delegations` (mảng, mỗi phần tử:
// `{id, fromUserId, fromRole, departmentIds}`) — `can()` VẪN không đọc CSDL, đúng nguyên tắc 2.
//
// Bốn giới hạn, mỗi giới hạn là một dòng mã dưới đây:
//  - Chỉ 3 loại thực thể công việc mượn được. `user`/`department` KHÔNG (L4: mượn quyền không
//    được biến thành đường tạo tài khoản hay ủy quyền tiếp).
//  - Vai `admin` không mượn được, kể cả khi CSDL có dòng như thế (sửa tay / dữ liệu cũ).
//  - Phạm vi mượn bó theo `departmentIds` của bản ghi, KHÔNG theo phòng của người mượn.
//  - Quyền tự có xét TRƯỚC (xem `can()`), nên bật tính năng này không bao giờ làm mất quyền của ai.
// ============================================================================

/** Loại thực thể mượn được. */
const MUON_DUOC = Object.freeze(['work', 'subwork', 'task']);

/**
 * Phạm vi của quyền mượn — cố ý KHÔNG gọi `inScope()` với một người dùng giả.
 *
 * `inScope()` xét `Trưởng phòng` theo `user.department_id` và xét `Quản lý công việc` theo
 * `manager_id`; dựng người dùng giả cho hai vai đó thì hoặc mở rộng hơn quyền thật (lấy phòng của
 * người MƯỢN), hoặc đóng hẳn (không có `department_id` để so). Nên luật mượn viết thẳng ở đây:
 *
 *  - `Phó Giám đốc`, `Trưởng phòng`, `Phó phòng` — phạm vi thật là THEO PHÒNG ⇒ dòng phải thuộc
 *    một phòng có trong `departmentIds`.
 *  - `Quản lý công việc` — phạm vi thật là các công việc mình quản lý, KHÔNG phải cả phòng ⇒ ngoài
 *    điều kiện phòng còn phải đúng công việc của người ủy quyền. Nếu chỉ xét phòng thì người mượn
 *    được nhiều hơn người cho, trái luật L3.
 *  - Vai khác (`Nhân viên`, vai lạ) — không có phạm vi nào để cho mượn.
 */
function inScopeMuon(delegation, row) {
  const dept = (delegation.departmentIds ?? []).some((id) => sameId(id, row.department_id));
  switch (delegation.fromRole) {
    case 'Phó Giám đốc':
    case 'Trưởng phòng':
    case 'Phó phòng':
      return dept;
    case 'Quản lý công việc':
      return (
        dept &&
        (sameId(row.manager_id, delegation.fromUserId) ||
          sameId(row.assignee_id, delegation.fromUserId))
      );
    default:
      return false;
  }
}

/**
 * Thử từng bản ủy quyền đang hiệu lực. Trả về `{ok: true, viaDelegationId}` khi có một bản cho
 * lọt, ngược lại `null` để `can()` giữ nguyên câu từ chối của quyền TỰ CÓ (câu đó mới là câu người
 * dùng cần đọc: nói "ngoài phạm vi ủy quyền" cho người chưa từng được ủy quyền là vô nghĩa).
 *
 * `user.viaDelegationIds` — nếu người gọi có gắn mảng này (chỉ `attachSession` gắn, xem
 * `middleware/session.js`) thì id được ghi vào đó để `middleware/audit.js` đưa vào `activity_logs`.
 * Hàm vẫn thuần với **quyết định**: không đọc CSDL, không biến toàn cục, và bỏ mảng đi thì kết quả
 * không đổi. Đây là đường duy nhất biết CHẮC một hành động đã lọt nhờ mượn quyền — chỗ nào khác
 * cũng chỉ đoán được.
 */
function tryDelegations(user, action, entityType, row) {
  if (!Array.isArray(user.delegations) || user.delegations.length === 0) return null;
  if (!MUON_DUOC.includes(entityType)) return null;

  for (const d of user.delegations) {
    if (!d || d.fromRole === 'admin') continue;
    const table = Object.hasOwn(PERMISSIONS, d.fromRole) ? PERMISSIONS[d.fromRole] : null;
    if (!table || !table[entityType].includes(action)) continue;
    if (row && !inScopeMuon(d, row)) continue;
    if (Array.isArray(user.viaDelegationIds) && !user.viaDelegationIds.includes(d.id)) {
      user.viaDelegationIds.push(d.id);
    }
    return { ok: true, viaDelegationId: d.id };
  }
  return null;
}

// ============================================================================
// Hàm cổng duy nhất
// ============================================================================

const ENTITY_LABEL = Object.freeze({
  work: 'công việc',
  subwork: 'công việc con',
  task: 'nhiệm vụ',
  user: 'người dùng',
  department: 'phòng',
});

const ACTION_LABEL = Object.freeze({
  read: 'xem',
  create: 'tạo',
  update: 'sửa',
  delete: 'xoá',
  approve: 'duyệt',
});

const deny = (code, message) => ({ ok: false, code, message });

/**
 * Cùng chữ ký với `checkUserPermission(action, entityType, row)` của bản cũ, thêm `user` ở đầu
 * để hàm thuần. Gọi ở **cả hai nơi** (§6): middleware chặn request và service kiểm lại trước
 * khi ghi. Frontend ẩn nút chỉ để cho đẹp, không phải lớp bảo vệ.
 *
 * @param {object|null} user người đăng nhập đã chuẩn hoá (xem modules/auth/repo.js)
 * @param {string} action 'read' | 'create' | 'update' | 'delete' | 'approve'
 * @param {string} entityType một trong ENTITIES
 * @param {object|null} row dòng liên quan; `null` = hỏi quyền chung, chưa xét phạm vi
 * @returns {{ok: true} | {ok: false, code: string, message: string}}
 */
export function can(user, action, entityType, row = null) {
  if (!user) return deny('UNAUTHENTICATED', 'Bạn chưa đăng nhập');
  if (user.is_active === false) return deny('ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hoá');

  if (!ENTITIES.includes(entityType)) {
    return deny('FORBIDDEN', `Không rõ loại dữ liệu "${entityType}"`);
  }
  if (![...ACTIONS, ACTION_APPROVE].includes(action)) {
    return deny('FORBIDDEN', `Không rõ hành động "${action}"`);
  }

  // So khớp CHÍNH XÁC. `"Trợ lý admin"`, `"Giám đốc"`, `"ADMIN"` đều không phải vai trò hợp lệ
  // ⇒ không có quyền gì. Bản cũ dùng `includes()` nên cả ba đều thành admin (TC-RBAC-07/08).
  const table = Object.hasOwn(PERMISSIONS, user.role) ? PERMISSIONS[user.role] : null;
  if (!table) {
    return deny('FORBIDDEN', `Phân quyền "${user.role}" không hợp lệ, liên hệ quản trị hệ thống`);
  }

  // Lớp 4 — GHI ĐÈ từ «Bảng phân quyền hệ thống» (009): admin sửa bằng dropdown, giá trị gắn theo
  // vai. admin KHÔNG bị ghi đè (chính người sửa bảng); phạm vi `inScope()` vẫn xét như quyền thường.
  const ghiDe =
    user.role === 'admin' || !user.ghiDe || !Object.hasOwn(user.ghiDe, entityType + ':' + action)
      ? null
      : user.ghiDe[entityType + ':' + action];
  if (ghiDe === 'tu-choi') {
    return deny(
      'FORBIDDEN',
      `Quản trị hệ thống đã tắt quyền ${ACTION_LABEL[action]} ${ENTITY_LABEL[entityType]} cho vai "${user.role}"`
    );
  }
  const duocMaTran = table[entityType].includes(action) || ghiDe === 'cho-phep' || ghiDe === 'cho-duyet';
  if (!duocMaTran) {
    // Vai của chính mình không cho ⇒ thử quyền MƯỢN (ủy quyền có thời hạn) trước khi từ chối.
    const muon = tryDelegations(user, action, entityType, normalizeRow(row));
    if (muon) return muon;
    return deny(
      'FORBIDDEN',
      `Vai trò "${user.role}" không được ${ACTION_LABEL[action]} ${ENTITY_LABEL[entityType]}`
    );
  }

  // Không có dòng cụ thể: chỉ trả lời câu hỏi quyền chung (dùng để ẩn/hiện nút).
  const normalized = normalizeRow(row);
  if (!normalized) return { ok: true };

  if (!inScope(user, action, entityType, normalized)) {
    // Đúng dòng này ngoài phạm vi của mình, nhưng có thể nằm trong phạm vi được ủy quyền.
    const muon = tryDelegations(user, action, entityType, normalized);
    if (muon) return muon;
    return deny(
      'FORBIDDEN',
      `${ENTITY_LABEL[entityType].replace(/^./, (c) => c.toUpperCase())} này nằm ngoài phạm vi của bạn`
    );
  }
  return { ok: true };
}

export default can;

// ============================================================================
// Vỏ Express — mỏng, chỉ đổi kết quả của `can()` thành lỗi HTTP. Mọi logic quyền nằm trên.
// ============================================================================

/**
 * Cổng chặn request. Dùng khi quyền quyết định được **trước** lúc đọc CSDL (ví dụ tạo mới).
 * Khi cần xét theo dòng cụ thể thì service gọi `can()` lại sau khi đã tải dòng — đó là lý do
 * §6 yêu cầu gọi ở cả hai nơi.
 *
 *   router.post('/', requirePermission('create', 'work'), handler)
 */
export function requirePermission(action, entityType, getRow = null) {
  return async (req, res, next) => {
    try {
      const row = getRow ? await getRow(req) : null;
      const verdict = can(req.user ?? null, action, entityType, row);
      if (verdict.ok) return next();
      return next(new AppError(verdict.code, verdict.message));
    } catch (err) {
      return next(err);
    }
  };
}

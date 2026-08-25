// Truy vấn bảng `departments` và `department_managers`. SQL viết tay, tham số hoá 100%.
//
// `department_managers` thay ba cột email cách nhau dấu ';' của sheet "Phòng" (§4.1). Bản cũ phải
// tách chuỗi bằng `parseEmailList()` mỗi lần kiểm quyền — sai một dấu chấm phẩy là mất quyền
// duyệt mà không có lỗi nào hiện ra. Nay là một dòng một người, có khoá ngoại.
import { pool } from '../../db/pool.js';
import { buildInsert, buildUpdateSet, refToColumn } from '../../utils/sql.js';

const db = (client) => client ?? pool;

/** 3 vai trò phụ trách phòng, khớp CHECK của `department_managers.role`. */
export const MANAGER_ROLES = Object.freeze(['deputy_director', 'head', 'vice']);

const COLUMNS = 'id, code, name, sort_order, notes, created_at, updated_at';

/** Cột được phép ghi khi tạo/sửa. Tên cột chỉ đến từ đây. */
export const WRITABLE = Object.freeze(['name', 'sort_order', 'notes']);

/**
 * Mã phòng kế tiếp: `PH01`, `PH02`... Độ rộng 2, khớp `generateNextId(..., "PH", 2)` bản cũ.
 * Bỏ qua mã đã có vì seed/test chèn `PH01` viết cứng mà không nhích sequence (bẫy §13.5).
 */
export async function nextDeptCode(client = null) {
  for (let i = 0; i < 50; i += 1) {
    const { rows } = await db(client).query(
      `SELECT next_code('PH', 'seq_department_code', 2) AS code`
    );
    const code = rows[0].code;
    const { rows: existing } = await db(client).query('SELECT 1 FROM departments WHERE code = $1', [
      code,
    ]);
    if (existing.length === 0) return code;
  }
  throw new Error('Không sinh được mã phòng mới');
}

/** Danh sách phòng theo đúng thứ tự hiện trên Gantt (D9 — cột `sort_order`). */
export async function listAll(client = null) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM departments ORDER BY sort_order, name`
  );
  return rows;
}

export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM departments WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findByCode(code, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM departments WHERE code = $1`, [
    String(code ?? ''),
  ]);
  return rows[0] ?? null;
}

/** Dò theo id số HOẶC mã (`PH01`) — xem `refToColumn`. Dùng cho mọi route có `:id`. */
export async function findByRef(ref, client = null) {
  const { column, value } = refToColumn(ref);
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM departments WHERE ${column} = $1`,
    [value]
  );
  return rows[0] ?? null;
}

/**
 * Dò phòng theo TÊN. Phase 2 cần vì sheet "Người dùng" lưu tên phòng chứ không lưu mã (§13.8).
 * So sánh sau khi cắt trắng và bỏ phân biệt hoa/thường — dữ liệu nhập tay có cả hai kiểu.
 */
export async function findByName(name, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM departments WHERE lower(btrim(name)) = lower(btrim($1))`,
    [String(name ?? '')]
  );
  return rows[0] ?? null;
}

/** Ai phụ trách phòng này, kèm tên người để hiện ra giao diện. */
export async function listManagers(departmentId, client = null) {
  const { rows } = await db(client).query(
    `SELECT dm.department_id, dm.user_id, dm.role, u.full_name, u.email
       FROM department_managers dm
       JOIN users u ON u.id = dm.user_id
      WHERE dm.department_id = $1
      ORDER BY dm.role, u.full_name`,
    [departmentId]
  );
  return rows;
}

/**
 * Mọi dòng phụ trách của mọi phòng — một truy vấn cho gói đầu trang / ngữ cảnh phòng
 * (việc 5.10), thay vì `listManagers` trong vòng lặp.
 */
export async function listAllManagers(client = null) {
  const { rows } = await db(client).query(
    `SELECT dm.department_id, dm.user_id, dm.role, u.full_name, u.email
       FROM department_managers dm
       JOIN users u ON u.id = dm.user_id
      ORDER BY dm.department_id, dm.role, u.full_name`
  );
  return rows;
}

/** Các phòng một người phụ trách với một vai cụ thể. Mặc định: vai Phó Giám đốc (§6). */
export async function listDepartmentIdsManagedBy(userId, role = 'deputy_director', client = null) {
  const { rows } = await db(client).query(
    `SELECT department_id FROM department_managers
      WHERE user_id = $1 AND role = $2 ORDER BY department_id`,
    [userId, role]
  );
  return rows.map((r) => r.department_id);
}

/** Gán người phụ trách. Gán lại đúng vai cũ thì không lỗi — thao tác này phải chạy lại được. */
export async function addManager(departmentId, userId, role, client = null) {
  await db(client).query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [departmentId, userId, role]
  );
}

export async function removeManager(departmentId, userId, role, client = null) {
  const { rowCount } = await db(client).query(
    `DELETE FROM department_managers
      WHERE department_id = $1 AND user_id = $2 AND role = $3`,
    [departmentId, userId, role]
  );
  return rowCount;
}

/** Xoá hết người phụ trách của một vai (hoặc mọi vai) trước khi gán lại bộ mới. */
export async function clearManagers(departmentId, role = null, client = null) {
  if (role == null) {
    const { rowCount } = await db(client).query(
      'DELETE FROM department_managers WHERE department_id = $1',
      [departmentId]
    );
    return rowCount;
  }
  const { rowCount } = await db(client).query(
    'DELETE FROM department_managers WHERE department_id = $1 AND role = $2',
    [departmentId, role]
  );
  return rowCount;
}

/** Tạo phòng. `code` để trống thì tự sinh. */
export async function insert(data, client = null) {
  const code = data.code ?? (await nextDeptCode(client));
  const { columns, values, params } = buildInsert(WRITABLE, data, { code });
  const { rows } = await db(client).query(
    `INSERT INTO departments (${columns.join(', ')}) VALUES (${params.join(', ')})
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

/** Sửa phòng. Không có cột nào cần ghi thì trả dòng hiện tại. */
export async function update(id, patch, client = null) {
  const { sets, values } = buildUpdateSet(WRITABLE, patch, 2);
  if (sets.length === 0) return findById(id, client);
  const { rows } = await db(client).query(
    `UPDATE departments SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Xoá phòng. Service phải đếm người thuộc phòng TRƯỚC: FK `users.department_id` là SET NULL,
 * nên xoá thẳng sẽ làm mất phòng trên giấy tờ người dùng mà không báo (câu chặn của bản cũ).
 */
export async function remove(id, client = null) {
  const { rowCount } = await db(client).query('DELETE FROM departments WHERE id = $1', [id]);
  return rowCount;
}

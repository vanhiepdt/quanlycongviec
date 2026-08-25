// Truy vấn bảng `departments` và `department_managers`. SQL viết tay, tham số hoá 100%.
//
// `department_managers` thay ba cột email cách nhau dấu ';' của sheet "Phòng" (§4.1). Bản cũ phải
// tách chuỗi bằng `parseEmailList()` mỗi lần kiểm quyền — sai một dấu chấm phẩy là mất quyền
// duyệt mà không có lỗi nào hiện ra. Nay là một dòng một người, có khoá ngoại.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

/** 3 vai trò phụ trách phòng, khớp CHECK của `department_managers.role`. */
export const MANAGER_ROLES = Object.freeze(['deputy_director', 'head', 'vice']);

const COLUMNS = 'id, code, name, sort_order, notes, created_at, updated_at';

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

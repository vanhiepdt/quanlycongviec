// Truy vấn bảng `works` (Công việc — cấp 1 của cây 3 tầng, §0.1). SQL viết tay, tham số hoá 100%.
//
// Mã mới sinh bằng `next_code('CV', 'seq_work_code')` chứ không bằng "đọc mã lớn nhất rồi +1"
// như bản Apps Script (`getLastId` + `generateNextId`): hai người bấm Tạo cùng lúc thì cách cũ
// đọc ra cùng một mã lớn nhất và sinh ra hai `DA010` — sequence thì không bao giờ trả trùng
// (§7 việc 3.9, bẫy §13.5).
import { pool } from '../../db/pool.js';
import { buildInsert, buildUpdateSet, refToColumn } from '../../utils/sql.js';

const db = (client) => client ?? pool;

const COLUMNS = `id, code, name, description, manager_id, manager_name, department_id,
                 start_date, end_date, status, approval_status, approver_id, approved_at,
                 reject_reason, sort_order, created_by, created_by_name,
                 origin, assigned_by_id, assigned_by_name, assigned_at,
                 created_at, updated_at`;

/** Cột được phép ghi khi tạo/sửa. Tên cột chỉ đến từ đây, không bao giờ từ req.body. */
export const WRITABLE = Object.freeze([
  'name',
  'description',
  'manager_id',
  'manager_name',
  'department_id',
  'start_date',
  'end_date',
  'status',
  'approval_status',
  'approver_id',
  'approved_at',
  'reject_reason',
  'sort_order',
]);

/**
 * Nguồn gốc việc (003_work_origin_and_history.sql): ai lập, tự đăng ký hay được giao, ai giao
 * lần đầu. Chỉ ghi được lúc TẠO — trigger `keep_first_origin` giữ nguyên khi UPDATE, nên các cột
 * này cố ý KHÔNG nằm trong `WRITABLE`.
 */
export const ORIGIN_COLUMNS = Object.freeze([
  'created_by',
  'created_by_name',
  'origin',
  'assigned_by_id',
  'assigned_by_name',
  'assigned_at',
]);

/** Mã công việc kế tiếp: `CV001`, `CV002`... Xem §13.4 mục 10 nếu cần đổi tiền tố. */
export async function nextWorkCode(client = null) {
  const { rows } = await db(client).query(`SELECT next_code('CV', 'seq_work_code') AS code`);
  return rows[0].code;
}

export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM works WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findByCode(code, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM works WHERE code = $1`, [
    String(code ?? ''),
  ]);
  return rows[0] ?? null;
}

/** Dò theo id số HOẶC mã — xem `refToColumn`. Dùng cho mọi route có `:id`. */
export async function findByRef(ref, client = null) {
  const { column, value } = refToColumn(ref);
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM works WHERE ${column} = $1`, [
    value,
  ]);
  return rows[0] ?? null;
}

/** Khoá dòng công việc để hai request cùng sửa/nhân bản không chen nhau (chỉ dùng trong giao dịch). */
export async function lockById(id, client) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM works WHERE id = $1 FOR UPDATE`, [
    id,
  ]);
  return rows[0] ?? null;
}

/**
 * Danh sách công việc.
 *
 * `month` (YYYY-MM) lọc theo GIAO NHAU với khoảng `start_date`–`end_date`, không theo ngày tạo:
 * việc kéo dài 3 tháng phải hiện ở cả 3 tháng (hành vi của `getWorkTree` bản cũ). Công việc
 * chưa điền ngày vẫn hiện — thà hiện thừa một dòng còn hơn ẩn mất việc.
 */
export async function list(filter = {}, client = null) {
  const wheres = [];
  const values = [];
  if (filter.departmentId != null) {
    values.push(filter.departmentId);
    wheres.push(`department_id = $${values.length}`);
  }
  if (filter.managerId != null) {
    values.push(filter.managerId);
    wheres.push(`manager_id = $${values.length}`);
  }
  if (filter.approvalStatus) {
    values.push(filter.approvalStatus);
    wheres.push(`approval_status = $${values.length}`);
  }
  if (filter.month) {
    values.push(`${filter.month}-01`);
    const p = `$${values.length}::date`;
    wheres.push(`(start_date IS NULL AND end_date IS NULL
                  OR coalesce(start_date, end_date) <= (${p} + interval '1 month - 1 day')::date
                     AND coalesce(end_date, start_date) >= ${p})`);
  }
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM works
      ${wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''}
      ORDER BY sort_order, code`,
    values
  );
  return rows;
}

/** Tạo công việc. `code` để trống thì tự sinh. */
export async function insert(data, client = null) {
  const code = data.code ?? (await nextWorkCode(client));
  const { columns, values, params } = buildInsert([...WRITABLE, ...ORIGIN_COLUMNS], data, { code });
  const { rows } = await db(client).query(
    `INSERT INTO works (${columns.join(', ')}) VALUES (${params.join(', ')})
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

/** Sửa công việc. Không có cột nào cần ghi thì trả dòng hiện tại, không chạy UPDATE rỗng. */
export async function update(id, patch, client = null) {
  const { sets, values } = buildUpdateSet(WRITABLE, patch, 2);
  if (sets.length === 0) return findById(id, client);
  const { rows } = await db(client).query(
    `UPDATE works SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...values]
  );
  return rows[0] ?? null;
}

/** Xoá công việc. `work_items` và `reminders` bên dưới tự đi theo bằng CASCADE (§4.1). */
export async function remove(id, client = null) {
  const { rowCount } = await db(client).query('DELETE FROM works WHERE id = $1', [id]);
  return rowCount;
}

/**
 * Nhân bản dòng công việc (chưa gồm cây bên dưới — phần đó ở `service.copyWork`).
 *
 * Bản sao là việc chưa làm: `status` về "Chưa bắt đầu", khoá duyệt về mặc định `Đã duyệt` và
 * không mang theo người duyệt / thời điểm duyệt / lý do từ chối của bản gốc (§13.3).
 *
 * Nguồn gốc thì KHÔNG copy: bản sao là một đầu việc mới, người lập nó là người bấm Nhân bản, chứ
 * không phải người đã lập bản gốc từ năm ngoái. Vì vậy `origin` nhận từ tham số (do
 * `deriveOrigin` tính), mặc định "Tự đăng ký" cho đường gọi chưa truyền.
 */
export async function copyRow(sourceId, { code, name, ...origin }, client = null) {
  const o = {
    created_by: null,
    created_by_name: '',
    origin: 'Tự đăng ký',
    assigned_by_id: null,
    assigned_by_name: '',
    assigned_at: null,
    ...origin,
  };
  const { rows } = await db(client).query(
    `INSERT INTO works (
       code, name, description, manager_id, manager_name, department_id,
       start_date, end_date, status, sort_order,
       created_by, created_by_name, origin, assigned_by_id, assigned_by_name, assigned_at)
     SELECT $1, coalesce($2, name), description, manager_id, manager_name, department_id,
            start_date, end_date, 'Chưa bắt đầu', sort_order,
            $3, $4, $5, $6, $7, $8
       FROM works WHERE id = $9
     RETURNING ${COLUMNS}`,
    [
      code,
      name,
      o.created_by,
      o.created_by_name,
      o.origin,
      o.assigned_by_id,
      o.assigned_by_name,
      o.assigned_at,
      sourceId,
    ]
  );
  return rows[0] ?? null;
}

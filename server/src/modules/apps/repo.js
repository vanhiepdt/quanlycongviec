// Truy vấn bảng `apps` (Quản lý App — §7 việc 7.2). SQL viết tay, tham số hoá 100%.
//
// `allowed_roles text[]` là **tên vai trò**, không phải tên người: rỗng = mọi vai trò đều thấy
// (001_init.sql). Ràng buộc "chỉ chứa tên vai trò hợp lệ" canh bởi TC-SEED-18 và bởi lớp kiểm dữ
// liệu ở service — CSDL không có CHECK cho mảng này nên service là chỗ chặn duy nhất.
//
// Mã sinh bằng `next_code('APP', 'seq_app_code')`, cùng lý do với `works` và `proposals`.
import { pool } from '../../db/pool.js';
import { buildInsert, buildUpdateSet, refToColumn } from '../../utils/sql.js';

const db = (client) => client ?? pool;

const COLUMNS = `id, code, name, url, icon_url, description, category, allowed_roles,
                 created_by, created_at, updated_at`;

/** Cột được phép ghi. Tên cột chỉ đến từ đây, không bao giờ từ `req.body`. */
export const WRITABLE = Object.freeze([
  'name',
  'url',
  'icon_url',
  'description',
  'category',
  'allowed_roles',
  'created_by',
]);

export async function nextAppCode(client = null) {
  const { rows } = await db(client).query(`SELECT next_code('APP', 'seq_app_code') AS code`);
  return rows[0].code;
}

export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM apps WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Dò theo id số HOẶC mã (`APP001`) — giao diện cũ chỉ có mã trong tay (`data-id`). */
export async function findByRef(ref, client = null) {
  const { column, value } = refToColumn(ref);
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM apps WHERE ${column} = $1`, [
    value,
  ]);
  return rows[0] ?? null;
}

/**
 * Danh sách app.
 *
 * Sắp xếp theo danh mục rồi tên: lưới app của giao diện cũ nhóm theo `COL.A_CATEGORY` nên trả về
 * đã gom sẵn thì thứ tự trong mỗi nhóm ổn định giữa hai lần tải. Nhóm "CHƯA PHÂN LOẠI" (danh mục
 * rỗng) do giao diện tự đẩy xuống cuối, không sắp ở đây.
 *
 * Lọc theo vai trò làm ở SQL để người dùng thường KHÔNG tải về dòng mình không được thấy — lọc ở
 * JavaScript thì dữ liệu vẫn đi qua dây (cùng một luật với việc 7.6).
 */
export async function list({ role = null } = {}, client = null) {
  const values = [];
  let where = '';
  if (role != null) {
    values.push(role);
    where = `WHERE allowed_roles = '{}'::text[] OR $1 = ANY(allowed_roles)`;
  }
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM apps ${where} ORDER BY category, name, id`,
    values
  );
  return rows;
}

export async function insert(data, client = null) {
  const code = data.code ?? (await nextAppCode(client));
  const { columns, values, params } = buildInsert(WRITABLE, data, { code });
  const { rows } = await db(client).query(
    `INSERT INTO apps (${columns.join(', ')}) VALUES (${params.join(', ')})
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

export async function update(id, patch, client = null) {
  const { sets, values, nextIndex } = buildUpdateSet(WRITABLE, patch);
  if (sets.length === 0) return findById(id, client);
  values.push(id);
  const { rows } = await db(client).query(
    `UPDATE apps SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $${nextIndex}
      RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function remove(id, client = null) {
  const { rows } = await db(client).query('DELETE FROM apps WHERE id = $1 RETURNING code', [id]);
  return rows[0]?.code ?? null;
}

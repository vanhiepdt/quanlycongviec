// Truy vấn bảng `work_month_names` — tên hiển thị riêng theo từng tháng (008_work_month_names.sql).
//
// Một bảng phục vụ CẢ ba cấp: cấp 1 trỏ bằng `work_id`, cấp 2/cấp 3 trỏ bằng `item_id` (CHECK
// `wmn_mot_dich` bảo đảm đúng một cột có giá trị). Vì vậy mọi hàm ở đây nhận một trong hai khoá chứ
// không nhận «id + level»: nếu nhận id trần thì id 5 của `works` và id 5 của `work_items` lẫn nhau
// mà không có gì báo.
//
// SQL viết tay, tham số hoá 100%.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

const COLUMNS = 'id, work_id, item_id, month, name, created_by, created_at, updated_at';

/** Chuẩn hoá đích: đúng một trong hai khoá, trả `[workId, itemId]` để truyền tham số. */
function dich({ workId = null, itemId = null }) {
  const w = workId == null ? null : Number(workId);
  const i = itemId == null ? null : Number(itemId);
  if ((w == null) === (i == null)) {
    throw new Error('work_month_names: phải truyền ĐÚNG MỘT trong workId / itemId');
  }
  return [w, i];
}

/** Tên theo tháng của nhiều công việc cấp 1. Mảng rỗng ⇒ không đi CSDL. */
export async function listForWorks(workIds, client = null) {
  if (!Array.isArray(workIds) || workIds.length === 0) return [];
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM work_month_names WHERE work_id = ANY($1::bigint[]) ORDER BY month`,
    [workIds.map(Number)]
  );
  return rows;
}

/** Tên theo tháng của nhiều dòng cấp 2/cấp 3. */
export async function listForItems(itemIds, client = null) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return [];
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM work_month_names WHERE item_id = ANY($1::bigint[]) ORDER BY month`,
    [itemIds.map(Number)]
  );
  return rows;
}

/** Một dòng cụ thể (để nhật ký ghi được tên TRƯỚC khi sửa). */
export async function findOne({ workId = null, itemId = null, month }, client = null) {
  const [w, i] = dich({ workId, itemId });
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM work_month_names
      WHERE month = $1
        AND ($2::bigint IS NULL AND work_id IS NULL OR work_id = $2)
        AND ($3::bigint IS NULL AND item_id IS NULL OR item_id = $3)`,
    [String(month), w, i]
  );
  return rows[0] ?? null;
}

/**
 * Thêm hoặc sửa tên của một tháng.
 *
 * `ON CONFLICT` phải nói rõ chỉ mục nào vì bảng có HAI chỉ mục một phần (`ux_wmn_work`,
 * `ux_wmn_item`); Postgres không tự chọn giúp. Vì vậy hai câu, không phải một câu dùng chung.
 */
export async function upsert(
  { workId = null, itemId = null, month, name, createdBy = null },
  client = null
) {
  const [w, i] = dich({ workId, itemId });
  const laWork = w != null;
  const { rows } = await db(client).query(
    `INSERT INTO work_month_names (work_id, item_id, month, name, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (${laWork ? 'work_id' : 'item_id'}, month)
       WHERE ${laWork ? 'work_id' : 'item_id'} IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name
     RETURNING ${COLUMNS}`,
    [w, i, String(month), String(name), createdBy == null ? null : Number(createdBy)]
  );
  return rows[0];
}

/** Bỏ tên riêng của một tháng (về tên gốc). Trả số dòng đã xoá — 0 nghĩa là chưa từng đặt. */
export async function remove({ workId = null, itemId = null, month }, client = null) {
  const [w, i] = dich({ workId, itemId });
  const { rowCount } = await db(client).query(
    `DELETE FROM work_month_names
      WHERE month = $1
        AND ($2::bigint IS NULL AND work_id IS NULL OR work_id = $2)
        AND ($3::bigint IS NULL AND item_id IS NULL OR item_id = $3)`,
    [String(month), w, i]
  );
  return rowCount;
}

export default { listForWorks, listForItems, findOne, upsert, remove };

// Truy vấn bảng `reminders` (Nhắc việc). Chỉ gắn được vào Nhiệm vụ cấp 3 — quy tắc đó do trigger
// `trg_reminders_only_level3` giữ, không phải do tầng JS (§7 việc 3.8, TC-TREE-28).
//
// Bản cũ lưu nhắc việc thành mảng JSON bên trong ô "Nhắc việc" của từng nhiệm vụ, nên mỗi lần
// sửa nhiệm vụ là phải nhớ copy nguyên mảng sang object mới — sót một lần là mất sạch nhắc việc
// của dòng đó (đúng cái mà TC-TREE-20 canh). Nay là bảng riêng có khoá ngoại, sửa nhiệm vụ không
// chạm tới nhắc việc.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

const COLUMNS = 'id, work_item_id, remind_date, content, created_by, created_at';

export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM reminders WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listByItem(workItemId, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM reminders WHERE work_item_id = $1 ORDER BY remind_date, id`,
    [workItemId]
  );
  return rows;
}

/**
 * Nhắc việc của NHIỀU dòng trong một truy vấn, trả về Map `work_item_id → mảng nhắc việc`.
 * Cây 3 tầng có thể có hàng trăm nhiệm vụ; gọi `listByItem` trong vòng lặp là N+1 truy vấn.
 */
export async function mapByItemIds(itemIds, client = null) {
  const map = new Map();
  if (!itemIds || itemIds.length === 0) return map;
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM reminders WHERE work_item_id = ANY($1::bigint[])
      ORDER BY work_item_id, remind_date, id`,
    [itemIds]
  );
  for (const row of rows) {
    if (!map.has(row.work_item_id)) map.set(row.work_item_id, []);
    map.get(row.work_item_id).push(row);
  }
  return map;
}

export async function insert({ workItemId, remindDate, content = '', createdBy = null }, client) {
  const { rows } = await db(client).query(
    `INSERT INTO reminders (work_item_id, remind_date, content, created_by)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [workItemId, remindDate, content, createdBy]
  );
  return rows[0];
}

export async function update(id, { remindDate, content }, client = null) {
  const sets = [];
  const values = [id];
  if (remindDate !== undefined) {
    values.push(remindDate);
    sets.push(`remind_date = $${values.length}`);
  }
  if (content !== undefined) {
    values.push(content);
    sets.push(`content = $${values.length}`);
  }
  if (sets.length === 0) return findById(id, client);
  const { rows } = await db(client).query(
    `UPDATE reminders SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function remove(id, client = null) {
  const { rowCount } = await db(client).query('DELETE FROM reminders WHERE id = $1', [id]);
  return rowCount;
}

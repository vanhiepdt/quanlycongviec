// Ghi `activity_logs`. Một hàm ghi duy nhất để mọi nơi ghi cùng hình dạng — bản Sheets ghi
// nhật ký bằng nhiều đoạn code khác nhau nên cùng một hành động lại có hai cách gọi tên.
//
// Nhật ký là **phụ trợ**: lỗi ghi nhật ký không được làm đổ việc chính. Chỗ gọi quyết định
// điều đó (xem middleware/audit.js), còn ở đây chỉ ghi.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

export async function writeLog(entry, client = null) {
  const { rows } = await db(client).query(
    `INSERT INTO activity_logs
       (actor_id, actor_name, action, entity_type, entity_id, work_id, details, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING id, created_at`,
    [
      entry.actorId ?? null,
      entry.actorName ?? '',
      entry.action,
      entry.entityType ?? '',
      entry.entityId ?? null,
      entry.workId ?? null,
      JSON.stringify(entry.details ?? {}),
      entry.ip ?? null,
    ]
  );
  return rows[0];
}

/** Nhật ký gần nhất — dùng cho màn hình quản trị (nhóm J) và cho test. */
export async function listRecent({ limit = 50, actorId = null } = {}, client = null) {
  const { rows } = await db(client).query(
    `SELECT id, actor_id, actor_name, action, entity_type, entity_id, work_id, details, ip,
            created_at
       FROM activity_logs
      WHERE ($2::bigint IS NULL OR actor_id = $2)
      ORDER BY id DESC
      LIMIT $1`,
    [Math.min(Number(limit) || 50, 500), actorId]
  );
  return rows;
}

/**
 * Nhật ký TỪ ĐẦU của MỘT đầu việc — dòng tạo, mọi lần sửa, mọi lần chuyển (§2.3).
 *
 * `entityTypes` là mảng vì cấp 2 và cấp 3 nằm chung bảng `work_items` nhưng ghi nhật ký dưới hai
 * tên khác nhau ('subwork', 'task'); ngược lại KHÔNG được bỏ điều kiện này đi mà chỉ so `entity_id`
 * — id 5 của `works` và id 5 của `work_items` là hai dòng khác nhau, gộp lại là trộn nhật ký của
 * hai đầu việc.
 *
 * Thứ tự CŨ TRƯỚC: người dùng đọc nhật ký để lần lại diễn biến từ lúc lập, không phải để xem cái
 * mới nhất. Index `idx_activity_logs_entity` (003) phục vụ cả hai chiều sắp xếp.
 */
export async function listByEntity({ entityTypes, entityId, limit = 200 } = {}, client = null) {
  const types = (Array.isArray(entityTypes) ? entityTypes : [entityTypes]).filter(Boolean);
  if (types.length === 0 || entityId == null) return [];
  const { rows } = await db(client).query(
    `SELECT id, actor_id, actor_name, action, entity_type, entity_id, work_id, details, ip,
            created_at
       FROM activity_logs
      WHERE entity_type = ANY($1::text[]) AND entity_id = $2
      ORDER BY id
      LIMIT $3`,
    [types, entityId, Math.min(Number(limit) || 200, 1000)]
  );
  return rows;
}

/**
 * Nhật ký CẢ CÂY của một công việc cấp 1: dòng của chính nó + của mọi công việc con và nhiệm vụ
 * dưới nó (yêu cầu "công việc cha hiện tất cả của công việc con và nhiệm vụ").
 *
 * Gom bằng `work_id` chứ không bằng danh sách id đang còn: dòng con ĐÃ XOÁ cũng phải còn trong nhật
 * ký của cha, mà id của nó thì không tra lại được từ `work_items` nữa. Vế `entity_type='work'` là
 * cái lưới hứng: vài dòng cũ (xoá công việc) không có `work_id`, thiếu vế này là mất chúng.
 */
export async function listForWorkTree({ workId, limit = 200 } = {}, client = null) {
  if (workId == null) return [];
  const { rows } = await db(client).query(
    `SELECT id, actor_id, actor_name, action, entity_type, entity_id, work_id, details, ip,
            created_at
       FROM activity_logs
      WHERE work_id = $1 OR (entity_type = 'work' AND entity_id = $1)
      ORDER BY id
      LIMIT $2`,
    [workId, Math.min(Number(limit) || 200, 1000)]
  );
  return rows;
}

/**
 * Như `listByEntity` nhưng cho NHIỀU đầu việc — dùng cho cây của một công việc con (chính nó + các
 * nhiệm vụ con). Cấp 2 và cấp 3 nằm chung bảng nên vẫn phải lọc `entity_type`, xem `listByEntity`.
 */
export async function listByEntities({ entityTypes, entityIds, limit = 200 } = {}, client = null) {
  const types = (Array.isArray(entityTypes) ? entityTypes : [entityTypes]).filter(Boolean);
  const ids = (Array.isArray(entityIds) ? entityIds : [entityIds])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (types.length === 0 || ids.length === 0) return [];
  const { rows } = await db(client).query(
    `SELECT id, actor_id, actor_name, action, entity_type, entity_id, work_id, details, ip,
            created_at
       FROM activity_logs
      WHERE entity_type = ANY($1::text[]) AND entity_id = ANY($2::bigint[])
      ORDER BY id
      LIMIT $3`,
    [types, ids, Math.min(Number(limit) || 200, 1000)]
  );
  return rows;
}

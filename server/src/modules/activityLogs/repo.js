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

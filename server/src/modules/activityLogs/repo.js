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

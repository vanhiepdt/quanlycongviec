// Truy vấn bảng `sessions`. SQL viết tay, tham số hoá 100%.
//
// Phiên lưu trong CSDL chứ không phải JWT: đăng xuất và "thu hồi mọi phiên khác khi đổi mật
// khẩu" (TC-AUTH-13) phải có hiệu lực **ngay**, mà token tự chứa thì không thu hồi được.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

// Hình dạng người đăng nhập mà `can()` cần (xem middleware/rbac.js): đủ vai trò, phòng của
// mình, và danh sách phòng mình phụ trách với vai Phó Giám đốc.
const PRINCIPAL_COLUMNS = `
  u.id, u.code, u.full_name, u.email, u.position, u.role, u.object_type,
  u.department_id, u.dept_role, u.is_active, u.must_change_password,
  COALESCE(
    (SELECT array_agg(dm.department_id ORDER BY dm.department_id)
       FROM department_managers dm
      WHERE dm.user_id = u.id AND dm.role = 'deputy_director'),
    '{}'
  ) AS "managedDepartmentIds"`;

export async function createSession({ id, userId, ttlHours, ip, userAgent }, client = null) {
  const { rows } = await db(client).query(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + make_interval(hours => $3::int), $4, $5)
     RETURNING id, user_id, created_at, last_seen_at, expires_at`,
    [id, userId, ttlHours, ip ?? null, userAgent ?? '']
  );
  return rows[0];
}

/**
 * Phiên còn hiệu lực + người dùng của phiên đó, một truy vấn cho mỗi request.
 * Phiên đã hết hạn coi như không có (TC-AUTH-08) — dòng rác do `deleteExpired` dọn.
 */
export async function findLiveSession(sid, client = null) {
  const { rows } = await db(client).query(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, ${PRINCIPAL_COLUMNS}
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [sid]
  );
  return rows[0] ?? null;
}

/**
 * Gia hạn phiên khi người dùng còn hoạt động (§7 việc 1.4).
 * Chỉ ghi khi lần cuối cách đây hơn một phút: mỗi cú bấm là một request, ghi mọi lần thì bảng
 * `sessions` bị UPDATE liên tục mà không được thêm thông tin gì.
 */
export async function touchSession(sid, ttlHours, client = null) {
  const { rows } = await db(client).query(
    `UPDATE sessions
        SET last_seen_at = now(), expires_at = now() + make_interval(hours => $2::int)
      WHERE id = $1 AND last_seen_at < now() - interval '1 minute'
      RETURNING expires_at`,
    [sid, ttlHours]
  );
  return rows[0]?.expires_at ?? null;
}

export async function deleteSession(sid, client = null) {
  const { rowCount } = await db(client).query('DELETE FROM sessions WHERE id = $1', [sid]);
  return rowCount;
}

/**
 * Thu hồi các phiên khác của một người — dùng sau khi đổi mật khẩu (TC-AUTH-13).
 * `keepSid = null` nghĩa là thu hồi **tất cả** (dùng khi admin khoá tài khoản). So sánh phải qua
 * `$2::uuid IS NULL` chứ không truyền chuỗi rỗng: `id <> ''` là lỗi cú pháp uuid của Postgres.
 */
export async function deleteOtherSessions(userId, keepSid = null, client = null) {
  const { rowCount } = await db(client).query(
    `DELETE FROM sessions
      WHERE user_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, keepSid]
  );
  return rowCount;
}

/** Dọn phiên hết hạn — cron hằng ngày (§10). */
export async function deleteExpiredSessions(client = null) {
  const { rowCount } = await db(client).query('DELETE FROM sessions WHERE expires_at <= now()');
  return rowCount;
}

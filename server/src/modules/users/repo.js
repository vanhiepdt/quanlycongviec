// Truy vấn bảng `users`. SQL viết tay, **tham số hoá 100%** — không nối chuỗi vào câu SQL bao
// giờ, kể cả tên cột (§13.1 quy ước code).
//
// Mọi hàm nhận `client` tuỳ chọn ở tham số đầu: truyền client của `withTransaction()` khi cần
// nằm trong cùng một transaction, để trống thì dùng pool.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

// Cột trả về cho mọi chỗ dùng người dùng. KHÔNG có `password_hash` — băm chỉ ra khỏi CSDL ở
// đúng một hàm (`findAuthByEmail`), nhờ vậy đọc code là biết chắc nó không lọt vào phản hồi API.
const PUBLIC_COLUMNS = `
  id, code, full_name, email, position, role, object_type,
  department_id, dept_role, notes, is_active, must_change_password,
  created_at, updated_at`;

/** Chuẩn hoá email người dùng nhập: cắt trắng hai đầu. Hoa/thường để `citext` lo (TC-AUTH-03). */
export function normalizeEmail(value) {
  return String(value ?? '').trim();
}

/**
 * Tìm người dùng để xác thực — hàm DUY NHẤT lấy `password_hash` ra khỏi CSDL.
 * Trả cả tài khoản đang bị khoá và tài khoản `is_active = false`: quyết định từ chối là việc
 * của service, còn ở đây phải đọc được trạng thái mới quyết định được.
 */
export async function findAuthByEmail(email, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash, failed_logins, last_failed_login_at, locked_until
       FROM users WHERE email = $1`,
    [normalizeEmail(email)]
  );
  return rows[0] ?? null;
}

export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [
    id,
  ]);
  return rows[0] ?? null;
}

/** Băm mật khẩu của một người — chỉ dùng cho đổi mật khẩu (cần so mật khẩu cũ). */
export async function findPasswordHash(id, client = null) {
  const { rows } = await db(client).query('SELECT password_hash FROM users WHERE id = $1', [id]);
  return rows[0]?.password_hash ?? null;
}

/**
 * Người đăng nhập kèm danh sách phòng mình phụ trách — đây là hình dạng mà `can()` cần
 * (`middleware/rbac.js`). Gộp vào một truy vấn để mỗi request chỉ đi CSDL một lần cho phần quyền.
 */
export async function findPrincipalById(id, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${PUBLIC_COLUMNS},
            COALESCE(
              (SELECT array_agg(dm.department_id ORDER BY dm.department_id)
                 FROM department_managers dm
                WHERE dm.user_id = u.id AND dm.role = 'deputy_director'),
              '{}'
            ) AS "managedDepartmentIds"
       FROM users u WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Ghi một lần đăng nhập sai và khoá tài khoản khi đủ ngưỡng.
 *
 * `windowMinutes` vừa là bề rộng cửa sổ đếm, vừa là thời gian khoá (mặc định 15 phút, §7 1.3).
 * Hai giá trị bằng nhau là chủ ý: hết 15 phút khoá thì lần sai gần nhất cũng vừa ra khỏi cửa sổ,
 * nên bộ đếm tự về 1 — không có chuyện vừa mở khoá, nhập sai một lần là bị khoá tiếp 15 phút.
 *
 * Toàn bộ tính toán nằm trong MỘT câu UPDATE để hai request sai cùng lúc không ghi đè bộ đếm
 * của nhau (bản Sheets đọc-rồi-ghi nên đếm sai khi bấm nhanh).
 *
 * Biểu thức đếm viết LẶP HAI LẦN trong SET, không tách ra `FROM (SELECT …)`. Đây là chỗ dễ sai:
 * ở mức cô lập READ COMMITTED, khi hai câu UPDATE tranh cùng một dòng thì câu thứ hai chỉ đọc
 * lại **dòng đích** (EvalPlanQual), còn bảng nối trong FROM vẫn giữ ảnh cũ — nên bản dùng
 * subquery sẽ tính `next = 1` hai lần và bộ đếm đứng yên. Tham chiếu trực tiếp tới cột của
 * `users` thì được tính lại trên dòng mới, nên `failed_logins + 1` mới thật sự cộng dồn.
 */
export async function recordFailedLogin(id, { windowMinutes, maxAttempts }, client = null) {
  const { rows } = await db(client).query(
    `UPDATE users
        SET failed_logins =
              CASE WHEN last_failed_login_at IS NULL
                     OR last_failed_login_at < now() - make_interval(mins => $2::int)
                   THEN 1 ELSE failed_logins + 1 END,
            last_failed_login_at = now(),
            locked_until =
              CASE WHEN (CASE WHEN last_failed_login_at IS NULL
                                OR last_failed_login_at < now() - make_interval(mins => $2::int)
                              THEN 1 ELSE failed_logins + 1 END) >= $3::int
                   THEN now() + make_interval(mins => $2::int) END
      WHERE id = $1
  RETURNING failed_logins, locked_until`,
    [id, windowMinutes, maxAttempts]
  );
  return rows[0] ?? null;
}

/** Đăng nhập đúng: xoá sạch dấu vết sai để lần sau đếm lại từ đầu. */
export async function clearFailedLogins(id, client = null) {
  await db(client).query(
    `UPDATE users SET failed_logins = 0, last_failed_login_at = NULL, locked_until = NULL
      WHERE id = $1 AND (failed_logins <> 0 OR locked_until IS NOT NULL)`,
    [id]
  );
}

/** Đổi mật khẩu và bỏ cờ bắt đổi lần đầu. Luôn gọi trong `withTransaction()`. */
export async function updatePassword(id, passwordHash, client = null) {
  const { rows } = await db(client).query(
    `UPDATE users SET password_hash = $2, must_change_password = false
      WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, passwordHash]
  );
  return rows[0] ?? null;
}

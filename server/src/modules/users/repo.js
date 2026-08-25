// Truy vấn bảng `users`. SQL viết tay, **tham số hoá 100%** — không nối chuỗi vào câu SQL bao
// giờ, kể cả tên cột (§13.1 quy ước code).
//
// Mọi hàm nhận `client` tuỳ chọn ở tham số đầu: truyền client của `withTransaction()` khi cần
// nằm trong cùng một transaction, để trống thì dùng pool.
import { pool } from '../../db/pool.js';
import { buildInsert, buildUpdateSet, refToColumn } from '../../utils/sql.js';

const db = (client) => client ?? pool;

// Cột trả về cho mọi chỗ dùng người dùng. KHÔNG có `password_hash` — băm chỉ ra khỏi CSDL ở
// đúng một hàm (`findAuthByEmail`), nhờ vậy đọc code là biết chắc nó không lọt vào phản hồi API.
const PUBLIC_COLUMNS = `
  id, code, full_name, email, position, role, object_type,
  department_id, dept_role, notes, is_active, must_change_password,
  created_at, updated_at`;

/** Cột được phép ghi khi tạo/sửa. Tên cột chỉ đến từ đây, không bao giờ từ req.body. */
export const WRITABLE = Object.freeze([
  'full_name',
  'email',
  'position',
  'role',
  'object_type',
  'department_id',
  'dept_role',
  'notes',
  'is_active',
  'must_change_password',
]);

/**
 * Mã nhân sự kế tiếp: `NV001`, `NV002`... Sequence, không "đọc mã lớn nhất rồi +1".
 * Bỏ qua mã đã có: test và seed chèn mã viết cứng (`NV001`) mà không nhích sequence
 * (bẫy §13.5), nên lần `next_code` đầu dễ trùng.
 */
export async function nextUserCode(client = null) {
  for (let i = 0; i < 50; i += 1) {
    const { rows } = await db(client).query(`SELECT next_code('NV', 'seq_user_code') AS code`);
    const code = rows[0].code;
    const { rows: existing } = await db(client).query('SELECT 1 FROM users WHERE code = $1', [
      code,
    ]);
    if (existing.length === 0) return code;
  }
  throw new Error('Không sinh được mã nhân sự mới');
}

/** Chuẩn hoá email người dùng nhập: cắt trắng hai đầu. Hoa/thường để `citext` lo (TC-AUTH-03). */
export function normalizeEmail(value) {
  return String(value ?? '').trim();
}

/** Dò người dùng theo email (`citext`). Không trả `password_hash`. */
export async function findByEmail(email, client = null) {
  const { rows } = await db(client).query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = $1`, [
    normalizeEmail(email),
  ]);
  return rows[0] ?? null;
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

export async function findByCode(code, client = null) {
  const { rows } = await db(client).query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE code = $1`, [
    String(code ?? ''),
  ]);
  return rows[0] ?? null;
}

/** Dò theo id số HOẶC mã (`NV001`) — xem `refToColumn`. Dùng cho mọi route có `:id`. */
export async function findByRef(ref, client = null) {
  const { column, value } = refToColumn(ref);
  const { rows } = await db(client).query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE ${column} = $1`,
    [value]
  );
  return rows[0] ?? null;
}

/**
 * Toàn bộ người dùng, không có `password_hash`. Dùng cho gói đầu trang (việc 5.10) và danh sách
 * nhân sự (việc 5.11): ai cũng được *đọc* người dùng (§6), nên không lọc theo phòng ở đây.
 */
export async function listAll(client = null) {
  const { rows } = await db(client).query(
    `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY full_name, id`
  );
  return rows;
}

/**
 * Toàn bộ người dùng thuộc MỘT TRONG CÁC vai cho trước — so khớp CHÍNH XÁC (bẫy `includes`
 * 'admin', §13.5). Dùng để dựng danh sách ứng viên phân công (assignments/service.js).
 */
export async function listByRoles(roles, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${PUBLIC_COLUMNS} FROM users
      WHERE role = ANY($1::text[])
      ORDER BY full_name, id`,
    [roles]
  );
  return rows;
}

/**
 * Dò người dùng theo HỌ TÊN. Phase 3 cần vì các API cây nhận `assigneeName` (chữ người dùng
 * gõ/dán từ bản cũ) chứ không phải id.
 *
 * Trả về MẢNG: tên trùng nhau là chuyện thật trong dữ liệu cũ (`buildStaffNameEmailMap` bản cũ
 * có hẳn nhánh `duplicated`). Người gọi phải tự quyết định — gán khi đúng một người, để trống
 * khi 0 hoặc nhiều hơn 1 (TC-TREE-21). Ở đây KHÔNG đoán hộ.
 */
export async function findIdsByFullName(fullName, client = null) {
  const name = String(fullName ?? '').trim();
  if (name === '') return [];
  const { rows } = await db(client).query(
    `SELECT id, full_name, email FROM users
      WHERE lower(btrim(full_name)) = lower(btrim($1))
      ORDER BY id`,
    [name]
  );
  return rows;
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

/**
 * Tạo người dùng. `code` để trống thì tự sinh. `password_hash` bắt buộc — cột NOT NULL, không
 * được để service quên. Cột này cố ý không nằm trong `WRITABLE`: chỉ hai hàm mật khẩu mới ghi.
 */
export async function insert(data, client = null) {
  const code = data.code ?? (await nextUserCode(client));
  const { columns, values, params } = buildInsert(WRITABLE, data, {
    code,
    password_hash: data.password_hash,
  });
  const { rows } = await db(client).query(
    `INSERT INTO users (${columns.join(', ')}) VALUES (${params.join(', ')})
     RETURNING ${PUBLIC_COLUMNS}`,
    values
  );
  return rows[0];
}

/** Sửa người dùng. Không có cột nào cần ghi thì trả dòng hiện tại, không chạy UPDATE rỗng. */
export async function update(id, patch, client = null) {
  const { sets, values } = buildUpdateSet(WRITABLE, patch, 2);
  if (sets.length === 0) return findById(id, client);
  const { rows } = await db(client).query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, ...values]
  );
  return rows[0] ?? null;
}

/** Đổi băm mật khẩu (admin đặt lại). Không đụng `must_change_password` — service quyết. */
export async function setPasswordHash(id, passwordHash, client = null) {
  const { rows } = await db(client).query(
    `UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, passwordHash]
  );
  return rows[0] ?? null;
}

/** Xoá người dùng. Phiên và thông báo CASCADE; công việc/nhiệm vụ SET NULL. */
export async function remove(id, client = null) {
  const { rowCount } = await db(client).query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount;
}

/** Số người đang thuộc một phòng — chặn xoá phòng còn người (câu tiếng Việt của bản cũ). */
export async function countByDepartmentId(departmentId, client = null) {
  const { rows } = await db(client).query(
    'SELECT count(*)::int AS n FROM users WHERE department_id = $1',
    [departmentId]
  );
  return rows[0].n;
}

/** Đếm người theo vai — chặn xoá/hạ cấp admin cuối cùng. */
export async function countByRole(role, client = null) {
  const { rows } = await db(client).query('SELECT count(*)::int AS n FROM users WHERE role = $1', [
    role,
  ]);
  return rows[0].n;
}

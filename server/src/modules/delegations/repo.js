// Truy vấn bảng `delegations` (006_delegations.sql, `docs/KE-HOACH-UY-QUYEN.md`). SQL viết tay,
// tham số hoá 100%.
//
// Điểm cần giữ nguyên khi sửa file này: **mọi phép so ngày dùng `current_date` của Postgres**,
// không dùng `new Date()` của Node. Máy chủ chạy UTC, người dùng ở ICT; nếu một câu hỏi "hôm nay"
// bằng Node và câu khác bằng CSDL thì có 7 giờ mỗi ngày hệ thống tự mâu thuẫn (§13.5 bẫy (b)).
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

const COLUMNS = `id, from_user_id, to_user_id, department_ids, from_date, to_date,
                 status, note, created_by, created_at, updated_at`;

/** Cùng danh sách cột nhưng có tiền tố `d.` — dùng cho hai câu có JOIN sang `users`. Viết tay
 *  thay vì tách chuỗi COLUMNS: một dòng SQL đọc được bằng mắt đáng hơn một dòng khéo. */
const COLUMNS_D = `d.id, d.from_user_id, d.to_user_id, d.department_ids, d.from_date, d.to_date,
                   d.status, d.note, d.created_by, d.created_at, d.updated_at`;

/** Hai trạng thái duy nhất — khớp CHECK `delegation_status_ok`. «Hết hạn» suy ra từ ngày. */
export const TRANG_THAI = Object.freeze({ HIEU_LUC: 'active', DA_HUY: 'cancelled' });

/**
 * Các bản ghi đang HIỆU LỰC cho một người nhận, kèm vai trò + phạm vi phòng của người ủy quyền.
 *
 * Đây là câu chạy trên MỌI request có phiên (`attachSession`), nên nó phải trả về đúng thứ
 * `can()` cần và không gì hơn: vai trò mượn được, phạm vi phòng, tên người ủy quyền để hiện nhãn.
 *
 * `department_ids` rỗng ⇒ lấy các phòng người ủy quyền ĐANG phụ trách (`department_managers`).
 * Chỗ này cố ý không chép cứng danh sách lúc tạo: người ủy quyền được giao thêm phòng thì bản ghi
 * theo kịp, bị rút phòng thì quyền mượn hẹp lại ngay — đúng luật "không rộng hơn quyền người ủy
 * quyền" (L3) ở mọi thời điểm, không chỉ lúc bấm tạo.
 *
 * `u.is_active` phải có: người ủy quyền bị vô hiệu hoá thì quyền của họ không còn gì để cho mượn.
 */
export async function listEffectiveFor(toUserId, client = null) {
  const { rows } = await db(client).query(
    `SELECT d.id,
            d.from_user_id,
            u.full_name AS from_user_name,
            u.role      AS from_role,
            d.to_date,
            CASE
              WHEN array_length(d.department_ids, 1) IS NULL THEN COALESCE(
                (SELECT array_agg(dm.department_id)
                   FROM department_managers dm
                  WHERE dm.user_id = d.from_user_id),
                '{}'::bigint[]
              )
              ELSE d.department_ids
            END AS department_ids
       FROM delegations d
       JOIN users u ON u.id = d.from_user_id
      WHERE d.to_user_id = $1
        AND d.status = 'active'
        AND u.is_active = true
        AND current_date BETWEEN d.from_date AND d.to_date
      ORDER BY d.id`,
    [toUserId]
  );
  return rows;
}

/** Một dòng theo id, chưa xét quyền — service kiểm tiếp. */
export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM delegations WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Danh sách cho trang «Ủy quyền của tôi»: cả hai chiều của một người.
 *
 * Trả kèm tên hai đầu vì giao diện luôn cần hiện tên, và một câu JOIN ở đây rẻ hơn N lời gọi
 * `/users` từ trình duyệt. `dang_hieu_luc` tính bằng CSDL để trình duyệt không phải tự so ngày.
 */
export async function listForUser(userId, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS_D},
            uf.full_name AS from_user_name,
            ut.full_name AS to_user_name,
            (d.status = 'active' AND current_date BETWEEN d.from_date AND d.to_date)
              AS dang_hieu_luc
       FROM delegations d
       JOIN users uf ON uf.id = d.from_user_id
       JOIN users ut ON ut.id = d.to_user_id
      WHERE d.from_user_id = $1 OR d.to_user_id = $1
      ORDER BY d.status, d.from_date DESC, d.id DESC`,
    [userId]
  );
  return rows;
}

/** Toàn bộ bảng — chỉ admin (`GET /?all=1`). Chặn trên 500 dòng cho khỏi kéo cả bảng về. */
export async function listAll(client = null) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS_D},
            uf.full_name AS from_user_name,
            ut.full_name AS to_user_name,
            (d.status = 'active' AND current_date BETWEEN d.from_date AND d.to_date)
              AS dang_hieu_luc
       FROM delegations d
       JOIN users uf ON uf.id = d.from_user_id
       JOIN users ut ON ut.id = d.to_user_id
      ORDER BY d.id DESC
      LIMIT 500`
  );
  return rows;
}

/**
 * Thêm bản ghi. Không kiểm luật ở đây — service đã kiểm L1–L3 và CSDL còn 3 CHECK + EXCLUDE
 * `delegation_no_overlap`. Repo chỉ dịch sang SQL.
 *
 * `department_ids` để `null` ⇒ dùng DEFAULT `'{}'` = "theo phòng người ủy quyền đang phụ trách"
 * (xem `listEffectiveFor`), KHÔNG phải "không phòng nào".
 */
export async function insert(row, client = null) {
  const { rows } = await db(client).query(
    `INSERT INTO delegations
       (from_user_id, to_user_id, department_ids, from_date, to_date, note, created_by)
     VALUES ($1, $2, COALESCE($3::bigint[], '{}'::bigint[]), $4, $5, $6, $7)
     RETURNING ${COLUMNS}`,
    [
      row.fromUserId,
      row.toUserId,
      row.departmentIds ?? null,
      row.fromDate,
      row.toDate,
      row.note ?? '',
      row.createdBy ?? null,
    ]
  );
  return rows[0];
}

/**
 * Sửa `to_date` / `note` / `department_ids`. CỐ Ý không cho sửa hai đầu người: đổi người là một
 * bản ủy quyền khác, và cho sửa thì dòng nhật ký cũ trỏ vào một bản ghi đã mang nghĩa khác.
 *
 * `from_date` cũng không sửa: lùi ngày bắt đầu về quá khứ là hợp thức hoá ngược thời gian cho các
 * hành động đã xảy ra.
 */
export async function update(id, patch, client = null) {
  const sets = [];
  const values = [];
  const add = (sql, value) => {
    values.push(value);
    sets.push(`${sql} = $${values.length}`);
  };
  if (patch.toDate !== undefined) add('to_date', patch.toDate);
  if (patch.note !== undefined) add('note', patch.note);
  if (patch.departmentIds !== undefined) {
    values.push(patch.departmentIds ?? []);
    sets.push(`department_ids = $${values.length}::bigint[]`);
  }
  if (sets.length === 0) return findById(id, client);
  values.push(id);
  const { rows } = await db(client).query(
    `UPDATE delegations SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

/**
 * HUỶ MỀM. Không `DELETE`: nhật ký hoạt động lưu `delegation_id`, xoá dòng là biến các dòng nhật
 * ký đó thành mã số không tra được nữa.
 *
 * `status = 'active'` trong điều kiện để huỷ hai lần không đổi `updated_at` lần thứ hai.
 */
export async function cancel(id, client = null) {
  const { rows } = await db(client).query(
    `UPDATE delegations SET status = 'cancelled'
      WHERE id = $1 AND status = 'active'
      RETURNING ${COLUMNS}`,
    [id]
  );
  return rows[0] ?? null;
}

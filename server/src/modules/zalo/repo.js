// Truy vấn cho phần ZALO (017) — SQL viết tay, tham số hoá 100%.
//
// Ba nhóm câu hỏi, tương ứng ba phần của lược đồ 017:
//   1. Mã liên kết (`zalo_link_codes`): sinh, tra, đánh dấu đã dùng.
//   2. Liên kết của người dùng (`users.zalo_chat_id`): gắn, bỏ, hỏi đã liên kết chưa.
//   3. Hàng đợi đẩy tin (`notifications.zalo_*`): lấy lô, đánh dấu xong, đánh dấu lỗi.
//
// `zalo_chat_id` KHÔNG có trong `PUBLIC_COLUMNS` của `users/repo.js` và KHÔNG có trong `WRITABLE`:
// nó là định danh của một người trên Zalo, không phát tán cho mọi người xem danh sách cán bộ, và
// không ai sửa được qua `PATCH /users/:id`. Chỉ hai đường ghi được nó: webhook/polling khi đối
// chiếu đúng mã, và lệnh CLI gán tay.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

/** Hạn của một mã liên kết. 15 phút: đủ để mở Zalo nhắn tin, ngắn để mã lộ ra cũng vô dụng nhanh. */
export const HAN_MA_PHUT = 15;

/**
 * Ba loại thông báo ĐƯỢC đẩy sang Zalo.
 *
 * Không đẩy `approval_approved` và `info`: duyệt xong là tin vui, không đáng rung điện thoại của
 * người ta; và tin chung do admin phát thì đã có chuông trong ứng dụng. Người dùng chốt 2026-09-06.
 */
export const LOAI_DAY_ZALO = Object.freeze(['approval_pending', 'approval_rejected', 'overdue']);

/** Số lần thử tối đa cho một dòng. Khớp vị từ của `idx_notifications_zalo_pending`. */
export const SO_LAN_THU_TOI_DA = 3;

// ------------------------------------------------------------------------------------------
// 1. Mã liên kết
// ------------------------------------------------------------------------------------------

/**
 * Ghi một mã mới cho người dùng.
 *
 * KHÔNG xoá mã cũ của người đó: mã cũ vẫn còn hạn thì vẫn dùng được (người dùng có thể đã nhắn nó
 * đi rồi mới bấm «Lấy mã» lần nữa). Chúng tự hết hạn sau 15 phút.
 */
export async function themMa({ userId, code }, client = null) {
  const { rows } = await db(client).query(
    `INSERT INTO zalo_link_codes (user_id, code, expires_at)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)
     RETURNING id, user_id, code, expires_at, created_at`,
    [userId, code, String(HAN_MA_PHUT)]
  );
  return rows[0];
}

/** Mã đã tồn tại chưa — dùng khi sinh mã để tránh trùng (UNIQUE toàn bảng). */
export async function maDaTonTai(code, client = null) {
  const { rows } = await db(client).query(
    'SELECT EXISTS (SELECT 1 FROM zalo_link_codes WHERE code = $1) AS co',
    [code]
  );
  return rows[0].co === true;
}

/**
 * Tra một mã CÒN HIỆU LỰC: chưa dùng và chưa hết hạn.
 *
 * `FOR UPDATE` khoá dòng cho tới hết transaction: hai tin nhắn cùng mã đến cùng lúc thì chỉ một
 * lượt gắn được, lượt sau thấy `used_at` đã có. Không có khoá này thì cả hai đều thấy mã trống.
 */
export async function timMaConHieuLuc(code, client = null) {
  const { rows } = await db(client).query(
    `SELECT id, user_id, code, expires_at, used_at
       FROM zalo_link_codes
      WHERE code = $1 AND used_at IS NULL AND expires_at > now()
      FOR UPDATE`,
    [code]
  );
  return rows[0] ?? null;
}

/** Đánh dấu mã đã dùng, ghi kèm `chat_id` đã dùng nó (để đối chiếu về sau). */
export async function danhDauMaDaDung({ id, chatId }, client = null) {
  const { rowCount } = await db(client).query(
    'UPDATE zalo_link_codes SET used_at = now(), chat_id = $2 WHERE id = $1 AND used_at IS NULL',
    [id, String(chatId ?? '')]
  );
  return rowCount;
}

// ------------------------------------------------------------------------------------------
// 2. Liên kết của người dùng
// ------------------------------------------------------------------------------------------

/** Gắn `chat_id` cho một người. Ném lỗi unique nếu `chat_id` đã thuộc người khác (ux_users_zalo_chat_id). */
export async function ganChatId({ userId, chatId }, client = null) {
  const { rows } = await db(client).query(
    'UPDATE users SET zalo_chat_id = $2, updated_at = now() WHERE id = $1 RETURNING id, full_name',
    [userId, String(chatId)]
  );
  return rows[0] ?? null;
}

/** Bỏ liên kết. Trả số dòng đổi — 0 nghĩa là vốn chưa liên kết. */
export async function boChatId(userId, client = null) {
  const { rowCount } = await db(client).query(
    'UPDATE users SET zalo_chat_id = NULL, updated_at = now() WHERE id = $1 AND zalo_chat_id IS NOT NULL',
    [userId]
  );
  return rowCount;
}

/**
 * Trạng thái liên kết của một người — CHỈ cờ boolean, KHÔNG trả `chat_id`.
 *
 * Giao diện chỉ cần biết «đã liên kết hay chưa». Trả `chat_id` ra API là phát tán định danh Zalo
 * của người đó cho bất kỳ ai đọc được phản hồi.
 */
export async function trangThaiLienKet(userId, client = null) {
  const { rows } = await db(client).query(
    'SELECT (zalo_chat_id IS NOT NULL) AS da_lien_ket FROM users WHERE id = $1',
    [userId]
  );
  return rows[0] ? rows[0].da_lien_ket === true : false;
}

/** Người đang giữ một `chat_id` — để báo lỗi rõ khi ai đó cố liên kết trùng. */
export async function nguoiGiuChatId(chatId, client = null) {
  const { rows } = await db(client).query(
    'SELECT id, full_name FROM users WHERE zalo_chat_id = $1',
    [String(chatId ?? '')]
  );
  return rows[0] ?? null;
}

// ------------------------------------------------------------------------------------------
// 3. Hàng đợi đẩy tin
// ------------------------------------------------------------------------------------------

/**
 * Lô thông báo cần đẩy sang Zalo.
 *
 * Bốn điều kiện, mỗi cái có lý do riêng:
 *  · `zalo_sent_at IS NULL AND zalo_attempts < N` — khớp ĐÚNG vị từ của
 *    `idx_notifications_zalo_pending` để câu này dùng được chỉ mục bộ phận.
 *  · `type = ANY($1)` — chỉ ba loại đáng làm phiền (xem `LOAI_DAY_ZALO`).
 *  · `created_at >= now() - interval` — container tắt ba ngày rồi bật lại không dội tin cũ.
 *  · LEFT JOIN `users` chứ không INNER: người CHƯA liên kết vẫn phải lấy ra để đánh dấu bỏ qua,
 *    nếu không lịch chạy quét lại họ mãi mãi mỗi 2 phút.
 *
 * `is_read = false`: đã đọc trong ứng dụng rồi thì không cần đẩy Zalo nữa — người dùng đã biết.
 */
export async function loCanDay({ loai = LOAI_DAY_ZALO, soGio = 24, gioiHan = 50 }, client = null) {
  const { rows } = await db(client).query(
    `SELECT n.id, n.user_id, n.content, n.type, n.ref_type, n.ref_id, n.created_at,
            n.zalo_attempts, u.zalo_chat_id, u.full_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
      WHERE n.zalo_sent_at IS NULL
        AND n.zalo_attempts < $1
        AND n.type = ANY($2::text[])
        AND n.created_at >= now() - ($3 || ' hours')::interval
        AND n.is_read = false
      ORDER BY n.id
      LIMIT $4`,
    [SO_LAN_THU_TOI_DA, loai, String(soGio), Math.min(500, Math.max(1, Number(gioiHan) || 50))]
  );
  return rows;
}

/** Gửi xong (hoặc cố ý bỏ qua) — đặt `zalo_sent_at` để không quét lại. `lyDo` rỗng = thành công. */
export async function danhDauDaXuLy({ ids, lyDo = '' }, client = null) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const { rowCount } = await db(client).query(
    `UPDATE notifications SET zalo_sent_at = now(), zalo_error = $2
      WHERE id = ANY($1::bigint[]) AND zalo_sent_at IS NULL`,
    [ids, String(lyDo)]
  );
  return rowCount;
}

/**
 * Thất bại — tăng bộ đếm và ghi lý do, KHÔNG đặt `zalo_sent_at`.
 *
 * Đủ `SO_LAN_THU_TOI_DA` lần thì vị từ chỉ mục tự loại dòng ra khỏi hàng đợi; không cần cột riêng
 * để đánh dấu «đã bỏ», và cũng không mất dấu vết vì `zalo_error` còn đó.
 */
export async function danhDauThatBai({ id, lyDo }, client = null) {
  const { rows } = await db(client).query(
    `UPDATE notifications SET zalo_attempts = zalo_attempts + 1, zalo_error = $2
      WHERE id = $1
      RETURNING zalo_attempts`,
    [id, String(lyDo ?? '').slice(0, 500)]
  );
  return rows[0] ? rows[0].zalo_attempts : 0;
}

/** Số dòng còn trong hàng đợi — cho lệnh chẩn đoán, không dùng trong luồng chạy. */
export async function demHangDoi(client = null) {
  const { rows } = await db(client).query(
    `SELECT count(*)::int AS n FROM notifications
      WHERE zalo_sent_at IS NULL AND zalo_attempts < $1 AND type = ANY($2::text[])`,
    [SO_LAN_THU_TOI_DA, LOAI_DAY_ZALO]
  );
  return rows[0].n;
}

// Truy vấn bảng `notifications` (§7 việc 5.7). SQL viết tay, tham số hoá 100%.
//
// KHÔNG có email ở đây và không có ở đâu cả: §13.4 mục 4 chốt ngày 2026-08-24 là bỏ hẳn khâu gửi
// thư, không cài `nodemailer`. Thông báo chỉ nằm trong bảng này và hiện qua badge trên giao diện.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

const COLUMNS = `id, user_id, content, type, is_read, ref_type, ref_id, created_at`;

/** Loại thông báo — dùng làm khoá để giao diện chọn biểu tượng, không phải câu chữ cho người đọc. */
export const LOAI = Object.freeze({
  CHO_DUYET: 'approval_pending',
  DA_DUYET: 'approval_approved',
  TU_CHOI: 'approval_rejected',
  QUA_HAN: 'overdue',
});

/**
 * Thêm nhiều thông báo trong MỘT câu lệnh.
 *
 * Nhận mảng chứ không nhận một dòng vì đường gọi thật luôn là "báo cho tất cả Phó Giám đốc phụ
 * trách phòng này" — số người không biết trước. Gửi từng câu INSERT trong vòng lặp thì một phòng
 * có 3 lãnh đạo là 3 vòng tới CSDL nằm trong giao dịch đang giữ khoá dòng công việc.
 *
 * Danh sách rỗng ⇒ không chạy câu nào. Phòng chưa gán Phó Giám đốc là chuyện bình thường trong
 * dữ liệu thật, không phải lỗi (xem `approvals/service.js`).
 *
 * @param {Array<{userId: number, content: string, type?: string, refType?: string, refId?: number|null}>} rows
 */
export async function insertMany(rows, client = null) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const values = [];
  const tuples = rows.map((r, i) => {
    const base = i * 5;
    values.push(r.userId, r.content ?? '', r.type ?? 'info', r.refType ?? '', r.refId ?? null);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });
  const { rows: created } = await db(client).query(
    `INSERT INTO notifications (user_id, content, type, ref_type, ref_id)
     VALUES ${tuples.join(', ')}
     RETURNING ${COLUMNS}`,
    values
  );
  return created;
}

/** Một thông báo. Vỏ mỏng quanh `insertMany` để đường gọi một người đọc cho gọn. */
export async function insert(row, client = null) {
  const [created] = await insertMany([row], client);
  return created ?? null;
}

/**
 * Thông báo của một người, mới nhất trước. Chặn trên ở 200: hộp thông báo trên giao diện chỉ
 * hiện được chừng đó, kéo cả nghìn dòng về chỉ để hiện 20 là lãng phí.
 */
export async function listByUser(userId, { limit = 50, onlyUnread = false } = {}, client = null) {
  const values = [userId];
  let where = 'user_id = $1';
  if (onlyUnread) where += ' AND is_read = false';
  values.push(Math.min(200, Math.max(1, Number(limit) || 50)));
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM notifications
      WHERE ${where} ORDER BY id DESC LIMIT $${values.length}`,
    values
  );
  return rows;
}

/** Số thông báo chưa đọc — con số của chuông thông báo. */
export async function countUnread(userId, client = null) {
  const { rows } = await db(client).query(
    'SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return rows[0].n;
}

/**
 * Đánh dấu đã đọc. `ids` để trống ⇒ đánh dấu TẤT CẢ của người đó.
 *
 * `user_id = $1` luôn nằm trong điều kiện kể cả khi có `ids`: thiếu nó thì đổi số trong thân
 * request là đọc hộ thông báo của người khác.
 */
export async function markRead(userId, ids = null, client = null) {
  if (Array.isArray(ids) && ids.length > 0) {
    const { rowCount } = await db(client).query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::bigint[])',
      [userId, ids]
    );
    return rowCount;
  }
  const { rowCount } = await db(client).query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return rowCount;
}

/**
 * Đã có thông báo cùng loại cho cùng một đầu việc gửi tới người này chưa.
 *
 * Cần cho TC-APR-14 (duyệt hai lần không tạo thông báo trùng) và cho lịch quét quá hạn của việc
 * 5.8: quét mỗi ngày mà không hỏi câu này thì một nhiệm vụ quá hạn 30 ngày sinh 30 dòng giống hệt.
 * `since` giới hạn khoảng thời gian — lịch quét chỉ cần biết "hôm nay đã báo chưa".
 */
export async function exists({ userId, type, refType, refId, since = null }, client = null) {
  const values = [userId, type, refType, refId];
  let where = 'user_id = $1 AND type = $2 AND ref_type = $3 AND ref_id = $4';
  if (since) {
    values.push(since);
    where += ` AND created_at >= $${values.length}`;
  }
  const { rows } = await db(client).query(
    `SELECT EXISTS (SELECT 1 FROM notifications WHERE ${where}) AS yes`,
    values
  );
  return rows[0].yes === true;
}

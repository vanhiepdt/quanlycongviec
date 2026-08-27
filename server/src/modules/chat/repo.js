// Truy vấn bảng `chat_messages` (Chat nội bộ — §7 việc 7.3). SQL viết tay, tham số hoá 100%.
//
// Hai con số của §2.8 H2 là **luật**, không phải mặc định đẹp mắt: 3 ngày gần nhất, tối đa 50 tin.
// Bản Apps Script cũ (`getChatMessages`) lấy mốc `hôm nay − 3 ngày, 00:00` rồi `slice(-50)` — giữ
// nguyên cách tính đó để người dùng không thấy khung chat đổi nội dung sau khi chuyển máy chủ.
//
// Sắp xếp: truy vấn lấy 50 tin MỚI NHẤT (`DESC LIMIT`) rồi đảo lại thành cũ→mới. Không dùng
// `ORDER BY created_at ASC LIMIT 50`: câu đó trả 50 tin ĐẦU của khoảng, tức 3 ngày trước.
//
// `user_name` lưu tên lúc gửi (001_init.sql): xoá người thì `user_id` NULL nhưng lịch sử còn tên,
// nên phần đọc KHÔNG join `users` — join sẽ mất chính những dòng đó (TC-SEED-19).
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

const COLUMNS = `id, user_id, user_name, message, created_at`;

/** Số ngày và số tin của khung chat. Đổi ở đây, không rải hằng số trong service. */
export const SO_NGAY = 3;
export const SO_TIN = 50;

/** Mốc dưới của khoảng đọc: 00:00 của ngày (hôm nay − SO_NGAY). */
export function mocNgay(now = new Date(), soNgay = SO_NGAY) {
  const d = new Date(now);
  d.setDate(d.getDate() - soNgay);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Danh sách tin, cũ → mới.
 *
 * `since` là mốc của lần hỏi trước (hỏi lại mỗi 10 giây ở giao diện): chỉ trả tin MỚI HƠN mốc đó.
 * `since` KHÔNG nới được khoảng 3 ngày — nó chỉ thu hẹp thêm, nên gửi `since` cũ cả năm cũng không
 * moi được lịch sử ngoài khung.
 */
export async function list(
  { since = null, soNgay = SO_NGAY, soTin = SO_TIN, now = new Date() } = {},
  client = null
) {
  const values = [mocNgay(now, soNgay)];
  let where = 'WHERE created_at >= $1';
  if (since != null) {
    values.push(since);
    // So sánh sau khi CẮT VỀ MILI-GIÂY, không so trực tiếp: `created_at` của Postgres có micro-giây,
    // còn mốc đi qua JSON (`Date` của JS) chỉ giữ tới mili-giây. Nếu so thẳng thì tin cuối cùng
    // (09:05:00.123456 so với mốc 09:05:00.123) LUÔN "mới hơn" mốc, tức mỗi lượt hỏi lại 10 giây
    // đều nhận lại đúng tin vừa nhận. Bậc thang mili-giây khớp đúng độ mịn mà mốc mang được.
    // Cột `created_at` vẫn được lập chỉ mục qua điều kiện khoảng 3 ngày ở trên.
    where += ` AND date_trunc('milliseconds', created_at) > $${values.length}`;
  }
  values.push(soTin);
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM (
       SELECT ${COLUMNS} FROM chat_messages ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${values.length}
     ) AS t
     ORDER BY created_at ASC, id ASC`,
    values
  );
  return rows;
}

export async function insert({ userId = null, userName = '', message }, client = null) {
  const { rows } = await db(client).query(
    `INSERT INTO chat_messages (user_id, user_name, message)
     VALUES ($1,$2,$3) RETURNING ${COLUMNS}`,
    [userId, userName, message]
  );
  return rows[0];
}

/** Dọn tin cũ hơn `soNgay` ngày — dùng bởi cron hằng tuần (việc 7.4). Trả SỐ DÒNG đã xoá. */
export async function deleteOlderThan(soNgay, client = null) {
  const { rowCount } = await db(client).query(
    `DELETE FROM chat_messages WHERE created_at < now() - ($1 || ' days')::interval`,
    [String(soNgay)]
  );
  return rowCount;
}

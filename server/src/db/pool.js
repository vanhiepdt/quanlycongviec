// Một pool duy nhất cho cả tiến trình. Mọi truy vấn đi qua đây để có chỗ duy nhất đặt
// timeout, log câu chậm và xử lý transaction.
import pg from 'pg';
import { env } from '../config/env.js';

// Ngày (DATE, OID 1082) phải giữ nguyên chuỗi 'YYYY-MM-DD'. Nếu để pg tự đổi sang Date của
// JavaScript, múi giờ máy sẽ đẩy ngày lệch 1 — đúng loại lỗi âm thầm mà bản Sheets đã có.
pg.types.setTypeParser(1082, (v) => v);
// bigint (OID 20): trả chuỗi thì an toàn về giá trị nhưng phiền khi so sánh. Id của hệ này
// không bao giờ vượt 2^53 nên đổi sang Number cho dễ dùng.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// MẢNG bigint (OID 1016) là kiểu RIÊNG: đặt parser cho OID 20 KHÔNG áp cho nó. Bỏ dòng này thì
// `array_agg(id)` trả về ['1','2'] — so sánh id bằng === sẽ luôn sai mà không có lỗi nào hiện ra.
const parseBigintArray = pg.types.getTypeParser(1016);
pg.types.setTypeParser(1016, (v) =>
  v === null ? null : parseBigintArray(v).map((x) => (x === null ? null : Number(x)))
);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  idle_in_transaction_session_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  application_name: 'quanlycongviec',
});

pool.on('error', (err) => {
  // Kết nối rỗi bị đứt: pg tự bỏ nó ra khỏi pool. Ghi lại để biết chứ không làm chết tiến trình.
  process.stderr.write(`[db] kết nối rỗi lỗi: ${err.message}\n`);
});

/** Truy vấn ngắn, tự lấy và trả kết nối. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Trả về đúng một dòng hoặc null. */
export async function queryOne(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

/**
 * Chạy nhiều câu trong một transaction. Lỗi là ROLLBACK toàn bộ.
 * Dùng cho mọi chỗ ghi nhiều bảng: tạo công việc + ghi nhật ký, xoá cấp 2 + con cháu...
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Kết nối đã đứt; bỏ qua để không che lỗi gốc bên dưới.
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

export default pool;

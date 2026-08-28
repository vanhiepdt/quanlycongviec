// Tiện ích chung cho test tích hợp. Mọi file test tự dọn bảng trước khi chạy để không phụ
// thuộc thứ tự file (§8.2).
import { pool } from '../../src/db/pool.js';
import { flushAudit } from '../../src/middleware/audit.js';

const BUSINESS_TABLES = [
  'sessions',
  'activity_logs',
  'notifications',
  'chat_messages',
  'apps',
  'proposals',
  'reminders',
  // delegations trỏ vào users nên phải xoá trước users. CASCADE của TRUNCATE cũng lo được, nhưng
  // liệt kê thẳng thì đọc file này là biết đủ danh sách bảng nghiệp vụ.
  'delegations',
  // Tên theo tháng trỏ vào CẢ works và work_items (008_work_month_names.sql) nên xoá trước hai bảng
  // đó. `schema.test.js` chốt `names.toHaveLength(BUSINESS_TABLES.length + 1)` — thêm bảng mà quên
  // dòng này là test lược đồ đỏ.
  'work_month_names',
  'work_items',
  'works',
  'department_managers',
  'users',
  'departments',
];

export { BUSINESS_TABLES, pool };

/** Xoá sạch dữ liệu, giữ nguyên lược đồ. Sequence sinh mã cũng về 1 để mã trong test đoán được. */
export async function resetTables() {
  // `middleware/audit.js` ghi nhật ký ở `res.on('finish')`, tức SAU khi supertest đã trả về. Không
  // chờ ở đây thì lượt ghi của test TRƯỚC rơi vào sau `TRUNCATE` này và hiện ra trong test SAU như
  // dòng lạ — đúng kiểu đỏ giả đổi chỗ mỗi lượt chạy, mất công đi tìm ở chỗ không có lỗi.
  await flushAudit();
  await pool.query(`TRUNCATE ${BUSINESS_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  await pool.query(`
    SELECT setval(s, 1, false) FROM unnest(ARRAY[
      'seq_department_code','seq_user_code','seq_work_code',
      'seq_work_item_code','seq_proposal_code','seq_app_code'
    ]::regclass[]) AS s`);
}

/** Một phòng tối thiểu. */
export async function makeDepartment(over = {}) {
  const d = { code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1, ...over };
  const { rows } = await pool.query(
    'INSERT INTO departments (code, name, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [d.code, d.name, d.sort_order]
  );
  return rows[0];
}

/** Một người dùng tối thiểu. password_hash là chuỗi giả — test lược đồ không cần băm thật. */
export async function makeUser(over = {}) {
  const u = {
    code: 'NV001',
    full_name: 'Nguyễn Văn A',
    email: 'a@congty.vn',
    password_hash: '$2y$10$khong-phai-bam-that',
    role: 'Nhân viên',
    department_id: null,
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO users (code, full_name, email, password_hash, role, department_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [u.code, u.full_name, u.email, u.password_hash, u.role, u.department_id]
  );
  return rows[0];
}

/** Một công việc cấp 1. */
export async function makeWork(over = {}) {
  const w = { code: 'DA001', name: 'Công việc thử', department_id: null, ...over };
  const { rows } = await pool.query(
    `INSERT INTO works (code, name, start_date, end_date, department_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [w.code, w.name, w.start_date ?? null, w.end_date ?? null, w.department_id]
  );
  return rows[0];
}

/**
 * Một dòng work_items; level 2 là công việc con, level 3 là nhiệm vụ.
 *
 * `department_id` để trống là bình thường: trigger `trg_work_items_sync_department` tự lấy phòng
 * của công việc cha (§4.1). Truyền phòng KHÁC công việc cha thì CSDL nổ — đó là điều TC-TREE-36
 * canh, không phải lỗi của helper này.
 */
export async function makeItem(over = {}) {
  const i = {
    code: 'DA001-01',
    work_id: null,
    parent_id: null,
    level: 2,
    name: 'Việc con',
    department_id: null,
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO work_items (code, work_id, parent_id, level, name, department_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [i.code, i.work_id, i.parent_id, i.level, i.name, i.department_id]
  );
  return rows[0];
}

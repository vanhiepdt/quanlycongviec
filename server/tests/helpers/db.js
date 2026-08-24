// Tiện ích chung cho test tích hợp. Mọi file test tự dọn bảng trước khi chạy để không phụ
// thuộc thứ tự file (§8.2).
import { pool } from '../../src/db/pool.js';

const BUSINESS_TABLES = [
  'sessions',
  'activity_logs',
  'notifications',
  'chat_messages',
  'apps',
  'proposals',
  'reminders',
  'work_items',
  'works',
  'department_managers',
  'users',
  'departments',
];

export { BUSINESS_TABLES, pool };

/** Xoá sạch dữ liệu, giữ nguyên lược đồ. Sequence sinh mã cũng về 1 để mã trong test đoán được. */
export async function resetTables() {
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
  const w = { code: 'DA001', name: 'Công việc thử', ...over };
  const { rows } = await pool.query(
    'INSERT INTO works (code, name, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING *',
    [w.code, w.name, w.start_date ?? null, w.end_date ?? null]
  );
  return rows[0];
}

/** Một dòng work_items; level 2 là công việc con, level 3 là nhiệm vụ. */
export async function makeItem(over = {}) {
  const i = {
    code: 'DA001-01',
    work_id: null,
    parent_id: null,
    level: 2,
    name: 'Việc con',
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO work_items (code, work_id, parent_id, level, name)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [i.code, i.work_id, i.parent_id, i.level, i.name]
  );
  return rows[0];
}

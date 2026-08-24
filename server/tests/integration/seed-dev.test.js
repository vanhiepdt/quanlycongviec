// Dữ liệu mẫu §13.7 phải NHẬP ĐƯỢC THẬT. Test này tồn tại vì bảng §13.7 trong kế hoạch từng ghi
// vai trò "Quản lý dự án" — sai từ vựng và vi phạm CHECK `users_role_valid`; nếu không có test
// này thì lỗi chỉ hiện ra lúc người dùng chạy `npm run seed:dev` trên máy họ.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, pool } from '../../src/db/pool.js';
import { runSeed } from '../../src/db/seeds/run.js';
import { verifyPassword } from '../../src/modules/auth/password.js';
import { resetTables } from '../helpers/db.js';

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closePool();
});

describe('dữ liệu mẫu dev.sql', () => {
  it('nhập được và đúng số lượng của §13.7', async () => {
    const r = await runSeed('dev.sql');
    expect(Number(r.departments)).toBe(4);
    expect(Number(r.users)).toBe(10);
    expect(Number(r.managers)).toBe(7);
  });

  it('chạy hai lần không sinh bản trùng', async () => {
    await runSeed('dev.sql');
    await runSeed('dev.sql');
    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM users) AS u,
              (SELECT count(*)::int FROM departments) AS d,
              (SELECT count(*)::int FROM department_managers) AS m`
    );
    expect(rows[0]).toEqual({ u: 10, d: 4, m: 7 });
  });

  it('mật khẩu mẫu đăng nhập được và cả 10 người đều bị bắt đổi lần đầu', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query(
      'SELECT code, password_hash, must_change_password, is_active FROM users ORDER BY code'
    );
    expect(rows).toHaveLength(10);
    for (const u of rows) {
      expect(u.must_change_password, u.code).toBe(true);
      expect(u.is_active, u.code).toBe(true);
    }
    // Kiểm băm thật của một người: hằng băm trong dev.sql phải khớp mật khẩu ghi trong tài liệu.
    await expect(verifyPassword('Test@12345', rows[0].password_hash)).resolves.toBe(true);
  });

  it('hai Phó Giám đốc phụ trách HAI nhóm phòng khác nhau — điều kiện của TC-RBAC-05', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query(
      `SELECT u.code, array_agg(d.code ORDER BY d.code) AS depts
         FROM department_managers dm
         JOIN users u ON u.id = dm.user_id
         JOIN departments d ON d.id = dm.department_id
        WHERE dm.role = 'deputy_director'
        GROUP BY u.code ORDER BY u.code`
    );
    expect(rows).toEqual([
      { code: 'TEST002', depts: ['PH01', 'PH02'] },
      { code: 'TEST003', depts: ['PH03', 'PH04'] },
    ]);
  });

  it('có đúng một người KHÔNG thuộc phòng nào (TEST010) cho TC-RBAC-09', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query(
      `SELECT code FROM users WHERE department_id IS NULL AND role = 'Nhân viên' ORDER BY code`
    );
    expect(rows.map((r) => r.code)).toEqual(['TEST010']);
  });

  it('đủ 6 vai trò hợp lệ xuất hiện trong dữ liệu mẫu', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query('SELECT DISTINCT role FROM users ORDER BY role');
    expect(rows.map((r) => r.role).sort()).toEqual(
      [
        'admin',
        'Nhân viên',
        'Phó Giám đốc',
        'Phó phòng',
        'Quản lý công việc',
        'Trưởng phòng',
      ].sort()
    );
  });
});

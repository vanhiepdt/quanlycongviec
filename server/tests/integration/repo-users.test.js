// Repo users chạy thật trên PostgreSQL. Trọng tâm là `recordFailedLogin`: nó là chỗ duy nhất
// trong Phase 1 có tính toán nằm hẳn trong SQL, và `auth.login` (§7 1.3) dựng trên nó.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../src/modules/users/repo.js';
import { makeDepartment, makeUser, pool, resetTables } from '../helpers/db.js';

const LOCK = { windowMinutes: 15, maxAttempts: 5 };

let dept;
let user;

beforeAll(resetTables);

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  user = await makeUser({ email: 'a@congty.vn', department_id: dept.id });
});

describe('findAuthByEmail', () => {
  it('trả về băm mật khẩu và trạng thái khoá', async () => {
    const row = await repo.findAuthByEmail('a@congty.vn');
    expect(row.id).toBe(user.id);
    expect(row.password_hash).toBe(user.password_hash);
    expect(row).toMatchObject({ failed_logins: 0, last_failed_login_at: null, locked_until: null });
  });

  it('TC-AUTH-03: email VIẾT HOA vẫn tìm ra (cột citext)', async () => {
    expect((await repo.findAuthByEmail('A@CongTy.VN'))?.id).toBe(user.id);
  });

  it('email có dấu cách hai đầu vẫn tìm ra', async () => {
    expect((await repo.findAuthByEmail('  a@congty.vn  '))?.id).toBe(user.id);
  });

  it('email không tồn tại → null, không ném lỗi', async () => {
    expect(await repo.findAuthByEmail('khong-co@congty.vn')).toBeNull();
    expect(await repo.findAuthByEmail(null)).toBeNull();
  });
});

describe('findById / findPasswordHash', () => {
  it('findById KHÔNG trả về password_hash', async () => {
    const row = await repo.findById(user.id);
    expect(row.email).toBe('a@congty.vn');
    expect(Object.keys(row)).not.toContain('password_hash');
  });

  it('findById id không có → null', async () => {
    expect(await repo.findById(999999)).toBeNull();
  });

  it('findPasswordHash trả đúng băm, id lạ → null', async () => {
    expect(await repo.findPasswordHash(user.id)).toBe(user.password_hash);
    expect(await repo.findPasswordHash(999999)).toBeNull();
  });
});

describe('findPrincipalById — hình dạng mà can() cần', () => {
  it('người thường: managedDepartmentIds là mảng rỗng, không phải null', async () => {
    const p = await repo.findPrincipalById(user.id);
    expect(p.managedDepartmentIds).toEqual([]);
    expect(p.role).toBe('Nhân viên');
    expect(Object.keys(p)).not.toContain('password_hash');
  });

  it('Phó Giám đốc: đúng các phòng mình phụ trách, đã sắp thứ tự', async () => {
    const d2 = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });
    const pgd = await makeUser({
      code: 'NV002',
      email: 'pgd@congty.vn',
      role: 'Phó Giám đốc',
      full_name: 'Trần Thị B',
    });
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role)
       VALUES ($1,$3,'deputy_director'), ($2,$3,'deputy_director')`,
      [d2.id, dept.id, pgd.id]
    );
    // Thêm một vai KHÁC ở phòng khác để chắc chắn truy vấn lọc theo role.
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role) VALUES ($1,$2,'head')`,
      [d2.id, user.id]
    );

    const p = await repo.findPrincipalById(pgd.id);
    expect(p.managedDepartmentIds).toEqual([dept.id, d2.id].sort((a, b) => a - b));
    expect((await repo.findPrincipalById(user.id)).managedDepartmentIds).toEqual([]);
  });
});

describe('recordFailedLogin — khoá sau 5 lần sai trong 15 phút', () => {
  it('lần sai đầu: đếm 1, chưa khoá', async () => {
    expect(await repo.recordFailedLogin(user.id, LOCK)).toMatchObject({
      failed_logins: 1,
      locked_until: null,
    });
  });

  it('TC-AUTH-05: đúng lần thứ 5 mới khoá, và khoá 15 phút', async () => {
    for (let i = 1; i <= 4; i += 1) {
      const r = await repo.recordFailedLogin(user.id, LOCK);
      expect(r.failed_logins).toBe(i);
      expect(r.locked_until).toBeNull();
    }
    const fifth = await repo.recordFailedLogin(user.id, LOCK);
    expect(fifth.failed_logins).toBe(5);
    expect(fifth.locked_until).toBeInstanceOf(Date);
    const phut = (fifth.locked_until.getTime() - Date.now()) / 60000;
    expect(phut).toBeGreaterThan(14);
    // Trần 16 chứ không phải 15: `locked_until` do `now()` của Postgres tính, còn `Date.now()` là
    // đồng hồ của máy chạy test. Hai đồng hồ lệch vài chục ms là bình thường (container db-test),
    // và một khẳng định "≤ 15" sẽ đỏ ngẫu nhiên vì đúng chỗ đó chứ không vì code sai.
    expect(phut).toBeLessThan(16);
  });

  it('lần sai cũ hơn 15 phút không cộng dồn — bộ đếm về 1, tài khoản ít dùng không bị khoá oan', async () => {
    await pool.query(
      `UPDATE users SET failed_logins = 4, last_failed_login_at = now() - interval '20 minutes'
        WHERE id = $1`,
      [user.id]
    );
    expect(await repo.recordFailedLogin(user.id, LOCK)).toMatchObject({
      failed_logins: 1,
      locked_until: null,
    });
  });

  it('lần sai cách 14 phút vẫn trong cửa sổ — cộng dồn', async () => {
    await pool.query(
      `UPDATE users SET failed_logins = 4, last_failed_login_at = now() - interval '14 minutes'
        WHERE id = $1`,
      [user.id]
    );
    const r = await repo.recordFailedLogin(user.id, LOCK);
    expect(r.failed_logins).toBe(5);
    expect(r.locked_until).not.toBeNull();
  });

  it('hết hạn khoá thì lần sai tiếp theo đếm lại từ 1, không khoá tiếp ngay', async () => {
    // Đúng tình huống sau khi khoá 15 phút trôi qua: locked_until đã quá hạn, lần sai gần nhất
    // cũng vừa ra khỏi cửa sổ 15 phút.
    await pool.query(
      `UPDATE users
          SET failed_logins = 5,
              last_failed_login_at = now() - interval '16 minutes',
              locked_until = now() - interval '1 minute'
        WHERE id = $1`,
      [user.id]
    );
    expect(await repo.recordFailedLogin(user.id, LOCK)).toMatchObject({
      failed_logins: 1,
      locked_until: null,
    });
  });

  it('hai lần sai đồng thời vẫn đếm thành 2 (không ghi đè nhau)', async () => {
    await Promise.all([
      repo.recordFailedLogin(user.id, LOCK),
      repo.recordFailedLogin(user.id, LOCK),
    ]);
    const { rows } = await pool.query('SELECT failed_logins FROM users WHERE id = $1', [user.id]);
    expect(rows[0].failed_logins).toBe(2);
  });

  it('id không tồn tại → null', async () => {
    expect(await repo.recordFailedLogin(999999, LOCK)).toBeNull();
  });
});

describe('clearFailedLogins / updatePassword', () => {
  it('đăng nhập đúng xoá sạch bộ đếm và khoá', async () => {
    await pool.query(
      `UPDATE users SET failed_logins = 5, last_failed_login_at = now(),
              locked_until = now() + interval '15 minutes' WHERE id = $1`,
      [user.id]
    );
    await repo.clearFailedLogins(user.id);
    const row = await repo.findAuthByEmail('a@congty.vn');
    expect(row).toMatchObject({ failed_logins: 0, last_failed_login_at: null, locked_until: null });
  });

  it('updatePassword đổi băm, bỏ cờ bắt đổi lần đầu, và không trả băm ra ngoài', async () => {
    await pool.query('UPDATE users SET must_change_password = true WHERE id = $1', [user.id]);
    const after = await repo.updatePassword(user.id, '$2b$12$bam-moi');
    expect(after.must_change_password).toBe(false);
    expect(Object.keys(after)).not.toContain('password_hash');
    expect(await repo.findPasswordHash(user.id)).toBe('$2b$12$bam-moi');
  });

  it('updatePassword id lạ → null, không đổi ai cả', async () => {
    expect(await repo.updatePassword(999999, 'x')).toBeNull();
    expect(await repo.findPasswordHash(user.id)).toBe(user.password_hash);
  });
});

describe('normalizeEmail', () => {
  it('cắt trắng hai đầu, giữ nguyên hoa/thường (để citext lo)', () => {
    expect(repo.normalizeEmail('  A@B.vn ')).toBe('A@B.vn');
    expect(repo.normalizeEmail(null)).toBe('');
    expect(repo.normalizeEmail(undefined)).toBe('');
  });
});

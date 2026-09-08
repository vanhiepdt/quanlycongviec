import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool } from '../../src/db/pool.js';
import { makeUser, pool, resetTables } from '../helpers/db.js';

const migration = readFileSync(
  new URL('../../src/db/migrations/021_remove_legacy_manager_role.sql', import.meta.url),
  'utf8'
);
const up = migration.split('-- Up Migration')[1].split('-- Down Migration')[0];
const down = migration.split('-- Down Migration')[1];
beforeEach(resetTables);
afterAll(closePool);

describe('021 bỏ vai Quản lý công việc', () => {
  it('chuẩn hóa TP/PP/Cán bộ, giữ admin, mật khẩu, Zalo, dữ liệu và down không hoàn tác vai đã sửa', async () => {
    await makeUser({ code: 'NV001', email: 'admin@test.local', role: 'admin' });
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(down);
      await db.query(`INSERT INTO users(code, full_name, email, password_hash, role, dept_role, zalo_chat_id)
        VALUES ('NV002','TP','tp@test.local','kept-hash','Quản lý công việc','Trưởng phòng','test-chat'),
               ('NV003','PP','pp@test.local','kept-hash','Quản lý công việc','Phó phòng',NULL),
               ('NV004','CB','cb@test.local','kept-hash','Quản lý công việc',NULL,NULL),
               ('NV005','TP cũ','tp-old@test.local','kept-hash','Nhân viên','Trưởng phòng',NULL)`);
      await db.query(
        "INSERT INTO permission_overrides(vai,entity_type,action,gia_tri) VALUES ('Quản lý công việc','work','read','cho-phep')"
      );
      await db.query(
        "INSERT INTO apps(code,name,allowed_roles) VALUES ('APP001','Riêng',ARRAY['Quản lý công việc']),('APP002','Chung',ARRAY['Quản lý công việc','Nhân viên']),('APP003','Trùng vai cũ',ARRAY['Quản lý công việc','Quản lý công việc'])"
      );
      const snapshot = async () =>
        (
          await db.query(
            "SELECT to_jsonb(users) - 'role' - 'updated_at' AS value FROM users ORDER BY id"
          )
        ).rows;
      const before = await snapshot();
      await db.query(up);
      await db.query(up);
      expect(await snapshot()).toEqual(before);
      expect(
        (await db.query('SELECT role FROM users ORDER BY code')).rows.map((row) => row.role)
      ).toEqual(['admin', 'Trưởng phòng', 'Phó phòng', 'Nhân viên', 'Trưởng phòng']);
      expect((await db.query('SELECT * FROM permission_overrides')).rows).toHaveLength(0);
      expect((await db.query('SELECT allowed_roles FROM apps ORDER BY code')).rows).toEqual([
        { allowed_roles: ['admin'] },
        { allowed_roles: ['Nhân viên'] },
        { allowed_roles: ['admin'] },
      ]);
      await db.query('SAVEPOINT check_role');
      await expect(
        db.query("UPDATE users SET role='Quản lý công việc' WHERE code='NV002'")
      ).rejects.toMatchObject({ code: '23514' });
      await db.query('ROLLBACK TO SAVEPOINT check_role');
      await db.query(down);
      expect((await db.query("SELECT role FROM users WHERE code='NV002'")).rows[0].role).toBe(
        'Trưởng phòng'
      );
      await db.query(up);
    } finally {
      await db.query('ROLLBACK');
      db.release();
    }
  });
});

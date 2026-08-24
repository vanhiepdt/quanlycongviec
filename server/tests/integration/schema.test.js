// TC-DB-01..16 — kiểm chính migration 001_init.sql: đủ bảng, đủ index, và các ràng buộc
// thật sự CHẶN được dữ liệu sai. Không kiểm "bảng có tồn tại" là không đủ: bẫy của bản cũ
// nằm ở chỗ dữ liệu sai vẫn lọt vào (§13.5).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool } from '../../src/db/pool.js';
import {
  BUSINESS_TABLES,
  makeDepartment,
  makeItem,
  makeUser,
  makeWork,
  pool,
  resetTables,
} from '../helpers/db.js';

const EXPECTED_INDEXES = [
  'idx_work_items_work_level',
  'idx_work_items_parent',
  'idx_work_items_assignee_l3',
  'idx_work_items_due_open',
  'idx_works_dept_approval',
  'idx_works_dates',
  'idx_activity_logs_created',
  'idx_notifications_user_read',
  'idx_chat_messages_created',
  'idx_sessions_expires',
];

/** Chạy một câu SQL và trả về mã lỗi + lời nhắn, thay vì để test đỏ vì ném lỗi. */
async function expectReject(sql, params) {
  try {
    await pool.query(sql, params);
  } catch (err) {
    return { code: err.code, message: err.message };
  }
  throw new Error(`Câu SQL lẽ ra phải bị chặn nhưng lại chạy được: ${sql}`);
}

beforeAll(async () => {
  await resetTables();
});

afterAll(async () => {
  await closePool();
});

describe('001_init — lược đồ', () => {
  it('TC-DB-01: có đủ 12 bảng nghiệp vụ (13 kể cả pgmigrations của node-pg-migrate)', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toContain('pgmigrations');
    for (const t of BUSINESS_TABLES) expect(names, `thiếu bảng ${t}`).toContain(t);
    expect(names).toHaveLength(BUSINESS_TABLES.length + 1);
  });

  it('TC-DB-02: có đủ 10 index bắt buộc của §4.2', async () => {
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`
    );
    const names = rows.map((r) => r.indexname);
    for (const idx of EXPECTED_INDEXES) expect(names, `thiếu index ${idx}`).toContain(idx);
  });

  it('TC-DB-03: email không phân biệt chữ hoa (citext) — bệnh đăng nhập trượt của bản cũ', async () => {
    await resetTables();
    await makeUser({ email: 'Hoa.Pham@congty.vn' });
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [
      'hoa.pham@CONGTY.VN',
    ]);
    expect(rows).toHaveLength(1);
    // Và không cho tạo trùng chỉ vì khác chữ hoa.
    const err = await expectReject(
      `INSERT INTO users (code, full_name, email, password_hash)
       VALUES ('NV002','Trùng email','HOA.PHAM@congty.vn','x')`
    );
    expect(err.code).toBe('23505'); // unique_violation
  });

  it('TC-DB-04: users.role chỉ nhận đúng 6 vai trò, "Trợ lý admin" bị chặn', async () => {
    await resetTables();
    const err = await expectReject(
      `INSERT INTO users (code, full_name, email, password_hash, role)
       VALUES ('NV009','Trợ lý','tro.ly@congty.vn','x','Trợ lý admin')`
    );
    expect(err.code).toBe('23514'); // check_violation
    for (const role of [
      'admin',
      'Phó Giám đốc',
      'Trưởng phòng',
      'Phó phòng',
      'Quản lý dự án',
      'Nhân viên',
    ]) {
      await expect(
        makeUser({ code: `C-${role}`, email: `${encodeURIComponent(role)}@x.vn`, role })
      ).resolves.toBeTruthy();
    }
  });

  it('TC-DB-05: level chỉ nhận 2 hoặc 3 — không có cấp 1 hay cấp 4 trong work_items', async () => {
    await resetTables();
    const work = await makeWork();
    for (const level of [1, 4, 0]) {
      const err = await expectReject(
        `INSERT INTO work_items (code, work_id, level, name) VALUES ($1,$2,$3,'x')`,
        [`BAD-${level}`, work.id, level]
      );
      expect(err.code).toBe('23514');
    }
  });

  it('TC-DB-06: cấp 2 không được có cha (lvl2_no_parent)', async () => {
    await resetTables();
    const work = await makeWork();
    const parent = await makeItem({ work_id: work.id, level: 2, code: 'DA001-01' });
    const err = await expectReject(
      `INSERT INTO work_items (code, work_id, parent_id, level, name)
       VALUES ('DA001-02',$1,$2,2,'Việc con có cha')`,
      [work.id, parent.id]
    );
    expect(err.code).toBe('23514');
    expect(err.message).toContain('lvl2_no_parent');
  });

  it('TC-DB-07: không lấy nhiệm vụ cấp 3 làm cha (trigger)', async () => {
    await resetTables();
    const work = await makeWork();
    const lv2 = await makeItem({ work_id: work.id, level: 2, code: 'DA001-01' });
    const lv3 = await makeItem({ work_id: work.id, level: 3, parent_id: lv2.id, code: 'DA001-02' });
    const err = await expectReject(
      `INSERT INTO work_items (code, work_id, parent_id, level, name)
       VALUES ('DA001-03',$1,$2,3,'Cháu')`,
      [work.id, lv3.id]
    );
    expect(err.message).toContain('Cha phải là công việc con (cấp 2)');
  });

  it('TC-DB-08: cha và con phải cùng một công việc (trigger)', async () => {
    await resetTables();
    const workA = await makeWork({ code: 'DA001' });
    const workB = await makeWork({ code: 'DA002' });
    const lv2 = await makeItem({ work_id: workA.id, level: 2, code: 'DA001-01' });
    const err = await expectReject(
      `INSERT INTO work_items (code, work_id, parent_id, level, name)
       VALUES ('DA002-01',$1,$2,3,'Nhiệm vụ lạc công việc')`,
      [workB.id, lv2.id]
    );
    expect(err.message).toContain('cùng một công việc');
  });

  it('TC-DB-09: cấp 2 đang có con thì không chuyển sang công việc khác được (C5)', async () => {
    await resetTables();
    const workA = await makeWork({ code: 'DA001' });
    const workB = await makeWork({ code: 'DA002' });
    const lv2 = await makeItem({ work_id: workA.id, level: 2, code: 'DA001-01' });
    await makeItem({ work_id: workA.id, level: 3, parent_id: lv2.id, code: 'DA001-02' });

    const err = await expectReject('UPDATE work_items SET work_id = $1 WHERE id = $2', [
      workB.id,
      lv2.id,
    ]);
    expect(err.message).toContain('không thể chuyển hoặc đổi cấp');

    // Còn cấp 2 KHÔNG có con thì chuyển được bình thường.
    const rỗng = await makeItem({ work_id: workA.id, level: 2, code: 'DA001-09' });
    await expect(
      pool.query('UPDATE work_items SET work_id = $1 WHERE id = $2', [workB.id, rỗng.id])
    ).resolves.toBeTruthy();
  });

  it('TC-DB-10: xoá công việc xoá kèm cấp 2, cấp 3 và nhắc việc (CASCADE)', async () => {
    await resetTables();
    const work = await makeWork();
    const lv2 = await makeItem({ work_id: work.id, level: 2, code: 'DA001-01' });
    const lv3 = await makeItem({ work_id: work.id, level: 3, parent_id: lv2.id, code: 'DA001-02' });
    await pool.query(
      'INSERT INTO reminders (work_item_id, remind_date) VALUES ($1, CURRENT_DATE)',
      [lv3.id]
    );

    await pool.query('DELETE FROM works WHERE id = $1', [work.id]);
    const items = await pool.query('SELECT count(*)::int AS n FROM work_items');
    const rems = await pool.query('SELECT count(*)::int AS n FROM reminders');
    expect(items.rows[0].n).toBe(0);
    expect(rems.rows[0].n).toBe(0);
  });

  it('TC-DB-11: nhắc việc chỉ cho cấp 3, gọi trên cấp 2 báo lỗi rõ (C10 — bản cũ còn nợ)', async () => {
    await resetTables();
    const work = await makeWork();
    const lv2 = await makeItem({ work_id: work.id, level: 2, code: 'DA001-01' });
    const lv3 = await makeItem({ work_id: work.id, level: 3, parent_id: lv2.id, code: 'DA001-02' });

    const err = await expectReject(
      'INSERT INTO reminders (work_item_id, remind_date) VALUES ($1, CURRENT_DATE)',
      [lv2.id]
    );
    expect(err.message).toContain('Chỉ nhiệm vụ (cấp 3)');
    await expect(
      pool.query('INSERT INTO reminders (work_item_id, remind_date) VALUES ($1, CURRENT_DATE)', [
        lv3.id,
      ])
    ).resolves.toBeTruthy();
  });

  it('TC-DB-12: trạng thái duyệt chỉ nhận 3 giá trị, tiến độ chỉ 0–100', async () => {
    await resetTables();
    const work = await makeWork();
    let err = await expectReject('UPDATE works SET approval_status = $1 WHERE id = $2', [
      'Đang chờ',
      work.id,
    ]);
    expect(err.code).toBe('23514');

    const lv2 = await makeItem({ work_id: work.id, level: 2, code: 'DA001-01' });
    for (const bad of [-1, 101, 200]) {
      err = await expectReject('UPDATE work_items SET completion = $1 WHERE id = $2', [
        bad,
        lv2.id,
      ]);
      expect(err.code).toBe('23514');
    }
  });

  it('TC-DB-13: result_links buộc là mảng json, không nhận object hay chuỗi', async () => {
    await resetTables();
    const work = await makeWork();
    const lv2 = await makeItem({ work_id: work.id, level: 2, code: 'DA001-01' });
    for (const bad of ['{"a":1}', '"mot-chuoi"', '5']) {
      const err = await expectReject('UPDATE work_items SET result_links = $1 WHERE id = $2', [
        bad,
        lv2.id,
      ]);
      expect(err.code).toBe('23514');
    }
    await expect(
      pool.query('UPDATE work_items SET result_links = $1 WHERE id = $2', [
        JSON.stringify(['https://a.vn/1', 'https://a.vn/2']),
        lv2.id,
      ])
    ).resolves.toBeTruthy();
  });

  it('TC-DB-14: mã sinh bằng sequence — 500 lần gọi liên tiếp không trùng (thay mã theo millisecond)', async () => {
    await resetTables();
    const { rows } = await pool.query(
      `SELECT next_code('DA', 'seq_work_code') AS code FROM generate_series(1, 500)`
    );
    const codes = rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(500);
    expect(codes[0]).toBe('DA001');
    expect(codes[499]).toBe('DA500');
  });

  it('TC-DB-15: cột ngày trả về đúng chuỗi YYYY-MM-DD, không lệch một ngày vì múi giờ', async () => {
    await resetTables();
    const work = await makeWork({ start_date: '2025-12-31', end_date: '2026-01-01' });
    expect(work.start_date).toBe('2025-12-31');
    expect(work.end_date).toBe('2026-01-01');
    // Ngày 29/02 của năm nhuận cũng phải giữ nguyên.
    const nhuan = await makeWork({ code: 'DA002', start_date: '2024-02-29' });
    expect(nhuan.start_date).toBe('2024-02-29');
  });

  it('TC-DB-16: updated_at tự cập nhật khi sửa, created_at giữ nguyên', async () => {
    await resetTables();
    const work = await makeWork();
    await new Promise((r) => setTimeout(r, 20));
    const { rows } = await pool.query(
      `UPDATE works SET name = 'Đã đổi tên' WHERE id = $1 RETURNING created_at, updated_at`,
      [work.id]
    );
    expect(rows[0].created_at.getTime()).toBe(work.created_at.getTime());
    expect(rows[0].updated_at.getTime()).toBeGreaterThan(work.updated_at.getTime());
  });

  it('TC-DB-17: xoá phòng thì người dùng còn lại, department_id về NULL (không mất người)', async () => {
    await resetTables();
    const dept = await makeDepartment();
    const user = await makeUser({ department_id: dept.id });
    await pool.query('DELETE FROM departments WHERE id = $1', [dept.id]);
    const { rows } = await pool.query('SELECT department_id FROM users WHERE id = $1', [user.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].department_id).toBeNull();
  });

  it('TC-DB-18: một người phụ trách được nhiều phòng, nhưng không trùng vai trên cùng phòng', async () => {
    await resetTables();
    const ph01 = await makeDepartment({ code: 'PH01', name: 'Phòng 1' });
    const ph02 = await makeDepartment({ code: 'PH02', name: 'Phòng 2', sort_order: 2 });
    const pgd = await makeUser({ role: 'Phó Giám đốc' });
    const sql = `INSERT INTO department_managers (department_id, user_id, role)
                 VALUES ($1, $2, 'deputy_director')`;
    await pool.query(sql, [ph01.id, pgd.id]);
    await pool.query(sql, [ph02.id, pgd.id]);
    const err = await expectReject(sql, [ph01.id, pgd.id]);
    expect(err.code).toBe('23505');
  });
});

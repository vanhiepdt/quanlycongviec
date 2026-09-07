// Hai view "được phép đếm" của việc 5.4 (§7 Phase 5, TC-APR-06).
//
// Đây là tầng thấp nhất của phòng tuyến "Chờ duyệt không được vào bất kỳ con số nào": nếu view
// sai thì mọi thẻ số và biểu đồ đọc qua nó cũng sai theo, mà không truy vấn nào báo lỗi. Nên
// kiểm thẳng trên SQL, không qua HTTP: một dòng dữ liệu, một câu SELECT, một con số.
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { QUERIES } from '../../src/modules/stats/repo.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, makeItem, makeWork, pool, resetTables } from '../helpers/db.js';

let dept;

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
});

afterAll(async () => {
  await closePool();
});

const codesIn = async (view) => {
  const { rows } = await pool.query(`SELECT code FROM ${view} ORDER BY code`);
  return rows.map((r) => r.code);
};

const migration019 = readFileSync(
  new URL('../../src/db/migrations/019_refresh_countable_views.sql', import.meta.url),
  'utf8'
)
  .split('-- Up Migration')[1]
  .split('-- Down Migration')[0];

// Fixture tạo TRƯỚC giao dịch, mọi DDL và thay đổi trạng thái dùng cùng client;
// finally rollback cả khi assertion lỗi, không để view thiếu cột lọt sang file khác.
describe('019 sửa view cũ thiếu ty_le', () => {
  it.each(['Nháp', 'Chờ duyệt'])('giữ dữ liệu/tỷ lệ và lọc %s ở cả ba cấp', async (status) => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    const sub = await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    await makeItem({ code: 'CV001-002', work_id: work.id, parent_id: sub.id, level: 3 });
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('UPDATE work_items SET ty_le = 73 WHERE id = $1', [sub.id]);
      const snapshot = async () => ({
        works: (await db.query('SELECT * FROM works ORDER BY id')).rows,
        items: (await db.query('SELECT * FROM work_items ORDER BY id')).rows,
      });
      const before = await snapshot();
      const base = await db.query('SELECT * FROM work_items LIMIT 0');
      const columns = base.fields.filter((f) => f.name !== 'ty_le').map((f) => `i."${f.name}"`);
      await db.query('DROP VIEW v_countable_items');
      await db.query(`CREATE VIEW v_countable_items AS SELECT ${columns.join(', ')}
        FROM work_items i JOIN works w ON w.id = i.work_id
        LEFT JOIN work_items p ON p.id = i.parent_id
        WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
          AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
          AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'))`);
      await db.query('SAVEPOINT stale');
      await expect(db.query(`${QUERIES.items} LIMIT 0`)).rejects.toMatchObject({ code: '42703' });
      await db.query('ROLLBACK TO SAVEPOINT stale');
      await db.query(migration019);
      await db.query(migration019); // đã sửa rồi: chạy lại vẫn hợp lệ, không đụng dữ liệu
      expect(await snapshot()).toEqual(before);
      for (const [table, view] of [
        ['works', 'v_countable_works'],
        ['work_items', 'v_countable_items'],
      ]) {
        const original = await db.query(`SELECT * FROM ${table} LIMIT 0`);
        const repaired = await db.query(`SELECT * FROM ${view} LIMIT 0`);
        expect(repaired.fields.map((f) => f.name)).toEqual(original.fields.map((f) => f.name));
      }
      expect((await db.query(QUERIES.works)).rows).toHaveLength(1);
      const items = (await db.query(QUERIES.items)).rows;
      expect(items).toHaveLength(2);
      expect(items.find((i) => i.id === sub.id).ty_le).toBe(73);
      await db.query('UPDATE work_items SET approval_status = $1 WHERE level = 3', [status]);
      expect((await db.query(QUERIES.items)).rows).toHaveLength(1);
      await db.query("UPDATE work_items SET approval_status = 'Đã duyệt' WHERE level = 3");
      await db.query('UPDATE work_items SET approval_status = $1 WHERE id = $2', [status, sub.id]);
      expect((await db.query(QUERIES.items)).rows).toHaveLength(0);
      await db.query("UPDATE work_items SET approval_status = 'Đã duyệt'");
      await db.query('UPDATE works SET approval_status = $1', [status]);
      expect((await db.query(QUERIES.works)).rows).toHaveLength(0);
      expect((await db.query(QUERIES.items)).rows).toHaveLength(0);
    } finally {
      await db.query('ROLLBACK');
      db.release();
    }
    // Kiểm thêm rằng ROLLBACK trả lại view thật, không để lọt fixture cũ sang test sau.
    await expect(pool.query(`${QUERIES.items} LIMIT 0`)).resolves.toBeDefined();
  });
});

const setApproval = (table, id, status) =>
  pool.query(`UPDATE ${table} SET approval_status = $1 WHERE id = $2`, [status, id]);

describe('v_countable_works — công việc cấp 1 được phép đếm', () => {
  it('bỏ mục Chờ duyệt, giữ Đã duyệt và Từ chối', async () => {
    const ok = await makeWork({ code: 'CV001', name: 'Đã duyệt', department_id: dept.id });
    const cho = await makeWork({ code: 'CV002', name: 'Chờ duyệt', department_id: dept.id });
    const tuchoi = await makeWork({ code: 'CV003', name: 'Từ chối', department_id: dept.id });
    await setApproval('works', cho.id, 'Chờ duyệt');
    await setApproval('works', tuchoi.id, 'Từ chối');

    // `Từ chối` VẪN đếm: đó là quyết định đã có, khác hẳn "chưa ai xem".
    expect(await codesIn('v_countable_works')).toEqual(['CV001', 'CV003']);
    expect(ok.approval_status).toBe('Đã duyệt');
  });

  it('trả đủ cột như bảng gốc — truy vấn thống kê đổi sang view không phải sửa gì khác', async () => {
    await makeWork({ code: 'CV001', department_id: dept.id });
    const { fields } = await pool.query('SELECT * FROM v_countable_works');
    const { fields: base } = await pool.query('SELECT * FROM works');
    expect(fields.map((f) => f.name)).toEqual(base.map((f) => f.name));
  });
});

describe('v_countable_items — công việc con / nhiệm vụ được phép đếm', () => {
  it('bỏ chính dòng Chờ duyệt', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    await makeItem({ code: 'CV001-001', work_id: work.id, level: 2, name: 'Con đã duyệt' });
    const cho = await makeItem({
      code: 'CV001-002',
      work_id: work.id,
      level: 2,
      name: 'Con chờ duyệt',
    });
    await setApproval('work_items', cho.id, 'Chờ duyệt');

    expect(await codesIn('v_countable_items')).toEqual(['CV001-001']);
  });

  it('bỏ mọi dòng nằm DƯỚI một công việc cấp 1 đang Chờ duyệt, dù bản thân chúng Đã duyệt', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    const sub = await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    await makeItem({
      code: 'CV001-002',
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
      name: 'Nhiệm vụ',
    });
    await setApproval('works', work.id, 'Chờ duyệt');

    // Nhiệm vụ cấp 3 luôn 'Đã duyệt' (việc 5.1) nên nếu view chỉ soi cột của chính dòng thì
    // nhiệm vụ này lọt vào thẻ "Tổng nhiệm vụ" trong khi cả công việc chưa ai duyệt.
    expect(await codesIn('v_countable_items')).toEqual([]);
  });

  it('bỏ nhiệm vụ cấp 3 nằm dưới một công việc con đang Chờ duyệt', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    const sub = await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    const task = await makeItem({
      code: 'CV001-002',
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
    });
    await setApproval('work_items', sub.id, 'Chờ duyệt');

    expect(await codesIn('v_countable_items')).toEqual([]);
    expect(task.approval_status).toBe('Đã duyệt');
  });

  it('nhiệm vụ mồ côi (không cha) vẫn đếm khi công việc cấp 1 đã duyệt', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    await makeItem({ code: 'CV001-001', work_id: work.id, parent_id: null, level: 3 });
    expect(await codesIn('v_countable_items')).toEqual(['CV001-001']);
  });

  it('trả đủ cột của work_items, không kéo theo cột của bảng JOIN', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    const { fields } = await pool.query('SELECT * FROM v_countable_items');
    const { fields: base } = await pool.query('SELECT * FROM work_items');
    expect(fields.map((f) => f.name)).toEqual(base.map((f) => f.name));
  });
});

// ---------------------------------------------------------------------------------------------
// Bản NHÁP (012, Vòng 13) — cùng phòng tuyến với 'Chờ duyệt': hai view là chỗ DUY NHẤT phải sửa
// để nháp không lọt vào bất kỳ con số nào. Người dùng chốt: «lưu tức là lưu thôi chưa gửi đi
// duyệt, CHƯA ĐƯỢC TÍNH LÀ CÔNG VIỆC».
// ---------------------------------------------------------------------------------------------
describe('Bản Nháp bị loại khỏi cả hai view (012)', () => {
  it('công việc cấp 1 Nháp không vào v_countable_works', async () => {
    await makeWork({ code: 'CV001', department_id: dept.id });
    const nhap = await makeWork({ code: 'CV002', name: 'Bản nháp', department_id: dept.id });
    await setApproval('works', nhap.id, 'Nháp');

    expect(await codesIn('v_countable_works')).toEqual(['CV001']);
  });

  it('công việc con / nhiệm vụ Nháp không vào v_countable_items', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    const nhap = await makeItem({ code: 'CV001-002', work_id: work.id, level: 2 });
    await setApproval('work_items', nhap.id, 'Nháp');

    expect(await codesIn('v_countable_items')).toEqual(['CV001-001']);
  });

  it('MỌI dòng nằm dưới một cây Nháp đều bị loại, kể cả nhiệm vụ cấp 3 «Đã duyệt»', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    const sub = await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    const task = await makeItem({
      code: 'CV001-002',
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
    });
    await setApproval('works', work.id, 'Nháp');

    // Cấp 3 luôn 'Đã duyệt' (việc 5.1) nên nếu view chỉ soi cột của chính dòng thì thêm một nhiệm
    // vụ vào bản nháp là nó cộng ngay vào thẻ «Tổng nhiệm vụ» — đúng kiểu sót mà 004 sinh ra để chặn.
    expect(task.approval_status).toBe('Đã duyệt');
    expect(await codesIn('v_countable_items')).toEqual([]);
  });

  it('nhiệm vụ cấp 3 nằm dưới một công việc con Nháp cũng bị loại', async () => {
    const work = await makeWork({ code: 'CV001', department_id: dept.id });
    const sub = await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    await makeItem({ code: 'CV001-002', work_id: work.id, parent_id: sub.id, level: 3 });
    await setApproval('work_items', sub.id, 'Nháp');

    expect(await codesIn('v_countable_items')).toEqual([]);
  });
});

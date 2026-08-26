// Hai view "được phép đếm" của việc 5.4 (§7 Phase 5, TC-APR-06).
//
// Đây là tầng thấp nhất của phòng tuyến "Chờ duyệt không được vào bất kỳ con số nào": nếu view
// sai thì mọi thẻ số và biểu đồ đọc qua nó cũng sai theo, mà không truy vấn nào báo lỗi. Nên
// kiểm thẳng trên SQL, không qua HTTP: một dòng dữ liệu, một câu SELECT, một con số.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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

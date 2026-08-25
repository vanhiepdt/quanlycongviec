// Cây 3 tầng `GET /api/v1/works/tree` — TC-TREE-23/24/25 (§7 việc 3.6, mục C2).
//
// Đi qua HTTP thật để bắt luôn cái bẫy thứ tự route: `/tree` phải khai báo trước `/:id`.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { UNASSIGNED_SUBWORK_LABEL } from '../../src/modules/works/tree.js';
import * as worksRepo from '../../src/modules/works/repo.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let api;
let dept;
let admin;
let work;

const makeWork = (over = {}) =>
  worksRepo.insert({
    name: 'Công việc gốc',
    department_id: dept.id,
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    ...over,
  });

/** Tạo một dòng cấp 2/cấp 3 qua API và trả thẳng dòng vừa tạo. */
const add = async (body) => {
  const res = await api.post('/api/v1/work-items', { workRef: work.code, ...body });
  expect(res.status).toBe(200);
  return res.body.data.item;
};

const getTree = (query = '') => api.get(`/api/v1/works/tree${query}`);

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  api = client(app);
  await api.login(admin.email);
  work = await makeWork();
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/v1/works/tree — ba tầng lồng sẵn', () => {
  it('TC-TREE-23: lồng đúng 3 tầng, đúng thứ tự sort_order', async () => {
    const subB = await add({ level: 2, name: 'Công việc con B' });
    const subA = await add({ level: 2, name: 'Công việc con A' });
    // Đặt lại thứ tự để chắc rằng cây đi theo sort_order chứ theo thứ tự tạo.
    await api.post(`/api/v1/works/${work.code}/reorder`, { order: [subA.code, subB.code] });
    const a2 = await add({ level: 3, name: 'Nhiệm vụ A2', parentRef: subA.code });
    const a1 = await add({ level: 3, name: 'Nhiệm vụ A1', parentRef: subA.code });
    await pool.query(`UPDATE work_items SET sort_order = 1 WHERE code = $1`, [a1.code]);
    await pool.query(`UPDATE work_items SET sort_order = 2 WHERE code = $1`, [a2.code]);

    const res = await getTree();
    expect(res.status).toBe(200);
    expect(res.body.data.works).toHaveLength(1);
    const tree = res.body.data.works[0];
    expect(tree.code).toBe(work.code);
    expect(tree.subWorks.map((s) => s.name)).toEqual(['Công việc con A', 'Công việc con B']);
    expect(tree.subWorks[0].tasks.map((t) => t.name)).toEqual(['Nhiệm vụ A1', 'Nhiệm vụ A2']);
    expect(tree.subWorks[1].tasks).toEqual([]);
    expect(res.body.data.totals).toEqual({
      works: 1,
      subWorks: 2,
      tasks: 2,
      unassignedTasks: 0,
    });
  });

  it('TC-TREE-24: nhiệm vụ mồ côi vào nhóm (chưa gán công việc con), KHÔNG bị mất', async () => {
    const sub = await add({ level: 2, name: 'Công việc con A' });
    await add({ level: 3, name: 'Nhiệm vụ có cha', parentRef: sub.code });
    const lost = await add({ level: 3, name: 'Nhiệm vụ mồ côi' });

    const tree = (await getTree()).body.data.works[0];
    const group = tree.subWorks.at(-1);
    expect(group.name).toBe(UNASSIGNED_SUBWORK_LABEL);
    expect(group.virtual).toBe(true);
    expect(group.id).toBeNull();
    expect(group.code).toBeNull();
    expect(group.tasks.map((t) => t.code)).toEqual([lost.code]);
    // Nhóm ảo xếp CUỐI và không được tính là một công việc con thật.
    expect(tree.subWorks[0].name).toBe('Công việc con A');
    expect((await getTree()).body.data.totals).toEqual({
      works: 1,
      subWorks: 1,
      tasks: 2,
      unassignedTasks: 1,
    });
  });

  it('nhiệm vụ mất cha (cha bị xoá) cũng vào nhóm chung chứ không rơi khỏi cây', async () => {
    const sub = await add({ level: 2, name: 'Công việc con A' });
    const task = await add({ level: 3, name: 'Nhiệm vụ A1', parentRef: sub.code });
    // Gỡ cha bằng tay: đây là dữ liệu bản cũ có thật, và `getWorkTree` cũ đánh rơi hẳn dòng này.
    await pool.query(`UPDATE work_items SET parent_id = NULL WHERE code = $1`, [task.code]);

    const tree = (await getTree()).body.data.works[0];
    expect(tree.subWorks.at(-1).tasks.map((t) => t.code)).toEqual([task.code]);
  });

  it('TC-TREE-11: dữ liệu trỏ VÒNG không treo, và hai dòng trong vòng vẫn hiện ở nhóm chung', async () => {
    const sub = await add({ level: 2, name: 'Công việc con lành' });
    const good = await add({ level: 3, name: 'Nhiệm vụ lành', parentRef: sub.code });
    const a = await add({ level: 3, name: 'Vòng A' });
    const b = await add({ level: 3, name: 'Vòng B' });
    // Trigger không cho tạo vòng; tắt tạm để dựng đúng dữ liệu bẩn bản cũ có thể để lại.
    await pool.query('ALTER TABLE work_items DISABLE TRIGGER trg_work_items_check_parent');
    await pool.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [a.id, b.id]);
    await pool.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [b.id, a.id]);
    await pool.query('ALTER TABLE work_items ENABLE TRIGGER trg_work_items_check_parent');

    const started = Date.now();
    const res = await getTree();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(res.status).toBe(200);

    const tree = res.body.data.works[0];
    // Nhánh lành không bị ảnh hưởng.
    expect(tree.subWorks[0].tasks.map((t) => t.code)).toEqual([good.code]);
    // Hai dòng trong vòng không có cha dùng được ⇒ vào nhóm chung, mỗi dòng ĐÚNG một lần.
    const group = tree.subWorks.at(-1);
    expect(group.name).toBe(UNASSIGNED_SUBWORK_LABEL);
    expect(group.tasks.map((t) => t.code).sort()).toEqual([a.code, b.code].sort());
    expect(res.body.data.totals).toEqual({
      works: 1,
      subWorks: 1,
      tasks: 3,
      unassignedTasks: 2,
    });
  });

  it('TC-TREE-25: công việc chưa có dòng con ⇒ subWorks rỗng, không lỗi', async () => {
    const res = await getTree();
    expect(res.status).toBe(200);
    expect(res.body.data.works[0].subWorks).toEqual([]);
    expect(res.body.data.totals).toEqual({ works: 1, subWorks: 0, tasks: 0, unassignedTasks: 0 });
  });

  it('không có công việc nào ⇒ mảng rỗng và totals bằng 0', async () => {
    await pool.query('DELETE FROM works');
    const res = await getTree();
    expect(res.status).toBe(200);
    expect(res.body.data.works).toEqual([]);
    expect(res.body.data.totals).toEqual({ works: 0, subWorks: 0, tasks: 0, unassignedTasks: 0 });
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const guest = client(app);
    expect((await guest.get('/api/v1/works/tree')).status).toBe(401);
  });
});

describe('GET /api/v1/works/tree — bộ lọc và phạm vi', () => {
  it('lọc theo phòng chỉ trả cây của phòng đó, kèm cả dòng con', async () => {
    await add({ level: 2, name: 'Công việc con của phòng 1' });
    const dept2 = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });
    await makeWork({ name: 'Công việc phòng 2', department_id: dept2.id });

    const res = await getTree(`?departmentId=${dept.id}`);
    expect(res.body.data.works.map((w) => w.code)).toEqual([work.code]);
    expect(res.body.data.works[0].subWorks).toHaveLength(1);
  });

  it('lọc theo tháng dùng GIAO NHAU khoảng ngày, việc kéo dài hiện ở mọi tháng nó chạm', async () => {
    await makeWork({ name: 'Việc tháng 12', start_date: '2026-12-01', end_date: '2026-12-31' });
    const res = await getTree('?month=2026-09');
    expect(res.body.data.works.map((w) => w.name)).toEqual(['Công việc gốc']);
  });

  it('nhân viên phòng khác không thấy cây của phòng này (§6)', async () => {
    await add({ level: 2, name: 'Công việc con A' });
    const dept2 = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });
    const outsider = await makeLoginUser({
      code: 'NV002',
      email: 'nv2@congty.vn',
      role: 'Nhân viên',
      department_id: dept2.id,
    });
    const other = client(app);
    await other.login(outsider.email);

    const res = await other.get('/api/v1/works/tree');
    expect(res.status).toBe(200);
    expect(res.body.data.works).toEqual([]);
    expect(res.body.data.totals.subWorks).toBe(0);
  });

  it('tháng sai dạng ⇒ 400, không trả cây nửa vời', async () => {
    const res = await getTree('?month=09-2026');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

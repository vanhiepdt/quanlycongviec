// Nhật ký gom cả cây — TC-NKCAY-01..08 (docs/KE-HOACH-NHAT-KY.md).
//
// Yêu cầu người dùng: mỗi lần chỉnh sửa của cả ba cấp đều vào nhật ký, và công việc CHA hiện tất cả
// nhật ký của công việc con và nhiệm vụ dưới nó. Ở đây kiểm phần máy chủ: `?scope=tree` gom đúng
// cây, `scope` mặc định KHÔNG đổi hành vi cũ, và quyền đọc không nới ra theo `scope`.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let dept;
let admin;
let staff;

async function loginAs(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

/**
 * Chờ nhật ký ghi xong rồi trả về thân trả lời. Audit chạy ở `res.on('finish')`, tức là SAU khi
 * supertest đã trả về — hỏi ngay là thiếu dòng cuối một cách ngẫu nhiên.
 */
async function nhatKy(api, url, soDongToiThieu = 1, tries = 40) {
  let body = null;
  for (let i = 0; i < tries; i++) {
    const res = await api.get(url);
    body = res.body?.data ?? null;
    if ((body?.entries?.length ?? 0) >= soDongToiThieu) return body;
    await new Promise((r) => setTimeout(r, 25));
  }
  return body;
}

/** Một cây đủ ba cấp, mỗi cấp đã bị sửa một lần ⇒ 6 dòng nhật ký. */
async function dungCayBaCap(api) {
  const work = (await api.post('/api/v1/works', { name: 'Công việc gốc', departmentId: dept.id }))
    .body.data.work;
  const subwork = (
    await api.post('/api/v1/work-items', {
      workRef: work.code,
      level: 2,
      name: 'Công việc con A',
    })
  ).body.data.item;
  const task = (
    await api.post('/api/v1/work-items', {
      workRef: work.code,
      parentRef: subwork.code,
      level: 3,
      name: 'Nhiệm vụ B',
    })
  ).body.data.item;

  await api.patch(`/api/v1/works/${work.code}`, { name: 'Công việc gốc (đã đổi tên)' });
  await api.patch(`/api/v1/work-items/${subwork.code}`, { status: 'Đang thực hiện' });
  await api.patch(`/api/v1/work-items/${task.code}`, { completion: 40 });

  return { work, subwork, task };
}

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  staff = await makeLoginUser({
    code: 'NV003',
    email: 'nhanvien@congty.vn',
    full_name: 'Lê Văn Nhân',
    role: 'Nhân viên',
    department_id: dept.id,
  });
});

afterAll(async () => {
  await closePool();
});

describe('TC-NKCAY-01..08 — nhật ký cả cây', () => {
  it('TC-NKCAY-01: công việc cha với scope=tree gom nhật ký của cả 3 cấp', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCayBaCap(api);

    const data = await nhatKy(api, `/api/v1/works/${work.code}/history?scope=tree`, 6);
    expect(data.scope).toBe('tree');
    // Thứ tự CŨ TRƯỚC: người đọc lần lại diễn biến từ lúc lập.
    expect(data.entries.map((e) => e.action)).toEqual([
      'works.create',
      'subworks.create',
      'tasks.create',
      'works.update',
      'subworks.update',
      'tasks.update',
    ]);
  });

  it('TC-NKCAY-02: mỗi dòng gom về có nhãn đầu việc (cấp, mã, tên)', async () => {
    const api = await loginAs(admin);
    const { work, subwork, task } = await dungCayBaCap(api);

    const data = await nhatKy(api, `/api/v1/works/${work.code}/history?scope=tree`, 6);
    const theoMa = new Map(data.entries.map((e) => [e.action, e.ref]));
    expect(theoMa.get('works.update')).toMatchObject({ level: 1, code: work.code, deleted: false });
    expect(theoMa.get('subworks.update')).toMatchObject({
      level: 2,
      code: subwork.code,
      name: 'Công việc con A',
    });
    expect(theoMa.get('tasks.update')).toMatchObject({
      level: 3,
      code: task.code,
      name: 'Nhiệm vụ B',
    });
  });

  it('TC-NKCAY-03: từng lần chỉnh sửa ghi rõ cột nào from→to ở cả 3 cấp', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCayBaCap(api);

    const data = await nhatKy(api, `/api/v1/works/${work.code}/history?scope=tree`, 6);
    const doi = (action) => data.entries.find((e) => e.action === action).details.changes;
    expect(doi('works.update').name.to).toBe('Công việc gốc (đã đổi tên)');
    expect(doi('subworks.update').status).toEqual({ from: 'Chưa bắt đầu', to: 'Đang thực hiện' });
    expect(doi('tasks.update').completion.to).toBe(40);
  });

  it('TC-NKCAY-04: không có scope thì vẫn CHỈ nhật ký của chính công việc (không đổi API cũ)', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCayBaCap(api);
    await nhatKy(api, `/api/v1/works/${work.code}/history?scope=tree`, 6);

    const data = await nhatKy(api, `/api/v1/works/${work.code}/history`, 2);
    expect(data.scope).toBe('self');
    expect(data.entries.map((e) => e.action)).toEqual(['works.create', 'works.update']);
    expect(data.work.code).toBe(work.code);
    expect(data.originInfo).toBeTruthy();
  });

  it('TC-NKCAY-05: công việc con với scope=tree gom thêm nhiệm vụ con của nó', async () => {
    const api = await loginAs(admin);
    const { subwork, task } = await dungCayBaCap(api);

    const data = await nhatKy(api, `/api/v1/work-items/${subwork.code}/history?scope=tree`, 4);
    expect(data.scope).toBe('tree');
    expect(data.entries.map((e) => e.action)).toEqual([
      'subworks.create',
      'tasks.create',
      'subworks.update',
      'tasks.update',
    ]);
    expect(data.entries.at(-1).ref.code).toBe(task.code);
    expect(data.item.code).toBe(subwork.code);
  });

  it('TC-NKCAY-06: nhiệm vụ cấp 3 không có cây con ⇒ scope=tree trả về đúng phần của nó', async () => {
    const api = await loginAs(admin);
    const { task } = await dungCayBaCap(api);

    const data = await nhatKy(api, `/api/v1/work-items/${task.code}/history?scope=tree`, 2);
    expect(data.scope).toBe('self');
    expect(data.entries.map((e) => e.action)).toEqual(['tasks.create', 'tasks.update']);
    expect(data.entries.every((e) => e.ref.code === task.code)).toBe(true);
  });

  it('TC-NKCAY-07: xoá nhiệm vụ vẫn hiện trong nhật ký của công việc cha', async () => {
    const api = await loginAs(admin);
    const { work, task } = await dungCayBaCap(api);
    await nhatKy(api, `/api/v1/works/${work.code}/history?scope=tree`, 6);
    await api.del(`/api/v1/work-items/${task.code}`);

    const data = await nhatKy(api, `/api/v1/works/${work.code}/history?scope=tree`, 7);
    const xoa = data.entries.find((e) => e.action === 'workItems.remove');
    expect(xoa).toBeTruthy();
    // Bản trước ghi cứng entity_type='task' và bỏ trống entityId/workId ⇒ dòng này biến mất khỏi
    // nhật ký của cha. Ba khoá dưới đây là thứ giữ nó lại.
    expect(xoa.entity_type).toBe('task');
    expect(xoa.entity_id).toBe(task.id);
    expect(xoa.work_id).toBe(work.id);
    expect(xoa.ref).toMatchObject({ level: 3, code: task.code, name: 'Nhiệm vụ B', deleted: true });
  });

  it('TC-NKCAY-08: không đọc được công việc thì scope=tree cũng không đọc được', async () => {
    const adminApi = await loginAs(admin);
    const other = await makeDepartment({ code: 'PH02', name: 'Phòng Kinh doanh' });
    const work = (
      await adminApi.post('/api/v1/works', { name: 'Việc phòng khác', departmentId: other.id })
    ).body.data.work;

    const staffApi = await loginAs(staff);
    const res = await staffApi.get(`/api/v1/works/${work.code}/history?scope=tree`);
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });
});

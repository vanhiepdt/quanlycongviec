// Phase8b A/B/C: phiên đang mở, ba trạng thái và phòng kế thừa. Chỉ dùng TEST_DATABASE_URL.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import * as permissionRepo from '../../src/modules/permissions/repo.js';
import { makeDepartment, makeWork, makeItem, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';
const app = createApp();
let adminApi, admin, department, other, work, foreign;
const roles = ['Trưởng phòng', 'Phó phòng', 'Nhân viên'];
const entities = ['work', 'subwork', 'task'];
const urlOf = (entity, row) => '/api/v1/' + (entity === 'work' ? 'works/' : 'work-items/') + row.id;
async function actor(role, dept = department.id) {
  const user = await makeLoginUser({
    code: 'NV002',
    email: 'actor@test.local',
    role,
    department_id: dept,
  });
  const api = client(app);
  expect((await api.login(user.email)).status).toBe(200);
  return { api, user };
}
async function setPermission(role, entityType, action, giaTri, phamVi = 'phong') {
  const res = await adminApi.put('/api/v1/permissions', {
    thayDoi: [{ vai: role, entityType, action, giaTri, phamVi }],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res;
}
function createEntity(api, user, entity, target = work) {
  if (entity === 'work')
    return api.post('/api/v1/works', { name: 'Việc mới', departmentId: target.department_id });
  return api.post('/api/v1/work-items', {
    name: 'Đầu việc',
    workRef: target.code,
    level: entity === 'task' ? 3 : 2,
    assigneeId: user.id,
    departmentId: other.id,
  });
}
beforeEach(async () => {
  await resetTables();
  department = await makeDepartment();
  other = await makeDepartment({ code: 'PH02', name: 'Phòng khác' });
  work = await makeWork({ code: 'DA001', department_id: department.id });
  foreign = await makeWork({ code: 'DA002', department_id: other.id });
  admin = await makeLoginUser({ role: 'admin', email: 'admin@test.local' });
  adminApi = client(app);
  expect((await adminApi.login(admin.email)).status).toBe(200);
  // 2026-09-09 — Trưởng/Phó phòng được nhận việc trực tiếp, nhưng CHỈ khi phòng có Phó Giám đốc
  // phụ trách để duyệt kết quả của họ (`ASSIGNEE_LEADER_NO_DEPUTY`). Bộ test này để diễn viên TỰ
  // gán việc cho chính mình (`createEntity` gửi `assigneeId: user.id`), nên phòng phải có Phó GĐ;
  // thiếu dòng này thì mọi ca `task` của hai vai lãnh đạo chết trước khi tới luật phân quyền cần đo.
  const pgd = await makeLoginUser({
    code: 'NV003',
    email: 'pgd@test.local',
    full_name: 'Phó Giám đốc phụ trách',
    role: 'Phó Giám đốc',
    department_id: department.id,
  });
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role) VALUES ($1, $2, 'deputy_director')`,
    [department.id, pgd.id]
  );
});
afterEach(() => vi.restoreAllMocks());
afterAll(closePool);

describe.each(roles)('cùng phiên %s', (role) => {
  it.each(entities)('%s:create ✓ → ✕ → ⏳ → ✓, không cần đăng nhập lại', async (entity) => {
    const { api, user } = await actor(role);
    for (const state of ['cho-phep', 'tu-choi', 'cho-duyet', 'cho-phep']) {
      await setPermission(role, entity, 'create', state);
      const before = await pool.query(
        'SELECT (SELECT count(*) FROM works) + (SELECT count(*) FROM work_items) AS n'
      );
      const res = await createEntity(api, user, entity);
      expect(res.status, JSON.stringify(res.body)).toBe(state === 'tu-choi' ? 403 : 200);
      if (state === 'tu-choi') {
        expect(
          (
            await pool.query(
              'SELECT (SELECT count(*) FROM works) + (SELECT count(*) FROM work_items) AS n'
            )
          ).rows
        ).toEqual(before.rows);
      } else {
        expect(res.body.data[entity === 'work' ? 'work' : 'item']).toMatchObject({
          department_id: department.id,
          approval_status: state === 'cho-duyet' ? 'Chờ duyệt' : 'Đã duyệt',
        });
      }
    }
  });
  it.each(entities)(
    '%s:create cùng phòng, khác phòng, chưa phòng; tat-ca không mở phòng tạo',
    async (entity) => {
      const { api, user } = await actor(role);
      await setPermission(
        role,
        entity,
        'create',
        'cho-phep',
        role === 'Nhân viên' ? 'phong' : 'tat-ca'
      );
      expect((await createEntity(api, user, entity)).status).toBe(200);
      expect((await createEntity(api, user, entity, foreign)).status).toBe(403);
      await pool.query('UPDATE users SET department_id = NULL WHERE id = $1', [user.id]);
      const res = await createEntity(api, user, entity);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('chưa có phòng');
    }
  );
  it('task:update/delete/read/approve và ty-le nhận quyền mới ở request kế tiếp', async () => {
    const { api, user } = await actor(role);
    const made = await createEntity(api, user, 'task');
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const row = made.body.data.item,
      url = urlOf('task', row);
    await setPermission(role, 'task', 'update', 'cho-duyet');
    expect((await api.patch(url, { name: 'Cần duyệt lại' })).body.data.item.approval_status).toBe(
      'Chờ duyệt'
    );
    await setPermission(role, 'task', 'approve', 'cho-phep');
    expect((await api.post('/api/v1/approvals/item/' + row.id + '/approve')).status).toBe(200);
    for (const action of ['read', 'update', 'delete', 'approve', 'ty-le']) {
      if (action === 'approve') {
        await setPermission(role, 'task', 'update', 'cho-duyet');
        expect(
          (await api.patch(url, { name: 'Đưa lại vào chờ duyệt' })).body.data.item.approval_status
        ).toBe('Chờ duyệt');
      }
      await setPermission(role, 'task', action, 'tu-choi');
      const res =
        action === 'read'
          ? await api.get(url)
          : action === 'delete'
            ? await api.del(url)
            : action === 'approve'
              ? await api.post('/api/v1/approvals/item/' + row.id + '/approve')
              : await api.patch(
                  url,
                  action === 'ty-le' ? { tyLe: 70 } : { name: 'Không được lưu' }
                );
      expect(res.status, JSON.stringify(res.body)).toBe(403);
      await setPermission(role, 'task', action, 'cho-phep');
    }
    await setPermission(role, 'task', 'delete', 'cho-duyet');
    const denied = await api.del(url);
    expect(denied.status).toBe(403);
    expect(denied.body.error.message).toContain('Xin xoá');
    await setPermission(role, 'task', 'delete', 'cho-phep');
    expect((await api.del(url)).status).toBe(200);
  });
});

it('lưu bảng quyền lỗi ở dòng thứ hai phải rollback cả dòng đầu', async () => {
  await setPermission('Phó phòng', 'task', 'create', 'tu-choi');
  const before = (await permissionRepo.listAll()).map((r) => ({ ...r }));
  const real = permissionRepo.upsert;
  vi.spyOn(permissionRepo, 'upsert')
    .mockImplementationOnce((...args) => real(...args))
    .mockRejectedValueOnce(new Error('lỗi test'));
  const res = await adminApi.put('/api/v1/permissions', {
    thayDoi: [
      { vai: 'Phó phòng', entityType: 'task', action: 'create', giaTri: 'cho-phep' },
      { vai: 'Phó phòng', entityType: 'task', action: 'update', giaTri: 'tu-choi' },
    ],
  });
  expect(res.status).toBe(500);
  expect(await permissionRepo.listAll()).toEqual(before);
});
it('không đọc được ghi đè thì chặn ghi, không fallback quyền gốc', async () => {
  const { api, user } = await actor('Phó phòng');
  const token = await api.csrfToken();
  vi.spyOn(permissionRepo, 'listByVai').mockRejectedValue(new Error('lỗi test'));
  const res = await api.post(
    '/api/v1/work-items',
    { workRef: work.code, name: 'Không ghi', assigneeId: user.id },
    { csrf: token }
  );
  expect(res.status).toBe(500);
  expect((await pool.query('SELECT count(*)::int AS n FROM work_items')).rows[0].n).toBe(0);
});
it('REST và RPC không thể chuyển cây sang phòng ngoài phạm vi', async () => {
  const { api, user } = await actor('Phó phòng');
  await setPermission(user.role, 'subwork', 'create', 'cho-phep', 'tat-ca');
  await setPermission(user.role, 'subwork', 'update', 'cho-phep', 'tat-ca');
  const sub = (await createEntity(api, user, 'subwork')).body.data.item;
  const child = await makeItem({ code: 'DA001-99', work_id: work.id, parent_id: sub.id, level: 3 });
  const before = (await pool.query('SELECT * FROM work_items ORDER BY id')).rows;
  expect((await api.patch(urlOf('subwork', sub), { workRef: foreign.code })).status).toBe(403);
  const rpc = await api.post('/api/rpc/updateTaskWithAuth', {
    args: [sub.code, { projectId: foreign.code, name: 'Sai phòng' }],
  });
  expect(rpc.status, JSON.stringify(rpc.body)).toBe(403);
  expect((await pool.query('SELECT * FROM work_items ORDER BY id')).rows).toEqual(before);
  expect(child.department_id).toBe(department.id);
});
it('Cán bộ không tự đổi người phụ trách hoặc đổi cha; sửa nội dung vẫn được', async () => {
  const { api, user } = await actor('Nhân viên');
  const sub = await makeItem({ work_id: work.id, level: 2 });
  const made = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Được giao',
    supervisorIds: [admin.id],
    assigneeId: user.id,
  });
  const row = made.body.data.item;
  // ĐỢT B (Q3): nhiệm vụ cấp 3 mới tạo là «Chờ duyệt», mà việc 5.6 khoá mục đang chờ duyệt cho
  // đúng NGƯỜI LẬP (ở ca này là admin) — nên phải ký nó trước, nếu không mọi lượt sửa của Cán bộ
  // đều 403 vì lý do khác và ca này không còn kiểm đúng điều nó muốn kiểm.
  const ky = await adminApi.post(`/api/v1/approvals/work-item/${row.code}/approve`);
  expect(ky.status, JSON.stringify(ky.body)).toBe(200);
  // Đợt A (028): ô này là MẢNG. Gửi khoá đơn `supervisorId` giờ bị schema bỏ qua như mọi khoá lạ,
  // nên muốn thật sự «đổi người phụ trách» thì phải gửi `supervisorIds` — kể cả khi đổi thành rỗng.
  expect((await api.patch(urlOf('task', row), { supervisorIds: [] })).status).toBe(403);
  expect(
    (await api.patch(urlOf('task', row), { parentRef: sub.code, supervisorIds: [] })).status
  ).toBe(403);
  expect((await api.patch(urlOf('task', row), { name: 'Nội dung cập nhật' })).status).toBe(200);
  const saved = (await adminApi.get(urlOf('task', row))).body.data;
  expect(saved.supervisor_ids ?? saved.item?.supervisor_ids).toEqual([admin.id]);
});

describe.each(['Trưởng phòng', 'Phó phòng'])('%s cập nhật từng cấp', (role) => {
  it.each(['work', 'subwork'])(
    '%s: ✓ sửa ngay, ⏳ duyệt lại, ✕ giữ nguyên; read/delete cũng nhận quyền mới',
    async (entity) => {
      const { api, user } = await actor(role);
      await setPermission(role, entity, 'create', 'cho-phep');
      const made = await createEntity(api, user, entity);
      expect(made.status).toBe(200);
      const row = made.body.data[entity === 'work' ? 'work' : 'item'],
        url = urlOf(entity, row);
      for (const state of ['cho-phep', 'cho-duyet', 'tu-choi']) {
        await setPermission(role, entity, 'update', state);
        const before = (await adminApi.get(url)).body.data;
        const res = await api.patch(url, { name: 'Tên sau ' + state });
        expect(res.status).toBe(state === 'tu-choi' ? 403 : 200);
        if (state === 'tu-choi') expect((await adminApi.get(url)).body.data).toEqual(before);
        else
          expect(res.body.data[entity === 'work' ? 'work' : 'item'].approval_status).toBe(
            state === 'cho-duyet' ? 'Chờ duyệt' : 'Đã duyệt'
          );
      }
      await setPermission(role, entity, 'read', 'tu-choi');
      expect((await api.get(url)).status).toBe(403);
      await setPermission(role, entity, 'read', 'cho-phep');
      expect((await api.get(url)).status).toBe(200);
      await setPermission(role, entity, 'delete', 'cho-duyet');
      expect((await api.del(url)).body.error.message).toContain('Xin xoá');
      const approvalUrl = '/api/v1/approvals/' + (entity === 'work' ? 'work/' : 'item/') + row.id;
      expect(
        (await api.post(approvalUrl + '/request-delete', { reason: 'Xin xóa đầu việc thử nghiệm' }))
          .status
      ).toBe(200);
      expect((await adminApi.get(url)).status).toBe(200);
    }
  );
});
it.each(roles)(
  'RPC tạo ba cấp của %s cũng bó theo phòng, bất kể payload phòng khác',
  async (role) => {
    const { api, user } = await actor(role);
    await pool.query('UPDATE users SET full_name = $1 WHERE id = $2', ['Người tạo RPC', user.id]);
    for (const entity of entities) {
      await setPermission(role, entity, 'create', 'cho-phep');
      const fn = entity === 'work' ? 'addProjectWithAuth' : 'addTaskWithAuth';
      const body = (target) =>
        entity === 'work'
          ? { name: 'Công việc RPC', departmentId: target.department_id }
          : {
              name: 'Nhiệm vụ RPC',
              projectId: target.code,
              level: entity === 'task' ? 3 : 2,
              assignee: 'Người tạo RPC',
              departmentId: other.id,
            };
      const good = await api.post('/api/rpc/' + fn, { args: [body(work)] });
      expect(good.status, JSON.stringify(good.body)).toBe(200);
      const denied = await api.post('/api/rpc/' + fn, { args: [body(foreign)] });
      expect(denied.status, JSON.stringify(denied.body)).toBe(403);
    }
  }
);
it('sao chép cấp1/cấp2 không lách quyền tạo nhiệm vụ bị thu hồi; rollback cả cây', async () => {
  const { api, user } = await actor('Phó phòng');
  const sub = await makeItem({ work_id: work.id, level: 2 });
  await makeItem({ code: 'DA001-02', work_id: work.id, parent_id: sub.id, level: 3 });
  await setPermission(user.role, 'task', 'create', 'tu-choi');
  const before = (
    await pool.query('SELECT (SELECT count(*) FROM works) + (SELECT count(*) FROM work_items) AS n')
  ).rows;
  for (const url of [urlOf('work', work), urlOf('subwork', sub)]) {
    expect((await api.post(url + '/copy')).status).toBe(403);
    expect(
      (
        await pool.query(
          'SELECT (SELECT count(*) FROM works) + (SELECT count(*) FROM work_items) AS n'
        )
      ).rows
    ).toEqual(before);
  }
});

it.each(['Trưởng phòng', 'Phó phòng'])(
  '%s sửa nội dung Nháp/Từ chối không tự gửi duyệt',
  async (role) => {
    const { api, user } = await actor(role);
    const made = await createEntity(api, user, 'subwork');
    const row = made.body.data.item;
    for (const state of ['Nháp', 'Từ chối']) {
      await pool.query('UPDATE work_items SET approval_status = $1 WHERE id = $2', [state, row.id]);
      const res = await api.patch(urlOf('subwork', row), { name: 'Chỉ lưu nội dung' });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.item.approval_status).toBe(state);
      expect(
        (await pool.query('SELECT approval_status FROM work_items WHERE id = $1', [row.id])).rows[0]
          .approval_status
      ).toBe(state);
    }
  }
);
it('Cán bộ chỉ sao chép nhiệm vụ cho mình, kể cả khi đã được giao việc khác trong cùng cây', async () => {
  const { api, user } = await actor('Nhân viên');
  const own = (await createEntity(api, user, 'task')).body.data.item;
  const otherTask = (
    await adminApi.post('/api/v1/work-items', {
      workRef: work.code,
      name: 'Giao người khác',
      assigneeId: admin.id,
    })
  ).body.data.item;
  const before = (await pool.query('SELECT * FROM work_items ORDER BY id')).rows;
  expect((await api.post(urlOf('task', otherTask) + '/copy')).status).toBe(403);
  expect((await pool.query('SELECT * FROM work_items ORDER BY id')).rows).toEqual(before);
  expect((await api.post(urlOf('task', own) + '/copy')).status).toBe(200);
});
it('RPC sửa nhiệm vụ trực tiếp: thiếu supervisor giữ nguyên, chuỗi rỗng bỏ chọn, mở lại vẫn trống', async () => {
  const made = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Có lãnh đạo',
    assigneeId: admin.id,
    supervisorIds: [admin.id],
  });
  const task = made.body.data.item;
  // Khoá đơn `supervisorId` của client CŨ vẫn phải được nhận (chống mất dữ liệu lúc chưa kịp tải
  // bản mới), và chuỗi rỗng vẫn nghĩa là «bỏ chọn» — nay là mảng rỗng.
  for (const [patch, expected] of [
    [{ name: 'Giữ người phụ trách' }, [admin.id]],
    [{ supervisorId: '' }, []],
  ]) {
    const res = await adminApi.post('/api/rpc/updateTaskWithAuth', { args: [task.code, patch] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(
      (await pool.query('SELECT supervisor_ids FROM work_items WHERE id = $1', [task.id])).rows[0]
        .supervisor_ids
    ).toEqual(expected);
  }
  const copy = await adminApi.post(urlOf('task', task) + '/copy');
  expect(copy.status).toBe(200);
  expect(copy.body.data.item.supervisor_ids).toEqual([]);
});

it('đổi phòng cấp1 kiểm lãnh đạo của cả cây, bị từ chối giữ nguyên cha/con/cháu', async () => {
  const { user } = await actor('Phó phòng');
  await pool.query(
    "INSERT INTO department_managers (department_id, user_id, role) VALUES ($1, $2, 'vice')",
    [department.id, user.id]
  );
  const sub = (
    await adminApi.post('/api/v1/work-items', {
      workRef: work.code,
      name: 'Cấp hai',
      level: 2,
      leaderIds: [user.id],
    })
  ).body.data.item;
  const child = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Cấp ba',
    assigneeId: admin.id,
    parentRef: sub.code,
    leaderIds: [user.id],
  });
  expect(child.status).toBe(200);
  const before = (await pool.query('SELECT * FROM work_items ORDER BY id')).rows;
  const denied = await adminApi.patch(urlOf('work', work), { departmentId: other.id });
  expect(denied.status, JSON.stringify(denied.body)).toBe(400);
  expect((await pool.query('SELECT * FROM work_items ORDER BY id')).rows).toEqual(before);
  expect(
    (await pool.query('SELECT department_id FROM works WHERE id = $1', [work.id])).rows[0]
      .department_id
  ).toBe(department.id);
});

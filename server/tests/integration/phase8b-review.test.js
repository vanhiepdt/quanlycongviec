import { afterAll, beforeEach, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';
const app = createApp();
let admin, sender, staff, api, senderApi, dept, work, sub;
const itemUrl = (item) => '/api/v1/work-items/' + item.id;
beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ role: 'admin', email: 'admin@test.local' });
  sender = await makeLoginUser({
    code: 'NV002',
    email: 'sender@test.local',
    full_name: 'Người gửi',
    role: 'Phó phòng',
    department_id: dept.id,
  });
  staff = await makeLoginUser({ code: 'NV003', email: 'staff@test.local', department_id: dept.id });
  api = client(app);
  senderApi = client(app);
  await api.login(admin.email);
  await senderApi.login(sender.email);
  const made = await senderApi.post('/api/v1/works', {
    name: 'Công việc gốc',
    departmentId: dept.id,
    saveAsDraft: true,
    // Đợt A (028/R1a): submit ĐÒI ô «Ban lãnh đạo kiểm soát» khác rỗng. Người duyệt trong file
    // này là admin — admin hợp lệ với mọi phòng nên chọn thẳng admin, khỏi dựng thêm Phó GĐ.
    supervisorIds: [admin.id],
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  work = made.body.data.work;
  const child = await senderApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Việc con',
    level: 2,
  });
  expect(child.status).toBe(200);
  sub = child.body.data.item;
});
afterAll(closePool);
async function task(over = {}) {
  const res = await senderApi.post('/api/v1/work-items', {
    workRef: work.code,
    parentRef: sub.code,
    name: 'Nhiệm vụ',
    assigneeId: staff.id,
    ...over,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data.item;
}
it('nhiệm vụ con chia đều, sửa tay giữ tổng lệch; thêm/xóa không mất tỷ lệ đã sửa', async () => {
  const first = await task();
  const second = await task();
  const third = await task();
  let rows = (
    await pool.query('SELECT ty_le FROM work_items WHERE parent_id = $1 ORDER BY id', [sub.id])
  ).rows;
  expect(rows.map((r) => r.ty_le)).toEqual([34, 33, 33]);
  expect((await senderApi.patch(itemUrl(first), { tyLe: 70 })).status).toBe(200);
  rows = (
    await pool.query('SELECT ty_le FROM work_items WHERE parent_id = $1 ORDER BY id', [sub.id])
  ).rows;
  expect(rows.map((r) => r.ty_le)).toEqual([70, 33, 33]);
  expect((await senderApi.del(itemUrl(third))).status).toBe(200);
  expect(
    (
      await pool.query('SELECT ty_le FROM work_items WHERE id = ANY($1::bigint[]) ORDER BY id', [
        [first.id, second.id],
      ])
    ).rows.map((r) => r.ty_le)
  ).toEqual([70, 33]);
});
it('REST/RPC tạo thiếu người thực hiện hoặc sửa bỏ trống đều bị chặn, dữ liệu giữ nguyên', async () => {
  const missing = await api.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Chưa chọn người',
  });
  expect(missing.status).toBe(400);
  expect(missing.body.error.field).toBe('assigneeId');
  const rpc = await api.post('/api/rpc/addTaskWithAuth', {
    args: [{ projectId: work.code, name: 'Thiếu người RPC' }],
  });
  expect(rpc.status).toBe(400);
  const one = await task();
  expect((await senderApi.patch(itemUrl(one), { assigneeId: null })).status).toBe(400);
  expect(
    (await pool.query('SELECT assignee_id FROM work_items WHERE id = $1', [one.id])).rows[0]
      .assignee_id
  ).toBe(staff.id);
});

it('người duyệt sửa cả ba cấp rồi duyệt: người gửi thấy đúng thay đổi cho đến khi Đã biết', async () => {
  const one = await task();
  expect((await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit')).status).toBe(200);
  expect(
    (await api.patch('/api/v1/works/' + work.id, { name: 'Tên do người duyệt sửa' })).status
  ).toBe(200);
  expect((await api.patch(itemUrl(sub), { description: 'Mô tả đã bổ sung' })).status).toBe(200);
  expect((await api.patch(itemUrl(one), { notes: 'Nội dung người duyệt bổ sung' })).status).toBe(
    200
  );
  const changesUrl = '/api/v1/approvals/work/' + work.id + '/changes';
  expect((await senderApi.get(changesUrl)).body.data.items).toEqual([]);
  expect((await api.post('/api/v1/approvals/work/' + work.id + '/approve')).status).toBe(200);
  const first = await senderApi.get(changesUrl);
  expect(first.status, JSON.stringify(first.body)).toBe(200);
  expect(first.body.data.items).toHaveLength(3);
  expect(first.body.data.items.flatMap((r) => r.changes)).toContainEqual(
    expect.objectContaining({ label: 'Tên', from: 'Công việc gốc', to: 'Tên do người duyệt sửa' })
  );
  expect((await senderApi.get(changesUrl)).body.data).toEqual(first.body.data);
  const id = first.body.data.items[0].id;
  expect((await api.post('/api/v1/approvals/changes/' + id + '/acknowledge')).status).toBe(404);
  for (const change of first.body.data.items)
    expect(
      (await senderApi.post('/api/v1/approvals/changes/' + change.id + '/acknowledge')).status
    ).toBe(200);
  expect((await senderApi.get(changesUrl)).body.data.items).toEqual([]);
  expect((await senderApi.post('/api/v1/approvals/changes/' + id + '/acknowledge')).status).toBe(
    200
  );
});
it('người duyệt sửa và phê duyệt atomic đủ cả công việc, công việc con, nhiệm vụ', async () => {
  const workApprove = await senderApi.post('/api/v1/approvals/work/' + work.code + '/submit');
  expect(workApprove.status).toBe(200);
  const workResult = await api.post('/api/v1/approvals/work/' + work.code + '/approve', {
    edit: { name: 'Công việc cha đã sửa atomic', description: 'Mô tả atomic' },
  });
  expect(workResult.status, JSON.stringify(workResult.body)).toBe(200);
  expect(workResult.body.data.row.name).toBe('Công việc cha đã sửa atomic');
  expect(workResult.body.data.row.approval_status).toBe('Đã duyệt');

  const work2 = (
    await senderApi.post('/api/v1/works', {
      name: 'Công việc cho cấp 2 atomic',
      departmentId: dept.id,
      saveAsDraft: true,
      supervisorIds: [admin.id],
    })
  ).body.data.work;
  const sub2 = (
    await senderApi.post('/api/v1/work-items', {
      workRef: work2.code,
      level: 2,
      name: 'Công việc con trước atomic',
    })
  ).body.data.item;
  expect(
    (await senderApi.post('/api/v1/approvals/work-item/' + sub2.code + '/submit')).status
  ).toBe(200);
  const subResult = await api.post('/api/v1/approvals/work-item/' + sub2.code + '/approve', {
    edit: { name: 'Công việc con đã sửa atomic' },
  });
  expect(subResult.status, JSON.stringify(subResult.body)).toBe(200);
  expect(subResult.body.data.row.name).toBe('Công việc con đã sửa atomic');
  expect(subResult.body.data.row.approval_status).toBe('Đã duyệt');

  const work3 = (
    await senderApi.post('/api/v1/works', {
      name: 'Công việc cho cấp 3 atomic',
      departmentId: dept.id,
      saveAsDraft: true,
      supervisorIds: [admin.id],
    })
  ).body.data.work;
  const sub3 = (
    await senderApi.post('/api/v1/work-items', {
      workRef: work3.code,
      level: 2,
      name: 'Công việc con của nhiệm vụ atomic',
    })
  ).body.data.item;
  const task3 = (
    await senderApi.post('/api/v1/work-items', {
      workRef: work3.code,
      parentRef: sub3.code,
      level: 3,
      name: 'Nhiệm vụ trước atomic',
      assigneeId: staff.id,
    })
  ).body.data.item;
  expect(
    (await senderApi.post('/api/v1/approvals/work-item/' + task3.code + '/submit')).status
  ).toBe(200);
  const taskResult = await api.post('/api/v1/approvals/work-item/' + task3.code + '/approve', {
    edit: { notes: 'Ghi chú nhiệm vụ đã sửa atomic' },
  });
  expect(taskResult.status, JSON.stringify(taskResult.body)).toBe(200);
  expect(taskResult.body.data.row.notes).toBe('Ghi chú nhiệm vụ đã sửa atomic');
  expect(taskResult.body.data.row.approval_status).toBe('Đã duyệt');
});

it('phê duyệt atomic rollback cả nội dung khi quyền duyệt mất giữa chừng (đổi phòng / đổi người duyệt)', async () => {
  const deptOther = await makeDepartment({ code: 'PH-ATOMIC', name: 'Phòng atomic khác' });
  const pgd = await makeLoginUser({
    code: 'NV004',
    email: 'pgd-atomic@test.local',
    full_name: 'Phó Giám đốc atomic',
    role: 'Phó Giám đốc',
  });
  await pool.query(
    "INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,'deputy_director')",
    [dept.id, pgd.id]
  );
  const reviewer = client(app);
  await reviewer.login(pgd.email);
  await api.put('/api/v1/permissions', {
    thayDoi: [
      { vai: pgd.role, entityType: 'work', action: 'create', giaTri: 'cho-phep', phamVi: 'tat-ca' },
      { vai: pgd.role, entityType: 'work', action: 'update', giaTri: 'cho-phep', phamVi: 'tat-ca' },
    ],
  });
  const pending = (
    await senderApi.post('/api/v1/works', {
      name: 'Công việc rollback atomic',
      departmentId: dept.id,
      saveAsDraft: true,
      // Chọn đúng Phó GĐ sẽ duyệt, để hai lần hỏng bên dưới đều KHÔNG phải do cổng NOT_APPROVER
      // của đợt A chặn ngay từ đầu — submit cũng đòi ô này khác rỗng (R1a).
      supervisorIds: [pgd.id],
    })
  ).body.data.work;
  expect((await senderApi.post('/api/v1/approvals/work/' + pending.code + '/submit')).status).toBe(
    200
  );

  const docLai = async () =>
    (
      await pool.query(
        'SELECT name,department_id,approval_status,supervisor_ids FROM works WHERE id=$1',
        [pending.id]
      )
    ).rows[0];
  const khongCoDeNghi = async () =>
    (
      await pool.query('SELECT count(*)::int AS n FROM approval_changes WHERE work_id=$1', [
        pending.id,
      ])
    ).rows[0].n;

  // (1) ĐỔI PHÒNG — đợt A (028) làm lỗi ra SỚM hơn và RÕ hơn bản trước 028: `assertPhanCong`
  //     trong `works.update` soi lại `supervisor_ids` theo phòng MỚI, mà PGĐ A không phụ trách
  //     phòng đó ⇒ 400 VALIDATION_ERROR. Trước 028 ô này NULL nên lọt qua và 403 mới hiện ra ở
  //     bước kiểm lại quyền duyệt cuối `duyetCaCay`. Điều test phải giữ là KHÔNG GHI GÌ CẢ.
  const failed = await reviewer.post('/api/v1/approvals/work/' + pending.code + '/approve', {
    edit: { name: 'Tên không được lưu', departmentId: deptOther.id },
  });
  expect(failed.status, JSON.stringify(failed.body)).toBe(400);
  expect(failed.body.error.code).toBe('VALIDATION_ERROR');
  expect(await docLai()).toMatchObject({
    name: 'Công việc rollback atomic',
    department_id: dept.id,
    approval_status: 'Chờ duyệt',
  });
  expect(await khongCoDeNghi()).toBe(0);

  // (2) ĐỔI NGƯỜI DUYỆT — vẫn đi tới đúng bước kiểm lại quyền ở CUỐI `duyetCaCay`: bản sửa tự gạt
  //     PGĐ A ra khỏi «Ban lãnh đạo kiểm soát», nên khi quyền duyệt được kiểm lại trên dòng MỚI
  //     thì A không còn là người duyệt ⇒ 403, và cả lượt sửa phải bốc hơi. Đây là đường 403-sau-edit
  //     mà nhánh (1) không còn chạm tới được kể từ đợt A.
  const matQuyen = await reviewer.post('/api/v1/approvals/work/' + pending.code + '/approve', {
    edit: { name: 'Tên cũng không được lưu', supervisorIds: [admin.id] },
  });
  expect(matQuyen.status, JSON.stringify(matQuyen.body)).toBe(403);
  expect(matQuyen.body.error.code).toBe('NOT_APPROVER');
  expect(await docLai()).toMatchObject({
    name: 'Công việc rollback atomic',
    department_id: dept.id,
    approval_status: 'Chờ duyệt',
    supervisor_ids: [pgd.id],
  });
  expect(await khongCoDeNghi()).toBe(0);
});

it('trả lại để sửa bỏ lượt chỉnh chưa duyệt, lần gửi/duyệt sau có thông báo mới', async () => {
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  await api.patch('/api/v1/works/' + work.id, { name: 'Đổi trước khi trả' });
  const returned = await api.post('/api/v1/approvals/work/' + work.id + '/return', {
    reason: 'Cần bổ sung nội dung rõ ràng',
  });
  expect(returned.status).toBe(200);
  expect((await pool.query('SELECT count(*)::int AS n FROM approval_changes')).rows[0].n).toBe(0);
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  await api.patch('/api/v1/works/' + work.id, { name: 'Đổi ở lần thứ hai' });
  await api.post('/api/v1/approvals/work/' + work.id + '/approve');
  const changes = (await senderApi.get('/api/v1/approvals/work/' + work.id + '/changes')).body.data
    .items;
  expect(changes).toHaveLength(1);
  expect(changes[0].changes[0]).toMatchObject({
    from: 'Đổi trước khi trả',
    to: 'Đổi ở lần thứ hai',
  });
});

it('quyền duyệt cho phép sửa mục Chờ duyệt trong phòng, không mở sửa mục Đã duyệt khi update bị tắt', async () => {
  const pgd = await makeLoginUser({ code: 'NV004', email: 'pgd@test.local', role: 'Phó Giám đốc' });
  await pool.query(
    "INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,'deputy_director')",
    [dept.id, pgd.id]
  );
  const reviewer = client(app);
  await reviewer.login(pgd.email);
  // Đợt A (028/R1a): người duyệt PHẢI có tên trong «Ban lãnh đạo kiểm soát» của mục.
  // Thêm PGĐ vào danh sách để 403 ở cuối test là do «mục Đã duyệt + update bị tắt»,
  // còn 200 ở giữa là thật chứ không phải lọt qua cổng NOT_APPROVER.
  expect(
    (await api.patch('/api/v1/works/' + work.id, { supervisorIds: [admin.id, pgd.id] })).status
  ).toBe(200);
  await api.put('/api/v1/permissions', {
    thayDoi: [{ vai: pgd.role, entityType: 'work', action: 'update', giaTri: 'tu-choi' }],
  });
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  expect(
    (await reviewer.patch('/api/v1/works/' + work.id, { name: 'Sửa trong khi duyệt' })).status
  ).toBe(200);
  expect((await reviewer.post('/api/v1/approvals/work/' + work.id + '/approve')).status).toBe(200);
  expect(
    (await reviewer.patch('/api/v1/works/' + work.id, { name: 'Sửa sau khi duyệt' })).status
  ).toBe(403);
});

it('lưu nguyên tỷ lệ đang tự động không làm mất chia đều khi thêm nhiệm vụ', async () => {
  const first = await task();
  expect(
    (await senderApi.patch(itemUrl(first), { notes: 'Chỉ sửa ghi chú', tyLe: 100 })).status
  ).toBe(200);
  await task();
  expect(
    (
      await pool.query(
        'SELECT ty_le,ty_le_tu_dong FROM work_items WHERE parent_id=$1 ORDER BY id',
        [sub.id]
      )
    ).rows
  ).toEqual([
    { ty_le: 50, ty_le_tu_dong: true },
    { ty_le: 50, ty_le_tu_dong: true },
  ]);
});
it('đã biết lượt trước vẫn nhận lượt sửa mới; sửa rồi quay về nguyên trạng không tạo thay đổi giả', async () => {
  const url = '/api/v1/approvals/work/' + work.id;
  await senderApi.post(url + '/submit');
  await api.patch('/api/v1/works/' + work.id, { name: 'Sửa lần đầu' });
  await api.post(url + '/approve');
  const old = (await senderApi.get(url + '/changes')).body.data.items[0];
  await senderApi.post('/api/v1/approvals/changes/' + old.id + '/acknowledge');
  await senderApi.post(url + '/submit');
  await api.patch('/api/v1/works/' + work.id, { name: 'Đổi tạm' });
  await api.patch('/api/v1/works/' + work.id, { name: 'Sửa lần đầu' });
  await api.post(url + '/approve');
  expect((await senderApi.get(url + '/changes')).body.data.items).toEqual([]);
  await senderApi.post(url + '/submit');
  await api.patch('/api/v1/works/' + work.id, { name: 'Sửa lần mới' });
  await api.post(url + '/approve');
  const fresh = (await senderApi.get(url + '/changes')).body.data.items;
  expect(fresh).toHaveLength(1);
  expect(fresh[0].id).not.toBe(old.id);
  expect(fresh[0].changes[0]).toMatchObject({ from: 'Sửa lần đầu', to: 'Sửa lần mới' });
});
it('người duyệt ngoài phòng bị chặn, không ghi nội dung hay thông báo thay đổi', async () => {
  const outsider = await makeLoginUser({
    code: 'NV099',
    email: 'outside@test.local',
    role: 'Phó Giám đốc',
  });
  const outside = client(app);
  await outside.login(outsider.email);
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  const before = (await pool.query('SELECT * FROM works WHERE id=$1', [work.id])).rows;
  expect((await outside.patch('/api/v1/works/' + work.id, { name: 'Ngoài phòng' })).status).toBe(
    403
  );
  expect((await pool.query('SELECT * FROM works WHERE id=$1', [work.id])).rows).toEqual(before);
  expect((await pool.query('SELECT * FROM approval_changes')).rows).toEqual([]);
});

it('lưu và phê duyệt kiểm dữ liệu như PATCH; lỗi không đổi nội dung, trạng thái hay thông báo', async () => {
  const one = await task();
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  const before = (await pool.query('SELECT * FROM work_items ORDER BY id')).rows;
  const notificationsBefore = (await pool.query('SELECT * FROM notifications ORDER BY id')).rows;
  for (const edit of [
    { name: '' },
    { notes: 'X'.repeat(2001) },
    { assignee: '', notes: 'Không được lưu' },
  ]) {
    const failed = await api.post('/api/v1/approvals/item/' + one.code + '/approve', { edit });
    expect(failed.status, JSON.stringify(failed.body)).toBe(400);
    expect((await pool.query('SELECT * FROM work_items ORDER BY id')).rows).toEqual(before);
    expect((await pool.query('SELECT * FROM approval_changes')).rows).toEqual([]);
    expect((await pool.query('SELECT * FROM notifications ORDER BY id')).rows).toEqual(
      notificationsBefore
    );
  }
});

it('thu hồi quyền duyệt áp dụng ngay trên phiên cũ, yêu cầu lưu và duyệt bị chặn trước khi sửa', async () => {
  const pgd = await makeLoginUser({
    code: 'NV004',
    email: 'pgd-live@test.local',
    role: 'Phó Giám đốc',
  });
  await pool.query(
    "INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,'deputy_director')",
    [dept.id, pgd.id]
  );
  const reviewer = client(app);
  await reviewer.login(pgd.email);
  // Cho PGĐ vào «Ban lãnh đạo kiểm soát» để 403 bên dưới là do QUYỀN DUYỆT BỊ THU HỒI,
  // chứ không phải do cổng NOT_APPROVER của đợt A che mất.
  expect(
    (await api.patch('/api/v1/works/' + work.id, { supervisorIds: [admin.id, pgd.id] })).status
  ).toBe(200);
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  await api.put('/api/v1/permissions', {
    thayDoi: [{ vai: pgd.role, entityType: 'work', action: 'approve', giaTri: 'tu-choi' }],
  });
  const before = (await pool.query('SELECT * FROM works WHERE id=$1', [work.id])).rows;
  expect(
    (
      await reviewer.post('/api/v1/approvals/work/' + work.id + '/approve', {
        edit: { name: 'Không được ghi' },
      })
    ).status
  ).toBe(403);
  expect((await pool.query('SELECT * FROM works WHERE id=$1', [work.id])).rows).toEqual(before);
  expect((await pool.query('SELECT * FROM approval_changes')).rows).toEqual([]);
});

it('popup ghi cả tỷ lệ đầu mục bị cân gián tiếp, chưa duyệt thì người gửi chưa nhận', async () => {
  const sibling = await task({ parentRef: null });
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  const changed = await api.patch(itemUrl(sub), { tyLe: 70 });
  expect(changed.status, JSON.stringify(changed.body)).toBe(200);
  const url = '/api/v1/approvals/work/' + work.id;
  expect((await senderApi.get(url + '/changes')).body.data.items).toEqual([]);
  await api.post(url + '/approve');
  const receipts = (await senderApi.get(url + '/changes')).body.data.items;
  expect(receipts).toHaveLength(2);
  expect(receipts.find((r) => r.entity_code === sub.code).changes).toContainEqual(
    expect.objectContaining({ field: 'ty_le', from: '50', to: '70' })
  );
  expect(receipts.find((r) => r.entity_code === sibling.code).changes).toContainEqual(
    expect.objectContaining({ field: 'ty_le', from: '50', to: '30' })
  );
});

it('sửa rồi chuyển nhiệm vụ trong lúc duyệt vẫn gộp thông báo vào công việc đích', async () => {
  const one = await task();
  const target = (
    await senderApi.post('/api/v1/works', {
      name: 'Công việc đích',
      departmentId: dept.id,
      supervisorIds: [admin.id],
    })
  ).body.data.work;
  await senderApi.post('/api/v1/approvals/work/' + work.id + '/submit');
  expect((await api.patch(itemUrl(one), { notes: 'Sửa trước khi chuyển' })).status).toBe(200);
  const result = await api.post('/api/v1/approvals/item/' + one.code + '/approve', {
    edit: { projectId: target.code, notes: 'Sửa và chuyển xong' },
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  expect(result.body.data.row.work_id).toBe(target.id);
  const receipt = (await senderApi.get('/api/v1/approvals/work/' + target.code + '/changes')).body
    .data.items;
  expect(receipt).toHaveLength(1);
  expect(receipt[0].changes).toContainEqual(
    expect.objectContaining({ field: 'work_id', to: target.code + ' — Công việc đích' })
  );
  expect(receipt[0].changes).toContainEqual(
    expect.objectContaining({ field: 'notes', from: '', to: 'Sửa và chuyển xong' })
  );
});

import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';
const app = createApp().listen(0, '127.0.0.1');
let dept, admin, pgd, tp, pp, nv, adminApi, pgdApi, tpApi, ppApi, nvApi, work, task;
async function login(u) {
  const api = client(app);
  await api.login(u.email);
  return api;
}
async function taskCreate({ duyet = true, ...over } = {}) {
  // KHÔNG gửi supervisorIds: để cấp 3 tự kế thừa người ĐẦU TIÊN của cấp 2 (Q12, đợt A) — hầu hết
  // test ở đây cần đúng hành vi mặc định đó. Test nào cần ô riêng thì gửi qua `over`.
  const r = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'TC V1–V8',
    level: 3,
    assigneeId: nv.id,
    leaderIds: [tp.id],
    ...over,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const item = r.body.data.item;
  if (!duyet) return item;
  // ĐỢT B (Q3 + Q2): nhiệm vụ mới là «Chờ duyệt» và cây chưa duyệt thì không nộp được file. Bộ test
  // này khảo sát TÍCH «Gửi BLĐ» (026) trên một nhiệm vụ đang sống, nên ký sẵn như trước ĐỢT B.
  // Ca nào cần đúng mục còn chờ duyệt thì gửi `duyet: false`.
  const ky = await pgdApi.post('/api/v1/approvals/work-item/' + item.code + '/approve');
  expect(ky.status, JSON.stringify(ky.body)).toBe(200);
  return item;
}
async function upload(
  api = nvApi,
  item = task,
  fileId = null,
  name = 'kết quả.pdf',
  mime = 'application/pdf'
) {
  let req = api.agent
    .post('/api/v1/work-items/' + item.code + '/files')
    .set('x-csrf-token', await api.csrfToken());
  if (fileId) req = req.field('fileId', String(fileId));
  return req.attach('file', Buffer.from('%PDF-1.4 test'), { filename: name, contentType: mime });
}
async function override(vai, entityType, action, giaTri) {
  const r = await adminApi.put('/api/v1/permissions', {
    thayDoi: [{ vai, entityType, action, giaTri }],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}
beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTables();
  dept = await makeDepartment();
  const users = [];
  for (const [index, role] of [
    'admin',
    'Phó Giám đốc',
    'Trưởng phòng',
    'Phó phòng',
    'Nhân viên',
  ].entries())
    users.push(
      await makeLoginUser({
        code: 'NV00' + index,
        email: 'v' + index + '@test.local',
        full_name: role + ' thử',
        role,
        department_id: index >= 2 ? dept.id : null,
      })
    );
  [admin, pgd, tp, pp, nv] = users;
  for (const [u, role] of [
    [pgd, 'deputy_director'],
    [tp, 'head'],
    [pp, 'vice'],
  ])
    await pool.query(
      'INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,$3)',
      [dept.id, u.id, role]
    );
  adminApi = await login(admin);
  pgdApi = await login(pgd);
  tpApi = await login(tp);
  ppApi = await login(pp);
  nvApi = await login(nv);
  const r = await adminApi.post('/api/v1/works', {
    name: 'TC V1–V8',
    departmentId: dept.id,
    supervisorIds: [pgd.id],
    leaderIds: [tp.id, pp.id],
  });
  expect(r.status).toBe(200);
  work = r.body.data.work;
  // ĐỢT B (Q3): công việc admin lập cũng là «Chờ duyệt» — ký nó để cả cây sẵn sàng cho bộ test tích
  // «Gửi BLĐ», đúng trạng thái mà bộ test này đứng trên trước ĐỢT B.
  const kyCay = await pgdApi.post('/api/v1/approvals/work/' + work.code + '/approve');
  expect(kyCay.status, JSON.stringify(kyCay.body)).toBe(200);
  task = await taskCreate();
});
afterAll(async () => {
  await new Promise((resolve) => app.close(resolve));
  await closePool();
});

async function setting(value) {
  const r = await adminApi.put('/api/v1/permissions/settings', {
    guiBldChangeRequiresApproval: value,
  });
  expect(r.status).toBe(200);
}
async function pending(api = pgdApi) {
  return (await api.get('/api/v1/approvals/pending')).body.data.items.filter(
    (r) => r.kind === 'gui-bld'
  );
}
function doi(api, value, item = task) {
  return api.patch('/api/v1/work-items/' + item.code, { guiBldPheDuyet: value });
}
it('TC-V7-01: tạo NV hiện rõ mặc định tắt, bật dùng supervisor có sẵn và cột được trả qua view', async () => {
  const r = await nvApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'NV chọn gửi BLĐ',
    level: 3,
    assigneeId: nv.id,
    guiBldPheDuyet: true,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  expect(r.body.data.item.gui_bld_phe_duyet).toBe(true);
  expect(task.gui_bld_phe_duyet).toBe(false);
  // ĐỢT B (Q3): nhiệm vụ mới là «Chờ duyệt», mà `v_countable_items` chỉ đếm mục ĐÃ duyệt — nên phải
  // ký nó trước rồi mới kiểm được cột đi qua view. (Đây cũng chính là lý do R4'' chọn
  // `approval_changes`: hạ cây về chờ là view mất số.)
  const ky = await pgdApi.post('/api/v1/approvals/work-item/' + r.body.data.item.code + '/approve');
  expect(ky.status, JSON.stringify(ky.body)).toBe(200);
  expect(
    (
      await pool.query('SELECT gui_bld_phe_duyet FROM v_countable_items WHERE id=$1', [
        r.body.data.item.id,
      ])
    ).rows[0].gui_bld_phe_duyet
  ).toBe(true);
});
it('TC-V7-02: bật thiếu BLĐ hoặc gửi giá trị giả bị chặn trước ghi; cấp 2 không nhận tích', async () => {
  const w = await adminApi.post('/api/v1/works', {
    name: 'Không có BLĐ',
    departmentId: dept.id,
    leaderIds: [tp.id],
  });
  const before = (await pool.query('SELECT count(*)::int n FROM work_items')).rows[0].n;
  for (const value of [true, 'true', null, 1]) {
    const r = await adminApi.post('/api/v1/work-items', {
      workRef: w.body.data.work.code,
      name: 'Không được ghi',
      level: 3,
      assigneeId: nv.id,
      leaderIds: [tp.id],
      // Đợt A (028): cấp 3 KHÔNG bắt buộc có ô riêng nữa — để rỗng tường minh thì mới thật sự
      // "thiếu BLĐ", chứ bỏ hẳn khoá đi là ăn mặc định kế thừa từ công việc cha.
      supervisorIds: [],
      guiBldPheDuyet: value,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    if (value === true) expect(r.body.error.message).toContain('chưa có Ban lãnh đạo kiểm soát');
  }
  expect((await pool.query('SELECT count(*)::int n FROM work_items')).rows[0].n).toBe(before);
  const cap2 = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Cấp 2',
    level: 2,
    guiBldPheDuyet: true,
  });
  expect(cap2.status).toBe(400);
});
it('TC-V7-03: NV không sửa được sau tạo dù mở quyền; TP/PP mặc định chỉ trình, chờ rồi mới có hiệu lực', async () => {
  await override('Nhân viên', 'task', 'gui-bld', 'cho-phep');
  expect((await doi(nvApi, true)).status).toBe(403);
  for (const api of [tpApi, ppApi]) {
    const r = await doi(api, true);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.item.gui_bld_phe_duyet).toBe(false);
    expect(r.body.data.guiBldChange.pending).toBe(true);
    const ds = await pending();
    expect(ds).toHaveLength(1);
    expect(ds[0].change.to).toBe('Bật');
    expect((await pgdApi.post('/api/v1/approvals/changes/' + ds[0].id + '/approve')).status).toBe(
      200
    );
    expect(
      (await adminApi.get('/api/v1/work-items/' + task.code)).body.data.item.gui_bld_phe_duyet
    ).toBe(true);
    expect((await doi(adminApi, false)).status).toBe(200);
  }
});
it('TC-V7-04: admin tắt yêu cầu duyệt có hiệu lực request kế; ⏳ vẫn phải chờ; ✕ thu hồi chặn', async () => {
  await setting(false);
  expect((await doi(tpApi, true)).body.data.item.gui_bld_phe_duyet).toBe(true);
  await override('Trưởng phòng', 'task', 'gui-bld', 'cho-duyet');
  const cho = await doi(tpApi, false);
  expect(cho.status, JSON.stringify(cho.body)).toBe(200);
  expect(cho.body.data.item.gui_bld_phe_duyet).toBe(true);
  expect(await pending()).toHaveLength(1);
  await override('Trưởng phòng', 'task', 'gui-bld', 'tu-choi');
  expect((await doi(tpApi, false)).status).toBe(403);
  const yeuCau = (await pending())[0];
  expect((await pgdApi.post('/api/v1/approvals/changes/' + yeuCau.id + '/approve')).status).toBe(
    403
  );
  expect(
    (
      await pgdApi.post('/api/v1/approvals/changes/' + yeuCau.id + '/reject', {
        reason: 'Không còn quyền đề nghị',
      })
    ).status
  ).toBe(200);
  expect(
    (await adminApi.get('/api/v1/work-items/' + task.code)).body.data.item.gui_bld_phe_duyet
  ).toBe(true);
});
it('TC-V7-05: tích bật NV luôn qua TP, TP không Hoàn thành; trình chỉ đúng supervisor (không mọi PGĐ phòng)', async () => {
  const pgd2 = await makeLoginUser({
    code: 'NV999',
    email: 'pgd2@test.local',
    role: 'Phó Giám đốc',
    full_name: 'PGĐ khác',
  });
  await pool.query(
    "INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,'deputy_director')",
    [dept.id, pgd2.id]
  );
  const pgd2Api = await login(pgd2);
  task = await taskCreate({ guiBldPheDuyet: true });
  await override('Nhân viên', 'file', 'create', 'cho-phep');
  const saved = await upload();
  const f = saved.body.data.nhom;
  const gui = await nvApi.post('/api/v1/task-files/' + f.id + '/gui-di-duyet');
  expect(gui.body.data.nhom.trang_thai).toBe('cho-xem');
  expect(
    (await tpApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom[0].tienDo
  ).toBe(40);
  expect(
    (await tpApi.post('/api/v1/task-files/' + f.id + '/verdict', { hanhDong: 'hoan-thanh' })).status
  ).toBe(403);
  expect(
    (
      await tpApi.post('/api/v1/task-files/' + f.id + '/verdict', {
        hanhDong: 'tp-phe-duyet',
        noiDung: 'Đã kiểm tra và trình BLĐ',
      })
    ).status
  ).toBe(200);
  const notices = (
    await pool.query("SELECT user_id FROM notifications WHERE ref_type='task_file' AND ref_id=$1", [
      f.id,
    ])
  ).rows.map((r) => Number(r.user_id));
  expect(notices).toContain(Number(pgd.id));
  expect(notices).not.toContain(Number(pgd2.id));
  expect(
    (await pgd2Api.get('/api/v1/task-files/cho-duyet')).body.data.items.map((r) => r.id)
  ).not.toContain(f.id);
  expect(
    (await pgd2Api.post('/api/v1/task-files/' + f.id + '/verdict', { hanhDong: 'duyet' })).status
  ).toBe(403);
  expect(
    (await pgdApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom[0].tienDo
  ).toBe(80);
  expect(
    (await pgdApi.post('/api/v1/task-files/' + f.id + '/verdict', { hanhDong: 'duyet' })).status
  ).toBe(200);
});
it('TC-V7-06: nhiệm vụ cấp 3 kế thừa BLĐ của cấp 2, và chỉ được chọn TRONG tập của cấp 2 (D2)', async () => {
  const pgd2 = await makeLoginUser({
    code: 'NV999',
    email: 'pgd2-v706@test.local',
    role: 'Phó Giám đốc',
    full_name: 'PGĐ ngoài danh sách',
  });
  await pool.query(
    "INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,'deputy_director')",
    [dept.id, pgd2.id]
  );
  const cap2 = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Cha kiểm soát',
    level: 2,
    leaderIds: [tp.id],
  });
  const cap2Code = cap2.body.data.item.code;
  // Cấp 2 không gửi gì ⇒ kế thừa nguyên danh sách cấp 1.
  expect(cap2.body.data.item.supervisor_ids).toEqual([pgd.id]);

  // Đợt A: cấp 3 GIỜ CÓ ô riêng, mặc định = người ĐẦU TIÊN của cấp 2 (Q12) — bản trước 028
  // để NULL và suy ra lúc đọc. `supervisor_hieu_luc` vẫn phải khớp để định tuyến file không đổi.
  const child = await taskCreate({
    parentRef: cap2Code,
    guiBldPheDuyet: true,
  });
  expect(child.supervisor_ids).toEqual([pgd.id]);
  // `supervisor_hieu_luc` = «MỘT người quyết định kết quả của dòng này» — chỗ này phải khớp với
  // `sqlSupervisorHieuLuc` mà hàng chờ file đang dùng, lệch là tích bật mà file đi sai người.
  expect(
    (await adminApi.get('/api/v1/work-items/' + child.code)).body.data.item.supervisor_hieu_luc
  ).toBe(pgd.id);

  // Cấp 3 chỉ ĐÚNG MỘT người.
  const haiNguoi = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    parentRef: cap2Code,
    name: 'Hai người là sai',
    level: 3,
    assigneeId: nv.id,
    supervisorIds: [pgd.id, pgd2.id],
  });
  expect(haiNguoi.status, JSON.stringify(haiNguoi.body)).toBe(400);

  // Và phải nằm TRONG tập của cấp 2 — pgd2 là Phó GĐ phụ trách phòng thật, nhưng cấp 1/cấp 2
  // không chọn nên vẫn bị gạt: đúng người theo phòng chưa đủ, phải đúng người theo cây.
  const ngoaiTap = await adminApi.patch('/api/v1/work-items/' + child.code, {
    supervisorIds: [pgd2.id],
  });
  expect(ngoaiTap.status, JSON.stringify(ngoaiTap.body)).toBe(400);
  expect(ngoaiTap.body.error.code).toBe('SUPERVISOR_NOT_IN_SOURCE');
  expect(
    (await adminApi.get('/api/v1/work-items/' + child.code)).body.data.item.supervisor_ids
  ).toEqual([pgd.id]);

  // Bỏ BLĐ của CẤP 2 khi con đang bật tích: con đã có ô riêng nên không bị mồ côi ⇒ cho sửa.
  expect(
    (await adminApi.patch('/api/v1/work-items/' + cap2Code, { supervisorIds: [] })).status
  ).toBe(200);
  expect(
    (await adminApi.get('/api/v1/work-items/' + child.code)).body.data.item.gui_bld_phe_duyet
  ).toBe(true);
});
it.each(['Trưởng phòng', 'Phó phòng'])(
  'TC-V7-07: %s trực tiếp luôn lên PGĐ, không nhận tích vô nghĩa',
  async (role) => {
    const who = role === 'Trưởng phòng' ? tp : pp;
    const r = await adminApi.post('/api/v1/work-items', {
      workRef: work.code,
      name: 'TP/PP làm',
      level: 3,
      assigneeId: who.id,
      leaderIds: [who.id],
      guiBldPheDuyet: true,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    const item = await taskCreate({ assigneeId: who.id, leaderIds: [who.id] });
    const api = who === tp ? tpApi : ppApi;
    const saved = await upload(api, item);
    const gui = await api.post('/api/v1/task-files/' + saved.body.data.nhom.id + '/gui-di-duyet');
    expect(gui.body.data.nhom.trang_thai).toBe('cho-lanh-dao');
    expect((await doi(api, true, item)).status).toBe(400);
  }
);
it('TC-V7-08: đề nghị trùng không nhân đôi; duyệt đồng thời một thành công; từ chối không xoá nhiệm vụ', async () => {
  expect((await doi(tpApi, true)).status).toBe(200);
  const ds = await pending();
  expect(ds).toHaveLength(1);
  expect((await doi(tpApi, true)).status).toBe(409);
  const rs = await Promise.all(
    [1, 2].map(() => pgdApi.post('/api/v1/approvals/changes/' + ds[0].id + '/approve'))
  );
  expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await doi(tpApi, false)).status).toBe(200);
  const two = (await pending())[0];
  expect(
    (
      await pgdApi.post('/api/v1/approvals/changes/' + two.id + '/reject', {
        reason: 'Vẫn cần lãnh đạo kiểm soát',
      })
    ).status
  ).toBe(200);
  expect(
    (await adminApi.get('/api/v1/work-items/' + task.code)).body.data.item.gui_bld_phe_duyet
  ).toBe(true);
  const count = await pgdApi.get('/api/v1/approvals/pending-count');
  expect(count.body.data.guiBldChanges).toBe(0);
});

it('TC-V7-09: cấp 3 kế thừa BLĐ của cấp 2 (Q12) nên file vẫn định tuyến đúng người đó', async () => {
  const r = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Công việc con định tuyến',
    level: 2,
    leaderIds: [tp.id],
  });
  expect(r.status).toBe(200);
  // ĐỢT B (Q2): nộp file đòi CẢ cây đã duyệt — `cayDaDuyet` nhìn cả công việc con lẫn công việc cha.
  const kyCon = await pgdApi.post(
    '/api/v1/approvals/work-item/' + r.body.data.item.code + '/approve'
  );
  expect(kyCon.status, JSON.stringify(kyCon.body)).toBe(200);
  // Đợt A: bỏ hẳn khoá supervisorIds ⇒ cấp 3 lấy người ĐẦU TIÊN của cấp 2 (Q12). Trước 028 ô này
  // để NULL và suy ra lúc đọc; kết quả định tuyến phải y như cũ.
  const child = await taskCreate({
    parentRef: r.body.data.item.code,
    guiBldPheDuyet: true,
  });
  expect(child.supervisor_ids).toEqual([pgd.id]);
  const saved = await upload(nvApi, child);
  expect(saved.status).toBe(200);
  const id = saved.body.data.nhom.id;
  expect(
    (await nvApi.post('/api/v1/task-files/' + id + '/gui-di-duyet')).body.data.nhom.trang_thai
  ).toBe('cho-xem');
  expect(
    (
      await tpApi.post('/api/v1/task-files/' + id + '/verdict', {
        hanhDong: 'tp-phe-duyet',
        noiDung: 'Đã kiểm tra bản và trình cấp trên',
      })
    ).status
  ).toBe(200);
  const queue = (await pgdApi.get('/api/v1/task-files/cho-duyet')).body.data.items;
  expect(queue.map((f) => f.id)).toContain(id);
  expect(
    (await pgdApi.post('/api/v1/task-files/' + id + '/verdict', { hanhDong: 'duyet' })).status
  ).toBe(200);
  const notices = (
    await pool.query("SELECT user_id FROM notifications WHERE ref_type='task_file' AND ref_id=$1", [
      id,
    ])
  ).rows;
  expect(notices.map((n) => n.user_id)).toContain(pgd.id);
});
it('TC-V7-10: PGĐ có quyền ⏳ đề nghị cho chính mình thì chỉ admin duyệt độc lập', async () => {
  await override('Phó Giám đốc', 'task', 'gui-bld', 'cho-duyet');
  const r = await doi(pgdApi, true);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  expect(r.body.data.guiBldChange.pending).toBe(true);
  expect(await pending(pgdApi)).toHaveLength(0);
  const proposal = (await pending(adminApi))[0];
  expect(proposal).toBeDefined();
  expect((await pgdApi.post('/api/v1/approvals/changes/' + proposal.id + '/approve')).status).toBe(
    403
  );
  const notices = (
    await pool.query("SELECT user_id FROM notifications WHERE ref_type='work_item' AND ref_id=$1", [
      task.id,
    ])
  ).rows;
  expect(notices.map((n) => n.user_id)).toContain(admin.id);
  expect(
    (await adminApi.post('/api/v1/approvals/changes/' + proposal.id + '/approve')).status
  ).toBe(200);
});
it('TC-V7-11: TP/PGĐ ngoài phòng không đề nghị hoặc duyệt dù gọi REST thẳng', async () => {
  const otherDept = await makeDepartment({ code: 'PH99', name: 'Phòng ngoài phạm vi' });
  const otherTp = await makeLoginUser({
    code: 'NV997',
    email: 'other-tp@test.local',
    role: 'Trưởng phòng',
    department_id: otherDept.id,
  });
  const otherPgd = await makeLoginUser({
    code: 'NV998',
    email: 'other-pgd@test.local',
    role: 'Phó Giám đốc',
  });
  await pool.query(
    "INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,'deputy_director')",
    [otherDept.id, otherPgd.id]
  );
  const tpOutside = await login(otherTp),
    pgdOutside = await login(otherPgd);
  expect((await doi(tpOutside, true)).status).toBe(403);
  expect((await doi(pgdOutside, true)).status).toBe(403);
  expect((await doi(tpApi, true)).status).toBe(200);
  const proposal = (await pending())[0];
  expect(await pending(pgdOutside)).toHaveLength(0);
  expect(
    (await pgdOutside.post('/api/v1/approvals/changes/' + proposal.id + '/approve')).status
  ).toBe(403);
  expect(
    (await pool.query('SELECT gui_bld_phe_duyet FROM work_items WHERE id=$1', [task.id])).rows[0]
      .gui_bld_phe_duyet
  ).toBe(false);
});
it('TC-V7-12: lý do sai trả 400, phân công đã đổi trả 409; từ chối giữ nguyên nhiệm vụ', async () => {
  expect((await doi(tpApi, true)).status).toBe(200);
  const proposal = (await pending())[0];
  for (const body of [{}, { reason: null }, { reason: 'ngắn' }, { reason: 'a'.repeat(2001) }]) {
    expect(
      (await pgdApi.post('/api/v1/approvals/changes/' + proposal.id + '/reject', body)).status
    ).toBe(400);
  }
  expect((await pgdApi.post('/api/v1/approvals/changes/not-an-id/approve')).status).toBe(400);
  const otherNv = await makeLoginUser({
    code: 'NV999',
    email: 'new-assignee@test.local',
    department_id: dept.id,
  });
  expect(
    (await adminApi.patch('/api/v1/work-items/' + task.code, { assigneeId: otherNv.id })).status
  ).toBe(200);
  expect((await pgdApi.post('/api/v1/approvals/changes/' + proposal.id + '/approve')).status).toBe(
    409
  );
  expect(
    (
      await pgdApi.post('/api/v1/approvals/changes/' + proposal.id + '/reject', {
        reason: 'Phân công đã đổi, cần lập lại',
      })
    ).status
  ).toBe(200);
  const item = (await adminApi.get('/api/v1/work-items/' + task.code)).body.data.item;
  expect(item.assignee_id).toBe(otherNv.id);
  expect(item.gui_bld_phe_duyet).toBe(false);
  const receipts = await tpApi.get('/api/v1/approvals/item/' + task.code + '/changes');
  expect(receipts.body.data.items).toEqual([]); // không hiện đề nghị bị từ chối như thay đổi đã áp dụng
});
it('TC-V7-13: trả lại/gửi lại/duyệt cây không xoá hoặc tự áp đề nghị đổi tích', async () => {
  const r = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'Cha riêng',
    level: 2,
    leaderIds: [tp.id],
  });
  expect(r.status).toBe(200);
  const sub = r.body.data.item;
  // ĐỢT B (Q3): công việc con admin lập cũng là «Chờ duyệt». Ký nó để ca này đứng đúng trên trạng
  // thái nó khảo sát — lượt sửa của TP bên dưới là sửa mục ĐÃ duyệt nên mới hạ về chờ (Q9).
  const kyCha = await pgdApi.post('/api/v1/approvals/work-item/' + sub.code + '/approve');
  expect(kyCha.status, JSON.stringify(kyCha.body)).toBe(200);
  const child = await taskCreate({ parentRef: sub.code });
  expect((await doi(tpApi, true, child)).status).toBe(200);
  const proposal = (await pending())[0];
  expect(
    (await tpApi.patch('/api/v1/work-items/' + sub.code, { name: 'Cha cần duyệt lại' })).status
  ).toBe(200);
  for (const [api, action, body] of [
    [pgdApi, 'return', { reason: 'Cần xem lại trước khi duyệt' }],
    [tpApi, 'submit', {}],
    [pgdApi, 'approve', {}],
  ]) {
    const result = await api.post('/api/v1/approvals/item/' + sub.code + '/' + action, body);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const record = (
      await pool.query('SELECT change_kind,approved_at FROM approval_changes WHERE id=$1', [
        proposal.id,
      ])
    ).rows[0];
    expect(record).toMatchObject({ change_kind: 'gui-bld', approved_at: null });
    expect(
      (await pool.query('SELECT gui_bld_phe_duyet FROM work_items WHERE id=$1', [child.id])).rows[0]
        .gui_bld_phe_duyet
    ).toBe(false);
  }
  expect((await pgdApi.post('/api/v1/approvals/changes/' + proposal.id + '/approve')).status).toBe(
    200
  );
});
it('TC-V7-14: RPC giữ hình dạng cũ, thêm trạng thái chờ; boolean giả không ghi', async () => {
  for (const value of ['true', 'false', 1, null]) {
    expect(
      (
        await tpApi.post('/api/rpc/updateTaskWithAuth', {
          args: [task.code, { guiBldPheDuyet: value }],
        })
      ).status
    ).toBe(400);
  }
  const response = await tpApi.post('/api/rpc/updateTaskWithAuth', {
    args: [task.code, { guiBldPheDuyet: true }],
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  expect(response.body.data).toMatchObject({
    success: true,
    taskId: task.code,
    moved: false,
    warnings: [],
    guiBldChange: { pending: true, value: false },
  });
  expect(
    (await pool.query('SELECT count(*)::int n FROM approval_changes WHERE item_id=$1', [task.id]))
      .rows[0].n
  ).toBe(1);
});
it('TC-V7-15: người đề nghị ngừng hoạt động không được áp, admin vẫn từ chối được', async () => {
  expect((await doi(tpApi, true)).status).toBe(200);
  const proposal = (await pending())[0];
  await pool.query('UPDATE users SET is_active=false WHERE id=$1', [tp.id]);
  expect((await pgdApi.post('/api/v1/approvals/changes/' + proposal.id + '/approve')).status).toBe(
    403
  );
  expect(
    (
      await adminApi.post('/api/v1/approvals/changes/' + proposal.id + '/reject', {
        reason: 'Người đề nghị không còn hoạt động',
      })
    ).status
  ).toBe(200);
});

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
async function taskCreate(over = {}) {
  const r = await adminApi.post('/api/v1/work-items', {
    workRef: work.code,
    name: 'TC V1–V8',
    level: 3,
    assigneeId: nv.id,
    leaderIds: [tp.id],
    supervisorIds: [pgd.id],
    ...over,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const item = r.body.data.item;
  // ĐỢT B (Q3 + Q2): nhiệm vụ cấp 3 mới tạo là «Chờ duyệt», và cây chưa duyệt thì KHÔNG nộp được
  // file — chỉ khai báo. Bộ test này khảo sát CHUỖI FILE (V1–V8) chứ không khảo sát luồng duyệt cây,
  // nên ký ngay ở đây để mọi ca bên dưới đứng trên một cây đã duyệt, y như trước ĐỢT B.
  // Ca «cây chưa duyệt thì bị chặn» có bộ test riêng: `phase8d-dot-b.test.js`.
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
  // ĐỢT B (Q3): công việc cấp 1 admin lập cũng là «Chờ duyệt» — ký nó trước để cả cây sẵn sàng
  // (`duyetCaCay` kéo theo mọi dòng con đang chờ), rồi `taskCreate` tự ký nhiệm vụ nó tạo ra.
  const kyCay = await pgdApi.post('/api/v1/approvals/work/' + work.code + '/approve');
  expect(kyCay.status, JSON.stringify(kyCay.body)).toBe(200);
  task = await taskCreate();
});
afterAll(async () => {
  await new Promise((resolve) => app.close(resolve));
  await closePool();
});
it('TC-V1-01: cấp 2 Nháp đổi [TP] thành [TP,PP] lưu được; API file cấp 3 trả đúng lỗi', async () => {
  const r = await tpApi.post('/api/v1/work-items', {
    workRef: work.code,
    level: 2,
    name: 'Công việc con nháp',
    leaderIds: [tp.id],
    saveAsDraft: true,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const item = r.body.data.item;
  const patch = await tpApi.patch('/api/v1/work-items/' + item.code, { leaderIds: [tp.id, pp.id] });
  expect(patch.status, JSON.stringify(patch.body)).toBe(200);
  expect(patch.body.data.item.leader_ids.map(Number)).toEqual([Number(tp.id), Number(pp.id)]);
  const bad = await tpApi.get('/api/v1/work-items/' + item.code + '/files');
  expect(bad.status).toBe(400);
  expect(bad.body.error).toMatchObject({
    code: 'BAD_REQUEST',
    message:
      'Chỉ NHIỆM VỤ (cấp 3) mới nộp được file kết quả — công việc/công việc con không có kết quả file',
  });
});
it('TC-V1-02: cấp 3 chọn hai lãnh đạo vẫn bị chặn, dữ liệu không đổi', async () => {
  const r = await tpApi.patch('/api/v1/work-items/' + task.code, { leaderIds: [tp.id, pp.id] });
  expect(r.status).toBe(400);
  expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'leaderIds' });
  expect(
    (
      await pool.query('SELECT leader_ids FROM work_items WHERE id=$1', [task.id])
    ).rows[0].leader_ids.map(Number)
  ).toEqual([Number(tp.id)]);
});
it('TC-V8-01: Nhân viên nộp: CSDL, thông báo, hàng chờ đồng nhất TP; TP nộp hộ: lên PGĐ', async () => {
  const r = await upload();
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const f = r.body.data.nhom;
  expect((await nvApi.post('/api/v1/task-files/' + f.id + '/gui-di-duyet')).status).toBe(200);
  expect(
    (await pool.query('SELECT trang_thai FROM task_files WHERE id=$1', [f.id])).rows[0].trang_thai
  ).toBe('cho-xem');
  const notice = await pool.query(
    "SELECT user_id FROM notifications WHERE ref_type='task_file' AND ref_id=$1",
    [f.id]
  );
  expect(notice.rows.map((n) => Number(n.user_id))).toContain(Number(tp.id));
  expect(notice.rows.map((n) => Number(n.user_id))).not.toContain(Number(pgd.id));
  expect(
    (await tpApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((f) => f.id)
  ).toContain(f.id);
  expect(
    (await pgdApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((f) => f.id)
  ).not.toContain(f.id);
  // MỚI-6 (12/09/2026): «TP nộp hộ ⇒ lên PGĐ» chỉ còn đúng khi nhiệm vụ THẬT SỰ phải trình Ban lãnh
  // đạo. Nhiệm vụ gốc của ca này tích TẮT ⇒ TP là chặng cuối: nút gửi bị ẩn, gọi thẳng nhận 409 (ca
  // TC-V8-01b bên dưới pin luật đó). Nửa sau ở đây đứng trên nhiệm vụ BẬT tích để giữ đúng ý khảo sát.
  const trinhBld = await taskCreate({ name: 'TC V8 trình BLĐ', guiBldPheDuyet: true });
  const dau = await upload(nvApi, trinhBld);
  expect(dau.status, JSON.stringify(dau.body)).toBe(200);
  const two = await upload(tpApi, trinhBld, dau.body.data.nhom.id);
  expect(two.status).toBe(200);
  expect(two.body.data.nhom.trang_thai).toBe('luu-tam');
  const gui = await tpApi.post('/api/v1/task-files/' + dau.body.data.nhom.id + '/gui-di-duyet');
  expect(gui.status, JSON.stringify(gui.body)).toBe(200);
  expect(gui.body.data.nhom.trang_thai).toBe('cho-lanh-dao');
  expect(
    (await pgdApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((f) => f.id)
  ).toContain(dau.body.data.nhom.id);
});

it('TC-V8-01b (MỚI-6): tích TẮT ⇒ TP nộp hộ KHÔNG còn «Gửi đi duyệt», chỉ còn chốt «Hoàn thành»', async () => {
  // 12/09/2026 — người dùng báo trên CV002: nhiệm vụ KHÔNG tích «Gửi BLĐ phê duyệt» mà TP sửa trực
  // tuyến rồi vẫn thấy nút «Gửi đi duyệt», bấm là file chạy lên Phó GĐ. Nay TP/PP là CHẶNG CUỐI của
  // nhiệm vụ không phải trình: nút gửi bị ẩn, gọi thẳng REST nhận 409 nói đúng lý do, và hàng nút chỉ
  // còn «Hoàn thành / Duyệt» — mở cả ở trạng thái `luu-tam` để bản nháp do chính họ tạo có đường ra.
  const dau = await upload(nvApi);
  expect(dau.status, JSON.stringify(dau.body)).toBe(200);
  const nhomId = dau.body.data.nhom.id;
  const two = await upload(tpApi, task, nhomId);
  expect(two.status, JSON.stringify(two.body)).toBe(200);
  const gui = await tpApi.post('/api/v1/task-files/' + nhomId + '/gui-di-duyet');
  expect(gui.status, JSON.stringify(gui.body)).toBe(409);
  expect(gui.body.error.message).toContain('bạn là chặng cuối');
  const doc = (await tpApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom.find(
    (n) => n.id === nhomId
  );
  expect(doc.duocGuiDuyet).toBe(false);
  expect(doc.hanhDong.map((h) => h.ma)).toEqual(['hoan-thanh']);
  const chot = await tpApi.post('/api/v1/task-files/' + nhomId + '/verdict', {
    hanhDong: 'hoan-thanh',
  });
  expect(chot.status, JSON.stringify(chot.body)).toBe(200);
  expect(chot.body.data.nhom.trang_thai).toBe('hoan-thanh');
  // Phó GĐ KHÔNG bị lôi vào: nhiệm vụ không trình Ban lãnh đạo thì hàng chờ của họ phải trống.
  expect(
    (await pgdApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((f) => f.id)
  ).not.toContain(nhomId);
});

it('TC-V8-01c (MỚI-6): nhóm `luu-tam` CHƯA có bản nào thì không hiện nút chốt và bấm thẳng bị 409', async () => {
  // Q1 cho KHAI tên · định dạng · tỷ lệ trước khi có file. `hoan-thanh` nay mở ở `luu-tam` nên phải có
  // rào này, nếu không một dòng vừa khai đã bị chốt lên 100% mà chưa có kết quả nào để đọc.
  const r = await nvApi.post('/api/v1/work-items/' + task.code + '/results', {
    tenKetQua: 'Báo cáo chưa có file',
    dinhDang: 'Word',
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const nhomId = r.body.data.nhom.id;
  const doc = (await tpApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom.find(
    (n) => n.id === nhomId
  );
  expect(doc.bans ?? []).toHaveLength(0);
  expect((doc.hanhDong || []).map((h) => h.ma)).not.toContain('hoan-thanh');
  const chot = await tpApi.post('/api/v1/task-files/' + nhomId + '/verdict', {
    hanhDong: 'hoan-thanh',
  });
  expect(chot.status, JSON.stringify(chot.body)).toBe(409);
  expect(chot.body.error.message).toContain('chưa có bản nào được lưu');
});

it('TC-V4-01: tải file mới chỉ lưu tạm, không thông báo và chỉ creator/admin thấy bản nháp', async () => {
  const r = await upload();
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const f = r.body.data.nhom;
  expect(f.trang_thai).toBe('luu-tam');
  expect(
    (await pool.query('SELECT trang_thai FROM task_files WHERE id=$1', [f.id])).rows[0].trang_thai
  ).toBe('luu-tam');
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM notifications WHERE ref_type='task_file' AND ref_id=$1",
        [f.id]
      )
    ).rows[0].n
  ).toBe(0);
  expect(
    (await tpApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((x) => x.id)
  ).not.toContain(f.id);
  expect(
    (await ppApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((x) => x.id)
  ).not.toContain(f.id);
  expect(
    (await pgdApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((x) => x.id)
  ).not.toContain(f.id);
  expect(
    (await nvApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((x) => x.id)
  ).toContain(f.id);
  expect(
    (await adminApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((x) => x.id)
  ).toContain(f.id);
});
it('TC-V4-02: chủ bản nháp được gửi, TP không phải chủ không được gửi hộ; gửi xong mới đổi trạng thái và tạo hàng chờ/thông báo', async () => {
  const r = await upload();
  const f = r.body.data.nhom;
  const bi = await tpApi.post('/api/v1/task-files/' + f.id + '/gui-di-duyet');
  expect(bi.status).toBe(403);
  const go = await nvApi.post('/api/v1/task-files/' + f.id + '/gui-di-duyet');
  expect(go.status, JSON.stringify(go.body)).toBe(200);
  expect(go.body.data.nhom.trang_thai).toBe('cho-xem');
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM notifications WHERE ref_type='task_file' AND ref_id=$1",
        [f.id]
      )
    ).rows[0].n
  ).toBeGreaterThan(0);
  expect(
    (await tpApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((x) => x.id)
  ).toContain(f.id);
  expect(
    (await nvApi.get('/api/v1/task-files/cho-duyet')).body.data.items.map((x) => x.id)
  ).not.toContain(f.id);
  expect(
    (
      await pool.query('SELECT hanh_dong FROM task_file_flow WHERE file_id=$1 ORDER BY id', [f.id])
    ).rows.map((x) => x.hanh_dong)
  ).toEqual(['luu-tam', 'gui-duyet']);
});
it('TC-V4-03: bản trả lời lệnh sửa đi thẳng vào trạng thái hợp lệ, không qua luu-tam', async () => {
  const first = await upload();
  const f = first.body.data.nhom;
  expect((await nvApi.post('/api/v1/task-files/' + f.id + '/gui-di-duyet')).status).toBe(200);
  const back = await tpApi.post('/api/v1/task-files/' + f.id + '/verdict', {
    hanhDong: 'tra-ve-cbo',
    noiDung: 'Vui lòng sửa lại nội dung bản này',
  });
  expect(back.status, JSON.stringify(back.body)).toBe(200);
  const replacement = await upload(nvApi, task, f.id, 'ban-sua.pdf', 'application/pdf');
  expect(replacement.status, JSON.stringify(replacement.body)).toBe(200);
  expect(replacement.body.data.nhom.trang_thai).toBe('cho-xem');
  expect(
    (await pool.query('SELECT trang_thai FROM task_files WHERE id=$1', [f.id])).rows[0].trang_thai
  ).toBe('cho-xem');
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM task_file_flow WHERE file_id=$1 AND version_id=$2 AND hanh_dong='luu-tam'",
        [f.id, replacement.body.data.ban.id]
      )
    ).rows[0].n
  ).toBe(0);
});
it('TC-V4-04: báo cáo chữ cũng lưu tạm và chỉ gửi luồng khi bấm gửi đi duyệt', async () => {
  const r = await nvApi.post('/api/v1/work-items/' + task.code + '/reports', {
    noiDung: 'Nội dung báo cáo đủ dài để kiểm tra V4',
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const f = r.body.data.nhom.id;
  expect(r.body.data.nhom.trang_thai).toBe('luu-tam');
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM notifications WHERE ref_type='task_file' AND ref_id=$1",
        [f]
      )
    ).rows[0].n
  ).toBe(0);
  const go = await nvApi.post('/api/v1/task-files/' + f + '/gui-di-duyet');
  expect(go.status, JSON.stringify(go.body)).toBe(200);
  expect(go.body.data.nhom.trang_thai).toBe('cho-xem');
});
it('TC-V2-01: nhóm file chia đều, sửa tỷ lệ lệch tổng vẫn lưu và gia quyền đúng', async () => {
  const a = await upload(),
    b = await upload();
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  const fa = a.body.data.nhom.id,
    fb = b.body.data.nhom.id;
  const rows = (await nvApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom;
  expect(rows.map((f) => f.ty_le)).toEqual([50, 50]);
  const changed = await nvApi.patch('/api/v1/task-files/' + fa + '/ty-le', { tyLe: 70 });
  expect(changed.status, JSON.stringify(changed.body)).toBe(200);
  // ĐỢT B (R4''): cây đã duyệt nên lời gọi này là MỘT ĐỀ NGHỊ — `ty_le` chưa đổi, tổng vẫn 100.
  expect(changed.body.data.tyLeChange.pending).toBe(true);
  expect(changed.body.data.tongTyLe).toBe(100);
  const quyet = await pgdApi.post(
    '/api/v1/approvals/changes/' + changed.body.data.tyLeChange.id + '/approve',
    {}
  );
  expect(quyet.status, JSON.stringify(quyet.body)).toBe(200);
  // Được duyệt rồi mới ghi: tổng LỆCH 120 vẫn lưu đúng luật cũ (`updateFileWeights` không ép về 100),
  // và nhóm kia không bị đụng.
  expect(
    (await nvApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom.map(
      (f) => f.ty_le
    )
  ).toEqual([70, 50]);
  await pool.query(
    "UPDATE task_files SET trang_thai=CASE WHEN id=$1 THEN 'da-duyet' ELSE 'can-sua' END WHERE id=ANY($2::bigint[])",
    [fa, [fa, fb]]
  );
  const { demNhomFileTheoItem } = await import('../../src/modules/taskFiles/repo.js');
  const { ganTienDo } = await import('../../src/modules/workItems/tienDo.js');
  const result = ganTienDo([{ id: task.id, level: 3 }], await demNhomFileTheoItem());
  expect(result[0].tien_do).toBe(67); // (70*100+50*20)/120=66,67
  expect((await ppApi.patch('/api/v1/task-files/' + fa + '/ty-le', { tyLe: 10 })).status).toBe(403);
  expect((await nvApi.patch('/api/v1/task-files/' + fa + '/ty-le', { tyLe: -1 })).status).toBe(400);
});
it('TC-V2-02: cấu hình đọc mọi vai, ghi chỉ admin và có hiệu lực request kế tiếp', async () => {
  const r = await nvApi.get('/api/v1/permissions/settings');
  expect(r.status).toBe(200);
  expect(r.body.data.fileProgress.canSua).toBe(20);
  expect(
    (await nvApi.put('/api/v1/permissions/settings', { fileProgress: { canSua: 25 } })).status
  ).toBe(403);
  const w = await adminApi.put('/api/v1/permissions/settings', { fileProgress: { canSua: 25 } });
  expect(w.status, JSON.stringify(w.body)).toBe(200);
  expect((await nvApi.get('/api/v1/permissions/settings')).body.data.fileProgress.canSua).toBe(25);
  for (const canSua of [101, -1, '20', 60]) {
    const bad = await adminApi.put('/api/v1/permissions/settings', { fileProgress: { canSua } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toContain('Cần sửa');
  }
  expect((await nvApi.get('/api/v1/permissions/settings')).body.data.fileProgress.canSua).toBe(25);
});

it('TC-V2-03: thay mốc ảnh hưởng tiến độ ở request kế tiếp, giữ bộ đếm nhị phân', async () => {
  const a = await upload();
  expect(a.status).toBe(200);
  const f = a.body.data.nhom;
  await pool.query("UPDATE task_files SET trang_thai='can-sua' WHERE id=$1", [f.id]);
  const { demNhomFileTheoItem } = await import('../../src/modules/taskFiles/repo.js');
  expect((await demNhomFileTheoItem()).get(String(task.id))).toMatchObject({
    tong: 1,
    xong: 0,
    tongTyLe: 100,
    tienDoCoTrongSo: 2000,
  });
  expect(
    (await adminApi.put('/api/v1/permissions/settings', { fileProgress: { canSua: 25 } })).status
  ).toBe(200);
  expect(
    (await nvApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom[0].tienDo
  ).toBe(25);
  expect((await demNhomFileTheoItem()).get(String(task.id))).toMatchObject({
    tong: 1,
    xong: 0,
    tienDoCoTrongSo: 2500,
  });
});
it('TC-V2-04: tiến độ modal khớp tổng hợp khi TP nộp hộ, phân biệt với đã trình', async () => {
  // 12/09/2026 — BẢN ĐẦU của một nhóm chỉ người thực hiện trực tiếp nộp được, nên «TP nộp hộ» nay bắt
  // đầu từ BẢN HAI: cán bộ nộp bản 1, TP nộp hộ bản 2. Nhánh tiến độ ca này khảo sát không đổi, vì
  // `lanh_dao_tu_lam` đọc vai của người nộp BẢN CUỐI (`v`/`vu` trong `tienDoFileRows`) — bản cuối vẫn
  // là của TP, và nó lật sang false đúng khi có dòng luồng `tp-phe-duyet`.
  // MỚI-6 (12/09/2026): ca này khảo sát nhánh «TP nộp hộ rồi TRÌNH lên Phó GĐ» (`cho-lanh-dao` ⇒ 50%),
  // mà nhánh đó nay chỉ còn khi nhiệm vụ THẬT SỰ phải trình Ban lãnh đạo. Nhiệm vụ mặc định của bộ
  // test tích TẮT ⇒ TP là chặng cuối, nút gửi bị ẩn (TC-V8-01b) — nên đứng trên nhiệm vụ BẬT tích.
  const trinhBld = await taskCreate({ name: 'TC V2-04 trình BLĐ', guiBldPheDuyet: true });
  expect((await upload(tpApi, trinhBld)).status).toBe(403);
  const dau = await upload(nvApi, trinhBld);
  expect(dau.status, JSON.stringify(dau.body)).toBe(200);
  const a = await upload(tpApi, trinhBld, dau.body.data.nhom.id);
  expect(a.status, JSON.stringify(a.body)).toBe(200);
  const f = a.body.data.nhom;
  expect((await tpApi.post('/api/v1/task-files/' + f.id + '/gui-di-duyet')).status).toBe(200);
  const { tienDoFileRows } = await import('../../src/modules/taskFiles/repo.js');
  expect((await tienDoFileRows(trinhBld.id))[0].tienDo).toBe(50);
  expect(
    (await tpApi.get('/api/v1/work-items/' + trinhBld.code + '/files')).body.data.nhom[0].tienDo
  ).toBe(50);
  await pool.query(
    "INSERT INTO task_file_flow(file_id,version_id,nguoi_id,vai,hanh_dong,noi_dung) VALUES($1,$2,$3,'Trưởng phòng','tp-phe-duyet','Đã xem và trình')",
    [f.id, a.body.data.ban.id, tp.id]
  );
  expect((await tienDoFileRows(trinhBld.id))[0].tienDo).toBe(80);
  expect(
    (await tpApi.get('/api/v1/work-items/' + trinhBld.code + '/files')).body.data.nhom[0].tienDo
  ).toBe(80);
});
it('TC-V2-05: thêm nhóm không mất tỷ lệ tay; hai admin không ghi đè mốc khác nhau', async () => {
  const a = await upload(),
    f = a.body.data.nhom;
  const add = await upload();
  expect(add.status).toBe(200);
  // ĐỢT B (R4''): sửa tỷ lệ trên cây đã duyệt là MỘT ĐỀ NGHỊ; lượt ghi thật nằm trong giao dịch của
  // `decideTyLe` (khoá `works` rồi mới khoá nhóm file), nên thêm nhóm xen giữa không làm mất con số
  // tay — hai lượt đó không thể giẫm nhau như bản ghi thẳng cũ.
  const edit = await nvApi.patch('/api/v1/task-files/' + f.id + '/ty-le', { tyLe: 70 });
  expect(edit.status, JSON.stringify(edit.body)).toBe(200);
  expect(edit.body.data.tyLeChange.pending).toBe(true);
  const quyet = await pgdApi.post(
    '/api/v1/approvals/changes/' + edit.body.data.tyLeChange.id + '/approve',
    {}
  );
  expect(quyet.status, JSON.stringify(quyet.body)).toBe(200);
  expect((await pool.query('SELECT ty_le FROM task_files WHERE id=$1', [f.id])).rows[0].ty_le).toBe(
    70
  );
  const results = await Promise.all([
    adminApi.put('/api/v1/permissions/settings', { fileProgress: { canSua: 25 } }),
    adminApi.put('/api/v1/permissions/settings', { fileProgress: { canBoGuiBld: 45 } }),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect((await nvApi.get('/api/v1/permissions/settings')).body.data.fileProgress).toMatchObject({
    canSua: 25,
    canBoGuiBld: 45,
  });
});
it('TC-V2-06: khai trước không có bản tính 0%; xóa tự chia lại và từ chối số giả', async () => {
  const a = await nvApi.post('/api/v1/work-items/' + task.code + '/results', {
    tenKetQua: 'Khai trước',
    dinhDang: 'Word',
  });
  expect(a.status).toBe(200);
  const b = await upload();
  expect(b.status).toBe(200);
  const rows = (await nvApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom;
  expect(rows[0]).toMatchObject({ ty_le: 50, tienDo: 0 });
  expect(
    (
      await nvApi.agent
        .delete('/api/v1/task-files/' + b.body.data.nhom.id)
        .set('x-csrf-token', await nvApi.csrfToken())
    ).status
  ).toBe(200);
  expect(
    (await nvApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom[0].ty_le
  ).toBe(100);
  for (const tyLe of ['30', null, 1.2, 101, -1])
    expect(
      (await nvApi.patch('/api/v1/task-files/' + a.body.data.nhom.id + '/ty-le', { tyLe })).status
    ).toBe(400);
  await override('Nhân viên', 'file', 'create', 'tu-choi');
  expect(
    (await nvApi.patch('/api/v1/task-files/' + a.body.data.nhom.id + '/ty-le', { tyLe: 50 })).status
  ).toBe(403);
});

it('TC-V3-01: khai Word chặn PDF và báo cáo chữ; bản mới đúng Word được nhận', async () => {
  const decl = await nvApi.post('/api/v1/work-items/' + task.code + '/results', {
    tenKetQua: 'Nhóm Word',
    dinhDang: 'Word',
  });
  expect(decl.status).toBe(200);
  const id = decl.body.data.nhom.id;
  const bad = await upload(nvApi, task, id);
  expect(bad.status).toBe(400);
  expect(bad.body.error.message).toContain('nhóm này khai Word, chỉ nhận .doc/.docx');
  const report = await nvApi.post('/api/v1/work-items/' + task.code + '/reports', {
    fileId: id,
    noiDung: 'Đây là bản báo cáo chữ',
  });
  expect(report.status).toBe(400);
  expect(
    (await pool.query('SELECT count(*)::int AS n FROM task_file_versions WHERE file_id=$1', [id]))
      .rows[0].n
  ).toBe(0);
  const good = await upload(
    nvApi,
    task,
    id,
    'kết quả.DOCX',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  expect(good.status).toBe(200);
});
it('TC-V3-02: tạo nhóm mới qua multipart không được khai Word rồi tải PDF', async () => {
  const r = await nvApi.agent
    .post('/api/v1/work-items/' + task.code + '/files')
    .set('x-csrf-token', await nvApi.csrfToken())
    .field('dinhDang', 'Word')
    .attach('file', Buffer.from('%PDF-1.4 test'), {
      filename: 'sai.pdf',
      contentType: 'application/pdf',
    });
  expect(r.status).toBe(400);
  expect((await pool.query('SELECT count(*)::int AS n FROM task_files')).rows[0].n).toBe(0);
});
it('TC-V3-03: dòng cũ sai định dạng vẫn xem được; save/callback phải chặn tạo bản mới', async () => {
  const r = await upload(
    nvApi,
    task,
    null,
    'bản.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  expect(r.status).toBe(200);
  const { ban, nhom } = r.body.data;
  await pool.query("UPDATE task_files SET dinh_dang='Excel' WHERE id=$1", [nhom.id]);
  expect((await nvApi.get('/api/v1/task-files/' + ban.id + '/download')).status).toBe(200);
  const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ error: 4 }),
    arrayBuffer: () => Promise.resolve(Buffer.from('new')),
  });
  const saved = await nvApi.post('/api/v1/task-file-versions/' + ban.id + '/save');
  expect(saved.status).toBe(400);
  expect(saved.body.error.message).toContain('Excel');
  expect(network).not.toHaveBeenCalled();
  const { luuTuCallback } = await import('../../src/modules/taskFiles/service.js');
  await expect(luuTuCallback(ban.id, 'http://onlyoffice.test/new', nv.id)).rejects.toThrow('Excel');
  expect(
    (
      await pool.query('SELECT count(*)::int AS n FROM task_file_versions WHERE file_id=$1', [
        nhom.id,
      ])
    ).rows[0].n
  ).toBe(1);
});
it('TC-V3-04: PDF chỉ xem, không sửa trực tuyến và không forcesave', async () => {
  const r = await upload();
  const ban = r.body.data.ban;
  const { moEditor } = await import('../../src/modules/taskFiles/service.js');
  const editor = await moEditor({ ...nv, ghiDe: {} }, ban.id);
  expect(editor.config.editorConfig.mode).toBe('view');
  expect(editor.duocSua).toBe(false);
  const save = await nvApi.post('/api/v1/task-file-versions/' + ban.id + '/save');
  expect(save.status).toBe(400);
  expect(save.body.error.message).toContain('PDF chỉ xem');
});

it('TC-V4-05: quyền gửi bị thu hồi có hiệu lực ngay, kể cả đường gửi bản đáp ứng lệnh sửa', async () => {
  const r = await upload();
  const f = r.body.data.nhom.id;
  await override('Nhân viên', 'file', 'submit', 'tu-choi');
  expect((await nvApi.post('/api/v1/task-files/' + f + '/gui-di-duyet')).status).toBe(403);
  expect((await nvApi.get('/api/v1/task-files/cho-duyet')).body.data.items[0].duocGuiDuyet).toBe(
    false
  );
  await override('Nhân viên', 'file', 'submit', 'cho-phep');
  expect((await nvApi.post('/api/v1/task-files/' + f + '/gui-di-duyet')).status).toBe(200);
  expect(
    (
      await tpApi.post('/api/v1/task-files/' + f + '/verdict', {
        hanhDong: 'tra-ve-cbo',
        noiDung: 'Bổ sung số liệu và giải trình',
      })
    ).status
  ).toBe(200);
  await override('Nhân viên', 'file', 'submit', 'tu-choi');
  expect((await nvApi.post('/api/v1/task-files/' + f + '/gui-ban-moi')).status).toBe(403);
  expect((await upload(nvApi, task, f)).status).toBe(403);
  expect(
    (await pool.query('SELECT count(*)::int AS n FROM task_file_versions WHERE file_id=$1', [f]))
      .rows[0].n
  ).toBe(1);
  expect(
    (await pool.query('SELECT trang_thai FROM task_files WHERE id=$1', [f])).rows[0].trang_thai
  ).toBe('can-sua');
});
it('TC-V4-06: gửi đồng thời chỉ một lượt thành công; không gửi nhóm 0 bản hay bản cũ', async () => {
  const khai = await nvApi.post('/api/v1/work-items/' + task.code + '/results', {
    tenKetQua: 'Khai trước',
  });
  expect(khai.status).toBe(200);
  expect(
    (await nvApi.post('/api/v1/task-files/' + khai.body.data.nhom.id + '/gui-di-duyet')).status
  ).toBe(409);
  const first = await upload(),
    id = first.body.data.nhom.id;
  expect((await upload(nvApi, task, id)).status).toBe(200);
  expect(
    (
      await nvApi.post('/api/v1/task-files/' + id + '/gui-di-duyet', {
        versionId: first.body.data.ban.id,
      })
    ).status
  ).toBe(409);
  const both = await Promise.all([
    nvApi.post('/api/v1/task-files/' + id + '/gui-di-duyet'),
    nvApi.post('/api/v1/task-files/' + id + '/gui-di-duyet'),
  ]);
  expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM task_file_flow WHERE file_id=$1 AND hanh_dong='gui-duyet'",
        [id]
      )
    ).rows[0].n
  ).toBe(1);
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM notifications WHERE ref_type='task_file' AND ref_id=$1",
        [id]
      )
    ).rows[0].n
  ).toBe(1);
});
it('TC-V4-07: không tự duyệt qua Lưu tạm; admin gửi hộ không biến bản NV thành đã duyệt', async () => {
  const r = await upload();
  const f = r.body.data.nhom.id;
  const adminGo = await adminApi.post('/api/v1/task-files/' + f + '/gui-di-duyet');
  expect(adminGo.status).toBe(200);
  expect(adminGo.body.data.nhom.trang_thai).toBe('cho-xem');
  await override('Trưởng phòng', 'file', 'create', 'cho-phep');
  const mine = await taskCreate({ assigneeId: tp.id });
  const own = await upload(tpApi, mine);
  expect(own.body.data.nhom.trang_thai).toBe('luu-tam');
  const id = own.body.data.nhom.id;
  // MỚI-6 (12/09/2026): `hoan-thanh` nay MỞ ở `luu-tam` (TP/PP là chặng cuối trên nhiệm vụ tích TẮT
  // thì bản nháp của họ phải có đường ra), nên ca «không tự duyệt qua Lưu tạm» không còn bị chặn bởi
  // trạng thái nữa mà bị chặn bởi VAN CHỐNG TỰ DUYỆT — TP ở đây chính là `assignee_id` của nhiệm vụ.
  // Đổi 409 → 403 là đúng bản chất: bị cấm vì là người thực hiện, không phải vì trạng thái không hợp lệ.
  const tuChot = await tpApi.post('/api/v1/task-files/' + id + '/verdict', {
    hanhDong: 'hoan-thanh',
  });
  expect(tuChot.status).toBe(403);
  expect(tuChot.body.error.message).toContain('không được tự chốt kết quả của chính mình');
  const sent = await tpApi.post('/api/v1/task-files/' + id + '/gui-di-duyet');
  expect(sent.body.data.nhom.trang_thai).toBe('cho-lanh-dao');
  expect(
    (
      await tpApi.post('/api/v1/task-files/' + id + '/verdict', {
        hanhDong: 'tra-ve-cbo',
        // ĐIỂM 9 (ĐỢT B): nút này nay BẮT BUỘC ghi lý do — trả việc về mà không nói vì sao là
        // đúng cái bất hợp lý đang dọn.
        noiDung: 'Bổ sung phần kết luận rồi gửi lại',
      })
    ).status
  ).toBe(200);
  expect(
    (await tpApi.post('/api/v1/task-files/' + id + '/verdict', { hanhDong: 'hoan-thanh' })).status
  ).toBe(403);
  expect(
    (await tpApi.get('/api/v1/task-files/cho-duyet')).body.data.items
      .find((f) => f.id === id)
      ?.hanhDong.map((h) => h.ma)
  ).not.toContain('hoan-thanh');
});
it('TC-V4-08: R6 — ✓ create của NV KHÔNG còn tự duyệt sau gửi; ⏳ submit vẫn bị cấm ở Bảng phân quyền', async () => {
  await override('Nhân viên', 'file', 'create', 'cho-phep');
  const a = await upload();
  expect(a.body.data.nhom.trang_thai).toBe('luu-tam');
  // Luật cũ: ✓ ở «Tạo file kết quả» nghĩa là «không yêu cầu duyệt» ⇒ gửi đi là TỰ chốt «da-duyet».
  // R6 bỏ hẳn quyền tự duyệt: ✓ chỉ còn nghĩa «được phép khai/nộp», nên bản của NV vẫn dừng ở
  // «cho-xem» chờ TP/PP — không còn nhánh nào tự ký thay người khác.
  expect(
    (await nvApi.post('/api/v1/task-files/' + a.body.data.nhom.id + '/gui-di-duyet')).body.data.nhom
      .trang_thai
  ).toBe('cho-xem');
  await override('Nhân viên', 'file', 'submit', 'cho-duyet');
  const b = await upload();
  expect(
    (await nvApi.post('/api/v1/task-files/' + b.body.data.nhom.id + '/gui-di-duyet')).body.data.nhom
      .trang_thai
  ).toBe('cho-xem');
  expect(
    (
      await adminApi.put('/api/v1/permissions', {
        thayDoi: [{ vai: 'Nhân viên', entityType: 'task', action: 'submit', giaTri: 'cho-phep' }],
      })
    ).status
  ).toBe(400);
});

it('TC-V4-09: TP tải bản mới sau lượt trình cũ phải về 50%, không mang nhầm mốc 80%', async () => {
  // Q6 (ĐỢT B): ca này đo mốc tiến độ SAU MỘT LƯỢT TRÌNH, nên phải có nút «TP/PP phê duyệt» —
  // tức nhiệm vụ bật tích «Gửi BLĐ phê duyệt» (fixture `task` chung để tích TẮT).
  const trinh = await taskCreate({ guiBldPheDuyet: true });
  const r = await upload(nvApi, trinh);
  const id = r.body.data.nhom.id;
  const gui = await nvApi.post('/api/v1/task-files/' + id + '/gui-di-duyet');
  expect(gui.status, JSON.stringify(gui.body)).toBe(200);
  expect(
    (
      await tpApi.post('/api/v1/task-files/' + id + '/verdict', {
        hanhDong: 'tp-phe-duyet',
        noiDung: 'Trình lãnh đạo duyệt bản đầu',
      })
    ).status
  ).toBe(200);
  const moi = await upload(tpApi, trinh, id);
  expect(moi.body.data.nhom.trang_thai).toBe('luu-tam');
  expect((await tpApi.post('/api/v1/task-files/' + id + '/gui-di-duyet')).status).toBe(200);
  const doc = await tpApi.get('/api/v1/work-items/' + trinh.code + '/files');
  expect(doc.body.data.nhom[0].tienDo).toBe(50);
});

it('TC-V5-01: modal và hai hàng chờ trả đúng người sửa, đếm chính xác hai lần trả', async () => {
  const r = await upload();
  const id = r.body.data.nhom.id;
  expect((await nvApi.post('/api/v1/task-files/' + id + '/gui-di-duyet')).status).toBe(200);
  for (let n = 1; n <= 2; n++) {
    expect(
      (
        await tpApi.post('/api/v1/task-files/' + id + '/verdict', {
          hanhDong: 'tra-ve-cbo',
          noiDung: 'Bổ sung số liệu và kết luận đầy đủ',
        })
      ).status
    ).toBe(200);
    const modal = (await nvApi.get('/api/v1/work-items/' + task.code + '/files')).body.data.nhom[0];
    const queue = (await tpApi.get('/api/v1/task-files/cho-duyet')).body.data.items.find(
      (x) => x.id === id
    );
    const order = (await nvApi.get('/api/v1/task-files/lenh-sua')).body.data.items.find(
      (x) => x.id === id
    );
    expect(order.duocGui).toBe(true);
    for (const row of [modal, queue, order]) {
      expect(row).toMatchObject({ trang_thai: 'can-sua', soTraLai: n });
      expect(row.nguoiNhan).toEqual([nv.full_name]);
    }
    if (n === 1)
      expect((await nvApi.post('/api/v1/task-files/' + id + '/gui-ban-moi')).status).toBe(200);
  }
});
it.each(['Trưởng phòng', 'Phó phòng'])(
  'TC-V5-02: %s tự thực hiện vẫn nhận lệnh can-bo/lãnh đạo và giữ đủ quyền sửa',
  async (role) => {
    const who = role === 'Trưởng phòng' ? tp : pp;
    const api = role === 'Trưởng phòng' ? tpApi : ppApi;
    const item = await taskCreate({ assigneeId: who.id, leaderIds: [who.id] });
    const r = await upload(api, item);
    const id = r.body.data.nhom.id;
    expect((await api.post('/api/v1/task-files/' + id + '/gui-di-duyet')).status).toBe(200);
    expect(
      (
        await pgdApi.post('/api/v1/task-files/' + id + '/verdict', {
          hanhDong: 'tra-ve-tp',
          noiDung: 'Cần sửa lại phần kết luận của bản này',
        })
      ).status
    ).toBe(200);
    // Máy chủ vốn không gác lệnh can-bo theo vai Nhân viên: đối chứng hành động trước trường mới.
    expect(
      (
        await api.post('/api/v1/task-files/' + id + '/verdict', {
          hanhDong: 'tra-ve-cbo',
          noiDung: 'Giao lại cán bộ sửa phần số liệu',
        })
      ).status
    ).toBe(200);
    const order = (await api.get('/api/v1/task-files/lenh-sua')).body.data.items.find(
      (x) => x.id === id
    );
    expect(order).toMatchObject({ duocSua: true, duocGui: true, lenh_sua_cho: 'can-bo' });
    const modal = (await api.get('/api/v1/work-items/' + item.code + '/files')).body.data.nhom[0];
    expect(modal.hanhDong.map((x) => x.ma)).not.toContain('hoan-thanh');
    for (const row of [order, modal]) {
      expect(row.nguoiNhan).toEqual([who.full_name + ' (' + role + ')']);
      expect(row.soTraLai).toBe(2);
    }
  }
);

it.each(['Trưởng phòng', 'Phó phòng'])(
  'TC-V5-03: %s là người sửa trực tiếp khác lãnh đạo phụ trách không bị mất nút sửa/gửi',
  async (role) => {
    const who = role === 'Trưởng phòng' ? tp : pp;
    const api = role === 'Trưởng phòng' ? tpApi : ppApi;
    const leader = role === 'Trưởng phòng' ? pp : tp;
    const leaderApi = role === 'Trưởng phòng' ? ppApi : tpApi;
    const item = await taskCreate({ assigneeId: who.id, leaderIds: [leader.id] });
    // Bản đầu do CHÍNH người thực hiện trực tiếp nộp (`who` vừa là TP/PP vừa là `assigneeId` của nhiệm
    // vụ này) — 12/09/2026 máy chủ không cho ai khác, kể cả Giám đốc, nộp bản 1 thay.
    const initial = await upload(api, item);
    expect(initial.status, JSON.stringify(initial.body)).toBe(200);
    const id = initial.body.data.nhom.id;
    // Giám đốc vẫn gửi được bản lưu tạm của người khác (`duocGuiBanLuu` tha `user.role === 'admin'`).
    expect((await adminApi.post('/api/v1/task-files/' + id + '/gui-di-duyet')).status).toBe(200);
    expect(
      (
        await pgdApi.post('/api/v1/task-files/' + id + '/verdict', {
          hanhDong: 'tra-ve-tp',
          noiDung: 'Trả lãnh đạo giao đúng người sửa',
        })
      ).status
    ).toBe(200);
    expect(
      (
        await leaderApi.post('/api/v1/task-files/' + id + '/verdict', {
          hanhDong: 'tra-ve-cbo',
          noiDung: 'Giao đúng người sửa trực tiếp làm lại',
        })
      ).status
    ).toBe(200);
    const row = (await api.get('/api/v1/task-files/lenh-sua')).body.data.items.find(
      (x) => x.id === id
    );
    expect(row).toMatchObject({ duocSua: true, duocGui: true, lenh_sua_cho: 'can-bo' });
    const fixed = await upload(api, item, id);
    expect(fixed.status, JSON.stringify(fixed.body)).toBe(200);
    expect(fixed.body.data.nhom.trang_thai).toBe('cho-lanh-dao');
    expect(
      (await api.post('/api/v1/task-files/' + id + '/verdict', { hanhDong: 'hoan-thanh' })).status
    ).toBe(403);
  }
);

/**
 * Nộp một bản Word rồi gửi đi duyệt; `denPgd` thì TP bấm «TP/PP phê duyệt» để đưa lên Ban lãnh đạo.
 *
 * Q6 (ĐỢT B, 11/09/2026): nút «TP/PP phê duyệt» chỉ tồn tại khi nhiệm vụ bật tích «Gửi BLĐ phê
 * duyệt», nên ca nào cần `denPgd` phải truyền một nhiệm vụ đã bật tích (`taskCreate({
 * guiBldPheDuyet: true })`) — fixture `task` chung để tích TẮT.
 */
async function wordChoDuyet(denPgd = false, item = task) {
  const r = await upload(
    nvApi,
    item,
    null,
    'kết quả.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  expect(r.status).toBe(200);
  const { nhom, ban } = r.body.data;
  expect((await nvApi.post('/api/v1/task-files/' + nhom.id + '/gui-di-duyet')).status).toBe(200);
  if (denPgd)
    expect(
      (
        await tpApi.post('/api/v1/task-files/' + nhom.id + '/verdict', {
          hanhDong: 'tp-phe-duyet',
          noiDung: 'Trình lãnh đạo kiểm tra',
        })
      ).status
    ).toBe(200);
  return { nhom, ban };
}
async function callbackWord(ban, user, maLuu = null) {
  const { tokenDs } = await import('../../src/modules/taskFiles/service.js');
  return nvApi.agent
    .post('/api/v1/task-files-ds/callback/' + ban.id + '?token=' + tokenDs('callback', ban.id))
    .send({
      status: 6,
      users: [String(user.id)],
      userdata: maLuu,
      url: 'http://onlyoffice.test/edited.docx',
    });
}
function mockWord() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(Buffer.from('bản đã sửa thật')),
  });
}
it('TC-V6-01: verdict gắn bản đã thấy; có callback mới thì bản stale bị 409, không chốt nhầm', async () => {
  // Q6 (ĐỢT B): muốn file lên tới PGĐ thì TP phải CÓ nút «TP/PP phê duyệt» ⇒ nhiệm vụ bật tích.
  const trinh = await taskCreate({ guiBldPheDuyet: true });
  const { nhom, ban } = await wordChoDuyet(true, trinh);
  mockWord();
  expect((await callbackWord(ban, pgd)).body).toEqual({ error: 0 });
  const stale = await pgdApi.post('/api/v1/task-files/' + nhom.id + '/verdict', {
    hanhDong: 'duyet',
    versionId: ban.id,
  });
  expect(stale.status, JSON.stringify(stale.body)).toBe(409);
  expect(
    (await pool.query('SELECT trang_thai FROM task_files WHERE id=$1', [nhom.id])).rows[0]
      .trang_thai
  ).toBe('cho-lanh-dao');
  const moi = (
    await pool.query(
      'SELECT id FROM task_file_versions WHERE file_id=$1 ORDER BY version_no DESC',
      [nhom.id]
    )
  ).rows[0];
  const ok = await pgdApi.post('/api/v1/task-files/' + nhom.id + '/verdict', {
    hanhDong: 'duyet',
    versionId: moi.id,
    noiDung: 'Đã duyệt bản mới',
  });
  expect(ok.status).toBe(200);
  expect(
    (
      await pool.query(
        "SELECT version_id FROM task_file_flow WHERE file_id=$1 AND hanh_dong='duyet'",
        [nhom.id]
      )
    ).rows[0].version_id
  ).toBe(moi.id);
});
it('TC-V6-02: trang duyệt nhận quyền thật; TP sửa phải trình, PGĐ có nút duyệt bản mới', async () => {
  // Q6 (ĐỢT B): chạy ca này trên nhiệm vụ BẬT tích «Gửi BLĐ phê duyệt» — đó là trường hợp TP bắt buộc
  // phải trình, và cũng là trường hợp trang editor còn nút «Phê duyệt bản mới vừa chỉnh sửa».
  // (Van chống tự duyệt nay NỚI: chỉ chặn khi người bấm là NGƯỜI THỰC HIỆN, nên «TP vừa lưu bản cuối»
  // một mình nó không còn làm mất nút chốt khi tích TẮT — ca đó có ở `phase8d-dot-b.test.js`.)
  const trinh = await taskCreate({ guiBldPheDuyet: true });
  const { nhom, ban } = await wordChoDuyet(false, trinh);
  const tpPage = await tpApi.get('/api/v1/task-file-versions/' + ban.id + '/editor');
  expect(tpPage.status).toBe(200);
  expect(tpPage.text.includes('id="duyet-moi"')).toBe(true);
  expect(tpPage.text.includes('không tự Hoàn thành')).toBe(true);
  mockWord();
  expect((await callbackWord(ban, tp)).body).toEqual({ error: 0 });
  // Tích BẬT ⇒ «Hoàn thành / Duyệt» bị chặn ở máy chủ (403), bất kể ai vừa lưu bản nào.
  expect(
    (await tpApi.post('/api/v1/task-files/' + nhom.id + '/verdict', { hanhDong: 'hoan-thanh' }))
      .status
  ).toBe(403);
  expect(
    (
      await tpApi.post('/api/v1/task-files/' + nhom.id + '/verdict', {
        hanhDong: 'tp-phe-duyet',
        noiDung: 'Trình bản mới sau khi sửa',
      })
    ).status
  ).toBe(200);
  const pgdPage = await pgdApi.get('/api/v1/task-file-versions/' + ban.id + '/editor');
  expect(pgdPage.text.includes('id="duyet-moi"')).toBe(true);
  await override('Phó Giám đốc', 'file', 'approve', 'tu-choi');
  expect(
    (await pgdApi.get('/api/v1/task-file-versions/' + ban.id + '/editor')).text.includes(
      'id="duyet-moi"'
    )
  ).toBe(false);
  expect(
    (await pgdApi.post('/api/v1/task-files/' + nhom.id + '/verdict', { hanhDong: 'duyet' })).status
  ).toBe(403);
});
it('TC-V6-03: callback kiểm lại quyền đã thu hồi, không ghi bản hay luồng mới', async () => {
  const { nhom, ban } = await wordChoDuyet();
  mockWord();
  await override('Trưởng phòng', 'file', 'create', 'tu-choi');
  const cb = await callbackWord(ban, tp);
  expect(cb.body.error, JSON.stringify(cb.body)).toBe(1);
  expect(
    (await pool.query('SELECT count(*)::int n FROM task_file_versions WHERE file_id=$1', [nhom.id]))
      .rows[0].n
  ).toBe(1);
});
it('TC-V6-04: callback nháp không báo cho lãnh đạo trước khi gửi (Q5)', async () => {
  const r = await upload(
    nvApi,
    task,
    null,
    'kết quả.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  const { nhom, ban } = r.body.data;
  mockWord();
  expect((await callbackWord(ban, nv)).body).toEqual({ error: 0 });
  expect(
    (
      await pool.query(
        "SELECT count(*)::int n FROM notifications WHERE ref_type='task_file' AND ref_id=$1",
        [nhom.id]
      )
    ).rows[0].n
  ).toBe(0);
  expect(
    (await pool.query('SELECT trang_thai FROM task_files WHERE id=$1', [nhom.id])).rows[0]
      .trang_thai
  ).toBe('luu-tam');
});
it('TC-V6-05: save đợi callback thật, duyệt đúng receipt; quyền thu hồi sau save vẫn chặn', async () => {
  // Q6 (ĐỢT B): cần nút «TP/PP phê duyệt» để bản lên tới PGĐ ⇒ nhiệm vụ bật tích.
  const trinh = await taskCreate({ guiBldPheDuyet: true });
  const { nhom, ban } = await wordChoDuyet(true, trinh);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/command')) {
      const command = JSON.parse(options.body);
      expect(command.c).toBe('forcesave');
      expect((await callbackWord(ban, pgd, command.userdata)).body).toEqual({ error: 0 });
      return { ok: true, json: () => Promise.resolve({ error: 0 }) };
    }
    return { ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('nội dung đã sửa')) };
  });
  const saved = await pgdApi.post('/api/v1/task-file-versions/' + ban.id + '/save');
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  expect(saved.body.data).toMatchObject({ daLuu: true, versionNo: 2 });
  const versionId = saved.body.data.banId;
  await override('Phó Giám đốc', 'file', 'approve', 'tu-choi');
  expect(
    (
      await pgdApi.post('/api/v1/task-files/' + nhom.id + '/verdict', {
        hanhDong: 'duyet',
        versionId,
      })
    ).status
  ).toBe(403);
  await override('Phó Giám đốc', 'file', 'approve', 'cho-phep');
  expect(
    (
      await pgdApi.post('/api/v1/task-files/' + nhom.id + '/verdict', {
        hanhDong: 'duyet',
        versionId,
      })
    ).status
  ).toBe(200);
});

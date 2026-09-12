// ĐỢT B — bổ sung 12/09/2026: «NGƯỜI THỰC HIỆN TRỰC TIẾP MỚI ĐƯỢC NỘP BẢN ĐẦU».
//
// Người dùng báo: «Sửa lại, người thực hiện trực tiếp mới được upfile đầu tiên, hiện tại đang cho Tp
// up file đầu tiên». Lỗ hổng nằm ở `duocGhiTheoPhanCong`: nó mở cửa cho TP/PP **là lãnh đạo phụ
// trách** của nhiệm vụ, nên TP up được bản 1 thay cán bộ — kết quả của một nhiệm vụ mang chữ của
// người không làm ra nó. Luật mới (`assertNguoiNopBanDau` trong `taskFiles/service.js`):
//
//   BẢN SỐ 1 của một nhóm kết quả ⇒ bắt buộc đúng `work_items.assignee_id`.
//   MỌI BẢN SAU (sửa, nộp lại sau khi bị trả về, bản do người duyệt sửa trực tuyến) ⇒ luật cũ.
//
// Điều kiện viết theo SỐ BẢN chứ không theo «`fileId == null`», vì Q1 tách KHAI BÁO khỏi NỘP FILE:
// `khaiKetQua` tạo nhóm **0 bản**, nên một nhóm đã khai sẵn vẫn sinh bản số 1 khi có người nộp file
// đầu tiên vào nó. Hai đường sinh bản đều bị gác: `nop` (tải file) và `nopBaoCao` (bản chữ). Đường
// thứ ba, `luuTuCallback` của OnlyOffice, đòi một `ban` có sẵn ⇒ luôn từ bản 2 trở đi.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp().listen(0, '127.0.0.1');

let dept, admin, pgd, tp, pp, nv;
let adminApi, pgdApi, tpApi, ppApi, nvApi;
let work, sub, task;

const PDF = { ten: 'ket-qua.pdf', mime: 'application/pdf', noiDung: '%PDF-1.4 ban dau' };

async function login(u) {
  const api = client(app);
  await api.login(u.email);
  return api;
}

async function upload(api, maNhiemVu, { fileId = null } = {}) {
  let req = api.agent
    .post('/api/v1/work-items/' + encodeURIComponent(maNhiemVu) + '/files')
    .set('x-csrf-token', await api.csrfToken());
  if (fileId != null) req = req.field('fileId', String(fileId));
  return req.attach('file', Buffer.from(PDF.noiDung, 'binary'), {
    filename: PDF.ten,
    contentType: PDF.mime,
  });
}

/** Đường «Báo cáo» — một BẢN không có file, nội dung là chữ. Cũng sinh bản số 1 nên cũng bị gác. */
function nopBaoCao(api, maNhiemVu, over = {}) {
  return api.post('/api/v1/work-items/' + encodeURIComponent(maNhiemVu) + '/reports', {
    noiDung: 'Nội dung báo cáo đủ dài để qua kiểm tra độ dài tối thiểu',
    ...over,
  });
}

/** Nút ＋ — KHAI một dòng kết quả (tên · định dạng · tỷ lệ), nhóm sinh ra có 0 bản (Q1). */
function khai(api, maNhiemVu, over = {}) {
  return api.post('/api/v1/work-items/' + encodeURIComponent(maNhiemVu) + '/results', {
    tenKetQua: 'Báo cáo kết quả đợt B',
    dinhDang: 'PDF',
    ...over,
  });
}

/** Cả nhóm + quyền của chính người đang xem, đúng một lời gọi `GET /work-items/:ref/files`. */
async function docFiles(api, maNhiemVu) {
  const r = await api.get('/api/v1/work-items/' + encodeURIComponent(maNhiemVu) + '/files');
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
}

async function dem(bang) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${bang}`);
  return rows[0].n;
}

/**
 * Nhiệm vụ cấp 3 đã DUYỆT (Q2: cây chưa `Đã duyệt` thì mọi cửa nộp đều bị chặn, nên phải ký trước để
 * ca nào dưới đây cũng đứng trên một cây sẵn sàng và chỉ khảo sát đúng luật bản đầu).
 */
async function taoNhiemVu(over = {}) {
  const r = await tpApi.post('/api/v1/work-items', {
    workRef: work.code,
    level: 3,
    parentRef: sub.code,
    name: 'Nhiệm vụ bản đầu',
    assigneeId: nv.id,
    leaderIds: [tp.id],
    supervisorIds: [pgd.id],
    ...over,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const item = r.body.data.item;
  const ky = await pgdApi.post('/api/v1/approvals/work-item/' + item.code + '/approve');
  expect(ky.status, JSON.stringify(ky.body)).toBe(200);
  return item;
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
  ].entries()) {
    users.push(
      await makeLoginUser({
        code: 'NV00' + index,
        email: 'd' + index + '@test.local',
        full_name: role + ' bản đầu ' + index,
        role,
        department_id: index >= 2 ? dept.id : null,
      })
    );
  }
  [admin, pgd, tp, pp, nv] = users;
  for (const [u, role] of [
    [pgd, 'deputy_director'],
    [tp, 'head'],
    [pp, 'vice'],
  ]) {
    await pool.query(
      'INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,$3)',
      [dept.id, u.id, role]
    );
  }
  adminApi = await login(admin);
  pgdApi = await login(pgd);
  tpApi = await login(tp);
  ppApi = await login(pp);
  nvApi = await login(nv);

  const r = await tpApi.post('/api/v1/works', {
    name: 'Công việc bản đầu',
    departmentId: dept.id,
    supervisorIds: [pgd.id],
    leaderIds: [tp.id, pp.id],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  work = r.body.data.work;
  const con = await tpApi.post('/api/v1/work-items', {
    workRef: work.code,
    level: 2,
    name: 'Công việc con bản đầu',
    leaderIds: [tp.id, pp.id],
  });
  expect(con.status, JSON.stringify(con.body)).toBe(200);
  sub = con.body.data.item;
  // MỘT lời gọi ký trọn cây: `duyetCaCay` của `approvals/service.js` kéo theo mọi dòng con đang
  // «Chờ duyệt» (chốt 2026-08-31 — một quyết định cho cả cây).
  const kyCay = await pgdApi.post('/api/v1/approvals/work/' + work.code + '/approve');
  expect(kyCay.status, JSON.stringify(kyCay.body)).toBe(200);
  task = await taoNhiemVu();
});

afterAll(async () => {
  await new Promise((resolve) => app.close(resolve));
  await closePool();
});

describe('Bản ĐẦU của nhóm kết quả chỉ người thực hiện trực tiếp nộp được', () => {
  it('chính người thực hiện trực tiếp nộp bản 1 = 200, bản mang đúng tên người đó', async () => {
    const r = await upload(nvApi, task.code);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const { nhom, ban } = r.body.data;
    expect(ban.version_no).toBe(1);
    expect(String(ban.uploaded_by)).toBe(String(nv.id));
    expect(String(nhom.created_by)).toBe(String(nv.id));
    expect(await dem('task_file_versions')).toBe(1);
  });

  it('Trưởng phòng / Phó phòng là LÃNH ĐẠO PHỤ TRÁCH nộp bản 1 = 403, không để lại vết', async () => {
    // Cả hai vai đều được nêu ở ô «Lãnh đạo phòng phụ trách» của nhiệm vụ mình thử — tức là qua được
    // cửa cũ `duocGhiTheoPhanCong` và chỉ bị chặn bởi luật bản đầu mới.
    for (const [api, leader] of [
      [tpApi, tp],
      [ppApi, pp],
    ]) {
      const item = await taoNhiemVu({ leaderIds: [leader.id] });
      const r = await upload(api, item.code);
      expect(r.status, JSON.stringify(r.body)).toBe(403);
      expect(r.body.error).toMatchObject({ code: 'FORBIDDEN' });
      expect(r.body.error.message).toMatch(/Người thực hiện trực tiếp/);
      // Câu lỗi phải NÊU TÊN người được giao, để người bấm biết phải chuyển cho ai.
      expect(r.body.error.message).toContain(nv.full_name);
    }
    // Guard chạy TRƯỚC `mkdir`/`writeFile` và trong một giao dịch ⇒ không nhóm, không bản, không dòng
    // luồng nào sót lại sau hai lời gọi bị từ chối.
    expect(await dem('task_files')).toBe(0);
    expect(await dem('task_file_versions')).toBe(0);
    expect(await dem('task_file_flow')).toBe(0);
  });

  it('PGĐ và Giám đốc cũng không nộp bản 1 thay — cấp duyệt chỉ vào từ bản thứ hai', async () => {
    for (const api of [pgdApi, adminApi]) {
      const r = await upload(api, task.code);
      expect(r.status, JSON.stringify(r.body)).toBe(403);
      expect(r.body.error.message).toMatch(/Người thực hiện trực tiếp/);
    }
    expect(await dem('task_files')).toBe(0);
  });

  it('nhiệm vụ CHƯA GÁN người thực hiện = 409 (thiếu dữ kiện), không phải 403 (thiếu quyền)', async () => {
    const item = await taoNhiemVu();
    await pool.query('UPDATE work_items SET assignee_id = NULL WHERE id = $1', [item.id]);
    const r = await upload(adminApi, item.code);
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'CONFLICT' });
    expect(r.body.error.message).toMatch(/chưa có «Người thực hiện trực tiếp»/);
    expect(await dem('task_files')).toBe(0);
  });

  it('từ BẢN THỨ HAI thì TP/PP và PGĐ/GĐ nộp được như cũ — luật siết chỉ khoá bản 1', async () => {
    const dau = await upload(nvApi, task.code);
    expect(dau.status, JSON.stringify(dau.body)).toBe(200);
    const fileId = dau.body.data.nhom.id;
    const cuaTp = await upload(tpApi, task.code, { fileId });
    expect(cuaTp.status, JSON.stringify(cuaTp.body)).toBe(200);
    expect(cuaTp.body.data.ban.version_no).toBe(2);
    expect(String(cuaTp.body.data.ban.uploaded_by)).toBe(String(tp.id));
    const cuaPgd = await upload(pgdApi, task.code, { fileId });
    expect(cuaPgd.status, JSON.stringify(cuaPgd.body)).toBe(200);
    expect(cuaPgd.body.data.ban.version_no).toBe(3);
    expect(await dem('task_files')).toBe(1);
    expect(await dem('task_file_versions')).toBe(3);
  });

  it('nhóm KHAI trước (0 bản) vẫn là bản 1: TP khai được nhưng TP nộp file vào đó thì 403', async () => {
    // Q1: khai báo (tên · định dạng · tỷ lệ) là cửa MỞ cho cả TP/PP — luật bản đầu không đụng vào nó.
    const kq = await khai(tpApi, task.code);
    expect(kq.status, JSON.stringify(kq.body)).toBe(200);
    const fileId = kq.body.data.nhom.id;
    expect(await dem('task_file_versions')).toBe(0);
    // Nhưng file thật đầu tiên đi vào nhóm đó vẫn là BẢN SỐ 1.
    const cuaTp = await upload(tpApi, task.code, { fileId });
    expect(cuaTp.status, JSON.stringify(cuaTp.body)).toBe(403);
    expect(cuaTp.body.error.message).toMatch(/Người thực hiện trực tiếp/);
    const cuaNv = await upload(nvApi, task.code, { fileId });
    expect(cuaNv.status, JSON.stringify(cuaNv.body)).toBe(200);
    expect(cuaNv.body.data.ban.version_no).toBe(1);
    expect(await dem('task_file_versions')).toBe(1);
  });

  it('đường «Báo cáo» (bản chữ, không file) cũng bị gác y như đường tải file', async () => {
    const cuaTp = await nopBaoCao(tpApi, task.code);
    expect(cuaTp.status, JSON.stringify(cuaTp.body)).toBe(403);
    expect(cuaTp.body.error.message).toMatch(/Người thực hiện trực tiếp/);
    const cuaNv = await nopBaoCao(nvApi, task.code);
    expect(cuaNv.status, JSON.stringify(cuaNv.body)).toBe(200);
    expect(cuaNv.body.data.ban.version_no).toBe(1);
    // Bản chữ đã có ⇒ TP thêm bản chữ thứ hai được.
    const them = await nopBaoCao(tpApi, task.code, { fileId: cuaNv.body.data.nhom.id });
    expect(them.status, JSON.stringify(them.body)).toBe(200);
    expect(them.body.data.ban.version_no).toBe(2);
  });
});

describe('Cờ cho giao diện ẩn nút «Tải lên» và nói rõ ai nộp được bản đầu', () => {
  it('doc().duocSua: false cho TP trên nhóm 0 bản, true cho người thực hiện, true lại khi đã có bản', async () => {
    const kq = await khai(tpApi, task.code);
    expect(kq.status, JSON.stringify(kq.body)).toBe(200);

    const cuaTp = await docFiles(tpApi, task.code);
    expect(cuaTp.nhom[0].bans).toHaveLength(0);
    expect(cuaTp.nhom[0].duocSua).toBe(false);

    const cuaNv = await docFiles(nvApi, task.code);
    expect(cuaNv.nhom[0].duocSua).toBe(true);

    const nop = await upload(nvApi, task.code, { fileId: cuaTp.nhom[0].id });
    expect(nop.status, JSON.stringify(nop.body)).toBe(200);

    // Nhóm đã có bản thì giữ luật cũ: TP/PP sửa trực tuyến và nộp bản mới như trước 12/09/2026.
    const cuaTpSau = await docFiles(tpApi, task.code);
    expect(cuaTpSau.nhom[0].bans).toHaveLength(1);
    expect(cuaTpSau.nhom[0].duocSua).toBe(true);
  });

  it('quyenFile(): duocNop đúng người, kèm tên người thực hiện để giao diện khỏi để ô trống trơn', async () => {
    const cuaTp = await docFiles(tpApi, task.code);
    expect(cuaTp.quyen).toMatchObject({
      phuTrach: true,
      cayDaDuyet: true,
      duocNop: false,
      tenNguoiThucHien: nv.full_name,
      thieuNguoiThucHien: false,
    });

    const cuaNv = await docFiles(nvApi, task.code);
    expect(cuaNv.quyen).toMatchObject({
      duocNop: true,
      tenNguoiThucHien: nv.full_name,
      thieuNguoiThucHien: false,
    });

    const item = await taoNhiemVu({ name: 'Nhiệm vụ chưa gán người' });
    await pool.query('UPDATE work_items SET assignee_id = NULL WHERE id = $1', [item.id]);
    const thieu = await docFiles(tpApi, item.code);
    expect(thieu.quyen).toMatchObject({
      duocNop: false,
      tenNguoiThucHien: null,
      thieuNguoiThucHien: true,
    });
  });
});

// Bản NHÁP (012, Vòng 13) — «lưu thôi chưa gửi đi duyệt, CHƯA ĐƯỢC TÍNH LÀ CÔNG VIỆC».
//
// Ba điều phải đúng, và mỗi điều là một kiểu hỏng im lặng nếu sai:
//  1. **Ai THẤY**: chỉ người lập và admin. Sót một đường đọc là bản nháp chưa xong hiện ra cho cả
//     phòng — không có lỗi nào báo, chỉ có dữ liệu ở chỗ không nên ở. Nguồn sự thật duy nhất là
//     `thayDuocNhap` (`approvals/rules.js`); ở đây kiểm ĐỦ CẢ BỐN đường đọc: `GET /works`,
//     `GET /works/tree`, `GET /work-items`, và gói `/bootstrap` (cầu RPC `getDataForUser` uống chung).
//  2. **Không vào con số nào**: thống kê và Gantt đọc qua `v_countable_*` (view lo phần đó —
//     `countable-views.test.js` kiểm thẳng SQL), đây kiểm qua HTTP để chắc cả đường đi.
//  3. **Ai SỬA**: chặt hơn «Chờ duyệt» — người cùng phòng cũng không, chỉ người lập + admin
//     (`coSuaDuocKhiChoDuyet`).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let tp; // Trưởng phòng A — người LẬP bản nháp
let apiTp;
let apiPp; // Phó phòng A — cùng phòng, không phải người lập
let apiAdmin;
let apiPgdA; // Phó Giám đốc phụ trách phòng A — người duyệt, vẫn KHÔNG thấy nháp của người khác

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

/** Công việc cấp 1 lưu NHÁP + một công việc con + một nhiệm vụ bên trong. */
async function taoCayNhap() {
  const res = await apiTp.post('/api/v1/works', {
    name: 'Việc đang soạn',
    departmentId: phongA.id,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    saveAsDraft: true,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const work = res.body.data.work;
  const con = await apiTp.post('/api/v1/work-items', {
    workRef: work.code,
    level: 2,
    name: 'Công việc con trong nháp',
  });
  const conCode = con.body.data.item.code;
  const nv = await apiTp.post('/api/v1/work-items', {
    workRef: work.code,
    level: 3,
    parentRef: conCode,
    name: 'Nhiệm vụ trong nháp',
  });
  return { work, conCode, nvCode: nv.body.data.item.code };
}

const maCongViec = (res) => (res.body.data.works ?? []).map((w) => w.code);

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });

  tp = await makeLoginUser({
    code: 'NV010',
    full_name: 'Trần Thị Trưởng',
    email: 'tp-a@test.local',
    role: 'Trưởng phòng',
    department_id: phongA.id,
  });
  const pp = await makeLoginUser({
    code: 'NV011',
    email: 'pp-a@test.local',
    role: 'Phó phòng',
    department_id: phongA.id,
  });
  const pgdA = await makeLoginUser({
    code: 'NV002',
    email: 'pgd-a@test.local',
    role: 'Phó Giám đốc',
    department_id: phongA.id,
  });
  const admin = await makeLoginUser({
    code: 'NV001',
    email: 'admin@test.local',
    role: 'admin',
    department_id: null,
  });
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role) VALUES ($1,$2,'deputy_director')`,
    [phongA.id, pgdA.id]
  );

  apiTp = await dangNhap(tp);
  apiPp = await dangNhap(pp);
  apiPgdA = await dangNhap(pgdA);
  apiAdmin = await dangNhap(admin);
});

afterAll(async () => {
  await closePool();
});

describe('TC-NHAP-01..04 — ai THẤY bản nháp (bốn đường đọc)', () => {
  it('TC-NHAP-01: GET /works — người lập và admin thấy, người cùng phòng và Phó GĐ KHÔNG', async () => {
    const { work } = await taoCayNhap();

    expect(maCongViec(await apiTp.get('/api/v1/works'))).toContain(work.code);
    expect(maCongViec(await apiAdmin.get('/api/v1/works'))).toContain(work.code);
    // Phó Giám đốc phụ trách phòng SỬA được mục «Chờ duyệt» nhưng không thấy bản nháp của người
    // khác: nháp chưa gửi cho ai thì chưa ai có việc gì với nó.
    expect(maCongViec(await apiPp.get('/api/v1/works'))).not.toContain(work.code);
    expect(maCongViec(await apiPgdA.get('/api/v1/works'))).not.toContain(work.code);
  });

  it('TC-NHAP-02: GET /works/tree — cả cây nháp ẩn với người khác', async () => {
    const { work, conCode, nvCode } = await taoCayNhap();

    const cuaTp = await apiTp.get('/api/v1/works/tree');
    const cayTp = cuaTp.body.data.works.find((t) => t.code === work.code);
    expect(cayTp).toBeTruthy();
    expect(cayTp.subWorks.map((s) => s.code)).toContain(conCode);
    expect(cayTp.subWorks[0].tasks.map((t) => t.code)).toContain(nvCode);

    const cuaPp = await apiPp.get('/api/v1/works/tree');
    expect(cuaPp.body.data.works.map((t) => t.code)).not.toContain(work.code);
  });

  it('TC-NHAP-03: GET /work-items — dòng cấp 2/3 trong cây nháp ẩn với người khác', async () => {
    const { work, conCode } = await taoCayNhap();
    // Người lập đọc được cây con của chính mình.
    const cuaTp = await apiTp.get(`/api/v1/work-items?workRef=${work.code}`);
    expect(cuaTp.body.data.items.map((i) => i.code)).toContain(conCode);
    // Người khác không đọc được cả công việc cấp 1 ⇒ 403/404, tuỳ cổng nào chặn trước; điều phải
    // đúng là KHÔNG có dòng nào của cây nháp lọt ra.
    const cuaPp = await apiPp.get(`/api/v1/work-items?workRef=${work.code}`);
    expect(cuaPp.status).not.toBe(200);
  });

  it('TC-NHAP-04: gói /bootstrap (và cầu RPC getDataForUser) không rò cây nháp', async () => {
    const { work, conCode, nvCode } = await taoCayNhap();

    const cuaTp = await apiTp.get('/api/v1/bootstrap');
    expect((cuaTp.body.data.works ?? []).map((w) => w.code)).toContain(work.code);

    const cuaPp = await apiPp.get('/api/v1/bootstrap');
    expect((cuaPp.body.data.works ?? []).map((w) => w.code)).not.toContain(work.code);
    const maItem = (cuaPp.body.data.items ?? []).map((i) => i.code);
    expect(maItem).not.toContain(conCode);
    expect(maItem).not.toContain(nvCode);
  });

  it('TC-NHAP-04: dòng cấp 2 để nháp RIÊNG trong công việc đã duyệt cũng ẩn', async () => {
    // Đường này chỉ `bootstrap`/`work-items` bắt được: cấp 1 đã duyệt nên bộ lọc ở cấp 1 cho lọt.
    const cv = await apiTp.post('/api/v1/works', { name: 'Việc mở', departmentId: phongA.id });
    const work = cv.body.data.work;
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    const con = await apiTp.post('/api/v1/work-items', {
      workRef: work.code,
      level: 2,
      name: 'Con để nháp',
      saveAsDraft: true,
    });
    const conCode = con.body.data.item.code;
    expect(
      (await pool.query('SELECT approval_status FROM work_items WHERE code = $1', [conCode]))
        .rows[0].approval_status
    ).toBe('Nháp');

    const cuaPp = await apiPp.get('/api/v1/bootstrap');
    expect((cuaPp.body.data.items ?? []).map((i) => i.code)).not.toContain(conCode);
    const cuaTp = await apiTp.get('/api/v1/bootstrap');
    expect((cuaTp.body.data.items ?? []).map((i) => i.code)).toContain(conCode);
  });
});

describe('TC-NHAP-05..06 — nháp không vào con số nào', () => {
  it('TC-NHAP-05: /stats/summary không đếm cây nháp', async () => {
    const truoc = (await apiAdmin.get('/api/v1/stats/summary')).body.data;
    await taoCayNhap();
    const sau = (await apiAdmin.get('/api/v1/stats/summary')).body.data;
    // admin THẤY bản nháp trong danh sách, nhưng thống kê vẫn không đếm — «chưa được tính là công
    // việc» là chuyện của con số, không phải chuyện của quyền xem.
    expect(sau.totalWorks).toBe(truoc.totalWorks);
    expect(sau.totalTasks).toBe(truoc.totalTasks);
  });

  it('TC-NHAP-06: /gantt không vẽ cây nháp', async () => {
    const { work } = await taoCayNhap();
    const res = await apiAdmin.get('/api/v1/gantt');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data)).not.toContain(work.code);
  });

  it('TC-NHAP-06: gửi duyệt xong thì thống kê VẪN chưa đếm, duyệt rồi mới đếm', async () => {
    const truoc = (await apiAdmin.get('/api/v1/stats/summary')).body.data.totalWorks;
    const { work } = await taoCayNhap();
    await apiTp.post(`/api/v1/approvals/work/${work.code}/submit`);
    expect((await apiAdmin.get('/api/v1/stats/summary')).body.data.totalWorks).toBe(truoc);

    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect((await apiAdmin.get('/api/v1/stats/summary')).body.data.totalWorks).toBe(truoc + 1);
  });
});

describe('TC-NHAP-07..08 — ai SỬA / XOÁ bản nháp', () => {
  it('TC-NHAP-07: người cùng phòng KHÔNG sửa được nháp của người khác ⇒ 403', async () => {
    const { work } = await taoCayNhap();
    const res = await apiPp.patch(`/api/v1/works/${work.code}`, { name: 'PP sửa hộ' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('bản nháp');
  });

  it('TC-NHAP-07: người lập sửa được nhiều lần rồi mới gửi duyệt', async () => {
    const { work } = await taoCayNhap();
    expect((await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Sửa lần 1' })).status).toBe(
      200
    );
    expect((await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Sửa lần 2' })).status).toBe(
      200
    );
    const gui = await apiTp.post(`/api/v1/approvals/work/${work.code}/submit`);
    expect(gui.status).toBe(200);
    const { rows } = await pool.query('SELECT name, approval_status FROM works WHERE code = $1', [
      work.code,
    ]);
    expect(rows[0]).toMatchObject({ name: 'Sửa lần 2', approval_status: 'Chờ duyệt' });
  });

  it('TC-NHAP-08: admin sửa được nháp của người khác (§6 toàn quyền)', async () => {
    const { work } = await taoCayNhap();
    const res = await apiAdmin.patch(`/api/v1/works/${work.code}`, { name: 'Giám đốc sửa' });
    expect(res.status).toBe(200);
  });

  it('TC-NHAP-08: người lập xoá được bản nháp của mình, cả cây mất theo', async () => {
    const { work, conCode } = await taoCayNhap();
    const res = await apiTp.del(`/api/v1/works/${work.code}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT 1 FROM work_items WHERE code = $1', [conCode]);
    expect(rows).toHaveLength(0);
  });
});

describe('TC-NHAP-09 — «Lưu nháp» không phải đường tự đặt khoá duyệt', () => {
  it('gửi thẳng approvalStatus vẫn bị gỡ — khoá duyệt do máy chủ quyết', async () => {
    const res = await apiTp.post('/api/v1/works', {
      name: 'Thử tự duyệt',
      departmentId: phongA.id,
      approvalStatus: 'Đã duyệt',
    });
    expect(res.status).toBe(200);
    // Trưởng phòng lập ⇒ 'Chờ duyệt' theo việc 5.1, không phải giá trị gửi lên.
    expect(res.body.data.work.approval_status).toBe('Chờ duyệt');
  });

  it('saveAsDraft: false cư xử như không gửi cờ', async () => {
    const res = await apiTp.post('/api/v1/works', {
      name: 'Không phải nháp',
      departmentId: phongA.id,
      saveAsDraft: false,
    });
    expect(res.body.data.work.approval_status).toBe('Chờ duyệt');
  });

  it('admin lưu nháp thì vẫn là Nháp, không phải Đã duyệt', async () => {
    // admin bình thường tạo là 'Đã duyệt' ngay (tự duyệt). Cờ nháp phải THẮNG luật đó: nó trả lời
    // câu «đã gửi cho ai chưa», không phải câu «có phải chờ ai duyệt không».
    const res = await apiAdmin.post('/api/v1/works', {
      name: 'Giám đốc soạn nháp',
      departmentId: phongA.id,
      saveAsDraft: true,
    });
    expect(res.body.data.work.approval_status).toBe('Nháp');
  });
});

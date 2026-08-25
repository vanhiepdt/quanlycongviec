// Việc 5.6 — mục 'Chờ duyệt': cả phòng XEM được, người không lập thì KHÔNG sửa được
// (§8.4 nhóm E, TC-APR-12/13).
//
// Hai nửa của việc 5.6 nằm ở hai chỗ: nhãn vàng là của giao diện (`renderTaskTree`, kiểm ở
// `tests/unit/pending-badge.test.js`), còn khoá ghi là của máy chủ — file này. Chỉ ẩn nút Sửa ở
// giao diện là không đủ: ai cũng gọi thẳng được `PATCH /api/v1/works/:id`.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let phongB;
let apiTp; // Trưởng phòng A — người lập
let apiPp; // Phó phòng A — cùng phòng, KHÔNG phải người lập
let apiNv; // Nhân viên phòng A
let apiPgdA; // Phó Giám đốc phụ trách phòng A
let apiTpB; // Trưởng phòng B — phòng khác

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

async function trangThai(code) {
  const { rows } = await pool.query('SELECT approval_status, name FROM works WHERE code = $1', [
    code,
  ]);
  return rows[0] ?? null;
}

/** Một công việc 'Chờ duyệt' do Trưởng phòng A lập. */
async function vietChoDuyet() {
  const res = await apiTp.post('/api/v1/works', {
    name: 'Việc chờ duyệt',
    departmentId: phongA.id,
  });
  expect(res.body.data.work.approval_status).toBe('Chờ duyệt');
  return res.body.data.work;
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  phongB = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });

  const tp = await makeLoginUser({
    code: 'NV010',
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
  const nv = await makeLoginUser({
    code: 'NV012',
    email: 'nv-a@test.local',
    role: 'Nhân viên',
    department_id: phongA.id,
  });
  const pgdA = await makeLoginUser({
    code: 'NV002',
    email: 'pgd-a@test.local',
    role: 'Phó Giám đốc',
    department_id: phongA.id,
  });
  const tpB = await makeLoginUser({
    code: 'NV020',
    email: 'tp-b@test.local',
    role: 'Trưởng phòng',
    department_id: phongB.id,
  });
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, 'deputy_director')`,
    [phongA.id, pgdA.id]
  );

  apiTp = await dangNhap(tp);
  apiPp = await dangNhap(pp);
  apiNv = await dangNhap(nv);
  apiPgdA = await dangNhap(pgdA);
  apiTpB = await dangNhap(tpB);
});

afterAll(async () => {
  await closePool();
});

describe('TC-APR-12 — cả phòng THẤY mục chờ duyệt, kèm trạng thái để vẽ nhãn vàng', () => {
  it('Phó phòng cùng phòng đọc được mục chờ duyệt của người khác', async () => {
    const work = await vietChoDuyet();
    const res = await apiPp.get(`/api/v1/works/${work.code}`);
    expect(res.status).toBe(200);
    expect(res.body.data.work.approval_status).toBe('Chờ duyệt');
  });

  it('Nhân viên cùng phòng cũng thấy trong danh sách', async () => {
    const work = await vietChoDuyet();
    const res = await apiNv.get('/api/v1/works');
    expect(res.body.data.works.map((w) => w.code)).toContain(work.code);
  });

  it('Mục chờ duyệt vẫn nằm trên cây 3 tầng của cả phòng', async () => {
    const work = await vietChoDuyet();
    const res = await apiPp.get('/api/v1/works/tree');
    const codes = JSON.stringify(res.body.data);
    expect(codes).toContain(work.code);
  });
});

describe('TC-APR-13 — người phòng khác KHÔNG thấy', () => {
  it('Trưởng phòng B không thấy mục của phòng A trong danh sách', async () => {
    const work = await vietChoDuyet();
    const res = await apiTpB.get('/api/v1/works');
    expect(res.body.data.works.map((w) => w.code)).not.toContain(work.code);
  });

  it('Trưởng phòng B đọc thẳng theo mã ⇒ 403', async () => {
    const work = await vietChoDuyet();
    const res = await apiTpB.get(`/api/v1/works/${work.code}`);
    expect(res.status).toBe(403);
  });
});

describe('Việc 5.6 — không phải người lập thì không SỬA được mục chờ duyệt', () => {
  it('Phó phòng cùng phòng sửa mục chờ duyệt của Trưởng phòng ⇒ 403', async () => {
    const work = await vietChoDuyet();
    const res = await apiPp.patch(`/api/v1/works/${work.code}`, { name: 'Tên bị đổi trộm' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('chờ duyệt');
    expect((await trangThai(work.code)).name).toBe('Việc chờ duyệt');
  });

  it('Phó phòng cùng phòng XOÁ mục chờ duyệt ⇒ 403', async () => {
    const work = await vietChoDuyet();
    const res = await apiPp.del(`/api/v1/works/${work.code}`);
    expect(res.status).toBe(403);
    expect(await trangThai(work.code)).not.toBeNull();
  });

  it('Chính người lập vẫn sửa được mục chờ duyệt của mình', async () => {
    const work = await vietChoDuyet();
    const res = await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Sửa lại cho rõ' });
    expect(res.status).toBe(200);
    expect((await trangThai(work.code)).name).toBe('Sửa lại cho rõ');
  });

  it('Phó Giám đốc phụ trách sửa được — họ là người sẽ duyệt nó', async () => {
    const work = await vietChoDuyet();
    const res = await apiPgdA.patch(`/api/v1/works/${work.code}`, { name: 'Người duyệt sửa lại' });
    expect(res.status).toBe(200);
  });

  it('admin sửa được mọi mục chờ duyệt', async () => {
    const work = await vietChoDuyet();
    const admin = await makeLoginUser({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    const api = await dangNhap(admin);
    expect((await api.patch(`/api/v1/works/${work.code}`, { name: 'admin sửa' })).status).toBe(200);
  });

  it('Duyệt xong thì cả phòng sửa lại được như bình thường (§6)', async () => {
    const work = await vietChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);

    const res = await apiPp.patch(`/api/v1/works/${work.code}`, { name: 'Đã duyệt nên sửa được' });
    expect(res.status).toBe(200);
    expect((await trangThai(work.code)).name).toBe('Đã duyệt nên sửa được');
  });

  it('Mục bị TỪ CHỐI không bị khoá — người lập phải sửa được để gửi lại', async () => {
    const work = await vietChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Chưa nêu rõ sản phẩm đầu ra',
    });
    const res = await apiPp.patch(`/api/v1/works/${work.code}`, { name: 'Sửa theo góp ý' });
    expect(res.status).toBe(200);
  });
});

describe('Việc 5.6 — cùng luật đó áp cho công việc con cấp 2', () => {
  it('Phó phòng sửa công việc con chờ duyệt của Trưởng phòng ⇒ 403', async () => {
    const work = await vietChoDuyet();
    const con = await apiTp.post('/api/v1/work-items', {
      workRef: work.code,
      level: 2,
      name: 'Công việc con',
    });
    const code = con.body.data.item.code;

    const res = await apiPp.patch(`/api/v1/work-items/${code}`, { name: 'Đổi trộm' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('chờ duyệt');
  });

  it('Nhiệm vụ cấp 3 luôn Đã duyệt nên không bao giờ bị khoá bởi luật này', async () => {
    const work = await vietChoDuyet();
    const nv3 = await apiTp.post('/api/v1/work-items', {
      workRef: work.code,
      level: 3,
      name: 'Nhiệm vụ',
      assigneeId: null,
    });
    const code = nv3.body.data.item.code;

    const res = await apiPp.patch(`/api/v1/work-items/${code}`, { name: 'Sửa nhiệm vụ' });
    expect(res.status).toBe(200);
  });
});

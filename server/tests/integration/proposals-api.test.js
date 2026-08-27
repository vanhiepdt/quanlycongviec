// Đề nghị (§2.7 nhóm G, §7 việc 7.1) — chạy qua HTTP thật trên Postgres thật.
//
// Bốn ca chốt của §8.4 nhóm G:
//   TC-MISC-01 tổng 4 thẻ = số đề nghị THẤY ĐƯỢC (không phải cả bảng)
//   TC-MISC-02 đổi loại đề nghị, dữ liệu cũ không mất
//   TC-MISC-03 chọn công việc ⇒ chỉ nhiệm vụ của công việc đó
//   TC-MISC-04 xoá công việc còn đề nghị ⇒ đề nghị CÒN, `work_id = NULL`
//
// Quyền của đề nghị suy từ ma trận §6 qua một dòng phạm vi (xem `modules/proposals/service.js`),
// nên phần lớn test ở đây là test phạm vi: ai thấy gì, ai ghi được `status`.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { COL } from '../../src/rpc/legacyFields.js';
import { makeDepartment, makeItem, makeWork, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let phongB;
let admin;
let pgdA;
let truongA;
let nhanVienA;
let nhanVienB;
let workA;
let workB;
let taskA1;
let taskB1;

/** Gán người phụ trách phòng — `Phó Giám đốc` chỉ duyệt được phòng có dòng này (§6). */
async function themQuanLy(departmentId, userId, role) {
  await pool.query(
    'INSERT INTO department_managers (department_id, user_id, role) VALUES ($1,$2,$3)',
    [departmentId, userId, role]
  );
}

/** Đăng nhập một người và trả client riêng của người đó. */
async function nhuLa(user) {
  const api = client(app);
  const res = await api.login(user.email);
  expect(res.status, `đăng nhập ${user.email}`).toBe(200);
  return api;
}

async function seed() {
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1 });
  phongB = await makeDepartment({ code: 'PH02', name: 'Phòng Kế toán', sort_order: 2 });

  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  pgdA = await makeLoginUser({
    code: 'NV002',
    email: 'pgd@congty.vn',
    full_name: 'Phó Giám đốc A',
    role: 'Phó Giám đốc',
  });
  truongA = await makeLoginUser({
    code: 'NV003',
    email: 'truong-a@congty.vn',
    full_name: 'Trưởng phòng A',
    role: 'Trưởng phòng',
    department_id: phongA.id,
  });
  nhanVienA = await makeLoginUser({
    code: 'NV004',
    email: 'nv-a@congty.vn',
    full_name: 'Cán bộ A',
    department_id: phongA.id,
  });
  nhanVienB = await makeLoginUser({
    code: 'NV005',
    email: 'nv-b@congty.vn',
    full_name: 'Cán bộ B',
    department_id: phongB.id,
  });
  await themQuanLy(phongA.id, pgdA.id, 'deputy_director');

  workA = await makeWork({ code: 'CV001', name: 'Việc phòng A', department_id: phongA.id });
  workB = await makeWork({ code: 'CV002', name: 'Việc phòng B', department_id: phongB.id });
  taskA1 = await makeItem({
    code: 'CV001-001',
    work_id: workA.id,
    level: 3,
    name: 'Nhiệm vụ A1',
  });
  taskB1 = await makeItem({
    code: 'CV002-001',
    work_id: workB.id,
    level: 3,
    name: 'Nhiệm vụ B1',
  });
}

beforeEach(async () => {
  await resetTables();
  await seed();
});

afterAll(async () => {
  await closePool();
});

describe('POST /api/v1/proposals — tạo đề nghị', () => {
  it('sinh mã DN001 tăng dần, người đề nghị luôn là người đăng nhập', async () => {
    const api = await nhuLa(nhanVienA);
    const res = await api.post('/api/v1/proposals', {
      type: 'Trong kế hoạch',
      workRef: 'CV001',
      taskRef: 'CV001-001',
      content: 'Mua máy in',
      supplier: 'Công ty X',
      proposalDate: '2026-08-20',
    });
    expect(res.status).toBe(201);
    const p = res.body.data.proposal;
    expect(p.code).toBe('DN001');
    expect(p.creator_id).toBe(nhanVienA.id);
    expect(p.creator_name).toBe('Cán bộ A');
    expect(p.work_id).toBe(workA.id);
    expect(p.work_item_id).toBe(taskA1.id);
    // Không gửi status ⇒ mặc định của CSDL.
    expect(p.status).toBe('Đề xuất mới');

    const sau = await api.post('/api/v1/proposals', { content: 'Mua giấy' });
    expect(sau.body.data.proposal.code).toBe('DN002');
  });

  it('không gắn công việc nào vẫn tạo được (đề nghị mua sắm chung, work_id NULL)', async () => {
    const api = await nhuLa(nhanVienA);
    const res = await api.post('/api/v1/proposals', {
      type: 'Ngoài kế hoạch',
      workRef: '',
      taskRef: '',
      content: 'Mua nước uống cho phòng',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.proposal.work_id).toBeNull();
    expect(res.body.data.proposal.work_item_id).toBeNull();
  });

  it('người đề nghị KHÔNG tự đặt được trạng thái Đã duyệt (hai ô duyệt bị bỏ)', async () => {
    const api = await nhuLa(nhanVienA);
    const res = await api.post('/api/v1/proposals', {
      content: 'Tự duyệt cho nhanh',
      status: 'Đã duyệt',
      reviewNote: 'ok nhé',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.proposal.status).toBe('Đề xuất mới');
    expect(res.body.data.proposal.review_note).toBe('');
  });

  it('admin thì đặt được trạng thái ngay khi tạo', async () => {
    const api = await nhuLa(admin);
    const res = await api.post('/api/v1/proposals', {
      content: 'Đề nghị admin nhập hộ',
      status: 'Đã duyệt',
      reviewNote: 'Đồng ý',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.proposal.status).toBe('Đã duyệt');
    expect(res.body.data.proposal.review_note).toBe('Đồng ý');
  });

  it('TC-MISC-03: nhiệm vụ không thuộc công việc đã chọn ⇒ 400 nói rõ', async () => {
    const api = await nhuLa(admin);
    const res = await api.post('/api/v1/proposals', {
      workRef: 'CV001',
      taskRef: 'CV002-001',
      content: 'Cặp lệch nhau',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('CV002-001');
    expect(res.body.error.message).toContain('CV001');
  });

  it('TC-MISC-03: chỉ gửi nhiệm vụ ⇒ tự suy ra công việc cha của nhiệm vụ đó', async () => {
    const api = await nhuLa(admin);
    const res = await api.post('/api/v1/proposals', {
      taskRef: 'CV002-001',
      content: 'Suy ra công việc cha',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.proposal.work_id).toBe(workB.id);
    expect(res.body.data.proposal.work_item_id).toBe(taskB1.id);
  });

  it('công việc không tồn tại ⇒ 404, không tạo dòng rác', async () => {
    const api = await nhuLa(admin);
    const res = await api.post('/api/v1/proposals', { workRef: 'CV999', content: 'x' });
    expect(res.status).toBe(404);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM proposals');
    expect(rows[0].n).toBe(0);
  });

  it('loại ngoài 2 giá trị hợp lệ ⇒ 400 ngay ở lớp kiểm dữ liệu', async () => {
    const api = await nhuLa(admin);
    const res = await api.post('/api/v1/proposals', { type: 'Tự nghĩ ra', content: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const api = client(app);
    const res = await api.post('/api/v1/proposals', { content: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/proposals — danh sách, số đếm, tìm kiếm', () => {
  /** Bốn đề nghị: 2 của phòng A (một do NV A gửi), 1 của phòng B, 1 không gắn việc của NV B. */
  async function duLieuBonDeNghi() {
    const apiNvA = await nhuLa(nhanVienA);
    await apiNvA.post('/api/v1/proposals', { workRef: 'CV001', content: 'A gửi: mua máy in' });
    const apiAdmin = await nhuLa(admin);
    await apiAdmin.post('/api/v1/proposals', {
      workRef: 'CV001',
      content: 'admin gửi cho việc phòng A',
      status: 'Đã duyệt',
    });
    await apiAdmin.post('/api/v1/proposals', {
      workRef: 'CV002',
      content: 'admin gửi cho việc phòng B',
      status: 'Từ chối',
    });
    const apiNvB = await nhuLa(nhanVienB);
    await apiNvB.post('/api/v1/proposals', { content: 'B gửi: không gắn việc' });
    return { apiNvA, apiAdmin, apiNvB };
  }

  it('TC-MISC-01: tổng 4 thẻ = số đề nghị thấy được, admin thấy tất cả', async () => {
    const { apiAdmin } = await duLieuBonDeNghi();
    const res = await apiAdmin.get('/api/v1/proposals');
    expect(res.status).toBe(200);
    const { proposals, counts, total } = res.body.data;
    expect(proposals).toHaveLength(4);
    expect(total).toBe(4);
    // Đủ 4 khoá kể cả khoá bằng 0 — giao diện luôn vẽ 4 thẻ.
    expect(Object.keys(counts)).toEqual(['Đề xuất mới', 'Chờ duyệt', 'Đã duyệt', 'Từ chối']);
    expect(counts['Đề xuất mới']).toBe(2);
    expect(counts['Chờ duyệt']).toBe(0);
    expect(counts['Đã duyệt']).toBe(1);
    expect(counts['Từ chối']).toBe(1);
    const tong = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(tong).toBe(proposals.length);
  });

  it('TC-MISC-01: Nhân viên phòng A chỉ thấy phần của mình và 4 thẻ đếm đúng phần đó', async () => {
    const { apiNvA } = await duLieuBonDeNghi();
    const res = await apiNvA.get('/api/v1/proposals');
    expect(res.status).toBe(200);
    const { proposals, counts } = res.body.data;
    const noiDung = proposals.map((p) => p.content).sort();
    expect(noiDung).toEqual(['A gửi: mua máy in', 'admin gửi cho việc phòng A']);
    expect(counts['Đề xuất mới']).toBe(1);
    expect(counts['Đã duyệt']).toBe(1);
    expect(counts['Từ chối']).toBe(0);
    const tong = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(tong).toBe(proposals.length);
  });

  it('Phó Giám đốc chỉ thấy đề nghị của phòng mình phụ trách', async () => {
    await duLieuBonDeNghi();
    const api = await nhuLa(pgdA);
    const res = await api.get('/api/v1/proposals');
    expect(res.status).toBe(200);
    const noiDung = res.body.data.proposals.map((p) => p.content).sort();
    expect(noiDung).toEqual(['A gửi: mua máy in', 'admin gửi cho việc phòng A']);
  });

  it('người đề nghị vẫn thấy đơn của mình dù không gắn công việc nào', async () => {
    await duLieuBonDeNghi();
    const api = await nhuLa(nhanVienB);
    const res = await api.get('/api/v1/proposals');
    const noiDung = res.body.data.proposals.map((p) => p.content).sort();
    expect(noiDung).toEqual(['B gửi: không gắn việc', 'admin gửi cho việc phòng B']);
  });

  it('lọc theo trạng thái / loại / công việc và tìm kiếm chuỗi con', async () => {
    const { apiAdmin } = await duLieuBonDeNghi();
    const daDuyet = await apiAdmin.get(
      '/api/v1/proposals?status=' + encodeURIComponent('Đã duyệt')
    );
    expect(daDuyet.body.data.proposals).toHaveLength(1);

    const theoViec = await apiAdmin.get(`/api/v1/proposals?workId=${workA.id}`);
    expect(theoViec.body.data.proposals).toHaveLength(2);

    const tim = await apiAdmin.get('/api/v1/proposals?q=' + encodeURIComponent('máy in'));
    expect(tim.body.data.proposals).toHaveLength(1);
    expect(tim.body.data.proposals[0].content).toBe('A gửi: mua máy in');

    // Gõ `%` là ký tự thường, không phải "ra hết bảng".
    const phanTram = await apiAdmin.get('/api/v1/proposals?q=%25');
    expect(phanTram.body.data.proposals).toHaveLength(0);
  });

  it('mới nhất lên đầu (khớp thứ tự giao diện cũ chèn dòng mới)', async () => {
    const { apiAdmin } = await duLieuBonDeNghi();
    const res = await apiAdmin.get('/api/v1/proposals');
    const ids = res.body.data.proposals.map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('GET /:id ngoài phạm vi ⇒ 403, trong phạm vi ⇒ trả dòng', async () => {
    const { apiAdmin } = await duLieuBonDeNghi();
    const cuaPhongB = (await apiAdmin.get(`/api/v1/proposals?workId=${workB.id}`)).body.data
      .proposals[0];

    const apiNvA = await nhuLa(nhanVienA);
    const ngoai = await apiNvA.get(`/api/v1/proposals/${cuaPhongB.code}`);
    expect(ngoai.status).toBe(403);

    const trong = await apiAdmin.get(`/api/v1/proposals/${cuaPhongB.code}`);
    expect(trong.status).toBe(200);
    expect(trong.body.data.proposal.code).toBe(cuaPhongB.code);
  });
});

describe('PATCH /api/v1/proposals/:id — sửa và duyệt', () => {
  /** Một đề nghị do Nhân viên A gửi, gắn công việc CV001. */
  async function deNghiCuaNvA() {
    const api = await nhuLa(nhanVienA);
    const res = await api.post('/api/v1/proposals', {
      type: 'Trong kế hoạch',
      workRef: 'CV001',
      taskRef: 'CV001-001',
      content: 'Mua máy in',
      supplier: 'Công ty X',
      url: 'https://vidu.vn/bao-gia',
      proposalDate: '2026-08-20',
    });
    expect(res.status).toBe(201);
    return { api, proposal: res.body.data.proposal };
  }

  it('TC-MISC-02: đổi loại đề nghị ⇒ các trường cũ không mất', async () => {
    const { api, proposal } = await deNghiCuaNvA();
    const res = await api.patch(`/api/v1/proposals/${proposal.code}`, {
      type: 'Ngoài kế hoạch',
    });
    expect(res.status).toBe(200);
    const sau = res.body.data.proposal;
    expect(sau.type).toBe('Ngoài kế hoạch');
    expect(sau.content).toBe('Mua máy in');
    expect(sau.supplier).toBe('Công ty X');
    expect(sau.url).toBe('https://vidu.vn/bao-gia');
    expect(sau.work_id).toBe(workA.id);
    expect(sau.work_item_id).toBe(taskA1.id);
    expect(String(sau.proposal_date)).toContain('2026-08-20');
  });

  it('người gửi sửa nội dung được nhưng KHÔNG đổi được trạng thái', async () => {
    const { api, proposal } = await deNghiCuaNvA();
    const res = await api.patch(`/api/v1/proposals/${proposal.code}`, {
      content: 'Mua máy in màu',
      status: 'Đã duyệt',
      reviewNote: 'tự phê',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.proposal.content).toBe('Mua máy in màu');
    expect(res.body.data.proposal.status).toBe('Đề xuất mới');
    expect(res.body.data.proposal.review_note).toBe('');
  });

  it('Phó Giám đốc phụ trách phòng đó duyệt được và nhật ký ghi bước chuyển trạng thái', async () => {
    const { proposal } = await deNghiCuaNvA();
    const api = await nhuLa(pgdA);
    const res = await api.patch(`/api/v1/proposals/${proposal.code}`, {
      status: 'Đã duyệt',
      reviewNote: 'Đồng ý mua',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.proposal.status).toBe('Đã duyệt');
    expect(res.body.data.proposal.review_note).toBe('Đồng ý mua');

    const { rows } = await pool.query(
      `SELECT action, entity_type, details FROM activity_logs
        WHERE action = 'proposal.update' ORDER BY id DESC LIMIT 1`
    );
    expect(rows[0].entity_type).toBe('proposal');
    expect(rows[0].details.status).toEqual({ from: 'Đề xuất mới', to: 'Đã duyệt' });
  });

  it('Trưởng phòng KHÔNG duyệt được (§6: chỉ admin và Phó Giám đốc)', async () => {
    const { proposal } = await deNghiCuaNvA();
    const api = await nhuLa(truongA);
    const res = await api.patch(`/api/v1/proposals/${proposal.code}`, { status: 'Đã duyệt' });
    // Sửa được vì công việc thuộc phòng mình, nhưng trạng thái thì không đổi.
    expect(res.status).toBe(200);
    expect(res.body.data.proposal.status).toBe('Đề xuất mới');
  });

  it('đã kết luận rồi thì người gửi không sửa, không xoá được nữa', async () => {
    const { api, proposal } = await deNghiCuaNvA();
    const apiAdmin = await nhuLa(admin);
    await apiAdmin.patch(`/api/v1/proposals/${proposal.code}`, { status: 'Từ chối' });

    const sua = await api.patch(`/api/v1/proposals/${proposal.code}`, { content: 'sửa lén' });
    expect(sua.status).toBe(403);
    expect(sua.body.error.message).toContain('Từ chối');

    const xoa = await api.del(`/api/v1/proposals/${proposal.code}`);
    expect(xoa.status).toBe(403);
  });

  it('người ngoài phạm vi sửa ⇒ 403', async () => {
    const { proposal } = await deNghiCuaNvA();
    const api = await nhuLa(nhanVienB);
    const res = await api.patch(`/api/v1/proposals/${proposal.code}`, { content: 'của tôi' });
    expect(res.status).toBe(403);
  });

  it('bỏ liên kết công việc bằng workRef rỗng', async () => {
    const { api, proposal } = await deNghiCuaNvA();
    const res = await api.patch(`/api/v1/proposals/${proposal.code}`, { workRef: '' });
    expect(res.status).toBe(200);
    expect(res.body.data.proposal.work_id).toBeNull();
    expect(res.body.data.proposal.work_item_id).toBeNull();
  });

  it('thiếu token CSRF ⇒ 403, dữ liệu không đổi', async () => {
    const { api, proposal } = await deNghiCuaNvA();
    const res = await api.patch(
      `/api/v1/proposals/${proposal.code}`,
      { content: 'lén' },
      { csrf: null }
    );
    expect(res.status).toBe(403);
    const { rows } = await pool.query('SELECT content FROM proposals WHERE id = $1', [proposal.id]);
    expect(rows[0].content).toBe('Mua máy in');
  });

  it('mã không tồn tại ⇒ 404', async () => {
    const api = await nhuLa(admin);
    const res = await api.patch('/api/v1/proposals/DN999', { content: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/proposals/:id + TC-MISC-04', () => {
  it('người gửi xoá được đề nghị chưa kết luận của mình', async () => {
    const api = await nhuLa(nhanVienA);
    const tao = await api.post('/api/v1/proposals', { workRef: 'CV001', content: 'Mua máy in' });
    const res = await api.del(`/api/v1/proposals/${tao.body.data.proposal.code}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedProposal).toBe('DN001');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM proposals');
    expect(rows[0].n).toBe(0);
  });

  it('TC-MISC-04: xoá công việc còn đề nghị tham chiếu ⇒ đề nghị CÒN, work_id = NULL', async () => {
    const apiNv = await nhuLa(nhanVienA);
    const tao = await apiNv.post('/api/v1/proposals', {
      workRef: 'CV001',
      taskRef: 'CV001-001',
      content: 'Mua máy in cho CV001',
    });
    expect(tao.status).toBe(201);
    const ma = tao.body.data.proposal.code;

    const apiAdmin = await nhuLa(admin);
    const xoaViec = await apiAdmin.del('/api/v1/works/CV001');
    expect(xoaViec.status).toBe(200);

    const { rows } = await pool.query(
      'SELECT code, work_id, work_item_id, content FROM proposals WHERE code = $1',
      [ma]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].work_id).toBeNull();
    expect(rows[0].work_item_id).toBeNull();
    expect(rows[0].content).toBe('Mua máy in cho CV001');

    // Và đề nghị mất liên kết vẫn còn nằm trong danh sách của người gửi (không biến mất khỏi lưới).
    const ds = await apiNv.get('/api/v1/proposals');
    expect(ds.body.data.proposals.map((p) => p.code)).toContain(ma);
  });
});

// ============================================================================
// Cầu RPC — 4 tên cũ của giao diện Google Apps Script (§5.2).
//
// Hình dạng phản hồi ở đây là HỢP ĐỒNG, không phải lựa chọn: `loadProposals` gán thẳng
// `allProposals = response` nên `getProposals` phải trả MẢNG THÔ khoá `COL.PR_*`; `handleAdd`
// đọc `response.success` rồi `response.id`.
// ============================================================================
describe('cầu RPC: getProposals / addProposalWithAuth / updateProposalWithAuth / deleteProposalWithAuth', () => {
  let api;

  beforeEach(async () => {
    api = await nhuLa(admin);
  });

  const rpc = (name, args = []) => api.post(`/api/rpc/${name}`, { args });

  it('addProposalWithAuth nhận khoá COL.PR_* và trả {success, id, proposalId}', async () => {
    const res = await rpc('addProposalWithAuth', [
      {
        [COL.PR_TYPE]: 'Ngoài kế hoạch',
        [COL.PR_PID]: 'CV001',
        [COL.PR_TID]: 'CV001-001',
        [COL.PR_CONTENT]: 'Mua máy in',
        [COL.PR_SUPPLIER]: 'Công ty X',
        [COL.PR_DATE]: '2026-08-20',
        [COL.PR_STATUS]: '',
        [COL.PR_NOTE]: '',
      },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.id).toBe('DN001');
    expect(res.body.data.proposalId).toBe('DN001');

    const { rows } = await pool.query('SELECT * FROM proposals WHERE code = $1', ['DN001']);
    expect(rows[0].type).toBe('Ngoài kế hoạch');
    expect(rows[0].work_id).toBe(workA.id);
    expect(rows[0].work_item_id).toBe(taskA1.id);
    expect(rows[0].creator_name).toBe(admin.full_name);
  });

  it('getProposals trả MẢNG THÔ khoá COL.PR_*, PR_ID là mã và PR_PID là mã công việc', async () => {
    await rpc('addProposalWithAuth', [
      { [COL.PR_PID]: 'CV001', [COL.PR_CONTENT]: 'Mua máy in', [COL.PR_DATE]: '2026-08-20' },
    ]);
    const res = await rpc('getProposals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    const dong = res.body.data[0];
    expect(dong[COL.PR_ID]).toBe('DN001');
    expect(dong[COL.PR_PID]).toBe('CV001');
    expect(dong[COL.PR_CONTENT]).toBe('Mua máy in');
    expect(dong[COL.PR_CREATOR]).toBe(admin.full_name);
    expect(dong[COL.PR_DATE]).toBe('2026-08-20');
    expect(dong[COL.PR_STATUS]).toBe('Đề xuất mới');
  });

  it('updateProposalWithAuth sửa theo mã; deleteProposalWithAuth trả deletedProposal', async () => {
    await rpc('addProposalWithAuth', [{ [COL.PR_CONTENT]: 'Mua máy in' }]);
    const sua = await rpc('updateProposalWithAuth', [
      'DN001',
      { [COL.PR_CONTENT]: 'Mua máy in màu', [COL.PR_STATUS]: 'Đã duyệt' },
    ]);
    expect(sua.status).toBe(200);
    expect(sua.body.data.success).toBe(true);
    const { rows } = await pool.query('SELECT content, status FROM proposals WHERE code = $1', [
      'DN001',
    ]);
    expect(rows[0].content).toBe('Mua máy in màu');
    expect(rows[0].status).toBe('Đã duyệt');

    const xoa = await rpc('deleteProposalWithAuth', ['DN001']);
    expect(xoa.status).toBe(200);
    expect(xoa.body.data.success).toBe(true);
    expect(xoa.body.data.deletedProposal).toBe('DN001');
  });

  it('gói dữ liệu đầu (getDataForUser) có proposals khoá COL.PR_* + 4 số đếm', async () => {
    await rpc('addProposalWithAuth', [{ [COL.PR_PID]: 'CV001', [COL.PR_CONTENT]: 'Mua máy in' }]);
    const res = await rpc('getDataForUser');
    expect(res.status).toBe(200);
    expect(res.body.data.proposals).toHaveLength(1);
    expect(res.body.data.proposals[0][COL.PR_ID]).toBe('DN001');
    expect(res.body.data.proposalCounts['Đề xuất mới']).toBe(1);
  });
});

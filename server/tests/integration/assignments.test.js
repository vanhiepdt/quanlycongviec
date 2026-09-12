// Phân công ba lớp trên cây công việc (005_phan_cong.sql): Ban lãnh đạo kiểm soát, Lãnh đạo
// phòng phụ trách, Cán bộ làm trực tiếp. Chạy qua HTTP thật (supertest) trên Postgres thật.
//
// Ba nguồn sự thật phải khớp nhau ở cả BA tầng: form đọc `/departments/assignment-options`,
// service đối chiếu lại `department_managers` + `users`, CHECK `task_leader_single` chặn cuối.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let api;
let dept;
let admin;
let pgdA;
let headA;
let viceA;
let staffA;

/** Gán một người phụ trách một phòng với một vai của department_managers. */
async function themQuanLy(departmentId, userId, role) {
  await pool.query(
    'INSERT INTO department_managers (department_id, user_id, role) VALUES ($1,$2,$3)',
    [departmentId, userId, role]
  );
}

/** Dữ liệu nền: 1 phòng + đủ các vai người dùng + bảng phụ trách phòng. */
async function seed() {
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  pgdA = await makeLoginUser({
    code: 'NV002',
    email: 'pgd@congty.vn',
    full_name: 'Phó Giám đốc A',
    role: 'Phó Giám đốc',
  });
  headA = await makeLoginUser({
    code: 'NV003',
    email: 'head@congty.vn',
    full_name: 'Trưởng phòng A',
    role: 'Trưởng phòng',
    department_id: dept.id,
  });
  viceA = await makeLoginUser({
    code: 'NV004',
    email: 'vice@congty.vn',
    full_name: 'Phó phòng A',
    role: 'Phó phòng',
    department_id: dept.id,
  });
  staffA = await makeLoginUser({
    code: 'NV005',
    email: 'staff@congty.vn',
    full_name: 'Cán bộ A',
    department_id: dept.id,
  });
  await themQuanLy(dept.id, pgdA.id, 'deputy_director');
  await themQuanLy(dept.id, headA.id, 'head');
  await themQuanLy(dept.id, viceA.id, 'vice');
  await api.login(admin.email);
}

beforeEach(async () => {
  await resetTables();
  api = client(app);
  await seed();
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/v1/departments/assignment-options — ứng viên cho form', () => {
  it('có phòng: supervisors = Phó GĐ phụ trách + admin, leaders = Trưởng/Phó phòng', async () => {
    const res = await api.get(`/api/v1/departments/assignment-options?departmentId=${dept.id}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.supervisors.map((s) => s.id).sort((a, b) => a - b);
    expect(ids).toEqual([admin.id, pgdA.id].sort((a, b) => a - b));
    // Mặc định điền sẵn Phó GĐ phụ trách phòng (luật đã chốt).
    expect(res.body.data.defaultSupervisorId).toBe(pgdA.id);
    expect(res.body.data.leaders.map((l) => l.id).sort((a, b) => a - b)).toEqual(
      [headA.id, viceA.id].sort((a, b) => a - b)
    );
  });

  it('không phòng ("Công việc chung"): mọi Phó GĐ + admin, leaders rỗng', async () => {
    const res = await api.get('/api/v1/departments/assignment-options');
    expect(res.status).toBe(200);
    const ids = res.body.data.supervisors.map((s) => s.id).sort((a, b) => a - b);
    expect(ids).toEqual([admin.id, pgdA.id].sort((a, b) => a - b));
    expect(res.body.data.leaders).toEqual([]);
  });

  it('chưa đăng nhập → 401', async () => {
    const guest = client(app);
    const res = await guest.get('/api/v1/departments/assignment-options');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/works — Ban kiểm soát + Lãnh đạo phòng của công việc cấp 1', () => {
  it('lưu được supervisor + leaders đúng nguồn', async () => {
    const res = await api.post('/api/v1/works', {
      name: 'Triển khai hệ thống',
      departmentId: dept.id,
      supervisorIds: [pgdA.id],
      leaderIds: [headA.id, viceA.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.work.supervisor_ids).toEqual([pgdA.id]);
    expect(res.body.data.work.leader_ids.sort()).toEqual([headA.id, viceA.id].sort());
  });

  it('supervisor là Trưởng phòng (không phải admin/PGD) → 400', async () => {
    const res = await api.post('/api/v1/works', {
      name: 'X',
      departmentId: dept.id,
      supervisorIds: [headA.id],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('leader không phải lãnh đạo phòng → 400', async () => {
    const res = await api.post('/api/v1/works', {
      name: 'X',
      departmentId: dept.id,
      leaderIds: [staffA.id],
    });
    expect(res.status).toBe(400);
  });

  it('công việc chung mà có leader → 400', async () => {
    const res = await api.post('/api/v1/works', { name: 'Việc chung', leaderIds: [headA.id] });
    expect(res.status).toBe(400);
  });

  it('công việc chung nhận Phó GĐ bất kỳ làm supervisor', async () => {
    const res = await api.post('/api/v1/works', { name: 'Việc chung', supervisorIds: [pgdA.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.work.department_id).toBeNull();
    expect(res.body.data.work.leader_ids).toEqual([]);
  });

  it('PATCH đổi supervisor sai nguồn → 400, dữ liệu giữ nguyên', async () => {
    const tao = await api.post('/api/v1/works', {
      name: 'X',
      departmentId: dept.id,
      supervisorIds: [pgdA.id],
    });
    const code = tao.body.data.work.code;
    const res = await api.patch(`/api/v1/works/${code}`, { supervisorIds: [staffA.id] });
    expect(res.status).toBe(400);
    const sau = await pool.query('SELECT supervisor_ids FROM works WHERE code = $1', [code]);
    expect(sau.rows[0].supervisor_ids).toEqual([pgdA.id]);
  });
});

describe('POST /api/v1/work-items — phân công của công việc con và nhiệm vụ', () => {
  let workCode;

  beforeEach(async () => {
    const res = await api.post('/api/v1/works', {
      name: 'Công việc cha',
      departmentId: dept.id,
      supervisorIds: [pgdA.id],
      leaderIds: [headA.id, viceA.id],
    });
    workCode = res.body.data.work.code;
  });

  function taoCap2(body) {
    return api.post('/api/v1/work-items', { workRef: workCode, level: 2, name: 'CV con', ...body });
  }

  function taoNhiemVu(body) {
    return api.post('/api/v1/work-items', {
      workRef: workCode,
      level: 3,
      name: 'Nhiệm vụ',
      ...body,
    });
  }

  it('cấp 2 không gửi phân công ⇒ thừa hưởng công việc cha', async () => {
    const res = await taoCap2({});
    expect(res.status).toBe(200);
    expect(res.body.data.item.supervisor_ids).toEqual([pgdA.id]);
    expect(res.body.data.item.leader_ids.sort()).toEqual([headA.id, viceA.id].sort());
  });

  it('cấp 2 chọn lại lãnh đạo phòng khác cha vẫn hợp lệ (không bị ép trùng)', async () => {
    const res = await taoCap2({ leaderIds: [viceA.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.item.leader_ids).toEqual([viceA.id]);
  });

  it('nhiệm vụ trực tiếp: PGD lưu ở supervisor, TP lưu ở leader', async () => {
    const res = await taoNhiemVu({
      assigneeId: staffA.id,
      supervisorIds: [pgdA.id],
      leaderIds: [headA.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.item.leader_ids).toEqual([headA.id]);
    expect(res.body.data.item.supervisor_ids).toEqual([pgdA.id]);
  });

  it('nhiệm vụ trực tiếp: PGD không được đặt nhầm vào leader_ids', async () => {
    const res = await taoNhiemVu({ assigneeId: staffA.id, leaderIds: [pgdA.id] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LEADER_NOT_IN_SOURCE');
  });

  it('nhiệm vụ dưới công việc con: leader thuộc danh sách của công việc con ⇒ ok', async () => {
    const cap2 = await taoCap2({ leaderIds: [viceA.id] });
    const parentCode = cap2.body.data.item.code;
    const res = await taoNhiemVu({
      parentRef: parentCode,
      assigneeId: staffA.id,
      leaderIds: [viceA.id],
    });
    expect(res.status).toBe(200);
  });

  it('nhiệm vụ dưới công việc con: leader ngoài danh sách của nó ⇒ 400 dù là PGD', async () => {
    const cap2 = await taoCap2({ leaderIds: [viceA.id] });
    const parentCode = cap2.body.data.item.code;
    const res = await taoNhiemVu({
      parentRef: parentCode,
      assigneeId: staffA.id,
      leaderIds: [pgdA.id],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LEADER_NOT_IN_SOURCE');
  });

  // Đợt A (D2) LẬT quyết định cũ: cấp 3 GIỜ ĐƯỢC có ô riêng — đúng MỘT người, và phải nằm TRONG
  // tập đã chọn ở cấp 2 chứa nó. Bản trước 028 cấm hẳn (400 `supervisorId`), nay cấm chọn NGOÀI TẬP.
  it('nhiệm vụ dưới cấp2 nhận supervisor riêng NẾU nằm trong tập của cấp2', async () => {
    const sub = await taoCap2({});
    const parentCode = sub.body.data.item.code;
    const res = await taoNhiemVu({
      assigneeId: staffA.id,
      supervisorIds: [pgdA.id],
      parentRef: parentCode,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.item.supervisor_ids).toEqual([pgdA.id]);

    // admin hợp lệ theo VAI (mọi phòng) nhưng cấp 1 không chọn ⇒ vẫn gạt: đúng người theo phòng
    // chưa đủ, phải đúng người theo CÂY.
    const ngoaiTap = await taoNhiemVu({
      assigneeId: staffA.id,
      supervisorIds: [admin.id],
      parentRef: parentCode,
    });
    expect(ngoaiTap.status, JSON.stringify(ngoaiTap.body)).toBe(400);
    expect(ngoaiTap.body.error.code).toBe('SUPERVISOR_NOT_IN_SOURCE');
    expect(ngoaiTap.body.error.field).toBe('supervisorIds');

    // Và đúng MỘT: hai người là 400 (service chặn trước CHECK `task_supervisor_single`).
    const haiNguoi = await taoNhiemVu({
      assigneeId: staffA.id,
      supervisorIds: [pgdA.id, admin.id],
      parentRef: parentCode,
    });
    expect(haiNguoi.status, JSON.stringify(haiNguoi.body)).toBe(400);
  });

  it('nhiệm vụ chọn HAI leader ⇒ 400 (service chặn trước CHECK)', async () => {
    const res = await taoNhiemVu({ leaderIds: [pgdA.id, admin.id] });
    expect(res.status).toBe(400);
  });

  it('CHECK task_leader_single là hàng rào cuối: SQL trực tiếp 2 leader nổ 23514', async () => {
    const tao = await taoNhiemVu({ assigneeId: staffA.id });
    const id = tao.body.data.item.id;
    await expect(
      pool.query('UPDATE work_items SET leader_ids = $1 WHERE id = $2', [[pgdA.id, admin.id], id])
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('sửa nhiệm vụ bỏ cha (về dưới cha trực tiếp) ⇒ leader cũ được kiểm lại nguồn mới', async () => {
    const cap2 = await taoCap2({ leaderIds: [viceA.id] });
    const parentCode = cap2.body.data.item.code;
    const nv = await taoNhiemVu({
      parentRef: parentCode,
      assigneeId: staffA.id,
      leaderIds: [viceA.id],
    });
    // TP/PP hợp lệ cho nhiệm vụ trực tiếp; ô supervisor giữ nguyên người kế thừa từ cấp 2.
    // Đợt A: không còn đổi sang admin được nữa — admin không nằm trong tập cấp 1 đã chọn, mà cấp 3
    // bắt buộc ⊆ cấp trên (D2). Test này giữ đúng ý cũ của nó: leader được kiểm lại theo nguồn mới.
    const res = await api.patch(`/api/v1/work-items/${nv.body.data.item.id}`, {
      parentRef: '',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.item).toMatchObject({
      parent_id: null,
      supervisor_ids: [pgdA.id],
      leader_ids: [viceA.id],
    });
  });
});

describe('Phase8b — nhiệm vụ trực tiếp giữ riêng hai lớp lãnh đạo', () => {
  async function workAndTask(body) {
    const w = await api.post('/api/v1/works', { name: 'Cha trực tiếp', departmentId: dept.id });
    expect(w.status).toBe(200);
    return api.post('/api/v1/work-items', {
      workRef: w.body.data.work.code,
      name: 'Nhiệm vụ',
      level: 3,
      assigneeId: staffA.id,
      ...body,
    });
  }
  it.each(['admin', 'pgd'])(
    'chọn %s: tạo, sửa, GET và RPC mở lại không mất phân công',
    async (vai) => {
      const supervisor = vai === 'admin' ? admin : pgdA;
      const made = await workAndTask({ supervisorIds: [supervisor.id], leaderIds: [viceA.id] });
      expect(made.status, JSON.stringify(made.body)).toBe(200);
      const item = made.body.data.item;
      const edit = await api.patch('/api/v1/work-items/' + item.id, { name: 'Đã sửa tên' });
      expect(edit.status).toBe(200);
      expect(edit.body.data.item).toMatchObject({
        supervisor_ids: [supervisor.id],
        leader_ids: [viceA.id],
        parent_id: null,
      });
      const saved = await api.get('/api/v1/work-items/' + item.id);
      expect(saved.body.data.item).toMatchObject({
        supervisor_ids: [supervisor.id],
        leader_ids: [viceA.id],
      });
      const rpc = await api.post('/api/rpc/getTasks', { args: [] });
      expect(rpc.status).toBe(200);
      expect(rpc.body.data.find((r) => r['Mã nhiệm vụ'] === item.code)).toMatchObject({
        supervisorId: supervisor.id,
        supervisorIds: [supervisor.id],
        leaderIds: [viceA.id],
      });
    }
  );
  it('PGD khác phạm vi bị từ chối, không ghi nửa dòng nhiệm vụ', async () => {
    const outside = await makeLoginUser({
      code: 'NV006',
      email: 'pgd-khac@test.local',
      role: 'Phó Giám đốc',
    });
    const made = await workAndTask({ supervisorIds: [outside.id], leaderIds: [viceA.id] });
    expect(made.status).toBe(400);
    expect((await pool.query('SELECT count(*)::int AS n FROM work_items')).rows[0].n).toBe(0);
  });
  it('người bị khóa không nằm trong ứng viên và không được gán qua API', async () => {
    await pool.query('UPDATE users SET is_active = false WHERE id = ANY($1)', [
      [pgdA.id, viceA.id],
    ]);
    const options = await api.get('/api/v1/departments/assignment-options?departmentId=' + dept.id);
    expect(options.body.data.supervisors.map((u) => u.id)).toEqual([admin.id]);
    expect(options.body.data.leaders.map((u) => u.id)).toEqual([headA.id]);
    expect((await workAndTask({ supervisorIds: [admin.id], leaderIds: [viceA.id] })).status).toBe(
      400
    );
  });
});

// ============================================================================
// 2026-09-09 — TRƯỞNG/PHÓ PHÒNG NHẬN VIỆC TRỰC TIẾP
// ============================================================================
// Ba quyết định người dùng chốt, mỗi quyết định một nhóm ca:
//   · «Trưởng phòng + Phó phòng» được đứng ở ô người thực hiện (Phó GĐ/admin thì KHÔNG — họ thuộc
//     lớp «Ban lãnh đạo phụ trách»);
//   · «Không cho gán TP/PP nếu phòng chưa có Phó GĐ» — vì TP/PP không được tự duyệt kết quả của
//     chính mình, phòng không có Phó GĐ thì file của họ nằm im không ai duyệt được;
//   · «admin/PGĐ + TP/PP CÙNG PHÒNG gán được cho nhau» — ai khác thì 403.
describe('TC-LDTT-A — Trưởng/Phó phòng làm người thực hiện trực tiếp', () => {
  let workCode;
  let deptKhong;
  let headB;

  beforeEach(async () => {
    const res = await api.post('/api/v1/works', {
      name: 'Công việc cha',
      departmentId: dept.id,
      supervisorIds: [pgdA.id],
      leaderIds: [headA.id, viceA.id],
    });
    workCode = res.body.data.work.code;
    // Phòng thứ hai: CÓ Trưởng phòng nhưng KHÔNG có Phó GĐ phụ trách.
    deptKhong = await makeDepartment({ code: 'PH02', name: 'Phòng Điện', sort_order: 2 });
    headB = await makeLoginUser({
      code: 'NV007',
      email: 'head-b@test.local',
      full_name: 'Trưởng phòng B',
      role: 'Trưởng phòng',
      department_id: deptKhong.id,
    });
    await themQuanLy(deptKhong.id, headB.id, 'head');
  });

  const taoNhiemVu = (body, apiKhac = api) =>
    apiKhac.post('/api/v1/work-items', {
      workRef: workCode,
      level: 3,
      name: 'Nhiệm vụ',
      leaderIds: [headA.id],
      ...body,
    });

  const demNhiemVu = async () =>
    (await pool.query('SELECT count(*)::int AS n FROM work_items WHERE level = 3')).rows[0].n;

  it('assignment-options: phòng CÓ Phó GĐ ⇒ trả Trưởng/Phó phòng ở `lanhDaoLamTrucTiep`', async () => {
    const res = await api.get('/api/v1/departments/assignment-options?departmentId=' + dept.id);
    expect(res.status).toBe(200);
    expect(res.body.data.coPhoGiamDocPhuTrach).toBe(true);
    expect(res.body.data.lanhDaoLamTrucTiep.map((u) => u.id).sort((a, b) => a - b)).toEqual(
      [headA.id, viceA.id].sort((a, b) => a - b)
    );
  });

  it('assignment-options: phòng KHÔNG có Phó GĐ ⇒ `lanhDaoLamTrucTiep` rỗng, cờ false', async () => {
    const res = await api.get(
      '/api/v1/departments/assignment-options?departmentId=' + deptKhong.id
    );
    expect(res.status).toBe(200);
    expect(res.body.data.coPhoGiamDocPhuTrach).toBe(false);
    expect(res.body.data.lanhDaoLamTrucTiep).toEqual([]);
    // Ô «Lãnh đạo phòng phụ trách» KHÔNG bị ảnh hưởng — hai ô khác vai, đừng khoá lây.
    expect(res.body.data.leaders.map((u) => u.id)).toEqual([headB.id]);
  });

  it('assignment-options: công việc chung (không phòng) ⇒ không mở lãnh đạo nhận việc trực tiếp', async () => {
    const res = await api.get('/api/v1/departments/assignment-options');
    expect(res.status).toBe(200);
    expect(res.body.data.coPhoGiamDocPhuTrach).toBe(false);
    expect(res.body.data.lanhDaoLamTrucTiep).toEqual([]);
  });

  it('admin gán nhiệm vụ cho Trưởng phòng ⇒ 200, lưu đúng người', async () => {
    const res = await taoNhiemVu({ assigneeId: headA.id });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.item.assignee_id).toBe(headA.id);
  });

  it('Phó phòng CÙNG PHÒNG gán cho Trưởng phòng ⇒ 200 (quyết định «gán được cho nhau»)', async () => {
    const apiVice = client(app);
    await apiVice.login(viceA.email);
    const res = await taoNhiemVu({ assigneeId: headA.id }, apiVice);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.item.assignee_id).toBe(headA.id);
  });

  it('phòng KHÔNG có Phó GĐ ⇒ 400 ASSIGNEE_LEADER_NO_DEPUTY, không ghi dòng nào', async () => {
    const cv = await api.post('/api/v1/works', {
      name: 'Việc phòng chưa có Phó GĐ',
      departmentId: deptKhong.id,
      leaderIds: [headB.id],
    });
    expect(cv.status, JSON.stringify(cv.body)).toBe(200);
    const ma = cv.body.data.work.code;
    const res = await api.post('/api/v1/work-items', {
      workRef: ma,
      level: 3,
      name: 'Nhiệm vụ cho Trưởng phòng B',
      leaderIds: [headB.id],
      assigneeId: headB.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ASSIGNEE_LEADER_NO_DEPUTY');
    expect(res.body.error.message).toContain('chưa có Phó Giám đốc phụ trách');
    // Cùng phòng đó, gán cho Cán bộ thì vẫn bình thường — luật chỉ nhắm hai vai lãnh đạo.
    const canBo = await makeLoginUser({
      code: 'NV008',
      email: 'canbo-b@test.local',
      full_name: 'Cán bộ B',
      department_id: deptKhong.id,
    });
    const ok = await api.post('/api/v1/work-items', {
      workRef: ma,
      level: 3,
      name: 'Nhiệm vụ cho Cán bộ B',
      leaderIds: [headB.id],
      assigneeId: canBo.id,
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
  });

  it('Cán bộ gán nhiệm vụ cho Trưởng phòng ⇒ 403, không ghi dòng nào', async () => {
    const apiStaff = client(app);
    await apiStaff.login(staffA.email);
    const truoc = await demNhiemVu();
    const res = await taoNhiemVu({ assigneeId: headA.id }, apiStaff);
    expect(res.status).toBe(403);
    expect(await demNhiemVu()).toBe(truoc);
  });

  it('Trưởng phòng KHÁC phòng gán cho Trưởng phòng phòng này ⇒ 403, không ghi dòng nào', async () => {
    const apiHeadB = client(app);
    await apiHeadB.login(headB.email);
    const truoc = await demNhiemVu();
    const res = await taoNhiemVu({ assigneeId: headA.id }, apiHeadB);
    expect(res.status).toBe(403);
    expect(await demNhiemVu()).toBe(truoc);
  });

  it('SỬA nhiệm vụ đổi người thực hiện sang Trưởng phòng cũng qua cùng một luật', async () => {
    const tao = await taoNhiemVu({ assigneeId: staffA.id });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);
    const id = tao.body.data.item.id;
    const doi = await api.patch(`/api/v1/work-items/${id}`, { assigneeId: viceA.id });
    expect(doi.status, JSON.stringify(doi.body)).toBe(200);
    expect(doi.body.data.item.assignee_id).toBe(viceA.id);
  });

  it('CHUYỂN công việc sang phòng chưa có Phó GĐ ⇒ chặn, vì nhiệm vụ đang giao cho Trưởng phòng', async () => {
    const tao = await taoNhiemVu({ assigneeId: headA.id });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);
    const workId = (await pool.query('SELECT id FROM works WHERE code = $1', [workCode])).rows[0]
      .id;
    // Đây là đường LÁCH: không gán lại người, chỉ đổi phòng. `assertTreeAssignments` phải bắt được.
    // Đợt A: phải đưa ô «Ban lãnh đạo kiểm soát» sang admin (hợp lệ với MỌI phòng) trong cùng một
    // PATCH, nếu không thì `assertPhanCong` — chạy TRƯỚC — đã 400 vì pgdA không phụ trách phòng đích,
    // và cái hàng rào `ASSIGNEE_LEADER_NO_DEPUTY` mà test này canh sẽ không bao giờ được chạm tới.
    const doi = await api.patch(`/api/v1/works/${workId}`, {
      departmentId: deptKhong.id,
      supervisorIds: [admin.id],
      leaderIds: [headB.id],
    });
    expect(doi.status).toBe(400);
    expect(doi.body.error.code).toBe('ASSIGNEE_LEADER_NO_DEPUTY');
    // Phòng không đổi — dữ liệu cũ còn nguyên.
    const sau = (await pool.query('SELECT department_id FROM works WHERE id = $1', [workId]))
      .rows[0];
    expect(Number(sau.department_id)).toBe(Number(dept.id));
  });
});

// ============================================================================
// 2026-09-12 — MỚI-5: CÁN BỘ LẬP MỚI NHIỆM VỤ CẤP 3 TỰ CHỌN HAI Ô
// ============================================================================
// Người dùng báo: «nhân viên khi được phép tạo nhiệm vụ cấp 3, nhưng không chọn được Ban lãnh đạo
// kiểm soát, Người thực hiện trực tiếp». Lúc LẬP MỚI thì chưa có «việc của mình» nào để mà tự
// duyệt, nên lý do khoá cũ không còn đúng — máy chủ mở lại hai ô cho đúng một trường hợp đó.
// Mở nhưng vẫn BÓ ba lớp: RBAC `create` đòi cùng phòng với công việc và đã có việc trong cây;
// `assertSupervisorsByLevel` đòi BLĐKS cấp 3 nằm trong tập của công việc con chứa nó;
// `assertAssigneeCungPhong` đòi người được giao cùng phòng với người giao.
// SỬA nhiệm vụ có sẵn thì giữ khoá như cũ.
describe('MỚI-5 — Cán bộ lập mới nhiệm vụ cấp 3 tự chọn BLĐKS và người thực hiện', () => {
  let workCode;
  let cap2Code;
  let apiStaff;
  let staffB;
  let viecCuaAId;

  beforeEach(async () => {
    const cv = await api.post('/api/v1/works', {
      name: 'Công việc cha',
      departmentId: dept.id,
      supervisorIds: [pgdA.id],
      leaderIds: [headA.id],
    });
    expect(cv.status, JSON.stringify(cv.body)).toBe(200);
    workCode = cv.body.data.work.code;
    const sub = await api.post('/api/v1/work-items', {
      workRef: workCode,
      level: 2,
      name: 'CV con',
    });
    expect(sub.status, JSON.stringify(sub.body)).toBe(200);
    cap2Code = sub.body.data.item.code;
    staffB = await makeLoginUser({
      code: 'NV009',
      email: 'staff-b@congty.vn',
      full_name: 'Cán bộ B',
      department_id: dept.id,
    });
    // Cán bộ A phải «đã có việc trong cây» thì RBAC mới cho tạo nhiệm vụ cho NGƯỜI KHÁC. Việc này
    // do CHÍNH Cán bộ A lập (không phải admin lập hộ) vì hai ca SỬA bên dưới cần `created_by` là
    // Cán bộ A — khoá «mục đang chờ duyệt chỉ người lập mới sửa được» (ĐỢT B) chặn trước cả hàng rào
    // phân công, để admin lập thì ca SỬA đo nhầm cái khoá kia.
    apiStaff = client(app);
    await apiStaff.login(staffA.email);
    const viecCuaA = await apiStaff.post('/api/v1/work-items', {
      workRef: workCode,
      level: 3,
      name: 'Việc của Cán bộ A',
      parentRef: cap2Code,
      assigneeId: staffA.id,
      supervisorIds: [pgdA.id],
    });
    expect(viecCuaA.status, JSON.stringify(viecCuaA.body)).toBe(200);
    viecCuaAId = viecCuaA.body.data.item.id;
  });

  const taoCap3 = (body) =>
    apiStaff.post('/api/v1/work-items', {
      workRef: workCode,
      level: 3,
      name: 'Nhiệm vụ mới',
      parentRef: cap2Code,
      ...body,
    });

  const demNhiemVuMoi = async () =>
    (await pool.query("SELECT count(*)::int AS n FROM work_items WHERE name = 'Nhiệm vụ mới'"))
      .rows[0].n;

  it('chọn cả BLĐKS lẫn người thực hiện cùng phòng ⇒ 200, lưu đúng hai ô', async () => {
    const res = await taoCap3({ assigneeId: staffB.id, supervisorIds: [pgdA.id] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.item.assignee_id).toBe(staffB.id);
    expect(res.body.data.item.supervisor_ids).toEqual([pgdA.id]);
  });

  it('không gửi BLĐKS ⇒ máy chủ vẫn tự lấy người đầu của công việc con (Q12)', async () => {
    const res = await taoCap3({ assigneeId: staffB.id });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.item.supervisor_ids).toEqual([pgdA.id]);
  });

  it('BLĐKS ngoài tập của công việc con ⇒ 400, không ghi dòng nào', async () => {
    // admin hợp lệ theo VAI (mọi phòng) nhưng công việc con không chọn ⇒ ô mở vẫn không mở bừa.
    const res = await taoCap3({ assigneeId: staffB.id, supervisorIds: [admin.id] });
    expect(res.status).toBe(400);
    expect(await demNhiemVuMoi()).toBe(0);
  });

  it('giao cho người KHÁC PHÒNG ⇒ 403 FORBIDDEN, hàng rào của `assertAssigneeCungPhong`', async () => {
    const ngoaiPhong = await makeLoginUser({
      code: 'NV010',
      email: 'staff-c@congty.vn',
      full_name: 'Cán bộ C',
      department_id: (await makeDepartment({ code: 'PH03', name: 'Phòng Cơ khí', sort_order: 3 }))
        .id,
    });
    const res = await taoCap3({ assigneeId: ngoaiPhong.id, supervisorIds: [pgdA.id] });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('cùng phòng');
    expect(await demNhiemVuMoi()).toBe(0);
  });

  it('SỬA nhiệm vụ có sẵn: đổi BLĐKS ⇒ 403, mở chỉ dành cho lúc LẬP MỚI', async () => {
    const doi = await apiStaff.patch(`/api/v1/work-items/${viecCuaAId}`, {
      supervisorIds: [admin.id],
    });
    expect(doi.status).toBe(403);
    expect(doi.body.error.message).toContain('Chỉ lãnh đạo có quyền phân công');
    const sau = (
      await pool.query('SELECT supervisor_ids FROM work_items WHERE id = $1', [viecCuaAId])
    ).rows[0];
    expect(sau.supervisor_ids.map(Number)).toEqual([pgdA.id]);
  });

  it('SỬA nhiệm vụ có sẵn: đẩy việc của mình sang người khác ⇒ 403 như luật cũ', async () => {
    const doi = await apiStaff.patch(`/api/v1/work-items/${viecCuaAId}`, { assigneeId: staffB.id });
    expect(doi.status).toBe(403);
    expect(doi.body.error.message).toContain('Cán bộ chỉ được tự nhận nhiệm vụ cho mình');
    const sau = (await pool.query('SELECT assignee_id FROM work_items WHERE id = $1', [viecCuaAId]))
      .rows[0];
    expect(Number(sau.assignee_id)).toBe(staffA.id);
  });
});

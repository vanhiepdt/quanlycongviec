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
      supervisorId: pgdA.id,
      leaderIds: [headA.id, viceA.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.work.supervisor_id).toBe(pgdA.id);
    expect(res.body.data.work.leader_ids.sort()).toEqual([headA.id, viceA.id].sort());
  });

  it('supervisor là Trưởng phòng (không phải admin/PGD) → 400', async () => {
    const res = await api.post('/api/v1/works', {
      name: 'X',
      departmentId: dept.id,
      supervisorId: headA.id,
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
    const res = await api.post('/api/v1/works', { name: 'Việc chung', supervisorId: pgdA.id });
    expect(res.status).toBe(200);
    expect(res.body.data.work.department_id).toBeNull();
    expect(res.body.data.work.leader_ids).toEqual([]);
  });

  it('PATCH đổi supervisor sai nguồn → 400, dữ liệu giữ nguyên', async () => {
    const tao = await api.post('/api/v1/works', {
      name: 'X',
      departmentId: dept.id,
      supervisorId: pgdA.id,
    });
    const code = tao.body.data.work.code;
    const res = await api.patch(`/api/v1/works/${code}`, { supervisorId: staffA.id });
    expect(res.status).toBe(400);
    const sau = await pool.query('SELECT supervisor_id FROM works WHERE code = $1', [code]);
    expect(sau.rows[0].supervisor_id).toBe(pgdA.id);
  });
});

describe('POST /api/v1/work-items — phân công của công việc con và nhiệm vụ', () => {
  let workCode;

  beforeEach(async () => {
    const res = await api.post('/api/v1/works', {
      name: 'Công việc cha',
      departmentId: dept.id,
      supervisorId: pgdA.id,
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
    expect(res.body.data.item.supervisor_id).toBe(pgdA.id);
    expect(res.body.data.item.leader_ids.sort()).toEqual([headA.id, viceA.id].sort());
  });

  it('cấp 2 chọn lại lãnh đạo phòng khác cha vẫn hợp lệ (không bị ép trùng)', async () => {
    const res = await taoCap2({ leaderIds: [viceA.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.item.leader_ids).toEqual([viceA.id]);
  });

  it('nhiệm vụ thuộc cha trực tiếp: leader là PGD phụ trách phòng ⇒ ok', async () => {
    const res = await taoNhiemVu({ assigneeId: staffA.id, leaderIds: [pgdA.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.item.leader_ids).toEqual([pgdA.id]);
  });

  it('nhiệm vụ thuộc cha trực tiếp: leader là lãnh đạo phòng ⇒ LEADER_NOT_IN_SOURCE', async () => {
    const res = await taoNhiemVu({ assigneeId: staffA.id, leaderIds: [headA.id] });
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

  it('nhiệm vụ KHÔNG có ô Ban lãnh đạo kiểm soát — gửi khác rỗng ⇒ 400', async () => {
    const res = await taoNhiemVu({ supervisorId: pgdA.id });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('supervisorId');
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
    // Bỏ cha: leader=viceA không còn trong nguồn PGD của cha ⇒ 400, không ghi.
    const res = await api.patch(`/api/v1/work-items/${nv.body.data.item.id}`, { parentRef: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LEADER_NOT_IN_SOURCE');
  });
});

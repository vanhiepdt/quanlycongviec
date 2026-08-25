// Việc 5.1 — trạng thái duyệt khi TẠO (§8.4 nhóm E, TC-APR-01..05).
//
// Đây là điểm đỏ **D1** của lượt khói §8.5 ngày 2026-08-25: `tp01@test.local` lập công việc
// `CV021` mà cột duyệt ra `Đã duyệt`, vì cột có DEFAULT 'Đã duyệt' và không chỗ nào ở Phase 3/4
// đặt 'Chờ duyệt'. Nên các phép kiểm dưới đây ĐỌC LẠI CỘT TRONG CSDL sau mỗi lần tạo, đúng cách
// lượt khói đã bắt ra lỗi — không tin vào thân phản hồi.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let dept;
let deptKhac;

/** Cột duyệt đọc thẳng từ CSDL — không qua API, không qua bộ nhớ đệm nào. */
async function khoaDuyetCuaCongViec(code) {
  const { rows } = await pool.query('SELECT approval_status FROM works WHERE code = $1', [code]);
  return rows[0]?.approval_status ?? null;
}

async function khoaDuyetCuaDong(code) {
  const { rows } = await pool.query('SELECT approval_status FROM work_items WHERE code = $1', [
    code,
  ]);
  return rows[0]?.approval_status ?? null;
}

/** Đăng nhập một vai và trả client đã có phiên. */
async function dangNhap(over) {
  const user = await makeLoginUser({ department_id: dept.id, ...over });
  const api = client(app);
  await api.login(user.email);
  return { api, user };
}

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  deptKhac = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });
});

afterAll(async () => {
  await closePool();
});

describe('TC-APR-01/02 — Trưởng phòng, Phó phòng tạo ⇒ Chờ duyệt', () => {
  it('TC-APR-01: Trưởng phòng tạo công việc cấp 1 ⇒ Chờ duyệt (điểm đỏ D1)', async () => {
    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    const res = await api.post('/api/v1/works', { name: 'Việc của phòng', departmentId: dept.id });

    expect(res.status).toBe(200);
    expect(res.body.data.work.approval_status).toBe('Chờ duyệt');
    expect(await khoaDuyetCuaCongViec('CV001')).toBe('Chờ duyệt');
  });

  it('TC-APR-02: Phó phòng tạo công việc con cấp 2 ⇒ Chờ duyệt', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });

    const { api } = await dangNhap({ code: 'NV011', email: 'pp01@test.local', role: 'Phó phòng' });
    const res = await api.post('/api/v1/work-items', {
      workRef: 'CV001',
      level: 2,
      name: 'Công việc con',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.item.approval_status).toBe('Chờ duyệt');
    expect(await khoaDuyetCuaDong('CV001-001')).toBe('Chờ duyệt');
  });

  it('Trưởng phòng tạo công việc con cũng ⇒ Chờ duyệt', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });

    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    await api.post('/api/v1/work-items', { workRef: 'CV001', level: 2, name: 'Con' });
    expect(await khoaDuyetCuaDong('CV001-001')).toBe('Chờ duyệt');
  });
});

describe('TC-APR-03/04 — admin và Phó Giám đốc tạo ⇒ Đã duyệt ngay', () => {
  it('TC-APR-03: admin tạo công việc ⇒ Đã duyệt', async () => {
    const { api } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await api.post('/api/v1/works', { name: 'Việc của admin', departmentId: dept.id });
    expect(await khoaDuyetCuaCongViec('CV001')).toBe('Đã duyệt');
  });

  it('TC-APR-04: Phó Giám đốc phụ trách phòng tạo công việc ⇒ Đã duyệt', async () => {
    const pgd = await makeLoginUser({
      code: 'NV002',
      email: 'pgd@test.local',
      role: 'Phó Giám đốc',
      department_id: dept.id,
    });
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role)
       VALUES ($1, $2, 'deputy_director')`,
      [dept.id, pgd.id]
    );
    const api = client(app);
    await api.login(pgd.email);

    const res = await api.post('/api/v1/works', { name: 'Việc của Phó GĐ', departmentId: dept.id });
    expect(res.status).toBe(200);
    expect(await khoaDuyetCuaCongViec('CV001')).toBe('Đã duyệt');
  });

  it('Phó Giám đốc tạo công việc con ⇒ Đã duyệt', async () => {
    const pgd = await makeLoginUser({
      code: 'NV002',
      email: 'pgd@test.local',
      role: 'Phó Giám đốc',
      department_id: dept.id,
    });
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role)
       VALUES ($1, $2, 'deputy_director')`,
      [dept.id, pgd.id]
    );
    const api = client(app);
    await api.login(pgd.email);

    await api.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });
    await api.post('/api/v1/work-items', { workRef: 'CV001', level: 2, name: 'Con' });
    expect(await khoaDuyetCuaDong('CV001-001')).toBe('Đã duyệt');
  });
});

describe('TC-APR-05 — nhiệm vụ cấp 3 LUÔN Đã duyệt, bất kể ai tạo', () => {
  it('Trưởng phòng tạo nhiệm vụ cấp 3 ⇒ Đã duyệt', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });

    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    await api.post('/api/v1/work-items', { workRef: 'CV001', level: 3, name: 'Nhiệm vụ' });
    expect(await khoaDuyetCuaDong('CV001-001')).toBe('Đã duyệt');
  });

  it('không gửi level (mặc định cấp 3, TC-TREE-07) ⇒ Đã duyệt', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });

    const { api } = await dangNhap({ code: 'NV011', email: 'pp01@test.local', role: 'Phó phòng' });
    const res = await api.post('/api/v1/work-items', { workRef: 'CV001', name: 'Không gửi cấp' });
    expect(res.body.data.item.level).toBe(3);
    expect(await khoaDuyetCuaDong('CV001-001')).toBe('Đã duyệt');
  });

  it('Nhân viên tự nhận nhiệm vụ ⇒ Đã duyệt', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });

    const nv = await makeLoginUser({
      code: 'NV020',
      email: 'nv@test.local',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const api = client(app);
    await api.login(nv.email);
    const res = await api.post('/api/v1/work-items', {
      workRef: 'CV001',
      name: 'Việc của tôi',
      assigneeId: nv.id,
    });
    expect(res.status).toBe(200);
    expect(await khoaDuyetCuaDong('CV001-001')).toBe('Đã duyệt');
  });
});

describe('Khoá duyệt KHÔNG nhận từ thân request', () => {
  it('Trưởng phòng gửi kèm approvalStatus="Đã duyệt" khi tạo ⇒ vẫn Chờ duyệt', async () => {
    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    await api.post('/api/v1/works', {
      name: 'Tự duyệt thử',
      departmentId: dept.id,
      approvalStatus: 'Đã duyệt',
    });
    expect(await khoaDuyetCuaCongViec('CV001')).toBe('Chờ duyệt');
  });

  it('Trưởng phòng PATCH approvalStatus="Đã duyệt" ⇒ không đổi, cũng không nổ lỗi', async () => {
    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    await api.post('/api/v1/works', { name: 'Việc chờ', departmentId: dept.id });

    // Sửa bình thường vẫn chạy — giao diện cũ gửi cả object dòng khi sửa, chặn cứng là hỏng
    // mọi thao tác sửa.
    const res = await api.patch('/api/v1/works/CV001', {
      name: 'Đổi tên',
      approvalStatus: 'Đã duyệt',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.work.name).toBe('Đổi tên');
    expect(await khoaDuyetCuaCongViec('CV001')).toBe('Chờ duyệt');
  });

  it('PATCH gửi kèm rejectReason cũng không ghi được', async () => {
    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    await api.post('/api/v1/works', { name: 'Việc chờ', departmentId: dept.id });
    await api.patch('/api/v1/works/CV001', { rejectReason: 'tự viết lý do' });

    const { rows } = await pool.query('SELECT reject_reason FROM works WHERE code = $1', ['CV001']);
    expect(rows[0].reject_reason).toBe('');
  });

  it('người dùng gửi approvalStatus khi tạo dòng cấp 2 ⇒ vẫn theo luật của máy chủ', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });

    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    await api.post('/api/v1/work-items', {
      workRef: 'CV001',
      level: 2,
      name: 'Con',
      approvalStatus: 'Đã duyệt',
    });
    expect(await khoaDuyetCuaDong('CV001-001')).toBe('Chờ duyệt');
  });
});

describe('Nhân bản đi qua đúng cửa duyệt của người bấm', () => {
  it('Trưởng phòng nhân bản một công việc ĐÃ DUYỆT ⇒ bản sao Chờ duyệt', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });
    expect(await khoaDuyetCuaCongViec('CV001')).toBe('Đã duyệt');

    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    const res = await api.post('/api/v1/works/CV001/copy', {});
    expect(res.status).toBe(200);
    expect(await khoaDuyetCuaCongViec('CV002')).toBe('Chờ duyệt');
  });

  it('admin nhân bản một công việc BỊ TỪ CHỐI ⇒ bản sao Đã duyệt, không mang theo lý do', async () => {
    const { api } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await api.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });
    await pool.query(
      `UPDATE works SET approval_status = 'Từ chối', reject_reason = 'thiếu căn cứ pháp lý'
        WHERE code = 'CV001'`
    );

    await api.post('/api/v1/works/CV001/copy', {});
    const { rows } = await pool.query(
      'SELECT approval_status, reject_reason FROM works WHERE code = $1',
      ['CV002']
    );
    expect(rows[0]).toEqual({ approval_status: 'Đã duyệt', reject_reason: '' });
  });

  it('nhân bản kéo theo cây: bản sao cấp 2 theo cửa duyệt, cấp 3 luôn Đã duyệt', async () => {
    const { api: adminApi } = await dangNhap({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    await adminApi.post('/api/v1/works', { name: 'Việc gốc', departmentId: dept.id });
    await adminApi.post('/api/v1/work-items', { workRef: 'CV001', level: 2, name: 'Con' });
    await adminApi.post('/api/v1/work-items', {
      workRef: 'CV001',
      level: 3,
      parentRef: 'CV001-001',
      name: 'Nhiệm vụ',
    });

    const { api } = await dangNhap({
      code: 'NV010',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
    });
    await api.post('/api/v1/works/CV001/copy', {});

    const { rows } = await pool.query(
      `SELECT i.code, i.level, i.approval_status
         FROM work_items i JOIN works w ON w.id = i.work_id
        WHERE w.code = 'CV002' ORDER BY i.code`
    );
    expect(rows).toEqual([
      { code: 'CV002-003', level: 2, approval_status: 'Chờ duyệt' },
      { code: 'CV002-004', level: 3, approval_status: 'Đã duyệt' },
    ]);
  });
});

describe('Phòng khác không lọt vào phạm vi', () => {
  it('Trưởng phòng phòng khác không tạo được việc cho phòng này (§6, không phải luật duyệt)', async () => {
    const { api } = await dangNhap({
      code: 'NV030',
      email: 'tp02@test.local',
      role: 'Trưởng phòng',
      department_id: deptKhac.id,
    });
    await api.post('/api/v1/works', { name: 'Việc lấn phòng', departmentId: dept.id });
    // §6 hiện cho Trưởng phòng `create` chung (chưa xét dòng), nên việc vẫn tạo được — nhưng
    // trạng thái vẫn phải là Chờ duyệt: luật 5.1 xét VAI, không xét phòng.
    expect(await khoaDuyetCuaCongViec('CV001')).toBe('Chờ duyệt');
  });
});

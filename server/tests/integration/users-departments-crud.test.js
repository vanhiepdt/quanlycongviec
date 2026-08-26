// REST CRUD người dùng + phòng — việc 5.11. Chạy qua HTTP thật trên Postgres thật.
//
// Bốn câu hỏi:
//   1. Admin thêm/sửa/xoá được; mã do máy chủ sinh; mật khẩu không ra ngoài.
//   2. Nhân viên / Phó Giám đốc đọc được, GHI thì 403 — không nới §6.
//   3. Form cũ: `Admin` → `admin`, `Quản lý` → `Quản lý công việc`; mật khẩu rỗng lúc sửa = giữ nguyên.
//   4. Xoá phòng còn người ⇒ 409 đúng câu tiếng Việt bản cũ; email trùng ⇒ 409.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { COL } from '../../src/rpc/legacyFields.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser, TEST_PASSWORD } from '../helpers/http.js';

const app = createApp();
let api;
let dept;
let admin;

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({
    code: 'NV001',
    email: 'admin@congty.vn',
    role: 'admin',
    full_name: 'Quản trị',
  });
  api = client(app);
  await api.login(admin.email);
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/v1/users — đọc', () => {
  it('ai cũng đọc được danh sách, không có password_hash', async () => {
    const res = await api.get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    const person = res.body.data.people[0];
    expect(person.email).toBe('admin@congty.vn');
    expect(person.name).toBe('Quản trị');
    expect(person).not.toHaveProperty('password_hash');
    expect(Object.keys(person)).not.toContain('password_hash');
  });

  it('Nhân viên cũng đọc được (ma trận §6: user.read = mọi vai)', async () => {
    const nv = await makeLoginUser({
      code: 'NV002',
      email: 'nv@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const other = client(app);
    await other.login(nv.email);
    const res = await other.get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
  });
});

describe('POST/PATCH/DELETE /api/v1/users — ghi chỉ admin', () => {
  it('admin tạo được, mã NV002 (NV001 đã có), must_change_password = true', async () => {
    const res = await api.post('/api/v1/users', {
      name: 'Nguyễn Văn B',
      email: 'b@congty.vn',
      password: TEST_PASSWORD,
      role: 'Nhân viên',
      departmentId: dept.id,
      deptRole: 'Nhân viên',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.person.code).toBe('NV002');
    expect(res.body.data.person.full_name).toBe('Nguyễn Văn B');
    expect(res.body.data.person.must_change_password).toBe(true);
    expect(res.body.data.person).not.toHaveProperty('password_hash');
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE code = $1', ['NV002']);
    expect(rows[0].password_hash).not.toBe(TEST_PASSWORD);
    expect(rows[0].password_hash.startsWith('$2')).toBe(true);
  });

  it('nhãn form Admin → admin, Quản lý → Quản lý công việc', async () => {
    const a = await api.post('/api/v1/users', {
      name: 'Người Admin',
      email: 'a2@congty.vn',
      password: TEST_PASSWORD,
      role: 'Admin',
    });
    expect(a.status).toBe(200);
    expect(a.body.data.person.role).toBe('admin');

    const q = await api.post('/api/v1/users', {
      name: 'Người QL',
      email: 'ql@congty.vn',
      password: TEST_PASSWORD,
      role: 'Quản lý',
    });
    expect(q.status).toBe(200);
    expect(q.body.data.person.role).toBe('Quản lý công việc');
  });

  it('email trùng → 409 CONFLICT tiếng Việt', async () => {
    const res = await api.post('/api/v1/users', {
      name: 'Trùng',
      email: 'admin@congty.vn',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('Email');
  });

  it('thiếu tên → 400', async () => {
    const res = await api.post('/api/v1/users', { email: 'x@congty.vn', password: TEST_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('name');
  });

  it('Nhân viên không được tạo → 403', async () => {
    const nv = await makeLoginUser({
      code: 'NV002',
      email: 'nv@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const other = client(app);
    await other.login(nv.email);
    const res = await other.post('/api/v1/users', {
      name: 'Lén',
      email: 'len@congty.vn',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH mật khẩu rỗng = giữ nguyên băm', async () => {
    const created = await api.post('/api/v1/users', {
      name: 'Giữ mật',
      email: 'giu@congty.vn',
      password: TEST_PASSWORD,
    });
    const code = created.body.data.person.code;
    const { rows: before } = await pool.query('SELECT password_hash FROM users WHERE code = $1', [
      code,
    ]);
    const res = await api.patch(`/api/v1/users/${code}`, { name: 'Đổi tên', password: '' });
    expect(res.status).toBe(200);
    expect(res.body.data.person.full_name).toBe('Đổi tên');
    const { rows: after } = await pool.query('SELECT password_hash FROM users WHERE code = $1', [
      code,
    ]);
    expect(after[0].password_hash).toBe(before[0].password_hash);
  });

  it('xoá chính mình → 409; xoá người khác được', async () => {
    const created = await api.post('/api/v1/users', {
      name: 'Xoá được',
      email: 'xoa@congty.vn',
      password: TEST_PASSWORD,
    });
    const self = await api.del(`/api/v1/users/${admin.code}`);
    expect(self.status).toBe(409);
    const gone = await api.del(`/api/v1/users/${created.body.data.person.code}`);
    expect(gone.status).toBe(200);
    expect(gone.body.data.deletedUser).toBe(created.body.data.person.code);
  });

  it('Nhà cung cấp không mật khẩu vẫn tạo được, không đăng nhập được', async () => {
    const res = await api.post('/api/v1/users', {
      name: 'Công ty ABC',
      objectType: 'Nhà cung cấp',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.person.object_type).toBe('Nhà cung cấp');
    expect(res.body.data.person.must_change_password).toBe(false);
    const guest = client(app);
    const login = await guest.post('/api/v1/auth/login', {
      email: res.body.data.person.email,
      password: 'gi-cung-sai-12',
    });
    expect(login.status).toBe(401);
  });
});

describe('CRUD /api/v1/departments', () => {
  it('admin tạo phòng, mã PH02 (PH01 đã có), gán Phó GĐ theo email', async () => {
    const pgd = await makeLoginUser({
      code: 'NV002',
      email: 'pgd@congty.vn',
      role: 'Phó Giám đốc',
      full_name: 'Phó GĐ Một',
    });
    const res = await api.post('/api/v1/departments', {
      name: 'Phòng Mới',
      directorEmail: pgd.email,
      sortOrder: 3,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.department.code).toBe('PH02');
    expect(res.body.data.department.directorEmails).toEqual(['pgd@congty.vn']);
  });

  it('GET /context vẫn chạy — chữ context không bị bắt làm :id', async () => {
    const res = await api.get('/api/v1/departments/context');
    expect(res.status).toBe(200);
    expect(res.body.data.departments[0].code).toBe('PH01');
  });

  it('tên phòng trùng (hoa/thường) → 409', async () => {
    const res = await api.post('/api/v1/departments', { name: 'phòng kỹ thuật' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/đã tồn tại/i);
  });

  it('email Phó GĐ không có trong hệ thống → 400, không bỏ qua im lặng', async () => {
    const res = await api.post('/api/v1/departments', {
      name: 'Phòng Lạ',
      directorEmail: 'khong-co@congty.vn',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('khong-co@congty.vn');
  });

  it('xoá phòng còn người → 409 đúng câu bản cũ', async () => {
    await makeLoginUser({
      code: 'NV002',
      email: 'nv@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const res = await api.del(`/api/v1/departments/${dept.code}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Còn ');
    expect(res.body.error.message).toContain('người thuộc phòng');
    expect(await pool.query('SELECT count(*)::int AS n FROM departments')).toMatchObject({
      rows: [{ n: 1 }],
    });
  });

  it('xoá phòng rỗng được', async () => {
    const empty = await api.post('/api/v1/departments', { name: 'Phòng trống' });
    const res = await api.del(`/api/v1/departments/${empty.body.data.department.code}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedDepartment).toBe(empty.body.data.department.code);
  });

  it('Nhân viên không được tạo phòng → 403', async () => {
    const nv = await makeLoginUser({
      code: 'NV002',
      email: 'nv@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const other = client(app);
    await other.login(nv.email);
    const res = await other.post('/api/v1/departments', { name: 'Phòng lén' });
    expect(res.status).toBe(403);
  });
});

describe('cầu RPC nhân sự / phòng', () => {
  const rpc = (name, args = []) => api.post(`/api/rpc/${name}`, { args });

  it('getStaffList trả mảng khoá COL.S_*, mật khẩu luôn rỗng', async () => {
    const res = await rpc('getStaffList', []);
    expect(res.status).toBe(200);
    const list = res.body.data;
    expect(Array.isArray(list)).toBe(true);
    expect(list[0][COL.S_ID]).toBe('NV001');
    expect(list[0][COL.S_NAME]).toBe('Quản trị');
    expect(list[0][COL.S_PASSWORD]).toBe('');
    expect(list[0][COL.S_EMAIL]).toBe('admin@congty.vn');
  });

  it('addStaffWithAuth trả staffId là mã; form Admin ánh xạ đúng', async () => {
    const res = await rpc('addStaffWithAuth', [
      {
        name: 'Người mới',
        email: 'moi@congty.vn',
        password: TEST_PASSWORD,
        role: 'Admin',
        department: dept.name,
        deptRole: 'Nhân viên',
      },
    ]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.staffId).toMatch(/^NV\d{3}$/);
    const { rows } = await pool.query('SELECT role FROM users WHERE code = $1', [
      res.body.data.staffId,
    ]);
    expect(rows[0].role).toBe('admin');
  });

  it('addDepartmentWithAuth trả departmentId là mã PH', async () => {
    const res = await rpc('addDepartmentWithAuth', [{ name: 'Phòng RPC', order: 8 }]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.departmentId).toMatch(/^PH\d{2}$/);
  });

  it('deleteDepartmentWithAuth còn người → 409 câu tiếng Việt', async () => {
    await makeLoginUser({
      code: 'NV002',
      email: 'nv@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const res = await rpc('deleteDepartmentWithAuth', [dept.code]);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Chuyển họ sang phòng khác trước khi xoá');
  });
});

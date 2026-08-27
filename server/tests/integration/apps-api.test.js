// Quản lý App (§2.7 nhóm G, §7 việc 7.2) — chạy qua HTTP thật trên Postgres thật.
//
// Hai ca chốt của §8.4:
//   TC-MISC-05 Nhân viên gọi thêm app ⇒ 403 (chỉ admin được thêm / sửa / xoá)
//   TC-MISC-06 `allowed_roles` quyết định ai thấy app nào; RỖNG = mọi vai trò đều thấy
//
// Lọc theo vai trò làm ở SQL (`modules/apps/repo.js`), nên test kiểm luôn rằng dòng không được
// thấy KHÔNG có trong phản hồi — không phải chỉ bị ẩn ở giao diện.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { COL } from '../../src/rpc/legacyFields.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let admin;
let truongA;
let nhanVienA;

/** Đăng nhập một người và trả client riêng của người đó. */
async function nhuLa(user) {
  const api = client(app);
  const res = await api.login(user.email);
  expect(res.status, `đăng nhập ${user.email}`).toBe(200);
  return api;
}

async function seed() {
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1 });
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  truongA = await makeLoginUser({
    code: 'NV002',
    email: 'truong-a@congty.vn',
    full_name: 'Trưởng phòng A',
    role: 'Trưởng phòng',
    department_id: phongA.id,
  });
  nhanVienA = await makeLoginUser({
    code: 'NV003',
    email: 'nv-a@congty.vn',
    full_name: 'Cán bộ A',
    department_id: phongA.id,
  });
}

/** Tạo app trực tiếp bằng SQL — dùng cho ca chỉ cần dữ liệu sẵn, không kiểm đường ghi. */
async function themApp(over = {}) {
  const a = {
    code: 'APP001',
    name: 'Cổng nhân sự',
    url: 'https://hr.congty.vn',
    category: 'NHÂN SỰ',
    allowed_roles: [],
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO apps (code, name, url, category, allowed_roles, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [a.code, a.name, a.url, a.category, a.allowed_roles, a.created_by ?? admin.id]
  );
  return rows[0];
}

beforeEach(async () => {
  await resetTables();
  await seed();
});

afterAll(async () => {
  await closePool();
});

// ============================================================================
describe('TC-MISC-05: chỉ admin được thêm / sửa / xoá ứng dụng', () => {
  it('Nhân viên gọi POST /apps ⇒ 403, bảng không có dòng nào', async () => {
    const api = await nhuLa(nhanVienA);
    const res = await api.post('/api/v1/apps', {
      name: 'App lạ',
      url: 'https://vidu.vn',
      category: 'khác',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Chỉ admin');

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM apps');
    expect(rows[0].n).toBe(0);
  });

  it('Trưởng phòng cũng không sửa, không xoá được app', async () => {
    const created = await themApp();
    const api = await nhuLa(truongA);

    const sua = await api.patch(`/api/v1/apps/${created.code}`, { name: 'Đổi tên' });
    expect(sua.status).toBe(403);
    const xoa = await api.del(`/api/v1/apps/${created.code}`);
    expect(xoa.status).toBe(403);

    const { rows } = await pool.query('SELECT name FROM apps WHERE code = $1', [created.code]);
    expect(rows[0].name).toBe('Cổng nhân sự');
  });

  it('admin thêm ⇒ 201, mã APP001, danh mục viết hoa, allowed_roles chuẩn hoá', async () => {
    const api = await nhuLa(admin);
    const res = await api.post('/api/v1/apps', {
      name: 'Cổng nhân sự',
      url: 'https://hr.congty.vn',
      iconUrl: 'https://hr.congty.vn/icon.png',
      description: 'Tra cứu hồ sơ',
      category: 'nhân sự',
      allowedRoles: 'Admin, Trưởng phòng',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.app.code).toBe('APP001');
    expect(res.body.data.app.category).toBe('NHÂN SỰ');
    // Nhãn cũ «Admin» của form được FORM_ROLE_MAP đưa về tên vai trò thật.
    expect(res.body.data.app.allowed_roles).toEqual(['admin', 'Trưởng phòng']);
    expect(res.body.data.app.created_by).toBe(admin.id);
  });

  it('POST không có token CSRF ⇒ 403 và không ghi gì', async () => {
    const api = await nhuLa(admin);
    const res = await api.post(
      '/api/v1/apps',
      { name: 'App lạ', url: 'https://vidu.vn' },
      { csrf: null }
    );
    expect(res.status).toBe(403);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM apps');
    expect(rows[0].n).toBe(0);
  });

  it('tên rỗng ⇒ 400; vai trò sai tên ⇒ 400 nói rõ tên sai', async () => {
    const api = await nhuLa(admin);
    const trong = await api.post('/api/v1/apps', { name: '   ', url: 'https://vidu.vn' });
    expect(trong.status).toBe(400);
    expect(trong.body.error.field).toBe('name');

    const sai = await api.post('/api/v1/apps', {
      name: 'App',
      url: 'https://vidu.vn',
      allowedRoles: ['Trưởng phòng', 'Giám đốc'],
    });
    expect(sai.status).toBe(400);
    expect(sai.body.error.field).toBe('allowedRoles');
    expect(sai.body.error.message).toContain('Giám đốc');
  });

  it('sửa app không tồn tại ⇒ 404 (kiểm quyền trước, nhưng admin thì tới được lớp dò)', async () => {
    const api = await nhuLa(admin);
    const res = await api.patch('/api/v1/apps/APP999', { name: 'X' });
    expect(res.status).toBe(404);
  });

  it('chưa đăng nhập ⇒ 401 cho cả đọc và ghi', async () => {
    const api = client(app);
    expect((await api.get('/api/v1/apps')).status).toBe(401);
    expect((await api.post('/api/v1/apps', { name: 'X' })).status).toBe(401);
  });
});

// ============================================================================
describe('TC-MISC-06: allowed_roles quyết định ai thấy app nào', () => {
  beforeEach(async () => {
    await themApp({ code: 'APP001', name: 'App mọi người', allowed_roles: [] });
    await themApp({
      code: 'APP002',
      name: 'App trưởng phòng',
      category: 'QUẢN LÝ',
      allowed_roles: ['Trưởng phòng'],
    });
    await themApp({
      code: 'APP003',
      name: 'App admin',
      category: 'HỆ THỐNG',
      allowed_roles: ['admin'],
    });
  });

  it('Nhân viên chỉ thấy app rỗng quyền — hai app kia KHÔNG qua dây', async () => {
    const api = await nhuLa(nhanVienA);
    const res = await api.get('/api/v1/apps');
    expect(res.status).toBe(200);
    expect(res.body.data.apps.map((a) => a.code)).toEqual(['APP001']);
    expect(res.body.data.total).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain('App trưởng phòng');
  });

  it('Trưởng phòng thấy app rỗng quyền + app của vai mình', async () => {
    const api = await nhuLa(truongA);
    const res = await api.get('/api/v1/apps');
    expect(res.body.data.apps.map((a) => a.code).sort()).toEqual(['APP001', 'APP002']);
  });

  it('admin thấy tất cả, kể cả app phân quyền hẹp', async () => {
    const api = await nhuLa(admin);
    const res = await api.get('/api/v1/apps');
    expect(res.body.data.apps).toHaveLength(3);
  });

  it('GET /apps/:id app không dành cho mình ⇒ 403, không lộ nội dung', async () => {
    const api = await nhuLa(nhanVienA);
    const res = await api.get('/api/v1/apps/APP003');
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('App admin');
  });

  it('admin đổi allowed_roles ⇒ người vừa mất quyền không còn thấy app', async () => {
    const adminApi = await nhuLa(admin);
    const sua = await adminApi.patch('/api/v1/apps/APP002', { allowedRoles: ['Phó phòng'] });
    expect(sua.status).toBe(200);
    expect(sua.body.data.app.allowed_roles).toEqual(['Phó phòng']);

    const api = await nhuLa(truongA);
    const res = await api.get('/api/v1/apps');
    expect(res.body.data.apps.map((a) => a.code)).toEqual(['APP001']);
  });

  it('đặt allowedRoles = [] ⇒ trở lại mọi vai trò đều thấy', async () => {
    const adminApi = await nhuLa(admin);
    await adminApi.patch('/api/v1/apps/APP003', { allowedRoles: [] });

    const api = await nhuLa(nhanVienA);
    const res = await api.get('/api/v1/apps');
    expect(res.body.data.apps.map((a) => a.code).sort()).toEqual(['APP001', 'APP003']);
  });

  it('PATCH không gửi trường nào thì không đụng cột nào', async () => {
    const api = await nhuLa(admin);
    const res = await api.patch('/api/v1/apps/APP002', {});
    expect(res.status).toBe(200);
    expect(res.body.data.app.name).toBe('App trưởng phòng');
    expect(res.body.data.app.allowed_roles).toEqual(['Trưởng phòng']);
  });

  it('admin xoá ⇒ deletedApp là mã, dòng biến mất', async () => {
    const api = await nhuLa(admin);
    const res = await api.del('/api/v1/apps/APP002');
    expect(res.status).toBe(200);
    expect(res.body.data.deletedApp).toBe('APP002');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM apps');
    expect(rows[0].n).toBe(2);
  });
});

// ============================================================================
describe('cầu RPC: addApp / updateApp / deleteApp', () => {
  let api;

  beforeEach(async () => {
    api = await nhuLa(admin);
  });

  const rpc = (name, args = []) => api.post(`/api/rpc/${name}`, { args });

  it('addApp nhận khoá COL.A_* và trả {success, id, appId}', async () => {
    const res = await rpc('addApp', [
      {
        [COL.A_CATEGORY]: 'nhân sự',
        [COL.A_NAME]: 'Cổng nhân sự',
        [COL.A_URL]: 'https://hr.congty.vn',
        [COL.A_ICON]: 'https://hr.congty.vn/icon.png',
        [COL.A_DESC]: 'Tra cứu hồ sơ',
        [COL.A_PERMISSIONS]: 'Trưởng phòng, Nhân viên',
      },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.id).toBe('APP001');
    expect(res.body.data.appId).toBe('APP001');

    const { rows } = await pool.query('SELECT * FROM apps WHERE code = $1', ['APP001']);
    expect(rows[0].category).toBe('NHÂN SỰ');
    expect(rows[0].allowed_roles).toEqual(['Trưởng phòng', 'Nhân viên']);
    expect(rows[0].created_by).toBe(admin.id);
  });

  it('updateApp sửa theo MÃ (data-id của nút Sửa) và deleteApp trả deletedApp', async () => {
    await rpc('addApp', [{ [COL.A_NAME]: 'Cổng nhân sự', [COL.A_URL]: 'https://hr.congty.vn' }]);

    const sua = await rpc('updateApp', ['APP001', { [COL.A_NAME]: 'Cổng nhân sự v2' }]);
    expect(sua.status).toBe(200);
    expect(sua.body.data.success).toBe(true);
    expect(sua.body.data.id).toBe('APP001');
    expect(sua.body.data.appId).toBe('APP001');

    const xoa = await rpc('deleteApp', ['APP001']);
    expect(xoa.status).toBe(200);
    expect(xoa.body.data.success).toBe(true);
    expect(xoa.body.data.deletedApp).toBe('APP001');
  });

  it('updateApp / deleteApp thiếu mã ⇒ 400', async () => {
    expect((await rpc('updateApp', [null, { [COL.A_NAME]: 'X' }])).status).toBe(400);
    expect((await rpc('deleteApp', [])).status).toBe(400);
  });

  it('Nhân viên gọi addApp qua cầu RPC cũng 403 — cầu không phải đường vòng', async () => {
    const nvApi = await nhuLa(nhanVienA);
    const res = await nvApi.post('/api/rpc/addApp', {
      args: [{ [COL.A_NAME]: 'App lạ', [COL.A_URL]: 'https://vidu.vn' }],
    });
    expect(res.status).toBe(403);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM apps');
    expect(rows[0].n).toBe(0);
  });

  it('gói dữ liệu đầu (getDataForUser) có apps khoá COL.A_*, đã lọc theo vai trò', async () => {
    await themApp({ code: 'APP001', name: 'App mọi người', allowed_roles: [] });
    await themApp({
      code: 'APP002',
      name: 'App admin',
      category: 'HỆ THỐNG',
      allowed_roles: ['admin'],
    });

    const cuaAdmin = await rpc('getDataForUser');
    expect(cuaAdmin.body.data.apps).toHaveLength(2);
    const dong = cuaAdmin.body.data.apps.find((a) => a[COL.A_ID] === 'APP002');
    expect(dong[COL.A_NAME]).toBe('App admin');
    expect(dong[COL.A_CATEGORY]).toBe('HỆ THỐNG');
    expect(dong[COL.A_PERMISSIONS]).toBe('admin');

    const nvApi = await nhuLa(nhanVienA);
    const cuaNhanVien = await nvApi.post('/api/rpc/getDataForUser', { args: [] });
    expect(cuaNhanVien.body.data.apps.map((a) => a[COL.A_ID])).toEqual(['APP001']);
  });
});

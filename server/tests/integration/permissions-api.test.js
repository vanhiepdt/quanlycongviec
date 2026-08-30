// API «Bảng phân quyền hệ thống» — GET/PUT /api/v1/permissions, chỉ admin (Vòng 9, 2026-08-29).
//
// admin sửa bảng bằng dropdown ở trang Quản lý tài khoản; giá trị ghi vào permission_overrides
// (009) và `attachSession` nạp vào `user.ghiDe` MỖI request nên có hiệu lực NGAY, không cần đăng
// nhập lại. can() đọc ghi đè: 'tu-choi' tắt quyền, 'cho-phep' mở khi ma trận từ chối (inScope
// vẫn xét), 'cho-duyet' mở + dòng mới rơi vào «Chờ duyệt».
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { flushAudit } from '../../src/middleware/audit.js';
import { makeDepartment, makeWork, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let api, admin, tp, phong;

const ghiDe = (vai, entityType, action, giaTri) => ({ vai, entityType, action, giaTri });

beforeEach(async () => {
  await resetTables();
  phong = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  tp = await makeLoginUser({
    code: 'NV002',
    email: 'tp@congty.vn',
    role: 'Trưởng phòng',
    department_id: phong.id,
  });
  api = client(app);
  await api.login(admin.email);
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/v1/permissions', () => {
  it('TC-PQ-01: admin đọc ma trận mặc định + ghi đè rỗng', async () => {
    const res = await api.get('/api/v1/permissions');
    expect(res.status).toBe(200);
    expect(res.body.data.macDinh['Trưởng phòng'].work).toContain('create');
    expect(res.body.data.macDinh['Trưởng phòng'].work).not.toContain('approve');
    expect(res.body.data.ghiDe).toEqual([]);
  });

  it('TC-PQ-02: vai không phải admin bị chặn 403', async () => {
    await api.login(tp.email);
    const res = await api.get('/api/v1/permissions');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Giám đốc');
  });
});

describe('PUT /api/v1/permissions — ghi đè có hiệu lực NGAY', () => {
  it('TC-PQ-03: «tu-choi» tắt quyền TP sửa công việc dù ma trận gốc cho phép', async () => {
    const work = await makeWork({ department_id: phong.id });
    const luu = await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'update', 'tu-choi')],
    });
    expect(luu.status).toBe(200);

    await api.login(tp.email);
    const sua = await api.patch(`/api/v1/works/${work.code}`, { name: 'Tên mới' });
    expect(sua.status).toBe(403);
    expect(sua.body.error.message).toContain('Quản trị hệ thống đã tắt quyền');
  });

  it('TC-PQ-04: «cho-phep» cho TP tạo công việc ĐÃ DUYỆT ngay (mặc định là Chờ duyệt)', async () => {
    const luu = await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'create', 'cho-phep')],
    });
    expect(luu.status).toBe(200);

    await api.login(tp.email);
    const tao = await api.post('/api/v1/works', {
      name: 'Việc TP tạo ngay',
      department_id: phong.id,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(tao.status).toBe(200);
    expect(tao.body.data.work.approval_status).toBe('Đã duyệt');
  });

  it('TC-PQ-05: «mac-dinh» xoá ghi đè — trả về đúng luật gốc', async () => {
    await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'update', 'tu-choi')],
    });
    const revert = await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'update', 'mac-dinh')],
    });
    expect(revert.status).toBe(200);
    expect(revert.body.data.ghiDe).toEqual([]);

    const work = await makeWork({ department_id: phong.id });
    await api.login(tp.email);
    const sua = await api.patch(`/api/v1/works/${work.code}`, { name: 'Tên mới' });
    expect(sua.status).toBe(200);
  });

  it('TC-PQ-06: «cho-duyet» chỉ hợp lệ cho action = create', async () => {
    const res = await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'delete', 'cho-duyet')],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Tạo');
  });

  it('TC-PQ-07: chặn ghi đè vai admin và giá trị lạ', async () => {
    const saiVai = await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('admin', 'work', 'update', 'tu-choi')],
    });
    expect(saiVai.status).toBe(400);
    const saiGiaTri = await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'update', 'full-quyen')],
    });
    expect(saiGiaTri.status).toBe(400);
  });

  it('TC-PQ-08: vai thường không PUT được', async () => {
    await api.login(tp.email);
    const res = await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'update', 'tu-choi')],
    });
    expect(res.status).toBe(403);
  });

  it('TC-PQ-09: mỗi lần lưu ghi một dòng nhật ký permissions.update', async () => {
    await api.put('/api/v1/permissions', {
      thayDoi: [ghiDe('Trưởng phòng', 'work', 'update', 'tu-choi')],
    });
    await flushAudit();
    const rows = await pool.query(
      `SELECT action FROM activity_logs WHERE action = 'permissions.update'`
    );
    expect(rows.rows.length).toBe(1);
  });
});

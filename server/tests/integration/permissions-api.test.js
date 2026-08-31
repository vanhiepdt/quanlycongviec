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

  it('TC-PQ-02: GET mở cho mọi vai đăng nhập (bảng phân quyền không phải dữ liệu mật)', async () => {
    await api.login(tp.email);
    const res = await api.get('/api/v1/permissions');
    expect(res.status).toBe(200);
    expect(res.body.data.macDinh['Trưởng phòng'].work).toContain('create');
    // Chỉnh sửa (PUT) vẫn chỉ của admin — canh ở TC-PQ-08.
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

  it('TC-PQ-06: «cho-duyet» hợp lệ cho Tạo/Sửa/Xoá, chặn với Xem/Duyệt', async () => {
    // 011: TP/PP được chọn «Chờ duyệt» cho cả Sửa và Xoá (người dùng 2026-08-29).
    const sua = await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Trưởng phòng', entityType: 'work', action: 'update', giaTri: 'cho-duyet' }],
    });
    expect(sua.status).toBe(200);
    const xoa = await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Trưởng phòng', entityType: 'work', action: 'delete', giaTri: 'cho-duyet' }],
    });
    expect(xoa.status).toBe(200);
    // Xem/Duyệt không có luồng chờ-duyệt.
    const xem = await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Trưởng phòng', entityType: 'work', action: 'read', giaTri: 'cho-duyet' }],
    });
    expect(xem.status).toBe(400);
    const duyet = await api.put('/api/v1/permissions', {
      thayDoi: [
        { vai: 'Trưởng phòng', entityType: 'work', action: 'approve', giaTri: 'cho-duyet' },
      ],
    });
    expect(duyet.status).toBe(400);
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

  it('TC-PQ-10: phạm vi «tat-ca» nới TP sang phòng khác — chỉ Phó GĐ/TP/PP được nới', async () => {
    const phongKhac = await makeDepartment({ code: 'PH-PQ10', name: 'Phòng khác PQ10' });
    const workKhac = await makeWork({ department_id: phongKhac.id, manager_id: null });

    // Mặc định (phạm vi phòng mình): TP sửa việc phòng khác bị chặn.
    await api.login(tp.email);
    const truoc = await api.patch(`/api/v1/works/${workKhac.code}`, { name: 'Sửa trái phép' });
    expect(truoc.status).toBe(403);

    // Nới «tat-ca» cho TP ⇒ sửa được việc phòng khác.
    await api.login(admin.email);
    const luu = await api.put('/api/v1/permissions', {
      thayDoi: [
        {
          vai: 'Trưởng phòng',
          entityType: 'work',
          action: 'update',
          giaTri: 'cho-phep',
          phamVi: 'tat-ca',
        },
      ],
    });
    expect(luu.status).toBe(200);

    await api.login(tp.email);
    const sau = await api.patch(`/api/v1/works/${workKhac.code}`, { name: 'Sửa được rồi' });
    expect(sau.status).toBe(200);

    // Cản nới phạm vi cho vai không có quyền đó (Cán bộ).
    await api.login(admin.email);
    const sai = await api.put('/api/v1/permissions', {
      thayDoi: [
        {
          vai: 'Nhân viên',
          entityType: 'work',
          action: 'update',
          giaTri: 'cho-phep',
          phamVi: 'tat-ca',
        },
      ],
    });
    expect(sai.status).toBe(400);
  });

  it('TC-PQ-11: ghi đè Sửa = «cho-duyet» ⇒ TP sửa Công việc đã duyệt quay về «Chờ duyệt»', async () => {
    const work = await makeWork({
      department_id: phong.id,
      approval_status: 'Đã duyệt',
    });
    await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Trưởng phòng', entityType: 'work', action: 'update', giaTri: 'cho-duyet' }],
    });

    await api.login(tp.email);
    const sua = await api.patch(`/api/v1/works/${work.code}`, { name: 'Tên mới' });
    expect(sua.status).toBe(200);
    expect(sua.body.data.work.approval_status).toBe('Chờ duyệt');
    expect(sua.body.data.choDuyetLai).toBe(true);
  });

  it('TC-PQ-12: ghi đè Xoá = «cho-duyet» ⇒ TP không xoá được, câu nói rõ phải qua duyệt', async () => {
    const work = await makeWork({ department_id: phong.id });
    await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Trưởng phòng', entityType: 'work', action: 'delete', giaTri: 'cho-duyet' }],
    });

    await api.login(tp.email);
    const xoa = await api.del(`/api/v1/works/${work.code}`);
    expect(xoa.status).toBe(403);
    expect(xoa.body.error.message).toContain('qua duyệt');
  });

  it('TC-PQ-13: Cán bộ được ghi đè «cho-duyet» ở TẠO và SỬA, nhưng KHÔNG ở XOÁ', async () => {
    // Yêu cầu người dùng Vòng 12e: «riêng cán bộ thì thêm option tạo, sửa thêm mới duyệt».
    // Xoá vẫn chặn: 'cho-duyet' ở delete nghĩa là CHẶN xoá (xoaDuocKhongKhiChoDuyet) mà luồng
    // duyệt-yêu-cầu-xoá chưa có ⇒ với vai chỉ xoá được nhiệm vụ của mình thì thành khoá cứng.
    const tao = await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Nhân viên', entityType: 'task', action: 'create', giaTri: 'cho-duyet' }],
    });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);
    const sua = await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Nhân viên', entityType: 'task', action: 'update', giaTri: 'cho-duyet' }],
    });
    expect(sua.status, JSON.stringify(sua.body)).toBe(200);
    const xoa = await api.put('/api/v1/permissions', {
      thayDoi: [{ vai: 'Nhân viên', entityType: 'task', action: 'delete', giaTri: 'cho-duyet' }],
    });
    expect(xoa.status).toBe(400);
    expect(xoa.body.error.message).toContain('Chờ duyệt');
    // Vai «Quản lý công việc» vẫn không có luồng chờ duyệt nào — chỉ nới đúng cho Cán bộ.
    const qlcv = await api.put('/api/v1/permissions', {
      thayDoi: [
        { vai: 'Quản lý công việc', entityType: 'task', action: 'create', giaTri: 'cho-duyet' },
      ],
    });
    expect(qlcv.status).toBe(400);
  });
});

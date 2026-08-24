// API Công việc cấp 1 — §7 việc 3.1. Chạy qua HTTP thật (supertest) trên Postgres thật, nên bao
// gồm cả CSRF, phiên đăng nhập và phân quyền, không chỉ nghiệp vụ.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import * as itemsRepo from '../../src/modules/workItems/repo.js';
import * as worksRepo from '../../src/modules/works/repo.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let api;
let dept;
let admin;

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  api = client(app);
  await api.login(admin.email);
});

afterAll(async () => {
  await closePool();
});

describe('POST /api/v1/works — tạo công việc', () => {
  it('tạo được, mã do máy chủ sinh, không nhận mã từ người dùng', async () => {
    const res = await api.post('/api/v1/works', {
      name: 'Triển khai hệ thống',
      departmentId: dept.id,
      startDate: '2026-09-07',
      endDate: '2026-09-26',
      code: 'TU-Y-Y', // khoá lạ: schema bỏ qua, không được lọt vào CSDL
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.work.code).toBe('CV001');
    expect(res.body.data.work.start_date).toBe('2026-09-07');
    expect(res.body.data.warnings).toEqual([]);
  });

  it('thiếu tên → 400 VALIDATION_ERROR kèm tên trường', async () => {
    const res = await api.post('/api/v1/works', { name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('name');
  });

  it('ngày sai định dạng → 400, không tạo dòng nào', async () => {
    const res = await api.post('/api/v1/works', { name: 'Sai ngày', startDate: '07/09/2026' });
    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM works');
    expect(rows[0].n).toBe(0);
  });

  it('TC-TREE-33: ngày kết thúc trước ngày bắt đầu → CẢNH BÁO, vẫn lưu', async () => {
    const res = await api.post('/api/v1/works', {
      name: 'Ngày ngược',
      startDate: '2026-09-20',
      endDate: '2026-09-01',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.warnings.map((w) => w.code)).toContain('DUE_BEFORE_START');
    expect(await worksRepo.findByCode('CV001')).not.toBeNull();
  });

  it('chưa đăng nhập → 401', async () => {
    const guest = client(app);
    const res = await guest.post('/api/v1/works', { name: 'Không có phiên' });
    expect(res.status).toBe(401);
  });

  it('Nhân viên không được tạo công việc → 403 FORBIDDEN', async () => {
    const staff = await makeLoginUser({
      code: 'NV002',
      email: 'nv@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const other = client(app);
    await other.login(staff.email);
    const res = await other.post('/api/v1/works', { name: 'Việc của nhân viên' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET/PATCH/DELETE /api/v1/works', () => {
  beforeEach(async () => {
    await api.post('/api/v1/works', { name: 'Việc một', departmentId: dept.id });
    await api.post('/api/v1/works', { name: 'Việc hai', departmentId: dept.id });
  });

  it('danh sách trả đủ và có tổng số', async () => {
    const res = await api.get('/api/v1/works');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.works.map((w) => w.code)).toEqual(['CV001', 'CV002']);
  });

  it('đọc một công việc bằng MÃ hoặc bằng id số đều được', async () => {
    const byCode = await api.get('/api/v1/works/CV001');
    const byId = await api.get(`/api/v1/works/${byCode.body.data.work.id}`);
    expect(byCode.body.data.work.name).toBe('Việc một');
    expect(byId.body.data.work.code).toBe('CV001');
  });

  it('mã không tồn tại → 404 NOT_FOUND', async () => {
    const res = await api.get('/api/v1/works/CV999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH chỉ ghi trường được gửi, các trường khác giữ nguyên', async () => {
    const res = await api.patch('/api/v1/works/CV001', { status: 'Đang thực hiện' });
    expect(res.status).toBe(200);
    expect(res.body.data.work.status).toBe('Đang thực hiện');
    expect(res.body.data.work.name).toBe('Việc một'); // không gửi ⇒ không đổi
    expect(res.body.data.work.department_id).toBe(dept.id);
  });

  it('DELETE trả về danh sách mã đã xoá kèm số lượng', async () => {
    const work = await worksRepo.findByCode('CV001');
    await itemsRepo.insert({ code: 'CV001-001', work_id: work.id, level: 2, name: 'Việc con' });
    const res = await api.del('/api/v1/works/CV001');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      deletedWork: 'CV001',
      deletedItems: ['CV001-001'],
      deletedCount: 2,
    });
    expect(await worksRepo.findByCode('CV001')).toBeNull();
  });

  it('PATCH thiếu token CSRF → 403, dữ liệu không đổi', async () => {
    const res = await api.patch('/api/v1/works/CV001', { name: 'Đổi lậu' }, { csrf: null });
    expect(res.status).toBe(403);
    expect((await worksRepo.findByCode('CV001')).name).toBe('Việc một');
  });
});

describe('POST /api/v1/works/:id/copy — TC-TREE-27 nhân bản cả cây', () => {
  let work;
  let subA;
  let subB;

  beforeEach(async () => {
    work = await worksRepo.insert({
      name: 'Việc gốc',
      department_id: dept.id,
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      status: 'Đang thực hiện',
    });
    subA = await itemsRepo.insert({
      code: 'CV001-001',
      work_id: work.id,
      level: 2,
      name: 'Con A',
      sort_order: 1,
    });
    subB = await itemsRepo.insert({
      code: 'CV001-002',
      work_id: work.id,
      level: 2,
      name: 'Con B',
      sort_order: 2,
    });
    await itemsRepo.insert({
      code: 'CV001-003',
      work_id: work.id,
      parent_id: subA.id,
      level: 3,
      name: 'Nhiệm vụ A1',
      sort_order: 3,
      completion: 80,
      status: 'Đang thực hiện',
      report_date: '2026-09-10',
    });
    await itemsRepo.insert({
      code: 'CV001-004',
      work_id: work.id,
      parent_id: subB.id,
      level: 3,
      name: 'Nhiệm vụ B1',
      sort_order: 4,
    });
    await itemsRepo.insert({
      code: 'CV001-005',
      work_id: work.id,
      level: 3,
      name: 'Nhiệm vụ mồ côi',
      sort_order: 5,
    });
  });

  it('sao cả cây, mã mới, KHÔNG dòng nào trỏ sang cây gốc', async () => {
    const res = await api.post(`/api/v1/works/${work.code}/copy`, { name: 'Việc gốc (bản sao)' });
    expect(res.status).toBe(200);
    const copy = res.body.data.work;
    expect(copy.code).not.toBe(work.code);
    expect(copy.name).toBe('Việc gốc (bản sao)');
    expect(res.body.data.copiedCount).toBe(5);

    const copied = await itemsRepo.listByWork(copy.id);
    expect(copied).toHaveLength(5);
    const sourceIds = new Set([subA.id, subB.id]);
    for (const row of copied) {
      expect(row.work_id).toBe(copy.id);
      expect(row.code.startsWith(`${copy.code}-`)).toBe(true);
      if (row.parent_id !== null) {
        expect(sourceIds.has(row.parent_id)).toBe(false); // không trỏ vào cây gốc
        expect(copied.some((r) => r.id === row.parent_id)).toBe(true); // trỏ vào BẢN SAO của cha
      }
    }
  });

  it('quan hệ cha–con trong bản sao đúng theo bản gốc, nhiệm vụ mồ côi vẫn mồ côi', async () => {
    const res = await api.post(`/api/v1/works/${work.code}/copy`, {});
    const copy = res.body.data.work;
    const copied = await itemsRepo.listByWork(copy.id);
    const byName = Object.fromEntries(copied.map((r) => [r.name, r]));
    expect(byName['Nhiệm vụ A1'].parent_id).toBe(byName['Con A'].id);
    expect(byName['Nhiệm vụ B1'].parent_id).toBe(byName['Con B'].id);
    expect(byName['Nhiệm vụ mồ côi'].parent_id).toBeNull();
    expect(byName['Con A'].parent_id).toBeNull();
  });

  it('bản sao là việc chưa làm: tiến độ 0, trạng thái Chưa bắt đầu, ngày báo cáo trống', async () => {
    const res = await api.post(`/api/v1/works/${work.code}/copy`, {});
    const copy = res.body.data.work;
    expect(copy.status).toBe('Chưa bắt đầu');
    expect(copy.start_date).toBe('2026-09-01'); // ngày kế hoạch thì giữ
    const copied = await itemsRepo.listByWork(copy.id);
    for (const row of copied) {
      expect(row.completion).toBe(0);
      expect(row.status).toBe('Chưa bắt đầu');
      expect(row.report_date).toBeNull();
      expect(row.approval_status).toBe('Đã duyệt');
    }
  });

  it('không truyền tên thì bản sao giữ tên gốc; cây gốc không bị sứt dòng nào', async () => {
    const res = await api.post(`/api/v1/works/${work.code}/copy`, {});
    expect(res.body.data.work.name).toBe('Việc gốc');
    expect(await itemsRepo.listByWork(work.id)).toHaveLength(5);
  });

  it('nhân bản công việc không tồn tại → 404, không tạo dòng rác nào', async () => {
    const before = await pool.query('SELECT count(*)::int AS n FROM works');
    const res = await api.post('/api/v1/works/CV999/copy', {});
    expect(res.status).toBe(404);
    const after = await pool.query('SELECT count(*)::int AS n FROM works');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});

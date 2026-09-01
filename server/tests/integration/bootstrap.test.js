// Gói đầu trang — việc 5.10 + nửa ứng dụng của việc 5.4 (TC-APR-06/07, EXPLAIN).
//
// Bốn câu hỏi:
//   1. REST `GET /bootstrap` trả đủ người / phòng / người / badge / thống kê, và `name = full_name`.
//   2. Ba tên RPC đầu trang hết 501; khách vẫn nhận `{requireLogin:true}` (TC-RPC-36 giữ).
//   3. Thống kê đọc `v_countable_*` — EXPLAIN + tạo 1 mục Chờ duyệt không làm lệch thẻ số.
//   4. Cây (works/items) VẪN chứa mục chờ duyệt: việc 5.6 (nhãn vàng) không bị gói này nuốt.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { STATS_QUERIES } from '../../src/modules/bootstrap/service.js';
import { COL } from '../../src/rpc/legacyFields.js';
import { makeDepartment, makeItem, makeWork, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phong;
let admin;
let apiAdmin;

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

const setApproval = (table, id, status) =>
  pool.query(`UPDATE ${table} SET approval_status = $1 WHERE id = $2`, [status, id]);

beforeEach(async () => {
  await resetTables();
  phong = await makeDepartment();
  admin = await makeLoginUser({
    code: 'NV001',
    full_name: 'Quản trị Hệ thống',
    email: 'admin@test.local',
    role: 'admin',
    department_id: phong.id,
  });
  apiAdmin = await dangNhap(admin);
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/v1/bootstrap', () => {
  it('chưa đăng nhập ⇒ 401, không phải 200 rỗng', async () => {
    const res = await client(app).get('/api/v1/bootstrap');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('trả user.name = full_name (57 chỗ app.js đọc currentUser.name)', async () => {
    const res = await apiAdmin.get('/api/v1/bootstrap');
    expect(res.status).toBe(200);
    const { user } = res.body.data;
    expect(user.full_name).toBe('Quản trị Hệ thống');
    expect(user.name).toBe(user.full_name);
    expect(user.role).toBe('admin');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]/);
  });

  it('gói có departments, people, pendingCount, summaryStats, chartData', async () => {
    const res = await apiAdmin.get('/api/v1/bootstrap');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.departments).toEqual([
      expect.objectContaining({
        code: phong.code,
        name: phong.name,
        directorEmails: [],
        headEmails: [],
        viceEmails: [],
      }),
    ]);
    expect(data.people.some((p) => p.email === admin.email)).toBe(true);
    // `deletes` thêm ở 013 (yêu cầu xoá đang treo) và cộng vào `total` — badge trả lời «còn bao
    // nhiêu việc phải xử», mà một yêu cầu xoá đang chờ đúng là một việc phải xử.
    expect(data.pendingCount).toEqual({ works: 0, items: 0, deletes: 0, total: 0 });
    expect(data.summaryStats).toEqual({
      totalProjects: 0,
      totalTasks: 0,
      completedTasks: 0,
      ongoingTasks: 0,
      overdueTasks: 0,
    });
    expect(data.chartData).toEqual({
      labels: [],
      data: [],
      message: 'Không có dữ liệu nhiệm vụ để tạo biểu đồ.',
    });
  });

  it('cây works/items nằm trong gói — cầu RPC dựng projects/tasks từ đây, không N+1', async () => {
    const work = await makeWork({
      code: 'CV001',
      name: 'Việc đã duyệt',
      department_id: phong.id,
    });
    await makeItem({ code: 'CV001-001', work_id: work.id, level: 2, name: 'Con' });
    const res = await apiAdmin.get('/api/v1/bootstrap');
    expect(res.body.data.works.map((w) => w.code)).toEqual(['CV001']);
    expect(res.body.data.items.map((i) => i.code)).toEqual(['CV001-001']);
    expect(res.body.data.items[0].reminders).toEqual([]);
  });
});

describe('cầu RPC — ba tên đầu trang', () => {
  const rpc = (name, args = []) => apiAdmin.post(`/api/rpc/${name}`, { args });

  it('getDataForUser ⇒ success + projects/tasks khoá COL + user.name', async () => {
    const work = await makeWork({
      code: 'CV001',
      name: 'Nâng cấp',
      department_id: phong.id,
    });
    await makeItem({ code: 'CV001-001', work_id: work.id, level: 3, name: 'Nhiệm vụ A' });

    const res = await rpc('getDataForUser');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.success).toBe(true);
    expect(data.user.name).toBe(admin.full_name);
    expect(data.projects[0][COL.P_ID]).toBe('CV001');
    expect(data.projects[0][COL.P_NAME]).toBe('Nâng cấp');
    expect(data.tasks[0][COL.T_ID]).toBe('CV001-001');
    expect(data.tasks[0][COL.T_PID]).toBe('CV001');
    expect(data.staff[0][COL.S_NAME]).toBe(admin.full_name);
    expect(data.staff[0][COL.S_PASSWORD]).toBe('');
    expect(data.adminNames).toEqual([admin.full_name]);
    expect(data.proposals).toEqual([]);
    expect(data.apps).toEqual([]);
    expect(data.summaryStats.totalProjects).toBe(1);
  });

  it('TC-RPC-37: đã đăng nhập ⇒ getInitialDataWithAuth trả gói thật, không còn 501', async () => {
    const res = await rpc('getInitialDataWithAuth');
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.user.name).toBe(admin.full_name);
    expect(res.body.data.requireLogin).toBeUndefined();
  });

  it('getDepartmentContext ⇒ success + khoá COL.D_* + cờ vai chính xác', async () => {
    const res = await rpc('getDepartmentContext');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.success).toBe(true);
    expect(data.departments[0][COL.D_ID]).toBe(phong.code);
    expect(data.departments[0][COL.D_NAME]).toBe(phong.name);
    expect(data.departmentNames).toEqual([phong.name]);
    expect(data.visibleDepartments).toEqual([phong.name]);
    expect(data.isDeputyDirector).toBe(false);
    expect(data.isDepartmentHead).toBe(false);
  });

  it('Phó Giám đốc: isDeputyDirector true, visibleDepartments chỉ phòng phụ trách', async () => {
    const phongB = await makeDepartment({
      code: 'PH02',
      name: 'Phòng Kế hoạch',
      sort_order: 2,
    });
    const pgd = await makeLoginUser({
      code: 'NV002',
      full_name: 'Phó GĐ Một',
      email: 'pgd@test.local',
      role: 'Phó Giám đốc',
    });
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role)
       VALUES ($1,$2,'deputy_director')`,
      [phong.id, pgd.id]
    );
    const api = await dangNhap(pgd);
    const res = await api.post('/api/rpc/getDepartmentContext', { args: [] });
    expect(res.status).toBe(200);
    expect(res.body.data.isDeputyDirector).toBe(true);
    expect(res.body.data.isDepartmentHead).toBe(false);
    expect(res.body.data.visibleDepartments).toEqual([phong.name]);
    expect(res.body.data.departmentNames).toEqual(
      expect.arrayContaining([phong.name, phongB.name])
    );
  });
});

describe('thống kê đọc view — việc 5.4 nửa ứng dụng', () => {
  it('câu thống kê của bootstrap gọi đúng hai view, không FROM bảng gốc', () => {
    expect(STATS_QUERIES.works).toMatch(/\bv_countable_works\b/);
    expect(STATS_QUERIES.items).toMatch(/\bv_countable_items\b/);
    expect(STATS_QUERIES.works).not.toMatch(/\bFROM\s+works\b/i);
    expect(STATS_QUERIES.items).not.toMatch(/\bFROM\s+work_items\b/i);
  });

  it('EXPLAIN của hai câu thống kê chạy được và kế hoạch nhắc tới view hoặc bộ lọc Chờ duyệt', async () => {
    const explain = async (sql) => {
      const { rows } = await pool.query(`EXPLAIN (FORMAT TEXT) ${sql}`);
      return rows.map((r) => r['QUERY PLAN']).join('\n');
    };
    const planWorks = await explain(STATS_QUERIES.works);
    const planItems = await explain(STATS_QUERIES.items);
    // View đơn giản bị Postgres inline thành Seq Scan trên bảng gốc + Filter; cả hai dạng đều
    // chứng minh câu KHÔNG đếm 'Chờ duyệt'. Tên view trong SQL nguồn đã kiểm ở phép trên.
    expect(planWorks.length).toBeGreaterThan(0);
    expect(planItems.length).toBeGreaterThan(0);
    expect(planWorks + planItems).toMatch(/v_countable_|approval_status/i);
  });

  it('TC-APR-06: thêm 1 mục Chờ duyệt ⇒ summaryStats và chartData không đổi một đơn vị', async () => {
    // Tạo qua API admin (tự 'Đã duyệt') chứ không `makeWork({code:'CV001'})`: sequence
    // sau reset bắt đầu lại từ 1, trùng mã với lần tạo kế của Trưởng phòng.
    const taoDuyet = await apiAdmin.post('/api/v1/works', {
      name: 'Việc đã duyệt',
      departmentId: phong.id,
    });
    expect(taoDuyet.status).toBe(200);
    const nhiemVu = await apiAdmin.post('/api/v1/work-items', {
      workRef: taoDuyet.body.data.work.code,
      name: 'Nhiệm vụ đếm được',
      level: 3,
      status: 'Đang thực hiện',
    });
    expect(nhiemVu.status).toBe(200);

    const truoc = (await apiAdmin.get('/api/v1/bootstrap')).body.data;
    expect(truoc.summaryStats).toEqual({
      totalProjects: 1,
      totalTasks: 1,
      completedTasks: 0,
      ongoingTasks: 1,
      overdueTasks: 0,
    });
    expect(truoc.chartData.labels).toEqual(['Đang thực hiện']);
    expect(truoc.chartData.data).toEqual([1]);

    const tp = await makeLoginUser({
      code: 'NV010',
      full_name: 'Trần Thị Trưởng',
      email: 'tp@test.local',
      role: 'Trưởng phòng',
      department_id: phong.id,
    });
    const apiTp = await dangNhap(tp);
    const tao = await apiTp.post('/api/v1/works', {
      name: 'Việc chờ duyệt',
      departmentId: phong.id,
    });
    expect(tao.status).toBe(200);
    expect(tao.body.data.work.approval_status).toBe('Chờ duyệt');
    const sub = await apiTp.post('/api/v1/work-items', {
      workRef: tao.body.data.work.code,
      name: 'Con chờ duyệt',
      level: 2,
    });
    expect(sub.status).toBe(200);
    expect(sub.body.data.item.approval_status).toBe('Chờ duyệt');

    const sau = (await apiAdmin.get('/api/v1/bootstrap')).body.data;
    expect(sau.summaryStats).toEqual(truoc.summaryStats);
    expect(sau.chartData).toEqual(truoc.chartData);
    // Việc 5.6: cây VẪN thấy mục chờ duyệt (nhãn vàng), chỉ thống kê là bỏ.
    expect(sau.works).toHaveLength(2);
    expect(sau.works.some((w) => w.approval_status === 'Chờ duyệt')).toBe(true);
    expect(sau.pendingCount.total).toBeGreaterThan(0);
  });

  it('TC-APR-07: duyệt mục đó ⇒ totalProjects tăng đúng 1', async () => {
    const tp = await makeLoginUser({
      code: 'NV010',
      full_name: 'Trần Thị Trưởng',
      email: 'tp@test.local',
      role: 'Trưởng phòng',
      department_id: phong.id,
    });
    const apiTp = await dangNhap(tp);
    const tao = await apiTp.post('/api/v1/works', {
      name: 'Việc chờ duyệt',
      departmentId: phong.id,
    });
    const code = tao.body.data.work.code;
    const truoc = (await apiAdmin.get('/api/v1/bootstrap')).body.data.summaryStats;
    expect(truoc.totalProjects).toBe(0);

    const duyet = await apiAdmin.post(`/api/v1/approvals/works/${code}/approve`);
    expect(duyet.status).toBe(200);

    const sau = (await apiAdmin.get('/api/v1/bootstrap')).body.data.summaryStats;
    expect(sau.totalProjects).toBe(1);
    expect(sau.totalProjects - truoc.totalProjects).toBe(1);
  });

  it('nhiệm vụ nằm dưới công việc Chờ duyệt không vào totalTasks dù bản thân Đã duyệt', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phong.id });
    const sub = await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    await makeItem({
      code: 'CV001-002',
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
    });
    await setApproval('works', work.id, 'Chờ duyệt');

    const stats = (await apiAdmin.get('/api/v1/bootstrap')).body.data.summaryStats;
    expect(stats.totalProjects).toBe(0);
    expect(stats.totalTasks).toBe(0);
  });
});

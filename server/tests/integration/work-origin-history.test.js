// Nguồn gốc đầu việc và nhật ký từ đầu — TC-ORIGIN-01..14 (§2.3, 003_work_origin_and_history.sql).
//
// Câu hỏi cần trả lời được cho CẢ BA CẤP: ai lập đầu việc này, người đó tự đăng ký hay được ai
// GIAO, ai giao ĐẦU TIÊN (không phải người giao gần nhất), và từ lúc lập tới giờ ai sửa những gì.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import * as logsRepo from '../../src/modules/activityLogs/repo.js';
import * as itemsService from '../../src/modules/workItems/service.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let dept;
let admin;
let leader;
let staff;

/** Chờ audit ghi xong: audit chạy ở `res.on('finish')`, tức là SAU khi supertest đã trả về. */
async function waitForLogs(minRows, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY id');
    if (rows.length >= minRows) return rows;
    await new Promise((r) => setTimeout(r, 25));
  }
  const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY id');
  return rows;
}

async function loginAs(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  leader = await makeLoginUser({
    code: 'NV002',
    email: 'truongphong@congty.vn',
    full_name: 'Trần Thị Trưởng',
    role: 'Trưởng phòng',
    department_id: dept.id,
  });
  staff = await makeLoginUser({
    code: 'NV003',
    email: 'nhanvien@congty.vn',
    full_name: 'Lê Văn Nhân',
    role: 'Nhân viên',
    department_id: dept.id,
  });
});

afterAll(async () => {
  await closePool();
});

describe('nguồn gốc công việc cấp 1', () => {
  it('TC-ORIGIN-01: lãnh đạo phòng tự đứng tên → "Tự đăng ký", có tên người lập', async () => {
    const api = await loginAs(leader);
    const res = await api.post('/api/v1/works', {
      name: 'Việc phòng tự đăng ký',
      departmentId: dept.id,
      managerId: leader.id,
      managerName: leader.full_name,
    });

    expect(res.status).toBe(200);
    const { work, originInfo } = res.body.data;
    expect(work.origin).toBe('Tự đăng ký');
    expect(work.created_by).toBe(leader.id);
    expect(work.created_by_name).toBe('Trần Thị Trưởng');
    expect(work.assigned_by_id).toBeNull();
    expect(work.assigned_at).toBeNull();
    // Gói hiển thị đi kèm ngay trong phản hồi tạo — giao diện không phải gọi thêm.
    expect(originInfo.selfRegistered).toBe(true);
    expect(originInfo.createdByName).toBe('Trần Thị Trưởng');
  });

  it('TC-ORIGIN-02: admin lập rồi giao cho người khác → "Được giao" + ai giao + lúc nào', async () => {
    const api = await loginAs(admin);
    const res = await api.post('/api/v1/works', {
      name: 'Việc được giao',
      departmentId: dept.id,
      managerId: leader.id,
      managerName: leader.full_name,
    });

    const { work, originInfo } = res.body.data;
    expect(work.origin).toBe('Được giao');
    expect(work.created_by).toBe(admin.id);
    expect(work.assigned_by_id).toBe(admin.id);
    expect(work.assigned_by_name).toBe(admin.full_name);
    expect(work.assigned_at).not.toBeNull();
    expect(originInfo.selfRegistered).toBe(false);
    expect(originInfo.assignedByName).toBe(admin.full_name);
  });

  it('chưa gán người quản lý thì vẫn là "Tự đăng ký" — không có ai để nói là được giao', async () => {
    const api = await loginAs(admin);
    const res = await api.post('/api/v1/works', { name: 'Chưa gán ai', departmentId: dept.id });
    expect(res.body.data.work.origin).toBe('Tự đăng ký');
    expect(res.body.data.work.assigned_by_id).toBeNull();
  });

  it('TC-ORIGIN-03: giao lại cho người thứ ba KHÔNG ghi đè người giao đầu tiên', async () => {
    const adminApi = await loginAs(admin);
    const created = await adminApi.post('/api/v1/works', {
      name: 'Việc chuyền tay',
      departmentId: dept.id,
      managerId: leader.id,
      managerName: leader.full_name,
    });
    const code = created.body.data.work.code;

    // Trưởng phòng giao lại việc cho nhân viên. Người nhận đổi, người giao ĐẦU TIÊN thì không.
    const leaderApi = await loginAs(leader);
    const patched = await leaderApi.patch(`/api/v1/works/${code}`, {
      managerId: staff.id,
      managerName: staff.full_name,
    });

    expect(patched.status).toBe(200);
    expect(patched.body.data.work.manager_id).toBe(staff.id);
    expect(patched.body.data.work.assigned_by_id).toBe(admin.id);
    expect(patched.body.data.work.assigned_by_name).toBe(admin.full_name);
    expect(patched.body.data.work.origin).toBe('Được giao');
  });

  it('TC-ORIGIN-04: người lập là bất biến ở CSDL, UPDATE thẳng cũng không đổi được', async () => {
    const api = await loginAs(admin);
    const created = await api.post('/api/v1/works', {
      name: 'Bất biến',
      departmentId: dept.id,
      managerId: leader.id,
    });
    const id = created.body.data.work.id;

    // Bỏ qua cả tầng JS: nếu ai đó viết một câu UPDATE tay thì trigger vẫn phải giữ nguyên.
    await pool.query(
      `UPDATE works SET created_by = $1, created_by_name = 'Người mạo danh',
                        assigned_by_id = $1, assigned_by_name = 'Người mạo danh',
                        origin = 'Tự đăng ký'
        WHERE id = $2`,
      [staff.id, id]
    );

    const { rows } = await pool.query(
      `SELECT created_by, created_by_name, assigned_by_id, assigned_by_name, origin
         FROM works WHERE id = $1`,
      [id]
    );
    expect(rows[0].created_by).toBe(admin.id);
    expect(rows[0].created_by_name).toBe(admin.full_name);
    expect(rows[0].assigned_by_id).toBe(admin.id);
    expect(rows[0].origin).toBe('Được giao');
  });

  it('CSDL chỉ nhận hai giá trị nguồn gốc — chữ khác thì nổ CHECK', async () => {
    await expect(
      pool.query("INSERT INTO works (code, name, origin) VALUES ('CV900','Sai', 'Trên trời rơi')")
    ).rejects.toThrow();
  });

  it('nhân bản: bản sao ghi tên người bấm Nhân bản, không phải người lập bản gốc', async () => {
    const adminApi = await loginAs(admin);
    const created = await adminApi.post('/api/v1/works', {
      name: 'Việc gốc',
      departmentId: dept.id,
      managerId: leader.id,
      managerName: leader.full_name,
    });

    const leaderApi = await loginAs(leader);
    const copied = await leaderApi.post(`/api/v1/works/${created.body.data.work.code}/copy`, {});

    expect(copied.status).toBe(200);
    const { rows } = await pool.query('SELECT * FROM works WHERE id = $1', [
      copied.body.data.work.id,
    ]);
    expect(rows[0].created_by).toBe(leader.id);
    expect(rows[0].created_by_name).toBe(leader.full_name);
    // Người nhận việc của bản sao vẫn là Trưởng phòng — tức chính người bấm ⇒ tự đăng ký.
    expect(rows[0].origin).toBe('Tự đăng ký');
    expect(rows[0].assigned_by_id).toBeNull();
  });
});

describe('nguồn gốc công việc con và nhiệm vụ', () => {
  async function makeWorkRow() {
    const api = await loginAs(admin);
    const res = await api.post('/api/v1/works', {
      name: 'Công việc chứa',
      departmentId: dept.id,
      managerId: leader.id,
      managerName: leader.full_name,
      startDate: '2026-09-01',
      endDate: '2026-12-31',
    });
    return res.body.data.work;
  }

  it('TC-ORIGIN-05: nhân viên tự đăng ký nhiệm vụ cho mình → "Tự đăng ký"', async () => {
    const work = await makeWorkRow();
    const { item } = await itemsService.create(staff, {
      workRef: work.code,
      level: 3,
      name: 'Nhiệm vụ tự nhận',
      assignee_id: staff.id,
      assignee_name: staff.full_name,
    });

    expect(item.origin).toBe('Tự đăng ký');
    expect(item.created_by).toBe(staff.id);
    expect(item.created_by_name).toBe('Lê Văn Nhân');
    expect(item.assigned_by_id).toBeNull();
  });

  it('TC-ORIGIN-06: lãnh đạo phòng lập công việc con rồi giao cho nhân viên → "Được giao"', async () => {
    const work = await makeWorkRow();
    const { item } = await itemsService.create(leader, {
      workRef: work.code,
      level: 2,
      name: 'Công việc con được giao',
      assignee_id: staff.id,
      assignee_name: staff.full_name,
    });

    expect(item.level).toBe(2);
    expect(item.origin).toBe('Được giao');
    expect(item.created_by).toBe(leader.id);
    expect(item.assigned_by_id).toBe(leader.id);
    expect(item.assigned_by_name).toBe('Trần Thị Trưởng');
    expect(item.assigned_at).not.toBeNull();
  });

  it('TC-ORIGIN-07: chỉ gửi TÊN người thực hiện vẫn suy ra được người giao', async () => {
    const work = await makeWorkRow();
    // Frontend cũ nhiều chỗ chỉ gửi tên; `resolveAssignee` tra ra id rồi mới suy nguồn gốc.
    const { item } = await itemsService.create(leader, {
      workRef: work.code,
      level: 3,
      name: 'Chỉ gửi tên',
      assignee_name: 'Lê Văn Nhân',
    });

    expect(item.assignee_id).toBe(staff.id);
    expect(item.origin).toBe('Được giao');
    expect(item.assigned_by_id).toBe(leader.id);
  });

  it('TC-ORIGIN-08: giao lại nhiệm vụ cho người khác giữ nguyên người giao đầu tiên', async () => {
    const work = await makeWorkRow();
    const { item } = await itemsService.create(leader, {
      workRef: work.code,
      level: 3,
      name: 'Nhiệm vụ chuyền tay',
      assignee_id: staff.id,
      assignee_name: staff.full_name,
    });

    // Lần giao thứ hai do admin thực hiện — người giao đầu tiên vẫn phải là Trưởng phòng.
    const { item: after } = await itemsService.update(admin, item.code, {
      assignee_id: leader.id,
      assignee_name: leader.full_name,
    });

    expect(after.assignee_id).toBe(leader.id);
    expect(after.assigned_by_id).toBe(leader.id);
    expect(after.assigned_by_name).toBe('Trần Thị Trưởng');
    expect(after.created_by).toBe(leader.id);
  });

  it('nhiệm vụ tự đăng ký rồi bị giao lại thì KHÔNG tự biến thành "Được giao"', async () => {
    const work = await makeWorkRow();
    const { item } = await itemsService.create(staff, {
      workRef: work.code,
      level: 3,
      name: 'Tự nhận rồi bị chuyển',
      assignee_id: staff.id,
    });
    const { item: after } = await itemsService.update(admin, item.code, { assignee_id: leader.id });

    // Nguồn gốc là chuyện của LÚC LẬP: dòng này do nhân viên tự đăng ký, việc sau đó bị chuyển tay
    // nằm ở nhật ký chứ không sửa lại quá khứ.
    expect(after.origin).toBe('Tự đăng ký');
    expect(after.assigned_by_id).toBeNull();
    expect(after.created_by).toBe(staff.id);
  });
});

describe('nhật ký từ đầu', () => {
  it('TC-ORIGIN-09: nhật ký công việc có dòng tạo rồi tới các lần sửa, kèm from→to', async () => {
    const api = await loginAs(admin);
    const created = await api.post('/api/v1/works', {
      name: 'Việc có nhật ký',
      departmentId: dept.id,
      managerId: leader.id,
      managerName: leader.full_name,
      status: 'Chưa bắt đầu',
    });
    const code = created.body.data.work.code;

    await api.patch(`/api/v1/works/${code}`, { name: 'Việc có nhật ký (đã đổi tên)' });
    await api.patch(`/api/v1/works/${code}`, { status: 'Đang thực hiện' });
    await waitForLogs(3);

    const res = await api.get(`/api/v1/works/${code}/history`);
    expect(res.status).toBe(200);
    const { entries, originInfo } = res.body.data;

    // Cũ trước: đọc nhật ký là lần lại diễn biến từ lúc lập.
    expect(entries.map((e) => e.action)).toEqual(['works.create', 'works.update', 'works.update']);
    expect(entries[0].actor_name).toBe(admin.full_name);
    expect(entries[0].details.origin).toBe('Được giao');

    expect(entries[1].details.changes.name).toEqual({
      from: 'Việc có nhật ký',
      to: 'Việc có nhật ký (đã đổi tên)',
    });
    expect(entries[2].details.changes.status).toEqual({
      from: 'Chưa bắt đầu',
      to: 'Đang thực hiện',
    });
    // Cột nào không gửi thì không được xuất hiện trong nhật ký.
    expect(Object.keys(entries[2].details.changes)).toEqual(['status']);
    expect(originInfo.assignedByName).toBe(admin.full_name);
  });

  it('TC-ORIGIN-10: PATCH không đổi gì thì nhật ký không có khoá changes', async () => {
    const api = await loginAs(admin);
    const created = await api.post('/api/v1/works', {
      name: 'Không đổi gì',
      departmentId: dept.id,
    });
    const code = created.body.data.work.code;

    await api.patch(`/api/v1/works/${code}`, { name: 'Không đổi gì' });
    await waitForLogs(2);

    const res = await api.get(`/api/v1/works/${code}/history`);
    const update = res.body.data.entries.at(-1);
    expect(update.action).toBe('works.update');
    expect(update.details.changes).toBeUndefined();
  });

  it('TC-ORIGIN-11: nhật ký KHÔNG chứa mật khẩu dù đăng nhập trước đó', async () => {
    const api = await loginAs(admin);
    await api.post('/api/v1/works', { name: 'Việc kiểm mật khẩu', departmentId: dept.id });
    await waitForLogs(2);

    const { rows } = await pool.query('SELECT details::text AS d FROM activity_logs');
    const dump = rows.map((r) => r.d).join(' ');
    expect(dump).not.toContain('Test@12345');
    expect(dump.toLowerCase()).not.toContain('password');
  });

  it('TC-ORIGIN-12: nhật ký công việc con/nhiệm vụ đọc theo đúng dòng, không lẫn với công việc', async () => {
    const api = await loginAs(admin);
    const work = (
      await api.post('/api/v1/works', {
        name: 'Công việc chứa nhật ký',
        departmentId: dept.id,
        managerId: leader.id,
      })
    ).body.data.work;

    const { item } = await itemsService.create(leader, {
      workRef: work.code,
      level: 3,
      name: 'Nhiệm vụ có nhật ký',
      assignee_id: staff.id,
    });

    // id của works và của work_items đánh số riêng nên hai bảng có thể trùng id — nhật ký phải lọc
    // cả theo entity_type, nếu không thì hai đầu việc khác nhau nhìn thấy nhật ký của nhau.
    await logsRepo.writeLog({
      actorId: leader.id,
      actorName: leader.full_name,
      action: 'workItems.create',
      entityType: 'task',
      entityId: item.id,
      workId: work.id,
      details: { code: item.code, origin: item.origin },
    });
    await logsRepo.writeLog({
      actorId: admin.id,
      actorName: admin.full_name,
      action: 'workItems.update',
      entityType: 'task',
      entityId: item.id,
      workId: work.id,
      details: { changes: { status: { from: 'Chưa bắt đầu', to: 'Đang thực hiện' } } },
    });
    await logsRepo.writeLog({
      actorId: admin.id,
      actorName: admin.full_name,
      action: 'works.update',
      entityType: 'work',
      entityId: item.id, // CÙNG số id, khác loại thực thể
      details: { changes: { name: { from: 'x', to: 'y' } } },
    });

    const history = await itemsService.history(leader, item.code);
    expect(history.entries.map((e) => e.action)).toEqual(['workItems.create', 'workItems.update']);
    expect(history.entries[1].details.changes.status.to).toBe('Đang thực hiện');
    expect(history.originInfo.assignedByName).toBe(leader.full_name);
    expect(history.item.code).toBe(item.code);
  });

  it('TC-ORIGIN-13: đổi công việc chứa nhiệm vụ được ghi vào changes (work_id from→to)', async () => {
    const api = await loginAs(admin);
    const a = (await api.post('/api/v1/works', { name: 'Công việc A', departmentId: dept.id })).body
      .data.work;
    const b = (await api.post('/api/v1/works', { name: 'Công việc B', departmentId: dept.id })).body
      .data.work;

    const { item } = await itemsService.create(admin, {
      workRef: a.code,
      level: 3,
      name: 'Nhiệm vụ sẽ chuyển',
    });
    const moved = await itemsService.update(admin, item.code, {}, { targetWorkRef: b.code });

    expect(moved.moved).toBe(true);
    expect(moved.changes.work_id).toEqual({ from: a.id, to: b.id });
    // Mã dòng KHÔNG đổi khi chuyển công việc (§13.4 mục 6) nên `code` không nằm trong changes.
    expect(moved.changes.code).toBeUndefined();
    expect(moved.item.code).toBe(item.code);
  });

  it('TC-ORIGIN-14: không đọc được công việc thì không đọc được nhật ký của nó', async () => {
    const adminApi = await loginAs(admin);
    const other = await makeDepartment({ code: 'PH02', name: 'Phòng Kinh doanh' });
    const work = (
      await adminApi.post('/api/v1/works', { name: 'Việc phòng khác', departmentId: other.id })
    ).body.data.work;

    const staffApi = await loginAs(staff);
    const res = await staffApi.get(`/api/v1/works/${work.code}/history`);
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });
});

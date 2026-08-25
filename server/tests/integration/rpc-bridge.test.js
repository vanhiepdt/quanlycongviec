// Cầu tương thích `/api/rpc/*` (§7 việc 4.2) — bộ test canh HỢP ĐỒNG với giao diện cũ.
//
// Ba nhóm câu hỏi:
//   1. ĐỦ TÊN: 37 tên hàm mà `web/assets/js/app.js` gọi đều có dòng trong bảng, và mỗi tên đi đúng
//      route + đúng method. Thiếu một tên là `undefined is not a function` giữa lúc người dùng bấm
//      Lưu — không có lỗi nào hiện ra.
//   2. HÌNH DẠNG CŨ: `getProjects`/`getTasks` trả MẢNG khoá tiếng Việt (`Mã dự án`, `Tên nhiệm vụ`),
//      các hàm ghi trả `{success:true, projectId/taskId}` — đúng thứ 28 chỗ gọi đang đọc.
//   3. KHÔNG ÂM THẦM: tên chưa có nghiệp vụ trả 501 kèm câu tiếng Việt; thiếu token CSRF trả 403;
//      tên lạ trả 404. Không bao giờ 200 rỗng.
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { RPC_TABLE } from '../../src/rpc/table.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser, TEST_PASSWORD } from '../helpers/http.js';

const app = createApp();
let api;
let dept;
let admin;

/** Gọi một hàm cũ đúng như `api-bridge.js` gọi: POST `/api/rpc/<tên>` với thân `{args:[…]}`. */
const rpc = (name, args = [], opts = {}) => api.post(`/api/rpc/${name}`, { args }, opts);

/** Gọi và bắt buộc phải thành công — trả thẳng phần `data` (tức phần giao diện cũ nhận được). */
async function call(name, args = []) {
  const res = await rpc(name, args);
  expect(res.status, `${name}: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body.data;
}

/** Chờ audit ghi xong: audit chạy ở `res.on('finish')`, tức SAU khi supertest đã trả về. */
async function waitForLogs(minRows, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY id');
    if (rows.length >= minRows) return rows;
    await new Promise((r) => setTimeout(r, 25));
  }
  const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY id');
  return rows;
}

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

describe('bảng ánh xạ 37 tên hàm cũ', () => {
  const appJs = readFileSync(new URL('../../../web/assets/js/app.js', import.meta.url), 'utf8');

  it('TC-RPC-01: đủ 37 tên — kế hoạch ghi 36 là đếm thiếu (§13.5)', () => {
    expect(Object.keys(RPC_TABLE)).toHaveLength(37);
  });

  it('TC-RPC-02: mọi tên trong bảng đều thật sự có trong app.js', () => {
    // Không dò `google.script.run.tên(` được: 4 chỗ gọi ĐỘNG qua biến (`runner[text2](data)`),
    // nên chỉ khẳng định tên xuất hiện nguyên văn — đủ để bắt lỗi gõ sai trong bảng.
    const missing = Object.keys(RPC_TABLE).filter(
      (name) => !new RegExp(`\\b${name}\\b`).test(appJs)
    );
    expect(missing).toEqual([]);
  });

  it('TC-RPC-03: mỗi tên đã làm được đều khai đúng method + route REST', () => {
    const implemented = Object.entries(RPC_TABLE).filter(([, e]) => !e.notImplemented);
    expect(implemented).toHaveLength(20);
    for (const [name, entry] of implemented) {
      expect(entry.rest, name).toMatch(/^(GET|POST|PATCH|DELETE) \//);
      expect(typeof entry.handler, name).toBe('function');
    }
  });

  it('TC-RPC-04: GET /api/rpc liệt kê cả tên chưa làm để không ai tưởng là thiếu', async () => {
    const res = await api.get('/api/rpc');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(37);
    const pending = res.body.data.functions.filter((f) => !f.implemented);
    expect(pending).toHaveLength(17);
    expect(pending.map((f) => f.name)).toContain('getStaffList');
    expect(pending.map((f) => f.name)).not.toContain('getDataForUser');
    expect(pending.map((f) => f.name)).not.toContain('getInitialDataWithAuth');
    expect(pending.map((f) => f.name)).not.toContain('getDepartmentContext');
  });
});

describe('cửa vào: CSRF, tên lạ, tên chưa làm', () => {
  it('TC-RPC-05: thiếu header CSRF ⇒ 403, hàm ghi KHÔNG chạy', async () => {
    const res = await rpc('addProjectWithAuth', [{ name: 'Việc lén' }], { csrf: null });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM works');
    expect(rows[0].n).toBe(0);
  });

  it('TC-RPC-06: tên hàm lạ ⇒ 404 nói rõ tên nào, không phải 200 rỗng', async () => {
    const res = await rpc('kiemTraViSao', []);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('kiemTraViSao');
  });

  it('TC-RPC-07: tên chưa có nghiệp vụ ⇒ 501 + câu tiếng Việt gọi đúng tên chức năng', async () => {
    const res = await rpc('getStaffList', []);
    expect(res.status).toBe(501);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
    expect(res.body.error.message).toContain('Danh sách nhân sự');
  });

  it('TC-RPC-08: cả 17 tên chưa làm đều trả 501, không tên nào lọt thành 200', async () => {
    const pendingNames = Object.entries(RPC_TABLE)
      .filter(([, e]) => e.notImplemented)
      .map(([name]) => name);
    for (const name of pendingNames) {
      const res = await rpc(name, [{}, {}]);
      expect(res.status, name).toBe(501);
    }
  });
});

describe('đăng nhập / đăng xuất / đổi mật khẩu qua cầu RPC', () => {
  it('TC-RPC-09: authenticateUser đúng mật khẩu ⇒ {success:true} + cookie phiên thật', async () => {
    const fresh = client(app);
    const res = await fresh.post('/api/rpc/authenticateUser', {
      args: [admin.email, TEST_PASSWORD],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.user.email).toBe(admin.email);
    // Cookie phải đi ra từ res THẬT, không mắc lại trong res giả của lời gọi con.
    // Tên cookie có tiền tố theo môi trường (`qlcv_sid_test`), nên chỉ kiểm phần `sid`.
    expect(String(res.headers['set-cookie'])).toMatch(/sid[^=]*=/);
    // Và phiên dùng được ngay cho lời gọi tiếp theo.
    const after = await fresh.post('/api/rpc/getProjects', { args: [] });
    expect(after.status).toBe(200);
  });

  it('TC-RPC-10: sai mật khẩu ⇒ 401 INVALID_CREDENTIALS (giao diện cũ hiện trong modal)', async () => {
    const fresh = client(app);
    const res = await fresh.post('/api/rpc/authenticateUser', {
      args: [admin.email, 'sai-be-bet'],
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('TC-RPC-11: chưa đăng nhập mà gọi hàm nghiệp vụ ⇒ 401 để cầu bật lại modal', async () => {
    const fresh = client(app);
    const res = await fresh.post('/api/rpc/getProjects', { args: [] });
    expect(res.status).toBe(401);
  });

  it('TC-RPC-12: logout ⇒ phiên hết hiệu lực ngay', async () => {
    expect((await call('logout')).success).toBe(true);
    const after = await rpc('getProjects');
    expect(after.status).toBe(401);
  });

  it('TC-RPC-13: changePassword 2 tham số (modal cũ) ⇒ báo thiếu mật khẩu hiện tại', async () => {
    const res = await rpc('changePassword', ['MatKhauMoi@123', 'MatKhauMoi@123']);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Mật khẩu hiện tại');
  });

  it('TC-RPC-14: nhập lại không khớp ⇒ chặn trước khi gọi API', async () => {
    const res = await rpc('changePassword', [TEST_PASSWORD, 'MatKhauMoi@123', 'khac@123']);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('nhập lại không khớp');
  });

  it('TC-RPC-15: đủ 3 tham số ⇒ đổi được, mật khẩu mới đăng nhập được', async () => {
    const data = await call('changePassword', [TEST_PASSWORD, 'MatKhauMoi@123', 'MatKhauMoi@123']);
    expect(data.success).toBe(true);
    const fresh = client(app);
    const again = await fresh.post('/api/rpc/authenticateUser', {
      args: [admin.email, 'MatKhauMoi@123'],
    });
    expect(again.status).toBe(200);
  });
});

// Việc 4.4: lời gọi ĐẦU TIÊN của trang quyết định người chưa đăng nhập thấy gì.
describe('mở trang khi chưa đăng nhập — phải ra modal, không ra lỗi hệ thống', () => {
  it('TC-RPC-36: khách mở trang ⇒ {requireLogin:true} 200, KHÔNG phải 501 kèm toast đỏ', async () => {
    const fresh = client(app);
    const res = await fresh.post('/api/rpc/getInitialDataWithAuth', { args: [] });
    expect(res.status).toBe(200);
    // Đúng cờ mà dòng 133 `app.js` đang chờ: `if (response.requireLogin) showLoginModal()`.
    expect(res.body.data).toEqual({ requireLogin: true });
    expect(res.body.data.success).toBeUndefined();
  });

  it('TC-RPC-37: ĐÃ đăng nhập ⇒ gói đầu trang (success + user.name), không còn 501', async () => {
    const res = await rpc('getInitialDataWithAuth');
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.user.name).toBe(admin.full_name);
    expect(res.body.data.user.full_name).toBe(admin.full_name);
    expect(res.body.data.requireLogin).toBeUndefined();
  });

  it('TC-RPC-38: đăng xuất rồi mở lại trang ⇒ lại về cờ đăng nhập, không kẹt ở lỗi', async () => {
    expect((await call('logout')).success).toBe(true);
    const res = await rpc('getInitialDataWithAuth');
    expect(res.status).toBe(200);
    expect(res.body.data.requireLogin).toBe(true);
  });
});

describe('công việc cấp 1 — đúng hình dạng "dự án" của giao diện cũ', () => {
  // Payload y như `new FormData(#project-form)` sinh ra: khoá tiếng Anh, ngày dạng chuỗi, không có
  // phòng và không có duyệt.
  const form = {
    name: 'Nâng cấp hệ thống',
    description: 'Chuyển sang VPS',
    manager: 'Trần Thị B',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'Đang thực hiện',
  };

  it('TC-RPC-16: addProjectWithAuth trả MÃ (CV0xx), không trả id số', async () => {
    const data = await call('addProjectWithAuth', [form]);
    expect(data.success).toBe(true);
    expect(data.projectId).toMatch(/^CV\d{3,}$/);
    const { rows } = await pool.query('SELECT * FROM works');
    expect(rows).toHaveLength(1);
    // `manager` của form là họ tên tự do ⇒ phải vào `manager_name`, không vào `manager_id`.
    expect(rows[0].manager_name).toBe('Trần Thị B');
    expect(rows[0].manager_id).toBeNull();
    expect(rows[0].start_date).toBe('2026-09-01');
  });

  it('TC-RPC-17: getProjects trả MẢNG THUẦN khoá tiếng Việt (giao diện gán allProjects = response)', async () => {
    // Tạo qua REST để đặt được `departmentId` — form cũ không có ô phòng.
    const created = await api.post('/api/v1/works', {
      name: 'Việc có phòng',
      departmentId: dept.id,
      startDate: '2026-09-01',
      status: 'Đang thực hiện',
    });
    expect(created.status).toBe(200);

    const list = await call('getProjects');
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
    const row = list[0];
    expect(row['Mã dự án']).toBe(created.body.data.work.code);
    expect(row['Tên dự án']).toBe('Việc có phòng');
    expect(row['Phòng']).toBe(dept.name); // tên phòng bằng chữ, không phải department_id
    expect(row['Ngày bắt đầu']).toBe('2026-09-01');
    expect(row['Trạng thái dự án']).toBe('Đang thực hiện');
    // Không có khoá nào là undefined: giao diện cũ đọc thẳng nên undefined hiện ra chữ "undefined".
    for (const [key, value] of Object.entries(row)) {
      expect(value, key).not.toBeUndefined();
    }
  });

  it('TC-RPC-18: updateProjectWithAuth nhận MÃ làm id (giao diện gọi lại bằng chính giá trị vừa nhận)', async () => {
    const code = (await call('addProjectWithAuth', [form])).projectId;
    const data = await call('updateProjectWithAuth', [
      code,
      { name: 'Tên đã sửa', status: 'Hoàn thành' },
    ]);
    expect(data.projectId).toBe(code);
    const { rows } = await pool.query('SELECT name, status, manager_name FROM works');
    expect(rows[0].name).toBe('Tên đã sửa');
    expect(rows[0].status).toBe('Hoàn thành');
    // Trường không gửi thì không được ghi rỗng — `dropUndefined` giữ đúng điều này.
    expect(rows[0].manager_name).toBe('Trần Thị B');
  });

  it('TC-RPC-19: copyProjectWithAuth trả mã bản sao và số dòng con', async () => {
    const code = (await call('addProjectWithAuth', [form])).projectId;
    await call('addTaskWithAuth', [{ projectId: code, name: 'Nhiệm vụ con' }]);
    const data = await call('copyProjectWithAuth', [code, 'Bản sao 2026']);
    expect(data.projectId).toMatch(/^CV\d{3,}$/);
    expect(data.projectId).not.toBe(code);
    expect(data.message).toContain('1');
  });

  it('TC-RPC-20: deleteProjectWithAuth nói rõ đã xoá kèm những mã nào', async () => {
    const code = (await call('addProjectWithAuth', [form])).projectId;
    const taskId = (await call('addTaskWithAuth', [{ projectId: code, name: 'Nhiệm vụ con' }]))
      .taskId;
    const data = await call('deleteProjectWithAuth', [code]);
    expect(data.deletedProject).toBe(code);
    expect(data.deletedItems).toContain(taskId);
    expect(data.deletedCount).toBe(2);
  });

  it('TC-RPC-21: nhật ký ghi tên nghiệp vụ THẬT (works.create), không phải rpc.<tên>', async () => {
    await call('addProjectWithAuth', [form]);
    const rows = await waitForLogs(1);
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('works.create');
    expect(actions).not.toContain('rpc.addProjectWithAuth');
    expect(rows.find((r) => r.action === 'works.create').actor_id).toBe(admin.id);
  });

  it('TC-RPC-22: thiếu tên ⇒ 400 kèm câu tiếng Việt của zod, không phải 500', async () => {
    const res = await rpc('addProjectWithAuth', [{ description: 'thiếu tên' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('tên công việc');
  });

  it('TC-RPC-23: gọi sửa mà thiếu mã ⇒ 400 nói rõ thiếu tham số nào', async () => {
    const res = await rpc('updateProjectWithAuth', [undefined, { name: 'x' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Mã dự án');
  });
});

describe('nhiệm vụ — đúng hình dạng "task" của giao diện cũ', () => {
  let projectCode;

  beforeEach(async () => {
    projectCode = (await call('addProjectWithAuth', [{ name: 'Việc gốc' }])).projectId;
  });

  // Payload y như `new FormData(#task-form)`: `projectId` là MÃ công việc (option value lấy từ
  // `COL.P_ID`), `resultLinks` là một textarea nhiều dòng.
  const form = (over = {}) => ({
    projectId: projectCode,
    name: 'Viết tài liệu',
    description: 'Mô tả',
    assignee: 'Lê Văn C',
    status: 'Đang thực hiện',
    priority: 'Cao',
    startDate: '2026-09-01',
    dueDate: '2026-09-10',
    completion: '40',
    target: 'Xong tài liệu',
    output: 'Tệp PDF',
    notes: 'Ghi chú',
    resultLinks: '[Bản nháp] https://a.vn/x?a=1,2\n[Bản cuối] https://b.vn/y',
    ...over,
  });

  it('TC-RPC-24: addTaskWithAuth — projectId là MÃ ⇒ vào workRef, textarea link tách theo DÒNG', async () => {
    const data = await call('addTaskWithAuth', [form()]);
    expect(data.taskId).toMatch(/^CV\d{3,}/);
    const { rows } = await pool.query('SELECT * FROM work_items');
    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe(3); // form cũ chỉ tạo nhiệm vụ cấp 3
    expect(rows[0].assignee_name).toBe('Lê Văn C');
    expect(rows[0].completion).toBe(40); // form gửi chuỗi '40'
    // Tách theo dấu phẩy sẽ cắt đôi `https://a.vn/x?a=1,2` — đây là chỗ canh việc đó.
    expect(rows[0].result_links).toEqual([
      '[Bản nháp] https://a.vn/x?a=1,2',
      '[Bản cuối] https://b.vn/y',
    ]);
  });

  it('TC-RPC-25: thiếu projectId ⇒ 400 «Thuộc dự án», không tạo dòng mồ côi', async () => {
    const res = await rpc('addTaskWithAuth', [{ name: 'Không thuộc việc nào' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Thuộc dự án');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM work_items');
    expect(rows[0].n).toBe(0);
  });

  it('TC-RPC-26: getTasks trả mảng khoá tiếng Việt, «Mã dự án» đọc từ công việc cha', async () => {
    const taskId = (await call('addTaskWithAuth', [form()])).taskId;
    const list = await call('getTasks');
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
    const row = list[0];
    expect(row['Mã nhiệm vụ']).toBe(taskId);
    expect(row['Mã dự án']).toBe(projectCode);
    expect(row['Tên nhiệm vụ']).toBe('Viết tài liệu');
    expect(row['Người thực hiện']).toBe('Lê Văn C');
    expect(row['Tiến độ (%)']).toBe(40);
    expect(row['Hạn chót']).toBe('2026-09-10');
    expect(row['Cấp']).toBe(3);
    expect(row['Mã cha']).toBe('');
    // `parseLinks` đọc MỖI DÒNG MỘT LINK ⇒ phải là chuỗi nối bằng '\n', không phải JSON.
    expect(row['Link kết quả']).toBe('[Bản nháp] https://a.vn/x?a=1,2\n[Bản cuối] https://b.vn/y');
    // `app.js` kiểm `Array.isArray(task[COL.T_REMINDERS])` ⇒ mảng thật, kể cả khi không có nhắc việc.
    expect(Array.isArray(row['Nhắc việc'])).toBe(true);
    expect(row['Nhắc việc']).toEqual([]);
  });

  it('TC-RPC-27: getTasks gộp nhiệm vụ của NHIỀU công việc và giữ đúng cha cho cấp 2/3', async () => {
    const second = (await call('addProjectWithAuth', [{ name: 'Việc thứ hai' }])).projectId;
    await call('addTaskWithAuth', [{ projectId: projectCode, name: 'A' }]);
    // Cấp 2 + cấp 3 con của nó: tạo qua REST vì form cũ không có ô cấp/cha.
    const sub = await api.post('/api/v1/work-items', {
      workRef: second,
      level: 2,
      name: 'Công việc con',
    });
    expect(sub.status).toBe(200);
    const child = await api.post('/api/v1/work-items', {
      workRef: second,
      level: 3,
      parentRef: sub.body.data.item.code,
      name: 'Nhiệm vụ trong công việc con',
    });
    expect(child.status).toBe(200);

    const list = await call('getTasks');
    expect(list).toHaveLength(3);
    const byName = new Map(list.map((r) => [r['Tên nhiệm vụ'], r]));
    expect(byName.get('A')['Mã dự án']).toBe(projectCode);
    expect(byName.get('Công việc con')['Mã dự án']).toBe(second);
    expect(byName.get('Công việc con')['Cấp']).toBe(2);
    expect(byName.get('Nhiệm vụ trong công việc con')['Mã cha']).toBe(sub.body.data.item.code);
  });

  it('TC-RPC-28: updateTaskWithAuth sửa theo mã, không chạm trường không gửi', async () => {
    const taskId = (await call('addTaskWithAuth', [form()])).taskId;
    const data = await call('updateTaskWithAuth', [
      taskId,
      { status: 'Hoàn thành', completion: '100' },
    ]);
    expect(data.taskId).toBe(taskId);
    const { rows } = await pool.query('SELECT status, completion, notes FROM work_items');
    expect(rows[0].status).toBe('Hoàn thành');
    expect(rows[0].completion).toBe(100);
    expect(rows[0].notes).toBe('Ghi chú');
  });

  it('TC-RPC-29: deleteTaskWithAuth và copyTaskWithAuth trả mã, không trả id số', async () => {
    const taskId = (await call('addTaskWithAuth', [form()])).taskId;
    const copied = await call('copyTaskWithAuth', [taskId, 'Bản sao nhiệm vụ']);
    expect(copied.taskId).not.toBe(taskId);
    const deleted = await call('deleteTaskWithAuth', [taskId]);
    expect(deleted.deletedTask).toBe(taskId);
    const { rows } = await pool.query('SELECT code FROM work_items');
    expect(rows.map((r) => r.code)).toEqual([copied.taskId]);
  });

  it('TC-RPC-30: reorderTasks nhận danh sách MÃ theo thứ tự mới', async () => {
    const a = (await call('addTaskWithAuth', [form({ name: 'A' })])).taskId;
    const b = (await call('addTaskWithAuth', [form({ name: 'B' })])).taskId;
    const data = await call('reorderTasks', [projectCode, [b, a]]);
    expect(data.ordered).toHaveLength(2);
    const { rows } = await pool.query('SELECT code FROM work_items ORDER BY sort_order, id');
    expect(rows.map((r) => r.code)).toEqual([b, a]);
  });
});

describe('nhắc việc — đổi SỐ THỨ TỰ của bản cũ thành reminderId thật', () => {
  let taskId;

  beforeEach(async () => {
    const projectCode = (await call('addProjectWithAuth', [{ name: 'Việc có nhắc' }])).projectId;
    taskId = (await call('addTaskWithAuth', [{ projectId: projectCode, name: 'Nhiệm vụ' }])).taskId;
  });

  it('TC-RPC-31: addTaskReminder trả cả danh sách {date, content} đã xếp theo ngày', async () => {
    await call('addTaskReminder', [taskId, { date: '2026-10-20', content: 'Nhắc muộn' }]);
    const data = await call('addTaskReminder', [
      taskId,
      { date: '2026-10-01', content: 'Nhắc sớm' },
    ]);
    expect(data.success).toBe(true);
    expect(data.reminders.map((r) => r.date)).toEqual(['2026-10-01', '2026-10-20']);
    expect(data.reminders[0].content).toBe('Nhắc sớm');
  });

  it('TC-RPC-32: updateTaskReminder(index) sửa ĐÚNG dòng người dùng đang thấy', async () => {
    await call('addTaskReminder', [taskId, { date: '2026-10-20', content: 'Nhắc muộn' }]);
    await call('addTaskReminder', [taskId, { date: '2026-10-01', content: 'Nhắc sớm' }]);
    // Index 1 là dòng THỨ HAI theo thứ tự hiển thị (2026-10-20), không phải dòng thêm thứ hai.
    const data = await call('updateTaskReminder', [
      taskId,
      1,
      { date: '2026-10-25', content: 'Đã dời' },
    ]);
    const byDate = new Map(data.reminders.map((r) => [r.date, r.content]));
    expect(byDate.get('2026-10-25')).toBe('Đã dời');
    expect(byDate.get('2026-10-01')).toBe('Nhắc sớm');
    expect(data.reminders).toHaveLength(2);
  });

  it('TC-RPC-33: deleteTaskReminder(index) xoá đúng dòng đó', async () => {
    await call('addTaskReminder', [taskId, { date: '2026-10-01', content: 'Giữ lại' }]);
    await call('addTaskReminder', [taskId, { date: '2026-10-20', content: 'Xoá đi' }]);
    const data = await call('deleteTaskReminder', [taskId, 1]);
    expect(data.reminders).toHaveLength(1);
    expect(data.reminders[0].content).toBe('Giữ lại');
  });

  it('TC-RPC-34: index vượt danh sách ⇒ 404 nói rõ danh sách đã đổi, KHÔNG sửa nhầm dòng', async () => {
    await call('addTaskReminder', [taskId, { date: '2026-10-01', content: 'Giữ nguyên' }]);
    const res = await rpc('deleteTaskReminder', [taskId, 5]);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('danh sách đã đổi');
    const { rows } = await pool.query('SELECT content FROM reminders');
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('Giữ nguyên');
  });

  it('TC-RPC-35: ngày nhắc rỗng ⇒ 400 tiếng Việt, không phải 500 từ CSDL', async () => {
    const res = await rpc('addTaskReminder', [taskId, { date: '', content: 'x' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Ngày nhắc');
  });
});

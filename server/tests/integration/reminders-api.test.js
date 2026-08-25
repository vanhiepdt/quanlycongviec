// Nhắc việc `/api/v1/work-items/:id/reminders` — TC-TREE-28 và mục C9/C10 (§7 việc 3.8).
//
// Ba câu hỏi bộ test này canh:
//   1. Nhắc việc CHỈ gắn được vào Nhiệm vụ cấp 3; gọi trên Công việc con phải báo rõ (bản cũ còn
//      nợ chỗ này nên cấp 2 vẫn lọt, mục C10).
//   2. Nhắc việc của nhiệm vụ này không sửa/xoá được qua đường dẫn của nhiệm vụ khác.
//   3. Ai sửa được nhiệm vụ thì đặt được nhắc việc cho nó — bản cũ chỉ cho admin nên người thực
//      hiện không tự đặt nổi lời nhắc cho việc của chính mình (Code.gs.moi:2136).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import * as worksRepo from '../../src/modules/works/repo.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
let api;
let dept;
let admin;
let work;
let sub;
let task;

/** Tạo một dòng cấp 2/cấp 3 qua API và trả thẳng dòng vừa tạo. */
const addItem = async (body) => {
  const res = await api.post('/api/v1/work-items', { workRef: work.code, ...body });
  expect(res.status).toBe(200);
  return res.body.data.item;
};

const url = (ref, reminderId = null) =>
  `/api/v1/work-items/${ref}/reminders${reminderId === null ? '' : `/${reminderId}`}`;

const countRows = async () => {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM reminders');
  return rows[0].n;
};

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

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  api = client(app);
  await api.login(admin.email);
  work = await worksRepo.insert({
    name: 'Công việc gốc',
    department_id: dept.id,
    start_date: '2026-09-01',
    end_date: '2026-09-30',
  });
  sub = await addItem({ level: 2, name: 'Công việc con A' });
  task = await addItem({ level: 3, name: 'Nhiệm vụ A1', parentRef: sub.code });
});

afterAll(async () => {
  await closePool();
});
describe('POST /api/v1/work-items/:id/reminders — thêm nhắc việc', () => {
  it('thêm được cho Nhiệm vụ cấp 3, trả về cả danh sách sau khi thêm', async () => {
    const res = await api.post(url(task.code), {
      remindDate: '2026-09-10',
      content: 'Gọi nhắc bên kỹ thuật',
    });
    expect(res.status).toBe(200);
    const { reminder, reminders } = res.body.data;
    expect(reminder.remind_date).toBe('2026-09-10');
    expect(reminder.content).toBe('Gọi nhắc bên kỹ thuật');
    expect(reminder.created_by).toBe(admin.id);
    // Trả nguyên danh sách, đúng như `addTaskReminder` bản cũ: giao diện vẽ lại chứ không tự chèn.
    expect(reminders.map((r) => r.id)).toEqual([reminder.id]);
  });

  it('không gửi nội dung ⇒ nội dung rỗng, không lỗi', async () => {
    const res = await api.post(url(task.code), { remindDate: '2026-09-10' });
    expect(res.status).toBe(200);
    expect(res.body.data.reminder.content).toBe('');
  });

  it('TC-TREE-28: thêm nhắc việc cho Công việc con (cấp 2) ⇒ 409 REMINDER_ON_SUBWORK', async () => {
    const res = await api.post(url(sub.code), { remindDate: '2026-09-10', content: 'Sai cấp' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REMINDER_ON_SUBWORK');
    expect(res.body.error.message).toContain('cấp 3');
    // Và không để lại dòng nào: trigger nổ trong giao dịch nên không có nửa vời.
    expect(await countRows()).toBe(0);
  });

  it('thiếu ngày nhắc ⇒ 400 kèm tên trường, không tạo dòng', async () => {
    const res = await api.post(url(task.code), { content: 'Quên ngày' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('remindDate');
    expect(await countRows()).toBe(0);
  });

  it('ngày rỗng hoặc sai dạng ⇒ 400, không lọt xuống CSDL thành lỗi 500', async () => {
    for (const remindDate of ['', '10/09/2026', '2026-9-10', 'hôm nào đó']) {
      const res = await api.post(url(task.code), { remindDate });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await countRows()).toBe(0);
  });

  it('nhiệm vụ không tồn tại ⇒ 404', async () => {
    const res = await api.post(url('CV001-999'), { remindDate: '2026-09-10' });
    expect(res.status).toBe(404);
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const guest = client(app);
    expect((await guest.post(url(task.code), { remindDate: '2026-09-10' })).status).toBe(401);
    expect((await guest.get(url(task.code))).status).toBe(401);
  });
});
describe('GET / PATCH / DELETE — đọc, sửa, xoá nhắc việc', () => {
  /** Ba nhắc việc thêm KHÔNG theo thứ tự ngày, để thấy danh sách tự xếp theo ngày. */
  const seed = async (ref = task.code) => {
    const dates = ['2026-09-20', '2026-09-05', '2026-09-12'];
    const created = [];
    for (const remindDate of dates) {
      const res = await api.post(url(ref), { remindDate, content: `Nhắc ${remindDate}` });
      expect(res.status).toBe(200);
      created.push(res.body.data.reminder);
    }
    return created;
  };

  it('danh sách xếp theo ngày nhắc, không theo thứ tự thêm', async () => {
    await seed();
    const res = await api.get(url(task.code));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.reminders.map((r) => r.remind_date)).toEqual([
      '2026-09-05',
      '2026-09-12',
      '2026-09-20',
    ]);
    expect(res.body.data.item.code).toBe(task.code);
  });

  it('sửa ngày và nội dung, danh sách xếp lại theo ngày mới', async () => {
    const [first] = await seed();
    const res = await api.patch(url(task.code, first.id), {
      remindDate: '2026-09-01',
      content: 'Đã đổi',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.reminder.remind_date).toBe('2026-09-01');
    expect(res.body.data.reminder.content).toBe('Đã đổi');
    expect(res.body.data.reminders[0].id).toBe(first.id);
  });

  it('PATCH không gửi trường nào ⇒ dòng giữ nguyên, không lỗi', async () => {
    const [first] = await seed();
    const res = await api.patch(url(task.code, first.id), {});
    expect(res.status).toBe(200);
    expect(res.body.data.reminder).toMatchObject({
      id: first.id,
      remind_date: first.remind_date,
      content: first.content,
    });
  });

  it('xoá đúng một nhắc việc, hai dòng còn lại nguyên vẹn', async () => {
    const [, second] = await seed();
    const res = await api.del(url(task.code, second.id));
    expect(res.status).toBe(200);
    expect(res.body.data.deletedId).toBe(second.id);
    expect(res.body.data.reminders.map((r) => r.id)).not.toContain(second.id);
    expect(await countRows()).toBe(2);
  });

  it('id nhắc việc không tồn tại hoặc không phải số ⇒ 404, không phải 500', async () => {
    await seed();
    for (const badId of [999999, 'abc', '0', '-1']) {
      const res = await api.patch(url(task.code, badId), { content: 'x' });
      expect(res.status).toBe(404);
    }
    expect((await api.del(url(task.code, 999999))).status).toBe(404);
    expect(await countRows()).toBe(3);
  });

  it('không sửa/xoá được nhắc việc của nhiệm vụ KHÁC qua đường dẫn của nhiệm vụ này', async () => {
    const [mine] = await seed();
    const other = await addItem({ level: 3, name: 'Nhiệm vụ A2', parentRef: sub.code });

    expect((await api.patch(url(other.code, mine.id), { content: 'cướp' })).status).toBe(404);
    expect((await api.del(url(other.code, mine.id))).status).toBe(404);
    // Dòng gốc còn nguyên cả nội dung.
    const res = await api.get(url(task.code));
    expect(res.body.data.reminders.find((r) => r.id === mine.id).content).toBe(mine.content);
    expect(await countRows()).toBe(3);
    // Và nhiệm vụ kia vẫn chưa có nhắc việc nào.
    expect((await api.get(url(other.code))).body.data.reminders).toEqual([]);
  });
});
describe('Quyền đặt nhắc việc (§6)', () => {
  let staff;
  let mine;

  beforeEach(async () => {
    staff = await makeLoginUser({
      code: 'NV002',
      full_name: 'Trần Thị B',
      email: 'b@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    mine = await addItem({
      level: 3,
      name: 'Nhiệm vụ của B',
      parentRef: sub.code,
      assigneeId: staff.id,
    });
  });

  it('Nhân viên tự đặt được nhắc việc cho nhiệm vụ CỦA MÌNH (bản cũ chỉ cho admin)', async () => {
    const asStaff = client(app);
    await asStaff.login(staff.email);
    const res = await asStaff.post(url(mine.code), {
      remindDate: '2026-09-08',
      content: 'Tự nhắc',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.reminder.created_by).toBe(staff.id);
  });

  it('Nhân viên KHÔNG đặt được nhắc việc cho nhiệm vụ của người khác ⇒ 403', async () => {
    const outsider = await makeLoginUser({
      code: 'NV003',
      full_name: 'Lê Văn C',
      email: 'c@congty.vn',
      role: 'Nhân viên',
      department_id: dept.id,
    });
    const asOutsider = client(app);
    await asOutsider.login(outsider.email);

    const res = await asOutsider.post(url(mine.code), { remindDate: '2026-09-08' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await countRows()).toBe(0);
    // Đọc thì vẫn được: nhiệm vụ nằm trong phòng của họ.
    expect((await asOutsider.get(url(mine.code))).status).toBe(200);
  });
});
describe('Nhật ký nhắc việc nằm trong nhật ký của nhiệm vụ (§2.3)', () => {
  it('thêm rồi xoá nhắc việc đều hiện trong /work-items/:id/history của nhiệm vụ đó', async () => {
    const added = await api.post(url(task.code), {
      remindDate: '2026-09-10',
      content: 'Nhắc gọi điện',
    });
    await api.del(url(task.code, added.body.data.reminder.id));
    // 2 dòng tạo dòng cấp 2/cấp 3 + thêm nhắc việc + xoá nhắc việc.
    await waitForLogs(4);

    const res = await api.get(`/api/v1/work-items/${task.code}/history`);
    expect(res.status).toBe(200);
    const actions = res.body.data.entries.map((e) => e.action);
    expect(actions).toContain('reminders.create');
    expect(actions).toContain('reminders.remove');

    const create = res.body.data.entries.find((e) => e.action === 'reminders.create');
    expect(create.entity_type).toBe('task');
    expect(create.details).toMatchObject({ code: task.code, remindDate: '2026-09-10' });
    expect(create.actor_name).toBe(admin.full_name);
  });

  it('gọi sai cấp (409) KHÔNG để lại dòng nhật ký nào', async () => {
    await api.post(url(sub.code), { remindDate: '2026-09-10' });
    // Chỉ còn 2 dòng của hai lần tạo dòng cấp 2/cấp 3 trong beforeEach.
    const rows = await waitForLogs(2);
    expect(rows.filter((r) => String(r.action).startsWith('reminders.'))).toEqual([]);
  });
});

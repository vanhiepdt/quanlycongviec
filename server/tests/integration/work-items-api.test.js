// API Công việc con (cấp 2) và Nhiệm vụ (cấp 3) — §7 việc 3.2, 3.3, 3.4. Chạy qua HTTP thật nên
// bao gồm cả CSRF, phiên và phân quyền.
//
// Đây là nơi port các phép kiểm cây của `tools/test-tasks-gd2.js`: sáu nhánh chặn của `updateTask`
// và toàn bộ đường "chuyển sang công việc khác". Chỗ nào hành vi bản mới KHÁC bản cũ thì test ghi
// rõ vì sao (§13.3, §13.4).
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
let work;

/** Công việc cấp 1 tối thiểu, cùng phòng với admin để không vướng phạm vi §6. */
const makeWork = (over = {}) =>
  worksRepo.insert({
    name: 'Công việc gốc',
    department_id: dept.id,
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    ...over,
  });

const create = (body) => api.post('/api/v1/work-items', { workRef: work.code, ...body });

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  api = client(app);
  await api.login(admin.email);
  work = await makeWork();
});

afterAll(async () => {
  await closePool();
});

describe('POST /api/v1/work-items — tạo (§7 việc 3.2)', () => {
  it('TC-TREE-01: cấp 2 không có cha ⇒ tạo được, mã do máy chủ sinh', async () => {
    const res = await create({ level: 2, name: 'Công việc con A' });
    expect(res.status).toBe(200);
    expect(res.body.data.item.code).toBe('CV001-001');
    expect(res.body.data.item.level).toBe(2);
    expect(res.body.data.item.parent_id).toBeNull();
    // Phòng thừa hưởng từ công việc cha, không phải gửi lên (§4.1, mục C18).
    expect(res.body.data.item.department_id).toBe(dept.id);
  });

  it('TC-TREE-02: cấp 2 mà gửi kèm cha ⇒ 400, không tạo dòng nào', async () => {
    const parent = await create({ level: 2, name: 'Cha' });
    const res = await create({
      level: 2,
      name: 'Con sai cấp',
      parentRef: parent.body.data.item.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LVL2_NO_PARENT');
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM work_items`);
    expect(rows[0].n).toBe(1);
  });

  it('TC-TREE-03: cấp 3 với cha là cấp 2 cùng công việc ⇒ tạo được', async () => {
    const parent = await create({ level: 2, name: 'Cha' });
    const res = await create({ level: 3, name: 'Nhiệm vụ', parentRef: parent.body.data.item.code });
    expect(res.status).toBe(200);
    expect(res.body.data.item.parent_id).toBe(parent.body.data.item.id);
    expect(res.body.data.item.code).toBe('CV001-002');
  });

  it('TC-TREE-04: cha là cấp 3 ⇒ 400 PARENT_NOT_SUBWORK', async () => {
    const sub = await create({ level: 2, name: 'Cha' });
    const task = await create({ level: 3, name: 'Nhiệm vụ', parentRef: sub.body.data.item.code });
    const res = await create({ level: 3, name: 'Cháu', parentRef: task.body.data.item.code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PARENT_NOT_SUBWORK');
  });

  it('TC-TREE-05: cha ở công việc khác ⇒ 400 PARENT_OTHER_WORK', async () => {
    const other = await makeWork({ name: 'Công việc khác' });
    const otherSub = await api.post('/api/v1/work-items', {
      workRef: other.code,
      level: 2,
      name: 'Cha nơi khác',
    });
    const res = await create({ level: 3, name: 'Nhiệm vụ', parentRef: otherSub.body.data.item.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PARENT_OTHER_WORK');
  });

  it('TC-TREE-06: cha không tồn tại ⇒ 400 PARENT_NOT_FOUND', async () => {
    const res = await create({ level: 3, name: 'Nhiệm vụ', parentRef: 'CV001-999' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PARENT_NOT_FOUND');
  });

  it('TC-TREE-07: không truyền cấp ⇒ mặc định 3, đúng như addTask bản cũ', async () => {
    const res = await create({ name: 'Không nói cấp' });
    expect(res.status).toBe(200);
    expect(res.body.data.item.level).toBe(3);
  });

  it('TC-TREE-34: ngày ngoài khoảng ngày công việc ⇒ CẢNH BÁO, vẫn lưu', async () => {
    const res = await create({ name: 'Ngoài khoảng', startDate: '2026-08-01' });
    expect(res.status).toBe(200);
    expect(res.body.data.warnings.map((w) => w.code)).toContain('OUTSIDE_WORK_RANGE');
    expect(await itemsRepo.findByCode('CV001-001')).not.toBeNull();
  });

  it('công việc không tồn tại ⇒ 404, không tạo dòng nào', async () => {
    const res = await api.post('/api/v1/work-items', { workRef: 'CV999', name: 'Mồ côi' });
    expect(res.status).toBe(404);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM work_items`);
    expect(rows[0].n).toBe(0);
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const guest = client(app);
    const res = await guest.post('/api/v1/work-items', { workRef: work.code, name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/work-items/:id — sáu nhánh chặn (§7 việc 3.3)', () => {
  let sub;
  let task;

  beforeEach(async () => {
    sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    task = (await create({ level: 3, name: 'Nhiệm vụ A1', parentRef: sub.code })).body.data.item;
  });

  it('TC-TREE-08: đổi cấp 3→2 ⇒ 400 LEVEL_IMMUTABLE, kèm lời khuyên xoá rồi tạo lại', async () => {
    const res = await api.patch(`/api/v1/work-items/${task.code}`, { level: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LEVEL_IMMUTABLE');
    expect(res.body.error.message).toMatch(/xoá rồi tạo lại/);
    expect((await itemsRepo.findByCode(task.code)).level).toBe(3);
  });

  it('TC-TREE-09: chọn chính mình làm cha ⇒ 400 SELF_PARENT', async () => {
    const res = await api.patch(`/api/v1/work-items/${sub.code}`, { parentRef: sub.code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_PARENT');
  });

  it('TC-TREE-10: chọn con cháu của mình làm cha ⇒ 400 CYCLE', async () => {
    const res = await api.patch(`/api/v1/work-items/${sub.code}`, { parentRef: task.code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CYCLE');
  });

  it('TC-TREE-12: KHÔNG truyền parentRef ⇒ giữ nguyên cha cũ', async () => {
    const res = await api.patch(`/api/v1/work-items/${task.code}`, { name: 'Đổi tên thôi' });
    expect(res.status).toBe(200);
    expect(res.body.data.item.parent_id).toBe(sub.id);
    expect(res.body.data.item.name).toBe('Đổi tên thôi');
  });

  it('truyền parentRef rỗng ⇒ bỏ cha, nhiệm vụ thành mồ côi (dữ liệu cũ có thật)', async () => {
    const res = await api.patch(`/api/v1/work-items/${task.code}`, { parentRef: '' });
    expect(res.status).toBe(200);
    expect(res.body.data.item.parent_id).toBeNull();
  });

  it('gán cha là dòng cấp 3 ⇒ 400 PARENT_NOT_SUBWORK (trigger, không phải kiểm tay)', async () => {
    const task2 = (await create({ level: 3, name: 'Nhiệm vụ A2', parentRef: sub.code })).body.data
      .item;
    const res = await api.patch(`/api/v1/work-items/${task2.code}`, { parentRef: task.code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PARENT_NOT_SUBWORK');
  });

  it('TC-TREE-20: sửa một trường KHÔNG làm mất cấp, cha, người thực hiện, nhắc việc', async () => {
    await pool.query(
      `INSERT INTO reminders (work_item_id, remind_date, content) VALUES ($1, $2, $3)`,
      [task.id, '2026-09-10', 'Nhắc trước một hôm']
    );
    await api.patch(`/api/v1/work-items/${task.code}`, {
      assigneeName: admin.full_name,
      completion: 40,
    });

    const res = await api.patch(`/api/v1/work-items/${task.code}`, { notes: 'Ghi chú mới' });
    expect(res.status).toBe(200);
    const after = res.body.data.item;
    expect(after.level).toBe(3);
    expect(after.parent_id).toBe(sub.id);
    expect(after.assignee_id).toBe(admin.id);
    expect(after.completion).toBe(40);
    expect(after.reminders).toHaveLength(1);
    // Mã KHÔNG đổi khi sửa — mã là thứ người dùng đọc và trích dẫn (§13.4 mục 6).
    expect(after.code).toBe(task.code);
  });

  it('TC-TREE-22: gửi lại ĐÚNG tên người thực hiện ⇒ không tra lại, giữ nguyên id', async () => {
    // Giao diện lưu người thực hiện bằng cả id và tên, nên dòng có sẵn cả hai.
    await api.patch(`/api/v1/work-items/${task.code}`, {
      assigneeId: admin.id,
      assigneeName: admin.full_name,
    });
    // Đổi tên người trong bảng users: nếu API tra lại theo tên thì nó sẽ gỡ người này khỏi nhiệm vụ.
    await pool.query(`UPDATE users SET full_name = 'Tên đã đổi' WHERE id = $1`, [admin.id]);
    const res = await api.patch(`/api/v1/work-items/${task.code}`, {
      assigneeName: admin.full_name,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.item.assignee_id).toBe(admin.id);
  });

  it('TC-TREE-21: tên người thực hiện TRÙNG hai người ⇒ giữ tên, bỏ id, kèm cảnh báo', async () => {
    await makeLoginUser({ code: 'NV002', email: 'b1@congty.vn', full_name: 'Trùng Tên' });
    await makeLoginUser({ code: 'NV003', email: 'b2@congty.vn', full_name: 'Trùng Tên' });
    const res = await api.patch(`/api/v1/work-items/${task.code}`, { assigneeName: 'Trùng Tên' });
    expect(res.status).toBe(200);
    expect(res.body.data.item.assignee_id).toBeNull();
    expect(res.body.data.item.assignee_name).toBe('Trùng Tên');
    expect(res.body.data.warnings.map((w) => w.code)).toContain('ASSIGNEE_NAME_DUPLICATED');
  });

  // PLACEHOLDER-PATCH
});

describe('PATCH /api/v1/work-items/:id — chuyển sang công việc khác (§7 việc 3.4)', () => {
  let other;
  let sub;
  let task;

  beforeEach(async () => {
    other = await makeWork({ name: 'Công việc đích' });
    sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    task = (await create({ level: 3, name: 'Nhiệm vụ A1', parentRef: sub.code })).body.data.item;
  });

  it('TC-TREE-16: chuyển cấp 2 ĐANG CÓ con ⇒ 400 MOVE_PARENT_HAS_CHILDREN', async () => {
    const res = await api.patch(`/api/v1/work-items/${sub.code}`, { workRef: other.code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MOVE_PARENT_HAS_CHILDREN');
    // Cả cha lẫn con đều ở lại công việc cũ: giao dịch bị cuộn lại trọn vẹn.
    expect((await itemsRepo.findByCode(sub.code)).work_id).toBe(work.id);
    expect((await itemsRepo.findByCode(task.code)).parent_id).toBe(sub.id);
  });

  it('TC-TREE-17: chuyển cấp 2 KHÔNG có con ⇒ 200', async () => {
    const lonely = (await create({ level: 2, name: 'Công việc con rỗng' })).body.data.item;
    const res = await api.patch(`/api/v1/work-items/${lonely.code}`, { workRef: other.code });
    expect(res.status).toBe(200);
    expect(res.body.data.moved).toBe(true);
    expect(res.body.data.item.work_id).toBe(other.id);
    // Mã KHÔNG đổi khi chuyển — khác hẳn bản cũ (§13.4 mục 6).
    expect(res.body.data.item.code).toBe(lonely.code);
  });

  it('TC-TREE-18: chuyển cấp 3 ⇒ 200, bỏ cha và nói rõ parentCleared', async () => {
    const res = await api.patch(`/api/v1/work-items/${task.code}`, { workRef: other.code });
    expect(res.status).toBe(200);
    expect(res.body.data.item.work_id).toBe(other.id);
    expect(res.body.data.item.parent_id).toBeNull();
    expect(res.body.data.parentCleared).toBe(true);
  });

  it('TC-TREE-19: công việc đích KHÔNG tồn tại ⇒ 400 và nhiệm vụ CÒN NGUYÊN', async () => {
    const res = await api.patch(`/api/v1/work-items/${task.code}`, {
      workRef: 'CV999',
      name: 'Tên lẽ ra không được ghi',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TARGET_WORK_NOT_FOUND');
    const after = await itemsRepo.findByCode(task.code);
    expect(after.work_id).toBe(work.id);
    expect(after.parent_id).toBe(sub.id);
    expect(after.name).toBe('Nhiệm vụ A1');
  });

  it('TC-TREE-39: chuyển nhiệm vụ sang công việc KHÁC PHÒNG ⇒ phòng đi theo công việc đích', async () => {
    const dept2 = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });
    const farWork = await makeWork({ name: 'Công việc phòng khác', department_id: dept2.id });
    expect(task.department_id).toBe(dept.id);

    const res = await api.patch(`/api/v1/work-items/${task.code}`, { workRef: farWork.code });
    expect(res.status).toBe(200);
    // Trigger `work_items_sync_department` lo việc này, service không tự ghi phòng (§7 việc 3.11).
    expect(res.body.data.item.department_id).toBe(dept2.id);
  });

  it('gửi workRef ĐÚNG công việc đang chứa ⇒ không coi là chuyển, giữ nguyên cha', async () => {
    const res = await api.patch(`/api/v1/work-items/${task.code}`, { workRef: work.code });
    expect(res.status).toBe(200);
    expect(res.body.data.moved).toBe(false);
    expect(res.body.data.item.parent_id).toBe(sub.id);
  });

  // PLACEHOLDER-MOVE
});

describe('DELETE /api/v1/work-items/:id — xoá cả cây (§7 việc 3.5)', () => {
  it('TC-TREE-13: xoá cấp 2 có 4 con ⇒ xoá 5 dòng, KỂ TÊN đủ 4 mã con', async () => {
    const sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    const children = [];
    for (const n of [1, 2, 3, 4]) {
      children.push(
        (await create({ level: 3, name: `Nhiệm vụ ${n}`, parentRef: sub.code })).body.data.item.code
      );
    }

    const res = await api.del(`/api/v1/work-items/${sub.code}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedItem).toBe(sub.code);
    expect(res.body.data.deletedChildren.sort()).toEqual(children.sort());
    expect(res.body.data.deletedCount).toBe(5);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM work_items`);
    expect(rows[0].n).toBe(0);
  });

  it('TC-TREE-14: xoá cấp 3 ⇒ chỉ mất đúng nó, cha và anh em còn nguyên', async () => {
    const sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    const t1 = (await create({ level: 3, name: 'Nhiệm vụ 1', parentRef: sub.code })).body.data.item;
    const t2 = (await create({ level: 3, name: 'Nhiệm vụ 2', parentRef: sub.code })).body.data.item;

    const res = await api.del(`/api/v1/work-items/${t1.code}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedChildren).toEqual([]);
    expect(res.body.data.deletedCount).toBe(1);
    expect(await itemsRepo.findByCode(t1.code)).toBeNull();
    expect(await itemsRepo.findByCode(sub.code)).not.toBeNull();
    expect(await itemsRepo.findByCode(t2.code)).not.toBeNull();
  });

  it('TC-TREE-15: xoá cấp 2 ⇒ nhắc việc của các CON cũng bị xoá (CASCADE)', async () => {
    const sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    const task = (await create({ level: 3, name: 'Nhiệm vụ 1', parentRef: sub.code })).body.data
      .item;
    await pool.query(
      `INSERT INTO reminders (work_item_id, remind_date, content) VALUES ($1, $2, $3)`,
      [task.id, '2026-09-10', 'Nhắc trước một hôm']
    );

    await api.del(`/api/v1/work-items/${sub.code}`);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM reminders`);
    expect(rows[0].n).toBe(0);
  });

  it('xoá dòng không tồn tại ⇒ 404', async () => {
    const res = await api.del('/api/v1/work-items/CV001-999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/work-items/:id/copy — nhân bản cả cây con (§7 việc 3.1)', () => {
  it('TC-TREE-26: nhân bản cấp 2 có 3 con ⇒ 4 dòng mới, con trỏ vào BẢN SAO của cha', async () => {
    const sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    for (const n of [1, 2, 3]) {
      await create({ level: 3, name: `Nhiệm vụ ${n}`, parentRef: sub.code });
    }

    const res = await api.post(`/api/v1/work-items/${sub.code}/copy`, { name: 'Bản sao A' });
    expect(res.status).toBe(200);
    expect(res.body.data.copiedCount).toBe(4);
    const copy = res.body.data.item;
    expect(copy.id).not.toBe(sub.id);
    expect(copy.code).not.toBe(sub.code);
    expect(copy.name).toBe('Bản sao A');

    // Lỗi có thật của `copyProject` bản cũ: bản sao của con vẫn trỏ `Mã cha` sang cây GỐC.
    const { rows } = await pool.query(
      `SELECT code, parent_id FROM work_items WHERE parent_id = $1 ORDER BY code`,
      [copy.id]
    );
    expect(rows).toHaveLength(3);
    const { rows: oldChildren } = await pool.query(
      `SELECT count(*)::int AS n FROM work_items WHERE parent_id = $1`,
      [sub.id]
    );
    expect(oldChildren[0].n).toBe(3); // cây gốc không bị chạm
    const { rows: all } = await pool.query(`SELECT count(*)::int AS n FROM work_items`);
    expect(all[0].n).toBe(8);
  });

  it('nhân bản cấp 3 ⇒ 1 dòng mới, không kéo theo ai', async () => {
    const task = (await create({ level: 3, name: 'Nhiệm vụ lẻ' })).body.data.item;
    const res = await api.post(`/api/v1/work-items/${task.code}/copy`);
    expect(res.status).toBe(200);
    expect(res.body.data.copiedCount).toBe(1);
    expect(res.body.data.copiedChildren).toEqual([]);
    // Không truyền tên ⇒ giữ tên cũ, đúng như bản cũ nhân bản "y hệt".
    expect(res.body.data.item.name).toBe('Nhiệm vụ lẻ');
  });
});

describe('POST /api/v1/works/:id/reorder — kéo–thả đổi thứ tự (§7 việc 3.7)', () => {
  let codes;

  /** Thứ tự đang lưu, đọc thẳng từ CSDL theo đúng cách danh sách được hiện lên. */
  const currentOrder = async () => {
    const { rows } = await pool.query(
      `SELECT code, sort_order FROM work_items WHERE work_id = $1 ORDER BY sort_order, code`,
      [work.id]
    );
    return rows;
  };

  beforeEach(async () => {
    codes = [];
    for (const n of [1, 2, 3, 4]) {
      codes.push((await create({ level: 2, name: `Việc con ${n}` })).body.data.item.code);
    }
  });

  it('TC-TREE-29: gửi thứ tự mới ⇒ sort_order đánh lại từ 1, đúng thứ tự đã gửi', async () => {
    const wanted = [codes[3], codes[1], codes[0], codes[2]];
    const res = await api.post(`/api/v1/works/${work.code}/reorder`, { order: wanted });
    expect(res.status).toBe(200);
    expect(res.body.data.ordered).toEqual(wanted);
    expect(res.body.data.skipped).toEqual([]);
    expect(await currentOrder()).toEqual([
      { code: wanted[0], sort_order: 1 },
      { code: wanted[1], sort_order: 2 },
      { code: wanted[2], sort_order: 3 },
      { code: wanted[3], sort_order: 4 },
    ]);
  });

  it('TC-TREE-30: mã lạ trong danh sách ⇒ bỏ qua, các mã còn lại vẫn đúng thứ tự', async () => {
    const res = await api.post(`/api/v1/works/${work.code}/reorder`, {
      order: [codes[2], 'CV001-999', codes[0]],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.skipped).toEqual(['CV001-999']);
    // Hai dòng không được nhắc tên vẫn giữ thứ tự cũ của chúng và xuống cuối, hệt `reorderTasks`.
    expect((await currentOrder()).map((r) => r.code)).toEqual([
      codes[2],
      codes[0],
      codes[1],
      codes[3],
    ]);
  });

  it('nhận cả id số lẫn mã, và mã nhắc hai lần chỉ tính một lần', async () => {
    const first = await itemsRepo.findByCode(codes[1]);
    const res = await api.post(`/api/v1/works/${work.id}/reorder`, {
      order: [first.id, codes[1], codes[0]],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.ordered.slice(0, 2)).toEqual([codes[1], codes[0]]);
    expect(res.body.data.ordered).toHaveLength(4);
  });

  it('công việc không tồn tại ⇒ 404', async () => {
    const res = await api.post('/api/v1/works/CV999/reorder', { order: codes });
    expect(res.status).toBe(404);
  });
});

describe('Đồng thời và cuộn lại (§8.4 mục C)', () => {
  it('TC-TREE-31: 20 request tạo nhiệm vụ ĐỒNG THỜI ⇒ 20 mã khác nhau, không lỗi', async () => {
    // Đây là lý do đổi cách sinh mã: bản cũ lấy millisecond nên hai người bấm cùng lúc ra cùng mã
    // (§13.5). `nextval` không bị giao dịch nào ảnh hưởng, nên 20 request ra 20 số khác nhau.
    //
    // Lấy token CSRF MỘT lần rồi dùng cho cả 20 request — đúng như trình duyệt làm, và tránh 20
    // request lấy token chen ngang làm nhiễu phép đo đồng thời.
    const csrf = await api.csrfToken();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        api.post(
          '/api/v1/work-items',
          { workRef: work.code, level: 3, name: `Nhiệm vụ ${n + 1}` },
          { csrf }
        )
      )
    );

    expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));
    const codes = results.map((r) => r.body.data.item.code);
    expect(new Set(codes).size).toBe(20);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n, count(DISTINCT code)::int AS d FROM work_items`
    );
    expect(rows[0]).toEqual({ n: 20, d: 20 });
  });

  it('TC-TREE-35: lỗi GIỮA giao dịch nhân bản ⇒ cuộn lại sạch, không dòng nửa vời', async () => {
    const sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    for (const name of ['Nhiệm vụ 1', 'Nhiệm vụ nổ', 'Nhiệm vụ 3']) {
      await create({ level: 3, name, parentRef: sub.code });
    }

    // Bẫy đặt SAU khi dữ liệu gốc đã có: nó chỉ nổ khi `copy` chèn bản sao của "Nhiệm vụ nổ",
    // tức là giữa giao dịch — bản sao của cha đã ghi xong trước đó.
    await pool.query(`
      CREATE FUNCTION test_no_bom() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.name = 'Nhiệm vụ nổ' THEN
          RAISE EXCEPTION 'bẫy test: nổ giữa giao dịch';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_test_no_bom BEFORE INSERT ON work_items
        FOR EACH ROW EXECUTE FUNCTION test_no_bom();
    `);
    try {
      const res = await api.post(`/api/v1/work-items/${sub.code}/copy`);
      expect(res.status).toBeGreaterThanOrEqual(400);
      // Không còn dòng nào của lần nhân bản dở: vẫn đúng 4 dòng gốc.
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM work_items`);
      expect(rows[0].n).toBe(4);
    } finally {
      await pool.query(`
        DROP TRIGGER trg_test_no_bom ON work_items;
        DROP FUNCTION test_no_bom();
      `);
    }
  });
});

describe('Kiểm dữ liệu vào và phòng cả ba cấp (§7 việc 3.10, 3.11)', () => {
  it('TC-TREE-32: tiến độ ngoài 0–100 hoặc không phải số ⇒ 400, không ghi giá trị lạ', async () => {
    for (const completion of [-5, 150, 'abc']) {
      const res = await create({ name: 'Tiến độ lạ', completion });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.field).toBe('completion');
    }
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM work_items`);
    expect(rows[0].n).toBe(0);
  });

  it('tiến độ 0 và 100 là hợp lệ (biên)', async () => {
    for (const completion of [0, 100]) {
      const res = await create({ name: `Tiến độ ${completion}`, completion });
      expect(res.status).toBe(200);
      expect(res.body.data.item.completion).toBe(completion);
    }
  });

  it('TC-TREE-33: hạn chót TRƯỚC ngày bắt đầu ⇒ cảnh báo, vẫn lưu', async () => {
    const res = await create({
      name: 'Hạn ngược',
      startDate: '2026-09-20',
      dueDate: '2026-09-10',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.warnings.map((w) => w.code)).toContain('DUE_BEFORE_START');
    expect(await itemsRepo.findByCode(res.body.data.item.code)).not.toBeNull();
  });

  // Phòng đã được canh kỹ ở `work-items-department.test.js` (TC-TREE-36..39, gồm cả xoá phòng và
  // nhân bản). Ở đây chỉ kiểm ĐÚNG phần chạy qua HTTP: giao diện không gửi phòng bao giờ, và lần
  // Lưu công việc cấp 1 phải lan xuống cả cây.
  it('TC-TREE-37: không truyền phòng ⇒ nhận phòng công việc cha; cha chưa có phòng thì để trống', async () => {
    const withDept = (await create({ level: 2, name: 'Có phòng' })).body.data.item;
    expect(withDept.department_id).toBe(dept.id);

    const noDeptWork = await makeWork({ name: 'Công việc chưa gán phòng', department_id: null });
    const res = await api.post('/api/v1/work-items', {
      workRef: noDeptWork.code,
      name: 'Không phòng',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.item.department_id).toBeNull();
  });

  it('TC-TREE-38: PATCH đổi phòng công việc cấp 1 ⇒ cả cấp 2 và cấp 3 đổi theo', async () => {
    const sub = (await create({ level: 2, name: 'Công việc con A' })).body.data.item;
    const task = (await create({ level: 3, name: 'Nhiệm vụ A1', parentRef: sub.code })).body.data
      .item;
    const dept2 = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });

    const res = await api.patch(`/api/v1/works/${work.code}`, { departmentId: dept2.id });
    expect(res.status).toBe(200);
    const { rows } = await pool.query(
      `SELECT code, department_id FROM work_items WHERE code = ANY($1) ORDER BY code`,
      [[sub.code, task.code]]
    );
    expect(rows.map((r) => r.department_id)).toEqual([dept2.id, dept2.id]);
  });
});

// Phòng gắn cho CẢ BA CẤP của cây công việc — §4.1 và 002_work_items_department.sql.
//
// Bất biến duy nhất cần canh: phòng của Công việc con (cấp 2) và Nhiệm vụ (cấp 3) LUÔN bằng
// phòng của Công việc cấp 1 chứa nó. Vì bất biến đó do CSDL giữ, test ở đây gọi thẳng repo và
// SQL, không đi qua HTTP — đúng chỗ quy tắc đang sống.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool } from '../../src/db/pool.js';
import * as itemsRepo from '../../src/modules/workItems/repo.js';
import * as worksRepo from '../../src/modules/works/repo.js';
import { withPgErrors } from '../../src/utils/pgError.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';

let deptA;
let deptB;

beforeEach(async () => {
  await resetTables();
  deptA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1 });
  deptB = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });
});

afterAll(async () => {
  await closePool();
});

const dept = async (code) => (await itemsRepo.findByCode(code)).department_id;

describe('Thừa hưởng phòng từ công việc cha', () => {
  it('cấp 2 và cấp 3 không truyền phòng ⇒ lấy phòng của công việc', async () => {
    const work = await worksRepo.insert({ name: 'Việc A', department_id: deptA.id });
    const sub = await itemsRepo.insert({
      code: `${work.code}-001`,
      work_id: work.id,
      level: 2,
      name: 'Con A',
    });
    const task = await itemsRepo.insert({
      code: `${work.code}-002`,
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
      name: 'Nhiệm vụ A1',
    });
    expect(sub.department_id).toBe(deptA.id);
    expect(task.department_id).toBe(deptA.id);
  });

  it('công việc CHƯA gán phòng ⇒ dòng con cũng để trống, không nổ', async () => {
    const work = await worksRepo.insert({ name: 'Việc chưa có phòng' });
    const sub = await itemsRepo.insert({
      code: `${work.code}-001`,
      work_id: work.id,
      level: 2,
      name: 'Con',
    });
    expect(work.department_id).toBeNull();
    expect(sub.department_id).toBeNull();
  });

  it('truyền ĐÚNG phòng của công việc cha thì vẫn nhận', async () => {
    const work = await worksRepo.insert({ name: 'Việc A', department_id: deptA.id });
    const sub = await itemsRepo.insert({
      code: `${work.code}-001`,
      work_id: work.id,
      level: 2,
      name: 'Con',
      department_id: deptA.id,
    });
    expect(sub.department_id).toBe(deptA.id);
  });

  it('TC-TREE-36: truyền phòng KHÁC công việc cha ⇒ DEPT_MISMATCH_WORK, không tạo dòng', async () => {
    const work = await worksRepo.insert({ name: 'Việc A', department_id: deptA.id });
    await expect(
      withPgErrors(() =>
        itemsRepo.insert({
          code: `${work.code}-001`,
          work_id: work.id,
          level: 2,
          name: 'Con lệch phòng',
          department_id: deptB.id,
        })
      )
    ).rejects.toMatchObject({ code: 'DEPT_MISMATCH_WORK', status: 400 });
    expect(await itemsRepo.listByWork(work.id)).toHaveLength(0);
  });
});

describe('Đổi phòng thì cả cây đi theo', () => {
  let work;

  beforeEach(async () => {
    work = await worksRepo.insert({ name: 'Việc A', department_id: deptA.id });
    const sub = await itemsRepo.insert({
      code: `${work.code}-001`,
      work_id: work.id,
      level: 2,
      name: 'Con A',
    });
    await itemsRepo.insert({
      code: `${work.code}-002`,
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
      name: 'Nhiệm vụ A1',
    });
    await itemsRepo.insert({
      code: `${work.code}-003`,
      work_id: work.id,
      level: 3,
      name: 'Nhiệm vụ mồ côi',
    });
  });

  it('đổi phòng công việc cấp 1 ⇒ toàn bộ cấp 2 và cấp 3 đổi theo', async () => {
    await worksRepo.update(work.id, { department_id: deptB.id });
    const rows = await itemsRepo.listByWork(work.id);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.department_id).toBe(deptB.id);
  });

  it('sửa công việc mà KHÔNG đổi phòng thì không chạm tới dòng con', async () => {
    const before = await pool.query('SELECT id, updated_at FROM work_items ORDER BY id');
    await worksRepo.update(work.id, { name: 'Việc A (đổi tên)' });
    const after = await pool.query('SELECT id, updated_at FROM work_items ORDER BY id');
    expect(after.rows.map((r) => r.updated_at)).toEqual(before.rows.map((r) => r.updated_at));
  });

  it('gỡ phòng của công việc ⇒ dòng con về trống theo', async () => {
    await worksRepo.update(work.id, { department_id: null });
    const rows = await itemsRepo.listByWork(work.id);
    for (const row of rows) expect(row.department_id).toBeNull();
  });

  it('xoá phòng ⇒ cả công việc và mọi dòng con về trống (ON DELETE SET NULL)', async () => {
    await pool.query('DELETE FROM departments WHERE id = $1', [deptA.id]);
    expect((await worksRepo.findById(work.id)).department_id).toBeNull();
    const rows = await itemsRepo.listByWork(work.id);
    for (const row of rows) expect(row.department_id).toBeNull();
  });
});

describe('Chuyển sang công việc khác phòng (§7 việc 3.4)', () => {
  it('nhiệm vụ chuyển sang công việc phòng khác ⇒ phòng đi theo công việc đích', async () => {
    const from = await worksRepo.insert({ name: 'Việc A', department_id: deptA.id });
    const to = await worksRepo.insert({ name: 'Việc B', department_id: deptB.id });
    const task = await itemsRepo.insert({
      code: `${from.code}-001`,
      work_id: from.id,
      level: 3,
      name: 'Nhiệm vụ đi xa',
    });
    expect(task.department_id).toBe(deptA.id);

    const moved = await withPgErrors(() =>
      itemsRepo.updateStructure(task.id, { work_id: to.id, parent_id: null })
    );
    expect(moved.work_id).toBe(to.id);
    expect(moved.department_id).toBe(deptB.id);
    expect(moved.code).toBe(task.code); // mã KHÔNG đổi (§13.4 mục 6)
  });

  it('nhân bản công việc ⇒ bản sao và cả cây con cùng phòng với bản gốc', async () => {
    const work = await worksRepo.insert({ name: 'Việc A', department_id: deptA.id });
    await itemsRepo.insert({
      code: `${work.code}-001`,
      work_id: work.id,
      level: 2,
      name: 'Con A',
    });
    const copyCode = await worksRepo.nextWorkCode();
    const copy = await worksRepo.copyRow(work.id, { code: copyCode, name: 'Việc A (bản sao)' });
    const copiedSub = await itemsRepo.copyRow((await itemsRepo.findByCode(`${work.code}-001`)).id, {
      code: `${copy.code}-001`,
      workId: copy.id,
      parentId: null,
    });
    expect(copy.department_id).toBe(deptA.id);
    expect(copiedSub.department_id).toBe(deptA.id);
  });
});

describe('Cột phòng đọc được ở mọi đường truy vấn', () => {
  it('findByRefWithWork trả phòng của dòng và phòng của công việc, hai giá trị khớp nhau', async () => {
    const work = await worksRepo.insert({ name: 'Việc A', department_id: deptA.id });
    await itemsRepo.insert({
      code: `${work.code}-001`,
      work_id: work.id,
      level: 2,
      name: 'Con A',
    });
    const row = await itemsRepo.findByRefWithWork(`${work.code}-001`);
    expect(row.department_id).toBe(deptA.id);
    expect(row.work_department_id).toBe(deptA.id);
    expect(await dept(`${work.code}-001`)).toBe(deptA.id);
  });
});

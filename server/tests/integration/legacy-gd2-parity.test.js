// Đối chiếu 40 phép kiểm của `tools/test-tasks-gd2.js` (bản Apps Script + sheet giả) sang API mới
// chạy trên Postgres thật (§7 Phase 3, "Xong khi" gạch đầu dòng 1).
//
// Giữ NGUYÊN thứ tự và cách chia mục [1]..[4] của file cũ để đọc song song hai bên là thấy ngay
// phép kiểm nào đi đâu. Mỗi `it` ở đây ghi rõ số phép kiểm cũ nó thay.
//
// MỘT phép kiểm bị ĐẢO có chủ ý — mục [2] phép 25 "đích có mã mới": bản cũ sinh mã mới khi chuyển
// nhiệm vụ sang công việc khác, bản này giữ nguyên mã (§13.4 mục 6). Lý do ở ngay chỗ đó.
//
// Ba mục cũ không còn tương đương nguyên văn vì lược đồ đã đổi (không còn ô `Nhiệm vụ JSON`, không
// còn cột email người thực hiện): phần [3] chuyển thành "dữ liệu bẩn một dòng không làm mất cả danh
// sách" và "hai đường đọc cho cùng một kết quả", phần email chuyển thành `assignee_id`.
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
let work1;
let work2;

const makeWork = (over) =>
  worksRepo.insert({
    department_id: dept.id,
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    ...over,
  });

/** Tạo một dòng cấp 2/cấp 3 qua API; mặc định thuộc `work1`. */
const add = async (body, workRef = work1.code) => {
  const res = await api.post('/api/v1/work-items', { workRef, ...body });
  expect(res.status).toBe(200);
  return res.body.data.item;
};

const patch = (ref, body) => api.patch(`/api/v1/work-items/${ref}`, body);

/** Mã các dòng của một công việc, xếp theo mã — thay cho việc đọc lại ô JSON của bản cũ. */
async function codesIn(workId) {
  const { rows } = await pool.query(
    'SELECT code FROM work_items WHERE work_id = $1 ORDER BY code',
    [workId]
  );
  return rows.map((r) => r.code);
}

const rowByCode = async (code) => {
  const { rows } = await pool.query('SELECT * FROM work_items WHERE code = $1', [code]);
  return rows[0] ?? null;
};

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  api = client(app);
  await api.login(admin.email);
  work1 = await makeWork({ name: 'Công việc 1' });
  work2 = await makeWork({ name: 'Công việc 2' });
});

afterAll(async () => {
  await closePool();
});
describe('[1] deleteTask xoá đệ quy — 9 phép kiểm cũ', () => {
  let sub;
  let t1;
  let t2;
  let t3;

  beforeEach(async () => {
    sub = await add({ level: 2, name: 'Khảo sát' });
    t1 = await add({ level: 3, name: 'Soạn phiếu', parentRef: sub.code });
    t2 = await add({ level: 3, name: 'Phát phiếu', parentRef: sub.code });
    t3 = await add({ level: 3, name: 'Việc lẻ' });
  });

  it('phép 1–5: xoá cấp 2 kéo theo đúng hai con, còn lại đúng việc lẻ', async () => {
    const res = await api.del(`/api/v1/work-items/${sub.code}`);
    expect(res.status).toBe(200); // phép 1 (cũ: success === true)
    expect(res.body.data.deletedChildren.sort()).toEqual([t1.code, t2.code].sort()); // phép 2
    expect(res.body.data.deletedCount).toBe(3); // phép 3
    // Phép 4 cũ đọc `r.level` để biết vừa xoá cấp nào. API mới trả `deletedItem` là MÃ — người gọi
    // đã biết cấp của dòng mình bấm xoá, còn mã thì cần để hiện "đã xoá CV001-001".
    expect(res.body.data.deletedItem).toBe(sub.code);
    expect(sub.level).toBe(2);
    expect(await codesIn(work1.id)).toEqual([t3.code]); // phép 5
  });

  it('phép 6–7: xoá cấp 3 không kéo theo ai, cha còn nguyên', async () => {
    const res = await api.del(`/api/v1/work-items/${t1.code}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedChildren).toEqual([]); // phép 6
    expect(res.body.data.deletedCount).toBe(1);
    expect(await rowByCode(sub.code)).not.toBeNull(); // phép 7
    expect((await codesIn(work1.id)).sort()).toEqual([sub.code, t2.code, t3.code].sort());
  });

  it('phép 8: mã không tồn tại ⇒ 404 (cũ: success === false)', async () => {
    const res = await api.del('/api/v1/work-items/CV001-999');
    expect(res.status).toBe(404);
    expect(await codesIn(work1.id)).toHaveLength(4);
  });

  it('phép 9: dữ liệu trỏ VÒNG không treo, xoá cả hai dòng trong vòng', async () => {
    const a = await add({ level: 3, name: 'Vòng A' });
    const b = await add({ level: 3, name: 'Vòng B' });
    await pool.query('ALTER TABLE work_items DISABLE TRIGGER trg_work_items_check_parent');
    await pool.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [a.id, b.id]);
    await pool.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [b.id, a.id]);
    await pool.query('ALTER TABLE work_items ENABLE TRIGGER trg_work_items_check_parent');

    const started = Date.now();
    const res = await api.del(`/api/v1/work-items/${a.code}`);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(2);
    expect(await rowByCode(b.code)).toBeNull();
  });
});
describe('[2] updateTask — 20 phép kiểm cũ', () => {
  let an;
  let binh;
  let s1;
  let s2;
  let t1;

  beforeEach(async () => {
    an = await makeLoginUser({ code: 'NV002', full_name: 'An', email: 'an@congty.vn' });
    binh = await makeLoginUser({ code: 'NV003', full_name: 'Bình', email: 'binh@congty.vn' });
    // Hai người TRÙNG họ tên: bản cũ tra email theo tên nên trùng tên là tra ra rỗng.
    await makeLoginUser({ code: 'NV004', full_name: 'Trùng', email: 'trung1@congty.vn' });
    await makeLoginUser({ code: 'NV005', full_name: 'Trùng', email: 'trung2@congty.vn' });

    s1 = await add({ level: 2, name: 'Khảo sát', assigneeId: an.id, assigneeName: an.full_name });
    s2 = await add({ level: 2, name: 'Rà soát' });
    t1 = await add({
      level: 3,
      name: 'Soạn phiếu',
      parentRef: s1.code,
      assigneeId: an.id,
      assigneeName: an.full_name,
    });
  });

  it('phép 10–13: đổi cha sang cấp 2 khác, giữ cấp, tên không đổi thì giữ người thực hiện', async () => {
    const res = await patch(t1.code, {
      name: 'Soạn phiếu v2',
      parentRef: s2.code,
      assigneeName: an.full_name,
    });
    expect(res.status).toBe(200); // phép 10
    expect(res.body.data.item.parent_id).toBe(s2.id);

    const row = await rowByCode(t1.code);
    expect(row.parent_id).toBe(s2.id); // phép 11
    expect(row.level).toBe(3); // phép 12
    // Phép 13 cũ: "tên không đổi ⇒ giữ email cũ". Nay không có cột email, thứ phải giữ là
    // `assignee_id` — tra lại theo tên sẽ gỡ mất người đã đổi họ tên trong bảng users.
    expect(row.assignee_id).toBe(an.id);
  });

  it('phép 14: đổi họ tên ⇒ tra lại và gắn đúng người mới', async () => {
    const res = await patch(t1.code, { assigneeName: binh.full_name });
    expect(res.status).toBe(200);
    expect((await rowByCode(t1.code)).assignee_id).toBe(binh.id);
  });

  it('phép 15: tên TRÙNG nhiều người ⇒ để trống người thực hiện, không giữ người cũ', async () => {
    const res = await patch(t1.code, { assigneeName: 'Trùng' });
    expect(res.status).toBe(200);
    const row = await rowByCode(t1.code);
    expect(row.assignee_id).toBeNull();
    expect(row.assignee_name).toBe('Trùng');
    // Khác bản cũ ở chỗ có nói cho người dùng biết vì sao, thay vì im lặng xoá.
    expect(res.body.data.warnings.map((w) => w.code)).toContain('ASSIGNEE_NAME_DUPLICATED');
  });
  it('phép 16–19 + 21: bốn nhánh chặn, và dữ liệu nguồn không hề sứt', async () => {
    const blocked = [
      [t1.code, { level: 2 }, 'LEVEL_IMMUTABLE'], // phép 16
      [t1.code, { parentRef: t1.code }, 'SELF_PARENT'], // phép 17
      [t1.code, { parentRef: 'CV001-999' }, 'PARENT_NOT_FOUND'], // phép 18
      [s2.code, { parentRef: s1.code }, 'LVL2_NO_PARENT'], // phép 19
    ];
    for (const [ref, body, code] of blocked) {
      const res = await patch(ref, body);
      expect(res.status, `${ref} ${JSON.stringify(body)}`).toBe(400);
      expect(res.body.error.code).toBe(code);
    }

    // Phép 21: bốn lần bị chặn không được để lại dấu vết nào.
    const t1Row = await rowByCode(t1.code);
    expect(t1Row.level).toBe(3);
    expect(t1Row.parent_id).toBe(s1.id);
    expect((await rowByCode(s2.code)).parent_id).toBeNull();
    expect((await codesIn(work1.id)).sort()).toEqual([s1.code, s2.code, t1.code].sort());
  });

  it('phép 20: chuyển công việc con ĐANG CÓ nhiệm vụ sang công việc khác ⇒ chặn (TC-TREE-16)', async () => {
    const res = await patch(s1.code, { workRef: work2.code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MOVE_PARENT_HAS_CHILDREN');
    // Không được nửa vời: cấp 2 còn ở công việc cũ và nhiệm vụ con vẫn treo đúng cha.
    expect((await rowByCode(s1.code)).work_id).toBe(work1.id);
    expect((await rowByCode(t1.code)).parent_id).toBe(s1.id);
    expect(await codesIn(work2.id)).toEqual([]);
  });

  it('phép 22–25: chuyển công việc con KHÔNG có con thì được, và mã KHÔNG đổi', async () => {
    const res = await patch(s2.code, { workRef: work2.code });
    expect(res.status).toBe(200);
    expect(res.body.data.moved).toBe(true); // phép 22
    expect((await codesIn(work1.id)).sort()).toEqual([s1.code, t1.code].sort()); // phép 23

    const moved = await rowByCode(s2.code);
    expect(moved.work_id).toBe(work2.id); // phép 24
    expect(moved.level).toBe(2);
    expect(await codesIn(work2.id)).toEqual([s2.code]);
    // Phép 25 ĐẢO có chủ ý: bản cũ sinh MÃ MỚI theo công việc đích, nên mọi liên kết/nhắc/nhật ký
    // trỏ tới mã cũ thành trỏ vào hư không. Nay mã là danh tính, chuyển việc không đổi danh tính
    // (§13.4 mục 6) — mã vẫn mang tiền tố CV001 dù dòng đã sang CV002, và đó là đúng.
    expect(moved.code).toBe(s2.code);
    expect(moved.code.startsWith(`${work1.code}-`)).toBe(true);
  });

  it('phép 26–27: chuyển NHIỆM VỤ cấp 3 sang công việc khác ⇒ báo đã gỡ cha, cha rỗng thật', async () => {
    const res = await patch(t1.code, { workRef: work2.code });
    expect(res.status).toBe(200);
    expect(res.body.data.moved).toBe(true);
    expect(res.body.data.parentCleared).toBe(true); // phép 26

    const row = await rowByCode(t1.code);
    expect(row.work_id).toBe(work2.id);
    expect(row.parent_id).toBeNull(); // phép 27 — cha cũ thuộc công việc cũ nên không giữ được
    expect(row.level).toBe(3);
    expect((await rowByCode(s1.code)).work_id).toBe(work1.id);
  });

  it('phép 28: công việc đích không tồn tại ⇒ 400 và KHÔNG mất nhiệm vụ (TC-TREE-19)', async () => {
    const res = await patch(t1.code, { workRef: 'CV999' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TARGET_WORK_NOT_FOUND');
    const row = await rowByCode(t1.code);
    expect(row).not.toBeNull();
    expect(row.work_id).toBe(work1.id);
    expect(row.parent_id).toBe(s1.id);
    expect((await codesIn(work1.id)).sort()).toEqual([s1.code, s2.code, t1.code].sort());
  });

  it('phép 29: sửa tại chỗ KHÔNG làm mất nhắc việc của nhiệm vụ', async () => {
    const added = await api.post(`/api/v1/work-items/${t1.code}/reminders`, {
      remindDate: '2026-09-10',
      content: 'Nhắc gọi điện',
    });
    expect(added.status).toBe(200);

    const res = await patch(t1.code, { name: 'Soạn phiếu bản 2', completion: 40 });
    expect(res.status).toBe(200);
    expect(res.body.data.item.reminders.map((r) => r.remind_date)).toEqual(['2026-09-10']);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM reminders');
    expect(rows[0].n).toBe(1);
  });
});
describe('[3] getTasks / extractTasksFromProjectValues — 8 phép kiểm cũ', () => {
  // Bản cũ đọc một ô `Nhiệm vụ JSON` rồi tự vá dữ liệu bẩn khi ĐỌC. Nay mỗi dòng là một hàng có
  // ràng buộc, nên phần lớn các phép kiểm này chuyển từ "đọc rồi vá" sang "ghi thì không lọt".
  it('phép 31–33: không gửi cấp ⇒ cấp 3 dạng SỐ, cha rỗng là null, dòng nào cũng mang mã công việc', async () => {
    const item = await add({ name: 'Việc lẻ' });
    expect(item.level).toBe(3); // phép 31 — Number 3, không phải chuỗi '3'
    expect(typeof item.level).toBe('number');
    expect(item.parent_id).toBeNull(); // phép 32 — cũ là '' , nay là null
    expect(item.work_id).toBe(work1.id); // phép 33 (cũ: khoá `Mã dự án`)

    const res = await api.get(`/api/v1/work-items?workRef=${work1.code}`);
    expect(res.status).toBe(200);
    for (const row of res.body.data.items) {
      expect(typeof row.level).toBe('number');
      expect(row.work_id).toBe(work1.id);
    }
  });

  it("phép 34: cấp gửi dạng chuỗi '2' ⇒ lưu thành SỐ 2", async () => {
    const item = await add({ level: '2', name: 'Khảo sát' });
    expect(item.level).toBe(2);
    expect((await rowByCode(item.code)).level).toBe(2);
  });

  it('phép 35: cấp 2 kèm cha — cũ âm thầm xoá cha khi đọc, nay CHẶN ngay lúc ghi', async () => {
    const sub = await add({ level: 2, name: 'Khảo sát' });
    const res = await api.post('/api/v1/work-items', {
      workRef: work1.code,
      level: 2,
      name: 'Rà soát',
      parentRef: sub.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LVL2_NO_PARENT');
    // Cùng một bảo đảm ("không có cấp 2 nào có cha"), nhưng do CSDL giữ nên không lách được bằng
    // đường ghi khác — kể cả INSERT trực tiếp cũng bị CHECK chặn.
    await expect(
      pool.query(
        `INSERT INTO work_items (work_id, code, level, parent_id, name)
         VALUES ($1, 'CV001-900', 2, $2, 'Ghi lậu')`,
        [work1.id, sub.id]
      )
    ).rejects.toThrow();
    expect(await codesIn(work1.id)).toEqual([sub.code]);
  });

  it('phép 36: mã cha có khoảng trắng hai đầu vẫn tra ra đúng dòng', async () => {
    const sub = await add({ level: 2, name: 'Khảo sát' });
    const item = await add({ level: 3, name: 'Soạn phiếu', parentRef: `  ${sub.code}  ` });
    expect(item.parent_id).toBe(sub.id);
  });

  it('phép 30: một dòng dữ liệu BẨN không làm mất cả danh sách', async () => {
    const sub = await add({ level: 2, name: 'Khảo sát' });
    const good = await add({ level: 3, name: 'Soạn phiếu', parentRef: sub.code });
    const lone = await add({ level: 3, name: 'Việc lẻ' });
    // Dòng bẩn kiểu chỉ dữ liệu cũ mới có: nhiệm vụ cấp 3 trỏ cha là một nhiệm vụ cấp 3 khác.
    await pool.query('ALTER TABLE work_items DISABLE TRIGGER trg_work_items_check_parent');
    await pool.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [good.id, lone.id]);
    await pool.query('ALTER TABLE work_items ENABLE TRIGGER trg_work_items_check_parent');

    const list = await api.get(`/api/v1/work-items?workRef=${work1.code}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items.map((r) => r.code).sort()).toEqual(
      [sub.code, good.code, lone.code].sort()
    );

    // Và ở cây thì dòng bẩn rơi vào nhóm `(chưa gán công việc con)` chứ không biến mất.
    const tree = await api.get('/api/v1/works/tree');
    expect(tree.status).toBe(200);
    const node = tree.body.data.works.find((w) => w.code === work1.code);
    const unassigned = node.subWorks.find((s) => s.virtual);
    expect(unassigned.tasks.map((t) => t.code)).toEqual([lone.code]);
    expect(node.subWorks.find((s) => s.code === sub.code).tasks.map((t) => t.code)).toEqual([
      good.code,
    ]);
  });

  it('phép 37: hai đường đọc cho cùng một tập dòng (cũ: extract… trùng getTasks)', async () => {
    const sub = await add({ level: 2, name: 'Khảo sát' });
    await add({ level: 3, name: 'Soạn phiếu', parentRef: sub.code });
    await add({ level: 3, name: 'Việc lẻ' });

    const list = await api.get(`/api/v1/work-items?workRef=${work1.code}`);
    const tree = await api.get('/api/v1/works/tree');
    const node = tree.body.data.works.find((w) => w.code === work1.code);
    const fromTree = node.subWorks.flatMap((s) => [
      ...(s.virtual ? [] : [s.code]),
      ...s.tasks.map((t) => t.code),
    ]);
    expect(fromTree.sort()).toEqual(list.body.data.items.map((r) => r.code).sort());
  });
});
describe('[4] addTask — 3 phép kiểm cũ', () => {
  it('phép 38–39: không gửi cấp ⇒ ghi cấp 3; gửi cấp 2 ⇒ ghi cấp 2', async () => {
    const task = await add({ name: 'Việc lẻ' });
    const sub = await add({ level: 2, name: 'Khảo sát' });
    expect((await rowByCode(task.code)).level).toBe(3); // phép 38
    expect((await rowByCode(sub.code)).level).toBe(2); // phép 39
  });

  it('phép 40: chọn một NHIỆM VỤ cấp 3 làm cha ⇒ chặn, không tạo dòng nào', async () => {
    const task = await add({ name: 'Việc lẻ' });
    const res = await api.post('/api/v1/work-items', {
      workRef: work1.code,
      level: 3,
      name: 'Con của nhiệm vụ',
      parentRef: task.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PARENT_NOT_SUBWORK');
    expect(await codesIn(work1.id)).toEqual([task.code]);
  });
});

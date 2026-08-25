// Tầng repo của `work_items`: kiểm đúng những chỗ SQL dễ sai — sinh mã bằng sequence, đệ quy
// con cháu (kể cả khi dữ liệu đã trỏ vòng), CASCADE khi xoá, và nhân bản một dòng.
//
// Chạy trên Postgres THẬT (cổng 5434) chứ không mock: mọi ràng buộc quan trọng của Phase 3 nằm
// trong CHECK và trigger, mock sẽ báo xanh cho những thứ CSDL từ chối.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool } from '../../src/db/pool.js';
import * as itemsRepo from '../../src/modules/workItems/repo.js';
import * as worksRepo from '../../src/modules/works/repo.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';

let work;

beforeEach(async () => {
  await resetTables();
  await makeDepartment();
  work = await worksRepo.insert({ name: 'Công việc thử' });
});

afterAll(async () => {
  await closePool();
});

describe('works/repo — công việc cấp 1', () => {
  it('sinh mã CV001, CV002... bằng sequence, không đọc mã lớn nhất', async () => {
    const second = await worksRepo.insert({ name: 'Việc hai' });
    expect(work.code).toBe('CV001');
    expect(second.code).toBe('CV002');
  });

  it('findByRef nhận cả id số và mã', async () => {
    expect((await worksRepo.findByRef(work.id)).id).toBe(work.id);
    expect((await worksRepo.findByRef('CV001')).id).toBe(work.id);
    expect(await worksRepo.findByRef('CV999')).toBeNull();
  });

  it('ngày trả về là chuỗi YYYY-MM-DD, không phải Date lệch múi giờ', async () => {
    const w = await worksRepo.insert({
      name: 'Có ngày',
      start_date: '2026-09-07',
      end_date: '2026-09-26',
    });
    expect(w.start_date).toBe('2026-09-07');
    expect(w.end_date).toBe('2026-09-26');
  });

  it('list lọc theo tháng bằng GIAO NHAU: việc 3 tháng hiện ở cả 3 tháng', async () => {
    await worksRepo.insert({ name: 'Dài', start_date: '2026-07-01', end_date: '2026-09-30' });
    await worksRepo.insert({ name: 'Chưa có ngày' });
    const august = await worksRepo.list({ month: '2026-08' });
    const names = august.map((r) => r.name);
    expect(names).toContain('Dài'); // tháng 8 nằm giữa khoảng
    expect(names).toContain('Chưa có ngày'); // thiếu ngày thì vẫn hiện, không ẩn mất việc
    const june = await worksRepo.list({ month: '2026-06' });
    expect(june.map((r) => r.name)).not.toContain('Dài');
  });
});

describe('workItems/repo — mã và thứ tự', () => {
  it('mã dòng mới là <mã công việc>-NNN, số lấy từ sequence toàn hệ thống', async () => {
    const a = await itemsRepo.nextItemCode(work.code);
    const b = await itemsRepo.nextItemCode(work.code);
    expect(a).toBe('CV001-001');
    expect(b).toBe('CV001-002');
    // Sequence là TOÀN HỆ THỐNG: công việc khác vẫn lấy số tiếp theo, không quay về 001 (§13.4/6)
    const other = await worksRepo.insert({ name: 'Việc khác' });
    expect(await itemsRepo.nextItemCode(other.code)).toBe('CV002-003');
  });

  it('maxSortOrder trả 0 khi công việc chưa có dòng nào', async () => {
    expect(await itemsRepo.maxSortOrder(work.id)).toBe(0);
  });
});

describe('workItems/repo — result_links là cột jsonb', () => {
  // Bẫy tìm ra ở Phase 4: `pg` biến mảng JS thành chuỗi mảng Postgres `{"a","b"}`, jsonb từ chối
  // với 22P02 nên NGƯỜI DÙNG nhận "Giá trị không đúng định dạng" mà không biết trường nào sai.
  // Cả Phase 3 không lộ ra vì không test nào gửi `result_links` thật.
  const links = ['[Bản nháp] https://a.vn/x?a=1,2', 'https://b.vn/y'];

  async function makeItem(over = {}) {
    return itemsRepo.insert({
      code: await itemsRepo.nextItemCode(work.code),
      work_id: work.id,
      level: 3,
      name: 'Nhiệm vụ có link',
      ...over,
    });
  }

  it('insert nhận MẢNG chuỗi và đọc lại vẫn là mảng', async () => {
    const item = await makeItem({ result_links: links });
    expect(item.result_links).toEqual(links);
    expect(Array.isArray((await itemsRepo.findById(item.id)).result_links)).toBe(true);
  });

  it('insert không gửi link thì cột giữ mặc định mảng rỗng', async () => {
    expect((await makeItem()).result_links).toEqual([]);
  });

  it('update thay cả danh sách; mảng rỗng là XOÁ hết link, không phải bỏ qua', async () => {
    const item = await makeItem({ result_links: links });
    expect(
      (await itemsRepo.update(item.id, { result_links: ['https://c.vn'] })).result_links
    ).toEqual(['https://c.vn']);
    expect((await itemsRepo.update(item.id, { result_links: [] })).result_links).toEqual([]);
  });

  it('copyRow mang theo nguyên danh sách link của dòng gốc', async () => {
    const item = await makeItem({ result_links: links });
    const copy = await itemsRepo.copyRow(item.id, {
      code: await itemsRepo.nextItemCode(work.code),
      workId: work.id,
    });
    expect(copy.result_links).toEqual(links);
  });
});

describe('workItems/repo — cây và CASCADE', () => {
  async function seedTree() {
    const sub = await itemsRepo.insert({
      code: 'CV001-001',
      work_id: work.id,
      level: 2,
      name: 'Việc con 1',
      sort_order: 1,
    });
    const t1 = await itemsRepo.insert({
      code: 'CV001-002',
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
      name: 'Nhiệm vụ 1',
      sort_order: 2,
    });
    const t2 = await itemsRepo.insert({
      code: 'CV001-003',
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
      name: 'Nhiệm vụ 2',
      sort_order: 3,
    });
    const orphan = await itemsRepo.insert({
      code: 'CV001-004',
      work_id: work.id,
      level: 3,
      name: 'Nhiệm vụ mồ côi',
      sort_order: 4,
    });
    return { sub, t1, t2, orphan };
  }

  it('nhiệm vụ cấp 3 không có cha vẫn tạo được (lvl2_no_parent chỉ ràng cấp 2)', async () => {
    const { orphan } = await seedTree();
    expect(orphan.parent_id).toBeNull();
    expect(orphan.level).toBe(3);
  });

  it('listDescendants trả đúng con cháu, không lấy dòng ngoài cây', async () => {
    const { sub, t1, t2 } = await seedTree();
    const kids = await itemsRepo.listDescendants(sub.id);
    expect(kids.map((r) => r.id)).toEqual([t1.id, t2.id]);
    expect(await itemsRepo.countChildren(sub.id)).toBe(2);
    expect(await itemsRepo.listDescendants(t1.id)).toEqual([]);
  });

  it('isDescendant nhận ra con cháu và người ngoài', async () => {
    const { sub, t1, orphan } = await seedTree();
    expect(await itemsRepo.isDescendant(sub.id, t1.id)).toBe(true);
    expect(await itemsRepo.isDescendant(sub.id, orphan.id)).toBe(false);
  });

  it('TC-TREE-11: dữ liệu đã trỏ vòng sẵn thì không treo, trả kết quả dưới 1 giây', async () => {
    const a = await itemsRepo.insert({ code: 'CV001-101', work_id: work.id, level: 3, name: 'A' });
    const b = await itemsRepo.insert({ code: 'CV001-102', work_id: work.id, level: 3, name: 'B' });
    // Trigger không cho tạo vòng; tắt tạm để dựng đúng dữ liệu bẩn mà bản cũ để lại.
    await pool.query('ALTER TABLE work_items DISABLE TRIGGER trg_work_items_check_parent');
    await pool.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [a.id, b.id]);
    await pool.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [b.id, a.id]);
    await pool.query('ALTER TABLE work_items ENABLE TRIGGER trg_work_items_check_parent');

    const started = Date.now();
    const rows = await itemsRepo.listDescendants(a.id);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(rows.length).toBeGreaterThan(0); // thấy B, rồi dừng vì phát hiện vòng
    expect(rows.length).toBeLessThan(10);
  });

  it('xoá cấp 2 thì con cháu và nhắc việc đi theo bằng CASCADE', async () => {
    const { sub, t1, orphan } = await seedTree();
    await pool.query('INSERT INTO reminders (work_item_id, remind_date) VALUES ($1, $2)', [
      t1.id,
      '2026-09-11',
    ]);
    expect(await itemsRepo.remove(sub.id)).toBe(1);
    const left = await itemsRepo.listByWork(work.id);
    expect(left.map((r) => r.code)).toEqual([orphan.code]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM reminders');
    expect(rows[0].n).toBe(0);
  });

  it('xoá công việc cấp 1 thì mọi dòng bên dưới cũng mất', async () => {
    await seedTree();
    await worksRepo.remove(work.id);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM work_items');
    expect(rows[0].n).toBe(0);
  });
});

describe('workItems/repo — nhân bản một dòng', () => {
  it('copyRow giữ nội dung, reset tiến độ/trạng thái/ngày báo cáo', async () => {
    const source = await itemsRepo.insert({
      code: 'CV001-001',
      work_id: work.id,
      level: 2,
      name: 'Gốc',
      description: 'Mô tả',
      status: 'Hoàn thành',
      completion: 100,
      report_date: '2026-09-20',
      start_date: '2026-09-07',
      priority: 'Cao',
      sort_order: 5,
    });
    const copy = await itemsRepo.copyRow(source.id, {
      code: 'CV001-002',
      workId: work.id,
      parentId: null,
      name: 'Bản sao',
      sortOrder: 6,
    });
    expect(copy.code).toBe('CV001-002');
    expect(copy.name).toBe('Bản sao');
    expect(copy.description).toBe('Mô tả');
    expect(copy.priority).toBe('Cao');
    expect(copy.start_date).toBe('2026-09-07');
    expect(copy.status).toBe('Chưa bắt đầu');
    expect(copy.completion).toBe(0);
    expect(copy.report_date).toBeNull();
    expect(copy.sort_order).toBe(6);
  });

  it('copyRow không truyền tên thì giữ tên gốc', async () => {
    const source = await itemsRepo.insert({
      code: 'CV001-001',
      work_id: work.id,
      level: 2,
      name: 'Gốc',
    });
    const copy = await itemsRepo.copyRow(source.id, {
      code: 'CV001-002',
      workId: work.id,
      parentId: null,
    });
    expect(copy.name).toBe('Gốc');
  });
});

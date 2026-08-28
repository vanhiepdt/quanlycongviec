// `attachRefs` — gắn nhãn "dòng nhật ký này thuộc đầu việc nào" (TC-NKREF-01..06).
//
// Hàm thuần nên test bằng dữ liệu bày sẵn, không cần CSDL. Điều đáng kiểm nhất: id 5 của `works`
// và id 5 của `work_items` KHÔNG được lẫn vào nhau, và dòng của đầu việc đã xoá vẫn có nhãn.
import { describe, expect, it } from 'vitest';
import { attachRefs } from '../../src/utils/historyRefs.js';

const dong = (over = {}) => ({
  id: 1,
  action: 'works.update',
  entity_type: 'work',
  entity_id: 5,
  work_id: 5,
  details: {},
  ...over,
});

const WORK = { id: 5, code: 'CV001', name: 'Công việc gốc' };
const ITEMS = [
  { id: 5, level: 2, code: 'CV001-001', name: 'Công việc con A' },
  { id: 9, level: 3, code: 'CV001-002', name: 'Nhiệm vụ B' },
];

describe('TC-NKREF-01..06 — attachRefs', () => {
  it('TC-NKREF-01: dòng cấp 1 lấy mã và tên của công việc', () => {
    const [e] = attachRefs([dong()], { work: WORK, items: ITEMS });
    expect(e.ref).toEqual({
      kind: 'work',
      level: 1,
      code: 'CV001',
      name: 'Công việc gốc',
      deleted: false,
    });
  });

  it('TC-NKREF-02: cùng id 5 nhưng entity_type khác thì ra hai đầu việc khác nhau', () => {
    const entries = [
      dong({ id: 1, entity_type: 'work', entity_id: 5 }),
      dong({ id: 2, entity_type: 'subwork', entity_id: 5, action: 'subworks.update' }),
    ];
    const [cap1, cap2] = attachRefs(entries, { work: WORK, items: ITEMS });
    expect(cap1.ref.code).toBe('CV001');
    expect(cap1.ref.level).toBe(1);
    expect(cap2.ref.code).toBe('CV001-001');
    expect(cap2.ref.level).toBe(2);
  });

  it('TC-NKREF-03: nhiệm vụ cấp 3 lấy đúng cấp từ dòng dữ liệu', () => {
    const [e] = attachRefs([dong({ entity_type: 'task', entity_id: 9 })], { items: ITEMS });
    expect(e.ref).toEqual({
      kind: 'task',
      level: 3,
      code: 'CV001-002',
      name: 'Nhiệm vụ B',
      deleted: false,
    });
  });

  it('TC-NKREF-04: đầu việc đã xoá — rơi về details.code/name và deleted = true', () => {
    const entries = [
      dong({
        entity_type: 'task',
        entity_id: 777,
        action: 'workItems.remove',
        details: { code: 'CV001-050', name: 'Nhiệm vụ đã xoá' },
      }),
    ];
    const [e] = attachRefs(entries, { work: WORK, items: ITEMS });
    expect(e.ref).toEqual({
      kind: 'task',
      level: 3,
      code: 'CV001-050',
      name: 'Nhiệm vụ đã xoá',
      deleted: true,
    });
  });

  it('TC-NKREF-05: không có entity_id (dòng nhật ký cũ) vẫn ra nhãn rỗng chứ không nổ', () => {
    const [e] = attachRefs([dong({ entity_id: null, details: null })], { work: WORK });
    expect(e.ref.deleted).toBe(true);
    expect(e.ref.code).toBe('');
    expect(e.ref.name).toBe('');
  });

  it('TC-NKREF-06: không sửa mảng gốc, giữ nguyên các khoá cũ của dòng', () => {
    const goc = [dong()];
    const ra = attachRefs(goc, { work: WORK });
    expect(goc[0].ref).toBeUndefined();
    expect(ra[0].action).toBe('works.update');
    expect(ra[0].work_id).toBe(5);
    expect(attachRefs(null, {})).toEqual([]);
  });
});

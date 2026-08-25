// Việc 5.12: `#task-form` gửi hai ô ẩn `level` + `parent` (không phải <select>).
// `taskFromLegacy` phải đưa chúng sang `level` / `parentRef` của REST; thiếu thì KHÔNG
// tự bịa cấp 2 — REST mặc định cấp 3, đúng «+ Thêm nhiệm vụ» cũ (TC-TREE-07 / điểm C8).
import { describe, expect, it } from 'vitest';
import { taskFromLegacy } from '../../src/rpc/legacyFields.js';

describe('taskFromLegacy — cấp suy ra từ chỗ bấm (5.12)', () => {
  it('thiếu level / parent ⇒ không gửi hai khoá đó (REST mặc định cấp 3, không cha)', () => {
    const body = taskFromLegacy({ projectId: 'CV001', name: 'Nhiệm vụ' });
    expect(body).toEqual({ workRef: 'CV001', name: 'Nhiệm vụ' });
    expect(Object.hasOwn(body, 'level')).toBe(false);
    expect(Object.hasOwn(body, 'parentRef')).toBe(false);
  });

  it('ô ẩn level="2" (nút trên hàng công việc) ⇒ level 2, parent rỗng thành null', () => {
    const body = taskFromLegacy({
      projectId: 'CV001',
      name: 'Công việc con',
      level: '2',
      parent: '',
    });
    expect(body.level).toBe(2);
    expect(body.parentRef).toBeNull();
    expect(body.workRef).toBe('CV001');
  });

  it('ô ẩn level="3" + parent mã (nút trên hàng công việc con) ⇒ cấp 3 có cha', () => {
    const body = taskFromLegacy({
      projectId: 'CV001',
      name: 'Nhiệm vụ trong con',
      level: '3',
      parent: 'CV001-007',
    });
    expect(body.level).toBe(3);
    expect(body.parentRef).toBe('CV001-007');
  });

  it('khoá parentRef (REST) cũng được nhận, không chỉ khoá form `parent`', () => {
    const body = taskFromLegacy({ projectId: 'CV001', name: 'X', parentRef: 'CV001-007' });
    expect(body.parentRef).toBe('CV001-007');
  });

  it('cấp lạ (1, 4, chữ) bị bỏ — không lách CHECK của CSDL bằng form giả', () => {
    expect(taskFromLegacy({ name: 'A', level: '1' }).level).toBeUndefined();
    expect(taskFromLegacy({ name: 'A', level: '4' }).level).toBeUndefined();
    expect(taskFromLegacy({ name: 'A', level: 'cấp hai' }).level).toBeUndefined();
  });
});

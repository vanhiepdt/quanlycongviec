// TC-RBAC-01 — ma trận phân quyền §6: 6 vai × 6 thực thể × 4 hành động = 144 phép kiểm.
//
// 144 phép kiểm này KHÔNG được viết tay. Chúng sinh ra từ `PERMISSIONS` — đúng bảng khai báo mà
// `can()` đang dùng. Nghĩa là:
//   - Sửa bảng ⇒ test đổi theo, không phải sửa hai nơi (bệnh "khai hai nơi" của bản cũ, §13.5).
//   - `can()` đi chệch bảng ⇒ đỏ ngay, kể cả chệch đúng một ô.
// Cái mà test này canh là **`can()` phải trung thành với bảng**; còn bảng có đúng §6 hay không
// thì canh bằng nhóm test "bảng khai báo khớp §6" ở dưới, viết tay từng dòng của §6.
//
// TỪ 014 (2026-09-01): thực thể thứ 6 là `file` — kết quả file của nhiệm vụ, 2 hàng mới trong
// Bảng phân quyền động (file:create / file:approve). Ma trận file có luật riêng: read mọi vai,
// create cho admin/PGD/TP/PP/Cán bộ, approve chỉ admin/PGD/TP/PP.
import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ACTION_APPROVE,
  can,
  ENTITIES,
  PERMISSIONS,
  ROLES,
} from '../../src/middleware/rbac.js';
import { principal, rowInScope } from '../helpers/rbac.js';

describe('TC-RBAC-01: ma trận 6 vai × 6 thực thể × 4 hành động', () => {
  it('đúng 144 phép kiểm — nếu số này đổi thì §6 hoặc §7 Phase 1 hoặc 014 đã đổi, sửa kế hoạch trước', () => {
    expect(ROLES.length).toBe(6);
    expect(ENTITIES.length).toBe(6);
    expect(ACTIONS.length).toBe(4);
    expect(ROLES.length * ENTITIES.length * ACTIONS.length).toBe(144);
  });

  // 120 `it()` sinh tự động. Tên test ghi rõ vai · thực thể · hành động để khi đỏ là biết ngay ô nào.
  for (const role of ROLES) {
    for (const entityType of ENTITIES) {
      for (const action of ACTIONS) {
        const allowed = PERMISSIONS[role][entityType].includes(action);
        const label = allowed ? 'ĐƯỢC' : 'KHÔNG được';
        it(`${role} · ${entityType} · ${action} → ${label}`, () => {
          const user = principal(role);
          const verdict = can(user, action, entityType, rowInScope(role, entityType, user));
          expect(verdict.ok).toBe(allowed);
          if (!allowed) {
            expect(verdict.code).toBe('FORBIDDEN');
            // Thông báo phải là tiếng Việt hiện được thẳng cho người dùng (§5.3).
            expect(verdict.message.length).toBeGreaterThan(10);
          }
        });
      }
    }
  }
});

describe('hành động thứ 5 — duyệt (§6 cột "Duyệt")', () => {
  // Cùng một bảng khai báo, thêm 30 phép kiểm cho `approve`. Chỉ admin và Phó Giám đốc duyệt được.
  for (const role of ROLES) {
    for (const entityType of ENTITIES) {
      const allowed = PERMISSIONS[role][entityType].includes(ACTION_APPROVE);
      it(`${role} · ${entityType} · duyệt → ${allowed ? 'ĐƯỢC' : 'KHÔNG được'}`, () => {
        const user = principal(role);
        const row = rowInScope(role, entityType, user);
        expect(can(user, ACTION_APPROVE, entityType, row).ok).toBe(allowed);
      });
    }
  }
});

// Ma trận ở trên chỉ chứng minh `can()` trung thành với bảng. Nhóm này canh chiều còn lại:
// **bảng có đúng §6 hay không**, viết tay từng dòng của §6 để nếu ai sửa bảng cho test xanh thì
// vẫn đỏ ở đây.
describe('bảng khai báo khớp §6', () => {
  it('chỉ admin và Phó Giám đốc được duyệt', () => {
    const approvers = ROLES.filter((r) => PERMISSIONS[r].work.includes(ACTION_APPROVE));
    expect(approvers).toEqual(['admin', 'Phó Giám đốc']);
  });

  it('chỉ admin được cấu hình phòng và quản lý người dùng', () => {
    for (const role of ROLES) {
      const expected = role === 'admin';
      expect(PERMISSIONS[role].department.includes('create')).toBe(expected);
      expect(PERMISSIONS[role].user.includes('create')).toBe(expected);
      // Nhưng ai cũng đọc được danh sách phòng và người — cần để chọn người thực hiện.
      expect(PERMISSIONS[role].department.includes('read')).toBe(true);
      expect(PERMISSIONS[role].user.includes('read')).toBe(true);
    }
  });

  it('TC-RBAC-06: Phó phòng có quyền GIỐNG HỆT Trưởng phòng (quyết định số 5)', () => {
    expect(PERMISSIONS['Phó phòng']).toEqual(PERMISSIONS['Trưởng phòng']);
  });

  it('014 — ma trận file: read mọi vai · nộp admin/PGD/TP/PP/Cán bộ · duyệt KHÔNG có Cán bộ', () => {
    expect(PERMISSIONS['admin'].file).toEqual(['read', 'create', 'approve']);
    expect(PERMISSIONS['Phó Giám đốc'].file).toEqual(['read', 'create', 'approve']);
    expect(PERMISSIONS['Trưởng phòng'].file).toEqual(['read', 'create', 'approve']);
    expect(PERMISSIONS['Phó phòng'].file).toEqual(['read', 'create', 'approve']);
    expect(PERMISSIONS['Quản lý công việc'].file).toEqual(['read']);
    expect(PERMISSIONS['Nhân viên'].file).toEqual(['read', 'create']);
  });

  it('§6: Nhân viên không tạo công việc và không tạo công việc con, nhưng tạo được nhiệm vụ', () => {
    expect(PERMISSIONS['Nhân viên'].work).toEqual(['read']);
    expect(PERMISSIONS['Nhân viên'].subwork).toEqual(['read']);
    expect(PERMISSIONS['Nhân viên'].task).toContain('create');
  });

  it('§6: cả 6 vai đều tạo được nhiệm vụ (cột "Tạo Nhiệm vụ" = Có ở mọi dòng)', () => {
    for (const role of ROLES) expect(PERMISSIONS[role].task).toContain('create');
  });

  it('§6: Trưởng phòng / Phó phòng / Quản lý công việc tạo được công việc nhưng không duyệt', () => {
    for (const role of ['Trưởng phòng', 'Phó phòng', 'Quản lý công việc']) {
      expect(PERMISSIONS[role].work).toContain('create');
      expect(PERMISSIONS[role].work).not.toContain(ACTION_APPROVE);
    }
  });
});

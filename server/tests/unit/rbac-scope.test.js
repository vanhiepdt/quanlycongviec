// TC-RBAC-02..10 — phạm vi. Ma trận (rbac-matrix) đo "vai này có được làm việc này"; file này đo
// "dòng cụ thể này có thuộc về người đó". Hai lớp tách nhau nên mỗi lớp test được riêng.
import { describe, expect, it } from 'vitest';
import { can } from '../../src/middleware/rbac.js';
import { OTHER_DEPT, OWN_DEPT, principal } from '../helpers/rbac.js';

const workOfMyDept = { id: 1, department_id: OWN_DEPT };
const workOfOtherDept = { id: 2, department_id: OTHER_DEPT };

describe('TC-RBAC-02/03/04: Nhân viên', () => {
  const nv = principal('Nhân viên');

  it('TC-RBAC-02: sửa công việc của phòng mình → bị chặn', () => {
    const verdict = can(nv, 'update', 'work', workOfMyDept);
    expect(verdict.ok).toBe(false);
    expect(verdict.code).toBe('FORBIDDEN');
  });

  it('TC-RBAC-03: sửa nhiệm vụ CỦA MÌNH → được', () => {
    const myTask = { id: 5, level: 3, department_id: OWN_DEPT, assignee_id: nv.id };
    expect(can(nv, 'update', 'task', myTask).ok).toBe(true);
  });

  it('TC-RBAC-03b: sửa nhiệm vụ của người khác cùng phòng → bị chặn', () => {
    const otherTask = { id: 6, level: 3, department_id: OWN_DEPT, assignee_id: 999 };
    expect(can(nv, 'update', 'task', otherTask).ok).toBe(false);
  });

  it('TC-RBAC-04: đọc dữ liệu phòng khác → bị chặn', () => {
    expect(can(nv, 'read', 'work', workOfOtherDept).ok).toBe(false);
    expect(can(nv, 'read', 'work', workOfMyDept).ok).toBe(true);
  });

  it('TC-RBAC-04b: đọc được nhiệm vụ giao cho mình dù nằm ở phòng khác', () => {
    const task = { id: 7, level: 3, department_id: OTHER_DEPT, assignee_id: nv.id };
    expect(can(nv, 'read', 'task', task).ok).toBe(true);
  });

  it('tạo nhiệm vụ trong công việc chưa được giao việc → bị chặn (§6)', () => {
    const stranger = { id: 8, level: 3, department_id: OWN_DEPT, assigned_in_work: false };
    expect(can(nv, 'create', 'task', stranger).ok).toBe(false);
    expect(can(nv, 'create', 'task', { ...stranger, assigned_in_work: true }).ok).toBe(true);
  });
});

describe('TC-RBAC-05: Phó Giám đốc chỉ trong phòng mình phụ trách', () => {
  // A phụ trách PH01+PH02, B phụ trách PH03+PH04 (§13.7) — dựng lại đúng tình huống đó.
  const pgdA = principal('Phó Giám đốc', { id: 200, managedDepartmentIds: [OWN_DEPT, 11] });
  const pgdB = principal('Phó Giám đốc', { id: 201, managedDepartmentIds: [30, 31] });

  it('duyệt công việc của phòng mình phụ trách → được', () => {
    expect(can(pgdA, 'approve', 'work', workOfMyDept).ok).toBe(true);
  });

  it('TC-RBAC-05: duyệt công việc của phòng do người khác phụ trách → bị chặn', () => {
    expect(can(pgdA, 'approve', 'work', { id: 3, department_id: 30 }).ok).toBe(false);
    expect(can(pgdB, 'approve', 'work', { id: 3, department_id: 30 }).ok).toBe(true);
  });

  it('không phụ trách phòng nào thì không duyệt được gì', () => {
    const trong = principal('Phó Giám đốc', { managedDepartmentIds: [] });
    expect(can(trong, 'approve', 'work', workOfMyDept).ok).toBe(false);
  });

  it('công việc chưa gán phòng (department_id NULL) → không lọt vào phạm vi của ai', () => {
    expect(can(pgdA, 'update', 'work', { id: 4, department_id: null }).ok).toBe(false);
  });
});

describe('TC-RBAC-07/08: so khớp vai trò CHÍNH XÁC (bẫy `includes` của bản cũ)', () => {
  it('TC-RBAC-07: "Trợ lý admin" KHÔNG được coi là admin', () => {
    const fake = principal('Trợ lý admin');
    expect(can(fake, 'create', 'department', null).ok).toBe(false);
    expect(can(fake, 'approve', 'work', workOfMyDept).ok).toBe(false);
    // Không có quyền gì cả, kể cả đọc — vai trò không hợp lệ thì không đoán bừa.
    expect(can(fake, 'read', 'work', workOfMyDept).ok).toBe(false);
  });

  it('TC-RBAC-08: "Phó Giám đốc" đúng vai vẫn chạy, "Giám đốc" thì không', () => {
    expect(can(principal('Phó Giám đốc'), 'approve', 'work', workOfMyDept).ok).toBe(true);
    expect(can(principal('Giám đốc'), 'approve', 'work', workOfMyDept).ok).toBe(false);
  });

  it('viết hoa/thường khác đi là vai trò khác — "Admin" của dữ liệu cũ không phải "admin"', () => {
    // §13.8: cột Phân quyền thật có giá trị `Admin` chữ A hoa. Phase 2 phải chuẩn hoá trước
    // khi nhập, chứ rbac KHÔNG đoán hộ.
    expect(can(principal('Admin'), 'create', 'department', null).ok).toBe(false);
    expect(can(principal('admin'), 'create', 'department', null).ok).toBe(true);
  });
});

describe('TC-RBAC-09: người không thuộc phòng nào', () => {
  // TEST010 của §13.7 tồn tại đúng để canh chỗ này: phải trả lời được, không được vỡ.
  const troi = principal('Nhân viên', { id: 300, department_id: null });

  it('chỉ thấy nhiệm vụ của mình', () => {
    const myTask = { id: 9, level: 3, department_id: OWN_DEPT, assignee_id: troi.id };
    expect(can(troi, 'read', 'task', myTask).ok).toBe(true);
    expect(can(troi, 'read', 'work', workOfMyDept).ok).toBe(false);
  });

  it('không khớp bừa với dòng cũng chưa có phòng (NULL không bằng NULL)', () => {
    expect(can(troi, 'read', 'work', { id: 10, department_id: null }).ok).toBe(false);
  });

  it('không ném lỗi — trả về phán quyết bình thường', () => {
    expect(() => can(troi, 'update', 'work', workOfOtherDept)).not.toThrow();
    expect(can(troi, 'update', 'work', workOfOtherDept).code).toBe('FORBIDDEN');
  });
});

describe('TC-RBAC-10: gọi bằng id của thực thể ngoài phạm vi (IDOR)', () => {
  it('mọi vai bị chặn khi dòng nằm ngoài phạm vi, dù có quyền chung', () => {
    const cases = [
      ['Phó Giám đốc', { id: 11, department_id: 99 }],
      ['Trưởng phòng', { id: 12, department_id: OTHER_DEPT }],
      ['Phó phòng', { id: 13, department_id: OTHER_DEPT }],
      ['Quản lý công việc', { id: 14, department_id: OTHER_DEPT, manager_id: 777 }],
      ['Nhân viên', { id: 15, department_id: OTHER_DEPT, assignee_id: 777 }],
    ];
    for (const [role, row] of cases) {
      const user = principal(role);
      // Quyền chung có (row = null) …
      expect(can(user, 'update', 'work', null).ok).toBe(role !== 'Nhân viên');
      // … nhưng đúng dòng đó thì không.
      expect(can(user, 'update', 'work', row).ok).toBe(false);
    }
  });

  it('admin không bị giới hạn phạm vi', () => {
    expect(can(principal('admin'), 'update', 'work', { id: 16, department_id: 99 }).ok).toBe(true);
  });
});

describe('Quản lý công việc — phạm vi theo công việc mình quản lý', () => {
  const qlcv = principal('Quản lý công việc', { id: 400 });

  it('sửa được công việc mình quản lý', () => {
    expect(can(qlcv, 'update', 'work', { id: 20, manager_id: qlcv.id }).ok).toBe(true);
  });

  it('không sửa được công việc người khác quản lý, kể cả cùng phòng', () => {
    const row = { id: 21, department_id: OWN_DEPT, manager_id: 999 };
    expect(can(qlcv, 'update', 'work', row).ok).toBe(false);
    // Vẫn ĐỌC được vì cùng phòng.
    expect(can(qlcv, 'read', 'work', row).ok).toBe(true);
  });

  it('sửa được nhiệm vụ của chính mình dù không quản lý công việc đó', () => {
    const row = { id: 22, level: 3, department_id: OTHER_DEPT, assignee_id: qlcv.id };
    expect(can(qlcv, 'update', 'task', row).ok).toBe(true);
  });

  it('nhận diện được cột work_manager_id khi kiểm nhiệm vụ trong công việc mình quản lý', () => {
    const row = { id: 23, level: 3, work_department_id: OTHER_DEPT, work_manager_id: qlcv.id };
    expect(can(qlcv, 'update', 'task', row).ok).toBe(true);
  });
});

describe('can() — các cửa vào sai', () => {
  it('không có người dùng → UNAUTHENTICATED, không phải FORBIDDEN', () => {
    // Phân biệt hai mã này là điều frontend cần: 401 thì hiện lại hộp đăng nhập (TC-AUTH-15),
    // 403 thì hiện thông báo thiếu quyền.
    expect(can(null, 'read', 'work', null)).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
  });

  it('tài khoản bị vô hiệu hoá → ACCOUNT_DISABLED dù vai trò là admin', () => {
    const off = principal('admin', { is_active: false });
    expect(can(off, 'read', 'work', null)).toMatchObject({ ok: false, code: 'ACCOUNT_DISABLED' });
  });

  it('loại thực thể hoặc hành động lạ → chặn, không ném lỗi', () => {
    const ad = principal('admin');
    expect(can(ad, 'read', 'proposal', null).ok).toBe(false);
    expect(can(ad, 'xoá_sạch', 'work', null).ok).toBe(false);
  });

  it('row không phải object thì coi như không có row (hỏi quyền chung)', () => {
    expect(can(principal('admin'), 'update', 'work', 'DA001').ok).toBe(true);
    expect(can(principal('Nhân viên'), 'update', 'work', 'DA001').ok).toBe(false);
  });
});

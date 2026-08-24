// Dữ liệu mẫu cho test phân quyền. Dùng chung cho ma trận 120 phép kiểm (rbac-matrix) và các
// test phạm vi TC-RBAC-02..10 (rbac-scope), để hai bên nói về cùng một người và cùng một dòng.
export const OWN_DEPT = 10;
export const OTHER_DEPT = 20;

/** Người đăng nhập mẫu cho từng vai. Chỉ chứa các khoá mà `can()` thực sự đọc. */
export function principal(role, over = {}) {
  return {
    id: 100,
    full_name: `Người vai ${role}`,
    role,
    is_active: true,
    department_id: role === 'admin' ? null : OWN_DEPT,
    managedDepartmentIds: role === 'Phó Giám đốc' ? [OWN_DEPT, 11] : [],
    ...over,
  };
}

/**
 * Dòng NẰM TRONG phạm vi của vai đó — mỗi vai có nghĩa "trong phạm vi" khác nhau: Phó GĐ theo
 * phòng phụ trách, Trưởng/Phó phòng theo phòng mình, Quản lý công việc theo công việc mình quản
 * lý, Nhân viên theo nhiệm vụ của mình. Ma trận đo **quyền**, nên phải trung hoà phạm vi; việc
 * ra khỏi phạm vi là các test TC-RBAC-02..10 riêng.
 */
export function rowInScope(role, entityType, user) {
  if (entityType === 'user' || entityType === 'department') return { id: 7 };
  const base = { id: 7, department_id: OWN_DEPT, level: entityType === 'task' ? 3 : 2 };
  if (role === 'admin') return { ...base, department_id: OTHER_DEPT };
  if (role === 'Quản lý công việc') return { ...base, manager_id: user.id };
  if (role === 'Nhân viên') return { ...base, assignee_id: user.id, assigned_in_work: true };
  return base;
}

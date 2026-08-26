// @vitest-environment jsdom
//
// Việc 5.12 nửa giao diện: nút «+ công việc con» chỉ hiện với vai được tạo cấp 2 (§6),
// `#task-form` sinh hai ô ẩn chứ không phải <select name="level">, và hàng cấp 2 mới
// có nút tạo cấp 3 kèm data-parent-id.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, canUserCreateSubwork, canUserCreateTask, createSubworkFromWorkButtonHtml,
  createTaskFromSubworkButtonHtml, createTaskModal,
  __dat: (ten, giaTri) => { ({
    allTasks: () => { allTasks = giaTri; },
    allProjects: () => { allProjects = giaTri; },
    allStaff: () => { allStaff = giaTri; },
    currentUser: () => { currentUser = giaTri; },
    pendingTaskCreate: () => { pendingTaskCreate = giaTri; },
    isDeputyDirectorUser: () => { isDeputyDirectorUser = giaTri; },
    isDepartmentHeadUser: () => { isDepartmentHeadUser = giaTri; },
  })[ten](); }
});`;

beforeEach(() => {
  new Function(APP_SRC + EXPORTS)();
  window.__dat('allProjects', []);
  window.__dat('allTasks', []);
  window.__dat('allStaff', []);
  window.__dat('isDeputyDirectorUser', false);
  window.__dat('isDepartmentHeadUser', false);
  window.__dat('pendingTaskCreate', null);
});

describe('canUserCreateSubwork — khớp §6 (Nhân viên không tạo cấp 2)', () => {
  it('admin / Quản lý / Trưởng phòng / Phó phòng / Phó Giám đốc được', () => {
    window.__dat('currentUser', { name: 'A', role: 'admin' });
    expect(window.canUserCreateSubwork()).toBe(true);
    window.__dat('currentUser', { name: 'B', role: 'Quản lý công việc' });
    expect(window.canUserCreateSubwork()).toBe(true);
    window.__dat('currentUser', { name: 'C', role: 'Trưởng phòng' });
    expect(window.canUserCreateSubwork()).toBe(true);
    window.__dat('currentUser', { name: 'D', role: 'Phó phòng' });
    expect(window.canUserCreateSubwork()).toBe(true);
    window.__dat('currentUser', { name: 'E', role: 'Phó Giám đốc' });
    expect(window.canUserCreateSubwork()).toBe(true);
  });

  it('Nhân viên không được, kể cả khi đang có nhiệm vụ được giao (canUserCreateTask = true)', () => {
    window.__dat('currentUser', { name: 'NV', role: 'Nhân viên' });
    window.__dat('allTasks', [{ [window.COL.T_ASSIGNEE]: 'NV' }]);
    expect(window.canUserCreateTask()).toBe(true);
    expect(window.canUserCreateSubwork()).toBe(false);
    expect(window.createSubworkFromWorkButtonHtml('CV001', 'Việc', 'x')).toBe('');
  });
});

describe('ô ẩn #task-form — cấp suy ra từ pendingTaskCreate', () => {
  beforeEach(() => {
    window.__dat('currentUser', { name: 'Admin', role: 'admin' });
  });

  it('mặc định (nút + Thêm / standalone) ⇒ level=3, parent rỗng, không có <select name="level">', () => {
    const html = window.createTaskModal(false, null);
    expect(html).toContain('id="task-create-level"');
    expect(html).toContain('id="task-create-parent"');
    expect(html).toContain('name="level"');
    expect(html).toContain('value="3"');
    expect(html).toContain('Tạo nhiệm vụ mới');
    expect(html).not.toMatch(/<select\b[^>]*\bname="level"/);
  });

  it('pendingTaskCreate.level=2 ⇒ tiêu đề «Tạo công việc con» và ô ẩn level=2', () => {
    window.__dat('pendingTaskCreate', { level: 2, parentId: '' });
    const html = window.createTaskModal(false, null);
    expect(html).toContain('Tạo công việc con');
    expect(html).toMatch(/id="task-create-level"[^>]*value="2"/);
    expect(html).toMatch(/id="task-create-parent"[^>]*value=""/);
  });

  it('pendingTaskCreate.parentId ⇒ ô ẩn parent mang mã hàng cấp 2 vừa bấm', () => {
    window.__dat('pendingTaskCreate', { level: 3, parentId: 'CV001-007' });
    const html = window.createTaskModal(false, null);
    expect(html).toMatch(/id="task-create-parent"[^>]*value="CV001-007"/);
    expect(html).toMatch(/id="task-create-level"[^>]*value="3"/);
  });
});

describe('nút trên hàng công việc con', () => {
  it('cấp 2 ⇒ có class add-task-from-subwork-btn và data-parent-id = mã hàng', () => {
    window.__dat('currentUser', { name: 'Admin', role: 'admin' });
    window.__dat('allProjects', [{ [window.COL.P_ID]: 'CV001', [window.COL.P_NAME]: 'Việc gốc' }]);
    const html = window.createTaskFromSubworkButtonHtml(
      {
        [window.COL.T_ID]: 'CV001-007',
        [window.COL.T_PID]: 'CV001',
        [window.COL.T_LEVEL]: 2,
      },
      'action-btn'
    );
    expect(html).toContain('add-task-from-subwork-btn');
    expect(html).toContain('data-parent-id="CV001-007"');
    expect(html).toContain('data-project-id="CV001"');
  });

  it('cấp 3 (hoặc thiếu cấp) ⇒ không vẽ nút — tránh gắn nhiệm vụ vào nhiệm vụ', () => {
    window.__dat('currentUser', { name: 'Admin', role: 'admin' });
    expect(
      window.createTaskFromSubworkButtonHtml({
        [window.COL.T_ID]: 'CV001-008',
        [window.COL.T_PID]: 'CV001',
        [window.COL.T_LEVEL]: 3,
      })
    ).toBe('');
    expect(
      window.createTaskFromSubworkButtonHtml({
        [window.COL.T_ID]: 'CV001-009',
        [window.COL.T_PID]: 'CV001',
      })
    ).toBe('');
  });

  it('nút cấp 2 trên hàng công việc mang class add-subwork-from-work-btn và chữ «+ công việc con» khi withLabel', () => {
    window.__dat('currentUser', { name: 'Admin', role: 'admin' });
    const html = window.createSubworkFromWorkButtonHtml('CV001', 'Việc gốc', 'btn', true);
    expect(html).toContain('add-subwork-from-work-btn');
    expect(html).toContain('+ công việc con');
    expect(html).toContain('data-project-id="CV001"');
  });
});

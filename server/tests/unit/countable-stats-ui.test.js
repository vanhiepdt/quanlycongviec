// @vitest-environment jsdom
//
// Việc 5.4 nửa giao diện: `getFilteredProjects` / `getFilteredTasks` (4 thẻ + 6 biểu đồ)
// bỏ mục 'Chờ duyệt' và mọi dòng nằm dưới một mục đang chờ — khớp `v_countable_*`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  isPendingApproval, isCountableRow, getFilteredProjects, getFilteredTasks, COL,
  __dat: (ten, giaTri) => { ({ allTasks: () => { allTasks = giaTri; },
    allProjects: () => { allProjects = giaTri; },
    currentUser: () => { currentUser = giaTri; },
    currentOverviewProjectFilter: () => { currentOverviewProjectFilter = giaTri; } })[ten](); }
});`;

function duAn(ma, duyet) {
  return {
    [window.COL.P_ID]: ma,
    [window.COL.P_NAME]: ma,
    [window.COL.P_APPROVAL]: duyet,
  };
}

function nhiemVu(ma, pid, duyet, parent = '') {
  return {
    [window.COL.T_ID]: ma,
    [window.COL.T_PID]: pid,
    [window.COL.T_PARENT]: parent,
    [window.COL.T_APPROVAL]: duyet,
    [window.COL.T_STATUS]: 'Đang thực hiện',
  };
}

beforeEach(() => {
  new Function(APP_SRC + EXPORTS)();
  window.__dat('currentOverviewProjectFilter', null);
  window.__dat('currentUser', { name: 'Admin', role: 'admin' });
});

describe('isCountableRow / getFiltered* — TC-APR-06 phía giao diện', () => {
  it('công việc Chờ duyệt không vào getFilteredProjects, công việc đã duyệt thì có', () => {
    window.__dat('allProjects', [
      duAn('CV001', 'Đã duyệt'),
      duAn('CV002', 'Chờ duyệt'),
      duAn('CV003', 'Từ chối'),
    ]);
    window.__dat('allTasks', []);
    expect(window.getFilteredProjects().map((p) => p[window.COL.P_ID])).toEqual(['CV001', 'CV003']);
  });

  it('nhiệm vụ dưới công việc Chờ duyệt không vào getFilteredTasks dù bản thân Đã duyệt', () => {
    const task = nhiemVu('CV001-01', 'CV001', 'Đã duyệt');
    window.__dat('allProjects', [duAn('CV001', 'Chờ duyệt')]);
    window.__dat('allTasks', [task]);
    expect(window.getFilteredTasks()).toEqual([]);
    expect(window.isCountableRow(task)).toBe(false);
  });

  it('nhiệm vụ dưới công việc con Chờ duyệt không đếm', () => {
    window.__dat('allProjects', [duAn('CV001', 'Đã duyệt')]);
    window.__dat('allTasks', [
      nhiemVu('CV001-01', 'CV001', 'Chờ duyệt'),
      nhiemVu('CV001-02', 'CV001', 'Đã duyệt', 'CV001-01'),
    ]);
    expect(window.getFilteredTasks().map((t) => t[window.COL.T_ID])).toEqual([]);
  });

  it('thêm 1 mục Chờ duyệt không làm getFiltered* tăng một đơn vị', () => {
    window.__dat('allProjects', [duAn('CV001', 'Đã duyệt')]);
    window.__dat('allTasks', [nhiemVu('CV001-01', 'CV001', 'Đã duyệt')]);
    const truocP = window.getFilteredProjects().length;
    const truocT = window.getFilteredTasks().length;

    window.__dat('allProjects', [duAn('CV001', 'Đã duyệt'), duAn('CV002', 'Chờ duyệt')]);
    window.__dat('allTasks', [
      nhiemVu('CV001-01', 'CV001', 'Đã duyệt'),
      nhiemVu('CV002-01', 'CV002', 'Đã duyệt'),
    ]);
    expect(window.getFilteredProjects()).toHaveLength(truocP);
    expect(window.getFilteredTasks()).toHaveLength(truocT);
  });
});

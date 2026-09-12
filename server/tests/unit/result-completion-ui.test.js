// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { QUYEN_UI } from '../helpers/uiPermissions.js';
const source = readFileSync('../web/assets/js/app.js', 'utf8');
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  new Function(
    source +
      QUYEN_UI +
      `;Object.assign(window,{COL,createTaskModal,createProjectModal,createTaskTableRowSimple,filterTaskRows,createTasksSubworkBlockHtml,buildBangKetQua,createProjectCard,renderStatListItems,showProjectDetailsModal,setupResult:(items=[])=>{allTasks=items;currentUser={id:1,name:'Admin',role:'admin'};allProjects=[{[COL.P_ID]:'CV1',[COL.P_NAME]:'Công việc'}];}});`
  )();
  window.setupResult();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it('TC-KQ-UI-01: form cả ba cấp không có trạng thái thủ công', () => {
  for (const level of [2, 3]) {
    document.body.innerHTML = window.createTaskModal(false, { [window.COL.T_LEVEL]: level });
    expect(document.querySelector('[name="status"]')).toBeNull();
    if (level === 3) {
      expect(document.body.textContent).toContain('Ngày báo cáo');
      expect(document.body.textContent).not.toContain('Ngày hoàn thành');
    }
  }
  document.body.innerHTML = window.createProjectModal();
  expect(document.querySelector('[name="status"]')).toBeNull();
  const html = readFileSync('../web/index.html', 'utf8');
  expect(html).not.toMatch(/(?:projects|tasks)-status-filter/);
});
it('TC-KQ-UI-02: file có cột tỷ lệ và tiến độ riêng, tên đã thoát HTML', () => {
  document.body.innerHTML = window.buildBangKetQua(
    [
      {
        id: 1,
        ten_goc: '<img src=x onerror=alert(1)>',
        ty_le: 30,
        tienDo: 50,
        trang_thai: 'cho-xem',
        bans: [],
      },
    ],
    'NV1'
  );
  expect([...document.querySelectorAll('th')].map((t) => t.textContent)).toContain(
    'Tỷ lệ công việc (%)'
  );
  expect([...document.querySelectorAll('th')].map((t) => t.textContent)).toContain('Tiến độ');
  const cells = document.querySelector('.dong-kq-nhom').cells;
  expect(cells).toHaveLength(10);
  expect(cells[1].querySelector('input')).toBeNull();
  expect(document.querySelector('img')).toBeNull();
});
it('TC-KQ-UI-03: tab nhiệm vụ không checkbox hoàn thành/link; hiện từng nhóm kết quả', () => {
  const C = window.COL;
  const task = {
    [C.T_ID]: 'NV1',
    [C.T_PID]: 'CV1',
    [C.T_NAME]: 'Nhiệm vụ',
    [C.T_LEVEL]: 3,
    [C.T_STATUS]: 'Hoàn thành',
    [C.T_COMPLETION]: 100,
    hoanThanh: false,
    ketQuaFiles: [
      {
        id: 1,
        ten_ket_qua: 'Kết quả thứ nhất',
        ty_le: 100,
        tienDo: 100,
        trang_thai: 'da-duyet',
        co_ban: true,
      },
      {
        id: 2,
        ten_ket_qua: '<img src=x onerror=alert(1)>',
        ty_le: 0,
        tienDo: 0,
        trang_thai: 'luu-tam',
        co_ban: false,
      },
    ],
  };
  document.body.innerHTML =
    '<table><tbody>' + window.createTaskTableRowSimple(task) + '</tbody></table>';
  expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  expect(document.body.textContent).toContain('Kết quả thứ nhất');
  expect(document.body.textContent).toContain('Chưa có bản');
  expect(document.querySelectorAll('[data-task-result]')).toHaveLength(2);
  expect(document.querySelector('img')).toBeNull();
  expect(source).not.toContain('function handleQuickCompleteTask');
});

it('TC-KQ-UI-04: tìm theo tên file giữ nhiệm vụ và cả nhóm kết quả đi cùng', () => {
  const C = window.COL;
  const task = {
    [C.T_ID]: 'NV1',
    [C.T_NAME]: 'Nhiệm vụ tìm kiếm',
    [C.T_PID]: 'CV1',
    [C.T_LEVEL]: 3,
    ketQuaFiles: [{ id: 1, ten_ket_qua: 'Phụ lục cần tìm', co_ban: false }],
  };
  document.body.innerHTML =
    '<div id="tasks-grid"><div class="glass-card"><table><tbody>' +
    window.createTaskTableRowSimple(task) +
    '</tbody></table></div></div>';
  window.filterTaskRows('phụ lục');
  expect([...document.querySelectorAll('tbody tr')].every((r) => r.style.display === '')).toBe(
    true
  );
  window.filterTaskRows('không trùng');
  expect(document.querySelector('.glass-card').style.display).toBe('none');
  window.filterTaskRows('');
  expect(document.querySelector('.glass-card').style.display).toBe('');
});
it('TC-KQ-UI-05: nhóm, bản lịch sử và hàng panel thẳng cùng 10 cột', () => {
  document.body.innerHTML = window.buildBangKetQua(
    [
      {
        id: 9,
        ten_goc: 'Tài liệu.pdf',
        ty_le: 100,
        tienDo: 100,
        trang_thai: 'da-duyet',
        bans: [{ id: 8, ten_goc: 'Tài liệu.pdf', version_no: 1 }],
      },
    ],
    'NV1'
  );
  expect(document.querySelector('.dong-ban-kq').cells).toHaveLength(10);
  expect(document.querySelector('.dong-kq-panel').cells[0].colSpan).toBe(10);
  expect(document.querySelectorAll('th')).toHaveLength(10);
});

// Thẻ và danh sách cũ từng lấy trung bình cả cấp 2 lẫn cấp 3, khác Tổng quan/Gantt.
it.each(['card', 'stat-list', 'details'])(
  'TC-KQ-UI-06: %s dùng tiến độ gia quyền đầu mục, không cộng nhiệm vụ con lần nữa',
  (surface) => {
    const C = window.COL;
    const row = (id, level, parent, weight, progress) => ({
      [C.T_ID]: id,
      [C.T_PID]: 'CV1',
      [C.T_NAME]: id,
      [C.T_LEVEL]: level,
      [C.T_PARENT]: parent,
      [C.T_TY_LE]: weight,
      [C.T_COMPLETION]: progress,
    });
    window.setupResult([
      row('CV1-01', 2, '', 25, 40),
      row('CV1-02', 3, '', 75, 80),
      row('CV1-03', 3, 'CV1-01', 100, 0),
    ]);
    const project = { [C.P_ID]: 'CV1', [C.P_NAME]: 'Công việc', hoanThanh: false };
    if (surface === 'card') {
      document.body.innerHTML = window.createProjectCard(project, true);
    } else if (surface === 'stat-list') {
      document.body.innerHTML = '<div id="stat-list-container"></div>';
      window.renderStatListItems('project', [project]);
    } else {
      document.body.innerHTML = '<div id="modals-container"></div>';
      window.showProjectDetailsModal('CV1', 'Công việc');
    }
    // (25 × 40 + 75 × 80) / 100 = 70; trung bình ba dòng cho 40 là sai.
    expect(document.querySelector('[style*="width: 70%"]')).not.toBeNull();
  }
);

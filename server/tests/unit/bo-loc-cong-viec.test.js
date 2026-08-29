// @vitest-environment jsdom
//
// TC-CV-BL: bộ lọc của tab «Quản lý công việc» (2026-08-28).
//
// Yêu cầu người dùng: «bộ lọc tháng giống như Sơ đồ Gantt, thêm lọc theo nhóm phòng».
// Bốn điều test này canh:
//  1. Ô Tháng có thêm mục «Tất cả tháng» (value = "0") — đổi từ <input type="month"> sang
//     hai ô chọn mà bỏ mục này là người dùng MẤT khả năng xem trọn danh sách.
//  2. Tháng + Năm ghép ra đúng "YYYY-MM" và công việc lọc theo khoảng PHỦ QUA tháng đó.
//  3. Lọc phòng so đúng cột «Phòng» của công việc.
//  4. Danh sách phòng trong ô lọc KHÔNG rộng hơn phạm vi máy chủ trả về
//     (visibleDepartments), tức là không tự chế quyền phía client.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, thangLocCongViec, workMatchesMonth, workMatchesProjectsDept, dongBoOThangNamProjects,
  populateProjectsDeptFilter, handleProjectsMonthChange, handleProjectsYearChange,
  handleProjectsDeptFilter, renderProjects, setupProjectsFilterControls,
  __pq: (ten, giaTri) => {
    ({
      projectsXemThang: () => { projectsXemThang = giaTri; },
      projectsXemNam: () => { projectsXemNam = giaTri; },
      projectsLocPhong: () => { projectsLocPhong = giaTri; },
      allProjects: () => { allProjects = giaTri; },
      allTasks: () => { allTasks = giaTri; },
      currentUser: () => { currentUser = giaTri; },
      isAuthenticated: () => { isAuthenticated = giaTri; },
      departmentNames: () => { departmentNames = giaTri; },
      visibleDepartments: () => { visibleDepartments = giaTri; },
    })[ten]();
  },
  __docPq: () => ({ thang: projectsXemThang, nam: projectsXemNam, phong: projectsLocPhong }),
});`;

const HTML = `
  <input type="text" id="projects-search" value="">
  <select id="projects-month-select"></select>
  <select id="projects-year-select"></select>
  <select id="projects-dept-filter"><option value="">Tất cả phòng</option></select>
  <select id="projects-status-filter"><option value="" selected>Tất cả</option></select>
  <div id="projects-grid"></div>
  <a href="/api/v1/export/works.xlsx" id="export-works"></a>
  <a href="/api/v1/export/tasks.xlsx" id="export-tasks"></a>
  <a href="/api/v1/export/stats.xlsx" id="export-stats"></a>`;

const congViec = (id, ten, phong, batDau, ketThuc) => ({
  'Mã dự án': id,
  'Tên dự án': ten,
  Phòng: phong,
  'Ngày bắt đầu': batDau,
  'Ngày kết thúc': ketThuc,
  'Quản lý': 'Giám đốc A',
  'Trạng thái': 'Đang thực hiện',
});

function khoiDong() {
  document.body.innerHTML = HTML;
  new Function(APP_SRC + EXPORTS)();
  window.__pq('isAuthenticated', true);
  window.__pq('currentUser', { name: 'Giám đốc A', role: 'admin' });
  window.__pq('allTasks', []);
  window.__pq('allProjects', [
    congViec('CV01', 'Việc tháng 3', 'Phòng Kế hoạch', '2026-03-01', '2026-03-20'),
    congViec('CV02', 'Việc tháng 6', 'Phòng Kỹ thuật', '2026-06-01', '2026-06-30'),
    congViec('CV03', 'Việc dài', 'Phòng Kế hoạch', '2026-01-01', '2026-12-31'),
  ]);
  window.__pq('departmentNames', ['Phòng Kế hoạch', 'Phòng Kỹ thuật', 'Phòng Tài chính']);
  window.__pq('visibleDepartments', []);
  window.__pq('projectsXemThang', 0);
  window.__pq('projectsXemNam', 2026);
  window.__pq('projectsLocPhong', '');
}

beforeEach(() => {
  khoiDong();
});

describe('TC-CV-BL — ô Tháng/Năm của tab Công việc (giống Sơ đồ Gantt)', () => {
  it('ô Tháng có 13 mục: «Tất cả tháng» + 12 tháng', () => {
    window.dongBoOThangNamProjects();
    const oThang = document.getElementById('projects-month-select');
    expect(oThang.options.length).toBe(13);
    expect(oThang.options[0].value).toBe('0');
    expect(oThang.options[0].textContent).toBe('Tất cả tháng');
    expect(oThang.options[3].value).toBe('3');
    expect(oThang.options[12].textContent).toBe('Tháng 12');
  });

  it('ô Năm chứa năm đang xem, kể cả năm nằm ngoài dải mặc định', () => {
    window.__pq('projectsXemNam', 2035);
    window.dongBoOThangNamProjects();
    const giaTri = [...document.getElementById('projects-year-select').options].map((o) => o.value);
    expect(giaTri).toContain('2035');
    expect(document.getElementById('projects-year-select').value).toBe('2035');
  });

  it('nạp option hai lần không nhân đôi mục', () => {
    window.dongBoOThangNamProjects();
    window.dongBoOThangNamProjects();
    expect(document.getElementById('projects-month-select').options.length).toBe(13);
  });

  it('«Tất cả tháng» ⇒ thangLocCongViec rỗng; chọn tháng ⇒ "YYYY-MM"', () => {
    expect(window.thangLocCongViec()).toBe('');
    window.__pq('projectsXemThang', 3);
    expect(window.thangLocCongViec()).toBe('2026-03');
    window.__pq('projectsXemThang', 12);
    window.__pq('projectsXemNam', 2027);
    expect(window.thangLocCongViec()).toBe('2027-12');
  });

  it('đổi ô Tháng/Năm thì biến đang xem đổi theo, giá trị lạ bị bỏ qua', () => {
    window.handleProjectsMonthChange({ target: { value: '6' } });
    expect(window.__docPq().thang).toBe(6);
    window.handleProjectsYearChange({ target: { value: '2027' } });
    expect(window.__docPq().nam).toBe(2027);
    window.handleProjectsMonthChange({ target: { value: '13' } });
    window.handleProjectsYearChange({ target: { value: 'xyz' } });
    expect(window.__docPq()).toMatchObject({ thang: 6, nam: 2027 });
  });

  it('chọn «Tất cả tháng» (0) là giá trị HỢP LỆ, không bị chặn như 13', () => {
    window.__pq('projectsXemThang', 6);
    window.handleProjectsMonthChange({ target: { value: '0' } });
    expect(window.__docPq().thang).toBe(0);
    expect(window.thangLocCongViec()).toBe('');
  });
});

describe('TC-CV-BL-2 — tên công việc không còn gắn mã (2026-08-29)', () => {
  it('renderProjects: tiêu đề thẻ hết "(CV…)", tên vẫn hiện đủ', () => {
    window.renderProjects();
    const html = document.getElementById('projects-grid').innerHTML;
    expect(html).toContain('Việc tháng 3');
    expect(html).not.toContain('(CV01)');
    expect(html).not.toContain('(CV02)');
    expect(html).not.toContain('(CV03)');
  });
});

describe('TC-CV-BL — lọc theo tháng và theo nhóm phòng', () => {
  it('lọc tháng 3/2026: chỉ còn việc phủ qua tháng đó', () => {
    window.__pq('projectsXemThang', 3);
    window.renderProjects();
    const html = document.getElementById('projects-grid').innerHTML;
    expect(html).toContain('Việc tháng 3');
    expect(html).toContain('Việc dài');
    expect(html).not.toContain('Việc tháng 6');
  });

  it('workMatchesMonth: tháng rỗng nhận hết, việc không có ngày bị loại khi đang lọc', () => {
    const v = congViec('CV04', 'Không ngày', 'Phòng Kế hoạch', '', '');
    expect(window.workMatchesMonth(v, '')).toBe(true);
    expect(window.workMatchesMonth(v, '2026-03')).toBe(false);
  });

  it('lọc phòng: chỉ còn công việc của đúng phòng đã chọn', () => {
    window.__pq('projectsLocPhong', 'Phòng Kỹ thuật');
    window.renderProjects();
    const html = document.getElementById('projects-grid').innerHTML;
    expect(html).toContain('Việc tháng 6');
    expect(html).not.toContain('Việc tháng 3');
  });

  it('lọc phòng + lọc tháng cộng dồn (AND), không thay nhau', () => {
    window.__pq('projectsLocPhong', 'Phòng Kế hoạch');
    window.__pq('projectsXemThang', 6);
    window.renderProjects();
    const html = document.getElementById('projects-grid').innerHTML;
    expect(html).toContain('Việc dài');
    expect(html).not.toContain('Việc tháng 6');
    expect(html).not.toContain('Việc tháng 3');
  });

  it('không khớp gì thì báo rõ theo tháng, không để lưới trống trơn', () => {
    window.__pq('projectsXemThang', 3);
    window.__pq('projectsLocPhong', 'Phòng Kỹ thuật');
    window.renderProjects();
    expect(document.getElementById('projects-grid').textContent).toContain('2026-03');
  });

  it('handleProjectsDeptFilter đổi phòng và vẽ lại ngay', () => {
    window.handleProjectsDeptFilter({ target: { value: 'Phòng Kỹ thuật' } });
    expect(window.__docPq().phong).toBe('Phòng Kỹ thuật');
    expect(document.getElementById('projects-grid').innerHTML).toContain('Việc tháng 6');
  });
});

describe('TC-CV-BL — danh sách phòng trong ô lọc không rộng hơn phạm vi máy chủ', () => {
  it('không phải admin: chỉ các phòng máy chủ cho thấy (visibleDepartments)', () => {
    window.__pq('currentUser', { name: 'Phó GĐ B', role: 'Phó Giám đốc' });
    window.__pq('visibleDepartments', ['Phòng Kế hoạch']);
    window.populateProjectsDeptFilter();
    const giaTri = [...document.getElementById('projects-dept-filter').options].map((o) => o.value);
    expect(giaTri).toEqual(['', 'Phòng Kế hoạch']);
    expect(giaTri).not.toContain('Phòng Tài chính');
  });

  it('admin: thấy hết phòng, và nạp lại không nhân đôi option', () => {
    window.populateProjectsDeptFilter();
    window.populateProjectsDeptFilter();
    const giaTri = [...document.getElementById('projects-dept-filter').options].map((o) => o.value);
    expect(giaTri).toEqual(['', 'Phòng Kế hoạch', 'Phòng Kỹ thuật', 'Phòng Tài chính']);
  });

  it('setupProjectsFilterControls nối listener một lần duy nhất', () => {
    window.setupProjectsFilterControls();
    window.setupProjectsFilterControls();
    const oThang = document.getElementById('projects-month-select');
    expect(oThang.dataset.daNoi).toBe('1');
    oThang.value = '6';
    oThang.dispatchEvent(new window.Event('change'));
    expect(window.__docPq().thang).toBe(6);
  });
});

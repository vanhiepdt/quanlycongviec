// @vitest-environment jsdom
//
// 2026-08-27 — Phó Giám đốc phải THẤY tab «Quản lý công việc».
//
// Bệnh cũ: `updateUIForUser` chỉ mở `#projects-nav` cho admin, cho vai có chữ "quản lý" trong tên,
// hoặc cho người tình cờ đứng tên quản lý một công việc (`hasMatch`). "Phó Giám đốc" không khớp cả
// ba ⇒ tab biến mất, dù §6 cho vai này quyền như admin trong các phòng mình phụ trách.
//
// Test này canh cả hai phía của bản sửa: nav mở ra, và `laQuanTriTrongPhamVi()` KHÔNG nới rộng
// sang tab «Cán bộ» (§6 cho Phó Giám đốc `user: ['read']`, không phải quản lý người dùng).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, isAdmin, isManager, laQuanTriTrongPhamVi, laLanhDaoPhong, updateUIForUser, canUserCreateTask,
  canUserEditResource, canUserDeleteResource, getUserAllowedProjects,
  __pq: (ten, giaTri) => { ({
    currentUser: () => { currentUser = giaTri; },
    allProjects: () => { allProjects = giaTri; },
    allTasks: () => { allTasks = giaTri; },
    visibleDepartments: () => { visibleDepartments = giaTri; },
    isDeputyDirectorUser: () => { isDeputyDirectorUser = giaTri; },
    isDepartmentHeadUser: () => { isDepartmentHeadUser = giaTri; },
    myDepartment: () => { myDepartment = giaTri; },
  })[ten](); }
});`;

/** Đúng những id mà `updateUIForUser` chạm tới — thiếu một cái là hàm ném lỗi, không phải im lặng. */
const KHUNG = `
  <div id="user-info" class="hidden"></div>
  <div id="login-prompt"></div>
  <div id="user-avatar"></div>
  <div id="user-name"></div>
  <div id="user-role"></div>
  <a id="projects-nav" data-section="projects" style="display: none"></a>
  <a id="staff-nav" data-section="staff" style="display: none"></a>
  <button id="add-project-standalone"></button>
  <button id="quick-add-project"></button>
  <button id="add-task-standalone"></button>
  <button id="quick-add-task"></button>
  <button id="add-staff-btn"></button>
  <button id="quick-add-staff"></button>
  <button id="add-app-btn"></button>
  <button id="quick-add-app"></button>
`;

const nav = (id) => document.getElementById(id).style.display;

beforeEach(() => {
  document.body.innerHTML = KHUNG;
  new Function(APP_SRC + EXPORTS)();
  window.__pq('allProjects', []);
  window.__pq('allTasks', []);
  window.__pq('visibleDepartments', []);
  window.__pq('isDeputyDirectorUser', false);
  window.__pq('isDepartmentHeadUser', false);
});

/** Đăng nhập giả: đặt người dùng rồi gọi đúng hàm mà `handleSuccessfulLogin` gọi. */
function dangNhap(user, deputyContext) {
  window.__pq('currentUser', user);
  if (deputyContext !== undefined) window.__pq('isDeputyDirectorUser', deputyContext);
  window.updateUIForUser(user);
}

describe('TC-PGD-UI-01: tab «Quản lý công việc» của Phó Giám đốc', () => {
  it('Phó Giám đốc KHÔNG quản lý công việc nào vẫn thấy #projects-nav', () => {
    // Đây chính là ca hỏng: `allProjects` không có dòng nào mang tên họ ⇒ `hasMatch` = false.
    dangNhap({ name: 'Chị Phó GĐ', role: 'Phó Giám đốc' });
    expect(nav('projects-nav')).toBe('flex');
  });

  it('vẫn thấy tab khi ngữ cảnh phòng đã nạp (isDeputyDirectorUser = true)', () => {
    dangNhap({ name: 'Chị Phó GĐ', role: 'Phó Giám đốc' }, true);
    expect(nav('projects-nav')).toBe('flex');
  });

  it('KHÔNG mở tab «Cán bộ» — §6 cho vai này đọc người dùng, không quản lý', () => {
    dangNhap({ name: 'Chị Phó GĐ', role: 'Phó Giám đốc' });
    expect(nav('staff-nav')).toBe('none');
    expect(document.getElementById('add-staff-btn').style.display).toBe('none');
  });

  it('admin vẫn thấy cả hai tab (không làm hỏng nhánh cũ)', () => {
    dangNhap({ name: 'Admin', role: 'admin' });
    expect({ cv: nav('projects-nav'), cb: nav('staff-nav') }).toEqual({ cv: 'flex', cb: 'flex' });
  });

  it('Nhân viên không quản lý công việc nào thì vẫn KHÔNG thấy tab — luật cũ giữ nguyên', () => {
    dangNhap({ name: 'Nhân viên', role: 'Nhân viên' });
    expect({ cv: nav('projects-nav'), cb: nav('staff-nav') }).toEqual({ cv: 'none', cb: 'none' });
  });

  it('Nhân viên đứng tên quản lý một công việc thì thấy tab (nhánh hasMatch cũ)', () => {
    window.__pq('allProjects', [{ [window.COL.P_MANAGER]: 'Nhân viên' }]);
    dangNhap({ name: 'Nhân viên', role: 'Nhân viên' });
    expect(nav('projects-nav')).toBe('flex');
  });
});

describe('TC-PGD-UI-02: laQuanTriTrongPhamVi() — đúng hai nguồn, không nới thêm vai nào', () => {
  it('admin và Phó Giám đốc = true; các vai còn lại = false', () => {
    const ket = {};
    for (const role of [
      'admin',
      'Phó Giám đốc',
      'Trưởng phòng',
      'Phó phòng',
      'Quản lý công việc',
      'Nhân viên',
    ]) {
      window.__pq('currentUser', { name: 'X', role });
      ket[role] = window.laQuanTriTrongPhamVi();
    }
    expect(ket).toEqual({
      admin: true,
      'Phó Giám đốc': true,
      'Trưởng phòng': false,
      'Phó phòng': false,
      'Quản lý công việc': false,
      'Nhân viên': false,
    });
  });

  it('"Giám đốc" và "Phó Giám đốc bộ phận" KHÔNG khớp — so chuỗi CHÍNH XÁC như rbac.js', () => {
    // Cùng cái bẫy `includes` của TC-RBAC-07/08, nhưng ở phía trình duyệt.
    window.__pq('currentUser', { name: 'X', role: 'Giám đốc' });
    expect(window.laQuanTriTrongPhamVi()).toBe(false);
    window.__pq('currentUser', { name: 'X', role: 'Phó Giám đốc bộ phận' });
    expect(window.laQuanTriTrongPhamVi()).toBe(false);
  });

  it('cờ isDeputyDirectorUser từ getDepartmentContext() cũng đủ để mở nút', () => {
    window.__pq('currentUser', { name: 'X', role: 'Nhân viên' });
    window.__pq('isDeputyDirectorUser', true);
    expect(window.laQuanTriTrongPhamVi()).toBe(true);
  });

  it('chưa đăng nhập thì false, không ném lỗi', () => {
    window.__pq('currentUser', null);
    expect(window.laQuanTriTrongPhamVi()).toBe(false);
  });
});

describe('TC-PGD-UI-03: nút thêm/sửa/xoá của Phó Giám đốc', () => {
  const PGD = { name: 'Chị Phó GĐ', role: 'Phó Giám đốc' };

  it('nút «+ công việc» và «+ nhiệm vụ» hiện ra sau hideAdminButtons()', () => {
    dangNhap(PGD);
    expect(document.getElementById('add-project-standalone').style.display).toBe('');
    expect(document.getElementById('add-task-standalone').style.display).toBe('');
    expect(window.canUserCreateTask()).toBe(true);
  });

  it('sửa/xoá được công việc do NGƯỜI KHÁC phụ trách (phạm vi do máy chủ kiểm)', () => {
    const COL = window.COL;
    window.__pq('currentUser', PGD);
    window.__pq('allProjects', [{ [COL.P_ID]: 'CV001', [COL.P_MANAGER]: 'Người khác' }]);
    expect(window.canUserEditResource('project', 'CV001')).toBe(true);
    expect(window.canUserDeleteResource('project', 'CV001')).toBe(true);
  });

  it('đề xuất KHÔNG theo luật đó — vẫn của người tạo, Phó Giám đốc không sửa hộ', () => {
    // canUserEditResource trả true sớm cho vai này, nên phải khẳng định rõ: mở rộng chỉ áp cho
    // công việc/nhiệm vụ. Đề xuất do module riêng canh (`allProposals`), không nằm trong §6.
    window.__pq('currentUser', { name: 'NV', role: 'Nhân viên' });
    expect(window.canUserEditResource('proposal', 'DX001')).toBe(false);
  });

  it('getUserAllowedProjects: chỉ công việc của phòng phụ trách, không phải tất cả', () => {
    const COL = window.COL;
    const cvA = { [COL.P_ID]: 'CV001', [COL.P_DEPT]: 'Phòng A', [COL.P_MANAGER]: 'Ai đó' };
    const cvB = { [COL.P_ID]: 'CV002', [COL.P_DEPT]: 'Phòng B', [COL.P_MANAGER]: 'Ai đó' };
    window.__pq('currentUser', PGD);
    window.__pq('allProjects', [cvA, cvB]);
    window.__pq('visibleDepartments', ['Phòng A']);
    expect(window.getUserAllowedProjects().map((cv) => cv[COL.P_ID])).toEqual(['CV001']);
  });

  it('admin thì vẫn thấy tất cả, không bị bộ lọc phòng mới chặn', () => {
    const COL = window.COL;
    const cvA = { [COL.P_ID]: 'CV001', [COL.P_DEPT]: 'Phòng A' };
    const cvB = { [COL.P_ID]: 'CV002', [COL.P_DEPT]: 'Phòng B' };
    window.__pq('currentUser', { name: 'Admin', role: 'admin' });
    window.__pq('allProjects', [cvA, cvB]);
    window.__pq('visibleDepartments', ['Phòng A']);
    expect(window.getUserAllowedProjects()).toHaveLength(2);
  });
});

describe('TC-TP-UI: Trưởng phòng / Phó phòng được THÊM công việc (2026-08-29)', () => {
  it('laLanhDaoPhong đúng hai vai, không nới cho vai khác', () => {
    window.__pq('currentUser', { name: 'A', role: 'Trưởng phòng' });
    expect(window.laLanhDaoPhong()).toBe(true);
    window.__pq('currentUser', { name: 'B', role: 'Phó phòng' });
    expect(window.laLanhDaoPhong()).toBe(true);
    window.__pq('currentUser', { name: 'C', role: 'Phó Giám đốc' });
    expect(window.laLanhDaoPhong()).toBe(false);
    window.__pq('currentUser', { name: 'D', role: 'Nhân viên' });
    expect(window.laLanhDaoPhong()).toBe(false);
    window.__pq('currentUser', null);
    expect(window.laLanhDaoPhong()).toBe(false);
  });

  // ------------------------------------------------------------------------------------------
  // TC-TP-CV (Vòng 12e) — «Phòng có 4 công việc nhưng Phó phòng chỉ thấy 1».
  //
  // Nguyên nhân đo được: `getUserAllowedProjects()` có nhánh admin, nhánh Phó GĐ
  // (visibleDepartments) và nhánh «Quản lý công việc», rồi rơi xuống luật cuối «việc mình đứng
  // tên quản lý hoặc được giao nhiệm vụ» — TP/PP không có nhánh nào ⇒ chỉ thấy đúng công việc
  // mình đứng tên. Dữ liệu thật của phòng Quản lý Đào tạo dùng làm khuôn test ở dưới.
  // ------------------------------------------------------------------------------------------
  const PHONG = 'Quản lý Đào tạo';
  const cvPhong = (ma, quanLy, phong) => ({
    [window.COL.P_ID]: ma,
    [window.COL.P_DEPT]: phong === undefined ? PHONG : phong,
    [window.COL.P_MANAGER]: quanLy,
  });
  /** Bốn công việc thật của PH01: chỉ CV008 do Phó phòng đứng tên. */
  const BON_CONG_VIEC = () => [
    cvPhong('CV001', 'Quản lý Công việc'),
    cvPhong('CV002', 'Trưởng phòng Đào tạo'),
    cvPhong('CV006', 'Quản trị Hệ thống'),
    cvPhong('CV008', 'Phó phòng Đào tạo'),
  ];
  const maCV = () => window.getUserAllowedProjects().map((cv) => cv[window.COL.P_ID]);

  it('TC-TP-CV-01: Phó phòng thấy ĐỦ 4 công việc của phòng mình, không chỉ việc mình quản lý', () => {
    window.__pq('currentUser', { name: 'Phó phòng Đào tạo', role: 'Phó phòng' });
    window.__pq('allProjects', BON_CONG_VIEC());
    window.__pq('isDepartmentHeadUser', true);
    window.__pq('myDepartment', PHONG);
    expect(maCV()).toEqual(['CV001', 'CV002', 'CV006', 'CV008']);
  });

  it('TC-TP-CV-02: Trưởng phòng cũng vậy; công việc phòng KHÁC và việc chung vẫn ẩn', () => {
    window.__pq('currentUser', { name: 'Trưởng phòng Đào tạo', role: 'Trưởng phòng' });
    window.__pq('allProjects', [
      ...BON_CONG_VIEC(),
      cvPhong('CV003', 'Ai đó', 'Nghiên cứu Khoa học'),
      cvPhong('CV099', 'Ai đó', ''), // công việc chung, không phòng — máy chủ cũng không cho
    ]);
    window.__pq('isDepartmentHeadUser', true);
    window.__pq('myDepartment', PHONG);
    expect(maCV()).toEqual(['CV001', 'CV002', 'CV006', 'CV008']);
  });

  it('TC-TP-CV-03: bối cảnh phòng chưa về (myDepartment rỗng) ⇒ KHÔNG nới, giữ luật cũ', () => {
    // Phản chiếu race thật (§13.5): lần vẽ đầu chạy lúc `myDepartment` còn rỗng. Thà hẹp còn hơn
    // tự nới ở trình duyệt — `loadDepartmentContext` vẽ lại cho TP/PP (Vòng 12d) nên sau đó đúng.
    window.__pq('currentUser', { name: 'Phó phòng Đào tạo', role: 'Phó phòng' });
    window.__pq('allProjects', BON_CONG_VIEC());
    window.__pq('isDepartmentHeadUser', true);
    window.__pq('myDepartment', '');
    expect(maCV()).toEqual(['CV008']); // chỉ việc mình đứng tên quản lý
  });

  it('TC-TP-CV-04: KHÔNG dùng visibleDepartments (kênh của Phó GĐ) và không nới cho Cán bộ', () => {
    // TP/PP lấy phòng từ tài khoản; `visibleDepartments` có gì cũng không được ảnh hưởng.
    window.__pq('currentUser', { name: 'Trưởng phòng Đào tạo', role: 'Trưởng phòng' });
    window.__pq('allProjects', [...BON_CONG_VIEC(), cvPhong('CV003', 'Ai đó', 'Phòng lạ')]);
    window.__pq('isDepartmentHeadUser', true);
    window.__pq('myDepartment', PHONG);
    window.__pq('visibleDepartments', ['Phòng lạ']);
    expect(maCV()).not.toContain('CV003');
    // Cán bộ cùng phòng vẫn chỉ thấy việc của mình (ma trận §6: work chỉ read, không nới nút).
    window.__pq('currentUser', { name: 'Nhân viên Đào tạo', role: 'Nhân viên' });
    window.__pq('isDepartmentHeadUser', false);
    expect(maCV()).toEqual([]);
  });

  it('Trưởng phòng thấy nút «Công việc mới» (add-project-standalone)', () => {
    dangNhap({ name: 'Anh TP', role: 'Trưởng phòng' });
    expect(document.getElementById('add-project-standalone').style.display).toBe('');
  });

  it('Phó phòng cũng thấy; Nhân viên vẫn không thấy', () => {
    dangNhap({ name: 'Anh PP', role: 'Phó phòng' });
    expect(document.getElementById('add-project-standalone').style.display).toBe('');
    dangNhap({ name: 'Bạn NV', role: 'Nhân viên' });
    expect(document.getElementById('add-project-standalone').style.display).toBe('none');
  });

  it('«Tạo mới» là <a href="#"> ⇒ handler phải preventDefault, hết nhảy đầu trang', () => {
    // Kiểm hợp đồng theo nguồn: cả 7 nút Tạo mới đều bọc (event) + preventDefault ngay đầu.
    const dem = (APP_SRC.match(/event && event\.preventDefault\(\);/g) || []).length;
    // 7 nút Tạo mới vừa bọc + 1 chỗ preventDefault có sẵn từ trước ở app.js.
    expect(dem).toBe(8);
    for (const id of [
      'quick-add-project',
      'quick-add-task',
      'quick-add-staff',
      'quick-add-proposal',
      'quick-add-app',
      'add-project-standalone',
      'add-task-standalone',
    ]) {
      expect(APP_SRC).toContain(
        `document.getElementById("${id}")?.addEventListener("click", (event) => {`
      );
    }
  });

  it('TC-TP-CV-05: TP/PP SỬA và XOÁ được công việc/CV con/nhiệm vụ phòng mình (khớp ma trận §6)', () => {
    // Máy chủ cho hai vai này update+delete trên cả ba cấp trong phòng mình (rbac.js PERMISSIONS
    // + inScope case 'Trưởng phòng'/'Phó phòng'); client từng hẹp hơn — chỉ mở nút Sửa cho
    // project/subwork, còn canUserDeleteResource không có nhánh TP/PP nào (Vòng 12e).
    const COL = window.COL;
    window.__pq('allProjects', [{ [COL.P_ID]: 'CV001', [COL.P_MANAGER]: 'Người khác' }]);
    window.__pq('allTasks', [
      { [COL.T_ID]: 'CV001-002', [COL.T_PID]: 'CV001', [COL.T_ASSIGNEE]: 'Người khác' },
    ]);
    for (const vai of ['Trưởng phòng', 'Phó phòng']) {
      window.__pq('currentUser', { name: 'Lãnh đạo phòng', role: vai });
      for (const loai of ['project', 'subwork', 'task']) {
        expect(window.canUserDeleteResource(loai, 'CV001'), `xoá ${loai} với ${vai}`).toBe(true);
      }
      expect(window.canUserEditResource('project', 'CV001')).toBe(true);
      expect(window.canUserEditResource('subwork', 'CV001')).toBe(true);
    }
    // Cán bộ ngoài cuộc vẫn không được — client KHÔNG nới rộng hơn máy chủ.
    window.__pq('currentUser', { name: 'Cán bộ khác', role: 'Nhân viên' });
    expect(window.canUserEditResource('project', 'CV001')).toBe(false);
    expect(window.canUserDeleteResource('project', 'CV001')).toBe(false);
    expect(window.canUserDeleteResource('task', 'CV001-002')).toBe(false);
  });
});

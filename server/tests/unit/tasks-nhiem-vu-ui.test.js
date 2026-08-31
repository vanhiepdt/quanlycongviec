// @vitest-environment jsdom
//
// Tab «Quản lý Nhiệm vụ» — vòng 2026-08-27:
//   TC-TASKUI-01..04: lọc theo THÁNG/NĂM bằng luật GIAO khoảng (kể cả ngày cuối tháng — bẫy §13.5(b)),
//                     nhiệm vụ không có ngày thì ẨN.
//   TC-TASKUI-05..06: lọc theo CÁN BỘ và theo PHÒNG (phòng lấy từ công việc cấp 1 cha).
//   TC-TASKUI-07..10: gom theo CÔNG VIỆC CON — mỗi khối có thư mục đỏ, mã, số nhiệm vụ, trạng thái +
//                     tiến độ tổng hợp đúng luật `ganCayCon`; nhiệm vụ không cha vào khối riêng.
//   TC-TASKUI-11..12: mũi tên thu gọn nhớ trong localStorage với khoá RIÊNG `qlcv_tasks_collapsed`.
//   TC-TASKUI-14..18 (2026-08-28): PHẠM VI XEM — Phó Giám đốc phụ trách phòng nào thấy hết nhiệm vụ
//                     phòng đó (có thể NHIỀU phòng); vai khác và ngữ cảnh phòng rỗng thì không nới.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  taskMatchesDateFilter, taskMatchesStaffFilter, taskMatchesDeptFilter, taskMatchesTasksFilters,
  soThuTuNgay, xepNhiemVuTheoCongViecCon, tinhTongHopNhiemVu,
  createTasksSubworkBlockHtml, createTasksWorkSeparatorHtml,
  renderTasks, doiTrangThaiThuGonTasks, dongBoOThangNamTasks,
  populateTasksStaffFilter, populateTasksDeptFilter, COL,
  dsPhongToiPhuTrach, dsNhiemVuToiDuocThay,
  __tasksDoc: () => ({ thang: tasksXemThang, nam: tasksXemNam, thuGon: [...tasksThuGon] }),
  __tasks: (ten, giaTri) => { ({ thang: () => { tasksXemThang = giaTri; },
    nam: () => { tasksXemNam = giaTri; },
    canBo: () => { tasksLocCanBo = giaTri; },
    phong: () => { tasksLocPhong = giaTri; },
    tasks: () => { allTasks = giaTri; },
    projects: () => { allProjects = giaTri; },
    staff: () => { allStaff = giaTri; },
    phongNames: () => { departmentNames = giaTri; },
    phongPhuTrach: () => { visibleDepartments = giaTri; },
    laPgd: () => { isDeputyDirectorUser = giaTri; },
    laHead: () => { isDepartmentHeadUser = giaTri; },
    phongToi: () => { myDepartment = giaTri; },
    user: () => { currentUser = giaTri; } })[ten](); },
});`;

function khoiDong() {
  new Function(APP_SRC + EXPORTS)();
}

const C = {
  P_ID: 'Mã dự án',
  P_NAME: 'Tên dự án',
  P_MANAGER: 'Quản lý dự án',
  P_STATUS: 'Trạng thái dự án',
  P_DEPT: 'Phòng',
  T_ID: 'Mã nhiệm vụ',
  T_PID: 'Mã dự án',
  T_NAME: 'Tên nhiệm vụ',
  T_LEVEL: 'Cấp',
  T_PARENT: 'Mã cha',
  T_ASSIGNEE: 'Người thực hiện',
  T_STATUS: 'Trạng thái',
  T_START: 'Ngày bắt đầu',
  T_DUE: 'Hạn chót',
};

const nhiemVu = (ma, thuoc, cha, tuNgay, denNgay, trangThai, nguoi) => ({
  [C.T_ID]: ma,
  [C.T_PID]: thuoc,
  [C.T_NAME]: 'Nhiệm vụ ' + ma,
  [C.T_LEVEL]: 3,
  [C.T_PARENT]: cha,
  [C.T_ASSIGNEE]: nguoi || 'Cán bộ A',
  [C.T_STATUS]: trangThai || 'Đang thực hiện',
  [C.T_START]: tuNgay,
  [C.T_DUE]: denNgay,
});

const congViecCon = (ma, thuoc) => ({
  [C.T_ID]: ma,
  [C.T_PID]: thuoc,
  [C.T_NAME]: 'Công việc con ' + ma,
  [C.T_LEVEL]: 2,
  [C.T_PARENT]: '',
  [C.T_STATUS]: 'Đang thực hiện',
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  khoiDong();
  window.__tasks('user', { name: 'Quản trị', role: 'admin' });
  window.__tasks('thang', 8);
  window.__tasks('nam', 2026);
  window.__tasks('canBo', '');
  window.__tasks('phong', '');
});

describe('TC-TASKUI-01..04 — lọc THÁNG bằng luật GIAO khoảng, so bằng số thứ tự ngày', () => {
  it('TC-TASKUI-01: nhiệm vụ nằm trọn trong tháng thì hiện', () => {
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV1', 'CV1', '', '2026-08-05', '2026-08-10'))
    ).toBe(true);
  });

  it('TC-TASKUI-02: khoảng VẮT QUA tháng (trước → sau) vẫn hiện, ngoài hẳn thì ẩn', () => {
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV2', 'CV1', '', '2026-07-01', '2026-09-30'))
    ).toBe(true);
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV3', 'CV1', '', '2026-06-01', '2026-07-31'))
    ).toBe(false);
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV4', 'CV1', '', '2026-09-01', '2026-09-02'))
    ).toBe(false);
  });

  it('TC-TASKUI-03: bẫy §13.5(b) — ngày ĐẦU và ngày CUỐI tháng vẫn thuộc phạm vi', () => {
    // 'yyyy-mm-dd' phân tích ra 00:00 UTC = 07:00 ICT: nếu so Date thô với mốc nửa đêm giờ máy thì
    // 31/08 bị coi là ngoài tháng 8. Số thứ tự ngày phải cho cả hai đầu đều khớp.
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV5', 'CV1', '', '2026-08-01', '2026-08-01'))
    ).toBe(true);
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV6', 'CV1', '', '2026-08-31', '2026-08-31'))
    ).toBe(true);
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV7', 'CV1', '', '2026-07-31', '2026-07-31'))
    ).toBe(false);
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV8', 'CV1', '', '2026-09-01', '2026-09-01'))
    ).toBe(false);
    // Tháng 2 năm nhuận: 29/02/2024 là ngày cuối tháng.
    window.__tasks('thang', 2);
    window.__tasks('nam', 2024);
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV9', 'CV1', '', '2024-02-29', '2024-02-29'))
    ).toBe(true);
    expect(
      window.taskMatchesDateFilter(nhiemVu('NV10', 'CV1', '', '2024-03-01', '2024-03-01'))
    ).toBe(false);
  });

  it('TC-TASKUI-04: thiếu một đầu thì lấy đầu kia; KHÔNG có ngày nào thì ẨN', () => {
    expect(window.taskMatchesDateFilter(nhiemVu('NV11', 'CV1', '', '2026-08-20', ''))).toBe(true);
    expect(window.taskMatchesDateFilter(nhiemVu('NV12', 'CV1', '', '', '2026-08-20'))).toBe(true);
    expect(window.taskMatchesDateFilter(nhiemVu('NV13', 'CV1', '', '', ''))).toBe(false);
    // Dạng ngày kiểu Việt Nam cũng phải hiểu được.
    expect(window.taskMatchesDateFilter(nhiemVu('NV14', 'CV1', '', '15/08/2026', ''))).toBe(true);
  });
});

describe('TC-TASKUI-05..06 — lọc theo cán bộ và theo phòng', () => {
  beforeEach(() => {
    window.__tasks('projects', [
      { [C.P_ID]: 'CV1', [C.P_NAME]: 'Công việc 1', [C.P_DEPT]: 'Phòng Kỹ thuật' },
      { [C.P_ID]: 'CV2', [C.P_NAME]: 'Công việc 2', [C.P_DEPT]: 'Phòng Kế hoạch' },
    ]);
  });

  it('TC-TASKUI-05: ô cán bộ rỗng cho qua tất cả, có tên thì chỉ đúng người đó', () => {
    const a = nhiemVu('NV1', 'CV1', '', '2026-08-05', '2026-08-10', '', 'Cán bộ A');
    const b = nhiemVu('NV2', 'CV1', '', '2026-08-05', '2026-08-10', '', 'Cán bộ B');
    expect([window.taskMatchesStaffFilter(a), window.taskMatchesStaffFilter(b)]).toEqual([
      true,
      true,
    ]);
    window.__tasks('canBo', 'Cán bộ B');
    expect([window.taskMatchesStaffFilter(a), window.taskMatchesStaffFilter(b)]).toEqual([
      false,
      true,
    ]);
  });

  it('TC-TASKUI-06: phòng của nhiệm vụ lấy từ CÔNG VIỆC cha (không có cột phòng riêng)', () => {
    const a = nhiemVu('NV1', 'CV1', '', '2026-08-05', '2026-08-10');
    const b = nhiemVu('NV2', 'CV2', '', '2026-08-05', '2026-08-10');
    window.__tasks('phong', 'Phòng Kỹ thuật');
    expect([window.taskMatchesDeptFilter(a), window.taskMatchesDeptFilter(b)]).toEqual([
      true,
      false,
    ]);
    // Nhiệm vụ mồ côi công việc cha thì không thuộc phòng nào ⇒ bị lọc ra.
    expect(window.taskMatchesDeptFilter(nhiemVu('NV3', 'CV-LA', '', '2026-08-05', ''))).toBe(false);
  });
});

describe('TC-TASKUI-07..10 — gom theo CÔNG VIỆC CON, tổng hợp đúng luật ganCayCon', () => {
  const CAY = [
    congViecCon('CVC1', 'CV1'),
    congViecCon('CVC2', 'CV1'),
    nhiemVu('NV1', 'CV1', 'CVC1', '2026-08-01', '2026-08-05', 'Hoàn thành'),
    nhiemVu('NV2', 'CV1', 'CVC1', '2026-08-06', '2026-08-10', 'Đang thực hiện'),
    nhiemVu('NV3', 'CV1', 'CVC2', '2026-08-06', '2026-08-10', 'Hoàn thành'),
    nhiemVu('NV4', 'CV1', '', '2026-08-11', '2026-08-20', 'Đang thực hiện'),
    nhiemVu('NV5', 'CV1', 'CVC-LA', '2026-08-11', '2026-08-20', 'Đang thực hiện'),
  ];

  beforeEach(() => {
    window.__tasks('tasks', CAY);
    window.__tasks('projects', [
      { [C.P_ID]: 'CV1', [C.P_NAME]: 'Công việc 1', [C.P_DEPT]: 'Phòng Kỹ thuật' },
    ]);
  });

  it('TC-TASKUI-07: mỗi công việc con một khối, nhiệm vụ không cha vào khối «trực thuộc»', () => {
    const xep = window.xepNhiemVuTheoCongViecCon(CAY, 'CV1');
    expect(xep.khoi.map((k) => k.khoa)).toEqual(['CVC1', 'CVC2', 'truc:CV1']);
    expect(xep.khoi.map((k) => k.nhiemVu.length)).toEqual([2, 1, 2]);
    expect(xep.tongSoNhiemVu).toBe(5);
    // Khối cuối là nơi dồn nhiệm vụ không cha VÀ nhiệm vụ trỏ vào cha lạ.
    expect(xep.khoi[2].truc).toBe(true);
    expect(xep.khoi[2].nhiemVu.map((n) => n[C.T_ID]).sort()).toEqual(['NV4', 'NV5']);
    // Dòng cấp 2 không bao giờ bị đếm là nhiệm vụ.
    expect(xep.khoi.every((k) => k.nhiemVu.every((n) => Number(n[C.T_LEVEL]) !== 2))).toBe(true);
  });

  it('TC-TASKUI-08: công việc con hết nhiệm vụ sau khi lọc thì mất khối', () => {
    window.__tasks('thang', 9);
    expect(window.xepNhiemVuTheoCongViecCon(CAY, 'CV1').khoi).toEqual([]);
    window.__tasks('thang', 8);
    window.__tasks('canBo', 'Không ai');
    expect(window.xepNhiemVuTheoCongViecCon(CAY, 'CV1').khoi).toEqual([]);
  });

  it('TC-TASKUI-09: tiến độ = % nhiệm vụ hoàn thành; nhãn theo luật ganCayCon', () => {
    const xong = (ma) => nhiemVu(ma, 'CV1', 'CVC1', '2026-08-01', '2026-08-05', 'Hoàn thành');
    // Hạn ở tương lai xa để «đang thực hiện» không tự thành quá hạn khi ngày máy chạy đổi.
    const dang = (ma) => nhiemVu(ma, 'CV1', 'CVC1', '2026-08-01', '2099-12-31', 'Đang thực hiện');
    const tre = (ma) => nhiemVu(ma, 'CV1', 'CVC1', '2026-01-01', '2026-01-05', 'Đang thực hiện');
    expect(window.tinhTongHopNhiemVu([xong('A'), dang('B')])).toMatchObject({
      tong: 2,
      xong: 1,
      tienDo: 50,
      trangThai: 'Đang thực hiện',
      lop: 'status-active',
    });
    expect(window.tinhTongHopNhiemVu([xong('A'), xong('B')])).toMatchObject({
      tienDo: 100,
      trangThai: 'Hoàn thành',
      lop: 'status-completed',
    });
    expect(window.tinhTongHopNhiemVu([xong('A'), tre('B'), dang('C')])).toMatchObject({
      tienDo: 33,
      trangThai: 'Trễ hạn',
      lop: 'status-overdue',
    });
    // Nhiệm vụ quá hạn nhưng ĐÃ hoàn thành thì không kéo khối thành «Trễ hạn».
    const treXong = nhiemVu('D', 'CV1', 'CVC1', '2026-01-01', '2026-01-05', 'Hoàn thành');
    expect(window.tinhTongHopNhiemVu([treXong]).trangThai).toBe('Hoàn thành');
  });

  it('TC-TASKUI-10: đầu khối có thư mục ĐỎ, mã công việc con, số nhiệm vụ và tiến độ', () => {
    const html = window.createTasksSubworkBlockHtml({
      khoa: 'CVC1',
      ma: 'CVC1',
      ten: 'Công việc con CVC1',
      maCongViec: 'CV1',
      nhiemVu: [
        nhiemVu('NV1', 'CV1', 'CVC1', '2026-08-01', '2026-08-05', 'Hoàn thành'),
        nhiemVu('NV2', 'CV1', 'CVC1', '2026-08-06', '2026-08-10', 'Đang thực hiện'),
      ],
      truc: false,
    });
    expect(html).toContain('fa-folder');
    expect(html).toContain('text-red-500');
    expect(html).toContain('Công việc con CVC1');
    // 2026-08-29: bỏ mã khỏi TÊN hiển thị — mã chỉ còn ở data-* nuôi hộp thoại Xoá/Sửa.
    expect(html).not.toContain('(CVC1)');
    expect(html).toContain('2 nhiệm vụ');
    expect(html).toContain('50%');
    expect(html).toContain('tasks-subwork-toggle');
    expect(html).toContain('data-khoi="CVC1"');
    // Bảng bên trong vẫn là 9 cột cũ, dùng lại createTaskTableRowSimple.
    expect(html).toContain('Người thực hiện');
    expect(html).toContain('Nhiệm vụ NV2');
  });

  it('TC-TASKUI-11: tên có thẻ HTML bị thoát ở CẢ tiêu đề khối và dải phân cách cấp 1', () => {
    const doc = '<img src=x onerror=alert(1)>';
    const khoi = window.createTasksSubworkBlockHtml({
      khoa: doc,
      ma: doc,
      ten: doc,
      maCongViec: doc,
      nhiemVu: [nhiemVu('NV1', 'CV1', 'CVC1', '2026-08-01', '2026-08-05')],
      truc: false,
    });
    expect(khoi).not.toContain('<img src=x');
    expect(khoi).toContain('&lt;img src=x');
    const dai = window.createTasksWorkSeparatorHtml(doc, doc, null, 1);
    expect(dai).not.toContain('<img src=x');
    expect(dai).toContain('&lt;img src=x');
  });
});

describe('TC-TASKUI-12..13 — vẽ thật vào #tasks-grid và nhớ trạng thái thu gọn', () => {
  const CAY = [
    congViecCon('CVC1', 'CV1'),
    nhiemVu('NV1', 'CV1', 'CVC1', '2026-08-01', '2026-08-05', 'Hoàn thành'),
    nhiemVu('NV2', 'CV1', '', '2026-08-06', '2026-08-10', 'Đang thực hiện'),
    nhiemVu('NV3', 'CV1', 'CVC1', '2026-09-01', '2026-09-05', 'Đang thực hiện'),
  ];

  beforeEach(() => {
    document.body.innerHTML =
      '<select id="tasks-month-select"></select><select id="tasks-year-select"></select>' +
      '<select id="tasks-staff-filter"><option value="">Tất cả cán bộ</option></select>' +
      '<select id="tasks-dept-filter"><option value="">Tất cả phòng</option></select>' +
      '<div id="tasks-grid"></div>';
    window.__tasks('tasks', CAY);
    window.__tasks('projects', [
      { [C.P_ID]: 'CV1', [C.P_NAME]: 'Công việc 1', [C.P_DEPT]: 'Phòng Kỹ thuật' },
    ]);
    window.__tasks('staff', [{ 'Họ tên': 'Cán bộ A' }, { 'Họ tên': 'Cán bộ B' }]);
    window.__tasks('phongNames', ['Phòng Kỹ thuật', 'Phòng Kế hoạch']);
  });

  it('TC-TASKUI-12: vẽ dải cấp 1 + hai khối, ô Tháng/Năm/Cán bộ/Phòng được nạp option', () => {
    window.renderTasks();
    const grid = document.getElementById('tasks-grid');
    expect(grid.querySelectorAll('.tasks-subwork-toggle').length).toBe(2);
    expect(grid.textContent).toContain('Công việc 1');
    expect(grid.textContent).not.toContain('(CV1)');
    expect(grid.textContent).toContain('Nhiệm vụ trực thuộc công việc');
    // NV3 thuộc tháng 9 nên không được vẽ khi đang xem tháng 8.
    expect(grid.textContent).not.toContain('Nhiệm vụ NV3');
    // Vòng 12e: ô Tháng có 13 option — «Tất cả tháng» (value 0) + 12 tháng, như tab Công việc.
    const oThang = document.getElementById('tasks-month-select');
    expect(oThang.options.length).toBe(13);
    expect(oThang.options[0].value).toBe('0');
    expect(oThang.options[0].textContent).toBe('Tất cả tháng');
    expect(oThang.value).toBe('8'); // mặc định vẫn là tháng đang xem, không phải «Tất cả»
    expect(document.getElementById('tasks-year-select').options.length).toBeGreaterThanOrEqual(6);
    expect(document.getElementById('tasks-staff-filter').options.length).toBe(3);
    expect(document.getElementById('tasks-dept-filter').options.length).toBe(3);
  });

  it('TC-TASKUI-13: thu gọn ghi vào localStorage khoá riêng và vẽ lại đúng trạng thái', () => {
    window.renderTasks();
    window.doiTrangThaiThuGonTasks('CVC1');
    expect(JSON.parse(localStorage.getItem('qlcv_tasks_collapsed'))).toEqual(['CVC1']);
    expect(localStorage.getItem('qlcv_gantt_collapsed')).toBe(null);
    const khoi = document.querySelector('#tasks-grid .glass-card');
    expect(khoi.querySelector('.tasks-table-wrap').className).toContain('hidden');
    expect(khoi.querySelector('.tasks-subwork-toggle').getAttribute('aria-expanded')).toBe('false');
    window.doiTrangThaiThuGonTasks('CVC1');
    expect(JSON.parse(localStorage.getItem('qlcv_tasks_collapsed'))).toEqual([]);
    expect(
      document.querySelector('#tasks-grid .glass-card .tasks-table-wrap').className
    ).not.toContain('hidden');
  });

  it('TC-TASKUI-19: tên nhiệm vụ/công việc hết gắn mã — hết div mã dưới tên (2026-08-29)', () => {
    window.renderTasks();
    const grid = document.getElementById('tasks-grid');
    expect(grid.textContent).toContain('Nhiệm vụ NV1');
    expect(grid.innerHTML).not.toContain('(CV1)');
    expect(grid.innerHTML).not.toContain('(CVC1)');
    // Div mã dưới tên nhiệm vụ đã bỏ — mã chỉ còn trong data-id/data-project-id.
    expect(grid.innerHTML).not.toContain('>NV1</div>');
  });
});

// ---------------------------------------------------------------------------------------------
// TC-TASKUI-14..18 — PHẠM VI XEM của tab «Quản lý Nhiệm vụ» (lỗi 2026-08-28: Phó Giám đốc mở tab
// ra thấy TRẮNG vì chỗ lọc chỉ nhận nhiệm vụ của chính mình hoặc công việc mình đứng tên quản lý).
// Luật đúng: phụ trách phòng nào thì thấy HẾT nhiệm vụ phòng đó, và một Phó Giám đốc có thể phụ
// trách NHIỀU phòng — cùng luật `inScope()` của máy chủ (bó theo `managedDepartmentIds`).
// ---------------------------------------------------------------------------------------------
const congViec = (ma, phong, quanLy) => ({
  [C.P_ID]: ma,
  [C.P_NAME]: 'Công việc ' + ma,
  [C.P_MANAGER]: quanLy || 'Quản lý khác',
  [C.P_DEPT]: phong,
});

describe('TC-TASKUI-14..18 — Phó Giám đốc thấy hết nhiệm vụ của CÁC phòng mình phụ trách', () => {
  const CONG_VIEC = [
    congViec('CV1', 'Phòng Kỹ thuật'),
    congViec('CV2', 'Phòng Kế hoạch'),
    congViec('CV3', 'Phòng Tài chính'),
    congViec('CV4', ''), // công việc chung, không thuộc phòng nào
  ];
  const NHIEM_VU = [
    nhiemVu('NV1', 'CV1', '', '2026-08-01', '2026-08-05', 'Đang thực hiện', 'Cán bộ A'),
    nhiemVu('NV2', 'CV2', '', '2026-08-06', '2026-08-10', 'Đang thực hiện', 'Cán bộ B'),
    nhiemVu('NV3', 'CV3', '', '2026-08-11', '2026-08-15', 'Đang thực hiện', 'Cán bộ C'),
    nhiemVu('NV4', 'CV4', '', '2026-08-16', '2026-08-20', 'Đang thực hiện', 'Cán bộ D'),
  ];
  const ma = (ds) => ds.map((task) => task[C.T_ID]).sort();

  beforeEach(() => {
    window.__tasks('projects', CONG_VIEC);
    window.__tasks('tasks', NHIEM_VU);
  });

  const dangNhapPgd = (phongPhuTrach) => {
    window.__tasks('user', { name: 'PGĐ một', role: 'Phó Giám đốc' });
    window.__tasks('laPgd', true);
    window.__tasks('phongPhuTrach', phongPhuTrach);
  };

  it('TC-TASKUI-14: phụ trách HAI phòng thì thấy nhiệm vụ của cả hai, phòng khác vẫn ẩn', () => {
    dangNhapPgd(['Phòng Kỹ thuật', 'Phòng Kế hoạch']);
    expect(window.dsPhongToiPhuTrach()).toEqual(['Phòng Kỹ thuật', 'Phòng Kế hoạch']);
    // NV1/NV2 giao cho người KHÁC mà vẫn thấy — đó mới là «thấy hết nhiệm vụ phòng đấy».
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual(['NV1', 'NV2']);
  });

  it('TC-TASKUI-15: công việc chung (không phòng) vẫn ẩn, trừ khi chính mình được giao', () => {
    dangNhapPgd(['Phòng Kỹ thuật']);
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual(['NV1']);
    window.__tasks('tasks', [
      ...NHIEM_VU,
      nhiemVu('NV5', 'CV4', '', '2026-08-21', '2026-08-25', 'Đang thực hiện', 'PGĐ một'),
    ]);
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual(['NV1', 'NV5']);
  });

  it('TC-TASKUI-16: chưa nạp ngữ cảnh phòng (rỗng) thì KHÔNG nới — chỉ việc của mình', () => {
    dangNhapPgd([]);
    expect(window.dsPhongToiPhuTrach()).toEqual([]);
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual([]);
    // Vẫn giữ đường cũ: công việc mình đứng tên quản lý thì thấy nhiệm vụ của nó.
    window.__tasks('projects', [
      congViec('CV1', 'Phòng Kỹ thuật', 'PGĐ một'),
      ...CONG_VIEC.slice(1),
    ]);
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual(['NV1']);
  });

  it('TC-TASKUI-17: vai khác không được nới theo visibleDepartments; admin thấy tất cả', () => {
    // 2026-08-29 (Vòng 12c): TP/PP xem nhiệm vụ PHÒNG MÌNH là luật mới (ma trận §6 read theo
    // phòng) — nhưng vẫn KHÔNG nới theo `visibleDepartments` kiểu PGĐ; phòng lấy từ tài khoản.
    window.__tasks('user', { name: 'Trưởng phòng Kỹ thuật', role: 'Trưởng phòng' });
    window.__tasks('laPgd', false);
    window.__tasks('phongPhuTrach', ['Phòng Kỹ thuật']); // PGD-mới: phải bị bỏ qua với TP
    window.__tasks('laHead', true);
    window.__tasks('phongToi', 'Phòng Kỹ thuật');
    expect(window.dsPhongToiPhuTrach()).toEqual([]); // TP không dùng kênh phòng phụ trách
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual(['NV1']); // nhưng thấy nhiệm vụ phòng mình
    window.__tasks('user', { name: 'Quản trị', role: 'admin' });
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual(['NV1', 'NV2', 'NV3', 'NV4']);
  });

  it('TC-TASKUI-19: TP chưa nạp bối cảnh phòng (rỗng) thì chưa thấy gì — bối cảnh về là thấy', () => {
    // Phản chiếu race thật (Vòng 12d): lần vẽ đầu `myDepartment` còn rỗng ⇒ trống; nhờ
    // `loadDepartmentContext` vẽ lại khi `isDepartmentHead` bật nên sau đó TP thấy phòng mình.
    window.__tasks('user', { name: 'TP Kế hoạch', role: 'Trưởng phòng' });
    window.__tasks('laHead', true);
    window.__tasks('phongToi', '');
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual([]);
    window.__tasks('phongToi', 'Phòng Kế hoạch');
    expect(ma(window.dsNhiemVuToiDuocThay())).toEqual(['NV2']);
  });

  it('TC-TASKUI-18: vẽ thật — PGĐ không còn thấy «Chưa có nhiệm vụ nào»', () => {
    document.body.innerHTML =
      '<select id="tasks-month-select"></select><select id="tasks-year-select"></select>' +
      '<select id="tasks-staff-filter"><option value="">Tất cả cán bộ</option></select>' +
      '<select id="tasks-dept-filter"><option value="">Tất cả phòng</option></select>' +
      '<div id="tasks-grid"></div>';
    window.__tasks('staff', [{ 'Họ tên': 'Cán bộ A' }, { 'Họ tên': 'Cán bộ B' }]);
    window.__tasks('phongNames', ['Phòng Kỹ thuật', 'Phòng Kế hoạch', 'Phòng Tài chính']);
    dangNhapPgd(['Phòng Kỹ thuật', 'Phòng Kế hoạch']);
    window.renderTasks();
    const grid = document.getElementById('tasks-grid');
    expect(grid.textContent).not.toContain('Chưa có nhiệm vụ nào');
    expect(grid.textContent).toContain('Nhiệm vụ NV1');
    expect(grid.textContent).toContain('Nhiệm vụ NV2');
    expect(grid.textContent).not.toContain('Nhiệm vụ NV3');
    expect(grid.textContent).not.toContain('Nhiệm vụ NV4');
    // Ô lọc phòng của PGĐ chỉ liệt kê phòng mình phụ trách (2 phòng + «Tất cả phòng»).
    expect(document.getElementById('tasks-dept-filter').options.length).toBe(3);
  });
});

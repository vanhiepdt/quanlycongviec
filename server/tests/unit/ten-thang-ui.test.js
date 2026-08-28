// @vitest-environment jsdom
//
// TÊN THEO THÁNG — phần trình duyệt, TC-TENTHANG-25..38 (docs/KE-HOACH-TEN-THEO-THANG.md).
//
// Yêu cầu người dùng 2026-08-28: đầu việc dài hơn một tháng thì sửa được tên cho từng tháng SAU;
// xem tháng nào hiện tên tháng đó (kể cả Sơ đồ Gantt); không sửa thì giữ tên gốc; tháng đã đổi tên
// thì DI CHUỘT vào hiện TÊN CŨ. Test chạy app.js THẬT trong jsdom, `fetch` giả.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL,
  thangCuaNgay, cacThangCuaDauViec, thangSuaDuocCuaDauViec,
  banDoTenThangCuaDong, tenTheoThangCuaDong, tenGocNeuDaDoiCuaDong,
  thangLocNhiemVu, thangLocGantt, nhanThangVN,
  buildBangTenThang, buildKhungTenThang, buildThanhTabNhatKy, chuyenTabNhatKy,
  luuTenThang, xoaTenThang, ghiTenThang, veLaiBangTenThang,
  duLieuHoverGantt, buildGanttHoverCardHtml,
  createGanttWorkRowHtml, createGanttSubRowHtml, createGanttTaskRowHtml,
  renderProjects, renderTasks,
  taoFormCongViec: (isEdit, cv) => createProjectModal(isEdit, cv),
  taoFormNhiemVu: (isEdit, nv) => { pendingTaskCreate = null; return createTaskModal(isEdit, nv); },
  __pq: (ten, giaTri) => {
    ({
      allProjects: () => { allProjects = giaTri; },
      allTasks: () => { allTasks = giaTri; },
      allStaff: () => { allStaff = giaTri; },
      allDepartments: () => { allDepartments = giaTri; },
      currentUser: () => { currentUser = giaTri; },
      isAuthenticated: () => { isAuthenticated = giaTri; },
      projectsXemThang: () => { projectsXemThang = giaTri; },
      projectsXemNam: () => { projectsXemNam = giaTri; },
      tasksXemThang: () => { tasksXemThang = giaTri; },
      tasksXemNam: () => { tasksXemNam = giaTri; },
      ganttXemThang: () => { ganttXemThang = giaTri; },
      ganttXemNam: () => { ganttXemNam = giaTri; },
      ganttStartDate: () => { ganttStartDate = giaTri; },
      ganttEndDate: () => { ganttEndDate = giaTri; },
      currentSection: () => { currentSection = giaTri; },
    })[ten]();
  },
  __congViec: (ma) => allProjects.find((r) => r[COL.P_ID] === ma),
  __nhiemVu: (ma) => allTasks.find((r) => r[COL.T_ID] === ma),
});`;

const HTML = `
  <div id="modals-container"></div><div id="toast-container"></div>
  <select id="projects-month-select"></select><select id="projects-year-select"></select>
  <select id="projects-dept-filter"><option value="">Tất cả phòng</option></select>
  <div id="projects-grid"></div>
  <select id="tasks-month-select"></select><select id="tasks-year-select"></select>
  <select id="tasks-staff-filter"><option value="">Tất cả</option></select>
  <select id="tasks-dept-filter"><option value="">Tất cả phòng</option></select>
  <div id="tasks-grid"></div>`;

/** Công việc cấp 1 kéo dài 2026-08 → 2026-11 (4 tháng ⇒ 3 tháng đặt tên được). */
const congViec = (over = {}) => ({
  'Mã dự án': 'CV001',
  'Tên dự án': 'Tên gốc công việc',
  Phòng: 'Phòng Kế hoạch',
  'Quản lý': 'Giám đốc A',
  'Trạng thái': 'Đang thực hiện',
  'Ngày bắt đầu': '2026-08-10',
  'Ngày kết thúc': '2026-11-20',
  monthNames: {},
  ...over,
});

const nhiemVu = (over = {}) => ({
  'Mã nhiệm vụ': 'CV001-002',
  'Mã dự án': 'CV001',
  'Tên nhiệm vụ': 'Tên gốc nhiệm vụ',
  'Cán bộ trực tiếp': 'Nguyễn Văn A',
  'Trạng thái': 'Đang thực hiện',
  'Ưu tiên': 'Trung bình',
  'Ngày bắt đầu': '2026-08-10',
  'Hạn chót': '2026-11-20',
  Cấp: 3,
  monthNames: {},
  ...over,
});

const congViecCon = (over = {}) =>
  nhiemVu({ 'Mã nhiệm vụ': 'CV001-001', 'Tên nhiệm vụ': 'Tên gốc CV con', Cấp: 2, ...over });

function khoiDong() {
  document.body.innerHTML = HTML;
  window.fetch = vi.fn();
  new Function(APP_SRC + EXPORTS)();
  window.__pq('isAuthenticated', true);
  window.__pq('currentUser', { name: 'Giám đốc A', role: 'admin' });
  window.__pq('allStaff', []);
  window.__pq('allDepartments', []);
  window.__pq('allProjects', [congViec()]);
  window.__pq('allTasks', [congViecCon({ 'Mã cha': '' }), nhiemVu({ 'Mã cha': 'CV001-001' })]);
  window.__pq('projectsXemThang', 0);
  window.__pq('projectsXemNam', 2026);
  window.__pq('tasksXemThang', 0);
  window.__pq('tasksXemNam', 2026);
}

beforeEach(khoiDong);

describe('TC-TENTHANG-25..28 — tiện ích thuần phía trình duyệt', () => {
  it('TC-TENTHANG-25: liệt kê tháng của đầu việc, tháng ĐẦU không đặt tên riêng được', () => {
    expect(window.cacThangCuaDauViec('2026-08-10', '2026-11-20')).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(window.thangSuaDuocCuaDauViec('2026-08-10', '2026-11-20')).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    // Đầu việc gói trong MỘT tháng ⇒ không có tháng nào để đặt tên (R1).
    expect(window.thangSuaDuocCuaDauViec('2026-08-01', '2026-08-31')).toEqual([]);
    // Qua năm vẫn đúng.
    expect(window.cacThangCuaDauViec('2026-11-01', '2027-02-01')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('TC-TENTHANG-26: thiếu ngày / ngày ngược / ngày lạ đều ra rỗng, không treo vòng lặp', () => {
    expect(window.cacThangCuaDauViec('', '2026-11-20')).toEqual([]);
    expect(window.cacThangCuaDauViec('2026-08-10', '')).toEqual([]);
    expect(window.cacThangCuaDauViec('2026-11-20', '2026-08-10')).toEqual([]);
    expect(window.cacThangCuaDauViec('10/08/2026', '2026-11-20')).toEqual([]);
    expect(window.thangCuaNgay('2026-08-10T00:00:00.000Z')).toBe('2026-08');
    // Chặn 240 tháng: ngày kết thúc gõ sai không được kéo vòng lặp đi vô hạn.
    expect(window.cacThangCuaDauViec('2026-01-01', '9999-12-31')).toHaveLength(240);
  });

  it('TC-TENTHANG-27: có tên riêng thì lấy, không có/trắng/không xem theo tháng thì tên gốc', () => {
    const dong = { monthNames: { '2026-09': 'Tên tháng chín', '2026-10': '   ' } };
    expect(window.tenTheoThangCuaDong(dong, 'Gốc', '2026-09')).toBe('Tên tháng chín');
    expect(window.tenTheoThangCuaDong(dong, 'Gốc', '2026-10')).toBe('Gốc');
    expect(window.tenTheoThangCuaDong(dong, 'Gốc', '2026-11')).toBe('Gốc');
    // «Tất cả tháng» (rỗng) LUÔN dùng tên gốc — R4.
    expect(window.tenTheoThangCuaDong(dong, 'Gốc', '')).toBe('Gốc');
    // Nhận cả `month_names` của đường REST.
    expect(
      window.tenTheoThangCuaDong({ month_names: { '2026-09': 'Rest' } }, 'Gốc', '2026-09')
    ).toBe('Rest');
    expect(window.banDoTenThangCuaDong(null)).toEqual({});
  });

  it('TC-TENTHANG-28: tên cũ chỉ trả về khi tháng ĐÃ đổi tên', () => {
    const dong = { monthNames: { '2026-09': 'Tên tháng chín' } };
    expect(window.tenGocNeuDaDoiCuaDong(dong, 'Gốc', '2026-09')).toBe('Gốc');
    expect(window.tenGocNeuDaDoiCuaDong(dong, 'Gốc', '2026-10')).toBe('');
    expect(window.tenGocNeuDaDoiCuaDong(dong, 'Gốc', '')).toBe('');
    expect(window.nhanThangVN('2026-09')).toBe('Tháng 9/2026');
  });
});

describe('TC-TENTHANG-29..31 — tab «Tên theo tháng» trong modal chỉnh sửa', () => {
  it('TC-TENTHANG-29: đầu việc DÀI HƠN một tháng mới có tab, bảng bỏ tháng đầu', () => {
    const html = window.taoFormCongViec(true, window.__congViec('CV001')),
      doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('#project-tab-ten-thang')).not.toBeNull();
    const bang = doc.querySelector('#project-ten-thang-bang');
    expect(bang).not.toBeNull();
    // 3 hàng: 2026-09, 2026-10, 2026-11 — KHÔNG có 2026-08 (tháng đầu dùng tên gốc).
    expect(bang.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(bang.querySelector('#project-ten-thang-o-2026-09')).not.toBeNull();
    expect(bang.querySelector('#project-ten-thang-o-2026-08')).toBeNull();
    // Ô nhập gợi ý bằng tên gốc và KHÔNG có `name` ⇒ không lọt vào FormData khi bấm Cập nhật.
    const o = bang.querySelector('#project-ten-thang-o-2026-09');
    expect(o.getAttribute('placeholder')).toBe('Tên gốc công việc');
    expect(o.getAttribute('name')).toBeNull();
    expect(o.value).toBe('');
  });

  it('TC-TENTHANG-30: đầu việc gói trong MỘT tháng thì KHÔNG có tab (cả 3 cấp)', () => {
    window.__pq('allProjects', [congViec({ 'Ngày kết thúc': '2026-08-31' })]);
    window.__pq('allTasks', [
      congViecCon({ 'Hạn chót': '2026-08-31' }),
      nhiemVu({ 'Hạn chót': '2026-08-31' }),
    ]);
    const docCv = new DOMParser().parseFromString(
      window.taoFormCongViec(true, window.__congViec('CV001')),
      'text/html'
    );
    expect(docCv.querySelector('#project-tab-ten-thang')).toBeNull();
    for (const ma of ['CV001-001', 'CV001-002']) {
      const d = new DOMParser().parseFromString(
        window.taoFormNhiemVu(true, window.__nhiemVu(ma)),
        'text/html'
      );
      expect(d.querySelector('#task-tab-ten-thang')).toBeNull();
    }
  });

  it('TC-TENTHANG-31: cấp 2 và cấp 3 đều có tab, tháng đã đặt tên thì điền sẵn + có nút Bỏ', () => {
    window.__pq('allTasks', [
      congViecCon({ monthNames: { '2026-09': 'CV con tháng chín' } }),
      nhiemVu({ monthNames: {} }),
    ]);
    const dCon = new DOMParser().parseFromString(
      window.taoFormNhiemVu(true, window.__nhiemVu('CV001-001')),
      'text/html'
    );
    expect(dCon.querySelector('#task-tab-ten-thang')).not.toBeNull();
    expect(dCon.querySelector('#task-ten-thang-o-2026-09').value).toBe('CV con tháng chín');
    const hang = dCon.querySelectorAll('#task-ten-thang-bang tbody tr');
    expect(hang[0].textContent).toContain('Bỏ');
    expect(hang[1].textContent).not.toContain('Bỏ');
    // Ô «Tên nhiệm vụ» của form vẫn là TÊN GỐC — bấm Cập nhật không được biến tên tháng thành tên gốc.
    expect(dCon.querySelector('input[name="name"]').value).toBe('Tên gốc CV con');
    const dNv = new DOMParser().parseFromString(
      window.taoFormNhiemVu(true, window.__nhiemVu('CV001-002')),
      'text/html'
    );
    expect(dNv.querySelector('#task-tab-ten-thang')).not.toBeNull();
    expect(dNv.querySelectorAll('#task-ten-thang-bang tbody tr')).toHaveLength(3);
  });
});

describe('TC-TENTHANG-32..33 — hai tab đổi tên theo tháng đang xem', () => {
  it('TC-TENTHANG-32: tab Công việc — tháng 9 hiện tên tháng 9, tháng 10 và «Tất cả» tên gốc', () => {
    window.__pq('allProjects', [congViec({ monthNames: { '2026-09': 'Tên tháng chín' } })]);
    window.__pq('projectsXemThang', 9);
    window.renderProjects();
    const luoi = document.getElementById('projects-grid');
    expect(luoi.textContent).toContain('Tên tháng chín (CV001)');
    expect(luoi.textContent).not.toContain('Tên gốc công việc (CV001)');
    // Di chuột vào hiện TÊN CŨ (R6).
    expect(luoi.querySelector('h4').getAttribute('title')).toBe('Tên gốc: Tên gốc công việc');
    // data-name của thẻ vẫn là tên gốc: nó nuôi hộp thoại Xoá/Nhân bản, ở đó không có tháng.
    expect(luoi.querySelector('.project-card').getAttribute('data-name')).toBe('Tên gốc công việc');
    window.__pq('projectsXemThang', 10);
    window.renderProjects();
    expect(luoi.textContent).toContain('Tên gốc công việc (CV001)');
    expect(luoi.querySelector('h4').getAttribute('title')).toBeNull();
    window.__pq('projectsXemThang', 0);
    window.renderProjects();
    expect(luoi.textContent).toContain('Tên gốc công việc (CV001)');
  });

  it('TC-TENTHANG-33: tab Nhiệm vụ — cả 3 cấp đổi tên theo tháng, tên cũ nằm ở title', () => {
    window.__pq('allProjects', [congViec({ monthNames: { '2026-09': 'CV tháng chín' } })]);
    window.__pq('allTasks', [
      congViecCon({ 'Mã cha': '', monthNames: { '2026-09': 'CV con tháng chín' } }),
      nhiemVu({ 'Mã cha': 'CV001-001', monthNames: { '2026-09': 'NV tháng chín' } }),
    ]);
    window.__pq('tasksXemThang', 9);
    window.renderTasks();
    const luoi = document.getElementById('tasks-grid');
    expect(luoi.textContent).toContain('CV tháng chín (CV001)');
    expect(luoi.textContent).toContain('CV con tháng chín (CV001-001)');
    expect(luoi.textContent).toContain('NV tháng chín');
    expect(luoi.textContent).not.toContain('Tên gốc nhiệm vụ');
    const cacTitle = [...luoi.querySelectorAll('[title^="Tên gốc: "]')].map((el) =>
      el.getAttribute('title')
    );
    expect(cacTitle).toContain('Tên gốc: Tên gốc công việc');
    expect(cacTitle).toContain('Tên gốc: Tên gốc CV con');
    expect(cacTitle).toContain('Tên gốc: Tên gốc nhiệm vụ');
    window.__pq('tasksXemThang', 10);
    window.renderTasks();
    expect(document.getElementById('tasks-grid').textContent).toContain('Tên gốc nhiệm vụ');
  });
});

/** Dòng cây Gantt do `/api/v1/gantt` trả về: khoá tiếng Anh + `monthNames`. */
const ganttWork = (over = {}) => ({
  code: 'CV001',
  name: 'Tên gốc công việc',
  status: 'Đang thực hiện',
  startDate: '2026-08-10',
  endDate: '2026-11-20',
  progress: 40,
  taskCount: 1,
  supervisorName: 'Giám đốc A',
  leaderNames: [],
  subs: [],
  tasks: [],
  monthNames: {},
  ...over,
});

const ganttSub = (over = {}) => ({
  id: 11,
  code: 'CV001-001',
  name: 'Tên gốc CV con',
  level: 2,
  startDate: '2026-08-10',
  dueDate: '2026-11-20',
  completion: 20,
  assigneeName: 'Nguyễn Văn A',
  leaderNames: [],
  children: [],
  monthNames: {},
  ...over,
});

const ganttTask = (over = {}) => ({
  id: 12,
  code: 'CV001-002',
  name: 'Tên gốc nhiệm vụ',
  level: 3,
  startDate: '2026-08-10',
  dueDate: '2026-11-20',
  completion: 0,
  assigneeName: 'Nguyễn Văn A',
  leaderNames: [],
  monthNames: {},
  ...over,
});

/** Gantt LUÔN xem đúng một tháng: đặt khoảng + bộ lọc tháng/năm cho khớp. */
function xemGanttThang(thang, nam) {
  window.__pq('ganttXemThang', thang);
  window.__pq('ganttXemNam', nam);
  window.__pq('ganttStartDate', new Date(nam, thang - 1, 1));
  window.__pq('ganttEndDate', new Date(nam, thang, 0));
}

describe('TC-TENTHANG-34..36 — Sơ đồ Gantt', () => {
  it('TC-TENTHANG-34: cả 3 mức hàng Gantt hiện tên của tháng đang xem', () => {
    xemGanttThang(9, 2026);
    const html =
      window.createGanttWorkRowHtml(
        ganttWork({
          monthNames: { '2026-09': 'CV tháng chín' },
          subs: [
            ganttSub({
              monthNames: { '2026-09': 'CV con tháng chín' },
              children: [ganttTask({ monthNames: { '2026-09': 'NV tháng chín' } })],
            }),
          ],
        })
      ) + window.createGanttTaskRowHtml(ganttTask({ monthNames: {} }));
    const doc = new DOMParser().parseFromString(html, 'text/html'),
      ten = [...doc.querySelectorAll('.gantt-hover-name')].map((el) => el.textContent);
    expect(ten).toContain('CV tháng chín');
    expect(ten).toContain('CV con tháng chín');
    expect(ten).toContain('NV tháng chín');
    // Không đổi tên tháng này ⇒ vẫn tên gốc (R4).
    expect(ten).toContain('Tên gốc nhiệm vụ');
    // Nhãn TRÊN THANH cũng theo tháng, không chỉ nhãn bên trái.
    expect(doc.querySelector('.gantt-bar-project').textContent).toContain('CV tháng chín');
    // Tháng khác thì tất cả trở lại tên gốc.
    xemGanttThang(10, 2026);
    const doc10 = new DOMParser().parseFromString(
      window.createGanttWorkRowHtml(
        ganttWork({
          monthNames: { '2026-09': 'CV tháng chín' },
          subs: [ganttSub({ monthNames: { '2026-09': 'CV con tháng chín' } })],
        })
      ),
      'text/html'
    );
    expect(doc10.body.textContent).not.toContain('tháng chín');
    expect([...doc10.querySelectorAll('.gantt-hover-name')].map((el) => el.textContent)).toEqual([
      'Tên gốc công việc',
      'Tên gốc CV con',
    ]);
  });

  it('TC-TENTHANG-35: dữ liệu hover mang tên tháng + tên gốc, đúng loại từng cấp', () => {
    const w = window.duLieuHoverGantt(
      ganttWork({ monthNames: { '2026-09': 'CV tháng chín' } }),
      '2026-09'
    );
    expect(w).toMatchObject({
      loai: 'Công việc',
      ten: 'CV tháng chín',
      tenGoc: 'Tên gốc công việc',
    });
    const s = window.duLieuHoverGantt(
      ganttSub({ monthNames: { '2026-09': 'CV con tháng chín' } }),
      '2026-09'
    );
    expect(s).toMatchObject({
      loai: 'Công việc con',
      ten: 'CV con tháng chín',
      tenGoc: 'Tên gốc CV con',
    });
    const t = window.duLieuHoverGantt(ganttTask({ monthNames: {} }), '2026-09');
    expect(t).toMatchObject({ loai: 'Nhiệm vụ', ten: 'Tên gốc nhiệm vụ', tenGoc: '' });
    expect(window.duLieuHoverGantt(null, '2026-09')).toBeNull();
  });

  it('TC-TENTHANG-36: thẻ tooltip chỉ có dòng «Tên gốc» khi tháng ĐÃ đổi tên', () => {
    const coDoi = window.buildGanttHoverCardHtml(
      window.duLieuHoverGantt(ganttWork({ monthNames: { '2026-09': 'CV tháng chín' } }), '2026-09')
    );
    expect(coDoi).toContain('Công việc: CV tháng chín');
    expect(coDoi).toContain('Tên gốc: </b>Tên gốc công việc');
    const khongDoi = window.buildGanttHoverCardHtml(
      window.duLieuHoverGantt(ganttWork({ monthNames: {} }), '2026-09')
    );
    expect(khongDoi).toContain('Công việc: Tên gốc công việc');
    expect(khongDoi).not.toContain('Tên gốc: ');
    // Tên tháng có ký tự HTML vẫn bị thoát, không sinh thẻ mới.
    const doc = new DOMParser().parseFromString(
      window.buildGanttHoverCardHtml(
        window.duLieuHoverGantt(
          ganttWork({ monthNames: { '2026-09': '<img src=x onerror=alert(1)>' } }),
          '2026-09'
        )
      ),
      'text/html'
    );
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('.tieu-de').textContent).toBe(
      'Công việc: <img src=x onerror=alert(1)>'
    );
  });
});

/** `fetch` giả cho đường ghi: nhớ lại mọi lượt gọi, luôn trả JSON hợp lệ. */
function fetchGia(ok = true) {
  const lanGoi = [],
    than = ok
      ? { data: { month: '2026-09' } }
      : { error: { message: 'Tháng đầu không đổi tên được' } };
  window.fetch = vi.fn((duong, tuyChon) => {
    lanGoi.push({ duong, ...(tuyChon || {}) });
    // `restGhi` gọi `res.json().catch(...)` ⇒ `json` phải trả Promise thật.
    return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(than) });
  });
  return lanGoi;
}

describe('TC-TENTHANG-37..38 — đường ghi tên theo tháng', () => {
  it('TC-TENTHANG-37: Lưu gọi PUT, Bỏ gọi DELETE, dữ liệu trong bộ nhớ và hai tab cập nhật ngay', async () => {
    window.__pq('projectsXemThang', 9);
    window.__pq('tasksXemThang', 9);
    document.getElementById('modals-container').innerHTML =
      '<input id="project-ten-thang-o-2026-09" value="  CV tháng chín  ">' +
      '<div id="project-ten-thang-bang"></div>';
    let lanGoi = fetchGia();
    expect(await window.luuTenThang('project', 'CV001', '2026-09')).toBe(true);
    // Chỉ MỘT lượt ghi (chưa có cookie CSRF thì thêm một lượt /api/csrf ở đầu).
    const ghi = lanGoi.filter((l) => l.method);
    expect(ghi).toHaveLength(1);
    expect(ghi[0].method).toBe('PUT');
    expect(ghi[0].duong).toBe('/api/v1/works/CV001/month-names/2026-09');
    // Tên được cắt trắng hai đầu trước khi gửi.
    expect(JSON.parse(ghi[0].body)).toEqual({ name: 'CV tháng chín' });
    // Không có lượt tải lại nào ⇒ dòng trong bộ nhớ phải được vá tại chỗ.
    expect(window.__congViec('CV001').monthNames['2026-09']).toBe('CV tháng chín');
    expect(document.getElementById('projects-grid').textContent).toContain('CV tháng chín (CV001)');
    expect(document.getElementById('tasks-grid').textContent).toContain('CV tháng chín (CV001)');

    lanGoi = fetchGia();
    expect(await window.xoaTenThang('project', 'CV001', '2026-09')).toBe(true);
    const xoa = lanGoi.filter((l) => l.method);
    expect(xoa[0].method).toBe('DELETE');
    expect(xoa[0].body).toBeUndefined();
    expect(window.__congViec('CV001').monthNames['2026-09']).toBeUndefined();
    expect(document.getElementById('projects-grid').textContent).toContain(
      'Tên gốc công việc (CV001)'
    );
  });

  it('TC-TENTHANG-38: máy chủ từ chối thì giữ nguyên dữ liệu cũ và báo lỗi của máy chủ', async () => {
    window.__pq('allTasks', [
      congViecCon({ 'Mã cha': '', monthNames: { '2026-09': 'CV con tháng chín' } }),
    ]);
    fetchGia(false);
    expect(await window.ghiTenThang('task', 'CV001-001', '2026-09', 'Tên mới')).toBe(false);
    expect(window.__nhiemVu('CV001-001').monthNames['2026-09']).toBe('CV con tháng chín');
    expect(document.getElementById('toast-container').textContent).toContain(
      'Tháng đầu không đổi tên được'
    );
    // Đường của cấp 2/3 là /work-items/, không phải /works/.
    fetchGia();
    await window.ghiTenThang('task', 'CV001-001', '2026-10', 'Tên tháng mười');
    expect(
      window.fetch.mock.calls.some((c) => c[0].includes('/api/v1/work-items/CV001-001/'))
    ).toBe(true);
    expect(window.__nhiemVu('CV001-001').monthNames).toEqual({
      '2026-09': 'CV con tháng chín',
      '2026-10': 'Tên tháng mười',
    });
  });
});

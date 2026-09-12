// @vitest-environment jsdom
//
// TAB NHIỆM VỤ — thiết kế lại 2026-09-10. Hai đợt yêu cầu của người dùng, nguyên văn:
//
// ĐỢT 3: «tab nhiệm vụ đang không hiển thị nhiệm vụ trực thuộc công việc cha luôn … Cùng font chữ,
//   tiêu đề cột thì căn giữa, mỗi nhiệm vụ có dấu tích để ẩn hiện file kết quả, độ rộng tên file
//   cũng đến mức cùng căn với nhau, nếu dài quá thì để …, di chuột vào sẽ hiển thị tên đầy đủ và
//   Hiển thị số bản, thêm cột về tình trạng file kết quả … nhìn ra là biết từng nhiệm vụ tách
//   biệt nhau, từng file kết quả tách biệt nhau, căn những cột có kết quả bé thì rộng bé lại …
//   phần xem kết quả của file sẽ hiển thị popup mới để xem chi tiết nhật ký file, theo thời gian
//   để biết ban đầu ai đăng ký file đấy, rồi ai thực hiện, xem lịch sử các file, ý kiến mỗi lần».
//
// ĐỢT 4: «Đổi lại cái tích … thay bằng nút mũi tên xuống và mũi tên lên để xem mở rộng kết quả và
//   ẩn kết quả, file kết quả sẽ lùi về phía bên phải hơn so với tên nhiệm vụ, thêm cột tên file
//   thay vì để tên file bên dưới file kết quả như hiện tại, tên người thực hiện căn giữa ô đi.
//   Tên nhiệm vụ sẽ to hơn tên file 02 cỡ chữ, Màu chữ của file kết quả sẽ đổi theo tiến độ, ví dụ
//   tiến độ 100% thì màu xanh lá cây, dưới 20% là đỏ … Phần trên Tổng số, Đã duyệt đủ kết quả,
//   Chưa duyệt đủ kết quả, Quá hạn ở 1 dòng thôi».
//
// TC-TASK-DESIGN-01/02 do đợt trước viết (đỏ trước khi sửa); 03..08 của đợt 3; 09..11 của đợt 4.
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { QUYEN_UI } from '../helpers/uiPermissions.js';
const src = readFileSync('../web/assets/js/app.js', 'utf8');
// Bố cục nằm ở app.css (Tailwind của dự án là bản biên dịch sẵn nên class tuỳ ý không tồn tại).
// Pin thẳng vào CSS: nếu ai đó dời bề rộng cột sang class Tailwind chết thì test này đỏ.
const css = readFileSync('../web/assets/css/app.css', 'utf8');
beforeEach(() => {
  vi.useFakeTimers();
  // Trạng thái ẩn/hiện hàng file nhớ trong localStorage: không dọn thì ca trước rò sang ca sau.
  localStorage.clear();
  document.body.innerHTML = '<div id="tasks-grid"></div>';
  new Function(
    src +
      QUYEN_UI +
      `;Object.assign(window, {COL,renderTasks,createTaskTableRowSimple,filterTaskRows,
    moNhatKyFileKetQua,doiTrangThaiAnFile,COT_BANG_NHIEM_VU,mauTienDoFile,
    __setup:(rows)=>{allTasks=rows;allProjects=[{[COL.P_ID]:'CV1',[COL.P_NAME]:'Công việc cha'}];currentUser={id:1,name:'Admin',role:'admin'};},
    __defaultMonth:()=>tasksXemThang,
    __anFile:()=>[...tasksAnFile],
    __history: typeof moNhatKyFileKetQua==='function'?moNhatKyFileKetQua:null,
    __response:(response)=>{restGet=async()=>response;}
  });`
  )();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
function task(id = 'NV1') {
  const C = window.COL;
  return {
    [C.T_ID]: id,
    [C.T_PID]: 'CV1',
    [C.T_NAME]: 'Nhiệm vụ trực tiếp ' + id,
    [C.T_LEVEL]: 3,
    [C.T_PARENT]: '',
    [C.T_START]: '2026-10-01',
    [C.T_DUE]: '2026-10-31',
    [C.T_ASSIGNEE]: 'Lê Thị Nhân',
    [C.T_LEADERS]: 'Trần Thị Trưởng, Ngô Văn Phó',
    ketQuaFiles: [
      {
        id: 8,
        ten_ket_qua: 'Tên kết quả rất dài cần hiện đầy đủ trong tooltip.pdf',
        ten_ban_cuoi: 'bản cuối.pdf',
        trang_thai: 'cho-xem',
        co_ban: true,
        so_ban: 3,
        ty_le: 100,
        tienDo: 50,
        ten_nguoi_nop: 'Người nộp',
      },
    ],
  };
}
it('TC-TASK-DESIGN-01: mở mặc định mọi tháng, nhiệm vụ trực thuộc cha vẫn hiện dù ở tháng 10', () => {
  window.__setup([task()]);
  window.renderTasks();
  expect(window.__defaultMonth()).toBe(0);
  expect(document.body.textContent).toContain('Nhiệm vụ trực thuộc công việc');
  expect(document.body.textContent).toContain('Nhiệm vụ trực tiếp NV1');
});
it('TC-TASK-DESIGN-02: bảng 11 cột — «Kết quả làm được» ở CỘT NHIỆM VỤ, cột «Tên file» chứa TÊN FILE THẬT', () => {
  window.__setup([task()]);
  window.renderTasks();
  expect(document.querySelectorAll('.tasks-results-table th')).toHaveLength(11);
  expect(document.body.textContent).toContain('Số bản');
  expect(document.body.textContent).toContain('Tình trạng kết quả');
  expect(document.body.textContent).toContain('Tên file');
  const hangFile = document.querySelector('[data-task-result]');
  // ĐỢT 5 (2026-09-11): `ten_ket_qua` là TÊN KHAI người dùng điền ở ô ＋, KHÔNG phải tên file. Đợt 4
  // nhét nó vào cột «Tên file» nên tiêu đề cột nói một đằng, nội dung một nẻo — người dùng báo
  // «hiện tên Kết quả làm được ở cùng cột với tên file». Nay nó VỀ CỘT NHIỆM VỤ, cạnh icon tệp giấy.
  const tenKq = hangFile.querySelector('td:nth-child(1) .task-file-name');
  expect(tenKq?.title).toBe(task().ketQuaFiles[0].ten_ket_qua);
  expect(tenKq?.closest('.task-file-lui')).toBeTruthy();
  expect(hangFile.querySelector('td:nth-child(1) .task-file-icon')).toBeTruthy();
  // Cột «Tên file» nay ĐÚNG NGHĨA: TÊN FILE VẬT LÝ của bản cuối (`ten_ban_cuoi`), chữ màu trung tính.
  const tenFile = hangFile.querySelector('td:nth-child(2) .task-file-ten-that');
  expect(tenFile?.title).toBe('bản cuối.pdf');
  expect(tenFile?.textContent).toBe('bản cuối.pdf');
  expect(hangFile.querySelector('td:nth-child(2) .task-file-name')).toBeNull();
  expect(hangFile.textContent).toContain('3');
});

it('TC-TASK-DESIGN-03: tiêu đề cột CĂN GIỮA và cột ít chữ thì HẸP — pin thẳng vào app.css', () => {
  // «Cùng font chữ» + «tiêu đề căn giữa»: một cỡ chữ cho cả bảng, th không được căn trái.
  expect(css).toMatch(/\.tasks-results-table\s*\{[^}]*font-size:\s*13px/);
  expect(css).toMatch(/\.tasks-results-table th\s*\{[^}]*text-align:\s*center/);
  expect(css).not.toMatch(/\.tasks-results-table th[^{]*\{[^}]*text-align:\s*left/);
  // «căn những cột có kết quả bé thì rộng bé lại» — năm cột người dùng nêu phải hẹp hơn cột tên.
  for (const cot of ['c-prio', 'c-ratio', 'c-prog', 'c-start', 'c-due']) {
    expect(css).toMatch(new RegExp(`col\\.${cot}\\s*\\{\\s*width:\\s*[5-9]%`));
  }
  // Tên file dài cắt «…» — thiếu một trong ba thuộc tính này là chữ tràn chứ không cắt.
  expect(css).toMatch(/\.task-file-name\s*\{[^}]*text-overflow:\s*ellipsis/);
  expect(css).toMatch(/\.task-file-name\s*\{[^}]*white-space:\s*nowrap/);
  // Từng nhiệm vụ / từng file tách biệt: gờ đậm cho hàng nhiệm vụ, gạch đứt cho hàng file.
  expect(css).toMatch(/tr\.task-row-chinh > td\s*\{[^}]*border-top:\s*2px solid/);
  expect(css).toMatch(/tr\.task-result-row > td\s*\{[^}]*border-bottom:\s*1px dashed/);
});

it('TC-TASK-DESIGN-04: colgroup đúng 11 cột theo thứ tự, cột tên ăn phần còn lại', () => {
  window.__setup([task()]);
  window.renderTasks();
  const cols = [...document.querySelectorAll('.tasks-results-table colgroup col')].map(
    (c) => c.className
  );
  expect(cols).toEqual([...window.COT_BANG_NHIEM_VU]);
  expect(window.COT_BANG_NHIEM_VU).toHaveLength(11);
  // Hai chỗ colspan phải theo kịp số cột, không thì dòng «Chưa khai» hụt ô và lệch cả bảng.
  window.__setup([{ ...task('NV2'), ketQuaFiles: [] }]);
  window.renderTasks();
  expect(document.querySelector('td.task-chua-co-file')?.colSpan).toBe(11);
});

it('TC-TASK-DESIGN-05: nút mũi tên ẩn/hiện hàng file — bấm ▲ thì hàng file ẩn, hàng nhiệm vụ vẫn hiện', () => {
  window.__setup([task()]);
  window.renderTasks();
  // Nút là <button>, không phải checkbox: TC-KQ-UI-03 chốt tab nhiệm vụ không còn checkbox nào
  // sau đợt «bỏ checkbox Hoàn thành». Chốt lại từ phía này để hai đợt không giẫm nhau.
  expect(document.querySelector('#tasks-grid input[type="checkbox"]')).toBeNull();
  const nut = document.querySelector('button.task-files-toggle');
  // Đang HIỆN file ⇒ mũi tên chỉ HÀNH ĐỘNG kế tiếp là ẨN ⇒ ▲ (`fa-chevron-up`).
  expect(nut?.getAttribute('aria-expanded')).toBe('true');
  expect(nut?.querySelector('i')?.classList.contains('fa-chevron-up')).toBe(true);
  const hangFile = () => document.querySelector('tr[data-task-result]');
  expect(hangFile().style.display).not.toBe('none');
  window.doiTrangThaiAnFile('NV1');
  // Đang ẨN ⇒ mũi tên đổi chiều thành ▼ (`fa-chevron-down`) = bấm để MỞ RỘNG.
  expect(nut.getAttribute('aria-expanded')).toBe('false');
  expect(nut.querySelector('i').classList.contains('fa-chevron-down')).toBe(true);
  expect(nut.classList.contains('task-files-toggle-an')).toBe(true);
  expect(hangFile().style.display).toBe('none');
  expect(window.__anFile()).toEqual(['NV1']);
  expect(document.querySelector('tr.task-row-chinh').style.display).not.toBe('none');
  // Nhớ qua localStorage và áp dụng ngay lần vẽ kế tiếp, không cần bấm lại.
  window.renderTasks();
  const nut2 = document.querySelector('button.task-files-toggle');
  expect(nut2.getAttribute('aria-expanded')).toBe('false');
  expect(nut2.querySelector('i').classList.contains('fa-chevron-down')).toBe(true);
  expect(document.querySelector('tr[data-task-result]').style.display).toBe('none');
  // Bấm lại thì hiện.
  window.doiTrangThaiAnFile('NV1');
  expect(document.querySelector('tr[data-task-result]').style.display).not.toBe('none');
});

it('TC-TASK-DESIGN-06: tìm theo tên file vẫn giữ nhiệm vụ, nhưng KHÔNG tự mở lại hàng đang gập', () => {
  window.__setup([task()]);
  window.renderTasks();
  window.doiTrangThaiAnFile('NV1');
  window.filterTaskRows('tooltip');
  expect(document.querySelector('tr.task-row-chinh').style.display).not.toBe('none');
  expect(document.querySelector('tr[data-task-result]').style.display).toBe('none');
});

it('TC-TASK-DESIGN-07: hàng file có cột Tình trạng đúng nhãn, kể cả «Lưu tạm» của đợt V4', () => {
  const t = task();
  t.ketQuaFiles = [
    {
      id: 8,
      ten_ket_qua: 'a.docx',
      trang_thai: 'luu-tam',
      co_ban: true,
      so_ban: 1,
      ty_le: 40,
      tienDo: 0,
    },
    {
      id: 9,
      ten_ket_qua: 'b.docx',
      trang_thai: 'can-sua',
      co_ban: true,
      so_ban: 2,
      ty_le: 60,
      tienDo: 20,
    },
    {
      id: 10,
      ten_ket_qua: 'c.docx',
      trang_thai: 'cho-lanh-dao',
      co_ban: true,
      so_ban: 1,
      ty_le: 0,
      tienDo: 80,
    },
    {
      id: 11,
      ten_ket_qua: 'd.docx',
      trang_thai: 'cho-xem',
      co_ban: false,
      so_ban: 0,
      ty_le: 0,
      tienDo: 0,
    },
  ];
  window.__setup([t]);
  window.renderTasks();
  const hang = [...document.querySelectorAll('tr[data-task-result]')];
  expect(hang).toHaveLength(4);
  // Thêm cột «Tên file» nên hai cột này DỊCH sang phải một ô: tình trạng 10, số bản 9.
  const nhan = (i) => hang[i].querySelector('td:nth-child(10)').textContent;
  expect(nhan(0)).toBe('Lưu tạm');
  expect(nhan(1)).toBe('Cần sửa — nộp bản mới');
  expect(nhan(2)).toBe('Chờ Phó GĐ/Giám đốc');
  expect(nhan(3)).toBe('Chưa nộp'); // nhóm khai trước, 0 bản
  // Số bản là của NHÓM, không phải của nhiệm vụ: 1/2/1/0.
  const vers = [...document.querySelectorAll('tr[data-task-result] td:nth-child(9)')].map(
    (td) => td.textContent
  );
  expect(vers).toEqual(['1', '2', '1', '0']);
});

it('TC-TASK-DESIGN-08: popup nhật ký file — ai đăng ký, ai thực hiện, các bản, ý kiến, diễn biến theo thời gian', async () => {
  window.__setup([task()]);
  window.__response({
    onlyOffice: true,
    nhom: [
      {
        id: 8,
        ten_goc: 'bien-ban.docx',
        ten_ket_qua: 'Biên bản họp hội đồng',
        dinh_dang: 'Word',
        trang_thai: 'can-sua',
        created_at: '2026-09-01T08:00:00Z',
        ten_nguoi_tao: 'Trần Thị Trưởng',
        ty_le: 60,
        // MÁY CHỦ TRẢ `bans` (`taskFiles/service.js doc()`). Đọc nhầm `ban` thì popup luôn báo
        // «Chưa có bản nào» — bản đầu của popup sai đúng chỗ này và fixture sai theo nên không bắt được.
        bans: [
          {
            id: 21,
            version_no: 1,
            ten_goc: 'bien-ban.docx',
            ten_luu: 'a.docx',
            uploaded_at: '2026-09-02T09:00:00Z',
            ten_nguoi_nop: 'Lê Thị Nhân',
          },
          {
            id: 22,
            version_no: 2,
            ten_goc: 'bien-ban-v2.docx',
            ten_luu: 'b.docx',
            uploaded_at: '2026-09-05T10:00:00Z',
            ten_nguoi_nop: 'Lê Thị Nhân',
          },
        ],
        gopY: [
          {
            id: 5,
            version_id: 21,
            ten_nguoi: 'Ngô Văn Phó',
            vai: 'Phó phòng',
            noi_dung: 'Thiếu chữ ký',
            created_at: '2026-09-03T11:00:00Z',
          },
        ],
        luong: [
          {
            id: 1,
            hanh_dong: 'nop',
            ten_nguoi: 'Lê Thị Nhân',
            vai: 'Nhân viên',
            version_id: 21,
            version_no: 1,
            noi_dung: 'Gửi bản 1',
            created_at: '2026-09-02T09:01:00Z',
          },
          {
            id: 2,
            hanh_dong: 'tra-ve-cbo',
            ten_nguoi: 'Ngô Văn Phó',
            vai: 'Phó phòng',
            version_id: 21,
            version_no: 1,
            noi_dung: 'Sửa lại giúp',
            created_at: '2026-09-03T11:05:00Z',
          },
        ],
      },
    ],
  });
  await window.moNhatKyFileKetQua('NV1', 8);
  const hop = document.getElementById('nhat-ky-file-dialog');
  expect(hop).toBeTruthy();
  const txt = hop.textContent;
  // (1) ban đầu ai đăng ký file đấy — ĐỢT 4 BỎ tiêu đề «Ai đăng ký kết quả này», ghi thẳng thành dòng.
  expect(txt).not.toContain('Ai đăng ký kết quả này');
  expect(txt).toContain('1. Trần Thị Trưởng đăng ký lúc');
  expect(txt).toContain('Tên khai báo: Biên bản họp hội đồng · định dạng khai: Word');
  // (2) rồi ai thực hiện — cũng BỎ tiêu đề «Ai thực hiện». Ô lãnh đạo GIỮ NHÃN kể cả khi trống.
  expect(txt).not.toContain('Ai thực hiện');
  expect(txt).toContain('2. Người thực hiện trực tiếp: Lê Thị Nhân');
  expect(txt).toContain('Lãnh đạo phòng phụ trách: Trần Thị Trưởng, Ngô Văn Phó');
  // (3) lịch sử các file + ý kiến mỗi lần — ý kiến nằm ĐÚNG bản của nó, không trộn sang bản khác.
  //     GỘP cả LÝ DO verdict: «Sửa lại giúp» là câu Ngô Văn Phó gõ khi «Trả về Cán bộ», nó nằm ở
  //     `task_file_flow` chứ không ở `task_file_comments` nên trước đợt 4 không hiện trong khối này.
  expect(txt).toContain('3 · Lịch sử các bản và ý kiến từng lần');
  expect(txt).toContain('Bản 2 — sửa lần 1');
  const banMuc = [...hop.querySelectorAll('.nk-ban-muc')];
  expect(banMuc).toHaveLength(2);
  expect(banMuc[0].textContent).toContain('Thiếu chữ ký');
  expect(banMuc[0].textContent).toContain('Sửa lại giúp');
  expect(banMuc[0].textContent).toContain('Trả về Cán bộ');
  expect(banMuc[1].textContent).toContain('Chưa có ý kiến cho bản này.');
  // (4) diễn biến THEO THỜI GIAN: góp ý 11:00 phải đứng TRƯỚC lệnh trả về 11:05 dù bảng luồng
  //     gốc trả về mới nhất trên đầu.
  expect(txt).toContain('4 · Diễn biến theo thời gian');
  const tg = [...hop.querySelectorAll('.nk-dong-thoi-gian li')].map((li) => li.textContent);
  expect(tg).toHaveLength(3);
  expect(tg[0]).toContain('Nộp bản');
  expect(tg[1]).toContain('Góp ý');
  expect(tg[2]).toContain('Trả về Cán bộ');
  // Đóng bằng Escape — hộp này không được bắt người dùng tìm nút.
  // `KeyboardEvent` không có trong globals của eslint cho tests/ — lấy qua `window` của jsdom.
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.getElementById('nhat-ky-file-dialog')).toBeNull();
});

// ─── ĐỢT 4 (2026-09-10) ────────────────────────────────────────────────────────────────────────────
it('TC-TASK-DESIGN-09: màu chữ tên file đổi THEO TIẾN ĐỘ — 100% xanh lá, dưới 20% đỏ', () => {
  // Bốn bậc, hai mốc do người dùng nêu làm biên. Pin cả HÀM lẫn CSS: hàm chọn đúng class mà CSS
  // quên khai màu thì chữ vẫn ra màu mặc định, nhìn không khác gì chưa sửa.
  expect(window.mauTienDoFile(100)).toBe('td-mau-xanh-la');
  expect(window.mauTienDoFile(99)).toBe('td-mau-xanh-duong');
  expect(window.mauTienDoFile(50)).toBe('td-mau-xanh-duong');
  expect(window.mauTienDoFile(49)).toBe('td-mau-cam');
  expect(window.mauTienDoFile(20)).toBe('td-mau-cam');
  expect(window.mauTienDoFile(19)).toBe('td-mau-do');
  expect(window.mauTienDoFile(0)).toBe('td-mau-do');
  // Ngoài khoảng vẫn phải rơi vào một bậc, không được trả rỗng.
  expect(window.mauTienDoFile(-5)).toBe('td-mau-do');
  expect(window.mauTienDoFile(150)).toBe('td-mau-xanh-la');
  expect(window.mauTienDoFile('abc')).toBe('td-mau-do');
  for (const [lop, mau] of [
    ['td-mau-xanh-la', '#16a34a'],
    ['td-mau-xanh-duong', '#2563eb'],
    ['td-mau-cam', '#ea580c'],
    ['td-mau-do', '#dc2626'],
  ]) {
    expect(css).toMatch(new RegExp(`\\.task-file-name\\.${lop}\\s*\\{\\s*color:\\s*${mau}`));
  }
  // Và nó phải thật sự gắn lên tên file trong bảng.
  const t = task();
  t.ketQuaFiles = [
    {
      id: 8,
      ten_ket_qua: 'xong.docx',
      co_ban: true,
      so_ban: 1,
      ty_le: 25,
      tienDo: 100,
      trang_thai: 'da-duyet',
    },
    {
      id: 9,
      ten_ket_qua: 'giua.docx',
      co_ban: true,
      so_ban: 1,
      ty_le: 25,
      tienDo: 60,
      trang_thai: 'cho-xem',
    },
    {
      id: 10,
      ten_ket_qua: 'it.docx',
      co_ban: true,
      so_ban: 1,
      ty_le: 25,
      tienDo: 30,
      trang_thai: 'can-sua',
    },
    {
      id: 11,
      ten_ket_qua: 'chua.docx',
      co_ban: false,
      so_ban: 0,
      ty_le: 25,
      tienDo: 0,
      trang_thai: 'luu-tam',
    },
  ];
  window.__setup([t]);
  window.renderTasks();
  const lop = [...document.querySelectorAll('[data-task-result] .task-file-name')].map((n) =>
    [...n.classList].find((c) => c.startsWith('td-mau-'))
  );
  expect(lop).toEqual(['td-mau-xanh-la', 'td-mau-xanh-duong', 'td-mau-cam', 'td-mau-do']);
});

it('TC-TASK-DESIGN-10: hàng file LÙI VỀ PHẢI, «Kết quả làm được» cạnh icon tệp giấy, người thực hiện CĂN GIỮA, tên nhiệm vụ to hơn 2px', () => {
  window.__setup([task()]);
  window.renderTasks();
  const hangNv = document.querySelector('tr.task-row-chinh');
  const hangFile = document.querySelector('tr[data-task-result]');
  // Ô 1 của hàng file = DẤU NỐI thụt vào + icon tệp giấy + «KẾT QUẢ LÀM ĐƯỢC» (đợt 5 dời vào đây).
  // Chính dấu nối + padding-left làm hàng file lùi phải so với tên nhiệm vụ.
  expect(hangFile.querySelector('td:nth-child(1) .task-file-lui')).toBeTruthy();
  expect(hangFile.querySelector('td:nth-child(1) .task-file-noi').textContent).toBe('└');
  expect(hangFile.querySelector('td:nth-child(1) .task-file-name')).toBeTruthy();
  // Ô 1 của hàng nhiệm vụ KHÔNG có dấu nối đó, và tên nhiệm vụ mang class cỡ chữ riêng.
  expect(hangNv.querySelector('td:nth-child(1) .task-file-lui')).toBeNull();
  expect(hangNv.querySelector('.task-ten-nhiem-vu')).toBeTruthy();
  // Ô «Tên file» của hàng nhiệm vụ để trống có chủ đích (tên file chỉ hàng file mới có).
  expect(hangNv.querySelector('td:nth-child(2)').textContent.trim()).toBe('—');
  // «tên người thực hiện căn giữa ô đi» — cả hàng nhiệm vụ lẫn hàng file, cùng MỘT cột.
  expect(hangNv.querySelector('td:nth-child(3)').classList.contains('c-giua')).toBe(true);
  expect(hangFile.querySelector('td:nth-child(3)').classList.contains('c-giua')).toBe(true);
  expect(hangNv.querySelector('td:nth-child(3)').textContent).toContain('Lê Thị Nhân');
  // «Tên nhiệm vụ sẽ to hơn tên file 02 cỡ chữ» — đọc số THẬT từ CSS, không tin con mắt.
  const lon = Number(css.match(/\.task-ten-nhiem-vu\s*\{\s*font-size:\s*(\d+(?:\.\d+)?)px/)?.[1]);
  const be = Number(css.match(/\.task-file-name\s*\{[^}]*?font-size:\s*(\d+(?:\.\d+)?)px/)?.[1]);
  expect(lon).toBeGreaterThan(0);
  expect(be).toBeGreaterThan(0);
  expect(lon - be).toBe(2);
  // ĐỢT 5 — BẪY FLEX: «Kết quả làm được» nay nằm TRONG khung flex `.task-file-lui`. Flex item mặc
  // định `min-width:auto` nên `text-overflow:ellipsis` KHÔNG BAO GIỜ chạy — nó đẩy rộng khung và tràn
  // sang cột bên. Phải pin `min-width:0`, thiếu nó là tên dài phá bảng mà test khác không bắt được.
  expect(css).toMatch(/\.task-file-lui\s+\.task-file-name\s*\{\s*min-width:\s*0\s*;?\s*\}/);
});

it('TC-TASK-DESIGN-11: bốn thẻ thống kê của tab Nhiệm vụ nằm trên MỘT dòng ở mọi bề rộng', () => {
  // index.html để `grid-cols-2 md:grid-cols-4`: dưới 768px là rớt còn 2 cột = 2 dòng. CSS phải ép
  // 4 cột vô điều kiện. `minmax(0,1fr)` chứ không phải `1fr`: thiếu `minmax(0,…)` thì nhãn dài
  // («Chưa duyệt đủ kết quả») đẩy cột rộng ra và vẫn tràn dòng.
  expect(css).toMatch(
    /#tasks-the-tong-ke\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\s*\)/
  );
  const html = readFileSync('../web/index.html', 'utf8');
  expect(html).toContain('id="tasks-the-tong-ke"');
  // Đúng BỐN thẻ người dùng nêu, không thêm không bớt, và nằm trong cái grid đó.
  const khoi = html.slice(
    html.indexOf('id="tasks-the-tong-ke"'),
    html.indexOf('<div id="tasks-grid"')
  );
  for (const id of [
    'tasks-total-count',
    'tasks-completed-count',
    'tasks-incomplete-count',
    'tasks-overdue-count',
  ]) {
    expect(khoi).toContain(id);
  }
  for (const nhan of ['Tổng số', 'Đã duyệt đủ kết quả', 'Chưa duyệt đủ kết quả', 'Quá hạn']) {
    expect(khoi).toContain(nhan);
  }
  expect(khoi.match(/glass-card p-3 text-center/g) || []).toHaveLength(4);
});

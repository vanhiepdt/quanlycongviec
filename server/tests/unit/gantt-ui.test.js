// @vitest-environment jsdom
//
// Phase 6 phía GIAO DIỆN — cập nhật vòng «Gantt xem theo THÁNG» (2026-08-26):
//   TC-STAT-13: thanh dài hơn khoảng bị CẮT HAI ĐẦU, không mất.
//   TC-STAT-14: việc nằm ngoài hẳn khoảng KHÔNG có thanh (chỉ ghi chú mờ).
//   TC-STAT-15: trạng thái thu gọn sống trong localStorage, tải lại trang vẫn giữ.
//   MỚI — khoảng xem = đầu → cuối THÁNG chọn; icon CV con là thư mục ĐỎ giống cha;
//         chữ cán bộ RỜI KHỎI cạnh tên nhiệm vụ; tooltip thẻ tự vẽ cho tên dòng.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  calculateGanttBarStyleRange, buildGanttCellHtml,
  docTrangThaiThuGon, luuTrangThaiThuGon, doiTrangThaiThuGon,
  datKhoangGanttTheoThang, dongBoOThangNamGantt,
  duLieuHoverGantt, buildGanttHoverCardHtml,
  createGanttSubRowHtml, createGanttTaskRowHtml,
  formatDateForGantt, goiNutHoverGantt,
  __ganttDoc: () => ({ start: ganttStartDate, end: ganttEndDate }),
  __gantt: (ten, giaTri) => { ({ startDate: () => { ganttStartDate = giaTri; },
    endDate: () => { ganttEndDate = giaTri; },
    thuGon: () => { ganttThuGon = giaTri; } })[ten](); },
});`;

function khoiDong() {
  new Function(APP_SRC + EXPORTS)();
}

/** Khoảng xem cố định: 01/03–31/03/2026 để kết quả tính tay được. */
const TU = new Date(2026, 2, 1),
  DEN = new Date(2026, 2, 31),
  SO_NGAY = 31;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  khoiDong();
  window.__gantt('startDate', TU);
  window.__gantt('endDate', DEN);
});

describe('TC-STAT-13 — thanh bị cắt hai đầu, không mất', () => {
  const o = (start, end) =>
    window.buildGanttCellHtml(start, end, TU, DEN, SO_NGAY, 'gantt-bar-task', 'nhãn', 0);

  it('việc vắt qua CẢ HAI đầu ⇒ thanh full width', () => {
    const html = o('2026-02-01', '2026-04-30');
    expect(html).toContain('gantt-bar');
    expect(html).toContain('left: 0');
    expect(html).toContain('width: 100%');
  });

  it('việc bắt đầu TRƯỚC khoảng, kết thúc trong khoảng ⇒ cắt đầu trái (left: 0)', () => {
    const html = o('2026-02-10', '2026-03-15');
    expect(html).toContain('gantt-bar');
    expect(html).toContain('left: 0');
    expect(html).not.toContain('width: 100%');
  });

  it('việc bắt đầu trong khoảng, kết thúc SAU khoảng ⇒ cắt đầu phải (mẫu tháng dài hơn)', () => {
    const html = o('2026-03-20', '2026-04-20');
    expect(html).toContain('gantt-bar');
    expect(html).not.toContain('left: 0;');
    expect(html).not.toContain('width: 100%');
  });

  it('việc nằm trọn trong khoảng ⇒ thanh nguyên vẹn, không cắt', () => {
    const html = o('2026-03-05', '2026-03-10');
    expect(html).toContain('gantt-bar');
    expect(html).not.toContain('left: 0;');
  });
});

describe('TC-STAT-14 — việc ngoài hẳn khoảng thì không có thanh', () => {
  it('trước khoảng và sau khoảng đều chỉ còn ghi chú mờ', () => {
    for (const [bd, kt] of [
      ['2025-12-01', '2026-02-20'],
      ['2026-05-01', '2026-06-30'],
    ]) {
      const html = window.buildGanttCellHtml(bd, kt, TU, DEN, SO_NGAY, 'gantt-bar-task', 'n', 0);
      expect(html, `${bd}..${kt}`).toContain('Không hiển thị trong khoảng này');
      expect(html, `${bd}..${kt}`).not.toContain('gantt-bar ');
    }
  });

  it('thiếu một ngày coi như luôn giao ⇒ vẫn có thanh (khớp luật server TC-STAT-09)', () => {
    expect(
      window.buildGanttCellHtml(null, '2026-03-10', TU, DEN, SO_NGAY, 'gantt-bar-task', 'n', 0)
    ).toContain('gantt-bar');
    expect(
      window.buildGanttCellHtml('2026-03-10', null, TU, DEN, SO_NGAY, 'gantt-bar-task', 'n', 0)
    ).toContain('gantt-bar');
  });
});

describe('TC-STAT-15 — thu gọn lưu localStorage, tải lại trang vẫn giữ', () => {
  it('bấm thu gọn một node ⇒ khoá vào localStorage và đọc lại được sau khi "tải lại"', () => {
    window.doiTrangThaiThuGon('work:CV001');
    expect(window.docTrangThaiThuGon().has('work:CV001')).toBe(true);

    // Mô phỏng tải lại trang: khởi động lại toàn bộ app.js từ đầu.
    khoiDong();
    expect(window.docTrangThaiThuGon().has('work:CV001')).toBe(true);
  });

  it('bấm lần nữa thì mở lại và xoá khỏi localStorage', () => {
    window.doiTrangThaiThuGon('group:dept_1');
    window.doiTrangThaiThuGon('group:dept_1');
    expect(window.docTrangThaiThuGon().has('group:dept_1')).toBe(false);
  });
});

describe('Gantt xem theo THÁNG — khoảng xem là đầu → cuối tháng đã chọn', () => {
  it('đúng ranh giới tháng thường và NĂM NHUẬN (02/2028 có 29/02)', () => {
    window.datKhoangGanttTheoThang(2, 2028);
    const doc = window.__ganttDoc();
    expect(doc.start.getFullYear()).toBe(2028);
    expect(doc.start.getMonth()).toBe(1);
    expect(doc.start.getDate()).toBe(1);
    expect(doc.end.getDate()).toBe(29);
  });

  it('tháng 31 ngày khớp tới ngày cuối cùng', () => {
    window.datKhoangGanttTheoThang(1, 2026);
    expect(window.__ganttDoc().end.getDate()).toBe(31);
  });

  it('tháng/năm sai (13, 0) ⇒ KHÔNG đổi khoảng đang có', () => {
    window.datKhoangGanttTheoThang(2, 2028);
    const truoc = window.__ganttDoc();
    expect(window.datKhoangGanttTheoThang(13, 2028)).toBe(false);
    expect(window.datKhoangGanttTheoThang(6, 1500)).toBe(false);
    expect(window.__ganttDoc().start).toBe(truoc.start);
    expect(window.__ganttDoc().end).toBe(truoc.end);
  });

  it('hai ô Tháng/Năm được nạp option và phản chiếu đúng lựa chọn', () => {
    document.body.innerHTML =
      '<select id="gantt-month-select"></select><select id="gantt-year-select"></select>';
    window.datKhoangGanttTheoThang(9, new Date().getFullYear());
    window.dongBoOThangNamGantt();
    const oThang = document.getElementById('gantt-month-select');
    expect(oThang.options.length).toBe(12);
    expect(String(oThang.value)).toBe('9');
    const oNam = document.getElementById('gantt-year-select');
    const cacNam = Array.from(oNam.options).map((o) => Number(o.value));
    expect(cacNam).toContain(new Date().getFullYear() - 2);
    expect(cacNam).toContain(new Date().getFullYear() + 3);
    expect(Number(oNam.value)).toBe(new Date().getFullYear());
  });
});

/** Dữ liệu mẫu dùng chung: một CV con (2/2026 → 3/2026) chứa MỘT nhiệm vụ trong tháng 3. */
function subMau() {
  const nhiemVu = {
    id: '21',
    code: 'CV001-001',
    level: '3',
    name: 'Vẽ sơ đồ <b>màu</b>',
    startDate: '2026-03-01',
    dueDate: '2026-03-20',
    completion: '70',
    status: 'Đang thực hiện',
    priority: '',
    assigneeName: 'Nguyễn Văn An',
    leaderNames: ['Phó phòng A'],
    output: 'Bản thiết kế PDF',
    children: [],
  };
  return {
    id: '11',
    code: 'CV001-01',
    level: '2',
    name: 'Thiết kế hệ thống',
    startDate: '2026-02-10',
    dueDate: '2026-03-15',
    completion: '40',
    status: 'Đang thực hiện',
    priority: '',
    assigneeName: '',
    leaderNames: ['Trưởng phòng A'],
    output: '',
    children: [nhiemVu],
  };
}

describe('hàng CV con / nhiệm vụ — icon đỏ, mũi tên ngoài cột, bỏ chữ cán bộ cạnh tên', () => {
  it('icon CV con là THƯ MỤC ĐỎ giống công việc cha — hết icon nhánh xanh cũ', () => {
    const html = window.createGanttSubRowHtml(subMau());
    expect(html).toContain('fas fa-folder text-red-500');
    expect(html).not.toContain('fa-code-branch');
  });

  it('mũi tên CV con nằm NGOÀI khối icon+tên (slot trước icon); CV con không con thì slot rỗng', () => {
    const coCon = window.createGanttSubRowHtml(subMau());
    expect(coCon.indexOf('gantt-toggle-slot')).toBeGreaterThan(-1);
    expect(coCon.indexOf('gantt-toggle-slot')).toBeLessThan(coCon.indexOf('fa-folder'));
    expect(coCon).toContain('gantt-node-toggle');
    const khongCon = window.createGanttSubRowHtml({ ...subMau(), children: [] });
    expect(khongCon).toContain('gantt-toggle-slot');
    expect(khongCon).not.toContain('gantt-node-toggle'); // vẫn giữ slot ⇒ các cấp thẳng hàng
  });

  it('CHỮ cán bộ thực hiện rời khỏi cạnh tên nhiệm vụ — chỉ còn trong dữ liệu tooltip', () => {
    const html = window.createGanttTaskRowHtml(subMau().children[0]);
    // Hết span phụ «— Nguyễn Văn An» đứng cạnh tên.
    expect(html).not.toContain('<span class="text-xs text-gray-400 ml-2">');
    // Tên nhiệm vụ mang dữ liệu tooltip (JSON trong thuộc tính, KHÔNG hiển thị ra text).
    expect(html).toContain('gantt-hover-name');
    const json = JSON.parse(
      html
        .match(/data-hover-json="([^"]*)"/)[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
    );
    expect(json.canBo).toBe('Nguyễn Văn An');
    expect(json.ketQuaDauRa).toBe('Bản thiết kế PDF');
  });

  it('tên có HTML nguy hiểm vẫn chỉ là chữ trong cả hàng lẫn JSON tooltip', () => {
    const html = window.createGanttTaskRowHtml(subMau().children[0]);
    expect(html).toContain('&lt;b&gt;màu&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });
});

describe('thẻ tooltip tự vẽ cho tên dòng (yêu cầu #2/#2b)', () => {
  it('nhiệm vụ: đủ Lãnh đạo phòng phụ trách · Cán bộ · Tiến độ · Kết quả đầu ra', () => {
    const d = window.duLieuHoverGantt({
      level: '3',
      name: 'Nhiệm vụ X',
      leaderNames: ['Phó phòng A'],
      assigneeName: 'Trần Thị Bình',
      completion: '25',
      output: 'Hồ sơ .zip',
    });
    const html = window.buildGanttHoverCardHtml(d);
    expect(html).toContain('Lãnh đạo phòng phụ trách');
    expect(html).toContain('Phó phòng A');
    expect(html).toContain('Trần Thị Bình');
    expect(html).toContain('25%');
    expect(html).toContain('Kết quả đầu ra');
    expect(html).toContain('Hồ sơ .zip');
    expect(html).not.toContain('Ban lãnh đạo kiểm soát'); // mức nhiệm vụ không có ô này
  });

  it('công việc: Ban lãnh đạo kiểm soát + gom cán bộ DUY NHẤT từ cây con + tiến độ server', () => {
    const d = window.duLieuHoverGantt({
      name: 'Ra mắt cổng',
      endDate: '2026-03-31',
      progress: '50',
      supervisorName: 'Phó GĐ Một',
      leaderNames: ['Trưởng phòng A', 'Phó phòng A'],
      tasks: [{ assigneeName: 'An' }, { assigneeName: 'An' }, { assigneeName: 'Bình' }],
      subs: [],
    });
    const html = window.buildGanttHoverCardHtml(d);
    expect(html).toContain('Ban lãnh đạo kiểm soát');
    expect(html).toContain('Phó GĐ Một');
    expect(html).toContain('Trưởng phòng A, Phó phòng A');
    expect(html).toContain('An, Bình'); // trùng lặp bị gom
    expect(html).toContain('50%');
    expect(html).not.toContain('Kết quả đầu ra');
  });

  it('giá trị người nhập qua escapeHtml — không sinh thẻ thật trong tooltip', () => {
    const html = window.buildGanttHoverCardHtml(
      window.duLieuHoverGantt({
        level: '3',
        name: '<img src=x onerror=alert(1)>tên',
        leaderNames: [],
        assigneeName: '<script>',
        completion: '0',
        output: '',
      })
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img ');
  });

  it('dữ liệu thiếu (null/rỗng) không nổ: các dòng trống in gạch ngang', () => {
    const html = window.buildGanttHoverCardHtml(
      window.duLieuHoverGantt({
        level: '2',
        name: '',
        leaderNames: [],
        assigneeName: '',
        completion: null,
        output: '',
      })
    );
    expect(html).toContain('Công việc con');
    expect(html.match(/—/g).length).toBeGreaterThanOrEqual(3);
  });
});

describe('tooltip gắn SỰ KIỆN THẬT — rê chuột hiện thẻ, rời chuột ẩn', () => {
  it('mouseover lên tên ⇒ #tooltip-gantt display:block đủ nội dung; mouseout ⇒ ẩn', () => {
    document.body.innerHTML = '<div id="gantt-items"></div>';
    window.goiNutHoverGantt();
    const vung = document.getElementById('gantt-items');
    vung.innerHTML = window.createGanttTaskRowHtml(subMau().children[0]);
    const tenEl = vung.querySelector('.gantt-hover-name');
    const bungSuKien = (loai, init) =>
      new MouseEvent(loai, { bubbles: true, cancelable: true, ...init });
    tenEl.dispatchEvent(bungSuKien('mouseover', { clientX: 120, clientY: 80 }));
    const the = document.getElementById('tooltip-gantt');
    expect(the).toBeTruthy();
    expect(the.style.display).toBe('block');
    expect(the.textContent).toContain('Nhiệm vụ');
    expect(the.textContent).toContain('Vẽ sơ đồ');
    expect(the.textContent).toContain('Kết quả đầu ra');
    expect(the.textContent).toContain('70%');
    tenEl.dispatchEvent(bungSuKien('mouseout'));
    expect(the.style.display).toBe('none');
  });

  it('gọi goiNutHoverGantt nhiều lần vẫn chỉ gắn MỘT bộ listener (không nhân đôi thẻ)', () => {
    document.body.innerHTML = '<div id="gantt-items"></div>';
    window.goiNutHoverGantt();
    window.goiNutHoverGantt();
    const vung = document.getElementById('gantt-items');
    vung.innerHTML = window.createGanttTaskRowHtml(subMau().children[0]);
    vung
      .querySelector('.gantt-hover-name')
      .dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelectorAll('#tooltip-gantt').length).toBe(1);
  });
});

describe('formatDateForGantt — ngày «lăn» (30/02…) không được in ra nhãn', () => {
  it('ngày vô lý ⇒ rỗng; ngày thật vẫn dd/mm; thiếu ⇒ rỗng', () => {
    expect(window.formatDateForGantt('30/02/2026')).toBe('');
    expect(window.formatDateForGantt('2026-02-30')).toBe('');
    expect(window.formatDateForGantt('2026-03-05')).toBe('05/03');
    expect(window.formatDateForGantt('5/3/2026')).toBe('05/03');
    expect(window.formatDateForGantt('31/04/2026')).toBe('');
    expect(window.formatDateForGantt(null)).toBe('');
    expect(window.formatDateForGantt('')).toBe('');
  });

  it('nhãn thanh KHÔNG còn dấu "-" treo khi một đầu ngày vô hạn (lỗi 30/02 trong ảnh chụp)', () => {
    const html = window.createGanttSubRowHtml({
      ...subMau(),
      startDate: '2026-02-10',
      dueDate: '30/02/2026',
    });
    expect(html).not.toContain('30/02');
    expect(html).not.toContain(' - : ');
    expect(html).toContain('10/02: Thiết kế hệ thống');
  });
});

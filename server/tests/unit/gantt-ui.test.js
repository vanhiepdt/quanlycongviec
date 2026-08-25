// @vitest-environment jsdom
//
// Phase 6 phía GIAO DIỆN — ba phép kiểm chốt của nhóm F không chạy được trên máy chủ:
//   TC-STAT-13: thanh dài hơn khoảng bị CẮT HAI ĐẦU, không mất.
//   TC-STAT-14: việc nằm ngoài hẳn khoảng KHÔNG có thanh (chỉ ghi chú mờ).
//   TC-STAT-15: trạng thái thu gọn sống trong localStorage, tải lại trang vẫn giữ.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  calculateGanttBarStyleRange, buildGanttCellHtml,
  docTrangThaiThuGon, luuTrangThaiThuGon, doiTrangThaiThuGon, datKhoangThangGantt,
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

  it('việc bắt đầu trong khoảng, kết thúc SAU khoảng ⇒ cắt đầu phải', () => {
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

  it('độ rộng 1/2/3 tháng: kết thúc = bắt đầu + n×30 − 1; ngoài miền thì kẹp biên', () => {
    window.__gantt('startDate', new Date(2026, 7, 25));
    window.datKhoangThangGantt(3);
    expect(window.__ganttDoc().end - window.__ganttDoc().start).toBe(89 * 86400000);
    window.datKhoangThangGantt(2);
    expect(window.__ganttDoc().end - window.__ganttDoc().start).toBe(59 * 86400000);
    window.datKhoangThangGantt(1);
    expect(window.__ganttDoc().end - window.__ganttDoc().start).toBe(29 * 86400000);
    window.datKhoangThangGantt(99);
    expect(window.__ganttDoc().end - window.__ganttDoc().start).toBe(89 * 86400000);
  });
});

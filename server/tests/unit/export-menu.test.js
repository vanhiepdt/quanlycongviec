// @vitest-environment jsdom
//
// Menu «Xuất Excel» trên thanh tiêu đề (§7 việc 7.5, UAT R12). Chạy app.js THẬT trong jsdom.
//
// Ba điều test này canh:
//  1. Liên kết trỏ đúng ba đường REST `/api/v1/export/*.xlsx` — sai đường là người dùng bấm ra 404.
//  2. Bộ lọc tháng đang bật thì được gắn vào URL, để số dòng trong file khớp số mục trên màn hình:
//     mẫu công việc/nhiệm vụ nhận `?month=`, mẫu thống kê nhận khoảng `?from=&to=` (hai API nhận
//     hai kiểu tham số khác nhau — nhầm là bộ lọc bị bỏ im lặng).
//  3. KHÔNG có tham số phạm vi nào (phòng, người, vai) trong URL. Phạm vi là việc của máy chủ
//     (việc 7.6); một tham số phòng ở đây sẽ là đường mời người dùng tự sửa URL để đòi phòng khác.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  capNhatLinkXuatExcel, cuoiThangCua, XUAT_EXCEL_LINK,
});`;

function khoiDong() {
  document.body.innerHTML = `
    <input type="month" id="projects-month-filter" value="">
    <a href="/api/v1/export/works.xlsx" id="export-works"></a>
    <a href="/api/v1/export/tasks.xlsx" id="export-tasks"></a>
    <a href="/api/v1/export/stats.xlsx" id="export-stats"></a>`;
  new Function(APP_SRC + EXPORTS)();
}

/** `getAttribute` chứ không `.href`: jsdom nở `.href` thành URL tuyệt đối, khó so bằng mắt. */
const link = (id) => document.getElementById(id).getAttribute('href');

const datThang = (v) => {
  document.getElementById('projects-month-filter').value = v;
};

beforeEach(() => {
  khoiDong();
});

describe('capNhatLinkXuatExcel — 3 liên kết xuất Excel (việc 7.5)', () => {
  it('không lọc tháng: URL trơn, không tham số nào', () => {
    window.capNhatLinkXuatExcel();
    expect(link('export-works')).toBe('/api/v1/export/works.xlsx');
    expect(link('export-tasks')).toBe('/api/v1/export/tasks.xlsx');
    expect(link('export-stats')).toBe('/api/v1/export/stats.xlsx');
  });

  it('lọc tháng: works/tasks nhận ?month=, stats nhận khoảng from–to', () => {
    datThang('2026-03');
    window.capNhatLinkXuatExcel();
    expect(link('export-works')).toBe('/api/v1/export/works.xlsx?month=2026-03');
    expect(link('export-tasks')).toBe('/api/v1/export/tasks.xlsx?month=2026-03');
    expect(link('export-stats')).toBe('/api/v1/export/stats.xlsx?from=2026-03-01&to=2026-03-31');
  });

  it('ngày cuối tháng tính đúng cả tháng 2 năm nhuận và tháng 30 ngày', () => {
    expect(window.cuoiThangCua('2026-02')).toBe('2026-02-28');
    expect(window.cuoiThangCua('2024-02')).toBe('2024-02-29');
    expect(window.cuoiThangCua('2026-04')).toBe('2026-04-30');
    expect(window.cuoiThangCua('2026-12')).toBe('2026-12-31');
  });

  it('bỏ lọc tháng thì URL trở lại trơn, không giữ tham số cũ', () => {
    datThang('2026-03');
    window.capNhatLinkXuatExcel();
    datThang('');
    window.capNhatLinkXuatExcel();
    expect(link('export-works')).toBe('/api/v1/export/works.xlsx');
    expect(link('export-stats')).toBe('/api/v1/export/stats.xlsx');
  });

  it('URL KHÔNG chứa tham số phạm vi — phạm vi do máy chủ quyết (việc 7.6)', () => {
    datThang('2026-03');
    window.capNhatLinkXuatExcel();
    for (const id of Object.keys(window.XUAT_EXCEL_LINK)) {
      const url = document.getElementById(id).getAttribute('href');
      for (const cam of ['department', 'phong', 'user', 'role', 'assignee', 'all']) {
        expect(url.toLowerCase()).not.toContain(cam);
      }
    }
  });

  it('thiếu thẻ liên kết (trang chưa nạp xong) thì không nổ', () => {
    document.getElementById('export-stats').remove();
    expect(() => window.capNhatLinkXuatExcel()).not.toThrow();
    expect(link('export-works')).toBe('/api/v1/export/works.xlsx');
  });

  it('ba mã mẫu khớp đúng tên ba đường REST của máy chủ', () => {
    expect(window.XUAT_EXCEL_LINK).toEqual({
      'export-works': 'works',
      'export-tasks': 'tasks',
      'export-stats': 'stats',
    });
  });
});

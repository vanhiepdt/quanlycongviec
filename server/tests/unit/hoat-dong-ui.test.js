// @vitest-environment jsdom
//
// «Hoạt động gần đây» ở trang Tổng quan (TC-HD-01..06, 2026-08-29):
//  - hành động ra NHÃN tiếng Việt + icon (bản đồ NHAT_KY_HANH_DONG dùng chung với tab Nhật ký);
//  - hết dòng rác "{}" và hết mã «CV003 — …» trong mô tả tên theo tháng;
//  - hành động lạ vẫn hiện nguyên tên, mọi chuỗi đều thoát HTML.
// Test chạy app.js THẬT trong jsdom (mẫu nhat-ky-ui.test.js), `fetch` giả. Quy ước gọi hàm đã
// xuất qua `window.` — eslint chỉ mở global trình duyệt cho nhóm file này.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL,
  renderActivity, hoatDongSangLegacy, moTaChiTietHoatDong, nhanHanhDongNhatKy, nhanThangVN,
});`;

function khoiDung() {
  new Function(APP_SRC + EXPORTS)();
}

/** Một dòng hoạt động như giao diện nhận được (khoá COL.A_*). */
const dong = (over = {}) => ({
  [window.COL.A_ACTION]: 'works.setMonthName',
  [window.COL.A_DETAILS]: 'Quyết toán Q3 · Tháng 8/2026 · tên mới: Tháng 8',
  [window.COL.A_USER]: 'Phó GD Một',
  [window.COL.A_TIME]: '2026-08-29T05:00:00.000Z',
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = '<div id="recent-activity"></div>';
  window.fetch = vi.fn();
  khoiDung();
});

describe('TC-HD — «Hoạt động gần đây» đọc được bằng tiếng Việt', () => {
  it('TC-HD-01: works.setMonthName → nhãn «Đặt tên theo tháng» + icon, KHÔNG còn chữ action thô', () => {
    window.renderActivity([dong()]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).toContain('Đặt tên theo tháng');
    expect(html).toContain('fa-calendar-day');
    expect(html).not.toContain('works.setMonthName');
  });

  it('TC-HD-02: mô tả rỗng ⇒ bỏ hẳn dòng phụ (hết "{}"); người + giờ vẫn hiện', () => {
    window.renderActivity([dong({ [window.COL.A_DETAILS]: '' })]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).not.toContain('{}');
    expect(html).not.toContain('text-gray-600 mt-1');
    expect(html).toContain('Phó GD Một');
    expect(html).toContain('•');
  });

  it('TC-HD-03: hành động lạ giữ nguyên tên nhưng vẫn thoát HTML', () => {
    window.renderActivity([dong({ [window.COL.A_ACTION]: 'xu.lang<script>alert(1)</script>' })]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('xu.lang');
  });

  it('TC-HD-04: hoatDongSangLegacy — details {} ⇒ rỗng; tháng ⇒ tên đầu việc + Tháng n/YYYY, hết mã', () => {
    const rows = window.hoatDongSangLegacy([
      {
        created_at: '2026-08-29T05:00:00.000Z',
        action: 'works.setMonthName',
        actor_name: 'Phó GD Một',
        details: {},
      },
      {
        created_at: '2026-08-29T05:00:00.000Z',
        action: 'works.setMonthName',
        actor_name: 'Phó GD Một',
        details: {
          code: 'CV003',
          workName: 'Quyết toán Q3',
          month: '2026-08',
          name: 'Tháng 8',
          previousName: '',
        },
      },
    ]);
    expect(rows[0][window.COL.A_DETAILS]).toBe('');
    expect(rows[1][window.COL.A_DETAILS]).toContain('Quyết toán Q3');
    expect(rows[1][window.COL.A_DETAILS]).toContain('Tháng 8/2026');
    expect(rows[1][window.COL.A_DETAILS]).toContain('tên mới: Tháng 8');
    expect(rows[1][window.COL.A_DETAILS]).not.toContain('CV003');
  });

  it('TC-HD-05: details.changes ⇒ «Cập nhật N trường» với nhãn cột tiếng Việt', () => {
    const moTa = window.moTaChiTietHoatDong({
      code: 'CV003',
      changes: { status: { from: 'a', to: 'b' }, completion: { from: '10', to: '90' } },
    });
    expect(moTa).toBe('Cập nhật 2 trường: Trạng thái, Hoàn thành (%)');
  });

  it('TC-HD-06: có code + name ⇒ chỉ hiện TÊN (bỏ mã); chỉ có code ⇒ fallback mã', () => {
    expect(window.moTaChiTietHoatDong({ code: 'CV001', name: 'Nâng cấp hệ thống' })).toBe(
      'Nâng cấp hệ thống'
    );
    expect(window.moTaChiTietHoatDong({ code: 'CV001' })).toBe('CV001');
  });
});

// @vitest-environment jsdom
//
// TC-NAV — mục «Hàng chờ phê duyệt» trên thanh điều hướng (2026-09-03).
//
// Người dùng báo: «Giám đốc phó giám đốc không thấy hàng chờ phê duyệt». Nguyên nhân: lời gọi
// `capNhatNavChoDuyet()` nằm TRONG nhánh «đổi vai TP/PP/Phó GĐ» của `loadDepartmentContext`, nên
// admin không bao giờ chạy tới và mục nằm im với class `hidden` của HTML.
//
// Test này chạy app.js THẬT trong jsdom, gọi thẳng `capNhatNavChoDuyet()` cho 5 vai và canh:
//   • admin + Phó Giám đốc + TP/PP  ⇒ mục MỞ (bỏ class hidden);
//   • Nhân viên                     ⇒ mục vẫn ẩn (họ không có cửa duyệt nào);
//   • badge = số dòng REST trả về, và 0 thì badge ẩn.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  capNhatNavChoDuyet, laNguoiDuyetHeThong,
  __nav: (u) => { currentUser = u; isAuthenticated = !!u; },
});`;

/** Thanh điều hướng tối giản — giữ NGUYÊN class `hidden` như web/index.html. */
function khoiDong(traVe = {}) {
  document.body.innerHTML = `
    <a id="nav-cho-duyet" class="nav-link hidden">
      <span id="nav-cho-duyet-badge" class="hidden">0</span>
    </a>`;
  const goi = [];
  window.fetch = (url) => {
    goi.push(String(url));
    const duong = String(url);
    const than = duong.includes('/task-files/cho-duyet')
      ? { items: traVe.ketQua ?? [] }
      : { total: traVe.viec ?? 0 };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, data: than }),
    });
  };
  new Function(APP_SRC + EXPORTS)();
  return goi;
}

const NAV = () => document.getElementById('nav-cho-duyet');
const BADGE = () => document.getElementById('nav-cho-duyet-badge');

beforeEach(() => {
  khoiDong();
});

describe('TC-NAV — mục «Hàng chờ phê duyệt» mở cho MỌI vai có cửa duyệt', () => {
  it('TC-NAV-01: Giám đốc (admin) thấy mục — lỗi người dùng báo 2026-09-03', async () => {
    khoiDong({ ketQua: [{ id: 1 }, { id: 2 }], viec: 3 });
    window.__nav({ id: 1, name: 'Giám đốc', role: 'admin' });
    await window.capNhatNavChoDuyet();
    expect(NAV().classList.contains('hidden')).toBe(false);
    // admin đếm CẢ hai hàng chờ: 2 file + 3 việc.
    expect(BADGE().textContent).toBe('5');
    expect(BADGE().classList.contains('hidden')).toBe(false);
  });

  it('TC-NAV-02: Phó Giám đốc thấy mục và cũng cộng cả hai hàng chờ', async () => {
    khoiDong({ ketQua: [{ id: 9 }], viec: 4 });
    window.__nav({ id: 2, name: 'Phó GĐ', role: 'Phó Giám đốc' });
    await window.capNhatNavChoDuyet();
    expect(NAV().classList.contains('hidden')).toBe(false);
    expect(BADGE().textContent).toBe('5');
  });

  it('TC-NAV-03: TP/PP thấy mục, badge CHỈ đếm file (họ không duyệt cây công việc)', async () => {
    for (const vai of ['Trưởng phòng', 'Phó phòng']) {
      const goi = khoiDong({ ketQua: [{ id: 1 }, { id: 2 }, { id: 3 }], viec: 99 });
      window.__nav({ id: 3, name: 'Trưởng phòng', role: vai });
      await window.capNhatNavChoDuyet();
      expect(NAV().classList.contains('hidden')).toBe(false);
      expect(BADGE().textContent).toBe('3');
      expect(goi.some((u) => u.includes('/approvals/pending-count'))).toBe(false);
    }
  });

  it('TC-NAV-04: Nhân viên KHÔNG thấy mục và không gọi REST nào', async () => {
    const goi = khoiDong({ ketQua: [{ id: 1 }] });
    window.__nav({ id: 4, name: 'Cán bộ', role: 'Nhân viên' });
    await window.capNhatNavChoDuyet();
    expect(NAV().classList.contains('hidden')).toBe(true);
    expect(goi.length).toBe(0);
  });

  it('TC-NAV-05: hàng chờ rỗng ⇒ mục vẫn mở nhưng badge ẩn', async () => {
    khoiDong({ ketQua: [], viec: 0 });
    window.__nav({ id: 3, name: 'Trưởng phòng', role: 'Trưởng phòng' });
    await window.capNhatNavChoDuyet();
    expect(NAV().classList.contains('hidden')).toBe(false);
    expect(BADGE().classList.contains('hidden')).toBe(true);
  });

  it('TC-NAV-06: chưa đăng nhập ⇒ không đụng gì (mục giữ nguyên hidden của HTML)', async () => {
    const goi = khoiDong({ ketQua: [{ id: 1 }] });
    window.__nav(null);
    await window.capNhatNavChoDuyet();
    expect(NAV().classList.contains('hidden')).toBe(true);
    expect(goi.length).toBe(0);
  });

  it('TC-NAV-07: lời gọi nằm NGOÀI nhánh «đổi vai» của loadDepartmentContext', () => {
    // Canh bằng nguồn: khối try/catch mới phải ở sau khi nhánh vai đóng lại, nếu ai đó gộp lại
    // vào trong `if (doiVai)` thì lỗi 2026-09-03 quay lại mà mọi test hành vi trên vẫn xanh.
    const viTri = APP_SRC.indexOf('function loadDepartmentContext');
    const doan = APP_SRC.slice(viTri, viTri + 4000);
    const soLan = (doan.match(/capNhatNavChoDuyet\(\)/g) || []).length;
    expect(soLan).toBeGreaterThanOrEqual(2);
    expect(doan).toContain('Không cập nhật được mục Hàng chờ phê duyệt');
  });
});

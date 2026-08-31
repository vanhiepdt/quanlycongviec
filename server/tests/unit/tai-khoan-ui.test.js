// @vitest-environment jsdom
//
// TC-TK: trang «Quản lý tài khoản» (2026-08-28).
//
// Yêu cầu người dùng: «thêm trang quản lý tài khoản nữa, có thông tin tài khoản, cho phép
// đổi mật khẩu trong trang này». Bốn điều test này canh:
//  1. Chỉ hiện thông tin của CHÍNH người đang đăng nhập, KHÔNG có mật khẩu/băm mật khẩu.
//  2. Mọi giá trị đi qua escapeHtml — tên cán bộ do admin nhập, có thể chứa thẻ.
//  3. Form đổi mật khẩu gọi ĐÚNG `changePassword(cũ, mới, nhắc lại)` — vẫn là đường cũ,
//     máy chủ vẫn bắt buộc mật khẩu hiện tại.
//  4. Chặn sớm mấy lỗi rõ ràng (thiếu ô, ngắn hơn 6, nhắc lại lệch, mới trùng cũ) mà KHÔNG
//     gọi máy chủ; và mật khẩu hiện tại không bị .trim() (dấu cách là phần của mật khẩu).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, renderTrangTaiKhoan, setupTrangTaiKhoan, buildTaiKhoanDong, tenPhongTaiKhoan,
  hienLoiTaiKhoan, hienOkTaiKhoan, buildBangPhanQuyenHtml, veBangPhanQuyen,
  chiSoGhiDe,
  __tk: (ten, giaTri) => {
    ({
      currentUser: () => { currentUser = giaTri; },
      isAuthenticated: () => { isAuthenticated = giaTri; },
      allDepartments: () => { allDepartments = giaTri; },
      myDepartment: () => { myDepartment = giaTri; },
      myDeptRole: () => { myDeptRole = giaTri; },
      uyQuyenNhan: () => { uyQuyenNhan = giaTri; },
    })[ten]();
  },
});`;

const HTML = `
  <div id="account-info"></div>
  <div id="account-permission-table"></div>
  <form id="account-password-form">
    <div id="account-password-error" class="hidden"></div>
    <div id="account-password-ok" class="hidden"></div>
    <input type="password" id="account-current-password" name="currentPassword">
    <input type="password" id="account-new-password" name="newPassword">
    <input type="password" id="account-confirm-password" name="confirmPassword">
    <button type="submit" id="account-password-submit">Cập nhật mật khẩu</button>
  </form>
  <button id="account-refresh-btn"></button>
  <div id="toast-container"></div>`;

let goiChangePassword;

function khoiDong() {
  document.body.innerHTML = HTML;
  goiChangePassword = vi.fn();
  const chain = {
    withSuccessHandler(fn) {
      chain._ok = fn;
      return chain;
    },
    withFailureHandler(fn) {
      chain._fail = fn;
      return chain;
    },
    changePassword(...args) {
      goiChangePassword(...args);
      chain._daGoi = args;
    },
  };
  window.google = { script: { run: chain } };
  window.__chain = chain;
  new Function(APP_SRC + EXPORTS)();
  window.__tk('isAuthenticated', true);
  window.__tk('uyQuyenNhan', []);
  window.__tk('myDepartment', '');
  window.__tk('myDeptRole', '');
  window.__tk('allDepartments', [{ 'ID phòng (DB)': 7, 'Tên phòng': 'Phòng Kế hoạch' }]);
  window.__tk('currentUser', {
    name: 'Nguyễn Văn A',
    code: 'CB007',
    email: 'a@example.com',
    position: 'Chuyên viên',
    role: 'Nhân viên',
    department_id: 7,
    dept_role: 'Cán bộ',
    object_type: 'Người dùng',
    is_active: true,
  });
  window.setupTrangTaiKhoan();
}

const guiForm = () => {
  document
    .getElementById('account-password-form')
    .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
};

const dienMatKhau = (cu, moi, nhacLai) => {
  document.getElementById('account-current-password').value = cu;
  document.getElementById('account-new-password').value = moi;
  document.getElementById('account-confirm-password').value = nhacLai;
};

const loi = () => document.getElementById('account-password-error').textContent;

beforeEach(() => {
  khoiDong();
});

describe('TC-TK — thông tin tài khoản', () => {
  it('hiện đủ các trường của chính mình, phòng lấy theo department_id', () => {
    window.renderTrangTaiKhoan();
    const text = document.getElementById('account-info').textContent;
    expect(text).toContain('Nguyễn Văn A');
    expect(text).toContain('CB007');
    expect(text).toContain('a@example.com');
    expect(text).toContain('Chuyên viên');
    expect(text).toContain('Phòng Kế hoạch');
    expect(text).toContain('Đang hoạt động');
  });

  it('vai «Nhân viên» hiện là «Cán bộ», vai «admin» hiện là «Giám đốc»', () => {
    window.renderTrangTaiKhoan();
    expect(document.getElementById('account-info').textContent).toContain('Cán bộ');
    window.__tk('currentUser', { name: 'GĐ', role: 'admin' });
    window.renderTrangTaiKhoan();
    expect(document.getElementById('account-info').textContent).toContain('Giám đốc');
  });

  it('KHÔNG in mật khẩu hay băm mật khẩu ra trang', () => {
    window.__tk('currentUser', {
      name: 'Nguyễn Văn A',
      role: 'Nhân viên',
      password: 'bimat123',
      password_hash: '$2b$10$abcdef',
    });
    window.renderTrangTaiKhoan();
    const html = document.getElementById('account-info').innerHTML;
    expect(html).not.toContain('bimat123');
    expect(html).not.toContain('$2b$10$');
  });

  it('tên có thẻ HTML bị thoát, không chạy thành thẻ', () => {
    window.__tk('currentUser', {
      name: '<img src=x onerror=alert(1)>',
      role: 'Nhân viên',
      email: '"><script>alert(2)</script>',
    });
    window.renderTrangTaiKhoan();
    const el = document.getElementById('account-info');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('trường trống hiện dấu «—» chứ không hiện undefined', () => {
    window.__tk('currentUser', { name: 'Nguyễn Văn A', role: 'Nhân viên' });
    window.__tk('allDepartments', []);
    window.renderTrangTaiKhoan();
    const text = document.getElementById('account-info').textContent;
    expect(text).not.toContain('undefined');
    expect(text).toContain('—');
  });

  it('chưa đăng nhập thì nhắc đăng nhập, không nổ', () => {
    window.__tk('isAuthenticated', false);
    expect(() => window.renderTrangTaiKhoan()).not.toThrow();
    expect(document.getElementById('account-info').textContent).toContain('đăng nhập');
  });

  it('đang mượn quyền thì ghi rõ mượn của ai, đến ngày nào', () => {
    window.__tk('uyQuyenNhan', [{ from_user_name: 'Trần B', to_date: '2026-09-30' }]);
    window.renderTrangTaiKhoan();
    const text = document.getElementById('account-info').textContent;
    expect(text).toContain('Trần B');
    expect(text).toContain('30/09/2026');
  });

  it('myDepartment (bối cảnh phòng) được ưu tiên hơn department_id', () => {
    window.__tk('myDepartment', 'Phòng Kỹ thuật');
    expect(window.tenPhongTaiKhoan()).toBe('Phòng Kỹ thuật');
  });

  it('nút «Tải lại» vẽ lại thông tin', () => {
    document.getElementById('account-info').innerHTML = '';
    document.getElementById('account-refresh-btn').click();
    expect(document.getElementById('account-info').textContent).toContain('Nguyễn Văn A');
  });
});

describe('TC-TK — đổi mật khẩu ngay trong trang', () => {
  it('gửi đúng ba tham số theo thứ tự (cũ, mới, nhắc lại)', () => {
    dienMatKhau('cu123456', 'moi123456', 'moi123456');
    guiForm();
    expect(goiChangePassword).toHaveBeenCalledWith('cu123456', 'moi123456', 'moi123456');
  });

  it('mật khẩu hiện tại KHÔNG bị .trim() — dấu cách là phần của mật khẩu', () => {
    dienMatKhau(' cu 123 ', 'moi123456', 'moi123456');
    guiForm();
    expect(goiChangePassword).toHaveBeenCalledWith(' cu 123 ', 'moi123456', 'moi123456');
  });

  it('thiếu ô / ngắn hơn 6 / nhắc lại lệch / mới trùng cũ: báo lỗi và KHÔNG gọi máy chủ', () => {
    const truongHop = [
      ['', 'moi123456', 'moi123456', 'đủ ba ô'],
      ['cu123456', 'abc', 'abc', 'ít nhất 6'],
      ['cu123456', 'moi123456', 'moi12345', 'không giống nhau'],
      ['cu123456', 'cu123456', 'cu123456', 'khác mật khẩu hiện tại'],
    ];
    for (const [cu, moi, nhacLai, mong] of truongHop) {
      dienMatKhau(cu, moi, nhacLai);
      guiForm();
      expect(loi()).toContain(mong);
    }
    expect(goiChangePassword).not.toHaveBeenCalled();
  });

  it('máy chủ trả success: xoá form, hiện dòng xác nhận', () => {
    dienMatKhau('cu123456', 'moi123456', 'moi123456');
    guiForm();
    window.__chain._ok({ success: true, message: 'Đã đổi mật khẩu' });
    expect(document.getElementById('account-current-password').value).toBe('');
    expect(document.getElementById('account-password-ok').textContent).toContain('Đã đổi mật khẩu');
    expect(document.getElementById('account-password-ok').classList.contains('hidden')).toBe(false);
  });

  it('máy chủ từ chối: hiện đúng lời máy chủ, không xoá form', () => {
    dienMatKhau('sai', 'moi123456', 'moi123456');
    guiForm();
    window.__chain._ok({ success: false, error: 'Mật khẩu hiện tại không đúng' });
    expect(loi()).toBe('Mật khẩu hiện tại không đúng');
    expect(document.getElementById('account-new-password').value).toBe('moi123456');
  });

  it('lỗi mạng: hiện lỗi, không treo nút bấm', () => {
    dienMatKhau('cu123456', 'moi123456', 'moi123456');
    guiForm();
    window.__chain._fail({ message: 'HTTP 500' });
    expect(loi()).toContain('HTTP 500');
    expect(document.getElementById('account-password-submit').disabled).toBe(false);
  });

  it('nối form hai lần không gửi hai lần', () => {
    window.setupTrangTaiKhoan();
    dienMatKhau('cu123456', 'moi123456', 'moi123456');
    guiForm();
    expect(goiChangePassword).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------------------------------------
// TC-TKPQ (2026-08-29): BẢNG PHÂN QUYỀN HỆ THỐNG ở trang Quản lý tài khoản.
// Yêu cầu người dùng: «làm lại bảng Phân quyền hệ thống — ghi rõ mỗi chức năng của từng đối
// tượng, được làm gì, làm gì nhưng phải được người khác duyệt». Bảng là HẰNG dữ liệu khớp
// PERMISSIONS/inScope + trangThaiDuyetKhiTao phía máy chủ; test canh các ô then chốt.
// ------------------------------------------------------------------------------------------
describe('TC-TKPQ — bảng Phân quyền hệ thống (động, Vòng 10)', () => {
  const MAC_DINH = {
    'Phó Giám đốc': {
      work: ['read', 'create', 'update', 'delete', 'approve'],
      subwork: ['read', 'create', 'update', 'delete', 'approve'],
      task: ['read', 'create', 'update', 'delete'],
    },
    'Trưởng phòng': {
      work: ['read', 'create', 'update', 'delete'],
      subwork: ['read', 'create', 'update', 'delete'],
      task: ['read', 'create', 'update', 'delete'],
    },
    'Phó phòng': {
      work: ['read', 'create', 'update', 'delete'],
      subwork: ['read', 'create', 'update', 'delete'],
      task: ['read', 'create', 'update', 'delete'],
    },
    'Nhân viên': {
      work: ['read'],
      subwork: ['read'],
      task: ['read', 'create', 'update', 'delete'],
    },
  };
  const ghiDeRong = {};

  it('TC-TKPQ-01: 5 vai nghiệp vụ — ĐÃ BỎ «Quản lý công việc»; có cột Giám đốc', () => {
    const bang = window.buildBangPhanQuyenHtml(ghiDeRong, MAC_DINH, false);
    expect(bang).toContain('Giám đốc (admin)');
    expect(bang).toContain('Phó Giám đốc');
    expect(bang).toContain('Trưởng phòng');
    expect(bang).toContain('Phó phòng');
    expect(bang).toContain('Cán bộ');
    expect(bang).not.toContain('Quản lý công việc');
  });

  it('TC-TKPQ-02: không ghi đè — TP Tạo Công việc hiện ⏳ (chờ Phó GĐ duyệt) theo luật gốc', () => {
    const bang = window.buildBangPhanQuyenHtml(ghiDeRong, MAC_DINH, false);
    expect(bang).toContain('⏳');
    expect(bang).toContain('chờ Phó GĐ duyệt');
  });

  it('TC-TKPQ-03: ghi đè «cho-duyet» cho Phó GĐ ⇒ hiện ⏳ + «Ghi đè»', () => {
    const ghiDe = { 'work:create': { 'Phó Giám đốc': { gia_tri: 'cho-duyet', pham_vi: 'phong' } } };
    const bang = window.buildBangPhanQuyenHtml(ghiDe, MAC_DINH, false);
    expect(bang).toContain('Ghi đè: chờ Phó GĐ duyệt');
  });

  it('TC-TKPQ-04: ghi đè «tu-choi» tắt quyền của Trưởng phòng', () => {
    const ghiDe = { 'work:update': { 'Trưởng phòng': { gia_tri: 'tu-choi', pham_vi: 'phong' } } };
    const bang = window.buildBangPhanQuyenHtml(ghiDe, MAC_DINH, false);
    expect(bang).toContain('Ghi đè: đã tắt');
  });

  it('TC-TKPQ-05: ghi đè phạm vi «tat-ca» hiện «TẤT CẢ các phòng»', () => {
    const ghiDe = { 'work:update': { 'Trưởng phòng': { gia_tri: 'cho-phep', pham_vi: 'tat-ca' } } };
    const bang = window.buildBangPhanQuyenHtml(ghiDe, MAC_DINH, false);
    expect(bang).toContain('TẤT CẢ các phòng');
  });

  it('TC-TKPQ-06: admin thấy dropdown trên bảng — 12 hàng × 4 vai + phạm vi cho 3 vai', () => {
    const bang = window.buildBangPhanQuyenHtml(ghiDeRong, MAC_DINH, true);
    expect((bang.match(/data-gd="1"/g) || []).length).toBe(12 * 4);
    expect((bang.match(/data-pv="1"/g) || []).length).toBe(12 * 3);
  });

  it('TC-TKPQ-07: người thường không có dropdown — chỉ badge hiển thị', () => {
    const bang = window.buildBangPhanQuyenHtml(ghiDeRong, MAC_DINH, false);
    expect(bang).not.toContain('data-gd="1"');
  });

  it('TC-TKPQ-08: chú thích ký hiệu nằm dưới cùng của bảng', () => {
    const bang = window.buildBangPhanQuyenHtml(ghiDeRong, MAC_DINH, false);
    expect(bang.lastIndexOf('Ký hiệu:')).toBeGreaterThan(bang.indexOf('</table>'));
  });

  it('TC-TKPQ-09: admin thấy NÚT LƯU sau khi nạp bảng (Vòng 13 — nút từng bị mất)', async () => {
    window.__tk('currentUser', { name: 'Admin', code: 'NV001', email: 'a@x.vn', role: 'admin' });
    window.fetch = vi.fn(() => ({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: { macDinh: MAC_DINH, ghiDe: [] } }),
    }));
    window.veBangPhanQuyen();
    await vi.waitFor(() => expect(document.getElementById('pq-save-btn')).toBeTruthy());
    expect(document.getElementById('pq-save-btn').textContent).toContain('Lưu bảng phân quyền');
  });

  it('TC-TKPQ-10: dropdown KHÔNG lặp option đang chọn — mỗi select một tập giá trị duy nhất', async () => {
    window.__tk('currentUser', { name: 'Admin', code: 'NV001', email: 'a@x.vn', role: 'admin' });
    window.fetch = vi.fn(() => ({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: { macDinh: MAC_DINH, ghiDe: [] } }),
    }));
    window.veBangPhanQuyen();
    await vi.waitFor(() => expect(document.querySelector('select[data-gd="1"]')).toBeTruthy());
    const cacSelect = [...document.querySelectorAll('#account-permission-table select[data-gd]')];
    expect(cacSelect.length).toBeGreaterThan(0);
    for (const sel of cacSelect) {
      const giaTri = [...sel.options].map((o) => o.value);
      expect(new Set(giaTri).size).toBe(giaTri.length);
      // Option đầu (đang dùng) phải là option được chọn và KHÔNG xuất hiện lần thứ hai.
      expect(sel.selectedOptions[0]).toBe(sel.options[0]);
    }
  });
});

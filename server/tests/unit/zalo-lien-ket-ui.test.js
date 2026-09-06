// @vitest-environment jsdom
//
// KHỐI «THÔNG BÁO ZALO» TRÊN TRANG TÀI KHOẢN (2026-09-06, Phase 8 việc 1e — một phần
// của TC-ZL-14 nhóm B7: bề mặt người dùng của liên kết Zalo). Chạy app.js THẬT trong
// jsdom, `fetch` giả — cùng khuôn với thong-bao-ui.test.js.
//
// Ba điều bộ này canh:
//   1. **Cờ `bat` quyết định cả khối** — máy chủ chưa bật token thì ẩn hẳn, không hiện nút
//      «Lấy mã» chết (bẫy §13.5 «cờ cấu hình phải đi cùng dữ liệu»).
//   2. **Mã và câu hướng dẫn do máy chủ trả phải qua escapeHtml** — dù mã chỉ là 6 chữ số,
//      đây là nguyên tắc «dữ liệu máy chủ = dữ liệu chưa tin» của cả kho.
//   3. **Nút vẽ lại vẫn chạy** — khối được thay innerHTML sau mỗi thao tác nên sự kiện đi
//      qua delegation; bấm «Lấy mã khác» trên khối mã phải hoạt động như nút ban đầu.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  renderThongBaoZalo, buildZaloDaLienKetHtml, buildZaloChuaLienKetHtml, buildZaloMaHtml,
  xuLyNutZalo, setupTrangTaiKhoan,
  datDangNhap: (v) => { isAuthenticated = v; },
  datNguoiDung: (v) => { currentUser = v; },
});`;

/** Mỗi lần gọi trả phản hồi kế tiếp trong hàng đợi; ghi lại (method, path) để soi. */
function datFetch(hangDoi) {
  const daGoi = [];
  window.fetch = vi.fn((path, opt) => {
    daGoi.push({ path: String(path), method: (opt && opt.method) || 'GET' });
    const item = hangDoi.shift();
    if (item === undefined)
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, data: item }),
    });
  });
  return daGoi;
}

const trangThai = (over = {}) => ({ bat: true, cachNhan: 'webhook', daLienKet: false, ...over });

function bamNut(selector) {
  const nut = document.querySelector(selector);
  expect(nut).not.toBeNull();
  nut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = `
    <div id="account-zalo-card" class="hidden">
      <div id="account-zalo-body"></div>
    </div>
    <div id="toast-container"></div>`;
  new Function(APP_SRC + EXPORTS)();
  window.datDangNhap(true);
  window.datNguoiDung({ id: 5, full_name: 'Nguyễn Văn A', role: 'Nhân viên' });
  window.setupTrangTaiKhoan(); // nối delegation cho #account-zalo-body đúng một lần
});

describe('Cờ máy chủ quyết định cả khối', () => {
  it('bat=false ⇒ ẩn hẳn khối, không vẽ nút nào', async () => {
    datFetch([trangThai({ bat: false, cachNhan: 'tat' })]);
    await window.renderThongBaoZalo();
    const card = document.getElementById('account-zalo-card');
    expect(card.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('account-zalo-body').innerHTML).toBe('');
  });

  it('bat=true + chưa liên kết ⇒ badge «Chưa liên kết» + nút lấy mã', async () => {
    datFetch([trangThai()]);
    await window.renderThongBaoZalo();
    const card = document.getElementById('account-zalo-card');
    expect(card.classList.contains('hidden')).toBe(false);
    const body = document.getElementById('account-zalo-body');
    expect(body.textContent).toContain('Chưa liên kết');
    expect(body.querySelector('button[data-zalo="lay-ma"]')).not.toBeNull();
    expect(body.querySelector('button[data-zalo="bo-lien-ket"]')).toBeNull();
  });

  it('bat=true + đã liên kết ⇒ badge xanh «Đã liên kết» + nút bỏ liên kết', async () => {
    datFetch([trangThai({ daLienKet: true })]);
    await window.renderThongBaoZalo();
    const body = document.getElementById('account-zalo-body');
    expect(body.textContent).toContain('Đã liên kết');
    expect(body.querySelector('button[data-zalo="bo-lien-ket"]')).not.toBeNull();
    expect(body.querySelector('button[data-zalo="lay-ma"]')).toBeNull();
  });

  it('chưa đăng nhập ⇒ ẩn khối và KHÔNG gọi máy chủ', async () => {
    window.datDangNhap(false);
    const daGoi = datFetch([]);
    await window.renderThongBaoZalo();
    expect(document.getElementById('account-zalo-card').classList.contains('hidden')).toBe(true);
    expect(daGoi).toHaveLength(0);
  });
});

describe('Luồng lấy mã liên kết', () => {
  it('bấm «Lấy mã liên kết» ⇒ hiện mã 6 số, câu hướng dẫn và hạn dùng', async () => {
    datFetch([trangThai()]);
    await window.renderThongBaoZalo();

    const daGoi = datFetch([
      { csrfToken: 'x' }, // jsdom không có cookie ⇒ restPost phải hỏi /api/csrf trước
      {
        code: '123456',
        huongDan: 'Mở Zalo, nhắn tin cho bot rồi gửi đúng dòng: LIENKET 123456',
        hanPhut: 15,
      },
    ]);
    bamNut('button[data-zalo="lay-ma"]');
    const body = document.getElementById('account-zalo-body');
    await vi.waitFor(() => expect(body.textContent).toContain('123456'));

    expect(body.textContent).toContain(
      'Mở Zalo, nhắn tin cho bot rồi gửi đúng dòng: LIENKET 123456'
    );
    expect(body.textContent).toContain('Mã dùng một lần, có hạn 15 phút');
    // Khối mã vẽ lại vẫn có nút lấy mã KHÁC — delegation phải sống qua innerHTML thay.
    expect(body.querySelector('button[data-zalo="lay-ma"]')).not.toBeNull();
    expect(daGoi.map((g) => g.path)).toEqual(['/api/csrf', '/api/v1/zalo/ma-lien-ket']);
    expect(daGoi[1].method).toBe('POST');
  });
});

describe('Luồng bỏ liên kết', () => {
  it('bấm «Bỏ liên kết» ⇒ toast xác nhận, khối quay về «Chưa liên kết»', async () => {
    datFetch([trangThai({ daLienKet: true })]);
    await window.renderThongBaoZalo();

    datFetch([
      { csrfToken: 'x' }, // hỏi CSRF (cookie jsdom rỗng)
      { changed: 1, daLienKet: false }, // DELETE /lien-ket
      trangThai(), // renderThongBaoZalo nạp lại sau khi bỏ
    ]);
    bamNut('button[data-zalo="bo-lien-ket"]');

    const body = document.getElementById('account-zalo-body');
    await vi.waitFor(() => expect(body.textContent).toContain('Chưa liên kết'));
    expect(document.getElementById('toast-container').textContent).toContain('Đã bỏ liên kết Zalo');
    expect(body.querySelector('button[data-zalo="lay-ma"]')).not.toBeNull();
  });
});

describe('XSS: dữ liệu máy chủ trả về khối mã phải được thoát', () => {
  it('code/huongDan chứa thẻ ⇒ hiện thành CHỮ, không thành thẻ thật', () => {
    const khung = document.getElementById('account-zalo-body');
    khung.innerHTML = window.buildZaloMaHtml({
      code: '<img src=x onerror=alert(1)>',
      huongDan: '<script>alert(1)</script>',
      hanPhut: 15,
    });
    expect(khung.querySelectorAll('img')).toHaveLength(0);
    expect(khung.querySelectorAll('script')).toHaveLength(0);
    expect(khung.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(khung.textContent).toContain('<script>alert(1)</script>');
    expect(khung.innerHTML).toContain('&lt;img');
    expect(khung.innerHTML).toContain('&lt;script&gt;');
  });

  it('hanPhut lạ không phá được cấu trúc câu hạn dùng', () => {
    const khung = document.getElementById('account-zalo-body');
    khung.innerHTML = window.buildZaloMaHtml({
      code: '000111',
      huongDan: 'Gửi LIENKET 000111',
      hanPhut: '<b>99</b>',
    });
    expect(khung.querySelectorAll('b')).toHaveLength(0);
    expect(khung.textContent).toContain('có hạn <b>99</b> phút');
  });
});

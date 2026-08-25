// @vitest-environment jsdom
//
// Việc 4.5 — bắt buộc đổi mật khẩu. Test này nạp CẢ HAI file trình duyệt thật (`api-bridge.js` rồi
// `app.js`) để kiểm đúng đường đi mà người dùng gặp: máy chủ trả 403 MUST_CHANGE_PASSWORD ⇒ cầu
// tương thích gọi `showChangePasswordModal({forced: true})` ⇒ modal hiện ra KHÔNG có đường thoát.
//
// Vì sao phải nạp app.js thật chứ không dựng lại một bản modal giả: cái dễ vỡ ở đây là chỗ NỐI hai
// file (tên hàm, hình dạng tham số). Bản giả sẽ xanh cả khi tên hàm đã đổi.
//
// `new Function(SRC)()` giữ khai báo hàm trong phạm vi hàm đó, không đưa lên `window` — nên phần
// cuối phải gán tay đúng những hàm cần gọi từ test.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vitest chạy với gốc là `server/`, còn `import.meta.url` trong jsdom là URL http nên không dùng được.
const BRIDGE_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/api-bridge.js'), 'utf8');
const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');

/**
 * Trên trình duyệt, hàm khai ở cấp cao nhất của một script cổ điển LÀ thuộc tính của `window` —
 * `api-bridge.js` dựa vào đúng điều đó (`window.showToast`, `window.hideLoading`…). Bọc trong
 * `new Function` thì chúng nằm trong phạm vi hàm, nên phải gán tay để trả lại đúng cảnh thật.
 */
const EXPORTS = `;Object.assign(window, {
  showChangePasswordModal, showLoginModal, hideLoading, showToast, closeModal
});`;

let fetchCalls;

function loadScripts() {
  new Function(BRIDGE_SRC)();
  new Function(APP_SRC + EXPORTS)();
}

/** Trả lời cho mọi POST /api/rpc/*; `overrides[tên]` để một hàm trả khác. */
function stubFetch(overrides = {}) {
  fetchCalls = [];
  window.fetch = (url, init = {}) => {
    const name = String(url).split('/').pop();
    fetchCalls.push({ name, body: init.body ? JSON.parse(init.body) : null, init });
    const answer = overrides[name] ?? { status: 200, body: { ok: true, data: { success: true } } };
    return Promise.resolve({
      ok: answer.status < 400,
      status: answer.status,
      json: () => Promise.resolve(answer.body),
    });
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const modal = () => document.getElementById('change-password-modal');

beforeEach(() => {
  // Đúng ba chỗ trong `index.html` mà các hàm này chạm tới.
  document.body.innerHTML =
    '<div id="modals-container"></div><div id="toast-container"></div>' +
    '<div id="loading-overlay" class="hidden"></div>';
  document.cookie = 'qlcv_sid_test_csrf=ma-bao-ve';
  vi.restoreAllMocks();
  stubFetch();
  loadScripts();
});

describe('modal đổi mật khẩu — chế độ thường (người dùng tự bấm)', () => {
  it('TC-PWD-F01: có ĐỦ 3 ô, trong đó ô mật khẩu hiện tại là ô mới của Phase 4', () => {
    window.showChangePasswordModal();
    const names = [...modal().querySelectorAll('input[type="password"]')].map((i) => i.name);
    expect(names).toEqual(['currentPassword', 'newPassword', 'confirmPassword']);
  });

  it('TC-PWD-F02: vẫn còn dấu × và nút Hủy — đây là việc tự nguyện', () => {
    window.showChangePasswordModal();
    expect(modal().querySelectorAll('.close-modal').length).toBe(2);
  });

  /** Nút ở thanh trên gắn thẳng `showChangePasswordModal` làm listener nên tham số là MouseEvent. */
  it('TC-PWD-F03: gọi bằng MouseEvent (listener của nút) KHÔNG bị hiểu là chặn cửa', () => {
    window.showChangePasswordModal(new window.MouseEvent('click'));
    expect(modal().querySelectorAll('.close-modal').length).toBe(2);
  });

  it('TC-PWD-F04: gửi ĐỦ 3 tham số theo đúng thứ tự (hiện tại, mới, nhập lại)', async () => {
    window.showChangePasswordModal();
    const form = modal().querySelector('form');
    form.elements.currentPassword.value = 'MatKhauCu@1';
    form.elements.newPassword.value = 'MatKhauMoi@2';
    form.elements.confirmPassword.value = 'MatKhauMoi@2';
    form.dispatchEvent(new window.Event('submit'));
    await tick();

    const call = fetchCalls.find((c) => c.name === 'changePassword');
    expect(call.body).toEqual({ args: ['MatKhauCu@1', 'MatKhauMoi@2', 'MatKhauMoi@2'] });
    // Cùng lúc kiểm luôn cầu tương thích vẫn kèm mã bảo vệ cho lời gọi ghi này.
    expect(call.init.headers['X-CSRF-Token']).toBe('ma-bao-ve');
  });

  /**
   * Mật khẩu hiện tại KHÔNG được `.trim()`: dấu cách đầu/cuối là một phần mật khẩu người ta đã đặt,
   * cắt đi là báo sai mật khẩu mà không ai hiểu vì sao. Ô mới thì vẫn cắt như bản cũ.
   */
  it('TC-PWD-F05: không cắt dấu cách của mật khẩu hiện tại', async () => {
    window.showChangePasswordModal();
    const form = modal().querySelector('form');
    form.elements.currentPassword.value = ' co dau cach ';
    form.elements.newPassword.value = ' MatKhauMoi@2 ';
    form.elements.confirmPassword.value = ' MatKhauMoi@2 ';
    form.dispatchEvent(new window.Event('submit'));
    await tick();

    expect(fetchCalls.find((c) => c.name === 'changePassword').body.args).toEqual([
      ' co dau cach ',
      'MatKhauMoi@2',
      'MatKhauMoi@2',
    ]);
  });
});

describe('403 MUST_CHANGE_PASSWORD — chặn cửa thật sự', () => {
  const blocked = {
    status: 403,
    body: {
      ok: false,
      error: { code: 'MUST_CHANGE_PASSWORD', message: 'Bạn phải đổi mật khẩu trước khi tiếp tục' },
    },
  };

  it('TC-PWD-F06: một lời gọi nghiệp vụ bị chặn ⇒ modal tự mở, KHÔNG cần app.js làm gì thêm', async () => {
    stubFetch({ getProjects: blocked });
    loadScripts();
    expect(modal()).toBeNull();

    window.google.script.run.getProjects();
    await tick();

    expect(modal()).not.toBeNull();
  });

  it('TC-PWD-F07: modal chặn cửa KHÔNG có dấu ×, KHÔNG có nút Hủy', async () => {
    stubFetch({ getProjects: blocked });
    loadScripts();
    window.google.script.run.getProjects();
    await tick();

    expect(modal().querySelectorAll('.close-modal').length).toBe(0);
    expect(modal().textContent).not.toContain('Hủy');
    expect(modal().textContent).toContain('phải đổi mật khẩu trước khi vào hệ thống');
  });

  it('TC-PWD-F08: tắt lớp "Đang tải" đang che màn hình, nếu không thì modal bấm không được', async () => {
    document.getElementById('loading-overlay').classList.remove('hidden');
    stubFetch({ getProjects: blocked });
    loadScripts();
    window.google.script.run.getProjects();
    await tick();

    expect(document.getElementById('loading-overlay').classList.contains('hidden')).toBe(true);
  });

  it('TC-PWD-F09: đổi xong thì lời gọi bị chặn được CHẠY LẠI, người dùng không phải bấm lại', async () => {
    stubFetch({ getProjects: blocked });
    loadScripts();
    window.google.script.run.getProjects();
    await tick();
    expect(fetchCalls.filter((c) => c.name === 'getProjects')).toHaveLength(1);

    // Lần này máy chủ đã cho qua (mật khẩu tạm không còn).
    stubFetch({});
    const form = modal().querySelector('form');
    form.elements.currentPassword.value = 'MatKhauTam@1';
    form.elements.newPassword.value = 'MatKhauMoi@2';
    form.elements.confirmPassword.value = 'MatKhauMoi@2';
    form.dispatchEvent(new window.Event('submit'));
    await tick();
    await tick();

    expect(fetchCalls.map((c) => c.name)).toEqual(['changePassword', 'getProjects']);
  });
});

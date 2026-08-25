// @vitest-environment jsdom
//
// Cầu tương thích phía trình duyệt (`web/assets/js/api-bridge.js`, việc 4.2).
//
// Vì sao chạy trong jsdom mà không phải node: cầu đọc `document.cookie`, gắn `window.google` và
// gọi lại các hàm modal của `app.js` qua `window`. Thay `document` bằng đối tượng giả thì test
// xanh trong khi trình duyệt thật vẫn vỡ — đúng loại "xanh giả" mà §8 không nhận.
//
// Ba câu hỏi mà file này phải trả lời bằng kiểm chứng, không bằng đọc code:
//  1. ĐỦ 37 tên (§5.2), mỗi tên gọi đúng `POST /api/rpc/<tên>` và CÓ header `X-CSRF-Token`.
//  2. Không nhánh nào im lặng: 404 / 501 / 500 / mạng đứt / thiếu token đều đến tay người dùng.
//  3. 401 giữa phiên bật lại modal đăng nhập RỒI PHÁT LẠI đúng lời gọi đã trượt (4.4); 403
//     MUST_CHANGE_PASSWORD mở modal đổi mật khẩu (4.5).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RPC_NAMES } from '../../src/rpc/table.js';

// Trong môi trường jsdom, `import.meta.url` là URL http (jsdom giả lập trang web) nên
// `readFileSync(new URL(...))` báo "The URL must be of scheme file". Vitest chạy với thư mục gốc
// là `server/`, nên lấy đường dẫn từ đó.
const BRIDGE_PATH = resolve(process.cwd(), '../web/assets/js/api-bridge.js');
const BRIDGE_SRC = readFileSync(BRIDGE_PATH, 'utf8');

// Nạp đúng như trình duyệt nạp: một `<script>` cổ điển chạy ở phạm vi toàn cục của jsdom.
new Function(BRIDGE_SRC)();

const TOKEN = 'token-csrf-tu-may-chu';
const COOKIE_TOKEN = 'token-csrf-tu-cookie';

/** Phản hồi JSON tối giản, chỉ có phần cầu dùng tới. */
function jsonRes(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  };
}

const okEnvelope = (data) => jsonRes(200, { ok: true, data });
const failEnvelope = (status, code, message, extra = {}) =>
  jsonRes(status, { ok: false, error: { code, message, ...extra } });

/** Ghi lại mọi lời gọi mạng để khẳng định đường dẫn / phương thức / header. */
let calls;

/**
 * @param {(url: string, init: any) => any} handler bảng phản hồi của từng test
 */
function stubFetch(handler) {
  calls = [];
  globalThis.fetch = vi.fn((url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method || 'GET',
      headers: init.headers || {},
      credentials: init.credentials,
      body: init.body ? JSON.parse(init.body) : null,
    });
    // `handler` có thể ném ngay (giả lập mạng đứt); `fetch` thật thì TRẢ VỀ promise bị từ chối,
    // nên chuyển cho giống hàng thật, nếu không cầu lại thấy một lỗi ném đồng bộ.
    try {
      return Promise.resolve(handler(String(url), init));
    } catch (err) {
      return Promise.reject(err);
    }
  });
}

/** Bảng phản hồi mặc định: token lấy được, hàm nào cũng thành công. */
function defaultHandler(overrides = {}) {
  return (url) => {
    if (url === '/api/csrf') return okEnvelope({ csrfToken: TOKEN });
    const name = url.replace('/api/rpc/', '');
    if (Object.hasOwn(overrides, name)) {
      const value = overrides[name];
      return typeof value === 'function' ? value() : value;
    }
    return okEnvelope({ success: true, ten: name });
  };
}

const rpcCalls = () => calls.filter((c) => c.url.startsWith('/api/rpc/'));
const run = () => window.google.script.run;

/** Chờ cho chuỗi promise trong cầu chạy hết (phát lại là một lượt promise nữa). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setCookie(value) {
  document.cookie = `qlcv_sid_csrf=${value}; path=/`;
}

function clearCookies() {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim();
    if (name) document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

let modals;

beforeEach(() => {
  clearCookies();
  window.__apiBridge.reset();
  modals = {
    showLoginModal: vi.fn(),
    showChangePasswordModal: vi.fn(),
    hideLoading: vi.fn(),
    showToast: vi.fn(),
  };
  Object.assign(window, modals);
  window.alert = vi.fn();
  stubFetch(defaultHandler());
});

afterEach(() => {
  for (const key of Object.keys(modals)) delete window[key];
  vi.restoreAllMocks();
});

describe('api-bridge — hợp đồng chuỗi gọi của google.script.run', () => {
  it('định nghĩa window.google.script.run trước khi app.js chạy', () => {
    expect(typeof run().withSuccessHandler).toBe('function');
    expect(typeof run().withFailureHandler).toBe('function');
  });

  it('withSuccessHandler trả runner MỚI, không sửa runner cũ (app.js dòng 1590 dùng lại biến)', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const runner = run().withSuccessHandler(first);
    const other = runner.withSuccessHandler(second);

    await runner.getProjects();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    await other.getProjects();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('danh sách tên của cầu KHỚP TỪNG TÊN với bảng của máy chủ (§5.2) — đủ 37', () => {
    expect(window.__apiBridge.names).toEqual([...RPC_NAMES]);
    expect(window.__apiBridge.names).toHaveLength(37);
  });

  it('tên gọi động sai chính tả nổ NGAY với câu tiếng Việt, không phải "undefined is not a function"', () => {
    expect(() => run().addProjetWithAuth({})).toThrow(/Cầu tương thích không có hàm/);
  });
});

describe('api-bridge — ĐỦ 37 tên đi đúng đường, đúng phương thức, có CSRF', () => {
  // Cả 3 chỗ gọi tên động trong `app.js` ghép tên lúc chạy, nên không thể "test vài tên tiêu biểu":
  // thiếu một tên là một nút bấm chết. Mỗi tên một test để chỗ đỏ chỉ đúng tên nào.
  it.each([...RPC_NAMES])('%s ⇒ POST /api/rpc/%s kèm X-CSRF-Token', async (name) => {
    const handler = vi.fn();
    await run().withSuccessHandler(handler).withFailureHandler(vi.fn())[name]('CV001', { a: 1 });

    const sent = rpcCalls();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe(`/api/rpc/${name}`);
    expect(sent[0].method).toBe('POST');
    expect(sent[0].headers['X-CSRF-Token']).toBe(TOKEN);
    expect(sent[0].headers['Content-Type']).toBe('application/json');
    // Cookie phiên phải được gửi kèm, nếu không thì mọi lời gọi là 401.
    expect(sent[0].credentials).toBe('same-origin');
    expect(sent[0].body).toEqual({ args: ['CV001', { a: 1 }] });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('đối số giữ nguyên thứ tự và kiểu (bản cũ truyền chuỗi rỗng, null, số)', async () => {
    await run().addTaskReminder('CV001-002', '2026-09-11', '', null, 3);
    expect(rpcCalls()[0].body).toEqual({ args: ['CV001-002', '2026-09-11', '', null, 3] });
  });

  it('không có đối số thì args là mảng rỗng, không phải undefined', async () => {
    await run().getProjects();
    expect(rpcCalls()[0].body).toEqual({ args: [] });
  });

  it('getProjects trả MẢNG THUẦN thì success handler nhận đúng mảng đó (app.js gán thẳng)', async () => {
    stubFetch(defaultHandler({ getProjects: okEnvelope([{ 'Mã dự án': 'CV001' }]) }));
    const handler = vi.fn();
    await run().withSuccessHandler(handler).getProjects();
    expect(handler).toHaveBeenCalledWith([{ 'Mã dự án': 'CV001' }]);
  });
});

describe('api-bridge — mã CSRF (§7 việc 1.5)', () => {
  it('có cookie thì dùng cookie, KHÔNG gọi thêm /api/csrf', async () => {
    setCookie(COOKIE_TOKEN);
    await run().getProjects();
    expect(calls.map((c) => c.url)).toEqual(['/api/rpc/getProjects']);
    expect(rpcCalls()[0].headers['X-CSRF-Token']).toBe(COOKIE_TOKEN);
  });

  it('chưa có cookie thì xin token ở /api/csrf TRƯỚC rồi mới gọi hàm', async () => {
    await run().getProjects();
    expect(calls[0].url).toBe('/api/csrf');
    expect(calls[0].method).toBe('GET');
    expect(calls[1].headers['X-CSRF-Token']).toBe(TOKEN);
  });

  it('cookie đổi sau khi đăng nhập lại thì lời gọi sau dùng token MỚI, không dùng bản trong bộ nhớ', async () => {
    await run().getProjects(); // token cũ từ /api/csrf
    setCookie('token-sau-khi-dang-nhap');
    await run().getTasks();
    expect(rpcCalls()[1].headers['X-CSRF-Token']).toBe('token-sau-khi-dang-nhap');
  });

  // Yêu cầu cứng: KHÔNG gửi request ghi mà thiếu header. Gửi thiếu thì máy chủ trả 403
  // "Yêu cầu không hợp lệ" — người dùng không biết vì sao, còn nhật ký chỉ thấy CSRF_INVALID.
  it('không lấy được token ⇒ báo lỗi rõ và KHÔNG gửi lời gọi nào tới /api/rpc', async () => {
    stubFetch((url) => {
      if (url === '/api/csrf') throw new Error('mạng đứt');
      return okEnvelope({ success: true });
    });
    const onFail = vi.fn();
    const onOk = vi.fn();
    await run().withSuccessHandler(onOk).withFailureHandler(onFail).addProjectWithAuth({ a: 1 });

    expect(rpcCalls()).toHaveLength(0);
    expect(onOk).not.toHaveBeenCalled();
    expect(onFail.mock.calls[0][0].message).toMatch(/Không lấy được mã bảo vệ biểu mẫu/);
    expect(onFail.mock.calls[0][0].code).toBe('CSRF_TOKEN_MISSING');
  });

  it('403 CSRF_INVALID ⇒ xin token mới và thử lại MỘT lần, lần hai gửi token mới', async () => {
    let lan = 0;
    stubFetch((url) => {
      if (url === '/api/csrf') return okEnvelope({ csrfToken: `token-${++lan}` });
      return calls.filter((c) => c.url.startsWith('/api/rpc/')).length === 1
        ? failEnvelope(403, 'CSRF_INVALID', 'Yêu cầu không hợp lệ, hãy tải lại trang rồi thử lại')
        : okEnvelope({ success: true });
    });
    const onOk = vi.fn();
    await run().withSuccessHandler(onOk).updateProjectWithAuth('CV001', {});

    const sent = rpcCalls();
    expect(sent).toHaveLength(2);
    expect(sent[0].headers['X-CSRF-Token']).toBe('token-1');
    expect(sent[1].headers['X-CSRF-Token']).toBe('token-2');
    expect(onOk).toHaveBeenCalledTimes(1);
  });

  it('403 CSRF_INVALID dai dẳng ⇒ đúng 2 lần thử rồi báo lỗi, không lặp vô tận', async () => {
    stubFetch((url) =>
      url === '/api/csrf'
        ? okEnvelope({ csrfToken: TOKEN })
        : failEnvelope(403, 'CSRF_INVALID', 'Yêu cầu không hợp lệ, hãy tải lại trang rồi thử lại')
    );
    const onFail = vi.fn();
    await run().withFailureHandler(onFail).deleteProjectWithAuth('CV001');

    expect(rpcCalls()).toHaveLength(2);
    expect(onFail.mock.calls[0][0].code).toBe('CSRF_INVALID');
  });
});

describe('api-bridge — 401 giữa phiên: bật lại modal rồi PHÁT LẠI (việc 4.4)', () => {
  /** Lần đầu gọi `name` trả 401, lần sau trả `after`. */
  function expireOnce(name, after) {
    let lan = 0;
    return (url) => {
      if (url === '/api/csrf') return okEnvelope({ csrfToken: TOKEN });
      if (url === `/api/rpc/${name}` && ++lan === 1) {
        return failEnvelope(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập');
      }
      if (url === '/api/rpc/authenticateUser') {
        return okEnvelope({ success: true, user: { email: 'a@congty.vn' } });
      }
      return after;
    };
  }

  it('401 ⇒ tắt lớp "Đang tải", mở modal đăng nhập, GIỮ lời gọi lại, chưa gọi handler nào', async () => {
    stubFetch(expireOnce('getTasks', okEnvelope([])));
    const onOk = vi.fn();
    const onFail = vi.fn();
    await run().withSuccessHandler(onOk).withFailureHandler(onFail).getTasks('CV001');

    expect(window.showLoginModal).toHaveBeenCalledTimes(1);
    expect(window.hideLoading).toHaveBeenCalledTimes(1);
    expect(onOk).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    expect(window.__apiBridge.pendingCount()).toBe(1);
  });

  it('đăng nhập lại xong thì lời gọi đã trượt tự chạy lại và trả dữ liệu cho ĐÚNG handler cũ', async () => {
    stubFetch(expireOnce('addTaskWithAuth', okEnvelope({ success: true, taskId: 'CV001-002' })));
    const onOk = vi.fn();
    await run().withSuccessHandler(onOk).addTaskWithAuth({ name: 'Nhiệm vụ' });
    expect(onOk).not.toHaveBeenCalled();

    await run().authenticateUser('a@congty.vn', 'matkhau');
    await tick();

    expect(onOk).toHaveBeenCalledWith({ success: true, taskId: 'CV001-002' });
    // Phát lại là gửi ĐÚNG thân cũ, không mất đối số.
    const resent = rpcCalls().filter((c) => c.url === '/api/rpc/addTaskWithAuth');
    expect(resent).toHaveLength(2);
    expect(resent[1].body).toEqual({ args: [{ name: 'Nhiệm vụ' }] });
    expect(window.__apiBridge.pendingCount()).toBe(0);
  });

  it('phát lại vẫn 401 ⇒ báo lỗi tiếng Việt, KHÔNG lặp vô tận', async () => {
    stubFetch((url) =>
      url === '/api/csrf'
        ? okEnvelope({ csrfToken: TOKEN })
        : url === '/api/rpc/authenticateUser'
          ? okEnvelope({ success: true, user: { email: 'a@congty.vn' } })
          : failEnvelope(401, 'SESSION_EXPIRED', 'Phiên đã hết hạn')
    );
    const onFail = vi.fn();
    await run().withFailureHandler(onFail).getProjects();
    await run().authenticateUser('a@congty.vn', 'matkhau');
    await tick();

    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0].message).toMatch(/Phiên đăng nhập đã hết/);
    expect(rpcCalls().filter((c) => c.url === '/api/rpc/getProjects')).toHaveLength(2);
  });

  it('người KHÁC đăng nhập vào cùng tab ⇒ bỏ lời gọi cũ, nói rõ vì sao, không ghi nhầm chủ thể', async () => {
    let lan = 0;
    stubFetch((url) => {
      if (url === '/api/csrf') return okEnvelope({ csrfToken: TOKEN });
      if (url === '/api/rpc/authenticateUser') {
        return okEnvelope({
          success: true,
          user: { email: ++lan === 1 ? 'a@congty.vn' : 'b@congty.vn' },
        });
      }
      return failEnvelope(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập');
    });

    await run().authenticateUser('a@congty.vn', 'matkhau'); // chủ phiên là a@
    const onFail = vi.fn();
    await run().withFailureHandler(onFail).deleteTaskWithAuth('CV001-002');
    expect(window.__apiBridge.pendingCount()).toBe(1);

    await run().authenticateUser('b@congty.vn', 'matkhau'); // người khác vào
    await tick();

    expect(onFail.mock.calls[0][0].code).toBe('OWNER_CHANGED');
    expect(rpcCalls().filter((c) => c.url === '/api/rpc/deleteTaskWithAuth')).toHaveLength(1);
  });

  it('sai mật khẩu (INVALID_CREDENTIALS) KHÔNG bật modal đăng nhập lần nữa và KHÔNG vào hàng chờ', async () => {
    stubFetch(
      defaultHandler({
        authenticateUser: failEnvelope(
          401,
          'INVALID_CREDENTIALS',
          'Email hoặc mật khẩu không đúng'
        ),
      })
    );
    const onOk = vi.fn();
    const onFail = vi.fn();
    await run()
      .withSuccessHandler(onOk)
      .withFailureHandler(onFail)
      .authenticateUser('a@x.vn', 'sai');

    // §5.1 errorAsData: câu lỗi phải tới `showLoginError` qua success handler.
    expect(onOk).toHaveBeenCalledWith({
      success: false,
      error: 'Email hoặc mật khẩu không đúng',
      code: 'INVALID_CREDENTIALS',
      field: undefined,
    });
    expect(onFail).not.toHaveBeenCalled();
    expect(window.showLoginModal).not.toHaveBeenCalled();
    expect(window.__apiBridge.pendingCount()).toBe(0);
  });

  it('đăng xuất thì xoá hàng chờ — không phát lại thao tác của phiên vừa đóng', async () => {
    stubFetch((url) =>
      url === '/api/csrf'
        ? okEnvelope({ csrfToken: TOKEN })
        : url === '/api/rpc/logout'
          ? okEnvelope({ success: true, message: 'Đã đăng xuất' })
          : failEnvelope(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập')
    );
    await run().withFailureHandler(vi.fn()).reorderTasks('CV001', ['CV001-002']);
    expect(window.__apiBridge.pendingCount()).toBe(1);

    await run().logout();
    expect(window.__apiBridge.pendingCount()).toBe(0);
  });
});

describe('api-bridge — 403 MUST_CHANGE_PASSWORD chặn cửa (việc 4.5)', () => {
  const CAU = 'Bạn phải đổi mật khẩu lần đầu trước khi dùng hệ thống';

  function mustChangeThen(after) {
    let lan = 0;
    return (url) => {
      if (url === '/api/csrf') return okEnvelope({ csrfToken: TOKEN });
      if (url === '/api/rpc/changePassword') {
        return okEnvelope({ success: true, message: 'Đổi mật khẩu thành công' });
      }
      return ++lan === 1 ? failEnvelope(403, 'MUST_CHANGE_PASSWORD', CAU) : after;
    };
  }

  it('mở modal đổi mật khẩu kèm câu nhắc, và KHÔNG cho lời gọi đi tiếp', async () => {
    stubFetch(mustChangeThen(okEnvelope([])));
    const onOk = vi.fn();
    await run().withSuccessHandler(onOk).withFailureHandler(vi.fn()).getProjects();

    expect(window.showChangePasswordModal).toHaveBeenCalledTimes(1);
    expect(window.showToast).toHaveBeenCalledWith(CAU, 'error');
    expect(onOk).not.toHaveBeenCalled();
  });

  it('đổi mật khẩu xong thì lời gọi bị chặn tự chạy lại', async () => {
    stubFetch(mustChangeThen(okEnvelope([{ 'Mã dự án': 'CV001' }])));
    const onOk = vi.fn();
    await run().withSuccessHandler(onOk).getProjects();

    await run().changePassword('cu', 'moi', 'moi');
    await tick();

    expect(onOk).toHaveBeenCalledWith([{ 'Mã dự án': 'CV001' }]);
  });

  it('giao diện chưa có modal đó thì phải alert — không được im lặng bỏ qua', async () => {
    delete window.showChangePasswordModal;
    stubFetch(mustChangeThen(okEnvelope([])));
    await run().withFailureHandler(vi.fn()).getStaffList();
    expect(window.alert).toHaveBeenCalledWith(CAU);
  });

  it('changePassword thiếu mật khẩu hiện tại ⇒ câu lỗi vào modal qua success handler (errorAsData)', async () => {
    stubFetch(
      defaultHandler({
        changePassword: failEnvelope(400, 'VALIDATION_ERROR', 'Thiếu tham số «Mật khẩu hiện tại»', {
          field: 'Mật khẩu hiện tại',
        }),
      })
    );
    const onOk = vi.fn();
    const onFail = vi.fn();
    await run().withSuccessHandler(onOk).withFailureHandler(onFail).changePassword('moi', 'moi');

    expect(onFail).not.toHaveBeenCalled();
    expect(onOk.mock.calls[0][0]).toMatchObject({
      success: false,
      error: 'Thiếu tham số «Mật khẩu hiện tại»',
      field: 'Mật khẩu hiện tại',
    });
  });
});

// Đây là điều kiện "xong" khắt khe nhất của việc 4.2: tên nào chưa có nghiệp vụ ở máy chủ thì phải
// THẤY được, không được im lặng trả `undefined` để giao diện dựng bảng rỗng và người dùng tưởng
// dữ liệu đã mất.
describe('api-bridge — không nhánh nào im lặng', () => {
  it('501 NOT_IMPLEMENTED ⇒ failure handler nhận đúng câu của máy chủ', async () => {
    const cau =
      'Chức năng «Nạp dữ liệu đầu trang» chưa được chuyển sang máy chủ mới. Vui lòng liên hệ quản trị.';
    stubFetch(
      defaultHandler({ getInitialDataWithAuth: failEnvelope(501, 'NOT_IMPLEMENTED', cau) })
    );
    const onOk = vi.fn();
    const onFail = vi.fn();
    await run().withSuccessHandler(onOk).withFailureHandler(onFail).getInitialDataWithAuth();

    expect(onOk).not.toHaveBeenCalled();
    expect(onFail.mock.calls[0][0].message).toBe(cau);
    expect(onFail.mock.calls[0][0].code).toBe('NOT_IMPLEMENTED');
    expect(onFail.mock.calls[0][0].status).toBe(501);
  });

  it('404 tên lạ ở máy chủ ⇒ failure handler, không phải 200 rỗng', async () => {
    stubFetch(
      defaultHandler({ addApp: failEnvelope(404, 'NOT_FOUND', 'Không có hàm «addApp» ở máy chủ') })
    );
    const onFail = vi.fn();
    await run().withFailureHandler(onFail).addApp({});
    expect(onFail.mock.calls[0][0].message).toMatch(/Không có hàm «addApp»/);
  });

  it('mạng đứt ⇒ câu tiếng Việt về đường mạng', async () => {
    stubFetch((url) => {
      if (url === '/api/csrf') return okEnvelope({ csrfToken: TOKEN });
      throw new TypeError('Failed to fetch');
    });
    const onFail = vi.fn();
    await run().withFailureHandler(onFail).getChatMessages();
    expect(onFail.mock.calls[0][0].message).toMatch(/Không kết nối được máy chủ/);
    expect(onFail.mock.calls[0][0].code).toBe('NETWORK_ERROR');
  });

  it('500 với thân không đọc được ⇒ vẫn có câu nói rõ hàm nào và mã nào', async () => {
    stubFetch((url) =>
      url === '/api/csrf'
        ? okEnvelope({ csrfToken: TOKEN })
        : {
            status: 500,
            ok: false,
            json: () => Promise.reject(new Error('không phải JSON')),
          }
    );
    const onFail = vi.fn();
    await run().withFailureHandler(onFail).sendChatMessage('xin chào');
    expect(onFail.mock.calls[0][0].message).toMatch(/500.*«sendChatMessage»/);
  });

  it('không khai failure handler thì lỗi vào console.error, không mất dấu và không ném ra ngoài', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(defaultHandler({ deleteApp: failEnvelope(500, 'INTERNAL', 'Lỗi hệ thống') }));
    await expect(run().deleteApp('APP1')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });
});

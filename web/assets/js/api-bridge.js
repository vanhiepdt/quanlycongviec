// Cầu tương thích phía TRÌNH DUYỆT (§5.1, việc 4.2) — lớp CÓ THỜI HẠN, bỏ đi ở Phase 6.
//
// Giao diện cũ gọi backend bằng `google.script.run.<tên>(...)`: 28 chỗ trong `app.js`, trong đó 3
// chỗ gọi tên ĐỘNG (`runner[text2](data)` dòng 1780, `[text](sourceId,newName)` dòng 2490,
// `runner.addDepartmentWithAuth` dòng 1606). Vì tên được ghép lúc chạy, cầu PHẢI có ĐỦ 37 tên của
// §5.2 — thiếu một tên là một nút bấm im lặng không làm gì, đúng kiểu lỗi khó tìm nhất.
//
// File này nạp TRƯỚC `app.js` (xem `web/index.html`) vì nó định nghĩa lại `window.google`.
//
// Bốn điều bắt buộc, mỗi điều là một lỗi thật đã gặp khi làm Phase 4:
//  1. `X-CSRF-Token` cho MỌI lời gọi. Cầu RPC chỉ có POST, mà `verifyCsrf` chặn mọi POST không có
//     token khớp cookie. Không lấy được token thì BÁO LỖI RÕ, không gửi request thiếu header rồi
//     để người dùng nhận 403 "Yêu cầu không hợp lệ" mà không hiểu vì sao.
//  2. Không bao giờ im lặng. Mọi nhánh — mạng đứt, 404 tên lạ, 501 chưa chuyển, 500 — đều gọi
//     `withFailureHandler` với câu tiếng Việt. KHÔNG có nhánh nào trả `undefined`.
//  3. 401 giữa phiên ⇒ bật lại modal đăng nhập RỒI PHÁT LẠI lời gọi vừa trượt (việc 4.4), để cái
//     bấm của người dùng không mất trắng.
//  4. 403 MUST_CHANGE_PASSWORD ⇒ mở modal đổi mật khẩu và chặn cửa (việc 4.5).
(function () {
  'use strict';

  /** Cầu RPC của máy chủ: mọi tên cũ đều là `POST /api/rpc/<tên>` với thân `{args: [...]}`. */
  const RPC_URL = '/api/rpc/';
  const CSRF_URL = '/api/csrf';
  const CSRF_HEADER = 'X-CSRF-Token';

  /**
   * ĐỦ 37 tên của §5.2, cùng thứ tự với `server/src/rpc/table.js`. Danh sách này là hợp đồng: máy
   * chủ trả 404 cho tên không có trong bảng, nên hai bên lệch nhau một tên là lộ ra ngay khi bấm.
   */
  const RPC_NAMES = [
    'authenticateUser',
    'logout',
    'changePassword',
    'getDataForUser',
    'getInitialDataWithAuth',
    'getDepartmentContext',
    'getProjects',
    'addProjectWithAuth',
    'updateProjectWithAuth',
    'deleteProjectWithAuth',
    'copyProjectWithAuth',
    'getTasks',
    'addTaskWithAuth',
    'updateTaskWithAuth',
    'deleteTaskWithAuth',
    'copyTaskWithAuth',
    'reorderTasks',
    'addTaskReminder',
    'updateTaskReminder',
    'deleteTaskReminder',
    'getStaffList',
    'addStaffWithAuth',
    'updateStaffWithAuth',
    'deleteStaffWithAuth',
    'addDepartmentWithAuth',
    'updateDepartmentWithAuth',
    'deleteDepartmentWithAuth',
    'getProposals',
    'addProposalWithAuth',
    'updateProposalWithAuth',
    'deleteProposalWithAuth',
    'addApp',
    'updateApp',
    'deleteApp',
    'getChatMessages',
    'sendChatMessage',
    'addNotificationWithAuth',
  ];

  /**
   * Hai tên mà LỖI phải đi vào `withSuccessHandler` dưới dạng `{success:false, error}`, khớp cờ
   * `errorAsData` của `table.js`. Lý do: `app.js` hiện câu lỗi đăng nhập bằng
   * `showLoginError(response.error)` (dòng 163) và câu lỗi đổi mật khẩu trong chính modal (dòng
   * 305). Đẩy sang failure handler thì người dùng chỉ thấy "Lỗi kết nối" và không biết mình sai
   * mật khẩu hay bị chặn vì thử quá nhiều lần.
   */
  const ERROR_AS_DATA = ['authenticateUser', 'changePassword'];

  /**
   * Chỉ hai mã này nghĩa là "phiên không còn" — dựa vào MÃ chứ không vào 401, vì 401 còn dùng cho
   * sai mật khẩu (`INVALID_CREDENTIALS`), tài khoản bị tắt (`ACCOUNT_DISABLED`) và những thứ đó
   * KHÔNG được bật modal đăng nhập chồng lên modal đang mở.
   */
  const SESSION_GONE = ['UNAUTHENTICATED', 'SESSION_EXPIRED'];

  /** Token CSRF đọc được từ cookie; giữ lại một bản trong bộ nhớ cho lần gọi kế tiếp. */
  let cachedToken = '';

  /** Những lời gọi đã trượt vì cửa đóng (401 / phải đổi mật khẩu), chờ phát lại sau khi mở cửa. */
  let waitingCalls = [];

  const has = (list, value) => list.indexOf(value) !== -1;

  /**
   * Cookie CSRF tên là `<SESSION_COOKIE_NAME>_csrf` — tên phụ thuộc biến môi trường của máy chủ
   * nên KHÔNG viết cứng ở đây; tìm theo hậu tố. Cookie phiên là HttpOnly nên không lẫn vào đây.
   */
  function tokenFromCookie() {
    const raw = typeof document === 'undefined' ? '' : document.cookie || '';
    const parts = raw ? raw.split(';') : [];
    for (let i = 0; i < parts.length; i++) {
      const pair = parts[i].trim();
      const eq = pair.indexOf('=');
      if (eq > 0 && pair.slice(0, eq).endsWith('_csrf')) {
        return decodeURIComponent(pair.slice(eq + 1));
      }
    }
    return '';
  }

  /** Lỗi có câu tiếng Việt sẵn cho `withFailureHandler`. `app.js` chỉ đọc `error.message`. */
  function bridgeError(message, code, status) {
    const err = new Error(message);
    err.code = code || 'BRIDGE_ERROR';
    if (status) err.status = status;
    return err;
  }

  /**
   * Lấy token CSRF. Ưu tiên cookie vì cookie ĐỔI sau mỗi lần đăng nhập/đăng xuất (máy chủ phát
   * lại ở `POST /auth/login`), còn bản trong bộ nhớ có thể là token của phiên cũ. Không có cookie
   * thì gọi `GET /api/csrf` — request đọc, `issueCsrfCookie` sẽ phát cookie mới.
   */
  async function ensureToken(force) {
    if (!force) {
      const fromCookie = tokenFromCookie();
      if (fromCookie) {
        cachedToken = fromCookie;
        return cachedToken;
      }
      if (cachedToken) return cachedToken;
    }
    let body = null;
    try {
      const res = await fetch(CSRF_URL, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      body = await res.json();
    } catch {
      body = null;
    }
    const token = (body && body.ok && body.data && body.data.csrfToken) || tokenFromCookie();
    if (!token) {
      // Thà báo lỗi còn hơn gửi POST thiếu header: 403 CSRF_INVALID không nói được nguyên nhân.
      throw bridgeError(
        'Không lấy được mã bảo vệ biểu mẫu (CSRF) từ máy chủ. Hãy tải lại trang rồi thử lại.',
        'CSRF_TOKEN_MISSING'
      );
    }
    cachedToken = token;
    return cachedToken;
  }

  /**
   * Gọi hàm của `app.js` nếu có. Cầu nạp TRƯỚC `app.js` nên lúc file này chạy các hàm đó chưa tồn
   * tại; tra cứu ở thời điểm GỌI, không giữ tham chiếu.
   */
  function callApp(fnName, arg1, arg2) {
    const fn = typeof window !== 'undefined' ? window[fnName] : null;
    if (typeof fn === 'function') {
      try {
        fn(arg1, arg2);
        return true;
      } catch (err) {
        // Modal vỡ thì vẫn phải thấy dấu vết, không được nuốt.
        if (typeof console !== 'undefined') console.error('api-bridge: ' + fnName + ' lỗi', err);
      }
    }
    return false;
  }

  /** 401 giữa phiên: tắt lớp "Đang tải" đang che màn hình rồi mở lại modal đăng nhập (việc 4.4). */
  function openLoginGate() {
    callApp('hideLoading');
    callApp('showLoginModal');
  }

  /** 403 MUST_CHANGE_PASSWORD: chặn cửa bằng modal đổi mật khẩu (việc 4.5). */
  function openPasswordGate(message) {
    callApp('hideLoading');
    callApp('showToast', message, 'error');
    // `{forced: true}`: modal bỏ dấu × và nút Hủy — mật khẩu tạm còn hiệu lực thì tài khoản còn mở.
    if (!callApp('showChangePasswordModal', { forced: true })) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(message);
    }
  }

  /**
   * Phát lại những lời gọi đã trượt vì cửa đóng. Gọi sau khi `authenticateUser` hoặc
   * `changePassword` thành công — đúng hai việc mở được cửa.
   */
  function flushWaiting() {
    const queued = waitingCalls;
    waitingCalls = [];
    for (let i = 0; i < queued.length; i++) {
      const item = queued[i];
      // Người đăng nhập lại KHÁC người đã bấm ⇒ bỏ, và nói rõ vì sao thay vì im lặng.
      if (item.owner && sessionOwner && item.owner !== sessionOwner) item.drop();
      else item.run();
    }
  }

  /** Đăng xuất thì bỏ hàng chờ và token cũ: phát lại sau khi đổi người là rò dữ liệu sang phiên mới. */
  function resetAfterLogout() {
    waitingCalls = [];
    cachedToken = '';
  }

  /** Một lần gọi mạng. Trả về mô tả kết quả, KHÔNG ném lỗi cho lỗi HTTP (lỗi mạng thì ném). */
  async function postRpc(name, args, token) {
    const res = await fetch(RPC_URL + encodeURIComponent(name), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        [CSRF_HEADER]: token,
      },
      body: JSON.stringify({ args: args }),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (body && body.ok === true) return { ok: true, data: body.data };
    const error = (body && body.error) || {};
    return {
      ok: false,
      status: res.status,
      code: error.code || 'INTERNAL',
      message:
        error.message ||
        'Máy chủ trả lỗi ' + res.status + ' cho hàm «' + name + '» nhưng không kèm mô tả.',
      field: error.field,
      traceId: error.traceId,
    };
  }

  /**
   * Ai đang giữ phiên, theo chính phản hồi đăng nhập mà cầu nhìn thấy (không hỏi `app.js` vì
   * `currentUser` bên đó chỉ được đặt trong `handleSuccessfulLogin`, mà đường đó đi qua
   * `getDataForUser` — hàm còn chờ Phase 5). Dùng để không phát lại lời gọi của người TRƯỚC sau
   * khi người KHÁC đăng nhập vào cùng một tab: ghi nhầm chủ thể là lỗi không sửa được về sau.
   */
  let sessionOwner = '';

  const ownerOf = (data) => (data && data.user && (data.user.email || data.user.id)) || '';

  /** Chạy tiếp một lời gọi đã trượt, sau khi cửa mở lại. */
  async function dispatch(name, args, onSuccess, onFailure, state) {
    const succeed = (data) => {
      if (typeof onSuccess === 'function') onSuccess(data);
    };
    const fail = (err) => {
      if (typeof onFailure === 'function') return onFailure(err);
      // Không có failure handler (giao diện cũ có vài chỗ như vậy) thì vẫn phải để lại dấu vết.
      if (typeof console !== 'undefined') console.error('api-bridge: ' + name + ' thất bại', err);
      return undefined;
    };

    let token;
    try {
      token = await ensureToken(false);
    } catch (err) {
      return fail(err);
    }

    let result;
    try {
      result = await postRpc(name, args, token);
    } catch {
      return fail(
        bridgeError(
          'Không kết nối được máy chủ. Kiểm tra đường mạng rồi thử lại.',
          'NETWORK_ERROR'
        )
      );
    }

    if (result.ok) {
      if (name === 'authenticateUser') {
        sessionOwner = ownerOf(result.data);
        flushWaiting();
      } else if (name === 'changePassword') {
        flushWaiting();
      } else if (name === 'logout') {
        sessionOwner = '';
        resetAfterLogout();
      }
      return succeed(result.data);
    }

    // Token lệch (máy chủ khởi động lại, phiên đổi, hoặc cookie bị xoá): lấy token mới, thử LẠI
    // đúng MỘT lần. Không giới hạn thì một 403 dai dẳng thành vòng lặp gọi mạng vô tận.
    if (result.code === 'CSRF_INVALID' && !state.csrfRetried) {
      state.csrfRetried = true;
      cachedToken = '';
      try {
        await ensureToken(true);
      } catch (err) {
        return fail(err);
      }
      return dispatch(name, args, onSuccess, onFailure, state);
    }

    // Phiên hết giữa lúc đang dùng: mở lại modal đăng nhập và GIỮ lời gọi này để phát lại (4.4).
    if (has(SESSION_GONE, result.code)) {
      if (!state.replayed) {
        state.replayed = true;
        queueForGate(name, args, onSuccess, onFailure, state, fail);
        openLoginGate();
        return undefined;
      }
      // Đã đăng nhập lại mà vẫn 401 ⇒ dừng, không phát lại lần hai (tránh vòng lặp).
      return fail(
        bridgeError(
          'Phiên đăng nhập đã hết. Hãy đăng nhập lại rồi thực hiện lại thao tác.',
          result.code,
          result.status
        )
      );
    }

    // Bắt buộc đổi mật khẩu lần đầu: chặn cửa, và cũng giữ lời gọi để làm tiếp sau khi đổi (4.5).
    if (result.code === 'MUST_CHANGE_PASSWORD') {
      if (!state.replayed) {
        state.replayed = true;
        queueForGate(name, args, onSuccess, onFailure, state, fail);
        openPasswordGate(result.message);
        return undefined;
      }
      return fail(bridgeError(result.message, result.code, result.status));
    }

    // `errorAsData`: sai mật khẩu / bị chặn vì thử nhiều lần / thiếu mật khẩu hiện tại đều là
    // "câu trả lời", không phải "sự cố" — giao diện cũ hiện chúng trong chính modal đang mở.
    if (has(ERROR_AS_DATA, name)) {
      return succeed({
        success: false,
        error: result.message,
        code: result.code,
        field: result.field,
      });
    }

    return fail(bridgeError(result.message, result.code, result.status));
  }

  /** Đưa một lời gọi vào hàng chờ, nhớ luôn chủ phiên lúc đó để không phát lại cho người khác. */
  function queueForGate(name, args, onSuccess, onFailure, state, fail) {
    waitingCalls.push({
      owner: sessionOwner,
      run: () => dispatch(name, args, onSuccess, onFailure, state),
      drop: () =>
        fail(
          bridgeError(
            'Đã đăng nhập bằng tài khoản khác, nên thao tác «' +
              name +
              '» của phiên trước bị bỏ để không ghi nhầm người thực hiện.',
            'OWNER_CHANGED'
          )
        ),
    });
  }

  /**
   * Dựng một "runner" giống `google.script.run` của Apps Script:
   *  - `withSuccessHandler` / `withFailureHandler` trả về runner MỚI (bản gốc không đổi), vì
   *    `app.js` dòng 1590 giữ lại `runner` rồi gọi hai tên khác nhau trên cùng biến đó.
   *  - 37 tên hàm là phương thức thật. Trả về Promise (Apps Script trả `undefined`) để test chờ
   *    được; `app.js` không dùng giá trị trả về nên thêm vào là vô hại.
   */
  function makeRunner(onSuccess, onFailure) {
    const runner = {
      withSuccessHandler: (fn) => makeRunner(fn, onFailure),
      withFailureHandler: (fn) => makeRunner(onSuccess, fn),
    };
    for (let i = 0; i < RPC_NAMES.length; i++) {
      const name = RPC_NAMES[i];
      runner[name] = function () {
        const args = Array.prototype.slice.call(arguments);
        return dispatch(name, args, onSuccess, onFailure, {
          csrfRetried: false,
          replayed: false,
        });
      };
    }
    // Tên gọi ĐỘNG mà đánh máy sai (hoặc hàm mới thêm ở giao diện mà quên khai trong §5.2) phải nổ
    // NGAY với câu tiếng Việt, chứ không phải "undefined is not a function" ở dòng nào đó.
    return new Proxy(runner, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop in target) return target[prop];
        return function () {
          throw bridgeError(
            'Cầu tương thích không có hàm «' +
              prop +
              '». Kiểm tra lại tên hàm (danh sách 37 tên ở §5.2).',
            'RPC_NAME_UNKNOWN'
          );
        };
      },
    });
  }

  const root = typeof window !== 'undefined' ? window : globalThis;
  root.google = root.google || {};
  root.google.script = root.google.script || {};
  root.google.script.run = makeRunner(null, null);

  /** Chỉ dành cho test (`server/tests/unit/api-bridge.test.js`) và cho việc gỡ lỗi bằng console. */
  root.__apiBridge = {
    names: RPC_NAMES.slice(),
    errorAsData: ERROR_AS_DATA.slice(),
    reset() {
      cachedToken = '';
      sessionOwner = '';
      waitingCalls = [];
    },
    pendingCount: () => waitingCalls.length,
  };
})();

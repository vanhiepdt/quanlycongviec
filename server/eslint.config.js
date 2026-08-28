import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        // Buffer: dùng để đếm ĐỘ DÀI BYTE của mật khẩu (bcrypt cắt sau 72 byte) và để so chuỗi
        // theo thời gian hằng ở cookies.js.
        Buffer: 'readonly',
      },
    },
    rules: {
      // Ba lỗi im lặng đã gặp ở bản Apps Script, nay là lỗi cứng:
      // `null: 'ignore'` cho phép đúng một ngoại lệ: `x != null` — cách gọn nhất để hỏi "có giá trị
      // không" mà vẫn coi 0 và '' là có. Điều rule này thật sự cần chặn là `'0' == false`, và
      // trường hợp đó vẫn bị chặn.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-coercion': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$|^req$|^res$' }],

      'no-console': ['warn', { allow: ['warn', 'error'] }], // log phải qua utils/logger.js
      'no-var': 'error',
      'prefer-const': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
    },
  },
  // Test của phần TRÌNH DUYỆT chạy trong jsdom (`web/assets/js/*.js`), nên có thêm `window`,
  // `document`, `fetch`. Chỉ mở cho đúng mấy file này để phần máy chủ vẫn không được phép chạm
  // vào biến toàn cục của trình duyệt.
  {
    files: [
      'tests/unit/api-bridge.test.js',
      'tests/unit/change-password-modal.test.js',
      'tests/unit/xss-escape.test.js',
      'tests/unit/pending-badge.test.js',
      'tests/unit/countable-stats-ui.test.js',
      'tests/unit/subwork-button-ui.test.js',
      'tests/unit/gantt-ui.test.js',
      // dept-select.test.js: dropdown «Phòng» của form công việc — chạy app.js thật trong jsdom.
      'tests/unit/dept-select.test.js',
      // project-form-phan-cong.test.js: simulation form tạo công việc với fetch giả — jsdom.
      'tests/unit/project-form-phan-cong.test.js',
      // task-form-candidate.test.js: nhãn «Cán bộ trực tiếp» + ứng viên chỉ Nhân viên của form
      // nhiệm vụ — chạy app.js thật trong jsdom, DOMParser để bóc form dựng bằng chuỗi.
      'tests/unit/task-form-candidate.test.js',
      // project-details-phan-cong.test.js: hàng phân công 1 hàng + khung tên CV con + icon bút
      // chì theo quyền trong modal chi tiết — chạy app.js thật + project-details.js thật trong jsdom.
      'tests/unit/project-details-phan-cong.test.js',
      // chat-ui.test.js: vòng hỏi lại 10 giây + thoát HTML của khung chat (việc 7.3) — chạy app.js
      // thật trong jsdom, fetch giả.
      'tests/unit/chat-ui.test.js',
      // export-menu.test.js: 3 liên kết xuất Excel + bộ lọc tháng gắn vào URL (việc 7.5).
      'tests/unit/export-menu.test.js',
      // tasks-nhiem-vu-ui.test.js: tab Quản lý Nhiệm vụ — lọc Tháng/Năm/Cán bộ/Phòng và gom khối
      // theo công việc con (2026-08-27) — chạy app.js thật trong jsdom.
      'tests/unit/tasks-nhiem-vu-ui.test.js',
      // pho-giam-doc-ui.test.js: Phó Giám đốc thấy tab «Quản lý công việc» + helper
      // laQuanTriTrongPhamVi() mở nút thêm/sửa (2026-08-27) — chạy app.js thật trong jsdom.
      'tests/unit/pho-giam-doc-ui.test.js',
      // uy-quyen-ui.test.js: modal «Ủy quyền của tôi» + nhãn «đang được ủy quyền» (TC-UQ-15) —
      // chạy app.js thật trong jsdom, đọc `document.cookie` để kiểm hàm lấy token CSRF.
      'tests/unit/uy-quyen-ui.test.js',
      // bo-loc-cong-viec.test.js: tab Công việc — ô Tháng/Năm giống Gantt + lọc nhóm phòng
      // (TC-CV-BL, 2026-08-28) — chạy app.js thật trong jsdom.
      'tests/unit/bo-loc-cong-viec.test.js',
      // tai-khoan-ui.test.js: trang «Quản lý tài khoản» — thông tin tài khoản + đổi mật khẩu
      // ngay trong trang (TC-TK, 2026-08-28) — chạy app.js thật trong jsdom.
      'tests/unit/tai-khoan-ui.test.js',
      // nhat-ky-ui.test.js: tab «Nhật ký» trong modal chỉnh sửa cả 3 cấp (TC-NKUI, 2026-08-28) —
      // chạy app.js thật trong jsdom, fetch giả.
      'tests/unit/nhat-ky-ui.test.js',
    ],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        globalThis: 'readonly',
        fetch: 'readonly',
        Promise: 'readonly',
        Function: 'readonly',
        JSON: 'readonly',
        Object: 'readonly',
        String: 'readonly',
        // DOMParser: dept-select.test.js phân tích HTML do buildDeptIdOptions dựng ra.
        DOMParser: 'readonly',
        // Event: project-form-phan-cong.test.js bắn sự kiện change lên ô chọn phòng.
        Event: 'readonly',
        // MouseEvent: gantt-ui.test.js bắn mouseover/mouseout lên tên dòng Gantt để test tooltip.
        MouseEvent: 'readonly',
        // Proxy: dùng ở xss-escape.test.js để chạy mã của thuộc tính on* mà không phải đoán tên hàm.
        Proxy: 'readonly',
        // localStorage: gantt-ui.test.js khẳng định trạng thái thu gọn Gantt được ghi vào đây
        // (TC-STAT-15) — jsdom cung cấp sẵn, khai để eslint không bắt no-undef.
        localStorage: 'readonly',
      },
    },
  },
  prettier,
];

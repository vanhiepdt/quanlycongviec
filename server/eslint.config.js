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

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Nạp deploy/.env để lấy TEST_DATABASE_URL. process.loadEnvFile KHÔNG ghi đè biến đã có,
// nên biến truyền từ CI vẫn thắng file.
const DOTENV = resolve(import.meta.dirname, '../deploy/.env');
if (existsSync(DOTENV)) process.loadEnvFile(DOTENV);

const TEST_DB = process.env.TEST_DATABASE_URL;
if (!TEST_DB) {
  throw new Error(
    'Thiếu TEST_DATABASE_URL. Chép deploy/.env.example thành deploy/.env rồi chạy:\n' +
      '  docker compose -f deploy/docker-compose.dev.yml up -d\n' +
      'Test KHÔNG được chạy trên CSDL dev — nó xoá bảng liên tục (§8.2).'
  );
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === TEST_DB) {
  throw new Error('DATABASE_URL và TEST_DATABASE_URL trùng nhau — test sẽ xoá CSDL dev. Dừng.');
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/global-setup.js'],
    // Test tích hợp dùng chung một CSDL: chạy tuần tự để file này không xoá bảng của file kia.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // 14 biến bắt buộc của config/env.js. Đặt ở đây để test không phụ thuộc máy ai.
    env: {
      NODE_ENV: 'test',
      PORT: '3999',
      DATABASE_URL: TEST_DB,
      SESSION_SECRET: 'test-secret-chi-dung-cho-test-du-32-ky-tu',
      SESSION_COOKIE_NAME: 'qlcv_sid_test',
      SESSION_TTL_HOURS: '1',
      SESSION_COOKIE_SECURE: 'false',
      BCRYPT_COST: '10', // 10 cho nhanh; production dùng 12 (§3.3)
      LOGIN_MAX_ATTEMPTS: '5',
      LOGIN_LOCKOUT_MINUTES: '15',
      RATE_LIMIT_WINDOW_MINUTES: '15',
      RATE_LIMIT_MAX: '1000',
      LOG_LEVEL: 'silent',
      TZ: 'Asia/Ho_Chi_Minh',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/db/migrations/**'],
      // §8.1: chung ≥ 70%. Ngưỡng 85% cho rbac/workItems/approvals/stats bật khi có code (Phase 1+).
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
});

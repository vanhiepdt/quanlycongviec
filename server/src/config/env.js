// Đọc và kiểm tra biến môi trường. Thiếu hoặc sai một biến bắt buộc là **chết ngay khi khởi
// động** — không chạy tiếp với giá trị đoán. Xem `deploy/.env.example` để biết đủ 14 biến.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOTENV_PATH = resolve(HERE, '../../../deploy/.env');

// Trên máy dev: nạp deploy/.env cho tiện. Trên production biến do Docker truyền vào,
// không đọc file — tránh cảnh file .env cũ lẫn vào container.
if (process.env.NODE_ENV !== 'production' && existsSync(DOTENV_PATH)) {
  process.loadEnvFile(DOTENV_PATH);
}

const boolFromString = z.enum(['true', 'false']).transform((v) => v === 'true');

const intIn = (min, max) =>
  z
    .string()
    .regex(/^\d+$/, 'phải là số nguyên')
    .transform(Number)
    .refine((n) => n >= min && n <= max, `phải trong khoảng ${min}–${max}`);

// 14 biến BẮT BUỘC — không có mặc định, thiếu là chết.
const required = {
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: intIn(1, 65535),
  DATABASE_URL: z.string().startsWith('postgres', 'phải là URL postgres://'),
  SESSION_SECRET: z.string().min(32, 'cần ít nhất 32 ký tự'),
  SESSION_COOKIE_NAME: z.string().min(1),
  SESSION_TTL_HOURS: intIn(1, 720),
  SESSION_COOKIE_SECURE: boolFromString,
  BCRYPT_COST: intIn(10, 15),
  LOGIN_MAX_ATTEMPTS: intIn(1, 20),
  LOGIN_LOCKOUT_MINUTES: intIn(1, 1440),
  RATE_LIMIT_WINDOW_MINUTES: intIn(1, 60),
  RATE_LIMIT_MAX: intIn(1, 10000),
  // 'silent' là mức hợp lệ của pino — dùng khi chạy test để log không lẫn vào kết quả.
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  TZ: z.string().min(1),
};

// Biến TUỲ CHỌN — có mặc định an toàn, thiếu vẫn chạy.
const optional = {
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  DB_POOL_MAX: intIn(1, 100).default('10'),
  DB_STATEMENT_TIMEOUT_MS: intIn(100, 600000).default('15000'),
  CRON_OVERDUE: z.string().default('0 7 * * *'),
  // Dọn tin chat cũ (§7 việc 7.4). Hằng tuần, 03:30 Chủ nhật: giờ thấp điểm, và một tuần một lần
  // là đủ vì mốc giữ lại tính theo ngày chứ không theo lượt chạy.
  CRON_CHAT_CLEANUP: z.string().default('30 3 * * 0'),
  // Số ngày giữ lại tin chat. 90 theo §7 việc 7.4; để ở env cho lần cần đổi mà không sửa mã.
  CHAT_KEEP_DAYS: intIn(1, 3650).default('90'),
  // Cờ tắt lịch chạy (§7 việc 5.8). MẶC ĐỊNH TẮT chứ không bật: staging và máy dev dùng chung
  // một CSDL bản sao, hai container cùng bật lịch là hai lượt thông báo trùng cho mỗi người.
  // Production bật tường minh trong `deploy/.env`.
  CRON_ENABLED: boolFromString.default('false'),
  MAIL_ENABLED: boolFromString.default('false'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: intIn(1, 65535).default('587'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  // ONLYOFFICE Document Server (Vòng 14 — sửa file trực tuyến). Trống = TẮT: nút «sửa trực
  // tuyến» chỉ hiện khi cả URL lẫn JWT secret được cấu hình. Ví dụ máy dev (docker `busy_merkle`,
  // cổng 80): ONLYOFFICE_URL=http://localhost · ONLYOFFICE_JWT_SECRET=my_jwt_secret ·
  // ONLYOFFICE_CALLBACK_BASE=http://host.docker.internal:3000 (DS container gọi NGƯỢC về app).
  ONLYOFFICE_URL: z.string().default(''),
  ONLYOFFICE_JWT_SECRET: z.string().default(''),
  ONLYOFFICE_CALLBACK_BASE: z.string().default(''),
};

const schema = z.object({ ...required, ...optional });

export const REQUIRED_ENV_KEYS = Object.keys(required);
export const OPTIONAL_ENV_KEYS = Object.keys(optional);

/** Kiểm tra một object môi trường. Trả về {ok, env} hoặc {ok:false, problems}. */
export function parseEnv(source) {
  const result = schema.safeParse(source);
  if (result.success) return { ok: true, env: Object.freeze(result.data) };
  const problems = result.error.issues.map(
    (i) => `  - ${i.path.join('.') || '(gốc)'}: ${i.message}`
  );
  return { ok: false, problems };
}

function loadOrDie() {
  const parsed = parseEnv(process.env);
  if (parsed.ok) return parsed.env;
  // Không dùng logger ở đây: logger cần LOG_LEVEL, mà LOG_LEVEL có thể chính là biến đang thiếu.
  process.stderr.write(
    'Biến môi trường không hợp lệ, dừng khởi động:\n' +
      parsed.problems.join('\n') +
      `\nXem deploy/.env.example (${REQUIRED_ENV_KEYS.length} biến bắt buộc).\n`
  );
  process.exit(1);
}

export const env = loadOrDie();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export default env;

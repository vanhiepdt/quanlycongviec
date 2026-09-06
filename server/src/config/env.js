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
  // ZALO BOT (017, việc B của `docs/KE-HOACH-THONG-BAO.md`). Trống = TẮT HẲN: không gọi mạng, không
  // hiện khối liên kết trên giao diện. Cùng khuôn ONLYOFFICE_* ở trên.
  //
  // `ZALO_BOT_TOKEN` là BÍ MẬT và khác mọi bí mật khác của repo ở một điểm nguy hiểm: nó nằm TRONG
  // ĐƯỜNG DẪN (`/bot<token>/sendMessage`), không phải trong header hay body. `utils/logger.js` chỉ
  // che 8 đường dẫn cố định về cookie/password, KHÔNG che theo tên biến — nên `services/zalo.js`
  // phải tự cắt token trước khi log và không được để lỗi thô của `fetch` (có `cause` chứa URL) đi
  // tới errorHandler.
  ZALO_BOT_TOKEN: z.string().default(''),
  // Khoá bí mật của webhook, PHẢI trùng giá trị đã nhập ở trang Zalo Bot Creator. Tài liệu Zalo:
  // 8–256 ký tự, Zalo gắn vào header `X-Bot-Api-Secret-Token` của mọi request gọi về.
  // KHÔNG kiểm độ dài ở đây: mặc định là '' (tắt), mà `.min(8)` sẽ làm MỌI lần khởi động chết vì ''
  // không đủ 8 ký tự. Kiểm ở chỗ dùng, đúng như bẫy đã ghi trong §13.5.
  ZALO_BOT_SECRET_TOKEN: z.string().default(''),
  // Đổi được để test trỏ vào máy chủ giả, và để Zalo dời tên miền thì không phải sửa mã.
  ZALO_BOT_API_BASE: z.string().default('https://bot-api.zaloplatforms.com'),
  // Cách NHẬN tin từ bot. `webhook` cần domain công khai + HTTPS (tài liệu Zalo từ chối localhost và
  // IP nội bộ) nên chỉ dùng được từ Phase 8; `polling` chạy được ngay trên PC (§13.4 mục 2). Hai
  // cách LOẠI TRỪ LẪN NHAU ở phía Zalo: đặt webhook rồi thì `getUpdates` ngừng trả sự kiện.
  ZALO_BOT_NHAN: z.enum(['tat', 'polling', 'webhook']).default('tat'),
  // Lịch đẩy hàng đợi Zalo. Nằm cùng cờ CRON_ENABLED — chú thích `services/cron.js` đã chốt «không
  // có cờ riêng» vì máy dev và staging dùng chung CSDL bản sao.
  CRON_ZALO_PUSH: z.string().default('*/2 * * * *'),
  // Bỏ qua thông báo cũ hơn N giờ: container tắt ba ngày rồi bật lại không được dội một tràng tin.
  ZALO_PUSH_MAX_AGE_H: intIn(1, 720).default('24'),
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

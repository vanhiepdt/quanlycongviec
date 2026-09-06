// Một logger duy nhất cho cả tiến trình. JSON để ghép được với `docker logs`; trên máy dev
// thì in ra cho người đọc.
import pino from 'pino';
import { env, isProd, isTest } from '../config/env.js';

// Mọi đường dẫn có thể chứa bí mật. Thêm header mới mà Zalo/gửi-đi gửi kèm bí mật thì THÊM VÀO ĐÂY.
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  // Chữ ký webhook Zalo (Phase 8 việc 6): header này đi theo MỖI request Zalo gọi tới —
  // không che thì bí mật nằm nguyên trong `docker logs` (đã xảy ra thật 2026-09-06).
  'req.headers["x-bot-api-secret-token"]',
  'password',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'password_hash',
  '*.password',
  '*.password_hash',
  // Dạng lồng (vd `doiPass.newPassword`): đường dẫn không có `*.` chỉ khớp tầng ngoài cùng.
  '*.newPassword',
  '*.oldPassword',
  '*.currentPassword',
];

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: undefined, // bỏ pid/hostname: không dùng đến mà làm log dài
  timestamp: pino.stdTimeFunctions.isoTime,
  // Không bao giờ để mật khẩu / cookie / token lọt vào log.
  // Danh sách export ra để test (`tests/unit/logger-redact.test.js`) chốt được.
  redact: { paths: REDACT_PATHS, censor: '[đã che]' },
  transport: isProd ? undefined : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } },
});

export default logger;

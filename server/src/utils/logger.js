// Một logger duy nhất cho cả tiến trình. JSON để ghép được với `docker logs`; trên máy dev
// thì in ra cho người đọc.
import pino from 'pino';
import { env, isProd, isTest } from '../config/env.js';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: undefined, // bỏ pid/hostname: không dùng đến mà làm log dài
  timestamp: pino.stdTimeFunctions.isoTime,
  // Không bao giờ để mật khẩu / cookie / token lọt vào log.
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'newPassword',
      'oldPassword',
      'password_hash',
      '*.password',
      '*.password_hash',
    ],
    censor: '[đã che]',
  },
  transport: isProd ? undefined : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } },
});

export default logger;

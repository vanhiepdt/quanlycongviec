// Dựng Express. Phase 0 chỉ có bộ xương + /healthz; route nghiệp vụ vào từ Phase 1.
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env, isTest } from './config/env.js';
import { query } from './db/pool.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  // Sau Nginx: cần trust proxy để lấy đúng IP thật cho nhật ký và giới hạn tần suất.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  if (!isTest) app.use(pinoHttp({ logger }));

  // M4 — /healthz cho Nginx và giám sát. CÔNG KHAI, không cần đăng nhập: đó là chủ ý, vì
  // Nginx phải gọi được. Vì vậy nó chỉ trả trạng thái, KHÔNG trả số liệu hay tên bảng.
  app.get('/healthz', (req, res) => {
    res.json({ ok: true, uptime_s: Math.round(process.uptime()) });
  });

  // /readyz có kiểm CSDL — dùng khi lên bản mới để biết đã sẵn sàng nhận tải chưa.
  app.get('/readyz', async (req, res) => {
    try {
      await query('SELECT 1');
      res.json({ ok: true, db: 'up' });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  // 404 theo đúng quy ước phản hồi §5.3.
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Không tìm thấy đường dẫn này' });
  });

  // Bộ xử lý lỗi cuối. Không bao giờ trả stack trace ra ngoài.
  app.use((err, req, res, next) => {
    logger.error({ err: err.message, stack: err.stack, url: req.originalUrl }, 'Lỗi chưa xử lý');
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
      success: false,
      error: env.NODE_ENV === 'production' ? 'Lỗi hệ thống, vui lòng thử lại' : err.message,
    });
  });

  return app;
}

export default createApp;

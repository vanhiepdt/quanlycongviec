// Điểm vào: chỉ lo đọc env, mở cổng, tắt êm. Mọi thứ khác ở app.js để test gọi được
// bằng supertest mà không cần mở cổng thật.
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, query } from './db/pool.js';
import { batLichChay, dungLichChay } from './services/cron.js';
import { logger } from './utils/logger.js';

const app = createApp();

// Kiểm tra CSDL trước khi nhận request đầu tiên: thà chết lúc khởi động còn hơn trả lỗi 500
// cho người dùng ở request đầu.
try {
  await query('SELECT 1');
} catch (err) {
  logger.fatal({ err: err.message }, 'Không kết nối được CSDL, dừng khởi động');
  process.exit(1);
}

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, tz: env.TZ },
    'Máy chủ quản lý công việc đã sẵn sàng'
  );
});

// Lịch chạy bật SAU khi cổng đã mở: một lượt quét hỏng không được ngăn máy chủ phục vụ người
// dùng. `batLichChay` tự xem cờ `CRON_ENABLED`, ở đây không kiểm lại (§7 việc 5.8).
batLichChay();

function shutdown(signal) {
  logger.info({ signal }, 'Đang tắt máy chủ');
  dungLichChay();
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  // Hết 10 giây mà request cũ chưa xong thì tắt cứng, không treo container.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'Promise bị bỏ rơi');
});

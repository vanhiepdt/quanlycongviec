// Dựng Express: thứ tự middleware ở đây là phần dễ sai nhất của cả tầng máy chủ, nên mỗi lớp
// đều ghi rõ vì sao nó phải nằm đúng chỗ đó.
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { isTest } from './config/env.js';
import { query } from './db/pool.js';
import { audit } from './middleware/audit.js';
import { issueCsrfCookie, verifyCsrf } from './middleware/csrf.js';
import { errorHandler, notFoundHandler, ok } from './middleware/errorHandler.js';
import { attachSession, requirePasswordChanged } from './middleware/session.js';
import { approvalsRouter } from './modules/approvals/routes.js';
import { appsRouter } from './modules/apps/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { bootstrapRouter } from './modules/bootstrap/routes.js';
import { chatRouter } from './modules/chat/routes.js';
import { delegationsRouter } from './modules/delegations/routes.js';
import { departmentsRouter } from './modules/departments/routes.js';
import { exportRouter } from './modules/export/routes.js';
import { ganttRouter } from './modules/gantt/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { permissionsRouter } from './modules/permissions/routes.js';
import { proposalsRouter } from './modules/proposals/routes.js';
import { statsRouter } from './modules/stats/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { worksRouter } from './modules/works/routes.js';
import { workItemsRouter } from './modules/workItems/routes.js';
import { createRpcRouter } from './rpc/index.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  // Sau Nginx: cần trust proxy để lấy đúng IP thật cho nhật ký và giới hạn tần suất.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser()); // không dùng secret: cookie phiên tự ký bằng HMAC ở cookies.js
  if (!isTest) app.use(pinoHttp({ logger }));

  // M4 — /healthz cho Nginx và giám sát. CÔNG KHAI, không cần đăng nhập: đó là chủ ý, vì
  // Nginx phải gọi được. Vì vậy nó chỉ trả trạng thái, KHÔNG trả số liệu hay tên bảng.
  // Đặt TRƯỚC attachSession để mỗi lần Nginx ping không phải đi một vòng CSDL.
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

  const api = express.Router();

  // Thứ tự bốn lớp dưới đây là cố ý:
  //  1. attachSession    — mọi lớp sau đều cần biết ai đang gọi.
  //  2. issueCsrfCookie  — token phát ra phải suy từ phiên vừa đọc được ở (1).
  //  3. verifyCsrf       — chặn request ghi từ trang khác trước khi nó chạm nghiệp vụ.
  //  4. audit            — chỉ đăng ký `res.on('finish')`, ghi sau khi phản hồi đã gửi.
  api.use(attachSession);
  api.use(issueCsrfCookie);
  api.use(verifyCsrf);
  api.use(audit);

  // Trình duyệt lấy token CSRF ở đây trước khi gọi bất kỳ API ghi nào (kể cả đăng nhập).
  api.get('/csrf', (req, res) => ok(res, { csrfToken: res.locals.csrfToken }));

  // MỘT bản thứ tự middleware cho cả `/api/v1/*` và cầu RPC: cầu RPC gọi LẠI router này (xem
  // `rpc/subrequest.js`) nên nó không thể có bản dựng riêng — hai bản là hai bộ luật quyền.
  const v1 = createV1Router();
  api.use('/v1', v1);

  // Cầu tương thích cho giao diện cũ (§5.1). Đặt SAU `/v1` cho dễ đọc; thứ tự không quan trọng vì
  // hai tiền tố đường dẫn khác nhau. `loginRateLimiter` cho `authenticateUser` gắn bên trong
  // `createRpcRouter` — nếu thiếu, cầu RPC thành đường vòng thoát khỏi chặn dò mật khẩu (§7 1.10).
  api.use('/rpc', createRpcRouter(v1));

  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Router `/api/v1`. Tách thành hàm riêng vì cầu RPC phải chạy đúng chuỗi middleware này.
 *
 * `requirePasswordChanged` ĐẶT SAU route auth và TRƯỚC mọi route nghiệp vụ: Express xét theo thứ
 * tự khai báo, nên `/api/v1/auth/*` không bao giờ chạm tới đây — người bị bắt đổi mật khẩu vẫn gọi
 * được `/v1/auth/password` để tự thoát, còn phần còn lại của hệ thống thì bị chặn (§7 việc 1.8,
 * TC-AUTH-10).
 */
export function createV1Router() {
  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use(requirePasswordChanged);
  v1.use('/bootstrap', bootstrapRouter);
  v1.use('/departments', departmentsRouter);
  v1.use('/users', usersRouter);
  v1.use('/works', worksRouter);
  v1.use('/work-items', workItemsRouter);
  v1.use('/approvals', approvalsRouter);
  // Thống kê + Gantt — REST MỚI của Phase 6 (§5.1: từ Phase 6 tính năng mới dùng /api/v1/*).
  v1.use('/stats', statsRouter);
  v1.use('/gantt', ganttRouter);
  // Phase 7 — Đề nghị, Quản lý App, Chat, Thông báo, xuất Excel.
  v1.use('/proposals', proposalsRouter);
  v1.use('/apps', appsRouter);
  v1.use('/chat', chatRouter);
  v1.use('/notifications', notificationsRouter);
  v1.use('/export', exportRouter);
  // Ủy quyền có thời hạn (`docs/KE-HOACH-UY-QUYEN.md`). Đặt sau `requirePasswordChanged`: người
  // còn phải đổi mật khẩu lần đầu thì chưa được cho ai mượn quyền của mình.
  v1.use('/delegations', delegationsRouter);
  // Bảng phân quyền hệ thống — Giám đốc sửa bằng dropdown (Vòng 9, 009_permission_overrides.sql).
  v1.use('/permissions', permissionsRouter);
  return v1;
}

export default createApp;

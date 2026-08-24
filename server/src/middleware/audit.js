// Ghi nhật ký mọi request GHI thành công vào `activity_logs` (§7 việc 1.9).
//
// Đặt ở gốc `/api` một lần, KHÔNG gọi rải trong từng handler: bản Sheets gọi `logActivity()` tay
// ở từng hàm nên chỗ nào quên là mất dấu vết, và đúng những chỗ hay quên lại là chỗ cần điều tra.
//
// Ba nguyên tắc:
//  1. Chỉ ghi khi request đã **thành công** (status < 400). Lỗi thì đã có log ứng dụng.
//  2. Ghi SAU khi phản hồi đã gửi (`res.on('finish')`) — nhật ký không được làm chậm người dùng.
//  3. **Không bao giờ** tự đưa `req.body` vào `details`: thân request chứa mật khẩu. Handler nào
//     cần chi tiết thì tự đặt `res.locals.audit.details` với đúng những trường an toàn.
import { writeLog } from '../modules/activityLogs/repo.js';
import { logger } from '../utils/logger.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Tên hành động mặc định: `POST /api/v1/auth/login`. Handler nên đặt tên nghiệp vụ rõ hơn. */
function defaultAction(req) {
  const path = `${req.baseUrl || ''}${req.route?.path && req.route.path !== '/' ? req.route.path : req.path}`;
  return `${req.method} ${path || req.originalUrl.split('?')[0]}`;
}

export function audit(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400 || res.locals.skipAudit) return;
    const extra = res.locals.audit ?? {};
    // Người vừa đăng nhập chưa có req.user (phiên tạo trong handler) — handler đặt actorId vào
    // res.locals.audit để dòng nhật ký không bị mất chủ thể.
    writeLog({
      actorId: extra.actorId ?? req.user?.id ?? null,
      actorName: extra.actorName ?? req.user?.full_name ?? '',
      action: extra.action ?? defaultAction(req),
      entityType: extra.entityType ?? '',
      entityId: extra.entityId ?? null,
      workId: extra.workId ?? null,
      details: extra.details ?? {},
      ip: req.ip ?? null,
    }).catch((err) => logger.warn({ err: err.message }, 'Không ghi được activity_logs'));
  });

  return next();
}

export default audit;

// Route xác thực. Vỏ HTTP mỏng: kiểm dữ liệu, gọi service, đặt cookie, đặt tên nhật ký.
// Không có nghiệp vụ nào ở đây — nghiệp vụ nằm ở `service.js` để test được mà không cần HTTP.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { loginRateLimiter } from '../../middleware/rateLimit.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import {
  clearCsrfCookie,
  clearSessionCookie,
  csrfTokenFor,
  setCsrfCookie,
  setSessionCookie,
} from './cookies.js';
import * as service from './service.js';

const loginSchema = z.object({
  // Cắt trắng hai đầu (TC-AUTH-04). Hoa/thường do cột `citext` lo (TC-AUTH-03).
  email: z.string().trim().min(1, 'Vui lòng nhập email').max(200),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(200),
  newPassword: z.string().min(1, 'Vui lòng nhập mật khẩu mới').max(200),
});

export const authRouter = Router();

// Token CSRF lấy ở `GET /api/csrf` (khai trong app.js) — một đường duy nhất cho cả hệ thống,
// không nhân bản ở đây.

authRouter.post('/login', loginRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { user, session, csrfToken } = await service.login({
      email: req.body.email,
      password: req.body.password,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? '',
    });
    setSessionCookie(res, session.id, new Date(session.expires_at));
    setCsrfCookie(res, csrfToken);
    // Người vừa đăng nhập chưa có req.user, nên nói rõ chủ thể cho nhật ký.
    res.locals.audit = {
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorName: user.full_name,
    };
    return ok(res, { user, csrfToken, expiresAt: session.expires_at });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    await service.logout(req.sessionId ?? null);
    clearSessionCookie(res);
    clearCsrfCookie(res);
    res.locals.audit = {
      action: 'auth.logout',
      entityType: 'user',
      entityId: req.user?.id ?? null,
    };
    return ok(res, { loggedOut: true });
  } catch (err) {
    return next(err);
  }
});

/** Ai đang đăng nhập. Frontend gọi ngay khi tải trang để biết hiện màn hình nào. */
authRouter.get('/me', requireAuth, (req, res) =>
  ok(res, { user: req.user, csrfToken: csrfTokenFor(req.sessionId) })
);

/**
 * Đổi mật khẩu. KHÔNG qua `requirePasswordChanged` — người bị bắt đổi lần đầu phải gọi được
 * đúng API này, nếu không thì họ không có đường nào ra khỏi trạng thái đó (§7 việc 1.8).
 */
authRouter.post(
  '/password',
  requireAuth,
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      const result = await service.changePassword({
        userId: req.user.id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        keepSid: req.sessionId ?? null,
      });
      res.locals.audit = {
        action: 'auth.changePassword',
        entityType: 'user',
        entityId: req.user.id,
        details: { revokedSessions: result.revokedSessions },
      };
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  }
);

export default authRouter;

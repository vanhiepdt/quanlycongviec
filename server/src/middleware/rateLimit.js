// Giới hạn tần suất theo IP cho các đường dẫn dễ bị dò mật khẩu (§7 việc 1.10).
//
// Đây là lớp thứ hai, KHÁC với khoá tài khoản: khoá tài khoản chặn kẻ dò một tài khoản bằng
// nhiều lần thử; giới hạn IP chặn kẻ dò nhiều tài khoản bằng cùng một máy (mỗi tài khoản một
// lần thử thì bộ đếm của từng tài khoản không bao giờ chạm ngưỡng).
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { fail } from './errorHandler.js';

/**
 * @param {{max?: number, windowMinutes?: number}} [opts] để test dựng bản ngưỡng thấp
 */
export function makeRateLimiter(opts = {}) {
  const windowMinutes = opts.windowMinutes ?? env.RATE_LIMIT_WINDOW_MINUTES;
  const max = opts.max ?? env.RATE_LIMIT_MAX;
  return rateLimit({
    windowMs: windowMinutes * 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Đếm cả lần thành công: kẻ dò có thể vào được một tài khoản rồi tiếp tục dò tài khoản khác.
    skipSuccessfulRequests: false,
    /**
     * KHÔNG đếm lời gọi con của cầu RPC (`rpc/subrequest.js`). Một lần bấm "Đăng nhập" ở giao diện
     * cũ là MỘT request HTTP: `POST /api/rpc/authenticateUser` đã bị đếm ở cửa, rồi cầu gọi lại
     * `POST /api/v1/auth/login` trong cùng tiến trình. Không loại trừ thì mỗi lần thử trừ hai lượt,
     * tức ngưỡng thật của người dùng giao diện cũ chỉ còn một nửa (§13.5).
     */
    skip: (req) => req.rpcSubRequest === true,
    handler: (req, res) =>
      fail(
        res,
        429,
        'RATE_LIMITED',
        `Bạn đã thử quá nhiều lần. Vui lòng chờ ${windowMinutes} phút rồi thử lại.`
      ),
  });
}

/** Bộ giới hạn dùng cho đăng nhập. Tạo sẵn một bản để mọi route đăng nhập dùng chung bộ đếm. */
export const loginRateLimiter = makeRateLimiter();

export default loginRateLimiter;

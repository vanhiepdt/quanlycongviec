// CSRF theo kiểu "gửi hai lần" (double submit): giá trị nằm trong một cookie **đọc được** và
// phải được gửi lặp lại ở header `X-CSRF-Token` (§7 việc 1.5).
//
// Vì sao vẫn cần dù cookie phiên đã SameSite=Lax: Lax vẫn cho gửi cookie ở điều hướng cấp cao
// (GET), và một trang khác vẫn có thể mở form POST qua đường vòng. Hai lớp chặn thì rẻ.
//
// Người đã đăng nhập: token = HMAC(id phiên) nên **không lưu thêm cột nào**, máy chủ khởi động
// lại vẫn tính ra đúng token cũ. Khách chưa đăng nhập (chính lời gọi đăng nhập): token ngẫu
// nhiên, chỉ cần cookie và header khớp nhau.
import { AppError } from '../utils/errors.js';
import {
  anonymousCsrfToken,
  csrfTokenFor,
  CSRF_COOKIE,
  CSRF_HEADER,
  safeEqual,
  setCsrfCookie,
} from '../modules/auth/cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Phát cookie CSRF ở các request đọc. Đặt SAU attachSession để biết có phiên hay chưa. */
export function issueCsrfCookie(req, res, next) {
  if (!SAFE_METHODS.has(req.method)) return next();
  const wanted = req.sessionId ? csrfTokenFor(req.sessionId) : req.cookies?.[CSRF_COOKIE];
  res.locals.csrfToken = wanted || setCsrfCookie(res, anonymousCsrfToken());
  if (wanted && wanted !== req.cookies?.[CSRF_COOKIE]) setCsrfCookie(res, wanted);
  return next();
}

/** Chặn mọi POST/PATCH/PUT/DELETE không có token khớp. */
export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const fromCookie = req.cookies?.[CSRF_COOKIE];
  const fromHeader = req.get(CSRF_HEADER);
  const invalid = () =>
    next(new AppError('CSRF_INVALID', 'Yêu cầu không hợp lệ, hãy tải lại trang rồi thử lại'));

  if (!fromCookie || !fromHeader || !safeEqual(fromCookie, fromHeader)) return invalid();
  // Đã đăng nhập: token phải đúng là token suy ra từ phiên hiện tại, không nhận token cũ của
  // phiên trước hay token của người khác.
  if (req.sessionId && !safeEqual(fromCookie, csrfTokenFor(req.sessionId))) return invalid();
  return next();
}

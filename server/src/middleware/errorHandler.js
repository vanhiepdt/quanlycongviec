// Bộ xử lý lỗi cuối cùng. Đây là **chỗ duy nhất** biến lỗi thành phản hồi HTTP, nên hình dạng
// lỗi ở §5.3 chỉ cần đúng ở một file.
//
// Hai loại lỗi:
//   - `AppError` (đã lường trước): trả nguyên `code` + `message` tiếng Việt.
//   - còn lại: trả `INTERNAL` + `traceId`, ghi log đầy đủ phía server. KHÔNG bao giờ trả
//     stack trace ra trình duyệt, kể cả trên máy dev — vì frontend sẽ vô tình hiện nó cho
//     người dùng và đó là đường rò thông tin hệ thống.
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/** Phản hồi thành công theo §5.3. */
export function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

/** Phản hồi lỗi theo §5.3. Dùng cho 404 và cho errorHandler. */
export function fail(res, status, code, message, extra = {}) {
  return res.status(status).json({ ok: false, error: { code, message, ...extra } });
}

/** 404 cho đường dẫn không có route nào nhận. Đặt SAU mọi route, TRƯỚC errorHandler. */
export function notFoundHandler(req, res) {
  return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy đường dẫn này');
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    // Lỗi nghiệp vụ bình thường (sai mật khẩu, thiếu quyền): ghi ở mức debug để không làm
    // ngập log. Ai cần điều tra thì đọc activity_logs.
    logger.debug({ code: err.code, url: req.originalUrl }, err.message);
    const extra = {};
    if (err.field) extra.field = err.field;
    return fail(res, err.status, err.code, err.message, extra);
  }

  // Lỗi JSON hỏng do express.json() ném ra — là lỗi của phía gọi, không phải lỗi hệ thống.
  if (err.type === 'entity.parse.failed') {
    return fail(res, 400, 'BAD_REQUEST', 'Nội dung gửi lên không phải JSON hợp lệ');
  }
  if (err.type === 'entity.too.large') {
    return fail(res, 413, 'BAD_REQUEST', 'Nội dung gửi lên quá lớn');
  }

  const traceId = randomUUID();
  logger.error(
    { traceId, err: err.message, stack: err.stack, url: req.originalUrl, method: req.method },
    'Lỗi chưa xử lý'
  );
  return fail(res, err.status ?? 500, 'INTERNAL', 'Lỗi hệ thống, vui lòng thử lại', { traceId });
}

export default errorHandler;

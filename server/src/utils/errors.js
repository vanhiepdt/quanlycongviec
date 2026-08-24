// Lỗi có chủ đích của ứng dụng. Mọi lỗi trả cho người dùng phải đi qua đây để có đúng ba
// thứ: mã máy đọc (`code`), câu tiếng Việt cho người đọc (`message`), và mã HTTP (§5.3).
//
// Vì sao không dùng Error thường: bản Apps Script trả `{success:false, error:"..."}` với câu
// chữ tự do, nên frontend phải so sánh chuỗi tiếng Việt để biết chuyện gì xảy ra. Đổi một chữ
// là vỡ một nhánh xử lý mà không ai biết. `code` cắt hẳn đường đó.

/** Mã HTTP mặc định cho từng mã lỗi (§5.3). Mã nào không có ở đây coi như 400. */
export const ERROR_STATUS = Object.freeze({
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 401,
  FORBIDDEN: 403,
  MUST_CHANGE_PASSWORD: 403,
  CSRF_INVALID: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL: 500,
});

export class AppError extends Error {
  /**
   * @param {string} code mã máy đọc, ví dụ 'MUST_CHANGE_PASSWORD'
   * @param {string} message câu tiếng Việt hiện thẳng cho người dùng
   * @param {{status?: number, field?: string, details?: object}} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = opts.status ?? ERROR_STATUS[code] ?? 400;
    if (opts.field) this.field = opts.field;
    if (opts.details) this.details = opts.details;
    // Cờ để errorHandler biết đây là lỗi đã lường trước, được phép hiện nguyên văn.
    this.expected = true;
  }
}

export const badRequest = (message, field) => new AppError('BAD_REQUEST', message, { field });
export const unauthenticated = (message = 'Bạn chưa đăng nhập hoặc phiên đã hết hạn') =>
  new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'Bạn không có quyền thực hiện hành động này') =>
  new AppError('FORBIDDEN', message);
export const notFound = (message = 'Không tìm thấy dữ liệu') => new AppError('NOT_FOUND', message);
export const conflict = (message, field) => new AppError('CONFLICT', message, { field });

export default AppError;

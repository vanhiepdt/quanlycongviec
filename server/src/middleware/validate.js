// Kiểm dữ liệu vào bằng zod. Route khai schema, middleware này lo phần lỗi — nhờ vậy thông báo
// lỗi kiểm dữ liệu có cùng một hình dạng ở mọi API (§5.3) thay vì mỗi handler viết một kiểu.
//
// Dữ liệu sau khi kiểm được **ghi đè** lên `req.body` / `req.query`: từ đó trở đi handler chỉ
// thấy dữ liệu đã lọc, không còn khoá lạ mà người gọi thêm vào.
import { AppError } from '../utils/errors.js';

/**
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.') || undefined;
      return next(new AppError('VALIDATION_ERROR', issue.message, { field }));
    }
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;
    return next();
  };
}

export default validate;

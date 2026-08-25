// Gọi LẠI route `/api/v1/*` từ trong tiến trình, không qua mạng (§5.1).
//
// Vì sao không gọi thẳng service: một tên hàm cũ phải đi qua đúng route REST tương ứng — kể cả
// `validate()` (zod), `requireAuth`, `requirePasswordChanged` và nhật ký. Gọi service trực tiếp
// là tự viết lại nửa cái route, và nửa viết lại đó sẽ lệch dần khỏi bản thật mà không test nào
// bắt được. Gọi lại router thì chỉ có MỘT bản luật.
//
// Vì sao không sửa thẳng `req.url` của request ngoài: một tên hàm cũ có thể cần NHIỀU lời gọi
// (`getTasks` quét từng công việc; `updateTaskReminder` phải đọc danh sách để đổi số thứ tự thành
// id). Một `res` chỉ ghi được một lần, nên mỗi lời gọi con cần `res` giả riêng.
import { AppError } from '../utils/errors.js';

/**
 * `res` giả cho một lời gọi con.
 *
 * Phần TIÊU ĐỀ và COOKIE được chuyển thẳng sang `res` thật — nếu không thì `authenticateUser`
 * đăng nhập xong mà trình duyệt không nhận được cookie phiên nào.
 * `locals` dùng CHUNG với `res` thật để `res.locals.audit` mà handler đặt vẫn tới được middleware
 * `audit` (nó lắng nghe `finish` trên `res` thật).
 */
function makeSubResponse(outerRes, resolve) {
  const res = {
    statusCode: 200,
    locals: outerRes.locals,
    app: outerRes.app,
    headersSent: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      resolve({ status: res.statusCode, body });
      return res;
    },
    send(body) {
      resolve({ status: res.statusCode, body });
      return res;
    },
    end() {
      resolve({ status: res.statusCode, body: undefined });
      return res;
    },
    set: (...args) => (outerRes.set(...args), res),
    header: (...args) => (outerRes.set(...args), res),
    setHeader: (...args) => (outerRes.setHeader(...args), res),
    getHeader: (name) => outerRes.getHeader(name),
    get: (name) => outerRes.get(name),
    append: (...args) => (outerRes.append(...args), res),
    vary: (...args) => (outerRes.vary(...args), res),
    cookie: (...args) => (outerRes.cookie(...args), res),
    clearCookie: (...args) => (outerRes.clearCookie(...args), res),
    on: () => res,
    once: () => res,
    removeListener: () => res,
  };
  return res;
}

/**
 * Chạy một lời gọi con qua `router`.
 *
 * @param {Function} router router `/api/v1` (chính hàm router của Express)
 * @param {object} req request ngoài — dùng làm nguyên mẫu để thừa hưởng `user`, `cookies`, `ip`…
 * @param {object} outerRes response thật
 * @param {{method: string, path: string, body?: object, query?: object}} call
 * @returns {Promise<{status: number, body: any}>}
 */
export function callV1(router, req, outerRes, { method, path, body = {}, query = {} }) {
  return new Promise((resolve, reject) => {
    const sub = Object.create(req);
    sub.method = String(method).toUpperCase();
    sub.url = path;
    sub.originalUrl = `/api/v1${path}`;
    sub.baseUrl = '';
    sub.body = body;
    sub.params = {};
    // `req.query` của Express 5 là getter suy từ `req.url`; đặt thuộc tính riêng ở đây để đè hẳn,
    // vì lời gọi con dựng sẵn tham số dạng đối tượng chứ không ghép chuỗi truy vấn.
    Object.defineProperty(sub, 'query', { value: query, configurable: true, enumerable: true });
    // Đánh dấu để middleware biết đây là lời gọi con của cầu RPC, không phải request thật.
    sub.rpcSubRequest = true;

    const res = makeSubResponse(outerRes, resolve);
    sub.res = res;

    try {
      router(sub, res, (err) => {
        if (err) return reject(err);
        // Không route nào nhận: đây là lỗi của BẢNG ÁNH XẠ trong `table.js`, không phải lỗi người
        // dùng — nói thẳng đường dẫn sai để sửa được, đừng trả 404 mơ hồ.
        return reject(
          new AppError('INTERNAL', `Cầu RPC trỏ sai đường dẫn: ${sub.method} ${path}`, {
            status: 500,
          })
        );
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Như `callV1` nhưng bắt buộc phải thành công: lỗi §5.3 trong thân phản hồi được ném lại thành
 * `AppError` để `errorHandler` chung dịch ra đúng mã HTTP và câu tiếng Việt.
 */
export async function callV1OrThrow(router, req, outerRes, call) {
  const { status, body } = await callV1(router, req, outerRes, call);
  if (body?.ok === true) return body.data;
  const error = body?.error ?? {};
  throw new AppError(error.code ?? 'INTERNAL', error.message ?? 'Lỗi hệ thống', {
    status,
    field: error.field,
  });
}

export default callV1;

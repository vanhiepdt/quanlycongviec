// DỊCH lỗi PostgreSQL thành `AppError` có mã §5.3.
//
// Vì sao dịch chứ không kiểm lại ở JS: các quy tắc cây 3 tầng (cha phải là cấp 2, cha cùng công
// việc, công việc con không có cha, không tự trỏ, chỉ cấp 3 có nhắc việc) đã nằm trong CHECK và
// trigger của 001_init.sql. Đó là lớp duy nhất KHÔNG thể lách được, kể cả khi hai request chạy
// song song hay khi ai đó sửa CSDL bằng tay. Viết lại cùng bộ quy tắc ở tầng JS chỉ tạo ra hai
// nguồn sự thật lệch nhau; việc của tầng JS là đổi lỗi CSDL sang câu tiếng Việt + mã máy đọc.
//
// Trigger `RAISE EXCEPTION` không mang tên ràng buộc, nên với các lỗi 23514 do trigger sinh phải
// nhận diện bằng một cụm chữ ĐẶC TRƯNG trong thông báo. Cụm đó là hằng viết trong migration
// (không phải dữ liệu người dùng) — nếu ai sửa chữ trong migration thì test dịch lỗi đỏ ngay,
// đó là chủ ý.
import { AppError } from './errors.js';

/** Cụm chữ đặc trưng trong thông báo của trigger → mã lỗi. Xem 001_init.sql. */
const TRIGGER_SIGNS = [
  ['không được lấy nhiệm vụ cấp 3 làm cha', 'PARENT_NOT_SUBWORK'],
  ['cùng một công việc', 'PARENT_OTHER_WORK'],
  ['nhiệm vụ bên dưới', 'MOVE_PARENT_HAS_CHILDREN'],
  ['mới đặt được nhắc việc', 'REMINDER_ON_SUBWORK'],
];

/** Tên ràng buộc CHECK/UNIQUE thật (pg trả ở `err.constraint`) → mã lỗi. */
const CONSTRAINT_CODES = Object.freeze({
  lvl2_no_parent: 'LVL2_NO_PARENT',
  no_self_parent: 'SELF_PARENT',
  work_items_code_key: 'CONFLICT',
  works_code_key: 'CONFLICT',
});

/** Câu tiếng Việt cho người dùng, thay cho thông báo kỹ thuật của CSDL. */
const MESSAGES = Object.freeze({
  PARENT_NOT_FOUND: 'Không tìm thấy công việc con được chọn làm cha',
  PARENT_NOT_SUBWORK: 'Cha phải là công việc con (cấp 2), không được chọn nhiệm vụ làm cha',
  PARENT_OTHER_WORK: 'Công việc con cha phải thuộc cùng một công việc',
  SELF_PARENT: 'Không thể chọn chính nó làm cha',
  LVL2_NO_PARENT: 'Công việc con (cấp 2) không được có cha',
  MOVE_PARENT_HAS_CHILDREN:
    'Công việc con đang có nhiệm vụ bên dưới, hãy chuyển hoặc xoá các nhiệm vụ đó trước',
  REMINDER_ON_SUBWORK: 'Chỉ nhiệm vụ (cấp 3) mới đặt được nhắc việc',
  CONFLICT: 'Mã đã tồn tại, vui lòng thử lại',
});

/**
 * Đổi lỗi của driver `pg` thành `AppError`. Lỗi không nhận ra thì trả về nguyên vẹn để
 * `errorHandler` xử lý như lỗi 500 kèm traceId — không được che lỗi lạ thành 400.
 *
 * @param {unknown} err lỗi bắt được từ `pool.query`
 * @returns {Error} `AppError` nếu nhận ra, ngược lại chính `err`
 */
export function translatePgError(err) {
  const pgCode = err?.code;
  if (typeof pgCode !== 'string') return err;
  const text = String(err.message ?? '');

  if (pgCode === '23514') {
    const byConstraint = CONSTRAINT_CODES[err.constraint];
    if (byConstraint) return new AppError(byConstraint, MESSAGES[byConstraint]);
    for (const [sign, code] of TRIGGER_SIGNS) {
      if (text.includes(sign)) return new AppError(code, MESSAGES[code]);
    }
    return new AppError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ: ' + text);
  }

  if (pgCode === '23503') {
    // Trigger dùng 23503 cho "cha không tồn tại"; khoá ngoại thật thì có `err.constraint`.
    if (text.includes('không tồn tại')) {
      return new AppError('PARENT_NOT_FOUND', MESSAGES.PARENT_NOT_FOUND);
    }
    if (String(err.constraint ?? '').includes('work_id')) {
      return new AppError('TARGET_WORK_NOT_FOUND', 'Không tìm thấy công việc được chọn');
    }
    return new AppError('BAD_REQUEST', 'Dữ liệu tham chiếu tới dòng không tồn tại');
  }

  if (pgCode === '23505') {
    const byConstraint = CONSTRAINT_CODES[err.constraint] ?? 'CONFLICT';
    return new AppError(byConstraint, MESSAGES.CONFLICT);
  }

  // 22P02 chuỗi không đúng kiểu, 22007/22008 ngày sai định dạng hoặc ngoài miền.
  if (pgCode === '22P02' || pgCode === '22007' || pgCode === '22008') {
    return new AppError('VALIDATION_ERROR', 'Giá trị không đúng định dạng');
  }

  return err;
}

/** Chạy một hàm đọc/ghi CSDL và dịch lỗi ngay tại chỗ. */
export async function withPgErrors(fn) {
  try {
    return await fn();
  } catch (err) {
    throw translatePgError(err);
  }
}

export default translatePgError;

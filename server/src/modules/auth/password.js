// Băm và kiểm mật khẩu. Đây là **chỗ duy nhất** trong hệ thống gọi tới bcrypt, nhờ vậy đổi
// tham số cost hay đổi thư viện chỉ sửa một file.
//
// Dùng `@node-rs/bcrypt` chứ KHÔNG dùng gói `bcrypt`: npm ở máy này chặn install script nên
// `bcrypt` cài "thành công" mà thiếu file .node, chỉ vỡ lúc chạy (bẫy §13.5 · §3.3).
//
// Công cụ nhập dữ liệu của Phase 2 cũng gọi đúng hàm này — không được tự băm ở nơi khác, vì
// khác cost là mật khẩu nhập vào không đăng nhập được.
import { hash as bcryptHash, verify as bcryptVerify } from '@node-rs/bcrypt';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

/** Tối thiểu 8 ký tự (§7 việc 1.7 · TC-AUTH-12). */
export const MIN_PASSWORD_LENGTH = 8;

// bcrypt chỉ dùng 72 byte đầu của mật khẩu và **âm thầm bỏ phần sau**. Chặn ở đây để không có
// chuyện hai mật khẩu dài khác nhau lại cùng đăng nhập được.
export const MAX_PASSWORD_BYTES = 72;

/** Băm mật khẩu văn bản thuần. Cost lấy từ env (production 12, test 10 cho nhanh). */
export function hashPassword(plain) {
  return bcryptHash(plain, env.BCRYPT_COST);
}

/**
 * So mật khẩu với băm. Trả `false` khi băm rỗng/không đúng dạng thay vì ném lỗi: dữ liệu nhập
 * từ Sheets có thể còn dòng hỏng, và một dòng hỏng không được làm sập cả API đăng nhập.
 */
export async function verifyPassword(plain, passwordHash) {
  if (!plain || !passwordHash) return false;
  try {
    return await bcryptVerify(plain, passwordHash);
  } catch {
    return false;
  }
}

/**
 * Kiểm mật khẩu mới có dùng được không. Ném `AppError` để errorHandler trả đúng §5.3.
 * Cố ý KHÔNG bắt buộc chữ hoa/số/ký tự đặc biệt: người dùng nội bộ sẽ lách bằng "Abc@1234"
 * và ghi ra giấy dán màn hình. Độ dài là điều kiện có ích nhất mà không sinh ra hành vi đó.
 */
export function assertPasswordUsable(plain, field = 'newPassword') {
  const value = String(plain ?? '');
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
      {
        field,
      }
    );
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new AppError('VALIDATION_ERROR', 'Mật khẩu quá dài, tối đa 72 byte', { field });
  }
  return value;
}

// TC-AUTH-07 (phần thuần) — ký và đọc cookie phiên, sinh token CSRF. Không cần CSDL.
import { describe, expect, it } from 'vitest';
import {
  anonymousCsrfToken,
  csrfTokenFor,
  CSRF_COOKIE,
  CSRF_HEADER,
  newSessionId,
  readSid,
  safeEqual,
  SID_COOKIE,
  signSid,
} from '../../src/modules/auth/cookies.js';

const SID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

describe('cookie phiên và CSRF', () => {
  it('tên cookie/header lấy từ cấu hình, cookie CSRF là cookie phiên + "_csrf"', () => {
    expect(SID_COOKIE).toBe(process.env.SESSION_COOKIE_NAME);
    expect(CSRF_COOKIE).toBe(`${process.env.SESSION_COOKIE_NAME}_csrf`);
    expect(CSRF_HEADER).toBe('x-csrf-token');
  });

  it('id phiên là uuid v4, mỗi lần một giá trị khác', () => {
    const a = newSessionId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newSessionId()).not.toBe(a);
  });

  it('ký rồi đọc lại được đúng id', () => {
    expect(readSid(signSid(SID))).toBe(SID);
  });

  it('TC-AUTH-07: cookie bị sửa / giả / sai dạng đều trả null, KHÔNG đi CSDL', () => {
    const signed = signSid(SID);
    const other = 'f9e8d7c6-b5a4-4938-8271-605f4e3d2c1b';

    // Đổi id nhưng giữ chữ ký cũ — kiểu tấn công "đăng nhập thành người khác".
    expect(readSid(`${other}.${signed.split('.')[1]}`)).toBeNull();
    // Sửa một ký tự của chữ ký.
    expect(readSid(signed.slice(0, -1) + (signed.endsWith('A') ? 'B' : 'A'))).toBeNull();
    // Không có chữ ký.
    expect(readSid(SID)).toBeNull();
    expect(readSid(`${SID}.`)).toBeNull();
    // Không phải uuid.
    expect(readSid('admin.abc')).toBeNull();
    expect(readSid("1' OR '1'='1.abc")).toBeNull();
    // Chữ hoa trong uuid không được nhận (chỉ một cách viết duy nhất được coi là hợp lệ).
    expect(readSid(signSid(SID.toUpperCase()))).toBeNull();
    // Thiếu / sai kiểu.
    for (const bad of [undefined, null, '', '.', 123, {}]) expect(readSid(bad)).toBeNull();
  });

  it('token CSRF suy ra từ id phiên: ổn định qua nhiều lần gọi, khác nhau giữa hai phiên', () => {
    expect(csrfTokenFor(SID)).toBe(csrfTokenFor(SID));
    expect(csrfTokenFor(SID)).not.toBe(csrfTokenFor(newSessionId()));
    // Không được là chính id phiên (nếu không thì đọc được cookie CSRF là biết id phiên).
    expect(csrfTokenFor(SID)).not.toContain(SID);
  });

  it('token CSRF của khách mỗi lần một giá trị', () => {
    expect(anonymousCsrfToken()).not.toBe(anonymousCsrfToken());
  });

  it('safeEqual: khác độ dài, rỗng, hoặc null đều false — không ném lỗi', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual(null, null)).toBe(false);
    expect(safeEqual(undefined, '')).toBe(false);
  });
});

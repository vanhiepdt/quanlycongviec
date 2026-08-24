// TC-AUTH-11, TC-AUTH-12 (phần thuần) — băm mật khẩu. Không cần CSDL.
import { describe, expect, it } from 'vitest';
import {
  assertPasswordUsable,
  hashPassword,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from '../../src/modules/auth/password.js';

describe('băm mật khẩu', () => {
  it('TC-AUTH-11: băm rồi kiểm lại đúng, và băm KHÔNG chứa mật khẩu thuần', async () => {
    const hash = await hashPassword('Test@12345');
    expect(hash).toMatch(/^\$2[aby]\$\d\d\$/);
    expect(hash).not.toContain('Test@12345');
    await expect(verifyPassword('Test@12345', hash)).resolves.toBe(true);
    await expect(verifyPassword('test@12345', hash)).resolves.toBe(false);
  });

  it('hai lần băm cùng một mật khẩu cho hai chuỗi khác nhau (có salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('Test@12345'), hashPassword('Test@12345')]);
    expect(a).not.toBe(b);
    await expect(verifyPassword('Test@12345', b)).resolves.toBe(true);
  });

  it('băm rỗng / hỏng trả false chứ KHÔNG ném lỗi — một dòng dữ liệu hỏng không làm sập API', async () => {
    await expect(verifyPassword('Test@12345', '')).resolves.toBe(false);
    await expect(verifyPassword('Test@12345', null)).resolves.toBe(false);
    await expect(verifyPassword('Test@12345', 'không-phải-băm-bcrypt')).resolves.toBe(false);
    await expect(verifyPassword('', 'không-phải-băm-bcrypt')).resolves.toBe(false);
  });

  it('TC-AUTH-12: dưới 8 ký tự bị từ chối với mã VALIDATION_ERROR và tên trường', () => {
    expect(() => assertPasswordUsable('1234567')).toThrowError(/ít nhất 8 ký tự/);
    try {
      assertPasswordUsable('1234567');
    } catch (err) {
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.status).toBe(400);
      expect(err.field).toBe('newPassword');
    }
    expect(assertPasswordUsable('12345678')).toBe('12345678');
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('quá 72 byte bị từ chối — bcrypt cắt âm thầm phần sau', () => {
    // 25 ký tự tiếng Việt có dấu = 75 byte UTF-8: đủ dài về byte nhưng "ngắn" về ký tự, đúng
    // kiểu chuỗi lọt qua nếu chỉ đếm .length.
    const long = 'ậ'.repeat(25);
    expect(long.length).toBeLessThan(MAX_PASSWORD_BYTES);
    expect(Buffer.byteLength(long, 'utf8')).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(() => assertPasswordUsable(long)).toThrowError(/tối đa 72 byte/);
  });

  it('không có mật khẩu (undefined/null) bị từ chối chứ không băm chuỗi "undefined"', () => {
    expect(() => assertPasswordUsable(undefined)).toThrowError(/ít nhất 8 ký tự/);
    expect(() => assertPasswordUsable(null)).toThrowError(/ít nhất 8 ký tự/);
  });
});

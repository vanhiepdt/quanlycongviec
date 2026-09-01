/**
 * JWT HS256 TỐI GIẢN — chỉ cho 1 mục đích: ký config của ONLYOFFICE Document Server (Vòng 14).
 *
 * Không thêm thư viện (jsonwebtoken) vì toàn bộ cần là: header {alg:'HS256'} + payload +
 * chữ ký HMAC-SHA256 của `hmac(base64url(header) + '.' + base64url(payload))`, và chiều ngược lại.
 * `kiemJwt` TỪ CHỐI token với header alg khác HS256 (chống lẫn sang 'none' — lỗ jwt truyền thống)
 * và so chữ ký bằng `timingSafeEqual` như cookies.js.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** Ký một payload thành chuỗi JWT HS256. `payload` phải serialize được bằng JSON. */
export function kyJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000), ...payload }));
  const chuKy = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${chuKy}`;
}

/** Kiểm một JWT HS256: đúng 3 phần, alg không phải 'none', chữ ký HMAC khớp. Trả payload hoặc null. */
export function kiemJwt(token, secret) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, chuKy] = parts;
  let h = null;
  try {
    h = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!h || h.alg !== 'HS256') return null;
  const tinh = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  let daGui;
  try {
    daGui = Buffer.from(chuKy, 'base64url');
  } catch {
    return null;
  }
  if (daGui.length !== tinh.length || !timingSafeEqual(daGui, tinh)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export default { kyJwt, kiemJwt };

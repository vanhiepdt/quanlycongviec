// Cookie phiên và cookie CSRF. Gom vào một file để tên cookie, thuộc tính bảo mật và cách ký
// chỉ khai một lần (§7 việc 1.4 và 1.5).
//
// Vì sao **ký** giá trị cookie thay vì để nguyên uuid: cookie giả/bị sửa bị loại ngay bằng một
// phép HMAC, không cần đi CSDL (TC-AUTH-07). Chữ ký không thay cho bảng `sessions` — id vẫn phải
// tồn tại và chưa hết hạn mới được coi là đăng nhập.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

export const SID_COOKIE = env.SESSION_COOKIE_NAME;
export const CSRF_COOKIE = `${env.SESSION_COOKIE_NAME}_csrf`;
export const CSRF_HEADER = 'x-csrf-token';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function hmac(purpose, value) {
  return createHmac('sha256', env.SESSION_SECRET).update(`${purpose}:${value}`).digest('base64url');
}

/** So chuỗi theo thời gian hằng — không để lộ độ giống nhau qua thời gian phản hồi. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  if (x.length !== y.length || x.length === 0) return false;
  return timingSafeEqual(x, y);
}

export const newSessionId = () => randomUUID();

/** Giá trị cookie phiên: `<uuid>.<chữ ký>`. */
export const signSid = (sid) => `${sid}.${hmac('sid', sid)}`;

/** Đọc cookie phiên. Trả uuid nếu chữ ký đúng, `null` nếu thiếu / sai dạng / sai chữ ký. */
export function readSid(cookieValue) {
  if (typeof cookieValue !== 'string') return null;
  const dot = cookieValue.indexOf('.');
  if (dot <= 0) return null;
  const sid = cookieValue.slice(0, dot);
  if (!UUID_RE.test(sid)) return null;
  return safeEqual(cookieValue.slice(dot + 1), hmac('sid', sid)) ? sid : null;
}

/**
 * Token CSRF suy ra từ id phiên, không lưu thêm cột nào. Máy chủ khởi động lại vẫn tính ra
 * đúng token cũ nên người đang dùng không bị 403 oan.
 */
export const csrfTokenFor = (sid) => hmac('csrf', sid);

/** Token CSRF cho khách chưa đăng nhập (dùng cho chính lời gọi đăng nhập). */
export const anonymousCsrfToken = () => hmac('csrf-anon', randomUUID());

const baseCookie = {
  sameSite: 'lax',
  secure: env.SESSION_COOKIE_SECURE,
  path: '/',
};

export function setSessionCookie(res, sid, expiresAt) {
  res.cookie(SID_COOKIE, signSid(sid), { ...baseCookie, httpOnly: true, expires: expiresAt });
}

export function clearSessionCookie(res) {
  res.clearCookie(SID_COOKIE, { ...baseCookie, httpOnly: true });
}

/** Cookie CSRF phải **đọc được bằng JavaScript** — frontend copy giá trị này vào header. */
export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, { ...baseCookie, httpOnly: false });
  return token;
}

export function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE, { ...baseCookie, httpOnly: false });
}

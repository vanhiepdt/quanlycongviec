// Tiện ích gọi HTTP trong test. Sinh ra vì mọi request GHI đều phải có token CSRF: nếu mỗi file
// test tự lấy token thì 20 chỗ lặp cùng một đoạn, và sửa cách phát token là sửa 20 chỗ.
//
// `request.agent` giữ cookie giữa các lần gọi giống trình duyệt, nên phiên đăng nhập nối được
// qua nhiều request.
import request from 'supertest';
import { hashPassword } from '../../src/modules/auth/password.js';
import { pool } from '../../src/db/pool.js';

export const TEST_PASSWORD = 'Test@12345';

/** Băm mật khẩu test một lần rồi dùng lại: bcrypt cost 10 tốn ~100ms mỗi lần gọi. */
let cachedHash = null;
export async function testPasswordHash() {
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  return cachedHash;
}

/** Người dùng đăng nhập được thật (có băm bcrypt đúng), khác `makeUser` của db.js dùng băm giả. */
export async function makeLoginUser(over = {}) {
  const u = {
    code: 'NV001',
    full_name: 'Nguyễn Văn A',
    email: 'a@congty.vn',
    role: 'Nhân viên',
    department_id: null,
    must_change_password: false,
    is_active: true,
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO users (code, full_name, email, password_hash, role, department_id,
                        must_change_password, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      u.code,
      u.full_name,
      u.email,
      u.password_hash ?? (await testPasswordHash()),
      u.role,
      u.department_id,
      u.must_change_password,
      u.is_active,
    ]
  );
  return rows[0];
}

/**
 * Client giữ cookie + tự gắn token CSRF.
 * Token được lấy lại trước mỗi lần ghi thay vì nhớ một lần: sau khi đăng nhập, token đổi theo id
 * phiên mới, nhớ token cũ là 403 ngay ở request thứ hai.
 */
export function client(app) {
  const agent = request.agent(app);

  const api = {
    agent,
    /** Lấy token CSRF hiện tại (và đặt cookie CSRF vào jar của agent). */
    async csrfToken() {
      const res = await agent.get('/api/csrf');
      return res.body?.data?.csrfToken ?? null;
    },
    get: (url) => agent.get(url),
    async post(url, body = {}, { csrf } = {}) {
      const token = csrf === undefined ? await api.csrfToken() : csrf;
      const req = agent.post(url);
      if (token !== null) req.set('x-csrf-token', token);
      return req.send(body);
    },
    // PATCH và DELETE cũng là request ghi ⇒ cũng phải qua verifyCsrf. Dùng chung một đường lấy
    // token với `post` để không có chỗ nào tự xoay token riêng.
    async patch(url, body = {}, { csrf } = {}) {
      const token = csrf === undefined ? await api.csrfToken() : csrf;
      const req = agent.patch(url);
      if (token !== null) req.set('x-csrf-token', token);
      return req.send(body);
    },
    async put(url, body = {}, { csrf } = {}) {
      const token = csrf === undefined ? await api.csrfToken() : csrf;
      const req = agent.put(url);
      if (token !== null) req.set('x-csrf-token', token);
      return req.send(body);
    },
    async del(url, body = {}, { csrf } = {}) {
      const token = csrf === undefined ? await api.csrfToken() : csrf;
      const req = agent.delete(url);
      if (token !== null) req.set('x-csrf-token', token);
      return req.send(body);
    },
    /** Đăng nhập và trả nguyên phản hồi để test tự kiểm. */
    login(email, password = TEST_PASSWORD) {
      return api.post('/api/v1/auth/login', { email, password });
    },
  };

  return api;
}

export { request };

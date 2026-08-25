// TC-AUTH-07..10 — phiên, gia hạn, đăng xuất, cờ bắt đổi mật khẩu, và CSRF (§7 việc 1.4/1.5/1.8).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { CSRF_COOKIE, signSid, SID_COOKIE } from '../../src/modules/auth/cookies.js';
import { resetTables } from '../helpers/db.js';
import { client, makeLoginUser, request, TEST_PASSWORD } from '../helpers/http.js';

const app = createApp();

async function sessionRow() {
  const { rows } = await pool.query('SELECT * FROM sessions');
  return rows[0] ?? null;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closePool();
});

describe('phiên đăng nhập', () => {
  it('/me trả đúng người đang đăng nhập, kèm danh sách phòng phụ trách', async () => {
    const { rows: dept } = await pool.query(
      "INSERT INTO departments (code, name) VALUES ('PH01','Phòng Kỹ thuật') RETURNING id"
    );
    const user = await makeLoginUser({
      role: 'Phó Giám đốc',
      department_id: null,
      email: 'pgd@congty.vn',
    });
    await pool.query(
      "INSERT INTO department_managers (department_id, user_id, role) VALUES ($1,$2,'deputy_director')",
      [dept[0].id, user.id]
    );

    const c = client(app);
    await c.login('pgd@congty.vn');
    const res = await c.get('/api/v1/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user.managedDepartmentIds).toEqual([dept[0].id]);
    // Phải là số, không phải chuỗi: mảng bigint có parser riêng (OID 1016), sai là so id luôn lệch.
    expect(typeof res.body.data.user.managedDepartmentIds[0]).toBe('number');
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('chưa đăng nhập gọi /me trả 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('TC-AUTH-07: cookie phiên giả / bị sửa trả 401 và KHÔNG hỏi CSDL', async () => {
    await makeLoginUser();
    const real = await sessionRow();
    expect(real).toBeNull(); // chưa ai đăng nhập

    const forged = [
      `${SID_COOKIE}=a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5.chu-ky-bia`,
      `${SID_COOKIE}=${signSid('a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5')}`, // ký đúng nhưng không có trong CSDL
      `${SID_COOKIE}=admin`,
      `${SID_COOKIE}=1 OR 1=1`,
    ];
    for (const cookie of forged) {
      const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
      expect(res.status, cookie).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('TC-AUTH-08: phiên hết hạn trả 401 và dòng sessions bị xoá', async () => {
    await makeLoginUser();
    const c = client(app);
    await c.login('a@congty.vn');
    expect(await sessionRow()).not.toBeNull();

    // Đẩy hạn về quá khứ thay vì chờ 1 giờ.
    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 minute'");

    const res = await c.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    // Dòng rác được dọn ngay, không để bảng phình mãi.
    expect(await sessionRow()).toBeNull();
    // Và cookie được xoá để lần sau khỏi đi một vòng CSDL nữa.
    expect((res.headers['set-cookie'] ?? []).join(';')).toContain(`${SID_COOKIE}=;`);
  });

  it('phiên được gia hạn khi còn hoạt động, nhưng KHÔNG ghi CSDL mỗi request', async () => {
    await makeLoginUser();
    const c = client(app);
    await c.login('a@congty.vn');
    const first = await sessionRow();

    // Request ngay sau đó: chưa quá 1 phút nên không UPDATE (tiết kiệm ghi).
    await c.get('/api/v1/auth/me');
    const unchanged = await sessionRow();
    expect(unchanged.last_seen_at.getTime()).toBe(first.last_seen_at.getTime());

    // Giả lập người dùng quay lại sau 5 phút.
    await pool.query("UPDATE sessions SET last_seen_at = now() - interval '5 minutes'");
    await c.get('/api/v1/auth/me');
    const renewed = await sessionRow();
    expect(renewed.expires_at.getTime()).toBeGreaterThan(first.expires_at.getTime());
  });

  it('TC-AUTH-09: đăng xuất xong gọi lại API trả 401, dòng sessions bị xoá', async () => {
    await makeLoginUser();
    const c = client(app);
    await c.login('a@congty.vn');

    const out = await c.post('/api/v1/auth/logout');
    expect(out.status).toBe(200);
    expect(out.body.data.loggedOut).toBe(true);
    expect(await sessionRow()).toBeNull();

    const after = await c.get('/api/v1/auth/me');
    expect(after.status).toBe(401);
  });

  it('đăng xuất khi chưa đăng nhập vẫn 200 — không để frontend mắc kẹt vì lỗi', async () => {
    const res = await client(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
  });

  it('TC-AUTH-10: must_change_password chặn mọi API TRỪ /auth/*', async () => {
    await makeLoginUser({ must_change_password: true });
    const c = client(app);
    const login = await c.login('a@congty.vn');
    expect(login.status).toBe(200);
    expect(login.body.data.user.must_change_password).toBe(true);

    // /auth/* vẫn đi được: nếu không thì người dùng không có đường nào để tự đổi mật khẩu.
    expect((await c.get('/api/v1/auth/me')).status).toBe(200);

    // Mọi đường khác dưới /api bị chặn ở 403 TRƯỚC khi tới route (nên không ra 404).
    for (const url of ['/api/v1/works', '/api/v1/users', '/api/v1/stats/summary']) {
      const res = await c.get(url);
      expect(res.status, url).toBe(403);
      expect(res.body.error.code).toBe('MUST_CHANGE_PASSWORD');
    }

    // Đổi mật khẩu xong thì các đường kia thôi bị chặn. `/works` đã có route từ Phase 3 nên ra
    // 200; `/users` thì chưa có nên vẫn 404 — điều cần khẳng định là không còn 403.
    const changed = await c.post('/api/v1/auth/password', {
      currentPassword: TEST_PASSWORD,
      newPassword: 'MatKhauMoi@2026',
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.user.must_change_password).toBe(false);
    const works = await c.get('/api/v1/works');
    expect(works.status).toBe(200);
    expect((await c.get('/api/v1/users')).status).toBe(404);
  });
});

describe('CSRF', () => {
  it('GET /api/csrf trả token và đặt cookie ĐỌC ĐƯỢC bằng JavaScript', async () => {
    const res = await request(app).get('/api/csrf');
    expect(res.status).toBe(200);
    expect(typeof res.body.data.csrfToken).toBe('string');
    const cookie = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${CSRF_COOKIE}=`));
    expect(cookie).toBeTruthy();
    // Cố ý KHÔNG HttpOnly: frontend phải đọc được để copy vào header.
    expect(cookie).not.toContain('HttpOnly');
  });

  it('POST thiếu header X-CSRF-Token bị 403 CSRF_INVALID', async () => {
    await makeLoginUser();
    const res = await client(app).post(
      '/api/v1/auth/login',
      { email: 'a@congty.vn', password: TEST_PASSWORD },
      { csrf: null }
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('POST với token KHÔNG khớp cookie bị 403', async () => {
    await makeLoginUser();
    const res = await client(app).post(
      '/api/v1/auth/login',
      { email: 'a@congty.vn', password: TEST_PASSWORD },
      { csrf: 'token-bia-dat' }
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('token CSRF của phiên KHÁC không dùng được — không mượn được token của người khác', async () => {
    await makeLoginUser();
    await makeLoginUser({ code: 'NV002', email: 'b@congty.vn' });

    const a = client(app);
    await a.login('a@congty.vn');
    const b = client(app);
    await b.login('b@congty.vn');

    const tokenOfB = await b.csrfToken();
    // A gửi cookie của A nhưng header là token của B.
    const res = await a.post('/api/v1/auth/logout', {}, { csrf: tokenOfB });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('GET không cần token — chỉ request GHI mới bị kiểm', async () => {
    expect((await request(app).get('/api/csrf')).status).toBe(200);
    expect((await request(app).get('/healthz')).status).toBe(200);
  });
});

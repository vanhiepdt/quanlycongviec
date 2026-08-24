// TC-AUTH-11..14 — đổi mật khẩu và nhật ký. Phần "mật khẩu không được lọt vào log" kiểm bằng
// cách đọc thẳng `activity_logs` và toàn bộ phản hồi, không tin vào mắt người đọc code.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { verifyPassword } from '../../src/modules/auth/password.js';
import { resetTables } from '../helpers/db.js';
import { client, makeLoginUser, TEST_PASSWORD } from '../helpers/http.js';

const app = createApp();
const NEW_PASSWORD = 'MatKhauMoi@2026';

async function passwordHash(userId) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return rows[0].password_hash;
}

/** Chờ audit ghi xong: audit chạy ở `res.on('finish')`, tức là SAU khi supertest đã trả về. */
async function waitForLogs(minRows, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY id');
    if (rows.length >= minRows) return rows;
    await new Promise((r) => setTimeout(r, 25));
  }
  const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY id');
  return rows;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closePool();
});

describe('đổi mật khẩu', () => {
  it('TC-AUTH-11: sai mật khẩu hiện tại → 400, mật khẩu KHÔNG đổi', async () => {
    const user = await makeLoginUser();
    const before = await passwordHash(user.id);
    const c = client(app);
    await c.login('a@congty.vn');

    const res = await c.post('/api/v1/auth/password', {
      currentPassword: 'sai-mat-khau-cu',
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('currentPassword');
    expect(await passwordHash(user.id)).toBe(before);
    // Mật khẩu cũ vẫn dùng được.
    expect((await client(app).login('a@congty.vn')).status).toBe(200);
  });

  it('TC-AUTH-12: mật khẩu mới dưới 8 ký tự → 400, và kiểm ĐỘ DÀI trước khi kiểm mật khẩu cũ', async () => {
    const user = await makeLoginUser();
    const before = await passwordHash(user.id);
    const c = client(app);
    await c.login('a@congty.vn');

    const res = await c.post('/api/v1/auth/password', {
      currentPassword: TEST_PASSWORD,
      newPassword: '1234567',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('newPassword');
    expect(res.body.error.message).toMatch(/ít nhất 8 ký tự/);
    expect(await passwordHash(user.id)).toBe(before);
  });

  it('mật khẩu mới trùng mật khẩu cũ bị từ chối', async () => {
    await makeLoginUser();
    const c = client(app);
    await c.login('a@congty.vn');
    const res = await c.post('/api/v1/auth/password', {
      currentPassword: TEST_PASSWORD,
      newPassword: TEST_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/khác mật khẩu hiện tại/);
  });

  it('TC-AUTH-13: đổi thành công → băm mới khác băm cũ, các phiên KHÁC bị thu hồi', async () => {
    const user = await makeLoginUser();
    const oldHash = await passwordHash(user.id);

    // Ba phiên của cùng một người: hai "máy khác" và một máy đang đổi mật khẩu.
    const other1 = client(app);
    await other1.login('a@congty.vn');
    const other2 = client(app);
    await other2.login('a@congty.vn');
    const me = client(app);
    await me.login('a@congty.vn');
    expect((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n).toBe(3);

    const res = await me.post('/api/v1/auth/password', {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.revokedSessions).toBe(2);

    const newHash = await passwordHash(user.id);
    expect(newHash).not.toBe(oldHash);
    await expect(verifyPassword(NEW_PASSWORD, newHash)).resolves.toBe(true);
    await expect(verifyPassword(TEST_PASSWORD, newHash)).resolves.toBe(false);

    // Chỉ còn phiên của chính người vừa đổi — không bắt họ đăng nhập lại.
    expect((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n).toBe(1);
    expect((await me.get('/api/v1/auth/me')).status).toBe(200);
    expect((await other1.get('/api/v1/auth/me')).status).toBe(401);
    expect((await other2.get('/api/v1/auth/me')).status).toBe(401);

    // Mật khẩu cũ không còn đăng nhập được, mật khẩu mới thì được.
    expect((await client(app).login('a@congty.vn', TEST_PASSWORD)).status).toBe(401);
    expect((await client(app).login('a@congty.vn', NEW_PASSWORD)).status).toBe(200);
  });

  it('chưa đăng nhập thì không đổi được mật khẩu của ai', async () => {
    await makeLoginUser();
    const res = await client(app).post('/api/v1/auth/password', {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('nhật ký hoạt động', () => {
  it('đăng nhập thành công ghi một dòng activity_logs có đủ chủ thể', async () => {
    const user = await makeLoginUser();
    await client(app).login('a@congty.vn');

    const rows = await waitForLogs(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('auth.login');
    // Người vừa đăng nhập chưa có req.user — nếu handler không tự đặt actorId thì dòng này rỗng.
    expect(rows[0].actor_id).toBe(user.id);
    expect(rows[0].actor_name).toBe('Nguyễn Văn A');
    expect(rows[0].entity_type).toBe('user');
  });

  it('đăng nhập TRƯỢT không ghi nhật ký (chỉ ghi request thành công)', async () => {
    await makeLoginUser();
    await client(app).login('a@congty.vn', 'sai-mat-khau');
    await new Promise((r) => setTimeout(r, 150));
    const { rows } = await pool.query('SELECT * FROM activity_logs');
    expect(rows).toHaveLength(0);
  });

  it('request ĐỌC (GET) không ghi nhật ký — nếu ghi thì bảng phình vô ích', async () => {
    await makeLoginUser();
    const c = client(app);
    await c.login('a@congty.vn');
    await waitForLogs(1);
    await c.get('/api/v1/auth/me');
    await c.get('/api/csrf');
    await new Promise((r) => setTimeout(r, 150));
    const { rows } = await pool.query('SELECT * FROM activity_logs');
    expect(rows).toHaveLength(1);
  });

  it('TC-AUTH-14: mật khẩu KHÔNG xuất hiện trong nhật ký, dù ở thân request hay ở details', async () => {
    await makeLoginUser();
    const c = client(app);
    const loginRes = await c.login('a@congty.vn');
    const changeRes = await c.post('/api/v1/auth/password', {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(changeRes.status).toBe(200);

    const rows = await waitForLogs(2);
    const dumped = JSON.stringify(rows);
    for (const secret of [TEST_PASSWORD, NEW_PASSWORD]) {
      expect(dumped).not.toContain(secret);
    }
    // Băm bcrypt cũng không được lọt vào nhật ký hay phản hồi.
    expect(dumped).not.toContain('$2');
    expect(JSON.stringify(loginRes.body)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(changeRes.body)).not.toContain(NEW_PASSWORD);

    const change = rows.find((r) => r.action === 'auth.changePassword');
    expect(change).toBeTruthy();
    expect(change.details).toEqual({ revokedSessions: 0 });
  });
});

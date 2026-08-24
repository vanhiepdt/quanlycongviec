// TC-AUTH-01..06 — đăng nhập. Chạy qua HTTP thật (supertest) vì phần lớn cái cần kiểm nằm ở
// cookie, mã HTTP và câu thông báo, không phải ở giá trị hàm trả về.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { SID_COOKIE } from '../../src/modules/auth/cookies.js';
import { resetTables } from '../helpers/db.js';
import { client, makeLoginUser, TEST_PASSWORD } from '../helpers/http.js';

const app = createApp();

/** Lấy chuỗi Set-Cookie của một cookie theo tên. */
function setCookie(res, name) {
  const list = res.headers['set-cookie'] ?? [];
  return list.find((c) => c.startsWith(`${name}=`)) ?? null;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closePool();
});

describe('đăng nhập', () => {
  it('TC-AUTH-01: đúng email + mật khẩu → 200, có cookie phiên, có dòng trong sessions', async () => {
    const user = await makeLoginUser();
    const c = client(app);
    const res = await c.login('a@congty.vn');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user.email).toBe('a@congty.vn');
    // Băm mật khẩu KHÔNG được lọt ra ngoài dù chỉ một lần.
    expect(JSON.stringify(res.body)).not.toContain('$2');
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(typeof res.body.data.csrfToken).toBe('string');

    const cookie = setCookie(res, SID_COOKIE);
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const { rows } = await pool.query('SELECT * FROM sessions');
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(user.id);
    expect(new Date(rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('TC-AUTH-02: mật khẩu sai và email không tồn tại trả ĐÚNG MỘT thông báo như nhau', async () => {
    await makeLoginUser();
    const c = client(app);

    const wrongPassword = await c.login('a@congty.vn', 'sai-mat-khau');
    const noSuchEmail = await c.login('khong-ton-tai@congty.vn', TEST_PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(noSuchEmail.status).toBe(401);
    // Đây là điểm chính: cả hai giống nhau từng chữ, không dò được email nào đang tồn tại.
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(noSuchEmail.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(noSuchEmail.body.error.message).toBe(wrongPassword.body.error.message);
    // Câu chung nói "Email hoặc mật khẩu không đúng" — cố ý MƠ HỒ giữa hai nguyên nhân. Không
    // được có chữ nào chỉ ra riêng một nguyên nhân.
    expect(wrongPassword.body.error.message).not.toMatch(
      /không tồn tại|chưa đăng ký|không có tài khoản|sai mật khẩu/i
    );
    // "hoặc" là phần cốt tử: nó giữ cho câu mơ hồ giữa hai nguyên nhân.
    expect(wrongPassword.body.error.message).toMatch(/hoặc/);
    // Đăng nhập trượt thì không được tạo phiên.
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM sessions');
    expect(rows[0].n).toBe(0);
  });

  it('TC-AUTH-03: email viết CHỮ HOA vẫn đăng nhập được (cột citext) — bệnh §4.1 phải hết', async () => {
    await makeLoginUser({ email: 'a@congty.vn' });
    const res = await client(app).login('A@CongTy.VN');
    expect(res.status).toBe(200);
    // Email trả về là bản đã lưu, không phải bản người dùng vừa gõ.
    expect(res.body.data.user.email).toBe('a@congty.vn');
  });

  it('TC-AUTH-04: email có dấu cách đầu/cuối vẫn đăng nhập được', async () => {
    await makeLoginUser();
    const res = await client(app).login('   a@congty.vn  ');
    expect(res.status).toBe(200);
  });

  it('TC-AUTH-05: sai 5 lần bị khoá 15 phút — nhập ĐÚNG cũng không vào được', async () => {
    const user = await makeLoginUser();
    const c = client(app);

    for (let i = 1; i <= 4; i++) {
      const res = await c.login('a@congty.vn', 'sai-mat-khau');
      expect(res.status, `lần sai thứ ${i}`).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    // Lần sai thứ 5 chạm ngưỡng LOGIN_MAX_ATTEMPTS → khoá ngay, đổi hẳn mã lỗi.
    const fifth = await c.login('a@congty.vn', 'sai-mat-khau');
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(fifth.body.error.message).toMatch(/\d+ phút/);

    // Đang khoá thì mật khẩu đúng cũng bị chặn — đây là phần dễ làm sai nhất.
    const correct = await c.login('a@congty.vn', TEST_PASSWORD);
    expect(correct.status).toBe(423);
    expect(correct.body.error.code).toBe('ACCOUNT_LOCKED');

    const { rows } = await pool.query(
      'SELECT failed_logins, locked_until FROM users WHERE id = $1',
      [user.id]
    );
    expect(rows[0].failed_logins).toBeGreaterThanOrEqual(5);
    const lockMinutes = (new Date(rows[0].locked_until) - Date.now()) / 60000;
    expect(lockMinutes).toBeGreaterThan(13);
    // Trần 16: `locked_until` tính bằng `now()` của Postgres, mốc so là đồng hồ máy chạy test —
    // hai đồng hồ lệch vài chục ms nên "≤ 15" sẽ đỏ ngẫu nhiên.
    expect(lockMinutes).toBeLessThan(16);
  });

  it('lần sai cũ hơn cửa sổ 15 phút KHÔNG cộng dồn — tài khoản ít dùng không bị khoá oan', async () => {
    const user = await makeLoginUser();
    // Giả lập: đã sai 4 lần nhưng lần cuối cách đây 2 giờ.
    await pool.query(
      `UPDATE users SET failed_logins = 4, last_failed_login_at = now() - interval '2 hours'
        WHERE id = $1`,
      [user.id]
    );

    const res = await client(app).login('a@congty.vn', 'sai-mat-khau');
    expect(res.status).toBe(401); // vẫn 401, KHÔNG phải 423

    const { rows } = await pool.query(
      'SELECT failed_logins, locked_until FROM users WHERE id = $1',
      [user.id]
    );
    expect(rows[0].failed_logins).toBe(1); // đếm lại từ đầu
    expect(rows[0].locked_until).toBeNull();
  });

  it('đăng nhập đúng xoá sạch bộ đếm sai của lần trước', async () => {
    const user = await makeLoginUser();
    await client(app).login('a@congty.vn', 'sai-mat-khau');
    const res = await client(app).login('a@congty.vn');
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      'SELECT failed_logins, last_failed_login_at, locked_until FROM users WHERE id = $1',
      [user.id]
    );
    expect(rows[0]).toEqual({ failed_logins: 0, last_failed_login_at: null, locked_until: null });
  });

  it('TC-AUTH-06: is_active = false bị chặn dù mật khẩu ĐÚNG', async () => {
    await makeLoginUser({ is_active: false });
    const res = await client(app).login('a@congty.vn');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM sessions');
    expect(rows[0].n).toBe(0);
  });

  it('is_active = false + mật khẩu SAI vẫn chỉ nhận câu chung — không dò ra tài khoản bị vô hiệu hoá', async () => {
    await makeLoginUser({ is_active: false });
    const res = await client(app).login('a@congty.vn', 'sai-mat-khau');
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('thiếu email hoặc mật khẩu trả VALIDATION_ERROR kèm tên trường, không phải 500', async () => {
    const c = client(app);
    const noEmail = await c.post('/api/v1/auth/login', { password: TEST_PASSWORD });
    expect(noEmail.status).toBe(400);
    expect(noEmail.body.error.code).toBe('VALIDATION_ERROR');
    expect(noEmail.body.error.field).toBe('email');

    const noPassword = await c.post('/api/v1/auth/login', { email: 'a@congty.vn' });
    expect(noPassword.body.error.field).toBe('password');
  });

  it('kiểu dữ liệu lạ ở thân request không làm sập máy chủ', async () => {
    const c = client(app);
    for (const body of [
      { email: { $ne: null }, password: 'x' },
      { email: ['a@congty.vn'], password: 'x' },
      { email: 'a@congty.vn', password: 12345 },
    ]) {
      const res = await c.post('/api/v1/auth/login', body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

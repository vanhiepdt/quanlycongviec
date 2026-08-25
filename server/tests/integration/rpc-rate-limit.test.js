// NỢ TỪ PHASE 1 (§7 việc 1.10): `loginRateLimiter` phải chặn cả đường `/api/rpc/authenticateUser`.
//
// Vì sao có riêng một file: ngưỡng lấy từ `env.RATE_LIMIT_MAX`, mà vitest.config đặt 1000 cho mọi
// file khác (đăng nhập hàng trăm lần trong một lượt chạy). Muốn thử ngưỡng thật thì phải đặt lại
// biến môi trường TRƯỚC khi `rateLimit.js` được nạp — nên mọi import ở đây là import động, sau
// `vi.stubEnv`. Cùng lý do, file này không dùng chung app với các file khác.
//
// Điều đang canh: cầu tương thích KHÔNG được là đường vòng thoát khỏi chặn dò mật khẩu. Bộ đếm là
// MỘT bản dùng chung (`loginRateLimiter`), nên dò 2 lần ở `/api/v1/auth/login` rồi nhảy sang
// `/api/rpc/authenticateUser` vẫn phải bị chặn.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('RATE_LIMIT_MAX', '2');
vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '15');
vi.resetModules();

const { createApp } = await import('../../src/app.js');
const { closePool } = await import('../../src/db/pool.js');
const { loginRateLimiter } = await import('../../src/middleware/rateLimit.js');
const { makeDepartment, resetTables } = await import('../helpers/db.js');
const { client, makeLoginUser, TEST_PASSWORD } = await import('../helpers/http.js');

const app = createApp();
let user;

/**
 * Bộ đếm sống theo tiến trình và cửa sổ là 15 phút, nên nếu không xoá thì test thứ hai bắt đầu ở
 * trạng thái ĐÃ bị chặn của test thứ nhất. Xoá cả ba dạng địa chỉ vòng lặp vì `req.ip` của
 * supertest tuỳ nền tảng mà là IPv4 hay IPv4-mapped IPv6.
 */
async function resetLimiter() {
  for (const ip of ['::ffff:127.0.0.1', '::1', '127.0.0.1']) {
    await loginRateLimiter.resetKey(ip);
  }
}

beforeEach(async () => {
  await resetTables();
  await resetLimiter();
  await makeDepartment();
  user = await makeLoginUser({ code: 'NV001', email: 'a@congty.vn' });
});

afterAll(async () => {
  await closePool();
  vi.unstubAllEnvs();
});

describe('TC-RPC-36: chặn dò mật khẩu áp cả cho cầu RPC', () => {
  const wrong = (api) =>
    api.post('/api/rpc/authenticateUser', { args: [user.email, 'sai-mat-khau'] });

  it('quá ngưỡng ở /api/rpc/authenticateUser ⇒ 429 RATE_LIMITED, câu tiếng Việt nói rõ chờ bao lâu', async () => {
    const api = client(app);
    expect((await wrong(api)).status).toBe(401);
    expect((await wrong(api)).status).toBe(401);

    const blocked = await wrong(api);
    expect(blocked.status).toBe(429);
    expect(blocked.body.ok).toBe(false);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toMatch(/15 phút/);
  });

  it('bộ đếm dùng CHUNG với /api/v1/auth/login — không đổi đường là thoát được', async () => {
    const api = client(app);
    expect((await api.login(user.email, 'sai-mat-khau')).status).toBe(401);
    expect((await api.login(user.email, 'sai-mat-khau')).status).toBe(401);
    // Hết lượt ở route REST thì cầu RPC cũng hết lượt.
    expect((await wrong(api)).status).toBe(429);
  });

  it('chặn cả khi mật khẩu ĐÚNG — kẻ dò vào được một tài khoản vẫn không dò tiếp được', async () => {
    const api = client(app);
    expect((await wrong(api)).status).toBe(401);
    expect((await wrong(api)).status).toBe(401);
    const res = await api.post('/api/rpc/authenticateUser', { args: [user.email, TEST_PASSWORD] });
    expect(res.status).toBe(429);
  });

  it('không chặn lây sang hàm nghiệp vụ khác của cầu RPC', async () => {
    const api = client(app);
    await wrong(api);
    await wrong(api);
    expect((await wrong(api)).status).toBe(429);
    // `getProjects` chưa đăng nhập vẫn phải là 401 (để cầu bật lại modal), KHÔNG phải 429.
    expect((await api.post('/api/rpc/getProjects', { args: [] })).status).toBe(401);
  });
});

// §7 việc 1.10 — giới hạn tần suất theo IP. Không cần CSDL: dựng một app tí hon quanh chính
// middleware đó, ngưỡng 2 lần cho nhanh (bản thật lấy ngưỡng từ env).
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeRateLimiter } from '../../src/middleware/rateLimit.js';

function appWithLimiter(opts) {
  const app = express();
  app.use(express.json());
  app.post('/thu', makeRateLimiter(opts), (req, res) => res.json({ ok: true, data: 'qua' }));
  app.get('/khong-gioi-han', (req, res) => res.json({ ok: true, data: 'qua' }));
  return app;
}

describe('giới hạn tần suất', () => {
  it('quá ngưỡng trả 429 với mã RATE_LIMITED theo đúng §5.3', async () => {
    const app = appWithLimiter({ max: 2, windowMinutes: 15 });

    expect((await request(app).post('/thu')).status).toBe(200);
    expect((await request(app).post('/thu')).status).toBe(200);

    const blocked = await request(app).post('/thu');
    expect(blocked.status).toBe(429);
    expect(blocked.body.ok).toBe(false);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toMatch(/15 phút/);
  });

  it('đếm cả lần THÀNH CÔNG — kẻ dò vào được một tài khoản vẫn bị chặn khi dò tài khoản kế tiếp', async () => {
    const app = appWithLimiter({ max: 1, windowMinutes: 5 });
    expect((await request(app).post('/thu')).status).toBe(200);
    expect((await request(app).post('/thu')).status).toBe(429);
  });

  it('có header RateLimit chuẩn để frontend biết còn bao nhiêu lượt', async () => {
    const app = appWithLimiter({ max: 5, windowMinutes: 15 });
    const res = await request(app).post('/thu');
    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
    // Không dùng header kiểu cũ X-RateLimit-*.
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('chỉ áp cho đường dẫn được gắn — đường khác không bị ảnh hưởng', async () => {
    const app = appWithLimiter({ max: 1, windowMinutes: 15 });
    await request(app).post('/thu');
    expect((await request(app).post('/thu')).status).toBe(429);
    for (let i = 0; i < 5; i++) {
      expect((await request(app).get('/khong-gioi-han')).status).toBe(200);
    }
  });

  // Cầu RPC gọi lại route thật trong cùng một request HTTP (`rpc/subrequest.js`). Nếu chặng con
  // cũng bị đếm thì một lần bấm "Đăng nhập" trừ hai lượt và người dùng giao diện cũ bị chặn sớm
  // gấp đôi — đúng cái đã xảy ra khi chạy TC-RPC-36 lần đầu.
  it('KHÔNG đếm lời gọi con của cầu RPC (req.rpcSubRequest)', async () => {
    const app = express();
    app.use(express.json());
    const limiter = makeRateLimiter({ max: 1, windowMinutes: 15 });
    app.post('/rpc', limiter, (req, res) => {
      // Chặng con: cùng một bộ đếm, nhưng có cờ đánh dấu là lời gọi trong tiến trình.
      req.rpcSubRequest = true;
      limiter(req, res, () => res.json({ ok: true, data: 'qua' }));
    });

    const first = await request(app).post('/rpc');
    expect(first.status).toBe(200); // không bị chặng con "ăn" mất lượt thứ hai
    expect(first.headers['ratelimit-remaining']).toBe('0');
    expect((await request(app).post('/rpc')).status).toBe(429);
  });
});

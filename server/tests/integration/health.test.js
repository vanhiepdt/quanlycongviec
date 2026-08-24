// TC-HEALTH-01..04 — bộ xương Express của Phase 0. Đủ để biết app dựng được, /healthz sống,
// /readyz biết phân biệt CSDL sống/chết, và lỗi không lộ stack trace.
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';

const app = createApp();

afterAll(async () => {
  await closePool();
});

describe('bộ xương HTTP', () => {
  it('TC-HEALTH-01: /healthz trả 200, KHÔNG cần đăng nhập, KHÔNG lộ thông tin hệ thống', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Cố ý công khai để Nginx gọi được, nên phản hồi chỉ được có 2 khoá này.
    expect(Object.keys(res.body).sort()).toEqual(['ok', 'uptime_s']);
  });

  it('TC-HEALTH-02: /readyz báo CSDL sống', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: 'up' });
  });

  it('TC-HEALTH-03: đường dẫn lạ trả 404 theo đúng quy ước §5.3', async () => {
    const res = await request(app).get('/duong-dan-khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  it('TC-HEALTH-04: không trả header X-Powered-By, có header bảo mật của helmet', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

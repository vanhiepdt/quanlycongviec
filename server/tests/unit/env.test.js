// TC-ENV-01..06 — config/env.js là cửa chặn đầu tiên: thiếu biến là chết ngay, không chạy tiếp
// với giá trị đoán. Đây là phần duy nhất của Phase 0 có logic nên là phần duy nhất test unit.
import { describe, expect, it } from 'vitest';
import { OPTIONAL_ENV_KEYS, REQUIRED_ENV_KEYS, env, parseEnv } from '../../src/config/env.js';

/** Bộ biến tối thiểu đủ hợp lệ, để mỗi test chỉ làm sai đúng một biến. */
const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db',
  SESSION_SECRET: 'x'.repeat(32),
  SESSION_COOKIE_NAME: 'qlcv_sid',
  SESSION_TTL_HOURS: '12',
  SESSION_COOKIE_SECURE: 'false',
  BCRYPT_COST: '12',
  LOGIN_MAX_ATTEMPTS: '5',
  LOGIN_LOCKOUT_MINUTES: '15',
  RATE_LIMIT_WINDOW_MINUTES: '15',
  RATE_LIMIT_MAX: '300',
  LOG_LEVEL: 'info',
  TZ: 'Asia/Ho_Chi_Minh',
};

describe('config/env', () => {
  it('TC-ENV-01: đúng 14 biến bắt buộc, khớp deploy/.env.example', () => {
    expect(REQUIRED_ENV_KEYS).toHaveLength(14);
    expect(Object.keys(valid).sort()).toEqual([...REQUIRED_ENV_KEYS].sort());
  });

  it('TC-ENV-02: bộ biến đủ thì hợp lệ và số được đổi sang số thật', () => {
    const r = parseEnv(valid);
    expect(r.ok).toBe(true);
    expect(r.env.PORT).toBe(3000);
    expect(r.env.SESSION_COOKIE_SECURE).toBe(false);
  });

  it('TC-ENV-03: thiếu BẤT KỲ biến bắt buộc nào cũng phải báo lỗi, nêu đúng tên biến', () => {
    for (const key of REQUIRED_ENV_KEYS) {
      const broken = { ...valid };
      delete broken[key];
      const r = parseEnv(broken);
      expect(r.ok, `thiếu ${key} mà vẫn cho qua`).toBe(false);
      expect(r.problems.join('\n')).toContain(key);
    }
  });

  it('TC-ENV-04: biến tuỳ chọn thiếu thì lấy mặc định, không chết', () => {
    const r = parseEnv(valid);
    expect(r.ok).toBe(true);
    for (const key of OPTIONAL_ENV_KEYS) expect(r.env[key]).toBeDefined();
    expect(r.env.CRON_OVERDUE).toBe('0 7 * * *');
    expect(r.env.MAIL_ENABLED).toBe(false);
  });

  it('TC-ENV-05: chặn giá trị vô nghĩa — cổng, cost bcrypt, secret ngắn, URL sai loại', () => {
    const cases = [
      ['PORT', '0'],
      ['PORT', 'ba-nghin'],
      ['BCRYPT_COST', '4'], // quá yếu
      ['BCRYPT_COST', '99'],
      ['SESSION_SECRET', 'ngan-qua'],
      ['DATABASE_URL', 'mysql://u:p@localhost/db'],
      ['LOG_LEVEL', 'noisy'],
      ['NODE_ENV', 'staging'], // chưa hỗ trợ, phải báo chứ không im lặng
      ['SESSION_COOKIE_SECURE', '1'], // phải là 'true'/'false'
    ];
    for (const [key, bad] of cases) {
      const r = parseEnv({ ...valid, [key]: bad });
      expect(r.ok, `${key}=${bad} lẽ ra phải bị chặn`).toBe(false);
    }
  });

  it('TC-ENV-06: env đã nạp là bất biến, không ai sửa được lúc chạy', () => {
    expect(Object.isFrozen(env)).toBe(true);
    expect(() => {
      'use strict';
      env.PORT = 1;
    }).toThrow();
  });
});

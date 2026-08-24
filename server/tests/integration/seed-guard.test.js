// Hai chốt an toàn của bộ chạy dữ liệu mẫu (TC-SEED-03, TC-SEED-04). `dev.sql` GHI ĐÈ người
// dùng: chạy nhầm lên CSDL thật là mất mật khẩu của tất cả mọi người và không có đường lùi.
//
// Phải chạy bằng TIẾN TRÌNH CON, không import trực tiếp: cả hai chốt kết thúc bằng
// `process.exit(1)` — gọi trong tiến trình test sẽ giết luôn vitest.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RUNNER = resolve(import.meta.dirname, '../../src/db/seeds/run.js');

/** Chạy run.js với biến môi trường ghi đè. Trả về {status, stderr, stdout}. */
function runSeedProcess(overrides) {
  const r = spawnSync(process.execPath, [RUNNER, 'dev.sql'], {
    env: { ...process.env, ...overrides },
    encoding: 'utf8',
    timeout: 20_000,
  });
  return { status: r.status, stderr: r.stderr ?? '', stdout: r.stdout ?? '' };
}

describe('chốt an toàn của npm run seed:dev', () => {
  it('TC-SEED-03: NODE_ENV=production thì TỪ CHỐI, thoát mã 1', () => {
    // DATABASE_URL trỏ vào CSDL KHÔNG TỒN TẠI: nếu chốt hỏng thì test đỏ vì lỗi kết nối, chứ
    // không phải vì đã ghi vào một CSDL thật nào đó.
    const r = runSeedProcess({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://qlcv:x@127.0.0.1:5434/csdl_khong_ton_tai',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('TỪ CHỐI');
    expect(r.stderr).toContain('NODE_ENV=production');
    expect(r.stdout).toBe('');
  });

  it('TC-SEED-04: tên CSDL chứa "prod" thì TỪ CHỐI, kể cả khi NODE_ENV là development', () => {
    // Chốt 1 dựa vào biến môi trường mà người chạy tay rất dễ đặt sai; chốt 2 dựa vào chính
    // đích đến, nên nó bắt được đúng trường hợp "quên đổi NODE_ENV".
    const r = runSeedProcess({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://qlcv:x@127.0.0.1:5434/quanlycongviec_prod',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('TỪ CHỐI');
    expect(r.stderr).toContain('quanlycongviec_prod');
    expect(r.stdout).toBe('');
  });
});

// Chốt danh sách redact của logger (src/utils/logger.js): bí mật KHÔNG ĐƯỢC xuất hiện trong log.
//
// Vì sao test này tồn tại: ngày 2026-09-06 (Phase 8 việc 6), pino-http in NGUYÊN header của mọi
// request vào `docker logs` — kể cả `x-bot-api-secret-token` của webhook Zalo, tức bí mật chữ ký
// webhook nằm trần trong log. Vá bằng cách thêm header đó vào REDACT_PATHS; test này đòi mọi
// bí mật mẫu phải bị che, để lần sau thêm đường log mới mà quên redact là test đỏ ngay.
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { REDACT_PATHS } from '../../src/utils/logger.js';

/** Tạo logger dùng ĐÚNG danh sách redact của app, ghi vào mảng thay stdout để đọc lại được. */
function loggerGhiVao(dong) {
  return pino(
    { level: 'info', redact: { paths: REDACT_PATHS, censor: '[đã che]' } },
    {
      write(s) {
        dong.push(s);
      },
    }
  );
}

describe('redact của logger', () => {
  it('che header chữ ký webhook Zalo, cookie và authorization của request', () => {
    const dong = [];
    const log = loggerGhiVao(dong);
    log.info(
      {
        req: {
          method: 'POST',
          url: '/api/zalo-bot/webhook',
          headers: {
            'x-bot-api-secret-token': 'BIMAT-WEBHOOK-123',
            cookie: 'phien=abc123',
            authorization: 'Bearer xyz789',
          },
        },
      },
      'webhook tới'
    );

    const banGhi = JSON.parse(dong.at(-1));
    expect(banGhi.req.headers['x-bot-api-secret-token']).toBe('[đã che]');
    expect(banGhi.req.headers.cookie).toBe('[đã che]');
    expect(banGhi.req.headers.authorization).toBe('[đã che]');
    // Không một mảnh bí mật nào lọt ra ngoài bản ghi.
    const text = dong.join('');
    expect(text).not.toContain('BIMAT-WEBHOOK-123');
    expect(text).not.toContain('phien=abc123');
    expect(text).not.toContain('xyz789');
    // Phần vô hại vẫn còn nguyên — redact không được phá cấu trúc log.
    expect(banGhi.req.method).toBe('POST');
    expect(banGhi.msg).toBe('webhook tới');
  });

  it('che mật khẩu ở mọi độ sâu', () => {
    const dong = [];
    const log = loggerGhiVao(dong);
    log.info(
      {
        password: 'mk1',
        doiPass: { newPassword: 'mk2', currentPassword: 'mk4' },
        user: { password: 'mk3' },
      },
      'đổi mật khẩu'
    );

    const text = dong.join('');
    expect(text).not.toContain('mk1');
    expect(text).not.toContain('mk2');
    expect(text).not.toContain('mk3');
    expect(text).not.toContain('mk4');
  });
});

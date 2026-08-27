// Việc 7.4 — lịch dọn tin chat cũ hằng tuần (§7, §2.8 H3).
//
// Cùng cách kiểm như 5.8: gọi THẲNG `donChatCu({ soNgay })` với dữ liệu đặt sẵn `created_at` trong
// quá khứ, không chờ 03:30 sáng Chủ nhật và không giả lập `node-cron`.
//
// Mốc xoá tính trong CSDL (`now() - interval`), nên test đặt tin ở hai phía của mốc và khẳng định
// đúng phần cũ mất đi — phần trong hạn phải còn NGUYÊN, kể cả tin của người đã bị xoá.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool } from '../../src/db/pool.js';
import { env } from '../../src/config/env.js';
import * as chatRepo from '../../src/modules/chat/repo.js';
import { batLichChay, donChatCu, dungLichChay } from '../../src/services/cron.js';
import { makeDepartment, makeUser, pool, resetTables } from '../helpers/db.js';

let nguoi;

/** Chèn tin với tuổi tính bằng ngày — `created_at` phải đặt tay nên không đi qua API. */
async function themTin(message, truocNgay) {
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (user_id, user_name, message, created_at)
     VALUES ($1,$2,$3, now() - ($4 || ' days')::interval) RETURNING id`,
    [nguoi.id, nguoi.full_name, message, String(truocNgay)]
  );
  return rows[0];
}

async function conLai() {
  const { rows } = await pool.query('SELECT message FROM chat_messages ORDER BY created_at');
  return rows.map((r) => r.message);
}

beforeEach(async () => {
  await resetTables();
  const phong = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  nguoi = await makeUser({
    code: 'NV001',
    email: 'a@congty.vn',
    full_name: 'Nguyễn Văn A',
    department_id: phong.id,
  });
});

afterAll(async () => {
  dungLichChay();
  await closePool();
});

describe('donChatCu — xoá tin cũ hơn số ngày giữ lại', () => {
  it('xoá đúng tin quá hạn, giữ nguyên tin trong hạn', async () => {
    await themTin('tin 200 ngày', 200);
    await themTin('tin 91 ngày', 91);
    await themTin('tin 89 ngày', 89);
    await themTin('tin hôm nay', 0);

    expect(await donChatCu({ soNgay: 90 })).toEqual({ daXoa: 2, soNgay: 90 });
    expect(await conLai()).toEqual(['tin 89 ngày', 'tin hôm nay']);
  });

  it('mặc định lấy CHAT_KEEP_DAYS = 90 ngày khi không truyền tham số', async () => {
    expect(env.CHAT_KEEP_DAYS).toBe(90);
    await themTin('tin 100 ngày', 100);
    await themTin('tin 10 ngày', 10);

    expect(await donChatCu()).toEqual({ daXoa: 1, soNgay: 90 });
    expect(await conLai()).toEqual(['tin 10 ngày']);
  });

  it('không có tin nào quá hạn ⇒ daXoa = 0, không xoá lầm', async () => {
    await themTin('tin 3 ngày', 3);
    expect(await donChatCu({ soNgay: 90 })).toEqual({ daXoa: 0, soNgay: 90 });
    expect(await conLai()).toEqual(['tin 3 ngày']);
  });

  it('bảng rỗng ⇒ chạy được, không nổ', async () => {
    expect(await donChatCu({ soNgay: 90 })).toEqual({ daXoa: 0, soNgay: 90 });
  });

  it('tin của người đã bị xoá cũng theo luật ngày, không bị dọn sớm', async () => {
    const trongHan = await themTin('người đã nghỉ, tin mới', 5);
    const quaHan = await themTin('người đã nghỉ, tin cũ', 120);
    await pool.query('UPDATE chat_messages SET user_id = NULL WHERE id = ANY($1::bigint[])', [
      [trongHan.id, quaHan.id],
    ]);

    expect((await donChatCu({ soNgay: 90 })).daXoa).toBe(1);
    expect(await conLai()).toEqual(['người đã nghỉ, tin mới']);
  });

  it('chạy hai lượt liền nhau: lượt sau không còn gì để xoá (không dồn nợ)', async () => {
    await themTin('tin cũ', 100);
    expect((await donChatCu({ soNgay: 90 })).daXoa).toBe(1);
    expect((await donChatCu({ soNgay: 90 })).daXoa).toBe(0);
  });

  it('dọn xong, khung chat 3 ngày gần nhất vẫn đọc được bình thường', async () => {
    await themTin('tin cũ phải mất', 100);
    await themTin('tin trong khung', 1);
    await donChatCu({ soNgay: 90 });

    const rows = await chatRepo.list({});
    expect(rows.map((r) => r.message)).toEqual(['tin trong khung']);
  });
});

describe('Cờ CRON_ENABLED che cả lịch dọn chat', () => {
  it('mặc định TẮT trong test ⇒ batLichChay() trả null, KHÔNG đăng ký lịch dọn nào', async () => {
    // Một máy dev bật lịch là mọi máy dùng chung CSDL bản sao mất tin — nên lịch dọn phải nằm sau
    // cùng cờ `CRON_ENABLED` với lịch quét quá hạn, không có cờ riêng.
    expect(env.CRON_ENABLED).toBe(false);
    expect(batLichChay()).toBeNull();

    await themTin('tin cũ', 100);
    dungLichChay(); // gọi được cả khi chưa đăng ký lịch nào
    expect(await conLai()).toEqual(['tin cũ']);
  });

  it('biểu thức lịch mặc định là 03:30 Chủ nhật hằng tuần và hợp lệ', async () => {
    const cron = (await import('node-cron')).default;
    expect(env.CRON_CHAT_CLEANUP).toBe('30 3 * * 0');
    expect(cron.validate(env.CRON_CHAT_CLEANUP)).toBe(true);
  });
});

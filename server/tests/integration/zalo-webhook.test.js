// WEBHOOK + REST ZALO — tích hợp (017, TC-ZL-05..09 của docs/KE-HOACH-THONG-BAO.md B7, cộng ba
// đường REST của người dùng: trang-thai / ma-lien-ket / lien-ket).
//
// Ba quyết định khung test:
//  1. env đặt TRƯỚC khi import app (ảnh chụp env.js) — token + secret phải có thì webhook mới mở.
//  2. `fetch` toàn cục bị GIẢ: tin trả lời bot (fire-and-forget sau phản hồi webhook) không được
//     chạm Internet, và chính danh sách lời gọi là bằng chứng «bot đã trả lời đúng câu».
//  3. Webhook KHÔNG có phiên/CSRF (máy-đối-máy) ⇒ gọi bằng `request(app)` trần; REST người dùng
//     thì qua `client(app)` để có phiên + CSRF như thật.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('ZALO_BOT_TOKEN', 'token-test-123');
vi.stubEnv('ZALO_BOT_SECRET_TOKEN', 'secret-test-1234');
vi.stubEnv('ZALO_BOT_NHAN', 'webhook');
vi.resetModules();

const { createApp } = await import('../../src/app.js');
const { closePool, pool } = await import('../../src/db/pool.js');
const zaloService = await import('../../src/modules/zalo/service.js');
const { makeDepartment, resetTables } = await import('../helpers/db.js');
const { client, makeLoginUser } = await import('../helpers/http.js');

const app = createApp();
const WEBHOOK = '/api/zalo-bot/webhook';
const SECRET = 'secret-test-1234';

let goiZalo;

/** Giả fetch: ghi mọi lời gọi Zalo; mặc định trả {ok:true}. */
function datFetchZalo(ketQua = { ok: true, result: {} }) {
  goiZalo = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, opt) => {
      goiZalo.push({ url: String(url), body: opt && opt.body ? JSON.parse(opt.body) : null });
      return Promise.resolve({ status: 200, json: () => Promise.resolve(ketQua) });
    })
  );
}

/** Gói sự kiện tin văn bản của Zalo — đúng hình dạng webhook thật gửi về. */
function suKienText(chatId, text) {
  return {
    event_name: 'message.text.received',
    message: { chat: { id: chatId, chat_type: 'user' }, text },
  };
}

async function chatIdCua(userId) {
  const { rows } = await pool.query('SELECT zalo_chat_id FROM users WHERE id = $1', [userId]);
  return (rows[0] && rows[0].zalo_chat_id) || undefined; // NULL từ pg ⇒ undefined cho gọn khẳng định
}

let nguoiA;
let apiA;

beforeEach(async () => {
  await resetTables();
  zaloService.xoaBoDemThuSai();
  datFetchZalo();
  await makeDepartment();
  nguoiA = await makeLoginUser({ code: 'NV001', email: 'a@congty.vn', full_name: 'Nguyễn Văn A' });
  apiA = client(app);
  await apiA.login(nguoiA.email);
});

afterAll(async () => {
  await closePool();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('TC-ZL-05: xác thực webhook bằng header X-Bot-Api-Secret-Token', () => {
  it('thiếu header ⇒ 403, không chạm CSDL', async () => {
    const res = await request(app).post(WEBHOOK).send(suKienText('chat-1', '123456'));
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('sai header ⇒ 403 (so safeEqual, không phải so chuỗi thường)', async () => {
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', 'secret-sai-9999')
      .send(suKienText('chat-1', '123456'));
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('đúng header ⇒ 200, kể cả khi tin không mang mã (không phải trợ lý hội thoại)', async () => {
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-1', 'chào bot nhé'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, xuLy: 'bo-qua' });
    expect(await chatIdCua(nguoiA.id)).toBeUndefined();
    expect(goiZalo).toHaveLength(0); // bỏ qua im lặng, không nhắn lại
  });
});

describe('TC-ZL-06: tin LIENKET hợp lệ ⇒ ghi users.zalo_chat_id', () => {
  it('mã còn hạn + đúng cú pháp ⇒ liên kết xong, bot nhắn lại xác nhận', async () => {
    const ma = await apiA.post('/api/v1/zalo/ma-lien-ket', {});
    expect(ma.status).toBe(201);
    const code = ma.body.data.code;

    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-cua-A', `LIENKET ${code}`));
    expect(res.status).toBe(200);
    expect(res.body.xuLy).toBe('da-lien-ket');
    expect(await chatIdCua(nguoiA.id)).toBe('chat-cua-A');

    // Tin trả lời gửi SAU phản hồi (fire-and-forget) — chờ lời gọi fetch thật sự xảy ra.
    await vi.waitFor(() => expect(goiZalo).toHaveLength(1));
    expect(goiZalo[0].url).toContain('/bottoken-test-123/sendMessage');
    expect(goiZalo[0].body.chat_id).toBe('chat-cua-A');
    expect(goiZalo[0].body.text).toContain('Đã liên kết xong');
    // Mã đã dùng: nhật ký giữ mã nhưng câu trả lời webhook KHÔNG nhại lại mã.
    expect(res.body).not.toHaveProperty('code');
  });

  it('chỉ cần đúng 6 chữ số cũng được tính là mã (người dùng hay gõ trần con số)', async () => {
    const ma = await apiA.post('/api/v1/zalo/ma-lien-ket', {});
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-cua-A', ma.body.data.code));
    expect(res.status).toBe(200);
    expect(res.body.xuLy).toBe('da-lien-ket');
    expect(await chatIdCua(nguoiA.id)).toBe('chat-cua-A');
  });

  it('cú pháp có dấu «LIÊN KẾT 123456» cũng nhận', async () => {
    const ma = await apiA.post('/api/v1/zalo/ma-lien-ket', {});
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-cua-A', `LIÊN KẾT ${ma.body.data.code}`));
    expect(res.status).toBe(200);
    expect(res.body.xuLy).toBe('da-lien-ket');
  });
});

describe('TC-ZL-07: mã hết hạn / đã dùng ⇒ KHÔNG ghi chat_id', () => {
  it('dùng lại mã lần hai ⇒ ma-khong-hop-le, chat_id của ai vẫn của người đó', async () => {
    const code = (await apiA.post('/api/v1/zalo/ma-lien-ket', {})).body.data.code;
    await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-cua-A', `LIENKET ${code}`));
    expect(await chatIdCua(nguoiA.id)).toBe('chat-cua-A');

    const lan2 = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-ke-khac', `LIENKET ${code}`));
    expect(lan2.status).toBe(200);
    expect(lan2.body.xuLy).toBe('ma-khong-hop-le');
    // Chiếm kênh thất bại: kẻ gọi sau không lấy được chat_id của ai.
    const { rows } = await pool.query('SELECT zalo_chat_id FROM users WHERE zalo_chat_id = $1', [
      'chat-ke-khac',
    ]);
    expect(rows).toHaveLength(0);
  });

  it('mã quá 15 phút ⇒ ma-khong-hop-le, bot chỉ dẫn lấy mã mới trong phần mềm', async () => {
    await pool.query(
      `INSERT INTO zalo_link_codes (user_id, code, expires_at)
       VALUES ($1, '999000', now() - interval '1 minute')`,
      [nguoiA.id]
    );
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-cua-A', 'LIENKET 999000'));
    expect(res.status).toBe(200);
    expect(res.body.xuLy).toBe('ma-khong-hop-le');
    expect(await chatIdCua(nguoiA.id)).toBeUndefined();
    await vi.waitFor(() => expect(goiZalo).toHaveLength(1));
    expect(goiZalo[0].body.text).toContain('Lấy mã liên kết');
  });

  it('mã bịa (chưa từng cấp) ⇒ ma-khong-hop-le, không 500', async () => {
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-cua-A', 'LIENKET 000001'));
    expect(res.status).toBe(200);
    expect(res.body.xuLy).toBe('ma-khong-hop-le');
  });
});

describe('TC-ZL-08: sự kiện lạ ⇒ 200 xác nhận rồi bỏ qua (Zalo không đánh dấu hỏng webhook)', () => {
  it('sự kiện ảnh ⇒ 200 {xuLy: bo-qua}, không nhắn lại, không đổi CSDL', async () => {
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send({
        event_name: 'message.image.received',
        message: { chat: { id: 'chat-1' }, attachments: [] },
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, xuLy: 'bo-qua' });
    expect(goiZalo).toHaveLength(0);
  });

  it('thân rỗng / không phải sự kiện ⇒ vẫn 200, không ném', async () => {
    const res = await request(app).post(WEBHOOK).set('X-Bot-Api-Secret-Token', SECRET).send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, xuLy: 'bo-qua' });
  });
});

describe('TC-ZL-09: chat_id đã thuộc người khác ⇒ nói rõ bằng tiếng Việt, KHÔNG 500', () => {
  it('chiếm kênh thất bại: người sau bị từ chối, người trước giữ nguyên chat_id', async () => {
    await pool.query('UPDATE users SET zalo_chat_id = $1 WHERE id = $2', ['chat-chung', nguoiA.id]);
    const nguoiB = await makeLoginUser({
      code: 'NV002',
      email: 'b@congty.vn',
      full_name: 'Trần Thị B',
    });
    const apiB = client(app);
    await apiB.login(nguoiB.email);
    const code = (await apiB.post('/api/v1/zalo/ma-lien-ket', {})).body.data.code;

    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Bot-Api-Secret-Token', SECRET)
      .send(suKienText('chat-chung', `LIENKET ${code}`));
    expect(res.status).toBe(200);
    expect(res.body.xuLy).toBe('chat-da-thuoc-nguoi-khac');

    expect(await chatIdCua(nguoiA.id)).toBe('chat-chung'); // A không mất kênh
    expect(await chatIdCua(nguoiB.id)).toBeUndefined(); // B không chiếm được
    await vi.waitFor(() => expect(goiZalo).toHaveLength(1));
    expect(goiZalo[0].body.text).toContain('Bỏ liên kết');
    expect(goiZalo[0].body.text).not.toContain('undefined');
  });
});

describe('REST /api/v1/zalo — ba đường của người đang đăng nhập', () => {
  it('GET /trang-thai: bat=true, cachNhan=webhook, daLienKet=false — KHÔNG trả chat_id', async () => {
    const res = await apiA.get('/api/v1/zalo/trang-thai');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ bat: true, cachNhan: 'webhook', daLienKet: false });
    expect(res.body.data).not.toHaveProperty('zalo_chat_id');
    expect(res.body.data).not.toHaveProperty('chatId');
  });

  it('POST /ma-lien-ket ⇒ 201: mã 6 số, hạn 15 phút, hướng dẫn chứa chính mã đó', async () => {
    const res = await apiA.post('/api/v1/zalo/ma-lien-ket', {});
    expect(res.status).toBe(201);
    const { code, hanPhut, huongDan, expiresAt } = res.body.data;
    expect(code).toMatch(/^\d{6}$/);
    expect(hanPhut).toBe(15);
    expect(huongDan).toContain(`LIENKET ${code}`);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('hai lần lấy mã ⇒ hai mã KHÁC nhau và cả hai cùng sống (không thu hồi mã cũ)', async () => {
    const m1 = (await apiA.post('/api/v1/zalo/ma-lien-ket', {})).body.data;
    const m2 = (await apiA.post('/api/v1/zalo/ma-lien-ket', {})).body.data;
    expect(m1.code).not.toBe(m2.code);
    const { rows } = await pool.query(
      'SELECT code FROM zalo_link_codes WHERE user_id = $1 AND used_at IS NULL',
      [nguoiA.id]
    );
    expect(rows.map((r) => r.code).sort()).toEqual([m1.code, m2.code].sort());
  });

  it('DELETE /lien-ket khi đang liên kết ⇒ changed:1, chat_id về NULL', async () => {
    await pool.query('UPDATE users SET zalo_chat_id = $1 WHERE id = $2', ['chat-cua-A', nguoiA.id]);
    const res = await apiA.del('/api/v1/zalo/lien-ket');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ changed: 1, daLienKet: false });
    expect(await chatIdCua(nguoiA.id)).toBeUndefined();
  });

  it('DELETE /lien-ket khi CHƯA liên kết ⇒ changed:0, vẫn 200 (không phải lỗi)', async () => {
    const res = await apiA.del('/api/v1/zalo/lien-ket');
    expect(res.status).toBe(200);
    expect(res.body.data.changed).toBe(0);
  });

  it('chưa đăng nhập: GET bị chặn bởi phiên (401); POST/DELETE bị chặn TRƯỚC bởi CSRF (403)', async () => {
    // verifyCsrf đứng TRƯỚC requireAuth trên trục /api (app.js): request ghi không token chết ở cửa
    // CSRF chứ chưa kịp tới cửa phiên — thứ tự này là chủ đích.
    const tran = request(app);
    expect((await tran.get('/api/v1/zalo/trang-thai')).status).toBe(401);
    expect((await tran.post('/api/v1/zalo/ma-lien-ket').send({})).status).toBe(403);
    expect((await tran.delete('/api/v1/zalo/lien-ket')).status).toBe(403);
  });
});

// Chat nội bộ (§2.8 nhóm H, §7 việc 7.3) — chạy qua HTTP thật trên Postgres thật.
//
// Ba ca chốt của §8.4:
//   TC-MISC-07 hai người cùng mở: B thấy tin của A ở lượt hỏi lại kế tiếp (mốc `since`)
//   TC-MISC-08 tin chứa `<script>` được lưu và trả về NGUYÊN VĂN (máy chủ không lọc thẻ;
//              việc thoát ký tự do giao diện làm — xem tests/unit/chat-ui.test.js)
//   TC-MISC-09 chỉ 3 ngày gần nhất, tối đa 50 tin, thứ tự cũ → mới; `since` không nới được khoảng
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { flushAudit } from '../../src/middleware/audit.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let nguoiA;
let nguoiB;

async function nhuLa(user) {
  const api = client(app);
  const res = await api.login(user.email);
  expect(res.status, `đăng nhập ${user.email}`).toBe(200);
  return api;
}

async function seed() {
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1 });
  nguoiA = await makeLoginUser({
    code: 'NV001',
    email: 'a@congty.vn',
    full_name: 'Nguyễn Văn A',
    department_id: phongA.id,
  });
  nguoiB = await makeLoginUser({
    code: 'NV002',
    email: 'b@congty.vn',
    full_name: 'Trần Thị B',
    role: 'Trưởng phòng',
    department_id: phongA.id,
  });
}

/** Chèn tin trực tiếp — cần đặt `created_at` vào quá khứ nên không đi qua API. */
async function themTin({ user = nguoiA, message = 'tin cũ', truocPhut = 0, truocNgay = 0 } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (user_id, user_name, message, created_at)
     VALUES ($1,$2,$3, now() - ($4 || ' minutes')::interval - ($5 || ' days')::interval)
     RETURNING id, user_id, user_name, message, created_at`,
    [user?.id ?? null, user?.full_name ?? '', message, String(truocPhut), String(truocNgay)]
  );
  return rows[0];
}

beforeEach(async () => {
  await resetTables();
  await seed();
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/v1/chat — đọc khung chat', () => {
  it('chưa đăng nhập ⇒ 401', async () => {
    const res = await client(app).get('/api/v1/chat');
    expect(res.status).toBe(401);
  });

  it('khung rỗng: messages rỗng, since null, kèm hai con số 3 ngày / 50 tin', async () => {
    const api = await nhuLa(nguoiA);
    const res = await api.get('/api/v1/chat');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      messages: [],
      total: 0,
      since: null,
      soNgay: 3,
      soTin: 50,
    });
  });

  it('trả đủ 5 trường mỗi dòng, thứ tự cũ → mới', async () => {
    await themTin({ message: 'tin 1', truocPhut: 30 });
    await themTin({ message: 'tin 2', truocPhut: 20, user: nguoiB });
    await themTin({ message: 'tin 3', truocPhut: 10 });

    const api = await nhuLa(nguoiA);
    const { body } = await api.get('/api/v1/chat');
    expect(body.data.messages.map((m) => m.message)).toEqual(['tin 1', 'tin 2', 'tin 3']);
    expect(Object.keys(body.data.messages[0]).sort()).toEqual([
      'created_at',
      'id',
      'message',
      'user_id',
      'user_name',
    ]);
    expect(body.data.messages[1].user_name).toBe('Trần Thị B');
    // `since` của lần sau = thời điểm tin cuối cùng vừa trả.
    expect(new Date(body.data.since).toISOString()).toBe(
      new Date(body.data.messages[2].created_at).toISOString()
    );
  });

  it('tin của người đã bị xoá vẫn còn tên (không join users)', async () => {
    const tin = await themTin({ message: 'tôi đã nghỉ', truocPhut: 5 });
    await pool.query('UPDATE chat_messages SET user_id = NULL WHERE id = $1', [tin.id]);

    const api = await nhuLa(nguoiA);
    const { body } = await api.get('/api/v1/chat');
    expect(body.data.messages).toHaveLength(1);
    expect(body.data.messages[0]).toMatchObject({ user_id: null, user_name: 'Nguyễn Văn A' });
  });

  it('since sai định dạng ⇒ 400, chỉ rõ trường since', async () => {
    const api = await nhuLa(nguoiA);
    const res = await api.get('/api/v1/chat?since=hom-qua');
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('since');
  });
});

describe('TC-MISC-09: khung 3 ngày gần nhất, tối đa 50 tin', () => {
  it('tin cũ hơn 3 ngày không trả về', async () => {
    await themTin({ message: 'tin tuần trước', truocNgay: 7 });
    await themTin({ message: 'tin hôm nay', truocPhut: 1 });

    const api = await nhuLa(nguoiA);
    const { body } = await api.get('/api/v1/chat');
    expect(body.data.messages.map((m) => m.message)).toEqual(['tin hôm nay']);
    expect(JSON.stringify(body)).not.toContain('tin tuần trước');
  });

  it('60 tin trong khoảng ⇒ trả 50 tin MỚI NHẤT, cũ → mới', async () => {
    for (let i = 60; i >= 1; i -= 1) await themTin({ message: `tin ${i}`, truocPhut: i });

    const api = await nhuLa(nguoiA);
    const { body } = await api.get('/api/v1/chat');
    expect(body.data.messages).toHaveLength(50);
    expect(body.data.total).toBe(50);
    expect(body.data.messages[0].message).toBe('tin 50');
    expect(body.data.messages[49].message).toBe('tin 1');
    expect(JSON.stringify(body)).not.toContain('"tin 60"');
  });

  it('since cũ cả năm KHÔNG moi được lịch sử ngoài 3 ngày', async () => {
    await themTin({ message: 'tin năm ngoái', truocNgay: 300 });
    await themTin({ message: 'tin hôm nay', truocPhut: 2 });

    const api = await nhuLa(nguoiA);
    const { body } = await api.get(
      `/api/v1/chat?since=${encodeURIComponent(new Date('2020-01-01T00:00:00.000Z').toISOString())}`
    );
    expect(body.data.messages.map((m) => m.message)).toEqual(['tin hôm nay']);
  });

  it('lượt hỏi lại không có tin mới ⇒ messages rỗng nhưng since giữ nguyên mốc đã gửi', async () => {
    await themTin({ message: 'tin duy nhất', truocPhut: 3 });
    const api = await nhuLa(nguoiA);
    const lan1 = await api.get('/api/v1/chat');
    const moc = lan1.body.data.since;

    const lan2 = await api.get(`/api/v1/chat?since=${encodeURIComponent(moc)}`);
    expect(lan2.body.data.messages).toEqual([]);
    expect(new Date(lan2.body.data.since).toISOString()).toBe(new Date(moc).toISOString());
  });
});

describe('POST /api/v1/chat — gửi tin', () => {
  it('gửi được, 201, tên người gửi chép vào dòng, đọc lại thấy ngay', async () => {
    const api = await nhuLa(nguoiA);
    const res = await api.post('/api/v1/chat', { message: '  Chào cả nhà  ' });
    expect(res.status).toBe(201);
    expect(res.body.data.message).toMatchObject({
      user_id: nguoiA.id,
      user_name: 'Nguyễn Văn A',
      message: 'Chào cả nhà',
    });

    const { body } = await api.get('/api/v1/chat');
    expect(body.data.messages.map((m) => m.message)).toEqual(['Chào cả nhà']);
  });

  it('không có X-CSRF-Token ⇒ 403, không tin nào được lưu', async () => {
    const api = await nhuLa(nguoiA);
    const res = await api.post('/api/v1/chat', { message: 'lén gửi' }, { csrf: null });
    expect(res.status).toBe(403);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM chat_messages');
    expect(rows[0].n).toBe(0);
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const res = await client(app).post('/api/v1/chat', { message: 'ai đó' });
    expect(res.status).toBe(401);
  });

  it('tin rỗng hoặc chỉ khoảng trắng ⇒ 400', async () => {
    const api = await nhuLa(nguoiA);
    for (const message of ['', '   ', '\n\t']) {
      const res = await api.post('/api/v1/chat', { message });
      expect(res.status, `gửi ${JSON.stringify(message)}`).toBe(400);
      expect(res.body.error.field).toBe('message');
    }
  });

  it('tin dài hơn 2000 ký tự ⇒ 400', async () => {
    const api = await nhuLa(nguoiA);
    const res = await api.post('/api/v1/chat', { message: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('message');
  });

  it('đúng 2000 ký tự ⇒ vẫn nhận', async () => {
    const api = await nhuLa(nguoiA);
    const res = await api.post('/api/v1/chat', { message: 'y'.repeat(2000) });
    expect(res.status).toBe(201);
  });

  it('gửi tin ghi nhật ký kiểm toán, ĐỌC thì không (vòng hỏi lại 10 giây)', async () => {
    const api = await nhuLa(nguoiA);
    await api.post('/api/v1/chat', { message: 'có ghi log' });
    await api.get('/api/v1/chat');
    await api.get('/api/v1/chat');

    // `audit.js` ghi ở `res.on('finish')` (sau khi supertest đã trả về) ⇒ phải chờ, đọc ngay là
    // đỏ giả. Chờ xong mới khẳng định được ý của test: đúng MỘT dòng, hai lượt GET không ghi gì.
    await flushAudit();
    const { rows } = await pool.query(
      `SELECT action, entity_type FROM activity_logs WHERE entity_type = 'chat_message'`
    );
    expect(rows).toEqual([{ action: 'chat.send', entity_type: 'chat_message' }]);
  });
});

describe('TC-MISC-07: hai người cùng mở khung chat', () => {
  it('B thấy tin của A ở lượt hỏi lại kế tiếp, và không thấy lại tin cũ', async () => {
    const apiA = await nhuLa(nguoiA);
    const apiB = await nhuLa(nguoiB);

    await apiA.post('/api/v1/chat', { message: 'A chào B' });
    const mocB = (await apiB.get('/api/v1/chat')).body.data.since;
    expect(mocB).toBeTruthy();

    // Lượt hỏi lại ngay sau đó: chưa ai nói gì ⇒ rỗng.
    expect(
      (await apiB.get(`/api/v1/chat?since=${encodeURIComponent(mocB)}`)).body.data.messages
    ).toEqual([]);

    await apiA.post('/api/v1/chat', { message: 'A nói thêm' });
    const lai = await apiB.get(`/api/v1/chat?since=${encodeURIComponent(mocB)}`);
    expect(lai.body.data.messages.map((m) => m.message)).toEqual(['A nói thêm']);
    expect(JSON.stringify(lai.body)).not.toContain('A chào B');

    // B trả lời, A hỏi lại bằng mốc của mình ⇒ chỉ thấy tin của B.
    const mocA = (await apiA.get('/api/v1/chat')).body.data.since;
    await apiB.post('/api/v1/chat', { message: 'B trả lời' });
    const cuaA = await apiA.get(`/api/v1/chat?since=${encodeURIComponent(mocA)}`);
    expect(cuaA.body.data.messages.map((m) => [m.user_name, m.message])).toEqual([
      ['Trần Thị B', 'B trả lời'],
    ]);
  });
});

describe('TC-MISC-08: tin chứa mã HTML được lưu nguyên văn', () => {
  const doc = '<script>alert(1)</script>';

  it('gửi rồi đọc lại được đúng từng ký tự, kể cả trong DB', async () => {
    const api = await nhuLa(nguoiA);
    const res = await api.post('/api/v1/chat', { message: doc });
    expect(res.status).toBe(201);
    expect(res.body.data.message.message).toBe(doc);

    const { rows } = await pool.query('SELECT message FROM chat_messages');
    expect(rows[0].message).toBe(doc);
    expect((await api.get('/api/v1/chat')).body.data.messages[0].message).toBe(doc);
  });

  it('tin nhắn kỹ thuật kiểu `if (a < b && c > d)` không bị cắt', async () => {
    const api = await nhuLa(nguoiA);
    const ma = 'sửa chỗ này: if (a < b && c > d) { return "ok"; }';
    await api.post('/api/v1/chat', { message: ma });
    expect((await api.get('/api/v1/chat')).body.data.messages[0].message).toBe(ma);
  });
});

describe('Cầu RPC — getChatMessages / sendChatMessage', () => {
  const rpc = (api, name, args) => api.post(`/api/rpc/${name}`, { args });

  it('getChatMessages trả MẢNG THẲNG với 5 khoá của khung chat cũ', async () => {
    await themTin({ message: 'tin cũ hơn', truocPhut: 5 });
    await themTin({ message: 'tin mới hơn', truocPhut: 1, user: nguoiB });

    const api = await nhuLa(nguoiA);
    const res = await rpc(api, 'getChatMessages', []);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const [dau, sau] = res.body.data;
    expect(Object.keys(dau).sort()).toEqual([
      'avatar',
      'chatDate',
      'id',
      'message',
      'timestamp',
      'user',
    ]);
    expect(dau).toMatchObject({ user: 'Nguyễn Văn A', avatar: 'NV', message: 'tin cũ hơn' });
    expect(sau).toMatchObject({ user: 'Trần Thị B', avatar: 'TT', message: 'tin mới hơn' });
    expect(dau.timestamp).toMatch(/^\d{2}:\d{2}$/);
    expect(dau.chatDate).toBe(new Date().toDateString());
  });

  it('getChatMessages nhận mốc since như tham số thứ nhất', async () => {
    await themTin({ message: 'tin trước mốc', truocPhut: 10 });
    const api = await nhuLa(nguoiA);
    const moc = (await api.get('/api/v1/chat')).body.data.since;
    await themTin({ message: 'tin sau mốc', truocPhut: 0 });

    const res = await rpc(api, 'getChatMessages', [moc]);
    expect(res.body.data.map((m) => m.message)).toEqual(['tin sau mốc']);
  });

  it('sendChatMessage trả {success:true, message} đúng hình dạng cũ', async () => {
    const api = await nhuLa(nguoiA);
    const res = await rpc(api, 'sendChatMessage', ['gửi qua cầu']);
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.message).toMatchObject({
      user: 'Nguyễn Văn A',
      avatar: 'NV',
      message: 'gửi qua cầu',
    });
    expect(res.body.data.message.id).toBeGreaterThan(0);

    const { rows } = await pool.query('SELECT message FROM chat_messages');
    expect(rows.map((r) => r.message)).toEqual(['gửi qua cầu']);
  });

  it('sendChatMessage tin rỗng ⇒ 400 qua cầu', async () => {
    const api = await nhuLa(nguoiA);
    const res = await rpc(api, 'sendChatMessage', ['   ']);
    expect(res.status).toBe(400);
  });

  it('cầu RPC vẫn cần CSRF và đăng nhập', async () => {
    const api = await nhuLa(nguoiA);
    const khongCsrf = await api.post('/api/rpc/sendChatMessage', { args: ['lén'] }, { csrf: null });
    expect(khongCsrf.status).toBe(403);

    const chuaLogin = await client(app).post('/api/rpc/getChatMessages', { args: [] });
    expect(chuaLogin.status).toBe(401);
  });
});

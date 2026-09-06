// ĐẨY HÀNG ĐỢI ZALO — tích hợp (017, TC-ZL-10..14 của docs/KE-HOACH-THONG-BAO.md B7).
//
// Ba quyết định khung test:
//  1. env đặt TRƯỚC khi import cron (ảnh chụp env.js) — chỉ cần ZALO_BOT_TOKEN, cách nhận để mặc
//     định 'tat': dayThongBaoZalo chỉ hỏi daBat(), không quan tâm polling/webhook.
//  2. Thông báo cắm THẲNG vào bảng `notifications` bằng SQL — kiểm đúng hàng đợi, không phụ thuộc
//     luồng tạo thông báo của nghiệp vụ khác.
//  3. Mọi khẳng định «đã gửi/bỏ qua/thất bại» ĐỌC LẠI CỘT trong CSDL (zalo_sent_at, zalo_attempts,
//     zalo_error) — thân phản hồi chỉ là tín hiệu phụ.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('ZALO_BOT_TOKEN', 'token-test-123');
vi.stubEnv('ZALO_BOT_API_BASE', 'https://bot-api.example.test');
vi.resetModules();

const { dayThongBaoZalo } = await import('../../src/services/cron.js');
const { closePool, pool } = await import('../../src/db/pool.js');
const { makeDepartment, resetTables } = await import('../helpers/db.js');
const { client, makeLoginUser } = await import('../helpers/http.js');

let goiZalo;

/** Giả fetch: ghi lời gọi; mặc định trả {ok:true} như Zalo thật khi thành công. */
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

async function themThongBao(userId, { content, type, isRead = false, tuoiGio = 0 }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, content, type, is_read, created_at)
     VALUES ($1, $2, $3, $4, now() - ($5 || ' hours')::interval)
     RETURNING id`,
    [userId, content, type, isRead, String(tuoiGio)]
  );
  return rows[0].id;
}

async function trangThaiZalo(id) {
  const { rows } = await pool.query(
    'SELECT zalo_sent_at, zalo_attempts, zalo_error FROM notifications WHERE id = $1',
    [id]
  );
  return rows[0];
}

let nguoiA;

beforeEach(async () => {
  await resetTables();
  datFetchZalo();
  await makeDepartment();
  nguoiA = await makeLoginUser({ code: 'NV001', email: 'a@congty.vn', full_name: 'Nguyễn Văn A' });
});

afterAll(async () => {
  await closePool();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('TC-ZL-10: chỉ đẩy 3 loại tin, gắn nhãn đầu tin, KHÔNG đẩy phần «Lý do:»', () => {
  it('5 dòng trong hàng đợi ⇒ đúng 3 tin đi, 2 loại ngoài danh sách nằm nguyên', async () => {
    await pool.query('UPDATE users SET zalo_chat_id = $1 WHERE id = $2', ['chat-A', nguoiA.id]);
    const idCho = await themThongBao(nguoiA.id, {
      type: 'approval_pending',
      content: 'Phê duyệt đề xuất mua sắm của Phòng Kỹ thuật',
    });
    const idTra = await themThongBao(nguoiA.id, {
      type: 'approval_rejected',
      content: 'Trả lại đề xuất mua sắm của Phòng Kỹ thuật. Lý do: Thiếu báo giá',
    });
    const idHan = await themThongBao(nguoiA.id, {
      type: 'overdue',
      content: 'Nhiệm vụ «Gửi báo cáo tuần» đã quá hạn',
    });
    const idDuyet = await themThongBao(nguoiA.id, {
      type: 'approval_approved', // ngoài danh sách đẩy
      content: 'Đề xuất mua sắm đã được duyệt',
    });
    const idTin = await themThongBao(nguoiA.id, { type: 'info', content: 'Thông báo chung' });

    const kq = await dayThongBaoZalo();
    expect(kq).toEqual({ trongDoi: 3, daGui: 3, boQua: 0, thatBai: 0, tat: false });

    expect(goiZalo).toHaveLength(3);
    expect(goiZalo.every((g) => g.body.chat_id === 'chat-A')).toBe(true);
    expect(goiZalo[0].body.text).toBe(
      '[Chờ duyệt] Phê duyệt đề xuất mua sắm của Phòng Kỹ thuật Mở hệ thống để xem chi tiết.'
    );
    expect(goiZalo[1].body.text).toBe(
      '[Trả lại] Trả lại đề xuất mua sắm của Phòng Kỹ thuật. Mở hệ thống để xem chi tiết.'
    );
    // Phần riêng tư nhất của tin từ chối — lý do — không được lọt sang Zalo (B1.4).
    expect(goiZalo[1].body.text).not.toContain('Lý do');
    expect(goiZalo[1].body.text).not.toContain('Thiếu báo giá');
    expect(goiZalo[2].body.text).toContain('[Quá hạn]');

    for (const id of [idCho, idTra, idHan]) {
      const dong = await trangThaiZalo(id);
      expect(dong.zalo_sent_at).not.toBeNull();
      expect(dong.zalo_error).toBe('');
    }
    for (const id of [idDuyet, idTin]) {
      expect((await trangThaiZalo(id)).zalo_sent_at).toBeNull(); // chưa từng chạm
    }
  });

  it('lượt thứ hai KHÔNG gửi lại tin đã gửi (zalo_sent_at là chốt chống trùng)', async () => {
    await pool.query('UPDATE users SET zalo_chat_id = $1 WHERE id = $2', ['chat-A', nguoiA.id]);
    await themThongBao(nguoiA.id, { type: 'overdue', content: 'Việc quá hạn' });
    await dayThongBaoZalo();
    expect(goiZalo).toHaveLength(1);

    const kq2 = await dayThongBaoZalo();
    expect(kq2.trongDoi).toBe(0);
    expect(goiZalo).toHaveLength(1); // không thêm lời gọi nào
  });
});

describe('TC-ZL-11: người CHƯA liên kết ⇒ bỏ qua một lần, không thử lại mỗi 2 phút', () => {
  it('đánh dấu zalo_sent_at kèm lý do, KHÔNG gọi Zalo', async () => {
    const id = await themThongBao(nguoiA.id, { type: 'approval_pending', content: 'Chờ duyệt' });
    const kq = await dayThongBaoZalo();
    expect(kq).toEqual({ trongDoi: 1, daGui: 0, boQua: 1, thatBai: 0, tat: false });
    expect(goiZalo).toHaveLength(0);

    const dong = await trangThaiZalo(id);
    expect(dong.zalo_sent_at).not.toBeNull();
    expect(dong.zalo_error).toBe('chưa liên kết Zalo');

    const kq2 = await dayThongBaoZalo(); // lượt sau: hàng đợi với người này đã rỗng
    expect(kq2.trongDoi).toBe(0);
  });
});

describe('TC-ZL-12: Zalo chặn ⇒ thử đúng 3 lần rồi buông, KHÔNG thiêu tin', () => {
  it('mỗi lượt thất bại tăng zalo_attempts; lượt thứ tư không còn thấy dòng đó', async () => {
    await pool.query('UPDATE users SET zalo_chat_id = $1 WHERE id = $2', ['chat-A', nguoiA.id]);
    const id = await themThongBao(nguoiA.id, { type: 'overdue', content: 'Việc quá hạn' });
    datFetchZalo({ ok: false, description: 'Bot đang bảo trì' });

    for (const lan of [1, 2, 3]) {
      const kq = await dayThongBaoZalo();
      expect(kq).toEqual({ trongDoi: 1, daGui: 0, boQua: 0, thatBai: 1, tat: false });
      const dong = await trangThaiZalo(id);
      expect(dong.zalo_attempts).toBe(lan);
      expect(dong.zalo_sent_at).toBeNull(); // vẫn TRONG hàng đợi — khác với bỏ qua
      expect(dong.zalo_error).toContain('bảo trì');
    }

    const kq4 = await dayThongBaoZalo(); // hết lượt thử: dòng bị loại khỏi truy vấn
    expect(kq4.trongDoi).toBe(0);
    expect(kq4.thatBai).toBe(0);
  });
});

describe('TC-ZL-13: tin quá cửa sổ 24 giờ và tin đã đọc ⇒ KHÔNG đẩy', () => {
  it('tin 30 giờ tuổi và tin is_read=true nằm ngoài hàng đợi', async () => {
    await pool.query('UPDATE users SET zalo_chat_id = $1 WHERE id = $2', ['chat-A', nguoiA.id]);
    await themThongBao(nguoiA.id, { type: 'overdue', content: 'Tin đã cũ', tuoiGio: 30 });
    await themThongBao(nguoiA.id, { type: 'overdue', content: 'Tin đã đọc', isRead: true });

    const kq = await dayThongBaoZalo();
    expect(kq).toEqual({ trongDoi: 0, daGui: 0, boQua: 0, thatBai: 0, tat: false });
    expect(goiZalo).toHaveLength(0);
  });
});

describe('TC-ZL-14: Zalo SẬP cũng không được phá luồng duyệt (điểm chốt của B7)', () => {
  it('fetch ném lỗi ⇒ duyệt việc vẫn 200, dayThongBaoZalo không ném, tin nằm lại chờ', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();
    const phongA = await makeDepartment({ code: 'PH09', name: 'Phòng Kỹ thuật 9' });
    const tp = await makeLoginUser({
      code: 'NV010',
      full_name: 'Trần Thị Trưởng',
      email: 'tp01@test.local',
      role: 'Trưởng phòng',
      department_id: phongA.id,
    });
    const pgd = await makeLoginUser({
      code: 'NV002',
      full_name: 'Lê Văn Phó',
      email: 'pgd-a@test.local',
      role: 'Phó Giám đốc',
      department_id: phongA.id,
    });
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role)
       VALUES ($1, $2, 'deputy_director')`,
      [phongA.id, pgd.id]
    );
    const apiTp = client(app);
    await apiTp.login(tp.email);
    const apiPgd = client(app);
    await apiPgd.login(pgd.email);

    // Zalo bắt đầu sập: mọi lời gọi fetch ném lỗi mạng.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED')))
    );

    // 1) Luồng duyệt KHÔNG liên quan tới fetch — phải nguyên vẹn kể cả khi Zalo chết.
    const tao = await apiTp.post('/api/v1/works', {
      name: 'Việc phòng A',
      departmentId: phongA.id,
    });
    expect(tao.status).toBe(200);
    const work = tao.body.data.work;
    const duyet = await apiPgd.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(duyet.status).toBe(200);
    const { rows } = await pool.query('SELECT approval_status FROM works WHERE code = $1', [
      work.code,
    ]);
    expect(rows[0].approval_status).toBe('Đã duyệt');

    // 2) Lượt đẩy trong lúc Zalo sập: KHÔNG ném (cron mà chết thì mất cả lịch), tin nằm lại hàng đợi.
    await pool.query('UPDATE users SET zalo_chat_id = $1 WHERE id = $2', ['chat-PGD', pgd.id]);
    const id = await themThongBao(pgd.id, {
      type: 'approval_pending',
      content: 'KIỂM TRA MẤT ZALO — phê duyệt đề xuất X',
    });
    const kq = await dayThongBaoZalo(); // nếu ném, test đỏ ngay tại đây
    expect(kq.tat).toBe(false);
    expect(kq.thatBai).toBeGreaterThanOrEqual(1);
    const dong = await trangThaiZalo(id);
    expect(dong.zalo_attempts).toBeGreaterThanOrEqual(1);
    expect(dong.zalo_sent_at).toBeNull(); // chưa gửi được ⇒ Zalo sống lại thì vẫn đẩy
    expect(dong.zalo_error).not.toBe('');
  });
});

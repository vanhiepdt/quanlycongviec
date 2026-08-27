// Thông báo — đường tạo `POST /api/v1/notifications` (§2.10 nhóm J1, §5.2), chạy qua HTTP thật.
//
// Ba câu hỏi bộ test này canh:
//   1. **Chỉ admin.** Bản cũ chặn cả Phó Giám đốc, Trưởng/Phó phòng, Quản lý công việc và Nhân viên
//      (`Code.gs.moi` 1348 / 1374 / 1395). Nới chỗ này là cho phép người bất kỳ gửi thông báo mạo
//      danh tổ chức cho toàn đơn vị.
//   2. **Người nhận dò ra `user_id`** — id, mã nhân sự, email hay HỌ TÊN. Hai người cùng tên thì
//      KHÔNG đoán hộ (bẫy trùng tên của §13.5), người không có thì 404 chứ không im lặng bỏ qua.
//   3. **Để trống người nhận = gửi tất cả**, trải thành từng dòng, và KHÔNG gửi cho người đã nghỉ.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

const URL_TB = '/api/v1/notifications';

let phong;
let quanTri;
let nhanVien;
let truongPhong;
let phoGiamDoc;
let daNghi;

async function nhuLa(user) {
  const api = client(app);
  const res = await api.login(user.email);
  expect(res.status, `đăng nhập ${user.email}`).toBe(200);
  return api;
}

/** Đọc thẳng bảng: hệ thống chưa có đường REST nào để ĐỌC thông báo (§5.2 chỉ có đường tạo). */
async function dongThongBao() {
  const { rows } = await pool.query(
    'SELECT user_id, content, type, is_read, ref_type, ref_id FROM notifications ORDER BY id'
  );
  return rows;
}

beforeEach(async () => {
  await resetTables();
  phong = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1 });
  quanTri = await makeLoginUser({
    code: 'NV001',
    email: 'admin@congty.vn',
    full_name: 'Quản Trị Viên',
    role: 'admin',
  });
  nhanVien = await makeLoginUser({
    code: 'NV002',
    email: 'b@congty.vn',
    full_name: 'Trần Thị B',
    role: 'Nhân viên',
    department_id: phong.id,
  });
  truongPhong = await makeLoginUser({
    code: 'NV003',
    email: 'tp@congty.vn',
    full_name: 'Lê Trưởng Phòng',
    role: 'Trưởng phòng',
    department_id: phong.id,
  });
  phoGiamDoc = await makeLoginUser({
    code: 'NV004',
    email: 'pgd@congty.vn',
    full_name: 'Phạm Phó Giám Đốc',
    role: 'Phó Giám đốc',
    department_id: phong.id,
  });
  daNghi = await makeLoginUser({
    code: 'NV005',
    email: 'nghi@congty.vn',
    full_name: 'Đỗ Đã Nghỉ',
    role: 'Nhân viên',
    department_id: phong.id,
    is_active: false,
  });
});

afterAll(async () => {
  await closePool();
});

describe('POST /notifications — quyền (port nguyên luật bản cũ)', () => {
  it('chưa đăng nhập ⇒ 401, không dòng nào được ghi', async () => {
    const res = await client(app).post(URL_TB, { content: 'Thông báo lén' });
    expect(res.status).toBe(401);
    expect(await dongThongBao()).toHaveLength(0);
  });

  it('admin gửi được', async () => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, { content: 'Nghỉ lễ 2/9', recipient: 'Trần Thị B' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.total).toBe(1);
  });

  it.each([
    ['Phó Giám đốc', () => phoGiamDoc],
    ['Trưởng phòng', () => truongPhong],
    ['Nhân viên', () => nhanVien],
  ])('%s ⇒ 403 và KHÔNG có dòng nào được ghi', async (_vai, layNguoi) => {
    const api = await nhuLa(layNguoi());
    const res = await api.post(URL_TB, { content: 'Tôi tự gửi', recipient: 'Trần Thị B' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await dongThongBao()).toHaveLength(0);
  });
});

describe('POST /notifications — dò người nhận', () => {
  it.each([
    ['họ tên', () => 'Trần Thị B'],
    ['mã nhân sự', () => 'NV002'],
    ['email', () => 'b@congty.vn'],
    ['id', () => String(nhanVien.id)],
  ])('nhận theo %s ⇒ đúng một dòng cho đúng người', async (_kieu, layRef) => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, { content: 'Nhắc việc riêng', recipient: layRef() });
    expect(res.status).toBe(201);
    const rows = await dongThongBao();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].user_id)).toBe(Number(nhanVien.id));
    expect(rows[0].content).toBe('Nhắc việc riêng');
    expect(rows[0].is_read).toBe(false);
    // Thông báo gõ tay không trỏ tới bản ghi nào — `ref_type` rỗng, `ref_id` null.
    expect(rows[0].ref_type).toBe('');
    expect(rows[0].ref_id).toBeNull();
  });

  it('người nhận không tồn tại ⇒ 404 nói rõ tên, không ghi dòng nào', async () => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, { content: 'Xin chào', recipient: 'Người Không Có' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Người Không Có');
    expect(await dongThongBao()).toHaveLength(0);
  });

  it('hai người cùng họ tên ⇒ 400 mời chọn bằng email, KHÔNG đoán hộ (§13.5)', async () => {
    await makeLoginUser({
      code: 'NV006',
      email: 'b2@congty.vn',
      full_name: 'Trần Thị B',
      role: 'Nhân viên',
      department_id: phong.id,
    });
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, { content: 'Ai nhận?', recipient: 'Trần Thị B' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('recipient');
    expect(res.body.error.message).toContain('email');
    expect(await dongThongBao()).toHaveLength(0);
  });

  it('để trống người nhận ⇒ gửi CHO TẤT CẢ người còn hoạt động, bỏ người đã nghỉ', async () => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, { content: 'Họp toàn đơn vị 8h', recipient: '' });
    expect(res.status).toBe(201);
    // 5 người trong CSDL, 1 người đã nghỉ ⇒ 4 dòng, kể cả chính admin đang gửi.
    expect(res.body.data.total).toBe(4);
    const rows = await dongThongBao();
    const nhan = rows.map((r) => Number(r.user_id)).sort((a, b) => a - b);
    expect(nhan).toEqual(
      [quanTri.id, nhanVien.id, truongPhong.id, phoGiamDoc.id].map(Number).sort((a, b) => a - b)
    );
    expect(nhan).not.toContain(Number(daNghi.id));
  });
});

describe('POST /notifications — nội dung và loại', () => {
  it('nội dung rỗng (hoặc chỉ khoảng trắng) ⇒ 400 chỉ đúng trường content', async () => {
    const api = await nhuLa(quanTri);
    for (const content of ['', '   ']) {
      const res = await api.post(URL_TB, { content, recipient: 'NV002' });
      expect(res.status, JSON.stringify({ content })).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.field).toBe('content');
    }
    expect(await dongThongBao()).toHaveLength(0);
  });

  it('nội dung dài quá 2000 ký tự ⇒ 400, không cắt ngắn im lặng', async () => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, { content: 'a'.repeat(2001), recipient: 'NV002' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('content');
    expect(await dongThongBao()).toHaveLength(0);
  });

  it.each([
    ['Thông báo', 'info'],
    ['Công việc', 'info'],
    ['Hệ thống', 'info'],
    ['Khẩn cấp', 'warning'],
    ['', 'info'],
    ['Loại lạ chưa từng có', 'info'],
    ['overdue', 'overdue'],
  ])('nhãn "%s" của form cũ ⇒ cột type = "%s"', async (nhan, khoa) => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, {
      content: 'Nội dung thử loại',
      recipient: 'NV002',
      type: nhan,
    });
    expect(res.status).toBe(201);
    const rows = await dongThongBao();
    expect(rows[0].type).toBe(khoa);
  });

  it('nội dung lưu NGUYÊN VĂN, kể cả thẻ HTML (thoát ký tự là việc của giao diện)', async () => {
    const api = await nhuLa(quanTri);
    const tho = '<script>alert(1)</script> & "trích dẫn"';
    const res = await api.post(URL_TB, { content: tho, recipient: 'NV002' });
    expect(res.status).toBe(201);
    const rows = await dongThongBao();
    expect(rows[0].content).toBe(tho);
  });
});

describe('POST /notifications — nhật ký kiểm toán', () => {
  it('ghi dòng notification.create, nhưng KHÔNG đưa nội dung thông báo vào nhật ký', async () => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_TB, { content: 'Chuyện nội bộ', recipient: 'NV002' });
    expect(res.status).toBe(201);
    let rows = [];
    for (let i = 0; i < 40 && rows.length === 0; i += 1) {
      const q = await pool.query(
        `SELECT action, entity_type, entity_id, details FROM activity_logs
          WHERE action = 'notification.create'`
      );
      rows = q.rows;
      if (rows.length === 0) await new Promise((r) => setTimeout(r, 25));
    }
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_type).toBe('notification');
    expect(rows[0].details.total).toBe(1);
    expect(JSON.stringify(rows[0].details)).not.toContain('Chuyện nội bộ');
  });
});

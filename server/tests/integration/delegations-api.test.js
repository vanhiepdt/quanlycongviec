// TC-UQ-01..06, 13, 14 — Ủy quyền có thời hạn qua HTTP thật + các ràng buộc của
// 006_delegations.sql (kế hoạch: `docs/KE-HOACH-UY-QUYEN.md`).
//
// Bốn câu hỏi bộ test này canh:
//   1. **CSDL là lớp chặn cuối.** Ba CHECK và EXCLUDE `delegation_no_overlap` phải chặn được cả khi
//      ai đó ghi thẳng vào bảng — service chỉ là lớp cho câu chữ đẹp.
//   2. **L2/L3 chặn từ lúc tạo.** Không ủy quyền vai admin, không ủy quyền phòng mình không phụ
//      trách. Tập con phòng thì được.
//   3. **Mượn quyền có DẤU VẾT.** Mỗi hành động lọt nhờ ủy quyền ghi `delegation_id` vào
//      `activity_logs.details` — đây là yêu cầu gốc của tính năng, không phải phần thêm cho đẹp.
//   4. **Huỷ là huỷ MỀM.** Dòng vẫn còn trong bảng để đối chiếu với nhật ký, và người ngoài không
//      huỷ được bản ghi của người khác.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { makeDepartment, makeWork, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

const URL_UQ = '/api/v1/delegations';

let phongA;
let phongB;
let quanTri;
let phoGiamDoc; // phụ trách phòng A
let truongPhongB;
let nhanVien; // người được ủy quyền
let nhanVienKhac;

async function nhuLa(user) {
  const api = client(app);
  const res = await api.login(user.email);
  expect(res.status, `đăng nhập ${user.email}`).toBe(200);
  return api;
}

/** Ngày dạng `YYYY-MM-DD` lệch `soNgay` so với HÔM NAY THEO CSDL — không dùng `new Date()` của
 *  Node (§13.5 bẫy (b): máy chủ UTC, người dùng ICT, ranh giới ngày phải theo CSDL). */
async function ngayLech(soNgay) {
  const { rows } = await pool.query(
    `SELECT to_char(current_date + ($1 || ' day')::interval, 'YYYY-MM-DD') AS d`,
    [soNgay]
  );
  return rows[0].d;
}

/** Ghi thẳng vào bảng, bỏ qua service — để đo đúng phần ràng buộc của CSDL. */
function chenThang(row) {
  return pool.query(
    `INSERT INTO delegations (from_user_id, to_user_id, department_ids, from_date, to_date, status)
     VALUES ($1,$2,COALESCE($3::bigint[],'{}'::bigint[]),$4,$5,COALESCE($6,'active'))
     RETURNING id`,
    [row.from, row.to, row.depts ?? null, row.fromDate, row.toDate, row.status ?? null]
  );
}

async function dongNhatKy(action) {
  const { rows } = await pool.query(
    'SELECT action, entity_type, entity_id, details FROM activity_logs WHERE action = $1 ORDER BY id',
    [action]
  );
  return rows;
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1 });
  phongB = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });
  quanTri = await makeLoginUser({
    code: 'NV001',
    email: 'admin@congty.vn',
    full_name: 'Quản Trị Viên',
    role: 'admin',
  });
  phoGiamDoc = await makeLoginUser({
    code: 'NV002',
    email: 'pgd@congty.vn',
    full_name: 'Phạm Phó Giám Đốc',
    role: 'Phó Giám đốc',
    department_id: phongA.id,
  });
  truongPhongB = await makeLoginUser({
    code: 'NV003',
    email: 'tpb@congty.vn',
    full_name: 'Lê Trưởng Phòng B',
    role: 'Trưởng phòng',
    department_id: phongB.id,
  });
  nhanVien = await makeLoginUser({
    code: 'NV004',
    email: 'nv@congty.vn',
    full_name: 'Trần Thị Nhân Viên',
    role: 'Nhân viên',
    department_id: phongA.id,
  });
  nhanVienKhac = await makeLoginUser({
    code: 'NV005',
    email: 'nv2@congty.vn',
    full_name: 'Vũ Văn Khác',
    role: 'Nhân viên',
    department_id: phongB.id,
  });
  // Phó Giám đốc phụ trách phòng A — nguồn phạm vi của mọi phép kiểm dưới đây.
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, 'deputy_director')`,
    [phongA.id, phoGiamDoc.id]
  );
});

afterAll(async () => {
  await closePool();
});

describe('TC-UQ-01: lược đồ 006_delegations.sql', () => {
  it('TC-UQ-01: bảng, 4 ràng buộc, 2 chỉ mục và trigger updated_at đều có mặt', async () => {
    // Chỉ CHECK ('c') và EXCLUDE ('x') — bỏ khoá chính, ba khoá ngoại và các ràng buộc NOT NULL do
    // Postgres tự đặt tên.
    const { rows: cons } = await pool.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'delegations'::regclass AND contype IN ('c', 'x')
        ORDER BY conname`
    );
    expect(cons.map((r) => r.conname)).toEqual([
      'delegation_dates_ok',
      'delegation_no_overlap',
      'delegation_not_self',
      'delegation_status_ok',
    ]);

    const { rows: idx } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'delegations' ORDER BY indexname`
    );
    expect(idx.map((r) => r.indexname)).toContain('idx_delegations_to_active');
    expect(idx.map((r) => r.indexname)).toContain('idx_delegations_from');

    const { rows: trg } = await pool.query(
      `SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'delegations'::regclass AND NOT tgisinternal`
    );
    expect(trg.map((r) => r.tgname)).toContain('trg_delegations_updated');
  });

  it('TC-UQ-01b: trigger updated_at đẩy mốc thời gian khi sửa', async () => {
    const { rows } = await chenThang({
      from: phoGiamDoc.id,
      to: nhanVien.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    const { rows: sau } = await pool.query(
      `UPDATE delegations SET note = 'đổi' WHERE id = $1
        RETURNING updated_at > created_at AS moi_hon`,
      [rows[0].id]
    );
    expect(sau[0].moi_hon).toBe(true);
  });
});

describe('TC-UQ-02..04: ràng buộc của CSDL (ghi thẳng vào bảng)', () => {
  it('TC-UQ-02: tự ủy quyền cho mình bị CHECK chặn', async () => {
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: phoGiamDoc.id,
        fromDate: await ngayLech(0),
        toDate: await ngayLech(1),
      })
    ).rejects.toThrow(/delegation_not_self/);
  });

  it('TC-UQ-03: ngày kết thúc trước ngày bắt đầu bị CHECK chặn', async () => {
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: nhanVien.id,
        fromDate: await ngayLech(5),
        toDate: await ngayLech(2),
      })
    ).rejects.toThrow(/delegation_dates_ok/);
  });

  it('TC-UQ-04: hai bản active chồng ngày bị EXCLUDE chặn; liền kề thì được', async () => {
    await chenThang({
      from: phoGiamDoc.id,
      to: nhanVien.id,
      fromDate: await ngayLech(1),
      toDate: await ngayLech(7),
    });
    // Chồng lấp — kể cả chồng đúng MỘT ngày ở hai đầu (khoảng `'[]'` tính cả hai đầu).
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: nhanVien.id,
        fromDate: await ngayLech(7),
        toDate: await ngayLech(9),
      })
    ).rejects.toThrow(/delegation_no_overlap/);
    // Liền kề, không chồng.
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: nhanVien.id,
        fromDate: await ngayLech(8),
        toDate: await ngayLech(9),
      })
    ).resolves.toBeTruthy();
    // Cùng khoảng nhưng CẶP khác ⇒ không liên quan.
    await expect(
      chenThang({
        from: truongPhongB.id,
        to: nhanVien.id,
        fromDate: await ngayLech(1),
        toDate: await ngayLech(7),
      })
    ).resolves.toBeTruthy();
  });

  it('TC-UQ-04b: bản đã huỷ không tính vào chồng lấp', async () => {
    const { rows } = await chenThang({
      from: phoGiamDoc.id,
      to: nhanVien.id,
      fromDate: await ngayLech(1),
      toDate: await ngayLech(7),
    });
    await pool.query(`UPDATE delegations SET status = 'cancelled' WHERE id = $1`, [rows[0].id]);
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: nhanVien.id,
        fromDate: await ngayLech(1),
        toDate: await ngayLech(7),
      })
    ).resolves.toBeTruthy();
  });
});

describe('TC-UQ-05..06: L1–L3 chặn ở API', () => {
  it('TC-UQ-05: admin ủy quyền quyền của chính mình ⇒ DELEGATION_ADMIN_FORBIDDEN', async () => {
    const api = await nhuLa(quanTri);
    const res = await api.post(URL_UQ, {
      toUserId: nhanVien.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DELEGATION_ADMIN_FORBIDDEN');
  });

  it('TC-UQ-05b: tự ủy quyền cho chính mình ⇒ DELEGATION_SELF', async () => {
    const api = await nhuLa(phoGiamDoc);
    const res = await api.post(URL_UQ, {
      toUserId: phoGiamDoc.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DELEGATION_SELF');
  });

  it('TC-UQ-05c: Nhân viên không có phạm vi nào để ủy quyền ⇒ 403', async () => {
    const api = await nhuLa(nhanVien);
    const res = await api.post(URL_UQ, {
      toUserId: nhanVienKhac.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('TC-UQ-06: phòng không phụ trách ⇒ DELEGATION_SCOPE_TOO_WIDE; tập con thì được', async () => {
    const api = await nhuLa(phoGiamDoc);
    const vuot = await api.post(URL_UQ, {
      toUserId: nhanVien.id,
      departmentIds: [phongA.id, phongB.id],
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(vuot.status).toBe(403);
    expect(vuot.body.error.code).toBe('DELEGATION_SCOPE_TOO_WIDE');

    const dung = await api.post(URL_UQ, {
      toUserId: nhanVien.id,
      departmentIds: [phongA.id],
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(dung.status).toBe(201);
    expect(dung.body.data.delegation.department_ids.map(Number)).toEqual([Number(phongA.id)]);
  });

  it('TC-UQ-06b: trùng khoảng ngày qua API ⇒ DELEGATION_OVERLAP (409)', async () => {
    const api = await nhuLa(phoGiamDoc);
    const than = {
      toUserId: nhanVien.email,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    };
    expect((await api.post(URL_UQ, than)).status).toBe(201);
    const lai = await api.post(URL_UQ, than);
    expect(lai.status).toBe(409);
    expect(lai.body.error.code).toBe('DELEGATION_OVERLAP');
  });

  it('TC-UQ-06c: người thường không tạo hộ người khác được; admin thì được', async () => {
    const cuaNguoiKhac = {
      fromUserId: phoGiamDoc.id,
      toUserId: nhanVien.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    };
    const api = await nhuLa(nhanVien);
    expect((await api.post(URL_UQ, cuaNguoiKhac)).status).toBe(403);

    const apiAdmin = await nhuLa(quanTri);
    const res = await apiAdmin.post(URL_UQ, cuaNguoiKhac);
    expect(res.status).toBe(201);
    expect(Number(res.body.data.delegation.created_by)).toBe(Number(quanTri.id));
  });
});

describe('TC-UQ-13: hành động lọt nhờ mượn quyền có dấu vết trong nhật ký', () => {
  it('TC-UQ-13: Nhân viên được ủy quyền sửa được công việc phòng A, nhật ký có viaDelegationId', async () => {
    const congViec = await makeWork({
      code: 'DA001',
      name: 'Công việc phòng A',
      department_id: phongA.id,
    });

    // Chưa có ủy quyền: Nhân viên không sửa được công việc.
    const truoc = await nhuLa(nhanVien);
    const chan = await truoc.patch(`/api/v1/works/${congViec.code}`, { name: 'Đổi tên' });
    expect(chan.status).toBe(403);

    const apiPgd = await nhuLa(phoGiamDoc);
    const tao = await apiPgd.post(URL_UQ, {
      toUserId: nhanVien.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(tao.status).toBe(201);
    const uyQuyenId = Number(tao.body.data.delegation.id);

    // Đăng nhập lại: `attachSession` nạp danh sách ủy quyền mỗi request, nên phiên cũ cũng thấy —
    // dùng phiên mới cho rõ ý "quyền có hiệu lực ngay".
    const api = await nhuLa(nhanVien);
    const sua = await api.patch(`/api/v1/works/${congViec.code}`, { name: 'Đổi tên nhờ ủy quyền' });
    expect(sua.status).toBe(200);

    const logs = await dongNhatKy('works.update');
    expect(logs.length).toBe(1);
    expect(Number(logs[0].details.viaDelegationId)).toBe(uyQuyenId);
  });

  it('TC-UQ-13b: hành động bằng quyền TỰ CÓ không bị gắn viaDelegationId', async () => {
    const congViec = await makeWork({
      code: 'DA002',
      name: 'Công việc phòng A',
      department_id: phongA.id,
    });
    const api = await nhuLa(phoGiamDoc);
    expect((await api.patch(`/api/v1/works/${congViec.code}`, { name: 'Tự sửa' })).status).toBe(
      200
    );
    const logs = await dongNhatKy('works.update');
    expect(logs.length).toBe(1);
    expect(logs[0].details.viaDelegationId).toBeUndefined();
  });

  it('TC-UQ-13c: nhật ký của chính việc tạo ủy quyền ghi đủ hai đầu người + khoảng ngày', async () => {
    const api = await nhuLa(phoGiamDoc);
    const fromDate = await ngayLech(0);
    const toDate = await ngayLech(3);
    const res = await api.post(URL_UQ, { toUserId: nhanVien.id, fromDate, toDate, note: 'đi họp' });
    expect(res.status).toBe(201);
    const logs = await dongNhatKy('delegations.create');
    expect(logs.length).toBe(1);
    expect(Number(logs[0].details.fromUserId)).toBe(Number(phoGiamDoc.id));
    expect(Number(logs[0].details.toUserId)).toBe(Number(nhanVien.id));
    expect(logs[0].details.fromDate).toBe(fromDate);
    expect(logs[0].details.toDate).toBe(toDate);
    // `note` KHÔNG vào nhật ký: lý do đi công tác là chuyện riêng của người ta.
    expect(JSON.stringify(logs[0].details)).not.toContain('đi họp');
  });
});

describe('TC-UQ-14: huỷ mềm, sửa, và danh sách', () => {
  async function taoMotBan() {
    const api = await nhuLa(phoGiamDoc);
    const res = await api.post(URL_UQ, {
      toUserId: nhanVien.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(res.status).toBe(201);
    return { api, id: res.body.data.delegation.id };
  }

  it('TC-UQ-14: huỷ = status cancelled, dòng vẫn còn trong bảng', async () => {
    const { api, id } = await taoMotBan();
    const res = await api.del(`${URL_UQ}/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.delegation.status).toBe('cancelled');
    const { rows } = await pool.query('SELECT status FROM delegations WHERE id = $1', [id]);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('cancelled');
    // Huỷ lần hai không lỗi, vẫn là "đã huỷ".
    const lai = await api.del(`${URL_UQ}/${id}`);
    expect(lai.status).toBe(200);
    expect(lai.body.data.cancelled).toBe(false);
  });

  it('TC-UQ-14b: người khác không huỷ được bản ghi của người ta, admin thì được', async () => {
    const { id } = await taoMotBan();
    const apiNguoiNhan = await nhuLa(nhanVien);
    // Ngay cả NGƯỜI ĐƯỢC ỦY QUYỀN cũng không huỷ được: họ không phải người cho quyền.
    expect((await apiNguoiNhan.del(`${URL_UQ}/${id}`)).status).toBe(403);
    const apiKhac = await nhuLa(truongPhongB);
    expect((await apiKhac.del(`${URL_UQ}/${id}`)).status).toBe(403);
    const apiAdmin = await nhuLa(quanTri);
    expect((await apiAdmin.del(`${URL_UQ}/${id}`)).status).toBe(200);
  });

  it('TC-UQ-14c: sửa được to_date/note/phạm vi, sửa bản đã huỷ thì 409', async () => {
    const { api, id } = await taoMotBan();
    const toDate = await ngayLech(9);
    const sua = await api.patch(`${URL_UQ}/${id}`, { toDate, note: 'gia hạn' });
    expect(sua.status).toBe(200);
    expect(String(sua.body.data.delegation.to_date)).toBe(toDate);
    expect(sua.body.data.delegation.note).toBe('gia hạn');

    const vuot = await api.patch(`${URL_UQ}/${id}`, { departmentIds: [phongB.id] });
    expect(vuot.status).toBe(403);
    expect(vuot.body.error.code).toBe('DELEGATION_SCOPE_TOO_WIDE');

    expect((await api.del(`${URL_UQ}/${id}`)).status).toBe(200);
    const sauHuy = await api.patch(`${URL_UQ}/${id}`, { note: 'sửa nữa' });
    expect(sauHuy.status).toBe(409);
  });

  it('TC-UQ-14d: GET trả cả hai chiều của mình; ?all=1 chỉ admin dùng được', async () => {
    const { id } = await taoMotBan();
    const apiNguoiNhan = await nhuLa(nhanVien);
    const cuaToi = await apiNguoiNhan.get(URL_UQ);
    expect(cuaToi.status).toBe(200);
    expect(cuaToi.body.data.delegations.map((d) => Number(d.id))).toEqual([Number(id)]);
    expect(cuaToi.body.data.delegations[0].dang_hieu_luc).toBe(true);
    expect(cuaToi.body.data.delegations[0].from_user_name).toBe(phoGiamDoc.full_name);

    // Người không liên quan: danh sách rỗng, và `?all=1` cũng không mở thêm gì cho họ.
    const apiKhac = await nhuLa(truongPhongB);
    expect((await apiKhac.get(URL_UQ)).body.data.total).toBe(0);
    expect((await apiKhac.get(`${URL_UQ}?all=1`)).body.data.total).toBe(0);

    const apiAdmin = await nhuLa(quanTri);
    expect((await apiAdmin.get(`${URL_UQ}?all=1`)).body.data.total).toBe(1);
  });

  it('TC-UQ-14e: chưa đăng nhập thì không xem, không tạo', async () => {
    const api = client(app);
    expect((await api.get(URL_UQ)).status).toBe(401);
    const res = await api.post(URL_UQ, {
      toUserId: nhanVien.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(1),
    });
    expect(res.status).toBe(401);
  });
});

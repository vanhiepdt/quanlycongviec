// TC-UQ-01..06, 13, 14, 16, 17 — Ủy quyền có thời hạn qua HTTP thật + các ràng buộc của
// 006_delegations.sql / 007_delegations_approval.sql (kế hoạch: `docs/KE-HOACH-UY-QUYEN.md`).
//
// Sáu câu hỏi bộ test này canh:
//   1. **CSDL là lớp chặn cuối.** Ba CHECK và EXCLUDE `delegation_no_overlap` phải chặn được cả khi
//      ai đó ghi thẳng vào bảng — service chỉ là lớp cho câu chữ đẹp.
//   2. **L2/L3 chặn từ lúc tạo.** Không cho mượn quyền toàn hệ thống, không ủy quyền phòng mình
//      không phụ trách. Tập con phòng thì được.
//   3. **R2/R3 (§13.4 mục 17, 18).** Chỉ ủy quyền xuống cấp dưới hoặc ngang bằng, và phải cùng
//      phòng — trừ hai ngoại lệ cấp trên (Giám đốc → Phó GĐ; Phó GĐ → Phó GĐ/Trưởng phòng).
//   4. **R4 (§13.4 mục 20).** Tạo ra bản `pending` KHÔNG cho mượn gì; chỉ người nhận phê duyệt mới
//      thành `active`, và họ được THÔNG BÁO ngay lúc có đề nghị.
//   5. **Mượn quyền có DẤU VẾT.** Mỗi hành động lọt nhờ ủy quyền ghi `delegation_id` vào
//      `activity_logs.details` — đây là yêu cầu gốc của tính năng, không phải phần thêm cho đẹp.
//   6. **Huỷ là huỷ MỀM.** Dòng vẫn còn trong bảng để đối chiếu với nhật ký, và người ngoài không
//      huỷ được bản ghi của người khác.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { flushAudit } from '../../src/middleware/audit.js';
import { makeDepartment, makeWork, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

const URL_UQ = '/api/v1/delegations';

let phongA;
let phongB;
let quanTri;
let phoGiamDoc; // phụ trách phòng A
let phoGiamDocB; // không phụ trách phòng nào — để đo ngoại lệ "Phó GĐ ủy quyền cho nhau"
let truongPhongB;
let nhanVien; // người được ủy quyền
let nhanVienCungPhong; // cùng phòng A với `nhanVien` — để đo R1 "mọi cán bộ đều ủy quyền được"
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

// `middleware/audit.js` ghi nhật ký trong `res.on('finish')` — CỐ Ý ghi sau khi phản hồi đã gửi để
// không làm chậm người dùng. Supertest lại `resolve` ngay khi nhận phản hồi, nên đọc `activity_logs`
// liền sau đó có thể chưa thấy dòng nào: ĐỎ GIẢ, và đỏ khác nhau mỗi lượt chạy (TC-UQ-13b/13c/17).
async function dongNhatKy(action) {
  await flushAudit();
  const { rows } = await pool.query(
    'SELECT action, entity_type, entity_id, details FROM activity_logs WHERE action = $1 ORDER BY id',
    [action]
  );
  return rows;
}

/** Thông báo của một người, theo thứ tự sinh ra — để đo R4 có báo cho ĐÚNG người không. */
async function thongBaoCua(userId) {
  const { rows } = await pool.query(
    `SELECT content, type, ref_type, ref_id FROM notifications
      WHERE user_id = $1 ORDER BY id`,
    [userId]
  );
  return rows;
}

/** Người nhận bấm «Đồng ý» — không có bước này thì bản ghi chỉ là đề nghị (R4). */
async function pheDuyet(nguoiNhan, id) {
  const api = await nhuLa(nguoiNhan);
  const res = await api.post(`${URL_UQ}/${id}/accept`);
  expect(res.status, 'phê duyệt ủy quyền').toBe(200);
  expect(res.body.data.delegation.status).toBe('active');
  return res;
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
  nhanVienCungPhong = await makeLoginUser({
    code: 'NV006',
    email: 'nv3@congty.vn',
    full_name: 'Đỗ Thị Cùng Phòng',
    role: 'Nhân viên',
    department_id: phongA.id,
  });
  // Phó Giám đốc thứ hai: KHÔNG thuộc phòng nào và KHÔNG có dòng `department_managers`. Nhờ vậy mọi
  // quyền họ dùng được trong test dưới đây chỉ có thể đến từ ủy quyền, không phải quyền tự có.
  phoGiamDocB = await makeLoginUser({
    code: 'NV007',
    email: 'pgd2@congty.vn',
    full_name: 'Ngô Phó Giám Đốc Hai',
    role: 'Phó Giám đốc',
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

describe('TC-UQ-01: lược đồ 006_delegations.sql + 007_delegations_approval.sql', () => {
  it('TC-UQ-01: bảng, 4 ràng buộc, 2 chỉ mục và trigger updated_at đều có mặt', async () => {
    // Chỉ CHECK ('c') và EXCLUDE ('x') — bỏ khoá chính, ba khoá ngoại và các ràng buộc NOT NULL do
    // Postgres tự đặt tên. Migration 007 dựng lại hai trong bốn cái này nên TÊN phải giữ nguyên:
    // đổi tên là làm hỏng mọi câu `ON CONSTRAINT` và mọi bản vá sau đó.
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

  it('TC-UQ-01c (007): thêm accepted_at/declined_at, mặc định pending, CHECK nhận 4 trạng thái', async () => {
    const { rows: cols } = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'delegations' AND column_name IN ('accepted_at','declined_at','status')
        ORDER BY column_name`
    );
    expect(cols.map((c) => c.column_name)).toEqual(['accepted_at', 'declined_at', 'status']);
    // Hai mốc mới phải cho phép NULL: "chưa trả lời" là trạng thái bình thường, không phải thiếu dữ liệu.
    expect(cols[0].is_nullable).toBe('YES');
    expect(cols[1].is_nullable).toBe('YES');
    // Mặc định đổi từ 'active' sang 'pending' — đây chính là R4 ở tầng CSDL.
    expect(String(cols[2].column_default)).toContain('pending');

    // CHECK nhận đúng bốn trạng thái, và chỉ bốn. Mỗi bản một ngày riêng để EXCLUDE không chen vào
    // phép đo này (`pending` và `active` cùng nằm trong tầm EXCLUDE — xem TC-UQ-04c).
    const luat = ['pending', 'active', 'declined', 'cancelled'];
    for (const [i, status] of luat.entries()) {
      const ngayRieng = await ngayLech(10 + i * 2);
      await expect(
        chenThang({
          from: phoGiamDoc.id,
          to: nhanVien.id,
          fromDate: ngayRieng,
          toDate: ngayRieng,
          status,
        })
      ).resolves.toBeTruthy();
    }
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: nhanVien.id,
        fromDate: await ngayLech(30),
        toDate: await ngayLech(31),
        status: 'accepted', // không có trong luật — dễ gõ nhầm vì service có hàm `accept`
      })
    ).rejects.toThrow(/delegation_status_ok/);
  });

  it('TC-UQ-01d (007): không ghi status thì CSDL tự đặt pending', async () => {
    const { rows } = await pool.query(
      `INSERT INTO delegations (from_user_id, to_user_id, from_date, to_date)
       VALUES ($1,$2,$3,$4) RETURNING status, accepted_at, declined_at`,
      [phoGiamDoc.id, nhanVien.id, await ngayLech(0), await ngayLech(2)]
    );
    expect(rows[0].status).toBe('pending');
    expect(rows[0].accepted_at).toBeNull();
    expect(rows[0].declined_at).toBeNull();
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

  it('TC-UQ-04c (007): bản CHỜ PHÊ DUYỆT vẫn chặn chồng lấp, bản BỊ TỪ CHỐI thì không', async () => {
    // 007 nới vị từ của EXCLUDE thành ('pending','active') có chủ ý: hai đề nghị trùng ngày phải đổ ở
    // lúc TẠO (lỗi của người ủy quyền, sửa được ngay) chứ không để đổ lúc người nhận bấm «Đồng ý»
    // (khi đó người bấm phải đi giải thích một lỗi không phải của họ).
    const { rows } = await chenThang({
      from: phoGiamDoc.id,
      to: nhanVien.id,
      fromDate: await ngayLech(1),
      toDate: await ngayLech(7),
      status: 'pending',
    });
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: nhanVien.id,
        fromDate: await ngayLech(3),
        toDate: await ngayLech(4),
        status: 'pending',
      })
    ).rejects.toThrow(/delegation_no_overlap/);

    // Bị từ chối rồi thì khoảng ngày đó trống lại — người ủy quyền gửi lại đề nghị được.
    await pool.query(`UPDATE delegations SET status = 'declined' WHERE id = $1`, [rows[0].id]);
    await expect(
      chenThang({
        from: phoGiamDoc.id,
        to: nhanVien.id,
        fromDate: await ngayLech(3),
        toDate: await ngayLech(4),
        status: 'pending',
      })
    ).resolves.toBeTruthy();
  });
});

describe('TC-UQ-05..06: L1–L3 và R2–R3 chặn ở API', () => {
  it('TC-UQ-05: Giám đốc ủy quyền cho Phó Giám đốc — phải ghi rõ phòng (L2 · §13.4 mục 18)', async () => {
    const api = await nhuLa(quanTri);
    // Mục 18 cho phép cặp này, nhưng L2 không cho mượn quyền toàn hệ thống ⇒ thiếu phòng là lỗi.
    const thieuPhong = await api.post(URL_UQ, {
      toUserId: phoGiamDocB.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(thieuPhong.status).toBe(400);
    expect(thieuPhong.body.error.code).toBe('DELEGATION_ADMIN_SCOPE_REQUIRED');

    const dung = await api.post(URL_UQ, {
      toUserId: phoGiamDocB.id,
      departmentIds: [phongB.id],
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(dung.status).toBe(201);
    expect(dung.body.data.delegation.department_ids.map(Number)).toEqual([Number(phongB.id)]);
    expect(dung.body.data.delegation.status).toBe('pending');
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

  it('TC-UQ-05c: R1+R3 — cán bộ ủy quyền được cho người CÙNG PHÒNG, khác phòng thì không', async () => {
    const api = await nhuLa(nhanVien);
    // R3: Nhân viên phòng A → Nhân viên phòng B.
    const khacPhong = await api.post(URL_UQ, {
      toUserId: nhanVienKhac.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(khacPhong.status).toBe(403);
    expect(khacPhong.body.error.code).toBe('DELEGATION_DIFFERENT_DEPARTMENT');

    // R1 (mục 17 «mọi cán bộ đều được ủy quyền»): trước đây vai `Nhân viên` bị chặn thẳng, giờ thì
    // được — cùng phòng, ngang bậc.
    const cungPhong = await api.post(URL_UQ, {
      toUserId: nhanVienCungPhong.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(cungPhong.status).toBe(201);
    expect(cungPhong.body.data.delegation.status).toBe('pending');
  });

  it('TC-UQ-05d: R2 — ủy quyền LÊN cấp trên ⇒ DELEGATION_RANK_UP', async () => {
    // Cùng phòng A, nên cái sai duy nhất là HƯỚNG: bậc 5 → bậc 2.
    const apiNv = await nhuLa(nhanVien);
    const len = await apiNv.post(URL_UQ, {
      toUserId: phoGiamDoc.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(len.status).toBe(403);
    expect(len.body.error.code).toBe('DELEGATION_RANK_UP');

    // Trưởng phòng → Phó Giám đốc cũng là lên, dù cặp này có mặt ở ngoại lệ theo chiều NGƯỢC lại.
    const apiTp = await nhuLa(truongPhongB);
    const len2 = await apiTp.post(URL_UQ, {
      toUserId: phoGiamDoc.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(len2.status).toBe(403);
    expect(len2.body.error.code).toBe('DELEGATION_RANK_UP');
  });

  it('TC-UQ-05e: R3 — hai ngoại lệ khác phòng của Phó Giám đốc; Giám đốc → cán bộ vẫn chặn', async () => {
    const api = await nhuLa(phoGiamDoc);
    // Phó Giám đốc → Phó Giám đốc (không cùng phòng, người nhận không thuộc phòng nào).
    const choPgd = await api.post(URL_UQ, {
      toUserId: phoGiamDocB.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(choPgd.status).toBe(201);
    // Phó Giám đốc → Trưởng phòng phòng khác.
    const choTp = await api.post(URL_UQ, {
      toUserId: truongPhongB.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(choTp.status).toBe(201);

    // Ngoại lệ của Giám đốc CHỈ có Phó Giám đốc: Giám đốc không thuộc phòng nào nên ủy quyền cho một
    // Nhân viên là "khác phòng" — không có đường nào lách vào đây.
    const apiAdmin = await nhuLa(quanTri);
    const choNv = await apiAdmin.post(URL_UQ, {
      toUserId: nhanVien.id,
      departmentIds: [phongA.id],
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(choNv.status).toBe(403);
    expect(choNv.body.error.code).toBe('DELEGATION_DIFFERENT_DEPARTMENT');
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

    // R4 (§13.4 mục 20) — mới TẠO thì chưa cho mượn gì. Đây là phép đo quan trọng nhất của mục 20:
    // nếu bản `pending` đã cho quyền thì cả bước phê duyệt chỉ là trang trí.
    const choDuyet = await nhuLa(nhanVien);
    const vanChan = await choDuyet.patch(`/api/v1/works/${congViec.code}`, { name: 'Đổi tên sớm' });
    expect(vanChan.status).toBe(403);

    await pheDuyet(nhanVien, uyQuyenId);

    // Đăng nhập lại: `attachSession` nạp danh sách ủy quyền mỗi request, nên phiên cũ cũng thấy —
    // dùng phiên mới cho rõ ý "quyền có hiệu lực ngay sau khi đồng ý".
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
    // Bản mới tạo là `pending`: người nhận THẤY nó (để bấm đồng ý) nhưng nó chưa hiệu lực.
    expect(cuaToi.body.data.delegations[0].status).toBe('pending');
    expect(cuaToi.body.data.delegations[0].dang_hieu_luc).toBe(false);
    expect(cuaToi.body.data.delegations[0].from_user_name).toBe(phoGiamDoc.full_name);

    await pheDuyet(nhanVien, id);
    const sauDuyet = await (await nhuLa(nhanVien)).get(URL_UQ);
    expect(sauDuyet.body.data.delegations[0].dang_hieu_luc).toBe(true);

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

describe('TC-UQ-16: phê duyệt của người được ủy quyền (R4 · §13.4 mục 20)', () => {
  async function deNghi() {
    const api = await nhuLa(phoGiamDoc);
    const res = await api.post(URL_UQ, {
      toUserId: nhanVien.id,
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(res.status).toBe(201);
    return { api, id: res.body.data.delegation.id };
  }

  it('TC-UQ-16: tạo ra bản pending + thông báo cho NGƯỜI NHẬN', async () => {
    const { id } = await deNghi();
    const { rows } = await pool.query(
      'SELECT status, accepted_at, declined_at FROM delegations WHERE id = $1',
      [id]
    );
    expect(rows[0]).toMatchObject({ status: 'pending', accepted_at: null, declined_at: null });

    const cuaNguoiNhan = await thongBaoCua(nhanVien.id);
    expect(cuaNguoiNhan.length).toBe(1);
    expect(cuaNguoiNhan[0].content).toContain(phoGiamDoc.full_name);
    expect(cuaNguoiNhan[0].ref_type).toBe('delegation');
    expect(Number(cuaNguoiNhan[0].ref_id)).toBe(Number(id));
    // Người ủy quyền chưa có gì để đọc: họ vừa gửi đề nghị, chưa ai trả lời.
    expect(await thongBaoCua(phoGiamDoc.id)).toEqual([]);
  });

  it('TC-UQ-16b: chỉ NGƯỜI NHẬN trả lời được — người ủy quyền và cả admin đều không', async () => {
    const { id } = await deNghi();
    // Người ủy quyền tự đồng ý hộ thì luật vừa chốt thành hình thức.
    const apiPgd = await nhuLa(phoGiamDoc);
    expect((await apiPgd.post(`${URL_UQ}/${id}/accept`)).status).toBe(403);
    // Admin cũng không: đây không phải việc quản trị, đây là sự đồng ý của một người.
    const apiAdmin = await nhuLa(quanTri);
    expect((await apiAdmin.post(`${URL_UQ}/${id}/accept`)).status).toBe(403);
    expect((await apiAdmin.post(`${URL_UQ}/${id}/decline`)).status).toBe(403);
    // Người ngoài cuộc.
    const apiKhac = await nhuLa(truongPhongB);
    expect((await apiKhac.post(`${URL_UQ}/${id}/accept`)).status).toBe(403);

    const { rows } = await pool.query('SELECT status FROM delegations WHERE id = $1', [id]);
    expect(rows[0].status).toBe('pending');
  });

  it('TC-UQ-16c: đồng ý ⇒ active + accepted_at, báo lại cho người ủy quyền, nhật ký ghi lại', async () => {
    const { id } = await deNghi();
    const res = await pheDuyet(nhanVien, id);
    expect(res.body.data.changed).toBe(true);

    const { rows } = await pool.query(
      'SELECT status, accepted_at IS NOT NULL AS co_moc, declined_at FROM delegations WHERE id = $1',
      [id]
    );
    expect(rows[0]).toMatchObject({ status: 'active', co_moc: true, declined_at: null });

    const cuaNguoiUyQuyen = await thongBaoCua(phoGiamDoc.id);
    expect(cuaNguoiUyQuyen.length).toBe(1);
    expect(cuaNguoiUyQuyen[0].content).toContain('ĐỒNG Ý');
    expect(cuaNguoiUyQuyen[0].content).toContain(nhanVien.full_name);

    const logs = await dongNhatKy('delegations.accept');
    expect(logs.length).toBe(1);
    expect(Number(logs[0].entity_id)).toBe(Number(id));
    expect(logs[0].details.changed).toBe(true);
    expect(logs[0].details.status).toBe('active');
  });

  it('TC-UQ-16d: bấm đồng ý lần hai ⇒ changed=false, không sinh thông báo thứ hai', async () => {
    const { id } = await deNghi();
    const api = await nhuLa(nhanVien);
    expect((await api.post(`${URL_UQ}/${id}/accept`)).status).toBe(200);
    const lai = await api.post(`${URL_UQ}/${id}/accept`);
    expect(lai.status).toBe(200);
    expect(lai.body.data.changed).toBe(false);
    expect(lai.body.data.delegation.status).toBe('active');
    expect((await thongBaoCua(phoGiamDoc.id)).length).toBe(1);
  });

  it('TC-UQ-16e: từ chối ⇒ declined + declined_at, không mượn được quyền, đồng ý sau đó vô hiệu', async () => {
    const congViec = await makeWork({
      code: 'DA003',
      name: 'Công việc phòng A',
      department_id: phongA.id,
    });
    const { id } = await deNghi();
    const api = await nhuLa(nhanVien);
    const res = await api.post(`${URL_UQ}/${id}/decline`);
    expect(res.status).toBe(200);
    expect(res.body.data.delegation.status).toBe('declined');

    const { rows } = await pool.query(
      'SELECT status, declined_at IS NOT NULL AS co_moc, accepted_at FROM delegations WHERE id = $1',
      [id]
    );
    expect(rows[0]).toMatchObject({ status: 'declined', co_moc: true, accepted_at: null });
    expect((await thongBaoCua(phoGiamDoc.id))[0].content).toContain('TỪ CHỐI');

    // Đã từ chối thì không có quyền nào chạy sang, và bấm «Đồng ý» sau đó cũng không hồi sinh được.
    const apiMoi = await nhuLa(nhanVien);
    expect((await apiMoi.patch(`/api/v1/works/${congViec.code}`, { name: 'Đổi' })).status).toBe(
      403
    );
    const doiY = await apiMoi.post(`${URL_UQ}/${id}/accept`);
    expect(doiY.status).toBe(200);
    expect(doiY.body.data.changed).toBe(false);
    expect(doiY.body.data.delegation.status).toBe('declined');
  });

  it('TC-UQ-16f: bản đã HUỶ thì người nhận không trả lời được nữa', async () => {
    const { api, id } = await deNghi();
    expect((await api.del(`${URL_UQ}/${id}`)).status).toBe(200);
    const apiNhan = await nhuLa(nhanVien);
    const res = await apiNhan.post(`${URL_UQ}/${id}/accept`);
    expect(res.status).toBe(200);
    expect(res.body.data.changed).toBe(false);
    expect(res.body.data.delegation.status).toBe('cancelled');
  });

  it('TC-UQ-16g: trả lời bản không tồn tại ⇒ 404; chưa đăng nhập ⇒ 401', async () => {
    const api = await nhuLa(nhanVien);
    expect((await api.post(`${URL_UQ}/999999/accept`)).status).toBe(404);
    const khachLa = client(app);
    expect((await khachLa.post(`${URL_UQ}/1/accept`)).status).toBe(401);
  });
});

describe('TC-UQ-17: ủy quyền từ Giám đốc được đọc như Phó Giám đốc trong ĐÚNG phòng đã ghi (L2)', () => {
  it('TC-UQ-17: người nhận làm được việc của Phó Giám đốc ở phòng B, không lan sang phòng A', async () => {
    const cvB = await makeWork({
      code: 'DB001',
      name: 'Công việc phòng B',
      department_id: phongB.id,
    });
    const cvA = await makeWork({
      code: 'DB002',
      name: 'Công việc phòng A',
      department_id: phongA.id,
    });

    // `phoGiamDocB` không thuộc phòng nào và không phụ trách phòng nào ⇒ tự mình không sửa được gì.
    const truoc = await nhuLa(phoGiamDocB);
    expect((await truoc.patch(`/api/v1/works/${cvB.code}`, { name: 'Đổi' })).status).toBe(403);

    const apiAdmin = await nhuLa(quanTri);
    const tao = await apiAdmin.post(URL_UQ, {
      toUserId: phoGiamDocB.id,
      departmentIds: [phongB.id],
      fromDate: await ngayLech(0),
      toDate: await ngayLech(3),
    });
    expect(tao.status).toBe(201);
    const uyQuyenId = Number(tao.body.data.delegation.id);
    await pheDuyet(phoGiamDocB, uyQuyenId);

    const api = await nhuLa(phoGiamDocB);
    const sua = await api.patch(`/api/v1/works/${cvB.code}`, { name: 'Sửa nhờ ủy quyền' });
    expect(sua.status).toBe(200);
    const logs = await dongNhatKy('works.update');
    expect(logs.length).toBe(1);
    expect(Number(logs[0].details.viaDelegationId)).toBe(uyQuyenId);

    // Phòng A không nằm trong bản ghi ⇒ vẫn chặn. Nếu bước hạ vai admin bị bỏ, người mượn sẽ có
    // quyền toàn hệ thống và dòng này là chỗ phát hiện ra.
    expect((await api.patch(`/api/v1/works/${cvA.code}`, { name: 'Đổi' })).status).toBe(403);
    // Và quyền quản trị người dùng thì không bao giờ mượn được — L4 chỉ cho work/subwork/task.
    const themNguoi = await api.post('/api/v1/users', {
      code: 'NV099',
      full_name: 'Người Mới',
      email: 'moi@congty.vn',
      role: 'Nhân viên',
    });
    expect(themNguoi.status).toBe(403);
  });
});

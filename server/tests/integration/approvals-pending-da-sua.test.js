// MỚI-3 (2026-09-12) — cột «đây là duyệt MỚI TẠO hay bản SỬA» của bảng Chờ duyệt, và cái mốc
// `moc_xu_ly` đi kèm để nút «Xem các thay đổi» lọc đúng tập lượt sửa.
//
// Người dùng: «thêm cột thông tin về đây là duyệt công việc mới tạo, hay sửa chữa/xóa … Đối với sửa
// thông tin công việc/nhiệm vụ, thêm nút xem các thay đổi, hiển thị popup các thay đổi».
//
// Không cột nào sẵn có trả lời được câu đó — `approver_id`/`approved_at` bị xoá trắng khi hạ về
// «Chờ duyệt», `submitted_by` ghi ở mọi lần gửi — nên `da_sua` suy ra từ `activity_logs` (docblock
// của `repo.listPending` ghi đầy đủ luật). Mà suy từ nhật ký thì PHẢI GHIM THỜI GIAN: cả một ca test
// chạy trong vài chục mili giây, còn luật là so sánh NGHIÊM `s.created_at > moc.moc_xu_ly` — hai dòng
// nhật ký cùng dấu thời gian thì ca test đỏ xanh theo may rủi chứ không theo luật. Đó là lý do file
// này đụng thẳng `created_at` trong CSDL thay vì chỉ gọi API.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { DA_XU_LY, SUA_NOI_DUNG, listPending } from '../../src/modules/approvals/repo.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

/** `all: true` để khỏi phải dựng `department_managers` cho từng ca — luật phạm vi có test riêng. */
const PHAM_VI = Object.freeze({ all: true });

let phongA;
let tp;
let pgdA;
let nvA;
let apiTp;
let apiPgdA;

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

/**
 * Công việc cấp 1 do Trưởng phòng lập ⇒ tự sang 'Chờ duyệt' (việc 5.1). `them` để nhét ngày tháng cho
 * riêng ca cần việc dài hơn một tháng — đặt tên riêng theo tháng mà việc gói trong một tháng thì máy
 * chủ trả MONTH_OUT_OF_RANGE (`workMonthNames/service.js`).
 */
async function taoViec(name = 'Việc phòng A', them = {}) {
  const res = await apiTp.post('/api/v1/works', {
    name,
    departmentId: phongA.id,
    supervisorIds: [pgdA.id],
    ...them,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data.work;
}

/**
 * Nhiệm vụ cấp 3. ĐỢT A: phải có Ban lãnh đạo kiểm soát, không thì `submit` từ chối 409; và phải có
 * Người thực hiện trực tiếp, không thì `createSchema` chặn 400 ngay từ cửa zod.
 */
async function taoNhiemVu(workRef, name, parentRef = null) {
  const res = await apiTp.post('/api/v1/work-items', {
    workRef,
    level: 3,
    name,
    parentRef,
    assigneeId: nvA.id,
    supervisorIds: [pgdA.id],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data.item;
}

/**
 * Mở ghi đè «Sửa ⇒ Chờ duyệt» cho một vai. `phaiChoDuyetKhiSua` (approvals/rules.js) CHỈ hạ
 * `Đã duyệt` về `Chờ duyệt` khi vai đó có ghi đè update = 'cho-duyet'; ma trận gốc không vai nào có
 * sẵn (011 chỉ MỞ LỰA CHỌN cho Giám đốc đặt), nên ca test muốn đi đúng con đường «đã duyệt rồi sửa»
 * thì phải tự đặt ô đó. `ghiDe` được nạp lại ở MỖI request (session.js) nên không phải đăng nhập lại.
 */
async function moGhiDeSuaPhaiDuyetLai(vai, entityType) {
  const res = await pool.query(
    `INSERT INTO permission_overrides (vai, entity_type, action, gia_tri, pham_vi)
     VALUES ($1, $2, 'update', 'cho-duyet', 'tat-ca')
     ON CONFLICT (vai, entity_type, action) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`,
    [vai, entityType]
  );
  expect(res.rowCount, `không đặt được ghi đè ${vai}/${entityType}:update`).toBe(1);
}

/** Ghim `created_at` của một dòng `works` / `work_items` lùi `gio` giờ. */
async function ghimDong(bang, id, gio) {
  const res = await pool.query(
    `UPDATE ${bang} SET created_at = now() - (($2 || ' hour')::interval) WHERE id = $1`,
    [id, String(gio)]
  );
  expect(res.rowCount, `không ghim được ${bang}#${id}`).toBe(1);
}

/**
 * Ghim mọi dòng nhật ký khớp bộ lọc lùi `gio` giờ. `expect(rowCount > 0)` là cố ý: ghim hụt (sai tên
 * action, sai `entity_type`) thì ca test sẽ XANH OAN vì dòng thật vẫn nằm ở `now()`, còn luật thì đọc
 * dòng đã ghim — sai lệch kiểu đó phải nổ ngay tại chỗ.
 */
async function ghimNhatKy(action, gio, { entityType, entityId, workId } = {}) {
  const dieuKien = ['action = $1'];
  const giaTri = [action];
  for (const [cot, val] of [
    ['work_id', workId],
    ['entity_type', entityType],
    ['entity_id', entityId],
  ]) {
    if (val == null) continue;
    giaTri.push(val);
    dieuKien.push(`${cot} = $${giaTri.length}`);
  }
  giaTri.push(String(gio));
  const res = await pool.query(
    `UPDATE activity_logs SET created_at = now() - (($${giaTri.length} || ' hour')::interval)
      WHERE ${dieuKien.join(' AND ')}`,
    giaTri
  );
  expect(res.rowCount, `không có nhật ký ${action} để ghim`).toBeGreaterThan(0);
}

/** Đọc một dòng chờ duyệt theo mã; `null` khi không có (mã sai thì ca test nổ ở `expect`). */
async function dongChoDuyet(code) {
  const rows = await listPending(PHAM_VI, { limit: 100 });
  return rows.find((r) => r.code === code) ?? null;
}

async function trangThai(bang, code) {
  const { rows } = await pool.query(`SELECT approval_status FROM ${bang} WHERE code = $1`, [code]);
  return rows[0]?.approval_status ?? null;
}

/** `moc_xu_ly` phải là một dấu thời gian đọc được và nằm trong khoảng `gio` giờ ±1 giờ. */
function mongMocCachDay(moc, gio) {
  expect(moc, 'moc_xu_ly phải khác null').not.toBeNull();
  const lechGio = (Date.now() - Date.parse(moc)) / 3_600_000;
  expect(lechGio, `moc_xu_ly=${moc}`).toBeGreaterThan(gio - 1);
  expect(lechGio).toBeLessThan(gio + 1);
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  tp = await makeLoginUser({
    code: 'NV010',
    full_name: 'Trần Thị Trưởng',
    email: 'tp-da-sua@test.local',
    role: 'Trưởng phòng',
    department_id: phongA.id,
  });
  pgdA = await makeLoginUser({
    code: 'NV002',
    full_name: 'Lê Văn Phó',
    email: 'pgd-da-sua@test.local',
    role: 'Phó Giám đốc',
    department_id: phongA.id,
  });
  nvA = await makeLoginUser({
    code: 'NV011',
    full_name: 'Đỗ Văn Viên',
    email: 'nv-da-sua@test.local',
    role: 'Nhân viên',
    department_id: phongA.id,
  });
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, 'deputy_director')`,
    [phongA.id, pgdA.id]
  );
  apiTp = await dangNhap(tp);
  apiPgdA = await dangNhap(pgdA);
});

afterAll(async () => {
  await closePool();
});

describe('MỚI-3 — định nghĩa hai bộ action', () => {
  it('Mốc «đã ra người duyệt» chỉ có approve và return', () => {
    // `submit` là lần GỬI chứ không phải lần xem; `reject` thì từ 012 xoá hẳn dòng nên dòng đó
    // không bao giờ còn nằm trong bảng chờ duyệt để mà gắn nhãn.
    expect([...DA_XU_LY]).toEqual(['approvals.approve', 'approvals.return']);
  });

  it('«Sửa nội dung» là update và đổi tên theo tháng, KHÔNG kể create/copy/reorder', () => {
    expect([...SUA_NOI_DUNG].sort()).toEqual(
      [
        'works.update',
        'works.setMonthName',
        'works.clearMonthName',
        'subworks.update',
        'tasks.update',
        'workItems.setMonthName',
        'workItems.clearMonthName',
      ].sort()
    );
    // Ba cái này mà lọt vào thì dòng nào cũng hoá ra «Sửa»: nhiệm vụ thêm SAU vào cây đã duyệt là
    // «mới tạo» một mình nó (R5), bản sao là một đầu việc mới có mã mới, còn reorder chỉ đánh lại
    // `sort_order` chứ không hạ `approval_status`.
    for (const khongPhaiSua of [
      'works.create',
      'tasks.create',
      'subworks.create',
      'tasks.copy',
      'workItems.reorder',
    ]) {
      expect(SUA_NOI_DUNG, khongPhaiSua).not.toContain(khongPhaiSua);
    }
  });

  it('Mọi action trong hai bộ đều thật sự được ghi — chống lệch tên khi sửa routes', async () => {
    // `activity_logs.action` là chuỗi tự do, đổi tên action bên routes.js không làm hỏng build; cờ
    // `da_sua` thì hỏng thầm. Ca này đi hết một lượt đường thật cho từng action rồi đối chiếu tên.
    const work = await taoViec('Việc dài ba tháng', {
      startDate: '2026-09-01',
      endDate: '2026-11-30',
    });
    await taoNhiemVu(work.code, 'Nhiệm vụ để đổi tên tháng');
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);

    // KHÔNG phải tháng đầu: tên tháng đầu chính là tên gốc nên `assertThangDatDuoc` chặn
    // MONTH_IS_FIRST, và việc phải dài hơn một tháng (không thì MONTH_OUT_OF_RANGE).
    const nhap = [
      await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Đổi tên công việc' }),
      await apiTp.put(`/api/v1/works/${work.code}/month-names/2026-10`, { name: 'Tên tháng 10' }),
      await apiTp.del(`/api/v1/works/${work.code}/month-names/2026-10`),
    ];
    // Ba call này mà trượt (403/409) thì ca test vẫn XANH OAN cho hai action kia và chỉ đỏ ở
    // `setMonthName` — một câu nói không rõ nguyên nhân. In cả ba thân phản hồi ra ngay tại chỗ.
    for (const res of nhap) expect(res.status, JSON.stringify(res.body)).toBe(200);

    const { rows } = await pool.query('SELECT DISTINCT action FROM activity_logs ORDER BY action');
    const daGhi = rows.map((r) => r.action);
    for (const action of ['works.update', 'works.setMonthName', 'works.clearMonthName']) {
      expect(daGhi, `${action} không còn được ghi — SUA_NOI_DUNG đã lệch tên`).toContain(action);
    }
    expect(daGhi).toContain('approvals.approve');
  });
});

describe('MỚI-3 — cờ da_sua qua API `GET /approvals/pending`', () => {
  it('Gửi lần đầu ⇒ «Mới tạo»: da_sua false, moc_xu_ly null', async () => {
    const work = await taoViec();

    const res = await apiPgdA.get('/api/v1/approvals/pending');
    expect(res.status).toBe(200);
    const dong = res.body.data.items.find((r) => r.code === work.code);
    expect(dong, JSON.stringify(res.body.data.items.map((r) => r.code))).toBeTruthy();
    // Hai trường mới phải có MẶT (dù giá trị falsy) — thiếu hẳn thì giao diện không phân biệt được
    // «máy chủ cũ chưa có cột này» với «đúng là mới tạo».
    expect(Object.hasOwn(dong, 'da_sua')).toBe(true);
    expect(Object.hasOwn(dong, 'moc_xu_ly')).toBe(true);
    expect(dong.da_sua).toBe(false);
    expect(dong.moc_xu_ly).toBeNull();
  });

  it('Đã duyệt rồi sửa ⇒ «Sửa»: da_sua true, moc_xu_ly là lần duyệt', async () => {
    const work = await taoViec();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(await trangThai('works', work.code)).toBe('Đã duyệt');

    await moGhiDeSuaPhaiDuyetLai('Trưởng phòng', 'work');
    const sua = await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Sửa sau khi duyệt' });
    expect(sua.status, JSON.stringify(sua.body)).toBe(200);
    expect(await trangThai('works', work.code)).toBe('Chờ duyệt');

    // Gốc -10h → lần duyệt -6h → lượt sửa -3h. Không ghim thì ba dấu thời gian cách nhau vài mili
    // giây và `s.created_at > moc.moc_xu_ly` có thể trật.
    await ghimDong('works', work.id, 10);
    await ghimNhatKy('approvals.approve', 6, { workId: work.id });
    await ghimNhatKy('works.update', 3, { workId: work.id });

    const res = await apiPgdA.get('/api/v1/approvals/pending');
    const dong = res.body.data.items.find((r) => r.code === work.code);
    expect(dong).toBeTruthy();
    expect(dong.da_sua).toBe(true);
    mongMocCachDay(dong.moc_xu_ly, 6);
  });

  it('Bị trả lại rồi sửa rồi gửi lại ⇒ «Sửa», và mốc là approvals.return chứ không phải submit', async () => {
    const work = await taoViec();
    const tra = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/return`, {
      reason: 'Chưa nêu rõ sản phẩm đầu ra',
    });
    expect(tra.status, JSON.stringify(tra.body)).toBe(200);
    expect(await trangThai('works', work.code)).toBe('Nháp');

    await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Sửa theo góp ý' });
    const gui = await apiTp.post(`/api/v1/approvals/work/${work.code}/submit`);
    expect(gui.status, JSON.stringify(gui.body)).toBe(200);

    // Submit ở -1h, SAU lượt sửa -3h: nếu `approvals.submit` bị tính là mốc thì `da_sua` sẽ false
    // (không có lượt sửa nào sau mốc) — ca này đỏ ngay.
    await ghimDong('works', work.id, 10);
    await ghimNhatKy('approvals.return', 6, { workId: work.id });
    await ghimNhatKy('works.update', 3, { workId: work.id });
    await ghimNhatKy('approvals.submit', 1, { workId: work.id });

    const dong = await dongChoDuyet(work.code);
    expect(dong, 'công việc đã gửi lại phải nằm trong bảng chờ duyệt').toBeTruthy();
    expect(dong.da_sua).toBe(true);
    mongMocCachDay(dong.moc_xu_ly, 6);
  });

  it('Sửa đi sửa lại bản nháp TRƯỚC lần gửi đầu ⇒ vẫn «Mới tạo»', async () => {
    const work = await taoViec();
    await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Nháp lần một' });
    await apiTp.patch(`/api/v1/works/${work.code}`, { name: 'Nháp lần hai' });

    await ghimDong('works', work.id, 5);
    await ghimNhatKy('works.update', 3, { workId: work.id });

    const dong = await dongChoDuyet(work.code);
    expect(dong).toBeTruthy();
    expect(dong.da_sua).toBe(false);
    expect(dong.moc_xu_ly).toBeNull();
  });
});

describe('MỚI-3 — các ca biên ở mức repo', () => {
  it('R5: nhiệm vụ thêm SAU vào cây đã duyệt là «Mới tạo», không dính mốc duyệt của cây', async () => {
    const work = await taoViec();
    const t1 = await taoNhiemVu(work.code, 'Nhiệm vụ gốc');
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');

    // Nhiệm vụ thêm SAU ⇒ 'Chờ duyệt' một mình nó (R5), còn T1 vẫn 'Đã duyệt'.
    const t2 = await taoNhiemVu(work.code, 'Nhiệm vụ thêm sau');
    expect(await trangThai('work_items', t2.code)).toBe('Chờ duyệt');

    // Sửa T1 ⇒ T1 hạ về 'Chờ duyệt'. Nay trong bảng có HAI dòng gốc cùng một công việc.
    await moGhiDeSuaPhaiDuyetLai('Trưởng phòng', 'task');
    await apiTp.patch(`/api/v1/work-items/${t1.code}`, { name: 'Sửa nhiệm vụ gốc' });
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');

    await ghimDong('works', work.id, 12);
    await ghimDong('work_items', t1.id, 12);
    await ghimNhatKy('approvals.approve', 10, { workId: work.id });
    await ghimDong('work_items', t2.id, 2);
    await ghimNhatKy('tasks.update', 1, { workId: work.id, entityType: 'task', entityId: t1.id });

    const dongT1 = await dongChoDuyet(t1.code);
    const dongT2 = await dongChoDuyet(t2.code);
    expect(dongT1, 'T1 phải là dòng gốc vì công việc cha đã duyệt').toBeTruthy();
    expect(dongT2).toBeTruthy();
    expect(dongT1.da_sua).toBe(true);
    mongMocCachDay(dongT1.moc_xu_ly, 10);
    // Không có ràng buộc `m.created_at >= g.created_at` thì T2 sẽ lấy lần duyệt cây (xảy ra TRƯỚC
    // cả khi T2 tồn tại) làm mốc của chính nó, rồi lượt sửa T1 ở sau mốc gắn oan nhãn «Sửa».
    expect(dongT2.da_sua).toBe(false);
    expect(dongT2.moc_xu_ly).toBeNull();
  });

  it('Lượt sửa của nhiệm vụ ANH EM không gắn oan nhãn «Sửa» cho dòng cấp 3 gửi lẻ', async () => {
    const work = await taoViec();
    const t1 = await taoNhiemVu(work.code, 'Nhiệm vụ gốc');
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);

    const t2 = await taoNhiemVu(work.code, 'Nhiệm vụ thêm sau');
    // Trả lại T2 rồi gửi lại NGUYÊN TRẠNG: T2 đã ra người duyệt một lần (nên `moc_xu_ly` khác null)
    // nhưng nội dung của chính nó không đổi ⇒ không phải bản sửa. Đây cũng là chỗ luật «lượt sửa
    // phải thuộc ĐÚNG dòng này» có tác dụng: nếu chỉ neo theo `work_id` thì lượt sửa T1 bên dưới sẽ
    // gắn nhãn «Sửa» cho T2, và nút «Xem các thay đổi» của T2 mở ra một popup RỖNG.
    await apiPgdA.post(`/api/v1/approvals/work-item/${t2.code}/return`, {
      reason: 'Thiếu định dạng file kết quả',
    });
    await apiTp.post(`/api/v1/approvals/work-item/${t2.code}/submit`);

    await moGhiDeSuaPhaiDuyetLai('Trưởng phòng', 'task');
    await apiTp.patch(`/api/v1/work-items/${t1.code}`, { name: 'Sửa nhiệm vụ gốc' });
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');

    await ghimDong('works', work.id, 14);
    await ghimDong('work_items', t1.id, 14);
    await ghimNhatKy('approvals.approve', 12, { workId: work.id });
    await ghimDong('work_items', t2.id, 10);
    await ghimNhatKy('approvals.return', 9, {
      workId: work.id,
      entityType: 'task',
      entityId: t2.id,
    });
    await ghimNhatKy('approvals.submit', 8, {
      workId: work.id,
      entityType: 'task',
      entityId: t2.id,
    });
    await ghimNhatKy('tasks.update', 7, { workId: work.id, entityType: 'task', entityId: t1.id });

    const dongT1 = await dongChoDuyet(t1.code);
    const dongT2 = await dongChoDuyet(t2.code);
    expect(dongT1.da_sua).toBe(true);
    expect(dongT2.da_sua).toBe(false);
    // Mốc của T2 là lần nó bị TRẢ LẠI, không phải lần duyệt cây (đã bị loại bởi `>= created_at`).
    mongMocCachDay(dongT2.moc_xu_ly, 9);
  });

  it('Tạo mới và sao chép trong cây đã duyệt ⇒ không dòng nào bị gọi là «Sửa»', async () => {
    const work = await taoViec();
    const t1 = await taoNhiemVu(work.code, 'Nhiệm vụ gốc');
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);

    const t2 = await taoNhiemVu(work.code, 'Nhiệm vụ thêm sau');
    const sao = await apiTp.post(`/api/v1/work-items/${t1.code}/copy`, { name: 'Bản sao T1' });
    expect(sao.status, JSON.stringify(sao.body)).toBe(200);

    await ghimDong('works', work.id, 12);
    await ghimDong('work_items', t1.id, 12);
    await ghimNhatKy('approvals.approve', 10, { workId: work.id });
    await ghimDong('work_items', t2.id, 2);
    await ghimDong('work_items', sao.body.data.item.id, 2);

    const rows = await listPending(PHAM_VI, { limit: 100 });
    const trongCay = rows.filter((r) => [t2.code, sao.body.data.item.code].includes(r.code));
    expect(trongCay.map((r) => r.code).sort()).toEqual([t2.code, sao.body.data.item.code].sort());
    for (const dong of trongCay) {
      expect(dong.da_sua, `${dong.code} vừa được tạo/sao, không phải bản sửa`).toBe(false);
      expect(dong.moc_xu_ly, dong.code).toBeNull();
    }
  });

  it('Dòng cấp 1 đang chờ thì con bên trong KHÔNG hiện thành dòng riêng (chỉ gốc cây)', async () => {
    // Chốt lại luật cũ của 012 để hai trường mới không vô tình làm lộ dòng con: `da_sua` đọc theo
    // `work_id` nên rất dễ tưởng nó kéo cả con vào danh sách.
    const work = await taoViec();
    const t1 = await taoNhiemVu(work.code, 'Nhiệm vụ trong cây chờ duyệt');
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');

    await ghimDong('works', work.id, 5);
    await ghimDong('work_items', t1.id, 5);

    const rows = await listPending(PHAM_VI, { limit: 100 });
    expect(rows.some((r) => r.code === work.code)).toBe(true);
    expect(rows.some((r) => r.code === t1.code)).toBe(false);
  });
});

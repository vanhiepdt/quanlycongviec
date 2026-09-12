// ĐỢT B (11/09/2026) — «GỘP HAI TRỤC DUYỆT». Mỗi `it` dưới đây khoá MỘT quyết định trong bảng
// Q1–Q13 / R1–R7 (docs/BAT-DAU-SESSION.md), kèm số của quyết định đó trong tên để tra ngược được.
//
//   Q1  khai báo (tên · định dạng · tỷ lệ) đi theo cây; file thật đi chuỗi riêng SAU khi cây Đã duyệt
//   Q2  CẤM HẲN nút tải file khi cây chưa duyệt
//   Q3  cấp 3 không còn sinh ra «Đã duyệt» riêng lẻ
//   Q7  MỘT người duyệt là đủ ở mọi cấp
//   Q10 sửa tỷ lệ CÓ phải gửi duyệt
//   R4' tỷ lệ của FILE gửi đúng 1 Ban lãnh đạo kiểm soát của nhiệm vụ (cấp 3)
//   R4'' cơ chế `approval_changes`: giá trị CŨ giữ nguyên tới khi duyệt, KHÔNG hạ cây về «Chờ duyệt»
//   R5  nhiệm vụ thêm SAU vào cây đã duyệt ⇒ «Chờ duyệt» MỘT MÌNH NÓ
//   R6  BỎ tự duyệt — `apTuDong` không bao giờ trả `da-duyet`
//   điểm 7  `trinh-lanh-dao` → «TP/PP phê duyệt», có lưu mốc người duyệt và lúc duyệt
//   điểm 9  gộp `yeu-cau-sua` vào `tra-ve-cbo`
//   điểm 12 `dungNguoiDuyetFile` siết theo BLĐKS cấp 3 KỂ CẢ khi tích Gửi BLĐ TẮT
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp().listen(0, '127.0.0.1');

let dept, admin, pgd, pgd2, tp, nv;
let adminApi, pgdApi, pgd2Api, tpApi, nvApi;
// `sub`/`sub2` là HAI việc con cùng một công việc, `task`/`task2` là HAI nhiệm vụ cùng một việc con.
// Phải có cặp thì tỷ lệ mới đổi được: `chiaKhiSua` khoá cứng [100] khi chỉ có một đầu mục
// (`workItems/tyLe.js:91`), và `updateChildWeights` cũng vậy — một mình nó thì sửa bằng không.
let work, sub, sub2, task, task2;

const PDF = { ten: 'ket-qua.pdf', mime: 'application/pdf', noiDung: '%PDF-1.4 dot b' };

async function login(u) {
  const api = client(app);
  await api.login(u.email);
  return api;
}

/** Đọc thẳng `approval_status` — không qua REST để test không phụ thuộc hình dạng phản hồi. */
async function trangThaiDuyet(bang, id) {
  const { rows } = await pool.query(`SELECT approval_status FROM ${bang} WHERE id = $1`, [id]);
  return rows[0]?.approval_status ?? null;
}

async function soMucDemDuoc() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM v_countable_items');
  return rows[0].n;
}

/** Ký một mục — `entity` là 'work' hay 'work-item', `code` là mã dòng. */
async function duyet(api, entity, code) {
  const r = await api.post(`/api/v1/approvals/${entity}/${code}/approve`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r;
}

/**
 * Ký TRỌN CÂY bằng đúng Phó GĐ có tên ở ô «Ban lãnh đạo kiểm soát».
 *
 * MỘT lời gọi là đủ: `duyetCaCay` của `approvals/service.js` kéo theo mọi dòng con đang «Chờ duyệt»
 * (chốt ngày 2026-08-31 — một quyết định cho cả cây, không bắt ký 1+N+M lần). Ký lại lần hai là 409.
 */
async function duyetCaCay() {
  await duyet(pgdApi, 'work', work.code);
}

async function taoViecCon(name) {
  const r = await tpApi.post('/api/v1/work-items', {
    workRef: work.code,
    level: 2,
    name,
    leaderIds: [tp.id],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data.item;
}

async function taoNhiemVu(over = {}) {
  const r = await tpApi.post('/api/v1/work-items', {
    workRef: work.code,
    level: 3,
    parentRef: sub.code,
    name: 'Nhiệm vụ thêm sau',
    assigneeId: nv.id,
    leaderIds: [tp.id],
    ...over,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data.item;
}

async function upload(api, maNhiemVu, { fileId = null } = {}) {
  let req = api.agent
    .post('/api/v1/work-items/' + encodeURIComponent(maNhiemVu) + '/files')
    .set('x-csrf-token', await api.csrfToken());
  if (fileId != null) req = req.field('fileId', String(fileId));
  return req.attach('file', Buffer.from(PDF.noiDung, 'binary'), {
    filename: PDF.ten,
    contentType: PDF.mime,
  });
}

/** Nộp rồi gửi đi duyệt — hai request thật, đúng đường trình duyệt đi (V4). */
async function nopVaGui(api, maNhiemVu, { fileId = null } = {}) {
  const luu = await upload(api, maNhiemVu, { fileId });
  expect(luu.status, JSON.stringify(luu.body)).toBe(200);
  const { nhom, ban } = luu.body.data;
  const gui = await api.post(`/api/v1/task-files/${nhom.id}/gui-di-duyet`, { versionId: ban.id });
  expect(gui.status, JSON.stringify(gui.body)).toBe(200);
  return gui.body.data;
}

function verdict(api, fileId, hanhDong, noiDung = '') {
  return api.post(`/api/v1/task-files/${fileId}/verdict`, { hanhDong, noiDung });
}

/**
 * Bật tích «Gửi BLĐ phê duyệt» của một nhiệm vụ. Q6 (chốt 11/09/2026): tích BẬT thì TP/PP chỉ còn
 * «TP/PP phê duyệt» để trình Ban lãnh đạo kiểm soát — nút «Hoàn thành / Duyệt» bị ẩn và máy chủ 409
 * nếu gọi thẳng. Ghi THẲNG CSDL chứ không đi `PATCH /work-items/:id`, vì đường API kéo theo
 * `phaiChoDuyetKhiSua` (Q9) làm cây bị hạ về «Chờ duyệt» và hỏng tiền đề «cây đã duyệt» ở dưới.
 */
async function batGuiBld(itemId) {
  const r = await pool.query('UPDATE work_items SET gui_bld_phe_duyet = true WHERE id = $1', [
    itemId,
  ]);
  expect(r.rowCount).toBe(1);
}

/** Nhiệm vụ do CHÍNH Trưởng phòng thực hiện — đường Q5: nộp lên là «cho-lanh-dao» thẳng. */
async function taoNhiemVuCuaTp(name) {
  const item = await taoNhiemVu({ name, assigneeId: tp.id });
  await duyet(pgdApi, 'work-item', item.code);
  return item;
}

async function mocTpPheDuyet(fileId) {
  const { rows } = await pool.query(
    `SELECT f.tp_duyet_boi, f.tp_duyet_luc, u.full_name AS ten
       FROM task_files f LEFT JOIN users u ON u.id = f.tp_duyet_boi WHERE f.id = $1`,
    [fileId]
  );
  return rows[0] ?? null;
}

async function tyLeFile(fileId) {
  const { rows } = await pool.query('SELECT ty_le FROM task_files WHERE id = $1', [fileId]);
  return rows[0]?.ty_le ?? null;
}

/** Trạng thái THẬT trong CSDL — để khẳng định một lần bấm bị từ chối thì không để lại vết. */
async function trangThaiFile(fileId) {
  const { rows } = await pool.query('SELECT trang_thai FROM task_files WHERE id = $1', [fileId]);
  return rows[0]?.trang_thai ?? null;
}

async function tyLeMuc(itemId) {
  const { rows } = await pool.query('SELECT ty_le FROM work_items WHERE id = $1', [itemId]);
  return rows[0]?.ty_le == null ? null : Number(rows[0].ty_le);
}

async function deNghiTyLeCua(api) {
  const r = await api.get('/api/v1/approvals/pending');
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data.items.filter((d) => d.kind === 'ty-le');
}

async function override(vai, entityType, action, giaTri) {
  const r = await adminApi.put('/api/v1/permissions', {
    thayDoi: [{ vai, entityType, action, giaTri }],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTables();
  dept = await makeDepartment();
  const users = [];
  for (const [index, role] of [
    'admin',
    'Phó Giám đốc',
    'Phó Giám đốc',
    'Trưởng phòng',
    'Nhân viên',
  ].entries()) {
    users.push(
      await makeLoginUser({
        code: 'NV00' + index,
        email: 'b' + index + '@test.local',
        full_name: role + ' đợt B ' + index,
        role,
        department_id: index >= 3 ? dept.id : null,
      })
    );
  }
  [admin, pgd, pgd2, tp, nv] = users;
  // HAI Phó GĐ cùng phụ trách phòng: `pgd` là người được CHỌN ở ô «Ban lãnh đạo kiểm soát», `pgd2`
  // là người KHÔNG được chọn — cặp này là toàn bộ nội dung của điểm 12.
  for (const [u, role] of [
    [pgd, 'deputy_director'],
    [pgd2, 'deputy_director'],
    [tp, 'head'],
  ]) {
    await pool.query(
      'INSERT INTO department_managers(department_id,user_id,role) VALUES($1,$2,$3)',
      [dept.id, u.id, role]
    );
  }
  adminApi = await login(admin);
  pgdApi = await login(pgd);
  pgd2Api = await login(pgd2);
  tpApi = await login(tp);
  nvApi = await login(nv);

  const r = await tpApi.post('/api/v1/works', {
    name: 'Công việc đợt B',
    departmentId: dept.id,
    supervisorIds: [pgd.id],
    leaderIds: [tp.id],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  work = r.body.data.work;
  sub = await taoViecCon('Công việc con đợt B');
  sub2 = await taoViecCon('Công việc con thứ hai đợt B');
  task = await taoNhiemVu({ name: 'Nhiệm vụ đợt B' });
  task2 = await taoNhiemVu({ name: 'Nhiệm vụ thứ hai đợt B' });
});

afterAll(async () => {
  await new Promise((resolve) => app.close(resolve));
  await closePool();
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Q3 + R5 + R6 — TRỤC DUYỆT CÂY
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('ĐỢT B — Q3/R5/R6: trạng thái duyệt lúc tạo', () => {
  it('Q3 + R6: nhiệm vụ cấp 3 mới tạo là «Chờ duyệt» — kể cả khi ADMIN tạo (bỏ VAI_TU_DUYET)', async () => {
    expect(await trangThaiDuyet('work_items', task.id)).toBe('Chờ duyệt');
    const cuaAdmin = await adminApi.post('/api/v1/work-items', {
      workRef: work.code,
      level: 3,
      parentRef: sub.code,
      name: 'Nhiệm vụ do Giám đốc lập',
      assigneeId: nv.id,
      leaderIds: [tp.id],
    });
    expect(cuaAdmin.status, JSON.stringify(cuaAdmin.body)).toBe(200);
    // Luật cũ (`rules.js:51`) cho admin / Phó GĐ tự duyệt việc mình lập. R6 bỏ quyền đó: người duyệt
    // và người lập phải là hai người khác nhau, kể cả khi người lập là Giám đốc.
    expect(await trangThaiDuyet('work_items', cuaAdmin.body.data.item.id)).toBe('Chờ duyệt');
  });

  it('Q3: «Lưu nháp» vẫn thắng — cấp 3 nháp là NHÁP, không phải «Chờ duyệt»', async () => {
    const r = await tpApi.post('/api/v1/work-items', {
      workRef: work.code,
      level: 3,
      parentRef: sub.code,
      name: 'Nhiệm vụ nháp',
      assigneeId: nv.id,
      leaderIds: [tp.id],
      saveAsDraft: true,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await trangThaiDuyet('work_items', r.body.data.item.id)).toBe('Nháp');
  });

  it('R5: nhiệm vụ thêm SAU vào cây đã duyệt ⇒ «Chờ duyệt» MỘT MÌNH NÓ, phần cây đã duyệt KHÔNG mất số', async () => {
    await duyetCaCay();
    const truoc = await soMucDemDuoc();
    expect(truoc).toBeGreaterThan(0);

    const them = await taoNhiemVu({ name: 'Nhiệm vụ thêm sau khi cây đã duyệt' });
    expect(them.approval_status).toBe('Chờ duyệt');
    // MỘT MÌNH NÓ: ba dòng đã ký vẫn «Đã duyệt», không ai bị kéo về chờ.
    expect(await trangThaiDuyet('works', work.id)).toBe('Đã duyệt');
    expect(await trangThaiDuyet('work_items', sub.id)).toBe('Đã duyệt');
    expect(await trangThaiDuyet('work_items', task.id)).toBe('Đã duyệt');
    // `v_countable_items` không mất số của phần đã duyệt; dòng mới chưa được đếm.
    expect(await soMucDemDuoc()).toBe(truoc);

    // Duyệt riêng đúng dòng mới ⇒ số tăng đúng một.
    await duyet(pgdApi, 'work-item', them.code);
    expect(await trangThaiDuyet('work_items', them.id)).toBe('Đã duyệt');
    expect(await soMucDemDuoc()).toBe(truoc + 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Q1 + Q2 + Q4 — CẤM NỘP FILE TRƯỚC KHI CÂY ĐƯỢC DUYỆT
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('ĐỢT B — Q1/Q2: cây chưa duyệt thì chỉ được KHAI BÁO', () => {
  it('Q2: nộp FILE khi cây chưa duyệt ⇒ 409, và không để lại file mồ côi trên đĩa', async () => {
    const r = await upload(nvApi, task.code);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT');
    expect(r.body.error.message).toMatch(/chưa được duyệt/i);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM task_file_versions');
    expect(rows[0].n).toBe(0);
  });

  it('Q2: nộp «BÁO CÁO» (bản chữ) cũng bị chặn — không thành cửa sau để nộp kết quả', async () => {
    const r = await nvApi.post(`/api/v1/work-items/${task.code}/reports`, {
      noiDung: 'Nội dung báo cáo dài hơn mười ký tự',
    });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT');
  });

  it('Q1: KHAI BÁO vẫn mở — tên kết quả · định dạng · TỶ LỆ, và tỷ lệ ghi THẲNG vì cây chưa duyệt (Q3)', async () => {
    const r = await nvApi.post(`/api/v1/work-items/${task.code}/results`, {
      tenKetQua: 'Biên bản nghiệm thu',
      dinhDang: 'PDF',
      tyLe: 70,
      yKien: 'Khai trước khi cây được duyệt',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.nhom.trang_thai).toBe('luu-tam');
    expect(r.body.data.nhom.ty_le).toBe(70);
    expect(r.body.data.tyLeChange.pending).toBe(false);
    expect(await tyLeFile(r.body.data.nhom.id)).toBe(70);
  });

  it('Q2: sau khi cây Đã duyệt thì nộp file được — chuỗi riêng đi sau phiếu duyệt cây', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    expect(nhom.trang_thai).toBe('cho-xem');
    expect(await tyLeFile(nhom.id)).toBe(100); // một nhóm ⇒ trọn 100%
  });

  it('Q2: GET /files trả cờ `cayDaDuyet` + tắt `duocSua`/`duocGuiDuyet` khi cây chưa duyệt', async () => {
    const khai = await nvApi.post(`/api/v1/work-items/${task.code}/results`, {
      tenKetQua: 'Kết quả A',
      dinhDang: 'PDF',
    });
    expect(khai.status).toBe(200);
    const truoc = await nvApi.get(`/api/v1/work-items/${task.code}/files`);
    expect(truoc.status).toBe(200);
    expect(truoc.body.data.quyen.cayDaDuyet).toBe(false);
    expect(truoc.body.data.quyen.duocNop).toBe(false);
    expect(truoc.body.data.nhom[0].cayDaDuyet).toBe(false);
    expect(truoc.body.data.nhom[0].duocSua).toBe(false);
    // Khai báo thì VẪN được: `duocSuaTyLe` không bị khoá theo cây (Q1 + Q3).
    expect(truoc.body.data.nhom[0].duocSuaTyLe).toBe(true);

    await duyetCaCay();
    const sau = await nvApi.get(`/api/v1/work-items/${task.code}/files`);
    expect(sau.body.data.quyen.cayDaDuyet).toBe(true);
    expect(sau.body.data.quyen.duocNop).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// R6 — BỎ TỰ DUYỆT FILE
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('ĐỢT B — R6: không còn tự duyệt file', () => {
  it('R6: `file:create = ✓` cho Cán bộ KHÔNG còn chốt «da-duyet», và không ghi dòng «duyet-tu-dong»', async () => {
    await duyetCaCay();
    // Luật cũ: admin đặt ✓ ở ô «Tạo file kết quả» cho vai Nhân viên ⇒ lần nộp sau TỰ ĐỘNG đã duyệt.
    await override('Nhân viên', 'file', 'create', 'cho-phep');
    const { nhom, tuDong } = await nopVaGui(nvApi, task.code);
    expect(tuDong).toBe(false);
    expect(nhom.trang_thai).toBe('cho-xem');
    const { rows } = await pool.query(
      'SELECT hanh_dong FROM task_file_flow WHERE file_id = $1 ORDER BY id',
      [nhom.id]
    );
    expect(rows.map((r) => r.hanh_dong)).not.toContain('duyet-tu-dong');
    expect(rows.map((r) => r.hanh_dong)).toEqual(['luu-tam', 'gui-duyet']);
  });

  it('R6: Trưởng phòng nộp ⇒ «cho-lanh-dao» như cũ — nhánh TP/PP của apTuDong giữ nguyên', async () => {
    await duyetCaCay();
    const cuaTp = await taoNhiemVu({ name: 'Nhiệm vụ TP tự làm', assigneeId: tp.id });
    await duyet(pgdApi, 'work-item', cuaTp.code);
    const { nhom } = await nopVaGui(tpApi, cuaTp.code);
    expect(nhom.trang_thai).toBe('cho-lanh-dao');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ĐIỂM 9 + ĐIỂM 7 — BẢNG VERDICT
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('ĐỢT B — điểm 9: gộp «Yêu cầu sửa» vào «Đẩy về Cán bộ»', () => {
  it('điểm 9: mã `yeu-cau-sua` không còn tồn tại ⇒ 400', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    const r = await verdict(tpApi, nhom.id, 'yeu-cau-sua', 'Sửa lại giúp anh phần số liệu');
    expect(r.status).toBe(400);
  });

  it('điểm 9: `tra-ve-cbo` là MỘT nút duy nhất — nay BẮT BUỘC ghi lý do, và vẫn đặt lệnh sửa cho cán bộ', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    const khongLyDo = await verdict(tpApi, nhom.id, 'tra-ve-cbo', '');
    expect(khongLyDo.status, JSON.stringify(khongLyDo.body)).toBe(400);
    expect(khongLyDo.body.error.message).toMatch(/lý do|nội dung/i);

    const coLyDo = await verdict(tpApi, nhom.id, 'tra-ve-cbo', 'Thiếu bảng đối chiếu số liệu 2026');
    expect(coLyDo.status, JSON.stringify(coLyDo.body)).toBe(200);
    expect(coLyDo.body.data.nhom.trang_thai).toBe('can-sua');
    expect(coLyDo.body.data.nhom.lenh_sua_cho).toBe('can-bo');
    expect(coLyDo.body.data.nhom.lenh_sua_ly_do).toBe('Thiếu bảng đối chiếu số liệu 2026');
  });

  it('điểm 9: `tra-ve-cbo` nhận cả trạng thái «cho-lanh-dao» (hợp của hai nút cũ)', async () => {
    await duyetCaCay();
    const cuaTp = await taoNhiemVu({ name: 'Nhiệm vụ TP tự làm 2', assigneeId: tp.id });
    await duyet(pgdApi, 'work-item', cuaTp.code);
    const { nhom } = await nopVaGui(tpApi, cuaTp.code);
    expect(nhom.trang_thai).toBe('cho-lanh-dao');
    const r = await verdict(tpApi, nhom.id, 'tra-ve-cbo', 'Đẩy về cán bộ làm lại cho đúng');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.nhom.trang_thai).toBe('can-sua');
  });
});

describe('ĐỢT B — điểm 7: «TP/PP phê duyệt» có lưu mốc', () => {
  it('điểm 7: mã cũ `trinh-lanh-dao` hết hiệu lực; `tp-phe-duyet` lên «cho-lanh-dao» và GHI MỐC ai ký, lúc nào', async () => {
    await duyetCaCay();
    // Q6: «TP/PP phê duyệt» chỉ tồn tại khi nhiệm vụ PHẢI trình Ban lãnh đạo — bật tích cho đúng tiền đề.
    await batGuiBld(task.id);
    const { nhom } = await nopVaGui(nvApi, task.code);
    const cu = await verdict(tpApi, nhom.id, 'trinh-lanh-dao', 'Trình lãnh đạo xem giúp em');
    expect(cu.status).toBe(400);

    const r = await verdict(tpApi, nhom.id, 'tp-phe-duyet', 'Đã kiểm tra, trình Ban lãnh đạo');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.nhom.trang_thai).toBe('cho-lanh-dao');
    const moc = await mocTpPheDuyet(nhom.id);
    expect(Number(moc.tp_duyet_boi)).toBe(tp.id);
    expect(moc.ten).toBe(tp.full_name);
    expect(new Date(moc.tp_duyet_luc).getTime()).not.toBeNaN();
    expect(r.body.data.nhom.tp_duyet_boi != null).toBe(true);
    expect(Number(r.body.data.nhom.tp_duyet_boi)).toBe(tp.id);
  });

  it('điểm 7: `hoan-thanh` cũng là một lần TP/PP ký nên cũng đóng mốc (Q11 giữ nút này)', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    const r = await verdict(tpApi, nhom.id, 'hoan-thanh');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.nhom.trang_thai).toBe('hoan-thanh');
    const moc = await mocTpPheDuyet(nhom.id);
    expect(Number(moc.tp_duyet_boi)).toBe(tp.id);
  });

  it('điểm 7: bị trả về thì MỐC BỊ XOÁ — không để một nhóm «Cần sửa» khoe rằng TP/PP đã ký', async () => {
    await duyetCaCay();
    await batGuiBld(task.id);
    const { nhom } = await nopVaGui(nvApi, task.code);
    const trinh = await verdict(tpApi, nhom.id, 'tp-phe-duyet', 'Đã kiểm tra, trình Ban lãnh đạo');
    expect(trinh.status, JSON.stringify(trinh.body)).toBe(200);
    expect((await mocTpPheDuyet(nhom.id)).tp_duyet_boi).not.toBeNull();

    const tra = await verdict(pgdApi, nhom.id, 'tra-ve-tp', 'Số liệu chưa khớp, trả về phòng');
    expect(tra.status, JSON.stringify(tra.body)).toBe(200);
    expect(tra.body.data.nhom.trang_thai).toBe('can-sua');
    const moc = await mocTpPheDuyet(nhom.id);
    expect(moc.tp_duyet_boi).toBeNull();
    expect(moc.tp_duyet_luc).toBeNull();
  });

  it('điểm 7: bảng luồng ghi đúng mã MỚI, và lịch sử cũ đã được migration 029 đổi tên', async () => {
    await duyetCaCay();
    await batGuiBld(task.id);
    const { nhom } = await nopVaGui(nvApi, task.code);
    const trinh = await verdict(tpApi, nhom.id, 'tp-phe-duyet', 'Đã kiểm tra, trình Ban lãnh đạo');
    expect(trinh.status, JSON.stringify(trinh.body)).toBe(200);
    const { rows } = await pool.query(
      'SELECT hanh_dong FROM task_file_flow WHERE file_id = $1 ORDER BY id',
      [nhom.id]
    );
    expect(rows.map((r) => r.hanh_dong)).toContain('tp-phe-duyet');
    // CHECK của 029 đã bỏ hai mã cũ: ghi thử một dòng là CSDL phải chặn.
    await expect(
      pool.query(
        `INSERT INTO task_file_flow (file_id, version_id, nguoi_id, vai, hanh_dong, noi_dung)
         VALUES ($1, NULL, $2, 'Trưởng phòng', 'trinh-lanh-dao', 'x')`,
        [nhom.id, tp.id]
      )
    ).rejects.toThrow(/task_file_flow_hanh_dong_check/);
  });
});

/**
 * Mã các nút mà máy chủ trả cho MỘT người xem trên MỘT nhóm — đọc đúng cái giao diện dùng để vẽ nút,
 * nên test này bắt được cả hai vế: nút phải ẩn thì ẩn thật, nút phải hiện thì hiện thật.
 */
async function nutCua(api, maNhiemVu, fileId) {
  const r = await api.get(`/api/v1/work-items/${encodeURIComponent(maNhiemVu)}/files`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const nhom = r.body.data.nhom.find((n) => Number(n.id) === Number(fileId));
  expect(nhom, 'không thấy nhóm file trong GET /files').toBeTruthy();
  return nhom.hanhDong.map((h) => h.ma);
}

/**
 * Một BẢN MỚI đứng tên người khác mà KHÔNG đổi trạng thái nhóm — đúng vết của «✎ Sửa trực tuyến» ở
 * ONLYOFFICE: mỗi lần lưu trong editor là một bản, `uploaded_by` là người đang mở editor. Đi thẳng
 * CSDL vì đường editor phải mock callback; chính đường đó đã có `task-files-editor.test.js` lo.
 */
async function luuBanHo(fileId, uploadedBy) {
  const { rows } = await pool.query(
    `INSERT INTO task_file_versions
       (file_id, version_no, ten_luu, ten_goc, loai_mime, kich_thuoc, uploaded_by)
     SELECT file_id, version_no + 1, ten_luu, ten_goc, loai_mime, kich_thuoc, $2
       FROM task_file_versions WHERE file_id = $1
      ORDER BY version_no DESC LIMIT 1
     RETURNING id, version_no, uploaded_by`,
    [fileId, uploadedBy]
  );
  expect(rows.length, 'không nhân bản được — nhóm chưa có bản nào').toBe(1);
  return rows[0];
}

async function ghiChuLuong(fileId, hanhDong) {
  const { rows } = await pool.query(
    `SELECT noi_dung FROM task_file_flow WHERE file_id = $1 AND hanh_dong = $2 ORDER BY id DESC LIMIT 1`,
    [fileId, hanhDong]
  );
  return rows[0]?.noi_dung ?? null;
}

async function thongBaoCua(fileId) {
  const { rows } = await pool.query('SELECT content FROM notifications WHERE ref_id = $1', [
    fileId,
  ]);
  return rows.map((r) => r.content);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Q6 + Q11 — HAI NÚT CHỐT LOẠI TRỪ NHAU (sửa sau khi người dùng thử thật trên CV002-002, 11/09/2026)
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('ĐỢT B — Q6/Q11: tích «Gửi BLĐ phê duyệt» quyết định TP/PP có nút nào', () => {
  it('Q6: tích TẮT ⇒ «TP/PP phê duyệt» BIẾN MẤT khỏi hàng nút và bị 409 nếu gọi thẳng; chỉ còn nút chốt', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    expect(nhom.trang_thai).toBe('cho-xem');

    const nut = await nutCua(tpApi, task.code, nhom.id);
    expect(nut).not.toContain('tp-phe-duyet');
    expect(nut).toContain('hoan-thanh');
    expect(nut).toContain('tra-ve-cbo');

    // Ẩn nút chưa đủ: hàng nút và trang có thể lệch nhau khi người dùng chưa tải lại sau khi admin
    // đổi tích, nên máy chủ vẫn phải từ chối.
    const trinh = await verdict(tpApi, nhom.id, 'tp-phe-duyet', 'Đã kiểm tra, trình Ban lãnh đạo');
    expect(trinh.status).toBe(409);
    expect(trinh.body.error.message).toMatch(/Hoàn thành \/ Duyệt/);
    expect(await trangThaiFile(nhom.id)).toBe('cho-xem');
  });

  it('Q6: tích BẬT ⇒ ngược lại, MẤT nút chốt và «Hoàn thành» bị 403', async () => {
    await duyetCaCay();
    await batGuiBld(task.id);
    const { nhom } = await nopVaGui(nvApi, task.code);

    const nut = await nutCua(tpApi, task.code, nhom.id);
    expect(nut).toContain('tp-phe-duyet');
    expect(nut).not.toContain('hoan-thanh');

    const chot = await verdict(tpApi, nhom.id, 'hoan-thanh');
    expect(chot.status).toBe(403);
    expect(chot.body.error.message).toMatch(/Gửi BLĐ phê duyệt/);
    expect(await trangThaiFile(nhom.id)).toBe('cho-xem');
  });

  it('Q6 (ca thật CV002-002): tích TẮT mà TP vừa LƯU bản cuối (sửa trực tuyến hộ) thì VẪN chốt được', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    // Bản cũ chặn theo `uploaded_by` của bản cuối nên ca này TẮC: trình lên thì trái cái tích, không
    // trình thì file treo vĩnh viễn. Van nay chỉ canh NGƯỜI THỰC HIỆN (Q5) ⇒ TP vẫn còn nút chốt.
    const banHo = await luuBanHo(nhom.id, tp.id);
    expect(Number(banHo.uploaded_by)).toBe(tp.id);
    expect(await nutCua(tpApi, task.code, nhom.id)).toContain('hoan-thanh');

    const r = await verdict(tpApi, nhom.id, 'hoan-thanh');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.nhom.trang_thai).toBe('hoan-thanh');
    expect(Number((await mocTpPheDuyet(nhom.id)).tp_duyet_boi)).toBe(tp.id);
  });

  it('Q5: TP là NGƯỜI THỰC HIỆN ⇒ không được tự chốt, nhưng VẪN còn «TP/PP phê duyệt» dù tích TẮT', async () => {
    await duyetCaCay();
    const cuaTp = await taoNhiemVuCuaTp('Nhiệm vụ TP tự làm (Q5)');
    const { nhom } = await nopVaGui(tpApi, cuaTp.code);
    expect(nhom.trang_thai).toBe('cho-lanh-dao'); // Q5 giữ nguyên: TP tự làm thì lên thẳng BLĐ kiểm soát
    // Đưa về «Cần sửa» để TP đứng trước đúng ngã ba: chốt tại phòng hay trình lên.
    const tra = await verdict(pgdApi, nhom.id, 'tra-ve-tp', 'Số liệu chưa khớp, trả về phòng');
    expect(tra.status, JSON.stringify(tra.body)).toBe(200);

    const nut = await nutCua(tpApi, cuaTp.code, nhom.id);
    expect(nut).not.toContain('hoan-thanh');
    expect(nut).toContain('tp-phe-duyet');

    const chot = await verdict(tpApi, nhom.id, 'hoan-thanh');
    expect(chot.status).toBe(403);
    expect(chot.body.error.message).toMatch(/người thực hiện/i);

    const trinh = await verdict(tpApi, nhom.id, 'tp-phe-duyet', 'Đã làm lại, trình Ban lãnh đạo');
    expect(trinh.status, JSON.stringify(trinh.body)).toBe(200);
    expect(trinh.body.data.nhom.trang_thai).toBe('cho-lanh-dao');
  });

  it('Q6: admin đặt ⏳ ở «Duyệt kết quả» ⇒ mất nút chốt, chỉ còn trình — hàng nút và rào chặn khớp nhau', async () => {
    await duyetCaCay();
    await override('Trưởng phòng', 'file', 'approve', 'cho-duyet');
    const { nhom } = await nopVaGui(nvApi, task.code);

    const nut = await nutCua(tpApi, task.code, nhom.id);
    expect(nut).toContain('tp-phe-duyet');
    expect(nut).not.toContain('hoan-thanh');

    const chot = await verdict(tpApi, nhom.id, 'hoan-thanh');
    expect(chot.status).toBe(403);
    expect(chot.body.error.message).toMatch(/Chờ duyệt/);
  });

  it('Q11: nút chốt nhận GHI CHÚ TUỲ CHỌN — có ghi thì lưu vào bảng luồng và nối vào thông báo', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    const r = await verdict(tpApi, nhom.id, 'hoan-thanh', 'Đã đối chiếu số liệu, chốt kết quả');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.nhom.trang_thai).toBe('hoan-thanh');
    expect(await ghiChuLuong(nhom.id, 'hoan-thanh')).toBe('Đã đối chiếu số liệu, chốt kết quả');
    const bao = await thongBaoCua(nhom.id);
    expect(bao.some((c) => c.includes('Ghi chú: Đã đối chiếu số liệu, chốt kết quả'))).toBe(true);
  });

  it('Q11: để TRỐNG ghi chú thì vẫn chốt được và câu báo giữ nguyên y như trước', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    const r = await verdict(tpApi, nhom.id, 'hoan-thanh');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.nhom.trang_thai).toBe('hoan-thanh');
    expect(await ghiChuLuong(nhom.id, 'hoan-thanh')).toBe('');
    const bao = await thongBaoCua(nhom.id);
    expect(bao.some((c) => c.includes('"ket-qua.pdf" được hoàn thành.'))).toBe(true);
    expect(bao.some((c) => c.includes('Ghi chú:'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ĐIỂM 12 — SIẾT NGƯỜI DUYỆT FILE THEO BLĐKS CẤP 3, KỂ CẢ KHI TÍCH TẮT
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('ĐỢT B — điểm 12: đúng Ban lãnh đạo kiểm soát mới duyệt được file', () => {
  it('điểm 12: tích Gửi BLĐ TẮT mà ô BLĐKS ghi người khác ⇒ Phó GĐ kia vẫn 403', async () => {
    await duyetCaCay();
    // Mặc định `gui_bld_phe_duyet = false` (026) — đúng ca mà bản cũ bỏ lọt.
    // Q5/Q6: tích TẮT thì nút «TP/PP phê duyệt» KHÔNG còn, nên đưa file lên cửa lãnh đạo bằng đường
    // Q5 — Trưởng phòng là NGƯỜI THỰC HIỆN của nhiệm vụ, nộp lên là «cho-lanh-dao» thẳng.
    const cuaTp = await taoNhiemVuCuaTp('Nhiệm vụ TP tự làm (điểm 12)');
    const { rows } = await pool.query('SELECT gui_bld_phe_duyet FROM work_items WHERE id = $1', [
      cuaTp.id,
    ]);
    expect(rows[0].gui_bld_phe_duyet).toBe(false);

    const { nhom } = await nopVaGui(tpApi, cuaTp.code);
    expect(nhom.trang_thai).toBe('cho-lanh-dao');

    const saiNguoi = await verdict(pgd2Api, nhom.id, 'duyet');
    expect(saiNguoi.status).toBe(403);
    const dungNguoi = await verdict(pgdApi, nhom.id, 'duyet');
    expect(dungNguoi.status, JSON.stringify(dungNguoi.body)).toBe(200);
    expect(dungNguoi.body.data.nhom.trang_thai).toBe('da-duyet');
  });

  it('điểm 12: admin KHÔNG còn là người duyệt dự phòng — phải có tên trong ô BLĐKS', async () => {
    await duyetCaCay();
    const cuaTp = await taoNhiemVuCuaTp('Nhiệm vụ TP tự làm (admin hết dự phòng)');
    const { nhom } = await nopVaGui(tpApi, cuaTp.code);
    expect(nhom.trang_thai).toBe('cho-lanh-dao');
    const r = await verdict(adminApi, nhom.id, 'duyet');
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
  });

  it('điểm 12: hàng nút của Phó GĐ KHÔNG được chọn cũng rỗng — giao diện không mời bấm để rồi 403', async () => {
    await duyetCaCay();
    const cuaTp = await taoNhiemVuCuaTp('Nhiệm vụ TP tự làm (hàng nút PGĐ)');
    const { nhom } = await nopVaGui(tpApi, cuaTp.code);
    expect(nhom.trang_thai).toBe('cho-lanh-dao');
    const cuaPgd2 = await pgd2Api.get('/api/v1/task-files/cho-duyet');
    expect(cuaPgd2.status).toBe(200);
    const dong = cuaPgd2.body.data.items.find((d) => Number(d.id) === Number(nhom.id));
    expect(dong.hanhDong).toEqual([]);
    const cuaPgd = await pgdApi.get('/api/v1/task-files/cho-duyet');
    const dongDung = cuaPgd.body.data.items.find((d) => Number(d.id) === Number(nhom.id));
    expect(dongDung.hanhDong.map((h) => h.ma)).toContain('duyet');
    expect(dongDung.hanhDong.map((h) => h.ma)).not.toContain('yeu-cau-sua');
    expect(dongDung.hanhDong.map((h) => h.ma)).not.toContain('trinh-lanh-dao');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Q10 + R4 + R4' + R4'' — TỶ LỆ QUA `approval_changes`
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('ĐỢT B — R4/R4’/R4’’: sửa tỷ lệ phải qua duyệt', () => {
  it('R4’’: sửa tỷ lệ FILE trên cây đã duyệt ⇒ giá trị CŨ giữ nguyên, sinh MỘT đề nghị, cây KHÔNG bị hạ', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    expect(await tyLeFile(nhom.id)).toBe(100);

    const r = await nvApi.patch(`/api/v1/task-files/${nhom.id}/ty-le`, { tyLe: 40 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.tyLeChange.pending).toBe(true);
    expect(r.body.data.nhom.ty_le).toBe(100); // giá trị CŨ
    expect(await tyLeFile(nhom.id)).toBe(100);
    // R4'': KHÔNG hạ cây về «Chờ duyệt» nên `v_countable_items` không mất số.
    expect(await trangThaiDuyet('work_items', task.id)).toBe('Đã duyệt');
  });

  it('R4’: đề nghị tỷ lệ của FILE chỉ hiện với ĐÚNG 1 BLĐKS của nhiệm vụ (cấp 3)', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    await nvApi.patch(`/api/v1/task-files/${nhom.id}/ty-le`, { tyLe: 40 });

    expect(await deNghiTyLeCua(pgdApi)).toHaveLength(1);
    // Phó GĐ cùng phòng nhưng KHÔNG có tên ở ô BLĐKS ⇒ không thấy, không quyết được.
    expect(await deNghiTyLeCua(pgd2Api)).toHaveLength(0);
    expect(await deNghiTyLeCua(tpApi)).toHaveLength(0);
    // Người đề nghị không tự duyệt đề nghị của mình.
    expect(await deNghiTyLeCua(nvApi)).toHaveLength(0);

    const badge = await pgdApi.get('/api/v1/approvals/pending-count');
    expect(badge.status).toBe(200);
    expect(badge.body.data.tyLeChanges).toBe(1);
    expect(badge.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('R4’’: duyệt đề nghị ⇒ tỷ lệ MỚI có hiệu lực; nội dung đề nghị đọc được từ → đến', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    await nvApi.patch(`/api/v1/task-files/${nhom.id}/ty-le`, { tyLe: 40 });
    const [deNghi] = await deNghiTyLeCua(pgdApi);
    expect(deNghi.change.from).toBe('100%');
    expect(deNghi.change.to).toBe('40%');
    expect(deNghi.change.target).toBe('file');

    const quyet = await pgdApi.post(`/api/v1/approvals/changes/${deNghi.id}/approve`, {});
    expect(quyet.status, JSON.stringify(quyet.body)).toBe(200);
    expect(quyet.body.data.approved).toBe(true);
    expect(await tyLeFile(nhom.id)).toBe(40);
    // Đóng rồi thì biến khỏi hàng chờ, và quyết lần hai là 409.
    expect(await deNghiTyLeCua(pgdApi)).toHaveLength(0);
    const lanHai = await pgdApi.post(`/api/v1/approvals/changes/${deNghi.id}/approve`, {});
    expect(lanHai.status).toBe(409);
  });

  it('R4’’: TỪ CHỐI đề nghị ⇒ tỷ lệ giữ nguyên, và bắt buộc lý do ≥ 10 ký tự', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    await nvApi.patch(`/api/v1/task-files/${nhom.id}/ty-le`, { tyLe: 40 });
    const [deNghi] = await deNghiTyLeCua(pgdApi);

    const ngan = await pgdApi.post(`/api/v1/approvals/changes/${deNghi.id}/reject`, {
      reason: 'ngắn',
    });
    expect(ngan.status).toBe(400);

    const tuChoi = await pgdApi.post(`/api/v1/approvals/changes/${deNghi.id}/reject`, {
      reason: 'Tỷ lệ này không phản ánh đúng khối lượng',
    });
    expect(tuChoi.status, JSON.stringify(tuChoi.body)).toBe(200);
    expect(tuChoi.body.data.approved).toBe(false);
    expect(await tyLeFile(nhom.id)).toBe(100);
  });

  it('R4’’: MỖI nhóm file một đề nghị riêng — hai nhóm của cùng nhiệm vụ không chặn nhau', async () => {
    await duyetCaCay();
    const a = await nopVaGui(nvApi, task.code);
    const b = await nopVaGui(nvApi, task.code, { fileId: null });
    expect(a.nhom.id).not.toBe(b.nhom.id);

    const r1 = await nvApi.patch(`/api/v1/task-files/${a.nhom.id}/ty-le`, { tyLe: 30 });
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    const r2 = await nvApi.patch(`/api/v1/task-files/${b.nhom.id}/ty-le`, { tyLe: 70 });
    expect(r2.status, JSON.stringify(r2.body)).toBe(200);
    expect(await deNghiTyLeCua(pgdApi)).toHaveLength(2);

    // Cùng MỘT nhóm thì chỉ MỘT đề nghị đang chờ.
    const trung = await nvApi.patch(`/api/v1/task-files/${a.nhom.id}/ty-le`, { tyLe: 35 });
    expect(trung.status).toBe(409);
  });

  it('Q10 + R4: sửa tỷ lệ NHIỆM VỤ trên cây đã duyệt ⇒ đề nghị, giá trị cũ giữ nguyên, cây vẫn «Đã duyệt»', async () => {
    await duyetCaCay();
    const truoc = await tyLeMuc(task.id);
    expect(truoc).toBe(50); // hai nhiệm vụ cùng một việc con ⇒ 50/50
    const r = await tpApi.patch(`/api/v1/work-items/${task.code}`, { tyLe: 30 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.tyLeChange.pending).toBe(true);
    expect(await tyLeMuc(task.id)).toBe(truoc); // R4'': giá trị CŨ giữ nguyên tới khi được duyệt
    expect(await trangThaiDuyet('work_items', task.id)).toBe('Đã duyệt');

    const [deNghi] = await deNghiTyLeCua(pgdApi);
    expect(deNghi.change.target).toBe('task');
    expect(deNghi.change.from).toBe('50%');
    expect(deNghi.change.to).toBe('30%');
    const quyet = await pgdApi.post(`/api/v1/approvals/changes/${deNghi.id}/approve`, {});
    expect(quyet.status, JSON.stringify(quyet.body)).toBe(200);
    expect(await tyLeMuc(task.id)).toBe(30);
    // `updateChildWeights` (childWeights.js:23) đặt đúng dòng bị sửa, các dòng anh em GIỮ NGUYÊN —
    // tổng lệch (30 + 50 = 80) là luật có chủ đích: «sửa tay giữ nguyên để người dùng xác nhận tổng».
    expect(await tyLeMuc(task2.id)).toBe(50);
  });

  it('R4: tỷ lệ CÔNG VIỆC CON gửi TẤT CẢ BLĐKS cấp 2, và Q7 — MỘT người đồng ý là đủ', async () => {
    // Đổi ô BLĐKS thành HAI người. Cấp 2 chỉ được chọn trong danh sách của cấp 1 nên phải mở ở
    // công việc cha trước, nếu không là SUPERVISOR_NOT_IN_SOURCE (ĐỢT A, R2).
    const moRong = await tpApi.patch(`/api/v1/works/${work.code}`, {
      supervisorIds: [pgd.id, pgd2.id],
    });
    expect(moRong.status, JSON.stringify(moRong.body)).toBe(200);
    const doi = await tpApi.patch(`/api/v1/work-items/${sub.code}`, {
      supervisorIds: [pgd.id, pgd2.id],
    });
    expect(doi.status, JSON.stringify(doi.body)).toBe(200);
    await duyetCaCay();

    // Luật có sẵn (service.js:724): Trưởng phòng sửa CÔNG VIỆC CON đã duyệt thì cây bị HẠ về «Chờ
    // duyệt» — ca đó là Q9 và đã kiểm ở test ngay dưới. Muốn chạm đúng ca R4'' (tỷ lệ thành đề nghị,
    // cây giữ «Đã duyệt») thì phải gỡ luật hạ cây cho vai này bằng ghi đè ✓ ở ô Sửa.
    await override('Trưởng phòng', 'subwork', 'update', 'cho-phep');

    const r = await tpApi.patch(`/api/v1/work-items/${sub.code}`, { tyLe: 55 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.tyLeChange.pending).toBe(true);
    expect(await trangThaiDuyet('work_items', sub.id)).toBe('Đã duyệt');
    // Cả HAI người đều thấy đề nghị.
    const [cuaPgd] = await deNghiTyLeCua(pgdApi);
    expect(await deNghiTyLeCua(pgd2Api)).toHaveLength(1);
    expect(cuaPgd.change.target).toBe('subwork');
    expect(cuaPgd.change.recipients.map(Number).sort()).toEqual([pgd.id, pgd2.id].sort());

    // Q7: một người duyệt là xong — người kia không còn gì để quyết.
    const quyet = await pgd2Api.post(`/api/v1/approvals/changes/${cuaPgd.id}/approve`, {});
    expect(quyet.status, JSON.stringify(quyet.body)).toBe(200);
    expect(await deNghiTyLeCua(pgdApi)).toHaveLength(0);
    expect(await deNghiTyLeCua(pgd2Api)).toHaveLength(0);
    expect(await tyLeMuc(sub.id)).toBe(55);
    expect(await tyLeMuc(sub2.id)).toBe(45);
  });

  it('Q3: cây còn «Chờ duyệt» thì sửa tỷ lệ GHI THẲNG — đó là khai báo đi theo phiếu duyệt cây', async () => {
    // Chưa ký gì cả: công việc con đang «Chờ duyệt».
    expect(await trangThaiDuyet('work_items', sub.id)).toBe('Chờ duyệt');
    const r = await tpApi.patch(`/api/v1/work-items/${sub.code}`, { tyLe: 45 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.tyLeChange).toBeUndefined();
    expect(await tyLeMuc(sub.id)).toBe(45);
    expect(await tyLeMuc(sub2.id)).toBe(55);
  });

  it('Q9: sửa cây đã duyệt mà BỊ HẠ về «Chờ duyệt» thì tỷ lệ đi theo phiếu duyệt cây, không lập đề nghị riêng', async () => {
    await duyetCaCay();
    // Admin đặt ⏳ cho ô Sửa của Trưởng phòng ⇒ mọi lượt sửa của TP trên mục đã duyệt đều hạ cây.
    await override('Trưởng phòng', 'subwork', 'update', 'cho-duyet');
    const r = await tpApi.patch(`/api/v1/work-items/${sub.code}`, { tyLe: 60 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.item.approval_status).toBe('Chờ duyệt'); // Q9: hạ cây về chờ
    expect(r.body.data.tyLeChange).toBeUndefined(); // tỷ lệ đi theo phiếu duyệt cây
    expect(await trangThaiDuyet('work_items', sub.id)).toBe('Chờ duyệt');
    expect(await tyLeMuc(sub.id)).toBe(60);
  });

  it('R4’’: chính người kiểm soát tự đề nghị ⇒ Giám đốc là bên gỡ thế kẹt, không tắc vĩnh viễn', async () => {
    await duyetCaCay();
    const { nhom } = await nopVaGui(nvApi, task.code);
    // Phó GĐ `pgd` là người kiểm soát; cho họ cửa nộp file để tự đề nghị tỷ lệ cho chính mình.
    const r = await pgdApi.patch(`/api/v1/task-files/${nhom.id}/ty-le`, { tyLe: 25 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.tyLeChange.pending).toBe(true);
    expect(await deNghiTyLeCua(pgdApi)).toHaveLength(0); // không tự duyệt
    const [deNghi] = await deNghiTyLeCua(adminApi);
    const quyet = await adminApi.post(`/api/v1/approvals/changes/${deNghi.id}/approve`, {});
    expect(quyet.status, JSON.stringify(quyet.body)).toBe(200);
    expect(await tyLeFile(nhom.id)).toBe(25);
  });
});

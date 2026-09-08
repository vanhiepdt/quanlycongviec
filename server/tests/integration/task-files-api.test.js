// LUỒNG «KẾT QUẢ NHIỆM VỤ LÀ FILE» (014, 2026-09-01) — nộp → góp ý → duyệt, và MỌI «cửa duyệt»
// đọc giá trị hiệu lực từ Bảng phân quyền động (giaTriHieuLuc: ma trận + ghi đè 009/010/011/014).
//
// Bốn điều then chốt, mỗi điều là một quyết định người dùng đã chốt:
//  1. **Cán bộ nộp ⇒ nhóm rơi «Chờ TP/PP xem»** (⏳ mặc định); TP/PP nộp ⇒ «Chờ lãnh đạo».
//  2. **admin đổi `file:create` Cán bộ = ✓ qua PUT ⇒ lần nộp sau TỰ ĐỘNG «Đã duyệt»** kèm dòng
//     luồng «Tự động — phân quyền không yêu cầu duyệt»; đổi lại ⏳ ⇒ luồng thường — HIỆU LỰC NGAY.
//  3. **TP/PP chốt = 'hoan-thanh'** (người dùng chốt 2026-09-01); 'da-duyet' chỉ do PGD/GĐ bấm
//     «Duyệt» hoặc tự động. admin đặt ⏳ ở ô «Duyệt kết quả» của TP/PP ⇒ mất nút chốt (403).
//  4. **Máy chủ là rào chặn cuối**: vai ngoài phòng 403, vai không có quyền verdict 403, file
//     sai loại/quá 20 MB 400, nhóm đã chốt thì nộp tiếp 409.
import { rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { closePool } from '../../src/db/pool.js';
import { duongBan, tenGocUtf8, tokenDs } from '../../src/modules/taskFiles/service.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let phongB;
let nv; // Cán bộ — người được giao nhiệm vụ, người nộp file
let apiNv;
let tp; // Trưởng phòng phòng A — người xem/góp ý/duyệt cấp 1 của luồng file
let apiTp;
let pgdA; // Phó Giám đốc phụ trách phòng A — người duyệt cấp trên
let apiPgdA;
let apiAdmin;
let nvNgoai; // Cán bộ phòng B — vai ngoài phạm vi
let apiNvNgoai;

const PDF = {
  ten: 'ket-qua.pdf',
  mime: 'application/pdf',
  noiDung: '%PDF-1.4 ket qua nhiem vu',
};
const DOCX = {
  ten: 'ket-qua.docx',
  mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  noiDung: 'PK\x03\x04 docx gia lap',
};
/**
 * Các đuôi mở thêm 2026-09-03 (người dùng chốt: «thêm cả up được cả file ppt và ảnh và excel»).
 * Ảnh dùng để kiểm hai điều KHÁC Word/PDF: `?inline=1` mở được, và nút ✎ sửa trực tuyến phải
 * ĐÓNG (DS không có bộ soạn thảo cho ảnh).
 */
const XLSX = {
  ten: 'bang-tong-hop.xlsx',
  mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  noiDung: 'PK\x03\x04 xlsx gia lap',
};
const PPTX = {
  ten: 'bai-trinh-bay.pptx',
  mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  noiDung: 'PK\x03\x04 pptx gia lap',
};
const XLS = { ten: 'so-lieu.xls', mime: 'application/vnd.ms-excel', noiDung: 'xls gia lap' };
const PPT = { ten: 'slide.ppt', mime: 'application/vnd.ms-powerpoint', noiDung: 'ppt gia lap' };
const PNG = { ten: 'anh-hien-truong.png', mime: 'image/png', noiDung: '\x89PNG gia lap' };
const JPG = { ten: 'ảnh chụp.jpg', mime: 'image/jpeg', noiDung: '\xFF\xD8\xFF gia lap' };

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

/** Nộp file bằng FormData thật (multer + CSRF) — cùng đường với trình duyệt. */
async function nopFile(api, ref, file, { fileId = null, moTa = '' } = {}) {
  const token = await api.csrfToken();
  let req = api.agent.post(`/api/v1/work-items/${encodeURIComponent(ref)}/files`);
  if (token !== null) req = req.set('x-csrf-token', token);
  if (fileId != null) req = req.field('fileId', String(fileId));
  if (moTa) req = req.field('moTa', moTa);
  return req.attach('file', Buffer.from(file.noiDung, 'binary'), {
    filename: file.ten,
    contentType: file.mime,
  });
}

async function docFiles(api, ref) {
  const res = await api.get(`/api/v1/work-items/${encodeURIComponent(ref)}/files`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data.nhom;
}

async function trangThaiNhom(fileId) {
  const { rows } = await pool.query('SELECT trang_thai FROM task_files WHERE id = $1', [fileId]);
  return rows[0]?.trang_thai ?? null;
}

async function luongCuaNhom(fileId) {
  const { rows } = await pool.query(
    `SELECT g.hanh_dong, g.noi_dung, v.version_no
       FROM task_file_flow g
       LEFT JOIN task_file_versions v ON v.id = g.version_id
      WHERE g.file_id = $1 ORDER BY g.id`,
    [fileId]
  );
  return rows;
}

async function thongBaoCua(userId) {
  const { rows } = await pool.query(
    'SELECT content, type, ref_type FROM notifications WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return rows;
}

/** admin đặt/bỏ ghi đè trên Bảng phân quyền — đúng đường PUT mà người dùng dùng trên giao diện. */
async function datGhiDe(vai, entityType, action, giaTri) {
  const res = await apiAdmin.put('/api/v1/permissions', {
    thayDoi: [{ vai, entityType, action, giaTri }],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

/** Một công việc đã duyệt + công việc con + nhiệm vụ gán cho Cán bộ (khuôn taoCayDaDuyet 013). */
async function taoNhiemVuCho(name, { leaderIdsNv = null, leaderIdsCon = null } = {}) {
  const cv = await apiTp.post('/api/v1/works', {
    name: `Việc phòng A — ${name}`,
    departmentId: phongA.id,
  });
  const work = cv.body.data.work;
  await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
  const con = await apiTp.post('/api/v1/work-items', {
    workRef: work.code,
    level: 2,
    name: `Công việc con — ${name}`,
    // Luật `LEADER_NOT_IN_SOURCE` (Vòng 12): lãnh đạo phụ trách của nhiệm vụ phải nằm trong danh
    // sách của công việc con chứa nó ⇒ phải khai từ cấp 2 trước khi gán cho cấp 3. Cấp 2 nhận
    // NHIỀU người (CHECK `task_leader_single` chỉ bó cấp 3).
    leaderIds: leaderIdsCon ?? [tp.id],
  });
  expect(con.status, JSON.stringify(con.body)).toBe(200);
  const conCode = con.body.data.item.code;
  await apiPgdA.post(`/api/v1/approvals/work-item/${conCode}/approve`);
  const nvItem = await apiTp.post('/api/v1/work-items', {
    workRef: work.code,
    level: 3,
    parentRef: conCode,
    name: `Nhiệm vụ — ${name}`,
    assigneeId: nv.id,
    // 2026-09-02 — luật SIẾT `leader_ids`: chỉ người được nêu ở ô «Lãnh đạo phòng phụ trách» mới
    // xem/sửa/duyệt được file của nhiệm vụ. Bộ test này để Trưởng phòng đóng vai đó, nên phải gán
    // tường minh — nếu bỏ trống thì mọi lời gọi của `apiTp` rơi 403 «không phải lãnh đạo phụ trách».
    // `leaderIdsNv: []` để CỐ Ý bỏ trống (ca nhiệm vụ chưa gán lãnh đạo).
    leaderIds: leaderIdsNv ?? [tp.id],
  });
  expect(nvItem.status, JSON.stringify(nvItem.body)).toBe(200);
  return nvItem.body.data.item.code;
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  phongB = await makeDepartment({ code: 'PH02', name: 'Phòng Điện', sort_order: 2 });

  const admin = await makeLoginUser({
    code: 'NV001',
    email: 'admin@test.local',
    role: 'admin',
    department_id: null,
  });
  tp = await makeLoginUser({
    code: 'NV010',
    full_name: 'Trần Thị Trưởng',
    email: 'tp-a@test.local',
    role: 'Trưởng phòng',
    department_id: phongA.id,
  });
  pgdA = await makeLoginUser({
    code: 'NV002',
    full_name: 'Lê Văn Phó',
    email: 'pgd-a@test.local',
    role: 'Phó Giám đốc',
    department_id: phongA.id,
  });
  nv = await makeLoginUser({
    code: 'NV030',
    full_name: 'Nguyễn Văn Cán Bộ',
    email: 'nv-a@test.local',
    role: 'Nhân viên',
    department_id: phongA.id,
  });
  nvNgoai = await makeLoginUser({
    code: 'NV031',
    full_name: 'Phạm Văn Ngoài',
    email: 'nv-b@test.local',
    role: 'Nhân viên',
    department_id: phongB.id,
  });
  apiAdmin = await dangNhap(admin);
  apiTp = await dangNhap(tp);
  apiPgdA = await dangNhap(pgdA);
  apiNv = await dangNhap(nv);
  apiNvNgoai = await dangNhap(nvNgoai);

  // Phó GĐ phụ trách phòng A — nguồn danh sách người nhận «trình lên» (department_managers).
  // Trưởng phòng cũng phải có mặt ở đây: `assertLeaders` chỉ nhận id nằm trong danh sách lãnh đạo
  // phòng (`listManagers` role 'head'), nên thiếu dòng này thì mọi lần gán ô «Lãnh đạo phòng phụ
  // trách» = TP đều rơi 400 «phải là Trưởng phòng hoặc Phó phòng của phòng này».
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, 'deputy_director'), ($1, $3, 'head')`,
    [phongA.id, pgdA.id, tp.id]
  );
});

afterAll(async () => {
  await closePool();
});

describe('TC-TF — luồng file kết quả + phân quyền động (014)', () => {
  it('TC-TF-01: Cán bộ nộp PDF ⇒ nhóm «cho-xem», bản v1, dòng luồng «nop»; TỬ TẾ: TP NHẬN THÔNG BÁO', async () => {
    const ma = await taoNhiemVuCho('TF-01');
    const res = await nopFile(apiNv, ma, PDF, { moTa: 'Bản đầu tiên' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const { nhom, ban, tuDong } = res.body.data;
    expect(tuDong).toBe(false);
    expect(nhom.trang_thai).toBe('cho-xem');
    expect(nhom.ten_goc).toBe(PDF.ten);
    expect(ban.version_no).toBe(1);
    expect(ban.ten_luu).toMatch(/^v1-[0-9a-f-]+\.pdf$/);
    expect(ban.ten_luu).not.toContain(PDF.ten); // CẤM dùng tên gốc làm tên vật lý
    const luong = await luongCuaNhom(nhom.id);
    expect(luong.map((g) => g.hanh_dong)).toEqual(['nop']);
    expect(luong[0].noi_dung).toBe('Bản đầu tiên');
    // Phản hồi GET mang cờ ONLYOFFICE để client hiện/ẩn nút ✎ sửa trực tuyến.
    const doc = await apiNv.get(`/api/v1/work-items/${encodeURIComponent(ma)}/files`);
    expect(doc.body.data.onlyOffice).toBe(true);
    // Tải về: đúng tên gốc trong Content-Disposition, đúng nội dung (parser nhị phân vì .pdf
    // không phải text/JSON — supertest mặc định không đặt body cho loại đó).
    const tai = await apiNv.agent
      .get(`/api/v1/task-files/${ban.id}/download`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(tai.status).toBe(200);
    expect(tai.headers['content-type']).toBe(PDF.mime);
    expect(tai.headers['content-disposition']).toContain('attachment');
    expect(tai.headers['content-disposition']).toContain(encodeURIComponent(PDF.ten));
    expect(tai.body.toString('binary')).toBe(PDF.noiDung);
    // ⭐ TP/PP phòng NHẬN THÔNG BÁO «chờ xem» — đúng yêu cầu người dùng (2026-09-01).
    const baoTp = await thongBaoCua(tp.id);
    expect(
      baoTp.some(
        (x) => x.type === 'approval_pending' && x.content.includes('chờ Trưởng phòng/Phó phòng xem')
      )
    ).toBe(true);
  });

  it('TC-TF-02: TP/PP góp ý theo bản ⇒ ghi task_file_comments + dòng luồng «gom-y»', async () => {
    const ma = await taoNhiemVuCho('TF-02');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    const cacBan = (await docFiles(apiTp, ma))[0].bans;
    const res = await apiTp.post(`/api/v1/task-file-versions/${cacBan[0].id}/comments`, {
      noiDung: 'Trang 2 thiếu chữ ký',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const sau = await docFiles(apiTp, ma);
    expect(sau[0].gopY).toHaveLength(1);
    expect(sau[0].gopY[0].ten_nguoi).toBe(tp.full_name);
    expect(sau[0].gopY[0].noi_dung).toBe('Trang 2 thiếu chữ ký');
    expect((await luongCuaNhom(nhom.id)).map((g) => g.hanh_dong)).toEqual(['nop', 'gom-y']);
    expect(await trangThaiNhom(nhom.id)).toBe('cho-xem'); // góp ý KHÔNG đổi trạng thái
  });

  it('TC-TF-03: TP «Yêu cầu sửa» (nội dung ≥ 10 ký tự) ⇒ «can-sua» + thông báo cho Cán bộ', async () => {
    const ma = await taoNhiemVuCho('TF-03');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    const res = await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'yeu-cau-sua',
      noiDung: 'Bổ sung bảng số liệu tháng 8 rồi nộp lại',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await trangThaiNhom(nhom.id)).toBe('can-sua');
    const bao = await thongBaoCua(nv.id);
    expect(bao.some((x) => x.content.includes('yêu cầu sửa lại'))).toBe(true);
    // Nội dung < 10 ký tự bị chặn ngay ở service.
    const ngan = await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'yeu-cau-sua',
      noiDung: 'chưa đạt',
    });
    expect(ngan.status).toBe(400);
  });

  it('TC-TF-04: Cán bộ nộp v2 sau yêu cầu sửa ⇒ version_no tăng, nhóm về «cho-xem»', async () => {
    const ma = await taoNhiemVuCho('TF-04');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'yeu-cau-sua',
      noiDung: 'Bổ sung bảng số liệu tháng 8 rồi nộp lại',
    });
    const res = await nopFile(apiNv, ma, DOCX, { fileId: nhom.id, moTa: 'Đã bổ sung bảng' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.ban.version_no).toBe(2);
    expect(await trangThaiNhom(nhom.id)).toBe('cho-xem');
    const luong = await luongCuaNhom(nhom.id);
    expect(luong.map((g) => g.hanh_dong)).toEqual(['nop', 'yeu-cau-sua', 'nop']);
  });

  it('TC-TF-05: admin đổi «file:create» Cán bộ = ✓ qua PUT ⇒ lần nộp sau TỰ ĐỘNG «da-duyet» + dòng «Tự động»', async () => {
    const ma = await taoNhiemVuCho('TF-05');
    await datGhiDe('Nhân viên', 'file', 'create', 'cho-phep');
    const res = await nopFile(apiNv, ma, PDF);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const { nhom, tuDong } = res.body.data;
    expect(tuDong).toBe(true);
    expect(nhom.trang_thai).toBe('da-duyet');
    const luong = await luongCuaNhom(nhom.id);
    expect(luong.map((g) => g.hanh_dong)).toEqual(['nop', 'duyet-tu-dong']);
    expect(luong[1].noi_dung).toBe('Tự động — phân quyền không yêu cầu duyệt');
    // Nhóm đã «Đã duyệt» = trạng thái kết: không nộp thêm được (khóa upload).
    const nopTiep = await nopFile(apiNv, ma, DOCX, { fileId: nhom.id });
    expect(nopTiep.status).toBe(409);
  });

  it('TC-TF-06: admin đổi lại ⏳ (mặc định) ⇒ luồng thường NGAY cho lần nộp sau', async () => {
    const ma = await taoNhiemVuCho('TF-06');
    await datGhiDe('Nhân viên', 'file', 'create', 'cho-phep');
    await nopFile(apiNv, ma, PDF);
    await datGhiDe('Nhân viên', 'file', 'create', 'mac-dinh'); // xoá ghi đè = về mặc định
    const res = await nopFile(apiNv, ma, DOCX);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.tuDong).toBe(false);
    expect(res.body.data.nhom.trang_thai).toBe('cho-xem');
    expect((await luongCuaNhom(res.body.data.nhom.id)).map((g) => g.hanh_dong)).toEqual(['nop']);
  });

  it('TC-TF-07: TP «Trình Phó giám đốc» ⇒ «cho-lanh-dao» + thông báo cho PGD PHỤ TRÁCH phòng', async () => {
    const ma = await taoNhiemVuCho('TF-07');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    const res = await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'trinh-lanh-dao',
      noiDung: 'Kính trình Phó giám đốc xem kết quả quý này',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await trangThaiNhom(nhom.id)).toBe('cho-lanh-dao');
    const bao = await thongBaoCua(pgdA.id);
    expect(bao.some((x) => x.content.includes('được trình Phó GĐ phụ trách xem'))).toBe(true);
  });

  it('TC-TF-08: PGD «Trả về TP/PP» kèm ý kiến ⇒ lệnh sửa lãnh đạo + thông báo TP/PP', async () => {
    const ma = await taoNhiemVuCho('TF-08');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'trinh-lanh-dao',
      noiDung: 'Kính trình Phó giám đốc xem kết quả quý này',
    });
    const res = await apiPgdA.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'tra-ve-tp',
      noiDung: 'Cần bổ sung số liệu đối chiếu giữa hai bảng trước khi trình lại',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await trangThaiNhom(nhom.id)).toBe('can-sua');
    expect(res.body.data.nhom.lenh_sua_cho).toBe('lanh-dao');
    const bao = await thongBaoCua(tp.id);
    expect(bao.some((x) => x.content.includes('trả về Trưởng phòng/Phó phòng'))).toBe(true);
    // Nội dung ngắn bị chặn — tra-ve-tp cũng bắt buộc ≥ 10 ký tự.
    const ngan = await apiPgdA.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'tra-ve-tp',
      noiDung: 'sửa lại',
    });
    expect(ngan.status).toBe(400);
  });

  it('TC-TF-09: TP nộp bản của chính mình sau khi PGD trả về (file:create TP = ⏳) ⇒ về «cho-lanh-dao»', async () => {
    const ma = await taoNhiemVuCho('TF-09');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'trinh-lanh-dao',
      noiDung: 'Kính trình Phó giám đốc xem kết quả quý này',
    });
    await apiPgdA.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'tra-ve-tp',
      noiDung: 'Cần bổ sung số liệu đối chiếu giữa hai bảng trước khi trình lại',
    });
    // TP tự nộp bản của mình (không đẩy về Cán bộ) — file:create của TP mặc định ⏳.
    const res = await nopFile(apiTp, ma, DOCX, { fileId: nhom.id, moTa: 'Bản của Trưởng phòng' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.ban.version_no).toBe(2);
    expect(res.body.data.tuDong).toBe(false);
    expect(await trangThaiNhom(nhom.id)).toBe('cho-lanh-dao');
  });

  it('TC-TF-10: TP «Đẩy về Cán bộ» sau khi PGD trả về ⇒ «can-sua» + thông báo người phải sửa', async () => {
    const ma = await taoNhiemVuCho('TF-10');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'trinh-lanh-dao',
      noiDung: 'Kính trình Phó giám đốc xem kết quả quý này',
    });
    await apiPgdA.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'tra-ve-tp',
      noiDung: 'Cần bổ sung số liệu đối chiếu giữa hai bảng trước khi trình lại',
    });
    const res = await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'tra-ve-cbo',
      noiDung: 'Phòng yêu cầu bổ sung số liệu rồi nộp lại',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await trangThaiNhom(nhom.id)).toBe('can-sua');
    const bao = await thongBaoCua(nv.id);
    expect(bao.some((x) => x.content.includes('trả về để sửa'))).toBe(true);
  });

  it('TC-TF-11: TP «Hoàn thành / Duyệt» chốt «hoan-thanh» khi file:approve = ✓; đặt ⏳ ⇒ 403', async () => {
    // (a) Mặc định của TP là ✓ ⇒ chốt được: trạng thái «hoan-thanh» + dòng luồng «hoan-thanh».
    const ma = await taoNhiemVuCho('TF-11a');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    const chot = await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'hoan-thanh',
    });
    expect(chot.status, JSON.stringify(chot.body)).toBe(200);
    expect(await trangThaiNhom(nhom.id)).toBe('hoan-thanh');
    expect((await luongCuaNhom(nhom.id)).map((g) => g.hanh_dong)).toEqual(['nop', 'hoan-thanh']);
    // Trạng thái kết: verdict tiếp cũng 409.
    const sau = await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, { hanhDong: 'duyet' });
    expect(sau.status).toBe(409);

    // (b) admin đặt ⏳ ở ô «Duyệt kết quả» của Trưởng phòng ⇒ TP mất nút chốt (403), chỉ còn Trình.
    const ma2 = await taoNhiemVuCho('TF-11b');
    await datGhiDe('Trưởng phòng', 'file', 'approve', 'cho-duyet');
    const nhom2 = (await nopFile(apiNv, ma2, PDF)).body.data.nhom;
    const biChan = await apiTp.post(`/api/v1/task-files/${nhom2.id}/verdict`, {
      hanhDong: 'hoan-thanh',
    });
    expect(biChan.status).toBe(403);
    expect(biChan.body.error.message).toContain('Duyệt kết quả (file nhiệm vụ)');
    // …nhưng «Yêu cầu sửa» vẫn làm được (⏳ chỉ mất nút CHỐT, không mất quyền góp ý/trình).
    const sua = await apiTp.post(`/api/v1/task-files/${nhom2.id}/verdict`, {
      hanhDong: 'yeu-cau-sua',
      noiDung: 'Bổ sung mục kết luận rồi gửi lại',
    });
    expect(sua.status, JSON.stringify(sua.body)).toBe(200);
    expect(await trangThaiNhom(nhom2.id)).toBe('can-sua');
  });

  it('TC-TF-12: PGD «Duyệt» ⇒ «da-duyet» KHÓA — nộp tiếp 409, verdict tiếp 409, file vật lý còn nguyên', async () => {
    const ma = await taoNhiemVuCho('TF-12');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'trinh-lanh-dao',
      noiDung: 'Kính trình Phó giám đốc xem kết quả quý này',
    });
    const res = await apiPgdA.post(`/api/v1/task-files/${nhom.id}/verdict`, { hanhDong: 'duyet' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await trangThaiNhom(nhom.id)).toBe('da-duyet');
    const luong = await luongCuaNhom(nhom.id);
    expect(luong.map((g) => g.hanh_dong)).toEqual(['nop', 'trinh-lanh-dao', 'duyet']);
    // Thông báo tới người nộp + người được giao nhiệm vụ + TP/PP phòng (nv là cả hai).
    const bao = await thongBaoCua(nv.id);
    expect(bao.some((x) => x.content.includes('đã được duyệt — kết quả chốt'))).toBe(true);
    // Khóa upload: 409 dù vẫn đúng vai + đúng phòng.
    const nopTiep = await nopFile(apiNv, ma, DOCX, { fileId: nhom.id });
    expect(nopTiep.status).toBe(409);
    // Cán bộ không xoá được nhóm đã duyệt (409 trước 403 — trạng thái kết chắn trước).
    const xoa = await apiNv.del(`/api/v1/task-files/${nhom.id}`);
    expect(xoa.status).toBe(409);
  });

  it('TC-TF-13: vai không đúng 403 — Cán bộ không verdict; cán bộ phòng khác không nộp/không đọc', async () => {
    const ma = await taoNhiemVuCho('TF-13');
    const nhom = (await nopFile(apiNv, ma, PDF)).body.data.nhom;
    // Cán bộ gọi verdict ⇒ 403 (vai không nằm trong bảng verdict).
    const nvVerdict = await apiNv.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'yeu-cau-sua',
      noiDung: 'Tự ý yêu cầu sửa của chính mình',
    });
    expect(nvVerdict.status).toBe(403);
    // Cán bộ phòng B (ngoài phạm vi): không đọc được, không nộp được, không tải được.
    const doc = await apiNvNgoai.get(`/api/v1/work-items/${encodeURIComponent(ma)}/files`);
    expect(doc.status).toBe(403);
    const nop = await nopFile(apiNvNgoai, ma, PDF);
    expect(nop.status).toBe(403);
    const ban = (await docFiles(apiNv, ma))[0].bans[0];
    const tai = await apiNvNgoai.agent.get(`/api/v1/task-files/${ban.id}/download`);
    expect(tai.status).toBe(403);
    // Cán bộ phòng B cũng không góp ý được (chỉ TP/PP + PGD phụ trách + GĐ/admin).
    const gopY = await apiNvNgoai.post(`/api/v1/task-file-versions/${ban.id}/comments`, {
      noiDung: 'góp ý trái phép',
    });
    expect(gopY.status).toBe(403);
  });

  it('TC-TF-14: sai loại file / sai mimeType / quá 50 MB ⇒ 400 với câu rõ', async () => {
    const ma = await taoNhiemVuCho('TF-14');
    // .exe bị chặn theo đuôi.
    const exe = await nopFile(apiNv, ma, {
      ten: 'virus.exe',
      mime: 'application/octet-stream',
      noiDung: 'MZ',
    });
    expect(exe.status).toBe(400);
    expect(exe.body.error.message).toContain('Chỉ nhận file');
    // .svg bị chặn CÓ Ý: SVG là XML chạy được <script>, mở inline là lỗ XSS lưu trữ. Nằm cùng
    // «họ ảnh» với png/jpg nên rất dễ bị thêm vào whitelist khi mở rộng — chốt lại bằng test.
    const svg = await nopFile(apiNv, ma, {
      ten: 'hinh.svg',
      mime: 'image/svg+xml',
      noiDung: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    });
    expect(svg.status).toBe(400);
    // Đuôi .pdf nhưng mimeType lạ bị chặn theo mime.
    const mimeLai = await nopFile(apiNv, ma, {
      ten: 'tulieumao.pdf',
      mime: 'application/msword',
      noiDung: '%PDF',
    });
    expect(mimeLai.status).toBe(400);
    // Đuôi ảnh nhưng mime của Excel — cặp đuôi/mime phải khớp, kể cả ở các đuôi mới.
    const anhLai = await nopFile(apiNv, ma, {
      ten: 'khong-phai-anh.png',
      mime: 'application/vnd.ms-excel',
      noiDung: '\x89PNG',
    });
    expect(anhLai.status).toBe(400);
    // Quá 50 MB.
    const to = await nopFile(apiNv, ma, {
      ten: 'to.pdf',
      mime: 'application/pdf',
      noiDung: 'A'.repeat(50 * 1024 * 1024 + 1),
    });
    expect(to.status).toBe(400);
    expect(to.body.error.message).toContain('50 MB');
    // Không đính file nào cũng 400 (multer không có file).
    const token = await apiNv.csrfToken();
    const rong = await apiNv.agent
      .post(`/api/v1/work-items/${encodeURIComponent(ma)}/files`)
      .set('x-csrf-token', token)
      .field('moTa', '');
    expect(rong.status).toBe(400);
  });

  it('TC-TF-14b: nộp được PowerPoint / Excel / ảnh (cả đuôi Office 2003) — người dùng chốt 2026-09-03', async () => {
    for (const file of [XLSX, PPTX, XLS, PPT, PNG, JPG]) {
      const ma = await taoNhiemVuCho(`TF-14b-${file.ten}`);
      const res = await nopFile(apiNv, ma, file);
      expect(res.status, `${file.ten}: ${JSON.stringify(res.body)}`).toBe(200);
      const nhom = await docFiles(apiNv, ma);
      expect(nhom).toHaveLength(1);
      // Tên gốc giữ nguyên, kể cả tên có DẤU tiếng Việt và dấu cách (`ảnh chụp.jpg`).
      expect(nhom[0].ten_goc).toBe(file.ten);
      expect(nhom[0].bans[0].loai_mime).toBe(file.mime);
    }
  });

  it('TC-TF-14c: ẢNH mở được inline (?inline=1); Excel/PowerPoint luôn tải về dạng attachment', async () => {
    const ma = await taoNhiemVuCho('TF-14c');
    await nopFile(apiNv, ma, PNG);
    const banAnh = (await docFiles(apiNv, ma))[0].bans[0].id;
    const anhInline = await apiNv.get(`/api/v1/task-files/${banAnh}/download?inline=1`);
    expect(anhInline.status).toBe(200);
    expect(anhInline.headers['content-disposition']).toContain('inline');
    expect(anhInline.headers['content-type']).toContain('image/png');
    // Không có `?inline=1` thì vẫn là attachment — mặc định an toàn không đổi.
    const anhTai = await apiNv.get(`/api/v1/task-files/${banAnh}/download`);
    expect(anhTai.headers['content-disposition']).toContain('attachment');

    // Excel/PowerPoint KHÔNG nằm trong `MIME_XEM_INLINE` ⇒ dù xin `?inline=1` vẫn phải attachment,
    // không để trình duyệt tự quyết định làm gì với một file Office.
    const maX = await taoNhiemVuCho('TF-14c-x');
    await nopFile(apiNv, maX, XLSX);
    const banX = (await docFiles(apiNv, maX))[0].bans[0].id;
    const xin = await apiNv.get(`/api/v1/task-files/${banX}/download?inline=1`);
    expect(xin.headers['content-disposition']).toContain('attachment');
  });

  it('TC-TF-15: TRƯỞNG PHÒNG sửa được nhiệm vụ do Cán bộ tạo (phân quyền §6) + editor mode', async () => {
    // NV tạo nhiệm vụ trong công việc của phòng A — nhiệm vụ auto «Đã duyệt».
    const cv = await apiTp.post('/api/v1/works', {
      name: 'Việc phòng A — TF-15',
      departmentId: phongA.id,
    });
    const work = cv.body.data.work;
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    // Nhiệm vụ phải nằm DƯỚI công việc con: luật `validTaskLeaders` chỉ cho ô «Lãnh đạo phòng phụ
    // trách» của nhiệm vụ chọn trong `leader_ids` của CV con; nhiệm vụ treo thẳng vào công việc cha
    // thì nguồn hợp lệ là Phó GĐ phụ trách phòng — TP sẽ bị 400 LEADER_NOT_IN_SOURCE.
    const con = await apiTp.post('/api/v1/work-items', {
      workRef: work.code,
      level: 2,
      name: 'Công việc con — TF-15',
      leaderIds: [tp.id],
    });
    const conCode = con.body.data.item.code;
    await apiPgdA.post(`/api/v1/approvals/work-item/${conCode}/approve`);
    const tao = await apiNv.post('/api/v1/work-items', {
      workRef: work.code,
      level: 3,
      parentRef: conCode,
      name: 'Nhiệm vụ của Cán bộ — TF-15',
      assigneeId: nv.id,
    });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);
    const ma = tao.body.data.item.code;
    // ⭐ TP (không phải người lập) SỬA được nhiệm vụ trong phòng mình — lỗi người dùng báo 2026-09-01.
    // Nhân đó gán luôn ô «Lãnh đạo phòng phụ trách» = chính TP: nhiệm vụ do Cán bộ tạo mặc định
    // KHÔNG có `leader_ids`, mà luật siết 2026-09-02 đòi có tên mới cho TP xem/sửa file.
    const sua = await apiTp.patch(`/api/v1/work-items/${encodeURIComponent(ma)}`, {
      name: 'Nhiệm vụ của Cán bộ — TF-15 (đã sửa bởi TP)',
      notes: 'TP chỉnh mô tả yêu cầu',
      leaderIds: [tp.id],
    });
    expect(sua.status, JSON.stringify(sua.body)).toBe(200);
    expect(sua.body.data.item.name).toContain('đã sửa bởi TP');
    // Editor: Cán bộ (người được giao) + TP = mode edit; NGOÀI PHÒNG bị 403 ngay ở can(read,'task');
    // nhóm đã chốt (da-duyet) thì mọi người chỉ XEM.
    await nopFile(apiNv, ma, PDF);
    const nhom = (await docFiles(apiNv, ma))[0];
    const banDau = nhom.bans[0].id;
    const nvTrang = await apiNv.get(`/api/v1/task-file-versions/${banDau}/editor`);
    expect(nvTrang.status).toBe(200);
    expect(nvTrang.text).toContain('"mode":"edit"');
    const trangTp = await apiTp.get(`/api/v1/task-file-versions/${banDau}/editor`);
    expect(trangTp.status).toBe(200);
    expect(trangTp.text).toContain('"mode":"edit"');
    // Ngoài phạm vi phòng: KHÔNG mở được editor (403) — rào chặn của can(read,'task').
    const trangNgoai = await apiNvNgoai.get(`/api/v1/task-file-versions/${banDau}/editor`);
    expect(trangNgoai.status).toBe(403);
    // Kết quả đã chốt ⇒ chỉ XEM, kể cả TP.
    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, { hanhDong: 'hoan-thanh' });
    const sauChot = await apiTp.get(`/api/v1/task-file-versions/${banDau}/editor`);
    expect(sauChot.status).toBe(200);
    expect(sauChot.text).toContain('"mode":"view"');
  });

  it('TC-TF-16: trang editor NỚI CSP cho origin Document Server (thiếu = màn hình trắng)', async () => {
    // Lỗi người dùng báo 2026-09-02 «không thấy màn hình sửa». Gốc: `helmet()` đặt
    // `script-src 'self'` cho MỌI phản hồi, mà trang editor bắt buộc nạp `api.js` từ origin của
    // DS ⇒ trình duyệt chặn thẻ script ⇒ `DocsAPI` không tồn tại ⇒ trang TRẮNG, không một dòng lỗi
    // nào trên giao diện (chỉ hiện ở tab Console). Test này canh đúng cái header đó.
    const ma = await taoNhiemVuCho('TF-16');
    await nopFile(apiNv, ma, DOCX);
    const nhom = (await docFiles(apiNv, ma))[0];
    const ban = nhom.bans[0].id;

    const trang = await apiNv.get(`/api/v1/task-file-versions/${ban}/editor`);
    expect(trang.status).toBe(200);

    const ds = env.ONLYOFFICE_URL.replace(/\/$/, '');
    const csp = trang.headers['content-security-policy'] ?? '';
    const phan = (ten) =>
      csp
        .split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${ten} `)) ?? '';
    // Thẻ <script src> trỏ về DS, và script-src phải cho phép chính origin đó.
    expect(trang.text).toContain(`${ds}/web-apps/apps/api/documents/api.js`);
    expect(phan('script-src')).toContain(ds);
    // DocEditor dựng iframe trỏ DS + giữ WebSocket ⇒ thiếu hai dòng này là khung editor trắng.
    expect(phan('frame-src')).toContain(ds);
    expect(phan('connect-src')).toContain(ds);
    // Không để helmet chặn tài nguyên khác origin của riêng trang này.
    expect(trang.headers['cross-origin-embedder-policy']).toBeUndefined();
    expect(trang.headers['cross-origin-resource-policy']).toBe('cross-origin');
    // Phải có đường BÁO LỖI ĐỌC ĐƯỢC, không im lặng trắng như trước.
    expect(trang.text).toContain('Không mở được trình chỉnh sửa');
    expect(trang.text).toContain('onerror=');
    expect(trang.text).toContain('onAppReady');
    // `documentType` theo ĐUÔI, không ghi cứng 'word' — seed có cả .pdf.
    expect(trang.text).toContain('"documentType":"word"');
    const pdfMa = await taoNhiemVuCho('TF-16b');
    await nopFile(apiNv, pdfMa, PDF);
    const banPdf = (await docFiles(apiNv, pdfMa))[0].bans[0].id;
    const trangPdf = await apiNv.get(`/api/v1/task-file-versions/${banPdf}/editor`);
    expect(trangPdf.text).toContain('"documentType":"pdf"');
    expect(trangPdf.text).toContain('"fileType":"pdf"');
  });

  it('TC-TF-16b: editor mở Excel (cell) + PowerPoint (slide); ẢNH thì 400 với câu rõ', async () => {
    // Người dùng chốt 2026-09-03: bật ✎ sửa trực tuyến cho Excel và PowerPoint. DS chọn bộ soạn
    // thảo theo `documentType` nên gán sai là editor lỗi ngay — chốt cả bốn đuôi bằng test.
    for (const [file, loai] of [
      [XLSX, 'cell'],
      [XLS, 'cell'],
      [PPTX, 'slide'],
      [PPT, 'slide'],
    ]) {
      const ma = await taoNhiemVuCho(`TF-16b-${file.ten}`);
      await nopFile(apiNv, ma, file);
      const ban = (await docFiles(apiNv, ma))[0].bans[0].id;
      const trang = await apiNv.get(`/api/v1/task-file-versions/${ban}/editor`);
      expect(trang.status, `${file.ten}: ${trang.text?.slice(0, 200)}`).toBe(200);
      expect(trang.text).toContain(`"documentType":"${loai}"`);
    }
    // ẢNH: DS không có bộ soạn thảo nào. Trước đây `?? 'word'` biến mọi đuôi lạ thành Word ⇒ mở ra
    // một trang editor lỗi không ai hiểu; nay phải là 400 với câu đọc được.
    const maAnh = await taoNhiemVuCho('TF-16b-anh');
    await nopFile(apiNv, maAnh, PNG);
    const banAnh = (await docFiles(apiNv, maAnh))[0].bans[0].id;
    const trangAnh = await apiNv.get(`/api/v1/task-file-versions/${banAnh}/editor`);
    expect(trangAnh.status).toBe(400);
    expect(trangAnh.body.error.message).toContain('Không sửa trực tuyến được');
  });

  it('TC-TF-17: /raw thiếu file trên đĩa ⇒ 404 gọn, KHÔNG làm sập máy chủ', async () => {
    // Bẫy thật 2026-09-02: `createReadStream(duong).pipe(res)` với đường dẫn không tồn tại phát
    // sự kiện 'error' KHÔNG AI BẮT ⇒ Node ném «Unhandled error event» và CẢ TIẾN TRÌNH CHẾT. Triệu
    // chứng ở người dùng vẫn là «không mở được màn hình sửa» — thực ra máy chủ vừa sập nên mọi thứ
    // khác chết theo. Xảy ra ngay khi DS đòi bản của bộ seed (seed chỉ tạo dòng CSDL, không có file).
    const ma = await taoNhiemVuCho('TF-17');
    await nopFile(apiNv, ma, DOCX);
    const nhom = (await docFiles(apiNv, ma))[0];
    const ban = nhom.bans[0].id;

    // Xoá file vật lý, GIỮ dòng CSDL — đúng trạng thái của bộ seed.
    const { rows } = await pool.query(
      `SELECT v.ten_luu, f.item_id FROM task_file_versions v
         JOIN task_files f ON f.id = v.file_id WHERE v.id = $1`,
      [ban]
    );
    await rm(duongBan(rows[0].item_id, rows[0].ten_luu), { force: true });

    const r = await apiNv.agent.get(
      `/api/v1/task-files-ds/raw/${ban}?token=${encodeURIComponent(tokenDs('raw', ban))}`
    );
    expect(r.status).toBe(404);
    // Máy chủ CÒN SỐNG — chốt chính của ca này. `/healthz` là đường công khai không tham số, nên
    // nó chỉ đỏ khi tiến trình thật sự chết (đường nghiệp vụ có thể 400 vì thiếu tham số).
    const sau = await apiNv.agent.get('/healthz');
    expect(sau.status).toBe(200);
    expect(sau.body.ok).toBe(true);
  });

  it('TC-TF-18: callback của DS trả ĐÚNG {"error":0} ở cấp cao nhất (sai = hộp «Không thể lưu tài liệu»)', async () => {
    // Lỗi người dùng báo 2026-09-02 kèm ảnh: sửa xong bấm lưu thì DS hiện «Không thể lưu tài liệu.
    // Vui lòng kiểm tra cài đặt kết nối hoặc liên hệ với quản trị viên của bạn.» Gốc: route callback
    // trả qua `ok()` của §5.3 ⇒ `{"ok":true,"data":{"error":0}}`. Hợp đồng của DS đòi khoá `error`
    // ở CẤP CAO NHẤT, nó không thấy nên coi là lưu thất bại — log của DS ghi nguyên văn:
    //   sendServerRequest returned an error: data = {"ok":true,"data":{"error":0,...}}
    // Bản mới VẪN được lưu nên «Lịch sử» có bản mới, càng khó lần ra. Ca này canh HÌNH DẠNG phản hồi.
    const ma = await taoNhiemVuCho('TF-18');
    await nopFile(apiNv, ma, DOCX);
    const nhom = (await docFiles(apiNv, ma))[0];
    const ban = nhom.bans[0].id;
    const duong = `/api/v1/task-files-ds/callback/${ban}?token=${encodeURIComponent(tokenDs('callback', ban))}`;

    // status=1 (đang cùng sửa) — không có `url`, chỉ cần xác nhận đã nhận.
    const r1 = await apiNv.agent.post(duong).send({ status: 1 });
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ error: 0 });
    expect(r1.body.ok).toBeUndefined();

    // status=2 nhưng `url` rác ⇒ vẫn 200 với `error: 1` (DS đọc mã này để gọi lại), KHÔNG phải §5.3.
    const r2 = await apiNv.agent.post(duong).send({ status: 2, url: 'khong-phai-url' });
    expect(r2.status).toBe(200);
    expect(r2.body.error).toBe(1);
    expect(typeof r2.body.message).toBe('string');

    // Token sai ⇒ vẫn 200 + error:1 (đường máy-đối-máy không trả thân lỗi §5.3 cho DS).
    const r3 = await apiNv.agent
      .post(`/api/v1/task-files-ds/callback/${ban}?token=sai`)
      .send({ status: 2, url: 'http://localhost/x.docx' });
    expect(r3.status).toBe(200);
    expect(r3.body.error).toBe(1);
  });

  it('TC-TF-19: tên file có DẤU TIẾNG VIỆT giữ nguyên (busboy giải latin1 làm hỏng)', async () => {
    // Người dùng báo 2026-09-02: «Tên file đang hiển thị lỗi tiếng việt». Trình duyệt gửi filename
    // dạng UTF-8 trong Content-Disposition của multipart, busboy giải bằng latin1 ⇒ `BÀI 2.docx`
    // thành `BÃ€I 2.docx`. Tên sai hiện ở khối «Kết quả», tiêu đề trang editor và trong thông báo.
    //
    // Ca này đi ĐÚNG đường thật: gửi tên có dấu qua FormData như trình duyệt, rồi đọc lại từ CSDL.
    // Chính busboy trong máy chủ này làm hỏng, nên nếu `tenGocUtf8` không gỡ được thì đỏ ngay.
    const ma = await taoNhiemVuCho('TF-19');
    const tenThat = 'Báo cáo KẾT QUẢ — Đợt 1 (bản chính).docx';
    const res = await nopFile(apiNv, ma, { ...DOCX, ten: tenThat });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const nhom = (await docFiles(apiNv, ma))[0];
    expect(nhom.ten_goc).toBe(tenThat);
    expect(nhom.bans[0].ten_goc).toBe(tenThat);

    // Ba lớp canh của chính hàm gỡ: chuỗi latin1-hỏng gỡ được; chuỗi ĐÃ ĐÚNG giữ nguyên (có ký tự
    // ngoài latin1); chuỗi ASCII không đụng tới. Thiếu hai lớp sau là làm hỏng tên vốn đang đúng.
    expect(tenGocUtf8(Buffer.from(tenThat, 'utf8').toString('latin1'))).toBe(tenThat);
    expect(tenGocUtf8(tenThat)).toBe(tenThat);
    expect(tenGocUtf8('ket-qua-ascii.docx')).toBe('ket-qua-ascii.docx');

    // Tên ASCII đi qua đường thật cũng không được đổi.
    const ma2 = await taoNhiemVuCho('TF-19b');
    const res2 = await nopFile(apiNv, ma2, { ...DOCX, ten: 'ket-qua-ascii.docx' });
    expect(res2.status).toBe(200);
    expect((await docFiles(apiNv, ma2))[0].ten_goc).toBe('ket-qua-ascii.docx');
  });
});

describe('TC-LS — lệnh sửa đúng chủ, không làm mất file', () => {
  async function taoLenh(cho = 'can-bo') {
    const ma = await taoNhiemVuCho('Lenh sua');
    const { nhom, ban } = (await nopFile(apiNv, ma, DOCX)).body.data;
    if (cho === 'lanh-dao') {
      await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
        hanhDong: 'trinh-lanh-dao',
        noiDung: 'Trình lãnh đạo xem kết quả',
      });
    }
    const res = await (cho === 'can-bo' ? apiTp : apiPgdA).post(
      `/api/v1/task-files/${nhom.id}/verdict`,
      {
        hanhDong: cho === 'can-bo' ? 'yeu-cau-sua' : 'tra-ve-tp',
        noiDung: 'Bổ sung số liệu đối chiếu trước khi gửi lại',
      }
    );
    expect(res.status).toBe(200);
    return { ma, nhom, ban };
  }

  it('TC-LS-01: cán bộ chỉ thấy lệnh của mình, lưu tạm không chuyển cửa', async () => {
    expect((await apiNv.get('/api/v1/task-files/lenh-sua')).body.data.items).toEqual([]);
    const { nhom } = await taoLenh();
    const res = await apiNv.get('/api/v1/task-files/lenh-sua');
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      id: nhom.id,
      lenh_sua_cho: 'can-bo',
      lenh_sua_ly_do: 'Bổ sung số liệu đối chiếu trước khi gửi lại',
      duocGui: true,
    });
    expect((await apiNv.get('/api/v1/task-files/cho-duyet')).body.data.items).toEqual([]);
    expect((await apiNvNgoai.get('/api/v1/task-files/lenh-sua')).body.data.items).toEqual([]);
    expect((await apiTp.get('/api/v1/task-files/lenh-sua')).body.data.items).toEqual([]);
    const luu = await apiNv.patch(`/api/v1/task-files/${nhom.id}/luu-tam`, {
      ghiChu: 'Đang đối chiếu',
    });
    expect(luu.status).toBe(200);
    expect(luu.body.data.nhom).toMatchObject({
      trang_thai: 'can-sua',
      lenh_sua_ghi_chu: 'Đang đối chiếu',
    });
    expect((await apiNv.patch(`/api/v1/task-files/${nhom.id}/luu-tam`, {})).status).toBe(400);
  });

  it('TC-LS-02: gửi lại dùng bản mới nhất, xóa lệnh, thông báo TP và chặn gửi lặp', async () => {
    const { nhom, ban } = await taoLenh();
    const res = await apiNv.post(`/api/v1/task-files/${nhom.id}/gui-ban-moi`, {
      noiDung: 'Đã đối chiếu',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.ban.id).toBe(ban.id);
    expect(res.body.data.nhom).toMatchObject({
      trang_thai: 'cho-xem',
      lenh_sua_cho: null,
      lenh_sua_ly_do: '',
      lenh_sua_ghi_chu: '',
    });
    expect((await apiNv.get('/api/v1/task-files/lenh-sua')).body.data.items).toEqual([]);
    expect((await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(1);
    expect((await thongBaoCua(tp.id)).at(-1).type).toBe('approval_pending');
    expect((await luongCuaNhom(nhom.id)).at(-1)).toMatchObject({
      hanh_dong: 'nop',
      version_no: 1,
      noi_dung: 'Gửi bản mới nhất — Đã đối chiếu',
    });
    expect((await apiNv.post(`/api/v1/task-files/${nhom.id}/gui-ban-moi`)).status).toBe(409);
  });

  it.each(['can-bo', 'lanh-dao'])(
    'TC-LS-03: hủy lệnh %s giữ file và báo đúng người ra lệnh',
    async (cho) => {
      const { nhom, ban } = await taoLenh(cho);
      const api = cho === 'can-bo' ? apiNv : apiTp;
      const res = await api.post(`/api/v1/task-files/${nhom.id}/huy-lenh-sua`);
      expect(res.status).toBe(200);
      expect(res.body.data.nhom).toMatchObject({
        trang_thai: cho === 'can-bo' ? 'cho-xem' : 'cho-lanh-dao',
        lenh_sua_cho: null,
        lenh_sua_ly_do: '',
        lenh_sua_ghi_chu: '',
      });
      expect((await api.get(`/api/v1/task-files/${ban.id}/download`)).status).toBe(200);
      expect((await luongCuaNhom(nhom.id)).at(-1).hanh_dong).toBe('huy-lenh-sua');
      expect((await thongBaoCua(cho === 'can-bo' ? tp.id : pgdA.id)).at(-1).type).toBe(
        'approval_rejected'
      );
    }
  );

  it.each(['cho-duyet', 'cho-phep'])(
    'TC-LS-04: TP nhận lệnh riêng và gửi theo quyền %s',
    async (quyen) => {
      const { nhom } = await taoLenh('lanh-dao');
      expect((await apiTp.get('/api/v1/task-files/lenh-sua')).body.data.items).toHaveLength(1);
      expect((await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items).toEqual([]);
      expect((await apiNv.get('/api/v1/task-files/lenh-sua')).body.data.items).toEqual([]);
      expect((await apiPgdA.get('/api/v1/task-files/lenh-sua')).body.data.items).toEqual([]);
      expect((await apiAdmin.get('/api/v1/task-files/lenh-sua')).body.data.items).toEqual([]);
      await datGhiDe('Trưởng phòng', 'file', 'create', quyen);
      const res = await apiTp.post(`/api/v1/task-files/${nhom.id}/gui-ban-moi`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.nhom.trang_thai).toBe(
        quyen === 'cho-phep' ? 'da-duyet' : 'cho-lanh-dao'
      );
      expect(res.body.data.nhom.lenh_sua_cho).toBeNull();
    }
  );

  it('TC-LS-05: cán bộ không xử lệnh TP; ngoài phòng và người cùng phòng không phải chủ bị chặn', async () => {
    const { ma, nhom } = await taoLenh('lanh-dao');
    for (const api of [apiNv, apiNvNgoai, apiAdmin]) {
      for (const action of ['gui-ban-moi', 'huy-lenh-sua']) {
        expect((await api.post(`/api/v1/task-files/${nhom.id}/${action}`)).status).toBe(403);
      }
      expect(
        (await api.patch(`/api/v1/task-files/${nhom.id}/luu-tam`, { ghiChu: 'Không phải chủ' }))
          .status
      ).toBe(403);
    }
    expect((await nopFile(apiNv, ma, DOCX, { fileId: nhom.id })).status).toBe(403);
    await datGhiDe('Trưởng phòng', 'file', 'create', 'tu-choi');
    expect((await apiTp.post(`/api/v1/task-files/${nhom.id}/gui-ban-moi`)).status).toBe(403);
  });

  it('TC-LS-06: callback chỉ lưu; sau đó gửi đúng bản vừa lưu', async () => {
    const { ma, nhom, ban } = await taoLenh();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('ban da sua')),
    });
    try {
      const res = await apiNv.agent
        .post(`/api/v1/task-files-ds/callback/${ban.id}?token=${tokenDs('callback', ban.id)}`)
        .send({ status: 6, users: [String(nv.id)], url: 'http://onlyoffice.test/edited.docx' });
      expect(res.body).toEqual({ error: 0 });
    } finally {
      fetchMock.mockRestore();
    }
    expect(await trangThaiNhom(nhom.id)).toBe('can-sua');
    const bans = (await docFiles(apiNv, ma))[0].bans;
    expect(bans).toHaveLength(2);
    const gui = await apiNv.post(`/api/v1/task-files/${nhom.id}/gui-ban-moi`);
    expect(gui.status).toBe(200);
    expect(gui.body.data.ban.id).toBe(bans[1].id);
  });

  it('TC-LS-08: save xác nhận đúng callback trước khi báo đã lưu, không tự gửi', async () => {
    const { nhom, ban } = await taoLenh();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).endsWith('/command')) {
        const command = JSON.parse(options.body);
        const callback = await apiNv.agent
          .post(`/api/v1/task-files-ds/callback/${ban.id}?token=${tokenDs('callback', ban.id)}`)
          .send({
            status: 6,
            users: [String(tp.id)],
            userdata: command.userdata,
            url: 'http://onlyoffice.test/edited.docx',
          });
        expect(callback.body).toEqual({ error: 0 });
        return { ok: true, json: () => Promise.resolve({ error: 0 }) };
      }
      return { ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('noi dung sau khi sua')) };
    });
    try {
      const res = await apiNv.post(`/api/v1/task-file-versions/${ban.id}/save`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data).toMatchObject({ daLuu: true, versionNo: 2 });
      const stored = await pool.query('SELECT uploaded_by FROM task_file_versions WHERE id = $1', [
        res.body.data.banId,
      ]);
      expect(Number(stored.rows[0].uploaded_by)).toBe(Number(nv.id));
      expect(await trangThaiNhom(nhom.id)).toBe('can-sua');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it.each([4, 3, null])('TC-LS-09: save mã %s không xác nhận đã lưu nhầm', async (maLoi) => {
    const { ban } = await taoLenh();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(maLoi === null ? {} : { error: maLoi }),
    });
    try {
      const res = await apiNv.post(`/api/v1/task-file-versions/${ban.id}/save`);
      expect(res.status).toBe(maLoi === 4 ? 200 : 400);
      if (maLoi === 4) expect(res.body.data.daLuu).toBe(false);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('TC-LS-10: migration 020 down/up có dữ liệu hủy lệnh, backfill lý do, giữ bản file', async () => {
    const { nhom } = await taoLenh();
    await apiNv.post(`/api/v1/task-files/${nhom.id}/huy-lenh-sua`);
    const sql = readFileSync(
      new URL('../../src/db/migrations/020_task_file_lenh_sua.sql', import.meta.url),
      'utf8'
    );
    const [up, down] = sql.split('-- Up Migration')[1].split('-- Down Migration');
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const bans = (await db.query('SELECT * FROM task_file_versions ORDER BY id')).rows;
      await db.query(down);
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM task_file_flow WHERE hanh_dong = 'huy-lenh-sua'"
          )
        ).rows[0].n
      ).toBe(0);
      await db.query("UPDATE task_files SET trang_thai = 'can-sua' WHERE id = $1", [nhom.id]);
      await db.query(up);
      expect(
        (
          await db.query('SELECT lenh_sua_cho, lenh_sua_ly_do FROM task_files WHERE id = $1', [
            nhom.id,
          ])
        ).rows[0]
      ).toEqual({
        lenh_sua_cho: 'can-bo',
        lenh_sua_ly_do: 'Bổ sung số liệu đối chiếu trước khi gửi lại',
      });
      expect((await db.query('SELECT * FROM task_file_versions ORDER BY id')).rows).toEqual(bans);
    } finally {
      await db.query('ROLLBACK');
      db.release();
    }
  });

  it('TC-LS-07: chưa có bản thì 409; không cần tạo file mới để hủy lệnh', async () => {
    const ma = await taoNhiemVuCho('Chưa có bản');
    const res = await apiNv.post(`/api/v1/work-items/${ma}/results`, { tenKetQua: 'Chờ bổ sung' });
    const nhom = res.body.data.nhom;
    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'yeu-cau-sua',
      noiDung: 'Bổ sung file kết quả trước khi gửi',
    });
    expect((await apiNv.post(`/api/v1/task-files/${nhom.id}/gui-ban-moi`)).status).toBe(409);
    expect((await apiNv.post(`/api/v1/task-files/${nhom.id}/huy-lenh-sua`)).status).toBe(200);
  });
});

describe('TC-HCPD — hàng chờ phê duyệt KẾT QUẢ (tab con thứ hai, 2026-09-02)', () => {
  it('TC-HCPD-01: TP thấy «cho-xem»/«can-sua» của PHÒNG MÌNH, kèm nút đúng vai; phòng khác KHÔNG thấy', async () => {
    const ma = await taoNhiemVuCho('HCPD-01');
    await nopFile(apiNv, ma, DOCX);

    const res = await apiTp.get('/api/v1/task-files/cho-duyet');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const items = res.body.data.items;
    expect(items).toHaveLength(1);
    const dong = items[0];
    // Đủ thông tin để quyết định mà KHÔNG phải mở nhiệm vụ: tên nhiệm vụ + mã + phòng + bản cuối.
    expect(dong.ma_nhiem_vu).toBe(ma);
    expect(dong.ten_nhiem_vu).toContain('HCPD-01');
    expect(dong.ten_phong).toBe('Phòng Kỹ thuật');
    expect(dong.trang_thai).toBe('cho-xem');
    expect(dong.ban_cuoi_so).toBe(1);
    expect(dong.ban_cuoi_nguoi).toBe('Nguyễn Văn Cán Bộ');
    // 2026-09-04: cột 1 của hàng chờ ghi tên kết quả ở dòng trên và TÊN FILE của bản mới nhất ở
    // dòng dưới, nên máy chủ phải trả tên bản — hai thứ lệch nhau ngay khi ai đó nộp bản mới bằng
    // file tên khác.
    expect(dong.ban_cuoi_ten).toBe('ket-qua.docx');
    // Nút của TP ở «cho-xem»: 3 hành động, KHÔNG có 'duyet' (đó là cửa của PGD).
    const ma3 = dong.hanhDong.map((h) => h.ma).sort();
    expect(ma3).toEqual(['hoan-thanh', 'tra-ve-cbo', 'trinh-lanh-dao', 'yeu-cau-sua'].sort());
    expect(dong.hanhDong.find((h) => h.ma === 'yeu-cau-sua').canNoiDung).toBe(true);
    expect(dong.hanhDong.find((h) => h.ma === 'hoan-thanh').canNoiDung).toBe(false);

    // Cán bộ (không có cửa duyệt nào) và người phòng khác: danh sách RỖNG.
    expect((await apiNv.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
    expect((await apiNvNgoai.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
  });

  it('TC-HCPD-02: PGD chỉ thấy «cho-lanh-dao» của phòng mình PHỤ TRÁCH; TP không thấy dòng đó nữa', async () => {
    const ma = await taoNhiemVuCho('HCPD-02');
    await nopFile(apiNv, ma, DOCX);
    const nhom = (await docFiles(apiTp, ma))[0];

    // Trước khi trình: PGD chưa thấy gì, TP thấy 1 dòng.
    expect((await apiPgdA.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
    expect((await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(1);

    await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'trinh-lanh-dao',
      noiDung: 'Kính trình Phó giám đốc xem xét',
    });

    // Sau khi trình: dòng chuyển sang hàng chờ của PGD, biến khỏi hàng chờ của TP.
    const cuaPgd = (await apiPgdA.get('/api/v1/task-files/cho-duyet')).body.data.items;
    expect(cuaPgd).toHaveLength(1);
    expect(cuaPgd[0].trang_thai).toBe('cho-lanh-dao');
    expect(cuaPgd[0].hanhDong.map((h) => h.ma).sort()).toEqual(['duyet', 'tra-ve-tp']);
    expect((await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
  });

  it('TC-HCPD-03: file đã chốt KHÔNG còn trong hàng chờ của ai; admin đặt ⏳ ⇒ TP mất nút chốt', async () => {
    const ma = await taoNhiemVuCho('HCPD-03');
    await nopFile(apiNv, ma, DOCX);
    const nhom = (await docFiles(apiTp, ma))[0];

    // ⏳ ở «Duyệt kết quả» của Trưởng phòng ⇒ hàng chờ KHÔNG được mời họ bấm nút chốt nữa.
    await datGhiDe('Trưởng phòng', 'file', 'approve', 'cho-duyet');
    const sauGhiDe = (await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items[0];
    expect(sauGhiDe.hanhDong.map((h) => h.ma)).not.toContain('hoan-thanh');
    expect(sauGhiDe.hanhDong.map((h) => h.ma)).toContain('trinh-lanh-dao');

    // Trả ⏳ về ✓ rồi chốt: dòng phải rời khỏi hàng chờ của mọi người.
    await datGhiDe('Trưởng phòng', 'file', 'approve', 'cho-phep');
    const chot = await apiTp.post(`/api/v1/task-files/${nhom.id}/verdict`, {
      hanhDong: 'hoan-thanh',
    });
    expect(chot.status, JSON.stringify(chot.body)).toBe(200);
    expect((await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
    expect((await apiPgdA.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
    // admin thấy cả ba trạng thái đang treo — cũng phải rỗng vì file đã chốt.
    expect((await apiAdmin.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
  });

  it('TC-HCPD-04: nộp file ⇒ LÃNH ĐẠO PHÒNG PHỤ TRÁCH nhận thông báo, kể cả người gắn ở department_managers', async () => {
    // Người dùng chốt 2026-09-02: «Lãnh đạo phòng phụ trách của nhiệm vụ đấy sẽ là người
    // xem/sửa/duyệt, đồng thời nhận được thông báo». Người được GẮN phụ trách phòng ('head') mà
    // vai không phải TP/PP thì trước đây không hề biết có file mới — chỉ đọc `users` là mất họ.
    const quanLy = await makeLoginUser({
      code: 'NV040',
      full_name: 'Đỗ Thị Phụ Trách',
      email: 'ql-a@test.local',
      role: 'Phó phòng',
      department_id: phongA.id,
    });
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role) VALUES ($1, $2, 'head')`,
      [phongA.id, quanLy.id]
    );

    const ma = await taoNhiemVuCho('HCPD-04', {
      leaderIdsCon: [tp.id, quanLy.id],
      leaderIdsNv: [quanLy.id],
    });
    // Ô «Lãnh đạo phòng phụ trách» của nhiệm vụ = người được GẮN ở `department_managers` (luật siết:
    // chỉ ai có tên ở đây mới xử được file ⇒ người nhận thông báo cũng đúng danh sách này). Cấp 3
    // chỉ nhận MỘT id (CHECK `task_leader_single`) nên gán thẳng từ lúc tạo, không PATCH sau.
    await nopFile(apiNv, ma, DOCX);

    // Người được gắn phụ trách ở `department_managers` VÀ đứng tên ô lãnh đạo của nhiệm vụ: có báo.
    const cuaQuanLy = (await thongBaoCua(quanLy.id)).filter((t) => t.ref_type === 'task_file');
    expect(cuaQuanLy.some((t) => t.content.includes('HCPD-04'))).toBe(true);
    // Trưởng phòng KHÔNG còn đứng tên nhiệm vụ này ⇒ không nhận báo VỀ FILE (đúng ý người dùng).
    // Lọc theo `ref_type`: TP vẫn có thông báo duyệt cây công việc cùng tên, đó là chiều khác.
    const cuaTp = (await thongBaoCua(tp.id)).filter((t) => t.ref_type === 'task_file');
    expect(cuaTp.some((t) => t.content.includes('HCPD-04'))).toBe(false);
  });
});

/**
 * ĐỢT 2 của thiết kế lại theo `docs/moi.xlsx` (016_ket_qua_khai_truoc.sql):
 *   • KHAI dòng kết quả TRƯỚC khi có file (nút ＋) ⇒ nhóm 0 bản, cột «File đã tải lên» = «Chưa có».
 *   • «Báo cáo» = kết quả nhập CHỮ, lưu như một BẢN KHÔNG CÓ FILE (người dùng chốt: «như một BẢN
 *     không có file») ⇒ dùng lại nguyên bộ máy bản/góp ý/luồng/verdict.
 * Hai điều phải canh chặt: nhóm 0 bản KHÔNG được vào hàng chờ phê duyệt, và bản chữ KHÔNG được đi
 * qua các cửa đòi file (tải về / ONLYOFFICE) — nếu không là 500 hoặc trang editor lỗi.
 */
describe('TC-KQ2 — khai kết quả trước + «Báo cáo» là bản không có file (016)', () => {
  /** Nút ＋ của khối «Kết quả» — JSON, không multipart. */
  const khai = (api, ref, body) =>
    api.post(`/api/v1/work-items/${encodeURIComponent(ref)}/results`, body);
  /** Nộp «Báo cáo» — nội dung là chữ; `fileId` có = thêm bản vào nhóm đã khai. */
  const nopBaoCao = (api, ref, body) =>
    api.post(`/api/v1/work-items/${encodeURIComponent(ref)}/reports`, body);

  it('TC-KQ2-01: Cán bộ khai dòng kết quả (tên + định dạng + ý kiến) ⇒ nhóm 0 BẢN, «cho-xem», có dòng luồng', async () => {
    const ma = await taoNhiemVuCho('KQ2-01');
    const res = await khai(apiNv, ma, {
      tenKetQua: 'Báo cáo tổng kết quý 3',
      dinhDang: 'Word',
      yKien: 'Sẽ nộp bản Word trước ngày 20',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const nhom = res.body.data.nhom;
    expect(res.body.data.ban).toBeNull();
    expect(res.body.data.tuDong).toBe(false);
    expect(nhom.ten_ket_qua).toBe('Báo cáo tổng kết quý 3');
    expect(nhom.dinh_dang).toBe('Word');
    expect(nhom.trang_thai).toBe('cho-xem');

    // 0 bản: chính là dòng «Chưa có» ở cột 4 của bảng kết quả.
    const doc = await docFiles(apiNv, ma);
    expect(doc).toHaveLength(1);
    expect(doc[0].bans).toHaveLength(0);
    expect(doc[0].ten_ket_qua).toBe('Báo cáo tổng kết quý 3');
    expect(doc[0].laBaoCao).toBe(false);

    // Ý kiến khai kèm đi vào BẢNG LUỒNG (`version_id` NULL) — bảng góp ý gắn theo BẢN mà ở đây
    // chưa có bản nào.
    const luong = await luongCuaNhom(nhom.id);
    expect(luong).toHaveLength(1);
    expect(luong[0].hanh_dong).toBe('nop');
    expect(luong[0].version_no).toBeNull();
    expect(luong[0].noi_dung).toBe('Sẽ nộp bản Word trước ngày 20');
  });

  it('TC-KQ2-02: nhóm 0 bản KHÔNG vào hàng chờ phê duyệt; nộp file bản đầu thì mới xuất hiện', async () => {
    const ma = await taoNhiemVuCho('KQ2-02');
    const nhom = (await khai(apiNv, ma, { tenKetQua: 'Bảng số liệu', dinhDang: 'Excel' })).body.data
      .nhom;

    // Chưa có gì để duyệt thì đừng bắt ai duyệt — hiện ra chỉ là dòng không bấm được nút nào.
    expect((await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
    expect((await apiAdmin.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);

    const nop = await nopFile(apiNv, ma, XLSX, { fileId: nhom.id });
    expect(nop.status, JSON.stringify(nop.body)).toBe(200);
    // Vẫn ĐÚNG MỘT nhóm: file nộp vào nhóm đã khai, không mở nhóm thứ hai.
    const doc = await docFiles(apiNv, ma);
    expect(doc).toHaveLength(1);
    expect(doc[0].bans).toHaveLength(1);
    expect(doc[0].ten_ket_qua).toBe('Bảng số liệu');

    const hangCho = (await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items;
    expect(hangCho).toHaveLength(1);
    // Cột 1: dòng trên là TÊN KẾT QUẢ đã khai, dòng dưới là TÊN FILE của bản mới nhất — hai thứ
    // khác nhau hẳn, đây là lý do 016 phải có cột `ten_ket_qua` riêng.
    expect(hangCho[0].ten_ket_qua).toBe('Bảng số liệu');
    expect(hangCho[0].ban_cuoi_ten).toBe('bang-tong-hop.xlsx');
    expect(hangCho[0].laBaoCao).toBe(false);
  });

  it('TC-KQ2-03: «Báo cáo» ⇒ BẢN không có file (ten_luu/loai_mime/kich_thuoc NULL), vào hàng chờ như file', async () => {
    const ma = await taoNhiemVuCho('KQ2-03');
    const res = await nopBaoCao(apiNv, ma, {
      noiDung: 'Đã hoàn thành khảo sát 12 trạm, không phát sinh sự cố nào trong quý.',
      tenGoc: 'Báo cáo khảo sát quý 3',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.nhom.dinh_dang).toBe('Báo cáo');
    const ban = res.body.data.ban;
    expect(ban.version_no).toBe(1);
    expect(ban.ten_luu).toBeNull();
    expect(ban.loai_mime).toBeNull();
    expect(ban.kich_thuoc).toBeNull();
    expect(ban.noi_dung).toContain('12 trạm');
    expect(await trangThaiNhom(res.body.data.nhom.id)).toBe('cho-xem');

    const doc = await docFiles(apiTp, ma);
    expect(doc[0].laBaoCao).toBe(true);
    expect(doc[0].bans[0].noi_dung).toContain('12 trạm');

    // Có bản ⇒ vào hàng chờ và bấm được đúng bộ nút của TP, y như một file.
    const hangCho = (await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items;
    expect(hangCho).toHaveLength(1);
    expect(hangCho[0].laBaoCao).toBe(true);
    expect(hangCho[0].hanhDong.map((h) => h.ma).sort()).toEqual(
      ['hoan-thanh', 'tra-ve-cbo', 'trinh-lanh-dao', 'yeu-cau-sua'].sort()
    );
  });

  it('TC-KQ2-04: Báo cáo dùng lại nguyên luồng — góp ý theo bản, «Yêu cầu sửa», nộp bản 2 rồi TP chốt', async () => {
    const ma = await taoNhiemVuCho('KQ2-04');
    const tao = await nopBaoCao(apiNv, ma, { noiDung: 'Bản báo cáo lần một, còn thiếu số liệu.' });
    const nhomId = tao.body.data.nhom.id;
    const banId = tao.body.data.ban.id;

    // TP góp ý THEO BẢN (bảng `task_file_comments` không cần biết bản là file hay chữ).
    const gy = await apiTp.post(`/api/v1/task-file-versions/${banId}/comments`, {
      noiDung: 'Bổ sung số liệu 3 tháng và kết luận',
    });
    expect(gy.status, JSON.stringify(gy.body)).toBe(200);

    const ycs = await apiTp.post(`/api/v1/task-files/${nhomId}/verdict`, {
      hanhDong: 'yeu-cau-sua',
      noiDung: 'Thiếu số liệu, viết lại phần kết luận',
    });
    expect(ycs.status, JSON.stringify(ycs.body)).toBe(200);
    expect(await trangThaiNhom(nhomId)).toBe('can-sua');

    // Cán bộ nộp BẢN 2 của chính báo cáo đó (vẫn là chữ, vẫn cùng nhóm).
    const ban2 = await nopBaoCao(apiNv, ma, {
      noiDung: 'Bản báo cáo lần hai, đã bổ sung số liệu 3 tháng và kết luận.',
      fileId: nhomId,
    });
    expect(ban2.status, JSON.stringify(ban2.body)).toBe(200);
    expect(ban2.body.data.ban.version_no).toBe(2);

    const doc = await docFiles(apiTp, ma);
    expect(doc[0].bans).toHaveLength(2);
    expect(doc[0].gopY).toHaveLength(1);

    const chot = await apiTp.post(`/api/v1/task-files/${nhomId}/verdict`, {
      hanhDong: 'hoan-thanh',
    });
    expect(chot.status, JSON.stringify(chot.body)).toBe(200);
    expect(await trangThaiNhom(nhomId)).toBe('hoan-thanh');
    // Trạng thái KẾT: nộp thêm báo cáo cũng 409 như nộp thêm file.
    const them = await nopBaoCao(apiNv, ma, {
      noiDung: 'Định nộp thêm sau khi đã chốt xong.',
      fileId: nhomId,
    });
    expect(them.status).toBe(409);
  });

  it('TC-KQ2-05: bản «Báo cáo» KHÔNG đi qua cửa đòi file — tải về và mở editor đều 400 với câu rõ', async () => {
    const ma = await taoNhiemVuCho('KQ2-05');
    const banId = (await nopBaoCao(apiNv, ma, { noiDung: 'Nội dung báo cáo không có file kèm.' }))
      .body.data.ban.id;

    const tai = await apiNv.get(`/api/v1/task-files/${banId}/download`);
    expect(tai.status).toBe(400);
    expect(tai.body.error.message).toContain('BÁO CÁO');

    // Cửa máy-đối-máy của ONLYOFFICE cũng phải chặn: `duongBan(null)` là 500 không ai hiểu.
    const raw = await client(app).agent.get(
      `/api/v1/task-files-ds/raw/${banId}?token=${tokenDs('raw', banId)}`
    );
    expect(raw.status).toBe(400);
  });

  it('TC-KQ2-06: máy chủ là rào chặn cuối — tên rỗng/định dạng lạ/báo cáo quá ngắn 400; người ngoài phòng 403', async () => {
    const ma = await taoNhiemVuCho('KQ2-06');
    expect((await khai(apiNv, ma, { tenKetQua: '   ' })).status).toBe(400);
    expect((await khai(apiNv, ma, { tenKetQua: 'Hợp lệ', dinhDang: 'Video' })).status).toBe(400);
    // CHECK `tfv_file_hoac_chu` của 016 đòi ≥ 10 ký tự; service trả câu tiếng Việt trước khi tới CSDL.
    const ngan = await nopBaoCao(apiNv, ma, { noiDung: 'ok' });
    expect(ngan.status).toBe(400);
    expect(ngan.body.error.message).toContain('10 ký tự');

    // Cán bộ phòng khác: cả hai đường đều 403 (cùng `can()` với đường nộp file).
    expect((await khai(apiNvNgoai, ma, { tenKetQua: 'Chen ngang' })).status).toBe(403);
    expect(
      (await nopBaoCao(apiNvNgoai, ma, { noiDung: 'Chen ngang một bản báo cáo.' })).status
    ).toBe(403);
  });

  it('TC-KQ2-07: file:create = ✓ ⇒ Báo cáo cũng TỰ ĐỘNG «da-duyet» kèm dòng luồng duyet-tu-dong', async () => {
    const ma = await taoNhiemVuCho('KQ2-07');
    await datGhiDe('Nhân viên', 'file', 'create', 'cho-phep');
    const res = await nopBaoCao(apiNv, ma, {
      noiDung: 'Báo cáo nộp khi phân quyền không yêu cầu duyệt.',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.tuDong).toBe(true);
    expect(await trangThaiNhom(res.body.data.nhom.id)).toBe('da-duyet');
    const luong = await luongCuaNhom(res.body.data.nhom.id);
    expect(luong.map((g) => g.hanh_dong)).toEqual(['nop', 'duyet-tu-dong']);
    // Đã chốt ⇒ không còn trong hàng chờ của ai.
    expect((await apiTp.get('/api/v1/task-files/cho-duyet')).body.data.items).toHaveLength(0);
  });

  it('TC-KQ2-08: xoá nhóm có bản Báo cáo (ten_luu NULL) không nổ; nhóm 0 bản cũng xoá được', async () => {
    const ma = await taoNhiemVuCho('KQ2-08');
    const chuaCo = (await khai(apiNv, ma, { tenKetQua: 'Dòng chưa có file' })).body.data.nhom;
    const coBaoCao = (
      await nopBaoCao(apiNv, ma, { noiDung: 'Một bản báo cáo chữ, không có file vật lý.' })
    ).body.data.nhom;

    expect((await apiNv.del(`/api/v1/task-files/${chuaCo.id}`)).status).toBe(200);
    expect((await apiNv.del(`/api/v1/task-files/${coBaoCao.id}`)).status).toBe(200);
    expect(await docFiles(apiNv, ma)).toHaveLength(0);
  });

  it('TC-KQ2-09: nộp file trực tiếp (không qua ＋) vẫn tự điền ten_ket_qua + dinh_dang theo đuôi', async () => {
    const ma = await taoNhiemVuCho('KQ2-09');
    await nopFile(apiNv, ma, PDF);
    const doc = await docFiles(apiNv, ma);
    expect(doc[0].ten_ket_qua).toBe('ket-qua.pdf');
    expect(doc[0].dinh_dang).toBe('PDF');
    expect(doc[0].laBaoCao).toBe(false);
  });
});

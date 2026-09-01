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
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { closePool } from '../../src/db/pool.js';
import { duongBan, tokenDs } from '../../src/modules/taskFiles/service.js';
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
async function taoNhiemVuCho(name) {
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
  });
  const conCode = con.body.data.item.code;
  await apiPgdA.post(`/api/v1/approvals/work-item/${conCode}/approve`);
  const nvItem = await apiTp.post('/api/v1/work-items', {
    workRef: work.code,
    level: 3,
    parentRef: conCode,
    name: `Nhiệm vụ — ${name}`,
    assigneeId: nv.id,
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
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, 'deputy_director')`,
    [phongA.id, pgdA.id]
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

  it('TC-TF-08: PGD «Trả về TP/PP» kèm ý kiến ⇒ về «cho-xem» + thông báo TP/PP phòng', async () => {
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
    expect(await trangThaiNhom(nhom.id)).toBe('cho-xem');
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

  it('TC-TF-14: sai loại file / sai mimeType / quá 20 MB ⇒ 400 với câu rõ', async () => {
    const ma = await taoNhiemVuCho('TF-14');
    // .exe bị chặn theo đuôi.
    const exe = await nopFile(apiNv, ma, {
      ten: 'virus.exe',
      mime: 'application/octet-stream',
      noiDung: 'MZ',
    });
    expect(exe.status).toBe(400);
    expect(exe.body.error.message).toContain('Chỉ nhận file Word');
    // Đuôi .pdf nhưng mimeType lạ bị chặn theo mime.
    const mimeLai = await nopFile(apiNv, ma, {
      ten: 'tulieumao.pdf',
      mime: 'application/msword',
      noiDung: '%PDF',
    });
    expect(mimeLai.status).toBe(400);
    // Quá 20 MB.
    const to = await nopFile(apiNv, ma, {
      ten: 'to.pdf',
      mime: 'application/pdf',
      noiDung: 'A'.repeat(20 * 1024 * 1024 + 1),
    });
    expect(to.status).toBe(400);
    // Không đính file nào cũng 400 (multer không có file).
    const token = await apiNv.csrfToken();
    const rong = await apiNv.agent
      .post(`/api/v1/work-items/${encodeURIComponent(ma)}/files`)
      .set('x-csrf-token', token)
      .field('moTa', '');
    expect(rong.status).toBe(400);
  });

  it('TC-TF-15: TRƯỞNG PHÒNG sửa được nhiệm vụ do Cán bộ tạo (phân quyền §6) + editor mode', async () => {
    // NV tạo nhiệm vụ trong công việc của phòng A — nhiệm vụ auto «Đã duyệt».
    const cv = await apiTp.post('/api/v1/works', {
      name: 'Việc phòng A — TF-15',
      departmentId: phongA.id,
    });
    const work = cv.body.data.work;
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    const tao = await apiNv.post('/api/v1/work-items', {
      workRef: work.code,
      level: 3,
      name: 'Nhiệm vụ của Cán bộ — TF-15',
      assigneeId: nv.id,
    });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);
    const ma = tao.body.data.item.code;
    // ⭐ TP (không phải người lập) SỬA được nhiệm vụ trong phòng mình — lỗi người dùng báo 2026-09-01.
    const sua = await apiTp.patch(`/api/v1/work-items/${encodeURIComponent(ma)}`, {
      name: 'Nhiệm vụ của Cán bộ — TF-15 (đã sửa bởi TP)',
      notes: 'TP chỉnh mô tả yêu cầu',
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
});

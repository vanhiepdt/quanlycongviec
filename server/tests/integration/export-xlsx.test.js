// Xuất Excel — TC-MISC-10/11/12/13 (§7 việc 7.5 + 7.6, §8.4 nhóm MISC).
//
// Test đọc LẠI file .xlsx trả về bằng `workbook.xlsx.load` chứ không soi chuỗi byte: câu hỏi cần
// trả lời là «Excel đọc thấy gì», mà điều đó chỉ chứng minh được bằng một bộ giải mã OOXML thật.
// Nạp lại được, đúng số dòng, ô ngày ra `Date` ⇒ Excel mở không cảnh báo (TC-MISC-10/13).
//
// TC-MISC-11 là test QUAN TRỌNG NHẤT của cả Phase 7: nó canh lỗ rò dữ liệu khi xuất. Cách canh:
// dựng dữ liệu ở HAI phòng rồi khẳng định file của một `Nhân viên` phòng 1 không chứa MỘT chữ nào
// của phòng 2 — soát cả mã, cả tên, cả tên người.
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { MIME_XLSX, SO_DONG_DAU } from '../../src/modules/export/workbook.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let ph1;
let ph2;
let adminUser;
let nhanVien1;

/** Công việc cấp 1 có đủ ngày + trạng thái — `makeWork` của helper không nhận mấy cột này. */
async function themWork(over = {}) {
  const w = {
    code: 'CV001',
    name: 'Công việc 1',
    department_id: null,
    manager_id: null,
    manager_name: '',
    start_date: '2026-03-01',
    end_date: '2026-03-31',
    status: 'Đang thực hiện',
    approval_status: 'Đã duyệt',
    sort_order: 1,
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO works (code, name, department_id, manager_id, manager_name,
                        start_date, end_date, status, approval_status, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      w.code,
      w.name,
      w.department_id,
      w.manager_id,
      w.manager_name,
      w.start_date,
      w.end_date,
      w.status,
      w.approval_status,
      w.sort_order,
    ]
  );
  return rows[0];
}

async function themItem(over = {}) {
  const i = {
    code: 'CV001-01',
    work_id: null,
    parent_id: null,
    level: 2,
    name: 'Việc con 1',
    assignee_id: null,
    assignee_name: '',
    status: 'Đang thực hiện',
    priority: 'Cao',
    start_date: '2026-03-02',
    due_date: '2026-03-20',
    completion: 50,
    approval_status: 'Đã duyệt',
    sort_order: 1,
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO work_items (code, work_id, parent_id, level, name, assignee_id, assignee_name,
                             status, priority, start_date, due_date, completion,
                             approval_status, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      i.code,
      i.work_id,
      i.parent_id,
      i.level,
      i.name,
      i.assignee_id,
      i.assignee_name,
      i.status,
      i.priority,
      i.start_date,
      i.due_date,
      i.completion,
      i.approval_status,
      i.sort_order,
    ]
  );
  return rows[0];
}

/** Buffer .xlsx → workbook đã nạp lại. Nạp được là bằng chứng file đúng chuẩn OOXML. */
async function mo(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

/** Lấy file .xlsx: supertest phải được bảo là thân nhị phân, mặc định nó cố parse thành chuỗi. */
function tai(api, url) {
  return api.agent.get(url).buffer(true).parse(binaryParser);
}

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

/** Mọi chữ trong một sheet, gộp một chuỗi — dùng để soát «có lọt dữ liệu phòng khác không». */
function chuTrongSheet(sheet) {
  const phan = [];
  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      if (v == null) return;
      phan.push(typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
  });
  return phan.join(' | ');
}

/** Giá trị một cột của mọi dòng dữ liệu (bỏ 2 dòng đầu: tiêu đề + tên cột). */
function cotDuLieu(sheet, soCot) {
  const ra = [];
  for (let i = SO_DONG_DAU + 1; i <= sheet.rowCount; i += 1) {
    ra.push(sheet.getRow(i).getCell(soCot).value);
  }
  return ra;
}

beforeAll(async () => {
  await resetTables();
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetTables();
  ph1 = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 1 });
  ph2 = await makeDepartment({ code: 'PH02', name: 'Phòng Kế toán', sort_order: 2 });
  adminUser = await makeLoginUser({
    code: 'AD001',
    email: 'admin@congty.vn',
    full_name: 'Quản trị hệ thống',
    role: 'admin',
    department_id: ph1.id,
  });
  nhanVien1 = await makeLoginUser({
    code: 'NV001',
    email: 'nv1@congty.vn',
    full_name: 'Nguyễn Văn A',
    role: 'Nhân viên',
    department_id: ph1.id,
  });
});

/**
 * Dữ liệu hai phòng: mỗi phòng 1 công việc + 1 công việc con + 2 nhiệm vụ, thêm 1 nhiệm vụ mồ côi
 * ở phòng 1 để nhóm ảo `(chưa gán công việc con)` cũng có mặt.
 */
async function duLieuHaiPhong() {
  const w1 = await themWork({
    code: 'CV001',
    name: 'Công việc Kỹ thuật',
    department_id: ph1.id,
    manager_name: 'Trần Quản Lý',
  });
  const s1 = await themItem({
    code: 'CV001-01',
    work_id: w1.id,
    level: 2,
    name: 'Việc con Kỹ thuật',
  });
  await themItem({
    code: 'CV001-01-01',
    work_id: w1.id,
    parent_id: s1.id,
    level: 3,
    name: 'Nhiệm vụ KT 1',
    assignee_id: nhanVien1.id,
    assignee_name: nhanVien1.full_name,
    status: 'Hoàn thành',
    completion: 100,
  });
  await themItem({
    code: 'CV001-01-02',
    work_id: w1.id,
    parent_id: s1.id,
    level: 3,
    name: 'Nhiệm vụ KT 2',
    assignee_name: '',
    status: 'Chưa bắt đầu',
    completion: 0,
  });
  // Nhiệm vụ không có cha ⇒ vào nhóm ảo trên cây, nên cũng phải có trong file (TC-MISC-10).
  await themItem({
    code: 'CV001-99',
    work_id: w1.id,
    parent_id: null,
    level: 3,
    name: 'Nhiệm vụ KT mồ côi',
    assignee_id: nhanVien1.id,
    assignee_name: nhanVien1.full_name,
  });

  const w2 = await themWork({
    code: 'CV002',
    name: 'Công việc Kế toán',
    department_id: ph2.id,
    manager_name: 'Lê Kế Toán',
    sort_order: 2,
  });
  const s2 = await themItem({
    code: 'CV002-01',
    work_id: w2.id,
    level: 2,
    name: 'Việc con Kế toán',
  });
  await themItem({
    code: 'CV002-01-01',
    work_id: w2.id,
    parent_id: s2.id,
    level: 3,
    name: 'Nhiệm vụ KeT 1',
    assignee_name: 'Phạm Kế Toán',
    status: 'Hoàn thành',
  });
  await themItem({
    code: 'CV002-01-02',
    work_id: w2.id,
    parent_id: s2.id,
    level: 3,
    name: 'Nhiệm vụ KeT 2',
    assignee_name: 'Phạm Kế Toán',
    status: 'Quá hạn',
    due_date: '2020-01-05',
  });
  return { w1, w2 };
}

async function dangNhap(user) {
  const api = client(app);
  const res = await api.login(user.email);
  expect(res.status).toBe(200);
  return api;
}

describe('Xuất Excel — vỏ HTTP (§7 việc 7.5)', () => {
  it('chưa đăng nhập ⇒ 401 cho cả ba mẫu', async () => {
    const api = client(app);
    for (const url of ['works.xlsx', 'tasks.xlsx', 'stats.xlsx']) {
      const res = await api.get(`/api/v1/export/${url}`);
      expect(res.status).toBe(401);
    }
  });

  it('trả đúng kiểu MIME, tên file có ngày, không cho bộ đệm giữ lại', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const res = await tai(api, '/api/v1/export/works.xlsx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(MIME_XLSX);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="cong-viec-\d{8}\.xlsx"$/
    );
    expect(res.headers['cache-control']).toBe('no-store');
    // Thân là .xlsx thật: file zip mở đầu bằng 'PK'.
    expect(res.body.subarray(0, 2).toString()).toBe('PK');
    expect(Number(res.headers['content-length'])).toBe(res.body.length);
  });

  it('tham số sai vẫn trả LỖI JSON, không trả file rỗng', async () => {
    const api = await dangNhap(adminUser);
    const res = await api.get('/api/v1/export/works.xlsx?month=2026-3');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: { field: 'month' } });
    const res2 = await api.get('/api/v1/export/stats.xlsx?from=01/03/2026');
    expect(res2.status).toBe(400);
    expect(res2.body.error.field).toBe('from');
  });
});

describe('TC-MISC-10 — mẫu (a) Công việc 3 tầng: mở được, số dòng = số mục thấy được', () => {
  it('một sheet, có tiêu đề, tên cột đúng thứ tự, khoá 2 dòng đầu', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const wb = await mo((await tai(api, '/api/v1/export/works.xlsx')).body);

    expect(wb.worksheets).toHaveLength(1);
    const sheet = wb.getWorksheet('Công việc');
    expect(sheet).toBeDefined();
    expect(sheet.getRow(1).getCell(1).value).toBe('DANH SÁCH CÔNG VIỆC 3 CẤP');
    expect(sheet.getRow(2).values.slice(1)).toEqual([
      'Mã',
      'Nội dung',
      'Cấp',
      'Phòng',
      'Người thực hiện',
      'Trạng thái',
      'Ưu tiên',
      'Bắt đầu',
      'Kết thúc',
      '% Hoàn thành',
      'Duyệt',
    ]);
    // «Khoá dòng đầu»: cả tiêu đề và tên cột đứng yên khi cuộn.
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: SO_DONG_DAU });
  });

  it('số dòng dữ liệu = số mục trên cây, kể cả nhóm ảo (chưa gán công việc con)', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const cay = await api.get('/api/v1/works/tree');
    expect(cay.status).toBe(200);
    const { works, subWorks, tasks } = cay.body.data.totals;
    const soNhomAo = cay.body.data.works.filter((w) =>
      (w.subWorks ?? []).some((s) => s.virtual)
    ).length;

    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    // 2 dòng đầu là tiêu đề + tên cột; phần còn lại phải khớp ĐÚNG số mục đang hiện trên cây.
    expect(sheet.rowCount - SO_DONG_DAU).toBe(works + subWorks + soNhomAo + tasks);
    expect({ works, subWorks, tasks, soNhomAo }).toEqual({
      works: 2,
      subWorks: 2,
      tasks: 5,
      soNhomAo: 1,
    });
  });

  it('thụt lề theo cấp bằng alignment.indent, KHÔNG chèn dấu cách vào nội dung', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);

    const theoMa = new Map();
    for (let i = SO_DONG_DAU + 1; i <= sheet.rowCount; i += 1) {
      const row = sheet.getRow(i);
      theoMa.set(String(row.getCell(1).value ?? ''), row);
    }
    const oNoiDung = (ma) => theoMa.get(ma).getCell(2);
    expect(oNoiDung('CV001').alignment?.indent ?? 0).toBe(0);
    expect(oNoiDung('CV001-01').alignment.indent).toBe(2);
    expect(oNoiDung('CV001-01-01').alignment.indent).toBe(4);
    // Nội dung sạch: không có dấu cách mở đầu để hàm TRIM/phép lọc của Excel còn dùng được.
    expect(oNoiDung('CV001-01').value).toBe('Việc con Kỹ thuật');
    expect(oNoiDung('CV001-01-01').value).toBe('Nhiệm vụ KT 1');
    // Cột «Cấp» nói rõ tầng bằng chữ, đúng từ vựng §0.1 (không có chữ "dự án").
    expect(cotDuLieu(sheet, 3)).toEqual([
      'Công việc',
      'Công việc con',
      'Nhiệm vụ',
      'Nhiệm vụ',
      'Công việc con',
      'Nhiệm vụ',
      'Công việc',
      'Công việc con',
      'Nhiệm vụ',
      'Nhiệm vụ',
    ]);
    expect(chuTrongSheet(sheet)).not.toContain('dự án');
  });

  it('nhóm ảo (chưa gán công việc con) có mặt và nhiệm vụ mồ côi nằm dưới nó', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    const noiDung = cotDuLieu(sheet, 2);
    const viTri = noiDung.indexOf('(chưa gán công việc con)');
    expect(viTri).toBeGreaterThan(-1);
    expect(noiDung[viTri + 1]).toBe('Nhiệm vụ KT mồ côi');
    // Nhóm ảo không phải dòng thật ⇒ không có mã, không có % hoàn thành.
    const row = sheet.getRow(SO_DONG_DAU + 1 + viTri);
    expect(row.getCell(1).value ?? '').toBe('');
    expect(row.getCell(10).value).toBe(null);
  });
});

describe('TC-MISC-13 — ngày trong file là NGÀY thật, định dạng dd/mm/yyyy', () => {
  it('ô ngày là Date + numFmt dd/mm/yyyy, không phải chuỗi', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    const row = sheet.getRow(SO_DONG_DAU + 1); // CV001
    for (const soCot of [8, 9]) {
      const cell = row.getCell(soCot);
      expect(cell.value).toBeInstanceOf(Date);
      expect(cell.numFmt).toBe('dd/mm/yyyy');
      expect(typeof cell.value).not.toBe('string');
    }
  });

  it('ngày không bị lệch một hôm vì múi giờ (VN = UTC+7)', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    const bd = sheet.getRow(SO_DONG_DAU + 1).getCell(8).value;
    const kt = sheet.getRow(SO_DONG_DAU + 1).getCell(9).value;
    // 01/03/2026 – 31/03/2026 phải ra đúng ngày 1 và 31 theo UTC (exceljs quy đổi theo UTC).
    expect([bd.getUTCFullYear(), bd.getUTCMonth() + 1, bd.getUTCDate()]).toEqual([2026, 3, 1]);
    expect([kt.getUTCFullYear(), kt.getUTCMonth() + 1, kt.getUTCDate()]).toEqual([2026, 3, 31]);
  });

  it('không có ngày ⇒ ô TRỐNG, không phải chuỗi rỗng hay 1899', async () => {
    const w = await themWork({
      code: 'CV009',
      name: 'Việc chưa điền ngày',
      department_id: ph1.id,
      start_date: null,
      end_date: null,
    });
    await themItem({
      code: 'CV009-01',
      work_id: w.id,
      level: 2,
      name: 'Con chưa điền ngày',
      start_date: null,
      due_date: null,
    });
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    for (const i of [SO_DONG_DAU + 1, SO_DONG_DAU + 2]) {
      expect(sheet.getRow(i).getCell(8).value).toBe(null);
      expect(sheet.getRow(i).getCell(9).value).toBe(null);
    }
  });
});

describe('Mẫu (b) — Nhiệm vụ theo người thực hiện', () => {
  it('chỉ nhiệm vụ CẤP 3, xếp theo người, (chưa giao) xuống cuối', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const res = await tai(api, '/api/v1/export/tasks.xlsx');
    expect(res.headers['content-disposition']).toContain('nhiem-vu-theo-nguoi-');
    const sheet = (await mo(res.body)).getWorksheet('Nhiệm vụ theo người');
    expect(sheet.getRow(1).getCell(1).value).toBe('NHIỆM VỤ THEO NGƯỜI THỰC HIỆN');

    // 5 nhiệm vụ cấp 3 của cả hai phòng; KHÔNG có công việc cấp 1 và công việc con cấp 2 (§0.1).
    expect(sheet.rowCount - SO_DONG_DAU).toBe(5);
    const ma = cotDuLieu(sheet, 2);
    expect(ma).not.toContain('CV001');
    expect(ma).not.toContain('CV001-01');
    expect(new Set(ma)).toEqual(
      new Set(['CV001-01-01', 'CV001-01-02', 'CV001-99', 'CV002-01-01', 'CV002-01-02'])
    );
    expect(cotDuLieu(sheet, 1)).toEqual([
      'Nguyễn Văn A',
      'Nguyễn Văn A',
      'Phạm Kế Toán',
      'Phạm Kế Toán',
      '(chưa giao)',
    ]);
  });

  it('mỗi dòng nói rõ thuộc công việc nào và phòng nào', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/tasks.xlsx')).body)).getWorksheet(1);
    expect(sheet.getRow(2).values.slice(1)).toEqual([
      'Người thực hiện',
      'Mã nhiệm vụ',
      'Tên nhiệm vụ',
      'Thuộc công việc',
      'Phòng',
      'Trạng thái',
      'Ưu tiên',
      'Bắt đầu',
      'Hạn chót',
      '% Hoàn thành',
    ]);
    const theoMa = new Map(
      cotDuLieu(sheet, 2).map((v, i) => [String(v), sheet.getRow(SO_DONG_DAU + 1 + i)])
    );
    const dong = theoMa.get('CV002-01-01');
    expect(dong.getCell(4).value).toBe('Công việc Kế toán');
    expect(dong.getCell(5).value).toBe('Phòng Kế toán');
    expect(theoMa.get('CV001-01-01').getCell(10).value).toBe(100);
  });
});

// ============================================================================
// TC-MISC-11 — RỦI RO LỚN NHẤT CỦA PHASE 7: xuất file là một đường đọc dữ liệu, nếu nó không đi
// qua đúng hàm lọc phạm vi của API danh sách thì nó là lỗ rò im lặng (không ai thấy lỗi, chỉ có
// dữ liệu phòng khác nằm trong file gửi ra ngoài).
// ============================================================================
describe('TC-MISC-11 — Nhân viên xuất Excel chỉ ra dữ liệu phòng mình', () => {
  it('mẫu (a): không một chữ nào của phòng khác lọt vào file', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(nhanVien1);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    const chu = chuTrongSheet(sheet);

    // Phòng mình: đủ 6 mục (1 công việc + 1 việc con + 2 nhiệm vụ + nhóm ảo + 1 mồ côi).
    expect(sheet.rowCount - SO_DONG_DAU).toBe(6);
    expect(chu).toContain('CV001');
    expect(chu).toContain('Phòng Kỹ thuật');
    // Phòng khác: soát cả mã, tên công việc, tên nhiệm vụ, tên người và tên phòng.
    for (const dauVet of [
      'CV002',
      'Công việc Kế toán',
      'Việc con Kế toán',
      'Nhiệm vụ KeT 1',
      'Nhiệm vụ KeT 2',
      'Phạm Kế Toán',
      'Lê Kế Toán',
      'Phòng Kế toán',
    ]) {
      expect(chu).not.toContain(dauVet);
    }
  });

  it('mẫu (b): danh sách nhiệm vụ cũng bị cắt đúng phạm vi đó', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(nhanVien1);
    const sheet = (await mo((await tai(api, '/api/v1/export/tasks.xlsx')).body)).getWorksheet(1);
    expect(new Set(cotDuLieu(sheet, 2))).toEqual(
      new Set(['CV001-01-01', 'CV001-01-02', 'CV001-99'])
    );
    expect(chuTrongSheet(sheet)).not.toContain('Phạm Kế Toán');
  });

  it('mẫu (c): chỉ có dòng phòng mình, dù query string đòi phòng khác', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(nhanVien1);
    // Cố tình đòi CẢ hai phòng: `boLocPhong` phải quốt lại về phòng của người gọi (như TC-STAT-10).
    const url = `/api/v1/export/stats.xlsx?departmentIds=${ph1.id},${ph2.id}`;
    const sheet = (await mo((await tai(api, url)).body)).getWorksheet(1);
    expect(cotDuLieu(sheet, 1)).toEqual(['Phòng Kỹ thuật', 'TỔNG CỘNG']);
    expect(chuTrongSheet(sheet)).not.toContain('Phòng Kế toán');
  });

  it('file của Nhân viên khớp ĐÚNG cây mà API danh sách trả cho chính họ', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(nhanVien1);
    const cay = await api.get('/api/v1/works/tree');
    const maTrenCay = cay.body.data.works.flatMap((w) => [
      w.code,
      ...(w.subWorks ?? []).flatMap((s) => [s.code, ...(s.tasks ?? []).map((t) => t.code)]),
    ]);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    // So từng mã một: cùng một hàm lọc phạm vi ⇒ hai đường phải ra cùng một tập, không xê một dòng.
    // `|| null`: nhóm ảo không có mã — trên cây là `null`, trong ô Excel là ô trống.
    expect(cotDuLieu(sheet, 1).map((v) => v || null)).toEqual(maTrenCay.map((v) => v || null));
  });
});

describe('Mẫu (c) — Thống kê theo phòng', () => {
  it('mỗi phòng một dòng + dòng TỔNG CỘNG, số khớp /stats/summary', async () => {
    await duLieuHaiPhong();
    const api = await dangNhap(adminUser);
    const res = await tai(api, '/api/v1/export/stats.xlsx');
    expect(res.headers['content-disposition']).toContain('thong-ke-theo-phong-');
    const sheet = (await mo(res.body)).getWorksheet('Thống kê theo phòng');
    expect(sheet.getRow(1).getCell(1).value).toBe('THỐNG KÊ THEO PHÒNG');
    expect(sheet.getRow(2).values.slice(1)).toEqual([
      'Phòng',
      'Số công việc',
      'Số nhiệm vụ',
      'Hoàn thành',
      'Đang làm',
      'Quá hạn',
      'Tỷ lệ hoàn thành (%)',
      'Tỷ lệ quá hạn (%)',
    ]);
    // Thứ tự phòng theo `sort_order` của bảng departments, TỔNG CỘNG cuối cùng.
    expect(cotDuLieu(sheet, 1)).toEqual(['Phòng Kỹ thuật', 'Phòng Kế toán', 'TỔNG CỘNG']);

    const tong = await api.get('/api/v1/stats/summary');
    const s = tong.body.data;
    const dongTong = sheet.getRow(sheet.rowCount);
    expect([2, 3, 4, 5, 6, 7, 8].map((c) => dongTong.getCell(c).value)).toEqual([
      s.totalWorks,
      s.totalTasks,
      s.completedTasks,
      s.ongoingTasks,
      s.overdueTasks,
      s.taskCompletionRate,
      s.overdueRate,
    ]);
  });

  it('chỉ đếm nhiệm vụ CẤP 3, và mục Chờ duyệt bị loại (§0.1 + TC-APR-06)', async () => {
    const w = await themWork({ code: 'CV001', name: 'Việc KT', department_id: ph1.id });
    const s = await themItem({ code: 'CV001-01', work_id: w.id, level: 2, name: 'Con 1' });
    await themItem({
      code: 'CV001-01-01',
      work_id: w.id,
      parent_id: s.id,
      level: 3,
      name: 'NV đã duyệt',
      status: 'Hoàn thành',
    });
    await themItem({
      code: 'CV001-01-02',
      work_id: w.id,
      parent_id: s.id,
      level: 3,
      name: 'NV chờ duyệt',
      approval_status: 'Chờ duyệt',
    });
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/stats.xlsx')).body)).getWorksheet(1);
    const dong = sheet.getRow(SO_DONG_DAU + 1);
    // 1 công việc, 1 nhiệm vụ đếm được: cấp 2 không cộng vào, nhiệm vụ Chờ duyệt cũng không.
    expect([dong.getCell(2).value, dong.getCell(3).value]).toEqual([1, 1]);
    expect([dong.getCell(4).value, dong.getCell(7).value]).toEqual([1, 100]);
  });

  it('công việc chưa gán phòng gom vào dòng (chưa có phòng), đứng cuối trước TỔNG CỘNG', async () => {
    await themWork({ code: 'CV001', name: 'Việc KT', department_id: ph1.id });
    await themWork({ code: 'CV002', name: 'Việc không phòng', department_id: null });
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/stats.xlsx')).body)).getWorksheet(1);
    expect(cotDuLieu(sheet, 1)).toEqual(['Phòng Kỹ thuật', '(chưa có phòng)', 'TỔNG CỘNG']);
  });

  it('phòng không có dòng nào thì KHÔNG xuất — file thống kê không đầy dòng số 0', async () => {
    await themWork({ code: 'CV001', name: 'Việc KT', department_id: ph1.id });
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/stats.xlsx')).body)).getWorksheet(1);
    expect(cotDuLieu(sheet, 1)).toEqual(['Phòng Kỹ thuật', 'TỔNG CỘNG']);
  });
});

describe('Nội dung do người dùng nhập không thành công thức Excel', () => {
  it('tên bắt đầu bằng = + - @ vẫn là CHỮ, không phải formula', async () => {
    const w = await themWork({ code: 'CV001', name: '=1+1', department_id: ph1.id });
    await themItem({
      code: 'CV001-01',
      work_id: w.id,
      level: 2,
      name: '=HYPERLINK("http://xau.vn","bấm đi")',
    });
    const api = await dangNhap(adminUser);
    const sheet = (await mo((await tai(api, '/api/v1/export/works.xlsx')).body)).getWorksheet(1);
    for (const i of [SO_DONG_DAU + 1, SO_DONG_DAU + 2]) {
      const cell = sheet.getRow(i).getCell(2);
      // Ô chuỗi (`s`), KHÔNG phải ô công thức: `cell.value` là string thì Excel hiện nguyên văn.
      expect(typeof cell.value).toBe('string');
      expect(cell.formula).toBeUndefined();
      expect(cell.type).toBe(ExcelJS.ValueType.String);
    }
    expect(sheet.getRow(SO_DONG_DAU + 1).getCell(2).value).toBe('=1+1');
  });
});

describe('TC-MISC-12 — 5.000 dòng: xong dưới 15 giây, không hết bộ nhớ', () => {
  // Hạn của test (120 giây) rộng hơn hạn nghiệp vụ (15 giây): còn phải chèn 5.000 dòng và nạp lại
  // file để đếm — chỉ phần XUẤT mới bị canh 15 giây, đo riêng bằng `batDau`.
  it('xuất công việc có 5.000 nhiệm vụ', async () => {
    const w = await themWork({ code: 'CV001', name: 'Việc lớn', department_id: ph1.id });
    const s = await themItem({ code: 'CV001-01', work_id: w.id, level: 2, name: 'Con 1' });
    await pool.query(
      `INSERT INTO work_items (code, work_id, parent_id, level, name, assignee_name,
                                 status, priority, start_date, due_date, completion, sort_order)
         SELECT 'CV001-01-' || lpad(g::text, 5, '0'), $1, $2, 3, 'Nhiệm vụ ' || g,
                'Người ' || (g % 20), 'Đang thực hiện', 'Cao',
                DATE '2026-03-01', DATE '2026-03-31', 0, g
           FROM generate_series(1, 5000) AS g`,
      [w.id, s.id]
    );
    const api = await dangNhap(adminUser);

    const batDau = Date.now();
    const res = await tai(api, '/api/v1/export/works.xlsx');
    const giay = (Date.now() - batDau) / 1000;
    expect(res.status).toBe(200);
    expect(giay).toBeLessThan(15);

    const sheet = (await mo(res.body)).getWorksheet(1);
    // 1 công việc + 1 công việc con + 5.000 nhiệm vụ.
    expect(sheet.rowCount - SO_DONG_DAU).toBe(5002);
    expect(sheet.getRow(sheet.rowCount).getCell(1).value).toBe('CV001-01-05000');
  }, 120_000); // Hạn của test rộng hơn hạn nghiệp vụ: xem chú thích đầu khối.
});

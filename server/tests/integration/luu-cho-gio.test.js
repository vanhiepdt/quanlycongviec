// GIỎ «LƯU CHỜ» (S1–S4, 12/09/2026) — sửa mục ĐANG «Đã duyệt» thì cất vào giỏ, cột thật giữ giá trị cũ.
//
// Chỉ đạo: «khi sửa thông tin gì cũng có chế độ lưu chờ (tức là cho sửa tiếp), rồi nút ấn gửi duyệt thay
// gì gửi duyệt luôn khi ấn cập nhật như bây giờ, và trước khi ấn nút gửi duyệt thì phải hiển thị popup
// những cái thay đổi». Bốn câu đã chốt:
//   S1 — giỏ chờ, CỘT THẬT GIỮ GIÁ TRỊ CŨ;
//   S2 — CHỈ mục đang «Đã duyệt»;
//   S3 — màn công việc con: «Gửi duyệt» gửi CẢ CÂY một lần;
//   S4 — popup CÓ Ô TICK, bỏ tick thì thay đổi đó ở lại giỏ.
//
// Mọi khẳng định về cột ĐỌC LẠI CSDL, không tin thân phản hồi — cùng lý do `approvals-api.test.js`
// nêu ở đầu file (điểm đỏ D1 của lượt khói §8.5 lọt qua được chính vì phản hồi trông đúng).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { flushAudit } from '../../src/middleware/audit.js';
import { LABELS_GIO } from '../../src/modules/approvals/changes.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let tp;
let pgdA;
let nvA;
let admin;
let apiTp;
let apiPgdA;
let apiNv;
let apiAdmin;

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

function dataOf(res) {
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.ok).toBe(true);
  return res.body.data;
}

function expectLoi(res, status, code, field) {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  expect(res.body.ok).toBe(false);
  expect(res.body.error.code).toBe(code);
  if (field !== undefined) expect(res.body.error.field).toBe(field);
}

function urlGio(entity, ref, duoi = '') {
  return `/api/v1/approvals/${entity}/${ref}/pending-edits${duoi}`;
}

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

async function taoCon(workRef, name) {
  const res = await apiTp.post('/api/v1/work-items', {
    workRef,
    level: 2,
    name,
    supervisorIds: [pgdA.id],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data.item;
}

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

async function duyetCay(workCode) {
  const res = await apiPgdA.post(`/api/v1/approvals/work/${workCode}/approve`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

/**
 * Mở ghi đè «Sửa ⇒ Chờ duyệt». `phaiDuyetLaiKhiSua` với cấp 1/cấp 3 CHỈ hạ khi có ô này; cấp 2 thì
 * TP/PP tự phải duyệt lại kể cả khi không có ghi đè. `ghiDe` nạp lại mỗi request nên không đăng nhập lại.
 */
async function moGhiDe(vai, entityType) {
  const res = await pool.query(
    `INSERT INTO permission_overrides (vai, entity_type, action, gia_tri, pham_vi)
     VALUES ($1, $2, 'update', 'cho-duyet', 'tat-ca')
     ON CONFLICT (vai, entity_type, action) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`,
    [vai, entityType]
  );
  expect(res.rowCount, `không đặt được ghi đè ${vai}/${entityType}:update`).toBe(1);
}

async function trangThai(bang, code) {
  const { rows } = await pool.query(`SELECT approval_status FROM ${bang} WHERE code = $1`, [code]);
  return rows[0]?.approval_status ?? null;
}

async function giaTri(bang, code, cot) {
  const { rows } = await pool.query(`SELECT ${cot} AS v FROM ${bang} WHERE code = $1`, [code]);
  return rows[0] ? rows[0].v : null;
}

async function gioMo(code = null) {
  const sql =
    code == null
      ? `SELECT * FROM approval_changes
          WHERE change_kind = 'luu-cho' AND approved_at IS NULL ORDER BY id`
      : `SELECT * FROM approval_changes
          WHERE change_kind = 'luu-cho' AND approved_at IS NULL AND entity_code = $1 ORDER BY id`;
  const { rows } = await pool.query(sql, code == null ? [] : [code]);
  return rows;
}

async function demGioMo() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM approval_changes
      WHERE change_kind = 'luu-cho' AND approved_at IS NULL`
  );
  return rows[0].n;
}

/**
 * Cây W → S1 → {T1, T2}, S2 → T3, cả cây «Đã duyệt». Đúng hình S3: gửi từ S1 phải kéo T1/T2 nếu chúng
 * có giỏ, gửi từ T1 chỉ T1, gửi từ W thì cả năm.
 */
async function cayBaCap() {
  const work = await taoViec('Việc gốc lưu chờ');
  const s1 = await taoCon(work.code, 'Con S1');
  const s2 = await taoCon(work.code, 'Con S2');
  const t1 = await taoNhiemVu(work.code, 'Nhiệm vụ T1', s1.code);
  const t2 = await taoNhiemVu(work.code, 'Nhiệm vụ T2', s1.code);
  const t3 = await taoNhiemVu(work.code, 'Nhiệm vụ T3', s2.code);
  await duyetCay(work.code);
  expect(await trangThai('works', work.code)).toBe('Đã duyệt');
  expect(await trangThai('work_items', s1.code)).toBe('Đã duyệt');
  expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');
  return { work, s1, s2, t1, t2, t3 };
}

const rpc = (api, name, args = []) => api.post(`/api/rpc/${name}`, { args });

async function call(api, name, args = []) {
  const res = await rpc(api, name, args);
  expect(res.status, `${name}: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body.data;
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  tp = await makeLoginUser({
    code: 'NV010',
    full_name: 'Trần Thị Trưởng',
    email: 'tp-luu-cho@test.local',
    role: 'Trưởng phòng',
    department_id: phongA.id,
  });
  pgdA = await makeLoginUser({
    code: 'NV002',
    full_name: 'Lê Văn Phó',
    email: 'pgd-luu-cho@test.local',
    role: 'Phó Giám đốc',
    department_id: phongA.id,
  });
  nvA = await makeLoginUser({
    code: 'NV011',
    full_name: 'Đỗ Văn Viên',
    email: 'nv-luu-cho@test.local',
    role: 'Nhân viên',
    department_id: phongA.id,
  });
  admin = await makeLoginUser({
    code: 'NV001',
    full_name: 'Nguyễn Văn Admin',
    email: 'admin-luu-cho@test.local',
    role: 'admin',
  });
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, 'deputy_director')`,
    [phongA.id, pgdA.id]
  );
  apiTp = await dangNhap(tp);
  apiPgdA = await dangNhap(pgdA);
  apiNv = await dangNhap(nvA);
  apiAdmin = await dangNhap(admin);
});

afterAll(async () => {
  await closePool();
});

describe('pin nhãn giỏ', () => {
  it('LABELS_GIO không có gui_bld_phe_duyet, có assignee_name và manager_name', () => {
    // Tích BLĐ đã có trục riêng `gui-bld` từ 026 — nhét vào giỏ là hai trục cho một ô.
    // Hai cột tên gõ tay phải có: form sửa gửi chuỗi tên, không gửi id.
    expect(Object.keys(LABELS_GIO)).not.toContain('gui_bld_phe_duyet');
    expect(LABELS_GIO.assignee_name).toBe('Người thực hiện trực tiếp');
    expect(LABELS_GIO.manager_name).toBe('Người quản lý');
    expect(LABELS_GIO.name).toBe('Tên');
    expect(LABELS_GIO.notes).toBe('Ghi chú');
  });
});

describe('S2 — chỉ mục đang Đã duyệt mới vào giỏ', () => {
  it('Chờ duyệt và Nháp: phaiLuuCho false, POST 409 field approvalStatus', async () => {
    const cho = await taoViec('Việc chờ');
    const docCho = dataOf(await apiTp.get(urlGio('work', cho.code)));
    expect(docCho.phaiLuuCho).toBe(false);
    expect(docCho.approvalStatus).toBe('Chờ duyệt');
    expectLoi(
      await apiTp.post(urlGio('work', cho.code), { name: 'Đổi lúc chờ' }),
      409,
      'CONFLICT',
      'approvalStatus'
    );

    const nhap = await taoViec('Việc nháp', { saveAsDraft: true });
    const docNhap = dataOf(await apiTp.get(urlGio('work', nhap.code)));
    expect(docNhap.phaiLuuCho).toBe(false);
    expect(docNhap.approvalStatus).toBe('Nháp');
    expectLoi(
      await apiTp.post(urlGio('work', nhap.code), { name: 'Đổi lúc nháp' }),
      409,
      'CONFLICT',
      'approvalStatus'
    );
    expect(await demGioMo()).toBe(0);
  });

  it('admin không vào giỏ — vai ghi thẳng vẫn dùng Cập nhật như cũ', async () => {
    const { t1 } = await cayBaCap();
    const doc = dataOf(await apiAdmin.get(urlGio('work-item', t1.code)));
    expect(doc.phaiLuuCho).toBe(false);
    expectLoi(
      await apiAdmin.post(urlGio('work-item', t1.code), { name: 'Admin sửa thẳng' }),
      409,
      'CONFLICT',
      'approvalStatus'
    );
    expect(await demGioMo()).toBe(0);
  });

  it('TP trên cấp 2 Đã duyệt: phaiLuuCho true KHÔNG cần ghi đè', async () => {
    const { s1 } = await cayBaCap();
    const doc = dataOf(await apiTp.get(urlGio('work-item', s1.code)));
    expect(doc.phaiLuuCho).toBe(true);
    expect(doc.approvalStatus).toBe('Đã duyệt');
  });

  it('TP trên cấp 1: false khi không ghi đè, true khi có work:update', async () => {
    const { work } = await cayBaCap();
    expect(dataOf(await apiTp.get(urlGio('work', work.code))).phaiLuuCho).toBe(false);
    await moGhiDe('Trưởng phòng', 'work');
    expect(dataOf(await apiTp.get(urlGio('work', work.code))).phaiLuuCho).toBe(true);
  });

  it('TP trên cấp 3 Đã duyệt: vào giỏ không cần ghi đè task:update', async () => {
    const { t1 } = await cayBaCap();
    expect(dataOf(await apiTp.get(urlGio('work-item', t1.code))).phaiLuuCho).toBe(true);
  });
});

describe('S1 — cột thật giữ giá trị cũ, sửa tiếp = MERGE', () => {
  it('POST {name} cất giỏ, CSDL giữ tên cũ, work_id của giỏ item KHÔNG NULL', async () => {
    const { work, t1 } = await cayBaCap();
    const tenCu = t1.name;

    const saved = dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'Tên đang chờ' }));
    expect(saved.luuCho).toBe(true);
    expect(saved.id).toBeGreaterThan(0);
    expect(saved.code).toBe(t1.code);
    expect(saved.approvalStatus).toBe('Đã duyệt');
    expect(saved.soThayDoi).toBe(1);
    expect(saved.thayDoi).toEqual([
      { field: 'name', label: 'Tên', from: tenCu, to: 'Tên đang chờ' },
    ]);
    expect(saved.tongSoThayDoi).toBe(1);
    expect(saved.soMucCoGio).toBe(1);
    const reopened = dataOf(await apiTp.get(urlGio('work-item', t1.code)));
    expect(reopened.gio[0].thayDoi[0]).toEqual({
      field: 'name', label: 'Tên', from: tenCu, to: 'Tên đang chờ', valueTo: 'Tên đang chờ',
    });
    expect(reopened.gio[0].thayDoi[0]).not.toHaveProperty('valueFrom');

    expect(await giaTri('work_items', t1.code, 'name')).toBe(tenCu);
    expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');

    const rows = await gioMo(t1.code);
    expect(rows).toHaveLength(1);
    expect(rows[0].change_kind).toBe('luu-cho');
    expect(rows[0].approved_at).toBeNull();
    expect(rows[0].recipient_id).toBe(Number(tp.id));
    expect(rows[0].editor_id).toBe(Number(tp.id));
    expect(rows[0].item_id).toBe(Number(t1.id));
    // Lỗi đã bắt khi soạn ca này: bản đầu truyền workId=null cho giỏ item, vỡ NOT NULL của 023.
    expect(rows[0].work_id, 'giỏ nhiệm vụ phải treo dưới công việc gốc').toBe(Number(work.id));
    expect(rows[0].work_id).not.toBeNull();
  });

  it('sửa tiếp cùng ô: MERGE cùng id, from vẫn là giá trị GỐC', async () => {
    const { t1 } = await cayBaCap();
    const tenCu = t1.name;

    const lan1 = dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'Tên lần 1' }));
    const lan2 = dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'Tên lần 2' }));
    expect(lan2.id).toBe(lan1.id);
    expect(lan2.thayDoi).toEqual([{ field: 'name', label: 'Tên', from: tenCu, to: 'Tên lần 2' }]);
    expect(await giaTri('work_items', t1.code, 'name')).toBe(tenCu);
    expect(await demGioMo()).toBe(1);
  });

  it('sửa vòng về gốc ⇒ luuCho false, giỏ bị xoá', async () => {
    const { t1 } = await cayBaCap();
    const tenCu = t1.name;

    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'Tên tạm' }));
    const ve = dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: tenCu }));
    expect(ve.luuCho).toBe(false);
    expect(ve.id).toBeNull();
    expect(ve.soThayDoi).toBe(0);
    expect(await gioMo(t1.code)).toHaveLength(0);
    expect(await giaTri('work_items', t1.code, 'name')).toBe(tenCu);
    expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');
  });

  it('{approvalStatus} một mình bị lột, không đụng cột, không sinh giỏ', async () => {
    const { t1 } = await cayBaCap();

    const saved = dataOf(
      await apiTp.post(urlGio('work-item', t1.code), { approvalStatus: 'Từ chối' })
    );
    expect(saved.luuCho).toBe(false);
    expect(saved.soThayDoi).toBe(0);
    expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');
    expect(await demGioMo()).toBe(0);
  });
});

describe('S3 — phạm vi cây', () => {
  it('đọc từ S1 thấy giỏ T1+S1, từ T1 thấy 1, từ W thấy 2, từ S2 thấy 0', async () => {
    const { work, s1, s2, t1 } = await cayBaCap();

    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));
    dataOf(await apiTp.post(urlGio('work-item', s1.code), { name: 'S1 chờ' }));

    const tuS1 = dataOf(await apiTp.get(urlGio('work-item', s1.code)));
    expect(tuS1.gio.map((g) => g.code).sort()).toEqual([s1.code, t1.code].sort());
    expect(tuS1.tongSoThayDoi).toBe(2);

    const tuT1 = dataOf(await apiTp.get(urlGio('work-item', t1.code)));
    expect(tuT1.gio).toHaveLength(1);
    expect(tuT1.gio[0].code).toBe(t1.code);
    expect(tuT1.gio[0].entity).toBe('task');
    expect(tuT1.gio[0].workId).toBe(Number(work.id));

    const tuW = dataOf(await apiTp.get(urlGio('work', work.code)));
    expect(tuW.gio.map((g) => g.code).sort()).toEqual([s1.code, t1.code].sort());

    const tuS2 = dataOf(await apiTp.get(urlGio('work-item', s2.code)));
    expect(tuS2.gio).toHaveLength(0);
    expect(tuS2.tongSoThayDoi).toBe(0);
  });

  it('submit từ S1 gửi cả hai, hạ Chờ duyệt, đóng giỏ; submit từ T1 chỉ T1', async () => {
    const { s1, t1, t2 } = await cayBaCap();

    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));
    dataOf(await apiTp.post(urlGio('work-item', s1.code), { name: 'S1 chờ' }));

    const guiS1 = dataOf(await apiTp.post(urlGio('work-item', s1.code, '/submit'), {}));
    expect(guiS1.daGui).toHaveLength(2);
    expect(guiS1.daGui.map((g) => g.code).sort()).toEqual([s1.code, t1.code].sort());
    expect(guiS1.daGui.every((g) => g.choDuyetLai)).toBe(true);
    expect(guiS1.tongSoThayDoiConLai).toBe(0);
    expect(await trangThai('work_items', s1.code)).toBe('Chờ duyệt');
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');
    expect(await trangThai('work_items', t2.code)).toBe('Đã duyệt');
    expect(await giaTri('work_items', t1.code, 'name')).toBe('T1 chờ');
    expect(await giaTri('work_items', s1.code, 'name')).toBe('S1 chờ');
    expect(await demGioMo()).toBe(0);

    const { rows: dong } = await pool.query(
      `SELECT entity_code, approved_at FROM approval_changes
        WHERE change_kind = 'luu-cho' AND entity_code = ANY($1::text[])`,
      [[s1.code, t1.code]]
    );
    expect(dong).toHaveLength(2);
    for (const r of dong) expect(r.approved_at).not.toBeNull();
  });

  it('submit từ T1 chỉ gửi T1, giỏ S1 còn', async () => {
    const { s1, t1 } = await cayBaCap();
    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));
    dataOf(await apiTp.post(urlGio('work-item', s1.code), { name: 'S1 chờ' }));

    const guiT1 = dataOf(await apiTp.post(urlGio('work-item', t1.code, '/submit'), {}));
    expect(guiT1.daGui).toHaveLength(1);
    expect(guiT1.daGui[0].code).toBe(t1.code);
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');
    expect(await trangThai('work_items', s1.code)).toBe('Đã duyệt');
    expect(await giaTri('work_items', s1.code, 'name')).toBe('Con S1');
    expect(await gioMo(s1.code)).toHaveLength(1);
    expect(await gioMo(t1.code)).toHaveLength(0);
  });

  it('submit nhiệm vụ cấp 3 dùng đường giỏ để hạ Chờ duyệt, còn PATCH thẳng giữ luồng cũ', async () => {
    const { t1 } = await cayBaCap();
    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 qua giỏ' }));

    const gui = dataOf(await apiTp.post(urlGio('work-item', t1.code, '/submit'), {}));
    expect(gui.daGui).toHaveLength(1);
    expect(gui.daGui[0]).toMatchObject({ code: t1.code, choDuyetLai: true });
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');
  });
});

describe('S4 — ô tick chọn thay đổi nào gửi', () => {
  it('tick mỗi name: chỉ name được áp, notes ở lại giỏ, mục hạ Chờ duyệt', async () => {
    const { t1 } = await cayBaCap();
    const tenCu = t1.name;
    const saved = dataOf(
      await apiTp.post(urlGio('work-item', t1.code), {
        name: 'Tên mới',
        notes: 'Ghi chú mới',
      })
    );
    expect(saved.soThayDoi).toBe(2);

    const gui = dataOf(
      await apiTp.post(urlGio('work-item', t1.code, '/submit'), {
        chon: [{ id: saved.id, fields: ['name'] }],
      })
    );
    expect(gui.daGui).toHaveLength(1);
    expect(gui.daGui[0].thayDoi.map((c) => c.field)).toEqual(['name']);
    expect(gui.tongSoThayDoiConLai).toBe(1);
    expect(gui.conLai).toHaveLength(1);
    expect(gui.conLai[0].thayDoi.map((c) => c.field)).toEqual(['notes']);

    expect(await giaTri('work_items', t1.code, 'name')).toBe('Tên mới');
    expect(await giaTri('work_items', t1.code, 'notes')).not.toBe('Ghi chú mới');
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');
    // Tên gốc phải khác tên mới — nếu lỡ gửi nhầm cả notes thì ca này vẫn xanh ở name, nên notes
    // đọc lại CSDL ở trên; còn from của giỏ sót phải là giá trị CŨ lúc lưu.
    expect(tenCu).not.toBe('Tên mới');
  });

  it('chon rỗng ⇒ 409 field chon; id lạ / field lạ / id lặp ⇒ 400 field chon', async () => {
    const { t1 } = await cayBaCap();
    const saved = dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));

    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code, '/submit'), { chon: [] }),
      409,
      'CONFLICT',
      'chon'
    );
    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code, '/submit'), {
        chon: [{ id: saved.id + 9999, fields: ['name'] }],
      }),
      400,
      'VALIDATION_ERROR',
      'chon'
    );
    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code, '/submit'), {
        chon: [{ id: saved.id, fields: ['khong_co'] }],
      }),
      400,
      'VALIDATION_ERROR',
      'chon'
    );
    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code, '/submit'), {
        chon: [
          { id: saved.id, fields: ['name'] },
          { id: saved.id, fields: ['name'] },
        ],
      }),
      400,
      'VALIDATION_ERROR',
      'chon'
    );
    expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');
    expect(await giaTri('work_items', t1.code, 'name')).toBe('Nhiệm vụ T1');
  });

  it('không gửi chon ⇒ gửi hết', async () => {
    const { t1 } = await cayBaCap();
    dataOf(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'Hết name', notes: 'Hết notes' })
    );

    const gui = dataOf(await apiTp.post(urlGio('work-item', t1.code, '/submit'), {}));
    expect(gui.daGui[0].thayDoi.map((c) => c.field).sort()).toEqual(['name', 'notes']);
    expect(gui.tongSoThayDoiConLai).toBe(0);
    expect(await giaTri('work_items', t1.code, 'name')).toBe('Hết name');
    expect(await giaTri('work_items', t1.code, 'notes')).toBe('Hết notes');
  });

  it('chon [{id}] không fields ⇒ gửi hết giỏ đó', async () => {
    const { t1 } = await cayBaCap();
    const saved = dataOf(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 hết', notes: 'n1' })
    );
    const gui = dataOf(
      await apiTp.post(urlGio('work-item', t1.code, '/submit'), { chon: [{ id: saved.id }] })
    );
    expect(gui.daGui[0].thayDoi).toHaveLength(2);
    expect(gui.tongSoThayDoiConLai).toBe(0);
    expect(await giaTri('work_items', t1.code, 'name')).toBe('T1 hết');
  });
});

describe('drop — bỏ giỏ', () => {
  it('thân rỗng bỏ cả phạm vi; {id} bỏ một giỏ; {id,fields} cắt một ô', async () => {
    const { s1, t1 } = await cayBaCap();
    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ', notes: 'n1' }));
    const s1Saved = dataOf(await apiTp.post(urlGio('work-item', s1.code), { name: 'S1 chờ' }));

    const cat = dataOf(
      await apiTp.post(urlGio('work-item', t1.code, '/drop'), {
        id: (await gioMo(t1.code))[0].id,
        fields: ['name'],
      })
    );
    expect(cat.daBo).toBe(1);
    expect(cat.gio[0].thayDoi.map((c) => c.field)).toEqual(['notes']);
    expect(cat.tongSoThayDoi).toBe(1);

    const mot = dataOf(await apiTp.post(urlGio('work-item', s1.code, '/drop'), { id: s1Saved.id }));
    expect(mot.daBo).toBe(1);
    expect(await gioMo(s1.code)).toHaveLength(0);
    expect(await gioMo(t1.code)).toHaveLength(1);

    // Thân rỗng = bỏ CẢ PHẠM VI. Gọi từ S1 thì T1 (con) cũng đi — đúng S3, không phải chỉ S1.
    const het = dataOf(await apiTp.post(urlGio('work-item', s1.code, '/drop'), {}));
    expect(het.daBo).toBe(1);
    expect(het.gio).toEqual([]);
    expect(het.tongSoThayDoi).toBe(0);
    expect(await demGioMo()).toBe(0);
  });

  it('id lạ ⇒ 404; field lạ ⇒ 400 field fields', async () => {
    const { t1 } = await cayBaCap();
    const saved = dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));

    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code, '/drop'), { id: saved.id + 9999 }),
      404,
      'NOT_FOUND'
    );
    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code, '/drop'), {
        id: saved.id,
        fields: ['khong_co'],
      }),
      400,
      'VALIDATION_ERROR',
      'fields'
    );
    expect(await demGioMo()).toBe(1);
  });
});

describe('chống dời chỗ im lặng', () => {
  it('parentRef/workRef lệch ⇒ 409; trùng chỗ hiện tại ⇒ 200', async () => {
    const { work, s1, s2, t1 } = await cayBaCap();
    const workKhac = await taoViec('Việc khác');

    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'x', parentRef: s2.code }),
      409,
      'CONFLICT',
      'parentRef'
    );
    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'x', parentRef: null }),
      409,
      'CONFLICT',
      'parentRef'
    );
    expectLoi(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'x', workRef: workKhac.code }),
      409,
      'CONFLICT',
      'workRef'
    );

    const okCha = dataOf(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'Giữ cha', parentRef: s1.code })
    );
    expect(okCha.luuCho).toBe(true);
    const okViec = dataOf(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'Giữ việc', workRef: work.code })
    );
    expect(okViec.luuCho).toBe(true);
    expect(okViec.id).toBe(okCha.id);
    expect(await giaTri('work_items', t1.code, 'name')).toBe('Nhiệm vụ T1');
  });
});

describe('GET /pending-edits của tôi', () => {
  it('chỉ trả giỏ của người đăng nhập', async () => {
    const { t1 } = await cayBaCap();
    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));

    const cuaTp = dataOf(await apiTp.get('/api/v1/approvals/pending-edits'));
    expect(cuaTp.tongSoThayDoi).toBe(1);
    expect(cuaTp.muc).toHaveLength(1);
    expect(cuaTp.muc[0].code).toBe(t1.code);
    expect(cuaTp.muc[0].fields).toEqual(['name']);

    const cuaNv = dataOf(await apiNv.get('/api/v1/approvals/pending-edits'));
    expect(cuaNv.tongSoThayDoi).toBe(0);
    expect(cuaNv.muc).toEqual([]);
  });
});

describe('return dọn giỏ', () => {
  it('trả lại để sửa xoá giỏ sót (kể cả phần bỏ tick)', async () => {
    const { t1 } = await cayBaCap();
    const saved = dataOf(
      await apiTp.post(urlGio('work-item', t1.code), { name: 'Tên mới', notes: 'Ghi chú mới' })
    );
    dataOf(
      await apiTp.post(urlGio('work-item', t1.code, '/submit'), {
        chon: [{ id: saved.id, fields: ['name'] }],
      })
    );
    expect(await gioMo(t1.code)).toHaveLength(1);
    expect(await trangThai('work_items', t1.code)).toBe('Chờ duyệt');

    const ret = await apiPgdA.post(`/api/v1/approvals/work-item/${t1.code}/return`, {
      reason: 'Trả lại để dọn giỏ chờ',
    });
    expect(ret.status, JSON.stringify(ret.body)).toBe(200);
    expect(await trangThai('work_items', t1.code)).toBe('Nháp');
    expect(await demGioMo()).toBe(0);
  });
});

describe('audit', () => {
  it('submit ghi đúng 1 dòng pendingEditSubmit; save/drop không ghi', async () => {
    const { t1 } = await cayBaCap();

    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));
    await flushAudit();
    const { rows: sauLuu } = await pool.query(
      `SELECT action FROM activity_logs WHERE action = 'approvals.pendingEditSubmit'`
    );
    expect(sauLuu).toHaveLength(0);

    dataOf(await apiTp.post(urlGio('work-item', t1.code, '/drop'), {}));
    await flushAudit();
    const { rows: sauDrop } = await pool.query(
      `SELECT action FROM activity_logs WHERE action = 'approvals.pendingEditSubmit'`
    );
    expect(sauDrop).toHaveLength(0);

    const saved = dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));
    dataOf(await apiTp.post(urlGio('work-item', t1.code, '/submit'), {}));
    await flushAudit();
    const { rows } = await pool.query(
      `SELECT action, entity_type, entity_id, work_id, details
         FROM activity_logs WHERE action = 'approvals.pendingEditSubmit'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_type).toBe('task');
    expect(rows[0].entity_id).toBe(Number(t1.id));
    expect(rows[0].details).toMatchObject({
      code: t1.code,
      count: 1,
      changed: 1,
    });
    expect(saved.id).toBeGreaterThan(0);
  });
});

describe('cầu RPC', () => {
  it('updateTaskWithAuth + luuCho:true cất giỏ, không hạ trạng thái, warnings rỗng', async () => {
    const { work, t1 } = await cayBaCap();

    const data = await call(apiTp, 'updateTaskWithAuth', [
      t1.code,
      { name: 'Tên RPC', luuCho: true },
    ]);
    expect(data.success).toBe(true);
    expect(data.taskId).toBe(t1.code);
    expect(data.moved).toBe(false);
    expect(data.warnings).toEqual([]);
    expect(data.luuCho.luuCho).toBe(true);
    expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');
    expect(await giaTri('work_items', t1.code, 'name')).toBe('Nhiệm vụ T1');
    const rows = await gioMo(t1.code);
    expect(rows).toHaveLength(1);
    expect(rows[0].work_id).toBe(Number(work.id));
    expect(rows[0].item_id).toBe(Number(t1.id));
  });

  it('updateTaskWithAuth không cờ cấp 3 giữ luật PATCH thẳng, không tự vào giỏ', async () => {
    const { t1, s1 } = await cayBaCap();

    const data = await call(apiTp, 'updateTaskWithAuth', [t1.code, { name: 'Tên thẳng' }]);
    expect(data.success).toBe(true);
    expect(data.taskId).toBe(t1.code);
    expect(data.luuCho).toBeUndefined();
    // Q9 chỉ hạ cấp 2 của TP/PP, không nới PATCH cấp 3 theo luật riêng của giỏ.
    expect(await trangThai('work_items', t1.code)).toBe('Đã duyệt');
    expect(await giaTri('work_items', t1.code, 'name')).toBe('Tên thẳng');
    const capHai = await call(apiTp, 'updateTaskWithAuth', [s1.code, { name: 'Cấp hai sửa thẳng' }]);
    expect(capHai.success).toBe(true);
    expect(await trangThai('work_items', s1.code)).toBe('Chờ duyệt');
    expect(await demGioMo()).toBe(0);
  });

  it('updateProjectWithAuth + luuCho:true cất giỏ cấp 1 (item_id IS NULL)', async () => {
    const { work } = await cayBaCap();
    await moGhiDe('Trưởng phòng', 'work');

    const data = await call(apiTp, 'updateProjectWithAuth', [
      work.code,
      { name: 'Tên việc RPC', luuCho: true },
    ]);
    expect(data.success).toBe(true);
    expect(data.projectId).toBe(work.code);
    expect(data.warnings).toEqual([]);
    expect(data.luuCho.luuCho).toBe(true);
    expect(await trangThai('works', work.code)).toBe('Đã duyệt');
    expect(await giaTri('works', work.code, 'name')).toBe('Việc gốc lưu chờ');
    const rows = await gioMo(work.code);
    expect(rows).toHaveLength(1);
    expect(rows[0].item_id).toBeNull();
    expect(rows[0].work_id).toBe(Number(work.id));
  });
});

describe('pending-count không cộng giỏ', () => {
  it('lưu chờ không làm tăng GET /pending-count', async () => {
    const { t1 } = await cayBaCap();
    const truoc = dataOf(await apiPgdA.get('/api/v1/approvals/pending-count'));

    dataOf(await apiTp.post(urlGio('work-item', t1.code), { name: 'T1 chờ' }));

    const sau = dataOf(await apiPgdA.get('/api/v1/approvals/pending-count'));
    expect(sau.total).toBe(truoc.total);
    expect(sau.total).toBe(0);
    expect(await demGioMo()).toBe(1);
  });
});

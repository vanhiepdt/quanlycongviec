// LUỒNG YÊU CẦU XOÁ (013, Vòng 13 đợt 2) — «thêm phần Chờ duyệt cho cán bộ đối với Xoá Công việc
// cấp 1, cấp 2, nhiệm vụ cấp 3» (yêu cầu người dùng 2026-08-31).
//
// Ba điều then chốt, và mỗi điều là một quyết định người dùng đã chốt rõ:
//  1. **Ba cột riêng, `approval_status` KHÔNG đổi.** Mục xin xoá có thể đang ở bất kỳ trạng thái
//     duyệt nào; từ chối yêu cầu xoá phải trả về đúng trạng thái cũ mà không phải đoán.
//  2. **Mục đang xin xoá VẪN hiện và VẪN vào thống kê.** Chưa ai đồng ý thì việc vẫn phải làm — và
//     nếu ẩn ngay thì cán bộ có thể «tự ẩn» việc của mình bằng cách xin xoá.
//  3. **Một yêu cầu cho cả cây.** Xin xoá cấp 1 là xin xoá luôn con cháu; duyệt xong CASCADE lo.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let nv; // Cán bộ — người bị ghi đè «Xoá phải qua duyệt», và là người xin xoá
let apiNv;
let pgdA; // Phó Giám đốc phụ trách phòng A — người duyệt yêu cầu xoá
let apiPgdA;
let apiTp;
let apiAdmin;

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

/** Ba cột yêu cầu xoá + trạng thái duyệt, đọc thẳng từ CSDL. */
async function coXinXoa(bang, code) {
  const { rows } = await pool.query(
    `SELECT approval_status, xoa_yeu_cau_boi, xoa_yeu_cau_luc, xoa_ly_do
       FROM ${bang} WHERE code = $1`,
    [code]
  );
  return rows[0] ?? null;
}

async function conTonTai(bang, code) {
  const { rows } = await pool.query(`SELECT 1 FROM ${bang} WHERE code = $1`, [code]);
  return rows.length > 0;
}

async function thongBaoCua(userId) {
  const { rows } = await pool.query(
    'SELECT content, type, ref_type, ref_id FROM notifications WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return rows;
}

/** admin bật ghi đè «Xoá phải qua duyệt» cho một vai + một loại thực thể. */
async function batXoaChoDuyet(vai, entityType) {
  const res = await apiAdmin.put('/api/v1/permissions', {
    thayDoi: [{ vai, entityType, action: 'delete', giaTri: 'cho-duyet' }],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

/** Một công việc cấp 1 đã duyệt, kèm công việc con + nhiệm vụ bên trong (cây 3 tầng đủ). */
async function taoCayDaDuyet() {
  const cv = await apiTp.post('/api/v1/works', { name: 'Việc phòng A', departmentId: phongA.id });
  const work = cv.body.data.work;
  await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
  const con = await apiTp.post('/api/v1/work-items', {
    workRef: work.code,
    level: 2,
    name: 'Công việc con',
  });
  const conCode = con.body.data.item.code;
  await apiPgdA.post(`/api/v1/approvals/work-item/${conCode}/approve`);
  const nvItem = await apiTp.post('/api/v1/work-items', {
    workRef: work.code,
    level: 3,
    parentRef: conCode,
    name: 'Nhiệm vụ của cán bộ',
    assigneeId: nv.id,
  });
  return { work, conCode, nvCode: nvItem.body.data.item.code };
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });

  const admin = await makeLoginUser({
    code: 'NV001',
    email: 'admin@test.local',
    role: 'admin',
    department_id: null,
  });
  const tp = await makeLoginUser({
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
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role) VALUES ($1,$2,'deputy_director')`,
    [phongA.id, pgdA.id]
  );

  apiAdmin = await dangNhap(admin);
  apiTp = await dangNhap(tp);
  apiPgdA = await dangNhap(pgdA);
  apiNv = await dangNhap(nv);
});

afterAll(async () => {
  await closePool();
});

describe('TC-XOA-01..03 — bấm xoá khi bị ghi đè ⏳ ⇒ phải đi qua yêu cầu xoá', () => {
  it('TC-XOA-01: Cán bộ xoá nhiệm vụ của mình ⇒ 403 kèm câu «bấm Xin xoá»', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');

    const res = await apiNv.del(`/api/v1/work-items/${nvCode}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Xin xoá');
    // Không có ghi đè thì vẫn xoá thẳng được — ca dưới canh phần đó.
    expect(await conTonTai('work_items', nvCode)).toBe(true);
  });

  it('TC-XOA-02: KHÔNG có ghi đè ⇒ xoá thẳng như cũ, không qua yêu cầu nào', async () => {
    const { nvCode } = await taoCayDaDuyet();
    const res = await apiNv.del(`/api/v1/work-items/${nvCode}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await conTonTai('work_items', nvCode)).toBe(false);
  });

  it('TC-XOA-03: xin xoá ghi 3 cột, `approval_status` KHÔNG đổi, người duyệt được báo', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    const lyDo = 'Nhiệm vụ này bị trùng, đề nghị cho xoá';

    const res = await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, {
      reason: lyDo,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const sau = await coXinXoa('work_items', nvCode);
    expect(Number(sau.xoa_yeu_cau_boi)).toBe(Number(nv.id));
    expect(sau.xoa_yeu_cau_luc).not.toBeNull();
    expect(sau.xoa_ly_do).toBe(lyDo);
    // Đây là điểm cốt lõi của thiết kế 3 cột: trạng thái duyệt giữ nguyên.
    expect(sau.approval_status).toBe('Đã duyệt');

    const tb = await thongBaoCua(pgdA.id);
    expect(tb.at(-1).content).toContain(lyDo);
    expect(tb.at(-1).type).toBe('approval_pending');
    expect(tb.at(-1).ref_type).toBe('work_item');
  });
});

describe('TC-XOA-04..05 — mục đang xin xoá VẪN hiện và VẪN được đếm', () => {
  it('TC-XOA-04: vẫn ở `GET /works` và vẫn vào `/stats/summary`', async () => {
    const cv = await apiTp.post('/api/v1/works', { name: 'Việc xin xoá', departmentId: phongA.id });
    const work = cv.body.data.work;
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    const truoc = (await apiAdmin.get('/api/v1/stats/summary')).body.data.totalWorks;

    await batXoaChoDuyet('Trưởng phòng', 'work');
    const res = await apiTp.post(`/api/v1/approvals/work/${work.code}/request-delete`, {
      reason: 'Việc này đã chuyển sang phòng khác phụ trách',
    });
    expect(res.status).toBe(200);

    // Người dùng chốt: «vẫn hiện bình thường + nhãn đỏ», và vẫn vào thống kê — chưa ai đồng ý cả.
    const ds = (await apiTp.get('/api/v1/works')).body.data.works.map((w) => w.code);
    expect(ds).toContain(work.code);
    expect((await apiAdmin.get('/api/v1/stats/summary')).body.data.totalWorks).toBe(truoc);
  });

  it('TC-XOA-05: hộp yêu cầu xoá riêng, KHÔNG lẫn vào `/pending`; badge cộng thêm', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, {
      reason: 'Xin xoá vì nhập trùng hai lần',
    });

    const hopXoa = await apiPgdA.get('/api/v1/approvals/pending-deletes');
    expect(hopXoa.status).toBe(200);
    expect(hopXoa.body.data.items).toHaveLength(1);
    expect(hopXoa.body.data.items[0]).toMatchObject({ kind: 'item', code: nvCode, level: 3 });
    // Tên người xin + lý do đi kèm để giao diện dựng dòng mà không phải gọi thêm.
    expect(hopXoa.body.data.items[0].xoa_yeu_cau_ten).toBe('Nguyễn Văn Cán Bộ');
    expect(hopXoa.body.data.items[0].xoa_ly_do).toContain('nhập trùng');

    // Hai danh sách tách nhau: bấm «Duyệt» trên một dòng yêu cầu xoá là chuyện không được xảy ra.
    const hopDuyet = await apiPgdA.get('/api/v1/approvals/pending');
    expect(hopDuyet.body.data.items.map((i) => i.code)).not.toContain(nvCode);

    const badge = await apiPgdA.get('/api/v1/approvals/pending-count');
    expect(badge.body.data.deletes).toBe(1);
    expect(badge.body.data.total).toBeGreaterThanOrEqual(1);
  });
});

describe('TC-XOA-06..08 — duyệt / từ chối yêu cầu xoá', () => {
  it('TC-XOA-06: duyệt yêu cầu xoá ⇒ mục mất thật, người XIN được báo', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, {
      reason: 'Nhiệm vụ này không còn cần thiết nữa',
    });

    const res = await apiPgdA.post(`/api/v1/approvals/work-item/${nvCode}/approve-delete`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.daXoa).toBe(true);
    expect(await conTonTai('work_items', nvCode)).toBe(false);

    // Thông báo gửi TRƯỚC khi xoá nên người xin vẫn đọc được; không trỏ liên kết chết.
    const tb = await thongBaoCua(nv.id);
    expect(tb.at(-1).content).toContain('đã được DUYỆT');
    expect(tb.at(-1).ref_type).toBe('');
    expect(tb.at(-1).ref_id).toBeNull();
  });

  it('TC-XOA-07: từ chối ⇒ 3 cột về rỗng, `approval_status` KHÔNG đổi, mục nguyên trạng', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, {
      reason: 'Xin xoá nhiệm vụ này giúp em',
    });

    const res = await apiPgdA.post(`/api/v1/approvals/work-item/${nvCode}/reject-delete`, {
      reason: 'Nhiệm vụ vẫn cần cho báo cáo quý',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const sau = await coXinXoa('work_items', nvCode);
    expect(sau.xoa_yeu_cau_boi).toBeNull();
    expect(sau.xoa_yeu_cau_luc).toBeNull();
    expect(sau.xoa_ly_do).toBe('');
    expect(sau.approval_status).toBe('Đã duyệt'); // đúng trạng thái trước khi xin xoá
    expect(await conTonTai('work_items', nvCode)).toBe(true);

    const tb = await thongBaoCua(nv.id);
    expect(tb.at(-1).content).toContain('TỪ CHỐI');
    expect(tb.at(-1).content).toContain('báo cáo quý');
  });

  it('TC-XOA-07: từ chối KHÔNG cần lý do (khác /reject — không có gì mất đi)', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, {
      reason: 'Xin xoá nhiệm vụ này giúp em',
    });
    const res = await apiPgdA.post(`/api/v1/approvals/work-item/${nvCode}/reject-delete`, {});
    expect(res.status).toBe(200);
    expect((await coXinXoa('work_items', nvCode)).xoa_yeu_cau_boi).toBeNull();
  });

  it('TC-XOA-08: xin xoá lại được sau khi bị từ chối', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    const xin = { reason: 'Xin xoá nhiệm vụ này giúp em' };
    await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, xin);
    await apiPgdA.post(`/api/v1/approvals/work-item/${nvCode}/reject-delete`, {});
    const lai = await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, xin);
    expect(lai.status).toBe(200);
    expect((await coXinXoa('work_items', nvCode)).xoa_yeu_cau_boi).not.toBeNull();
  });
});

describe('TC-XOA-09 — xin xoá CẢ CÂY (công việc cấp 1)', () => {
  it('nói đúng số con cháu sẽ mất, và duyệt xong cả cây biến mất', async () => {
    const { work, conCode, nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Trưởng phòng', 'work');

    const xin = await apiTp.post(`/api/v1/approvals/work/${work.code}/request-delete`, {
      reason: 'Công việc này bị huỷ theo chỉ đạo mới',
    });
    expect(xin.status, JSON.stringify(xin.body)).toBe(200);
    expect(xin.body.data.soCon).toBe(2); // 1 công việc con + 1 nhiệm vụ
    const tbXin = await thongBaoCua(pgdA.id);
    expect(tbXin.at(-1).content).toContain('2 mục bên trong');

    // Cờ chỉ ghi lên GỐC — con cháu không mang yêu cầu, nên hộp chờ duyệt hiện một dòng.
    expect((await coXinXoa('work_items', conCode)).xoa_yeu_cau_boi).toBeNull();
    expect((await apiPgdA.get('/api/v1/approvals/pending-deletes')).body.data.items).toHaveLength(
      1
    );

    const duyet = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve-delete`);
    expect(duyet.status).toBe(200);
    expect(duyet.body.data.soCon).toBe(2);
    expect(await conTonTai('works', work.code)).toBe(false);
    expect(await conTonTai('work_items', conCode)).toBe(false);
    expect(await conTonTai('work_items', nvCode)).toBe(false);
  });
});

describe('TC-XOA-10 — cổng chặn', () => {
  it('lý do xin xoá < 10 ký tự ⇒ 400, không ghi cột nào', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    const res = await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, {
      reason: 'xin xoa',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('reason');
    expect((await coXinXoa('work_items', nvCode)).xoa_yeu_cau_boi).toBeNull();
  });

  it('người KHÔNG có quyền duyệt mục đó không duyệt/từ chối được yêu cầu xoá ⇒ 403', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, {
      reason: 'Xin xoá nhiệm vụ này giúp em',
    });

    // Chính người xin không tự duyệt được; Trưởng phòng cũng không (§6: chỉ admin + Phó GĐ).
    expect((await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/approve-delete`)).status).toBe(
      403
    );
    expect((await apiTp.post(`/api/v1/approvals/work-item/${nvCode}/approve-delete`)).status).toBe(
      403
    );
    expect(await conTonTai('work_items', nvCode)).toBe(true);
  });

  it('xin xoá hai lần ⇒ 409; duyệt/từ chối khi không có yêu cầu ⇒ 409', async () => {
    const { nvCode } = await taoCayDaDuyet();
    await batXoaChoDuyet('Nhân viên', 'task');
    const xin = { reason: 'Xin xoá nhiệm vụ này giúp em' };

    // Chưa có yêu cầu nào mà đã duyệt/từ chối.
    expect(
      (await apiPgdA.post(`/api/v1/approvals/work-item/${nvCode}/approve-delete`)).status
    ).toBe(409);
    expect(
      (await apiPgdA.post(`/api/v1/approvals/work-item/${nvCode}/reject-delete`, {})).status
    ).toBe(409);

    await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, xin);
    const lanHai = await apiNv.post(`/api/v1/approvals/work-item/${nvCode}/request-delete`, xin);
    expect(lanHai.status).toBe(409);
  });

  it('ba cột yêu cầu xoá KHÔNG đặt được qua PATCH (boCotKhoaDuyet gỡ)', async () => {
    const { nvCode } = await taoCayDaDuyet();
    const res = await apiNv.patch(`/api/v1/work-items/${nvCode}`, {
      notes: 'sửa bình thường',
      xoaYeuCauBoi: 999999,
      xoaLyDo: 'tự đặt yêu cầu xoá qua đường vòng',
    });
    expect(res.status).toBe(200);
    const sau = await coXinXoa('work_items', nvCode);
    expect(sau.xoa_yeu_cau_boi).toBeNull();
    expect(sau.xoa_ly_do).toBe('');
  });
});

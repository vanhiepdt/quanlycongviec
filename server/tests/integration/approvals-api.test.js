// Luồng duyệt — ba hành động, quyền duyệt, badge, thông báo
// (§7 việc 5.2/5.3/5.5/5.7 · §8.4 nhóm E · TC-APR-08..16).
//
// Cùng cách kiểm với `approval-on-create.test.js`: mọi khẳng định về trạng thái ĐỌC LẠI CỘT TRONG
// CSDL, không tin thân phản hồi. Điểm đỏ D1 của lượt khói §8.5 lọt qua được chính vì phản hồi
// trông đúng.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let phongB;
/** Trưởng phòng A — người tạo việc trong hầu hết các kịch bản. */
let tp;
let apiTp;
/** Phó Giám đốc phụ trách phòng A. */
let pgdA;
let apiPgdA;
/** Phó Giám đốc phụ trách phòng B (dùng cho TC-APR-10). */
let apiPgdB;

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

async function phuTrach(departmentId, userId) {
  await pool.query(
    `INSERT INTO department_managers (department_id, user_id, role)
     VALUES ($1, $2, 'deputy_director')`,
    [departmentId, userId]
  );
}

/** Bốn cột duyệt đọc thẳng từ CSDL. */
async function khoaDuyet(bang, code) {
  const { rows } = await pool.query(
    `SELECT approval_status, approver_id, approved_at, reject_reason
       FROM ${bang} WHERE code = $1`,
    [code]
  );
  return rows[0] ?? null;
}

async function thongBaoCua(userId) {
  const { rows } = await pool.query(
    'SELECT content, type, ref_type, ref_id, is_read FROM notifications WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return rows;
}

/** Một công việc cấp 1 do Trưởng phòng A lập ⇒ luôn ở 'Chờ duyệt' (việc 5.1). */
async function taoViecChoDuyet() {
  const res = await apiTp.post('/api/v1/works', { name: 'Việc phòng A', departmentId: phongA.id });
  expect(res.status).toBe(200);
  return res.body.data.work;
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  phongB = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 2 });

  tp = await makeLoginUser({
    code: 'NV010',
    full_name: 'Trần Thị Trưởng',
    email: 'tp01@test.local',
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
  const pgdB = await makeLoginUser({
    code: 'NV003',
    full_name: 'Phạm Thị Phó',
    email: 'pgd-b@test.local',
    role: 'Phó Giám đốc',
    department_id: phongB.id,
  });
  await phuTrach(phongA.id, pgdA.id);
  await phuTrach(phongB.id, pgdB.id);

  apiTp = await dangNhap(tp);
  apiPgdA = await dangNhap(pgdA);
  apiPgdB = await dangNhap(pgdB);
});

afterAll(async () => {
  await closePool();
});

describe('Gửi duyệt (submit) — việc 5.2', () => {
  it('Việc bị từ chối gửi lại được, và lý do từ chối cũ bị xoá', async () => {
    const work = await taoViecChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Chưa nêu rõ sản phẩm đầu ra của công việc',
    });
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Từ chối');

    const res = await apiTp.post(`/api/v1/approvals/work/${work.code}/submit`);
    expect(res.status).toBe(200);

    const sau = await khoaDuyet('works', work.code);
    expect(sau.approval_status).toBe('Chờ duyệt');
    expect(sau.reject_reason).toBe('');
    expect(sau.approver_id).toBeNull();
    expect(sau.approved_at).toBeNull();
  });

  it('Gửi duyệt mục đang chờ duyệt ⇒ 409', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiTp.post(`/api/v1/approvals/work/${work.code}/submit`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('Gửi duyệt sinh thông báo cho Phó Giám đốc phụ trách phòng (việc 5.7)', async () => {
    const work = await taoViecChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Thiếu mốc thời gian hoàn thành',
    });
    const res = await apiTp.post(`/api/v1/approvals/work/${work.code}/submit`);

    expect(res.body.data.notified).toBe(1);
    const tb = await thongBaoCua(pgdA.id);
    expect(tb).toHaveLength(1);
    expect(tb[0].type).toBe('approval_pending');
    expect(tb[0].ref_type).toBe('work');
    expect(tb[0].content).toContain(work.code);
    expect(tb[0].is_read).toBe(false);
  });

  it('Nhiệm vụ cấp 3 không có bước duyệt ⇒ 409', async () => {
    const work = await taoViecChoDuyet();
    const item = await apiTp.post('/api/v1/work-items', {
      workRef: work.code,
      level: 3,
      name: 'Nhiệm vụ',
    });
    const code = item.body.data.item.code;
    const res = await apiTp.post(`/api/v1/approvals/work-item/${code}/submit`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('không có bước duyệt');
  });

  it('Loại thực thể lạ ⇒ 400, không phải 404', async () => {
    const res = await apiTp.post('/api/v1/approvals/proposal/CV001/submit');
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('entity');
  });
});

describe('TC-APR-08/09 — từ chối phải có lý do ≥ 10 ký tự', () => {
  it('TC-APR-08: không có lý do ⇒ 400', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {});
    expect(res.status).toBe(400);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Chờ duyệt');
  });

  it('TC-APR-08: lý do rỗng hoặc chỉ có dấu cách ⇒ 400', async () => {
    const work = await taoViecChoDuyet();
    for (const reason of ['', '   ', '\t\n  ']) {
      const res = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, { reason });
      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe('reason');
    }
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Chờ duyệt');
  });

  it('TC-APR-08: lý do 9 ký tự ⇒ 400, đúng 10 ký tự ⇒ nhận', async () => {
    const work = await taoViecChoDuyet();
    const chin = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Khong dat',
    });
    expect(chin.status).toBe(400);

    const muoi = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Chua dat!!',
    });
    expect(muoi.status).toBe(200);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Từ chối');
  });

  it('TC-APR-09: có lý do ⇒ Từ chối + lưu lý do + thông báo cho người tạo', async () => {
    const work = await taoViecChoDuyet();
    const lyDo = 'Thiếu dự toán kinh phí, đề nghị bổ sung trước ngày 30';
    const res = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, { reason: lyDo });

    expect(res.status).toBe(200);
    const sau = await khoaDuyet('works', work.code);
    expect(sau.approval_status).toBe('Từ chối');
    expect(sau.reject_reason).toBe(lyDo);
    expect(Number(sau.approver_id)).toBe(Number(pgdA.id));
    expect(sau.approved_at).not.toBeNull();

    const tb = await thongBaoCua(tp.id);
    expect(tb).toHaveLength(1);
    expect(tb[0].type).toBe('approval_rejected');
    expect(tb[0].content).toContain(lyDo);
  });

  it('Lý do được cắt trắng hai đầu trước khi lưu', async () => {
    const work = await taoViecChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: '   Chưa đúng mẫu quy định   ',
    });
    expect((await khoaDuyet('works', work.code)).reject_reason).toBe('Chưa đúng mẫu quy định');
  });
});

describe('TC-APR-10/11 — quyền duyệt (việc 5.3)', () => {
  it('TC-APR-10: Phó Giám đốc phòng B duyệt mục của phòng A ⇒ 403', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdB.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(res.status).toBe(403);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Chờ duyệt');
  });

  it('TC-APR-10: Phó Giám đốc phòng B từ chối mục của phòng A ⇒ 403', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdB.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Tôi không phụ trách phòng này nhưng vẫn thử',
    });
    expect(res.status).toBe(403);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Chờ duyệt');
  });

  it('TC-APR-11: Nhân viên gọi thẳng API duyệt ⇒ 403', async () => {
    const work = await taoViecChoDuyet();
    const nv = await makeLoginUser({
      code: 'NV020',
      email: 'nv@test.local',
      role: 'Nhân viên',
      department_id: phongA.id,
    });
    const api = await dangNhap(nv);
    const res = await api.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(res.status).toBe(403);
  });

  it('Trưởng phòng KHÔNG duyệt được việc của chính mình ⇒ 403', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiTp.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(res.status).toBe(403);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Chờ duyệt');
  });

  it('Phó Giám đốc phụ trách đúng phòng ⇒ duyệt được, ghi người duyệt', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);

    expect(res.status).toBe(200);
    const sau = await khoaDuyet('works', work.code);
    expect(sau.approval_status).toBe('Đã duyệt');
    expect(Number(sau.approver_id)).toBe(Number(pgdA.id));
    expect(sau.approved_at).not.toBeNull();
  });

  it('admin duyệt được mọi phòng, kể cả phòng mình không thuộc về', async () => {
    const work = await taoViecChoDuyet();
    const admin = await makeLoginUser({
      code: 'NV001',
      email: 'admin@test.local',
      role: 'admin',
      department_id: null,
    });
    const api = await dangNhap(admin);
    const res = await api.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(res.status).toBe(200);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Đã duyệt');
  });

  it('Chưa đăng nhập ⇒ 401', async () => {
    const work = await taoViecChoDuyet();
    const khach = client(app);
    const res = await khach.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(res.status).toBe(401);
  });

  it('Thiếu token CSRF ⇒ 403, không đổi trạng thái', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdA.post(
      `/api/v1/approvals/work/${work.code}/approve`,
      {},
      { csrf: null }
    );
    expect(res.status).toBe(403);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Chờ duyệt');
  });
});

describe('TC-APR-14 — duyệt hai lần', () => {
  it('Lần hai trả 409 và KHÔNG tạo thông báo trùng', async () => {
    const work = await taoViecChoDuyet();
    const lan1 = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(lan1.status).toBe(200);
    expect(lan1.body.data.notified).toBe(1);

    const lan2 = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect(lan2.status).toBe(409);

    const tb = await thongBaoCua(tp.id);
    expect(tb).toHaveLength(1);
    expect(tb[0].type).toBe('approval_approved');
  });

  it('Đổi quyết định (đã duyệt ⇒ từ chối) vẫn làm được', async () => {
    const work = await taoViecChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    const res = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Phát hiện trùng với công việc CV009 đã có',
    });

    expect(res.status).toBe(200);
    const sau = await khoaDuyet('works', work.code);
    expect(sau.approval_status).toBe('Từ chối');
    expect(sau.reject_reason).toContain('CV009');
  });

  it('Duyệt lại sau khi từ chối thì xoá lý do từ chối', async () => {
    const work = await taoViecChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Thiếu chữ ký của người phụ trách',
    });
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);

    const sau = await khoaDuyet('works', work.code);
    expect(sau.approval_status).toBe('Đã duyệt');
    expect(sau.reject_reason).toBe('');
  });
});

describe('TC-APR-16 — duyệt cấp 1 KHÔNG lan xuống cây', () => {
  it('Công việc con Chờ duyệt bên trong vẫn Chờ duyệt sau khi duyệt công việc cha', async () => {
    const work = await taoViecChoDuyet();
    const con = await apiTp.post('/api/v1/work-items', {
      workRef: work.code,
      level: 2,
      name: 'Công việc con',
    });
    const conCode = con.body.data.item.code;
    expect((await khoaDuyet('work_items', conCode)).approval_status).toBe('Chờ duyệt');

    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);

    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Đã duyệt');
    expect((await khoaDuyet('work_items', conCode)).approval_status).toBe('Chờ duyệt');
  });

  it('Duyệt công việc con là một hành động riêng, có thông báo riêng', async () => {
    const work = await taoViecChoDuyet();
    const con = await apiTp.post('/api/v1/work-items', {
      workRef: work.code,
      level: 2,
      name: 'Công việc con',
    });
    const conCode = con.body.data.item.code;

    const res = await apiPgdA.post(`/api/v1/approvals/work-item/${conCode}/approve`);
    expect(res.status).toBe(200);
    expect((await khoaDuyet('work_items', conCode)).approval_status).toBe('Đã duyệt');

    const tb = await thongBaoCua(tp.id);
    expect(tb).toHaveLength(1);
    expect(tb[0].ref_type).toBe('work_item');
  });
});

describe('TC-APR-15 — badge chờ duyệt (việc 5.5)', () => {
  it('Đúng số và giảm ngay sau khi duyệt', async () => {
    const truoc = await apiPgdA.get('/api/v1/approvals/pending-count');
    expect(truoc.status).toBe(200);
    expect(truoc.body.data.total).toBe(0);

    const work = await taoViecChoDuyet();
    await apiTp.post('/api/v1/work-items', { workRef: work.code, level: 2, name: 'Con' });

    const dangCho = await apiPgdA.get('/api/v1/approvals/pending-count');
    expect(dangCho.body.data).toMatchObject({ works: 1, items: 1, total: 2 });

    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    const sau = await apiPgdA.get('/api/v1/approvals/pending-count');
    expect(sau.body.data).toMatchObject({ works: 0, items: 1, total: 1 });
  });

  it('Phó Giám đốc chỉ đếm phòng mình phụ trách', async () => {
    await taoViecChoDuyet();
    expect((await apiPgdA.get('/api/v1/approvals/pending-count')).body.data.total).toBe(1);
    expect((await apiPgdB.get('/api/v1/approvals/pending-count')).body.data.total).toBe(0);
  });

  it('Nhiệm vụ cấp 3 không bao giờ vào số đếm chờ duyệt', async () => {
    const work = await taoViecChoDuyet();
    await apiTp.post('/api/v1/work-items', { workRef: work.code, level: 3, name: 'Nhiệm vụ' });
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/approve`);
    expect((await apiPgdA.get('/api/v1/approvals/pending-count')).body.data.total).toBe(0);
  });

  it('Hộp chờ duyệt liệt kê đúng mục của phòng mình phụ trách', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdA.get('/api/v1/approvals/pending');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ kind: 'work', code: work.code, level: 1 });
  });

  it('Người tạo vẫn thấy việc mình gửi đang chờ, dù không có quyền duyệt', async () => {
    await taoViecChoDuyet();
    const res = await apiTp.get('/api/v1/approvals/pending-count');
    expect(res.body.data.total).toBe(1);
  });
});

describe('Lý do từ chối là dữ liệu người dùng nhập — coi như nguồn tấn công', () => {
  // Yêu cầu của phiên: lý do từ chối phải có phép kiểm XSS. Máy chủ lưu và trả NGUYÊN VĂN — chống
  // XSS là việc của chỗ dựng HTML (`escapeHtml`/`escapeHtmlAttr` ở app.js, đã soát ở Phase 4).
  // Điều phải bảo đảm ở đây: máy chủ không thoát hai lần (người đọc thấy `&lt;`), không cắt xén,
  // và không có đường nào để chuỗi đó chui vào một cột khác.
  const DOC = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

  it('Lưu và trả về nguyên văn, không thoát hai lần', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, { reason: DOC });

    expect(res.status).toBe(200);
    expect(res.body.data.row.reject_reason).toBe(DOC);
    expect((await khoaDuyet('works', work.code)).reject_reason).toBe(DOC);
    expect(res.text).not.toContain('&amp;lt;');
  });

  it('Chuỗi tiêm SQL trong lý do chỉ là chữ, không đổi được dữ liệu', async () => {
    const work = await taoViecChoDuyet();
    const doc = "'; UPDATE works SET approval_status = 'Đã duyệt'; --";
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, { reason: doc });

    const sau = await khoaDuyet('works', work.code);
    expect(sau.approval_status).toBe('Từ chối');
    expect(sau.reject_reason).toBe(doc);
  });

  it('Nội dung thông báo giữ nguyên văn lý do, không dựng HTML ở máy chủ', async () => {
    const work = await taoViecChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, { reason: DOC });

    const tb = await thongBaoCua(tp.id);
    expect(tb[0].content).toContain(DOC);
    expect(tb[0].content).not.toContain('&lt;');
  });

  it('Lý do dài quá 2000 ký tự ⇒ 400, không chạm CSDL', async () => {
    const work = await taoViecChoDuyet();
    const res = await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'x'.repeat(2001),
    });
    expect(res.status).toBe(400);
    expect((await khoaDuyet('works', work.code)).approval_status).toBe('Chờ duyệt');
  });
});

describe('Khoá duyệt không đổi được bằng đường vòng', () => {
  it('Không tìm thấy mục ⇒ 404', async () => {
    const res = await apiPgdA.post('/api/v1/approvals/work/CV999/approve');
    expect(res.status).toBe(404);
  });

  it('Người duyệt và thời điểm duyệt do máy chủ ghi, không nhận từ thân request', async () => {
    const work = await taoViecChoDuyet();
    await apiPgdA.post(`/api/v1/approvals/work/${work.code}/reject`, {
      reason: 'Lý do hợp lệ đủ mười ký tự',
      approverId: 999999,
      approvedAt: '1999-01-01',
    });
    const sau = await khoaDuyet('works', work.code);
    expect(Number(sau.approver_id)).toBe(Number(pgdA.id));
    expect(new Date(sau.approved_at).getFullYear()).toBeGreaterThan(2020);
  });
});

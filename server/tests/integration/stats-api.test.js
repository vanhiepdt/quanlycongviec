// API thống kê — Phase 6 (§7 việc 6.1–6.3, §8.4 nhóm F).
//
// RỦI RO LỚN NHẤT CỦA PHASE 6 LÀ ĐẾM SAI, không phải vẽ được biểu đồ:
//   - TC-STAT-01: cấp 2 không cộng vào bất kỳ thẻ nào.
//   - TC-APR-06: thêm 1 mục «Chờ duyệt» ⇒ 4 thẻ và 6 biểu đồ không đổi MỘT đơn vị.
//   - TC-STAT-02..05: tỷ lệ 0 nhiệm vụ = 0%; quá hạn đúng luật; biểu đồ rỗng không lỗi.
//   - TC-STAT-07..09: lọc tháng là GIAO NHAU khoảng ngày.
//   - TC-STAT-10: nhân viên truyền ?departmentIds= phòng khác bị ÉP về phòng mình Ở SERVER.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { QUERIES } from '../../src/modules/stats/repo.js';
import { makeDepartment, makeItem, makeWork, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let phongB;
let admin;
let apiAdmin;

/** Ngày dạng yyyy-MM-dd lệch so với hôm nay (âm = trước). */
function ngayLech(soNgay) {
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  const hai = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

/**
 * Nhiệm vụ cấp 3 có đủ cột nghiệp vụ (makeItem chỉ chèn cột cơ sở). Trạng thái/priority mặc định
 * khớp cách phân loại của bản cũ: 'đang' → đang làm, 'hoàn thành' → hoàn thành.
 */
async function nhiemVu(over = {}) {
  const t = {
    code: 'CV001-900',
    work_id: null,
    parent_id: null,
    level: 3,
    name: 'Nhiệm vụ thử',
    status: 'Đang thực hiện',
    priority: 'Trung bình',
    due_date: null,
    report_date: null,
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO work_items (code, work_id, parent_id, level, name, department_id,
                             status, priority, due_date, report_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      t.code,
      t.work_id,
      t.parent_id,
      t.level,
      t.name,
      t.department_id ?? null,
      t.status,
      t.priority,
      t.due_date,
      t.report_date,
    ]
  );
  return rows[0];
}

async function dangNhap(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

beforeEach(async () => {
  await resetTables();
  phongA = await makeDepartment({ code: 'PH01', name: 'Phòng A', sort_order: 1 });
  phongB = await makeDepartment({ code: 'PH02', name: 'Phòng B', sort_order: 2 });
  admin = await makeLoginUser({
    code: 'NV001',
    full_name: 'Quản trị Hệ thống',
    email: 'admin@test.local',
    role: 'admin',
    department_id: phongA.id,
  });
  apiAdmin = await dangNhap(admin);
});

describe('GET /api/v1/stats/summary — 4 thẻ + tỷ lệ', () => {
  it('chưa đăng nhập ⇒ 401', async () => {
    const res = await client(app).get('/api/v1/stats/summary');
    expect(res.status).toBe(401);
  });

  it('TC-STAT-01: tổng nhiệm vụ CHỈ đếm cấp 3 — cấp 2 là nhóm, không cộng vào', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    const sub = await makeItem({
      code: 'CV001-001',
      work_id: work.id,
      level: 2,
    });
    await nhiemVu({ code: 'CV001-002', work_id: work.id, parent_id: sub.id });
    await nhiemVu({ code: 'CV001-003', work_id: work.id });

    const res = await apiAdmin.get('/api/v1/stats/summary');
    expect(res.status).toBe(200);
    // 1 công việc con + 2 nhiệm vụ ⇒ tổng nhiệm vụ là 2, KHÔNG phải 3.
    expect(res.body.data.totalTasks).toBe(2);
    expect(res.body.data.totalWorks).toBe(1);
  });

  it('TC-STAT-02: 0 nhiệm vụ ⇒ tỷ lệ 0%, không NaN', async () => {
    await makeWork({ code: 'CV001', department_id: phongA.id });
    const res = await apiAdmin.get('/api/v1/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.totalTasks).toBe(0);
    expect(res.body.data.taskCompletionRate).toBe(0);
    expect(Number.isNaN(res.body.data.taskCompletionRate)).toBe(false);
  });

  it('TC-STAT-03/04: hạn TRƯỚC hôm nay mới quá hạn; hạn đúng hôm nay chưa quá; Hoàn thành không tính', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    await nhiemVu({ code: 'CV001-001', work_id: work.id, due_date: ngayLech(-1) });
    await nhiemVu({ code: 'CV001-002', work_id: work.id, due_date: ngayLech(0) });
    await nhiemVu({
      code: 'CV001-003',
      work_id: work.id,
      status: 'Hoàn thành',
      due_date: ngayLech(-30),
      report_date: ngayLech(-1),
    });
    const res = await apiAdmin.get('/api/v1/stats/summary');
    expect(res.body.data.overdueTasks).toBe(1); // chỉ CV001-001
    expect(res.body.data.ongoingTasks).toBe(2); // CV001-001 và CV001-002 cùng «Đang thực hiện»
    expect(res.body.data.completedTasks).toBe(1);
    expect(res.body.data.taskCompletionRate).toBe(33);
    expect(res.body.data.overdueRate).toBe(33);
  });

  it('TC-APR-06: thêm 1 mục Chờ duyệt ⇒ summary không đổi MỘT đơn vị (đường /stats)', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    await nhiemVu({ code: 'CV001-001', work_id: work.id });
    const truoc = (await apiAdmin.get('/api/v1/stats/summary')).body.data;

    const tp = await makeLoginUser({
      code: 'NV010',
      full_name: 'Trần Thị Trưởng',
      email: 'tp@test.local',
      role: 'Trưởng phòng',
      department_id: phongA.id,
    });
    const apiTp = await dangNhap(tp);
    // Mã chèn tay ở trên không nhích sequence (bẫy §13.5) — đẩy lên để API sinh được mã mới,
    // nếu không POST sẽ 409 IM LẶNG và test xanh giả vì mục Chờ duyệt chưa từng tồn tại.
    await pool.query(`SELECT setval('seq_work_code', 100, true)`);
    const tao = await apiTp.post('/api/v1/works', {
      name: 'Việc chờ duyệt',
      departmentId: phongA.id,
    });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);
    expect(tao.body.data.work.approval_status).toBe('Chờ duyệt');

    const sau = (await apiAdmin.get('/api/v1/stats/summary')).body.data;
    expect(sau).toEqual(truoc);
  });
});

describe('Lọc theo tháng — GIAO NHAU khoảng ngày (việc 6.4)', () => {
  it('TC-STAT-07: việc kéo từ tháng 2 đến tháng 4 CÓ trong kết quả lọc tháng 3', async () => {
    await makeWork({
      code: 'CV001',
      department_id: phongA.id,
      start_date: '2026-02-10',
      end_date: '2026-04-20',
    });
    const res = await apiAdmin.get('/api/v1/stats/summary?from=2026-03-01&to=2026-03-31');
    expect(res.body.data.totalWorks).toBe(1);
  });

  it('TC-STAT-08: việc kết thúc đúng ngày 01 của tháng lọc VẪN có', async () => {
    await makeWork({
      code: 'CV001',
      department_id: phongA.id,
      start_date: '2026-02-01',
      end_date: '2026-03-01',
    });
    const res = await apiAdmin.get('/api/v1/stats/summary?from=2026-03-01&to=2026-03-31');
    expect(res.body.data.totalWorks).toBe(1);
  });

  it('TC-STAT-09: thiếu ngày bắt đầu HOẶC ngày kết thúc ⇒ không mất dòng, không lỗi', async () => {
    await makeWork({ code: 'CV001', department_id: phongA.id, start_date: null, end_date: null });
    await makeWork({
      code: 'CV002',
      department_id: phongA.id,
      start_date: '2026-03-05',
      end_date: null,
    });
    await makeWork({
      code: 'CV003',
      department_id: phongA.id,
      start_date: null,
      end_date: '2026-02-15',
    });
    const res = await apiAdmin.get('/api/v1/stats/summary?from=2026-03-01&to=2026-03-31');
    expect(res.status).toBe(200);
    // CV001 không ngày nào ⇒ luôn giữ. CV002 bắt đầu trong tháng ⇒ giữ.
    // CV003 kết thúc 15/02 ⇒ coi như kéo dài vô hạn ⇒ vẫn GIAO với tháng 3 ⇒ giữ.
    expect(res.body.data.totalWorks).toBe(3);
  });

  it('thiếu from hoặc to ⇒ không lọc theo khoảng', async () => {
    await makeWork({
      code: 'CV001',
      department_id: phongA.id,
      start_date: '2020-01-01',
      end_date: '2020-12-31',
    });
    const chiTo = await apiAdmin.get('/api/v1/stats/summary?to=2026-03-31');
    expect(chiTo.body.data.totalWorks).toBe(1);
    const chiFrom = await apiAdmin.get('/api/v1/stats/summary?from=2030-01-01');
    expect(chiFrom.body.data.totalWorks).toBe(1);
  });

  it('ngày sai định dạng ⇒ 400', async () => {
    const res = await apiAdmin.get('/api/v1/stats/summary?from=10/09/2026');
    expect(res.status).toBe(400);
  });
});

describe('Lọc theo phòng — ÉP ở SERVER (việc 6.5)', () => {
  beforeEach(async () => {
    await makeWork({ code: 'CV001', name: 'Việc phòng A', department_id: phongA.id });
    await makeWork({ code: 'CV002', name: 'Việc phòng B', department_id: phongB.id });
  });

  it('TC-STAT-10: nhân viên truyền ?departmentIds= phòng khác bị ép về phòng mình', async () => {
    const nv = await makeLoginUser({
      code: 'NV011',
      full_name: 'Nhân Viên A',
      email: 'nv@test.local',
      role: 'Nhân viên',
      department_id: phongA.id,
    });
    const apiNv = await dangNhap(nv);

    // Hỏi thẳng phòng B — query string nói gì cũng vậy, máy chủ chỉ trả phòng A của họ.
    const res = await apiNv.get(`/api/v1/stats/summary?departmentIds=${phongB.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalWorks).toBe(1); // chỉ CV001

    const charts = await apiNv.get(`/api/v1/stats/charts?type=status&departmentIds=${phongB.id}`);
    expect(charts.status).toBe(200); // phòng A không có nhiệm vụ ⇒ rỗng + message
    expect(charts.body.data.labels).toEqual([]);
  });

  it('admin chọn được nhiều phòng; bỏ trống ⇒ tất cả', async () => {
    const caHai = await apiAdmin.get(
      `/api/v1/stats/summary?departmentIds=${phongA.id},${phongB.id}`
    );
    expect(caHai.body.data.totalWorks).toBe(2);
    const tatCa = await apiAdmin.get('/api/v1/stats/summary');
    expect(tatCa.body.data.totalWorks).toBe(2);
    const motPhong = await apiAdmin.get(`/api/v1/stats/summary?departmentIds=${phongB.id}`);
    expect(motPhong.body.data.totalWorks).toBe(1);
  });

  it('Phó GĐ yêu cầu vượt phạm vi phụ trách bị CẮT về đúng các phòng mình quản lý', async () => {
    const pgd = await makeLoginUser({
      code: 'NV005',
      full_name: 'Phó Giám Đốc',
      email: 'pgd@test.local',
      role: 'Phó Giám đốc',
      department_id: phongA.id,
    });
    // Phó GĐ chỉ phụ trách phòng A.
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role)
       VALUES ($1,$2,'deputy_director')`,
      [phongA.id, pgd.id]
    );
    const apiPgd = await dangNhap(pgd);
    // Xin cả A lẫn B — chỉ còn A.
    const res = await apiPgd.get(`/api/v1/stats/summary?departmentIds=${phongA.id},${phongB.id}`);
    expect(res.body.data.totalWorks).toBe(1);
  });
});

describe('GET /api/v1/stats/charts?type= — đủ 6 loại', () => {
  const LOAI = [
    'status',
    'project-progress',
    'staff-performance',
    'task-priority',
    'timeline-progress',
    'project-comparison',
  ];

  it('TC-STAT-05: không có dữ liệu ⇒ 6 loại đều {labels:[],data:[]} + thông báo, không lỗi', async () => {
    for (const type of LOAI) {
      const res = await apiAdmin.get(`/api/v1/stats/charts?type=${type}`);
      expect(res.status, `type=${type}`).toBe(200);
      expect(res.body.data.labels, `type=${type}`).toEqual([]);
      expect(res.body.data.data, `type=${type}`).toEqual([]);
      expect(String(res.body.data.message), `type=${type}`).toContain('Không có dữ liệu');
    }
  });

  it('type lạ ⇒ 400 kèm câu liệt kê 6 loại hợp lệ', async () => {
    const res = await apiAdmin.get('/api/v1/stats/charts?type=biet-noi');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('status');
  });

  it('có dữ liệu ⇒ status trả nhãn theo trạng thái; task-priority đủ 3 nhãn', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    await nhiemVu({ code: 'CV001-001', work_id: work.id, status: 'Đang thực hiện' });
    await nhiemVu({
      code: 'CV001-002',
      work_id: work.id,
      status: 'Hoàn thành',
      report_date: ngayLech(-1),
    });

    const status = await apiAdmin.get('/api/v1/stats/charts?type=status');
    expect(status.body.data.labels.sort()).toEqual(['Đang thực hiện', 'Hoàn thành'].sort());
    expect(status.body.data.data.sort()).toEqual([1, 1]);

    const uuTien = await apiAdmin.get('/api/v1/stats/charts?type=task-priority');
    expect(uuTien.body.data.labels).toEqual(['Thấp', 'Trung bình', 'Cao']);
    expect(uuTien.body.data.data).toEqual([0, 2, 0]);
  });

  it('TC-APR-06: thêm 1 mục Chờ duyệt ⇒ cả 6 biểu đồ không đổi MỘT đơn vị', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    await nhiemVu({ code: 'CV001-001', work_id: work.id, status: 'Đang thực hiện' });
    const truoc = {};
    for (const type of LOAI) {
      truoc[type] = (await apiAdmin.get(`/api/v1/stats/charts?type=${type}`)).body.data;
    }

    const tp = await makeLoginUser({
      code: 'NV010',
      full_name: 'Trần Thị Trưởng',
      email: 'tp@test.local',
      role: 'Trưởng phòng',
      department_id: phongA.id,
    });
    const apiTp = await dangNhap(tp);
    await pool.query(`SELECT setval('seq_work_code', 100, true)`); // tránh 409 với mã chèn tay
    const tao = await apiTp.post('/api/v1/works', {
      name: 'Việc chờ duyệt',
      departmentId: phongA.id,
    });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);
    const sub = await apiTp.post('/api/v1/work-items', {
      workRef: tao.body.data.work.code,
      name: 'Con chờ duyệt',
      level: 2,
    });
    expect(sub.body.data.item.approval_status).toBe('Chờ duyệt');

    for (const type of LOAI) {
      const sau = (await apiAdmin.get(`/api/v1/stats/charts?type=${type}`)).body.data;
      expect(sau, `type=${type}`).toEqual(truoc[type]);
    }
  });
});

describe('GET /api/v1/stats/activities — hoạt động gần đây CÓ PHÂN TRANG (việc 6.3)', () => {
  async function ghiLog(n, actor) {
    for (let i = 0; i < n; i += 1) {
      await pool.query(
        `INSERT INTO activity_logs (actor_id, actor_name, action, entity_type)
         VALUES ($1,$2,'works.create','work')`,
        [actor.id, actor.full_name]
      );
    }
  }

  /** Lời ĐĂNG NHẬP cũng ghi audit log — xoá sạch sau khi vào phiên để số đo không nhiễu. */
  const donLog = () => pool.query('DELETE FROM activity_logs');

  it('trả đúng trang, tổng số và tổng số trang', async () => {
    await donLog();
    await ghiLog(7, admin);
    const p1 = await apiAdmin.get('/api/v1/stats/activities?page=1&limit=5');
    expect(p1.status).toBe(200);
    expect(p1.body.data.activities).toHaveLength(5);
    expect(p1.body.data.total).toBe(7);
    expect(p1.body.data.totalPages).toBe(2);

    const p2 = await apiAdmin.get('/api/v1/stats/activities?page=2&limit=5');
    expect(p2.body.data.activities).toHaveLength(2);

    // Mới nhất trước (ORDER BY id DESC).
    const ids = p1.body.data.activities.map((r) => r.id);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  });

  it('vai khác admin chỉ thấy nhật ký do chính mình ghi — cùng luật bootstrap', async () => {
    const nv = await makeLoginUser({
      code: 'NV011',
      full_name: 'Nhân Viên A',
      email: 'nv@test.local',
      role: 'Nhân viên',
      department_id: phongA.id,
    });
    const apiNv = await dangNhap(nv);
    await donLog(); // xoá luôn dòng audit của hai lần đăng nhập
    await ghiLog(3, admin);
    await ghiLog(2, nv);

    const res = await apiNv.get('/api/v1/stats/activities');
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.activities.every((r) => r.actor_id === nv.id)).toBe(true);

    const adminRes = await apiAdmin.get('/api/v1/stats/activities?limit=100');
    expect(adminRes.body.data.total).toBe(5); // admin thấy tất cả
  });
});

describe('Mọi truy vấn thống kê đọc qua view v_countable_* (việc 5.4)', () => {
  const explain = async (sql) => {
    const { rows } = await pool.query(`EXPLAIN (FORMAT TEXT) ${sql}`);
    return rows.map((r) => r['QUERY PLAN']).join('\n');
  };

  it('câu thống kê gọi đúng hai view, không FROM bảng gốc', () => {
    expect(QUERIES.works).toMatch(/\bv_countable_works\b/);
    expect(QUERIES.items).toMatch(/\bv_countable_items\b/);
    expect(QUERIES.works).not.toMatch(/\bFROM\s+works\b/i);
    expect(QUERIES.items).not.toMatch(/\bFROM\s+work_items\b/i);
  });

  it('EXPLAIN chạy được và kế hoạch mang bộ lọc «Chờ duyệt» của view', async () => {
    // Postgres INLINE view nên plan không còn tên view — dấu vết đáng tin là điều kiện
    // `approval_status <> 'Chờ duyệt'` xuất hiện trên từng bảng gốc.
    const planWorks = await explain(QUERIES.works);
    const planItems = await explain(QUERIES.items);
    expect(planWorks).toContain('Chờ duyệt');
    expect(planItems).toContain('Chờ duyệt');
  });
});

afterAll(async () => {
  await closePool();
});

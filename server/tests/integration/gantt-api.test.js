// API Gantt — Phase 6 (§7 việc 6.6, §8.4 nhóm F).
//
// TC-STAT-11: thứ tự phòng theo `sort_order` · TC-STAT-12: một Phó GĐ phụ trách 2 phòng ⇒ gộp
// cả hai vào một nhóm · mục «Chờ duyệt» không xuất hiện trên cây (đọc qua view) · nhân viên
// truyền ?departmentIds= phòng khác vẫn bị ép về phòng mình.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, makeItem, makeWork, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

let phongA;
let phongB;
let admin;
let apiAdmin;

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

afterAll(async () => {
  await closePool();
});

describe('GET /api/v1/gantt — nhóm theo Phòng', () => {
  it('TC-STAT-11: thứ tự nhóm theo sort_order của phòng, KHÔNG theo id/thời điểm tạo', async () => {
    const phongC = await makeDepartment({ code: 'PH03', name: 'Phòng C', sort_order: 3 });
    await makeWork({ code: 'CV003', name: 'Việc C', department_id: phongC.id });
    await makeWork({ code: 'CV002', name: 'Việc B', department_id: phongB.id });
    await makeWork({ code: 'CV001', name: 'Việc A', department_id: phongA.id });

    const res = await apiAdmin.get('/api/v1/gantt');
    expect(res.status).toBe(200);
    const tenNhoms = res.body.data.groups.map((g) => g.name);
    expect(tenNhoms).toEqual(['Phòng A', 'Phòng B', 'Phòng C']);
    expect(res.body.data.groups[0].works[0].code).toBe('CV001');
  });

  it('việc thuộc phòng không tồn tại trong danh sách rơi vào nhóm «(chưa phân)» xếp cuối', async () => {
    await makeWork({ code: 'CV001', department_id: null });
    await makeWork({ code: 'CV002', department_id: phongA.id });
    const res = await apiAdmin.get('/api/v1/gantt');
    const names = res.body.data.groups.map((g) => g.name);
    expect(names[names.length - 1]).toBe('(chưa phân)');
    expect(res.body.data.groups[0].works).toHaveLength(1);
  });

  it('cây trả kèm tên Ban kiểm soát / lãnh đạo phòng và «Kết quả đầu ra» cho tooltip', async () => {
    const pgd = await makeLoginUser({
      code: 'NV006',
      full_name: 'Phó GĐ Kiểm Soát',
      email: 'pgdks@test.local',
      role: 'Phó Giám đốc',
      department_id: phongA.id,
    });
    const tpb = await makeLoginUser({
      code: 'NV007',
      full_name: 'Trần Trưởng B',
      email: 'tpb@test.local',
      role: 'Trưởng phòng',
      department_id: phongA.id,
    });
    // ĐỢT A (028): «Ban lãnh đạo kiểm soát» nay là MẢNG, nên ca này phải có HAI người để ghim được
    // chuyện tooltip nối tên bằng dấu phẩy. Chỉ một người thì «một tên» và «nối một tên» giống hệt
    // nhau, ca sẽ xanh cả khi chỗ nối bị bỏ — đúng kiểu test không phân biệt được hai hành vi.
    const pgd2 = await makeLoginUser({
      code: 'NV008',
      full_name: 'Phó GĐ Kiểm Soát Hai',
      email: 'pgdks2@test.local',
      role: 'Phó Giám đốc',
      department_id: phongA.id,
    });
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    await pool.query(
      `UPDATE works SET supervisor_ids = ARRAY[$2,$3]::bigint[], leader_ids = $4 WHERE id = $1`,
      [work.id, pgd.id, pgd2.id, [tpb.id]]
    );
    await pool.query(
      `INSERT INTO work_items (code, work_id, level, name, assignee_name, leader_ids, output)
       VALUES ('CV001-001', $1, 3, 'Nhiệm vụ tooltip', 'Nguyễn Văn A', ARRAY[$2]::bigint[], 'Bản báo cáo PDF')`,
      [work.id, tpb.id]
    );

    const res = await apiAdmin.get('/api/v1/gantt');
    const w = res.body.data.groups[0].works[0];
    // `supervisorName` vẫn là MỘT CHUỖI (hình dạng phản hồi không đổi) nhưng nay nối các tên,
    // đúng khuôn `leaderNames` — thứ tự theo `supervisor_ids`, không sắp xếp lại theo tên.
    expect(w.supervisorName).toBe('Phó GĐ Kiểm Soát, Phó GĐ Kiểm Soát Hai');
    expect(w.leaderNames).toEqual(['Trần Trưởng B']);
    const task = w.tasks.find((t) => t.code === 'CV001-001');
    expect(task.leaderNames).toEqual(['Trần Trưởng B']);
    expect(task.output).toBe('Bản báo cáo PDF');
  });
});

describe('GET /api/v1/gantt — nhóm theo Phó Giám đốc + cây 4 mức', () => {
  it('TC-STAT-12: một Phó GĐ phụ trách 2 phòng ⇒ công việc của CẢ HAI nằm trong MỘT nhóm', async () => {
    await makeWork({ code: 'CV001', department_id: phongA.id });
    await makeWork({ code: 'CV002', department_id: phongB.id });

    const pgd = await makeLoginUser({
      code: 'NV005',
      full_name: 'Phó Giám Đốc Hai Phòng',
      email: 'pgd@test.local',
      role: 'Phó Giám đốc',
      department_id: phongA.id,
    });
    await pool.query(
      `INSERT INTO department_managers (department_id, user_id, role)
       VALUES ($1,$2,'deputy_director'), ($3,$2,'deputy_director')`,
      [phongA.id, pgd.id, phongB.id]
    );

    const res = await apiAdmin.get('/api/v1/gantt?groupBy=deputy');
    expect(res.body.data.groupBy).toBe('deputy');
    const nhomPgd = res.body.data.groups.find((g) => g.key === `deputy:${pgd.id}`);
    expect(nhomPgd.works.map((w) => w.code).sort()).toEqual(['CV001', 'CV002']);
    expect(nhomPgd.sortOrder).toBe(1); // sort_order của phòng đầu tiên
  });

  it('cây đủ 4 mức; nhiệm vụ mồ côi nằm thẳng dưới công việc; tiến độ tính ở server', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    const sub = await makeItem({ code: 'CV001-001', work_id: work.id, level: 2 });
    await makeItem({
      code: 'CV001-002',
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
      name: 'Nhiệm vụ trong con',
    });
    // makeItem không chèn cột nghiệp vụ — cập nhật trạng thái riêng.
    await pool.query(`UPDATE work_items SET status = 'Hoàn thành' WHERE code = 'CV001-002'`);

    await makeItem({
      code: 'CV001-009',
      work_id: work.id,
      level: 3,
      name: 'Nhiệm vụ mồ côi',
    });

    // V2: phải có BẢN thật ở CSDL; nhóm chưa có bản luôn 0% dù mang trạng thái kết thúc.
    // Hai file 50/50 có mốc 100/50 ⇒ nhiệm vụ trong con 75%; nhiệm vụ trực tiếp 100%.
    // Hai đầu mục 60/40 ⇒ công việc = (60×75 + 40×100)/100 = 85%, thay 70% nhị phân cũ.
    await pool.query(`UPDATE work_items SET ty_le = 60 WHERE code = 'CV001-001'`);
    await pool.query(`UPDATE work_items SET ty_le = 40 WHERE code = 'CV001-009'`);
    await pool.query(
      `WITH nhom AS (
         INSERT INTO task_files (item_id, ten_goc, trang_thai, ty_le)
         SELECT i.id, 'ket-qua.docx', 'hoan-thanh', 50 FROM work_items i WHERE i.code = 'CV001-002'
         UNION ALL
         SELECT i.id, 'ban-nhap.docx', 'cho-xem', 50 FROM work_items i WHERE i.code = 'CV001-002'
         UNION ALL
         SELECT i.id, 'bao-cao.pdf', 'da-duyet', 100 FROM work_items i WHERE i.code = 'CV001-009'
         RETURNING id, ten_goc
       )
       INSERT INTO task_file_versions(file_id,version_no,ten_luu,ten_goc,loai_mime,kich_thuoc,uploaded_by)
       SELECT id,1,'fixture-' || id,ten_goc,'application/octet-stream',1,$1 FROM nhom`,
      [admin.id]
    );

    await pool.query("UPDATE work_items SET ty_le = 100 WHERE code = 'CV001-002'");
    const res = await apiAdmin.get('/api/v1/gantt');
    const workNode = res.body.data.groups[0].works[0];
    expect(workNode.subs).toHaveLength(1);
    expect(workNode.subs[0].children.map((t) => t.code)).toEqual(['CV001-002']);
    expect(workNode.tasks.map((t) => t.name)).toEqual(['Nhiệm vụ mồ côi']);
    expect(workNode.taskCount).toBe(2);
    expect(workNode.completedCount).toBe(1); // vẫn đếm theo TRẠNG THÁI cấp 3
    expect(workNode.progress).toBe(85);
    // Thanh Gantt của từng dòng tô theo tiến độ file, không đọc `completion` cũ.
    expect(workNode.subs[0].completion).toBe(75);
    expect(workNode.subs[0].children[0].completion).toBe(75);
    expect(workNode.tasks[0].completion).toBe(100);
  });
});

describe('GET /api/v1/gantt — nhóm theo Người thực hiện + lọc + khoá', () => {
  it('assignee: công việc vào nhóm người có nhiệm vụ bên trong; chưa gán ⇒ «(chưa phân)»', async () => {
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    await pool.query(
      `INSERT INTO work_items (code, work_id, level, name, assignee_name)
       VALUES ('CV001-001', $1, 3, 'Nhiệm vụ của Lan', 'Trần Thị Lan')`,
      [work.id]
    );
    const res = await apiAdmin.get('/api/v1/gantt?groupBy=assignee');
    expect(res.body.data.groups.map((g) => g.name)).toEqual(['Trần Thị Lan']);
    expect(res.body.data.groups[0].works[0].code).toBe('CV001');
  });

  // 2026-09-09 — Trưởng/Phó phòng được nhận việc trực tiếp nên nhóm Gantt phải nói rõ ai là lãnh
  // đạo: tên nhóm kèm vai trong NGOẶC và lãnh đạo xếp SAU Cán bộ. Vai tra theo `assignee_id`,
  // không đoán từ tên (tên tự do nhập không dò ra ai thì giữ nguyên tên trơn — ca ngay trên đây).
  it('assignee: nhiệm vụ giao cho Trưởng phòng ⇒ nhóm kèm vai và đứng SAU nhóm Cán bộ', async () => {
    const tp = await makeLoginUser({
      code: 'NV020',
      full_name: 'An Trưởng Phòng',
      email: 'tp-gantt@test.local',
      role: 'Trưởng phòng',
      department_id: phongA.id,
    });
    const canBo = await makeLoginUser({
      code: 'NV021',
      full_name: 'Nguyễn Văn Cán Bộ',
      email: 'nv-gantt@test.local',
      role: 'Nhân viên',
      department_id: phongA.id,
    });
    const work = await makeWork({ code: 'CV001', department_id: phongA.id });
    // «An» đứng trước «Nguyễn» theo chữ cái — nếu nó vẫn xuống cuối là nhờ luật tách vai.
    await pool.query(
      `INSERT INTO work_items (code, work_id, level, name, assignee_id, assignee_name)
       VALUES ('CV001-001', $1, 3, 'Việc của Trưởng phòng', $2, $3),
              ('CV001-002', $1, 3, 'Việc của Cán bộ', $4, $5)`,
      [work.id, tp.id, tp.full_name, canBo.id, canBo.full_name]
    );
    const res = await apiAdmin.get('/api/v1/gantt?groupBy=assignee');
    expect(res.status).toBe(200);
    expect(res.body.data.groups.map((g) => g.name)).toEqual([
      'Nguyễn Văn Cán Bộ',
      'An Trưởng Phòng (Trưởng phòng)',
    ]);
    // Cả hai nhóm đều thấy đúng công việc đó (một công việc rơi vào nhóm của MỌI người trong nó).
    expect(res.body.data.groups[1].works[0].code).toBe('CV001');
    // `vai` chỉ là trường phụ để sắp xếp — không được lọt ra phản hồi.
    expect(res.body.data.groups[1]).not.toHaveProperty('vai');
  });

  it('khoảng from/to: việc ngoài hẳn khoảng biến mất khỏi cây, việc vắt qua thì còn', async () => {
    await makeWork({
      code: 'CV001',
      department_id: phongA.id,
      start_date: '2020-01-01',
      end_date: '2020-01-31',
    });
    await makeWork({
      code: 'CV002',
      department_id: phongA.id,
      start_date: '2026-02-10',
      end_date: '2026-04-20',
    });
    const res = await apiAdmin.get('/api/v1/gantt?from=2026-03-01&to=2026-03-31');
    const codes = res.body.data.groups[0].works.map((w) => w.code);
    expect(codes).toEqual(['CV002']); // CV001 kết thúc 2020 ⇒ ngoài hẳn
  });

  it('TC-STAT-10: nhân viên truyền ?departmentIds= phòng khác vẫn chỉ thấy phòng mình', async () => {
    await makeWork({ code: 'CV001', department_id: phongA.id });
    await makeWork({ code: 'CV002', department_id: phongB.id });
    const nv = await makeLoginUser({
      code: 'NV011',
      full_name: 'Nhân Viên A',
      email: 'nv@test.local',
      role: 'Nhân viên',
      department_id: phongA.id,
    });
    const apiNv = await dangNhap(nv);
    const res = await apiNv.get(`/api/v1/gantt?departmentIds=${phongB.id}`);
    const tatCaWorks = res.body.data.groups.flatMap((g) => g.works.map((w) => w.code));
    expect(tatCaWorks).toEqual(['CV001']);
  });

  it('mục Chờ duyệt không xuất hiện trên cây Gantt (đọc qua view)', async () => {
    const tp = await makeLoginUser({
      code: 'NV010',
      full_name: 'Trần Thị Trưởng',
      email: 'tp@test.local',
      role: 'Trưởng phòng',
      department_id: phongA.id,
    });
    const apiTp = await dangNhap(tp);
    await pool.query(`SELECT setval('seq_work_code', 100, true)`);
    const tao = await apiTp.post('/api/v1/works', {
      name: 'Việc chờ duyệt',
      departmentId: phongA.id,
    });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);

    const res = await apiAdmin.get('/api/v1/gantt');
    const tatCaWorks = res.body.data.groups.flatMap((g) => g.works);
    expect(tatCaWorks).toHaveLength(0);
  });

  it('groupBy lạ ⇒ 400 · chưa đăng nhập ⇒ 401', async () => {
    const sai = await apiAdmin.get('/api/v1/gantt?groupBy=biet-noi');
    expect(sai.status).toBe(400);

    const khach = await client(app).get('/api/v1/gantt');
    expect(khach.status).toBe(401);
  });
});

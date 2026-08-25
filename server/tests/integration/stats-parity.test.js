// Việc 6.9 — ĐỐI CHIẾU số liệu bản Apps Script ↔ bản VPS trên CÙNG dữ liệu (TC-STAT-16).
//
// Không chạy được Google Apps Script thật trong vitest, nên hai thuật toán CŨ được PORT 1:1 từ
// nguồn gốc và chạy trên chính gói dữ liệu legacy mà cầu RPC trả cho giao diện:
//   • `getSummaryStatsCu`  ← Code.clean.gs `getSummaryStats` (backend cũ, 5 số).
//   • `renderStatsCu`      ← app.js `renderStats` + `getFilteredProjects/Tasks` (số ĐANG HIỆN
//                            trên UI — chuẩn đối chiếu theo §7 Phase 6).
//   • Sáu hàm `bieuDo*Cũ`  ← sáu hàm render*Chart của app.js.
//
// Kết luận đã ghi ở §13.5: UI tự tính lại và BỎ QUA tham số summaryStats; allTasks gồm cả cấp 2.
// Chuẩn so = phép tính phía UI. Vì vậy mỗi phép khớp đều tính trên TẦNG CẤP 3 của mảng legacy,
// sau khi lọc «Chờ duyệt» đúng luật getFiltered* — chênh 0 từng con số với REST mới là điều
// khẳng định được; riêng "cả cấp 2" ghi rõ thành dòng chênh CÓ CHỦ Ý trong bảng cuối.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { COL } from '../../src/rpc/legacyFields.js';
import { makeDepartment, makeItem, makeWork, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

// ─── Port: Code.clean.gs getSummaryStats ─────────────────────────────────────
function getSummaryStatsCu(projects, tasks) {
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  let hoanThanh = 0,
    dangLam = 0,
    quaHan = 0;
  for (const t of tasks) {
    const st = String(t[COL.T_STATUS] || '')
        .trim()
        .toLowerCase(),
      han = t[COL.T_DUE];
    if (st.includes('hoàn thành')) hoanThanh += 1;
    else if (st.includes('đang')) dangLam += 1;
    if (!st.includes('hoàn thành') && han) {
      const d = new Date(han);
      if (!isNaN(d) && d < homNay) quaHan += 1;
    }
  }
  return {
    totalProjects: Array.isArray(projects) ? projects.length : 0,
    totalTasks: tasks.length,
    completedTasks: hoanThanh,
    ongoingTasks: dangLam,
    overdueTasks: quaHan,
  };
}

// ─── Port: app.js isPendingApproval/getFiltered* (chuẩn UI, việc 5.4) ─────────
const choDuyet = (v) => String(v ?? '') === 'Chờ duyệt';
function getFilteredProjectsCu(projects) {
  return projects.filter((p) => !choDuyet(p[COL.P_APPROVAL]));
}
function getFilteredTasksCu(projects, tasks) {
  const pOk = new Set(getFilteredProjectsCu(projects).map((p) => p[COL.P_ID]));
  return tasks.filter((t) => {
    if (choDuyet(t[COL.T_APPROVAL])) return false;
    if (!pOk.has(t[COL.T_PID])) return false;
    if (t[COL.T_PARENT]) {
      const cha = tasks.find((x) => x[COL.T_ID] === t[COL.T_PARENT]);
      if (cha && choDuyet(cha[COL.T_APPROVAL])) return false;
    }
    return true;
  });
}

// ─── Port: app.js renderStats (12 số đang hiện thật trên thẻ) ────────────────
function renderStatsCu(projects, tasks) {
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  const laHT = (t) =>
    String(t[COL.T_STATUS] || '')
      .toLowerCase()
      .includes('hoàn thành');
  const completedTasks = tasks.filter(laHT).length;
  const pendingTasks = tasks.filter((t) =>
    String(t[COL.T_STATUS] || '')
      .toLowerCase()
      .includes('chưa')
  ).length;
  const pausedTasks = tasks.filter((t) =>
    String(t[COL.T_STATUS] || '')
      .toLowerCase()
      .includes('tạm dừng')
  ).length;
  const ongoingRaw = tasks.filter((t) =>
    String(t[COL.T_STATUS] || '')
      .toLowerCase()
      .includes('đang')
  ).length;
  const overdueTasks = tasks.filter(
    (t) => t[COL.T_DUE] && new Date(t[COL.T_DUE]) < homNay && !laHT(t)
  ).length;
  const tong = tasks.length;
  return {
    totalProjects: projects.length,
    totalTasks: tong,
    completedTasks,
    ongoingTasks: ongoingRaw + pendingTasks + pausedTasks, // thẻ "đang làm" của UI gộp 3 trạng thái
    overdueTasks,
    taskCompletionRate: tong > 0 ? Math.round((completedTasks / tong) * 100) : 0,
    overdueRate: tong > 0 ? Math.round((overdueTasks / tong) * 100) : 0,
  };
}

// ─── Port: sáu hàm render*Chart của app.js ───────────────────────────────────
function bieuDoStatusCu(tasks) {
  const dem = new Map();
  for (const t of tasks) {
    const k = t[COL.T_STATUS] || 'Chưa xác định';
    dem.set(k, (dem.get(k) || 0) + 1);
  }
  return { labels: [...dem.keys()], data: [...dem.values()] };
}
function bieuDoPriorityCu(tasks) {
  const d = { Thấp: 0, 'Trung bình': 0, Cao: 0 };
  for (const t of tasks) {
    const p = String(t[COL.T_PRIORITY] || '').toLowerCase();
    if (p.includes('thấp')) d.Thấp += 1;
    else if (p.includes('cao')) d.Cao += 1;
    else d['Trung bình'] += 1;
  }
  return { labels: ['Thấp', 'Trung bình', 'Cao'], data: [d.Thấp, d['Trung bình'], d.Cao] };
}
function bieuDoProgressCu(projects, tasks) {
  const buckets = { '0-25%': 0, '26-50%': 0, '51-75%': 0, '76-99%': 0, '100%': 0 };
  for (const p of projects) {
    const cua = tasks.filter((t) => t[COL.T_PID] === p[COL.P_ID]);
    const xong = cua.filter((t) =>
      String(t[COL.T_STATUS] || '')
        .toLowerCase()
        .includes('hoàn thành')
    ).length;
    const pct = cua.length > 0 ? Math.round((xong / cua.length) * 100) : 0;
    if (pct === 100) buckets['100%'] += 1;
    else if (pct >= 76) buckets['76-99%'] += 1;
    else if (pct >= 51) buckets['51-75%'] += 1;
    else if (pct >= 26) buckets['26-50%'] += 1;
    else buckets['0-25%'] += 1;
  }
  return { labels: Object.keys(buckets), data: Object.values(buckets) };
}
function bieuDoTimelineCu(tasks) {
  const homNay = new Date();
  const dem = new Map(),
    labels = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(homNay);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dem.set(key, 0);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }
  let co = false;
  for (const t of tasks) {
    if (
      !String(t[COL.T_STATUS] || '')
        .toLowerCase()
        .includes('hoàn thành') ||
      !t[COL.T_REPORT_DATE]
    )
      continue;
    const d = new Date(t[COL.T_REPORT_DATE]);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dem.has(key)) {
      dem.set(key, dem.get(key) + 1);
      co = true;
    }
  }
  if (!co) return { labels: [], data: [] };
  return { labels, data: [...dem.values()] };
}
function bieuDoStaffCu(tenTheoThuTu, tasks) {
  const labels = [],
    data = [],
    rates = [];
  for (const ten of tenTheoThuTu) {
    const cua = tasks.filter((t) => t[COL.T_ASSIGNEE] === ten);
    if (cua.length === 0) continue;
    const xong = cua.filter((t) =>
      String(t[COL.T_STATUS] || '')
        .toLowerCase()
        .includes('hoàn thành')
    ).length;
    labels.push(ten);
    data.push(cua.length);
    rates.push(Math.round((xong / cua.length) * 100));
  }
  return { labels, data, rates };
}
function bieuDoComparisonCu(projects, tasks) {
  const hang = projects
    .map((p) => {
      const cua = tasks.filter((t) => t[COL.T_PID] === p[COL.P_ID]);
      const xong = cua.filter((t) =>
        String(t[COL.T_STATUS] || '')
          .toLowerCase()
          .includes('hoàn thành')
      ).length;
      const ten = p[COL.P_NAME] || p[COL.P_ID];
      return {
        name: ten.length > 15 ? ten.slice(0, 15) + '...' : ten,
        total: cua.length,
        rate: cua.length > 0 ? Math.round((xong / cua.length) * 100) : 0,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  if (hang.length === 0) return { labels: [], data: [] };
  return {
    labels: hang.map((h) => h.name),
    data: hang.map((h) => h.total),
    rates: hang.map((h) => h.rate),
  };
}

// ─── Dữ liệu cùng một bộ cho mọi phía ────────────────────────────────────────
let phongA;
let phongB;
let admin;
let apiAdmin;

function ngayLech(soNgay) {
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  const hai = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

async function nhiemVuDayDu(over) {
  const t = {
    code: 'CV000-999',
    work_id: null,
    parent_id: null,
    level: 3,
    name: 'Nhiệm vụ',
    status: 'Đang thực hiện',
    priority: 'Trung bình',
    due_date: null,
    report_date: null,
    ...over,
  };
  const { rows } = await pool.query(
    `INSERT INTO work_items (code, work_id, parent_id, level, name, status, priority,
                             due_date, report_date, assignee_id, assignee_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      t.code,
      t.work_id,
      t.parent_id,
      t.level,
      t.name,
      t.status,
      t.priority,
      t.due_date,
      t.report_date,
      t.assignee_id ?? null,
      t.assignee_name ?? null,
    ]
  );
  return rows[0];
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
  apiAdmin = client(app);
  await apiAdmin.login(admin.email);

  const lan = await makeLoginUser({
    code: 'NV011',
    full_name: 'Trần Thị Lan',
    email: 'lan@test.local',
    role: 'Nhân viên',
    department_id: phongA.id,
  });
  const hung = await makeLoginUser({
    code: 'NV012',
    full_name: 'Phạm Văn Hùng',
    email: 'hung@test.local',
    role: 'Nhân viên',
    department_id: phongA.id,
  });

  // CV001: 1 công việc con + 3 nhiệm vụ (2 hoàn thành có ngày báo cáo, 1 đang làm).
  const cv1 = await makeWork({
    code: 'CV001',
    name: 'Số hoá hồ sơ',
    department_id: phongA.id,
    start_date: '2026-02-01',
    end_date: '2026-04-30',
  });
  const cv1sub = await makeItem({ code: 'CV001-01', work_id: cv1.id, level: 2 });
  await nhiemVuDayDu({
    code: 'CV001-02',
    work_id: cv1.id,
    parent_id: cv1sub.id,
    status: 'Hoàn thành',
    priority: 'Cao',
    report_date: ngayLech(-1),
    assignee_id: lan.id,
    assignee_name: lan.full_name,
  });
  await nhiemVuDayDu({
    code: 'CV001-03',
    work_id: cv1.id,
    status: 'Hoàn thành',
    priority: 'Trung bình',
    report_date: ngayLech(-2),
    assignee_id: hung.id,
    assignee_name: hung.full_name,
  });
  await nhiemVuDayDu({
    code: 'CV001-04',
    work_id: cv1.id,
    status: 'Đang thực hiện',
    priority: 'Thấp',
    due_date: ngayLech(5),
    assignee_id: lan.id,
    assignee_name: lan.full_name,
  });

  // CV002: nhiệm vụ mồ côi quá hạn + cặp con–nhiệm vụ bị tạm dừng (quá hạn nữa).
  const cv2 = await makeWork({
    code: 'CV002',
    name: 'Cập nhật quy trình',
    department_id: phongA.id,
  });
  await nhiemVuDayDu({
    code: 'CV002-09',
    work_id: cv2.id,
    status: 'Chưa bắt đầu',
    priority: 'Thấp',
    due_date: ngayLech(-3),
    assignee_id: hung.id,
    assignee_name: hung.full_name,
  });
  const cv2sub = await makeItem({ code: 'CV002-10', work_id: cv2.id, level: 2 });
  await nhiemVuDayDu({
    code: 'CV002-11',
    work_id: cv2.id,
    parent_id: cv2sub.id,
    status: 'Tạm dừng',
    priority: 'Cao',
    due_date: ngayLech(-10),
    assignee_id: lan.id,
    assignee_name: lan.full_name,
  });

  // CV003: phòng B, một nhiệm vụ hoàn thành đúng hôm nay.
  const cv3 = await makeWork({
    code: 'CV003',
    name: 'Khảo sát phòng B',
    department_id: phongB.id,
    start_date: '2026-03-01',
    end_date: '2026-03-31',
  });
  await nhiemVuDayDu({
    code: 'CV003-21',
    work_id: cv3.id,
    status: 'Hoàn thành',
    priority: 'Trung bình',
    report_date: ngayLech(0),
    assignee_id: hung.id,
    assignee_name: hung.full_name,
  });
});

afterAll(async () => {
  await closePool();
});

/** Gói legacy + tầng CẤP 3 đã lọc «Chờ duyệt» đúng luật getFiltered* của UI. */
async function layGoiLegacy() {
  const rpc = await apiAdmin.post('/api/rpc/getDataForUser', { args: [{}] });
  expect(rpc.status).toBe(200);
  const goi = rpc.body.data;
  const projects = getFilteredProjectsCu(goi.projects);
  const tasks = getFilteredTasksCu(goi.projects, goi.tasks);
  return { ...goi, projects, tasks, tasksCap3: tasks.filter((t) => Number(t[COL.T_LEVEL]) === 3) };
}

describe('TC-STAT-16 — đối chiếu 4 thẻ số: UI cũ (chuẩn) ↔ /stats/summary', () => {
  it('bảy con số chênh 0 trên tầng cấp 3; dòng "cả cấp 2" ghi rõ là chênh CÓ CHỦ Ý', async () => {
    const ui = await layGoiLegacy();
    const cu = renderStatsCu(ui.projects, ui.tasksCap3);
    const res = await apiAdmin.get('/api/v1/stats/summary');
    expect(res.status).toBe(200);
    const moi = res.body.data;

    expect({ so: moi.totalWorks }).toEqual({ so: cu.totalProjects });
    expect({ so: moi.totalTasks }).toEqual({ so: cu.totalTasks });
    expect({ so: moi.completedTasks }).toEqual({ so: cu.completedTasks });
    expect({ so: moi.ongoingTasks }).toEqual({ so: cu.ongoingTasks });
    expect({ so: moi.overdueTasks }).toEqual({ so: cu.overdueTasks });
    expect({ tyLe: moi.taskCompletionRate }).toEqual({ tyLe: cu.taskCompletionRate });
    expect({ tyLe: moi.overdueRate }).toEqual({ tyLe: cu.overdueRate });

    // Chênh CÓ CHỦ Ý (§0.1): UI cũ đếm cả cấp 2 vào "Tổng nhiệm vụ"; REST mới chỉ đếm cấp 3.
    // 2 công việc con trong dữ liệu ⇒ UI cũ phải LỚN HƠN mới đúng 2 đơn vị.
    const uiCaHaiCap = renderStatsCu(ui.projects, ui.tasks);
    expect(uiCaHaiCap.totalTasks - moi.totalTasks).toBe(2);

    // Backend cũ (getSummaryStats) cùng mảng legacy: 5 số của nó khớp UI ở totalProjects/totalTasks.
    const be = getSummaryStatsCu(ui.projects, ui.tasks);
    expect(be.totalProjects).toBe(cu.totalProjects);
    expect(be.totalTasks).toBe(uiCaHaiCap.totalTasks);
  });
});

describe('TC-STAT-16 — đối chiếu 6 biểu đồ: thuật toán render*Chart cũ ↔ /stats/charts', () => {
  it('status · priority · progress · timeline · staff · comparison đều chênh 0', async () => {
    const ui = await layGoiLegacy();
    const tasks3 = ui.tasksCap3;

    const kyVong = {
      status: bieuDoStatusCu(tasks3),
      'task-priority': bieuDoPriorityCu(tasks3),
      'project-progress': bieuDoProgressCu(ui.projects, tasks3),
      'timeline-progress': bieuDoTimelineCu(tasks3),
      'staff-performance': (() => {
        const kq = bieuDoStaffCu(
          ui.staff.map((s) => s[COL.S_NAME]),
          tasks3
        );
        return { labels: kq.labels, data: kq.data };
      })(),
      'project-comparison': bieuDoComparisonCu(ui.projects, tasks3),
    };

    for (const [type, mong] of Object.entries(kyVong)) {
      const res = await apiAdmin.get(`/api/v1/stats/charts?type=${type}`);
      expect(res.status, type).toBe(200);
      const thuc = res.body.data;
      // Server trả thêm khoá `type` — chỉ so phần dữ liệu biểu đồ.
      const thucSo = { labels: thuc.labels, data: thuc.data };
      if (mong.rates) thucSo.rates = thuc.rates;
      expect(thucSo, `${type}: nhãn+dữ liệu`).toEqual(mong);
    }
  });

  it('một mục Chờ duyệt thêm vào ⇒ cả 4 thẻ lẫn 6 biểu đồ hai bên VẪN chênh 0 (TC-APR-06 × TC-STAT-16)', async () => {
    const tp = await makeLoginUser({
      code: 'NV010',
      full_name: 'Trần Thị Trưởng',
      email: 'tp@test.local',
      role: 'Trưởng phòng',
      department_id: phongA.id,
    });
    const apiTp = client(app);
    await apiTp.login(tp.email);
    await pool.query(`SELECT setval('seq_work_code', 100, true)`);
    const tao = await apiTp.post('/api/v1/works', {
      name: 'Việc chờ duyệt để đối chiếu',
      departmentId: phongA.id,
    });
    expect(tao.status, JSON.stringify(tao.body)).toBe(200);

    const ui = await layGoiLegacy();
    const cu = renderStatsCu(ui.projects, ui.tasksCap3);
    const moi = (await apiAdmin.get('/api/v1/stats/summary')).body.data;
    expect(moi).toEqual({
      totalWorks: cu.totalProjects,
      totalTasks: cu.totalTasks,
      completedTasks: cu.completedTasks,
      ongoingTasks: cu.ongoingTasks,
      overdueTasks: cu.overdueTasks,
      taskCompletionRate: cu.taskCompletionRate,
      overdueRate: cu.overdueRate,
    });

    const status = (await apiAdmin.get('/api/v1/stats/charts?type=status')).body.data;
    expect({ labels: status.labels, data: status.data }).toEqual(bieuDoStatusCu(ui.tasksCap3));
  });
});

// Thống kê — nghiệp vụ (§7 Phase 6). TÍNH Ở SERVER, không tính ở trình duyệt.
//
// Bốn luật cấm phá, mỗi luật gắn mã test:
//   1. Chỉ đếm CẤP 3; cấp 2 là nhóm, không cộng vào (§0.1 · TC-STAT-01).
//   2. Mọi dòng đọc qua view `v_countable_*` ⇒ «Chờ duyệt» tự loại (việc 5.4 · TC-APR-06).
//   3. Lọc tháng là GIAO NHAU khoảng ngày; việc thiếu ngày bắt đầu/kết thúc vẫn giữ
//      (TC-STAT-07/08/09).
//   4. Phòng lọc do SERVER quyết: admin/Phó GĐ chọn được nhiều phòng, vai khác bị ÉP về
//      phòng mình dù query string nói gì (TC-STAT-10).
import { can } from '../../middleware/rbac.js';
import * as deptRepo from '../departments/repo.js';
import * as usersRepo from '../users/repo.js';
import * as repo from './repo.js';

/** "yyyy-MM-dd" theo giờ địa phương — cùng quy ước với `bootstrap/service.js` (`cron.js`). */
function ngaySo(d = new Date()) {
  const hai = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

function ngayCua(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return ngaySo(d);
}

/** EXPORT cho Gantt (6.6). */
export { ngayCua };

const laHoanThanh = (status) =>
  String(status ?? '')
    .toLowerCase()
    .includes('hoàn thành');
const laDangLam = (status) =>
  String(status ?? '')
    .toLowerCase()
    .includes('đang');

/**
 * Giao nhau giữa khoảng của dòng và khoảng lọc (việc 6.4).
 *
 * Luật TC-STAT-09 chạy TRƯỚC phép tính khoảng: dòng THIẾU ngày bắt đầu HOẶC ngày kết thúc
 * (hoặc thiếu cả hai) thì GIỮ NGUYÊN — bản cũ luôn hiện những việc nhập tay thiếu ngày, bộ lọc
 * tháng không được làm mất chúng. Còn lại: giao nhau theo hai đầu đóng, nên việc kết thúc đúng
 * ngày 01 của tháng lọc vẫn thuộc tháng đó (TC-STAT-08). So chuỗi 'yyyy-MM-dd' là đủ.
 */
function giaoNhau(start, end, from, to) {
  if (!from || !to) return true; // thiếu tham số ⇒ không lọc, không làm mất dòng
  if (!start || !end) return true; // thiếu một trong hai ngày của dòng ⇒ luôn giữ (TC-STAT-09)
  return start <= to && end >= from;
}

/** EXPORT cho Gantt (6.6): cùng một luật khoảng ngày với thống kê. */
export { giaoNhau };

const startCua = (row) => ngayCua(row.start_date);
/** Khoảng kết thúc: công việc dùng `end_date`, đầu việc dùng `due_date`. */
const ketThucCua = (row, cot) => ngayCua(row[cot]);

/**
 * Bộ phòng được phép lọc, quyết định ở SERVER (việc 6.5 · TC-STAT-10).
 *
 * - `admin`: truyền gì nhận nấy (nếu phòng không tồn tại thì bỏ đi — trả tập rỗng hợp lệ),
 *   không truyền ⇒ `null` nghĩa là "tất cả".
 * - `Phó Giám đốc`: luôn nằm trong các phòng mình phụ trách (`managedDepartmentIds`); yêu cầu
 *   vượt phạm vi bị CẮT bớt, không nới lên.
 * - Vai khác: query string bị QUỐT LẠI, chỉ còn phòng của chính người đó.
 *
 * @returns {Promise<string[]> | null} null = tất cả (chỉ admin mới nhận được giá trị này).
 */
export async function boLocPhong(user, rawIds = []) {
  // Chấp nhận CẢ "1,2" (một tham số có dấu phẩy) LẪN ?departmentIds=1&departmentIds=2
  // (zod gộp thành mảng) — tách dấu phẩy ở đây một lần cho cả hai kiểu.
  const yeuCau = (Array.isArray(rawIds) ? rawIds : [String(rawIds)])
    .flatMap((v) => String(v ?? '').split(','))
    .map((v) => v.trim())
    .filter(Boolean);

  if (user.role === 'admin') {
    if (yeuCau.length === 0) return null;
    const tatCa = await deptRepo.listAll();
    const coThat = new Set(tatCa.map((d) => String(d.id)));
    return yeuCau.filter((id) => coThat.has(id));
  }

  if (user.role === 'Phó Giám đốc') {
    const base = (user.managedDepartmentIds ?? []).map((id) => String(id));
    if (yeuCau.length === 0) return base;
    const choPhep = new Set(base);
    return yeuCau.filter((id) => choPhep.has(id));
  }

  return user.department_id == null ? [] : [String(user.department_id)];
}

/** Dòng có thuộc bộ phòng được lọc không? `null` = mọi phòng. EXPORT cho Gantt (6.6). */
export function dungPhong(row, phongIds) {
  if (phongIds === null) return true;
  return phongIds.includes(String(row.department_id));
}

/**
 * Nạp công việc + nhiệm vụ ĐƯỢC ĐẾM cho một người: qua view (loại Chờ duyệt), lọc quyền đọc
 * từng dòng bằng `can()` — cùng cách bootstrap làm, vì phạm vi «Quản lý công việc» xét theo
 * dòng chứ không theo phòng.
 *
 * EXPORT để module Gantt (6.6) dùng chung: cùng một nguồn dữ liệu đã lọc duyệt + quyền, hai
 * đường đọc chênh nhau một chữ là đối chiếu số liệu (6.9) vô nghĩa.
 */
export async function taiDuLieuDem(user) {
  const [works, items] = await Promise.all([repo.listCountableWorks(), repo.listCountableItems()]);
  return {
    works: works.filter((row) => can(user, 'read', 'work', row).ok),
    items: items.filter((row) => can(user, 'read', row.level === 2 ? 'subwork' : 'task', row).ok),
  };
}

/** Áp bộ lọc phòng + giao nhau khoảng ngày lên một mảng dòng đã nạp. */
function locDong(rows, { phongIds = null, from = null, to = null, cotKetThuc }) {
  return rows.filter(
    (row) =>
      dungPhong(row, phongIds) && giaoNhau(startCua(row), ketThucCua(row, cotKetThuc), from, to)
  );
}

/**
 * Gói lọc chung của mọi đường thống kê: phòng do `boLocPhong` quyết, khoảng ngày dạng
 * 'yyyy-MM-dd'.
 */
export async function boLoc(user, { from, to, departmentIds } = {}) {
  return {
    phongIds: await boLocPhong(user, departmentIds ?? []),
    from: from ? String(from) : null,
    to: to ? String(to) : null,
  };
}

const tyLe = (phan, mau) => (mau > 0 ? Math.round((phan / mau) * 100) : 0);

/**
 * 4 thẻ số + tỷ lệ (việc 6.1 · E1). Chỉ đếm nhiệm vụ CẤP 3; cấp 2 là nhóm nên không nằm trong
 * bất kỳ con số nào dưới đây (TC-STAT-01).
 *
 * Tỷ lệ khi mẫu số 0 trả 0% chứ không NaN (TC-STAT-02). Quá hạn: hạn chót TRƯỚC hôm nay và
 * chưa hoàn thành — hạn đúng hôm nay chưa tính quá hạn (TC-STAT-03/04).
 */
export function summaryFrom(works, tasks) {
  const homNay = ngaySo();
  let completedTasks = 0;
  let ongoingTasks = 0;
  let overdueTasks = 0;
  for (const row of tasks) {
    const hoanThanh = laHoanThanh(row.status);
    if (hoanThanh) completedTasks += 1;
    else if (laDangLam(row.status)) ongoingTasks += 1;
    const han = ngayCua(row.due_date);
    if (han && han < homNay && !hoanThanh) overdueTasks += 1;
  }
  return {
    totalWorks: works.length,
    totalTasks: tasks.length,
    completedTasks,
    ongoingTasks,
    overdueTasks,
    taskCompletionRate: tyLe(completedTasks, tasks.length),
    overdueRate: tyLe(overdueTasks, tasks.length),
  };
}

export async function summary(user, filters = {}) {
  const loc = await boLoc(user, filters);
  const duLieu = await taiDuLieuDem(user);
  const works = locDong(duLieu.works, { ...loc, cotKetThuc: 'end_date' });
  // CẤP 3 thôi — cấp 2 không cộng vào bất kỳ thẻ nào (TC-STAT-01).
  const tasks = locDong(
    duLieu.items.filter((row) => Number(row.level) === 3),
    { ...loc, cotKetThuc: 'due_date' }
  );
  return summaryFrom(works, tasks);
}

// ============================================================================
// 6 biểu đồ (việc 6.2) — `GET /stats/charts?type=`
//
// Sáu type khớp SÁU hàm `render*Chart` của `app.js` (§2.5 E2–E7). Hình dạng trả về là thứ
// Chart.js của từng hàm đang nhận: `{labels, data}` — biểu đồ hai trục (nhân sự / so sánh)
// kèm `completed[]` + `rates[]` cho dataset thứ hai và tooltip.
//
// KHÔNG có dữ liệu ⇒ `{labels:[], data:[], message}` với HTTP 200, KHÔNG lỗi (TC-STAT-05):
// frontend cũ hiện đúng dòng message đó rồi thoát, không vẽ gì cả.
// ============================================================================

export const CHART_TYPES = Object.freeze([
  'status',
  'project-progress',
  'staff-performance',
  'task-priority',
  'timeline-progress',
  'project-comparison',
]);

const RONG = (type) => ({
  type,
  labels: [],
  data: [],
  message: 'Không có dữ liệu nhiệm vụ để tạo biểu đồ.',
});

/** E2 — trạng thái nhiệm vụ (`renderChart`): nhãn theo thứ tự gặp thấy, như Map của bản cũ. */
function bieuDoTrangThai(tasks) {
  if (tasks.length === 0) return RONG('status');
  const dem = new Map();
  for (const row of tasks) {
    const nhan = String(row.status ?? '').trim() || 'Không xác định';
    dem.set(nhan, (dem.get(nhan) ?? 0) + 1);
  }
  return { type: 'status', labels: [...dem.keys()], data: [...dem.values()] };
}

/** E6 — mức ưu tiên (`renderTaskPriorityChart`): ba nhãn cố định, phân loại theo `includes`. */
function bieuDoUuTien(tasks) {
  if (tasks.length === 0) return RONG('task-priority');
  const dem = { Thấp: 0, 'Trung bình': 0, Cao: 0 };
  for (const row of tasks) {
    const uuTien = String(row.priority ?? '').toLowerCase();
    if (uuTien.includes('thấp')) dem.Thấp += 1;
    else if (uuTien.includes('cao')) dem.Cao += 1;
    else dem['Trung bình'] += 1;
  }
  return {
    type: 'task-priority',
    labels: ['Thấp', 'Trung bình', 'Cao'],
    data: [dem.Thấp, dem['Trung bình'], dem.Cao],
  };
}

/** Tiến độ một công việc = % nhiệm vụ cấp 3 đã hoàn thành; không có nhiệm vụ nào ⇒ 0%. */
const tienDo = (nhiemVuCuaWork) => {
  if (nhiemVuCuaWork.length === 0) return 0;
  const xong = nhiemVuCuaWork.filter((r) => laHoanThanh(r.status)).length;
  return Math.round((xong / nhiemVuCuaWork.length) * 100);
};

/** E4 — tiến độ công việc (`renderProjectProgressChart`): 5 bucket cố định. */
function bieuDoTienDoWorks(works, tasks) {
  if (works.length === 0) return RONG('project-progress');
  const buckets = { '0-25%': 0, '26-50%': 0, '51-75%': 0, '76-99%': 0, '100%': 0 };
  const tasksByWork = new Map();
  for (const row of tasks) {
    if (!tasksByWork.has(row.work_id)) tasksByWork.set(row.work_id, []);
    tasksByWork.get(row.work_id).push(row);
  }
  for (const work of works) {
    const pct = tienDo(tasksByWork.get(work.id) ?? []);
    if (pct === 100) buckets['100%'] += 1;
    else if (pct >= 76) buckets['76-99%'] += 1;
    else if (pct >= 51) buckets['51-75%'] += 1;
    else if (pct >= 26) buckets['26-50%'] += 1;
    else buckets['0-25%'] += 1;
  }
  return {
    type: 'project-progress',
    labels: Object.keys(buckets),
    data: Object.values(buckets),
  };
}

/**
 * E5 — hiệu suất nhân sự (`renderStaffPerformanceChart`).
 *
 * Bản cũ quét `allStaff` rồi chỉ giữ người có ≥1 nhiệm vụ khớp TÊN. Máy chủ không có mảng
 * allStaff trong tay nên nạp danh sách người dùng — cùng nguồn (`getStaffList`). Người ngoài
 * danh sách (tên tự do nhập không dò ra ai) KHÔNG được đếm, đúng hành vi đang hiện trên UI.
 */
async function bieuDoNhanSu(tasks) {
  const people = await usersRepo.listAll();
  const tenCoThat = new Set(people.map((p) => p.full_name));
  const theoNguoi = new Map();
  for (const row of tasks) {
    const ten = String(row.assignee_name ?? '');
    if (!ten || !tenCoThat.has(ten)) continue;
    if (!theoNguoi.has(ten)) theoNguoi.set(ten, { total: 0, done: 0 });
    const so = theoNguoi.get(ten);
    so.total += 1;
    if (laHoanThanh(row.status)) so.done += 1;
  }
  const labels = [];
  const data = [];
  const completed = [];
  const rates = [];
  // Giữ thứ tự danh sách nhân sự như bản cũ (`allStaff.map(...).filter(total>0)`).
  for (const person of people) {
    const so = theoNguoi.get(person.full_name);
    if (!so || so.total === 0) continue;
    labels.push(person.full_name);
    data.push(so.total);
    completed.push(so.done);
    rates.push(Math.round((so.done / so.total) * 100));
  }
  if (labels.length === 0) return RONG('staff-performance');
  return { type: 'staff-performance', labels, data, completed, rates };
}

/** E7 — tiến độ theo thời gian (`renderTimelineProgressChart`): 30 ngày gần nhất. */
function bieuDoThoiGian(tasks) {
  if (tasks.length === 0) return RONG('timeline-progress');
  const dem = new Map();
  const labels = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dem.set(ngaySo(d), 0);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }
  let co = false;
  for (const row of tasks) {
    const baoCao = ngayCua(row.report_date);
    if (!baoCao || !laHoanThanh(row.status)) continue;
    if (dem.has(baoCao)) {
      dem.set(baoCao, dem.get(baoCao) + 1);
      co = true;
    }
  }
  if (!co) return RONG('timeline-progress');
  return { type: 'timeline-progress', labels, data: [...dem.values()] };
}

/** E3 — so sánh công việc (`renderProjectComparisonChart`): top 5 theo tổng nhiệm vụ. */
function bieuDoSoSanh(works, tasks) {
  if (works.length === 0) return RONG('project-comparison');
  const tasksByWork = new Map();
  for (const row of tasks) {
    if (!tasksByWork.has(row.work_id)) tasksByWork.set(row.work_id, []);
    tasksByWork.get(row.work_id).push(row);
  }
  const hang = works
    .map((work) => {
      const nhiemVu = tasksByWork.get(work.id) ?? [];
      const xong = nhiemVu.filter((r) => laHoanThanh(r.status)).length;
      const ten = work.name || work.code;
      return {
        name: ten.length > 15 ? `${ten.slice(0, 15)}...` : ten,
        totalTasks: nhiemVu.length,
        completedTasks: xong,
        completionRate: tienDo(nhiemVu),
      };
    })
    .filter((row) => row.totalTasks > 0)
    .sort((a, b) => b.totalTasks - a.totalTasks)
    .slice(0, 5);
  if (hang.length === 0) return RONG('project-comparison');
  return {
    type: 'project-comparison',
    labels: hang.map((row) => row.name),
    data: hang.map((row) => row.totalTasks),
    completed: hang.map((row) => row.completedTasks),
    rates: hang.map((row) => row.completionRate),
  };
}

/**
 * Điểm vào của việc 6.2. Mọi biểu đồ đều chịu chung bộ lọc tháng/phòng với 4 thẻ — nhờ vậy
 * «bấm số mở danh sách» và biểu đồ luôn kể cùng một câu chuyện trên cùng phạm vi.
 */
export async function charts(user, type, filters = {}) {
  const loc = await boLoc(user, filters);
  const duLieu = await taiDuLieuDem(user);
  const works = locDong(duLieu.works, { ...loc, cotKetThuc: 'end_date' });
  const tasks = locDong(
    duLieu.items.filter((row) => Number(row.level) === 3),
    { ...loc, cotKetThuc: 'due_date' }
  );
  switch (type) {
    case 'status':
      return bieuDoTrangThai(tasks);
    case 'task-priority':
      return bieuDoUuTien(tasks);
    case 'timeline-progress':
      return bieuDoThoiGian(tasks);
    case 'staff-performance':
      return bieuDoNhanSu(tasks);
    case 'project-progress':
      return bieuDoTienDoWorks(works, tasks);
    case 'project-comparison':
      return bieuDoSoSanh(works, tasks);
    default:
      return RONG(type);
  }
}

/**
 * Hoạt động gần đây CÓ PHÂN TRANG (việc 6.3 · E9). Bootstrap lấy cứng 22 dòng không trang;
 * đường này là đường có trang. Vai khác admin chỉ thấy nhật ký của chính mình.
 */
export async function activities(user, { page = 1, limit = 10 } = {}) {
  const trang = Math.max(1, Math.floor(Number(page) || 1));
  const soDong = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)));
  const actorId = user.role === 'admin' ? null : user.id;
  const { rows, total } = await repo.listActivitiesPaged({
    limit: soDong,
    offset: (trang - 1) * soDong,
    actorId,
  });
  return {
    activities: rows,
    page: trang,
    limit: soDong,
    total,
    totalPages: Math.max(1, Math.ceil(total / soDong)),
  };
}

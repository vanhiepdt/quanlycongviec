// Xuất Excel — tầng DỮ LIỆU (§7 việc 7.5 + 7.6).
//
// Luật xương sống của việc 7.6, cũng là rủi ro lớn nhất của cả Phase 7:
//   Module này KHÔNG có một câu SQL nào. Mỗi mẫu xuất gọi ĐÚNG hàm lọc phạm vi mà API danh sách
//   đang dùng — `works/tree.js: getTree` cho mẫu (a)/(b), `stats/service.js` cho mẫu (c). Viết một
//   truy vấn riêng "cho nhanh" là mở một đường đọc thứ hai không đi qua `can()`, và ngày nào §6
//   siết quyền thì đường đó âm thầm ở lại rộng — đúng nghĩa lỗ rò dữ liệu (TC-MISC-11).
//
// Ranh giới với `workbook.js`: ở đây chỉ dựng MÔ HÌNH BẢNG thuần (mảng cột + mảng dòng, ngày là
// `Date` hoặc null), không biết exceljs là gì. Nhờ vậy phần đếm dòng / lọc phạm vi test được mà
// không cần mở lại file .xlsx.
import * as deptRepo from '../departments/repo.js';
import {
  boLocPhong,
  dungPhong,
  giaoNhau,
  ngayCua,
  summaryFrom,
  taiDuLieuDem,
} from '../stats/service.js';
import * as itemsRepo from '../workItems/repo.js';
import { getTree } from '../works/tree.js';

/** Ba mẫu của §7 việc 7.5. Tên mẫu = tên file: `works.xlsx`, `tasks.xlsx`, `stats.xlsx`. */
export const MAU = Object.freeze(['works', 'tasks', 'stats']);

/**
 * 'yyyy-MM-dd' (hoặc `Date`) → `Date` để exceljs ghi thành Ô NGÀY thật.
 *
 * Dùng `Date.UTC` 12:00 chứ không `new Date('2026-03-01')`: exceljs quy đổi ngày sang số sê-ri
 * Excel theo UTC, nên mốc 00:00 giờ địa phương ở múi giờ dương (VN = UTC+7) lùi về ngày hôm trước
 * — 01/03 hiện thành 28/02. Giữa trưa thì lệch múi giờ nào cũng không đổi ngày (TC-MISC-13).
 */
export function oNgay(value) {
  const s = ngayCua(value);
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Số phần trăm hoàn thành: để trống thì 0, không để `null` làm ô trống lẫn với 0%. */
const soPhanTram = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const chu = (v) => (v == null ? '' : String(v));

// ============================================================================
// Mẫu (a) — Công việc 3 tầng có thụt lề
// ============================================================================

const COT_CONG_VIEC = Object.freeze([
  { key: 'code', header: 'Mã', width: 12 },
  { key: 'name', header: 'Nội dung', width: 52, indent: true },
  { key: 'level_name', header: 'Cấp', width: 14 },
  { key: 'department_name', header: 'Phòng', width: 22 },
  { key: 'assignee_name', header: 'Người thực hiện', width: 22 },
  { key: 'status', header: 'Trạng thái', width: 16 },
  { key: 'priority', header: 'Ưu tiên', width: 12 },
  { key: 'start_date', header: 'Bắt đầu', width: 12, type: 'date' },
  { key: 'due_date', header: 'Kết thúc', width: 12, type: 'date' },
  { key: 'completion', header: '% Hoàn thành', width: 13, type: 'number' },
  { key: 'approval_status', header: 'Duyệt', width: 12 },
]);

const TEN_CAP = Object.freeze({ 1: 'Công việc', 2: 'Công việc con', 3: 'Nhiệm vụ' });

/** Bảng tra id phòng → tên phòng. Xuất file phải đọc được tên, không phải con số id. */
async function tenPhong() {
  const rows = await deptRepo.listAll();
  return new Map(rows.map((d) => [String(d.id), d.name]));
}

/**
 * Duyệt cây theo đúng thứ tự đang hiện trên giao diện (công việc → công việc con → nhiệm vụ) và
 * trải thành dòng phẳng có `capDo` để `workbook.js` thụt lề.
 *
 * Nhóm ảo `(chưa gán công việc con)` (`virtual: true`) VẪN được xuất: nó đang hiện trên cây, mà
 * TC-MISC-10 đối chiếu "số dòng = số mục thấy được" — bỏ nó đi thì file thiếu đúng một dòng so với
 * màn hình, và nhiệm vụ mồ côi bên dưới mất chỗ neo.
 */
export function traiCay(tree, phongTheoId = new Map()) {
  const dong = [];
  const themPhong = (row) => phongTheoId.get(String(row.department_id)) ?? '';

  for (const work of tree.works) {
    dong.push({
      capDo: 1,
      code: chu(work.code),
      name: chu(work.name),
      level_name: TEN_CAP[1],
      department_name: themPhong(work),
      assignee_name: chu(work.manager_name),
      status: chu(work.status),
      priority: '',
      start_date: oNgay(work.start_date),
      // Công việc cấp 1 dùng `end_date`; cấp 2/3 dùng `due_date` — cùng một cột "Kết thúc".
      due_date: oNgay(work.end_date),
      completion: null,
      approval_status: chu(work.approval_status),
    });
    for (const sub of work.subWorks ?? []) {
      dong.push({
        capDo: 2,
        code: chu(sub.code),
        name: chu(sub.name),
        level_name: TEN_CAP[2],
        department_name: themPhong(sub),
        assignee_name: chu(sub.assignee_name),
        status: chu(sub.status),
        priority: chu(sub.priority),
        start_date: oNgay(sub.start_date),
        due_date: oNgay(sub.due_date),
        completion: sub.virtual ? null : soPhanTram(sub.completion),
        approval_status: chu(sub.approval_status),
      });
      for (const task of sub.tasks ?? []) {
        dong.push({
          capDo: 3,
          code: chu(task.code),
          name: chu(task.name),
          level_name: TEN_CAP[3],
          department_name: themPhong(task),
          assignee_name: chu(task.assignee_name),
          status: chu(task.status),
          priority: chu(task.priority),
          start_date: oNgay(task.start_date),
          due_date: oNgay(task.due_date),
          completion: soPhanTram(task.completion),
          approval_status: chu(task.approval_status),
        });
      }
    }
  }
  return dong;
}

/** Mẫu (a): cây 3 tầng của riêng phạm vi người bấm. */
export async function mauCongViec(user, filter = {}) {
  const [tree, phongTheoId] = await Promise.all([getTree(user, filter), tenPhong()]);
  return {
    ten: 'Công việc',
    tieuDe: 'DANH SÁCH CÔNG VIỆC 3 CẤP',
    cot: COT_CONG_VIEC,
    dong: traiCay(tree, phongTheoId),
    tong: tree.totals,
  };
}

// ============================================================================
// Mẫu (b) — Nhiệm vụ theo người thực hiện
// ============================================================================

const COT_NHIEM_VU = Object.freeze([
  { key: 'assignee_name', header: 'Người thực hiện', width: 24 },
  { key: 'code', header: 'Mã nhiệm vụ', width: 14 },
  { key: 'name', header: 'Tên nhiệm vụ', width: 46 },
  { key: 'work_name', header: 'Thuộc công việc', width: 34 },
  { key: 'department_name', header: 'Phòng', width: 22 },
  { key: 'status', header: 'Trạng thái', width: 16 },
  { key: 'priority', header: 'Ưu tiên', width: 12 },
  { key: 'start_date', header: 'Bắt đầu', width: 12, type: 'date' },
  { key: 'due_date', header: 'Hạn chót', width: 12, type: 'date' },
  { key: 'completion', header: '% Hoàn thành', width: 13, type: 'number' },
]);

export const CHUA_GIAO = '(chưa giao)';

/**
 * Mẫu (b): CHỈ nhiệm vụ cấp 3 (§0.1 — cấp 2 là nhóm, không phải nhiệm vụ), xếp theo người thực
 * hiện rồi theo mã. Người chưa giao gom vào nhóm `(chưa giao)` và đứng CUỐI: đó là phần cần soát
 * lại, để lẫn giữa danh sách thì không ai thấy.
 *
 * Dùng lại `getTree` (không phải một truy vấn `work_items` riêng) để phạm vi khớp từng dòng với
 * mẫu (a) và với cây trên giao diện — cùng một hàm lọc, cùng một kết quả (7.6).
 */
export async function mauNhiemVu(user, filter = {}) {
  const [tree, phongTheoId] = await Promise.all([getTree(user, filter), tenPhong()]);
  const tenWork = new Map(tree.works.map((w) => [w.id, w.name || w.code]));

  const dong = [];
  for (const row of traiCayThoDe(tree)) {
    if (Number(row.level) !== itemsRepo.LEVEL_TASK) continue;
    dong.push({
      assignee_name: chu(row.assignee_name).trim() || CHUA_GIAO,
      code: chu(row.code),
      name: chu(row.name),
      work_name: chu(tenWork.get(row.work_id)),
      department_name: phongTheoId.get(String(row.department_id)) ?? '',
      status: chu(row.status),
      priority: chu(row.priority),
      start_date: oNgay(row.start_date),
      due_date: oNgay(row.due_date),
      completion: soPhanTram(row.completion),
    });
  }

  const chuaGiaoCuoi = (a, b) => {
    const aTrong = a.assignee_name === CHUA_GIAO;
    const bTrong = b.assignee_name === CHUA_GIAO;
    if (aTrong !== bTrong) return aTrong ? 1 : -1;
    return a.assignee_name.localeCompare(b.assignee_name, 'vi') || a.code.localeCompare(b.code);
  };
  dong.sort(chuaGiaoCuoi);

  return {
    ten: 'Nhiệm vụ theo người',
    tieuDe: 'NHIỆM VỤ THEO NGƯỜI THỰC HIỆN',
    cot: COT_NHIEM_VU,
    dong,
    // Số người có việc — để dòng tổng dưới cùng nói đúng, không phải đếm lại ở tầng workbook.
    tong: { soNguoi: new Set(dong.map((r) => r.assignee_name)).size, soNhiemVu: dong.length },
  };
}

/** Mọi dòng cấp 2/cấp 3 trong cây, giữ nguyên thứ tự duyệt. Nhóm ảo không có `level` thật nên bỏ. */
function traiCayThoDe(tree) {
  const rows = [];
  for (const work of tree.works) {
    for (const sub of work.subWorks ?? []) {
      if (!sub.virtual) rows.push(sub);
      for (const task of sub.tasks ?? []) rows.push(task);
    }
  }
  return rows;
}

// ============================================================================
// Mẫu (c) — Thống kê theo phòng
// ============================================================================

const COT_THONG_KE = Object.freeze([
  { key: 'department_name', header: 'Phòng', width: 28 },
  { key: 'totalWorks', header: 'Số công việc', width: 13, type: 'number' },
  { key: 'totalTasks', header: 'Số nhiệm vụ', width: 13, type: 'number' },
  { key: 'completedTasks', header: 'Hoàn thành', width: 12, type: 'number' },
  { key: 'ongoingTasks', header: 'Đang làm', width: 12, type: 'number' },
  { key: 'overdueTasks', header: 'Quá hạn', width: 11, type: 'number' },
  { key: 'taskCompletionRate', header: 'Tỷ lệ hoàn thành (%)', width: 20, type: 'number' },
  { key: 'overdueRate', header: 'Tỷ lệ quá hạn (%)', width: 18, type: 'number' },
]);

export const KHONG_PHONG = '(chưa có phòng)';

/**
 * Mẫu (c): mỗi dòng là một phòng, các con số tính bằng `summaryFrom` — ĐÚNG hàm mà 4 thẻ của trang
 * Thống kê đang dùng, nên file xuất và giao diện không bao giờ lệch nhau một đơn vị.
 *
 * Không có `type=` biểu đồ nào theo phòng trong `stats/service.js`, nên phần nhóm theo phòng làm ở
 * đây; nhưng NGUỒN dữ liệu vẫn là `taiDuLieuDem` (đã loại «Chờ duyệt» qua view + đã lọc `can()`)
 * và bộ phòng vẫn do `boLocPhong` quyết — vai `Nhân viên` chỉ nhận về phòng mình bất kể query
 * string nói gì (TC-MISC-11, cùng luật TC-STAT-10).
 */
export async function mauThongKe(user, filters = {}) {
  const [phongIds, duLieu, dsPhong] = await Promise.all([
    boLocPhong(user, filters.departmentIds ?? []),
    taiDuLieuDem(user),
    deptRepo.listAll(),
  ]);
  const from = filters.from ? String(filters.from) : null;
  const to = filters.to ? String(filters.to) : null;
  const trongKhoang = (row, cot) => giaoNhau(ngayCua(row.start_date), ngayCua(row[cot]), from, to);

  const works = duLieu.works.filter((r) => dungPhong(r, phongIds) && trongKhoang(r, 'end_date'));
  const tasks = duLieu.items.filter(
    (r) => Number(r.level) === 3 && dungPhong(r, phongIds) && trongKhoang(r, 'due_date')
  );

  const nhom = new Map(); // khoá phòng ('' = chưa có phòng) → { works, tasks }
  const oNhom = (key) => {
    if (!nhom.has(key)) nhom.set(key, { works: [], tasks: [] });
    return nhom.get(key);
  };
  for (const row of works) oNhom(String(row.department_id ?? '')).works.push(row);
  for (const row of tasks) oNhom(String(row.department_id ?? '')).tasks.push(row);

  // Thứ tự phòng theo `sort_order` của bảng `departments` (như mọi ô chọn phòng trên giao diện);
  // phòng không có dòng nào KHÔNG xuất — file thống kê 40 dòng số 0 thì không ai đọc.
  const tenTheoId = new Map(dsPhong.map((d) => [String(d.id), d.name]));
  const thuTu = [...dsPhong.map((d) => String(d.id)), ''];
  const dong = [];
  for (const key of thuTu) {
    const o = nhom.get(key);
    if (!o) continue;
    dong.push({
      department_name: key === '' ? KHONG_PHONG : (tenTheoId.get(key) ?? `#${key}`),
      ...summaryCuaPhong(o),
    });
  }

  return {
    ten: 'Thống kê theo phòng',
    tieuDe: 'THỐNG KÊ THEO PHÒNG',
    cot: COT_THONG_KE,
    dong,
    // Mẫu này CÓ dòng «TỔNG CỘNG» — nó là bảng số liệu, không phải danh sách bản ghi. Hai mẫu kia
    // cố ý không có, để phép đối chiếu «số dòng = số mục thấy được» của TC-MISC-10 còn đúng.
    dongTong: { department_name: 'TỔNG CỘNG', ...summaryCuaPhong({ works, tasks }) },
    tong: { soPhong: dong.length, ...summaryCuaPhong({ works, tasks }) },
  };
}

/** `summaryFrom` trả cả 7 số; ở đây chỉ lấy các khoá khớp cột của mẫu (c). */
function summaryCuaPhong({ works, tasks }) {
  const s = summaryFrom(works, tasks);
  return {
    totalWorks: s.totalWorks,
    totalTasks: s.totalTasks,
    completedTasks: s.completedTasks,
    ongoingTasks: s.ongoingTasks,
    overdueTasks: s.overdueTasks,
    taskCompletionRate: s.taskCompletionRate,
    overdueRate: s.overdueRate,
  };
}

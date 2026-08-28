// Sơ đồ Gantt — nghiệp vụ (§7 việc 6.6, §2.6 F7/F8).
//
// Máy chủ trả CÂY ĐÃ NHÓM SẴN bốn mức: Nhóm → Công việc → Công việc con → Nhiệm vụ. Frontend
// chỉ vẽ thanh bằng `calculateGanttBarStyle(Range)` đang có (việc 6.7), KHÔNG tự tính lại phạm
// vi hay quyền — "tính ở server" cũng áp cho cây Gantt.
//
// Ba kiểu nhóm (groupBy):
//   department — thứ tự phòng theo `sort_order` (TC-STAT-11).
//   deputy     — một Phó GĐ phụ trách 2 phòng ⇒ công việc của CẢ HAI phòng nằm trong MỘT nhóm
//                của người đó (TC-STAT-12). Phòng không ai làm Phó GĐ ⇒ nhóm "(không có Phó GĐ
//                phụ trách)" xếp cuối.
//   assignee   — nhóm theo người thực hiện của nhiệm vụ cấp 3: một công việc rơi vào nhóm của
//                mọi người có ít nhất MỘT nhiệm vụ trong đó, và khi hiện ra thì hiện TOÀN BỘ cây
//                con của công việc đó (giữ đủ 4 mức; ghi chú thiết kế ở §13.3).
//
// Dữ liệu đếm/hiện ĐỌC QUA `v_countable_*` nhờ tái dùng `taiDuLieuDem` của thống kê — mục Chờ
// duyệt không bao giờ xuất hiện trên Gantt.
import * as deptRepo from '../departments/repo.js';
import * as userRepo from '../users/repo.js';
import * as monthNamesRepo from '../workMonthNames/repo.js';
import { banDoTenThang, khoaThang } from '../../utils/monthNames.js';
import { boLocPhong, dungPhong, giaoNhau, ngayCua, taiDuLieuDem } from '../stats/service.js';

export const GROUP_MODES = Object.freeze(['department', 'deputy', 'assignee']);

const CHUA_CO = '(chưa phân)';

/** Dòng đầu việc rút gọn thành nút lá của cây Gantt. */
function nutItem(row) {
  return {
    id: row.id,
    code: row.code,
    level: Number(row.level),
    parentId: row.parent_id ?? null,
    name: row.name,
    status: row.status,
    priority: row.priority,
    startDate: row.start_date,
    dueDate: row.due_date,
    assigneeName: row.assignee_name ?? null,
    completion: Number(row.completion ?? 0),
    // Phân công ba lớp + kết quả đầu ra — dữ liệu cho tooltip của giao diện Gantt.
    output: row.output ?? '',
    leaderNames: row.leader_names ?? [],
    // Tên riêng theo tháng (008_work_month_names.sql). Giao diện Gantt xem MỘT tháng mỗi lần nên nó
    // tự chọn tên trong bản đồ này; máy chủ không chọn hộ vì `from`/`to` có thể trải nhiều tháng.
    monthNames: row.month_names ?? {},
  };
}

/**
 * Gắn cây con vào một công việc: cấp 2 làm nhánh, cấp 3 là lá — nhiệm vụ MỒ CÔI (không cha)
 * nằm thẳng trong `work.tasks` chứ không biến mất (TC-TREE-24 giữ nguyên tinh thần ở đây).
 *
 * Tiến độ công việc TÍNH Ở SERVER từ nhiệm vụ cấp 3 (chuẩn §0.1), thay cho cách bản cũ đếm
 * trên mảng trộn cả cấp 2.
 */
function ganCayCon(work, items) {
  const subs = [];
  const tasks = [];
  for (const row of items) {
    if (Number(row.level) === 2) subs.push({ ...nutItem(row), children: [] });
    else tasks.push(nutItem(row));
  }
  for (const task of tasks) {
    const cha = task.parentId ? subs.find((s) => s.id === task.parentId) : null;
    if (cha) cha.children.push(task);
    else work.tasks.push(task);
  }
  work.subs = subs;
  const tong = tasks.length;
  const xong = tasks.filter((t) =>
    String(t.status ?? '')
      .toLowerCase()
      .includes('hoàn thành')
  ).length;
  work.taskCount = tong;
  work.completedCount = xong;
  work.progress = tong > 0 ? Math.round((xong / tong) * 100) : 0;
  return work;
}

function nutWork(work) {
  return {
    id: work.id,
    code: work.code,
    name: work.name,
    status: work.status,
    departmentId: work.department_id ?? null,
    startDate: work.start_date,
    endDate: work.end_date,
    supervisorName: work.supervisor_name ?? null,
    leaderNames: work.leader_names ?? [],
    monthNames: work.month_names ?? {},
    subs: [],
    tasks: [],
  };
}

/** Nhóm kiểu `department` — thứ tự theo `sort_order` của bảng phòng (TC-STAT-11). */
async function nhomTheoPhong(works, itemsTheoWork) {
  const departments = await deptRepo.listAll(); // đã ORDER BY sort_order, name
  const groups = departments.map((d) => ({
    key: `dept:${d.id}`,
    name: d.name,
    sortOrder: d.sort_order,
    works: [],
  }));
  const byId = new Map(groups.map((g) => [String(g.key.split(':')[1]), g]));
  const khongPhong = {
    key: 'dept:none',
    name: CHUA_CO,
    sortOrder: Number.MAX_SAFE_INTEGER,
    works: [],
  };
  for (const work of works) {
    const g = byId.get(String(work.department_id)) ?? khongPhong;
    g.works.push(ganCayCon(nutWork(work), itemsTheoWork.get(work.id) ?? []));
  }
  if (khongPhong.works.length > 0) groups.push(khongPhong);
  return groups;
}

/**
 * Nhóm kiểu `deputy` — một người phụ trách nhiều phòng thì công việc của các phòng đó GỘP về
 * MỘT nhóm của người đó (TC-STAT-12). Thứ tự nhóm theo `sort_order` của phòng ĐẦU TIÊN.
 */
async function nhomTheoDeputy(works, itemsTheoWork) {
  const [departments, managers] = await Promise.all([
    deptRepo.listAll(),
    deptRepo.listAllManagers(),
  ]);
  const sortOf = new Map(departments.map((d) => [String(d.id), d.sort_order]));
  const phoGd = managers.filter((row) => row.role === 'deputy_director');

  // Mỗi Phó GĐ một nhóm; phòng nào có người phụ trách thì tìm được nhóm ngay.
  const groups = new Map();
  for (const m of phoGd) {
    const key = `deputy:${m.user_id}`;
    if (!groups.has(key)) {
      groups.set(key, { key, name: m.full_name, marks: [], works: [] });
    }
    groups.get(key).marks.push(sortOf.get(String(m.department_id)) ?? Number.MAX_SAFE_INTEGER);
  }

  const khongAi = {
    key: 'deputy:none',
    name: '(không có Phó Giám đốc phụ trách)',
    marks: [Number.MAX_SAFE_INTEGER],
    works: [],
  };

  for (const work of works) {
    const m = phoGd.find((row) => String(row.department_id) === String(work.department_id));
    const g = m ? groups.get(`deputy:${m.user_id}`) : khongAi;
    g.works.push(ganCayCon(nutWork(work), itemsTheoWork.get(work.id) ?? []));
  }

  const list = [...groups.values()];
  if (khongAi.works.length > 0) list.push(khongAi);
  list.forEach((g) => {
    g.sortOrder = Math.min(...g.marks);
    delete g.marks;
  });
  return list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * Nhóm kiểu `assignee` — khoá nhóm là NGƯỜI THỰC HIỆN của nhiệm vụ cấp 3. Một công việc rơi
 * vào nhóm của MỌI người có ít nhất một nhiệm vụ trong đó, và hiện ra TOÀN BỘ cây con (giữ đủ
 * 4 mức). Nhiệm vụ chưa gán ai ⇒ công việc vào nhóm «(chưa phân)». Thứ tự theo tên.
 */
function nhomTheoAssignee(works, itemsTheoWork) {
  const groups = new Map();
  const nhomCua = (ten) => {
    const key = `assignee:${ten ?? 'none'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: ten ?? CHUA_CO,
        sortOrder: Number.MAX_SAFE_INTEGER - 1,
        works: [],
      });
    }
    return groups.get(key);
  };

  for (const work of works) {
    const items = itemsTheoWork.get(work.id) ?? [];
    const nguoi = new Set(
      items
        .filter((row) => Number(row.level) === 3)
        .map((row) => (String(row.assignee_name ?? '').trim() ? row.assignee_name : null))
    );
    if (nguoi.size === 0) {
      nhomCua(null).works.push(ganCayCon(nutWork(work), items));
    } else {
      for (const ten of nguoi) nhomCua(ten).works.push(ganCayCon(nutWork(work), items));
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Điểm vào của việc 6.6. Khoảng ngày lọc ở mức CÔNG VIỆC bằng đúng luật giao nhau của thống kê;
 * nhiệm vụ/công việc con nằm trong một công việc đã hiện thì giữ nguyên để frontend tự quyết
 * vẽ thanh hay ghi "ngoài khoảng" (việc 6.7 · TC-STAT-13/14).
 */
export async function ganttTree(
  user,
  { from = null, to = null, groupBy = 'department', departmentIds = [] } = {}
) {
  const phongIds = await boLocPhong(user, departmentIds);
  const duLieu = await taiDuLieuDem(user);

  const works = duLieu.works.filter(
    (row) =>
      dungPhong(row, phongIds) && giaoNhau(ngayCua(row.start_date), ngayCua(row.end_date), from, to)
  );
  const itemsTheoWork = new Map();
  for (const row of duLieu.items) {
    if (!itemsTheoWork.has(row.work_id)) itemsTheoWork.set(row.work_id, []);
    itemsTheoWork.get(row.work_id).push(row);
  }

  // Tên phân công cho tooltip Gantt: đổi MỘT lượt id→full_name cho mọi id được nhắc trong các
  // công việc/mục sắp hiển thị (supervisor + leader_ids). leader_names gắn thẳng lên dòng để
  // nutItem/nutWork đọc như cột thường.
  const ids = new Set();
  const themId = (v) => v != null && ids.add(Number(v));
  for (const w of works) {
    themId(w.supervisor_id);
    (w.leader_ids ?? []).forEach(themId);
  }
  for (const list of itemsTheoWork.values())
    for (const it of list) (it.leader_ids ?? []).forEach(themId);
  const banDoTen = new Map(
    (await userRepo.listByIds([...ids])).map((r) => [String(r.id), r.full_name])
  );
  const ghiTen = (row) => {
    if ('leader_names' in row) return;
    row.supervisor_name =
      row.supervisor_id != null ? (banDoTen.get(String(row.supervisor_id)) ?? null) : null;
    row.leader_names = (row.leader_ids ?? []).map((id) => banDoTen.get(String(id))).filter(Boolean);
  };
  works.forEach(ghiTen);
  for (const list of itemsTheoWork.values()) list.forEach(ghiTen);

  // Tên riêng theo tháng — MỘT lượt cho đúng những dòng sắp vẽ, cùng lối với `banDoTen` ở trên.
  // Không đi qua `works/service.list` được: Gantt đọc số liệu từ `v_countable_*` qua `taiDuLieuDem`,
  // nên các dòng ở đây chưa từng qua chỗ gắn tên tháng của cấp 1.
  const idItems = [];
  for (const list of itemsTheoWork.values()) for (const it of list) idItems.push(it.id);
  const [riengWork, riengItem] = await Promise.all([
    monthNamesRepo.listForWorks(works.map((w) => w.id)),
    monthNamesRepo.listForItems(idItems),
  ]);
  const banDoThang = banDoTenThang([...riengWork, ...riengItem]);
  const ghiThang = (row, kind) => {
    row.month_names = banDoThang.get(khoaThang(kind, row.id)) ?? {};
  };
  works.forEach((w) => ghiThang(w, 'work'));
  for (const list of itemsTheoWork.values()) list.forEach((it) => ghiThang(it, 'item'));

  const groups =
    groupBy === 'deputy'
      ? await nhomTheoDeputy(works, itemsTheoWork)
      : groupBy === 'assignee'
        ? nhomTheoAssignee(works, itemsTheoWork)
        : await nhomTheoPhong(works, itemsTheoWork);

  return { from, to, groupBy, groups };
}

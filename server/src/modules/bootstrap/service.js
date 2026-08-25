// Gói dữ liệu đầu trang — `GET /api/v1/bootstrap` (§7 việc 5.10).
//
// Một lời gọi thay cho chuỗi `getDataForUser` + `getDepartmentContext` + vài lời đếm rời của bản
// cũ. Giao diện cũ vẫn gọi từng tên RPC; cầu RPC lấy gói này rồi dịch sang hình dạng khoá `COL`.
//
// Ba quyết định đáng ghi:
//
//  1. **Cây (works/items) đọc bảng gốc, thống kê đọc view.** Việc 5.6: mục 'Chờ duyệt' vẫn hiện
//     trong danh sách (nhãn vàng). Việc 5.4: cùng mục đó không được vào bất kỳ thẻ số / biểu đồ nào.
//     Trộn hai nguồn vào một câu SQL là làm một trong hai việc sai. Thống kê chỉ SELECT từ
//     `v_countable_works` / `v_countable_items` — test EXPLAIN khẳng định điều đó.
//  2. **Nạp cây một lần, không N+1.** `getTasks` của cầu RPC quét từng công việc một lời gọi
//     `/work-items` (§13.5). Bootstrap gọi `listForWorks` một câu, đúng lý do việc 5.10 tồn tại.
//  3. **`name = full_name`.** `app.js` đọc `currentUser.name` (57 chỗ). Sửa ở cầu nối, không sửa
//     57 chỗ của file 3653 dòng — `publicUser()` đã gán sẵn, gói này đi cùng đường đó.
import { pool } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import * as logsRepo from '../activityLogs/repo.js';
import * as approvalsService from '../approvals/service.js';
import { publicUser } from '../auth/service.js';
import * as deptRepo from '../departments/repo.js';
import { groupManagerEmails, toPublic as departmentRest } from '../departments/service.js';
import * as remindersRepo from '../reminders/repo.js';
import * as usersRepo from '../users/repo.js';
import { publicStaff } from '../users/service.js';
import * as itemsRepo from '../workItems/repo.js';
import * as worksService from '../works/service.js';

/** Câu thống kê — xuất ra để test EXPLAIN đọc đúng hai view, không đọc bảng gốc. */
export const STATS_QUERIES = Object.freeze({
  works: `SELECT id, department_id, manager_id, created_by, status
            FROM v_countable_works`,
  items: `SELECT i.id, i.work_id, i.department_id, i.assignee_id, i.created_by,
                 i.status, i.due_date, i.level,
                 w.manager_id AS work_manager_id
            FROM v_countable_items i
            JOIN v_countable_works w ON w.id = i.work_id`,
});

const entityOf = (level) => (Number(level) === itemsRepo.LEVEL_SUBWORK ? 'subwork' : 'task');

/** "yyyy-MM-dd" theo giờ địa phương của tiến trình — cùng luật với `cron.js` (`ngaySo`). */
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

function laHoanThanh(status) {
  return String(status ?? '')
    .toLowerCase()
    .includes('hoàn thành');
}

function laDangLam(status) {
  return String(status ?? '')
    .toLowerCase()
    .includes('đang');
}

async function hangThongKe(user) {
  const [worksRes, itemsRes] = await Promise.all([
    pool.query(STATS_QUERIES.works),
    pool.query(STATS_QUERIES.items),
  ]);
  const works = worksRes.rows.filter((row) => can(user, 'read', 'work', row).ok);
  const items = itemsRes.rows.filter((row) => can(user, 'read', entityOf(row.level), row).ok);
  return { works, items };
}

function summaryFrom(works, items) {
  const homNay = ngaySo();
  let completedTasks = 0;
  let ongoingTasks = 0;
  let overdueTasks = 0;
  for (const row of items) {
    if (laHoanThanh(row.status)) completedTasks += 1;
    else if (laDangLam(row.status)) ongoingTasks += 1;
    const due = ngayCua(row.due_date);
    if (due && due < homNay && !laHoanThanh(row.status)) overdueTasks += 1;
  }
  return {
    totalProjects: works.length,
    totalTasks: items.length,
    completedTasks,
    ongoingTasks,
    overdueTasks,
  };
}

function chartFrom(items) {
  if (items.length === 0) {
    return {
      labels: [],
      data: [],
      message: 'Không có dữ liệu nhiệm vụ để tạo biểu đồ.',
    };
  }
  const counts = new Map();
  for (const row of items) {
    const label = String(row.status ?? '').trim() || 'Không xác định';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { labels: [...counts.keys()], data: [...counts.values()] };
}

async function attachReminders(rows) {
  const map = await remindersRepo.mapByItemIds(rows.map((r) => r.id));
  return rows.map((row) => ({ ...row, reminders: map.get(row.id) ?? [] }));
}

/**
 * Ngữ cảnh phòng — hình dạng mà `loadDepartmentContext` của `app.js` đọc.
 *
 * `isDeputyDirector` / `isDepartmentHead` so khớp CHÍNH XÁC vai `users.role`, không `includes`
 * (bẫy "Trợ lý admin" / "Phó Giám đốc" khớp "giám đốc", §13.5).
 */
export async function departmentContext(user) {
  const [departments, managers] = await Promise.all([
    deptRepo.listAll(),
    deptRepo.listAllManagers(),
  ]);
  const managerEmailsByDeptId = groupManagerEmails(managers);
  const rest = departments.map((d) => departmentRest(d, managerEmailsByDeptId));
  const departmentNames = rest.map((d) => d.name);
  const nameById = new Map(departments.map((d) => [d.id, d.name]));

  let visibleDepartments;
  if (user.role === 'admin') {
    visibleDepartments = departmentNames;
  } else if (user.role === 'Phó Giám đốc') {
    visibleDepartments = (user.managedDepartmentIds ?? [])
      .map((id) => nameById.get(id))
      .filter(Boolean);
  } else {
    const mine = nameById.get(user.department_id);
    visibleDepartments = mine ? [mine] : [];
  }

  return {
    departments: rest,
    departmentNames,
    visibleDepartments,
    myDepartment: nameById.get(user.department_id) ?? '',
    myDeptRole: user.dept_role ?? '',
    isDeputyDirector: user.role === 'Phó Giám đốc',
    isDepartmentHead: user.role === 'Trưởng phòng' || user.role === 'Phó phòng',
  };
}

/**
 * Gói REST của việc 5.10. `works` / `items` / `activities` nằm cạnh phần "mỏng" (user, phòng,
 * người, badge, thống kê) vì cầu RPC dựng `projects`/`tasks` từ đây, không phải vì giao diện REST
 * bắt buộc phải vẽ cây từ bootstrap.
 */
export async function getBundle(user) {
  const [works, people, departments, managers, pending, activities, countable] = await Promise.all([
    worksService.list(user),
    usersRepo.listAll(),
    deptRepo.listAll(),
    deptRepo.listAllManagers(),
    approvalsService.pendingCount(user),
    logsRepo.listRecent({
      limit: 22,
      actorId: user.role === 'admin' ? null : user.id,
    }),
    hangThongKe(user),
  ]);
  const stats = summaryFrom(countable.works, countable.items);
  const chartData = chartFrom(countable.items);

  const rawItems = await itemsRepo.listForWorks(works.map((w) => w.id));
  const workById = new Map(works.map((w) => [w.id, w]));
  const visibleItems = rawItems.filter((row) => {
    const work = workById.get(row.work_id);
    return can(user, 'read', entityOf(row.level), {
      ...row,
      work_department_id: work?.department_id,
      work_manager_id: work?.manager_id,
    }).ok;
  });
  const items = await attachReminders(visibleItems);
  const managerEmailsByDeptId = groupManagerEmails(managers);

  return {
    user: publicUser(user),
    departments: departments.map((d) => departmentRest(d, managerEmailsByDeptId)),
    people: people.map(publicStaff),
    pendingCount: pending,
    summaryStats: stats,
    chartData,
    works,
    items,
    activities,
  };
}

export default { getBundle, departmentContext, STATS_QUERIES };

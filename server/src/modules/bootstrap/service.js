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
import { can } from '../../middleware/rbac.js';
import { banDoTenThang, ganTenThang } from '../../utils/monthNames.js';
import * as logsRepo from '../activityLogs/repo.js';
import { thayDuocNhap } from '../approvals/rules.js';
import * as approvalsService from '../approvals/service.js';
import * as appsService from '../apps/service.js';
import { publicUser } from '../auth/service.js';
import * as deptRepo from '../departments/repo.js';
import { groupManagerEmails, toPublic as departmentRest } from '../departments/service.js';
import * as notiRepo from '../notifications/repo.js';
import * as proposalsService from '../proposals/service.js';
import * as remindersRepo from '../reminders/repo.js';
import { demNhomFileTheoItem } from '../taskFiles/repo.js';
import * as usersRepo from '../users/repo.js';
import { publicStaff } from '../users/service.js';
import * as itemsRepo from '../workItems/repo.js';
import { ganTienDo, ganTienDoWorks } from '../workItems/tienDo.js';
import * as monthNamesRepo from '../workMonthNames/repo.js';
import { taiDuLieuDem, summaryFrom as summaryStats } from '../stats/service.js';
import * as worksService from '../works/service.js';

// Giữ export để kiểm EXPLAIN dùng đúng chính các truy vấn thống kê đang chạy.
import { QUERIES as STATS_QUERIES } from '../stats/repo.js';
export { STATS_QUERIES };

const entityOf = (level) => (Number(level) === itemsRepo.LEVEL_SUBWORK ? 'subwork' : 'task');

async function hangThongKe(user) {
  const { works, items } = await taiDuLieuDem(user);
  return { works, items: items.filter((row) => Number(row.level) === 3) };
}
function summaryFrom(works, items) {
  const { totalWorks, totalTasks, completedTasks, ongoingTasks, overdueTasks } = summaryStats(
    works,
    items
  );
  return { totalProjects: totalWorks, totalTasks, completedTasks, ongoingTasks, overdueTasks };
}
function chartFrom(items) {
  const counts = new Map();
  for (const row of items) {
    const label = row.hoan_thanh ? 'Đã duyệt đủ kết quả' : 'Chưa duyệt đủ kết quả';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    labels: [...counts.keys()],
    data: [...counts.values()],
    ...(items.length ? {} : { message: 'Không có dữ liệu nhiệm vụ để tạo biểu đồ.' }),
  };
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
  const [
    works,
    people,
    departments,
    managers,
    pending,
    activities,
    countable,
    proposals,
    apps,
    unread,
  ] = await Promise.all([
    worksService.list(user, {}, { withProgress: false }),
    usersRepo.listAll(),
    deptRepo.listAll(),
    deptRepo.listAllManagers(),
    approvalsService.pendingCount(user),
    logsRepo.listRecent({
      limit: 22,
      actorId: user.role === 'admin' ? null : user.id,
    }),
    hangThongKe(user),
    // Phase 7: đề nghị đi cùng gói đăng nhập vì `handleSuccessfulLogin` gán
    // `allProposals = data.proposals` một lần rồi mới `renderProposals()` (app.js:198).
    proposalsService.list(user),
    // App cũng vậy: `allApps` chỉ được nạp từ gói này, không có tên RPC nào lấy danh sách app.
    appsService.list(user),
    // Chuông thông báo (2026-09-06): có SỐ ngay lần vẽ đầu, không phải chờ một vòng fetch. Chỉ con
    // số, không kéo cả danh sách — hộp chuông chỉ nạp danh sách khi người dùng bấm mở.
    notiRepo.countUnread(user.id),
  ]);
  const stats = summaryFrom(countable.works, countable.items);
  const chartData = chartFrom(countable.items);

  const { items } = await cayChoUser(user, works);
  const managerEmailsByDeptId = groupManagerEmails(managers);

  return {
    user: publicUser(user),
    departments: departments.map((d) => departmentRest(d, managerEmailsByDeptId)),
    people: people.map(publicStaff),
    pendingCount: pending,
    unreadCount: unread,
    summaryStats: stats,
    chartData,
    works,
    items,
    activities,
    proposals: proposals.proposals,
    proposalCounts: proposals.counts,
    apps: apps.apps,
  };
}

/**
 * Cây (works + items kèm nhắc việc) mà người này được thấy — MỘT bộ truy vấn, không N+1.
 *
 * EXPORT cho cầu RPC `getTasks`: trước đây handler đó quét từng công việc một lời gọi
 * `/work-items` (§13.5, đã đo ở §8.5 C6). Nay bootstrap và RPC uống chung hàm này — sửa luật
 * hiển thị chỉ có thể diễn ra ở MỘT chỗ.
 */
export async function cayChoUser(user, works = null) {
  const danhSach = works ?? (await worksService.list(user, {}, { withProgress: false }));
  const rawItems = await itemsRepo.listForWorks(danhSach.map((w) => w.id));
  const workById = new Map(danhSach.map((w) => [w.id, w]));
  const visibleItems = rawItems.filter(
    (row) =>
      can(user, 'read', entityOf(row.level), {
        ...row,
        work_department_id: workById.get(row.work_id)?.department_id,
        work_manager_id: workById.get(row.work_id)?.manager_id,
      }).ok &&
      // Bản NHÁP (012) chỉ người lập và admin thấy. `danhSach` đã lọc ở cấp 1 qua
      // `worksService.list`, nhưng dòng cấp 2/3 để nháp RIÊNG trong một công việc đã duyệt thì
      // chỉ chỗ này bắt được — đây là đường đọc của cả gói bootstrap và cầu RPC `getTasks`.
      thayDuocNhap(user, row)
  );
  // Bug 2 (8b): tiến độ = mức hoàn thành các NHÓM FILE KẾT QUẢ, không còn là ô nhập tay.
  // Gắn `tien_do` ở đây — chỗ duy nhất cả gói bootstrap lẫn cầu RPC `getTasks` cùng đi qua —
  // một câu đếm cho toàn cây, không N+1. Cấp 2 gộp tiến độ/hoàn thành của con trực tiếp.
  ganTienDo(
    visibleItems,
    await demNhomFileTheoItem(
      null,
      visibleItems.map((row) => row.id)
    )
  );
  ganTienDoWorks(danhSach, visibleItems);
  // Tên theo tháng của cấp 2/cấp 3 gắn Ở ĐÂY, không phải trong `attachReminders`: đây là chỗ duy
  // nhất cả gói bootstrap và cầu RPC `getTasks` cùng đi qua, nên gắn một lần là cả hai đường đọc có.
  // `works` đã được `worksService.list` gắn sẵn phần của cấp 1.
  const rieng = await monthNamesRepo.listForItems(visibleItems.map((r) => r.id));
  const banDo = banDoTenThang(rieng);
  return {
    works: danhSach,
    items: ganTenThang(await attachReminders(visibleItems), banDo, 'item'),
  };
}

export default { getBundle, departmentContext, STATS_QUERIES };

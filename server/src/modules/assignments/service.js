// Phân công ba lớp trên cây công việc — Ban lãnh đạo kiểm soát, Lãnh đạo phòng phụ trách,
// Cán bộ làm trực tiếp (yêu cầu người dùng ngày 2026-08-26).
//
// Nguyên tắc DUY NHẤT của module: KHÔNG tin danh sách người dùng gửi lên. Mọi id gửi lên đều
// được đối chiếu lại với `department_managers` + `users` ở đây; sai nguồn là VALIDATION_ERROR.
// Giao diện chỉ vẽ dropdown từ `listCandidates`, còn nguồn sự thật vẫn là hai bảng đó.
//
// Từ vựng (§0.1): Công việc = cấp 1 · Công việc con = cấp 2 · Nhiệm vụ = cấp 3.
import { AppError } from '../../utils/errors.js';
import * as deptRepo from '../departments/repo.js';
import * as itemsRepo from '../workItems/repo.js';
import * as usersRepo from '../users/repo.js';

const err = (code, message, extra = {}) => new AppError(code, message, extra);

const LEVEL_SUBWORK = 2;

/** Hai vai được làm Ban lãnh đạo kiểm soát, khớp CHÍNH XÁC cột users.role (bẫy includes, §13.5). */
const VAI_KIEM_SOAT = Object.freeze(['admin', 'Phó Giám đốc']);

/** Hai vai phụ trách phòng được chọn vào "Lãnh đạo phòng phụ trách" — role của department_managers. */
export const LEADER_MANAGER_ROLES = Object.freeze(['head', 'vice']);

const gomNguoi = (rows) =>
  rows
    .map((r) => ({ id: Number(r.user_id ?? r.id), name: r.full_name ?? r.name ?? '' }))
    .sort((a, b) => a.id - b.id);

/**
 * Danh sách ứng viên cho form, theo phòng đã chọn.
 *
 *   • Có phòng  : supervisors = Phó GĐ PHỤ TRÁCH phòng đó ∪ admin; leaders = head/vice của phòng.
 *   • Không phòng ("Công việc chung"): supervisors = mọi Phó GĐ đang hoạt động ∪ admin;
 *     leaders = [] — công việc chung không có "lãnh đạo phòng" để chọn.
 *
 * Trả kèm `defaultSupervisorId` để form điền sẵn đúng luật: có Phó GĐ phụ trách phòng ⇒ chọn
 * người đó, không thì admin (cùng luật với backfill 005_phan_cong.sql — một luật, hai chỗ đọc).
 */
export async function listCandidates(departmentId, client = null) {
  const coPhong = departmentId != null && String(departmentId).trim() !== '';
  const phongId = coPhong ? Number(departmentId) : null;

  // `listByRoles` trả MẢNG người dùng trực tiếp (không bọc {rows}).
  const admins = await usersRepo.listByRoles(['admin'], client);
  const supervisorRows = admins.filter((u) => u.is_active);

  if (!coPhong) {
    const pgd = await usersRepo.listByRoles(['Phó Giám đốc'], client);
    const supervisors = gomNguoi([...supervisorRows, ...pgd.filter((u) => u.is_active)]);
    return { supervisors, leaders: [], defaultSupervisorId: supervisors[0]?.id ?? null };
  }

  const managers = await deptRepo.listManagers(phongId, client);
  const supervisors = gomNguoi(managers.filter((m) => m.role === 'deputy_director'));
  const leaders = gomNguoi(managers.filter((m) => LEADER_MANAGER_ROLES.includes(m.role)));
  for (const a of supervisorRows) {
    if (!supervisors.some((s) => s.id === Number(a.id))) {
      supervisors.push({ id: Number(a.id), name: a.full_name });
    }
  }

  return { supervisors, leaders, defaultSupervisorId: supervisors[0]?.id ?? null };
}

/**
 * Ban lãnh đạo kiểm soát của một công việc/công việc con.
 * Trống (`null`/`undefined`) là hợp lệ — dữ liệu cũ chưa điền không bị chặn sửa.
 */
export async function assertSupervisor(supervisorId, departmentId, client = null) {
  if (supervisorId == null) return;
  const user = await usersRepo.findById(supervisorId, client);
  if (!user || !user.is_active || !VAI_KIEM_SOAT.includes(user.role)) {
    throw err('VALIDATION_ERROR', 'Ban lãnh đạo kiểm soát phải là admin hoặc Phó Giám đốc');
  }
  if (user.role !== 'Phó Giám đốc') return; // admin: hợp lệ với mọi phòng
  if (departmentId == null) return; // công việc chung: mọi Phó GĐ đều được
  const managers = await deptRepo.listManagers(Number(departmentId), client);
  if (
    !managers.some(
      (m) => m.role === 'deputy_director' && Number(m.user_id) === Number(supervisorId)
    )
  ) {
    throw err(
      'VALIDATION_ERROR',
      'Ban lãnh đạo kiểm soát phải là Phó Giám đốc phụ trách phòng này hoặc admin'
    );
  }
}

/** Lãnh đạo phòng phụ trách: từng id phải là Trưởng/Phó phòng ĐANG hoạt động của phòng đã chọn. */
export async function assertLeaders(leaderIds, departmentId, client = null) {
  const ids = Array.isArray(leaderIds) ? leaderIds.map(Number) : [];
  if (ids.length === 0) return;
  if (departmentId == null) {
    throw err('VALIDATION_ERROR', 'Công việc chung không có lãnh đạo phòng phụ trách');
  }
  const managers = await deptRepo.listManagers(Number(departmentId), client);
  const hopLe = new Set(
    managers.filter((m) => LEADER_MANAGER_ROLES.includes(m.role)).map((m) => Number(m.user_id))
  );
  if (ids.some((id) => !hopLe.has(id))) {
    throw err(
      'VALIDATION_ERROR',
      'Lãnh đạo phòng phụ trách phải là Trưởng phòng hoặc Phó phòng của phòng này',
      { field: 'leaderIds' }
    );
  }
}

/**
 * Nguồn hợp lệ của ô "Lãnh đạo phòng phụ trách" trên NHIỆM VỤ (cấp 3):
 *   • nằm trong công việc con ⇒ một trong `leader_ids` của công việc con đó;
 *   • thuộc công việc cha trực tiếp ⇒ một trong các Phó GĐ phụ trách phòng của công việc;
 *     công việc chung ⇒ Ban lãnh đạo kiểm soát của chính công việc đó ∪ admin.
 *
 * @returns {Promise<Set<number>>} tập id người hợp lệ
 */
export async function validTaskLeaders({ parentRow = null, workRow = null }, client = null) {
  const allowed = new Set();
  if (parentRow) {
    for (const id of parentRow.leader_ids ?? []) allowed.add(Number(id));
    return allowed;
  }
  if (workRow?.department_id != null) {
    const managers = await deptRepo.listManagers(Number(workRow.department_id), client);
    for (const m of managers.filter((x) => x.role === 'deputy_director')) {
      allowed.add(Number(m.user_id));
    }
    return allowed;
  }
  // Công việc chung, nhiệm vụ thuộc cha trực tiếp: Ban kiểm soát của công việc + admin.
  if (workRow?.supervisor_id != null) allowed.add(Number(workRow.supervisor_id));
  const admins = await usersRepo.listByRoles(['admin'], client);
  for (const a of admins) if (a.is_active) allowed.add(Number(a.id));
  return allowed;
}

/** Chặn leader của nhiệm vụ ngoài nguồn hợp lệ. CHECK `task_leader_single` đã giới hạn ≤ 1 phần tử. */
export async function assertTaskLeader(taskLeaderIds, source, client = null) {
  const ids = Array.isArray(taskLeaderIds) ? taskLeaderIds.map(Number) : [];
  if (ids.length === 0) return;
  const allowed = await validTaskLeaders(source, client);
  if (!allowed.has(ids[0])) {
    throw err(
      'LEADER_NOT_IN_SOURCE',
      source.parentRow
        ? 'Lãnh đạo phòng phụ trách của nhiệm vụ phải là một trong các lãnh đạo phòng phụ trách của công việc con chứa nó'
        : 'Lãnh đạo phòng phụ trách của nhiệm vụ phải là một trong các Phó Giám đốc phụ trách phòng của công việc cha',
      { field: 'leaderIds' }
    );
  }
}

/**
 * Ứng viên "Lãnh đạo phòng phụ trách" CHO NHIỆM VỤ trên form: nếu nhiệm vụ nằm trong công việc
 * con (`parentRef` là mã/id cấp 2) thì nguồn = `leader_ids` của chính công việc con đó; nếu thuộc
 * cha trực tiếp thì nguồn = Phó GĐ phụ trách phòng (công việc chung ⇒ supervisor + admin).
 * Trả cùng hình dạng `{supervisors, leaders}` với `listCandidates` để form vẽ không phân biệt nguồn.
 */
export async function listTaskCandidates({ departmentId = null, parentRef = null }, client = null) {
  if (parentRef != null && String(parentRef).trim() !== '') {
    const parent = await itemsRepo.findByRef(String(parentRef).trim(), client);
    if (parent && Number(parent.level) === LEVEL_SUBWORK) {
      const people = await usersRepo.listByIds(parent.leader_ids ?? [], client);
      const leaders = people.map((p) => ({ id: Number(p.id), name: p.full_name }));
      return { supervisors: [], leaders, defaultLeaderId: leaders[0]?.id ?? null };
    }
  }
  const opts = await listCandidates(departmentId, client);
  return { ...opts, defaultLeaderId: opts.leaders[0]?.id ?? null };
}

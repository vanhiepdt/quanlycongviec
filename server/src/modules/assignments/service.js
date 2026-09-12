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

const leaderHopLe = (m) =>
  m.is_active &&
  LEADER_MANAGER_ROLES.includes(m.role) &&
  ['Trưởng phòng', 'Phó phòng'].includes(m.user_role);

/**
 * Quyền sửa nội dung không cho Cán bộ tự đổi người duyệt hoặc người nhận việc.
 *
 * MỚI-5 (12/09/2026) — MỞ khi LẬP MỚI nhiệm vụ cấp 3. Người dùng báo: «nhân viên khi được phép tạo
 * nhiệm vụ cấp 3, nhưng không chọn được Ban lãnh đạo kiểm soát, Người thực hiện trực tiếp». Lúc lập
 * mới thì chưa có «việc của mình» nào để mà tự duyệt, nên lý do khoá cũ (cán bộ tự chỉ định người
 * duyệt cho việc của chính mình) không áp dụng — hai ô đó phải mở. RBAC `create` của vai Nhân viên
 * (`middleware/rbac.js`) vẫn giữ vai trò của nó: phải cùng phòng với công việc và đã có việc trong
 * cây (`assigned_in_work`) mới tạo được nhiệm vụ cho NGƯỜI KHÁC; `assertSupervisorsByLevel` vẫn bó
 * BLĐKS cấp 3 phải là MỘT trong các BLĐKS của công việc con chứa nó, nên không mở ra cửa chọn bừa.
 *
 * SỬA một nhiệm vụ có sẵn thì GIỮ KHOÁ như cũ (`taoMoi` không truyền ⇒ false), và `leader_ids`
 * (Lãnh đạo phòng phụ trách) khoá ở MỌI trường hợp — người dùng chỉ yêu cầu mở hai ô kia.
 *
 * @param {object} ctx `{ taoMoi, level }` — chỉ `create` của `workItems` truyền `taoMoi: true`
 */
/** Bốn vai được đổi ô phân công mà không bị `assertAssignmentActor` chặn (MỚI-5 tách ra dùng chung). */
const VAI_DUOC_DOI_PHAN_CONG = Object.freeze([
  'admin',
  'Phó Giám đốc',
  'Trưởng phòng',
  'Phó phòng',
]);

export function assertAssignmentActor(user, input, current = null, ctx = {}) {
  if (VAI_DUOC_DOI_PHAN_CONG.includes(user?.role)) return;
  const moKhiLapMoiCapBa = ctx?.taoMoi === true && Number(ctx?.level) === 3;
  // Đợt A (028): `supervisor_id` đơn thành MẢNG `supervisor_ids`, nên so sánh phải chuẩn hoá về
  // cùng một dạng trước — so thẳng hai mảng là so theo THỨ TỰ, và [3,7] ≠ [7,3] dù là cùng một
  // danh sách. Sắp xếp theo số rồi mới so, đúng cách `leader_ids` bên dưới vẫn làm.
  const chuanHoa = (v) => JSON.stringify((v ?? []).map(Number).sort((a, b) => a - b));
  const doiSupervisor =
    !moKhiLapMoiCapBa &&
    input.supervisor_ids !== undefined &&
    chuanHoa(input.supervisor_ids) !== chuanHoa(current?.supervisor_ids);
  const doiLeaders =
    input.leader_ids !== undefined &&
    JSON.stringify((input.leader_ids ?? []).map(Number).sort()) !==
      JSON.stringify((current?.leader_ids ?? []).map(Number).sort());
  if (doiSupervisor || doiLeaders) {
    throw err(
      'FORBIDDEN',
      'Chỉ lãnh đạo có quyền phân công mới được đổi Ban lãnh đạo và Lãnh đạo phòng phụ trách'
    );
  }
  if (
    !moKhiLapMoiCapBa &&
    input.assignee_id != null &&
    Number(input.assignee_id) !== Number(user?.id)
  ) {
    throw err('FORBIDDEN', 'Cán bộ chỉ được tự nhận nhiệm vụ cho mình');
  }
}

/**
 * MỚI-5 (12/09/2026): hàng rào đi KÈM với `moKhiLapMoiCapBa` ở trên.
 *
 * Mở ô «Người thực hiện trực tiếp» cho cán bộ lúc LẬP MỚI nhiệm vụ cấp 3 mà không bó lại thì một
 * cán bộ giao được việc cho BẤT KỲ ai trong công ty — rộng hơn cả quyền Trưởng phòng, và RBAC
 * `create` của vai Nhân viên chỉ xét phòng của CÔNG VIỆC chứ không xét phòng của NGƯỜI ĐƯỢC GIAO.
 * Giao diện chỉ bày nhân viên cùng phòng (`web/assets/js/app.js`), nhưng máy chủ không tin danh
 * sách gửi lên — đó là nguyên tắc duy nhất của module này.
 *
 * Hai người cùng KHÔNG có phòng (công việc chung) thì KHÔNG coi là cùng phòng: không có gì để đối
 * chiếu, thà bắt lãnh đạo gán còn hơn mở một cửa không kiểm được.
 */
export async function assertAssigneeCungPhong(user, assigneeId, client = null) {
  if (VAI_DUOC_DOI_PHAN_CONG.includes(user?.role)) return;
  if (assigneeId == null || Number(assigneeId) === Number(user?.id)) return;
  const phongToi = user?.department_id == null ? null : Number(user.department_id);
  const nguoi = await usersRepo.findById(assigneeId, client);
  const phongNguoi = nguoi?.department_id == null ? null : Number(nguoi.department_id);
  if (!nguoi?.is_active || phongToi == null || phongToi !== phongNguoi) {
    throw err('FORBIDDEN', 'Cán bộ chỉ được giao nhiệm vụ cho người cùng phòng', {
      field: 'assigneeId',
    });
  }
}

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
    // Công việc chung không có phòng ⇒ không có Phó GĐ PHỤ TRÁCH ⇒ không ai duyệt được kết quả
    // của Trưởng/Phó phòng, nên không mở danh sách lãnh đạo nhận việc trực tiếp.
    return {
      supervisors,
      leaders: [],
      defaultSupervisorId: supervisors[0]?.id ?? null,
      lanhDaoLamTrucTiep: [],
      coPhoGiamDocPhuTrach: false,
    };
  }

  const managers = await deptRepo.listManagers(phongId, client);
  const supervisors = gomNguoi(
    managers.filter(
      (m) => m.is_active && m.role === 'deputy_director' && m.user_role === 'Phó Giám đốc'
    )
  );
  const leaders = gomNguoi(managers.filter(leaderHopLe));
  for (const a of supervisorRows) {
    if (!supervisors.some((s) => s.id === Number(a.id))) {
      supervisors.push({ id: Number(a.id), name: a.full_name });
    }
  }

  // Trưởng/Phó phòng chỉ được nhận việc trực tiếp khi phòng CÓ Phó GĐ phụ trách đang hoạt động —
  // nếu không thì kết quả của họ không ai duyệt được (quyết định 2026-09-09). Trả danh sách rỗng
  // để giao diện khỏi tự suy luận; máy chủ vẫn chặn lại lần nữa khi lưu.
  const coPhoGiamDocPhuTrach = managers.some((m) => m.role === 'deputy_director' && m.is_active);

  return {
    supervisors,
    leaders,
    defaultSupervisorId: supervisors[0]?.id ?? null,
    lanhDaoLamTrucTiep: coPhoGiamDocPhuTrach ? leaders : [],
    coPhoGiamDocPhuTrach,
  };
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

/**
 * Ban lãnh đạo kiểm soát là MẢNG (đợt A, 028) — kiểm từng id một bằng đúng luật của bản đơn.
 *
 * Rỗng là HỢP LỆ ở đây: dữ liệu cũ chưa phân công không bị chặn sửa, và «bắt buộc có người mới
 * gửi duyệt được» là luật của `approvals/service.submit` (R1a), không phải của lúc lưu. Đặt luật
 * bắt buộc ở đây thì không ai sửa nổi một công việc cũ để mà thêm người vào.
 *
 * Trùng lặp bị loại: hai lần cùng một người trong mảng là một dòng, không phải hai người duyệt.
 */
export async function assertSupervisors(supervisorIds, departmentId, client = null) {
  const ids = Array.isArray(supervisorIds) ? supervisorIds.map(Number) : [];
  for (const id of [...new Set(ids)]) {
    await assertSupervisor(id, departmentId, client);
  }
}

/**
 * NGUỒN hợp lệ của ô «Ban lãnh đạo kiểm soát» THEO CẤP (D2 — người dùng chốt 10/09/2026):
 *
 *   • cấp 1 : mọi admin / Phó GĐ phụ trách phòng ⇒ KHÔNG giới hạn tập nguồn, trả `null`;
 *   • cấp 2 : chỉ trong tập đã chọn ở CẤP 1;
 *   • cấp 3 : ĐÚNG MỘT người, và chỉ trong tập đã chọn ở CẤP 2 (không có cấp 2 thì lấy của cấp 1).
 *
 * Tập nguồn RỖNG ⇒ trả `null` (không giới hạn) chứ không phải tập rỗng: công việc cha chưa kịp phân
 * công thì bắt cấp 2 chọn trong «không ai» là khoá cứng cả cây, không ai gỡ được.
 *
 * Khuôn chép từ `validTaskLeaders` bên dưới — cùng một ý «cấp dưới chọn trong tập cấp trên», đã chạy
 * ổn định cho `leader_ids` từ 005, nên không phát minh cơ chế mới. Khác một chỗ: hàm đó phải đọc
 * CSDL để lọc người còn hoạt động, hàm này thì KHÔNG — tập nguồn đọc thẳng từ hai dòng cha/ông đã
 * nằm sẵn trong tay người gọi, nên nó là hàm thuần (eslint `require-await` cũng đòi đúng như vậy).
 *
 * @returns {Set<number>|null} tập id được chọn, hoặc `null` khi không giới hạn
 */
export function nguonBanKiemSoat({ level, parentRow = null, workRow = null }) {
  const cap = Number(level);
  const thanhTap = (arr) => {
    const ids = (arr ?? []).map(Number).filter(Number.isFinite);
    return ids.length === 0 ? null : new Set(ids);
  };
  if (cap === 1) return null;
  if (cap === LEVEL_SUBWORK) return thanhTap(workRow?.supervisor_ids);
  // Cấp 3: ưu tiên tập của CÔNG VIỆC CON chứa nó; nhiệm vụ treo thẳng cấp 1 thì lấy tập cấp 1.
  if (parentRow) return thanhTap(parentRow.supervisor_ids);
  return thanhTap(workRow?.supervisor_ids);
}

/**
 * Kiểm ô «Ban lãnh đạo kiểm soát» của MỘT dòng theo đúng cấp của nó.
 *
 * Ba lớp kiểm, lớp nào cũng cần: vai/phòng (`assertSupervisor`) không biết cây, còn tập nguồn không
 * biết người đó có còn là Phó GĐ phụ trách phòng hay không — bỏ lớp nào cũng mở một đường vòng.
 *
 * @param {number[]|null} supervisorIds danh sách gửi lên
 * @param {object} ctx `{ level, parentRow, workRow, departmentId }`
 */
export async function assertSupervisorsByLevel(
  supervisorIds,
  { level, parentRow = null, workRow = null, departmentId = null },
  client = null
) {
  const ids = Array.isArray(supervisorIds) ? supervisorIds.map(Number) : [];
  if (Number(level) === 3 && ids.length > 1) {
    throw err('VALIDATION_ERROR', 'Nhiệm vụ chỉ được chọn MỘT Ban lãnh đạo kiểm soát', {
      field: 'supervisorIds',
    });
  }
  await assertSupervisors(ids, departmentId, client);
  if (ids.length === 0) return;
  const nguon = nguonBanKiemSoat({ level, parentRow, workRow });
  if (!nguon) return;
  if (ids.some((id) => !nguon.has(id))) {
    throw err(
      'SUPERVISOR_NOT_IN_SOURCE',
      Number(level) === 3
        ? 'Ban lãnh đạo kiểm soát của nhiệm vụ phải là MỘT trong các Ban lãnh đạo kiểm soát của công việc con chứa nó'
        : 'Ban lãnh đạo kiểm soát của công việc con phải nằm trong danh sách đã chọn ở công việc cha',
      { field: 'supervisorIds' }
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
  const hopLe = new Set(managers.filter(leaderHopLe).map((m) => Number(m.user_id)));
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
 *   • thuộc công việc cha trực tiếp ⇒ Trưởng/Phó phòng của phòng công việc;
 *     công việc chung không có lãnh đạo phòng. PGD/admin lưu riêng ở `supervisor_ids`.
 *
 * @returns {Promise<Set<number>>} tập id người hợp lệ
 */
export async function validTaskLeaders({ parentRow = null, workRow = null }, client = null) {
  const allowed = new Set();
  if (parentRow) {
    const people = await usersRepo.listByIds(parentRow.leader_ids ?? [], client);
    for (const p of people.filter(
      (u) => u.is_active && ['Trưởng phòng', 'Phó phòng'].includes(u.role)
    )) {
      allowed.add(Number(p.id));
    }
    return allowed;
  }
  if (workRow?.department_id != null) {
    const managers = await deptRepo.listManagers(Number(workRow.department_id), client);
    for (const m of managers.filter(leaderHopLe)) {
      allowed.add(Number(m.user_id));
    }
    return allowed;
  }
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
        : 'Lãnh đạo phòng phụ trách của nhiệm vụ phải là Trưởng phòng hoặc Phó phòng của phòng công việc cha',
      { field: 'leaderIds' }
    );
  }
}

/** Đổi phòng của cả cây phải giữ phân công hợp lệ ở mọi cấp trong cùng giao dịch. */
export async function assertTreeAssignments(items, departmentId, client, workRow = null) {
  const byId = new Map(items.map((i) => [String(i.id), i]));
  // Một truy vấn cho cả cây: nhiệm vụ có người thực hiện là Trưởng/Phó phòng thì phòng đích PHẢI có
  // Phó GĐ phụ trách, kể cả khi đầu việc chỉ bị CHUYỂN sang phòng khác chứ không gán lại người.
  // Không kiểm ở đây thì chuyển công việc sang phòng chưa có Phó GĐ là lách được điều kiện đó.
  const nhiemVu = items.filter((i) => Number(i.level) === 3 && i.assignee_id != null);
  const nguoiGan = new Map(
    nhiemVu.length
      ? (
          await usersRepo.listByIds([...new Set(nhiemVu.map((i) => Number(i.assignee_id)))], client)
        ).map((p) => [Number(p.id), p])
      : []
  );
  let phongDaKiem = null;
  for (const item of nhiemVu) {
    const nguoi = nguoiGan.get(Number(item.assignee_id));
    if (!nguoi || !VAI_LANH_DAO_LAM_TRUC_TIEP.includes(nguoi.role)) continue;
    if (phongDaKiem === null) phongDaKiem = await phongCoPhoGiamDocPhuTrach(departmentId, client);
    if (!phongDaKiem) {
      throw err(
        'ASSIGNEE_LEADER_NO_DEPUTY',
        `Nhiệm vụ "${item.name ?? item.code ?? ''}" đang giao cho Trưởng/Phó phòng, nhưng phòng đích chưa có Phó Giám đốc phụ trách nên không ai duyệt được kết quả. Hãy phân công Phó Giám đốc phụ trách phòng trước.`,
        { field: 'assigneeId' }
      );
    }
  }
  for (const item of items) {
    const parent = item.parent_id == null ? null : byId.get(String(item.parent_id));
    await assertGuiBld(item, { parentRow: parent, departmentId }, client);
    // Đợt A (D2): MỌI cấp đều kiểm Ban lãnh đạo kiểm soát, theo tập nguồn của cấp trên nó. Bản cũ
    // bỏ qua nhiệm vụ có cha vì cấp 3 bị cấm có người riêng — nay cấp 3 PHẢI chọn một người trong
    // tập của cấp 2, nên không còn nhánh nào được bỏ qua. `workRow` là tập nguồn của cấp 2.
    await assertSupervisorsByLevel(
      item.supervisor_ids,
      { level: item.level, parentRow: parent, workRow, departmentId },
      client
    );
    if (Number(item.level) === LEVEL_SUBWORK) {
      await assertLeaders(item.leader_ids, departmentId, client);
    } else {
      await assertTaskLeader(
        item.leader_ids,
        { parentRow: parent, workRow: { department_id: departmentId } },
        client
      );
    }
  }
}

/**
 * Ứng viên CHO NHIỆM VỤ trên form, trả cùng hình dạng `{supervisors, leaders}` với `listCandidates`
 * để form vẽ không phân biệt nguồn:
 *   • nhiệm vụ nằm trong công việc con (`parentRef` là mã/id cấp 2) ⇒ nguồn của CẢ HAI ô là chính
 *     công việc con đó: `leader_ids` cho ô Lãnh đạo phòng, `supervisor_ids` cho ô Ban lãnh đạo
 *     kiểm soát (đợt A/D2 — trước đây ô này bị bỏ trống vì cấp 3 không được có người riêng);
 *   • nhiệm vụ treo thẳng công việc cha ⇒ supervisors = PGĐ phụ trách phòng ∪ admin, leaders =
 *     Trưởng/Phó phòng của phòng công việc.
 */
export async function listTaskCandidates({ departmentId = null, parentRef = null }, client = null) {
  if (parentRef != null && String(parentRef).trim() !== '') {
    const parent = await itemsRepo.findByRef(String(parentRef).trim(), client);
    if (parent && Number(parent.level) === LEVEL_SUBWORK) {
      const people = await usersRepo.listByIds(parent.leader_ids ?? [], client);
      const leaders = people
        .filter((p) => p.is_active && ['Trưởng phòng', 'Phó phòng'].includes(p.role))
        .map((p) => ({ id: Number(p.id), name: p.full_name }));
      // Ô «Ban lãnh đạo kiểm soát» của nhiệm vụ: ĐÚNG tập của công việc con, không mở rộng ra cả
      // phòng — người dùng chốt «chỉ được chọn 1 người trong Ban lãnh đạo kiểm soát ở cấp con».
      const banKiemSoat = await usersRepo.listByIds(parent.supervisor_ids ?? [], client);
      const supervisors = banKiemSoat
        .filter((p) => p.is_active && VAI_KIEM_SOAT.includes(p.role))
        .map((p) => ({ id: Number(p.id), name: p.full_name }));
      // Nhiệm vụ trong công việc con: phòng suy từ chính công việc con, không tin tham số gửi lên.
      const opts = await listCandidates(parent.department_id ?? departmentId, client);
      return {
        supervisors,
        // Điền sẵn người ĐẦU của tập cấp 2 — đúng Q12 («chưa có BLĐKS riêng thì lấy 1 người đầu
        // tiên của cấp 2») và cùng khuôn `defaultLeaderId` bên dưới. Điền sẵn để người dùng thấy
        // một cái tên cụ thể mà đổi, thay vì một ô trống phải đoán xem ai hợp lệ.
        defaultSupervisorId: supervisors[0]?.id ?? null,
        leaders,
        defaultLeaderId: leaders[0]?.id ?? null,
        // Ô «Người thực hiện trực tiếp» lấy theo PHÒNG (mọi Trưởng/Phó phòng), không phải theo
        // `leader_ids` của công việc con — hai ô đó khác vai, đừng dùng chung danh sách.
        lanhDaoLamTrucTiep: opts.lanhDaoLamTrucTiep,
        coPhoGiamDocPhuTrach: opts.coPhoGiamDocPhuTrach,
      };
    }
  }
  const opts = await listCandidates(departmentId, client);
  return {
    ...opts,
    defaultLeaderId: opts.leaders[0]?.id ?? null,
    lanhDaoLamTrucTiep: opts.lanhDaoLamTrucTiep ?? [],
  };
}

/**
 * Hai vai lãnh đạo phòng ĐƯỢC nhận việc trực tiếp (quyết định người dùng 2026-09-09).
 * Phó Giám đốc và Giám đốc KHÔNG vào đây — họ đã có ô «Ban lãnh đạo phụ trách» riêng, đưa họ
 * vào ô người thực hiện là trộn hai lớp phân công (§0.1).
 */
export const VAI_LANH_DAO_LAM_TRUC_TIEP = Object.freeze(['Trưởng phòng', 'Phó phòng']);

/** `vai` có phải một trong hai vai lãnh đạo phòng nhận việc trực tiếp không. So khớp CHÍNH XÁC. */
export function laLanhDaoLamTrucTiep(vai) {
  return VAI_LANH_DAO_LAM_TRUC_TIEP.includes(vai);
}

/**
 * Nhãn hiển thị của người thực hiện, KÈM vai cho hai vai lãnh đạo phòng.
 *
 * Từ 2026-09-09 Trưởng/Phó phòng đứng chung danh sách người thực hiện với Cán bộ, nên thống kê E5,
 * Gantt nhóm theo người và Excel đều phải nói rõ ai là lãnh đạo (quyết định người dùng «nhãn kèm
 * vai»). Cán bộ giữ tên trơn cho bảng khỏi rối.
 *
 * `vai` phải tra theo `assignee_id` rồi mới đưa vào đây — KHÔNG đoán vai từ tên: tên trùng là có
 * thật (phép 15 `legacy-gd2-parity`), còn id thì không.
 */
export function nhanKemVai(ten, vai) {
  const s = String(ten ?? '').trim();
  if (!s) return s;
  return laLanhDaoLamTrucTiep(vai) ? `${s} (${vai})` : s;
}

/**
 * Phòng có Phó Giám đốc phụ trách ĐANG HOẠT ĐỘNG hay không.
 *
 * Điều kiện TIÊN QUYẾT để TP/PP được nhận việc trực tiếp: TP/PP không được tự duyệt kết quả của
 * chính mình (quyết định 2026-09-09), nên phòng không có Phó GĐ thì file của họ sẽ nằm im không
 * ai duyệt được. Một hàm duy nhất để MÁY CHỦ chặn khi lưu và GIAO DIỆN ẩn ứng viên — một luật,
 * hai chỗ đọc, không lệch nhau.
 */
export async function phongCoPhoGiamDocPhuTrach(departmentId, client = null) {
  if (departmentId == null) return false;
  const managers = await deptRepo.listManagers(Number(departmentId), client);
  return managers.some((m) => m.role === 'deputy_director' && m.is_active);
}

/**
 * Người thực hiện trực tiếp của nhiệm vụ — máy chủ kiểm ĐỘC LẬP với giao diện, nên gửi REST/RPC
 * trực tiếp với `assignee_id` của một Trưởng phòng vẫn đi qua đây.
 *
 *   • Cấp 3 BẮT BUỘC có người thực hiện; không tự đoán người nhận khi thiếu lựa chọn.
 *   • Người thực hiện là Trưởng/Phó phòng (quyết định 2026-09-09) thì thêm HAI điều kiện:
 *       – phòng của công việc phải có Phó GĐ phụ trách đang hoạt động (`phongCoPhoGiamDocPhuTrach`);
 *       – người gán phải là admin/Phó GĐ, hoặc Trưởng/Phó phòng CÙNG PHÒNG. Cán bộ không gán được
 *         việc cho lãnh đạo; lãnh đạo phòng này không gán được cho lãnh đạo phòng khác.
 *
 * @param {object} row dòng nhiệm vụ (hoặc payload tạo/sửa) đã có `assignee_id` chốt
 * @param {object} ctx `{ actor, departmentId }` — `departmentId` là phòng CUỐI CÙNG (khi chuyển
 *   cha sang công việc khác thì đó là phòng đích, không phải phòng của dòng cũ)
 */
export async function assertTaskAssignee(row, ctx = {}, client = null) {
  if (Number(row?.level) !== 3) return;
  if (row.assignee_id == null) {
    throw err('VALIDATION_ERROR', 'Vui lòng chọn Người thực hiện trực tiếp cho nhiệm vụ', {
      field: 'assigneeId',
    });
  }

  const nguoi = await usersRepo.findById(row.assignee_id, client);
  if (!nguoi || !VAI_LANH_DAO_LAM_TRUC_TIEP.includes(nguoi.role)) return;

  const phong = ctx.departmentId ?? row.department_id ?? null;
  if (!(await phongCoPhoGiamDocPhuTrach(phong, client))) {
    throw err(
      'ASSIGNEE_LEADER_NO_DEPUTY',
      'Không giao được nhiệm vụ cho Trưởng/Phó phòng vì phòng này chưa có Phó Giám đốc phụ trách — kết quả của họ sẽ không ai duyệt được. Hãy phân công Phó Giám đốc phụ trách phòng trước.',
      { field: 'assigneeId' }
    );
  }

  const actor = ctx.actor ?? null;
  if (!actor || ['admin', 'Phó Giám đốc'].includes(actor.role)) return;
  const lanhDaoCungPhong =
    VAI_LANH_DAO_LAM_TRUC_TIEP.includes(actor.role) &&
    actor.department_id != null &&
    phong != null &&
    Number(actor.department_id) === Number(phong);
  if (!lanhDaoCungPhong) {
    throw err(
      'FORBIDDEN',
      'Chỉ quản trị, Phó Giám đốc hoặc Trưởng/Phó phòng cùng phòng mới được giao nhiệm vụ cho Trưởng/Phó phòng',
      { field: 'assigneeId' }
    );
  }
}

/**
 * Tích «Gửi BLĐ phê duyệt» của nhiệm vụ (026) — người nhận là Ban lãnh đạo kiểm soát HIỆN HỮU,
 * không mở thêm ô chọn người mới.
 *
 * Đợt A (028) ĐẢO một phần quyết định cũ «nhiệm vụ dưới cấp 2 dùng supervisor của cấp 2»: cấp 3
 * nay có Ban lãnh đạo kiểm soát RIÊNG, nên người nhận phê duyệt là **người của chính nhiệm vụ**;
 * chỉ khi nhiệm vụ chưa chọn mới rơi xuống phần tử ĐẦU của cấp 2 (Q12). Cùng một luật với
 * `sqlSupervisorHieuLuc` của `workItems/repo.js` — hai chỗ phải khớp nhau, lệch là tích bật mà file
 * chạy tới một người, còn hàng chờ của người khác thì không thấy gì.
 */
export async function assertGuiBld(
  item,
  { parentRow = null, departmentId = item.department_id } = {},
  client = null
) {
  if (item.gui_bld_phe_duyet !== undefined && typeof item.gui_bld_phe_duyet !== 'boolean') {
    throw err('VALIDATION_ERROR', 'Tích Gửi BLĐ phải là đúng hoặc sai', {
      field: 'guiBldPheDuyet',
    });
  }
  if (!item.gui_bld_phe_duyet) return;
  if (Number(item.level) !== 3)
    throw err('VALIDATION_ERROR', 'Chỉ nhiệm vụ có tích Gửi BLĐ phê duyệt');
  const who = item.assignee_id == null ? null : await usersRepo.findById(item.assignee_id, client);
  if (VAI_LANH_DAO_LAM_TRUC_TIEP.includes(who?.role)) {
    throw err(
      'VALIDATION_ERROR',
      'TP/PP trực tiếp thực hiện luôn lên Phó Giám đốc — không dùng tích Gửi BLĐ',
      { field: 'guiBldPheDuyet' }
    );
  }
  const parent =
    item.parent_id == null
      ? null
      : (parentRow ?? (await itemsRepo.findById(item.parent_id, client)));
  const supervisor = (item.supervisor_ids ?? [])[0] ?? (parent?.supervisor_ids ?? [])[0] ?? null;
  if (supervisor == null)
    throw err('VALIDATION_ERROR', 'Nhiệm vụ chưa có Ban lãnh đạo kiểm soát để gửi phê duyệt', {
      field: 'guiBldPheDuyet',
    });
  await assertSupervisor(supervisor, departmentId, client);
}

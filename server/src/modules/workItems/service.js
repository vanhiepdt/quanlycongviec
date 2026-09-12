// Nghiệp vụ Công việc con (cấp 2) và Nhiệm vụ (cấp 3) — MỘT service cho cả hai cấp (§7 việc 3.2).
// Khác nhau duy nhất là cột `level`, nên tách hai module chỉ nhân đôi 20 cột và nhân đôi chỗ sai.
//
// Nguyên tắc chia việc với CSDL (§7 Phase 3, đoạn "CSDL đã làm sẵn phần khó"):
//   • CSDL giữ các quy tắc KHÔNG được lách: cha phải là cấp 2, cha cùng công việc, cấp 2 không có
//     cha, không tự trỏ, chỉ cấp 3 có nhắc việc, xoá là CASCADE. Đó là CHECK + trigger của
//     001_init.sql và chúng vẫn nổ kể cả khi hai request chạy song song.
//   • Service ở đây làm ba việc: tra mã → id (CSDL chỉ biết id), DỊCH lỗi CSDL sang mã lỗi §5.3,
//     và những thứ CSDL không biết — cha có phải con cháu của chính nó không (CYCLE), tên người
//     thực hiện tra ra ai, ngày nào đáng cảnh báo.
import { withTransaction } from '../../db/pool.js';
import { ACTION_TY_LE, can } from '../../middleware/rbac.js';
import { mergeWarnings, warnDueBeforeStart, warnOutsideWorkRange } from '../../utils/dateChecks.js';
import { AppError, notFound } from '../../utils/errors.js';
import { attachRefs } from '../../utils/historyRefs.js';
import { banDoTenThang, ganTenThang } from '../../utils/monthNames.js';
import { deriveOrigin, diffRows, originOf } from '../../utils/origin.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as logsRepo from '../activityLogs/repo.js';
import * as assignments from '../assignments/service.js';
import {
  boCotKhoaDuyet,
  CHO_DUYET,
  DA_DUYET,
  coSuaDuocKhiChoDuyet,
  NHAP,
  thayDuocNhap,
  trangThaiDuyetKhiTao,
  phaiChoDuyetKhiSua,
  xoaPhaiQuaDuyet,
} from '../approvals/rules.js';
import { demNhomFileTheoItem } from '../taskFiles/repo.js';
import { ganTienDo, ganTienDoWorks } from './tienDo.js';
import * as remindersRepo from '../reminders/repo.js';
import * as usersRepo from '../users/repo.js';
import * as worksRepo from '../works/repo.js';
import * as monthNamesRepo from '../workMonthNames/repo.js';
import { assertThangDatDuoc } from '../workMonthNames/service.js';
import * as repo from './repo.js';
import { laDauMuc } from './tyLe.js';
import { canLaiTyLeWork } from './canTyLe.js';
import { updateChildWeights } from './childWeights.js';
import {
  baoKhiHaVeChoDuyet,
  recordReviewerChanges,
  recordReviewerItemChanges,
  proposeGuiBld,
} from '../approvals/changes.js';
import { proposeTyLe } from '../approvals/tyLe.js';

/** Cấp 2 và cấp 3 là HAI loại thực thể khác nhau trong ma trận quyền §6, không được gộp. */
const entityOf = (level) => (Number(level) === repo.LEVEL_SUBWORK ? 'subwork' : 'task');

function assertCan(user, action, row, level = null) {
  const entity = entityOf(level ?? row?.level ?? repo.LEVEL_TASK);
  if (
    action === 'update' &&
    row?.approval_status === CHO_DUYET &&
    can(user, 'approve', entity, row).ok
  )
    return;
  const verdict = can(user, action, entity, row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

/**
 * Cổng ghi thứ hai, HẸP HƠN §6: mục đang chờ duyệt chỉ người lập (hoặc người duyệt được) mới sửa
 * và xoá được (§7 việc 5.6). Gọi SAU `assertCan` để mã lỗi chung của §6 ra trước.
 */
function assertSuaDuoc(user, row) {
  if (row?.approval_status === CHO_DUYET && can(user, 'approve', entityOf(row.level), row).ok)
    return;
  const verdict = coSuaDuocKhiChoDuyet(user, row);
  if (!verdict.ok) throw new AppError('FORBIDDEN', verdict.message);
}

const err = (code, message) => new AppError(code, message);

/** Dòng kèm thông tin công việc cha; không có thì 404. */
async function mustFindItem(ref, client = null) {
  const row = await repo.findByRefWithWork(ref, client);
  if (!row) throw notFound(`Không tìm thấy công việc con/nhiệm vụ "${ref}"`);
  return row;
}

async function mustFindWork(ref, client = null) {
  const work = await worksRepo.findByRef(ref, client);
  if (!work) throw notFound(`Không tìm thấy công việc "${ref}"`);
  return work;
}

// ============================================================================
// Tỷ lệ công việc (8b lỗi 2) — luật chia là các hàm THUẦN trong tyLe.js, phần điều phối CSDL
// (`canLaiTyLeWork`) nằm ở canTyLe.js: ĐỢT B đưa việc sửa tỷ lệ qua `approval_changes` nên
// `approvals/tyLe.js` cũng phải cân được tỷ lệ, mà để hàm đó ở đây thì thành vòng import.
// ============================================================================

/** So tên người: cắt trắng, bỏ phân biệt hoa/thường — dữ liệu nhập tay có cả hai kiểu. */
const sameName = (a, b) =>
  String(a ?? '')
    .trim()
    .toLowerCase() ===
  String(b ?? '')
    .trim()
    .toLowerCase();

/**
 * Suy ra người thực hiện, port của `resolveTaskAssigneeEmail` bản cũ (Code.gs.moi:1790) sang lược
 * đồ mới — nay không có cột email, người thực hiện là khoá ngoại `assignee_id`, email lấy từ
 * bảng `users` khi cần hiện.
 *
 * Ba nhánh, đúng như bản cũ:
 *   • Gửi `assignee_id` tường minh ⇒ tin dùng, không tra tên (kể cả `null` để bỏ gán).
 *   • Chỉ gửi tên và tên KHÔNG đổi ⇒ giữ nguyên `assignee_id` cũ (TC-TREE-22). Nếu tra lại thì
 *     người đã đổi tên trong bảng `users` sẽ bị gỡ khỏi nhiệm vụ mà không ai biết.
 *   • Tên ĐỔI ⇒ tra lại: đúng một người thì gán, không thấy hoặc TRÙNG TÊN thì để trống và ghi
 *     cảnh báo — KHÔNG giữ id của người cũ, vì chữ đang hiện là tên người khác (TC-TREE-21).
 */
async function resolveAssignee(patch, current, client) {
  if (Object.hasOwn(patch, 'assignee_id')) {
    return { fields: { assignee_id: patch.assignee_id }, warnings: [] };
  }
  if (!Object.hasOwn(patch, 'assignee_name')) return { fields: {}, warnings: [] };

  const name = String(patch.assignee_name ?? '').trim();
  if (name === '') {
    return { fields: { assignee_name: '', assignee_id: null }, warnings: [] };
  }
  if (current && sameName(current.assignee_name, name)) {
    return { fields: { assignee_name: name }, warnings: [] };
  }

  const found = await usersRepo.findIdsByFullName(name, client);
  if (found.length === 1) {
    return { fields: { assignee_name: name, assignee_id: found[0].id }, warnings: [] };
  }
  const code = found.length === 0 ? 'ASSIGNEE_NOT_FOUND' : 'ASSIGNEE_NAME_DUPLICATED';
  const message =
    found.length === 0
      ? `Không tìm thấy người dùng tên "${name}", đã lưu tên nhưng chưa gắn được tài khoản`
      : `Có ${found.length} người cùng tên "${name}", hãy chọn đúng người thay vì gõ tên`;
  return {
    fields: { assignee_name: name, assignee_id: null },
    warnings: [{ code, message, field: 'assigneeName' }],
  };
}

/**
 * Tra mã/id cha thành dòng cha đã kiểm. Trả `null` nghĩa là "không có cha".
 *
 * Chỉ kiểm hai thứ CSDL không nói giúp được: cha có tồn tại không (để trả PARENT_NOT_FOUND thay
 * vì lỗi khoá ngoại chung), và cha có phải chính nó / con cháu của nó không (SELF_PARENT, CYCLE).
 * Cha sai cấp hoặc khác công việc thì để trigger chặn rồi `translatePgError` dịch — hai nguồn sự
 * thật cho cùng một quy tắc là cách chắc chắn nhất để chúng lệch nhau.
 */
async function resolveParent(parentRef, { itemId = null }, client) {
  if (parentRef === null || parentRef === undefined || String(parentRef).trim() === '') {
    return null;
  }
  const parent = await repo.findByRef(parentRef, client);
  if (!parent) {
    throw err('PARENT_NOT_FOUND', `Không tìm thấy công việc con cha "${parentRef}"`);
  }
  if (itemId != null && parent.id === itemId) {
    throw err('SELF_PARENT', 'Không thể chọn chính nó làm cha');
  }
  if (itemId != null && (await repo.isDescendant(itemId, parent.id, client))) {
    throw err('CYCLE', 'Không thể chọn một dòng nằm bên dưới nó làm cha (sẽ tạo vòng lặp)');
  }
  return parent;
}

/** Gắn danh sách nhắc việc vào từng dòng — giao diện cũ đọc khoá `Nhắc việc` của mỗi nhiệm vụ. */
async function attachReminders(rows, client = null) {
  const map = await remindersRepo.mapByItemIds(
    rows.map((r) => r.id),
    client
  );
  return rows.map((row) => ({ ...row, reminders: map.get(row.id) ?? [] }));
}

/** Gắn `month_names` (tên riêng theo tháng) — cùng hình dạng với cấp 1 và với cây của bootstrap. */
async function attachMonthNames(rows, client = null) {
  const rieng = await monthNamesRepo.listForItems(
    rows.map((r) => r.id),
    client
  );
  return ganTenThang(rows, banDoTenThang(rieng), 'item');
}

/**
 * Danh sách dòng của một công việc. `level` để trống ⇒ trả CẢ cấp 2 và cấp 3 trong một mảng,
 * đúng như `getTasks` bản cũ, để cầu RPC §5.1 trả được nguyên hình dạng cũ. Chỗ nào cần ĐẾM thì
 * phải tự lọc `level === 3` — bản cũ đếm chung nên thống kê phồng lên (bẫy §13.5).
 */
export async function list(user, { workRef, level = null }) {
  const work = await mustFindWork(workRef);
  const verdict = can(user, 'read', 'work', work);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
  // Cả công việc cấp 1 là bản NHÁP của người khác ⇒ không có đường nào vào cây con của nó (012).
  // Chặn ở đây chứ không chỉ lọc từng dòng: lọc từng dòng vẫn trả 200 kèm `work` — tức là đã nói
  // «có bản nháp tên này» cho người không được xem.
  if (!thayDuocNhap(user, work)) throw notFound(`Không tìm thấy công việc "${workRef}"`);
  const rows = await repo.listByWork(work.id);
  const visible = rows.filter(
    (row) =>
      can(user, 'read', entityOf(row.level), {
        ...row,
        work_department_id: work.department_id,
        work_manager_id: work.manager_id,
      }).ok &&
      // Bản NHÁP (012) chỉ người lập và admin thấy — cùng cổng với `works/service.list`.
      thayDuocNhap(user, row)
  );
  ganTienDo(
    visible,
    await demNhomFileTheoItem(
      null,
      visible.map((row) => row.id)
    )
  );
  ganTienDoWorks([work], visible);
  return {
    work,
    items: await attachMonthNames(
      await attachReminders(
        visible.filter((row) => level == null || Number(row.level) === Number(level))
      )
    ),
  };
}

export async function getOne(user, ref) {
  const row = await mustFindItem(ref);
  assertCan(user, 'read', row);
  // Bản NHÁP (012) — xem chú thích ở `works/service.getOne`: `can()` không biết gì về nháp.
  if (!thayDuocNhap(user, row)) {
    throw notFound(`Không tìm thấy công việc con/nhiệm vụ "${ref}"`);
  }
  const items =
    Number(row.level) === 3
      ? [row]
      : [
          row,
          ...(await repo.listByWork(row.work_id)).filter(
            (item) =>
              String(item.parent_id) === String(row.id) &&
              thayDuocNhap(user, item) &&
              can(user, 'read', 'task', item).ok
          ),
        ];
  ganTienDo(
    items,
    await demNhomFileTheoItem(
      null,
      items.map((item) => item.id)
    )
  );
  return (await attachReminders([row]))[0];
}

/**
 * Nhật ký TỪ ĐẦU của một công việc con / nhiệm vụ (§2.3).
 *
 * Hỏi cả hai `entity_type` vì cấp 2 ghi 'subwork', cấp 3 ghi 'task' và dữ liệu cũ có thể ghi lệch
 * cấp; `entity_id` vẫn là id của dòng nên không lẫn sang đầu việc khác. Ai đọc được dòng thì đọc
 * được nhật ký của nó — không có quyền riêng cho nhật ký, nhưng cũng không được rộng hơn quyền đọc.
 *
 * `scope='tree'` ở cấp 2 gom thêm nhật ký các nhiệm vụ con của nó; ở cấp 3 thì cây chỉ có một dòng
 * nên `tree` = `self`. Mặc định vẫn `'self'` để không đổi câu trả lời cũ của API.
 */
export async function history(user, ref, { limit = 200, scope = 'self' } = {}) {
  const row = await mustFindItem(ref);
  assertCan(user, 'read', row);
  const caCay = scope === 'tree' && Number(row.level) === repo.LEVEL_SUBWORK;
  // Chỉ id các con ĐANG CÒN: con bị xoá thì id không tra lại được từ `work_items` nữa, nhật ký của
  // nó chỉ còn gom được ở cấp 1 (qua `work_id`) — giới hạn đã ghi trong docs/KE-HOACH-NHAT-KY.md.
  const children = caCay ? await repo.listChildren(row.id) : [];
  const entries = caCay
    ? await logsRepo.listByEntities({
        entityTypes: ['subwork', 'task'],
        entityIds: [row.id, ...children.map((r) => r.id)],
        limit,
      })
    : await logsRepo.listByEntity({
        entityTypes: ['subwork', 'task'],
        entityId: row.id,
        limit,
      });
  return {
    item: row,
    originInfo: originOf(row),
    scope: caCay ? 'tree' : 'self',
    entries: attachRefs(entries, { items: [row, ...children] }),
  };
}

/**
 * Tạo công việc con (cấp 2) hoặc nhiệm vụ (cấp 3).
 *
 * Không truyền `level` ⇒ mặc định 3, đúng như `addTask` bản cũ (TC-TREE-07): giao diện cũ có chỗ
 * gọi thêm nhiệm vụ mà không gửi cấp, đổi mặc định là làm dữ liệu cũ nhập vào sai cấp.
 *
 * Mã dòng do sequence sinh trong CÙNG giao dịch, nên 20 request đồng thời ra 20 mã khác nhau
 * (TC-TREE-31) — `nextval` không bị ảnh hưởng bởi giao dịch nào cả.
 */
/**
 * Chuẩn hoá một danh sách id người gửi lên: về SỐ, bỏ trùng, bỏ rác.
 *
 * Cột là `bigint[]`/`bigint`, và MỘT người có tên hai lần trong `supervisor_ids` là một người duyệt
 * chứ không phải hai — không bỏ trùng thì thông báo gửi đôi và danh sách hiện tên lặp. Dùng chung
 * cho cả lúc tạo lẫn lúc sửa: hai đường mà chuẩn hoá khác nhau là hai đường cho ra hai giá trị khác
 * nhau trong cùng một cột.
 */
const soHoaIds = (v) => [
  ...new Set((Array.isArray(v) ? v : []).map(Number).filter(Number.isFinite)),
];

/**
 * Phân công ba lớp lúc TẠO (005_phan_cong.sql, đổi thành MẢNG ở 028_supervisor_ids.sql):
 *   • Cấp 2: để trống ⇒ thừa hưởng NGUYÊN tập Ban kiểm soát + Lãnh đạo phòng của công việc cha
 *     (form điền sẵn đúng giá trị này, người dùng vẫn sửa được — "không bắt buộc trùng" chỉ là
 *     không bị ép). Có gửi lên thì từng người phải nằm trong tập của cấp 1 (D2).
 *   • Cấp 3: để trống ⇒ lấy phần tử ĐẦU của tập cấp trên (Q12). Có gửi lên thì ĐÚNG MỘT người và
 *     phải nằm trong tập của công việc con chứa nó (D2) — trước đợt A cấp 3 bị CẤM có ô này.
 *     `leader_ids` của nhiệm vụ vẫn tối đa một người, khuôn cũ không đổi.
 *
 * Trả về object cột để trải vào `repo.insert`.
 */
async function resolvePhanCongKhiTao(input, { work, parent, level }, client) {
  const nguon = parent ?? work;
  if (level === repo.LEVEL_TASK) {
    const supervisors =
      input.supervisor_ids === undefined
        ? soHoaIds([nguon?.supervisor_ids?.[0]])
        : soHoaIds(input.supervisor_ids);
    if (supervisors.length > 1) {
      throw new AppError('VALIDATION_ERROR', 'Nhiệm vụ chỉ được chọn MỘT Ban lãnh đạo kiểm soát', {
        field: 'supervisorIds',
      });
    }
    const leaders = Array.isArray(input.leader_ids) ? input.leader_ids : [];
    if (leaders.length > 1) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Nhiệm vụ chỉ được chọn MỘT lãnh đạo phòng phụ trách',
        {
          field: 'leaderIds',
        }
      );
    }
    await assignments.assertSupervisorsByLevel(
      supervisors,
      { level, parentRow: parent, workRow: work, departmentId: work.department_id },
      client
    );
    await assignments.assertTaskLeader(leaders, { parentRow: parent, workRow: work }, client);
    return { supervisor_ids: supervisors, leader_ids: leaders };
  }
  const supervisors =
    input.supervisor_ids === undefined
      ? soHoaIds(work.supervisor_ids)
      : soHoaIds(input.supervisor_ids);
  const leaders = input.leader_ids === undefined ? (work.leader_ids ?? []) : input.leader_ids;
  await assignments.assertSupervisorsByLevel(
    supervisors,
    { level, parentRow: parent, workRow: work, departmentId: work.department_id },
    client
  );
  await assignments.assertLeaders(leaders, work.department_id, client);
  return { supervisor_ids: supervisors, leader_ids: leaders };
}

export function create(user, input) {
  const level =
    input.level === undefined || input.level === null ? repo.LEVEL_TASK : Number(input.level);
  if (level !== repo.LEVEL_SUBWORK && level !== repo.LEVEL_TASK) {
    throw err('VALIDATION_ERROR', 'Cấp chỉ nhận 2 (công việc con) hoặc 3 (nhiệm vụ)');
  }
  return withTransaction(async (client) => {
    const work = await mustFindWork(input.workRef, client);
    const assignee = await resolveAssignee(input, null, client);
    assertCan(
      user,
      'create',
      {
        level,
        assignee_id: assignee.fields.assignee_id ?? input.assignee_id ?? null,
        work_department_id: work.department_id,
        work_manager_id: work.manager_id,
        assigned_in_work: await repo.isAssignedInWork(work.id, user?.id ?? null, client),
      },
      level
    );

    const parent = await resolveParent(input.parentRef, { itemId: null }, client);
    // MỚI-5: `taoMoi: true` mở hai ô «Ban lãnh đạo kiểm soát» + «Người thực hiện trực tiếp» cho vai
    // Nhân viên khi LẬP MỚI nhiệm vụ cấp 3 — xem chú thích trong `assertAssignmentActor`.
    assignments.assertAssignmentActor(user, { ...input, ...assignee.fields }, null, {
      taoMoi: true,
      level,
    });
    // MỚI-5: hàng rào đi kèm — cán bộ lập mới nhiệm vụ cấp 3 chỉ được giao cho người CÙNG PHÒNG.
    await assignments.assertAssigneeCungPhong(
      user,
      assignee.fields.assignee_id ?? input.assignee_id ?? null,
      client
    );
    await assignments.assertTaskAssignee(
      { ...input, ...assignee.fields, level },
      { actor: user, departmentId: work.department_id },
      client
    );
    const phanCong = await resolvePhanCongKhiTao(input, { work, parent, level }, client);
    await assignments.assertGuiBld(
      { ...input, ...assignee.fields, ...phanCong, level, parent_id: parent?.id ?? null },
      { parentRow: parent, departmentId: work.department_id },
      client
    );
    const code = await repo.nextItemCode(work.code, client);
    const sortOrder = input.sort_order ?? (await repo.maxSortOrder(work.id, client)) + 1;

    // Người nhận việc của cấp 2/cấp 3 là người thực hiện: nhân viên tự đăng ký nhiệm vụ cho mình
    // ⇒ "Tự đăng ký"; lãnh đạo phòng / admin / Phó Giám đốc lập rồi gán cho người khác ⇒ "Được
    // giao" và giữ luôn ai giao ĐẦU TIÊN (§2.3). Lấy tên/id sau khi `resolveAssignee` chốt, vì
    // frontend cũ nhiều chỗ chỉ gửi tên.
    const origin = deriveOrigin({
      actor: user,
      recipientId: assignee.fields.assignee_id ?? input.assignee_id ?? null,
      recipientName: assignee.fields.assignee_name ?? input.assignee_name ?? null,
    });

    const row = await withPgErrors(() =>
      repo.insert(
        {
          // Khoá duyệt do MÁY CHỦ quyết theo vai người tạo và theo CẤP (§7 việc 5.1): cấp 2 do
          // Trưởng/Phó phòng lập ⇒ `Chờ duyệt`; cấp 3 luôn `Đã duyệt`. Gỡ giá trị người dùng gửi
          // lên trước, nếu không thì thêm `approvalStatus` vào thân request là tự duyệt xong.
          ...boCotKhoaDuyet(input),
          ...assignee.fields,
          ...phanCong,
          department_id: work.department_id,
          code,
          work_id: work.id,
          parent_id: parent?.id ?? null,
          level,
          // «Lưu nháp» (012): người lập tự bấm, HOẶC dòng mới sinh ra bên trong một cây đang là
          // bản nháp. Trạng thái của cha do MÁY CHỦ đọc, không nhận từ thân request — nếu không
          // thì thêm một nhiệm vụ vào bản nháp là nhiệm vụ đó lọt ngay vào thống kê trong khi cả
          // công việc chưa ai gửi duyệt (đúng kiểu sót mà view 004 sinh ra để chặn).
          approval_status: trangThaiDuyetKhiTao(user, level, {
            luuNhap:
              input.luuNhap === true ||
              work.approval_status === NHAP ||
              parent?.approval_status === NHAP,
          }),
          sort_order: sortOrder,
          ...origin,
        },
        client
      )
    );

    // Tỷ lệ công việc (8b lỗi 2): dòng mới THUỘC DIỆN thì tham gia cân tỷ lệ — đọc sau insert nên
    // danh sách đã có mặt dòng này, mọi câu ghi vẫn trong giao dịch đang mở. Không thuộc diện
    // Nhiệm vụ cấp 3 nằm trong việc con được chia tỷ lệ nội bộ ở bước tiếp theo.
    let rowCuoi = row;
    if (laDauMuc(row)) {
      const daThayDoi = await canLaiTyLeWork(work.id, client, { themId: row.id });
      rowCuoi = { ...row, ty_le: daThayDoi.get(String(row.id)) ?? row.ty_le };
      // Tỷ lệ gửi tường minh: người tạo có quyền sửa tỷ lệ thì áp SAU lượt chia đều («khi tạo có
      // thể chỉnh sửa»). Không quyền thì LẶNG LẼ BỎ QUA — tạo mới không được thất bại vì một ô
      // gia vị của form; rào 403 dành cho đường SỬA nơi ô tỷ lệ là nội dung chính của request.
      if (
        input.ty_le !== undefined &&
        input.ty_le !== null &&
        can(user, ACTION_TY_LE, entityOf(level), row).ok
      ) {
        const lanHai = await canLaiTyLeWork(work.id, client, {
          suaId: row.id,
          suaGiaTri: input.ty_le,
        });
        rowCuoi = { ...rowCuoi, ty_le: lanHai.get(String(row.id)) ?? rowCuoi.ty_le };
      }
    }

    if (Number(row.level) === 3 && row.parent_id != null) {
      const manual = input.ty_le != null && can(user, ACTION_TY_LE, 'task', row).ok;
      const weights = await updateChildWeights(row.parent_id, client, {
        addedId: row.id,
        editedId: manual ? row.id : null,
        value: input.ty_le,
      });
      rowCuoi = { ...rowCuoi, ty_le: weights.get(String(row.id)) ?? row.ty_le };
    }
    return {
      item: { ...rowCuoi, reminders: [] },
      warnings: mergeWarnings(
        assignee.warnings,
        warnDueBeforeStart(row.start_date, row.due_date),
        warnOutsideWorkRange(row, work)
      ),
    };
  });
}

/**
 * Sửa một dòng. Gộp cả "sửa tại chỗ" và "chuyển sang công việc khác" vào một đường vì bản cũ
 * cũng chỉ có `updateTask` — tách ra là frontend phải đoán gọi hàm nào.
 *
 * Sáu nhánh chặn của `updateTask` bản cũ (§7 việc 3.3) nay chia hai chỗ:
 *   1. không đổi cấp                 — ở đây (LEVEL_IMMUTABLE)
 *   2. không tự trỏ vào mình         — ở đây (SELF_PARENT), CHECK `no_self_parent` là lưới cuối
 *   3. không trỏ vào con cháu        — ở đây (CYCLE), CSDL không biết quan hệ này
 *   4. cha phải tồn tại              — ở đây (PARENT_NOT_FOUND)
 *   5. cha phải là cấp 2             — trigger, dịch thành PARENT_NOT_SUBWORK
 *   6. cấp 2 không được có cha       — CHECK `lvl2_no_parent`, dịch thành LVL2_NO_PARENT
 *
 * KHÔNG truyền `parentRef` ⇒ giữ nguyên cha cũ (TC-TREE-12). Truyền `null`/`''` ⇒ bỏ cha.
 * Mã dòng KHÔNG BAO GIỜ đổi, kể cả khi chuyển sang công việc khác (§13.4 mục 6).
 */
/**
 * Kiểm phân công lúc SỬA (005_phan_cong.sql, MẢNG từ 028_supervisor_ids.sql). Không gửi gì liên
 * quan và không đổi cha ⇒ bỏ qua, dữ liệu cũ giữ nguyên. Nhiệm vụ có Ban lãnh đạo kiểm soát /
 * leader (vừa gửi hoặc đang có sẵn) mà cha hoặc công việc đổi nguồn ⇒ kiểm lại tập CUỐI CÙNG với
 * nguồn mới — đổi cha là đổi luôn tập được phép chọn, không kiểm lại thì nhiệm vụ giữ một người
 * không còn ai ở cấp trên công nhận.
 */
async function kiemPhanCongKhiSua({ current, work, parentRow, doiParent, patch }, client) {
  const coGuiSupervisor = Object.hasOwn(patch, 'supervisor_ids');
  const coGuiLeaders = Object.hasOwn(patch, 'leader_ids');
  if (!coGuiSupervisor && !coGuiLeaders && !doiParent) return;

  if (Number(current.level) === repo.LEVEL_TASK) {
    const chaHienTai = doiParent
      ? (parentRow ?? null)
      : current.parent_id != null
        ? await repo.findById(current.parent_id, client)
        : null;
    const supervisors = coGuiSupervisor
      ? soHoaIds(patch.supervisor_ids)
      : soHoaIds(current.supervisor_ids);
    if (supervisors.length > 1) {
      throw new AppError('VALIDATION_ERROR', 'Nhiệm vụ chỉ được chọn MỘT Ban lãnh đạo kiểm soát', {
        field: 'supervisorIds',
      });
    }
    await assignments.assertSupervisorsByLevel(
      supervisors,
      {
        level: current.level,
        parentRow: chaHienTai,
        workRow: work,
        departmentId: work.department_id,
      },
      client
    );
    if (!coGuiLeaders && !doiParent) return;
    const leaders = coGuiLeaders ? (patch.leader_ids ?? []) : (current.leader_ids ?? []);
    if (leaders.length > 1) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Nhiệm vụ chỉ được chọn MỘT lãnh đạo phòng phụ trách',
        { field: 'leaderIds' }
      );
    }
    await assignments.assertTaskLeader(leaders, { parentRow: chaHienTai, workRow: work }, client);
    return;
  }
  // Cấp 2: chỉ trường được GỬI mới kiểm (không gửi ⇒ giữ nguyên giá trị cũ).
  if (coGuiSupervisor || coGuiLeaders || doiParent) {
    const phong = work.department_id;
    if (coGuiSupervisor || doiParent) {
      await assignments.assertSupervisorsByLevel(
        coGuiSupervisor ? soHoaIds(patch.supervisor_ids) : soHoaIds(current.supervisor_ids),
        { level: current.level, parentRow: null, workRow: work, departmentId: phong },
        client
      );
    }
    if (coGuiLeaders || doiParent) {
      await assignments.assertLeaders(
        coGuiLeaders ? patch.leader_ids : current.leader_ids,
        phong,
        client
      );
    }
  }
}

export function update(
  user,
  ref,
  patch = {},
  { targetWorkRef = undefined, client: transactionClient } = {}
) {
  const transact = transactionClient ? (fn) => fn(transactionClient) : withTransaction;
  return transact(async (client) => {
    let current = await mustFindItem(ref, client);
    await client.query('SELECT id FROM works WHERE id = $1 FOR UPDATE', [current.work_id]);
    current = await mustFindItem(ref, client);
    await repo.lockById(current.id, client);
    assertCan(user, 'update', current);
    assertSuaDuoc(user, current);

    if (patch.level != null && Number(patch.level) !== current.level) {
      throw err(
        'LEVEL_IMMUTABLE',
        'Không thể đổi cấp của dòng đã tạo, hãy xoá rồi tạo lại ở cấp mong muốn'
      );
    }

    const structural = {};
    let work = {
      id: current.work_id,
      code: current.work_code,
      department_id: current.work_department_id,
      manager_id: current.work_manager_id,
      // Đợt A (D2): tập Ban lãnh đạo kiểm soát của CẤP 1 phải có mặt ở đây — `nguonBanKiemSoat`
      // lấy nó làm tập nguồn khi kiểm một công việc con. Thiếu thì cấp 2 lọt mọi người, đúng cái
      // lỗ mà ràng buộc ⊆ cấp trên sinh ra để bịt.
      supervisor_ids: current.work_supervisor_ids ?? [],
      start_date: current.work_start_date,
      end_date: current.work_end_date,
    };
    let moved = false;

    // Chuyển sang công việc khác (§7 việc 3.4). Công việc đích phải tồn tại — kiểm TRƯỚC khi ghi
    // gì cả, đúng như bản cũ tìm dòng đích trước khi gỡ khỏi nguồn, để dòng cũ không bị mất
    // (TC-TREE-19).
    if (targetWorkRef !== undefined && String(targetWorkRef ?? '').trim() !== '') {
      const target = await worksRepo.findByRef(targetWorkRef, client);
      if (!target) {
        throw err('TARGET_WORK_NOT_FOUND', `Không tìm thấy công việc đích "${targetWorkRef}"`);
      }
      if (target.id !== current.work_id) {
        assertCan(user, 'update', {
          ...current,
          department_id: target.department_id,
          work_department_id: target.department_id,
          work_manager_id: target.manager_id,
        });
        assertCan(user, 'create', {
          ...current,
          department_id: target.department_id,
          work_manager_id: target.manager_id,
          assigned_in_work: await repo.isAssignedInWork(target.id, user?.id ?? null, client),
        });
        moved = true;
        work = target;
        structural.work_id = target.id;
        // Nhiệm vụ cấp 3 sang công việc khác thì cha cũ không còn ý nghĩa (cha thuộc công việc
        // cũ, mà trigger đòi cha cùng công việc) ⇒ bỏ cha. Cấp 2 vốn không có cha (TC-TREE-18).
        structural.parent_id = null;
      }
    }

    const laNguoiDuyetSua =
      current.approval_status === CHO_DUYET &&
      can(user, 'approve', entityOf(current.level), current).ok;
    let truocCacMucTrongCay = null;
    if (laNguoiDuyetSua) {
      truocCacMucTrongCay = new Map();
      for (const workId of new Set([current.work_id, work.id])) {
        for (const item of await repo.listByWork(workId, {}, client))
          truocCacMucTrongCay.set(String(item.id), item);
      }
    }

    let parentMoi; // undefined = không đổi cha; null = bỏ cha
    if (Object.hasOwn(patch, 'parentRef')) {
      const parent = await resolveParent(patch.parentRef, { itemId: current.id }, client);
      structural.parent_id = parent?.id ?? null;
      parentMoi = parent ?? null;
    }

    // Tỷ lệ công việc (8b lỗi 2). Nếu có gửi thì kiểm quyền TRƯỚC mọi câu ghi — 403 phải nổ khi
    // chưa có gì thay đổi. Giá trị này KHÔNG vào patch SQL (không thuộc WRITABLE): các lời gọi
    // canLaiTyLeWork cuối hàm sẽ ghi nó, trong cùng giao dịch, sau mọi thay đổi cấu trúc.
    const coGuiTyLe = Object.hasOwn(patch, 'ty_le') && patch.ty_le !== undefined;
    if (coGuiTyLe) assertCan(user, ACTION_TY_LE, current);

    // Sau các thay đổi cấu trúc thì dòng còn THUỘC DIỆN mang tỷ lệ không? Cấp không đổi
    // (LEVEL_IMMUTABLE), chỉ work_id / parent_id có thể đổi.
    const truocLaDauMuc = laDauMuc(current);
    const parentIdSau = Object.hasOwn(structural, 'parent_id')
      ? structural.parent_id
      : current.parent_id;
    const sauLaDauMuc = laDauMuc({ level: current.level, parent_id: parentIdSau });
    // Chuyển đầu mục vào công việc con: bỏ tỷ lệ cấp1 trước khi chia lại tỷ lệ nội bộ.
    if (truocLaDauMuc && !sauLaDauMuc) {
      await repo.updateTyLe(current.id, 0, client);
    }

    const assignee = await resolveAssignee(patch, current, client);
    assignments.assertAssignmentActor(user, { ...patch, ...assignee.fields }, current);
    // `work.department_id` là phòng CUỐI CÙNG: khi chuyển cha sang công việc khác thì `work` đã
    // được gán lại thành công việc đích, nên kiểm Trưởng/Phó phòng nhận việc theo phòng MỚI.
    await assignments.assertTaskAssignee(
      { ...current, ...patch, ...assignee.fields },
      { actor: user, departmentId: work.department_id },
      client
    );
    if (
      user.role === 'Nhân viên' &&
      (moved || (parentMoi !== undefined && (parentMoi?.id ?? null) !== current.parent_id))
    ) {
      throw new AppError(
        'FORBIDDEN',
        'Cán bộ không được tự chuyển cha để thay đổi người phụ trách'
      );
    }
    // Phân công ba lớp: kiểm nguồn khi leader/cha/công việc liên quan thay đổi (005_phan_cong.sql).
    await kiemPhanCongKhiSua(
      { current, work, parentRow: parentMoi, doiParent: parentMoi !== undefined || moved, patch },
      client
    );
    if (moved && Number(current.level) === repo.LEVEL_SUBWORK) {
      const children = await repo.listChildren(current.id, client);
      await assignments.assertTreeAssignments(
        [{ ...current, ...patch }, ...children],
        work.department_id,
        client,
        // Đợt A (D2): `work` là tập nguồn của cấp 2 — không truyền thì công việc con vừa chuyển
        // sang công việc khác được tự do chọn người ngoài danh sách của công việc mới.
        work
      );
    }
    // Trưởng/Phó phòng sửa CÔNG VIỆC CON đã duyệt ⇒ quay lại «Chờ duyệt» chờ Phó GĐ phụ trách
    // duyệt lại (yêu cầu 2026-08-28). admin/Phó GĐ sửa giữ nguyên trạng thái; mục đang «Chờ
    // duyệt» thì assertSuaDuoc phía trên đã bó đúng người được sửa, trạng thái giữ nguyên.
    // Ghi đè «Chờ duyệt» cho Sửa (011): MỌI vai bị admin ghi đè update = 'cho-duyet' đều rơi vào
    // luồng này, cho cả cấp 2 lẫn cấp 3 (mở rộng từ TP/PP × cấp 2 ban đầu).
    const entityType = Number(current.level) === repo.LEVEL_SUBWORK ? 'subwork' : 'task';
    const coGhiDeSua = user.ghiDe?.[entityType + ':update'] != null;
    const phaiDuyetLai =
      (Number(current.level) === repo.LEVEL_SUBWORK &&
        !coGhiDeSua &&
        (user.role === 'Trưởng phòng' || user.role === 'Phó phòng') &&
        current.approval_status === DA_DUYET) ||
      phaiChoDuyetKhiSua(user, entityType, current.approval_status);

    // R4'' (ĐỢT B, 11/09/2026) — SỬA TỶ LỆ TRÊN CÂY ĐÃ DUYỆT THÌ PHẢI GỬI DUYỆT (Q10).
    //
    // Hai nhánh, và ranh giới là «lượt sửa này có hạ cây về `Chờ duyệt` không»:
    //   • CÓ hạ (Q9 — `phaiDuyetLai`): tỷ lệ đi theo PHIẾU DUYỆT CÂY như mọi cột khác. Người duyệt
    //     sắp ký lại cả dòng, bắt họ ký thêm một đề nghị riêng cho đúng ô tỷ lệ là bắt ký hai lần
    //     cho một việc.
    //   • KHÔNG hạ: ghi thẳng là lỗ hổng số 11 (tỷ lệ đổi mà không ai ký, tiến độ tự nhảy). Nên ô
    //     tỷ lệ bị GỠ khỏi lượt ghi và chuyển thành một dòng `approval_changes` kind `ty-le`; giá
    //     trị CŨ giữ nguyên tới khi được duyệt, và cây KHÔNG bị hạ nên `v_countable_items` không
    //     mất số — đúng ba câu R4'' đã chốt.
    // Cây chưa `Đã duyệt` (còn nháp/chờ) thì ghi thẳng: đó là lúc đang KHAI BÁO để gửi lên cùng
    // phiếu duyệt cây (Q1), và Q3 cho phép nháp thì sửa thoải mái mọi thứ, kể cả tỷ lệ.
    const tyLeThanhDeNghi =
      coGuiTyLe &&
      current.approval_status === DA_DUYET &&
      !phaiDuyetLai &&
      Number(patch.ty_le) !== Number(current.ty_le);

    let guiBldChange;
    const finalAssignment = {
      ...current,
      ...patch,
      ...assignee.fields,
      ...structural,
      department_id: work.department_id,
    };
    if (Object.hasOwn(patch, 'gui_bld_phe_duyet')) {
      guiBldChange = await proposeGuiBld(
        user,
        current,
        finalAssignment,
        patch.gui_bld_phe_duyet,
        client
      );
      patch = { ...patch, gui_bld_phe_duyet: guiBldChange.value };
    }
    await assignments.assertGuiBld(
      {
        ...finalAssignment,
        gui_bld_phe_duyet: patch.gui_bld_phe_duyet ?? current.gui_bld_phe_duyet,
      },
      {},
      client
    );
    // Đổi tập Ban lãnh đạo kiểm soát của một CÔNG VIỆC CON ⇒ kiểm lại MỌI nhiệm vụ bên dưới, vì tập
    // nguồn của chúng vừa đổi. Hai thứ phải kiểm, cả hai đọc `finalAssignment` (giá trị SẮP LƯU) chứ
    // không phải `current`: (1) tích Gửi BLĐ còn người nhận không, (2) người kiểm soát của nhiệm vụ
    // còn nằm trong danh sách của cấp trên không (D2). Bỏ (2) là đổi danh sách cấp 2 xong, nhiệm vụ
    // bên dưới vẫn trỏ một người không ai ở cấp trên công nhận — và file của nó chạy tới người đó.
    if (Number(current.level) === repo.LEVEL_SUBWORK && Object.hasOwn(patch, 'supervisor_ids')) {
      for (const child of await repo.listChildren(current.id, client)) {
        await assignments.assertGuiBld(
          child,
          { parentRow: finalAssignment, departmentId: work.department_id },
          client
        );
        await assignments.assertSupervisorsByLevel(
          child.supervisor_ids,
          {
            level: child.level,
            parentRow: finalAssignment,
            workRow: work,
            departmentId: work.department_id,
          },
          client
        );
      }
    }
    const row = await withPgErrors(() =>
      repo.updateStructure(
        current.id,
        // Sửa dòng KHÔNG đổi được khoá duyệt QUA PATCH — đường duy nhất là ba hành động
        // submit/approve/reject của `approvals/service.js`. Riêng việc hạ về «Chờ duyệt» sau khi
        // TP/PP sửa CV con là luồng duyệt chính thống, viết tại đây một lần duy nhất.
        {
          ...boCotKhoaDuyet(patch),
          ...assignee.fields,
          ...structural,
          department_id: work.department_id,
          ...(phaiDuyetLai
            ? {
                approval_status: CHO_DUYET,
                approver_id: null,
                approved_at: null,
                reject_reason: '',
              }
            : {}),
        },
        client
      )
    );

    // Cân tỷ lệ TRONG CÙNG GIAO DỊCH với thay đổi cấu trúc — đọc sau updateStructure để
    // listTyLe thấy đúng bức tranh mới. Bốn ca theo diện trước/sau và công việc chứa dòng:
    //   diện → mất diện      : cân công việc cũ như vừa xoá dòng này (giá trị đã về 0 ở trên);
    //   diện → diện, khác việc: công việc cũ mất một phần, công việc mới thêm một phần;
    //   không diện → diện     : cân công việc mới như vừa thêm dòng này;
    //   diện → diện, cùng việc: không cân cấu trúc (tỷ lệ giữ nguyên).
    const workIdSau = Object.hasOwn(structural, 'work_id') ? structural.work_id : current.work_id;
    const daThayDoi = new Map();
    const gop = (m) => {
      for (const [k, v] of m) daThayDoi.set(k, v);
    };
    if (truocLaDauMuc && !sauLaDauMuc) {
      gop(await canLaiTyLeWork(current.work_id, client, { xoaId: current.id }));
    } else if (truocLaDauMuc && sauLaDauMuc && workIdSau !== current.work_id) {
      await canLaiTyLeWork(current.work_id, client, { xoaId: current.id });
      gop(await canLaiTyLeWork(workIdSau, client, { themId: current.id }));
    } else if (!truocLaDauMuc && sauLaDauMuc) {
      gop(await canLaiTyLeWork(workIdSau, client, { themId: current.id }));
    }
    // Sửa tay ô tỷ lệ — sau lượt cân cấu trúc để giá trị đặt trên bức tranh cuối cùng.
    // `tyLeThanhDeNghi` (R4'') thì BỎ QUA: ô này đang chờ một người ký, không được ghi trước.
    if (coGuiTyLe && sauLaDauMuc && !tyLeThanhDeNghi) {
      gop(await canLaiTyLeWork(workIdSau, client, { suaId: current.id, suaGiaTri: patch.ty_le }));
    }
    if (current.parent_id != null && current.parent_id !== row.parent_id) {
      await updateChildWeights(current.parent_id, client);
    }
    if (Number(row.level) === 3 && row.parent_id != null) {
      gop(
        await updateChildWeights(row.parent_id, client, {
          addedId: current.parent_id !== row.parent_id ? row.id : null,
          editedId:
            coGuiTyLe && !tyLeThanhDeNghi && Number(patch.ty_le) !== Number(current.ty_le)
              ? row.id
              : null,
          value: patch.ty_le,
        })
      );
    }
    const rowCuoi = { ...row, ty_le: daThayDoi.get(String(row.id)) ?? row.ty_le };
    // Đọc lại dòng VỪA LƯU để đưa cho `proposeTyLe`: nó cần `code`, `name`, `supervisor_ids`,
    // `work_id`, `level`, `parent_id` — RETURNING của `updateStructure` không đủ bộ đó.
    const tyLeChange = tyLeThanhDeNghi
      ? await proposeTyLe(
          user,
          { loai: 'item', row: await repo.findById(row.id, client) },
          patch.ty_le,
          client
        )
      : undefined;
    if (phaiDuyetLai) {
      await client.query('UPDATE work_items SET submitted_by = $2 WHERE id = $1', [
        row.id,
        user.id,
      ]);
      // R7 (đợt A): hạ về «Chờ duyệt» thì PHẢI có người biết — xem chú thích của
      // `baoKhiHaVeChoDuyet`. Nhãn lấy theo cấp của chính dòng, `supervisor_ids` lấy của dòng VỪA
      // LƯU vì lượt sửa này có thể đổi luôn danh sách kiểm soát.
      await baoKhiHaVeChoDuyet(
        row,
        user,
        'work_item',
        Number(row.level) === repo.LEVEL_SUBWORK ? 'Công việc con' : 'Nhiệm vụ',
        client
      );
    }
    if (truocCacMucTrongCay) {
      const sauCacMucTrongCay = [];
      for (const workId of new Set([current.work_id, work.id]))
        sauCacMucTrongCay.push(...(await repo.listByWork(workId, {}, client)));
      // Bao gồm cả dòng đang sửa và các dòng bị cân lại gián tiếp.
      await recordReviewerItemChanges(user, truocCacMucTrongCay, sauCacMucTrongCay, client);
    } else {
      await recordReviewerChanges(user, 'item', current, rowCuoi, client);
    }

    return {
      item: { ...rowCuoi, reminders: await remindersRepo.listByItem(row.id, client) },
      moved,
      choDuyetLai: phaiDuyetLai,
      guiBldChange,
      // R4'' — `{ pending:true, id, value }` khi ô tỷ lệ vừa thành MỘT ĐỀ NGHỊ (giá trị trong
      // `item.ty_le` trả về vẫn là giá trị CŨ); `undefined` khi lượt sửa không đụng tỷ lệ.
      tyLeChange,
      parentCleared: moved && current.parent_id != null && row.parent_id == null,
      // Nhật ký "các lần chỉnh sửa" (§2.3): kể cả hai cột cấu trúc, vì "chuyển sang công việc
      // khác" là thay đổi người dùng cần thấy nhất trong nhật ký; `ty_le` (8b lỗi 2) cũng là
      // chỉnh sửa người dùng thấy được.
      changes: diffRows(current, rowCuoi, [...repo.WRITABLE, 'work_id', 'parent_id', 'ty_le']),
      warnings: mergeWarnings(
        assignee.warnings,
        warnDueBeforeStart(row.start_date, row.due_date),
        warnOutsideWorkRange(row, work)
      ),
    };
  });
}

/**
 * Xoá một dòng và cả cây bên dưới nó.
 *
 * `ON DELETE CASCADE` của CSDL lo phần xoá (kể cả nhắc việc của các con — TC-TREE-15); việc của
 * service là **đếm và kể tên trước khi xoá** để giao diện hỏi lại được "xoá công việc con này sẽ
 * xoá luôn 4 nhiệm vụ: …" (§7 việc 3.5). Bản cũ `deleteTask` tự gom con cháu rồi lọc mảng JSON,
 * sót một nhánh là còn nhiệm vụ trỏ vào cha đã mất.
 *
 * Đọc danh sách con cháu TRƯỚC khi xoá, trong cùng giao dịch: đọc sau thì không còn gì mà đọc.
 */
export function remove(user, ref) {
  return withTransaction(async (client) => {
    const current = await mustFindItem(ref, client);
    assertCan(user, 'delete', current);
    assertSuaDuoc(user, current);
    // Ghi đè «Chờ duyệt» cho Xoá (011 + 013): phải đi qua YÊU CẦU XOÁ — xem `works/service.remove`.
    const xoaOk = xoaPhaiQuaDuyet(
      user,
      Number(current.level) === repo.LEVEL_SUBWORK ? 'subwork' : 'task'
    );
    if (!xoaOk.ok) throw new AppError('FORBIDDEN', xoaOk.message, { canXinXoa: true });
    const children = await repo.listDescendants(current.id, client);
    await repo.remove(current.id, client);
    if (current.parent_id != null) await updateChildWeights(current.parent_id, client);
    // Tỷ lệ công việc (8b lỗi 2): dòng vừa xoá THUỘC DIỆN thì cân phần còn lại về đúng 100, cùng
    // giao dịch. Con cháu xoá theo CASCADE đều là cấp 3 nằm trong việc con — không thuộc diện —
    // nên chỉ cần một lượt cân của chính công việc này.
    if (laDauMuc(current)) {
      await canLaiTyLeWork(current.work_id, client, { xoaId: current.id });
    }
    return {
      deletedItem: current.code,
      deletedChildren: children.map((r) => r.code),
      deletedCount: 1 + children.length,
      // Ba khoá này chỉ để route ghi nhật ký cho ĐÚNG đầu việc: sau `remove` thì không tra lại được
      // cấp và công việc cha của dòng vừa xoá, mà thiếu chúng thì dòng "đã xoá" không bao giờ hiện
      // trong nhật ký của công việc cha.
      deletedId: current.id,
      deletedLevel: current.level,
      deletedWorkId: current.work_id,
      deletedName: current.name,
    };
  });
}

/**
 * Nhân bản một dòng. Cấp 2 kéo theo **toàn bộ** cây con của nó (TC-TREE-26), cấp 3 chỉ một dòng.
 *
 * Điểm dễ sai nhất — và là lỗi có thật của `copyProject` bản cũ: `parent_id` của các con phải trỏ
 * vào **BẢN SAO** của cha, không phải cha gốc. Sai chỗ này thì bản sao trông như đã tạo xong, mà
 * mọi nhiệm vụ con vẫn nằm dưới cây gốc; sửa "bản sao" là sửa dữ liệu bản gốc (§13.5).
 *
 * Bản sao ở LẠI trong công việc cũ: nhân bản là "làm thêm một việc giống việc này", còn đổi công
 * việc là đường khác (`update` với `targetWorkRef`). Mã thì luôn mới — mã không bao giờ dùng lại.
 */
export function copy(user, ref, { name = null } = {}) {
  return withTransaction(async (client) => {
    const source = await mustFindItem(ref, client);
    assertCan(user, 'read', source);
    assertCan(
      user,
      'create',
      {
        level: source.level,
        assignee_id: source.assignee_id,
        work_department_id: source.work_department_id,
        work_manager_id: source.work_manager_id,
        assigned_in_work: await repo.isAssignedInWork(source.work_id, user?.id ?? null, client),
      },
      source.level
    );

    const work = await mustFindWork(source.work_id, client);
    assignments.assertAssignmentActor(user, { assignee_id: source.assignee_id }, source);
    await assignments.assertTaskAssignee(source, { actor: user }, client);
    await kiemPhanCongKhiSua({ current: source, work, patch: source }, client);

    // Bản sao là đầu việc MỚI: người lập là người bấm Nhân bản, người nhận giữ theo bản gốc
    // (`copyRow` sao `assignee_id`), nên nguồn gốc suy từ hai thứ đó (§2.3).
    const originFor = (row) =>
      deriveOrigin({
        actor: user,
        recipientId: row.assignee_id ?? null,
        recipientName: row.assignee_name ?? null,
      });

    const code = await repo.nextItemCode(source.work_code, client);
    const sortOrder = (await repo.maxSortOrder(source.work_id, client)) + 1;
    const item = await withPgErrors(() =>
      repo.copyRow(
        source.id,
        {
          code,
          workId: source.work_id,
          // Cấp 2 không có cha; cấp 3 thì bản sao nằm cùng công việc con với bản gốc.
          parentId: source.parent_id,
          name,
          sortOrder,
          // Bản sao đi qua đúng cửa duyệt của người bấm Nhân bản, không thừa hưởng khoá duyệt của
          // bản gốc (§7 việc 5.1). Cấp 3 vẫn luôn `Đã duyệt` — `trangThaiDuyetKhiTao` lo phần đó.
          approvalStatus: trangThaiDuyetKhiTao(user, source.level),
          ...originFor(source),
        },
        client
      )
    );

    // Cây con: `listDescendants` xếp theo `depth` nên cha luôn được sao TRƯỚC con, và bảng tra
    // `id gốc → id bản sao` luôn có sẵn cha khi tới lượt con.
    const idMap = new Map([[source.id, item.id]]);
    const copiedCodes = [];
    for (const child of await repo.listDescendants(source.id, client)) {
      const childRow = await repo.findById(child.id, client);
      assertCan(user, 'read', childRow);
      assertCan(user, 'create', childRow);
      assignments.assertAssignmentActor(user, { assignee_id: childRow.assignee_id }, childRow);
      await assignments.assertTaskAssignee(childRow, { actor: user }, client);
      await kiemPhanCongKhiSua({ current: childRow, work, patch: childRow }, client);
      const childCode = await repo.nextItemCode(source.work_code, client);
      const copied = await repo.copyRow(
        child.id,
        {
          code: childCode,
          workId: source.work_id,
          parentId: child.parent_id == null ? null : (idMap.get(child.parent_id) ?? null),
          sortOrder: child.sort_order,
          approvalStatus: trangThaiDuyetKhiTao(user, childRow.level),
          ...originFor(childRow),
        },
        client
      );
      idMap.set(child.id, copied.id);
      copiedCodes.push(copied.code);
    }

    // Tỷ lệ công việc (8b lỗi 2): bản sao KHÔNG thừa hưởng tỷ lệ (copyRow để ty_le mặc định 0);
    // nếu bản sao thuộc diện thì nó tham gia cân như một mục mới tạo. Chỉ bản sao dòng GỐC có thể
    // thuộc diện — các con cháu bản sao đều nằm trong việc con.
    let itemCuoi = item;
    if (laDauMuc(item)) {
      const daThayDoi = await canLaiTyLeWork(source.work_id, client, { themId: item.id });
      itemCuoi = { ...item, ty_le: daThayDoi.get(String(item.id)) ?? item.ty_le };
    }

    if (item.parent_id != null) {
      const weights = await updateChildWeights(item.parent_id, client, { addedId: item.id });
      itemCuoi = { ...itemCuoi, ty_le: weights.get(String(item.id)) ?? item.ty_le };
    } else if (Number(item.level) === repo.LEVEL_SUBWORK) {
      await updateChildWeights(item.id, client);
    }
    return {
      item: { ...itemCuoi, reminders: [] },
      copiedChildren: copiedCodes,
      copiedCount: 1 + copiedCodes.length,
    };
  });
}

/**
 * Đổi thứ tự các dòng trong một công việc, tất cả trong MỘT giao dịch (§7 việc 3.7): kéo–thả 20
 * dòng mà ghi 20 lần rồi lỗi ở lần thứ 11 sẽ để lại thứ tự nửa vời không ai dựng lại được.
 *
 * Port đúng hành vi `reorderTasks` bản cũ (Code.gs.moi:3340):
 *   • mã lạ trong danh sách gửi lên thì **bỏ qua**, không nổ lỗi (TC-TREE-30) — giao diện cũ có
 *     lúc gửi cả mã của dòng vừa bị người khác xoá, và cả lần kéo–thả đó không được mất;
 *   • dòng KHÔNG có trong danh sách giữ thứ tự tương đối cũ và **xếp sau** — bản cũ gửi lên mảng
 *     của đúng nhóm đang mở, phần còn lại của công việc không được nhảy chỗ.
 */
export function reorder(user, workRef, refs = []) {
  return withTransaction(async (client) => {
    const work = await mustFindWork(workRef, client);
    const verdict = can(user, 'update', 'work', work);
    if (!verdict.ok) throw new AppError(verdict.code, verdict.message);

    const rows = await repo.listByWork(work.id, {}, client);
    const byRef = new Map();
    for (const row of rows) {
      byRef.set(String(row.code), row);
      byRef.set(String(row.id), row);
    }

    const ordered = [];
    const seen = new Set();
    const skipped = [];
    for (const ref of Array.isArray(refs) ? refs : []) {
      const row = byRef.get(String(ref ?? '').trim());
      if (!row) {
        skipped.push(ref);
        continue;
      }
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ordered.push(row);
    }
    for (const row of rows) if (!seen.has(row.id)) ordered.push(row);

    // Đánh số lại từ 1 cho cả công việc. Giữ số cũ rồi chèn vào giữa là chỗ để hai dòng cùng
    // `sort_order`, và khi đó thứ tự hiện ra do mã quyết định — người dùng thấy dòng tự nhảy chỗ.
    for (const [index, row] of ordered.entries()) {
      if (row.sort_order === index + 1) continue;
      await repo.update(row.id, { sort_order: index + 1 }, client);
    }

    return { work, ordered: ordered.map((r) => r.code), skipped };
  });
}

/**
 * Đặt tên riêng cho MỘT tháng của một công việc con (cấp 2) hoặc nhiệm vụ (cấp 3).
 *
 * Cùng luật với cấp 1 (`works/service.js`), khác hai điểm buộc phải khác:
 *  · khoảng thời gian của cấp 2/3 là `start_date`–`due_date` (cấp 1 là `end_date`);
 *  · cổng quyền đi theo `level` của dòng, vì §6 coi cấp 2 và cấp 3 là hai loại thực thể.
 *
 * Trả kèm `row` để route ghi nhật ký được vào đúng `entity_type` theo cấp và đúng `work_id`.
 */
export async function setMonthName(user, ref, month, name) {
  const row = await mustFindItem(ref);
  assertCan(user, 'update', row);
  assertSuaDuoc(user, row);
  const thang = assertThangDatDuoc(month, row.start_date, row.due_date);
  const truoc = await monthNamesRepo.findOne({ itemId: row.id, month: thang });
  const saved = await withPgErrors(() =>
    monthNamesRepo.upsert({
      itemId: row.id,
      month: thang,
      name: String(name).trim(),
      createdBy: user?.id ?? null,
    })
  );
  return { row, month: thang, name: saved.name, previousName: truoc?.name ?? '' };
}

/** Bỏ tên riêng của một tháng ⇒ tháng đó về tên gốc. Chưa từng đặt cũng KHÔNG phải lỗi. */
export async function clearMonthName(user, ref, month) {
  const row = await mustFindItem(ref);
  assertCan(user, 'update', row);
  assertSuaDuoc(user, row);
  const thang = assertThangDatDuoc(month, row.start_date, row.due_date);
  const truoc = await monthNamesRepo.findOne({ itemId: row.id, month: thang });
  const removed = await monthNamesRepo.remove({ itemId: row.id, month: thang });
  return { row, month: thang, removed, previousName: truoc?.name ?? '' };
}

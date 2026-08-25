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
import { can } from '../../middleware/rbac.js';
import { mergeWarnings, warnDueBeforeStart, warnOutsideWorkRange } from '../../utils/dateChecks.js';
import { AppError, notFound } from '../../utils/errors.js';
import { deriveOrigin, diffRows, originOf } from '../../utils/origin.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as logsRepo from '../activityLogs/repo.js';
import { boCotKhoaDuyet, coSuaDuocKhiChoDuyet, trangThaiDuyetKhiTao } from '../approvals/rules.js';
import * as remindersRepo from '../reminders/repo.js';
import * as usersRepo from '../users/repo.js';
import * as worksRepo from '../works/repo.js';
import * as repo from './repo.js';

/** Cấp 2 và cấp 3 là HAI loại thực thể khác nhau trong ma trận quyền §6, không được gộp. */
const entityOf = (level) => (Number(level) === repo.LEVEL_SUBWORK ? 'subwork' : 'task');

function assertCan(user, action, row, level = null) {
  const entity = entityOf(level ?? row?.level ?? repo.LEVEL_TASK);
  const verdict = can(user, action, entity, row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

/**
 * Cổng ghi thứ hai, HẸP HƠN §6: mục đang chờ duyệt chỉ người lập (hoặc người duyệt được) mới sửa
 * và xoá được (§7 việc 5.6). Gọi SAU `assertCan` để mã lỗi chung của §6 ra trước.
 */
function assertSuaDuoc(user, row) {
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

/**
 * Danh sách dòng của một công việc. `level` để trống ⇒ trả CẢ cấp 2 và cấp 3 trong một mảng,
 * đúng như `getTasks` bản cũ, để cầu RPC §5.1 trả được nguyên hình dạng cũ. Chỗ nào cần ĐẾM thì
 * phải tự lọc `level === 3` — bản cũ đếm chung nên thống kê phồng lên (bẫy §13.5).
 */
export async function list(user, { workRef, level = null }) {
  const work = await mustFindWork(workRef);
  const verdict = can(user, 'read', 'work', work);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
  const rows = await repo.listByWork(work.id, { level });
  const visible = rows.filter(
    (row) =>
      can(user, 'read', entityOf(row.level), {
        ...row,
        work_department_id: work.department_id,
        work_manager_id: work.manager_id,
      }).ok
  );
  return { work, items: await attachReminders(visible) };
}

export async function getOne(user, ref) {
  const row = await mustFindItem(ref);
  assertCan(user, 'read', row);
  const [withReminders] = await attachReminders([row]);
  return withReminders;
}

/**
 * Nhật ký TỪ ĐẦU của một công việc con / nhiệm vụ (§2.3).
 *
 * Hỏi cả hai `entity_type` vì cấp 2 ghi 'subwork', cấp 3 ghi 'task' và dữ liệu cũ có thể ghi lệch
 * cấp; `entity_id` vẫn là id của dòng nên không lẫn sang đầu việc khác. Ai đọc được dòng thì đọc
 * được nhật ký của nó — không có quyền riêng cho nhật ký, nhưng cũng không được rộng hơn quyền đọc.
 */
export async function history(user, ref, { limit = 200 } = {}) {
  const row = await mustFindItem(ref);
  assertCan(user, 'read', row);
  const entries = await logsRepo.listByEntity({
    entityTypes: ['subwork', 'task'],
    entityId: row.id,
    limit,
  });
  return { item: row, originInfo: originOf(row), entries };
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
export function create(user, input) {
  const level =
    input.level === undefined || input.level === null ? repo.LEVEL_TASK : Number(input.level);
  if (level !== repo.LEVEL_SUBWORK && level !== repo.LEVEL_TASK) {
    throw err('VALIDATION_ERROR', 'Cấp chỉ nhận 2 (công việc con) hoặc 3 (nhiệm vụ)');
  }
  return withTransaction(async (client) => {
    const work = await mustFindWork(input.workRef, client);
    assertCan(
      user,
      'create',
      {
        level,
        assignee_id: input.assignee_id ?? null,
        work_department_id: work.department_id,
        work_manager_id: work.manager_id,
        assigned_in_work: await repo.isAssignedInWork(work.id, user?.id ?? null, client),
      },
      level
    );

    const parent = await resolveParent(input.parentRef, { itemId: null }, client);
    const assignee = await resolveAssignee(input, null, client);
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
          code,
          work_id: work.id,
          parent_id: parent?.id ?? null,
          level,
          approval_status: trangThaiDuyetKhiTao(user, level),
          sort_order: sortOrder,
          ...origin,
        },
        client
      )
    );

    return {
      item: { ...row, reminders: [] },
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
export function update(user, ref, patch = {}, { targetWorkRef = undefined } = {}) {
  return withTransaction(async (client) => {
    const current = await mustFindItem(ref, client);
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
          work_department_id: target.department_id,
          work_manager_id: target.manager_id,
        });
        moved = true;
        work = target;
        structural.work_id = target.id;
        // Nhiệm vụ cấp 3 sang công việc khác thì cha cũ không còn ý nghĩa (cha thuộc công việc
        // cũ, mà trigger đòi cha cùng công việc) ⇒ bỏ cha. Cấp 2 vốn không có cha (TC-TREE-18).
        structural.parent_id = null;
      }
    }

    if (Object.hasOwn(patch, 'parentRef')) {
      const parent = await resolveParent(patch.parentRef, { itemId: current.id }, client);
      structural.parent_id = parent?.id ?? null;
    }

    const assignee = await resolveAssignee(patch, current, client);
    const row = await withPgErrors(() =>
      repo.updateStructure(
        current.id,
        // Sửa dòng KHÔNG đổi được khoá duyệt: đường duy nhất là ba hành động submit/approve/reject
        // của `approvals/service.js`, nơi có kiểm quyền duyệt và ghi lại ai duyệt (§7 việc 5.2).
        { ...boCotKhoaDuyet(patch), ...assignee.fields, ...structural },
        client
      )
    );

    return {
      item: { ...row, reminders: await remindersRepo.listByItem(row.id, client) },
      moved,
      parentCleared: moved && current.parent_id != null && row.parent_id == null,
      // Nhật ký "các lần chỉnh sửa" (§2.3): kể cả hai cột cấu trúc, vì "chuyển sang công việc
      // khác" là thay đổi người dùng cần thấy nhất trong nhật ký.
      changes: diffRows(current, row, [...repo.WRITABLE, 'work_id', 'parent_id']),
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
    const children = await repo.listDescendants(current.id, client);
    await repo.remove(current.id, client);
    return {
      deletedItem: current.code,
      deletedChildren: children.map((r) => r.code),
      deletedCount: 1 + children.length,
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

    return {
      item: { ...item, reminders: [] },
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

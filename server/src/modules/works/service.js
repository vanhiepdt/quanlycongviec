// Nghiệp vụ Công việc cấp 1 (§7 việc 3.1). Vỏ HTTP không có logic nào; mọi thứ ở đây test được
// mà không cần dựng Express.
//
// Hai điều khác bản Apps Script:
//  1. Mã mới do sequence sinh, không do "đọc mã lớn nhất rồi +1" (§7 việc 3.9).
//  2. Nhân bản kéo theo CẢ cây bên dưới và NỐI LẠI quan hệ cha–con trong bản sao. Bản cũ
//     `copyProject` chỉ đánh số lại `Mã nhiệm vụ` mà giữ nguyên `Mã cha` trỏ về cây GỐC, nên bản
//     sao và bản gốc dính vào nhau: sửa cha ở bản sao là hỏng bản gốc (TC-TREE-27, bẫy §13.5).
import { withTransaction } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import { AppError, notFound } from '../../utils/errors.js';
import { warnDueBeforeStart } from '../../utils/dateChecks.js';
import { attachRefs } from '../../utils/historyRefs.js';
import { banDoTenThang, ganTenThang } from '../../utils/monthNames.js';
import { deriveOrigin, diffRows, originOf } from '../../utils/origin.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as logsRepo from '../activityLogs/repo.js';
import * as assignments from '../assignments/service.js';
import { updateChildWeights } from '../workItems/childWeights.js';
import {
  baoKhiHaVeChoDuyet,
  recordReviewerChanges,
  recordReviewerItemChanges,
} from '../approvals/changes.js';
import {
  CHO_DUYET,
  boCotKhoaDuyet,
  coSuaDuocKhiChoDuyet,
  thayDuocNhap,
  trangThaiDuyetKhiTao,
  phaiChoDuyetKhiSua,
  xoaPhaiQuaDuyet,
} from '../approvals/rules.js';
import { demNhomFileTheoItem } from '../taskFiles/repo.js';
import { ganTienDo, ganTienDoWorks } from '../workItems/tienDo.js';
import * as itemsRepo from '../workItems/repo.js';
import * as monthNamesRepo from '../workMonthNames/repo.js';
import { assertThangDatDuoc } from '../workMonthNames/service.js';
import * as repo from './repo.js';

/** Công việc là cấp 1 của cây 3 tầng — hằng số để luật duyệt đọc được ý nghĩa con số. */
const LEVEL_WORK = 1;

/** Chặn theo quyền + phạm vi trên MỘT dòng cụ thể (§6: kiểm ở cả middleware và service). */
function assertCan(user, action, row) {
  if (
    action === 'update' &&
    row?.approval_status === CHO_DUYET &&
    can(user, 'approve', 'work', row).ok
  )
    return;
  const verdict = can(user, action, 'work', row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

/**
 * Cổng ghi thứ hai, HẸP HƠN §6: mục đang chờ duyệt chỉ người lập (hoặc người duyệt được) mới sửa
 * và xoá được (§7 việc 5.6). Gọi SAU `assertCan` để mã lỗi chung của §6 ra trước.
 */
function assertSuaDuoc(user, row) {
  if (row?.approval_status === CHO_DUYET && can(user, 'approve', 'work', row).ok) return;
  const verdict = coSuaDuocKhiChoDuyet(user, row);
  if (!verdict.ok) throw new AppError('FORBIDDEN', verdict.message);
}

/** Dòng công việc theo id/mã, không có thì 404. */
async function mustFind(ref, client = null) {
  const work = await repo.findByRef(ref, client);
  if (!work) throw notFound(`Không tìm thấy công việc "${ref}"`);
  return work;
}

async function ganKetQuaCongViec(user, works) {
  const items = (await itemsRepo.listForWorks(works.map((row) => row.id))).filter(
    (row) =>
      thayDuocNhap(user, row) &&
      can(user, 'read', Number(row.level) === 2 ? 'subwork' : 'task', row).ok
  );
  ganTienDo(
    items,
    await demNhomFileTheoItem(
      null,
      items.map((row) => row.id)
    )
  );
  return ganTienDoWorks(works, items);
}

/** Danh sách công việc, đã lọc bỏ những dòng ngoài phạm vi người đang xem. */
export async function list(user, filter = {}, { withProgress = true } = {}) {
  const rows = await repo.list(filter);
  // `thayDuocNhap` bó thêm đúng trạng thái «Nháp» (012): bản nháp chỉ người lập và admin thấy.
  const thayDuoc = rows.filter(
    (row) => can(user, 'read', 'work', row).ok && thayDuocNhap(user, row)
  );
  // Tên theo tháng đi KÈM dòng chứ không phải một lời gọi riêng: hai tab giao diện nạp dữ liệu MỘT
  // lần rồi đổi tháng ngay trên máy khách, nên nếu tên tháng phải xin thêm thì mỗi lần đổi tháng là
  // một vòng mạng. Truy vấn thêm là một câu `= ANY(...)`, chỉ cho các dòng đã lọc quyền.
  const rieng = await monthNamesRepo.listForWorks(thayDuoc.map((r) => r.id));
  return ganTenThang(
    withProgress ? await ganKetQuaCongViec(user, thayDuoc) : thayDuoc,
    banDoTenThang(rieng),
    'work'
  );
}

export async function getOne(user, ref) {
  const work = await mustFind(ref);
  assertCan(user, 'read', work);
  // Bản NHÁP (012): `can()` không biết gì về nháp nên đọc THẲNG theo mã vẫn lọt nếu không chặn ở
  // đây. Trả 404 chứ không 403 — nói «có một bản nháp mà bạn không được xem» đã là tiết lộ.
  if (!thayDuocNhap(user, work)) throw notFound(`Không tìm thấy công việc "${ref}"`);
  return (await ganKetQuaCongViec(user, [work]))[0];
}

/** Kiểm Ban lãnh đạo kiểm soát + Lãnh đạo phòng phụ trách theo phòng CUỐI CÙNG của dòng. */
async function assertPhanCong(patch, departmentId, client) {
  // Đợt A (028): cấp 1 là NGUỒN của cả cây nên không có tập cha để đối chiếu — `assertSupervisorsByLevel`
  // ở cấp 1 chỉ kiểm vai/phòng của từng người. Cấp 2/cấp 3 mới có ràng buộc ⊆ cấp trên.
  await assignments.assertSupervisorsByLevel(
    patch.supervisor_ids ?? [],
    { level: LEVEL_WORK, departmentId },
    client
  );
  await assignments.assertLeaders(patch.leader_ids ?? [], departmentId, client);
}

export function create(user, input) {
  return withTransaction(async (client) => {
    assertCan(user, 'create', { department_id: input.department_id ?? null });
    assignments.assertAssignmentActor(user, input);
    // Người nhận việc của cấp 1 là người quản lý công việc: tự đứng tên ⇒ "Tự đăng ký", giao cho
    // người khác ⇒ "Được giao" + ghi lại ai giao (§2.3).
    const origin = deriveOrigin({
      actor: user,
      recipientId: input.manager_id ?? null,
      recipientName: input.manager_name ?? null,
    });
    // Phân công kiểm NGUỒN ở server: supervisor phải là admin/Phó GĐ phụ trách phòng; leaders phải
    // là Trưởng/Phó phòng của phòng. Công việc chung (không phòng) ⇒ leaders phải rỗng.
    await assertPhanCong(input, input.department_id ?? null, client);
    // Khoá duyệt do MÁY CHỦ quyết theo vai người tạo (§7 việc 5.1), không nhận từ thân request:
    // `boCotKhoaDuyet` gỡ giá trị người dùng gửi lên trước, nếu không thì Trưởng phòng chỉ cần
    // thêm `approvalStatus: 'Đã duyệt'` là tự duyệt xong việc của mình.
    const work = await withPgErrors(() =>
      repo.insert(
        {
          ...boCotKhoaDuyet(input),
          // `luuNhap` (012): người lập bấm «Lưu nháp» ⇒ 'Nháp', chưa gửi ai duyệt, chưa vào thống kê.
          approval_status: trangThaiDuyetKhiTao(user, LEVEL_WORK, {
            luuNhap: input.luuNhap === true,
          }),
          ...origin,
        },
        client
      )
    );
    return { work, warnings: warnDueBeforeStart(work.start_date, work.end_date, 'endDate') };
  });
}

export function update(user, ref, patch, { client: transactionClient } = {}) {
  const transact = transactionClient ? (fn) => fn(transactionClient) : withTransaction;
  return transact(async (client) => {
    let current = await mustFind(ref, client);
    await client.query('SELECT id FROM works WHERE id = $1 FOR UPDATE', [current.id]);
    current = await mustFind(ref, client);
    assertCan(user, 'update', current);
    assertSuaDuoc(user, current);
    // Đổi phòng cùng lúc với đổi phân công ⇒ kiểm theo phòng MỚI (phòng đích), không theo phòng cũ.
    const phongMoi = Object.hasOwn(patch, 'department_id')
      ? patch.department_id
      : current.department_id;
    if (phongMoi !== current.department_id) {
      assertCan(user, 'create', { ...current, department_id: phongMoi });
      assertCan(user, 'update', { ...current, department_id: phongMoi });
    }
    assignments.assertAssignmentActor(user, patch, current);
    await assertPhanCong(
      phongMoi !== current.department_id ? { ...current, ...patch } : patch,
      phongMoi ?? null,
      client
    );
    if (phongMoi !== current.department_id) {
      await assignments.assertTreeAssignments(
        await itemsRepo.listByWork(current.id, {}, client),
        phongMoi,
        client,
        // Đợt A (D2): cấp 2 phải nằm trong tập của cấp 1 ⇒ truyền cả dòng công việc làm tập nguồn.
        // Truyền `{...current, ...patch}` chứ không phải `current`: đổi phòng thường đi kèm đổi
        // phân công, kiểm theo giá trị SẮP LƯU mới đúng, kiểm theo giá trị cũ là cho lọt.
        { ...current, ...patch }
      );
    } else if (Object.hasOwn(patch, 'supervisor_ids')) {
      // Chỉ đổi danh sách kiểm soát, KHÔNG đổi phòng ⇒ vẫn phải kiểm lại cả cây, vì tập nguồn của
      // mọi công việc con vừa đổi (D2). Không dùng `assertTreeAssignments` ở nhánh này: hàm đó còn
      // kiểm «nhiệm vụ giao cho TP/PP thì phòng phải có Phó GĐ», mà dữ liệu cũ chưa thoả điều đó sẽ
      // làm hỏng một lượt sửa danh sách kiểm soát không liên quan gì tới người thực hiện.
      const dr = await itemsRepo.listByWork(current.id, {}, client);
      const theoId = new Map(dr.map((r) => [String(r.id), r]));
      const capCha = { ...current, ...patch };
      for (const item of dr) {
        await assignments.assertSupervisorsByLevel(
          item.supervisor_ids,
          {
            level: item.level,
            parentRow: item.parent_id == null ? null : theoId.get(String(item.parent_id)),
            workRow: capCha,
            departmentId: phongMoi ?? null,
          },
          client
        );
      }
    }
    const laNguoiDuyetSua =
      current.approval_status === CHO_DUYET && can(user, 'approve', 'work', current).ok;
    const truocCacMucTrongCay = laNguoiDuyetSua
      ? new Map(
          (await itemsRepo.listByWork(current.id, {}, client)).map((item) => [
            String(item.id),
            item,
          ])
        )
      : null;
    // Sửa việc KHÔNG đổi được khoá duyệt: đường duy nhất là ba hành động của `approvals/service.js`.
    // Ghi đè «Chờ duyệt» cho Sửa (011): vai có ghi đè update = 'cho-duyet' sửa mục «Đã duyệt» ⇒
    // quay về «Chờ duyệt» chờ Phó GĐ duyệt lại — cùng luồng với TP/PP sửa CV con.
    const phaiDuyetLai = phaiChoDuyetKhiSua(user, 'work', current.approval_status);
    const work = await withPgErrors(() =>
      repo.update(
        current.id,
        phaiDuyetLai
          ? {
              ...boCotKhoaDuyet(patch),
              approval_status: CHO_DUYET,
              approver_id: null,
              approved_at: null,
              reject_reason: '',
            }
          : boCotKhoaDuyet(patch),
        client
      )
    );
    if (phaiDuyetLai) {
      await client.query('UPDATE works SET submitted_by = $2 WHERE id = $1', [work.id, user.id]);
      // R7 (đợt A): hạ về «Chờ duyệt» thì PHẢI có người biết. Trong cùng giao dịch — xem chú thích
      // của `baoKhiHaVeChoDuyet`. Lấy `supervisor_ids` của dòng VỪA LƯU: lượt sửa này có thể đổi
      // luôn danh sách kiểm soát, báo cho người cũ là báo sai người.
      await baoKhiHaVeChoDuyet(work, user, 'work', 'Công việc', client);
    }
    await recordReviewerChanges(user, 'work', current, work, client);
    if (truocCacMucTrongCay) {
      await recordReviewerItemChanges(
        user,
        truocCacMucTrongCay,
        await itemsRepo.listByWork(work.id, {}, client),
        client
      );
    }
    return {
      work,
      choDuyetLai: phaiDuyetLai,
      // Nhật ký "các lần chỉnh sửa": route đưa vào `res.locals.audit.details` (§2.3).
      changes: diffRows(current, work, repo.WRITABLE),
      warnings: warnDueBeforeStart(work.start_date, work.end_date, 'endDate'),
    };
  });
}

/**
 * Xoá công việc. Trả về DANH SÁCH MÃ đã mất để giao diện nói rõ "xoá công việc này sẽ xoá luôn N
 * dòng bên dưới" — CASCADE của CSDL lo phần xoá, service chỉ chịu trách nhiệm báo cáo (§7 việc 3.5).
 */
export function remove(user, ref) {
  return withTransaction(async (client) => {
    const current = await mustFind(ref, client);
    assertCan(user, 'delete', current);
    assertSuaDuoc(user, current);
    // Ghi đè «Chờ duyệt» cho Xoá (011 + 013): vai bị ghi đè phải đi qua YÊU CẦU XOÁ
    // (`approvalsService.xinXoa`) thay vì xoá thẳng. `canXinXoa` để giao diện biết đây là «phải
    // qua duyệt» chứ không phải «không có quyền» — hai câu chữ khác nhau cho người dùng.
    const xoaOk = xoaPhaiQuaDuyet(user, 'work');
    if (!xoaOk.ok) throw new AppError('FORBIDDEN', xoaOk.message, { canXinXoa: true });
    const items = await itemsRepo.listByWork(current.id, {}, client);
    await repo.remove(current.id, client);
    return {
      deletedWork: current.code,
      deletedItems: items.map((r) => r.code),
      deletedCount: 1 + items.length,
    };
  });
}

/**
 * Nhật ký TỪ ĐẦU của một công việc: dòng tạo, mọi lần sửa (kèm from→to), nhân bản, và các dòng
 * nhật ký khác trỏ vào nó (§2.3).
 *
 * Trả kèm `origin` để giao diện hiện được một chỗ "việc này từ đâu ra" mà không phải gọi thêm API:
 * ai lập, tự đăng ký hay được giao, và ai giao ĐẦU TIÊN (`assigned_by_*` là bất biến do trigger
 * `keep_first_origin` giữ, nên đây luôn là người giao lần đầu chứ không phải người giao gần nhất).
 *
 * `scope='tree'` gom thêm nhật ký của MỌI công việc con và nhiệm vụ dưới nó — cái mà tab «Nhật ký»
 * của công việc cha hiện. Mặc định vẫn là `'self'`: đổi mặc định là lặng lẽ đổi câu trả lời của một
 * API đang có người gọi. Quyền không nới ra theo `scope` — cấp 2/3 luôn cùng phòng với công việc cha
 * (migration 002) nên đọc được cha là đọc được cả cây.
 */
export async function history(user, ref, { limit = 200, scope = 'self' } = {}) {
  const work = await mustFind(ref);
  assertCan(user, 'read', work);
  const caCay = scope === 'tree';
  const entries = caCay
    ? await logsRepo.listForWorkTree({ workId: work.id, limit })
    : await logsRepo.listByEntity({ entityTypes: ['work'], entityId: work.id, limit });
  // Chỉ tải cây khi cần nhãn: `scope=self` không có dòng của cấp 2/3 nên tra tên là truy vấn thừa.
  const items = caCay ? await itemsRepo.listByWork(work.id) : [];
  // Khoá `originInfo`, không phải `origin`: bản thân dòng đã có CỘT `origin` kiểu chuỗi
  // ('Tự đăng ký' / 'Được giao'), trùng tên là frontend đọc lẫn hai thứ khác kiểu.
  return {
    work,
    originInfo: originOf(work),
    scope: caCay ? 'tree' : 'self',
    entries: attachRefs(entries, { work, items }),
  };
}

/**
 * Nhân bản công việc kèm toàn bộ cây bên dưới (TC-TREE-27).
 *
 * Làm hai lượt vì cha phải tồn tại trước con: lượt 1 sao các dòng cấp 2 và ghi lại bảng tra
 * `id gốc → id bản sao`, lượt 2 sao các dòng cấp 3 với `parent_id` lấy từ bảng tra đó. Nhiệm vụ
 * mồ côi (`parent_id IS NULL`) vẫn được sao, vẫn mồ côi — không được lặng lẽ bỏ nó lại (TC-TREE-24).
 *
 * Cả hai lượt nằm trong MỘT giao dịch: nhân bản nửa cây rồi lỗi là dữ liệu rác không ai dọn.
 */
export function copy(user, ref, { name = null } = {}) {
  return withTransaction(async (client) => {
    const source = await mustFind(ref, client);
    assertCan(user, 'read', source);
    assertCan(user, 'create', source);

    const code = await repo.nextWorkCode(client);
    // Bản sao là đầu việc MỚI: người lập là người bấm Nhân bản, không phải người đã lập bản gốc.
    // Người nhận việc thì giữ theo bản gốc (`copyRow` sao `manager_id`), nên nguồn gốc suy từ đó.
    const workOrigin = deriveOrigin({
      actor: user,
      recipientId: source.manager_id ?? null,
      recipientName: source.manager_name ?? null,
    });
    const work = await withPgErrors(() =>
      repo.copyRow(
        source.id,
        {
          code,
          name,
          // Bản sao đi qua đúng cửa duyệt của người bấm Nhân bản, không thừa hưởng khoá duyệt của
          // bản gốc (§7 việc 5.1).
          approvalStatus: trangThaiDuyetKhiTao(user, LEVEL_WORK),
          ...workOrigin,
        },
        client
      )
    );

    const items = await itemsRepo.listByWork(source.id, {}, client);
    for (const item of items) {
      const entity = Number(item.level) === 2 ? 'subwork' : 'task';
      for (const action of ['read', 'create']) {
        const verdict = can(user, action, entity, item);
        if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
      }
      assignments.assertAssignmentActor(user, { assignee_id: item.assignee_id }, item);
      await assignments.assertTaskAssignee(
        item,
        { actor: user, departmentId: source.department_id },
        client
      );
    }
    await assertPhanCong(source, source.department_id, client);
    await assignments.assertTreeAssignments(items, source.department_id, client);
    const idMap = new Map();
    const copiedCodes = [];

    for (const item of items.filter((r) => r.level === itemsRepo.LEVEL_SUBWORK)) {
      const itemCode = await itemsRepo.nextItemCode(work.code, client);
      const copied = await itemsRepo.copyRow(
        item.id,
        {
          code: itemCode,
          workId: work.id,
          parentId: null,
          approvalStatus: trangThaiDuyetKhiTao(user, itemsRepo.LEVEL_SUBWORK),
          ...deriveOrigin({
            actor: user,
            recipientId: item.assignee_id ?? null,
            recipientName: item.assignee_name ?? null,
          }),
        },
        client
      );
      idMap.set(item.id, copied.id);
      copiedCodes.push(copied.code);
    }

    for (const item of items.filter((r) => r.level === itemsRepo.LEVEL_TASK)) {
      const itemCode = await itemsRepo.nextItemCode(work.code, client);
      const copied = await itemsRepo.copyRow(
        item.id,
        {
          code: itemCode,
          workId: work.id,
          // Cha đã bị xoá khỏi dữ liệu gốc hoặc nhiệm vụ mồ côi ⇒ bản sao cũng mồ côi.
          parentId: item.parent_id == null ? null : (idMap.get(item.parent_id) ?? null),
          approvalStatus: trangThaiDuyetKhiTao(user, itemsRepo.LEVEL_TASK),
          ...deriveOrigin({
            actor: user,
            recipientId: item.assignee_id ?? null,
            recipientName: item.assignee_name ?? null,
          }),
        },
        client
      );
      copiedCodes.push(copied.code);
    }

    for (const id of idMap.values()) await updateChildWeights(id, client);
    return { work, copiedItems: copiedCodes, copiedCount: copiedCodes.length };
  });
}

/**
 * Đặt tên riêng cho MỘT tháng của công việc cấp 1.
 *
 * Không có quyền mới: đặt được tên tháng đúng bằng sửa được công việc — cùng `assertCan(...'update')`
 * và cùng cổng «đang chờ duyệt thì chỉ người lập sửa» của `update`. Thêm một quyền riêng chỉ để đổi
 * một nhãn hiển thị là mở thêm một cửa phải canh mãi mãi.
 *
 * Trả `previousName` để route ghi được nhật ký "từ → thành": tên cũ chỉ còn ở CSDL trước khi ghi đè.
 */
export async function setMonthName(user, ref, month, name) {
  const work = await mustFind(ref);
  assertCan(user, 'update', work);
  assertSuaDuoc(user, work);
  const thang = assertThangDatDuoc(month, work.start_date, work.end_date);
  const truoc = await monthNamesRepo.findOne({ workId: work.id, month: thang });
  const row = await withPgErrors(() =>
    monthNamesRepo.upsert({
      workId: work.id,
      month: thang,
      name: String(name).trim(),
      createdBy: user?.id ?? null,
    })
  );
  return { work, month: thang, name: row.name, previousName: truoc?.name ?? '' };
}

/** Bỏ tên riêng của một tháng ⇒ tháng đó về tên gốc. Chưa từng đặt cũng KHÔNG phải lỗi. */
export async function clearMonthName(user, ref, month) {
  const work = await mustFind(ref);
  assertCan(user, 'update', work);
  assertSuaDuoc(user, work);
  const thang = assertThangDatDuoc(month, work.start_date, work.end_date);
  const truoc = await monthNamesRepo.findOne({ workId: work.id, month: thang });
  const removed = await monthNamesRepo.remove({ workId: work.id, month: thang });
  return { work, month: thang, removed, previousName: truoc?.name ?? '' };
}

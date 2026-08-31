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
import {
  CHO_DUYET,
  boCotKhoaDuyet,
  coSuaDuocKhiChoDuyet,
  trangThaiDuyetKhiTao,
  phaiChoDuyetKhiSua,
  xoaDuocKhongKhiChoDuyet,
} from '../approvals/rules.js';
import * as itemsRepo from '../workItems/repo.js';
import * as monthNamesRepo from '../workMonthNames/repo.js';
import { assertThangDatDuoc } from '../workMonthNames/service.js';
import * as repo from './repo.js';

/** Công việc là cấp 1 của cây 3 tầng — hằng số để luật duyệt đọc được ý nghĩa con số. */
const LEVEL_WORK = 1;

/** Chặn theo quyền + phạm vi trên MỘT dòng cụ thể (§6: kiểm ở cả middleware và service). */
function assertCan(user, action, row) {
  const verdict = can(user, action, 'work', row);
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

/** Dòng công việc theo id/mã, không có thì 404. */
async function mustFind(ref, client = null) {
  const work = await repo.findByRef(ref, client);
  if (!work) throw notFound(`Không tìm thấy công việc "${ref}"`);
  return work;
}

/** Danh sách công việc, đã lọc bỏ những dòng ngoài phạm vi người đang xem. */
export async function list(user, filter = {}) {
  const rows = await repo.list(filter);
  const thayDuoc = rows.filter((row) => can(user, 'read', 'work', row).ok);
  // Tên theo tháng đi KÈM dòng chứ không phải một lời gọi riêng: hai tab giao diện nạp dữ liệu MỘT
  // lần rồi đổi tháng ngay trên máy khách, nên nếu tên tháng phải xin thêm thì mỗi lần đổi tháng là
  // một vòng mạng. Truy vấn thêm là một câu `= ANY(...)`, chỉ cho các dòng đã lọc quyền.
  const rieng = await monthNamesRepo.listForWorks(thayDuoc.map((r) => r.id));
  return ganTenThang(thayDuoc, banDoTenThang(rieng), 'work');
}

export async function getOne(user, ref) {
  const work = await mustFind(ref);
  assertCan(user, 'read', work);
  return work;
}

/** Kiểm Ban lãnh đạo kiểm soát + Lãnh đạo phòng phụ trách theo phòng CUỐI CÙNG của dòng. */
async function assertPhanCong(patch, departmentId, client) {
  await assignments.assertSupervisor(patch.supervisor_id ?? null, departmentId, client);
  await assignments.assertLeaders(patch.leader_ids ?? [], departmentId, client);
}

export async function create(user, input) {
  assertCan(user, 'create', null);
  // Người nhận việc của cấp 1 là người quản lý công việc: tự đứng tên ⇒ "Tự đăng ký", giao cho
  // người khác ⇒ "Được giao" + ghi lại ai giao (§2.3).
  const origin = deriveOrigin({
    actor: user,
    recipientId: input.manager_id ?? null,
    recipientName: input.manager_name ?? null,
  });
  // Phân công kiểm NGUỒN ở server: supervisor phải là admin/Phó GĐ phụ trách phòng; leaders phải
  // là Trưởng/Phó phòng của phòng. Công việc chung (không phòng) ⇒ leaders phải rỗng.
  await withTransaction(async (client) => {
    await assertPhanCong(input, input.department_id ?? null, client);
    return null;
  });
  // Khoá duyệt do MÁY CHỦ quyết theo vai người tạo (§7 việc 5.1), không nhận từ thân request:
  // `boCotKhoaDuyet` gỡ giá trị người dùng gửi lên trước, nếu không thì Trưởng phòng chỉ cần
  // thêm `approvalStatus: 'Đã duyệt'` là tự duyệt xong việc của mình.
  const work = await withPgErrors(() =>
    repo.insert({
      ...boCotKhoaDuyet(input),
      approval_status: trangThaiDuyetKhiTao(user, LEVEL_WORK),
      ...origin,
    })
  );
  return { work, warnings: warnDueBeforeStart(work.start_date, work.end_date, 'endDate') };
}

export async function update(user, ref, patch) {
  const current = await mustFind(ref);
  assertCan(user, 'update', current);
  assertSuaDuoc(user, current);
  // Đổi phòng cùng lúc với đổi phân công ⇒ kiểm theo phòng MỚI (phòng đích), không theo phòng cũ.
  const phongMoi = Object.hasOwn(patch, 'department_id')
    ? patch.department_id
    : current.department_id;
  await withTransaction(async (client) => {
    await assertPhanCong(patch, phongMoi ?? null, client);
    return null;
  });
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
        : boCotKhoaDuyet(patch)
    )
  );
  return {
    work,
    choDuyetLai: phaiDuyetLai,
    // Nhật ký "các lần chỉnh sửa": route đưa vào `res.locals.audit.details` (§2.3).
    changes: diffRows(current, work, repo.WRITABLE),
    warnings: warnDueBeforeStart(work.start_date, work.end_date, 'endDate'),
  };
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
    // Ghi đè «Chờ duyệt» cho Xoá (011): luồng duyệt-yêu-cầu-xoá chưa có — chặn với câu nói rõ.
    const xoaOk = xoaDuocKhongKhiChoDuyet(user, 'work');
    if (!xoaOk.ok) throw new AppError('FORBIDDEN', xoaOk.message);
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
    assertCan(user, 'create', null);

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

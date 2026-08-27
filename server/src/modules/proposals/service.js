// Nghiệp vụ Đề nghị (§2.7 nhóm G, §7 việc 7.1). Vỏ HTTP không có logic nào.
//
// **Quyền của đề nghị suy ra từ ma trận §6, KHÔNG có thực thể mới.** `ENTITIES` của
// `middleware/rbac.js` cố ý chỉ có 5 loại (work/subwork/task/user/department) và 120 phép kiểm sinh
// từ chính bảng đó; thêm `proposal` vào bảng là đổi ma trận, mà §6 không được nới. Cách làm ở đây:
// dựng một **dòng phạm vi** cho mỗi đề nghị rồi hỏi `can(user, …, 'work', dòngPhamVi)`:
//
//   - Đề nghị GẮN công việc  ⇒ phạm vi = phòng + người quản lý của công việc đó.
//   - Đề nghị KHÔNG gắn việc ⇒ phạm vi = phòng của người đề nghị, và chính người đó vừa là
//     "quản lý" vừa là "người thực hiện" của dòng phạm vi — nhờ vậy `Quản lý công việc` và
//     `Nhân viên` thấy được đề nghị của chính mình mà không phải viết thêm nhánh nào.
//
// Ba luật riêng, mỗi luật một lý do thật:
//   1. **Người đề nghị luôn thấy đề nghị của mình** dù công việc đã chuyển sang phòng khác — ẩn
//      đơn của chính người gửi là lỗi, không phải bảo mật.
//   2. **`status` + `review_note` chỉ người DUYỆT ĐƯỢC mới ghi** — `can(user,'approve','work',…)`,
//      tức `admin` và `Phó Giám đốc` phụ trách phòng đó (§6). Giao diện cũ cũng chỉ hiện hai ô này
//      cho admin (`handleAdd` dòng ~2040 của `app.js`).
//   3. **Đã duyệt / Từ chối rồi thì chỉ người duyệt được mới sửa hay xoá** — nếu không, người gửi
//      sửa nội dung sau khi đã được duyệt và chữ "đã duyệt" mất nghĩa.
import { withTransaction } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import { AppError, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as itemsRepo from '../workItems/repo.js';
import * as worksRepo from '../works/repo.js';
import * as repo from './repo.js';

/** Trạng thái đã có kết luận — sau hai trạng thái này chỉ người duyệt được mới đụng vào. */
const DA_KET_LUAN = Object.freeze(['Đã duyệt', 'Từ chối']);

/** Cột do người duyệt quyết định, không phải người gửi. */
const COT_DUYET = Object.freeze(['status', 'review_note']);

const laMinh = (a, b) => a != null && b != null && Number(a) === Number(b);

/**
 * Dòng phạm vi cho `can()` — xem khối chú thích đầu tệp.
 *
 * Nhận dòng của `repo.list`/`repo.findByRef` (đã LEFT JOIN sẵn `work_department_id`,
 * `work_manager_id`, `creator_department_id`). Đề nghị không gắn việc thì phòng lấy theo người đề
 * nghị; `manager_id`/`assignee_id` đặt bằng chính người đề nghị.
 */
export function scopeRowOf(row) {
  if (row.work_id != null) {
    return {
      department_id: row.work_department_id ?? null,
      manager_id: row.work_manager_id ?? null,
      assignee_id: row.item_assignee_id ?? null,
    };
  }
  return {
    department_id: row.creator_department_id ?? null,
    manager_id: row.creator_id ?? null,
    assignee_id: row.creator_id ?? null,
  };
}

/** Người này có xem được đề nghị này không. */
export function xemDuoc(user, row) {
  if (laMinh(row.creator_id, user.id)) return true;
  return can(user, 'read', 'work', scopeRowOf(row)).ok;
}

/** Người này có duyệt được đề nghị này không (ghi `status` / `review_note`). */
export function duyetDuoc(user, row) {
  return can(user, 'approve', 'work', scopeRowOf(row)).ok;
}

/** Cổng ghi: người đề nghị, hoặc người sửa được công việc tương ứng, hoặc người duyệt được. */
function assertGhiDuoc(user, row, action) {
  if (duyetDuoc(user, row)) return;
  const laNguoiGui = laMinh(row.creator_id, user.id);
  if (DA_KET_LUAN.includes(row.status)) {
    throw new AppError(
      'FORBIDDEN',
      `Đề nghị "${row.code}" đã ở trạng thái "${row.status}", chỉ người duyệt được mới thay đổi`
    );
  }
  if (laNguoiGui) return;
  const verdict = can(user, action, 'work', scopeRowOf(row));
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

async function mustFind(ref, client = null) {
  const row = await repo.findByRef(ref, client);
  if (!row) throw notFound(`Không tìm thấy đề nghị "${ref}"`);
  return row;
}

/**
 * Danh sách đề nghị đã lọc phạm vi + 4 số đếm.
 *
 * Số đếm tính TRÊN DANH SÁCH ĐÃ LỌC, không đếm cả bảng: 4 thẻ của giao diện là "đề nghị bạn thấy",
 * đếm cả bảng là rò rỉ con số của phòng khác (cùng một luật với việc 7.6).
 */
export async function list(user, filter = {}) {
  const rows = await repo.list(filter);
  const thay = rows.filter((row) => xemDuoc(user, row));
  return { proposals: thay, counts: repo.demTheoTrangThai(thay), total: thay.length };
}

export async function getOne(user, ref) {
  const row = await mustFind(ref);
  if (!xemDuoc(user, row)) {
    throw new AppError('FORBIDDEN', 'Đề nghị này nằm ngoài phạm vi của bạn');
  }
  return row;
}

/**
 * Dò công việc + nhiệm vụ mà đề nghị gắn vào, theo **mã hoặc id**.
 *
 * `workRef` rỗng là hợp lệ (đề nghị mua sắm chung, `work_id` NULL). Nhiệm vụ phải THUỘC công việc
 * đã chọn (G5 "chọn nhiệm vụ theo công việc"): gửi lên một cặp lệch nhau là lỗi dữ liệu vào, không
 * phải chuyện im lặng bỏ qua.
 */
async function doGanKet({ workRef, taskRef }, client) {
  let work = null;
  let item = null;
  if (workRef != null && workRef !== '') {
    work = await worksRepo.findByRef(workRef, client);
    if (!work) throw notFound(`Không tìm thấy công việc "${workRef}"`);
  }
  if (taskRef != null && taskRef !== '') {
    item = await itemsRepo.findByRef(taskRef, client);
    if (!item) throw notFound(`Không tìm thấy nhiệm vụ "${taskRef}"`);
    if (work && !laMinh(item.work_id, work.id)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Nhiệm vụ "${item.code}" không thuộc công việc "${work.code}"`,
        { field: 'taskId' }
      );
    }
    if (!work && item.work_id != null) {
      work = await worksRepo.findById(item.work_id, client);
    }
  }
  return { work, item };
}

/**
 * Tạo đề nghị.
 *
 * Ai đăng nhập cũng gửi được đề nghị (§2.7 G1 không giới hạn vai) — nhưng chỉ người duyệt được mới
 * đặt sẵn `status`/`review_note`; người khác gửi lên hai trường đó thì bị BỎ, không phải 403: giao
 * diện cũ vẫn gửi cả form nên chặn cứng là người dùng không tạo nổi đề nghị nào.
 *
 * `creator_id`/`creator_name` LUÔN là người đang đăng nhập, không nhận từ thân request: nhận vào
 * là ai cũng gửi đơn thay tên người khác.
 */
export function create(user, input) {
  return withPgErrors(() =>
    withTransaction(async (client) => {
      const { work, item } = await doGanKet(input, client);
      const data = {
        type: input.type ?? 'Trong kế hoạch',
        work_id: work?.id ?? null,
        work_item_id: item?.id ?? null,
        content: input.content ?? '',
        url: input.url ?? '',
        supplier: input.supplier ?? '',
        creator_id: user.id,
        creator_name: user.full_name ?? user.name ?? '',
        proposal_date: input.proposalDate ?? null,
      };
      // Phạm vi của dòng SẮP tạo — dựng bằng chính dữ liệu vào để hỏi quyền duyệt trước khi ghi.
      const phamVi = {
        work_id: data.work_id,
        work_department_id: work?.department_id ?? null,
        work_manager_id: work?.manager_id ?? null,
        item_assignee_id: item?.assignee_id ?? null,
        creator_id: user.id,
        creator_department_id: user.department_id ?? null,
        status: 'Đề xuất mới',
      };
      if (duyetDuoc(user, phamVi)) {
        for (const cot of COT_DUYET) {
          const key = cot === 'status' ? 'status' : 'reviewNote';
          if (input[key] != null && input[key] !== '') data[cot] = input[key];
        }
      }
      const created = await repo.insert(data, client);
      return created;
    })
  );
}

/** Sửa. Trường nào không gửi thì không ghi (§5.2). */
export function update(user, ref, patch) {
  return withPgErrors(() =>
    withTransaction(async (client) => {
      const hienTai = await mustFind(ref, client);
      assertGhiDuoc(user, hienTai, 'update');
      await repo.lockById(hienTai.id, client);

      const data = {};
      for (const [key, cot] of Object.entries({
        type: 'type',
        content: 'content',
        url: 'url',
        supplier: 'supplier',
        proposalDate: 'proposal_date',
      })) {
        if (Object.hasOwn(patch, key)) data[cot] = patch[key];
      }
      if (Object.hasOwn(patch, 'workRef') || Object.hasOwn(patch, 'taskRef')) {
        // Gửi `workRef` mà không gửi `taskRef` ⇒ nhiệm vụ bị bỏ liên kết: đổi công việc thì nhiệm
        // vụ cũ chắc chắn không còn thuộc công việc mới. Form cũ luôn gửi cả hai ô nên đây chỉ là
        // đường an toàn cho lời gọi REST lẻ.
        const { work, item } = await doGanKet(
          {
            workRef: Object.hasOwn(patch, 'workRef') ? patch.workRef : hienTai.work_code,
            taskRef: Object.hasOwn(patch, 'taskRef') ? patch.taskRef : null,
          },
          client
        );
        data.work_id = work?.id ?? null;
        data.work_item_id = item?.id ?? null;
      }
      // Hai cột duyệt: chỉ người duyệt được mới ghi. Người gửi có gửi lên cũng bị bỏ im lặng —
      // cùng lý do với `create`.
      if (duyetDuoc(user, hienTai)) {
        if (Object.hasOwn(patch, 'status')) data.status = patch.status;
        if (Object.hasOwn(patch, 'reviewNote')) data.review_note = patch.reviewNote;
      }
      const updated = await repo.update(hienTai.id, data, client);
      return { proposal: updated, before: hienTai };
    })
  );
}

export function remove(user, ref) {
  return withPgErrors(() =>
    withTransaction(async (client) => {
      const hienTai = await mustFind(ref, client);
      assertGhiDuoc(user, hienTai, 'delete');
      const code = await repo.remove(hienTai.id, client);
      return { deletedProposal: code };
    })
  );
}

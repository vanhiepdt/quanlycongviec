// Nghiệp vụ luồng duyệt (§7 việc 5.2, 5.3, 5.5, 5.7 · §8.4 nhóm E · TC-APR-08..16).
//
// Ba hành động, một đường ghi:
//   submit  — gửi một mục đi duyệt (hoặc gửi lại sau khi bị từ chối) ⇒ 'Chờ duyệt'
//   approve — 'Đã duyệt', ghi người duyệt và thời điểm, xoá lý do từ chối cũ
//   reject  — 'Từ chối', BẮT BUỘC lý do ≥ 10 ký tự
//
// Bốn điểm đáng nói:
//
//  1. **Quyền duyệt không viết lại ở đây.** `can(user, 'approve', ...)` của §6 đã cho đúng hai vai
//     `admin` và `Phó Giám đốc`, và `inScope()` đã bó Phó Giám đốc theo `managedDepartmentIds`
//     (tức các dòng `department_managers.role = 'deputy_director'`). Nhờ vậy TC-APR-10 (Phó GĐ
//     duyệt phòng không phụ trách ⇒ 403) và TC-APR-11 (Nhân viên gọi thẳng API ⇒ 403) không cần
//     thêm một dòng điều kiện nào. Thêm điều kiện phòng lần thứ hai ở đây là tạo nguồn sự thật thứ
//     hai cho phạm vi — đúng cái §6 cấm.
//
//  2. **Duyệt KHÔNG lan xuống cây** (TC-APR-16). Duyệt một công việc cấp 1 chỉ đổi đúng dòng đó;
//     các công việc con 'Chờ duyệt' bên trong vẫn phải được duyệt riêng. Người duyệt cấp 1 chưa
//     chắc đã đọc nội dung từng mục con, nên tự duyệt hộ là ký thay.
//
//  3. **Cấp 3 không đi qua đây.** Nhiệm vụ luôn 'Đã duyệt' (việc 5.1) nên gửi duyệt / duyệt một
//     nhiệm vụ là thao tác vô nghĩa ⇒ 409 có câu giải thích, không phải im lặng cho qua.
//
//  4. **Thông báo nằm trong CÙNG giao dịch** với lần đổi trạng thái. Tách ra ngoài thì một lỗi
//     mạng giữa chừng cho ra mục đã duyệt mà người tạo không bao giờ biết. Không có email —
//     §13.4 mục 4 chốt bỏ hẳn (việc 5.9).
import { withTransaction } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as deptRepo from '../departments/repo.js';
import * as notificationsRepo from '../notifications/repo.js';
import * as worksRepo from '../works/repo.js';
import * as itemsRepo from '../workItems/repo.js';
import * as repo from './repo.js';
import { CHO_DUYET, DA_DUYET, TU_CHOI } from './rules.js';

/** Độ dài tối thiểu của lý do từ chối (§7 việc 5.2). "Không đạt" là 8 ký tự — cố ý chưa đủ. */
export const DO_DAI_LY_DO_TOI_THIEU = 10;

/** Tên loại trong đường dẫn `/approvals/:entity/:id/...` → bảng. Nhận cả dạng số nhiều của REST. */
const LOAI_THUC_THE = Object.freeze({
  work: 'work',
  works: 'work',
  'work-item': 'item',
  'work-items': 'item',
  item: 'item',
});

/** Cấp 2 và cấp 3 là hai loại khác nhau trong ma trận quyền §6. */
const entityOf = (level) => (Number(level) === itemsRepo.LEVEL_SUBWORK ? 'subwork' : 'task');

/**
 * Đọc mục cần xử, cùng đủ thứ để xét quyền và để viết thông báo.
 *
 * Trả về một hình dạng CHUNG cho cả hai bảng (`kind`, `row`, `entityType`, `label`) để ba hành
 * động bên dưới không phải rẽ nhánh theo bảng ở mỗi bước.
 */
async function mustFind(entity, ref, client) {
  const kind = LOAI_THUC_THE[String(entity ?? '').toLowerCase()];
  if (!kind) {
    throw new AppError('BAD_REQUEST', `Không rõ loại dữ liệu "${entity}" để duyệt`, {
      field: 'entity',
    });
  }
  if (kind === 'work') {
    const row = await worksRepo.findByRef(ref, client);
    if (!row) throw notFound(`Không tìm thấy công việc "${ref}"`);
    return { kind, row, entityType: 'work', label: 'Công việc' };
  }
  // `findByRefWithWork` để có `work_department_id` — `can()` cần phòng để xét phạm vi (§6).
  const row = await itemsRepo.findByRefWithWork(ref, client);
  if (!row) throw notFound(`Không tìm thấy công việc con/nhiệm vụ "${ref}"`);
  return {
    kind,
    row,
    entityType: entityOf(row.level),
    label: Number(row.level) === itemsRepo.LEVEL_SUBWORK ? 'Công việc con' : 'Nhiệm vụ',
  };
}

/** Ghi khoá duyệt — đường ghi DUY NHẤT vào 4 cột duyệt (xem đầu `repo.js`). */
function ghiKhoaDuyet(target, patch, client) {
  const write = target.kind === 'work' ? worksRepo.update : itemsRepo.update;
  return withPgErrors(() => write(target.row.id, patch, client));
}

/** Nhiệm vụ cấp 3 không có bước duyệt (việc 5.1) ⇒ mọi hành động duyệt trên nó đều vô nghĩa. */
function assertCoBuocDuyet(target) {
  if (target.entityType === 'task') {
    throw conflict(
      'Nhiệm vụ không có bước duyệt — chỉ Công việc và Công việc con mới cần duyệt',
      'entity'
    );
  }
}

function assertCan(user, action, target) {
  const verdict = can(user, action, target.entityType, target.row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

/** Phòng của mục: `work_items` có cột riêng, dự phòng lấy theo công việc cha. */
const phongCua = (row) => row.department_id ?? row.work_department_id ?? null;

/**
 * Các Phó Giám đốc phụ trách phòng của mục — người nhận thông báo "có mục mới chờ duyệt"
 * (việc 5.7).
 *
 * Phòng chưa gán Phó Giám đốc ⇒ danh sách rỗng ⇒ không ai được báo. Đó KHÔNG phải lỗi chặn thao
 * tác: mục vẫn vào 'Chờ duyệt' và vẫn hiện trong hộp chờ duyệt của admin (admin thấy mọi phòng),
 * chỉ là không có thông báo đẩy. Ném lỗi ở đây thì một phòng thiếu cấu hình là cả phòng không gửi
 * duyệt được việc nào.
 */
async function phoGiamDocPhuTrach(departmentId, client) {
  if (departmentId == null) return [];
  const managers = await deptRepo.listManagers(departmentId, client);
  return managers.filter((m) => m.role === 'deputy_director');
}

/** Một dòng mô tả mục, dùng trong nội dung thông báo. Chữ thuần, không HTML. */
const moTa = (target) => `${target.label} ${target.row.code} — ${target.row.name ?? ''}`.trim();

/**
 * Gửi duyệt: đưa một mục vào hàng chờ và báo cho Phó Giám đốc phụ trách.
 *
 * Ai gửi được: người **sửa được** mục đó (§6). Cố ý không giới hạn đúng người tạo — Trưởng phòng
 * phải gửi lại được việc của cấp dưới sau khi sửa theo lý do từ chối.
 */
export function submit(user, entity, ref) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCoBuocDuyet(target);
    assertCan(user, 'update', target);

    if (target.row.approval_status === CHO_DUYET) {
      throw conflict(`${moTa(target)} đang chờ duyệt rồi`);
    }

    const row = await ghiKhoaDuyet(
      target,
      // Gửi lại thì xoá sạch dấu vết lần xử trước: giữ `reject_reason` cũ là mục đang chờ duyệt
      // mà vẫn hiện lý do từ chối của vòng trước trên giao diện.
      {
        approval_status: CHO_DUYET,
        approver_id: null,
        approved_at: null,
        reject_reason: '',
      },
      client
    );

    const nguoiNhan = await phoGiamDocPhuTrach(phongCua(target.row), client);
    const notifications = await notificationsRepo.insertMany(
      nguoiNhan.map((m) => ({
        userId: m.user_id,
        content: `${moTa(target)} đang chờ bạn duyệt (người gửi: ${user.full_name ?? user.code ?? ''}).`,
        type: notificationsRepo.LOAI.CHO_DUYET,
        refType: target.kind === 'work' ? 'work' : 'work_item',
        refId: target.row.id,
      })),
      client
    );

    return { kind: target.kind, row, notified: notifications.length };
  });
}

/**
 * Quyết định duyệt / từ chối. Hai hành động dùng chung khung vì chúng chỉ khác nhau ở trạng thái
 * đích, ở lý do bắt buộc, và ở câu chữ thông báo — tách hai bản sao là hai chỗ để quên xoá
 * `reject_reason` hoặc quên ghi `approver_id`.
 */
function quyetDinh({ user, entity, ref, trangThai, reason }) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCoBuocDuyet(target);
    // Cổng quyền DUY NHẤT của việc 5.3 — chỉ admin và Phó Giám đốc phụ trách phòng đi qua được.
    assertCan(user, 'approve', target);

    // TC-APR-14: duyệt hai lần thì lần hai là 409 và KHÔNG sinh thông báo trùng. Chỉ chặn khi
    // trạng thái đích trùng trạng thái hiện tại — đổi quyết định (đã duyệt ⇒ từ chối, và ngược
    // lại) vẫn phải làm được, đó là chuyện có thật khi phát hiện sai sót sau khi ký.
    if (target.row.approval_status === trangThai) {
      throw conflict(
        `${moTa(target)} đã ở trạng thái "${trangThai}" — không cần làm lại`,
        'approvalStatus'
      );
    }

    const laDuyet = trangThai === DA_DUYET;
    const row = await ghiKhoaDuyet(
      target,
      {
        approval_status: trangThai,
        approver_id: user.id,
        approved_at: new Date(),
        // Duyệt thì xoá lý do từ chối của lần trước; từ chối thì ghi lý do mới.
        reject_reason: laDuyet ? '' : reason,
      },
      client
    );

    // Người tạo được báo kết quả (việc 5.7). Dòng do seed/nhập liệu cũ có thể không có người tạo,
    // và người tự duyệt việc mình gửi thì không cần tự báo cho mình.
    const nguoiTao = target.row.created_by;
    const tuBaoChoMinh = nguoiTao != null && Number(nguoiTao) === Number(user.id);
    const notifications =
      nguoiTao == null || tuBaoChoMinh
        ? []
        : await notificationsRepo.insertMany(
            [
              {
                userId: nguoiTao,
                content: laDuyet
                  ? `${moTa(target)} đã được duyệt.`
                  : `${moTa(target)} bị từ chối. Lý do: ${reason}`,
                type: laDuyet ? notificationsRepo.LOAI.DA_DUYET : notificationsRepo.LOAI.TU_CHOI,
                refType: target.kind === 'work' ? 'work' : 'work_item',
                refId: target.row.id,
              },
            ],
            client
          );

    return { kind: target.kind, row, notified: notifications.length };
  });
}

export function approve(user, entity, ref) {
  return quyetDinh({ user, entity, ref, trangThai: DA_DUYET, reason: null });
}

/**
 * Từ chối — lý do là BẮT BUỘC và phải ≥ 10 ký tự sau khi cắt trắng (TC-APR-08).
 *
 * Kiểm ở đây chứ không chỉ ở zod của route: `reject` còn được gọi từ cầu RPC, và một luật nghiệp
 * vụ nằm duy nhất trong lược đồ của một route là luật có đường vòng.
 *
 * Lý do là dữ liệu NGƯỜI DÙNG NHẬP — lưu và trả về nguyên văn, không thoát HTML ở máy chủ. Thoát ở
 * đây thì giao diện (đã thoát đủ 474 chỗ ở Phase 4) thoát lần thứ hai và người đọc thấy `&lt;`.
 * Chỗ chống XSS đúng là nơi dựng HTML, không phải nơi lưu dữ liệu (xem `xss-injection.test.js`).
 */
export function reject(user, entity, ref, reason) {
  const lyDo = String(reason ?? '').trim();
  if (lyDo.length < DO_DAI_LY_DO_TOI_THIEU) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Vui lòng nhập lý do từ chối, ít nhất ${DO_DAI_LY_DO_TOI_THIEU} ký tự`,
      { field: 'reason' }
    );
  }
  return quyetDinh({ user, entity, ref, trangThai: TU_CHOI, reason: lyDo });
}

/**
 * Phạm vi badge của một người (việc 5.5).
 *
 * Không phải phạm vi DUYỆT: Trưởng phòng không duyệt được nhưng vẫn cần biết phòng mình còn bao
 * nhiêu mục đang treo, và ai cũng cần thấy việc mình gửi đi đã được xử chưa. Vì badge chỉ ĐẾM
 * (không mở đường ghi nào), rộng hơn quyền duyệt ở đây không nới quyền của §6.
 */
export function phamViBadge(user) {
  if (user.role === 'admin') return { all: true };
  const departmentIds = [];
  if (user.role === 'Phó Giám đốc') departmentIds.push(...(user.managedDepartmentIds ?? []));
  else if (user.department_id != null) departmentIds.push(user.department_id);
  // Ủy quyền đang hiệu lực: các phòng của NGƯỜI ỦY QUYỀN cũng vào phạm vi badge/danh sách
  // (2026-08-28 — Phó GĐ được ủy quyền phải thấy duyệt + việc của phòng bên ủy quyền).
  (user.delegations ?? []).forEach((d) => departmentIds.push(...(d.departmentIds ?? [])));
  return { all: false, departmentIds, createdBy: user.id };
}

/** Số mục chờ duyệt cho badge — `GET /approvals/pending-count` (việc 5.5). */
export function pendingCount(user) {
  return repo.countPending(phamViBadge(user));
}

/** Danh sách mục chờ duyệt trong phạm vi người đang xem. */
export function pendingList(user, { limit = 50 } = {}) {
  return repo.listPending(phamViBadge(user), { limit });
}

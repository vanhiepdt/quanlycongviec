// R4 + R4' + R4'' (ĐỢT B, 11/09/2026) — SỬA TỶ LỆ CÔNG VIỆC THÌ PHẢI QUA DUYỆT.
//
// Điểm bất hợp lý số 11: tỷ lệ (%) không qua duyệt ở CẤP NÀO — `suaTyLe` ghi thẳng, không thèm nhìn
// `approval_status`. Q10 chốt «sửa tỷ lệ CÓ phải gửi duyệt», R4 chốt «tỷ lệ của FILE đi theo PHIẾU
// DUYỆT CÂY», R4' chốt người nhận, R4'' chốt cơ chế.
//
// Cơ chế (R4'') — `approval_changes`, đúng khuôn `proposeGuiBld` của 026:
//   • ghi MỘT dòng đề nghị, GIÁ TRỊ CŨ GIỮ NGUYÊN cho tới khi được duyệt;
//   • KHÔNG hạ cây về «Chờ duyệt» ⇒ `v_countable_items` không mất số (đây chính là lý do người dùng
//     chọn `approval_changes` thay vì bắt cả cây duyệt lại);
//   • MỘT người đồng ý là đủ (Q7), kể cả khi thông báo gửi cho tất cả.
//
// Người nhận (R4' + bảng quyết định):
//   tỷ lệ của FILE          → ĐÚNG 1 Ban lãnh đạo kiểm soát của NHIỆM VỤ (cấp 3) chứa nó;
//   tỷ lệ của NHIỆM VỤ      → đúng 1 Ban lãnh đạo kiểm soát của nhiệm vụ đó;
//   tỷ lệ của CÔNG VIỆC CON → TẤT CẢ Ban lãnh đạo kiểm soát đã chọn ở công việc con đó.
// Cấp 1 (`works`) KHÔNG có cột `ty_le` — công việc cha luôn là 100% và tỷ lệ nằm ở các đầu mục bên
// trong nó — nên không có đề nghị nào ở cấp đó.
//
// Vòng import: module này cố tình KHÔNG import `workItems/service.js` (module đó import
// `approvals/changes.js`). Phần cân tỷ lệ dùng chung `workItems/canTyLe.js` — hàm `canLaiTyLeWork`
// được tách ra khỏi service đúng vì lý do này.
import { pool, withTransaction } from '../../db/pool.js';
import { ACTION_TY_LE, can } from '../../middleware/rbac.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import * as notifications from '../notifications/repo.js';
import { updateFileWeights } from '../taskFiles/weights.js';
import { canLaiTyLeWork } from '../workItems/canTyLe.js';
import { updateChildWeights } from '../workItems/childWeights.js';
import * as itemsRepo from '../workItems/repo.js';
import { laDauMuc } from '../workItems/tyLe.js';
import { coTheQuyet, freshActor, supervisorOf } from './changes.js';

/** Nhãn đọc được của đối tượng bị đổi tỷ lệ — in trong hàng chờ và trong câu thông báo. */
const NHAN_DOI_TUONG = Object.freeze({
  file: 'tỷ lệ của file kết quả',
  task: 'tỷ lệ của nhiệm vụ',
  subwork: 'tỷ lệ của công việc con',
});

/**
 * Tập người nhận một đề nghị đổi tỷ lệ.
 *
 * Cấp 3 (và file của nó) chỉ có ĐÚNG MỘT người kiểm soát — CHECK `task_supervisor_single` của 028
 * khoá `cardinality(supervisor_ids) <= 1`, và `supervisorOf` còn lùi về phần tử đầu của cấp 2 khi
 * nhiệm vụ chưa chọn riêng (Q12). Cấp 2 gửi TẤT CẢ những người đã chọn.
 *
 * @returns {Promise<Array<number>>} danh sách id, đã bỏ trùng; RỖNG nghĩa là không ai ký được
 */
async function nguoiNhanTyLe(dich, client) {
  if (dich.loai === 'file') return dedupe([await supervisorOf(dich.item, client)]);
  if (Number(dich.row.level) === itemsRepo.LEVEL_SUBWORK) return dedupe(dich.row.supervisor_ids);
  return dedupe([await supervisorOf(dich.row, client)]);
}

const dedupe = (ids) => [
  ...new Set(
    (ids ?? [])
      .filter((id) => id != null)
      .map(Number)
      .filter(Number.isFinite)
  ),
];

/** Cùng một van an toàn như `proposeGuiBld`: người tự đề nghị cho chính mình thì Giám đốc xử. */
const deNghiTuDuyet = (recipients, editorId) =>
  recipients.some((id) => String(id) === String(editorId));

function kiemGiaTri(value) {
  const so = Number(value);
  if (!Number.isInteger(so) || so < 0 || so > 100) {
    throw badRequest('Tỷ lệ công việc phải là số nguyên từ 0 đến 100', 'tyLe');
  }
  return so;
}

function bao(userId, content, type, itemId, client) {
  return notifications.insertMany(
    [{ userId: Number(userId), type, content, refType: 'work_item', refId: Number(itemId) }],
    client
  );
}

/**
 * Ghi MỘT dòng đề nghị đổi tỷ lệ. Giá trị hiện tại KHÔNG đổi — đó là toàn bộ ý nghĩa của R4''.
 *
 * @param {object} user người đề nghị
 * @param {object} dich `{ loai:'file'|'item', row, item? }` — `row` là nhóm file hoặc dòng
 *   `work_items`; `item` bắt buộc khi `loai:'file'` (nhiệm vụ cấp 3 chứa nhóm đó, để tìm người nhận)
 * @param {number} valueTo tỷ lệ muốn đặt
 * @param {object} client giao dịch đang mở
 * @returns {Promise<{pending:boolean, value:number, id?:number, nguoiNhan?:Array<number>}>}
 *   `value` là giá trị CÒN HIỆU LỰC sau lời gọi (bằng giá trị cũ khi `pending`), để bên gọi ghi
 *   ngược vào phản hồi mà không phải đọc lại CSDL — đúng khuôn `proposeGuiBld`.
 */
export async function proposeTyLe(user, dich, valueTo, client) {
  const giaTriMoi = kiemGiaTri(valueTo);
  const laFile = dich.loai === 'file';
  const item = laFile ? dich.item : dich.row;
  if (!item) throw notFound('Không tìm thấy nhiệm vụ chứa tỷ lệ này');
  const giaTriCu = Number(laFile ? dich.row.ty_le : item.ty_le) || 0;
  if (giaTriMoi === giaTriCu) return { pending: false, value: giaTriCu };

  const doiTuong = laFile
    ? 'file'
    : Number(item.level) === itemsRepo.LEVEL_SUBWORK
      ? 'subwork'
      : 'task';
  const nguoiNhan = await nguoiNhanTyLe(
    laFile ? { loai: 'file', item } : { loai: 'item', row: item },
    client
  );
  if (!nguoiNhan.length) {
    throw conflict(
      'Nhiệm vụ chưa có Ban lãnh đạo kiểm soát nên không ai duyệt được đề nghị đổi tỷ lệ — hãy chọn người ở ô «Ban lãnh đạo kiểm soát» trước'
    );
  }

  const dangTreo = (
    await client.query(
      `SELECT id FROM approval_changes
        WHERE change_kind = 'ty-le' AND approved_at IS NULL AND item_id = $1
          AND COALESCE(file_id, 0) = $2
        FOR UPDATE`,
      [item.id, laFile ? dich.row.id : 0]
    )
  ).rows[0];
  if (dangTreo) {
    throw conflict(
      'Đã có một đề nghị đổi tỷ lệ đang chờ duyệt cho ' +
        (laFile ? 'file kết quả này' : 'mục này') +
        ' — hãy xử lý đề nghị đó trước'
    );
  }

  // Người nhận thật sự: chính danh sách kiểm soát; nhưng nếu NGƯỜI ĐỀ NGHỊ nằm trong đó thì chuyển
  // sang các tài khoản admin để còn một bên độc lập (Q7 chỉ cần một người, nhưng người đó không được
  // là người vừa ký đề nghị).
  const guiAdmin = deNghiTuDuyet(nguoiNhan, user.id);
  const nhanThat = guiAdmin
    ? (
        await client.query("SELECT id FROM users WHERE role = 'admin' AND is_active ORDER BY id")
      ).rows.map((r) => r.id)
    : nguoiNhan;
  if (!nhanThat.length) throw conflict('Chưa có người duyệt độc lập cho đề nghị đổi tỷ lệ này');

  const tenFile = String(dich.row.ten_ket_qua || dich.row.ten_goc || '').trim();
  const change = {
    field: 'ty_le',
    label: laFile ? 'Tỷ lệ công việc của file (%)' : 'Tỷ lệ công việc (%)',
    from: `${giaTriCu}%`,
    to: `${giaTriMoi}%`,
    valueFrom: giaTriCu,
    valueTo: giaTriMoi,
    target: doiTuong,
    itemId: Number(item.id),
    workId: Number(item.work_id),
    // `fileId` null cho đề nghị ở cấp mục — `decideTyLe` phân nhánh theo đúng khoá này.
    fileId: laFile ? Number(dich.row.id) : null,
    recipients: nhanThat.map(Number),
  };
  const rec = (
    await client.query(
      `INSERT INTO approval_changes
         (work_id, item_id, file_id, recipient_id, editor_id, entity_code, entity_name, changes, change_kind)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7::jsonb,'ty-le') RETURNING id`,
      [
        item.work_id,
        item.id,
        change.fileId,
        user.id,
        item.code,
        laFile && tenFile ? `${item.name} — ${tenFile}` : item.name,
        JSON.stringify([change]),
      ]
    )
  ).rows[0];

  const tenMuc = laFile && tenFile ? `"${tenFile}" của nhiệm vụ "${item.name}"` : `"${item.name}"`;
  for (const id of nhanThat) {
    await bao(
      id,
      `${user.full_name} đề nghị đổi ${NHAN_DOI_TUONG[doiTuong]} của ${tenMuc}: ${giaTriCu}% → ${giaTriMoi}%. Giá trị hiện tại chưa đổi.`,
      notifications.LOAI.CHO_DUYET,
      item.id,
      client
    );
  }
  return { id: rec.id, pending: true, value: giaTriCu, nguoiNhan: nhanThat };
}

/**
 * Ai được quyết một đề nghị đổi tỷ lệ: NGƯỜI TRONG danh sách nhận, không phải người đề nghị, và còn
 * quyền duyệt trên dòng đó. `coTheQuyet` chừa admin đúng một khe — khi lý do từ chối chỉ là
 * `NOT_APPROVER` — để gỡ thế kẹt «chính người kiểm soát tự đề nghị cho mình» (xem chú thích ở đó).
 */
function canDecideTyLe(user, row, change) {
  if (String(user.id) === String(row.editor_id)) return false;
  const recipients = (change?.recipients ?? []).map(String);
  const entity = change?.target === 'subwork' ? 'subwork' : 'task';
  return (
    (recipients.includes(String(user.id)) ||
      (user.role === 'admin' && recipients.includes(String(row.editor_id)))) &&
    coTheQuyet(user, entity, row)
  );
}

/**
 * Hàng chờ «đề nghị đổi tỷ lệ» của CHÍNH người đang xem — gộp vào cùng `GET /approvals/pending`
 * với cây và với đề nghị đổi tích, không mở một hàng chờ thứ ba (tiền lệ 026).
 */
export async function pendingTyLe(user, client = null) {
  const { rows } = await (client ?? pool).query(
    `SELECT c.id, c.editor_id, c.recipient_id, c.changes, c.entity_name, c.file_id,
            i.*, c.id AS change_id, w.name AS work_name, u.full_name AS requester_name,
            tf.ten_ket_qua AS ten_file, tf.ten_goc AS ten_goc_file,
            ${itemsRepo.sqlSupervisorHieuLuc('i.')} AS supervisor_hieu_luc
       FROM approval_changes c
       JOIN work_items i ON i.id = c.item_id
       JOIN works w ON w.id = i.work_id
       LEFT JOIN work_items p ON p.id = i.parent_id
       LEFT JOIN users u ON u.id = c.editor_id
       LEFT JOIN task_files tf ON tf.id = c.file_id
      WHERE c.change_kind = 'ty-le' AND c.approved_at IS NULL
      ORDER BY c.id`
  );
  return rows
    .filter((row) => canDecideTyLe(user, row, row.changes?.[0]))
    .map((row) => {
      const change = row.changes[0];
      return {
        kind: 'ty-le',
        id: row.change_id,
        code: row.code,
        name: row.name,
        level: Number(row.level),
        department_id: row.department_id,
        created_by_name: row.requester_name,
        work_name: row.work_name,
        change,
        tenFile: row.ten_file ?? row.ten_goc_file ?? null,
      };
    });
}

/**
 * Áp một lượt đổi tỷ lệ ĐÃ được duyệt. Ba nhánh đúng theo ba luật chia đang có — không phát minh
 * luật mới, chỉ gọi lại đúng hàm mà đường sửa trực tiếp vẫn gọi:
 *   • FILE                       → `updateFileWeights` (chia trong các nhóm của cùng nhiệm vụ);
 *   • đầu mục (cấp 2, cấp 3 không cha) → `canLaiTyLeWork` (chia trong công việc, tổng đúng 100);
 *   • cấp 3 có cha               → `updateChildWeights` (chia nội bộ công việc con).
 */
async function apTyLe(change, client) {
  const value = Number(change.valueTo);
  if (change.target === 'file') {
    return updateFileWeights(change.itemId, client, { editedId: change.fileId, value });
  }
  const row = await itemsRepo.findById(change.itemId, client);
  if (!row) throw notFound('Không tìm thấy mục của đề nghị đổi tỷ lệ');
  if (laDauMuc(row)) {
    return canLaiTyLeWork(row.work_id, client, { suaId: row.id, suaGiaTri: value });
  }
  if (Number(row.level) === itemsRepo.LEVEL_TASK && row.parent_id != null) {
    return updateChildWeights(row.parent_id, client, { editedId: row.id, value });
  }
  return new Map();
}

/**
 * Duyệt hoặc từ chối MỘT đề nghị đổi tỷ lệ. Duyệt ⇒ áp giá trị MỚI; từ chối ⇒ không đụng gì tới tỷ
 * lệ (giá trị cũ vốn chưa từng đổi). Cả hai đều đóng dòng đề nghị bằng `approved_at` + `decision`
 * và báo cho NGƯỜI ĐỀ NGHỊ biết kết quả — cùng khuôn `decideGuiBld`.
 */
export function decideTyLe(user, id, approve, reason = '') {
  return withTransaction(async (client) => {
    const found = (
      await client.query("SELECT * FROM approval_changes WHERE id = $1 AND change_kind = 'ty-le'", [
        id,
      ])
    ).rows[0];
    if (!found) throw notFound();
    await client.query('SELECT id FROM works WHERE id = $1 FOR UPDATE', [found.work_id]);
    const record = (
      await client.query('SELECT * FROM approval_changes WHERE id = $1 FOR UPDATE', [id])
    ).rows[0];
    if (!record || record.approved_at != null) throw conflict('Đề nghị này đã được xử lý');
    const change = record.changes?.[0];
    if (!change) throw conflict('Đề nghị này không có nội dung tỷ lệ');
    const row = await itemsRepo.findByRefWithWork(found.item_id, client);
    if (!row) throw notFound();
    if (!canDecideTyLe(user, row, change)) {
      throw forbidden(
        'Chỉ Ban lãnh đạo kiểm soát được chọn cho mục này (hoặc Giám đốc khi chính họ tự đề nghị) mới duyệt được đề nghị đổi tỷ lệ'
      );
    }
    if (approve) {
      // Kiểm lại quyền của NGƯỜI ĐỀ NGHỊ tại thời điểm duyệt — cùng lý do `decideGuiBld` làm vậy:
      // đề nghị có thể treo qua nhiều ngày, admin có thể đã thu quyền `ty-le` của vai đó.
      const actor = await freshActor(record.editor_id, client);
      const entity = change.target === 'subwork' ? 'subwork' : 'task';
      // Quyền kiểm lại theo ĐÚNG cửa mà người đề nghị đã đi qua: tỷ lệ của FILE mở bằng
      // `file:create` (`suaTyLe`), còn tỷ lệ của MỤC mở bằng hành động `ty-le`. Soi nhầm cửa là
      // khoá chết đề nghị hợp lệ — ví dụ một cán bộ có `file:create` nhưng không có `task:ty-le`.
      const conQuyen =
        change.target === 'file'
          ? can(actor, 'create', 'file', row).ok
          : can(actor, ACTION_TY_LE, entity, row).ok;
      if (!conQuyen) {
        throw forbidden('Quyền sửa tỷ lệ của người đề nghị đã bị thu hồi');
      }
      // Giá trị ghi trong đề nghị phải còn đúng với CSDL: đề nghị có thể treo qua nhiều ngày, và một
      // lượt duyệt khác (hoặc một lượt cân tự động do thêm/xoá nhóm) có thể đã dời con số đi. Áp một
      // đề nghị cũ lên bức tranh mới là chia lại tỷ lệ theo một tiền đề không còn đúng.
      const giaTriHienTai =
        change.target === 'file'
          ? (await client.query('SELECT ty_le FROM task_files WHERE id = $1', [change.fileId]))
              .rows[0]?.ty_le
          : row.ty_le;
      if (giaTriHienTai == null) throw notFound('Không tìm thấy dòng của đề nghị đổi tỷ lệ');
      if ((Number(giaTriHienTai) || 0) !== Number(change.valueFrom)) {
        throw conflict('Tỷ lệ hiện tại đã thay đổi — hãy từ chối và lập đề nghị mới');
      }
      await apTyLe(change, client);
    } else if (String(reason).trim().length < 10) {
      throw new AppError('VALIDATION_ERROR', 'Lý do từ chối cần ít nhất 10 ký tự');
    }
    await client.query(
      'UPDATE approval_changes SET approved_at = now(), decision = $2 WHERE id = $1',
      [record.id, approve ? 'approved' : 'rejected']
    );
    await bao(
      record.editor_id,
      `Đề nghị đổi ${NHAN_DOI_TUONG[change.target] ?? 'tỷ lệ'} của "${row.name}" (${change.from} → ${change.to}) đã ${approve ? 'được duyệt' : 'bị từ chối'}.${reason ? ' ' + String(reason).trim() : ''}`,
      approve ? notifications.LOAI.DA_DUYET : notifications.LOAI.TU_CHOI,
      row.id,
      client
    );
    return {
      id: record.id,
      approved: approve,
      target: change.target,
      tyLe: approve ? Number(change.valueTo) : Number(change.valueFrom),
      item: await itemsRepo.findById(row.id, client),
    };
  });
}

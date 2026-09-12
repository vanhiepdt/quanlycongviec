// Các thay đổi của người duyệt được công bố sau khi duyệt, chỉ người gửi được xác nhận đã biết.
import { pool, withTransaction } from '../../db/pool.js';
import { can, giaTriHieuLuc } from '../../middleware/rbac.js';
import { AppError, conflict, forbidden, notFound } from '../../utils/errors.js';
import * as assignments from '../assignments/service.js';
import * as notifications from '../notifications/repo.js';
import * as permissions from '../permissions/repo.js';
import * as settings from '../systemSettings/service.js';
import { hieuLucCho } from '../delegations/service.js';
import * as worksRepo from '../works/repo.js';
import * as itemsRepo from '../workItems/repo.js';
import { thayDuocNhap } from './rules.js';

const LABELS = {
  work_id: 'Công việc cha',
  parent_id: 'Công việc con',
  name: 'Tên',
  description: 'Mô tả',
  department_id: 'Phòng',
  // Đợt A (028): cột đơn `supervisor_id` thành MẢNG `supervisor_ids`. Giữ CẢ nhãn cũ vì dòng
  // `approval_changes` đang treo từ trước 028 lưu `field:'supervisor_id'` trong JSON — bỏ nhãn cũ
  // là những dòng đó hiện ra tên cột thô cho người duyệt đọc.
  supervisor_ids: 'Ban lãnh đạo kiểm soát',
  supervisor_id: 'Ban lãnh đạo kiểm soát',
  leader_ids: 'Lãnh đạo phòng phụ trách',
  manager_id: 'Người quản lý',
  // Từ 2026-09-09 Trưởng/Phó phòng cũng nhận việc trực tiếp được nên nhãn không còn là «Cán bộ».
  assignee_id: 'Người thực hiện trực tiếp',
  status: 'Trạng thái',
  priority: 'Ưu tiên',
  start_date: 'Ngày bắt đầu',
  end_date: 'Ngày kết thúc',
  due_date: 'Hạn chót',
  report_date: 'Ngày hoàn thành',
  target: 'Mục tiêu',
  output: 'Kết quả đầu ra',
  notes: 'Ghi chú',
  result_links: 'Liên kết kết quả',
  ty_le: 'Tỷ lệ công việc (%)',
  gui_bld_phe_duyet: 'Gửi BLĐ phê duyệt',
};
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
async function display(field, value, client) {
  if (value == null) return '';
  if (field === 'gui_bld_phe_duyet') return value ? 'Bật' : 'Tắt';
  if (field === 'work_id' || field === 'parent_id') {
    const table = field === 'work_id' ? 'works' : 'work_items';
    const row = (await client.query('SELECT code,name FROM ' + table + ' WHERE id = $1', [value]))
      .rows[0];
    return row ? row.code + ' — ' + row.name : String(value);
  }
  if (field === 'department_id') {
    return (
      (await client.query('SELECT name FROM departments WHERE id = $1', [value])).rows[0]?.name ??
      String(value)
    );
  }
  if (
    ['supervisor_ids', 'supervisor_id', 'leader_ids', 'manager_id', 'assignee_id'].includes(field)
  ) {
    const ids = Array.isArray(value) ? value : [value];
    const { rows } = await client.query(
      'SELECT full_name FROM users WHERE id = ANY($1::bigint[]) ORDER BY full_name',
      [ids]
    );
    return rows.map((r) => r.full_name).join(', ');
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}
export async function recordReviewerChanges(user, kind, before, after, client) {
  const entity = kind === 'work' ? 'work' : Number(before.level) === 2 ? 'subwork' : 'task';
  if (before.approval_status !== 'Chờ duyệt' || !can(user, 'approve', entity, before).ok) return;
  const table = kind === 'work' ? 'works' : 'work_items';
  const sender = (
    await client.query(
      'SELECT COALESCE(submitted_by, created_by) AS sender FROM ' + table + ' WHERE id = $1',
      [before.id]
    )
  ).rows[0]?.sender;
  if (sender == null || String(sender) === String(user.id)) return;
  const workId = kind === 'work' ? after.id : after.work_id;
  const itemId = kind === 'work' ? null : before.id;
  const old = (
    await client.query(
      // ĐỢT B (029): hai index «một đề nghị đang chờ trên mỗi dòng» nay theo `change_kind`, nên một
      // nhiệm vụ có thể cùng lúc treo một đề nghị `reviewer`, một `gui-bld` và N đề nghị `ty-le`.
      // Câu này chỉ quan tâm HAI loại đầu: `ty-le` là trục riêng (R4'') và không bao giờ đụng
      // `recordReviewerChanges` — đề nghị tỷ lệ chỉ sinh ra khi cây ĐÃ `Đã duyệt`, còn hàm này chỉ
      // chạy khi dòng đang `Chờ duyệt`. Lọc ngay trong SQL để khỏi khoá nhầm dòng của trục kia.
      "SELECT * FROM approval_changes WHERE (($2::bigint IS NULL AND item_id IS NULL AND work_id = $1) OR item_id = $2) AND approved_at IS NULL AND change_kind IN ('reviewer','gui-bld') FOR UPDATE",
      [workId, itemId]
    )
  ).rows[0];
  if (old && old.change_kind !== 'reviewer')
    throw conflict(
      'Nhiệm vụ đang có đề nghị đổi tích chờ xử lý — hãy xử lý đề nghị trước khi sửa kèm duyệt'
    );
  const byField = new Map((old?.changes ?? []).map((c) => [c.field, c]));
  for (const field of Object.keys(LABELS)) {
    if (same(before[field], after[field])) continue;
    const prior = byField.get(field);
    const change = {
      field,
      label: LABELS[field],
      from: prior?.from ?? (await display(field, before[field], client)),
      to: await display(field, after[field], client),
    };
    if (change.from === change.to) byField.delete(field);
    else byField.set(field, change);
  }
  const changes = [...byField.values()];
  if (old) {
    await client.query(
      'UPDATE approval_changes SET changes = $2::jsonb, editor_id = $3, entity_name = $4, work_id = $5 WHERE id = $1',
      [old.id, JSON.stringify(changes), user.id, after.name, workId]
    );
  } else if (changes.length) {
    await client.query(
      'INSERT INTO approval_changes(work_id,item_id,recipient_id,editor_id,entity_code,entity_name,changes) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
      [workId, itemId, sender, user.id, before.code, after.name, JSON.stringify(changes)]
    );
  }
}
async function idsFor(target, client) {
  if (target.kind === 'work')
    return (await itemsRepo.listByWork(target.row.id, {}, client)).map((r) => r.id);
  return [
    target.row.id,
    ...(await itemsRepo.listDescendants(target.row.id, client)).map((r) => r.id),
  ];
}
/** Ghi nhận cả các dòng bị cập nhật gián tiếp khi người duyệt sửa một mục (ví dụ cân tỷ lệ
 * nhiệm vụ cùng công việc con hoặc đồng bộ phòng xuống cây). Chỉ các dòng đã tồn tại trước lượt sửa
 * mới được ghi; dòng mới không thể là thay đổi của người duyệt trong chính lượt đó. */
export async function recordReviewerItemChanges(user, beforeById, afterRows, client) {
  if (!beforeById || beforeById.size === 0) return;
  for (const after of afterRows ?? []) {
    const before = beforeById.get(String(after.id));
    if (before) await recordReviewerChanges(user, 'item', before, after, client);
  }
}

export async function startSubmission(user, target, client) {
  const ids = await idsFor(target, client);
  if (target.kind === 'work')
    await client.query('UPDATE works SET submitted_by = $2 WHERE id = $1', [
      target.row.id,
      user.id,
    ]);
  await client.query(
    "UPDATE work_items SET submitted_by = $2 WHERE id = ANY($1::bigint[]) AND approval_status IN ('Nháp','Từ chối')",
    [ids, user.id]
  );
  // Dòng con đang chờ từ lượt riêng giữ người gửi và thay đổi của lượt đó.
  await client.query(
    "DELETE FROM approval_changes WHERE change_kind = 'reviewer' AND approved_at IS NULL AND (item_id IN (SELECT id FROM work_items WHERE id = ANY($1::bigint[]) AND approval_status IN ('Nháp','Từ chối')) OR ($2::bigint IS NOT NULL AND work_id = $2 AND item_id IS NULL))",
    [ids, target.kind === 'work' ? target.row.id : null]
  );
  if (target.kind !== 'work')
    await client.query('UPDATE work_items SET submitted_by = $2 WHERE id = $1', [
      target.row.id,
      user.id,
    ]);
}
export async function clearPending(target, client) {
  const ids = await idsFor(target, client);
  await client.query(
    "DELETE FROM approval_changes WHERE change_kind = 'reviewer' AND approved_at IS NULL AND (item_id = ANY($1::bigint[]) OR ($2::bigint IS NOT NULL AND work_id = $2 AND item_id IS NULL))",
    [ids, target.kind === 'work' ? target.row.id : null]
  );
}
export async function publishChanges(target, client) {
  const ids = await idsFor(target, client);
  await client.query(
    "UPDATE approval_changes SET approved_at = now() WHERE change_kind = 'reviewer' AND approved_at IS NULL AND (item_id = ANY($1::bigint[]) OR ($2::bigint IS NOT NULL AND work_id = $2 AND item_id IS NULL))",
    [ids, target.kind === 'work' ? target.row.id : null]
  );
}
export async function unreadChanges(user, entity, ref) {
  const isWork = entity === 'work';
  if (!isWork && !['item', 'work-item'].includes(entity))
    throw new AppError('VALIDATION_ERROR', 'Loại đầu việc không hợp lệ');
  const row = isWork ? await worksRepo.findByRef(ref) : await itemsRepo.findByRefWithWork(ref);
  if (!row || !thayDuocNhap(user, row)) throw notFound();
  const type = isWork ? 'work' : Number(row.level) === 2 ? 'subwork' : 'task';
  const verdict = can(user, 'read', type, row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
  const ids = isWork ? [] : await idsFor({ kind: 'item', row }, null);
  return (
    await pool.query(
      "SELECT c.id,c.entity_code,c.entity_name,c.changes,c.approved_at,u.full_name AS editor_name FROM approval_changes c LEFT JOIN users u ON u.id = c.editor_id WHERE c.change_kind = 'reviewer' AND c.recipient_id = $1 AND c.approved_at IS NOT NULL AND c.acknowledged_at IS NULL AND jsonb_array_length(c.changes) > 0 AND (($2::bigint IS NOT NULL AND c.work_id = $2) OR c.item_id = ANY($3::bigint[])) ORDER BY c.approved_at,c.id",
      [user.id, isWork ? row.id : null, ids]
    )
  ).rows;
}
export async function acknowledge(user, id) {
  const { rows } = await pool.query(
    'UPDATE approval_changes SET acknowledged_at = COALESCE(acknowledged_at,now()) WHERE id = $1 AND recipient_id = $2 AND approved_at IS NOT NULL RETURNING id',
    [id, user.id]
  );
  if (!rows.length) throw notFound();
  return { id: rows[0].id, acknowledged: true };
}

const isLeader = (u) => ['admin', 'Phó Giám đốc', 'Trưởng phòng', 'Phó phòng'].includes(u?.role);
function assertChangeActor(user, row) {
  if (!isLeader(user))
    throw forbidden('Cán bộ chỉ được chọn Gửi BLĐ khi tạo mới, không được sửa sau đó');
  const q = can(user, 'gui-bld', 'task', row);
  if (!q.ok) throw new AppError(q.code, q.message);
}
export async function freshActor(id, client) {
  const u = (
    await client.query(
      `SELECT u.id,u.role,u.full_name,u.department_id,
    COALESCE((SELECT array_agg(department_id) FROM department_managers WHERE user_id=u.id AND role='deputy_director'),'{}') AS "managedDepartmentIds"
    FROM users u WHERE u.id=$1 AND u.is_active`,
      [id]
    )
  ).rows[0];
  if (!u) throw forbidden('Người đề nghị không còn hoạt động');
  u.ghiDe = Object.fromEntries(
    (await permissions.listByVai(u.role, client)).map((g) => [g.entity_type + ':' + g.action, g])
  );
  u.delegations = await hieuLucCho(u.id, client);
  return u;
}
/**
 * MỘT người nhận đề nghị đổi tích — đợt A (028) đổi `supervisor_id` thành mảng nên phải chốt lấy ai.
 *
 * Luật giống hệt `sqlSupervisorHieuLuc` của `workItems/repo.js`: phần tử ĐẦU của chính dòng, dòng
 * chưa chọn thì phần tử đầu của cấp 2 chứa nó (Q12). Đọc ở đây bằng JS chứ không phải SQL vì
 * `proposeGuiBld` đang cầm sẵn `row` trong tay và còn phải đem id đi `assertSupervisor`.
 */
export async function supervisorOf(row, client) {
  const cuaMinh = (row.supervisor_ids ?? [])[0] ?? null;
  if (cuaMinh != null || row.parent_id == null) return cuaMinh;
  const cha = await itemsRepo.findById(row.parent_id, client);
  return (cha?.supervisor_ids ?? [])[0] ?? null;
}
function notifyChange(userId, text, row, type, client) {
  return notifications.insertMany(
    [{ userId, type, content: text, refType: 'work_item', refId: row.id }],
    client
  );
}

/**
 * R7 (đợt A, 11/09/2026) — báo cho BAN LÃNH ĐẠO KIỂM SOÁT khi một mục đã `Đã duyệt` bị SỬA và hạ
 * về `Chờ duyệt`.
 *
 * Lỗ cũ (điểm bất hợp lý số 10): `works/service.js` và `workItems/service.js` đều hạ trạng thái và
 * ghi `submitted_by`, nhưng **không báo ai**. Mục lặng lẽ quay về hàng chờ; người duyệt chỉ biết khi
 * tự mở hộp chờ. Nay có thông báo, và người nhận là `supervisor_ids` CỦA CHÍNH DÒNG đó (D3) — không
 * phải mọi Phó Giám đốc của phòng, vì R1(a) đã bó quyền duyệt vào đúng danh sách này: báo cho người
 * không duyệt được là tạo một dòng «đang chờ BẠN duyệt» sai sự thật.
 *
 * Không báo cho chính người sửa: họ vừa bấm Lưu, không cần ai nhắc. Trùng id bị loại để một người
 * có tên hai lần trong `supervisor_ids` chỉ nhận một thông báo.
 *
 * Ghi TRONG cùng giao dịch với lượt hạ trạng thái (chỗ gọi truyền `client`): tách ra ngoài thì một
 * lỗi giữa chừng để lại mục đã hạ về chờ duyệt mà không ai được báo — đúng cái lỗ hàm này sinh ra để bịt.
 *
 * KHÔNG `async`: hàm chỉ dựng mảng rồi trả promise của `insertMany`, không `await` gì — cùng khuôn
 * `notifyChange` ngay trên. Gắn `async` vào một hàm không `await` là eslint bắt lỗi `require-await`.
 *
 * @param {object} row dòng ĐÃ LƯU (cần `id`, `code`, `name`, `supervisor_ids`)
 * @param {object} user người vừa sửa
 * @param {'work'|'work_item'} refType loại dòng, để bấm thông báo mở đúng chỗ
 * @param {string} nhan «Công việc» / «Công việc con» / «Nhiệm vụ»
 * @returns {Promise<Array>} các dòng thông báo đã ghi (rỗng khi không có ai để báo)
 */
export function baoKhiHaVeChoDuyet(row, user, refType, nhan, client) {
  const nguoiNhan = [
    ...new Set((row?.supervisor_ids ?? []).map(Number).filter(Number.isFinite)),
  ].filter((id) => String(id) !== String(user?.id));
  if (nguoiNhan.length === 0) return [];
  const ten = String(row?.name ?? '').trim();
  return notifications.insertMany(
    nguoiNhan.map((id) => ({
      userId: id,
      type: notifications.LOAI.CHO_DUYET,
      content:
        `${nhan} ${row.code}${ten ? ` — ${ten}` : ''} vừa bị sửa và QUAY LẠI trạng thái chờ bạn duyệt ` +
        `(người sửa: ${user?.full_name ?? user?.code ?? ''}).`,
      refType,
      refId: row.id,
    })),
    client
  );
}
/** Q2: một dòng approval_changes giữ giá trị đề nghị; work_items chưa đổi đến khi duyệt. */
export async function proposeGuiBld(user, before, after, value, client) {
  assertChangeActor(user, before);
  if (typeof value !== 'boolean')
    throw new AppError('VALIDATION_ERROR', 'Tích Gửi BLĐ phải là đúng hoặc sai');
  if (Number(before.level) !== 3)
    throw new AppError('VALIDATION_ERROR', 'Chỉ nhiệm vụ có tích Gửi BLĐ');
  if (value === before.gui_bld_phe_duyet) return { pending: false, value };
  await assignments.assertGuiBld({ ...after, gui_bld_phe_duyet: value }, {}, client);
  const old = (
    await client.query(
      'SELECT id FROM approval_changes WHERE item_id=$1 AND approved_at IS NULL FOR UPDATE',
      [before.id]
    )
  ).rows[0];
  if (old)
    throw conflict(
      'Đã có một lượt thay đổi đang chờ duyệt của nhiệm vụ này — hãy xử lý lượt đó trước'
    );
  const config = await settings.read(client);
  const phaiCho =
    giaTriHieuLuc(user, 'task', 'gui-bld') === 'cho-duyet' ||
    (['Trưởng phòng', 'Phó phòng'].includes(user.role) && config.guiBldChangeRequiresApproval);
  if (!phaiCho) return { pending: false, value };
  const supervisorId = await supervisorOf(after, client);
  if (supervisorId == null)
    throw new AppError(
      'VALIDATION_ERROR',
      'Nhiệm vụ chưa có Ban lãnh đạo phụ trách để gửi phê duyệt'
    );
  await assignments.assertSupervisor(supervisorId, after.department_id, client);
  const change = {
    field: 'gui_bld_phe_duyet',
    label: LABELS.gui_bld_phe_duyet,
    from: before.gui_bld_phe_duyet ? 'Bật' : 'Tắt',
    to: value ? 'Bật' : 'Tắt',
    valueFrom: before.gui_bld_phe_duyet,
    valueTo: value,
    supervisorId,
    assigneeId: after.assignee_id,
    parentId: after.parent_id,
  };
  const rec = (
    await client.query(
      `INSERT INTO approval_changes(work_id,item_id,recipient_id,editor_id,entity_code,entity_name,changes,change_kind)
    VALUES($1,$2,$3,$3,$4,$5,$6::jsonb,'gui-bld') RETURNING id`,
      [after.work_id, before.id, user.id, before.code, after.name, JSON.stringify([change])]
    )
  ).rows[0];
  // Người được đề nghị không tự duyệt: nếu chính supervisor xin đổi với ⏳, Giám đốc xử lý.
  const recipients =
    String(supervisorId) === String(user.id)
      ? (await client.query("SELECT id FROM users WHERE role='admin' AND is_active")).rows.map(
          (u) => u.id
        )
      : [supervisorId];
  if (!recipients.length) throw conflict('Chưa có người duyệt độc lập cho đề nghị này');
  for (const id of recipients)
    await notifyChange(
      id,
      `Nhiệm vụ "${after.name}": ${user.full_name} đề nghị ${value ? 'bật' : 'tắt'} Gửi BLĐ phê duyệt. Giá trị hiện tại chưa đổi.`,
      after,
      notifications.LOAI.CHO_DUYET,
      client
    );
  return { id: rec.id, pending: true, value: before.gui_bld_phe_duyet };
}
/**
 * `can(user,'approve','task',row)` nhưng CHẤP admin khi lý do từ chối chỉ là `NOT_APPROVER`.
 *
 * Vì sao có ngoại lệ này: R1(a) khoá «chỉ người TRONG `supervisor_ids` mới duyệt được, không chừa
 * admin làm dự phòng» — nhưng câu đó nói về trục DUYỆT CÂY (`approval_status`, `assertCan` trong
 * `approvals/service.js`). Ở đây là trục `approval_changes` (đề nghị đổi tích Gửi BLĐ), luật riêng
 * đã có từ 023: «admin hoặc đúng Phó GĐ đang kiểm soát, và KHÔNG phải người đề nghị», và
 * `proposeGuiBld` bên trên đã chủ động gửi thông báo tới MỌI admin khi chính supervisor tự đề nghị
 * cho mình. Nếu admin cũng bị `NOT_APPROVER` gạt thì đề nghị đó KHÔNG AI xử lý được — đúng cái
 * «tắc vĩnh viễn, không ai gỡ» mà bản chốt R1(a) dặn phải chừa đường thoát. admin ở đây không
 * duyệt thay cây của ai, chỉ gỡ thế kẹt xung đột lợi ích.
 */
export function coTheQuyet(user, entityType, row) {
  const verdict = can(user, 'approve', entityType, row);
  return verdict.ok || (user.role === 'admin' && verdict.code === 'NOT_APPROVER');
}
function canDecideChange(user, row, proposal) {
  return (
    String(user.id) !== String(proposal.editor_id) &&
    (user.role === 'admin' ||
      (user.role === 'Phó Giám đốc' && String(user.id) === String(row.supervisor_hieu_luc))) &&
    coTheQuyet(user, 'task', row)
  );
}
export async function pendingGuiBld(user, client = null) {
  const db = client ?? pool;
  const { rows } = await db.query(`SELECT c.id,c.editor_id,c.recipient_id,c.changes,c.entity_name,
    i.*, c.id AS change_id, w.name AS work_name,u.full_name AS requester_name,
    ${itemsRepo.sqlSupervisorHieuLuc('i.')} AS supervisor_hieu_luc
    FROM approval_changes c JOIN work_items i ON i.id=c.item_id JOIN works w ON w.id=i.work_id
    LEFT JOIN work_items p ON p.id=i.parent_id LEFT JOIN users u ON u.id=c.editor_id
    WHERE c.change_kind='gui-bld' AND c.approved_at IS NULL ORDER BY c.id`);
  return rows
    .filter((row) => canDecideChange(user, row, row))
    .map((row) => ({
      kind: 'gui-bld',
      id: row.change_id,
      code: row.code,
      name: row.name,
      level: 3,
      department_id: row.department_id,
      created_by_name: row.requester_name,
      work_name: row.work_name,
      change: row.changes[0],
    }));
}
/**
 * `change_kind` của MỘT dòng đề nghị — để `routes.js` rẽ đúng hàm xử lý.
 *
 * Vì sao không đặt luôn một `decideChange()` ở đây: hàm quyết đề nghị tỷ lệ nằm bên `tyLe.js`, mà
 * `tyLe.js` lại import `coTheQuyet`/`freshActor`/`supervisorOf` TỪ file này. Gọi chéo nhau là thành
 * vòng import. `routes.js` đứng trên cả hai nên nó rẽ nhánh, và đường URL thì không đổi
 * (`POST /approvals/changes/:id/approve|reject`) — giao diện cũ vẫn dùng được y nguyên.
 */
export async function kindOfChange(id) {
  const { rows } = await pool.query('SELECT change_kind FROM approval_changes WHERE id = $1', [id]);
  return rows[0]?.change_kind ?? null;
}
export function decideGuiBld(user, id, approve, reason = '') {
  return withTransaction(async (client) => {
    const found = (
      await client.query("SELECT * FROM approval_changes WHERE id=$1 AND change_kind='gui-bld'", [
        id,
      ])
    ).rows[0];
    if (!found) throw notFound();
    await client.query('SELECT id FROM works WHERE id=$1 FOR UPDATE', [found.work_id]);
    await itemsRepo.lockById(found.item_id, client);
    const record = (
      await client.query('SELECT * FROM approval_changes WHERE id=$1 FOR UPDATE', [id])
    ).rows[0];
    if (!record || record.approved_at != null) throw conflict('Đề nghị này đã được xử lý');
    const row = await itemsRepo.findByRefWithWork(found.item_id, client);
    if (!row) throw notFound();
    if (!canDecideChange(user, row, record))
      throw forbidden(
        'Chỉ Ban lãnh đạo phụ trách hoặc Giám đốc có quyền duyệt độc lập đề nghị này'
      );
    const change = record.changes[0];
    if (approve) {
      const actor = await freshActor(record.editor_id, client);
      assertChangeActor(actor, row);
      if (!can(actor, 'update', 'task', row).ok)
        throw forbidden('Quyền sửa của người đề nghị đã bị thu hồi');
      if (
        row.gui_bld_phe_duyet !== change.valueFrom ||
        String(row.supervisor_hieu_luc) !== String(change.supervisorId) ||
        String(row.assignee_id) !== String(change.assigneeId) ||
        String(row.parent_id) !== String(change.parentId)
      ) {
        throw conflict('Phân công hoặc tích hiện tại đã thay đổi — hãy từ chối và lập đề nghị mới');
      }
      await assignments.assertGuiBld({ ...row, gui_bld_phe_duyet: change.valueTo }, {}, client);
      await itemsRepo.update(row.id, { gui_bld_phe_duyet: change.valueTo }, client);
    } else if (String(reason).trim().length < 10)
      throw new AppError('VALIDATION_ERROR', 'Lý do từ chối cần ít nhất 10 ký tự');
    await client.query('UPDATE approval_changes SET approved_at=now(), decision=$2 WHERE id=$1', [
      record.id,
      approve ? 'approved' : 'rejected',
    ]);
    await notifyChange(
      record.recipient_id,
      `Đề nghị đổi Gửi BLĐ của nhiệm vụ "${row.name}" đã ${approve ? 'được duyệt' : 'bị từ chối'}.${reason ? ' ' + reason : ''}`,
      row,
      approve ? notifications.LOAI.DA_DUYET : notifications.LOAI.TU_CHOI,
      client
    );
    return { id: record.id, approved: approve, item: await itemsRepo.findById(row.id, client) };
  });
}

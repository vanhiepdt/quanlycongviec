// Truy vấn bảng `proposals` (Đề nghị — §2.7 nhóm G, §7 việc 7.1). SQL viết tay, tham số hoá 100%.
//
// Mã mới sinh bằng `next_code('DN', 'seq_proposal_code')`, cùng lý do với `works`: hai người bấm
// Tạo cùng lúc mà đọc "mã lớn nhất rồi +1" thì ra hai `DN006` (bẫy §13.5).
//
// `work_id` / `work_item_id` là FK `ON DELETE SET NULL` (001_init.sql). Đó là hợp đồng của
// TC-MISC-04: xoá công việc thì đề nghị PHẢI còn, chỉ mất liên kết — nên ở đây không có chỗ nào
// xoá theo công việc, và cũng không được thêm.
import { pool } from '../../db/pool.js';
import { buildInsert, buildUpdateSet, refToColumn } from '../../utils/sql.js';

const db = (client) => client ?? pool;

const COLUMNS = `id, code, type, work_id, work_item_id, content, url, supplier,
                 creator_id, creator_name, proposal_date, status, review_note,
                 created_at, updated_at`;

/**
 * Cột đọc kèm phạm vi của công việc gắn với đề nghị.
 *
 * Phải LEFT JOIN chứ không JOIN: đề nghị mua sắm chung của phòng không gắn công việc nào
 * (`DN005` trong dữ liệu mẫu), JOIN thường là mất hẳn dòng đó khỏi danh sách.
 *
 * `w_*` / `u_*` là khoá phạm vi cho `can()` — xem `scopeRowOf` ở service.
 */
const COLUMNS_SCOPE = `p.id, p.code, p.type, p.work_id, p.work_item_id, p.content, p.url,
                       p.supplier, p.creator_id, p.creator_name, p.proposal_date, p.status,
                       p.review_note, p.created_at, p.updated_at,
                       w.code AS work_code, w.department_id AS work_department_id,
                       w.manager_id AS work_manager_id,
                       i.code AS item_code, i.assignee_id AS item_assignee_id,
                       cu.department_id AS creator_department_id`;

const FROM_SCOPE = `FROM proposals p
                    LEFT JOIN works      w  ON w.id  = p.work_id
                    LEFT JOIN work_items i  ON i.id  = p.work_item_id
                    LEFT JOIN users      cu ON cu.id = p.creator_id`;

/** Cột được phép ghi. Tên cột chỉ đến từ đây, không bao giờ từ `req.body`. */
export const WRITABLE = Object.freeze([
  'type',
  'work_id',
  'work_item_id',
  'content',
  'url',
  'supplier',
  'creator_id',
  'creator_name',
  'proposal_date',
  'status',
  'review_note',
]);

/** 4 trạng thái của CHECK `proposals_status_check` — thứ tự đúng như 4 thẻ đếm trên giao diện (G3). */
export const TRANG_THAI = Object.freeze(['Đề xuất mới', 'Chờ duyệt', 'Đã duyệt', 'Từ chối']);

/** 2 loại của CHECK `proposals_type_check` (G4). */
export const LOAI = Object.freeze(['Trong kế hoạch', 'Ngoài kế hoạch']);

/** Mã đề nghị kế tiếp: `DN001`, `DN002`... */
export async function nextProposalCode(client = null) {
  const { rows } = await db(client).query(`SELECT next_code('DN', 'seq_proposal_code') AS code`);
  return rows[0].code;
}

export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM proposals WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Dò theo id số HOẶC mã (`DN001`) — giao diện cũ chỉ có mã trong tay. */
export async function findByRef(ref, client = null) {
  const { column, value } = refToColumn(ref);
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS_SCOPE} ${FROM_SCOPE} WHERE p.${column} = $1`,
    [value]
  );
  return rows[0] ?? null;
}

/** Khoá dòng để hai request cùng sửa không chen nhau (chỉ dùng trong giao dịch). */
export async function lockById(id, client) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM proposals WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Danh sách đề nghị kèm khoá phạm vi.
 *
 * Tìm kiếm (G6) làm ở SQL bằng `ILIKE` trên nội dung / mã / nhà cung cấp / người đề nghị —
 * `unaccent` chưa cài trong 001_init.sql nên không so dấu, đúng như hộp tìm của bản cũ vốn cũng
 * chỉ so chuỗi con. Dấu `%` và `_` người dùng gõ vào được ESCAPE, không thì gõ `%` là ra cả bảng.
 *
 * Sắp xếp: mới nhất trước (`id DESC`) — `renderProposals` bản cũ hiện danh sách theo thứ tự nhận
 * được và `addOptimisticUpdate` chèn dòng mới vào ĐẦU mảng (`unshift`), nên thứ tự này khớp với
 * chỗ dòng vừa tạo nhảy vào.
 */
export async function list(filter = {}, client = null) {
  const wheres = [];
  const values = [];
  if (filter.status) {
    values.push(filter.status);
    wheres.push(`p.status = $${values.length}`);
  }
  if (filter.type) {
    values.push(filter.type);
    wheres.push(`p.type = $${values.length}`);
  }
  if (filter.workId != null) {
    values.push(filter.workId);
    wheres.push(`p.work_id = $${values.length}`);
  }
  if (filter.q) {
    values.push(`%${escapeLike(filter.q)}%`);
    const p = `$${values.length}`;
    wheres.push(`(p.content ILIKE ${p} ESCAPE '\\'
                  OR p.code ILIKE ${p} ESCAPE '\\'
                  OR p.supplier ILIKE ${p} ESCAPE '\\'
                  OR p.creator_name ILIKE ${p} ESCAPE '\\')`);
  }
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS_SCOPE} ${FROM_SCOPE}
      ${wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''}
      ORDER BY p.id DESC`,
    values
  );
  return rows;
}

/** `%`, `_` và `\` trong chuỗi tìm kiếm là KÝ TỰ THƯỜNG, không phải ký tự đại diện. */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Tạo đề nghị. `code` để trống thì tự sinh. */
export async function insert(data, client = null) {
  const code = data.code ?? (await nextProposalCode(client));
  const { columns, values, params } = buildInsert(WRITABLE, data, { code });
  const { rows } = await db(client).query(
    `INSERT INTO proposals (${columns.join(', ')}) VALUES (${params.join(', ')})
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

/** Sửa. Không có cột nào trong `patch` ⇒ trả dòng hiện tại, không chạy UPDATE rỗng. */
export async function update(id, patch, client = null) {
  const { sets, values, nextIndex } = buildUpdateSet(WRITABLE, patch);
  if (sets.length === 0) return findById(id, client);
  values.push(id);
  const { rows } = await db(client).query(
    `UPDATE proposals SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $${nextIndex}
      RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function remove(id, client = null) {
  const { rows } = await db(client).query('DELETE FROM proposals WHERE id = $1 RETURNING code', [
    id,
  ]);
  return rows[0]?.code ?? null;
}

/** Số đếm theo trạng thái cho 4 thẻ (G3). Trả về đủ 4 khoá, trạng thái không có dòng nào = 0. */
export function demTheoTrangThai(rows) {
  const dem = {};
  for (const st of TRANG_THAI) dem[st] = 0;
  for (const row of rows) {
    if (Object.hasOwn(dem, row.status)) dem[row.status] += 1;
  }
  return dem;
}

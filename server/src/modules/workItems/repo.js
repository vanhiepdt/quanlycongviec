// Truy vấn bảng `work_items` — MỘT bảng cho cả cấp 2 (Công việc con) và cấp 3 (Nhiệm vụ), phân
// biệt bằng cột `level` (§0.1, §4.1). Một service duy nhất phục vụ cả hai cấp (§7 việc 3.2):
// tách thành hai module là nhân đôi 20 cột giống nhau và nhân đôi cả chỗ để sai.
//
// SQL viết tay, tham số hoá 100%. Tên cột chỉ đến từ các danh sách trắng khai ở đây.
import { pool } from '../../db/pool.js';
import { buildInsert, buildUpdateSet, refToColumn } from '../../utils/sql.js';

const db = (client) => client ?? pool;

export const LEVEL_SUBWORK = 2;
export const LEVEL_TASK = 3;

const COLUMNS = `id, code, work_id, parent_id, level, name, description,
                 assignee_id, assignee_name, status, priority,
                 start_date, due_date, report_date, completion,
                 target, output, notes, result_links,
                 approval_status, approver_id, approved_at, reject_reason,
                 sort_order, created_by, created_at, updated_at`;

/**
 * Cột nghiệp vụ được phép ghi tự do. KHÔNG có `work_id`, `parent_id`, `level`, `code`: ba cột đầu
 * là cấu trúc cây (đổi chúng phải đi qua đúng một đường có kiểm tra ở service), còn `code` do
 * máy chủ sinh và không bao giờ đổi (§13.4 mục 6 — chuyển công việc thì GIỮ NGUYÊN mã).
 */
export const WRITABLE = Object.freeze([
  'name',
  'description',
  'assignee_id',
  'assignee_name',
  'status',
  'priority',
  'start_date',
  'due_date',
  'report_date',
  'completion',
  'target',
  'output',
  'notes',
  'result_links',
  'approval_status',
  'approver_id',
  'approved_at',
  'reject_reason',
  'sort_order',
]);

/** Cột cấu trúc — chỉ service cây được truyền, và luôn kèm kiểm tra trước đó. */
const STRUCTURAL = Object.freeze(['work_id', 'parent_id']);

/**
 * Mã dòng mới: `<mã công việc>-NNN`, số lấy từ sequence TOÀN HỆ THỐNG `seq_work_item_code`
 * (§13.4 mục 6). Không dùng mốc thời gian như `generateTaskIdForProject` bản cũ: 20 request
 * trong cùng một millisecond sinh ra 20 mã giống nhau (TC-TREE-31, bẫy §13.5).
 */
export async function nextItemCode(workCode, client = null) {
  const { rows } = await db(client).query(`SELECT next_code($1, 'seq_work_item_code') AS code`, [
    `${workCode}-`,
  ]);
  return rows[0].code;
}

export async function findById(id, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM work_items WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findByCode(code, client = null) {
  const { rows } = await db(client).query(`SELECT ${COLUMNS} FROM work_items WHERE code = $1`, [
    String(code ?? ''),
  ]);
  return rows[0] ?? null;
}

/** Dò theo id số HOẶC mã (`CV001-007`, mã cũ `ID2508...`) — xem `refToColumn`. */
export async function findByRef(ref, client = null) {
  const { column, value } = refToColumn(ref);
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM work_items WHERE ${column} = $1`,
    [value]
  );
  return rows[0] ?? null;
}

/** Khoá dòng trong giao dịch: chặn hai request cùng sửa cấu trúc cây của một dòng. */
export async function lockById(id, client) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM work_items WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Các dòng của một công việc. `level` để trống ⇒ trả CẢ cấp 2 và cấp 3 (bản cũ `getTasks` cũng
 * trả chung một mảng — đó là lý do thống kê bản cũ đếm cả công việc con thành nhiệm vụ, nên chỗ
 * nào cần đếm phải tự lọc `level = 3`, xem bẫy §13.5).
 */
export async function listByWork(workId, { level = null } = {}, client = null) {
  const values = [workId];
  let where = 'work_id = $1';
  if (level != null) {
    values.push(level);
    where += ` AND level = $${values.length}`;
  }
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM work_items WHERE ${where} ORDER BY level, sort_order, code`,
    values
  );
  return rows;
}

/** Con trực tiếp của một dòng, đúng thứ tự hiện trên giao diện. */
export async function listChildren(parentId, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS} FROM work_items WHERE parent_id = $1 ORDER BY sort_order, code`,
    [parentId]
  );
  return rows;
}

export async function countChildren(parentId, client = null) {
  const { rows } = await db(client).query(
    'SELECT count(*)::int AS n FROM work_items WHERE parent_id = $1',
    [parentId]
  );
  return rows[0].n;
}

/**
 * Toàn bộ con cháu của một dòng, đi từ trên xuống.
 *
 * `CYCLE id SET is_cycle USING path` (PostgreSQL 14+) là lớp chống treo: nếu dữ liệu đã trỏ vòng
 * sẵn (A là cha B, B là cha A — dữ liệu nhập từ bản cũ hoặc do ai đó tắt trigger), truy vấn đệ
 * quy trần sẽ chạy vô tận. Với CYCLE, Postgres tự dừng nhánh lặp lại và đánh dấu `is_cycle`
 * (TC-TREE-11: phải lỗi/trả kết quả trong dưới 1 giây, không treo). `depth < 50` là chốt thứ
 * hai, rẻ và không bao giờ chạm tới trong cây 3 tầng hợp lệ.
 */
export async function listDescendants(id, client = null) {
  const { rows } = await db(client).query(
    `WITH RECURSIVE sub AS (
       SELECT id, code, level, parent_id, sort_order, 1 AS depth
         FROM work_items WHERE parent_id = $1
       UNION ALL
       SELECT c.id, c.code, c.level, c.parent_id, c.sort_order, s.depth + 1
         FROM work_items c JOIN sub s ON c.parent_id = s.id
        WHERE s.depth < 50
     ) CYCLE id SET is_cycle USING path
     SELECT id, code, level, parent_id, sort_order, depth FROM sub
      WHERE NOT is_cycle
      ORDER BY depth, sort_order, id`,
    [id]
  );
  return rows;
}

/** Dòng `candidateId` có nằm trong cây con của `id` không (dùng để chặn CYCLE ở TC-TREE-10). */
export async function isDescendant(id, candidateId, client = null) {
  const rows = await listDescendants(id, client);
  return rows.some((r) => r.id === candidateId);
}

/** Số thứ tự lớn nhất đang dùng trong một công việc — để dòng mới xếp cuối. */
export async function maxSortOrder(workId, client = null) {
  const { rows } = await db(client).query(
    'SELECT coalesce(max(sort_order), 0)::int AS n FROM work_items WHERE work_id = $1',
    [workId]
  );
  return rows[0].n;
}

/** Tạo dòng mới. `code`, `work_id`, `level` là bắt buộc; `parent_id` tuỳ cấp. */
export async function insert(data, client = null) {
  const { columns, values, params } = buildInsert([...WRITABLE, 'created_by'], data, {
    code: data.code,
    work_id: data.work_id,
    level: data.level,
    parent_id: data.parent_id ?? null,
  });
  const { rows } = await db(client).query(
    `INSERT INTO work_items (${columns.join(', ')}) VALUES (${params.join(', ')})
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

/** Sửa cột nghiệp vụ. Cấu trúc cây (`work_id`, `parent_id`) chỉ đổi được qua `updateStructure`. */
export async function update(id, patch, client = null) {
  const { sets, values } = buildUpdateSet(WRITABLE, patch, 2);
  if (sets.length === 0) return findById(id, client);
  const { rows } = await db(client).query(
    `UPDATE work_items SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Đổi cấu trúc cây: gán cha mới và/hoặc chuyển sang công việc khác. Tách khỏi `update` để đọc
 * code là thấy ngay mọi chỗ động tới cây — và để trigger `trg_work_items_check_parent` là hàng
 * rào cuối cùng, không phải là thứ tình cờ chạy.
 */
export async function updateStructure(id, patch, client = null) {
  const { sets, values } = buildUpdateSet([...STRUCTURAL, ...WRITABLE], patch, 2);
  if (sets.length === 0) return findById(id, client);
  const { rows } = await db(client).query(
    `UPDATE work_items SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Xoá một dòng. Con cháu và nhắc việc đi theo bằng CASCADE của CSDL (§4.1) — service KHÔNG tự
 * xoá từng dòng: bản cũ `deleteTask` phải tự gom con cháu rồi lọc mảng, sót một nhánh là còn
 * nhiệm vụ mồ côi trỏ vào cha đã mất (§7 việc 3.5).
 */
export async function remove(id, client = null) {
  const { rowCount } = await db(client).query('DELETE FROM work_items WHERE id = $1', [id]);
  return rowCount;
}

/**
 * Nhân bản MỘT dòng. Cột reset đúng như `copyTask`/`copyProject` bản cũ: tiến độ 0, trạng thái
 * "Chưa bắt đầu", ngày báo cáo trống — bản sao là việc chưa làm.
 *
 * Khoá duyệt cũng reset về `Đã duyệt` (mặc định của cột, đúng như bản cũ `addTask` gán cho dòng
 * mới): bản sao KHÔNG được thừa hưởng `Từ chối` của bản gốc (sao xong đã bị từ chối sẵn), và
 * cũng không nên là `Chờ duyệt` vì mục đó bị loại khỏi mọi con số thống kê (§13.5) nên dòng vừa
 * tạo sẽ vô hình. Ghi ở §13.3.
 *
 * Nhắc việc KHÔNG được nhân bản: nhắc việc gắn với một mốc ngày cụ thể của bản gốc, sao chép
 * sang bản sao chỉ tạo ra thông báo sai ngày.
 */
export async function copyRow(
  sourceId,
  { code, workId, parentId, name = null, sortOrder = null, createdBy = null },
  client = null
) {
  const { rows } = await db(client).query(
    `INSERT INTO work_items (
       code, work_id, parent_id, level, name, description,
       assignee_id, assignee_name, status, priority,
       start_date, due_date, report_date, completion,
       target, output, notes, result_links,
       sort_order, created_by)
     SELECT $1, $2, $3, level, coalesce($4, name), description,
            assignee_id, assignee_name, 'Chưa bắt đầu', priority,
            start_date, due_date, NULL, 0,
            target, output, notes, result_links,
            coalesce($5, sort_order), $6
       FROM work_items WHERE id = $7
     RETURNING ${COLUMNS}`,
    [code, workId, parentId, name, sortOrder, createdBy, sourceId]
  );
  return rows[0] ?? null;
}

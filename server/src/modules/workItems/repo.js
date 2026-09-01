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

const COLUMNS = `id, code, work_id, parent_id, level, department_id,
                 supervisor_id, leader_ids,
                 name, description,
                 assignee_id, assignee_name, status, priority,
                 start_date, due_date, report_date, completion,
                 target, output, notes, result_links,
                 approval_status, approver_id, approved_at, reject_reason,
                 xoa_yeu_cau_boi, xoa_yeu_cau_luc, xoa_ly_do,
                 sort_order, created_by, created_by_name,
                 origin, assigned_by_id, assigned_by_name, assigned_at,
                 created_at, updated_at`;

/**
 * Cùng danh sách cột nhưng gắn tiền tố bảng (`c.id, c.code, …`). Chỉ dùng cho nhánh đệ quy của
 * truy vấn cây, nơi bắt buộc phải nói rõ cột thuộc bảng nào. Sinh từ `COLUMNS` chứ không viết lại
 * bằng tay: thêm cột mà quên sửa bản sao là lỗi im lặng — nhánh đệ quy trả thiếu cột.
 */
const prefix = (alias) =>
  COLUMNS.split(',')
    .map((c) => `${alias}.${c.trim()}`)
    .join(', ');

/**
 * Cột nghiệp vụ được phép ghi tự do. KHÔNG có `work_id`, `parent_id`, `level`, `code`: ba cột đầu
 * là cấu trúc cây (đổi chúng phải đi qua đúng một đường có kiểm tra ở service), còn `code` do
 * máy chủ sinh và không bao giờ đổi (§13.4 mục 6 — chuyển công việc thì GIỮ NGUYÊN mã).
 *
 * `department_id` cũng KHÔNG có ở đây: phòng của cấp 2/cấp 3 luôn khớp phòng của công việc cha
 * (§4.1, 002_work_items_department.sql). Đổi phòng thì đổi ở công việc cấp 1 rồi trigger lan
 * xuống; cho ghi trực tiếp ở đây chỉ mở đường cho dữ liệu lệch.
 */
export const WRITABLE = Object.freeze([
  'name',
  'description',
  'assignee_id',
  'assignee_name',
  // Phân công ba lớp (005_phan_cong.sql): Ban lãnh đạo kiểm soát chỉ ở cấp 2; "Lãnh đạo phòng
  // phụ trách" ở cấp 2 là mảng nhiều người, cấp 3 tối đa một người (CHECK `task_leader_single`).
  // Nguồn hợp lệ kiểm ở service — cấp 3 gửi supervisor khác rỗng sẽ bị chặn ngay tại đó.
  'supervisor_id',
  'leader_ids',
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
  // Ba cột yêu cầu xoá (013) — xem chú thích cùng chỗ ở `works/repo.js`.
  'xoa_yeu_cau_boi',
  'xoa_yeu_cau_luc',
  'xoa_ly_do',
  'sort_order',
]);

/** Cột cấu trúc — chỉ service cây được truyền, và luôn kèm kiểm tra trước đó. */
const STRUCTURAL = Object.freeze(['work_id', 'parent_id']);

/**
 * Nguồn gốc việc (003_work_origin_and_history.sql): ai lập dòng này, tự đăng ký hay được giao, và
 * ai giao LẦN ĐẦU. Chỉ ghi được lúc TẠO — trigger `keep_first_origin` trả lại giá trị cũ khi
 * UPDATE, nên cố ý KHÔNG nằm trong `WRITABLE` lẫn `STRUCTURAL`: giao lại việc cho người khác thì
 * `assignee_id` đổi, còn "ai giao đầu tiên" thì không.
 */
export const ORIGIN_COLUMNS = Object.freeze([
  'created_by',
  'created_by_name',
  'origin',
  'assigned_by_id',
  'assigned_by_name',
  'assigned_at',
]);

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
 * Dòng kèm thông tin công việc cha trong MỘT truy vấn: phòng và người quản lý để `can()` xét
 * phạm vi (§6), khoảng ngày để cảnh báo ngày ngoài khoảng (TC-TREE-34), mã công việc để sinh mã
 * dòng mới. Nếu tách thành hai lần đọc thì mỗi request ghi mất thêm một vòng CSDL.
 */
export async function findByRefWithWork(ref, client = null) {
  const { column, value } = refToColumn(ref);
  const { rows } = await db(client).query(
    `SELECT ${COLUMNS.split(',')
      .map((c) => `i.${c.trim()}`)
      .join(', ')},
            w.code AS work_code, w.department_id AS work_department_id,
            w.manager_id AS work_manager_id,
            w.start_date AS work_start_date, w.end_date AS work_end_date
       FROM work_items i JOIN works w ON w.id = i.work_id
      WHERE i.${column} = $1`,
    [value]
  );
  return rows[0] ?? null;
}

/**
 * Người này đã có dòng nào trong công việc đó chưa. Cờ `assigned_in_work` của `can()` cần nó để
 * quyết định Nhân viên có được tạo nhiệm vụ trong công việc này hay không (§6).
 */
export async function isAssignedInWork(workId, userId, client = null) {
  if (workId == null || userId == null) return false;
  const { rows } = await db(client).query(
    `SELECT EXISTS (
       SELECT 1 FROM work_items WHERE work_id = $1 AND assignee_id = $2
     ) AS yes`,
    [workId, userId]
  );
  return rows[0].yes === true;
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
 *
 * `id <> $1` loại chính dòng gốc: trong dữ liệu trỏ vòng (A cha B, B cha A) thì A là con cháu của
 * chính nó, và nếu để lọt thì `remove` báo "đã xoá 3 dòng" trong khi chỉ có 2, còn `copy` sao bản
 * gốc thêm một lần nữa.
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
      WHERE NOT is_cycle AND id <> $1
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

/**
 * Toàn bộ dòng của NHIỀU công việc, đi từ gốc xuống, dùng cho `GET /works/tree` (§7 việc 3.6).
 *
 * Gốc KHÔNG chỉ là `parent_id IS NULL`, mà là mọi dòng **không có cha dùng được**: cha để trống, cha
 * đã biến mất, cha không phải cấp 2, hoặc cha ở công việc khác. Nhờ vậy dòng có `parent_id` bẩn vẫn
 * đi vào cây (rồi `tree.js` gom vào nhóm `(chưa gán công việc con)`) thay vì không đường nào tới
 * được và mất hẳn khỏi giao diện — đúng lỗi của `getWorkTree` bản cũ (TC-TREE-24).
 *
 * Điều đó cũng cứu được dữ liệu trỏ VÒNG (A là cha B, B là cha A): cả hai đều "không có cha dùng
 * được" nên cả hai vào danh sách gốc. Chúng sẽ xuất hiện lần thứ hai ở nhánh đệ quy — `tree.js` bỏ
 * qua bản trùng bằng cách nhớ id đã xếp, và vì thứ tự là `depth` tăng dần, bản được giữ là bản gốc.
 *
 * Một truy vấn cho CẢ trang thay vì một truy vấn mỗi công việc: 200 công việc × 5 × 5 là 5.000 dòng
 * trong một lượt đi, không phải 201 lượt (TC-PERF-02, ngưỡng 600 ms).
 *
 * `CYCLE` và `depth < 50` cùng lý do như `listDescendants`: truy vấn đệ quy trần gặp vòng thì treo.
 */
export async function listForWorks(workIds, client = null) {
  if (!Array.isArray(workIds) || workIds.length === 0) return [];
  const { rows } = await db(client).query(
    `WITH RECURSIVE tree AS (
       SELECT ${COLUMNS}, 1 AS depth
         FROM work_items w
        WHERE w.work_id = ANY($1)
          AND (w.parent_id IS NULL
               OR NOT EXISTS (SELECT 1 FROM work_items p
                               WHERE p.id = w.parent_id
                                 AND p.level = ${LEVEL_SUBWORK}
                                 AND p.work_id = w.work_id))
       UNION ALL
       SELECT ${prefix('c')}, t.depth + 1
         FROM work_items c JOIN tree t ON c.parent_id = t.id
        WHERE t.depth < 50
     ) CYCLE id SET is_cycle USING path
     SELECT ${COLUMNS}, depth FROM tree WHERE NOT is_cycle
      ORDER BY depth, sort_order, code`,
    [workIds]
  );
  return rows;
}

/** Số thứ tự lớn nhất đang dùng trong một công việc — để dòng mới xếp cuối. */
export async function maxSortOrder(workId, client = null) {
  const { rows } = await db(client).query(
    'SELECT coalesce(max(sort_order), 0)::int AS n FROM work_items WHERE work_id = $1',
    [workId]
  );
  return rows[0].n;
}

/**
 * Tạo dòng mới. `code`, `work_id`, `level` là bắt buộc; `parent_id` tuỳ cấp.
 *
 * `department_id` truyền vào chỉ để CSDL đối chiếu: để trống thì trigger tự lấy phòng của công
 * việc cha, gửi phòng khác thì nổ 23514 → `DEPT_MISMATCH_WORK`.
 */
/**
 * `result_links` là cột **jsonb**, không phải `text[]`. Trình điều khiển `pg` biến mảng JS thành
 * chuỗi mảng Postgres (`{"a","b"}`) — jsonb không đọc được dạng đó và trả 22P02 «invalid input
 * syntax for type json», tới người dùng thành "Giá trị không đúng định dạng" mà không nói cột nào.
 * Vì vậy MỌI đường ghi phải đổi mảng thành chuỗi JSON trước khi truyền tham số.
 *
 * Bẫy này lọt qua cả Phase 3 vì không test nào gửi `resultLinks`; cầu RPC là chỗ đầu tiên gửi thật
 * (ô "Link kết quả" của giao diện cũ) nên nó nổ ở đây (§13.5).
 */
function toJsonbParams(row) {
  if (!Object.hasOwn(row, 'result_links') || row.result_links === undefined) return row;
  const links = row.result_links;
  // Chuỗi thì giữ nguyên (đã là JSON); mọi thứ khác đổi thành JSON — `null` thành mảng rỗng vì
  // cột là NOT NULL và CHECK `links_is_array` đòi mảng.
  return {
    ...row,
    result_links: typeof links === 'string' ? links : JSON.stringify(links ?? []),
  };
}

export async function insert(input, client = null) {
  const data = toJsonbParams(input);
  const { columns, values, params } = buildInsert([...WRITABLE, ...ORIGIN_COLUMNS], data, {
    code: data.code,
    work_id: data.work_id,
    level: data.level,
    parent_id: data.parent_id ?? null,
    department_id: data.department_id ?? null,
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
  const { sets, values } = buildUpdateSet(WRITABLE, toJsonbParams(patch), 2);
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
  const { sets, values } = buildUpdateSet([...STRUCTURAL, ...WRITABLE], toJsonbParams(patch), 2);
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
 * Khoá duyệt KHÔNG copy từ bản gốc mà do người gọi truyền (`approvalStatus`, mặc định `Đã duyệt`
 * cho đường gọi cũ chưa truyền). Hai lý do: bản sao không được thừa hưởng `Từ chối` của bản gốc
 * (sao xong đã bị từ chối sẵn), và bản sao là đầu việc MỚI nên phải qua đúng cửa duyệt của người
 * bấm Nhân bản (§7 việc 5.1) — nếu không thì nhân bản là một đường vòng qua luồng duyệt. Ghi ở
 * §13.3.
 *
 * Nhắc việc KHÔNG được nhân bản: nhắc việc gắn với một mốc ngày cụ thể của bản gốc, sao chép
 * sang bản sao chỉ tạo ra thông báo sai ngày.
 *
 * Nguồn gốc cũng KHÔNG copy — bản sao là đầu việc mới của người bấm Nhân bản (§2.3). Truyền qua
 * `origin` (do `deriveOrigin` tính); không truyền thì mặc định "Tự đăng ký".
 */
export async function copyRow(
  sourceId,
  { code, workId, parentId, name = null, sortOrder = null, approvalStatus = 'Đã duyệt', ...origin },
  client = null
) {
  const o = {
    created_by: null,
    created_by_name: '',
    origin: 'Tự đăng ký',
    assigned_by_id: null,
    assigned_by_name: '',
    assigned_at: null,
    ...origin,
  };
  const { rows } = await db(client).query(
    `INSERT INTO work_items (
       code, work_id, parent_id, level, name, description,
       assignee_id, assignee_name, status, priority,
       start_date, due_date, report_date, completion,
       target, output, notes, result_links,
       approval_status, sort_order,
       created_by, created_by_name, origin, assigned_by_id, assigned_by_name, assigned_at)
     SELECT $1, $2, $3, level, coalesce($4, name), description,
            assignee_id, assignee_name, 'Chưa bắt đầu', priority,
            start_date, due_date, NULL, 0,
            target, output, notes, result_links,
            $5, coalesce($6, sort_order),
            $7, $8, $9, $10, $11, $12
       FROM work_items WHERE id = $13
     RETURNING ${COLUMNS}`,
    [
      code,
      workId,
      parentId,
      name,
      approvalStatus,
      sortOrder,
      o.created_by,
      o.created_by_name,
      o.origin,
      o.assigned_by_id,
      o.assigned_by_name,
      o.assigned_at,
      sourceId,
    ]
  );
  return rows[0] ?? null;
}

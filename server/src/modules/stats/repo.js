// Thống kê — truy vấn (§7 Phase 6, việc 6.1–6.5).
//
// MỌI con số thống kê / biểu đồ / Gantt ĐẾM được phải đọc qua hai view `v_countable_works` /
// `v_countable_items` (việc 5.4) — điều kiện «loại Chờ duyệt» nằm trong view, KHÔNG viết lại
// rải rác ở đây. Test EXPLAIN (`countable-views.test.js`) soi chính các hằng truy vấn dưới đây,
// nên câu nào đếm mà thoát khỏi view sẽ bị bắt.
//
// Việc JOIN `v_countable_works` vào `v_countable_items`: một dòng item đã qua cửa duyệt của cả
// nhánh trên nó là chắc chắn nhờ view, nhưng JOIN mang theo `manager_id` của công việc cha để
// `can()` xét phạm vi «Quản lý công việc» mà không cần truy vấn thứ hai.
import { pool } from '../../db/pool.js';
import { DIEU_KIEN_LOAI_DONG_RAC } from '../activityLogs/repo.js';

/**
 * Hai câu SELECT gốc của thống kê. Chỉ SELECT cột cần tính + cột phạm vi (`can()` đọc):
 * `department_id`, `manager_id` / `work_manager_id`, `created_by`, `assignee_id`.
 */
export const QUERIES = Object.freeze({
  works: `SELECT w.id, w.code, w.name, w.department_id, w.manager_id, w.created_by,
                 w.status, w.start_date, w.end_date,
                 w.supervisor_id, w.leader_ids
            FROM v_countable_works w`,
  items: `SELECT i.id, i.code, i.work_id, i.parent_id, i.level, i.department_id,
                 i.name, i.assignee_id, i.assignee_name, i.status, i.priority,
                 i.start_date, i.due_date, i.report_date, i.completion,
                 i.leader_ids, i.output,
                 w.manager_id AS work_manager_id
            FROM v_countable_items i
            JOIN v_countable_works w ON w.id = i.work_id`,
});

async function run(sql) {
  const { rows } = await pool.query(sql);
  return rows;
}

/** Công việc cấp 1 ĐƯỢC ĐẾM (đã loại Chờ duyệt bởi view). */
export function listCountableWorks() {
  return run(QUERIES.works);
}

/** Công việc con + nhiệm vụ ĐƯỢC ĐẾM (kèm manager_id của công việc cha). */
export function listCountableItems() {
  return run(QUERIES.items);
}

/**
 * Hoạt động gần đây CÓ PHÂN TRANG (việc 6.3) — thay cho `listRecent` cố định 22 dòng của
 * bootstrap. Vai khác admin chỉ thấy nhật ký do chính mình ghi: cùng luật với `listRecent`
 * (`actorId`), vì nhật ký hệ thống là dữ liệu quản trị (§2.10).
 *
 * `COUNT(*)` chạy riêng để trả `total` cho thanh phân trang — bảng nhỏ, hai câu rẻ hơn window
 * function và dễ đọc hơn.
 */
export async function listActivitiesPaged({ limit, offset, actorId }) {
  const [rowsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT id, actor_id, actor_name, action, entity_type, entity_id, work_id, details, ip,
              created_at
         FROM activity_logs
        WHERE ($3::bigint IS NULL OR actor_id = $3)
        ${DIEU_KIEN_LOAI_DONG_RAC}
        ORDER BY id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset, actorId]
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM activity_logs
        WHERE ($1::bigint IS NULL OR actor_id = $1)
        ${DIEU_KIEN_LOAI_DONG_RAC}`,
      [actorId]
    ),
  ]);
  return { rows: rowsRes.rows, total: countRes.rows[0].total };
}

// Truy vấn phục vụ luồng duyệt (§7 việc 5.2, 5.3, 5.5). SQL viết tay, tham số hoá 100%.
//
// Ở đây CỐ Ý không có câu UPDATE nào: đổi khoá duyệt đi qua `worksRepo.update` /
// `workItemsRepo.update` — bốn cột `approval_status`, `approver_id`, `approved_at`,
// `reject_reason` đều nằm trong `WRITABLE` của cả hai repo. Viết thêm một câu UPDATE riêng ở đây
// là tạo đường ghi thứ hai vào cùng mấy cột đó, và đường nào cũng phải nhớ xoá `reject_reason` cũ.
//
// Phần còn lại là ĐẾM cho badge (việc 5.5). Đếm trên bảng gốc chứ KHÔNG qua `v_countable_*`:
// hai view đó có nhiệm vụ ngược lại — loại 'Chờ duyệt' ra khỏi thống kê (việc 5.4). Badge là chỗ
// duy nhất của hệ thống được phép nhìn thấy các dòng chờ duyệt.
import { pool } from '../../db/pool.js';
import { CHO_DUYET } from './rules.js';

const db = (client) => client ?? pool;

/**
 * Dựng mệnh đề phạm vi cho câu đếm.
 *
 * `all` ⇒ không giới hạn (admin). Ngược lại ghép OR giữa "thuộc phòng mình phụ trách/mình ở" và
 * "do chính mình lập" — Nhân viên không có phòng nào trong danh sách vẫn phải thấy được số việc
 * mình gửi đi đang chờ.
 *
 * Không có điều kiện nào ⇒ trả `null` để người gọi khỏi chạy truy vấn: mệnh đề rỗng mà nối vào
 * `WHERE` sẽ thành đếm TẤT CẢ, tức đúng ngược với ý định.
 */
function phamVi({ all, departmentIds, createdBy }, values) {
  if (all) return 'true';
  const parts = [];
  if (Array.isArray(departmentIds) && departmentIds.length > 0) {
    values.push(departmentIds);
    parts.push(`department_id = ANY($${values.length}::bigint[])`);
  }
  if (createdBy != null) {
    values.push(createdBy);
    parts.push(`created_by = $${values.length}`);
  }
  return parts.length > 0 ? `(${parts.join(' OR ')})` : null;
}

/**
 * Số mục đang 'Chờ duyệt' trong phạm vi của một người — con số của badge (việc 5.5).
 *
 * Một truy vấn cho cả hai bảng: badge được gọi lại sau MỖI lần duyệt (và nằm trong gói
 * `/bootstrap` của việc 5.10), nên hai vòng tới CSDL cho một con số là hai vòng thừa.
 *
 * Công việc con chờ duyệt nằm trong một công việc cũng đang chờ duyệt được tính CẢ HAI: badge trả
 * lời "còn bao nhiêu mục phải xử", không phải "còn bao nhiêu cây".
 *
 * @param {{all?: boolean, departmentIds?: number[], createdBy?: number|null}} scope
 * @returns {Promise<{works: number, items: number, total: number}>}
 */
export async function countPending(scope = {}, client = null) {
  const values = [CHO_DUYET];
  const where = phamVi(
    {
      all: scope.all === true,
      departmentIds: scope.departmentIds ?? [],
      createdBy: scope.createdBy ?? null,
    },
    values
  );
  if (!where) return { works: 0, items: 0, total: 0 };

  const { rows } = await db(client).query(
    `SELECT
       (SELECT count(*) FROM works      WHERE approval_status = $1 AND ${where})::int AS works,
       (SELECT count(*) FROM work_items WHERE approval_status = $1 AND ${where})::int AS items`,
    values
  );
  const { works, items } = rows[0];
  return { works, items, total: works + items };
}

/**
 * Danh sách mục đang chờ duyệt trong phạm vi của một người, mới nhất trước.
 *
 * Trả cả hai cấp trong MỘT kết quả (`kind` cho biết dòng đến từ bảng nào) để giao diện dựng được
 * một hộp "chờ bạn duyệt" duy nhất. Chặn trên ở 200 vì đây là hộp việc cần xử, không phải bảng
 * dữ liệu — quá con số này thì lọc theo phòng chứ không cuộn.
 */
export async function listPending(scope = {}, { limit = 50 } = {}, client = null) {
  const values = [CHO_DUYET];
  const where = phamVi(
    {
      all: scope.all === true,
      departmentIds: scope.departmentIds ?? [],
      createdBy: scope.createdBy ?? null,
    },
    values
  );
  if (!where) return [];
  values.push(Math.min(200, Math.max(1, Number(limit) || 50)));

  const { rows } = await db(client).query(
    `SELECT 'work' AS kind, id, code, name, 1 AS level, department_id,
            created_by, created_by_name, created_at
       FROM works WHERE approval_status = $1 AND ${where}
     UNION ALL
     SELECT 'item' AS kind, id, code, name, level, department_id,
            created_by, created_by_name, created_at
       FROM work_items WHERE approval_status = $1 AND ${where}
      ORDER BY created_at DESC, code
      LIMIT $${values.length}`,
    values
  );
  return rows;
}

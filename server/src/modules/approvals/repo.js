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
 *
 * `alias` là tiền tố bảng, cần cho câu có JOIN (012: nhánh `work_items` JOIN `works` để lấy tên
 * công việc cha ⇒ `department_id` trở thành nhập nhằng). Tiền tố phải gắn vào TỪNG cột, không gắn
 * vào cả mệnh đề — `i.(a OR b)` không phải SQL.
 */
function phamVi({ all, departmentIds, createdBy }, values, alias = '') {
  if (all) return 'true';
  const p = alias ? `${alias}.` : '';
  const parts = [];
  if (Array.isArray(departmentIds) && departmentIds.length > 0) {
    values.push(departmentIds);
    parts.push(`${p}department_id = ANY($${values.length}::bigint[])`);
  }
  if (createdBy != null) {
    values.push(createdBy);
    parts.push(`${p}created_by = $${values.length}`);
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
 * @returns {Promise<{works: number, items: number, deletes: number, total: number}>}
 */
export async function countPending(scope = {}, client = null) {
  const bo = {
    all: scope.all === true,
    departmentIds: scope.departmentIds ?? [],
    createdBy: scope.createdBy ?? null,
  };
  const values = [CHO_DUYET];
  const where = phamVi(bo, values);
  if (!where) return { works: 0, items: 0, deletes: 0, total: 0 };
  // Yêu cầu xoá (013) đếm bằng mệnh đề RIÊNG vì nó không lọc theo `approval_status` — cùng phạm vi,
  // khác điều kiện. Gọi `phamVi` lần thứ hai đẩy thêm tham số, nên thứ tự đẩy phải khớp thứ tự
  // xuất hiện trong câu.
  const whereXoa = phamVi(bo, values);

  const { rows } = await db(client).query(
    `SELECT
       (SELECT count(*) FROM works      WHERE approval_status = $1 AND ${where})::int AS works,
       (SELECT count(*) FROM work_items WHERE approval_status = $1 AND ${where})::int AS items,
       ((SELECT count(*) FROM works      WHERE xoa_yeu_cau_boi IS NOT NULL AND ${whereXoa})
      + (SELECT count(*) FROM work_items WHERE xoa_yeu_cau_boi IS NOT NULL AND ${whereXoa}))::int
        AS deletes`,
    values
  );
  const { works, items, deletes } = rows[0];
  // `total` gộp cả yêu cầu xoá: badge trả lời «còn bao nhiêu việc phải xử», và một yêu cầu xoá
  // đang treo đúng là một việc phải xử.
  return { works, items, deletes, total: works + items + deletes };
}

/**
 * Danh sách mục đang chờ duyệt trong phạm vi của một người, mới nhất trước.
 *
 * CHỈ TRẢ GỐC CÂY (012, Vòng 13 — yêu cầu người dùng «không hiển thị công việc, nhiệm vụ đấy ra
 * bên ngoài nữa»): một cây gửi duyệt một lần thì hộp chờ duyệt hiện MỘT dòng, người duyệt bấm
 * «Xem chi tiết» để đọc bên trong rồi ký một lần cho cả cây. Nên dòng cấp 2/3 nào có cha (công
 * việc cấp 1, hoặc công việc con) cũng đang chờ duyệt thì bị loại — nó không phải gốc.
 *
 * Badge (`countPending`) thì vẫn đếm ĐỦ mọi dòng: nó trả lời «còn bao nhiêu mục phải xử», khác
 * câu hỏi của danh sách này là «còn bao nhiêu việc phải bấm».
 *
 * `work_name` đi kèm để giao diện hiện tooltip «thuộc công việc …» cho dòng cấp 2/3 gửi lẻ (công
 * việc con tạo sau khi cha đã duyệt) — nếu không người duyệt thấy một cái tên trơ không rõ của ai.
 *
 * Trả cả hai cấp trong MỘT kết quả (`kind` cho biết dòng đến từ bảng nào) để giao diện dựng được
 * một hộp "chờ bạn duyệt" duy nhất. Chặn trên ở 200 vì đây là hộp việc cần xử, không phải bảng
 * dữ liệu — quá con số này thì lọc theo phòng chứ không cuộn.
 */
export async function listPending(scope = {}, { limit = 50 } = {}, client = null) {
  const bo = {
    all: scope.all === true,
    departmentIds: scope.departmentIds ?? [],
    createdBy: scope.createdBy ?? null,
  };
  const values = [CHO_DUYET];
  // Hai mệnh đề phạm vi riêng vì nhánh dưới có JOIN: cùng điều kiện, khác tiền tố bảng. Gọi hai
  // lần đẩy tham số hai lần — thứ tự đẩy phải khớp thứ tự xuất hiện trong câu, và `limit` đẩy CUỐI.
  const whereWorks = phamVi(bo, values);
  const whereItems = phamVi(bo, values, 'i');
  if (!whereWorks || !whereItems) return [];
  values.push(Math.min(200, Math.max(1, Number(limit) || 50)));

  const { rows } = await db(client).query(
    `SELECT 'work' AS kind, id, code, name, 1 AS level, department_id,
            created_by, created_by_name, created_at, name AS work_name
       FROM works WHERE approval_status = $1 AND ${whereWorks}
     UNION ALL
     SELECT 'item' AS kind, i.id, i.code, i.name, i.level, i.department_id,
            i.created_by, i.created_by_name, i.created_at, w.name AS work_name
       FROM work_items i
       JOIN works w ON w.id = i.work_id
      WHERE i.approval_status = $1 AND ${whereItems}
        -- Không phải gốc thì không hiện: cha cấp 1 đang chờ duyệt, hoặc công việc con cha đang chờ.
        AND w.approval_status <> $1
        AND NOT EXISTS (SELECT 1 FROM work_items p
                         WHERE p.id = i.parent_id AND p.approval_status = $1)
      ORDER BY created_at DESC, code
      LIMIT $${values.length}`,
    values
  );
  return rows;
}

/**
 * Danh sách YÊU CẦU XOÁ đang chờ duyệt trong phạm vi của một người (013), mới nhất trước.
 *
 * Khác `listPending` ở hai điểm, và cả hai đều có lý:
 *
 *  1. **Không lọc theo `approval_status`.** Mục xin xoá có thể đang ở bất kỳ trạng thái duyệt nào
 *     (Đã duyệt / Chờ duyệt / Nháp) — «xin xoá» là một chiều độc lập, xem đầu migration 013. Nên
 *     điều kiện duy nhất là `xoa_yeu_cau_boi IS NOT NULL`.
 *  2. **Không cần loại «không phải gốc».** `xinXoa` chỉ ghi cờ lên đúng dòng người dùng bấm và
 *     KHÔNG lan xuống con cháu, nên mỗi yêu cầu vốn đã là một dòng duy nhất. Không có cảnh một cây
 *     đọng lại N dòng như luồng duyệt nội dung.
 *
 * Trả kèm `xoa_ly_do` và tên người xin để giao diện dựng được dòng đầy đủ mà không phải gọi thêm.
 */
export async function listPendingDeletes(scope = {}, { limit = 50 } = {}, client = null) {
  const bo = {
    all: scope.all === true,
    departmentIds: scope.departmentIds ?? [],
    createdBy: scope.createdBy ?? null,
  };
  const values = [];
  // Cả HAI nhánh đều có JOIN (lấy tên người xin, và tên công việc cha) nên cả hai đều cần tiền tố
  // bảng — `department_id` xuất hiện ở hơn một bảng trong câu, không tiền tố là nhập nhằng. Mỗi
  // lời gọi `phamVi` đẩy thêm tham số nên thứ tự đẩy phải khớp thứ tự xuất hiện trong câu.
  const whereWorks = phamVi(bo, values, 'w');
  const whereItems = phamVi(bo, values, 'i');
  if (!whereWorks || !whereItems) return [];
  values.push(Math.min(200, Math.max(1, Number(limit) || 50)));

  const { rows } = await db(client).query(
    `SELECT 'work' AS kind, w.id, w.code, w.name, 1 AS level, w.department_id,
            w.approval_status, w.xoa_yeu_cau_boi, w.xoa_yeu_cau_luc, w.xoa_ly_do,
            u.full_name AS xoa_yeu_cau_ten, w.name AS work_name
       FROM works w
       LEFT JOIN users u ON u.id = w.xoa_yeu_cau_boi
      WHERE w.xoa_yeu_cau_boi IS NOT NULL AND ${whereWorks}
     UNION ALL
     SELECT 'item' AS kind, i.id, i.code, i.name, i.level, i.department_id,
            i.approval_status, i.xoa_yeu_cau_boi, i.xoa_yeu_cau_luc, i.xoa_ly_do,
            u.full_name AS xoa_yeu_cau_ten, w.name AS work_name
       FROM work_items i
       JOIN works w ON w.id = i.work_id
       LEFT JOIN users u ON u.id = i.xoa_yeu_cau_boi
      WHERE i.xoa_yeu_cau_boi IS NOT NULL AND ${whereItems}
      ORDER BY xoa_yeu_cau_luc DESC, code
      LIMIT $${values.length}`,
    values
  );
  return rows;
}

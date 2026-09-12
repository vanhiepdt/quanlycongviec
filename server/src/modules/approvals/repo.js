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
 * Hai bộ tên hành động của `activity_logs` dùng để suy ra cờ `da_sua` (MỚI-3, 2026-09-12).
 *
 * `DA_XU_LY` là MỐC «đầu việc này đã ra trước mặt người duyệt một lần». Chỉ hai hành động này:
 * `approvals.submit` không kể vì nó là lần gửi chứ không phải lần xem; `approvals.reject` không kể
 * vì từ 012 nó XOÁ HẲN dòng — dòng đã mất thì không bao giờ còn nằm trong danh sách chờ duyệt nữa.
 *
 * `SUA_NOI_DUNG` là những lần đổi nội dung làm cây bị hạ về «Chờ duyệt» (`phaiDuyetLai` của
 * `workItems/service.js`, `works/service.js`). Ba cái cố ý KHÔNG có trong danh sách:
 *  • `*.create` — nhiệm vụ thêm SAU vào cây đã duyệt là «mới tạo» một mình nó (R5), nếu kể create
 *    thì dòng nào cũng hoá ra «sửa»;
 *  • `*.copy` — bản sao là một đầu việc mới, có mã mới và cây duyệt riêng;
 *  • `workItems.reorder` — chỉ đánh lại `sort_order`, không hạ `approval_status`.
 * `*MonthName` thì CÓ kể: đổi tên theo tháng là đổi nội dung và cũng hạ cây về chờ duyệt.
 *
 * Sửa hai bộ này là sửa ĐỊNH NGHĨA «thế nào là bản sửa» của cả bảng chờ duyệt — phải sửa cùng chỗ
 * với nhãn action trong `works/routes.js`, `workItems/routes.js`, `approvals/routes.js`. Hai hằng
 * này `export` là để `tests/integration/approvals-pending-da-sua.test.js` ghim thời gian theo ĐÚNG
 * hai bộ đó thay vì chép lại một danh sách rồi lặng lẽ lệch.
 */
export const DA_XU_LY = Object.freeze(['approvals.approve', 'approvals.return']);
export const SUA_NOI_DUNG = Object.freeze([
  'works.update',
  'works.setMonthName',
  'works.clearMonthName',
  'subworks.update',
  'tasks.update',
  'workItems.setMonthName',
  'workItems.clearMonthName',
]);

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
 * `da_sua` (MỚI-3, 2026-09-12 — người dùng: «thêm cột thông tin về đây là duyệt công việc mới tạo,
 * hay sửa chữa/xóa») trả lời câu «dòng này là ĐẦU VIỆC MỚI hay là bản SỬA của thứ tôi đã xem rồi».
 * Không cột nào sẵn có trả lời được: `approver_id`/`approved_at` bị XOÁ TRẮNG khi hạ về «Chờ duyệt»
 * (`workItems/service.js` đặt cả hai về null), còn `submitted_by` ghi ở MỌI lần gửi nên không phân
 * biệt lần đầu với lần sau. Tín hiệu duy nhất còn lại là `activity_logs`: mốc là lần cây này ra
 * trước người duyệt (`DA_XU_LY`), và «sửa» là có lượt đổi nội dung (`SUA_NOI_DUNG`) SAU mốc đó.
 * `moc_xu_ly` trả kèm chính cái mốc ấy (null khi chưa từng ra người duyệt) để nút «Xem các thay
 * đổi» lọc popup ĐÚNG tập lượt sửa mà cờ `da_sua` đã xét — không phải giao diện tự đoán lại luật.
 *
 * HAI HỆ QUẢ có chủ đích, đều vì nút «Xem các thay đổi» KHÔNG BAO GIỜ được mở ra một popup rỗng:
 *  • Lượt sửa phải là của ĐÚNG dòng này. Dòng cấp 1 lấy cả cây vì duyệt cấp 1 là duyệt cả cây và
 *    popup của nó cũng gọi `/works/:id/history?scope=tree`; dòng cấp 2/3 gửi LẺ thì popup gọi
 *    `/work-items/:id/history` với `scope=self` mặc định, chỉ có nhật ký của riêng nó. Gắn nhãn
 *    «Sửa» cho một nhiệm vụ vì nhiệm vụ ANH EM cùng công việc vừa được sửa là hứa một điều mà
 *    popup không giữ được.
 *  • Bị «Trả lại để sửa» rồi gửi lại NGUYÊN TRẠNG ⇒ vẫn là «Mới tạo», dù người duyệt rõ ràng đã xem
 *    nó một lần. Không đổi nội dung thì không có gì để xem. Nếu muốn biết «đã ra người duyệt chưa»
 *    thì đọc `moc_xu_ly` — hai câu hỏi đó cố ý tách riêng.
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
  values.push(DA_XU_LY);
  const pMoc = values.length;
  values.push(SUA_NOI_DUNG);
  const pSua = values.length;
  values.push(Math.min(200, Math.max(1, Number(limit) || 50)));
  const pLimit = values.length;

  // BẪY: câu SQL dưới đây là template literal, nên chú thích `--` BÊN TRONG nó không được chứa
  // dấu backtick — một dấu backtick lẻ đóng sớm chuỗi và Node báo «missing ) after argument list»
  // ở một dòng trông hoàn toàn vô hại. Muốn nhấn mạnh tên cột hay tên hành động thì viết trần.
  // `$${pSua}` là đúng và là quy ước sẵn có của file này (xem `phamVi`): `$` literal + nội suy.
  const { rows } = await db(client).query(
    `WITH goc AS (
       SELECT 'work' AS kind, id, id AS work_id, code, name, 1 AS level, department_id,
              created_by, created_by_name, created_at, name AS work_name
         FROM works WHERE approval_status = $1 AND ${whereWorks}
       UNION ALL
       SELECT 'item' AS kind, i.id, i.work_id, i.code, i.name, i.level, i.department_id,
              i.created_by, i.created_by_name, i.created_at, w.name AS work_name
         FROM work_items i
         JOIN works w ON w.id = i.work_id
        WHERE i.approval_status = $1 AND ${whereItems}
          -- Không phải gốc thì không hiện: cha cấp 1 đang chờ duyệt, hoặc công việc con cha đang chờ.
          AND w.approval_status <> $1
          AND NOT EXISTS (SELECT 1 FROM work_items p
                           WHERE p.id = i.parent_id AND p.approval_status = $1)
     )
     SELECT g.kind, g.id, g.code, g.name, g.level, g.department_id,
            g.created_by, g.created_by_name, g.created_at, g.work_name,
            moc.moc_xu_ly,
            EXISTS (SELECT 1 FROM activity_logs s
                     WHERE s.work_id = g.work_id
                       AND s.action = ANY($${pSua}::text[])
                       -- Dòng cấp 1 duyệt CẢ CÂY nên mọi lượt sửa trong cây đều tính; dòng cấp 2/3
                       -- gửi LẺ thì chỉ kể lượt sửa của ĐÚNG nó, kẻo một nhiệm vụ vừa được sửa ở
                       -- nhánh khác gắn oan nhãn «Sửa» cho nhiệm vụ mới tinh cùng công việc. Ràng
                       -- entity_type chặn va chạm số giữa works.id và work_items.id.
                       AND (g.kind = 'work'
                            OR (s.entity_type IN ('subwork','task') AND s.entity_id = g.id))
                       AND s.created_at > moc.moc_xu_ly) AS da_sua
       FROM goc g
       -- Mốc lấy theo work_id vì approvals.approve / approvals.return chỉ ghi cho GỐC cây được
       -- bấm: nhiệm vụ duyệt theo cascade không có dòng nhật ký riêng. Ràng buộc m.created_at
       -- >= g.created_at là chỗ chặn ca R5 — nhiệm vụ thêm SAU vào cây đã duyệt không thể lấy
       -- lần duyệt cây (xảy ra trước cả khi nó tồn tại) làm mốc của chính nó.
       LEFT JOIN LATERAL (SELECT min(m.created_at) AS moc_xu_ly
                            FROM activity_logs m
                           WHERE m.work_id = g.work_id
                             AND m.action = ANY($${pMoc}::text[])
                             AND m.created_at >= g.created_at) moc ON true
      ORDER BY g.created_at DESC, g.code
      LIMIT $${pLimit}`,
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

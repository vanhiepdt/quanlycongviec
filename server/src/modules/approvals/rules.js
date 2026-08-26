// Luật trạng thái duyệt — nguồn sự thật DUY NHẤT của "mục này có phải chờ duyệt không"
// (§7 việc 5.1, §6, TC-APR-01..05).
//
// Vì sao là một module riêng chứ không viết thẳng vào `works/service.js`:
// cùng một luật phải áp cho CẢ hai đường tạo (cấp 1 ở `works`, cấp 2/cấp 3 ở `work_items`). Viết
// hai lần là hai chỗ để lệch, và chỗ lệch ở đây không nổ ra lỗi — nó chỉ lặng lẽ cho một mục
// chưa duyệt lọt vào thống kê. Đó đúng là kiểu hỏng mà cả Phase 5 đang phòng.
//
// Luật (§6 và §7 việc 5.1):
//   admin, Phó Giám đốc            ⇒ 'Đã duyệt' ngay (họ chính là người duyệt)
//   Trưởng phòng, Phó phòng        ⇒ 'Chờ duyệt' cho cấp 1 và cấp 2
//   Nhiệm vụ cấp 3                 ⇒ LUÔN 'Đã duyệt', không ai phải duyệt
//   các vai còn lại (Quản lý công việc, Nhân viên) ⇒ chỉ tạo được cấp 3 (§6), nên rơi vào dòng trên
//
// Cấp 3 không qua duyệt là quyết định nghiệp vụ, không phải bỏ sót: cửa duyệt đặt ở tầng "khối
// việc" (Công việc / Công việc con). Nhiệm vụ nằm dưới một khối chưa duyệt vẫn không được đếm —
// phần đó do `v_countable_items` lo (004_countable_views.sql), không phải do cột của chính nó.

/** Ba giá trị hợp lệ của cột `approval_status` (CHECK ở 001_init.sql). */
export const CHO_DUYET = 'Chờ duyệt';
export const DA_DUYET = 'Đã duyệt';
export const TU_CHOI = 'Từ chối';

/** Vai KHÔNG cần ai duyệt việc mình lập: chính họ là người có quyền duyệt (§6). */
const VAI_TU_DUYET = Object.freeze(['admin', 'Phó Giám đốc']);

/** Cấp 3 (Nhiệm vụ) không có bước duyệt. */
const LEVEL_TASK = 3;

/**
 * Trạng thái duyệt của một dòng MỚI TẠO.
 *
 * @param {object|null} user người đang tạo (đã chuẩn hoá, có `role`)
 * @param {number} level 1 = Công việc, 2 = Công việc con, 3 = Nhiệm vụ
 * @returns {'Chờ duyệt'|'Đã duyệt'}
 */
export function trangThaiDuyetKhiTao(user, level) {
  if (Number(level) === LEVEL_TASK) return DA_DUYET;
  if (user && VAI_TU_DUYET.includes(user.role)) return DA_DUYET;
  return CHO_DUYET;
}

/** Bốn cột chỉ luồng duyệt được ghi. Trùng đúng nhóm cột duyệt của `works` và `work_items`. */
const COT_KHOA_DUYET = Object.freeze([
  'approval_status',
  'approver_id',
  'approved_at',
  'reject_reason',
]);

/**
 * Người dùng KHÔNG được tự đặt khoá duyệt qua `POST`/`PATCH` — trạng thái duyệt chỉ đổi qua ba
 * hành động submit / approve / reject của việc 5.2, nơi có kiểm quyền và ghi người duyệt.
 *
 * Không kèm hàm này thì một Trưởng phòng chỉ cần gửi thêm `approvalStatus: 'Đã duyệt'` trong thân
 * request tạo là tự duyệt xong việc của mình — `WRITABLE` của cả hai repo đều có cột này.
 *
 * Xoá KHỎI dữ liệu vào chứ không trả 400: giao diện cũ gửi nguyên cả object dòng khi sửa, kể cả
 * các trường nó chỉ đọc chứ không đổi. Trả lỗi ở đây là chặn mọi thao tác sửa bình thường.
 *
 * @param {object} input dữ liệu đã đổi sang tên cột CSDL
 * @returns {object} bản sao không còn 4 cột khoá duyệt
 */
export function boCotKhoaDuyet(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([column]) => !COT_KHOA_DUYET.includes(column))
  );
}

/** Vai được sửa mục đang chờ duyệt dù không phải người lập: họ chính là người sẽ duyệt nó (§6). */
const VAI_SUA_MUC_CHO_DUYET = Object.freeze(['admin', 'Phó Giám đốc']);

/**
 * Mục đang 'Chờ duyệt' thì CHỈ người lập (và người có quyền duyệt) sửa được — §7 việc 5.6.
 *
 * Cả phòng vẫn **xem** được và vẫn thấy nhãn vàng; chỗ này chỉ chặn đường GHI. Lý do: mục chờ
 * duyệt là bản thảo đang trên bàn người duyệt. Để đồng nghiệp cùng phòng sửa được thì nội dung
 * người duyệt đọc lúc bấm nút có thể đã khác nội dung lúc gửi, mà không ai biết đã khác.
 *
 * Đây là lớp HẸP HƠN ma trận §6 chứ không nới thêm cho ai: người không qua được `can(update)` thì
 * đã bị chặn từ trước, hàm này chỉ chặn tiếp trong số những người đã qua.
 *
 * Trả về `{ok:true}` / `{ok:false, message}` thay vì tự ném lỗi, để nó vẫn là hàm thuần — cùng lý
 * do `can()` của rbac.js là hàm thuần.
 *
 * @param {object|null} user người đang sửa
 * @param {object} row dòng hiện tại trong CSDL (cần `approval_status`, `created_by`)
 */
export function coSuaDuocKhiChoDuyet(user, row) {
  if (!row || row.approval_status !== CHO_DUYET) return { ok: true };
  if (!user) return { ok: false, message: 'Bạn chưa đăng nhập' };
  if (VAI_SUA_MUC_CHO_DUYET.includes(user.role)) return { ok: true };
  // `created_by` rỗng ở dữ liệu nhập từ bản cũ (§13.8) — không có người lập thì không khoá được
  // theo người lập, để nguyên cho ma trận §6 quyết định.
  if (row.created_by == null) return { ok: true };
  if (Number(row.created_by) === Number(user.id)) return { ok: true };
  return {
    ok: false,
    message: 'Mục này đang chờ duyệt, chỉ người lập mới sửa được',
  };
}

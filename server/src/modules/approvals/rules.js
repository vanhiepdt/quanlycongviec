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

/** Bốn giá trị hợp lệ của cột `approval_status` (CHECK ở 001_init.sql, nới bởi 012). */
export const NHAP = 'Nháp';
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
export function trangThaiDuyetKhiTao(user, level, { luuNhap = false } = {}) {
  // «Lưu nháp» (012, Vòng 13) thắng MỌI luật khác: người lập chủ động nói «chưa gửi đi duyệt».
  // Đặt trước cả ghi đè vì ghi đè trả lời câu «việc này có phải chờ ai duyệt không», còn nháp
  // trả lời câu «đã gửi cho ai chưa» — hai câu khác nhau, nháp là câu đứng trước.
  if (luuNhap === true) return NHAP;
  // Ghi đè «Bảng phân quyền» (009): admin ép Tạo = ✓ (Đã duyệt ngay) hoặc ⏳ (Chờ duyệt) cho vai.
  // Giá trị ghi đè có thể là chuỗi (test thuần) hoặc { gia_tri, pham_vi } (session nạp từ 009/010).
  const entityType = Number(level) === 1 ? 'work' : Number(level) === 2 ? 'subwork' : 'task';
  const ghiDeTho = user && user.ghiDe ? user.ghiDe[entityType + ':create'] : null;
  const ghiDe = ghiDeTho && typeof ghiDeTho === 'object' ? ghiDeTho.gia_tri : ghiDeTho;
  if (ghiDe === 'cho-duyet') return CHO_DUYET;
  if (ghiDe === 'cho-phep') return DA_DUYET;
  if (Number(level) === LEVEL_TASK) return DA_DUYET;
  if (user && VAI_TU_DUYET.includes(user.role)) return DA_DUYET;
  return CHO_DUYET;
}

/**
 * Trạng thái sau khi SỬA với ghi đè «Chờ duyệt» (011): nếu vai người sửa có ghi đè update =
 * 'cho-duyet' và mục đang «Đã duyệt» ⇒ quay về «Chờ duyệt» chờ Phó GĐ duyệt lại — mở rộng luồng
 * choDuyetLai (trước đây chỉ TP/PP sửa cấp 2) lên MỌI vai bị ghi đè và mọi cấp.
 *
 * Mục đang «Chờ duyệt»/«Từ chối» giữ nguyên — luồng duyệt của việc 5.2 lo, không đụng vào.
 *
 * @param {object|null} user người đang sửa
 * @param {string} entityType 'work' | 'subwork' | 'task'
 * @param {string} trangThaiHienTai giá trị `approval_status` hiện tại của dòng
 * @returns {boolean} CÓ hạ về «Chờ duyệt» hay không
 */
export function phaiChoDuyetKhiSua(user, entityType, trangThaiHienTai) {
  if (trangThaiHienTai !== DA_DUYET) return false;
  const ghiDeTho = user && user.ghiDe ? user.ghiDe[entityType + ':update'] : null;
  const ghiDe = ghiDeTho && typeof ghiDeTho === 'object' ? ghiDeTho.gia_tri : ghiDeTho;
  return ghiDe === 'cho-duyet';
}

/**
 * Vai này có phải ĐI QUA YÊU CẦU XOÁ thay vì xoá trực tiếp? (ghi đè `delete = 'cho-duyet'`, 011)
 *
 * Tách riêng khỏi `xoaPhaiQuaDuyet` để client và server hỏi CÙNG một câu bằng cùng một hàm: giao
 * diện cần biết «có nên hiện nút Xin xoá» trước khi người dùng bấm, còn service cần biết «có được
 * xoá thẳng không» lúc ghi. Hai câu đó cùng một điều kiện — viết hai lần là hai chỗ để lệch.
 */
export function coXinXoaDuoc(user, entityType) {
  const ghiDeTho = user && user.ghiDe ? user.ghiDe[entityType + ':delete'] : null;
  const ghiDe = ghiDeTho && typeof ghiDeTho === 'object' ? ghiDeTho.gia_tri : ghiDeTho;
  return ghiDe === 'cho-duyet';
}

/**
 * Chặn xoá TRỰC TIẾP khi vai có ghi đè delete = 'cho-duyet' (011) — nhưng từ 013 KHÔNG còn là cửa
 * đóng: người dùng bấm «Xin xoá» để gửi yêu cầu, người có quyền duyệt xử.
 *
 * Trả `canXinXoa: true` để route/giao diện biết đây là «phải qua duyệt» chứ không phải «không có
 * quyền» — hai thứ khác nhau và câu chữ cho người dùng cũng khác. Trước 013 hàm này tên là
 * `xoaDuocKhongKhiChoDuyet` và câu thông báo nói «luồng duyệt yêu cầu xoá chưa có trên hệ thống»;
 * đổi tên vì cái tên cũ đọc như «có xoá được không», còn ý thật là «có phải qua duyệt không».
 *
 * @returns {{ok: true} | {ok: false, canXinXoa: true, message: string}}
 */
export function xoaPhaiQuaDuyet(user, entityType) {
  if (!coXinXoaDuoc(user, entityType)) return { ok: true };
  return {
    ok: false,
    canXinXoa: true,
    message:
      'Quản trị yêu cầu Xoá phải được duyệt — hãy bấm «Xin xoá» và nhập lý do để gửi yêu cầu cho người duyệt',
  };
}

/** Bốn cột chỉ luồng duyệt được ghi. Trùng đúng nhóm cột duyệt của `works` và `work_items`. */
/**
 * Cột chỉ luồng duyệt được ghi. Trùng đúng nhóm cột duyệt của `works` và `work_items`.
 *
 * Ba cột `xoa_*` (013) cũng ở đây: yêu cầu xoá chỉ ghi được qua `xinXoa`/`duyetXoa`/`tuChoiXoa`.
 * Không chặn thì thêm `xoaYeuCauBoi` vào thân request PATCH là tự gỡ yêu cầu xoá của mình, hoặc
 * đặt yêu cầu xoá cho người khác — đúng kiểu đường vòng mà `boCotKhoaDuyet` sinh ra để bịt.
 */
const COT_KHOA_DUYET = Object.freeze([
  'approval_status',
  'approver_id',
  'approved_at',
  'reject_reason',
  'xoa_yeu_cau_boi',
  'xoa_yeu_cau_luc',
  'xoa_ly_do',
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
  // Bản NHÁP (012): chỉ người lập và admin sửa được — kể cả Phó Giám đốc phụ trách cũng không,
  // vì nháp chưa gửi cho ai thì chưa ai có việc gì với nó. Chặt hơn nhánh «Chờ duyệt» bên dưới.
  if (row && row.approval_status === NHAP) {
    if (!user) return { ok: false, message: 'Bạn chưa đăng nhập' };
    if (user.role === 'admin') return { ok: true };
    if (row.created_by == null) return { ok: true };
    if (Number(row.created_by) === Number(user.id)) return { ok: true };
    return { ok: false, message: 'Đây là bản nháp của người khác, bạn không sửa được' };
  }
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

/**
 * Bản NHÁP có được LỌT vào danh sách của người này không (012, Vòng 13).
 *
 * Nguồn sự thật DUY NHẤT của câu «ai thấy nháp»: chỉ người lập và admin. Mọi đường đọc danh sách
 * phải gọi hàm này SAU `can(user,'read',…)` — `works/service.list`, `works/tree.getTree`,
 * `workItems/service.list`, `bootstrap/service`. Bỏ sót một đường là nháp rò ra cho cả phòng thấy,
 * và đó là kiểu lỗi im lặng: không ai báo lỗi, chỉ có dữ liệu chưa xong hiện ra chỗ không nên hiện.
 *
 * Khác `coSuaDuocKhiChoDuyet` ở chỗ: hàm kia canh đường GHI, hàm này canh đường ĐỌC. Phó Giám đốc
 * phụ trách phòng sửa được mục «Chờ duyệt» nhưng KHÔNG thấy bản nháp của người khác.
 *
 * Dòng không phải nháp ⇒ luôn `true`: hàm này không thay `can()`, chỉ bó thêm đúng trạng thái nháp.
 *
 * @param {object|null} user người đang đọc
 * @param {object} row dòng có `approval_status`, `created_by`
 */
export function thayDuocNhap(user, row) {
  if (!row || row.approval_status !== NHAP) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  // `created_by` rỗng ở dữ liệu nhập từ bản cũ (§13.8): không khoá được theo người lập thì thà
  // hiện — cùng cách xử lý với `coSuaDuocKhiChoDuyet`, và dữ liệu cũ không có dòng nháp nào.
  if (row.created_by == null) return true;
  return Number(row.created_by) === Number(user.id);
}

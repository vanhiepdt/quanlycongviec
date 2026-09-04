// Việc 4.6 — CHỐT KẾT QUẢ SOÁT XSS của `web/assets/js/app.js` thành test.
//
// Vì sao đây là test chứ không phải một bảng trong tài liệu: app.js dựng HTML bằng phép cộng chuỗi
// ở 70 chỗ với 474 giá trị nội suy. Soát tay xong hôm nay thì chỉ cần mai thêm một dòng
// `innerHTML +=` là lỗ hổng quay lại mà không ai hay. Test này gọi bộ soát tĩnh
// (`tests/helpers/xss-audit.js`) và đòi: mọi lỗ đều đã đi qua hàm thoát, TRỪ đúng những chỗ đã
// được ghi lý do dưới đây.
//
// Khi test này đỏ: KHÔNG sửa danh sách cho hết đỏ. Đọc dòng bị báo, bọc giá trị bằng đúng hàm cho
// ngữ cảnh của nó (escapeHtml / escapeForInlineHandler / escapeHtml(safeUrl(…))). Chỉ thêm vào
// danh sách khi chứng minh được giá trị KHÔNG do người dùng nhập, và phải ghi lý do.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { soatFile } from '../helpers/xss-audit.js';

const APP = resolve(process.cwd(), '../web/assets/js/app.js');
const { sites, sinks } = soatFile(APP);

/**
 * Những lỗ CỐ Ý không bọc, mỗi chỗ một lý do. `ma` là mã nguồn của lỗ, `ctx` là ngữ cảnh HTML.
 * Không ghi số dòng: số dòng đổi theo mọi lần sửa app.js, còn cặp (ngữ cảnh, mã) thì không.
 */
const CO_Y_KHONG_BOC = [
  // Cờ `selected`/`checked` do CHÍNH mã sinh ra ("selected" hoặc ""), không có dữ liệu người dùng.
  // Đây là chỗ trong thẻ mà không có dấu bao, nên nếu là dữ liệu ngoài thì cực nguy hiểm — vì vậy
  // phải nêu tên rõ ràng thay vì bỏ qua cả nhóm "trong-the". (2026-08-26: bỏ ô "Quản lý công việc"
  // khỏi form công việc nên mất 1 trong 3 chỗ cũ, còn 2.)
  { ctx: 'trong-the', ma: 'text3', so: 2, ly_do: 'cờ "selected" do mã sinh, không phải dữ liệu' },
  // Chỉ số của `.map()` — là SỐ, và nằm trong on* nhưng NGOÀI chuỗi JS: `onclick="f(" + i + ")"`.
  { ctx: 'handler-ngoai', ma: 'index', so: 4, ly_do: 'chỉ số .map(), là số nguyên do mã sinh' },
  // `const wrapRow = text => "<tr><td …>" + text + "</td></tr>"`. Cả 4 chỗ gọi đều truyền HTML
  // hằng (thông báo "không có dữ liệu"), nên bọc là hiện ra thẻ dưới dạng chữ.
  { ctx: 'text', ma: 'text', so: 1, ly_do: 'wrapRow: 4 chỗ gọi đều truyền HTML hằng' },
  // Việc 5.6 — nhãn vàng 'Chờ duyệt'. Hàm TRẢ VỀ HTML (thẻ <span>) chứ không trả dữ liệu, nên bọc
  // là hiện thẻ ra dưới dạng chữ. Nội dung nhãn là hằng số của chương trình và vẫn tự đi qua
  // escapeHtml/escapeHtmlAttr bên trong; `tests/unit/pending-badge.test.js` kiểm hành vi đó bằng
  // cách bơm đòn tấn công vào tên của một mục đang chờ duyệt.
  {
    ctx: 'text',
    ma: 'pendingApprovalBadge(task)',
    so: 3,
    ly_do: 'trả HTML đã thoát sẵn, không phải dữ liệu',
  },
  {
    ctx: 'text',
    ma: 'pendingApprovalBadge(project)',
    so: 2,
    ly_do: 'trả HTML đã thoát sẵn, không phải dữ liệu',
  },
  // 012 (Vòng 13) — nhãn XÁM «Nháp» + nút «Gửi duyệt». Cùng lý do với `pendingApprovalBadge`: hàm
  // TRẢ VỀ HTML (span + button) chứ không trả dữ liệu, và bên trong nó mọi giá trị (mã công việc,
  // tiêu đề, nhãn) tự đi qua escapeHtml/escapeHtmlAttr. Hai chỗ gọi: thẻ công việc và dải cấp 1.
  {
    ctx: 'text',
    ma: 'nhapBadge(project)',
    so: 2,
    ly_do: 'trả HTML đã thoát sẵn, không phải dữ liệu',
  },
  // Nút «Lưu nháp» của form tạo — builder trả HTML hằng đã thoát, chỉ hiện khi TẠO MỚI. `so: 0` vì
  // bộ soát KHÔNG tính nó là một lỗ riêng: nó nằm trong một biểu thức chuỗi lớn của form mà bộ soát
  // đã ghi nhận ở chỗ khác. Giữ mục này trong danh sách để nếu lần sau chỗ gọi đổi hình và trở
  // thành một lỗ thật thì TC-SEC-11 đỏ ngay, chứ không lặng lẽ lọt.
  {
    ctx: 'text',
    ma: 'buildLuuNhapNutHtml(isEdit)',
    so: 0,
    ly_do: 'trả HTML đã thoát sẵn, không phải dữ liệu',
  },
  {
    ctx: 'text',
    ma: 'luaChon(n.e, a, v)',
    so: 0,
    ly_do:
      'ĐÃ XOÁ (Vòng 10): trình sửa cũ dùng helper này; bản mới dropdown nằm ngay trên bảng, option là HẰNG và giá trị gán bằng JS sau render',
  },
  {
    ctx: 'attr',
    attr: 'class',
    ma: 'MAU_KY_HIEU[cell.s]',
    so: 1,
    ly_do:
      'màu ký hiệu là HẰNG tra từ bảng MAU_KY_HIEU — cell.s là hằng của chương trình, không phải dữ liệu',
  },
  {
    ctx: 'text',
    ma: 'o(row.g)',
    so: 1,
    ly_do:
      'hàng chỉ hiển thị — o() dựng HTML từ HẰNG trong BANG_PHAN_QUYEN, bên trong đã escapeHtml',
  },
  {
    ctx: 'text',
    ma: 'o(row.tp)',
    so: 1,
    ly_do:
      'hàng chỉ hiển thị — o() dựng HTML từ HẰNG trong BANG_PHAN_QUYEN, bên trong đã escapeHtml',
  },
  {
    ctx: 'text',
    ma: 'o(row.pp)',
    so: 1,
    ly_do:
      'hàng chỉ hiển thị — o() dựng HTML từ HẰNG trong BANG_PHAN_QUYEN, bên trong đã escapeHtml',
  },
  {
    ctx: 'text',
    ma: 'o(row.nv)',
    so: 1,
    ly_do:
      'hàng chỉ hiển thị — o() dựng HTML từ HẰNG trong BANG_PHAN_QUYEN, bên trong đã escapeHtml',
  },
];

/** Chỗ ghi HTML mà vế phải không phải HTML dựng sẵn — đã soát tay từng chỗ. */
const SINK_DA_SOAT_TAY = [
  {
    ma: '""',
    so: 10,
    ly_do:
      'xoá rỗng vùng chứa, không có dữ liệu nào đi vào (2026-08-26: +1 chỗ xoá option Năm của Gantt trước khi nạp lại; 2026-08-27: +1 chỗ xoá option Năm của tab Nhiệm vụ; 2026-08-27 ủy quyền: +1 chỗ xoá khung lỗi của modal ủy quyền; 2026-08-28: +1 chỗ xoá option Năm của tab Công việc; 2026-08-29: +1 chỗ xoá khung trình sửa phân quyền khi vai không phải admin; Vòng 10: trình sửa cũ đã gỡ nên dòng đó mất, bảng mới xoá rỗng vùng «Đang tải» trước khi nạp; Vòng 13 đợt 2: +1 chỗ xoá rỗng khung «Yêu cầu xoá» trong renderYeuCauXoaPanel trước khi nạp lại)',
  },
  {
    ma: 'el.dataset.originalContent',
    so: 1,
    ly_do: 'setButtonLoading cất innerHTML CỦA CHÍNH nút rồi trả lại — không nhận dữ liệu ngoài',
  },
];

describe('soát XSS tĩnh app.js — không còn lỗ nào ngoài danh sách đã ghi lý do', () => {
  it('TC-SEC-10: mọi giá trị nội suy đều đã thoát, trừ những chỗ đã ghi lý do', () => {
    const con = sites.filter((s) => s.loai === 'CAN-THOAT');
    const chuaGhi = con.filter(
      (s) => !CO_Y_KHONG_BOC.some((k) => k.ctx === s.ctx && k.ma === s.ma)
    );
    // In cả dòng và mã để người sửa biết đi đâu, không phải chạy lại công cụ.
    expect(chuaGhi.map((s) => `${s.line}:${s.ctx}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-11: số chỗ cố ý không bọc đúng như đã ghi (không thêm chỗ mới lặng lẽ)', () => {
    const con = sites.filter((s) => s.loai === 'CAN-THOAT');
    const dem = CO_Y_KHONG_BOC.map((k) => ({
      ctx: k.ctx,
      ma: k.ma,
      so: con.filter((s) => s.ctx === k.ctx && s.ma === k.ma).length,
    }));
    expect(dem).toEqual(CO_Y_KHONG_BOC.map(({ ctx, ma, so }) => ({ ctx, ma, so })));
  });

  it('TC-SEC-12: không chỗ nào trong on* nhận giá trị chỉ thoát HTML thường', () => {
    // Bẫy quan trọng nhất của việc 4.6: bộ phân tích HTML GIẢI MÃ thực thể TRƯỚC khi JS thấy mã
    // trong on*, nên `&#39;` của escapeHtml lại thành `'` và đóng chuỗi JS. Trong on* phải dùng
    // escapeForInlineHandler (thoát JS trước, thoát HTML sau).
    const sai = sites.filter((s) => s.ctx === 'handler' && !/escapeForInlineHandler/.test(s.ma));
    expect(sai.map((s) => `${s.line}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-13: mọi href/src dựng động đều đi qua safeUrl (chặn javascript:)', () => {
    const sai = sites.filter((s) => s.ctx === 'url' && !/safeUrl/.test(s.ma));
    expect(sai.map((s) => `${s.line}:${s.attr}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-14: không còn thuộc tính nào thiếu dấu bao (giá trị hở ra ngoài thẻ)', () => {
    const sai = sites.filter((s) => s.ctx === 'bare-attr');
    expect(sai.map((s) => `${s.line}:${s.attr}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-15: mọi chỗ ghi innerHTML đều dựng HTML, trừ những chỗ đã soát tay', () => {
    const con = sinks.filter((s) => s.trangThai === 'PHAI-SOAT');
    const chuaGhi = con.filter((s) => !SINK_DA_SOAT_TAY.some((k) => k.ma === s.ma));
    expect(chuaGhi.map((s) => `${s.line}:${s.kieu}:${s.ma}`)).toEqual([]);
    const dem = SINK_DA_SOAT_TAY.map((k) => ({
      ma: k.ma,
      so: con.filter((s) => s.ma === k.ma).length,
    }));
    expect(dem).toEqual(SINK_DA_SOAT_TAY.map(({ ma, so }) => ({ ma, so })));
  });

  it('TC-SEC-16: bốn hàm thoát vẫn còn nguyên trong app.js', () => {
    // Nếu ai đó xoá/đổi tên một hàm thoát, bộ soát sẽ coi mọi chỗ gọi nó là CAN-THOAT và các test
    // trên đỏ ngay; test này chỉ nói rõ nguyên nhân thay vì để đọc 400 dòng báo lỗi.
    const src = readFileSync(APP, 'utf8');
    for (const ten of ['escapeHtml', 'escapeHtmlAttr', 'escapeForInlineHandler', 'safeUrl'])
      expect(src).toContain(`function ${ten}(value)`);
  });

  it('TC-SEC-17: con số đã chốt — 79 chỗ ghi HTML, 566 giá trị nội suy', () => {
    // Kế hoạch §7 ghi "53 chỗ innerHTML": đó là 53 DÒNG. Việc 4.6 chốt 70 chỗ ghi và 474 giá trị;
    // việc 5.6 thêm 5 chỗ gọi `pendingApprovalBadge` (nhãn vàng) ⇒ 481;
    // việc 5.12 thêm 17 chỗ (nút cấp 2/cấp 3 + ô ẩn level/parent) ⇒ 498, không thêm chỗ ghi nào.
    // 2026-08-26 phân công ba lớp chốt ở 555; rồi bỏ ô "Quản lý công việc" khỏi form tạo/sửa
    // công việc (khối phân công ba lớp thay thế) −5 giá trị ⇒ 550, số chỗ ghi giữ 77.
    // 2026-08-26 (bẫy COL lần 2): vẽ lại ô Phòng khi bối cảnh phòng nạp trễ — thêm 1 chỗ
    // `deptSel.innerHTML = buildDeptIdOptions(…)` (builder thoát đủ) ⇒ 78 chỗ ghi, giá trị giữ 550.
    // 2026-08-26 (6 yêu cầu giao diện): lọc tháng ở Quản lý công việc thêm
    // `escapeHtml(thangDangXem)`; dòng «Phòng:» trên thẻ thêm `escapeHtml(project[COL.P_DEPT] …)`;
    // khối «Thuộc dự án» dựng bằng .map(...).join("") với escapeHtml đầy đủ; ô Người thực hiện
    // ẩn/hiện theo cấp là giá trị hằng do mã sinh. Ròng rã +1 giá trị ⇒ 551, chỗ ghi giữ 78.
    // 2026-08-26 (vòng lần 3): option ứng viên «Cán bộ trực tiếp» bỏ phần hiển thị email —
    // xoá nội suy `escapeHtml(text4)` −1 giá trị ⇒ 550, chỗ ghi giữ nguyên 78.
    // 2026-08-26 (Gantt xem theo tháng): tooltip thẻ tự vẽ — +1 sink `#tooltip-gantt`.innerHTML
    // (builder thoát đủ) và +1 sink xoá rỗng option Năm; hàng Gantt thêm JSON tooltip đã qua
    // escapeHtmlAttr ×3 (giá trị "trong-the" như cờ selected) cùng các nhãn thẻ escape trực tiếp
    // ⇒ 80 chỗ / 566 giá trị.
    // 2026-08-27 (việc 7.3 chat REST): `loadChatMessagesAsync` bỏ nhánh `withFailureHandler` vẽ
    // "Lỗi tải tin nhắn" — vòng hỏi lại 10 giây phải im lặng khi mạng chập chờn, chứ không xoá
    // khung chat người dùng đang đọc. Xoá 1 chỗ ghi HẰNG (không có nội suy) ⇒ 79 chỗ, giá trị
    // giữ 566.
    // 2026-08-27 (tab Nhiệm vụ — lọc Tháng/Năm/Cán bộ/Phòng + gom theo công việc con): renderTasks
    // bỏ khối glass-card theo công việc cấp 1, thay bằng dải phân cách mỏng
    // (`createTasksWorkSeparatorHtml`) + `createTasksSubworkBlockHtml` cho từng công việc con; hai
    // builder này escape từng trường một lần nên +4 giá trị nội suy, và ô Năm mới xoá rỗng option
    // trước khi nạp lại (+1 chỗ ghi HẰNG) ⇒ 80 chỗ / 570 giá trị.
    // 2026-08-27 (ủy quyền có thời hạn, §6 `docs/KE-HOACH-UY-QUYEN.md`): modal «Ủy quyền của tôi»
    // thêm 3 chỗ ghi — khung lỗi (dựng HTML), xoá rỗng khung lỗi (hằng ""), và bảng ủy quyền dựng
    // bằng `createUyQuyenModal(...)`. Mỗi trường của bản ghi (tên hai đầu người, ngày, tên phòng,
    // trạng thái, ghi chú, `data-id`, `data-nguoi`) đi qua escapeHtml/escapeHtmlAttr đúng một lần
    // ⇒ 83 chỗ / 588 giá trị.
    // 2026-08-28 (bộ lọc một dòng + trang «Quản lý tài khoản»): tab Công việc đổi ô tháng sang hai
    // ô chọn Tháng/Năm giống Gantt ⇒ +1 chỗ ghi HẰNG (xoá rỗng option Năm, `oNam.innerHTML = ""`).
    // Trang tài khoản thêm 2 chỗ ghi — khung thông tin dựng bằng `buildTaiKhoanDong(...)` và nhánh
    // "cần đăng nhập" (hằng). Mỗi ô thông tin escape nhãn + giá trị đúng một lần ⇒ +2 giá trị nội
    // suy ⇒ 86 chỗ / 590 giá trị.
    // 2026-08-28 (ủy quyền phải được phê duyệt, §13.4 mục 20): bảng ủy quyền thêm hai nút «Đồng ý»
    // / «Từ chối» cho người NHẬN. Ba nút của bảng gom về một builder `buildUyQuyenNut(...)` — nó
    // escape 5 giá trị + 1 nhãn, và ba chỗ gọi nó là 3 lỗ HTML-BIEN trong `buildUyQuyenRow`, trong
    // khi hai chỗ escape cũ của nút Huỷ biến mất ⇒ +7 giá trị nội suy, KHÔNG thêm chỗ ghi HTML nào
    // ⇒ 86 chỗ / 597 giá trị.
    // 2026-08-28 (ô chọn phòng cho Giám đốc, §13.4 mục 18): form ủy quyền thêm builder
    // `buildUyQuyenPhamVi()` — chỉ hiện với admin. +5 giá trị: 1 lời gọi nó trong
    // `createUyQuyenModal`, 1 chỗ thoát `size` của thẻ select, 1 lỗ cho cả biểu thức `list.map(...)`
    // và 2 chỗ thoát bên trong (id + tên phòng). KHÔNG thêm chỗ ghi HTML nào (vẫn dựng trong chuỗi
    // của modal cũ) ⇒ 86 chỗ / 602 giá trị.
    // 2026-08-28 (ô CHỌN người nhận thay ô gõ email, yêu cầu «danh sách hiện ra sẽ đúng theo luồng
    // đã nói»): form ủy quyền đổi `<input list=uy-quyen-staff-list>` sang `<select>` do
    // `buildUyQuyenNguoiNhan()` dựng. −1 lời gọi `buildStaffEmailDatalist` trong `createUyQuyenModal`
    // (ô ủy quyền không dùng datalist nữa; hai chỗ gọi của modal Phòng giữ nguyên), +1 lời gọi
    // builder mới, +2 chỗ thoát của nhánh rỗng (câu giải thích) và +2 chỗ thoát của mỗi option
    // (email + nhãn tên/vai/phòng) ⇒ +4 giá trị nội suy, KHÔNG thêm chỗ ghi HTML nào
    // ⇒ 86 chỗ / 606 giá trị.
    // 2026-08-28 (nhật ký từng lần chỉnh sửa 3 cấp, docs/KE-HOACH-NHAT-KY.md): tab «Nhật ký» trong
    // modal chỉnh sửa. +3 chỗ ghi HTML: `renderNhatKy` (nhánh rỗng — hằng — và nhánh danh sách) và
    // nhánh báo lỗi tải của `napNhatKy`. +26 giá trị nội suy: `buildNhatKyDong` thoát 8 (icon, màu,
    // nhãn hành động, thời điểm, người, cấp, mã, tên) + 1 lỗ cho `buildNhatKyChiTiet(...)`;
    // `buildNhatKyChiTiet` thoát 4 (câu phụ, nhãn cột, giá trị cũ, giá trị mới) + 1 lỗ cho
    // `dong.join("")`; `buildThanhTabNhatKy` 4 (hai id + hai lời gọi `escapeForInlineHandler(kieu)`
    // viết THẲNG trong onclick — qua biến trung gian là TC-SEC-18 đánh trượt) và `buildKhungNhatKy`
    // 3 (2 id + `data-ma`); hai chỗ gọi
    // `buildThanhTabNhatKy`/`buildKhungNhatKy` trong hai modal là 4 lỗ nữa; 1 lỗ cho
    // `list.slice().reverse().map(...).join("")` ⇒ 89 chỗ / 632 giá trị.
    // 2026-08-28 (tên theo tháng, docs/KE-HOACH-TEN-THEO-THANG.md): tab thứ ba «Tên theo tháng».
    // +1 chỗ ghi HTML: `veLaiBangTenThang` (vẽ lại bảng sau mỗi lần lưu/bỏ). +30 giá trị nội suy:
    // `buildDongTenThang` 12 (nhãn tháng, id ô, giá trị, gợi ý, 3 tham số của `onkeydown`, 3 của
    // `onclick` Lưu, 3 của `onclick` Bỏ — mỗi tham số thoát THẲNG trong chuỗi vì TC-SEC-18 không
    // nhận biến trung gian) = 12; `buildBangTenThang` 3 (tên gốc ở câu nhắc, nhãn tháng đầu, 1 lỗ
    // cho `suaDuoc.map(...).join("")`) + 1 lỗ cho câu «không kéo dài hơn một tháng» (hằng, đếm là
    // chỗ ghi chứ không phải giá trị) ⇒ 4; `buildKhungTenThang` 3 (2 id + `data-ma`) + 1 lỗ cho
    // `buildBangTenThang(...)`; `buildThanhTabNhatKy` thêm 2 cho nút tab thứ ba; hai modal thêm 2 lỗ
    // gọi `buildKhungTenThang`; `createProjectCard`, `createTasksWorkSeparatorHtml`,
    // `createTasksSubworkBlockHtml`, `createTaskTableRowSimple` mỗi chỗ 2 (tên theo tháng + `title`
    // tên gốc) = 8; `buildGanttHoverCardHtml` 2 (nhãn «Tên gốc» + giá trị) ⇒ 90 chỗ / 662 giá trị.
    // 2026-08-28 (màn hình duyệt trong Quản lý công việc): panel «Chờ duyệt» — +1 sink
    // `#approvals-list`.innerHTML (builder buildPendingApprovalRowHtml thoát đủ) và +1 sink
    // render spinner; JSON/label đều escape ⇒ 92 chỗ / 668 giá trị.
    // 2026-08-29 («Hoạt động gần đây» đọc được, docs/NHAT-KY-HOAT-DONG-GAN-DAY.md): `renderActivity`
    // đổi sang builder `createHoatDongItemHtml` — nhãn/icon/màu theo bản đồ NHAT_KY_HANH_DONG, mô
    // tả rỗng thì bỏ hẳn dòng phụ. Sink giữ nguyên 1 (chỗ innerHTML cũ), giá trị +2: 4 nội suy cũ
    // (action, details, user, giờ) thành 6 (icon + màu qua escapeHtmlAttr, nhãn, mô tả, user, giờ)
    // ⇒ 92 chỗ / 670 giá trị.
    // 2026-08-29 (vòng 7 — bỏ nốt mã khỏi tên, phản hồi ảnh CV002): gỡ 4 chỗ nội suy MÃ khỏi tên
    // hiển thị — h4 thẻ công việc (projectId), dải tab Nhiệm vụ (maCongViec), div mã dưới tên
    // nhiệm vụ (taskId), chip mã trong thẻ nhiệm vụ của modal chi tiết (taskId); khối CV con giữ
    // nguyên 1 nội suy tieuDe. project-details.js không nằm trong bộ soát này. ⇒ 92 chỗ / 666
    // giá trị. Chi tiết: docs/NHAT-KY-GANTT-THEO-THANG.md mục Vòng 7.
    // 2026-08-29 (vòng 9 — Bảng phân quyền ĐỘNG, admin sửa bằng dropdown): +5 sink — khung trình
    // sửa `#account-permission-editor`.innerHTML, body của nó, bảng hiển thị đổi qua builder
    // `buildTrinhSuaPhanQuyenHtml` (dropdown data-entity/action/vai, toàn bộ qua escapeHtml/
    // escapeHtmlAttr trực tiếp); bỏ helper o() của bảng tĩnh vòng 8. Giá trị option của trình sửa
    // là HẰNG, gán selected bằng JS sau render. Vòng 10-11: bảng ĐỘNG 15 chức năng, dropdown 1
    // hàng (hành động + phạm vi ngang), option đầu «Đang dùng: X», Cán bộ badge «Phòng của mình».
    // Vòng 13: nút Lưu render lại trong veBangPhanQuyen (+1 sink hằng, +2 giá trị nút), option
    // đầu = trạng thái gọn không lặp ⇒ 96 chỗ / 698 giá trị. Chi tiết: NHAT-KY mục Vòng 9-13.
    // 2026-08-31 (012, luồng NHÁP + duyệt cả cây — docs/KE-HOACH-DUYET-CAY.md): +17 giá trị,
    // KHÔNG thêm chỗ ghi HTML nào (mọi thứ dựng trong builder đã có). Cụ thể: `nhapBadge` 4 (tiêu
    // đề nhãn, chữ «Nháp», `data-id`, tiêu đề nút + chữ «Gửi duyệt» — 5 lỗ trừ 1 vì mã dùng lại),
    // `buildLuuNhapNutHtml` 2 (tiêu đề + nhãn nút), 2 lời gọi `nhapBadge(project)` ở thẻ công việc
    // và dải cấp 1, `buildPendingApprovalRowHtml` +9 (`data-name`, `data-work-code`, tiêu đề loại
    // kèm tên công việc cấp 1, và 4 tiêu đề nút Xem chi tiết/Duyệt/Trả lại/Từ chối).
    // 2026-09-01 (013, luồng YÊU CẦU XOÁ — docs/KE-HOACH-DUYET-CAY.md mục 8): **+2 chỗ ghi HTML**
    // và +15 giá trị. Hai chỗ ghi: `renderYeuCauXoaPanel` xoá rỗng khung (hằng `""`) và ghi danh
    // sách dòng yêu cầu xoá. Giá trị: `buildXinXoaBadge` 2 (tiêu đề + chữ «Đang xin xoá»),
    // `buildPendingDeleteRowHtml` 11 (`data-entity`, `data-id`, `data-name`, tiêu đề loại kèm tên
    // công việc cấp 1, nhãn loại, tên, mã, lý do, người xin, 2 tiêu đề nút), 2 lời gọi
    // `buildXinXoaBadge(project)` ở thẻ công việc và dải cấp 1. Đổi tên từ `xinXoaBadge` vì bộ
    // soát chỉ nhận helper trả HTML với tiền tố build*/tao*/render* (bẫy §13.5). ⇒ 98 chỗ / 730.
    // Thêm HTML mới thì phải sửa hai số này VÀ docs/XSS-4.6.md — cố ý cho hơi rát, để việc thêm
    // một chỗ dựng HTML là một quyết định, không phải chuyện tình cờ.
    // 2026-09-01 (014, «KẾT QUẢ NHIỆM VỤ LÀ FILE» — docs/KE-HOACH-KET-QUA-FILE.md): **+2 chỗ ghi
    // HTML** (cả hai trong `napKetQua`: khung rỗng + danh sách nhóm file) và **+48 giá trị**.
    // Giá trị: `buildKhungKetQua` 2 (id + `data-ma`), 2 lỗ gọi `buildKhungKetQua` trong
    // `buildKhungNhatKy` + nút tab «Kết quả & Luồng» 3 (id + onclick, chỉ modal nhiệm vụ),
    // `buildKhoiFile` 7 (tên, badge, class màu qua escapeHtmlAttr, người tạo, 3 nút icon qua
    // escapeHtmlAttr — onclick dựng từ escapeForInlineHandler bên gọi), `buildBanFileList` 13
    // (bản số, người nộp, lúc, 2 nút ⬇/👁 qua onclick, thread góp ý 4, nút góp ý 2, 1 lỗ
    // `bans.map(...).join("")`), `buildNutVerdictFile` 2 (lỗ join + lỗ return — nút verdict thoát
    // 5 giá trị bên trong), `buildBangLuongFile` 8 (5 cột `buildO` thoát + 5 ô dòng: lúc, người,
    // vai, hành động, bản, nội dung — 6 lỗ thoát + 2 lỗ join/ternary thoát), `napKetQua` 6 (lời
    // gọi GET, khung rỗng 2 + nút tải lên 2, 1 lỗ `nhom.map(...).join("")`). Hai hàng mới của
    // BANG_PHAN_QUYEN dựng trong builder có sẵn (không thêm lỗ). ⇒ 100 chỗ / 778 giá trị.
    // 2026-09-01 (bổ sung theo câu trả lời §13.4 mục 21–24): ô «Ý kiến» trong khối file
    // (label `for` + id + `data-ban-cuoi` qua escapeHtmlAttr, nút Gửi ý kiến qua
    // escapeForInlineHandler) +5 giá trị; gỡ nút ↩ góp ý theo bản −3 giá trị
    // ⇒ 100 chỗ / 780 giá trị.
    // 2026-09-01 (Vòng 14续2 — người dùng chốt: khối file về tab «Thông tin», nhãn «Kết quả»):
    // gỡ tab «Kết quả & Luồng» (−1 sink, −khung+container), buildKhoiFile đổi dạng DÒNG (+✎
    // sửa trực tuyến, panel ý kiến/lịch sử), napKetQua gộp còn 1 chỗ ghi HTML ⇒ **99 chỗ /
    // 792 giá trị**. Chi tiết: docs/XSS-4.6.md.
    // 2026-09-02 (Vòng 14续5 — trang «Hàng chờ phê duyệt», 2 tab con): **+2 chỗ ghi HTML** —
    // `renderChoDuyetKetQua` (spinner rồi danh sách) và `buildDongChoDuyetKetQua` (lỗ return của
    // builder) — và **+19 giá trị**: builder thoát 14 (badge class + nhãn trạng thái, tên file,
    // mã + tên nhiệm vụ trong onclick qua escapeForInlineHandler, tên phòng, bản số, người nộp,
    // thời điểm, `data-file`, url editor qua safeUrl+escapeHtmlAttr, id bản của nút tải), lỗ
    // `hanhDong.map(...).join` thoát 3 (id nhóm, mã hành động, nhãn nút), 2 lỗ join/ternary của
    // `items.map(...)` ⇒ **101 chỗ / 811 giá trị**.
    // 2026-09-02 (Vòng 14续6 — hàng chờ dạng BẢNG CÂY + nộp bản mới + phân công thu gọn):
    // KHÔNG thêm chỗ ghi HTML nào (bảng vẫn ghi qua 1 lỗ `listEl.innerHTML` cũ; `buildHangCayChoDuyet`
    // và `buildKhoiPhanCongGonHtml` chỉ TRẢ chuỗi cho lỗ đã đếm). **+19 giá trị**: hàng tiêu đề cây
    // thoát 6 (class hàng, class thụt, icon, mã trong onclick qua escapeForInlineHandler, tên, mã +
    // tên phòng), dòng file thêm 4 (class thụt ô đầu, số bản, số ý kiến, mã nhiệm vụ của nút «Xem ý
    // kiến»), nút «Nộp bản mới» thoát 2 (id nhóm + mã nhiệm vụ), tiêu đề bảng `o()` thoát 2 (class
    // thêm + nhãn cột), `buildKhoiPhanCongGonHtml` thoát 5 (3 chip × nhãn/giá trị dùng chung 1 hàm
    // `chip` ⇒ 3 lỗ nhãn + 1 lỗ giá trị + 1 lỗ câu «chưa phân công») ⇒ **101 chỗ / 830 giá trị**.
    // 2026-09-03 (mở thêm PowerPoint/Excel/ảnh): KHÔNG thêm chỗ ghi HTML nào. **+1 giá trị** —
    // `accept=` của ô chọn file trong `napKetQua` trước đây là chuỗi hằng viết thẳng trong mã, nay
    // dựng từ `ACCEPT_KET_QUA` nên phải qua `escapeHtmlAttr` như mọi lỗ nội suy khác (danh sách đuôi
    // là hằng của mã, không phải dữ liệu người dùng — bọc vẫn đúng luật và vô hại)
    // ⇒ **101 chỗ / 831 giá trị**. Chi tiết: docs/XSS-4.6.md.
    // 2026-09-04 (Vòng 14续9 — THIẾT KẾ LẠI khối «Kết quả» + «Phê duyệt kết quả» thành bảng 8 cột
    // theo hai sheet của người dùng): KHÔNG thêm chỗ ghi HTML nào — cả hai bảng vẫn ghi qua đúng
    // hai lỗ `innerHTML` cũ (`khung.innerHTML` của `napKetQua`, `listEl.innerHTML` của
    // `renderChoDuyetKetQua`), các builder mới chỉ TRẢ chuỗi. **+37 giá trị**, chia ra:
    //  · `buildDongBanKetQua` +16 (dòng con 1.1/1.2 mới: `data-ban`, `data-nhom`, thời điểm nộp,
    //    số 1.1, tên gốc, chữ «Sửa lần N», định dạng, id bản trong onclick, tên file, số bản,
    //    người nộp, 3 lỗ của thread góp ý theo bản, lỗ `yKien`, lỗ `buildMenuHanhDongKq`);
    //  · `buildBangKetQua` +11 (2 lỗ trong `buildOTieuDeKq` + 8 lời gọi nó cho 8 cột + lỗ
    //    `nhom.map(...).join`);
    //  · `buildKhoiFile` 16 → 24 (dòng cha nay là `<tr>` 8 ô: thêm thời gian tạo, số thứ tự «1.»,
    //    số bản, định dạng, tên file của ô «File đã tải lên» + id bản trong onclick, câu kể tình
    //    trạng, lỗ menu ⋯, lỗ `dongBan`);
    //  · `buildMenuHanhDongKq` +3 và `buildMucMenuKq` +3 (menu ⋯ dùng chung cho cả hai bảng);
    //  · `buildOCapChoDuyet` +3 và `buildONhiemVuChoDuyet` +3 (ba cấp cây thành ba CỘT);
    //  · `buildBangChoDuyetKetQua` 8 → 11 (8 cột thay vì 5);
    //  · `buildDongChoDuyetKetQua` 22 → 17 và `buildHangCayChoDuyet` 8 → 0 (hàm hàng tiêu đề cây
    //    đã GỠ; các ô thụt lề/icon của nó không còn).
    // Mọi lỗ mới đều DA-THOAT/HTML-LONG — danh sách `CO_Y_KHONG_BOC` không đổi
    // ⇒ **101 chỗ / 868 giá trị**.
    expect({ sink: sinks.length, gia_tri: sites.length }).toEqual({ sink: 101, gia_tri: 868 });
  });
});

// Các test trên chỉ nói "app.js không còn lỗ nào". Một bộ soát bị hỏng cũng nói y như vậy. Nhóm
// dưới đây soát file mẫu có lỗ ĐÃ BIẾT, để cái xanh ở trên có nghĩa.
describe('tự kiểm bộ soát trên file mẫu — phải bắt được lỗ đã biết', () => {
  const mau = soatFile(resolve(process.cwd(), 'tests/fixtures/xss-mau.js'));
  const chuKy = mau.sites.map((s) => [s.loai, s.ctx, s.attr, s.ma].join('|'));

  it('TC-SEC-18: xếp đúng loại và ngữ cảnh cho cả 11 lỗ của file mẫu', () => {
    expect(chuKy).toEqual([
      'CAN-THOAT|text||x', // giữa hai thẻ
      'DA-THOAT|text||escapeHtml(x)',
      'CAN-THOAT|attr|title|x', // trong thuộc tính có dấu bao
      'DA-THOAT|url|href|escapeHtml(x)', // thoát HTML nhưng thiếu safeUrl
      'DA-THOAT|url|href|escapeHtml(safeUrl(x))',
      'DA-THOAT|handler|onclick|escapeHtml(x)', // trong chuỗi JS, thoát sai kiểu
      'DA-THOAT|handler|onclick|escapeForInlineHandler(x)',
      'CAN-THOAT|handler-ngoai|onclick|i', // trong on* nhưng ngoài chuỗi JS
      'DA-THOAT|bare-attr|class|escapeHtml(x)', // thuộc tính thiếu dấu bao
      'CAN-THOAT|trong-the||x',
      'DA-THOAT|text||escapeHtml(x)',
    ]);
  });

  it('TC-SEC-19: chính ba luật của TC-SEC-12/13/14 bắt được lỗi trong file mẫu', () => {
    // Nếu một luật ngừng bắt được lỗi (ví bộ máy trạng thái trượt), nó sẽ xanh oan ở app.js.
    expect(
      mau.sites.filter((s) => s.ctx === 'handler' && !/escapeForInlineHandler/.test(s.ma))
    ).toHaveLength(1);
    expect(mau.sites.filter((s) => s.ctx === 'url' && !/safeUrl/.test(s.ma))).toHaveLength(1);
    expect(mau.sites.filter((s) => s.ctx === 'bare-attr')).toHaveLength(1);
  });

  it('TC-SEC-20: phân biệt được ghi thẳng biến chữ và ghi HTML dựng sẵn', () => {
    expect(mau.sinks.map((s) => s.trangThai)).toEqual(['PHAI-SOAT', 'HTML-DUNG']);
  });
});

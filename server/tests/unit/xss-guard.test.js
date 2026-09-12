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
  {
    ctx: 'text',
    ma: 'nhapBadge(task)',
    so: 1,
    ly_do:
      'nhapBadge trả HTML đã thoát tên/mã, cùng builder được kiểm cho project; tab nhiệm vụ nay hiển thị nhãn nháp cạnh kết quả',
  },
  // Cờ `selected`/`checked` do CHÍNH mã sinh ra ("selected" hoặc ""), không có dữ liệu người dùng.
  // Đây là chỗ trong thẻ mà không có dấu bao, nên nếu là dữ liệu ngoài thì cực nguy hiểm — vì vậy
  // phải nêu tên rõ ràng thay vì bỏ qua cả nhóm "trong-the". (2026-08-26: bỏ ô "Quản lý công việc"
  // khỏi form công việc nên mất 1 trong 3 chỗ cũ, còn 2. 2026-09-09: option của ô «Người thực hiện
  // trực tiếp» dọn về builder `buildUngVienTrucTiepHtml`, cờ `selected` ở đó viết thẳng
  // `(… ? " selected" : "")` chứ không qua biến `text3` nữa ⇒ còn 1.)
  { ctx: 'trong-the', ma: 'text3', so: 1, ly_do: 'cờ "selected" do mã sinh, không phải dữ liệu' },
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
  // ĐỢT B (R4 + Q1): ô «Tỷ lệ (%)» đi theo KHAI BÁO — khung khai của form nhiệm vụ và dòng khai tạm.
  {
    ctx: 'text',
    ma: 'oNhapTyLeKhai("task-kq-khai-ty-le", "")',
    so: 1,
    ly_do:
      'hàm dựng HTML, không phải dữ liệu — oNhapTyLeKhai trả về một thẻ <input> hằng; hai tham biến ở lời gọi đều là CHUỖI VIẾT TAY và bên trong hàm cả `cls` lẫn `id` đều qua escapeHtmlAttr. Bộ soát không nhìn vào THÂN hàm nên coi lời gọi là một giá trị chưa thoát',
  },
  {
    ctx: 'text',
    ma: 'oNhapTyLeKhai("", "kq-tam-ty-le", "")',
    so: 1,
    ly_do:
      'như trên — dòng khai tạm gọi cùng một hàm với ba chuỗi viết tay, không có dữ liệu người dùng nào đi vào',
  },
  // MỚI-3 (2026-09-12): nhãn «đây là duyệt cái gì» của ba bảng chờ duyệt — cùng một khuôn với `o(...)`
  // và `oNhapTyLeKhai(...)` ở trên: hàm TRẢ VỀ CHUỖI HTML, bộ soát không đọc thân hàm nên coi lời gọi
  // là một giá trị chưa thoát. Bên trong `nhanDuyetHtml` cả ba thành phần đều đã thoát (`escapeHtmlAttr`
  // cho `cfg.mau` và `cfg.yNghia`, `escapeHtml` cho `cfg.nhan`), và `cfg` luôn lấy từ `NHAN_DUYET` đóng
  // băng với `|| NHAN_DUYET.moi` dự phòng nên một `kieu` lạ cũng không ra `undefined`.
  {
    ctx: 'text',
    ma: 'nhanDuyetHtml(laBanSua ? "sua" : "moi")',
    so: 1,
    ly_do:
      'hàm dựng HTML, không phải dữ liệu — nhãn của bảng «Chờ duyệt»; tham biến là biểu thức điều kiện giữa HAI CHUỖI VIẾT TAY, giá trị in ra lấy từ hằng `NHAN_DUYET`',
  },
  {
    ctx: 'text',
    ma: 'nhanDuyetHtml("xoa")',
    so: 1,
    ly_do: 'như trên — nhãn của bảng «Yêu cầu xoá», tham biến là một chuỗi viết tay',
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
    //
    // 2026-09-04 (ba việc người dùng báo sau khi xem bảng thật): **+5 giá trị**, vẫn KHÔNG thêm
    // chỗ ghi HTML nào.
    //  · `buildIconDinhDang` +3 (icon định dạng file cho cột «Tên kết quả làm được»: lớp icon,
    //    `title`, `aria-label` — mất icon thì vẫn còn chữ để đọc);
    //  · `buildDongChoDuyetKetQua` 17 → 19 (cột 1 nay hai dòng: dòng dưới là TÊN FILE của bản mới
    //    nhất ⇒ +1 lỗ `title` + 1 lỗ chữ; lỗ icon cũ là hằng nên không đếm).
    // `batTatMenuKq` dời thẻ menu ra `<body>` bằng DOM API (`appendChild`, `style.*`) — không
    // dựng chuỗi HTML nào nên bộ soát không thấy gì, đúng như mong đợi
    // ⇒ **101 chỗ / 873 giá trị**.
    //
    // 2026-09-04 (Vòng 14续11 — đợt 2: khai kết quả TRƯỚC + form TẠO hiện bảng 8 cột):
    // **+1 chỗ ghi HTML, +20 giá trị**.
    //  · Sink mới: `themDongKhaiTam` gọi `tbody.insertAdjacentHTML("beforeend", buildDongKhaiTam(so))`
    //    — ＋ trên form tạo thêm dòng 2., 3. ngay trong bảng, không POST. Builder đã thoát bên trong
    //    nên xếp HTML-DUNG. `napKetQua` vẫn MỘT lần `khung.innerHTML` (gọi `buildKhungDanhSachKetQua`).
    //  · `buildKhungDanhSachKetQua` +5 (`nutThem`, `buildKhungKhaiKq`, `buildBangKetQua`, `oChonFile`,
    //    `accept=` của ô chọn file — `accept=` trước nằm trong `napKetQua`, nay chuyển sang đây nên
    //    không tăng thêm so với 续10 nếu đếm ròng, nhưng hàm mới là lỗ mới).
    //  · `buildKhungKhaiKq` +4 (map option định dạng, 2 lỗ option value/text, onclick `ma`).
    //  · `buildBangKetQua` đổi nhánh rỗng: `than` (HTML-BIEN) thay `nhom.map` — số lỗ tiêu đề giữ.
    //  · `buildDongKhaiTam` +5 (map option, 2 lỗ option, số thứ tự `1.`, `chonDd`).
    //  · `buildKhoiFile` / `buildDongBanKetQua` / `buildONhapBaoCao` / hàng chờ `ten_ket_qua` thêm lỗ
    //    thoát `ten_ket_qua` + `noi_dung` + option «Báo cáo» — phần còn lại của +20.
    // Mọi lỗ mới đều DA-THOAT / HTML-LONG / HTML-BIEN — danh sách `CO_Y_KHONG_BOC` không đổi
    // ⇒ **102 chỗ / 893 giá trị**.
    // 2026-09-05 (bố cục form + «Lưu tạm»/«Gửi đi duyệt»): **0 sink mới, tổng giá trị KHÔNG đổi**
    // — trừ đúng một lỗ, thêm đúng một lỗ, nên con số trùng nhau chứ không phải chưa đếm lại:
    //  · MẤT `escapeHtml(task[COL.T_RESULT_LINKS])`: bỏ textarea legacy «Nhập mỗi link trên một
    //    dòng» khỏi form nhiệm vụ (cột cơ sở dữ liệu vẫn còn, chỉ không dựng vào HTML nữa) ⇒ −1.
    //  · MỚI `buildLuuNhapNutHtml(false)` ở chân form TẠO nhiệm vụ (HTML-LONG — builder tự thoát
    //    bên trong, đã có lỗ `escapeHtml("Lưu tạm")` riêng) ⇒ +1.
    //  · Hai lỗ ĐỔI CHỖ, không đổi số: `escapeHtml(text2)` → `escapeHtml(isEdit ? text2 : "Gửi đi
    //    duyệt")` ở chân form công việc, và `escapeHtml("Lưu nháp")` → `escapeHtml("Lưu tạm")`.
    //  · Nhãn TĨNH của chân form mới («Hủy», «Gửi đi duyệt», dòng gợi ý) viết thẳng vào chuỗi HTML,
    //    KHÔNG bọc `escapeHtml` — hằng chuỗi trong mã nguồn không phải dữ liệu người dùng; bọc chỉ
    //    làm phình con số chốt và che mất lỗ thật. Bẫy này ghi ở §13.5.
    //  · `chan-form-tao` chỉ là lớp CSS (sticky đáy), không nội suy gì.
    // ⇒ vẫn **102 chỗ / 893 giá trị**.
    //
    // 2026-09-06 (CHUÔNG THÔNG BÁO — §13.4 mục 16, việc A): **+2 chỗ ghi HTML, +7 giá trị**.
    //  · Sink 1: `khung.innerHTML = buildDanhSachThongBao(thongBaoDanhSach)` trong `napThongBao` —
    //    HTML-LONG, builder tự thoát bên trong.
    //  · Sink 2: `khung.innerHTML = "<div …>Chưa tải được thông báo…"` — chuỗi HẰNG, không nội suy
    //    gì; là sink vì có ghi HTML, nhưng 0 giá trị.
    //  · +7 giá trị, tất cả DA-THOAT, đều trong `buildMotThongBao`: 5 lỗ thuộc tính
    //    (`escapeHtmlAttr` cho `row.id`, `ref`, `refId`, `loai.icon`, `loai.mau` — ba cái đầu vào
    //    `data-*` mà `moThongBao` đọc lại, hai cái sau là lớp icon) và 2 lỗ văn bản
    //    (`escapeHtml(row.content)` — nội dung do máy chủ dựng từ TÊN ĐẦU VIỆC người dùng gõ, và
    //    `escapeHtml(dinhDangGioThongBao(row.created_at))`).
    //  · `buildDanhSachThongBao` nhánh rỗng là chuỗi hằng ⇒ không thêm lỗ.
    //  · `dinhDangGioThongBao` KHÔNG tên `build*` nhưng chỉ trả **chữ thuần** và chỗ gọi đã bọc
    //    `escapeHtml` — đúng luật, không phải ngoại lệ (bẫy «tên hàm HTML không build*» chỉ áp cho
    //    hàm TRẢ VỀ HTML).
    //  · `THONG_BAO_LOAI` là map nội bộ, nhưng `loai.icon`/`loai.mau` vẫn escape tại lỗ — luật
    //    TC-SEC-13 không xét nguồn (cùng lý lẽ đã ghi cho `DINH_DANG_KHAI` ở trên).
    // ⇒ **104 chỗ / 900 giá trị**.
    //
    // 2026-09-06 (KHỐI «THÔNG BÁO ZALO» trên trang tài khoản — Phase 8 việc 1e):
    // **+2 chỗ ghi HTML, +3 giá trị**.
    //  · Sink 1: `body.innerHTML = tt.daLienKet === true ? buildZaloDaLienKetHtml() :
    //    buildZaloChuaLienKetHtml()` trong `renderThongBaoZalo` — HTML-LONG, cả hai builder chỉ có
    //    nhãn TĨNH (không escapeHtml — đúng luật hằng chuỗi), không lỗ nào.
    //  · Sink 2: `body.innerHTML = buildZaloMaHtml(ma)` trong `xuLyNutZalo` — HTML-LONG, builder tự
    //    thoát bên trong. Chỗ gọi tính là SINK chứ không tính builder là giá trị — cùng lệ đã ghi
    //    cho CHUÔNG THÔNG BÁO ở trên.
    //  · +3 giá trị, tất cả DA-THOAT, đều trong `buildZaloMaHtml`: `escapeHtml(ma.huongDan || "")`,
    //    `escapeHtml(String(ma.code || ""))`, `escapeHtml(String(ma.hanPhut || 15))` — mã dù chỉ là
    //    6 chữ số và câu hướng dẫn là chuỗi cố định của máy chủ, vẫn bọc: dữ liệu máy chủ = dữ
    //    liệu chưa tin.
    // ⇒ **106 chỗ / 903 giá trị**.
    //
    // 2026-09-09 (Trưởng/Phó phòng được làm «Người thực hiện trực tiếp»): **+1 chỗ ghi, +1 giá trị**.
    //  · Sink mới: `selTrucTiep.innerHTML = buildUngVienTrucTiepHtml(list, dangChon, …)` trong
    //    `createTaskModal` — vẽ lại ô người thực hiện SAU khi máy chủ cho biết phòng có Phó GĐ phụ
    //    trách hay không (`coPhoGiamDocPhuTrach`), không có thì cắt Trưởng/Phó phòng khỏi danh sách.
    //    HTML-LONG, builder tự thoát bên trong; chỗ gọi tính là SINK, cùng lệ với hai chỗ Zalo trên.
    //  · +1 giá trị: hai option cũ escape `escapeHtml(list2[COL.S_NAME])` ×2 (value + text); nay
    //    `buildUngVienTrucTiepHtml` escape `escapeHtmlAttr(ten)` + `escapeHtml(ten)` + THÊM
    //    `escapeHtml(vai)` cho nhãn kèm vai «(Trưởng phòng)»/«(Phó phòng)» ⇒ 3−2 = +1, tất cả DA-THOAT.
    //    `value` vẫn là TÊN (không đổi sang id) nên luồng lưu/sửa và dữ liệu cũ không xê dịch.
    // ⇒ **107 chỗ / 904 giá trị**.
    // V1–V8: V2/V4 builders +14; V7 checkbox/settings builders +2; V5 tái dùng escape có sẵn, V6 HTML máy chủ ngoài phép đếm.
    // 10/09/2026: bỏ 9 sink bộ đếm cũ (textContent); dòng file/cột riêng tăng ròng 9 nội suy.
    //
    // 2026-09-10 (thiết kế lại TAB NHIỆM VỤ + popup nhật ký file): **0 chỗ ghi, +23 giá trị**.
    //  · SINK giữ nguyên 98: popup `moNhatKyFileKetQua` dựng HOÀN TOÀN bằng `createElement` +
    //    `textContent` (cùng cách `hopThoai8b` của phase8b-review.js) nên không thêm chỗ ghi HTML
    //    nào — tên người, tên file và nội dung ý kiến không đi qua chuỗi HTML ở đó.
    //  · +23 giá trị, TẤT CẢ đều DA-THOAT hoặc HTML-LONG, không chỗ nào vào `CO_Y_KHONG_BOC`:
    //    bảng nhiệm vụ 8 → 10 cột ở CẢ hàng nhiệm vụ lẫn hàng file (+4); các ô mới của hàng file
    //    — tên đầy đủ cho cả `title` lẫn chữ, người nộp bản cuối, số bản, nhãn + màu trạng thái,
    //    hai `data-*` của nút «Xem kết quả» (+13); `<colgroup>` và tiêu đề cột dựng bằng `.map`
    //    nên mỗi cái góp 1 (+2); dấu tích ẩn/hiện mang id + số file + tên nhiệm vụ trong
    //    `title`/`aria-label` (+3); cột «Tình trạng kết quả» của hàng nhiệm vụ (+1).
    //  · Đổi tên helper ô từ `o()` về `buildTaskCellHtml()`: bộ soát xếp hàm `build*`/`create*`/
    //    `render*` là HTML-LONG (tự thoát ở chỗ gọi). Tên `o` rơi xuống CAN-THOAT và bắt khai báo
    //    tay 20 mục trong `CO_Y_KHONG_BOC` cho những ô vốn đã escape — kê như vậy là làm mờ danh
    //    sách, không phải làm nó chặt hơn.
    //
    // 2026-09-10 (đợt 4 — mũi tên ▼/▲, cột «Tên file» riêng, màu theo tiến độ, gộp ý kiến verdict,
    // colgroup bảng «Kết quả»): **0 chỗ ghi, 952 → 957 giá trị**.
    //  · SINK vẫn 98: popup dựng bằng `textContent`, còn lại đều là chuỗi HTML đã có từ trước.
    //  · KHÔNG có CAN-THOAT mới — vẫn đúng 19 chỗ cũ trong `CO_Y_KHONG_BOC`, hai chỗ nằm trong
    //    hàng nhiệm vụ (`pendingApprovalBadge`, `nhapBadge`) là của các đợt trước.
    //  · Các chỗ mới, tất cả DA-THOAT hoặc HTML-LONG: `buildMotYKien` (6 giá trị — thay cho 4 của
    //    thread cũ trong `buildYKienPanel` và 3 của ô ý kiến cũ trong `buildDongBanKetQua`, nay cả
    //    hai gọi chung một hàm nên thoát một chỗ thay vì ba); `buildColgroupKetQua` (2); bảng nhiệm
    //    vụ 10 → 11 cột thêm ô «Tên file» trống cho hàng nhiệm vụ và ô dấu nối `task-file-lui` cho
    //    hàng file (2 HTML-LONG); `escapeHtmlAttr(mauTienDoFile(tienDo))` cho màu chữ theo tiến độ
    //    (1, bù lại 1 `escapeHtml(file.ten_nguoi_nop)` đã bỏ ở dòng phụ vì người nộp nay có cột
    //    riêng); `dsYKien.map(buildMotYKien)` trong cột «Ghi ý kiến» của dòng cha (1). Nút mũi tên
    //    tách thành `buildNutMoRongFile` giữ đúng 4 giá trị của biểu thức nội tuyến cũ.
    //  · Con số chốt lấy THẲNG từ `tools/dem-xss.mjs`, không cộng tay: tổng các khoản kể tên không
    //    bằng đúng +5 vì bộ soát đếm `.map(...)` ra chuỗi HTML khác với `.map(...)` ra lời gọi hàm
    //    dựng. Sửa pin thì chạy lại công cụ, đừng suy từ danh sách trên.
    //
    // 2026-09-11 (đợt 5 — «Kết quả làm được» về cột Nhiệm vụ, cột «Tên file» chứa tên file thật,
    // ô «Ghi ý kiến» thành chữ mở POPUP, tiêu đề cột + người thực hiện căn giữa):
    // **98 → 99 chỗ ghi, 957 → 961 giá trị**.
    //  · +1 SINK và đây là sink ĐẦU TIÊN của đợt này: `content.innerHTML = than` trong popup mới
    //    `moYKienKetQua`. Popup nhật ký của đợt 3 (`moNhatKyFileKetQua`) dựng hoàn toàn bằng
    //    `createElement` + `textContent` nên không có sink nào; popup ý kiến KHÔNG làm vậy được vì
    //    nó phải tái dùng `buildYKienPanel`/`buildMotYKien` — hai hàm trả CHUỖI HTML đã thoát sẵn.
    //    Dựng lại chúng bằng DOM là nhân đôi một chỗ thoát thành hai chỗ để lệch. Thân popup chỉ có
    //    MỘT lần `innerHTML`, mọi giá trị đều đã qua `escapeHtml`/`escapeHtmlAttr`/
    //    `escapeForInlineHandler` bên trong các hàm `build*`.
    //  · KHÔNG có CAN-THOAT mới — TC-SEC-10/11 vẫn xanh với đúng 19 chỗ cũ trong `CO_Y_KHONG_BOC`.
    //  · Các chỗ mới, tất cả DA-THOAT hoặc HTML-LONG: ba đối số `moYKienKetQua(ma, fileId, banId)`
    //    trong onclick của dòng cha (2) và của dòng bản (3, có thêm `b.id`); chuỗi `than` của popup
    //    với `dsY.map(buildMotYKien)` (1); ô «Tên file» mới `task-file-ten-that` mang `title` + chữ
    //    của `tenFileThat` (2). Bù lại, đã BỎ: `dsYKien.map(buildMotYKien)` của cột ý kiến dòng cha,
    //    `dsY.map(buildMotYKien)` của dòng bản, và `escapeForInlineHandler(n.id)` trong onclick
    //    `batTatKetQua(...,'yk')` nay không còn.
    //  · Lại đúng bài học đợt 4: kể tên từng khoản thì tổng KHÔNG khớp +4, vì bộ soát đếm một
    //    `.map` ra chuỗi HTML khác một `.map` ra lời gọi hàm dựng. **Con số ở dòng dưới lấy thẳng từ
    //    `tools/dem-xss.mjs`** — sửa pin thì chạy lại công cụ, đừng suy từ danh sách trên.
    //
    // 2026-09-11 (đợt A — «Ban lãnh đạo kiểm soát» thành MẢNG ở cả ba cấp, 028_supervisor_ids.sql):
    // **99 → 100 chỗ ghi, 961 → 964 giá trị**.
    //  · +1 SINK: `supervisorsBox.innerHTML = buildSupervisorCheckboxesHtml(...)` trong
    //    `napUngVienPhanCong`. Không dùng lại `buildLeaderCheckboxesHtml` rồi tham số hoá tên class,
    //    vì class nằm TRONG thuộc tính HTML và một biến nội suy vào thuộc tính là thêm một điểm phải
    //    thoát; viết hàm riêng với tên class là chuỗi hằng thì chỗ đó không phát sinh gì. Mọi giá trị
    //    người dùng trong hàm mới (`s.id`, `s.name`) đều qua `escapeHtmlAttr`/`escapeHtml`.
    //  · +3 GIÁ TRỊ, cộng trừ khớp đúng: `escapeHtmlAttr(s.id)` và `escapeHtml(s.name)` của hàm mới
    //    (+2); hai chỗ điền sẵn hidden input `value="" + (…supervisorIds || []).join(",") + ""` ở form
    //    công việc và form nhiệm vụ (+2); BỎ được `escapeHtml(laCapHai ? "Ban lãnh đạo kiểm soát" :
    //    "Ban lãnh đạo phụ trách — …")` vì nhãn nay là chuỗi hằng (−1). Tổng +3.
    //  · KHÔNG có CAN-THOAT mới — TC-SEC-10/11 vẫn xanh với đúng 19 chỗ cũ trong `CO_Y_KHONG_BOC`.
    //  · Hai đoạn `<p class="text-xs …">` giải thích luật chọn người là CHỮ THUẦN viết thẳng, không
    //    nội suy gì, nên không vào số đếm.
    //
    // 2026-09-11 (đợt B — «gộp hai trục», cache buster 20260911-03): **giữ 100 chỗ ghi, 964 → 969 giá
    // trị**. SINK không đổi: không có vùng chứa innerHTML nào mới — hàng đề nghị tỷ lệ
    // (`buildChangeApprovalRowHtml`) dựng bằng DOM rồi trả `outerHTML`, không ghi innerHTML.
    //  · +2 CAN-THOAT, cả hai là lời gọi `oNhapTyLeKhai(...)` của khung khai và của dòng khai tạm —
    //    đã ghi lý do ở `CO_Y_KHONG_BOC`, danh sách nay là 21 chỗ. Bộ soát không đọc THÂN hàm nên
    //    không biết đó là hàm DỰNG HTML.
    //  · +3 GIÁ TRỊ còn lại là các chỗ nội suy mới trong cùng hai khung khai tỷ lệ, trong
    //    `cauTinhTrangFile` (tên + lúc ký mốc «TP/PP phê duyệt» của ĐIỂM 7) và trong nhãn đề nghị
    //    tỷ lệ của hàng chờ. Tất cả đều đã qua `escapeHtml`/`escapeHtmlAttr` — TC-SEC-10 xanh.
    //    KHÔNG kể từng khoản thành phép cộng: đúng bài học đợt 4, bộ soát đếm một `.map` ra chuỗi
    //    HTML khác một `.map` ra lời gọi hàm dựng, và con số chốt **lấy thẳng từ `tools/dem-xss.mjs`**
    //    (`node ../tools/dem-xss.mjs` chạy từ `server/`) — sửa pin thì chạy lại công cụ.
    //
    // 2026-09-12 (đợt B bổ sung — «Tình trạng» và «Người thực hiện» ghi Ở TỪNG BẢN, siết người nộp
    // bản ĐẦU, cache buster 20260912-01): **giữ 100 chỗ ghi, 969 → 978 giá trị**.
    //  · SINK không đổi: hai cột mới nằm TRONG các `<tr>` mà `buildDongBanKetQua`/`buildKhoiFile`
    //    đã trả từ trước, và dải chú «ai nộp được bản đầu» chỉ là một `<span>` trong chuỗi dựng sẵn
    //    của `buildKhungDanhSachKetQua`. Không có vùng chứa `innerHTML` nào mới.
    //  · KHÔNG có CAN-THOAT mới — TC-SEC-10/11 vẫn xanh với đúng 21 chỗ cũ trong `CO_Y_KHONG_BOC`.
    //    Các hàm đọc dữ liệu mới (`tinhTrangMotBan`, `nguoiThucHienCuaBan`, `nguoiTaoBan`,
    //    `vaiNgan`) chỉ TRẢ CHUỖI, không dựng HTML — mọi nội suy đều nằm ở chỗ gọi và đều đã qua
    //    `escapeHtml`/`escapeHtmlAttr`.
    //  · Các chỗ mới: ô 7 của DÒNG BẢN từ một mình `escapeHtml(b.ten_nguoi_nop)` thành NHÃN + TÊN
    //    kèm `title` (3 giá trị); ô 9 của DÒNG BẢN từ Ô TRỐNG thành badge tình trạng của bản mang
    //    lớp màu, `title` và chữ (3); ô 7 của DÒNG CHA đổi nguồn sang `ten_nguoi_thuc_hien` và thêm
    //    `title` phân biệt «chưa gán người thực hiện» (2 thay 1); `doiNguoiNop` nói rõ ai nộp được
    //    khi nhóm 0 bản mà người xem không phải người thực hiện (1); dải chú cùng ý ở đầu khung khi
    //    bảng RỖNG (1).
    //  · Vẫn đúng bài học đợt 4: kể tên từng khoản thì tổng KHÔNG khớp +9, vì bộ soát đếm một `.map`
    //    ra chuỗi HTML khác một `.map` ra lời gọi hàm dựng. Con số ở dòng dưới **lấy thẳng từ
    //    `tools/dem-xss.mjs`** (`node ../tools/dem-xss.mjs` chạy từ `server/`) — sửa pin thì chạy lại
    //    công cụ, đừng suy từ danh sách trên.
    //
    // 2026-09-12 (đợt B bổ sung — MỚI-3 «cột cho biết đây là duyệt cái gì» + nút «Xem các thay đổi»,
    // cache buster 20260912-02): **100 → 101 chỗ ghi, 978 → 986 giá trị**.
    //  · +1 SINK: `content.innerHTML = than` trong `moPopupThayDoiChoDuyet` — popup «Xem các thay đổi».
    //    `than` là chuỗi `.map(buildNhatKyDong).join("")`, TÁI DÙNG đúng hàm dựng dòng nhật ký của tab
    //    «Nhật ký» (hàm đó tự thoát từng giá trị), chứ không viết một bộ dựng mới. Khung popup còn lại
    //    (tiêu đề, nút «Đóng») dựng bằng `textContent` theo khuôn `moYKienKetQua`.
    //  · +2 CAN-THOAT, cả hai là lời gọi `nhanDuyetHtml(...)` của bảng «Chờ duyệt» và bảng «Yêu cầu
    //    xoá» — hàm TRẢ VỀ chuỗi HTML nên bộ soát không đọc thân hàm, đúng khuôn `o(...)` và
    //    `oNhapTyLeKhai(...)` cũ; đã ghi lý do ở `CO_Y_KHONG_BOC`, danh sách nay là 23 chỗ. Builder thứ
    //    ba (`buildChangeApprovalRowHtml`) dựng DOM với `textContent` nên không phát sinh chỗ nào.
    //  · `cfg.mau` (tên class Tailwind của nhãn) nằm TRONG thuộc tính `class` và tuy là hằng đóng băng
    //    vẫn được bọc `escapeHtmlAttr`, để khỏi phải khai thêm một ngoại lệ — theo đúng lệ cũ của
    //    `oNhapTyLeKhai` (thoát cả `cls` viết tay).
    //  · +8 GIÁ TRỊ còn lại là các chỗ nội suy mới của ba builder: nhãn đối tượng (`loai`) và `title`
    //    «Thuộc công việc: …» ở cả hai bảng chờ; `data-moc-xu-ly` (mốc MÁY CHỦ trả kèm, đưa thẳng vào
    //    thuộc tính nên phải thoát); tiêu đề và `title` của nút «Xem các thay đổi». Tất cả đều đã qua
    //    `escapeHtml`/`escapeHtmlAttr` — TC-SEC-10 xanh. KHÔNG kể từng khoản thành phép cộng: con số
    //    chốt **lấy thẳng từ `tools/dem-xss.mjs`** (`node ../tools/dem-xss.mjs` chạy từ `server/`).
    expect({ sink: sinks.length, gia_tri: sites.length }).toEqual({ sink: 101, gia_tri: 986 });
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

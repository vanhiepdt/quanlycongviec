// MẪU để kiểm chính bộ soát XSS (`tests/helpers/xss-audit.js`) — không phải mã chạy thật.
//
// Vì sao cần file này: `tests/unit/xss-guard.test.js` chỉ nói "app.js không còn lỗ nào". Một bộ soát
// bị hỏng (ví dụ máy trạng thái ngữ cảnh trượt, hay acorn phân tích trượt) cũng cho ra "không còn lỗ
// nào" — xanh mà vô nghĩa. File này có sẵn những lỗ ĐÃ BIẾT ở đủ các ngữ cảnh; nếu bộ soát không
// bắt được chúng thì test đỏ.
//
// Mọi hàm đều export để eslint không báo "khai mà không dùng"; không nơi nào import file này.

function escapeHtml(value) {
  return String(value);
}
function escapeForInlineHandler(value) {
  return String(value);
}
function safeUrl(value) {
  return String(value);
}

/** Lỗ giữa hai thẻ. */
export function loTrongChu(x) {
  return '<div>' + x + '</div>';
}

/** Đã bọc — bộ soát phải xếp là DA-THOAT. */
export function chuDaBoc(x) {
  return '<div>' + escapeHtml(x) + '</div>';
}

/** Lỗ trong thuộc tính có dấu bao. */
export function loTrongThuocTinh(x) {
  return '<div title="' + x + '"></div>';
}

/** href chỉ thoát HTML mà KHÔNG qua safeUrl: `javascript:alert(1)` vẫn chạy. */
export function hrefThieuSafeUrl(x) {
  return '<a href="' + escapeHtml(x) + '">mở</a>';
}

/** href đúng. */
export function hrefDung(x) {
  return '<a href="' + escapeHtml(safeUrl(x)) + '">mở</a>';
}

/** Trong chuỗi JS của on* mà chỉ thoát HTML: thực thể được giải mã trước khi JS đọc ⇒ vẫn thoát ra. */
export function onclickChiThoatHtml(x) {
  return '<button onclick="f(\'' + escapeHtml(x) + '\')">x</button>';
}

/** Trong chuỗi JS của on*, thoát đúng cách. */
export function onclickDung(x) {
  return '<button onclick="f(\'' + escapeForInlineHandler(x) + '\')">x</button>';
}

/** Trong on* nhưng NGOÀI chuỗi JS (chỗ này phải soát tay: là số hay là mã?). */
export function onclickNgoaiChuoi(i) {
  return '<button onclick="f(' + i + ')">x</button>';
}

/** Thuộc tính không có dấu bao: giá trị hở ra ngoài, thêm được thuộc tính mới. */
export function thuocTinhKhongDauBao(x) {
  return '<div class=' + escapeHtml(x) + '></div>';
}

/** Lỗ trong thẻ, không thuộc thuộc tính nào. */
export function loTrongThe(x) {
  return '<div ' + x + '></div>';
}

/** Ghi thẳng biến chữ vào trang. */
export function ghimThang(el, x) {
  el.innerHTML = x;
}

/** Ghi HTML dựng sẵn — hợp lệ. */
export function ghiHtmlDung(el, x) {
  el.innerHTML = '<div>' + escapeHtml(x) + '</div>';
}

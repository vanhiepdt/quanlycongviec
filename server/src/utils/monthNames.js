// TÊN THEO THÁNG — phần THUẦN (không CSDL, không Express) của yêu cầu 2026-08-28.
//
// Một đầu việc kéo dài nhiều tháng được đặt tên riêng cho từng tháng TIẾP THEO; xem theo tháng nào
// thì hiện tên của tháng đó, chưa đặt thì dùng tên gốc. Toàn bộ luật «tháng nào thuộc đầu việc»,
// «tháng nào được sửa» và «hiện tên nào» nằm ở đây để test được bằng dữ liệu giả, và để CHỈ CÓ MỘT
// chỗ định nghĩa chúng ở phía máy chủ (bản song song phía trình duyệt nằm trong `app.js`, có test
// jsdom riêng đối chiếu).
//
// Tháng luôn là chuỗi 'YYYY-MM' — cùng dạng với bộ lọc tháng của `works.list` và của giao diện.

/** Dạng tháng hợp lệ. Dùng cho cả zod schema của route và các hàm dưới đây. */
export const MAU_THANG = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Chuỗi/Date/timestamp → 'YYYY-MM'; không đọc được thì `''`. */
export function thangCua(value) {
  if (value == null || value === '') return '';
  // Cột `date` của pg về JS là `Date`; RPC và JSON lại đưa chuỗi 'YYYY-MM-DD'. Nhận cả hai.
  const text =
    value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
      : String(value).slice(0, 7);
  return MAU_THANG.test(text) ? text : '';
}

/**
 * Danh sách tháng mà một đầu việc phủ qua, từ tháng bắt đầu tới tháng kết thúc.
 *
 * Thiếu MỘT trong hai đầu ⇒ mảng RỖNG chứ không đoán: không biết việc dài bao nhiêu tháng thì không
 * có tháng nào để đặt tên riêng. Ngày kết thúc trước ngày bắt đầu (dữ liệu cũ có) ⇒ cũng rỗng, thay
 * vì vòng lặp chạy ngược không bao giờ dừng.
 */
export function thangCuaKhoang(start, end) {
  const dau = thangCua(start);
  const cuoi = thangCua(end);
  if (!dau || !cuoi || cuoi < dau) return [];
  const ra = [];
  let nam = Number(dau.slice(0, 4));
  let thang = Number(dau.slice(5, 7));
  // Chặn trên 240 tháng (20 năm): dữ liệu nhập sai năm (2026 → 9999) không được biến một vòng lặp
  // hiển thị thành treo máy chủ.
  for (let i = 0; i < 240; i++) {
    const khoa = `${nam}-${String(thang).padStart(2, '0')}`;
    ra.push(khoa);
    if (khoa === cuoi) break;
    thang += 1;
    if (thang > 12) {
      thang = 1;
      nam += 1;
    }
  }
  return ra;
}

/** Đầu việc có kéo dài HƠN một tháng không — điều kiện để hiện chức năng (yêu cầu R1). */
export function nhieuThangHonMot(start, end) {
  return thangCuaKhoang(start, end).length > 1;
}

/**
 * Các tháng ĐƯỢC ĐẶT TÊN RIÊNG: mọi tháng TRỪ tháng đầu.
 *
 * Người dùng nói «sửa tên trong các tháng TIẾP THEO»: tháng đầu tiên chính là tên gốc của đầu việc,
 * sửa nó là sửa tên đầu việc (đã có ô Tên trong form), nên nó không có mặt ở đây.
 */
export function thangSuaDuoc(start, end) {
  return thangCuaKhoang(start, end).slice(1);
}

/** Khoá bản đồ. `works` id 5 và `work_items` id 5 là hai dòng khác nhau — không bao giờ gộp khoá. */
export const khoaThang = (kind, id) => `${kind}:${id}`;

/**
 * Các dòng `work_month_names` → `Map` khoá `'work:5'` / `'item:5'` → `{ 'YYYY-MM': 'tên' }`.
 *
 * Nhận nguyên dòng CSDL (`work_id`/`item_id`/`month`/`name`) để đường đọc không phải nặn lại dữ
 * liệu trước khi gọi.
 */
export function banDoTenThang(rows = []) {
  const banDo = new Map();
  for (const row of rows) {
    const kind = row.work_id != null ? 'work' : 'item';
    const id = row.work_id != null ? row.work_id : row.item_id;
    if (id == null) continue;
    const khoa = khoaThang(kind, id);
    if (!banDo.has(khoa)) banDo.set(khoa, {});
    banDo.get(khoa)[String(row.month)] = String(row.name ?? '');
  }
  return banDo;
}

/**
 * Gắn `month_names` lên từng dòng đọc ra. Trả BẢN SAO nông (không sửa dòng gốc) đúng như
 * `attachRefs` của nhật ký: dòng gốc còn được dùng để so sánh quyền / tính thống kê ở chỗ khác.
 *
 * Dòng không có tên riêng tháng nào vẫn nhận `{}` — giao diện đọc `row.month_names[thang]` mà không
 * phải kiểm tồn tại trước.
 */
export function ganTenThang(rows = [], banDo = new Map(), kind = 'work') {
  return rows.map((row) => ({ ...row, month_names: banDo.get(khoaThang(kind, row.id)) ?? {} }));
}

/** Tên hiển thị cho một tháng: có tên riêng thì dùng, không thì tên gốc (yêu cầu R3/R4). */
export function tenTheoThang(tenGoc, banDoCuaDong, thang) {
  const rieng = thang && banDoCuaDong ? banDoCuaDong[thang] : '';
  const sach = String(rieng ?? '').trim();
  return sach === '' ? String(tenGoc ?? '') : sach;
}

/**
 * Tên GỐC để hiện khi rê chuột — CHỈ khi tháng đang xem có tên riêng KHÁC tên gốc (yêu cầu R6).
 *
 * Trả `''` khi không có gì để nói: giao diện lấy đúng chuỗi rỗng làm dấu «đừng thêm dòng Tên gốc»,
 * không phải in ra "—".
 */
export function tenGocNeuDaDoi(tenGoc, banDoCuaDong, thang) {
  const hienThi = tenTheoThang(tenGoc, banDoCuaDong, thang);
  return hienThi === String(tenGoc ?? '') ? '' : String(tenGoc ?? '');
}

export default {
  MAU_THANG,
  thangCua,
  thangCuaKhoang,
  nhieuThangHonMot,
  thangSuaDuoc,
  khoaThang,
  banDoTenThang,
  ganTenThang,
  tenTheoThang,
  tenGocNeuDaDoi,
};

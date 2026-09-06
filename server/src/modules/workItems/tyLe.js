// Luật chia TỶ LỆ CÔNG VIỆC (8b lỗi 2) — hàm THUẦN, không đụng CSDL.
//
// Mỗi công việc cấp 1 có một tập «mục thuộc diện» mang tỷ lệ: các việc con cấp 2 và các nhiệm vụ
// cấp 3 KHÔNG nằm trong việc con nào (parent_id NULL). Tổng tỷ lệ của tập luôn ĐÚNG 100 — số
// nguyên, không có cảnh 99,97%. Ba biến động phải giữ bất biến đó:
//   THÊM mục  — mục mới nhận phần đều 100/n, các mục cũ co lại THEO ĐÚNG tỷ lệ đang có (giữ
//               những chỗ lãnh đạo đã chỉnh tay, người dùng chốt «tự co giãn, giữ chỉnh tay»).
//   XOÁ mục   — phần của mục mất chia lại cho các mục còn lại cũng theo tỷ lệ.
//   SỬA tay   — các mục khác co/giãn về đúng 100 − giá trị mới.
//
// Cách làm tròn: nhân chia ra số thực rồi lấy sàn, phần dư (luôn < số mục) dồn cho các mục có
// phần LẺ lớn nhất, hoà thì mục đứng trước thắng — phép «số dư lớn nhất» quen thuộc của các bài
// toán chia ghế, đảm bảo tổng khớp tuyệt đối.
//
// Đối tượng nào mang tỷ lệ là việc của `laDauMuc` — service dùng cùng hàm này để quyết có cân lại
// hay không, nên luật «ai thuộc diện» chỉ khai ở MỘT chỗ.

export const TONG = 100;

/** Mục thuộc diện mang tỷ lệ: cấp 2 (việc con), hoặc cấp 3 độc lập (không cha). */
export function laDauMuc(row) {
  const level = Number(row?.level);
  if (level === 2) return true;
  return level === 3 && row?.parent_id == null;
}

/** Chia đều `tong` thành `n` phần nguyên; phần dư dồn cho các phần đứng đầu. n ≤ 0 ⇒ []. */
export function chiaDeuTheoTong(tong, n) {
  if (n <= 0) return [];
  const base = Math.floor(tong / n);
  const du = tong - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < du ? 1 : 0));
}

/** Chia đều 100 thành `n` phần nguyên — mặc định khi tạo mới / khi không còn tỷ lệ nào để bám. */
export const chiaDeu = (n) => chiaDeuTheoTong(TONG, n);

/**
 * Co/giãn mảng `cu` về tổng ĐÚNG `tongMoi`, giữ tỷ lệ giữa các phần tử.
 * `cu` có tổng 0 (hoặc `tongMoi` ≤ 0 không còn gì để chia lệch) ⇒ CHIA ĐỀU thay vì chia theo tỷ
 * lệ 0 — đó là lối thoát cho dữ liệu lệch: thà đều còn hơn khoá cứng ở toàn số 0.
 */
export function coGiuTyLe(cu, tongMoi) {
  if (!cu || cu.length === 0) return [];
  const so = cu.map((v) => Math.max(0, Number(v) || 0));
  const tongCu = so.reduce((a, b) => a + b, 0);
  if (tongCu <= 0 || tongMoi <= 0) return chiaDeuTheoTong(Math.max(0, tongMoi), cu.length);
  const scaled = so.map((v) => (v * tongMoi) / tongCu);
  const ketQua = scaled.map(Math.floor);
  let du = tongMoi - ketQua.reduce((a, b) => a + b, 0);
  const thuTu = scaled
    .map((v, i) => ({ i, le: v - Math.floor(v) }))
    .sort((a, b) => b.le - a.le || a.i - b.i);
  for (let k = 0; du > 0 && k < thuTu.length; k += 1, du -= 1) ketQua[thuTu[k].i] += 1;
  return ketQua;
}

/**
 * THÊM một mục vào vị trí `viTri` (0-based, trong danh sách SAU khi thêm). Mục mới nhận phần đều
 * 100/n; các mục cũ co về 100 − phần mới theo tỷ lệ đang có. Trả mảng mới dài cu.length + 1.
 */
export function chiaKhiThem(cu, viTri) {
  const hienCo = (cu ?? []).map((v) => Math.max(0, Number(v) || 0));
  const n = hienCo.length + 1;
  const moi = Math.round(TONG / n);
  const conLai = coGiuTyLe(hienCo, TONG - moi);
  const ketQua = conLai.slice();
  const viTriSach = Math.max(0, Math.min(Number(viTri) || 0, n - 1));
  ketQua.splice(viTriSach, 0, moi);
  return ketQua;
}

/**
 * XOÁ một mục — nhận mảng các mục CÒN LẠI với tỷ lệ hiện có của chúng, co về đúng 100.
 * Chỉ còn một mục ⇒ mục đó gánh cả 100; không còn mục nào ⇒ [].
 */
export function chiaKhiXoa(conLai) {
  const so = (conLai ?? []).map((v) => Math.max(0, Number(v) || 0));
  if (so.length === 1) return [TONG];
  return coGiuTyLe(so, TONG);
}

/**
 * SỬA tay một ô: đặt mục `viTri` thành `giaTri` (kẹp 0..100, làm tròn), các mục còn lại co/giãn
 * về đúng 100 − giaTri theo tỷ lệ đang có. Chỉ một mục ⇒ luôn [100] (tổng bắt buộc đúng 100).
 */
export function chiaKhiSua(hienTai, viTri, giaTri) {
  const so = (hienTai ?? []).map((v) => Math.max(0, Number(v) || 0));
  if (so.length === 0) return [];
  const v = Math.max(0, Math.min(TONG, Math.round(Number(giaTri) || 0)));
  if (so.length === 1) return [TONG];
  const conLai = coGiuTyLe(so.filter((_, i) => i !== viTri), TONG - v);
  const ketQua = so.slice();
  ketQua[viTri] = v;
  let k = 0;
  for (let i = 0; i < ketQua.length; i += 1) {
    if (i !== viTri) ketQua[i] = conLai[k++];
  }
  return ketQua;
}

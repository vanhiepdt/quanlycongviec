// TIẾN ĐỘ tính từ file kết quả (8b lỗi 2) — hàm THUẦN, không đụng CSDL.
//
// Luật người dùng chốt: tiến độ KHÔNG còn là con số nhập tay; một mục hoàn thành bao nhiêu phần
// trăm là do các FILE KẾT QUẢ của nó đã nộp và được duyệt đến đâu.
//
// Đơn vị đếm là NHÓM file (bảng task_files), KHÔNG phải bản (task_file_versions): mỗi nhóm là một
// kết quả đã khai, đi riêng một luồng nộp → góp ý → duyệt. Nhóm ở trạng thái kết thúc
// ('hoan-thanh' hoặc 'da-duyet') là XONG; mọi trạng thái khác — kể cả nhóm «Chưa có» 0 bản của
// 016 — là CHƯA XONG. Khai kết quả ra mà chưa nộp cũng là chưa hoàn thành kết quả đó, nên nhóm
// 0 bản vẫn đếm vào MẪU (và nhờ vậy câu đếm không cần JOIN bản nào).
//
// Mục KHÔNG có nhóm kết quả nào ⇒ tiến độ 0% (người dùng chốt «tính 0%» — không phải «bỏ qua»).
//
// Ghép tầng: nhiệm vụ cấp 3 tính trên file của chính nó; việc con cấp 2 tính gộp file của chính
// nó + của các nhiệm vụ cấp 3 nằm trong nó — tiến độ của việc con vì thế phản ánh cả đội hình bên
// trong. Tiến độ công việc cấp 1 là bình quân GIA QUYỀN theo tỷ lệ công việc (tyLe.js) của các
// mục thuộc diện; file của nhiệm vụ nằm trong việc con đã được việc con gánh, không đếm hai lần.
import { laDauMuc } from './tyLe.js';

/** Trạng thái KẾT THÚC của một nhóm file — hết lượt nộp/sửa, kết quả được chốt. */
export const TRANG_THAI_XONG = ['hoan-thanh', 'da-duyet'];

/**
 * Gắn `tien_do` (0..100) lên MỖI dòng trong `items` (sửa tại chỗ, trả lại chính mảng ấy).
 *
 * @param {object[]} items các dòng work_items — phải ĐỦ họ của một công việc (cha lẫn con) để
 *   việc con cấp 2 gộp đúng con mình; lẫn dòng của công việc khác cũng không sao vì chỉ ghép
 *   theo parent_id trong chính danh sách.
 * @param {Map} demTheoItem itemId → { tong, xong } — số nhóm file và số nhóm đã kết thúc
 *   (repo.taskFiles.demNhomFileTheoItem). Khoá được String() hoá: pg trả bigint dạng chuỗi, còn
 *   đồ thị test có thể xây bằng số.
 */
export function ganTienDo(items, demTheoItem) {
  const danhSach = items ?? [];
  const demCua = (id) => demTheoItem?.get(String(id)) ?? { tong: 0, xong: 0 };

  // Con của mỗi việc con — chỉ cần trong danh sách đang có.
  const conTheoCha = new Map();
  for (const row of danhSach) {
    if (Number(row.level) === 3 && row.parent_id != null) {
      const khoa = String(row.parent_id);
      if (!conTheoCha.has(khoa)) conTheoCha.set(khoa, []);
      conTheoCha.get(khoa).push(row);
    }
  }

  for (const row of danhSach) {
    let tong = 0;
    let xong = 0;
    const cuaMinh = demCua(row.id);
    tong += cuaMinh.tong;
    xong += cuaMinh.xong;
    if (Number(row.level) === 2) {
      for (const con of conTheoCha.get(String(row.id)) ?? []) {
        const cuaCon = demCua(con.id);
        tong += cuaCon.tong;
        xong += cuaCon.xong;
      }
    }
    row.tien_do = tong > 0 ? Math.round((xong * 100) / tong) : 0;
  }
  return danhSach;
}

/**
 * Tiến độ chung của MỘT công việc: bình quân gia quyền theo `ty_le` của các mục thuộc diện
 * (đã gắn `tien_do` bởi ganTienDo). Không mục nào thuộc diện hoặc tổng tỷ lệ 0 ⇒ 0.
 */
export function tienDoWork(items) {
  let tu = 0;
  let mau = 0;
  for (const row of items ?? []) {
    if (!laDauMuc(row)) continue;
    const tyLe = Math.max(0, Number(row.ty_le) || 0);
    if (tyLe <= 0) continue;
    mau += tyLe;
    tu += tyLe * (Math.max(0, Number(row.tien_do) || 0));
  }
  return mau > 0 ? Math.round(tu / mau) : 0;
}

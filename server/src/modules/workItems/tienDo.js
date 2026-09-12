// TIẾN ĐỘ tính từ file kết quả (8b lỗi 2) — hàm THUẦN, không đụng CSDL.
//
// Luật người dùng chốt: tiến độ KHÔNG còn là con số nhập tay; một mục hoàn thành bao nhiêu phần
// trăm là do các FILE KẾT QUẢ của nó đã nộp và được duyệt đến đâu.
//
// V2: mỗi NHÓM có ty_le và tiến độ theo mốc cấu hình. Chưa có bản = 0%;
// Cần sửa/đang duyệt = 20/40/50/80% mặc định. Nhóm 0 bản vẫn có trọng số ở mẫu số.
// tong/xong vẫn đếm nhị phân để không đổi hợp đồng cũ; tính tiến độ ưu tiên tổng trọng số.
//
// Mục KHÔNG có nhóm kết quả nào ⇒ tiến độ 0% (người dùng chốt «tính 0%» — không phải «bỏ qua»).
//
// Nhiệm vụ cấp 3 tính từ nhóm kết quả của nó. Công việc con cấp 2 lấy bình quân gia quyền
// tiến độ nhiệm vụ con theo ty_le nội bộ; tổng khác 100 thì chia cho tổng tỷ lệ thực tế.
// Công việc cấp 1 tiếp tục lấy bình quân gia quyền các đầu mục trực thuộc (tyLe.js).
import { laDauMuc } from './tyLe.js';

/** Trạng thái KẾT THÚC của một nhóm file — hết lượt nộp/sửa, kết quả được chốt. */
export const TRANG_THAI_XONG = ['hoan-thanh', 'da-duyet'];

/**
 * Gắn `tien_do` (0..100) lên MỖI dòng trong `items` (sửa tại chỗ, trả lại chính mảng ấy).
 *
 * @param {object[]} items các dòng work_items — phải ĐỦ họ của một công việc (cha lẫn con) để
 *   việc con cấp 2 gộp đúng con mình; lẫn dòng của công việc khác cũng không sao vì chỉ ghép
 *   theo parent_id trong chính danh sách.
 * @param {Map} demTheoItem itemId → { tong, xong, tongTyLe, tienDoCoTrongSo }
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
    const {
      tong,
      xong,
      daDuyetCoBan = 0,
      tongTyLe,
      tienDoCoTrongSo,
      files = [],
      duyetLuc = null,
    } = demCua(row.id);
    // Không suy từ %: nhóm trọng số 0 hoặc làm tròn 100 vẫn phải được duyệt đủ.
    row.hoan_thanh = tong > 0 && daDuyetCoBan === tong;
    row.hoan_thanh_luc = row.hoan_thanh ? duyetLuc : null;
    row.ket_qua_files = files;
    // Dữ liệu repo mới có tổng trọng số; hợp đồng tong/xong cũ vẫn đọc được bởi hàm thuần.
    row.tien_do =
      tongTyLe !== undefined
        ? tongTyLe > 0
          ? Math.round(tienDoCoTrongSo / tongTyLe)
          : 0
        : tong > 0
          ? Math.round((xong * 100) / tong)
          : 0;
  }
  for (const row of danhSach) {
    if (Number(row.level) !== 2) continue;
    const children = conTheoCha.get(String(row.id)) ?? [];
    const total = children.reduce((sum, child) => sum + Math.max(0, Number(child.ty_le ?? 1)), 0);
    const done = children.reduce(
      (sum, child) => sum + Math.max(0, Number(child.ty_le ?? 1)) * child.tien_do,
      0
    );
    row.tien_do = total > 0 ? Math.round(done / total) : 0;
    row.hoan_thanh = children.length > 0 && children.every((child) => child.hoan_thanh === true);
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
    tu += tyLe * Math.max(0, Number(row.tien_do) || 0);
  }
  return mau > 0 ? Math.round(tu / mau) : 0;
}

/** Hoàn thành cấp 1: có đầu mục và tất cả đầu mục hoàn thành, kể cả trọng số 0. */
export function hoanThanhWork(items) {
  const heads = (items ?? []).filter(laDauMuc);
  return heads.length > 0 && heads.every((row) => row.hoan_thanh === true);
}
export function ganTienDoWorks(works, items) {
  const byWork = new Map();
  for (const item of items) {
    const key = String(item.work_id);
    if (!byWork.has(key)) byWork.set(key, []);
    byWork.get(key).push(item);
  }
  for (const work of works) {
    const children = byWork.get(String(work.id)) ?? [];
    work.tien_do = tienDoWork(children);
    work.hoan_thanh = hoanThanhWork(children);
  }
  return works;
}
export function nhanKetQua(row) {
  return row.hoan_thanh === true ? 'Đã duyệt đủ kết quả' : 'Chưa duyệt đủ kết quả';
}

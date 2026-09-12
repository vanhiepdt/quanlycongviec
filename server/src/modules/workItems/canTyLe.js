// Cân lại TỶ LỆ CÔNG VIỆC của một công việc cấp 1 — phần điều phối CSDL.
//
// Tách ra khỏi `workItems/service.js` ở ĐỢT B (11/09/2026) vì R4'' đưa việc sửa tỷ lệ qua
// `approval_changes`: `approvals/tyLe.js` phải áp được một lượt đổi tỷ lệ khi đề nghị được duyệt,
// mà `workItems/service.js` lại import `approvals/changes.js` — để hàm này ở đó là thành vòng import.
// Luật chia vẫn là các hàm THUẦN trong `tyLe.js`; ở đây chỉ đọc trạng thái mới nhất trong cùng giao
// dịch, tính mảng tỷ lệ mới và ghi đúng những dòng thực sự đổi.
import * as repo from './repo.js';
import { chiaKhiSua, chiaKhiThem, chiaKhiXoa } from './tyLe.js';

/**
 * Cân lại tỷ lệ của MỘT công việc sau thêm / xoá / sửa. Luôn gọi BÊN TRONG giao dịch vừa gây biến
 * động và SAU câu ghi cấu trúc — để `repo.listTyLe` đọc đúng bức tranh mới.
 *
 * @param {string|number} workId công việc cần cân
 * @param {object} client kết nối của giao dịch đang mở (BẮT BUỘC: hàm ghi, không được dùng pool chung)
 * @param {object} cho biết biến động nào: `themId` / `xoaId` / `suaId` (+ `suaGiaTri`)
 * @returns {Promise<Map<string, number>>} id → tỷ lệ MỚI của những dòng bị đổi, để bên gọi vá dòng
 *   trả về (RETURNING của câu ghi cấu trúc chạy trước khi cân nên giá trị trong đó đã cũ).
 */
export async function canLaiTyLeWork(
  workId,
  client,
  { themId = null, xoaId = null, suaId = null, suaGiaTri = null } = {}
) {
  const rows = await repo.listTyLe(workId, client);
  const values = rows.map((r) => Number(r.ty_le) || 0);
  let ketQua;
  if (themId != null) {
    const viTri = rows.findIndex((r) => String(r.id) === String(themId));
    if (viTri < 0) return new Map(); // không (còn) thuộc diện của công việc này — không đụng
    ketQua = chiaKhiThem(
      values.filter((_, i) => i !== viTri),
      viTri
    );
  } else if (xoaId != null) {
    ketQua = chiaKhiXoa(values);
  } else if (suaId != null) {
    const viTri = rows.findIndex((r) => String(r.id) === String(suaId));
    if (viTri < 0) return new Map();
    ketQua = chiaKhiSua(values, viTri, suaGiaTri);
  } else {
    return new Map();
  }
  const daThayDoi = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    if ((Number(rows[i].ty_le) || 0) !== ketQua[i]) {
      await repo.updateTyLe(rows[i].id, ketQua[i], client);
      daThayDoi.set(String(rows[i].id), ketQua[i]);
    }
  }
  return daThayDoi;
}

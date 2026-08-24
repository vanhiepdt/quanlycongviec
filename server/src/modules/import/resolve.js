// Dò `Họ tên` → `user_id` và `Tên phòng` → `department_id` (§7 việc 2.6).
//
// Bản Sheets lưu **họ tên** ở `Người thực hiện` / `Quản lý dự án` / `Người đề nghị`, và lưu **tên
// phòng** ở cột `Phòng` của người dùng (§13.8). Không có mã, không có khoá ngoại — nên việc nối
// lại chỉ có thể dựa vào chuỗi.
//
// Ba điều KHÔNG được làm (đúng như `migrateV2` của bản cũ đã làm đúng, §4.3):
// - Trùng tên hai người ⇒ **không chọn bừa người đầu tiên**: để NULL, giữ tên, ghi báo cáo.
// - Không tìm thấy ⇒ để NULL, giữ tên, ghi báo cáo.
// - Không tự tạo người dùng mới từ một cái tên lạ.
import { text } from './normalize.js';

/** Khoá so tên: bỏ hoa/thường và khoảng trắng thừa. KHÔNG bỏ dấu — bỏ dấu là gộp oan hai người. */
const nameKey = (v) => text(v).toLowerCase().replace(/\s+/g, ' ');
const emailKey = (v) => text(v).toLowerCase();

/**
 * Bộ dò dựng từ các dòng `users` đang có trong CSDL (đọc sau khi nhập xong bảng `users`).
 * Mỗi phần tử cần `{ id, code, full_name, email }`.
 */
export function createUserResolver(rows) {
  const byName = new Map();
  const byEmail = new Map();
  const byCode = new Map();
  for (const r of rows) {
    const nk = nameKey(r.full_name);
    if (!byName.has(nk)) byName.set(nk, []);
    byName.get(nk).push(r);
    if (text(r.email) !== '') byEmail.set(emailKey(r.email), r);
    if (text(r.code) !== '') byCode.set(text(r.code).toLowerCase(), r);
  }

  /** Trả `{ id, name, problem }`. `problem` khác null là việc phải ghi vào báo cáo. */
  function byNameExact(value, where) {
    const raw = text(value);
    if (raw === '') return { id: null, name: '', problem: null };
    const hits = byName.get(nameKey(raw)) ?? [];
    if (hits.length === 1) return { id: hits[0].id, name: raw, problem: null };
    if (hits.length === 0) {
      return { id: null, name: raw, problem: `${where}: không có người tên "${raw}" ⇒ để NULL` };
    }
    const codes = hits.map((h) => h.code).join(', ');
    return {
      id: null,
      name: raw,
      problem: `${where}: tên "${raw}" trùng ${hits.length} người (${codes}) ⇒ để NULL`,
    };
  }

  /** Ô có thể là email (nhật ký ghi email) hoặc họ tên (các cột còn lại). Thử cả hai. */
  function byEmailOrName(value, where) {
    const raw = text(value);
    if (raw === '') return { id: null, name: '', problem: null };
    const hit = byEmail.get(emailKey(raw));
    if (hit) return { id: hit.id, name: hit.full_name, problem: null };
    return byNameExact(raw, where);
  }

  return {
    byNameExact,
    byEmailOrName,
    byEmail: (value) => byEmail.get(emailKey(value)) ?? null,
    byCode: (value) => byCode.get(text(value).toLowerCase()) ?? null,
    size: rows.length,
  };
}

/** Bộ dò phòng theo TÊN (cột `Phòng` của sheet Người dùng ghi tên, không ghi mã — §13.8). */
export function createDepartmentResolver(rows) {
  const byName = new Map();
  const byCode = new Map();
  for (const r of rows) {
    byName.set(nameKey(r.name), r);
    byCode.set(text(r.code).toLowerCase(), r);
  }
  return {
    /** Tên phòng lạ ⇒ NULL + báo cáo. Không tự tạo phòng mới. */
    byNameExact(value, where) {
      const raw = text(value);
      if (raw === '') return { id: null, problem: null };
      const hit = byName.get(nameKey(raw)) ?? byCode.get(raw.toLowerCase());
      if (hit) return { id: hit.id, problem: null };
      return { id: null, problem: `${where}: không có phòng tên "${raw}" ⇒ để NULL` };
    },
    size: rows.length,
  };
}

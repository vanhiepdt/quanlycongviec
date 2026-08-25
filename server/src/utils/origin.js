// Nguồn gốc một đầu việc và khác biệt giữa hai lần lưu (§2.3, 003_work_origin_and_history.sql).
//
// Câu hỏi người dùng đặt ra: mở một công việc / công việc con / nhiệm vụ lên thì phải thấy ai lập
// ra nó, và nếu nó được giao thì AI GIAO ĐẦU TIÊN. Hai hàm ở đây trả lời:
//
//   `deriveOrigin`  — lúc TẠO: suy ra "Tự đăng ký" hay "Được giao" từ HÀNH VI, không từ vai trò.
//   `diffRows`      — lúc SỬA: liệt kê cột nào đổi từ gì sang gì, để middleware ghi vào nhật ký.
//
// Vì sao suy từ hành vi chứ không từ vai trò: cùng một người Trưởng phòng có thể tự nhận việc về
// mình (tự đăng ký) hoặc lập việc rồi giao cho nhân viên (được giao). Lấy vai trò làm căn cứ thì
// admin tự lập việc cho chính mình cũng bị ghi là "được giao" — sai với điều người dùng muốn thấy.
// Căn cứ đúng là: người nhận việc có phải chính người bấm Tạo hay không.

/** Người nhận việc chưa xác định (chưa gán ai) coi như người lập tự đứng tên. */
const SELF_REGISTERED = 'Tự đăng ký';
const ASSIGNED = 'Được giao';

/**
 * Bộ 6 cột nguồn gốc cho một dòng vừa được tạo.
 *
 * `actor` là người đang bấm Tạo (`req.user`), `recipientId` là người nhận việc — `manager_id` với
 * công việc cấp 1, `assignee_id` với công việc con và nhiệm vụ. `recipientName` chỉ để đối chiếu
 * khi frontend gửi tên mà không gửi id (dữ liệu từ bản Sheets còn nhiều dòng như thế).
 *
 * Không có `actor` (tiến trình nền, script nhập dữ liệu) ⇒ vẫn trả bộ cột hợp lệ với người lập
 * trống, chứ không ném lỗi: `origin` có ràng buộc CHECK nên phải luôn có giá trị.
 */
export function deriveOrigin({ actor = null, recipientId = null, recipientName = null } = {}) {
  const actorId = actor?.id ?? null;
  const actorName = actor?.full_name ?? '';

  const base = {
    created_by: actorId,
    created_by_name: actorName,
    origin: SELF_REGISTERED,
    assigned_by_id: null,
    assigned_by_name: '',
    assigned_at: null,
  };

  // Chưa gán ai, hoặc gán cho chính mình ⇒ tự đăng ký.
  if (actorId == null) return base;
  if (recipientId == null && !recipientName) return base;
  if (recipientId != null && Number(recipientId) === Number(actorId)) return base;
  if (recipientId == null && recipientName && actorName && recipientName === actorName) return base;

  return {
    ...base,
    origin: ASSIGNED,
    assigned_by_id: actorId,
    assigned_by_name: actorName,
    assigned_at: new Date(),
  };
}

/**
 * Gói nguồn gốc để hiện lên đầu mỗi đầu việc: "ai lập / được ai giao".
 *
 * Dùng cho cả `works` và `work_items` — cả ba cấp đều phải trả lời được câu này (§0.1, §2.3).
 * camelCase vì đây là dữ liệu TÍNH RA cho giao diện, không phải cột thô của CSDL (dòng gốc vẫn
 * được trả nguyên hình dạng snake_case bên cạnh).
 *
 * `assignedBy*` là NGƯỜI GIAO ĐẦU TIÊN, không phải người giao gần nhất: trigger `keep_first_origin`
 * không cho ghi đè. Những lần giao lại sau đó nằm trong nhật ký (`activity_logs`).
 */
export function originOf(row) {
  if (!row) return null;
  const origin = row.origin ?? SELF_REGISTERED;
  return {
    origin,
    selfRegistered: origin === SELF_REGISTERED,
    createdById: row.created_by ?? null,
    createdByName: row.created_by_name ?? '',
    assignedById: row.assigned_by_id ?? null,
    assignedByName: row.assigned_by_name ?? '',
    assignedAt: row.assigned_at ?? null,
  };
}

/**
 * So một giá trị trước/sau khi lưu. Cần riêng một hàm vì cùng một dữ liệu ra khỏi CSDL dưới nhiều
 * dạng: `timestamptz` là `Date`, `numeric` là chuỗi, `text[]` là mảng, còn `date` đã được type
 * parser đổi thành chuỗi 'YYYY-MM-DD'. So bằng `===` trần thì mọi lần lưu đều báo "đã đổi".
 */
function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return ta === tb;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

/** Giá trị đưa vào nhật ký phải là JSON được: `Date` thành chuỗi ISO. */
const forLog = (v) => (v instanceof Date ? v.toISOString() : (v ?? null));

/**
 * Khác biệt giữa dòng trước và sau khi lưu, dạng `{ cột: { from, to } }` — đúng thứ giao diện cần
 * để hiện "các lần chỉnh sửa". Không có gì đổi thì trả `null` chứ không phải `{}`: `res.locals`
 * chỉ nên có `changes` khi thật sự có thay đổi, để nhật ký không đầy dòng rỗng.
 *
 * `fields` là danh sách trắng (thường là `WRITABLE` của repo) — nhật ký không được kéo theo cột
 * nào không ai khai, và tuyệt đối không kéo theo `req.body`.
 */
export function diffRows(before, after, fields) {
  if (!before || !after) return null;
  const changes = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    if (sameValue(before[field], after[field])) continue;
    changes[field] = { from: forLog(before[field]), to: forLog(after[field]) };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

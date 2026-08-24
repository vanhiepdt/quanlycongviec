// Chuyển ô văn bản của bản chụp Sheets sang giá trị dùng được cho CSDL.
//
// Mọi hàm trong file này là hàm THUẦN: không đọc CSDL, không đọc file, không ngẫu nhiên (trừ
// `randomTempPassword`). Nhờ vậy phần dễ sai nhất của việc nhập dữ liệu — chuyển đổi kiểu —
// kiểm được bằng unit test, không cần Postgres.
//
// NGÀY: `tools/dump-sheets.js` đã đưa ô ngày về chuỗi `YYYY-MM-DD` (ô chỉ có ngày) hoặc ISO đầy
// đủ kết thúc bằng `Z` (ô có cả giờ), tính theo **UTC**. Ở đây chỉ CẮT phần ngày ra, tuyệt đối
// không `new Date()` rồi format lại theo múi giờ máy đang chạy — đó chính là đường sinh ra lỗi
// lệch một ngày mà §7 Phase 2 cảnh báo (TC-IMP-08/09).
import { randomInt } from 'node:crypto';

/** Ô rỗng của Sheets có thể là null, undefined hoặc chuỗi toàn khoảng trắng. */
export function text(value) {
  return String(value ?? '').trim();
}

/** Chuỗi rỗng → null. Dùng cho cột cho phép NULL (`department_id`, `parent_id`...). */
export function textOrNull(value) {
  const v = text(value);
  return v === '' ? null : v;
}

// Excel đếm ngày từ 30/12/1899. Ô rỗng đi qua một hàm ngày của Excel/Sheets sẽ ra đúng mốc này —
// nó có nghĩa là "không có ngày", KHÔNG phải một ngày thật (TC-IMP-10).
const EXCEL_ZERO_DATE = '1899-12-30';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T[\d:.]+Z?$/;
const DMY = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;

/** Ngày dương lịch có thật? Chặn 31/02, 30/02 và 29/02 của năm không nhuận. */
function isRealDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const max = m === 2 && leap ? 29 : daysInMonth[m - 1];
  return d <= max;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Ô ngày → `{ date, problem }`. `date` là chuỗi `YYYY-MM-DD` hoặc `null`.
 * `problem` khác null khi ô có chữ nhưng không đọc được thành ngày — chỗ gọi phải ghi vào báo
 * cáo. Không bao giờ đoán: đọc không ra thì để NULL và nói ra, chứ không lấy ngày hôm nay.
 */
export function parseDate(value) {
  const raw = text(value);
  if (raw === '') return { date: null, problem: null };

  let y;
  let m;
  let d;
  const iso = ISO_DATE.exec(raw) ?? ISO_DATETIME.exec(raw);
  if (iso) {
    [, y, m, d] = iso;
  } else {
    const dmy = DMY.exec(raw);
    if (!dmy) return { date: null, problem: `không đọc được thành ngày: "${raw}"` };
    [, d, m, y] = dmy;
  }

  const yn = Number(y);
  const mn = Number(m);
  const dn = Number(d);
  if (!isRealDate(yn, mn, dn)) {
    return { date: null, problem: `ngày không có thật: "${raw}"` };
  }
  const out = `${yn}-${pad(mn)}-${pad(dn)}`;
  if (out === EXCEL_ZERO_DATE) {
    return { date: null, problem: 'mốc 30/12/1899 của Excel = ô rỗng, đã để NULL' };
  }
  return { date: out, problem: null };
}

/**
 * Ô ngày+giờ → chuỗi ISO cho cột `timestamptz`, hoặc `null`.
 * Giữ nguyên văn ISO của bản chụp (đã là UTC) để Postgres tự hiểu; ô chỉ có ngày thì lấy 00:00Z.
 */
export function parseTimestamp(value) {
  const raw = text(value);
  if (raw === '') return { at: null, problem: null };
  if (ISO_DATETIME.test(raw)) return { at: raw.endsWith('Z') ? raw : `${raw}Z`, problem: null };
  const { date, problem } = parseDate(raw);
  if (!date) return { at: null, problem };
  return { at: `${date}T00:00:00.000Z`, problem: null };
}

const HHMM = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Ghép cột `Ngày` với `timestamp` dạng `HH:MM` của mỗi tin nhắn trong `Chat JSON` (§4.3).
 * Giờ không đọc được thì vẫn giữ được ngày — mất giờ còn hơn mất tin nhắn.
 */
export function combineDateAndClock(dateValue, clockValue) {
  const { date, problem } = parseDate(dateValue);
  if (!date) return { at: null, problem };
  const hhmm = HHMM.exec(text(clockValue));
  if (!hhmm) {
    return { at: `${date}T00:00:00.000Z`, problem: `giờ không đọc được: "${text(clockValue)}"` };
  }
  const h = Number(hhmm[1]);
  const mi = Number(hhmm[2]);
  const s = Number(hhmm[3] ?? 0);
  if (h > 23 || mi > 59 || s > 59) {
    return { at: `${date}T00:00:00.000Z`, problem: `giờ không có thật: "${text(clockValue)}"` };
  }
  return { at: `${date}T${pad(h)}:${pad(mi)}:${pad(s)}.000Z`, problem: null };
}

/** `Tiến độ (%)` → 0..100. Ô rỗng, chữ, hay số ngoài khoảng đều kẹp lại và nói ra. */
export function parsePercent(value) {
  const raw = text(value).replace('%', '').replace(',', '.');
  if (raw === '') return { percent: 0, problem: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { percent: 0, problem: `tiến độ không phải số: "${raw}"` };
  const clamped = Math.min(100, Math.max(0, Math.round(n)));
  if (clamped !== n) return { percent: clamped, problem: `tiến độ ${raw} → ${clamped}` };
  return { percent: clamped, problem: null };
}

// 6 vai trò của §6, viết ĐÚNG như CHECK `users_role_valid` trong 001_init.sql. Sai một dấu là
// câu INSERT đổ, nên danh sách này là bản sao duy nhất và mọi chỗ khác phải đọc từ đây.
export const VALID_ROLES = Object.freeze([
  'admin',
  'Phó Giám đốc',
  'Trưởng phòng',
  'Phó phòng',
  'Quản lý công việc',
  'Nhân viên',
]);

// Tên cũ ⇄ tên đã chốt. `Quản lý dự án` là từ vựng cũ của **cùng một vai trò**, đã đổi tên ở §0
// nên đổi ở đây là dịch lại từ vựng, không phải đoán quyền.
const ROLE_ALIASES = Object.freeze({ 'quản lý dự án': 'Quản lý công việc' });

/** So khớp vai trò bỏ qua hoa/thường và khoảng trắng thừa — nhưng KHÔNG bỏ qua dấu tiếng Việt. */
const roleKey = (v) => text(v).toLowerCase().replace(/\s+/g, ' ');

/**
 * `Phân quyền` → vai trò hợp lệ. Trả `{ role, changed, unknown }`:
 * - `role` null khi giá trị lạ. Chỗ gọi **không được** đoán thay (TC-IMP-11): dữ liệu thật có
 *   `Admin` chữ A hoa (§13.8) — đó là hoa/thường, sửa được; còn `Trợ lý admin` là giá trị lạ,
 *   phải in ra cho người sửa tay, vì đoán sai ở đây là cấp quyền sai.
 * - `changed` true khi phải chuẩn hoá, để báo cáo in ra từng dòng đã đổi.
 */
export function normalizeRole(value) {
  const raw = text(value);
  if (raw === '') return { role: 'Nhân viên', changed: raw !== 'Nhân viên', unknown: false };
  const key = roleKey(raw);
  const exact = VALID_ROLES.find((r) => roleKey(r) === key);
  if (exact) return { role: exact, changed: exact !== raw, unknown: false };
  const alias = ROLE_ALIASES[key];
  if (alias) return { role: alias, changed: true, unknown: false };
  return { role: null, changed: false, unknown: true };
}

/** `Vai trò phòng` → khớp CHECK `users.dept_role`, hoặc null. Giá trị lạ để null + báo cáo. */
export const VALID_DEPT_ROLES = Object.freeze(['Trưởng phòng', 'Phó phòng', 'Nhân viên']);

export function normalizeDeptRole(value) {
  const raw = text(value);
  if (raw === '') return { deptRole: null, changed: false, unknown: false };
  const hit = VALID_DEPT_ROLES.find((r) => roleKey(r) === roleKey(raw));
  if (hit) return { deptRole: hit, changed: hit !== raw, unknown: false };
  return { deptRole: null, changed: false, unknown: true };
}

/**
 * Ô `Nhiệm vụ JSON` / `Nhật ký JSON` / `Chat JSON` → mảng.
 * Ô rỗng là **hợp lệ** (mảng rỗng), ô hỏng trả `{ ok: false }` — chỗ gọi đếm và liệt kê rồi
 * nhập tiếp công việc khác (TC-IMP-03). Một ô hỏng KHÔNG được làm dừng cả lần nhập: đó đúng là
 * lỗi của bản Sheets mà §13.5 đã ghi.
 */
export function parseJsonArrayCell(value) {
  const raw = text(value);
  if (raw === '') return { ok: true, items: [], empty: true };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, items: [], error: `JSON không đọc được: ${err.message}` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, items: [], error: `JSON không phải mảng mà là ${typeof parsed}` };
  }
  const items = parsed.filter((x) => x !== null && typeof x === 'object' && !Array.isArray(x));
  if (items.length !== parsed.length) {
    return {
      ok: true,
      items,
      empty: false,
      error: `bỏ ${parsed.length - items.length} phần tử không phải object`,
    };
  }
  return { ok: true, items, empty: false };
}

/** Cột email nhiều người: bản cũ tách bằng `;` hoặc `,` (§4.3). Bỏ ô rỗng, bỏ trùng. */
export function splitEmailList(value) {
  const parts = text(value)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return [...new Set(parts.map((s) => s.toLowerCase()))];
}

/** `Link kết quả` của bản cũ: nhiều dòng trong một ô, hoặc đã là mảng JSON. */
export function parseResultLinks(value) {
  if (Array.isArray(value)) return value.map((v) => text(v)).filter((v) => v !== '');
  return text(value)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

// Trạng thái duyệt hợp lệ theo CHECK của `works`/`work_items`. Ô rỗng ⇒ 'Đã duyệt': dữ liệu cũ
// đang được dùng thật, không thể bắt đi duyệt lại (§13.8).
export const VALID_APPROVAL = Object.freeze(['Chờ duyệt', 'Đã duyệt', 'Từ chối']);

export function normalizeApproval(value) {
  const raw = text(value);
  if (raw === '') return { status: 'Đã duyệt', filledDefault: true, unknown: false };
  const hit = VALID_APPROVAL.find((s) => roleKey(s) === roleKey(raw));
  if (hit) return { status: hit, filledDefault: false, unknown: false };
  return { status: 'Đã duyệt', filledDefault: false, unknown: true };
}

/** Một giá trị phải nằm trong danh sách CHECK, lạ thì lấy mặc định và nói ra. */
export function pickFromList(value, allowed, fallback) {
  const raw = text(value);
  if (raw === '') return { value: fallback, unknown: false };
  const hit = allowed.find((s) => roleKey(s) === roleKey(raw));
  if (hit) return { value: hit, unknown: false };
  return { value: fallback, unknown: true };
}

// Bảng chữ đã bỏ các ký tự dễ đọc lẫn (0/O, 1/l/I) vì mật khẩu tạm sẽ được đọc trên giấy rồi
// gõ lại bằng tay.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';

/**
 * Mật khẩu tạm cho tài khoản có mật khẩu RỖNG trong Sheets (§13.8: 2 trong 5 người).
 * 20 ký tự ASCII: dài hơn `MIN_PASSWORD_LENGTH`, ngắn hơn 72 byte của bcrypt, và **ngẫu nhiên
 * bằng crypto** — `Math.random()` đoán được nên không dùng cho mật khẩu.
 */
export function randomTempPassword(length = 20) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

/** Chuỗi trông giống email? Dùng để biết một ô là email hay là họ tên (`Người thực hiện`). */
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
}

// `users.email` là `citext NOT NULL UNIQUE`. Dữ liệu thật có **2 người không có email** (§13.5
// bẫy Phase 2): để chuỗi rỗng thì người thứ hai đổ vì trùng UNIQUE, mà bỏ dòng thì mất người.
// Sinh địa chỉ giữ chỗ theo mã người dùng — tên miền `.invalid` được RFC 2606 dành riêng để
// **không bao giờ** phân giải được, nên không có nguy cơ gửi thư ra ngoài.
export const PLACEHOLDER_EMAIL_DOMAIN = 'khong-co-email.invalid';

export function placeholderEmail(code) {
  const slug =
    text(code)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'khong-ma';
  return `${slug}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** Địa chỉ này là giữ chỗ do công cụ nhập sinh ra, không phải email thật của ai. */
export function isPlaceholderEmail(value) {
  return text(value).toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

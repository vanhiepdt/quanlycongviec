// Cổng gọi Zalo Bot API — CHỖ DUY NHẤT trong hệ thống chạm tới mạng Internet (017, việc B của
// `docs/KE-HOACH-THONG-BAO.md`; §13.4 mục 25 người dùng chốt 2026-09-06: «tôi cầm bot»).
//
// Năm quyết định đáng ghi:
//
//  1. **KHÔNG thêm thư viện.** Node 24 có `fetch` và `AbortSignal.timeout` toàn cục. Gói npm
//     `node-zalo-bot@0.1.6` (phát hành 2025-07-22, không khai license, không khai repository) kéo
//     theo `@cypress/request`, `bl@1.2.3`, `file-type@3.9.0`, `mime@1.6.0` — toàn bản cũ, chỉ để
//     gọi một endpoint POST. Không đáng, và vi phạm ràng buộc «không thêm thư viện mới» của dự án.
//
//  2. **TOKEN NẰM TRONG ĐƯỜNG DẪN**, không phải header — `/bot<token>/sendMessage`. Đây là điểm
//     khác biệt căn bản với mọi bí mật khác của repo (`SESSION_SECRET`, `ONLYOFFICE_JWT_SECRET` chỉ
//     dùng để ký, không bao giờ vào URL). `utils/logger.js` chỉ che 8 đường dẫn cố định về
//     cookie/password, KHÔNG che theo tên biến. Nên: mọi lời gọi log ở đây dùng `TEN_API` (chỉ tên
//     endpoint), và lỗi thô của `fetch` — có `cause` chứa URL đầy đủ — bị BẮT tại đây, thay bằng
//     câu tiếng Việt sạch. Không để nó đi tới errorHandler.
//
//  3. **`ok` trong THÂN phản hồi mới là sự thật, không phải mã HTTP.** Đã kiểm bằng lời gọi thật
//     ngày 2026-09-06: `getWebhookInfo` của một bot chưa đặt webhook trả `{"ok":false,
//     "description":"Not Found","error_code":404}`. Chỉ đọc `res.ok` là hiểu ngược.
//
//  4. **KHÔNG dùng `parse_mode`.** Nội dung tin chứa TÊN ĐẦU VIỆC do người dùng gõ; bật
//     markdown/html là cho phép `*`/`<b>` của họ đổi định dạng tin, và tài liệu Zalo nói rõ ký tự
//     đánh dấu sẽ bị LOẠI khỏi nội dung hiển thị — tên việc có dấu `*` sẽ hiện sai. Gửi văn bản
//     thuần, không định dạng.
//
//  5. **Trống token = TẮT, và tắt thì không gọi mạng lần nào.** `daBat()` là cửa duy nhất; mọi hàm
//     gọi mạng đều hỏi nó trước. Nhờ vậy 88 file test hiện có chạy y như cũ mà không chạm Internet.
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** Giới hạn tài liệu Zalo ghi rõ cho `text` của `sendMessage`: 1–2000 ký tự. */
export const DAI_NHAT_TIN = 2000;

/** Chờ tối đa một lời gọi. 10 giây: đủ cho mạng chậm, không đủ để treo lịch chạy 2 phút. */
const CHO_TOI_DA_MS = 10000;

export function daBat() {
  return String(env.ZALO_BOT_TOKEN || '').trim() !== '';
}

/** Có nhận tin từ bot bằng long polling hay không (chạy được trên PC, không cần domain). */
export function nhanBangPolling() {
  return daBat() && env.ZALO_BOT_NHAN === 'polling';
}

/**
 * Có nhận tin bằng webhook hay không. Cần CẢ secret token: thiếu nó thì không có gì để xác thực
 * request gọi về, mà một webhook không xác thực là để ai cũng liên kết được tài khoản Zalo bất kỳ.
 */
export function nhanBangWebhook() {
  return (
    daBat() &&
    env.ZALO_BOT_NHAN === 'webhook' &&
    String(env.ZALO_BOT_SECRET_TOKEN || '').trim().length >= 8
  );
}

/**
 * Cắt tin về đúng giới hạn, cắt ở RANH GIỚI TỪ khi được.
 *
 * Cắt giữa từ trong tiếng Việt dễ ra chữ vô nghĩa; và cắt giữa một cặp surrogate (emoji) thì Zalo
 * nhận ký tự hỏng. `Array.from` đếm theo ĐIỂM MÃ nên emoji tính là 1, khớp cách người đọc đếm.
 */
export function catTin(text) {
  const s = String(text ?? '').replace(/\s+$/g, '');
  const kyTu = Array.from(s);
  if (kyTu.length <= DAI_NHAT_TIN) return s;
  const cat = kyTu.slice(0, DAI_NHAT_TIN - 1).join('');
  const khoangCuoi = cat.lastIndexOf(' ');
  // Chỉ lùi về khoảng trắng nếu nó không cắt mất quá nhiều (>80% vẫn giữ được).
  const than = khoangCuoi > DAI_NHAT_TIN * 0.8 ? cat.slice(0, khoangCuoi) : cat;
  return than + '…';
}

/** URL của một endpoint. KHÔNG BAO GIỜ log giá trị trả về của hàm này — nó chứa token. */
function duongDan(ten) {
  const base = String(env.ZALO_BOT_API_BASE || '').replace(/\/+$/, '');
  return `${base}/bot${env.ZALO_BOT_TOKEN}/${ten}`;
}

/**
 * Một lời gọi tới Zalo Bot API.
 *
 * Trả `{ ok, ket_qua, loi }` chứ không ném: mọi chỗ gọi đều là đường phụ (đẩy thông báo, trả lời
 * tin nhắn) và KHÔNG được phép làm đổ hành động chính. Ném ở đây là buộc mọi chỗ gọi phải bọc
 * try/catch, rồi sớm muộn có chỗ quên.
 *
 * @param {string} ten tên endpoint, ví dụ 'sendMessage'
 * @param {object} body thân JSON
 * @returns {Promise<{ok: boolean, ket_qua: any, loi: string}>}
 */
async function goi(ten, body = {}) {
  if (!daBat()) return { ok: false, ket_qua: null, loi: 'Chưa cấu hình ZALO_BOT_TOKEN' };
  let res;
  try {
    res = await fetch(duongDan(ten), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CHO_TOI_DA_MS),
    });
  } catch (err) {
    // Lỗi mạng thô của `fetch` mang `cause` chứa URL ĐẦY ĐỦ (kèm token). Bắt tại đây và thay bằng
    // câu sạch; TUYỆT ĐỐI không log `err` nguyên vẹn, không ném nó lên tầng trên.
    const loi =
      err && err.name === 'TimeoutError'
        ? 'Zalo không phản hồi trong 10 giây'
        : 'Không gọi được Zalo';
    logger.error({ api: ten, ten_loi: (err && err.name) || 'Error' }, 'Gọi Zalo Bot API thất bại');
    return { ok: false, ket_qua: null, loi };
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  // `ok` trong THÂN mới là sự thật. HTTP 200 kèm `{"ok":false,...}` là chuyện thường của API này.
  if (!json || json.ok !== true) {
    const loi =
      (json && (json.description || json.message)) ||
      `Zalo trả lỗi (HTTP ${res.status}${json && json.error_code ? `, mã ${json.error_code}` : ''})`;
    logger.error(
      { api: ten, http: res.status, error_code: (json && json.error_code) ?? null, loi },
      'Zalo Bot API trả lỗi'
    );
    return { ok: false, ket_qua: (json && json.result) ?? null, loi };
  }
  return { ok: true, ket_qua: json.result ?? null, loi: '' };
}

/**
 * Gửi một tin văn bản.
 *
 * `chatId` rỗng ⇒ trả lỗi ngay, KHÔNG gọi mạng: người chưa liên kết Zalo là chuyện bình thường
 * (đa số lúc mới bật tính năng), không phải sự cố cần một lượt HTTP để phát hiện.
 */
export function guiTin({ chatId, text }) {
  const chat = String(chatId ?? '').trim();
  if (chat === '') return Promise.resolve({ ok: false, ket_qua: null, loi: 'chưa liên kết Zalo' });
  const noiDung = catTin(text);
  if (noiDung === '')
    return Promise.resolve({ ok: false, ket_qua: null, loi: 'Nội dung tin rỗng' });
  // KHÔNG gửi `parse_mode`: xem quyết định 4 ở đầu file.
  return goi('sendMessage', { chat_id: chat, text: noiDung });
}

/** Kiểm token — `npm run zalo:kiem` dùng. Trả về thông tin bot khi token đúng. */
export function kiemToken() {
  return goi('getMe');
}

/**
 * Lấy các tin mới bằng long polling (chỉ dùng khi `ZALO_BOT_NHAN=polling`).
 *
 * `timeout` là số GIÂY mà Zalo giữ kết nối chờ tin mới (mặc định phía Zalo là 30).
 *
 * Hàm này KHÔNG đi qua `goi()` mà tự gọi `fetch` với hạn chờ riêng: hạn chờ phía mình phải LỚN HƠN
 * `timeout` phía Zalo, nếu không mình tự cắt kết nối trước khi Zalo kịp trả lời và không bao giờ
 * nhận được tin nào. `goi()` cố định 10 giây nên dùng lại là sai.
 */
export async function layTinMoi({ timeout = 25 } = {}) {
  if (!daBat()) return { ok: false, ket_qua: null, loi: 'Chưa cấu hình ZALO_BOT_TOKEN' };
  let res;
  try {
    res = await fetch(duongDan('getUpdates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout }),
      // Hạn chờ phía mình phải LỚN HƠN `timeout` phía Zalo, cộng thêm dư cho mạng.
      signal: AbortSignal.timeout((Number(timeout) + 10) * 1000),
    });
  } catch (err) {
    logger.error(
      { api: 'getUpdates', ten_loi: (err && err.name) || 'Error' },
      'Lấy tin Zalo thất bại'
    );
    return { ok: false, ket_qua: null, loi: 'Không lấy được tin mới từ Zalo' };
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!json || json.ok !== true) {
    const loi = (json && (json.description || json.message)) || `Zalo trả lỗi (HTTP ${res.status})`;
    // `getUpdates` trả lỗi khi đã đặt webhook — hai cơ chế loại trừ lẫn nhau. Log mức warn chứ
    // không error: đó là cấu hình sai, không phải sự cố, và lịch polling gọi lại liên tục.
    logger.warn({ api: 'getUpdates', http: res.status, loi }, 'getUpdates không trả về tin');
    return { ok: false, ket_qua: null, loi };
  }
  return { ok: true, ket_qua: json.result ?? null, loi: '' };
}

/** Đăng ký webhook (chỉ gọi bằng lệnh `npm run zalo:webhook`, không tự chạy). */
export function datWebhook({ url, secretToken }) {
  return goi('setWebhook', { url: String(url ?? ''), secret_token: String(secretToken ?? '') });
}

/** Trạng thái webhook hiện tại. */
export function xemWebhook() {
  return goi('getWebhookInfo');
}

/** Zalo tự thử gọi webhook và trả `outcome` — công cụ chẩn đoán khi không nhận được sự kiện. */
export function thuWebhook() {
  return goi('testWebhook');
}

/** Bỏ webhook (để dùng lại `getUpdates`). */
export function boWebhook() {
  return goi('deleteWebhook');
}

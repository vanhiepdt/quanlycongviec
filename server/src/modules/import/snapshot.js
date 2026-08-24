// Đọc bản chụp do `tools/dump-sheets.js` sinh ra và lấy từng sheet ra một cách an toàn.
//
// Hai điều đã trả giá một lần rồi (§13.5), nên chốt ở đây:
// 1. Tên sheet `Dự án/Nhiệm vụ` bị `.xlsx` xoá dấu `/` thành `Dự ánNhiệm vụ`. Bản chụp đã khớp
//    theo tên CHUẨN HOÁ và giữ tên thật ở `actual_name` — ở đây tra theo tên chuẩn của Sheets.
// 2. Sheet `Thông báo` KHÔNG tồn tại trong tệp tải về. Thiếu nó là chuyện bình thường: nhập 0
//    dòng thông báo và ghi vào báo cáo, **không** được báo lỗi "thiếu sheet bắt buộc" rồi dừng.
import { readFileSync } from 'node:fs';
import { AppError } from '../../utils/errors.js';

/** Sheet nào thiếu thì cả lần nhập vô nghĩa — chỉ có hai sheet này. */
export const HARD_REQUIRED_SHEETS = Object.freeze(['Phòng', 'Người dùng']);

/** Sheet thiếu được: nhập 0 dòng, ghi vào báo cáo. */
export const OPTIONAL_SHEETS = Object.freeze([
  'Dự án/Nhiệm vụ',
  'Đề nghị',
  'Quản lý App',
  'Chat',
  'Thông báo',
]);

const EMPTY_SHEET = Object.freeze({ found: false, actual_name: null, headers: [], rows: [] });

export function loadSnapshot(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new AppError('BAD_REQUEST', `Không đọc được bản chụp "${path}": ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.sheets) {
    throw new AppError(
      'BAD_REQUEST',
      `"${path}" không phải bản chụp của dump-sheets.js (thiếu khoá "sheets")`
    );
  }
  return parsed;
}

/** Lấy một sheet. Không có thì trả sheet rỗng — quyết định "có được thiếu không" ở chỗ gọi. */
export function sheet(snapshot, name) {
  const found = snapshot.sheets?.[name];
  if (!found || found.found !== true) return EMPTY_SHEET;
  return { ...EMPTY_SHEET, ...found, rows: Array.isArray(found.rows) ? found.rows : [] };
}

/** Dừng ngay nếu thiếu sheet không thể thiếu. Trả danh sách sheet thiếu được để ghi báo cáo. */
export function checkSheets(snapshot) {
  const missingRequired = HARD_REQUIRED_SHEETS.filter((n) => !sheet(snapshot, n).found);
  if (missingRequired.length > 0) {
    throw new AppError(
      'BAD_REQUEST',
      `Bản chụp thiếu sheet không thể thiếu: ${missingRequired.join(', ')}. ` +
        'Chạy lại tools/dump-sheets.js trên tệp .xlsx đầy đủ.'
    );
  }
  return OPTIONAL_SHEETS.filter((n) => !sheet(snapshot, n).found);
}

// Bản chụp GIẢ cho test nhập dữ liệu.
//
// BẢO MẬT: test KHÔNG được dùng `data/snapshot-*.json` — tệp đó có email và mật khẩu văn bản
// thuần của người thật. Mọi tình huống của §8.4 nhóm D được dựng lại ở đây bằng dữ liệu bịa,
// nhưng ĐÚNG hình dạng bản chụp thật (tên cột, kiểu ô, cách Google ghi ngày) để test vẫn bắt
// được lỗi thật.
//
// Mỗi dòng dưới đây đều có lý do tồn tại; đừng "dọn cho gọn" mà xoá mất tình huống.

/** Một sheet đúng hình dạng `tools/dump-sheets.js` sinh ra. */
export function sheetOf(headers, rows, actualName = null) {
  return {
    found: true,
    actual_name: actualName,
    headers,
    row_count: rows.length,
    rows: rows.map((r, i) => ({ ...r, __row: i + 2 })),
  };
}

const DEPT_HEADERS = [
  'Mã phòng',
  'Tên phòng',
  'Email Phó GĐ phụ trách',
  'Email Trưởng phòng',
  'Email Phó phòng',
  'Thứ tự',
  'Ghi chú',
];

const USER_HEADERS = [
  'Mã NV',
  'Họ tên',
  'Email',
  'Mật khẩu',
  'Chức vụ',
  'Phân quyền',
  'Đối tượng',
  'Ghi chú',
  'Phòng',
  'Vai trò phòng',
];

const WORK_HEADERS = [
  'Mã dự án',
  'Tên dự án',
  'Mô tả dự án',
  'Quản lý dự án',
  'Ngày bắt đầu',
  'Ngày kết thúc',
  'Trạng thái dự án',
  'Nhiệm vụ JSON',
  'Nhật ký JSON',
  'Phòng',
  'Email quản lý',
  'Trạng thái duyệt',
  'Người duyệt',
  'Ngày duyệt',
  'Lý do từ chối',
];

const PROPOSAL_HEADERS = [
  'Mã đề nghị',
  'Loại',
  'Mã dự án',
  'Mã nhiệm vụ',
  'Nội dung đề nghị',
  'URL đề nghị',
  'Nhà cung cấp',
  'Người đề nghị',
  'Ngày đề nghị',
  'Trạng thái',
  'Ghi chú duyệt',
];

const APP_HEADERS = [
  'Mã App',
  'Tên App',
  'URL',
  'Icon URL',
  'Mô tả',
  'Người tạo',
  'Danh mục',
  'Phân quyền',
];

const CHAT_HEADERS = ['Mã chat', 'Ngày', 'Chat JSON'];

const NOTIFY_HEADERS = ['Mã thông báo', 'Người nhận', 'Nội dung', 'Loại', 'Ngày'];

export {
  APP_HEADERS,
  CHAT_HEADERS,
  DEPT_HEADERS,
  NOTIFY_HEADERS,
  PROPOSAL_HEADERS,
  USER_HEADERS,
  WORK_HEADERS,
};

// ---------------------------------------------------------------- Phòng (4 dòng)
// PH04 cố tình trùng TÊN với PH02: `departments.name` là UNIQUE nên dòng sau phải bị bỏ có lý
// do, không được để câu INSERT đổ giữa lần nhập.
// Email người phụ trách cố tình viết chữ thường khác với sheet Người dùng (`ADMIN@`) để bắt
// được lỗi so email phân biệt hoa/thường (bẫy §13.5).
const DEPT_ROWS = [
  {
    'Mã phòng': 'PH01',
    'Tên phòng': 'Quản lý Đào tạo',
    'Email Phó GĐ phụ trách': 'admin@vidu.test',
    'Email Trưởng phòng': 'b1@vidu.test; khong-co-ai@vidu.test',
    'Email Phó phòng': '',
    'Thứ tự': 1,
    'Ghi chú': 'Phòng chính',
  },
  {
    'Mã phòng': 'PH02',
    'Tên phòng': 'Kế toán',
    'Email Phó GĐ phụ trách': '',
    'Email Trưởng phòng': '',
    'Email Phó phòng': 'c@vidu.test',
    'Thứ tự': '',
    'Ghi chú': '',
  },
  {
    'Mã phòng': 'PH03',
    'Tên phòng': 'Tổ chức',
    'Email Phó GĐ phụ trách': '',
    'Email Trưởng phòng': '',
    'Email Phó phòng': '',
    'Thứ tự': 3,
    'Ghi chú': '',
  },
  {
    'Mã phòng': 'PH04',
    'Tên phòng': 'Kế toán',
    'Email Phó GĐ phụ trách': '',
    'Email Trưởng phòng': '',
    'Email Phó phòng': '',
    'Thứ tự': 4,
    'Ghi chú': 'trùng tên với PH02',
  },
];

// ---------------------------------------------------------------- Người dùng (7 dòng)
// Mã có KHOẢNG TRỐNG (thiếu NV003) đúng như dữ liệu thật — không được suy ra mã liền mạch.
const USER_ROWS = [
  {
    // `Admin` chữ A hoa: vi phạm CHECK users_role_valid, phải hạ thành 'admin' và IN ra dòng đã
    // đổi (§13.8). Đây là ô thật của bản chụp, không phải tình huống bịa.
    'Mã NV': 'NV001',
    'Họ tên': 'Nguyễn Quản Trị',
    Email: 'ADMIN@vidu.test',
    'Mật khẩu': 'matkhau1',
    'Chức vụ': 'Giám đốc',
    'Phân quyền': 'Admin',
    'Đối tượng': 'Nội bộ',
    'Ghi chú': '',
    Phòng: 'Quản lý Đào tạo',
    'Vai trò phòng': 'Trưởng phòng',
  },
  {
    // Vai trò theo từ vựng CŨ (`Quản lý dự án`) — dịch lại thành `Quản lý công việc`.
    'Mã NV': 'NV002',
    'Họ tên': 'Trần Thị B',
    Email: 'b1@vidu.test',
    'Mật khẩu': 'matkhau2',
    'Chức vụ': 'Chuyên viên',
    'Phân quyền': 'Quản lý dự án',
    'Đối tượng': '',
    'Ghi chú': '',
    Phòng: 'Kế toán',
    'Vai trò phòng': 'Nhân viên',
  },
  {
    // Trùng HỌ TÊN với NV002 ⇒ mọi cột dò theo tên phải để NULL (TC-IMP-05).
    'Mã NV': 'NV004',
    'Họ tên': 'Trần Thị B',
    Email: 'b2@vidu.test',
    'Mật khẩu': 'matkhau4',
    'Chức vụ': '',
    'Phân quyền': 'Nhân viên',
    'Đối tượng': '',
    'Ghi chú': '',
    Phòng: '',
    'Vai trò phòng': '',
  },
  {
    // Mật khẩu RỖNG ⇒ sinh mật khẩu tạm, must_change_password = true (§13.8: 2/5 người như vậy).
    'Mã NV': 'NV005',
    'Họ tên': 'Lê Văn C',
    Email: 'c@vidu.test',
    'Mật khẩu': '',
    'Chức vụ': 'Phó phòng',
    'Phân quyền': 'Phó phòng',
    'Đối tượng': '',
    'Ghi chú': '',
    Phòng: 'Kế toán',
    'Vai trò phòng': 'Phó phòng',
  },
  {
    // KHÔNG có email, mà `users.email` là citext NOT NULL UNIQUE ⇒ sinh địa chỉ giữ chỗ.
    'Mã NV': 'NV006',
    'Họ tên': 'Phạm Thị D',
    Email: '',
    'Mật khẩu': '',
    'Chức vụ': '',
    'Phân quyền': '',
    'Đối tượng': 'Đối tác',
    'Ghi chú': 'không có email',
    Phòng: 'Phòng Không Tồn Tại',
    'Vai trò phòng': 'Chức lạ',
  },
  {
    // Vai trò LẠ ⇒ bỏ dòng, in ra cho người sửa tay. Tuyệt đối không đoán quyền (TC-IMP-11).
    'Mã NV': 'NV007',
    'Họ tên': 'Hoàng Văn E',
    Email: 'e@vidu.test',
    'Mật khẩu': 'matkhau7',
    'Chức vụ': '',
    'Phân quyền': 'Trợ lý admin',
    'Đối tượng': '',
    'Ghi chú': '',
    Phòng: '',
    'Vai trò phòng': '',
  },
  {
    // Thiếu mã ⇒ bỏ dòng có lý do (không thể chạy lại được nếu không có khoá).
    'Mã NV': '',
    'Họ tên': 'Không Có Mã',
    Email: 'khongma@vidu.test',
    'Mật khẩu': 'matkhau8',
    'Chức vụ': '',
    'Phân quyền': 'Nhân viên',
    'Đối tượng': '',
    'Ghi chú': '',
    Phòng: '',
    'Vai trò phòng': '',
  },
];

// ------------------------------------------------- Nhiệm vụ JSON của DA001 (4 phần tử)
// Hình dạng đúng như ô thật: 15 khoá, `Tiến độ (%)` là số, `Nhắc việc` là mảng.
const DA001_TASKS = [
  {
    'Mã nhiệm vụ': 'DA001-01',
    Cấp: 2,
    'Tên nhiệm vụ': 'Công việc con A',
    'Mô tả nhiệm vụ': 'Việc con làm cha của nhiệm vụ bên dưới',
    'Người thực hiện': 'Nguyễn Quản Trị',
    'Trạng thái': 'Đang làm',
    'Ưu tiên': 'Cao',
    'Ngày bắt đầu': '2025-12-31',
    'Hạn chót': '2026-01-01',
    'Tiến độ (%)': 20,
    'Ngày hoàn thành': '',
    'Mục tiêu': '',
    'Link kết quả': '',
    'Kết quả đầu ra': '',
    'Ghi chú': '',
    'Nhắc việc': [],
  },
  {
    // TC-IMP-08: 31/12 → 01/01 phải giữ nguyên, không lệch một ngày.
    // TC-IMP-05: `Trần Thị B` trùng hai người ⇒ assignee_id NULL nhưng assignee_name còn nguyên.
    'Mã nhiệm vụ': 'DA001-01-01',
    Cấp: 3,
    'Mã cha': 'DA001-01',
    'Tên nhiệm vụ': 'Nhiệm vụ có cha thật',
    'Mô tả nhiệm vụ': '',
    'Người thực hiện': 'Trần Thị B',
    'Trạng thái': 'Đang làm',
    'Ưu tiên': 'Trung bình',
    'Ngày bắt đầu': '2025-12-31',
    'Hạn chót': '2026-01-01',
    'Tiến độ (%)': 50,
    'Ngày hoàn thành': '',
    'Mục tiêu': 'Xong trước Tết',
    'Link kết quả': 'https://vidu.test/a\nhttps://vidu.test/b',
    'Kết quả đầu ra': 'Báo cáo',
    'Ghi chú': '',
    'Nhắc việc': [{ 'Ngày nhắc': '2026-01-05', 'Nội dung': 'Nhắc lần 1' }, '2026-01-10'],
  },
  {
    // TC-IMP-04: `Mã cha` không tồn tại ⇒ parent_id NULL, dòng vẫn phải còn.
    // TC-IMP-09: 29/02/2024 là ngày có thật. TC-IMP-10: ô ngày rỗng ⇒ NULL.
    // TC-IMP-06: `Lê Văn Huy` không có trong Người dùng ⇒ NULL + giữ tên.
    'Mã nhiệm vụ': 'DA001-01-02',
    Cấp: 3,
    'Mã cha': 'DA001-99',
    'Tên nhiệm vụ': 'Nhiệm vụ mồ côi',
    'Mô tả nhiệm vụ': '',
    'Người thực hiện': 'Lê Văn Huy',
    'Trạng thái': 'Chưa bắt đầu',
    'Ưu tiên': 'Thấp',
    'Ngày bắt đầu': '2024-02-29',
    'Hạn chót': '',
    'Tiến độ (%)': '120%',
    'Ngày hoàn thành': '',
    'Mục tiêu': '',
    'Link kết quả': '',
    'Kết quả đầu ra': '',
    'Ghi chú': '',
    'Nhắc việc': [],
  },
  {
    // Nhiệm vụ CŨ: không có khoá `Cấp`, không có `Mã cha` — đúng như bản chụp thật (§13.4 mục 8)
    // ⇒ nhập thành cấp 2 và ghi quyết định đó vào báo cáo.
    // Ô ngày là mốc 30/12/1899 của Excel = ô rỗng (TC-IMP-10), và `Nhắc việc` của cấp 2 không
    // đặt được (trigger reminders_only_level3) ⇒ bỏ nhắc việc có lý do, KHÔNG mất nhiệm vụ.
    'Mã nhiệm vụ': 'ID260824081007935',
    'Tên nhiệm vụ': 'Nhiệm vụ kiểu cũ',
    'Mô tả nhiệm vụ': '',
    'Người thực hiện': '',
    'Trạng thái': 'Chưa bắt đầu',
    'Ưu tiên': 'Trung bình',
    'Ngày bắt đầu': '1899-12-30',
    'Hạn chót': '',
    'Tiến độ (%)': 0,
    'Ngày hoàn thành': '',
    'Mục tiêu': '',
    'Link kết quả': '',
    'Kết quả đầu ra': '',
    'Ghi chú': '',
    'Nhắc việc': [{ 'Ngày nhắc': '2026-02-01', 'Nội dung': 'Nhắc cho cấp 2' }],
  },
];

const DA001_LOGS = [
  {
    'Thời gian': '2026-08-24T01:20:08.782Z',
    'Hành động': 'Cập nhật nhiệm vụ',
    'Người thực hiện': 'ADMIN@vidu.test',
    'Chi tiết': 'ID: DA001-01-01, Tên: Nhiệm vụ có cha thật',
  },
  {
    'Thời gian': '2026-08-24T01:21:00.000Z',
    'Hành động': 'Tạo dự án',
    'Người thực hiện': 'khong-ai@vidu.test',
    'Chi tiết': 'ID: DA001',
  },
];

const DA002_LOGS = [
  {
    'Thời gian': '2026-08-24T01:15:41.173Z',
    'Hành động': 'Cập nhật dự án',
    'Người thực hiện': 'ADMIN@vidu.test',
    'Chi tiết': 'ID: DA002',
  },
];

// ---------------------------------------------------------------- Dự án/Nhiệm vụ (3 dòng)
const WORK_ROWS = [
  {
    'Mã dự án': 'DA001',
    'Tên dự án': 'Công việc có đủ cây 3 tầng',
    'Mô tả dự án': 'Mô tả DA001',
    'Quản lý dự án': 'Nguyễn Quản Trị',
    'Ngày bắt đầu': '2025-12-31',
    'Ngày kết thúc': '2026-01-01',
    'Trạng thái dự án': 'Đang làm',
    'Nhiệm vụ JSON': JSON.stringify(DA001_TASKS),
    'Nhật ký JSON': JSON.stringify(DA001_LOGS),
    Phòng: 'Quản lý Đào tạo',
    'Email quản lý': '',
    // Ô rỗng ⇒ 'Đã duyệt': dữ liệu cũ đang dùng thật, không bắt đi duyệt lại (§13.8).
    'Trạng thái duyệt': '',
    'Người duyệt': '',
    'Ngày duyệt': '',
    'Lý do từ chối': '',
  },
  {
    // TC-IMP-03: ô `Nhiệm vụ JSON` HỎNG ⇒ đếm và liệt kê, nhưng DA002 và các công việc khác
    // vẫn phải nhập đủ, kể cả nhật ký của chính nó.
    'Mã dự án': 'DA002',
    'Tên dự án': 'Công việc có ô JSON hỏng',
    'Mô tả dự án': '',
    'Quản lý dự án': 'Trần Thị B',
    'Ngày bắt đầu': '2026-09-21',
    'Ngày kết thúc': '2026-09-24',
    'Trạng thái dự án': 'Chưa bắt đầu',
    'Nhiệm vụ JSON': '[{"Mã nhiệm vụ":"DA002-01","Tên nhiệm vụ":"đứt ở đây"',
    'Nhật ký JSON': JSON.stringify(DA002_LOGS),
    Phòng: '',
    'Email quản lý': 'ADMIN@vidu.test',
    'Trạng thái duyệt': 'Chờ duyệt',
    'Người duyệt': '',
    'Ngày duyệt': '',
    'Lý do từ chối': '',
  },
  {
    'Mã dự án': 'DA003',
    'Tên dự án': 'Công việc chưa có nhiệm vụ nào',
    'Mô tả dự án': '',
    'Quản lý dự án': '',
    'Ngày bắt đầu': '',
    'Ngày kết thúc': '',
    'Trạng thái dự án': '',
    'Nhiệm vụ JSON': '',
    'Nhật ký JSON': '',
    Phòng: 'Kế toán',
    'Email quản lý': '',
    'Trạng thái duyệt': 'Từ chối',
    'Người duyệt': 'Nguyễn Quản Trị',
    'Ngày duyệt': '2026-02-29',
    'Lý do từ chối': 'Chưa rõ kinh phí',
  },
];

// ---------------------------------------------------------------- Đề nghị (2 dòng)
const PROPOSAL_ROWS = [
  {
    'Mã đề nghị': 'DN001',
    Loại: 'Trong kế hoạch',
    'Mã dự án': 'DA001',
    'Mã nhiệm vụ': 'DA001-01-01',
    'Nội dung đề nghị': 'Đề nghị duyệt chi phí',
    'URL đề nghị': '[Ảnh 1] https://vidu.test/1.jpg',
    'Nhà cung cấp': '',
    'Người đề nghị': 'Nguyễn Quản Trị',
    'Ngày đề nghị': '2025-12-29T11:10:57.428Z',
    'Trạng thái': 'Đề xuất mới',
    'Ghi chú duyệt': '',
  },
  {
    // Đúng như DN001 thật: trỏ vào DA010 / DA010-01 KHÔNG tồn tại, và người đề nghị không có
    // trong Người dùng ⇒ ba khoá ngoại đều NULL, dòng vẫn phải nhập được.
    'Mã đề nghị': 'DN002',
    Loại: 'Loại lạ',
    'Mã dự án': 'DA010',
    'Mã nhiệm vụ': 'DA010-01',
    'Nội dung đề nghị': 'Đề nghị mua sắm',
    'URL đề nghị': '',
    'Nhà cung cấp': 'Công ty X',
    'Người đề nghị': 'Lê Văn Huy',
    'Ngày đề nghị': '',
    'Trạng thái': 'Trạng thái lạ',
    'Ghi chú duyệt': '',
  },
];

// ---------------------------------------------------------------- Quản lý App (2 dòng)
const APP_ROWS = [
  {
    'Mã App': 'APP001',
    'Tên App': 'Cổng nội bộ',
    URL: 'https://vidu.test/app',
    'Icon URL': 'https://vidu.test/icon.png',
    'Mô tả': 'App dùng chung',
    'Người tạo': 'Nguyễn Quản Trị',
    'Danh mục': 'Nội bộ',
    // Chữ hoa/thường + từ vựng cũ + một giá trị lạ: chuẩn hoá được thì lấy, lạ thì bỏ + ghi chú.
    'Phân quyền': 'Admin; Quản lý dự án, Chức lạ',
  },
  {
    'Mã App': 'APP002',
    'Tên App': 'Tra cứu văn bản',
    URL: '',
    'Icon URL': '',
    'Mô tả': '',
    'Người tạo': '',
    'Danh mục': '',
    'Phân quyền': '',
  },
];

// ---------------------------------------------------------------- Chat (1 dòng → 2 tin)
const CHAT_ROWS = [
  {
    'Mã chat': 'CH0001',
    Ngày: '2026-08-23T03:02:28.971Z',
    'Chat JSON': JSON.stringify([
      {
        id: '001',
        user: 'Lê Văn Huy',
        message: 'tin của người không có trong Người dùng',
        timestamp: '03:02',
        avatar: 'LV',
      },
      {
        id: '002',
        user: 'Nguyễn Quản Trị',
        message: 'tin của người dò ra được',
        timestamp: '08:15',
        avatar: 'NQ',
      },
    ]),
  },
];

// ---------------------------------------------------------------- Thông báo (sheet có thể THIẾU)
// Bản chụp thật KHÔNG có sheet này. Fixture vẫn giữ dữ liệu mẫu để bật lên khi cần test riêng.
const NOTIFY_ROWS = [
  {
    'Mã thông báo': 'TB001',
    'Người nhận': 'Nguyễn Quản Trị',
    'Nội dung': 'Có việc mới',
    Loại: 'info',
    Ngày: '2026-08-20T02:00:00.000Z',
  },
  {
    // `notifications.user_id` là NOT NULL ⇒ không dò ra người nhận thì buộc phải bỏ dòng có lý do.
    'Mã thông báo': 'TB002',
    'Người nhận': 'Lê Văn Huy',
    'Nội dung': 'Không biết gửi cho ai',
    Loại: 'info',
    Ngày: '2026-08-21T02:00:00.000Z',
  },
];

/**
 * Bản chụp giả đầy đủ. `over` cho phép từng test thay một sheet mà không phải dựng lại tất cả;
 * đặt một sheet thành `null` là **xoá** sheet đó (dùng để thử thiếu sheet bắt buộc).
 *
 * Mặc định KHÔNG có sheet `Thông báo` — đúng như tệp tải về thật (§13.8).
 */
export function buildSnapshot(over = {}) {
  const sheets = {
    Phòng: sheetOf(DEPT_HEADERS, DEPT_ROWS),
    'Người dùng': sheetOf(USER_HEADERS, USER_ROWS),
    'Dự án/Nhiệm vụ': sheetOf(WORK_HEADERS, WORK_ROWS, 'Dự ánNhiệm vụ'),
    'Đề nghị': sheetOf(PROPOSAL_HEADERS, PROPOSAL_ROWS),
    'Quản lý App': sheetOf(APP_HEADERS, APP_ROWS),
    Chat: sheetOf(CHAT_HEADERS, CHAT_ROWS),
    ...over,
  };
  for (const [name, value] of Object.entries(sheets)) {
    if (value === null) delete sheets[name];
  }
  return {
    meta: {
      tool: 'tests/fixtures/snapshot.js',
      tool_version: '1',
      generated_at: '2026-08-24T00:00:00.000Z',
      source_file: 'fixture.xlsx',
      source_size_bytes: 0,
      source_sha256: 'fixture',
      note: 'dữ liệu bịa, không phải người thật',
    },
    counts: {},
    sheets,
  };
}

/** Sheet `Thông báo` để bật lên khi cần: `buildSnapshot({ 'Thông báo': notifySheet() })`. */
export function notifySheet() {
  return sheetOf(NOTIFY_HEADERS, NOTIFY_ROWS);
}

/**
 * Số dòng phải nhập được từ `buildSnapshot()` — chỗ duy nhất giữ con số mong đợi, để khi sửa
 * fixture là thấy ngay phải sửa test nào.
 */
export const EXPECTED = Object.freeze({
  departments: { sheetRows: 4, inserted: 3, skipped: 1 },
  users: { sheetRows: 7, inserted: 5, skipped: 2 },
  department_managers: { sheetRows: 4, inserted: 3, skipped: 1 },
  works: { sheetRows: 3, inserted: 3, skipped: 0 },
  work_items: { sheetRows: 4, inserted: 4, skipped: 1 },
  reminders: { sheetRows: 3, inserted: 2, skipped: 1 },
  proposals: { sheetRows: 2, inserted: 2, skipped: 0 },
  apps: { sheetRows: 2, inserted: 2, skipped: 0 },
  chat_messages: { sheetRows: 2, inserted: 2, skipped: 0 },
  notifications: { sheetRows: 0, inserted: 0, skipped: 0 },
  activity_logs: { sheetRows: 3, inserted: 3, skipped: 0 },
});

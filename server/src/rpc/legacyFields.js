// Dịch tên trường giữa GIAO DIỆN CŨ và API mới (§4.3, §5.2).
//
// Giao diện cũ có HAI kiểu đặt khoá, không phải một — đây là chỗ dễ sai nhất của cầu tương thích:
//
//   1. Khoá form tiếng Anh: các modal dự án / nhiệm vụ / nhân sự / phòng / thông báo dựng
//      `<input name="startDate">`, rồi `new FormData(form)` sinh ra `{name, startDate, ...}`.
//      Tức payload GHI phần lớn đã gần camelCase, chỉ lệch vài tên.
//   2. Khoá tiếng Việt trong `COL`: payload đọc (`getProjects`, `getTasks`) và payload ghi của
//      App / Đề nghị dùng chính tên cột Sheets ("Mã dự án", "Tên nhiệm vụ"…).
//
// Vì vậy phải tách rõ: `*FromLegacy` cho chiều GHI (form → cột), `*ToLegacy` cho chiều ĐỌC
// (dòng CSDL → khoá `COL` mà `app.js` đọc bằng `project[COL.P_NAME]`).
//
// Từ vựng: "dự án/nhiệm vụ" chỉ tồn tại trong lớp này vì giao diện cũ nói vậy (§0.1). Phía trong
// vẫn là công việc cấp 1 (`works`) và nhiệm vụ cấp 3 (`work_items`).

/** Tên cột Sheets cũ — copy nguyên văn từ bảng `COL` của `web/assets/js/app.js` (dòng 41). */
export const COL = Object.freeze({
  P_ID: 'Mã dự án',
  P_NAME: 'Tên dự án',
  P_DESC: 'Mô tả dự án',
  P_MANAGER: 'Quản lý dự án',
  P_START: 'Ngày bắt đầu',
  P_END: 'Ngày kết thúc',
  P_STATUS: 'Trạng thái dự án',
  P_DEPT: 'Phòng',
  P_MANAGER_EMAIL: 'Email quản lý',
  P_APPROVAL: 'Trạng thái duyệt',
  P_APPROVER: 'Người duyệt',
  P_APPROVED_DATE: 'Ngày duyệt',
  P_REJECT_REASON: 'Lý do từ chối',
  // Phân công ba lớp (005_phan_cong.sql) — khoá MỚI, không tồn tại trong bảng Sheets cũ nên
  // đặt tên theo từ vựng hiện hành, không cần giữ tên cột cũ.
  P_DEPT_ID: 'ID phòng',
  P_SUP: 'Ban lãnh đạo kiểm soát',
  P_LEADERS: 'Lãnh đạo phòng phụ trách',
  T_ID: 'Mã nhiệm vụ',
  T_PID: 'Mã dự án',
  T_NAME: 'Tên nhiệm vụ',
  T_DESC: 'Mô tả nhiệm vụ',
  T_ASSIGNEE: 'Người thực hiện',
  T_ASSIGNEE_EMAIL: 'Email người thực hiện',
  T_STATUS: 'Trạng thái',
  T_PRIORITY: 'Ưu tiên',
  T_START: 'Ngày bắt đầu',
  T_DUE: 'Hạn chót',
  T_COMPLETION: 'Tiến độ (%)',
  T_REPORT_DATE: 'Ngày hoàn thành',
  T_TARGET: 'Mục tiêu',
  T_RESULT_LINKS: 'Link kết quả',
  T_OUTPUT: 'Kết quả đầu ra',
  T_NOTES: 'Ghi chú',
  T_REMINDERS: 'Nhắc việc',
  T_LEVEL: 'Cấp',
  T_PARENT: 'Mã cha',
  T_SUP: 'Ban lãnh đạo kiểm soát',
  T_LEADERS: 'Lãnh đạo phòng phụ trách',
  T_APPROVAL: 'Trạng thái duyệt',
  T_APPROVER: 'Người duyệt',
  T_APPROVED_DATE: 'Ngày duyệt',
  D_ID: 'Mã phòng',
  D_NAME: 'Tên phòng',
  D_DIRECTOR: 'Email Phó GĐ phụ trách',
  D_HEAD: 'Email Trưởng phòng',
  D_VICE: 'Email Phó phòng',
  D_ORDER: 'Thứ tự',
  D_NOTES: 'Ghi chú',
  // id số trong bảng departments — option Phòng của form công việc PHẢI mang giá trị này vì
  // projectFromLegacy ép numberOrUndefined (gửi mã PH01 vào là phòng bị bỏ im lặng). Khoá phải
  // có ở CẢ HAI phía COL (client app.js) — test col-parity chốt.
  D_DB_ID: 'ID phòng (DB)',
  S_ID: 'Mã NV',
  S_NAME: 'Họ tên',
  S_EMAIL: 'Email',
  S_POS: 'Chức vụ',
  S_ROLE: 'Phân quyền',
  S_PASSWORD: 'Mật khẩu',
  S_DEPT: 'Phòng',
  S_DEPT_ROLE: 'Vai trò phòng',
  S_OBJECT_TYPE: 'Đối tượng',
  S_NOTES: 'Ghi chú',
  A_TIME: 'Thời gian',
  A_ACTION: 'Hành động',
  A_USER: 'Người thực hiện',
  A_DETAILS: 'Chi tiết',
  N_ID: 'Mã thông báo',
  N_TIME: 'Thời gian',
  N_USER: 'Người nhận',
  N_CONTENT: 'Nội dung',
  // Đề nghị (§2.7 nhóm G) — 11 trường, đúng thứ tự bảng Sheets cũ.
  PR_ID: 'Mã đề nghị',
  PR_TYPE: 'Loại',
  PR_PID: 'Mã dự án',
  PR_TID: 'Mã nhiệm vụ',
  PR_CONTENT: 'Nội dung đề nghị',
  PR_URL: 'URL đề nghị',
  PR_SUPPLIER: 'Nhà cung cấp',
  PR_CREATOR: 'Người đề nghị',
  PR_DATE: 'Ngày đề nghị',
  PR_STATUS: 'Trạng thái',
  PR_NOTE: 'Ghi chú duyệt',
  // Quản lý App (§2.9 nhóm I) — 8 trường. Chú ý tiền tố `A_` ở đây KHÁC nhóm `A_TIME/A_ACTION…`
  // của nhật ký: bảng `COL` bản cũ dùng chung tiền tố cho hai bảng khác nhau, đổi tên là lệch
  // với client và test col-parity đỏ.
  A_ID: 'Mã App',
  A_NAME: 'Tên App',
  A_URL: 'URL',
  A_ICON: 'Icon URL',
  A_DESC: 'Mô tả',
  A_CREATED: 'Người tạo',
  A_CATEGORY: 'Danh mục',
  A_PERMISSIONS: 'Phân quyền',
});

/** Trả về `undefined` (không phải `null`) để khoá không xuất hiện trong payload gửi cho route. */
const pick = (source, key) => (Object.hasOwn(source, key) ? source[key] : undefined);

/** Chuỗi rỗng của form = "không nhập", không phải "xoá thành rỗng" với ngày. */
const dateOrNull = (value) => (value === '' || value == null ? null : String(value));

/** Form gửi số dưới dạng chuỗi; `""` phải thành `undefined` để không ghi 0 lên tiến độ đang có. */
function numberOrUndefined(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Ô `<select>` tham chiếu (Phòng / Ban lãnh đạo kiểm soát): `""` là MỘT LỰA CHỌN («Công việc
 * chung» / «Không chọn») nên phải thành `null` để PATCH xoá liên kết — server `idInput` cũng hiểu
 * `null`/`""` = bỏ liên kết. Bỏ khoá (`undefined`) khi form không gửi trường: PATCH không được đổi
 * gì chỉ vì không gửi. Bẫy 2026-08-26: `numberOrUndefined("")` trả `undefined` khiến «chọn lại
 * Công việc chung» khi SỬA thành silent no-op — phòng cũ bị giữ lại.
 */
function idOrNullOrUndefined(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Ô "Lãnh đạo phòng phụ trách" của form là MỘT `<input type="hidden">` chứa các id phân tách
 * dấu phẩy (checkbox cập nhật), vì `FormData` vòng lặp của `handleAdd` chỉ giữ giá trị cuối.
 * `""` ⇒ `[]`: form luôn gửi trường này khi người dùng được sửa phân công — rỗng là chủ ý xoá hết.
 */
function leaderIdsFromForm(value) {
  if (value === '' || value == null) return [];
  return String(value)
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Payload GHI của `#project-form` → thân request `/api/v1/works`.
 *
 * Form chỉ có 6 trường (`name`, `description`, `manager`, `startDate`, `endDate`, `status`);
 * KHÔNG có phòng và KHÔNG có duyệt — chúng do máy chủ tự suy ra, đúng như bản cũ.
 * `manager` là chuỗi họ tên tự do (dữ liệu cũ có tên không dò ra người nào) nên vào `managerName`.
 */
export function projectFromLegacy(data = {}) {
  return dropUndefined({
    name: pick(data, 'name'),
    description: pick(data, 'description'),
    managerName: pick(data, 'manager'),
    // Ô phòng mới của form (yêu cầu 2026-08-26): value là ID SỐ (COL.D_DB_ID); `""` = «Công việc
    // chung» ⇒ `null` (tạo: NULL; sửa: xoá phòng cũ). Thiếu khoá ⇒ không đổi.
    departmentId: Object.hasOwn(data, 'departmentId')
      ? idOrNullOrUndefined(data.departmentId)
      : undefined,
    supervisorId: Object.hasOwn(data, 'supervisorId')
      ? idOrNullOrUndefined(data.supervisorId)
      : undefined,
    leaderIds: Object.hasOwn(data, 'leaderIds') ? leaderIdsFromForm(data.leaderIds) : undefined,
    startDate: Object.hasOwn(data, 'startDate') ? dateOrNull(data.startDate) : undefined,
    endDate: Object.hasOwn(data, 'endDate') ? dateOrNull(data.endDate) : undefined,
    status: pick(data, 'status'),
  });
}

/**
 * Payload GHI của `#task-form` → thân request `/api/v1/work-items`.
 *
 * `projectId` của form là **mã** công việc (`CV001`) vì `<option value>` lấy từ `COL.P_ID`, nên
 * nó vào `workRef` chứ không vào một khoá id nào. `resultLinks` là một `<input>` duy nhất chứa
 * nhiều link phân tách bằng dòng mới hoặc dấu phẩy → REST nhận MẢNG.
 *
 * Việc 5.12: `#task-form` có hai ô ẩn `level` + `parent` (không phải `<select>` cho người dùng).
 * Cấp suy ra từ chỗ bấm trên cây — thiếu `level` thì REST vẫn mặc định 3 như form «+ Thêm» cũ.
 */
export function taskFromLegacy(data = {}) {
  const out = dropUndefined({
    name: pick(data, 'name'),
    description: pick(data, 'description'),
    assigneeName: pick(data, 'assignee'),
    // Phân công ba lớp (005_phan_cong.sql): cấp 2 có cả hai ô; nhiệm vụ chỉ có leader — máy chủ
    // chặn supervisor khác rỗng ở service nên cứ truyền nguyên những gì form gửi.
    supervisorId: numberOrUndefined(pick(data, 'supervisorId')),
    leaderIds: Object.hasOwn(data, 'leaderIds') ? leaderIdsFromForm(data.leaderIds) : undefined,
    status: pick(data, 'status'),
    priority: pick(data, 'priority'),
    startDate: Object.hasOwn(data, 'startDate') ? dateOrNull(data.startDate) : undefined,
    dueDate: Object.hasOwn(data, 'dueDate') ? dateOrNull(data.dueDate) : undefined,
    reportDate: Object.hasOwn(data, 'reportDate') ? dateOrNull(data.reportDate) : undefined,
    completion: numberOrUndefined(pick(data, 'completion')),
    target: pick(data, 'target'),
    output: pick(data, 'output'),
    notes: pick(data, 'notes'),
  });
  if (Object.hasOwn(data, 'projectId') && data.projectId !== '') out.workRef = data.projectId;
  if (Object.hasOwn(data, 'resultLinks')) out.resultLinks = splitLinks(data.resultLinks);
  const level = numberOrUndefined(pick(data, 'level'));
  if (level === 2 || level === 3) out.level = level;
  if (Object.hasOwn(data, 'parent') || Object.hasOwn(data, 'parentRef')) {
    const raw = Object.hasOwn(data, 'parent') ? data.parent : data.parentRef;
    out.parentRef = raw === '' || raw == null ? null : raw;
  }
  return out;
}

/**
 * Payload GHI của `#staff-form` → thân request `/api/v1/users`.
 *
 * Form: `name`, `email`, `position`, `role` (nhãn form: Admin/Quản lý), `password`,
 * `department` (tên phòng), `deptRole`, `objectType`, `notes`. Service lo ánh xạ vai trò
 * và dò phòng theo tên — cầu RPC không tự đoán.
 */
export function staffFromLegacy(data = {}) {
  return dropUndefined({
    name: pick(data, 'name'),
    email: pick(data, 'email'),
    position: pick(data, 'position'),
    role: pick(data, 'role'),
    password: pick(data, 'password'),
    department: pick(data, 'department'),
    deptRole: pick(data, 'deptRole'),
    objectType: pick(data, 'objectType'),
    notes: pick(data, 'notes'),
  });
}

/** Payload GHI của modal phòng → thân request `/api/v1/departments`. */
export function departmentFromLegacy(data = {}) {
  return dropUndefined({
    name: pick(data, 'name'),
    directorEmail: pick(data, 'director'),
    headEmail: pick(data, 'head'),
    viceEmail: pick(data, 'vice'),
    sortOrder: numberOrUndefined(pick(data, 'order')),
    notes: pick(data, 'notes'),
  });
}

/** Bỏ khoá khi giá trị là chuỗi rỗng — dùng cho các ô `<select>` có enum ở server (loại, trạng
 *  thái đề nghị): `""` không phải giá trị hợp lệ của enum, gửi lên là 400 vô cớ. */
const enumOrUndefined = (value) => {
  const text = String(value ?? '').trim();
  return text === '' ? undefined : text;
};

/**
 * Payload GHI của `#proposal-form` → thân request `/api/v1/proposals`.
 *
 * Khác các form khác: đề nghị và App là hai chỗ mà giao diện cũ gửi **khoá tiếng Việt của `COL`**
 * chứ không phải `name` của `<input>` — `handleAdd('proposal')` dựng object `{[COL.PR_TYPE]: …}`
 * bằng tay (app.js ~2035). Vì vậy bảng dịch ở đây đọc từ `COL.PR_*`.
 *
 * `PR_PID` / `PR_TID` là **mã** (`CV001`, `CV001-003`) nên vào `workRef` / `taskRef`. Chuỗi rỗng
 * được GIỮ (không bỏ khoá): "" nghĩa là bỏ liên kết công việc, còn thiếu khoá nghĩa là không đổi.
 */
export function proposalFromLegacy(data = {}) {
  return dropUndefined({
    type: enumOrUndefined(pick(data, COL.PR_TYPE)),
    workRef: pick(data, COL.PR_PID),
    taskRef: pick(data, COL.PR_TID),
    content: pick(data, COL.PR_CONTENT),
    url: pick(data, COL.PR_URL),
    supplier: pick(data, COL.PR_SUPPLIER),
    proposalDate: Object.hasOwn(data, COL.PR_DATE)
      ? dateOrNull(dayOf(data[COL.PR_DATE]))
      : undefined,
    // Hai ô của người duyệt: giao diện cũ chỉ hiện cho admin, nhưng cứ dịch — service mới là chỗ
    // quyết định có ghi hay không (`duyetDuoc`).
    status: enumOrUndefined(pick(data, COL.PR_STATUS)),
    reviewNote: pick(data, COL.PR_NOTE),
  });
}

/**
 * Dòng `proposals` → khoá `COL.PR_*` mà `renderProposals` đọc.
 *
 * `PR_ID` là **mã** (`DN001`): `handleEdit`/`handleDelete` đem chính giá trị này đi gọi
 * `updateProposalWithAuth(id, …)`, trả id số vào đây là làm hỏng mọi lời gọi sau.
 * `PR_PID`/`PR_TID` cũng là mã công việc / mã nhiệm vụ, lấy từ LEFT JOIN của repo — công việc bị
 * xoá thì hai ô này rỗng mà dòng đề nghị vẫn còn (TC-MISC-04).
 */
export function proposalToLegacy(row) {
  return {
    [COL.PR_ID]: row.code,
    [COL.PR_TYPE]: row.type ?? '',
    [COL.PR_PID]: row.work_code ?? '',
    [COL.PR_TID]: row.item_code ?? '',
    [COL.PR_CONTENT]: row.content ?? '',
    [COL.PR_URL]: row.url ?? '',
    [COL.PR_SUPPLIER]: row.supplier ?? '',
    [COL.PR_CREATOR]: row.creator_name ?? '',
    [COL.PR_DATE]: dayOf(row.proposal_date),
    [COL.PR_STATUS]: row.status ?? '',
    [COL.PR_NOTE]: row.review_note ?? '',
  };
}

/**
 * Payload GHI của `#app-form` → thân request `/api/v1/apps`.
 *
 * Cùng kiểu với đề nghị: `handleAdd('app')` dựng object bằng **khoá `COL.A_*`**, và ô phân quyền là
 * chuỗi ngăn bằng dấu phẩy (`checked.map(v => v.value).join(", ")`), nên `allowedRoles` nhận chuỗi
 * — service tách và kiểm từng tên vai trò.
 *
 * `A_ID` / `A_CREATED` không dịch: mã do máy chủ sinh, người tạo lấy từ phiên đăng nhập.
 */
export function appFromLegacy(data = {}) {
  return dropUndefined({
    name: pick(data, COL.A_NAME),
    url: pick(data, COL.A_URL),
    iconUrl: pick(data, COL.A_ICON),
    description: pick(data, COL.A_DESC),
    category: pick(data, COL.A_CATEGORY),
    allowedRoles: pick(data, COL.A_PERMISSIONS),
  });
}

/**
 * Dòng `apps` → khoá `COL.A_*` mà `renderApps` đọc.
 *
 * `A_ID` là **mã** (`APP001`): `data-id` của nút Sửa/Xoá lấy từ đây rồi đem đi gọi `updateApp` /
 * `deleteApp`. `A_PERMISSIONS` ghép lại thành chuỗi vì `renderApps` `split(",")` chính ô này.
 */
export function appToLegacy(row) {
  return {
    [COL.A_ID]: row.code,
    [COL.A_NAME]: row.name ?? '',
    [COL.A_URL]: row.url ?? '',
    [COL.A_ICON]: row.icon_url ?? '',
    [COL.A_DESC]: row.description ?? '',
    [COL.A_CATEGORY]: row.category ?? '',
    [COL.A_PERMISSIONS]: (row.allowed_roles ?? []).join(', '),
  };
}

/**
 * Chữ viết tắt cho vòng tròn avatar chat: hai chữ cái đầu của tên.
 *
 * Bản cũ tính ở TRÌNH DUYỆT lúc gửi rồi lưu vào JSON của ô chat. Máy chủ mới tính lại từ
 * `user_name` mỗi lần đọc: tin của người đã nghỉ (`user_id` NULL) vẫn có avatar (TC-SEED-19), và
 * không phải tin cậy dữ liệu do client gửi lên.
 */
export function chuVietTat(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tu) => tu[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Dòng `chat_messages` → hình dạng `renderChatMessages` đọc (việc 7.3).
 *
 * Năm khoá `{user, avatar, timestamp, chatDate, message}` là hợp đồng với giao diện cũ:
 *   · `timestamp` "HH:MM" giờ địa phương — `formatChatTime` nhận đúng dạng này (có regex kiểm).
 *   · `chatDate` PHẢI đúng `Date.prototype.toDateString()` ("Thu Aug 27 2026") vì `formatChatTime`
 *     so chuỗi đó với hôm nay / hôm qua để in nhãn "Hôm qua" hay "27/8". Đổi dạng là mất nhãn ngày.
 */
export function chatToLegacy(row) {
  const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  const hai = (n) => String(n).padStart(2, '0');
  return {
    id: row.id,
    user: row.user_name ?? '',
    avatar: chuVietTat(row.user_name),
    timestamp: `${hai(d.getHours())}:${hai(d.getMinutes())}`,
    chatDate: d.toDateString(),
    message: row.message ?? '',
  };
}

/**
 * Ô "Link kết quả" của bản cũ là một `<textarea>` MỖI DÒNG MỘT LINK, dạng `[Tên] https://…`
 * hoặc chỉ `https://…` (xem `parseLinks` dòng 2203 của `app.js`). REST lưu mảng chuỗi, nên mỗi
 * dòng giữ NGUYÊN VĂN cả phần `[Tên]` — tách theo dấu phẩy sẽ cắt đôi những URL có dấu phẩy.
 */
export function splitLinks(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value)
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Bỏ mọi khoá `undefined` — route dùng `Object.hasOwn` để biết người gọi CÓ gửi trường đó hay không. */
export function dropUndefined(object) {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** `timestamptz` → 'YYYY-MM-DD' cho các cột ngày mà giao diện cũ chỉ hiện phần ngày. */
function dayOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Dòng `works` → đối tượng khoá `COL.P_*` mà `app.js` đọc.
 *
 * `COL.P_ID` là **mã** (`CV001`), không phải id số: mã là danh tính, giao diện cũ đem chính giá trị
 * này đi gọi tiếp (`deleteProjectWithAuth(id)`), nên trả id số vào đây là làm hỏng mọi lời gọi sau.
 * `ctx.deptNameById` do lớp RPC nạp một lần mỗi request (bảng phòng nhỏ, không có join trong repo).
 */
export function projectToLegacy(row, ctx = {}) {
  const deptNameById = ctx.deptNameById ?? new Map();
  const nameById = ctx.nameById ?? new Map();
  return {
    [COL.P_ID]: row.code,
    [COL.P_NAME]: row.name ?? '',
    [COL.P_DESC]: row.description ?? '',
    [COL.P_MANAGER]: row.manager_name ?? '',
    [COL.P_START]: row.start_date ?? '',
    [COL.P_END]: row.end_date ?? '',
    [COL.P_STATUS]: row.status ?? '',
    [COL.P_DEPT]: deptNameById.get(row.department_id) ?? '',
    // Phân công ba lớp: id để form điền sẵn select, tên để modal chi tiết hiển thị.
    [COL.P_DEPT_ID]: row.department_id ?? '',
    [COL.P_SUP]: nameById.get(row.supervisor_id) ?? '',
    supervisorId: row.supervisor_id ?? '',
    [COL.P_LEADERS]: (row.leader_ids ?? []).map((id) => nameById.get(id) ?? `#${id}`).join(', '),
    leaderIds: [...(row.leader_ids ?? [])],
    [COL.P_MANAGER_EMAIL]: ctx.emailById?.get(row.manager_id) ?? '',
    [COL.P_APPROVAL]: row.approval_status ?? '',
    [COL.P_APPROVER]: ctx.nameById?.get(row.approver_id) ?? '',
    [COL.P_APPROVED_DATE]: dayOf(row.approved_at),
    [COL.P_REJECT_REASON]: row.reject_reason ?? '',
    // Phần nguồn gốc (B7) chưa có tên cột cũ; giữ nguyên tên API để giao diện mới dùng được ngay.
    origin: row.origin ?? '',
    createdByName: row.created_by_name ?? '',
    assignedByName: row.assigned_by_name ?? '',
    sortOrder: row.sort_order ?? 0,
  };
}

/**
 * Dòng `work_items` → đối tượng khoá `COL.T_*`.
 *
 * `COL.T_PID` phải là **mã công việc** đọc từ `ctx.workCodeById`, KHÔNG suy từ tiền tố của
 * `row.code`: một nhiệm vụ chuyển sang công việc khác vẫn giữ mã cũ (§13.5), nên tiền tố mã và
 * công việc cha có thể khác nhau.
 */
export function taskToLegacy(row, ctx = {}) {
  const workCodeById = ctx.workCodeById ?? new Map();
  const parentCode = row.parent_id ? (ctx.itemCodeById?.get(row.parent_id) ?? '') : '';
  return {
    [COL.T_ID]: row.code,
    [COL.T_PID]: workCodeById.get(row.work_id) ?? '',
    [COL.T_NAME]: row.name ?? '',
    [COL.T_DESC]: row.description ?? '',
    [COL.T_ASSIGNEE]: row.assignee_name ?? '',
    // Phân công ba lớp: nhiệm vụ chỉ có "Lãnh đạo phòng phụ trách" (một người); cấp 2 có cả hai.
    [COL.T_SUP]: ctx.nameById?.get(row.supervisor_id) ?? '',
    supervisorId: row.supervisor_id ?? '',
    [COL.T_LEADERS]: (row.leader_ids ?? [])
      .map((id) => ctx.nameById?.get(id) ?? `#${id}`)
      .join(', '),
    leaderIds: [...(row.leader_ids ?? [])],
    [COL.T_ASSIGNEE_EMAIL]: ctx.emailById?.get(row.assignee_id) ?? '',
    [COL.T_STATUS]: row.status ?? '',
    [COL.T_PRIORITY]: row.priority ?? '',
    [COL.T_START]: row.start_date ?? '',
    [COL.T_DUE]: row.due_date ?? '',
    [COL.T_COMPLETION]: row.completion ?? 0,
    [COL.T_REPORT_DATE]: row.report_date ?? '',
    [COL.T_TARGET]: row.target ?? '',
    // Giao diện cũ đọc ô này bằng `parseLinks`: MỖI DÒNG MỘT LINK. Trả JSON vào đây thì cả khối
    // JSON bị hiểu là một link duy nhất.
    [COL.T_RESULT_LINKS]: (row.result_links ?? []).join('\n'),
    [COL.T_OUTPUT]: row.output ?? '',
    [COL.T_NOTES]: row.notes ?? '',
    // Giao diện cũ kiểm `Array.isArray(task[COL.T_REMINDERS])` (dòng 621) ⇒ phải là MẢNG thật.
    [COL.T_REMINDERS]: remindersToLegacy(ctx.remindersByItemId?.get(row.id)),
    [COL.T_LEVEL]: row.level ?? 3,
    [COL.T_PARENT]: parentCode,
    [COL.T_APPROVAL]: row.approval_status ?? '',
    [COL.T_APPROVER]: ctx.nameById?.get(row.approver_id) ?? '',
    [COL.T_APPROVED_DATE]: dayOf(row.approved_at),
    origin: row.origin ?? '',
    createdByName: row.created_by_name ?? '',
    assignedByName: row.assigned_by_name ?? '',
    sortOrder: row.sort_order ?? 0,
  };
}

/**
 * Dòng `reminders` → hình dáng cũ `{date, content}`.
 *
 * Giao diện cũ đánh số nhắc việc theo **thứ tự trong mảng** (`updateTaskReminder(taskId, index)`)
 * trong khi REST dùng `reminderId`. Thứ tự ở đây vì vậy là phần của hợp đồng, không phải trang trí:
 * lớp RPC đổi index → id bằng đúng mảng này. Kèm luôn `id` để giao diện mới dùng được id thật.
 */
export function remindersToLegacy(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: row.id,
    date: row.remind_date ?? '',
    content: row.content ?? '',
  }));
}

/**
 * Dòng `users` → khoá `COL.S_*` mà `app.js` đọc (`staff[COL.S_NAME]`).
 *
 * `COL.S_PASSWORD` LUÔN chuỗi rỗng: giao diện cũ có cột đó vì Sheets lưu mật khẩu gần như
 * thuần; máy chủ mới không được đưa băm ra ngoài dù chỉ một lần (cùng luật với `publicUser`).
 */
export function staffToLegacy(row, ctx = {}) {
  const deptNameById = ctx.deptNameById ?? new Map();
  return {
    [COL.S_ID]: row.code,
    [COL.S_NAME]: row.full_name ?? '',
    [COL.S_EMAIL]: row.email ?? '',
    [COL.S_POS]: row.position ?? '',
    [COL.S_ROLE]: row.role ?? '',
    [COL.S_PASSWORD]: '',
    [COL.S_DEPT]: deptNameById.get(row.department_id) ?? '',
    [COL.S_DEPT_ROLE]: row.dept_role ?? '',
    [COL.S_OBJECT_TYPE]: row.object_type ?? '',
    [COL.S_NOTES]: row.notes ?? '',
  };
}

/**
 * Dòng phòng → khoá `COL.D_*`.
 *
 * Nhận cả dòng CSDL (`sort_order`, email lấy từ `ctx.managerEmailsByDeptId`) lẫn hình REST
 * (`sortOrder`, `directorEmails` / `headEmails` / `viceEmails`) để RPC và bootstrap dùng chung.
 */
export function departmentToLegacy(row, ctx = {}) {
  const grouped = ctx.managerEmailsByDeptId?.get(row.id);
  return {
    // D_DB_ID = khoá chính số của `departments` — nguồn cho `<option>` phòng của form công việc.
    [COL.D_DB_ID]: row.id ?? '',
    [COL.D_ID]: row.code,
    [COL.D_NAME]: row.name ?? '',
    [COL.D_DIRECTOR]: joinEmails(row.directorEmails ?? grouped?.deputy_director),
    [COL.D_HEAD]: joinEmails(row.headEmails ?? grouped?.head),
    [COL.D_VICE]: joinEmails(row.viceEmails ?? grouped?.vice),
    [COL.D_ORDER]: row.sortOrder ?? row.sort_order ?? 0,
    [COL.D_NOTES]: row.notes ?? '',
  };
}

function joinEmails(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(';');
  if (value == null || value === '') return '';
  return String(value);
}

/**
 * Dòng `activity_logs` → khoá `COL.A_*` mà `renderActivity` đọc.
 *
 * `details` là jsonb tự do: hiện `code` nếu có (nhật ký cây/duyệt luôn ghi mã), không thì
 * chuỗi JSON — `renderActivity` thoát HTML nên không phải lỗ XSS.
 */
export function activityToLegacy(row) {
  return {
    [COL.A_TIME]: row.created_at ?? '',
    [COL.A_ACTION]: row.action ?? '',
    [COL.A_USER]: row.actor_name ?? '',
    [COL.A_DETAILS]: moTaNhatKy(row.details),
  };
}

function moTaNhatKy(details) {
  if (details == null || details === '') return '';
  if (typeof details === 'string') return details;
  if (typeof details === 'object' && details.code) {
    return details.name ? `${details.code} — ${details.name}` : String(details.code);
  }
  try {
    return JSON.stringify(details);
  } catch {
    return '';
  }
}

export default {
  COL,
  projectToLegacy,
  taskToLegacy,
  taskFromLegacy,
  remindersToLegacy,
  staffToLegacy,
  staffFromLegacy,
  departmentToLegacy,
  departmentFromLegacy,
  activityToLegacy,
  proposalToLegacy,
  proposalFromLegacy,
  appToLegacy,
  appFromLegacy,
  chatToLegacy,
};

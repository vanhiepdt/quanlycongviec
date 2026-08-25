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
 */
export function taskFromLegacy(data = {}) {
  const out = dropUndefined({
    name: pick(data, 'name'),
    description: pick(data, 'description'),
    assigneeName: pick(data, 'assignee'),
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
  return out;
}

/** Payload GHI của modal phòng → thân request `/api/v1/departments` (Phase 6). */
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
  return {
    [COL.P_ID]: row.code,
    [COL.P_NAME]: row.name ?? '',
    [COL.P_DESC]: row.description ?? '',
    [COL.P_MANAGER]: row.manager_name ?? '',
    [COL.P_START]: row.start_date ?? '',
    [COL.P_END]: row.end_date ?? '',
    [COL.P_STATUS]: row.status ?? '',
    [COL.P_DEPT]: deptNameById.get(row.department_id) ?? '',
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
  remindersToLegacy,
  staffToLegacy,
  departmentToLegacy,
  activityToLegacy,
};

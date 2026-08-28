// Lỗi có chủ đích của ứng dụng. Mọi lỗi trả cho người dùng phải đi qua đây để có đúng ba
// thứ: mã máy đọc (`code`), câu tiếng Việt cho người đọc (`message`), và mã HTTP (§5.3).
//
// Vì sao không dùng Error thường: bản Apps Script trả `{success:false, error:"..."}` với câu
// chữ tự do, nên frontend phải so sánh chuỗi tiếng Việt để biết chuyện gì xảy ra. Đổi một chữ
// là vỡ một nhánh xử lý mà không ai biết. `code` cắt hẳn đường đó.

/** Mã HTTP mặc định cho từng mã lỗi (§5.3). Mã nào không có ở đây coi như 400. */
export const ERROR_STATUS = Object.freeze({
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 401,
  FORBIDDEN: 403,
  MUST_CHANGE_PASSWORD: 403,
  CSRF_INVALID: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  // Cầu tương thích RPC (Phase 4): tên hàm cũ có thật nhưng phần nghiệp vụ chưa chuyển sang máy
  // chủ mới. Phải là 501 chứ không phải 404: 404 nghĩa là "không có đường dẫn này" và làm giao
  // diện tưởng gọi sai tên, còn 400 nghĩa là "người dùng nhập sai" — cả hai đều nói dối.
  NOT_IMPLEMENTED: 501,

  // --- Cây 3 tầng (Phase 3, §8.4 nhóm C) ---------------------------------------------------
  // Tất cả là 400 "dữ liệu vào sai", trừ REMINDER_ON_SUBWORK: đặt nhắc việc cho công việc con
  // không phải lỗi cú pháp mà là xung đột với quy tắc "chỉ Nhiệm vụ mới có nhắc việc" ⇒ 409.
  PARENT_NOT_FOUND: 400, // TC-TREE-06 — mã cha không có trong CSDL
  PARENT_NOT_SUBWORK: 400, // TC-TREE-04 — lấy nhiệm vụ cấp 3 làm cha
  PARENT_OTHER_WORK: 400, // TC-TREE-05 — cha thuộc công việc khác
  SELF_PARENT: 400, // TC-TREE-09 — tự trỏ vào chính mình
  CYCLE: 400, // TC-TREE-10/11 — trỏ vào con cháu, hoặc dữ liệu đã vòng sẵn
  LEVEL_IMMUTABLE: 400, // TC-TREE-08 — đổi cấp của dòng đã tạo
  LVL2_NO_PARENT: 400, // TC-TREE-02 — công việc con không được có cha
  MOVE_PARENT_HAS_CHILDREN: 400, // TC-TREE-16 — chuyển công việc con đang có nhiệm vụ
  TARGET_WORK_NOT_FOUND: 400, // TC-TREE-19 — công việc đích không tồn tại
  REMINDER_ON_SUBWORK: 409, // TC-TREE-28 — nhắc việc chỉ dành cho cấp 3
  DEPT_MISMATCH_WORK: 400, // TC-TREE-36 — đặt phòng khác phòng của công việc cha

  // --- Phân công ba lớp (005_phan_cong.sql) -------------------------------------------------
  // Nhiệm vụ chọn "Lãnh đạo phòng phụ trách" ngoài nguồn hợp lệ: không thuộc leader_ids của
  // công việc con chứa nó và không thuộc nhóm Phó GĐ phụ trách phòng khi nằm dưới cha trực tiếp.
  LEADER_NOT_IN_SOURCE: 400,

  // --- Ủy quyền có thời hạn (006_delegations.sql, `docs/KE-HOACH-UY-QUYEN.md`) ---------------
  // Mỗi mã là một cách người dùng có thể tạo một bản ủy quyền vô nghĩa hoặc nguy hiểm. Tách
  // riêng khỏi VALIDATION_ERROR/FORBIDDEN chung vì giao diện cần nói đúng chuyện gì sai để người
  // dùng sửa được, mà không phải so chuỗi tiếng Việt.
  DELEGATION_SELF: 400, // L1 — tự ủy quyền cho chính mình
  DELEGATION_ADMIN_FORBIDDEN: 403, // L2 — cho mượn quyền toàn hệ thống (giữ mã cho dữ liệu/nhật ký cũ)
  DELEGATION_ADMIN_SCOPE_REQUIRED: 400, // L2 — Giám đốc ủy quyền mà không ghi rõ phòng nào
  DELEGATION_SCOPE_TOO_WIDE: 403, // L3 — cho phòng mình không phụ trách
  DELEGATION_RANK_UP: 403, // R2 (§13.4 mục 17) — ủy quyền LÊN cấp cao hơn
  DELEGATION_DIFFERENT_DEPARTMENT: 403, // R3 (§13.4 mục 18) — khác phòng, không thuộc ngoại lệ
  DELEGATION_OVERLAP: 409, // trùng khoảng ngày với bản ghi đang hiệu lực của cùng cặp
});

export class AppError extends Error {
  /**
   * @param {string} code mã máy đọc, ví dụ 'MUST_CHANGE_PASSWORD'
   * @param {string} message câu tiếng Việt hiện thẳng cho người dùng
   * @param {{status?: number, field?: string, details?: object}} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = opts.status ?? ERROR_STATUS[code] ?? 400;
    if (opts.field) this.field = opts.field;
    if (opts.details) this.details = opts.details;
    // Cờ để errorHandler biết đây là lỗi đã lường trước, được phép hiện nguyên văn.
    this.expected = true;
  }
}

export const badRequest = (message, field) => new AppError('BAD_REQUEST', message, { field });
export const unauthenticated = (message = 'Bạn chưa đăng nhập hoặc phiên đã hết hạn') =>
  new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'Bạn không có quyền thực hiện hành động này') =>
  new AppError('FORBIDDEN', message);
export const notFound = (message = 'Không tìm thấy dữ liệu') => new AppError('NOT_FOUND', message);
export const conflict = (message, field) => new AppError('CONFLICT', message, { field });

export default AppError;

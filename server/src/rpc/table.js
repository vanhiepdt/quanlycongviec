// Bảng ánh xạ 37 tên hàm cũ → route `/api/v1/*` (§5.2).
//
// Bảng này là hợp đồng của cầu tương thích: MỖI tên hàm mà `web/assets/js/app.js` gọi phải có
// đúng một dòng ở đây, kể cả những tên chưa có nghiệp vụ ở máy chủ mới. Thiếu một tên thì lời gọi
// im lặng trả `undefined` và giao diện hỏng ở chỗ không ai đoán được — nên tên chưa làm được vẫn
// phải có dòng, chỉ khác là trả lỗi 501 với câu tiếng Việt nói rõ chức năng nào chưa có.
//
// KẾ HOẠCH NÓI 36, THỰC TẾ 37: đếm hết các dòng bảng §5.2 và đối chiếu với `app.js` thì có 37
// tên (§13.5). Con số 36 trong §5.1/§5.2 là sai sót của kế hoạch, đã sửa lại.
//
// `rest` chỉ là chú thích + thứ mà test khẳng định (mỗi tên đi đúng route, đúng method). Việc gọi
// thật do `handler` làm, qua `ctx.call` — xem `subrequest.js`.
import { AppError } from '../utils/errors.js';
import {
  departmentFromLegacy,
  projectFromLegacy,
  projectToLegacy,
  remindersToLegacy,
  taskFromLegacy,
  taskToLegacy,
} from './legacyFields.js';

/** Hàm cũ có thật nhưng nghiệp vụ chưa chuyển sang máy chủ mới — thất bại RÕ RÀNG, không im lặng. */
function pending(label, rest = null) {
  return {
    rest,
    notImplemented: true,
    handler() {
      throw new AppError(
        'NOT_IMPLEMENTED',
        `Chức năng «${label}» chưa được chuyển sang máy chủ mới. Vui lòng liên hệ quản trị.`
      );
    },
  };
}

/** Đối số bắt buộc phải có: giao diện cũ gọi thiếu tham số là lỗi lập trình, phải hiện ra ngay. */
function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new AppError('VALIDATION_ERROR', `Thiếu tham số «${name}»`, { field: name });
  }
  return value;
}

export const RPC_TABLE = Object.freeze({
  // --- Đăng nhập / phiên ---------------------------------------------------------------------
  //
  // `errorAsData: true`: sai mật khẩu KHÔNG được đẩy sang `withFailureHandler`. Giao diện cũ hiện
  // câu lỗi đăng nhập trong `withSuccessHandler` (`showLoginError(response.error)`, dòng 163 của
  // `app.js`); đẩy sang failure handler thì người dùng chỉ thấy "Lỗi kết nối" và không hiểu vì sao
  // không vào được. Đây cũng là lý do 429 của `loginRateLimiter` vẫn hiện đúng câu chờ N phút.
  authenticateUser: {
    rest: 'POST /auth/login',
    public: true,
    errorAsData: true,
    async handler([email, password], ctx) {
      const data = await ctx.call('POST', '/auth/login', { email, password });
      return {
        success: true,
        user: data.user,
        csrfToken: data.csrfToken,
        expiresAt: data.expiresAt,
      };
    },
  },

  logout: {
    rest: 'POST /auth/logout',
    public: true,
    async handler(args, ctx) {
      await ctx.call('POST', '/auth/logout', {});
      return { success: true, message: 'Đã đăng xuất' };
    },
  },

  /**
   * `changePassword(newPassword, confirmPassword)` của bản cũ KHÔNG hỏi mật khẩu hiện tại (modal
   * dòng 298 của `app.js` chỉ có 2 ô), còn `POST /api/v1/auth/password` thì bắt buộc có — vì đổi
   * mật khẩu mà không cần mật khẩu cũ nghĩa là ai chiếm được phiên đang mở là chiếm luôn tài khoản.
   *
   * Cách xử lý: nhận CẢ HAI chữ ký. 3 tham số ⇒ (hiện tại, mới, nhập lại) — dạng mà việc 4.5 sửa
   * modal để dùng. 2 tham số ⇒ trả lỗi tiếng Việt nói rõ thiếu mật khẩu hiện tại, KHÔNG âm thầm
   * bỏ qua. So khớp "nhập lại" nằm ở đây vì đó là luật của giao diện cũ, không phải của API.
   */
  changePassword: {
    rest: 'POST /auth/password',
    errorAsData: true,
    async handler(args, ctx) {
      const [currentPassword, newPassword, confirmPassword] =
        args.length >= 3 ? args : [undefined, args[0], args[1]];
      if (newPassword !== confirmPassword) {
        throw new AppError('VALIDATION_ERROR', 'Mật khẩu nhập lại không khớp', {
          field: 'confirmPassword',
        });
      }
      required(currentPassword, 'Mật khẩu hiện tại');
      const data = await ctx.call('POST', '/auth/password', { currentPassword, newPassword });
      return {
        success: true,
        message: 'Đổi mật khẩu thành công',
        revokedSessions: data.revokedSessions ?? 0,
      };
    },
  },

  // --- Nạp dữ liệu đầu trang -----------------------------------------------------------------
  // `GET /api/v1/bootstrap` (§5.2) cần cả nhân sự, đề nghị, app, thống kê và biểu đồ — những
  // module chưa tồn tại. Làm nửa vời ở đây thì giao diện dựng ra bảng rỗng và người dùng tưởng
  // dữ liệu đã mất, nên để thất bại rõ ràng cho tới khi có đủ module.
  getDataForUser: pending('Nạp dữ liệu người dùng', 'GET /bootstrap'),

  /**
   * Ngoại lệ CÓ LÝ DO của nhóm `pending` (việc 4.4).
   *
   * Đây là lời gọi ĐẦU TIÊN của trang (`checkAuthenticationAndInitialize`, dòng 131 `app.js`), nên
   * nó quyết định người chưa đăng nhập thấy gì. Nếu trả 501 như các tên chưa làm khác thì khách
   * vào trang nhận ngay một toast đỏ "Chức năng … chưa được chuyển sang máy chủ mới" rồi mới thấy
   * modal — đúng kỹ thuật nhưng sai nghiệp vụ: người ta chưa đăng nhập thì việc cần làm là ĐĂNG
   * NHẬP, không phải đọc lỗi hệ thống.
   *
   * Bản cũ đã có sẵn đường đi đúng cho việc này: `{requireLogin: true}` ⇒ `showLoginModal()` (dòng
   * 133 `app.js`), không kèm lỗi. Nên: chưa có phiên ⇒ trả đúng cờ đó; ĐÃ có phiên ⇒ vẫn 501, vì
   * lúc đó dữ liệu đầu trang là thứ thật sự còn thiếu và phải thấy rõ (chờ `GET /bootstrap`,
   * Phase 5). Vẫn giữ `notImplemented: true` để `GET /api/rpc` không khai khống là đã làm xong.
   */
  getInitialDataWithAuth: {
    rest: 'GET /bootstrap',
    public: true,
    notImplemented: true,
    handler(args, ctx) {
      if (!ctx.req.user) return { requireLogin: true };
      throw new AppError(
        'NOT_IMPLEMENTED',
        'Chức năng «Nạp dữ liệu đầu trang» chưa được chuyển sang máy chủ mới. Vui lòng liên hệ quản trị.'
      );
    },
  },

  getDepartmentContext: pending('Ngữ cảnh phòng ban', 'GET /departments/context'),

  // --- Công việc cấp 1 (giao diện cũ gọi là "dự án", §0.1) ------------------------------------
  //
  // Trả về MẢNG THUẦN, không bọc `{success:true}`: giao diện cũ gán thẳng `allProjects = response`
  // (dòng 1844). Bọc thêm một lớp là làm mọi bảng trống trơn mà không có lỗi nào.
  getProjects: {
    rest: 'GET /works',
    async handler(args, ctx) {
      const data = await ctx.call('GET', '/works');
      const context = { deptNameById: await ctx.deptNameById() };
      return (data.works ?? []).map((row) => projectToLegacy(row, context));
    },
  },

  addProjectWithAuth: {
    rest: 'POST /works',
    async handler([data], ctx) {
      const created = await ctx.call('POST', '/works', projectFromLegacy(data ?? {}));
      // `projectId` phải là MÃ (`CV012`): giao diện cũ lấy giá trị này thay vào ô id tạm rồi dùng
      // để gọi sửa/xoá tiếp (dòng 1759). Trả id số vào đây là làm hỏng mọi lời gọi sau đó.
      return { success: true, projectId: created.work.code, warnings: created.warnings ?? [] };
    },
  },

  updateProjectWithAuth: {
    rest: 'PATCH /works/:idOrCode',
    async handler([id, data], ctx) {
      required(id, 'Mã dự án');
      const updated = await ctx.call('PATCH', `/works/${encodeURIComponent(id)}`, {
        ...projectFromLegacy(data ?? {}),
      });
      return { success: true, projectId: updated.work.code, warnings: updated.warnings ?? [] };
    },
  },

  deleteProjectWithAuth: {
    rest: 'DELETE /works/:idOrCode',
    async handler([id], ctx) {
      required(id, 'Mã dự án');
      const result = await ctx.call('DELETE', `/works/${encodeURIComponent(id)}`);
      // Xoá công việc là xoá cả cây con — trả về danh sách mã đã xoá (§5.3) để giao diện nói đúng
      // số lượng thay vì chỉ "đã xoá".
      return {
        success: true,
        deletedProject: result.deletedWork,
        deletedItems: result.deletedItems ?? [],
        deletedCount: result.deletedCount ?? 0,
      };
    },
  },

  copyProjectWithAuth: {
    rest: 'POST /works/:idOrCode/copy',
    async handler([sourceId, newName], ctx) {
      required(sourceId, 'Mã dự án nguồn');
      const result = await ctx.call('POST', `/works/${encodeURIComponent(sourceId)}/copy`, {
        name: newName ?? undefined,
      });
      return {
        success: true,
        projectId: result.work.code,
        message: `Đã nhân bản thành ${result.work.code} (kèm ${result.copiedCount ?? 0} dòng con)`,
      };
    },
  },

  // --- Nhiệm vụ (cấp 3) và công việc con (cấp 2) ----------------------------------------------
  //
  // `getTasks()` của bản cũ không có tham số và trả VỀ TẤT CẢ nhiệm vụ, còn
  // `GET /api/v1/work-items` bắt buộc có `workRef` (một dòng không tồn tại ngoài công việc nào).
  // Nên ở đây phải quét từng công việc — N+1 lời gọi, chấp nhận tạm vì đây là lớp có thời hạn;
  // bản thay thế là `GET /api/v1/bootstrap` gộp một câu SQL (§13.5).
  getTasks: {
    rest: 'GET /work-items?workRef=',
    async handler(args, ctx) {
      const { works = [] } = await ctx.call('GET', '/works');
      const rows = [];
      const workCodeById = new Map();
      const itemCodeById = new Map();
      for (const work of works) {
        workCodeById.set(work.id, work.code);
        const { items = [] } = await ctx.call('GET', '/work-items', {}, { workRef: work.code });
        for (const item of items) {
          itemCodeById.set(item.id, item.code);
          rows.push(item);
        }
      }
      // Nhắc việc lấy MỘT lần cho mọi dòng (`mapByItemIds`), không phải mỗi dòng một lời gọi:
      // giao diện cũ đọc `task[COL.T_REMINDERS]` như mảng có sẵn (dòng 621).
      const remindersByItemId = await ctx.remindersByItemIds(rows.map((r) => r.id));
      const context = { workCodeById, itemCodeById, remindersByItemId };
      return rows.map((row) => taskToLegacy(row, context));
    },
  },

  addTaskWithAuth: {
    rest: 'POST /work-items',
    async handler([data], ctx) {
      const body = taskFromLegacy(data ?? {});
      required(body.workRef, 'Thuộc dự án');
      const created = await ctx.call('POST', '/work-items', body);
      return { success: true, taskId: created.item.code, warnings: created.warnings ?? [] };
    },
  },

  updateTaskWithAuth: {
    rest: 'PATCH /work-items/:idOrCode',
    async handler([id, data], ctx) {
      required(id, 'Mã nhiệm vụ');
      const updated = await ctx.call('PATCH', `/work-items/${encodeURIComponent(id)}`, {
        ...taskFromLegacy(data ?? {}),
      });
      return {
        success: true,
        taskId: updated.item.code,
        moved: updated.moved ?? false,
        warnings: updated.warnings ?? [],
      };
    },
  },

  deleteTaskWithAuth: {
    rest: 'DELETE /work-items/:idOrCode',
    async handler([id], ctx) {
      required(id, 'Mã nhiệm vụ');
      const result = await ctx.call('DELETE', `/work-items/${encodeURIComponent(id)}`);
      return {
        success: true,
        deletedTask: result.deletedItem,
        deletedChildren: result.deletedChildren ?? [],
        deletedCount: result.deletedCount ?? 0,
      };
    },
  },

  copyTaskWithAuth: {
    rest: 'POST /work-items/:idOrCode/copy',
    async handler([sourceId, newName], ctx) {
      required(sourceId, 'Mã nhiệm vụ nguồn');
      const result = await ctx.call('POST', `/work-items/${encodeURIComponent(sourceId)}/copy`, {
        name: newName ?? undefined,
      });
      return {
        success: true,
        taskId: result.item.code,
        message: `Đã nhân bản thành ${result.item.code}`,
      };
    },
  },

  reorderTasks: {
    rest: 'POST /works/:idOrCode/reorder',
    async handler([projectId, orderedIds], ctx) {
      required(projectId, 'Mã dự án');
      const result = await ctx.call('POST', `/works/${encodeURIComponent(projectId)}/reorder`, {
        order: Array.isArray(orderedIds) ? orderedIds : [],
      });
      return { success: true, ordered: result.ordered ?? [], skipped: result.skipped ?? [] };
    },
  },

  // --- Nhắc việc (chỉ cấp 3, §5.2) ------------------------------------------------------------
  //
  // BẪY: giao diện cũ đánh số nhắc việc theo THỨ TỰ TRONG MẢNG (`updateTaskReminder(taskId, 2, …)`)
  // vì Sheets lưu cả danh sách trong một ô. REST đánh số bằng `reminderId` thật. Nên hai hàm sửa/
  // xoá phải ĐỌC danh sách trước để đổi số thứ tự thành id — không đọc thì sửa nhầm dòng khác, và
  // "nhầm dòng" ở đây là im lặng, không có lỗi nào báo (§13.5).
  addTaskReminder: {
    rest: 'POST /work-items/:id/reminders',
    async handler([taskId, payload], ctx) {
      required(taskId, 'Mã nhiệm vụ');
      const data = await ctx.call('POST', `/work-items/${encodeURIComponent(taskId)}/reminders`, {
        remindDate: payload?.date,
        content: payload?.content ?? '',
      });
      return { success: true, reminders: remindersToLegacy(data.reminders) };
    },
  },

  updateTaskReminder: {
    rest: 'PATCH /work-items/:id/reminders/:reminderId',
    async handler([taskId, reminderIndex, payload], ctx) {
      required(taskId, 'Mã nhiệm vụ');
      const id = await ctx.reminderIdByIndex(taskId, reminderIndex);
      const data = await ctx.call(
        'PATCH',
        `/work-items/${encodeURIComponent(taskId)}/reminders/${id}`,
        { remindDate: payload?.date, content: payload?.content ?? '' }
      );
      return { success: true, reminders: remindersToLegacy(data.reminders) };
    },
  },

  deleteTaskReminder: {
    rest: 'DELETE /work-items/:id/reminders/:reminderId',
    async handler([taskId, reminderIndex], ctx) {
      required(taskId, 'Mã nhiệm vụ');
      const id = await ctx.reminderIdByIndex(taskId, reminderIndex);
      const data = await ctx.call(
        'DELETE',
        `/work-items/${encodeURIComponent(taskId)}/reminders/${id}`
      );
      return { success: true, reminders: remindersToLegacy(data.reminders) };
    },
  },

  // --- Chưa chuyển sang máy chủ mới -----------------------------------------------------------
  // Mỗi dòng dưới đây vẫn PHẢI có mặt: giao diện cũ gọi chúng qua biến (`runner[text2](data)`),
  // thiếu tên là `undefined is not a function` giữa lúc người dùng đang bấm Lưu.
  getStaffList: pending('Danh sách nhân sự', 'GET /users'),
  addStaffWithAuth: pending('Thêm nhân sự', 'POST /users'),
  updateStaffWithAuth: pending('Sửa nhân sự', 'PATCH /users/:id'),
  deleteStaffWithAuth: pending('Xoá nhân sự', 'DELETE /users/:id'),

  addDepartmentWithAuth: {
    ...pending('Thêm phòng', 'POST /departments'),
    // Giữ lại phép dịch trường để khi có module phòng thì chỉ cần đổi `handler`, không phải dò lại
    // tên các ô trong modal (`director`/`head`/`vice`/`order`).
    fromLegacy: departmentFromLegacy,
  },
  updateDepartmentWithAuth: {
    ...pending('Sửa phòng', 'PATCH /departments/:id'),
    fromLegacy: departmentFromLegacy,
  },
  deleteDepartmentWithAuth: pending('Xoá phòng', 'DELETE /departments/:id'),

  getProposals: pending('Danh sách đề nghị', 'GET /proposals'),
  addProposalWithAuth: pending('Thêm đề nghị', 'POST /proposals'),
  updateProposalWithAuth: pending('Sửa đề nghị', 'PATCH /proposals/:id'),
  deleteProposalWithAuth: pending('Xoá đề nghị', 'DELETE /proposals/:id'),

  addApp: pending('Thêm ứng dụng', 'POST /apps'),
  updateApp: pending('Sửa ứng dụng', 'PATCH /apps/:id'),
  deleteApp: pending('Xoá ứng dụng', 'DELETE /apps/:id'),

  getChatMessages: pending('Tin nhắn nội bộ', 'GET /chat'),
  sendChatMessage: pending('Gửi tin nhắn nội bộ', 'POST /chat'),

  addNotificationWithAuth: pending('Tạo thông báo', 'POST /notifications'),
});

export const RPC_NAMES = Object.freeze(Object.keys(RPC_TABLE));

export default RPC_TABLE;

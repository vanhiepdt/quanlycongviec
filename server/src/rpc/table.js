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
  activityToLegacy,
  departmentFromLegacy,
  departmentToLegacy,
  projectFromLegacy,
  projectToLegacy,
  remindersToLegacy,
  staffFromLegacy,
  staffToLegacy,
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

/**
 * Gói REST của việc 5.10 → hình dạng mà `handleSuccessfulLogin` đọc
 * (`data.user`, `data.projects`, `data.tasks`, `data.staff`, …).
 *
 * `proposals` / `apps` cố ý mảng rỗng: module còn Phase 7, nhưng thiếu khoá thì UI gán `[]`
 * im lặng còn 501 thì toast đỏ chặn cả trang.
 */
function legacyBundleFromRest(data) {
  const deptNameById = new Map((data.departments ?? []).map((d) => [d.id, d.name]));
  const emailById = new Map((data.people ?? []).map((p) => [p.id, p.email]));
  const nameById = new Map((data.people ?? []).map((p) => [p.id, p.full_name ?? p.name]));
  const workCodeById = new Map((data.works ?? []).map((w) => [w.id, w.code]));
  const itemCodeById = new Map((data.items ?? []).map((i) => [i.id, i.code]));
  const remindersByItemId = new Map((data.items ?? []).map((i) => [i.id, i.reminders ?? []]));
  const projectCtx = { deptNameById, emailById, nameById };
  const taskCtx = { workCodeById, itemCodeById, remindersByItemId, emailById, nameById };

  return {
    success: true,
    user: data.user,
    projects: (data.works ?? []).map((row) => projectToLegacy(row, projectCtx)),
    tasks: (data.items ?? []).map((row) => taskToLegacy(row, taskCtx)),
    staff: (data.people ?? []).map((row) => staffToLegacy(row, { deptNameById })),
    adminNames: (data.people ?? [])
      .filter((p) => p.role === 'admin')
      .map((p) => p.full_name ?? p.name),
    chartData: data.chartData ?? { labels: [], data: [] },
    recentActivities: (data.activities ?? []).map((row) => activityToLegacy(row)),
    summaryStats: data.summaryStats ?? {},
    pendingCount: data.pendingCount ?? { works: 0, items: 0, total: 0 },
    proposals: [],
    apps: [],
  };
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

  // --- Nạp dữ liệu đầu trang (việc 5.10) ------------------------------------------------------
  //
  // Ba tên này cùng uống `GET /bootstrap` (và `GET /departments/context`). Đề nghị / app vẫn
  // trả mảng rỗng: module chưa có (Phase 7), nhưng `handleSuccessfulLogin` gán thẳng
  // `allProposals = data.proposals || []` — thiếu khoá thì không sao, còn 501 thì toast đỏ
  // chặn cả trang Tổng quan.
  getDataForUser: {
    rest: 'GET /bootstrap',
    async handler(args, ctx) {
      return legacyBundleFromRest(await ctx.call('GET', '/bootstrap'));
    },
  },

  /**
   * Ngoại lệ CÓ LÝ DO vẫn giữ sau việc 5.10 (việc 4.4 / TC-RPC-36).
   *
   * Đây là lời gọi ĐẦU TIÊN của trang (`checkAuthenticationAndInitialize`, dòng 131 `app.js`).
   * Khách chưa đăng nhập: `{requireLogin: true}` ⇒ `showLoginModal()`, không toast lỗi. Đã có
   * phiên: cùng gói với `getDataForUser`. Không trả 401 — `app.js` không đi nhánh modal nếu
   * failure handler chạy.
   */
  getInitialDataWithAuth: {
    rest: 'GET /bootstrap',
    public: true,
    async handler(args, ctx) {
      if (!ctx.req.user) return { requireLogin: true };
      return legacyBundleFromRest(await ctx.call('GET', '/bootstrap'));
    },
  },

  getDepartmentContext: {
    rest: 'GET /departments/context',
    async handler(args, ctx) {
      const data = await ctx.call('GET', '/departments/context');
      return {
        success: true,
        departments: (data.departments ?? []).map((row) => departmentToLegacy(row)),
        departmentNames: data.departmentNames ?? [],
        visibleDepartments: data.visibleDepartments ?? [],
        myDepartment: data.myDepartment ?? '',
        myDeptRole: data.myDeptRole ?? '',
        isDeputyDirector: data.isDeputyDirector === true,
        isDepartmentHead: data.isDepartmentHead === true,
      };
    },
  },

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

  // --- Nhân sự / phòng (việc 5.11) -----------------------------------------------------------
  //
  // `getStaffList` trả MẢNG THUẦN khoá `COL.S_*`: `handleEdit` gán thẳng `allStaff = response2`.
  // Ghi trả `{success:true, staffId/departmentId}` là MÃ (`NV003` / `PH01`), không phải id số.
  getStaffList: {
    rest: 'GET /users',
    async handler(args, ctx) {
      const data = await ctx.call('GET', '/users');
      const context = { deptNameById: await ctx.deptNameById() };
      return (data.people ?? []).map((row) => staffToLegacy(row, context));
    },
  },

  addStaffWithAuth: {
    rest: 'POST /users',
    async handler([data], ctx) {
      const created = await ctx.call('POST', '/users', staffFromLegacy(data ?? {}));
      return { success: true, staffId: created.person.code };
    },
  },

  updateStaffWithAuth: {
    rest: 'PATCH /users/:idOrCode',
    async handler([id, data], ctx) {
      required(id, 'Mã nhân viên');
      const updated = await ctx.call(
        'PATCH',
        `/users/${encodeURIComponent(id)}`,
        staffFromLegacy(data ?? {})
      );
      return { success: true, staffId: updated.person.code };
    },
  },

  deleteStaffWithAuth: {
    rest: 'DELETE /users/:idOrCode',
    async handler([id], ctx) {
      required(id, 'Mã nhân viên');
      const result = await ctx.call('DELETE', `/users/${encodeURIComponent(id)}`);
      return { success: true, deletedStaff: result.deletedUser };
    },
  },

  addDepartmentWithAuth: {
    rest: 'POST /departments',
    fromLegacy: departmentFromLegacy,
    async handler([data], ctx) {
      const created = await ctx.call('POST', '/departments', departmentFromLegacy(data ?? {}));
      return { success: true, departmentId: created.department.code };
    },
  },

  updateDepartmentWithAuth: {
    rest: 'PATCH /departments/:idOrCode',
    fromLegacy: departmentFromLegacy,
    async handler([id, data], ctx) {
      required(id, 'Mã phòng');
      const updated = await ctx.call(
        'PATCH',
        `/departments/${encodeURIComponent(id)}`,
        departmentFromLegacy(data ?? {})
      );
      return { success: true, departmentId: updated.department.code };
    },
  },

  deleteDepartmentWithAuth: {
    rest: 'DELETE /departments/:idOrCode',
    async handler([id], ctx) {
      required(id, 'Mã phòng');
      const result = await ctx.call('DELETE', `/departments/${encodeURIComponent(id)}`);
      return { success: true, deletedDepartment: result.deletedDepartment };
    },
  },

  // --- Chưa chuyển sang máy chủ mới -----------------------------------------------------------
  // Mỗi dòng dưới đây vẫn PHẢI có mặt: giao diện cũ gọi chúng qua biến (`runner[text2](data)`),
  // thiếu tên là `undefined is not a function` giữa lúc người dùng đang bấm Lưu.

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

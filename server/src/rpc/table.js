// Bảng ánh xạ 37 tên hàm cũ → route `/api/v1/*` (§5.2).
//
// Bảng này là hợp đồng của cầu tương thích: MỖI tên hàm mà `web/assets/js/app.js` gọi phải có
// đúng một dòng ở đây. Thiếu một tên thì lời gọi im lặng trả `undefined` và giao diện hỏng ở chỗ
// không ai đoán được.
//
// TỪ 2026-08-27: **37/37 tên chạy thật**, không còn dòng nào chờ (`addNotificationWithAuth` là tên
// cuối, nối ở phiên Phase 7). Khuôn `pending()` từng dùng cho các tên chưa chuyển đã bỏ vì không
// còn chỗ gọi; cần khai lại một tên chưa làm thì dựng lại đối tượng
// `{ rest, notImplemented: true, handler() { throw new AppError('NOT_IMPLEMENTED', …) } }` —
// `routes.js` và `GET /api/rpc` vẫn đọc cờ `notImplemented`. Tuyệt đối không bỏ trống dòng.
//
// KẾ HOẠCH NÓI 36, THỰC TẾ 37: đếm hết các dòng bảng §5.2 và đối chiếu với `app.js` thì có 37
// tên (§13.5). Con số 36 trong §5.1/§5.2 là sai sót của kế hoạch, đã sửa lại.
//
// `rest` chỉ là chú thích + thứ mà test khẳng định (mỗi tên đi đúng route, đúng method). Việc gọi
// thật do `handler` làm, qua `ctx.call` — xem `subrequest.js`.
import { AppError } from '../utils/errors.js';
import {
  activityToLegacy,
  appFromLegacy,
  appToLegacy,
  chatToLegacy,
  departmentFromLegacy,
  departmentToLegacy,
  projectFromLegacy,
  projectToLegacy,
  proposalFromLegacy,
  proposalToLegacy,
  remindersToLegacy,
  staffFromLegacy,
  staffToLegacy,
  taskFromLegacy,
  taskToLegacy,
} from './legacyFields.js';

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
 * `proposals` và `apps` chỉ đi qua đường này: giao diện cũ không có tên RPC nào lấy danh sách app,
 * còn `allProposals` được gán một lần lúc đăng nhập rồi mới `renderProposals()`.
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
    proposals: (data.proposals ?? []).map((row) => proposalToLegacy(row)),
    // 4 thẻ đếm của trang Đề nghị (G3). Đếm trên phần THẤY ĐƯỢC, đã lọc phạm vi ở service.
    proposalCounts: data.proposalCounts ?? {},
    apps: (data.apps ?? []).map((row) => appToLegacy(row)),
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
  // `getTasks()` của bản cũ không có tham số và trả VỀ TẤT CẢ nhiệm vụ. Nợ Phase 4 đã trả ở
  // đây: handler KHÔNG còn quét từng công việc một lời gọi `/work-items` (N+1, đo ở §8.5 C6)
  // mà dùng `ctx.visibleTree()` — cùng gói `cayChoUser` của bootstrap, MỘT bộ truy vấn bất kể
  // số công việc. Hình dạng phản hồi giữ nguyên 100%.
  getTasks: {
    rest: 'GET /work-items?workRef=',
    async handler(args, ctx) {
      const { works, items } = await ctx.visibleTree();
      const workCodeById = new Map(works.map((w) => [w.id, w.code]));
      const itemCodeById = new Map(items.map((i) => [i.id, i.code]));
      const remindersByItemId = new Map(items.map((i) => [i.id, i.reminders ?? []]));
      const context = { workCodeById, itemCodeById, remindersByItemId };
      return items.map((row) => taskToLegacy(row, context));
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

  // --- Đề nghị (việc 7.1) --------------------------------------------------------------------
  //
  // `getProposals` trả MẢNG THUẦN khoá `COL.PR_*`: luồng xoá của `app.js` (~2240) nạp lại bằng
  // `getProposals()` rồi gán thẳng `allProposals = response2`. Bọc `{success:true, proposals:[…]}`
  // vào đây là danh sách đề nghị biến thành một object và bảng trống trơn.
  //
  // 4 số đếm trạng thái (G3) KHÔNG đi qua đường này: `updateProposalCounts` bản cũ tự đếm trên
  // `allProposals`. REST vẫn trả `counts` cho giao diện mới dùng — xem `GET /api/v1/proposals`.
  getProposals: {
    rest: 'GET /proposals',
    async handler(args, ctx) {
      const data = await ctx.call('GET', '/proposals');
      return (data.proposals ?? []).map((row) => proposalToLegacy(row));
    },
  },

  addProposalWithAuth: {
    rest: 'POST /proposals',
    fromLegacy: proposalFromLegacy,
    async handler([data], ctx) {
      const created = await ctx.call('POST', '/proposals', proposalFromLegacy(data ?? {}));
      // `handleAdd` đọc `response.id || response.proposalId` để thay mã tạm `TEMP_…`, và
      // `response.date` để hiện ngày ngay mà không phải nạp lại — trả cả ba.
      return {
        success: true,
        id: created.proposal.code,
        proposalId: created.proposal.code,
        date: created.proposal.proposal_date ?? null,
      };
    },
  },

  updateProposalWithAuth: {
    rest: 'PATCH /proposals/:idOrCode',
    fromLegacy: proposalFromLegacy,
    async handler([id, data], ctx) {
      required(id, 'Mã đề nghị');
      const updated = await ctx.call(
        'PATCH',
        `/proposals/${encodeURIComponent(id)}`,
        proposalFromLegacy(data ?? {})
      );
      return { success: true, id: updated.proposal.code, proposalId: updated.proposal.code };
    },
  },

  deleteProposalWithAuth: {
    rest: 'DELETE /proposals/:idOrCode',
    async handler([id], ctx) {
      required(id, 'Mã đề nghị');
      const result = await ctx.call('DELETE', `/proposals/${encodeURIComponent(id)}`);
      return { success: true, deletedProposal: result.deletedProposal };
    },
  },

  // --- Quản lý App (việc 7.2) ----------------------------------------------------------------
  //
  // Ba tên này nhận / trả **mã** `APP001`: `data-id` của nút Sửa/Xoá trong `renderApps` lấy từ
  // `COL.A_ID`, nên `updateApp(id, data)` và `deleteApp(id)` đều đi vào bằng mã.
  //
  // Không có `getApps`: giao diện cũ lấy danh sách app trong gói dữ liệu đầu (`allApps`) rồi tự
  // `renderApps()` lại sau mỗi lần ghi — xem `legacyBundleFromRest`.
  addApp: {
    rest: 'POST /apps',
    fromLegacy: appFromLegacy,
    async handler([data], ctx) {
      const created = await ctx.call('POST', '/apps', appFromLegacy(data ?? {}));
      // `handleAdd` gán `allApps[i][COL.A_ID] = response.id` để thay mã tạm.
      return { success: true, id: created.app.code, appId: created.app.code };
    },
  },

  updateApp: {
    rest: 'PATCH /apps/:idOrCode',
    fromLegacy: appFromLegacy,
    async handler([id, data], ctx) {
      required(id, 'Mã ứng dụng');
      const updated = await ctx.call(
        'PATCH',
        `/apps/${encodeURIComponent(id)}`,
        appFromLegacy(data ?? {})
      );
      return { success: true, id: updated.app.code, appId: updated.app.code };
    },
  },

  deleteApp: {
    rest: 'DELETE /apps/:idOrCode',
    async handler([id], ctx) {
      required(id, 'Mã ứng dụng');
      const result = await ctx.call('DELETE', `/apps/${encodeURIComponent(id)}`);
      return { success: true, deletedApp: result.deletedApp };
    },
  },

  // --- Chat nội bộ (việc 7.3) ------------------------------------------------------------------
  //
  // `getChatMessages` trả **MẢNG THÔ** (không bọc `{messages:[…]}`): `loadChatMessages` gọi
  // `renderChatMessages(response)` rồi `updateChatBadge(response.length)` ngay trên giá trị trả về.
  //
  // Mỗi phần tử phải đủ 5 khoá `{user, avatar, timestamp, chatDate, message}` — `chatDate` đúng
  // dạng `Date.prototype.toDateString()` vì `formatChatTime` so chuỗi đó với hôm nay/hôm qua.
  //
  // Giao diện cũ KHÔNG gửi `since`: nó tải lại cả khung mỗi lần. Tham số `since` là của REST mới
  // (hỏi lại mỗi 10 giây), nên ở đây vẫn nhận nếu ai đó truyền vào.
  getChatMessages: {
    rest: 'GET /chat',
    async handler([since], ctx) {
      // Tham số truy vấn phải đi qua ĐỐI TƯỢNG `query` của lời gọi con, không ghép vào chuỗi đường:
      // `callV1` đè hẳn `req.query` bằng đối tượng này, nên `?since=…` viết trong path bị bỏ im lặng.
      const data = await ctx.call('GET', '/chat', {}, since ? { since: String(since) } : {});
      return (data.messages ?? []).map((row) => chatToLegacy(row));
    },
  },

  sendChatMessage: {
    rest: 'POST /chat',
    async handler([message], ctx) {
      // `sendChatMessage` phía giao diện đọc `response.success` rồi `response.error` — hình dạng
      // này giữ nguyên, kèm tin vừa gửi để chỗ gọi mới không phải hỏi lại ngay.
      const created = await ctx.call('POST', '/chat', { message: message ?? '' });
      return { success: true, message: chatToLegacy(created.message) };
    },
  },

  // --- Thông báo ------------------------------------------------------------------------------
  // Tên RPC CUỐI CÙNG được nối (§13.3 phiên 2026-08-27). Từ đây bảng không còn dòng `pending()`
  // nào: 37/37 tên chạy thật.
  addNotificationWithAuth: {
    rest: 'POST /notifications',
    async handler([data], ctx) {
      // Form cũ (`createNotificationModal`) gửi thẳng ba tên `content` / `recipient` / `type` qua
      // `new FormData`, không phải tên cột Sheets — nên không cần hàm `*FromLegacy` để đổi tên.
      const raw = data ?? {};
      const created = await ctx.call('POST', '/notifications', {
        content: raw.content ?? '',
        recipient: raw.recipient ?? '',
        type: raw.type ?? '',
      });
      // `addNotification` bản cũ trả `{success, notificationId}`; `handleAdd` chỉ đọc
      // `response.success` cho loại `notification`, nhưng vẫn trả id cho đúng hình dạng cũ. Bảng
      // mới không có cột `code` nên id là số, và một lần gửi "tất cả mọi người" sinh nhiều dòng ⇒
      // kèm `total` để chỗ gọi mới biết đã gửi cho bao nhiêu người.
      return {
        success: true,
        notificationId: created.notifications[0]?.id ?? null,
        total: created.total,
      };
    },
  },
});

export const RPC_NAMES = Object.freeze(Object.keys(RPC_TABLE));

export default RPC_TABLE;

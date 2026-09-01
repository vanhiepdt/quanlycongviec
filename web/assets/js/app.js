// app.js — SINH RA TỪ js.clean.html ở Phase 4 việc 4.1 (lệnh sed, không sửa tay một dòng logic nào).
// Bản gốc js.clean.html ở thư mục gốc repo giữ lại làm mốc ĐỐI CHIẾU và ĐÃ ĐÓNG BĂNG:
// từ Phase 4 trở đi chỉ sửa file này. Sửa js.clean.html là sửa vào chỗ không ai nạp.
//
// Ba thay đổi duy nhất Phase 4 được phép làm ở đây (§7 Phase 4): modal đổi mật khẩu bắt buộc (4.5),
// thoát ký tự chống XSS (4.6) và bỏ listener chết (4.7). CẤM đổi tên hàm, đổi id DOM, dọn code —
// để phase sau.
// Dấu phiên bản: mở DevTools Console phải thấy dòng này — thiếu/lẻ là trình duyệt đang chạy file cũ.
console.info("[QLCV] app.js 20260901-2");
let chartInstance = null,
  projectProgressChart = null,
  staffPerformanceChart = null,
  allProjects = [],
  allTasks = [],
  allStaff = [],
  currentSection = "overview",
  currentUser = null,
  isAuthenticated = false,
  draggedItem = null,
  draggedProjectId = null,
  currentStatListData = [],
  allProposals = [],
  allApps = [],
  currentProposalFilter = "",
  currentOverviewProjectFilter = null,
  tasksXemThang = new Date().getMonth() + 1,
  tasksXemNam = new Date().getFullYear(),
  tasksLocCanBo = "",
  tasksLocPhong = "",
  // 2026-08-28: tab Công việc lọc tháng GIỐNG Sơ đồ Gantt (Tháng + Năm) + lọc phòng.
  // projectsXemThang = 0 nghĩa là «Tất cả tháng» (không lọc theo thời gian).
  projectsXemThang = 0,
  projectsXemNam = new Date().getFullYear(),
  projectsLocPhong = "",
  allAdminNames = [],
  currentGanttDate = new Date(),
  ganttStartDate = new Date();
ganttStartDate.setHours(0, 0, 0, 0);
let ganttEndDate = new Date(),
  expandedProjects = new Set(),
  openedFromProjectDetails = null,
  pendingTaskCreate = null;
// GĐ1: bối cảnh phòng ban, nạp sau khi đăng nhập bằng getDepartmentContext()
let allDepartments = [],
  departmentNames = [],
  visibleDepartments = [],
  myDepartment = "",
  myDeptRole = "",
  isDeputyDirectorUser = false,
  isDepartmentHeadUser = false,
  departmentsAutoLoadTried = false;
const COL = {
  P_ID: "Mã dự án",
  P_NAME: "Tên dự án",
  P_DESC: "Mô tả dự án",
  P_MANAGER: "Quản lý dự án",
  P_START: "Ngày bắt đầu",
  P_END: "Ngày kết thúc",
  P_STATUS: "Trạng thái dự án",
  P_DEPT: "Phòng",
  P_MANAGER_EMAIL: "Email quản lý",
  P_APPROVAL: "Trạng thái duyệt",
  P_APPROVER: "Người duyệt",
  P_APPROVED_DATE: "Ngày duyệt",
  P_REJECT_REASON: "Lý do từ chối",
  // Yêu cầu xoá (013, Vòng 13 đợt 2) — khoá phải khớp nguyên văn COL của server.
  P_XOA_BOI: "Người xin xoá",
  P_XOA_LUC: "Ngày xin xoá",
  P_XOA_LY_DO: "Lý do xin xoá",
  // Phân công ba lớp (2026-08-26) — khoá PHẢI khớp nguyên văn COL phía server (legacyFields.js):
  // server trả object với key là các chuỗi dưới đây, sai một chữ là đọc ra undefined.
  P_DEPT_ID: "ID phòng",
  P_SUP: "Ban lãnh đạo kiểm soát",
  P_LEADERS: "Lãnh đạo phòng phụ trách",
  T_LEVEL: "Cấp",
  T_PARENT: "Mã cha",
  T_SUP: "Ban lãnh đạo kiểm soát",
  T_LEADERS: "Lãnh đạo phòng phụ trách",
  T_ASSIGNEE_EMAIL: "Email người thực hiện",
  T_APPROVAL: "Trạng thái duyệt",
  T_APPROVER: "Người duyệt",
  T_APPROVED_DATE: "Ngày duyệt",
  T_XOA_BOI: "Người xin xoá",
  T_XOA_LUC: "Ngày xin xoá",
  T_XOA_LY_DO: "Lý do xin xoá",
  D_ID: "Mã phòng",
  D_NAME: "Tên phòng",
  D_DIRECTOR: "Email Phó GĐ phụ trách",
  D_HEAD: "Email Trưởng phòng",
  D_VICE: "Email Phó phòng",
  D_ORDER: "Thứ tự",
  D_NOTES: "Ghi chú",
  // id số trong bảng departments — option Phòng của form công việc PHẢI mang giá trị này vì
  // projectFromLegacy (máy chủ) chỉ nhận id số, gửi mã PH01 vào là phòng bị bỏ im lặng.
  // Khoá PHẢI khớp nguyên văn COL phía server — test col-parity chốt.
  D_DB_ID: "ID phòng (DB)",
  T_ID: "Mã nhiệm vụ",
  T_PID: "Mã dự án",
  T_NAME: "Tên nhiệm vụ",
  T_DESC: "Mô tả nhiệm vụ",
  T_ASSIGNEE: "Người thực hiện",
  T_STATUS: "Trạng thái",
  T_PRIORITY: "Ưu tiên",
  T_START: "Ngày bắt đầu",
  T_DUE: "Hạn chót",
  T_COMPLETION: "Tiến độ (%)",
  T_REPORT_DATE: "Ngày hoàn thành",
  T_TARGET: "Mục tiêu",
  T_RESULT_LINKS: "Link kết quả",
  T_OUTPUT: "Kết quả đầu ra",
  T_NOTES: "Ghi chú",
  T_REMINDERS: "Nhắc việc",
  S_ID: "Mã NV",
  S_NAME: "Họ tên",
  S_EMAIL: "Email",
  S_POS: "Chức vụ",
  S_ROLE: "Phân quyền",
  S_PASSWORD: "Mật khẩu",
  S_DEPT: "Phòng",
  S_DEPT_ROLE: "Vai trò phòng",
  S_OBJECT_TYPE: "Đối tượng",
  S_NOTES: "Ghi chú",
  A_TIME: "Thời gian",
  A_ACTION: "Hành động",
  A_USER: "Người thực hiện",
  A_DETAILS: "Chi tiết",
  N_ID: "Mã thông báo",
  N_TIME: "Thời gian",
  N_USER: "Người nhận",
  N_CONTENT: "Nội dung",
  PR_ID: "Mã đề nghị",
  PR_TYPE: "Loại",
  PR_PID: "Mã dự án",
  PR_TID: "Mã nhiệm vụ",
  PR_CONTENT: "Nội dung đề nghị",
  PR_URL: "URL đề nghị",
  PR_SUPPLIER: "Nhà cung cấp",
  PR_CREATOR: "Người đề nghị",
  PR_DATE: "Ngày đề nghị",
  PR_STATUS: "Trạng thái",
  PR_NOTE: "Ghi chú duyệt",
  A_ID: "Mã App",
  A_NAME: "Tên App",
  A_URL: "URL",
  A_ICON: "Icon URL",
  A_DESC: "Mô tả",
  A_CREATED: "Người tạo",
  A_CATEGORY: "Danh mục",
  A_PERMISSIONS: "Phân quyền"
};
/**
 * Đổi các địa chỉ http(s) trong văn bản thành thẻ <a>. Kết quả được người gọi ghim thẳng vào
 * `innerHTML`, nên đây là một chỗ ghi HTML — việc 4.6.
 *
 * Bản cũ ghép `$1` thẳng vào href và trả về phần văn bản còn lại NGUYÊN BẢN. Hai lỗ:
 *   1. một dấu " trong địa chỉ là thoát ra khỏi thuộc tính href, đủ để gắn onmouseover;
 *   2. nội dung nhắc việc do người khác nhập mà có <img onerror=...> thì chạy luôn.
 * Nay thoát từng phần: văn bản ngoài liên kết, chữ hiện ra của liên kết, và href (qua `safeUrl`).
 */
function linkifyText(text) {
  if (!text) return "";
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,;:!?\)\]'"<])/g,
    source = String(text);
  let out = "",
    last = 0,
    found;
  while ((found = urlRegex.exec(source)) !== null) {
    out += escapeHtml(source.slice(last, found.index)) + "<a href=\"" + escapeHtml(safeUrl(found[1])) + "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-blue-600 hover:underline break-all\">" + escapeHtml(found[1]) + "</a>";
    last = found.index + found[1].length;
  }
  return out + escapeHtml(source.slice(last));
}
document.addEventListener("DOMContentLoaded", function () {
  setupEventListeners(), checkAuthenticationAndInitialize();
});
function checkAuthenticationAndInitialize() {
  showLoading("Đang kiểm tra đăng nhập..."), google.script.run.withSuccessHandler(function (response) {
    hideLoading();
    if (response.requireLogin) showLoginModal();else response.success ? handleSuccessfulLogin(response) : (showToast(response.error || "Lỗi khi kiểm tra đăng nhập", "error"), showLoginModal());
  }).withFailureHandler(function (error) {
    hideLoading(), showToast("Lỗi kết nối: " + error.message, "error"), showLoginModal();
  }).getInitialDataWithAuth();
}
function showLoginModal() {
  const loginModal = document.getElementById("login-modal");
  loginModal && (loginModal.classList.remove("opacity-0", "invisible"), loginModal.querySelector(".bg-white\\/90").classList.remove("scale-95"), loginModal.querySelector(".bg-white\\/90").classList.add("scale-100"), setTimeout(() => {
    document.getElementById("login-email")?.focus();
  }, 300));
}
function hideLoginModal() {
  const loginModal = document.getElementById("login-modal");
  loginModal && (loginModal.querySelector(".bg-white\\/90").classList.remove("scale-100"), loginModal.querySelector(".bg-white\\/90").classList.add("scale-95"), setTimeout(() => {
    loginModal.classList.add("opacity-0", "invisible");
  }, 200));
}
function handleLogin(email, password) {
  if (!email || !password) {
    showLoginError("Vui lòng nhập đầy đủ email và mật khẩu");
    return;
  }
  setLoginLoading(true), document.getElementById("login-loading").classList.remove("hidden"), google.script.run.withSuccessHandler(function (response) {
    setLoginLoading(false), document.getElementById("login-loading").classList.add("hidden"), response.success ? (hideLoginModal(), hideLoginError(), google.script.run.withSuccessHandler(function (response2) {
      response2.success ? (handleSuccessfulLogin(response2), showToast("Đăng nhập thành công!", "success")) : showToast(response2.error || "Lỗi khi tải dữ liệu", "error");
    }).withFailureHandler(function (error) {
      showToast("Lỗi khi tải dữ liệu: " + error.message, "error");
    }).getDataForUser()) : showLoginError(response.error || "Đăng nhập thất bại");
  }).withFailureHandler(function (error) {
    setLoginLoading(false), document.getElementById("login-loading").classList.add("hidden"), showLoginError("Lỗi kết nối: " + error.message);
  }).authenticateUser(email, password);
}
function handleSuccessfulLogin(data) {
  currentUser = data.user, isAuthenticated = true, allProjects = data.projects || [], allTasks = data.tasks || [], allStaff = data.staff || [], allProposals = data.proposals || [], allApps = data.apps || [], allAdminNames = data.adminNames || [], updateUIForUser(currentUser), renderStats(data.summaryStats), renderProjects(), renderTasks(), renderStaff(), renderProposals(), renderApps(), renderChart(data.chartData), renderProjectProgressChart(), renderTaskPriorityChart(), renderTimelineProgressChart(), renderProjectComparisonChart(), renderStaffPerformanceChart(), renderActivity(data.recentActivities), renderPriorityTasksMini(), renderTaskStats(), renderProjectStats(), updateOverviewProjectDatalist();
  if (currentSection === "overview") {
    const overviewFilterContainerEl = document.getElementById("overview-filter-container");
    overviewFilterContainerEl && overviewFilterContainerEl.classList.remove("hidden");
  }
  setupGanttEventListeners(), loadDepartmentContext(), currentSection === "gantt" && renderGanttChart(), typeof napTongQuanTuServer === "function" && napTongQuanTuServer(), napUyQuyenCuaToi(), setTimeout(() => {
    currentSection === "overview" && loadChatMessagesAsync();
  }, 500);
}
/** GĐ1: nạp danh sách phòng và quyền theo phòng của người đang đăng nhập. */
function loadDepartmentContext(callback) {
  google.script.run.withSuccessHandler(function (response) {
    if (response && response.success) {
      // Lỗi 2026-08-28: `handleSuccessfulLogin` gọi renderProjects()/renderTasks() NGAY (đồng bộ),
      // còn lời gọi này về SAU (bất đồng bộ) — lúc render lần đầu, `visibleDepartments` vẫn là []
      // mặc định nên Phó Giám đốc thấy trắng, và không có gì vẽ lại 2 tab khi dữ liệu phòng về tới.
      // "Có khi thấy khi không" tuỳ thứ tự thao tác của người dùng, đúng kiểu bẫy race condition.
      // Nay hễ đổi vai trò/phòng phụ trách xong thì vẽ lại đúng 2 tab bị ảnh hưởng.
      const truocLaDeputy = isDeputyDirectorUser, truocLaHead = isDepartmentHeadUser;
      allDepartments = response.departments || [], departmentNames = response.departmentNames || [], visibleDepartments = response.visibleDepartments || [], myDepartment = response.myDepartment || "", myDeptRole = response.myDeptRole || "", isDeputyDirectorUser = response.isDeputyDirector === true, isDepartmentHeadUser = response.isDepartmentHead === true;
      const departmentNavEl = document.getElementById("nav-departments");
      departmentNavEl && departmentNavEl.classList.toggle("hidden", !isAdmin());
      currentSection === "departments" && renderDepartments();
      if (isDeputyDirectorUser || truocLaDeputy || isDepartmentHeadUser || truocLaHead) {
        // Vòng 12d: thêm TP/PP — lần vẽ đầu của họ chạy lúc `myDepartment` còn rỗng (bối cảnh
        // phòng về SAU), giờ bối cảnh về là phải vẽ lại đúng như đã vá cho Phó GĐ (bẫy §13.5).
        // Vài hàm vẽ lại (renderProjectStats...) không tự kiểm phần tử null — bọc try/catch để một
        // khung thiếu trên trang không chặn mất `callback(response)` bên dưới (bài học api-bridge.js:
        // "vỡ thì vẫn phải thấy dấu vết, không được nuốt", nhưng KHÔNG được làm mất lượt gọi tiếp theo).
        try {
          renderProjects(), renderTasks(), renderProjectStats(), renderTaskStats(), renderStats(), renderPriorityTasksMini();
          currentSection === "gantt" && renderGanttChart();
          currentSection === "projects" && (goiNutChoDuyetPanel(), renderChoDuyetPanel());
        } catch (err) {
          console.error("Không vẽ lại được công việc/nhiệm vụ sau khi đổi phòng phụ trách:", err);
        }
      }
    }
    if (typeof callback == "function") callback(response);
  }).withFailureHandler(function (error) {
    console.error("Không nạp được cấu hình phòng:", error);
    if (typeof callback == "function") callback(null);
  }).getDepartmentContext();
}
function loadChatMessagesAsync() {
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!chatMessagesEl) return;
  chatMessagesEl.innerHTML = "<div class=\"text-center text-gray-500 text-sm py-4\"><i class=\"fas fa-spinner fa-spin mr-2\"></i>Đang tải tin nhắn...</div>";
  // REST mới (việc 7.3) thay `google.script.run.getChatMessages()`: cần mốc `since` mà máy chủ trả
  // kèm để vòng hỏi lại 10 giây chỉ lấy phần mới. Cầu RPC vẫn còn tên đó cho bản giao diện cũ.
  napChatTuServer({ dauTien: true }).then(() => batDauHoiLaiChat());
}
function updateUIForUser(user) {
  const isAdmin2 = isAdmin(),
    role = user.role && user.role.toLowerCase().includes("quản lý");
  document.getElementById("user-info").classList.remove("hidden"), document.getElementById("login-prompt").classList.add("hidden");
  const userAvatarEl = document.getElementById("user-avatar"),
    userNameEl = document.getElementById("user-name"),
    userRoleEl = document.getElementById("user-role");
  if (userAvatarEl && userNameEl && userRoleEl) {
    const slice = user.name.split(" ").map(item => item[0]).join("").toUpperCase().slice(0, 2);
    userAvatarEl.textContent = slice, userNameEl.textContent = user.name, userRoleEl.textContent = user.role;
  }
  const hasMatch = allProjects.some(project => project[COL.P_MANAGER] === user.name),
    projectsNavEl = document.getElementById("projects-nav"),
    staffNavEl = document.getElementById("staff-nav");
  if (isAdmin2) {
    if (projectsNavEl) projectsNavEl.style.display = "flex";
    if (staffNavEl) staffNavEl.style.display = "flex";
    showAdminButtons();
  } else {
    // 2026-08-27: Phó Giám đốc TRƯỚC ĐÂY rơi vào nhánh `hasMatch` (chỉ thấy tab «Quản lý công
    // việc» khi tình cờ đứng tên quản lý một công việc) vì `role` chỉ bắt chuỗi "quản lý". §6 cho
    // vai này quyền như admin trong các phòng mình phụ trách ⇒ tab phải luôn hiện. Tab «Cán bộ»
    // vẫn chỉ của admin: §6 cho Phó Giám đốc `user: ['read']`, không phải quản lý người dùng.
    if (role || laQuanTriTrongPhamVi()) {
      if (projectsNavEl) projectsNavEl.style.display = "flex";
      if (staffNavEl) staffNavEl.style.display = "none";
      hideAdminButtons();
    } else {
      projectsNavEl && (projectsNavEl.style.display = hasMatch ? "flex" : "none");
      if (staffNavEl) staffNavEl.style.display = "none";
      hideAdminButtons();
    }
  }
  // Việc 4.7 — đã bỏ chỗ ẩn/hiện `#add-notification-btn`: `index.html` KHÔNG có nút đó, nên hai
  // nhánh if này chưa bao giờ chạm được vào gì. Listener "click" của cùng id cũng đã bỏ (dòng 470
  // cũ). Hệ quả phải nói rõ: modal tạo thông báo (`createNotificationModal`) hiện KHÔNG có đường
  // vào — bản Apps Script cũng vậy, không phải Phase 4 làm mất. Muốn có thì thêm nút ở Phase 7
  // cùng module thông báo, chứ Phase 4 chỉ được cắt chuyển, không thêm tính năng.
  updatePageTitle();
}
function hideAdminButtons() {
  const values = ["add-staff-btn", "quick-add-staff", "quick-add-app", "add-app-btn"];
  values.forEach(value => {
    const el = document.getElementById(value);
    el && (el.style.display = "none");
  });
  const hasMatch = allProjects.some(project => project[COL.P_MANAGER] === currentUser.name),
    values2 = ["add-project-standalone", "quick-add-project"];
  values2.forEach(values22 => {
    const el = document.getElementById(values22);
    el && (laQuanTriTrongPhamVi() || isManager() || laLanhDaoPhong() ? el.style.display = "" : el.style.display = "none");
  });
  const values3 = ["add-task-standalone", "quick-add-task"];
  values3.forEach(values32 => {
    const el = document.getElementById(values32);
    el && (canUserCreateTask() ? el.style.display = "" : el.style.display = "none");
  }), document.addEventListener("DOMContentLoaded", function () {
    hideActionButtons();
  });
}
function showAdminButtons() {
  // Việc 4.7: bỏ hai id add-project-btn và add-task-btn khỏi danh sách — chúng không có trong
  // `index.html` (listener của chúng cũng đã bỏ), giữ lại chỉ làm người đọc tưởng có nút.
  const values = ["add-project-standalone", "add-task-standalone", "add-staff-btn", "quick-add-project", "quick-add-task", "quick-add-staff", "quick-add-app", "add-app-btn"];
  values.forEach(value => {
    const el = document.getElementById(value);
    el && (el.style.display = "");
  });
}
function hideActionButtons() {
  const els = document.querySelectorAll(".edit-btn, .delete-btn, .copy-btn");
  els.forEach(el => {
    const type = el.dataset.type,
      id = el.dataset.id;
    // Phó Giám đốc: không quét ẩn nút của họ ở đây — quyền §6 như admin trong phòng phụ trách.
    // Riêng nút của «staff» thì laQuanTriTrongPhamVi() KHÔNG mở (§6: user chỉ `read`), xem dưới.
    if (isAdmin()) return;
    if (laQuanTriTrongPhamVi() && type !== "staff") return;
    if (el.classList.contains("copy-btn")) {
      !canUserCopyResource(type, id) && (el.style.display = "none");
      return;
    }
    if (isManager()) type === "staff" && (el.style.display = "none");else {
      if (type === "project" || type === "staff") el.style.display = "none";else {
        if (type === "task") {
          const task = allTasks.find(task2 => task2[COL.T_ID] === id);
          if (task) {
            const taskPid = task[COL.T_PID],
              project = allProjects.find(project2 => project2[COL.P_ID] === taskPid);
            if (project && project[COL.P_MANAGER] === currentUser.name) return;
            task[COL.T_ASSIGNEE] !== currentUser.name && (el.style.display = "none");
          }
        }
      }
    }
  });
}
function handleLogout() {
  showConfirmDialog("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?", function () {
    google.script.run.withSuccessHandler(function (response) {
      currentUser = null, isAuthenticated = false, allProjects = [], allTasks = [], allStaff = [], document.getElementById("user-info").classList.add("hidden"), document.getElementById("login-prompt").classList.remove("hidden"), clearAllSections(), showLoginModal(), showToast("Đăng xuất thành công", "success");
    }).withFailureHandler(function (error) {
      showToast("Lỗi khi đăng xuất: " + error.message, "error");
    }).logout();
  }, null, "danger");
}
// Việc 4.5. Hai chế độ:
//   - thường: người dùng tự bấm "Đổi mật khẩu" ở thanh trên (nút truyền vào MouseEvent, nên phải
//     kiểm `forced === true`, không kiểm kiểu "có tham số hay không").
//   - CHẶN CỬA (`{forced: true}`, do `api-bridge.js` gọi khi máy chủ trả 403 MUST_CHANGE_PASSWORD):
//     bỏ hết đường thoát — không dấu ×, không nút Hủy — vì mật khẩu tạm vẫn còn hiệu lực thì tài
//     khoản còn mở cho người đã cấp nó. Đổi xong, cầu tương thích tự chạy lại lời gọi bị chặn.
//
// Có thêm ô "Mật khẩu hiện tại": `POST /api/v1/auth/password` bắt buộc có, vì đổi mật khẩu mà không
// cần mật khẩu cũ nghĩa là ai chiếm được phiên đang mở là chiếm luôn tài khoản. Bản cũ chỉ có 2 ô.
function showChangePasswordModal(options) {
  const forced = !!options && options.forced === true;
  const text = `
<div id="change-password-modal" class="modal">
  <div class="modal-content max-w-md">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold text-gray-900">Đổi mật khẩu</h3>
      ${
        forced
          ? ""
          : `<button type="button" class="close-modal text-gray-400 hover:text-gray-600">
        <i class="fas fa-times"></i>
      </button>`
      }
    </div>
    ${
      forced
        ? `<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
      <div class="flex items-center">
        <i class="fas fa-shield-halved text-amber-500 mr-2"></i>
        <span class="text-sm text-amber-700">Bạn phải đổi mật khẩu trước khi vào hệ thống.</span>
      </div>
    </div>`
        : ""
    }
    <form id="change-password-form">
      <div class="form-group">
        <label class="form-label">Mật khẩu hiện tại *</label>
        <input type="password" name="currentPassword" class="form-input" required
          autocomplete="current-password" placeholder="Nhập mật khẩu đang dùng">
      </div>

      <div class="form-group">
        <label class="form-label">Mật khẩu mới *</label>
        <input type="password" name="newPassword" class="form-input" required
          autocomplete="new-password" placeholder="Nhập mật khẩu mới">
      </div>

      <div class="form-group">
        <label class="form-label">Nhập lại mật khẩu mới *</label>
        <input type="password" name="confirmPassword" class="form-input" required
          autocomplete="new-password" placeholder="Nhập lại mật khẩu mới">
      </div>

      <div class="flex justify-end space-x-3 mt-6">
        ${forced ? "" : `<button type="button" class="btn-secondary close-modal">Hủy</button>`}
        <button type="submit" class="btn-primary">Đổi mật khẩu</button>
      </div>
    </form>
  </div>
</div>
`;
  document.getElementById("modals-container").innerHTML = text;
  const changePasswordModalEl = document.getElementById("change-password-modal");
  changePasswordModalEl.classList.add("active");
  const el = changePasswordModalEl.querySelector("form");
  el.elements.currentPassword.focus();
  el.addEventListener("submit", function (event) {
    event.preventDefault();
    // `el.elements.X` chứ không `el.X`: hai cách chạy như nhau trên trình duyệt, nhưng chỉ cách này
    // chạy được cả dưới jsdom (jsdom không dựng thuộc tính theo tên trên <form>), nên modal này mới
    // có test tự động. Mật khẩu hiện tại KHÔNG `.trim()` — dấu cách là một phần mật khẩu đã đặt.
    const currentPassword = el.elements.currentPassword.value,
      trimmed = el.elements.newPassword.value.trim(),
      confirmPassword = el.elements.confirmPassword.value.trim(),
      el2 = el.querySelector("button[type=\"submit\"]");
    setButtonLoading(el2, true), google.script.run.withSuccessHandler(function (response) {
      setButtonLoading(el2, false);
      if (response.success) showToast(response.message, "success"), closeModal("change-password-modal");else {
        const el3 = changePasswordModalEl.querySelector("#change-password-error") || document.createElement("div");
        !changePasswordModalEl.querySelector("#change-password-error") && (el3.id = "change-password-error", el3.className = "p-3 bg-red-50 border border-red-200 rounded-xl mb-4", el3.innerHTML = "<div class=\"flex items-center\"><i class=\"fas fa-exclamation-circle text-red-500 mr-2\"></i><span class=\"text-sm text-red-700\"></span></div>", el.insertBefore(el3, el.querySelector(".flex.justify-end"))), el3.querySelector("span").textContent = response.error, el3.classList.remove("hidden");
      }
    }).withFailureHandler(function (error) {
      setButtonLoading(el2, false), showToast("Lỗi: " + error.message, "error");
    }).changePassword(currentPassword, trimmed, confirmPassword);
  });
  const closeButtons = changePasswordModalEl.querySelectorAll(".close-modal");
  closeButtons.forEach(closeButton => {
    closeButton.addEventListener("click", event => {
      event.preventDefault(), closeModal("change-password-modal");
    });
  });
}
function setLoginLoading(isLoading) {
  const loginSubmitBtnEl = document.getElementById("login-submit-btn"),
    loginBtnTextEl = document.getElementById("login-btn-text");
  isLoading ? (loginSubmitBtnEl.classList.add("loading"), loginSubmitBtnEl.disabled = true, loginBtnTextEl.textContent = "") : (loginSubmitBtnEl.classList.remove("loading"), loginSubmitBtnEl.disabled = false, loginBtnTextEl.textContent = "Đăng nhập");
}
function showLoginError(message) {
  const loginErrorEl = document.getElementById("login-error"),
    loginErrorMessageEl = document.getElementById("login-error-message");
  loginErrorEl && loginErrorMessageEl && (loginErrorMessageEl.textContent = message, loginErrorEl.classList.remove("hidden"));
}
function clearAllSections() {
  const values = ["#projects-grid", "#tasks-grid", "#staff-grid", "#project-task-tree", "#priority-tasks", "#recent-activity"];
  values.forEach(value => {
    const el = document.querySelector(value);
    el && (el.innerHTML = "<div class=\"loading-card\">Vui lòng đăng nhập</div>");
  });
  const values2 = ["total-projects", "completed-projects", "project-completion-rate", "total-tasks", "completed-tasks", "task-completion-rate", "active-tasks", "pending-tasks", "paused-tasks", "overdue-tasks", "overdue-total-tasks", "overdue-rate"];
  values2.forEach(values22 => {
    const el = document.getElementById(values22);
    el && (el.textContent = "-");
  });
}
function updatePageTitle() {
  const pageTitleEl = document.getElementById("page-title");
  if (pageTitleEl && currentUser) {
    const data = {
        overview: "Tổng Quan",
        projects: "Quản lý Công việc",
        tasks: "Quản lý Nhiệm vụ",
        staff: "Quản lý đối tượng"
      },
      data2 = data[currentSection] || "Dashboard",
      currentUserName = currentUser.name || "User";
    pageTitleEl.textContent = data2 + " - " + currentUserName;
  }
}
function isAdmin() {
  return currentUser && currentUser.role && currentUser.role.toLowerCase().includes("admin");
}
function isManager() {
  return currentUser && currentUser.role && currentUser.role.toLowerCase().includes("quản lý");
}
/**
 * 2026-08-27 — «quản trị TRONG PHẠM VI»: admin toàn hệ thống, hoặc Phó Giám đốc (§6 cho vai này
 * quyền đọc/thêm/sửa/xoá/duyệt như admin nhưng CHỈ ở các phòng mình phụ trách).
 *
 * Dùng để MỞ NÚT trên giao diện, không phải để cấp quyền: máy chủ vẫn là rào chặn cuối
 * (`server/src/middleware/rbac.js` — `PERMISSIONS` rồi `inScope()` bó theo `managedDepartmentIds`).
 * Trình duyệt KHÔNG biết danh sách id phòng phụ trách, nên nút có thể mở rộng hơn phạm vi thật;
 * lúc ấy API trả 403 và người dùng thấy thông báo — đúng thiết kế, còn hơn ẩn nút của cả những
 * phòng họ thực sự phụ trách (bệnh cũ: Phó Giám đốc không thấy tab «Quản lý công việc»).
 * `isDeputyDirectorUser` đến từ `getDepartmentContext()`; so chuỗi vai trò là đường dự phòng cho
 * lúc chưa nạp xong ngữ cảnh phòng.
 */
function laQuanTriTrongPhamVi() {
  if (isAdmin()) return true;
  if (typeof isDeputyDirectorUser !== "undefined" && isDeputyDirectorUser) return true;
  return !!(currentUser && String(currentUser.role || "") === "Phó Giám đốc");
}
/** Trưởng phòng / Phó phòng — hai vai lãnh đạo phòng (§6, Quyết định số 5: quyền như nhau).
 * 2026-08-29: được THÊM công việc cấp 1 — máy chủ PERMISSIONS đã cho work.create, nút phía
 * client chỉ cần mở theo. PGD/admin đi qua laQuanTriTrongPhamVi(), «Quản lý công việc» qua
 * isManager(). Máy chủ vẫn là rào chặn cuối (inScope bó theo phòng). */
function laLanhDaoPhong() {
  const vai = currentUser ? String(currentUser.role || "") : "";
  return vai === "Trưởng phòng" || vai === "Phó phòng";
}
function hideLoginError() {
  const loginErrorEl = document.getElementById("login-error");
  loginErrorEl && loginErrorEl.classList.add("hidden");
}
function setupEventListeners() {
  document.querySelectorAll(".nav-link").forEach(item => {
    item.addEventListener("click", function (event) {
      event.preventDefault();
      const section = this.dataset.section;
      section !== "activity" && isAuthenticated && switchSection(section);
    });
  }), document.getElementById("send-chat-btn")?.addEventListener("click", sendChatMessage), document.getElementById("chat-input")?.addEventListener("keypress", function (event) {
    event.key === "Enter" && sendChatMessage();
  }), document.addEventListener("click", handleQuickCompleteTask), document.getElementById("change-password-btn")?.addEventListener("click", showChangePasswordModal), document.getElementById("uy-quyen-btn")?.addEventListener("click", moModalUyQuyen), document.getElementById("mobile-menu-btn").addEventListener("click", toggleMobileMenu), document.getElementById("mobile-overlay").addEventListener("click", closeMobileMenu), document.getElementById("login-btn")?.addEventListener("click", showLoginModal), document.getElementById("logout-btn")?.addEventListener("click", handleLogout), document.getElementById("login-form")?.addEventListener("submit", function (event) {
    event.preventDefault();
    const trimmed = document.getElementById("login-email").value.trim(),
      trimmed2 = document.getElementById("login-password").value.trim();
    handleLogin(trimmed, trimmed2);
  }), document.getElementById("quick-add-project")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && (laQuanTriTrongPhamVi() || isManager() || laLanhDaoPhong())) openModal("project");
  }), document.getElementById("quick-add-task")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && isAdmin()) {
      pendingTaskCreate = { level: 3, parentId: "" };
      openModal("task");
    }
  }), document.getElementById("quick-add-staff")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && isAdmin()) openModal("staff");
  }), document.getElementById("quick-add-proposal")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated) openModal("proposal");
  }), document.getElementById("quick-add-app")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && isAdmin()) openModal("app");
  }), document.getElementById("add-project-standalone")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && (laQuanTriTrongPhamVi() || isManager() || laLanhDaoPhong())) openModal("project");
  }), document.getElementById("add-task-standalone")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && canUserCreateTask()) {
      pendingTaskCreate = { level: 3, parentId: "" };
      openModal("task");
    }
  }), document.getElementById("quick-add-task")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && canUserCreateTask()) {
      pendingTaskCreate = { level: 3, parentId: "" };
      openModal("task");
    }
  }), document.getElementById("projects-search")?.addEventListener("input", event => {
    filterCards(".project-card", event.target.value.toLowerCase());
  }), document.getElementById("export-btn")?.addEventListener("click", capNhatLinkXuatExcel),document.getElementById("tasks-search")?.addEventListener("input", event => {
    filterTaskRows(event.target.value.toLowerCase());
  }), document.getElementById("tasks-status-filter")?.addEventListener("change", filterTasks), document.getElementById("projects-status-filter")?.addEventListener("change", filterProjects), document.addEventListener("click", function (event) {
    if (!isAuthenticated) return;
    if (event.target.matches(".add-task-from-project-btn") || event.target.closest(".add-task-from-project-btn")) {
      const target = event.target.matches(".add-task-from-project-btn") ? event.target : event.target.closest(".add-task-from-project-btn"),
        projectId = target.dataset.projectId,
        projectName = target.dataset.projectName;
      isAuthenticated && canUserCreateTask() ? openTaskModalForProject(projectId, projectName) : showToast("Bạn không có quyền tạo nhiệm vụ", "error");
    }
    if (event.target.matches(".add-subwork-from-work-btn") || event.target.closest(".add-subwork-from-work-btn")) {
      const target = event.target.matches(".add-subwork-from-work-btn") ? event.target : event.target.closest(".add-subwork-from-work-btn"),
        projectId = target.dataset.projectId,
        projectName = target.dataset.projectName;
      event.stopPropagation();
      canUserCreateSubwork() ? openTaskModalForProject(projectId, projectName, {
        level: 2
      }) : showToast("Bạn không có quyền tạo công việc con", "error");
    }
    if (event.target.matches(".add-task-from-subwork-btn") || event.target.closest(".add-task-from-subwork-btn")) {
      const target = event.target.matches(".add-task-from-subwork-btn") ? event.target : event.target.closest(".add-task-from-subwork-btn"),
        projectId = target.dataset.projectId,
        projectName = target.dataset.projectName,
        parentId = target.dataset.parentId;
      event.stopPropagation();
      canUserCreateTask() ? openTaskModalForProject(projectId, projectName, {
        level: 3,
        parentId: parentId
      }) : showToast("Bạn không có quyền tạo nhiệm vụ", "error");
    }
    if (event.target.matches(".edit-btn") || event.target.closest(".edit-btn")) {
      const target = event.target.matches(".edit-btn") ? event.target : event.target.closest(".edit-btn"),
        type = target.dataset.type,
        id = target.dataset.id;
      if (document.getElementById("project-details-modal") && type === "task") {
        const projectDetailsModalEl = document.getElementById("project-details-modal"),
          text = projectDetailsModalEl.querySelector("h3").textContent.replace("Chi tiết công việc: ", ""),
          taskPid = allTasks.find(task => task[COL.T_ID] === id)?.[COL.T_PID];
        openedFromProjectDetails = {
          projectId: taskPid,
          projectName: text
        };
      }
      canUserEditResource(type, id) ? openEditModal(type, id) : showToast("Bạn không có quyền chỉnh sửa mục này", "error");
    }
    if (event.target.matches(".copy-btn") || event.target.closest(".copy-btn")) {
      const target = event.target.matches(".copy-btn") ? event.target : event.target.closest(".copy-btn"),
        type = target.dataset.type,
        id = target.dataset.id,
        name = target.dataset.name || id;
      canUserCopyResource(type, id) ? openCopyModal(type, id, name) : showToast("Bạn không có quyền tạo bản sao mục này", "error");
    }
    if (event.target.matches(".gui-duyet-btn") || event.target.closest(".gui-duyet-btn")) {
      // «Gửi duyệt» trên thẻ bản nháp (012): gửi CẢ CÂY một lần, người duyệt thấy đúng một dòng.
      const target = event.target.matches(".gui-duyet-btn") ? event.target : event.target.closest(".gui-duyet-btn"),
        entity = target.dataset.entity || "work",
        id = target.dataset.id;
      if (id) {
        target.disabled = true;
        guiDuyetCaCay(entity, id);
      }
      return;
    }
    if (event.target.matches(".view-project-btn") || event.target.closest(".view-project-btn")) {
      const target = event.target.matches(".view-project-btn") ? event.target : event.target.closest(".view-project-btn"),
        id = target.dataset.id,
        name = target.dataset.name;
      id && showProjectDetailsModal(id, name);
    }
    if (event.target.matches(".project-expand-btn") || event.target.closest(".project-expand-btn")) {
      const target = event.target.matches(".project-expand-btn") ? event.target : event.target.closest(".project-expand-btn");
    }
    if (event.target.matches(".delete-btn") || event.target.closest(".delete-btn")) {
      const target = event.target.matches(".delete-btn") ? event.target : event.target.closest(".delete-btn"),
        type = target.dataset.type,
        id = target.dataset.id,
        name = target.dataset.name || id;
      canUserDeleteResource(type, id) ? confirmDelete(type, id, name) : showToast("Bạn không có quyền xóa mục này", "error");
    }
  }), document.getElementById("refresh-btn")?.addEventListener("click", function () {
    isAuthenticated && (this.querySelector("i").classList.add("fa-spin"), refreshData(), setTimeout(() => {
      this.querySelector("i").classList.remove("fa-spin"), showToast("Đã làm mới dữ liệu!", "success");
    }, 1500));
  }), document.querySelector("[data-section=\"overview\"]")?.addEventListener("click", function () {
    if (isAuthenticated) {
      const chatMessagesEl = document.getElementById("chat-messages");
      chatMessagesEl && chatMessagesEl.innerHTML.trim() === "" && loadChatMessagesAsync();
    }
  }), document.getElementById("total-projects")?.closest(".modern-stat-card")?.addEventListener("click", () => {
    openStatListModal("project", "all", "Danh sách tất cả công việc");
  }), document.getElementById("total-tasks")?.closest(".modern-stat-card")?.addEventListener("click", () => {
    openStatListModal("task", "all", "Danh sách tất cả nhiệm vụ");
  }), document.getElementById("active-tasks")?.closest(".modern-stat-card")?.addEventListener("click", () => {
    openStatListModal("task", "active", "Danh sách nhiệm vụ đang làm");
  }), document.getElementById("overdue-tasks")?.closest(".modern-stat-card")?.addEventListener("click", () => {
    openStatListModal("task", "overdue", "Danh sách nhiệm vụ quá hạn");
  }), setupGanttEventListeners(), setupOverviewProjectFilter();
  // 2026-08-27: tab Nhiệm vụ dùng Tháng/Năm + Cán bộ + Phòng (không còn ô «ngày» đơn lẻ),
  // và mỗi công việc con là một khối tự thu gọn được.
  setupTasksFilterControls();
  // 2026-08-28: tab Công việc cũng dùng Tháng/Năm (giống Gantt) + lọc theo nhóm phòng.
  setupProjectsFilterControls();
  setupTrangTaiKhoan();
  document.addEventListener("click", function (event) {
    const toggleBtn = event.target.closest(".tasks-subwork-toggle");
    if (!toggleBtn) return;
    doiTrangThaiThuGonTasks(toggleBtn.dataset.khoi || "");
  });
}
function setupOverviewProjectFilter() {
  const overviewProjectFilterEl = document.getElementById("overview-project-filter"),
    overviewProjectListEl = document.getElementById("overview-project-list"),
    clearBtn = document.getElementById("clear-project-filter"),
    projectFilterErrorEl = document.getElementById("project-filter-error");
  if (!overviewProjectFilterEl || !overviewProjectListEl) return;
  function populateProjectDatalist() {
    overviewProjectListEl.innerHTML = allProjects.map(project => "<option value=\"" + escapeHtml(project[COL.P_NAME]) + " (" + escapeHtml(project[COL.P_ID]) + ")\" data-id=\"" + escapeHtml(project[COL.P_ID]) + "\"></option>").join("");
  }
  populateProjectDatalist(), overviewProjectFilterEl.addEventListener("change", function () {
    const trimmed = this.value.trim();
    if (!trimmed) {
      currentOverviewProjectFilter = null, clearBtn.classList.add("hidden"), projectFilterErrorEl.classList.add("hidden"), overviewProjectFilterEl.classList.remove("border-red-500"), applyOverviewFilter();
      return;
    }
    const project = allProjects.find(project2 => project2[COL.P_NAME] + " (" + project2[COL.P_ID] + ")" === trimmed || project2[COL.P_ID] === trimmed || project2[COL.P_NAME].toLowerCase() === trimmed.toLowerCase());
    project ? (currentOverviewProjectFilter = project[COL.P_ID], overviewProjectFilterEl.value = project[COL.P_NAME] + " (" + project[COL.P_ID] + ")", clearBtn.classList.remove("hidden"), projectFilterErrorEl.classList.add("hidden"), overviewProjectFilterEl.classList.remove("border-red-500"), applyOverviewFilter()) : (projectFilterErrorEl.classList.remove("hidden"), overviewProjectFilterEl.classList.add("border-red-500"));
  }), overviewProjectFilterEl.addEventListener("blur", function () {
    const trimmed = this.value.trim();
    if (trimmed && !currentOverviewProjectFilter) {
      const project = allProjects.find(project2 => project2[COL.P_NAME] + " (" + project2[COL.P_ID] + ")" === trimmed || project2[COL.P_ID] === trimmed || project2[COL.P_NAME].toLowerCase() === trimmed.toLowerCase());
      !project && (projectFilterErrorEl.classList.remove("hidden"), overviewProjectFilterEl.classList.add("border-red-500"));
    }
  }), clearBtn.addEventListener("click", function () {
    overviewProjectFilterEl.value = "", currentOverviewProjectFilter = null, clearBtn.classList.add("hidden"), projectFilterErrorEl.classList.add("hidden"), overviewProjectFilterEl.classList.remove("border-red-500"), applyOverviewFilter();
  });
}
/**
 * Việc 5.4 nửa giao diện: thẻ số và 6 biểu đồ không được đếm mục 'Chờ duyệt'
 * (kể cả dòng nằm dưới một mục đang chờ). Danh sách / cây vẫn hiện đủ — chỉ
 * `getFiltered*` (dùng cho thống kê) và `renderStats` đi qua cửa này.
 * Khớp `v_countable_works` / `v_countable_items`.
 */
function isCountableRow(row) {
  // Bản NHÁP (012) bị loại y như «Chờ duyệt», ở CẢ dòng của chính nó và cả nhánh trên nó — cùng
  // luật với hai view `v_countable_*` của máy chủ. Đây là bản đối chiếu phía trình duyệt cho
  // những khung tính tại chỗ; máy chủ vẫn là nguồn sự thật của mọi con số thống kê.
  const chuaQuaCua = (r) => isPendingApproval(r) || laNhap(r);
  if (!row || chuaQuaCua(row)) return false;
  const work = allProjects.find(project => project[COL.P_ID] === row[COL.T_PID]);
  if (work && chuaQuaCua(work)) return false;
  const parentCode = row[COL.T_PARENT];
  if (parentCode) {
    const parent = allTasks.find(task => task[COL.T_ID] === parentCode);
    if (parent && chuaQuaCua(parent)) return false;
  }
  return true;
}
function getFilteredProjects() {
  const list = currentOverviewProjectFilter ? allProjects.filter(project => project[COL.P_ID] === currentOverviewProjectFilter) : allProjects;
  return list.filter(isCountableRow);
}
function getFilteredTasks() {
  const list = currentOverviewProjectFilter ? allTasks.filter(task => task[COL.T_PID] === currentOverviewProjectFilter) : allTasks;
  return list.filter(isCountableRow);
}
function applyOverviewFilter() {
  renderStats(), renderPriorityTasksMini(), renderChart(), renderProjectProgressChart(), renderTaskPriorityChart(), renderTimelineProgressChart(), renderProjectComparisonChart(), renderStaffPerformanceChart();
}
function updateOverviewProjectDatalist() {
  const overviewProjectListEl = document.getElementById("overview-project-list");
  overviewProjectListEl && allProjects.length > 0 && (overviewProjectListEl.innerHTML = allProjects.map(project => "<option value=\"" + escapeHtml(project[COL.P_NAME]) + " (" + escapeHtml(project[COL.P_ID]) + ")\" data-id=\"" + escapeHtml(project[COL.P_ID]) + "\"></option>").join(""));
}
function openTaskModalFromProject(projectId, projectName) {
  openedFromProjectDetails = {
    projectId: projectId,
    projectName: projectName
  }, openTaskModalForProject(projectId, projectName);
}
function filterTasks() {
  const searchTerm = document.getElementById("tasks-search").value.toLowerCase(),
    value = document.getElementById("tasks-status-filter").value,
    els = document.querySelectorAll("#tasks-section .glass-card:has(table)");
  els.forEach(el => {
    const els2 = el.querySelectorAll("tbody tr");
    let flag = false;
    els2.forEach(els22 => {
      const lower = els22.textContent.toLowerCase(),
        el2 = els22.querySelector(".status-badge"),
        trimmed = el2 ? el2.textContent.trim() : "",
        hasMatch = lower.includes(searchTerm),
        flag2 = !value || trimmed === value,
        hasMatch2 = hasMatch && flag2;
      els22.style.display = hasMatch2 ? "" : "none";
      if (hasMatch2) flag = true;
    }), el.style.display = flag ? "" : "none";
  });
}
function filterProjects() {
  const searchTerm = document.getElementById("projects-search").value.toLowerCase(),
    value = document.getElementById("projects-status-filter").value,
    els = document.querySelectorAll(".project-card");
  els.forEach(el => {
    const lower = el.textContent.toLowerCase(),
      el2 = el.querySelector(".status-badge"),
      trimmed = el2 ? el2.textContent.trim() : "",
      hasMatch = lower.includes(searchTerm),
      flag = !value || trimmed === value,
      hasMatch2 = hasMatch && flag;
    el.style.display = hasMatch2 ? "block" : "none";
  });
}
function filterTaskRows(searchTerm) {
  const els = document.querySelectorAll("#tasks-section .glass-card"),
    filtered = Array.from(els).filter(item => item.querySelector("table") !== null);
  filtered.forEach(filtered2 => {
    const els2 = filtered2.querySelectorAll("tbody tr");
    let flag = false;
    els2.forEach(els22 => {
      const lower = els22.textContent.toLowerCase(),
        hasMatch = lower.includes(searchTerm);
      els22.style.display = hasMatch ? "" : "none";
      if (hasMatch) flag = true;
    }), filtered2.style.display = flag ? "" : "none";
  });
}
function showProjectDetailsModal(projectId, projectName) {
  const filteredTasks = allTasks.filter(task => task[COL.T_PID] === projectId),
    filteredTaskCount = filteredTasks.length,
    count = filteredTasks.filter(filteredTask => (filteredTask[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
    count2 = filteredTasks.filter(filteredTask => (filteredTask[COL.T_STATUS] || "").toLowerCase().includes("đang")).length,
    count3 = filteredTasks.filter(filteredTask => (filteredTask[COL.T_STATUS] || "").toLowerCase().includes("chưa")).length,
    count4 = filteredTasks.filter(filteredTask => isTaskOverdue(filteredTask[COL.T_DUE]) && !(filteredTask[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
    filteredTaskTotal = filteredTasks.reduce((acc, filteredTask) => acc + parseInt(filteredTask[COL.T_COMPLETION] || 0), 0),
    num = filteredTaskCount > 0 ? Math.round(filteredTaskTotal / filteredTaskCount) : 0,
    text = "\n    <div id=\"project-details-modal\" class=\"modal active z-[60]\">\n        <div class=\"modal-content glass-card max-w-7xl w-full mx-0 md:mx-4 h-full md:h-[90vh] flex flex-col p-0 rounded-none md:rounded-2xl\">\n            <!-- Header -->\n            <div class=\"flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex-shrink-0 bg-white z-10 sticky top-0 md:relative\">\n                <h3 class=\"text-lg md:text-xl font-bold text-gray-900 truncate pr-2\">Chi tiết công việc: " + escapeHtml(projectName) + " (" + escapeHtml(projectId) + ")</h3>\n                <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600 p-2\">\n                    <i class=\"fas fa-times text-lg\"></i>\n                </button>\n            </div>\n            \n            <!-- Main Content -->\n            <div class=\"flex-1 overflow-y-auto md:overflow-hidden\">\n                <div class=\"grid grid-cols-1 lg:grid-cols-4 h-auto md:h-full divide-y lg:divide-y-0 lg:divide-x divide-gray-100\">\n                    \n                    <!-- Left Column: Stats -->\n                    <div class=\"p-3 md:p-6 h-auto md:h-full overflow-visible md:overflow-y-auto space-y-4 md:space-y-6 bg-gray-50/50\">\n                        <h4 class=\"font-semibold text-gray-800 hidden md:block\">Tổng quan</h4>\n                        \n                        <!-- Add Task Button (Moved to top) -->\n                        " + createSubworkFromWorkButtonHtml(projectId, projectName, "w-full btn-secondary justify-center py-2 md:py-2.5 text-sm md:text-base mb-2", true) + "\n                        <button onclick=\"openTaskModalFromProject('" + escapeForInlineHandler(projectId) + "', '" + escapeForInlineHandler(projectName) + "')\" class=\"w-full btn-secondary justify-center py-2 md:py-2.5 text-sm md:text-base\">\n                            <i class=\"fas fa-plus mr-2\"></i>Thêm nhiệm vụ\n                        </button>\n\n                        <!-- Stats Grid stacked -->\n                        <div class=\"grid grid-cols-2 lg:grid-cols-1 gap-2 md:gap-4\">\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Tổng nhiệm vụ</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-gray-700 leading-none\">" + escapeHtml(filteredTaskCount) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-list text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Hoàn thành</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-green-600 leading-none\">" + escapeHtml(count) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-check text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Đang thực hiện</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-blue-600 leading-none\">" + escapeHtml(count2) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-spinner text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Quá hạn</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-red-600 leading-none\">" + escapeHtml(count4) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-exclamation-triangle text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                        </div>\n\n                        <!-- Progress -->\n                        <div class=\"glass-card p-3 md:p-4\">\n                            <div class=\"flex items-center justify-between mb-2\">\n                                <h4 class=\"font-semibold text-gray-700 text-sm md:text-base\">Tiến độ chung</h4>\n                                <span class=\"text-base md:text-lg font-bold text-blue-600\">" + escapeHtml(num) + "%</span>\n                            </div>\n                            <div class=\"h-2 md:h-3 bg-gray-100 rounded-full overflow-hidden\">\n                                <div class=\"h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                            </div>\n                        </div>\n                    </div>\n\n                    <!-- Right Column: Tasks -->\n                    <div class=\"lg:col-span-3 flex flex-col h-auto md:h-full overflow-visible md:overflow-hidden\">\n                        <div class=\"flex-1 overflow-visible md:overflow-y-auto p-3 md:p-4 custom-scrollbar h-auto md:h-full\">\n                            " + (filteredTaskCount > 0 ? "<div class=\"grid grid-cols-2 md:grid-cols-2 xl:grid-cols-2 gap-2 md:gap-3\">\n                                    " + filteredTasks.map(filteredTask => createTaskListItem(filteredTask, true)).join("") + "\n                                </div>" : "<div class=\"h-40 md:h-full flex flex-col items-center justify-center text-gray-400\">\n                                    <i class=\"fas fa-tasks text-3xl md:text-4xl mb-2 opacity-30\"></i>\n                                    <p class=\"text-sm md:text-base\">Chưa có nhiệm vụ nào</p>\n                                </div>") + "\n                        </div>\n                         <!-- Removed Bottom Actions -->\n                    </div>\n                </div>\n            </div>\n        </div>\n    </div>\n";
  document.getElementById("modals-container").innerHTML = text;
  const projectDetailsModalEl = document.getElementById("project-details-modal");
  projectDetailsModalEl.classList.add("active");
  const closeButtons = projectDetailsModalEl.querySelectorAll(".close-modal");
  closeButtons.forEach(closeButton => {
    closeButton.addEventListener("click", event => {
      event.preventDefault(), closeModal("project-details-modal");
    });
  });
}
function createTaskListItem(task, isCompact = false) {
  const taskId = task[COL.T_ID] || "N/A",
    taskName = task[COL.T_NAME] || "Chưa có tên",
    taskAssignee = task[COL.T_ASSIGNEE] || "Chưa gán",
    taskStatus = task[COL.T_STATUS] || "Chưa bắt đầu",
    taskPriority = task[COL.T_PRIORITY] || "Trung bình",
    dueDateText = formatDateForDisplay(task[COL.T_DUE]),
    num = parseInt(task[COL.T_COMPLETION] || 0),
    isTaskOverdue2 = isTaskOverdue(task[COL.T_DUE]) && !taskStatus.toLowerCase().includes("hoàn thành"),
    taskPid = task[COL.T_PID],
    statusClass = getStatusClass(taskStatus),
    priorityClass = getPriorityClass(taskPriority),
    isArray = Array.isArray(task[COL.T_REMINDERS]) && task[COL.T_REMINDERS].length > 0;
  if (isCompact) return "\n            <div class=\"glass-card p-2 md:p-3 hover:shadow-md transition-shadow " + (isTaskOverdue2 ? "border-l-4 border-red-500" : "") + " task-clickable cursor-pointer draggable-item flex flex-col justify-between h-full bg-white border border-gray-100 rounded-xl\" \n                  data-id=\"" + escapeHtml(taskId) + "\" \n                  data-project-id=\"" + escapeHtml(taskPid) + "\"\n                  draggable=\"true\">\n                \n                <div class=\"flex justify-between items-start mb-1.5 md:mb-2 gap-2\">\n                    <h5 class=\"font-semibold text-gray-800 text-xs md:text-sm line-clamp-2 leading-snug flex-1\" title=\"" + escapeHtml(taskName) + "\">\n                        " + (isArray ? "<i class=\"fas fa-bell text-amber-500 mr-1 text-[10px] md:text-xs\"></i>" : "") + escapeHtml(taskName) + "\n                    </h5>\n                    " + (isTaskOverdue2 ? "<i class=\"fas fa-exclamation-circle text-red-500 text-[10px] md:text-xs shrink-0\" title=\"Quá hạn\"></i>" : "") + "\n                </div>\n\n                <div class=\"space-y-1.5 md:space-y-2 mt-auto\">\n                    <!-- Date & User -->\n                    <div class=\"flex items-center justify-between text-[10px] md:text-xs text-gray-500\">\n                        <div class=\"flex items-center gap-1.5 md:gap-2\">\n                             " + "\n                        </div>\n                        <span class=\"" + (isTaskOverdue2 ? "text-red-500 font-medium" : "") + "\">" + escapeHtml(dueDateText) + "</span>\n                    </div>\n\n                    <!-- Status & Priority -->\n                    <div class=\"flex items-center gap-1 md:gap-1.5 flex-wrap\">\n                        <span class=\"status-badge " + escapeHtml(statusClass) + " text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5\">" + escapeHtml(taskStatus) + "</span>" + pendingApprovalBadge(task) + "\n                        <span class=\"status-badge " + escapeHtml(priorityClass) + " text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5\">" + escapeHtml(taskPriority) + "</span>\n                    </div>\n\n                    <!-- Actions & Progress -->\n                    <div class=\"flex items-center justify-between pt-1.5 md:pt-2 border-t border-gray-50 mt-0.5 md:mt-1\">\n                        <div class=\"flex items-center gap-1 text-[10px] md:text-xs text-gray-500 truncate max-w-[50%]\">\n                             <i class=\"fas fa-user-circle text-gray-400\"></i> " + escapeHtml(taskAssignee) + "\n                        </div>\n                        \n                         <div class=\"flex items-center gap-1\">\n                                " + (() => {
    const project = allProjects.find(project3 => project3[COL.P_ID] === task[COL.T_PID]),
      project2 = project && project[COL.P_MANAGER] === currentUser.name,
      isAdmin2 = laQuanTriTrongPhamVi() || project2;
    return "\n                                    " + createTaskFromSubworkButtonHtml(task, "w-5 h-5 md:w-6 md:h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 flex items-center justify-center p-0") + "\n                                    <button class=\"w-5 h-5 md:w-6 md:h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 action-btn-edit edit-btn flex items-center justify-center p-0\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\"><i class=\"fas fa-edit text-[10px] md:text-xs\"></i></button>\n                                    " + (isAdmin2 ? "<button class=\"w-5 h-5 md:w-6 md:h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 action-btn-delete delete-btn flex items-center justify-center p-0\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\"><i class=\"fas fa-trash text-[10px] md:text-xs\"></i></button>" : "") + "\n                                    ";
  })() + "\n                         </div>\n                    </div>\n                    \n                    <!-- Tiny Progress Bar -->\n                     <div class=\"w-full bg-gray-100 h-0.5 md:h-1 rounded-full overflow-hidden\">\n                        <div class=\"h-full " + (num === 100 ? "bg-green-500" : "bg-blue-500") + "\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                     </div>\n                </div>\n            </div>\n            ";
  return "\n    <div class=\"glass-card p-4 hover:shadow-md transition-shadow " + (isTaskOverdue2 ? "border-l-4 border-red-500" : "") + " task-clickable cursor-pointer draggable-item\" \n          data-id=\"" + escapeHtml(taskId) + "\" \n          data-project-id=\"" + escapeHtml(taskPid) + "\"\n          draggable=\"true\">\n        <div class=\"flex items-center justify-between\">\n            <div class=\"flex-1\">\n                <h5 class=\"font-medium text-gray-900\">" + (isArray ? "<i class=\"fas fa-bell text-amber-500 mr-1\" title=\"Có nhắc việc\"></i>" : "") + escapeHtml(taskName) + " <span class=\"text-gray-500 text-xs\">(" + escapeHtml(taskId) + ")</span></h5>\n                \n                <div class=\"flex flex-wrap items-center gap-2 mt-2\">\n                    <span class=\"status-badge " + escapeHtml(statusClass) + "\">" + escapeHtml(taskStatus) + "</span>" + pendingApprovalBadge(task) + "\n                    <span class=\"status-badge " + escapeHtml(priorityClass) + "\">" + escapeHtml(taskPriority) + "</span>\n                    " + (isTaskOverdue2 ? "<span class=\"status-badge status-overdue\">Quá hạn</span>" : "") + "\n                </div>\n            </div>\n            \n            <div class=\"ml-4 flex flex-col items-end\">\n                <div class=\"flex items-center space-x-1 mb-2\">\n                    " + (() => {
    const project = allProjects.find(project3 => project3[COL.P_ID] === task[COL.T_PID]),
      project2 = project && project[COL.P_MANAGER] === currentUser.name,
      isAdmin2 = laQuanTriTrongPhamVi() || project2;
    return "\n                        " + createTaskFromSubworkButtonHtml(task, "action-btn action-btn-edit") + "\n                        " + (isAdmin2 ? "<button class=\"action-btn action-btn-copy copy-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Tạo bản sao\"><i class=\"fas fa-copy\"></i></button>" : "") + "\n                        <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" title=\"Chỉnh sửa\"><i class=\"fas fa-edit\"></i></button>\n                        " + (isAdmin2 ? "<button class=\"action-btn action-btn-delete delete-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Xóa\"><i class=\"fas fa-trash\"></i></button>" : "") + "\n                      ";
  })() + "\n                </div>\n                <div class=\"flex items-center text-sm text-gray-600 mb-1\">\n                    <i class=\"fas fa-user mr-1\"></i>\n                    <span>" + escapeHtml(taskAssignee) + "</span>\n                </div>\n                <div class=\"flex items-center text-sm text-gray-600\">\n                    <i class=\"fas fa-calendar-alt mr-1\"></i>\n                    <span>" + escapeHtml(dueDateText) + "</span>\n                </div>\n            </div>\n        </div>\n        \n        <div class=\"mt-3\">\n            <div class=\"flex items-center justify-between text-xs text-gray-600 mb-1\">\n                <span>Tiến độ</span>\n                <span>" + escapeHtml(num) + "%</span>\n            </div>\n            <div class=\"h-1.5 bg-gray-200 rounded-full\">\n                <div class=\"h-full " + (taskStatus.toLowerCase().includes("hoàn thành") ? "bg-green-500" : "bg-blue-500") + " rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n            </div>\n        </div>\n    </div>\n";
}
function canUserEditResource(resourceType, resourceId) {
  // 2026-08-27: Phó Giám đốc sửa được công việc/công việc con/nhiệm vụ (§6) — phạm vi phòng phụ
  // trách do máy chủ kiểm (`inScope`), ở đây chỉ mở nút. Đề xuất KHÔNG đổi: vẫn của người tạo.
  if (laQuanTriTrongPhamVi()) return true;
  // Vòng 12c: Trưởng phòng / Phó phòng sửa được công việc & CV con phòng mình (§6; TP/PP sửa
  // CV con đã duyệt sẽ tự về «Chờ duyệt» — máy chủ lo). Không phụ thuộc phân công ba lớp.
  if (laLanhDaoPhong() && (resourceType === "project" || resourceType === "subwork")) return true;
  if (isManager()) {
    if (resourceType === "project") return true;
    if (resourceType === "task") return true;
  }
  if (resourceType === "project") {
    const project = allProjects.find(project2 => project2[COL.P_ID] === resourceId);
    if (project && project[COL.P_MANAGER] === currentUser.name) return true;
    return false;
  }
  if (resourceType === "task") {
    const task = allTasks.find(task2 => task2[COL.T_ID] === resourceId);
    if (!task) return false;
    const taskPid = task[COL.T_PID],
      project = allProjects.find(project2 => project2[COL.P_ID] === taskPid);
    if (project && project[COL.P_MANAGER] === currentUser.name) return true;
    return task[COL.T_ASSIGNEE] === currentUser.name;
  }
  if (resourceType === "proposal") {
    const proposal = allProposals.find(proposal2 => proposal2[COL.PR_ID] === resourceId);
    if (!proposal) return false;
    const proposalStatus = proposal[COL.PR_STATUS] || "Đề xuất mới";
    if (proposalStatus !== "Đề xuất mới") return false;
    return proposal[COL.PR_CREATOR] === currentUser.name;
  }
  return false;
}
function canUserDeleteResource(resourceType, resourceId) {
  if (laQuanTriTrongPhamVi()) return true;
  // Vòng 12e: máy chủ cho Trưởng phòng / Phó phòng XOÁ work/subwork/task trong phòng mình (ma trận
  // §6 + `inScope` case 'Trưởng phòng'/'Phó phòng'), nên nút phải mở theo — đối xứng với
  // canUserEditResource đã mở từ Vòng 12c. Phạm vi phòng do máy chủ bó; ngoài phạm vi thì 403.
  if (laLanhDaoPhong() && (resourceType === "project" || resourceType === "subwork" || resourceType === "task")) return true;
  if (isManager()) {
    if (resourceType === "project") return true;
    if (resourceType === "task") return true;
  }
  if (resourceType === "project") {
    const project = allProjects.find(project2 => project2[COL.P_ID] === resourceId);
    if (project && project[COL.P_MANAGER] === currentUser.name) return true;
    return false;
  }
  if (resourceType === "task") {
    const task = allTasks.find(task2 => task2[COL.T_ID] === resourceId);
    if (!task) return false;
    const taskPid = task[COL.T_PID],
      project = allProjects.find(project2 => project2[COL.P_ID] === taskPid);
    if (project && project[COL.P_MANAGER] === currentUser.name) return true;
    return task[COL.T_ASSIGNEE] === currentUser.name;
  }
  if (resourceType === "proposal") {
    const proposal = allProposals.find(proposal2 => proposal2[COL.PR_ID] === resourceId);
    if (!proposal) return false;
    const proposalStatus = proposal[COL.PR_STATUS] || "Đề xuất mới";
    if (proposalStatus !== "Đề xuất mới") return false;
    return proposal[COL.PR_CREATOR] === currentUser.name;
  }
  return false;
}
function switchSection(sectionName) {
  document.querySelectorAll(".nav-link").forEach(item => {
    item.classList.remove("active");
  }), document.querySelector("[data-section=\"" + sectionName + "\"]").classList.add("active");
  const data = {
    overview: "Tổng Quan",
    projects: "Quản lý Công việc",
    tasks: "Quản lý Nhiệm vụ",
    staff: "Quản lý đối tượng",
    departments: "Cấu hình phòng",
    gantt: "Sơ đồ Gantt",
    proposals: "Quản lý Đề nghị",
    account: "Quản lý tài khoản"
  };
  document.getElementById("page-title").textContent = data[sectionName] || "Dashboard", document.querySelectorAll(".section").forEach(item => {
    item.classList.remove("active");
  }), document.getElementById(sectionName + "-section").classList.add("active"), currentSection = sectionName;
  const overviewFilterContainerEl = document.getElementById("overview-filter-container");
  overviewFilterContainerEl && (sectionName === "overview" ? overviewFilterContainerEl.classList.remove("hidden") : overviewFilterContainerEl.classList.add("hidden")), sectionName === "departments" && renderDepartments(), sectionName === "gantt" && setTimeout(() => {
    renderGanttChart();
  }, 10), sectionName === "overview" && typeof napTongQuanTuServer === "function" && napTongQuanTuServer(), sectionName === "projects" && (setupProjectsFilterControls(), goiNutChoDuyetPanel(), renderChoDuyetPanel()), sectionName === "account" && renderTrangTaiKhoan(), closeMobileMenu();
}
function toggleMobileMenu() {
  const sidebarEl = document.getElementById("sidebar"),
    mobileOverlayEl = document.getElementById("mobile-overlay");
  sidebarEl.classList.add("open"), mobileOverlayEl.classList.remove("hidden"), setTimeout(() => mobileOverlayEl.classList.remove("opacity-0"), 10);
}
function closeMobileMenu() {
  const sidebarEl = document.getElementById("sidebar"),
    mobileOverlayEl = document.getElementById("mobile-overlay");
  sidebarEl.classList.remove("open"), mobileOverlayEl.classList.add("opacity-0"), setTimeout(() => mobileOverlayEl.classList.add("hidden"), 300);
}
function renderStats(summaryStats) {
  const allProjects2 = getFilteredProjects(),
    allTasks2 = getFilteredTasks();
  const projects2Length = allProjects2.length,
    count = allProjects2.filter(projects2 => (projects2[COL.P_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
    projects2Total = allProjects2.reduce((acc, projects2) => {
      const filteredTasks2 = allTasks2.filter(tasks2 => tasks2[COL.T_PID] === projects2[COL.P_ID]),
        num4 = filteredTasks2.length > 0 ? filteredTasks2.reduce((acc2, filteredTasks22) => acc2 + parseInt(filteredTasks22[COL.T_COMPLETION] || 0), 0) / filteredTasks2.length : 0;
      return acc + num4;
    }, 0),
    num = projects2Length > 0 ? Math.round(projects2Total / projects2Length) : 0,
    tasks2Length = allTasks2.length,
    count2 = allTasks2.filter(tasks2 => (tasks2[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
    num2 = tasks2Length > 0 ? Math.round(count2 / tasks2Length * 100) : 0,
    count3 = allTasks2.filter(tasks2 => (tasks2[COL.T_STATUS] || "").toLowerCase().includes("chưa")).length,
    count4 = allTasks2.filter(tasks2 => (tasks2[COL.T_STATUS] || "").toLowerCase().includes("đang")).length,
    count5 = allTasks2.filter(tasks2 => (tasks2[COL.T_STATUS] || "").toLowerCase().includes("tạm dừng")).length,
    text = count4 + count3 + count5,
    count6 = allTasks2.filter(tasks2 => isTaskOverdue(tasks2[COL.T_DUE]) && !(tasks2[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
    num3 = tasks2Length > 0 ? Math.round(count6 / tasks2Length * 100) : 0;
  document.getElementById("total-projects").textContent = projects2Length, document.getElementById("completed-projects").textContent = count, document.getElementById("project-completion-rate").textContent = num + "%", document.getElementById("total-tasks").textContent = tasks2Length, document.getElementById("completed-tasks").textContent = count2, document.getElementById("task-completion-rate").textContent = num2 + "%", document.getElementById("active-tasks").textContent = text, document.getElementById("pending-tasks").textContent = count3, document.getElementById("paused-tasks").textContent = count5, document.getElementById("overdue-tasks").textContent = count6, document.getElementById("overdue-total-tasks").textContent = tasks2Length, document.getElementById("overdue-rate").textContent = num3 + "%";
}
function createPriorityTaskCard(task) {
  const taskId = task[COL.T_ID] || "N/A",
    taskName = task[COL.T_NAME] || "Chưa có tên",
    taskDesc = task[COL.T_DESC] || "",
    taskPid = task[COL.T_PID] || "N/A",
    taskAssignee = task[COL.T_ASSIGNEE] || "Chưa gán",
    dueDateText = formatDateForDisplay(task[COL.T_DUE]),
    num = parseInt(task[COL.T_COMPLETION] || 0),
    project = allProjects.find(project2 => project2[COL.P_ID] === taskPid),
    projectName = project ? project[COL.P_NAME] : "",
    text = projectName ? projectName + " (" + taskPid + ")" : taskPid,
    isTaskOverdue2 = isTaskOverdue(task[COL.T_DUE]);
  return "\n    <div class=\"priority-task-card\" data-id=\"" + escapeHtml(taskId) + "\">\n        <div class=\"mb-3\">\n            <div class=\"flex items-start justify-between mb-1\">\n                <h5 class=\"font-medium text-gray-900 text-sm leading-tight\">" + escapeHtml(taskName) + "</h5>\n                " + (isTaskOverdue2 ? "<span class=\"status-badge status-overdue text-xs\">Quá hạn</span>" : "") + "\n            </div>\n            " + (taskDesc ? "<p class=\"text-xs text-gray-600 mb-2 leading-relaxed\">" + escapeHtml(taskDesc) + "</p>" : "") + "\n            <div class=\"text-xs text-gray-600 space-y-1\">\n                <div><i class=\"fas fa-folder mr-1\"></i>Dự án: " + escapeHtml(text) + "</div>\n                <div><i class=\"fas fa-user mr-1\"></i>" + escapeHtml(taskAssignee) + "</div>\n                <div><i class=\"fas fa-calendar mr-1\"></i>" + escapeHtml(dueDateText) + "</div>\n            </div>\n        </div>\n        <div class=\"flex items-center space-x-2\">\n            <span class=\"text-xs font-medium text-gray-700 min-w-[30px]\">" + escapeHtml(num) + "%</span>\n            <div class=\"flex-1 h-1.5 bg-gray-200 rounded-full\">\n                <div class=\"h-full bg-gradient-to-r from-red-400 to-orange-500 rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n            </div>\n        </div>\n    </div>\n";
}
/** Công việc PHỦ QUA tháng đang xem (YYYY-MM): bắt đầu ≤ cuối tháng và (kết thúc trống hoặc ≥ đầu tháng). */
function workMatchesMonth(project, thang) {
  if (!thang) return true;
  const dauThang = thang + "-01",
    ngayCuoi = new Date(Number(thang.slice(0, 4)), Number(thang.slice(5, 7)), 0).getDate(),
    cuoiThang = thang + "-" + String(ngayCuoi).padStart(2, "0"),
    batDau = project[COL.P_START] ? String(project[COL.P_START]).slice(0, 10) : "",
    ketThuc = project[COL.P_END] ? String(project[COL.P_END]).slice(0, 10) : "";
  if (!batDau && !ketThuc) return false;
  return (!batDau || batDau <= cuoiThang) && (!ketThuc || ketThuc >= dauThang);
}
function renderProjects() {
  const projectsGridEl = document.getElementById("projects-grid");
  if (!projectsGridEl) return;
  const thangDangXem = thangLocCongViec(),
    userAllowedProjects = getUserAllowedProjects().filter(project => workMatchesMonth(project, thangDangXem) && workMatchesProjectsDept(project));
  if (!userAllowedProjects || userAllowedProjects.length === 0) {
    projectsGridEl.innerHTML = "<div class=\"loading-card\">" + (thangDangXem ? "Không có công việc nào trong tháng " + escapeHtml(thangDangXem) : "Chưa có dự án nào") + "</div>";
    return;
  }
  projectsGridEl.innerHTML = userAllowedProjects.map(userAllowedProject => createProjectCard(userAllowedProject, true)).join("");
}
/** Tháng đang lọc ở tab Công việc, dạng "YYYY-MM"; rỗng = «Tất cả tháng». */
function thangLocCongViec() {
  if (!(projectsXemThang >= 1 && projectsXemThang <= 12)) return "";
  return String(projectsXemNam) + "-" + String(projectsXemThang).padStart(2, "0");
}
/** Lọc theo nhóm phòng của tab Công việc (rỗng = tất cả phòng nhìn thấy được). */
function workMatchesProjectsDept(project) {
  if (!projectsLocPhong) return true;
  return String(project[COL.P_DEPT] || "") === projectsLocPhong;
}
/** Ô Tháng/Năm + Phòng của tab Công việc — nối MỘT lần (mốc dataset.daNoi như Gantt). */
function setupProjectsFilterControls() {
  dongBoOThangNamProjects(), populateProjectsDeptFilter();
  const oThang = document.getElementById("projects-month-select"),
    oNam = document.getElementById("projects-year-select"),
    oPhong = document.getElementById("projects-dept-filter");
  oThang && !oThang.dataset.daNoi && ((oThang.dataset.daNoi = "1"), oThang.addEventListener("change", handleProjectsMonthChange));
  oNam && !oNam.dataset.daNoi && ((oNam.dataset.daNoi = "1"), oNam.addEventListener("change", handleProjectsYearChange));
  oPhong && !oPhong.dataset.daNoi && ((oPhong.dataset.daNoi = "1"), oPhong.addEventListener("change", handleProjectsDeptFilter));
}
function dongBoOThangNamProjects() {
  const oThang = document.getElementById("projects-month-select"),
    oNam = document.getElementById("projects-year-select");
  if (!oThang || !oNam) return;
  if (oThang.options.length === 0) {
    const opTatCa = document.createElement("option");
    opTatCa.value = "0", opTatCa.textContent = "Tất cả tháng", oThang.appendChild(opTatCa);
    for (let i = 1; i <= 12; i++) {
      const op = document.createElement("option");
      op.value = String(i), op.textContent = "Tháng " + i, oThang.appendChild(op);
    }
  }
  const namHienTai = new Date().getFullYear(),
    cacNam = [];
  for (let y = namHienTai - 2; y <= namHienTai + 3; y++) cacNam.push(y);
  if (cacNam.indexOf(projectsXemNam) < 0) cacNam.push(projectsXemNam);
  cacNam.sort((a, b) => a - b);
  if (oNam.options.length !== cacNam.length) {
    oNam.innerHTML = "";
    cacNam.forEach(y => {
      const op = document.createElement("option");
      op.value = String(y), op.textContent = "Năm " + y, oNam.appendChild(op);
    });
  }
  oThang.value = String(projectsXemThang), oNam.value = String(projectsXemNam);
}
function populateProjectsDeptFilter() {
  const el = document.getElementById("projects-dept-filter");
  if (!el || el.options.length > 1) return;
  const list = isAdmin() ? departmentNames : visibleDepartments.length > 0 ? visibleDepartments : departmentNames;
  (list || []).forEach(ten => {
    const op = document.createElement("option");
    op.value = ten, op.textContent = ten, el.appendChild(op);
  });
}
function handleProjectsMonthChange(event) {
  const so = parseInt(event.target.value, 10);
  if (!(so >= 0 && so <= 12)) return;
  projectsXemThang = so, renderProjects(), filterProjects(), capNhatLinkXuatExcel();
}
function handleProjectsYearChange(event) {
  const so = parseInt(event.target.value, 10);
  if (!(so >= 1900 && so <= 2200)) return;
  projectsXemNam = so, renderProjects(), filterProjects(), capNhatLinkXuatExcel();
}
function handleProjectsDeptFilter(event) {
  projectsLocPhong = event.target.value || "", renderProjects(), filterProjects();
}
function createProjectCard(project, showDetails = false) {
  const projectId = project[COL.P_ID] || "N/A",
    projectName = project[COL.P_NAME] || "Chưa có tên",
    // Tên theo THÁNG ĐANG XEM; các thuộc tính data-* dưới đây vẫn giữ TÊN GỐC vì chúng nuôi hộp
    // thoại Xoá/Nhân bản/Thêm nhiệm vụ — ở đó không có tháng nào đang xem.
    tenTheoThang = tenTheoThangCuaDong(project, projectName, thangLocCongViec()),
    tenCuTheoThang = tenGocNeuDaDoiCuaDong(project, projectName, thangLocCongViec()),
    projectDesc = project[COL.P_DESC] || "Không có mô tả",
    projectManager = project[COL.P_MANAGER] || "Chưa gán",
    projectStatus = project[COL.P_STATUS] || "Chưa bắt đầu",
    startDateText = formatDateForDisplay(project[COL.P_START]),
    endDateText = formatDateForDisplay(project[COL.P_END]),
    statusClass = getStatusClass(projectStatus),
    filteredTasks = allTasks.filter(task => task[COL.T_PID] === projectId),
    filteredTaskTotal = filteredTasks.reduce((acc, filteredTask) => acc + parseInt(filteredTask[COL.T_COMPLETION] || 0), 0),
    num = filteredTasks.length > 0 ? Math.round(filteredTaskTotal / filteredTasks.length) : 0;
  return "\n    <div class=\"project-card project-clickable cursor-pointer\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\">\n        <div class=\"relative mb-4\">\n          <div class=\"absolute top-0 right-0 flex space-x-1\">\n            " + createSubworkFromWorkButtonHtml(projectId, projectName, "action-btn action-btn-edit") + "\n            <button class=\"action-btn action-btn-edit add-task-from-project-btn\" data-project-id=\"" + escapeHtml(projectId) + "\" data-project-name=\"" + escapeHtml(projectName) + "\" title=\"Thêm nhiệm vụ\">\n              <i class=\"fas fa-plus\"></i>\n            </button>\n            <button class=\"action-btn action-btn-view view-project-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\" title=\"Xem chi tiết\">\n              <i class=\"fas fa-eye\"></i>\n            </button>\n            " + (laQuanTriTrongPhamVi() || laLanhDaoPhong() || project[COL.P_MANAGER] === currentUser.name && isManager() ? "\n              <button class=\"action-btn action-btn-copy copy-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\" title=\"Tạo bản sao\">\n                <i class=\"fas fa-copy\"></i>\n              </button>\n            " : "") + "\n            " + (laQuanTriTrongPhamVi() || laLanhDaoPhong() || project[COL.P_MANAGER] === currentUser.name ? "\n              <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" title=\"Chỉnh sửa\">\n                <i class=\"fas fa-edit\"></i>\n              </button>\n            " : "") + "\n            " + (laQuanTriTrongPhamVi() || laLanhDaoPhong() || project[COL.P_MANAGER] === currentUser.name && isManager() ? "\n              <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\" title=\"Xóa\">\n                <i class=\"fas fa-trash\"></i>\n              </button>\n            " : "") + "\n          </div>\n          \n          <div class=\"pr-24\">\n            <div class=\"mb-3\">\n              <span class=\"status-badge " + escapeHtml(statusClass) + "\">" + escapeHtml(projectStatus) + "</span>" + pendingApprovalBadge(project) + nhapBadge(project) + buildXinXoaBadge(project) + "\n            </div>\n          \n            <h4 class=\"font-semibold text-gray-900 text-md mb-1\"" + (tenCuTheoThang ? " title=\"Tên gốc: " + escapeHtmlAttr(tenCuTheoThang) + "\"" : "") + ">" + escapeHtml(tenTheoThang) + "</h4>\n            <p class=\"text-sm text-gray-600 mb-2\">" + escapeHtml(projectDesc) + "</p>\n          </div>\n        </div>\n        \n        " + (showDetails ? "\n            <div class=\"space-y-2 text-xs text-gray-600\">\n                <div class=\"flex items-center\">\n                    <i class=\"fas fa-calendar-alt w-4 mr-2 text-green-500\"></i>\n                    <span>Bắt đầu: " + escapeHtml(startDateText) + "</span>\n                    \n                    <i class=\"fas fa-calendar-check w-4 mr-2 text-red-500 ml-4\"></i>\n                    <span>Kết thúc: " + escapeHtml(endDateText) + "</span>\n                </div>\n\n                <div class=\"flex items-center justify-between\">\n                  <div class=\"flex items-center\">\n                    <i class=\"fas fa-user-tie w-4 mr-2 text-purple-500\"></i>\n                    <span>Phòng: " + escapeHtml(project[COL.P_DEPT] || "Chưa gán") + "</span>\n                  </div>\n                  <div class=\"flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full\">\n                    <i class=\"fas fa-tasks mr-1\"></i>\n                    <span>" + filteredTasks.length + " nhiệm vụ</span>\n                  </div>\n                </div>\n\n                <div class=\"pt-2 border-t border-gray-100 mt-2\">\n                    <div class=\"flex justify-between mb-1\">\n                        <span class=\"font-medium\">Tiến độ</span>\n                        <span class=\"font-bold text-blue-600\">" + escapeHtml(num) + "%</span>\n                    </div>\n                    <div class=\"w-full bg-gray-200 rounded-full h-1.5\">\n                        <div class=\"bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 rounded-full transition-all duration-500\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                    </div>\n                </div>\n            </div>\n        " : "") + "\n    </div>\n";
}
/**
 * TÊN các phòng tôi phụ trách với vai **Phó Giám đốc** — có thể NHIỀU phòng (`department_managers`
 * cho phép nhiều dòng `deputy_director`). Đây là bản sao đọc-only của `managedDepartmentIds` phía
 * máy chủ: `getDepartmentContext()` đã đổi sang TÊN trong `visibleDepartments`, và với vai này
 * `bootstrap/service.js` chỉ đưa vào đúng các phòng phụ trách chứ không phải toàn cơ quan.
 *
 * Vai khác, hoặc chưa nạp xong ngữ cảnh phòng ⇒ mảng RỖNG: thà hẹp còn hơn tự nới ở trình duyệt.
 */
function dsPhongToiPhuTrach() {
  if (isAdmin() || !laQuanTriTrongPhamVi()) return [];
  return (Array.isArray(visibleDepartments) ? visibleDepartments : []).map(ten => String(ten || "").trim()).filter(Boolean);
}
/**
 * Nhiệm vụ mà người đang đăng nhập được THẤY ở tab «Quản lý Nhiệm vụ».
 *
 * Lỗi 2026-08-28: chỗ này chỉ nhận nhiệm vụ của CHÍNH MÌNH hoặc của công việc mình quản lý, nên
 * Phó Giám đốc — người không được gán nhiệm vụ nào và cũng không đứng tên quản lý công việc — mở
 * tab ra thấy trắng. Nay thêm đúng một nhánh: **phụ trách phòng nào thì thấy hết nhiệm vụ của
 * phòng đó**, cùng luật với `inScope()` của máy chủ (`managedDepartmentIds`).
 *
 * Nhiệm vụ không có cột phòng riêng nên phòng lấy từ CÔNG VIỆC cha (`COL.P_DEPT`, cùng cách với
 * `taskMatchesDeptFilter`). Công việc chung (không phòng) KHÔNG vào: máy chủ cũng không cho.
 */
function dsNhiemVuToiDuocThay() {
  if (isAdmin()) return allTasks;
  const phongPhuTrach = dsPhongToiPhuTrach();
  // Vòng 12c: Trưởng phòng / Phó phòng xem nhiệm vụ của PHÒNG MÌNH (ma trận §6 cho read theo
  // phòng — máy chủ `inScope` đã trả đúng; client lọc theo tên phòng của công việc cha).
  const phongCuaToi = laLanhDaoPhong() ? String(tenPhongTaiKhoan() || '').trim() : '';
  return allTasks.filter(task => {
    if (task[COL.T_ASSIGNEE] === currentUser.name) return true;
    const project = allProjects.find(project2 => project2[COL.P_ID] === task[COL.T_PID]);
    if (!project) return false;
    if (project[COL.P_MANAGER] === currentUser.name) return true;
    const phongCongViec = String(project[COL.P_DEPT] || "").trim();
    if (laLanhDaoPhong() && phongCuaToi !== "" && phongCongViec === phongCuaToi) return true;
    return phongCongViec !== "" && phongPhuTrach.includes(phongCongViec);
  });
}
function renderTasks() {
  const tasksGridEl = document.getElementById("tasks-grid");
  if (!tasksGridEl) return;
  // Nạp lại option cho 4 ô lọc: dữ liệu cán bộ/phòng về sau lúc gắn bộ lắng nghe nên phải bù ở đây.
  dongBoOThangNamTasks(), populateTasksStaffFilter(), populateTasksDeptFilter();
  let list = dsNhiemVuToiDuocThay();
  if (!list || list.length === 0) {
    tasksGridEl.innerHTML = "<div class=\"loading-card\">Chưa có nhiệm vụ nào</div>";
    return;
  }
  const data = {};
  list.forEach(list2 => {
    const taskPid = list2[COL.T_PID];
    !data[taskPid] && (data[taskPid] = []), data[taskPid].push(list2);
  });
  const sorted = Object.keys(data).sort((a, b) => {
    return a.localeCompare(b);
  });
  tasksGridEl.className = "space-y-6";
  let text = "";
  sorted.forEach(sorted2 => {
    const project = allProjects.find(project2 => project2[COL.P_ID] === sorted2),
      projectName = project ? project[COL.P_NAME] : "Công việc " + sorted2,
      xep = xepNhiemVuTheoCongViecCon(data[sorted2], sorted2);
    if (xep.khoi.length === 0) return;
    text += createTasksWorkSeparatorHtml(sorted2, projectName, project, xep.tongSoNhiemVu) + xep.khoi.map(khoi => createTasksSubworkBlockHtml(khoi)).join("");
  }), tasksGridEl.innerHTML = text || "<div class=\"loading-card\">Không có nhiệm vụ nào khớp bộ lọc đã chọn</div>";
}
/**
 * Dải phân cách MỎNG của công việc cấp 1 (2026-08-27): chỉ một dòng tiêu đề, không lặp lại thanh
 * công cụ như trước — mọi nhiệm vụ nằm trong các khối công việc con phía dưới.
 */
function createTasksWorkSeparatorHtml(maCongViec, tenCongViec, project, soNhiemVu) {
  const trangThai = project ? project[COL.P_STATUS] || "" : "",
    nguoiQuanLy = project ? project[COL.P_MANAGER] || "" : "",
    phong = project ? project[COL.P_DEPT] || "" : "",
    // Tên theo tháng đang lọc ở tab Nhiệm vụ; nút «+ Công việc con» phía dưới vẫn nhận TÊN GỐC.
    tenTheoThang = tenTheoThangCuaDong(project, tenCongViec, thangLocNhiemVu()),
    tenCuTheoThang = tenGocNeuDaDoiCuaDong(project, tenCongViec, thangLocNhiemVu());
  return "\n    <div class=\"flex items-center justify-between gap-3 pt-2 pb-1 border-b-2 border-blue-200\">\n      <div class=\"flex items-center gap-2 min-w-0\">\n        <i class=\"fas fa-briefcase text-blue-500\"></i>\n        <span class=\"font-semibold text-gray-900 truncate\"" + (tenCuTheoThang ? " title=\"Tên gốc: " + escapeHtmlAttr(tenCuTheoThang) + "\"" : "") + ">" + escapeHtml(tenTheoThang) + "</span>\n        <span class=\"status-badge " + escapeHtml(getStatusClass(trangThai)) + " text-xs\">" + (escapeHtml(trangThai) || "Chưa bắt đầu") + "</span>" + pendingApprovalBadge(project) + nhapBadge(project) + buildXinXoaBadge(project) + "\n      </div>\n      <div class=\"flex items-center gap-3 text-xs text-gray-500 shrink-0\">\n        <span>" + (escapeHtml(nguoiQuanLy) || "Chưa gán") + (phong ? " • " + escapeHtml(phong) : "") + "</span>\n        <span class=\"bg-white px-2 py-1 rounded-full\">" + escapeHtml(soNhiemVu) + " nhiệm vụ</span>\n        " + createSubworkFromWorkButtonHtml(maCongViec, tenCongViec, "bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 text-sm rounded-lg transition-colors duration-200", true) + "\n      </div>\n    </div>\n  ";
}
/**
 * Xếp các dòng của MỘT công việc cấp 1 thành khối theo CÔNG VIỆC CON (cấp 2).
 *
 * Vỏ cấp 2 lấy từ `allTasks` (cây đầy đủ) để nhiệm vụ vẫn về đúng khối kể cả khi bản thân dòng cấp 2
 * không nằm trong danh sách người dùng thấy; nhiệm vụ cấp 3 thì lấy từ `rows` rồi qua bộ lọc.
 * Nhiệm vụ không có cha (hoặc cha lạ) dồn vào khối «Nhiệm vụ trực thuộc công việc» đặt sau cùng.
 */
function xepNhiemVuTheoCongViecCon(rows, maCongViec) {
  const congViecCon = allTasks.filter(row => row[COL.T_PID] === maCongViec && Number(row[COL.T_LEVEL]) === 2),
    nhiemVu = rows.filter(row => Number(row[COL.T_LEVEL]) !== 2 && taskMatchesTasksFilters(row)),
    theoCha = {};
  nhiemVu.forEach(row => {
    const maCha = row[COL.T_PARENT] || "";
    (theoCha[maCha] = theoCha[maCha] || []).push(row);
  });
  const khoi = [];
  congViecCon.slice().sort((a, b) => String(a[COL.T_ID] || "").localeCompare(String(b[COL.T_ID] || ""))).forEach(con => {
    const maCon = con[COL.T_ID] || "",
      ds = theoCha[maCon] || [];
    delete theoCha[maCon];
    if (ds.length > 0) khoi.push({
      khoa: maCon,
      ma: maCon,
      ten: con[COL.T_NAME] || "",
      // Dòng cấp 2 đi kèm để đầu khối đổi được tên theo tháng (bản đồ `monthNames` nằm trên dòng).
      dong: con,
      maCongViec: maCongViec,
      tenCongViec: "",
      nhiemVu: ds,
      truc: false
    });
  });
  let treo = [];
  Object.keys(theoCha).forEach(key => {
    treo = treo.concat(theoCha[key]);
  });
  if (treo.length > 0) khoi.push({
    khoa: "truc:" + maCongViec,
    ma: maCongViec,
    ten: "Nhiệm vụ trực thuộc công việc",
    dong: null,
    maCongViec: maCongViec,
    tenCongViec: "",
    nhiemVu: treo,
    truc: true
  });
  let tongSoNhiemVu = 0;
  khoi.forEach(item => {
    tongSoNhiemVu += item.nhiemVu.length;
  });
  return {
    khoi: khoi,
    tongSoNhiemVu: tongSoNhiemVu
  };
}
/**
 * Trạng thái + tiến độ tổng hợp của một khối — ĐÚNG luật `ganCayCon` phía máy chủ
 * (tiến độ = % nhiệm vụ hoàn thành). Tính trên các nhiệm vụ ĐANG HIỆN nên số nhiệm vụ,
 * tiến độ và trạng thái ở đầu khối luôn khớp với bảng bên dưới.
 */
function tinhTongHopNhiemVu(rows) {
  const tong = rows.length,
    xong = rows.filter(row => String(row[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
    tre = rows.some(row => isTaskOverdue(row[COL.T_DUE]) && !String(row[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")),
    hoanThanh = tong > 0 && xong === tong;
  return {
    tong: tong,
    xong: xong,
    tienDo: tong > 0 ? Math.round(xong / tong * 100) : 0,
    trangThai: hoanThanh ? "Hoàn thành" : tre ? "Trễ hạn" : "Đang thực hiện",
    lop: hoanThanh ? "status-completed" : tre ? "status-overdue" : "status-active"
  };
}
/** Một khối = đầu khối (mũi tên thu gọn + thư mục đỏ + mã + đếm + tổng hợp) và bảng nhiệm vụ. */
function createTasksSubworkBlockHtml(khoi) {
  const tongHop = tinhTongHopNhiemVu(khoi.nhiemVu),
    thuGon = tasksThuGon.has(khoi.khoa),
    // Khối «Nhiệm vụ trực thuộc công việc» là nhãn cố định, không phải một đầu việc ⇒ không đổi tên.
    tenThangKhoi = khoi.truc ? khoi.ten : tenTheoThangCuaDong(khoi.dong, khoi.ten, thangLocNhiemVu()),
    tenCuKhoi = khoi.truc ? "" : tenGocNeuDaDoiCuaDong(khoi.dong, khoi.ten, thangLocNhiemVu()),
    tieuDe = tenThangKhoi;
  return "\n    <div class=\"glass-card\">\n      <div class=\"bg-gradient-to-r from-blue-50 to-purple-50 px-2 py-2 border-b border-gray-100\">\n        <div class=\"flex items-center justify-between gap-3\">\n          <h4 class=\"text-base font-semibold text-gray-900 flex items-center min-w-0\">\n            <button type=\"button\" class=\"tasks-subwork-toggle mr-2 w-6 h-6 rounded hover:bg-gray-200 text-gray-500 flex items-center justify-center shrink-0\" data-khoi=\"" + escapeHtmlAttr(khoi.khoa) + "\" title=\"Thu gọn/Mở rộng\" aria-expanded=\"" + (thuGon ? "false" : "true") + "\"><i class=\"fas fa-chevron-" + (thuGon ? "right" : "down") + "\"></i></button>\n            <i class=\"fas fa-folder" + (thuGon ? "" : "-open") + " text-red-500 mr-2 shrink-0\"></i>\n            <span class=\"truncate\"" + (tenCuKhoi ? " title=\"Tên gốc: " + escapeHtmlAttr(tenCuKhoi) + "\"" : "") + ">" + escapeHtml(tieuDe) + "</span>\n            <span class=\"status-badge " + escapeHtml(tongHop.lop) + " ml-3 text-xs shrink-0\">" + escapeHtml(tongHop.trangThai) + "</span>\n          </h4>\n          <div class=\"flex items-center gap-3 shrink-0\">\n            <span class=\"text-sm text-gray-600 bg-white px-3 py-1 rounded-full\">" + escapeHtml(tongHop.tong) + " nhiệm vụ</span>\n            <div class=\"flex items-center gap-2\">\n              <div class=\"w-24 h-2 bg-gray-200 rounded-full\">\n                <div class=\"h-full bg-blue-500 rounded-full\" style=\"width: " + escapeHtml(tongHop.tienDo) + "%\"></div>\n              </div>\n              <span class=\"text-xs text-gray-600 w-10 text-right\">" + escapeHtml(tongHop.tienDo) + "%</span>\n            </div>\n            <button class=\"bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 text-sm rounded-lg transition-colors duration-200 add-task-from-project-btn\" data-project-id=\"" + escapeHtmlAttr(khoi.maCongViec) + "\" data-project-name=\"" + escapeHtmlAttr(khoi.ten) + "\" title=\"Thêm nhiệm vụ\">\n              + Thêm\n            </button>\n          </div>\n        </div>\n      </div>\n      <div class=\"overflow-x-auto tasks-table-wrap " + (thuGon ? "hidden" : "") + "\">\n        <table class=\"min-w-full table-auto\">\n          <thead class=\"bg-gray-50\">\n            <tr>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Nhiệm vụ</th>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Người thực hiện</th>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Trạng thái</th>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Ưu tiên</th>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Tiến độ</th>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Link kết quả</th>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Ngày bắt đầu</th>\n              <th class=\"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase\">Hạn chót</th>\n              <th class=\"px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase\">Thao tác</th>\n            </tr>\n          </thead>\n          <tbody class=\"bg-white divide-y divide-gray-200\">\n            " + khoi.nhiemVu.map(nhiemVu => createTaskTableRowSimple(nhiemVu)).join("") + "\n          </tbody>\n        </table>\n      </div>\n    </div>\n  ";
}
/** ======================================================================
 * TAB NHIỆM VỤ (2026-08-27): lọc theo THÁNG/NĂM + CÁN BỘ + PHÒNG; mỗi công việc con là
 * một khối thu gọn được, trạng thái thu gọn có khoá RIÊNG, không dùng chung với Gantt.
 * ==================================================================== */
const TASKS_THU_GON_KEY = "qlcv_tasks_collapsed";
let tasksThuGon = docTrangThaiThuGonTasks();
function docTrangThaiThuGonTasks() {
  try {
    const raw = localStorage.getItem(TASKS_THU_GON_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (err) {
    return new Set();
  }
}
function luuTrangThaiThuGonTasks() {
  try {
    localStorage.setItem(TASKS_THU_GON_KEY, JSON.stringify([...tasksThuGon]));
  } catch (err) {
    /* chế độ riêng tư chặn localStorage — thu gọn vẫn hoạt động, chỉ không nhớ */
  }
}
function doiTrangThaiThuGonTasks(khoa) {
  if (!khoa) return;
  tasksThuGon.has(khoa) ? tasksThuGon.delete(khoa) : tasksThuGon.add(khoa);
  luuTrangThaiThuGonTasks(), renderTasks();
}
function taskMatchesStaffFilter(task) {
  return !tasksLocCanBo || String(task[COL.T_ASSIGNEE] || "") === tasksLocCanBo;
}
/** Nhiệm vụ mang phòng của CÔNG VIỆC cha — không có cột phòng riêng cho nhiệm vụ. */
function taskMatchesDeptFilter(task) {
  if (!tasksLocPhong) return true;
  const congViec = allProjects.find(item => item[COL.P_ID] === task[COL.T_PID]);
  return !!congViec && String(congViec[COL.P_DEPT] || "") === tasksLocPhong;
}
function taskMatchesTasksFilters(task) {
  return taskMatchesDateFilter(task) && taskMatchesStaffFilter(task) && taskMatchesDeptFilter(task);
}
/** Ô Tháng/Năm + Cán bộ + Phòng của tab Nhiệm vụ — nối MỘT lần (mốc dataset.daNoi như Gantt). */
function setupTasksFilterControls() {
  dongBoOThangNamTasks(), populateTasksStaffFilter(), populateTasksDeptFilter();
  const oThang = document.getElementById("tasks-month-select"),
    oNam = document.getElementById("tasks-year-select"),
    oCanBo = document.getElementById("tasks-staff-filter"),
    oPhong = document.getElementById("tasks-dept-filter");
  oThang && !oThang.dataset.daNoi && ((oThang.dataset.daNoi = "1"), oThang.addEventListener("change", handleTasksMonthChange));
  oNam && !oNam.dataset.daNoi && ((oNam.dataset.daNoi = "1"), oNam.addEventListener("change", handleTasksYearChange));
  oCanBo && !oCanBo.dataset.daNoi && ((oCanBo.dataset.daNoi = "1"), oCanBo.addEventListener("change", handleTasksStaffFilter));
  oPhong && !oPhong.dataset.daNoi && ((oPhong.dataset.daNoi = "1"), oPhong.addEventListener("change", handleTasksDeptFilter));
}
function dongBoOThangNamTasks() {
  const oThang = document.getElementById("tasks-month-select"),
    oNam = document.getElementById("tasks-year-select");
  if (!oThang || !oNam) return;
  if (oThang.options.length === 0) {
    // Vòng 12e: thêm «Tất cả tháng» (value 0) như tab Công việc — trước đây ô này chỉ có 12 tháng
    // nên mở tab ra đúng tháng không có nhiệm vụ là tưởng «không thấy tháng nào». MẶC ĐỊNH vẫn là
    // tháng hiện tại; luật lọc không đổi (taskMatchesDateFilter tự bỏ lọc khi tháng ngoài 1..12).
    const opTatCa = document.createElement("option");
    opTatCa.value = "0", opTatCa.textContent = "Tất cả tháng", oThang.appendChild(opTatCa);
    for (let i = 1; i <= 12; i++) {
      const op = document.createElement("option");
      op.value = String(i), op.textContent = "Tháng " + i, oThang.appendChild(op);
    }
  }
  const namHienTai = new Date().getFullYear(),
    cacNam = [];
  for (let y = namHienTai - 2; y <= namHienTai + 3; y++) cacNam.push(y);
  if (cacNam.indexOf(tasksXemNam) < 0) cacNam.push(tasksXemNam);
  cacNam.sort((a, b) => a - b);
  if (oNam.options.length !== cacNam.length) {
    oNam.innerHTML = "";
    cacNam.forEach(y => {
      const op = document.createElement("option");
      op.value = String(y), op.textContent = "Năm " + y, oNam.appendChild(op);
    });
  }
  oThang.value = String(tasksXemThang), oNam.value = String(tasksXemNam);
}
function populateTasksStaffFilter() {
  const el = document.getElementById("tasks-staff-filter");
  if (!el || el.options.length > 1) return;
  allStaff.filter(staff => staff[COL.S_OBJECT_TYPE] !== "Nhà cung cấp").forEach(staff => {
    const op = document.createElement("option");
    op.value = staff[COL.S_NAME], op.textContent = staff[COL.S_NAME], el.appendChild(op);
  });
}
function populateTasksDeptFilter() {
  const el = document.getElementById("tasks-dept-filter");
  if (!el || el.options.length > 1) return;
  const list = isAdmin() ? departmentNames : visibleDepartments.length > 0 ? visibleDepartments : departmentNames;
  (list || []).forEach(ten => {
    const op = document.createElement("option");
    op.value = ten, op.textContent = ten, el.appendChild(op);
  });
}
function handleTasksMonthChange(event) {
  const so = parseInt(event.target.value, 10);
  // 0 = «Tất cả tháng» (Vòng 12e) — cùng ngưỡng với handleProjectsMonthChange.
  if (!(so >= 0 && so <= 12)) return;
  tasksXemThang = so, renderTasks(), renderTaskStats();
}
function handleTasksYearChange(event) {
  const so = parseInt(event.target.value, 10);
  if (!(so >= 1900 && so <= 2200)) return;
  tasksXemNam = so, renderTasks(), renderTaskStats();
}
function handleTasksStaffFilter(event) {
  tasksLocCanBo = event.target.value || "", renderTasks(), renderTaskStats();
}
function handleTasksDeptFilter(event) {
  tasksLocPhong = event.target.value || "", renderTasks(), renderTaskStats();
}
function createTaskTableRowSimple(task) {
  const taskId = task[COL.T_ID] || "N/A",
    taskName = task[COL.T_NAME] || "Chưa có tên",
    // Tên theo tháng đang lọc; data-name của các nút Xoá/Nhân bản/hoàn thành vẫn là TÊN GỐC.
    tenTheoThang = tenTheoThangCuaDong(task, taskName, thangLocNhiemVu()),
    tenCuTheoThang = tenGocNeuDaDoiCuaDong(task, taskName, thangLocNhiemVu()),
    taskAssignee = task[COL.T_ASSIGNEE] || "Chưa gán",
    taskStatus = task[COL.T_STATUS] || "Chưa bắt đầu",
    taskPriority = task[COL.T_PRIORITY] || "Trung bình",
    startDateText = formatDateForDisplay(task[COL.T_START]),
    dueDateText = formatDateForDisplay(task[COL.T_DUE]),
    num = parseInt(task[COL.T_COMPLETION] || 0),
    taskPid = task[COL.T_PID],
    statusClass = getStatusClass(taskStatus),
    priorityClass = getPriorityClass(taskPriority),
    isTaskOverdue2 = isTaskOverdue(task[COL.T_DUE]) && !taskStatus.toLowerCase().includes("hoàn thành"),
    hasMatch = taskStatus.toLowerCase().includes("hoàn thành"),
    taskReminders = task[COL.T_REMINDERS] || [],
    isArray = Array.isArray(taskReminders) && taskReminders.length > 0;
  return "\n<tr class=\"hover:bg-gray-50 " + (isTaskOverdue2 ? "bg-red-overdue" : "") + " task-clickable cursor-pointer draggable-item\" \n    data-id=\"" + escapeHtml(taskId) + "\" \n    data-project-id=\"" + escapeHtml(taskPid) + "\" \n    draggable=\"true\">\n  <td class=\"px-4 py-4\">\n    <div class=\"flex items-start\">\n        <input type=\"checkbox\" \n                class=\"quick-complete-checkbox\" \n                data-id=\"" + escapeHtml(taskId) + "\" \n                data-name=\"" + escapeHtml(taskName) + "\"\n                " + (hasMatch ? "checked disabled" : "") + " \n                title=\"" + (hasMatch ? "Đã hoàn thành" : "Click để hoàn thành") + "\">\n        <div>\n            <div class=\"font-medium text-gray-900 text-sm leading-tight\">" + (isArray ? "<i class=\"fas fa-bell text-amber-500 mr-1\" title=\"Có nhắc việc\"></i>" : "") + "<span" + (tenCuTheoThang ? " title=\"Tên gốc: " + escapeHtmlAttr(tenCuTheoThang) + "\"" : "") + ">" + escapeHtml(tenTheoThang) + "</span>" + (Number(task[COL.T_LEVEL]) === 2 ? "<span class=\"ml-2 text-[10px] uppercase tracking-wide text-indigo-600\">công việc con</span>" : "") + "</div>" + "\n        </div>\n    </div>\n  </td>\n  <td class=\"px-4 py-4 text-sm text-gray-900\">" + escapeHtml(taskAssignee) + "</td>\n  <td class=\"px-4 py-4\">\n    <span class=\"status-badge " + escapeHtml(statusClass) + "\">" + escapeHtml(taskStatus) + "</span>\n    " + (isTaskOverdue2 ? "<span class=\"status-badge status-overdue ml-1\">Quá hạn</span>" : "") + pendingApprovalBadge(task) + "\n  </td>\n  <td class=\"px-4 py-4\">\n    <span class=\"status-badge " + escapeHtml(priorityClass) + "\">" + escapeHtml(taskPriority) + "</span>\n  </td>\n  <td class=\"px-4 py-4\">\n    <div class=\"flex items-center space-x-2\">\n      <div class=\"w-16 h-2 bg-gray-200 rounded-full\">\n        <div class=\"h-full bg-blue-500 rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n      </div>\n      <span class=\"text-sm text-gray-600\">" + escapeHtml(num) + "%</span>\n    </div>\n  </td>\n  <td class=\"px-4 py-4\">\n    <div class=\"text-sm\">\n      " + renderLinksButton(task[COL.T_RESULT_LINKS], taskId) + "\n    </div>\n  </td>\n  <td class=\"px-4 py-4 text-sm text-gray-900\">" + escapeHtml(startDateText) + "</td>\n  <td class=\"px-4 py-4 text-sm text-gray-900\">" + escapeHtml(dueDateText) + "</td>\n  <td class=\"px-4 py-4 text-right\">\n    <div class=\"flex space-x-1 justify-end\">\n      " + (() => {
    const project = allProjects.find(project3 => project3[COL.P_ID] === task[COL.T_PID]),
      project2 = project && project[COL.P_MANAGER] === currentUser.name,
      isAdmin2 = laQuanTriTrongPhamVi() || project2;
    return "\n          " + createTaskFromSubworkButtonHtml(task, "action-btn action-btn-edit") + "\n          " + (isAdmin2 ? "<button class=\"action-btn action-btn-copy copy-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Tạo bản sao\"><i class=\"fas fa-copy\"></i></button>" : "") + "\n          <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" title=\"Chỉnh sửa\"><i class=\"fas fa-edit\"></i></button>\n          " + (isAdmin2 ? "<button class=\"action-btn action-btn-delete delete-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Xóa\"><i class=\"fas fa-trash\"></i></button>" : "") + "\n        ";
  })() + "\n    </div>\n  </td>\n</tr>\n";
}
function renderStaff() {
  const staffUsersTbodyEl = document.getElementById("staff-users-tbody"),
    staffSuppliersTbodyEl = document.getElementById("staff-suppliers-tbody"),
    staffUserCountEl = document.getElementById("staff-user-count"),
    staffSupplierCountEl = document.getElementById("staff-supplier-count");
  if (!staffUsersTbodyEl || !staffSuppliersTbodyEl) return;
  if (!allStaff || allStaff.length === 0) {
    staffUsersTbodyEl.innerHTML = "<tr><td colspan=\"5\" class=\"px-3 py-4 text-center text-gray-500\">Chưa có người dùng</td></tr>", staffSuppliersTbodyEl.innerHTML = "<tr><td colspan=\"3\" class=\"px-3 py-4 text-center text-gray-500\">Chưa có Nhà cung cấp</td></tr>";
    if (staffUserCountEl) staffUserCountEl.textContent = "(0)";
    if (staffSupplierCountEl) staffSupplierCountEl.textContent = "(0)";
    return;
  }
  // "Người dùng" = mọi người TRỪ Nhà cung cấp. Dữ liệu seed/bản cũ đặt object_type là 'Nội bộ',
  // dữ liệu nhập tay có thể là 'Người dùng' — lọc theo phép trừ để không bỏ sót nhóm nào.
  const filteredStaff = allStaff.filter(staff => (staff[COL.S_OBJECT_TYPE] || "Nội bộ") !== "Nhà cung cấp"),
    filteredStaff2 = allStaff.filter(staff => staff[COL.S_OBJECT_TYPE] === "Nhà cung cấp");
  if (staffUserCountEl) staffUserCountEl.textContent = "(" + filteredStaff.length + ")";
  if (staffSupplierCountEl) staffSupplierCountEl.textContent = "(" + filteredStaff2.length + ")";
  filteredStaff.length === 0 ? staffUsersTbodyEl.innerHTML = "<tr><td colspan=\"5\" class=\"px-3 py-4 text-center text-gray-500\">Chưa có người dùng</td></tr>" : staffUsersTbodyEl.innerHTML = filteredStaff.map(filteredStaff3 => createStaffTableRow(filteredStaff3, "user")).join(""), filteredStaff2.length === 0 ? staffSuppliersTbodyEl.innerHTML = "<tr><td colspan=\"3\" class=\"px-3 py-4 text-center text-gray-500\">Chưa có Nhà cung cấp</td></tr>" : staffSuppliersTbodyEl.innerHTML = filteredStaff2.map(filteredStaff22 => createStaffTableRow(filteredStaff22, "supplier")).join("");
}
/** Vai hiển thị: CSDL gọi 'Nhân viên' nhưng giao diện nói 'Cán bộ' (yêu cầu 2026-08-26). */
function hienThiVai(role) {
  return role === "Nhân viên" ? "Cán bộ" : role || "";
}
function createStaffTableRow(staff, staffType) {
  const staffId = staff[COL.S_ID] || "N/A",
    staffName = staff[COL.S_NAME] || "Chưa có tên";
  if (staffType === "supplier") {
    const staffNotes = staff[COL.S_NOTES] || "";
    return "\n            <tr class=\"hover:bg-gray-50 transition-colors\">\n                <td class=\"px-3 py-2 font-medium text-gray-900\">" + escapeHtml(staffName) + "</td>\n                <td class=\"px-3 py-2 text-gray-600\">" + escapeHtml(staffNotes) + "</td>\n                <td class=\"px-3 py-2 text-center\">\n                    <div class=\"flex justify-center gap-1\">\n                        <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"staff\" data-id=\"" + escapeHtml(staffId) + "\" title=\"Chỉnh sửa\">\n                            <i class=\"fas fa-edit text-xs\"></i>\n                        </button>\n                        <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"staff\" data-id=\"" + escapeHtml(staffId) + "\" data-name=\"" + escapeHtml(staffName) + "\" title=\"Xóa\">\n                            <i class=\"fas fa-trash text-xs\"></i>\n                        </button>\n                    </div>\n                </td>\n            </tr>";
  }
  const staffEmail = staff[COL.S_EMAIL] || "",
    staffPos = staff[COL.S_POS] || "",
    staffRole = staff[COL.S_ROLE] || "Nhân viên",
    staffDept = staff[COL.S_DEPT] || "",
    staffDeptRole = staff[COL.S_DEPT_ROLE] || "";
  let text = "bg-gray-100 text-gray-700";
  const lowerRole = staffRole.toLowerCase();
  if (lowerRole.includes("admin")) text = "bg-red-100 text-red-700";else lowerRole.includes("phó giám đốc") ? text = "bg-purple-100 text-purple-700" : lowerRole.includes("quản lý") && (text = "bg-blue-100 text-blue-700");
  const deptCell = staffDept ? staffDept + (staffDeptRole && staffDeptRole !== "Nhân viên" ? " <span class=\"text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700\">" + escapeHtml(staffDeptRole) + "</span>" : "") : "<span class=\"text-gray-400\">—</span>";
  const text2 = "<span class=\"text-xs px-2 py-1 rounded-full " + escapeHtml(text) + "\">" + escapeHtml(hienThiVai(staffRole)) + "</span>";
  return "\n        <tr class=\"hover:bg-gray-50 transition-colors\">\n            <td class=\"px-3 py-2 font-medium text-gray-900\">" + escapeHtml(staffName) + "</td>\n            <td class=\"px-3 py-2 text-gray-600\">" + escapeHtml(staffPos) + "</td>\n            <td class=\"px-3 py-2 text-gray-600\">" + deptCell + "</td>\n            <td class=\"px-3 py-2\">" + text2 + "</td>\n            <td class=\"px-3 py-2 text-center\">\n                <div class=\"flex justify-center gap-1\">\n                    <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"staff\" data-id=\"" + escapeHtml(staffId) + "\" title=\"Chỉnh sửa\">\n                        <i class=\"fas fa-edit text-xs\"></i>\n                    </button>\n                    <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"staff\" data-id=\"" + escapeHtml(staffId) + "\" data-name=\"" + escapeHtml(staffName) + "\" title=\"Xóa\">\n                        <i class=\"fas fa-trash text-xs\"></i>\n                    </button>\n                </div>\n            </td>\n        </tr>";
}
function createStaffCard(staff) {
  const staffId = staff[COL.S_ID] || "N/A",
    staffName = staff[COL.S_NAME] || "Chưa có tên",
    staffEmail = staff[COL.S_EMAIL] || "",
    staffPos = staff[COL.S_POS] || "Chưa có chức vụ",
    staffRole = staff[COL.S_ROLE] || "Nhân viên",
    slice = staffName.split(" ").map(item => item[0]).join("").toUpperCase().slice(0, 2);
  let text = "user-role-user";
  if (staffRole.toLowerCase().includes("admin")) text = "user-role-admin";else staffRole.toLowerCase().includes("quản lý") && (text = "user-role-manager");
  return "\n  <div class=\"staff-card\" data-id=\"" + escapeHtml(staffId) + "\">\n      <div class=\"staff-avatar\">\n          " + escapeHtml(slice) + "\n      </div>\n      <h4 class=\"font-semibold text-gray-900 mb-1\">" + escapeHtml(staffName) + "</h4>\n      <p class=\"text-sm text-gray-600 mb-1\">" + escapeHtml(staffPos) + "</p>\n      <p class=\"text-xs text-gray-500 mb-2\">" + escapeHtml(staffEmail) + "</p>\n      <div class=\"flex justify-center mb-4\">\n          <span class=\"user-role-badge " + escapeHtml(text) + "\">" + escapeHtml(hienThiVai(staffRole)) + "</span>\n      </div>\n      <div class=\"flex justify-center space-x-2\">\n          <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"staff\" data-id=\"" + escapeHtml(staffId) + "\" title=\"Chỉnh sửa\">\n              <i class=\"fas fa-edit\"></i>\n          </button>\n          <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"staff\" data-id=\"" + escapeHtml(staffId) + "\" data-name=\"" + escapeHtml(staffName) + "\" title=\"Xóa\">\n              <i class=\"fas fa-trash\"></i>\n          </button>\n      </div>\n  </div>\n";
}
function renderChart(err) {
  const statusChartEl = document.getElementById("status-chart"),
    chartMessageEl = document.getElementById("chart-message");
  if (!statusChartEl) return;
  chartInstance && chartInstance.destroy();
  if (!err) {
    const filteredTasks = getFilteredTasks();
    if (!filteredTasks || filteredTasks.length === 0) {
      chartMessageEl.textContent = "Không có dữ liệu biểu đồ", chartMessageEl.classList.remove("hidden");
      return;
    }
    const data = {};
    filteredTasks.forEach(filteredTask => {
      const taskStatus = filteredTask[COL.T_STATUS] || "Chưa xác định";
      data[taskStatus] = (data[taskStatus] || 0) + 1;
    }), err = {
      labels: Object.keys(data),
      data: Object.values(data)
    };
  }
  if (!err || !err.labels || err.labels.length === 0) {
    chartMessageEl.textContent = err?.message || "Không có dữ liệu biểu đồ", chartMessageEl.classList.remove("hidden");
    return;
  }
  chartMessageEl.classList.add("hidden");
  const values = ["rgba(59, 130, 246, 0.8)", "rgba(16, 185, 129, 0.8)", "rgba(245, 158, 11, 0.8)", "rgba(239, 68, 68, 0.8)", "rgba(139, 92, 246, 0.8)"];
  chartInstance = new Chart(statusChartEl, {
    type: "doughnut",
    data: {
      labels: err.labels,
      datasets: [{
        data: err.data,
        backgroundColor: values.slice(0, err.labels.length),
        borderColor: values.slice(0, err.labels.length).map(item => item.replace("0.8", "1")),
        borderWidth: 0x2,
        hoverOffset: 0x8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 0xf,
            usePointStyle: true,
            font: {
              size: 0xa
            }
          }
        }
      },
      animation: {
        duration: 0x3e8,
        easing: "easeOutCubic"
      }
    }
  });
}
function renderProjectProgressChart() {
  const projectProgressChartEl = document.getElementById("project-progress-chart"),
    projectChartMessageEl = document.getElementById("project-chart-message");
  if (!projectProgressChartEl) return;
  projectProgressChart && projectProgressChart.destroy();
  const filteredProjects = getFilteredProjects(),
    filteredTasks = getFilteredTasks();
  if (!filteredProjects || filteredProjects.length === 0) {
    projectChartMessageEl.textContent = "Không có dữ liệu công việc", projectChartMessageEl.classList.remove("hidden");
    return;
  }
  projectChartMessageEl.classList.add("hidden");
  const data = {
    "0-25%": {
      count: 0x0,
      projects: []
    },
    "26-50%": {
      count: 0x0,
      projects: []
    },
    "51-75%": {
      count: 0x0,
      projects: []
    },
    "76-99%": {
      count: 0x0,
      projects: []
    },
    "100%": {
      count: 0x0,
      projects: []
    }
  };
  filteredProjects.forEach(filteredProject => {
    const filteredFilteredTasks = filteredTasks.filter(filteredTask => filteredTask[COL.T_PID] === filteredProject[COL.P_ID]),
      count = filteredFilteredTasks.filter(filteredFilteredTask => (filteredFilteredTask[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
      filteredFilteredTaskCount = filteredFilteredTasks.length,
      num = filteredFilteredTaskCount > 0 ? Math.round(count / filteredFilteredTaskCount * 100) : 0,
      projectName = filteredProject[COL.P_NAME] || "Chưa có tên";
    if (num === 100) data["100%"].count++, data["100%"].projects.push(projectName);else {
      if (num >= 76) data["76-99%"].count++, data["76-99%"].projects.push(projectName);else {
        if (num >= 51) data["51-75%"].count++, data["51-75%"].projects.push(projectName);else num >= 26 ? (data["26-50%"].count++, data["26-50%"].projects.push(projectName)) : (data["0-25%"].count++, data["0-25%"].projects.push(projectName));
      }
    }
  });
  const keys = Object.keys(data),
    mapped = Object.values(data).map(item => item.count),
    values = ["rgba(239, 68, 68, 0.8)", "rgba(245, 158, 11, 0.8)", "rgba(59, 130, 246, 0.8)", "rgba(16, 185, 129, 0.8)", "rgba(34, 197, 94, 0.8)"];
  projectProgressChart = new Chart(projectProgressChartEl, {
    type: "bar",
    data: {
      labels: keys,
      datasets: [{
        label: "Số lượng công việc",
        data: mapped,
        backgroundColor: values,
        borderColor: values.map(value => value.replace("0.8", "1")),
        borderWidth: 0x2,
        borderRadius: 0x8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function (tooltipItems) {
              return "Khoảng tiến độ: " + tooltipItems[0].label;
            },
            label: function (tooltipItem) {
              return "Số lượng: " + tooltipItem.parsed.y + " dự án";
            },
            afterLabel: function (tooltipItem) {
              const label = tooltipItem.label,
                projects = data[label].projects;
              if (projects.length > 0) {
                const num = 5;
                let text = "\nCông việc:";
                return projects.slice(0, num).forEach(item => {
                  text += "\n• " + item;
                }), projects.length > num && (text += "\n... và " + (projects.length - num) + " công việc khác"), text;
              }
              return "";
            }
          },
          titleFont: {
            size: 0xe,
            weight: "bold"
          },
          bodyFont: {
            size: 0xc
          },
          footerFont: {
            size: 0xb
          },
          padding: 0xc,
          cornerRadius: 0x8,
          displayColors: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 0x1,
            callback: function (value) {
              return Math.floor(value);
            }
          },
          title: {
            display: true,
            text: "Số lượng công việc"
          }
        },
        x: {
          title: {
            display: true,
            text: "Khoảng tiến độ"
          }
        }
      },
      animation: {
        duration: 0x3e8,
        easing: "easeOutCubic"
      }
    }
  });
}
function renderStaffPerformanceChart() {
  const staffPerformanceChartEl = document.getElementById("staff-performance-chart"),
    staffChartMessageEl = document.getElementById("staff-chart-message");
  if (!staffPerformanceChartEl) return;
  staffPerformanceChart && staffPerformanceChart.destroy();
  const filteredTasks = getFilteredTasks();
  if (!allStaff || allStaff.length === 0 || !filteredTasks || filteredTasks.length === 0) {
    staffChartMessageEl.textContent = "Không có dữ liệu cán bộ hoặc nhiệm vụ", staffChartMessageEl.classList.remove("hidden");
    return;
  }
  staffChartMessageEl.classList.add("hidden");
  const filtered = allStaff.map(staff => {
    const staffName = staff[COL.S_NAME] || "Không tên",
      filteredFilteredTasks = filteredTasks.filter(filteredTask => filteredTask[COL.T_ASSIGNEE] === staffName),
      filteredFilteredFilteredTasks = filteredFilteredTasks.filter(filteredFilteredTask => (filteredFilteredTask[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")),
      num = filteredFilteredTasks.length > 0 ? Math.round(filteredFilteredFilteredTasks.length / filteredFilteredTasks.length * 100) : 0;
    return {
      name: staffName,
      totalTasks: filteredFilteredTasks.length,
      completedTasks: filteredFilteredFilteredTasks.length,
      completionRate: num
    };
  }).filter(item => item.totalTasks > 0);
  if (filtered.length === 0) {
    staffChartMessageEl.textContent = "Chưa có nhiệm vụ nào được giao", staffChartMessageEl.classList.remove("hidden");
    return;
  }
  staffPerformanceChart = new Chart(staffPerformanceChartEl, {
    type: "bar",
    data: {
      labels: filtered.map(filtered2 => filtered2.name),
      datasets: [{
        label: "Tổng số nhiệm vụ",
        data: filtered.map(filtered2 => filtered2.totalTasks),
        backgroundColor: "rgba(16, 185, 129, 0.6)",
        borderColor: "rgba(16, 185, 129, 1)",
        borderWidth: 0x2,
        borderRadius: 0x6,
        yAxisID: "y"
      }, {
        label: "Tỷ lệ hoàn thành (%)",
        data: filtered.map(filtered2 => filtered2.completionRate),
        type: "line",
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        borderColor: "rgba(99, 102, 241, 1)",
        borderWidth: 0x3,
        pointBackgroundColor: "rgba(99, 102, 241, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 0x2,
        pointRadius: 0x5,
        pointHoverRadius: 0x7,
        yAxisID: "y1",
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            font: {
              size: 0xb
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              const filtered2 = filtered[tooltipItem.dataIndex];
              return tooltipItem.dataset.label === "Tổng số nhiệm vụ" ? tooltipItem.dataset.label + ": " + tooltipItem.parsed.y : tooltipItem.dataset.label + ": " + tooltipItem.parsed.y + "%";
            },
            afterLabel: function (tooltipItem) {
              if (tooltipItem.datasetIndex === 0) {
                const filtered2 = filtered[tooltipItem.dataIndex];
                return "Hoàn thành: " + filtered2.completedTasks + "/" + filtered2.totalTasks;
              }
              return "";
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0x2d,
            minRotation: 0x0,
            font: {
              size: 0xa
            }
          }
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Số lượng nhiệm vụ"
          },
          beginAtZero: true
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: {
            display: true,
            text: "Tỷ lệ (%)"
          },
          beginAtZero: true,
          max: 0x64,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: function (value) {
              return value + "%";
            }
          }
        }
      },
      animation: {
        duration: 0x3e8,
        easing: "easeOutCubic"
      }
    }
  });
}
/** BUILDER — một dòng «Hoạt động gần đây» ở trang Tổng quan: nhãn tiếng Việt + icon theo hành
 * động (bản đồ NHAT_KY_HANH_DONG dùng chung với tab Nhật ký), mô tả ngắn, người + giờ. Mô tả
 * rỗng thì bỏ hẳn dòng phụ (hết "{}"). Hành động lạ vẫn hiện nguyên tên, không bỏ dòng. */
function createHoatDongItemHtml(dong) {
  const hanhDong = nhanHanhDongNhatKy(dong[COL.A_ACTION]),
    chiTiet = String(dong[COL.A_DETAILS] || "");
  return "<div class=\"activity-item\">\n" +
    "    <div class=\"flex items-start space-x-3\">\n" +
    "        <div class=\"w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0\">\n" +
    "            <i class=\"fas " + escapeHtmlAttr(hanhDong.icon) + " " + escapeHtmlAttr(hanhDong.mau) + " text-xs\"></i>\n" +
    "        </div>\n" +
    "        <div class=\"flex-1 min-w-0\">\n" +
    "            <p class=\"text-sm font-medium text-gray-900\">" + escapeHtml(hanhDong.nhan) + "</p>\n" +
    (chiTiet
      ? "            <p class=\"text-xs text-gray-600 mt-1 break-words\">" + escapeHtml(chiTiet) + "</p>\n"
      : "") +
    "            <p class=\"text-xs text-gray-500 mt-1\">\n" +
    "                " + escapeHtml(dong[COL.A_USER] || "Ai đó") + " • " + escapeHtml(formatDateForDisplay(dong[COL.A_TIME], true)) + "\n" +
    "            </p>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>";
}
function renderActivity(activities) {
  const recentActivityEl = document.getElementById("recent-activity");
  if (!recentActivityEl) return;
  if (!activities || activities.length === 0) {
    recentActivityEl.innerHTML = "<div class=\"loading-card\">Không có hoạt động nào</div>";
    return;
  }
  recentActivityEl.innerHTML = activities.slice(0, 22).map(createHoatDongItemHtml).join("");
}
function openTaskModalForProject(projectId, projectName, opts) {
  pendingTaskCreate = {
    level: opts && Number(opts.level) === 2 ? 2 : 3,
    parentId: opts && opts.parentId ? String(opts.parentId) : "",
    projectId: String(projectId || ""),
    projectName: String(projectName || "")
  };
  openModal("task"), setTimeout(() => {
    const el = document.querySelector("select[name=\"projectId\"]");
    el && (el.value = projectId, el.dispatchEvent(new Event("change")));
  }, 100);
}
function openModal(type, data = null) {
  const flag = data !== null,
    text = type + "-modal",
    el = document.getElementById(text);
  el && el.remove();
  let text2 = "";
  if (type === "project") text2 = createProjectModal(flag, data);else {
    if (type === "task") text2 = createTaskModal(flag, data);else {
      if (type === "staff") text2 = createStaffModal(flag, data);else {
        if (type === "notification") text2 = createNotificationModal(flag, data);else {
          if (type === "proposal") text2 = createProposalModal(flag, data);else type === "app" && (text2 = createAppModal(flag, data));
        }
      }
    }
  }
  const el2 = document.createElement("div");
  el2.innerHTML = text2;
  const firstElementChild = el2.firstElementChild,
    el3 = document.body.querySelector("#" + text);
  if (el3) el3.remove();
  document.body.appendChild(firstElementChild);
  const el4 = document.getElementById(text);
  el4.classList.add("active");
  const el5 = el4.querySelector("form");
  if (el5) {
    // «Lưu nháp» (012): đánh dấu ngay lúc bấm, xoá sau khi xử để lần submit sau không kế thừa.
    el5.querySelectorAll("button[data-nhap]").forEach((nut) => {
      nut.addEventListener("click", () => {
        el5.dataset.luuNhap = "1";
      });
    });
    el5.addEventListener("submit", function (event) {
      event.preventDefault();
      const luuNhap = el5.dataset.luuNhap === "1";
      delete el5.dataset.luuNhap;
      flag ? handleEdit(type, data) : handleAdd(type, { luuNhap });
    });
  }
  const closeButtons = el4.querySelectorAll(".close-modal");
  closeButtons.forEach(closeButton => {
    closeButton.addEventListener("click", event => {
      event.preventDefault(), closeModal(text);
    });
  });
}
function openEditModal(type, id) {
  let project = null;
  if (type === "project") project = allProjects.find(project2 => project2[COL.P_ID] === id);else {
    if (type === "task") project = allTasks.find(task => task[COL.T_ID] === id);else {
      if (type === "staff") project = allStaff.find(staff => staff[COL.S_ID] === id);else {
        if (type === "proposal") project = allProposals.find(proposal => proposal[COL.PR_ID] === id);else type === "app" && (project = allApps.find(app => app[COL.A_ID] === id));
      }
    }
  }
  project ? openModal(type, project) : showToast("Không tìm thấy " + type + " với ID: " + id, "error");
}
function closeModal(modalId) {
  const el = document.getElementById(modalId);
  el && (el.classList.contains("modal-overlay") && el.classList.add("closing"), el.classList.remove("active"), setTimeout(() => {
    el.parentNode && el.remove();
    if (modalId === "task-modal" && openedFromProjectDetails) {
      const {
        projectId: openedFromProjectDetails2,
        projectName: openedFromProjectDetails3
      } = openedFromProjectDetails;
      openedFromProjectDetails = null, showProjectDetailsModal(openedFromProjectDetails2, openedFromProjectDetails3);
    }
  }, 300));
}
/** ======================================================================
 * TÊN THEO THÁNG cho đầu việc dài hơn một tháng (docs/KE-HOACH-TEN-THEO-THANG.md)
 *
 * Máy chủ gửi kèm MỖI dòng một bản đồ `monthNames` = { "YYYY-MM": "tên riêng của tháng đó" } và
 * KHÔNG tự chọn tên thay trình duyệt: một lần gọi `/api/v1/gantt` có thể trải nhiều tháng, chỉ màn
 * hình mới biết đang xem tháng nào. Hai tab Công việc/Nhiệm vụ lại nạp dữ liệu MỘT lần rồi lọc
 * tháng tại chỗ (không gọi lại API), nên bản đồ buộc phải đi theo từng dòng.
 *
 * Tháng ĐẦU không có tên riêng — tên tháng đầu chính là tên gốc ở ô «Tên» của form Sửa.
 * ==================================================================== */
/** `YYYY-MM-DD…` → `YYYY-MM`; chuỗi lạ ⇒ rỗng (không đoán). */
function thangCuaNgay(value) {
  const text = String(value == null ? "" : value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(0, 7) : "";
}
/** Mọi tháng "YYYY-MM" mà đầu việc phủ qua. Thiếu đầu/cuối hoặc cuối < đầu ⇒ rỗng. */
function cacThangCuaDauViec(batDau, ketThuc) {
  const dau = thangCuaNgay(batDau),
    cuoi = thangCuaNgay(ketThuc);
  if (!dau || !cuoi || cuoi < dau) return [];
  const ds = [];
  let nam = Number(dau.slice(0, 4)),
    thang = Number(dau.slice(5, 7));
  // Chặn 240 vòng (20 năm): ngày kết thúc gõ sai kiểu 9999-12-31 không được treo trình duyệt.
  for (let i = 0; i < 240; i++) {
    const khoa = String(nam) + "-" + String(thang).padStart(2, "0");
    ds.push(khoa);
    if (khoa === cuoi) break;
    thang === 12 ? ((nam += 1), (thang = 1)) : (thang += 1);
  }
  return ds;
}
/** Các tháng ĐẶT TÊN RIÊNG ĐƯỢC = mọi tháng TRỪ tháng đầu. Rỗng ⇒ đầu việc không dài hơn 1 tháng. */
function thangSuaDuocCuaDauViec(batDau, ketThuc) {
  return cacThangCuaDauViec(batDau, ketThuc).slice(1);
}
/** Bản đồ tên tháng của một dòng — nhận cả `monthNames` (cầu RPC, Gantt) và `month_names` (REST). */
function banDoTenThangCuaDong(dong) {
  const d = dong || {},
    banDo = d.monthNames || d.month_names;
  return banDo && typeof banDo === "object" ? banDo : {};
}
/** Tên HIỂN THỊ trong tháng đang xem; không có tên riêng (hoặc không xem theo tháng) ⇒ tên gốc. */
function tenTheoThangCuaDong(dong, tenGoc, thang) {
  const goc = String(tenGoc == null ? "" : tenGoc);
  if (!thang) return goc;
  const rieng = banDoTenThangCuaDong(dong)[thang];
  return rieng != null && String(rieng).trim() !== "" ? String(rieng) : goc;
}
/** TÊN CŨ để hiện khi di chuột; rỗng khi tháng này không đổi tên ⇒ chỗ gọi bỏ hẳn dòng đó đi. */
function tenGocNeuDaDoiCuaDong(dong, tenGoc, thang) {
  const goc = String(tenGoc == null ? "" : tenGoc);
  return tenTheoThangCuaDong(dong, goc, thang) === goc ? "" : goc;
}
/** Tháng đang lọc ở tab Nhiệm vụ, dạng "YYYY-MM" — cùng điều kiện với `taskMatchesDateFilter`. */
function thangLocNhiemVu() {
  const thang = Number(tasksXemThang),
    nam = Number(tasksXemNam);
  if (!(thang >= 1 && thang <= 12) || !(nam >= 1900 && nam <= 2200)) return "";
  return String(nam) + "-" + String(thang).padStart(2, "0");
}
/** Tháng đang xem của Sơ đồ Gantt — Gantt LUÔN xem đúng một tháng (`datKhoangGanttTheoThang`). */
function thangLocGantt() {
  const thang = Number(ganttXemThang),
    nam = Number(ganttXemNam);
  if (!(thang >= 1 && thang <= 12) || !(nam >= 1900 && nam <= 2200)) return "";
  return String(nam) + "-" + String(thang).padStart(2, "0");
}
/** "2026-09" → "Tháng 9/2026" cho phần nhãn. */
function nhanThangVN(thang) {
  const text = String(thang == null ? "" : thang);
  return /^\d{4}-\d{2}$/.test(text) ? "Tháng " + Number(text.slice(5, 7)) + "/" + text.slice(0, 4) : text;
}
// ===== Nhật ký từng lần chỉnh sửa — 3 cấp (docs/KE-HOACH-NHAT-KY.md) =====
// Nhãn tiếng Việt cho `action` của bảng activity_logs. Hành động lạ ⇒ hiện nguyên tên hành động,
// KHÔNG bỏ dòng đó đi: nhật ký thiếu dòng thì người đọc không biết là thiếu.
const NHAT_KY_HANH_DONG = {
  "works.create": { nhan: "Lập công việc", icon: "fa-plus-circle", mau: "text-green-600" },
  "works.update": { nhan: "Sửa công việc", icon: "fa-pen", mau: "text-blue-600" },
  "works.copy": { nhan: "Nhân bản công việc", icon: "fa-copy", mau: "text-indigo-600" },
  "works.remove": { nhan: "Xoá công việc", icon: "fa-trash", mau: "text-red-600" },
  "works.reorder": { nhan: "Sắp xếp lại", icon: "fa-arrows-up-down", mau: "text-gray-500" },
  "works.setMonthName": { nhan: "Đặt tên theo tháng", icon: "fa-calendar-day", mau: "text-teal-600" },
  "works.clearMonthName": { nhan: "Bỏ tên theo tháng", icon: "fa-calendar-xmark", mau: "text-gray-500" },
  "subworks.create": { nhan: "Thêm công việc con", icon: "fa-plus-circle", mau: "text-green-600" },
  "subworks.update": { nhan: "Sửa công việc con", icon: "fa-pen", mau: "text-blue-600" },
  "subworks.copy": { nhan: "Nhân bản công việc con", icon: "fa-copy", mau: "text-indigo-600" },
  "tasks.create": { nhan: "Thêm nhiệm vụ", icon: "fa-plus-circle", mau: "text-green-600" },
  "tasks.update": { nhan: "Sửa nhiệm vụ", icon: "fa-pen", mau: "text-blue-600" },
  "tasks.copy": { nhan: "Nhân bản nhiệm vụ", icon: "fa-copy", mau: "text-indigo-600" },
  "workItems.remove": { nhan: "Xoá", icon: "fa-trash", mau: "text-red-600" },
  "workItems.reorder": { nhan: "Sắp xếp lại", icon: "fa-arrows-up-down", mau: "text-gray-500" },
  "workItems.setMonthName": { nhan: "Đặt tên theo tháng", icon: "fa-calendar-day", mau: "text-teal-600" },
  "workItems.clearMonthName": { nhan: "Bỏ tên theo tháng", icon: "fa-calendar-xmark", mau: "text-gray-500" },
  "reminders.create": { nhan: "Thêm nhắc việc", icon: "fa-bell", mau: "text-amber-600" },
  "reminders.update": { nhan: "Sửa nhắc việc", icon: "fa-bell", mau: "text-amber-600" },
  "reminders.remove": { nhan: "Xoá nhắc việc", icon: "fa-bell-slash", mau: "text-red-600" },
  "approvals.submit": { nhan: "Gửi duyệt", icon: "fa-paper-plane", mau: "text-blue-600" },
  "approvals.approve": { nhan: "Đã duyệt", icon: "fa-circle-check", mau: "text-green-600" },
  "approvals.reject": { nhan: "Từ chối duyệt", icon: "fa-circle-xmark", mau: "text-red-600" },
  "auth.login": { nhan: "Đăng nhập", icon: "fa-right-to-bracket", mau: "text-gray-500" },
  "auth.logout": { nhan: "Đăng xuất", icon: "fa-right-from-bracket", mau: "text-gray-400" },
  "users.create": { nhan: "Thêm người dùng", icon: "fa-user-plus", mau: "text-green-600" },
  "users.update": { nhan: "Sửa người dùng", icon: "fa-user-pen", mau: "text-blue-600" },
  "users.remove": { nhan: "Xoá người dùng", icon: "fa-user-minus", mau: "text-red-600" },
  "departments.create": { nhan: "Thêm phòng ban", icon: "fa-sitemap", mau: "text-green-600" },
  "departments.update": { nhan: "Sửa phòng ban", icon: "fa-pen", mau: "text-blue-600" },
  "departments.remove": { nhan: "Xoá phòng ban", icon: "fa-trash", mau: "text-red-600" },
  "delegations.create": { nhan: "Tạo ủy quyền", icon: "fa-user-lock", mau: "text-indigo-600" },
  "delegations.update": { nhan: "Sửa ủy quyền", icon: "fa-pen", mau: "text-blue-600" },
  "delegations.cancel": { nhan: "Hủy ủy quyền", icon: "fa-ban", mau: "text-red-600" },
  "delegations.accept": { nhan: "Nhận ủy quyền", icon: "fa-circle-check", mau: "text-green-600" },
  "delegations.decline": { nhan: "Từ chối ủy quyền", icon: "fa-circle-xmark", mau: "text-red-600" },
  "proposal.create": { nhan: "Gửi đề nghị", icon: "fa-plus-circle", mau: "text-green-600" },
  "proposal.update": { nhan: "Sửa đề nghị", icon: "fa-pen", mau: "text-blue-600" },
  "proposal.remove": { nhan: "Xoá đề nghị", icon: "fa-trash", mau: "text-red-600" },
  "app.create": { nhan: "Thêm App", icon: "fa-plus-circle", mau: "text-green-600" },
  "app.update": { nhan: "Sửa App", icon: "fa-pen", mau: "text-blue-600" },
  "app.remove": { nhan: "Xoá App", icon: "fa-trash", mau: "text-red-600" },
  "notification.create": { nhan: "Gửi thông báo", icon: "fa-bell", mau: "text-amber-600" },
  "chat.send": { nhan: "Nhắn tin", icon: "fa-comment", mau: "text-blue-600" }
};
// Khoá của `changes` là TÊN CỘT CSDL (máy chủ ghi thẳng cột), không phải tên trường của form.
const NHAT_KY_COT = {
  name: "Tên", description: "Mô tả", status: "Trạng thái", priority: "Ưu tiên",
  manager_id: "Người quản lý", manager_name: "Người quản lý",
  department_id: "Phòng", supervisor_id: "Ban lãnh đạo kiểm soát",
  leader_ids: "Lãnh đạo phòng phụ trách",
  assignee_id: "Cán bộ trực tiếp", assignee_name: "Cán bộ trực tiếp",
  start_date: "Ngày bắt đầu", end_date: "Ngày kết thúc", due_date: "Ngày hết hạn",
  report_date: "Ngày báo cáo", completion: "Hoàn thành (%)", target: "Chỉ tiêu",
  output: "Kết quả đầu ra", notes: "Ghi chú", result_links: "Liên kết kết quả",
  approval_status: "Trạng thái duyệt", approver_id: "Người duyệt",
  approved_at: "Thời điểm duyệt", reject_reason: "Lý do từ chối",
  sort_order: "Thứ tự", work_id: "Thuộc công việc", parent_id: "Thuộc công việc con"
};
const NHAT_KY_CAP = { 1: "Công việc", 2: "Công việc con", 3: "Nhiệm vụ" };
function nhanHanhDongNhatKy(action) {
  const ten = String(action == null ? "" : action);
  return NHAT_KY_HANH_DONG[ten] || { nhan: ten || "Hoạt động", icon: "fa-circle-info", mau: "text-gray-500" };
}
function nhanCotNhatKy(cot) {
  const ten = String(cot == null ? "" : cot);
  return NHAT_KY_COT[ten] || ten;
}
function dinhDangGiaTriNhatKy(cot, giaTri) {
  // «(trống)» chứ không phải chuỗi rỗng: xoá sạch một ô cũng là một lần chỉnh sửa cần đọc được.
  if (giaTri == null || giaTri === "") return "(trống)";
  if (Array.isArray(giaTri)) return giaTri.length === 0 ? "(trống)" : giaTri.join(", ");
  if (typeof giaTri === "boolean") return giaTri ? "có" : "không";
  const ten = String(cot == null ? "" : cot);
  if (/_date$|_at$/.test(ten)) return formatDateForDisplay(giaTri, /_at$/.test(ten));
  if (typeof giaTri === "object") return JSON.stringify(giaTri);
  return String(giaTri);
}
function buildNhatKyChiTiet(entry) {
  const details = entry && entry.details && typeof entry.details === "object" ? entry.details : {},
    changes = details.changes && typeof details.changes === "object" ? details.changes : null;
  if (!changes) {
    const phu = [];
    if (details.remindDate) phu.push("Ngày nhắc " + formatDateForDisplay(details.remindDate));
    if (details.deletedCount) phu.push("Xoá " + details.deletedCount + " dòng");
    if (details.copiedCount) phu.push("Sao " + details.copiedCount + " dòng");
    if (details.createdByName) phu.push("Người lập: " + details.createdByName);
    if (details.assignedByName) phu.push("Người giao: " + details.assignedByName);
    // Đặt/bỏ tên theo tháng: máy chủ ghi `{ code, month, name, previousName }` chứ không ghi
    // `changes` (tên tháng nằm ở bảng riêng, không phải một cột của đầu việc).
    if (details.month) {
      phu.push(nhanThangVN(details.month));
      if (details.previousName) phu.push("tên cũ: " + details.previousName);
      phu.push(details.name ? "tên mới: " + details.name : "bỏ tên riêng, dùng lại tên gốc");
    }
    return phu.length === 0 ? "" : "<div class=\"mt-2 text-xs text-gray-600\">" + escapeHtml(phu.join(" · ")) + "</div>";
  }
  const dong = Object.keys(changes).map(cot => {
    const doi = changes[cot] && typeof changes[cot] === "object" ? changes[cot] : {};
    return "<div class=\"flex flex-wrap items-baseline gap-1\">" +
      "<span class=\"font-medium text-gray-700\">" + escapeHtml(nhanCotNhatKy(cot)) + ":</span>" +
      "<span class=\"line-through text-gray-400\">" + escapeHtml(dinhDangGiaTriNhatKy(cot, doi.from)) + "</span>" +
      "<i class=\"fas fa-arrow-right text-gray-300 text-[10px]\"></i>" +
      "<span class=\"font-medium text-gray-800\">" + escapeHtml(dinhDangGiaTriNhatKy(cot, doi.to)) + "</span>" +
      "</div>";
  });
  return "<div class=\"mt-2 space-y-1 text-xs\">" + dong.join("") + "</div>";
}
function buildNhatKyDong(entry) {
  const hanhDong = nhanHanhDongNhatKy(entry && entry.action),
    ref = entry && entry.ref && typeof entry.ref === "object" ? entry.ref : {},
    capNhan = NHAT_KY_CAP[ref.level] || "",
    ma = String(ref.code == null ? "" : ref.code),
    ten = String(ref.name == null ? "" : ref.name),
    nguoi = String(entry && entry.actor_name ? entry.actor_name : "Hệ thống"),
    luc = formatDateForDisplay(entry && entry.created_at, true);
  return "<div class=\"border border-gray-100 rounded-lg p-3 bg-white shadow-sm\">" +
    "<div class=\"flex items-start justify-between gap-2\">" +
      "<div class=\"text-sm font-semibold text-gray-800\"><i class=\"fas " + escapeHtmlAttr(hanhDong.icon) + " " + escapeHtmlAttr(hanhDong.mau) + " mr-2\"></i>" + escapeHtml(hanhDong.nhan) + "</div>" +
      "<div class=\"text-xs text-gray-400 whitespace-nowrap\">" + escapeHtml(luc) + "</div>" +
    "</div>" +
    "<div class=\"mt-1 text-xs text-gray-500\">" + escapeHtml(nguoi) +
      (capNhan ? " · " + escapeHtml(capNhan) : "") + (ma ? " " + escapeHtml(ma) : "") +
      (ten ? " — " + escapeHtml(ten) : "") +
      (ref.deleted ? " <span class=\"text-red-500\">(đã xoá)</span>" : "") +
    "</div>" + buildNhatKyChiTiet(entry) + "</div>";
}
function renderNhatKy(hostId, data) {
  const el = document.getElementById(hostId);
  if (!el) return;
  const list = data && Array.isArray(data.entries) ? data.entries : [];
  if (list.length === 0) {
    el.innerHTML = "<div class=\"text-center py-8 text-gray-400\"><i class=\"fas fa-clock-rotate-left text-3xl mb-2\"></i><p class=\"text-sm\">Chưa có lần chỉnh sửa nào</p></div>";
    return;
  }
  // Máy chủ trả CŨ TRƯỚC (để lần lại diễn biến); trên màn hình thì đảo lại MỚI TRƯỚC — người mở tab
  // này gần như luôn muốn biết «vừa có ai sửa gì», không phải đọc từ ngày lập.
  el.innerHTML = list.slice().reverse().map(buildNhatKyDong).join("");
}
async function napNhatKy(kieu, ma, hostId) {
  const el = document.getElementById(hostId);
  if (!el) return;
  const goc = kieu === "project" ? "/api/v1/works/" : "/api/v1/work-items/";
  try {
    // scope=tree: công việc cha lấy luôn nhật ký của công việc con và nhiệm vụ dưới nó.
    renderNhatKy(hostId, await restGet(goc + encodeURIComponent(ma) + "/history?scope=tree&limit=500"));
  } catch (err) {
    el.innerHTML = "<div class=\"py-6 text-center text-sm text-red-500\">Không tải được nhật ký: " + escapeHtml(err && err.message ? err.message : String(err)) + "</div>";
  }
}
function chuyenTabNhatKy(kieu, tab) {
  // Thân form của modal công việc là chính `<form>`; modal nhiệm vụ phải giữ hàng tiêu đề (có nút
  // Cập nhật) nên chỉ ẩn khối 3 cột bên trong.
  const than = document.getElementById(kieu === "project" ? "project-form" : "task-form-body"),
    khung = document.getElementById(kieu + "-nhat-ky-panel"),
    khungTen = document.getElementById(kieu + "-ten-thang-panel"),
    nutTt = document.getElementById(kieu + "-tab-thong-tin"),
    nutNk = document.getElementById(kieu + "-tab-nhat-ky"),
    nutTen = document.getElementById(kieu + "-tab-ten-thang");
  if (!than || !khung) return;
  const xemNhatKy = tab === "nhat-ky",
    xemTenThang = tab === "ten-thang";
  than.classList.toggle("hidden", xemNhatKy || xemTenThang);
  khung.classList.toggle("hidden", !xemNhatKy);
  khungTen && khungTen.classList.toggle("hidden", !xemTenThang);
  if (nutTt && nutNk) {
    const bat = "px-3 py-2 text-sm font-semibold border-b-2 border-blue-500 text-blue-600",
      tat = "px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-gray-500";
    nutTt.className = xemNhatKy || xemTenThang ? tat : bat;
    nutNk.className = xemNhatKy ? bat : tat;
    if (nutTen) nutTen.className = xemTenThang ? bat : tat;
  }
  // Nạp một lần rồi thôi: đổi tab qua lại không gọi lại API.
  if (xemNhatKy && khung.dataset.daNap !== "1") {
    khung.dataset.daNap = "1";
    napNhatKy(kieu, khung.dataset.ma || "", kieu + "-nhat-ky-noi-dung");
  }
}
function buildThanhTabNhatKy(kieu, coTenThang = false) {
  // Thoát NGAY tại chỗ nội suy, không qua biến trung gian: bộ soát XSS (TC-SEC-18) chỉ nhận hàm
  // thoát viết thẳng ở lỗ HTML — và đúng ra thế, vì biến thì đọc mã không biết đã thoát chưa.
  return "<div class=\"flex gap-2 border-b border-gray-100 mb-4\">" +
    "<button type=\"button\" id=\"" + escapeHtmlAttr(kieu) + "-tab-thong-tin\" class=\"px-3 py-2 text-sm font-semibold border-b-2 border-blue-500 text-blue-600\" onclick=\"chuyenTabNhatKy('" + escapeForInlineHandler(kieu) + "', 'thong-tin')\">Thông tin</button>" +
    "<button type=\"button\" id=\"" + escapeHtmlAttr(kieu) + "-tab-nhat-ky\" class=\"px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-gray-500\" onclick=\"chuyenTabNhatKy('" + escapeForInlineHandler(kieu) + "', 'nhat-ky')\"><i class=\"fas fa-clock-rotate-left mr-1\"></i>Nhật ký</button>" +
    // Tab thứ ba chỉ hiện với đầu việc DÀI HƠN MỘT THÁNG: bấm vào một tab trống thì người dùng
    // tưởng chức năng hỏng, còn không có tab thì thấy ngay là đầu việc này không thuộc diện.
    (coTenThang ? "<button type=\"button\" id=\"" + escapeHtmlAttr(kieu) + "-tab-ten-thang\" class=\"px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-gray-500\" onclick=\"chuyenTabNhatKy('" + escapeForInlineHandler(kieu) + "', 'ten-thang')\"><i class=\"fas fa-calendar-day mr-1\"></i>Tên theo tháng</button>" : "") +
    "</div>";
}
function buildKhungNhatKy(kieu, ma) {
  // Mã đầu việc đi theo `data-ma` chứ không nhồi vào onclick: đổi tab chỉ cần đọc lại thuộc tính.
  return "<div id=\"" + escapeHtmlAttr(kieu) + "-nhat-ky-panel\" class=\"hidden\" data-ma=\"" + escapeHtmlAttr(ma) + "\">" +
    "<div id=\"" + escapeHtmlAttr(kieu) + "-nhat-ky-noi-dung\" class=\"space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar\">" +
    "<div class=\"py-8 text-center text-gray-400\"><i class=\"fas fa-spinner fa-spin mr-2\"></i>Đang tải nhật ký…</div></div></div>";
}
/** Dòng đầu việc TRONG BỘ NHỚ theo mã — nơi duy nhất `monthNames` được cập nhật sau khi ghi. */
function timDongDauViec(kieu, ma) {
  const khoa = String(ma == null ? "" : ma);
  if (kieu === "project") return allProjects.find(row => String(row[COL.P_ID]) === khoa) || null;
  return allTasks.find(row => String(row[COL.T_ID]) === khoa) || null;
}
/** Tên gốc + khoảng thời gian của một dòng, gọi đúng cột theo cấp (cấp 1 khác cấp 2/3). */
function thongTinTenThangCuaDong(kieu, dong) {
  const d = dong || {};
  if (kieu === "project") return { ten: String(d[COL.P_NAME] || ""), batDau: d[COL.P_START], ketThuc: d[COL.P_END] };
  return { ten: String(d[COL.T_NAME] || ""), batDau: d[COL.T_START], ketThuc: d[COL.T_DUE] };
}
/** MỘT hàng của bảng: ô nhập + nút Lưu, thêm nút Bỏ khi tháng đó đang có tên riêng. */
function buildDongTenThang(kieu, ma, tenGoc, thang, giaTri) {
  const hienTai = giaTri == null ? "" : String(giaTri);
  return "<tr>" +
    "<td class=\"px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap\">" + escapeHtml(nhanThangVN(thang)) + "</td>" +
    "<td class=\"px-3 py-2\"><input type=\"text\" class=\"form-input\" id=\"" + escapeHtmlAttr(kieu + "-ten-thang-o-" + thang) + "\" value=\"" + escapeHtmlAttr(hienTai) + "\" placeholder=\"" + escapeHtmlAttr(tenGoc) + "\" maxlength=\"500\" onkeydown=\"enterLuuTenThang(event, '" + escapeForInlineHandler(kieu) + "', '" + escapeForInlineHandler(ma) + "', '" + escapeForInlineHandler(thang) + "')\"></td>" +
    "<td class=\"px-3 py-2 text-right whitespace-nowrap\">" +
    "<button type=\"button\" class=\"btn-secondary py-1 px-3 text-sm\" onclick=\"luuTenThang('" + escapeForInlineHandler(kieu) + "', '" + escapeForInlineHandler(ma) + "', '" + escapeForInlineHandler(thang) + "')\">Lưu</button>" +
    (hienTai ? "<button type=\"button\" class=\"btn-secondary py-1 px-3 text-sm ml-2 text-red-600\" onclick=\"xoaTenThang('" + escapeForInlineHandler(kieu) + "', '" + escapeForInlineHandler(ma) + "', '" + escapeForInlineHandler(thang) + "')\">Bỏ</button>" : "") +
    "</td></tr>";
}
/** Bảng «Tên theo tháng» — dựng LẠI TỪ dòng trong bộ nhớ, không gọi thêm API (bản đồ đã đi kèm). */
function buildBangTenThang(kieu, ma) {
  const dong = timDongDauViec(kieu, ma),
    tt = thongTinTenThangCuaDong(kieu, dong),
    cacThang = cacThangCuaDauViec(tt.batDau, tt.ketThuc),
    suaDuoc = cacThang.slice(1);
  if (!dong || suaDuoc.length === 0) {
    return "<div class=\"py-8 text-center text-sm text-gray-500\">Đầu việc này không kéo dài hơn một tháng nên không có tháng nào để đặt tên riêng.</div>";
  }
  const banDo = banDoTenThangCuaDong(dong);
  return "<div class=\"text-xs text-gray-500 mb-3\">" + escapeHtml(nhanThangVN(cacThang[0])) + " luôn dùng tên gốc «" + escapeHtml(tt.ten) + "» — muốn đổi thì sửa ô Tên ở tab Thông tin. Để TRỐNG một tháng là dùng lại tên gốc; tháng đã đổi tên thì di chuột vào sẽ thấy tên gốc.</div>" +
    "<table class=\"min-w-full table-auto\"><thead class=\"bg-gray-50\"><tr>" +
    "<th class=\"px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase\">Tháng</th>" +
    "<th class=\"px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase\">Tên riêng của tháng</th>" +
    "<th class=\"px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase\">Thao tác</th>" +
    "</tr></thead><tbody class=\"bg-white divide-y divide-gray-100\">" +
    suaDuoc.map(thang => buildDongTenThang(kieu, ma, tt.ten, thang, banDo[thang])).join("") +
    "</tbody></table>";
}
function buildKhungTenThang(kieu, ma) {
  return "<div id=\"" + escapeHtmlAttr(kieu) + "-ten-thang-panel\" class=\"hidden\" data-ma=\"" + escapeHtmlAttr(ma) + "\">" +
    "<div id=\"" + escapeHtmlAttr(kieu) + "-ten-thang-bang\" class=\"max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar\">" +
    buildBangTenThang(kieu, ma) + "</div></div>";
}
function veLaiBangTenThang(kieu, ma) {
  const el = document.getElementById(kieu + "-ten-thang-bang");
  if (el) el.innerHTML = buildBangTenThang(kieu, ma);
}
/**
 * GHI tên tháng: `ten === null` là DELETE, chuỗi rỗng là PUT rỗng (máy chủ hiểu là bỏ tên riêng).
 * Quyền do máy chủ quyết (đúng bằng quyền SỬA đầu việc) — chỗ này chỉ hiện lại câu lỗi nguyên văn.
 */
async function ghiTenThang(kieu, ma, thang, ten) {
  const goc = kieu === "project" ? "/api/v1/works/" : "/api/v1/work-items/",
    duong = goc + encodeURIComponent(ma) + "/month-names/" + encodeURIComponent(thang),
    ketQua = ten === null ? await restGhi("DELETE", duong) : await restGhi("PUT", duong, { name: ten }),
    boTen = ten === null || String(ten).trim() === "";
  if (!ketQua.ok) {
    showToast(ketQua.error || "Không lưu được tên theo tháng", "error");
    return false;
  }
  // Sửa NGAY bản đồ trong bộ nhớ: hai tab lọc tháng tại chỗ, không nạp lại dữ liệu từ máy chủ.
  const dong = timDongDauViec(kieu, ma);
  if (dong) {
    const banDo = Object.assign({}, banDoTenThangCuaDong(dong));
    boTen ? delete banDo[thang] : (banDo[thang] = String(ten).trim());
    dong.monthNames = banDo;
  }
  showToast(boTen ? "Đã bỏ tên riêng của " + nhanThangVN(thang) : "Đã lưu tên của " + nhanThangVN(thang), "success");
  veLaiBangTenThang(kieu, ma), renderProjects(), renderTasks();
  if (currentSection === "gantt") renderGanttChart();
  return true;
}
function luuTenThang(kieu, ma, thang) {
  const o = document.getElementById(kieu + "-ten-thang-o-" + thang);
  // Cắt trắng NGAY tại đây: máy chủ cũng trim (works/routes.js), gửi đúng thứ sẽ được lưu.
  return ghiTenThang(kieu, ma, thang, o ? String(o.value).trim() : "");
}
function xoaTenThang(kieu, ma, thang) {
  return ghiTenThang(kieu, ma, thang, null);
}
function enterLuuTenThang(event, kieu, ma, thang) {
  if (!event || event.key !== "Enter") return;
  // Ô này nằm TRONG <form> của modal nhiệm vụ: Enter mặc định là bấm Cập nhật cả nhiệm vụ.
  event.preventDefault();
  luuTenThang(kieu, ma, thang);
}
function createProjectModal(isEdit, project) {
  const text = isEdit ? "Chỉnh sửa công việc" : "Tạo công việc mới",
    text2 = isEdit ? "Cập nhật" : "Tạo công việc";
  let list = [];
  if (isEdit && project && project[COL.P_MANAGER]) {
    const staff = allStaff.find(staff2 => staff2[COL.S_NAME] === project[COL.P_MANAGER]);
    if (!staff) {
      const values = [...allStaff];
      values.push({
        [COL.S_NAME]: project[COL.P_MANAGER],
        [COL.S_EMAIL]: ""
      });
      if (isAdmin()) list = values;else isManager() ? list = values.filter(value => value[COL.S_NAME] === currentUser.name || value[COL.S_NAME] === project[COL.P_MANAGER]) : project[COL.P_MANAGER] === currentUser.name && (list = values.filter(value => value[COL.S_NAME] === currentUser.name || value[COL.S_NAME] === project[COL.P_MANAGER]));
    } else {
      if (isAdmin()) list = allStaff;else isManager() ? list = allStaff.filter(staff2 => staff2[COL.S_NAME] === currentUser.name || staff2[COL.S_NAME] === project[COL.P_MANAGER]) : project[COL.P_MANAGER] === currentUser.name && (list = allStaff.filter(staff2 => staff2[COL.S_NAME] === currentUser.name));
    }
  } else {
    if (isAdmin()) list = allStaff;else isManager() && (list = allStaff.filter(staff => staff[COL.S_NAME] === currentUser.name));
  }
  return list = list.filter(list2 => list2[COL.S_OBJECT_TYPE] !== "Nhà cung cấp"), setTimeout(() => {
    const el = document.querySelector("#project-modal input[name=\"startDate\"]"),
      el2 = document.querySelector("#project-modal input[name=\"endDate\"]");
    el && el2 && (el.addEventListener("change", function () {
      el2.value && this.value > el2.value && (el2.value = this.value), el2.setAttribute("min", this.value);
    }), el2.addEventListener("change", function () {
      el.value && this.value < el.value && (el.value = this.value), el.setAttribute("max", this.value);
    }));
  }, 100), setTimeout(function () {
      // Phân công ba lớp: nạp ứng viên theo phòng; đổi phòng là nạp lại toàn bộ nguồn
      const deptSel = document.getElementById("project-dept-select"),
        supSel = document.getElementById("project-supervisor-select"),
        leadBox = document.getElementById("project-leaders-box"),
        leadInput = document.getElementById("project-leaders-input");
      if (deptSel && supSel && leadBox && leadInput) {
        const supGoc = isEdit && project ? project.supervisorId : "",
          leadGoc = isEdit && project ? project.leaderIds || [] : [];
        let lanDau = true;
        const napPhanCong = function () {
          napUngVienPhanCong({ deptValue: deptSel.value, supervisorSelect: supSel, leadersBox: leadBox, leadersInput: leadInput, selectedSupervisor: lanDau ? supGoc : "", selectedLeaders: lanDau ? leadGoc : [], applyDefault: true });
          lanDau = false;
        };
        deptSel.addEventListener("change", napPhanCong);
        const veLaiPhong = function () {
          deptSel.innerHTML = buildDeptIdOptions(isEdit && project ? project[COL.P_DEPT_ID] : "");
          // Có phòng trong state nhưng không render được option nào ⇒ máy chủ cũ thiếu ID phòng.
          if (Array.isArray(allDepartments) && allDepartments.length > 0 && deptSel.options.length <= 1)
            showToast("Danh sách phòng trống: máy chủ đang chạy bản cũ (thiếu ID phòng). Cần cập nhật máy chủ rồi khởi động lại.", "error");
          napPhanCong();
        };
        // Mở form TRƯỚC khi danh sách phòng kịp nạp: context về là phải vẽ lại ô Phòng rồi mới
        // nạp phân công — không thì ô phòng trống vĩnh viễn cho tới khi đóng/mở lại modal.
        Array.isArray(allDepartments) && allDepartments.length > 0 ? veLaiPhong() : loadDepartmentContext(veLaiPhong);
      }
    }, 250), "\n  <div id=\"project-modal\" class=\"modal\">\n      <div class=\"modal-content\">\n          <div class=\"flex items-center justify-between mb-6\">\n              <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(text) + "</h3>\n              <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n                  <i class=\"fas fa-times\"></i>\n              </button>\n          </div>\n          \n          " + (isEdit ? buildThanhTabNhatKy("project", thangSuaDuocCuaDauViec(project[COL.P_START], project[COL.P_END]).length > 0) : "") + "\n          <form id=\"project-form\">\n              " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + escapeHtml(project[COL.P_ID]) + "\">" : "") + "\n              \n              <div class=\"form-group\">\n                  <label class=\"form-label required\">Tên công việc</label>\n                  <input type=\"text\" name=\"name\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(project[COL.P_NAME]) || "" : "") + "\" " + (isEdit && !isAdmin() && !isManager() ? "disabled" : "") + ">\n\n              </div>\n              \n              <div class=\"form-group\">\n                  <label class=\"form-label\">Mô tả</label>\n                  <textarea name=\"description\" class=\"form-textarea\" " + (isEdit && !isAdmin() && !isManager() ? "disabled" : "") + ">" + (isEdit ? escapeHtml(project[COL.P_DESC]) || "" : "") + "</textarea>\n              </div>\n              \n              \n              \n              <div class=\"form-group\">\n                  <label class=\"form-label\">Phòng</label>\n                  <select name=\"departmentId\" id=\"project-dept-select\" class=\"form-select\">\n                      " + buildDeptIdOptions(isEdit && project ? project[COL.P_DEPT_ID] : "") + "\n                  </select>\n              </div>\n              <div class=\"form-group\">\n                  <label class=\"form-label\">Ban lãnh đạo kiểm soát</label>\n                  <select name=\"supervisorId\" id=\"project-supervisor-select\" class=\"form-select\"></select>\n              </div>\n              <div class=\"form-group\">\n                  <label class=\"form-label\">Lãnh đạo phòng phụ trách</label>\n                  <div id=\"project-leaders-box\" class=\"flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[42px] items-center\"></div>\n                  <input type=\"hidden\" name=\"leaderIds\" id=\"project-leaders-input\" value=\"" + (isEdit && project ? (project.leaderIds || []).join(",") : "") + "\">\n              </div>\n              <div class=\"grid grid-cols-3 gap-4\">\n                  <div class=\"form-group\">\n                      <label class=\"form-label required\">Ngày bắt đầu</label>\n                      <input type=\"date\" name=\"startDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(project[COL.P_START])) : "") + "\" " + (isEdit && !isAdmin() && !isManager() ? "disabled" : "") + ">\n                  </div>\n                  <div class=\"form-group\">\n                      <label class=\"form-label required\">Ngày kết thúc</label>\n                      <input type=\"date\" name=\"endDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(project[COL.P_END])) : "") + "\" " + (isEdit && !isAdmin() && !isManager() ? "disabled" : "") + ">\n                  </div>\n                  <div class=\"form-group\">\n                      <label class=\"form-label\">Trạng thái</label>\n                      <select name=\"status\" class=\"form-select\">\n                          <option value=\"Chưa bắt đầu\" " + (isEdit && project[COL.P_STATUS] === "Chưa bắt đầu" ? "selected" : "") + ">Chưa bắt đầu</option>\n                          <option value=\"Đang thực hiện\" " + (isEdit && project[COL.P_STATUS] === "Đang thực hiện" ? "selected" : "") + ">Đang thực hiện</option>\n                          <option value=\"Hoàn thành\" " + (isEdit && project[COL.P_STATUS] === "Hoàn thành" ? "selected" : "") + ">Hoàn thành</option>\n                          <option value=\"Tạm dừng\" " + (isEdit && project[COL.P_STATUS] === "Tạm dừng" ? "selected" : "") + ">Tạm dừng</option>\n                          <option value=\"Hủy bỏ\" " + (isEdit && project[COL.P_STATUS] === "Hủy bỏ" ? "selected" : "") + ">Hủy bỏ</option>\n                      </select>\n                  </div>\n              </div>              \n              \n              <div class=\"flex justify-end space-x-3 mt-6\">\n                  <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n                  " + buildLuuNhapNutHtml(isEdit) + "\n                  <button type=\"submit\" class=\"btn-primary\">" + escapeHtml(text2) + "</button>\n              </div>\n          </form>\n          " + (isEdit ? buildKhungNhatKy("project", project[COL.P_ID]) + buildKhungTenThang("project", project[COL.P_ID]) : "") + "\n      </div>\n  </div>\n";
}
function createTaskModal(isEdit, task) {
  const draft = isEdit ? null : pendingTaskCreate;
  if (!isEdit) pendingTaskCreate = null;
  const createLevel = !isEdit && draft && Number(draft.level) === 2 ? 2 : 3,
    createParent = !isEdit && draft && draft.parentId ? String(draft.parentId) : "",
    createProject = !isEdit && draft && draft.projectId ? String(draft.projectId) : "",
    text = isEdit ? "Chỉnh sửa nhiệm vụ" : createLevel === 2 ? "Tạo công việc con" : "Tạo nhiệm vụ mới",
    text2 = isEdit ? "Cập nhật" : createLevel === 2 ? "Tạo công việc con" : "Tạo nhiệm vụ";
  let list = [];
  if (isAdmin()) list = allStaff;else {
    if (isManager()) list = allStaff.filter(staff => {
      const lower = (staff[COL.S_ROLE] || "").toLowerCase();
      return !lower.includes("admin");
    });else {
      const hasMatch = allProjects.some(project => project[COL.P_MANAGER] === currentUser.name);
      hasMatch ? list = allStaff.filter(staff => {
        const lower = (staff[COL.S_ROLE] || "").toLowerCase();
        return !lower.includes("admin");
      }) : list = allStaff.filter(staff => staff[COL.S_NAME] === currentUser.name);
    }
  }
  list = list.filter(list2 => list2[COL.S_OBJECT_TYPE] !== "Nhà cung cấp")
      .filter(canBo => canBo[COL.S_ROLE] === "Nhân viên"); // Ứng viên «Cán bộ trực tiếp»: chỉ Nhân viên (ẩn Trưởng/Phó phòng/Phó GĐ)
  const isEdit2 = isEdit && task && task[COL.T_ASSIGNEE] === currentUser.name && !isAdmin(),
    taskPid = isEdit && task ? task[COL.T_PID] : "",
    taskPid2 = taskPid && allProjects.find(project => project[COL.P_ID] === taskPid && project[COL.P_MANAGER] === currentUser.name),
    isEdit22 = isEdit2 && !taskPid2;
  setTimeout(() => {
    const el = document.querySelector("#task-modal select[name=\"status\"]"),
      el2 = document.querySelector("#task-modal input[name=\"completion\"]");
    el && el2 && el.addEventListener("change", function () {
      this.value === "Hoàn thành" && (el2.value = 100);
    });
  }, 100), setTimeout(() => {
    const el = document.querySelector("#task-modal select[name=\"projectId\"]"),
      el2 = document.querySelector("#task-modal select[name=\"assignee\"]"),
      el3 = document.querySelector("#task-modal input[name=\"startDate\"]"),
      el4 = document.querySelector("#task-modal input[name=\"dueDate\"]");
    function updateTaskDateLimits() {
      const elValue = el.value,
        project = allProjects.find(project2 => project2[COL.P_ID] === elValue);
      if (project) {
        const minDate = formatDateForInput(project[COL.P_START]),
          maxDate = formatDateForInput(project[COL.P_END]);
        minDate && (el3.setAttribute("min", minDate), el4.setAttribute("min", minDate), !el3.value && (el3.value = minDate)), maxDate && (el3.setAttribute("max", maxDate), el4.setAttribute("max", maxDate), !el4.value && (el4.value = maxDate));
      }
      el3.value && el4.setAttribute("min", el3.value);
      if (el3.value) {
        el4.setAttribute("min", el3.value);
        const el5 = document.querySelector("#task-modal input[name=\"reportDate\"]");
        el5 && el5.setAttribute("min", el3.value);
      }
    }
    function updateAssigneePermission() {
      if (laCapHai) {
        el2.value = "";
        return;
      }
      const elValue = el.value,
        project = allProjects.find(project2 => project2[COL.P_ID] === elValue);
      if (isAdmin()) el2.disabled = false;else project && project[COL.P_MANAGER] === currentUser.name ? el2.disabled = false : (el2.disabled = true, el2.value = currentUser.name);
    }
    el && el3 && el4 && (el.addEventListener("change", updateTaskDateLimits), el.addEventListener("change", updateAssigneePermission), updateTaskDateLimits(), updateAssigneePermission(), el3.addEventListener("change", function () {
      el4.value && this.value > el4.value && (el4.value = this.value);
      el4.setAttribute("min", this.value);
      const el5 = document.querySelector("#task-modal input[name=\"reportDate\"]");
      el5 && el5.setAttribute("min", this.value);
    }), el4.addEventListener("change", function () {
      el3.value && this.value < el3.value && (el3.value = this.value), el3.setAttribute("max", this.value);
    }));
  }, 100), setTimeout(() => {
    window.innerWidth < 768 && toggleTaskReminders(false);
  }, 100);
  // Cấp 2 (công việc con) có đủ ô phân công; nhiệm vụ (cấp 3) chỉ chọn MỘT lãnh đạo phòng
  const laCapHai = isEdit && task ? Number(task[COL.T_LEVEL]) === 2 : createLevel === 2;
  const taskReminders = isEdit && task ? task[COL.T_REMINDERS] || [] : [],
    taskId = isEdit && task ? task[COL.T_ID] : "";
  // Phân công ba lớp của form nhiệm vụ/CV con: nguồn ứng viên theo PHÒNG của công việc đang
  // chọn — trước đây form này chưa được nối napUngVienPhanCong nên hai ô phân công trống.
  setTimeout(() => {
    const projectSel = document.querySelector("#task-modal select[name=\"projectId\"]"),
      supSel = document.getElementById("task-supervisor-select"),
      leadBox = document.getElementById("task-leaders-box"),
      leadInput = document.getElementById("task-leaders-input"),
      leadSel = document.getElementById("task-leader-select");
    if (!projectSel) return;
    const napPhanCongTask = function () {
      const project = allProjects.find(p => p[COL.P_ID] === projectSel.value);
      napUngVienPhanCong({
        deptValue: project ? project[COL.P_DEPT_ID] : "",
        supervisorSelect: laCapHai ? supSel : null,
        leadersBox: laCapHai ? leadBox : null,
        leadersInput: laCapHai ? leadInput : null,
        singleLeaderSelect: laCapHai ? null : leadSel,
        selectedSupervisor: isEdit && task ? task.supervisorId : "",
        selectedLeaders: isEdit && task ? task.leaderIds || [] : [],
        applyDefault: true
      });
    };
    projectSel.addEventListener("change", napPhanCongTask);
    napPhanCongTask();
  }, 250);
  return "\n  <div id=\"task-modal\" class=\"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] modal-overlay\">\n      <div class=\"modal-content glass-card md:max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto\" style=\"width: 90vw !important; max-width: none !important; height: 96vh !important;\">\n          <form id=\"task-form\" class=\"h-full flex flex-col\">\n              " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + escapeHtml(taskId) + "\">" : "<input type=\"hidden\" id=\"task-create-level\" name=\"level\" value=\"" + escapeHtml(createLevel) + "\"><input type=\"hidden\" id=\"task-create-parent\" name=\"parent\" value=\"" + escapeHtml(createParent) + "\">") + "\n              \n              <!-- Sticky Header Row -->\n              <div class=\"flex flex-col md:flex-row gap-6 items-center mb-6 sticky bg-white z-10 pb-4 border-b border-gray-100 -mx-8 px-8 -mt-8 pt-4 relative\" style=\"top: -32px;\">\n                " + (!isEdit ? "\n                <button type=\"button\" class=\"close-modal absolute top-4 right-4 text-gray-400 hover:text-gray-600 md:hidden\">\n                    <i class=\"fas fa-times text-xl\"></i>\n                </button>\n                " : "") + "\n                <div class=\"flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full\">\n                    <div class=\"flex items-center\">\n                        <h3 class=\"text-xl font-bold text-gray-900\">\n                            <i class=\"fas " + (isEdit ? "fa-edit" : "fa-plus-circle") + " text-blue-500 mr-2\"></i>" + escapeHtml(text) + "\n                        </h3>\n                    </div>\n                    <div class=\"flex items-center justify-between\">\n                        <div class=\"flex-1 flex justify-center\">\n                            <button type=\"submit\" class=\"btn-primary flex items-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all w-full md:w-auto justify-center\">\n                                <i class=\"fas fa-save mr-2\"></i>" + escapeHtml(text2) + "\n                            </button>\n                        </div>\n                        " + (!isEdit ? "\n                        <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600 hidden md:block\">\n                            <i class=\"fas fa-times text-xl\"></i>\n                        </button>\n                        " : "") + "\n                    </div>\n                </div>\n                " + (isEdit ? "\n                <div class=\"w-full md:w-72 flex items-center gap-2\">\n                    <div class=\"font-semibold text-gray-900 flex items-center cursor-pointer select-none flex-1\" onclick=\"toggleTaskReminders()\">\n                        <i id=\"reminder-toggle-icon\" class=\"fas fa-chevron-down text-gray-400 mr-2 transition-transform duration-300\"></i>\n                        <i class=\"fas fa-bell text-amber-500 mr-2\"></i>\n                        Lịch sử nhắc việc\n                        <button type=\"button\" onclick=\"event.stopPropagation(); openAddReminderModal('" + escapeForInlineHandler(taskId) + "')\" class=\"ml-3 p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors\" title=\"Thêm nhắc việc\">\n                            <i class=\"fas fa-plus text-sm\"></i>\n                        </button>\n                    </div>\n                    <button type=\"button\" class=\"close-modal bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition-colors flex-shrink-0\">\n                        <i class=\"fas fa-times\"></i>\n                    </button>\n                </div>\n                " : "") + "\n              </div>\n\n              " + (isEdit ? buildThanhTabNhatKy("task", thangSuaDuocCuaDauViec(task[COL.T_START], task[COL.T_DUE]).length > 0) : "") + "\n              <!-- 3 Columns Content -->\n              <div id=\"task-form-body\" class=\"flex flex-col md:flex-row gap-6 items-start h-full pb-4 flex-1\">\n                  \n                  <!-- Left Container (Cols 1 & 2) -->\n                  <div class=\"flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 h-auto md:h-full overflow-visible md:overflow-y-auto pr-0 md:pr-2 custom-scrollbar w-full order-2 md:order-1\">\n                      \n                      <!-- Column 1 -->\n                      <div class=\"space-y-3\">\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label required\">Tên nhiệm vụ</label>\n                            <input type=\"text\" name=\"name\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(task[COL.T_NAME]) || "" : "") + "\" " + (isEdit22 ? "disabled" : "") + ">\n                          </div>\n\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label required\">Thuộc dự án</label>\n                            <select name=\"projectId\" class=\"form-select\" required " + (isEdit22 || createProject ? "disabled" : "") + ">\n                              <option value=\"\">-- Chọn dự án --</option>\n                              " + (isAdmin() || isManager() ? allProjects : getUserAllowedProjects()).map(item => {
    const text3 = (isEdit ? task[COL.T_PID] : createProject) === item[COL.P_ID] ? "selected" : "";
    return "<option value=\"" + escapeHtml(item[COL.P_ID]) + "\" " + text3 + ">" + escapeHtml(item[COL.P_NAME]) + " (" + escapeHtml(item[COL.P_ID]) + ")</option>";
  }).join("") + "\n                            </select>\n                          </div>\n                          <div id=\"task-supervisor-group\" class=\"form-group\" style=\"" + (laCapHai ? "" : "display:none") + "\">\n                              <label class=\"form-label\">Ban lãnh đạo kiểm soát</label>\n                              <select name=\"supervisorId\" id=\"task-supervisor-select\" class=\"form-select\"></select>\n                          </div>\n                          <div id=\"task-leaders-multi\" class=\"form-group\" style=\"" + (laCapHai ? "" : "display:none") + "\">\n                              <label class=\"form-label\">Lãnh đạo phòng phụ trách</label>\n                              <div id=\"task-leaders-box\" class=\"flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[42px] items-center\"></div>\n                          </div>\n                          <div id=\"task-leader-single\" class=\"form-group\" style=\"" + (laCapHai ? "display:none" : "") + "\">\n                              <label class=\"form-label\">Lãnh đạo phòng phụ trách</label>\n                              <select name=\"leaderIds\" id=\"task-leader-select\" class=\"form-select\"></select>\n                          </div>\n                          <input type=\"hidden\" name=\"leaderIds\" id=\"task-leaders-input\" value=\"" + (isEdit && task ? (task.leaderIds || []).join(",") : "") + "\">\n\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label\">Mô tả</label>\n                            <textarea name=\"description\" class=\"form-textarea\" rows=\"5\" " + (isEdit22 ? "disabled" : "") + ">" + (isEdit ? escapeHtml(task[COL.T_DESC]) || "" : "") + "</textarea>\n                          </div>\n                      \n                          <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                              <div class=\"form-group\" style=\"" + (laCapHai ? "display:none" : "") + "\">\n                                <label class=\"form-label\">Cán bộ trực tiếp</label>\n                                <select name=\"assignee\" class=\"form-select\" " + (isEdit22 || laCapHai ? "disabled" : "") + ">\n                                  <option value=\"\">-- Chọn người thực hiện --</option>\n                                  " + list.map(list2 => {
    let text3 = "";
    if (isEdit) text3 = task[COL.T_ASSIGNEE] === list2[COL.S_NAME] ? "selected" : "";else !isAdmin() && (text3 = list2[COL.S_NAME] === currentUser.name ? "selected" : "");
    return "<option value=\"" + escapeHtml(list2[COL.S_NAME]) + "\" " + text3 + ">" + escapeHtml(list2[COL.S_NAME]) + "</option>";
  }).join("") + "\n                                </select>\n                              </div>\n                              <div class=\"form-group\">\n                                  <label class=\"form-label\">Ưu tiên</label>\n                                  <select name=\"priority\" class=\"form-select\" " + (isEdit22 ? "disabled" : "") + ">\n                                      <option value=\"Thấp\" " + (isEdit && task[COL.T_PRIORITY] === "Thấp" ? "selected" : "") + ">Thấp</option>\n                                      <option value=\"Trung bình\" " + (isEdit && task[COL.T_PRIORITY] === "Trung bình" ? "selected" : "selected") + ">Trung bình</option>\n                                      <option value=\"Cao\" " + (isEdit && task[COL.T_PRIORITY] === "Cao" ? "selected" : "") + ">Cao</option>\n                                  </select>\n                              </div>\n                          </div>\n                      \n                          <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                              <div class=\"form-group\">\n                                  <label class=\"form-label required\">Ngày bắt đầu</label>\n                                  <input type=\"date\" name=\"startDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(task[COL.T_START])) : "") + "\" " + (isEdit22 ? "disabled" : "") + ">\n                              </div>\n                              <div class=\"form-group\">\n                                  <label class=\"form-label required\">Hạn chót</label>\n                                  <input type=\"date\" name=\"dueDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(task[COL.T_DUE])) : "") + "\" " + (isEdit22 ? "disabled" : "") + ">\n                              </div>\n                          </div>\n                      \n                          <div class=\"grid grid-cols-1 md:grid-cols-3 gap-4\">\n                              <div class=\"form-group\">\n                                  <label class=\"form-label\">Trạng thái</label>\n                                  <select name=\"status\" class=\"form-select\">\n                                      <option value=\"Chưa bắt đầu\" " + (isEdit && task[COL.T_STATUS] === "Chưa bắt đầu" ? "selected" : "selected") + ">Chưa bắt đầu</option>\n                                      <option value=\"Đang thực hiện\" " + (isEdit && task[COL.T_STATUS] === "Đang thực hiện" ? "selected" : "") + ">Đang thực hiện</option>\n                                      <option value=\"Hoàn thành\" " + (isEdit && task[COL.T_STATUS] === "Hoàn thành" ? "selected" : "") + ">Hoàn thành</option>\n                                      <option value=\"Tạm dừng\" " + (isEdit && task[COL.T_STATUS] === "Tạm dừng" ? "selected" : "") + ">Tạm dừng</option>\n                                  </select>\n                              </div>\n                              <div class=\"form-group\">\n                                  <label class=\"form-label\">Tiến độ (%)</label>\n                                  <input type=\"number\" name=\"completion\" class=\"form-input\" min=\"0\" max=\"100\" value=\"" + (isEdit ? parseInt(task[COL.T_COMPLETION] || 0) : 0) + "\">\n                              </div>\n                              <div class=\"form-group\">\n                                <label class=\"form-label\">Ngày hoàn thành</label>\n                                <input type=\"date\" name=\"reportDate\" class=\"form-input\" value=\"" + (isEdit ? escapeHtml(formatDateForInput(task[COL.T_REPORT_DATE])) : "") + "\">\n                              </div>\n                          </div>\n                      </div>\n\n                      <!-- Column 2 -->\n                      <div class=\"space-y-3\">\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label\">Mục tiêu</label>\n                            <textarea name=\"target\" class=\"form-textarea\" rows=\"3\">" + (isEdit ? escapeHtml(task[COL.T_TARGET]) || "" : "") + "</textarea>\n                          </div>\n\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label\">Link kết quả</label>\n                            <textarea name=\"resultLinks\" class=\"form-textarea\" rows=\"5\" placeholder=\"Nhập mỗi link trên một dòng\">" + (isEdit ? escapeHtml(task[COL.T_RESULT_LINKS]) || "" : "") + "</textarea>\n                          </div>\n\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label\">Kết quả đầu ra</label>\n                            <textarea name=\"output\" class=\"form-textarea\" rows=\"5\">" + (isEdit ? escapeHtml(task[COL.T_OUTPUT]) || "" : "") + "</textarea>\n                          </div>\n                          \n                          <div class=\"form-group mb-0\">\n                              <label class=\"form-label\">Ghi chú</label>\n                              <textarea name=\"notes\" class=\"form-textarea\" rows=\"2\">" + (isEdit ? escapeHtml(task[COL.T_NOTES]) || "" : "") + "</textarea>\n                          </div>\n                      </div>\n                  </div>\n\n                  <!-- Column 3 (Reminders) - Only show in edit mode -->\n                  " + (isEdit ? "\n                  <div id=\"task-reminders-container\" class=\"order-1 md:order-2 w-full md:w-72 h-auto max-h-160 md:h-full flex flex-col pt-1 transition-all duration-300 ease-in-out border-b border-gray-100 pb-4 mb-4 md:border-b-0 md:pb-0 md:mb-0\" style=\"top: 60px;\">\n                      <div id=\"reminders-list\" class=\"reminders-list h-full overflow-y-auto space-y-3 custom-scrollbar pr-1\">\n                          " + (taskReminders.length > 0 ? taskReminders.map((taskReminder, index) => "\n                              <div class=\"reminder-item p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors\">\n                                  <div class=\"flex items-start justify-between\">\n                                      <div class=\"flex-1\">\n                                          <div class=\"flex items-center text-sm font-medium text-gray-900 mb-1\">\n                                              <i class=\"fas fa-calendar-alt text-amber-500 mr-2 text-xs\"></i>\n                                              " + escapeHtml(formatDateForDisplay(taskReminder.date)) + "\n                                          </div>\n                                          <p class=\"text-sm text-gray-600 leading-relaxed reminder-content\">" + (linkifyText(taskReminder.content) || "<em class=\"text-gray-400\">Không có nội dung</em>") + "</p>\n                                      </div>\n                                      " + (isAdmin() || isEdit2 || taskPid2 ? "\n                                      <div class=\"flex items-center space-x-1 ml-2\">\n                                          <button type=\"button\" onclick=\"openEditReminderModal('" + escapeForInlineHandler(taskId) + "', " + index + ", '" + escapeForInlineHandler(taskReminder.date) + "', decodeURIComponent('" + escapeForInlineHandler(encodeURIComponent(taskReminder.content || "")) + "'))\" class=\"p-1 text-gray-400 hover:text-blue-600 transition-colors\" title=\"Sửa\">\n                                              <i class=\"fas fa-edit text-xs\"></i>\n                                          </button>\n                                          <button type=\"button\" onclick=\"handleDeleteReminder('" + escapeForInlineHandler(taskId) + "', " + index + ")\" class=\"p-1 text-gray-400 hover:text-red-600 transition-colors\" title=\"Xóa\">\n                                              <i class=\"fas fa-trash text-xs\"></i>\n                                          </button>\n                                      </div>\n                                      " : "") + "\n                                  </div>\n                              </div>\n                          ").join("") : "\n                              <div class=\"text-center py-8 text-gray-400\">\n                                  <i class=\"fas fa-bell-slash text-3xl mb-2\"></i>\n                                  <p class=\"text-sm\">Chưa có nhắc việc nào</p>\n                              </div>\n                          ") + "\n                      </div>\n                  </div>\n                  " : "") + "\n\n              </div>\n              " + (isEdit ? buildKhungNhatKy("task", taskId) + buildKhungTenThang("task", taskId) : "") + "\n          </form>\n      </div>\n  </div>\n";
}
function toggleTaskReminders(forceShow) {
  const taskRemindersContainerEl = document.getElementById("task-reminders-container"),
    reminderToggleIconEl = document.getElementById("reminder-toggle-icon");
  if (!taskRemindersContainerEl || !reminderToggleIconEl) return;
  const isHidden = taskRemindersContainerEl.classList.contains("hidden"),
    shouldShow = forceShow !== undefined ? forceShow : isHidden;
  shouldShow ? (taskRemindersContainerEl.classList.remove("hidden"), taskRemindersContainerEl.classList.add("flex"), reminderToggleIconEl.style.transform = "rotate(0deg)") : (taskRemindersContainerEl.classList.add("hidden"), taskRemindersContainerEl.classList.remove("flex"), reminderToggleIconEl.style.transform = "rotate(-90deg)");
}
/** GĐ1: các ô <option> phòng cho form. Không phải admin thì chỉ chọn được phòng mình thấy. */
function buildDepartmentOptions(selected) {
  const value = String(selected || "").trim(),
    list = isAdmin() ? departmentNames : visibleDepartments.length > 0 ? visibleDepartments : departmentNames,
    options = list.map(name => "<option value=\"" + escapeHtmlAttr(name) + "\" " + (name === value ? "selected" : "") + ">" + escapeHtml(name) + "</option>");
  return "<option value=\"\" " + (value === "" ? "selected" : "") + ">-- Chưa phân phòng --</option>" + options.join("");
}
/** GĐ1: Trưởng phòng / Phó phòng / Nhân viên. */
function buildDeptRoleOptions(selected) {
  const value = String(selected || "").trim() || "Nhân viên";
  return [["Nhân viên", "Cán bộ"], ["Phó phòng", "Phó phòng"], ["Trưởng phòng", "Trưởng phòng"]].map(([val, label]) => "<option value=\"" + escapeHtml(val) + "\" " + (val === value ? "selected" : "") + ">" + escapeHtml(label) + "</option>").join("");
}

/* ===================== Phân công ba lớp (yêu cầu 2026-08-26) =====================
 * Nguồn ứng viên do MÁY CHỦ trả về qua GET /api/v1/departments/assignment-options
 * (?departmentId=&parentRef=). Giao diện chỉ vẽ dropdown/checkbox từ phản hồi đó.
 * Quy ước BUILDER: hàm dựng HTML phải có tiền tố build, create hoặc render.
 */

/** Ô chọn "Ban lãnh đạo kiểm soát" — MỘT người (admin hoặc Phó GĐ phụ trách phòng). */
function buildSupervisorOptionsHtml(list, selectedId, defaultValue) {
  const chosen = String(selectedId == null ? "" : selectedId).trim() || String(defaultValue == null ? "" : defaultValue).trim() || "";
  return "<option value=\"\">-- Không chọn --</option>" + list.map(s => "<option value=\"" + escapeHtmlAttr(s.id) + "\"" + (String(s.id) === chosen ? " selected" : "") + ">" + escapeHtml(s.name) + "</option>").join("");
}

/** Nhóm checkbox "Lãnh đạo phòng phụ trách" — NHIỀU người, ghi id vào hidden input. */
function buildLeaderCheckboxesHtml(list, selectedIds) {
  const dangChon = new Set((selectedIds || []).map(String));
  if (!list || list.length === 0) return "<span class=\"text-gray-400 text-sm\">Không có lãnh đạo phòng nào để chọn</span>";
  return list.map(l => "<label class=\"inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:border-blue-300\"><input type=\"checkbox\" class=\"leader-opt accent-blue-600\" value=\"" + escapeHtmlAttr(l.id) + "\"" + (dangChon.has(String(l.id)) ? " checked" : "") + "><span class=\"text-sm\">" + escapeHtml(l.name) + "</span></label>").join("");
}

/** Đọc checkbox đang chọn rồi ghi danh sách id (phân tách dấu phẩy) vào hidden input. */
function capNhatLeaderInput(leadersBoxEl, leadersInputEl) {
  if (!leadersBoxEl || !leadersInputEl) return;
  const ids = Array.from(leadersBoxEl.querySelectorAll(".leader-opt:checked")).map(item => item.value);
  leadersInputEl.value = ids.join(",");
}
/** Ô chọn PHÒNG của form công việc — value là id phòng; "" = Công việc chung. */
function buildDeptIdOptions(selectedId) {
  const value = String(selectedId == null ? "" : selectedId).trim(),
    tong = Array.isArray(allDepartments) ? allDepartments.length : 0,
    list = (Array.isArray(allDepartments) ? allDepartments : []).filter(d => String(d[COL.D_DB_ID] == null ? "" : d[COL.D_DB_ID]).trim() !== "");
  if (list.length < tong)
    console.warn("[QLCV] Bỏ " + (tong - list.length) + "/" + tong + " phòng vì máy chủ không gửi ID phòng (D_DB_ID) — máy chủ đang chạy bản cũ, cần cập nhật server/src/rpc/legacyFields.js rồi khởi động lại.");
  // allDepartments là object khoá legacy (COL.D_*): đọc d.id/d.name là undefined ⇒ dropdown trống
  // (bẫy 2026-08-26 lần 2). Value PHẢI là D_DB_ID (id số) — preselect khi sửa dùng P_DEPT_ID.
  return '<option value="">-- Công việc chung --</option>' + list.map(d => "<option value=\"" + escapeHtmlAttr(d[COL.D_DB_ID]) + "\"" + (String(d[COL.D_DB_ID]) === value ? " selected" : "") + ">" + escapeHtml(d[COL.D_NAME]) + "</option>").join("");
}

/**
 * Nạp ứng viên phân công cho form đang mở và vẽ vào DOM.
 * singleLeaderSelect: nhiệm vụ (chọn MỘT leader); leadersBox + leadersInput: công việc/CV con.
 */
async function napUngVienPhanCong(opts) {
  const { deptValue = "", parentRef = "", supervisorSelect = null, singleLeaderSelect = null,
          leadersBox = null, leadersInput = null, selectedSupervisor = "", selectedLeaders = [],
          applyDefault = false } = opts;
  const query = [];
  if (deptValue) query.push("departmentId=" + encodeURIComponent(deptValue));
  if (parentRef) query.push("parentRef=" + encodeURIComponent(parentRef));
  let payload;
  try {
    payload = await restGet("/api/v1/departments/assignment-options" + (query.length ? "?" + query.join("&") : ""));
    if (!payload || typeof payload !== "object") payload = {};
  } catch {
    payload = {};
  }
  const supervisors = Array.isArray(payload.supervisors) ? payload.supervisors : [],
    leaders = Array.isArray(payload.leaders) ? payload.leaders : [];
  if (supervisorSelect) supervisorSelect.innerHTML = buildSupervisorOptionsHtml(supervisors, selectedSupervisor, applyDefault ? payload.defaultSupervisorId : "");
  if (singleLeaderSelect) {
    const chosen = String(selectedLeaders && selectedLeaders[0] != null ? selectedLeaders[0] : "").trim() || (applyDefault && payload.defaultLeaderId != null ? String(payload.defaultLeaderId) : "");
    singleLeaderSelect.innerHTML = "<option value=\"\">-- Không chọn --</option>" + leaders.map(l => "<option value=\"" + escapeHtmlAttr(l.id) + "\"" + (String(l.id) === chosen ? " selected" : "") + ">" + escapeHtml(l.name) + "</option>").join("");
  }
  if (leadersBox && leadersInput) {
    // «Chọn lại» khi đổi phòng: không có chọn gốc thì tick sẵn lãnh đạo MẶC ĐỊNH của phòng
    // (defaultLeaderId — Trưởng phòng), đúng như ô supervisor đã làm. Khi SỬA thì giữ chọn gốc.
    const coChonGoc = Array.isArray(selectedLeaders) && selectedLeaders.length > 0;
    const danhDau = coChonGoc ? selectedLeaders : applyDefault && payload.defaultLeaderId != null ? [payload.defaultLeaderId] : [];
    leadersBox.innerHTML = buildLeaderCheckboxesHtml(leaders, danhDau);
    capNhatLeaderInput(leadersBox, leadersInput);
    leadersBox.onchange = () => capNhatLeaderInput(leadersBox, leadersInput);
  }
}

// ===== Việc 4.6: ba hàm thoát ký tự dùng chung cho mọi chỗ dựng HTML bằng chuỗi =====
//
// Bản cũ chỉ có `escapeHtmlAttr` và thiếu dấu nháy đơn. Thiếu đúng ký tự đó là đủ để chiếm quyền,
// vì file này dựng rất nhiều nút dạng onclick="handleX('GIÁ TRỊ')": dấu " của thuộc tính vẫn nguyên
// nhưng chuỗi JS bên trong bị đóng sớm, phần sau trở thành lệnh. Nay thoát đủ 5 ký tự.
/**
 * Thoát 5 ký tự nguy hiểm. Dùng được cho CẢ nội dung lẫn thuộc tính: cùng một bộ ký tự, vì trong
 * thuộc tính thì `"` và `'` phá dấu bao, còn trong nội dung thì `<` `>` mở thẻ mới.
 */
function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** Tên cũ, giữ nguyên vì đã có sẵn nhiều nơi gọi. Hai hàm nay hoàn toàn như nhau. */
function escapeHtmlAttr(value) {
  return escapeHtml(value);
}
/**
 * Cho giá trị nằm trong chuỗi JS của thuộc tính on*: onclick="handleX('GIÁ TRỊ')".
 *
 * Chỗ này KHÔNG được dùng `escapeHtml` một mình, và đây là điểm dễ sai nhất của cả việc 4.6: bộ phân
 * tích HTML giải mã thực thể TRƯỚC khi JS nhìn thấy chuỗi, nên `'` thành `&#39;` rồi lại thành `'` —
 * chuỗi JS vẫn bị đóng sớm. Phải thoát theo kiểu JS trước (`\` và `'`), rồi mới thoát HTML; khi đó
 * `&#39;` do kẻ tấn công tự gõ cũng chỉ còn là chữ vì `&` đã thành `&amp;`.
 */
function escapeForInlineHandler(value) {
  return escapeHtml(String(value == null ? "" : value).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n"));
}
/**
 * Lọc địa chỉ trước khi nhét vào href/src. Chỉ cho qua http, https, mailto và đường dẫn tương đối;
 * mọi lược đồ khác trả về chuỗi rỗng — chặn `javascript:alert(1)` và `data:text/html,...`.
 *
 * Vì sao phải bỏ ký tự điều khiển rồi cắt khoảng trắng TRƯỚC khi so lược đồ: trình duyệt cũng bỏ
 * chúng khi đọc lược đồ, nên "java\nscript:" hay " javascript:" vẫn chạy được nếu so trên chuỗi
 * nguyên bản — đây là mẹo vượt bộ lọc cổ điển nhất của loại hàm này.
 * Kết quả vẫn phải qua `escapeHtml` nữa vì nó nằm trong một thuộc tính.
 */
function safeUrl(value) {
  const url = String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  if (!url) return "";
  if (/^(?:https?:|mailto:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "";
  return url;
}

// ===== GĐ1: giao diện tab "Cấu hình phòng" (chỉ Admin) =====
/** Tìm một phòng trong state theo Mã phòng. */
function findDepartmentById(departmentId) {
  const id = String(departmentId || "").trim();
  if (!id) return null;
  return (allDepartments || []).find(item => String(item[COL.D_ID] || "").trim() === id) || null;
}
/** Kiểm tra định dạng email đơn giản. Rỗng coi là hợp lệ (cho phép bỏ trống). */
function isValidEmailFormat(value) {
  const trimmed = String(value || "").trim();
  return trimmed === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
/** Tách chuỗi email cách nhau bằng ; hoặc , thành mảng đã lowercase. */
function parseEmailListClient(value) {
  return String(value || "").split(/[;,]/).map(item => item.trim().toLowerCase()).filter(item => item !== "");
}
/** Đổi email thành "Họ tên (email)" nếu tra được trong danh sách người dùng. */
function describeEmailList(value) {
  const emails = parseEmailListClient(value);
  if (emails.length === 0) return "<span class=\"text-gray-400\">—</span>";
  return emails.map(email => {
    const staff = (allStaff || []).find(item => String(item[COL.S_EMAIL] || "").trim().toLowerCase() === email);
    return staff ? "<span title=\"" + escapeHtmlAttr(email) + "\">" + escapeHtmlAttr(staff[COL.S_NAME] || email) + "</span>" : "<span class=\"text-amber-600\" title=\"Email này chưa có trong sheet Người dùng\">" + escapeHtmlAttr(email) + "</span>";
  }).join("<br>");
}
/** Số người đang thuộc một phòng (theo tên phòng). */
function countStaffInDepartment(departmentName) {
  const name = String(departmentName || "").trim();
  if (!name) return 0;
  return (allStaff || []).filter(staff => String(staff[COL.S_DEPT] || "").trim() === name).length;
}
/** Vẽ bảng phòng ban. Tự nạp bối cảnh phòng một lần nếu state còn rỗng. */
function renderDepartments() {
  const tbody = document.getElementById("departments-tbody");
  if (!tbody) return;
  const wrapRow = text => "<tr><td colspan=\"6\" class=\"px-3 py-4 text-center text-gray-500\">" + text + "</td></tr>";
  if (!isAuthenticated || !isAdmin()) {
    tbody.innerHTML = wrapRow("Chỉ Admin xem được cấu hình phòng.");
    return;
  }
  if ((!allDepartments || allDepartments.length === 0) && !departmentsAutoLoadTried) {
    departmentsAutoLoadTried = true, tbody.innerHTML = wrapRow("<i class=\"fas fa-spinner fa-spin mr-2\"></i>Đang tải..."), loadDepartmentContext(function () {
      renderDepartments();
    });
    return;
  }
  if (!allDepartments || allDepartments.length === 0) {
    tbody.innerHTML = wrapRow("Chưa có phòng nào. Bấm \"Thêm phòng\" để tạo.");
    return;
  }
  tbody.innerHTML = allDepartments.map(item => createDepartmentTableRow(item)).join("");
}
/** Một dòng của bảng phòng ban. */
function createDepartmentTableRow(department) {
  const departmentId = String(department[COL.D_ID] || "").trim(),
    departmentName = String(department[COL.D_NAME] || "").trim(),
    staffCount = countStaffInDepartment(departmentName),
    order = department[COL.D_ORDER] === "" || department[COL.D_ORDER] == null ? "" : department[COL.D_ORDER];
  return "\n        <tr class=\"hover:bg-gray-50 transition-colors\">\n            <td class=\"px-3 py-2 text-gray-500 whitespace-nowrap\">" + escapeHtmlAttr(departmentId) + (order === "" ? "" : " <span class=\"text-xs text-gray-400\">#" + escapeHtmlAttr(order) + "</span>") + "</td>\n            <td class=\"px-3 py-2 font-medium text-gray-900\">" + escapeHtmlAttr(departmentName) + " <span class=\"text-xs font-normal text-gray-500\">(" + escapeHtml(staffCount) + " người)</span></td>\n            <td class=\"px-3 py-2 text-gray-600\">" + describeEmailList(department[COL.D_DIRECTOR]) + "</td>\n            <td class=\"px-3 py-2 text-gray-600\">" + describeEmailList(department[COL.D_HEAD]) + "</td>\n            <td class=\"px-3 py-2 text-gray-600\">" + describeEmailList(department[COL.D_VICE]) + "</td>\n            <td class=\"px-3 py-2 text-center\">\n                <div class=\"flex justify-center gap-1\">\n                    <button type=\"button\" class=\"action-btn action-btn-edit\" title=\"Chỉnh sửa\" onclick=\"openDepartmentModal('" + escapeForInlineHandler(departmentId) + "')\">\n                        <i class=\"fas fa-edit text-xs\"></i>\n                    </button>\n                    <button type=\"button\" class=\"action-btn action-btn-delete\" title=\"Xóa\" onclick=\"confirmDeleteDepartment('" + escapeForInlineHandler(departmentId) + "')\">\n                        <i class=\"fas fa-trash text-xs\"></i>\n                    </button>\n                </div>\n            </td>\n        </tr>";
}
/**
 * GĐ1: <datalist> email người dùng để gợi ý khi gán Phó GĐ / Trưởng phòng / Phó phòng.
 * roleFilter: chuỗi con của cột Phân quyền (vd "phó giám đốc"). Không ai khớp thì gợi ý tất cả.
 */
function buildStaffEmailDatalist(listId, roleFilter) {
  // Cùng bẫy COL với dòng 1293: dữ liệu thật đặt "Đối tượng" là 'Nội bộ' nên đòi === 'Người dùng'
  // sẽ cho <datalist> RỖNG. Loại theo 'Nhà cung cấp' mới đúng câu chú thích trên.
  const users = (allStaff || []).filter(staff => String(staff[COL.S_OBJECT_TYPE] || "Nội bộ") !== "Nhà cung cấp" && String(staff[COL.S_EMAIL] || "").trim() !== ""),
    filtered = roleFilter ? users.filter(staff => String(staff[COL.S_ROLE] || "").toLowerCase().includes(roleFilter)) : users,
    source = filtered.length > 0 ? filtered : users;
  return "<datalist id=\"" + escapeHtml(listId) + "\">" + source.map(staff => "<option value=\"" + escapeHtmlAttr(String(staff[COL.S_EMAIL]).trim().toLowerCase()) + "\">" + escapeHtmlAttr((staff[COL.S_NAME] || "") + (staff[COL.S_DEPT] ? " — " + staff[COL.S_DEPT] : "")) + "</option>").join("") + "</datalist>";
}
/** GĐ1: HTML modal thêm/sửa phòng. */
function createDepartmentModal(isEdit, department) {
  const title = isEdit ? "Chỉnh sửa phòng" : "Thêm phòng mới",
    submitText = isEdit ? "Cập nhật" : "Thêm phòng",
    value = key => isEdit && department ? escapeHtmlAttr(department[key] || "") : "",
    nextOrder = isEdit && department ? escapeHtmlAttr(department[COL.D_ORDER] || "") : String((allDepartments || []).length + 1),
    staffCount = isEdit && department ? countStaffInDepartment(department[COL.D_NAME]) : 0;
  return "\n  <div id=\"department-modal\" class=\"modal\">\n      <div class=\"modal-content\">\n          <div class=\"flex items-center justify-between mb-6\">\n              <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(title) + "</h3>\n              <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n                  <i class=\"fas fa-times\"></i>\n              </button>\n          </div>\n\n          <form id=\"department-form\">\n              " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + value(COL.D_ID) + "\">" : "") + "\n\n              <div class=\"grid grid-cols-1 md:grid-cols-3 gap-4 mb-4\">\n                  <div class=\"form-group mb-0 md:col-span-2\">\n                      <label class=\"form-label required\">Tên phòng</label>\n                      <input type=\"text\" name=\"name\" class=\"form-input\" required maxlength=\"100\" value=\"" + value(COL.D_NAME) + "\">\n                      " + (isEdit && staffCount > 0 ? "<p class=\"text-xs text-amber-600 mt-1\">Đổi tên sẽ tự cập nhật cột Phòng của " + escapeHtml(staffCount) + " người đang thuộc phòng này.</p>" : "") + "\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Thứ tự</label>\n                      <input type=\"number\" name=\"order\" class=\"form-input\" min=\"1\" max=\"99\" value=\"" + nextOrder + "\">\n                      <p class=\"text-xs text-gray-500 mt-1\">Thứ tự hiện trên sơ đồ Gantt.</p>\n                  </div>\n              </div>\n\n              <div class=\"form-group\">\n                  <label class=\"form-label\">Email Phó Giám đốc phụ trách</label>\n                  <input type=\"text\" name=\"director\" class=\"form-input\" list=\"dept-director-list\" placeholder=\"pgd.a@...\" value=\"" + value(COL.D_DIRECTOR) + "\">\n                  " + buildStaffEmailDatalist("dept-director-list", "phó giám đốc") + "\n                  <p class=\"text-xs text-gray-500 mt-1\">Một Phó GĐ đứng tên ở nhiều phòng nghĩa là phụ trách nhiều phòng đó.</p>\n              </div>\n\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Email Trưởng phòng</label>\n                      <input type=\"text\" name=\"head\" class=\"form-input\" list=\"dept-staff-list\" placeholder=\"tp.a@...\" value=\"" + value(COL.D_HEAD) + "\">\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Email Phó phòng</label>\n                      <input type=\"text\" name=\"vice\" class=\"form-input\" list=\"dept-staff-list\" placeholder=\"pp.a@...; pp.b@...\" value=\"" + value(COL.D_VICE) + "\">\n                      <p class=\"text-xs text-gray-500 mt-1\">Nhiều người thì cách nhau dấu chấm phẩy.</p>\n                  </div>\n              </div>\n              " + buildStaffEmailDatalist("dept-staff-list", "") + "\n\n              <div class=\"form-group\">\n                  <label class=\"form-label\">Ghi chú</label>\n                  <textarea name=\"notes\" class=\"form-textarea\" rows=\"2\">" + (isEdit && department ? escapeHtmlAttr(department[COL.D_NOTES] || "") : "") + "</textarea>\n              </div>\n\n              <div id=\"department-validation-error\" class=\"hidden mb-4\"></div>\n\n              <div class=\"flex justify-end space-x-3 mt-6\">\n                  <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n                  <button type=\"submit\" class=\"btn-accent\">" + escapeHtml(submitText) + "</button>\n              </div>\n          </form>\n      </div>\n  </div>\n";
}
/**
 * GĐ1: mở modal thêm/sửa phòng. Không dùng openModal() vì openModal đẩy submit sang
 * handleAdd/handleEdit — hai hàm đó không biết loại "department".
 */
function openDepartmentModal(departmentId) {
  if (!isAuthenticated) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  if (!isAdmin()) {
    showToast("Chỉ Admin được sửa cấu hình phòng", "error");
    return;
  }
  const department = departmentId ? findDepartmentById(departmentId) : null;
  if (departmentId && !department) {
    showToast("Không tìm thấy phòng: " + departmentId, "error");
    return;
  }
  const existing = document.getElementById("department-modal");
  existing && existing.remove();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = createDepartmentModal(!!department, department), document.body.appendChild(wrapper.firstElementChild);
  const modal = document.getElementById("department-modal");
  modal.classList.add("active");
  const form = modal.querySelector("form");
  form && form.addEventListener("submit", function (event) {
    event.preventDefault(), handleSaveDepartment(department ? String(department[COL.D_ID] || "").trim() : "");
  }), modal.querySelectorAll(".close-modal").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault(), closeModal("department-modal");
    });
  }), modal.addEventListener("click", event => {
    event.target === modal && closeModal("department-modal");
  }), setTimeout(() => {
    const input = modal.querySelector("input[name=\"name\"]");
    input && input.focus();
  }, 120);
}
/** Hiện danh sách lỗi trong modal phòng. */
function showDepartmentValidationError(messages) {
  const el = document.getElementById("department-validation-error");
  if (!el) return;
  messages.length > 0 ? (el.innerHTML = messages.map(message => "<div class=\"text-red-600 text-sm\">" + escapeHtmlAttr(message) + "</div>").join(""), el.classList.remove("hidden")) : (el.innerHTML = "", el.classList.add("hidden"));
}
/**
 * GĐ1: lưu phòng. departmentId rỗng = thêm mới.
 * Backend nhận { name, director, head, vice, order, notes } — xem addDepartment trong Code.gs.
 */
function handleSaveDepartment(departmentId) {
  const form = document.getElementById("department-form");
  if (!form) return;
  const submitButton = form.querySelector("button[type=\"submit\"]"),
    formData = new FormData(form),
    read = key => String(formData.get(key) || "").trim(),
    data = {
      name: read("name"),
      director: read("director").toLowerCase(),
      head: read("head").toLowerCase(),
      vice: parseEmailListClient(read("vice")).join("; "),
      order: Number(read("order")) || 0,
      notes: read("notes")
    },
    errors = [];
  if (!data.name) errors.push("Tên phòng là bắt buộc.");
  const duplicate = (allDepartments || []).find(item => String(item[COL.D_NAME] || "").trim().toLowerCase() === data.name.toLowerCase() && String(item[COL.D_ID] || "").trim() !== departmentId);
  if (duplicate) errors.push("Phòng \"" + data.name + "\" đã tồn tại.");
  if (!isValidEmailFormat(data.director)) errors.push("Email Phó Giám đốc không đúng định dạng.");
  if (!isValidEmailFormat(data.head)) errors.push("Email Trưởng phòng không đúng định dạng.");
  parseEmailListClient(data.vice).forEach(email => {
    isValidEmailFormat(email) || errors.push("Email Phó phòng không đúng định dạng: " + email);
  });
  if (errors.length > 0) {
    showDepartmentValidationError(errors);
    return;
  }
  showDepartmentValidationError([]), setButtonLoading(submitButton, true);
  const runner = google.script.run.withSuccessHandler(function (response) {
    setButtonLoading(submitButton, false);
    if (!response) {
      showDepartmentValidationError(["Máy chủ không trả về dữ liệu. Kiểm tra license / email chữ hoa (xem §4.1 kế hoạch)."]);
      return;
    }
    if (!response.success) {
      showDepartmentValidationError([response.error || "Có lỗi xảy ra"]);
      return;
    }
    closeModal("department-modal"), showToast(departmentId ? "Đã cập nhật phòng \"" + data.name + "\"" : "Đã thêm phòng \"" + data.name + "\"", "success"), loadDepartmentContext(function () {
      renderDepartments(), departmentId && refreshData();
    });
  }).withFailureHandler(function (error) {
    setButtonLoading(submitButton, false), showDepartmentValidationError(["Lỗi: " + (error && error.message || error)]);
  });
  departmentId ? runner.updateDepartmentWithAuth(departmentId, data) : runner.addDepartmentWithAuth(data);
}
/**
 * GĐ1: xoá phòng. Chặn ngay ở giao diện nếu còn người thuộc phòng (backend cũng chặn lại
 * lần nữa trong deleteDepartment).
 */
function confirmDeleteDepartment(departmentId) {
  if (!isAuthenticated) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  if (!isAdmin()) {
    showToast("Chỉ Admin được xoá phòng", "error");
    return;
  }
  const department = findDepartmentById(departmentId);
  if (!department) {
    showToast("Không tìm thấy phòng: " + departmentId, "error");
    return;
  }
  const departmentName = String(department[COL.D_NAME] || "").trim(),
    staffCount = countStaffInDepartment(departmentName);
  if (staffCount > 0) {
    showToast("Còn " + staffCount + " người thuộc phòng \"" + departmentName + "\". Chuyển họ sang phòng khác trước khi xoá.", "error");
    return;
  }
  showConfirmDialog("Xoá phòng", "Xoá phòng \"" + departmentName + "\"? Cấu hình Phó GĐ phụ trách và Trưởng/Phó phòng của phòng này sẽ mất.", function () {
    showToast("Đang xoá phòng...", "info"), google.script.run.withSuccessHandler(function (response) {
      if (!response) {
        showToast("Máy chủ không trả về dữ liệu. Kiểm tra license / email chữ hoa.", "error");
        return;
      }
      response.success ? (showToast("Đã xoá phòng \"" + departmentName + "\"", "success"), loadDepartmentContext(function () {
        renderDepartments();
      })) : showToast(response.error || "Có lỗi xảy ra", "error");
    }).withFailureHandler(function (error) {
      showToast("Lỗi: " + (error && error.message || error), "error");
    }).deleteDepartmentWithAuth(departmentId);
  }, null, "danger", {
    confirmText: "Xoá phòng",
    iconClass: "fas fa-trash text-red-600 text-xl"
  });
}
function createStaffModal(isEdit, staff) {
  const text = isEdit ? "Chỉnh sửa đối tượng" : "Thêm đối tượng mới",
    text2 = isEdit ? "Cập nhật" : "Thêm đối tượng",
    staffObjectType = isEdit && staff[COL.S_OBJECT_TYPE] ? staff[COL.S_OBJECT_TYPE] : "Người dùng";
  return setTimeout(() => {
    const el = document.querySelector("#staff-modal input[name=\"name\"]"),
      el2 = document.querySelector("#staff-modal input[name=\"email\"]"),
      el3 = document.querySelector("#staff-modal input[name=\"password\"]");
    function validateInputs() {
      const trimmed = el.value.trim(),
        trimmed2 = el2 ? el2.value.trim() : "",
        staffId = isEdit ? staff[COL.S_ID] : null;
      if (trimmed) {
        const validation = validateStaffData(trimmed, trimmed2, isEdit, staffId);
        showStaffValidationError(validation);
        const el5 = document.querySelector("#staff-modal button[type=\"submit\"]");
        el5.disabled = validation.length > 0, el5.style.opacity = validation.length > 0 ? "0.5" : "1";
      }
    }
    if (el) el.addEventListener("blur", validateInputs);
    if (el2) el2.addEventListener("blur", validateInputs);
    const el4 = document.querySelector("select[name=\"objectType\"]"),
      els = document.querySelectorAll(".user-field"),
      els2 = document.querySelectorAll(".supplier-field");
    function toggleFields() {
      const el4Value = el4.value,
        staffNameLabelEl = document.getElementById("staff-name-label");
      if (el4Value === "Nhà cung cấp") {
        els.forEach(el5 => el5.classList.add("hidden")), els2.forEach(els22 => els22.classList.remove("hidden"));
        if (el3) el3.removeAttribute("required");
        if (staffNameLabelEl) staffNameLabelEl.textContent = "Nhà cung cấp *";
      } else {
        els.forEach(el5 => el5.classList.remove("hidden")), els2.forEach(els22 => els22.classList.add("hidden"));
        if (el3) el3.setAttribute("required", "");
        if (staffNameLabelEl) staffNameLabelEl.textContent = "Họ tên *";
      }
    }
    el4 && (el4.addEventListener("change", toggleFields), toggleFields());
  }, 100), "\n  <div id=\"staff-modal\" class=\"modal\">\n      <div class=\"modal-content\">\n          <div class=\"flex items-center justify-between mb-6\">\n              <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(text) + "</h3>\n              <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n                  <i class=\"fas fa-times\"></i>\n              </button>\n          </div>\n          \n          <form id=\"staff-form\">\n          <div id=\"staff-validation-error\" class=\"hidden mb-4\"></div>\n              " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + escapeHtml(staff[COL.S_ID]) + "\">" : "") + "\n\n              <!-- Row 1: Đối tượng | Họ tên -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Đối tượng</label>\n                      <select name=\"objectType\" class=\"form-select\">\n                          <option value=\"Người dùng\" " + (staffObjectType === "Người dùng" ? "selected" : "") + ">Người dùng</option>\n                          <option value=\"Nhà cung cấp\" " + (staffObjectType === "Nhà cung cấp" ? "selected" : "") + ">Nhà cung cấp</option>\n                      </select>\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\" id=\"staff-name-label\">Họ tên *</label>\n                      <input type=\"text\" name=\"name\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(staff[COL.S_NAME]) || "" : "") + "\">\n                  </div>\n              </div>\n              \n              <!-- Row 2: Email | Chức vụ -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 user-field\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Email</label>\n                      <input type=\"email\" name=\"email\" class=\"form-input\" value=\"" + (isEdit ? escapeHtml(staff[COL.S_EMAIL]) || "" : "") + "\">\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Chức vụ</label>\n                      <input type=\"text\" name=\"position\" class=\"form-input\" value=\"" + (isEdit ? escapeHtml(staff[COL.S_POS]) || "" : "") + "\">\n                  </div>\n              </div>\n              \n              <!-- Row 3: Phân quyền | Mật khẩu -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 user-field\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Phân quyền</label>\n                      <select name=\"role\" class=\"form-select\">\n                          <option value=\"Nhân viên\" " + (isEdit && staff[COL.S_ROLE] === "Nhân viên" ? "selected" : "selected") + ">Nhân viên</option>\n                          <option value=\"Quản lý\" " + (isEdit && staff[COL.S_ROLE] === "Quản lý" ? "selected" : "") + ">Quản lý</option>\n                          <option value=\"Phó Giám đốc\" " + (isEdit && staff[COL.S_ROLE] === "Phó Giám đốc" ? "selected" : "") + ">Phó Giám đốc</option>\n                          <option value=\"Admin\" " + (isEdit && staff[COL.S_ROLE] === "Admin" ? "selected" : "") + ">Admin</option>\n                      </select>\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Mật khẩu *</label>\n                      <input type=\"text\" name=\"password\" class=\"form-input\" required \n                              value=\"" + (isEdit ? escapeHtml(staff[COL.S_PASSWORD]) || "" : "") + "\"\n                              placeholder=\"Nhập mật khẩu\">\n                  </div>\n              </div>\n\n              <!-- Row 4: Phòng | Vai trò phòng -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 user-field\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Phòng</label>\n                      <select name=\"department\" class=\"form-select\">" + buildDepartmentOptions(isEdit && staff ? staff[COL.S_DEPT] : "") + "</select>\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Vai trò phòng</label>\n                      <select name=\"deptRole\" class=\"form-select\">" + buildDeptRoleOptions(isEdit && staff ? staff[COL.S_DEPT_ROLE] : "") + "</select>\n                  </div>\n              </div>\n\n              <!-- Ghi chú cho Nhà cung cấp  -->\n              <div class=\"form-group supplier-field hidden\">\n                  <label class=\"form-label\">Ghi chú</label>\n                  <textarea name=\"notes\" class=\"form-textarea\" rows=\"3\">" + (isEdit ? escapeHtml(staff[COL.S_NOTES]) || "" : "") + "</textarea>\n              </div>\n              \n              <div class=\"flex justify-end space-x-3 mt-6\">\n                  <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n                  <button type=\"submit\" class=\"btn-accent\">" + escapeHtml(text2) + "</button>\n              </div>\n          </form>\n      </div>\n  </div>\n";
}
function handleAdd(type, { luuNhap = false } = {}) {
  if (!isAuthenticated) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  if (type === "proposal") {
    const proposalSubmitBtnEl = document.getElementById("proposal-submit-btn");
    if (proposalSubmitBtnEl && proposalSubmitBtnEl.disabled) return;
    if (proposalSubmitBtnEl) proposalSubmitBtnEl.disabled = true;
    const data2 = {
      [COL.PR_TYPE]: document.getElementById("proposal-type")?.value || "Ngoài kế hoạch",
      [COL.PR_PID]: document.getElementById("proposal-project")?.value || "",
      [COL.PR_TID]: document.getElementById("proposal-task")?.value || "",
      [COL.PR_CONTENT]: document.getElementById("proposal-content")?.value || "",
      [COL.PR_URL]: document.getElementById("proposal-url")?.value || "",
      [COL.PR_SUPPLIER]: document.getElementById("proposal-supplier")?.value || ""
    };
    isAdmin() && (data2[COL.PR_STATUS] = document.getElementById("proposal-status")?.value || "Đề xuất mới", data2[COL.PR_NOTE] = document.getElementById("proposal-note")?.value || "");
    const text3 = "TEMP_" + Date.now();
    addOptimisticUpdate("proposal", data2, text3), closeModal("proposal-modal"), showToast("Đề nghị đang được tạo...", "info"), google.script.run.withSuccessHandler(function (response) {
      if (response.success) {
        const proposalIndex = allProposals.findIndex(proposal => proposal[COL.PR_ID] === text3);
        if (proposalIndex !== -1) {
          allProposals[proposalIndex][COL.PR_ID] = response.id || response.proposalId;
          if (response.date) allProposals[proposalIndex][COL.PR_DATE] = new Date(response.date);
        }
        showToast("Đề nghị đã được tạo thành công!", "success"), renderProposals(), updateProposalCounts();
      } else removeOptimisticUpdate("proposal", text3), showToast(response.error || "Có lỗi xảy ra", "error");
    }).withFailureHandler(function (error) {
      removeOptimisticUpdate("proposal", text3), showToast("Lỗi: " + error.message, "error");
    }).addProposalWithAuth(data2);
    return;
  }
  const el = document.getElementById(type + "-form"),
    el2 = el.querySelector("button[type=\"submit\"]"),
    formData = new FormData(el);
  let data = {};
  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }
  if (type === "task") {
    const els = el.querySelectorAll("input[disabled], textarea[disabled], select[disabled]");
    els.forEach(el3 => {
      el3.name && el3.value && (data[el3.name] = el3.value);
    });
  }
  if (type === "app") {
    const els = el.querySelectorAll("input[name=\"app-permissions\"]:checked"),
      mapped = Array.from(els).map(item => item.value);
    data[COL.A_PERMISSIONS] = mapped.join(", ");
  }
  // «Lưu nháp» (012) chỉ có nghĩa với công việc/nhiệm vụ — cầu RPC chuyển thẳng khoá này thành
  // `saveAsDraft` của REST (rpc/table.js). Vai nào tạo cũng lưu nháp được (người dùng chốt cả 3 cấp).
  if (luuNhap && (type === "project" || type === "task")) data.saveAsDraft = true;
  const text = "TEMP_" + Date.now();
  addOptimisticUpdate(type, data, text), closeModal(type + "-modal"), showToast(type.charAt(0).toUpperCase() + type.slice(1) + " đang được tạo...", "info"), setButtonLoading(el2, true);
  let text2 = "";
  if (type === "project") text2 = "addProjectWithAuth";else {
    if (type === "task") text2 = "addTaskWithAuth";else {
      if (type === "staff") text2 = "addStaffWithAuth";else {
        if (type === "notification") text2 = "addNotificationWithAuth";else {
          if (type === "proposal") text2 = "addProposalWithAuth";else {
            if (type === "app") text2 = "addApp";
          }
        }
      }
    }
  }
  google.script.run.withSuccessHandler(function (response) {
    setButtonLoading(el2, false);
    if (response.success) {
      if (type === "project") {
        const projectIndex = allProjects.findIndex(project => project[COL.P_ID] === text);
        if (projectIndex !== -1) allProjects[projectIndex][COL.P_ID] = response.projectId;
      } else {
        if (type === "task") {
          const taskIndex = allTasks.findIndex(task => task[COL.T_ID] === text);
          if (taskIndex !== -1) allTasks[taskIndex][COL.T_ID] = response.taskId;
        } else {
          if (type === "staff") {
            const staffIndex = allStaff.findIndex(staff => staff[COL.S_ID] === text);
            staffIndex !== -1 && (allStaff[staffIndex][COL.S_ID] = response.staffId, renderStaff());
          } else {
            if (type === "app") {
              const appIndex = allApps.findIndex(app => app[COL.A_ID] === text);
              appIndex !== -1 && (allApps[appIndex][COL.A_ID] = response.id), renderApps();
            }
          }
        }
      }
      showToast(type.charAt(0).toUpperCase() + type.slice(1) + " đã được tạo thành công!", "success"), type !== "staff" && setTimeout(() => refreshData(), 1000);
    } else showToast(response.error || "Có lỗi xảy ra", "error");
  }).withFailureHandler(function (error) {
    setButtonLoading(el2, false), showToast("Lỗi: " + error.message, "error");
  })[text2](data);
}
function handleEdit(type, proposal) {
  if (!isAuthenticated) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  if (type === "proposal") {
    const proposalSubmitBtnEl = document.getElementById("proposal-submit-btn");
    if (proposalSubmitBtnEl && proposalSubmitBtnEl.disabled) return;
    if (proposalSubmitBtnEl) proposalSubmitBtnEl.disabled = true;
    const proposalId = proposal[COL.PR_ID],
      data2 = {
        [COL.PR_TYPE]: document.getElementById("proposal-type")?.value || "Ngoài kế hoạch",
        [COL.PR_PID]: document.getElementById("proposal-project")?.value || "",
        [COL.PR_TID]: document.getElementById("proposal-task")?.value || "",
        [COL.PR_CONTENT]: document.getElementById("proposal-content")?.value || "",
        [COL.PR_URL]: document.getElementById("proposal-url")?.value || "",
        [COL.PR_SUPPLIER]: document.getElementById("proposal-supplier")?.value || ""
      };
    isAdmin() && (data2[COL.PR_STATUS] = document.getElementById("proposal-status")?.value || "Đề xuất mới", data2[COL.PR_NOTE] = document.getElementById("proposal-note")?.value || "");
    updateOptimisticUpdate("proposal", proposalId, data2), closeModal("proposal-modal"), showToast("Đề nghị đang được cập nhật...", "info"), google.script.run.withSuccessHandler(function (response) {
      response.success ? (showToast("Đề nghị đã được cập nhật!", "success"), renderProposals(), updateProposalCounts()) : (updateOptimisticUpdate("proposal", proposalId, proposal), showToast(response.error || "Có lỗi xảy ra", "error"));
    }).withFailureHandler(function (error) {
      updateOptimisticUpdate("proposal", proposalId, proposal), showToast("Lỗi: " + error.message, "error");
    }).updateProposalWithAuth(proposalId, data2);
    return;
  }
  const el = document.getElementById(type + "-form"),
    el2 = el.querySelector("button[type=\"submit\"]"),
    formData = new FormData(el);
  let data = {};
  for (let [key, value] of formData.entries()) {
    if (key !== "id") data[key] = value;
  }
  if (type === "task") {
    const els = el.querySelectorAll("input[disabled], textarea[disabled], select[disabled]");
    els.forEach(el3 => {
      el3.name && el3.name !== "id" && el3.value && (data[el3.name] = el3.value);
    });
  }
  if (type === "app") {
    const els = el.querySelectorAll("input[name=\"app-permissions\"]:checked"),
      mapped = Array.from(els).map(item => item.value);
    data[COL.A_PERMISSIONS] = mapped.join(", ");
  }
  const id = formData.get("id");
  updateOptimisticUpdate(type, id, data), closeModal(type + "-modal"), showToast(type.charAt(0).toUpperCase() + type.slice(1) + " đang được cập nhật...", "info"), setButtonLoading(el2, true);
  let text = "";
  if (type === "project") text = "updateProjectWithAuth";else {
    if (type === "task") text = "updateTaskWithAuth";else {
      if (type === "staff") text = "updateStaffWithAuth";else {
        if (type === "proposal") text = "updateProposalWithAuth";else {
          if (type === "app") text = "updateApp";
        }
      }
    }
  }
  google.script.run.withSuccessHandler(function (response) {
    setButtonLoading(el2, false);
    if (response.success) {
      showToast(type.charAt(0).toUpperCase() + type.slice(1) + " đã được cập nhật thành công!", "success");
      if (type === "project") google.script.run.withSuccessHandler(response2 => {
        allProjects = response2, renderProjects(), renderProjectStats(), renderStats(), renderProjectProgressChart(), renderProjectComparisonChart();
      }).getProjects();else {
        if (type === "task") google.script.run.withSuccessHandler(response2 => {
          allTasks = response2, renderTasks(), renderTaskStats(), renderStats(), renderPriorityTasksMini(), renderProjects(), renderProjectStats();
        }).getTasks();else {
          if (type === "staff") google.script.run.withSuccessHandler(response2 => {
            allStaff = response2, renderStaff();
          }).getStaffList();else type === "app" && renderApps();
        }
      }
    } else updateOptimisticUpdate(type, id, proposal), showToast(response.error || "Có lỗi xảy ra", "error");
  }).withFailureHandler(function (error) {
    setButtonLoading(el2, false), updateOptimisticUpdate(type, id, proposal), showToast("Lỗi: " + error.message, "error");
  })[text](id, data);
}
/**
 * Câu từ chối của máy chủ có phải «Xoá phải được duyệt» hay không (013).
 *
 * Nhận biết bằng chuỗi vì đường xoá đi qua cầu RPC, nơi chỉ mang `error` là một câu chữ — không có
 * `details.canXinXoa`. Chuỗi khớp là phần ổn định nhất của câu (`xoaPhaiQuaDuyet` ở
 * approvals/rules.js) và có test canh, nên đổi câu ở server là test đỏ ngay.
 */
function phaiXinXoa(thongDiep) {
  return String(thongDiep || "").includes("Xin xoá");
}
function confirmDelete(type, id, name) {
  if (!isAuthenticated) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  const deleteConfirmModalEl = document.getElementById("delete-confirm-modal"),
    deleteConfirmMessageEl = document.getElementById("delete-confirm-message"),
    confirmBtn = document.getElementById("delete-confirm-btn"),
    deleteCancelBtnEl = document.getElementById("delete-cancel-btn"),
    data = {
      project: "công việc",
      task: "nhiệm vụ",
      staff: "cán bộ",
      proposal: "đề nghị",
      app: "ứng dụng"
    };
  deleteConfirmMessageEl.textContent = "Bạn có chắc chắn muốn xóa " + (data[type] || type) + " \"" + name + "\"?", deleteConfirmModalEl.classList.remove("hidden"), deleteConfirmModalEl.classList.add("flex");
  const el = confirmBtn.cloneNode(true),
    el2 = deleteCancelBtnEl.cloneNode(true);
  confirmBtn.parentNode.replaceChild(el, confirmBtn), deleteCancelBtnEl.parentNode.replaceChild(el2, deleteCancelBtnEl), el2.addEventListener("click", () => {
    deleteConfirmModalEl.classList.add("hidden"), deleteConfirmModalEl.classList.remove("flex");
  }), el.addEventListener("click", () => {
    deleteConfirmModalEl.classList.add("hidden"), deleteConfirmModalEl.classList.remove("flex");
    const deleteBtn = document.querySelector("[data-type=\"" + type + "\"][data-id=\"" + id + "\"].delete-btn");
    if (deleteBtn) setButtonLoading(deleteBtn, true);
    showToast((data[type] || type) + " đang được xóa...", "info");
    let text = "";
    if (type === "project") text = "deleteProjectWithAuth";else {
      if (type === "task") text = "deleteTaskWithAuth";else {
        if (type === "staff") text = "deleteStaffWithAuth";else {
          if (type === "proposal") text = "deleteProposalWithAuth";else {
            if (type === "app") text = "deleteApp";
          }
        }
      }
    }
    ["proposal", "project", "task", "staff", "app"].includes(type) && text && removeOptimisticUpdate(type, id);
    if (!text) {
      showToast("Loại không hỗ trợ xóa", "error");
      if (deleteBtn) setButtonLoading(deleteBtn, false);
      return;
    }
    google.script.run.withSuccessHandler(function (response) {
      if (deleteBtn) setButtonLoading(deleteBtn, false);
      if (!response.success && phaiXinXoa(response.error) && (type === "project" || type === "task")) {
        // Vai này bị ghi đè «Xoá phải qua duyệt» (013) ⇒ không phải lỗi, mà là đổi luồng.
        hoiVaXinXoa(type, id, name);
        return;
      }
      response.success ? (showToast((data[type] || type) + " đã được xóa thành công!", "success"), type === "proposal" && updateProposalCounts()) : (showToast(response.error || "Có lỗi xảy ra", "error"), type === "proposal" ? google.script.run.withSuccessHandler(response2 => {
        allProposals = response2, renderProposals();
      }).getProposals() : refreshData());
    }).withFailureHandler(function (error) {
      if (deleteBtn) setButtonLoading(deleteBtn, false);
      const loi = (error && error.message) || String(error || "");
      if (phaiXinXoa(loi) && (type === "project" || type === "task")) {
        hoiVaXinXoa(type, id, name);
        return;
      }
      showToast("Lỗi: " + loi, "error"), type === "proposal" ? google.script.run.withSuccessHandler(response => {
        allProposals = response, renderProposals();
      }).getProposals() : refreshData();
    })[text](id);
  });
}
function refreshData() {
  if (!isAuthenticated) return;
  google.script.run.withSuccessHandler(function (response) {
    response.success ? handleSuccessfulLogin(response) : showToast(response.error || "Lỗi khi tải dữ liệu", "error");
  }).withFailureHandler(function (error) {
    showToast("Lỗi khi tải dữ liệu: " + error.message, "error");
  }).getDataForUser();
}
function setButtonLoading(el, isLoading) {
  if (!el) return;
  isLoading ? (el.classList.add("loading"), el.disabled = true, !el.dataset.originalContent && (el.dataset.originalContent = el.innerHTML), el.innerHTML = "") : (el.classList.remove("loading"), el.disabled = false, el.dataset.originalContent && (el.innerHTML = el.dataset.originalContent));
}
function filterCards(selector, searchTerm) {
  const els = document.querySelectorAll(selector);
  els.forEach(el => {
    const lower = el.textContent.toLowerCase(),
      lower2 = el.dataset.id.toLowerCase(),
      hasMatch = lower.includes(searchTerm) || lower2.includes(searchTerm);
    el.style.display = hasMatch ? "block" : "none";
  });
}
/**
 * Việc 5.6 — một mục có đang chờ duyệt không.
 *
 * Cùng một hàm cho cả dự án (cấp 1) và nhiệm vụ (cấp 2/3) vì hai bảng dùng CHUNG tên cột
 * "Trạng thái duyệt" (COL.P_APPROVAL === COL.T_APPROVAL). Máy chủ trả chuỗi này nguyên văn ở
 * `projectToLegacy` / `taskToLegacy`; dữ liệu cũ chưa có cột duyệt thì rỗng ⇒ không phải chờ duyệt.
 */
/**
 * Nút «Lưu nháp» (012, Vòng 13): «lưu thôi chưa gửi đi duyệt, chưa được tính là công việc».
 *
 * Chỉ hiện khi TẠO MỚI. Vai admin / Phó Giám đốc tạo là «Đã duyệt» ngay (họ chính là người duyệt)
 * nên vẫn cho lưu nháp — người dùng chốt «cả 3 cấp» — nhưng nút không hiện ở form SỬA: một mục đã
 * gửi đi thì đường về bản nháp là «Trả lại để sửa» của người duyệt, không phải nút lưu.
 */
function buildLuuNhapNutHtml(isEdit) {
  if (isEdit) return "";
  return (
    "<button type=\"submit\" data-nhap=\"1\" class=\"btn-secondary\" title=\"" +
    escapeHtmlAttr("Lưu lại để sửa tiếp — chưa gửi ai duyệt, chưa vào thống kê") +
    "\"><i class=\"fas fa-pen-nib mr-2\"></i>" + escapeHtml("Lưu nháp") + "</button>"
  );
}
/**
 * CHẾ ĐỘ DUYỆT — CHỈ ĐỌC của modal chi tiết (012, Vòng 13).
 *
 * Người duyệt bấm «Xem chi tiết» trên hộp chờ duyệt để đọc CẢ CÂY (công việc cấp 1 → công việc con
 * → nhiệm vụ) trước khi ký một lần cho cả cây. Ở màn đó KHÔNG cho sửa gì: người duyệt đọc rồi
 * quyết, muốn đổi nội dung thì bấm «Trả lại để sửa» cho người lập.
 *
 * Là một cờ toàn cục chứ không phải tham số vì hàm dựng modal nằm ở `project-details.js` và gọi
 * xuống nhiều builder con (`coQuyenSuaCongViecCon`, `createSubworkFromWorkButtonHtml`…); luồn tham
 * số qua từng tầng thì phải sửa mọi chữ ký, mà chỉ để trả lời một câu hỏi duy nhất.
 * Máy chủ vẫn là rào chặn cuối: mở nút bằng tay vẫn không ghi được (`coSuaDuocKhiChoDuyet`).
 */
let cheDoDuyetChiDoc = false;
function laCheDoDuyetChiDoc() {
  return cheDoDuyetChiDoc === true;
}
/** Mở modal chi tiết công việc ở chế độ chỉ đọc, và tự tắt cờ khi modal đóng. */
function moChiTietCheDoDuyet(maCongViec, tenCongViec) {
  cheDoDuyetChiDoc = true;
  showProjectDetailsModal(maCongViec, tenCongViec);
  const modal = document.getElementById("project-details-modal");
  if (!modal) {
    cheDoDuyetChiDoc = false;
    return;
  }
  // Tắt cờ khi modal bị bỏ khỏi DOM (closeModal xoá node sau 300ms) — không tắt thì lần mở modal
  // sau bằng đường thường vẫn còn chỉ-đọc, và người dùng mất nút sửa mà không hiểu vì sao.
  modal.querySelectorAll(".close-modal").forEach((nut) => {
    nut.addEventListener("click", () => {
      cheDoDuyetChiDoc = false;
    });
  });
}
function isPendingApproval(row) {
  return (row && row[COL.P_APPROVAL]) === "Chờ duyệt";
}
/**
 * Bản NHÁP (012, Vòng 13): «lưu thôi chưa gửi đi duyệt, chưa được tính là công việc». Máy chủ chỉ
 * trả bản nháp cho NGƯỜI LẬP và admin (`thayDuocNhap` — approvals/rules.js), nên hễ dòng này tới
 * được trình duyệt thì người đang xem có quyền thấy nó; ở đây chỉ lo vẽ.
 */
function laNhap(row) {
  return (row && row[COL.P_APPROVAL]) === "Nháp";
}
/**
 * Mục này có YÊU CẦU XOÁ đang chờ duyệt không (013, Vòng 13 đợt 2).
 *
 * Khác `laNhap`/`isPendingApproval` ở chỗ: hai hàm kia đọc `approval_status` (một trục), hàm này
 * đọc cột riêng `P_XOA_BOI` — «xin xoá» là chiều ĐỘC LẬP với luồng duyệt nội dung, nên một mục
 * hoàn toàn có thể vừa «Đã duyệt» vừa «đang xin xoá». Xem đầu migration 013.
 */
function laXinXoa(row) {
  const nguoi = row && (row[COL.P_XOA_BOI] || row[COL.T_XOA_BOI]);
  return String(nguoi || "").trim() !== "";
}
/**
 * Nhãn ĐỎ «Đang xin xoá» — chuỗi HTML đã thoát.
 *
 * Người dùng chốt: mục đang xin xoá VẪN hiện bình thường và VẪN vào thống kê, chỉ thêm nhãn này.
 * Chưa ai đồng ý thì việc vẫn phải làm; ẩn ngay thì số liệu nhảy xuống rồi nhảy lại khi bị từ chối,
 * và tệ hơn là người ta có thể «tự ẩn» việc của mình bằng cách xin xoá.
 */
function buildXinXoaBadge(row) {
  if (!laXinXoa(row)) return "";
  const nguoi = String((row && (row[COL.P_XOA_BOI] || row[COL.T_XOA_BOI])) || "").trim();
  const lyDo = String((row && (row[COL.P_XOA_LY_DO] || row[COL.T_XOA_LY_DO])) || "").trim();
  const tieuDe =
    "Đang chờ duyệt yêu cầu XOÁ — người xin: " + nguoi + (lyDo ? " · Lý do: " + lyDo : "");
  return (
    "<span class=\"status-badge status-delete-req ml-1\" title=\"" +
    escapeHtmlAttr(tieuDe) +
    "\"><i class=\"fas fa-trash-can-arrow-up mr-1\"></i>" +
    escapeHtml("Đang xin xoá") +
    "</span>"
  );
}
/** Nhãn XÁM «Nháp» + nút «Gửi duyệt» — chuỗi HTML đã thoát, dán thẳng vào innerHTML được. */
function nhapBadge(row) {
  if (!laNhap(row)) return "";
  const ma = (row && row[COL.P_ID]) || "";
  return (
    "<span class=\"status-badge status-draft ml-1\" title=\"" +
    escapeHtmlAttr("Bản nháp — chỉ bạn thấy, chưa gửi ai duyệt và chưa vào thống kê") +
    "\"><i class=\"fas fa-pen-nib mr-1\"></i>" + escapeHtml("Nháp") + "</span>" +
    "<button type=\"button\" class=\"gui-duyet-btn status-badge ml-1 text-blue-600 hover:underline\" data-entity=\"work\" data-id=\"" +
    escapeHtmlAttr(ma) +
    "\" title=\"" + escapeHtmlAttr("Gửi cả cây (công việc con + nhiệm vụ bên trong) đi duyệt") +
    "\"><i class=\"fas fa-paper-plane mr-1\"></i>" + escapeHtml("Gửi duyệt") + "</button>"
  );
}
/**
 * Nhãn vàng "Chờ duyệt" — CHUỖI HTML đã thoát, dán được thẳng vào innerHTML.
 *
 * Trả về chuỗi rỗng khi mục không chờ duyệt, để chỗ gọi chỉ cần nối chuỗi mà không phải rẽ nhánh.
 * Nội dung là hằng số của chương trình, không phải dữ liệu người dùng, nhưng vẫn đi qua
 * `escapeHtml` cho đồng nhất với 474 giá trị còn lại (việc 4.6) — thêm một chỗ "chắc chắn an toàn
 * nên bỏ qua" là thêm một chỗ để lần sau ai đó nhét biến vào mà không ai để ý.
 */
function pendingApprovalBadge(row) {
  if (!isPendingApproval(row)) return "";
  // Cho người duyệt biết ai sẽ duyệt: tên người duyệt do máy chủ trả (COL.P_APPROVER).
  const nguoiDuyet = (row && row[COL.P_APPROVER]) || "";
  const tieuDe = nguoiDuyet
    ? "Đang chờ duyệt — Người duyệt: " + nguoiDuyet
    : "Đang chờ duyệt — Người duyệt: Phó Giám đốc phụ trách phòng";
  return "<span class=\"status-badge status-awaiting ml-1\" title=\"" + escapeHtmlAttr(tieuDe) + "\"><i class=\"fas fa-hourglass-half mr-1\"></i>" + escapeHtml("Chờ duyệt") + "</span>";
}
function getStatusClass(status) {
  const lower = status.toLowerCase();
  if (lower.includes("hoàn thành")) return "status-completed";
  if (lower.includes("đang")) return "status-active";
  if (lower.includes("quá hạn")) return "status-overdue";
  if (lower.includes("tạm dừng")) return "status-paused";
  if (lower.includes("hủy bỏ")) return "status-canceled";
  return "status-pending";
}
function getStatusIconClass(status) {
  const lower = (status || "").toLowerCase();
  if (lower.includes("hoàn thành")) return "text-green-500";
  if (lower.includes("đang")) return "text-blue-500";
  if (lower.includes("tạm dừng")) return "text-yellow-500";
  if (lower.includes("hủy bỏ")) return "text-red-500";
  return "text-gray-500";
}
function getPriorityClass(priority) {
  const lower = priority.toLowerCase();
  if (lower.includes("cao")) return "priority-high";
  if (lower.includes("thấp")) return "priority-low";
  return "priority-medium";
}
function isTaskOverdue(dueDate) {
  if (!dueDate) return false;
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const date = new Date(dueDate);
    return date.setHours(0, 0, 0, 0), date < now;
  } catch (err) {
    return false;
  }
}
function formatDateForDisplay(value, includeTime = false) {
  if (!value) return "N/A";
  try {
    const date = parseDateString(value);
    if (isNaN(date.getTime())) return value;
    const padded = String(date.getDate()).padStart(2, "0"),
      padded2 = String(date.getMonth() + 1).padStart(2, "0"),
      fullYear = date.getFullYear();
    let text = padded + "/" + padded2 + "/" + fullYear;
    if (includeTime) {
      const padded3 = String(date.getHours()).padStart(2, "0"),
        padded4 = String(date.getMinutes()).padStart(2, "0");
      text += " " + padded3 + ":" + padded4;
    }
    return text;
  } catch (err) {
    return value;
  }
}
function parseDateString(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }
  return new Date(value);
}
function formatDateForInput(value) {
  if (!value) return "";
  try {
    const date = parseDateString(value);
    if (isNaN(date.getTime())) return "";
    const fullYear = date.getFullYear(),
      padded = String(date.getMonth() + 1).padStart(2, "0"),
      padded2 = String(date.getDate()).padStart(2, "0");
    return fullYear + "-" + padded + "-" + padded2;
  } catch (err) {
    return "";
  }
}
function showLoading(message = "Đang xử lý...") {
  const loadingOverlayEl = document.getElementById("loading-overlay");
  loadingOverlayEl && loadingOverlayEl.classList.remove("hidden");
}
function hideLoading() {
  const loadingOverlayEl = document.getElementById("loading-overlay");
  loadingOverlayEl && loadingOverlayEl.classList.add("hidden");
}
function showToast(message, type = "info") {
  const toastContainerEl = document.getElementById("toast-container");
  if (!toastContainerEl) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  const result = {
    success: "fa-check-circle text-green-500",
    error: "fa-exclamation-circle text-red-500",
    info: "fa-info-circle text-blue-500"
  };
  el.innerHTML = "\n    <div class=\"flex items-center space-x-3\">\n        <i class=\"fas " + (escapeHtml(result[type]) || escapeHtml(result.info)) + "\"></i>\n        <span class=\"flex-1\">" + escapeHtml(message) + "</span>\n        <button onclick=\"this.parentElement.parentElement.remove()\" class=\"text-gray-400 hover:text-gray-600\">\n            <i class=\"fas fa-times\"></i>\n        </button>\n    </div>\n", toastContainerEl.appendChild(el), setTimeout(() => el.classList.add("show"), 100), setTimeout(() => {
    el.classList.remove("show"), setTimeout(() => el.remove(), 300);
  }, 5000);
}
function getUserAllowedProjects() {
  if (isAdmin()) return allProjects;
  // 2026-08-27: Phó Giám đốc thấy công việc của CÁC PHÒNG MÌNH PHỤ TRÁCH. `visibleDepartments` là
  // danh sách TÊN phòng do `getDepartmentContext()` trả về và với vai này chính là các phòng phụ
  // trách (bootstrap/service.js), nên đây là bản sao đúng phạm vi của máy chủ, không phải toàn cục.
  // Chưa nạp xong ngữ cảnh phòng (mảng rỗng) thì rơi về luật cũ, không mở rộng bừa.
  if (laQuanTriTrongPhamVi() && Array.isArray(visibleDepartments) && visibleDepartments.length > 0) {
    const trongPham = allProjects.filter(project => visibleDepartments.includes(project[COL.P_DEPT]));
    if (trongPham.length > 0) return trongPham;
  }
  // Vòng 12e: Trưởng phòng / Phó phòng thấy công việc của PHÒNG MÌNH — ma trận §6 cho họ
  // work:read/update/delete theo phòng và máy chủ (`inScope` case 'Trưởng phòng'/'Phó phòng') đã
  // trả về đủ; thiếu nhánh này thì họ rơi xuống luật cuối «việc mình đứng tên quản lý hoặc được
  // giao» ⇒ chỉ thấy 1–2 công việc và rất dễ chẩn đoán nhầm thành lỗi bộ lọc tháng.
  // Phòng lấy từ `tenPhongTaiKhoan()` — KHÔNG dùng `visibleDepartments` (kênh riêng của Phó GĐ,
  // bẫy §13.5). Bối cảnh phòng chưa về (tên rỗng) ⇒ rơi về luật cũ, không nới bừa; `
  // loadDepartmentContext` đã vẽ lại cho TP/PP từ Vòng 12d nên lần vẽ sau là đúng.
  if (laLanhDaoPhong()) {
    const phongCuaToi = String(tenPhongTaiKhoan() || "").trim();
    if (phongCuaToi !== "") {
      return allProjects.filter(project => String(project[COL.P_DEPT] || "").trim() === phongCuaToi);
    }
  }
  if (isManager()) {
    const filteredProjects2 = allProjects.filter(project => project[COL.P_MANAGER] === currentUser.name),
      filteredTasks2 = allTasks.filter(task => task[COL.T_ASSIGNEE] === currentUser.name),
      values2 = [...new Set(filteredTasks2.map(filteredTasks22 => filteredTasks22[COL.T_PID]))],
      set2 = new Set([...filteredProjects2.map(filteredProjects22 => filteredProjects22[COL.P_ID]), ...values2]);
    return allProjects.filter(project => set2.has(project[COL.P_ID]));
  }
  const filteredTasks = allTasks.filter(task => task[COL.T_ASSIGNEE] === currentUser.name),
    values = [...new Set(filteredTasks.map(filteredTask => filteredTask[COL.T_PID]))],
    filteredProjects = allProjects.filter(project => project[COL.P_MANAGER] === currentUser.name),
    mappedFilteredProjects = filteredProjects.map(filteredProject => filteredProject[COL.P_ID]),
    set = new Set([...values, ...mappedFilteredProjects]);
  return allProjects.filter(project => set.has(project[COL.P_ID]));
}
function canUserCreateTask() {
  if (laQuanTriTrongPhamVi() || isManager()) return true;
  if (currentUser) {
    const filteredProjects = allProjects.filter(project => project[COL.P_MANAGER] === currentUser.name);
    if (filteredProjects.length > 0) return true;
    if (allTasks) {
      const filteredTasks = allTasks.filter(task => task[COL.T_ASSIGNEE] === currentUser.name);
      return filteredTasks.length > 0;
    }
  }
  return false;
}
function canUserCreateSubwork() {
  if (isAdmin() || isManager()) return true;
  if (isDeputyDirectorUser || isDepartmentHeadUser) return true;
  if (!currentUser || !currentUser.role) return false;
  const role = String(currentUser.role);
  return role === "Phó Giám đốc" || role === "Trưởng phòng" || role === "Phó phòng" || role === "Quản lý công việc";
}
function createSubworkFromWorkButtonHtml(projectId, projectName, className, withLabel) {
  if (!canUserCreateSubwork()) return "";
  return "<button type=\"button\" class=\"" + escapeHtml(className) + " add-subwork-from-work-btn\" data-project-id=\"" + escapeHtml(projectId) + "\" data-project-name=\"" + escapeHtml(projectName) + "\" title=\"+ công việc con\">" + (withLabel ? "<i class=\"fas fa-layer-group mr-1\"></i>+ công việc con" : "<i class=\"fas fa-layer-group\"></i>") + "</button>";
}
function createTaskFromSubworkButtonHtml(task, className) {
  if (Number(task && task[COL.T_LEVEL]) !== 2 || !canUserCreateTask()) return "";
  const project = allProjects.find(project2 => project2[COL.P_ID] === task[COL.T_PID]),
    projectName = project ? project[COL.P_NAME] : "";
  return "<button type=\"button\" class=\"" + escapeHtml(className) + " add-task-from-subwork-btn\" data-project-id=\"" + escapeHtml(task[COL.T_PID] || "") + "\" data-project-name=\"" + escapeHtml(projectName) + "\" data-parent-id=\"" + escapeHtml(task[COL.T_ID] || "") + "\" title=\"Thêm nhiệm vụ vào công việc con này\"><i class=\"fas fa-plus\"></i></button>";
}
function createNotificationModal(isEdit, notification) {
  return "\n    <div id=\"notification-modal\" class=\"modal\">\n      <div class=\"modal-content\">\n        <div class=\"flex items-center justify-between mb-6\">\n          <h3 class=\"text-xl font-bold text-gray-900\">Tạo thông báo mới</h3>\n          <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n            <i class=\"fas fa-times\"></i>\n          </button>\n        </div>\n        \n        <form id=\"notification-form\">\n          <div class=\"form-group\">\n            <label class=\"form-label\">Nội dung thông báo *</label>\n            <textarea name=\"content\" class=\"form-textarea\" required placeholder=\"Nhập nội dung thông báo...\"></textarea>\n          </div>\n          \n          <div class=\"form-group\">\n            <label class=\"form-label\">Người nhận</label>\n            <select name=\"recipient\" class=\"form-select\">\n              <option value=\"\">Tất cả mọi người</option>\n              " + allStaff.map(staff => "<option value=\"" + escapeHtml(staff[COL.S_NAME]) + "\">" + escapeHtml(staff[COL.S_NAME]) + " (" + (escapeHtml(staff[COL.S_EMAIL]) || "No email") + ")</option>").join("") + "\n            </select>\n          </div>\n          \n          <div class=\"form-group\">\n            <label class=\"form-label\">Loại thông báo</label>\n            <select name=\"type\" class=\"form-select\">\n              <option value=\"Thông báo\">Thông báo chung</option>\n              <option value=\"Khẩn cấp\">Khẩn cấp</option>\n              <option value=\"Công việc\">Công việc</option>\n              <option value=\"Hệ thống\">Hệ thống</option>\n            </select>\n          </div>\n          \n          <div class=\"flex justify-end space-x-3 mt-6\">\n            <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n            <button type=\"submit\" class=\"btn-primary\">Gửi thông báo</button>\n          </div>\n        </form>\n      </div>\n    </div>\n  ";
}
function renderGanttChartLegacy() {
  if (currentSection !== "gantt") return;
  const ganttContainerEl = document.getElementById("gantt-container"),
    ganttHeaderEl = document.getElementById("gantt-header"),
    ganttItemsEl = document.getElementById("gantt-items");
  if (!ganttContainerEl || !ganttHeaderEl || !ganttItemsEl) return;
  (!ganttStartDate || isNaN(ganttStartDate.getTime())) && (ganttStartDate = new Date(), ganttStartDate.setHours(0, 0, 0, 0));
  ganttEndDate = new Date(ganttStartDate), ganttEndDate.setDate(ganttEndDate.getDate() + 89);
  const text = Math.ceil((ganttEndDate - ganttStartDate) / 86400000) + 1,
    el = document.querySelector(".gantt-days");
  el.style.display = "flex", el.style.flexDirection = "row";
  let text2 = "",
    date = new Date(ganttStartDate);
  for (let i = 0; i < text; i++) {
    const flag = date.getDay() === 0 || date.getDay() === 6,
      isSameDate2 = isSameDate(date, new Date()),
      weekdayText = date.toLocaleString("vi-VN", {
        weekday: "short"
      }),
      date2 = date.getDate(),
      flag2 = date2 === 1,
      monthText = flag2 ? date.toLocaleString("vi-VN", {
        month: "short"
      }) : "";
    text2 += "\n        <div class=\"gantt-day " + (flag ? "weekend" : "") + " " + (isSameDate2 ? "today" : "") + " " + (flag2 ? "first-of-month" : "") + "\">\n          <div class=\"gantt-day-number\">" + escapeHtml(date2) + "</div>\n          <div class=\"gantt-day-label\">" + (flag2 ? escapeHtml(monthText) : escapeHtml(weekdayText)) + "</div>\n        </div>\n      ", date.setDate(date.getDate() + 1);
  }
  el.innerHTML = text2;
  let text3 = "";
  expandedProjects.size === 0 && allProjects.length > 0 && expandedProjects.add(allProjects[0][COL.P_ID]);
  allProjects.forEach(project => {
    const projectStartDate = parseDateString(project[COL.P_START]),
      projectEndDate = parseDateString(project[COL.P_END]);
    if (isDateInRange(projectStartDate, ganttStartDate, ganttEndDate) || isDateInRange(projectEndDate, ganttStartDate, ganttEndDate) || projectStartDate < ganttStartDate && projectEndDate > ganttEndDate) {
      const projectBarStyle = calculateGanttBarStyleRange(projectStartDate, projectEndDate, ganttStartDate, ganttEndDate, text),
        filteredTasks = allTasks.filter(task => task[COL.T_PID] === project[COL.P_ID]),
        count = filteredTasks.filter(filteredTask => (filteredTask[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
        num = filteredTasks.length > 0 ? Math.round(count / filteredTasks.length * 100) : 0,
        flag = new Date() > projectEndDate && num < 100,
        projectStartText = formatDateForGantt(project[COL.P_START]),
        projectEndText = formatDateForGantt(project[COL.P_END]),
        projectDesc = project[COL.P_DESC] || "Không có mô tả",
        projectId = project[COL.P_ID];
      text3 += "\n            <div class=\"gantt-project-group\" data-project-id=\"" + escapeHtml(projectId) + "\">\n              <div class=\"gantt-item\" data-id=\"" + escapeHtml(projectId) + "\" data-type=\"project\">\n                <div class=\"gantt-item-label\">\n                  <button class=\"gantt-toggle-btn mr-2\" data-project=\"" + escapeHtml(projectId) + "\">\n                    <i class=\"fas fa-chevron-right\"></i>\n                  </button>\n                  <i class=\"fas fa-folder " + escapeHtml(getStatusIconClass(project[COL.P_STATUS])) + " mr-2\"></i>\n                  <span class=\"truncate\">" + escapeHtml(project[COL.P_NAME]) + "</span>\n                  <span class=\"gantt-task-count\">" + filteredTasks.length + "</span>\n                  \n                  <div class=\"gantt-item-actions\">\n                    " + createSubworkFromWorkButtonHtml(projectId, project[COL.P_NAME], "action-btn action-btn-edit mr-1") + "\n                    <button class=\"action-btn action-btn-edit add-task-from-project-btn mr-1\" data-project-id=\"" + escapeHtml(projectId) + "\" data-project-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Thêm nhiệm vụ\">\n                      <i class=\"fas fa-plus\"></i>\n                    </button>\n                    <button class=\"action-btn action-btn-view view-project-btn mr-1\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Xem chi tiết\">\n                      <i class=\"fas fa-eye\"></i>\n                    </button>\n                    " + (laQuanTriTrongPhamVi() || laLanhDaoPhong() || project[COL.P_MANAGER] === currentUser.name && isManager() ? "\n                      <button class=\"action-btn action-btn-copy copy-btn mr-1\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Tạo bản sao\">\n                        <i class=\"fas fa-copy\"></i>\n                      </button>\n                    " : "") + "\n                    " + (laQuanTriTrongPhamVi() || laLanhDaoPhong() || project[COL.P_MANAGER] === currentUser.name ? "\n                      <button class=\"action-btn action-btn-edit edit-btn mr-1\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" title=\"Chỉnh sửa\">\n                        <i class=\"fas fa-edit\"></i>\n                      </button>\n                    " : "") + "\n                    " + (laQuanTriTrongPhamVi() || laLanhDaoPhong() || project[COL.P_MANAGER] === currentUser.name && isManager() ? "\n                      <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Xóa\">\n                        <i class=\"fas fa-trash\"></i>\n                      </button>\n                    " : "") + "\n                  </div>\n                </div>\n                \n                <div class=\"gantt-item-timeline\">\n                  <div class=\"gantt-bar gantt-bar-project " + (flag ? "gantt-bar-overdue" : "") + "\" style=\"" + escapeHtml(projectBarStyle) + "\" data-tooltip=\"" + escapeHtml(project[COL.P_NAME]) + ": " + escapeHtml(projectDesc) + "\">\n                    <div class=\"gantt-bar-label\">" + escapeHtml(projectStartText) + " - " + escapeHtml(projectEndText) + ": " + escapeHtml(projectDesc) + "</div>\n                    <div class=\"gantt-progress\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                  </div>\n                </div>\n              </div>\n              \n              <div class=\"gantt-project-tasks hidden\" id=\"gantt-tasks-" + escapeHtml(projectId) + "\">\n        " + filteredTasks.map(filteredTask => {
        const taskStartDate = parseDateString(filteredTask[COL.T_START]),
          taskDueDate = parseDateString(filteredTask[COL.T_DUE]),
          date2 = new Date(project[COL.P_END]);
        if (true) {
          const taskBarStyle = calculateGanttBarStyleRange(taskStartDate, taskDueDate, ganttStartDate, ganttEndDate, text),
            num2 = parseInt(filteredTask[COL.T_COMPLETION] || 0),
            isTaskOverdue2 = isTaskOverdue(filteredTask[COL.T_DUE]) && !(filteredTask[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành"),
            taskAssignee = filteredTask[COL.T_ASSIGNEE] || "Chưa gán",
            taskStatus = filteredTask[COL.T_STATUS] || "Chưa bắt đầu",
            taskPriority = filteredTask[COL.T_PRIORITY] || "Trung bình",
            taskStartText = formatDateForGantt(filteredTask[COL.T_START]),
            taskDueText = formatDateForGantt(filteredTask[COL.T_DUE]),
            taskDesc = filteredTask[COL.T_DESC] || "Không có mô tả",
            taskResultLinks = filteredTask[COL.T_RESULT_LINKS] || "",
            flag2 = parseLinks(taskResultLinks).length > 0,
            taskReminders = filteredTask[COL.T_REMINDERS] || [],
            isArray = Array.isArray(taskReminders) && taskReminders.length > 0,
            hasMatch = taskStatus.toLowerCase().includes("hoàn thành");
          return "\n                    <div class=\"gantt-item gantt-task-item draggable-item\" \n                        data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" \n                        data-type=\"task\" \n                        data-project-id=\"" + escapeHtml(filteredTask[COL.T_PID]) + "\"\n                        draggable=\"true\">\n                      <div class=\"gantt-item-label task-clickable cursor-pointer\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\">\n                        <input type=\"checkbox\" \n                              class=\"quick-complete-checkbox ml-2\" \n                              data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" \n                              data-name=\"" + escapeHtml(filteredTask[COL.T_NAME]) + "\"\n                              " + (hasMatch ? "checked disabled" : "") + " \n                              style=\"margin-right: 8px;\">\n                              \n                        <i class=\"fas fa-circle " + escapeHtml(getStatusIcon(taskStatus)) + " mr-2\" style=\"font-size: 8px;\"></i>\n                        <div class=\"flex flex-col min-w-0\">\n                          <span class=\"truncate flex items-center\">" + (isArray ? "<i class=\"fas fa-bell text-amber-500 flex-shrink-0\" style=\"margin-right: 1px; font-size: 10px;\" title=\"Có nhắc việc\"></i>" : "") + (taskPriority.toLowerCase().includes("cao") ? "<i class=\"fas fa-star text-yellow-400 flex-shrink-0\" style=\"margin-right: 2px; font-size: 10px;\"></i>" : "") + escapeHtml(filteredTask[COL.T_NAME]) + "</span>\n                          <span class=\"text-xs text-gray-500 truncate\">" + escapeHtml(taskAssignee) + " - " + escapeHtml(taskStatus) + " - " + escapeHtml(taskPriority) + "</span>\n                          " + (flag2 ? "<div class=\"mt-1\">" + renderLinksButton(taskResultLinks, filteredTask[COL.T_ID]) + "</div>" : "") + "\n                        </div>\n                        \n                        <div class=\"gantt-item-actions\">\n                          " + (() => {
            const project2 = project && project[COL.P_MANAGER] === currentUser.name,
              isAdmin2 = laQuanTriTrongPhamVi() || project2;
            return "\n                              " + createTaskFromSubworkButtonHtml(filteredTask, "action-btn action-btn-edit mr-1") + "\n                              " + (isAdmin2 ? "<button class=\"action-btn action-btn-copy copy-btn mr-1\" data-type=\"task\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" data-name=\"" + escapeHtml(filteredTask[COL.T_NAME]) + "\" title=\"Tạo bản sao\"><i class=\"fas fa-copy\"></i></button>" : "") + "\n                              <button class=\"action-btn action-btn-edit edit-btn mr-1\" data-type=\"task\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" title=\"Chỉnh sửa\"><i class=\"fas fa-edit\"></i></button>\n                              " + (isAdmin2 ? "<button class=\"action-btn action-btn-delete delete-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" data-name=\"" + escapeHtml(filteredTask[COL.T_NAME]) + "\" title=\"Xóa\"><i class=\"fas fa-trash\"></i></button>" : "") + "\n                              ";
          })() + "\n                        </div>\n                      </div>\n                      \n                      <div class=\"gantt-item-timeline\">\n                          " + (isDateInRange(taskStartDate, ganttStartDate, ganttEndDate) || isDateInRange(taskDueDate, ganttStartDate, ganttEndDate) || taskStartDate < ganttStartDate && taskDueDate > ganttEndDate ? "<div class=\"gantt-bar gantt-bar-task " + (isTaskOverdue2 ? "gantt-bar-overdue" : "") + "\" style=\"" + escapeHtml(taskBarStyle) + "\" data-tooltip=\"" + escapeHtml(filteredTask[COL.T_NAME]) + ": " + escapeHtml(taskDesc) + "\">\n                              <div class=\"gantt-bar-label\">" + escapeHtml(taskStartText) + " - " + escapeHtml(taskDueText) + ": " + escapeHtml(taskDesc) + "</div>\n                              <div class=\"gantt-progress\" style=\"width: " + escapeHtml(num2) + "%\"></div>\n                          </div>" : "<div class=\"gantt-non-visible-task\" style=\"height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 11px; font-style: italic;\">\n                              " + escapeHtml(taskStartText) + " - " + escapeHtml(taskDueText) + ": Không hiển thị trong khoảng này\n                          </div>") + "\n                      </div>\n                    </div>\n                  ";
        }
        return "";
      }).join("") + "\n      </div>\n    </div>\n  ";
    }
  });
  if (text3 === "") {
    const text4 = formatDateForDisplay(ganttStartDate) + " - " + formatDateForDisplay(ganttEndDate);
    text3 = "\n  <div class=\"text-center py-16 text-gray-500\">\n    <i class=\"fas fa-calendar-times text-4xl mb-3 opacity-30\"></i>\n    <p>Không có dự án hoặc nhiệm vụ nào trong khoảng " + escapeHtml(text4) + "</p>\n  </div>\n";
  }
  ganttItemsEl.innerHTML = text3, document.querySelectorAll(".gantt-toggle-btn").forEach(item => {
    item.removeEventListener("click", toggleGanttProject), item.addEventListener("click", toggleGanttProject);
  }), expandedProjects.forEach(expandedProject => {
    const el2 = document.getElementById("gantt-tasks-" + expandedProject),
      toggleBtn = document.querySelector(".gantt-toggle-btn[data-project=\"" + expandedProject + "\"]");
    if (el2 && toggleBtn) {
      el2.classList.remove("hidden");
      const el3 = toggleBtn.querySelector("i");
      el3 && (el3.classList.remove("fa-chevron-right"), el3.classList.add("fa-chevron-down"));
    }
  });
}
function toggleGanttProject(projectId) {
  const project = this.dataset.project,
    el = document.getElementById("gantt-tasks-" + project),
    el2 = this.querySelector("i");
  el.classList.contains("hidden") ? (el.classList.remove("hidden"), el2.classList.remove("fa-chevron-right"), el2.classList.add("fa-chevron-down"), expandedProjects.add(project)) : (el.classList.add("hidden"), el2.classList.remove("fa-chevron-down"), el2.classList.add("fa-chevron-right"), expandedProjects.delete(project));
}
function calculateGanttBarStyle(startDate, endDate, monthDate, daysInMonth) {
  (!startDate || isNaN(startDate.getTime())) && (startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  (!endDate || isNaN(endDate.getTime())) && (endDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), daysInMonth));
  const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    date2 = new Date(monthDate.getFullYear(), monthDate.getMonth(), daysInMonth);
  if (startDate < date && endDate > date2) return "left: 0; width: 100%;";
  const date3 = startDate < date ? date : startDate,
    date22 = endDate > date2 ? date2 : endDate,
    totalDays = daysInMonth,
    date4 = date3.getDate(),
    date5 = date22.getDate(),
    num = (date4 - 1) / totalDays * 100,
    num2 = (date5 - date4 + 1) / totalDays * 100;
  return "left: " + num + "%; width: " + num2 + "%;";
}
function calculateGanttBarStyleRange(startDate, endDate, rangeStart, rangeEnd, totalDays) {
  if (!startDate || isNaN(startDate.getTime())) startDate = new Date(rangeStart);
  if (!endDate || isNaN(endDate.getTime())) endDate = new Date(rangeEnd);
  if (startDate < rangeStart && endDate > rangeEnd) return "left: 0; width: 100%;";
  const clampedStart = startDate < rangeStart ? rangeStart : startDate,
    clampedEnd = endDate > rangeEnd ? rangeEnd : endDate,
    num = Math.floor((clampedStart - rangeStart) / 86400000),
    num2 = Math.floor((clampedEnd - rangeStart) / 86400000),
    num3 = num / totalDays * 100,
    num4 = (num2 - num + 1) / totalDays * 100;
  return "left: " + num3 + "%; width: " + Math.max(num4, 1) + "%;";
}
function isDateInRange(date, rangeStart, rangeEnd) {
  if (!date || isNaN(date.getTime())) return false;
  return date >= rangeStart && date <= rangeEnd;
}
function isDateInMonth(date, monthDate) {
  if (!date || isNaN(date.getTime())) return false;
  return date.getMonth() === monthDate.getMonth() && date.getFullYear() === monthDate.getFullYear();
}
function isSameDate(date1, date2) {
  return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
}
function navigateGanttMonth(direction) {
  const date = new Date(currentGanttDate);
  date.setMonth(date.getMonth() + direction), currentGanttDate = date, renderGanttChart(), setTimeout(() => {
    setupGanttEventListeners();
  }, 50);
}
function parseLinks(linksValue) {
  if (!linksValue) return [];
  const filtered = linksValue.split("\n").filter(item => item.trim() !== "");
  return filtered.map((filtered2, index) => {
    const trimmed = filtered2.trim(),
      match = trimmed.match(/^\[(.+?)\]\s*(.+)$/);
    if (match) return {
      name: match[1],
      url: match[2].trim()
    };
    return {
      name: "Link " + (index + 1),
      url: trimmed
    };
  });
}
function renderLinksButton(linksValue, extraClass = "") {
  const links = parseLinks(linksValue);
  if (links.length === 0) return "<span class=\"text-gray-400 text-xs\">Chưa có</span>";
  const encodedLinks = encodeURIComponent(JSON.stringify(links));
  return "<button class=\"links-popup-btn text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1\" \n            data-links=\"" + escapeHtml(encodedLinks) + "\" \n            onclick=\"event.stopPropagation(); showLinksPopup(this)\">\n        <i class=\"fas fa-link\"></i> " + links.length + " link" + (links.length > 1 ? "s" : "") + "\n    </button>";
}
function showLinksPopup(buttonEl) {
  const linksPopupEl = document.getElementById("links-popup");
  if (linksPopupEl) linksPopupEl.remove();
  const attribute = buttonEl.getAttribute("data-links"),
    parsed = JSON.parse(decodeURIComponent(attribute)),
    el = document.createElement("div");
  el.id = "links-popup", el.className = "links-popup fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-64", el.innerHTML = "\n        <div class=\"flex justify-between items-center mb-3 pb-2 border-b\">\n            <h4 class=\"font-semibold text-gray-800\">Danh sách link kết quả</h4>\n            <button onclick=\"document.getElementById('links-popup').remove()\" class=\"text-gray-400 hover:text-gray-600\">\n                <i class=\"fas fa-times\"></i>\n            </button>\n        </div>\n        <ul class=\"space-y-2\">\n            " + parsed.map(parsed2 => "\n                <li class=\"flex items-center gap-2\">\n                    <i class=\"fas fa-external-link-alt text-blue-500 text-xs\"></i>\n                    <a href=\"" + escapeHtml(safeUrl(parsed2.url)) + "\" target=\"_blank\" class=\"text-blue-600 hover:underline text-sm truncate max-w-xs\" title=\"" + escapeHtml(parsed2.url) + "\">\n                        " + escapeHtml(parsed2.name) + "\n                    </a>\n                </li>\n            ").join("") + "\n        </ul>\n    ";
  const boundingClientRect = buttonEl.getBoundingClientRect(),
    num = 200,
    top = boundingClientRect.top,
    num2 = window.innerHeight - boundingClientRect.bottom;
  top >= num || top > num2 ? (el.style.bottom = window.innerHeight - boundingClientRect.top + 5 + "px", el.style.top = "auto") : (el.style.top = boundingClientRect.bottom + 5 + "px", el.style.bottom = "auto");
  const num3 = 280;
  let left = boundingClientRect.left;
  left + num3 > window.innerWidth - 10 && (left = window.innerWidth - num3 - 10);
  if (left < 10) left = 10;
  el.style.left = left + "px", document.body.appendChild(el), setTimeout(() => {
    document.addEventListener("click", closeLinksPopupOnOutsideClick);
  }, 10);
}
function closeLinksPopupOnOutsideClick(event) {
  const linksPopupEl = document.getElementById("links-popup");
  linksPopupEl && !linksPopupEl.contains(event.target) && !event.target.classList.contains("links-popup-btn") && (linksPopupEl.remove(), document.removeEventListener("click", closeLinksPopupOnOutsideClick));
}
window.showLinksPopup = showLinksPopup;
function openAddReminderModal(taskId) {
  const text = "\n            <div id=\"reminder-modal\" class=\"modal active\" style=\"z-index: 200;\">\n                <div class=\"modal-content max-w-md\">\n                    <div class=\"flex items-center justify-between mb-6\">\n                        <h3 class=\"text-xl font-bold text-gray-900\">\n                            <i class=\"fas fa-bell text-amber-500 mr-2\"></i>\n                            Thêm nhắc việc\n                        </h3>\n                        <button type=\"button\" onclick=\"closeReminderModal()\" class=\"text-gray-400 hover:text-gray-600\">\n                            <i class=\"fas fa-times\"></i>\n                        </button>\n                    </div>\n                    \n                    <form id=\"reminder-form\">\n                        <input type=\"hidden\" name=\"taskId\" value=\"" + escapeHtml(taskId) + "\">\n                        \n                        <div class=\"form-group\">\n                            <label class=\"form-label required\">Ngày nhắc</label>\n                            <input type=\"date\" name=\"date\" class=\"form-input\" required value=\"" + escapeHtml(formatDateForInput(new Date())) + "\">\n                        </div>\n                        \n                        <div class=\"form-group\">\n                            <label class=\"form-label\">Nội dung</label>\n                            <textarea name=\"content\" class=\"form-textarea\" rows=\"3\" placeholder=\"Nhập nội dung nhắc việc...\"></textarea>\n                        </div>\n                        \n                        <div class=\"flex justify-end space-x-3 mt-6\">\n                            <button type=\"button\" class=\"btn-secondary\" onclick=\"closeReminderModal()\">Hủy</button>\n                            <button type=\"submit\" class=\"btn-primary\">Thêm nhắc việc</button>\n                        </div>\n                    </form>\n                </div>\n            </div>\n        ",
    el = document.createElement("div");
  el.id = "reminder-modal-container", el.innerHTML = text, document.body.appendChild(el);
  const reminderFormEl = document.getElementById("reminder-form");
  reminderFormEl.addEventListener("submit", function (event) {
    event.preventDefault(), handleAddReminder(taskId);
  });
}
function openEditReminderModal(taskId, reminderIndex, date, content) {
  const text = "\n            <div id=\"reminder-modal\" class=\"modal active\" style=\"z-index: 200;\">\n                <div class=\"modal-content max-w-md\">\n                    <div class=\"flex items-center justify-between mb-6\">\n                        <h3 class=\"text-xl font-bold text-gray-900\">\n                            <i class=\"fas fa-edit text-blue-500 mr-2\"></i>\n                            Sửa nhắc việc\n                        </h3>\n                        <button type=\"button\" onclick=\"closeReminderModal()\" class=\"text-gray-400 hover:text-gray-600\">\n                            <i class=\"fas fa-times\"></i>\n                        </button>\n                    </div>\n                    \n                    <form id=\"reminder-form\">\n                        <input type=\"hidden\" name=\"taskId\" value=\"" + escapeHtml(taskId) + "\">\n                        <input type=\"hidden\" name=\"reminderIndex\" value=\"" + escapeHtml(reminderIndex) + "\">\n                        \n                        <div class=\"form-group\">\n                            <label class=\"form-label required\">Ngày nhắc</label>\n                            <input type=\"date\" name=\"date\" class=\"form-input\" required value=\"" + escapeHtml(date) + "\">\n                        </div>\n                        \n                        <div class=\"form-group\">\n                            <label class=\"form-label\">Nội dung</label>\n                            <textarea name=\"content\" class=\"form-textarea\" rows=\"3\" placeholder=\"Nhập nội dung nhắc việc...\">" + (escapeHtml(content) || "") + "</textarea>\n                        </div>\n                        \n                        <div class=\"flex justify-end space-x-3 mt-6\">\n                            <button type=\"button\" class=\"btn-secondary\" onclick=\"closeReminderModal()\">Hủy</button>\n                            <button type=\"submit\" class=\"btn-primary\">Cập nhật</button>\n                        </div>\n                    </form>\n                </div>\n            </div>\n        ",
    el = document.createElement("div");
  el.id = "reminder-modal-container", el.innerHTML = text, document.body.appendChild(el);
  const reminderFormEl = document.getElementById("reminder-form");
  reminderFormEl.addEventListener("submit", function (event) {
    event.preventDefault(), handleEditReminder(taskId, reminderIndex);
  });
}
function closeReminderModal() {
  const reminderModalContainerEl = document.getElementById("reminder-modal-container");
  reminderModalContainerEl && reminderModalContainerEl.remove();
}
function handleAddReminder(taskId) {
  const reminderFormEl = document.getElementById("reminder-form"),
    el = reminderFormEl.querySelector("button[type=\"submit\"]");
  if (el && el.disabled) return;
  if (el) el.disabled = true;
  const value = reminderFormEl.date.value,
    value2 = reminderFormEl.content.value,
    data = {
      date: value,
      content: value2
    },
    taskIndex = allTasks.findIndex(task => task[COL.T_ID] === taskId);
  let list = [];
  taskIndex !== -1 && (list = allTasks[taskIndex][COL.T_REMINDERS] || []);
  const values = [...list, data];
  closeReminderModal(), showToast("Đang thêm nhắc việc...", "info"), refreshRemindersPanel(taskId, values), google.script.run.withSuccessHandler(function (response) {
    response.success ? (showToast("Thêm nhắc việc thành công!", "success"), response.reminders && refreshRemindersPanel(taskId, response.reminders)) : (refreshRemindersPanel(taskId, list), showToast(response.error || "Có lỗi xảy ra", "error"));
  }).withFailureHandler(function (error) {
    refreshRemindersPanel(taskId, list), showToast("Lỗi: " + error.message, "error");
  }).addTaskReminder(taskId, {
    date: value,
    content: value2
  });
}
function handleEditReminder(taskId, reminderIndex) {
  const reminderFormEl = document.getElementById("reminder-form"),
    el = reminderFormEl.querySelector("button[type=\"submit\"]");
  if (el && el.disabled) return;
  if (el) el.disabled = true;
  const value = reminderFormEl.date.value,
    value2 = reminderFormEl.content.value,
    taskIndex = allTasks.findIndex(task => task[COL.T_ID] === taskId);
  let list = [];
  taskIndex !== -1 && (list = allTasks[taskIndex][COL.T_REMINDERS] || []);
  const values = [...list],
    values2 = [...list];
  values2[reminderIndex] && (values2[reminderIndex] = {
    date: value,
    content: value2
  }), closeReminderModal(), showToast("Đang cập nhật nhắc việc...", "info"), refreshRemindersPanel(taskId, values2), google.script.run.withSuccessHandler(function (response) {
    response.success ? (showToast("Cập nhật nhắc việc thành công!", "success"), response.reminders && refreshRemindersPanel(taskId, response.reminders)) : (refreshRemindersPanel(taskId, values), showToast(response.error || "Có lỗi xảy ra", "error"));
  }).withFailureHandler(function (error) {
    refreshRemindersPanel(taskId, values), showToast("Lỗi: " + error.message, "error");
  }).updateTaskReminder(taskId, parseInt(reminderIndex), {
    date: value,
    content: value2
  });
}
function handleDeleteReminder(taskId, reminderIndex) {
  if (!confirm("Bạn có chắc muốn xóa nhắc việc này?")) return;
  google.script.run.withSuccessHandler(function (response) {
    response.success ? (showToast("Xóa nhắc việc thành công!", "success"), refreshRemindersPanel(taskId, response.reminders)) : showToast(response.error || "Có lỗi xảy ra", "error");
  }).withFailureHandler(function (error) {
    showToast("Lỗi: " + error.message, "error");
  }).deleteTaskReminder(taskId, parseInt(reminderIndex));
}
function refreshRemindersPanel(taskId, reminders) {
  const remindersListEl = document.getElementById("reminders-list");
  if (!remindersListEl) return;
  reminders && reminders.length > 0 ? remindersListEl.innerHTML = reminders.map((reminder, index) => "\n                <div class=\"reminder-item p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors\">\n                    <div class=\"flex items-start justify-between\">\n                        <div class=\"flex-1\">\n                            <div class=\"flex items-center text-sm font-medium text-gray-900 mb-1\">\n                                <i class=\"fas fa-calendar-alt text-amber-500 mr-2 text-xs\"></i>\n                                " + escapeHtml(formatDateForDisplay(reminder.date)) + "\n                            </div>\n                            <p class=\"text-sm text-gray-600 leading-relaxed reminder-content\">" + (linkifyText(reminder.content) || "<em class=\"text-gray-400\">Không có nội dung</em>") + "</p>\n                        </div>\n                        " + (isAdmin() ? "\n                        <div class=\"flex items-center space-x-1 ml-2\">\n                            <button type=\"button\" onclick=\"openEditReminderModal('" + escapeForInlineHandler(taskId) + "', " + index + ", '" + escapeForInlineHandler(reminder.date) + "', decodeURIComponent('" + escapeForInlineHandler(encodeURIComponent(reminder.content || "")) + "'))\" class=\"p-1 text-gray-400 hover:text-blue-600 transition-colors\" title=\"Sửa\">\n                                <i class=\"fas fa-edit text-xs\"></i>\n                            </button>\n                            <button type=\"button\" onclick=\"handleDeleteReminder('" + escapeForInlineHandler(taskId) + "', " + index + ")\" class=\"p-1 text-gray-400 hover:text-red-600 transition-colors\" title=\"Xóa\">\n                                <i class=\"fas fa-trash text-xs\"></i>\n                            </button>\n                        </div>\n                        " : "") + "\n                    </div>\n                </div>\n            ").join("") : remindersListEl.innerHTML = "\n                <div class=\"text-center py-8 text-gray-400\">\n                    <i class=\"fas fa-bell-slash text-3xl mb-2\"></i>\n                    <p class=\"text-sm\">Chưa có nhắc việc nào</p>\n                </div>\n            ";
  const taskIndex = allTasks.findIndex(task => task[COL.T_ID] === taskId);
  taskIndex !== -1 && (allTasks[taskIndex][COL.T_REMINDERS] = reminders);
  if (currentSection === "gantt") renderGanttChart();else {
    if (currentSection === "tasks") renderTasks();else currentSection === "overview" && renderPriorityTasksMini();
  }
  const projectDetailsModalEl = document.getElementById("project-details-modal");
  if (projectDetailsModalEl && projectDetailsModalEl.classList.contains("active")) {
    const task = allTasks.find(task2 => task2[COL.T_ID] === taskId);
    if (task) {
      const taskPid = task[COL.T_PID],
        project = allProjects.find(project2 => project2[COL.P_ID] === taskPid);
      project && showProjectDetailsModal(taskPid, project[COL.P_NAME]);
    }
  }
}
window.openAddReminderModal = openAddReminderModal, window.openEditReminderModal = openEditReminderModal, window.closeReminderModal = closeReminderModal, window.handleDeleteReminder = handleDeleteReminder;
function searchGantt(searchTerm) {
  if (!searchTerm) {
    document.querySelectorAll(".gantt-project-group").forEach(item => {
      item.style.display = "block", item.querySelectorAll(".gantt-item").forEach(item2 => {
        item2.style.display = "flex";
      });
    });
    return;
  }
  const lower = searchTerm.toLowerCase(),
    set = new Set();
  document.querySelectorAll(".gantt-project-group").forEach(item => {
    const el = item.querySelector(".gantt-item[data-type=\"project\"]"),
      els = item.querySelectorAll(".gantt-item[data-type=\"task\"]");
    let flag = false,
      flag2 = false;
    if (el) {
      const lower2 = el.querySelector(".gantt-item-label").textContent.toLowerCase();
      flag = lower2.includes(lower);
    }
    els.forEach(el2 => {
      const lower2 = el2.querySelector(".gantt-item-label").textContent.toLowerCase(),
        hasMatch = lower2.includes(lower);
      hasMatch ? (flag2 = true, el2.style.display = "flex") : el2.style.display = "none";
    }), flag || flag2 ? (item.style.display = "block", el && (el.style.display = "flex"), flag && els.forEach(el2 => {
      el2.style.display = "flex";
    })) : item.style.display = "none";
  });
}
function setupGanttEventListeners() {
  // Ô «từ ngày» đã bỏ (2026-08-26) — khoảng xem do Tháng/Năm quyết định qua setupGanttPhase6Controls.
  const searchInput = document.getElementById("gantt-search");
  searchInput && (searchInput.removeEventListener("input", handleGanttSearch), searchInput.addEventListener("input", handleGanttSearch));
  const ganttStaffFilterEl = document.getElementById("gantt-staff-filter");
  ganttStaffFilterEl && (populateGanttStaffFilter(), ganttStaffFilterEl.removeEventListener("change", handleGanttStaffFilter), ganttStaffFilterEl.addEventListener("change", handleGanttStaffFilter));
  // Phase 6: ô «Xem 1/2/3 tháng» + «Nhóm theo» (việc 6.6/6.7).
  typeof setupGanttPhase6Controls === "function" && setupGanttPhase6Controls();
}
function populateGanttStaffFilter() {
  const ganttStaffFilterEl = document.getElementById("gantt-staff-filter");
  if (!ganttStaffFilterEl || ganttStaffFilterEl.options.length > 1) return;
  const filteredStaff = allStaff.filter(staff => staff[COL.S_OBJECT_TYPE] !== "Nhà cung cấp");
  filteredStaff.forEach(filteredStaff2 => {
    const el = document.createElement("option");
    el.value = filteredStaff2[COL.S_NAME], el.textContent = filteredStaff2[COL.S_NAME], ganttStaffFilterEl.appendChild(el);
  });
}
function handleGanttStaffFilter(event) {
  filterGanttByStaff(event.target.value);
}
function filterGanttByStaff(staffName) {
  document.querySelectorAll(".gantt-project-group").forEach(item => {
    const els = item.querySelectorAll(".gantt-item[data-type=\"task\"]");
    let flag = false;
    els.forEach(el2 => {
      const el3 = el2.querySelector(".gantt-item-label"),
        textContent = el3 ? el3.textContent : "";
      !staffName || textContent.includes(staffName) ? (el2.style.display = "flex", flag = true) : el2.style.display = "none";
    });
    const el = item.querySelector(".gantt-item[data-type=\"project\"]");
    if (el) {
      if (!staffName) item.style.display = "block", el.style.display = "flex";else flag ? (item.style.display = "block", el.style.display = "flex") : item.style.display = "none";
    }
  });
}
function handleGanttSearch(event) {
  searchGantt(event.target.value);
}
function formatDateForGantt(value) {
  if (!value) return "";
  try {
    const date = parseDateString(value);
    if (isNaN(date.getTime())) return "";
    // Ngày "lăn" (30/02/2026 → 02/03/2026) coi như KHÔNG hợp lệ: không in ra nhãn sai ngày.
    if (typeof value === "string") {
      const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/),
        vn = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),
        hopLe = iso
          ? Number(iso[1]) === date.getFullYear() &&
            Number(iso[2]) === date.getMonth() + 1 &&
            Number(iso[3]) === date.getDate()
          : vn
            ? Number(vn[3]) === date.getFullYear() &&
              Number(vn[2]) === date.getMonth() + 1 &&
              Number(vn[1]) === date.getDate()
            : true;
      if (!hopLe) return "";
    }
    const padded = String(date.getDate()).padStart(2, "0"),
      padded2 = String(date.getMonth() + 1).padStart(2, "0");
    return padded + "/" + padded2;
  } catch (err) {
    return "";
  }
}
function getStatusIcon(status) {
  const lower = (status || "").toLowerCase();
  if (lower.includes("hoàn thành")) return "text-green-500";
  if (lower.includes("đang")) return "text-blue-500";
  if (lower.includes("tạm dừng")) return "text-yellow-500";
  return "text-gray-400";
}
function formatTaskLinks(linksValue) {
  if (!linksValue) return "";
  const filtered = linksValue.split("\n").filter(item => item.trim() !== "");
  if (filtered.length === 0) return "";
  return filtered.map((filtered2, index) => {
    return "<a href=\"" + escapeHtml(safeUrl(filtered2)) + "\" target=\"_blank\" class=\"text-blue-600 hover:underline\">Link " + escapeHtml(index + 1) + "</a>";
  }).join(" | ");
}
function canUserCopyResource(resourceType, resourceId) {
  if (resourceType === "project") return isAdmin() || isManager() || allProjects.some(project => project[COL.P_ID] === resourceId && project[COL.P_MANAGER] === currentUser.name);
  if (resourceType === "task") return canUserCreateTask();
  return false;
}
function openCopyModal(resourceType, resourceId, resourceName) {
  const text = "copy-" + resourceType + "-modal",
    text2 = "Bản sao " + resourceName,
    text3 = "\n    <div id=\"" + escapeHtml(text) + "\" class=\"modal\">\n        <div class=\"modal-content max-w-md\">\n            <div class=\"flex items-center justify-between mb-6\">\n                <h3 class=\"text-xl font-bold text-gray-900\">Tạo bản sao " + (resourceType === "project" ? "dự án" : "nhiệm vụ") + "</h3>\n                <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n                    <i class=\"fas fa-times\"></i>\n                </button>\n            </div>\n            \n            <form id=\"copy-" + escapeHtml(resourceType) + "-form\">\n                <div class=\"form-group\">\n                    <label class=\"form-label\">Tên " + (resourceType === "project" ? "dự án" : "nhiệm vụ") + " mới *</label>\n                    <input type=\"text\" name=\"newName\" class=\"form-input\" required value=\"" + escapeHtml(text2) + "\">\n                </div>\n                \n                <div class=\"flex justify-end space-x-3 mt-6\">\n                    <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n                    <button type=\"submit\" class=\"btn-primary\">Tạo bản sao</button>\n                </div>\n            </form>\n        </div>\n    </div>\n";
  document.getElementById("modals-container").innerHTML = text3;
  const el = document.getElementById(text);
  el.classList.add("active");
  const el2 = el.querySelector("form");
  el2.addEventListener("submit", function (event) {
    event.preventDefault();
    const trimmed = el2.newName.value.trim();
    trimmed && handleCopy(resourceType, resourceId, trimmed);
  });
  const closeButtons = el.querySelectorAll(".close-modal");
  closeButtons.forEach(closeButton => {
    closeButton.addEventListener("click", event => {
      event.preventDefault(), closeModal(text);
    });
  }), setTimeout(() => {
    const el3 = el.querySelector("input[name=\"newName\"]");
    el3 && (el3.focus(), el3.select());
  }, 300);
}
function handleCopy(resourceType, sourceId, newName) {
  if (!isAuthenticated) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  const el = document.getElementById("copy-" + resourceType + "-form"),
    el2 = el.querySelector("button[type=\"submit\"]");
  setButtonLoading(el2, true);
  let text = "";
  if (resourceType === "project") text = "copyProjectWithAuth";else {
    if (resourceType === "task") text = "copyTaskWithAuth";
  }
  google.script.run.withSuccessHandler(function (response) {
    setButtonLoading(el2, false), response.success ? (showToast(response.message || "Đã tạo bản sao " + resourceType + " thành công!", "success"), closeModal("copy-" + resourceType + "-modal"), refreshData()) : showToast(response.error || "Có lỗi xảy ra", "error");
  }).withFailureHandler(function (error) {
    setButtonLoading(el2, false), showToast("Lỗi: " + error.message, "error");
  })[text](sourceId, newName);
}
function renderTaskPriorityChart() {
  const taskPriorityChartEl = document.getElementById("task-priority-chart"),
    priorityChartMessageEl = document.getElementById("priority-chart-message");
  if (!taskPriorityChartEl) return;
  window.taskPriorityChart && window.taskPriorityChart.destroy();
  const filteredTasks = getFilteredTasks();
  if (!filteredTasks || filteredTasks.length === 0) {
    priorityChartMessageEl.textContent = "Không có dữ liệu nhiệm vụ", priorityChartMessageEl.classList.remove("hidden");
    return;
  }
  priorityChartMessageEl.classList.add("hidden");
  const data = {
    "Thấp": 0x0,
    "Trung bình": 0x0,
    Cao: 0x0
  };
  filteredTasks.forEach(filteredTask => {
    const taskPriority = filteredTask[COL.T_PRIORITY] || "Trung bình";
    if (taskPriority.toLowerCase().includes("thấp")) data["Thấp"]++;else taskPriority.toLowerCase().includes("cao") ? data.Cao++ : data["Trung bình"]++;
  }), window.taskPriorityChart = new Chart(taskPriorityChartEl, {
    type: "pie",
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(59, 130, 246, 0.8)", "rgba(239, 68, 68, 0.8)"],
        borderColor: ["rgba(34, 197, 94, 1)", "rgba(59, 130, 246, 1)", "rgba(239, 68, 68, 1)"],
        borderWidth: 0x2,
        hoverOffset: 0x8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: 0x0,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 0xf,
            usePointStyle: true,
            font: {
              size: 0xb
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              const total = tooltipItem.dataset.data.reduce((acc, item) => acc + item, 0),
                num = Math.round(tooltipItem.parsed / total * 100);
              return tooltipItem.label + ": " + tooltipItem.parsed + " (" + num + "%)";
            }
          }
        }
      },
      animation: {
        duration: 0x3e8,
        easing: "easeOutCubic"
      }
    }
  });
}
function renderPriorityTasksMini() {
  const priorityTasksMiniEl = document.getElementById("priority-tasks-mini");
  if (!priorityTasksMiniEl) return;
  let list = [];
  if (isAdmin()) list = allTasks;else {
    const userAllowedProjects = getUserAllowedProjects();
    list = allTasks.filter(task => {
      if (task[COL.T_ASSIGNEE] === currentUser.name) return true;
      const taskPid = task[COL.T_PID],
        project = allProjects.find(project2 => project2[COL.P_ID] === taskPid);
      if (project && project[COL.P_MANAGER] === currentUser.name) return true;
      return false;
    });
  }
  currentOverviewProjectFilter && (list = list.filter(list2 => list2[COL.T_PID] === currentOverviewProjectFilter));
  const filteredList = list.filter(list2 => {
    const lower = (list2[COL.T_PRIORITY] || "").toLowerCase(),
      lower2 = (list2[COL.T_STATUS] || "").toLowerCase();
    return lower.includes("cao") && !lower2.includes("hoàn thành");
  });
  if (filteredList.length === 0) {
    priorityTasksMiniEl.innerHTML = "<div class=\"lg:col-span-2 text-center py-8 text-gray-500 text-sm\">Không có nhiệm vụ ưu tiên cao</div>";
    return;
  }
  priorityTasksMiniEl.innerHTML = filteredList.map(filteredList2 => {
    const taskName = filteredList2[COL.T_NAME] || "Chưa có tên",
      taskAssignee = filteredList2[COL.T_ASSIGNEE] || "Chưa gán",
      dueDateText = formatDateForDisplay(filteredList2[COL.T_DUE]),
      num = parseInt(filteredList2[COL.T_COMPLETION] || 0),
      isTaskOverdue2 = isTaskOverdue(filteredList2[COL.T_DUE]),
      taskPid = filteredList2[COL.T_PID] || "N/A",
      project = allProjects.find(project2 => project2[COL.P_ID] === taskPid),
      projectName = project ? project[COL.P_NAME] : taskPid,
      text = projectName.length > 20 ? projectName.substring(0, 20) + "..." : projectName,
      taskReminders = filteredList2[COL.T_REMINDERS] || [],
      isArray = Array.isArray(taskReminders) && taskReminders.length > 0;
    return "\n  <div class=\"p-4 border border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg hover:shadow-md transition-all duration-200 hover:border-orange-300 task-clickable cursor-pointer\" data-id=\"" + escapeHtml(filteredList2[COL.T_ID]) + "\">\n    <div class=\"flex items-start justify-between mb-3\">\n      <h5 class=\"font-semibold text-gray-900 text-sm leading-tight flex-1 mr-2\">" + (isArray ? "<i class=\"fas fa-bell text-amber-500 mr-1\" title=\"Có nhắc việc\"></i>" : "") + escapeHtml(taskName) + "</h5>\n      <div class=\"flex items-center space-x-2\">\n        " + (isTaskOverdue2 ? "<span class=\"status-badge status-overdue text-xs\">Quá hạn</span>" : "<span class=\"status-badge priority-high text-xs\">Cao</span>") + "\n        \n        <div class=\"flex space-x-1\">\n          " + (() => {
      const project2 = allProjects.find(project3 => project3[COL.P_ID] === taskPid),
        project22 = project2 && project2[COL.P_MANAGER] === currentUser.name,
        isAdmin2 = laQuanTriTrongPhamVi() || project22;
      return "\n              " + (isAdmin2 ? "<button class=\"action-btn action-btn-copy copy-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredList2[COL.T_ID]) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Tạo bản sao\"><i class=\"fas fa-copy\"></i></button>" : "") + "\n              <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredList2[COL.T_ID]) + "\" title=\"Chỉnh sửa\"><i class=\"fas fa-edit\"></i></button>\n              " + (isAdmin2 ? "<button class=\"action-btn action-btn-delete delete-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredList2[COL.T_ID]) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Xóa\"><i class=\"fas fa-trash\"></i></button>" : "") + "\n            ";
    })() + "\n        </div>\n      </div>\n    </div>\n    \n    <div class=\"text-xs text-gray-600 space-y-1 mb-3\">\n      <div class=\"flex items-center justify-between\">\n        <div class=\"flex items-center flex-1\">\n          <i class=\"fas fa-folder text-purple-500 mr-1 w-3\"></i>\n          <span class=\"truncate\">" + escapeHtml(text) + "</span>\n        </div>\n      </div>\n\n      <div class=\"flex items-center justify-between\">\n        <div class=\"flex items-center flex-1\">\n          <i class=\"fas fa-user text-blue-500 mr-1 w-3\"></i>\n          <span class=\"truncate\">" + escapeHtml(taskAssignee) + "</span>\n        </div>\n        <div class=\"flex items-center ml-2\">\n          <i class=\"fas fa-calendar " + (isTaskOverdue2 ? "text-red-500" : "text-green-500") + " mr-1 w-3\"></i>\n          <span>" + escapeHtml(dueDateText) + "</span>\n        </div>\n      </div>\n    </div>\n    \n    <div class=\"flex items-center\">\n      <span class=\"text-xs font-semibold text-gray-700 min-w-[35px]\">" + escapeHtml(num) + "%</span>\n      <div class=\"flex-1 h-2 bg-gray-200 rounded-full ml-2\">\n        <div class=\"h-full " + (num === 0 ? "bg-gray-400" : "bg-gradient-to-r from-orange-400 to-red-500") + " rounded-full transition-all duration-500\" style=\"width: " + Math.max(num, 5) + "%\"></div>\n      </div>\n    </div>\n  </div>\n";
  }).join("");
}
function renderTimelineProgressChart() {
  const timelineProgressChartEl = document.getElementById("timeline-progress-chart"),
    timelineChartMessageEl = document.getElementById("timeline-chart-message");
  if (!timelineProgressChartEl) return;
  window.timelineProgressChart && window.timelineProgressChart.destroy();
  const filteredTasks = getFilteredTasks();
  if (!filteredTasks || filteredTasks.length === 0) {
    timelineChartMessageEl.textContent = "Không có dữ liệu nhiệm vụ", timelineChartMessageEl.classList.remove("hidden");
    return;
  }
  timelineChartMessageEl.classList.add("hidden");
  const now = new Date();
  now.setDate(now.getDate() - 30);
  const data = {},
    list = [];
  for (let i = 29; i >= 0; i--) {
    const now2 = new Date();
    now2.setDate(now2.getDate() - i);
    const todayKey = now2.toISOString().split("T")[0],
      text = now2.getDate() + "/" + (now2.getMonth() + 1);
    data[todayKey] = 0, list.push(text);
  }
  filteredTasks.forEach(filteredTask => {
    const lower = (filteredTask[COL.T_STATUS] || "").toLowerCase(),
      taskReportDate = filteredTask[COL.T_REPORT_DATE];
    if (lower.includes("hoàn thành") && taskReportDate) try {
      const date = new Date(taskReportDate),
        dateKey = date.toISOString().split("T")[0];
      data.hasOwnProperty(dateKey) && data[dateKey]++;
    } catch (err) {}
  });
  const counts = Object.values(data);
  window.timelineProgressChart = new Chart(timelineProgressChartEl, {
    type: "line",
    data: {
      labels: list,
      datasets: [{
        label: "Nhiệm vụ hoàn thành",
        data: counts,
        borderColor: "rgba(16, 185, 129, 1)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderWidth: 0x3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "rgba(16, 185, 129, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 0x2,
        pointRadius: 0x4,
        pointHoverRadius: 0x6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function (tooltipItems) {
              return "Ngày " + tooltipItems[0].label;
            },
            label: function (tooltipItem) {
              return tooltipItem.parsed.y + " nhiệm vụ hoàn thành";
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "30 ngày gần đây"
          },
          ticks: {
            maxTicksLimit: 0x7,
            font: {
              size: 0xa
            }
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Số lượng nhiệm vụ"
          },
          ticks: {
            stepSize: 0x1,
            callback: function (value) {
              return Math.floor(value);
            }
          }
        }
      },
      animation: {
        duration: 0x3e8,
        easing: "easeOutCubic"
      }
    }
  });
}
function renderProjectComparisonChart() {
  const projectComparisonChartEl = document.getElementById("project-comparison-chart"),
    comparisonChartMessageEl = document.getElementById("comparison-chart-message");
  if (!projectComparisonChartEl) return;
  window.projectComparisonChart && window.projectComparisonChart.destroy();
  const filteredProjects = getFilteredProjects(),
    filteredTasks = getFilteredTasks();
  if (!filteredProjects || filteredProjects.length === 0 || !filteredTasks || filteredTasks.length === 0) {
    comparisonChartMessageEl.textContent = "Không có dữ liệu để so sánh", comparisonChartMessageEl.classList.remove("hidden");
    return;
  }
  comparisonChartMessageEl.classList.add("hidden");
  const slice = filteredProjects.map(filteredProject => {
    const projectId = filteredProject[COL.P_ID],
      projectName = filteredProject[COL.P_NAME] || projectId,
      filteredFilteredTasks = filteredTasks.filter(filteredTask => filteredTask[COL.T_PID] === projectId),
      filteredFilteredTaskCount = filteredFilteredTasks.length,
      count = filteredFilteredTasks.filter(filteredFilteredTask => (filteredFilteredTask[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
      num = filteredFilteredTaskCount > 0 ? Math.round(count / filteredFilteredTaskCount * 100) : 0;
    return {
      name: projectName.length > 15 ? projectName.substring(0, 15) + "..." : projectName,
      totalTasks: filteredFilteredTaskCount,
      completedTasks: count,
      completionRate: num
    };
  }).filter(item => item.totalTasks > 0).sort((a, b) => b.totalTasks - a.totalTasks).slice(0, 5);
  if (slice.length === 0) {
    comparisonChartMessageEl.textContent = "Chưa có công việc nào có nhiệm vụ", comparisonChartMessageEl.classList.remove("hidden");
    return;
  }
  window.projectComparisonChart = new Chart(projectComparisonChartEl, {
    type: "bar",
    data: {
      labels: slice.map(slice2 => slice2.name),
      datasets: [{
        label: "Tổng nhiệm vụ",
        data: slice.map(slice2 => slice2.totalTasks),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 0x1,
        borderRadius: 0x6,
        yAxisID: "y"
      }, {
        label: "Tỷ lệ hoàn thành (%)",
        data: slice.map(slice2 => slice2.completionRate),
        type: "line",
        borderColor: "rgba(239, 68, 68, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        borderWidth: 0x3,
        pointBackgroundColor: "rgba(239, 68, 68, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 0x2,
        pointRadius: 0x5,
        pointHoverRadius: 0x7,
        tension: 0.4,
        yAxisID: "y1"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            font: {
              size: 0xb
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              if (tooltipItem.dataset.label === "Tổng nhiệm vụ") {
                const slice2 = slice[tooltipItem.dataIndex];
                return tooltipItem.dataset.label + ": " + tooltipItem.parsed.y + " (Hoàn thành: " + slice2.completedTasks + ")";
              } else return tooltipItem.dataset.label + ": " + tooltipItem.parsed.y + "%";
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0x2d,
            minRotation: 0x0,
            font: {
              size: 0xa
            }
          }
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Số lượng nhiệm vụ"
          },
          beginAtZero: true,
          ticks: {
            stepSize: 0x1,
            callback: function (value) {
              return Math.floor(value);
            }
          }
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: {
            display: true,
            text: "Tỷ lệ (%)"
          },
          beginAtZero: true,
          max: 0x64,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: function (value) {
              return value + "%";
            }
          }
        }
      },
      animation: {
        duration: 0x3e8,
        easing: "easeOutCubic"
      }
    }
  });
}
function addOptimisticUpdate(type, user, id = null) {
  if (type === "project") {
    const data = {
      [COL.P_ID]: id || "TEMP_" + Date.now(),
      [COL.P_NAME]: user.name,
      [COL.P_DESC]: user.description || "",
      [COL.P_MANAGER]: user.manager || "",
      [COL.P_START]: user.startDate,
      [COL.P_END]: user.endDate,
      [COL.P_STATUS]: user.status || "Chưa bắt đầu"
    };
    allProjects.unshift(data), renderProjects();
  } else {
    if (type === "task") {
      const data = {
        [COL.T_ID]: id || "TEMP_" + Date.now(),
        [COL.T_PID]: user.projectId,
        [COL.T_NAME]: user.name,
        [COL.T_DESC]: user.description || "",
        [COL.T_ASSIGNEE]: user.assignee || "",
        [COL.T_STATUS]: user.status || "Chưa bắt đầu",
        [COL.T_PRIORITY]: user.priority || "Trung bình",
        [COL.T_START]: user.startDate,
        [COL.T_DUE]: user.dueDate,
        [COL.T_COMPLETION]: parseInt(user.completion || 0)
      };
      allTasks.unshift(data), renderTasks();
    } else {
      if (type === "staff") {
        const data = {
          [COL.S_ID]: id || "TEMP_" + Date.now(),
          [COL.S_NAME]: user.name,
          [COL.S_EMAIL]: user.email || "",
          [COL.S_POS]: user.position || "",
          [COL.S_ROLE]: user.role || "Nhân viên",
          [COL.S_OBJECT_TYPE]: user.objectType || "Người dùng",
          [COL.S_NOTES]: user.notes || ""
        };
        allStaff.unshift(data), renderStaff();
      } else {
        if (type === "proposal") {
          const data = {
            [COL.PR_ID]: id || "TEMP_" + Date.now(),
            [COL.PR_CONTENT]: user[COL.PR_CONTENT] || user.content,
            [COL.PR_TYPE]: user[COL.PR_TYPE] || user.type,
            [COL.PR_PID]: user[COL.PR_PID] || user.pid,
            [COL.PR_TID]: user[COL.PR_TID] || user.tid,
            [COL.PR_URL]: user[COL.PR_URL] || user.url,
            [COL.PR_SUPPLIER]: user[COL.PR_SUPPLIER] || user.supplier,
            [COL.PR_STATUS]: user[COL.PR_STATUS] || user.status || "Đề xuất mới",
            [COL.PR_NOTE]: user[COL.PR_NOTE] || user.note || "",
            [COL.PR_CREATOR]: currentUser.name,
            [COL.PR_DATE]: new Date()
          };
          allProposals.unshift(data), renderProposals();
        } else {
          if (type === "app") {
            const data = {
              [COL.A_ID]: id || "TEMP_" + Date.now(),
              [COL.A_NAME]: user[COL.A_NAME] || user.name,
              [COL.A_URL]: user[COL.A_URL] || user.url,
              [COL.A_ICON]: user[COL.A_ICON] || user.icon,
              [COL.A_DESC]: user[COL.A_DESC] || user.description || "",
              [COL.A_CREATED]: currentUser.name
            };
            allApps.unshift(data), renderApps();
          }
        }
      }
    }
  }
}
function updateOptimisticUpdate(type, id, user) {
  if (type === "project") {
    const projectIndex = allProjects.findIndex(project => project[COL.P_ID] === id);
    projectIndex !== -1 && (allProjects[projectIndex] = {
      ...allProjects[projectIndex],
      ...{
        [COL.P_NAME]: user.name,
        [COL.P_DESC]: user.description || "",
        [COL.P_MANAGER]: user.manager || "",
        [COL.P_START]: user.startDate,
        [COL.P_END]: user.endDate,
        [COL.P_STATUS]: user.status
      }
    }, renderProjects(), renderProjectStats(), renderStats(), renderStaffPerformanceChart(), renderTaskPriorityChart(), renderTimelineProgressChart(), currentSection === "gantt" && renderGanttChart());
  } else {
    if (type === "task") {
      const taskIndex = allTasks.findIndex(task => task[COL.T_ID] === id);
      taskIndex !== -1 && (allTasks[taskIndex] = {
        ...allTasks[taskIndex],
        ...{
          [COL.T_NAME]: user.name,
          [COL.T_PID]: user.projectId,
          [COL.T_DESC]: user.description || "",
          [COL.T_ASSIGNEE]: user.assignee || "",
          [COL.T_STATUS]: user.status,
          [COL.T_PRIORITY]: user.priority,
          [COL.T_START]: user.startDate,
          [COL.T_DUE]: user.dueDate,
          [COL.T_COMPLETION]: parseInt(user.completion || 0)
        }
      }, renderTasks(), renderProjects(), renderProjectStats(), renderTaskStats(), renderStats(), renderTaskPriorityChart(), renderPriorityTasksMini(), renderStaffPerformanceChart(), renderTimelineProgressChart(), currentSection === "gantt" && renderGanttChart());
    } else {
      if (type === "staff") {
        const staffIndex = allStaff.findIndex(staff => staff[COL.S_ID] === id);
        staffIndex !== -1 && (allStaff[staffIndex] = {
          ...allStaff[staffIndex],
          ...{
            [COL.S_NAME]: user.name,
            [COL.S_EMAIL]: user.email || "",
            [COL.S_POS]: user.position || "",
            [COL.S_ROLE]: user.role,
            [COL.S_OBJECT_TYPE]: user.objectType,
            [COL.S_NOTES]: user.notes
          }
        }, renderStaff());
      } else {
        if (type === "proposal") {
          const proposalIndex = allProposals.findIndex(proposal => proposal[COL.PR_ID] === id);
          proposalIndex !== -1 && (allProposals[proposalIndex] = {
            ...allProposals[proposalIndex],
            ...user
          }, renderProposals());
        } else {
          if (type === "app") {
            const appIndex = allApps.findIndex(app => app[COL.A_ID] === id);
            appIndex !== -1 && (allApps[appIndex] = {
              ...allApps[appIndex],
              ...user
            }, renderApps());
          }
        }
      }
    }
  }
}
function removeOptimisticUpdate(type, id) {
  if (type === "project") allProjects = allProjects.filter(project => project[COL.P_ID] !== id), renderProjects(), renderProjectStats(), renderStats(), renderStaffPerformanceChart(), renderTaskPriorityChart(), renderTimelineProgressChart();else {
    if (type === "task") allTasks = allTasks.filter(task => task[COL.T_ID] !== id), renderTasks(), renderTaskStats(), renderStats(), renderTaskPriorityChart(), renderPriorityTasksMini(), renderStaffPerformanceChart(), renderTimelineProgressChart(), refreshProjectDetailsModalIfOpen();else {
      if (type === "staff") allStaff = allStaff.filter(staff => staff[COL.S_ID] !== id), renderStaff();else {
        if (type === "proposal") allProposals = allProposals.filter(proposal => proposal[COL.PR_ID] !== id), renderProposals();else type === "app" && (allApps = allApps.filter(app => app[COL.A_ID] !== id), renderApps());
      }
    }
  }
}
function refreshProjectDetailsModalIfOpen() {
  const projectDetailsModalEl = document.getElementById("project-details-modal");
  if (projectDetailsModalEl && projectDetailsModalEl.classList.contains("active")) {
    const textContent = projectDetailsModalEl.querySelector("h3")?.textContent || "",
      match = textContent.match(/\(([^)]+)\)$/);
    if (match && match[1]) {
      const match2 = match[1],
        project = allProjects.find(project2 => project2[COL.P_ID] === match2);
      project && showProjectDetailsModal(match2, project[COL.P_NAME]);
    }
  }
}
function validateStaffData(name, email, isEdit = false, staffId = null) {
  const list = [],
    duplicateName = allStaff.find(staff => staff[COL.S_NAME].toLowerCase() === name.toLowerCase() && (!isEdit || staff[COL.S_ID] !== staffId));
  duplicateName && list.push("Tên cán bộ đã tồn tại");
  if (email && email.trim() !== "") {
    const duplicateEmail = allStaff.find(staff => staff[COL.S_EMAIL].toLowerCase() === email.toLowerCase() && (!isEdit || staff[COL.S_ID] !== staffId));
    duplicateEmail && list.push("Email đã được sử dụng");
  }
  return list;
}
function showStaffValidationError(validation) {
  const staffValidationErrorEl = document.getElementById("staff-validation-error");
  validation.length > 0 ? (staffValidationErrorEl.innerHTML = validation.map(validation2 => "<div class=\"text-red-600 text-sm\">" + escapeHtml(validation2) + "</div>").join(""), staffValidationErrorEl.classList.remove("hidden")) : staffValidationErrorEl.classList.add("hidden");
}
function renderTaskStats() {
  // Vòng 12e: 4 thẻ đếm PHẢI cùng phạm vi với danh sách bên dưới. Trước đây chỗ này có bộ lọc
  // riêng, hẹp hơn (chỉ nhiệm vụ của mình + công việc mình quản lý) nên Phó GĐ/TP/PP thấy nhiệm
  // vụ trong danh sách mà 4 thẻ trên đầu vẫn hiện 0. Dùng lại `dsNhiemVuToiDuocThay()` — một
  // nguồn sự thật cho cả tab, thêm vai mới chỉ phải sửa một chỗ.
  const allTasks2 = dsNhiemVuToiDuocThay().filter(isCountableRow),
    filteredTasks2 = allTasks2.filter(taskMatchesTasksFilters),
    data = {
      pending: filteredTasks2.filter(filteredTasks22 => (filteredTasks22[COL.T_STATUS] || "").toLowerCase().includes("chưa")).length,
      active: filteredTasks2.filter(filteredTasks22 => (filteredTasks22[COL.T_STATUS] || "").toLowerCase().includes("đang")).length,
      completed: filteredTasks2.filter(filteredTasks22 => (filteredTasks22[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
      paused: filteredTasks2.filter(filteredTasks22 => (filteredTasks22[COL.T_STATUS] || "").toLowerCase().includes("tạm dừng")).length
    };
  document.getElementById("tasks-pending-count").innerHTML = "<i class=\"fas fa-pause-circle text-sm\"></i>" + escapeHtml(data.pending), document.getElementById("tasks-active-count").innerHTML = "<i class=\"fas fa-play-circle text-sm\"></i>" + escapeHtml(data.active), document.getElementById("tasks-completed-count").innerHTML = "<i class=\"fas fa-check-circle text-sm\"></i>" + escapeHtml(data.completed), document.getElementById("tasks-paused-count").innerHTML = "<i class=\"fas fa-pause text-sm\"></i>" + escapeHtml(data.paused);
}
function renderProjectStats() {
  const userAllowedProjects = getUserAllowedProjects().filter(isCountableRow),
    data = {
      pending: userAllowedProjects.filter(userAllowedProject => (userAllowedProject[COL.P_STATUS] || "").toLowerCase().includes("chưa")).length,
      active: userAllowedProjects.filter(userAllowedProject => (userAllowedProject[COL.P_STATUS] || "").toLowerCase().includes("đang")).length,
      completed: userAllowedProjects.filter(userAllowedProject => (userAllowedProject[COL.P_STATUS] || "").toLowerCase().includes("hoàn thành")).length,
      paused: userAllowedProjects.filter(userAllowedProject => (userAllowedProject[COL.P_STATUS] || "").toLowerCase().includes("tạm dừng")).length,
      canceled: userAllowedProjects.filter(userAllowedProject => (userAllowedProject[COL.P_STATUS] || "").toLowerCase().includes("hủy bỏ")).length
    };
  document.getElementById("projects-pending-count").innerHTML = "<i class=\"fas fa-pause-circle text-sm\"></i>" + escapeHtml(data.pending), document.getElementById("projects-active-count").innerHTML = "<i class=\"fas fa-play-circle text-sm\"></i>" + escapeHtml(data.active), document.getElementById("projects-completed-count").innerHTML = "<i class=\"fas fa-check-circle text-sm\"></i>" + escapeHtml(data.completed), document.getElementById("projects-paused-count").innerHTML = "<i class=\"fas fa-pause text-sm\"></i>" + escapeHtml(data.paused), document.getElementById("projects-canceled-count").innerHTML = "<i class=\"fas fa-times-circle text-sm\"></i>" + escapeHtml(data.canceled);
}
function loadChatMessages() {
  return napChatTuServer();
}
// --- Chat: hỏi lại mỗi 10 giây (việc 7.3) ------------------------------------------------------
// Mốc `since` do MÁY CHỦ cấp trong mỗi phản hồi, client không tự tính từ đồng hồ của mình: lệch
// vài giây giữa máy trạm và máy chủ là mất tin (mốc quá mới) hoặc lặp tin (mốc quá cũ).
// Khoảng 3 ngày / 50 tin do máy chủ canh; ở đây chỉ cắt lại 50 cho danh sách đang giữ trong bộ nhớ.
const CHAT_POLL_MS = 10000, CHAT_TOI_DA = 50;
let chatTinNhan = [], chatSince = null, chatPollTimer = null;

/** Dòng REST (`created_at`) → hình dạng renderChatMessages đọc. Cùng luật với chatToLegacy ở máy chủ. */
function chatTuRest(row) {
  const date = new Date(row.created_at), hai = n => String(n).padStart(2, "0"),
    userName = row.user_name || "";
  return {
    id: row.id,
    user: userName,
    avatar: userName.trim().split(/\s+/).filter(Boolean).map(item => item[0]).join("").toUpperCase().slice(0, 2),
    timestamp: hai(date.getHours()) + ":" + hai(date.getMinutes()),
    chatDate: date.toDateString(),
    message: row.message || ""
  };
}

/** Gộp tin mới, bỏ trùng theo id — lượt hỏi lại và lần vừa gửi có thể trả cùng một tin. */
function gopTinChat(moi) {
  if (!Array.isArray(moi) || moi.length === 0) return 0;
  const daCo = new Set(chatTinNhan.map(item => item.id)),
    them = moi.filter(item => item && !daCo.has(item.id));
  return chatTinNhan = chatTinNhan.concat(them).slice(-CHAT_TOI_DA), them.length;
}

/** Một lượt nạp. `dauTien` = mở lại khung: bỏ mốc cũ, lấy trọn 3 ngày gần nhất và vẽ lại dù rỗng. */
async function napChatTuServer(options) {
  const dauTien = !!(options && options.dauTien);
  if (dauTien) chatTinNhan = [], chatSince = null;
  const duLieu = await restGetIm("/api/v1/chat" + (chatSince ? "?since=" + encodeURIComponent(chatSince) : ""));
  if (!duLieu) return 0;
  chatSince = duLieu.since || chatSince;
  const soMoi = gopTinChat((duLieu.messages || []).map(row => chatTuRest(row)));
  return (soMoi > 0 || dauTien) && (renderChatMessages(chatTinNhan), updateChatBadge(chatTinNhan.length)), soMoi;
}

/** Bật vòng hỏi lại. Chỉ hỏi khi đang xem Tổng quan — tab để mở ở trang khác không cần tin mới. */
function batDauHoiLaiChat() {
  dungHoiLaiChat(), chatPollTimer = setInterval(() => {
    currentSection === "overview" && document.getElementById("chat-messages") && napChatTuServer();
  }, CHAT_POLL_MS);
}
function dungHoiLaiChat() {
  chatPollTimer && (clearInterval(chatPollTimer), chatPollTimer = null);
}
// ============================================================================
// PHASE 7 việc 7.5 — Xuất Excel: 3 liên kết tĩnh trong menu, chỉ gắn thêm bộ lọc tháng
//
// KHÔNG dựng dữ liệu ở trình duyệt và KHÔNG gửi tham số phạm vi nào: máy chủ lọc theo đúng hàm
// của API danh sách (việc 7.6). Ở đây chỉ nối `?month=` để số dòng trong file khớp số mục đang
// hiện trên màn hình khi người dùng đang lọc tháng.
// ============================================================================
const XUAT_EXCEL_LINK = { "export-works": "works", "export-tasks": "tasks", "export-stats": "stats" };

/** Ngày cuối của tháng "YYYY-MM" — mẫu thống kê nhận khoảng from/to chứ không nhận `month`. */
function cuoiThangCua(thang) {
  const [nam, thangSo] = thang.split("-").map(Number);
  return thang + "-" + String(new Date(nam, thangSo, 0).getDate()).padStart(2, "0");
}
function capNhatLinkXuatExcel() {
  // 2026-08-28: nguồn tháng là hai ô Tháng/Năm (thangLocCongViec) thay cho ô
  // <input type="month"> cũ — phạm vi xuất vẫn ĐÚNG bằng phạm vi đang xem.
  const thang = thangLocCongViec();
  Object.keys(XUAT_EXCEL_LINK).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const mau = XUAT_EXCEL_LINK[id];
    let url = "/api/v1/export/" + mau + ".xlsx";
    if (thang) {
      url += mau === "stats"
        ? "?from=" + thang + "-01&to=" + cuoiThangCua(thang)
        : "?month=" + thang;
    }
    el.setAttribute("href", url);
  });
}
function updateChatBadge(count) {
  const chatBadgeEl = document.getElementById("chat-badge");
  chatBadgeEl && (count > 0 ? (chatBadgeEl.textContent = count, chatBadgeEl.classList.remove("hidden")) : chatBadgeEl.classList.add("hidden"));
}
function renderChatMessages(messages) {
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!messages || messages.length === 0) {
    chatMessagesEl.innerHTML = "<div class=\"text-center text-gray-500 text-sm\">Chưa có tin nhắn nào</div>";
    return;
  }
  chatMessagesEl.innerHTML = messages.map(message => {
    const flag = message.user === currentUser.name;
    return "\n  <div class=\"flex items-start gap-3 " + (flag ? "flex-row-reverse" : "") + "\">\n    <div class=\"w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold\">\n      " + escapeHtml(message.avatar) + "\n    </div>\n    <div class=\"flex-1 " + (flag ? "text-right" : "") + "\">\n      <div class=\"flex items-center gap-2 mb-1 " + (flag ? "justify-end" : "") + "\">\n        <span class=\"font-medium text-sm text-gray-900\">" + escapeHtml(message.user) + "</span>\n        <span class=\"text-xs text-gray-500\">" + escapeHtml(formatChatTime(message.timestamp, message.chatDate)) + "</span>\n      </div>\n      <div class=\"text-sm text-gray-700 " + (flag ? "bg-blue-100 rounded-lg px-3 py-2 inline-block" : "") + "\">" + escapeHtml(formatChatMessage(message.message)) + "</div>\n    </div>\n  </div>\n";
  }).join(""), chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}
function formatChatMessage(text) {
  return text.replace(/@(\w+)/g, "<span class=\"bg-blue-100 text-blue-800 px-1 rounded\">@$1</span>");
}
function formatChatTime(timeText, dateKey) {
  const today = new Date().toDateString(),
    now = new Date();
  now.setDate(now.getDate() - 1);
  let text = "";
  if (dateKey === today) text = "";else {
    if (dateKey === now.toDateString()) text = "Hôm qua ";else {
      const date = new Date(dateKey);
      text = date.getDate() + "/" + (date.getMonth() + 1) + " ";
    }
  }
  if (typeof timeText === "string" && timeText.match(/^\d{1,2}:\d{2}$/)) return text + timeText;
  try {
    const date = new Date(timeText);
    if (isNaN(date.getTime())) return timeText;
    const padded = String(date.getHours()).padStart(2, "0"),
      padded2 = String(date.getMinutes()).padStart(2, "0");
    return text + (padded + ":" + padded2);
  } catch (err) {
    return timeText;
  }
}
function sendChatMessage() {
  const chatInputEl = document.getElementById("chat-input"),
    trimmed = chatInputEl.value.trim();
  if (!trimmed) return;
  const sendBtn = document.getElementById("send-chat-btn");
  sendBtn.disabled = true, chatInputEl.disabled = true;
  const data = {
      id: "temp-" + Date.now(),
      user: currentUser.name,
      message: trimmed,
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      avatar: currentUser.name.split(" ").map(item => item[0]).join("").toUpperCase().slice(0, 2),
      chatDate: new Date().toDateString()
    },
    chatMessagesEl = document.getElementById("chat-messages"),
    el = document.createElement("div");
  el.id = "temp-message", el.innerHTML = "\n<div class=\"flex items-start gap-3 flex-row-reverse\">\n  <div class=\"w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold\">\n    " + escapeHtml(data.avatar) + "\n  </div>\n  <div class=\"flex-1 text-right\">\n    <div class=\"flex items-center gap-2 mb-1 justify-end\">\n      <span class=\"font-medium text-sm text-gray-900\">" + escapeHtml(data.user) + "</span>\n      <span class=\"text-xs text-gray-500\">" + escapeHtml(data.timestamp) + "</span>\n    </div>\n    <div class=\"text-sm text-gray-700 bg-blue-100 rounded-lg px-3 py-2 inline-block\">" + escapeHtml(formatChatMessage(trimmed)) + "</div>\n  </div>\n</div>\n", chatMessagesEl.appendChild(el), chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight, chatInputEl.value = "", google.script.run.withSuccessHandler(function (response) {
    if (response.success) {
      const tempMessageEl = document.getElementById("temp-message");
      if (tempMessageEl) tempMessageEl.remove();
      loadChatMessages();
    } else {
      const tempMessageEl = document.getElementById("temp-message");
      if (tempMessageEl) tempMessageEl.remove();
      showToast(response.error, "error");
    }
    sendBtn.disabled = false, chatInputEl.disabled = false, chatInputEl.focus();
  }).withFailureHandler(function (error) {
    const tempMessageEl = document.getElementById("temp-message");
    if (tempMessageEl) tempMessageEl.remove();
    showToast("Lỗi gửi tin nhắn: " + error.message, "error"), sendBtn.disabled = false, chatInputEl.disabled = false;
  }).sendChatMessage(trimmed);
}
function handleQuickCompleteTask(event) {
  if (event.target.matches(".quick-complete-checkbox")) {
    const target = event.target,
      id = target.dataset.id,
      name = target.dataset.name;
    if (!target.checked) return;
    event.preventDefault(), showConfirmDialog("Hoàn thành nhiệm vụ?", "Bạn có chắc chắn muốn đánh dấu \"" + name + "\" là đã hoàn thành không?", function () {
      target.checked = true, target.disabled = true, showToast("Đang cập nhật trạng thái...", "info");
      const task = allTasks.find(task2 => task2[COL.T_ID] === id);
      if (task) {
        const updateData = {
          id: id,
          projectId: task[COL.T_PID],
          name: task[COL.T_NAME],
          status: "Hoàn thành",
          completion: 0x64,
          description: task[COL.T_DESC] || "",
          assignee: task[COL.T_ASSIGNEE] || "",
          priority: task[COL.T_PRIORITY] || "Trung bình",
          startDate: task[COL.T_START],
          dueDate: task[COL.T_DUE],
          reportDate: formatDateToISOString(new Date()),
          target: task[COL.T_TARGET] || "",
          resultLinks: task[COL.T_RESULT_LINKS] || "",
          output: task[COL.T_OUTPUT] || "",
          notes: task[COL.T_NOTES] || ""
        };
        updateOptimisticUpdate("task", id, updateData), google.script.run.withSuccessHandler(function (response) {
          if (response.success) {
            showToast("Nhiệm vụ đã hoàn thành!", "success");
            if (currentSection === "tasks") {} else currentSection === "gantt" && renderGanttChart();
            renderStats(), renderProjectStats(), renderProjects();
          } else target.checked = false, target.disabled = false, showToast(response.error || "Lỗi cập nhật", "error"), refreshData();
        }).withFailureHandler(function (error) {
          target.checked = false, target.disabled = false, showToast("Lỗi kết nối: " + error.message, "error");
        }).updateTaskWithAuth(id, updateData);
      }
    }, function () {
      target.checked = false;
    });
  }
}
function formatDateToISOString(date) {
  if (!date) return "";
  const date2 = new Date(date);
  if (isNaN(date2.getTime())) return "";
  return date2.getFullYear() + "-" + String(date2.getMonth() + 1).padStart(2, "0") + "-" + String(date2.getDate()).padStart(2, "0");
}
function showConfirmDialog(title, message, onConfirm, onCancel, type = "success", options = {}) {
  if (!document.getElementById("custom-confirm-modal")) {
    const text = "\n        <div id=\"custom-confirm-modal\" class=\"confirm-modal-overlay\">\n            <div class=\"confirm-modal-box\">\n                <div id=\"confirm-icon-container\" class=\"w-12 h-12 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center\">\n                    <i id=\"confirm-icon\" class=\"fas fa-check text-green-600 text-xl\"></i>\n                </div>\n                <h3 id=\"confirm-title\" class=\"text-lg font-bold text-gray-900 mb-2\"></h3>\n                <p id=\"confirm-message\" class=\"text-gray-500 text-sm mb-6\"></p>\n                <div class=\"flex space-x-3 justify-center\">\n                    <button id=\"btn-cancel-confirm\" class=\"px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors\">Hủy bỏ</button>\n                    <button id=\"btn-yes-confirm\" class=\"px-6 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all\">Xác nhận</button>\n                </div>\n            </div>\n        </div>\n    ";
    document.body.insertAdjacentHTML("beforeend", text);
  }
  const customConfirmModalEl = document.getElementById("custom-confirm-modal"),
    confirmTitleEl = document.getElementById("confirm-title"),
    confirmMessageEl = document.getElementById("confirm-message"),
    btnYesConfirmEl = document.getElementById("btn-yes-confirm"),
    btnCancelConfirmEl = document.getElementById("btn-cancel-confirm"),
    confirmIconContainerEl = document.getElementById("confirm-icon-container"),
    confirmIconEl = document.getElementById("confirm-icon");
  confirmTitleEl.textContent = title, confirmMessageEl.textContent = message;
  type === "danger" ? (confirmIconContainerEl.className = "w-12 h-12 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center", confirmIconEl.className = "fas fa-sign-out-alt text-red-600 text-xl", btnYesConfirmEl.className = "px-6 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all", btnYesConfirmEl.textContent = "Đăng xuất") : (confirmIconContainerEl.className = "w-12 h-12 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center", confirmIconEl.className = "fas fa-check text-green-600 text-xl", btnYesConfirmEl.className = "px-6 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all", btnYesConfirmEl.textContent = "Xác nhận");
  // GĐ1: cho phép ghi đè chữ trên nút và icon (vd xoá phòng) mà không đụng các nơi gọi cũ.
  options && options.confirmText && (btnYesConfirmEl.textContent = options.confirmText), options && options.iconClass && (confirmIconEl.className = options.iconClass);
  customConfirmModalEl.classList.add("active");
  const el = btnYesConfirmEl.cloneNode(true),
    el2 = btnCancelConfirmEl.cloneNode(true);
  btnYesConfirmEl.parentNode.replaceChild(el, btnYesConfirmEl), btnCancelConfirmEl.parentNode.replaceChild(el2, btnCancelConfirmEl), el.addEventListener("click", () => {
    customConfirmModalEl.classList.remove("active");
    if (onConfirm) onConfirm();
  }), el2.addEventListener("click", () => {
    customConfirmModalEl.classList.remove("active");
    if (onCancel) onCancel();
  });
}
document.addEventListener("click", function (event) {
  const taskEl = event.target.closest(".task-clickable");
  if (taskEl) {
    if (event.target.closest("button") || event.target.closest("a") || event.target.matches("input[type=\"checkbox\"]") || event.target.closest(".quick-complete-checkbox")) return;
    const id = taskEl.dataset.id;
    if (document.getElementById("project-details-modal")) {
      const projectDetailsModalEl = document.getElementById("project-details-modal"),
        textContent = projectDetailsModalEl.querySelector("h3").textContent,
        projectName = textContent.replace("Chi tiết công việc: ", "").split(" (")[0],
        task = allTasks.find(task2 => task2[COL.T_ID] === id);
      task && (openedFromProjectDetails = {
        projectId: task[COL.T_PID],
        projectName: projectName
      });
    }
    canUserEditResource("task", id) && openEditModal("task", id);
    return;
  }
  const projectEl = event.target.closest(".project-clickable");
  if (projectEl) {
    if (event.target.closest("button") || event.target.closest(".action-btn") || event.target.closest("a")) return;
    const id = projectEl.dataset.id,
      name = projectEl.dataset.name;
    showProjectDetailsModal(id, name);
  }
}), document.addEventListener("dragstart", function (event) {
  event.target.classList.contains("draggable-item") && (draggedItem = event.target, draggedProjectId = event.target.dataset.projectId, event.target.classList.add("dragging"), event.dataTransfer.effectAllowed = "move");
}), document.addEventListener("dragend", function (event) {
  event.target.classList.contains("draggable-item") && (event.target.classList.remove("dragging"), draggedItem = null, draggedProjectId = null, document.querySelectorAll(".drag-placeholder").forEach(item => item.remove()));
}), document.addEventListener("dragover", function (event) {
  event.preventDefault();
  if (!draggedItem) return;
  const containerEl = event.target.closest(".gantt-project-tasks, tbody, .space-y-3");
  if (!containerEl) return;
  const dragAfterElement = getDragAfterElement(containerEl, event.clientY),
    draggableEl = event.target.closest(".draggable-item");
  if (draggableEl) {
    const projectId = draggableEl.dataset.projectId;
    if (projectId !== draggedProjectId) return;
  } else {}
  dragAfterElement == null ? containerEl.appendChild(draggedItem) : dragAfterElement.dataset.projectId === draggedProjectId && containerEl.insertBefore(draggedItem, dragAfterElement);
}), document.addEventListener("drop", function (event) {
  event.preventDefault();
  if (!draggedItem) return;
  const parentElement = draggedItem.parentElement;
  if (!parentElement) return;
  const list = [];
  let list2 = [];
  parentElement.tagName === "TBODY" ? list2 = parentElement.querySelectorAll("tr.draggable-item") : list2 = parentElement.querySelectorAll(".draggable-item");
  list2.forEach(list22 => {
    list22.dataset.projectId === draggedProjectId && list.push(list22.dataset.id);
  });
  const filteredTasks = allTasks.filter(task => task[COL.T_PID] === draggedProjectId),
    set = new Set(list),
    filtered = filteredTasks.map(filteredTask => filteredTask[COL.T_ID]).filter(item => set.has(item)),
    flag = JSON.stringify(list) !== JSON.stringify(filtered);
  if (flag && list.length > 1) handleReorderTasks(draggedProjectId, list);else {
    if (draggedItem) draggedItem.classList.remove("dragging");
    draggedItem = null, draggedProjectId = null, document.querySelectorAll(".drag-placeholder").forEach(item => item.remove());
  }
});
function getDragAfterElement(container, y) {
  const values = [...container.querySelectorAll(".draggable-item:not(.dragging)")];
  return values.reduce((acc, value) => {
    const boundingClientRect = value.getBoundingClientRect(),
      num = y - boundingClientRect.top - boundingClientRect.height / 2;
    return num < 0 && num > acc.offset ? {
      offset: num,
      element: value
    } : acc;
  }, {
    offset: Number.NEGATIVE_INFINITY
  }).element;
}
function handleReorderTasks(projectId, orderedTaskIds) {
  const filteredTasks = allTasks.filter(task => task[COL.T_PID] === projectId),
    map = new Map(filteredTasks.map(filteredTask => [filteredTask[COL.T_ID], filteredTask]));
  allTasks = allTasks.filter(task => task[COL.T_PID] !== projectId), orderedTaskIds.forEach(orderedTaskId => {
    map.has(orderedTaskId) && (allTasks.push(map.get(orderedTaskId)), map.delete(orderedTaskId));
  }), map.forEach(map2 => allTasks.push(map2)), renderTasks();
  currentSection === "gantt" && renderGanttChart();
  const projectDetailsModalEl = document.getElementById("project-details-modal");
  if (projectDetailsModalEl && projectDetailsModalEl.classList.contains("active")) {
    const el = projectDetailsModalEl.querySelector("h3");
    if (el && el.textContent.includes(projectId)) {
      const el2 = projectDetailsModalEl.querySelector(".max-h-96.overflow-y-auto");
      if (el2) {
        const filteredTasks2 = allTasks.filter(task => task[COL.T_PID] === projectId);
        if (filteredTasks2.length > 0) {
          const text = "<div class=\"space-y-3\">\n                    " + filteredTasks2.map(filteredTasks22 => createTaskListItem(filteredTasks22)).join("") + "\n                </div>";
          el2.innerHTML = text;
        }
      }
    }
  }
  showToast("Đang lưu thứ tự...", "info"), google.script.run.withSuccessHandler(() => {
    showToast("Đã lưu vị trí mới", "success");
  }).withFailureHandler(error => {
    showToast("Lỗi lưu vị trí: " + error.message, "error"), refreshData();
  }).reorderTasks(projectId, orderedTaskIds);
}
function openStatListModal(type, filter, title) {
  let list = [];
  if (type === "project") list = [...allProjects].reverse();else {
    if (type === "task") {
      if (filter === "all") list = [...allTasks];else {
        if (filter === "active") list = allTasks.filter(task => {
          const lower = (task[COL.T_STATUS] || "").toLowerCase();
          return lower.includes("đang") || lower.includes("chưa") || lower.includes("tạm dừng");
        });else filter === "overdue" && (list = allTasks.filter(task => isTaskOverdue(task[COL.T_DUE]) && !(task[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")));
      }
    }
  }
  if (currentOverviewProjectFilter) {
    if (type === "project") list = list.filter(list2 => list2[COL.P_ID] === currentOverviewProjectFilter);else type === "task" && (list = list.filter(list2 => list2[COL.T_PID] === currentOverviewProjectFilter));
  }
  currentStatListData = list;
  const text = "\n    <div id=\"stat-list-modal\" class=\"modal active z-[60]\">\n        <div class=\"modal-content glass-card max-w-7xl w-full mx-4 max-h-[90vh] flex flex-col\" style=\"padding: 1.5rem;\">\n            <div class=\"flex items-center justify-between mb-4 flex-shrink-0\">\n                <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(title) + " <span class=\"text-sm text-gray-500 font-normal\">(" + list.length + ")</span></h3>\n                <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n                    <i class=\"fas fa-times\"></i>\n                </button>\n            </div>\n            \n            \n            <div id=\"stat-filter-row\" class=\"mb-3 flex flex-wrap items-center gap-2 flex-shrink-0\">\n            <label class=\"text-xs text-gray-500\">Từ</label>\n            <input type=\"date\" id=\"stat-list-from\" class=\"form-input py-1 px-2 text-sm w-36\">\n            <label class=\"text-xs text-gray-500\">Đến</label>\n            <input type=\"date\" id=\"stat-list-to\" class=\"form-input py-1 px-2 text-sm w-36\">\n            <select id=\"stat-list-dept\" class=\"form-select py-1 px-2 text-sm w-44\">\n            <option value=\"\">Mọi phòng</option>\n            </select>\n            </div>\n<div class=\"mb-4 relative flex-shrink-0\">\n                <input type=\"text\" id=\"stat-list-search\" placeholder=\"Tìm kiếm...\" \n                        class=\"w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all\">\n                <i class=\"fas fa-search absolute left-3 top-3 text-gray-400\"></i>\n            </div>\n\n            <div id=\"stat-list-container\" class=\"overflow-y-auto flex-1 pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min\">\n                </div>\n        </div>\n    </div>\n",
    statListModalEl = document.getElementById("stat-list-modal");
  if (statListModalEl) statListModalEl.remove();
  document.body.insertAdjacentHTML("beforeend", text), renderStatListItems(type, list), typeof setupBoLocStatList === "function" && setupBoLocStatList(type), document.getElementById("stat-list-search").addEventListener("input", event => {
    const lower = event.target.value.toLowerCase(),
      filteredCurrentStatListData = currentStatListData.filter(currentStatListData2 => {
        const projectName = type === "project" ? currentStatListData2[COL.P_NAME] : currentStatListData2[COL.T_NAME],
          projectId = type === "project" ? currentStatListData2[COL.P_ID] : currentStatListData2[COL.T_ID];
        return projectName && projectName.toLowerCase().includes(lower) || projectId && projectId.toLowerCase().includes(lower);
      });
    renderStatListItems(type, filteredCurrentStatListData);
  });
  const statListModalEl2 = document.getElementById("stat-list-modal");
  statListModalEl2.querySelector(".close-modal").addEventListener("click", () => {
    statListModalEl2.remove();
  });
}
function renderStatListItems(type, items) {
  const statListContainerEl = document.getElementById("stat-list-container");
  if (!items || items.length === 0) {
    statListContainerEl.innerHTML = "<div class=\"text-center py-8 text-gray-500\">Không có dữ liệu</div>";
    return;
  }
  statListContainerEl.innerHTML = items.map(item => {
    if (type === "project") {
      const projectId = item[COL.P_ID],
        projectName = item[COL.P_NAME],
        projectStatus = item[COL.P_STATUS],
        projectManager = item[COL.P_MANAGER] || "N/A",
        startDateText = formatDateForDisplay(item[COL.P_START]),
        endDateText = formatDateForDisplay(item[COL.P_END]),
        filteredTasks = allTasks.filter(task => task[COL.T_PID] === projectId),
        filteredTaskTotal = filteredTasks.reduce((acc, filteredTask) => acc + parseInt(filteredTask[COL.T_COMPLETION] || 0), 0),
        num = filteredTasks.length > 0 ? Math.round(filteredTaskTotal / filteredTasks.length) : 0;
      return "\n            <div class=\"stat-list-item rounded-xl border border-gray-100 hover:border-blue-200 bg-white p-3 mb-2 shadow-sm transition-all\" \n                  onclick=\"showProjectDetailsModal('" + escapeForInlineHandler(projectId) + "', '" + escapeForInlineHandler(projectName) + "')\">\n                \n                <div class=\"flex justify-between items-start mb-2\">\n                    <div>\n                        <div class=\"font-bold text-gray-800 text-sm\">" + escapeHtml(projectName) + " <span class=\"text-gray-400 font-normal text-xs ml-1\">(" + escapeHtml(projectId) + ")</span></div>\n                        <div class=\"text-xs text-gray-500 mt-1 flex items-center gap-3\">\n                            <span><i class=\"fas fa-user-tie mr-1 text-purple-500\"></i>" + escapeHtml(projectManager) + "</span>\n                            <span><i class=\"fas fa-calendar-alt mr-1 text-blue-500\"></i>" + escapeHtml(startDateText) + " - " + escapeHtml(endDateText) + "</span>\n                        </div>\n                    </div>\n                    <span class=\"status-badge " + escapeHtml(getStatusClass(projectStatus)) + "\">" + escapeHtml(projectStatus) + "</span>\n                </div>\n\n                <div class=\"flex items-center gap-2\">\n                    <div class=\"flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden\">\n                        <div class=\"h-full bg-blue-500 rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                    </div>\n                    <span class=\"text-xs font-medium text-gray-600 min-w-[30px] text-right\">" + escapeHtml(num) + "%</span>\n                </div>\n            </div>\n        ";
    } else {
      const taskId = item[COL.T_ID],
        taskName = item[COL.T_NAME],
        taskStatus = item[COL.T_STATUS],
        taskPriority = item[COL.T_PRIORITY],
        taskAssignee = item[COL.T_ASSIGNEE] || "N/A",
        dueDateText = formatDateForDisplay(item[COL.T_DUE]),
        num = parseInt(item[COL.T_COMPLETION] || 0),
        isTaskOverdue2 = isTaskOverdue(item[COL.T_DUE]) && !taskStatus.toLowerCase().includes("hoàn thành"),
        project = allProjects.find(project2 => project2[COL.P_ID] === item[COL.T_PID]),
        projectName = project ? project[COL.P_NAME] : item[COL.T_PID];
      return "\n            <div class=\"stat-list-item rounded-xl border border-gray-100 hover:border-blue-200 bg-white p-3 mb-2 shadow-sm transition-all " + (isTaskOverdue2 ? "border-l-4 border-l-red-500" : "") + "\" \n                  onclick=\"if(canUserEditResource('task', '" + escapeForInlineHandler(taskId) + "')) openEditModal('task', '" + escapeForInlineHandler(taskId) + "')\">\n                \n                <div class=\"flex justify-between items-start mb-1\">\n                    <div class=\"flex-1 pr-2\">\n                        <div class=\"font-semibold text-gray-800 text-sm leading-snug\">" + escapeHtml(taskName) + "</div>\n                    </div>\n                    \n                    <div class=\"flex items-center gap-2 shrink-0\">\n                        <span class=\"status-badge " + escapeHtml(getStatusClass(taskStatus)) + "\">" + escapeHtml(taskStatus) + "</span>\n                        " + (isTaskOverdue2 ? "<span class=\"status-badge status-overdue\">Quá hạn</span>" : "") + "\n                    </div>\n                </div>\n\n                <div class=\"grid grid-cols-2 gap-y-1 text-xs text-gray-500 mt-1 mb-2\">\n                    <div class=\"col-span-2 flex items-center text-gray-600 font-medium\">\n                        <i class=\"fas fa-folder-open mr-1.5 text-yellow-500\"></i>" + escapeHtml(projectName) + "\n                    </div>\n                    <div class=\"flex items-center\">\n                        <i class=\"fas fa-user mr-1.5 text-blue-400\"></i>" + escapeHtml(taskAssignee) + "\n                    </div>\n                    <div class=\"flex items-center justify-end\">\n                        <i class=\"fas fa-clock mr-1.5 " + (isTaskOverdue2 ? "text-red-500" : "text-green-500") + "\"></i>" + escapeHtml(dueDateText) + "\n                    </div>\n                </div>\n\n                <div class=\"flex items-center gap-2\">\n                    <div class=\"flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden\">\n                        <div class=\"h-full " + (num === 100 ? "bg-green-500" : "bg-blue-500") + " rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                    </div>\n                    <span class=\"text-xs font-medium text-gray-600 min-w-[30px] text-right\">" + escapeHtml(num) + "%</span>\n                </div>\n            </div>\n        ";
    }
  }).join("");
}
function renderProposals() {
  const proposalsGridEl = document.getElementById("proposals-grid");
  if (!proposalsGridEl) return;
  let allProposals2 = allProposals;
  !isAdmin() && (allProposals2 = allProposals.filter(proposal => proposal[COL.PR_CREATOR] === currentUser?.name));
  let allProposals22 = allProposals2;
  currentProposalFilter && (allProposals22 = allProposals2.filter(proposals2 => (proposals2[COL.PR_STATUS] || "Đề xuất mới") === currentProposalFilter));
  const value = document.getElementById("proposal-type-filter")?.value || "";
  value && (allProposals22 = allProposals22.filter(proposals22 => (proposals22[COL.PR_TYPE] || "Ngoài kế hoạch") === value));
  const searchQuery = (document.getElementById("proposal-search")?.value || "").toLowerCase().trim();
  searchQuery && (allProposals22 = allProposals22.filter(proposals22 => {
    const lower = (proposals22[COL.PR_CONTENT] || "").toLowerCase(),
      lower2 = (proposals22[COL.PR_ID] || "").toLowerCase(),
      lower3 = (proposals22[COL.PR_CREATOR] || "").toLowerCase();
    return lower.includes(searchQuery) || lower2.includes(searchQuery) || lower3.includes(searchQuery);
  }));
  updateProposalCounts();
  if (!allProposals22 || allProposals22.length === 0) {
    proposalsGridEl.innerHTML = "<div class=\"glass-card p-8 text-center text-gray-500\">Chưa có đề nghị nào</div>";
    return;
  }
  const data = {
    "Đề xuất mới": {
      color: "blue",
      icon: "fa-file-alt",
      proposals: []
    },
    "Chờ duyệt": {
      color: "amber",
      icon: "fa-clock",
      proposals: []
    },
    "Đã duyệt": {
      color: "green",
      icon: "fa-check-circle",
      proposals: []
    },
    "Từ chối": {
      color: "red",
      icon: "fa-times-circle",
      proposals: []
    }
  };
  allProposals22.forEach(proposals22 => {
    const proposalStatus = proposals22[COL.PR_STATUS] || "Đề xuất mới";
    data[proposalStatus] && data[proposalStatus].proposals.push(proposals22);
  });
  let text = "";
  Object.entries(data).forEach(([item, item2]) => {
    if (item2.proposals.length === 0 && currentProposalFilter) return;
    if (item2.proposals.length === 0) return;
    text += "\n            <div class=\"glass-card overflow-hidden\">\n                <div class=\"proposal-group-header bg-" + escapeHtml(item2.color) + "-50 text-" + escapeHtml(item2.color) + "-700\">\n                    <i class=\"fas " + escapeHtml(item2.icon) + "\"></i>\n                    <span>" + escapeHtml(item) + "</span>\n                    <span class=\"ml-auto bg-" + escapeHtml(item2.color) + "-100 px-2 py-1 rounded-full text-xs\">" + item2.proposals.length + "</span>\n                </div>\n                <div class=\"proposal-table-wrapper\">\n                    <!-- Header row -->\n                    <div class=\"proposal-header-row\" style=\"grid-template-columns: 120px 1fr 1fr 120px 100px 80px;\">\n                        <div class=\"sticky left-0 z-10 bg-white border-r border-gray-100 shadow-sm flex items-center justify-center\">Loại/Mã</div>\n                        <div>Thông tin</div>\n                        <div>Nội dung đề nghị</div>\n                        <div>Người tạo</div>\n                        <div>Ngày tạo</div>\n                        <div class=\"text-center\">Thao tác</div>\n                    </div>\n                    <div class=\"divide-y divide-gray-100\">\n                        " + item2.proposals.map(item3 => createProposalRow(item3)).join("") + "\n                    </div>\n                </div>\n            </div>";
  }), proposalsGridEl.innerHTML = text || "<div class=\"glass-card p-8 text-center text-gray-500\">Không có đề nghị nào</div>", proposalsGridEl.querySelectorAll(".proposal-row.clickable").forEach(item => {
    item.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      const id = item.dataset.id;
      openEditModal("proposal", id);
    });
  });
}
function createProposalRow(proposal) {
  const proposalId = proposal[COL.PR_ID] || "",
    proposalType = proposal[COL.PR_TYPE] || "Ngoài kế hoạch",
    proposalContent = proposal[COL.PR_CONTENT] || "",
    proposalCreator = proposal[COL.PR_CREATOR] || "",
    dateText = formatDateForDisplay(proposal[COL.PR_DATE]),
    proposalPid = proposal[COL.PR_PID] || "",
    proposalTid = proposal[COL.PR_TID] || "",
    proposalUrl = proposal[COL.PR_URL] || "",
    proposalStatus = proposal[COL.PR_STATUS] || "Đề xuất mới",
    proposalNote = proposal[COL.PR_NOTE] || "",
    project = allProjects.find(project2 => project2[COL.P_ID] === proposalPid),
    projectName = project ? project[COL.P_NAME] : "",
    task = allTasks.find(task2 => task2[COL.T_ID] === proposalTid),
    taskName = task ? task[COL.T_NAME] : "",
    flag = proposalType === "Trong kế hoạch",
    text = flag ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700";
  return "\n        <div class=\"proposal-row clickable\" data-id=\"" + escapeHtml(proposalId) + "\" style=\"grid-template-columns: 120px 1fr 1fr 120px 100px 80px;\">\n            <div class=\"flex flex-col items-center gap-1 sticky left-0 z-10 bg-white border-r border-gray-100 shadow-sm p-2 justify-center\">\n                <span class=\"text-[10px] px-1 py-0.5 rounded-full whitespace-nowrap " + escapeHtml(text) + "\">" + escapeHtml(proposalType) + "</span>\n                <span class=\"text-xs font-mono text-gray-500\">" + escapeHtml(proposalId) + "</span>\n            </div>\n            <div>\n                " + (flag && projectName ? "<p class=\"text-xs text-gray-500\"><i class=\"fas fa-folder mr-1\"></i>" + escapeHtml(projectName) + " " + (taskName ? "→ " + escapeHtml(taskName) : "") + "</p>" : "<p class=\"text-xs text-gray-400\">Ngoài kế hoạch</p>") + "\n                <div class=\"mt-1\">\n                    " + renderLinksButton(proposalUrl, proposalId) + "\n                </div>\n                " + (proposalNote ? "<p class=\"text-xs text-orange-600 mt-1\"><i class=\"fas fa-comment-alt mr-1\"></i>Ghi chú: " + escapeHtml(proposalNote) + "</p>" : "") + "\n            </div>\n            <div>\n                <p class=\"text-sm text-gray-900 line-clamp-3\">" + escapeHtml(proposalContent) + "</p>\n            </div>\n            <div class=\"text-sm text-gray-600\">\n                <i class=\"fas fa-user mr-1\"></i>" + escapeHtml(proposalCreator) + "\n            </div>\n            <div class=\"text-sm text-gray-500\">\n                <i class=\"fas fa-calendar mr-1\"></i>" + escapeHtml(dateText) + "\n            </div>\n            <div class=\"flex gap-2 justify-center\">\n                " + (canUserEditResource("proposal", proposalId) ? "\n                <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"proposal\" data-id=\"" + escapeHtml(proposalId) + "\" title=\"Chỉnh sửa\" onclick=\"event.stopPropagation(); openEditModal('proposal', '" + escapeForInlineHandler(proposalId) + "')\">\n                    <i class=\"fas fa-edit\"></i>\n                </button>" : "") + "\n                " + (canUserDeleteResource("proposal", proposalId) ? "\n                <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"proposal\" data-id=\"" + escapeHtml(proposalId) + "\" data-name=\"" + escapeHtml(proposalId) + "\" title=\"Xóa\" onclick=\"event.stopPropagation(); confirmDelete('proposal', '" + escapeForInlineHandler(proposalId) + "', '" + escapeForInlineHandler(proposalId) + "')\">\n                    <i class=\"fas fa-trash\"></i>\n                </button>" : "") + "\n            </div>\n        </div>";
}
function updateProposalCounts() {
  let allProposals2 = allProposals;
  !isAdmin() && (allProposals2 = allProposals.filter(proposal => proposal[COL.PR_CREATOR] === currentUser?.name));
  const data = {
      all: allProposals2.length,
      new: allProposals2.filter(proposals2 => (proposals2[COL.PR_STATUS] || "Đề xuất mới") === "Đề xuất mới").length,
      pending: allProposals2.filter(proposals2 => proposals2[COL.PR_STATUS] === "Chờ duyệt").length,
      approved: allProposals2.filter(proposals2 => proposals2[COL.PR_STATUS] === "Đã duyệt").length,
      rejected: allProposals2.filter(proposals2 => proposals2[COL.PR_STATUS] === "Từ chối").length
    },
    proposalCountAllEl = document.getElementById("proposal-count-all"),
    proposalCountNewEl = document.getElementById("proposal-count-new"),
    proposalCountPendingEl = document.getElementById("proposal-count-pending"),
    proposalCountApprovedEl = document.getElementById("proposal-count-approved"),
    proposalCountRejectedEl = document.getElementById("proposal-count-rejected");
  if (proposalCountAllEl) proposalCountAllEl.textContent = data.all;
  if (proposalCountNewEl) proposalCountNewEl.textContent = data.new;
  if (proposalCountPendingEl) proposalCountPendingEl.textContent = data.pending;
  if (proposalCountApprovedEl) proposalCountApprovedEl.textContent = data.approved;
  if (proposalCountRejectedEl) proposalCountRejectedEl.textContent = data.rejected;
}
function setupProposalTabEvents() {
  document.querySelectorAll(".proposal-status-tab").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".proposal-status-tab").forEach(item2 => item2.classList.remove("active")), item.classList.add("active"), currentProposalFilter = item.dataset.status, renderProposals();
    });
  });
}
function createProposalModal(isEdit, proposal) {
  const text = "proposal-modal",
    text2 = isEdit ? "Chỉnh sửa đề nghị" : "Tạo đề nghị mới",
    proposalType = proposal?.[COL.PR_TYPE] || "Trong kế hoạch",
    proposalPid = proposal?.[COL.PR_PID] || "",
    proposalTid = proposal?.[COL.PR_TID] || "",
    proposalContent = proposal?.[COL.PR_CONTENT] || "",
    proposalUrl = proposal?.[COL.PR_URL] || "",
    proposalStatus = proposal?.[COL.PR_STATUS] || "Đề xuất mới",
    proposalNote = proposal?.[COL.PR_NOTE] || "",
    proposalSupplier = proposal?.[COL.PR_SUPPLIER] || "",
    flag = proposalType === "Trong kế hoạch",
    showAdminFields = isAdmin(),
    filteredStaff = allStaff.filter(staff => staff[COL.S_OBJECT_TYPE] === "Nhà cung cấp"),
    joined = filteredStaff.map(filteredStaff2 => "<option value=\"" + escapeHtml(filteredStaff2[COL.S_NAME]) + "\" " + (filteredStaff2[COL.S_NAME] === proposalSupplier ? "selected" : "") + ">" + escapeHtml(filteredStaff2[COL.S_NAME]) + "</option>").join(""),
    joined2 = allProjects.map(project => "<option value=\"" + escapeHtml(project[COL.P_ID]) + "\" " + (project[COL.P_ID] === proposalPid ? "selected" : "") + ">" + escapeHtml(project[COL.P_NAME]) + " (" + escapeHtml(project[COL.P_ID]) + ")</option>").join(""),
    filteredTasks = proposalPid ? allTasks.filter(task2 => task2[COL.T_PID] === proposalPid) : [],
    joined3 = filteredTasks.map(filteredTask => "<option value=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" " + (filteredTask[COL.T_ID] === proposalTid ? "selected" : "") + ">" + escapeHtml(filteredTask[COL.T_NAME]) + " (" + escapeHtml(filteredTask[COL.T_ID]) + ")</option>").join(""),
    task = allTasks.find(task2 => task2[COL.T_ID] === proposalTid),
    text3 = task ? "\n            <div class=\"bg-gray-50 p-3 rounded-lg text-sm space-y-1 mt-2\" id=\"task-details-preview\">\n                <p><strong>Nhiệm vụ:</strong> " + escapeHtml(task[COL.T_NAME]) + "</p>\n                <p><strong>Cán bộ trực tiếp:</strong> " + (escapeHtml(task[COL.T_ASSIGNEE]) || "Chưa gán") + "</p>\n                <p><strong>Trạng thái:</strong> " + (escapeHtml(task[COL.T_STATUS]) || "Chưa bắt đầu") + "</p>\n                <p><strong>Tiến độ:</strong> " + (escapeHtml(task[COL.T_COMPLETION]) || 0) + "%</p>\n            </div>\n        " : "",
    text4 = "\n        <div id=\"" + escapeHtml(text) + "\" class=\"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] modal-overlay\">\n            <div class=\"modal-content glass-card max-w-7xl w-full mx-4 max-h-[90vh] overflow-y-auto\" style=\"padding: 0;\">\n                <div class=\"border-b border-gray-100 px-6 py-4 relative\">\n                    <button onclick=\"closeModal('" + escapeForInlineHandler(text) + "')\" class=\"text-gray-400 hover:text-gray-600 absolute top-4 right-6 z-10\">\n                        <i class=\"fas fa-times text-xl\"></i>\n                    </button>\n                    <div class=\"grid grid-cols-1 md:grid-cols-2 gap-6 items-center\">\n                        <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(text2) + "</h3>\n                        <div class=\"flex items-center justify-center\">\n                            <button id=\"proposal-submit-btn\" type=\"submit\" form=\"proposal-form\" class=\"btn-primary\">\n                                " + (isEdit ? "Cập nhật" : "Tạo đề nghị") + "\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div class=\"p-6\">\n                    <form id=\"proposal-form\" class=\"grid grid-cols-1 md:grid-cols-2 gap-6\" onsubmit=\"event.preventDefault(); " + (isEdit ? "handleEdit('proposal', " + escapeHtml(JSON.stringify(proposal)) + ")" : "handleAdd('proposal')") + "\">\n                        <!-- Left Column -->\n                        <div class=\"space-y-4\">\n                            <div class=\"form-group\">\n                                <label class=\"form-label required\">Loại đề nghị</label>\n                                <select id=\"proposal-type\" class=\"form-select\" required onchange=\"toggleProposalType()\">\n                                    <option value=\"Trong kế hoạch\" " + (proposalType === "Trong kế hoạch" ? "selected" : "") + ">Trong kế hoạch</option>\n                                    <option value=\"Ngoài kế hoạch\" " + (proposalType === "Ngoài kế hoạch" ? "selected" : "") + ">Ngoài kế hoạch</option>\n                                </select>\n                            </div>\n\n                            <div id=\"in-plan-fields\" class=\"" + (flag ? "" : "hidden") + "\">\n                                <div class=\"form-group\">\n                                    <label class=\"form-label required\">Chọn dự án</label>\n                                    <select id=\"proposal-project\" class=\"form-select\" " + (flag ? "required" : "") + " onchange=\"updateProposalTasks()\">\n                                        <option value=\"\">-- Chọn dự án --</option>\n                                        " + joined2 + "\n                                    </select>\n                                </div>\n                                <div class=\"form-group mt-4\">\n                                    <label class=\"form-label required\">Chọn nhiệm vụ phụ thuộc</label>\n                                    <select id=\"proposal-task\" class=\"form-select\" " + (flag ? "required" : "") + " onchange=\"showTaskDetails()\">\n                                        <option value=\"\">-- Chọn nhiệm vụ --</option>\n                                        " + joined3 + "\n                                    </select>\n                                    <div id=\"task-details-container\">" + text3 + "</div>\n                                </div>\n                            </div>\n\n                            <div class=\"form-group\">\n                                <label class=\"form-label required\">Nội dung đề nghị</label>\n                                <textarea id=\"proposal-content\" class=\"form-textarea\" rows=\"5\" required placeholder=\"Nhập nội dung đề nghị...\">" + escapeHtml(proposalContent) + "</textarea>\n                            </div>\n                        </div>\n\n                        <!-- Right Column -->\n                        <div class=\"space-y-4\">\n                            <div class=\"form-group\">\n                                <label class=\"form-label\">URL đề nghị (link) <span class=\"text-xs text-gray-400 font-normal ml-1\">([Tên link] URL)</span></label>\n                                <textarea id=\"proposal-url\" class=\"form-textarea\" rows=\"5\" placeholder=\"Nhập mỗi link trên một dòng\">" + escapeHtml(proposalUrl) + "</textarea>\n                            </div>\n\n                            <div class=\"form-group\">\n                                <label class=\"form-label\">Nhà cung cấp</label>\n                                <select id=\"proposal-supplier\" class=\"form-select\">\n                                    <option value=\"\">-- Chọn Nhà cung cấp --</option>\n                                    " + joined + "\n                                </select>\n                            </div>\n\n                            " + (showAdminFields ? "\n                            <div class=\"pt-4 border-t border-gray-100 mt-4\">\n                                <h4 class=\"text-sm font-semibold text-gray-700 mb-3\"><i class=\"fas fa-shield-alt text-orange-500 mr-2\"></i>Phần duyệt (Admin)</h4>\n                                <div class=\"form-group mb-4\">\n                                    <label class=\"form-label\">Trạng thái</label>\n                                    <select id=\"proposal-status\" class=\"form-select\">\n                                        <option value=\"Đề xuất mới\" " + (proposalStatus === "Đề xuất mới" ? "selected" : "") + ">Đề xuất mới</option>\n                                        <option value=\"Chờ duyệt\" " + (proposalStatus === "Chờ duyệt" ? "selected" : "") + ">Chờ duyệt</option>\n                                        <option value=\"Đã duyệt\" " + (proposalStatus === "Đã duyệt" ? "selected" : "") + ">Đã duyệt</option>\n                                        <option value=\"Từ chối\" " + (proposalStatus === "Từ chối" ? "selected" : "") + ">Từ chối</option>\n                                    </select>\n                                </div>\n                                <div class=\"form-group\">\n                                    <label class=\"form-label\">Ghi chú duyệt</label>\n                                    <textarea id=\"proposal-note\" class=\"form-textarea\" rows=\"4\" placeholder=\"Nhập ghi chú duyệt...\">" + escapeHtml(proposalNote) + "</textarea>\n                                </div>\n                            </div>\n                            " : "") + "\n                        </div>\n                    </form>\n                </div>\n                <div class=\"h-4\"></div> <!-- Spacer for scrolling -->\n            </div>\n        </div>";
  return text4;
}
function toggleProposalType() {
  const value = document.getElementById("proposal-type").value,
    inPlanFieldsEl = document.getElementById("in-plan-fields"),
    proposalProjectEl = document.getElementById("proposal-project"),
    proposalTaskEl = document.getElementById("proposal-task");
  if (value === "Trong kế hoạch") {
    inPlanFieldsEl.classList.remove("hidden");
    if (proposalProjectEl) proposalProjectEl.setAttribute("required", "");
    if (proposalTaskEl) proposalTaskEl.setAttribute("required", "");
  } else {
    inPlanFieldsEl.classList.add("hidden");
    if (proposalProjectEl) proposalProjectEl.removeAttribute("required");
    if (proposalTaskEl) proposalTaskEl.removeAttribute("required");
    if (proposalProjectEl) proposalProjectEl.value = "";
    if (proposalTaskEl) proposalTaskEl.value = "";
  }
}
function updateProposalTasks() {
  const value = document.getElementById("proposal-project").value,
    proposalTaskEl = document.getElementById("proposal-task"),
    taskDetailsContainerEl = document.getElementById("task-details-container"),
    filteredTasks = value ? allTasks.filter(task => task[COL.T_PID] === value) : [];
  proposalTaskEl.innerHTML = "<option value=\"\">-- Chọn nhiệm vụ --</option>" + filteredTasks.map(filteredTask => "<option value=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\">" + escapeHtml(filteredTask[COL.T_NAME]) + " (" + escapeHtml(filteredTask[COL.T_ID]) + ")</option>").join(""), taskDetailsContainerEl && (taskDetailsContainerEl.innerHTML = "");
}
function showTaskDetails() {
  const value = document.getElementById("proposal-task").value,
    taskDetailsContainerEl = document.getElementById("task-details-container");
  if (!value || !taskDetailsContainerEl) {
    if (taskDetailsContainerEl) taskDetailsContainerEl.innerHTML = "";
    return;
  }
  const task = allTasks.find(task2 => task2[COL.T_ID] === value);
  if (!task) {
    taskDetailsContainerEl.innerHTML = "";
    return;
  }
  taskDetailsContainerEl.innerHTML = "\n            <div class=\"bg-gray-50 p-3 rounded-lg text-sm space-y-1 mt-2\">\n                <p><strong>Nhiệm vụ:</strong> " + escapeHtml(task[COL.T_NAME]) + "</p>\n                <p><strong>Cán bộ trực tiếp:</strong> " + (escapeHtml(task[COL.T_ASSIGNEE]) || "Chưa gán") + "</p>\n                <p><strong>Trạng thái:</strong> " + (escapeHtml(task[COL.T_STATUS]) || "Chưa bắt đầu") + "</p>\n                <p><strong>Tiến độ:</strong> " + (escapeHtml(task[COL.T_COMPLETION]) || 0) + "%</p>\n                " + (task[COL.T_DUE] ? "<p><strong>Hạn chót:</strong> " + escapeHtml(formatDateForDisplay(task[COL.T_DUE])) + "</p>" : "") + "\n            </div>\n        ";
}
document.addEventListener("DOMContentLoaded", function () {
  setupProposalTabEvents();
});
function formatDateRanges(dates) {
  if (dates.length === 0) return "";
  if (dates.length === 1) return "Ngày " + formatDate(dates[0]);
  const list = [];
  let firstDate = dates[0],
    startDate = dates[0];
  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1],
      currentDate = dates[i],
      num = Math.round((currentDate - prevDate) / 86400000);
    num === 1 ? startDate = currentDate : (list.push({
      start: firstDate,
      end: startDate
    }), firstDate = currentDate, startDate = currentDate);
  }
  list.push({
    start: firstDate,
    end: startDate
  });
  const mappedList = list.map(list2 => {
    return list2.start.getTime() === list2.end.getTime() ? "Ngày " + formatDate(list2.start) : "Từ ngày " + formatDate(list2.start) + " đến ngày " + formatDate(list2.end);
  });
  return mappedList.join(", ");
}
function formatDate(date) {
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
/** Chuẩn hoá tên vai trò để so khớp: bỏ hoa/thường, nhận cả hai nhãn cũ («Admin», «Quản lý»). */
function chuanHoaVaiTroApp(value) {
  const lower = String(value || "").trim().toLowerCase();
  return lower === "quản lý" ? "quản lý công việc" : lower;
}
function renderApps() {
  const appsGridEl = document.getElementById("apps-grid");
  if (!appsGridEl) return;
  if (!allApps || allApps.length === 0) {
    appsGridEl.innerHTML = "<div class=\"col-span-full text-center text-gray-500 py-8\">Chưa có ứng dụng nào</div>";
    return;
  }
  const vaiTroHienTai = chuanHoaVaiTroApp(currentUser ? currentUser.role : ""),
    isAdmin2 = isAdmin(),
    filteredApps = allApps.filter(app => {
      if (isAdmin2) return true;
      // «Phân quyền» của app là danh sách VAI TRÒ (allowed_roles), không phải tên người.
      // RỖNG = mọi vai trò đều thấy — đúng một luật với modules/apps/service.js (việc 7.2).
      const appPermissions = app[COL.A_PERMISSIONS] || "";
      if (!appPermissions.trim()) return true;
      const mapped = appPermissions.split(",").map(item => chuanHoaVaiTroApp(item));
      return mapped.includes(vaiTroHienTai);
    });
  if (filteredApps.length === 0) {
    appsGridEl.innerHTML = "<div class=\"col-span-full text-center text-gray-500 py-8\">Bạn chưa được phân quyền xem ứng dụng nào</div>";
    return;
  }
  const data = {};
  filteredApps.forEach(filteredApp => {
    const upper = (filteredApp[COL.A_CATEGORY] || "CHƯA PHÂN LOẠI").trim().toUpperCase();
    !data[upper] && (data[upper] = []), data[upper].push(filteredApp);
  });
  const sorted = Object.keys(data).sort((a, b) => {
    if (a === "CHƯA PHÂN LOẠI") return 1;
    if (b === "CHƯA PHÂN LOẠI") return -1;
    return a.localeCompare(b, "vi");
  });
  let text = "";
  sorted.forEach((sorted2, index) => {
    const data2 = data[sorted2];
    text += "\n                <div class=\"col-span-full " + (index > 0 ? "mt-6" : "mt-0") + "\">\n                    <div class=\"flex items-center gap-3 mb-2\">\n                        <div class=\"w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full\"></div>\n                        <h3 class=\"text-lg font-bold text-gray-800\">" + escapeHtml(sorted2) + "</h3>\n                        <span class=\"text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full\">" + data2.length + " ứng dụng</span>\n                    </div>\n                </div>\n            ", data2.forEach(data22 => {
      const appIcon = data22[COL.A_ICON] || "https://cdn-icons-png.flaticon.com/512/3212/3212608.png",
        appName = data22[COL.A_NAME] || "No Name",
        appDesc = data22[COL.A_DESC] || "",
        appId = data22[COL.A_ID],
        appUrl = data22[COL.A_URL] || "#",
        appPermissions = data22[COL.A_PERMISSIONS] || "",
        flag = appPermissions.trim().length > 0,
        text2 = isAdmin2 ? "\n                    <div class=\"admin-controls absolute top-2 right-2 invisible group-hover:visible flex gap-1 bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-sm transition-all z-10\">\n                        <button class=\"edit-btn p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors\" data-type=\"app\" data-id=\"" + escapeHtml(appId) + "\" title=\"Sửa\">\n                            <i class=\"fas fa-edit text-xs\"></i>\n                        </button>\n                        <button class=\"delete-btn p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors\" data-type=\"app\" data-id=\"" + escapeHtml(appId) + "\" title=\"Xóa\">\n                            <i class=\"fas fa-trash text-xs\"></i>\n                        </button>\n                    </div>\n                " : "",
        text3 = isAdmin2 && flag ? "bg-gradient-to-r from-blue-100/80 via-purple-100/60" : "";
      text += "\n                    <div class=\"glass-card hover:shadow-lg transition-all duration-300 cursor-pointer group relative p-3 flex items-center gap-3 border border-gray-100/50 hover:border-blue-200 " + escapeHtml(text3) + "\" onclick=\"handleAppRedirect('" + escapeForInlineHandler(appUrl) + "', event)\" " + (flag && isAdmin2 ? "title=\"Đã phân quyền: " + escapeHtml(appPermissions) + "\"" : "") + ">\n                        " + text2 + "\n                        <div class=\"w-10 h-10 rounded-xl shadow overflow-hidden transform group-hover:scale-105 transition-transform duration-300 bg-white p-0.5 flex-shrink-0\">\n                            <img src=\"" + escapeHtml(safeUrl(appIcon)) + "\" class=\"w-full h-full object-contain rounded-lg\" onerror=\"this.src='https://cdn-icons-png.flaticon.com/512/3212/3212608.png'\" alt=\"" + escapeHtml(appName) + "\">\n                        </div>\n                        <div class=\"flex-1 min-w-0\">\n                            <h4 class=\"font-semibold text-gray-800 text-sm group-hover:text-blue-600 transition-colors truncate\" title=\"" + escapeHtml(appName) + "\">" + escapeHtml(appName) + "</h4>\n                            <p class=\"text-xs text-gray-500 truncate\">" + escapeHtml(appDesc) + "</p>\n                        </div>\n                    </div>\n                ";
    });
  }), appsGridEl.innerHTML = text;
}
function handleAppRedirect(url, event) {
  if (event && event.target.closest(".edit-btn, .delete-btn, .admin-controls")) return;
  if (!url || url === "#" || url.trim() === "") {
    showToast("Ứng dụng này chưa có liên kết", "info");
    return;
  }
  showConfirmDialog("Mở ứng dụng", "Bạn muốn mở ứng dụng này?", () => {
    const text = "app-iframe-" + Date.now(),
      text2 = "app-loader-" + Date.now(),
      text3 = "\n                    <div id=\"app-iframe-modal\" class=\"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]\">\n                        <div class=\"bg-white rounded-2xl shadow-2xl w-[95vw] h-[95vh] flex flex-col overflow-hidden\">\n                            <div class=\"flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white\">\n                                <h3 class=\"text-lg font-bold text-gray-900 truncate pr-4\" title=\"" + escapeHtml(url) + "\">Ứng dụng</h3>\n                                <div class=\"flex items-center gap-2 flex-shrink-0\">\n                                    <button onclick=\"document.getElementById('" + escapeForInlineHandler(text2) + "').classList.remove('hidden'); document.getElementById('" + escapeForInlineHandler(text) + "').src = document.getElementById('" + escapeForInlineHandler(text) + "').src\" \n                                        class=\"p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors\" title=\"Làm mới\">\n                                        <i class=\"fas fa-sync-alt\"></i>\n                                    </button>\n                                    <a href=\"" + escapeHtml(safeUrl(url)) + "\" target=\"_blank\" \n                                        class=\"flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors\" title=\"Mở trong tab mới\">\n                                        <i class=\"fas fa-external-link-alt mr-1\"></i>Tab mới\n                                    </a>\n                                    <button onclick=\"document.getElementById('app-iframe-modal').remove()\" \n                                        class=\"p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors\">\n                                        <i class=\"fas fa-times text-xl\"></i>\n                                    </button>\n                                </div>\n                            </div>\n                            <div class=\"flex-1 relative w-full h-full bg-gray-50\">\n                                <div id=\"" + escapeHtml(text2) + "\" class=\"absolute inset-0 flex flex-col items-center justify-center bg-white z-10\">\n                                    <div class=\"w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3\"></div>\n                                    <p class=\"text-gray-500 font-medium animate-pulse\">Đang tải ứng dụng...</p>\n                                </div>\n                                <iframe id=\"" + escapeHtml(text) + "\" src=\"" + escapeHtml(safeUrl(url)) + "\" class=\"w-full h-full border-0\"\n                                    onload=\"document.getElementById('" + escapeForInlineHandler(text2) + "').classList.add('hidden')\">\n                                </iframe>\n                            </div>\n                        </div>\n                    </div>\n                ";
    document.body.insertAdjacentHTML("beforeend", text3);
  }, null);
}
/**
 * Số thứ tự ngày (số nguyên) — bẫy §13.5(b): chuỗi 'yyyy-mm-dd' phân tích ra 00:00 UTC = 07:00 ICT,
 * nên so Date thô với mốc nửa đêm giờ máy lệch một ngày (nhiệm vụ cuối tháng bị coi là ngoài phạm vi).
 * Vì vậy tách y/m/d bằng chuỗi rồi quy về SỐ NGÀY, không so sánh Date.
 */
function phanTichYMDNgay(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : [value.getFullYear(), value.getMonth() + 1, value.getDate()];
  const text = String(value).trim(),
    iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/),
    vn = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) return [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  if (vn) return [Number(vn[3]), Number(vn[2]), Number(vn[1])];
  const date = new Date(text);
  return isNaN(date.getTime()) ? null : [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}
function soThuTuNgay(value) {
  const ymd = phanTichYMDNgay(value);
  return ymd ? Math.floor(Date.UTC(ymd[0], ymd[1] - 1, ymd[2]) / 864e5) : null;
}
/**
 * Luật lọc tháng (2026-08-27): nhiệm vụ hiện khi khoảng [Ngày bắt đầu, Hạn chót] GIAO với
 * [đầu tháng, cuối tháng] đang chọn. CHỐT: nhiệm vụ không có ngày nào thì ẨN khi đang lọc tháng.
 */
function taskMatchesDateFilter(task) {
  const thang = Number(tasksXemThang),
    nam = Number(tasksXemNam);
  if (!(thang >= 1 && thang <= 12) || !(nam >= 1900 && nam <= 2200)) return true;
  const dauThang = Math.floor(Date.UTC(nam, thang - 1, 1) / 864e5),
    cuoiThang = Math.floor(Date.UTC(nam, thang, 0) / 864e5),
    batDau = soThuTuNgay(task[COL.T_START]),
    han = soThuTuNgay(task[COL.T_DUE]);
  if (batDau == null && han == null) return false;
  const a = batDau == null ? han : batDau,
    b = han == null ? batDau : han;
  return Math.min(a, b) <= cuoiThang && Math.max(a, b) >= dauThang;
}
function createAppModal(isEdit, app) {
  const text = isEdit ? "Cập nhật Ứng dụng" : "Thêm Ứng dụng mới",
    text2 = isEdit ? "Cập nhật" : "Thêm mới",
    appName = isEdit ? app[COL.A_NAME] || "" : "",
    appUrl = isEdit ? app[COL.A_URL] || "" : "",
    appIcon = isEdit ? app[COL.A_ICON] || "" : "",
    appDesc = isEdit ? app[COL.A_DESC] || "" : "",
    appCategory = isEdit ? app[COL.A_CATEGORY] || "" : "",
    appId = isEdit ? app[COL.A_ID] || "" : "",
    appPermissions = isEdit ? app[COL.A_PERMISSIONS] || "" : "",
    vaiTroApp = [["admin", "Toàn quyền"], ["Phó Giám đốc", "Phòng phụ trách"], ["Trưởng phòng", "Cả phòng"], ["Phó phòng", "Cả phòng"], ["Quản lý công việc", "Việc mình quản lý"], ["Nhân viên", "Việc của mình"]],
    mapped = appPermissions ? appPermissions.split(",").map(item => item.trim()) : [],
    joined = vaiTroApp.map(vaiTro => {
      const tenVaiTro = vaiTro[0],
        hasMatch = mapped.includes(tenVaiTro);
      return "\n                <label class=\"flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer\">\n                    <input type=\"checkbox\" name=\"app-permissions\" value=\"" + escapeHtml(tenVaiTro) + "\" " + (hasMatch ? "checked" : "") + " \n                           class=\"form-checkbox text-blue-500 rounded\">\n                    <span class=\"text-sm text-gray-700\">" + escapeHtml(tenVaiTro) + "</span>\n                    <span class=\"text-xs text-gray-400\">" + escapeHtml(vaiTro[1]) + "</span>\n                </label>\n            ";
    }).join("");
  return "\n    <div id=\"app-modal\" class=\"modal\">\n      <div class=\"modal-content max-w-lg\">\n        <div class=\"flex items-center justify-between mb-6\">\n          <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(text) + "</h3>\n          <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n            <i class=\"fas fa-times\"></i>\n          </button>\n        </div>\n        \n        <form id=\"app-form\">\n          " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + escapeHtml(appId) + "\">" : "") + "\n          \n          <div class=\"form-group\">\n            <label class=\"form-label\">Danh mục <span class=\"text-red-500\">*</span></label>\n            <input type=\"text\" name=\"" + escapeHtml(COL.A_CATEGORY) + "\" class=\"form-input\" required placeholder=\"Ví dụ: NHÂN SỰ, KẾ TOÁN\" value=\"" + escapeHtml(appCategory) + "\">\n            <p class=\"text-xs text-gray-500 mt-1\">Sẽ tự động viết hoa khi lưu.</p>\n          </div>\n\n          <div class=\"form-group\">\n            <label class=\"form-label\">Tên Ứng dụng <span class=\"text-red-500\">*</span></label>\n            <input type=\"text\" name=\"" + escapeHtml(COL.A_NAME) + "\" class=\"form-input\" required placeholder=\"Nhập tên ứng dụng\" value=\"" + escapeHtml(appName) + "\">\n          </div>\n\n          <div class=\"form-group\">\n            <label class=\"form-label\">URL Ứng dụng <span class=\"text-red-500\">*</span></label>\n            <input type=\"url\" name=\"" + escapeHtml(COL.A_URL) + "\" class=\"form-input\" required placeholder=\"Nhập link ứng dụng\" value=\"" + escapeHtml(appUrl) + "\">\n          </div>\n\n          <div class=\"form-group\">\n            <label class=\"form-label\">URL Icon (Ảnh)</label>\n            <input type=\"url\" name=\"" + escapeHtml(COL.A_ICON) + "\" class=\"form-input\" placeholder=\"Nhập link Icon\" value=\"" + escapeHtml(appIcon) + "\">\n            <p class=\"text-xs text-gray-500 mt-1\">Nên dùng ảnh vuông, trong suốt (PNG).</p>\n          </div>\n\n          <div class=\"form-group\">\n            <label class=\"form-label\">Mô tả</label>\n            <textarea name=\"" + escapeHtml(COL.A_DESC) + "\" class=\"form-textarea h-24\" placeholder=\"Mô tả ngắn về ứng dụng...\">" + escapeHtml(appDesc) + "</textarea>\n          </div>\n          \n          <div class=\"form-group\">\n            <label class=\"form-label\">Phân quyền <span class=\"text-xs text-gray-400\">(Chọn vai trò được xem app này)</span></label>\n            <div class=\"border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2 bg-gray-50\">\n              " + joined + "\n            </div>\n            <p class=\"text-xs text-gray-500 mt-1\"><i class=\"fas fa-info-circle mr-1\"></i>Admin luôn thấy tất cả app. Không chọn vai trò nào = mọi người đều thấy app này.</p>\n          </div>\n          \n          <div class=\"flex justify-end space-x-3 mt-6\">\n            <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n            <button type=\"submit\" class=\"btn-primary\">\n                " + escapeHtml(text2) + "\n            </button>\n          </div>\n        </form>\n      </div>\n    </div>\n    ";
}
window.renderApps = renderApps, window.handleAppRedirect = handleAppRedirect, window.createAppModal = createAppModal;

/** Hàng CÔNG VIỆC CON (mức 3) — chứa nhiệm vụ con của nó (mức 4). */
/** Cột mũi tên RIÊNG bên trái khối icon+tên: cùng cấp luôn thẳng hàng từ icon (yêu cầu 2026-08-26). */
function createGanttToggleSlotHtml(key, coNut) {
  return (
    '<span class="gantt-toggle-slot">' +
    (coNut ? createGanttToggleHtml(key) : "") +
    "</span>"
  );
}

function createGanttSubRowHtml(sub) {
  const rangeStart = ganttStartDate, rangeEnd = ganttEndDate,
    totalDays = Math.ceil((rangeEnd - rangeStart) / 86400000) + 1,
    key = "sub:" + sub.id,
    bodyId = escapeHtml("gantt-subs-" + ganttDomKey(String(sub.id))),
    an = escapeHtml(ganttThuGon.has(key) ? " hidden" : ""),
    thangXem = thangLocGantt(),
    tenThang = tenTheoThangCuaDong(sub, sub.name || "", thangXem),
    nhanNgay = [formatDateForGantt(sub.startDate), formatDateForGantt(sub.dueDate)]
        .filter(Boolean)
        .join(" - "),
      nhan = (nhanNgay ? nhanNgay + ": " : "") + tenThang,
    thanh = buildGanttCellHtml(sub.startDate, sub.dueDate, rangeStart, rangeEnd, totalDays,
      "gantt-bar-subwork", nhan, Number(sub.completion) || 0),
    soCon = (sub.children || []).length,
    // JSON tooltip đã qua escapeHtmlAttr MỘT lần trước khi đặt vào thuộc tính.
    duLieuTenJson = escapeHtmlAttr(JSON.stringify(duLieuHoverGantt(sub, thangXem)));
  return '\n<div class="gantt-item gantt-item-subwork" data-type="subwork" data-id="' + escapeHtml(sub.code || "") + '">' +
    '<div class="gantt-item-label">' +
    createGanttToggleSlotHtml(key, soCon > 0) +
    // Icon CV con = GIỐNG icon công việc cha nhưng MÀU ĐỎ (yêu cầu 2026-08-26).
    '<i class="fas fa-folder text-red-500 mr-2"></i>' +
    '<span class="gantt-hover-name truncate" data-hover-json="' + duLieuTenJson + '">' + escapeHtml(tenThang) + "</span>" +
    '<span class="gantt-task-count">' + escapeHtml(soCon) + "</span></div>" +
    '<div class="gantt-item-timeline">' + thanh + "</div></div>" +
    '\n<div id="' + bodyId + '"' + an + ">" +
    (sub.children || []).map((t) => createGanttTaskRowHtml(t)).join("") + "</div>";
}

/** Hàng NHIỆM VỤ (mức 4) — thanh bị cắt hai đầu hoặc ẩn hẳn theo khoảng (TC-STAT-13/14).
 *  Chữ cán bộ thực hiện KHÔNG còn nằm cạnh tên: thông tin đó chuyển vào thẻ tooltip. */
function createGanttTaskRowHtml(task) {
  const rangeStart = ganttStartDate, rangeEnd = ganttEndDate,
    totalDays = Math.ceil((rangeEnd - rangeStart) / 86400000) + 1,
    quaHan = isTaskOverdue(task.dueDate) && !(task.status || "").toLowerCase().includes("hoàn thành"),
    thangXem = thangLocGantt(),
    tenThang = tenTheoThangCuaDong(task, task.name || "", thangXem),
    duLieuTenJson = escapeHtmlAttr(JSON.stringify(duLieuHoverGantt(task, thangXem))),
    nhanNgay = [formatDateForGantt(task.startDate), formatDateForGantt(task.dueDate)]
        .filter(Boolean)
        .join(" - "),
      nhan = (nhanNgay ? nhanNgay + ": " : "") + tenThang,
    thanh = buildGanttCellHtml(task.startDate, task.dueDate, rangeStart, rangeEnd, totalDays,
      "gantt-bar-task" + (quaHan ? " gantt-bar-overdue" : ""), nhan, Number(task.completion) || 0);
  return '\n<div class="gantt-item" data-type="task" data-id="' + escapeHtml(task.code || "") + '">' +
    '<div class="gantt-item-label text-sm">' +
    createGanttToggleSlotHtml("", false) +
    '<span class="gantt-hover-name truncate" data-hover-json="' + duLieuTenJson + '">' + escapeHtml(tenThang) + "</span></div>" +
    '<div class="gantt-item-timeline">' + thanh + "</div></div>";
}

/** Cây gộp: mỗi nhóm một khối; cây rỗng thì ghi chú rõ khoảng đang xem. */
function createGanttTreeHtml(tree) {
  if (!tree.groups || tree.groups.length === 0 || tree.groups.every((g) => g.works.length === 0)) {
    return '\n<div class="text-center py-16 text-gray-500"><i class="fas fa-calendar-times text-4xl mb-3 opacity-30"></i>' +
      "<p>Không có công việc nào trong khoảng " + escapeHtml(formatDateForDisplay(ganttStartDate)) + " - " +
      escapeHtml(formatDateForDisplay(ganttEndDate)) + "</p></div>";
  }
  return tree.groups.map((g) => createGanttGroupRowHtml(g)).join("");
}

/**
 * renderGanttChart MỚI (việc 6.6–6.8): vẽ từ CÂY do GET /api/v1/gantt trả sẵn — phạm vi, quyền,
 * nhóm và thứ tự đều do máy chủ quyết. Bản cũ đổi tên thành renderGanttChartLegacy giữ ở trên
 * làm tham chiếu; khai báo SAU cùng nên bản này thắng mọi lời gọi hiện có.
 */
async function renderGanttChart() {
  if (currentSection !== "gantt") return;
  const ganttItemsEl = document.getElementById("gantt-items"),
    ganttHeaderEl = document.getElementById("gantt-header");
  if (!ganttItemsEl || !ganttHeaderEl) return;
  // Khoảng xem bám THÁNG/NĂM đang chọn (đầu → cuối tháng); hai ô Tháng/Năm phản chiếu lại.
  datKhoangGanttTheoThang(ganttXemThang, ganttXemNam);
  dongBoOThangNamGantt();
  const totalDays = Math.ceil((ganttEndDate - ganttStartDate) / 86400000) + 1,
    daysEl = document.querySelector(".gantt-days"),
    khungEl = document.getElementById("gantt-container");
  // Header ngày LẪN mọi thanh thời gian dùng chung lưới repeat(--gantt-so-ngay) —
  // thanh đặt bằng grid-column theo ngày nên luôn dóng đúng ô (không còn phép tính %).
  khungEl && khungEl.style.setProperty("--gantt-so-ngay", String(totalDays));
  daysEl && (daysEl.innerHTML = renderGanttDaysHtml(totalDays));

  ganttItemsEl.innerHTML =
    '\n<div class="text-center py-16 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';
  if (!(await taiCayGantt())) {
    ganttItemsEl.innerHTML =
      '<div class="text-center py-16 text-gray-500">Không tải được sơ đồ Gantt — thử lại sau.</div>';
    return;
  }
  ganttItemsEl.innerHTML = createGanttTreeHtml(ganttTreeData);
  document.querySelectorAll(".gantt-node-toggle").forEach((item) => {
    item.removeEventListener("click", xuBatThuGonGantt);
    item.addEventListener("click", xuBatThuGonGantt);
  });
  goiNutHoverGantt(); // tooltip thẻ tự vẽ — gắn MỘT lần lên vùng cây
}
function xuBatThuGonGantt() {
  doiTrangThaiThuGon(this.dataset.node);
}

/** ======================================================================
 * GANTT XEM THEO THÁNG (2026-08-26): bỏ «1/2/3 tháng» và «từ ngày – đến ngày»,
 * thay bằng dropdown THÁNG + NĂM. Khoảng xem = đầu → cuối tháng đã chọn; mọi
 * thanh màu tính bằng % nên tự cắt đúng ranh giới tháng (TC-STAT-13 giữ nguyên).
 * ==================================================================== */
let ganttXemThang = new Date().getMonth() + 1, // 1..12 — mặc định tháng hiện tại
  ganttXemNam = new Date().getFullYear(); // mặc định năm hiện tại

/** Đặt khoảng xem theo THÁNG được chọn: ngày 1 → ngày cuối tháng (năm nhuận tự đúng). */
function datKhoangGanttTheoThang(thang, nam) {
  const t = Math.round(Number(thang)),
    n = Math.round(Number(nam));
  if (!(t >= 1 && t <= 12) || !(n >= 1900 && n <= 2200)) return false;
  ganttXemThang = t;
  ganttXemNam = n;
  ganttStartDate = new Date(n, t - 1, 1);
  ganttStartDate.setHours(0, 0, 0, 0);
  ganttEndDate = new Date(n, t, 0); // ngày cuối cùng của tháng
  ganttEndDate.setHours(0, 0, 0, 0);
  return true;
}

/** Nạp option cho hai ô chọn Tháng / Năm và phản chiếu giá trị đang có (idempotent). */
function dongBoOThangNamGantt() {
  const oThang = document.getElementById("gantt-month-select"),
    oNam = document.getElementById("gantt-year-select");
  if (!oThang || !oNam) return;
  if (oThang.options.length === 0)
    for (let i = 1; i <= 12; i++) {
      const op = document.createElement("option");
      op.value = String(i);
      op.textContent = "Tháng " + i;
      oThang.appendChild(op);
    }
  const namHienTai = new Date().getFullYear(),
    cacNam = [];
  for (let y = namHienTai - 2; y <= namHienTai + 3; y++) cacNam.push(y);
  if (cacNam.indexOf(ganttXemNam) < 0) cacNam.push(ganttXemNam);
  cacNam.sort((a, b) => a - b);
  if (
    oNam.options.length !== cacNam.length ||
    String(oNam.options[oNam.options.length - 1]?.value) !== String(cacNam[cacNam.length - 1])
  ) {
    oNam.innerHTML = "";
    cacNam.forEach(y => {
      const op = document.createElement("option");
      op.value = String(y);
      op.textContent = "Năm " + y;
      oNam.appendChild(op);
    });
  }
  oThang.value = String(ganttXemThang);
  oNam.value = String(ganttXemNam);
}
function handleGanttMonthChange(event) {
  datKhoangGanttTheoThang(event.target.value, ganttXemNam) && renderGanttChart();
}
function handleGanttYearChange(event) {
  datKhoangGanttTheoThang(ganttXemThang, event.target.value) && renderGanttChart();
}


/** Ô «Nhóm theo» + hai ô Tháng/Năm — nối vào bộ lắng nghe Gantt (idempotent). */
function setupGanttPhase6Controls() {
  const groupEl = document.getElementById("gantt-group-by");
  if (groupEl && !groupEl.dataset.daNoi) {
    groupEl.dataset.daNoi = "1";
    groupEl.addEventListener("change", handleGanttGroupChange);
  }
  const oThang = document.getElementById("gantt-month-select"),
    oNam = document.getElementById("gantt-year-select");
  oThang &&
    !oThang.dataset.daNoi &&
    ((oThang.dataset.daNoi = "1"), oThang.addEventListener("change", handleGanttMonthChange));
  oNam &&
    !oNam.dataset.daNoi &&
    ((oNam.dataset.daNoi = "1"), oNam.addEventListener("change", handleGanttYearChange));
}
function handleGanttGroupChange(event) {
  ganttGroupBy = event.target.value || "department", renderGanttChart();
}

/* ===================== TOOLTIP THẺ TỰ VẼ cho TÊN công việc / nhiệm vụ =====================
 * Rê chuột lên tên (chứ KHÔNG phải thanh màu) ⇒ thẻ trắng viền đổ bóng hiện cạnh con trỏ:
 *   • Công việc: tên đầy đủ · Ban lãnh đạo kiểm soát · Lãnh đạo phòng phụ trách ·
 *     Cán bộ thực hiện (gom từ nhiệm vụ trong cây) · Tiến độ.
 *   • Nhiệm vụ: tên đầy đủ · Lãnh đạo phòng phụ trách · Cán bộ thực hiện · Tiến độ ·
 *     Kết quả đầu ra. (Chữ cán bộ cạnh tên đã BỎ khỏi hàng — xem createGanttTaskRowHtml.)
 * Toàn bộ dựng bằng BUILDER thoát ký tự đầy đủ — dữ liệu người nhập không thể thành HTML.
 */
const GANTT_HOVER_ID = "tooltip-gantt";

/** Gom danh sách cán bộ thực hiện DUY NHẤT của một công việc từ cây con của nó. */
function gomCanBoThucHienGantt(work) {
  const tap = [];
  const them = ten => {
    if (ten && ten !== "Chưa gán" && tap.indexOf(ten) < 0) tap.push(ten);
  };
  (work.tasks || []).forEach(t => them(t.assigneeName));
  (work.subs || []).forEach(s => (s.children || []).forEach(t => them(t.assigneeName)));
  return tap.join(", ");
}

/** Chuẩn bị dữ liệu hiển thị cho một dòng bất kỳ của cây Gantt.
 *  `thang` = tháng đang xem: có tên riêng thì tiêu đề thẻ hiện tên đó và thêm dòng «Tên gốc». */
function duLieuHoverGantt(dong, thang) {
  if (!dong) return null;
  if (dong.progress != null || dong.endDate)
    return {
      loai: "Công việc",
      ten: tenTheoThangCuaDong(dong, dong.name || "", thang),
      tenGoc: tenGocNeuDaDoiCuaDong(dong, dong.name || "", thang),
      banKiemSoat: dong.supervisorName || "",
      lanhDaoPhong: (dong.leaderNames || []).join(", "),
      canBo: gomCanBoThucHienGantt(dong),
      tienDo: Number(dong.progress || 0) + "%"
    };
  return {
    loai: Number(dong.level) === 2 ? "Công việc con" : "Nhiệm vụ",
    ten: tenTheoThangCuaDong(dong, dong.name || "", thang),
    tenGoc: tenGocNeuDaDoiCuaDong(dong, dong.name || "", thang),
    lanhDaoPhong: (dong.leaderNames || []).join(", "),
    canBo: dong.assigneeName || "",
    tienDo: Number(dong.completion || 0) + "%",
    ketQuaDauRa: Number(dong.level) === 3 ? dong.output || "" : ""
  };
}

/** BUILDER thẻ tooltip: MỖI giá trị/ghi chú đều escape TRỰC TIẾP bằng escapeHtml. */
function buildGanttHoverCardHtml(d) {
  if (!d) return "";
  let html =
    '<div class="tieu-de">' + escapeHtml(d.loai) + ": " + escapeHtml(d.ten || "") + "</div>";
  // Tháng đã đổi tên thì hiện TÊN CŨ ngay dưới tiêu đề; tháng không đổi thì bỏ hẳn dòng này.
  if (d.tenGoc)
    html +=
      '<div class="dong"><b>' + escapeHtml("Tên gốc") + ": </b>" + escapeHtml(d.tenGoc) + "</div>";
  if ("banKiemSoat" in d)
    html +=
      '<div class="dong"><b>' +
      escapeHtml("Ban lãnh đạo kiểm soát") +
      ": </b>" +
      escapeHtml(d.banKiemSoat || "—") +
      "</div>";
  html +=
    '<div class="dong"><b>' +
    escapeHtml("Lãnh đạo phòng phụ trách") +
    ": </b>" +
    escapeHtml(d.lanhDaoPhong || "—") +
    "</div>";
  html +=
    '<div class="dong"><b>' +
    escapeHtml("Cán bộ thực hiện") +
    ": </b>" +
    escapeHtml(d.canBo || "—") +
    "</div>";
  html +=
    '<div class="dong"><b>' +
    escapeHtml("Tiến độ") +
    ": </b>" +
    escapeHtml(d.tienDo || "—") +
    "</div>";
  if ("ketQuaDauRa" in d)
    html +=
      '<div class="dong"><b>' +
      escapeHtml("Kết quả đầu ra") +
      ": </b>" +
      escapeHtml(d.ketQuaDauRa || "—") +
      "</div>";
  return html;
}

/** Gắn MỘT lần các listener kéo-thả tooltip lên vùng cây (#gantt-items sống lại sau mỗi render). */
function goiNutHoverGantt() {
  const vung = document.getElementById("gantt-items");
  if (!vung || vung.dataset.hoverBound === "1") return;
  vung.dataset.hoverBound = "1";
  vung.addEventListener("mouseover", hienTooltipGantt);
  vung.addEventListener("mousemove", duaTooltipGantt);
  vung.addEventListener("mouseout", anTooltipGantt);
}

function theTooltipGantt() {
  let el = document.getElementById(GANTT_HOVER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = GANTT_HOVER_ID;
    document.body.appendChild(el);
  }
  return el;
}

function hienTooltipGantt(event) {
  const tenEl = event.target.closest(".gantt-hover-name");
  if (!tenEl) return;
  let duLieu = null;
  try {
    duLieu = JSON.parse(tenEl.getAttribute("data-hover-json"));
  } catch (err) {
    duLieu = null;
  }
  const el = theTooltipGantt();
  el.innerHTML = buildGanttHoverCardHtml(duLieu);
  el.style.display = "block";
  duaTooltipGantt(event);
}

function duaTooltipGantt(event) {
  const el = document.getElementById(GANTT_HOVER_ID);
  if (!el || el.style.display !== "block") return;
  const rong = el.offsetWidth,
    cao = el.offsetHeight,
    le = 14;
  let x = event.clientX + le,
    y = event.clientY + le;
  if (x + rong > window.innerWidth - 8) x = event.clientX - rong - le;
  if (y + cao > window.innerHeight - 8) y = event.clientY - cao - le;
  el.style.left = Math.max(8, x) + "px";
  el.style.top = Math.max(8, y) + "px";
}

function anTooltipGantt(event) {
  const el = document.getElementById(GANTT_HOVER_ID);
  if (!el) return;
  if (!event || !event.relatedTarget || !event.relatedTarget.closest(".gantt-hover-name"))
    el.style.display = "none";
}

// ============================================================================
// PHASE 6b — TỔNG QUAN TÍNH Ở SERVER (T5–T10): 6 biểu đồ uống /stats/charts?type=
// và «hoạt động gần đây» có phân trang qua /stats/activities (việc 6.2/6.3).
// Các hàm render*Chart bản cũ giữ nguyên làm đường dự phòng khi fetch lỗi.
// ============================================================================


let hoatDongTrang = 1,
  hoatDongTongTrang = 1,
  hoatDongDanhSach = [];

/** Ánh xạ dòng activity_logs của REST sang khoá COL.A_* — cùng luật activityToLegacy phía máy chủ. */
function hoatDongSangLegacy(rows) {
  return (rows || []).map((row) => ({
    [COL.A_TIME]: row.created_at ?? "",
    [COL.A_ACTION]: row.action ?? "",
    [COL.A_USER]: row.actor_name ?? "",
    [COL.A_DETAILS]: moTaChiTietHoatDong(row.details),
  }));
}
/** Mô tả NGẮN một dòng hoạt động cho trang Tổng quan — cùng luật moTaNhatKy phía máy chủ:
 * object rỗng ⇒ rỗng (hết "{}"), tên theo tháng hiện theo TÊN đầu việc + Tháng n/YYYY (bỏ mã,
 * người dùng 2026-08-29), bản sửa đếm số trường bằng nhãn cột của tab Nhật ký. */
function moTaChiTietHoatDong(details) {
  if (details == null || details === "") return "";
  if (typeof details === "string") return details;
  if (typeof details !== "object") return String(details);
  if (Object.keys(details).length === 0) return "";
  if (details.month) {
    const phan = [
      details.workName || details.itemName || details.code || "",
      nhanThangVN(details.month),
    ];
    if (details.name) phan.push("tên mới: " + details.name);
    if (details.previousName) phan.push("tên cũ: " + details.previousName);
    return phan.filter(Boolean).join(" · ");
  }
  if (details.changes && typeof details.changes === "object") {
    const cacCot = Object.keys(details.changes),
      goiY = cacCot.slice(0, 3).map(nhanCotNhatKy).join(", ");
    return cacCot.length === 0
      ? ""
      : "Cập nhật " + cacCot.length + " trường" + (goiY ? ": " + goiY : "");
  }
  if (details.code) return details.name ? String(details.name) : String(details.code);
  try {
    return JSON.stringify(details);
  } catch (err) {
    return "";
  }
}
/** Nạp một trang hoạt động; trang > 1 nối tiếp vào danh sách đang hiển thị. */
async function napHoatDong(trang) {
  const duLieu = await restGet("/api/v1/stats/activities?page=" + trang + "&limit=22");
  if (!duLieu) return;
  hoatDongTrang = duLieu.page || trang;
  hoatDongTongTrang = duLieu.totalPages || 1;
  const moi = hoatDongSangLegacy(duLieu.activities);
  hoatDongDanhSach =
    Number(trang) > 1 ? hoatDongDanhSach.concat(moi) : moi;
  renderActivity(hoatDongDanhSach);
  const khungEl = document.getElementById("recent-activity");
  if (!khungEl) return;
  if (hoatDongTrang < hoatDongTongTrang) {
    const nut = document.createElement("button");
    nut.type = "button";
    nut.id = "activity-more-btn";
    nut.className = "w-full text-center text-sm text-blue-600 hover:text-blue-800 py-2";
    nut.textContent = "Xem thêm hoạt động cũ hơn (trang " + (hoatDongTrang + 1) + "/" + hoatDongTongTrang + ")";
    nut.addEventListener("click", () => napHoatDong(hoatDongTrang + 1));
    khungEl.insertAdjacentElement("afterend", nut);
  } else {
    const nutCu = document.getElementById("activity-more-btn");
    nutCu && nutCu.remove();
  }
}

/** Hiện thông báo «không có dữ liệu» đúng khung message của từng biểu đồ. */
function hienThongDiepBieuDo(msgId, thongDiep) {
  const el = document.getElementById(msgId);
  el && ((el.textContent = thongDiep || "Không có dữ liệu biểu đồ"), el.classList.remove("hidden"));
}
const MAU_BIEU_DO = ["rgba(59, 130, 246, 0.8)", "rgba(16, 185, 129, 0.8)", "rgba(245, 158, 11, 0.8)", "rgba(239, 68, 68, 0.8)", "rgba(139, 92, 246, 0.8)"];

/** E2 — trạng thái: doughnut, cùng tuỳ chọn với renderChart bản cũ. */
function veBieuDoTrangThaiServer(p) {
  const el = document.getElementById("status-chart");
  if (!el) return;
  chartInstance && chartInstance.destroy();
  if (!p || !p.labels || p.labels.length === 0) return hienThongDiepBieuDo("chart-message", p && p.message);
  document.getElementById("chart-message") && document.getElementById("chart-message").classList.add("hidden");
  chartInstance = new Chart(el, {
    type: "doughnut",
    data: { labels: p.labels, datasets: [{ data: p.data, backgroundColor: MAU_BIEU_DO.slice(0, p.labels.length), borderColor: MAU_BIEU_DO.slice(0, p.labels.length).map((c) => c.replace("0.8", "1")), borderWidth: 2, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom", labels: { padding: 15, usePointStyle: true, font: { size: 10 } } } }, animation: { duration: 1000, easing: "easeOutCubic" } }
  });
}

/** E4 — tiến độ công việc: 5 bucket cố định do server tính sẵn. */
function veBieuDoTienDoServer(p) {
  const el = document.getElementById("project-progress-chart");
  if (!el) return;
  projectProgressChart && projectProgressChart.destroy();
  if (!p || !p.labels || p.labels.length === 0) return hienThongDiepBieuDo("project-chart-message", p && p.message);
  document.getElementById("project-chart-message") && document.getElementById("project-chart-message").classList.add("hidden");
  projectProgressChart = new Chart(el, {
    type: "bar",
    data: { labels: p.labels, datasets: [{ label: "Số lượng công việc", data: p.data, backgroundColor: ["rgba(239, 68, 68, 0.8)", "rgba(245, 158, 11, 0.8)", "rgba(59, 130, 246, 0.8)", "rgba(16, 185, 129, 0.8)", "rgba(34, 197, 94, 0.8)"], borderWidth: 2, borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, animation: { duration: 1000 } }
  });
}

/** E5 — hiệu suất nhân sự: cột tổng + đường tỷ lệ, dữ liệu `rates[]` do server trả kèm. */
function veBieuDoNhanSuServer(p) {
  const el = document.getElementById("staff-performance-chart");
  if (!el) return;
  staffPerformanceChart && staffPerformanceChart.destroy();
  if (!p || !p.labels || p.labels.length === 0) return hienThongDiepBieuDo("staff-chart-message", p && p.message);
  document.getElementById("staff-chart-message") && document.getElementById("staff-chart-message").classList.add("hidden");
  staffPerformanceChart = new Chart(el, {
    type: "bar",
    data: { labels: p.labels, datasets: [
      { label: "Tổng số nhiệm vụ", data: p.data, backgroundColor: "rgba(16, 185, 129, 0.6)", borderColor: "rgba(16, 185, 129, 1)", borderWidth: 2, borderRadius: 6, yAxisID: "y" },
      { label: "Tỷ lệ hoàn thành (%)", data: p.rates || [], type: "line", backgroundColor: "rgba(99, 102, 241, 0.2)", borderColor: "rgba(99, 102, 241, 1)", borderWidth: 3, pointBackgroundColor: "rgba(99, 102, 241, 1)", pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 5, yAxisID: "y1", tension: 0.4 }
    ] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "top", labels: { usePointStyle: true, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, position: "left" }, y1: { beginAtZero: true, max: 100, position: "right", grid: { drawOnChartArea: false }, ticks: { callback: (v) => v + "%" } } } }
  });
}

/** E6 — mức ưu tiên: pie ba nhãn cố định. */
function veBieuDoUuTienServer(p) {
  const el = document.getElementById("task-priority-chart");
  if (!el) return;
  window.taskPriorityChart && window.taskPriorityChart.destroy();
  if (!p || !p.labels || p.labels.length === 0) return hienThongDiepBieuDo("priority-chart-message", p && p.message);
  document.getElementById("priority-chart-message") && document.getElementById("priority-chart-message").classList.add("hidden");
  window.taskPriorityChart = new Chart(el, {
    type: "pie",
    data: { labels: p.labels, datasets: [{ data: p.data, backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(59, 130, 246, 0.8)", "rgba(239, 68, 68, 0.8)"], borderWidth: 2, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { padding: 15, usePointStyle: true, font: { size: 11 } } } }, animation: { duration: 1000, easing: "easeOutCubic" } }
  });
}

/** E7 — tiến độ theo thời gian: 30 ngày gần nhất, server đếm theo report_date. */
function veBieuDoThoiGianServer(p) {
  const el = document.getElementById("timeline-progress-chart");
  if (!el) return;
  window.timelineProgressChart && window.timelineProgressChart.destroy();
  if (!p || !p.labels || p.labels.length === 0) return hienThongDiepBieuDo("timeline-chart-message", p && p.message);
  document.getElementById("timeline-chart-message") && document.getElementById("timeline-chart-message").classList.add("hidden");
  window.timelineProgressChart = new Chart(el, {
    type: "line",
    data: { labels: p.labels, datasets: [{ label: "Nhiệm vụ hoàn thành", data: p.data, borderColor: "rgba(16, 185, 129, 1)", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 7, font: { size: 10 } } }, y: { beginAtZero: true, ticks: { stepSize: 1, callback: (v) => Math.floor(v) } } } }
  });
}

/** E3 — so sánh công việc top 5: cột tổng + đường tỷ lệ (`completed[]`, `rates[]`). */
function veBieuDoSoSanhServer(p) {
  const el = document.getElementById("project-comparison-chart");
  if (!el) return;
  window.projectComparisonChart && window.projectComparisonChart.destroy();
  if (!p || !p.labels || p.labels.length === 0) return hienThongDiepBieuDo("comparison-chart-message", p && p.message);
  document.getElementById("comparison-chart-message") && document.getElementById("comparison-chart-message").classList.add("hidden");
  window.projectComparisonChart = new Chart(el, {
    type: "bar",
    data: { labels: p.labels, datasets: [
      { label: "Tổng nhiệm vụ", data: p.data, backgroundColor: "rgba(59, 130, 246, 0.8)", borderColor: "rgba(59, 130, 246, 1)", borderWidth: 1, borderRadius: 6, yAxisID: "y" },
      { label: "Tỷ lệ hoàn thành (%)", data: p.rates || [], type: "line", borderColor: "rgba(239, 68, 68, 1)", backgroundColor: "rgba(239, 68, 68, 0.1)", borderWidth: 3, pointBackgroundColor: "rgba(239, 68, 68, 1)", pointBorderColor: "#fff", pointRadius: 5, tension: 0.4, yAxisID: "y1" }
    ] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "top", labels: { usePointStyle: true, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, position: "left" }, y1: { beginAtZero: true, max: 100, position: "right", grid: { drawOnChartArea: false } } } }
  });
}

/** Nạp CẢ SÁU biểu đồ + hoạt động từ máy chủ — gọi khi vào Tổng quan (việc 6.2/6.3). */
async function napTongQuanTuServer() {
  const loaiVaVe = [
    ["status", veBieuDoTrangThaiServer],
    ["project-progress", veBieuDoTienDoServer],
    ["staff-performance", veBieuDoNhanSuServer],
    ["task-priority", veBieuDoUuTienServer],
    ["timeline-progress", veBieuDoThoiGianServer],
    ["project-comparison", veBieuDoSoSanhServer],
  ];
  await Promise.all(
    loaiVaVe.map(async ([type, ve]) => {
      const duLieu = await restGet("/api/v1/stats/charts?type=" + type);
      duLieu && ve(duLieu);
    })
  );
  await napHoatDong(1);
}

// ============================================================================
// PHASE 6c — LỌC THÁNG/PHÒNG trong modal «bấm số mở danh sách» (việc 6.4/6.5).
// Danh sách lấy từ mảng đã do máy chủ chạm phạm vi (bootstrap), nên bộ lọc này chỉ
// thu hẹp trên dữ liệu mình được thấy — không có đường nào rò phòng khác. Luật
// khoảng ngày CHÉP Y TỪ stats/service.js: giao nhau hai đầu đóng, dòng thiếu một
// trong hai ngày luôn được giữ (TC-STAT-08/09).
// ============================================================================

function boLocDanhSachStatList(list, type) {
  const tuEl = document.getElementById("stat-list-from"),
    denEl = document.getElementById("stat-list-to"),
    phongEl = document.getElementById("stat-list-dept");
  const tu = tuEl && tuEl.value ? tuEl.value : null,
    den = denEl && denEl.value ? denEl.value : null,
    phong = phongEl ? phongEl.value : "";
  const batDau = (row) => parseDateString(type === "project" ? row[COL.P_START] : row[COL.T_START]),
    ketThuc = (row) => parseDateString(type === "project" ? row[COL.P_END] : row[COL.T_DUE]);
  const phongCua = (row) => {
    if (type === "project") return row[COL.P_DEPT] || "";
    const cha = allProjects.find((p) => p[COL.P_ID] === row[COL.T_PID]);
    return cha ? cha[COL.P_DEPT] || "" : "";
  };
  return list.filter((row) => {
    if (phong && phongCua(row) !== phong) return false;
    if (!tu || !den) return true;
    const s = batDau(row),
      e = ketThuc(row);
    if (!s || !e) return true; // thiếu một trong hai ngày ⇒ giữ, cùng luật máy chủ
    return s <= parseDateString(den) && e >= parseDateString(tu);
  });
}

/** Nạp phòng vào ô lọc (chỉ admin / Phó GĐ thấy danh sách nhiều phòng) + nối listener. */
function setupBoLocStatList(type) {
  const phongEl = document.getElementById("stat-list-dept");
  if (!phongEl) return;
  const duocChonNhieu = isAdmin() || typeof isDeputyDirectorUser !== "undefined" && isDeputyDirectorUser;
  (duocChonNhieu ? visibleDepartments : [myDepartment].filter(Boolean)).forEach((ten) => {
    if (![...phongEl.options].some((o) => o.value === ten)) {
      const o = document.createElement("option");
      o.value = ten, o.textContent = ten, phongEl.appendChild(o);
    }
  });
  const apDung = () =>
    renderStatListItems(type, boLocDanhSachStatList(currentStatListData, type));
  ["stat-list-from", "stat-list-to", "stat-list-dept"].forEach((id) => {
    const el = document.getElementById(id);
    el && (el.onchange = apDung);
  });
}
// ============================================================================
// PHASE 6 — Thống kê tính ở SERVER + Gantt nhóm 3 kiểu / cây 4 mức thu gọn
// (§7 việc 6.2–6.8). Bản renderGanttChartLegacy phía trên giữ làm tham chiếu,
// mọi đường Gantt giờ đi qua cây do GET /api/v1/gantt trả sẵn.
// ============================================================================

/** GET REST `/api/v1/...`: trả `data` hoặc `null` — 401 bật lại modal đăng nhập như cầu RPC. */
async function restGet(path) {
  try {
    const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (res.status === 401) {
      showLoginModal();
      return null;
    }
    // 2026-08-28: 404 trên đường /api/v1/* KHÔNG phải lỗi người dùng — đường có trong mã nguồn
    // mà máy chủ không biết nghĩa là tiến trình node đang chạy bản CŨ (đã gặp thật với
    // /api/v1/delegations). Nói thẳng ra thay vì để người dùng đọc "HTTP 404".
    if (res.status === 404 && path.indexOf("/api/v1/") === 0) throw new Error("máy chủ chưa có đường " + path + " — có thể đang chạy bản cũ, cần khởi động lại máy chủ");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    return json && json.data ? json.data : null;
  } catch (err) {
    showToast("Không tải được dữ liệu từ máy chủ: " + err.message, "error");
    return null;
  }
}

/** GET IM LẶNG: lỗi thì trả `null`, KHÔNG toast, KHÔNG bật modal đăng nhập.
 *  Dùng cho vòng hỏi lại 10 giây của chat — một lượt mạng chập chờn không được phép nổ toast liên
 *  tục hay đá người dùng ra modal đăng nhập giữa lúc họ đang gõ. */
async function restGetIm(path) {
  try {
    const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    return json && json.data ? json.data : null;
  } catch (err) {
    return null;
  }
}

/* ============================================================================
 * MÀN HÌNH DUYỆT (2026-08-28) — «Chờ duyệt» trong Quản lý công việc.
 * Máy chủ đã có sẵn: GET /approvals/pending (phạm vi theo người xem) và
 * POST /approvals/:entity/:id/{approve,reject} — từ chối cần lý do ≥ 10 ký tự.
 * Quyền duyệt theo §6: admin + Phó Giám đốc (chỉ phòng mình quản lý) — server chặn.
 * ============================================================================ */

/** Đọc token CSRF từ cookie `<tên-session>_csrf`; chưa có thì gọi GET /api/csrf phát mới. */
async function layTokenCsrfChoPost() {
  const cookies = String(document.cookie || "").split(";");
  for (const pair of cookies) {
    const p = pair.trim(),
      eq = p.indexOf("=");
    if (eq > 0 && p.slice(0, eq).endsWith("_csrf")) return p.slice(eq + 1);
  }
  try {
    const res = await fetch("/api/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
    const json = await res.json();
    return (json && json.data && json.data.csrfToken) || "";
  } catch (err) {
    return "";
  }
}

/** POST REST dùng cho luồng duyệt — gắn X-CSRF-Token như cầu RPC; lỗi hiện toast, trả null. */
async function restPost(path, body) {
  try {
    const token = await layTokenCsrfChoPost();
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": token },
      body: JSON.stringify(body || {}),
    });
    if (res.status === 401) {
      showLoginModal();
      return null;
    }
    if (!res.ok) {
      let thongDiep = "HTTP " + res.status;
      try {
        const json = await res.json();
        json && json.error && json.error.message && (thongDiep = json.error.message);
      } catch (err) {}
      throw new Error(thongDiep);
    }
    const json = await res.json();
    return json && json.data ? json.data : null;
  } catch (err) {
    showToast("Không thực hiện được: " + err.message, "error");
    return null;
  }
}

/** Người đang đăng nhập có phải NGƯỜI DUYỆT (admin / Phó Giám đốc) theo §6? */
function laNguoiDuyetHeThong() {
  return isAuthenticated && !!currentUser && (isAdmin() || currentUser.role === "Phó Giám đốc");
}

/**
 * BUILDER: một dòng trong «Chờ duyệt» — mọi giá trị user-data đều qua escape.
 *
 * Vòng 13: cả CÂY gửi duyệt một lần nên máy chủ chỉ trả GỐC cây (`repo.listPending`), và dòng có
 * ba nút — Xem chi tiết (đọc cả cây trước khi ký) / Duyệt / Trả lại để sửa — cùng nút Từ chối vốn
 * có. Dòng cấp 2/3 gửi LẺ mang `title` là tên công việc cấp 1 (`work_name`): thiếu nó thì người
 * duyệt thấy một cái tên trơ, không rõ thuộc việc nào.
 */
function buildPendingApprovalRowHtml(item) {
  const laWork = item.kind === "work";
  const loai = laWork ? "Công việc" : Number(item.level) === 2 ? "Công việc con" : "Nhiệm vụ";
  const tenCongViecCha = String((item && item.work_name) || "").trim();
  const tieuDeLoai = laWork || tenCongViecCha === "" ? "" : "Thuộc công việc: " + tenCongViecCha;
  return (
    '\n<div class="approval-row flex flex-wrap items-center gap-2 py-2 border-b border-gray-100" data-entity="' +
    escapeHtml(laWork ? "work" : "work-item") +
    '" data-id="' +
    escapeHtml(item.code || String(item.id)) +
    '" data-name="' +
    escapeHtmlAttr(item.name || "") +
    '" data-work-code="' +
    escapeHtmlAttr(laWork ? item.code || "" : item.work_code || "") +
    '">' +
    '<span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap"' +
    (tieuDeLoai ? ' title="' + escapeHtmlAttr(tieuDeLoai) + '"' : "") +
    ">" +
    escapeHtml(loai) +
    "</span>" +
    '<span class="font-medium text-gray-800 text-sm truncate">' +
    escapeHtml(item.name || "") +
    "</span>" +
    '<span class="text-xs text-gray-400 whitespace-nowrap">(' +
    escapeHtml(item.code || "") +
    ")</span>" +
    '<span class="text-xs text-gray-400 ml-auto whitespace-nowrap">Người gửi: ' +
    escapeHtml(item.created_by_name || "—") +
    "</span>" +
    '<span class="flex items-center gap-2">' +
    '<button type="button" class="approval-detail btn-secondary py-1 px-3 text-xs" title="' +
    escapeHtmlAttr("Xem cả công việc con và nhiệm vụ bên trong (chỉ đọc)") +
    '"><i class="fas fa-eye mr-1"></i>Xem chi tiết</button>' +
    '<button type="button" class="approval-approve btn-primary py-1 px-3 text-xs" title="' +
    escapeHtmlAttr("Duyệt cả cây: công việc này và mọi mục bên trong") +
    '"><i class="fas fa-check mr-1"></i>Duyệt</button>' +
    '<button type="button" class="approval-return-toggle btn-secondary py-1 px-3 text-xs text-amber-700" title="' +
    escapeHtmlAttr("Trả cả cây về bản nháp của người lập để sửa — không mất dữ liệu") +
    '"><i class="fas fa-rotate-left mr-1"></i>Trả lại để sửa</button>' +
    '<button type="button" class="approval-reject-toggle btn-secondary py-1 px-3 text-xs text-red-600" title="' +
    escapeHtmlAttr("Từ chối là XOÁ HẲN công việc này và mọi mục bên trong") +
    '"><i class="fas fa-times mr-1"></i>Từ chối</button>' +
    "</span>" +
    '<div class="approval-return-box hidden w-full flex items-center gap-2">' +
    '<input type="text" class="approval-return-reason form-input py-1 px-2 text-xs flex-1" placeholder="Cần sửa gì (ít nhất 10 ký tự)...">' +
    '<button type="button" class="approval-return-confirm btn-secondary py-1 px-3 text-xs text-amber-700">Trả lại</button>' +
    "</div>" +
    '<div class="approval-reject-box hidden w-full flex items-center gap-2">' +
    '<input type="text" class="approval-reason form-input py-1 px-2 text-xs flex-1" placeholder="Lý do từ chối — SẼ XOÁ HẲN cả cây (ít nhất 10 ký tự)...">' +
    '<button type="button" class="approval-reject-confirm btn-secondary py-1 px-3 text-xs text-red-600">Xác nhận xoá</button>' +
    "</div></div>"
  );
}

/**
 * BUILDER: một dòng trong «Yêu cầu XOÁ chờ duyệt» (013, Vòng 13 đợt 2).
 *
 * Builder RIÊNG chứ không thêm cờ vào `buildPendingApprovalRowHtml`: hai loại dòng có bộ nút khác
 * nhau hoàn toàn (Duyệt/Trả lại/Từ chối ↔ Đồng ý xoá/Từ chối xoá) và ý nghĩa ngược nhau. Một
 * builder hai chế độ là chỗ để bấm nhầm nút.
 *
 * Mọi giá trị user-data qua escape. `xoa_yeu_cau_ten` và `xoa_ly_do` do `listPendingDeletes` trả kèm.
 */
function buildPendingDeleteRowHtml(item) {
  const laWork = item.kind === "work";
  const loai = laWork ? "Công việc" : Number(item.level) === 2 ? "Công việc con" : "Nhiệm vụ";
  const tenCongViecCha = String((item && item.work_name) || "").trim();
  const tieuDeLoai = laWork || tenCongViecCha === "" ? "" : "Thuộc công việc: " + tenCongViecCha;
  const lyDo = String((item && item.xoa_ly_do) || "").trim();
  return (
    '\n<div class="approval-delete-row flex flex-wrap items-center gap-2 py-2 border-b border-red-50" data-entity="' +
    escapeHtml(laWork ? "work" : "work-item") +
    '" data-id="' +
    escapeHtml(item.code || String(item.id)) +
    '" data-name="' +
    escapeHtmlAttr(item.name || "") +
    '">' +
    '<span class="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap"' +
    (tieuDeLoai ? ' title="' + escapeHtmlAttr(tieuDeLoai) + '"' : "") +
    ">" +
    escapeHtml(loai) +
    "</span>" +
    '<span class="font-medium text-gray-800 text-sm truncate">' +
    escapeHtml(item.name || "") +
    "</span>" +
    '<span class="text-xs text-gray-400 whitespace-nowrap">(' +
    escapeHtml(item.code || "") +
    ")</span>" +
    (lyDo ? '<span class="text-xs text-red-600 truncate">Lý do: ' + escapeHtml(lyDo) + "</span>" : "") +
    '<span class="text-xs text-gray-400 ml-auto whitespace-nowrap">Người xin: ' +
    escapeHtml(item.xoa_yeu_cau_ten || "—") +
    "</span>" +
    '<span class="flex items-center gap-2">' +
    '<button type="button" class="delete-approve btn-secondary py-1 px-3 text-xs text-red-600" title="' +
    escapeHtmlAttr("Đồng ý xoá — mục này và mọi mục bên trong sẽ mất hẳn") +
    '"><i class="fas fa-trash mr-1"></i>Đồng ý xoá</button>' +
    '<button type="button" class="delete-reject btn-secondary py-1 px-3 text-xs" title="' +
    escapeHtmlAttr("Từ chối yêu cầu xoá — mục giữ nguyên, nhãn đỏ biến mất") +
    '"><i class="fas fa-rotate-left mr-1"></i>Từ chối xoá</button>' +
    "</span>" +
    '<div class="delete-reject-box hidden w-full flex items-center gap-2">' +
    '<input type="text" class="delete-reject-reason form-input py-1 px-2 text-xs flex-1" placeholder="Lý do từ chối (không bắt buộc)...">' +
    '<button type="button" class="delete-reject-confirm btn-secondary py-1 px-3 text-xs">Xác nhận</button>' +
    "</div></div>"
  );
}

/** Nạp «Chờ duyệt» — chỉ hiện panel cho NGƯỜI DUYỆT; người khác vẫn thấy nhãn vàng ở danh sách. */
async function renderChoDuyetPanel() {
  const panel = document.getElementById("approvals-panel");
  if (!panel || !isAuthenticated) return;
  if (!laNguoiDuyetHeThong()) {
    panel.classList.add("hidden");
    return;
  }
  const listEl = document.getElementById("approvals-list");
  listEl && (listEl.innerHTML = '<div class="text-sm text-gray-400 py-2"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</div>');
  const duLieu = await restGet("/api/v1/approvals/pending");
  const items = (duLieu && duLieu.items) || [];
  panel.classList.remove("hidden");
  const countEl = document.getElementById("approvals-count");
  countEl && (countEl.textContent = String(items.length));
  listEl &&
    (listEl.innerHTML = items.length
      ? items.map(buildPendingApprovalRowHtml).join("")
      : '<div class="text-sm text-gray-400 py-2">Không có mục nào chờ duyệt — tốt lắm!</div>');
  await renderYeuCauXoaPanel();
}

/**
 * Nạp khung «Yêu cầu XOÁ chờ duyệt» (013) — nằm trong cùng panel nhưng là danh sách RIÊNG.
 *
 * Ẩn hẳn khung khi không có yêu cầu nào: đây là việc hiếm, để một dòng «không có gì» thường trực
 * chỉ làm panel dài ra. Khác khung chờ duyệt phía trên — cái đó luôn hiện vì người duyệt cần biết
 * mình đã xử hết.
 */
async function renderYeuCauXoaPanel() {
  const box = document.getElementById("approvals-delete-box");
  if (!box) return;
  const listEl = document.getElementById("approvals-delete-list");
  const duLieu = await restGet("/api/v1/approvals/pending-deletes");
  const items = (duLieu && duLieu.items) || [];
  if (items.length === 0) {
    box.classList.add("hidden");
    listEl && (listEl.innerHTML = "");
    return;
  }
  box.classList.remove("hidden");
  const countEl = document.getElementById("approvals-delete-count");
  countEl && (countEl.textContent = String(items.length));
  listEl && (listEl.innerHTML = items.map(buildPendingDeleteRowHtml).join(""));
}

/** Đồng ý xoá: POST approve-delete → mục mất thật, cả cây bên dưới. */
async function duyetYeuCauXoa(entity, ref) {
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/approve-delete"
  );
  if (ketQua) {
    const soCon = Number(ketQua.soCon || 0);
    showToast(
      "Đã xoá " + ((ketQua.row && ketQua.row.code) || "") + (soCon > 0 ? " cùng " + soCon + " mục bên trong" : ""),
      "success"
    );
    await napLaiSauDuyet();
  }
}

/** Từ chối yêu cầu xoá: mục giữ nguyên, ba cột yêu cầu về rỗng. Lý do KHÔNG bắt buộc. */
async function tuChoiYeuCauXoa(entity, ref, lyDo) {
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/reject-delete",
    { reason: lyDo || "" }
  );
  if (ketQua) {
    showToast("Đã từ chối yêu cầu xoá — mục giữ nguyên", "info");
    await napLaiSauDuyet();
  }
}

/** Duyệt một mục: POST approve → nạp lại panel + danh sách công việc. */
async function duyetMucChoDuyet(entity, ref) {
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/approve"
  );
  if (ketQua) {
    const soCon = Number(ketQua.soCon || 0);
    showToast(
      "Đã duyệt " + ((ketQua.row && ketQua.row.code) || "") + (soCon > 0 ? " kèm " + soCon + " mục bên trong" : ""),
      "success"
    );
    await napLaiSauDuyet();
  }
}

/**
 * Gửi duyệt CẢ CÂY từ một bản nháp (012): công việc cấp 1 + mọi công việc con và nhiệm vụ bên
 * trong cùng sang «Chờ duyệt», và hộp chờ duyệt của người duyệt chỉ hiện MỘT dòng.
 */
async function guiDuyetCaCay(entity, ref) {
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/submit"
  );
  if (ketQua) {
    const soCon = Number(ketQua.soCon || 0);
    showToast(
      "Đã gửi duyệt " + ((ketQua.row && ketQua.row.code) || "") + (soCon > 0 ? " kèm " + soCon + " mục bên trong" : ""),
      "success"
    );
    await napLaiSauDuyet();
  }
}

/**
 * TRẢ LẠI ĐỂ SỬA (012) — cửa mềm giữa Duyệt và Từ chối: cả cây về bản nháp của người lập, KHÔNG
 * mất dữ liệu, ghi chú lưu lại để họ biết phải sửa gì. Máy chủ đòi ghi chú ≥ 10 ký tự.
 */
async function traLaiDeSuaMuc(entity, ref, ghiChu) {
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/return",
    { reason: ghiChu }
  );
  if (ketQua) {
    showToast("Đã trả lại " + ((ketQua.row && ketQua.row.code) || "") + " cho người lập sửa", "info");
    await napLaiSauDuyet();
  }
}

/** Nạp lại đúng những khung phụ thuộc luồng duyệt — một chỗ cho cả bốn hành động. */
async function napLaiSauDuyet() {
  await renderChoDuyetPanel();
  typeof napLaiDuLieu === "function" ? napLaiDuLieu() : typeof renderProjects === "function" && renderProjects();
}

/**
 * XIN XOÁ (013, Vòng 13 đợt 2) — dùng khi máy chủ từ chối xoá thẳng vì vai bị ghi đè
 * «Xoá phải qua duyệt». Mục KHÔNG mất đi: nó vẫn hiện, chỉ thêm nhãn đỏ «Đang xin xoá» cho tới khi
 * người duyệt đồng ý (mất thật) hoặc từ chối (nhãn biến mất, mục nguyên trạng).
 */
async function xinXoaMuc(entity, ref, lyDo) {
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/request-delete",
    { reason: lyDo }
  );
  if (ketQua) {
    const soCon = Number(ketQua.soCon || 0);
    showToast(
      "Đã gửi yêu cầu xoá" + (soCon > 0 ? " (kèm " + soCon + " mục bên trong)" : "") + " — chờ người duyệt xử lý",
      "success"
    );
    await napLaiSauDuyet();
  }
}

/**
 * Máy chủ vừa từ chối xoá vì phải qua duyệt ⇒ hỏi lý do rồi gửi yêu cầu.
 *
 * Dùng `prompt` vì hộp thoại xoá hiện tại (`#delete-confirm-modal`) không có ô nhập, và thêm một
 * modal nữa cho một ô chữ là nhiều việc hơn giá trị nó mang lại. Máy chủ vẫn kiểm lại độ dài.
 */
async function hoiVaXinXoa(type, id, name) {
  const entity = type === "project" ? "work" : "work-item";
  const lyDo = String(
    window.prompt(
      "Xoá «" + name + "» phải được duyệt.\nNhập lý do xin xoá (ít nhất 10 ký tự) để gửi cho người duyệt:",
      ""
    ) || ""
  ).trim();
  if (lyDo === "") return;
  if (lyDo.length < 10) {
    showToast("Lý do xin xoá cần ít nhất 10 ký tự", "error");
    return;
  }
  await xinXoaMuc(entity, id, lyDo);
}

/** Từ chối một mục — lý do ≥ 10 ký tự (máy chủ kiểm tra lại lần nữa). */
async function tuChoiMucChoDuyet(entity, ref, lyDo) {
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/reject",
    { reason: lyDo }
  );
  if (ketQua) {
    const soCon = Number(ketQua.soCon || 0);
    showToast(
      "Đã từ chối và XOÁ " + ((ketQua.row && ketQua.row.code) || "") + (soCon > 0 ? " cùng " + soCon + " mục bên trong" : ""),
      "info"
    );
    await napLaiSauDuyet();
  }
}

/** Gắn MỘT lần bộ listener cho panel (delegation theo class, chống double-bind). */
function goiNutChoDuyetPanel() {
  const listEl = document.getElementById("approvals-list");
  if (!listEl || listEl.dataset.duyetBound === "1") return;
  listEl.dataset.duyetBound = "1";
  listEl.addEventListener("click", async (event) => {
    const nut = event.target.closest("button");
    if (!nut) return;
    const rowEl = nut.closest(".approval-row");
    if (!rowEl) return;
    const entity = rowEl.dataset.entity,
      ref = rowEl.dataset.id;
    if (nut.classList.contains("approval-detail")) {
      // Xem chi tiết (012): mở modal chi tiết ở chế độ CHỈ ĐỌC — người duyệt đọc cả cây trước khi
      // ký. Dòng cấp 2/3 mở theo công việc cấp 1 của nó (`data-work-code`) vì modal chi tiết vẽ
      // theo cây của cấp 1; không có mã đó thì mở theo chính nó.
      const maCongViec = rowEl.dataset.workCode || ref;
      const congViec = allProjects.find((p) => p[COL.P_ID] === maCongViec);
      moChiTietCheDoDuyet(maCongViec, (congViec && congViec[COL.P_NAME]) || rowEl.dataset.name || maCongViec);
    } else if (nut.classList.contains("approval-approve")) {
      nut.disabled = true;
      await duyetMucChoDuyet(entity, ref);
    } else if (nut.classList.contains("approval-return-toggle")) {
      const box = rowEl.querySelector(".approval-return-box");
      box && box.classList.toggle("hidden");
    } else if (nut.classList.contains("approval-return-confirm")) {
      const oGhiChu = rowEl.querySelector(".approval-return-reason"),
        ghiChu = ((oGhiChu && oGhiChu.value) || "").trim();
      if (ghiChu.length < 10) {
        showToast("Ghi chú cần ít nhất 10 ký tự để người lập biết phải sửa gì", "error");
        return;
      }
      nut.disabled = true;
      await traLaiDeSuaMuc(entity, ref, ghiChu);
    } else if (nut.classList.contains("approval-reject-toggle")) {
      const box = rowEl.querySelector(".approval-reject-box");
      box && box.classList.toggle("hidden");
    } else if (nut.classList.contains("approval-reject-confirm")) {
      const oLyDo = rowEl.querySelector(".approval-reason"),
        lyDo = ((oLyDo && oLyDo.value) || "").trim();
      if (lyDo.length < 10) {
        showToast("Lý do từ chối cần ít nhất 10 ký tự", "error");
        return;
      }
      // Từ chối là XOÁ HẲN cả cây (012) — không lấy lại được, nên hỏi lại một lần.
      const ten = rowEl.dataset.name || ref;
      if (!confirm("Từ chối sẽ XOÁ HẲN «" + ten + "» và mọi công việc con, nhiệm vụ bên trong.\nKhông thể phục hồi. Tiếp tục?")) {
        return;
      }
      nut.disabled = true;
      await tuChoiMucChoDuyet(entity, ref, lyDo);
    }
  });
  const nutRefresh = document.getElementById("approvals-refresh");
  nutRefresh &&
    !nutRefresh.dataset.daNoi &&
    ((nutRefresh.dataset.daNoi = "1"), nutRefresh.addEventListener("click", () => renderChoDuyetPanel()));

  // Khung YÊU CẦU XOÁ (013): listener riêng vì là một phần tử khác, nhưng cùng kiểu delegation
  // theo class và cùng mốc chống double-bind.
  const listXoa = document.getElementById("approvals-delete-list");
  if (!listXoa || listXoa.dataset.duyetBound === "1") return;
  listXoa.dataset.duyetBound = "1";
  listXoa.addEventListener("click", async (event) => {
    const nut = event.target.closest("button");
    if (!nut) return;
    const rowEl = nut.closest(".approval-delete-row");
    if (!rowEl) return;
    const entity = rowEl.dataset.entity,
      ref = rowEl.dataset.id;
    if (nut.classList.contains("delete-approve")) {
      // Đồng ý xoá là mất thật, cả cây bên dưới — hỏi lại một lần như nút Từ chối của đợt 1.
      const ten = rowEl.dataset.name || ref;
      if (!confirm("Đồng ý xoá «" + ten + "» và mọi mục bên trong?\nKhông thể phục hồi. Tiếp tục?")) {
        return;
      }
      nut.disabled = true;
      await duyetYeuCauXoa(entity, ref);
    } else if (nut.classList.contains("delete-reject")) {
      const box = rowEl.querySelector(".delete-reject-box");
      box && box.classList.toggle("hidden");
    } else if (nut.classList.contains("delete-reject-confirm")) {
      // Lý do KHÔNG bắt buộc: từ chối yêu cầu xoá không làm mất gì, khác hẳn từ chối nội dung.
      const oLyDo = rowEl.querySelector(".delete-reject-reason");
      nut.disabled = true;
      await tuChoiYeuCauXoa(entity, ref, ((oLyDo && oLyDo.value) || "").trim());
    }
  });
}

let ganttGroupBy = "department"; // department | deputy | assignee (việc 6.6)
let ganttTreeData = null; // cây đã nhóm sẵn do máy chủ trả

const GANTT_THU_GON_KEY = "qlcv_gantt_collapsed";
let ganttThuGon = docTrangThaiThuGon();

/** TC-STAT-15 — trạng thái thu gọn SỐNG TRONG localStorage, tải lại trang vẫn giữ. */
function docTrangThaiThuGon() {
  try {
    const raw = localStorage.getItem(GANTT_THU_GON_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (err) {
    return new Set();
  }
}
function luuTrangThaiThuGon() {
  try {
    localStorage.setItem(GANTT_THU_GON_KEY, JSON.stringify([...ganttThuGon]));
  } catch (err) {
    /* chế độ riêng tư chặn localStorage — thu gọn vẫn hoạt động, chỉ không nhớ */
  }
}
function doiTrangThaiThuGon(key) {
  ganttThuGon.has(key) ? ganttThuGon.delete(key) : ganttThuGon.add(key);
  luuTrangThaiThuGon(), renderGanttChart();
}
window.doiTrangThaiThuGon = doiTrangThaiThuGon;


/** Lấy cây Gantt đã nhóm sẵn cho khoảng ngày + kiểu nhóm đang chọn. */
async function taiCayGantt() {
  const tu = formatDateForInput(ganttStartDate),
    den = formatDateForInput(ganttEndDate);
  ganttTreeData = await restGet(
    "/api/v1/gantt?from=" + tu + "&to=" + den + "&groupBy=" + encodeURIComponent(ganttGroupBy)
  );
  return !!ganttTreeData;
}

/** Ngày 'yyyy-mm-dd' (chuỗi) → Date địa phương, không thì null. */
function docNgayGantt(value) {
  if (!value) return null;
  const d = parseDateString(value);
  return d && !isNaN(d.getTime()) ? d : null;
}

/**
 * Ô thời gian của một dòng: thanh bị CẮT HAI ĐẦU khi dài hơn khoảng (TC-STAT-13), và KHÔNG có
 * thanh khi nằm ngoài hẳn khoảng — chỉ còn ghi chú mờ (TC-STAT-14).
 *
 * `nhanText` là VĂN BẢN THÔNG THƯỜNG: hàm tự escapeHtml MỘT lần ở chỗ chèn — caller KHÔNG escape
 * trước để khỏi bị thoát hai lớp.
 */
function buildGanttCellHtml(startDate, endDate, rangeStart, rangeEnd, totalDays, cls, nhanText, pct) {
  const s = docNgayGantt(startDate),
    e = docNgayGantt(endDate);
  // Đổi ngày → SỐ THỨ TỰ ngày (0-based) tính từ đầu khoảng. Math.floor ăn nốt chênh múi giờ:
  // chuỗi 'yyyy-mm-dd' parse thành 00:00 UTC (= 07:00 ICT) vẫn rơi ĐÚNG ô của ngày đó, kể cả
  // ngày CUỐI tháng (trước đây so Date thô làm việc 31/08 bị coi là ngoài khoảng — bẫy 2026-08-27).
  const soThuTu = (d) => (d ? Math.floor((d - rangeStart) / 86400000) : null);
  const tu = soThuTu(s),
    den = soThuTu(e ?? s);
  const trong =
    (tu != null && tu >= 0 && tu <= totalDays - 1) ||
    (den != null && den >= 0 && den <= totalDays - 1) ||
    (tu != null && den != null && tu < 0 && den > totalDays - 1);
  if (!trong) {
    return '<div class="gantt-non-visible-task" style="height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 11px; font-style: italic;">' +
      "Không hiển thị trong khoảng này</div>";
  }
  // VỊ TRÍ THANH = Ô LƯỚI NGÀY (grid-column 1-based), kẹp biên [1, totalDays]:
  // thanh chiếm đúng từ cột (ngày bắt đầu giao) dài (số ngày giao) — trùng khít header ngày.
  const batDauO = Math.min(Math.max(tu ?? 0, 0), totalDays - 1) + 1,
    ketThucO = Math.min(Math.max(den ?? totalDays - 1, 0), totalDays - 1) + 1,
    style =
      "grid-column: " + batDauO + " / span " + Math.max(ketThucO - batDauO + 1, 1);
  return '<div class="gantt-bar ' + escapeHtml(cls) + '" style="' + escapeHtml(style) +
    '" data-tooltip="' + escapeHtml(nhanText) + '">' +
    '<div class="gantt-bar-label">' + escapeHtml(nhanText) + "</div>" +
    '<div class="gantt-progress" style="width: ' + Math.max(0, Math.min(100, Number(pct) || 0)) + '%"></div></div>';
}


/** Khoá node → id DOM an toàn ('group:PH01' → 'group-PH01'). */
const ganttDomKey = (key) => String(key).replace(/[^a-zA-Z0-9_-]/g, "_");

/** Nút bấm thu gọn/mở của một node — mũi tên xoay theo trạng thái đã lưu. */
function createGanttToggleHtml(key) {
  const biThuGon = ganttThuGon.has(key),
    icon = biThuGon ? "fa-chevron-right" : "fa-chevron-down";
  return '<button type="button" class="gantt-node-toggle mr-2" data-node="' + escapeHtml(key) +
    '" title="Thu gọn / mở"><i class="fas ' + escapeHtml(icon) + '"></i></button>';
}

/** Hàng TIÊU ĐỀ NHÓM (mức 1: Phòng / Phó GĐ / Người thực hiện). */
function createGanttGroupRowHtml(group) {
  const key = "group:" + group.key,
    domId = escapeHtml("gantt-body-" + ganttDomKey(key)),
    an = escapeHtml(ganttThuGon.has(key) ? " hidden" : "");
  return '\n<div class="gantt-project-group" data-project-id="' + escapeHtml(group.key) + '">' +
    '\n<div class="gantt-item" data-type="group">' +
    '<div class="gantt-item-label font-semibold text-gray-800">' + createGanttToggleSlotHtml(key, true) +
    '<i class="fas fa-layer-group text-purple-500 mr-2"></i>' + escapeHtml(group.name) +
    '<span class="gantt-task-count ml-2">' + escapeHtml(group.works.length) + '</span></div>' +
    '<div class="gantt-item-timeline"></div></div>' +
    '\n<div id="' + domId + '" class="' + an + '">' +
    group.works.map((w) => createGanttWorkRowHtml(w)).join("") + "</div></div>";
}

/** Hàng CÔNG VIỆC (mức 2) — thanh luôn vẽ vì máy chủ đã lọc theo khoảng; thân chứa mức 3/4. */
function createGanttWorkRowHtml(work) {
  const rangeStart = ganttStartDate,
    rangeEnd = ganttEndDate,
    totalDays = Math.ceil((rangeEnd - rangeStart) / 86400000) + 1,
    key = "work:" + work.code,
    bodyId = escapeHtml("gantt-tasks-" + ganttDomKey(work.code)),
    an = escapeHtml(ganttThuGon.has(key) ? " hidden" : ""),
    thangXem = thangLocGantt(),
    tenThang = tenTheoThangCuaDong(work, work.name || "", thangXem),
    nhanNgay = [formatDateForGantt(work.startDate), formatDateForGantt(work.endDate)]
        .filter(Boolean)
        .join(" - "),
      nhan = (nhanNgay ? nhanNgay + ": " : "") + tenThang,
    thanh = buildGanttCellHtml(work.startDate, work.endDate, rangeStart, rangeEnd, totalDays,
      "gantt-bar-project", nhan, work.progress),
    duLieuTenJson = escapeHtmlAttr(JSON.stringify(duLieuHoverGantt(work, thangXem)));
  return '\n<div class="gantt-work-block">' +
    '\n<div class="gantt-item" data-type="project" data-id="' + escapeHtml(work.code) + '">' +
    '<div class="gantt-item-label">' + createGanttToggleSlotHtml(key, true) +
    '<i class="fas fa-folder ' + escapeHtml(getStatusIconClass(work.status)) + ' mr-2"></i>' +
    '<span class="gantt-hover-name truncate" data-hover-json="' + duLieuTenJson + '">' + escapeHtml(tenThang) + "</span>" +
    '<span class="gantt-task-count">' + escapeHtml(work.taskCount) + "</span>" +
    '<div class="gantt-item-actions"></div></div>' +
    '<div class="gantt-item-timeline">' + thanh + "</div></div>" +
    '\n<div id="' + bodyId + '"' + an + ">" +
    work.subs.map((s) => createGanttSubRowHtml(s)).join("") +
    (work.tasks || []).map((t) => createGanttTaskRowHtml(t)).join("") +
    "</div></div>";
}

/** Hàng ngày của dải header — tách khỏi render để bản mới dùng lại đúng hình dạng cũ. */
function renderGanttDaysHtml(totalDays) {
  let html = "",
    date = new Date(ganttStartDate);
  for (let i = 0; i < totalDays; i++) {
    const weekend = date.getDay() === 0 || date.getDay() === 6,
      homNay = isSameDate(date, new Date()),
      thu = date.toLocaleString("vi-VN", { weekday: "short" }),
        ngay = date.getDate(),
        dauThang = ngay === 1,
        thang = dauThang ? date.toLocaleString("vi-VN", { month: "short" }) : "";
    html += '\n<div class="gantt-day ' + escapeHtml(weekend ? "weekend" : "") + " " + escapeHtml(homNay ? "today" : "") + " " +
      escapeHtml(dauThang ? "first-of-month" : "") + '"><div class="gantt-day-number">' + escapeHtml(ngay) +
      '</div><div class="gantt-day-label">' + escapeHtml(dauThang ? thang : thu) + "</div></div>";
    date.setDate(date.getDate() + 1);
  }
  return html;
}


// ============================================================================
// ỦY QUYỀN CÓ THỜI HẠN (§6 `docs/KE-HOACH-UY-QUYEN.md`)
//
// Quyền mượn được TÍNH Ở MÁY CHỦ trong `can()`; phần dưới đây chỉ hiển thị và gọi REST. Không có
// dòng nào tự suy ra "tôi được làm gì" — sai lệch giữa hai phía thì máy chủ vẫn là rào chặn cuối.
// ============================================================================

/** Ủy quyền TÔI ĐANG NHẬN và còn hiệu lực — nguồn duy nhất của nhãn cạnh tên người dùng. */
let uyQuyenNhan = [];

/**
 * GHI REST `/api/v1/...` (POST/PATCH/DELETE). Cầu RPC không dùng được ở đây: thêm tên mới vào cầu
 * là đổi hình dạng cầu (37 tên đang bị test ghim), còn `restGet` chỉ biết đọc.
 *
 * CSRF theo đúng luật của máy chủ (`middleware/csrf.js`): giá trị nằm trong cookie đọc được, tên
 * kết thúc bằng `_csrf`, và phải gửi lặp lại ở header `X-CSRF-Token`. Không có cookie thì gọi
 * `GET /api/csrf` một lần — request đọc, `issueCsrfCookie` sẽ phát cookie.
 *
 * Trả `{ ok, data, error }` chứ không ném: mọi chỗ gọi đều cần hiện câu lỗi của máy chủ
 * (DELEGATION_OVERLAP, DELEGATION_SCOPE_TOO_WIDE...) đúng nguyên văn cho người dùng.
 */
async function restGhi(method, path, body) {
  try {
    let token = docCookieCsrf();
    if (!token) {
      await fetch("/api/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
      token = docCookieCsrf();
    }
    const res = await fetch(path, {
      method: method,
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token || "" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (res.status === 401) {
      showLoginModal();
      return { ok: false, error: "Phiên đăng nhập đã hết, hãy đăng nhập lại" };
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: (json && json.error && json.error.message) || "Máy chủ trả lỗi HTTP " + res.status };
    }
    return { ok: true, data: json && json.data ? json.data : null };
  } catch (err) {
    return { ok: false, error: "Không gọi được máy chủ: " + err.message };
  }
}

/** Cookie CSRF: tên phụ thuộc biến môi trường máy chủ, chỉ chắc phần đuôi `_csrf` (xem api-bridge.js). */
function docCookieCsrf() {
  const parts = String(typeof document === "undefined" ? "" : document.cookie || "").split(";");
  for (let i = 0; i < parts.length; i++) {
    const pair = parts[i].trim(),
      eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq).endsWith("_csrf")) return decodeURIComponent(pair.slice(eq + 1));
  }
  return "";
}

/** `YYYY-MM-DD` → `dd/mm/yyyy` cho phần hiển thị. Chuỗi lạ thì trả lại nguyên văn, không đoán. */
function ngayVN(value) {
  const text = String(value == null ? "" : value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(8, 10) + "/" + text.slice(5, 7) + "/" + text.slice(0, 4) : text;
}

/** Hôm nay theo MÁY người dùng, dạng `YYYY-MM-DD` — chỉ dùng làm giá trị mặc định của ô ngày. */
function homNayISO() {
  const now = new Date(),
    hai = value => String(value).padStart(2, "0");
  return now.getFullYear() + "-" + hai(now.getMonth() + 1) + "-" + hai(now.getDate());
}

/** Tôi là đầu nào của bản ghi: `id` của phiên là nguồn duy nhất, KHÔNG so theo họ tên (trùng tên). */
function laCuaToi(row, cot) {
  return currentUser && String(row[cot] || "") === String(currentUser.id || "");
}

/**
 * Nạp danh sách ủy quyền của phiên hiện tại và vẽ lại nhãn. IM LẶNG: máy chủ cũ chưa có đường
 * `/api/v1/delegations` thì `restGetIm` trả `null`, giao diện chỉ thiếu nhãn — không nổ toast.
 */
async function napUyQuyenCuaToi() {
  const duLieu = await restGetIm("/api/v1/delegations");
  const rows = (duLieu && duLieu.delegations) || [];
  uyQuyenNhan = rows.filter(row => row.dang_hieu_luc === true && laCuaToi(row, "to_user_id"));
  veNhanUyQuyen();
  return rows;
}

/** Nhãn «đang được ủy quyền» cạnh tên người dùng, kèm tooltip nói rõ mượn quyền của AI, đến NGÀY nào. */
function veNhanUyQuyen() {
  const el = document.getElementById("uy-quyen-badge");
  if (!el) return;
  if (uyQuyenNhan.length === 0) {
    el.classList.add("hidden"), el.removeAttribute("title");
    return;
  }
  el.classList.remove("hidden"), el.textContent = "đang được ủy quyền";
  el.setAttribute(
    "title",
    uyQuyenNhan.map(row => "Bạn đang dùng quyền của " + (row.from_user_name || "?") + " đến " + ngayVN(row.to_date)).join("\n")
  );
}

/** Tên phòng theo id — phạm vi máy chủ trả về là mảng id, người dùng chỉ hiểu tên. */
function tenPhongTheoIds(ids) {
  const list = Array.isArray(ids) ? ids : [];
  if (list.length === 0) return "Tất cả phòng tôi phụ trách";
  return list
    .map(id => {
      const dept = (allDepartments || []).find(item => String(item[COL.D_DB_ID] || "") === String(id));
      return dept ? String(dept[COL.D_NAME] || "") : "#" + id;
    })
    .join(", ");
}

// ============================================================================
// TRANG QUẢN LÝ TÀI KHOẢN (2026-08-28)
// Chỉ hiện thông tin của CHÍNH người đang đăng nhập (currentUser do máy chủ trả về
// ở publicUser) — không gọi thêm API nào, không đọc dữ liệu cán bộ khác.
// Đổi mật khẩu dùng LẠI đúng đường cũ `changePassword(cũ, mới, nhắc lại)`: máy chủ
// vẫn là rào chặn cuối, ở đây chỉ chặn sớm mấy lỗi rõ ràng cho đỡ mất một vòng gọi.
// ============================================================================
/** Một ô «nhãn — giá trị» của trang tài khoản. */
function buildTaiKhoanDong(nhan, giaTri) {
  const text = giaTri === 0 || giaTri ? String(giaTri) : "—";
  return (
    "<div class=\"dong-tt\"><span class=\"nhan\">" +
    escapeHtml(nhan) +
    "</span><span class=\"gia-tri\">" +
    escapeHtml(text) +
    "</span></div>"
  );
}
/** Tên phòng của tài khoản: ưu tiên myDepartment (bối cảnh phòng), sau đó department_id. */
function tenPhongTaiKhoan() {
  if (myDepartment) return String(myDepartment);
  const id = currentUser && currentUser.department_id;
  if (!id) return "";
  const dept = (allDepartments || []).find(item => String(item[COL.D_DB_ID] || "") === String(id));
  return dept ? String(dept[COL.D_NAME] || "") : "#" + id;
}
// ============================================================================
// BẢNG PHÂN QUYỀN HỆ THỐNG (ĐỘNG — Vòng 9/10) — hiện ở trang «Quản lý tài khoản».
//
// 12 chức năng nghiệp vụ là DROPDOWN (admin sửa được, lưu PUT /api/v1/permissions vào
// `permission_overrides` 009/010); các hàng còn lại chỉ hiển thị. Với Phó Giám đốc / Trưởng
// phòng / Phó phòng, mỗi ô có thêm dropdown ĐIỀU KIỆN PHẠM VI: «Phòng phụ trách / Phòng mình»
// hoặc «Tất cả các phòng» (010) — `can()` bỏ qua inScope khi chọn «tất cả».
// Nguồn sự thật: PERMISSIONS + inScope() (rbac.js), trangThaiDuyetKhiTao() (approvals/rules.js).
// Ký hiệu: ✓ được làm ngay · ⏳ chờ Phó GĐ duyệt · ✕ tắt · ↻ mượn qua ủy quyền · 👁 chỉ xem.
// Vòng 9: cột «Quản lý công việc» đã bỏ khỏi bảng — vai cũ phía máy chủ vẫn hoạt động.
// ============================================================================
const BANG_PHAN_QUYEN = [
  { ten: 'Xem Công việc / Công việc con / Nhiệm vụ', entityType: 'work', action: 'read' },
  { ten: 'Tạo Công việc (cấp 1)', entityType: 'work', action: 'create', gc: 'Trưởng phòng / Phó phòng tạo ⇒ chờ Phó GĐ duyệt rồi mới vào thống kê.' },
  { ten: 'Tạo Công việc con (cấp 2)', entityType: 'subwork', action: 'create' },
  { ten: 'Tạo Nhiệm vụ (cấp 3)', entityType: 'task', action: 'create', gc: 'Mặc định nhiệm vụ KHÔNG qua duyệt; đặt ⏳ ở đây thì nhiệm vụ mới rơi «Chờ duyệt».' },
  { ten: 'Sửa Công việc (cấp 1)', entityType: 'work', action: 'update' },
  { ten: 'Sửa Công việc con (cấp 2)', entityType: 'subwork', action: 'update', gc: 'TP/PP sửa lại mục đã duyệt ⇒ tự về «Chờ duyệt» chờ Phó GĐ duyệt lần nữa.' },
  { ten: 'Sửa Nhiệm vụ (cấp 3)', entityType: 'task', action: 'update' },
  { ten: 'Xoá Công việc (cấp 1)', entityType: 'work', action: 'delete' },
  { ten: 'Xoá Công việc con (cấp 2)', entityType: 'subwork', action: 'delete' },
  { ten: 'Xoá Nhiệm vụ (cấp 3)', entityType: 'task', action: 'delete', gc: 'Cán bộ chỉ xoá nhiệm vụ của mình.' },
  { ten: 'Duyệt Công việc (cấp 1)', entityType: 'work', action: 'approve', gc: 'Chỉ hai vai này được duyệt — nơi những mục ⏳ chờ.' },
  { ten: 'Duyệt Công việc con (cấp 2)', entityType: 'subwork', action: 'approve' },
  { ten: 'Duyệt Nhiệm vụ (cấp 3)', entityType: 'task', action: 'approve', gc: 'Chỉ cần khi ô «Tạo Nhiệm vụ» đặt ⏳ — không có mục nào chờ thì không có gì để duyệt.' },
  { ten: 'Duyệt yêu cầu XOÁ (cả 3 cấp)', gc: 'Đi theo quyền Duyệt của từng cấp ở trên, không có ô riêng. Vai bị đặt ⏳ ở hàng Xoá phải bấm «Xin xoá» rồi chờ.', a: { s: '✓', n: '' }, g: { s: '✓', n: 'Phòng phụ trách' }, tp: { s: '✕', n: 'Chỉ khi được mở ô Duyệt' }, pp: { s: '✕', n: 'Chỉ khi được mở ô Duyệt' }, nv: { s: '✕', n: 'Chỉ xin, không duyệt' } },
  { ten: 'Thêm / sửa / xoá Người dùng', a: { s: '✓', n: '' }, g: { s: '👁', n: 'Chỉ xem' }, tp: { s: '👁', n: 'Chỉ xem' }, pp: { s: '👁', n: 'Chỉ xem' }, nv: { s: '👁', n: 'Chỉ xem' } },
  { ten: 'Thêm / sửa / xoá Phòng ban', a: { s: '✓', n: '' }, g: { s: '👁', n: 'Chỉ xem' }, tp: { s: '👁', n: 'Chỉ xem' }, pp: { s: '👁', n: 'Chỉ xem' }, nv: { s: '👁', n: 'Chỉ xem' } },
  { ten: 'Ủy quyền cho người khác', gc: 'Ngang hoặc xuống cấp, cùng phòng; người nhận phải bấm «Đồng ý».', a: { s: '✕', n: 'Không ủy' }, g: { s: '✓', n: '' }, tp: { s: '✓', n: '' }, pp: { s: '✓', n: '' }, nv: { s: '✓', n: 'Ủy ngang cho Cán bộ khác' } },
  { ten: 'Mượn quyền khi được ủy quyền', gc: 'Chỉ work/subwork/task, trong thời hạn + phạm vi của người ủy.', a: { s: '✕', n: 'Không mượn' }, g: { s: '↻', n: 'Phòng của người ủy' }, tp: { s: '↻', n: 'Phòng của người ủy' }, pp: { s: '↻', n: 'Phòng của người ủy' }, nv: { s: '↻', n: 'Phòng của người ủy' } },
  { ten: 'Xuất Excel', a: { s: '✓', n: 'Theo phạm vi thấy được' }, g: { s: '✓', n: 'Theo phạm vi' }, tp: { s: '✓', n: 'Theo phạm vi' }, pp: { s: '✓', n: 'Theo phạm vi' }, nv: { s: '✓', n: 'Theo phạm vi' } },
];
const VAU_BANG = [
  { ten: 'Phó Giám đốc', vai: 'Phó Giám đốc', phamViText: 'Phòng phụ trách' },
  { ten: 'Trưởng phòng', vai: 'Trưởng phòng', phamViText: 'Phòng mình' },
  { ten: 'Phó phòng', vai: 'Phó phòng', phamViText: 'Phòng mình' },
  { ten: 'Cán bộ', vai: 'Nhân viên', phamViText: 'Phòng của mình' },
];
const MAU_KY_HIEU = { '✓': 'text-green-600', '⏳': 'text-amber-600', '↻': 'text-indigo-500', '👁': 'text-gray-400', '✕': 'text-red-400' };
/**
 * Ô hiển thị cho người KHÔNG sửa bảng: ghi đè (009/010) ưu tiên, không có thì mô tả gốc.
 *
 * `vai` là VAI CSDL ('Nhân viên'), KHÔNG phải nhãn cột ('Cán bộ') — máy chủ khoá cả
 * `permission_overrides` lẫn ma trận `PERMISSIONS` bằng vai CSDL. Tra bằng nhãn là lỗi Vòng 12e:
 * mọi ô của cột Cán bộ rơi hết về «✕ Tắt» dù ma trận cho `task:create/update/delete`.
 */
function oPhanQuyenHieuLuc(row, vai, ghiDe, macDinh) {
  const gd = ghiDe[row.entityType + ':' + row.action] && ghiDe[row.entityType + ':' + row.action][vai];
  if (gd) {
    if (gd.gia_tri === 'cho-phep') return { s: '✓', n: 'Ghi đè: cho phép ngay' + (gd.pham_vi === 'tat-ca' ? ' · TẤT CẢ các phòng' : '') };
    if (gd.gia_tri === 'cho-duyet') return { s: '⏳', n: 'Ghi đè: chờ Phó GĐ duyệt' + (gd.pham_vi === 'tat-ca' ? ' · TẤT CẢ các phòng' : '') };
    if (gd.gia_tri === 'tu-choi') return { s: '✕', n: 'Ghi đè: đã tắt' };
  }
  // Trạng thái gốc đọc từ MA TRẬN máy chủ trả về (GET /permissions) — bảng luôn khớp server
  // kể cả khi Giám đốc vừa lưu ghi đè mới; user khác F5 là thấy ngay.
  const bangVai = macDinh && macDinh[vai];
  if (bangVai && bangVai[row.entityType] && bangVai[row.entityType].includes(row.action)) {
    const ghiChu =
      vai === 'Nhân viên' ? 'Phòng của mình' :
      vai === 'Phó Giám đốc' ? 'Các phòng phụ trách' :
      'Phòng mình';
    return { s: '✓', n: ghiChu };
  }
  // Ma trận KHÔNG cho: Cán bộ vẫn ĐỌC được cả phòng mình (§6) nên hàng Xem hiện 👁, còn lại ✕.
  if (vai === 'Nhân viên' && row.entityType) {
    return row.action === 'read' ? { s: '👁', n: 'Phòng của mình' } : { s: '✕', n: '' };
  }
  return row[vai === 'Phó Giám đốc' ? 'g' : vai === 'Trưởng phòng' ? 'tp' : vai === 'Phó phòng' ? 'pp' : 'nv'] || { s: '✕', n: '' };
}
// Danh sách ghi đè của máy chủ → chỉ số tra nhanh theo cặp (thực thể:hành động) → { vai: giá trị }.
function chiSoGhiDe(danhSach) {
  const kq = {};
  (danhSach || []).forEach((r) => {
    const khoa = (r.entity_type || r.entityType) + ':' + (r.action || '');
    kq[khoa] = kq[khoa] || {};
    kq[khoa][r.vai] = { gia_tri: r.gia_tri || r.giaTri, pham_vi: r.pham_vi || r.phamVi || 'phong' };
  });
  return kq;
}
function buildBangPhanQuyenHtml(ghiDe, macDinh, laAdmin) {
  ghiDe = ghiDe || {};
  macDinh = macDinh || {};
  // Nhãn option đầu — hiệu lực hiện tại = ghi đè nếu có, không thì luật gốc.
  // `vai` luôn là VAI CSDL (`VAU_BANG[].vai`, ví dụ 'Nhân viên'), KHÔNG phải nhãn cột ('Cán bộ'):
  // `permission_overrides` và ma trận `PERMISSIONS` của máy chủ đều khoá bằng vai CSDL. Tra bằng
  // nhãn là lỗi Vòng 12e — cả cột Cán bộ hiện «✕ Tắt» và bấm Lưu là XOÁ sạch ghi đè của vai đó.
  const nhungHieuLuc = (row, vai) => {
    const gd = (ghiDe[row.entityType + ':' + row.action] || {})[vai];
    if (gd) return { g: gd.gia_tri, pv: gd.pham_vi === 'tat-ca', ghiDe: true };
    const bang = macDinh[vai];
    const cho = bang && bang[row.entityType] && bang[row.entityType].includes(row.action);
    if (!cho) return { g: 'tu-choi', pv: '', ghiDe: false };
    // Vai KHÔNG có luồng duyệt phía trên thì Tạo là làm ngay: admin/Phó GĐ tự duyệt, còn
    // 'Nhân viên' bị service chặn 'cho-duyet' (permissions/service.js) nên đừng vẽ ⏳ cho họ.
    const choDuoc =
      row.action === 'create' && vai !== 'Phó Giám đốc' && vai !== 'admin' && vai !== 'Nhân viên';
    return { g: choDuoc ? 'cho-duyet' : 'cho-phep', pv: '', ghiDe: false };
  };
  const NHAN_HIEU_LUC = { 'cho-phep': '✓ Cho phép', 'cho-duyet': '⏳ Chờ duyệt', 'tu-choi': '✕ Tắt' };
  const trangThaiHienTai = (row, vai) => {
    const h = nhungHieuLuc(row, vai);
    return {
      g: h.g,
      nhan: (NHAN_HIEU_LUC[h.g] || '') + (h.pv ? ' · TẤT CẢ các phòng' : ''),
      giaTri: h.ghiDe ? h.g : '',
    };
  };
  const o = (cell) =>
    '<td class="px-2 py-2 align-top">' +
    '<span class="font-semibold text-sm ' + (MAU_KY_HIEU[cell.s] || 'text-gray-400') + '">' + escapeHtml(cell.s) + '</span>' +
    (cell.n ? '<div class="text-[11px] text-gray-500 mt-0.5 leading-snug">' + escapeHtml(cell.n) + '</div>' : '') +
    '</td>';
  const dong = BANG_PHAN_QUYEN.map((row) => {
    const tenTd =
      '<td class="px-2 py-2 text-xs font-medium text-gray-800 align-top">' +
      escapeHtml(row.ten) +
      (row.gc ? '<div class="text-[11px] font-normal text-gray-500 mt-0.5 leading-snug">' + escapeHtml(row.gc) + '</div>' : '') +
      '</td>';
    const adminTd = '<td class="px-2 py-2 align-top"><span class="font-semibold text-sm text-green-600">✓</span></td>';
    if (!row.entityType) {
      return '<tr class="border-t border-gray-100">' + tenTd + adminTd + o(row.g) + o(row.tp) + o(row.pp) + o(row.nv) + '</tr>';
    }
    const cells = VAU_BANG.map((vaiCot) => {
      // VAI CSDL cho mọi tra cứu (ghi đè + ma trận + data-vai); `vaiCot.ten` chỉ dùng in tiêu đề.
      const vai = vaiCot.vai;
      if (laAdmin) {
        const khoa = row.entityType + ':' + row.action;
        const gd = (ghiDe[khoa] || {})[vai] || {};
        const chonPv = gd.pham_vi === 'tat-ca' ? 'tat-ca' : '';
        // «Chờ duyệt» — đúng luật máy chủ (permissions/service.js):
        //   Tạo   : mọi vai trong bảng (Phó GĐ / TP / PP / Cán bộ)
        //   Sửa   : TP / PP (011) và Cán bộ (Vòng 12e — yêu cầu người dùng)
        //   Xoá   : TP / PP (011) và Cán bộ (013 — «Xoá phải qua duyệt»: bấm 🗑 sẽ đổi thành
        //           «Xin xoá» kèm lý do; mục KHÔNG mất cho tới khi người duyệt đồng ý).
        const laLanhDao = vai === 'Trưởng phòng' || vai === 'Phó phòng';
        const coChoDuyet =
          row.action === 'create' ||
          (row.action === 'update' && (laLanhDao || vai === 'Nhân viên')) ||
          (row.action === 'delete' && (laLanhDao || vai === 'Nhân viên'));
        // CÙNG MỘT HÀNG: dropdown hành động + (PGD/TP/PP) dropdown phạm vi nằm ngang.
        // Option đầu = TRẠNG THÁI ĐANG DÙNG (không lặp lại ở sau); chọn nó = về luật gốc.
        const hienTai = trangThaiHienTai(row, vai);
        const cacConLai = [
          ...(hienTai.g !== 'cho-phep' ? ["<option value=\"cho-phep\">✓ Cho phép</option>"] : []),
          ...(coChoDuyet && hienTai.g !== 'cho-duyet' ? ["<option value=\"cho-duyet\">⏳ Chờ duyệt</option>"] : []),
          ...(hienTai.g !== 'tu-choi' ? ["<option value=\"tu-choi\">✕ Tắt</option>"] : []),
        ];
        const oHanhDong =
          '<select class="form-select text-[11px] w-full min-w-0" data-gd="1" data-entity="' + escapeHtmlAttr(row.entityType) + '" data-action="' + escapeHtmlAttr(row.action) + '" data-vai="' + escapeHtmlAttr(vai) + '">' +
          '<option value="' + escapeHtmlAttr(hienTai.giaTri) + '" title="Chọn để trả về luật gốc">' + escapeHtml(hienTai.nhan) + '</option>' +
          cacConLai.join("") +
          '</select>';
        // Chỉ Phó GĐ / Trưởng phòng / Phó phòng có ô phạm vi (Cán bộ: phòng của mình, không nới —
        // service chặn phamVi 'tat-ca' cho vai 'Nhân viên').
        const coPhamVi = vaiCot.phamViText && vai !== 'Nhân viên';
        const oPhamVi = coPhamVi
          ? '<select class="form-select text-[10px] w-full min-w-0 flex-1" data-pv="1" data-entity="' + escapeHtmlAttr(row.entityType) + '" data-action="' + escapeHtmlAttr(row.action) + '" data-vai="' + escapeHtmlAttr(vai) + '" title="Điều kiện phạm vi dữ liệu">' +
            '<option value="">' + escapeHtml(vaiCot.phamViText) + '</option>' +
            '<option value="tat-ca"' + (chonPv ? ' selected' : '') + '>Tất cả phòng</option>' +
            '</select>'
          : '';
        if (!coPhamVi) {
          return '<td class="px-2 py-2 align-top">' + oHanhDong + '</td>';
        }
        return (
          '<td class="px-2 py-2 align-top"><div class="flex items-center gap-1">' +
          '<div class="flex-1 min-w-0">' + oHanhDong + '</div>' +
          '<div class="flex-1 min-w-0">' + oPhamVi + '</div>' +
          '</div></td>'
        );
      }
      return o(oPhanQuyenHieuLuc(row, vai, ghiDe, macDinh));
    }).join('');
    return '<tr class="border-t border-gray-100">' + tenTd + adminTd + cells + '</tr>';
  }).join('');
  const thead =
    '<thead><tr class="bg-gray-50">' +
    '<th class="px-2 py-2 text-left text-xs font-semibold text-gray-600">Chức năng</th>' +
    '<th class="px-2 py-2 text-left text-xs font-semibold text-gray-600">Giám đốc (admin)</th>' +
    VAU_BANG.map((vaiCot) => '<th class="px-2 py-2 text-left text-xs font-semibold text-gray-600">' + escapeHtml(vaiCot.ten) + '</th>').join('') +
    '</tr></thead>';
  const chuThich =
    '<div class="text-[11px] text-gray-500 mt-2 leading-relaxed">' +
    'Ký hiệu: <span class="font-semibold text-green-600">✓</span> được làm ngay · ' +
    '<span class="font-semibold text-amber-600">⏳</span> làm được nhưng phải chờ <b>Phó Giám đốc phụ trách</b> (hoặc Giám đốc) duyệt rồi mới vào thống kê · ' +
    '<span class="font-semibold text-indigo-500">↻</span> mượn qua ủy quyền · ' +
    '<span class="font-semibold text-gray-400">👁</span> chỉ xem · ' +
    '<span class="font-semibold text-red-400">✕</span> không được. ' +
    'Cán bộ chỉ thao tác trong phạm vi phòng của mình. Máy chủ là rào chặn cuối — bảng này mô tả đúng luật của hệ thống, không cấp quyền thêm.</div>';
  // Bọc «col-span-full» để chú thích LUÔN nằm dưới cùng khi khung cha là grid (class the-tai-khoan).
  return (
    '<div class="overflow-x-auto"><table class="min-w-full">' + thead + '<tbody>' + dong + '</tbody></table></div>' +
    '<div class="col-span-full">' + chuThich + '</div>'
  );
}
/** Vẽ bảng phân quyền (động) + trình sửa cho admin; không có khung thì bỏ qua. */
function veBangPhanQuyen() {
  const el = document.getElementById('account-permission-table');
  if (!el) return;
  el.innerHTML = '<div class="text-sm text-gray-500">Đang tải bảng phân quyền...</div>';
  restGet('/api/v1/permissions')
    .then((duLieu) => {
      const laAdmin = isAdmin();
      el.innerHTML = buildBangPhanQuyenHtml(chiSoGhiDe(duLieu && duLieu.ghiDe), duLieu && duLieu.macDinh, laAdmin);
      if (laAdmin) {
        el.insertAdjacentHTML(
          'beforeend',
          '<div class="flex justify-end mt-3"><button type="button" id="pq-save-btn" class="btn-primary thanh-loc-nut"><i class="fas fa-save mr-2"></i>Lưu bảng phân quyền</button></div>'
        );
        document.getElementById('pq-save-btn')?.addEventListener('click', luuPhanQuyen);
      }
    })
    .catch(() => {
      el.innerHTML = '<div class="text-sm text-red-500">Không tải được bảng phân quyền.</div>';
    });
}
async function luuPhanQuyen() {
  const nut = document.getElementById('pq-save-btn');
  nut && (nut.disabled = true);
  const gop = {};
  [...document.querySelectorAll('#account-permission-table select[data-entity]')].forEach((sel) => {
    const khoa = sel.dataset.entity + ':' + sel.dataset.action + ':' + sel.dataset.vai;
    gop[khoa] = gop[khoa] || { vai: sel.dataset.vai, entityType: sel.dataset.entity, action: sel.dataset.action };
    if (sel.dataset.gd) gop[khoa].giaTri = sel.value || 'mac-dinh';
    if (sel.dataset.pv) gop[khoa].phamVi = sel.value || 'phong';
  });
  const ketQua = await restGhi('PUT', '/api/v1/permissions', { thayDoi: Object.values(gop) });
  if (ketQua) {
    showToast('Đã lưu bảng phân quyền — hiệu lực ngay', 'success');
    veBangPhanQuyen();
  } else {
    showToast('Không lưu được bảng phân quyền', 'error');
    nut && (nut.disabled = false);
  }
}
function renderTrangTaiKhoan() {
  const el = document.getElementById("account-info");
  if (!el) return;
  if (!isAuthenticated || !currentUser) {
    el.innerHTML = "<div class=\"text-sm text-gray-500\">Bạn cần đăng nhập để xem thông tin tài khoản.</div>";
    return;
  }
  const uyQuyenText =
    uyQuyenNhan.length === 0
      ? "Không có"
      : uyQuyenNhan.map(row => (row.from_user_name || "?") + " (đến " + ngayVN(row.to_date) + ")").join("; ");
  el.innerHTML = [
    buildTaiKhoanDong("Họ tên", currentUser.name || currentUser.full_name),
    buildTaiKhoanDong("Mã cán bộ", currentUser.code),
    buildTaiKhoanDong("Email", currentUser.email),
    buildTaiKhoanDong("Chức vụ", currentUser.position),
    buildTaiKhoanDong("Phân quyền", hienThiVai(currentUser.role === "admin" ? "Giám đốc" : currentUser.role)),
    buildTaiKhoanDong("Phòng", tenPhongTaiKhoan()),
    buildTaiKhoanDong("Vai trò phòng", myDeptRole || currentUser.dept_role),
    buildTaiKhoanDong("Đối tượng", currentUser.object_type),
    buildTaiKhoanDong("Trạng thái", currentUser.is_active === false ? "Đã khoá" : "Đang hoạt động"),
    buildTaiKhoanDong("Đang mượn quyền của", uyQuyenText)
  ].join("");
  veBangPhanQuyen();
}
/** Nối form đổi mật khẩu + nút Tải lại của trang tài khoản — MỘT lần (mốc dataset.daNoi). */
function setupTrangTaiKhoan() {
  const form = document.getElementById("account-password-form"),
    nutTaiLai = document.getElementById("account-refresh-btn");
  nutTaiLai && !nutTaiLai.dataset.daNoi && ((nutTaiLai.dataset.daNoi = "1"), nutTaiLai.addEventListener("click", renderTrangTaiKhoan));
  if (!form || form.dataset.daNoi) return;
  form.dataset.daNoi = "1";
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    // `form.elements.X` (không `form.X`) để chạy được cả dưới jsdom — cùng lý do như modal đổi mật khẩu.
    // Mật khẩu hiện tại KHÔNG `.trim()`: dấu cách là một phần mật khẩu đã đặt.
    const matKhauCu = form.elements.currentPassword.value,
      matKhauMoi = form.elements.newPassword.value.trim(),
      nhacLai = form.elements.confirmPassword.value.trim(),
      nut = document.getElementById("account-password-submit");
    hienLoiTaiKhoan(""), hienOkTaiKhoan("");
    if (!matKhauCu || !matKhauMoi || !nhacLai) return hienLoiTaiKhoan("Vui lòng nhập đủ ba ô mật khẩu.");
    if (matKhauMoi.length < 6) return hienLoiTaiKhoan("Mật khẩu mới phải có ít nhất 6 ký tự.");
    if (matKhauMoi !== nhacLai) return hienLoiTaiKhoan("Hai lần nhập mật khẩu mới không giống nhau.");
    if (matKhauMoi === matKhauCu) return hienLoiTaiKhoan("Mật khẩu mới phải khác mật khẩu hiện tại.");
    setButtonLoading(nut, true), google.script.run
      .withSuccessHandler(function (response) {
        setButtonLoading(nut, false);
        if (response && response.success) {
          form.reset(), hienOkTaiKhoan(response.message || "Đã đổi mật khẩu."), showToast(response.message || "Đã đổi mật khẩu.", "success");
        } else hienLoiTaiKhoan((response && response.error) || "Không đổi được mật khẩu.");
      })
      .withFailureHandler(function (error) {
        setButtonLoading(nut, false), hienLoiTaiKhoan("Lỗi: " + ((error && error.message) || error));
      })
      .changePassword(matKhauCu, matKhauMoi, nhacLai);
  });
}
function hienLoiTaiKhoan(message) {
  const el = document.getElementById("account-password-error");
  if (!el) return;
  el.textContent = message || "", message ? el.classList.remove("hidden") : el.classList.add("hidden");
}
function hienOkTaiKhoan(message) {
  const el = document.getElementById("account-password-ok");
  if (!el) return;
  el.textContent = message || "", message ? el.classList.remove("hidden") : el.classList.add("hidden");
}

/**
 * Một nút hành động của bảng ủy quyền. Gom về một hàm để mọi giá trị chỉ đi qua ĐÚNG MỘT chỗ thoát —
 * ba nút (huỷ/rút lại, đồng ý, từ chối) khác nhau đúng bốn chuỗi cố định.
 */
function buildUyQuyenNut(lop, mau, icon, nhan, id, nguoi) {
  return (
    "<button type=\"button\" class=\"" +
    escapeHtmlAttr(lop) +
    " text-xs " +
    escapeHtmlAttr(mau) +
    "\" data-id=\"" +
    escapeHtmlAttr(id) +
    "\" data-nguoi=\"" +
    escapeHtmlAttr(nguoi || "") +
    "\"><i class=\"fas " +
    escapeHtmlAttr(icon) +
    " mr-1\"></i>" +
    escapeHtml(nhan) +
    "</button>"
  );
}

/**
 * Một dòng bảng ủy quyền. `laGiao` = bản ghi TÔI cho người khác.
 *
 * Năm trạng thái hiện ra năm câu khác nhau vì người dùng cần biết đang chờ AI: `pending` là chờ
 * NGƯỜI NHẬN bấm (§13.4 mục 20), `declined` là họ đã trả lời không. Nút cũng theo chiều: người giao
 * rút lại/huỷ được, người nhận đồng ý/từ chối được — không ai làm thay ai.
 */
function buildUyQuyenRow(row, laGiao) {
  const hieuLuc = row.dang_hieu_luc === true,
    ma = String(row.status || ""),
    daHuy = ma === "cancelled",
    choDuyet = ma === "pending",
    daTuChoi = ma === "declined",
    conSong = !daHuy && !daTuChoi,
    trangThai = daHuy
      ? "Đã huỷ"
      : daTuChoi
        ? "Đã từ chối"
        : choDuyet
          ? "Chờ phê duyệt"
          : hieuLuc
            ? "Đang hiệu lực"
            : "Chưa/hết hiệu lực",
    mauTrangThai = daHuy
      ? "bg-gray-100 text-gray-600"
      : daTuChoi
        ? "bg-red-100 text-red-700"
        : choDuyet
          ? "bg-blue-100 text-blue-700"
          : hieuLuc
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700",
    nguoi = laGiao ? row.to_user_name : row.from_user_name;
  return (
    "<tr class=\"border-b border-gray-100\">" +
    "<td class=\"py-2 pr-3 text-gray-900\">" +
    escapeHtml(nguoi || "") +
    "</td>" +
    "<td class=\"py-2 pr-3 text-gray-600 whitespace-nowrap\">" +
    escapeHtml(ngayVN(row.from_date)) +
    " – " +
    escapeHtml(ngayVN(row.to_date)) +
    "</td>" +
    "<td class=\"py-2 pr-3 text-gray-600\">" +
    escapeHtml(tenPhongTheoIds(row.department_ids)) +
    "</td>" +
    "<td class=\"py-2 pr-3\"><span class=\"px-2 py-0.5 rounded-full text-xs " +
    escapeHtmlAttr(mauTrangThai) +
    "\">" +
    escapeHtml(trangThai) +
    "</span></td>" +
    "<td class=\"py-2 pr-3 text-gray-600\">" +
    escapeHtml(row.note || "") +
    "</td>" +
    "<td class=\"py-2 text-right whitespace-nowrap\">" +
    (laGiao && conSong
      ? buildUyQuyenNut(
          "uy-quyen-huy",
          "text-red-600 hover:text-red-700",
          "fa-ban",
          choDuyet ? "Rút lại" : "Huỷ",
          row.id,
          nguoi
        )
      : "") +
    (!laGiao && choDuyet
      ? buildUyQuyenNut(
          "uy-quyen-dong-y",
          "text-green-700 hover:text-green-800 mr-3",
          "fa-check",
          "Đồng ý",
          row.id,
          nguoi
        ) +
        buildUyQuyenNut(
          "uy-quyen-tu-choi",
          "text-red-600 hover:text-red-700",
          "fa-times",
          "Từ chối",
          row.id,
          nguoi
        )
      : "") +
    "</td>" +
    "</tr>"
  );
}

/** Một bảng (tôi giao / tôi nhận). Rỗng thì nói rõ là rỗng, không để khoảng trắng vô nghĩa. */
function buildUyQuyenBang(rows, laGiao) {
  if (rows.length === 0) {
    return "<p class=\"text-sm text-gray-500 italic py-2\">" + escapeHtml(laGiao ? "Bạn chưa ủy quyền cho ai." : "Chưa ai ủy quyền cho bạn.") + "</p>";
  }
  return (
    "<div class=\"overflow-x-auto\"><table class=\"w-full text-sm\"><thead><tr class=\"text-left text-xs uppercase text-gray-500 border-b border-gray-200\">" +
    "<th class=\"py-2 pr-3\">" +
    escapeHtml(laGiao ? "Người nhận" : "Người ủy quyền") +
    "</th><th class=\"py-2 pr-3\">Khoảng ngày</th><th class=\"py-2 pr-3\">Phạm vi</th>" +
    "<th class=\"py-2 pr-3\">Trạng thái</th><th class=\"py-2 pr-3\">Ghi chú</th><th></th>" +
    "</tr></thead><tbody>" +
    rows.map(row => buildUyQuyenRow(row, laGiao)).join("") +
    "</tbody></table></div>"
  );
}

// Bậc vai + ba cặp được khác phòng: BẢN SAO nguyên văn `BAC_VAI` và `NGOAI_LE_KHAC_PHONG` của
// `server/src/modules/delegations/service.js`. Sao chép chứ không đoán lại: sai một bậc là danh sách
// hiện người mà máy chủ sẽ từ chối (`DELEGATION_RANK_UP` / `DELEGATION_DIFFERENT_DEPARTMENT`).
// Sửa luật ở máy chủ thì PHẢI sửa hai hằng này — test TC-UQ-19 chốt từng cặp.
const UQ_BAC_VAI = { admin: 1, "Phó Giám đốc": 2, "Trưởng phòng": 3, "Phó phòng": 4, "Quản lý công việc": 5, "Nhân viên": 5 },
  UQ_KHAC_PHONG = { admin: ["Phó Giám đốc"], "Phó Giám đốc": ["Phó Giám đốc", "Trưởng phòng"] };

/** Bậc của một vai; `null` = vai lạ (dữ liệu sửa tay) và vai lạ thì không ủy quyền được — giống `bacVai()` máy chủ. */
function uqBacVai(role) {
  const key = String(role == null ? "" : role);
  return Object.hasOwn(UQ_BAC_VAI, key) ? UQ_BAC_VAI[key] : null;
}

/**
 * TÊN phòng của chính tôi. Phải đổi `currentUser.department_id` (số) sang tên vì `staffToLegacy`
 * chỉ trả `COL.S_DEPT` là TÊN phòng — không có cột id phòng nào trong danh sách cán bộ.
 * Không tra được (Giám đốc không thuộc phòng nào, hoặc phòng lạ) ⇒ chuỗi rỗng ⇒ luật cùng phòng
 * không khớp ai: hẹp hơn máy chủ, không bao giờ rộng hơn.
 */
function tenPhongCuaToi() {
  const id = currentUser && currentUser.department_id != null ? String(currentUser.department_id) : "";
  if (id === "") return "";
  const dept = (Array.isArray(allDepartments) ? allDepartments : []).find(item => String(item[COL.D_DB_ID] == null ? "" : item[COL.D_DB_ID]) === id);
  return dept ? String(dept[COL.D_NAME] || "").trim() : "";
}

/**
 * Những người TÔI được ủy quyền cho — bản sao của `assertBacVaPhong` phía máy chủ: bậc vai ngang
 * bằng hoặc thấp hơn (R2), cùng phòng trừ ba cặp ngoại lệ (R3), không tự ủy quyền cho mình (L1),
 * và không bao giờ là Nhà cung cấp (họ không có tài khoản).
 *
 * Xếp theo bậc rồi theo tên để danh sách đọc như sơ đồ tổ chức, không theo thứ tự mã nhân sự.
 */
function dsNguoiNhanUyQuyen() {
  const bacTu = uqBacVai(currentUser && currentUser.role);
  if (bacTu === null) return [];
  const phongToi = tenPhongCuaToi(),
    emailToi = String((currentUser && currentUser.email) || "").trim().toLowerCase(),
    ngoaiLe = UQ_KHAC_PHONG[String(currentUser.role)] || [];
  return (Array.isArray(allStaff) ? allStaff : [])
    .filter(staff => {
      // Bẫy COL: cột "Đối tượng" của dữ liệu thật/seed là **'Nội bộ'**, chỉ người tạo qua giao diện
      // mới mang chữ 'Người dùng' ⇒ chỉ được loại theo 'Nhà cung cấp' (giống dòng 1293), tuyệt đối
      // không đòi === 'Người dùng': đòi thế thì danh sách rỗng với đúng những người có thật.
      if (String(staff[COL.S_OBJECT_TYPE] || "Nội bộ") === "Nhà cung cấp") return false;
      const email = String(staff[COL.S_EMAIL] || "").trim().toLowerCase();
      if (email === "" || email === emailToi) return false;
      const vai = String(staff[COL.S_ROLE] || ""),
        bacDen = uqBacVai(vai);
      if (bacDen === null || bacTu > bacDen) return false;
      if (ngoaiLe.includes(vai)) return true;
      const phongDen = String(staff[COL.S_DEPT] || "").trim();
      return phongToi !== "" && phongDen !== "" && phongDen === phongToi;
    })
    .sort((a, b) => (uqBacVai(a[COL.S_ROLE]) - uqBacVai(b[COL.S_ROLE])) || String(a[COL.S_NAME] || "").localeCompare(String(b[COL.S_NAME] || ""), "vi"));
}

/**
 * Ô CHỌN NGƯỜI NHẬN của form ủy quyền — thay ô gõ email tự do (yêu cầu 2026-08-28: «cái này là sẽ
 * chọn người, danh sách hiện ra sẽ đúng theo luồng đã nói»).
 *
 * Vì sao đổi: gõ tay thì người dùng chỉ biết mình chọn sai SAU khi bấm gửi và đọc `DELEGATION_RANK_UP`
 * hoặc `DELEGATION_DIFFERENT_DEPARTMENT`. Danh sách chỉ chứa người hợp lệ thì hai câu lỗi đó không
 * còn dịp xuất hiện — mà máy chủ vẫn kiểm lại đủ, giao diện KHÔNG nới rộng gì.
 *
 * Giá trị option vẫn là EMAIL để `taoUyQuyen()` gửi đúng khoá `toUserId` như cũ (`timNguoi` dò email).
 * Danh sách rỗng thì nói rõ lý do ngay dưới ô thay vì để người dùng bấm gửi rồi nhận lỗi.
 */
function buildUyQuyenNguoiNhan() {
  const list = dsNguoiNhanUyQuyen();
  if (list.length === 0) {
    return (
      "<select name=\"to\" class=\"form-select\" required disabled><option value=\"\">-- Không có ai hợp lệ --</option></select>\n" +
      "                      <p class=\"text-xs text-red-600 mt-1\">" +
      escapeHtml("Không có ai bạn ủy quyền được: chỉ chọn được người cùng phòng, vai ngang bằng hoặc thấp hơn (Giám đốc → Phó Giám đốc, Phó Giám đốc → Phó Giám đốc hoặc Trưởng phòng là ngoại lệ).") +
      "</p>"
    );
  }
  return (
    "<select name=\"to\" class=\"form-select\" required>\n" +
    "                          <option value=\"\">-- Chọn người nhận --</option>\n                          " +
    list
      .map(
        staff =>
          "<option value=\"" +
          escapeHtmlAttr(String(staff[COL.S_EMAIL]).trim().toLowerCase()) +
          "\">" +
          escapeHtml(String(staff[COL.S_NAME] || staff[COL.S_EMAIL] || "").trim() + " — " + hienThiVai(staff[COL.S_ROLE] === "admin" ? "Giám đốc" : staff[COL.S_ROLE]) + (staff[COL.S_DEPT] ? " · " + staff[COL.S_DEPT] : "")) +
          "</option>"
      )
      .join("\n                          ") +
    "\n                      </select>"
  );
}

/**
 * Ô chọn PHẠM VI PHÒNG của form ủy quyền — chỉ hiện với Giám đốc, rỗng với mọi vai khác.
 *
 * Lý do phân biệt: người thường để phạm vi rỗng thì máy chủ tự suy ra các phòng họ đang phụ trách
 * (`department_managers`), nên thêm ô chọn chỉ mời họ đoán rộng hơn quyền thật. Còn Giám đốc KHÔNG
 * có dòng `department_managers` nào, nên máy chủ BẮT liệt kê phòng (`DELEGATION_ADMIN_SCOPE_REQUIRED`
 * — §13.4 mục 18: «giám đốc có thể ủy quyền cho phó giám đốc»): không có ô này thì Giám đốc không
 * tạo được bản ủy quyền nào từ giao diện.
 *
 * Danh sách phòng ở đây là toàn bộ `allDepartments` vì Giám đốc phụ trách mọi phòng; máy chủ vẫn
 * kiểm lại từng id (`DELEGATION_SCOPE_TOO_WIDE`), giao diện không tự nới rộng gì.
 */
function buildUyQuyenPhamVi() {
  if (!currentUser || currentUser.role !== "admin") return "";
  const list = (Array.isArray(allDepartments) ? allDepartments : []).filter(d => String(d[COL.D_DB_ID] == null ? "" : d[COL.D_DB_ID]).trim() !== "");
  return (
    "<div class=\"form-group\">\n" +
    "                  <label class=\"form-label required\">Phòng được mượn quyền</label>\n" +
    "                  <select name=\"departmentIds\" class=\"form-input\" multiple size=\"" +
    escapeHtmlAttr(String(Math.min(Math.max(list.length, 3), 6))) +
    "\" required>" +
    list.map(d => "<option value=\"" + escapeHtmlAttr(d[COL.D_DB_ID]) + "\">" + escapeHtml(d[COL.D_NAME]) + "</option>").join("") +
    "</select>\n" +
    "                  <p class=\"text-xs text-gray-500 mt-1\">Giữ Ctrl (hoặc Cmd trên máy Mac) để chọn nhiều phòng. Quyền toàn hệ thống không cho mượn được, nên phải ghi rõ phòng nào.</p>\n" +
    "              </div>\n              "
  );
}

/**
 * Modal «Ủy quyền của tôi». Form tạo mới hỏi người nhận, khoảng ngày và ghi chú; ô phạm vi phòng
 * chỉ hiện với Giám đốc (xem `buildUyQuyenPhamVi`) — vai khác để máy chủ suy ra từ các phòng họ
 * đang phụ trách (`department_managers`), vì đoán rộng hơn máy chủ chỉ đổi một lời từ chối rõ ràng
 * thành một ô nhập gây nhầm.
 */
function createUyQuyenModal(dsGiao, dsNhan) {
  return (
    "\n  <div id=\"uy-quyen-modal\" class=\"modal\">\n      <div class=\"modal-content max-w-3xl\">\n" +
    "          <div class=\"flex items-center justify-between mb-4\">\n" +
    "              <h3 class=\"text-xl font-bold text-gray-900\"><i class=\"fas fa-user-shield mr-2 text-blue-600\"></i>Ủy quyền của tôi</h3>\n" +
    "              <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\"><i class=\"fas fa-times\"></i></button>\n" +
    "          </div>\n\n" +
    "          <p class=\"text-xs text-gray-500 mb-4\">Bản ủy quyền mới ở trạng thái «Chờ phê duyệt»: người nhận phải bấm Đồng ý thì quyền mới có hiệu lực. Họ dùng quyền của bạn trong đúng khoảng ngày, chỉ ở các phòng bạn phụ trách, và mọi việc làm nhờ ủy quyền đều được ghi nhật ký kèm mã bản ủy quyền.</p>\n\n" +
    "          <h4 class=\"text-sm font-semibold text-gray-700 mb-1\">Tôi ủy quyền cho</h4>\n          " +
    buildUyQuyenBang(dsGiao, true) +
    "\n\n          <h4 class=\"text-sm font-semibold text-gray-700 mt-5 mb-1\">Tôi được ủy quyền</h4>\n          " +
    buildUyQuyenBang(dsNhan, false) +
    "\n\n          <form id=\"uy-quyen-form\" class=\"mt-5 pt-4 border-t border-gray-200\">\n" +
    "              <h4 class=\"text-sm font-semibold text-gray-700 mb-2\">Ủy quyền mới</h4>\n" +
    "              <div class=\"grid grid-cols-1 md:grid-cols-3 gap-3 mb-3\">\n" +
    "                  <div class=\"form-group mb-0\">\n" +
    "                      <label class=\"form-label required\">Người nhận</label>\n" +
    "                      " +
    buildUyQuyenNguoiNhan() +
    "\n                  </div>\n" +
    "                  <div class=\"form-group mb-0\">\n" +
    "                      <label class=\"form-label required\">Từ ngày</label>\n" +
    "                      <input type=\"date\" name=\"fromDate\" class=\"form-input\" required value=\"" +
    escapeHtmlAttr(homNayISO()) +
    "\">\n                  </div>\n" +
    "                  <div class=\"form-group mb-0\">\n" +
    "                      <label class=\"form-label required\">Đến ngày</label>\n" +
    "                      <input type=\"date\" name=\"toDate\" class=\"form-input\" required value=\"" +
    escapeHtmlAttr(homNayISO()) +
    "\">\n                  </div>\n" +
    "              </div>\n              " +
    buildUyQuyenPhamVi() +
    "<div class=\"form-group\">\n" +
    "                  <label class=\"form-label\">Ghi chú</label>\n" +
    "                  <input type=\"text\" name=\"note\" class=\"form-input\" maxlength=\"1000\" placeholder=\"Đi công tác, họp ngoài cơ quan...\">\n" +
    "              </div>\n" +
    "              <div id=\"uy-quyen-error\" class=\"hidden mb-3\"></div>\n" +
    "              <div class=\"flex justify-end space-x-3\">\n" +
    "                  <button type=\"button\" class=\"btn-secondary close-modal\">Đóng</button>\n" +
    "                  <button type=\"submit\" class=\"btn-accent\"><i class=\"fas fa-user-shield mr-2\"></i>Gửi đề nghị</button>\n" +
    "              </div>\n" +
    "          </form>\n" +
    "      </div>\n  </div>\n"
  );
}

/** Hiện lỗi trong modal ủy quyền — câu chữ của máy chủ, không diễn giải lại. */
function showUyQuyenError(message) {
  const el = document.getElementById("uy-quyen-error");
  if (!el) return;
  message
    ? (el.innerHTML = "<div class=\"text-red-600 text-sm\">" + escapeHtml(message) + "</div>", el.classList.remove("hidden"))
    : (el.innerHTML = "", el.classList.add("hidden"));
}

/**
 * Mở modal ủy quyền. Không đi qua `openModal()` vì hàm đó đẩy submit sang `handleAdd/handleEdit` —
 * hai hàm ấy không biết loại "uy-quyen" (cùng lý do như `openDepartmentModal`).
 */
async function moModalUyQuyen() {
  if (!isAuthenticated) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  const duLieu = await restGet("/api/v1/delegations");
  if (!duLieu) return;
  const rows = duLieu.delegations || [];
  uyQuyenNhan = rows.filter(row => row.dang_hieu_luc === true && laCuaToi(row, "to_user_id"));
  veNhanUyQuyen();
  const existing = document.getElementById("uy-quyen-modal");
  existing && existing.remove();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = createUyQuyenModal(
    rows.filter(row => laCuaToi(row, "from_user_id")),
    rows.filter(row => laCuaToi(row, "to_user_id"))
  ), document.body.appendChild(wrapper.firstElementChild);
  const modal = document.getElementById("uy-quyen-modal");
  modal.classList.add("active"), modal.querySelector("form")?.addEventListener("submit", function (event) {
    event.preventDefault(), taoUyQuyen();
  }), modal.querySelectorAll(".close-modal").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault(), closeModal("uy-quyen-modal");
    });
  }), modal.querySelectorAll(".uy-quyen-huy").forEach(button => {
    button.addEventListener("click", function () {
      huyUyQuyen(this.dataset.id, this.dataset.nguoi);
    });
  }), modal.querySelectorAll(".uy-quyen-dong-y").forEach(button => {
    button.addEventListener("click", function () {
      traLoiUyQuyen(this.dataset.id, this.dataset.nguoi, true);
    });
  }), modal.querySelectorAll(".uy-quyen-tu-choi").forEach(button => {
    button.addEventListener("click", function () {
      traLoiUyQuyen(this.dataset.id, this.dataset.nguoi, false);
    });
  }), modal.addEventListener("click", event => {
    event.target === modal && closeModal("uy-quyen-modal");
  });
}

/**
 * Tạo bản ủy quyền. Ngày gửi lên đúng `YYYY-MM-DD` của `<input type="date">`, không tự đổi định dạng.
 *
 * `departmentIds` CHỈ gửi khi có phòng được chọn (ô này chỉ Giám đốc thấy): mảng rỗng và không gửi
 * gì đều được máy chủ đọc là "theo phòng người ủy quyền đang phụ trách", nên không gửi khoá rỗng
 * cho đỡ một chỗ hiểu sai.
 */
async function taoUyQuyen() {
  const form = document.getElementById("uy-quyen-form");
  if (!form) return;
  const submitButton = form.querySelector("button[type=\"submit\"]"),
    formData = new FormData(form),
    read = key => String(formData.get(key) || "").trim(),
    phongIds = formData.getAll("departmentIds").map(v => Number(String(v).trim())).filter(v => Number.isInteger(v) && v > 0),
    than = { toUserId: read("to").toLowerCase(), fromDate: read("fromDate"), toDate: read("toDate"), note: read("note") };
  if (phongIds.length > 0) than.departmentIds = phongIds;
  if (!than.toUserId || !than.fromDate || !than.toDate) {
    showUyQuyenError("Cần chọn người nhận và đủ hai mốc ngày.");
    return;
  }
  // Chặn sớm ĐÚNG bằng luật máy chủ (`DELEGATION_ADMIN_SCOPE_REQUIRED`), không rộng hơn: đỡ một vòng
  // gọi cho trường hợp Giám đốc quên chọn phòng.
  if (form.querySelector("select[name=\"departmentIds\"]") && phongIds.length === 0) {
    showUyQuyenError("Giám đốc phải ghi rõ (các) phòng khi ủy quyền — quyền toàn hệ thống không cho mượn được.");
    return;
  }
  if (than.toDate < than.fromDate) {
    showUyQuyenError("Ngày kết thúc không được trước ngày bắt đầu.");
    return;
  }
  showUyQuyenError(""), setButtonLoading(submitButton, true);
  const res = await restGhi("POST", "/api/v1/delegations", than);
  setButtonLoading(submitButton, false);
  if (!res.ok) {
    showUyQuyenError(res.error);
    return;
  }
  showToast("Đã gửi đề nghị ủy quyền cho " + than.toUserId + " — chờ người nhận phê duyệt", "success"), closeModal("uy-quyen-modal"), await napUyQuyenCuaToi(), moModalUyQuyen();
}

/**
 * Người NHẬN trả lời đề nghị: đồng ý (`/accept`) hoặc từ chối (`/decline`) — §13.4 mục 20.
 *
 * Hỏi lại trước khi TỪ CHỐI, không hỏi khi đồng ý: từ chối là câu trả lời không lấy lại được (người
 * ủy quyền phải tạo bản mới), còn đồng ý thì họ vẫn huỷ được.
 */
async function traLoiUyQuyen(id, nguoi, dongY) {
  if (!id) return;
  if (!dongY && !window.confirm("Từ chối ủy quyền từ " + (nguoi || "người này") + "?")) return;
  const res = await restGhi("POST", "/api/v1/delegations/" + encodeURIComponent(id) + (dongY ? "/accept" : "/decline"));
  if (!res.ok) {
    showToast(res.error, "error");
    return;
  }
  showToast(dongY ? "Đã nhận ủy quyền" : "Đã từ chối ủy quyền", "success"), closeModal("uy-quyen-modal"), await napUyQuyenCuaToi(), moModalUyQuyen();
}

/** Huỷ MỀM một bản ủy quyền của mình (máy chủ đặt `status='cancelled'`, dòng vẫn còn để tra nhật ký). */
async function huyUyQuyen(id, nguoi) {
  if (!id) return;
  if (!window.confirm("Huỷ ủy quyền cho " + (nguoi || "người này") + "?")) return;
  const res = await restGhi("DELETE", "/api/v1/delegations/" + encodeURIComponent(id));
  if (!res.ok) {
    showToast(res.error, "error");
    return;
  }
  showToast("Đã huỷ ủy quyền", "success"), closeModal("uy-quyen-modal"), await napUyQuyenCuaToi(), moModalUyQuyen();
}






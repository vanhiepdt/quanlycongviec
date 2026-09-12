// app.js — SINH RA TỪ js.clean.html ở Phase 4 việc 4.1 (lệnh sed, không sửa tay một dòng logic nào).
// Bản gốc js.clean.html ở thư mục gốc repo giữ lại làm mốc ĐỐI CHIẾU và ĐÃ ĐÓNG BĂNG:
// từ Phase 4 trở đi chỉ sửa file này. Sửa js.clean.html là sửa vào chỗ không ai nạp.
//
// Ba thay đổi duy nhất Phase 4 được phép làm ở đây (§7 Phase 4): modal đổi mật khẩu bắt buộc (4.5),
// thoát ký tự chống XSS (4.6) và bỏ listener chết (4.7). CẤM đổi tên hàm, đổi id DOM, dọn code —
// để phase sau.
// Dấu phiên bản: mở DevTools Console phải thấy dòng này — thiếu/lẻ là trình duyệt đang chạy file cũ.
console.info("[QLCV] app.js 20260912-02");
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
  // 2026-09-10: tab Nhiệm vụ MẶC ĐỊNH «Tất cả tháng» (0), giống `projectsXemThang` bên dưới.
  // Trước đây mặc định là tháng hiện tại nên nhiệm vụ có ngày rơi vào tháng khác — điển hình là
  // nhiệm vụ trực thuộc công việc cha vừa tạo, hạn tháng sau — BIẾN MẤT khỏi tab mà không một câu
  // nào giải thích. Người dùng báo đúng ca đó: «không hiển thị nhiệm vụ trực thuộc công việc cha».
  tasksXemThang = 0,
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
  // Bug 2 (8b): tỷ lệ gia quyền của đầu mục — server chia đều khi tạo, người có quyền «sửa tỷ lệ»
  // chỉnh tay. Giá trị chuỗi phải KHỚP server legacyFields.js (col-parity.test.js).
  T_TY_LE: "Tỷ lệ công việc (%)",
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
async function handleSuccessfulLogin(data) {
  if (currentUser?.id !== data.user?.id) { capNhatBangQuyen(null); phamViQuyen = null; }
  currentUser = data.user;
  isAuthenticated = true;
  const nguoiDangNhap = currentUser;
  await napPhanQuyenHienTai();
  if (currentUser !== nguoiDangNhap || !isAuthenticated) return;
  batDauHoiLaiQuyen();
  allProjects = data.projects || [], allTasks = data.tasks || [], allStaff = data.staff || [], allProposals = data.proposals || [], allApps = data.apps || [], allAdminNames = data.adminNames || [], updateUIForUser(currentUser), renderStats(data.summaryStats), renderProjects(), renderTasks(), renderStaff(), renderProposals(), renderApps(), renderChart(data.chartData), renderProjectProgressChart(), renderTaskPriorityChart(), renderTimelineProgressChart(), renderProjectComparisonChart(), renderStaffPerformanceChart(), renderActivity(data.recentActivities), renderPriorityTasksMini(), renderTaskStats(), renderProjectStats(), updateOverviewProjectDatalist();
  if (currentSection === "overview") {
    const overviewFilterContainerEl = document.getElementById("overview-filter-container");
    overviewFilterContainerEl && overviewFilterContainerEl.classList.remove("hidden");
  }
  setupGanttEventListeners(), loadDepartmentContext(), currentSection === "gantt" && renderGanttChart(), typeof napTongQuanTuServer === "function" && napTongQuanTuServer(), napUyQuyenCuaToi(), setTimeout(() => {
    currentSection === "overview" && loadChatMessagesAsync();
  }, 500);
  // Chuông thông báo (2026-09-06): con số lấy NGAY từ gói đăng nhập (`unreadCount`) nên badge đúng
  // ở lần vẽ đầu, không chờ một vòng fetch. Danh sách chỉ nạp khi người dùng bấm mở hộp.
  capNhatBadgeThongBao(data.unreadCount), goiNutThongBao(), batDauHoiLaiThongBao();
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
      if (currentUser || isDeputyDirectorUser || truocLaDeputy || isDepartmentHeadUser || truocLaHead) {
        // Vòng 12d: thêm TP/PP — lần vẽ đầu của họ chạy lúc `myDepartment` còn rỗng (bối cảnh
        // phòng về SAU), giờ bối cảnh về là phải vẽ lại đúng như đã vá cho Phó GĐ (bẫy §13.5).
        // Vài hàm vẽ lại (renderProjectStats...) không tự kiểm phần tử null — bọc try/catch để một
        // khung thiếu trên trang không chặn mất `callback(response)` bên dưới (bài học api-bridge.js:
        // "vỡ thì vẫn phải thấy dấu vết, không được nuốt", nhưng KHÔNG được làm mất lượt gọi tiếp theo).
        try {
          hideAdminButtons(), renderProjects(), renderTasks(), renderProjectStats(), renderTaskStats(), renderStats(), renderPriorityTasksMini();
          currentSection === "gantt" && renderGanttChart();
          currentSection === "projects" && (goiNutChoDuyetPanel(), renderChoDuyetPanel());
          currentSection === "cho-duyet" && napTrangChoDuyet();
          capNhatNavChoDuyet();
        } catch (err) {
          console.error("Không vẽ lại được công việc/nhiệm vụ sau khi đổi phòng phụ trách:", err);
        }
      }
    }
    // 2026-09-03: mục «Hàng chờ phê duyệt» phải mở cho MỌI vai có cửa duyệt — trước đây lời gọi
    // nằm trong nhánh «đổi vai TP/PP/Phó GĐ» phía trên nên Giám đốc (admin) không bao giờ chạy
    // tới, mục nằm im với class `hidden` của HTML. Bọc try/catch: badge gọi REST, vỡ thì vẫn
    // phải trả `callback(response)` bên dưới.
    try {
      capNhatNavChoDuyet();
    } catch (err) {
      console.error("Không cập nhật được mục Hàng chờ phê duyệt:", err);
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
  document.getElementById("user-info").classList.remove("hidden"), document.getElementById("login-prompt").classList.add("hidden");
  const userAvatarEl = document.getElementById("user-avatar"),
    userNameEl = document.getElementById("user-name"),
    userRoleEl = document.getElementById("user-role");
  if (userAvatarEl && userNameEl && userRoleEl) {
    const slice = user.name.split(" ").map(item => item[0]).join("").toUpperCase().slice(0, 2);
    userAvatarEl.textContent = slice, userNameEl.textContent = user.name, userRoleEl.textContent = user.role;
  }
  const projectsNavEl = document.getElementById("projects-nav"), staffNavEl = document.getElementById("staff-nav");
  if (projectsNavEl) projectsNavEl.style.display = coQuyenTrongPhamVi("work", "read") ? "flex" : "none";
  if (staffNavEl) staffNavEl.style.display = isAdmin() ? "flex" : "none";
  isAdmin() ? showAdminButtons() : hideAdminButtons();
  // Việc 4.7 — đã bỏ chỗ ẩn/hiện `#add-notification-btn`: `index.html` KHÔNG có nút đó, nên hai
  // nhánh if này chưa bao giờ chạm được vào gì. Listener "click" của cùng id cũng đã bỏ (dòng 470
  // cũ). Hệ quả phải nói rõ: modal tạo thông báo (`createNotificationModal`) hiện KHÔNG có đường
  // vào — bản Apps Script cũng vậy, không phải Phase 4 làm mất. Muốn có thì thêm nút ở Phase 7
  // cùng module thông báo, chứ Phase 4 chỉ được cắt chuyển, không thêm tính năng.
  updatePageTitle();
}
function hideAdminButtons() {
  if (isAdmin()) { showAdminButtons(); return; }
  ["add-staff-btn", "quick-add-staff", "quick-add-app", "add-app-btn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  ["add-project-standalone", "quick-add-project", "add-task-standalone", "quick-add-task"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id.includes("project") ? coQuyenTaoCongViec() : canUserCreateTask()) ? "" : "none";
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
  document.querySelectorAll(".edit-btn, .delete-btn, .copy-btn").forEach(el => {
    const fn = el.classList.contains("copy-btn") ? canUserCopyResource : el.classList.contains("delete-btn") ? canUserDeleteResource : canUserEditResource;
    el.style.display = fn(el.dataset.type, el.dataset.id) ? "" : "none";
  });
}
function handleLogout() {
  showConfirmDialog("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?", function () {
    google.script.run.withSuccessHandler(function (response) {
      dungHoiLaiQuyen();
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
  return (phamViQuyen?.vai || currentUser?.role) === "admin";
}
function isManager() {
  return false; // Vai phân quyền Quản lý công việc đã bỏ ở migration021.
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
  return !!(currentUser && (phamViQuyen?.vai || currentUser.role) === "Phó Giám đốc");
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
  }), document.getElementById("change-password-btn")?.addEventListener("click", showChangePasswordModal), document.getElementById("uy-quyen-btn")?.addEventListener("click", moModalUyQuyen), document.getElementById("mobile-menu-btn").addEventListener("click", toggleMobileMenu), document.getElementById("mobile-overlay").addEventListener("click", closeMobileMenu), document.getElementById("login-btn")?.addEventListener("click", showLoginModal), document.getElementById("logout-btn")?.addEventListener("click", handleLogout), document.getElementById("login-form")?.addEventListener("submit", function (event) {
    event.preventDefault();
    const trimmed = document.getElementById("login-email").value.trim(),
      trimmed2 = document.getElementById("login-password").value.trim();
    handleLogin(trimmed, trimmed2);
  }), document.getElementById("quick-add-project")?.addEventListener("click", (event) => {
    event && event.preventDefault();
    if (isAuthenticated && coQuyenTaoCongViec()) openModal("project");
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
    if (isAuthenticated && coQuyenTaoCongViec()) openModal("project");
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
  }), document.addEventListener("click", function (event) {
    if (!isAuthenticated) return;
    if (event.target.matches(".add-task-from-project-btn") || event.target.closest(".add-task-from-project-btn")) {
      const target = event.target.matches(".add-task-from-project-btn") ? event.target : event.target.closest(".add-task-from-project-btn"),
        projectId = target.dataset.projectId,
        projectName = target.dataset.projectName;
      isAuthenticated && canUserCreateTask(projectId) ? openTaskModalForProject(projectId, projectName) : showToast("Bạn không có quyền tạo nhiệm vụ", "error");
    }
    if (event.target.matches(".add-subwork-from-work-btn") || event.target.closest(".add-subwork-from-work-btn")) {
      const target = event.target.matches(".add-subwork-from-work-btn") ? event.target : event.target.closest(".add-subwork-from-work-btn"),
        projectId = target.dataset.projectId,
        projectName = target.dataset.projectName;
      event.stopPropagation();
      canUserCreateSubwork(projectId) ? openTaskModalForProject(projectId, projectName, {
        level: 2
      }) : showToast("Bạn không có quyền tạo công việc con", "error");
    }
    if (event.target.matches(".add-task-from-subwork-btn") || event.target.closest(".add-task-from-subwork-btn")) {
      const target = event.target.matches(".add-task-from-subwork-btn") ? event.target : event.target.closest(".add-task-from-subwork-btn"),
        projectId = target.dataset.projectId,
        projectName = target.dataset.projectName,
        parentId = target.dataset.parentId;
      event.stopPropagation();
      canUserCreateTask(projectId) ? openTaskModalForProject(projectId, projectName, {
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
      if (id && !target.disabled) {
        target.disabled = true;
        guiDuyetCaCay(entity, id)
          .catch(() => showToast("Không gửi được công việc. Vui lòng thử lại.", "error"))
          .finally(() => { target.disabled = false; });
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
    if (toggleBtn) {
      doiTrangThaiThuGonTasks(toggleBtn.dataset.khoi || "");
      return;
    }
    // «Xem kết quả» của hàng file mở POPUP nhật ký riêng của file đó (thiết kế lại 2026-09-10),
    // không mở modal nhiệm vụ như bản cũ.
    const tichAn = event.target.closest(".task-files-toggle");
    if (tichAn) {
      doiTrangThaiAnFile(tichAn.dataset.anFile || "");
      return;
    }
    const nutNhatKy = event.target.closest(".task-file-history-btn");
    if (nutNhatKy) moNhatKyFileKetQua(nutNhatKy.dataset.maNhiemVu || "", nutNhatKy.dataset.fileId || "");
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
  filterTaskRows(document.getElementById("tasks-search")?.value.toLowerCase() || "");
}
function filterProjects() {
  filterCards(".project-card", document.getElementById("projects-search")?.value.toLowerCase() || "");
}
function filterTaskRows(searchTerm) {
  document.querySelectorAll("#tasks-grid .glass-card:has(table)").forEach((block) => {
    const groups = new Map();
    block.querySelectorAll("tbody tr[data-task-group]").forEach((row) => {
      const key = row.dataset.taskGroup;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    let visible = false;
    groups.forEach((rows) => {
      const match = rows.some((row) => row.textContent.toLowerCase().includes(searchTerm));
      rows.forEach((row) => {
        // Hàng file của nhiệm vụ đang bị GẬP thì giữ nguyên trạng thái gập: bộ lọc tìm kiếm không
        // được tự mở lại những gì người dùng vừa tích ẩn (thiết kế lại tab Nhiệm vụ 2026-09-10).
        const biAn = !row.classList.contains("task-row-chinh") && tasksAnFile.has(row.dataset.taskGroup);
        row.style.display = match && !biAn ? "" : "none";
      });
      visible ||= match;
    });
    block.style.display = visible ? "" : "none";
  });
}
function showProjectDetailsModal(projectId, projectName) {
  const filteredTasks = allTasks.filter(task => task[COL.T_PID] === projectId),
    filteredTaskCount = filteredTasks.length,
    count = filteredTasks.filter(filteredTask => daDuyetDuKetQua(filteredTask)).length,
    count2 = filteredTasks.filter(filteredTask => !daDuyetDuKetQua(filteredTask)).length,
    count3 = filteredTasks.filter(filteredTask => !daDuyetDuKetQua(filteredTask)).length,
    count4 = filteredTasks.filter(filteredTask => isTaskOverdue(filteredTask[COL.T_DUE]) && !daDuyetDuKetQua(filteredTask)).length,
    num = tienDoDauMucKhach(filteredTasks),
    text = "\n    <div id=\"project-details-modal\" class=\"modal active z-[60]\">\n        <div class=\"modal-content glass-card max-w-7xl w-full mx-0 md:mx-4 h-full md:h-[90vh] flex flex-col p-0 rounded-none md:rounded-2xl\">\n            <!-- Header -->\n            <div class=\"flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex-shrink-0 bg-white z-10 sticky top-0 md:relative\">\n                <h3 class=\"text-lg md:text-xl font-bold text-gray-900 truncate pr-2\">Chi tiết công việc: " + escapeHtml(projectName) + " (" + escapeHtml(projectId) + ")</h3>\n                <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600 p-2\">\n                    <i class=\"fas fa-times text-lg\"></i>\n                </button>\n            </div>\n            \n            <!-- Main Content -->\n            <div class=\"flex-1 overflow-y-auto md:overflow-hidden\">\n                <div class=\"grid grid-cols-1 lg:grid-cols-4 h-auto md:h-full divide-y lg:divide-y-0 lg:divide-x divide-gray-100\">\n                    \n                    <!-- Left Column: Stats -->\n                    <div class=\"p-3 md:p-6 h-auto md:h-full overflow-visible md:overflow-y-auto space-y-4 md:space-y-6 bg-gray-50/50\">\n                        <h4 class=\"font-semibold text-gray-800 hidden md:block\">Tổng quan</h4>\n                        \n                        <!-- Add Task Button (Moved to top) -->\n                        " + createSubworkFromWorkButtonHtml(projectId, projectName, "w-full btn-secondary justify-center py-2 md:py-2.5 text-sm md:text-base mb-2", true) + "\n                        <button onclick=\"openTaskModalFromProject('" + escapeForInlineHandler(projectId) + "', '" + escapeForInlineHandler(projectName) + "')\" class=\"w-full btn-secondary justify-center py-2 md:py-2.5 text-sm md:text-base\">\n                            <i class=\"fas fa-plus mr-2\"></i>Thêm nhiệm vụ\n                        </button>\n\n                        <!-- Stats Grid stacked -->\n                        <div class=\"grid grid-cols-2 lg:grid-cols-1 gap-2 md:gap-4\">\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Tổng nhiệm vụ</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-gray-700 leading-none\">" + escapeHtml(filteredTaskCount) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-list text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Hoàn thành</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-green-600 leading-none\">" + escapeHtml(count) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-check text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Chưa duyệt đủ kết quả</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-blue-600 leading-none\">" + escapeHtml(count2) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-spinner text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                            <div class=\"glass-card p-2 md:p-4 grid grid-cols-[1fr_auto] gap-x-2 items-center h-full\">\n                                <p class=\"text-[10px] md:text-sm text-gray-500 col-span-2 md:col-span-1 md:mb-1\">Quá hạn</p>\n                                <h4 class=\"text-lg md:text-2xl font-bold text-red-600 leading-none\">" + escapeHtml(count4) + "</h4>\n                                <div class=\"w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 col-start-2 row-start-2 md:row-start-1 md:row-span-2 place-self-end\">\n                                    <i class=\"fas fa-exclamation-triangle text-sm md:text-base\"></i>\n                                </div>\n                            </div>\n                        </div>\n\n                        <!-- Progress -->\n                        <div class=\"glass-card p-3 md:p-4\">\n                            <div class=\"flex items-center justify-between mb-2\">\n                                <h4 class=\"font-semibold text-gray-700 text-sm md:text-base\">Tiến độ chung</h4>\n                                <span class=\"text-base md:text-lg font-bold text-blue-600\">" + escapeHtml(num) + "%</span>\n                            </div>\n                            <div class=\"h-2 md:h-3 bg-gray-100 rounded-full overflow-hidden\">\n                                <div class=\"h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                            </div>\n                        </div>\n                    </div>\n\n                    <!-- Right Column: Tasks -->\n                    <div class=\"lg:col-span-3 flex flex-col h-auto md:h-full overflow-visible md:overflow-hidden\">\n                        <div class=\"flex-1 overflow-visible md:overflow-y-auto p-3 md:p-4 custom-scrollbar h-auto md:h-full\">\n                            " + (filteredTaskCount > 0 ? "<div class=\"grid grid-cols-2 md:grid-cols-2 xl:grid-cols-2 gap-2 md:gap-3\">\n                                    " + filteredTasks.map(filteredTask => createTaskListItem(filteredTask, true)).join("") + "\n                                </div>" : "<div class=\"h-40 md:h-full flex flex-col items-center justify-center text-gray-400\">\n                                    <i class=\"fas fa-tasks text-3xl md:text-4xl mb-2 opacity-30\"></i>\n                                    <p class=\"text-sm md:text-base\">Chưa có nhiệm vụ nào</p>\n                                </div>") + "\n                        </div>\n                         <!-- Removed Bottom Actions -->\n                    </div>\n                </div>\n            </div>\n        </div>\n    </div>\n";
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
    taskStatus = nhanHoanThanhKetQua(task),
    taskPriority = task[COL.T_PRIORITY] || "Trung bình",
    dueDateText = formatDateForDisplay(task[COL.T_DUE]),
    num = parseInt(task[COL.T_COMPLETION] || 0),
    isTaskOverdue2 = isTaskOverdue(task[COL.T_DUE]) && !daDuyetDuKetQua(task),
    taskPid = task[COL.T_PID],
    statusClass = getStatusClass(taskStatus),
    priorityClass = getPriorityClass(taskPriority),
    isArray = Array.isArray(task[COL.T_REMINDERS]) && task[COL.T_REMINDERS].length > 0;
  if (isCompact) return "\n            <div class=\"glass-card p-2 md:p-3 hover:shadow-md transition-shadow " + (isTaskOverdue2 ? "border-l-4 border-red-500" : "") + " task-clickable cursor-pointer draggable-item flex flex-col justify-between h-full bg-white border border-gray-100 rounded-xl\" \n                  data-id=\"" + escapeHtml(taskId) + "\" \n                  data-project-id=\"" + escapeHtml(taskPid) + "\"\n                  draggable=\"true\">\n                \n                <div class=\"flex justify-between items-start mb-1.5 md:mb-2 gap-2\">\n                    <h5 class=\"font-semibold text-gray-800 text-xs md:text-sm line-clamp-2 leading-snug flex-1\" title=\"" + escapeHtml(taskName) + "\">\n                        " + (isArray ? "<i class=\"fas fa-bell text-amber-500 mr-1 text-[10px] md:text-xs\"></i>" : "") + escapeHtml(taskName) + "\n                    </h5>\n                    " + (isTaskOverdue2 ? "<i class=\"fas fa-exclamation-circle text-red-500 text-[10px] md:text-xs shrink-0\" title=\"Quá hạn\"></i>" : "") + "\n                </div>\n\n                <div class=\"space-y-1.5 md:space-y-2 mt-auto\">\n                    <!-- Date & User -->\n                    <div class=\"flex items-center justify-between text-[10px] md:text-xs text-gray-500\">\n                        <div class=\"flex items-center gap-1.5 md:gap-2\">\n                             " + "\n                        </div>\n                        <span class=\"" + (isTaskOverdue2 ? "text-red-500 font-medium" : "") + "\">" + escapeHtml(dueDateText) + "</span>\n                    </div>\n\n                    <!-- Status & Priority -->\n                    <div class=\"flex items-center gap-1 md:gap-1.5 flex-wrap\">\n                        <span class=\"status-badge " + escapeHtml(statusClass) + " text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5\">" + escapeHtml(taskStatus) + "</span>" + pendingApprovalBadge(task) + "\n                        <span class=\"status-badge " + escapeHtml(priorityClass) + " text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5\">" + escapeHtml(taskPriority) + "</span>\n                    </div>\n\n                    <!-- Actions & Progress -->\n                    <div class=\"flex items-center justify-between pt-1.5 md:pt-2 border-t border-gray-50 mt-0.5 md:mt-1\">\n                        <div class=\"flex items-center gap-1 text-[10px] md:text-xs text-gray-500 truncate max-w-[50%]\">\n                             <i class=\"fas fa-user-circle text-gray-400\"></i> " + escapeHtml(taskAssignee) + "\n                        </div>\n                        \n                         <div class=\"flex items-center gap-1\">\n                                " + (() => {
    const project = allProjects.find(project3 => project3[COL.P_ID] === task[COL.T_PID]),
      project2 = project && project[COL.P_MANAGER] === currentUser.name,
      isAdmin2 = { copy: canUserCopyResource("task", task[COL.T_ID]), delete: canUserDeleteResource("task", task[COL.T_ID]) };
    return "\n                                    " + createTaskFromSubworkButtonHtml(task, "w-5 h-5 md:w-6 md:h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 flex items-center justify-center p-0") + "\n                                    <button class=\"w-5 h-5 md:w-6 md:h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 action-btn-edit edit-btn flex items-center justify-center p-0\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\"><i class=\"fas fa-edit text-[10px] md:text-xs\"></i></button>\n                                    " + (isAdmin2.delete ? "<button class=\"w-5 h-5 md:w-6 md:h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 action-btn-delete delete-btn flex items-center justify-center p-0\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\"><i class=\"fas fa-trash text-[10px] md:text-xs\"></i></button>" : "") + "\n                                    ";
  })() + "\n                         </div>\n                    </div>\n                    \n                    <!-- Tiny Progress Bar -->\n                     <div class=\"w-full bg-gray-100 h-0.5 md:h-1 rounded-full overflow-hidden\">\n                        <div class=\"h-full " + (daDuyetDuKetQua(task) ? "bg-green-500" : "bg-blue-500") + "\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                     </div>\n                </div>\n            </div>\n            ";
  return "\n    <div class=\"glass-card p-4 hover:shadow-md transition-shadow " + (isTaskOverdue2 ? "border-l-4 border-red-500" : "") + " task-clickable cursor-pointer draggable-item\" \n          data-id=\"" + escapeHtml(taskId) + "\" \n          data-project-id=\"" + escapeHtml(taskPid) + "\"\n          draggable=\"true\">\n        <div class=\"flex items-center justify-between\">\n            <div class=\"flex-1\">\n                <h5 class=\"font-medium text-gray-900\">" + (isArray ? "<i class=\"fas fa-bell text-amber-500 mr-1\" title=\"Có nhắc việc\"></i>" : "") + escapeHtml(taskName) + " <span class=\"text-gray-500 text-xs\">(" + escapeHtml(taskId) + ")</span></h5>\n                \n                <div class=\"flex flex-wrap items-center gap-2 mt-2\">\n                    <span class=\"status-badge " + escapeHtml(statusClass) + "\">" + escapeHtml(taskStatus) + "</span>" + pendingApprovalBadge(task) + "\n                    <span class=\"status-badge " + escapeHtml(priorityClass) + "\">" + escapeHtml(taskPriority) + "</span>\n                    " + (isTaskOverdue2 ? "<span class=\"status-badge status-overdue\">Quá hạn</span>" : "") + "\n                </div>\n            </div>\n            \n            <div class=\"ml-4 flex flex-col items-end\">\n                <div class=\"flex items-center space-x-1 mb-2\">\n                    " + (() => {
    const project = allProjects.find(project3 => project3[COL.P_ID] === task[COL.T_PID]),
      project2 = project && project[COL.P_MANAGER] === currentUser.name,
      isAdmin2 = { copy: canUserCopyResource("task", task[COL.T_ID]), delete: canUserDeleteResource("task", task[COL.T_ID]) };
    return "\n                        " + createTaskFromSubworkButtonHtml(task, "action-btn action-btn-edit") + "\n                        " + (isAdmin2.copy ? "<button class=\"action-btn action-btn-copy copy-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Tạo bản sao\"><i class=\"fas fa-copy\"></i></button>" : "") + "\n                        <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" title=\"Chỉnh sửa\"><i class=\"fas fa-edit\"></i></button>\n                        " + (isAdmin2.delete ? "<button class=\"action-btn action-btn-delete delete-btn\" data-type=\"task\" data-id=\"" + escapeHtml(taskId) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Xóa\"><i class=\"fas fa-trash\"></i></button>" : "") + "\n                      ";
  })() + "\n                </div>\n                <div class=\"flex items-center text-sm text-gray-600 mb-1\">\n                    <i class=\"fas fa-user mr-1\"></i>\n                    <span>" + escapeHtml(taskAssignee) + "</span>\n                </div>\n                <div class=\"flex items-center text-sm text-gray-600\">\n                    <i class=\"fas fa-calendar-alt mr-1\"></i>\n                    <span>" + escapeHtml(dueDateText) + "</span>\n                </div>\n            </div>\n        </div>\n        \n        <div class=\"mt-3\">\n            <div class=\"flex items-center justify-between text-xs text-gray-600 mb-1\">\n                <span>Tiến độ</span>\n                <span>" + escapeHtml(num) + "%</span>\n            </div>\n            <div class=\"h-1.5 bg-gray-200 rounded-full\">\n                <div class=\"h-full " + (daDuyetDuKetQua(task) ? "bg-green-500" : "bg-blue-500") + " rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n            </div>\n        </div>\n    </div>\n";
}
function canUserEditResource(resourceType, resourceId) {
  if (["project", "work", "subwork", "task"].includes(resourceType)) return coQuyenTaiDong("update", resourceType, resourceId);
  if (isAdmin()) return true;
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
  if (["project", "work", "subwork", "task"].includes(resourceType)) return coQuyenTaiDong("delete", resourceType, resourceId);
  if (isAdmin()) return true;
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
    account: "Quản lý tài khoản",
    // 2026-09-02: trang riêng cho hàng chờ phê duyệt (2 tab con).
    "cho-duyet": "Hàng chờ phê duyệt"
  };
  document.getElementById("page-title").textContent = data[sectionName] || "Dashboard", document.querySelectorAll(".section").forEach(item => {
    item.classList.remove("active");
  }), document.getElementById(sectionName + "-section").classList.add("active"), currentSection = sectionName;
  const overviewFilterContainerEl = document.getElementById("overview-filter-container");
  overviewFilterContainerEl && (sectionName === "overview" ? overviewFilterContainerEl.classList.remove("hidden") : overviewFilterContainerEl.classList.add("hidden")), sectionName === "departments" && renderDepartments(), sectionName === "gantt" && setTimeout(() => {
    renderGanttChart();
  }, 10), sectionName === "overview" && typeof napTongQuanTuServer === "function" && napTongQuanTuServer(), sectionName === "projects" && setupProjectsFilterControls(), sectionName === "cho-duyet" && napTrangChoDuyet(), sectionName === "account" && renderTrangTaiKhoan(), closeMobileMenu();
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
function renderStats() {
  const projects = getFilteredProjects(), items = getFilteredTasks();
  const tasks = items.filter((row) => Number(row[COL.T_LEVEL]) === 3);
  const done = tasks.filter(daDuyetDuKetQua).length;
  const overdue = tasks.filter((row) => !daDuyetDuKetQua(row) && isTaskOverdue(row[COL.T_DUE])).length;
  const avg = projects.length ? Math.round(projects.reduce((sum, work) => sum + tienDoDauMucKhach(items.filter((row) => row[COL.T_PID] === work[COL.P_ID])), 0) / projects.length) : 0;
  const data = {"total-projects":projects.length,"completed-projects":projects.filter(daDuyetDuKetQua).length,"project-completion-rate":avg+'%',"total-tasks":tasks.length,"completed-tasks":done,"task-completion-rate":(tasks.length ? Math.round(done*100/tasks.length):0)+'%',"active-tasks":tasks.length-done,"overdue-tasks":overdue,"overdue-total-tasks":tasks.length,"overdue-rate":(tasks.length?Math.round(overdue*100/tasks.length):0)+'%'};
  Object.entries(data).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value;});
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
  hideActionButtons();
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
    projectStatus = nhanHoanThanhKetQua(project),
    startDateText = formatDateForDisplay(project[COL.P_START]),
    endDateText = formatDateForDisplay(project[COL.P_END]),
    statusClass = getStatusClass(projectStatus),
    filteredTasks = allTasks.filter(task => task[COL.T_PID] === projectId),
    num = tienDoDauMucKhach(filteredTasks);
  return "\n    <div class=\"project-card project-clickable cursor-pointer\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\">\n        <div class=\"relative mb-4\">\n          <div class=\"absolute top-0 right-0 flex space-x-1\">\n            " + createSubworkFromWorkButtonHtml(projectId, projectName, "action-btn action-btn-edit") + "\n            <button class=\"action-btn action-btn-edit add-task-from-project-btn\" data-project-id=\"" + escapeHtml(projectId) + "\" data-project-name=\"" + escapeHtml(projectName) + "\" title=\"Thêm nhiệm vụ\">\n              <i class=\"fas fa-plus\"></i>\n            </button>\n            <button class=\"action-btn action-btn-view view-project-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\" title=\"Xem chi tiết\">\n              <i class=\"fas fa-eye\"></i>\n            </button>\n            " + (canUserCopyResource("project", project[COL.P_ID]) ? "\n              <button class=\"action-btn action-btn-copy copy-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\" title=\"Tạo bản sao\">\n                <i class=\"fas fa-copy\"></i>\n              </button>\n            " : "") + "\n            " + (canUserEditResource("project", project[COL.P_ID]) ? "\n              <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" title=\"Chỉnh sửa\">\n                <i class=\"fas fa-edit\"></i>\n              </button>\n            " : "") + "\n            " + (canUserDeleteResource("project", project[COL.P_ID]) ? "\n              <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(projectName) + "\" title=\"Xóa\">\n                <i class=\"fas fa-trash\"></i>\n              </button>\n            " : "") + "\n          </div>\n          \n          <div class=\"pr-24\">\n            <div class=\"mb-3\">\n              <span class=\"status-badge " + escapeHtml(statusClass) + "\">" + escapeHtml(projectStatus) + "</span>" + pendingApprovalBadge(project) + nhapBadge(project) + buildXinXoaBadge(project) + "\n            </div>\n          \n            <h4 class=\"font-semibold text-gray-900 text-md mb-1\"" + (tenCuTheoThang ? " title=\"Tên gốc: " + escapeHtmlAttr(tenCuTheoThang) + "\"" : "") + ">" + escapeHtml(tenTheoThang) + "</h4>\n            <p class=\"text-sm text-gray-600 mb-2\">" + escapeHtml(projectDesc) + "</p>\n          </div>\n        </div>\n        \n        " + (showDetails ? "\n            <div class=\"space-y-2 text-xs text-gray-600\">\n                <div class=\"flex items-center\">\n                    <i class=\"fas fa-calendar-alt w-4 mr-2 text-green-500\"></i>\n                    <span>Bắt đầu: " + escapeHtml(startDateText) + "</span>\n                    \n                    <i class=\"fas fa-calendar-check w-4 mr-2 text-red-500 ml-4\"></i>\n                    <span>Kết thúc: " + escapeHtml(endDateText) + "</span>\n                </div>\n\n                <div class=\"flex items-center justify-between\">\n                  <div class=\"flex items-center\">\n                    <i class=\"fas fa-user-tie w-4 mr-2 text-purple-500\"></i>\n                    <span>Phòng: " + escapeHtml(project[COL.P_DEPT] || "Chưa gán") + "</span>\n                  </div>\n                  <div class=\"flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full\">\n                    <i class=\"fas fa-tasks mr-1\"></i>\n                    <span>" + filteredTasks.length + " nhiệm vụ</span>\n                  </div>\n                </div>\n\n                <div class=\"pt-2 border-t border-gray-100 mt-2\">\n                    <div class=\"flex justify-between mb-1\">\n                        <span class=\"font-medium\">Tiến độ</span>\n                        <span class=\"font-bold text-blue-600\">" + escapeHtml(num) + "%</span>\n                    </div>\n                    <div class=\"w-full bg-gray-200 rounded-full h-1.5\">\n                        <div class=\"bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 rounded-full transition-all duration-500\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                    </div>\n                </div>\n            </div>\n        " : "") + "\n    </div>\n";
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
// Chỉ bổ sung quyền ĐỌC của Quản lý công việc, dùng ID có ngay trong bootstrap.
function quanLyCungPhong(project) {
  const dept = String(currentUser?.department_id ?? "").trim();
  return currentUser?.role === "Quản lý công việc" && dept !== "" &&
    dept === String(project?.[COL.P_DEPT_ID] ?? "").trim();
}
function dsNhiemVuToiDuocThay() {
  return allTasks.filter(t => coQuyenTaiDong("read", "task", t));
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
  }), tasksGridEl.innerHTML = text || "<div class=\"loading-card\">Không có nhiệm vụ nào khớp bộ lọc đã chọn. Chọn «Tất cả tháng» trong ô Tháng hoặc điều chỉnh các bộ lọc để xem nhiệm vụ khác.</div>";
  hideActionButtons();
}
/**
 * Dải phân cách MỎNG của công việc cấp 1 (2026-08-27): chỉ một dòng tiêu đề, không lặp lại thanh
 * công cụ như trước — mọi nhiệm vụ nằm trong các khối công việc con phía dưới.
 */
function createTasksWorkSeparatorHtml(maCongViec, tenCongViec, project, soNhiemVu) {
  const trangThai = project ? nhanHoanThanhKetQua(project) : "",
    nguoiQuanLy = project ? project[COL.P_MANAGER] || "" : "",
    phong = project ? project[COL.P_DEPT] || "" : "",
    // Tên theo tháng đang lọc ở tab Nhiệm vụ; nút «+ Công việc con» phía dưới vẫn nhận TÊN GỐC.
    tenTheoThang = tenTheoThangCuaDong(project, tenCongViec, thangLocNhiemVu()),
    tenCuTheoThang = tenGocNeuDaDoiCuaDong(project, tenCongViec, thangLocNhiemVu());
  return "\n    <div class=\"flex items-center justify-between gap-3 pt-2 pb-1 border-b-2 border-blue-200\">\n      <div class=\"flex items-center gap-2 min-w-0\">\n        <i class=\"fas fa-briefcase text-blue-500\"></i>\n        <span class=\"font-semibold text-gray-900 truncate\"" + (tenCuTheoThang ? " title=\"Tên gốc: " + escapeHtmlAttr(tenCuTheoThang) + "\"" : "") + ">" + escapeHtml(tenTheoThang) + "</span>\n        <span class=\"status-badge " + escapeHtml(getStatusClass(trangThai)) + " text-xs\">" + (escapeHtml(trangThai) || "Chưa duyệt đủ kết quả") + "</span>" + pendingApprovalBadge(project) + nhapBadge(project) + buildXinXoaBadge(project) + "\n      </div>\n      <div class=\"flex items-center gap-3 text-xs text-gray-500 shrink-0\">\n        <span>" + (escapeHtml(nguoiQuanLy) || "Chưa gán") + (phong ? " • " + escapeHtml(phong) : "") + "</span>\n        <span class=\"bg-white px-2 py-1 rounded-full\">" + escapeHtml(soNhiemVu) + " nhiệm vụ</span>\n        " + createSubworkFromWorkButtonHtml(maCongViec, tenCongViec, "bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 text-sm rounded-lg transition-colors duration-200", true) + "\n      </div>\n    </div>\n  ";
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
  const tong = rows.length, xong = rows.filter(daDuyetDuKetQua).length;
  const tre = rows.some((row) => isTaskOverdue(row[COL.T_DUE]) && !daDuyetDuKetQua(row));
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row[COL.T_TY_LE] ?? 1)), 0);
  const weighted = rows.reduce((sum, row) => sum + Math.max(0, Number(row[COL.T_TY_LE] ?? 1)) * (Number(row[COL.T_COMPLETION]) || 0), 0);
  const hoanThanh = tong > 0 && xong === tong;
  return { tong, xong, tienDo: total > 0 ? Math.round(weighted / total) : 0,
    trangThai: hoanThanh ? "Đã duyệt đủ kết quả" : tre ? "Quá hạn · Chưa duyệt đủ kết quả" : "Chưa duyệt đủ kết quả",
    lop: hoanThanh ? "status-completed" : tre ? "status-overdue" : "status-pending" };
}
/**
 * MƯỜI CỘT của bảng nhiệm vụ (thiết kế lại 2026-09-10). Người dùng yêu cầu: tiêu đề cột CĂN
 * GIỮA, cột nào ít chữ (Ưu tiên · Tỷ lệ · Tiến độ · Ngày bắt đầu · Hạn chót · Số bản) thì HẸP
 * lại, phần rộng nhường cho tên nhiệm vụ và tên file. Bề rộng nằm ở app.css (`.tasks-results-table
 * col.*`) vì Tailwind ở đây là BẢN BIÊN DỊCH SẴN (`assets/vendor/tailwind/tailwind.min.css`) —
 * giá trị tuỳ ý kiểu `w-[86px]` không tồn tại, viết vào là class chết không ai báo lỗi.
 *
 * `c-task` để auto: nó ăn phần còn lại sau mười cột kia. Thứ tự MẢNG này là thứ tự cột thật, đổi
 * ở đây thì phải đổi cả `buildTieuDeCotNhiemVu` và hai hàm dựng dòng bên dưới.
 *
 * 2026-09-10 (đợt 4): thêm cột RIÊNG «Tên file» (`c-file`) theo yêu cầu «thêm cột tên file thay vì
 * để tên file bên dưới file kết quả như hiện tại». Ô `c-task` của hàng file nay chỉ còn dấu nối thụt
 * vào ⇒ tên file thẳng hàng dọc ở cột của nó và LÙI VỀ PHẢI so với tên nhiệm vụ.
 */
const COT_BANG_NHIEM_VU = Object.freeze([
  "c-task", "c-file", "c-who", "c-prio", "c-ratio", "c-prog",
  "c-start", "c-due", "c-vers", "c-state", "c-act",
]);
const TIEU_DE_COT_NHIEM_VU = Object.freeze([
  "Nhiệm vụ", "Tên file", "Người thực hiện", "Ưu tiên", "Tỷ lệ (%)", "Tiến độ",
  "Bắt đầu", "Hạn chót", "Số bản", "Tình trạng kết quả", "Thao tác",
]);
function buildColgroupNhiemVu() {
  return "<colgroup>" + COT_BANG_NHIEM_VU.map(c => "<col class=\"" + escapeHtmlAttr(c) + "\">").join("") + "</colgroup>";
}
function buildTieuDeCotNhiemVu() {
  return TIEU_DE_COT_NHIEM_VU.map(t => "<th scope=\"col\">" + escapeHtml(t) + "</th>").join("");
}
/**
 * MÀU CHỮ của tên file kết quả đổi THEO TIẾN ĐỘ (yêu cầu 2026-09-10 đợt 4: «tiến độ 100% thì màu
 * xanh lá cây, dưới 20% là đỏ»). Bốn bậc, lấy đúng hai mốc người dùng nêu làm biên:
 *   ≥ 100 → xanh lá · 50–99 → xanh dương · 20–49 → cam · < 20 → đỏ.
 * Trả về TÊN CLASS có sẵn trong `app.css`, không trả màu thô: giá trị luôn nằm trong bốn chuỗi cố
 * định nên không có dữ liệu người dùng nào lọt vào HTML. Chỗ dùng vẫn bọc `escapeHtmlAttr` cho chặt.
 */
function mauTienDoFile(tienDo) {
  const p = Math.max(0, Math.min(100, Number(tienDo) || 0));
  if (p >= 100) return "td-mau-xanh-la";
  if (p >= 50) return "td-mau-xanh-duong";
  if (p >= 20) return "td-mau-cam";
  return "td-mau-do";
}
/**
 * ẨN/HIỆN hàng file kết quả của TỪNG NHIỆM VỤ — NÚT MŨI TÊN (đợt 4, 2026-09-10: người dùng đòi
 * «đổi lại cái tích … thay bằng nút mũi tên xuống và mũi tên lên để xem mở rộng kết quả và ẩn kết
 * quả»). Mũi tên chỉ HÀNH ĐỘNG: đang gập thì hiện ▼ (bấm để MỞ RỘNG), đang mở thì hiện ▲ (bấm để ẨN).
 * Khoá RIÊNG, không dùng chung `tasksThuGon`: cái kia thu gọn CẢ KHỐI công việc con, cái này
 * chỉ gập các hàng file của một nhiệm vụ. Mặc định là HIỆN; tập chứa mã nhiệm vụ đang bị ẨN.
 */
const TASKS_AN_FILE_KEY = "qlcv_tasks_files_hidden";
let tasksAnFile = docTrangThaiAnFile();
function docTrangThaiAnFile() {
  try {
    const raw = localStorage.getItem(TASKS_AN_FILE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (err) {
    return new Set();
  }
}
function luuTrangThaiAnFile() {
  try {
    localStorage.setItem(TASKS_AN_FILE_KEY, JSON.stringify([...tasksAnFile]));
  } catch (err) {
    /* chế độ riêng tư chặn localStorage — mũi tên vẫn hoạt động, chỉ không nhớ */
  }
}
function doiTrangThaiAnFile(ma) {
  if (!ma) return;
  tasksAnFile.has(ma) ? tasksAnFile.delete(ma) : tasksAnFile.add(ma);
  luuTrangThaiAnFile();
  veLaiHangFileCuaNhiemVu(ma);
}
/**
 * Nút ▼/▲ mở rộng – ẩn hàng file. Vẫn là `<button>` chứ KHÔNG phải checkbox: TC-KQ-UI-03 chốt tab
 * nhiệm vụ không còn checkbox nào sau đợt «bỏ checkbox Hoàn thành». `data-so-file` để hàm cập nhật
 * tại chỗ (`doiNhanNutMoRongFile`) dựng lại được đúng câu title mà không phải đếm lại hàng trong DOM.
 */
function buildNutMoRongFile(ma, soFile, an, tenNhiemVu) {
  const nhan = (an ? "Mở rộng " : "Ẩn ") + soFile + " file kết quả của " + tenNhiemVu;
  return '<button type="button" class="task-files-toggle' + (an ? ' task-files-toggle-an' : '') + '"' +
    ' data-an-file="' + escapeHtmlAttr(ma) + '" data-so-file="' + escapeHtmlAttr(soFile) + '"' +
    ' aria-expanded="' + (an ? 'false' : 'true') + '" title="' + escapeHtmlAttr(nhan) + '"' +
    ' aria-label="' + escapeHtmlAttr(nhan) + '">' +
    '<i class="fas fa-chevron-' + (an ? 'down' : 'up') + '" aria-hidden="true"></i></button>';
}
/** Đổi hướng mũi tên + câu title tại chỗ, KHÔNG vẽ lại bảng (giữ tiêu điểm ô tìm kiếm và chỗ cuộn). */
function doiNhanNutMoRongFile(b, an) {
  const i = b.querySelector("i");
  if (i) {
    i.classList.toggle("fa-chevron-down", an);
    i.classList.toggle("fa-chevron-up", !an);
  }
  const so = b.dataset.soFile || "";
  const nhan = (an ? "Mở rộng " : "Ẩn ") + so + " file kết quả";
  b.title = nhan;
  b.setAttribute("aria-label", nhan);
  b.setAttribute("aria-expanded", an ? "false" : "true");
  b.classList.toggle("task-files-toggle-an", an);
}
/**
 * Lật ẨN/HIỆN cho MỘT nhiệm vụ mà KHÔNG vẽ lại cả tab. Vẽ lại (`renderTasks`) là cách dễ nhất
 * nhưng sai ở đây: nó xoá `innerHTML` của #tasks-grid nên ô tìm kiếm mất tiêu điểm, cuộn trang
 * nhảy về đầu, và hàng `display:none` do `filterTaskRows` đặt cũng mất theo. Việc cần làm chỉ là
 * đổi `display` của vài `<tr>` — nên làm đúng vài `<tr>` đó.
 */
function veLaiHangFileCuaNhiemVu(ma) {
  const an = tasksAnFile.has(String(ma));
  document.querySelectorAll("#tasks-grid tr[data-task-group]").forEach(row => {
    // Chỉ hàng CON (file hoặc dòng «Chưa khai») bị ẩn; hàng nhiệm vụ thì luôn hiện.
    if (row.dataset.taskGroup === String(ma) && !row.classList.contains("task-row-chinh")) {
      row.style.display = an ? "none" : "";
    }
  });
  document.querySelectorAll("#tasks-grid .task-files-toggle").forEach(b => {
    if (b.dataset.anFile === String(ma)) doiNhanNutMoRongFile(b, an);
  });
}
/** Một khối = đầu khối (mũi tên thu gọn + thư mục đỏ + mã + đếm + tổng hợp) và bảng nhiệm vụ. */
function createTasksSubworkBlockHtml(khoi) {
  const tongHop = tinhTongHopNhiemVu(khoi.nhiemVu),
    thuGon = tasksThuGon.has(khoi.khoa),
    // Khối «Nhiệm vụ trực thuộc công việc» là nhãn cố định, không phải một đầu việc ⇒ không đổi tên.
    tenThangKhoi = khoi.truc ? khoi.ten : tenTheoThangCuaDong(khoi.dong, khoi.ten, thangLocNhiemVu()),
    tenCuKhoi = khoi.truc ? "" : tenGocNeuDaDoiCuaDong(khoi.dong, khoi.ten, thangLocNhiemVu()),
    tieuDe = tenThangKhoi;
  return "\n    <div class=\"glass-card\">\n      <div class=\"bg-gradient-to-r from-blue-50 to-purple-50 px-2 py-2 border-b border-gray-100\">\n        <div class=\"flex items-center justify-between gap-3\">\n          <h4 class=\"text-base font-semibold text-gray-900 flex items-center min-w-0\">\n            <button type=\"button\" class=\"tasks-subwork-toggle mr-2 w-6 h-6 rounded hover:bg-gray-200 text-gray-500 flex items-center justify-center shrink-0\" data-khoi=\"" + escapeHtmlAttr(khoi.khoa) + "\" title=\"Thu gọn/Mở rộng\" aria-expanded=\"" + (thuGon ? "false" : "true") + "\"><i class=\"fas fa-chevron-" + (thuGon ? "right" : "down") + "\"></i></button>\n            <i class=\"fas fa-folder" + (thuGon ? "" : "-open") + " text-red-500 mr-2 shrink-0\"></i>\n            <span class=\"truncate\"" + (tenCuKhoi ? " title=\"Tên gốc: " + escapeHtmlAttr(tenCuKhoi) + "\"" : "") + ">" + escapeHtml(tieuDe) + "</span>\n            <span class=\"status-badge " + escapeHtml(tongHop.lop) + " ml-3 text-xs shrink-0\">" + escapeHtml(tongHop.trangThai) + "</span>\n          </h4>\n          <div class=\"flex items-center gap-3 shrink-0\">\n            <span class=\"text-sm text-gray-600 bg-white px-3 py-1 rounded-full\">" + escapeHtml(tongHop.tong) + " nhiệm vụ</span>\n            <div class=\"flex items-center gap-2\">\n              <div class=\"w-24 h-2 bg-gray-200 rounded-full\">\n                <div class=\"h-full bg-blue-500 rounded-full\" style=\"width: " + escapeHtml(tongHop.tienDo) + "%\"></div>\n              </div>\n              <span class=\"text-xs text-gray-600 w-10 text-right\">" + escapeHtml(tongHop.tienDo) + "%</span>\n            </div>\n            <button class=\"bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 text-sm rounded-lg transition-colors duration-200 add-task-from-project-btn\" data-project-id=\"" + escapeHtmlAttr(khoi.maCongViec) + "\" data-project-name=\"" + escapeHtmlAttr(khoi.ten) + "\" title=\"Thêm nhiệm vụ\">\n              + Thêm\n            </button>\n          </div>\n        </div>\n      </div>\n      <div class=\"overflow-x-auto tasks-table-wrap " + (thuGon ? "hidden" : "") + "\">\n        <table class=\"tasks-results-table\">\n          " + buildColgroupNhiemVu() + "\n          <thead>\n            <tr>" + buildTieuDeCotNhiemVu() + "</tr>\n          </thead>\n          <tbody>\n            " + khoi.nhiemVu.map(nhiemVu => createTaskTableRowSimple(nhiemVu)).join("") + "\n          </tbody>\n        </table>\n      </div>\n    </div>\n  ";
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
  const id = task[COL.T_ID] || "N/A", name = task[COL.T_NAME] || "Chưa có tên";
  const title = tenTheoThangCuaDong(task, name, thangLocNhiemVu());
  const original = tenGocNeuDaDoiCuaDong(task, name, thangLocNhiemVu());
  const late = isTaskOverdue(task[COL.T_DUE]) && !daDuyetDuKetQua(task);
  const files = Array.isArray(task.ketQuaFiles) ? task.ketQuaFiles : [];
  // Nhiệm vụ không còn nhóm kết quả nào thì không có gì để ẩn — dọn mã còn sót trong tập. Ca thật:
  // người dùng gập file rồi xoá hết nhóm; để sót thì dòng «Chưa khai file kết quả» bị ẩn vĩnh viễn
  // mà KHÔNG CÒN dấu tích nào để mở lại (dấu tích chỉ vẽ khi có file).
  if (!files.length && tasksAnFile.delete(String(id))) luuTrangThaiAnFile();
  const anFile = tasksAnFile.has(String(id));
  // MỌI ô đi qua một hàm: cùng cỡ chữ, cùng khoảng đệm. «Cùng font chữ» là yêu cầu thiết kế của
  // đợt này nên không để từng ô tự chọn class cỡ chữ như bản cũ (bản cũ trộn text-xs/text-sm).
  const buildTaskCellHtml = (html, cls = "") => '<td class="' + escapeHtmlAttr(cls) + '">' + html + '</td>';
  const pct = (value) => escapeHtml(Math.max(0, Math.min(100, Number(value) || 0))) + '%';
  const open = '<button type="button" class="action-btn action-btn-edit edit-btn" data-type="task" data-id="' + escapeHtmlAttr(id) + '" title="Xem nhiệm vụ và kết quả"><i class="fas fa-edit"></i></button>';
  let actions = open;
  if (canUserCopyResource("task", id)) actions += '<button class="action-btn action-btn-copy copy-btn" data-type="task" data-id="' + escapeHtmlAttr(id) + '" data-name="' + escapeHtmlAttr(name) + '" title="Tạo bản sao"><i class="fas fa-copy"></i></button>';
  if (canUserDeleteResource("task", id)) actions += '<button class="action-btn action-btn-delete delete-btn" data-type="task" data-id="' + escapeHtmlAttr(id) + '" data-name="' + escapeHtmlAttr(name) + '" title="Xóa"><i class="fas fa-trash"></i></button>';
  // NÚT MŨI TÊN ▼/▲ mở rộng – ẩn hàng file (đợt 4 thay cho dấu tích). Vẫn là <button>, KHÔNG phải
  // checkbox: TC-KQ-UI-03 chốt tab nhiệm vụ không còn checkbox nào sau đợt «bỏ checkbox Hoàn thành».
  // `button` bên trong .task-clickable được handler cuối file bỏ qua nên bấm mũi tên KHÔNG mở modal.
  const tich = files.length
    ? buildNutMoRongFile(id, files.length, anFile, title)
    : '<span class="task-files-toggle-off" aria-hidden="true"></span>';
  const soBan = files.reduce((sum, f) => sum + (Number(f.so_ban) || 0), 0);
  let html = '<tr class="task-row-chinh task-clickable cursor-pointer draggable-item ' + (late ? 'bg-red-overdue' : '') + '" draggable="true" data-task-group="' + escapeHtmlAttr(id) + '" data-id="' + escapeHtmlAttr(id) + '" data-project-id="' + escapeHtmlAttr(task[COL.T_PID]) + '">' +
    buildTaskCellHtml('<div class="task-ten-wrap">' + tich + '<div class="task-ten"><span class="task-ten-chinh task-ten-nhiem-vu" title="' + escapeHtmlAttr(original ? 'Tên gốc: ' + original : name) + '">' + (Array.isArray(task[COL.T_REMINDERS]) && task[COL.T_REMINDERS].length ? '<i class="fas fa-bell text-amber-500 mr-1"></i>' : '') + escapeHtml(title) + '</span>' + (files.length ? '<span class="task-so-file">' + escapeHtml(files.length) + ' kết quả</span>' : '') + '<span class="task-nhan ' + (daDuyetDuKetQua(task) ? 'task-nhan-xong' : '') + '">' + escapeHtml(nhanHoanThanhKetQua(task)) + '</span>' + (late ? '<span class="status-badge status-overdue ml-1">Quá hạn</span>' : '') + pendingApprovalBadge(task) + nhapBadge(task) + '</div></div>') +
    // Ô «Tên file» của HÀNG NHIỆM VỤ để trống có chủ đích: tên file nay có CỘT RIÊNG và chỉ hàng
    // file mới có tên. Để trống chứ không lặp tên nhiệm vụ sang đó.
    buildTaskCellHtml('<span class="c-trong">—</span>', 'c-giua') +
    // Người thực hiện CĂN GIỮA ô (yêu cầu đợt 4) — hàng file bên dưới cũng căn giữa cùng cột này.
    buildTaskCellHtml('<span class="task-ten-chinh">' + escapeHtml(task[COL.T_ASSIGNEE] || 'Chưa gán') + '</span>', 'c-giua') +
    buildTaskCellHtml('<span class="status-badge ' + escapeHtmlAttr(getPriorityClass(task[COL.T_PRIORITY] || 'Trung bình')) + '">' + escapeHtml(task[COL.T_PRIORITY] || 'Trung bình') + '</span>', 'c-giua') +
    buildTaskCellHtml(pct(task[COL.T_TY_LE]), 'c-giua') + buildTaskCellHtml(pct(task[COL.T_COMPLETION]), 'c-giua') +
    buildTaskCellHtml(escapeHtml(formatDateForDisplay(task[COL.T_START])), 'c-giua') + buildTaskCellHtml(escapeHtml(formatDateForDisplay(task[COL.T_DUE])), 'c-giua') +
    buildTaskCellHtml(files.length ? escapeHtml(soBan) : '<span class="c-trong">—</span>', 'c-giua') +
    buildTaskCellHtml('<span class="task-nhan ' + (daDuyetDuKetQua(task) ? 'task-nhan-xong' : '') + '">' + escapeHtml(nhanHoanThanhKetQua(task)) + '</span>') +
    buildTaskCellHtml('<div class="task-hanh-dong">' + actions + '</div>') + '</tr>';
  if (!files.length) return html + '<tr data-task-group="' + escapeHtmlAttr(id) + '" data-task-files-empty="1"><td colspan="' + COT_BANG_NHIEM_VU.length + '" class="task-chua-co-file">Chưa khai file kết quả</td></tr>';
  html += files.map((file) => {
    // ĐỢT 5 (2026-09-11) — «KẾT QUẢ LÀM ĐƯỢC» ≠ «TÊN FILE». `ten_ket_qua` là TÊN KHAI người dùng điền
    // ở ô ＋ (migration 016), còn `ten_ban_cuoi` mới là tên file vật lý đã nộp. Đợt 4 dồn cả hai vào
    // cột «Tên file» nên tiêu đề cột nói một đằng, nội dung một nẻo. Người dùng: «Kết quả làm được sẽ
    // chuyển sang cùng cột Nhiệm vụ, bên cạnh icon tệp giấy gấp góc bên phải đang có đấy».
    const tenKetQua = String(file.ten_ket_qua || file.ten_goc || 'Chưa đặt tên kết quả');
    const tenFileThat = file.co_ban ? String(file.ten_ban_cuoi || file.dinh_dang || '') : '';
    const trangThai = file.co_ban ? (NHAN_TRANG_THAI_FILE[file.trang_thai] || file.trang_thai) : 'Chưa nộp';
    const mau = file.co_ban ? (MAU_TRANG_THAI_FILE[file.trang_thai] || '') : 'bg-gray-100 text-gray-500';
    const tienDo = Math.max(0, Math.min(100, Number(file.tienDo) || 0));
    return '<tr class="task-result-row" data-task-group="' + escapeHtmlAttr(id) + '" data-task-result="' + escapeHtmlAttr(file.id) + '"' + (anFile ? ' style="display:none"' : '') + '>' +
      // Ô ĐẦU của hàng file: DẤU NỐI thụt vào + icon tệp giấy + «KẾT QUẢ LÀM ĐƯỢC». Vẫn thụt phải hơn
      // tên nhiệm vụ nên nhìn là biết dòng này thuộc nhiệm vụ ngay trên nó. MÀU CHỮ THEO TIẾN ĐỘ giữ
      // nguyên từ đợt 4: 100% xanh lá · 50–99 xanh dương · 20–49 cam · <20 đỏ.
      buildTaskCellHtml('<div class="task-file-lui"><span class="task-file-noi" aria-hidden="true">└</span>' +
        '<i class="fas fa-file-lines task-file-icon" aria-hidden="true"></i>' +
        '<span class="task-file-name ' + escapeHtmlAttr(mauTienDoFile(tienDo)) + '" title="' + escapeHtmlAttr(tenKetQua) + '">' + escapeHtml(tenKetQua) + '</span></div>') +
      // Ô «TÊN FILE» nay ĐÚNG NGHĨA: tên file vật lý của bản cuối. Cột c-file cố định + table-layout:fixed
      // nên mọi hàng rộng bằng nhau, dài thì cắt «…», di chuột ra tên đầy đủ. Chữ MÀU TRUNG TÍNH — màu
      // theo tiến độ đã nằm ở «Kết quả làm được» bên cột Nhiệm vụ, tô cả hai chỗ là rối mắt.
      buildTaskCellHtml(tenFileThat
        ? '<span class="task-file-ten-that" title="' + escapeHtmlAttr(tenFileThat) + '">' + escapeHtml(tenFileThat) + '</span>'
        : '<span class="task-file-phu">Chưa có bản</span>') +
      // Người nộp bản cuối — CĂN GIỮA cùng cột với người thực hiện của hàng nhiệm vụ.
      buildTaskCellHtml('<span class="task-file-phu">' + escapeHtml(file.ten_nguoi_nop || '—') + '</span>', 'c-giua') +
      buildTaskCellHtml('<span class="c-trong">—</span>', 'c-giua') +
      buildTaskCellHtml(pct(file.ty_le), 'c-giua') + buildTaskCellHtml(pct(tienDo), 'c-giua') +
      buildTaskCellHtml('<span class="c-trong">—</span>', 'c-giua') + buildTaskCellHtml('<span class="c-trong">—</span>', 'c-giua') +
      buildTaskCellHtml(escapeHtml(Number(file.so_ban) || 0), 'c-giua') +
      buildTaskCellHtml('<span class="status-badge ' + escapeHtmlAttr(mau) + '">' + escapeHtml(trangThai) + '</span>') +
      // Nút mở POPUP nhật ký riêng của file. KHÔNG mang class `edit-btn`: class đó có handler toàn
      // cục mở modal nhiệm vụ, giữ lại là một cú bấm nổ hai nơi.
      buildTaskCellHtml('<button type="button" class="task-file-history-btn" data-ma-nhiem-vu="' + escapeHtmlAttr(id) + '" data-file-id="' + escapeHtmlAttr(file.id) + '" title="Xem nhật ký kết quả này theo thời gian">Xem kết quả</button>') + '</tr>';
  }).join('');
  return html;
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
      const taskStatus = nhanHoanThanhKetQua(filteredTask);
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
// Bug 2 (8b): tiến độ dự án phía client — BẢN SOI của `server/src/modules/workItems/tienDo.js`
// (`tienDoWork`): bình quân GIA QUYỀN «Tỷ lệ công việc (%)» × «Tiến độ (%)» (server gắn sẵn từ mức
// hoàn thành các nhóm file kết quả) trên các ĐẦU MỤC (cấp 2, hoặc cấp 3 không nằm trong công việc
// con). Đầu mục tỷ lệ 0 không vào mẫu; không đầu mục nào có tỷ lệ → 0%. Chỉ dùng cho biểu đồ
// fallback + hộp thoại chi tiết khi không gọi API thống kê; hàm THUẦN để test jsdom soi được và
// đồng dạng công thức với stats-parity.test.js. project-details.js (nạp sau) cũng gọi hàm này.
function tienDoDauMucKhach(rows) {
  let tu = 0,
    mau = 0;
  for (const row of rows || []) {
    const cap = Number(row[COL.T_LEVEL]);
    if (!(cap === 2 || cap === 3 && !row[COL.T_PARENT])) continue;
    const tyLe = Math.max(0, Number(row[COL.T_TY_LE]) || 0);
    if (tyLe <= 0) continue;
    mau += tyLe;
    tu += tyLe * Math.max(0, Number(row[COL.T_COMPLETION]) || 0);
  }
  return mau > 0 ? Math.round(tu / mau) : 0;
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
      // Bug 2 (8b): số cũ là % nhiệm vụ «Hoàn thành» — nay theo đúng server (tienDo.js): bình quân
      // gia quyền tiến độ các đầu mục, không còn chỗ nào nhân viên nhập tay.
      num = tienDoDauMucKhach(filteredFilteredTasks),
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
      filteredFilteredFilteredTasks = filteredFilteredTasks.filter(filteredFilteredTask => daDuyetDuKetQua(filteredFilteredTask)),
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
  // Mở form từ TRONG modal chi tiết công việc ⇒ ghi nhớ để `closeModal` vẽ lại modal đó (kèm dòng
  // vừa tạo). Không phụ thuộc nút nào gọi: hễ modal chi tiết đang mở thì đường về là nó.
  if (document.getElementById("project-details-modal")) {
    openedFromProjectDetails = { projectId: String(projectId || ""), projectName: String(projectName || "") };
  }
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
    el5.addEventListener("submit", function (event) {
      event.preventDefault();
      const luuNhap = Boolean(event.submitter && event.submitter.hasAttribute("data-nhap")),
        guiDuyet = Boolean(event.submitter && event.submitter.hasAttribute("data-gui-duyet"));
      flag ? handleEdit(type, data) : handleAdd(type, { luuNhap, guiDuyet });
    });
  }
  if (typeof ganTienIchForm8b === "function") ganTienIchForm8b(type, data, el5);
  const closeButtons = el4.querySelectorAll(".close-modal");
  closeButtons.forEach(closeButton => {
    closeButton.addEventListener("click", event => {
      event.preventDefault(), closeModal(text);
    });
  });
}
/**
 * VẼ LẠI modal chi tiết công việc sau khi vừa ghi (tạo/sửa công việc con hoặc nhiệm vụ).
 *
 * Người dùng báo 2026-09-02: «khi tạo mới công việc, công việc con đang ko cập nhật trực tiếp hiển
 * thị trên công việc cha mà phải tắt đi mở lại mới thấy». Nguyên nhân: `showProjectDetailsModal`
 * đọc `allTasks` trong bộ nhớ, còn dòng mới chỉ về sau `refreshData()` (đặt hẹn 1 giây trong
 * `handleAdd`) ⇒ modal vẽ lại từ dữ liệu CŨ, thiếu đúng dòng vừa tạo.
 *
 * Nay gọi `refreshData()` trước và vẽ trong `withSuccessHandler` của chính lượt nạp đó —
 * `handleSuccessfulLogin` đã gán xong `allProjects`/`allTasks` trước khi mình vẽ. Lỗi mạng thì vẫn
 * vẽ từ dữ liệu đang có (thà thiếu một dòng còn hơn mất luôn modal).
 */
async function veLaiChiTietSauKhiGhi(projectId, projectName) {
  if (!isAuthenticated) return;
  if (await refreshData()) showProjectDetailsModal(projectId, projectName);
}
function openEditModal(type, id) {
  if (["project", "task"].includes(type) && typeof moSuaMoiNhat8b === "function") return moSuaMoiNhat8b(type, id);
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
  if (el?.querySelector('form[data-dang-luu="1"]')) return;
  if (modalId === "project-details-modal") cheDoDuyetChiDoc = false;
  el && (el.classList.contains("modal-overlay") && el.classList.add("closing"), el.classList.remove("active"), setTimeout(() => {
    el.parentNode && el.remove();
    if (modalId === "task-modal" && openedFromProjectDetails) {
      const {
        projectId: openedFromProjectDetails2,
        projectName: openedFromProjectDetails3
      } = openedFromProjectDetails;
      openedFromProjectDetails = null;
      veLaiChiTietSauKhiGhi(openedFromProjectDetails2, openedFromProjectDetails3);
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
  name: "Tên", description: "Mô tả", status: "Trạng thái cũ (lịch sử)", priority: "Ưu tiên",
  manager_id: "Người quản lý", manager_name: "Người quản lý",
  // Đợt A (028): cột đổi thành `supervisor_ids`. Giữ cả khoá cũ vì dòng nhật ký ghi TRƯỚC 028 vẫn
  // mang tên cột cũ — bỏ đi là những dòng đó hiện ra `supervisor_id` thô cho người đọc.
  department_id: "Phòng", supervisor_ids: "Ban lãnh đạo kiểm soát",
  supervisor_id: "Ban lãnh đạo kiểm soát",
  leader_ids: "Lãnh đạo phòng phụ trách",
  assignee_id: "Người thực hiện trực tiếp", assignee_name: "Người thực hiện trực tiếp",
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
// ============================================================================
// KẾT QUẢ NHIỆM VỤ LÀ FILE (014, 2026-09-01) — tab «Kết quả & Luồng» trong modal NHIỆM VỤ.
//
// Luồng người dùng chốt: Cán bộ nộp → TP/PP xem + góp ý → Yêu cầu sửa (nộp bản mới, lặp) /
// Trình Phó GĐ–GĐ / Hoàn thành luôn → PGD/GĐ Duyệt (chốt, khóa upload) hoặc Trả về TP/PP
// (TP/PP nộp bản mình về «Chờ lãnh đạo» hoặc đẩy về Cán bộ, lặp lại).
//
// LUỒNG KHÔNG CÓ LUẬT CỨNG TRONG FILE NÀY: mỗi «cửa» đọc giá trị hiệu lực từ
// GET /api/v1/permissions (ma trận + ghi đè 009/010/011/014) — giaTriHieuLucFile ở dưới khớp
// từng chữ với giaTriHieuLuc phía máy chủ:
//   ✓ cho-phep  = cửa đó bị BỎ QUA (nộp xong là «Tự động — phân quyền không yêu cầu duyệt»)
//   ⏳ cho-duyet = phải qua duyệt (TP/PP đặt ⏳ ở «Duyệt kết quả» ⇒ MẤT nút «Hoàn thành / Duyệt»)
//   ✕ tu-choi   = vai đó không làm được
// Nút ẩn/hiện chỉ để cho đẹp — MÁY CHỦ LÀ RÀO CHẶN CUỐI. PDF xem bằng iframe trình duyệt
// (?inline=1); DOCX tải về + góp ý trong app. Editor trực tuyến: docs/KE-HOACH-KET-QUA-FILE.md §7.
// ============================================================================
const NHAN_TRANG_THAI_FILE = Object.freeze({
  "luu-tam": "Lưu tạm",
  "cho-xem": "Chờ TP/PP xem",
  "can-sua": "Cần sửa — nộp bản mới",
  "cho-lanh-dao": "Chờ Phó GĐ/Giám đốc",
  "hoan-thanh": "Hoàn thành",
  "da-duyet": "Đã duyệt",
});
const MAU_TRANG_THAI_FILE = Object.freeze({
  "luu-tam": "bg-slate-100 text-slate-600",
  "cho-xem": "bg-yellow-100 text-yellow-700",
  "can-sua": "bg-red-100 text-red-600",
  "cho-lanh-dao": "bg-purple-100 text-purple-700",
  "hoan-thanh": "bg-green-100 text-green-700",
  "da-duyet": "bg-green-800 text-white",
});
// ĐỢT B (11/09/2026) — ĐIỂM 9 gộp «Yêu cầu sửa» vào «Trả về Cán bộ», ĐIỂM 7 đổi «Trình lãnh đạo»
// thành «TP/PP phê duyệt» (một LẦN KÝ có lưu người và lúc ký, không chỉ đổi trạng thái). Hai mã cũ
// không còn tồn tại: migration 029 đã viết lại toàn bộ lịch sử nên không cần nhãn cho chúng.
// «Phê duyệt tự động» GIỮ LẠI — R6 bỏ quyền tự duyệt nhưng các dòng lịch sử `duyet-tu-dong` vẫn còn
// trong CSDL và phải đọc được.
const NHAN_LUONG_FILE = Object.freeze({
  "luu-tam": "Lưu tạm",
  "gui-duyet": "Gửi đi duyệt",
  nop: "Nộp bản",
  "gom-y": "Góp ý",
  "sua-truc-tuyen": "Sửa trực tuyến",
  "tp-phe-duyet": "TP/PP phê duyệt",
  "tra-ve-tp": "Trả về TP/PP",
  "tra-ve-cbo": "Trả về Cán bộ",
  "huy-lenh-sua": "Hủy lệnh sửa",
  "duyet-tu-dong": "Phê duyệt tự động",
  duyet: "Duyệt",
  "hoan-thanh": "Hoàn thành",
});
// 12/09/2026 — ba bảng nhãn cho HAI CỘT THEO TỪNG BẢN của bảng «Kết quả» («Tình trạng» và «Người
// thực hiện»). Trước đây cột «Tình trạng» của dòng bản 1.1/1.2 để TRỐNG và cột «Người thực hiện» in
// cứng tên người nộp, nên đọc bảng không biết bản nào bị trả về, ai trả, ai sửa.
/**
 * Vai viết tắt. Bảng mười cột đã hẹp, in đủ «Trưởng phòng» là đẩy cột «Hành động» xuống dòng.
 * `admin` = Giám đốc (Q8 — không thêm vai mới), «Nhân viên» hiển thị là «Cán bộ» như `hienThiVai`.
 */
const NHAN_VAI_NGAN = Object.freeze({
  "Trưởng phòng": "TP/PP",
  "Phó phòng": "TP/PP",
  "Phó Giám đốc": "PGĐ",
  admin: "GĐ",
  "Nhân viên": "Cán bộ",
});
/**
 * Hành động SINH RA một bản. Dòng luồng ghi lúc bản ra đời mang đúng `vai` của người tạo nên đọc nó
 * là biết vai, khỏi thêm cột vào `BAN` (hằng dùng chung, thêm cột là đổi hình dạng phản hồi).
 */
const HANH_DONG_TAO_BAN = Object.freeze(["sua-truc-tuyen", "nop", "luu-tam", "gui-duyet"]);
/**
 * Hành động là MỘT TÌNH TRẠNG của bản. `vai: true` ⇒ nhãn ghép vai của người làm (`sua-truc-tuyen`
 * phải ra «TP/PP sửa trực tiếp» hay «PGĐ/GĐ sửa trực tiếp» đúng như người dùng dặn). `gom-y` cố ý
 * KHÔNG có mặt: góp ý là ý kiến bên lề, đã có cột «Ghi ý kiến» đếm, để nó vào đây là một câu góp ý
 * đến sau che mất «Bị trả về».
 */
const TINH_TRANG_BAN = Object.freeze({
  "tra-ve-cbo": { nhan: "Bị trả về", mau: "bg-red-100 text-red-700" },
  "tra-ve-tp": { nhan: "Bị trả về TP/PP", mau: "bg-red-100 text-red-700" },
  "sua-truc-tuyen": { nhan: "sửa trực tiếp", vai: true, mau: "bg-amber-100 text-amber-700" },
  "tp-phe-duyet": { nhan: "phê duyệt", vai: true, mau: "bg-purple-100 text-purple-700" },
  duyet: { nhan: "đã duyệt", vai: true, mau: "bg-green-100 text-green-700" },
  "hoan-thanh": { nhan: "chốt hoàn thành", vai: true, mau: "bg-green-100 text-green-700" },
  "huy-lenh-sua": { nhan: "Hủy lệnh sửa", mau: "bg-slate-100 text-slate-600" },
});
const NHAN_VERDICT_FILE = Object.freeze({
  "tp-phe-duyet": "TP/PP phê duyệt",
  "tra-ve-cbo": "Đẩy về Cán bộ",
  "hoan-thanh": "Hoàn thành",
  "tra-ve-tp": "Trả về TP/PP",
  duyet: "Duyệt",
});
/**
 * Hai hành động CHỐT (kết thúc luồng của file) — đối trọng của `tp-phe-duyet` là TRÌNH lên.
 * Q6/Q11: cả hai nhận GHI CHÚ TUỲ CHỌN lấy từ ô «Ý kiến», và chỉ MỘT trong hai hiện ra cho TP/PP
 * tùy `phaiTrinhLanhDao` của máy chủ (tích «Gửi BLĐ phê duyệt» · người bấm là người thực hiện ·
 * admin đặt ⏳ ở «Duyệt kết quả»). Nhãn nút thật đến từ `nhan` máy chủ trả; bảng này chỉ để viết câu
 * toast «Đã hoàn thành» cho xuôi.
 */
const HANH_DONG_CHOT = Object.freeze(["hoan-thanh", "duyet"]);
/**
 * ĐỊNH DẠNG kết quả — nhãn suy từ ĐUÔI file. Từ đợt 2 (016) người dùng KHAI định dạng lúc thêm dòng
 * (`nhom.dinh_dang`) nên bảng này chỉ còn là đường lùi cho dòng cũ và cho tên bản; «Báo cáo» không
 * có đuôi nào vì nó là chữ nhập thẳng, xem `DINH_DANG_KHAI`.
 */
const NHAN_DINH_DANG = Object.freeze({
  ".doc": "Word", ".docx": "Word", ".pdf": "PDF",
  ".xls": "Excel", ".xlsx": "Excel", ".ppt": "PPT", ".pptx": "PPT",
  ".jpg": "Ảnh", ".jpeg": "Ảnh", ".png": "Ảnh", ".gif": "Ảnh", ".webp": "Ảnh",
});
/** Nhãn định dạng của MỘT tên file; không nhận ra đuôi thì trả "—" chứ không đoán bừa. */
function dinhDangCuaTen(ten) {
  const khop = String(ten || "").match(/\.[a-z0-9]+$/i);
  return (khop && NHAN_DINH_DANG[khop[0].toLowerCase()]) || "—";
}
/**
 * ICON của từng định dạng (người dùng chốt 2026-09-04: «ghi kèm icon định dạng file»). Đuôi lạ thì
 * dùng biểu tượng tệp chung — thà nhạt nhoà còn hơn gán sai loại.
 */
const ICON_DINH_DANG = Object.freeze({
  Word: "fa-file-word text-blue-600",
  Excel: "fa-file-excel text-green-600",
  PPT: "fa-file-powerpoint text-orange-600",
  PDF: "fa-file-pdf text-red-600",
  "Ảnh": "fa-file-image text-purple-600",
  "Báo cáo": "fa-file-lines text-slate-600",
});
/**
 * ĐỊNH DẠNG người dùng KHAI được ở nút ＋ (016) — khớp `DINH_DANG_KHAI` của máy chủ và CHECK
 * `tf_dinh_dang_ok` của CSDL. «Báo cáo» là loại duy nhất KHÔNG cần file: nội dung nhập thẳng.
 */
const DINH_DANG_KHAI = Object.freeze(["Word", "Excel", "PPT", "PDF", "Ảnh", "Báo cáo"]);
const DINH_DANG_BAO_CAO = "Báo cáo";
/**
 * ĐỊNH DẠNG hiển thị của MỘT dòng kết quả: ưu tiên cột `dinh_dang` người dùng đã khai (016), không
 * có thì suy từ đuôi tên file của bản mới nhất như đợt 1 — dòng cũ trước 016 không mất chữ.
 */
function dinhDangCuaNhom(n) {
  const khai = n && n.dinh_dang;
  if (khai) return String(khai);
  const bans = Array.isArray(n && n.bans) ? n.bans : [];
  const banCuoi = bans.length > 0 ? bans[bans.length - 1] : null;
  return dinhDangCuaTen((banCuoi && banCuoi.ten_goc) || (n && n.ten_goc));
}
/** Dòng này là «Báo cáo» (nhập chữ, không có file) — máy chủ trả cờ `laBaoCao` ở cả hai đường. */
function laDongBaoCao(n) {
  return Boolean(n && (n.laBaoCao === true || n.dinh_dang === DINH_DANG_BAO_CAO));
}
/**
 * MỘT BẢN là bản «Báo cáo» hay không — nhận theo DỮ LIỆU của chính bản (016: bản chữ có `noi_dung`
 * và `ten_luu` NULL), không theo định dạng khai của nhóm: một nhóm có thể có cả bản file lẫn bản
 * chữ nếu người dùng đổi cách nộp giữa đường, và mỗi dòng bản phải hiện đúng thứ nó là.
 */
function laBanBaoCaoKq(b) {
  return Boolean(b && b.noi_dung != null && b.ten_luu == null);
}
/**
 * Ô NHẬP «Báo cáo» ngay trong cột «Hành động» của dòng cha — người dùng chốt: «Báo cáo» là kết quả
 * nhập CHỮ, lưu như một BẢN không có file. Nộp là thành bản mới, đi đúng luồng nộp → góp ý → duyệt.
 */
function buildONhapBaoCao(n, ma) {
  const bans = Array.isArray(n.bans) ? n.bans : [];
  return (
    "<div class=\"mt-2 text-left\">" +
    "<label class=\"text-xs font-semibold text-gray-500\" for=\"task-kq-bc-" + escapeHtmlAttr(n.id) + "\">" +
    escapeHtml(bans.length > 0 ? "Nội dung bản mới" : "Nội dung báo cáo") + "</label>" +
    "<textarea id=\"task-kq-bc-" + escapeHtmlAttr(n.id) + "\" rows=\"3\" maxlength=\"20000\" " +
    "class=\"form-input w-full text-sm mt-1\" placeholder=\"Nhập nội dung (tối thiểu 10 ký tự)…\"></textarea>" +
    "<button type=\"button\" class=\"btn-secondary py-1 px-3 text-xs mt-1\" onclick=\"guiBaoCaoKetQua('" +
    escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(ma) + "')\">" +
    escapeHtml(bans.length > 0 ? "Nộp bản mới" : "Nộp báo cáo") + "</button>" +
    "</div>"
  );
}
/** Icon định dạng kèm title + aria-label — mất icon (font chưa tải) vẫn còn CHỮ để đọc. */
function buildIconDinhDang(ten) {
  const nhan = DINH_DANG_KHAI.includes(String(ten || "")) ? String(ten) : dinhDangCuaTen(ten);
  const icon = ICON_DINH_DANG[nhan] || "fa-file text-gray-400";
  return (
    "<i class=\"fas " + escapeHtmlAttr(icon) + " mr-2\" role=\"img\" title=\"" +
    escapeHtmlAttr(nhan) + "\" aria-label=\"" + escapeHtmlAttr(nhan) + "\"></i>"
  );
}
/**
 * CÂU KỂ tình trạng (thiết kế mới, sheet «kq-modal» cột «Tình trạng»): người dùng muốn đọc được
 * «đang đợi ai, đã qua tay ai, bị trả lại mấy lần» chứ không phải một nhãn ngắn. Sinh từ
 * `trang_thai` + ĐẾM số lần trả lại trong bảng luồng — KHÔNG cần trường mới nào của máy chủ.
 */
function cauTinhTrangFile(n) {
  const luong = Array.isArray(n && n.luong) ? n.luong : [];
  // ĐIỂM 9 (ĐỢT B): «Yêu cầu sửa» đã gộp vào «Trả về Cán bộ» nên chỉ còn HAI mã trả lại.
  const soTraLai = Number.isFinite(Number(n?.soTraLai)) ? Number(n.soTraLai) :
    luong.filter((g) => ["tra-ve-tp", "tra-ve-cbo"].includes(g.hanh_dong)).length;
  const nguoiNhan = Array.isArray(n?.nguoiNhan) ? n.nguoiNhan.filter(Boolean).join(" và ") :
    String(n?.tenNguoiNhan || n?.ten_nguoi_nhan || "").trim();
  const doiTuongSua = nguoiNhan || (n?.lenh_sua_cho === "lanh-dao" ? "Trưởng phòng/Phó phòng" : "Cán bộ");
  // ĐIỂM 7 (ĐỢT B): mốc «TP/PP phê duyệt» nay là HAI CỘT thật của máy chủ (`tp_duyet_boi` +
  // `ten_nguoi_tp_duyet`), không còn phải suy ra từ bảng luồng — kể được AI đã ký. Dòng lịch sử cũ
  // chưa có mốc thì lùi về đếm mã `tp-phe-duyet` trong luồng (029 đã đổi tên toàn bộ dòng cũ).
  // Ba tên trường vì BA đường đọc trả ba dạng: `ten_nguoi_tp_duyet` (GET …/files, hàng chờ duyệt),
  // `tp_duyet_ten` (bản đồ gọn của tab Nhiệm vụ) và `tenNguoiTpDuyet` (nếu cầu RPC đổi sang camel).
  const tenTpDuyet = String(n?.ten_nguoi_tp_duyet || n?.tp_duyet_ten || n?.tenNguoiTpDuyet || "").trim();
  // LÚC ký cũng là dữ liệu máy chủ (`tp_duyet_luc`) — «ai duyệt» mà không có «lúc nào» thì mốc này
  // vẫn chưa trả lời được câu hỏi mà điểm bất hợp lý số 7 đặt ra.
  const lucTpDuyet = n?.tp_duyet_luc ? formatDateForDisplay(n.tp_duyet_luc, true) : "";
  const daTrinh = tenTpDuyet !== "" || lucTpDuyet !== "" || luong.some((g) => g.hanh_dong === "tp-phe-duyet");
  const dauCau = soTraLai > 0 ? "Bị trả lại lần " + soTraLai + " — " : "";
  const cau = {
    "luu-tam": "đã lưu tạm — chưa gửi đi duyệt",
    "cho-xem": "đang đợi Trưởng phòng/Phó phòng duyệt",
    "can-sua": "đang đợi " + doiTuongSua + " sửa và nộp bản mới",
    "cho-lanh-dao": daTrinh
      ? (tenTpDuyet
        ? "đã được " + tenTpDuyet + " (TP/PP) phê duyệt" + (lucTpDuyet ? " lúc " + lucTpDuyet : "") +
          ", đang chờ Phó Giám đốc/Giám đốc"
        : "TP/PP đã duyệt" + (lucTpDuyet ? " lúc " + lucTpDuyet : "") + ", đang gửi lên Phó Giám đốc/Giám đốc")
      : "đang đợi Phó Giám đốc/Giám đốc",
    "hoan-thanh": "Trưởng phòng/Phó phòng đã chốt Hoàn thành",
    "da-duyet": "Phó Giám đốc/Giám đốc đã duyệt — kết quả đã chốt",
  }[n && n.trang_thai];
  if (!cau) return NHAN_TRANG_THAI_FILE[n && n.trang_thai] || String((n && n.trang_thai) || "");
  return dauCau + cau;
}
/** Câu kể cho dòng của trang «Hàng chờ phê duyệt» — ở đó máy chủ KHÔNG trả bảng luồng. */
function cauTinhTrangHangCho(n) {
  return cauTinhTrangFile({ ...n, luong: [], soTraLai: n?.soTraLai });
}
// Ma trận + ghi đè nạp từ GET /api/v1/permissions (khuôn oPhanQuyenHieuLuc) — nạp lại MỖI lần mở
// tab nên admin đổi bảng là người dùng thấy hành vi đổi NGAY cho lần nộp/duyệt tiếp theo.
let phanQuyenFile = { macDinh: null, ghiDe: {} };
// Phase8b: một cache quyền cho tab/nút, biểu mẫu và kết quả; nguồn là GET /permissions.
let lanHoiQuyen = null, henHoiQuyen = null, daGanHoiQuyen = false, phamViQuyen = null;
function giaTriMacDinhQuyen(macDinh, vai, entity, action) {
  if (!macDinh?.[vai]?.[entity]?.includes(action)) return "tu-choi";
  if (entity === "file" && action === "create" && !["admin", "Phó Giám đốc"].includes(vai)) return "cho-duyet";
  if (action === "create" && ["work", "subwork"].includes(entity) && !["admin", "Phó Giám đốc"].includes(vai)) return "cho-duyet";
  if (entity === "subwork" && action === "update" && ["Trưởng phòng", "Phó phòng"].includes(vai)) return "cho-duyet";
  return "cho-phep";
}
function giaTriHieuLucQuyen(vai, entity, action, bang = phanQuyenFile) {
  if (vai === "admin") return "cho-phep";
  if (!bang.macDinh?.[vai]) return "tu-choi";
  const gd = bang.ghiDe?.[entity + ":" + action]?.[vai];
  return gd?.gia_tri || giaTriMacDinhQuyen(bang.macDinh, vai, entity, action);
}
function capNhatBangQuyen(data) {
  phanQuyenFile = { macDinh: data?.macDinh || null, ghiDe: chiSoGhiDe(data?.ghiDe), settings: data?.settings || null };
  if (data?.phamVi) phamViQuyen = data.phamVi;
  capNhatLuaChonGuiBld();
}
function cungIdQuyen(a, b) {
  return a != null && b != null && String(a) !== "" && String(b) !== "" && String(a) === String(b);
}
function dongPhamViQuyen(type, resource) {
  const laWork = type === "project" || type === "work";
  const row = typeof resource === "object" ? resource : (laWork ? allProjects : allTasks)
    .find(r => String(r[laWork ? COL.P_ID : COL.T_ID]) === String(resource));
  if (!row) return null;
  const project = laWork ? row : allProjects.find(p => String(p[COL.P_ID]) === String(row[COL.T_PID] || row.work_code));
  return { row, entity: laWork ? "work" : Number(row[COL.T_LEVEL] ?? row.level) === 2 ? "subwork" : "task",
    dept: row.department_id ?? project?.[COL.P_DEPT_ID], deptName: project?.[COL.P_DEPT] || "",
    mine: cungIdQuyen(row.assignee_id, currentUser?.id) || Boolean(currentUser?.name && row[COL.T_ASSIGNEE] === currentUser.name),
    project };
}
function phongCuaTaiKhoan() {
  return phamViQuyen ? phamViQuyen.departmentId : currentUser?.department_id ?? allDepartments.find(d => d[COL.D_NAME] === tenPhongTaiKhoan())?.[COL.D_DB_ID] ?? null;
}
function muonQuyenTrongPhong(entity, action, dept) {
  return ["work", "subwork", "task"].includes(entity) && (phamViQuyen?.delegations || []).some(d =>
    ["Phó Giám đốc", "Trưởng phòng", "Phó phòng"].includes(d.fromRole) &&
    phanQuyenFile.macDinh?.[d.fromRole]?.[entity]?.includes(action) &&
    (dept === undefined || (d.departmentIds || []).some(id => cungIdQuyen(id, dept))));
}

function coQuyenTrongPhamVi(entity, action, scope = null) {
  const vai = phamViQuyen?.vai || currentUser?.role;
  if (!vai || currentUser.is_active === false) return false;
  if (vai === "admin") return true;
  if (!phanQuyenFile.macDinh?.[vai]) return false;
  const gd = phanQuyenFile.ghiDe?.[entity + ":" + action]?.[vai];
  if (gd?.gia_tri === "tu-choi") return false;
  const cho = giaTriHieuLucQuyen(vai, entity, action) !== "tu-choi";
  if (!scope) return cho || muonQuyenTrongPhong(entity, action, undefined);
  const dept = scope.dept, mine = phongCuaTaiKhoan();
  const cungPhong = cungIdQuyen(dept, mine) || (dept == null && mine == null &&
    Boolean(scope.deptName && tenPhongTaiKhoan()) && scope.deptName === tenPhongTaiKhoan());
  if (action === "create" && ["Trưởng phòng", "Phó phòng", "Nhân viên"].includes(vai) && !cungPhong)
    return muonQuyenTrongPhong(entity, action, dept);
  let trongPhamVi = false;
  if (vai === "Phó Giám đốc") trongPhamVi = (phamViQuyen?.managedDepartmentIds || currentUser.managedDepartmentIds || []).some(id => cungIdQuyen(id, dept)) ||
    Boolean(scope.deptName && visibleDepartments.includes(scope.deptName));
  if (["Trưởng phòng", "Phó phòng"].includes(vai)) trongPhamVi = cungPhong;
  if (vai === "Nhân viên") trongPhamVi = action === "read" ? cungPhong || scope.mine :
    action === "create" ? cungPhong && (entity !== "task" || scope.mine || scope.assigned) : scope.mine;
  return Boolean(cho && (trongPhamVi || gd?.pham_vi === "tat-ca")) || muonQuyenTrongPhong(entity, action, dept);
}
function coQuyenTaiDong(action, type, resource) {
  const scope = dongPhamViQuyen(type, resource);
  if (!scope) return false;
  const duocDuyet = (scope.row[COL.T_APPROVAL] || scope.row.approval_status) === "Chờ duyệt" && coQuyenTrongPhamVi(scope.entity, "approve", scope);
  if (action === "update" && duocDuyet) return true;
  if (!coQuyenTrongPhamVi(scope.entity, action, scope)) return false;
  if (["update", "delete"].includes(action)) {
    const status = scope.row[COL.T_APPROVAL] || scope.row.approval_status;
    const owner = scope.row.createdByName;
    if (owner && owner !== currentUser?.name && !isAdmin() &&
        (status === "Nháp" || status === "Chờ duyệt" && currentUser?.role !== "Phó Giám đốc")) return false;
  }
  return true;
}
function coQuyenTaoTrongCongViec(entity, project) {
  const scope = dongPhamViQuyen("project", project);
  if (!scope) return false;
  // Cán bộ được tự nhận nhiệm vụ; máy chủ còn kiểm assignee tại thời điểm gửi.
  return coQuyenTrongPhamVi(entity, "create", { ...scope, mine: currentUser?.role === "Nhân viên" });
}
function congViecChoForm(entity, isEdit = false, current = null) {
  return allProjects.filter(p => (isEdit && String(p[COL.P_ID]) === String(current?.[COL.T_PID])) ||
    coQuyenTaoTrongCongViec(entity, p));
}
function coQuyenTaoCongViec() {
  return coQuyenTrongPhamVi("work", "create") && (isAdmin() ||
    allDepartments.some(d => coQuyenTrongPhamVi("work", "create", { dept: d[COL.D_DB_ID], deptName: d[COL.D_NAME] })));
}
function veLaiQuyenHienTai() {
  if (!currentUser) return;
  const nav = document.getElementById("projects-nav");
  if (nav) nav.style.display = coQuyenTrongPhamVi("work", "read") ? "flex" : "none";
  hideAdminButtons();
  for (const type of ["project", "task"]) {
    const form = document.getElementById(type + "-form");
    if (!form) continue;
    const id = form.querySelector('[name="id"]')?.value;
    const project = allProjects.find(p => String(p[COL.P_ID]) === String(form.querySelector('[name="projectId"]')?.value));
    const entity = Number(form.querySelector('[name="level"]')?.value) === 2 ? "subwork" : "task";
    const allowed = id ? coQuyenTaiDong("update", type, id) : type === "project" ? coQuyenTaoCongViec() : coQuyenTaoTrongCongViec(entity, project);
    form.querySelectorAll('button[type="submit"], [data-luu-nhap]').forEach(b => {
      b.disabled = !allowed || form.dataset.dangLuu === "1" || form.dataset.dangKiem === "1";
      b.title = allowed ? "" : "Quyền hiện tại không cho phép lưu mục này.";
    });
    if (typeof capNhatNutDuyet8b === "function") capNhatNutDuyet8b(type, id, form);
  }
  [renderProjects, renderTasks, hideActionButtons, refreshProjectDetailsModalIfOpen].forEach(fn => {
    try { fn(); } catch (err) { console.error("Không vẽ lại được quyền:", err); }
  });
  if (currentSection === "gantt") renderGanttChart();
  const dangSua = document.querySelector("#task-form [name=id]")?.value;
  const dongDangSua = allTasks.find(t => String(t[COL.T_ID]) === String(dangSua));
  if (document.getElementById("task-ket-qua-danh-sach") && taskKetQuaMa && Number(dongDangSua?.[COL.T_LEVEL]) !== 2) napKetQua(taskKetQuaMa);
  if (currentSection === "cho-duyet") napTrangChoDuyet();
}
async function napPhanQuyenHienTai(veLai = false) {
  if (!currentUser) return false;
  if (lanHoiQuyen?.nguoi === currentUser) return lanHoiQuyen.promise;
  lanHoiQuyen?.controller.abort();
  const nguoi = currentUser;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const lan = { nguoi, controller, promise: null };
  lanHoiQuyen = lan;
  lan.promise = (async () => {
    const before = JSON.stringify([phanQuyenFile, phamViQuyen]);
    const data = await restGetIm("/api/v1/permissions", { signal: controller.signal });
    if (currentUser !== nguoi || !isAuthenticated) return false;
    capNhatBangQuyen(data);
    const changed = before !== JSON.stringify([phanQuyenFile, phamViQuyen]);
    if (veLai && changed) {
      veLaiQuyenHienTai();
      if (data) google.script.run.withSuccessHandler(response => {
        if (currentUser !== nguoi || !response?.success) return;
        allProjects = response.projects || [], allTasks = response.tasks || [];
        veLaiQuyenHienTai();
      }).withFailureHandler(error => console.error("Không tải lại được dữ liệu theo quyền:", error)).getDataForUser();
      if (!isAdmin() && document.getElementById("account-permission-table")) veBangPhanQuyen();
    }
    return Boolean(data?.macDinh);
  })();
  try { return await lan.promise; } finally {
    clearTimeout(timeout);
    if (lanHoiQuyen === lan) lanHoiQuyen = null;
  }
}
function dungHoiLaiQuyen() {
  clearInterval(henHoiQuyen);
  henHoiQuyen = null;
  lanHoiQuyen?.controller.abort();
  lanHoiQuyen = null;
  capNhatBangQuyen(null);
  phamViQuyen = null;
}
function batDauHoiLaiQuyen() {
  clearInterval(henHoiQuyen);
  const hoi = () => { if (isAuthenticated && document.visibilityState !== "hidden") napPhanQuyenHienTai(true); };
  henHoiQuyen = setInterval(hoi, 15000);
  if (!daGanHoiQuyen) {
    window.addEventListener("focus", hoi);
    document.addEventListener("visibilitychange", hoi);
    daGanHoiQuyen = true;
  }
}
let fileKetQuaChoBan = null; // nhóm đang chờ nộp bản mới (null = nộp tạo nhóm mới)
let taskKetQuaMa = "";       // mã nhiệm vụ đang mở tab «Kết quả & Luồng»
/** Giá trị hiệu lực của một cửa file cho MỘT vai — client khớp server từng chữ. */
function giaTriHieuLucFile(vai, action) {
  return giaTriHieuLucQuyen(vai, "file", action);
}
let dsBat = false; // máy chủ trả `onlyOffice` ở GET files — ONLYOFFICE đã cấu hình hay chưa
/**
 * CÂY của nhiệm vụ đang mở tab «Kết quả» đã `Đã duyệt` chưa (Q2, ĐỢT B).
 *
 * Máy chủ trả ở `quyen.cayDaDuyet` của GET /work-items/:ref/files và cũng gắn vào từng nhóm file.
 * Chưa duyệt thì MỌI cửa sinh ra bản thật đều tắt — tải lên, nộp bản mới, ✎ sửa trực tuyến, gửi đi
 * duyệt — chỉ còn nút ＋ khai báo (tên · định dạng · tỷ lệ). Client đọc cờ để nói rõ «vì sao không có
 * nút tải file» thay vì để người dùng đoán; máy chủ vẫn kiểm lại khi bấm.
 *
 * `null` = chưa biết (form TẠO mới, hoặc REST lỗi) — nhánh chưa biết KHÔNG in câu giải thích, khỏi
 * khẳng định sai về một cây mà client chưa hề đọc.
 */
let cayDaDuyetHienTai = null;
/**
 * QUYỀN nộp BẢN ĐẦU của nhiệm vụ đang mở tab «Kết quả» (12/09/2026).
 *
 * Máy chủ trả ở `quyen` của GET /work-items/:ref/files: `duocNop` (chỉ đúng người thực hiện trực tiếp
 * mới mở được nhóm bằng một bản thật) và `tenNguoiThucHien` — tên người đó, để dải chú nêu TÊN thay
 * vì một câu chung chung «người thực hiện trực tiếp» mà người đọc không biết là ai.
 *
 * `null` = chưa biết (form TẠO mới chưa có mã nhiệm vụ, hoặc REST lỗi) — nhánh chưa biết lùi về câu
 * chung chung, không khẳng định gì về một nhiệm vụ client chưa hề đọc.
 */
let quyenNopBanDau = null;
/**
 * ĐUÔI FILE kết quả được nhận (người dùng chốt 2026-09-03: thêm PowerPoint, Excel và ảnh).
 * Phải KHỚP `DUOI_FILE_HOP_LE` trong server/src/modules/taskFiles/service.js — máy chủ vẫn là
 * rào chặn cuối, đây chỉ để `accept=` và câu lỗi sớm cho đỡ mất một vòng gọi. KHÔNG có `.svg`:
 * SVG chạy được `<script>`, mở inline là lỗ XSS lưu trữ.
 */
const DUOI_KET_QUA = Object.freeze([
  ".doc", ".docx", ".pdf", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp",
]);
/** `accept=` của ô chọn file — sinh từ chính danh sách trên. */
const ACCEPT_KET_QUA = DUOI_KET_QUA.join(",");
/** Regex kiểm đuôi ở client — cũng sinh từ danh sách trên, khỏi lệch nhau. */
const RE_DUOI_KET_QUA = new RegExp("\\.(" + DUOI_KET_QUA.map((d) => d.slice(1)).join("|") + ")$", "i");
/** Dung lượng tối đa mỗi bản — khớp `DUNG_LUONG_TOI_DA` của máy chủ (50 MB). */
const DUNG_LUONG_KET_QUA = 50 * 1024 * 1024;
const NHAN_DUNG_LUONG_KET_QUA = "50 MB";
/**
 * Mime MỞ XEM được ngay trên trình duyệt (nút 👁) — khớp `MIME_XEM_INLINE` của máy chủ. Chỉ PDF và
 * ảnh raster; đuôi khác thì chỉ có nút ⬇ tải về.
 */
const MIME_XEM_INLINE = Object.freeze([
  "application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp",
]);
/** Bản này có mở xem trên trình duyệt được không (PDF hoặc ảnh). */
function xemInlineDuoc(b) {
  return MIME_XEM_INLINE.includes(String((b && b.loai_mime) || ""));
}
/**
 * Bản này có sửa trực tuyến được không — ONLYOFFICE dùng để sửa Word/Excel/PowerPoint; PDF chỉ xem
 * nhưng KHÔNG có cho ảnh, nên nút ✎ phải ẩn ở ảnh (máy chủ trả 400 nếu vẫn gọi).
 */
const DUOI_SUA_TRUC_TUYEN = Object.freeze([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);
function suaTrucTuyenDuoc(ten) {
  const khop = String(ten || "").match(/\.[a-z0-9]+$/i);
  return khop ? DUOI_SUA_TRUC_TUYEN.includes(khop[0].toLowerCase()) : false;
}
/**
 * MENU «Hành động» của MỘT dòng kết quả (thiết kế mới: sheet ghi «Nút chức năng — ấn vào đây hiển
 * thị các Hành động để chọn»). Trước đây mỗi hành động là một nút riêng nên hàng nút tràn ngang
 * bảng; nay gộp vào một nút ⋯ mở danh sách dọc.
 *
 * `muc` = mảng { html } đã DỰNG SẴN (mỗi phần tử là một <button>/<a> hoàn chỉnh, đã escape ở bên
 * gọi). Hàm này không nội suy dữ liệu người dùng nào ngoài `id`.
 */
function buildMenuHanhDongKq(id, muc) {
  const ds = (muc || []).filter(Boolean);
  if (ds.length === 0) return "<span class=\"text-xs text-gray-300\">—</span>";
  const maMenu = "kq-menu-" + id;
  return (
    "<span class=\"kq-menu-boc\">" +
    "<button type=\"button\" class=\"btn-secondary py-1 px-2 text-xs kq-menu-nut\" title=\"Các hành động\" " +
    "onclick=\"event.stopPropagation();batTatMenuKq('" + escapeForInlineHandler(maMenu) + "')\"><i class=\"fas fa-ellipsis\"></i></button>" +
    "<span id=\"" + escapeHtmlAttr(maMenu) + "\" class=\"kq-menu hidden\">" + ds.join("") + "</span>" +
    "</span>"
  );
}
/** Một mục trong menu hành động — nhãn + icon, kiểu chốt (đậm) hay thường. */
function buildMucMenuKq(icon, nhan, onclick, laChot) {
  return (
    "<button type=\"button\" class=\"kq-menu-muc" + (laChot ? " kq-menu-muc-chot" : "") + "\" onclick=\"" +
    escapeHtmlAttr(onclick) + "\"><i class=\"fas " + escapeHtml(icon) + " mr-2 w-4 text-center\"></i>" +
    escapeHtml(nhan) + "</button>"
  );
}
/**
 * Mở/đóng MỘT menu hành động — mở cái này thì cái đang mở phải gập (hai menu chồng nhau là bấm
 * nhầm dòng).
 *
 * Người dùng chốt 2026-09-04: «Nút chức năng khi ấn thì bị vấn trong hộp nên phải kéo chuột xuống
 * mới thấy, cho nó vươn ra khỏi hộp để dễ chọn». Menu KHÔNG vươn ra được bằng CSS: cả
 * `.glass-card` (trang hàng chờ) lẫn `.modal-content` (modal nhiệm vụ) đều `overflow` cắt VÀ có
 * `backdrop-filter` — mà `backdrop-filter` biến thẻ thành KHỐI CHỨA của cả `position: fixed`, nên
 * đổi sang `fixed` vẫn bị cắt y như cũ. Cách chắc chắn: DỜI thẻ menu ra `<body>` lúc mở, định vị
 * theo hình chữ nhật của nút ⋯, rồi TRẢ VỀ chỗ cũ lúc đóng.
 */
let menuKqDangMo = null; // { el, cho, ke } — thẻ đang ở <body> và chỗ phải trả về
function batTatMenuKq(maMenu) {
  const el = document.getElementById(maMenu);
  const dangMo = Boolean(menuKqDangMo && menuKqDangMo.el === el);
  dongMenuKq();
  if (!el || dangMo) return; // bấm lại đúng nút đó = gập lại
  // Đo nút ⋯ TRƯỚC khi dời: dời rồi thì menu không còn anh em nào để đo.
  const nut = el.previousElementSibling;
  const o = nut && nut.getBoundingClientRect ? nut.getBoundingClientRect() : null;
  menuKqDangMo = { el, cho: el.parentNode, ke: el.nextSibling };
  document.body.appendChild(el);
  el.classList.remove("hidden");
  datViTriMenuKq(el, o);
  goiDongMenuKq();
}
/** Trả menu đang mở về chỗ cũ rồi ẩn. Bảng đã vẽ lại (chỗ cũ rụng khỏi DOM) thì bỏ thẻ đi. */
function dongMenuKq() {
  document.querySelectorAll(".kq-menu").forEach((m) => m.classList.add("hidden"));
  if (!menuKqDangMo) return;
  const { el, cho, ke } = menuKqDangMo;
  menuKqDangMo = null;
  el.classList.add("hidden");
  el.removeAttribute("style");
  if (cho && cho.isConnected) cho.insertBefore(el, ke && ke.parentNode === cho ? ke : null);
  else el.remove();
}
/**
 * Đặt menu (đang ở `<body>`) ngay dưới nút ⋯, canh lề phải nút. Không đủ chỗ bên dưới thì mở
 * NGƯỢC LÊN; sát mép thì kéo vào trong. Không đo được (jsdom, nút vừa biến mất) thì để nguyên
 * theo CSS — không đoán toạ độ.
 */
function datViTriMenuKq(el, o) {
  if (!o || (!o.width && !o.height)) return;
  const anchor = o;
  const rong = el.offsetWidth || 208; // 13rem = min-width của .kq-menu
  const cao = el.offsetHeight || 0;
  let trai = anchor.right - rong;
  if (trai + rong > window.innerWidth - 8) trai = window.innerWidth - rong - 8;
  if (trai < 8) trai = 8;
  const conLai = window.innerHeight - o.bottom;
  const moLen = cao > 0 && conLai < cao + 12 && o.top > conLai;
  el.style.position = "fixed";
  el.style.zIndex = "200";
  el.style.right = "auto";
  el.style.left = trai + "px";
  el.style.top = (moLen ? Math.max(8, o.top - cao - 4) : o.bottom + 4) + "px";
  el.style.maxHeight = Math.max(120, (moLen ? o.top : conLai) - 12) + "px";
  el.style.overflowY = "auto";
}
let daGoiDongMenuKq = false;
/** Gắn MỘT lần listener «bấm ra ngoài thì đóng menu» — gắn nhiều lần là rò listener mỗi lượt vẽ. */
function goiDongMenuKq() {
  if (daGoiDongMenuKq) return;
  daGoiDongMenuKq = true;
  // Lúc mở, menu nằm ở `<body>` (không còn trong `.kq-menu-boc`) nên bấm vào MỘT MỤC cũng rơi vào
  // nhánh «bấm ra ngoài» — đúng ý: chọn xong thì menu gập. Chỉ chừa đúng nút ⋯ cho `batTatMenuKq`
  // tự xử, khỏi đóng rồi mở lại trong cùng một cú bấm.
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest(".kq-menu-boc")) return;
    dongMenuKq();
  });
}
/**
 * Ẩn/hiện khung LỊCH SỬ (ls) của một dòng file — bấm lần nữa là gập lại.
 *
 * ĐỢT 5 (2026-09-11): khung Ý KIỆN (yk) dưới bảng **không còn** — nội dung và ô nhập dời vào popup
 * `moYKienKetQua`. Nhánh `'yk'` vẫn được giữ vì hàm nhận `phan` tự do và `getElementById` trả `null`
 * thì bỏ qua êm; gọi `batTatKetQua(id,'yk')` nay là một phép KHÔNG LÀM GÌ, không phải lỗi.
 */
function batTatKetQua(fileId, phan) {
  const el = document.getElementById("task-kq-" + (phan === "yk" ? "yk" : "ls") + "-" + fileId);
  if (el) el.classList.toggle("hidden");
}
/**
 * «GHI Ý KIẾN» = GỘP HAI NGUỒN. Lý do người duyệt viết khi TRẢ ĐỂ SỬA / TỪ CHỐI / DUYỆT không nằm
 * trong bảng góp ý: `taskFiles/service.js verdict()` chỉ gọi `repo.themLuong` (bảng `task_file_flow`),
 * KHÔNG gọi `repo.themGopY`. Trước đợt 4 (2026-09-10) cột «Ghi ý kiến» chỉ đọc `gopY` nên đúng những
 * câu «sửa chỗ X rồi nộp lại» mà người dùng cần thấy lại biến mất khỏi cột đó — chỉ còn trong bảng
 * «Lịch sử» phải bấm mới ra. Người dùng báo: «Ghi ý kiến là các ý kiến mỗi lần sửa hoặc từ chối …
 * có ghi ý kiến vào».
 *
 * Đây là sửa HIỂN THỊ, không phải sửa chỗ ghi: lý do verdict ĐÃ được lưu bền trong `task_file_flow`
 * rồi, ghi thêm một dòng vào `task_file_comments` chỉ nhân đôi dữ liệu và làm lệch mọi phép đếm góp ý.
 *
 * Luật gộp: mọi dòng LUỒNG có `noi_dung` không rỗng là một ý kiến, TRỪ `gom-y` — hành động đó ghi
 * CẢ HAI bảng (`gomY()` gọi `themGopY` rồi `themLuong`) nên lấy cả là in cùng một câu hai lần.
 * Kết quả sắp CŨ → MỚI; `version_id` để lọc ý kiến của đúng một bản.
 */
function danhSachYKien(n) {
  const gopY = Array.isArray(n && n.gopY) ? n.gopY : [];
  const luong = Array.isArray(n && n.luong) ? n.luong : [];
  const bans = Array.isArray(n && n.bans) ? n.bans : [];
  const banTheoId = new Map(bans.map((b) => [Number(b.id), b.version_no]));
  const tuGopY = gopY.map((c) => ({
    ten_nguoi: c.ten_nguoi, vai: c.vai, created_at: c.created_at, noi_dung: c.noi_dung,
    nhan: "Góp ý", version_id: c.version_id,
    version_no: banTheoId.get(Number(c.version_id)) ?? null,
  }));
  const tuLuong = luong
    .filter((g) => g.hanh_dong !== "gom-y" && String(g.noi_dung || "").trim())
    .map((g) => ({
      ten_nguoi: g.ten_nguoi, vai: g.vai, created_at: g.created_at, noi_dung: g.noi_dung,
      nhan: NHAN_LUONG_FILE[g.hanh_dong] || g.hanh_dong,
      version_id: g.version_id, version_no: g.version_no ?? null,
    }));
  return [...tuGopY, ...tuLuong].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );
}
/** Ý kiến của ĐÚNG một bản — dòng con 1.1/1.2 và popup nhật ký đều lọc theo `version_id`. */
function yKienCuaBan(n, b) {
  const ma = Number(b && b.id);
  return danhSachYKien(n).filter((y) => Number(y.version_id) === ma);
}
/** MỘT ý kiến đã thoát HTML — nhãn hành động để đọc ra ý kiến này của lần «Yêu cầu sửa» hay «Góp ý». */
function buildMotYKien(y) {
  return "<div class=\"y-kien-muc\">" +
    "<span class=\"y-kien-ai\">" + escapeHtml(y.ten_nguoi || "Không rõ") + "</span> " +
    "<span class=\"y-kien-vai\">(" + escapeHtml(y.vai || "—") + ")</span> " +
    "<span class=\"y-kien-nhan\">" + escapeHtml(y.nhan || "") + "</span> " +
    "<span class=\"y-kien-luc\">" + escapeHtml(formatDateForDisplay(y.created_at, true)) + "</span>" +
    (y.version_no ? "<span class=\"y-kien-ban\">bản " + escapeHtml(y.version_no) + "</span>" : "") +
    "<div class=\"y-kien-noi\">" + escapeHtml(y.noi_dung || "") + "</div></div>";
}
/**
 * Ô NHẬP + nút «Gửi ý kiến» — ghi vào BẢN MỚI NHẤT của nhóm.
 *
 * ĐỢT 5 (2026-09-11) tách riêng khỏi `buildYKienPanel` bên dưới: cột «Ghi ý kiến» trong bảng nay chỉ
 * còn CHỮ «Xem ý kiến» mở POPUP, và ô nhập phải dời THEO popup (cột tên là «Ghi ý kiến» nên đọc và
 * viết ở cùng một chỗ; bỏ ô nhập đi là mất luôn chức năng ghi). Tách ra để popup lắp đúng phần nó cần,
 * không phải in lại cả thread.
 */
function buildONhapYKien(n, ma) {
  const bans = Array.isArray(n.bans) ? n.bans : [];
  const banCuoi = bans.length > 0 ? bans[bans.length - 1] : null;
  if (!banCuoi) return "";
  return (
    "<label class=\"text-xs font-semibold text-gray-500\" for=\"task-y-kien-" + escapeHtmlAttr(n.id) + "\">Ý kiến cho bản " + escapeHtml(banCuoi.version_no) + "</label>" +
    "<textarea id=\"task-y-kien-" + escapeHtmlAttr(n.id) + "\" data-ban-cuoi=\"" + escapeHtmlAttr(banCuoi.id) + "\" rows=\"2\" class=\"form-input w-full text-sm mt-1\" placeholder=\"Nhập ý kiến (Yêu cầu sửa / Trình / Trả về cần tối thiểu 10 ký tự)…\"></textarea>" +
    "<button type=\"button\" class=\"btn-secondary py-1 px-3 text-xs mt-1\" onclick=\"guiYKienTuPopup('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(ma) + "')\">Gửi ý kiến</button>"
  );
}
/** Panel «Ý kiến» của một dòng: ô nhập + thread góp ý (giữ cho test và mọi chỗ còn dùng panel). */
function buildYKienPanel(n, ma) {
  const yKien = danhSachYKien(n);
  const thread = yKien.length
    ? yKien.map((y) => buildMotYKien(y)).join("")
    : "<div class=\"text-xs text-gray-400\">Chưa có ý kiến nào.</div>";
  return buildONhapYKien(n, ma) + "<div class=\"mt-2 space-y-1\">" + thread + "</div>";
}
/** POST REST dạng FormData (upload file) — cùng cơ chế CSRF với restPost; lỗi hiện toast, trả null. */
async function restUpload(path, formData) {
  try {
    const token = await layTokenCsrfChoPost();
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-CSRF-Token": token },
      body: formData,
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
    showToast("Không gửi được file lên máy chủ: " + err.message, "error");
    return null;
  }
}
/** Nạp (lại) khối KẾT QUẢ trong tab Thông tin: máy chủ trả nhóm + bản + góp ý + luồng. */
async function napKetQua(ma) {
  const khung = document.getElementById("task-ket-qua-danh-sach");
  if (!khung) return;
  dongMenuKq(); // menu đang mở nằm ở <body>: vẽ lại bảng mà không gập là để nó lơ lửng mồ côi
  taskKetQuaMa = String(ma || khung.dataset.ma || "");
  // Form TẠO chưa có mã nhiệm vụ: không gọi REST, vẽ bảng 10 cột + dòng khai tạm tại chỗ.
  // Một lần gán innerHTML (giữ nguyên số sink XSS); đừng tách nhánh tạo thành chỗ ghi thứ hai.
  let nhom = [];
  // Xoá cờ của nhiệm vụ VỪA xem: form tạo mới mà dính cờ cũ thì in nhầm câu «cây đã duyệt».
  cayDaDuyetHienTai = null;
  quyenNopBanDau = null;
  if (taskKetQuaMa) {
    const ketQua = await restGet("/api/v1/work-items/" + encodeURIComponent(taskKetQuaMa) + "/files");
    if (!document.getElementById("task-ket-qua-danh-sach")) return;
    if (!ketQua) return; // restGet đã toast lỗi + bật lại modal đăng nhập nếu 401
    const phanQuyen = await restGet("/api/v1/permissions");
    if (phanQuyen) {
      capNhatBangQuyen(phanQuyen);
    }
    dsBat = ketQua.onlyOffice === true;
    cayDaDuyetHienTai = ketQua.quyen ? ketQua.quyen.cayDaDuyet === true : null;
    quyenNopBanDau = ketQua.quyen || null;
    nhom = Array.isArray(ketQua.nhom) ? ketQua.nhom : [];
  }
  khung.innerHTML = buildKhungDanhSachKetQua(nhom, taskKetQuaMa);
}
/**
 * Ai được KHAI dòng kết quả ở giao diện (máy chủ vẫn là rào chặn cuối). Form TẠO chưa có dòng
 * nhiệm vụ trong bộ nhớ nên `coTheNopFile(null, "")` trả false với Cán bộ — ＋ biến mất, đúng lỗi
 * «tạo mới không thấy bảng». Ở form tạo: hiện ＋ miễn `file:create` không phải `tu-choi`.
 */
function coTheKhaiKetQua(ma) {
  if (!ma) {
    const vai = currentUser && currentUser.role;
    if (!vai) return false;
    return giaTriHieuLucFile(vai, "create") !== "tu-choi";
  }
  return coTheNopFile(null, ma);
}
/**
 * KHUNG «Kết quả» (nút ＋ + bảng 10 cột + ô chọn file). Dùng chung cho SỬA (sau REST) và TẠO MỚI
 * (nhom=[], ma="") — form tạo nhúng thẳng vào chuỗi HTML của `createTaskModal` nên bảng hiện NGAY,
 * không chờ setTimeout 250ms, không cần mã nhiệm vụ.
 */
function buildKhungDanhSachKetQua(nhom, ma) {
  const ds = Array.isArray(nhom) ? nhom : [];
  const taoMoi = !ma;
  const duocKhai = coTheKhaiKetQua(ma);
  const nutThem = duocKhai
    ? taoMoi
      ? "<button type=\"button\" class=\"btn-secondary py-1 px-3 text-sm\" onclick=\"themDongKhaiTam()\"><i class=\"fas fa-plus mr-2\"></i>Thêm kết quả</button>"
      : "<button type=\"button\" class=\"btn-secondary py-1 px-3 text-sm\" onclick=\"batTatKhungKhaiKq()\"><i class=\"fas fa-plus mr-2\"></i>Thêm kết quả</button>"
    : "";
  const oChonFile =
    "<input type=\"file\" id=\"task-file-input\" accept=\"" + escapeHtmlAttr(ACCEPT_KET_QUA) + "\" class=\"hidden\" onchange=\"uploadKetQua(this)\">" +
    "<div id=\"task-kq-trang-thai\" class=\"hidden\"></div>";
  return (
    "<div class=\"flex items-center gap-2 mt-1 flex-wrap\">" +
    "<span class=\"text-xs text-gray-400\">Mỗi kết quả là một dòng; bấm ▸ để xem các lần đã sửa.</span>" +
    (ds.length === 0 && !duocKhai
      ? "<span class=\"text-xs text-gray-400\">Bản kết quả ĐẦU TIÊN chỉ " +
        // Nêu TÊN khi đã đọc nhiệm vụ thật (`!taoMoi`): form tạo mới dựng bảng tại chỗ, chưa gọi REST,
        // nên `quyenNopBanDau` ở đó là của nhiệm vụ vừa xem trước — in tên cũ là nói sai.
        escapeHtml(
          !taoMoi && quyenNopBanDau && quyenNopBanDau.tenNguoiThucHien
            ? "«" + quyenNopBanDau.tenNguoiThucHien + "» (người thực hiện trực tiếp)"
            : "người thực hiện trực tiếp của nhiệm vụ"
        ) +
        " nộp được.</span>"
      : "") +
    "<span class=\"ml-auto\">" + nutThem + "</span>" +
    "</div>" +
    // Q2 (ĐỢT B): cây chưa `Đã duyệt` thì bảng KHÔNG có cửa nào tải file lên. Nói thẳng lý do ngay
    // dưới đầu bảng — không có câu này thì người dùng chỉ thấy nút biến mất và tưởng lỗi.
    (taoMoi || cayDaDuyetHienTai !== false ? "" : buildBaoCayChuaDuyet()) +
    (!taoMoi && duocKhai ? buildKhungKhaiKq(ma) : "") +
    buildBangKetQua(ds, ma) +
    (ds.length ? '<p class="text-xs text-gray-500 mt-2">Tổng tỷ lệ file: ' + escapeHtml(ds.reduce((sum, n) => sum + (Number(n.ty_le) || 0), 0)) + '% — tổng khác 100% vẫn được lưu sau xác nhận.</p>' : '') +
    oChonFile
  );
}
/**
 * DẢI CHÚ «cây chưa được duyệt» — Q1 + Q2 (ĐỢT B, 11/09/2026).
 *
 * Người dùng chốt: «Gửi công việc cha lần đầu thì KHÔNG được up file kết quả lên.» Lần gửi ĐẦU chỉ có
 * KHAI BÁO (tên kết quả · định dạng · tỷ lệ) đi theo cây; FILE THẬT đi chuỗi riêng SAU KHI cây
 * `Đã duyệt`. Chuỗi tĩnh, không nội suy gì — nên không làm đổi số chỗ ghi của bộ soát XSS.
 */
function buildBaoCayChuaDuyet() {
  return (
    "<div class=\"mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2\">" +
    "<div class=\"text-xs font-medium text-amber-800\"><i class=\"fas fa-lock mr-2\"></i>Cây công việc này chưa được duyệt nên chưa tải file lên được</div>" +
    "<div class=\"text-xs text-amber-700 mt-1\">Bây giờ chỉ KHAI BÁO kết quả: tên · định dạng · tỷ lệ (%). File thật nộp sau, khi Ban lãnh đạo kiểm soát đã duyệt cây.</div>" +
    "</div>"
  );
}
/**
 * Đọc ô TỶ LỆ (%) của khung/dòng khai báo — Q1 (ĐỢT B, 11/09/2026).
 *
 * Lần gửi ĐẦU chỉ có KHAI BÁO đi theo cây: tên kết quả · định dạng · TỶ LỆ. File thật đi chuỗi riêng
 * sau khi cây `Đã duyệt` (Q2 cấm hẳn nút tải file trước lúc đó), nên tỷ lệ phải khai được ngay ở đây.
 *
 * Trả `{ok:false}` khi gõ sai để người dùng biết mà sửa, thay vì âm thầm bỏ qua con số họ vừa nhập.
 * Để trống là `null` — nghĩa «tự chia», máy chủ chia đều theo số nhóm của nhiệm vụ.
 */
function docTyLeKhai(giaTri) {
  const s = String(giaTri == null ? "" : giaTri).trim();
  if (s === "") return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 100) return { ok: false, value: null };
  return { ok: true, value: n };
}
/** Ô nhập tỷ lệ dùng chung cho khung khai và dòng khai tạm — cùng một luật, một chỗ. */
function oNhapTyLeKhai(id, lop, phu) {
  const cls = ["form-input", "text-sm", lop, "w-full", phu === undefined ? "mt-1" : phu]
    .filter(Boolean)
    .join(" ");
  return (
    "<input type=\"number\" min=\"0\" max=\"100\" step=\"1\" class=\"" + escapeHtmlAttr(cls) + "\"" +
    (id ? " id=\"" + escapeHtmlAttr(id) + "\"" : "") +
    " placeholder=\"Tự chia\">"
  );
}
/**
 * KHUNG KHAI MỘT DÒNG KẾT QUẢ (đợt 2 — 016). Người dùng chốt 2026-09-03: «Dòng đầu tiên khi mới tạo
 * nhiệm vụ sẽ điền 1. 2. 3. điền những nội dung Kết quả làm được, Định dạng, Ghi ý kiến. Nhớ phải có
 * nút + để thêm dòng để điền 2, 3…».
 *
 * Ẩn sẵn, bấm ＋ mới hiện — bảng là thứ người ta vào xem, không phải cái form. Chọn «Báo cáo» thì ô
 * nội dung hiện ra để nộp CHỮ luôn thành bản 1; năm định dạng còn lại chỉ khai rồi nộp file sau.
 *
 * ĐỢT B thêm ô TỶ LỆ (Q1): khai báo gồm tên · định dạng · tỷ lệ.
 */
function buildKhungKhaiKq(ma) {
  return (
    "<div id=\"task-kq-khai\" class=\"hidden mt-2 p-3 border border-gray-100 rounded-lg bg-gray-50\">" +
    "<div class=\"grid grid-cols-1 md:grid-cols-4 gap-2\">" +
    "<div><label class=\"text-xs font-semibold text-gray-500\" for=\"task-kq-khai-ten\">Kết quả làm được</label>" +
    "<input type=\"text\" id=\"task-kq-khai-ten\" maxlength=\"500\" class=\"form-input w-full text-sm mt-1\" placeholder=\"Ví dụ: Báo cáo tổng kết quý 3\"></div>" +
    "<div><label class=\"text-xs font-semibold text-gray-500\" for=\"task-kq-khai-dinh-dang\">Định dạng</label>" +
    "<select id=\"task-kq-khai-dinh-dang\" class=\"form-input w-full text-sm mt-1\" onchange=\"doiDinhDangKhaiKq()\">" +
    "<option value=\"\">— Chưa rõ —</option>" +
    DINH_DANG_KHAI.map((d) => "<option value=\"" + escapeHtmlAttr(d) + "\">" + escapeHtml(d) + "</option>").join("") +
    "</select></div>" +
    "<div><label class=\"text-xs font-semibold text-gray-500\" for=\"task-kq-khai-ty-le\">Tỷ lệ (%)</label>" +
    oNhapTyLeKhai("task-kq-khai-ty-le", "") + "</div>" +
    "<div><label class=\"text-xs font-semibold text-gray-500\" for=\"task-kq-khai-y-kien\">Ghi ý kiến</label>" +
    "<input type=\"text\" id=\"task-kq-khai-y-kien\" maxlength=\"2000\" class=\"form-input w-full text-sm mt-1\" placeholder=\"Không bắt buộc\"></div>" +
    "</div>" +
    "<div id=\"task-kq-khai-noi-dung-boc\" class=\"hidden mt-2\">" +
    "<label class=\"text-xs font-semibold text-gray-500\" for=\"task-kq-khai-noi-dung\">Nội dung báo cáo (nhập chữ, không cần file — tối thiểu 10 ký tự)</label>" +
    "<textarea id=\"task-kq-khai-noi-dung\" rows=\"4\" maxlength=\"20000\" class=\"form-input w-full text-sm mt-1\" placeholder=\"Nhập nội dung báo cáo…\"></textarea>" +
    "</div>" +
    "<div class=\"flex items-center gap-2 mt-2\">" +
    "<button type=\"button\" class=\"btn-primary py-1 px-3 text-sm\" onclick=\"guiKhaiKetQua('" + escapeForInlineHandler(ma) + "')\">Thêm dòng</button>" +
    "<button type=\"button\" class=\"btn-secondary py-1 px-3 text-sm\" onclick=\"batTatKhungKhaiKq()\">Đóng</button>" +
    "<span class=\"text-xs text-gray-400\">Chọn «Báo cáo» thì nhập nội dung ngay; các định dạng khác thì tải file lên sau khi cây được duyệt.</span>" +
    "</div></div>"
  );
}
/** Ẩn/hiện khung khai; mở ra thì đưa con trỏ vào ô tên luôn cho đỡ một lần bấm. */
function batTatKhungKhaiKq() {
  const el = document.getElementById("task-kq-khai");
  if (!el) return;
  el.classList.toggle("hidden");
  if (el.classList.contains("hidden")) return;
  const o = document.getElementById("task-kq-khai-ten");
  if (o) o.focus();
}
/** «Báo cáo» là loại duy nhất nhập CHỮ ⇒ chỉ nó mới cần ô nội dung. */
function doiDinhDangKhaiKq() {
  const chon = document.getElementById("task-kq-khai-dinh-dang");
  const boc = document.getElementById("task-kq-khai-noi-dung-boc");
  if (!chon || !boc) return;
  boc.classList.toggle("hidden", chon.value !== DINH_DANG_BAO_CAO);
}
/**
 * GỬI khai dòng kết quả. «Báo cáo» có nội dung ⇒ đi đường /reports (tạo luôn BẢN chữ đầu tiên);
 * còn lại ⇒ /results (nhóm 0 bản, cột file là «Chưa có»). Máy chủ vẫn kiểm lại toàn bộ.
 */
async function guiKhaiKetQua(ma) {
  const oTen = document.getElementById("task-kq-khai-ten");
  const oDd = document.getElementById("task-kq-khai-dinh-dang");
  const oYk = document.getElementById("task-kq-khai-y-kien");
  const oNd = document.getElementById("task-kq-khai-noi-dung");
  const oTl = document.getElementById("task-kq-khai-ty-le");
  const ten = String((oTen && oTen.value) || "").trim();
  if (!ten) {
    showToast("Nhập tên kết quả làm được trước đã", "error");
    if (oTen) oTen.focus();
    return;
  }
  const tyLe = docTyLeKhai(oTl && oTl.value);
  if (!tyLe.ok) {
    showToast("Tỷ lệ phải là số nguyên từ 0 đến 100 — để trống thì máy chủ tự chia", "error");
    if (oTl) oTl.focus();
    return;
  }
  const dinhDang = String((oDd && oDd.value) || "");
  const yKien = String((oYk && oYk.value) || "").trim();
  const noiDung = String((oNd && oNd.value) || "").trim();
  // Form TẠO chưa có mã nhiệm vụ: không POST, điền vào dòng khai tạm trong bảng.
  if (!ma) {
    dienDongKhaiTamTuKhung(ten, dinhDang, yKien, noiDung, tyLe.value);
    if (oTen) oTen.value = "";
    if (oYk) oYk.value = "";
    if (oNd) oNd.value = "";
    if (oTl) oTl.value = "";
    batTatKhungKhaiKq();
    showToast("Đã thêm dòng — sẽ gửi khi lưu nhiệm vụ", "success");
    return;
  }
  const duong = "/api/v1/work-items/" + encodeURIComponent(ma);
  let ketQua;
  if (dinhDang === DINH_DANG_BAO_CAO && noiDung !== "") {
    if (noiDung.length < 10) {
      showToast("Nội dung báo cáo cần ít nhất 10 ký tự", "error");
      return;
    }
    ketQua = await restPost(duong + "/reports", { noiDung, tenGoc: ten });
  } else {
    const than = { tenKetQua: ten };
    if (dinhDang) than.dinhDang = dinhDang;
    if (yKien) than.yKien = yKien;
    // Q1: tỷ lệ đi theo KHAI BÁO. Cây chưa duyệt thì máy chủ ghi thẳng; cây đã duyệt thì nó thành
    // một đề nghị chờ Ban lãnh đạo kiểm soát ký (R4'') — `tyLeChange.pending` nói rõ điều đó.
    if (tyLe.value !== null) than.tyLe = tyLe.value;
    ketQua = await restPost(duong + "/results", than);
  }
  if (!ketQua) return;
  if (ketQua.tyLeChange && ketQua.tyLeChange.pending === true) {
    showToast("Đã thêm dòng kết quả. Tỷ lệ " + ketQua.tyLeChange.value + "% hiện tại giữ nguyên — đề nghị đổi đã gửi Ban lãnh đạo kiểm soát.", "success");
  } else {
    showToast("Đã thêm dòng kết quả, lưu tạm — chưa gửi đi duyệt", "success");
  }
  if (oTl) oTl.value = "";
  napKetQua(ma);
  await refreshData();
}
/**
 * NỘP «Báo cáo» cho MỘT dòng đã có: ô nhập nằm ngay trong bảng (cột «Hành động» của dòng Báo cáo),
 * lưu thành BẢN MỚI — cùng đường với lần nhập đầu, chỉ thêm `fileId`.
 */
async function guiBaoCaoKetQua(fileId, ma) {
  const o = document.getElementById("task-kq-bc-" + fileId);
  if (!o) return;
  const noiDung = String(o.value || "").trim();
  if (noiDung.length < 10) {
    showToast("Nội dung báo cáo cần ít nhất 10 ký tự", "error");
    o.focus();
    return;
  }
  const ketQua = await restPost("/api/v1/work-items/" + encodeURIComponent(ma) + "/reports", {
    noiDung,
    fileId: String(fileId),
  });
  if (!ketQua) return;
  o.value = "";
  showToast(thongBaoLuuKetQua(ketQua), "success");
  napKetQua(ma);
  await refreshData();
}
/**
 * BẢNG «Kết quả» 10 cột (2026-09-10), thêm tỷ lệ và tiến độ riêng từ sheet «kq-modal» — thay cho các thẻ rời trước đây.
 * Rỗng thì nói rõ là chưa có, đừng để một bảng trắng không ai biết đang tải hay chưa có gì.
 */
/**
 * Bề rộng MƯỜI cột của bảng «Kết quả» trong modal nhiệm vụ — đợt 4 (2026-09-10), người dùng:
 * «Tỷ lệ công việc (%) Tiến độ, độ rộng bé đi… sửa để cân đối hơn». `c-kq-ten` để auto: nó ăn phần
 * còn lại. Tổng chín cột khai số là 81% ⇒ cột «Kết quả làm được» còn 19%.
 * PHẢI đi với `table-layout: fixed` trong `app.css`; không có nó trình duyệt tự chia theo nội dung và
 * mọi con số ở đây bị bỏ qua. Thứ tự mảng là thứ tự cột thật — đổi thì phải đổi `buildOTieuDeKq` bên
 * dưới và MỌI chỗ `colspan="10"` (dòng trống, dòng khai tạm, dòng panel của `buildKhoiFile`).
 */
const COT_BANG_KET_QUA = Object.freeze([
  "c-kq-thoi-gian", "c-kq-ten", "c-kq-dinh-dang", "c-kq-file", "c-kq-ty-le",
  "c-kq-tien-do", "c-kq-nguoi", "c-kq-y-kien", "c-kq-trang-thai", "c-kq-hanh-dong",
]);
function buildColgroupKetQua() {
  return "<colgroup>" + COT_BANG_KET_QUA.map(c => "<col class=\"" + escapeHtmlAttr(c) + "\">").join("") + "</colgroup>";
}
function buildBangKetQua(nhom, ma) {
  const ds = Array.isArray(nhom) ? nhom : [];
  const taoMoi = !ma;
  // ĐỢT 5 (2026-09-11) — «tiêu đề cột căn giữa». `text-center` là class Tailwind có thật trong bản
  // vendor biên dịch sẵn, nhưng KHÔNG dựa một mình vào nó: `app.css` cũng ép
  // `.bang-ket-qua thead th { text-align:center }` để tiêu đề căn giữa kể cả khi class bị đổi.
  const buildOTieuDeKq = (t, them) => "<th class=\"px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase " + escapeHtmlAttr(them || "") + "\">" + escapeHtml(t) + "</th>";
  // Form TẠO (chưa có mã): một dòng khai tạm để điền 1. ngay; SỬA mà chưa có nhóm: hàng «Chưa có»
  // vẫn nằm TRONG bảng 10 cột — người dùng chốt 2026-09-04 «khi tạo mới không thấy bảng kết quả».
  let than;
  if (ds.length > 0) {
    than = ds.map((n, i) => buildKhoiFile(n, ma, i + 1)).join("");
  } else if (taoMoi && coTheKhaiKetQua(ma)) {
    than = buildDongKhaiTam(1);
  } else {
    than = "<tr class=\"dong-kq-trong\"><td colspan=\"10\" class=\"px-3 py-3 text-xs text-gray-400\">Chưa có kết quả nào.</td></tr>";
  }
  return (
    "<div class=\"overflow-x-auto mt-2\"><table class=\"min-w-full text-sm bang-ket-qua\">" + buildColgroupKetQua() + "<thead class=\"bg-gray-50\"><tr>" +
    buildOTieuDeKq("Thời gian") +
    buildOTieuDeKq("Kết quả làm được") +
    buildOTieuDeKq("Định dạng") +
    buildOTieuDeKq("File đã tải lên") +
    buildOTieuDeKq("Tỷ lệ công việc (%)") +
    buildOTieuDeKq("Tiến độ") +
    buildOTieuDeKq("Người thực hiện") +
    buildOTieuDeKq("Ghi ý kiến") +
    buildOTieuDeKq("Tình trạng") +
    buildOTieuDeKq("Hành động") +
    "</tr></thead><tbody class=\"divide-y divide-gray-100\">" +
    than +
    "</tbody></table></div>"
  );
}
/**
 * DÒNG KHAI TẠM trên form TẠO nhiệm vụ — chỉ ô tên / định dạng / TỶ LỆ / ý kiến (và nội dung nếu
 * «Báo cáo»). KHÔNG dùng `buildKhoiFile`: id giả sẽ sinh menu tải/xoá/verdict gọi REST với file id
 * không tồn tại.
 * Ô KHÔNG có `name=` — FormData của `#task-form` không được nuốt chúng vào `taskFromLegacy`.
 */
function buildDongKhaiTam(so) {
  const stt = Number(so) > 0 ? Number(so) : 1;
  const chonDd =
    "<option value=\"\">— Chưa rõ —</option>" +
    DINH_DANG_KHAI.map((d) => "<option value=\"" + escapeHtmlAttr(d) + "\">" + escapeHtml(d) + "</option>").join("");
  return (
    "<tr class=\"dong-kq-khai-tam\">" +
    "<td class=\"px-3 py-2 text-xs text-gray-400 align-middle\">—</td>" +
    "<td class=\"px-3 py-2 align-middle\"><div class=\"flex items-center gap-2\"><span class=\"text-gray-400 kq-tam-so w-5 shrink-0\">" +
    escapeHtml(stt + ".") +
    "</span><input type=\"text\" class=\"form-input text-sm kq-tam-ten w-full\" maxlength=\"500\" placeholder=\"Tên kết quả làm được\"></div></td>" +
    "<td class=\"px-3 py-2 align-middle\"><select class=\"form-input text-sm kq-tam-dinh-dang w-full\" onchange=\"doiDinhDangDongTam(this)\">" +
    chonDd +
    "</select></td>" +
    "<td class=\"px-3 py-2 text-xs text-gray-400 align-middle\">Chưa có</td>" +
    // Q1 (ĐỢT B): tỷ lệ khai được ngay từ lần gửi đầu. Để trống = «tự chia» theo số dòng của nhiệm vụ.
    "<td class=\"px-3 py-2 align-middle\">" + oNhapTyLeKhai("", "kq-tam-ty-le", "") + "</td>" +
    "<td class=\"px-3 py-2 text-xs text-gray-400\">0%</td>" +
    "<td class=\"px-3 py-2 text-xs text-gray-400 align-middle\">—</td>" +
    "<td class=\"px-3 py-2 align-middle\"><input type=\"text\" class=\"form-input text-sm kq-tam-y-kien w-full\" maxlength=\"2000\" placeholder=\"Không bắt buộc\"></td>" +
    "<td class=\"px-3 py-2 text-xs text-gray-400 align-middle\">Sẽ gửi khi lưu nhiệm vụ</td>" +
    "<td class=\"px-3 py-2 text-right align-middle\"><button type=\"button\" class=\"text-gray-400 hover:text-red-600 text-xs\" title=\"Xoá dòng này\" onclick=\"xoaDongKhaiTam(this)\"><i class=\"fas fa-times\"></i></button></td>" +
    "</tr>" +
    "<tr class=\"kq-tam-noi-dung-hang hidden\"><td colspan=\"10\" class=\"px-3 pb-2\"><textarea class=\"form-input w-full text-sm kq-tam-noi-dung\" rows=\"3\" maxlength=\"20000\" placeholder=\"Nội dung báo cáo (tối thiểu 10 ký tự)…\"></textarea></td></tr>"
  );
}
function tbodyKhaiTam() {
  return document.querySelector("#task-ket-qua-danh-sach table.bang-ket-qua tbody");
}
/** ＋ trên form tạo: thêm dòng 2., 3. … ngay trong bảng, không gọi REST. */
function themDongKhaiTam() {
  const tbody = tbodyKhaiTam();
  if (!tbody) return;
  const trong = tbody.querySelector(".dong-kq-trong");
  if (trong) trong.remove();
  const so = tbody.querySelectorAll("tr.dong-kq-khai-tam").length + 1;
  tbody.insertAdjacentHTML("beforeend", buildDongKhaiTam(so));
}
function danhSoDongKhaiTam(tbody) {
  tbody.querySelectorAll("tr.dong-kq-khai-tam").forEach((d, i) => {
    const so = d.querySelector(".kq-tam-so");
    if (so) so.textContent = i + 1 + ".";
  });
}
function xoaDongKhaiTam(nut) {
  const tr = nut && nut.closest && nut.closest("tr.dong-kq-khai-tam");
  if (!tr) return;
  const tbody = tr.parentElement;
  const hangNoiDung = tr.nextElementSibling;
  tr.remove();
  if (hangNoiDung && hangNoiDung.classList.contains("kq-tam-noi-dung-hang")) hangNoiDung.remove();
  danhSoDongKhaiTam(tbody);
  // Form tạo luôn giữ ít nhất một dòng trống để bảng không biến mất.
  if (tbody && tbody.querySelectorAll("tr.dong-kq-khai-tam").length === 0) themDongKhaiTam();
}
function doiDinhDangDongTam(sel) {
  const tr = sel && sel.closest && sel.closest("tr.dong-kq-khai-tam");
  if (!tr) return;
  const hangNoiDung = tr.nextElementSibling;
  if (hangNoiDung) hangNoiDung.classList.toggle("hidden", sel.value !== DINH_DANG_BAO_CAO);
}
/** Điền khung khai (nếu còn) vào dòng tạm trống đầu tiên, không thì thêm dòng mới. */
function dienDongKhaiTamTuKhung(ten, dinhDang, yKien, noiDung, tyLe) {
  const tbody = tbodyKhaiTam();
  if (!tbody) return;
  const trong = tbody.querySelector(".dong-kq-trong");
  if (trong) trong.remove();
  let dich = null;
  tbody.querySelectorAll("tr.dong-kq-khai-tam").forEach((hang) => {
    if (dich) return;
    const o = hang.querySelector(".kq-tam-ten");
    if (o && !String(o.value || "").trim()) dich = hang;
  });
  if (!dich) {
    themDongKhaiTam();
    const all = tbody.querySelectorAll("tr.dong-kq-khai-tam");
    dich = all[all.length - 1];
  }
  if (!dich) return;
  const oTen = dich.querySelector(".kq-tam-ten");
  const oDd = dich.querySelector(".kq-tam-dinh-dang");
  const oYk = dich.querySelector(".kq-tam-y-kien");
  const oTl = dich.querySelector(".kq-tam-ty-le");
    const oNd = dich.nextElementSibling && dich.nextElementSibling.querySelector(".kq-tam-noi-dung");
  if (oTen) oTen.value = ten;
  if (oDd) {
    oDd.value = dinhDang;
    doiDinhDangDongTam(oDd);
  }
  if (oYk) oYk.value = yKien;
  if (oTl) oTl.value = tyLe == null ? "" : String(tyLe);
  if (oNd) oNd.value = noiDung;
}
/** Đọc các dòng khai tạm TRƯỚC khi `closeModal` gỡ DOM. Bỏ dòng chưa đặt tên. */
function thuThapDongKhaiTam() {
  const ra = [];
  document.querySelectorAll("#task-ket-qua-danh-sach tr.dong-kq-khai-tam").forEach((tr) => {
    const ten = String((tr.querySelector(".kq-tam-ten") || {}).value || "").trim();
    if (!ten) return;
    const dinhDang = String((tr.querySelector(".kq-tam-dinh-dang") || {}).value || "");
    const yKien = String((tr.querySelector(".kq-tam-y-kien") || {}).value || "").trim();
    // Q1: tỷ lệ khai ở dòng tạm đi theo dòng; gõ sai thì bỏ qua con số (để «tự chia») chứ không chặn
    // cả lượt lưu nhiệm vụ — người dùng đang bấm «Lưu» cho một form lớn, không phải cho ô này.
    const tyLe = docTyLeKhai((tr.querySelector(".kq-tam-ty-le") || {}).value);
    const noiDungEl = tr.nextElementSibling && tr.nextElementSibling.querySelector(".kq-tam-noi-dung");
    const noiDung = String((noiDungEl || {}).value || "").trim();
    ra.push({
      tenKetQua: ten,
      dinhDang: dinhDang || null,
      yKien,
      noiDung,
      tyLe: tyLe.ok ? tyLe.value : null,
    });
  });
  return ra;
}
/**
 * Gửi từng dòng khai tạm sau khi `addTaskWithAuth` trả `taskId`. Lỗi từng dòng toast, KHÔNG
 * rollback nhiệm vụ vừa tạo — người dùng mở lại để khai tiếp. Cấp 2 không gọi hàm này.
 */
async function guiDongKhaiTam(ma, dongs) {
  if (!ma || !Array.isArray(dongs) || dongs.length === 0) return;
  const duong = "/api/v1/work-items/" + encodeURIComponent(ma);
  let ok = 0,
    loi = 0;
  for (let i = 0; i < dongs.length; i += 1) {
    const d = dongs[i];
    let ketQua = null;
    if (d.dinhDang === DINH_DANG_BAO_CAO && d.noiDung) {
      if (String(d.noiDung).length < 10) {
        showToast("Bỏ qua báo cáo «" + d.tenKetQua + "»: nội dung cần ít nhất 10 ký tự", "error");
        loi += 1;
        continue;
      }
      ketQua = await restPost(duong + "/reports", { noiDung: d.noiDung, tenGoc: d.tenKetQua });
    } else {
      const than = { tenKetQua: d.tenKetQua };
      if (d.dinhDang) than.dinhDang = d.dinhDang;
      if (d.yKien) than.yKien = d.yKien;
      if (d.tyLe !== null && d.tyLe !== undefined) than.tyLe = d.tyLe;
      ketQua = await restPost(duong + "/results", than);
    }
    if (ketQua) ok += 1;
    else loi += 1;
  }
  if (ok > 0) showToast("Đã khai " + ok + " dòng kết quả cho nhiệm vụ mới", "success");
  if (loi > 0) showToast(loi + " dòng kết quả chưa gửi được — mở lại nhiệm vụ để khai tiếp", "error");
  return loi === 0;
}
/** Ai được nộp file theo TRẠNG THÁI + quyền hiệu lực (máy chủ vẫn là rào chặn cuối).
 *
 * 12/09/2026 — BẢN ĐẦU của một nhóm chỉ NGƯỜI THỰC HIỆN TRỰC TIẾP nộp được. Luật này nằm ở cờ
 * `duocSua` máy chủ tính (`taskFiles/service.doc`) nên nhánh `typeof n?.duocSua === "boolean"` dưới
 * đây đã mang nó theo; phần tự suy chỉ chạy cho nhóm dựng ở client (dòng khai tạm trong form tạo
 * nhiệm vụ, `n === null` cho nút ＋) — nơi chưa có bản nào để nộp nên không cần xét.
 */
function coTheNopFile(n, ma) {
  const vai = currentUser && currentUser.role;
  if (!vai) return false;
  if (giaTriHieuLucFile(vai, "create") === "tu-choi") return false;
  if (typeof n?.duocSua === "boolean") return n.duocSua;
  const trangThai = n && n.trang_thai ? n.trang_thai : "cho-xem";
  if (["hoan-thanh", "da-duyet"].includes(trangThai)) return false;
  if (trangThai === "cho-lanh-dao") {
    // File đang ở tay lãnh đạo: chỉ TP/PP và Phó GĐ/GĐ nộp được bản mới.
    return ["Trưởng phòng", "Phó phòng", "Phó Giám đốc", "admin"].includes(vai);
  }
  // cho-xem / can-sua: người được giao nhiệm vụ + TP/PP + Phó GĐ/GĐ.
  if (["Trưởng phòng", "Phó phòng", "Phó Giám đốc", "admin"].includes(vai)) return true;
  const dong = timDongDauViec("task", ma);
  return Boolean(dong && dong[COL.T_ASSIGNEE] === (currentUser && currentUser.name));
}
/** Mở ô chọn file. fileId null = tạo nhóm mới; số = nộp bản mới vào nhóm đó. */
function datDinhDangOChonFile(input, fileId) {
  const row = [...document.querySelectorAll('[data-file][data-dinh-dang]')].find(r => String(r.dataset.file) === String(fileId));
  const khai = row?.dataset.dinhDang || '';
  input.dataset.dinhDang = khai;
  const ds = Object.keys(NHAN_DINH_DANG).filter(ext => NHAN_DINH_DANG[ext] === khai);
  input.accept = ds.length ? ds.join(',') : ACCEPT_KET_QUA;
}
function loiDinhDangChonFile(khai, ten) {
  if (!khai || !DINH_DANG_KHAI.includes(khai) || dinhDangCuaTen(ten) === khai) return '';
  return 'nhóm này khai ' + khai + ', ' + (khai === DINH_DANG_BAO_CAO ? 'chỉ nhận nội dung chữ, không nhận file' : 'chỉ nhận ' + Object.keys(NHAN_DINH_DANG).filter(ext => NHAN_DINH_DANG[ext] === khai).join('/'));
}
function moChonFileKetQua(fileId) {
  const input = document.getElementById("task-file-input");
  if (!input) return;
  fileKetQuaChoBan = fileId ? Number(fileId) : null;
  datDinhDangOChonFile(input, fileId);
  input.value = "";
  input.click();
}
/**
 * THANH TRẠNG THÁI tải file (người dùng chốt 2026-09-02: «thêm trạng thái load tải file lên để
 * người dùng biết là đang tải file lên»). Một hàm cho cả hai chỗ nộp — id ô trạng thái khác nhau
 * nên nhận sẵn phần tử; `null` (chưa mở khung) thì bỏ qua, không nổ.
 */
function veTrangThaiUpload(el, ten, xong, loi) {
  if (!el) return;
  el.classList.remove("hidden");
  if (loi) {
    el.className = "mt-2 text-xs text-red-600";
    el.textContent = "Tải lên thất bại: " + ten;
    return;
  }
  if (xong) {
    el.className = "mt-2 text-xs text-green-600";
    el.textContent = "Đã tải lên xong: " + ten;
    setTimeout(() => el.classList.add("hidden"), 4000);
    return;
  }
  el.className = "mt-2 text-xs text-blue-600";
  // Chỉ dùng textContent — tên file là dữ liệu người dùng, KHÔNG nội suy vào innerHTML.
  el.textContent = "";
  const icon = document.createElement("i");
  icon.className = "fas fa-spinner fa-spin mr-2";
  el.appendChild(icon);
  el.appendChild(document.createTextNode("Đang tải lên: " + ten));
}
/**
 * Gửi FormData lên máy chủ; kiểm đuôi + dung lượng trước cho đỡ mất một vòng gọi.
 *
 * Dùng ở HAI nơi: khối «Kết quả» trong modal nhiệm vụ và trang «Hàng chờ phê duyệt» — cờ
 * `dangOTrangChoDuyet` quyết định vẽ lại cái nào sau khi xong (modal có thể chưa dựng).
 */
async function uploadKetQua(input) {
  const file = input && input.files && input.files[0];
  if (input) input.value = "";
  const oTrangThai = document.getElementById(
    dangOTrangChoDuyet ? "kq-cho-duyet-trang-thai" : "task-kq-trang-thai"
  );
  const veLaiTrang = dangOTrangChoDuyet;
  dangOTrangChoDuyet = false;
  if (!file) return;
  const loiDinhDang = loiDinhDangChonFile(input?.dataset?.dinhDang, file.name);
  if (loiDinhDang) { showToast(loiDinhDang, "error"); return; }
  if (!RE_DUOI_KET_QUA.test(file.name)) {
    showToast("Chỉ nhận file " + DUOI_KET_QUA.join(" "), "error");
    return;
  }
  if (file.size > DUNG_LUONG_KET_QUA) {
    showToast("File vượt quá dung lượng tối đa " + NHAN_DUNG_LUONG_KET_QUA, "error");
    return;
  }
  const fd = new FormData();
  fd.append("file", file);
  if (fileKetQuaChoBan != null) fd.append("fileId", String(fileKetQuaChoBan));
  fileKetQuaChoBan = null;
  veTrangThaiUpload(oTrangThai, file.name, false, false);
  let ketQua;
  try {
    ketQua = await restUpload("/api/v1/work-items/" + encodeURIComponent(taskKetQuaMa) + "/files", fd);
  } catch (err) {
    veTrangThaiUpload(oTrangThai, String((err && err.message) || "lỗi không rõ"), false, true);
    throw err;
  }
  if (!ketQua) {
    veTrangThaiUpload(oTrangThai, "máy chủ từ chối", false, true);
    return;
  }
  veTrangThaiUpload(oTrangThai, file.name, true, false);
  showToast(thongBaoLuuKetQua(ketQua), "success");
  if (veLaiTrang) renderChoDuyetKetQua();
  else napKetQua(taskKetQuaMa);
  await refreshData();
}
/** Tải bình thường chỉ lưu; đáp ứng lệnh sửa mới gửi thẳng (Q5). */
function thongBaoLuuKetQua(ketQua) {
  if (ketQua.nhom?.trang_thai === "luu-tam") return "Đã lưu tạm — chưa gửi đi duyệt";
  return ketQua.tuDong ? "Đã gửi bản đáp ứng lệnh sửa và phê duyệt tự động" : "Đã gửi bản đáp ứng lệnh sửa đi duyệt";
}
/** Gửi đúng bản người dùng vừa xem; khóa thao tác ở client, server khóa nhóm + kiểm phiên bản. */
const fileDangGuiDuyet = new Set();
async function guiDiDuyetFile(fileId, ma, versionId, tuHangCho = false) {
  const khoa = String(fileId);
  if (fileDangGuiDuyet.has(khoa)) return;
  if (!window.confirm("Gửi bản đang xem đi duyệt? Nếu đã có bản mới hơn, hệ thống sẽ yêu cầu tải lại.")) return;
  fileDangGuiDuyet.add(khoa);
  try {
    const ketQua = await restPost("/api/v1/task-files/" + encodeURIComponent(fileId) + "/gui-di-duyet",
      { versionId: versionId == null ? null : String(versionId) });
    if (!ketQua) return;
    showToast(ketQua.tuDong ? "Đã gửi và PHÊ DUYỆT LUÔN — phân quyền cho phép" : "Đã gửi đi duyệt", "success");
    if (tuHangCho) await renderChoDuyetKetQua();
    else if (ma) await napKetQua(ma);
    await capNhatNavChoDuyet();
    await refreshData();
  } finally {
    fileDangGuiDuyet.delete(khoa);
  }
}
/** Một hành động verdict: hỏi nội dung khi bắt buộc, chốt thì xác nhận trước khi khóa. */
async function xuLyVerdictFile(fileId, hanhDong, canNoiDung, ma) {
  if (hanhDong === "duyet" && !confirm("Duyệt sẽ KHÓA kết quả — không nộp thêm được nữa. Tiếp tục?")) return;
  if (hanhDong === "hoan-thanh" && !confirm("Hoàn thành luôn (không trình lãnh đạo)? Tiếp tục?")) return;
  let noiDung = "";
  if (canNoiDung) {
    // Ưu tiên ô «Ý kiến» của khối file (người dùng chốt); trống hoặc ngắn hơn 10 thì hỏi lại.
    const oYKien = document.getElementById("task-y-kien-" + fileId);
    noiDung = String((oYKien && oYKien.value) || "").trim();
    if (noiDung.length < 10) {
      noiDung = (prompt("Nhập nội dung (tối thiểu 10 ký tự):") || "").trim();
    }
    if (noiDung.length < 10) {
      if (noiDung !== "") showToast("Nội dung cần ít nhất 10 ký tự", "error");
      return;
    }
  } else if (HANH_DONG_CHOT.includes(hanhDong)) {
    // Q6/Q11 (người dùng chốt 11/09/2026): nút CHỐT («Hoàn thành / Duyệt», «Duyệt») nay CÓ ghi chú,
    // nhưng là TUỲ CHỌN — để trống vẫn chốt được. Đọc đúng ô «Ý kiến» sẵn có của khối file, không
    // bật hộp thoại hỏi thêm: bắt người duyệt gõ chữ cho một lần chốt là thêm một bước cản. Máy chủ
    // lưu ghi chú này vào `task_file_flow.noi_dung` và nối vào thông báo chuông.
    const oYKien = document.getElementById("task-y-kien-" + fileId);
    noiDung = String((oYKien && oYKien.value) || "").trim().slice(0, 2000);
  }
  const ketQua = await restPost("/api/v1/task-files/" + encodeURIComponent(fileId) + "/verdict", {
    hanhDong,
    noiDung: noiDung.trim(),
  });
  if (!ketQua) return;
  showToast("Đã " + (NHAN_VERDICT_FILE[hanhDong] || hanhDong).toLowerCase(), "success");
  napKetQua(ma);
  await refreshData();
}
/** Gửi Ý KIỆN từ ô nhập của khối file — ghi vào BẢN MỚI NHẤT (data-ban-cuoi); vai máy chủ kiểm. */
async function guiYKien(fileId, ma) {
  const oYKien = document.getElementById("task-y-kien-" + fileId);
  if (!oYKien) return;
  const noiDung = String(oYKien.value || "").trim();
  if (!noiDung) {
    showToast("Nhập ý kiến trước khi gửi", "error");
    return;
  }
  if (noiDung.length > 2000) {
    showToast("Ý kiến tối đa 2000 ký tự", "error");
    return;
  }
  const banCuoi = oYKien.dataset.banCuoi;
  if (!banCuoi) {
    showToast("Chưa có bản nào để gửi ý kiến", "error");
    return;
  }
  const ketQua = await restPost(
    "/api/v1/task-file-versions/" + encodeURIComponent(banCuoi) + "/comments",
    { noiDung }
  );
  if (!ketQua) return;
  oYKien.value = "";
  showToast("Đã gửi ý kiến", "success");
  napKetQua(ma);
}
/**
 * ĐỢT 5 (2026-09-11) — gửi ý kiến TỪ POPUP rồi đóng popup.
 *
 * `guiYKien` báo lỗi bằng toast và GIỮ NGUYÊN chữ trong ô khi không gửi được (chưa nhập, quá 2000 ký
 * tự, REST lỗi); chỉ khi gửi THÀNH CÔNG nó mới xoá ô nhập. Lấy đúng dấu hiệu đó làm điều kiện đóng:
 * ô còn chữ ⇒ ở lại cho người dùng sửa tiếp, ô rỗng ⇒ đóng. Đóng là bắt buộc vì `guiYKien` đã gọi
 * `napKetQua(ma)` vẽ lại bảng — để popup mở là nó đang kể chuyện cũ.
 */
async function guiYKienTuPopup(fileId, ma) {
  await guiYKien(fileId, ma);
  const o = document.getElementById("task-y-kien-" + fileId);
  if (!o || !String(o.value || "").trim()) dongPopupYKien();
}
/** Hàm dọn popup đang mở (gỡ cả listener phím) — `null` khi không có popup nào. */
let yKienDong = null;
function dongPopupYKien() {
  if (yKienDong) {
    const don = yKienDong;
    yKienDong = null;
    don();
  }
}
/**
 * POPUP «XEM Ý KIẾN» của bảng «Kết quả» trong trang Chỉnh sửa nhiệm vụ.
 *
 * Người dùng chốt đợt 5: «phần ghi ý kiến sẽ là hiển thị chữ "xem ý kiến", click vào đấy sẽ hiển thị
 * popup xem ý kiến của bản đấy, còn bản đầu 1. đấy sẽ xem tất cả». Vậy Ô TRONG BẢNG chỉ còn một chữ
 * «Xem ý kiến», nội dung dời hết ra popup:
 *   • dòng CHA (1., 2., 3.) ⇒ `banId` RỖNG ⇒ in **TẤT CẢ** ý kiến của nhóm + Ô NHẬP để ghi tiếp;
 *   • dòng BẢN (1.1, 1.2…)  ⇒ `banId` = id bản ⇒ in ĐÚNG ý kiến của bản đó, **CHỈ ĐỌC** — máy chủ chỉ
 *     cho ghi góp ý vào BẢN MỚI NHẤT (`guiYKien` POST theo `data-ban-cuoi`), để ô nhập ở popup của bản
 *     cũ là mời người dùng viết vào một chỗ rồi chữ chạy sang bản khác.
 *
 * Ý kiến ở đây là DANH SÁCH GỘP (`danhSachYKien`): góp ý gõ tay + LÝ DO mỗi lần yêu cầu sửa / trả về /
 * từ chối nằm trong `task_file_flow` — bẫy đợt 4, đừng chỉ đọc `gopY`.
 *
 * Dữ liệu lấy LẠI TỪ REST chứ không đọc từ DOM đã vẽ: bảng có thể đã cũ, và `buildDongBanKetQua` chỉ
 * cầm nhóm chứ không giữ bản. MÁY CHỦ TRẢ `bans`, KHÔNG phải `ban` — bẫy đợt 4.
 */
async function moYKienKetQua(maNhiemVu, fileId, banId) {
  if (!maNhiemVu || !fileId) return;
  const duLieu = await restGet("/api/v1/work-items/" + encodeURIComponent(maNhiemVu) + "/files");
  if (!duLieu) return; // restGet đã toast lỗi + bật lại modal đăng nhập nếu 401
  const nhom = (Array.isArray(duLieu.nhom) ? duLieu.nhom : [])
    .find((g) => String(g.id) === String(fileId));
  if (!nhom) {
    showToast("Không tìm thấy kết quả này — có thể vừa bị xoá, hãy tải lại trang", "error");
    return;
  }
  const bans = Array.isArray(nhom.bans) ? nhom.bans : [];
  const ban = banId ? bans.find((b) => String(b.id) === String(banId)) || null : null;
  const tenNhom = nhom.ten_ket_qua || nhom.ten_goc || "chưa đặt tên";
  const dsY = ban ? yKienCuaBan(nhom, ban) : danhSachYKien(nhom);
  const tieuDe = ban
    ? "Ý kiến của bản " + (ban.version_no ?? "?") + " — " + tenNhom
    : "Toàn bộ ý kiến — " + tenNhom;

  // MỘT lần innerHTML cho cả thân popup: mọi giá trị đều đã qua `escapeHtml`/`escapeHtmlAttr`/
  // `escapeForInlineHandler` bên trong các hàm `build*` (cùng khuôn `napKetQua`).
  //   • dòng CHA ⇒ dùng lại NGUYÊN `buildYKienPanel` (ô nhập + thread của TẤT CẢ ý kiến) để ô nhập chỉ
  //     được dựng ở MỘT chỗ, popup và mã cũ không thể lệch nhau;
  //   • dòng BẢN ⇒ CHỈ ĐỌC, vì máy chủ chỉ cho ghi góp ý vào BẢN MỚI NHẤT.
  const than = ban
    ? "<div class=\"yk-danh-sach\">" +
      (dsY.length
        ? dsY.map((y) => buildMotYKien(y)).join("")
        : "<div class=\"text-xs text-gray-400\">Chưa có ý kiến nào cho bản này.</div>") +
      "</div>" +
      "<p class=\"yk-chu-thich\">Popup của một bản chỉ để ĐỌC — ý kiến mới luôn ghi vào bản mới nhất. Muốn viết, bấm «Xem ý kiến» ở dòng cha của kết quả này.</p>"
    : buildYKienPanel(nhom, maNhiemVu);

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const overlay = el("div", "qlcv-dialog yk-dialog");
  overlay.id = "y-kien-dialog";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const panel = document.createElement("section");
  panel.append(el("h3", null, tieuDe));
  const content = el("div", "qlcv-dialog-content yk-noi-dung");
  content.innerHTML = than;
  const chan = document.createElement("footer");
  const nutDong = el("button", "btn-secondary", "Đóng");
  nutDong.type = "button";
  chan.append(nutDong);
  panel.append(content, chan);
  overlay.append(panel);

  const bamPhim = (event) => {
    if (event.key === "Escape") dongPopupYKien();
  };
  function don() {
    document.removeEventListener("keydown", bamPhim);
    overlay.remove();
  }
  nutDong.addEventListener("click", () => dongPopupYKien());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) dongPopupYKien();
  });
  // Gỡ popup cũ + listener cũ TRƯỚC khi gắn cái mới: mở liên tiếp hai dòng mà không gỡ là chồng hai
  // lớp phủ và Escape phải bấm hai lần mới tắt.
  dongPopupYKien();
  yKienDong = don;
  document.addEventListener("keydown", bamPhim);
  document.body.append(overlay);
}
/** Xoá NHÓM file — người tạo + admin, chưa «Đã duyệt» (máy chủ kiểm lại). */
async function xoaKetQuaFile(fileId, ma) {
  if (!confirm("Xoá nhóm file này cùng mọi bản, góp ý và bảng luồng?")) return;
  const ketQua = await restGhi("DELETE", "/api/v1/task-files/" + encodeURIComponent(fileId));
  if (ketQua === null) return;
  showToast("Đã xoá nhóm file", "success");
  napKetQua(ma);
  await refreshData();
}
function taiFileKetQua(banId) {
  window.location = "/api/v1/task-files/" + encodeURIComponent(banId) + "/download";
}
function xemFileKetQua(banId) {
  window.open("/api/v1/task-files/" + encodeURIComponent(banId) + "/download?inline=1", "_blank");
}
/** Một nút icon + nhãn của khối file. */
function nutIconFile(icon, title, onclick, mauThem) {
  // Mọi giá trị nội suy đều qua escape tại lỗ (bộ soát TC-SEC-10); onclick đã dựng từ
  // escapeForInlineHandler bên gọi — bọc thêm escapeHtmlAttr là vô hại với id/mã ASCII.
  return (
    "<button type=\"button\" title=\"" + escapeHtmlAttr(title) + "\" class=\"btn-secondary py-1 px-2 text-sm " +
    escapeHtmlAttr(mauThem || "") + "\" onclick=\"" + escapeHtmlAttr(onclick) + "\"><i class=\"fas " + escapeHtml(icon) + "\"></i></button>"
  );
}
/** Một nút verdict. */
function nutVerdictFile(n, ma, hanhDong, nhan, canNoiDung, laChot) {
  return (
    "<button type=\"button\" class=\"" + (laChot ? "btn-primary" : "btn-secondary") + " py-1 px-3 text-sm\" onclick=\"" +
    "xuLyVerdictFile('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(hanhDong) + "', " +
    (canNoiDung ? "true" : "false") + ", '" + escapeForInlineHandler(ma) + "')\">" +
    (laChot ? "<i class=\"fas fa-check mr-1\"></i>" : "") + escapeHtml(nhan) + "</button>"
  );
}
/**
 * LUẬT verdict — MỘT nguồn sự thật cho cả hàng nút cũ (`buildNutVerdictFile`) và menu ⋯ của bảng
 * thiết kế mới. Trả mảng { hanhDong, nhan, canNoiDung, laChot } theo VAI + GIÁ TRỊ HIỆU LỰC +
 * TRẠNG THÁI; máy chủ vẫn kiểm lại khi bấm (client chỉ ẩn/hiện cho đẹp).
 */
function dsVerdictFile(n) {
  if (n.duocVerdict === false || !coQuyenTrongPhamVi("file", "read")) return [];
  // ĐƯỜNG CHÍNH: máy chủ đã tính sẵn `hanhDong` bằng `BANG_VERDICT` + `phaiTrinhLanhDao` +
  // `giaTriHieuLuc`. Client KHÔNG suy luật lần nữa — chỉ lọc lại nút chốt theo phân quyền đang hiển
  // thị (đặt ⏳ là mất nút, khỏi phải tải lại trang) và đánh dấu nút nào là nút CHỐT để vẽ icon ✓.
  if (Array.isArray(n.hanhDong)) return n.hanhDong
    .filter(h => !HANH_DONG_CHOT.includes(h.ma) || giaTriHieuLucFile(currentUser?.role, "approve") === "cho-phep")
    .map(h => ({ hanhDong: h.ma, nhan: h.nhan, canNoiDung: h.canNoiDung, laChot: HANH_DONG_CHOT.includes(h.ma) }));
  const vai = currentUser && currentUser.role;
  if (!vai) return [];
  const tt = n.trang_thai;
  const laLanhDaoPhong = ["Trưởng phòng", "Phó phòng"].includes(vai);
  const ds = [];
  // Danh sách DỰ PHÒNG cho dòng chưa có `hanhDong` của máy chủ. Thứ tự và điều kiện bám đúng
  // `BANG_VERDICT` (taskFiles/service.js) — ĐỢT B đổi hai chỗ:
  //  • ĐIỂM 7: «Trình Phó giám đốc» (`trinh-lanh-dao`) thành «TP/PP phê duyệt» (`tp-phe-duyet`),
  //    vì đây là một LẦN KÝ có lưu người ký và lúc ký, không chỉ đổi trạng thái;
  //  • ĐIỂM 9: «Yêu cầu sửa» (`yeu-cau-sua`) gộp vào «Đẩy về Cán bộ», và nội dung nay BẮT BUỘC
  //    (≥ 10 ký tự) như `tra-ve-tp` — trả việc về mà không nói vì sao là đúng cái đang dọn.
  //
  // Q6/Q11 — danh sách dự phòng CỐ Ý hiện cả «TP/PP phê duyệt» lẫn «Hoàn thành / Duyệt», dù luật
  // thật là hai nút LOẠI TRỪ NHAU: điều kiện loại trừ nằm ở `gui_bld_phe_duyet` + `assignee_id` của
  // NHIỆM VỤ, mà `NHOM` của GET …/files không trả hai cột đó (chỉ hàng chờ là có). Đoán mò ở đây thì
  // sai theo chiều NGƯỢC — ẩn mất nút mà người duyệt đang cần. Nên dự phòng chọn sai theo chiều
  // thừa nút: bấm nhầm là máy chủ 409 kèm câu chỉ đúng nút phải dùng. Đường này chỉ chạy khi payload
  // cũ/thiếu `hanhDong`, không phải đường thường.
  if (laLanhDaoPhong) {
    if (["cho-xem", "can-sua"].includes(tt)) {
      ds.push({ hanhDong: "tp-phe-duyet", nhan: "TP/PP phê duyệt", canNoiDung: true, laChot: false });
    }
    if (["cho-xem", "cho-lanh-dao", "can-sua"].includes(tt)) {
      ds.push({ hanhDong: "tra-ve-cbo", nhan: "Đẩy về Cán bộ", canNoiDung: true, laChot: false });
    }
    // file:approve = ✓ ⇒ nút chốt «Hoàn thành / Duyệt» hiện (chốt 'hoan-thanh'); ⏳ ⇒ ẨN.
    if (["cho-xem", "can-sua"].includes(tt) && giaTriHieuLucFile(vai, "approve") === "cho-phep") {
      ds.push({ hanhDong: "hoan-thanh", nhan: "Hoàn thành / Duyệt", canNoiDung: false, laChot: true });
    }
  }
  if (["Phó Giám đốc", "admin"].includes(vai) && tt === "cho-lanh-dao") {
    ds.push({ hanhDong: "tra-ve-tp", nhan: "Trả về TP/PP", canNoiDung: true, laChot: false });
    if (giaTriHieuLucFile(vai, "approve") === "cho-phep") {
      ds.push({ hanhDong: "duyet", nhan: "Duyệt", canNoiDung: false, laChot: true });
    }
  }
  return ds;
}
/** Nút verdict hiển thị THEO VAI + GIÁ TRỊ HIỆU LỰC + TRẠNG THÁI — máy chủ vẫn kiểm lại. */
function buildNutVerdictFile(n, ma) {
  const nut = dsVerdictFile(n).map((v) =>
    nutVerdictFile(n, ma, v.hanhDong, v.nhan, v.canNoiDung, v.laChot)
  );
  return nut.length === 0 ? "" : "<div class=\"flex flex-wrap gap-2 mt-3\">" + nut.join("") + "</div>";
}
/**
 * POPUP «NHẬT KÝ FILE KẾT QUẢ» — nút «Xem kết quả» của tab Nhiệm vụ (thiết kế lại 2026-09-10).
 *
 * Người dùng đòi đọc được THEO THỜI GIAN: ban đầu AI ĐĂNG KÝ kết quả này, rồi AI THỰC HIỆN, xem
 * LỊCH SỬ CÁC BẢN và Ý KIẾN của từng lần. Bốn mục đó là bốn khối trong cùng một popup.
 *
 * Dựng BẰNG textContent, KHÔNG nối chuỗi HTML: mọi giá trị ở đây là tên người, tên file và nội
 * dung ý kiến — đúng ba thứ do người khác gõ vào. Vì không thêm chỗ ghi HTML nào nên PIN XSS
 * không tăng vì hàm này (docs/XSS-4.6.md). Cùng cách với `hopThoai8b` bên phase8b-review.js và
 * dùng lại lớp `.qlcv-dialog` đã có trong app.css, không phát minh hộp thoại thứ hai.
 *
 * Dữ liệu lấy từ REST CÓ SẴN `GET /work-items/:ref/files` (máy chủ trả nhóm + bản + góp ý + bảng
 * luồng cho cả nhiệm vụ) rồi lọc đúng một nhóm — KHÔNG mở endpoint mới chỉ để xem một file.
 */
async function moNhatKyFileKetQua(maNhiemVu, fileId) {
  if (!maNhiemVu || !fileId) return;
  const duLieu = await restGet("/api/v1/work-items/" + encodeURIComponent(maNhiemVu) + "/files");
  if (!duLieu) return; // restGet đã toast lỗi + bật lại modal đăng nhập nếu 401
  const nhom = (Array.isArray(duLieu.nhom) ? duLieu.nhom : [])
    .find((g) => String(g.id) === String(fileId));
  if (!nhom) {
    showToast("Không tìm thấy kết quả này — có thể vừa bị xoá, hãy tải lại trang", "error");
    return;
  }
  const nhiemVu = allTasks.find((t) => String(t[COL.T_ID]) === String(maNhiemVu)) || {};
  // MÁY CHỦ TRẢ `bans`, KHÔNG phải `ban` (`taskFiles/service.js doc()` → `routes.js` `/work-items/:ref/files`).
  // Bản đầu của popup đọc nhầm `nhom.ban` nên LUÔN ra rỗng: chip «Số bản» hiện 0 và khối 3 báo
  // «Chưa có bản nào được tải lên» dù nhóm có bản thật. Test đơn vị mock theo cùng cái tên sai nên
  // không bắt được — fixture phải chép đúng tên khoá của `doc()`.
  const ban = Array.isArray(nhom.bans) ? nhom.bans : [];
  const gopY = Array.isArray(nhom.gopY) ? nhom.gopY : [];
  const luong = Array.isArray(nhom.luong) ? nhom.luong : [];
  // Tiến độ của nhóm không nằm trong phản hồi này (nó do `tienDo.js` tính cho danh sách) — lấy lại
  // từ chính dòng đang hiển thị để hai nơi không nói hai số khác nhau.
  const dongTrongBang = (Array.isArray(nhiemVu.ketQuaFiles) ? nhiemVu.ketQuaFiles : [])
    .find((f) => String(f.id) === String(fileId)) || {};

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const nut = (cls, nhan, viec) => {
    const b = el("button", cls, nhan);
    b.type = "button";
    b.addEventListener("click", viec);
    return b;
  };

  const overlay = el("div", "qlcv-dialog nk-file-dialog");
  overlay.id = "nhat-ky-file-dialog";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const panel = document.createElement("section");
  panel.append(el("h3", null,
    "Nhật ký kết quả — " + (nhom.ten_ket_qua || nhom.ten_goc || "chưa đặt tên")));
  const content = el("div", "qlcv-dialog-content nk-noi-dung");

  // ── Tóm tắt: đọc một cái là biết kết quả này đang ở đâu ────────────────────────────────────
  const tomTat = el("div", "nk-tom-tat");
  const chip = (nhan, giaTri) => {
    const c = el("span", "nk-chip");
    c.append(el("span", "nk-chip-nhan", nhan), el("span", "nk-chip-gia-tri", String(giaTri)));
    tomTat.append(c);
  };
  chip("Tình trạng", ban.length
    ? (NHAN_TRANG_THAI_FILE[nhom.trang_thai] || nhom.trang_thai)
    : "Chưa nộp");
  chip("Định dạng", nhom.dinh_dang || dinhDangCuaTen(nhom.ten_goc) || "—");
  chip("Tỷ lệ", nhom.ty_le == null ? "—" : Math.max(0, Number(nhom.ty_le) || 0) + "%");
  chip("Tiến độ", dongTrongBang.tienDo == null
    ? "—"
    : Math.max(0, Math.min(100, Number(dongTrongBang.tienDo) || 0)) + "%");
  chip("Số bản", ban.length);
  content.append(tomTat);

  // ── 1 + 2 · Ai đăng ký / Ai thực hiện ────────────────────────────────────────────────────────
  // Người dùng chốt 2026-09-10 (đợt 4): BỎ hai tiêu đề «Ai đăng ký kết quả này» và «Ai thực hiện»,
  // ghi thẳng thành bốn dòng đánh số 1. / 2. Ô «Lãnh đạo phòng phụ trách:» GIỮ NHÃN kể cả khi trống
  // — chính chỗ trống đó nói lên nhiệm vụ chưa gán lãnh đạo, ẩn dòng đi là mất thông tin.
  const khoiDau = el("div", "nk-dong-dau");
  khoiDau.append(
    el("div", "nk-dong",
      "1. " + (nhom.ten_nguoi_tao || "Không rõ ai") + " đăng ký lúc " +
      formatDateForDisplay(nhom.created_at, true)),
    el("div", "nk-dong",
      "Tên khai báo: " + (nhom.ten_ket_qua || nhom.ten_goc || "—") +
      " · định dạng khai: " + (nhom.dinh_dang || "—")),
    el("div", "nk-dong",
      "2. Người thực hiện trực tiếp: " + (nhiemVu[COL.T_ASSIGNEE] || "")),
    el("div", "nk-dong",
      "Lãnh đạo phòng phụ trách: " + (nhiemVu[COL.T_LEADERS] || ""))
  );
  content.append(khoiDau);

  // ── 3 · Lịch sử các bản + ý kiến của từng lần ─────────────────────────────────────────────
  content.append(el("h4", "nk-tieu-de", "3 · Lịch sử các bản và ý kiến từng lần"));
  if (!ban.length) {
    content.append(el("p", "nk-trong", "Chưa có bản nào được tải lên."));
  } else {
    const olBan = el("ol", "nk-ban");
    ban.forEach((b, i) => {
      const li = el("li", "nk-ban-muc");
      const dauBan = el("div", "nk-ban-dau");
      dauBan.append(
        el("span", "nk-ban-so", "Bản " + (b.version_no ?? i + 1) + (i === 0 ? "" : " — sửa lần " + i)),
        el("span", "nk-ban-ten", b.ten_goc || nhom.ten_goc || "")
      );
      const cumNut = el("span", "nk-ban-nut");
      // Bản «Báo cáo» là chữ nhập thẳng, không có file để tải/xem — cùng luật với bảng trong modal.
      if (!laBanBaoCaoKq(b)) {
        cumNut.append(nut("nk-link", "⬇ tải", () => taiFileKetQua(b.id)));
        if (xemInlineDuoc(b)) cumNut.append(nut("nk-link", "👁 xem", () => xemFileKetQua(b.id)));
      }
      dauBan.append(cumNut);
      li.append(dauBan);
      li.append(el("div", "nk-ban-ai",
        (b.ten_nguoi_nop || "Không rõ ai") + " nộp lúc " + formatDateForDisplay(b.uploaded_at, true)));
      if (laBanBaoCaoKq(b) && b.noi_dung) li.append(el("div", "nk-bao-cao", b.noi_dung));
      // Ý kiến của ĐÚNG bản này, GỘP cả lý do verdict (`danhSachYKien`) — popup phải kể được «lần này
      // bị trả về vì sao», không chỉ những câu gõ tay ở nút «Gửi ý kiến».
      const yRieng = yKienCuaBan(nhom, b);
      if (yRieng.length) {
        const ulY = el("ul", "nk-y-kien");
        yRieng.forEach((c) => {
          const liY = el("li");
          liY.append(el("span", "nk-y-ai",
            (c.ten_nguoi || "Không rõ") + " (" + (c.vai || "—") + ") · " + (c.nhan || "Góp ý") + " · " +
            formatDateForDisplay(c.created_at, true)));
          liY.append(el("div", "nk-y-noi-dung", c.noi_dung || ""));
          ulY.append(liY);
        });
        li.append(ulY);
      } else {
        li.append(el("div", "nk-trong", "Chưa có ý kiến cho bản này."));
      }
      olBan.append(li);
    });
    content.append(olBan);
  }

  // ── 4 · Diễn biến theo thời gian (luồng + góp ý gộp lại, CŨ trước MỚI sau) ─────────────────
  content.append(el("h4", "nk-tieu-de", "4 · Diễn biến theo thời gian"));
  const banTheoId = new Map(ban.map((b) => [Number(b.id), b.version_no]));
  const dongThoiGian = [
    ...luong.map((g) => ({
      luc: g.created_at, ai: g.ten_nguoi, vai: g.vai,
      gi: NHAN_LUONG_FILE[g.hanh_dong] || g.hanh_dong,
      soBan: g.version_no ?? null, noi: g.noi_dung || "",
    })),
    ...gopY.map((c) => ({
      luc: c.created_at, ai: c.ten_nguoi, vai: c.vai, gi: "Góp ý",
      soBan: banTheoId.get(Number(c.version_id)) ?? null, noi: c.noi_dung || "",
    })),
  ].sort((a, b) => new Date(a.luc || 0) - new Date(b.luc || 0));
  if (!dongThoiGian.length) {
    content.append(el("p", "nk-trong", "Chưa có diễn biến nào được ghi."));
  } else {
    const olTg = el("ol", "nk-dong-thoi-gian");
    dongThoiGian.forEach((d) => {
      const li = el("li");
      li.append(el("span", "nk-tg-luc", formatDateForDisplay(d.luc, true)));
      li.append(el("span", "nk-tg-gi", d.gi || ""));
      li.append(el("span", "nk-tg-ai",
        (d.ai || "Hệ thống") + (d.vai ? " (" + d.vai + ")" : "") +
        (d.soBan ? " · bản " + d.soBan : "")));
      if (d.noi) li.append(el("div", "nk-tg-noi", d.noi));
      olTg.append(li);
    });
    content.append(olTg);
  }

  const chan = document.createElement("footer");
  chan.append(nut("btn-secondary", "Đóng", () => tatNhatKyFile()));
  panel.append(content, chan);
  overlay.append(panel);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) tatNhatKyFile();
  });
  const bamPhim = (event) => {
    if (event.key === "Escape") tatNhatKyFile();
  };
  function tatNhatKyFile() {
    document.removeEventListener("keydown", bamPhim);
    overlay.remove();
  }
  document.getElementById("nhat-ky-file-dialog")?.remove();
  document.addEventListener("keydown", bamPhim);
  document.body.append(overlay);
}
/** BẢNG LUỒNG: Thời điểm · Người (vai) · Hành động · Bản · Nội dung — mới nhất trên đầu. */
function buildBangLuongFile(n) {
  const luong = Array.isArray(n.luong) ? n.luong : [];
  if (luong.length === 0) return "";
  const dong = luong
    .map((g) =>
      "<tr>" +
      "<td class=\"px-3 py-2 whitespace-nowrap text-gray-500\">" + escapeHtml(formatDateForDisplay(g.created_at, true)) + "</td>" +
      "<td class=\"px-3 py-2\">" + escapeHtml(g.ten_nguoi) + " <span class=\"text-gray-400\">(" + escapeHtml(g.vai) + ")</span></td>" +
      "<td class=\"px-3 py-2\"><span class=\"font-medium text-gray-800\">" + escapeHtml(NHAN_LUONG_FILE[g.hanh_dong] || g.hanh_dong) + "</span></td>" +
      "<td class=\"px-3 py-2 text-gray-600\">" + (g.version_no ? "bản " + escapeHtml(g.version_no) : "—") + "</td>" +
      "<td class=\"px-3 py-2 text-gray-600\">" + escapeHtml(g.noi_dung || "") + "</td>" +
      "</tr>"
    )
    .join("");
  // ĐỢT 5: bảng luồng nằm TRONG khung «Lịch sử» của cùng trang Chỉnh sửa nhiệm vụ nên tiêu đề cột
  // cũng căn giữa cho nhất quán — để căn trái cạnh bảng chính đã căn giữa là lệch mắt.
  const buildO = (t) => "<th class=\"px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase\">" + escapeHtml(t) + "</th>";
  return (
    "<div class=\"mt-3 overflow-x-auto\"><table class=\"min-w-full text-xs\"><thead class=\"bg-gray-50\"><tr>" +
    buildO("Thời điểm") + buildO("Người (vai)") + buildO("Hành động") + buildO("Bản") + buildO("Nội dung") +
    "</tr></thead><tbody class=\"divide-y divide-gray-100\">" + dong + "</tbody></table></div>"
  );
}
/** BẢN (v1, v2…) + GÓP Ý thread theo bản (ô nhập «Ý kiến» nằm ở khung trên — guiYKien). */
function buildBanFileList(n) {
  const bans = Array.isArray(n.bans) ? n.bans : [];
  const gopY = Array.isArray(n.gopY) ? n.gopY : [];
  return bans
    .map((b) => {
      const cuaBan = gopY.filter((c) => Number(c.version_id) === Number(b.id));
      const thread = cuaBan.length
        ? cuaBan
            .map(
              (c) =>
                "<div class=\"ml-4 border-l-2 border-gray-100 pl-3 py-1 text-xs\">" +
                "<span class=\"font-medium text-gray-700\">" + escapeHtml(c.ten_nguoi) + "</span> " +
                "<span class=\"text-gray-400\">(" + escapeHtml(c.vai) + ")</span> · " +
                "<span class=\"text-gray-400\">" + escapeHtml(formatDateForDisplay(c.created_at, true)) + "</span>" +
                "<div class=\"text-gray-600\">" + escapeHtml(c.noi_dung) + "</div></div>"
            )
            .join("")
        : "<div class=\"ml-4 pl-3 text-xs text-gray-400\">Chưa có góp ý cho bản này.</div>";
      return (
        "<div class=\"border-t border-gray-50 pt-2 mt-2\">" +
        "<div class=\"flex items-center gap-2 text-sm\">" +
        "<span class=\"font-semibold text-gray-800\">bản " + escapeHtml(b.version_no) + "</span>" +
        "<span class=\"text-gray-500\">" + escapeHtml(b.ten_nguoi_nop) + " · " + escapeHtml(formatDateForDisplay(b.uploaded_at, true)) + "</span>" +
        "<button type=\"button\" class=\"text-blue-600 hover:underline text-xs\" onclick=\"" +
        "taiFileKetQua('" + escapeForInlineHandler(b.id) + "')\">⬇ tải</button>" +
        (xemInlineDuoc(b)
          ? "<button type=\"button\" class=\"text-blue-600 hover:underline text-xs\" onclick=\"" +
            "xemFileKetQua('" + escapeForInlineHandler(b.id) + "')\">👁 xem</button>"
          : "") +
        "</div>" + thread + "</div>"
      );
    })
    .join("");
}
// ── TÌNH TRẠNG VÀ NGƯỜI CỦA TỪNG BẢN (12/09/2026) ───────────────────────────────────────────────
// Nguồn dữ liệu là `n.luong` máy chủ đã gửi kèm nhóm (`listLuongByFile`, MỚI→CŨ theo id) lọc theo
// `version_id`, nên không cần gọi thêm API nào. Hai hàm dưới lấp đúng hai cột mà người dùng chỉ ra:
// «ở cột Tình trạng file kết quả, ghi ở từng bản tình trạng, ví dụ bị trả về hoặc tp/pp sửa trực
// tiếp, PGĐ/GĐ sửa trực tiếp, lưu ý thêm tên vào nhé» và «phần Người thực hiện sẽ là người duyệt
// hoặc người sửa đối với các bản sau, chỉ hiển thị Người thực hiện trực tiếp nếu trực tiếp sửa lại
// bản bị trả về hoặc tải lên lần đầu».
function vaiNgan(vai) {
  return NHAN_VAI_NGAN[vai] || hienThiVai(vai) || "—";
}
/** Mọi dòng luồng ghi cho ĐÚNG bản này, vẫn theo thứ tự MỚI→CŨ của máy chủ. */
function luongCuaBan(n, b) {
  const luong = Array.isArray(n && n.luong) ? n.luong : [];
  if (!b || b.id == null) return [];
  return luong.filter((g) => String(g.version_id) === String(b.id));
}
/**
 * Bản ngay TRƯỚC bản này có bị trả về không — một nửa điều kiện để cột «Người thực hiện» được ghi
 * «Người thực hiện trực tiếp». `n.bans` về theo `version_no` tăng dần nên `chiSo` là đúng thứ tự bản.
 * Chỉ xét hai mã đang sống: migration 029 đã viết lại `yeu-cau-sua` thành `tra-ve-cbo` và CHECK của
 * `task_file_flow` không còn nhận mã cũ.
 */
function banTruocBiTraVe(n, chiSo) {
  const bans = Array.isArray(n && n.bans) ? n.bans : [];
  const truoc = chiSo > 0 ? bans[chiSo - 1] : null;
  if (!truoc) return false;
  return luongCuaBan(n, truoc).some((g) => ["tra-ve-cbo", "tra-ve-tp"].includes(g.hanh_dong));
}
/**
 * AI tạo ra bản này và họ tạo bằng cách nào. Tên lấy từ dòng luồng để khớp với vai ghi trên cùng
 * dòng; thiếu thì lùi về `ten_nguoi_nop` của bản (dòng lịch sử cũ ghi trước khi có luồng theo bản).
 */
function nguoiTaoBan(n, b) {
  const cac = luongCuaBan(n, b).filter((g) => HANH_DONG_TAO_BAN.includes(g.hanh_dong));
  // Danh sách là MỚI→CŨ nên phần tử CUỐI là dòng ghi lúc bản ra đời.
  const dau = cac.length > 0 ? cac[cac.length - 1] : null;
  return {
    ten: (dau && dau.ten_nguoi) || (b && b.ten_nguoi_nop) || "",
    vai: (dau && dau.vai) || "",
    suaTrucTiep: Boolean(dau) && dau.hanh_dong === "sua-truc-tuyen",
  };
}
/**
 * Cột «Tình trạng» của MỘT BẢN: dòng luồng CÓ Ý NGHĨA mới nhất thắng, luôn kèm TÊN người làm.
 * Không có dòng nào (bản vừa tải lên, chưa ai đụng) thì kể đúng việc vừa xảy ra.
 * Trả về `{ nhan, mau }` — `mau` là cặp lớp Tailwind cùng kiểu với `MAU_TRANG_THAI_FILE`.
 */
function tinhTrangMotBan(n, b, chiSo) {
  const moc = luongCuaBan(n, b).find((g) => TINH_TRANG_BAN[g.hanh_dong]);
  if (moc) {
    const luat = TINH_TRANG_BAN[moc.hanh_dong];
    const dau = luat.vai ? vaiNgan(moc.vai) + " " + luat.nhan : luat.nhan;
    return { nhan: dau + (moc.ten_nguoi ? " — " + moc.ten_nguoi : ""), mau: luat.mau };
  }
  const tao = nguoiTaoBan(n, b);
  const dau =
    chiSo === 0
      ? "Tải lên lần đầu"
      : banTruocBiTraVe(n, chiSo)
        ? "Sửa lại bản bị trả về"
        : "Nộp lại";
  return {
    nhan: dau + (tao.ten ? " — " + tao.ten : ""),
    mau: "bg-slate-100 text-slate-600",
  };
}
/**
 * Cột «Người thực hiện» của MỘT BẢN. «Người thực hiện trực tiếp» CHỈ hiện khi đúng người được giao
 * nhiệm vụ (`n.assignee_id`) tải lên LẦN ĐẦU hoặc trực tiếp nộp lại BẢN BỊ TRẢ VỀ; còn lại là người
 * duyệt/người sửa, kèm vai viết tắt để phân biệt TP/PP với PGĐ/GĐ.
 */
function nguoiThucHienCuaBan(n, b, chiSo) {
  const tao = nguoiTaoBan(n, b);
  const dungNguoiGiao =
    n && n.assignee_id != null && b && String(b.uploaded_by) === String(n.assignee_id);
  if (dungNguoiGiao && (chiSo === 0 || banTruocBiTraVe(n, chiSo))) {
    return {
      nhan: "Người thực hiện trực tiếp",
      chu: chiSo === 0 ? "Tải lên bản đầu tiên" : "Trực tiếp sửa lại bản bị trả về",
      ten: tao.ten,
    };
  }
  if (tao.suaTrucTiep) {
    return { nhan: vaiNgan(tao.vai) + " sửa trực tiếp", chu: "Sửa ngay trong OnlyOffice, lưu thành bản mới", ten: tao.ten };
  }
  if (chiSo === 0) {
    return {
      nhan: vaiNgan(tao.vai) + " nộp thay",
      chu: "Dữ liệu cũ: bản đầu do người không được giao nhiệm vụ nộp. Nay máy chủ chỉ cho chính người thực hiện nộp bản đầu.",
      ten: tao.ten,
    };
  }
  return { nhan: vaiNgan(tao.vai) + " sửa", chu: "Người duyệt hoặc người sửa nộp bản này", ten: tao.ten };
}
/**
 * DÒNG CON của bảng «Kết quả»: mỗi BẢN là một dòng 1.1, 1.2 … kèm chữ «Sửa lần N» (sheet «kq-modal»
 * dòng 5: «đây là liệt kê các lần file đã sửa, ghi thêm chữ "Sửa lần …" đằng sau tên ban đầu»).
 *
 * THU GỌN mặc định (người dùng chốt 2026-09-03): dòng cha ghi «N bản», bấm ▸ mới bung — nhiệm vụ
 * nộp nhiều lần thì bảng không dài ra vô hạn.
 *
 * `soCha` = số thứ tự dòng cha (1, 2, 3…) để đánh 1.1 / 1.2; góp ý của ĐÚNG bản đó hiện ở cột
 * «Ghi ý kiến» — không trộn góp ý của bản khác vào.
 */
function buildDongBanKetQua(n, b, chiSo, soCha, ma = "") {
  // ĐỢT 5 (2026-09-11): ô «Ghi ý kiến» của dòng bản cũng chỉ còn CHỮ «Xem ý kiến» mở POPUP, nhưng
  // truyền `banId` = id của ĐÚNG bản này ⇒ popup chỉ in ý kiến của bản đó («click vào đấy sẽ hiển thị
  // popup xem ý kiến của bản đấy»). Vẫn ĐẾM theo danh sách GỘP (`yKienCuaBan` → `danhSachYKien`) để
  // con số kể cả LÝ DO mỗi lần yêu cầu sửa / trả về, không chỉ những câu gõ tay ở nút «Gửi ý kiến».
  const soY = yKienCuaBan(n, b).length;
  const nutY = soY > 0 ? "Xem ý kiến (" + soY + ")" : "Xem ý kiến";
  // Bản «Báo cáo» không có file ⇒ không có gì để tải/xem; nội dung đã in ngay ở cột 4 của dòng này.
  const muc = laBanBaoCaoKq(b)
    ? []
    : [buildMucMenuKq("fa-download", "Tải bản này", "taiFileKetQua('" + escapeForInlineHandler(b.id) + "')")];
  if (!laBanBaoCaoKq(b) && xemInlineDuoc(b)) {
    muc.push(buildMucMenuKq("fa-eye", "Xem trên trình duyệt", "xemFileKetQua('" + escapeForInlineHandler(b.id) + "')"));
  }
  // «Sửa lần N»: bản 1 là bản đầu tiên nên không phải lần sửa nào.
  const nhanSua = chiSo === 0 ? "" : " — Sửa lần " + chiSo;
  // Hai cột theo TỪNG BẢN (12/09/2026) — xem `tinhTrangMotBan` / `nguoiThucHienCuaBan` ở trên.
  const ttBan = tinhTrangMotBan(n, b, chiSo);
  const nguoiBan = nguoiThucHienCuaBan(n, b, chiSo);
  const chuNguoiBan = nguoiBan.nhan + (nguoiBan.ten ? " — " + nguoiBan.ten : "") + ". " + nguoiBan.chu;
  return (
    "<tr class=\"dong-ban-kq hidden\" data-ban=\"" + escapeHtmlAttr(b.id) + "\" data-nhom=\"" + escapeHtmlAttr(n.id) + "\">" +
    "<td class=\"px-3 py-2 text-xs text-gray-500 whitespace-nowrap\">" + escapeHtml(formatDateForDisplay(b.uploaded_at, true)) + "</td>" +
    "<td class=\"px-3 py-2 text-xs pl-8\">" +
    "<span class=\"text-gray-400 mr-1\">" + escapeHtml(soCha + "." + (chiSo + 1)) + "</span>" +
    "<span class=\"text-gray-700\">" + escapeHtml(n.ten_ket_qua || n.ten_goc) + escapeHtml(nhanSua) + "</span></td>" +
    "<td class=\"px-3 py-2 text-xs text-gray-500\">" +
    escapeHtml(laBanBaoCaoKq(b) ? DINH_DANG_BAO_CAO : dinhDangCuaTen(b.ten_goc || n.ten_goc)) + "</td>" +
    "<td class=\"px-3 py-2 text-xs\">" +
    (laBanBaoCaoKq(b)
      ? "<div class=\"text-gray-600 whitespace-pre-line line-clamp-3\" title=\"Nội dung báo cáo bản này\">" + escapeHtml(b.noi_dung || "") + "</div>"
      : "<button type=\"button\" class=\"text-blue-600 hover:underline\" title=\"Tải bản này\" onclick=\"taiFileKetQua('" +
        escapeForInlineHandler(b.id) + "')\">" + escapeHtml(b.ten_goc || n.ten_goc) + "</button>") +
    "<div class=\"text-gray-400\">bản " + escapeHtml(b.version_no) + "</div></td>" +
    // Tỷ lệ + Tiến độ của dòng bản để «—» (tỷ lệ gắn theo NHÓM, không theo từng bản) nhưng vẫn CĂN
    // GIỮA cho thẳng với tiêu đề cột nay đã căn giữa (đợt 5).
    "<td class=\"px-2 py-2 text-center kq-o-ty-le\">—</td><td class=\"px-2 py-2 text-center kq-o-tien-do\">—</td>" +
    // 7. Người thực hiện — NHÃN + TÊN. Nhãn «Người thực hiện trực tiếp» chỉ dành cho đúng người
    // được giao nhiệm vụ khi họ tải lên lần đầu hoặc trực tiếp sửa bản bị trả về; bản sau là của
    // người duyệt/người sửa (kèm vai viết tắt). Tên đẩy vào `title` để ô không phình khi tên dài.
    "<td class=\"px-3 py-2 text-xs text-gray-600 text-center kq-o-nguoi\" title=\"" + escapeHtmlAttr(chuNguoiBan) + "\">" +
    "<div class=\"font-medium text-gray-700\">" + escapeHtml(nguoiBan.nhan) + "</div>" +
    "<div class=\"text-gray-500\">" + escapeHtml(nguoiBan.ten) + "</div></td>" +
    "<td class=\"px-3 py-2 text-center kq-o-y-kien\"><div class=\"kq-y-kien-nut\">" +
    "<button type=\"button\" title=\"Mở popup xem ý kiến của đúng bản này\" class=\"text-blue-600 hover:underline text-xs font-medium\" onclick=\"moYKienKetQua('" + escapeForInlineHandler(ma) + "', '" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(b.id) + "')\">" + escapeHtml(nutY) + "</button>" +
    "</div></td>" +
    // 9. Tình trạng CỦA BẢN NÀY (ô này trước đây để TRỐNG): «Bị trả về — Nguyễn Văn A»,
    // «TP/PP sửa trực tiếp — Trần Thị B», «PGĐ/GĐ đã duyệt — …». Badge cùng kiểu với dòng cha để
    // hai cấp đọc bằng một ngôn ngữ màu; dòng cha vẫn kể tình trạng của CẢ NHÓM (`cauTinhTrangFile`).
    "<td class=\"px-3 py-2 text-center\">" +
    "<span class=\"text-[11px] px-2 py-0.5 rounded-full inline-block " + escapeHtmlAttr(ttBan.mau) + "\" title=\"" + escapeHtmlAttr(ttBan.nhan) + "\">" +
    escapeHtml(ttBan.nhan) + "</span></td>" +
    "<td class=\"px-3 py-2 text-right\">" + buildMenuHanhDongKq("ban-" + b.id, muc) + "</td>" +
    "</tr>"
  );
}
/**
 * MỘT DÒNG CHA của bảng «Kết quả» (thiết kế mới theo sheet «kq-modal», thêm hai cột tỷ lệ/tiến độ):
 * Thời gian · Kết quả làm được · Định dạng · File đã tải lên · Người thực hiện · Ghi ý kiến ·
 * Tình trạng · Hành động.
 *
 * Trả về NHIỀU `<tr>`: dòng cha (1., 2., 3.) → các dòng bản 1.1/1.2 (ẩn, bấm ▸ mới bung) → một
 * dòng `colspan=10` giữ hai khung «Ý kiến» và «Lịch sử». `soCha` = số thứ tự dòng trong bảng.
 */
/** V2: tỷ lệ và tiến độ ở ngay tên nhóm, giữ bảng mười cột của đợt 8b.
 *  Đợt 4 (2026-09-10): ô HẸP lại nên input và nút «Lưu tỷ lệ» XẾP DỌC — bề rộng thật do `app.css`
 *  quyết (`.kq-o-ty-le-nhap`), không dùng `w-20` của Tailwind vì cột nay hẹp hơn 5rem. */
function buildTyLeFile(n, ma) {
  return '<div class="text-xs kq-o-ty-le-trong"><input aria-label="Tỷ lệ công việc (%)" type="number" min="0" max="100" step="1" required class="form-input kq-o-ty-le-nhap" data-ty-le-file="' + escapeHtmlAttr(n.id) + '" value="' + escapeHtmlAttr(Number(n.ty_le) || 0) + '"' + (n.duocSuaTyLe === true ? '' : ' disabled') + '>' +
    (n.duocSuaTyLe === true ? '<button type="button" data-luu-ty-le-file="1" class="text-blue-600 kq-nut-luu-ty-le" data-file-id="' + escapeHtmlAttr(n.id) + '" data-ma="' + escapeHtmlAttr(ma) + '" onclick="luuTyLeFile(this.dataset.fileId, this.dataset.ma)">Lưu tỷ lệ</button>' : '') + '</div>';
}
async function luuTyLeFile(fileId, ma) {
  const input = [...document.querySelectorAll('[data-ty-le-file]')].find(o => String(o.dataset.tyLeFile) === String(fileId));
  if (!input || input.disabled || input.dataset.dangLuu === '1') return;
  if (!input.reportValidity() || !Number.isInteger(Number(input.value)) || !input.value.trim()) {
    showToast('Tỷ lệ công việc của file phải là số nguyên từ 0 đến 100', 'error'); return;
  }
  const tyLe = Number(input.value);
  input.dataset.dangLuu = '1';
  try {
    const latest = await restGet('/api/v1/work-items/' + encodeURIComponent(ma) + '/files');
    if (!latest?.nhom || !input.isConnected) return;
    const tong = latest.nhom.reduce((sum, n) => sum + (String(n.id) === String(fileId) ? tyLe : Number(n.ty_le) || 0), 0);
    if (tong !== 100) {
      const agreed = await new Promise(resolve => {
        const dialog = hopThoai8b('Tổng tỷ lệ file khác 100%', 'Tổng mới: ' + tong + '% — bạn có thể sửa lại hoặc vẫn lưu. Tiến độ được chia cho tổng tỷ lệ thực tế.');
        dialog.actions.append(taoNut8b('Sửa lại', () => { dialog.close(); resolve(false); }), taoNut8b('Vẫn lưu', () => { dialog.close(); resolve(true); }, true));
        dialog.actions.firstElementChild.focus();
      });
      if (!agreed || !input.isConnected) return;
    }
    const result = await restGhi('PATCH', '/api/v1/task-files/' + encodeURIComponent(fileId) + '/ty-le', { tyLe });
    if (!result.ok) { showToast(result.error, 'error'); return; }
    // ĐỢT B (R4''): cây ĐÃ duyệt thì máy chủ không đổi `ty_le` ngay — nó lập MỘT ĐỀ NGHỊ trong
    // `approval_changes` và trả về `pending = true` cùng GIÁ TRỊ CŨ trong `nhom.ty_le`. Nói «đã lưu»
    // ở nhánh này là nói dối: con số trong ô vẫn y nguyên tới khi Ban lãnh đạo kiểm soát ký.
    const deNghi = result.data.tyLeChange?.pending === true;
    showToast(deNghi
      ? 'Đã trình đề nghị đổi tỷ lệ file lên Ban lãnh đạo kiểm soát. Tỷ lệ vẫn là ' + (Number(result.data.nhom?.ty_le) || 0) + '% cho tới khi được duyệt.'
      : 'Đã lưu tỷ lệ file. Tổng hiện tại: ' + result.data.tongTyLe + '%', 'success');
    await napKetQua(ma);
    await refreshData();
  } finally { delete input.dataset.dangLuu; }
}
function buildKhoiFile(n, ma, soCha) {
  const bans = Array.isArray(n.bans) ? n.bans : [];
  const banCuoi = bans.length > 0 ? bans[bans.length - 1] : null;
  const so = Number(soCha) > 0 ? Number(soCha) : 1;
  const muc = [];
  // Dòng «Báo cáo» (016) là CHỮ, không có file: không mời tải lên, không mời tải về, không ✎ — ô
  // nhập nội dung nằm ngay trong cột «Hành động» bên dưới menu.
  const laBaoCao = laDongBaoCao(n);
  if (n.duocGuiDuyet === true && banCuoi) {
    muc.push(
      buildMucMenuKq("fa-paper-plane", "Gửi đi duyệt", "guiDiDuyetFile('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(ma) + "', '" + escapeForInlineHandler(banCuoi.id) + "')")
    );
  }
  // «Tải lên (với trường hợp chưa có file)» — sheet gộp phần tải file vào chính bảng kết quả.
  if (coTheNopFile(n, ma) && !laBaoCao) {
    muc.push(
      buildMucMenuKq("fa-upload", banCuoi ? "Nộp bản mới" : "Tải lên", "moChonFileKetQua('" + escapeForInlineHandler(n.id) + "')")
    );
  }
  if (banCuoi && !laBaoCao) {
    muc.push(buildMucMenuKq("fa-download", "Tải bản mới nhất", "taiFileKetQua('" + escapeForInlineHandler(banCuoi.id) + "')"));
    if (xemInlineDuoc(banCuoi)) {
      muc.push(buildMucMenuKq("fa-eye", "Xem ngay trong trình duyệt (PDF và ảnh)", "xemFileKetQua('" + escapeForInlineHandler(banCuoi.id) + "')"));
    }
    // ✎ sửa trực tuyến (ONLYOFFICE) — mỗi lần lưu ở editor thành BẢN MỚI của nhóm này. Ảnh không
    // có bộ soạn thảo nào trong DS nên ẩn mục, khỏi mở ra một trang editor lỗi.
    if (dsBat && suaTrucTuyenDuoc(banCuoi.ten_goc || n.ten_goc)) {
      muc.push(
        "<a href=\"" + escapeHtmlAttr(safeUrl("/api/v1/task-file-versions/" + banCuoi.id)) + "/editor\" target=\"_blank\" title=\"Sửa trực tuyến (ONLYOFFICE) — lưu là thành bản mới\" class=\"kq-menu-muc\"><i class=\"fas fa-pen-to-square mr-2 w-4 text-center\"></i>Sửa trực tuyến</a>"
      );
    }
  }
  dsVerdictFile(n).forEach((v) => {
    muc.push(
      buildMucMenuKq(
        v.laChot ? "fa-check" : "fa-reply",
        v.nhan,
        "xuLyVerdictFile('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(v.hanhDong) + "', " +
          (v.canNoiDung ? "true" : "false") + ", '" + escapeForInlineHandler(ma) + "')",
        v.laChot
      )
    );
  });
  if (
    (isAdmin() || (currentUser && Number(n.created_by) === Number(currentUser.id))) &&
    n.trang_thai !== "da-duyet"
  ) {
    muc.push(
      buildMucMenuKq(
        "fa-trash",
        "Xoá kết quả này (người tạo + Giám đốc, chưa «Đã duyệt»)",
        "xoaKetQuaFile('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(ma) + "')"
      )
    );
  }
  // ĐẾM theo danh sách GỘP (góp ý + lý do mỗi lần sửa/trả về/từ chối) — xem `danhSachYKien`.
  const dsYKien = danhSachYKien(n);
  const nutYKien = dsYKien.length > 0 ? "Xem ý kiến (" + dsYKien.length + ")" : "Xem ý kiến";
  // Nhóm mới KHAI (0 bản) mà người xem KHÔNG phải người thực hiện trực tiếp thì mục «Tải lên» đã
  // biến mất (máy chủ tắt `duocSua`). Nói rõ ai nộp được — không có câu này thì ô «Hành động» trống
  // trơn và người dùng tưởng nút bị lỗi.
  const doiNguoiNop =
    bans.length === 0 && !laBaoCao && !coTheNopFile(n, ma)
      ? "<div class=\"text-xs text-gray-400 mt-1 text-left\" title=\"Bản kết quả ĐẦU TIÊN phải do chính người thực hiện trực tiếp nộp; TP/PP và PGĐ/GĐ chỉ sửa hoặc nộp từ bản thứ hai trở đi\">Bản đầu chỉ " +
        escapeHtml(n.ten_nguoi_thuc_hien ? "«" + n.ten_nguoi_thuc_hien + "»" : "người thực hiện trực tiếp") +
        " nộp được.</div>"
      : "";
  const dongBan = bans.map((b, i) => buildDongBanKetQua(n, b, i, so, ma)).join("");
  return (
    "<tr class=\"dong-kq-nhom\" data-file=\"" + escapeHtmlAttr(n.id) + "\" data-dinh-dang=\"" + escapeHtmlAttr(n.dinh_dang || "") + "\">" +
    // 1. Thời gian — tự ghi nhận lúc tạo, người dùng không phải điền (sheet dòng 4 cột 1).
    "<td class=\"px-3 py-2 text-xs text-gray-500 whitespace-nowrap\">" + escapeHtml(formatDateForDisplay(n.created_at, true)) + "</td>" +
    // 2. Kết quả làm được — TÊN KHAI của người dùng (016 `ten_ket_qua`); dòng cũ lùi về tên file.
    "<td class=\"px-3 py-2\">" +
    (bans.length > 0
      ? "<button type=\"button\" class=\"kq-nut-bung\" title=\"Ẩn/hiện các lần đã sửa\" onclick=\"batTatBanKq('" + escapeForInlineHandler(n.id) + "')\"><i class=\"fas fa-caret-right\"></i></button>"
      : "<span class=\"kq-nut-bung-trong\"></span>") +
    "<span class=\"text-gray-400 mr-1\">" + escapeHtml(so + ".") + "</span>" +
    "<span class=\"font-medium text-sm text-gray-800\">" + escapeHtml(n.ten_ket_qua || n.ten_goc) + "</span>" +
    (bans.length > 1 ? "<span class=\"text-xs text-gray-400 ml-2\">" + escapeHtml(bans.length) + " bản</span>" : "") +
    "</td>" +
    // 3. Định dạng — cột khai của 016, không có thì suy từ đuôi bản mới nhất như đợt 1.
    "<td class=\"px-3 py-2 text-xs text-gray-600\">" + buildIconDinhDang(dinhDangCuaNhom(n)) + escapeHtml(dinhDangCuaNhom(n)) + "</td>" +
    // 4. File đã tải lên — «Chưa có» khi chưa nộp bản nào (sheet dòng 4 cột 4). Bản «Báo cáo» không
    // có file để tải: ghi rõ là chữ, bấm «Lịch sử» để đọc nội dung từng bản.
    "<td class=\"px-3 py-2 text-xs\">" +
    (banCuoi
      ? (laBanBaoCaoKq(banCuoi)
          ? "<span class=\"text-gray-500\" title=\"Kết quả là nội dung chữ, không có file\">Báo cáo (nhập chữ)</span>"
          : "<button type=\"button\" class=\"text-blue-600 hover:underline text-left\" title=\"Tải file này\" onclick=\"taiFileKetQua('" + escapeForInlineHandler(banCuoi.id) + "')\">" + escapeHtml(banCuoi.ten_goc || n.ten_goc) + "</button>")
      : "<span class=\"text-gray-400\">Chưa có</span>") +
    "</td>" +
    // Tỷ lệ + Tiến độ: HẸP lại và CĂN GIỮA (đợt 4 — «Tỷ lệ công việc (%) Tiến độ, độ rộng bé đi…
    // sửa để cân đối hơn»). Bỏ `text-right`: căn phải trong cột hẹp đẩy cụm «input + Lưu tỷ lệ» tràn
    // sang cột bên. Bề rộng thật của hai cột nằm ở colgroup của `buildBangKetQua` + `app.css`.
    "<td class=\"px-2 py-2 kq-o-ty-le\">" + buildTyLeFile(n, ma) + "</td>" +
    "<td class=\"px-2 py-2 text-center whitespace-nowrap kq-o-tien-do\">" + escapeHtml(Number(n.tienDo) || 0) + "%</td>" +
    // 5. Người thực hiện — ĐỢT 5: CĂN GIỮA ô («Người thực hiện cũng sẽ căn giữa»), khớp với tab Nhiệm vụ.
    // 5. Người thực hiện — ĐỢT 5: CĂN GIỮA ô («Người thực hiện cũng sẽ căn giữa»), khớp với tab Nhiệm vụ.
    //    12/09/2026: dòng cha in NGƯỜI THỰC HIỆN TRỰC TIẾP của nhiệm vụ, không in `ten_nguoi_tao`
    //    nữa — kể từ Q1 nhóm có thể do TP/PP KHAI BÁO trước, nên tên người khai dưới cột «Người thực
    //    hiện» chính là thứ gây nhầm mà người dùng vừa báo. Ai đụng vào TỪNG BẢN thì dòng con 1.1/1.2
    //    bên dưới nói rõ (người duyệt hay người sửa). Chưa gán người thực hiện thì lùi về người khai.
    "<td class=\"px-3 py-2 text-xs text-gray-600 text-center kq-o-nguoi\" title=\"" +
    escapeHtmlAttr(n.ten_nguoi_thuc_hien ? "Người thực hiện trực tiếp của nhiệm vụ" : "Nhiệm vụ chưa gán người thực hiện trực tiếp — đây là người khai báo kết quả") +
    "\">" + escapeHtml(n.ten_nguoi_thuc_hien || n.ten_nguoi_tao) + "</td>" +
    // 6. Ghi ý kiến — ĐỢT 5 (2026-09-11): ô CHỈ CÒN CHỮ «Xem ý kiến» mở POPUP, không in nội dung tại
    //    chỗ nữa. Người dùng: «phần ghi ý kiến sẽ là hiển thị chữ "xem ý kiến", click vào đấy sẽ hiển thị
    //    popup xem ý kiến của bản đấy, còn bản đầu 1. đấy sẽ xem tất cả» ⇒ dòng cha (1.) truyền `banId`
    //    RỖNG để popup in TẤT CẢ. Ô NHẬP dời theo popup (`buildONhapYKien`) — cột tên «Ghi ý kiến» nên
    //    đọc và viết phải ở cùng một chỗ. Số trong ngoặc vẫn ĐẾM theo danh sách GỘP (`danhSachYKien`).
    "<td class=\"px-3 py-2 text-center kq-o-y-kien\">" +
    "<div class=\"kq-y-kien-nut\">" +
    "<button type=\"button\" title=\"Mở popup xem toàn bộ ý kiến của kết quả này\" class=\"text-blue-600 hover:underline text-xs font-medium\" onclick=\"moYKienKetQua('" + escapeForInlineHandler(ma) + "', '" + escapeForInlineHandler(n.id) + "', '')\">" + escapeHtml(nutYKien) + "</button>" +
    "<button type=\"button\" title=\"Ẩn/hiện lịch sử các lần chỉnh sửa\" class=\"text-gray-500 hover:text-gray-700 text-xs ml-2\" onclick=\"batTatKetQua('" + escapeForInlineHandler(n.id) + "', 'ls')\"><i class=\"fas fa-clock-rotate-left mr-1\"></i>Lịch sử</button>" +
    "</div>" +
    "</td>" +
    // 7. Tình trạng — badge + CÂU KỂ (sheet đòi đọc được «đang đợi ai, trả lại lần mấy»).
    "<td class=\"px-3 py-2\">" +
    "<span class=\"text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap " + escapeHtmlAttr(MAU_TRANG_THAI_FILE[n.trang_thai] || "bg-gray-100 text-gray-600") + "\">" +
    escapeHtml(NHAN_TRANG_THAI_FILE[n.trang_thai] || n.trang_thai) + "</span>" +
    "<div class=\"text-xs text-gray-500 mt-1\">" + escapeHtml(cauTinhTrangFile(n)) + "</div></td>" +
    // 8. Hành động — MỘT menu, đúng câu chú trong sheet; dòng «Báo cáo» thêm ô nhập chữ (016) vì
    // kết quả của nó KHÔNG phải file: nhập rồi bấm Nộp là thành BẢN MỚI, đi đúng luồng duyệt cũ.
    "<td class=\"px-3 py-2 text-right\">" + buildMenuHanhDongKq("kq-" + n.id, muc) +
    (laBaoCao && coTheNopFile(n, ma) ? buildONhapBaoCao(n, ma) : "") + doiNguoiNop + "</td>" +
    "</tr>" +
    dongBan +
    // ĐỢT 5: khung «Ý kiến» ẩn dưới bảng ĐÃ BỎ — nội dung và ô nhập dời hết vào popup
    // `moYKienKetQua`. Chỉ còn khung «Lịch sử» (bảng các bản + bảng luồng).
    "<tr class=\"dong-kq-panel\"><td colspan=\"10\" class=\"px-3 pb-2 pt-0\">" +
    "<div id=\"task-kq-ls-" + escapeHtmlAttr(n.id) + "\" class=\"hidden mt-2 border-t border-gray-50 pt-2\">" +
      buildBanFileList(n) +
      buildBangLuongFile(n) +
    "</div>" +
    "</td></tr>"
  );
}
/**
 * Ẩn/hiện các DÒNG BẢN (1.1, 1.2 …) của một kết quả — THU GỌN mặc định (người dùng chốt
 * 2026-09-03: «bấm ▸ mới bung»). Đổi luôn hướng mũi tên để nhìn ra dòng nào đang mở.
 *
 * Chọn dòng bằng `data-nhom` chứ không bằng thứ tự DOM: giữa dòng cha và dòng bản còn dòng panel,
 * và một bảng có nhiều kết quả nên đếm theo vị trí là sai ngay khi thêm dòng.
 */
function batTatBanKq(fileId) {
  const khoa = String(fileId == null ? "" : fileId).replace(/["\\]/g, "");
  const dong = document.querySelectorAll(".dong-ban-kq[data-nhom=\"" + khoa + "\"]");
  if (dong.length === 0) return;
  const dangAn = dong[0].classList.contains("hidden");
  dong.forEach((tr) => tr.classList.toggle("hidden", !dangAn));
  const icon = document.querySelector(".dong-kq-nhom[data-file=\"" + khoa + "\"] .kq-nut-bung i");
  if (icon) {
    icon.classList.toggle("fa-caret-right", !dangAn);
    icon.classList.toggle("fa-caret-down", dangAn);
  }
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
        supBox = document.getElementById("project-supervisors-box"),
        supInput = document.getElementById("project-supervisors-input"),
        leadBox = document.getElementById("project-leaders-box"),
        leadInput = document.getElementById("project-leaders-input");
      if (deptSel && supBox && supInput && leadBox && leadInput) {
        // ĐỢT A (028): đọc `supervisorIds` (mảng) thay cho `supervisorId` (một người). Cầu RPC vẫn
        // trả khoá đơn `supervisorId` = người ĐẦU để client cũ không vỡ, nhưng form nay cần cả danh
        // sách — điền sẵn một người rồi bấm Lưu là âm thầm XOÁ những người còn lại.
        const supGoc = isEdit && project ? project.supervisorIds || [] : [],
          leadGoc = isEdit && project ? project.leaderIds || [] : [];
        let lanDau = true;
        const napPhanCong = function () {
          napUngVienPhanCong({ deptValue: deptSel.value, supervisorsBox: supBox, supervisorsInput: supInput, leadersBox: leadBox, leadersInput: leadInput, selectedSupervisors: lanDau ? supGoc : null, selectedLeaders: lanDau ? leadGoc : [], applyDefault: !isEdit && currentUser?.role !== "Nhân viên" }).then(() => {
            khoaPhanCongVoiNhanVien(null, leadBox, null, supBox);
            if (currentUser?.role === "Nhân viên") leadInput.disabled = true;
          });
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
    }, 250), "\n  <div id=\"project-modal\" class=\"modal\">\n      <div class=\"modal-content\">\n          <div class=\"flex items-center justify-between mb-6\">\n              <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(text) + "</h3>\n              <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n                  <i class=\"fas fa-times\"></i>\n              </button>\n          </div>\n          \n          " + (isEdit ? buildThanhTabNhatKy("project", thangSuaDuocCuaDauViec(project[COL.P_START], project[COL.P_END]).length > 0) : "") + "\n          <form id=\"project-form\">\n              " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + escapeHtml(project[COL.P_ID]) + "\">" : "") + "\n              \n              <div class=\"form-group\">\n                  <label class=\"form-label required\">Tên công việc</label>\n                  <input type=\"text\" name=\"name\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(project[COL.P_NAME]) || "" : "") + "\" " + (isEdit && !coQuyenTaiDong("update", "project", project) ? "disabled" : "") + ">\n\n              </div>\n              \n              <div class=\"form-group\">\n                  <label class=\"form-label\">Mô tả</label>\n                  <textarea name=\"description\" class=\"form-textarea\" " + (isEdit && !coQuyenTaiDong("update", "project", project) ? "disabled" : "") + ">" + (isEdit ? escapeHtml(project[COL.P_DESC]) || "" : "") + "</textarea>\n              </div>\n              \n              \n              \n              <div class=\"form-group\">\n                  <label class=\"form-label\">Phòng</label>\n                  <select name=\"departmentId\" id=\"project-dept-select\" class=\"form-select\">\n                      " + buildDeptIdOptions(isEdit && project ? project[COL.P_DEPT_ID] : "") + "\n                  </select>\n              </div>\n              <div class=\"form-group\">\n                  <label class=\"form-label\">Ban lãnh đạo kiểm soát</label>\n                  <div id=\"project-supervisors-box\" class=\"flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[42px] items-center\"></div>\n                  <input type=\"hidden\" name=\"supervisorIds\" id=\"project-supervisors-input\" value=\"" + (isEdit && project ? (project.supervisorIds || []).join(",") : "") + "\">\n                  <p class=\"text-xs text-gray-500 mt-1\"><i class=\"fas fa-info-circle mr-1\"></i>Chỉ người có tên ở đây mới duyệt được công việc này — kể cả Giám đốc. Công việc con chỉ chọn được trong danh sách này; nhiệm vụ chọn đúng một người trong danh sách của công việc con.</p>\n              </div>\n              <div class=\"form-group\">\n                  <label class=\"form-label\">Lãnh đạo phòng phụ trách</label>\n                  <div id=\"project-leaders-box\" class=\"flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[42px] items-center\"></div>\n                  <input type=\"hidden\" name=\"leaderIds\" id=\"project-leaders-input\" value=\"" + (isEdit && project ? (project.leaderIds || []).join(",") : "") + "\">\n              </div>\n              <div class=\"grid grid-cols-3 gap-4\">\n                  <div class=\"form-group\">\n                      <label class=\"form-label required\">Ngày bắt đầu</label>\n                      <input type=\"date\" name=\"startDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(project[COL.P_START])) : "") + "\" " + (isEdit && !coQuyenTaiDong("update", "project", project) ? "disabled" : "") + ">\n                  </div>\n                  <div class=\"form-group\">\n                      <label class=\"form-label required\">Ngày kết thúc</label>\n                      <input type=\"date\" name=\"endDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(project[COL.P_END])) : "") + "\" " + (isEdit && !coQuyenTaiDong("update", "project", project) ? "disabled" : "") + ">\n                  </div>\n                  \n              </div>              \n              \n              <div class=\"flex justify-end space-x-3 mt-6\">\n                  <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n                  " + buildLuuNhapNutHtml(isEdit) + "\n                  <button type=\"submit\" " + (!isEdit ? "data-gui-duyet=\"1\" " : "") + "class=\"btn-primary\">" + escapeHtml(isEdit ? text2 : "Gửi đi duyệt") + "</button>\n              </div>\n          </form>\n          " + (isEdit ? buildKhungNhatKy("project", project[COL.P_ID]) + buildKhungTenThang("project", project[COL.P_ID]) : "") + "\n      </div>\n  </div>\n";
}
/**
 * Ba vai được đứng ở ô «Người thực hiện trực tiếp» của NHIỆM VỤ (cấp 3).
 * Phó Giám đốc và admin KHÔNG có ở đây: họ thuộc lớp «Ban lãnh đạo kiểm soát» (`supervisor_ids`),
 * đưa họ xuống ô này là trộn hai lớp phân công (§0.1). Máy chủ giữ cùng danh sách trong
 * `assignments.VAI_LANH_DAO_LAM_TRUC_TIEP` — hai nơi phải đổi cùng lúc.
 */
const VAI_LAM_TRUC_TIEP = Object.freeze(["Nhân viên", "Trưởng phòng", "Phó phòng"]);
function createTaskModal(isEdit, task) {
  const draft = isEdit ? null : pendingTaskCreate;
  if (!isEdit) pendingTaskCreate = null;
  const createLevel = !isEdit && draft && Number(draft.level) === 2 ? 2 : 3,
    createParent = !isEdit && draft && draft.parentId ? String(draft.parentId) : "",
    createProject = !isEdit && draft && draft.projectId ? String(draft.projectId) : "",
    text = isEdit ? "Chỉnh sửa nhiệm vụ" : createLevel === 2 ? "Tạo công việc con" : "Tạo nhiệm vụ mới",
    text2 = isEdit ? "Cập nhật" : createLevel === 2 ? "Tạo công việc con" : "Tạo nhiệm vụ";
  // MỚI-5 (12/09/2026): «lập mới nhiệm vụ cấp 3» là trường hợp DUY NHẤT cán bộ thường được chọn
  // «Ban lãnh đạo kiểm soát» và «Người thực hiện trực tiếp». `laCapHai` khai báo ở CUỐI hàm nên chỗ
  // này phải tự tính — dùng nó ở đây là dính lỗi TDZ.
  const lapMoiCapBa = !isEdit && createLevel !== 2;
  let list = [];
  // 2026-09-02 — Trưởng phòng/Phó phòng KHÔNG chọn được «Người thực hiện trực tiếp» khi tạo nhiệm
  // vụ: họ không qua isAdmin()/isManager() nên rơi vào nhánh cuối («chỉ chính mình»), rồi bộ lọc
  // role === "Nhân viên" ở dưới cắt sạch ⇒ dropdown rỗng. Nay có nhánh riêng: ứng viên là NHÂN
  // VIÊN CÙNG PHÒNG. Máy chủ vẫn bó lại theo inScope — giao diện không nới quyền.
  // 2026-09-09 — Trưởng/Phó phòng nay ĐƯỢC nhận việc trực tiếp (quyết định người dùng), nên bộ lọc
  // vai nới thêm hai vai đó; Phó GĐ và admin vẫn bị ẩn vì họ thuộc lớp «Ban lãnh đạo phụ trách».
  // Việc họ CÓ được gán hay không còn tuỳ phòng có Phó GĐ phụ trách — xem capNhatUngVienTrucTiep().
  if (isAdmin()) list = allStaff;else if (isManager() || laQuanTriTrongPhamVi()) list = allStaff.filter(staff => {
    const lower = (staff[COL.S_ROLE] || "").toLowerCase();
    return !lower.includes("admin");
  });else if (laLanhDaoPhong()) {
    const phongToi = tenPhongCuaToi();
    list = allStaff.filter(staff => {
      const lower = (staff[COL.S_ROLE] || "").toLowerCase();
      if (lower.includes("admin")) return false;
      // Chưa tra được tên phòng của mình (allDepartments chưa nạp) ⇒ giữ cả danh sách để ô không
      // rỗng; chọn người ngoài phòng thì máy chủ trả 403.
      if (phongToi === "") return false;
      return String(staff[COL.S_DEPT] || "").trim() === phongToi;
    });
  } else if (lapMoiCapBa) {
    // MỚI-5 (12/09/2026): người dùng báo «nhân viên khi được phép tạo nhiệm vụ cấp 3, nhưng không
    // chọn được Ban lãnh đạo kiểm soát, Người thực hiện trực tiếp». Nhánh cuối bên dưới chỉ còn đúng
    // MỘT ứng viên là chính mình, nên ô có mở ra cũng chẳng có gì để chọn. Lúc LẬP MỚI thì chưa có
    // «việc của mình» nào để mà tự duyệt, nay cho chọn trong NHÂN VIÊN CÙNG PHÒNG — cùng luật với
    // nhánh Trưởng/Phó phòng ngay trên. Máy chủ vẫn bó lại, giao diện không nới quyền: RBAC `create`
    // của vai Nhân viên đòi cùng phòng và đã có việc trong cây, `assertSupervisorsByLevel` đòi BLĐKS
    // cấp 3 nằm trong tập của công việc con chứa nó.
    const phongToi = tenPhongCuaToi();
    const cungPhong = phongToi === "" ? [] : allStaff.filter(staff => {
      const lower = (staff[COL.S_ROLE] || "").toLowerCase();
      return !lower.includes("admin") && String(staff[COL.S_DEPT] || "").trim() === phongToi;
    });
    // Chưa tra được phòng của mình (allDepartments chưa nạp) thì GIỮ NGUYÊN bản cũ: chỉ chính mình.
    list = cungPhong.length ? cungPhong : allStaff.filter(staff => staff[COL.S_NAME] === currentUser.name);
  } else {
    const hasMatch = allProjects.some(project => project[COL.P_MANAGER] === currentUser.name);
    hasMatch ? list = allStaff.filter(staff => {
      const lower = (staff[COL.S_ROLE] || "").toLowerCase();
      return !lower.includes("admin");
    }) : list = allStaff.filter(staff => staff[COL.S_NAME] === currentUser.name);
  }
  list = list.filter(list2 => list2[COL.S_OBJECT_TYPE] !== "Nhà cung cấp")
      .filter(nguoi => VAI_LAM_TRUC_TIEP.includes(nguoi[COL.S_ROLE])); // Ứng viên «Người thực hiện trực tiếp»: Cán bộ + Trưởng/Phó phòng (ẩn Phó GĐ/admin)
  const isEdit2 = isEdit && task && task[COL.T_ASSIGNEE] === currentUser.name && !isAdmin(),
    taskPid = isEdit && task ? task[COL.T_PID] : "",
    taskPid2 = taskPid && allProjects.find(project => project[COL.P_ID] === taskPid && project[COL.P_MANAGER] === currentUser.name),
    isEdit22 = isEdit && !coQuyenTaiDong("update", "task", task);
  // 2026-09-09 — ai được TỰ CHỌN người thực hiện thì KHÔNG điền sẵn tên mình. Trước đây chỉ admin
  // được đối xử như vậy; nay Trưởng/Phó phòng cũng đứng trong danh sách ứng viên nên nếu cứ giữ
  // luật cũ, TP mở form tạo nhiệm vụ là thấy tên CHÍNH MÌNH được chọn sẵn — một mặc định sai dễ lọt
  // qua mắt. Điều kiện khớp đúng `updateAssigneePermission` bên dưới (ô không bị disabled).
  // MỚI-5 (12/09/2026): thêm `lapMoiCapBa` — cán bộ lập mới nhiệm vụ cấp 3 nay cũng tự chọn, nếu cứ
  // điền sẵn tên mình thì danh sách cùng phòng vừa mở ra ở trên thành vô nghĩa.
  const tuChonDuoc = isAdmin() || laQuanTriTrongPhamVi() || laLanhDaoPhong() || lapMoiCapBa;
  // Bug 2 (8b): ô nhập «Tiến độ (%)» đã bỏ — tiến độ do server tính từ mức hoàn thành các nhóm
  // file kết quả (tienDo.js), listener «chọn Hoàn thành tự điền 100%» cũng hết chỗ bám.
  setTimeout(() => {
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
      // MỚI-5 (12/09/2026): `lapMoiCapBa` — cán bộ lập mới nhiệm vụ cấp 3 được chọn người thực hiện,
      // khớp đúng điều kiện của `tuChonDuoc` ở trên để hai nơi không lệch nhau.
      if (laQuanTriTrongPhamVi() || laLanhDaoPhong() || lapMoiCapBa) el2.disabled = false;else el2.disabled = true, el2.value = currentUser.name;
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
  setTimeout(() => {
    capNhatLuaChonGuiBld();
    const form = document.getElementById("task-form");
    if (form) form.addEventListener("change", capNhatLuaChonGuiBld);
  }, 110);
  const parentForm = isEdit ? task?.[COL.T_PARENT] || "" : createParent;
  // ĐỢT A (028_supervisor_ids.sql): CẢ HAI cấp đều có ô «Ban lãnh đạo kiểm soát» RIÊNG — cấp 2 chọn
  // NHIỀU người trong danh sách của công việc cha, cấp 3 chọn ĐÚNG MỘT người trong danh sách của
  // công việc con. Trước đợt A nhiệm vụ nằm dưới công việc con bị ẨN ô này (`coSupervisorRieng =
  // laCapHai || !parentForm`) và mặc nhiên dùng người của cấp 2; nay cấp 3 phải tự chọn, vì chính
  // người đó duyệt file kết quả của nhiệm vụ (điểm bất hợp lý số 5 và 12, bản rà soát 10/09/2026).
  const dungOChonNhieu = laCapHai;
  // Bug 2 (8b): «Tỷ lệ công việc (%)» chỉ có ở ĐẦU MỤC (cấp 2, hoặc cấp 3 không nằm trong công
  // việc con). Server chia đều khi tạo; người giữ quyền «sửa tỷ lệ» (rbac.js ACTION_TY_LE) chỉnh
  // tay. Client chỉ là ổ khoá trang trí — gửi tyLe mà KHÔNG có quyền thì service.js trả 403 cả bản
  // ghi, nên người không có quyền thấy ô KHÓA và KHÔNG có name (không lọt vào FormData).
  const laDauMucForm = true,
    duocSuaTyLe = isEdit ? coQuyenTaiDong("ty-le", "task", task) : coQuyenTrongPhamVi(createLevel === 2 ? "subwork" : "task", "ty-le");
  const taskReminders = isEdit && task ? task[COL.T_REMINDERS] || [] : [],
    taskId = isEdit && task ? task[COL.T_ID] : "";
  // Phân công ba lớp của form nhiệm vụ/CV con: nguồn ứng viên theo PHÒNG của công việc đang
  // chọn — trước đây form này chưa được nối napUngVienPhanCong nên hai ô phân công trống.
  setTimeout(() => {
    const projectSel = document.querySelector("#task-modal select[name=\"projectId\"]"),
      supSel = document.getElementById("task-supervisor-select"),
      supBox = document.getElementById("task-supervisors-box"),
      supInput = document.getElementById("task-supervisors-input"),
      leadBox = document.getElementById("task-leaders-box"),
      leadInput = document.getElementById("task-leaders-input"),
      leadSel = document.getElementById("task-leader-select");
    if (!projectSel) return;
    // Hai ô «Ban lãnh đạo kiểm soát» cùng tên trường `supervisorIds` nhưng chỉ MỘT ô được gửi: ô
    // không dùng phải `disabled` (select) hoặc không có `name` (hidden input). Để cả hai cùng gửi
    // thì `FormData` chỉ giữ giá trị cuối — mà giá trị cuối là của ô người dùng KHÔNG nhìn thấy.
    // Đúng cái bẫy mà cặp ô `leaderIds` cạnh bên đã phải xử lý bằng cùng cách.
    if (supSel && dungOChonNhieu) supSel.disabled = true;
    const supGroup = document.getElementById("task-supervisor-group");
    if (supGroup) supGroup.style.display = dungOChonNhieu ? "none" : "";
    const supMulti = document.getElementById("task-supervisors-multi");
    if (supMulti) supMulti.style.display = dungOChonNhieu ? "" : "none";
    if (leadSel && laCapHai) leadSel.disabled = true;
    if (leadInput && !laCapHai) leadInput.disabled = true;
    // Ô «Người thực hiện trực tiếp» vẽ lại SAU khi máy chủ cho biết phòng có Phó GĐ phụ trách hay
    // không: không có thì cắt Trưởng/Phó phòng khỏi danh sách (2026-09-09). Giữ nguyên lựa chọn cũ
    // nếu người đó vẫn còn hợp lệ; nếu bị cắt thì trả về rỗng để `required` bắt chọn lại, chứ đừng
    // âm thầm đổi sang người khác — đổi người thực hiện là đổi cả luồng duyệt.
    const selTrucTiep = document.querySelector("#task-modal select[name=\"assignee\"]");
    const veLaiUngVienTrucTiep = function (payload) {
      if (!selTrucTiep || laCapHai) return;
      const dangChon = selTrucTiep.value;
      selTrucTiep.innerHTML = buildUngVienTrucTiepHtml(list, dangChon, payload?.coPhoGiamDocPhuTrach === true);
      capNhatLuaChonGuiBld();
    };
    const napPhanCongTask = function () {
      const project = allProjects.find(p => p[COL.P_ID] === projectSel.value);
      napUngVienPhanCong({
        deptValue: project ? project[COL.P_DEPT_ID] : "",
        parentRef: laCapHai ? "" : parentForm,
        supervisorSelect: dungOChonNhieu ? null : supSel,
        supervisorsBox: dungOChonNhieu ? supBox : null,
        supervisorsInput: dungOChonNhieu ? supInput : null,
        leadersBox: laCapHai ? leadBox : null,
        leadersInput: laCapHai ? leadInput : null,
        singleLeaderSelect: laCapHai ? null : leadSel,
        // ĐỢT A: cấp 3 lấy nguồn từ CÔNG VIỆC CON (máy chủ lọc `supervisors` theo `parentRef`), nên
        // KHÔNG điền sẵn từ công việc cha như bản cũ — `applyDefault` tick người ĐẦU của cấp 2 (Q12).
        // Cấp 2 thừa hưởng nguyên danh sách của công việc cha, đúng như ô lãnh đạo phòng bên dưới.
        selectedSupervisor: isEdit && task ? task.supervisorId : "",
        selectedSupervisors: isEdit && task ? task.supervisorIds || [] : dungOChonNhieu ? project?.supervisorIds || [] : null,
        selectedLeaders: isEdit && task ? task.leaderIds || [] : laCapHai ? project?.leaderIds || [] : [],
        applyDefault: !isEdit && currentUser?.role !== "Nhân viên"
      }).then(payload => {
        // MỚI-5 (12/09/2026): khi LẬP MỚI nhiệm vụ cấp 3, ô «Ban lãnh đạo kiểm soát» phải mở cho cán
        // bộ — truyền `null` để `khoaPhanCongVoiNhanVien` không đụng tới nó. Ô «Lãnh đạo phòng phụ
        // trách» (`leadSel`) VẪN khoá: người dùng chỉ yêu cầu mở BLĐKS + người thực hiện trực tiếp,
        // và máy chủ cũng vẫn từ chối cán bộ đổi `leader_ids` (`assertAssignmentActor`).
        khoaPhanCongVoiNhanVien(lapMoiCapBa ? null : supSel, leadBox, leadSel, supBox);
        if (currentUser?.role === "Nhân viên" && leadInput) leadInput.disabled = true;
        veLaiUngVienTrucTiep(payload);
      });
    };
    projectSel.addEventListener("change", napPhanCongTask);
    napPhanCongTask();
    // Kết quả file (014/016): SỬA thì nạp REST. TẠO MỚI (cấp 3) đã nhúng bảng 10 cột + dòng khai
    // tạm vào chuỗi HTML bên dưới nên người dùng thấy bảng NGAY, không chờ 250ms, không cần mã.
    if (isEdit && !laCapHai) napKetQua(taskId);
  }, 250);
  return "\n  <div id=\"task-modal\" class=\"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] modal-overlay\">\n      <div class=\"modal-content glass-card md:max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto\" style=\"width: 90vw !important; max-width: none !important; height: 96vh !important;\">\n          <form id=\"task-form\" class=\"h-full flex flex-col\">\n              " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + escapeHtml(taskId) + "\">" : "<input type=\"hidden\" id=\"task-create-level\" name=\"level\" value=\"" + escapeHtml(createLevel) + "\"><input type=\"hidden\" id=\"task-create-parent\" name=\"parent\" value=\"" + escapeHtml(createParent) + "\">") + "\n              \n              <!-- Sticky Header Row -->\n              <div class=\"flex flex-col md:flex-row gap-6 items-center mb-6 sticky bg-white z-10 pb-4 border-b border-gray-100 -mx-8 px-8 -mt-8 pt-4 relative\" style=\"top: -32px;\">\n                " + (!isEdit ? "\n                <button type=\"button\" class=\"close-modal absolute top-4 right-4 text-gray-400 hover:text-gray-600 md:hidden\">\n                    <i class=\"fas fa-times text-xl\"></i>\n                </button>\n                " : "") + "\n                <div class=\"flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full\">\n                    <div class=\"flex items-center\">\n                        <h3 class=\"text-xl font-bold text-gray-900\">\n                            <i class=\"fas " + (isEdit ? "fa-edit" : "fa-plus-circle") + " text-blue-500 mr-2\"></i>" + escapeHtml(text) + "\n                        </h3>\n                    </div>\n                    <div class=\"flex items-center justify-between\">\n                        <div class=\"flex-1 flex justify-center\">" + (isEdit ? "\n                            <button type=\"submit\" class=\"btn-primary flex items-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all w-full md:w-auto justify-center\">\n                                <i class=\"fas fa-save mr-2\"></i>" + escapeHtml(text2) + "\n                            </button>\n                        " : "") + "</div>\n                        " + (!isEdit ? "\n                        <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600 hidden md:block\">\n                            <i class=\"fas fa-times text-xl\"></i>\n                        </button>\n                        " : "") + "\n                    </div>\n                </div>\n                " + (isEdit ? "\n                <div class=\"w-full md:w-72 flex items-center gap-2\">\n                    <div class=\"font-semibold text-gray-900 flex items-center cursor-pointer select-none flex-1\" onclick=\"toggleTaskReminders()\">\n                        <i id=\"reminder-toggle-icon\" class=\"fas fa-chevron-down text-gray-400 mr-2 transition-transform duration-300\"></i>\n                        <i class=\"fas fa-bell text-amber-500 mr-2\"></i>\n                        Lịch sử nhắc việc\n                        <button type=\"button\" onclick=\"event.stopPropagation(); openAddReminderModal('" + escapeForInlineHandler(taskId) + "')\" class=\"ml-3 p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors\" title=\"Thêm nhắc việc\">\n                            <i class=\"fas fa-plus text-sm\"></i>\n                        </button>\n                    </div>\n                    <button type=\"button\" class=\"close-modal bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition-colors flex-shrink-0\">\n                        <i class=\"fas fa-times\"></i>\n                    </button>\n                </div>\n                " : "") + "\n              </div>\n\n              " + (isEdit ? buildThanhTabNhatKy("task", thangSuaDuocCuaDauViec(task[COL.T_START], task[COL.T_DUE]).length > 0) : "") + "\n              <!-- 3 Columns Content -->\n              <div id=\"task-form-body\" class=\"flex flex-col md:flex-row gap-6 items-start h-full pb-4 flex-1\">\n                  \n                  <!-- Left Container (Cols 1 & 2) -->\n                  <div class=\"flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-full overflow-visible md:overflow-y-auto pr-0 md:pr-2 custom-scrollbar w-full order-2 md:order-1\">\n                      \n                      <!-- Column 1 -->\n                      <div class=\"space-y-3 md:col-span-1\">\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label required\">Tên nhiệm vụ</label>\n                            <input type=\"text\" name=\"name\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(task[COL.T_NAME]) || "" : "") + "\" " + (isEdit22 ? "disabled" : "") + ">\n                          </div>\n\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label required\">Thuộc dự án</label>\n                            <select name=\"projectId\" class=\"form-select\" required " + (isEdit22 || createProject ? "disabled" : "") + ">\n                              <option value=\"\">-- Chọn dự án --</option>\n                              " + congViecChoForm(laCapHai ? "subwork" : "task", isEdit, task).map(item => {
    const text3 = (isEdit ? task[COL.T_PID] : createProject) === item[COL.P_ID] ? "selected" : "";
    return "<option value=\"" + escapeHtml(item[COL.P_ID]) + "\" " + text3 + ">" + escapeHtml(item[COL.P_NAME]) + " (" + escapeHtml(item[COL.P_ID]) + ")</option>";
  }).join("") + "\n                            </select>\n                          </div>\n                          <div id=\"task-supervisor-group\" class=\"form-group\" style=\"" + (dungOChonNhieu ? "display:none" : "") + "\">\n                              <label class=\"form-label\">Ban lãnh đạo kiểm soát</label>\n                              <select name=\"supervisorIds\" id=\"task-supervisor-select\" class=\"form-select\"></select>\n                              <p class=\"text-xs text-gray-500 mt-1\"><i class=\"fas fa-info-circle mr-1\"></i>Chọn ĐÚNG MỘT người trong danh sách của công việc con. Người này duyệt kết quả file của nhiệm vụ.</p>\n                          </div>\n                          <div id=\"task-supervisors-multi\" class=\"form-group\" style=\"" + (dungOChonNhieu ? "" : "display:none") + "\">\n                              <label class=\"form-label\">Ban lãnh đạo kiểm soát</label>\n                              <div id=\"task-supervisors-box\" class=\"flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[42px] items-center\"></div>\n                              <p class=\"text-xs text-gray-500 mt-1\"><i class=\"fas fa-info-circle mr-1\"></i>Chỉ chọn được trong danh sách đã chọn ở công việc cha. Mỗi nhiệm vụ bên dưới sẽ chọn đúng một người trong danh sách này.</p>\n                          </div>\n                          <input type=\"hidden\" " + (laCapHai ? "name=\"supervisorIds\" " : "") + "id=\"task-supervisors-input\" value=\"" + (isEdit && task ? (task.supervisorIds || []).join(",") : "") + "\">\n                          <div id=\"task-leaders-multi\" class=\"form-group\" style=\"" + (laCapHai ? "" : "display:none") + "\">\n                              <label class=\"form-label\">Lãnh đạo phòng phụ trách</label>\n                              <div id=\"task-leaders-box\" class=\"flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[42px] items-center\"></div>\n                          </div>\n                          <div id=\"task-leader-single\" class=\"form-group\" style=\"" + (laCapHai ? "display:none" : "") + "\">\n                              <label class=\"form-label\">Lãnh đạo phòng phụ trách</label>\n                              <select name=\"leaderIds\" id=\"task-leader-select\" class=\"form-select\"></select>\n                          </div>\n                          <input type=\"hidden\" " + (laCapHai ? "name=\"leaderIds\" " : "") + "id=\"task-leaders-input\" value=\"" + (isEdit && task ? (task.leaderIds || []).join(",") : "") + "\">\n\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label\">Mô tả</label>\n                            <textarea name=\"description\" class=\"form-textarea\" rows=\"5\" " + (isEdit22 ? "disabled" : "") + ">" + (isEdit ? escapeHtml(task[COL.T_DESC]) || "" : "") + "</textarea>\n                          </div>\n                      \n                          <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                              <div class=\"form-group\" style=\"" + (laCapHai ? "display:none" : "") + "\">\n                                <label class=\"form-label required\">Người thực hiện trực tiếp</label>\n                                <select name=\"assignee\" class=\"form-select\" required" + (isEdit22 || laCapHai ? "disabled" : "") + ">\n                                  <option value=\"\">-- Chọn người thực hiện --</option>\n                                  " + buildUngVienTrucTiepHtml(list, isEdit ? task[COL.T_ASSIGNEE] : tuChonDuoc ? "" : currentUser.name, true) + "\n                                </select>\n                              </div>\n                              <div class=\"form-group\">\n                                  <label class=\"form-label\">Ưu tiên</label>\n                                  <select name=\"priority\" class=\"form-select\" " + (isEdit22 ? "disabled" : "") + ">\n                                      <option value=\"Thấp\" " + (isEdit && task[COL.T_PRIORITY] === "Thấp" ? "selected" : "") + ">Thấp</option>\n                                      <option value=\"Trung bình\" " + (!isEdit || task[COL.T_PRIORITY] === "Trung bình" ? "selected" : "") + ">Trung bình</option>\n                                      <option value=\"Cao\" " + (isEdit && task[COL.T_PRIORITY] === "Cao" ? "selected" : "") + ">Cao</option>\n                                  </select>\n                              </div>\n                          </div>\n                      \n                          <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                              <div class=\"form-group\">\n                                  <label class=\"form-label required\">Ngày bắt đầu</label>\n                                  <input type=\"date\" name=\"startDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(task[COL.T_START])) : "") + "\" " + (isEdit22 ? "disabled" : "") + ">\n                              </div>\n                              <div class=\"form-group\">\n                                  <label class=\"form-label required\">Hạn chót</label>\n                                  <input type=\"date\" name=\"dueDate\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(formatDateForInput(task[COL.T_DUE])) : "") + "\" " + (isEdit22 ? "disabled" : "") + ">\n                              </div>\n                          </div>\n                      \n                          <div class=\"grid grid-cols-1 md:grid-cols-3 gap-4\">\n                              " + (laDauMucForm ? "\n                              <div class=\"form-group\">\n                                  <label class=\"form-label\">Tỷ lệ công việc (%)</label>\n                                  <input type=\"number\" " + (duocSuaTyLe ? "name=\"tyLe\"" : "disabled title=\"Chỉ lãnh đạo phụ trách mới sửa được tỷ lệ\"") + " class=\"form-input\" min=\"0\" max=\"100\" value=\"" + (isEdit ? Number(task[COL.T_TY_LE] || 0) : "") + "\"" + (isEdit ? "" : " placeholder=\"Chia đều\"") + ">\n                              </div>" : "") + "\n                              <div class=\"form-group\">\n                                <label class=\"form-label\">Ngày báo cáo</label>\n                                <input type=\"date\" name=\"reportDate\" class=\"form-input\" value=\"" + (isEdit ? escapeHtml(formatDateForInput(task[COL.T_REPORT_DATE])) : "") + "\">\n                              </div>\n                          </div>\n                      </div>\n\n                      <!-- Column 2 -->\n                      <div class=\"space-y-3 md:col-span-2\">\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label\">Mục tiêu</label>\n                            <textarea name=\"target\" class=\"form-textarea\" rows=\"2\">" + (isEdit ? escapeHtml(task[COL.T_TARGET]) || "" : "") + "</textarea>\n                          </div>\n\n                          <!-- Vòng 14: KẾT QUẢ NHIỆM VỤ LÀ FILE — mỗi file nhân viên nộp là MỘT DÒNG; bấm icon Lịch sử hiện các bản + bảng luồng, bấm «Xem ý kiến» bung chi tiết góp ý. napKetQua nạp vào đây. -->" + (laCapHai ? "" : buildGuiBldCheckboxHtml(isEdit, task)) + "<div id=\"task-ket-qua-danh-sach\">" + (!isEdit && createLevel !== 2 ? buildKhungDanhSachKetQua([], "") : "") + "</div>\n\n                          <div class=\"form-group mb-0\">\n                            <label class=\"form-label\">Kết quả đầu ra</label>\n                            <textarea name=\"output\" class=\"form-textarea\" rows=\"5\">" + (isEdit ? escapeHtml(task[COL.T_OUTPUT]) || "" : "") + "</textarea>\n                          </div>\n                          \n                          <div class=\"form-group mb-0\">\n                              <label class=\"form-label\">Ghi chú</label>\n                              <textarea name=\"notes\" class=\"form-textarea\" rows=\"2\">" + (isEdit ? escapeHtml(task[COL.T_NOTES]) || "" : "") + "</textarea>\n                          </div>\n                      </div>\n                  </div>\n\n                  <!-- Column 3 (Reminders) - Only show in edit mode -->\n                  " + (isEdit ? "\n                  <div id=\"task-reminders-container\" class=\"order-1 md:order-2 w-full md:w-72 h-auto max-h-160 md:h-full flex flex-col pt-1 transition-all duration-300 ease-in-out border-b border-gray-100 pb-4 mb-4 md:border-b-0 md:pb-0 md:mb-0\" style=\"top: 60px;\">\n                      <div id=\"reminders-list\" class=\"reminders-list h-full overflow-y-auto space-y-3 custom-scrollbar pr-1\">\n                          " + (taskReminders.length > 0 ? taskReminders.map((taskReminder, index) => "\n                              <div class=\"reminder-item p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors\">\n                                  <div class=\"flex items-start justify-between\">\n                                      <div class=\"flex-1\">\n                                          <div class=\"flex items-center text-sm font-medium text-gray-900 mb-1\">\n                                              <i class=\"fas fa-calendar-alt text-amber-500 mr-2 text-xs\"></i>\n                                              " + escapeHtml(formatDateForDisplay(taskReminder.date)) + "\n                                          </div>\n                                          <p class=\"text-sm text-gray-600 leading-relaxed reminder-content\">" + (linkifyText(taskReminder.content) || "<em class=\"text-gray-400\">Không có nội dung</em>") + "</p>\n                                      </div>\n                                      " + (isAdmin() || isEdit2 || taskPid2 ? "\n                                      <div class=\"flex items-center space-x-1 ml-2\">\n                                          <button type=\"button\" onclick=\"openEditReminderModal('" + escapeForInlineHandler(taskId) + "', " + index + ", '" + escapeForInlineHandler(taskReminder.date) + "', decodeURIComponent('" + escapeForInlineHandler(encodeURIComponent(taskReminder.content || "")) + "'))\" class=\"p-1 text-gray-400 hover:text-blue-600 transition-colors\" title=\"Sửa\">\n                                              <i class=\"fas fa-edit text-xs\"></i>\n                                          </button>\n                                          <button type=\"button\" onclick=\"handleDeleteReminder('" + escapeForInlineHandler(taskId) + "', " + index + ")\" class=\"p-1 text-gray-400 hover:text-red-600 transition-colors\" title=\"Xóa\">\n                                              <i class=\"fas fa-trash text-xs\"></i>\n                                          </button>\n                                      </div>\n                                      " : "") + "\n                                  </div>\n                              </div>\n                          ").join("") : "\n                              <div class=\"text-center py-8 text-gray-400\">\n                                  <i class=\"fas fa-bell-slash text-3xl mb-2\"></i>\n                                  <p class=\"text-sm\">Chưa có nhắc việc nào</p>\n                              </div>\n                          ") + "\n                      </div>\n                  </div>\n                  " : "") + "\n\n              </div>\n              " + (isEdit ? buildKhungNhatKy("task", taskId) + buildKhungTenThang("task", taskId) : "") + "\n              " + (!isEdit ? "<div class=\"chan-form-tao sticky bottom-0 -mx-8 px-8 pt-3 pb-3 mt-4 border-t border-gray-100 bg-white flex flex-wrap items-center justify-end gap-3\"><span class=\"mr-auto text-xs text-gray-500 hidden md:inline\"><i class=\"fas fa-info-circle mr-1\"></i>«Lưu tạm» giữ ở Nháp để sửa tiếp · «Gửi đi duyệt» đưa vào hàng chờ</span><button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>" + buildLuuNhapNutHtml(false) + "<button type=\"submit\" data-gui-duyet=\"1\" class=\"btn-primary\"><i class=\"fas fa-paper-plane mr-2\"></i>Gửi đi duyệt</button></div>" : "") + "\n          </form>\n      </div>\n  </div>\n";
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

/**
 * Ô chọn "Ban lãnh đạo kiểm soát" — MỘT người, nay chỉ còn dùng ở CẤP 3 (nhiệm vụ).
 *
 * ĐỢT A (028_supervisor_ids.sql): cấp 1 và cấp 2 chuyển sang chọn NHIỀU (`buildSupervisorCheckboxesHtml`
 * bên dưới), cấp 3 vẫn đúng một người — và chỉ được chọn trong danh sách của công việc con chứa nó,
 * nên máy chủ trả về `supervisors` đã lọc sẵn theo tập của cấp 2. Ô này vì thế KHÔNG cần tự lọc.
 */
function buildSupervisorOptionsHtml(list, selectedId, defaultValue) {
  const chosen = String(selectedId == null ? "" : selectedId).trim() || String(defaultValue == null ? "" : defaultValue).trim() || "";
  return "<option value=\"\">-- Không chọn --</option>" + list.map(s => "<option value=\"" + escapeHtmlAttr(s.id) + "\"" + (String(s.id) === chosen ? " selected" : "") + ">" + escapeHtml(s.name) + "</option>").join("");
}

/**
 * Nhóm checkbox «Ban lãnh đạo kiểm soát» của CẤP 1 (công việc) và CẤP 2 (công việc con) — ĐỢT A.
 *
 * Cùng khuôn `buildLeaderCheckboxesHtml`: tick nhiều người, id ghi vào một hidden input phân tách
 * dấu phẩy. Viết thành hàm RIÊNG chứ không tham số hoá tên class dùng chung, vì class nằm trong
 * thuộc tính HTML và mọi chỗ nội suy biến vào HTML đều phải qua rà soát XSS (`docs/XSS-4.6.md`);
 * giữ tên class là chuỗi hằng viết thẳng thì chỗ này không sinh thêm điểm phải thoát.
 */
function buildSupervisorCheckboxesHtml(list, selectedIds) {
  const dangChon = new Set((selectedIds || []).map(String));
  if (!list || list.length === 0) return "<span class=\"text-gray-400 text-sm\">Chưa có Ban lãnh đạo nào để chọn — hãy phân công Phó Giám đốc phụ trách phòng này trước</span>";
  return list.map(s => "<label class=\"inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:border-blue-300\"><input type=\"checkbox\" class=\"supervisor-opt accent-blue-600\" value=\"" + escapeHtmlAttr(s.id) + "\"" + (dangChon.has(String(s.id)) ? " checked" : "") + "><span class=\"text-sm\">" + escapeHtml(s.name) + "</span></label>").join("");
}

/** Nhóm checkbox "Lãnh đạo phòng phụ trách" — NHIỀU người, ghi id vào hidden input. */
function buildLeaderCheckboxesHtml(list, selectedIds) {
  const dangChon = new Set((selectedIds || []).map(String));
  if (!list || list.length === 0) return "<span class=\"text-gray-400 text-sm\">Không có lãnh đạo phòng nào để chọn</span>";
  return list.map(l => "<label class=\"inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:border-blue-300\"><input type=\"checkbox\" class=\"leader-opt accent-blue-600\" value=\"" + escapeHtmlAttr(l.id) + "\"" + (dangChon.has(String(l.id)) ? " checked" : "") + "><span class=\"text-sm\">" + escapeHtml(l.name) + "</span></label>").join("");
}

/**
 * Ô «Người thực hiện trực tiếp» của NHIỆM VỤ (cấp 3) — MỘT người.
 *
 * `value` là TÊN người, không phải id: cả luồng lưu/sửa và dữ liệu cũ đều đối chiếu theo tên
 * (xem phép 15 `legacy-gd2-parity`), đổi sang id ở đây là vỡ tương thích ngược.
 *
 * `choChonLanhDao` = phòng của công việc đang chọn CÓ Phó Giám đốc phụ trách hay không. Khi KHÔNG
 * có thì Trưởng/Phó phòng bị cắt khỏi danh sách: họ nộp kết quả lên sẽ không ai duyệt được
 * (quyết định người dùng 2026-09-09). Máy chủ chặn lại lần nữa trong
 * `assignments.assertTaskAssignee` với mã `ASSIGNEE_LEADER_NO_DEPUTY` — giao diện chỉ đừng đưa ra
 * lựa chọn chắc chắn bị từ chối.
 *
 * Tên có kèm vai trong NGOẶC cho hai vai lãnh đạo, vì từ 2026-09-09 họ đứng chung danh sách với
 * Cán bộ (quyết định «nhãn kèm vai»); Cán bộ không kèm để danh sách khỏi rối.
 */
function buildUngVienTrucTiepHtml(list, selectedName, choChonLanhDao) {
  const chon = String(selectedName == null ? "" : selectedName).trim();
  const duocChon = (list || []).filter(nguoi => choChonLanhDao === true || nguoi[COL.S_ROLE] === "Nhân viên");
  return "<option value=\"\">-- Chọn người thực hiện --</option>" + duocChon.map(nguoi => {
    const ten = nguoi[COL.S_NAME],
      vai = nguoi[COL.S_ROLE];
    return "<option value=\"" + escapeHtmlAttr(ten) + "\"" + (String(ten) === chon ? " selected" : "") + ">" + escapeHtml(ten) + (choChonLanhDao === true && vai && vai !== "Nhân viên" ? " (" + escapeHtml(vai) + ")" : "") + "</option>";
  }).join("");
}

/**
 * KHOÁ ô phân công với NHÂN VIÊN (người dùng báo 2026-09-02: «sửa lại nhân viên không được sửa
 * Lãnh đạo phòng phụ trách»).
 *
 * Ô «Lãnh đạo phòng phụ trách» quyết định AI xử được file kết quả của nhiệm vụ (luật `leader_ids`),
 * nên để Cán bộ tự đổi là tự chọn người duyệt cho mình. Máy chủ đã chặn (`assignments.assertTaskLeader`
 * + ma trận §6), nhưng client vẫn gửi ô đó lên ⇒ Cán bộ sửa nhiệm vụ của mình là gặp 403 mà không
 * hiểu vì sao. Nay khoá ô ngay trên form và ghi rõ lý do; `disabled` thì trình duyệt KHÔNG gửi
 * trường đó nữa, máy chủ giữ nguyên giá trị cũ (patch không có khoá `leaderIds`).
 *
 * Vai được sửa: admin · Phó Giám đốc · Trưởng phòng · Phó phòng (đúng nhóm `laLanhDaoPhong()` +
 * `laQuanTriTrongPhamVi()`); mọi vai còn lại chỉ xem.
 */
function khoaPhanCongVoiNhanVien(supervisorSelect, leadersBox, singleLeaderSelect, supervisorsBox) {
  if (laQuanTriTrongPhamVi() || laLanhDaoPhong()) return;
  const ghiChu = "Chỉ Trưởng phòng / Phó phòng / Phó Giám đốc / Giám đốc đổi được ô này.";
  if (singleLeaderSelect) {
    singleLeaderSelect.disabled = true;
    singleLeaderSelect.title = ghiChu;
  }
  if (supervisorSelect) {
    supervisorSelect.disabled = true;
    supervisorSelect.title = ghiChu;
  }
  if (leadersBox) {
    leadersBox.querySelectorAll(".leader-opt").forEach((o) => {
      o.disabled = true;
    });
    leadersBox.title = ghiChu;
  }
  // ĐỢT A: ô «Ban lãnh đạo kiểm soát» cấp 1/cấp 2 nay là nhóm checkbox. Khoá nó CÒN quan trọng hơn
  // khoá ô lãnh đạo phòng: danh sách này quyết định AI DUYỆT được cả cây (R1a), để Cán bộ tự đổi là
  // tự chỉ định người duyệt cho việc của mình.
  if (supervisorsBox) {
    supervisorsBox.querySelectorAll(".supervisor-opt").forEach((o) => {
      o.disabled = true;
    });
    supervisorsBox.title = ghiChu;
  }
}
/** Đọc checkbox đang chọn rồi ghi danh sách id (phân tách dấu phẩy) vào hidden input. */
function capNhatLeaderInput(leadersBoxEl, leadersInputEl) {
  if (!leadersBoxEl || !leadersInputEl) return;
  const ids = Array.from(leadersBoxEl.querySelectorAll(".leader-opt:checked")).map(item => item.value);
  leadersInputEl.value = ids.join(",");
}
/** Như `capNhatLeaderInput` nhưng cho nhóm «Ban lãnh đạo kiểm soát» (đợt A). */
function capNhatSupervisorInput(boxEl, inputEl) {
  if (!boxEl || !inputEl) return;
  const ids = Array.from(boxEl.querySelectorAll(".supervisor-opt:checked")).map(item => item.value);
  inputEl.value = ids.join(",");
}
/** Ô chọn PHÒNG của form công việc — value là id phòng; "" = Công việc chung. */
function buildDeptIdOptions(selectedId) {
  const value = String(selectedId == null ? "" : selectedId).trim(),
    tong = Array.isArray(allDepartments) ? allDepartments.length : 0,
    list = (Array.isArray(allDepartments) ? allDepartments : []).filter(d => String(d[COL.D_DB_ID] == null ? "" : d[COL.D_DB_ID]).trim() !== "" &&
      coQuyenTrongPhamVi("work", "create", { dept: d[COL.D_DB_ID], deptName: d[COL.D_NAME] }));
  if (list.length < tong)
    console.warn("[QLCV] Bỏ " + (tong - list.length) + "/" + tong + " phòng vì máy chủ không gửi ID phòng (D_DB_ID) — máy chủ đang chạy bản cũ, cần cập nhật server/src/rpc/legacyFields.js rồi khởi động lại.");
  // allDepartments là object khoá legacy (COL.D_*): đọc d.id/d.name là undefined ⇒ dropdown trống
  // (bẫy 2026-08-26 lần 2). Value PHẢI là D_DB_ID (id số) — preselect khi sửa dùng P_DEPT_ID.
  const chon = value || String(phongCuaTaiKhoan() || "");
  return (isAdmin() || coQuyenTrongPhamVi("work", "create", { dept: null }) ? '<option value="">-- Công việc chung --</option>' : '<option value="" disabled>-- Tài khoản cần được phân phòng --</option>') + list.map(d => "<option value=\"" + escapeHtmlAttr(d[COL.D_DB_ID]) + "\"" + (String(d[COL.D_DB_ID]) === chon ? " selected" : "") + ">" + escapeHtml(d[COL.D_NAME]) + "</option>").join("");
}

/**
 * Nạp ứng viên phân công cho form đang mở và vẽ vào DOM.
 *
 * Bốn ô, mỗi ô một cặp tham số — CẤP của dòng đang mở quyết định ô nào được truyền vào:
 *   • `supervisorSelect`                   Ban lãnh đạo kiểm soát của NHIỆM VỤ (cấp 3) — MỘT người;
 *   • `supervisorsBox` + `supervisorsInput`  … của công việc / công việc con (cấp 1, 2) — NHIỀU
 *                                          người (đợt A, 028_supervisor_ids.sql);
 *   • `singleLeaderSelect`                 lãnh đạo phòng của nhiệm vụ — MỘT người;
 *   • `leadersBox` + `leadersInput`        lãnh đạo phòng của công việc / công việc con — NHIỀU người.
 */
async function napUngVienPhanCong(opts) {
  const { deptValue = "", parentRef = "", supervisorSelect = null, singleLeaderSelect = null,
          leadersBox = null, leadersInput = null, supervisorsBox = null, supervisorsInput = null,
          selectedSupervisor = "", selectedSupervisors = null, selectedLeaders = [],
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
  if (supervisorsBox && supervisorsInput) {
    // ĐỢT A (028): cấp 1 và cấp 2 chọn NHIỀU Ban lãnh đạo kiểm soát. Đổi phòng là «chọn lại» —
    // không có chọn gốc thì tick sẵn người máy chủ đề nghị (`defaultSupervisorId`: Phó GĐ phụ trách
    // phòng, cùng luật với backfill 005/028); khi SỬA thì giữ nguyên chọn gốc. Đúng khuôn ô lãnh đạo
    // phòng ngay bên dưới để hai ô cạnh nhau cư xử giống nhau, người dùng khỏi phải học hai kiểu.
    const chonGoc = Array.isArray(selectedSupervisors) ? selectedSupervisors : null;
    const danhDau = chonGoc && chonGoc.length > 0 ? chonGoc : applyDefault && payload.defaultSupervisorId != null ? [payload.defaultSupervisorId] : [];
    supervisorsBox.innerHTML = buildSupervisorCheckboxesHtml(supervisors, danhDau);
    capNhatSupervisorInput(supervisorsBox, supervisorsInput);
    supervisorsBox.onchange = () => capNhatSupervisorInput(supervisorsBox, supervisorsInput);
  }
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
  // Trả phản hồi ra ngoài: ô «Người thực hiện trực tiếp» cần đọc `coPhoGiamDocPhuTrach` để quyết
  // có hiện Trưởng/Phó phòng hay không (2026-09-09). Gọi lại API lần nữa là thừa một vòng mạng.
  return payload;
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
    const roleSelect = document.querySelector("#staff-modal select[name=\"role\"]"),
      deptRoleSelect = document.querySelector("#staff-modal select[name=\"deptRole\"]"),
      vaiPhong = ["Nhân viên", "Trưởng phòng", "Phó phòng"];
    if (roleSelect && deptRoleSelect) {
      if (vaiPhong.includes(roleSelect.value)) deptRoleSelect.value = roleSelect.value;
      roleSelect.addEventListener("change", () => {
        if (vaiPhong.includes(roleSelect.value)) deptRoleSelect.value = roleSelect.value;
      });
      deptRoleSelect.addEventListener("change", () => {
        if (vaiPhong.includes(roleSelect.value)) roleSelect.value = deptRoleSelect.value || "Nhân viên";
      });
    }
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
  }, 100), "\n  <div id=\"staff-modal\" class=\"modal\">\n      <div class=\"modal-content\">\n          <div class=\"flex items-center justify-between mb-6\">\n              <h3 class=\"text-xl font-bold text-gray-900\">" + escapeHtml(text) + "</h3>\n              <button type=\"button\" class=\"close-modal text-gray-400 hover:text-gray-600\">\n                  <i class=\"fas fa-times\"></i>\n              </button>\n          </div>\n          \n          <form id=\"staff-form\">\n          <div id=\"staff-validation-error\" class=\"hidden mb-4\"></div>\n              " + (isEdit ? "<input type=\"hidden\" name=\"id\" value=\"" + escapeHtml(staff[COL.S_ID]) + "\">" : "") + "\n\n              <!-- Row 1: Đối tượng | Họ tên -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Đối tượng</label>\n                      <select name=\"objectType\" class=\"form-select\">\n                          <option value=\"Người dùng\" " + (staffObjectType === "Người dùng" ? "selected" : "") + ">Người dùng</option>\n                          <option value=\"Nhà cung cấp\" " + (staffObjectType === "Nhà cung cấp" ? "selected" : "") + ">Nhà cung cấp</option>\n                      </select>\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\" id=\"staff-name-label\">Họ tên *</label>\n                      <input type=\"text\" name=\"name\" class=\"form-input\" required value=\"" + (isEdit ? escapeHtml(staff[COL.S_NAME]) || "" : "") + "\">\n                  </div>\n              </div>\n              \n              <!-- Row 2: Email | Chức vụ -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 user-field\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Email</label>\n                      <input type=\"email\" name=\"email\" class=\"form-input\" value=\"" + (isEdit ? escapeHtml(staff[COL.S_EMAIL]) || "" : "") + "\">\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Chức vụ</label>\n                      <input type=\"text\" name=\"position\" class=\"form-input\" value=\"" + (isEdit ? escapeHtml(staff[COL.S_POS]) || "" : "") + "\">\n                  </div>\n              </div>\n              \n              <!-- Row 3: Phân quyền | Mật khẩu -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 user-field\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Phân quyền</label>\n                      <select name=\"role\" class=\"form-select\">\n                          <option value=\"Nhân viên\" selected>Cán bộ</option>\n                          <option value=\"Trưởng phòng\" " + (isEdit && staff[COL.S_ROLE] === "Trưởng phòng" ? "selected" : "") + ">Trưởng phòng</option>\n                          <option value=\"Phó phòng\" " + (isEdit && staff[COL.S_ROLE] === "Phó phòng" ? "selected" : "") + ">Phó phòng</option>\n                          <option value=\"Phó Giám đốc\" " + (isEdit && staff[COL.S_ROLE] === "Phó Giám đốc" ? "selected" : "") + ">Phó Giám đốc</option>\n                          <option value=\"Admin\" " + (isEdit && ["admin", "Admin"].includes(staff[COL.S_ROLE]) ? "selected" : "") + ">Giám đốc</option>\n                      </select>\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Mật khẩu *</label>\n                      <input type=\"text\" name=\"password\" class=\"form-input\" required \n                              value=\"" + (isEdit ? escapeHtml(staff[COL.S_PASSWORD]) || "" : "") + "\"\n                              placeholder=\"Nhập mật khẩu\">\n                  </div>\n              </div>\n\n              <!-- Row 4: Phòng | Vai trò phòng -->\n              <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 user-field\">\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Phòng</label>\n                      <select name=\"department\" class=\"form-select\">" + buildDepartmentOptions(isEdit && staff ? staff[COL.S_DEPT] : "") + "</select>\n                  </div>\n                  <div class=\"form-group mb-0\">\n                      <label class=\"form-label\">Vai trò phòng</label>\n                      <select name=\"deptRole\" class=\"form-select\">" + buildDeptRoleOptions(isEdit && staff ? staff[COL.S_DEPT_ROLE] : "") + "</select>\n                  </div>\n              </div>\n\n              <!-- Ghi chú cho Nhà cung cấp  -->\n              <div class=\"form-group supplier-field hidden\">\n                  <label class=\"form-label\">Ghi chú</label>\n                  <textarea name=\"notes\" class=\"form-textarea\" rows=\"3\">" + (isEdit ? escapeHtml(staff[COL.S_NOTES]) || "" : "") + "</textarea>\n              </div>\n              \n              <div class=\"flex justify-end space-x-3 mt-6\">\n                  <button type=\"button\" class=\"btn-secondary close-modal\">Hủy</button>\n                  <button type=\"submit\" class=\"btn-accent\">" + escapeHtml(text2) + "</button>\n              </div>\n          </form>\n      </div>\n  </div>\n";
}
function handleAdd(type, { luuNhap = false, guiDuyet = false } = {}) {
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
    const els = el.querySelectorAll('select[name="projectId"][disabled], select[name="assignee"][disabled]');
    els.forEach(el3 => {
      el3.name && el3.value && (data[el3.name] = el3.value);
    });
  }
  if (type === "task") thuGuiBldForm(el, data);
  if (type === "app") {
    const els = el.querySelectorAll("input[name=\"app-permissions\"]:checked"),
      mapped = Array.from(els).map(item => item.value);
    data[COL.A_PERMISSIONS] = mapped.join(", ");
  }
  // MỚI-5 (12/09/2026): cán bộ LẬP MỚI nhiệm vụ cấp 3 thì được chọn «Ban lãnh đạo kiểm soát», nên
  // phải GIỮ khoá đó lại — xoá như bản cũ thì máy chủ lại tự lấy người đầu của cấp 2 (Q12) và ô vừa
  // mở ra trên form thành vô nghĩa. Chỉ giữ khi người dùng THẬT SỰ có chọn: để trống thì vẫn xoá khoá
  // để máy chủ dùng mặc định, đúng hành vi cũ và không bao giờ sinh nhiệm vụ cấp 3 không có ai duyệt.
  // `leaderIds` (Lãnh đạo phòng phụ trách) VẪN xoá — người dùng không yêu cầu mở, và máy chủ cũng vẫn
  // từ chối (`assertAssignmentActor`). Form SỬA (`handleEdit` bên dưới) giữ nguyên van cũ.
  const giuBldksKhiLapMoi =
    type === "task" && Number(data.level) === 3 && String(data.supervisorIds || "").trim() !== "";
  if (["project", "task"].includes(type) && !laQuanTriTrongPhamVi() && !laLanhDaoPhong()) {
    // ĐỢT A (028): ô này nay tên `supervisorIds`. Vẫn xoá THÊM khoá cũ `supervisorId` vì trang đang
    // mở từ trước khi tải bản mới còn gửi khoá đó, và cầu RPC vẫn nhận nó — thiếu một khoá là Cán bộ
    // đổi được người duyệt kết quả của chính mình.
    if (!giuBldksKhiLapMoi) delete data.supervisorIds;
    delete data.supervisorId;
    delete data.leaderIds;
  }
  // «Lưu nháp» (012) chỉ có nghĩa với công việc/nhiệm vụ — cầu RPC chuyển thẳng khoá này thành
  // `saveAsDraft` của REST (rpc/table.js). Vai nào tạo cũng lưu nháp được (người dùng chốt cả 3 cấp).
  if (luuNhap && (type === "project" || type === "task")) data.saveAsDraft = true;
  // closeModal gỡ DOM — phải đọc dòng khai tạm TRƯỚC. Cấp 2 không có kết quả file (mustFindNhiemVu).
  let dongKhaiTam = [];
  if (type === "task" && Number(data.level) !== 2) dongKhaiTam = thuThapDongKhaiTam();
  if (type === "project" || type === "task") {
    return taoDauViecVaNapLai(type, data, { guiDuyet, dongKhaiTam, form: el });
  }
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
      if (type === "staff") {
        const index = allStaff.findIndex(staff => staff[COL.S_ID] === text);
        if (index !== -1) allStaff[index][COL.S_ID] = response.staffId;
        renderStaff();
      } else if (type === "app") {
        const index = allApps.findIndex(app => app[COL.A_ID] === text);
        if (index !== -1) allApps[index][COL.A_ID] = response.id;
        renderApps();
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
    const els = el.querySelectorAll('select[name="projectId"][disabled]');
    els.forEach(el3 => {
      el3.name && el3.name !== "id" && el3.value && (data[el3.name] = el3.value);
    });
  }
  if (type === "task") thuGuiBldForm(el, data);
  if (type === "app") {
    const els = el.querySelectorAll("input[name=\"app-permissions\"]:checked"),
      mapped = Array.from(els).map(item => item.value);
    data[COL.A_PERMISSIONS] = mapped.join(", ");
  }
  const id = formData.get("id");
  if (["project", "task"].includes(type) && !laQuanTriTrongPhamVi() && !laLanhDaoPhong()) {
    // ĐỢT A (028): ô này nay tên `supervisorIds`. Vẫn xoá THÊM khoá cũ `supervisorId` vì trang đang
    // mở từ trước khi tải bản mới còn gửi khoá đó, và cầu RPC vẫn nhận nó — thiếu một khoá là Cán bộ
    // đổi được người duyệt kết quả của chính mình.
    delete data.supervisorIds;
    delete data.supervisorId;
    delete data.leaderIds;
  }
  if (["project", "task"].includes(type) && proposal?.[COL.P_APPROVAL] === "Chờ duyệt" &&
      coQuyenTaiDong("approve", type, proposal) && typeof luuSuaVaQuyetDinh8b === "function") {
    return luuSuaVaQuyetDinh8b(type, proposal, data, el);
  }
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
      showToast(response.guiBldChange?.pending ? "Đã trình đề nghị đổi Gửi BLĐ; tích hiện tại giữ nguyên đến khi được duyệt." : type.charAt(0).toUpperCase() + type.slice(1) + " đã được cập nhật thành công!", "success");
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
  if (!isAuthenticated || typeof google === "undefined" || !google.script) return Promise.resolve(false);
  const nguoi = currentUser;
  return new Promise((resolve) => {
    google.script.run.withSuccessHandler(function (response) {
      if (!isAuthenticated || currentUser !== nguoi) { resolve(false); return; }
      if (response && response.success) {
        Promise.resolve(handleSuccessfulLogin(response)).then(() => resolve(true), error => {
          showToast("Không cập nhật được màn hình: " + error.message, "error");
          resolve(false);
        });
      } else {
        showToast((response && response.error) || "Lỗi khi tải dữ liệu", "error");
        resolve(false);
      }
    }).withFailureHandler(function (error) {
      showToast("Lỗi khi tải dữ liệu: " + error.message, "error");
      resolve(false);
    }).getDataForUser();
  });
}
/** Tạo xong mới đóng form; đọc lại trạng thái máy chủ, không suy từ trạng thái cha. */
async function taoDauViecVaNapLai(type, data, { guiDuyet, dongKhaiTam, form }) {
  if (form.dataset.dangLuu === "1") return;
  form.dataset.dangLuu = "1";
  const buttons = Array.from(form.querySelectorAll('button[type="submit"]'));
  buttons.forEach((b) => setButtonLoading(b, true));
  let created = false;
  try {
    const response = await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)
        [type === "project" ? "addProjectWithAuth" : "addTaskWithAuth"](data);
    });
    if (!response || !response.success) throw new Error((response && response.error) || "Không tạo được đầu việc");
    created = true;
    const ref = type === "project" ? response.projectId : response.taskId;
    const back = type === "project" ? { projectId: ref, projectName: data.name } : openedFromProjectDetails;
    // Tách đường đóng form khỏi closeModal: không hẹn 300ms nạp cây khi các dòng kết quả còn đang ghi.
    const resultsOk = !dongKhaiTam.length || await guiDongKhaiTam(ref, dongKhaiTam);
    if (await refreshData()) {
      if (guiDuyet && resultsOk) await guiDuyetSauKhiTao(type, ref, data);
      else if (guiDuyet && !resultsOk) showToast("Đã lưu đầu việc nhưng chưa gửi duyệt: hãy hoàn tất các dòng kết quả bị lỗi.", "error");
      const row = type === "project" ? allProjects.find(p => p[COL.P_ID] === ref) : allTasks.find(t => t[COL.T_ID] === ref);
      showToast("Đã lưu " + (type === "project" ? "công việc" : "đầu việc") + " — " + ((row && row[COL.P_APPROVAL]) || "hãy tải lại để kiểm tra trạng thái"), "success");
      if (form.isConnected) {
        openedFromProjectDetails = null;
        form.closest('.modal, .modal-overlay')?.remove();
        if (back) showProjectDetailsModal(back.projectId, back.projectName);
      }
    } else {
      showToast("Đã tạo đầu việc nhưng chưa tải lại được dữ liệu. Không tạo lại; hãy tải lại trang.", "error");
      if (form.isConnected) { openedFromProjectDetails = null; form.closest('.modal, .modal-overlay')?.remove(); }
    }
  } catch (error) {
    showToast((created ? "Đã tạo đầu việc; không tạo lại. " : "") + (error.message || String(error)), "error");
    if (created && form.isConnected) { openedFromProjectDetails = null; form.closest('.modal, .modal-overlay')?.remove(); }
  } finally {
    delete form.dataset.dangLuu;
    buttons.forEach((b) => setButtonLoading(b, false));
  }
}
/** Cấp 3 chỉ gửi cùng cây cha; không tự mở cửa duyệt riêng cho nhiệm vụ. */
async function guiDuyetSauKhiTao(type, ref, data) {
  const work = allProjects.find(p => p[COL.P_ID] === (type === "project" ? ref : data.projectId));
  const item = type === "task" ? allTasks.find(t => t[COL.T_ID] === ref) : null;
  const canGui = r => r && ["Nháp", "Từ chối"].includes(r[COL.P_APPROVAL]);
  if (canGui(work)) return guiDuyetCaCay("work", work[COL.P_ID]);
  if (item && Number(item[COL.T_LEVEL]) === 2 && canGui(item)) return guiDuyetCaCay("work-item", ref);
  const parent = item && allTasks.find(t => t[COL.T_ID] === item[COL.T_PARENT]);
  if (canGui(parent)) return guiDuyetCaCay("work-item", parent[COL.T_ID]);
  const row = item || work;
  if (row && row[COL.P_APPROVAL] === "Chờ duyệt") showToast("Đầu việc đã ở hàng chờ duyệt.", "info");
  else if (row && row[COL.P_APPROVAL] === "Đã duyệt") showToast("Đầu việc được máy chủ duyệt ngay theo quyền hiện tại; không cần gửi lại.", "info");
  else showToast("Chưa gửi duyệt: nhiệm vụ cấp 3 không gửi độc lập. Cần gửi cùng công việc/công việc con ở trạng thái Nháp hoặc Từ chối.", "error");
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
    "\"><i class=\"fas fa-pen-nib mr-2\"></i>" + escapeHtml("Lưu tạm") + "</button>"
  );
}
// Màn hình duyệt giữ ngữ cảnh cây; quyền approve cho phép sửa mục đang Chờ duyệt.
let cheDoDuyetChiDoc = false;
function laCheDoDuyetChiDoc() {
  return false; // Người duyệt sửa được nội dung theo quyền hiện tại; cờ còn để theo dõi màn duyệt.
}
/** Mở modal chi tiết để duyệt, và tự tắt cờ khi modal đóng. */
/** Mở modal duyệt ngay từ bootstrap hiện có, rồi làm mới authoritative ở nền. */
function moChiTietCheDoDuyet(maCongViec, tenCongViec) {
  const ve = () => {
    const project = allProjects.find(p => String(p[COL.P_ID]) === String(maCongViec));
    if (!project) {
      showToast("Không tìm thấy công việc hoặc bạn không còn quyền xem.", "error");
      return false;
    }
    cheDoDuyetChiDoc = true;
    showProjectDetailsModal(project[COL.P_ID], project[COL.P_NAME] || tenCongViec);
    const modal = document.getElementById("project-details-modal");
    if (!modal) {
      cheDoDuyetChiDoc = false;
      return false;
    }
    modal.querySelectorAll(".close-modal").forEach((nut) => {
      nut.addEventListener("click", () => { cheDoDuyetChiDoc = false; }, { once: true });
    });
    return true;
  };
  // getDataForUser is the authoritative legacy bootstrap. Render its current snapshot first so the
  // action is usable without a second click; then replace it only while this modal is still open.
  if (!allProjects.some(p => String(p[COL.P_ID]) === String(maCongViec))) {
    return refreshData().then(ok => { if (ok) ve(); });
  }
  if (!ve()) return;
  if (typeof lamMoiChiTiet8b === "function") return;
  if (typeof google === "undefined" || !google.script || typeof refreshData !== "function") return;
  const modalBefore = document.getElementById("project-details-modal");
  refreshData().then((ok) => {
    if (!ok || !modalBefore || !modalBefore.isConnected || !cheDoDuyetChiDoc) return;
    ve();
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
  if (status === "Đã duyệt đủ kết quả") return "status-completed";
  if (String(status).includes("Quá hạn")) return "status-overdue";
  return "status-pending";
}
function getStatusIconClass(status) {
  return status === "Đã duyệt đủ kết quả" ? "text-green-500" : "text-gray-500";
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
  return allProjects.filter(p => coQuyenTaiDong("read", "project", p));
}
function canUserCreateTask(projectId = null) {
  if (projectId != null) return coQuyenTaoTrongCongViec("task", allProjects.find(p => String(p[COL.P_ID]) === String(projectId)));
  return coQuyenTrongPhamVi("task", "create") && congViecChoForm("task").length > 0;
}
function canUserCreateSubwork(projectId = null) {
  if (projectId != null) return coQuyenTaoTrongCongViec("subwork", allProjects.find(p => String(p[COL.P_ID]) === String(projectId)));
  return coQuyenTrongPhamVi("subwork", "create") && congViecChoForm("subwork").length > 0;
}
function createSubworkFromWorkButtonHtml(projectId, projectName, className, withLabel) {
  if (!canUserCreateSubwork(projectId)) return "";
  return "<button type=\"button\" class=\"" + escapeHtml(className) + " add-subwork-from-work-btn\" data-project-id=\"" + escapeHtml(projectId) + "\" data-project-name=\"" + escapeHtml(projectName) + "\" title=\"+ công việc con\">" + (withLabel ? "<i class=\"fas fa-layer-group mr-1\"></i>+ công việc con" : "<i class=\"fas fa-layer-group\"></i>") + "</button>";
}
function createTaskFromSubworkButtonHtml(task, className) {
  if (Number(task && task[COL.T_LEVEL]) !== 2 || !canUserCreateTask(task[COL.T_PID])) return "";
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
        num = tienDoDauMucKhach(filteredTasks),
        flag = new Date() > projectEndDate && !daDuyetDuKetQua(project),
        projectStartText = formatDateForGantt(project[COL.P_START]),
        projectEndText = formatDateForGantt(project[COL.P_END]),
        projectDesc = project[COL.P_DESC] || "Không có mô tả",
        projectId = project[COL.P_ID];
      text3 += "\n            <div class=\"gantt-project-group\" data-project-id=\"" + escapeHtml(projectId) + "\">\n              <div class=\"gantt-item\" data-id=\"" + escapeHtml(projectId) + "\" data-type=\"project\">\n                <div class=\"gantt-item-label\">\n                  <button class=\"gantt-toggle-btn mr-2\" data-project=\"" + escapeHtml(projectId) + "\">\n                    <i class=\"fas fa-chevron-right\"></i>\n                  </button>\n                  <i class=\"fas fa-folder " + escapeHtml(getStatusIconClass(nhanHoanThanhKetQua(project))) + " mr-2\"></i>\n                  <span class=\"truncate\">" + escapeHtml(project[COL.P_NAME]) + "</span>\n                  <span class=\"gantt-task-count\">" + filteredTasks.length + "</span>\n                  \n                  <div class=\"gantt-item-actions\">\n                    " + createSubworkFromWorkButtonHtml(projectId, project[COL.P_NAME], "action-btn action-btn-edit mr-1") + "\n                    <button class=\"action-btn action-btn-edit add-task-from-project-btn mr-1\" data-project-id=\"" + escapeHtml(projectId) + "\" data-project-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Thêm nhiệm vụ\">\n                      <i class=\"fas fa-plus\"></i>\n                    </button>\n                    <button class=\"action-btn action-btn-view view-project-btn mr-1\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Xem chi tiết\">\n                      <i class=\"fas fa-eye\"></i>\n                    </button>\n                    " + (canUserCopyResource("project", project[COL.P_ID]) ? "\n                      <button class=\"action-btn action-btn-copy copy-btn mr-1\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Tạo bản sao\">\n                        <i class=\"fas fa-copy\"></i>\n                      </button>\n                    " : "") + "\n                    " + (canUserEditResource("project", project[COL.P_ID]) ? "\n                      <button class=\"action-btn action-btn-edit edit-btn mr-1\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" title=\"Chỉnh sửa\">\n                        <i class=\"fas fa-edit\"></i>\n                      </button>\n                    " : "") + "\n                    " + (canUserDeleteResource("project", project[COL.P_ID]) ? "\n                      <button class=\"action-btn action-btn-delete delete-btn\" data-type=\"project\" data-id=\"" + escapeHtml(projectId) + "\" data-name=\"" + escapeHtml(project[COL.P_NAME]) + "\" title=\"Xóa\">\n                        <i class=\"fas fa-trash\"></i>\n                      </button>\n                    " : "") + "\n                  </div>\n                </div>\n                \n                <div class=\"gantt-item-timeline\">\n                  <div class=\"gantt-bar gantt-bar-project " + (flag ? "gantt-bar-overdue" : "") + "\" style=\"" + escapeHtml(projectBarStyle) + "\" data-tooltip=\"" + escapeHtml(project[COL.P_NAME]) + ": " + escapeHtml(projectDesc) + "\">\n                    <div class=\"gantt-bar-label\">" + escapeHtml(projectStartText) + " - " + escapeHtml(projectEndText) + ": " + escapeHtml(projectDesc) + "</div>\n                    <div class=\"gantt-progress\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                  </div>\n                </div>\n              </div>\n              \n              <div class=\"gantt-project-tasks hidden\" id=\"gantt-tasks-" + escapeHtml(projectId) + "\">\n        " + filteredTasks.map(filteredTask => {
        const taskStartDate = parseDateString(filteredTask[COL.T_START]),
          taskDueDate = parseDateString(filteredTask[COL.T_DUE]),
          date2 = new Date(project[COL.P_END]);
        if (true) {
          const taskBarStyle = calculateGanttBarStyleRange(taskStartDate, taskDueDate, ganttStartDate, ganttEndDate, text),
            num2 = parseInt(filteredTask[COL.T_COMPLETION] || 0),
            isTaskOverdue2 = isTaskOverdue(filteredTask[COL.T_DUE]) && !daDuyetDuKetQua(filteredTask),
            taskAssignee = filteredTask[COL.T_ASSIGNEE] || "Chưa gán",
            taskStatus = nhanHoanThanhKetQua(filteredTask),
            taskPriority = filteredTask[COL.T_PRIORITY] || "Trung bình",
            taskStartText = formatDateForGantt(filteredTask[COL.T_START]),
            taskDueText = formatDateForGantt(filteredTask[COL.T_DUE]),
            taskDesc = filteredTask[COL.T_DESC] || "Không có mô tả",
            taskResultLinks = filteredTask[COL.T_RESULT_LINKS] || "",
            flag2 = parseLinks(taskResultLinks).length > 0,
            taskReminders = filteredTask[COL.T_REMINDERS] || [],
            isArray = Array.isArray(taskReminders) && taskReminders.length > 0,
            hasMatch = daDuyetDuKetQua(filteredTask);
          return "\n                    <div class=\"gantt-item gantt-task-item draggable-item\" \n                        data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" \n                        data-type=\"task\" \n                        data-project-id=\"" + escapeHtml(filteredTask[COL.T_PID]) + "\"\n                        draggable=\"true\">\n                      <div class=\"gantt-item-label task-clickable cursor-pointer\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\">\n                        \n                              \n                        <i class=\"fas fa-circle " + escapeHtml(getStatusIcon(taskStatus)) + " mr-2\" style=\"font-size: 8px;\"></i>\n                        <div class=\"flex flex-col min-w-0\">\n                          <span class=\"truncate flex items-center\">" + (isArray ? "<i class=\"fas fa-bell text-amber-500 flex-shrink-0\" style=\"margin-right: 1px; font-size: 10px;\" title=\"Có nhắc việc\"></i>" : "") + (taskPriority.toLowerCase().includes("cao") ? "<i class=\"fas fa-star text-yellow-400 flex-shrink-0\" style=\"margin-right: 2px; font-size: 10px;\"></i>" : "") + escapeHtml(filteredTask[COL.T_NAME]) + "</span>\n                          <span class=\"text-xs text-gray-500 truncate\">" + escapeHtml(taskAssignee) + " - " + escapeHtml(taskStatus) + " - " + escapeHtml(taskPriority) + "</span>\n                          " + (flag2 ? "<div class=\"mt-1\">" + renderLinksButton(taskResultLinks, filteredTask[COL.T_ID]) + "</div>" : "") + "\n                        </div>\n                        \n                        <div class=\"gantt-item-actions\">\n                          " + (() => {
            const project2 = project && project[COL.P_MANAGER] === currentUser.name,
              isAdmin2 = { copy: canUserCopyResource("task", filteredTask[COL.T_ID]), delete: canUserDeleteResource("task", filteredTask[COL.T_ID]) };
            return "\n                              " + createTaskFromSubworkButtonHtml(filteredTask, "action-btn action-btn-edit mr-1") + "\n                              " + (isAdmin2.copy ? "<button class=\"action-btn action-btn-copy copy-btn mr-1\" data-type=\"task\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" data-name=\"" + escapeHtml(filteredTask[COL.T_NAME]) + "\" title=\"Tạo bản sao\"><i class=\"fas fa-copy\"></i></button>" : "") + "\n                              <button class=\"action-btn action-btn-edit edit-btn mr-1\" data-type=\"task\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" title=\"Chỉnh sửa\"><i class=\"fas fa-edit\"></i></button>\n                              " + (isAdmin2.delete ? "<button class=\"action-btn action-btn-delete delete-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredTask[COL.T_ID]) + "\" data-name=\"" + escapeHtml(filteredTask[COL.T_NAME]) + "\" title=\"Xóa\"><i class=\"fas fa-trash\"></i></button>" : "") + "\n                              ";
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
  return getStatusIconClass(status);
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
  if (!["project", "subwork", "task"].includes(resourceType)) return false;
  const scope = dongPhamViQuyen(resourceType, resourceId);
  if (!scope || !coQuyenTrongPhamVi(scope.entity, "read", scope)) return false;
  return coQuyenTrongPhamVi(scope.entity, "create", scope);
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
      done = daDuyetDuKetQua(list2);
    return lower.includes("cao") && !done;
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
        isAdmin2 = { copy: canUserCopyResource("task", filteredList2[COL.T_ID]), delete: canUserDeleteResource("task", filteredList2[COL.T_ID]) };
      return "\n              " + (isAdmin2.copy ? "<button class=\"action-btn action-btn-copy copy-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredList2[COL.T_ID]) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Tạo bản sao\"><i class=\"fas fa-copy\"></i></button>" : "") + "\n              <button class=\"action-btn action-btn-edit edit-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredList2[COL.T_ID]) + "\" title=\"Chỉnh sửa\"><i class=\"fas fa-edit\"></i></button>\n              " + (isAdmin2.delete ? "<button class=\"action-btn action-btn-delete delete-btn\" data-type=\"task\" data-id=\"" + escapeHtml(filteredList2[COL.T_ID]) + "\" data-name=\"" + escapeHtml(taskName) + "\" title=\"Xóa\"><i class=\"fas fa-trash\"></i></button>" : "") + "\n            ";
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
    const taskReportDate = filteredTask.hoanThanhLuc;
    if (daDuyetDuKetQua(filteredTask) && taskReportDate) try {
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
      count = filteredFilteredTasks.filter(filteredFilteredTask => daDuyetDuKetQua(filteredFilteredTask)).length,
      // Bug 2 (8b): completionRate theo server (tienDo.js) — bình quân gia quyền các đầu mục;
      // `completedTasks` giữ nguyên để tooltip số lượng không đổi hình dạng.
      num = tienDoDauMucKhach(filteredFilteredTasks);
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
        [COL.T_PRIORITY]: user.priority || "Trung bình",
        [COL.T_START]: user.startDate,
        [COL.T_DUE]: user.dueDate,
        // Bug 2 (8b): tiến độ do server tính từ file kết quả — dòng tạm không tự bịa số; tỷ lệ
        // theo người dùng nhập (server chia đều khi vắng).
        [COL.T_COMPLETION]: 0,
        [COL.T_TY_LE]: parseInt(user.tyLe || 0)
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
          [COL.T_PRIORITY]: user.priority,
          [COL.T_START]: user.startDate,
          [COL.T_DUE]: user.dueDate,
          // Bug 2 (8b): KHÔNG ghi đè «Tiến độ (%)» — số này server tính từ file kết quả, spread giữ
          // nguyên giá trị cũ đến khi refreshData về; tỷ lệ chỉ đổi khi người dùng thực sự gửi tyLe.
          [COL.T_TY_LE]: parseInt(user.tyLe || allTasks[taskIndex][COL.T_TY_LE] || 0)
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
    const ref = projectDetailsModalEl.dataset.projectId;
    const match = ref ? ["", ref] : (projectDetailsModalEl.querySelector("h3")?.textContent || "").match(/\(([^)]+)\)$/);
    if (match && match[1]) {
      const match2 = match[1],
        project = allProjects.find(project2 => project2[COL.P_ID] === match2);
      if (project) {
        const receiptsChecked = projectDetailsModalEl.dataset.receiptsChecked;
        showProjectDetailsModal(match2, project[COL.P_NAME], { receiptsChecked, daLamMoi: true });
      }
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
  const rows = dsNhiemVuToiDuocThay().filter((row) => Number(row[COL.T_LEVEL]) === 3 && isCountableRow(row) && taskMatchesTasksFilters(row));
  const done = rows.filter(daDuyetDuKetQua).length;
  const values = { total: rows.length, completed: done, incomplete: rows.length - done, overdue: rows.filter((row) => !daDuyetDuKetQua(row) && isTaskOverdue(row[COL.T_DUE])).length };
  Object.entries(values).forEach(([key,value])=>{const el=document.getElementById('tasks-'+key+'-count');if(el)el.textContent=value;});
}
function renderProjectStats() {
  const rows = getUserAllowedProjects().filter((row)=>isCountableRow(row) && workMatchesMonth(row) && workMatchesProjectsDept(row));
  const done = rows.filter(daDuyetDuKetQua).length;
  Object.entries({total:rows.length,completed:done,incomplete:rows.length-done}).forEach(([key,value])=>{const el=document.getElementById('projects-'+key+'-count');if(el)el.textContent=value;});
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

/* ============================================================================
 * CHUÔNG THÔNG BÁO (2026-09-06 — §13.4 mục 16 chốt phương án b)
 *
 * Máy chủ đã ghi thông báo từ lâu (duyệt, ủy quyền, kết quả file, quá hạn) nhưng KHÔNG có đường
 * đọc nên không ai thấy. Nay có ba đường REST — `GET /notifications`,
 * `GET /notifications/unread-count`, `PATCH /notifications/read` — và chúng KHÔNG có tên RPC:
 * gọi thẳng bằng `restGetIm`/`restGhi` như phần ủy quyền, nên cầu tương thích vẫn đúng 37 tên.
 *
 * Ba quyết định đáng ghi:
 *  1. **Hỏi lại 60 giây, không 10 giây như chat.** Thông báo phê duyệt là việc thưa; mỗi lượt là
 *     một `count(*)` trên `notifications`. Và CHỈ hỏi khi tab đang hiện — chat đang bỏ sót điều
 *     này nên một tab để quên vẫn nã request suốt ngày.
 *  2. **Badge có số ngay lần vẽ đầu** từ `data.unreadCount` của gói đăng nhập, không chờ fetch.
 *  3. **Bấm vào thông báo thì mở đúng mục** theo `ref_type`/`ref_id` — thông báo mà không dẫn tới
 *     việc cần làm thì người dùng phải tự đi tìm, đọc xong vẫn chưa xử được gì.
 * ========================================================================== */
const THONG_BAO_POLL_MS = 60000, THONG_BAO_TOI_DA = 30;
let thongBaoTimer = null, thongBaoDanhSach = [];

/** Icon + màu theo cột `type` của CSDL. Khoá lạ ⇒ hình chuông xám, không để trống ô. */
const THONG_BAO_LOAI = {
  approval_pending: { icon: "fa-hourglass-half", mau: "text-amber-600" },
  approval_approved: { icon: "fa-circle-check", mau: "text-green-600" },
  approval_rejected: { icon: "fa-circle-xmark", mau: "text-red-600" },
  overdue: { icon: "fa-triangle-exclamation", mau: "text-orange-600" },
  warning: { icon: "fa-triangle-exclamation", mau: "text-amber-600" },
  error: { icon: "fa-circle-xmark", mau: "text-red-600" },
  success: { icon: "fa-circle-check", mau: "text-green-600" },
  info: { icon: "fa-bell", mau: "text-blue-600" }
};

/** Một dòng thông báo. Tên `build*` là BẮT BUỘC: bộ soát XSS xếp hàm khác tên thành `CAN-THOAT`. */
function buildMotThongBao(row) {
  const loai = THONG_BAO_LOAI[String(row.type || "")] || { icon: "fa-bell", mau: "text-gray-500" },
    chuaDoc = row.is_read !== true,
    ref = String(row.ref_type || ""),
    refId = row.ref_id == null ? "" : String(row.ref_id),
    moDuoc = refId !== "" && ["work", "work_item", "task_file"].includes(ref);
  return "<button type=\"button\" class=\"tb-dong w-full text-left px-4 py-3 border-b border-gray-100/50 hover:bg-blue-50/60 transition-colors " +
    (chuaDoc ? "bg-blue-50/30" : "") + "\" data-id=\"" + escapeHtmlAttr(String(row.id)) +
    "\" data-ref=\"" + escapeHtmlAttr(ref) + "\" data-ref-id=\"" + escapeHtmlAttr(refId) +
    "\" data-mo=\"" + (moDuoc ? "1" : "") + "\">" +
    "<div class=\"flex items-start gap-3\">" +
    "<i class=\"fas " + escapeHtmlAttr(loai.icon) + " " + escapeHtmlAttr(loai.mau) + " mt-0.5\"></i>" +
    "<div class=\"flex-1 min-w-0\">" +
    "<p class=\"text-sm " + (chuaDoc ? "font-semibold text-gray-900" : "text-gray-600") + "\">" +
    escapeHtml(String(row.content || "")) + "</p>" +
    "<p class=\"text-xs text-gray-400 mt-1\">" + escapeHtml(dinhDangGioThongBao(row.created_at)) +
    (moDuoc ? " · bấm để mở" : "") + "</p>" +
    "</div>" +
    (chuaDoc ? "<span class=\"w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0\"></span>" : "") +
    "</div></button>";
}

/** Cả danh sách. Rỗng thì nói rõ là rỗng, không để hộp trắng trơn. */
function buildDanhSachThongBao(items) {
  if (!items || items.length === 0) {
    return "<div class=\"text-center text-gray-500 text-sm py-6\"><i class=\"fas fa-bell-slash text-2xl mb-2 block text-gray-300\"></i>Chưa có thông báo nào</div>";
  }
  return items.map(row => buildMotThongBao(row)).join("");
}

/** «14:05 hôm nay» / «hôm qua» / «dd/mm/yyyy» — mốc thời gian đọc được, không phải ISO. */
function dinhDangGioThongBao(giaTri) {
  const d = giaTri ? new Date(giaTri) : null;
  if (!d || isNaN(d.getTime())) return "";
  const hai = n => String(n).padStart(2, "0"),
    gio = hai(d.getHours()) + ":" + hai(d.getMinutes()),
    homNay = new Date(), homQua = new Date(homNay.getTime() - 86400000);
  if (d.toDateString() === homNay.toDateString()) return gio + " hôm nay";
  if (d.toDateString() === homQua.toDateString()) return gio + " hôm qua";
  return gio + " " + hai(d.getDate()) + "/" + hai(d.getMonth() + 1) + "/" + d.getFullYear();
}

/** Con số trên badge. 0 ⇒ ẩn hẳn, không hiện «0» (cùng cách `updateChatBadge` làm). */
function capNhatBadgeThongBao(soChuaDoc) {
  const badge = document.getElementById("thong-bao-badge");
  if (!badge) return;
  const n = Number(soChuaDoc) || 0;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.classList.toggle("hidden", n === 0);
}

/**
 * Nạp danh sách + badge. Gọi khi mở hộp chuông và sau mỗi lần duyệt/gửi duyệt.
 *
 * `restGetIm` (im lặng) chứ không `restGet`: một lượt mạng chập chờn không được nổ toast hay đá
 * người dùng ra modal đăng nhập giữa lúc họ đang làm việc khác.
 */
async function napThongBao() {
  const khung = document.getElementById("thong-bao-danh-sach");
  const duLieu = await restGetIm("/api/v1/notifications?limit=" + THONG_BAO_TOI_DA);
  if (!duLieu) {
    if (khung && thongBaoDanhSach.length === 0) {
      khung.innerHTML = "<div class=\"text-center text-gray-500 text-sm py-6\">Chưa tải được thông báo — thử lại sau</div>";
    }
    return 0;
  }
  thongBaoDanhSach = duLieu.items || [];
  if (khung) khung.innerHTML = buildDanhSachThongBao(thongBaoDanhSach);
  capNhatBadgeThongBao(duLieu.unread);
  return Number(duLieu.unread) || 0;
}

/** Chỉ con số — dùng cho vòng hỏi lại, không vẽ lại danh sách đang mở dưới tay người dùng. */
async function napSoThongBaoChuaDoc() {
  const duLieu = await restGetIm("/api/v1/notifications/unread-count");
  if (!duLieu) return;
  capNhatBadgeThongBao(duLieu.unread);
}

/** `ids` rỗng ⇒ đánh dấu tất cả của mình. Máy chủ trả `unread` mới nên không tự trừ ở trình duyệt. */
async function danhDauThongBaoDaDoc(ids) {
  const kq = await restGhi("PATCH", "/api/v1/notifications/read", { ids: ids || [] });
  if (!kq.ok) {
    showToast(kq.error || "Không đánh dấu được thông báo đã đọc", "error");
    return;
  }
  capNhatBadgeThongBao(kq.data && kq.data.unread);
  await napThongBao();
}

/**
 * Bấm một dòng: đánh dấu đã đọc, rồi mở đúng mục nếu thông báo có trỏ tới đâu.
 *
 * `ref_id` là id CSDL, còn giao diện cũ tra theo MÃ (`COL.P_ID`/`COL.T_ID`) — nên dò trong
 * `allProjects`/`allTasks` bằng `id` để lấy mã. Không tìm thấy (chưa nạp, hoặc ngoài phạm vi
 * người này thấy được) thì chỉ đánh dấu đã đọc, KHÔNG bịa ra mã để mở.
 */
async function moThongBao(nut) {
  if (!nut) return;
  const id = Number(nut.getAttribute("data-id")),
    ref = String(nut.getAttribute("data-ref") || ""),
    refId = String(nut.getAttribute("data-ref-id") || "");
  if (Number.isInteger(id) && id > 0) await danhDauThongBaoDaDoc([id]);
  if (nut.getAttribute("data-mo") !== "1") return;
  if (ref === "task_file") {
    const duLieu = await restGetIm("/api/v1/task-files/lenh-sua");
    if (!duLieu) {
      showToast("Chưa tải được lệnh sửa — hãy thử lại", "error");
      return;
    }
    demLenhSuaCuaToi = { nguoiId: currentUser?.id, soLenh: (duLieu.items || []).length };
    tabChoDuyetHienTai = (duLieu.items || []).some(row => String(row.id) === refId)
      || currentUser?.role === "Nhân viên" ? "lenh-sua" : "ket-qua";
    switchSection("cho-duyet");
    return;
  }
  if (ref === "work") {
    const cv = allProjects.find(p => String(p.id) === refId || String(p[COL.P_ID]) === refId);
    if (cv) showProjectDetailsModal(cv[COL.P_ID], cv[COL.P_NAME]);
    else showToast("Không mở được công việc — hãy tải lại trang rồi thử lại", "error");
    return;
  }
  const nv = allTasks.find(t => String(t.id) === refId || String(t[COL.T_ID]) === refId);
  if (nv) openEditModal("task", nv[COL.T_ID]);
  else showToast("Không mở được đầu việc — hãy tải lại trang rồi thử lại", "error");
}

/**
 * Gắn listener MỘT lần. Uỷ nhiệm ở khung ngoài chứ không gắn từng dòng: danh sách bị vẽ lại mỗi
 * lượt nạp, gắn từng dòng là rò listener theo số lần mở hộp.
 */
function goiNutThongBao() {
  const khung = document.getElementById("thong-bao-danh-sach");
  if (khung && khung.dataset.daNoi !== "1") {
    khung.dataset.daNoi = "1";
    khung.addEventListener("click", event => {
      const nut = event.target.closest(".tb-dong");
      if (nut) moThongBao(nut);
    });
  }
  const docHet = document.getElementById("thong-bao-doc-het");
  if (docHet && docHet.dataset.daNoi !== "1") {
    docHet.dataset.daNoi = "1";
    docHet.addEventListener("click", () => danhDauThongBaoDaDoc([]));
  }
}

/**
 * Vòng hỏi lại. CHỈ hỏi khi tab đang hiện: tab để quên trong nền không cần biết ngay, và một người
 * mở 5 tab thì máy chủ nhận 5 lần `count(*)` mỗi phút mà không ai đọc kết quả.
 */
function batDauHoiLaiThongBao() {
  dungHoiLaiThongBao();
  thongBaoTimer = setInterval(() => {
    if (!isAuthenticated) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    napSoThongBaoChuaDoc();
  }, THONG_BAO_POLL_MS);
}
function dungHoiLaiThongBao() {
  thongBaoTimer && (clearInterval(thongBaoTimer), thongBaoTimer = null);
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
    if (event.target.closest("button") || event.target.closest("a") || event.target.matches("input[type=\"checkbox\"]")) return;
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
          return !daDuyetDuKetQua(task);
        });else filter === "overdue" && (list = allTasks.filter(task => isTaskOverdue(task[COL.T_DUE]) && !daDuyetDuKetQua(task)));
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
        projectStatus = nhanHoanThanhKetQua(item),
        projectManager = item[COL.P_MANAGER] || "N/A",
        startDateText = formatDateForDisplay(item[COL.P_START]),
        endDateText = formatDateForDisplay(item[COL.P_END]),
        filteredTasks = allTasks.filter(task => task[COL.T_PID] === projectId),
        num = tienDoDauMucKhach(filteredTasks);
      return "\n            <div class=\"stat-list-item rounded-xl border border-gray-100 hover:border-blue-200 bg-white p-3 mb-2 shadow-sm transition-all\" \n                  onclick=\"showProjectDetailsModal('" + escapeForInlineHandler(projectId) + "', '" + escapeForInlineHandler(projectName) + "')\">\n                \n                <div class=\"flex justify-between items-start mb-2\">\n                    <div>\n                        <div class=\"font-bold text-gray-800 text-sm\">" + escapeHtml(projectName) + " <span class=\"text-gray-400 font-normal text-xs ml-1\">(" + escapeHtml(projectId) + ")</span></div>\n                        <div class=\"text-xs text-gray-500 mt-1 flex items-center gap-3\">\n                            <span><i class=\"fas fa-user-tie mr-1 text-purple-500\"></i>" + escapeHtml(projectManager) + "</span>\n                            <span><i class=\"fas fa-calendar-alt mr-1 text-blue-500\"></i>" + escapeHtml(startDateText) + " - " + escapeHtml(endDateText) + "</span>\n                        </div>\n                    </div>\n                    <span class=\"status-badge " + escapeHtml(getStatusClass(projectStatus)) + "\">" + escapeHtml(projectStatus) + "</span>\n                </div>\n\n                <div class=\"flex items-center gap-2\">\n                    <div class=\"flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden\">\n                        <div class=\"h-full bg-blue-500 rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                    </div>\n                    <span class=\"text-xs font-medium text-gray-600 min-w-[30px] text-right\">" + escapeHtml(num) + "%</span>\n                </div>\n            </div>\n        ";
    } else {
      const taskId = item[COL.T_ID],
        taskName = item[COL.T_NAME],
        taskStatus = nhanHoanThanhKetQua(item),
        taskPriority = item[COL.T_PRIORITY],
        taskAssignee = item[COL.T_ASSIGNEE] || "N/A",
        dueDateText = formatDateForDisplay(item[COL.T_DUE]),
        num = parseInt(item[COL.T_COMPLETION] || 0),
        isTaskOverdue2 = isTaskOverdue(item[COL.T_DUE]) && !daDuyetDuKetQua(item),
        project = allProjects.find(project2 => project2[COL.P_ID] === item[COL.T_PID]),
        projectName = project ? project[COL.P_NAME] : item[COL.T_PID];
      return "\n            <div class=\"stat-list-item rounded-xl border border-gray-100 hover:border-blue-200 bg-white p-3 mb-2 shadow-sm transition-all " + (isTaskOverdue2 ? "border-l-4 border-l-red-500" : "") + "\" \n                  onclick=\"if(canUserEditResource('task', '" + escapeForInlineHandler(taskId) + "')) openEditModal('task', '" + escapeForInlineHandler(taskId) + "')\">\n                \n                <div class=\"flex justify-between items-start mb-1\">\n                    <div class=\"flex-1 pr-2\">\n                        <div class=\"font-semibold text-gray-800 text-sm leading-snug\">" + escapeHtml(taskName) + "</div>\n                    </div>\n                    \n                    <div class=\"flex items-center gap-2 shrink-0\">\n                        <span class=\"status-badge " + escapeHtml(getStatusClass(taskStatus)) + "\">" + escapeHtml(taskStatus) + "</span>\n                        " + (isTaskOverdue2 ? "<span class=\"status-badge status-overdue\">Quá hạn</span>" : "") + "\n                    </div>\n                </div>\n\n                <div class=\"grid grid-cols-2 gap-y-1 text-xs text-gray-500 mt-1 mb-2\">\n                    <div class=\"col-span-2 flex items-center text-gray-600 font-medium\">\n                        <i class=\"fas fa-folder-open mr-1.5 text-yellow-500\"></i>" + escapeHtml(projectName) + "\n                    </div>\n                    <div class=\"flex items-center\">\n                        <i class=\"fas fa-user mr-1.5 text-blue-400\"></i>" + escapeHtml(taskAssignee) + "\n                    </div>\n                    <div class=\"flex items-center justify-end\">\n                        <i class=\"fas fa-clock mr-1.5 " + (isTaskOverdue2 ? "text-red-500" : "text-green-500") + "\"></i>" + escapeHtml(dueDateText) + "\n                    </div>\n                </div>\n\n                <div class=\"flex items-center gap-2\">\n                    <div class=\"flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden\">\n                        <div class=\"h-full " + (daDuyetDuKetQua(item) ? "bg-green-500" : "bg-blue-500") + " rounded-full\" style=\"width: " + escapeHtml(num) + "%\"></div>\n                    </div>\n                    <span class=\"text-xs font-medium text-gray-600 min-w-[30px] text-right\">" + escapeHtml(num) + "%</span>\n                </div>\n            </div>\n        ";
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
    text3 = task ? "\n            <div class=\"bg-gray-50 p-3 rounded-lg text-sm space-y-1 mt-2\" id=\"task-details-preview\">\n                <p><strong>Nhiệm vụ:</strong> " + escapeHtml(task[COL.T_NAME]) + "</p>\n                <p><strong>Người thực hiện trực tiếp:</strong> " + (escapeHtml(task[COL.T_ASSIGNEE]) || "Chưa gán") + "</p>\n                <p><strong>Duyệt kết quả:</strong> " + escapeHtml(nhanHoanThanhKetQua(task)) + "</p>\n                <p><strong>Tiến độ:</strong> " + (escapeHtml(task[COL.T_COMPLETION]) || 0) + "%</p>\n            </div>\n        " : "",
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
  taskDetailsContainerEl.innerHTML = "\n            <div class=\"bg-gray-50 p-3 rounded-lg text-sm space-y-1 mt-2\">\n                <p><strong>Nhiệm vụ:</strong> " + escapeHtml(task[COL.T_NAME]) + "</p>\n                <p><strong>Người thực hiện trực tiếp:</strong> " + (escapeHtml(task[COL.T_ASSIGNEE]) || "Chưa gán") + "</p>\n                <p><strong>Duyệt kết quả:</strong> " + escapeHtml(nhanHoanThanhKetQua(task)) + "</p>\n                <p><strong>Tiến độ:</strong> " + (escapeHtml(task[COL.T_COMPLETION]) || 0) + "%</p>\n                " + (task[COL.T_DUE] ? "<p><strong>Hạn chót:</strong> " + escapeHtml(formatDateForDisplay(task[COL.T_DUE])) + "</p>" : "") + "\n            </div>\n        ";
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
    vaiTroApp = [["admin", "Toàn quyền"], ["Phó Giám đốc", "Phòng phụ trách"], ["Trưởng phòng", "Cả phòng"], ["Phó phòng", "Cả phòng"], ["Nhân viên", "Việc của mình"]],
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
    quaHan = isTaskOverdue(task.dueDate) && !daDuyetDuKetQua(task),
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
 *     Người thực hiện (gom từ nhiệm vụ trong cây) · Tiến độ.
 *   • Nhiệm vụ: tên đầy đủ · Lãnh đạo phòng phụ trách · Người thực hiện · Tiến độ ·
 *     Kết quả đầu ra. (Chữ cán bộ cạnh tên đã BỎ khỏi hàng — xem createGanttTaskRowHtml.)
 * Nhãn đổi từ «Cán bộ thực hiện» sang «Người thực hiện» ngày 2026-09-09: Trưởng/Phó phòng nay
 * cũng nhận việc trực tiếp được, gọi chung là "cán bộ" là sai.
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
    escapeHtml("Người thực hiện") +
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
    if (!res.ok) {
      let message = "HTTP " + res.status;
      try { const json = await res.json(); if (json?.error?.message) message = json.error.message; } catch {}
      throw new Error(message);
    }
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
async function restGetIm(path, options = {}) {
  try {
    const res = await fetch(path, { ...options, credentials: "same-origin", headers: { Accept: "application/json" } });
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
  return isAuthenticated && !!currentUser && ["work", "subwork", "task"].some(entity => coQuyenTrongPhamVi(entity, "approve"));
}

/**
 * BUILDER: một dòng trong «Chờ duyệt» — mọi giá trị user-data đều qua escape.
 *
 * Vòng 13: cả CÂY gửi duyệt một lần nên máy chủ chỉ trả GỐC cây (`repo.listPending`), và dòng có
 * ba nút — Xem chi tiết (đọc cả cây trước khi ký) / Duyệt / Trả lại để sửa — cùng nút Từ chối vốn
 * có. Dòng cấp 2/3 gửi LẺ mang `title` là tên công việc cấp 1 (`work_name`): thiếu nó thì người
 * duyệt thấy một cái tên trơ, không rõ thuộc việc nào.
 *
 * MỚI-3 (2026-09-12): dòng mang HAI nhãn — «đây là duyệt cái gì» (Mới tạo / Sửa / Xoá) và «của đối
 * tượng nào» (Công việc cha / Công việc con / Nhiệm vụ / File kết quả). Người dùng: «thêm cột thông
 * tin về đây là duyệt công việc mới tạo, hay sửa chữa/xóa … công việc cha, công việc con., nhiệm vụ,
 * file kết quả». Cờ `da_sua` và mốc `moc_xu_ly` do `repo.listPending` tính từ `activity_logs`; giao
 * diện KHÔNG tự đoán lại luật, chỉ đọc — kể cả cái mốc, vì mốc của dòng cấp 2/3 có thể là lần duyệt
 * của CÂY cha nên không xuất hiện trong nhật ký `scope=self` mà popup sẽ tải.
 */
function buildPendingApprovalRowHtml(item) {
  // ĐỢT B (R4''): hàng chờ nay chứa BA loại dòng — cây, đề nghị đổi TÍCH Gửi BLĐ và đề nghị đổi
  // TỶ LỆ. Hai loại sau đều là một dòng `approval_changes` nên đi chung một builder và chung một
  // đường quyết (`POST /approvals/changes/:id/approve|reject`). Trước ĐỢT B, dòng `ty-le` rơi xuống
  // nhánh cây bên dưới: vẽ ra ba nút Duyệt/Trả lại/Từ chối gọi SAI URL — tức là người duyệt bấm
  // «Duyệt» thì máy chủ trả 404, còn tỷ lệ thì vẫn treo.
  if (item.kind === "gui-bld" || item.kind === "ty-le") return buildChangeApprovalRowHtml(item);
  const laWork = item.kind === "work";
  const loai = laWork ? "Công việc cha" : Number(item.level) === 2 ? "Công việc con" : "Nhiệm vụ";
  const tenCongViecCha = String((item && item.work_name) || "").trim();
  const tieuDeLoai = laWork || tenCongViecCha === "" ? "" : "Thuộc công việc: " + tenCongViecCha;
  // `=== true` chứ không phải truthy: máy chủ cũ chưa có cột này thì `undefined` phải rơi về «Mới
  // tạo» (nhãn trung tính, không hứa một popup có nội dung) chứ không thành «Sửa» với nút bấm rỗng.
  const laBanSua = item.da_sua === true;
  return (
    '\n<div class="approval-row flex flex-wrap items-center gap-2 py-2 border-b border-gray-100" data-entity="' +
    escapeHtml(laWork ? "work" : "work-item") +
    '" data-id="' +
    escapeHtml(item.code || String(item.id)) +
    '" data-name="' +
    escapeHtmlAttr(item.name || "") +
    '" data-work-code="' +
    escapeHtmlAttr(laWork ? item.code || "" : item.work_code || "") +
    '" data-da-sua="' +
    (laBanSua ? "1" : "0") +
    '" data-moc-xu-ly="' +
    escapeHtmlAttr(item.moc_xu_ly || "") +
    '">' +
    nhanDuyetHtml(laBanSua ? "sua" : "moi") +
    '<span class="duyet-nhan bg-gray-100 text-gray-600"' +
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
    // Nút «Xem các thay đổi» CHỈ hiện khi là bản sửa: hiện ra mà popup rỗng là hứa một điều không
    // giữ được. Đặt TRƯỚC «Xem chi tiết» vì đây là cái người duyệt cần đọc trước khi quyết.
    (laBanSua
      ? '<button type="button" class="approval-changes btn-secondary py-1 px-3 text-xs text-blue-700" title="' +
        escapeHtmlAttr("Xem những gì đã thay đổi so với lần duyệt trước") +
        '"><i class="fas fa-list-check mr-1"></i>Xem các thay đổi</button>'
      : "") +
    '<button type="button" class="approval-detail btn-secondary py-1 px-3 text-xs" title="' +
    escapeHtmlAttr("Xem chi tiết và xử lý phê duyệt công việc, công việc con, nhiệm vụ") +
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
 * NHÃN «đây là duyệt cái gì» của ba bảng chờ duyệt (MỚI-3, 2026-09-12).
 *
 * Trả VỀ CHUỖI HTML chứ không phải node: hai builder nối chuỗi (`buildPendingApprovalRowHtml`,
 * `buildPendingDeleteRowHtml`) chèn thẳng chuỗi này. Builder thứ ba (`buildChangeApprovalRowHtml`)
 * dựng DOM thì tự tạo `<span>` với `textContent`, chỉ đọc CHUNG bảng chữ `NHAN_DUYET` — hai đường
 * một nguồn, đổi nhãn một chỗ là cả ba bảng đổi theo.
 *
 * Cỡ chữ nằm trong luật `.duyet-nhan` ở `app.css`, KHÔNG gắn `text-[11px]`: class arbitrary đó không
 * có trong `tailwind.min.css` đóng băng (commit db382d0) nên bấy lâu chip render cỡ 16px.
 */
const NHAN_DUYET = Object.freeze({
  moi: { nhan: "Mới tạo", mau: "bg-emerald-100 text-emerald-800", yNghia: "Duyệt lần đầu" },
  sua: { nhan: "Sửa", mau: "bg-blue-100 text-blue-700", yNghia: "Bản sửa của đầu việc đã duyệt" },
  xoa: { nhan: "Xoá", mau: "bg-red-100 text-red-700", yNghia: "Yêu cầu xoá đầu việc" },
});

function nhanDuyetHtml(kieu) {
  const cfg = NHAN_DUYET[kieu] || NHAN_DUYET.moi;
  return (
    '<span class="duyet-nhan ' +
    // `cfg.mau` là tên class Tailwind lấy từ `NHAN_DUYET` đóng băng, không có dữ liệu người dùng —
    // nhưng vẫn bọc `escapeHtmlAttr` cho đúng khuôn của bộ soát XSS: mọi giá trị nội suy vào chuỗi
    // HTML đều thoát, không khai ngoại lệ cho cái gì có thể thoát được (xem `oNhapTyLeKhai`).
    escapeHtmlAttr(cfg.mau) +
    '" title="' +
    escapeHtmlAttr(cfg.yNghia) +
    '">' +
    escapeHtml(cfg.nhan) +
    "</span>"
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
  const loai = laWork ? "Công việc cha" : Number(item.level) === 2 ? "Công việc con" : "Nhiệm vụ";
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
    // MỚI-3: nhãn «Xoá» đứng trước nhãn đối tượng, cùng trật tự với bảng chờ duyệt để hai bảng nằm
    // chồng lên nhau trong một panel đọc liền một mạch.
    nhanDuyetHtml("xoa") +
    '<span class="duyet-nhan bg-gray-100 text-gray-600"' +
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
  ganNutQuyetDinhDeNghi(listEl);
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

/**
 * Bẩy action ĐỔI NỘI DUNG — bản sao đúng chữ của `SUA_NOI_DUNG` bên `approvals/repo.js`, để popup
 * «Xem các thay đổi» chỉ in ra những gì đã làm nên nhãn «Sửa» của chính dòng đó.
 *
 * Vì sao phải lọc: `GET …/history` trả MỌI hoạt động của đầu việc (lập, gửi duyệt, duyệt, nhân bản,
 * sắp xếp lại…). In hết thì người duyệt phải tự mò giữa đống chữ xem đâu là phần sửa lần này — đúng
 * cái việc mà nhãn «Sửa» sinh ra để trả lời. Hai bên phải khớp TÊN CHỮ: máy chủ đổi tên action bên
 * `routes.js` mà không sửa danh sách này thì popup thành rỗng, và ca test «Mọi action trong hai bộ
 * đều thật sự được ghi» bên `approvals-pending-da-sua.test.js` là cái lưới bắt.
 */
const HANH_DONG_SUA_NOI_DUNG = Object.freeze([
  "works.update",
  "works.setMonthName",
  "works.clearMonthName",
  "subworks.update",
  "tasks.update",
  "workItems.setMonthName",
  "workItems.clearMonthName",
]);

/**
 * POPUP «XEM CÁC THAY ĐỔI» của bảng «Chờ duyệt» — MỚI-3 (2026-09-12).
 *
 * Người dùng: «Đối với sửa thông tin công việc/nhiệm vụ, thêm nút xem các thay đổi, hiển thị popup
 * các thay đổi». Nút chỉ hiện khi dòng mang `da_sua` (xem `buildPendingApprovalRowHtml`).
 *
 * `mocXuLy` là `moc_xu_ly` MÁY CHỦ trả kèm dòng chờ — lần gần nhất đầu việc này ra khỏi tay người
 * duyệt (`approvals.approve` hoặc `approvals.return`). Popup chỉ in lượt sửa SAU mốc đó. KHÔNG tự tìm
 * mốc trong `entries`: với dòng cấp 2/3 gửi lẻ, mốc là log của CÂY cha nên nằm ngoài `scope=self` mà
 * popup này tải — tự tìm thì mốc thành `null` và popup in cả lịch sử từ ngày lập.
 *
 * Phạm vi tải cố ý lệch nhau theo cấp, khớp đúng luật tính `da_sua` bên `listPending`:
 *   • công việc cha ⇒ `scope=tree`: duyệt cây là duyệt cả cây, sửa ở con cũng là thay đổi của lượt này;
 *   • công việc con / nhiệm vụ ⇒ `scope` mặc định `self`: dòng chờ là của ĐÚNG mục đó, nhật ký của anh
 *     em nó không phải việc của người đang duyệt dòng này.
 *
 * Thân popup tái dùng `buildNhatKyDong` (đã escape sẵn từng giá trị) nên KHÔNG mở sink XSS mới; phần
 * khung dựng bằng `textContent` theo đúng khuôn `moYKienKetQua`.
 */
async function moPopupThayDoiChoDuyet(entity, ref, ten, mocXuLy) {
  if (!ref) return;
  const laWork = entity === "work";
  const duong =
    (laWork ? "/api/v1/works/" : "/api/v1/work-items/") +
    encodeURIComponent(ref) +
    "/history?" +
    (laWork ? "scope=tree&" : "") +
    "limit=500";
  let duLieu = null;
  try {
    duLieu = await restGet(duong);
  } catch (err) {
    showToast("Không tải được nhật ký thay đổi: " + (err && err.message ? err.message : String(err)), "error");
    return;
  }
  const entries = duLieu && Array.isArray(duLieu.entries) ? duLieu.entries : [];
  // Mốc hỏng/thiếu (máy chủ cũ, hoặc dòng chờ dựng từ cache) ⇒ KHÔNG lọc, thà in thừa còn hơn in rỗng
  // rồi để người duyệt tưởng «không sửa gì» mà ký.
  const moc = Date.parse(mocXuLy || "");
  const daSua = entries.filter((entry) => {
    if (!entry || !HANH_DONG_SUA_NOI_DUNG.includes(String(entry.action))) return false;
    if (!Number.isFinite(moc)) return true;
    const luc = Date.parse(entry.created_at || "");
    return Number.isFinite(luc) ? luc > moc : true;
  });

  const tieuDe = "Các thay đổi chờ duyệt — " + (ten || ref);
  const than = daSua.length
    ? '<div class="space-y-2">' +
      // Máy chủ trả CŨ TRƯỚC; màn hình thì MỚI TRƯỚC — cùng quy ước với `renderNhatKy`.
      daSua
        .slice()
        .reverse()
        .map(buildNhatKyDong)
        .join("") +
      "</div>"
    : '<div class="text-center py-8 text-gray-400"><i class="fas fa-list-check text-3xl mb-2"></i>' +
      '<p class="text-sm">Không tìm thấy lượt sửa nào sau lần duyệt trước.</p>' +
      '<p class="yk-chu-thich">Có thể người lập gửi lại nguyên trạng sau khi bị trả về, hoặc nhật ký đã vượt quá 500 dòng.</p></div>';

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const overlay = el("div", "qlcv-dialog yk-dialog");
  overlay.id = "thay-doi-cho-duyet-dialog";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const panel = document.createElement("section");
  panel.append(el("h3", null, tieuDe));
  const content = el("div", "qlcv-dialog-content yk-noi-dung");
  content.innerHTML = than;
  const chan = document.createElement("footer");
  const nutDong = el("button", "btn-secondary", "Đóng");
  nutDong.type = "button";
  chan.append(nutDong);
  panel.append(content, chan);
  overlay.append(panel);

  const bamPhim = (event) => {
    if (event.key === "Escape") dongPopupYKien();
  };
  function don() {
    document.removeEventListener("keydown", bamPhim);
    overlay.remove();
  }
  nutDong.addEventListener("click", () => dongPopupYKien());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) dongPopupYKien();
  });
  // Gỡ popup cũ TRƯỚC khi gắn cái mới — cùng bẫy đã ghi ở `moYKienKetQua`: hai lớp phủ chồng nhau thì
  // Escape phải bấm hai lần mới tắt.
  dongPopupYKien();
  yKienDong = don;
  document.addEventListener("keydown", bamPhim);
  document.body.append(overlay);
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

/** Cập nhật nhãn duyệt trong bộ nhớ ngay sau khi máy chủ nhận yêu cầu gửi cả cây. */
function capNhatTrangThaiChoDuyetLocal(entity, ref) {
  const id = String(ref || "");
  if (entity === "work") {
    allProjects.forEach((p) => {
      if (String(p[COL.P_ID] || "") === id) p[COL.P_APPROVAL] = "Chờ duyệt";
    });
    allTasks.forEach((t) => {
      if (String(t[COL.T_PID] || "") === id && ["Nháp", "Từ chối"].includes(t[COL.T_APPROVAL])) t[COL.T_APPROVAL] = "Chờ duyệt";
    });
  } else {
    allTasks.forEach((t) => {
      if (String(t[COL.T_ID] || "") === id || (String(t[COL.T_PARENT] || "") === id && ["Nháp", "Từ chối"].includes(t[COL.T_APPROVAL]))) t[COL.T_APPROVAL] = "Chờ duyệt";
    });
  }
  typeof renderProjects === "function" && renderProjects();
  typeof renderTasks === "function" && renderTasks();
}
/**
 * Gửi duyệt CẢ CÂY từ một bản nháp (012): công việc cấp 1 + mọi công việc con và nhiệm vụ bên
 * trong cùng sang «Chờ duyệt», và hộp chờ duyệt của người duyệt chỉ hiện MỘT dòng.
 */
async function guiDuyetCaCay(entity, ref) {
  const laWork = entity === "work";
  const rowTyLe = laWork ? null : allTasks.find(t => String(t[COL.T_ID]) === String(ref));
  if (typeof kiemTraTyLeMoiNhat8b === "function" && !await kiemTraTyLeMoiNhat8b(laWork ? "project" : "task", { id: ref }, rowTyLe, "gửi đi")) return null;
  const ketQua = await restPost(
    "/api/v1/approvals/" + entity + "/" + encodeURIComponent(ref) + "/submit"
  );
  if (ketQua) {
    capNhatTrangThaiChoDuyetLocal(entity, ref);
    const soCon = Number(ketQua.soCon || 0);
    showToast(
      "Đã gửi duyệt " + ((ketQua.row && ketQua.row.code) || "") + (soCon > 0 ? " kèm " + soCon + " mục bên trong" : ""),
      "success"
    );
    try {
      await napLaiSauDuyet();
    } catch (_) {
      showToast("Đã gửi duyệt, nhưng chưa tải lại được danh sách. Hãy tải lại trang.", "info");
    }
    return true;
  }
  return false;
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
  // Vừa ký xong là thông báo mới đã nằm trong CSDL — nạp luôn, đợi 60 giây thì badge nói sai.
  napSoThongBaoChuaDoc();
  await renderChoDuyetPanel();
  await refreshData();
}
// ============================================================================
// TRANG «HÀNG CHỜ PHÊ DUYỆT» (2026-09-02) — hai tab con.
//
// Người dùng chốt: tách phần phê duyệt ra khỏi trang Công việc, chia hai tab nhỏ:
//   'viec'    — công việc/nhiệm vụ (dùng LẠI renderChoDuyetPanel + hộp yêu cầu xoá, không viết lại)
//   'ket-qua' — file kết quả nhiệm vụ (014) đang chờ CHÍNH người này xử.
// ============================================================================
let tabChoDuyetHienTai = "viec";
let demLenhSuaCuaToi = { nguoiId: null, soLenh: 0 };

/** Bấm tab: đổi lớp `active` + ẩn/hiện panel, rồi nạp đúng panel vừa mở. */
function cacTabChoDuyet() {
  const docFile = coQuyenTrongPhamVi("task", "read") && coQuyenTrongPhamVi("file", "read");
  const gui = coQuyenTrongPhamVi("file", "submit");
  const tao = coQuyenTrongPhamVi("file", "create");
  return {
    viec: laNguoiDuyetHeThong(),
    "ket-qua": docFile && (gui || tao || coQuyenTrongPhamVi("file", "approve")),
    "lenh-sua": docFile && (gui || tao || (demLenhSuaCuaToi.nguoiId === currentUser?.id && demLenhSuaCuaToi.soLenh > 0)),
  };
}
function moTabChoDuyet(tab) {
  if (cacTabChoDuyet()[tab]) tabChoDuyetHienTai = tab;
  capNhatTabChoDuyet();
  return napTrangChoDuyet();
}
function capNhatTabChoDuyet() {
  const tabs = cacTabChoDuyet();
  if (!tabs[tabChoDuyetHienTai]) tabChoDuyetHienTai = Object.keys(tabs).find(t => tabs[t]) || "";
  document.querySelectorAll(".tab-cho-duyet").forEach((nut) => {
    nut.classList.toggle("active", nut.dataset.tab === tabChoDuyetHienTai);
    nut.classList.toggle("hidden", !tabs[nut.dataset.tab]);
  });
  ["viec", "ket-qua", "lenh-sua"].forEach(tab => {
    document.getElementById("panel-cho-duyet-" + tab)?.classList.toggle("hidden", tabChoDuyetHienTai !== tab);
  });
}

/** Nạp trang: vẽ danh sách của tab đang mở rồi cập nhật badge thanh điều hướng. */
async function napTrangChoDuyet() {
  if (!document.getElementById("cho-duyet-section")) return;
  capNhatTabChoDuyet();
  goiNutChoDuyetPanel(); // gắn listener MỘT lần cho cả hai khung của tab «Công việc / Nhiệm vụ»
  if (tabChoDuyetHienTai === "viec") {
    // `renderChoDuyetPanel` tự ẩn panel với người không có cửa duyệt — khi đó hiện câu giải thích
    // thay cho một khung trống không ai hiểu.
    await renderChoDuyetPanel();
    const trong = document.getElementById("cho-duyet-viec-trong");
    trong && trong.classList.toggle("hidden", laNguoiDuyetHeThong());
    const dem = document.getElementById("approvals-count");
    const oTab = document.getElementById("tab-viec-count");
    oTab && dem && (oTab.textContent = dem.textContent);
  } else if (tabChoDuyetHienTai === "lenh-sua") {
    await renderLenhSua();
  } else {
    await renderChoDuyetKetQua();
  }
  capNhatNavChoDuyet();
}

let luotNapLenhSua = 0;

async function renderLenhSua() {
  const khung = document.getElementById("lenh-sua-list");
  const mau = document.getElementById("lenh-sua-dong-mau");
  if (!khung || !mau) return;
  const luot = ++luotNapLenhSua;
  const duLieu = await restGetIm("/api/v1/task-files/lenh-sua");
  if (luot !== luotNapLenhSua || !khung.isConnected) return;
  if (!duLieu) {
    if (!khung.childElementCount) khung.textContent = "Chưa tải được yêu cầu sửa — hãy thử lại";
    return;
  }
  khung.replaceChildren();
  const items = duLieu.items || [];
  const dem = document.getElementById("tab-lenh-sua-count");
  if (dem) dem.textContent = String(items.length);
  if (!items.length) khung.textContent = "Không có yêu cầu sửa nào được giao cho bạn.";
  items.forEach(row => {
    const dong = mau.content.firstElementChild.cloneNode(true);
    const o = ten => dong.querySelector('[data-lenh="' + ten + '"]');
    dong.dataset.fileId = String(row.id);
    o("ten").textContent = row.ten_ket_qua || row.ten_goc || "Kết quả";
    o("nhiem-vu").textContent = [row.ten_cong_viec, row.ten_cv_con, row.ten_nhiem_vu].filter(Boolean).join(" / ");
    o("ly-do").textContent = row.lenh_sua_ly_do || "Không có lý do kèm theo";
    o("ghi-chu").value = row.lenh_sua_ghi_chu || "";
    o("file").textContent = row.ban_cuoi_ten || "Chưa có file";
    if (row.ban_cuoi_id && !row.ban_cuoi_la_bao_cao) {
      o("file").href = "/api/v1/task-files/" + encodeURIComponent(row.ban_cuoi_id) + "/download";
    }
    const coEditor = duLieu.onlyOffice && row.duocSua && row.ban_cuoi_id &&
      suaTrucTuyenDuoc(row.ban_cuoi_ten || "");
    o("sua").disabled = !coEditor;
    o("gui").disabled = row.duocGui !== true;
    if (!coEditor) o("sua").title = "File chưa có hoặc không hỗ trợ sửa trực tuyến";
    o("sua").addEventListener("click", () => {
      window.open("/api/v1/task-file-versions/" + encodeURIComponent(row.ban_cuoi_id) + "/editor", "_blank", "noopener");
    });
    for (const action of ["huy", "gui", "luu"]) {
      o(action).addEventListener("click", () => xuLyLenhSua(dong, row, action));
    }
    khung.append(dong);
  });
}

async function xuLyLenhSua(dong, row, action) {
  if (dong.dataset.dangLuu === "1") return;
  if (action === "huy" && !window.confirm("Hủy lệnh sửa, giữ nguyên file và trả về cửa chờ trước?")) return;
  if (action === "gui" && !window.confirm("Chắc chắn gửi bản mới nhất đã lưu đi phê duyệt lại?")) return;
  const ghiChu = dong.querySelector('[data-lenh="ghi-chu"]');
  const tinh = dong.querySelector('[data-lenh="tinh"]');
  const nuts = [...dong.querySelectorAll("button")];
  const trangThaiNut = nuts.map(nut => nut.disabled);
  dong.dataset.dangLuu = "1";
  nuts.forEach(nut => { nut.disabled = true; });
  ghiChu.disabled = true;
  tinh.textContent = "Đang xử lý…";
  try {
    const duong = { huy: "huy-lenh-sua", gui: "gui-ban-moi", luu: "luu-tam" }[action];
    const body = action === "luu" ? { ghiChu: ghiChu.value }
      : action === "gui" ? { noiDung: ghiChu.value } : {};
    const ketQua = await restGhi(action === "luu" ? "PATCH" : "POST",
      "/api/v1/task-files/" + encodeURIComponent(row.id) + "/" + duong, body);
    if (!ketQua.ok) throw new Error(ketQua.error || "Không thực hiện được yêu cầu");
    if (action === "luu") tinh.textContent = "Đã lưu tạm — vẫn đang yêu cầu sửa, chưa gửi đi";
    else {
      dong.remove();
      showToast(action === "gui" ? "Đã gửi bản mới nhất" : "Đã hủy lệnh, giữ nguyên file", "success");
      if (!document.getElementById("lenh-sua-list").childElementCount) {
        document.getElementById("lenh-sua-list").textContent = "Không có yêu cầu sửa nào được giao cho bạn.";
      }
    }
    await capNhatNavChoDuyet();
    await napSoThongBaoChuaDoc();
  } catch (error) {
    tinh.textContent = error.message || "Không thực hiện được yêu cầu — hãy thử lại";
  } finally {
    delete dong.dataset.dangLuu;
    nuts.forEach((nut, index) => { nut.disabled = trangThaiNut[index]; });
    ghiChu.disabled = false;
  }
}

/** Vẽ danh sách «Phê duyệt kết quả» — mỗi nhóm file một dòng, nút do MÁY CHỦ trả về. */
async function renderChoDuyetKetQua() {
  const listEl = document.getElementById("cho-duyet-ket-qua-list");
  if (!listEl) return;
  dongMenuKq(); // xem chú ở napKetQua
  listEl.innerHTML = "<div class=\"text-sm text-gray-400 py-2\"><i class=\"fas fa-spinner fa-spin mr-2\"></i>Đang tải...</div>";
  const duLieu = await restGet("/api/v1/task-files/cho-duyet");
  if (!document.getElementById("cho-duyet-ket-qua-list")) return;
  const items = (duLieu && duLieu.items) || [];
  dsBat = duLieu ? duLieu.onlyOffice === true : dsBat;
  const oTab = document.getElementById("tab-ket-qua-count");
  oTab && (oTab.textContent = String(items.length));
  listEl.innerHTML = items.length
    ? buildBangChoDuyetKetQua(items)
    : "<div class=\"text-sm text-gray-400 py-2\">Không có kết quả nào chờ bạn xử — tốt lắm!</div>";
}
/**
 * BẢNG «Phê duyệt kết quả» xếp theo CÂY (người dùng chốt 2026-09-02: «hiển thị công việc cha, bên
 * dưới là công việc con (nếu có), Nhiệm vụ có file sửa đấy, sau đó là tên file và các thông tin»).
 *
 * Máy chủ đã ORDER BY mã công việc → mã CV con → mã nhiệm vụ, nên chỉ cần chèn HÀNG TIÊU ĐỀ mỗi
 * lần đổi nhóm — KHÔNG sắp lại ở client để bảng luôn khớp thứ tự máy chủ trả.
 */
function buildBangChoDuyetKetQua(items) {
  // Tên phải có tiền tố build* để bộ soát XSS coi là hàm DỰNG HTML (đã escape bên trong) —
  // tên ngắn kiểu `o(...)` bị đếm thành lỗ nội suy chưa bọc (TC-SEC-10).
  const buildOTieuDeChoDuyet = (t, them) => "<th class=\"px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase " + escapeHtmlAttr(them || "") + "\">" + escapeHtml(t) + "</th>";
  // Thứ tự dòng là của MÁY CHỦ (ORDER BY mã công việc → CV con → nhiệm vụ, LIMIT 200) — client
  // KHÔNG sắp lại, chỉ vẽ. Bảng phẳng nên không còn hàng tiêu đề cây nào phải chèn.
  const dong = items.map((n) => buildDongChoDuyetKetQua(n)).join("");
  return (
    "<div class=\"overflow-x-auto\"><table class=\"min-w-full text-sm bang-kq-cho-duyet\"><thead class=\"bg-gray-50\"><tr>" +
    buildOTieuDeChoDuyet("Tên kết quả làm được") +
    buildOTieuDeChoDuyet("Nhiệm vụ") +
    buildOTieuDeChoDuyet("Công việc con") +
    buildOTieuDeChoDuyet("Công việc chính") +
    buildOTieuDeChoDuyet("Trạng thái") +
    buildOTieuDeChoDuyet("Bản mới nhất") +
    buildOTieuDeChoDuyet("Ý kiến") +
    buildOTieuDeChoDuyet("Nút chức năng", "text-right") +
    "</tr></thead><tbody class=\"divide-y divide-gray-100\">" + dong + "</tbody></table></div>"
  );
}
/** Ô của một CẤP CÂY trong bảng phẳng: tên ở trên, mã mờ ở dưới. Trống thì gạch ngang. */
function buildOCapChoDuyet(ten, ma, themDuoi) {
  if (!ten && !ma) return "<td class=\"px-3 py-2 text-xs text-gray-300\">—</td>";
  return (
    "<td class=\"px-3 py-2 text-xs\">" +
    "<div class=\"text-gray-700\">" + escapeHtml(ten || ma) + "</div>" +
    "<div class=\"text-gray-400\">" + escapeHtml(ma || "") + (themDuoi ? " · " + escapeHtml(themDuoi) : "") + "</div>" +
    "</td>"
  );
}
/**
 * Ô cột «Nhiệm vụ» — tên là NÚT mở modal nhiệm vụ (người dùng cần đọc nội dung trước khi ký), mã
 * nằm dòng dưới. Ba cấp cây nay là ba CỘT của chính dòng file (sheet «kq-hang-cho»), không còn
 * hàng tiêu đề gộp — nên hàm `buildHangCayChoDuyet` cũ đã gỡ.
 */
function buildONhiemVuChoDuyet(ten, ma) {
  return (
    "<td class=\"px-3 py-2 text-xs\">" +
    "<button type=\"button\" class=\"text-blue-700 hover:underline font-medium text-left\" title=\"Mở nhiệm vụ này\" " +
    "onclick=\"openEditModal('task', '" + escapeForInlineHandler(ma) + "')\">" + escapeHtml(ten || ma) + "</button>" +
    "<div class=\"text-gray-400\">" + escapeHtml(ma || "") + "</div>" +
    "</td>"
  );
}
/**
 * BUILDER: MỘT dòng «Phê duyệt kết quả» — 8 cột PHẲNG theo sheet «kq-hang-cho» (2026-09-03):
 * Tên kết quả · Nhiệm vụ · Công việc con · Công việc chính · Trạng thái · Bản mới nhất · Ý kiến ·
 * Nút chức năng. Ba cấp cây thành ba cột (đọc từ dưới lên) thay cho hàng tiêu đề gộp cũ — mắt
 * người quét theo hàng, không phải nhớ mình đang ở dưới nhóm nào.
 *
 * Mọi hành động gộp vào MỘT menu ⋯ («ấn vào đây hiển thị các Hành động để chọn»).
 * Mọi giá trị user-data đều escape tại lỗ.
 */
/**
 * DÒNG 2 của cột 1 hàng chờ: tên file của bản mới nhất. Bản «Báo cáo» (016) không có file — ghi rõ
 * «Báo cáo (nhập chữ)» thay vì lặp lại tên kết quả ở dòng trên (lặp lại là hai dòng y nhau, vô nghĩa).
 */
function tenBanCuoiHangCho(n) {
  if (laDongBaoCao(n)) return "Báo cáo (nhập chữ)";
  return String((n && (n.ban_cuoi_ten || n.ten_ket_qua || n.ten_goc)) || "");
}
function buildDongChoDuyetKetQua(n) {
  const muc = [];
  // Dòng «Báo cáo» không có file: không mời tải về, không mời sửa trực tuyến — mở nhiệm vụ để đọc.
  const laBaoCao = laDongBaoCao(n);
  if (n.ban_cuoi_id && !laBaoCao) {
    muc.push(buildMucMenuKq("fa-download", "Tải bản mới nhất", "taiFileKetQua('" + escapeForInlineHandler(n.ban_cuoi_id) + "')"));
  }
  if (laBaoCao) {
    muc.push(
      buildMucMenuKq(
        "fa-file-lines",
        "Mở nhiệm vụ để đọc nội dung báo cáo",
        "openEditModal('task', '" + escapeForInlineHandler(n.ma_nhiem_vu) + "')"
      )
    );
  }
  if (dsBat && n.ban_cuoi_id && !laBaoCao && suaTrucTuyenDuoc(n.ban_cuoi_ten || n.ten_goc)) {
    muc.push(
      "<a href=\"" + escapeHtmlAttr(safeUrl("/api/v1/task-file-versions/" + n.ban_cuoi_id)) +
      "/editor\" target=\"_blank\" class=\"kq-menu-muc\"><i class=\"fas fa-pen-to-square mr-2 w-4 text-center\"></i>Sửa trực tuyến</a>"
    );
  }
  // «Nộp bản mới» ngay trong hàng chờ — người dùng chốt: người sửa file được up bản mới của nó.
  // Dòng «Báo cáo» nộp bằng ô nhập chữ trong modal nhiệm vụ, không qua ô chọn file.
  if (n.duocNop === true && !laBaoCao) {
    muc.push(
      buildMucMenuKq(
        "fa-upload",
        "Nộp bản mới",
        "moChonFileChoDuyet('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(n.ma_nhiem_vu) + "')"
      )
    );
  }
  if (n.duocGuiDuyet === true && n.ban_cuoi_id) {
    muc.push(
      buildMucMenuKq("fa-paper-plane", "Gửi đi duyệt", "guiDiDuyetFile('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(n.ma_nhiem_vu) + "', '" + escapeForInlineHandler(n.ban_cuoi_id) + "', true)")
    );
  }
  (Array.isArray(n.hanhDong) ? n.hanhDong : []).forEach((h) => {
    const laChot = h.ma === "hoan-thanh" || h.ma === "duyet";
    muc.push(
      buildMucMenuKq(
        laChot ? "fa-check" : "fa-reply",
        h.nhan,
        "xuLyVerdictChoDuyet('" + escapeForInlineHandler(n.id) + "', '" + escapeForInlineHandler(h.ma) + "', " +
          (h.canNoiDung ? "true" : "false") + ")",
        laChot
      )
    );
  });
  const soYKien = Number(n.so_y_kien || 0);
  return (
    "<tr class=\"dong-kq-cho-duyet\" data-file=\"" + escapeHtmlAttr(n.id) + "\" data-dinh-dang=\"" + escapeHtmlAttr(n.dinh_dang || "") + "\">" +
    // 1. Tên kết quả làm được (người dùng chốt 2026-09-04): DÒNG 1 = TÊN KẾT QUẢ đã khai ở ô
    // «Kết quả» của nhiệm vụ (016 `ten_ket_qua`) + ICON định dạng + số bản; DÒNG 2 = TÊN FILE của
    // bản mới nhất — hai thứ lệch nhau ngay khi ai đó nộp bản mới bằng file tên khác. Dòng «Báo
    // cáo» không có file nên dòng 2 ghi rõ là chữ thay vì lặp lại tên.
    "<td class=\"px-3 py-2\">" +
    "<div class=\"flex items-start\">" +
    buildIconDinhDang(n.dinh_dang || n.ban_cuoi_ten || n.ten_goc) +
    "<div class=\"min-w-0\">" +
    "<div><span class=\"font-medium text-gray-800\">" + escapeHtml(n.ten_ket_qua || n.ten_goc) + "</span>" +
    "<span class=\"text-xs text-gray-400 ml-2 whitespace-nowrap\">" + escapeHtml(n.so_ban || 1) + " bản</span></div>" +
    "<div class=\"text-xs text-gray-500 truncate\" title=\"" + escapeHtmlAttr(tenBanCuoiHangCho(n)) + "\">" +
    escapeHtml(tenBanCuoiHangCho(n)) + "</div>" +
    "</div></div>" +
    "</td>" +
    // 2-3-4. Ba cấp cây, đọc từ dưới lên đúng thứ tự sheet.
    buildONhiemVuChoDuyet(n.ten_nhiem_vu, n.ma_nhiem_vu) +
    buildOCapChoDuyet(n.ten_cv_con, n.ma_cv_con) +
    buildOCapChoDuyet(n.ten_cong_viec, n.ma_cong_viec, n.ten_phong) +
    // 5. Trạng thái: badge + CÂU KỂ bên dưới (sheet đòi đọc được «đang đợi ai»).
    "<td class=\"px-3 py-2\"><span class=\"text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap " +
    escapeHtmlAttr(MAU_TRANG_THAI_FILE[n.trang_thai] || "bg-gray-100 text-gray-600") + "\">" +
    escapeHtml(NHAN_TRANG_THAI_FILE[n.trang_thai] || n.trang_thai) + "</span>" +
    "<div class=\"text-xs text-gray-500 mt-1\">" + escapeHtml(cauTinhTrangHangCho(n)) + "</div></td>" +
    // 6. Bản mới nhất.
    "<td class=\"px-3 py-2 text-xs text-gray-500 whitespace-nowrap\">bản " + escapeHtml(n.ban_cuoi_so || 1) + " · " +
    escapeHtml(n.ban_cuoi_nguoi || n.ten_nguoi_tao) + "<br>" +
    escapeHtml(formatDateForDisplay(n.ban_cuoi_luc || n.created_at, true)) + "</td>" +
    // 7. Ý kiến — chỉ chữ + số, bấm mới mở nhiệm vụ (độ rộng bảng có hạn).
    "<td class=\"px-3 py-2 whitespace-nowrap\">" +
    (soYKien > 0
      ? "<button type=\"button\" class=\"text-blue-600 hover:underline text-xs\" title=\"Mở nhiệm vụ để đọc ý kiến\" onclick=\"openEditModal('task', '" +
        escapeForInlineHandler(n.ma_nhiem_vu) + "')\">Xem ý kiến (" + escapeHtml(soYKien) + ")</button>"
      : "<span class=\"text-xs text-gray-300\">—</span>") +
    "</td>" +
    // 8. Nút chức năng — MỘT menu.
    "<td class=\"px-3 py-2 text-right\">" + buildMenuHanhDongKq("hc-" + n.id, muc) + "</td>" +
    "</tr>"
  );
}

/**
 * NỘP BẢN MỚI ngay trong trang «Hàng chờ phê duyệt» (người dùng chốt 2026-09-02: «người sửa file
 * nhiệm vụ có thể up file lên để thể hiện bản mới của nó»).
 *
 * Dùng LẠI `uploadKetQua` của khối «Kết quả» — chỉ đặt trước hai biến ngữ cảnh (`fileKetQuaChoBan`,
 * `taskKetQuaMa`) rồi bật cờ để sau khi tải xong thì vẽ lại BẢNG hàng chờ, không phải khối trong
 * modal (lúc này modal chưa mở). Nhờ vậy phần kiểm đuôi/dung lượng + thanh trạng thái dùng chung.
 */
let dangOTrangChoDuyet = false;
function moChonFileChoDuyet(fileId, maNhiemVu) {
  const input = document.getElementById("kq-cho-duyet-file-input");
  if (!input) return;
  fileKetQuaChoBan = fileId ? Number(fileId) : null;
  datDinhDangOChonFile(input, fileId);
  taskKetQuaMa = String(maNhiemVu || "");
  dangOTrangChoDuyet = true;
  input.value = "";
  input.click();
}
/** Bấm nút verdict từ trang hàng chờ — cùng endpoint với khối «Kết quả» trong modal nhiệm vụ. */
async function xuLyVerdictChoDuyet(fileId, hanhDong, canNoiDung) {
  let noiDung = "";
  if (canNoiDung) {
    noiDung = (window.prompt("Nhập nội dung (ít nhất 10 ký tự):", "") || "").trim();
    if (noiDung.length < 10) {
      showToast("Cần nhập ít nhất 10 ký tự", "error");
      return;
    }
  }
  const ketQua = await restPost("/api/v1/task-files/" + encodeURIComponent(fileId) + "/verdict", {
    hanhDong,
    noiDung,
  });
  if (!ketQua) return;
  showToast("Đã " + (NHAN_VERDICT_FILE[hanhDong] || hanhDong).toLowerCase(), "success");
  await renderChoDuyetKetQua();
  await refreshData();
}

/**
 * Badge trên thanh điều hướng + mở/ẩn mục «Hàng chờ phê duyệt».
 * Ai thấy mục này: người duyệt hệ thống (admin/Phó GĐ) HOẶC lãnh đạo phòng (TP/PP — họ có cửa
 * duyệt kết quả file dù không duyệt cây công việc).
 */
async function capNhatNavChoDuyet() {
  const nav = document.getElementById("nav-cho-duyet");
  if (!nav || !isAuthenticated || !currentUser) return;
  capNhatTabChoDuyet();
  const nguoi = currentUser;
  const lenh = await restGetIm("/api/v1/task-files/lenh-sua");
  if (currentUser !== nguoi || !isAuthenticated) return;
  const soLenh = ((lenh && lenh.items) || []).length;
  demLenhSuaCuaToi = { nguoiId: currentUser.id, soLenh };
  capNhatTabChoDuyet();
  const coCua = Object.values(cacTabChoDuyet()).some(Boolean);
  nav.classList.toggle("hidden", !coCua);
  if (!coCua) return;
  const badge = document.getElementById("nav-cho-duyet-badge");
  if (!badge) return;
  const kq = cacTabChoDuyet()["ket-qua"] ? await restGet("/api/v1/task-files/cho-duyet") : null;
  if (currentUser !== nguoi || !isAuthenticated) return;
  let tong = ((kq && kq.items) || []).length + soLenh;
  const tabLenh = document.getElementById("tab-lenh-sua-count");
  if (tabLenh && lenh) tabLenh.textContent = String(soLenh);
  if (laNguoiDuyetHeThong()) {
    const dem = await restGet("/api/v1/approvals/pending-count");
    tong += Number((dem && (dem.total ?? dem.works)) || 0);
  }
  badge.textContent = String(tong);
  badge.classList.toggle("hidden", tong === 0);
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
    if (nut.classList.contains("approval-changes")) {
      // MỚI-3: popup «Xem các thay đổi». Đọc `data-moc-xu-ly` MÁY CHỦ trả kèm dòng chờ chứ không tự
      // đoán mốc trong nhật ký — xem docblock `moPopupThayDoiChoDuyet`.
      nut.disabled = true;
      try {
        await moPopupThayDoiChoDuyet(entity, ref, rowEl.dataset.name || "", rowEl.dataset.mocXuLy || "");
      } finally {
        nut.disabled = false;
      }
    } else if (nut.classList.contains("approval-detail")) {
      // Xem chi tiết: người duyệt đọc và sửa cả cây trước khi
      // ký. Dòng cấp 2/3 mở theo công việc cấp 1 của nó (`data-work-code`) vì modal chi tiết vẽ
      // theo cây của cấp 1; không có mã đó thì mở theo chính nó.
      const item = entity === "work-item" ? allTasks.find((t) => String(t[COL.T_ID]) === String(ref)) : null;
      const maCongViec = rowEl.dataset.workCode || (item && item[COL.T_PID]) || ref;
      const congViec = allProjects.find((p) => String(p[COL.P_ID]) === String(maCongViec));
      if (typeof dauViecDangDuyet8b !== "undefined") dauViecDangDuyet8b = { type: entity === "work" ? "project" : "task", ref };
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

  // Nút «Tải lại» của TRANG «Hàng chờ phê duyệt» (2026-09-02): nạp lại đúng tab đang mở.
  const nutTaiLaiTrang = document.getElementById("cho-duyet-refresh");
  nutTaiLaiTrang &&
    !nutTaiLaiTrang.dataset.daNoi &&
    ((nutTaiLaiTrang.dataset.daNoi = "1"),
    nutTaiLaiTrang.addEventListener("click", () => napTrangChoDuyet()));

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
    '<i class="fas fa-folder ' + escapeHtml(getStatusIconClass(nhanHoanThanhKetQua(work))) + ' mr-2"></i>' +
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
  { ten: 'Xem Công việc (cấp 1)', entityType: 'work', action: 'read' },
  { ten: 'Xem Công việc con (cấp 2)', entityType: 'subwork', action: 'read' },
  { ten: 'Xem Nhiệm vụ (cấp 3)', entityType: 'task', action: 'read' },
  { ten: 'Tạo Công việc (cấp 1)', entityType: 'work', action: 'create', gc: 'Mặc định TP/PP tạo cần duyệt; đặt ✓ để tạo đã duyệt ngay. Luôn trong phòng mình, trừ ủy quyền hợp lệ.' },
  { ten: 'Tạo Công việc con (cấp 2)', entityType: 'subwork', action: 'create' },
  { ten: 'Tạo Nhiệm vụ (cấp 3)', entityType: 'task', action: 'create', gc: 'Mặc định nhiệm vụ KHÔNG qua duyệt; đặt ⏳ ở đây thì nhiệm vụ mới rơi «Chờ duyệt».' },
  { ten: 'Sửa Công việc (cấp 1)', entityType: 'work', action: 'update' },
  { ten: 'Sửa Công việc con (cấp 2)', entityType: 'subwork', action: 'update', gc: 'Mặc định TP/PP sửa mục đã duyệt cần duyệt lại; đặt ✓ để giữ trạng thái đã duyệt.' },
  { ten: 'Sửa Nhiệm vụ (cấp 3)', entityType: 'task', action: 'update' },
  // Bug 2 (8b): quyền «sửa tỷ lệ» của đầu mục (rbac.js ACTION_TY_LE, KHÔNG thuộc mảng ACTIONS —
  // sửa là hiệu lực ngay, không có ⏳ chờ duyệt). Mặc định ✓ cho admin/PQĐ/TP/PP; TP/PP chỉ trong
  // phòng phụ trách (inScope). Cán bộ & vai «Quản lý công việc» ✕.
  { ten: 'Sửa tỷ lệ công việc (%) — Công việc con (cấp 2)', entityType: 'subwork', action: 'ty-le', gc: 'Tỷ lệ chia đều khi tạo; đầu mục thiếu/không có tỷ lệ không tính vào tiến độ.' },
  { ten: 'Sửa tỷ lệ công việc (%) — Nhiệm vụ (cấp 3)', entityType: 'task', action: 'ty-le', gc: 'Nhiệm vụ trực tiếp góp tỷ lệ vào công việc cha; nhiệm vụ trong công việc con góp tỷ lệ vào công việc con.' },
  { ten: 'Đổi tích Gửi BLĐ phê duyệt — Nhiệm vụ', entityType: 'task', action: 'gui-bld', gc: '✓ theo tùy chọn duyệt đổi tích; ⏳ luôn phải chờ, kể cả khi tùy chọn tắt; ✕ không sửa được. Cán bộ chỉ chọn khi tạo, TP/PP tự thực hiện luôn lên Phó GĐ.' },
  { ten: 'Xoá Công việc (cấp 1)', entityType: 'work', action: 'delete' },
  { ten: 'Xoá Công việc con (cấp 2)', entityType: 'subwork', action: 'delete' },
  { ten: 'Xoá Nhiệm vụ (cấp 3)', entityType: 'task', action: 'delete', gc: 'Cán bộ chỉ xoá nhiệm vụ của mình.' },
  { ten: 'Duyệt Công việc (cấp 1)', entityType: 'work', action: 'approve', gc: 'Giám đốc/Phó Giám đốc mặc định được duyệt; các vai khác cần được mở ô này trong phạm vi hợp lệ.' },
  { ten: 'Duyệt Công việc con (cấp 2)', entityType: 'subwork', action: 'approve' },
  { ten: 'Duyệt Nhiệm vụ (cấp 3)', entityType: 'task', action: 'approve', gc: 'Chỉ cần khi ô «Tạo Nhiệm vụ» đặt ⏳ — không có mục nào chờ thì không có gì để duyệt.' },
  // 014 — hai cửa mới của luồng «Kết quả nhiệm vụ là file». Nghĩa giá trị (người dùng chốt):
  //   ⏳ Chờ duyệt = PHẢI gửi đi duyệt (Cán bộ nộp về «Chờ TP/PP xem»; TP/PP nộp về «Chờ lãnh đạo»;
  //                 TP/PP đặt ⏳ ở «Duyệt kết quả» là MẤT nút «Hoàn thành / Duyệt» — chỉ còn Trình).
  //   ✓ Cho phép  = PHÊ DUYỆT LUÔN — nộp xong nhóm chuyển thẳng «Đã duyệt» kèm dòng luồng
  //                 «Tự động — phân quyền không yêu cầu duyệt»; KHÔNG gửi TP/PP/PGD.
  //   ✕ Tắt       = vai đó không nộp/không duyệt được. Đổi ở đây là hiệu lực NGAY cho lần sau.
  { ten: 'Lưu kết quả (file nhiệm vụ)', entityType: 'file', action: 'create', gc: 'Tải lên chỉ Lưu tạm. Khi gửi: ⏳ đi đúng cửa duyệt; ✓ cho NV tự duyệt nếu quyền Gửi không bắt buộc duyệt. TP/PP luôn chờ Phó GĐ. ✕ không tải được.' },
  { ten: 'Gửi đi duyệt (file nhiệm vụ)', entityType: 'file', action: 'submit', gc: '✓ được gửi bản lưu theo luồng của người nộp; ⏳ bắt buộc duyệt, không tự chốt; ✕ không gửi được. Nháp chỉ người tạo nhóm và admin thấy ở hàng chờ.' },
  { ten: 'Duyệt kết quả (file nhiệm vụ)', entityType: 'file', action: 'approve', gc: '✓ = nút chốt hiện («Hoàn thành / Duyệt» của TP/PP, «Duyệt» của PGD/GĐ). ⏳ = chỉ TP/PP mất nút chốt. ✕ = vai đó không duyệt được.' },
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
    const moRong = gd.pham_vi === 'tat-ca' && !(row.action === 'create' && row.entityType !== 'file' && ['Trưởng phòng', 'Phó phòng'].includes(vai));
    if (gd.gia_tri === 'cho-phep') return { s: '✓', n: 'Ghi đè: cho phép ngay' + (moRong ? ' · TẤT CẢ các phòng' : '') };
    if (gd.gia_tri === 'cho-duyet') return { s: '⏳', n: (row.entityType === 'file' && row.action === 'submit' ? 'Ghi đè: bắt buộc đi đúng cửa duyệt' : 'Ghi đè: chờ Phó GĐ duyệt') + (moRong ? ' · TẤT CẢ các phòng' : '') };
    if (gd.gia_tri === 'tu-choi') return { s: '✕', n: 'Ghi đè: đã tắt' };
  }
  const g = giaTriMacDinhQuyen(macDinh, vai, row.entityType, row.action);
  return { s: g === 'cho-duyet' ? '⏳' : g === 'cho-phep' ? '✓' : '✕',
    n: g === 'tu-choi' ? '' : vai === 'Phó Giám đốc' ? 'Các phòng phụ trách' : 'Phòng của mình' };
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
    if (gd) return { g: gd.gia_tri, pv: gd.pham_vi === 'tat-ca' &&
      !(row.action === 'create' && row.entityType !== 'file' && ['Trưởng phòng', 'Phó phòng'].includes(vai)), ghiDe: true };
    return { g: giaTriMacDinhQuyen(macDinh, vai, row.entityType, row.action), pv: '', ghiDe: false };
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
          (row.entityType === 'task' && row.action === 'gui-bld') ||
          (row.action === 'create' &&
            !(row.entityType === 'file' && vai === 'Phó Giám đốc')) ||
          (['update', 'delete'].includes(row.action) && row.entityType !== 'file') ||
          // 014: riêng 2 hàng file — ⏳ chỉ có ở «Duyệt kết quả (file nhiệm vụ)» × Trưởng phòng/
          // Phó phòng (đặt ⏳ là mất nút «Hoàn thành / Duyệt», bắt buộc trình lên cấp trên), và
          // KHÔNG có ở Phó GĐ (cấp chốt cuối — không có ai để «chờ»).
          (row.entityType === 'file' && row.action === 'approve' && laLanhDao) ||
          (row.entityType === 'file' && row.action === 'submit' && vai !== 'Phó Giám đốc');
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
        const coPhamVi = vaiCot.phamViText && vai !== 'Nhân viên' &&
          !(row.action === 'create' && row.entityType !== 'file' && laLanhDao);
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
/** V2: cấu hình số phần trăm lấy từ máy chủ; chỉ admin có nút ghi. */
function buildCauHinhTienDoFile(data, laAdmin) {
  if (!data?.settings?.fileProgress || !data.fileProgressLabels) return '';
  const rows = Object.entries(data.fileProgressLabels).map(([key, label]) =>
    '<label class="flex justify-between items-center gap-3 py-1"><span>' + escapeHtml(label) + '</span><span><input type="number" min="0" max="100" step="any" required class="form-input w-20" data-moc-file="' + escapeHtmlAttr(key) + '" data-goc="' + escapeHtmlAttr(data.settings.fileProgress[key]) + '" value="' + escapeHtmlAttr(data.settings.fileProgress[key]) + '"' + (laAdmin ? '' : ' disabled') + '> %</span></label>').join('');
  return '<section class="mt-5 border-t pt-4"><h4 class="font-semibold">Tiến độ từng file kết quả (%)</h4><p class="text-xs text-gray-500">Chỉ Giám đốc (admin) sửa được. Mốc phải từ 0 đến 100 và không giảm trong từng nhánh duyệt; hiệu lực từ request kế tiếp.</p>' + rows +
    buildGuiBldSettingsHtml(data.settings, laAdmin) +
    (laAdmin ? '<button type="button" id="file-progress-save" class="btn-primary mt-2">Lưu cấu hình tiến độ file</button>' : '') + '</section>';
}
async function luuCauHinhTienDoFile() {
  const button = document.getElementById('file-progress-save');
  if (!button || button.disabled || !isAdmin()) return;
  const fileProgress = {};
  for (const input of document.querySelectorAll('[data-moc-file]')) {
    if (!input.reportValidity() || !input.value.trim()) return;
    if (Number(input.value) !== Number(input.dataset.goc)) fileProgress[input.dataset.mocFile] = Number(input.value);
  }
  // Chỉ gửi phần người dùng thật sự đổi: form cũ không được ghi đè Q2 mà admin khác vừa lưu.
  const update = {};
  if (Object.keys(fileProgress).length) update.fileProgress = fileProgress;
  const guiBld = document.getElementById('gui-bld-change-approval');
  if (guiBld && !guiBld.disabled && guiBld.checked !== (guiBld.dataset.original === '1')) {
    update.guiBldChangeRequiresApproval = guiBld.checked;
  }
  if (!Object.keys(update).length) {
    showToast('Cấu hình chưa có thay đổi để lưu.', 'info');
    return;
  }
  button.disabled = true;
  try {
    const result = await restGhi('PUT', '/api/v1/permissions/settings', update);
    if (!result.ok) { showToast(result.error, 'error'); return; }
    showToast('Đã lưu cấu hình; request kế tiếp dùng số mới. Phiên khác đang mở cập nhật trong 15 giây khi tab hiển thị.', 'success');
    await veBangPhanQuyen();
  } finally { button.disabled = false; }
}
/** Vẽ bảng phân quyền (động) + trình sửa cho admin; không có khung thì bỏ qua. */
function veBangPhanQuyen() {
  const el = document.getElementById('account-permission-table');
  if (!el) return;
  el.innerHTML = '<div class="text-sm text-gray-500">Đang tải bảng phân quyền...</div>';
  return restGet('/api/v1/permissions')
    .then((duLieu) => {
      capNhatBangQuyen(duLieu);
      const laAdmin = isAdmin();
      el.innerHTML = buildBangPhanQuyenHtml(chiSoGhiDe(duLieu && duLieu.ghiDe), duLieu && duLieu.macDinh, laAdmin) + buildCauHinhTienDoFile(duLieu, laAdmin);
      document.getElementById("file-progress-save")?.addEventListener("click", luuCauHinhTienDoFile);
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
  Object.values(gop).forEach(g => {
    if (g.giaTri === 'mac-dinh' && g.phamVi === 'tat-ca')
      g.giaTri = giaTriMacDinhQuyen(phanQuyenFile.macDinh, g.vai, g.entityType, g.action);
  });
  const ketQua = await restGhi('PUT', '/api/v1/permissions', { thayDoi: Object.values(gop) });
  if (ketQua.ok) {
    capNhatBangQuyen({ macDinh: phanQuyenFile.macDinh, ghiDe: ketQua.data.ghiDe, settings: phanQuyenFile.settings });
    showToast('Đã lưu. Máy chủ áp dụng từ request kế tiếp; phiên đang mở cập nhật trong 15 giây.', 'success');
    veBangPhanQuyen();
  } else {
    showToast(ketQua.error || 'Không lưu được bảng phân quyền', 'error');
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
  // Khối «Thông báo Zalo» nạp riêng vì cần hỏi máy chủ cờ `bat` (xem renderThongBaoZalo).
  void renderThongBaoZalo();
}
/** Nối form đổi mật khẩu + nút Tải lại của trang tài khoản — MỘT lần (mốc dataset.daNoi). */
function setupTrangTaiKhoan() {
  const form = document.getElementById("account-password-form"),
    nutTaiLai = document.getElementById("account-refresh-btn"),
    zaloBody = document.getElementById("account-zalo-body");
  nutTaiLai && !nutTaiLai.dataset.daNoi && ((nutTaiLai.dataset.daNoi = "1"), nutTaiLai.addEventListener("click", renderTrangTaiKhoan));
  zaloBody && !zaloBody.dataset.daNoi && ((zaloBody.dataset.daNoi = "1"), zaloBody.addEventListener("click", xuLyNutZalo));
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

/* ----------------------------------------------------------------------------
 * THÔNG BÁO ZALO (2026-09-06, Phase 8) — liên kết tài khoản Zalo của CHÍNH người
 * đang đăng nhập để bot đẩy ba loại tin: chờ duyệt, trả lại, quá hạn.
 *
 * Cờ `bat` lấy từ /api/v1/zalo/trang-thai — trình duyệt không tự đoán máy chủ có
 * token hay không (bẫy §13.5 «cờ cấu hình phải đi cùng dữ liệu»). `bat !== true`
 * thì ẩn CẢ khối, không hiện nút nào.
 *
 * Dữ liệu máy chủ (mã, câu hướng dẫn, trạng thái) đều qua các builder build* bên
 * dưới; nhãn tĩnh thì KHÔNG bọc escapeHtml.
 * -------------------------------------------------------------------------- */

/** Kéo trạng thái và vẽ lại khối «Thông báo Zalo»; TẮT hoặc chưa đăng nhập thì ẩn khối. */
async function renderThongBaoZalo() {
  const card = document.getElementById("account-zalo-card"),
    body = document.getElementById("account-zalo-body");
  if (!card || !body) return;
  if (!isAuthenticated || !currentUser) {
    card.classList.add("hidden");
    return;
  }
  const tt = await restGet("/api/v1/zalo/trang-thai");
  if (!tt || tt.bat !== true) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  body.innerHTML = tt.daLienKet === true ? buildZaloDaLienKetHtml() : buildZaloChuaLienKetHtml();
}

/** BUILDER: trạng thái ĐÃ liên kết — một câu nói bot sẽ nhắn gì + nút bỏ liên kết. */
function buildZaloDaLienKetHtml() {
  return (
    '<div class="flex flex-wrap items-center justify-between gap-3">' +
    '<div class="text-sm text-gray-700">' +
    '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium mr-2">' +
    '<i class="fas fa-check mr-1"></i>Đã liên kết</span>' +
    "Bot sẽ nhắn cho bạn khi có việc chờ bạn duyệt, việc bị trả lại hoặc việc quá hạn." +
    "</div>" +
    '<button type="button" data-zalo="bo-lien-ket" class="btn-secondary text-sm thanh-loc-nut">' +
    '<i class="fas fa-unlink mr-2"></i>Bỏ liên kết</button>' +
    "</div>"
  );
}

/** BUILDER: trạng thái CHƯA liên kết — nút lấy mã 6 số. */
function buildZaloChuaLienKetHtml() {
  return (
    '<div class="flex flex-wrap items-center justify-between gap-3">' +
    '<div class="text-sm text-gray-700">' +
    '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium mr-2">Chưa liên kết</span>' +
    "Liên kết tài khoản Zalo để bot nhắn tin khi có việc chờ duyệt, việc bị trả lại hoặc việc quá hạn." +
    "</div>" +
    '<button type="button" data-zalo="lay-ma" class="btn-primary text-sm thanh-loc-nut">' +
    '<i class="fas fa-qrcode mr-2"></i>Lấy mã liên kết</button>' +
    "</div>"
  );
}

/**
 * BUILDER: khối mã liên kết — `code` và `huongDan` do máy chủ trả (POST /zalo/ma-lien-ket)
 * nên LUÔN qua escapeHtml dù mã chỉ là 6 chữ số và câu hướng dẫn là chuỗi cố định.
 */
function buildZaloMaHtml(ma) {
  return (
    '<div class="text-sm text-gray-700">' +
    '<p class="mb-3">' +
    escapeHtml(ma.huongDan || "") +
    "</p>" +
    '<div class="flex items-baseline gap-3 mb-3">' +
    '<span class="text-2xl font-bold tracking-[0.3em] text-blue-700">' +
    escapeHtml(String(ma.code || "")) +
    "</span>" +
    '<span class="text-xs text-gray-500">Mã dùng một lần, có hạn ' +
    escapeHtml(String(ma.hanPhut || 15)) +
    " phút</span>" +
    "</div>" +
    '<button type="button" data-zalo="lay-ma" class="btn-secondary text-sm thanh-loc-nut">' +
    '<i class="fas fa-rotate mr-2"></i>Lấy mã khác</button>' +
    "</div>"
  );
}

/**
 * Nút trong khối Zalo — uỷ quyền sự kiện (delegation) vì khối được vẽ lại sau mỗi
 * thao tác. «Lấy mã» / «Lấy mã khác» dùng chung một hành động.
 */
async function xuLyNutZalo(event) {
  const nut = event.target.closest("button[data-zalo]");
  if (!nut) return;
  const hanhDong = nut.dataset.zalo,
    body = document.getElementById("account-zalo-body");
  if (hanhDong === "lay-ma") {
    setButtonLoading(nut, true);
    const ma = await restPost("/api/v1/zalo/ma-lien-ket", {});
    if (!ma || !body) return void renderThongBaoZalo();
    body.innerHTML = buildZaloMaHtml(ma);
  } else if (hanhDong === "bo-lien-ket") {
    setButtonLoading(nut, true);
    const kq = await restGhi("DELETE", "/api/v1/zalo/lien-ket");
    if (kq && kq.ok) {
      showToast("Đã bỏ liên kết Zalo — thông báo từ giờ chỉ hiện trong phần mềm.", "success");
      renderThongBaoZalo();
    } else {
      setButtonLoading(nut, false);
      showToast((kq && kq.error) || "Không bỏ được liên kết Zalo.", "error");
    }
  }
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


// V7: dựng bằng DOM/textContent rồi serialize, mọi tên/người nhận đều là chữ, không phải HTML.
function buildGuiBldCheckboxHtml(isEdit, task) {
  const section = document.createElement("section");
  section.className = "form-group border rounded p-3 bg-gray-50";
  const label = document.createElement("label");
  label.className = "flex items-center gap-2 font-semibold";
  const box = document.createElement("input");
  box.type = "checkbox"; box.id = "task-gui-bld";
  box.dataset.isEdit = isEdit ? "1" : "0";
  box.dataset.original = task?.guiBldPheDuyet === true ? "1" : "0";
  if (task?.guiBldPheDuyet === true) box.setAttribute("checked", "");
  box.disabled = isEdit && (currentUser?.role === "Nhân viên" || !coQuyenTaiDong("gui-bld", "task", task));
  label.append(box, document.createTextNode("Gửi BLĐ phê duyệt"));
  const hint = document.createElement("p"); hint.id = "task-gui-bld-help"; hint.className = "text-xs text-gray-600 mt-2";
  hint.textContent = isEdit ? "Cán bộ không sửa sau khi tạo. TP/PP đổi tích mặc định phải chờ Phó Giám đốc duyệt." : "Không tích (mặc định): TP/PP có thể chốt. Có tích: gửi Ban lãnh đạo phụ trách đã chọn; không chọn thêm người mới.";
  section.append(label, hint); return section.outerHTML;
}
function capNhatLuaChonGuiBld() {
  const box = document.getElementById("task-gui-bld"), form = document.getElementById("task-form");
  if (!box || !form) return;
  const name = form.querySelector('[name="assignee"]')?.value;
  const who = allStaff.find(p => p[COL.S_NAME] === name);
  const leader = ["Trưởng phòng", "Phó phòng"].includes(who?.[COL.S_ROLE]);
  const ref = form.querySelector('[name="id"]')?.value;
  const isEdit = box.dataset.isEdit === "1";
  box.disabled = leader || (isEdit && (currentUser?.role === "Nhân viên" || !coQuyenTaiDong("gui-bld", "task", ref)));
  const hint = document.getElementById("task-gui-bld-help");
  if (hint) hint.textContent = leader ? "TP/PP trực tiếp thực hiện luôn lên Phó Giám đốc, tích không có tác dụng. Nếu tích đang bật, cần duyệt tắt trước khi đổi sang TP/PP thực hiện." :
    isEdit ? "Tích hiện hành chỉ đổi sau khi đề nghị được duyệt (mặc định). ⏳ luôn phải chờ; Cán bộ không sửa sau tạo." :
    "Không tích (mặc định): TP/PP có thể chốt. Có tích: gửi Ban lãnh đạo phụ trách đã chọn ở nhiệm vụ hoặc công việc con.";
}
function thuGuiBldForm(form, data) {
  const box = form.querySelector("#task-gui-bld");
  if (!box) return;
  if (box.dataset.isEdit !== "1") data.guiBldPheDuyet = box.disabled ? false : box.checked;
  else if (!box.disabled && box.checked !== (box.dataset.original === "1")) data.guiBldPheDuyet = box.checked;
}
function buildGuiBldSettingsHtml(settings, admin) {
  const label = document.createElement("label"); label.className = "flex items-center gap-2 mt-4 text-sm";
  const box = document.createElement("input"); box.type = "checkbox"; box.id = "gui-bld-change-approval";
  box.dataset.original = settings?.guiBldChangeRequiresApproval !== false ? "1" : "0";
  if (box.dataset.original === "1") box.setAttribute("checked", "");
  box.disabled = !admin;
  label.append(box, document.createTextNode("TP/PP đổi tích Gửi BLĐ phải trình Phó Giám đốc duyệt (mặc định). Bỏ chọn: ✓ có hiệu lực ngay; ⏳ vẫn phải chờ."));
  return label.outerHTML;
}
/**
 * BUILDER: một dòng ĐỀ NGHỊ trong hàng chờ — dùng chung cho `gui-bld` (Đợt A) và `ty-le`
 * (R4'', ĐỢT B). Cả hai đều là một dòng `approval_changes`, cùng hai nút Đồng ý/Từ chối và cùng
 * một đường quyết, nên chỉ KHÁC CHỮ trên dòng: nhãn nút, câu tóm tắt và câu nhắc khi từ chối.
 *
 * Dựng bằng DOM + `textContent` chứ không nối chuỗi: tên nhiệm vụ, tên file và tên người đề nghị đều
 * là dữ liệu người dùng nhập, cách này escape sẵn mà không phải nhớ bọc từng chỗ (TC-V7-UI-04).
 */
const NHAN_DE_NGHI = Object.freeze({
  "gui-bld": {
    loai: "Đổi tích Gửi BLĐ",
    duyet: "Duyệt đổi tích",
    tuChoi: "Từ chối đổi tích",
    hoiDuyet: "Duyệt đề nghị đổi tích Gửi BLĐ?",
    hoiTuChoi: "Từ chối đổi tích, giữ nguyên nhiệm vụ?",
    xongDuyet: "Đã duyệt đổi tích",
    xongTuChoi: "Đã từ chối, giữ nguyên tích và nhiệm vụ",
    choNhap: "Lý do từ chối (ít nhất 10 ký tự) — không xoá nhiệm vụ",
  },
  "ty-le": {
    loai: "Đổi tỷ lệ",
    duyet: "Duyệt tỷ lệ mới",
    tuChoi: "Từ chối",
    hoiDuyet: "Duyệt đề nghị đổi tỷ lệ? Giá trị hiện tại sẽ được thay bằng giá trị mới.",
    hoiTuChoi: "Từ chối đề nghị, giữ nguyên tỷ lệ hiện tại?",
    xongDuyet: "Đã duyệt — tỷ lệ mới có hiệu lực",
    xongTuChoi: "Đã từ chối, tỷ lệ hiện tại giữ nguyên",
    choNhap: "Lý do từ chối (ít nhất 10 ký tự) — tỷ lệ hiện tại giữ nguyên",
  },
});
function cauTomTatDeNghi(item, cfg) {
  const doi = String(item.change?.label || cfg.loai) + ": " +
    (item.change?.from || "—") + " → " + (item.change?.to || "—");
  // Đề nghị tỷ lệ của FILE phải nói rõ là của file nào — một nhiệm vụ có nhiều kết quả, chỉ in tên
  // nhiệm vụ thì người duyệt không biết con số nào đang bị xin đổi.
  const doiTuong = item.tenFile ? item.name + " — " + item.tenFile : item.name;
  return [item.code, doiTuong, doi, "Người đề nghị: " + (item.created_by_name || "—")].join(" · ");
}
function buildChangeApprovalRowHtml(item) {
  const cfg = NHAN_DE_NGHI[item.kind] || NHAN_DE_NGHI["gui-bld"];
  const row = document.createElement("div"); row.className = "change-row border-b py-3 flex flex-wrap gap-2 items-center";
  row.dataset.changeId = String(item.id);
  row.dataset.changeKind = String(item.kind || "gui-bld");
  // MỚI-3: hai nhãn y như bảng chờ duyệt — «Sửa» (mọi đề nghị ở đây đều là sửa cái đã duyệt) và đối
  // tượng. Đề nghị tỷ lệ CÓ THỂ nhắm vào một FILE kết quả (`tenFile` chỉ có ở kind `ty-le`), nên
  // không suy đối tượng từ `level` một mình: `level` là cấp của NHIỆM VỤ chứa file đó.
  const doiTuong = item.tenFile ? "File kết quả" : Number(item.level) === 2 ? "Công việc con" : "Nhiệm vụ";
  // Dựng chip bằng `textContent`, không `innerHTML`: builder này vốn theo khuôn DOM (xem docblock
  // `NHAN_DE_NGHI`) nên giữ nguyên khuôn, chỉ đọc chung bảng chữ `NHAN_DUYET`.
  const sua = document.createElement("span");
  sua.className = "duyet-nhan " + NHAN_DUYET.sua.mau;
  sua.title = NHAN_DUYET.sua.yNghia;
  sua.textContent = NHAN_DUYET.sua.nhan;
  const doiTuongEl = document.createElement("span");
  doiTuongEl.className = "duyet-nhan bg-gray-100 text-gray-600";
  doiTuongEl.textContent = doiTuong;
  const loai = document.createElement("span");
  loai.className = "duyet-nhan bg-amber-100 text-amber-700";
  loai.textContent = cfg.loai;
  const title = document.createElement("span"); title.className = "font-medium flex-1";
  title.textContent = cauTomTatDeNghi(item, cfg);
  const reason = document.createElement("input"); reason.className = "form-input text-sm"; reason.maxLength = 2000;
  reason.placeholder = cfg.choNhap;
  row.append(sua, doiTuongEl, loai, title, reason);
  for (const [action, label] of [["approve", cfg.duyet], ["reject", cfg.tuChoi]]) {
    const button = document.createElement("button"); button.type = "button"; button.dataset.changeDecision = action;
    button.className = action === "approve" ? "btn-primary" : "btn-secondary"; button.textContent = label; row.append(button);
  }
  return row.outerHTML;
}
function ganNutQuyetDinhDeNghi(list) {
  list?.querySelectorAll("[data-change-decision]").forEach(button => button.addEventListener("click", async () => {
    const row = button.closest(".change-row"); if (row.dataset.busy === "1") return;
    const cfg = NHAN_DE_NGHI[row.dataset.changeKind] || NHAN_DE_NGHI["gui-bld"];
    const action = button.dataset.changeDecision, reason = row.querySelector("input").value.trim();
    if (action === "reject" && reason.length < 10) { showToast("Lý do từ chối cần ít nhất 10 ký tự", "error"); return; }
    if (!window.confirm(action === "approve" ? cfg.hoiDuyet : cfg.hoiTuChoi)) return;
    row.dataset.busy = "1"; row.querySelectorAll("button").forEach(b => { b.disabled = true; });
    try {
      const result = await restPost("/api/v1/approvals/changes/" + encodeURIComponent(row.dataset.changeId) + "/" + action, action === "reject" ? { reason } : {});
      if (result) { showToast(action === "approve" ? cfg.xongDuyet : cfg.xongTuChoi, "success"); await napLaiSauDuyet(); }
    } finally { delete row.dataset.busy; row.querySelectorAll("button").forEach(b => { b.disabled = false; }); }
  }));
}

// Hoàn thành độc lập với % tiến độ và các trạng thái nhập tay cũ.
function daDuyetDuKetQua(dong) { return dong?.hoanThanh === true; }
function nhanHoanThanhKetQua(dong) {
  return daDuyetDuKetQua(dong) ? "Đã duyệt đủ kết quả" : "Chưa duyệt đủ kết quả";
}

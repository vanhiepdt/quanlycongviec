// Modal CHI TIẾT CÔNG VIỆC (cấp 1) — phiên bản mở rộng cho tính năng phân công ba lớp
// (yêu cầu 2026-08-26). File này NẠP SAU app.js nên hàm cùng tên ở đây GHI ĐÈ bản cũ:
//   • rộng ~1500px (≈ 2,5 lần modal cũ bị CSS giới hạn 600px);
//   • hiện đầy đủ Ban giám đốc kiểm soát + "Phụ trách chung" (lãnh đạo phòng của công việc to)
//     và danh sách cán bộ được giao gom từ cả công việc con lẫn nhiệm vụ;
//   • CÔNG VIỆC CON là khối xanh có tiêu đề + Ban kiểm soát/Lãnh đạo phòng riêng, bấm vào mới
//     xòe danh sách NHIỆM VỤ bên trong — nhiệm vụ dùng kiểu khối khác hẳn công việc con.
// Toàn bộ HTML dựng bằng builder có escape (quy ước chống XSS §4.6: build*/create*/render*).
"use strict";

/** Ô "nhãn trên — giá trị dưới" của modal chi tiết (dạng thẻ nhỏ, hết kiểu lệch hai đầu). */
function buildDetailRowHtml(label, value, trongRong) {
  const raw = String(value ?? "").trim();
  const coGiaTri = raw !== "" && raw !== "null" && raw !== "undefined";
  return (
    '<div class="bg-gray-50/80 border border-gray-100 rounded-lg px-3 py-2 min-w-0">' +
    '<div class="text-[11px] uppercase tracking-wide text-gray-400 truncate">' +
    escapeHtml(label) +
    "</div>" +
    (coGiaTri
      ? '<div class="text-sm font-semibold text-gray-800 break-words leading-snug">' + value + "</div>"
      : '<div class="text-sm italic font-normal text-gray-300">' + escapeHtml(trongRong || "—") + "</div>") +
    "</div>"
  );
}

/**
 * Dòng «Trạng thái duyệt / Người duyệt / Lý do từ chối» của modal chi tiết (2026-08-28).
 * Chỉ hiện khi có dữ liệu duyệt: Chờ duyệt ⇒ hiện người duyệt; Từ chối ⇒ hiện lý do + người duyệt.
 * Giá trị user-data qua escapeHtml — builder tự lo, caller đừng escape trước (§4.6).
 */
function buildPhanCongApprovalRowsHtml(project) {
  const trangThai = String((project && project[COL.P_APPROVAL]) || "");
  if (trangThai !== "Chờ duyệt" && trangThai !== "Từ chối") return "";
  const nguoiDuyet = String((project && project[COL.P_APPROVER]) || "").trim();
  const oThongTin = (nhan, giaTri, mauKhung) =>
    '<div class="' + mauKhung + ' rounded-lg px-3 py-2 min-w-0">' +
    '<div class="text-[11px] uppercase tracking-wide truncate">' + escapeHtml(nhan) + "</div>" +
    '<div class="text-sm font-semibold break-words leading-snug">' + escapeHtml(giaTri) + "</div></div>";
  let html =
    oThongTin(
      "Trạng thái duyệt",
      trangThai === "Chờ duyệt" ? "Chờ duyệt — chờ người duyệt xử lý" : "Bị từ chối",
      "bg-amber-50/80 border border-amber-100 text-amber-600"
    );
  if (trangThai === "Chờ duyệt") {
    html += oThongTin(
      "Người duyệt",
      nguoiDuyet || "Phó Giám đốc phụ trách phòng",
      "bg-gray-50/80 border border-gray-100 text-gray-400"
    );
  }
  if (trangThai === "Từ chối") {
    html += oThongTin(
      "Lý do từ chối",
      String((project && project[COL.P_REJECT_REASON]) || "").trim() || "—",
      "bg-red-50/80 border border-red-100 text-red-500"
    );
    html += oThongTin(
      "Người duyệt",
      nguoiDuyet || "—",
      "bg-gray-50/80 border border-gray-100 text-gray-400"
    );
  }
  return html;
}

/** Thẻ số liệu nhỏ trong cột tổng quan. */
function buildStatCardHtml(so, nhan, mauChu) {
  return (
    '<div class="bg-white rounded-xl p-3 text-center border border-gray-100">' +
    '<div class="text-2xl font-bold ' +
    escapeHtml(mauChu) +
    '">' +
    escapeHtml(so) +
    '</div><div class="text-xs text-gray-400">' +
    escapeHtml(nhan) +
    "</div></div>"
  );
}

/** Dấu chấm «·» ngăn các nhóm trong HÀNG phân công (xếp ngang bằng flex, tối đa xuống dòng 2). */
const PHAN_CONG_CACH_HTML =
  '<span class="phan-cong-cach select-none self-center px-2 sm:px-3 text-gray-300" aria-hidden="true">·</span>';

/** Icon BÚT CHỈ vẽ tay (SVG inline) cho nút sửa công việc con — KHÔNG nạp thư viện nào mới. */
function buildButChiIconHtml() {
  return (
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>' +
    "</svg>"
  );
}

/** «ten» có nằm trong chuỗi danh sách TÊN phân tách bởi dấu phẩy (T_SUP / T_LEADERS lưu tên hiển thị)? */
function tenTrongDanhSach(ten, chuoiDanhSach) {
  const canTra = String(ten || "").trim();
  if (!canTra) return false;
  return String(chuoiDanhSach || "")
    .split(",")
    .map(item => item.trim())
    .includes(canTra);
}

/**
 * Quyền SỬA phân công/thông tin của MỘT CÔNG VIỆC CON — bám đúng luật nguồn phía máy chủ
 * (005_phan_cong.sql): Quản trị hệ thống · Phó GĐ được nêu trong «Ban lãnh đạo kiểm soát» của
 * CHÍNH công việc con đó · lãnh đạo phòng của công việc con đó. Người thường chỉ xem.
 * Tái dùng isAdmin() sẵn có của app.js; hai danh sách do máy chủ trả về, không chế logic mới.
 */
function coQuyenSuaCongViecCon(sw) {
  if (!isAuthenticated || !currentUser || !sw) return false;
  if (isAdmin()) return true;
  // Ma trận §6: Phó GĐ/Trưởng phòng/Phó phòng đều có subwork:update trong phạm vi phòng mình
  // (máy chủ `inScope` chặn phạm vi) — không phụ thuộc việc có nằm trong phân công ba lớp hay không.
  if (laQuanTriTrongPhamVi()) return true;
  if (['Trưởng phòng', 'Phó phòng'].includes(String(currentUser.role || ''))) return true;
  const ten = String(currentUser.name || "").trim();
  if (!ten) return false;
  return tenTrongDanhSach(ten, sw[COL.T_SUP]) || tenTrongDanhSach(ten, sw[COL.T_LEADERS]);
}

/**
 * Nhóm nhỏ của HÀNG phân công (vòng lần 3): nhãn + giá trị CÙNG cỡ chữ nhỏ, đặt cạnh nhau trong
 * một hàng flex (khác buildDetailRowHtml — kiểu thẻ «label trên / value dưới» xếp dọc).
 * Builder nhận VĂN BẢN THÔ và tự escape MỘT lần — caller đừng escape trước (quy ước §4.6).
 */
function buildPhanCongNhomHtml(nhan, giaTri, trongRong) {
  const raw = String(giaTri == null ? "" : giaTri).trim();
  const coGiaTri = raw !== "" && raw !== "null" && raw !== "undefined";
  return (
    '<div class="phan-cong-nhom min-w-0 flex-1 basis-[180px] leading-snug">' +
    '<span class="phan-cong-nhan block text-[11px] uppercase tracking-wide text-gray-400 whitespace-nowrap mr-2">' +
    escapeHtml(nhan) +
    "</span>" +
    '<span class="phan-cong-gia block text-xs font-medium text-gray-700 break-words">' +
    (coGiaTri
      ? escapeHtml(raw)
      : '<span class="text-xs italic text-gray-300">' + escapeHtml(trongRong || "—") + "</span>") +
    "</span></div>"
  );
}

/** Bật/tắt danh sách nhiệm vụ nằm trong một công việc con. */
function batTatNhiemVuTrongCVCon(swCode) {
  const el = document.getElementById("sw-tasks-" + swCode);
  if (!el) return;
  el.classList.toggle("hidden");
  const icon = document.getElementById("sw-caret-" + swCode);
  if (icon) icon.style.transform = el.classList.contains("hidden") ? "rotate(-90deg)" : "";
}

/**
 * Khối CÔNG VIỆC CON: tiêu đề + Ban kiểm soát / Lãnh đạo phòng phụ trách / Cán bộ làm trực tiếp,
 * bấm vào tiêu đề để xòe các nhiệm vụ bên trong.
 */
function createSubworkDetailHtml(sw, tatCaNV) {
  const nvTrong = tatCaNV.filter(t => t[COL.T_PARENT] === sw[COL.T_ID]);
  // Cán bộ thực hiện của công việc con = những người được gán ở NHIỆM VỤ bên trong nó.
  const canBoThucHien = [
    ...new Set(nvTrong.map(t => t[COL.T_ASSIGNEE]).filter(v => v && v !== "Chưa gán")),
  ].join(", ");
  return (
    '<div class="bg-blue-50/60 border border-blue-100 rounded-xl p-3 mb-3">' +
    // KHUNG TIÊU ĐỀ RIÊNG (vòng lần 3): tên công việc con nằm trong hộp trắng viền xanh — rõ
    // ranh giới với danh sách nhiệm vụ bên dưới, bỏ kiểu chữ trôi trên nền xanh.
    '<div class="cv-con-tieu-de bg-white/90 border border-blue-200 rounded-lg px-3 py-2 shadow-sm flex items-center justify-between cursor-pointer select-none gap-2" onclick="batTatNhiemVuTrongCVCon(\'' +
    escapeForInlineHandler(sw[COL.T_ID]) +
    '\')">' +
    '<div class="flex items-center gap-2 min-w-0">' +
    '<i id="sw-caret-' +
    escapeHtml(sw[COL.T_ID]) +
    '" class="fas fa-chevron-down text-gray-400 text-xs transition-transform" style="transform: rotate(-90deg)"></i>' +
    '<i class="fas fa-folder-open text-blue-400"></i>' +
    '<span class="font-semibold text-gray-900 truncate">' +
    escapeHtml(sw[COL.T_NAME]) +
    "</span>" +
    '<span class="text-xs px-2 py-0.5 rounded-full bg-white border border-blue-100 text-blue-600 whitespace-nowrap">' +
    nvTrong.length +
    " nhiệm vụ</span>" +
    "</div>" +
    '<div class="text-xs text-gray-500 whitespace-nowrap">Tiến độ ' +
    escapeHtml(sw[COL.T_COMPLETION] || 0) +
    "%</div>" +
    // BÚT CHỈ sửa phân công/thông tin CV con — HIỂN THỊ THEO QUYỀN (coQuyenSuaCongViecCon):
    // Quản trị hệ thống · Phó GĐ trong «Ban lãnh đạo kiểm soát» của CV con này · lãnh đạo phòng
    // của CV con này. Người khác chỉ xem; quyền còn được kiểm lại LÚC BẤM (sau phần render).
    (coQuyenSuaCongViecCon(sw)
      ? '<button type="button" class="edit-subwork-btn ml-1 shrink-0 p-1 rounded-md border border-blue-200 bg-white text-blue-500 hover:bg-blue-50 hover:text-blue-700" data-id="' +
        escapeHtml(sw[COL.T_ID]) +
        '" title="Sửa phân công / thông tin công việc con" aria-label="Sửa công việc con">' +
        buildButChiIconHtml() +
        "</button>"
      : "") +
    "</div>" +
    // Thông tin phân công của CV con: MỘT hàng ngang gọn giống khối «Phân công» phía trên,
    // chữ nhỏ cùng cỡ — thay cho lưới 3 ô xếp dọc cũ.
    '<div class="phan-cong-hang flex flex-wrap items-start gap-y-1 mt-2">' +
    buildPhanCongNhomHtml("Ban lãnh đạo kiểm soát", sw[COL.T_SUP], "Chưa phân công") +
    PHAN_CONG_CACH_HTML +
    buildPhanCongNhomHtml("Lãnh đạo phòng phụ trách", sw[COL.T_LEADERS], "Chưa phân công") +
    PHAN_CONG_CACH_HTML +
    buildPhanCongNhomHtml("Cán bộ thực hiện", canBoThucHien, "Chưa có nhiệm vụ được gán") +
    "</div>" +
    '<div id="sw-tasks-' +
    escapeHtml(sw[COL.T_ID]) +
    '" class="mt-3 space-y-2 hidden">' +
    (nvTrong.length
      ? nvTrong.map(t => createTaskListItem(t)).join("")
      : '<p class="text-sm text-gray-400 italic py-2">Chưa có nhiệm vụ nào trong công việc con này</p>') +
    (canUserCreateTask()
      ? '<div class="pt-1"><button type="button" class="text-xs font-medium text-blue-600 hover:text-blue-800 add-task-from-subwork-btn" data-project-id="' +
        escapeHtml(sw[COL.T_PID]) +
        '" data-project-name="' +
        escapeHtml((allProjects.find(p => p[COL.P_ID] === sw[COL.T_PID]) || {})[COL.P_NAME] || "") +
        '" data-parent-id="' +
        escapeHtml(sw[COL.T_ID]) +
        '"><i class="fas fa-plus mr-1"></i>Thêm nhiệm vụ cho công việc con này</button></div>'
      : "") +
    "</div>" +
    "</div>"
  );
}

/**
 * Bản MỚI của modal chi tiết công việc — ghi đè hàm cùng tên trong app.js.
 * Nhiệm vụ (cấp 3) render bằng createTaskListItem (thẻ trắng); Công việc con (cấp 2) render
 * bằng createSubworkDetailHtml (khối xanh có phân công riêng) — hai cấp không lẫn kiểu.
 */
function showProjectDetailsModal(projectId, projectName) {
  const project = allProjects.find(p => p[COL.P_ID] === projectId) || {};
  const tatCaNV = allTasks.filter(t => t[COL.T_PID] === projectId && Number(t[COL.T_LEVEL]) === 3);
  const cvCons = allTasks.filter(t => t[COL.T_PID] === projectId && Number(t[COL.T_LEVEL]) === 2);
  const nvMoiCoi = tatCaNV.filter(t => !cvCons.some(sw => sw[COL.T_ID] === t[COL.T_PARENT]));
  const hoanThanh = tatCaNV.filter(t =>
    (t[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")
  ).length;
  const dangLam = tatCaNV.filter(t => (t[COL.T_STATUS] || "").toLowerCase().includes("đang")).length;
  const treHan = tatCaNV.filter(
    t => isTaskOverdue(t[COL.T_DUE]) && !(t[COL.T_STATUS] || "").toLowerCase().includes("hoàn thành")
  ).length;
  const tongTienDo = tatCaNV.length
    ? Math.round(
        tatCaNV.reduce((acc, t) => acc + parseInt(t[COL.T_COMPLETION] || 0), 0) / tatCaNV.length
      )
    : 0;
  const canBoThamGia = [
    ...new Set(tatCaNV.map(t => t[COL.T_ASSIGNEE]).filter(v => v && v !== "Chưa gán")),
  ];

  const swHtml = cvCons.length
    ? cvCons.map(sw => createSubworkDetailHtml(sw, tatCaNV)).join("")
    : '<div class="text-center py-10 text-gray-400"><i class="fas fa-folder-open text-3xl mb-2 opacity-30"></i><p class="text-sm">Chưa có công việc con nào</p></div>';

  const orphanHtml = nvMoiCoi.length
    ? '<h5 class="font-semibold text-gray-700 mt-4 mb-2 text-xs uppercase tracking-wide">Nhiệm vụ trực thuộc công việc (không qua công việc con)</h5>' +
      nvMoiCoi.map(t => createTaskListItem(t)).join("")
    : "";

  
  const text =
    "\n" +
    '<div id="project-details-modal" class="modal active z-[60]">\n' +
    '    <div class="modal-content glass-card w-full mx-0 md:mx-4 h-full md:h-[93vh] flex flex-col p-0 rounded-none md:rounded-2xl" style="max-width: 1500px !important; width: 96vw !important;">\n' +
    '        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-white z-10">\n' +
    '            <h3 class="text-lg md:text-xl font-bold text-gray-900 truncate pr-2">Chi tiết công việc: ' +
    escapeHtml(projectName) +
    '</h3>\n' +
    '            <button type="button" class="close-modal text-gray-400 hover:text-gray-600 p-2"><i class="fas fa-times text-lg"></i></button>\n' +
    "        </div>\n" +
    '        <div class="flex-1 overflow-y-auto p-5 space-y-4">\n' +
    '            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">\n' +
    buildStatCardHtml(tatCaNV.length, "Nhiệm vụ", "text-blue-600") +
    buildStatCardHtml(hoanThanh, "Hoàn thành", "text-green-600") +
    buildStatCardHtml(dangLam, "Đang làm", "text-amber-600") +
    buildStatCardHtml(treHan, "Trễ hạn", "text-red-500") +
    "            </div>\n" +
    '            <div class="bg-white rounded-xl p-4 border border-gray-100">\n' +
    '                <h5 class="font-semibold text-gray-800 mb-2 text-sm">Phân công</h5>\n' +
        '                <div class="phan-cong-hang flex flex-wrap items-start gap-y-1">\n' +
    buildPhanCongNhomHtml("Ban lãnh đạo kiểm soát", project[COL.P_SUP], "Chưa phân công") + PHAN_CONG_CACH_HTML +
    buildPhanCongNhomHtml("Lãnh đạo phòng phụ trách", project[COL.P_LEADERS], "Chưa phân công") + PHAN_CONG_CACH_HTML +
    buildPhanCongNhomHtml("Cán bộ thực hiện", canBoThamGia.join(", "), "Chưa giao cho cán bộ nào") +
    "                </div>\n" +
    '                <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-3">\n' +
    buildDetailRowHtml("Phòng", escapeHtml(project[COL.P_DEPT]), "Công việc chung") +
    buildPhanCongApprovalRowsHtml(project) +
    buildDetailRowHtml(
      "Thời gian",
      escapeHtml(formatDateForDisplay(project[COL.P_START])) +
        " → " +
        escapeHtml(formatDateForDisplay(project[COL.P_END]))
    ) +
    buildDetailRowHtml("Số công việc con", escapeHtml(cvCons.length)) +
    buildDetailRowHtml("Tiến độ chung", escapeHtml(tongTienDo) + "%") +
    "                </div>\n" +
    "            </div>\n" +
    '            <div>\n' +
    '                <div class="flex items-center justify-between mb-3">\n' +
    '                    <h5 class="font-semibold text-gray-700 text-sm uppercase tracking-wide">Cây công việc</h5>\n' +
    "                    " +
    (canUserCreateTask()
      ? '<button type="button" class="btn-primary py-1.5 text-xs mr-2 add-task-from-project-btn" data-project-id="' +
        escapeHtml(projectId) +
        '" data-project-name="' +
        escapeHtml(projectName) +
        '" title="+ Nhiệm vụ"><i class="fas fa-plus mr-1"></i>+ Nhiệm vụ</button>'
      : "") +
    createSubworkFromWorkButtonHtml(projectId, projectName, "btn-secondary py-1.5 text-xs", true) +
    "\n" +
    "                </div>\n" +
    swHtml +
    orphanHtml +
    "\n            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n";

  document.getElementById("modals-container").innerHTML = text;
  const modalEl = document.getElementById("project-details-modal");
  if (!modalEl) return;
  modalEl.classList.add("active");
  modalEl.querySelectorAll(".close-modal").forEach(closeButton => {
    closeButton.addEventListener("click", event => {
      event.preventDefault();
      closeModal("project-details-modal");
    });
  });
  // NÚT BÚT CHỈ trên từng khối Công việc con — mở form sửa phân công/thông tin CV con
  // (openEditModal với type "task" hiện đủ ô Ban lãnh đạo / Lãnh đạo phòng của cấp 2).
  // Quyền được kiểm LẠI lúc bấm bằng đúng hàm đã dùng khi render — chống bấm nút cũ còn treo
  // hoặc can thiệp DOM thủ công; máy chủ vẫn là rào chặn cuối cùng.
  modalEl.querySelectorAll(".edit-subwork-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const id = String(button.dataset.id || "");
      const sw = allTasks.find(t => t[COL.T_ID] === id);
      coQuyenSuaCongViecCon(sw)
        ? openEditModal("task", id)
        : showToast("Bạn không có quyền sửa phân công của công việc con này", "error");
    });
  });
}


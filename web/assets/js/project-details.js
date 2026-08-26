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
  return (
    '<div class="bg-blue-50/60 border border-blue-100 rounded-xl p-3 mb-3">' +
    '<div class="flex items-center justify-between cursor-pointer select-none gap-2" onclick="batTatNhiemVuTrongCVCon(\'' +
    escapeForInlineHandler(sw[COL.T_ID]) +
    '\')">' +
    '<div class="flex items-center gap-2 min-w-0">' +
    '<i id="sw-caret-' +
    escapeHtml(sw[COL.T_ID]) +
    '" class="fas fa-chevron-down text-gray-400 text-xs transition-transform" style="transform: rotate(-90deg)"></i>' +
    '<i class="fas fa-folder-open text-blue-400"></i>' +
    '<span class="font-semibold text-gray-900 truncate">' +
    escapeHtml(sw[COL.T_NAME]) +
    '</span> <span class="text-xs text-gray-400 whitespace-nowrap">(' +
    escapeHtml(sw[COL.T_ID]) +
    ")</span>" +
    '<span class="text-xs px-2 py-0.5 rounded-full bg-white border border-blue-100 text-blue-600 whitespace-nowrap">' +
    nvTrong.length +
    " nhiệm vụ</span>" +
    "</div>" +
    '<div class="text-xs text-gray-500 whitespace-nowrap">Tiến độ ' +
    escapeHtml(sw[COL.T_COMPLETION] || 0) +
    "%</div>" +
    "</div>" +
    '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">' +
    buildDetailRowHtml("Ban lãnh đạo kiểm soát", escapeHtml(sw[COL.T_SUP]), "Chưa phân công") +
    buildDetailRowHtml("Lãnh đạo phòng phụ trách", escapeHtml(sw[COL.T_LEADERS]), "Chưa phân công") +
    buildDetailRowHtml("Cán bộ làm trực tiếp", escapeHtml(sw[COL.T_ASSIGNEE]), "Chưa gán") +
    "</div>" +
    '<div id="sw-tasks-' +
    escapeHtml(sw[COL.T_ID]) +
    '" class="mt-3 space-y-2 hidden">' +
    (nvTrong.length
      ? nvTrong.map(t => createTaskListItem(t)).join("")
      : '<p class="text-sm text-gray-400 italic py-2">Chưa có nhiệm vụ nào trong công việc con này</p>') +
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

  const canBoHtml = canBoThamGia.length
    ? canBoThamGia
        .map(
          cb =>
            '<span class="inline-block bg-blue-50 text-blue-700 rounded-full px-3 py-1 text-xs mr-1 mb-1"><i class="fas fa-user mr-1 opacity-60"></i>' +
            escapeHtml(cb) +
            "</span>"
        )
        .join("")
    : '<p class="text-sm text-gray-400 italic">Chưa giao cho cán bộ nào</p>';

  const text =
    "\n" +
    '<div id="project-details-modal" class="modal active z-[60]">\n' +
    '    <div class="modal-content glass-card w-full mx-0 md:mx-4 h-full md:h-[93vh] flex flex-col p-0 rounded-none md:rounded-2xl" style="max-width: 1500px !important; width: 96vw !important;">\n' +
    '        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-white z-10">\n' +
    '            <h3 class="text-lg md:text-xl font-bold text-gray-900 truncate pr-2">Chi tiết công việc: ' +
    escapeHtml(projectName) +
    " (" +
    escapeHtml(projectId) +
    ')</h3>\n' +
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
    '                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">\n' +
    buildDetailRowHtml("Phòng", escapeHtml(project[COL.P_DEPT]), "Công việc chung") +
    buildDetailRowHtml("Ban lãnh đạo kiểm soát", escapeHtml(project[COL.P_SUP]), "Chưa phân công") +
    buildDetailRowHtml("Phụ trách chung (lãnh đạo phòng)", escapeHtml(project[COL.P_LEADERS]), "Chưa phân công") +
    buildDetailRowHtml("Trạng thái", escapeHtml(project[COL.P_STATUS])) +
    "                </div>\n" +
    '                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">\n' +
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
    '            <div class="bg-white rounded-xl p-4 border border-gray-100">\n' +
    '                <h5 class="font-semibold text-gray-800 mb-2 text-sm">Cán bộ được giao (' +
    canBoThamGia.length +
    ')</h5>\n' +
    canBoHtml +
    "\n            </div>\n" +
    '            <div>\n' +
    '                <div class="flex items-center justify-between mb-3">\n' +
    '                    <h5 class="font-semibold text-gray-700 text-sm uppercase tracking-wide">Cây công việc</h5>\n' +
    "                    " +
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
}


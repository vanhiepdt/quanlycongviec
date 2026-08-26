// tools/sua-khoi-phan-cong.mjs — làm lại khối "Phân công" của modal chi tiết (project-details.js):
// dạng thẻ stacked 4 cột, bỏ hàng "Quản lý công việc", nhãn rỗng thành "Chưa phân công".
import { readFileSync, writeFileSync } from "node:fs";
const p = "e:/quanlycongviec/web/assets/js/project-details.js";
let s = readFileSync(p, "utf8");
if (!s.includes("Ban giám đốc kiểm soát")) {
  console.log("[sua-khoi-phan-cong] đã sửa từ trước — không làm gì");
  process.exit(0);
}
const mocDau = "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-x-6";
const i0 = s.indexOf(mocDau);
if (i0 < 0) throw new Error("không thấy khối grid cũ");
const start = s.lastIndexOf("'", i0);
const m0 = s.indexOf("Tiến độ chung", i0);
if (m0 < 0) throw new Error("không thấy mốc Tiến độ chung");
const m1 = s.indexOf('</div>\\n" +', m0);
if (m1 < 0) throw new Error("không thấy mốc đóng div");
const end = m1 + '</div>\\n" +'.length;
const moi = `'                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">\\n' +
    buildDetailRowHtml("Phòng", escapeHtml(project[COL.P_DEPT]), "Công việc chung") +
    buildDetailRowHtml("Ban lãnh đạo kiểm soát", escapeHtml(project[COL.P_SUP]), "Chưa phân công") +
    buildDetailRowHtml("Phụ trách chung (lãnh đạo phòng)", escapeHtml(project[COL.P_LEADERS]), "Chưa phân công") +
    buildDetailRowHtml("Trạng thái", escapeHtml(project[COL.P_STATUS])) +
    "                </div>\\n" +
    '                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">\\n' +
    buildDetailRowHtml(
      "Thời gian",
      escapeHtml(formatDateForDisplay(project[COL.P_START])) +
        " → " +
        escapeHtml(formatDateForDisplay(project[COL.P_END]))
    ) +
    buildDetailRowHtml("Số công việc con", escapeHtml(cvCons.length)) +
    buildDetailRowHtml("Tiến độ chung", escapeHtml(tongTienDo) + "%") +
    "                </div>\\n" +`;
s = s.slice(0, start) + moi + s.slice(end);
writeFileSync(p, s, "utf8");
console.log("[sua-khoi-phan-cong] đã thay khối Phân công, cắt", end - start, "ký tự");

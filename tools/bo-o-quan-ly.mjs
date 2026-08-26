// tools/bo-o-quan-ly.mjs — bỏ ô "Quản lý công việc" khỏi modal tạo/sửa công việc (yêu cầu 2026-08-26).
// Guard chống chạy lặp: nếu không còn thấy nhãn thì thoát 0.
import { readFileSync, writeFileSync } from "node:fs";
const p = "e:/quanlycongviec/web/assets/js/app.js";
let s = readFileSync(p, "utf8");
const label = "Quản lý công việc</label>";
const n = s.split(label).length - 1;
if (n === 0) {
  console.log("[bo-o-quan-ly] đã bỏ từ trước — không làm gì");
  process.exit(0);
}
if (n > 1) throw new Error("nhãn xuất hiện " + n + " lần, không cắt mù được");
const divIdx = s.lastIndexOf("<div class=", s.indexOf(label));
const selEnd = s.indexOf("</select>", s.indexOf(label));
const divEnd = s.indexOf("</div>", selEnd) + "</div>".length;
if (divIdx < 0 || selEnd < 0 || divEnd < 6) throw new Error("không tìm được mốc cắt");
const removed = s.slice(divIdx, divEnd);
if (!removed.includes("manager") || removed.length > 2500) throw new Error("mốc cắt bất thường, dừng");
s = s.slice(0, divIdx) + s.slice(divEnd);
writeFileSync(p, s, "utf8");
console.log("[bo-o-quan-ly] đã bỏ ô Quản lý công việc, cắt", removed.length, "ký tự");

// tools/dem-xss.mjs — đếm số chỗ ghi HTML / giá trị nội suy của app.js bằng bộ soát của test.
import { soatFile } from "../server/tests/helpers/xss-audit.js";
const { sites, sinks } = soatFile("e:/quanlycongviec/web/assets/js/app.js");
console.log("sink =", sinks.length, "| gia_tri =", sites.length);
const dem = {};
for (const s of sites.filter(x => x.ctx === "trong-the")) dem[s.ma] = (dem[s.ma] || 0) + 1;
console.log("trong-the:", JSON.stringify(dem));

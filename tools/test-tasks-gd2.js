// Kiểm thử GĐ2 bằng Node + sheet giả. Không phải phần của dự án — file tạm.
const fs = require("fs"), vm = require("vm");
const code = fs.readFileSync("e:/quanlycongviec/Code.gs.moi", "utf8")
  // Bỏ 78 cổng license để test logic (không sửa file thật, chỉ sửa bản trong bộ nhớ).
  .replace(/\n\s*var licenseKey = getLicenseState\(\);/g, "")
  .replace(/\n\s*if \(!licenseKey \|\| !isValidLicenseKey\(licenseKey\) \|\| getLicenseState\.toString\(\)\.length < 80\) return;/g, "");

// ---- sheet giả -------------------------------------------------------------
function makeSheet(headers, rows) {
  const grid = [headers.slice(), ...rows.map(r => r.slice())];
  return {
    _grid: grid,
    getName: () => "Dự án/Nhiệm vụ",
    getLastRow: () => grid.length,
    getLastColumn: () => headers.length,
    getRange(row, col, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return {
        getValues: () => {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const line = [];
            for (let j = 0; j < nc; j++) line.push(grid[row - 1 + i][col - 1 + j]);
            out.push(line);
          }
          return out;
        },
        getValue: () => grid[row - 1][col - 1],
        getDisplayValues: () => {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const line = [];
            for (let j = 0; j < nc; j++) line.push(String(grid[row - 1 + i][col - 1 + j]));
            out.push(line);
          }
          return out;
        },
        setValue: v => { grid[row - 1][col - 1] = v; }
      };
    }
  };
}

const HEADERS = ["Mã dự án", "Tên dự án", "Nhiệm vụ JSON"];
function task(o) { return o; }

function build(sheet) {
  const ctx = { console, JSON, Date, String, Number, Math, Array, Object, isNaN, parseInt, parseFloat, undefined: undefined };
  ctx.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({ getSheetByName: n => (n === "Dự án/Nhiệm vụ" ? sheet : null) }),
    flush: () => {}
  };
  ctx.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  ctx.Utilities = { formatDate: (d, tz, f) => d.toISOString().slice(0, 10) };
  ctx.Session = { getScriptTimeZone: () => "UTC", getEffectiveUser: () => ({ getEmail: () => "admin@gmail.com" }) };
  ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  vm.runInContext(`
    logActivity = function () {};
    getHeaders = function (sheet) { return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; };
    buildStaffNameEmailMap = function () { return { byName: { "An": "an@x.vn", "Bình": "binh@x.vn" }, duplicated: { "Trùng": true } }; };
  `, ctx);
  return ctx;
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  => " + JSON.stringify(extra) : "")); }
}
function jsonOf(sheet, row) { return JSON.parse(sheet._grid[row - 1][2]); }

// ---- 1. deleteTask: xoá đệ quy -------------------------------------------
console.log("\n[1] deleteTask xoá đệ quy");
{
  const list = [
    task({ "Mã nhiệm vụ": "S1", "Tên nhiệm vụ": "Khảo sát", "Cấp": 2, "Mã cha": "" }),
    task({ "Mã nhiệm vụ": "T1", "Tên nhiệm vụ": "Soạn phiếu", "Cấp": 3, "Mã cha": "S1" }),
    task({ "Mã nhiệm vụ": "T2", "Tên nhiệm vụ": "Phát phiếu", "Cấp": 3, "Mã cha": "S1" }),
    task({ "Mã nhiệm vụ": "T3", "Tên nhiệm vụ": "Việc lẻ", "Cấp": 3, "Mã cha": "" })
  ];
  const sheet = makeSheet(HEADERS, [["DA001", "Dự án 1", JSON.stringify(list)]]);
  const ctx = build(sheet);
  const r = ctx.deleteTask("S1");
  check("success", r.success === true, r);
  check("deletedChildren = [T1,T2]", JSON.stringify(r.deletedChildren) === '["T1","T2"]', r.deletedChildren);
  check("deletedCount = 3", r.deletedCount === 3, r.deletedCount);
  check("level = 2", r.level === 2, r.level);
  check("còn lại đúng T3", JSON.stringify(jsonOf(sheet, 2).map(t => t["Mã nhiệm vụ"])) === '["T3"]', jsonOf(sheet, 2));
}
{
  const list = [
    task({ "Mã nhiệm vụ": "S1", "Cấp": 2, "Mã cha": "" }),
    task({ "Mã nhiệm vụ": "T1", "Cấp": 3, "Mã cha": "S1" })
  ];
  const sheet = makeSheet(HEADERS, [["DA001", "Dự án 1", JSON.stringify(list)]]);
  const ctx = build(sheet);
  const r = ctx.deleteTask("T1");
  check("xoá cấp 3 không kéo theo ai", r.success === true && r.deletedChildren.length === 0 && r.level === 3, r);
  check("cha S1 còn nguyên", JSON.stringify(jsonOf(sheet, 2).map(t => t["Mã nhiệm vụ"])) === '["S1"]', jsonOf(sheet, 2));
}
{
  const sheet = makeSheet(HEADERS, [["DA001", "Dự án 1", JSON.stringify([task({ "Mã nhiệm vụ": "T1" })])]]);
  const ctx = build(sheet);
  check("mã không tồn tại => lỗi rõ", ctx.deleteTask("XXX").success === false);
}
{
  // dữ liệu trỏ vòng sẵn (A cha B, B cha A) — không được treo
  const list = [
    task({ "Mã nhiệm vụ": "A", "Cấp": 2, "Mã cha": "B" }),
    task({ "Mã nhiệm vụ": "B", "Cấp": 2, "Mã cha": "A" })
  ];
  const sheet = makeSheet(HEADERS, [["DA001", "Dự án 1", JSON.stringify(list)]]);
  const ctx = build(sheet);
  const r = ctx.deleteTask("A");
  check("dữ liệu trỏ vòng: không treo, xoá cả 2", r.success === true && r.deletedCount === 2, r);
}

// ---- 2. updateTask -------------------------------------------------------
console.log("\n[2] updateTask");
function baseSheet() {
  const list = [
    task({ "Mã nhiệm vụ": "S1", "Tên nhiệm vụ": "Khảo sát", "Cấp": 2, "Mã cha": "", "Người thực hiện": "An", "Email người thực hiện": "an@x.vn", "Nhắc việc": [{ id: "R1" }] }),
    task({ "Mã nhiệm vụ": "S2", "Tên nhiệm vụ": "Rà soát", "Cấp": 2, "Mã cha": "" }),
    task({ "Mã nhiệm vụ": "T1", "Tên nhiệm vụ": "Soạn phiếu", "Cấp": 3, "Mã cha": "S1", "Người thực hiện": "An", "Email người thực hiện": "an@x.vn" })
  ];
  return makeSheet(HEADERS, [
    ["DA001", "Dự án 1", JSON.stringify(list)],
    ["DA002", "Dự án 2", JSON.stringify([])]
  ]);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("T1", { name: "Soạn phiếu v2", projectId: "DA001", assignee: "An", parentId: "S2" });
  check("đổi Mã cha sang cấp 2 khác => OK", r.success === true && r.parentId === "S2", r);
  const t1 = jsonOf(sheet, 2).find(t => t["Mã nhiệm vụ"] === "T1");
  check("ghi đúng Mã cha", t1["Mã cha"] === "S2", t1);
  check("giữ Cấp = 3", t1["Cấp"] === 3, t1);
  check("tên không đổi => giữ email cũ", t1["Email người thực hiện"] === "an@x.vn", t1);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("T1", { name: "x", projectId: "DA001", assignee: "Bình" });
  const t1 = jsonOf(sheet, 2).find(t => t["Mã nhiệm vụ"] === "T1");
  check("đổi họ tên => tra lại email", t1["Email người thực hiện"] === "binh@x.vn", t1);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  ctx.updateTask("T1", { name: "x", projectId: "DA001", assignee: "Trùng" });
  const t1 = jsonOf(sheet, 2).find(t => t["Mã nhiệm vụ"] === "T1");
  check("tên trùng trong sheet Người dùng => email rỗng, không giữ email người cũ", t1["Email người thực hiện"] === "", t1);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("T1", { name: "x", projectId: "DA001", level: 2 });
  check("chặn đổi Cấp 3 -> 2", r.success === false && /Không thể đổi/.test(r.error), r);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("T1", { name: "x", projectId: "DA001", parentId: "T1" });
  check("chặn tự trỏ vào chính mình", r.success === false, r);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("T1", { name: "x", projectId: "DA001", parentId: "S9" });
  check("chặn Mã cha không tồn tại", r.success === false, r);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("S1", { name: "x", projectId: "DA001", parentId: "S2" });
  check("chặn cấp 2 nhận Mã cha", r.success === false, r);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("S1", { name: "Khảo sát", projectId: "DA002", assignee: "An" });
  check("chặn move cấp 2 đang có con", r.success === false && /nhiệm vụ con/.test(r.error), r);
  check("dữ liệu dòng nguồn không bị sứt", jsonOf(sheet, 2).length === 3, jsonOf(sheet, 2).length);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("S2", { name: "Rà soát", projectId: "DA002" });
  check("move cấp 2 KHÔNG có con => OK", r.success === true && r.moved === true, r);
  check("nguồn còn 2", jsonOf(sheet, 2).length === 2, jsonOf(sheet, 2).length);
  const moved = jsonOf(sheet, 3);
  check("đích nhận 1, giữ Cấp = 2", moved.length === 1 && moved[0]["Cấp"] === 2, moved);
  check("đích có mã mới", moved[0]["Mã nhiệm vụ"] !== "S2", moved[0]["Mã nhiệm vụ"]);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("T1", { name: "Soạn phiếu", projectId: "DA002", assignee: "An" });
  check("move cấp 3 => bỏ Mã cha", r.success === true && r.parentCleared === true, r);
  check("Mã cha đích rỗng", jsonOf(sheet, 3)[0]["Mã cha"] === "", jsonOf(sheet, 3)[0]);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r = ctx.updateTask("S1", { name: "Khảo sát", projectId: "DA999" });
  check("dự án đích không tồn tại => lỗi VÀ không mất nhiệm vụ", r.success === false && jsonOf(sheet, 2).length === 3, r);
}
{
  const sheet = baseSheet(), ctx = build(sheet);
  ctx.updateTask("S1", { name: "Khảo sát mới", projectId: "DA001" });
  const s1 = jsonOf(sheet, 2).find(t => t["Mã nhiệm vụ"] === "S1");
  check("sửa tại chỗ giữ nguyên Nhắc việc", Array.isArray(s1["Nhắc việc"]) && s1["Nhắc việc"].length === 1, s1["Nhắc việc"]);
}

// ---- 3. getTasks / extractTasksFromProjectValues -------------------------
console.log("\n[3] getTasks & extractTasksFromProjectValues bơm mặc định");
{
  const legacy = [
    task({ "Mã nhiệm vụ": "L1", "Tên nhiệm vụ": "Việc cũ chưa migrate" }),      // thiếu cả 2 khoá
    task({ "Mã nhiệm vụ": "L2", "Cấp": "2", "Mã cha": "  " }),                  // Cấp dạng chuỗi
    task({ "Mã nhiệm vụ": "L3", "Cấp": "3", "Mã cha": " L2 " })                 // Mã cha có khoảng trắng
  ];
  const sheet = makeSheet(HEADERS, [
    ["DA001", "Dự án 1", JSON.stringify(legacy)],
    ["DA002", "Dự án 2", "{ day la JSON hong"],
    ["DA003", "Dự án 3", ""]
  ]);
  const ctx = build(sheet);
  const out = ctx.getTasks();
  check("JSON hỏng ở 1 dòng không làm mất cả danh sách", out.length === 3, out.length);
  check("L1 được bơm Cấp = 3 (Number)", out[0]["Cấp"] === 3, out[0]);
  check("L1 được bơm Mã cha = ''", out[0]["Mã cha"] === "", out[0]);
  check("L1 có Mã dự án", out[0]["Mã dự án"] === "DA001", out[0]);
  check("L2 Cấp chuỗi '2' => Number 2", out[1]["Cấp"] === 2, out[1]);
  check("L2 là cấp 2 nên Mã cha bị ép rỗng", out[1]["Mã cha"] === "", out[1]);
  check("L3 Mã cha được trim", out[2]["Mã cha"] === "L2", out[2]);

  const values = sheet._grid;
  const out2 = ctx.extractTasksFromProjectValues(values);
  check("extractTasksFromProjectValues cho kết quả giống getTasks", JSON.stringify(out2) === JSON.stringify(out), out2.length);
}

// ---- 4. addTask vẫn chạy (không hồi quy) ---------------------------------
console.log("\n[4] addTask không hồi quy");
{
  const sheet = baseSheet(), ctx = build(sheet);
  const r1 = ctx.addTask({ name: "NV mới", projectId: "DA001" });
  check("thêm không truyền level => Cấp 3", r1.success === true && r1.level === 3, r1);
  const r2 = ctx.addTask({ name: "CV con mới", projectId: "DA001", level: 2 });
  check("thêm level 2 => Cấp 2", r2.success === true && r2.level === 2, r2);
  const r3 = ctx.addTask({ name: "sai cha", projectId: "DA001", level: 3, parentId: "T1" });
  check("chặn lấy cấp 3 làm cha", r3.success === false, r3);
}

console.log("\n=== " + pass + " OK, " + fail + " FAIL ===");
process.exit(fail ? 1 : 0);

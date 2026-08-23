# Hướng dẫn bảo trì & phát triển

Cập nhật: 2026-08-23. Đọc file này trước khi sửa bất cứ thứ gì.

## 1. Dự án là gì

Web app quản lý dự án / nhiệm vụ chạy trên **Google Apps Script**, dữ liệu lưu trong
Google Sheets. Backend là một file `.gs`; frontend là HTML + JS nhúng, phục vụ qua
`HtmlService`. Bản gốc nhận được đã bị **obfuscate** (javascript-obfuscator, biến thể
string-array + rotation); toàn bộ công việc tới nay là dịch ngược nó về dạng đọc được
mà **không đổi một hành vi nào**.

## 2. Bản đồ file

| File | Vai trò | Sửa được? |
|---|---|---|
| `Code.gs` | Backend **gốc, đã obfuscate**. Bản đối chiếu. | ❌ giữ nguyên |
| `js.html` | Frontend **gốc, đã obfuscate**. Bản đối chiếu. | ❌ giữ nguyên |
| `Code.clean.gs` | Backend đã dịch ngược + đặt tên. Chuẩn tham chiếu. | ⚠️ chỉ khi có lý do |
| `Code.gs.moi` | Backend đang dùng để phát triển (xem §7). | ✅ |
| `js.clean.html` | Frontend đã dịch ngược, **0 biến `_0x`**. | ✅ |
| `index.html` | Khung HTML (các `*-section`, modal container). | ✅ |
| `CSS.html` | Style. | ✅ |
| `js.clean.html.bak`, `Code.gs.moi.bak` | Bản lưu trước lần sửa gần nhất. | – |
| `unmapped_report.txt` | Báo cáo biến chưa suy được (giờ đã rỗng phần đó). | – |
| `tools/` | Bộ script dịch ngược + kiểm chứng (§6). | ✅ |

Khi deploy lên Apps Script: dán `Code.gs.moi` vào file script, `js.clean.html` +
`index.html` + `CSS.html` vào các file HTML tương ứng.

## 3. Kiến trúc & luồng dữ liệu

```
Google Sheets (7 sheet)
      ↕  SpreadsheetApp
Code.gs.moi   ── doGet() → HtmlService → index.html (include js/CSS)
      ↕  google.script.run.<tênHàm>(args)
js.clean.html (state toàn cục trong bộ nhớ trang)
```

Frontend giữ toàn bộ dữ liệu trong biến toàn cục và render lại DOM bằng string
template — không có framework, không có build step. State chính:

`allProjects`, `allTasks`, `allStaff`, `allProposals`, `allApps`, `allAdminNames`,
`currentUser`, `isAuthenticated`, `currentSection`, `expandedProjects`,
`ganttStartDate` / `ganttEndDate` / `currentGanttDate`, `openedFromProjectDetails`.

Vòng đời: `handleLogin` → `authenticateUser` → `handleSuccessfulLogin(data)` nạp hết
state rồi gọi loạt `render*()`. Sau mỗi CRUD, code dùng **optimistic update**
(`addOptimisticUpdate` / `updateOptimisticUpdate` / `removeOptimisticUpdate`) để sửa
state ngay rồi mới đồng bộ lại bằng `refreshData()`.

Các màn hình (`switchSection(sectionName)`): `overview`, `projects`, `tasks`, `gantt`,
`staff`, `proposals`, `apps`, `user` — tương ứng `id="<tên>-section"` trong `index.html`.

## 4. Hợp đồng frontend ↔ backend

Frontend gọi **33 hàm server** qua `google.script.run`. Đây là ranh giới dễ vỡ nhất:
tên hàm nằm trong **chuỗi ký tự** nên không có công cụ nào cảnh báo khi bạn đổi tên
hoặc xoá hàm ở backend — chỉ đến lúc chạy mới báo "Script function not found".

Đọc dữ liệu: `authenticateUser`, `logout`, `getDataForUser`, `getInitialDataWithAuth`,
`getProjects`, `getTasks`, `getStaffList`, `getProposals`, `getChatMessages`.

Ghi dữ liệu: `add/update/deleteProjectWithAuth`, `add/update/deleteTaskWithAuth`,
`add/update/deleteStaffWithAuth`, `add/update/deleteProposalWithAuth`,
`addNotificationWithAuth`, `addApp`, `updateApp`, `deleteApp`,
`addTaskReminder`, `updateTaskReminder`, `deleteTaskReminder`,
`copyProjectWithAuth`, `copyTaskWithAuth`, `reorderTasks`, `sendChatMessage`,
`changePassword`.

Quy ước: mọi hàm hậu tố `WithAuth` là lớp vỏ kiểm quyền — nó gọi
`checkUserPermission(action, entityType)` rồi mới gọi hàm lõi cùng tên không hậu tố.
**Thêm chức năng ghi mới thì phải theo đúng cặp này**, đừng cho frontend gọi trực tiếp
hàm lõi.

Kiểm tra hợp đồng còn nguyên (chạy sau mỗi lần sửa backend):

```bash
node -e '
const fs=require("fs");
const gs=fs.readFileSync("Code.gs.moi","utf8"), js=fs.readFileSync("js.clean.html","utf8");
const def=new Set([...gs.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]));
const used=new Set();
for(const m of js.matchAll(/\)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) if(def.has(m[1])) used.add(m[1]);
for(const m of js.matchAll(/["\x27]([A-Za-z_$][\w$]*)["\x27]/g)) if(def.has(m[1])) used.add(m[1]);
console.log("frontend goi",used.size,"ham; thieu:",[...used].filter(n=>!def.has(n)).join(",")||"0");
'
```

## 5. Mô hình dữ liệu

7 sheet: `Dự án/Nhiệm vụ`, `Nhiệm vụ`, `Người dùng`, `Thông báo`, `Chat`, `Đề nghị`,
`Quản lý App`.

Tên cột là **chuỗi tiếng Việt trong header sheet**, được khai báo hai lần — một lần mỗi
phía — và **phải khớp nhau tuyệt đối**:

| Phía | Cách khai báo | Ví dụ |
|---|---|---|
| Backend `Code.gs.moi` | hằng rời | `TASK_DUE_DATE_COLUMN_NAME = "Hạn chót"` |
| Frontend `js.clean.html` | object `COL` (dòng 27) | `COL.T_DUE: "Hạn chót"` |

Tiền tố trong `COL`: `P_` dự án, `T_` nhiệm vụ, `S_` người dùng, `PR_` đề nghị,
`A_` app/activity. Tổng 55 khoá.

Đổi tên cột trong sheet ⇒ phải sửa **cả hai** chỗ. Backend đọc sheet bằng
`headers.indexOf(TÊN_CỘT)` nên sai tên là ra `-1` và ghi vào cột sai, âm thầm.

Một số nhiệm vụ có cột JSON lồng: `COL.T_REMINDERS` (mảng nhắc việc),
`COL.T_RESULT_LINKS` (danh sách link, xem `parseLinks` / `renderLinksButton`), và bảng
dự án lưu nhiệm vụ dạng JSON (`extractTasksFromProjectValues`, `formatJSONCompact`).

## 6. Bộ tool trong `tools/`

Cài một lần: `cd tools && npm install && cd ..`. Mọi lệnh chạy **từ thư mục gốc**.

| Script | Việc nó làm |
|---|---|
| `deobfuscate.js` | Dịch ngược bản obfuscate: giải string-array, inline decoder, bỏ hex/`![]`. |
| `rename.js` | Đổi `_0x...` thành tên có nghĩa, suy từ ngữ cảnh; nhận map tay qua `--map`. |
| `verify.js` | Chứng minh bản dịch giữ đủ mọi chuỗi + hàm của bản gốc. |
| `verify-license.js` | Chạy song song khối license bản gốc và bản dịch, so kết quả. |
| `cmp-gs.js` | So hai bản `.gs` ở mức ngữ nghĩa: hàm, số tham số, chuỗi, property, biến tự do. |
| `peek.js` | In các lần dùng một biến kèm ngữ cảnh ngắn — tra cứu mà không phải mở cả file. |
| `names.backend.json`, `names.frontend.json` | Map tên tay, khoá theo `tênHàm._0x...`, có scope `"*"` cho phạm vi ngoài hàm. |

Lệnh hay dùng:

```bash
# dịch lại từ bản gốc (nếu cần làm lại từ đầu)
node tools/deobfuscate.js Code.gs Code.clean.gs --license-rename
node tools/deobfuscate.js js.html js.clean.html

# đặt tên biến — LUÔN nhớ --map, thiếu nó là map tay không được áp dụng
node tools/rename.js Code.gs.moi   Code.gs.moi   --map tools/names.backend.json
node tools/rename.js js.clean.html js.clean.html --map tools/names.frontend.json

# xem biến nào chưa suy được tên
node tools/rename.js js.clean.html /dev/null --map tools/names.frontend.json --report

# kiểm chứng
node tools/verify.js js.html js.clean.html
node tools/verify.js Code.gs Code.clean.gs
node tools/verify-license.js Code.gs.moi
node tools/cmp-gs.js Code.clean.gs Code.gs.moi
node tools/peek.js js.clean.html tênBiến        # PEEK_MAX=5 PEEK_W=120 để nới ngữ cảnh
```

`rename.js` chỉ đổi **binding cục bộ** và tự chặn nếu tập identifier tự do thay đổi, nên
nó không bao giờ làm hỏng tên hàm, biến toàn cục, chuỗi hay tên property. Chạy lại nhiều
lần vô hại (idempotent).

Trạng thái hiện tại: `js.clean.html` và `Code.gs.moi` đều **0 biến `_0x`** (1408 và 966
biến đã đặt tên).

## 7. Khối license — đọc trước khi chạm vào

Đầu file `.gs` (khoảng 60 dòng đầu, trước `function _activateKey`) là khối bản quyền của
gsheets.vn: `xorDecode`, `cyrb53Hash`, `isValidLicenseKey`, `getLicenseState`. Cơ chế:
key = `cyrb53Hash(email + salt)`, lưu trong Script Property `_lk`.

Có **3 lớp anti-tamper** và chúng phụ thuộc vào *độ dài mã nguồn*:

1. `isValidLicenseKey.toString().length < 40` → false.
2. `_iwruum !== "7vv119ir"` → false.
3. `xorDecode(_qjii) !== _cr` → false.

Ngoài ra **75 hàm backend** mở đầu bằng cùng một guard:

```js
var licenseKey = getLicenseState();
if (!licenseKey || !isValidLicenseKey(licenseKey) || getLicenseState.toString().length < 80) return;
```

⚠️ **Hệ quả cho việc bảo trì**: đừng làm ngắn `getLicenseState` hay `isValidLicenseKey`
(gộp dòng, xoá comment, minify) — dưới ngưỡng 80 / 40 ký tự là *toàn bộ* backend im lặng
trả `undefined`, không báo lỗi gì. Sau mỗi lần sửa vùng này, chạy
`node tools/verify-license.js Code.gs.moi`.

Khác biệt duy nhất còn lại giữa `Code.gs.moi` và `Code.clean.gs` nằm đúng ở khối này:
`getLicenseState` trong `Code.gs.moi` đã bị sửa tay để **bỏ qua kích hoạt** — nó tự sinh
key từ email người dùng hiện tại khi `_lk` trống hoặc sai, thay vì trả `null`/`false`.
Vì vậy `verify-license.js Code.gs.moi` báo `FAIL 4/15`; 4 FAIL đó là hệ quả cố ý của bản
sửa, không phải lỗi mới. Đây là can thiệp vào bản quyền của bên thứ ba — hướng đúng đắn
là dùng key hợp lệ và giữ `getLicenseState` như trong `Code.clean.gs:26`.

Bản sửa tay đó còn bỏ dòng cache `if (_licenseCache !== undefined) return _licenseCache;`.
Vì có 75 chỗ gọi `getLicenseState()`, mỗi request sẽ gọi lại `PropertiesService` và
`Session.getEffectiveUser()` rất nhiều lần → chậm và tốn quota. Trả lại dòng cache đó là
việc nên làm.

## 8. Lỗi đã sửa (23/08/2026)

`Code.gs.moi` từng bị xoá mất 3 hàm + 5 hằng của tính năng thông báo, trong khi vẫn còn
2 chỗ gọi tới chúng. Đã phục hồi nguyên văn từ `Code.clean.gs`:

| Thứ được phục hồi | Ai gọi nó |
|---|---|
| `addNotificationWithAuth` | frontend `handleAdd("notification")` — nút `#add-notification-btn` (chỉ admin) |
| `addNotification` | `addNotificationWithAuth`, `createOverdueNotificationIfNeeded` |
| `createOverdueNotificationIfNeeded` | `checkAndNotifyOverdueTasks` (trigger hằng ngày) |
| `NOTIFICATION_ID/TIME/USER/CONTENT/TYPE_COLUMN_NAME` | 2 hàm trên |

Lỗi cũ khó phát hiện vì lời gọi treo nằm trong `try/catch` — không crash, chỉ âm thầm
không tạo thông báo nào. Sau khi sửa: `cmp-gs.js` xác nhận `Code.gs.moi` khớp
`Code.clean.gs` 83/83 hàm, 326/326 chuỗi, 22 identifier tự do (toàn bộ là API Apps
Script), **0 tham chiếu treo**.

## 9. Quy trình chuẩn khi sửa code

1. Sao lưu file sẽ sửa (`cp X X.bak`) — chưa có git trong dự án này.
2. Sửa.
3. Nếu sửa backend: `node tools/cmp-gs.js Code.clean.gs Code.gs.moi` để thấy **chính xác**
   mình đã thay đổi những gì (hàm nào, chuỗi nào, biến toàn cục nào).
4. Nếu chạm khối license: `node tools/verify-license.js Code.gs.moi`.
5. Kiểm hợp đồng frontend ↔ backend bằng đoạn script ở §4.
6. Nếu có thêm biến `_0x` mới (dán code từ bản gốc): chạy lại `rename.js` kèm `--map`.
7. Deploy và thử tay — Apps Script không có test tự động ở đây.

Việc **nên làm sớm**: `git init` rồi commit toàn bộ. Hiện tại mọi thứ dựa vào file `.bak`,
rất dễ mất bản đúng.

## 10. Bẫy cần biết

- **Không có build step.** Frontend là string template thuần; đổi tên một `id` trong
  `index.html` mà quên sửa `document.getElementById(...)` trong `js.clean.html` thì không
  ai báo. Nhiều chỗ dùng `?.` nên lỗi càng im lặng.
- **Handler gọi từ HTML string.** Có 16 chỗ kiểu `onclick=\"tênHàm(...)\"` nằm *trong
  chuỗi* (`closeModal`, `openEditReminderModal`, `handleDeleteReminder`,
  `openTaskModalFromProject`, `showProjectDetailsModal`, `toggleTaskReminders`,
  `handleAppRedirect`, `closeReminderModal`). Đổi tên các hàm này bằng find-replace thường
  sẽ bỏ sót chuỗi ⇒ vỡ khi bấm.
- **Hàm `include` bị khai báo 2 lần** trong backend (JS lấy bản sau). Vô hại nhưng nên gộp.
- **`getStatusClass` / `isTaskOverdue` so sánh chuỗi tiếng Việt không dấu hoa/thường**
  (`"hoàn thành"`, `"đang"`, `"chưa"`) bằng `.toLowerCase().includes(...)`. Sửa nhãn trạng
  thái trong sheet là phải soát lại các so sánh này.
- **Ngày tháng.** Có 3 hàm riêng: `parseDateString` (chuỗi → Date),
  `formatDateForDisplay` (hiển thị dd/MM/yyyy), `formatDateForInput` (cho `<input
  type=date>`). Backend có `parseDate` / `formatSheetDate` riêng. Đừng trộn.
- **Gantt.** `calculateGanttBarStyle(startDate, endDate, monthDate, daysInMonth)` cho chế
  độ tháng; `calculateGanttBarStyleRange(startDate, endDate, rangeStart, rangeEnd,
  totalDays)` cho chế độ khoảng ngày. Cả hai trả về chuỗi CSS `left/width`.
- **Optimistic update dùng id tạm** dạng `"TEMP_" + Date.now()`; nếu server trả lỗi thì
  `removeOptimisticUpdate(type, id)` phải được gọi, nếu không state lệch với sheet.
- **`LockService`** được dùng ở các hàm ghi (`addNotification`, `addTask`, …) với
  `waitLock(15000)`. Giữ nguyên pattern `try/finally + releaseLock()` khi viết hàm ghi mới.

## 11. Gợi ý việc tiếp theo

1. `git init` + commit (§9).
2. Trả lại dòng cache `_licenseCache` trong `getLicenseState` (§7) — thắng lớn về tốc độ.
3. Nút `#add-notification-btn` được `js.clean.html` lắng nghe nhưng **không tồn tại trong
   `index.html`** ⇒ tính năng tạo thông báo tay hiện không có đường vào UI. Hoặc thêm nút,
   hoặc bỏ listener cho sạch.
4. Tách `js.clean.html` (3369 dòng) thành nhiều file HTML nhỏ theo màn hình và nạp bằng
   `include()` — Apps Script đã có sẵn cơ chế này.
5. Gộp hằng tên cột về **một nguồn duy nhất**: backend sinh object `COL` rồi truyền xuống
   frontend, thay vì khai báo hai nơi (§5).





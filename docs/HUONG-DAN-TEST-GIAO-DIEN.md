# Hướng dẫn tự tay test giao diện (Phase 4)

Viết ngày 2026-08-25, cho nhánh `vps/phase-4-frontend`.

Mục đích: bạn mở trình duyệt, bấm bằng tay, tự thấy Phase 4 làm được gì. Mọi con số và câu
thông báo trong tài liệu này đều **đã chạy thật** qua đúng đường người dùng đi
(Nginx → `api-bridge.js` → `/api/rpc/*` → `/api/v1` → PostgreSQL), không phải phỏng đoán.

**Đọc mục 0 trước.** Phase 4 chỉ chuyển *cầu nối*, chưa chuyển *dữ liệu đầu trang*. Nếu không
biết điều đó thì mở trang lên sẽ tưởng hỏng.

---

## 0. Thứ tự bạn PHẢI biết trước khi bấm

Trang này nạp dữ liệu bằng 4 hàm cũ, và **cả 4 đều chưa chuyển sang máy chủ mới**:

| Hàm cũ | Trạng thái hôm nay | Ai làm |
|---|---|---|
| `getInitialDataWithAuth` | `501` khi đã đăng nhập · `200 {requireLogin:true}` khi chưa | việc **5.10** |
| `getDataForUser` | `501` | việc **5.10** |
| `getDepartmentContext` | `501` | việc **5.11** |
| `getStaffList` | `501` | việc **5.11** |

Hệ quả **bình thường, không phải lỗi**:

> Đăng nhập đúng mật khẩu ⇒ modal đăng nhập đóng lại ⇒ hiện toast đỏ
> **«Lỗi khi tải dữ liệu: Chức năng «Nạp dữ liệu người dùng» chưa được chuyển sang máy chủ mới.
> Vui lòng liên hệ quản trị.»** ⇒ các trang Tổng quan / Dự án / Nhiệm vụ **trống**.

Đó là kết quả **đúng** của Phase 4. Cái đang được test không phải "trang có dữ liệu không", mà là
"cầu nối gọi đúng hàm, gửi đúng CSRF, xử đúng lỗi, và chống được XSS không".

17/37 hàm đã chạy thật: `authenticateUser`, `logout`, `changePassword`, `getProjects`,
`addProjectWithAuth`, `updateProjectWithAuth`, `deleteProjectWithAuth`, `copyProjectWithAuth`,
`getTasks`, `addTaskWithAuth`, `updateTaskWithAuth`, `deleteTaskWithAuth`, `copyTaskWithAuth`,
`reorderTasks`, `addTaskReminder`, `updateTaskReminder`, `deleteTaskReminder`.
Xem danh sách sống bất cứ lúc nào: mở <http://127.0.0.1:8099/api/rpc>.

Vì 17 hàm đó **có** chạy nhưng giao diện chưa có đường nào gọi tới (vì không nạp được dữ liệu để
vẽ nút), mục 6–8 của hướng dẫn này dùng **Console của DevTools** để gọi thẳng. Đó không phải mẹo
lách: `google.script.run` là API thật mà chính các nút bấm dùng, chỉ khác là bạn gõ tay.

---

## 1. Dựng môi trường (khoảng 5 phút)

Mở **Git Bash** ở thư mục `e:/quanlycongviec`. Chạy từng khối, đừng dán cả 4 khối một lượt.

### 1.1 Cơ sở dữ liệu

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps    # cả 3 phải healthy/running
```

Cơ sở dữ liệu dùng để test tay là `quanlycongviec_uat` — **riêng**, không đụng dữ liệu dev.
Lần đầu thì tạo và nạp:

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d postgres -c 'CREATE DATABASE quanlycongviec_uat'
cd server && DATABASE_URL=postgres://qlcv:<mat-khau-trong-deploy/.env>@127.0.0.1:5432/quanlycongviec_uat npm run migrate:up
cd server && DATABASE_URL=postgres://qlcv:<mat-khau-trong-deploy/.env>@127.0.0.1:5432/quanlycongviec_uat npm run seed:dev
```

### 1.2 Máy chủ Node (để cửa sổ này chạy suốt buổi test)

```bash
cd server && DATABASE_URL=postgres://qlcv:<mat-khau>@127.0.0.1:5432/quanlycongviec_uat npm run dev
```

Kiểm ở cửa sổ khác: `curl http://127.0.0.1:3000/readyz` phải ra `{"ok":true,"db":"up"}`.

### 1.3 Nginx (đây là chỗ dễ sai nhất)

```bash
docker network create qlcv-uat
docker run -d --name app --network qlcv-uat alpine/socat \
  tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000

MSYS_NO_PATHCONV=1 docker run -d --name qlcv-uat-nginx --network qlcv-uat -p 127.0.0.1:8099:80 \
  -v "$PWD/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" \
  -v "$PWD/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
  -v "$PWD/web:/srv/web:ro" nginx:1.27-alpine
```

Hai chỗ **bắt buộc**, đã mất thời gian vì thiếu:

- `MSYS_NO_PATHCONV=1` — không có nó, Git Bash đổi `/etc/nginx/conf.d/app.conf` thành
  `C:/Program Files/Git/etc/nginx/conf.d/app.conf`, `app.conf` **không được nạp**, nginx chạy bằng
  `default.conf` của image. Triệu chứng đánh lừa: `/` vẫn `200` (trang Welcome), nhưng `/api/*` và
  `/assets/vendor/*` đều `404`.
- Đích của `web/` là **`/srv/web`**, đúng dòng `root` trong `deploy/nginx/app.conf`.

### 1.4 Ba lệnh xác nhận — cả ba phải đúng thì mới sang mục 2

```bash
MSYS_NO_PATHCONV=1 docker exec qlcv-uat-nginx ls /etc/nginx/conf.d/     # phải thấy app.conf
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8099/         # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8099/api/csrf # 200  ← không được 404
```

### 1.5 13 tài khoản mẫu

Mật khẩu **giống nhau** cho cả 13: `Test@12345`. Cả 13 đều **bị bắt đổi lần đầu**.

| Mã | Email | Vai trò | Phòng |
|---|---|---|---|
| TEST001 | `admin@test.local` | admin | — |
| TEST002 | `pgd1@test.local` | Phó Giám đốc | phụ trách phòng **1, 2** |
| TEST003 | `pgd2@test.local` | Phó Giám đốc | phụ trách phòng **3, 4** |
| TEST004 | `tp01@test.local` | Trưởng phòng | 1 — Quản lý Đào tạo |
| TEST005 | `pp01@test.local` | Phó phòng | 1 |
| TEST006 | `tp03@test.local` | Trưởng phòng | 3 — Kế toán |
| TEST007 | `qlcv@test.local` | Quản lý công việc | 1 |
| TEST008 | `nv01@test.local` | Nhân viên | 1 |
| TEST009 | `nv03@test.local` | Nhân viên | 3 |
| TEST010 | `nv00@test.local` | Nhân viên | — |
| TEST011 | `Nghien.Cuu@test.local` | Nhân viên | 2 |
| TEST012 | `ncc@test.local` | Nhân viên | — |
| TEST013 | `nv01b@test.local` | Nhân viên | 1 |

Dữ liệu seed: **9 công việc · 30 đầu việc** (13 cấp 2 + 17 cấp 3) · **7 nhắc việc** · 5 phòng.

Mở trình duyệt: **<http://127.0.0.1:8099/>**

---

## 2. Màn 1 — Chưa đăng nhập thì phải hiện modal đăng nhập, KHÔNG phải báo lỗi

**Làm:** mở <http://127.0.0.1:8099/> ở cửa sổ ẩn danh (để chắc chắn không còn cookie cũ).

**Phải thấy:** thoáng chữ «Đang kiểm tra đăng nhập…», rồi **modal đăng nhập** hiện lên và con trỏ
tự nhảy vào ô email.

**Không được thấy:** toast đỏ «Lỗi khi kiểm tra đăng nhập» hay «Lỗi kết nối».

**Vì sao đây là một phép kiểm thật:** `getInitialDataWithAuth` là hàm **chưa chuyển**. Nếu cầu nối
làm đơn giản (cứ chưa chuyển thì trả `501`), người dùng sẽ thấy màn hình lỗi ngay khi vào trang.
Cầu nối xử riêng trường hợp này: chưa có phiên ⇒ trả `{requireLogin:true}` với mã `200`, đúng
đường mà bản Apps Script cũ dùng để bật modal. Đã kiểm bằng curl:

```
POST /api/rpc/getInitialDataWithAuth (khách) → 200 {"ok":true,"data":{"requireLogin":true}}
```

---

## 3. Màn 2 — Sai mật khẩu

**Làm:** nhập `nv01@test.local` / `sai-mat-khau-bat-ky` → bấm Đăng nhập.

**Phải thấy:** modal **vẫn mở**, hiện dòng đỏ trong modal:
**«Email hoặc mật khẩu không đúng»**.

Ba điểm cần soi:

1. Câu thông báo **giống hệt** dù email có tồn tại hay không — thử `khong-co-ai@test.local`, vẫn
   đúng câu đó. Đây là cố ý: khác câu là để lộ danh sách email nội bộ.
2. Sai mật khẩu **không** làm văng ra toast «Lỗi kết nối» — nó là *câu trả lời*, không phải *sự cố*.
   Cầu nối có danh sách `errorAsData` cho đúng ba hàm (`authenticateUser`, `changePassword`, …).
3. Nhập email **VIẾT HOA** (`NV01@TEST.LOCAL`) với mật khẩu đúng thì **vào được**. Bản Apps Script
   cũ trượt ở chỗ này (UAT **A1**).

---

## 4. Màn 3 — Khoá tài khoản sau 5 lần sai

**Làm:** nhập sai mật khẩu tài khoản `nv01b@test.local` **5 lần liên tiếp**.

**Phải thấy:** lần 1–4 ra «Email hoặc mật khẩu không đúng»; **lần thứ 5** đổi câu thành:

> **«Tài khoản đang bị tạm khoá do đăng nhập sai nhiều lần. Thử lại sau 15 phút.»**

Từ đó nhập **đúng** mật khẩu cũng vẫn ra câu khoá — đó là điểm mấu chốt.

Đã kiểm bằng curl, đúng 6 lần liên tiếp: 4 lần `INVALID_CREDENTIALS`, lần 5 và 6 `ACCOUNT_LOCKED`.

**Mở khoá lại để test tiếp** (đừng ngồi đợi 15 phút):

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat \
  -c "UPDATE users SET failed_logins=0, locked_until=NULL WHERE code='TEST013';"
```

⚠️ Dùng `nv01b@test.local` (TEST013) để nghịch, đừng khoá `admin@test.local` — mục 6–8 cần nó.

---

## 5. Màn 4 — Bắt buộc đổi mật khẩu lần đầu

Đây là **việc 4.5**, tính năng mới hoàn toàn (bản cũ không có).

**Làm:** đăng nhập `admin@test.local` / `Test@12345`.

**Phải thấy, theo đúng thứ tự:**

1. Modal đăng nhập đóng.
2. Toast đỏ: «Lỗi khi tải dữ liệu: Chức năng **«Nạp dữ liệu người dùng»** chưa được chuyển sang máy
   chủ mới. Vui lòng liên hệ quản trị.» — đây là `getDataForUser` `501`, **đúng như mục 0 đã báo**.
3. Trang trống.

Modal đổi mật khẩu **chưa** bật ở bước này, và đó là hành vi đúng: hàm `pending()` ném lỗi ngay ở
tầng cầu nối, chưa đi tới `/api/v1` nên chưa gặp cổng chặn mật khẩu.

**Để bật cổng chặn, gọi một hàm ĐÃ chuyển.** Mở DevTools (F12) → tab **Console** → dán:

```js
google.script.run.getProjects();
```

**Phải thấy:**

- Toast đỏ **«Bạn phải đổi mật khẩu lần đầu trước khi dùng hệ thống»**.
- Modal **Đổi mật khẩu** hiện lên với **3 ô**: Mật khẩu hiện tại · Mật khẩu mới · Nhập lại.
- Modal này **không có dấu ×**, **không có nút Hủy** — cố ý: mật khẩu tạm còn hiệu lực thì tài
  khoản còn mở cho người đã cấp nó, nên không cho thoát.

**Bấm thử để kiểm 4 nhánh:**

| Nhập gì | Phải thấy |
|---|---|
| Bỏ trống «Mật khẩu hiện tại» | Báo lỗi ngay trong modal, không gọi máy chủ |
| Mật khẩu mới ≠ Nhập lại | Đỏ trong modal: hai ô không khớp |
| Mật khẩu hiện tại sai | Đỏ trong modal, modal **vẫn mở** |
| Đủ và đúng (`Test@12345` → `Adm@Moi12345` ×2) | Toast xanh «Đổi mật khẩu thành công», modal đóng |

**Điểm hay nhất nằm ở ngay sau đó:** lời gọi `getProjects()` bạn gõ lúc nãy bị chặn ở cổng đã được
cầu nối **giữ lại và chạy lại** ngay khi đổi xong — bạn sẽ thấy trong tab Network một request
`getProjects` thứ hai, lần này `200`. Không phải gõ lại.

Đã kiểm bằng curl: `changePassword` 3 tham số → `200 {"success":true,"revokedSessions":1}`; đăng
nhập lại bằng mật khẩu mới → `200`; `getProjects` sau đó → `200` kèm dữ liệu thật.

**Trả admin về mật khẩu seed khi test xong** (mục 10).

---

## 6. Màn 5 — Dữ liệu thật và cây công việc

### 6.1 Một bước bắt buộc trước đã: gán `currentUser`

Bình thường `handleSuccessfulLogin` làm việc này, nhưng nó nằm trong `getDataForUser` — hàm còn
`501`. Nên phải gán tay, **trước** khi vẽ bất cứ thứ gì. Bỏ qua bước này thì mọi hàm vẽ ném
`TypeError: Cannot read properties of null (reading 'name')` (đã kiểm bằng jsdom).

Dán **nguyên khối** này vào Console:

```js
currentUser = { code: 'TEST001', full_name: 'Quản trị Hệ thống', role: 'admin' };
currentUser.name = currentUser.full_name;   // ← xem 6.2, đừng bỏ dòng này
isAuthenticated = true;
updateUIForUser(currentUser);
```

**Phải thấy:** góc trên bên phải hiện tên **Quản trị Hệ thống**, vai **admin**, và avatar hai chữ
cái **QT**. Đã kiểm bằng jsdom trên chính `index.html` và `app.js` thật.

### 6.2 Vì sao phải có dòng `currentUser.name = currentUser.full_name`

Đây là một **lệch tên trường chưa ai ghi lại**, và nó sẽ nổ ở Phase 5 nếu không biết trước:

- Máy chủ mới trả `full_name` (kiểm bằng curl: `{"id":1,"code":"TEST001","full_name":"Quản trị Hệ thống",…}`).
- `app.js` đọc `currentUser.name` — **57 chỗ**, cộng 4 chỗ đọc `currentUser.role`.
- Bản Apps Script cũ trả `name`, nên `app.js` không sai; cầu nối chưa dịch trường này.

Kiểm chứng nhanh: gán `currentUser = {full_name:'A B', role:'admin'}` (không có `.name`) rồi gọi
`updateUIForUser(currentUser)` ⇒ `TypeError: Cannot read properties of undefined (reading 'split')`.

Việc **5.10** phải xử: hoặc cầu nối thêm `name`, hoặc `app.js` đổi sang `full_name` cả 57 chỗ.

### 6.3 Nạp dữ liệu thật

```js
google.script.run.withSuccessHandler(r => { allProjects = r; renderProjects(); console.table(r); })
  .getProjects();
```

**Phải thấy:** bảng 9 dòng in ra Console, **cột tên bằng tiếng Việt y hệt bản cũ**
(`Mã dự án`, `Tên dự án`, `Quản lý dự án`, …) — đây chính là điều cầu nối phải làm: máy chủ mới trả
`snake_case`, cầu nối dịch ngược về tên cột Google Sheet để `app.js` không phải sửa dòng nào.

Rồi bấm vào mục **Dự án** ở thanh bên: **9 thẻ dự án hiện ra thật**.

Nạp tiếp nhiệm vụ và vẽ 4 thẻ số ở đầu trang:

```js
google.script.run.withSuccessHandler(r => {
  allTasks = r; renderTasks(); renderStats(); renderTaskStats(); renderProjectStats();
  console.log('so nhiem vu:', r.length);
}).getTasks();
```

**Phải thấy:** `30` trong Console; bấm mục **Nhiệm vụ** ⇒ danh sách hiện ra; quay lại **Tổng quan**
⇒ 4 thẻ số **có số thật** (9 dự án / 30 nhiệm vụ …).

Lưu ý: các **biểu đồ** vẫn trống. `renderChart` cần `data.chartData` do `getDataForUser` cấp — việc
5.10. Đó là ⏳, không phải lỗi.

### Điểm đỏ C7 — bạn sẽ tự nhìn thấy nó ở đây

Trong seed có **13 đầu việc cấp 2** (công việc con) và **17 cấp 3** (nhiệm vụ). Nhưng biểu mẫu
`#task-form` **không có ô nào** tên `Cấp` hay `Mã cha`. Kiểm chứng: mở một dự án, bấm «Thêm nhiệm
vụ», soi hết biểu mẫu — không có. Nghĩa là **mọi đầu việc bạn tạo bằng giao diện hôm nay đều là
cấp 3 không cha**; cây 3 tầng chỉ tồn tại trong dữ liệu seed.

Đây là điểm đỏ **C7** của checklist khói §8.5. Bạn đã chốt cách xử ngày 2026-08-25 (§13.4 mục 14,
**phương án b**): thêm nút **«+ công việc con»** ngay trên cây, cấp suy ra từ chỗ bấm, biểu mẫu giữ
nguyên là tạo cấp 3. Việc **5.12** của Phase 5.

---

## 7. Màn 6 — Nhắc việc, và quyền mới của Phó Giám đốc

Quyền đặt nhắc việc vừa đổi ngày 2026-08-25 (§13.4 mục 15). Danh sách được đặt nhắc việc:

> **admin** (mọi phòng) · **Phó Giám đốc** phụ trách phòng đó · **Trưởng phòng** và **Phó phòng**
> của phòng đó.

`Quản lý công việc` **không** được, `Nhân viên` **không** tự nhắc việc của mình được.

Ba lần thử dưới đây, mỗi lần đăng nhập một tài khoản khác (nhớ đổi mật khẩu lần đầu trước), rồi dán
vào Console:

```js
google.script.run
  .withSuccessHandler(r => console.log('OK', r))
  .withFailureHandler(e => console.log('CHẶN:', e.message))
  .addTaskReminder('CV001-002', { date: '2026-09-30', content: 'Thử nhắc việc' });
```

`CV001-002` là nhiệm vụ cấp 3 thuộc **phòng 1**.

| Đăng nhập bằng | Kết quả phải ra | Vì sao |
|---|---|---|
| `pgd1@test.local` (phụ trách phòng 1, 2) | **OK** | quyền mới của mục 15 |
| `pgd2@test.local` (phụ trách phòng 3, 4) | **CHẶN: Nhiệm vụ này nằm ngoài phạm vi của bạn** | bị chặn ở **phạm vi**, không phải ở vai |
| `qlcv@test.local` (Quản lý công việc, phòng 1) | **CHẶN: Chỉ Admin, Phó Giám đốc phụ trách phòng, Trưởng phòng hoặc Phó phòng của phòng đó mới đặt được nhắc việc** | đúng phòng nhưng sai vai |

Hai câu chặn **khác nhau** là có chủ ý, và là chỗ đáng soi nhất: nó cho biết hệ thống chặn vì lý do
nào. Đã kiểm bằng curl với `pgd1`: vào `CV001-002` (phòng 1) → `200`; vào `CV004-018` (phòng 3) →
`403` «Nhiệm vụ này nằm ngoài phạm vi của bạn».

Thử thêm một điểm nữa — **chỉ cấp 3 mới đặt được nhắc việc**:

```js
google.script.run.withFailureHandler(e => console.log('CHẶN:', e.message))
  .addTaskReminder('CV001-001', { date: '2026-09-30', content: 'Vào cấp 2' });
```

`CV001-001` là **cấp 2**. Phải bị chặn — và quy tắc này nằm ở **trigger trong cơ sở dữ liệu**, không
phải ở JavaScript, nên không lách được bằng cách gọi thẳng API.

---

## 7b. Màn 6b — Phân công ba lớp (bổ sung 2026-08-26)

Tính năng mới: mỗi công việc / công việc con có thêm **Ban lãnh đạo kiểm soát** (1 người — admin
hoặc Phó Giám đốc phụ trách phòng) và **Lãnh đạo phòng phụ trách** (nhiều người — Trưởng/Phó phòng
của phòng đó). Nhiệm vụ chỉ có **Cán bộ làm trực tiếp** (= ô Người thực hiện đổi tên) + chọn
**MỘT** lãnh đạo phòng phụ trách, nguồn do máy chủ ép. Đăng nhập `admin@test.local` /
`Test@12345` để có quyền đủ rộng.

### 7b.1 Tạo công việc mới — ba ô mới trong modal

Bấm «+ Công việc» (nút tạo công việc), nhìn vào modal:

1. Ô **Phòng**: phải thấy lựa chọn đầu tiên là **«-- Công việc chung --**». Chọn một phòng cụ thể.
2. Ô **Ban lãnh đạo kiểm soát**: danh sách tự nạp = Phó GĐ phụ trách phòng đó + admin; **được điền
   sẵn Phó GĐ phụ trách phòng** ngay khi chọn phòng (không bấm gì thêm).
3. Quay lại chọn «-- Công việc chung --»: danh sách đổi thành **mọi Phó GĐ + admin**, phần Lãnh đạo
   phòng phụ trách báo *không có ai*.
4. Ô **Lãnh đạo phòng phụ trách**: các ô tick Trưởng/Phó phòng của phòng đã chọn. Tick 2 người,
   bấm «Tạo công việc».
5. Mở lại công việc đó (Chỉnh sửa): hai ô phải hiện đúng giá trị vừa lưu. Bấm «Lưu» không đổi gì ⇒
   không mất phân công.

Thử dữ liệu sai qua Console (sẽ bị máy chủ chặn 400, giao diện hiện toast lỗi):

```js
google.script.run.withSuccessHandler(r => console.log('OK', r))
  .withFailureHandler(e => console.log('CHẶN:', e.message))
  .addProjectWithAuth({ name: 'Thử sai nguồn', departmentId: <id phòng 1>, supervisorId: <id trưởng phòng> });
// CHẶN: Ban lãnh đạo kiểm soát phải là admin hoặc Phó Giám đốc
```

### 7b.2 Công việc con — kế thừa cha nhưng được chọn lại

Bấm «+ công việc con» trên cây của công việc vừa tạo:

1. Hai ô phân công phải **được điền sẵn đúng giá trị của công việc cha** (Ban kiểm soát = cùng
   người; các ô tick lãnh đạo phòng trùng cha).
2. Bỏ tick bớt / tick người khác rồi lưu ⇒ được, **không bị ép** trùng với cha.
3. Mở lại xác nhận danh sách đã lưu đúng.

### 7b.3 Nhiệm vụ — chỉ hai ô, nguồn bị máy chủ ép

Bấm «+ Thêm nhiệm vụ» trên công việc con vừa tạo (hoặc «Thêm nhiệm vụ» của công việc):

1. Modal nhiệm vụ **KHÔNG có** ô Ban lãnh đạo kiểm soát (ô này chỉ hiện khi đang tạo công việc con).
2. Ô **Cán bộ làm trực tiếp** chính là ô Người thực hiện cũ — chỉ đổi tên hiển thị.
3. Ô **Lãnh đạo phòng phụ trách**: danh sách = đúng những người lãnh đạo phòng của công việc con
   chứa nó. Chọn một người trong đó ⇒ lưu OK.
4. Thử chọn leader ngoài danh sách bằng Console (thay `<mã CV con>` và `<id>` thật):

```js
google.script.run.withSuccessHandler(r => console.log('OK', r))
  .withFailureHandler(e => console.log('CHẶN:', e.code, e.message))
  .addTaskWithAuth({ name: 'Thử leader lạ', level: 3, projectId: '<mã CV con>',
                     assignee: 'Nguyễn Văn A', leaderIds: '<id người ngoài danh sách>' });
// CHẶN: LEADER_NOT_IN_SOURCE — Lãnh đạo phòng phụ trách của nhiệm vụ phải là một trong các
//       lãnh đạo phòng phụ trách của công việc con chứa nó
```

5. Nhiệm vụ nằm **trực dưới công việc cha** (không qua CV con): danh sách leader đổi sang các Phó
   GĐ phụ trách phòng; chọn Trưởng phòng thường ⇒ máy chủ chặn `LEADER_NOT_IN_SOURCE`.

### 7b.4 Modal chi tiết công việc — rộng gấp đôi, đầy đủ phân công

Bấm vào **tên công việc** (hoặc nút xem chi tiết) trên bảng/danh sách:

1. Modal phải rộng ~1500px (gần full màn hình) thay vì bé 600px như trước.
2. Hàng **Phân công** hiện đủ: Phòng · **Ban giám đốc kiểm soát** · **Phụ trách chung** (lãnh đạo
   phòng của công việc to) · Quản lý công việc · Trạng thái · Thời gian · Số công việc con ·
   Tiến độ chung.
3. Khối **Cán bộ được giao (n)**: gom người từ cả công việc con lẫn nhiệm vụ, không trùng tên.
4. Khối **Cây công việc**: mỗi **công việc con** là một khối xanh có tiêu đề + hàng Ban lãnh đạo
   kiểm soát / Lãnh đạo phòng phụ trách / Cán bộ làm trực tiếp riêng; **bấm vào tiêu đề khối** thì
   xòe/collapse danh sách nhiệm vụ bên trong. Nhiệm vụ render kiểu thẻ trắng khác hẳn khối xanh —
   hai cấp không bao giờ lẫn kiểu.
5. Đổi mật khẩu tài khoản khói nếu bộ khói §8.5 đã chạy trước đó (Đ3 đổi sang `MatKhauMoi@123`).

---

## 8. Màn 7 — XSS (rủi ro lớn nhất của Phase 4)

Việc 4.6 đã soát **53 chỗ** ghép chuỗi HTML trong `app.js`. Đây là cách bạn tự kiểm.

### 8.1 Tên chứa thẻ HTML

Đăng nhập admin (đã đổi mật khẩu và **đã gán `currentUser` theo mục 6.1**), dán vào Console:

```js
google.script.run.withSuccessHandler(r => console.log(r)).addProjectWithAuth({
  'Tên dự án': '<img src=x onerror=alert(1)>',
  'Mô tả dự án': "Thử XSS <script>alert(2)</script> và dấu nháy ' \" ",
  'Quản lý dự án': 'Quản lý Công việc',
  'Ngày bắt đầu': '2026-09-01',
  'Ngày kết thúc': '2026-09-30',
  'Trạng thái dự án': 'Chưa bắt đầu'
});
```

Rồi nạp lại và vẽ:

```js
google.script.run.withSuccessHandler(r => { allProjects = r; renderProjects(); }).getProjects();
```

**Phải thấy:** thẻ dự án mới, tiêu đề hiện **nguyên văn chữ** `<img src=x onerror=alert(1)>`.

**Không được thấy:** hộp `alert`, hoặc một ô ảnh vỡ (ảnh vỡ = thẻ `<img>` đã được trình duyệt hiểu
là HTML ⇒ đã thủng).

Kiểm thêm ở cơ sở dữ liệu là chuỗi **lưu nguyên vẹn**, không bị máy chủ cắt xén (chống XSS đúng chỗ
là lúc **hiển thị**, không phải lúc lưu):

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat \
  -c "SELECT code, name FROM works ORDER BY id DESC LIMIT 1;"
```

Đã chạy thật, cột `name` ra đúng `<img src=x onerror=alert(1)>`.

### 8.2 `javascript:` trong ô «Link kết quả»

Sửa một nhiệm vụ, điền ô **Link kết quả** ba dòng:

```
https://vd.local/bao-cao.pdf
javascript:alert(document.cookie)
[Ảnh] https://vd.local/anh.png
```

**Phải thấy:** dòng 1 và 3 thành link bấm được; dòng 2 **không** thành link (hoặc `href` rỗng).
Bấm vào nó không được chạy gì. Bộ lọc chỉ cho qua `http:`, `https:`, `mailto:` và đường dẫn tương
đối; nó cũng bỏ ký tự điều khiển trước khi so, nên `java\nscript:` cũng không lọt.

### 8.3 Dọn

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat \
  -c "SELECT code, name FROM works WHERE code NOT IN (SELECT code FROM works ORDER BY id LIMIT 9);"
```

rồi xoá dòng thừa bằng `deleteProjectWithAuth` trên Console (an toàn hơn xoá tay bằng SQL vì nó xoá
cả cây con):

```js
google.script.run.withSuccessHandler(r => console.log(r)).deleteProjectWithAuth('CV0xx');
```

---

## 9. Màn 8 — Soi bằng DevTools (4 điểm, mỗi điểm 30 giây)

Mở F12, tab **Network**, lọc `Fetch/XHR`.

| Soi gì | Phải thấy | Ý nghĩa |
|---|---|---|
| **Header của mọi POST** | Có `X-CSRF-Token: …` | Thiếu là `403 CSRF_INVALID`. Đã kiểm: POST không kèm header → `403`, đúng **TC-SEC-04** |
| **Cookie phiên** — tab Application → Cookies | `qlcv_sid` có cột **HttpOnly** ✓, `SameSite=Lax` | **TC-SEC-05** |
| Gõ `document.cookie` vào Console | Chỉ thấy `qlcv_sid_csrf=…`, **không** thấy `qlcv_sid` | Kịch bản độc đọc được cookie phiên là chiếm được tài khoản. `qlcv_sid_csrf` đọc được là **cố ý** — mẫu double-submit cần thế |
| Tải lại trang, xem cột **Size** của `assets/vendor/*` | `Cache-Control: public, max-age=2592000` cho vendor; `no-store, must-revalidate` cho `index.html` | Thư viện bên thứ ba cache 30 ngày, trang chính không cache — sửa là thấy ngay. Cả hai đã kiểm bằng `curl -I` |

Thêm một điểm: bấm nút **Đăng xuất**, rồi gõ `google.script.run.getProjects()`.
**Phải thấy:** modal đăng nhập **tự bật lại** (không phải toast lỗi). Đăng nhập lại xong, lời gọi
`getProjects` bị trượt sẽ **tự chạy lại** — cùng cơ chế hàng chờ như ở mục 5.

Còn một điểm bảo vệ nữa mà bạn không kích hoạt được bằng tay nhưng nên biết: nếu đăng nhập lại bằng
**tài khoản khác**, lời gọi đang chờ **bị bỏ** kèm câu «…thao tác của phiên trước bị bỏ để không ghi
nhầm người thực hiện» — chứ không chạy tiếp dưới danh nghĩa người mới.

---

## 10. Dọn dẹp sau buổi test

**Trả cơ sở dữ liệu về đúng trạng thái seed** (quan trọng: mục 5 đã đổi mật khẩu, mục 8 đã thêm dòng):

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c "
  UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE code='TEST003'),
                   must_change_password = true, failed_logins = 0, locked_until = NULL;
  DELETE FROM sessions;
"
```

(Câu trên chép lại băm mật khẩu seed từ một tài khoản chưa bị đổi sang mọi tài khoản — nhanh và
không cần biết mật khẩu gốc. Nếu bạn đã đổi mật khẩu **TEST003** thì đổi `TEST003` thành một mã còn
nguyên.)

Kiểm lại phải khớp seed:

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -At -c "
  SELECT 'works='||(SELECT count(*) FROM works)
      ||' items='||(SELECT count(*) FROM work_items)
      ||' reminders='||(SELECT count(*) FROM reminders)
      ||' mcp_false='||(SELECT count(*) FROM users WHERE must_change_password=false);"
# phải ra: works=9 items=30 reminders=7 mcp_false=0
```

**Tắt stack:**

```bash
docker rm -f qlcv-uat-nginx app && docker network rm qlcv-uat
# rồi Ctrl+C ở cửa sổ đang chạy `npm run dev`
```

Muốn làm lại từ đầu hoàn toàn: xoá và nạp lại cơ sở dữ liệu khói.

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d postgres -c 'DROP DATABASE quanlycongviec_uat'
```

---

## 11. Bảng tổng kết — cái gì test được hôm nay, cái gì không

| Màn | Test được? | Ghi chú |
|---|---|---|
| Hiện modal đăng nhập khi chưa có phiên | ✅ | mục 2 |
| Sai mật khẩu, không lộ email tồn tại | ✅ | mục 3 |
| Email viết hoa vẫn vào được | ✅ | mục 3 — bản cũ trượt |
| Khoá sau 5 lần sai, 15 phút | ✅ | mục 4 |
| Bắt buộc đổi mật khẩu lần đầu + chạy lại lời gọi bị chặn | ✅ | mục 5 — mới hoàn toàn |
| Đăng xuất / hết phiên bật lại modal | ✅ | mục 9 |
| CSRF, cookie HttpOnly, header cache | ✅ | mục 9 |
| Danh sách 9 dự án / 30 nhiệm vụ, tên cột tiếng Việt | ✅ | mục 6 — **phải gán `currentUser` rồi gọi qua Console** |
| 4 thẻ số ở Tổng quan | ✅ | mục 6.3 — sau khi đã nạp bằng Console |
| Thêm/sửa/xoá/nhân bản dự án và nhiệm vụ | ✅ | qua Console, hoặc qua nút sau khi đã nạp dữ liệu bằng Console |
| Nhắc việc: thêm/sửa/xoá + quyền 4 vai | ✅ | mục 7 |
| Chống XSS ở tên, mô tả, link | ✅ | mục 8 |
| **Tạo công việc con (cấp 2) bằng biểu mẫu** | ❌ **điểm đỏ C7** | biểu mẫu không có ô `Cấp`/`Mã cha` ⇒ mọi dòng tạo ra là cấp 3 không cha. Việc **5.12** |
| Trang Tổng quan: 6 biểu đồ, hoạt động gần đây | ⏳ | cần `chartData`/`recentActivities` của `getDataForUser` — việc **5.10** |
| Đăng nhập xong tự có dữ liệu, không phải gõ Console | ⏳ | `getDataForUser` + `getInitialDataWithAuth` còn `501` — việc **5.10** |
| `currentUser.name` vs `full_name` | ⚠️ **lệch tên trường** | máy chủ trả `full_name`, `app.js` đọc `.name` (57 chỗ). Phải xử ở việc **5.10** — xem mục 6.2 |
| Trang Cấu hình phòng, danh sách nhân sự | ⏳ | `getDepartmentContext` + `getStaffList` còn `501` — việc **5.11** |
| Luồng duyệt (Chờ duyệt / Đã duyệt) | ⏳ **điểm đỏ D1** | `works.approval_status` mặc định `'Đã duyệt'`, chưa chỗ nào đặt «Chờ duyệt» — việc **5.1/5.2** |
| Đề nghị, Chat nội bộ, Quản lý App, Thông báo | ⏳ | 20 hàm còn `pending()` |

Tổng: **17/37** hàm đã chạy thật. Danh sách sống: <http://127.0.0.1:8099/api/rpc>.

Muốn chạy toàn bộ 60 điểm khói §8.5 bằng máy thay vì bằng tay:

```bash
bash tools/smoke-8.5.sh    # in mã HTTP từng điểm, tự dọn dòng nó tạo
```

---

## 12. Gặp trục trặc

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| `/` ra 200 nhưng `/api/csrf` ra **404** | Thiếu `MSYS_NO_PATHCONV=1` ⇒ `app.conf` không được nạp, nginx dùng `default.conf` | dựng lại container theo mục 1.3, rồi chạy 3 lệnh xác nhận ở 1.4 |
| Trang hiện «Welcome to nginx» | như trên | như trên |
| Mọi lời gọi ra **502** | container tên `app` chưa chạy, hoặc `npm run dev` đã tắt | `docker ps` phải thấy `app`; `curl http://127.0.0.1:3000/readyz` phải `ok` |
| Sửa `app.js` mà trình duyệt vẫn chạy bản cũ | `?v=20260825` trong `index.html` chưa tăng, tài sản cache 30 ngày | tăng số `?v=` (đến Phase 8 mới có băm tên tệp tự động) |
| Đăng nhập ra `429` | chạm giới hạn 300 request / 15 phút | đợi, hoặc khởi động lại `npm run dev` |
| Tiếng Việt trong `curl -d '…'` thành `?` hoặc `�` | Git Bash làm hỏng tiếng Việt truyền qua tham số dòng lệnh | mọi thân JSON và câu SQL đi qua **stdin**: `--data-binary @-`, `docker exec -i … psql` |
| Console ném `Cannot read properties of null (reading 'name')` | chưa gán `currentUser` | làm mục **6.1** trước |
| Console ném `Cannot read properties of undefined (reading 'split')` | đã gán `currentUser` nhưng thiếu `.name` | thêm dòng `currentUser.name = currentUser.full_name` — mục **6.2** |

---

## 13. Đọc tiếp

- Kết quả 60 điểm khói + 2 điểm đỏ: [docs/UAT.md](UAT.md) mục «Checklist khói §8.5»
- Lệnh môi trường, bẫy riêng của máy này: [docs/BAT-DAU-SESSION.md](BAT-DAU-SESSION.md) mục 4 và 5
- Danh sách 37 tên hàm và bảng phép thử bảo mật: `KE-HOACH-VPS.md` §5.1 và §8.7
- Bẫy đã biết, đừng phát hiện lại: `KE-HOACH-VPS.md` §13.5

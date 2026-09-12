# Hướng dẫn tự tay test giao diện (Phase 4)

Viết ngày 2026-08-25, cho nhánh `vps/phase-4-frontend`.
Bổ sung **mục 1.0** (script `chay-test.bat`) và **mục 9b** (kết quả nhiệm vụ là file, ONLYOFFICE,
trang «Hàng chờ phê duyệt») ngày **2026-09-02**, thêm **mục 9b.6** (8 việc: phân công của Trưởng
phòng, cập nhật tại chỗ, siết lãnh đạo phụ trách, bảng cây hàng chờ, nộp bản mới, thanh tải lên,
giao diện công việc cha) và **mục 9b.7** (3 lỗi: «Tải lên thất bại: máy chủ từ chối», Giám đốc/Phó
Giám đốc không thấy mục «Hàng chờ phê duyệt», hàng chờ trống) ngày **2026-09-03** — tất cả trên
nhánh `vps/ket-qua-file`. Bổ sung **mục 9b.8** (đợt 1: bảng 8 cột), **9b.9** (icon + menu ⋯ +
badge) và **9b.10** (đợt 2: khai kết quả trước + «Báo cáo» + form tạo hiện bảng) ngày
**2026-09-04** trên nhánh `vps/ket-qua-thiet-ke-lai`. Bổ sung **mục 9b.11** (5 việc bạn báo qua
ảnh: chi tiết hàng chờ có dữ liệu thật, tạo tiếp công việc con/nhiệm vụ ngay, chân form «Lưu tạm»/
«Gửi đi duyệt», dòng khai kết quả thẳng hàng, menu ⋯ nổi trên modal) và **mục 9b.12** (CHUÔNG THÔNG
BÁO — badge trên thanh tiêu đề, bấm dòng mở đúng việc) ngày **2026-09-06**.

Mục đích: bạn mở trình duyệt, bấm bằng tay, tự thấy Phase 4 làm được gì. Mọi con số và câu
thông báo trong tài liệu này đều **đã chạy thật** qua đúng đường người dùng đi
(Nginx → `api-bridge.js` → `/api/rpc/*` → `/api/v1` → PostgreSQL), không phải phỏng đoán.

**Đọc mục 0 trước.** Phase 4 chỉ chuyển *cầu nối*, chưa chuyển *dữ liệu đầu trang*. Nếu không
biết điều đó thì mở trang lên sẽ tưởng hỏng.

**Muốn test luôn phần mới nhất** (nộp file kết quả, sửa trực tuyến, hàng chờ phê duyệt) thì đi
đường ngắn: **1.0 → chọn 4 → mục 9b**. Phần đó độc lập với mục 2→9 và **không** cần gõ Console.

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

### 1.0 Cách nhanh — một lệnh, có tự kiểm

Từ **2026-09-02** có sẵn script dựng cả stack rồi tự kiểm 8 điểm. Bấm đúp `chay-test.bat` trong
Explorer, hoặc gõ tên nó trong `cmd`:

```
chay-test.bat
```

Nó hỏi bạn chọn bộ dữ liệu:

| Chọn | Làm gì | Dùng khi |
|---|---|---|
| **1** | giữ nguyên dữ liệu đang có | quay lại buổi test đang dở |
| **2** | seed **bộ cũ** §8.3 — 13 tài khoản `TEST001..TEST013` | test mục 2 → 9 của tài liệu này |
| **3** | `DROP DATABASE` rồi tạo lại (+ seed bộ cũ) | dữ liệu rối quá, muốn về mốc 0 |
| **4** | seed **bộ Vòng 14** — 7 tài khoản `gd/pgd/tp/pp/nv1/nv2/nvb@test.local`, 5 nhiệm vụ đủ 5 trạng thái file | test **mục 14** (kết quả nhiệm vụ là file) |

**Hai bộ seed loại trừ nhau.** Bộ nào chạy sau thì xoá bộ trước — chọn 4 là mất `TEST001..TEST013`,
chọn 2 là mất `gd@/tp@/nv1@`. Không có cách nào giữ cả hai cùng lúc, vì cả hai đều `TRUNCATE`
bảng `users`.

Chạy từ Git Bash hoặc terminal VS Code thì **không bấm chọn được** (không có console thật), phải
đưa sẵn chế độ bằng cờ, thêm `/f` để không dừng ở chỗ nào:

```
chay-test.bat /giu /f      chay-test.bat /seed /f
chay-test.bat /v14 /f      chay-test.bat /reset /f
```

Bước `[7/7]` in ra 8 dòng tự kiểm; **cả 8 phải xanh** thì mới bấm tay:

```
  Ban app.js = 20260902-1  (index.html khop).            <- lệch thì trình duyệt chạy bản cũ
  Migration moi nhat tren quanlycongviec_uat: 015_file_sua_truc_tuyen
  8099 /healthz OK.
  May chu dang noi quanlycongviec_uat (1 phien) - dung CSDL test.
  Nginx dang phuc vu app.js 20260902-1.
  ONLYOFFICE: BAT  url=http://localhost
    DS goi nguoc ve app qua: http://host.docker.internal:3000
    Document Server song (/healthcheck OK).
  Ket qua file: 6 ban trong CSDL; ban DANG CHO XU: 1 co file that, 5 thieu file.
```

Ba dòng đáng để ý:

- **`May chu dang noi ... KHAC`** — đây là bẫy tốn thời gian nhất. `/readyz` chỉ nói «db up», không
  nói *cơ sở dữ liệu nào*, nên script đếm phiên trong `pg_stat_activity`. Bằng 0 nghĩa là máy chủ
  đang nối cơ sở dữ liệu **dev**, bạn sẽ đăng nhập trượt `401` với mật khẩu đúng vì tài khoản mẫu
  nằm ở cơ sở dữ liệu khác. Sửa: đóng cửa sổ «QLCV TEST - Node» rồi `chay-test.bat /giu /f`.
- **`ONLYOFFICE: TAT`** — thiếu `ONLYOFFICE_URL` hoặc `ONLYOFFICE_JWT_SECRET` trong `deploy/.env`
  thì nút sửa trực tuyến **biến mất lặng lẽ**, không có lỗi nào. Đừng đi tìm lỗi ở chỗ khác.
- **`ban DANG CHO XU: 0 co file that`** — seed chỉ tạo *dòng cơ sở dữ liệu*, không tạo file trên
  đĩa. Bấm sửa trực tuyến vào bản của seed thì editor báo không tải được file: **đúng thiết kế**.
  Muốn thử thật thì tự nộp một file `.docx` (mục 14.1).

Muốn tự dựng từng bước bằng tay thì đọc tiếp 1.1 → 1.4.

### 1.1 Cơ sở dữ liệu

Mở **Git Bash** ở thư mục `e:/quanlycongviec`. Chạy từng khối, đừng dán cả 4 khối một lượt.

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

## 9b. Màn 9 — Kết quả nhiệm vụ là FILE (Vòng 14, bổ sung 2026-09-02)

Mục này test luồng mới nhất: cán bộ nộp file kết quả, lãnh đạo phòng xem/sửa/duyệt, sửa trực tuyến
bằng ONLYOFFICE. **Cần bộ seed Vòng 14** — chạy `chay-test.bat` chọn **4** (hoặc `chay-test.bat /v14 /f`).

### 9b.0 Bảy tài khoản và năm nhiệm vụ mẫu

Mật khẩu cả bảy: `Test@12345`. Bộ này **KHÔNG bắt đổi mật khẩu lần đầu** (khác bộ cũ) để bạn đăng
nhập là vào việc ngay.

| Email | Vai | Phòng | Dùng để thử |
|---|---|---|---|
| `gd@test.local` | Giám đốc (admin) | — | thấy tất cả |
| `pgd@test.local` | Phó Giám đốc | phụ trách **PH01 + PH02** | nhận việc «Trình lãnh đạo», là cấp chốt cuối |
| `tp@test.local` | Trưởng phòng | PH01 | xem/góp ý/yêu cầu sửa/trình/hoàn thành |
| `pp@test.local` | Phó phòng | PH01 | quyền **y như** Trưởng phòng |
| `nv1@test.local` | Cán bộ | PH01 | chủ 5 nhiệm vụ mẫu — **người nộp file** |
| `nv2@test.local` | Cán bộ | PH01 | cùng phòng nhưng không được giao ⇒ không nộp được |
| `nvb@test.local` | Cán bộ | PH02 | **ngoài phòng** — mọi đường file phải `403` |

Năm nhiệm vụ nằm trong `CV001` → `CV001-001`, mỗi cái đứng ở một trạng thái khác nhau để bạn thấy
đủ năm màu badge mà không phải tự dựng:

| Nhiệm vụ | Trạng thái nhóm file | Ý nghĩa |
|---|---|---|
| **NV-01** Báo cáo kết quả đào tạo quý 3 | *chưa có file* | chỗ bấm «Tải file lên» để chạy luồng đầy đủ |
| **NV-02** Biên bản họp hội đồng đào tạo | `cho-xem` | cán bộ vừa nộp bản 1, chờ TP/PP xem |
| **NV-03** Kế hoạch đào tạo năm 2027 | `can-sua` | TP đã yêu cầu sửa, có ý kiến; cán bộ đã nộp lại bản 2 |
| **NV-04** Đề án nâng cao chất lượng | `cho-lanh-dao` | TP tự sửa bản 2 rồi trình Phó Giám đốc |
| **NV-05** Quy chế thi sát hạch nội bộ | `da-duyet` | PGĐ đã duyệt — **khoá**, chỉ xem |

> **Quan trọng:** seed chỉ tạo *dòng trong cơ sở dữ liệu*, **không** tạo file trên đĩa cho NV-02..05.
> Tải về hoặc bấm sửa trực tuyến trên các bản của seed thì báo không đọc được file — **đúng thiết kế**,
> không phải lỗi mới. Muốn chạy thật thì tự nộp file ở **NV-01** (mục 9b.1). Dòng `[7/7]` của
> `chay-test.bat` đã nói trước cho bạn: `ban DANG CHO XU: 0 co file that, 5 thieu file`.

### 9b.1 Nộp file — và soi ngay hai lỗi đã sửa hôm nay

Đăng nhập `nv1@test.local`. Vào **Quản lý nhiệm vụ**, mở **NV-01**, kéo xuống khối «Kết quả».

1. Chuẩn bị một file `.docx` **có tên tiếng Việt đủ dấu**, ví dụ `BÀI 2.docx`. Bấm «Tải file lên».
2. **Tên file phải hiện đúng dấu** — `BÀI 2.docx`, không phải `BÃ€I 2.docx`. Đây là lỗi đã sửa:
   trình duyệt gửi tên dạng UTF-8 trong multipart, còn busboy (nhân của multer) giải bằng latin1;
   multer 2.x không có tuỳ chọn bảng mã nên phải gỡ ngược tên ở tầng dịch vụ.
3. Trạng thái nhóm chuyển **«Chờ xem»**, badge xanh nhạt.

Kiểm bằng cơ sở dữ liệu cho chắc (tên gốc nằm ở `ten_goc`, tên trên đĩa là `ten_luu` đã bỏ dấu):

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c \
  "SELECT version_no, ten_goc, ten_luu FROM task_file_versions ORDER BY id DESC LIMIT 3;"
```

Giới hạn để thử chỗ chặn (đổi 2026-09-03 — người dùng chốt mở thêm PowerPoint, Excel và ảnh):
nhận **12 đuôi** `.doc` `.docx` `.pdf` · `.xls` `.xlsx` · `.ppt` `.pptx` · `.jpg` `.jpeg` `.png`
`.gif` `.webp`, tối đa **50 MB** (trước là `.doc/.docx/.pdf`, 20 MB). Nộp `.exe`, `.zip` hoặc file
quá cỡ ⇒ báo lỗi bằng câu tiếng Việt, không phải `500`.

**`.svg` bị chặn CÓ Ý** dù nó cũng là ảnh: SVG chạy được `<script>` nên mở trên trình duyệt là lỗ
XSS. Thử nộp `hinh.svg` phải nhận câu «Chỉ nhận file …» — nếu một ngày nào đó nó qua được thì đó là
lỗi bảo mật, báo ngay.

Ba điểm nên xem bằng mắt sau khi mở thêm định dạng:

1. **Ảnh có nút 👁 xem** như PDF — bấm là ảnh mở tab mới ngay trong trình duyệt. Excel/PowerPoint
   **không** có nút đó, chỉ có ⬇ tải về (trình duyệt không hiển thị được file Office).
2. **Nút ✎ sửa trực tuyến** hiện ở Word/PDF/Excel/PowerPoint (ONLYOFFICE có bộ soạn thảo cho cả
   bốn: Excel mở dạng bảng tính, PowerPoint mở dạng trình chiếu), nhưng **KHÔNG hiện ở ảnh**.
3. **Tên file có dấu tiếng Việt** vẫn đúng — thử nộp một ảnh tên `ảnh chụp hiện trường.jpg`, tên
   phải giữ nguyên cả dấu cả khoảng trắng ở khối «Kết quả» và trên tiêu đề tab sửa trực tuyến.

### 9b.2 Lãnh đạo phòng phụ trách là người xem/sửa/duyệt

Đây là logic người dùng chốt hôm nay: **có file lên thì lãnh đạo phòng phụ trách của nhiệm vụ đó**
là người xem/sửa/duyệt, và **nhận thông báo**.

1. Vẫn đang ở `nv1@`: sau khi nộp, mở cơ sở dữ liệu xem thông báo vừa sinh:

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c \
  "SELECT u.email, n.content FROM notifications n JOIN users u ON u.id = n.user_id
    ORDER BY n.id DESC LIMIT 4;"
```

Phải thấy **cả `tp@test.local` và `pp@test.local`** — Trưởng phòng *và* Phó phòng. Trước bản sửa hôm
nay danh sách người nhận chỉ đọc theo `users.role`, nên người được **gắn** phụ trách phòng trong bảng
`department_managers` mà vai không phải TP/PP thì không hề biết có file mới; nay gộp cả hai nguồn.

2. Đăng xuất, đăng nhập `tp@test.local` → mở NV-01 → khối «Kết quả» phải có đủ nút
   **Yêu cầu sửa · Trình Phó giám đốc · Đẩy về Cán bộ · Hoàn thành** (bốn nút của vai TP/PP; hai nút
   **Trả về TP/PP** và **Duyệt** là của Phó Giám đốc, xem 9b.4).
3. Đăng nhập `nvb@test.local` (phòng PH02) → NV-01 **không nằm trong danh sách nhiệm vụ**. Thử gọi
   thẳng API trong Console, phải `403`:

```js
fetch('/api/v1/task-files/' + '<id nhóm file>', { credentials: 'include' })
  .then(r => console.log('phải là 403:', r.status));
```

4. `nv2@test.local` (cùng phòng PH01, không được giao NV-01): **không** thấy nút nộp bản mới.

### 9b.3 Sửa trực tuyến — và câu trả lời «sửa xong lưu lại kiểu gì»

Đây là câu hỏi bạn nêu. Docs API **không có** phương thức JS nào bắt editor lưu, nên trang sửa có
nút riêng gọi *command service* `forcesave` của Document Server.

Điều kiện: dòng `[7/7]` phải in `ONLYOFFICE: BAT` **và** Document Server sống. Thiếu một trong hai
biến `ONLYOFFICE_URL` / `ONLYOFFICE_JWT_SECRET` thì nút sửa **biến mất lặng lẽ**, không báo lỗi.

1. Đăng nhập `tp@test.local`, mở NV-01, bấm nút **bút chì** (✎) trên bản bạn vừa nộp ở 9b.1.
2. Tab mới mở ra. **Thanh trên** phải có đủ: tên nhiệm vụ · tên file · nút **«Lưu thành bản mới»** ·
   nút **«Đóng»**, và một dòng trạng thái bên dưới.
3. Sửa vài chữ trong tài liệu → bấm **«Lưu thành bản mới»**. Dòng trạng thái báo đã lưu.
4. Đóng tab, quay lại nhiệm vụ, bấm **«Lịch sử»**: phải có **bản 2**, người nộp ghi **Trần Thị Trưởng**
   (chính người vừa sửa), hành động **«sửa trực tuyến»**.

Bốn điểm đáng để ý ở bước này, đều là lỗi đã sửa hôm nay:

- **Trước đây bấm Lưu ra hộp thoại «Không thể lưu tài liệu. Vui lòng kiểm tra cài đặt kết nối»** —
  câu đó khiến rất dễ đi tìm sai chỗ. Thật ra bản mới **vẫn được lưu**, nên «Lịch sử» vẫn đúng và
  lỗi càng khó lần ra. Nguyên nhân: callback trả `{"ok":true,"data":{"error":0}}` theo chuẩn chung
  của dự án, còn Document Server đòi khoá `error` ở **cấp cao nhất**. Nay callback trả đúng
  `{"error":0}` — ngoại lệ có chủ ý, vì đây là đường máy-đối-máy.
- **Bấm Lưu khi chưa sửa gì** ⇒ dòng trạng thái nói «chưa có thay đổi nào», **không** coi là lỗi
  (mã 4 của DS).
- **Người chỉ được xem** (ví dụ mở bản của NV-05 đã duyệt): chỗ nút Lưu hiện chữ **«Chỉ xem»**.
- **Ghi đúng người sửa**: trước đây bản mới ghi cứng người nộp bản gốc với vai `'Nhân viên'`, nên
  Trưởng phòng sửa file của cán bộ thì Lịch sử lại hiện tên cán bộ.

Muốn xem ai nộp bản nào mà không phải bấm:

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c \
  "SELECT v.version_no, v.ten_goc, u.full_name FROM task_file_versions v
     JOIN users u ON u.id = v.uploaded_by ORDER BY v.id;"
```

### 9b.4 Trang «Hàng chờ phê duyệt» — hai tab con

Người dùng chốt: tách phần phê duyệt ra thành trang riêng, chia hai tab nhỏ.

1. Đăng nhập `tp@test.local`. Thanh điều hướng có mục mới **«Hàng chờ phê duyệt»**, kèm **badge số**.
2. Bấm vào: có hai tab con **«Công việc / Nhiệm vụ»** và **«Phê duyệt kết quả»**, mỗi tab một badge riêng.
3. Tab **«Công việc / Nhiệm vụ»** là khối «Chờ duyệt» **chuyển nguyên** từ trang Công việc sang —
   quay lại trang **Quản lý công việc**, khối đó **không còn ở đó nữa** (không để lại bản sao).
   Vai không có cửa duyệt nào thì tab này hiện câu giải thích, không phải khung trống.
4. Tab **«Phê duyệt kết quả»**: chỉ hiện file đang chờ **chính người đang xem**.
   - `tp@` / `pp@` thấy file phòng PH01 ở `cho-xem` và `can-sua`.
   - `pgd@` thấy file **đã trình** (`cho-lanh-dao`) của các phòng mình phụ trách.
   - `nv1@` (cán bộ) **không** thấy dòng nào — cán bộ không có cửa duyệt.
5. Nút trên mỗi dòng **do máy chủ trả về**, không phải trình duyệt tự đoán. Kiểm bằng cách: đăng nhập
   `gd@test.local` → **Cấu hình phòng** → ma trận quyền → hàng **«Duyệt kết quả (file nhiệm vụ)»**,
   cột vai **Trưởng phòng**, đặt **⏳** → quay lại `tp@`: nút chốt **«Hoàn thành» mất luôn** trong
   hàng chờ, chỉ còn «Yêu cầu sửa» và «Trình Phó giám đốc». Đặt lại **✓** thì nút quay về.

Xem thẳng dữ liệu máy chủ trả cho tab này:

```js
fetch('/api/v1/task-files/cho-duyet', { credentials: 'include' })
  .then(r => r.json()).then(j => console.table(j.data.items));
```

### 9b.5 Đường ngắn nhất nếu bạn chỉ có 5 phút

```
chay-test.bat /v14 /f
nv1@test.local  → NV-01 → «Tải file lên» một .docx tên có dấu    (9b.1)
tp@test.local   → «Hàng chờ phê duyệt» → tab «Phê duyệt kết quả» (9b.4)
                → bấm ✎ → sửa → «Lưu thành bản mới» → «Lịch sử»  (9b.3)
```

### 9b.6 Tám việc của vòng 2026-09-03 — bấm để tự nghiệm

Cần bản `app.js 20260902-2` trở lên (Console phải in đúng số đó). Bộ seed Vòng 14.

**(1) Trưởng phòng chọn được cán bộ khi tạo nhiệm vụ.** `tp@test.local` → **Quản lý công việc** →
mở `CV001` → «Thêm nhiệm vụ» → ô **«Người thực hiện trực tiếp»** (đợt 2026-09-09 đổi tên từ «Cán bộ
trực tiếp», xem mục 9b.16) phải có `nv1@`, `nv2@` (trước đây **rỗng**,
không lỗi nào hiện ra). Kiểm nhanh bằng Console: `document.querySelectorAll('select[name="assigneeId"] option').length`
phải > 1.

**(2) Tạo xong hiện ngay, không phải tắt-mở modal.** Đang mở modal chi tiết `CV001` → «Thêm công
việc con» → lưu → dòng mới **xuất hiện luôn trong cây** của modal đang mở.

**(3) Nhân viên không sửa được «Lãnh đạo phòng phụ trách».** `nv1@test.local` → mở một nhiệm vụ của
mình → ô đó **xám (`disabled`)** kèm câu «Do lãnh đạo phòng phân công». Đăng nhập `tp@` mở đúng
nhiệm vụ ấy thì ô sửa được. Đây là chặn **leo quyền**, không phải chuyện thẩm mỹ: mọi cửa duyệt file
đọc `leader_ids`, nên tự đổi ô này là tự chọn người duyệt mình.

**(4) Chỉ lãnh đạo phòng ĐƯỢC GÁN mới thấy và xử.** Mở NV-02 bằng `tp@`, xoá `pp@` khỏi ô «Lãnh đạo
phòng phụ trách», lưu → đăng nhập `pp@test.local` → **«Hàng chờ phê duyệt» → «Phê duyệt kết quả»**:
dòng NV-02 **mất hẳn** (trước đây vẫn thấy và bấm được, chỉ bị chặn ở request cuối). Gán lại thì
dòng quay về. Lưu ý **có chủ ý**: nhiệm vụ chưa gán lãnh đạo nào thì không TP/PP nào thấy — `gd@`
và `pgd@` vẫn xử được nên file không treo.

**(5) Hàng chờ là BẢNG THEO CÂY.** Cùng trang đó: **công việc cha** một hàng đậm → **công việc con**
thụt vào → **nhiệm vụ** thụt sâu hơn (bấm tên là mở nhiệm vụ) → **file** ở hàng cuối, 5 cột: tên
file · trạng thái · bản mới nhất · **Ý kiến** · hành động. Cột «Ý kiến» chỉ hiện chữ **«Xem ý kiến
(n)»**, bấm mới mở nhiệm vụ để đọc — đúng yêu cầu «độ rộng không đủ».

**(6) Nộp bản mới ngay trong hàng chờ.** Trên dòng file có nút **⬆** → chọn `.docx/.pdf` → bảng tự
nạp lại, số bản tăng. Không phải mở modal nhiệm vụ nữa.

**(7) Thanh trạng thái tải lên.** Trong lúc tải, ngay dưới bảng (hoặc dưới khối «Kết quả» nếu làm
trong modal) hiện **«Đang tải lên: <tên file>»**, xong đổi thành dấu ✓, lỗi thì đổi màu đỏ kèm câu
lý do. File 15–20 MB dễ thấy nhất; file nhỏ thì nhấp nháy rất nhanh.

**(8) Giao diện công việc cha.** Mở modal chi tiết một công việc: khối phân công giờ là **3 chip một
dòng** (Người theo dõi · Lãnh đạo phụ trách · Cán bộ), bấm **«Chi tiết»** mới bung đầy đủ. Cây bên
dưới mỗi nhánh một khung có **gờ màu**; nhánh **«Nhiệm vụ trực thuộc công việc»** (không qua công
việc con) dùng **màu khác** để không lẫn với nhiệm vụ nằm trong công việc con.

### 9b.7 Ba lỗi của vòng 2026-09-03 (续7) — bấm để tự nghiệm

Cần bản **`app.js 20260903-1`** (Console phải in đúng số đó) và **seed lại bộ Vòng 14**:
`chay-test.bat /v14 /f`. Bước seed là **bắt buộc** cho mục này — data cũ để cột `leader_ids` rỗng,
xem lý do ở (2) bên dưới.

**(1) Giám đốc và Phó Giám đốc thấy mục «Hàng chờ phê duyệt».** Đăng nhập `gd@test.local` (Giám đốc)
→ thanh điều hướng **phải có** mục «Hàng chờ phê duyệt», badge là **tổng hai hàng chờ** (file + cây
công việc). Làm lại với `pgd@test.local`. Trước bản này chỉ TP/PP thấy mục: lời gọi cập nhật nằm
trong nhánh «đổi vai TP/PP/Phó GĐ» nên admin không bao giờ chạy tới — vai quyền cao nhất lại là vai
duy nhất không thấy cửa duyệt, và **không có lỗi nào hiện ra**.

So badge với `nv1@test.local`: cán bộ **không** thấy mục (họ không có cửa duyệt nào). Đếm thẳng bằng
Console nếu muốn chắc:

```js
document.getElementById('nav-cho-duyet').className;      // KHÔNG được chứa 'hidden'
document.getElementById('nav-cho-duyet-badge').textContent;
```

**(2) «Tải lên thất bại: máy chủ từ chối» đã hết.** `tp@test.local` → mở NV-02 → khối **«Kết quả»** →
«Tải file lên» một `.docx` → phải lên được. Nguyên nhân cũ **không** phải upload hỏng: vòng trước
siết mọi cửa file theo ô «Lãnh đạo phòng phụ trách» (`leader_ids`), nhưng bộ seed để cột đó **rỗng**
⇒ không ai là lãnh đạo phụ trách của nhiệm vụ nào, nên máy chủ trả 403 và giao diện chỉ nói được câu
chung «máy chủ từ chối». Seed mới gán sẵn: NV-02/NV-04 cho **Trưởng phòng**, NV-01/NV-03/NV-05 cho
**Phó phòng** — nên hãy thử **cả hai** tài khoản, mỗi người chỉ xử được phần của mình.

Xem thẳng ai phụ trách nhiệm vụ nào:

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c \
  "SELECT i.code, i.name, u.email FROM work_items i
     LEFT JOIN users u ON u.id = ANY(i.leader_ids)
    WHERE i.level = 3 ORDER BY i.code;"
```

**(3) Hàng chờ không còn trống.** `tp@test.local` → «Hàng chờ phê duyệt» → tab «Phê duyệt kết quả»:
phải có dòng của **NV-02** và **NV-04**. Đăng nhập `pp@test.local`: thấy **NV-03** (`can-sua`), không
thấy NV-02/NV-04. Đây là cùng một nguyên nhân với (2) — hàng chờ và cửa nộp/duyệt nay đọc **cùng một
luật**, nên nếu một trong hai chỗ trống thì cả hai đều trống, đừng đi tìm hai lỗi khác nhau.

Nếu vẫn trống sau khi seed: gần như chắc là trình duyệt còn `app.js` bản cũ (Ctrl+F5) hoặc máy chủ
đang nối CSDL khác — bước `[7/7]` của `chay-test.bat` in ra CSDL đang nối, đọc dòng đó trước.

### 9b.8 Hai bảng kết quả thiết kế lại (2026-09-04, đợt 1) — bấm để tự nghiệm

Cần bản **`app.js 20260904-1`** (Console phải in đúng số đó, và **Ctrl+Shift+R** để lấy cả
`app.css 20260904-1` — đợt này đổi cả CSS). **Không** cần migration, **không** cần seed lại.

Đây là **đợt 1: chỉ hình dáng**. **Dòng «Chưa có»** và **định dạng «Báo cáo»** nằm ở **đợt 2** —
xem mục **9b.10** (cần `app.js 20260904-3` + migration **016**).

**(1) Khối «Kết quả» giờ là một bảng 8 cột.** `nv1@test.local` → NV-01 → tab «Thông tin», cuộn tới
nhãn «Kết quả». Hàng tiêu đề phải đọc từ trái sang phải đúng thứ tự:

```
Thời gian | Kết quả làm được | Định dạng | File đã tải lên | Người thực hiện | Ghi ý kiến | Tình trạng | Hành động
```

Mỗi kết quả là **một dòng** đánh số **1.**, **2.**, **3.**… «Thời gian» tự ghi nhận lúc nộp (bạn
không phải điền), «Người thực hiện» tự lấy tên người nộp, «Định dạng» tự suy từ đuôi file — nộp một
`.xlsx` thì ô đó ghi **Excel**, `.pptx` ghi **PPT**, `.png` ghi **Ảnh**.

**(2) Các lần đã sửa nằm sau nút ▸, thu gọn sẵn.** Nộp thêm 2 bản nữa cho cùng một kết quả (menu ⋯
→ «Nộp bản mới»). Dòng cha ghi «3 bản» và **vẫn chỉ một dòng** — bấm **▸** ở đầu dòng mới bung ra
**1.1**, **1.2**, **1.3**, trong đó 1.2 ghi thêm «— Sửa lần 1» và 1.3 «— Sửa lần 2» (bản đầu tiên
không phải lần sửa nào nên 1.1 không có chữ đó). Bấm lại là gập, mũi tên đổi ▸ ↔ ▾. Đây là chỗ bạn
đã chọn «thu gọn mặc định» thay vì hiện thẳng.

**(3) Mọi hành động gộp vào một nút ⋯.** Cột «Hành động» chỉ còn **một** nút ba chấm; bấm mới hiện
danh sách dọc «Tải lên / Nộp bản mới · Tải bản mới nhất · Xem ngay trong trình duyệt · Sửa trực
tuyến · Yêu cầu sửa · Trình Phó giám đốc · Hoàn thành / Duyệt · Xoá kết quả này» — đúng những mục
**vai của bạn** được làm, không phải tất cả. Mở menu của dòng khác thì menu đang mở **tự đóng**;
bấm ra chỗ trống cũng đóng. Đăng nhập `tp@test.local` xem cùng nhiệm vụ: danh sách trong menu khác
hẳn của cán bộ. (Nút hiện/ẩn chỉ cho gọn mắt — máy chủ vẫn chặn lại nếu gọi thẳng.)
> **Đã đổi tên ở ĐỢT B (11/09/2026):** «Yêu cầu sửa» gộp vào **«Đẩy về Cán bộ»**, «Trình Phó giám đốc»
> thành **«TP/PP phê duyệt»** và **chỉ hiện khi nhiệm vụ bật tích «Gửi BLĐ phê duyệt»**; nút
> **«Hoàn thành / Duyệt»** giữ nguyên nhãn nhưng nay **kèm ô ghi chú tuỳ chọn**. Xem **9b.23** mục **E**,
> **F** và **J**.

**(4) Cột «Tình trạng» đọc được thành câu.** Không còn chỉ một nhãn ngắn: dưới badge màu là câu kể
như «đang đợi Trưởng phòng/Phó phòng duyệt», «đang đợi Cán bộ sửa và nộp bản mới», «TP/PP đã duyệt,
đang gửi lên Phó Giám đốc/Giám đốc». Để thấy phần đếm: `tp@test.local` bấm «Yêu cầu sửa» một lần →
mở lại nhiệm vụ, câu đó thành **«Bị trả lại lần 1 — đang đợi Cán bộ sửa và nộp bản mới»**; nộp bản
mới rồi «Yêu cầu sửa» lần nữa thì ra **lần 2**.

**(5) «Hàng chờ phê duyệt → Phê duyệt kết quả» thành bảng phẳng 8 cột.** `tp@test.local` → «Hàng
chờ phê duyệt» → tab «Phê duyệt kết quả». Hàng tiêu đề:

```
Tên kết quả làm được | Nhiệm vụ | Công việc con | Công việc chính | Trạng thái | Bản mới nhất | Ý kiến | Nút chức năng
```

Khác bản trước ở chỗ **hết hàng tiêu đề gộp**: ba cấp cây nay là **ba cột của chính dòng file**, nên
mỗi dòng tự nói nó thuộc nhiệm vụ nào, công việc con nào, công việc chính nào — mắt quét theo hàng,
không phải nhớ mình đang ở dưới nhóm nào. Nhiệm vụ nào không có công việc con thì ô đó là dấu «—»
chứ không bỏ trống. Tên nhiệm vụ vẫn bấm được để mở nhiệm vụ. Cột «Nút chức năng» cũng là **một
menu ⋯** như (3).

Thứ tự dòng là **của máy chủ** (theo mã công việc → mã công việc con → mã nhiệm vụ). Nếu bạn thấy
thứ tự trông lạ thì đó là thứ tự mã, không phải lỗi sắp xếp.


### 9b.9 Ba việc bạn báo sau khi xem bảng thật (2026-09-04) — bấm để tự nghiệm

Cần bản **`app.js 20260904-2`** và **`app.css 20260904-2`** (Console in số đó; **Ctrl+Shift+R** vì
đợt này đổi cả CSS). Không migration, không seed lại.

**(1) Số trên tab «Hàng chờ phê duyệt» nhìn rõ chưa.** Đăng nhập `tp@test.local`, nhìn **thanh điều
hướng bên trái**: mục «Hàng chờ phê duyệt» có một **badge đỏ** với con số ở mép phải. Trước đây con
số đó **trắng trên nền trắng** nên coi như mất — bản đóng gói Tailwind của trang bị cắt bớt, không
có sẵn màu nền `rose-600` mà badge đang dùng, nên nền không được vẽ ra. Nay đã khai bù màu đó.

Cùng lỗi ấy còn ăn vào **badge trạng thái** của hai bảng kết quả: mở NV-01, badge «Chờ TP/PP xem»
phải có **nền vàng nhạt chữ nâu** (trước là chữ nâu trên nền trắng), và kết quả nào đã được Phó
Giám đốc duyệt thì badge «Đã duyệt» phải là **nền xanh đậm chữ trắng** (trước là badge trắng trơn,
coi như biến mất).

**(2) Menu ⋯ không còn bị hộp cắt.** Đây là việc bạn báo «ấn thì bị vấn trong hộp nên phải kéo chuột
xuống mới thấy». Thử ở **dòng cuối cùng** — chỗ dễ lộ nhất:

- `tp@test.local` → «Hàng chờ phê duyệt» → tab «Phê duyệt kết quả» → bấm ⋯ ở **dòng dưới cùng** của
  bảng. Danh sách phải hiện **đầy đủ, nổi lên trên khung trắng**, không bị cắt ngang và bạn **không
  phải cuộn** để thấy mục cuối.
- Nếu dòng đó nằm sát **đáy cửa sổ**, menu phải **tự mở ngược lên trên** thay vì đổ xuống rồi mất.
- Làm y như vậy trong **modal nhiệm vụ**: mở NV-01 → tab «Thông tin» → bảng «Kết quả» → bấm ⋯ ở dòng
  cuối. Modal có thanh cuộn riêng nên đây là chỗ lỗi nặng nhất trước đây.
- **Cuộn trang trong khi menu đang mở** thì menu đứng yên tại chỗ cũ (nó đã ra ngoài khung cuộn) —
  bấm ra chỗ trống để đóng, rồi bấm ⋯ lại. Đó là đánh đổi có ý: thà menu đứng một chỗ còn hơn bị
  cắt mất.
- Chọn một mục bất kỳ (ví dụ «Tải bản mới nhất») thì menu **đóng ngay** và việc vẫn chạy như trước.

**(3) Cột «Tên kết quả làm được» ở hàng chờ nay hai dòng.** Vẫn ở tab «Phê duyệt kết quả», nhìn cột
đầu tiên. Mỗi dòng phải có:

- **biểu tượng theo định dạng** ở đầu: Word xanh, Excel xanh lá, PowerPoint cam, PDF đỏ, ảnh tím
  (đuôi lạ thì biểu tượng tệp xám);
- **dòng trên**: tên kết quả + chữ mờ «**N bản**»;
- **dòng dưới**: **tên file của bản mới nhất**.

Muốn thấy rõ hai dòng đó là **hai thứ khác nhau**: ở NV-01 nộp bản mới bằng một file **đặt tên khác**
(ví dụ `ban-sua-lan-2.docx`), rồi quay lại hàng chờ. Dòng trên vẫn là tên kết quả ban đầu, dòng dưới
đổi thành `ban-sua-lan-2.docx`, và số bản tăng lên. Tên quá dài thì bị cắt bằng «…» — trỏ chuột vào
để đọc đủ.

Từ **đợt 2** (mục **9b.10**, cần `app.js 20260904-3` + migration **016**): dòng trên là **tên kết
quả bạn tự đặt** khi khai, không còn lấy theo tên file đầu tiên. Dòng dưới vẫn là tên file của
bản mới nhất.


### 9b.10 Đợt 2 — khai kết quả trước khi có file + form tạo hiện bảng (2026-09-04)

Cần bản **`app.js 20260904-3`** (Console in số đó; **Ctrl+Shift+R**) **và migration 016 đã chạy**
(`SELECT ten_ket_qua, dinh_dang FROM task_files LIMIT 1;` không được báo «column does not exist»).
Không seed lại.

**(1) Form «Tạo nhiệm vụ mới» phải thấy bảng 8 cột ngay.** Đăng nhập `nv1@test.local` (hoặc
`tp@test.local`) → «Quản lý Nhiệm vụ» → **Tạo mới**. Trong tab «Thông tin», khối «Kết quả» phải
là **một bảng** với đủ 8 cột (Thời gian · Kết quả làm được · Định dạng · File đã tải lên · Người
thực hiện · Ghi ý kiến · Tình trạng · Hành động), **không** phải khung trống. Dòng đầu mang số
**1.**, ô tên + ô định dạng + ô ghi ý kiến đã sẵn để điền. Cột 4 ghi «Chưa có». Cột 7 ghi «Sẽ
gửi khi lưu nhiệm vụ».

**(2) Nút ＋ thêm dòng 2. 3. tại chỗ, không mở hộp chọn file.** Bấm «Thêm kết quả» → phải mọc thêm
dòng **2.** ngay dưới, vẫn chưa gọi máy chủ. Xoá hết dòng thì hệ thống **giữ lại ít nhất một
dòng trống** (không để bảng mất). Form **công việc con** (cấp 2) **không** có bảng này.

**(3) Lưu nhiệm vụ là lúc các dòng khai được gửi.** Điền dòng 1. tên «Báo cáo quý 3», định dạng
Word, ý kiến tuỳ ý; dòng 2. để trống tên. Bấm Lưu. Mở lại nhiệm vụ vừa tạo → khối «Kết quả» phải
có **một** dòng cha «Báo cáo quý 3», cột Định dạng icon Word, cột 4 vẫn «Chưa có» (chưa nộp file).
Dòng để trống **không** thành kết quả rác.

**(4) Cán bộ nộp file đầu tiên thành dòng 1.1.** Mở nhiệm vụ đã khai → ⋯ hoặc nút tải trên đúng
dòng «Chưa có» → chọn một file Word. Sau khi tải xong, dòng cha vẫn là **1.**, bản file là **1.1**
(bấm ▸ mới thấy). Nộp/sửa lần sau là **1.2**. Kết quả đã `da-duyet` thì nộp tiếp bị máy chủ từ
chối (409) — đúng, không phải lỗi giao diện.

**(5) Định dạng «Báo cáo» là ô chữ, không phải file.** Ở form tạo (hoặc ＋ khi sửa nhiệm vụ), chọn
định dạng **Báo cáo** → phải hiện ô nhập nội dung. Gõ ≥ 10 ký tự rồi lưu. Mở lại: cột 4 hiện đoạn
chữ (không có nút tải file), hàng chờ nếu vào được thì dòng 2 ghi «Báo cáo (nhập chữ)». Nội dung
ngắn hơn 10 ký tự bị từ chối.

**(6) Hàng chờ lấy tên bạn đặt, nhóm chưa có bản thì không vào hàng chờ.** Vào «Hàng chờ phê
duyệt» → tab «Phê duyệt kết quả». Cột 1 dòng trên = **tên kết quả khai**, kèm icon + «N bản»;
dòng dưới = tên file bản mới nhất. Một kết quả vừa khai, chưa nộp file / chưa nộp báo cáo **không
xuất hiện** ở đây (vẫn thấy trong modal nhiệm vụ).

Nếu Console **không** in `app.js 20260904-3` thì đang chạy file cũ — Ctrl+Shift+R. Nếu form tạo
vẫn không có bảng thì chưa nhận bản này. Nếu lưu nhiệm vụ xong khối «Kết quả» trống dù đã điền
dòng khai, xem toast lỗi (thường là chưa chạy migration 016, hoặc đang tạo **công việc con** cấp
2).


### 9b.11 Năm việc bạn báo qua ảnh (2026-09-06) — bấm để tự nghiệm

Cần bản **`app.js 20260905-2`** (Console in đúng số đó; **Ctrl+Shift+R** nếu không). Không
migration mới, không seed lại. Sáu bước dưới đây đi liền một mạch, làm đúng thứ tự.

**(1) «Xem chi tiết» ở hàng chờ duyệt phải có dữ liệu THẬT.** Đăng nhập `tp@test.local` → **Tạo
công việc** mới (tên gõ dễ nhận, ví dụ «Việc thử 0906»), điền mô tả + ngày bắt đầu/kết thúc →
bấm **Gửi đi duyệt**. Đăng xuất, đăng nhập `pgd@test.local` → tab **Hàng chờ phê duyệt** → bấm
«Xem chi tiết» ở dòng vừa gửi. Modal phải hiện **khối «Thông tin công việc»** ngay dưới 4 thẻ số:
mô tả, ngày bắt đầu, ngày kết thúc, trạng thái, trạng thái duyệt — **không** được trắng trơn chỉ
có tiêu đề như trước. Bốn thẻ số và cây bên dưới cũng phải khớp với công việc đó.

**(2) Tạo xong công việc cha thì tạo tiếp con/nhiệm vụ ngay.** Về `tp@test.local`, tạo một công
việc nữa. Ngay khi lưu xong, modal tạo tự đóng và **modal chi tiết của chính công việc vừa tạo tự
mở** — trong đó có nút «+ công việc con». Bấm vào, tạo công việc con, lưu; modal chi tiết cha lại
mở, thấy công việc con vừa thêm. Từ hàng công việc con bấm nút tạo nhiệm vụ cấp 3, lưu. **Không**
phải tắt đi mở lại mới thấy dòng mới, và **không** phải quay ra danh sách rồi tìm lại công việc.

**(3) Chân form tạo: chỉ hai nút ý định, dính đáy.** Mở form tạo (công việc, công việc con hoặc
nhiệm vụ). Cuộn xuống — thanh dưới cùng **dính đáy** (không phải cuộn hết mới thấy), có
«Hủy» · «Lưu tạm» · «Gửi đi duyệt», kèm dòng chữ nhỏ giải thích. Ở thanh tiêu đề **không còn** nút
lưu nào nữa. Đây là điểm cũ dễ sai: trước có nút «Tạo nhiệm vụ» ở tiêu đề không mang ý định gì,
bấm vào thì máy chủ tự quyết trạng thái mà bạn không biết mình đã gửi duyệt hay chưa.

Bấm **Lưu tạm** ⇒ mục mới ở trạng thái **Nháp**, không xuất hiện trong hàng chờ duyệt của ai.
Bấm **Gửi đi duyệt** ⇒ toast ghi rõ trạng thái máy chủ trả về và dòng đó hiện **«Chờ duyệt» ngay**,
**không** cần F5. Ở chế độ **sửa**, nút «Cập nhật» vẫn nằm ở thanh tiêu đề như cũ.

**(4) Nhiệm vụ cấp 3 KHÔNG bị gán «Chờ duyệt» theo cha.** Mở một công việc đang «Chờ duyệt», tạo
thêm **nhiệm vụ cấp 3** trong đó rồi bấm «Gửi đi duyệt». Nhiệm vụ mới **không** được hiện «Chờ
duyệt» chỉ vì cha đang chờ — toast sẽ nói rõ «nhiệm vụ cấp 3 không gửi độc lập». Đối chiếu bằng
SQL cho chắc:

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c \
  "SELECT code, level, approval_status FROM work_items ORDER BY created_at DESC LIMIT 5;"
```

Cột `approval_status` trên màn hình phải **khớp** cột này. Trước đây giao diện ghi «Chờ duyệt» còn
CSDL để `Nháp` — đó chính là lỗi đã sửa.

**(5) Dòng khai kết quả phải thẳng hàng.** Mở form tạo nhiệm vụ → bảng 8 cột. Chọn định dạng
**Báo cáo** ở dòng 1. ⇒ ô nhập nội dung bung ra thành **một hàng riêng chạy hết chiều ngang bảng**,
nằm ngay dưới dòng 1. — không chen vào trong cột 8 làm các ô lệch nhau như ảnh bạn gửi. Đổi lại
sang Word ⇒ hàng nội dung ẩn đi. Bấm ＋ thêm dòng 2., 3.; xoá dòng 2. ⇒ **cả** hàng nội dung của nó
mất theo và dòng 3. được đánh số lại thành **2.** Xoá đến dòng cuối thì hệ thống giữ lại một dòng
trống.

**(6) Menu ⋯ / Hành động phải hiện lên TRÊN hộp.** Trong modal nhiệm vụ (chế độ sửa), ở bảng «Kết
quả» bấm nút **⋯** cột Hành động. Menu phải **hiện đầy đủ, nổi trên** modal — kể cả khi dòng đó
nằm gần đáy bảng (menu tự mở ngược lên) hoặc sát mép phải. Bấm ⋯ lần nữa hoặc bấm ra ngoài thì
menu gập lại. Trước đây menu bị hộp kính mờ cắt mất nên bấm như không có gì xảy ra.

Nếu Console **không** in `app.js 20260905-2` thì đang chạy file cũ — **Ctrl+Shift+R**. Nếu bước (3)
vẫn thấy nút lưu ở thanh tiêu đề, hoặc bước (5) ô Báo cáo vẫn nằm trong cột 8, thì bản `web/` chưa
được sync.


### 9b.12 Chuông thông báo (2026-09-06) — bấm để tự nghiệm

Cần bản **`app.js 20260906-1`**. Không migration mới, không seed lại. Đây là **việc A** của
`docs/KE-HOACH-THONG-BAO.md`; phần đẩy sang **Zalo** (việc B) **chưa làm** — còn chờ bạn trả lời bốn
câu ở §13.4 **mục 25** của `KE-HOACH-VPS.md`.

Máy chủ đã ghi thông báo từ lâu (mỗi lần gửi duyệt / duyệt / từ chối / ủy quyền / nộp kết quả /
nhiệm vụ quá hạn) nhưng **không có đường đọc** nên không ai thấy. Nay có chuông.

**(1) Chuông xuất hiện cạnh nút chat, badge đúng số ngay khi đăng nhập.** Đăng nhập
`pgd@test.local`. Trên thanh tiêu đề, bên trái nút 💬 phải có nút 🔔. Nếu người này đang có thông báo
chưa đọc thì badge đỏ hiện số **ngay lần vẽ đầu**, không phải chờ vài giây. Không có thông báo nào ⇒
badge **ẩn hẳn**, không hiện số 0.

**(2) Tạo một thông báo thật rồi xem nó nổi lên.** Mở tab khác (hoặc trình duyệt ẩn danh) đăng nhập
`tp@test.local` → tạo một công việc mới → **Gửi đi duyệt**. Quay về tab của `pgd@test.local`: trong
vòng **1 phút** badge phải tăng thêm 1 mà **không** cần F5 (vòng hỏi lại 60 giây). Bấm 🔔 → dòng mới
nằm trên cùng, chữ **đậm**, có **chấm xanh** bên phải, kèm dòng nhỏ «14:05 hôm nay · bấm để mở».

**(3) Bấm vào thông báo phải mở đúng việc.** Bấm dòng đó ⇒ modal chi tiết **đúng công việc vừa gửi**
mở ra, và dòng thông báo chuyển sang **không đậm**, mất chấm xanh, badge giảm 1. Đây là điểm dễ sai:
thông báo lưu **id** trong CSDL còn giao diện tra theo **mã** (`CV003`), nên nếu dò không ra thì hệ
thống báo «hãy tải lại trang» chứ **không** mở sai việc.

**(4) «Đánh dấu đã đọc hết».** Bấm 🔔 → nút ở góc phải hộp → badge **ẩn hẳn**, mọi dòng thành không
đậm. Mở lại hộp: các dòng vẫn còn (đọc rồi ≠ xoá).

**(5) Không ai đọc được thông báo của người khác.** Vẫn ở tab `pgd@test.local`, mở DevTools →
Console, gõ:

```js
await (await fetch('/api/v1/notifications?userId=1&limit=100', {credentials:'same-origin'})).json()
```

Kết quả chỉ được chứa thông báo **của chính Phó GĐ đang đăng nhập** — tham số `userId` bị **bỏ qua**,
kể cả khi bạn đăng nhập bằng admin. Đối chiếu với CSDL:

```bash
docker exec -i qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c \
  "SELECT u.email, count(*) FILTER (WHERE NOT n.is_read) AS chua_doc
     FROM notifications n JOIN users u ON u.id = n.user_id GROUP BY u.email ORDER BY 1;"
```

Số `chua_doc` của email đang đăng nhập phải **khớp** badge trên màn hình; số của người khác **không**
được lộ ra trong phản hồi API.

**(6) Tab để trong nền thì không nã request.** Mở DevTools → Network, lọc `unread-count`. Chuyển sang
tab khác của trình duyệt và để đó 3 phút, rồi quay lại: trong lúc tab bị ẩn **không** có request
`unread-count` nào mới. Quay lại tab thì nhịp 60 giây chạy tiếp.

Nếu Console **không** in `app.js 20260906-1` thì đang chạy file cũ — **Ctrl+Shift+R**. Nếu không thấy
nút 🔔, `web/index.html` chưa được sync. Nếu bấm 🔔 mà hộp ghi «Chưa tải được thông báo» thì máy chủ
đang chạy bản cũ chưa có `GET /api/v1/notifications` — khởi động lại Node.


---

### 9b.13 Lệnh sửa, ý kiến OnlyOffice, gửi lại và hủy lệnh — Phase 8b (2026-09-08)

**Đã nghiệm thu/phát hành 2026-09-08:** người dùng xác nhận test PC OK; bản này đã deploy.
VPS đã reset database theo yêu cầu riêng, giữ admin và liên kết Zalo, xóa phiên cũ.
Đăng nhập lại bằng mật khẩu admin cũ, tạo lại phòng/tài khoản/dữ liệu cần dùng; **không seed
production**. Các bước dưới là checklist hồi quy PC; healthcheck VPS không thay thế test
DOCX/gửi Zalo người thật sau khi tạo dữ liệu mới.

**Chỉ thử trên PC** tại `http://127.0.0.1:8099`; Ctrl+Shift+R, banner **app.js 20260907-2**.
Migration mới nhất phải là **020_task_file_lenh_sua**. Giữ dữ liệu đang có:
không seed/reset; nếu cần chạy lại stack dùng `chay-test.bat /giu` sau khi tự đóng server cũ.
OnlyOffice phải sống; các file vật lý của seed có thể thiếu, nên thử với **DOCX thật mới nộp**.

1. Cán bộ nộp file cho TP/PP phụ trách; TP/PP «Yêu cầu sửa» và nhập lý do.
2. Cán bộ vào **Hàng chờ phê duyệt**: chỉ thấy tab vàng **Yêu cầu sửa**, badge bằng số lệnh
   của mình; dòng có tên kết quả/file mới nhất/lý do/ghi chú và đủ **bốn nút**.
3. Nhập ghi chú → **Lưu tạm** → Tải lại: ghi chú còn, dòng vẫn vàng, chưa về cửa TP/PP.
4. **Sửa** mở OnlyOffice riêng: sửa nội dung rồi Ctrl+S; đợi hiện
   **«Đã lưu bản mới — chưa gửi đi»**. Quay về hàng chờ, lệnh vẫn còn.
5. Nhập ý kiến ở OnlyOffice → **Gửi bản mới nhất đi** → confirm **Không**: tab không đóng,
   trạng thái không đổi. Bấm lại → **Có**: gửi đúng bản vừa lưu, tab đóng sau thành công;
   TP/PP thấy lại file chờ xem và chuông, lệnh vàng của Cán bộ mất.
6. Lặp lại với thay đổi **chưa Ctrl+S**: bấm Gửi phải chờ lưu xong rồi mới gửi. Nếu lưu lỗi,
   không gửi bản cũ, không đóng tab và nút được mở lại. «Lưu thành bản mới» riêng không gửi duyệt.
7. Tạo lại lệnh → **Hủy lệnh**: confirm Không không đổi gì; Có thì file/bản vẫn tải được,
   về `cho-xem` và người ra lệnh nhận chuông.
8. TP/PP trình PGD → PGD **Trả về TP/PP** có lý do: TP/PP nhận lệnh vàng riêng (`can-sua`,
   `lanh-dao`), không còn dòng đó ở tab phê duyệt kết quả. Cán bộ không thấy/không xử được lệnh TP.
9. TP/PP **Gửi lại** với quyền ⏳ → `cho-lanh-dao`; quyền ✓ → `da-duyet`.
   TP/PP **Hủy lệnh** → `cho-lanh-dao`. TP/PP vẫn có thể đẩy tiếp về Cán bộ qua menu kết quả.
10. Chuông có tham chiếu file phải mở được đúng hàng chờ/tab; người cùng phòng không phải
    chủ lệnh và người ngoài phòng không được gửi/hủy/lưu tạm hộ. PGD/GĐ không có lệnh thì ẩn tab vàng.

**Kết quả cần người dùng xác nhận:** sau khi thử đúng các bước, nói **«Đã test PC và OK»**
cho riêng đợt này. Trước đó **không commit, push hay deploy VPS**. Kiểm Zalo thật chỉ thực hiện
theo cổng phát hành; PC không tự gửi tin bằng bot production.

### 9b.14 Bỏ vai phân quyền Quản lý công việc (2026-09-08)

**Đã phát hành VPS ngày 2026-09-08 sau OK riêng.** Không seed/reset dữ liệu
để test; dùng `chay-test.bat /giu` sau khi tự đóng đúng cửa sổ máy chủ cũ nếu cổng3000 bận.
Launcher tự lấy migration021; Ctrl+Shift+R, banner app phải **20260908-1**.

1. Đăng nhập admin → Quản lý tài khoản → tạo/sửa Cán bộ. Ô phân quyền có đúng năm lựa chọn:
   Cán bộ, Trưởng phòng, Phó phòng, Phó Giám đốc, Giám đốc; không có «Quản lý»/vai cũ.
2. Chọn Trưởng phòng ở vai phòng → phân quyền chuyển Trưởng phòng; đổi phân quyền Phó phòng
   → vai phòng chuyển Phó phòng. Lưu và mở lại: cả hai trường giữ đúng, không trở thành vai cũ.
3. Sửa tên/ghi chú của admin rồi mở lại: vẫn Giám đốc; đăng nhập lại bằng mật khẩu cũ,
   trạng thái liên kết Zalo vẫn còn. Không gửi tin Zalo thử hoặc đổi token.
4. Với TP/PP đang phụ trách nhiệm vụ, đăng nhập lại → xem nhiệm vụ/file/hàng chờ đúng phạm vi;
   người ngoài phòng không được mở rộng quyền. Việc chưa phân công lãnh đạo không tự xuất hiện.
5. Đối chiếu tài khoản cũ sau021: Quản lý công việc + chức vụ TP/PP → đúng TP/PP;
   không có chức vụ đó → Cán bộ. Dữ liệu công việc/file vẫn còn, không tạo lại tài khoản.

Đây là **vai phân quyền**, không đổi tên trang «Quản lý công việc». Mục9b.13 và luồng
OnlyOffice/chuông/Zalo vẫn phải hoạt động; không coi test tự động thay cho nghiệm thu tay.

### 9b.15 Phân quyền động · Ban lãnh đạo cấp1 · khóa phòng · tỷ lệ nhiệm vụ con · duyệt kèm sửa (2026-09-09)

**Đợt này CHƯA phát hành VPS.** Bật máy chủ bằng `chay-test.bat /giu` (giữ dữ liệu, không seed/reset);
tự đóng đúng cửa sổ máy chủ cũ nếu cổng 3000 bận. Ctrl+Shift+R rồi mở DevTools Console: banner phải là
**`[QLCV] app.js 20260909-4`**. Migration **022** (tỷ lệ nhiệm vụ con) và **023** (bản ghi thay đổi khi duyệt)
phải có trong `pgmigrations`; launcher tự kiểm ở bước `[7/7]`.

Cần **HAI phiên trình duyệt tách cookie** (ví dụ Chrome cho admin, Edge/Firefox hoặc cửa sổ ẩn danh cho Phó phòng)
để kiểm «admin đổi quyền → phiên đang mở của người kia nhận quyền mới».

**A. Phân quyền hệ thống là nguồn quyết định thật**

1. Phiên Phó phòng (đang đăng nhập, KHÔNG đăng xuất): đếm xem có tab «Quản lý công việc» và nút tạo nhiệm vụ không. ĐÃ OK
2. Sang phiên admin → Phân quyền hệ thống → hàng **Phó phòng / Nhiệm vụ / Tạo**: đổi sang ✕ (`tu-choi`) → Lưu.
   Lưu phải báo thành công; mở lại bảng quyền phải thấy đúng ✕ đã lưu.
3. Quay lại phiên Phó phòng **mà KHÔNG F5, KHÔNG đăng nhập lại**: chờ tối đa **15 giây** (hoặc chuyển sang tab khác
   rồi quay lại để nó nạp ngay). Nút tạo phải MẤT, tab ẩn theo quyền. Đây là độ trễ thật — không phải «tức thì».
4. Thử bấm tạo bằng đường cũ/URL trực tiếp nếu còn: máy chủ phải từ chối, **không có dòng dữ liệu mới**.
5. Đổi lại ✓ (`cho-phep`) → chờ ≤15 giây → nút tạo hiện lại và tạo được. Đổi sang ⏳ (`cho-duyet`) → vẫn tạo được
   nhưng đầu việc vào **Chờ duyệt**, KHÔNG được hiểu là ✓.
6. Lặp với **Trưởng phòng** và **Cán bộ**; lặp với các hành động Đọc/Sửa/Xóa/Duyệt và quyền **Sửa tỷ lệ**
   (quyền này trước đây admin bấm Lưu là bị từ chối, nay phải lưu được).
7. Kiểm quyền **file** (Nộp kết quả / Duyệt kết quả) không bị đợt này làm hỏng: TP/PP đặt ⏳ ở hàng file thì MẤT nút
   «Hoàn thành/Duyệt» và phải trình Phó GĐ/GĐ; Phó GĐ/GĐ không cho đặt ⏳ ở hai hàng file (báo lỗi khi lưu).

**B. Nhiệm vụ trực thuộc công việc cha (cấp3 nằm thẳng dưới cấp1)**

8. Mở một **công việc cấp1** → «Thêm nhiệm vụ» (không qua công việc con). Form phải có ĐỦ BA ô tách biệt:
   **Ban lãnh đạo phụ trách** (Phó Giám đốc hoặc Giám đốc) · **Lãnh đạo phòng phụ trách** (Trưởng phòng/Phó phòng) ·
   **Người thực hiện trực tiếp** (tên cũ «Cán bộ trực tiếp»). Ô Ban lãnh đạo KHÔNG được chứa TP/PP, và ô TP/PP KHÔNG được chứa PGD/Giám đốc.
   *(Đợt 2026-09-09: ô thứ ba nay CHỨA ĐƯỢC Trưởng/Phó phòng — xem mục 9b.16; điều cấm còn lại là ô
   Ban lãnh đạo và ô Lãnh đạo phòng không được trộn vai.)*
9. Chọn một Phó GĐ **có phụ trách phòng của công việc cha** → lưu được. Chọn Phó GĐ **ngoài phạm vi** → phải bị từ chối
   với thông báo đúng lỗi phân công, KHÔNG lưu.
10. Chọn **Giám đốc** (tài khoản admin hợp lệ) ở ô Ban lãnh đạo → lưu được.
11. Mở lại nhiệm vụ vừa tạo: cả ba ô phải hiện ĐÚNG người đã chọn. Sửa nội dung khác rồi lưu lại: phân công KHÔNG mất.
12. Tạo nhiệm vụ **dưới công việc con** như cũ → luồng cũ vẫn chạy đúng, không bị ảnh hưởng.
13. Để trống **Người thực hiện trực tiếp** → phải bị chặn với thông báo «Vui lòng chọn Người thực hiện trực tiếp cho nhiệm vụ»,
    cả khi bấm «Lưu tạm» lẫn «Gửi đi duyệt».

**C. Khóa phạm vi phòng khi tạo (TP/PP/Cán bộ)**

14. Phiên TP/PP/Cán bộ: mở form tạo **công việc cấp1** → ô Phòng phải bị khóa/chỉ có phòng của mình,
    KHÔNG chọn được phòng khác.
15. Tạo **công việc con** và **nhiệm vụ**: chỉ chọn được cha thuộc phòng mình; nhiệm vụ trực thuộc cấp1 cũng vậy.
16. Phòng của cấp2/cấp3 phải kế thừa cha — không đổi được bằng tay.
17. Nếu admin mở ô quyền sang phạm vi «tất cả các phòng» (`tat-ca`) thì TP/PP/Cán bộ **vẫn không tạo được ngoài phòng
    mình** (phạm vi rộng chỉ nới đọc/sửa). Đây là hành vi có chủ ý.
18. Tài khoản **chưa có phòng**: tạo phải báo rõ «Tài khoản chưa có phòng… liên hệ quản trị để phân phòng»,
    KHÔNG tự rơi sang toàn đơn vị.
19. Admin và Phó Giám đốc: phạm vi tạo GIỮ NHƯ CŨ (không bị ép về một phòng).
20. Thử lách: sửa payload bằng DevTools, hoặc gọi thẳng REST/RPC với `department_id`/ID cha ngoài phòng →
    máy chủ phải chặn và KHÔNG ghi dữ liệu. Sửa/chuyển cha sang phòng khác cũng phải bị kiểm lại.

**D. Tỷ lệ nhiệm vụ TRONG công việc con**

21. Tạo công việc con, thêm **2 nhiệm vụ**: tỷ lệ mặc định **chia đều 50/50**. Thêm nhiệm vụ thứ 3 → tự chia lại
    (33/33/34 kiểu số nguyên, tổng đúng 100).
22. Sửa tay tỷ lệ MỘT nhiệm vụ thành 70 (để tổng 120): các nhiệm vụ khác GIỮ NGUYÊN. Bấm «Lưu tạm» →
    popup **«Tổng tỷ lệ nhiệm vụ khác 100%»** nêu đúng tên công việc con và «tổng 120% — vượt 100%»,
    với hai nút **Sửa lại** và **Vẫn lưu tạm**.
23. Bấm **Sửa lại** → popup đóng, KHÔNG lưu, ở lại form để sửa. Bấm **Vẫn lưu tạm** → lưu thành công dù tổng ≠100.
24. Thử tương tự với **«Gửi đi phê duyệt»** (nút là «Vẫn gửi đi») và với **«Lưu và phê duyệt»** của người duyệt
    (nút là «Vẫn lưu và phê duyệt»). Chọn «Sửa lại» thì KHÔNG được duyệt.
25. Tỷ lệ của **công việc cấp1** (đầu mục lớn) không bị đợt này đổi — kiểm một công việc cũ vẫn giữ tỷ lệ cũ.

**E. Lưu tạm công việc cha rồi sang màn chi tiết**

26. Tạo công việc cấp1 → bấm **«Lưu tạm» MỘT LẦN**: modal chi tiết phải mở ra **CÓ ĐỦ dữ liệu** (tên, mô tả, ngày,
    phân công) và **CÓ nút thêm công việc con / nhiệm vụ**. KHÔNG được ra trang trắng.
    (Lỗi cũ: lần bấm đầu bị bỏ qua, phải bấm hai lần.)
27. Thêm ngay công việc con từ màn đó → lưu được, cây hiện đúng.

**F. Thông báo (toast) phải nổi trên cùng**

28. Mở một modal (tạo/sửa) rồi làm gì đó có thông báo ở góc dưới phải: toast phải **nhìn thấy đầy đủ, đè trên modal**,
    không bị lớp modal che. Kiểm cả khi đang mở modal chi tiết công việc và form nhiệm vụ.

**G. Người duyệt sửa rồi phê duyệt — và popup báo thay đổi cho người gửi**

29. Người gửi tạo/sửa đầu việc rồi **«Gửi đi phê duyệt»**.
30. Người duyệt mở **«Hàng chờ phê duyệt»** → «Xem chi tiết»: ngay trên màn chi tiết phải có
    **Chỉnh sửa thông tin** + **Phê duyệt** + **Trả để sửa lại** + **Từ chối**.
31. Bấm **«Chỉnh sửa thông tin»** → form sửa mở, chân form có **Lưu và phê duyệt** / **Trả để sửa lại** / **Từ chối**.
    Sửa vài trường (tên/mô tả/ngày/tỷ lệ) rồi bấm **«Lưu và phê duyệt»**: phải là MỘT thao tác, báo
    «Đã lưu và phê duyệt nội dung vừa sửa», đầu việc thành Đã duyệt với nội dung MỚI.
32. «Trả để sửa lại» và «Từ chối» **bắt buộc nhập lý do ≥10 ký tự**. Trả lại → cả cây về **Nháp**;
    Từ chối → xóa cả cây sau bước xác nhận (đúng luật cũ, không đổi).
33. Sang **phiên người gửi**, mở lại đầu việc đó: popup **«Nội dung đã được người duyệt chỉnh sửa»** liệt kê từng thay đổi
    dạng «nhãn: “cũ” → “mới”» kèm tên người sửa.
34. Bấm **OK** → popup đóng; mở lại đầu việc **vẫn hiện lại** popup đó.
35. Bấm **Đã biết** → mở lại **không còn** popup; đăng nhập bằng tài khoản đó trên **trình duyệt khác** cũng không nhắc lại
    (xác nhận lưu theo tài khoản ở máy chủ, không phải theo trình duyệt).
36. Người gửi mở lại chi tiết/form sửa phải thấy **dữ liệu MỚI từ máy chủ**, không phải bản cũ trong bộ nhớ phiên.
37. Kiểm **rollback**: thu hồi quyền duyệt của người duyệt (phiên admin) NGAY KHI form đang mở, rồi bấm «Lưu và phê duyệt»
    → phải bị từ chối, và nội dung sửa **KHÔNG được lưu nửa vời** (mở lại vẫn là bản cũ, trạng thái vẫn Chờ duyệt).

**Không để test tự động thay cho các bước trên.** Chuông thông báo, OnlyOffice, luồng duyệt cũ và lịch đẩy Zalo
vẫn phải chạy đúng như mục 9b.11–9b.14. **OK của các đợt trước KHÔNG áp dụng cho đợt này.**

**Hai điều biết trước để khỏi tưởng nhầm là lỗi mới (kiểm lúc 2026-09-09 20:5x trên UAT):**

- **OnlyOffice «sửa trực tuyến» hiện KHÔNG bấm được bằng dữ liệu đang có.** CSDL UAT có 6 bản
  `task_file_versions` thì **cả 6 đều là dòng seed** (`%seed%`: 2 `can-sua`, 2 `cho-lanh-dao`, 1 `cho-xem`,
  1 `da-duyet`), mà seed **chỉ tạo dòng CSDL, không tạo file thật** ⇒ launcher bước `[7/7]` báo
  «0 có file thật, 5 thiếu file». Đây là **thiết kế cũ, không phải hồi quy của đợt này**.
  Muốn nghiệm thu luồng editor + callback: **tự nộp một file `.docx` thật** ở một nhiệm vụ rồi mới bấm
  «Sửa trực tuyến». Cấu hình OnlyOffice thì vẫn đúng: `ONLYOFFICE_URL`/`_JWT_SECRET`/`_CALLBACK_BASE`
  đều có, Document Server `/healthcheck` = 200, callback = `http://host.docker.internal:3000`.
- **Máy chủ chạy `node --watch` nên PID cổng 3000 sẽ ĐỔI** mỗi lần có file trong `server/src` thay đổi
  (đợt này quan sát thấy 49216 → 33708). PID đổi **không** nghĩa là máy chủ sập; kiểm bằng
  `/readyz` = `{"ok":true,"db":"up"}` và đếm phiên trên `quanlycongviec_uat` qua `pg_stat_activity`
  (pool nối trễ, phải gọi `/readyz` TRƯỚC rồi mới đếm, không sẽ thấy 0 và kết luận sai).

### 9b.16 Trưởng/Phó phòng làm «Người thực hiện trực tiếp» (2026-09-09, đợt 2) — bấm để tự nghiệm

Đợt này **không có migration mới**, chỉ có mã. Vẫn phải **Ctrl+F5** một lần: buster + banner là
`20260909-5` (dòng `[7/7]` của `chay-test.bat` in `Ban app.js = 20260909-5`, Console in
`[QLCV] app.js 20260909-5`). **OK của đợt 1 (mục 9b.15) KHÔNG áp dụng cho đợt này** — hai đợt
nghiệm thu riêng.

Tám quyết định bạn đã chốt, mỗi nhóm dưới đây soi lại một phần:

**A. Ô gán người nay nhận thêm lãnh đạo phòng (quyết định 2 · 3 · 8)**

1. Đăng nhập `gd@test.local` → mở một công việc của **PH01** → «Thêm nhiệm vụ». Nhãn ô phải là
   **«Người thực hiện trực tiếp»** và có dấu sao đỏ (bắt buộc chọn) — không còn chữ «Cán bộ trực tiếp».
2. Mở danh sách thả xuống: phải có `nv1@`, `nv2@` (tên trơn), **`tp@` kèm «(Trưởng phòng)»** và
   **`pp@` kèm «(Phó phòng)»**. **KHÔNG** được có `pgd@` hay `gd@` — hai vai đó thuộc ô
   «Ban lãnh đạo phụ trách» ở ngay trên.
3. Chọn `tp@` → «Gửi đi duyệt» → đăng nhập `pgd@` duyệt → mở lại nhiệm vụ: ô vẫn hiện đúng người
   đó kèm «(Trưởng phòng)», không bị mất hay đổi sang người khác.
4. Đăng nhập `tp@test.local` → tạo nhiệm vụ mới: ô **KHÔNG điền sẵn tên chính mình** nữa (trước đây
   TP mở form là thấy tên mình được chọn sẵn), và trong danh sách có `pp@` — TP/PP cùng phòng gán
   được cho nhau.
5. Đăng nhập `nv1@test.local` → sửa nhiệm vụ của mình: ô vẫn **KHÓA** và vẫn đúng tên mình (không nới).

**B. Chặn tự duyệt — phần QUAN TRỌNG NHẤT của đợt này (quyết định 1 · 5 · 6)**

6. Dùng nhiệm vụ đã gán cho `tp@` ở bước 3. Đăng nhập `tp@` → **nộp một file `.docx` THẬT**
   (seed không có file thật — xem ghi chú ở mục 9b.0). Trạng thái nhóm phải là **«Chờ lãnh đạo»**,
   **KHÔNG** được là «Đã duyệt».
7. Đăng nhập `gd@` → Bảng phân quyền → đặt ô **«Tạo file kết quả» của Trưởng phòng = ✓ (cho phép)**
   → quay lại `tp@` nộp thêm bản mới: **vẫn «Chờ lãnh đạo»**. Đây là thay đổi CÓ CHỦ Ý: với TP/PP
   thì ✓ bị chặn trần, bản của họ luôn phải lên Phó GĐ — vì họ chính là cửa duyệt đầu tiên của phòng.
   (Cán bộ thì ✓ vẫn tự động «Đã duyệt» như cũ — mục 9b.11.)
8. `tp@` bấm **«Đẩy về Cán bộ»** trên nhóm của chính mình → được. Mở chuông thông báo của `pgd@`:
   phải có thông báo «…được trả về để sửa». Chuông của `tp@` **không** có thông báo đó (không tự báo mình).
9. `tp@` bấm **«Hoàn thành»** ngay sau đó → phải bị chặn với câu
   *«Bạn là người thực hiện (hoặc người đã nộp bản này) nên không được tự chốt kết quả của chính mình
   — hãy dùng «Trình Phó giám đốc»»*. Đây chính là đường vòng hai lần bấm mà bạn lo.
10. `pgd@` bấm **«Duyệt»** nhóm đó → «Đã duyệt», tiến độ nhiệm vụ lên 100% và cộng lên công việc cha.
11. **Đối chứng để chắc chắn không chặn oan:** lấy một nhiệm vụ của `nv1@`, để `nv1@` nộp file, rồi
    `tp@` bấm «Hoàn thành» → **VẪN ĐƯỢC**. Luật chỉ nhắm kết quả của chính mình.

**C. Nhãn và báo cáo (quyết định 4 · 7)**

12. Trang **Thống kê** → biểu đồ «Hiệu suất nhân sự»: `tp@` hiện thành **«… (Trưởng phòng)»** và đứng
    **SAU** tất cả cán bộ; số liệu của họ vẫn được tính như mọi người.
13. Trang **Gantt** → nhóm theo «Người thực hiện»: nhóm của `tp@` có tên kèm vai và xếp sau nhóm
    Cán bộ; nhóm «(chưa phân)» vẫn đứng CUỐI.
14. **Xuất Excel** → `tasks.xlsx`: cột thứ hai nay là **«Vai»**; dòng của `tp@` ghi «Trưởng phòng»,
    đứng sau các dòng Cán bộ, và «(chưa giao)» vẫn xuống cuối cùng. Tên ở cột 1 kèm «(Trưởng phòng)».
15. Mở **Nhật ký** của một nhiệm vụ từng đổi người thực hiện: tên cột nay ghi
    **«Người thực hiện trực tiếp»** (dòng cũ cũng đổi nhãn theo, vì nhãn dựng lúc hiển thị).
16. Popup «người duyệt đã thay đổi» (mục 9b.15 nhóm G): nếu người duyệt đổi người thực hiện thì nhãn
    trong popup cũng là «Người thực hiện trực tiếp».
17. Màn **chi tiết công việc / công việc con**: nhóm thứ ba của khối phân công nay ghi
    **«Người thực hiện»** (không còn «Cán bộ thực hiện»), tooltip Gantt cũng vậy.

**D. Phòng chưa có Phó Giám đốc phụ trách (quyết định 6) — kiểm bằng test tự động**

18. Bộ seed hiện có `pgd@` phụ trách **cả PH01 và PH02** nên không dựng sẵn ca này trên giao diện.
    Luật đã được kiểm bằng API thật trong **10 ca `TC-LDTT-A`** (`assignments.test.js`): phòng không
    có Phó GĐ ⇒ gán TP/PP bị chặn `400 ASSIGNEE_LEADER_NO_DEPUTY` và **không ghi dòng nào**, trong
    khi gán Cán bộ vẫn bình thường; **chuyển** cả công việc sang phòng chưa có Phó GĐ cũng bị chặn.
    Muốn bấm tay trên giao diện thì nói tôi dựng thêm một phòng không có Phó GĐ trên UAT.

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã. Chuông thông báo, OnlyOffice, luồng duyệt cũ, lịch đẩy Zalo và 37 bước của mục 9b.15
vẫn phải chạy đúng như trước.

### 9b.17 Kiểm V1–V8: kết quả file, editor và tích Gửi BLĐ (10/09/2026) — bấm để tự nghiệm

**Đợt nghiệm thu riêng, CHƯA có OK.** Không dùng OK ngày 08/09/2026 hoặc OK của một mục khác
để thay cho mục này. **9b.15 và 9b.16 cũng chưa được nghiệm thu.** Full tự động hiện
**1946/1946 test, 108/108 file, exit 0; lint exit 0**, nhưng chưa thay thế các thao tác dưới đây.

**Chuẩn bị an toàn**

- UAT PC hiện ở `http://127.0.0.1:8099`, CSDL `quanlycongviec_uat`, đã UP **024–027**.
  `readyz` phải có `ok:true, db:up`; Ctrl+F5, Console và asset phải cùng **20260910-7**.
- **Không chạy `/v14 /f`, `/reset`, `/seed` hoặc lựa chọn 2/4; không áp dụng phần reset ở mục 10
  cho đợt này.** UAT đã có dữ liệu người dùng, không được xóa để làm lại bài kiểm.
  Nếu mất kết nối, dừng và ghi lỗi; không tự kill tiến trình, restart container hay VPS.
- Tài khoản UAT: gd@, pgd@, tp@, pp@, nv1@, nv2@, nvb@ (đuôi `test.local`), mật khẩu seed
  `Test@12345` nếu chưa đổi. Dùng **hai profile trình duyệt độc lập**, không hai tab chung cookie
  để giả làm hai người. Không đổi mật khẩu/khóa phòng/ghi đè quyền mà chưa ghi lại cấu hình gốc.
- Chỉ tạo đầu việc và file mới có tiền tố **“TEST 9b17”**. Ghi lại mã thật do hệ thống sinh.
  Không sửa file người dùng đã nộp, đặc biệt CV002-005/bản 14 chỉ đã được dùng để xem bố cục.
- Quy ước dưới đây: **TẮT** = nhiệm vụ của nv1, lãnh đạo TP, không tích Gửi BLĐ;
  **BẬT** = nhiệm vụ của nv1, lãnh đạo TP, có tích, supervisor PGĐ; **TP-TT** = TP thực hiện,
  **PP-TT** = PP thực hiện. Tất cả thuộc PH01. Admin tạo công việc riêng, chọn BLĐ PGĐ và TP/PP.
- Chuẩn bị Word/Excel/PPT/PDF hợp lệ, ảnh nhỏ và báo cáo chữ. Seed chỉ có dòng CSDL, không thay
  cho file vật lý thật. Mốc % dưới đây dùng mặc định 0/20/40/50/80/100; nếu admin đã đổi thì
  ghi mốc hiện hành và tính lại, không âm thầm sửa cấu hình của người dùng.

**Cách ghi:** sau mỗi bước đánh dấu **ĐẠT / KHÔNG ĐẠT / KHÔNG KIỂM ĐƯỢC**.
Nếu sai, ghi **số bước + tài khoản + mã nhiệm vụ/nhóm/bản + thông báo nguyên văn**, không chỉ “HTTP 400”.
Mọi kết quả dưới đây là **kỳ vọng để bấm**, không phải tuyên bố đã nghiệm thu.

**A. V1 — sửa công việc con và thông báo lỗi**

1. `tp@` tạo **công việc con cấp 2**, tên “TEST 9b17 cấp 2”, chọn lãnh đạo TP rồi **Lưu tạm**.
   Mở sửa, chọn thêm PP cùng TP → Cập nhật. Phải lưu được cả hai, không hiện HTTP 400 từ tải file.
2. Mở lại cấp 2: cả TP và PP còn được chọn; không có bảng file dành cho nhiệm vụ cấp 3.
   Đối chứng cấp 3 chỉ chọn một lãnh đạo phụ trách, không thể dùng UI chọn hai người.
3. Khi bước kiểm định dạng/quyền bên dưới bị máy chủ từ chối, phải thấy câu lỗi tiếng Việt có nghĩa,
   không chỉ “Không tải được dữ liệu từ máy chủ: HTTP 400”. Ghi nguyên văn để đối chiếu nếu khác.

**B. V3/V4/V8 — lưu riêng, gửi riêng, đúng người nhận**

4. `gd@` tạo nhiệm vụ **TẮT**, giao nv1, lãnh đạo TP; xác nhận phần file có tích Gửi BLĐ rõ ràng,
   mặc định **không tích**. Mở lại phải giữ lựa chọn này.
5. `nv1@` khai nhóm **Word**, tải PDF vào nhóm đó: bị chặn ngay khi chọn, câu nêu nhóm Word chỉ
   nhận .doc/.docx. Số phiên bản không tăng. Tải Word hợp lệ vào cùng nhóm → thành công.
6. Bản Word vừa tải ở bước 5 phải **Lưu tạm**, tiến độ nhóm **0%**, chưa có thông báo gửi lãnh đạo.
   Trong Hàng chờ, người tạo nhóm và admin thấy nháp; TP/PP/PGĐ không thấy nháp này.
7. `nv1@` ở modal TẮT → Hành động → **Gửi đi duyệt**. Với quyền tạo file mặc định ⏳,
   trạng thái **Chờ TP/PP xem**, nhóm **50%**. Không tải một bản thứ hai chỉ để gửi.
8. `tp@` mở chuông và Hàng chờ: có nhóm vừa gửi. `pgd@` không nhận thông báo gửi trực tiếp và không
   thấy nhóm ở hàng chờ BLĐ. Câu tình trạng phải khớp người đang chờ duyệt; ghi lại tên thật người bấm gửi.
9. Tạo nhóm mới khác dưới TẮT, để `tp@` tải Word rồi bấm Gửi đi duyệt hộ nv1.
   Nhóm này phải **Chờ lãnh đạo (50%)**, chuông/hàng chờ PGĐ có, nhãn nói chờ PGĐ/GĐ.
   Đây là đối chứng V8: người thực hiện là nv1 nhưng **TP là người lưu bản cuối**, không gọi là lỗi NV gửi thẳng.
10. `tp@` Hoàn thành **nhóm nv1 gửi ở bước 7**, không phải nhóm TP gửi hộ: được chốt 100%.
    Nhóm TP gửi hộ ở bước 9 đang **«Chờ lãnh đạo»**, nên TP **không còn nút chốt nào ở đó** — chỉ còn
    «Đẩy về Cán bộ»; người chốt là PGĐ/GĐ. **LÝ DO ĐÃ ĐỔI** (ĐỢT B, xem mục **J** của 9b.23): van chống
    tự duyệt nay **không còn** canh «ai là người lưu bản cuối», nên việc TP vừa lưu bản ở bước 9 **một
    mình nó không còn làm mất nút «Hoàn thành / Duyệt»** nữa. Nút đó chỉ mất khi nhiệm vụ **bật tích**
    hoặc **TP/PP chính là người thực hiện** (Q5).

**C. V2 — tỷ lệ file và các mốc tiến độ**

11. Trong TẮT, tạo hai nhóm mới/hoặc dùng nhiệm vụ test riêng chỉ có hai nhóm: mặc định tỷ lệ chia
    đều **50%/50%**. Khai trước một nhóm chưa có bản → tiến độ nhóm đó 0%, không tính thành đã nộp.
12. Làm nhóm A Hoàn thành 100%; nhóm B được yêu cầu sửa 20%. Với tỷ lệ 50/50, tiến độ nhiệm vụ
    phải **60%**. Số bản v1/v2 của cùng nhóm không làm tăng số nhóm hoặc tự chia lại tỷ lệ.
13. Sửa tỷ lệ A thành **70%**, giữ B **50%**. Giao diện cảnh báo tổng **120%**, có “Sửa lại” và
    “Vẫn lưu”. Bấm Sửa lại: chưa ghi. Thực hiện lại và bấm Vẫn lưu: giữ 70/50, nhiệm vụ **67%**
    (làm tròn (70×100+50×20)/120), không chia cứng cho 100.
14. Mở lại modal, Gantt và thống kê/cây liên quan: tỷ lệ đã lưu còn nguyên, tiến độ cùng nguồn.
    Không lấy ô completion nhập tay cũ hoặc đếm nhị phân 1/2 để thay cho 67%.
15. `gd@` → Quản lý tài khoản → Phân quyền hệ thống: có đủ **8 mốc**. Ghi lại cấu hình gốc;
    đổi “Cần sửa” từ 20 lên **25** và lưu. Request đọc tiếp theo phải tính nhóm cần sửa là 25%,
    không restart hoặc đăng nhập lại. Người thường đọc được nhưng không có nút ghi.
16. Thử mốc âm, trên 100, bỏ trống, hoặc “Cần sửa” lớn hơn mốc tiếp theo: không được ghi,
    lỗi nói rõ số/mốc sai. Khôi phục đúng cấu hình gốc bằng admin sau khi ghi kết quả thử.

**D. V3 — các loại file và bản lịch sử**

17. Khai các nhóm Excel/PPT/PDF/Ảnh; thử lần lượt tệp đúng đuôi và sai nhóm.
    Chỉ nhận Excel .xls/.xlsx, PPT .ppt/.pptx, PDF .pdf; Ảnh .jpg/.jpeg/.png/.gif/.webp.
    .zip và .svg không được tự gán thành Word hoặc nhận vào nhóm Ảnh.
18. Nhóm **Báo cáo** chỉ nhập chữ; không tải file vật lý vào nhóm này. Lưu báo cáo mới → Lưu tạm,
    gửi riêng → đúng luồng như file, trừ trường hợp đang đáp ứng lệnh sửa.
19. Word/Excel/PPT đúng định dạng có Sửa trực tuyến khi DS sẵn sàng. PDF chỉ xem; ảnh/báo cáo
    không mở editor Office. Bản lịch sử sai định dạng nếu có vẫn xem/tải; thử tải **bản mới sai**
    phải bị chặn. Không có dòng lịch sử đối chứng thì ghi KHÔNG KIỂM ĐƯỢC, không tự sửa CSDL.

**E. V5 và Q5 — trả lại đúng người, TP/PP trực tiếp vẫn sửa được**

20. `tp@` yêu cầu sửa nhóm của nv1, nhập ý kiến. Modal và hàng chờ phải cùng ghi
    **“Bị trả lại lần 1 — đang đợi <họ tên nv1> sửa và nộp bản mới”**, không “Cán bộ” chung chung.
21. `nv1@` tải bản đáp ứng lệnh sửa: đi thẳng theo lệnh, **không trở lại Lưu tạm** và không cần
    gửi thêm lần nữa. Yêu cầu sửa lại một vòng: cả hai nơi phải hiện lần 2.
22. `gd@` tạo **TP-TT**, người thực hiện TP, lãnh đạo phụ trách PP; tạo **PP-TT** với PP thực hiện,
    lãnh đạo TP. Hai ô có vai rõ ràng; tích Gửi BLĐ bị khóa vì TP/PP luôn lên PGĐ.
23. Lần lượt TP/PP tải rồi gửi kết quả của mình: đều Chờ lãnh đạo 50%, kể cả admin cấp
    `file:create=✓`. Chỉ tải chưa gửi thì vẫn Lưu tạm, không tự lên PGĐ.
24. `pgd@` trả về người thực hiện để sửa. Với cả TP-TT và PP-TT, câu kể nêu đúng họ tên kèm
    “(Trưởng phòng)/(Phó phòng)”; người đó có nút sửa/nộp theo lệnh dù khác lãnh đạo phụ trách.
25. TP/PP đáp ứng lệnh sửa → đi đúng luồng, không được tự Hoàn thành. Đối chứng nv1 nộp và TP
    Hoàn thành ở bước 10 vẫn phải được, tránh chặn oan người duyệt độc lập.

**F. V6 — OnlyOffice thật, không duyệt nhầm bản chưa lưu**

26. Dùng **file test riêng**, không bản nghiệp vụ. Mở Sửa trực tuyến khi là người gửi/nhận lệnh sửa:
    thanh hành động và khối Ghi ý kiến nằm trên editor, toàn bộ toolbar Office không bị che.
27. Mở editor của file cần duyệt bằng đúng người duyệt. Ô **Ghi ý kiến nhập được**; có nút
    **Phê duyệt bản mới vừa chỉnh sửa** nếu trạng thái/quyền cho phép. Thu nhỏ chiều cao cửa sổ
    để kiểm editor co giãn, không đẩy toolbar xuống dưới một lớp nổi.
28. Với TP/PP đang được kiểm và trình kết quả của NV: sửa một câu trong tài liệu test, nhập ý kiến
    ít nhất 10 ký tự, bấm nút phê duyệt bản mới. Giao diện phải nói **lưu bản mới rồi trình PGĐ**,
    không tự Hoàn thành. Bản mới tăng số, người lưu là TP/PP, nhóm vào Chờ lãnh đạo.
29. `pgd@` mở bản cần chốt, sửa tài liệu test, nhập ý kiến rồi bấm nút phê duyệt bản mới.
    Chỉ khi DS trả bản đã lưu xong mới duyệt; lịch sử phải gắn quyết định với **đúng bản mới**, không v cũ.
30. Bấm nút hai lần nhanh: không tạo hai quyết định hoặc hai lượt lưu do bấm đôi.
    Khi đang xử lý, nút/ý kiến bị khóa; lỗi thì mở lại để thử, không ghi thành công giả.
31. Mở editor mà **không sửa tài liệu**, thử nút phê duyệt bản mới. Nếu DS báo không có thay đổi
    hoặc chưa có receipt, không được ký bản cũ dưới tên “bản mới”; phải có câu giải thích.
32. Với hai phiên riêng: mở editor trước, admin thu hồi quyền ghi/duyệt rồi thử nút đang mở.
    Request ghi/verdict phải bị chặn; khôi phục đúng quyền gốc sau test. Nếu không thử được DS lỗi
    hoặc bản khác chen vào, ghi KHÔNG KIỂM ĐƯỢC; không ngắt container/khóa tài khoản để ép lỗi.

**G. V7 — bật/tắt tích, đúng supervisor, hoãn hiệu lực**

33. `gd@` tạo **BẬT**, người thực hiện nv1, lãnh đạo TP, BLĐ PGĐ. Tạo một nhiệm vụ khác ngay dưới
    cấp 2 đã có PGĐ, bật tích nhưng **không thêm ô người mới**: kế thừa BLĐ của cấp 2.
34. `nv1@` lưu rồi gửi kết quả BẬT: Chờ TP/PP xem **40%**, kể cả nếu NV có `file:create=✓`.
    Không tự Đã duyệt và chưa lên hàng chờ PGĐ.
35. `tp@` không có đường Hoàn thành để kết thúc file BẬT; kiểm rồi **Trình PGĐ** → **80%**,
    chỉ đúng supervisor nhận thông báo và thấy hàng chờ. `pgd@` Duyệt → **100%**.
36. `nv1@` sửa nhiệm vụ đã tạo: tích bị khóa, Cập nhật trường khác không gửi lại tích như một lần đổi.
    Mở quyền gui-bld của NV cũng không cho NV đổi sau tạo (luật bất biến, server kiểm lại).
37. `tp@`/`pp@` đổi tích của TẮT → Cập nhật: thông báo **đã trình, giá trị chưa đổi**.
    Mở lại nhiệm vụ vẫn tắt; PGĐ thấy dòng **đề nghị đổi Gửi BLĐ**, không phải duyệt tạo/xóa cây.
38. `pgd@` bấm **Duyệt đổi tích**: lúc này nhiệm vụ mới bật. Thử đề nghị đổi tiếp; PGĐ nhập lý do
    ≥10 ký tự rồi **Từ chối đổi tích**: giữ giá trị cũ và **nhiệm vụ không bị xóa**.
39. Đang có đề nghị chưa xử lý mà bấm đề nghị khác: báo đã có lượt chờ, không thêm hàng chờ trùng.
    Duyệt hai lần: lần sau báo đã xử lý, không nhân đôi thông báo.
40. Thử bật tích khi không có BLĐ phụ trách ở một đầu việc test phù hợp: chặn lúc tạo/lưu,
    câu rõ “chưa có Ban lãnh đạo phụ trách để gửi phê duyệt”, không đợi đến khi nộp file mới lỗi.
    Nhiệm vụ con đang bật thì không cho bỏ BLĐ ở cấp 2 cha.
41. Nhiệm vụ đang bật mà đổi người thực hiện sang TP/PP: phải tắt và duyệt tắt trước (nếu cần),
    không âm thầm bỏ tích. Làm trên nhiệm vụ test, giữ nguyên phân công nghiệp vụ thật.

**H. Q2/phân quyền — hiệu lực request kế tiếp, không ghi đè từ form cũ**

42. `gd@` ghi lại Q2 gốc, bỏ chọn **“TP/PP đổi tích Gửi BLĐ phải trình Phó Giám đốc duyệt”**,
    lưu cấu hình. TP với gui-bld=✓ đổi tích trên nhiệm vụ test khác: có hiệu lực ngay.
    Đề nghị đã tạo trước khi bỏ Q2 vẫn phải xử lý riêng, không tự áp.
43. Đặt gui-bld của TP=⏳: dù Q2 đang tắt, đổi tích vẫn phải trình. Đặt ✕: chặn lần cập nhật kế.
    Ở bảng quyền, gui-bld phải có đủ ✓/⏳/✕; không coi ⏳ là cho phép toàn phần.
44. Hai phiên độc lập: TP để form mở, admin thu hồi quyền rồi TP bấm Cập nhật.
    Nút cập nhật trong khoảng 15 giây khi tab hiển thị/quay lại tab; dù nút chưa kịp đổi, server vẫn chặn ghi.
45. Hai phiên admin mở cùng cấu hình. Phiên A đổi Q2 và lưu; phiên B chỉ đổi một mốc % rồi lưu.
    Q2 của A phải còn, không bị checkbox cũ của B ghi đè. Bấm lưu khi không sửa gì: thông báo không có
    thay đổi, không gửi một request ghi rỗng. Khôi phục các mốc và Q2 gốc sau khi thử.
46. Kiểm quyền **Gửi đi duyệt (file nhiệm vụ)** tách khỏi Lưu kết quả: ✕ thì bản đã lưu không gửi được;
    ⏳ thì phải qua duyệt ngay cả khi quyền lưu NV=✓; TP/PP luôn không tự chốt. Khôi phục quyền gốc.

**I. Ca không có sẵn trong seed / chốt kết quả**

47. Seed PH01/PH02 đều có PGĐ nên **không có phòng thiếu PGĐ** cho ca TP/PP trực tiếp.
    Không tự bỏ quản lý phòng đang có; ghi KHÔNG KIỂM ĐƯỢC nếu chưa dựng fixture riêng.
    Đối chứng tự động `TC-LDTT-A` và `TC-V7-02/06/07` không thay cho ký nghiệm thu bằng tay.
48. Seed chỉ có một PGĐ. Ca PGĐ khác không đúng supervisor/ngoài phòng, PGĐ tự đề nghị với ⏳,
    actor bị vô hiệu hóa, phân công thay đổi giữa lúc chờ, hoặc duyệt cây không tác động đề nghị:
    đã có `TC-V7-09..15`. Không dựng đủ người/tình huống thì ghi KHÔNG KIỂM ĐƯỢC; không sửa seed.
49. Nếu vẫn thấy lỗi V8, ghi mã nhiệm vụ + nhóm + bản + ai thực sự lưu/gửi. Đối chiếu **trạng thái
    CSDL → người nhận thông báo → hàng chờ PGĐ/TP → nhãn**; TP nộp hộ không phải NV tự gửi.
    Chưa đủ bằng chứng thì không kết luận định tuyến sai hoặc sửa quyền để che triệu chứng.
50. Ghi kết quả từng bước, khôi phục đúng quyền/cấu hình test đã ghi ở đầu buổi; **không xóa dữ liệu
    hoặc chạy seed để dọn**. Mục nào sai/không kiểm được báo rõ; chỉ nói **“OK RIÊNG ĐỢT NÀY”**
    khi bạn thực sự chấp nhận đợt V1–V8. Không tự động commit/push/deploy từ việc test xanh.

**Đối chứng đã có trước buổi nghiệm thu:** kiểm tự động xanh; readyz và asset live xanh;
gd@/tp@ đã mở tài liệu thật ở editor, ý kiến không che toolbar, admin nhập được.
**Chưa có xác nhận** cho cả 50 bước hoặc chuỗi lưu/duyệt DS thật. Xem `docs/BAO-CAO-V1-V8.md`
để phân biệt bằng chứng tự động, kiểm trực quan giới hạn và các bước còn thiếu của Phần A.

### 9b.18 Hoàn thành theo duyệt kết quả, bỏ trạng thái tay và hiển thị từng file (10/09/2026)

**Đợt bổ sung bốn yêu cầu mới, CHƯA nghiệm thu.** Bản hiện tại **20260910-10** thay cho
mốc 20260910-7 ghi trong checklist 9b.17; giữ mốc cũ để tra lịch sử, không hạ phiên bản.
Không reset/seed, không sửa/xóa file thật để thử. Khi cần thử ghi, dùng đầu việc mới có tiền tố
**TEST 9b18**, ghi lại mã; giữ quyền và luồng phê duyệt V1–V8, không tự thay cấu hình gốc.

Sau mỗi bước ghi **ĐẠT / KHÔNG ĐẠT / KHÔNG KIỂM ĐƯỢC**, kèm tài khoản + mã nhiệm vụ/nhóm +
thông báo nguyên văn khi có lỗi. Các bước bên dưới là kỳ vọng nghiệm thu, không phải kết quả đã ký.

1. Ctrl+F5 tại UAT 8099; kiểm banner/cache buster **20260910-10**. Vào Công việc và Nhiệm vụ:
   không còn bộ lọc hoặc ô chọn Chưa bắt đầu / Đang thực hiện / Hoàn thành / Tạm dừng.
2. Với tài khoản có quyền, mở form tạo và sửa cả công việc cha, công việc con, nhiệm vụ:
   không có trường **Trạng thái** nhập tay. Không được bỏ nhãn **Trạng thái duyệt** của luồng duyệt.
3. Tab Nhiệm vụ: không còn checkbox **Hoàn thành nhiệm vụ**, không còn cột **Link kết quả**.
   Bảng có 8 cột, từng nhóm file hiện thành hàng con dưới đúng nhiệm vụ.
4. Nhiệm vụ không khai kết quả hiện **Chưa khai file kết quả**, tiến độ 0, chưa hoàn thành.
   Nhóm đã khai nhưng chưa có bản phải hiện **Chưa có bản**, không tự thành hoàn thành.
5. Mở nhiệm vụ có file: bảng 10 cột; **Tỷ lệ công việc (%)** và **Tiến độ** là hai cột riêng,
   không nằm dưới tên file. Ô tỷ lệ đọc đủ số; màn hẹp kéo ngang để xem các cột còn lại.
6. Bung ▸ lịch sử: hàng nhóm, hàng bản đều thẳng 10 cột. Tỷ lệ/tiến độ thuộc NHÓM, không cộng
   thêm lần nữa từ từng phiên bản; khung ý kiến/báo cáo trải đúng chiều ngang bảng.
7. Khai hai nhóm A/B trong nhiệm vụ TEST 9b18, đặt tỷ lệ 30/70. Nộp/gửi A, để B chưa duyệt:
   nhiệm vụ vẫn **Chưa duyệt đủ kết quả**; tổng tiến độ dùng (30 × %A + 70 × %B) / 100.
8. Người có quyền duyệt A đến trạng thái cuối, B vẫn chưa duyệt: nhiệm vụ chưa hoàn thành.
   Duyệt B đến trạng thái cuối: nhiệm vụ thành **Đã duyệt đủ kết quả**, không cần tích thủ công.
9. Khai thêm nhóm C trong chính nhiệm vụ test đã hoàn thành: phải trở lại chưa hoàn thành,
   kể cả C có tỷ lệ 0 hoặc chưa có bản. Hoàn thành không được suy từ phần trăm làm tròn 100.
10. Công việc con/cha chỉ hoàn thành khi có nhiệm vụ/đầu mục và tất cả đã hoàn thành;
    một nhiệm vụ con tỷ lệ 0 chưa duyệt đủ vẫn ngăn cha hoàn thành.
11. Sau khai/nộp/gửi/duyệt/lưu tỷ lệ, đóng modal: hàng file và bộ đếm cập nhật, không phải F5.
    Tìm theo tên file phải giữ cả nhiệm vụ và các hàng kết quả của nhiệm vụ đó.
12. So tiến độ cùng công việc ở thẻ Công việc, modal chi tiết, danh sách mở từ số Tổng quan và Gantt:
    cùng phạm vi dữ liệu phải cùng công thức gia quyền, không cộng cấp 2 và cấp 3 hai lần.
13. Ô ngày nhập tay mang tên **Ngày báo cáo**; thay ngày này không đổi việc đã hoàn thành hay chưa.
    Ngày hoàn thành trong thống kê lấy lần duyệt kết quả của bản mới nhất, không ngày nhập tay.
14. Kiểm Tổng quan/Gantt/xuất Excel: nhãn duyệt đủ/chưa đủ và quá hạn theo file, không theo status cũ.
    Nhật ký cũ vẫn đọc được với nhãn **Trạng thái cũ (lịch sử)**, không xóa dữ liệu quá khứ.
15. Giữ nguyên các đối chứng 9b.17: nháp không vào hàng chờ lãnh đạo; TP/PP không tự chốt file mình;
    Gửi BLĐ/Q2/Q3 và quyền hiện hành vẫn áp dụng. Chỉ nói **OK RIÊNG ĐỢT NÀY** khi đã nghiệm thu.

### 9b.19 Thiết kế lại tab Nhiệm vụ + popup nhật ký file (2026-09-10, đợt 3) — bấm để tự nghiệm

Đợt này **không có migration mới**, chỉ có mã (`app.js`, `app.css`) và **hai trường đọc thêm** trong
câu truy vấn metadata file (`so_ban`, `ten_nguoi_nop`) ở `server/src/modules/taskFiles/repo.js`.

> **⚠ BẮT BUỘC KHỞI ĐỘNG LẠI NODE TRƯỚC KHI TEST — F5 KHÔNG ĐỦ.** Hai trường `so_ban` và
> `ten_nguoi_nop` là mã **PHÍA MÁY CHỦ**. Tiến trình Node đang chạy (PID **35656**, bật **17:59:42** ngày
> 10/09/2026) đã nạp bản **cũ** vào bộ nhớ trước khi file đó được sửa (**21:00:48**), nên API của nó
> chưa trả hai trường này: cột **«Số bản» sẽ hiện 0** và hàng file **thiếu tên người nộp** dù giao diện
> đã đúng. Làm đúng thứ tự: **(1)** đóng đúng cửa sổ **«QLCV TEST - Node»** đang giữ cổng 3000 →
> **(2)** chạy lại **`chay-test.bat /giu /f`** (giữ nguyên dữ liệu UAT; `/f` chỉ bỏ các lệnh `pause`,
> script **cố ý không tự diệt tiến trình** — xem chú thích ở dòng 227 của `chay-test.bat`) →
> **(3)** đợi dòng `[7/7]` in `Ban app.js = 20260910-11` → **(4)** mới mở `http://127.0.0.1:8099`.
> Nginx 8099 (PID 26812) và container CSDL **giữ nguyên**, không restart.

Vẫn phải **Ctrl+F5** một lần để lấy JS/CSS mới: buster + banner
là `20260910-11` (dòng `[7/7]` của `chay-test.bat` in `Ban app.js = 20260910-11`, Console in
`[QLCV] app.js 20260910-11`; `api-bridge.js` vẫn giữ `20260825` vì file đó không đổi).
**OK của 9b.15/9b.16/9b.17/9b.18 KHÔNG áp dụng cho đợt này.**

**A. Nhiệm vụ trực thuộc công việc cha phải hiện ra (lỗi bạn báo)**

1. Đăng nhập `gd@test.local` → tab **Nhiệm vụ**. Ô **Tháng phải đang là «Tất cả tháng»** ngay khi
   vừa vào, không phải tháng hiện tại. Đây là nguyên nhân gốc: trước đợt này tab mặc định lọc
   THÁNG NÀY, mà ba nhiệm vụ trực thuộc `CV002` (`CV002-003/004/006`) có ngày **01/10 → 20/10/2026**
   nên bị lọc mất — không phải chúng không được vẽ.
2. Cuộn xuống công việc **CV002**: phải có khối **«Nhiệm vụ trực thuộc công việc»** (thư mục đỏ,
   gờ màu khác khối công việc con) chứa đúng ba nhiệm vụ đó, dù chúng **không có công việc con cha**.
3. Đối chứng bộ lọc vẫn sống: chọn Tháng = **9** → ba nhiệm vụ tháng 10 ấy **biến mất** (đúng),
   nhiệm vụ `CV001-002..006` vẫn còn. Chọn lại «Tất cả tháng» → cả hai nhóm đều hiện.
4. Tạo thêm một nhiệm vụ trực thuộc cấp 1 với ngày ở tháng sau → nó hiện ngay, không cần đổi bộ lọc.

**B. Bảng mười cột**

5. Tiêu đề cột phải **CĂN GIỮA ở cả mười cột**, và **cùng một cỡ chữ** cho cả tiêu đề lẫn nội dung
   (13px; tiêu đề 11px viết hoa). Mười cột theo thứ tự:
   `Nhiệm vụ / Kết quả · Người thực hiện · Ưu tiên · Tỷ lệ (%) · Tiến độ · Bắt đầu · Hạn chót ·
   Số bản · Tình trạng kết quả · Thao tác`.
6. Năm cột **Ưu tiên · Tỷ lệ (%) · Tiến độ · Bắt đầu · Hạn chót** phải HẸP hơn hẳn cột tên;
   **Số bản** hẹp nhất. Bảng có `min-width 1080px` nên cửa sổ hẹp sẽ **cuộn ngang**, không bóp chữ.
7. **Từng nhiệm vụ tách biệt**: mỗi hàng nhiệm vụ có **gờ đậm 2px** ở trên. **Từng file tách biệt**:
   hàng file nền **xám nhạt**, **thụt vào**, ngăn cách bằng **gạch đứt**.

**C. Dấu tích ẩn/hiện file kết quả**

8. Đầu mỗi hàng nhiệm vụ **có file** là một **dấu tích** (ô vuông nhỏ có ✓ xanh). Bấm → các hàng file
   của nhiệm vụ đó **ẩn đi**, dấu tích **mờ** lại; bấm lần nữa → hiện lại. Hàng nhiệm vụ **luôn hiện**.
   Nhiệm vụ **không có file** thì chỗ đó **trống**, không có tích (không có gì để ẩn).
9. **F5** → trạng thái gập được **nhớ** (localStorage khoá riêng `qlcv_tasks_files_hidden`, không dùng
   chung với khoá thu gọn khối `qlcv_tasks_collapsed`).
10. Đây là **nút**, KHÔNG phải checkbox — tab Nhiệm vụ đã bỏ checkbox «Hoàn thành» ở đợt 9b.18, đợt
    này phải giữ đúng cam kết đó. Kiểm bằng Console:
    `document.querySelectorAll('#tasks-grid input[type="checkbox"]').length` phải bằng **0**.
11. Bấm dấu tích **không được mở modal nhiệm vụ** (dòng nhiệm vụ vẫn bấm ra modal như cũ, nhưng bấm
    vào chính dấu tích thì chỉ gập/mở file).

**D. Tên file, số bản, tình trạng**

12. Tên file dài phải bị cắt thành **«…»** và **các tên thẳng hàng dọc** (cùng một bề rộng cột).
    **Di chuột** vào tên → tooltip hiện **tên đầy đủ nguyên văn**, không thêm tiền tố nào.
13. Cột **Số bản** là số bản của **nhóm kết quả đó**, không phải của nhiệm vụ. Hàng nhiệm vụ hiện
    **tổng** số bản của các nhóm. Nhóm khai trước chưa có bản thì Số bản = **0** và Tình trạng =
    **«Chưa nộp»**.
14. Cột **Tình trạng kết quả** phải nói đúng chỗ đang đứng, đủ sáu nhãn:
    **Lưu tạm** · **Chờ TP/PP xem** · **Cần sửa — nộp bản mới** · **Chờ Phó GĐ/Giám đốc** ·
    **Hoàn thành** · **Đã duyệt** — mỗi nhãn một màu riêng. Hàng nhiệm vụ ở cột này hiện
    «Đã duyệt đủ kết quả» / «Chưa duyệt đủ kết quả».
15. Dưới tên file có dòng phụ: **tên bản cuối · ai nộp bản đó**. Đây là hai trường máy chủ mới trả
    (`so_ban`, `ten_nguoi_nop`) — trước đợt này danh sách không có nên không hiện được.

**E. Popup nhật ký file (nút «Xem kết quả»)**

16. Bấm **«Xem kết quả»** trên một hàng file → mở **popup MỚI** (không mở modal nhiệm vụ như bản cũ).
    Popup phải có **bốn mục đúng thứ tự**:
    - **Tóm tắt**: năm nhãn Tình trạng · Định dạng · Tỷ lệ · Tiến độ · Số bản.
    - **1 · Ai đăng ký kết quả này**: tên người khai + thời điểm khai + tên khai báo + định dạng khai.
    - **2 · Ai thực hiện**: tên nhiệm vụ, **Người thực hiện trực tiếp**, **Lãnh đạo phòng phụ trách**.
    - **3 · Lịch sử các bản và ý kiến từng lần**: bản 1, «Bản 2 — sửa lần 1», … mỗi bản ghi **ai nộp
      lúc nào**, có nút **⬇ tải** (và **👁 xem** nếu mở được trong trình duyệt), kèm **ý kiến của đúng
      bản đó** — ý kiến bản 1 không được lẫn sang bản 2. Bản «Báo cáo» (chữ, không file) in nội dung
      ngay tại chỗ và **không** có nút tải/xem.
    - **4 · Diễn biến theo thời gian**: trục dọc, **CŨ trên MỚI dưới**, gộp cả **hành động** lẫn
      **góp ý** theo đúng thời điểm. Ví dụ phải ra thứ tự: *Nộp bản → Góp ý → Trả về Cán bộ* dù
      bảng luồng gốc trả về mới nhất trước.
17. Đóng popup bằng nút **«Đóng»**, bằng **phím Escape**, hoặc **bấm ra ngoài nền tối**. Cả ba cách
    đều phải đóng được.
18. Muốn thấy đủ bốn mục có nội dung: lấy nhiệm vụ đã **nộp ≥ 2 bản** và **có góp ý**. Bộ seed Vòng 14
    có sẵn nhóm như vậy ở `CV001-003` (NV-02) — nếu chưa đủ, nộp thêm bản rồi nhờ `tp@` góp ý.

**F. Tìm kiếm và đối chứng**

19. Gõ tên file vào ô **Tìm kiếm** của tab Nhiệm vụ → **hàng nhiệm vụ và các hàng kết quả của nó
    vẫn đi cùng nhau** (không hiện mỗi hàng file mồ côi).
20. Nhưng: nhiệm vụ đang **gập** file thì tìm kiếm **KHÔNG được tự mở lại** các hàng file đó —
    tôn trọng dấu tích người dùng vừa bấm.
21. Giữ nguyên các đối chứng 9b.15 → 9b.18: phân quyền động, nhiệm vụ trực thuộc cấp 1, khóa phòng,
    TP/PP làm người thực hiện trực tiếp, Luu tạm → Gửi đi duyệt, tỷ lệ file, chặn định dạng sai,
    hoàn thành theo duyệt kết quả. Chuông thông báo, OnlyOffice và lịch đẩy Zalo không đổi.

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã.

> **⚠ BA MỤC 9b.20 · 9b.21 · 9b.22 DƯỚI ĐÂY ĐƯỢC VIẾT BỔ SUNG NGÀY 11/09/2026.** `BAT-DAU-SESSION.md`
> và `KE-HOACH-DUYET-CAY.md` của ba đợt 4 · 5 · A đều trỏ người dùng tới «test PC theo mục 9b.20/21/22»
> nhưng **ba mục đó chưa từng được viết vào file này** — file dừng ở 9b.19. Nội dung dưới đây dựng lại
> từ chính các khối snapshot của từng đợt (mỗi khối ghi đủ thay đổi + số bước + nhóm chữ cái), nên số
> bước và tên nhóm khớp với chỗ trỏ cũ. **Cả ba đợt đều CHƯA có OK riêng**, nên viết bây giờ là điền vào
> chỗ trống chứ không phải viết lại lịch sử nghiệm thu.

### 9b.20 Mũi tên ▼/▲, cột «Tên file» riêng, màu theo tiến độ, gộp ý kiến (2026-09-10, đợt 4) — bấm để tự nghiệm

**CHỈ CÓ GIAO DIỆN** (`app.js`, `app.css`, `index.html`) — không đổi mã máy chủ, **không migration**.
**KHÔNG cần khởi động lại Node** nếu đã khởi động lại theo 9b.19; chỉ cần **Ctrl+F5** lấy buster
`20260910-12` (dòng `[7/7]` in `Ban app.js = 20260910-12`, Console in `[QLCV] app.js 20260910-12`).
Nếu **chưa** khởi động lại từ đợt 3 thì vẫn phải đóng cửa sổ «QLCV TEST - Node» rồi chạy
`chay-test.bat /giu /f`. Test tự động: **1979/1979 · 111 file · exit 0**.

**A. Bảng Nhiệm vụ nay MƯỜI MỘT cột**

1. Tiêu đề cột phải là **MƯỜI MỘT** cột, thêm cột RIÊNG **«Tên file»** so với 9b.19:
   `Nhiệm vụ / Kết quả · Tên file · Người thực hiện · Ưu tiên · Tỷ lệ (%) · Tiến độ · Bắt đầu ·
   Hạn chót · Số bản · Tình trạng kết quả · Thao tác`.
2. Ô đầu của **hàng file** nay chỉ còn **dấu nối └ + icon**, thụt vào ⇒ hàng file **LÙI VỀ PHẢI** so
   với tên nhiệm vụ, nhìn một cái biết ngay cấp bậc.
3. **Tên nhiệm vụ 15px, tên file 13px** — đúng «to hơn hai cỡ chữ». Ô «Người thực hiện» **không** bị
   phóng theo (class `.task-ten-chinh` còn dùng chung cho ô đó).
4. **«Người thực hiện» CĂN GIỮA** ở **cả hai loại hàng** (hàng nhiệm vụ và hàng file).
5. Bảng vẫn `min-width 1080px` ⇒ cửa sổ hẹp thì **cuộn ngang**, không bóp chữ.
6. Mỗi hàng nhiệm vụ có **gờ đậm 2px** ở trên; hàng file nền **xám nhạt**, ngăn cách bằng **gạch đứt**
   (giữ nguyên 9b.19 bước 7).

**B. Cột «Tên file» và màu theo tiến độ**

> **Bốn bước 7 · 8 · 11 · 12 ĐÃ BỊ 9b.21 THAY.** Mâu thuẫn thì làm theo 9b.21.

7. Cột «Tên file» hiện **tên khai** (`ten_ket_qua`) nếu có, không thì **tên file vật lý** (`ten_goc`) —
   đây là cách đặt tên của đợt 4 mà **9b.21 sửa lại**: tên khai phải về cột Nhiệm vụ.
8. Nhóm **chưa nộp bản nào** ⇒ ô đó trống, không hiện chữ gì.
9. Tên file dài phải bị cắt thành **«…»** và **các tên thẳng hàng dọc**; **di chuột** vào tên ⇒ tooltip
   hiện **tên đầy đủ nguyên văn**.
10. Cột **«Số bản»** là số bản của **nhóm kết quả đó**, không phải của nhiệm vụ; hàng nhiệm vụ hiện
    **tổng** (giữ nguyên 9b.19 bước 13).
11. **Màu chữ TÊN FILE theo TIẾN ĐỘ**, bốn bậc: **≥100 xanh lá · 50–99 xanh dương · 20–49 cam ·
    <20 đỏ**. **9b.21 dời màu này sang «Kết quả làm được»**, cột «Tên file» thành chữ xám đen.
12. Hai mốc **100%** và **«dưới 20%»** là do người dùng nêu; **hai bậc giữa (50–99 và 20–49) là tự chia**,
    đã nói rõ ở đây để khỏi tưởng là luật có sẵn.

**C. Mũi tên ▼/▲ thay dấu tích**

13. Nhiệm vụ **đang hiện file** ⇒ đầu hàng là nút **▲** (bấm để **ẨN**).
14. Nhiệm vụ **đang gập** ⇒ nút **▼** (bấm để **MỞ RỘNG**). Mũi tên chỉ **hành động kế tiếp**, không
    chỉ trạng thái hiện tại.
15. Đó vẫn là `<button aria-expanded>`, **KHÔNG phải checkbox**. Kiểm bằng Console:
    `document.querySelectorAll('#tasks-grid input[type="checkbox"]').length` phải bằng **0**
    (giữ cam kết của 9b.18/9b.19).
16. **F5** ⇒ trạng thái gập được **nhớ** (localStorage khoá riêng `qlcv_tasks_files_hidden`, không dùng
    chung với `qlcv_tasks_collapsed`). Nhiệm vụ **không có file** thì chỗ đó **trống**, không có mũi tên.

**D. Bốn thẻ thống kê về MỘT dòng**

17. Bốn thẻ **Tổng số · Đã duyệt đủ · Chưa duyệt đủ · Quá hạn** phải nằm **MỘT DÒNG** — kể cả khi thu
    cửa sổ xuống **dưới 768px** (bản cũ `grid-cols-2 md:grid-cols-4` nên hẹp là thành hai dòng).
18. Kiểm bằng DevTools: thẻ cha có `id="tasks-the-tong-ke"` và `grid-template-columns` là
    `repeat(4, minmax(0, 1fr))` — **`minmax(0, …)` chứ không phải `1fr` trần**, thiếu `minmax(0,…)` là
    chữ dài làm tràn thẻ.

**E. Popup nhật ký sau khi gộp hai mục**

19. Popup «Xem kết quả» **không còn** hai tiêu đề **«Ai đăng ký kết quả này»** và **«Ai thực hiện»**;
    hai mục đó **gộp thành bốn dòng** đúng dạng người dùng viết.
20. Dòng **«Lãnh đạo phòng phụ trách:»** phải **GIỮ NHÃN kể cả khi trống** (không ẩn cả dòng).
21. Chip **«Số bản»** nay hiện **đúng số** và khối **3** liệt kê được các bản. Trước đợt này popup đọc
    `nhom.ban` trong khi máy chủ trả `bans` ⇒ chip **luôn 0** và khối 3 **luôn** báo «Chưa có bản nào
    được tải lên». Đây là **sửa một lỗi thật của đợt 3**, không phải thay đổi thiết kế.

**F. «Ghi ý kiến» gộp hai nguồn**

> **Năm bước 22 → 26 ĐÃ BỊ 9b.21 THAY** (ô «Ghi ý kiến» thành chữ mở popup). Mâu thuẫn thì làm theo 9b.21.

22. Lý do người duyệt gõ khi **«Yêu cầu sửa» / «Trả về» / «Từ chối»** nay **HIỆN NGAY** ở cột
    **«Ghi ý kiến»** của dòng cha — trước đợt này nó chỉ nằm trong bảng «Lịch sử» phải bấm mới ra, vì
    `verdict()` chỉ ghi `task_file_flow` chứ không ghi `task_file_comments`.
23. Ý kiến sắp **CŨ → MỚI**, mỗi ý kiến mang **nhãn hành động** của lần đó.
24. Hành động **`gom-y`** **KHÔNG bị in hai lần** (hành động đó ghi cả hai bảng nên danh sách gộp phải
    loại nó ra).
25. Nút **«Xem ý kiến (N)»** vẫn còn, nhưng **N nay đếm theo danh sách gộp** nên **có thể lớn hơn trước**
    — đúng, không phải đếm sai.
26. Cùng một danh sách gộp dùng ở **BỐN nơi**: cột «Ghi ý kiến» của dòng cha, khung `buildYKienPanel`,
    dòng bản **1.1/1.2**, và **khối 3** của popup. Soi cả bốn chỗ phải ra **cùng một nội dung**.

**G. Bảng «Kết quả» trong modal cân đối lại**

27. Bảng nay có `<colgroup>` (`COT_BANG_KET_QUA`) + `table-layout: fixed` ⇒ **độ rộng cột cố định theo
    tỷ lệ phần trăm**, không còn phình theo nội dung. Tỷ lệ: thời gian **9** · định dạng **6** ·
    file **13** · **tỷ lệ 8** · **tiến độ 6** · người **8** · ý kiến **14** · tình trạng **11** ·
    hành động **6** (tổng **81%**) ⇒ cột tên (auto) còn **19%**. Trước đó hai cột chỉ chứa **MỘT CON SỐ**
    phình ra bằng cột chữ chỉ vì **TIÊU ĐỀ** dài.
28. Bảng đó vẫn **MƯỜI cột** nên mọi `colspan="10"` giữ nguyên. **Tiêu đề dài xuống dòng TRONG Ô**;
    ô **tỷ lệ xếp dọc** (input ở trên, nút «Lưu tỷ lệ» ở dưới).

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã.

### 9b.21 «Kết quả làm được» về cột Nhiệm vụ, «Ghi ý kiến» thành popup, căn giữa (2026-09-11, đợt 5) — bấm để tự nghiệm

**CHỈ CÓ GIAO DIỆN** — không đổi mã máy chủ, **không migration**. **KHÔNG cần khởi động lại Node**;
chỉ cần **Ctrl+F5** lấy buster `20260911-01`. Test tự động: **1984/1984 · 111 file · exit 0**
(+5 test mới `TCKQ-47..51`).

**A. «Kết quả làm được» về cột Nhiệm vụ, cột «Tên file» trả lại đúng nghĩa**

1. **Tên khai** («Kết quả làm được») nay nằm ở **CỘT NHIỆM VỤ**, **ngay cạnh icon `fa-file-lines`**
   trong cùng khung `.task-file-lui` — không còn ở cột «Tên file» như đợt 4.
2. Cột **«Tên file»** chỉ hiện **tên file VẬT LÝ** (`ten_ban_cuoi`).
3. Nhóm **chưa nộp bản nào** ⇒ cột «Tên file» ghi **«Chưa có bản»** (không để trống như đợt 4).
4. **Màu chữ theo TIẾN ĐỘ đi theo «Kết quả làm được»** — bốn bậc của đợt 4 giữ nguyên
   (**≥100 xanh lá · 50–99 xanh dương · 20–49 cam · <20 đỏ**).
5. Cột **«Tên file»** chữ **xám đen trung tính** — **không** tô màu cả hai chỗ (tô cả hai là rối mắt).
6. Tên dài vẫn phải cắt **«…»** đúng. Kiểm bằng DevTools trên `.task-file-lui .task-file-name`:
   `min-width` phải là **`0px`**. **Bẫy**: flex item mặc định `min-width: auto` nên
   `text-overflow: ellipsis` **KHÔNG BAO GIỜ CHẠY** — thiếu dòng pin này thì **mọi test khác vẫn xanh**
   trong khi bảng **vỡ trên dữ liệu thật**.

**B. Ô «GHI Ý KIẾN» thành chữ mở popup**

7. «Ghi ý kiến» nay là **một dòng CHỮ bấm để mở popup** (`moYKienKetQua(maNhiemVu, fileId, banId)`),
   **không còn** khung nội dung + ô nhập nằm tại chỗ trong bảng.
8. Bấm từ **dòng cha** (1., 2., 3.) ⇒ popup in **TẤT CẢ** ý kiến của nhóm.
9. Bấm từ **dòng bản 1.1 / 1.2** ⇒ popup in **ĐÚNG ý kiến của bản đó**, ý kiến bản 1 không lẫn sang bản 2.
10. Popup của **bản cũ** là **CHỈ ĐỌC** — **không có ô nhập**. Lý do: máy chủ chỉ cho ghi góp ý vào
    **BẢN MỚI NHẤT** (`guiYKien` POST theo `data-ban-cuoi`), để ô nhập ở bản cũ là mời người dùng viết
    vào một chỗ rồi chữ chạy sang bản khác.
11. Popup của **dòng cha** **CÓ** ô nhập + nút **«Gửi ý kiến»** (ô nhập dời THEO popup, tách
    `buildONhapYKien(n, ma)` ra khỏi `buildYKienPanel`).
12. Gửi **thành công** ⇒ popup **TỰ ĐÓNG** và ô nhập mất chữ. Gửi **thất bại** (ô còn chữ) ⇒ popup
    **GIỮ MỞ** để không mất chữ vừa gõ.
13. Khung **«Lịch sử»** giữ nguyên. Khung `task-kq-yk-*` bị bỏ nên `batTatKetQua(id,'yk')` nay là
    **phép không làm gì** — bấm không lỗi, không hiện gì, đúng như đã ghi chú trong mã.

**C. Căn giữa**

14. Tiêu đề **MỌI cột** của **bảng «Kết quả»** phải **căn giữa**, **kể cả «Hành động»** (đợt 4 còn
    `text-right`).
15. **«Người thực hiện»** căn giữa ở **cả dòng cha lẫn dòng bản**.
16. **Hai ô tỷ lệ / tiến độ của dòng bản** căn giữa.
17. **Bảng luồng trong khung «Lịch sử»** cũng căn giữa, cho nhất quán cùng trang.
    Class Tailwind `text-center` **có thật** trong bản vendor nhưng **vẫn phải ép thêm trong `app.css`**
    (`.bang-ket-qua thead th`, `.kq-o-nguoi`) — đúng bẫy về bản biên dịch sẵn của đợt 4.

**D. MỘT THAY ĐỔI HÀNH VI PHẢI BIẾT TRƯỚC KHI TEST**

18. Khi popup «Ghi ý kiến» **đang MỞ** ⇒ bấm verdict («Trả về» / «Từ chối» / «Duyệt») **tự đọc lý do**
    từ ô nhập trong popup, như cũ.
19. Kiểm bằng Console khi popup mở: `document.getElementById('task-y-kien-<id>')` **có thật**. Đóng popup
    rồi gọi lại ⇒ **`null`** (ô đó nay chỉ tồn tại trong popup).
20. Khi popup **đang ĐÓNG** ⇒ verdict **rơi xuống `prompt`** hỏi lý do. Đây là **hành vi dự phòng có sẵn
    từ trước**, **KHÔNG phải lỗi mới** — nói rõ để khỏi tưởng hỏng.
21. Muốn tránh `prompt`: **mở popup «Ghi ý kiến» trước** rồi mới bấm verdict.

**E. Đối chứng**

22. Giữ xanh lại **9b.15 → 9b.20**, **trừ bước 7/8/11/12 của 9b.20** và **các bước 22 → 26** đã bị đợt
    này thay — mâu thuẫn thì làm theo 9b.21. Chuông thông báo, OnlyOffice, lịch đẩy Zalo không đổi.

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã.

### 9b.22 «Ban lãnh đạo kiểm soát» BA CẤP thành mảng + gửi đúng người (2026-09-11, ĐỢT A) — bấm để tự nghiệm

**CÓ MIGRATION MỚI `028_supervisor_ids.sql` và CÓ đổi mã máy chủ.** Thiết kế đầy đủ + **sáu bẫy** ở
`docs/KE-HOACH-DUYET-CAY.md` **mục 10**. Test tự động: **1987/1987 · 111 file · exit 0**.

> **⚠ BẮT BUỘC chạy lại `chay-test.bat /giu /f` — Ctrl+F5 là KHÔNG ĐỦ.** Script tự `npm run migrate:up`
> (nhắm đúng `quanlycongviec_uat`) rồi mới bật Node. Đợi dòng `[7/7]` in `Ban app.js = 20260911-02`,
> Console in `[QLCV] app.js 20260911-02`. **Sao lưu UAT trước** — VPS đang ở `pgmigrations=021`.
> Nginx 8099 và container CSDL **giữ nguyên**, không restart.

**A. Migration 028 đã vào và đã tự điền**

1. Kiểm 028 đã chạy: `SELECT name FROM pgmigrations ORDER BY name DESC LIMIT 1` ⇒ **028**. Bảng
   `works` và `work_items` có cột `supervisor_ids` (mảng, `NOT NULL DEFAULT '{}'`), và **cột
   `supervisor_id` cũ ĐÃ BỊ XÓA**.
2. 028 **TỰ ĐỘNG ĐIỀN** theo đúng sáu bước R2: cấp 1 ← `ARRAY[supervisor_id]`; cấp 2 rỗng ← nguyên mảng
   của công việc cha; **cấp 3 rỗng ← phần tử ĐẦU của cấp 2 (Q12)**; cấp 3 không cha ← phần tử đầu của
   cấp 1; vẫn rỗng ← một `deputy_director` **đang hoạt động** của phòng; phòng không có ← một `admin`
   đang hoạt động; **vẫn không ai ⇒ để rỗng và `RAISE NOTICE` in từng dòng + tổng số**. Xem lại cửa sổ
   `chay-test.bat` để đọc các dòng NOTICE đó.
3. Kiểm luật «cấp 3 chỉ MỘT người»: `SELECT level, cardinality(supervisor_ids) FROM work_items
   WHERE level = 3 AND cardinality(supervisor_ids) > 1` ⇒ **0 dòng** (CHECK `task_supervisor_single`).

**B. Nhãn và ô chọn ở CẢ BA cấp**

4. Nhãn thống nhất **«Ban lãnh đạo kiểm soát»** ở **cả ba cấp** (trước đây cấp 1/cấp 2 ghi khác).
5. **Cấp 1 + cấp 2**: `<select>` một người **nay là NHÓM CHECKBOX** nhiều người
   (`#project-supervisors-box` / `#task-supervisors-box`) + hidden input, theo đúng khuôn ô `leaderIds`.
6. **Cấp 3**: **vẫn MỘT `<select>`** (`#task-supervisor-select`) — đúng luật «chọn ĐÚNG MỘT».
7. Cấp 3 **NAY ĐƯỢC chọn người riêng**. **Câu báo lỗi cũ «Nhiệm vụ dưới công việc con không có ô Ban
   lãnh đạo phụ trách» BỊ BỎ HẲN** — luật cấm đó chính là cái D2 lật. **Các bước 8 → 12 của 9b.15 bị
   đợt này thay**, mâu thuẫn thì làm theo đây.
8. **Chỉ MỘT ô được gửi lên** (form có HAI ô cùng `name="supervisorIds"`): mở DevTools → Network → bấm
   Lưu, payload phải có **đúng một** khoá `supervisorIds`. Chọn cấp 3 ⇒ nhóm checkbox cấp 2 **không có
   `name`**; chọn cấp 2 ⇒ `<select>` **`disabled`**. Cả hai cùng gửi thì `FormData` chỉ giữ **giá trị
   cuối** — của ô người dùng **không nhìn thấy**.

**C. Kế thừa và tập nguồn**

9. Tạo nhiệm vụ **cấp 3 không chọn ai** ⇒ máy tự lấy **người ĐẦU TIÊN của cấp 2**; không có cấp 2 thì
   của **cấp 1** (`resolvePhanCongKhiTao`, Q12).
10. Cấp 3 chọn người **NGOÀI tập của cấp 2** ⇒ **400 `SUPERVISOR_NOT_IN_SOURCE`** — kể cả khi người đó
    là `admin` hợp lệ theo VAI.
11. Cấp 3 chọn **HAI người** ⇒ **400** (đúng một).
12. **Cha chưa phân công ai** ⇒ ô của con **KHÔNG bị khoá cứng**: `nguonBanKiemSoat` trả **`null`**
    (không giới hạn) chứ **không phải tập rỗng**. Bắt con chọn trong «không ai» là khoá cứng cả cây
    không ai gỡ được.

**D. R1(a) — admin MẤT quyền duyệt mọi cây**

> **ĐÂY LÀ THAY ĐỔI HÀNH VI LỚN NHẤT CỦA ĐỢT NÀY.**

13. Đăng nhập **`gd@test.local`** (admin / Giám đốc), mở một cây mà admin **KHÔNG có tên** trong
    `supervisor_ids` ⇒ **không duyệt được**: **403 `NOT_APPROVER`**, cây **vẫn «Chờ duyệt»**.
14. **Đường gỡ tắc đã chốt**: admin vẫn **SỬA** được `supervisor_ids` (quyền `update`, **không phải**
    `approve`) — thêm chính mình vào danh sách ⇒ **duyệt được 200**. Đây là ca chốt cái van thoát hiểm
    (`approvals-api.test.js`).
15. Nhưng admin **KHÔNG tự duyệt thay** người khác: sửa danh sách xong thì **người trong danh sách**
    duyệt, hoặc admin duyệt **với tư cách người vừa được thêm vào**.
16. Đặt ghi đè **`task:approve = cho-phep`** cho **TP/PP** ở Bảng phân quyền ⇒ **VẪN 403**, không cho
    duyệt. **Đây là thiết kế, không phải lỗi**: ghi đè cấp **HÀNH ĐỘNG**, còn `supervisor_ids` là
    **PHẠM VI** ⇒ TP/PP **không bao giờ** duyệt được cây (TC-APR-22 đã đảo 200 → 403).
17. Dòng cũ có `supervisor_ids` **RỖNG** thì **KHÔNG bị bắt cổng** (van an toàn **một chiều** cho dòng
    đang «Chờ duyệt» từ trước 028). Nhưng **`submit` MỚI** mà rỗng ⇒ **409 `NO_APPROVER_ASSIGNED`**
    (`field: supervisorIds`) — «bắt buộc phải chọn thì mới được gửi đi duyệt».

**E. Gửi ĐÚNG người + thông báo**

18. Bấm **«Gửi duyệt»** ⇒ thông báo **chỉ tới những người CÓ TÊN trong `supervisor_ids` của đúng dòng
    đó**, **không còn** tới mọi Phó Giám đốc của phòng (`phongCua` + `phoGiamDocPhuTrach` **đã bị xoá**,
    thay bằng `banKiemSoatCua`). **Trước đợt này**: bấm «Trình Phó giám đốc» thì **cả phòng** nhận được
    còn **hàng chờ của đúng người kia thì không ai thấy** — đó là điểm bất hợp lý số 3 và số 4.
19. **Người vừa bấm KHÔNG nhận thông báo cho chính mình** (`banKiemSoatCua` lọc `actor`).
20. Cấp 2 tích **BẬT** «Gửi BLĐ phê duyệt» ⇒ **hai người được chọn đều nhận**; còn **file** đi tới
    `supervisor_hieu_luc` = `COALESCE(supervisor_ids[1], parent.supervisor_ids[1])` — **phần tử ĐẦU**.
21. **R7**: sửa một cây **ĐÃ duyệt** ⇒ nó **hạ về «Chờ duyệt»** và những người trong `supervisor_ids`
    nhận thông báo **«…vừa bị sửa và QUAY LẠI trạng thái chờ bạn duyệt (người sửa: …)»**. Cơ chế ghi đè
    `update = ⏳` **giữ nguyên** (Q9).

**F. Ủy quyền vẫn chạy**

22. Phó Giám đốc **có tên trong danh sách** đi vắng và **đã ủy quyền** ⇒ **người được ủy quyền duyệt
    được**: `tryDelegations` chạy **TRƯỚC** khi `deny('NOT_APPROVER')`.

**G. MỘT ngoại lệ có chủ ý — ĐỪNG «sửa» lại**

23. Chính supervisor **tự đề nghị** đổi tích «Gửi BLĐ phê duyệt» cho mình (`change_kind='gui-bld'`) ⇒
    **MỌI admin** nhận thông báo và **admin QUYẾT ĐỊNH ĐƯỢC**. Đây là **trục KHÁC** với duyệt cây, luật
    riêng từ 023; nếu để `NOT_APPROVER` gạt admin ở đây thì đề nghị đó **không ai xử lý được**. Helper
    `coTheQuyet(user,row)` trong `approvals/changes.js` chấp admin **chỉ khi** lý do từ chối đúng là
    `NOT_APPROVER` (TC-V7-10 + TC-V7-15 canh chỗ này).

**H. RPC KHÔNG đổi hình dạng phản hồi**

24. `[COL.P_SUP]` / `[COL.T_SUP]` vẫn là **MỘT chuỗi tên nối dấu phẩy** (đúng cái `tenTrongDanhSach`
    của `project-details.js` đang đợi). Kiểm ở bảng Gantt/xuất Excel: hai người ⇒ **«Tên A, Tên B»**.
25. `supervisorId` **vẫn còn** = **phần tử đầu**, và **THÊM** `supervisorIds` — thuần tuý bổ sung theo
    tiền lệ `leaderIds`.
26. **Trang đang mở từ trước khi tải bản mới** vẫn **lưu được**: `supervisorIdsFromLegacy` nhận **cả**
    `supervisorIds` (client mới) **lẫn** `supervisorId` (khoá cũ). Nhận khoá cũ là **CHỐNG MẤT DỮ LIỆU**,
    không phải chiều client. Test bằng cách mở tab trước, Ctrl+F5 ở tab khác, rồi quay lại tab cũ bấm Lưu.

**I. Đối chứng**

27. Giữ xanh lại **9b.15 → 9b.21**, **trừ các bước 8 → 12 của 9b.15** đã bị đợt này thay.
28. Hai view `v_countable_works` / `v_countable_items` bị **DROP rồi dựng lại** trong 028 ⇒ **Tổng quan ·
    Gantt · xuất Excel** phải ra **đúng số như cũ**. Chuông thông báo, OnlyOffice, lịch đẩy Zalo không đổi.

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã.

### 9b.23 ĐỢT B — «gộp hai trục» duyệt cây + duyệt file kết quả (2026-09-11) — bấm để tự nghiệm

**CÓ MIGRATION MỚI `029_dot_b_gop_hai_truc.sql` và CÓ đổi mã máy chủ + giao diện.** Thiết kế đầy đủ +
**mười bẫy** ở `docs/KE-HOACH-DUYET-CAY.md` **mục 11**. Test tự động: **2034/2034 · 113 file · exit 0**.

> **⚠ CÓ BẢN SỬA SAU LẦN BẠN TEST (chiều 11/09/2026) — ĐỌC MỤC J TRƯỚC KHI BẤM LẠI.** Bạn báo:
> «nhiệm vụ mà **không** tích Gửi BLĐ phê duyệt, nhưng khi gửi file **TP duyệt vẫn đẩy lên cho PGĐ**,
> CV002». Đã sửa theo đúng hai lựa chọn của bạn — **ẩn nút «TP/PP phê duyệt» khi tích TẮT** và **nới
> van chống tự duyệt** — ở mục **J** bên dưới, cộng thêm **bản giao diện mới `20260911-04`**. Migration
> **không đổi**, nên lần này **Ctrl+F5 là đủ**, không phải chạy lại `chay-test.bat`.

> **⚠ LẦN CHẠY ĐẦU NGÀY 11/09/2026 ĐÃ NỔ Ở BƯỚC [4/7] — ĐÃ SỬA XONG, CHỈ CẦN CHẠY LẠI.** Lỗi
> `23514 task_file_flow_hanh_dong_check`: 029 đặt hai câu `UPDATE` đổi tên verdict TRƯỚC câu
> `DROP CONSTRAINT`, mà CHECK cũ không biết `tp-phe-duyet`. Nay đã đổi thành **`DROP → UPDATE → ADD`**
> kèm chốt `DO $$` kể đích danh mã lạ, và đã **dry-run trên bản sao dữ liệu UAT thật** (46 → 46 dòng,
> `trinh-lanh-dao:3 → tp-phe-duyet:3`, `yeu-cau-sua:2 → tra-ve-cbo:2`). node-pg-migrate đã **tự
> rollback** nên UAT không hỏng gì, vẫn ở `pgmigrations=28` — **không phải khôi phục bản sao lưu**.
> **Nên chọn `/giu /f` (mode 1), ĐỪNG chọn mode 4 «Seed BỘ VÒNG 14»**: bộ seed đó để trống
> `supervisor_ids` nên năm nhiệm vụ mẫu không duyệt cây được và không thử được ĐIỂM 12 (mục H).
> Chi tiết: `KE-HOACH-DUYET-CAY.md` §11.4 bẫy (2) + (10).

> **⚠ Chạy lại `chay-test.bat /giu /f` — Ctrl+F5 là KHÔNG ĐỦ.** Script **TỰ sao lưu UAT** ở bước
> `[2/7]` (`pg_dump -Fc` ra `E:/quanlycongviec-backups/uat-<ngày-giờ>/`, hỏng là dừng chứ không làm gì
> tiếp) và **TỰ kiểm sáu dấu hiệu của 029** ở `[7/7]`, nên không cần backup hay kiểm bằng tay nữa.
> **029 KHÔNG LÙI TỰ ĐỘNG ĐƯỢC**: DOWN của nó là `RAISE EXCEPTION` ⇒ **khôi phục từ bản sao lưu là
> đường lùi DUY NHẤT** (tiền lệ thư mục `E:/quanlycongviec-backups/phase8b-20260909-1788890763839/`).
> UAT trước đợt này đang ở **`pgmigrations=028`**. Đợi dòng `[7/7]` in
> `assets/js/app.js?v=20260911-04`, Console in `[QLCV] app.js 20260911-04`.
> **CẬP NHẬT 12/09/2026:** 029 **đã lên UAT** (nay ở `029`) và buster hiện hành là **`20260912-01`** —
> nên **không cần chạy lại `chay-test.bat`** nữa, **Ctrl+F5 là đủ**. Hai con số ở dòng trên là của lần
> chạy ĐỢT B ngày 11/09, giữ lại làm bằng chứng. Xem **§9b.24**.
>
> **⚠ KHÔNG chạy `npm run migrate:up` bằng tay để «cho nhanh».** Lệnh đó đọc `../deploy/.env`, mà
> `DATABASE_URL` ở đó trỏ `quanlycongviec` @ **5432** = cơ sở dữ liệu **DEV**, không phải UAT. Chỉ
> `chay-test.bat` mới đổi đích sang `quanlycongviec_uat`.

**A. Migration 029 đã vào**

1. `SELECT name FROM pgmigrations ORDER BY name DESC LIMIT 1` ⇒ **029**.
2. Bảng `task_files` có **hai cột mới** `tp_duyet_boi` và `tp_duyet_luc`; bảng `approval_changes` có
   **cột `file_id`**.
3. Hai CHECK đã đổi: `task_file_flow_hanh_dong_check` **không còn** `yeu-cau-sua` / `trinh-lanh-dao` mà
   **có** `tp-phe-duyet`; `approval_changes_change_kind_check` nay là
   **`reviewer | gui-bld | ty-le`** (thêm `ty-le`).
4. **Nếu thấy lỗi `column "tp_duyet_boi" does not exist` hoặc `violates check constraint`** khi bấm
   «TP/PP phê duyệt» hay lưu tỷ lệ ⇒ **029 CHƯA chạy**. Đóng cửa sổ «QLCV TEST - Node» rồi chạy lại
   `chay-test.bat /giu /f`.

**B. Q1 + Q2 + Q4 — CẤM HẲN nút tải file khi cây chưa duyệt**

5. Nhiệm vụ / cây đang **«Chờ duyệt»** hoặc **«Nháp»** ⇒ **KHÔNG có nút tải file**. Chỉ có khung
   **KHAI BÁO** gồm **tên kết quả · định dạng · tỷ lệ**.
6. Khung khai nay **có ô «Tỷ lệ (%)»** (`task-kq-khai-ty-le`). **Để TRỐNG** = «tự chia»
   (placeholder ghi đúng chữ đó). Gõ **sai** (số âm, >100, thập phân, chữ) ⇒ **toast «Tỷ lệ phải là số
   nguyên từ 0 đến 100 — để trống thì máy chủ tự chia»** và **không gửi** — không âm thầm bỏ qua.
7. Chỉ định dạng **«Báo cáo»** mới có **ô nội dung chữ**; **năm định dạng còn lại** chỉ khai rồi nộp
   file ở chuỗi sau.
8. **Gọi thẳng API** nộp file khi cây chưa duyệt (DevTools → Console, hoặc `curl`) ⇒ **409** với thông
   báo nguyên văn: **«Cây công việc chưa được duyệt nên chưa nộp được file kết quả — lúc này chỉ KHAI
   BÁO (tên kết quả · định dạng · tỷ lệ). File thật nộp ở chuỗi riêng sau khi cây Đã duyệt.»** Ẩn nút là
   **lớp một**, câu 409 này là **lớp hai** — cả hai phải có.
9. Sau khi cây **«Đã duyệt»** ⇒ **nút tải file hiện ra**, nộp bình thường. Trường `cayDaDuyet` do máy
   chủ trả về quyết định việc ẩn/hiện đó.
10. **Q4**: người duyệt cây chỉ sửa được **KHAI BÁO** (tên · định dạng · tỷ lệ). **OnlyOffice chỉ ở
    chuỗi sau**, khi đã có bản tải lên thật.

**C. Q3 + R5 — «Nháp là nháp tất cả», cấp 3 không tự «Đã duyệt»**

11. Tạo mới một nhiệm vụ **cấp 3** (không lưu nháp) ⇒ trạng thái **«Chờ duyệt»**. Bản cũ cho **ngay
    «Đã duyệt»** — luật đó **đã bị bỏ** (điểm bất hợp lý số 2).
12. **«Lưu nháp»** ⇒ trạng thái **«Nháp»** và **sửa thoải mái MỌI thứ**; cấp 3 **không còn sinh ra
    «Đã duyệt» riêng lẻ** (Q3).
13. **R5**: thêm một nhiệm vụ **MỚI** vào cây **ĐÃ duyệt** ⇒ **đúng nhiệm vụ mới đó** thành
    **«Chờ duyệt» MỘT MÌNH NÓ**, phần cây đã duyệt **vẫn «Đã duyệt»**; duyệt riêng nó. **Số đếm ở Tổng
    quan không mất**, vì `v_countable_items` chỉ loại **đúng dòng «Chờ duyệt»** chứ không loại cả cây.
14. **HỆ QUẢ ĐÚNG CỦA Q3, KHÔNG PHẢI LỖI**: một dòng đang **«Chờ duyệt»** chỉ **người tạo**, **admin**
    hoặc **Phó Giám đốc** sửa/xoá được (`coSuaDuocKhiChoDuyet`). Nghĩa là **TP/PP sẽ thấy dòng mình vừa
    thêm KHÔNG sửa được nữa** cho tới khi có người duyệt.

**D. R6 — BỎ TỰ DUYỆT**

15. **admin hoặc Phó Giám đốc** nộp file cho việc **mình lập** ⇒ file **KHÔNG lên thẳng «Đã duyệt»**
    nữa. Nó vào **«Chờ TP/PP xem»** (`cho-xem`), hoặc **«Chờ Phó GĐ/Giám đốc»** (`cho-lanh-dao`) nếu
    người nộp là **Trưởng phòng / Phó phòng**.
16. **Không còn dòng nhật ký MỚI nào** ghi hành động **`duyet-tu-dong`**. Dòng cũ vẫn đọc được — 029
    **không xoá lịch sử verdict**, chỉ **ngừng ghi**.
17. `file:create = ✓` nay **chỉ còn đúng nghĩa «được phép khai/nộp»**, **không phải «tự duyệt»**.
    **Đường gỡ tắc vẫn còn**: muốn một vai được duyệt ngay lúc tạo thì đặt **ghi đè `create = ✓`** ở
    Bảng phân quyền (admin đặt luật cho **MỘT VAI** khác với **một vai tự duyệt cho chính mình**).

**E. Điểm 7 — «TP/PP phê duyệt» CÓ lưu mốc người duyệt và lúc duyệt**

18. Hành động cũ **«Trình lãnh đạo»** nay tên là **«TP/PP phê duyệt»**. **Trạng thái đích KHÔNG còn cố
    định** — nó phụ thuộc tích **«Gửi BLĐ phê duyệt»** (Q6). Bản đầu của mục này ghi «Trạng thái đích
    KHÔNG đổi» là **SAI**, và đó chính là chỗ bạn bắt được khi test CV002: đọc **mục J** bên dưới.
    **Bước 18 của 9b.22 bị đợt này thay tên.**
19. Sau khi TP/PP bấm ⇒ hiện **TÊN NGƯỜI DUYỆT** và **LÚC DUYỆT** (`tp_duyet_boi` / `tp_duyet_luc`).
    **Trước đây không lưu**, nên không ai biết ai đã chốt.
20. **Dữ liệu cũ** được 029 **điền ngược** từ lần **`tp-phe-duyet` hoặc `hoan-thanh` MUỘT NHẤT** của
    nhóm đó. Nhóm **chưa từng có lần nào** ⇒ **mốc để trống**, không phải lỗi.
21. **Q5 + Q6 + Q11 giữ nguyên, nhưng nay máy chủ THẬT SỰ thi hành**: TP/PP **tự làm** ⇒ lên **THẲNG**
    BLĐKS của nhiệm vụ (`canTraLanhDao`); tích **TẮT** ⇒ **TP/PP là chặng cuối**, chỉ còn nút
    **«Hoàn thành / Duyệt»** + **«Đẩy về Cán bộ»**, nút «TP/PP phê duyệt» **biến mất**. Chi tiết từng
    ca: **mục J**.

**F. Điểm 9 — gộp `yeu-cau-sua` vào `tra-ve-cbo`**

22. Chỉ còn **MỘT nút «Trả về cán bộ»** — trước đây là **hai nút cho cùng một việc**.
23. Nay **BẮT BUỘC lý do ≥ 10 ký tự** (mã sống sót lấy `canNoiDung: true`). **Trang mở từ trước khi tải
    bản mới** mà bấm nút cũ sẽ nhận **400** — **Ctrl+F5 là hết**.
24. **Nhật ký cũ** có dòng `yeu-cau-sua` nay đọc thành **`tra-ve-cbo`** (029 viết lại lịch sử **TRƯỚC**
    khi thu hẹp CHECK). **Không mất dữ liệu quá khứ**; nhãn hiển thị cũ vẫn đọc được.

**G. R4 + R4' + R4'' — tỷ lệ đi qua `approval_changes`**

25. Sửa **tỷ lệ** (của **file**, của **nhiệm vụ**, của **công việc con**) ⇒ **KHÔNG đổi ngay**: hàng đó
    hiện **«đang chờ duyệt»** và **GIÁ TRỊ CŨ vẫn còn hiệu lực** (đúng khuôn `proposeGuiBld` của Đợt A).
26. **Người nhận** (R4'): tỷ lệ **FILE** và tỷ lệ **NHIỆM VỤ cấp 3** ⇒ **ĐÚNG MỘT BLĐKS cấp 3** (nhiệm
    vụ cấp 3 chưa có BLĐKS riêng thì lấy **người đầu tiên của cấp 2**, Q12); tỷ lệ **CÔNG VIỆC CON** ⇒
    **tất cả BLĐKS cấp 2**. Theo **Q7** thì **MỘT người đồng ý là đủ** ở mọi cấp.
27. Đề nghị tỷ lệ nằm trong **CÙNG một hàng chờ** `GET /approvals/pending` (`pendingList =
    [...pendingGuiBld, ...pendingTyLe, ...listPending]`) — **không mở một hàng chờ thứ ba** (tiền lệ 026).
28. **Duyệt** ⇒ giá trị mới áp dụng và **chia lại đúng luật cũ**: file → `updateFileWeights`; đầu mục
    (cấp 2, hoặc cấp 3 không cha) → `canLaiTyLeWork`; cấp 3 có cha → `updateChildWeights`.
    **Từ chối** ⇒ **giá trị cũ giữ nguyên**.
29. **KHÔNG hạ cây về «Chờ duyệt»** khi xin đổi tỷ lệ ⇒ `v_countable_items` **không mất số**. Và nếu
    **giá trị gốc đã đổi** trong lúc chờ ⇒ người ký gặp **409 «Tỷ lệ hiện tại đã thay đổi — hãy từ chối
    và lập đề nghị mới»** (chốt này là **để chặn ghi đè mù**).

**H. Điểm 12 — siết `dungNguoiDuyetFile` theo BLĐKS cấp 3, KỂ CẢ khi tích TẮT**

30. **Phó Giám đốc KHÔNG có tên** trong `supervisor_ids` của nhiệm vụ ⇒ **không duyệt được file**,
    **kể cả khi tích «Gửi BLĐ phê duyệt» đang TẮT**. Bản cũ **chỉ siết khi tích BẬT**.
31. **`admin` cũng bị siết** như vậy — bản cũ **chỉ siết Phó Giám đốc**. Cùng một luật với R1(a).
32. `supervisor_ids` **RỖNG** ⇒ **KHÔNG bắt cổng** (van an toàn **một chiều**, giống R1(a) — không có
    đường thoát nào khác cho dòng cũ). **TP/PP không đi qua cổng này**: họ được kiểm bằng
    `laLanhDaoPhuTrachNhiemVu` đối chiếu `leader_ids`.

**I. Đối chứng**

33. **KHÔNG tồn tại «tỷ lệ công việc cha»** — bảng `works` **không có cột `ty_le`**. Chỉ **đầu mục**
    (cấp 2, hoặc cấp 3 không cha) và **nhiệm vụ cấp 3** mới có tỷ lệ.
34. Giữ xanh lại **9b.15 → 9b.22**, **trừ** những chỗ đã bị đợt này thay: **bước 18 của 9b.22** (tên
    hành động «Trình lãnh đạo» → «TP/PP phê duyệt»); **bước 13 của 9b.22** (admin mất quyền duyệt **cây**
    vẫn đúng, nhưng nay **THÊM**: admin cũng **không tự duyệt FILE** được); **bước 10 của 9b.17** (van
    chống tự duyệt đã **nới** — xem bước 39 mục J); và **mọi bước nói «nhiệm vụ cấp 3 tự Đã duyệt»**.
35. Chuông thông báo, OnlyOffice, lịch đẩy Zalo **không đổi**. **Lưu ý (f)**: sửa tỷ lệ lúc cây đang
    **«Chờ duyệt»** vẫn **lập được đề nghị** — cổng nằm ở **người ký**, không ở **trạng thái cây**.

**J. Q6 + Q11 — tích «Gửi BLĐ phê duyệt» quyết định TP/PP có nút nào (sửa chiều 11/09/2026)**

> Đây là phần sửa **sau lần bạn test** và báo «nhiệm vụ không tích Gửi BLĐ phê duyệt, nhưng khi gửi
> file TP duyệt vẫn đẩy lên cho PGĐ, CV002». **KHÔNG có migration mới** — chỉ mã máy chủ + `app.js`
> buster **`20260911-04`**, nên **Ctrl+F5 là đủ**, không phải chạy lại `chay-test.bat`.

36. **Ca bạn báo, nay phải khác.** Mở lại một nhiệm vụ **TẮT** tích «Gửi BLĐ phê duyệt» (CV002-002 hoặc
    nhiệm vụ mới), để cán bộ nộp một bản, rồi `tp@` mở menu Hành động: **KHÔNG còn** mục **«TP/PP phê
    duyệt»**. Chỉ còn **«Hoàn thành / Duyệt»** và **«Đẩy về Cán bộ»**. Bấm «Hoàn thành / Duyệt» ⇒ nhóm
    **100%** và **kết thúc tại phòng**; `pgd@` **không** nhận thông báo nào, hàng chờ BLĐ **không** có
    nhóm đó.
37. **Ẩn nút chỉ là lớp một — lớp hai ở máy chủ.** DevTools → Console, đăng nhập `tp@`, gọi thẳng:

    ```js
    fetch('/api/v1/task-files/<ID NHÓM>/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hanhDong: 'tp-phe-duyet',
        noiDung: 'Kính trình Phó giám đốc xem kết quả quý này',
      }),
    }).then((r) => r.json()).then(console.log);
    ```

    ⇒ **409**, thông báo nguyên văn: **«Nhiệm vụ này KHÔNG bật «Gửi BLĐ phê duyệt» nên TP/PP là chặng
    cuối — hãy dùng «Hoàn thành / Duyệt» để chốt, hoặc «Đẩy về Cán bộ» nếu cần sửa lại.»**
38. **Ngược lại, nhiệm vụ BẬT tích** ⇒ «Hoàn thành / Duyệt» **biến mất**, chỉ còn «TP/PP phê duyệt» +
    «Đẩy về Cán bộ». Gọi thẳng `hoan-thanh` ⇒ **403** **«Nhiệm vụ đã bật Gửi BLĐ phê duyệt — phải trình
    Ban lãnh đạo phụ trách, không Hoàn thành tại TP/PP»**. Trình lên thì **PGĐ/GĐ mới là người chốt**.
39. **TP vừa sửa trực tuyến VẪN chốt được** — van chống tự duyệt đã **NỚI**, và đây là nguyên nhân thứ
    hai của ca CV002. Nhiệm vụ TẮT: `tp@` mở bản Word → **«Sửa trực tuyến»** → lưu → quay lại menu Hành
    động ⇒ **vẫn còn** «Hoàn thành / Duyệt» và bấm được. **Bản cũ chặn ca này** vì coi «người lưu bản
    cuối» là người tự duyệt, nên TP sửa xong thì **hết đường kết thúc file trong phòng**.
40. **Van nay chỉ canh NGƯỜI THỰC HIỆN (Q5).** Nhiệm vụ **TẮT** tích nhưng **giao thẳng cho TP/PP** ⇒
    chính TP/PP **không được tự chốt**: bấm «Hoàn thành / Duyệt» ⇒ **403** **«Bạn là người thực hiện
    nhiệm vụ này nên không được tự chốt kết quả của chính mình — hãy dùng «TP/PP phê duyệt» để trình Ban
    lãnh đạo kiểm soát.»**, và nút «TP/PP phê duyệt» **quay lại** để đi lên BLĐKS.
41. **Ghi đè ⏳ ở Bảng phân quyền vẫn thắng.** Đặt «Duyệt kết quả (file nhiệm vụ) = **⏳ Chờ duyệt**» cho
    vai Trưởng phòng ⇒ kể cả tích **TẮT**, TP cũng **mất** nút chốt và **còn** «TP/PP phê duyệt»; gọi
    thẳng `hoan-thanh` ⇒ **403** **«Quản trị đã đặt «⏳ Chờ duyệt» ở ô «Duyệt kết quả (file nhiệm vụ)» cho
    vai của bạn — hãy dùng «TP/PP phê duyệt» hoặc «Đẩy về Cán bộ».»** Xem xong nhớ **trả quyền về ✓**.
42. **Ghi chú của nút chốt nay TUỲ CHỌN.** Bấm «Hoàn thành / Duyệt» **không gõ gì** vẫn qua (trước đây
    đường này đòi **≥ 10 ký tự**). Có gõ vào ô «Ý kiến» thì chữ đó được lưu vào nhật ký và **nối vào
    chuông thông báo**. Riêng trang **«Hàng chờ phê duyệt»** thì nút chốt **không có ô ghi chú** — **cố
    ý**: trang đó chỉ có một nút bấm nhanh, không dựng sẵn ô nhập; muốn kèm ghi chú thì chốt từ khối
    «Kết quả» trong modal nhiệm vụ.
43. **Bật tích đòi có Ban lãnh đạo kiểm soát.** Lưu nhiệm vụ cấp 3 với tích **BẬT** mà cả nó lẫn công
    việc con chứa nó đều **để trống** ô «Ban lãnh đạo kiểm soát» ⇒ **400** **«Nhiệm vụ chưa có Ban lãnh
    đạo kiểm soát để gửi phê duyệt»**. Tích **TẮT** thì **không kiểm gì** — muốn tắt là tắt được.
44. **Câu giải thích trong trang sửa file đã đổi chữ.** Khi không tự chốt được, trang editor ghi: **«Bản
    này bạn không tự Hoàn thành được — phải trình Ban lãnh đạo kiểm soát. Nút «TP/PP phê duyệt» sẽ lưu
    bản mới rồi trình lên; cần ý kiến ít nhất 10 ký tự.»** (Chữ cũ đổ lỗi cho «bạn là người lưu bản vừa
    sửa» — lý do đó **không còn đúng** sau bước 39.)
45. **Mọi trường hợp phải có ĐÚNG MỘT đường chốt** — không bao giờ có cả hai nút, cũng không bao giờ mất
    cả hai: **TẮT** + không phải người thực hiện + quyền duyệt **✓** ⇒ chỉ «Hoàn thành / Duyệt»;
    **BẬT** ⇒ chỉ «TP/PP phê duyệt»; **TẮT** + TP/PP **là người thực hiện** ⇒ chỉ «TP/PP phê duyệt»;
    **TẮT** + quyền duyệt **⏳** ⇒ chỉ «TP/PP phê duyệt».

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã.

### 9b.24 «Tình trạng» và «Người thực hiện» ghi Ở TỪNG BẢN · bản đầu chỉ người thực hiện trực tiếp nộp (12/09/2026, đợt B bổ sung) — bấm để tự nghiệm

**KHÔNG có migration — CSDL giữ nguyên `029`.** Có đổi mã máy chủ + giao diện, buster **`20260912-01`**
⇒ **Ctrl+F5 là đủ**. Thiết kế đầy đủ + bẫy ở `docs/KE-HOACH-DUYET-CAY.md` **mục 12**; ảnh hưởng tới
bảng «Kết quả» cũ ở `docs/KE-HOACH-KET-QUA-FILE.md` mục «Bổ sung 12/09/2026». Test tự động:
**2043/2043 · 114 file · exit 0** (+9 ca mới trong `phase8d-ban-dau.test.js`).

> **⚠ Ctrl+F5, KHÔNG phải chạy lại `chay-test.bat`.** Đợt này không có migration mới. Sau Ctrl+F5, thẻ
> Network phải thấy `assets/js/app.js?v=20260912-01` và Console in `[QLCV] app.js 20260912-01`. Nếu vẫn
> là `20260911-04` thì trình duyệt còn giữ bản cũ — **tắt hẳn tab rồi mở lại**, đừng đoán.

> **⚠ HAI CHỈ ĐẠO NÀY ĐỔI LUẬT, KHÔNG PHẢI SỬA CHỮ — ĐỌC TRƯỚC KHI BẤM.**
> **(1)** Trước đây **TP/PP nộp được bản kết quả ĐẦU TIÊN**; nay bản đầu **chỉ người thực hiện trực
> tiếp** nộp được. Mọi thói quen cũ ở 9b.20 → 9b.23 mà bạn để `tp@` up bản 1 sẽ nhận **403** — đó là
> **đúng luật mới**, không phải lỗi. **(2)** Hai cột «Tình trạng» và «Người thực hiện» của bảng «Kết
> quả» nay **ghi ở từng bản**, nên chữ trong hai cột đó **khác trước ở mọi nhóm file**, kể cả nhóm cũ.

**A. Bản ĐẦU chỉ người thực hiện trực tiếp nộp được (bước 46 → 50)**

46. **Hiện trường.** Một nhiệm vụ cấp 3 trong cây **đã `Đã duyệt`**, ô «Người thực hiện trực tiếp» =
    `nv@` (Nhân viên). Nếu chưa có thì tạo theo 9b.22/9b.23 rồi để `pgd@` duyệt trọn cây.
47. **`tp@` mất nút «Tải lên» ở nhóm chưa có bản nào.** Đăng nhập `tp@`, mở modal nhiệm vụ, khối «Kết
    quả», bấm ＋ **khai** một dòng (tên · định dạng · tỷ lệ — khai vẫn được, Q1 chỉ cấm TẢI FILE). Ở ô
    «Hành động» của nhóm mới khai: **không có nút «Tải lên»**, chỉ có dòng chữ xám nguyên văn
    **«Bản đầu chỉ «<tên của nv@>» nộp được.»**. Rê chuột vào dòng đó ⇒ **«Bản kết quả ĐẦU TIÊN phải
    do chính người thực hiện trực tiếp nộp; TP/PP và PGĐ/GĐ chỉ sửa hoặc nộp từ bản thứ hai trở đi»**.
    Nếu nhiệm vụ **chưa gán** người thực hiện thì dòng đó in «Bản đầu chỉ người thực hiện trực tiếp nộp
    được.» (không có tên trong ngoặc).
48. **Ẩn nút chỉ là lớp một — lớp hai ở máy chủ.** Vẫn `tp@`, DevTools → Console:

    ```js
    const t = await fetch('/api/csrf').then((r) => r.json()).then((x) => x.data.csrfToken);
    const fd = new FormData();
    fd.append('file', new File(['noi dung thu'], 'thu.pdf', { type: 'application/pdf' }));
    const r = await fetch('/api/v1/work-items/<MÃ NHIỆM VỤ>/files', {
      method: 'POST', headers: { 'x-csrf-token': t }, body: fd,
    });
    console.log(r.status, await r.json());
    ```

    ⇒ **403**, thông báo nguyên văn: **«Chỉ «Người thực hiện trực tiếp» (<tên của nv@>) mới được nộp
    bản kết quả ĐẦU TIÊN — TP/PP và PGĐ/GĐ chỉ sửa/nộp từ bản thứ hai trở đi»**. `pgd@` cũng 403 y hệt.
    Đường **«Báo cáo»** (`POST /api/v1/work-items/<mã>/reports`) **cũng bị gác** — báo cáo cũng sinh bản
    số 1, nên không có cửa vòng qua.
49. **`nv@` nộp được, và từ bản 2 thì ai cũng như cũ.** Đổi sang `nv@` ⇒ nút «Tải lên» **có**, up file
    ⇒ **200**, bản 1 hiện ra. Sau đó `tp@` «Sửa trực tuyến» hoặc nộp bản 2 ⇒ **qua bình thường**: guard
    chỉ canh `version_no === 1`, **không đụng** luật của các bản sau.
50. **Nhiệm vụ chưa gán người thực hiện ⇒ 409, không phải 403.** Bỏ trống ô «Người thực hiện trực
    tiếp», rồi **chính `nv@`** nộp ⇒ **409** **«Nhiệm vụ chưa có «Người thực hiện trực tiếp» — hãy gán
    người thực hiện ở form nhiệm vụ trước, rồi chính người đó nộp bản kết quả đầu tiên»**. Gán xong thì
    nộp được. (Thiếu **dữ kiện** để quyết thì báo 409; thiếu **quyền** mới báo 403.)

**B. Cột «Tình trạng» nay ghi Ở TỪNG BẢN (bước 51 → 54)**

51. **Trước đây cột này TRỐNG ở dòng bản.** Bung ▸ một nhóm có ≥ 2 bản để thấy các dòng 1.1, 1.2 …:
    mỗi dòng bản nay có **badge màu kèm TÊN người** ở cột «Tình trạng».
52. **Đối chiếu hành động ⇒ chữ in ra** (tên người luôn nối sau dấu «—»):

    | Hành động của bản | Badge «Tình trạng» | Màu |
    |---|---|---|
    | PGĐ/GĐ «Đẩy về Cán bộ» | Bị trả về — <tên> | đỏ |
    | PGĐ/GĐ «Đẩy về TP» | Bị trả về TP/PP — <tên> | đỏ |
    | TP/PP «Sửa trực tuyến» | TP/PP sửa trực tiếp — <tên> | vàng |
    | PGĐ/GĐ «Sửa trực tuyến» | PGĐ/GĐ sửa trực tiếp — <tên> | vàng |
    | «TP/PP phê duyệt» | TP/PP phê duyệt — <tên> | tím |
    | PGĐ/GĐ «Duyệt» | PGĐ/GĐ đã duyệt — <tên> | xanh lá |
    | PGĐ/GĐ «Hoàn thành / Duyệt» | PGĐ/GĐ chốt hoàn thành — <tên> | xanh lá |
    | «Hủy lệnh sửa» | Hủy lệnh sửa — <tên> | xám |

53. **Bản chưa ai đụng** (vừa tải lên) ⇒ xám, chữ kể **đúng việc vừa xảy ra**: bản 1 = **«Tải lên lần
    đầu — <tên>»**; bản nộp ngay sau một bản bị trả về = **«Sửa lại bản bị trả về — <tên>»**; các bản
    khác = **«Nộp lại — <tên>»**.
54. **Ý kiến/góp ý KHÔNG phải tình trạng của bản** — vẫn nằm ở ô «Xem ý kiến» riêng. **Cố ý**: góp ý là
    chuỗi tự do, không phải mốc luồng; gộp vào thì mỗi lần ai gõ một câu là «tình trạng» của bản đổi.

**C. Cột «Người thực hiện» nay là người duyệt/người sửa (bước 55 → 59)**

55. **Bản 1 do `nv@` up** ⇒ in **«Người thực hiện trực tiếp»** + tên, rê chuột thấy **«Tải lên bản đầu
    tiên»**.
56. **Bản bị trả về rồi CHÍNH `nv@` nộp lại** ⇒ vẫn **«Người thực hiện trực tiếp»**, title **«Trực tiếp
    sửa lại bản bị trả về»**. Đây là vế thứ hai của chỉ đạo: chỉ hai trường hợp này mới được mang nhãn đó.
57. **Mọi bản còn lại in người duyệt/người sửa**, kèm vai viết tắt: «TP/PP sửa trực tiếp — <tên>» (title
    «Sửa ngay trong OnlyOffice, lưu thành bản mới»), hoặc «TP/PP sửa — <tên>» / «PGĐ/GĐ sửa — <tên>»
    (title «Người duyệt hoặc người sửa nộp bản này»). Vậy nên nhóm mà bản 1 do `nv@` nộp, bản 2 do `tp@`
    sửa trực tuyến thì **hai dòng in hai nhãn khác nhau** — đó là đúng.
58. **Dữ liệu cũ in «TP/PP nộp thay».** Nhóm có bản 1 do TP nộp từ **trước** 12/09 ⇒ dòng đó in
    **«TP/PP nộp thay — <tên>»**, title giải thích **«Dữ liệu cũ: bản đầu do người không được giao nhiệm
    vụ nộp. Nay máy chủ chỉ cho chính người thực hiện nộp bản đầu.»**. **Không sửa ngược dữ liệu cũ** —
    chỉ nói thật để khỏi nhầm với luật mới.
59. **Dòng CHA** (dòng ghi «N bản»): ô «Người thực hiện» nay lấy **người thực hiện trực tiếp của nhiệm
    vụ** chứ không phải người khai báo. Nhiệm vụ **chưa gán** thì lùi về người khai, kèm title
    **«Nhiệm vụ chưa gán người thực hiện trực tiếp — đây là người khai báo…»**. Tên đầy đủ luôn nằm trong
    `title`; trong ô là tên ngắn để cột không vỡ.

**D. Các mục cũ (bước 60)**

60. **9b.20 → 9b.23 (gồm mục J) KHÔNG đổi luật.** Đợt này chỉ (a) đổi chữ ở hai cột của bảng «Kết quả»
    và (b) ẩn nút «Tải lên» + chặn 403/409 ở **bản đầu**. Ba ca test tự động từng cho `tp@`/`admin@` up
    bản 1 (`TC-V2-04`, `TC-V5-03` ×2) **đã được vá** theo luật mới. Chuông thông báo, OnlyOffice, luồng
    duyệt, lịch đẩy Zalo, tỷ lệ, `approval_changes` **không đụng tới**; **hình dạng phản hồi RPC/REST
    không đổi** (chỉ THÊM ba trường `duocNop` / `tenNguoiThucHien` / `thieuNguoiThucHien` trong `quyen`).

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã.

### 9b.25 Bảng «Chờ duyệt» nói rõ «duyệt cái gì» + nút «Xem các thay đổi» · bốn nút duyệt bé lại · cán bộ lập mới cấp 3 chọn được BLĐKS và người thực hiện · TP/PP hết nút «Gửi đi duyệt» (12/09/2026, đợt B bổ sung lượt 2) — bấm để tự nghiệm

**KHÔNG có migration — CSDL giữ nguyên `029`.** Có đổi mã máy chủ + giao diện + CSS, buster
**`20260912-02`** ⇒ **Ctrl+F5 là đủ**. Thiết kế đầy đủ + bẫy ở `docs/KE-HOACH-DUYET-CAY.md`
**mục 13**; ảnh hưởng tới luồng file ở `docs/KE-HOACH-KET-QUA-FILE.md` mục «Bổ sung 12/09/2026 lượt 2»;
pin XSS **`101 sink / 986 nội suy`** ở `docs/XSS-4.6.md`. Test tự động: **2076/2076 · 115 file · exit 0**
(+11 ca mới trong `approvals-pending-da-sua.test.js`, +4 ca pin CSS trong `approvals-ui.test.js`).

> **⚠ Ctrl+F5, KHÔNG phải chạy lại `chay-test.bat`.** Đợt này không có migration mới. Sau Ctrl+F5, thẻ
> Network phải thấy `assets/js/app.js?v=20260912-02` và Console in `[QLCV] app.js 20260912-02`. Nếu vẫn
> là `20260912-01` thì trình duyệt còn giữ bản cũ — **tắt hẳn tab rồi mở lại**, đừng đoán.

> **⚠ BA TRONG BỐN VIỆC NÀY LÀ ĐỔI CÁCH HIỂN THỊ, MỘT VIỆC LÀ MỞ QUYỀN — ĐỌC TRƯỚC KHI BẤM.**
> **(1)** Bảng «Chờ duyệt» nay có THÊM nhãn «Mới» / «Sửa» / «Xoá» và nhãn đối tượng — **mọi dòng cũ cũng
> đổi theo**, không phải chỉ dòng mới tạo. **(2)** Bốn nút duyệt **bé lại ở CẢ BA bảng** (chờ duyệt ·
> yêu cầu xoá · đề nghị đổi tỷ lệ). **(3)** Cán bộ **LẬP MỚI** nhiệm vụ cấp 3 nay **chọn được** hai ô
> «Ban lãnh đạo kiểm soát» + «Người thực hiện trực tiếp» — trước đây hai ô đó bị khoá. **(4)** TP/PP
> **mất nút «Gửi đi duyệt»** khi nhiệm vụ không tích «Gửi BLĐ phê duyệt»; thay vào đó họ chốt bằng
> «Hoàn thành». Đó là **đúng luật Q6/Q11**, không phải lỗi.

**A. MỚI-3 — bảng «Chờ duyệt» nói rõ đây là duyệt cái gì (bước 61 → 68)**

61. **Hiện trường.** Cần một công việc/nhiệm vụ đang ở **`Đã duyệt`** để làm ca «Sửa». Nếu chưa có thì
    tạo theo 9b.22/9b.23 rồi để `pgd@` duyệt trọn cây. Đăng nhập `tp@` (Trưởng phòng), mở tab
    **«Chờ duyệt»**.
62. **Nhãn «Mới».** Tạo MỘT nhiệm vụ cấp 3 mới (`nv@` hoặc `tp@`) và gửi đi duyệt. Về `tp@`, tab «Chờ
    duyệt»: dòng của nhiệm vụ đó in nhãn xanh lục **«Mới»**, rê chuột vào ⇒ giải thích nguyên văn
    **«Duyệt lần đầu — nội dung vừa được tạo mới và gửi lên»**. Kèm nhãn xám nói rõ đối tượng:
    **«Nhiệm vụ»** (công việc cha ⇒ **«Công việc cha»**, công việc con ⇒ **«Công việc con»**, file kết
    quả ⇒ **«File kết quả»**). **Không có** nút «Xem các thay đổi» ở dòng này.
63. **Nhãn «Sửa» chỉ hiện khi việc `Đã duyệt` bị sửa.** Vẫn nhiệm vụ đã `Đã duyệt` ở bước 61: sửa MỘT
    trường nội dung (ví dụ đổi tên hoặc đổi ngày hết hạn) rồi lưu. Máy chủ hạ về **`Chờ duyệt`** và hiện
    thông báo theo R7. Về `tp@`, tab «Chờ duyệt»: dòng đó nay in nhãn xanh dương **«Sửa»** (rê chuột ⇒
    **«Nội dung đã duyệt bị thay đổi — cần duyệt lại»**) và **có** nút **«Xem các thay đổi»**.
    > Nếu dòng đó vẫn in «Mới» và không có nút: vai đang dùng **không** có ghi đè `cho-duyet` ở action
    > `update`, nên việc sửa **không** hạ cây về «Chờ duyệt» — chọn vai khác (xem chú thích cuối mục A).
64. **Nút «Xem các thay đổi» mở popup đúng các lượt SAU mốc.** Bấm nút đó: **popup** có tiêu đề ghi tên
    nhiệm vụ, thân liệt kê **từng lượt đổi nội dung xảy ra SAU lần cây ra người duyệt gần nhất** — mỗi
    lượt một khối như ở tab «Nhật ký» (ai · lúc nào · action · bảng đổi `trường: cũ → mới`).
    Lượt gửi ĐẦU TIÊN và các lượt duyệt/trả cũ **không** nằm trong popup. Đóng popup bằng nút «Đóng»
    hoặc bấm nền xám.
65. **Sửa tiếp lần hai ⇒ popup dài thêm, không mất lượt cũ.** Vẫn `Đã duyệt` → sửa tiếp một trường khác
    → `tp@` bấm lại «Xem các thay đổi»: popup nay có **cả hai** lượt đổi, theo thứ tự thời gian.
66. **Bảng «Yêu cầu xoá».** Gửi một yêu cầu XOÁ công việc/nhiệm vụ. Về tab «Yêu cầu xoá» của `tp@`: dòng
    đó in nhãn đỏ **«Xoá»** (rê chuột ⇒ **«Yêu cầu xoá — duyệt xong là mất dữ liệu»») kèm nhãn đối tượng
    («Công việc cha» / «Công việc con» / «Nhiệm vụ»). **Không** có nút «Xem các thay đổi» ở bảng này.
67. **Bảng «Phê duyệt kết quả» giữ nguyên logic cũ.** Sửa **nội dung file** kết quả ⇒ duyệt riêng ở bảng
    «Phê duyệt kết quả», **không** vào cây. Sửa **tỷ lệ** của file ⇒ sinh đề nghị `approval_changes` đi
    **cây duyệt kia** (R4/R4'/R4''), dòng đề nghị in nhãn **«Đổi tỷ lệ»** và **«Gửi BLĐ»** như cũ. Nhãn
    «Mới»/«Sửa»/«Xoá» **không** xuất hiện ở bảng này.
68. **Hình dạng phản hồi không đổi — chỉ THÊM hai trường.** DevTools → Network → tìm request lấy danh
    sách chờ duyệt (`/api/v1/approvals/pending…`): mỗi phần tử nay có THÊM `da_sua` (boolean) và
    `moc_xu_ly` (chuỗi thời gian hoặc `null`). **Không** trường nào bị đổi tên hay bị bỏ; RPC cũ vẫn
    chạy. `da_sua` và `moc_xu_ly` do **MÁY CHỦ** tính (mốc là `activity_logs`), giao diện không tự đoán.
    > **Chú thích cuối mục A:** nhãn «Sửa» chỉ hiện khi cây **bị hạ về `Chờ duyệt`** lúc sửa, tức là khi
    > `phaiChoDuyetKhiSua` trả `true` — cần việc đang `Đã duyệt` **và** vai đang dùng có ghi đè
    > `cho-duyet` ở action `update`. Muốn mở ghi đè đó cho một vai để test thì chèn một dòng
    > `permission_overrides` (`entity_type` tương ứng, `action = 'update'`, `gia_tri = 'cho-duyet'`);
    > **đăng nhập lại** sau khi đổi quyền.

**B. MỚI-4 — bốn nút duyệt bé lại (bước 69 → 70)**

69. **Bốn nút «Xem chi tiết / Duyệt / Trả lại để sửa / Từ chối» bé lại và KHÔNG tràn dòng.** Ở cả **tab
    «Chờ duyệt»** và **tab «Yêu cầu xoá»**: bốn nút nằm gọn trong một hàng, chữ nhỏ hơn trước, không còn
    khối nút cao 40px chiếm hai dòng trên màn hình hẹp. DevTools → chọn một nút → Computed phải thấy
    `font-size: 11px`, `padding: 3px 9px`, `min-height: 24px`, `border-radius: 8px`. Thu hẹp cửa sổ
    xuống ~1024px: nút vẫn không chồng lên nhãn «Mới»/«Sửa».
70. **Bé ở CẢ BA bảng, và icon không vỡ.** Bảng thứ ba — **«Phê duyệt kết quả» / đề nghị đổi tỷ lệ**
    (`.change-row`): hai nút «Đổi tỷ lệ» / «Gửi BLĐ» và các nút quyết định cũng `font-size: 11px`. Icon
    trong nút (`<i>`) phải là `10px` — nếu icon to hơn chữ thì luật `.approval-row button i` chưa ăn.
    Bấm «Duyệt» một lần: vòng xoay `.loading::after` trong nút vẫn quay tròn đều, không lệch tâm, không
    làm nút nhảy cỡ.

**C. MỚI-5 — cán bộ LẬP MỚI nhiệm vụ cấp 3 chọn được hai ô phân công (bước 71 → 74)**

71. **Hai ô MỞ khi lập mới.** Đăng nhập `nv@` (vai **Nhân viên**, có quyền tạo nhiệm vụ cấp 3 trong
    công việc được giao). Mở biểu mẫu **tạo mới** nhiệm vụ cấp 3: ô **«Ban lãnh đạo kiểm soát»** và ô
    **«Người thực hiện trực tiếp»** đều **chọn được** (không xám, không báo «chỉ lãnh đạo mới được
    đổi»). Chọn một BLĐKS và chọn chính mình làm người thực hiện, lưu ⇒ **thành công**, nhiệm vụ ra
    `Chờ duyệt` / `Nháp` theo luật cũ.
72. **BLĐKS vẫn bị bó trong BLĐKS của công việc con chứa nó.** Ở cùng biểu mẫu, danh sách «Ban lãnh đạo
    kiểm soát» **chỉ** liệt kê những người là BLĐKS của công việc con (cấp 2) chứa nhiệm vụ đó — không
    thấy toàn bộ lãnh đạo hệ thống (`assertSupervisorsByLevel` vẫn chạy). Gọi thẳng API với một `id`
    ngoài danh sách ⇒ **400/403**, không lưu được.
73. **Chỉ giao được cho người CÙNG PHÒNG.** Vẫn `nv@`: chọn một người **cùng phòng** làm «Người thực
    hiện trực tiếp» ⇒ lưu được. Đổi sang một người **khác phòng** (hoặc người đã bị khoá tài khoản)
    ⇒ **403** với câu nguyên văn **«Cán bộ chỉ được giao nhiệm vụ cho người cùng phòng»**. Người có
    `department_id` rỗng **không** được coi là cùng phòng với người cũng rỗng.
74. **SỬA nhiệm vụ có sẵn thì hai ô vẫn KHOÁ như cũ.** Vẫn `nv@`, mở một nhiệm vụ cấp 3 **đã tồn tại**
    (không phải do mình vừa tạo) và bấm sửa: hai ô «Ban lãnh đạo kiểm soát» và «Người thực hiện trực
    tiếp» **vẫn bị khoá**; đổi qua API ⇒ **403 «Chỉ lãnh đạo có quyền phân công mới được đổi Ban lãnh
    đạo và Lãnh đạo phòng phụ trách»** / **«Cán bộ chỉ được tự nhận nhiệm vụ cho mình»**. Ô **«Lãnh đạo
    phòng phụ trách»** (`leader_ids`) khoá ở **mọi** trường hợp, kể cả khi lập mới cấp 3.

**D. MỚI-6 — TP/PP hết nút «Gửi đi duyệt» khi nhiệm vụ không trình BLĐ (bước 75 → 78)**

75. **Nhiệm vụ KHÔNG tích «Gửi BLĐ phê duyệt».** Lấy một nhiệm vụ có ô «Gửi BLĐ phê duyệt» **TẮT** và
    người thực hiện trực tiếp **không phải** `tp@`. Để `nv@` nộp một bản kết quả, rồi đăng nhập `tp@`
    (hoặc `pp@`) mở modal nhiệm vụ, khối «Kết quả»: ở ô «Hành động» của bản đó **KHÔNG còn** nút
    **«Gửi đi duyệt»** — chỉ còn **«Hoàn thành»** và **«Duyệt»** (kèm «Đẩy về Cán bộ» nếu vai đó có).
    Bản tự về trạng thái **`cho-xem`** (hàng chờ của TP/PP), **không** phải `cho-lanh-dao`.
76. **Chặn cả ở máy chủ, không chỉ ẩn nút.** Vẫn `tp@`, DevTools → Console, gọi thẳng hành động
    `gui-di-duyet` cho bản đó ⇒ nhận **409** với câu nói rõ **không còn ai để gửi** (vì nhiệm vụ không
    trình BLĐ). Nếu nhận **403** thì đó là trường hợp **mất quyền** (không phải chủ bản / không cùng
    phòng) — hai mã này cố ý khác nhau, đừng gộp.
77. **Nhiệm vụ CÓ tích «Gửi BLĐ phê duyệt» thì vẫn lên trên như cũ.** Bật tích ở một nhiệm vụ khác,
    `nv@` nộp bản, `tp@` mở khối «Kết quả»: nút **«Gửi đi duyệt» vẫn còn**; bấm ⇒ bản lên
    **`cho-lanh-dao`** và `pgd@` thấy nó ở bảng «Phê duyệt kết quả». **Không** trường hợp nào TP/PP tự
    thành **`Đã duyệt`** (R6: bỏ hẳn tự duyệt — `apTuDong` không bao giờ trả `da-duyet`).
78. **Nhóm `luu-tam` chưa có BẢN nào thì không hiện nút chốt.** Theo Q1, lần gửi đầu chỉ **KHAI BÁO**
    (tên · định dạng · tỷ lệ), chưa có file. Ở nhóm vừa khai, chưa có bản nào: ô «Hành động» **không**
    có «Hoàn thành» / «Duyệt» — phải có bản thật trước. Sau khi `nv@` nộp bản 1, hai nút đó mới hiện
    cho `tp@` (kể cả khi nhiệm vụ không trình BLĐ) — đó chính là chỗ nút «Hoàn thành» thay cho «Gửi đi
    duyệt».

**E. Các mục cũ (bước 79)**

79. **9b.15 → 9b.24 KHÔNG đổi luật.** Đợt này chỉ (a) thêm nhãn + nút ở ba bảng chờ duyệt, (b) thu nhỏ
    bốn nút duyệt, (c) mở hai ô phân công **khi lập mới cấp 3**, (d) ẩn «Gửi đi duyệt» cho TP/PP khi
    nhiệm vụ không trình BLĐ. Chuông thông báo, OnlyOffice, luồng duyệt, lịch đẩy Zalo, tỷ lệ,
    `approval_changes` **không đụng tới**; **hình dạng phản hồi RPC/REST không đổi** (chỉ THÊM `da_sua`
    và `moc_xu_ly` trong danh sách chờ duyệt). Nếu một mục cũ đỏ sau Ctrl+F5, ghi lại **số bước** — đó
    là hồi quy thật, không phải do nhãn mới.

Nếu một bước ở đây sai: ghi lại **số bước + tài khoản + mã nhiệm vụ + câu thông báo nguyên văn**,
đừng tự sửa mã.

## 10. Dọn dẹp sau buổi test

> **Cảnh báo đợt V1–V8 (10/09/2026):** các cách reset/seed bên dưới là hướng dẫn lịch sử.
> **KHÔNG thực hiện trên UAT đang có dữ liệu của đợt này.** Không TRUNCATE, không seed lại, không xóa phiên/tài khoản để dọn test.

Cách nhanh nhất: `chay-test.bat` chọn **2** (về bộ cũ) hoặc **4** (về bộ Vòng 14) — cả hai đều
`TRUNCATE` rồi dựng lại, nên mật khẩu đã đổi và dòng rác của mục 8 đều mất theo. Muốn giữ dữ liệu mà
chỉ trả mật khẩu về mốc thì làm bằng tay như dưới.

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

Hoặc `chay-test.bat` chọn **3** — nó `DROP` rồi tạo lại, chạy migration và seed luôn.

Riêng file `.docx` bạn nộp ở mục 9b thì nằm ngoài cơ sở dữ liệu, xoá cơ sở dữ liệu không dọn chúng.
Chúng ở `server\storage\ket-qua\<id nhiệm vụ>\`; để lại cũng vô hại (không dòng nào trỏ tới), muốn
sạch thì xoá thư mục đó.

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
| **Nộp file kết quả nhiệm vụ, tên tiếng Việt đúng dấu** | ✅ | mục **9b.1** — bộ seed Vòng 14 |
| **Lãnh đạo phòng phụ trách xem/sửa/duyệt + nhận thông báo** | ✅ | mục **9b.2** |
| **Sửa trực tuyến ONLYOFFICE + «Lưu thành bản mới»** | ✅ | mục **9b.3** — cần `ONLYOFFICE_*` trong `deploy/.env` |
| **Trang «Hàng chờ phê duyệt» hai tab con** | ✅ | mục **9b.4** |
| **Trưởng phòng chọn được cán bộ khi tạo nhiệm vụ** | ✅ | mục **9b.6** (1) |
| **Tạo công việc con hiện ngay, không phải tắt-mở modal** | ✅ | mục **9b.6** (2) |
| **Nhân viên không sửa được «Lãnh đạo phòng phụ trách»** | ✅ | mục **9b.6** (3) — chặn leo quyền |
| **Chỉ lãnh đạo phòng ĐƯỢC GÁN mới thấy/xử file** | ✅ | mục **9b.6** (4) |
| **Hàng chờ dạng bảng theo cây + cột «Xem ý kiến»** | ✅ | mục **9b.6** (5) |
| **Nộp bản mới ngay trong hàng chờ + thanh tải lên** | ✅ | mục **9b.6** (6)(7) |
| **Khối phân công thu gọn, cây tách bạch từng nhánh** | ✅ | mục **9b.6** (8) |
| **Khối «Kết quả» là bảng 8 cột, dòng bản 1.1/1.2 «Sửa lần N» thu gọn sau ▸** | ✅ | mục **9b.8** (1)(2) |
| **Mọi hành động gộp vào một menu ⋯; «Tình trạng» là câu kể có «Bị trả lại lần N»** | ✅ | mục **9b.8** (3)(4) |
| **Hàng chờ phê duyệt là bảng phẳng 8 cột, ba cấp cây thành ba cột** | ✅ | mục **9b.8** (5) |
| **Dòng «Chưa có» (khai kết quả trước khi có file) + định dạng «Báo cáo» nhập chữ + form tạo hiện bảng 8 cột** | ✅ | mục **9b.10** — cần `app.js 20260904-3` **và** migration **016** |
| **Chi tiết hàng chờ có dữ liệu thật · tạo tiếp con/nhiệm vụ ngay · chân form «Lưu tạm»/«Gửi đi duyệt» dính đáy · «Chờ duyệt» hiện ngay · dòng khai thẳng hàng · menu ⋯ nổi trên modal** | ✅ | mục **9b.11** — cần `app.js 20260905-2`, **không** migration mới. Test tự động: **1596/87 xanh** |
| **CHUÔNG THÔNG BÁO — badge trên thanh tiêu đề, bấm dòng mở đúng việc, «đọc hết», không đọc hộ được thông báo người khác** | ✅ | mục **9b.12** — cần `app.js 20260906-1` + máy chủ có `GET /api/v1/notifications`. Test tự động: **1625/88 xanh**. Phần **đẩy sang Zalo** ⏳ chờ §13.4 mục **25** |
| **Mũi tên ▼/▲ · cột «Tên file» riêng · bốn thẻ thống kê một dòng · «Ghi ý kiến» gộp hai nguồn** | ✅ | mục **9b.20** — chỉ giao diện, buster `20260910-12`. Test tự động: **1979/111 xanh** |
| **«Kết quả làm được» về cột Nhiệm vụ · «Ghi ý kiến» thành popup chỉ-đọc với bản cũ · căn giữa** | ✅ | mục **9b.21** — chỉ giao diện, buster `20260911-01`. Test tự động: **1984/111 xanh** |
| **«Ban lãnh đạo kiểm soát» BA CẤP thành mảng · admin MẤT quyền duyệt cây · gửi đúng người** | ✅ | mục **9b.22** — **BẮT BUỘC** `chay-test.bat /giu /f` (migration **028**), buster `20260911-02`. Test tự động: **1987/111 xanh** |
| **GỘP HAI TRỤC: nháp là nháp tất cả · nhiệm vụ thêm sau chờ duyệt một mình · CẤM HẲN nút tải file khi cây chưa duyệt · bỏ tự duyệt · tỷ lệ qua `approval_changes` · «TP/PP phê duyệt» có lưu mốc · gộp «Yêu cầu sửa» · tích «Gửi BLĐ» quyết định nút của TP/PP** | ⏳ **đang nghiệm thu** | mục **9b.23** — **BẮT BUỘC sao lưu rồi `chay-test.bat /giu /f`** (migration **029 KHÔNG LÙI TỰ ĐỘNG ĐƯỢC**); bản sửa Q6 chiều 11/09 **không cần** migration, chỉ **Ctrl+F5**. Buster **nay là `20260912-01`** (đợt bổ sung 12/09). Test tự động: **2043/114 xanh** |
| **Bản kết quả ĐẦU TIÊN chỉ người thực hiện trực tiếp nộp được · cột «Tình trạng» và «Người thực hiện» ghi Ở TỪNG BẢN kèm tên** | ⏳ **đang nghiệm thu** | mục **9b.24** (bước 46 → 60) — **KHÔNG có migration**, CSDL giữ `029`, **chỉ Ctrl+F5**. Đợi Network in `assets/js/app.js?v=20260912-01` và Console in `[QLCV] app.js 20260912-01`. Test tự động: **2043/114 xanh** (+9 ca `phase8d-ban-dau.test.js`), pin XSS **100/978** |
| **Bảng «Chờ duyệt» nói rõ «duyệt cái gì» + nút «Xem các thay đổi» · bốn nút duyệt bé lại · cán bộ lập mới cấp 3 chọn được BLĐKS và người thực hiện · TP/PP hết «Gửi đi duyệt» khi nhiệm vụ không trình BLĐ** | ⏳ **đang nghiệm thu** | mục **9b.25** (bước 61 → 79) — **KHÔNG có migration**, CSDL giữ `029`, **chỉ Ctrl+F5**. Đợi Network in `assets/js/app.js?v=20260912-02` và Console in `[QLCV] app.js 20260912-02`. Test tự động: **2076/2076 · 115 file · exit 0** (+11 ca `approvals-pending-da-sua.test.js`), pin XSS **101/986** |
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
| **Đăng nhập trượt `401` dù mật khẩu đúng** | máy chủ đang nối cơ sở dữ liệu **khác** (thường là dev) nên không có tài khoản mẫu | xem dòng `May chu dang noi ...` ở `[7/7]`; đóng cửa sổ «QLCV TEST - Node» rồi `chay-test.bat /giu /f` |
| **Không thấy tài khoản `tp@` / `nv1@`** | đang ở bộ seed cũ | `chay-test.bat /v14 /f` (mất bộ `TEST001..013`) |
| **Không thấy tài khoản `TEST001..013`** | đang ở bộ seed Vòng 14 | `chay-test.bat /seed /f` (mất bộ `gd@/tp@/nv1@`) |
| **Không có nút sửa trực tuyến (bút chì)** | thiếu `ONLYOFFICE_URL` hoặc `ONLYOFFICE_JWT_SECRET` trong `deploy/.env` — nút **ẩn lặng lẽ**, không báo lỗi | xem dòng `ONLYOFFICE:` ở `[7/7]`; thêm biến rồi khởi động lại máy chủ |
| **Editor báo không tải được file** | bản đó là của seed, chỉ có dòng cơ sở dữ liệu chứ không có file trên đĩa | đúng thiết kế — tự nộp một `.docx` ở NV-01 (mục **9b.1**) |
| **Bấm «Lưu thành bản mới» ra «Document Server không còn giữ phiên sửa»** | tab editor mở quá lâu, hoặc DS vừa khởi động lại | tải lại trang sửa rồi bấm lại |
| **Bấm Lưu báo «chưa có thay đổi nào»** | chưa sửa gì trong tài liệu | không phải lỗi (mã 4 của DS) |
| **Không thấy mục «Hàng chờ phê duyệt», hoặc trang cũ vẫn còn khối «Chờ duyệt»** | trình duyệt còn `app.js` bản cũ | Ctrl+F5; kiểm dòng `Ban app.js` ở `[7/7]` và banner `[QLCV] app.js` trong Console |

---

## 13. Đọc tiếp

- Kết quả 60 điểm khói + 2 điểm đỏ: [docs/UAT.md](UAT.md) mục «Checklist khói §8.5»
- Lệnh môi trường, bẫy riêng của máy này: [docs/BAT-DAU-SESSION.md](BAT-DAU-SESSION.md) mục 4 và 5
- Danh sách 37 tên hàm và bảng phép thử bảo mật: `KE-HOACH-VPS.md` §5.1 và §8.7
- Bẫy đã biết, đừng phát hiện lại: `KE-HOACH-VPS.md` §13.5
- Thiết kế luồng kết quả là file (mục 9b): [docs/KE-HOACH-KET-QUA-FILE.md](KE-HOACH-KET-QUA-FILE.md)

# NHẬT KÝ — «HOẠT ĐỘNG GẦN ĐÂY» Ở TRANG TỔNG QUAN ĐỌC ĐƯỢC (2026-08-29)

Người dùng gửi ảnh panel «Hoạt động gần đây» đang hiện:

```
works.setMonthName        ← tên action thô của CSDL
CV003 — Tháng 8           ← mã + tên tháng (dạng "code — name")
Phó GD Một • 29/08/2026 12:00
rpc.getDepartmentContext  ← LỜI ĐỌC bị ghi thành nhật ký
{}
bootstrap.get             ← LỜI ĐỌC bị ghi thành nhật ký
{}
```

Bốn vấn đề: (1) tên hành động tiếng Anh/thô, (2) chuỗi `{}` vô nghĩa, (3) lời ĐỌC lọt vào nhật
ký — mỗi lần mở trang sinh cả chục dòng rác, (4) hiện mã `CV003` trong khi người dùng đã yêu cầu
bỏ mã ở các tab.

## 1. Gốc lỗi — vì sao lời ĐỌC lại vào nhật ký

- `middleware/audit.js` chỉ ghi request **GHI** (POST/PUT/PATCH/DELETE) — đúng nguyên tắc.
- Nhưng giao diện cũ gọi máy chủ bằng **POST /api/rpc/<tên>** với cả lời ĐỌC (`getDataForUser`,
  `getDepartmentContext`, …), và `rpc/index.js` đặt mốc `res.locals.audit = { action: 'rpc.<tên>' }`
  cho **mọi** lời gọi ⇒ middleware ghi nốt.
- Tệ hơn: `subrequest.js` cho lời gọi con dùng chung `res.locals` với res thật, nên route GET
  bên trong (`GET /bootstrap` đặt `action: 'bootstrap.get'`, `GET /stats/*`, gantt) **giẫm đè**
  mốc của cầu ⇒ dòng rác mang tên `bootstrap.get`/`stats.*`. Với REST trực tiếp những dòng đó là
  **code chết** (audit bỏ qua GET) — chỉ sống nhờ đường đi qua cầu.

## 2. Đã sửa

### Máy chủ (không đổi schema, không đổi API)

| Chỗ | Sửa |
|---|---|
| `server/src/rpc/index.js` | Mốc `rpc.<tên>` giữ tham chiếu; sau khi handler chạy xong, nếu `res.locals.audit` **vẫn là mốc** ⇒ lời ĐỌC ⇒ `res.locals.skipAudit = true`. Route GHI bên trong tự đặt `res.locals.audit` MỚI với tên nghiệp vụ (`works.create`…) nên vẫn được ghi như cũ (TC-RPC-21 giữ nguyên) |
| `bootstrap/routes.js`, `stats/routes.js` (3 route), `gantt/routes.js` | Bỏ 5 dòng `res.locals.audit = …` ở route GET — code chết, chỉ có tác dụng giẫm đè mốc của cầu |
| `activityLogs/repo.js` | Xuất `DIEU_KIEN_LOAI_DONG_RAC` — điều kiện `action NOT LIKE 'rpc.%' AND action NOT IN ('bootstrap.get','stats.summary','stats.charts','stats.activities','gantt.tree')`; áp cho `listRecent` (gói đăng nhập) |
| `stats/repo.js` | Cùng điều kiện cho `listActivitiesPaged` (cả SELECT đếm `total`) — dòng rác CŨ còn trong CSDL bị ẨN khỏi panel, KHÔNG xoá (nhật ký là dữ liệu điều tra) |
| `rpc/legacyFields.js` | `moTaNhatKy`: object rỗng ⇒ `''` (hết `{}`); có `month` ⇒ «Tên đầu việc · Tháng n/YYYY · tên mới/cũ»; có `changes` ⇒ «Cập nhật N trường»; có `code`+`name` ⇒ chỉ hiện **TÊN** (bỏ mã) |
| `works/routes.js` (3 chỗ), `workItems/routes.js` (2 chỗ) | `details` của đặt/bỏ tên theo tháng thêm `workName`/`itemName` — nhật ký hiện **tên đầu việc**, không còn phải đọc mã |

### Giao diện (`web/assets/js/app.js`)

- Bản đồ `NHAT_KY_HANH_DONG` (dùng chung với tab Nhật ký) bổ sung 21 hành động: `auth.login/logout`,
  `users.*`, `departments.*`, `delegations.*` (create/update/cancel/accept/decline), `proposal.*`,
  `app.*`, `notification.create`, `chat.send`.
- Builder mới **`createHoatDongItemHtml`** (escape đủ, TC-SEC-17): nhãn + icon + màu theo bản đồ;
  mô tả rỗng thì **bỏ hẳn dòng phụ**; hành động lạ vẫn hiện nguyên tên (không bỏ dòng — người đọc
  phải biết là thiếu).
- `hoatDongSangLegacy` (đường `/stats/activities`) dùng `moTaChiTietHoatDong` — cùng luật với
  `moTaNhatKy` phía máy chủ, thêm nhãn cột tiếng Việt cho «Cập nhật N trường».
- Banner + buster: `app.js 20260829-1` (app.js dòng 9, `web/index.html` dòng 1301). CSS không đổi.

## 3. Test

| Test | Nội dung |
|---|---|
| `server/tests/unit/hoat-dong-ui.test.js` (mới, jsdom — app.js thật) | TC-HD-01 nhãn + icon theo bản đồ, không còn chữ action thô; TC-HD-02 mô tả rỗng ⇒ hết dòng phụ và `{}`; TC-HD-03 hành động lạ + escape `<script>`; TC-HD-04 `{}` ⇒ rỗng, tháng ⇒ tên đầu việc + Tháng n/YYYY **hết mã**; TC-HD-05 «Cập nhật 2 trường: Trạng thái, Hoàn thành (%)»; TC-HD-06 code+name ⇒ chỉ tên |
| `rpc-bridge.test.js` TC-RPC-24 | `getDataForUser` + `getDepartmentContext` qua cầu ⇒ **0 dòng** `rpc.*`/`bootstrap.get`/`stats.*`/`gantt.tree`; còn `addProjectWithAuth` vẫn ghi `works.create` |

Kết quả: **1337/1337 test · 79 file xanh** (từ 1330/78), lint + `format:check` sạch. Pin XSS đo lại
`tools/dem-xss.mjs`: **92 chỗ / 670 giá trị** (+2 giá trị của builder mới, sink giữ nguyên) —
TC-SEC-17 + `docs/XSS-4.6.md` đã cập nhật trong cùng commit.

## 4. Bẫy ghi sổ (§13.5)

1. Route GET đặt `res.locals.audit` là code chết với REST trực tiếp nhưng **sống** qua cầu RPC
   (subrequest dùng chung `locals`) — đừng đặt audit ở route GET, và cầu phải tự nhận lời ĐỌC.
2. Anchor đa dòng trong script `tools/_tam.mjs` vấp **CRLF** của file (mốc `\n` không bao giờ
   khớp — script ném «gặp 0 lần» giữa chừng, an toàn vì chưa ghi): anchor chỉ dùng một dòng.
3. File test jsdom gọi hàm xuất qua **`window.<tên>`** — eslint chỉ mở global trình duyệt cho
   nhóm file này (bỏ qua là no-undef hàng loạt).

## 5. Kiểm tay cho người dùng

Ctrl+Shift+R → Console thấy `[QLCV] app.js 20260829-1` → vào **Tổng quan**:

1. «Hoạt động gần đây» hiện nhãn tiếng Việt có icon («Đặt tên theo tháng», «Lập công việc»…),
   KHÔNG còn `works.setMonthName`, `rpc.getDepartmentContext`, `bootstrap.get` hay `{}`.
2. Dòng tên theo tháng hiện «Quyết toán Q3 · Tháng 8/2026 · tên mới: …» — không còn mã CV003.
3. Dòng rác cũ trong CSDL bị ẩn luôn (không cần dọn CSDL); từ giờ máy chủ không sinh thêm.
4. Tab Nhật ký trong modal sửa và mọi luồng duyệt/ủy quyền không đổi — nhật ký GHI vẫn đầy đủ.

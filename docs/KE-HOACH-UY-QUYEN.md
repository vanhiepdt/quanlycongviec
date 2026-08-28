# Kế hoạch tính năng ỦY QUYỀN (delegations)

> Trạng thái: **kế hoạch + triển khai cùng session 2026-08-27** (người dùng chốt giữa buổi:
> *"sau khi hoàn thành việc 3 lên kế hoạch thì hãy triển khai làm luôn"*).
> Đọc §13.1 của `KE-HOACH-VPS.md` trước khi sửa gì trong đây.

## 1. Vấn đề cần giải

Phó Giám đốc / Trưởng phòng đi công tác, nghỉ phép, hoặc bận họp cả tuần. Trong thời gian đó
công việc của phòng vẫn phải chạy: có việc cần **duyệt**, có nhiệm vụ cần **sửa hạn**, có công
việc con cần **tạo**. Hiện hệ thống chỉ có hai đường:

1. Đổi vai trò của người thay thế trong `users.role` — sai bản chất (quyền không hết hạn, không
   ai biết vì sao người đó thành Phó Giám đốc) và mất dấu vết.
2. Chờ người đi công tác về — đúng cái mà tính năng này sinh ra để tránh.

Ủy quyền = **cho người khác MƯỢN quyền của mình trong một khoảng thời gian, có dấu vết, tự hết
hiệu lực**. Không phải đổi vai trò, không phải cấp thêm quyền vĩnh viễn.

## 2. Bốn luật gốc (chốt trước khi viết dòng mã nào)

| # | Luật | Vì sao |
|---|---|---|
| L1 | **Không ủy quyền cho chính mình.** `from_user_id <> to_user_id`, chặn ở CHECK của CSDL và ở service. | Bản ghi tự trỏ vào mình không thêm quyền gì, chỉ làm nhật ký nhiễu và làm luật "mượn quyền" thành vòng lặp. |
| L2 | **Không cho mượn quyền TOÀN CỤC.** ~~Người ủy quyền là admin ⇒ từ chối ngay~~ — sửa 2026-08-28 theo §13.4 mục 18: Giám đốc ủy quyền được cho Phó Giám đốc, nhưng bản ghi **bắt buộc liệt kê phòng** (`DELEGATION_ADMIN_SCOPE_REQUIRED`) và lúc kiểm quyền được đọc như vai `Phó Giám đốc` trong đúng các phòng đó (xem §11). | Quyền admin gồm cả xoá phòng, xoá người, sửa vai trò người khác. Mượn được quyền đó nghĩa là mượn được cả quyền tự nâng mình thành admin vĩnh viễn — ủy quyền hết hạn cũng vô nghĩa. Hạ vai + bó theo phòng giữ được câu chốt của người dùng mà không mở cái cửa này. |
| L3 | **Không ủy quyền rộng hơn quyền của chính mình.** Phạm vi mặc định = các phòng người ủy quyền đang phụ trách; phạm vi truyền lên phải là **tập con** của phạm vi đó. | Nếu không, Trưởng phòng A ủy quyền "toàn đơn vị" cho một Nhân viên là tự nâng quyền qua cửa sau. |
| L4 | **Không ủy quyền dây chuyền (không tái ủy quyền).** Người đang mượn quyền KHÔNG tạo được bản ghi ủy quyền mới bằng quyền mượn. | Chuỗi A→B→C không ai kiểm được, và thời hạn của C không còn liên quan gì đến thời hạn của A. Kiểm bằng: `can()` chỉ mượn quyền cho các hành động trên `work/subwork/task`, còn `delegation` là loại thực thể riêng và KHÔNG nằm trong danh sách mượn được. |

## 3. Lược đồ — migration `006_delegations.sql`

Số hiệu **006** (đã kiểm `server/src/db/migrations/`: 001_init, 002_work_items_department,
003_work_origin_and_history, 004_countable_views, 005_phan_cong ⇒ tiếp theo là 006).

```sql
CREATE TABLE delegations (
  id           bigserial PRIMARY KEY,
  from_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_ids bigint[] NOT NULL DEFAULT '{}',   -- phạm vi; rỗng = đúng phạm vi người ủy quyền
  from_date    date NOT NULL,
  to_date      date NOT NULL,
  status       text NOT NULL DEFAULT 'active',     -- 'active' | 'cancelled'
  note         text NOT NULL DEFAULT '',
  created_by   bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delegation_not_self  CHECK (from_user_id <> to_user_id),
  CONSTRAINT delegation_dates_ok  CHECK (to_date >= from_date),
  CONSTRAINT delegation_status_ok CHECK (status IN ('active', 'cancelled'))
);
```

Ba chi tiết cố ý:

- **`date` chứ không `timestamptz`.** Người dùng nghĩ theo NGÀY ("từ 01/09 đến 07/09"), và
  `from_date`/`to_date` **bao gồm cả hai đầu**. Pool đã cấu hình giữ `date` ở dạng chuỗi
  `YYYY-MM-DD` (§13.5 bẫy múi giờ), nên không có chỗ nào `new Date('2026-09-01')` lệch 7 giờ.
- **`department_ids` mảng, mặc định rỗng.** Rỗng KHÔNG phải "toàn quyền": lúc kiểm quyền, rỗng
  được đọc là "đúng các phòng mà người ủy quyền đang phụ trách **ở thời điểm kiểm**". Cách này
  đúng hơn chép cứng danh sách phòng lúc tạo — người ủy quyền được giao thêm/bớt phòng thì bản
  ghi ủy quyền không bị lệch.
- **`status` chỉ hai giá trị.** Không có `expired`: hết hạn suy ra từ ngày, không phải trạng thái
  phải cập nhật bằng cron. Một cron dọn trạng thái là một nguồn sự thật thứ hai.

Chặn trùng lặp chồng lấp — **UNIQUE dạng chỉ mục loại trừ** (`btree_gist` không cần vì
`daterange` + `int8` dùng gist trực tiếp):

```sql
ALTER TABLE delegations
  ADD CONSTRAINT delegation_no_overlap
  EXCLUDE USING gist (
    from_user_id WITH =,
    to_user_id   WITH =,
    daterange(from_date, to_date, '[]') WITH &&
  ) WHERE (status = 'active');
```

Nghĩa: **cùng một cặp (người ủy quyền, người được ủy quyền)** không được có hai bản ghi
`active` mà khoảng ngày giao nhau. Hai bản ghi liền kề nhưng không chồng (01–07 và 08–14) vẫn
được. Bản đã `cancelled` không tính (mệnh đề `WHERE`), nên huỷ rồi tạo lại đúng khoảng đó là
việc bình thường. Cần `CREATE EXTENSION IF NOT EXISTS btree_gist` vì `from_user_id`/`to_user_id`
là `bigint` (gist mặc định không có toán tử `=` cho kiểu này).

Index: `idx_delegations_to_active (to_user_id) WHERE status='active'` — đường nóng của mỗi
request là "người đang gọi có bản ghi nào cho mình không". Thêm
`idx_delegations_from (from_user_id)` cho trang "ủy quyền của tôi".

Trigger `updated_at`: dùng lại `set_updated_at()` đã có trong `001_init.sql`.

**Down migration** bỏ theo thứ tự ngược: trigger → constraint → index → table (extension
`btree_gist` GIỮ LẠI, vì gỡ extension có thể ảnh hưởng thứ khác trong CSDL).

## 4. Luật hiệu lực — nằm ở đâu

Chỗ này là phần dễ làm sai nhất. Quy tắc: **`can()` vẫn là hàm thuần, không đọc CSDL.**

Vì vậy quyền mượn được **nạp cùng phiên**, không tra trong `can()`:

1. `attachSession` (đã có) đọc phiên → `req.user`.
2. Thêm một bước: đọc các bản ghi ủy quyền **đang hiệu lực** cho `req.user.id`
   (`status='active' AND current_date BETWEEN from_date AND to_date`), kèm vai trò và phạm vi
   của người ủy quyền. Gắn vào `req.user.delegations = [{ id, fromUserId, fromUserName, fromRole,
   departmentIds }]`.
3. `can()` nhận thêm một lớp: nếu người gọi **tự mình** không được phép, thử lại với từng bản ghi
   ủy quyền — coi như người gọi có vai trò `fromRole` và `managedDepartmentIds = departmentIds`.
   Kết quả trả về thêm khoá `viaDelegationId` khi lọt nhờ mượn quyền.

Ba giới hạn của lớp mượn quyền, viết thẳng trong mã:

- Chỉ mượn cho `work`, `subwork`, `task` (kèm `approve`). **Không** mượn cho `user`,
  `department`, `delegation` (L4).
- Không mượn được vai `admin` (L2 chặn từ lúc tạo, nhưng lớp kiểm cũng chặn lần hai: dữ liệu cũ
  hoặc sửa tay trong CSDL không được thành đường vòng).
- Quyền **tự có luôn được xét trước**; mượn quyền chỉ là đường bổ sung, nên bật/tắt tính năng
  không bao giờ làm mất quyền vốn có của ai.

So ngày bằng `current_date` của Postgres (không phải `new Date()` của Node) — cùng lý do §13.5
bẫy (b): máy chủ chạy UTC, người dùng ở ICT, và ranh giới ngày phải theo CSDL để mọi truy vấn
nói cùng một thứ tiếng.

## 5. REST `/api/v1/delegations`

| Method | Đường | Ai gọi được | Việc |
|---|---|---|---|
| GET | `/` | đã đăng nhập | Ủy quyền **của tôi** (tôi giao) + **cho tôi** (tôi nhận). Admin thêm `?all=1` xem tất cả. |
| POST | `/` | người có phạm vi (Phó GĐ / Trưởng phòng / Phó phòng / Quản lý công việc), admin tạo hộ | Tạo bản ghi. Chặn L1–L4, chặn chồng lấp (409). |
| PATCH | `/:id` | người ủy quyền hoặc admin | Sửa `to_date`, `note`, `department_ids` (**không** sửa `from_user_id`/`to_user_id` — đổi người là bản ghi khác). |
| DELETE | `/:id` | người ủy quyền hoặc admin | **Huỷ mềm** `status='cancelled'`, không DELETE — dấu vết phải còn để đối chiếu với nhật ký. |

Mã lỗi mới (đặt trong `utils/errors.js` theo đúng cách các mã hiện có được khai):

- `DELEGATION_SELF` — ủy quyền cho chính mình (L1)
- `DELEGATION_ADMIN_FORBIDDEN` — ủy quyền vai admin (L2) · **hết dùng 2026-08-28**, giữ mã lại vì
  nhật ký cũ có ghi; nay chỗ đó là `DELEGATION_ADMIN_SCOPE_REQUIRED` (xem §11)
- `DELEGATION_SCOPE_TOO_WIDE` — phạm vi vượt quá quyền người ủy quyền (L3)
- `DELEGATION_OVERLAP` — trùng khoảng ngày với bản ghi `active` khác (409) · từ 007 tính cả `pending`
- Thêm 2026-08-28: `DELEGATION_RANK_UP` (403, R2), `DELEGATION_DIFFERENT_DEPARTMENT` (403, R3),
  `DELEGATION_ADMIN_SCOPE_REQUIRED` (400, L2) — xem **§11**

Mọi hành động ghi đều đặt `res.locals.audit` (`delegations.create` / `.update` / `.cancel`), và
**mọi hành động lọt nhờ mượn quyền** ghi thêm `details.viaDelegationId` — yêu cầu "mỗi hành động
ủy quyền đều được ghi nhật ký kèm `delegation_id`".

## 6. Giao diện

- Modal **«Ủy quyền của tôi»**: bảng hai phần (tôi giao / tôi nhận), nút tạo mới, nút huỷ. Mở từ
  menu người dùng. Không thêm thư viện: Font Awesome có sẵn (`fa-user-shield`) + lớp modal hiện có.
- Nhãn **«đang được ủy quyền»** cạnh tên người dùng khi `delegations` (nhận) khác rỗng, kèm tooltip
  "Bạn đang dùng quyền của <tên> đến <ngày>".
- Ô ngày dùng `<input type="date">` (đã dùng ở form công việc), gửi lên đúng `YYYY-MM-DD`.

## 7. Kế hoạch test

| Mã | Tầng | Nội dung |
|---|---|---|
| TC-UQ-01 | migration | `up` → `down` → `up` sạch; bảng, 4 constraint, 2 index, trigger `updated_at` có mặt |
| TC-UQ-02 | CSDL | `from_user_id = to_user_id` bị CHECK chặn |
| TC-UQ-03 | CSDL | `to_date < from_date` bị chặn |
| TC-UQ-04 | CSDL | hai bản ghi `active` cùng cặp, khoảng ngày chồng nhau → EXCLUDE chặn; khoảng liền kề không chồng → được; bản `cancelled` không tính |
| TC-UQ-05 | API | admin ủy quyền → `DELEGATION_ADMIN_FORBIDDEN` |
| TC-UQ-06 | API | phạm vi vượt quá phòng mình phụ trách → `DELEGATION_SCOPE_TOO_WIDE`; tập con thì được |
| TC-UQ-07 | `can()` | **trước** khoảng ngày: không mượn được quyền |
| TC-UQ-08 | `can()` | **trong** khoảng ngày: mượn được, và `verdict.viaDelegationId` đúng id |
| TC-UQ-09 | `can()` | **sau** khoảng ngày: hết mượn (không cần cron) |
| TC-UQ-10 | `can()` | `status='cancelled'` → không mượn dù còn trong khoảng ngày |
| TC-UQ-11 | `can()` | chỉ mượn `work/subwork/task`; `user`/`department`/`delegation` KHÔNG mượn được (L4) |
| TC-UQ-12 | `can()` | phạm vi mượn giới hạn theo `department_ids`: phòng ngoài phạm vi vẫn bị chặn |
| TC-UQ-13 | API | hành động lọt nhờ mượn quyền ghi `activity_logs` có `details.viaDelegationId` |
| TC-UQ-14 | API | huỷ = `status='cancelled'`, dòng vẫn còn trong bảng; người ngoài không huỷ được của người khác |
| TC-UQ-15 | jsdom | modal ủy quyền + nhãn «đang được ủy quyền» dựng đúng, mọi giá trị qua `escapeHtml` |

## 8. CÂU HỎI CHỜ NGƯỜI DÙNG

> **Đã trả lời 2026-08-28** — ba trong bốn câu (§13.4 mục 17, 18, 20) đã chốt, xem **§11** để biết
> luật hiện hành và chỗ chặn của từng luật. Câu 3 (mục 19) **vẫn treo**: giữ *không giới hạn*.
> Bốn đoạn dưới đây giữ nguyên văn giả định CŨ để đọc lại được vì sao mã từng viết như thế.

Bốn câu dưới đây **không chặn** phần đã triển khai (mọi câu đều có giả định đang dùng, ghi rõ
trong mã), nhưng cần trả lời để chốt luật lâu dài. Đã thêm vào §13.4 của `KE-HOACH-VPS.md` với
số **17–20**.

1. **Ai được ủy quyền?** Giả định đang dùng: mọi vai **có phạm vi** — Phó Giám đốc, Trưởng phòng,
   Phó phòng, Quản lý công việc. Nhân viên không có gì để ủy quyền (chỉ có nhiệm vụ của chính
   mình). Có muốn thu hẹp về đúng Phó Giám đốc + Trưởng phòng không?
2. **Người được ủy quyền có phải cùng phòng không?** Giả định: **không bắt buộc** — người đi công
   tác có thể nhờ đồng cấp phòng khác. Có muốn ép cùng phòng không?
3. **Một người được nhận ủy quyền từ mấy người cùng lúc?** Giả định: **không giới hạn** (quyền là
   hợp của các bản ghi). Có muốn giới hạn 1 để tránh một người gom quyền cả đơn vị không?
4. **Có cần thông báo khi được ủy quyền / khi sắp hết hạn không?** Giả định: **chưa gửi** —
   `MAIL_ENABLED=false` (§13.4 mục 4), và bảng `notifications` chỉ có đường tạo cho admin (§13.4
   mục 16). Muốn có thì làm cùng lúc với chuông thông báo, không làm riêng.

---

## 9. Đã triển khai gì (2026-08-27)

| Phần | Trạng thái | Nằm ở |
|---|---|---|
| Lược đồ (§3) | ✅ đã chạy trên Postgres thật | `server/src/db/migrations/006_delegations.sql` — 4 ràng buộc `delegation_{not_self,dates_ok,status_ok,no_overlap}`, `no_overlap` là `EXCLUDE USING gist` cần `btree_gist` |
| Luật hiệu lực (§4) | ✅ | `middleware/session.js` nạp `req.user.delegations`; `middleware/rbac.js` thêm **lớp 3** cho `can()` (trả `viaDelegationId`, phạm vi mượn qua `inScopeMuon()`); `can()` **vẫn thuần**, không chạm CSDL |
| Dấu vết | ✅ | `middleware/audit.js` chép `viaDelegationId` vào `activity_logs.details` — mỗi hành động mượn quyền đều truy được về bản ủy quyền nào |
| REST (§5) | ✅ | `modules/delegations/{repo,service,routes}.js`; mã lỗi mới ở `utils/errors.js`, dịch lỗi ràng buộc ở `utils/pgError.js` |
| Giao diện (§6) | ✅ | `web/assets/js/app.js` (banner `20260827-78`) + `web/index.html`: nút «Ủy quyền của tôi» dưới khối người dùng, modal 2 bảng, nhãn «đang được ủy quyền». Ghi qua `restGhi` (tự lấy CSRF) — **không** thêm tên RPC thứ 38, cầu giữ **37/37** |
| Test (§7) | ✅ 36 test mới | `tests/unit/delegation-can.test.js`, `tests/integration/delegations-api.test.js` (20), `tests/unit/uy-quyen-ui.test.js` (16) — TC-UQ-01..15 xanh; tổng bộ **1185 test / 69 file** |
| Pin XSS | ✅ 79/566 → **83/588** | `tests/unit/xss-guard.test.js` (TC-SEC-17 + sink `""` 7 → 8) và `docs/XSS-4.6.md` |

Hai điều **cố ý không làm**: (a) client không có ô chọn phòng — phạm vi do máy chủ suy từ
`department_managers`, client chỉ hiện lại và in nguyên văn lỗi `DELEGATION_SCOPE_TOO_WIDE` /
`DELEGATION_OVERLAP`; (b) chưa gửi thông báo cho người được ủy quyền (§8 câu 4).

> **Sửa 2026-08-28:** điểm (b) hết đúng — mục 20 đã chốt nên nay **có** thông báo trong ứng dụng và
> **có** bước phê duyệt (§11). Điểm (a) chỉ còn đúng với **vai thường**: bản ghi từ Giám đốc **buộc**
> phải có phòng (`DELEGATION_ADMIN_SCOPE_REQUIRED`), nên form đã có ô chọn nhiều phòng hiện **riêng
> cho `role === "admin"`** (`buildUyQuyenPhamVi()`, app.js `20260828-81` — xem §13). Vai khác vẫn
> không có ô nào: thêm vào chỉ mời họ đoán rộng hơn quyền thật, mà máy chủ vẫn từ chối.

---

## 10. Test tay giao diện — làm theo đúng thứ tự

Chuẩn bị: `DATABASE_URL=…/quanlycongviec_uat npm run migrate:up` (CSDL khói **không** tự lên
migration 006 — bẫy đã ghi ở `docs/BAT-DAU-SESSION.md` mục 1), rồi đồng bộ `web/` + `server/src/`
lên chỗ đang chạy và khởi động lại Node.

1. **Ctrl+Shift+R** (nạp lại bỏ cache) → mở Console → phải thấy đúng `[QLCV] app.js 20260828-82`.
   Thấy số khác là trình duyệt/Nginx còn giữ file cũ, mọi bước dưới đều vô nghĩa.
2. Đăng nhập bằng **Phó Giám đốc** hoặc **Trưởng phòng** (§13.7, mật khẩu `Test@12345`) → khối
   người dùng góc trên có nút **«Ủy quyền của tôi»** (icon `fa-user-shield`). Đăng nhập bằng
   **Cán bộ** thì nút vẫn hiện và **tạo được** (§13.4 mục 17: mọi cán bộ đều được ủy quyền) —
   ô chọn người nhận chỉ còn người cùng phòng cùng bậc; không có ai như vậy thì ô bị vô hiệu hoá.
3. Bấm nút → modal có **hai bảng**: «Tôi ủy quyền cho» và «Tôi được ủy quyền», ban đầu cả hai nói
   rõ là rỗng («Bạn chưa ủy quyền cho ai.» / «Chưa ai ủy quyền cho bạn.»).
4. Tạo một bản: mở ô **Người nhận** — nó là **ô chọn**, chỉ liệt kê người bạn ủy quyền được (cùng
   phòng, bậc ngang bằng hoặc thấp hơn; ba cặp ngoại lệ ở §11), mỗi dòng đọc «tên — vai · phòng».
   Chọn một người, **Từ ngày** = hôm nay, **Đến ngày** = hôm nay + 7 → Lưu. Bảng «Tôi ủy quyền cho»
   hiện một dòng: người nhận, khoảng ngày `dd/mm/yyyy`, phòng («Tất cả phòng tôi phụ trách» nếu để
   trống), trạng thái **Chờ phê duyệt**, nút **Rút lại**.
5. Tạo lại **đúng cặp người và khoảng ngày trùng** → phải thấy câu lỗi đỏ ngay trong modal (mã
   `DELEGATION_OVERLAP`), không tạo thêm dòng. Chính mình **không có** trong ô chọn, nên không còn
   cách tự ủy quyền cho mình từ giao diện (máy chủ vẫn chặn `DELEGATION_SELF`).
6. **Đăng xuất, đăng nhập bằng người nhận** → cạnh tên có nhãn vàng **«đang được ủy quyền»**; trỏ
   chuột vào nhãn thấy tooltip *«Bạn đang dùng quyền của \<tên người giao\> đến \<dd/mm/yyyy\>»*.
   Người này giờ sửa/duyệt được đúng phần việc của phòng người giao phụ trách, **không** rộng hơn.
7. Kiểm dấu vết: người nhận sửa một công việc trong phạm vi mượn, rồi xem **Nhật ký hoạt động** —
   dòng `works.update` phải có `viaDelegationId` trong `details` (xem nhanh bằng SQL:
   `SELECT details FROM activity_logs ORDER BY id DESC LIMIT 5;`).
8. Quay lại người giao → **Huỷ** bản ủy quyền → xác nhận → dòng đổi sang **Đã huỷ** và **mất nút
   Huỷ**; đăng nhập lại bằng người nhận thì nhãn vàng **tắt** và quyền mượn hết ngay lập tức.
9. Thử XSS: đặt ghi chú `<img src=x onerror=alert(1)>` → phải hiện **nguyên văn chữ**, không có
   hộp thoại nào (TC-UQ-15 đã canh, đây chỉ là xác nhận bằng mắt).

---

## 11. Bốn luật thêm 2026-08-28 (§13.4 mục 17, 18, 20 đã trả lời)

Nguyên văn ba câu chốt của người dùng:

- mục 17: «Mọi cán bộ đều được ủy quyền, Chỉ được ủy quền từ cấp cao xuống cấp thấp hoặc ngang bằng
  nhau theo thứ tự: Giám đốc, phó giám đốc, trưởng phòng, phó phòng, cán bộ»
- mục 18: «Phải cùng phòng, còn giám đốc có thể ủy quyền cho phó giám đốc, phó giám đốc có thể ủy
  quyền cho nhau hoặc trưởng phòng?»
- mục 20: «Cần thông báo và phê duyệt của người được ủy quyền»

| # | Luật | Chỗ chặn | Mã lỗi |
|---|---|---|---|
| R1 | **Mọi cán bộ đều ủy quyền được.** Danh sách `VAI_DUOC_UY_QUYEN` bị **xoá hẳn** — cái chặn không còn là VAI mà là HƯỚNG của ủy quyền (R2, R3). | `service.create` không còn phép kiểm vai | — |
| R2 | **Chỉ từ cấp cao xuống cấp thấp hoặc ngang bằng.** `BAC_VAI`: admin 1 · Phó Giám đốc 2 · Trưởng phòng 3 · Phó phòng 4 · **Quản lý công việc và Nhân viên cùng bậc 5** (cả hai là "cán bộ" trong câu chốt; `Quản lý công việc` không phải một cấp lãnh đạo, nó là vai được giao quản lý một số công việc). Vai lạ ngoài 6 vai ⇒ `bacVai()` trả `null` ⇒ **không** ủy quyền được. | `service.assertBacVaPhong` (bậc kiểm **trước** phòng) | `DELEGATION_RANK_UP` (403) |
| R3 | **Phải cùng phòng**, trừ đúng ba cặp: `admin → Phó Giám đốc`, `Phó Giám đốc → Phó Giám đốc`, `Phó Giám đốc → Trưởng phòng`. Hai vai này làm việc theo ĐƠN VỊ chứ không theo phòng (Giám đốc không thuộc phòng nào, Phó Giám đốc phụ trách nhiều phòng), bắt họ cùng phòng thì luật thành vô nghĩa. | `service.assertBacVaPhong` (`NGOAI_LE_KHAC_PHONG`) | `DELEGATION_DIFFERENT_DEPARTMENT` (403) |
| R4 | **Phải có thông báo và phê duyệt của người được ủy quyền.** Bản ghi mới ra ở `pending` và **không cho mượn gì**; chỉ `POST /:id/accept` của **chính người nhận** mới đưa nó sang `active`. | migration 007 + `repo.listEffectiveFor` (chỉ đọc `active`) + `service.traLoi` | `FORBIDDEN` (403) nếu không phải người nhận |

**Vì sao L2 vẫn còn nguyên tinh thần dù mục 18 cho GĐ → PGĐ.** Hai lớp:

1. `create()` bắt bản ghi từ admin **liệt kê phòng** — `DELEGATION_ADMIN_SCOPE_REQUIRED` (400).
   Phạm vi rỗng nghĩa là "các phòng người ủy quyền phụ trách", mà admin không có dòng
   `department_managers` nào, nên rỗng sẽ hoặc vô nghĩa hoặc (nếu ai đó sửa cách đọc) thành toàn
   hệ thống.
2. `hieuLucCho()` **hạ `from_role='admin'` xuống `'Phó Giám đốc'`** và bỏ hẳn bản admin phạm vi
   rỗng. `middleware/rbac.js` **không sửa một dòng** — nó vẫn bỏ qua mọi `fromRole === 'admin'`,
   nên nếu ai xoá phép hạ vai này thì kết quả là **mất** quyền mượn, không phải nới quyền. Hướng
   sai an toàn được chọn có ý.

### Máy trạng thái (migration `007_delegations_approval.sql`)

```
                 accept (chỉ người nhận)
   pending ──────────────────────────────► active ──► (hết hạn theo to_date, không cần cron)
      │  decline (chỉ người nhận)              │
      ├──────────────────────────► declined    │
      │                                        │
      └──── cancel (người giao/admin) ─────────┴──► cancelled
```

- `status` DEFAULT đổi `'active'` → **`'pending'`**; `CHECK` nhận 4 giá trị
  `pending|active|declined|cancelled`; thêm `accepted_at` / `declined_at timestamptz NULL`.
- `delegation_no_overlap` và `idx_delegations_to_active` nới vị từ sang **`('pending','active')`**:
  hai đề nghị trùng ngày phải đổ ở lúc **TẠO** (lỗi của người giao, sửa được ngay) chứ không đổ lúc
  người nhận bấm «Đồng ý» (khi đó người bấm phải đi giải thích một lỗi không phải của họ).
- Dòng đã có trong CSDL **giữ `'active'`** khi lên 007 — không bắt người ta phê duyệt lại thứ đang
  chạy. `down` đổi `pending`/`declined` thành `cancelled` (không bao giờ trả về `active`).
- Sửa (`PATCH`) được cả `pending` và `active`; `declined`/`cancelled` thì 409 — sửa chúng là hồi
  sinh một bản ghi đã có kết cục.

### Hai route mới — REST, **không** thêm tên RPC

| Method | Đường | Ai gọi được | Việc |
|---|---|---|---|
| POST | `/:id/accept` | **chỉ** `to_user_id` | `pending → active`, ghi `accepted_at`, báo lại người giao |
| POST | `/:id/decline` | **chỉ** `to_user_id` | `pending → declined`, ghi `declined_at`, báo lại người giao |

Kể cả **admin cũng không** bấm hộ được: cả tính năng này tồn tại để không ai bị gán quyền của
người khác mà chưa đồng ý, nên admin đồng ý hộ được thì luật vừa chốt thành hình thức. Bấm lần
hai trả `{ changed: false }` (không lỗi, vì mạng chậm ai cũng bấm hai lần) và **không** sinh thông
báo thứ hai. Cầu RPC vẫn **37/37** — giao diện gọi REST qua `restGhi`.

### Thông báo (mục 20, phần "thông báo")

Một dòng `notifications` cho **đúng một người** mỗi lần: lúc tạo → người nhận («… đề nghị ủy quyền
cho bạn từ … đến …»), lúc trả lời → người giao («… đã ĐỒNG Ý / TỪ CHỐI …»). `ref_type='delegation'`,
`ref_id` = id bản ủy quyền. Hàm `thongBao()` bọc `try/catch` **im lặng** có ý: bản ủy quyền đã ghi
xong và vẫn hiện ở trang «Ủy quyền của tôi», mất một dòng thông báo không đáng đánh sập cả hành
động. **Vẫn KHÔNG email** (§13.4 mục 4). Chưa làm: nhắc "sắp hết hạn", và đường ĐỌC thông báo trên
giao diện vẫn chờ §13.4 mục 16 (chuông) — hiện người dùng thấy đề nghị ở chính trang ủy quyền.

### Giao diện (app.js `20260828-82`)

`buildUyQuyenNut(lop, mau, icon, nhan, id, nguoi)` gom cả ba nút; năm nhãn trạng thái là chuỗi
**HẰNG** chọn theo `row.status` (dữ liệu lạ rơi vào nhánh «Chưa/hết hiệu lực», không in ra):

| Trạng thái | Nhãn | Người GIAO thấy | Người NHẬN thấy |
|---|---|---|---|
| `pending` | «Chờ phê duyệt» (xanh dương) | **Rút lại** | **Đồng ý** + **Từ chối** |
| `active` | «Đang hiệu lực» (xanh lá) | **Huỷ** | — |
| `declined` | «Đã từ chối» (đỏ) | — | — |
| `cancelled` | «Đã huỷ» (xám) | — | — |
| còn lại | «Chưa/hết hiệu lực» (hổ phách) | **Huỷ** nếu chưa kết thúc | — |

Form «Ủy quyền mới» có thêm **ô chọn nhiều phòng** (`buildUyQuyenPhamVi()` → `select[name=
"departmentIds"] multiple required`) **chỉ hiện khi `currentUser.role === "admin"`**, và
`taoUyQuyen()` đọc nó bằng `FormData.getAll("departmentIds")` rồi gửi mảng SỐ. Vai khác không có ô
nào — máy chủ suy phạm vi từ `department_managers`; còn Giám đốc không có dòng nào ở bảng đó nên máy
chủ **bắt** liệt kê phòng, tức thiếu ô này thì mục 18 («giám đốc có thể ủy quyền cho phó giám đốc»)
không làm được từ trình duyệt. Giao diện chặn sớm đúng bằng luật máy chủ, không rộng hơn.

Ô **«Người nhận»** (2026-08-28, yêu cầu «cái này là sẽ chọn người, danh sách hiện ra sẽ đúng theo
luồng đã nói») không còn là ô gõ email tự do mà là `select[name="to"] required` do
`buildUyQuyenNguoiNhan()` dựng. Danh sách ứng viên (`dsNguoiNhanUyQuyen()`) là **bản sao đọc-only**
của `assertBacVaPhong` phía máy chủ — hai hằng `UQ_BAC_VAI` / `UQ_KHAC_PHONG` sao nguyên văn
`BAC_VAI` / `NGOAI_LE_KHAC_PHONG`:

| Tôi là | Ô chọn hiện ai |
|---|---|
| Giám đốc | Phó Giám đốc (mọi phòng) — mục 18 |
| Phó Giám đốc | Phó Giám đốc và Trưởng phòng (mọi phòng), cùng người **cùng phòng** bậc ≥ 2 |
| Trưởng phòng | người **cùng phòng** bậc ≥ 3 (Phó phòng, Quản lý công việc, Cán bộ) |
| Phó phòng | người **cùng phòng** bậc ≥ 4 |
| Quản lý công việc / Cán bộ | người **cùng phòng** cùng bậc 5 |

Ba chỗ luôn bị loại: chính mình (so bằng email), **Nhà cung cấp**, và vai lạ (không có trong
`UQ_BAC_VAI` ⇒ không biết bậc thì không đoán). Giá trị `<option>` vẫn là EMAIL nên `taoUyQuyen()`
gửi khoá `toUserId` y như cũ. So phòng phải qua **TÊN** phòng vì `staffToLegacy` chỉ trả `COL.S_DEPT`
là tên — `tenPhongCuaToi()` đổi `currentUser.department_id` sang tên trước khi so; tra không ra thì
danh sách rỗng chứ **không** mở ra cả cơ quan. Lọc này luôn **hẹp hơn hoặc bằng** máy chủ: giao diện
không có cột `is_active` nên người bị vô hiệu hoá vẫn có thể lọt vào ô chọn và máy chủ mới là chỗ
chặn. Không còn ai hợp lệ thì ô bị `disabled` kèm câu nói rõ lý do, thay vì mời bấm gửi để nhận 400.

### Test đã thêm

| Mã | Tầng | Nội dung |
|---|---|---|
| TC-UQ-01c/01d | migration | 007: `accepted_at`/`declined_at` nullable, DEFAULT `pending`, CHECK đúng 4 giá trị (`'accepted'` bị chặn — dễ gõ nhầm vì service có hàm `accept`) |
| TC-UQ-04c | CSDL | bản `pending` **vẫn** chặn chồng lấp; bản `declined` thì không |
| TC-UQ-05 | API | GĐ → PGĐ: thiếu phòng ⇒ `DELEGATION_ADMIN_SCOPE_REQUIRED`, có phòng ⇒ 201 `pending` |
| TC-UQ-05c | API | R1 + R3: cùng phòng ⇒ 201; khác phòng ⇒ `DELEGATION_DIFFERENT_DEPARTMENT` |
| TC-UQ-05d | API | R2: Nhân viên → PGĐ **cùng phòng** và TP → PGĐ đều ⇒ `DELEGATION_RANK_UP` |
| TC-UQ-05e | API | ba cặp ngoại lệ chạy được; GĐ → Nhân viên **vẫn** chặn |
| TC-UQ-13 | API | bản `pending` **không** cho mượn quyền; sau `accept` mới sửa được và nhật ký có `viaDelegationId` |
| TC-UQ-16..16g | API | thông báo đúng người · chỉ người nhận trả lời (người giao và **admin** đều 403) · `accept` ghi mốc + nhật ký `delegations.accept` · bấm hai lần `changed:false` không sinh thông báo thứ hai · `decline` rồi thì không mượn được và không hồi sinh · bản `cancelled` không trả lời được · id lạ 404, chưa đăng nhập 401 |
| TC-UQ-17 | API | người nhận ủy quyền **từ Giám đốc** làm được việc ở phòng đã ghi, **không** phòng khác, **không** quản trị người dùng (L2 + L4) |
| TC-UQ-16 (jsdom) | jsdom | 5 nhãn trạng thái, hai nút của người nhận, `data-id`/`data-nguoi` phải thoát |
| TC-UQ-18 (jsdom) | jsdom | ô phòng **chỉ** hiện với admin · option mang id thật · phòng thiếu `ID phòng (DB)` bị bỏ · tên phòng có mã tấn công không dựng được thẻ |
| TC-UQ-18b (jsdom) | jsdom | `taoUyQuyen()` gửi `departmentIds` là mảng SỐ · admin quên chọn phòng ⇒ **không** gọi máy chủ · vai thường **không** gửi khoá đó |
| TC-UQ-19 (jsdom) | jsdom | danh sách người nhận theo từng vai · ba cặp ngoại lệ khác phòng · loại chính mình / Nhà cung cấp / dòng thiếu email / vai lạ · xếp theo bậc rồi tên · phòng tra không ra ⇒ rỗng chứ không mở rộng |
| TC-UQ-19b (jsdom) | jsdom | ô người nhận là `select[name="to"] required`, **không** còn `input[name="to"]` hay datalist · option mang email chữ thường + nhãn «tên — vai · phòng» · rỗng ⇒ `disabled` + nói lý do · tên có mã tấn công không dựng được thẻ |

## 12. Test tay phần phê duyệt — làm sau §10

1. `DATABASE_URL=…/quanlycongviec_uat npm run migrate:up` (**bắt buộc**: 007 không tự lên ở CSDL
   khói), đồng bộ `web/` + `server/src/`, khởi động lại Node, **Ctrl+Shift+R** → Console phải in
   đúng `[QLCV] app.js 20260828-82`.
2. Đăng nhập **Trưởng phòng**, tạo ủy quyền cho một **Nhân viên cùng phòng** → dòng mới mang nhãn
   xanh dương **«Chờ phê duyệt»**, nút bên phải là **«Rút lại»** (không phải «Huỷ»).
3. Thử tạo cho **Nhân viên phòng khác** → câu lỗi đỏ *«Chỉ ủy quyền được cho người cùng phòng…»*.
   Thử tạo cho **Phó Giám đốc** → *«Chỉ ủy quyền được cho cấp thấp hơn hoặc ngang bằng…»*.
4. Đăng nhập **người nhận** → bảng «Tôi được ủy quyền» có dòng đó với **hai nút «Đồng ý» / «Từ
   chối»**; **chưa** có nhãn vàng «đang được ủy quyền» và **chưa** sửa được gì của phòng — đây là
   điểm cốt của mục 20.
5. Bấm **«Đồng ý»** → dòng đổi sang **«Đang hiệu lực»**, hai nút biến mất, nhãn vàng bật, quyền
   mượn có ngay. Bấm lại lần nữa (nếu còn kịp) không được đổi gì.
6. Đăng nhập lại **người giao** → có **thông báo** «… đã ĐỒNG Ý …» trong bảng `notifications`
   (chưa có chuông trên giao diện — §13.4 mục 16): `SELECT content FROM notifications ORDER BY id
   DESC LIMIT 3;`.
7. Lặp lại với **«Từ chối»** trên một bản khác → nhãn đỏ **«Đã từ chối»**, người nhận **không** có
   quyền mượn, và người giao **tạo lại được** đúng khoảng ngày đó (bản `declined` không chặn chồng
   lấp).
8. Đăng nhập **Giám đốc**, mở «Ủy quyền của tôi» → form phải có ô **«Phòng được mượn quyền»** (vai
   khác **không** thấy ô này). Chọn Phó Giám đốc, **không** chọn phòng nào → trình duyệt chặn ngay
   với câu *«Giám đốc phải ghi rõ (các) phòng…»* mà không gọi máy chủ; chọn một phòng thì tạo được.
   Sau khi PGĐ đồng ý, họ làm được việc của Phó Giám đốc trong **đúng phòng đó** và **không** vào
   được Quản lý người dùng.

> **Đã kiểm chứng bằng REST 2026-08-28** (CSDL nháp riêng, đã xoá; **không** đụng bộ mẫu UAT của
> người dùng). Chuỗi 8 bước của luồng phê duyệt chạy thật, `admin@test.local` → `pgd2@test.local`:
>
> | Bước | Kết quả thật |
> | --- | --- |
> | GĐ tạo mà thiếu phòng | `400 DELEGATION_ADMIN_SCOPE_REQUIRED` |
> | GĐ tạo có `departmentIds:[1]` | `201`, `status = pending`, `department_ids = [1]` |
> | **GĐ tự** `accept` bản của mình | `403` (người giao không tự phê duyệt được — cốt của mục 20) |
> | PGĐ `accept` | `200`, `status = active` |
> | PGĐ `accept` lần hai | `200` `changed: false` (không đổi trạng thái lần nữa) |
> | PGĐ đọc «Tôi được ủy quyền» | `active`, `dang_hieu_luc = true`, phạm vi `[1]` |
> | PGĐ `POST /api/v1/users` | `403` — quyền mượn **không** chạm L4 |
> | GĐ `DELETE /delegations/:id` | `200` (huỷ mềm, dọn sạch) |
>
> Còn lại phần **mắt người** — nhãn màu, hai nút «Đồng ý»/«Từ chối», ô chọn phòng chỉ hiện với
> Giám đốc — vẫn phải chạy trên trình duyệt theo §10 và các bước 2–8 ở trên.


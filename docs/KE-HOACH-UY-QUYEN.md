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
| L2 | **Không ủy quyền vai `admin`.** Người ủy quyền là admin ⇒ từ chối ngay (`DELEGATION_ADMIN_FORBIDDEN`). | Quyền admin gồm cả xoá phòng, xoá người, sửa vai trò người khác. Mượn được quyền đó nghĩa là mượn được cả quyền tự nâng mình thành admin vĩnh viễn — ủy quyền hết hạn cũng vô nghĩa. |
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
- `DELEGATION_ADMIN_FORBIDDEN` — ủy quyền vai admin (L2)
- `DELEGATION_SCOPE_TOO_WIDE` — phạm vi vượt quá quyền người ủy quyền (L3)
- `DELEGATION_OVERLAP` — trùng khoảng ngày với bản ghi `active` khác (409)

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

---

## 10. Test tay giao diện — làm theo đúng thứ tự

Chuẩn bị: `DATABASE_URL=…/quanlycongviec_uat npm run migrate:up` (CSDL khói **không** tự lên
migration 006 — bẫy đã ghi ở `docs/BAT-DAU-SESSION.md` mục 1), rồi đồng bộ `web/` + `server/src/`
lên chỗ đang chạy và khởi động lại Node.

1. **Ctrl+Shift+R** (nạp lại bỏ cache) → mở Console → phải thấy đúng `[QLCV] app.js 20260827-78`.
   Thấy số khác là trình duyệt/Nginx còn giữ file cũ, mọi bước dưới đều vô nghĩa.
2. Đăng nhập bằng **Phó Giám đốc** hoặc **Trưởng phòng** (§13.7, mật khẩu `Test@12345`) → khối
   người dùng góc trên có nút **«Ủy quyền của tôi»** (icon `fa-user-shield`). Đăng nhập bằng
   **Nhân viên** thì nút vẫn hiện nhưng tạo sẽ bị máy chủ trả **403** — đúng thiết kế (máy chủ là
   rào chặn cuối, không ẩn nút để giả vờ an toàn).
3. Bấm nút → modal có **hai bảng**: «Tôi ủy quyền cho» và «Tôi được ủy quyền», ban đầu cả hai nói
   rõ là rỗng («Bạn chưa ủy quyền cho ai.» / «Chưa ai ủy quyền cho bạn.»).
4. Tạo một bản: chọn email người nhận trong danh sách gợi ý, **Từ ngày** = hôm nay, **Đến ngày** =
   hôm nay + 7 → Lưu. Bảng «Tôi ủy quyền cho» hiện một dòng: người nhận, khoảng ngày `dd/mm/yyyy`,
   phòng («Tất cả phòng tôi phụ trách» nếu để trống), trạng thái **Đang hiệu lực**, nút **Huỷ**.
5. Tạo lại **đúng cặp người và khoảng ngày trùng** → phải thấy câu lỗi đỏ ngay trong modal (mã
   `DELEGATION_OVERLAP`), không tạo thêm dòng. Tự ủy quyền cho chính mình cũng bị chặn.
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

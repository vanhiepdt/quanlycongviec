# Kế hoạch — THÔNG BÁO: chuông trong ứng dụng + đẩy sang Zalo

Yêu cầu người dùng (2026-09-06): «làm chức năng thông báo, khi có thông báo phê duyệt gì thì nổi
lên thông báo. Thêm thông báo đến zalo bot creator để thông báo đến zalo người nhận nữa».

Đây là câu trả lời cho **§13.4 mục 16** (treo từ 2026-08-27) — chọn **phương án (b)**: mở đường ĐỌC
thông báo + vẽ chuông. Và mở thêm **mục 25** mới cho phần Zalo.

## 1. Đã có sẵn — KHÔNG làm lại

| Thứ | Ở đâu |
| --- | --- |
| Bảng `notifications` | `001_init.sql`: `user_id`, `content`, `type`, `is_read`, `ref_type`, `ref_id`, `created_at` |
| Đọc / đếm / đánh dấu đã đọc | `notifications/repo.js`: `listByUser`, `countUnread`, `markRead`, `exists` |
| Ghi thông báo khi DUYỆT | `approvals/service.js` — gửi duyệt (`CHO_DUYET` cho Phó GĐ phụ trách), duyệt, từ chối, xin xoá |
| Ghi thông báo ỦY QUYỀN | `delegations/service.js` (`ref_type='delegation'`) |
| Ghi thông báo KẾT QUẢ FILE | `taskFiles/service.js` (`file:approve`, `da-duyet`, `cho-lanh-dao`) |
| Ghi thông báo QUÁ HẠN | `services/cron.js` `quetQuaHan()`, chống trùng bằng `repo.exists` |
| Lịch chạy có sẵn | `services/cron.js` + `CRON_ENABLED`, `node-cron` đã cài |
| Mẫu «tính năng tắt khi thiếu env» | `ONLYOFFICE_URL`/`ONLYOFFICE_JWT_SECRET` trống ⇒ ẩn nút |
| Mẫu route máy-đối-máy không CSRF | `api.use('/v1/task-files-ds', ...)` mount **trước** `issueCsrfCookie` (`app.js:75`) |
| Mẫu gọi REST không thêm tên RPC | `restGet` / `restGetIm` / `restGhi` trong `app.js` (ủy quyền đang dùng) |

**Thiếu đúng ba thứ**: (a) không có `GET /notifications` nên không ai đọc được — thông báo hiện chỉ
là dấu vết trong CSDL; (b) giao diện không có chuông; (c) không có đường đẩy ra Zalo.

## 2. Tài liệu Zalo — đã tra ngày 2026-09-06, dẫn nguồn

Hai họ API khác nhau, **không** phải một:

### 2.1 Zalo Bot API — CHỌN CÁI NÀY

Nguồn: <https://docs.zaloplatforms.com/docs/BOT> · <https://docs.zaloplatforms.com/docs/BOT/create_bot>
· <https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage> ·
<https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook> · <https://docs.zaloplatforms.com/docs/BOT/webhook>
(trang ghi «Stable v2.5.0», build 2026-09-03).

Tạo bot: mở app Zalo → tìm OA **«Zalo Bot Manager»** → menu cửa sổ chat chọn **«Tạo bot»** để vào
**Zalo Bot Creator** → tên bot **bắt buộc bắt đầu bằng tiền tố `Bot`** → hệ thống gửi **Bot Token**
qua tin nhắn Zalo. **Không** cần đăng ký doanh nghiệp, **không** cần OAuth, token là chuỗi tĩnh.

| Việc | Cách gọi |
| --- | --- |
| Kiểm tra token | `POST https://bot-api.zaloplatforms.com/bot${BOT_TOKEN}/getMe`, body `{}` → `{ok, result:{id, account_name, account_type, can_join_groups}}` |
| Gửi tin | `POST .../bot${BOT_TOKEN}/sendMessage`, body `{chat_id, text}`; `text` **1–2000 ký tự**; tuỳ chọn `parse_mode: "markdown"\|"html"` hoặc `text_styles` (hai cái loại trừ nhau, `parse_mode` thắng) |
| Đăng ký webhook | `POST .../setWebhook`, body `{url, secret_token}`; `secret_token` **8–256 ký tự** |
| Nhận sự kiện | Zalo `POST` vào URL của mình, header **`X-Bot-Api-Secret-Token`** = đúng `secret_token` đã đặt |

Hình dạng webhook (nguyên văn tài liệu):

```json
{ "ok": true, "result": {
    "message": {
      "from": { "id": "6ede9afa66b88fe6d6a9", "display_name": "Ted", "is_bot": false },
      "chat": { "id": "6ede9afa66b88fe6d6a9", "chat_type": "PRIVATE" },
      "text": "Xin chào", "message_id": "2d758cb5e222177a4e35", "date": 1750316131602 },
    "event_name": "message.text.received" } }
```

`event_name` nhận `message.{text,image,sticker,voice,unsupported}.received`. Tài liệu nói rõ **dùng
`chat.id` để gửi tin trả lời**.

**Hai ràng buộc quan trọng, ghi đúng như tài liệu nói:**

1. **Webhook URL phải truy cập được từ Internet công khai** — `localhost`, `127.0.0.1`,
   `192.168.x.x`, `10.x.x.x` **bị từ chối**; máy dev phải dùng ngrok / Cloudflare Tunnel. Với hệ
   này nghĩa là: **phần webhook chỉ chạy được sau khi Phase 8 có domain + HTTPS thật.**
2. `getUpdates` (long polling) và webhook **loại trừ lẫn nhau**; tài liệu khuyên `getUpdates` chỉ
   dùng khi chạy local/dev, production thì đặt webhook để không bỏ lỡ sự kiện.

**CHƯA xác minh được** (tài liệu không nói, phần FAQ dựng bằng JS nên không đọc được bằng máy):
bot có gửi tin **chủ động** cho người **chưa từng** nhắn cho bot hay không, và hạn mức số tin/ngày.
Nhưng điều đó **không chặn thiết kế**: dù có được hay không, ta vẫn cần `chat_id` của từng người,
mà `chat_id` chỉ xuất hiện trong webhook khi họ nhắn cho bot ⇒ **bắt buộc có bước liên kết một lần**
(§4.2). Việc «gửi chủ động được không» sẽ biết chắc ở lượt test thật đầu tiên.

### 2.2 Zalo OA API — KHÔNG chọn, ghi lại để khỏi tra lại

Nguồn: <https://docs.zaloplatforms.com/docs/OA> ·
<https://docs.zaloplatforms.com/docs/OA/tin-nhan/tin-tu-van/gui-tin-tu-van-dang-van-ban> ·
<https://docs.zaloplatforms.com/docs/OA/tin-nhan/tin-tu-van/dieu-kien-gui-tin-tu-van> ·
<https://docs.zaloplatforms.com/docs/OA/tin-nhan/tin-giao-dich/dieu-kien-gui-tin-giao-dich>

- Gửi tin tư vấn: `POST https://openapi.zalo.me/v3.0/oa/message/cs`, header **`access_token`** (không
  phải `Authorization: Bearer`), body `{recipient:{user_id}, message:{text}}`, tối đa 2.000 ký tự.
- **Điều kiện tin Tư vấn: người nhận phải có tương tác với OA trong vòng 7 NGÀY.** Tin Giao dịch nới
  ra **1 năm** nhưng thông báo ngoài app chỉ đẩy trong khung **6h00–21h59**.
- Xác thực: PKCE + `POST https://oauth.zaloapp.com/v4/oa/access_token` (header `secret_key`), phải
  làm mới token định kỳ.
- `user_id` là **theo từng OA**, phải lấy qua API danh sách người quan tâm — không phải số điện thoại.

**Vì sao bỏ**: cần có Official Account + app đăng ký + vòng OAuth có làm mới token + cửa sổ 7 ngày.
Cửa sổ 7 ngày là thứ giết ý tưởng này: thông báo phê duyệt là việc thưa, người không nhắn cho OA
trong tuần đó thì **không nhận được** — mà đúng người đó mới là người cần nhắc.

### 2.3 Thư viện npm — KHÔNG dùng

`node-zalo-bot@0.1.6`, phát hành **2025-07-22** (hơn một năm không cập nhật), ~852 lượt tải/tháng,
**một** người bảo trì, **không khai license, không khai repository**. Phụ thuộc gồm
`@cypress/request` (nhánh rẽ của một thư viện đã ngừng, vốn là công cụ test), `bl@1.2.3`,
`file-type@3.9.0`, `mime@1.6.0`, `eventemitter3@3` — toàn bản cũ. Kéo cả cây đó vào để gọi **một**
endpoint POST là đánh đổi tệ, lại vi phạm ràng buộc «không thêm thư viện mới».

Node 24 có `fetch` toàn cục ⇒ viết `services/zalo.js` khoảng 60 dòng, **không thêm phụ thuộc nào**.

## 3. Việc A — chuông trong ứng dụng (làm trước, không phụ thuộc Zalo)

### A1. Máy chủ — mở đường ĐỌC

`notifications/routes.js` thêm ba route, chặn quyền trong service như module này đang làm:

| Route | Trả về | Ghi chú |
| --- | --- | --- |
| `GET /api/v1/notifications?limit=&onlyUnread=` | `{items, unread}` | Chỉ thông báo **của chính người gọi** — `repo.listByUser(req.user.id)`, không nhận `userId` từ query (nhận là đọc hộ người khác) |
| `PATCH /api/v1/notifications/read` | `{changed}` | Body `{ids: [] }` rỗng ⇒ đánh dấu **tất cả**; `repo.markRead` đã luôn có `user_id = $1` trong WHERE |
| `GET /api/v1/notifications/unread-count` | `{unread}` | Cho vòng hỏi lại — nhẹ hơn `GET /notifications` |

`service.js` thêm `docCua(user, opts)` / `danhDauDaDoc(user, ids)`: **không** `assertAdmin` (đây là
đọc thông báo của chính mình), chỉ `requireAuth` ở router. `AppError('UNAUTHENTICATED')` khi thiếu
`user` như `assertAdmin` đang làm.

Cập nhật **§5.2** của `KE-HOACH-VPS.md` **trước** khi viết mã (điều kiện của mục 16). Ghi rõ đây là
route REST **không có tên RPC tương ứng** — cầu vẫn **37/37**, giao diện gọi bằng `restGetIm`/`restGhi`
như phần ủy quyền, để không phải mở tên RPC thứ 38.

Cho `bootstrap/service.js` trả thêm `unreadCount` (cạnh `pendingCount` sẵn có ở dòng 197): chuông có
số **ngay lần vẽ đầu**, không phải chờ một vòng fetch.

### A2. Giao diện — chuông cạnh nút chat

`index.html`: thêm khối chuông **trước** khối Chat trong header (`index.html:419`), dùng đúng khuôn
Alpine `x-data="{ open: false }"` + `@click.away` của Chat, badge cùng kiểu `#chat-badge`.

```
🔔 [3]   ← #thong-bao-nut, #thong-bao-badge
 └ hộp: #thong-bao-danh-sach + nút «Đánh dấu đã đọc hết»
```

`app.js` thêm:
- `napThongBao()` — `restGetIm("/api/v1/notifications?limit=30")`, vẽ bằng builder
  `buildDanhSachThongBao(items)` / `buildMotThongBao(row)` (tên `build*` để bộ soát XSS xếp HTML-LONG
  đúng — **bẫy đã biết** §13.5: hàm trả HTML không đặt tên `build*` thì mỗi chỗ gọi bị đếm `CAN-THOAT`).
- Icon + màu theo `type`, dùng lại bản đồ đang có ở `app.js:2058` (`approval_pending` → `fa-bell`
  hổ phách, `approval_approved` → xanh, `approval_rejected` → đỏ, `overdue` → cam).
- **Bấm vào thông báo có `ref_type`/`ref_id`** thì mở đúng mục: `work` → `showProjectDetailsModal`,
  `work_item` → `openEditModal('task', ...)`. Không có ref ⇒ chỉ đánh dấu đã đọc.
- `capNhatBadgeThongBao(n)` — cùng khuôn `updateChatBadge`.
- Vòng hỏi lại **60 giây** (`THONG_BAO_POLL_MS`), gọi `/unread-count`; chat đang dùng 10 giây, nhưng
  thông báo phê duyệt không cần nhanh bằng chat, và mỗi lượt là một truy vấn `count(*)`.
  **Chỉ hỏi khi tab đang hiện** (`document.visibilityState === "visible"`) — chat đang bỏ sót điều này.
- Sau khi DUYỆT / TỪ CHỐI / GỬI DUYỆT xong thì gọi `napThongBao()` ngay, không đợi hết 60 giây.

**Bẫy Tailwind** (§13.5): bản vendored cắt sẵn thiếu lớp. Lớp nào mới dùng phải kiểm bằng
`grep` trong `web/assets/vendor/tailwind/tailwind.min.css`, thiếu thì khai bù ở cuối `app.css` —
đúng như đã làm cho `bg-rose-600`. Badge chuông dùng lại `bg-red-500` của `#chat-badge` (đã có sẵn).

### A3. Test việc A

| Mã | Nội dung |
| --- | --- |
| TC-TB-01..04 | `notifications-api.test.js`: người A **không** đọc được thông báo người B; `markRead` không có `ids` ⇒ tất cả của mình; `markRead` với `ids` của người khác ⇒ `changed = 0`; `limit` bị chặn trên 200 |
| TC-TB-05 | `GET /unread-count` khớp `countUnread` |
| TC-TB-06 | `bootstrap` trả `unreadCount` |
| TC-TBUI-01..06 | `thong-bao-ui.test.js` (jsdom, app.js thật): badge ẩn khi 0; nội dung chứa `<img src=x onerror=…>` **không** dựng ra thẻ; bấm dòng có `ref_type=work` gọi `showProjectDetailsModal` đúng mã; «đọc hết» xoá badge; vòng hỏi lại **không** chạy khi tab ẩn |
| TC-SEC-17 | Cập nhật pin XSS — đếm lại bằng `tools/dem-xss.mjs`, ghi delta từng lỗ vào `docs/XSS-4.6.md`. **Nhãn tĩnh không bọc `escapeHtml`** (bẫy 2026-09-06) |

File jsdom mới **phải** khai vào danh sách `files` của `server/eslint.config.js` (ghi ở
`docs/BAT-DAU-SESSION.md`).

## 4. Việc B — đẩy sang Zalo (làm sau A, tách hẳn)

### B1. Nguyên tắc chặn trước khi viết dòng nào

1. **Zalo là kênh PHỤ.** Thông báo trong CSDL + chuông là nguồn chính. Zalo lỗi / token sai / mạng
   chết ⇒ **chỉ ghi log**, tuyệt đối không được làm đổ hành động duyệt. Cùng cách `delegations`
   đang `try/catch` im lặng quanh `notificationsRepo.insert`.
2. **Mặc định TẮT.** `ZALO_BOT_TOKEN` trống ⇒ không gọi mạng, không hiện gì trên giao diện. Cùng
   khuôn `ONLYOFFICE_URL`.
3. **Không gửi trong transaction.** `approvals/service.js` gửi thông báo **bên trong**
   `withTransaction` đang giữ khoá dòng công việc. Một lời gọi HTTP ra Internet trong đó là giữ khoá
   theo độ trễ của Zalo. ⇒ đẩy Zalo **sau khi commit**, đọc từ hàng đợi.
4. **Không đưa nội dung nhạy cảm ra ngoài.** Tin Zalo chỉ chứa: loại việc, mã, tên đầu việc, ai gửi,
   và một câu «mở hệ thống để xem». **Không** gửi mô tả, ý kiến, tên file, lý do từ chối.

### B2. Liên kết tài khoản — bước không thể bỏ

`chat_id` của Zalo Bot chỉ xuất hiện khi người đó **nhắn cho bot**. Không có cách nào tra từ số điện
thoại hay email. ⇒ **migration 017**:

```sql
ALTER TABLE users ADD COLUMN zalo_chat_id text;
CREATE UNIQUE INDEX ux_users_zalo_chat_id ON users (zalo_chat_id) WHERE zalo_chat_id IS NOT NULL;
CREATE TABLE zalo_link_codes (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,          -- 6 chữ số, sinh bằng crypto.randomInt
  expires_at timestamptz NOT NULL,    -- 15 phút
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Luồng: người dùng vào «Thông báo Zalo» trong trang cá nhân → bấm «Lấy mã liên kết» → hệ thống hiện
mã 6 số + hướng dẫn «nhắn `LIENKET 123456` cho bot **Bot QLCV**» → webhook nhận
`message.text.received`, tách mã, tìm `zalo_link_codes` còn hạn chưa dùng → ghi
`users.zalo_chat_id = result.message.chat.id`, đánh dấu `used_at` → bot `sendMessage` xác nhận.

**Vì sao mã một lần chứ không gõ email**: nếu bot nhận email rồi tự liên kết thì bất kỳ ai biết email
của người khác đều chiếm được kênh thông báo của họ. Mã 6 số + 15 phút + một lần dùng khoá điều đó
lại đúng người đang đăng nhập.

`unique index` trên `zalo_chat_id`: một tài khoản Zalo không liên kết được hai người dùng — nếu
không thì hai người đổi nhau lại nhận thông báo của nhau.

**Bẫy `PUBLIC_COLUMNS`**: `users/repo.js:13` liệt kê tường minh các cột trả ra API, và `WRITABLE`
liệt kê cột được phép ghi. `zalo_chat_id` **không** thêm vào `WRITABLE` (không ai sửa nó qua
`PATCH /users/:id` — chỉ webhook và lệnh gán tay ghi được), và **không** thêm vào `PUBLIC_COLUMNS`
thô: giao diện chỉ cần biết «đã liên kết hay chưa», nên trả `zalo_da_lien_ket boolean` suy ra từ
`zalo_chat_id IS NOT NULL`. `chat_id` là định danh trên Zalo của một người — không phát tán nó cho
mọi người xem danh sách cán bộ.

### B3. `services/zalo.js` — dùng `fetch` của Node, KHÔNG thêm gói

```js
export async function guiTinZalo({ chatId, text }) { /* POST bot${TOKEN}/sendMessage */ }
export async function kiemTraToken() { /* getMe — chỉ dùng cho lệnh tự kiểm */ }
```

- `AbortSignal.timeout(10_000)` — không để một lời gọi treo giữ tiến trình.
- Cắt `text` về **2000 ký tự** (giới hạn tài liệu ghi rõ), cắt ở ranh giới ký tự, có «…».
- **Không** dùng `parse_mode`: nội dung có tên đầu việc do người dùng gõ; bật markdown/html là mở
  đường cho `*`/`<b>` của họ đổi định dạng tin. Gửi văn bản thuần.
- Đọc `ok` trong body: tài liệu trả `{ok: true, result: …}`, nên **HTTP 200 chưa chắc là thành công**.
- Log lỗi kèm `chat_id` nhưng **không** log token.

### B4. Hàng đợi + lịch đẩy

Thêm cột vào `notifications` (migration 017 luôn, cùng lượt):

```sql
ALTER TABLE notifications
  ADD COLUMN zalo_sent_at   timestamptz,
  ADD COLUMN zalo_attempts  int NOT NULL DEFAULT 0,
  ADD COLUMN zalo_error     text NOT NULL DEFAULT '';
CREATE INDEX ix_notifications_zalo_pending
  ON notifications (id) WHERE zalo_sent_at IS NULL AND zalo_attempts < 3;
```

`services/cron.js` thêm `dayThongBaoZalo({ now })` theo đúng khuôn `quetQuaHan`:
hàm thường nhận đồng hồ từ ngoài, lịch chỉ gọi nó (để test chạy được trong một phần nghìn giây).

- Lịch `CRON_ZALO_PUSH` mặc định **`*/2 * * * *`** (2 phút), cùng cờ `CRON_ENABLED`.
- Mỗi lượt lấy tối đa 50 dòng `zalo_sent_at IS NULL AND zalo_attempts < 3`, **JOIN** `users` để có
  `zalo_chat_id`; người **chưa liên kết** ⇒ đánh `zalo_sent_at = now()` với
  `zalo_error = 'chưa liên kết Zalo'` để không quét lại mãi.
- Chỉ đẩy các `type` đáng làm phiền: `approval_pending`, `approval_rejected`, `overdue`. **Không**
  đẩy `approval_approved` và `info` — duyệt xong là tin vui, không cần rung điện thoại; và không đẩy
  thông báo cũ hơn **24 giờ** (container tắt ba ngày rồi bật lại không được dội một tràng tin).
- Thất bại ⇒ `zalo_attempts += 1`, ghi `zalo_error`; đủ 3 lần thì thôi (chỉ mục đã lọc sẵn).

**Vì sao hàng đợi trong bảng chứ không đẩy ngay tại chỗ gọi**: (a) không giữ khoá transaction theo độ
trễ mạng (B1.3); (b) container khởi động lại giữa chừng vẫn không mất tin — biến nhớ thì mất, đúng
lý lẽ đã ghi ở đầu `services/cron.js`; (c) một chỗ duy nhất kiểm «đã gửi chưa», không rải `try/catch`
khắp `approvals`/`taskFiles`/`delegations`.

### B5. Webhook nhận tin từ Zalo

`POST /api/zalo-bot/webhook` — mount **TRƯỚC** `issueCsrfCookie`/`verifyCsrf` như
`/v1/task-files-ds` (`app.js:75`): Zalo gọi máy-đối-máy, không có cookie phiên.

Chặn bằng đúng cái tài liệu đưa ra: so **`X-Bot-Api-Secret-Token`** với `ZALO_BOT_SECRET_TOKEN` bằng
**`crypto.timingSafeEqual`** (so bằng `!==` là rò rỉ theo thời gian). Sai ⇒ **403**, không giải thích.

Chỉ xử `event_name === 'message.text.received'`, chỉ nhận cú pháp `LIENKET <6 số>`; mọi thứ khác trả
`{ok:true}` rồi bỏ qua — webhook **luôn** phải trả 2xx nhanh, không thì Zalo coi là hỏng
(`verification.outcome`).

**Ràng buộc thật**: webhook cần **domain công khai + HTTPS** (tài liệu từ chối `localhost` và IP nội
bộ) ⇒ **phần B5 chỉ nghiệm thu được ở Phase 8**. Trước đó, để test được ngay, thêm lệnh
`npm run zalo:link -- <email> <chat_id>` gán tay, và `getUpdates` cho máy dev.

### B6. Biến môi trường (`config/env.js`, nhóm `optional`)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `ZALO_BOT_TOKEN` | `''` | Trống = **TẮT** cả tính năng |
| `ZALO_BOT_SECRET_TOKEN` | `''` | `secret_token` của `setWebhook`, 8–256 ký tự |
| `ZALO_BOT_API_BASE` | `https://bot-api.zaloplatforms.com` | Để đổi được khi Zalo dời tên miền, và để test trỏ vào máy chủ giả |
| `CRON_ZALO_PUSH` | `*/2 * * * *` | Lịch đẩy |
| `ZALO_PUSH_MAX_AGE_H` | `24` | Bỏ qua thông báo cũ hơn N giờ |

`ZALO_BOT_TOKEN` là **bí mật**: không log, không trả về trong bất kỳ phản hồi API nào, không ghi vào
`activity_logs`.

### B7. Test việc B

| Mã | Nội dung |
| --- | --- |
| TC-ZL-01..03 | `zalo-service.test.js`: `fetch` bị giả — gửi đúng URL `bot<token>/sendMessage`, body `{chat_id,text}`; `text` > 2000 bị cắt; `{ok:false}` trong body **dù HTTP 200** vẫn tính là thất bại |
| TC-ZL-04 | Token trống ⇒ **không** gọi `fetch` một lần nào |
| TC-ZL-05..08 | `zalo-webhook.test.js`: thiếu / sai `X-Bot-Api-Secret-Token` ⇒ 403; đúng mã ⇒ gán `zalo_chat_id`; mã hết hạn / đã dùng ⇒ không gán; sự kiện lạ ⇒ 200 và không làm gì |
| TC-ZL-09 | `chat_id` đã thuộc người khác ⇒ chặn bởi unique index, trả câu tiếng Việt chứ không 500 |
| TC-ZL-10..13 | `zalo-push.test.js`: `dayThongBaoZalo` chỉ đẩy 3 loại đã chọn; người chưa liên kết bị đánh dấu bỏ qua; thất bại tăng `zalo_attempts`, quá 3 lần thì thôi; thông báo quá 24h bị bỏ |
| TC-ZL-14 | **Zalo chết không làm đổ luồng duyệt** — `guiTinZalo` ném lỗi, `POST /approvals/:entity/:id/approve` vẫn 200 và `approval_status` vẫn đổi |

## 5. Thứ tự làm và điểm dừng an toàn

1. **A1 → A2 → A3** (chuông). Chạy được ngay trên máy dev, không cần Zalo, không cần domain.
   → điểm dừng an toàn, có thể giao cho người dùng test tay.
2. Cập nhật **§5.2** + **§13.4 mục 16** (chốt phương án b) + mục **25** mới cho Zalo.
3. **Migration 017** + B2/B3/B4 + `npm run zalo:link` gán tay → đẩy Zalo chạy được **không cần
   webhook**, test bằng chính tài khoản Zalo của người dùng.
4. **B5** (webhook tự liên kết) — nghiệm thu ở **Phase 8** khi có domain + HTTPS.

## 6. Việc KHÔNG làm

- Không dùng OA API / ZNS (§2.2 — cửa sổ 7 ngày và vòng OAuth).
- Không thêm gói npm nào (§2.3).
- Không gửi email (§13.4 mục 4 đã chốt).
- Không đưa nội dung nghiệp vụ chi tiết ra Zalo (B1.4).
- Không chuyển phép kiểm quyền nào từ máy chủ sang trình duyệt: chuông chỉ **ẩn/hiện**, mọi câu
  «ai đọc được thông báo nào» chốt ở `repo.listByUser(req.user.id)`.

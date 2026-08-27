#!/usr/bin/env bash
# Bộ chạy checklist khói §8.5 qua ĐÚNG đường người dùng thật đi: Nginx → cầu RPC → API v1.
#
# Không phải test tự động (đã có 1.085 test riêng). Đây là bộ gõ tay có ghi lại: mỗi điểm kiểm
# in ra tên hàm cũ mà giao diện gọi + mã HTTP + phần đầu thân phản hồi, để chép kết quả vào
# docs/UAT.md mà không phải nhớ bằng đầu.
#
#   BASE=http://127.0.0.1:8099 bash tools/smoke-8.5.sh 2>&1 | tee /tmp/smoke.log
#
# Cần: một CSDL đã seed (`npm run seed:dev`), server đang chạy, Nginx đang phục vụ web/.
set -u
BASE=${BASE:-http://127.0.0.1:8099}
JAR=${JAR:-/tmp/smoke-jar.txt}
CSRF=''

# Lấy cookie CSRF bằng một request ĐỌC, đúng như api-bridge.js làm (GET /api/csrf).
prime() {
  CSRF=$(curl -s -b "$JAR" -c "$JAR" "$BASE/api/csrf" |
    sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  [ -n "$CSRF" ] || echo "   !! không lấy được CSRF"
}

# rpc <tên hàm cũ> <JSON args>  → in mã HTTP và 300 ký tự đầu của thân; thân đầy đủ để lại ở $LAST
#
# Thân request đi qua STDIN (`--data-binary @-`), KHÔNG qua tham số dòng lệnh: trên Git Bash của
# Windows, chữ tiếng Việt trong argv bị đổi sang bảng mã của console (cp1252) rồi thành U+FFFD, và
# hệ thống lưu đúng cái mớ hỏng đó vào CSDL. Đã gặp thật: "Tạo bởi" vào bảng thành "T?o b?i".
LAST=''
rpc() {
  local name=$1 body=${2:-'{"args":[]}'} out code
  out=$(printf '%s' "$body" | curl -s -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $CSRF" -w '\n%{http_code}' \
    -X POST "$BASE/api/rpc/$name" --data-binary @-)
  code=${out##*$'\n'}
  LAST=${out%$'\n'*}
  printf '   [%s] %-24s %s\n' "$code" "$name" "$(printf '%s' "$LAST" | head -c 300)"
}

# rest <đường dưới /api/v1>  → GET bằng cùng phiên (cookie jar); in mã HTTP + đầu thân.
rest() {
  local path=$1 out code
  out=$(curl -s -b "$JAR" -c "$JAR" -H 'Accept: application/json' \
    -w '\n%{http_code}' "$BASE/api/v1/$path")
  code=${out##*$'\n'}
  LAST=${out%$'\n'*}
  printf '   [%s] %-24s %s\n' "$code" "GET $path" "$(printf '%s' "$LAST" | head -c 300)"
}

# xlsx <đường dưới /api/v1> [tệp lưu]  → tải file xuất: in mã HTTP, kiểu nội dung, số byte và 2
# byte đầu. Thân KHÔNG in ra: file .xlsx là một cái zip, in ra chỉ làm rác màn hình. "PK" ở 2 byte
# đầu là chữ ký zip — thiếu nó thì Excel sẽ báo "file bị hỏng" khi mở.
XUAT=/tmp/smoke-xuat.xlsx
xlsx() {
  local path=$1 tep=${2:-$XUAT} out code ctype bytes dau
  out=$(curl -s -b "$JAR" -c "$JAR" -o "$tep" \
    -w '%{http_code} %{content_type} %{size_download}' "$BASE/api/v1/$path")
  code=${out%% *}
  ctype=$(printf '%s' "$out" | cut -d' ' -f2)
  bytes=$(printf '%s' "$out" | cut -d' ' -f3)
  dau=$([ "$code" = 200 ] && head -c 2 "$tep" || printf '%s' '—')
  printf '   [%s] %-24s %s · %s byte · đầu tệp=%s\n' \
    "$code" "GET ${path%%\?*}" "${ctype##*.}" "$bytes" "$dau"
}

# dongxlsx <tệp>  → "trang | số dòng | các ô cột A" của trang đầu. Đọc bằng chính exceljs của
# server/ (§3.3), không đoán từ số byte: điểm R12b cần biết file có DÒNG của phòng khác hay không.
dongxlsx() {
  (cd server && node --input-type=module -e "
    import ExcelJS from 'exceljs';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(process.argv[1]);
    const ws = wb.worksheets[0];
    const cotA = [];
    ws.eachRow((r, i) => { if (i > 2) cotA.push(String(r.getCell(1).value ?? '').trim()); });
    console.log(ws.name + ' | ' + ws.rowCount + ' dòng | cột A: ' + cotA.join(','));
  " "$1" 2>&1 | tail -1)
}

# psql <câu SQL>  — SQL cũng đi qua STDIN, cùng một lý do bảng mã như trên.
psqlq() { printf '%s\n' "$1" | docker exec -i qlcv-dev-db psql -qtAU qlcv -d quanlycongviec_uat; }

# Lấy một trường chuỗi từ phản hồi vừa rồi: chỉ dùng cho mã (`CV010`), không phải để phân tích JSON.
truong() { printf '%s' "$LAST" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }

login() { # login <email> <mật khẩu>
  rm -f "$JAR"
  prime
  rpc authenticateUser "{\"args\":[\"$1\",\"$2\"]}"
  prime # token CSRF đổi sau khi đăng nhập (gắn với phiên mới)
}

diem() { printf '\n%s\n' "== $* =="; }

# ---------------------------------------------------------------- NHÓM 1: ĐĂNG NHẬP (6 điểm)
diem 'Đ1 đăng nhập admin — thử email VIẾT HOA (bản cũ trượt ở đây, UAT A1)'
login 'ADMIN@TEST.LOCAL' 'Test@12345'

diem 'Đ2 sai mật khẩu — phải 401 kèm câu tiếng Việt, KHÔNG lộ email có tồn tại hay không'
rpc authenticateUser '{"args":["admin@test.local","sai-mat-khau"]}'

diem 'Đ3 đổi mật khẩu — trước đó mọi lời gọi nghiệp vụ phải bị 403 MUST_CHANGE_PASSWORD (việc 4.5)'
rpc getProjects
echo '   -- thiếu mật khẩu hiện tại (chữ ký 2 tham số của bản cũ) phải báo rõ, không âm thầm bỏ qua:'
rpc changePassword '{"args":["MatKhauMoi@123","MatKhauMoi@123"]}'
echo '   -- nhập lại không khớp:'
rpc changePassword '{"args":["Test@12345","MatKhauMoi@123","MatKhauMoi@456"]}'
echo '   -- đủ 3 tham số:'
rpc changePassword '{"args":["Test@12345","MatKhauMoi@123","MatKhauMoi@123"]}'
prime
echo '   -- sau khi đổi, lời gọi nghiệp vụ không còn bị 403:'
rpc getProjects

diem 'Đ4 đăng xuất — sau đó lời gọi nghiệp vụ phải 401 (giao diện bật lại modal đăng nhập)'
rpc logout
prime
rpc getProjects

diem 'Đ5 vào lại bằng mật khẩu MỚI (và mật khẩu cũ phải hết hiệu lực)'
rpc authenticateUser '{"args":["admin@test.local","Test@12345"]}'
login 'admin@test.local' 'MatKhauMoi@123'

diem 'Đ6 hết phiên — đẩy expires_at về quá khứ rồi gọi lại, phải 401 chứ không đi tiếp bằng phiên cũ'
psqlq "UPDATE sessions SET expires_at = now() - interval '1 hour';" | sed 's/^/   psql: /'
rpc getProjects

# Trả mật khẩu admin về `Test@12345` để lần sau chạy lại vẫn đi từ Đ1 được (bộ chạy phải chạy lại
# được, giống seed — nếu không thì lần thứ hai đỏ ở Đ1 vì lý do chẳng liên quan gì tới sản phẩm).
login 'admin@test.local' 'MatKhauMoi@123'
rpc changePassword '{"args":["MatKhauMoi@123","Test@12345","Test@12345"]}'

# ---------------------------------------------------------------- NHÓM 2: TỔNG QUAN (10 điểm)
# T1–T4: nguồn dữ liệu đầu trang. T5–T10 (Phase 6): 6 biểu đồ + «hoạt động gần đây» tính ở
# SERVER qua `/stats/charts?type=` (6 loại) và `/stats/activities` — app.js gọi thẳng REST này
# khi vào Tổng quan (`napTongQuanTuServer`), không còn tự tính trong trình duyệt.
diem 'T1–T10 nguồn dữ liệu đầu trang + 6 biểu đồ/hoạt động từ /stats/*'
login 'admin@test.local' 'Test@12345'
rpc getDataForUser
rpc getInitialDataWithAuth
rpc getDepartmentContext
for t in status project-progress staff-performance task-priority timeline-progress project-comparison; do
  rest "stats/charts?type=$t"
done
rest 'stats/summary'
rest 'stats/activities?page=1&limit=22'
echo '   -- và khi CHƯA đăng nhập, getInitialDataWithAuth phải trả cờ đăng nhập, KHÔNG trả 501:'
rm -f "$JAR"
prime
rpc getInitialDataWithAuth

# ---------------------------------------------------------------- NHÓM 3: CÔNG VIỆC (14 điểm)
diem 'C1 tạo công việc (cấp 1)'
login 'admin@test.local' 'Test@12345'
rpc addProjectWithAuth '{"args":[{"name":"KHÓI 8.5 — công việc thử","description":"Tạo bởi tools/smoke-8.5.sh","manager":"Quản trị Hệ thống","startDate":"2026-09-01","endDate":"2026-09-30","status":"Đang thực hiện"}]}'
CV=$(truong projectId)
echo "   mã công việc vừa tạo: ${CV:-KHÔNG DÒ RA}"

diem 'C2 sửa công việc'
rpc updateProjectWithAuth "{\"args\":[\"$CV\",{\"name\":\"KHÓI 8.5 — đã sửa tên\",\"status\":\"Tạm dừng\"}]}"

diem 'C3 xoá công việc — làm ở cuối nhóm, sau khi các điểm khác đã dùng xong công việc này'

diem 'C4 nhân bản công việc (kèm cả cây con)'
rpc copyProjectWithAuth "{\"args\":[\"CV001\",\"KHÓI 8.5 — bản sao CV001\"]}"

diem 'C5 tìm kiếm công việc — lọc chạy ở giao diện, dữ liệu do getProjects cấp'
rpc getProjects

diem 'C6 mở chi tiết công việc — getTasks đã GỘP MỘT TRUY VẤN (hết nợ N+1, Phase 6)'
rpc getTasks

diem 'C7 tạo CÔNG VIỆC CON (cấp 2) — nút «+ công việc con» trên cây gửi ô ẩn level=2'
echo '   -- Việc 5.12: bấm hàng CÔNG VIỆC ⇒ FormData mang level=2, parent rỗng. Không thêm'
	echo '      <select name="level">. «+ Thêm nhiệm vụ» vẫn không gửi cấp ⇒ REST mặc định 3.'
rpc addTaskWithAuth "{\"args\":[{\"projectId\":\"$CV\",\"name\":\"KHÓI 8.5 — thử tạo cấp 2\",\"status\":\"Chưa bắt đầu\",\"priority\":\"Trung bình\",\"level\":\"2\",\"parent\":\"\"}]}"
psqlq "SELECT code||' cấp='||level||' cha='||coalesce(parent_id::text,'NULL') FROM work_items
        WHERE name LIKE 'KHÓI 8.5%' ORDER BY id;" | sed 's/^/   csdl: /'

diem 'C8 tạo NHIỆM VỤ (cấp 3) dưới một công việc'
rpc addTaskWithAuth "{\"args\":[{\"projectId\":\"$CV\",\"name\":\"KHÓI 8.5 — nhiệm vụ thử\",\"assignee\":\"Nguyễn Văn Nhân\",\"status\":\"Đang thực hiện\",\"priority\":\"Cao\",\"startDate\":\"2026-09-02\",\"dueDate\":\"2026-09-20\",\"completion\":\"30\",\"target\":\"Xong trước 20/9\",\"notes\":\"ghi chú thử\"}]}"
NV=$(psqlq "SELECT code FROM work_items WHERE name = 'KHÓI 8.5 — nhiệm vụ thử'
             ORDER BY id DESC LIMIT 1;" | tr -d '\r')
echo "   mã nhiệm vụ vừa tạo: ${NV:-KHÔNG DÒ RA}"

diem 'C9 kéo–thả đổi thứ tự (giao diện gọi reorderTasks với danh sách mã theo thứ tự mới)'
rpc reorderTasks "{\"args\":[\"CV001\",[\"CV001-002\",\"CV001-001\"]]}"
echo '   -- và mã lạ trong danh sách phải bị bỏ qua chứ không làm đổ cả lệnh:'
rpc reorderTasks "{\"args\":[\"CV001\",[\"CV001-001\",\"MÃ-KHÔNG-CÓ\"]]}"

diem 'C10 nhắc việc — THÊM'
rpc addTaskReminder "{\"args\":[\"$NV\",{\"date\":\"2026-09-10\",\"content\":\"Nhắc thử 1\"}]}"
rpc addTaskReminder "{\"args\":[\"$NV\",{\"date\":\"2026-09-15\",\"content\":\"Nhắc thử 2\"}]}"

diem 'C11 nhắc việc — SỬA theo SỐ THỨ TỰ của bản cũ (bẫy index→id, §13.5)'
rpc updateTaskReminder "{\"args\":[\"$NV\",1,{\"date\":\"2026-09-16\",\"content\":\"Nhắc thử 2 (đã sửa)\"}]}"
echo '   -- số thứ tự ngoài danh sách phải báo lỗi rõ, không sửa nhầm dòng khác:'
rpc updateTaskReminder "{\"args\":[\"$NV\",9,{\"date\":\"2026-09-17\",\"content\":\"x\"}]}"

diem 'C12 nhắc việc — XOÁ'
rpc deleteTaskReminder "{\"args\":[\"$NV\",0]}"

diem 'C13 link kết quả — nhiều link trong MỘT ô, mỗi dòng một link, giữ nguyên phần [Tên]'
rpc updateTaskWithAuth "{\"args\":[\"$NV\",{\"resultLinks\":\"[Báo cáo] https://vd.local/bc.pdf\nhttps://vd.local/anh.png\nkhông-phải-link\"}]}"
psqlq "SELECT jsonb_array_length(result_links)||' link: '||result_links::text
        FROM work_items WHERE code = '$NV';" | sed 's/^/   csdl: /'

diem 'C14 hoàn thành nhanh (một cú bấm: trạng thái + 100% + ngày báo cáo)'
rpc updateTaskWithAuth "{\"args\":[\"$NV\",{\"status\":\"Hoàn thành\",\"completion\":\"100\",\"reportDate\":\"2026-09-18\"}]}"

diem 'C3 xoá công việc — xoá cả cây con, trả về danh sách mã đã mất'
rpc deleteProjectWithAuth "{\"args\":[\"$CV\"]}"

# ---------------------------------------------------------------- NHÓM 4: DUYỆT (8 điểm)
# Luồng duyệt là tính năng MỚI (§2.11), Phase 5. Ở Phase 4 chỉ có phần CSDL/máy chủ tự đặt trạng
# thái duyệt; giao diện cũ chưa có nút Duyệt/Từ chối, chưa có nhãn vàng, chưa có badge — cả ba chữ
# "Chờ duyệt" trong app.js đều thuộc màn hình ĐỀ NGHỊ, không phải duyệt công việc.
diem 'D1 Trưởng phòng tạo công việc ⇒ trạng thái duyệt phải là "Chờ duyệt"'
login 'tp01@test.local' 'Test@12345'
# Phải đổi sang mật khẩu KHÁC: máy chủ chặn "mật khẩu mới trùng mật khẩu hiện tại". Đổi đi rồi đổi
# về, và bật lại cờ must_change_password để CSDL trở về đúng trạng thái sau seed.
rpc changePassword '{"args":["Test@12345","Khoi85@Tam","Khoi85@Tam"]}'
prime
rpc addProjectWithAuth '{"args":[{"name":"KHÓI 8.5 — TP tạo, chờ duyệt","startDate":"2026-09-01","endDate":"2026-09-30","status":"Chưa bắt đầu"}]}'
psqlq "SELECT code||' duyệt='||coalesce(approval_status,'NULL') FROM works
        WHERE name LIKE 'KHÓI 8.5%' ORDER BY id;" | sed 's/^/   csdl: /'
rpc changePassword '{"args":["Khoi85@Tam","Test@12345","Test@12345"]}'
psqlq "UPDATE users SET must_change_password = true WHERE email = 'tp01@test.local';" |
  sed 's/^/   psql: /'


diem 'D2 admin tạo ⇒ "Đã duyệt" ngay (điểm đối chứng của D1)'
login 'admin@test.local' 'Test@12345'
rpc addProjectWithAuth '{"args":[{"name":"KHÓI 8.5 — admin tạo, đã duyệt","startDate":"2026-09-01","endDate":"2026-09-30","status":"Chưa bắt đầu"}]}'
psqlq "SELECT code||' duyệt='||coalesce(approval_status,'NULL') FROM works
        WHERE name LIKE 'KHÓI 8.5%' ORDER BY id;" | sed 's/^/   csdl: /'

diem 'D3–D8 nhãn vàng · badge đếm · nút Duyệt/Từ chối · thông báo · thống kê bỏ mục chờ duyệt'
echo '   -- không có tên hàm cũ nào cho duyệt/từ chối trong 37 tên (§5.2), và giao diện cũ không'
echo '      có nút nào gọi. Đây là việc 5.2–5.4 của Phase 5, không phải điểm đỏ của Phase 4.'
grep -c 'approveWork\|rejectWork\|duyet\|approval' web/assets/js/app.js |
  sed 's/^/   số chỗ app.js nhắc tới duyệt công việc: /'

# ---------------------------------------------------------------- NHÓM 5: NGƯỜI DÙNG & PHÒNG (10)
diem 'N1–N10 nhân sự và phòng — 7 tên đã nối (việc 5.11): getStaffList 200, thiếu tham số 400, mã lạ 404'
for f in getStaffList addStaffWithAuth updateStaffWithAuth deleteStaffWithAuth \
  addDepartmentWithAuth updateDepartmentWithAuth deleteDepartmentWithAuth; do
  rpc "$f" '{"args":[{}]}'
done

# ---------------------------------------------------------------- NHÓM 6: CÒN LẠI (12 điểm)
diem 'R1–R7 Gantt — máy chủ nhóm sẵn cây 4 mức (việc 6.6); 1/2/3 tháng & thu gọn vẽ ở giao diện'
echo '   -- Phase 6: app.js gọi GET /api/v1/gantt?groupBy=… khi vào mục Gantt; 3 kiểu nhóm +'
echo '      cửa sổ from/to (n×30 ngày) kiểm ngay ở đây, thanh cắt hai đầu do tests/unit/gantt-ui.test.js canh.'
rest 'gantt?groupBy=department'
rest 'gantt?groupBy=deputy'
rest 'gantt?groupBy=assignee'
TU=$(date -d '-30 days' +%F); DEN=$(date -d '+90 days' +%F)
rest "gantt?from=$TU&to=$DEN&groupBy=department"
diem 'R8–R9 đề nghị tạo/sửa'
rpc getProposals
rpc addProposalWithAuth '{"args":[{"type":"Trong kế hoạch","content":"thử"}]}'
rpc updateProposalWithAuth '{"args":["DN001",{"content":"thử sửa"}]}'
diem 'R10 chat gửi/nhận'
rpc getChatMessages
rpc sendChatMessage '{"args":["xin chào từ bộ khói"]}'
diem 'R11 app mở được (lưới app + thêm/sửa/xoá) — CRUD thật từ việc 7.2'
# Khoá gửi lên là TÊN CỘT bản cũ (`COL.A_*` trong rpc/legacyFields.js), không phải tên cột CSDL:
# giao diện cũ đóng gói FormData theo nhãn tiếng Việt, cầu RPC mới dịch sang `name/url/category`.
rpc addApp '{"args":[{"Tên App":"KHÓI 8.5 — app thử","URL":"https://example.com","Danh mục":"Khác"}]}'
MA_APP=$(truong 'appId')
echo "   mã app vừa tạo: ${MA_APP:-KHÔNG DÒ RA}"
rpc updateApp "{\"args\":[\"$MA_APP\",{\"Tên App\":\"KHÓI 8.5 — app thử (đã sửa)\"}]}"
rpc deleteApp "{\"args\":[\"$MA_APP\"]}"
echo '   -- thiếu tên ứng dụng phải 400, không tạo dòng rỗng:'
rpc addApp '{"args":[{}]}'

diem 'R12 xuất 3 file Excel — nút «Xuất Excel» tải thẳng 3 đường GET (việc 7.5)'
xlsx 'export/works.xlsx'
xlsx 'export/tasks.xlsx'
xlsx "export/stats.xlsx?from=$TU&to=$DEN"
grep -c '/api/v1/export/' web/index.html |
  sed 's/^/   số chỗ index.html trỏ tới đường xuất (phải ≥ 3): /'

diem 'R13 cầu RPC — 37/37 tên chạy thật, không còn tên treo (việc 7.7)'
curl -s -b "$JAR" "$BASE/api/rpc" >/tmp/smoke-rpc.json
printf '   tổng tên: %s · chạy thật: %s · còn treo: %s\n' \
  "$(grep -o '"name":' /tmp/smoke-rpc.json | wc -l)" \
  "$(grep -o '"implemented":true' /tmp/smoke-rpc.json | wc -l)" \
  "$(grep -o '"implemented":false' /tmp/smoke-rpc.json | wc -l)"
rpc addNotificationWithAuth \
  '{"args":[{"content":"KHÓI 8.5 — thông báo thử","recipient":"","type":"Khẩn cấp"}]}'
psqlq "SELECT count(*)||' thông báo vừa tạo, loại='||coalesce(max(type),'?')
         FROM notifications WHERE content LIKE 'KHÓI 8.5%';" | sed 's/^/   csdl: /'

diem 'R12b xuất CHỈ TRONG PHẠM VI ĐƯỢC THẤY (việc 7.6) — rủi ro lớn nhất của Phase 7'
xlsx 'export/works.xlsx' /tmp/smoke-xuat-admin.xlsx
echo "   admin  : $(dongxlsx /tmp/smoke-xuat-admin.xlsx)"
# Nhân viên: phải đổi mật khẩu lần đầu mới gọi được nghiệp vụ, đổi đi rồi đổi về như D1.
login 'nv01@test.local' 'Test@12345'
rpc changePassword '{"args":["Test@12345","Khoi85@Tam","Khoi85@Tam"]}'
prime
xlsx 'export/works.xlsx' /tmp/smoke-xuat-nv.xlsx
echo "   nhân viên: $(dongxlsx /tmp/smoke-xuat-nv.xlsx)"
psqlq "SELECT 'nv01 thuộc phòng '||coalesce(d.name,'(không có)')||
              ', công việc của phòng này: '||(SELECT count(*) FROM works w
                                              WHERE w.department_id = u.department_id)||
              ' / toàn hệ thống: '||(SELECT count(*) FROM works)
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.email = 'nv01@test.local';" | sed 's/^/   csdl: /'
rpc changePassword '{"args":["Khoi85@Tam","Test@12345","Test@12345"]}'
psqlq "UPDATE users SET must_change_password = true WHERE email = 'nv01@test.local';" |
  sed 's/^/   psql: /'

# ---------------------------------------------------------------- DỌN DỮ LIỆU THỬ
diem 'Dọn các dòng do bộ khói tạo ra (để chạy lại lần sau vẫn từ dữ liệu seed sạch)'
psqlq "DELETE FROM work_items WHERE name LIKE 'KHÓI 8.5%';
       DELETE FROM works WHERE name LIKE 'KHÓI 8.5%';
       DELETE FROM notifications WHERE content LIKE 'KHÓI 8.5%';
       DELETE FROM apps WHERE name LIKE 'KHÓI 8.5%';
       UPDATE users SET must_change_password = true WHERE email = 'admin@test.local';
       SELECT (SELECT count(*) FROM works)||' công việc / '||
              (SELECT count(*) FROM work_items)||' đầu việc còn lại (sau seed: 14 / 36)';" |
  sed 's/^/   psql: /'





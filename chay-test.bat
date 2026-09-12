@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM =========================================================
REM  QLCV - MAY CHU TEST TAY  (CSDL quanlycongviec_uat)
REM  Khac chay.bat: KHONG xoa CSDL, KHONG seed lai -> giu du lieu.
REM  Goi san che do neu muon:  chay-test.bat /giu | /seed | /v14 | /reset
REM
REM  2026-08-28 - sua 3 cho lam script khong dung duoc de test:
REM   Lich su (hien tai KHONG tu taskkill):
REM   (1) "npm run dev" = "node --watch src/server.js" -> tien trinh giu cong 3000
REM       la CON cua watcher. Truoc day chi taskkill PID con => watcher bat lai
REM       may chu CU (DATABASE_URL cu, thuong la CSDL dev) va chiem lai cong 3000,
REM       cua so moi chet vi EADDRINUSE ma khong ai thay. Nay diet CA CAY node
REM       cua server.js roi CHO cho cong 3000 rong that moi bat lai.
REM   (2) Ban hieu app.js khong con go cung trong file nay - doc thang tu
REM       web\assets\js\app.js va so voi app.js?v= trong web\index.html.
REM   (3) Buoc cuoi kiem qua Nginx 8099: banner trinh duyet SE thay + migration
REM       moi nhat da len CSDL test + duong /api/v1 con song.
REM
REM  2026-09-02 (Vong 14 cuoi 5) - them cho luong "KET QUA NHIEM VU LA FILE":
REM   (4) Che do 4 = seed:v14 (bo tai khoan gd/pgd/tp/pp/nv1/nv2/nvb@test.local,
REM       5 nhiem vu du 5 trang thai file). Hai bo seed LOAI TRU nhau - bo nao
REM       chay sau thi xoa bo truoc, nen menu noi ro dieu do.
REM   (5) Buoc [7/7] kiem them: 3 bien ONLYOFFICE_* trong deploy\.env, container
REM       Document Server con song, va thu muc storage\ket-qua co file that hay
REM       khong (seed chi tao dong CSDL -> bam vao la editor bao loi tai file,
REM       dung thiet ke chu khong phai loi moi).
REM
REM  2026-09-11 (DOT B - "gop hai truc" duyet cay + duyet file ket qua) - 4 cho:
REM   (6) BACKUP TRUOC KHI DUNG DEN CSDL. Migration 029 co DOWN la "RAISE EXCEPTION"
REM       - tuc KHONG co down tu dong, vi no da gop yeu-cau-sua vao tra-ve-cbo va doi
REM       trinh-lanh-dao thanh tp-phe-duyet (lich su verdict cu khong lay lai duoc).
REM       Nen buoc [2/7] pg_dump -Fc CSDL test ngay sau khi container san sang va
REM       TRUOC buoc [3/7] - de che do /reset (DROP DATABASE) cung duoc backup truoc.
REM       Dump that bai hoac file qua nho thi DUNG lai, khong lam gi tiep. Chi dump
REM       khi CSDL da ton tai; chua co bang pgmigrations = CSDL trong, bo qua.
REM       Thu muc: ..\quanlycongviec-backups\uat-<ngay-gio>\
REM   (7) Buoc [7/7] kiem them DAU HIEU cua 029: 2 cot tp_duyet_boi/tp_duyet_luc,
REM       CHECK cua task_file_flow het 'yeu-cau-sua', CHECK cua approval_changes co
REM       'ty-le', cot approval_changes.file_id, va in cache buster hien hanh. Buoc
REM       [7/7] dung findstr doc truc tiep web\index.html nen KHONG hardcode phien ban -
REM       tang buster thi khong phai sua script nay.
REM       Thieu mot cai = 029 CHUA len, moi luong DOT B deu bao loi khong hieu duoc.
REM   (8) Dem va in ra nhung gi nguoi test can biet TRUOC khi bam: so nhiem vu cap 3
REM       theo tung trang thai duyet (Q1/Q2 can it nhat mot cay CHUA duyet), so de
REM       nghi ty le / gui BLD dang cho, va so nhiem vu cap 3 chua co ai trong
REM       "Ban lanh dao kiem soat" - o trong thi KHONG ai duyet cay duoc (R1(a)) va
REM       DIEM 12 khong that (dungNguoiDuyetFile co y bo qua khi o trong).
REM   (9) SUA HUONG DAN CU: het nut "Trinh lanh dao" (thanh "TP/PP phe duyet"), het
REM       nut "Yeu cau sua" (gop vao "Day ve can bo", bat buoc ly do >= 10 ky tu), va
REM       QUAN TRONG NHAT: cay CHUA duyet thi KHONG CON nut tai file - lan gui dau
REM       chi KHAI BAO (ten + dinh dang + ty le), file that chi nop sau khi duyet.
REM       Duong cu "nv1 -> Tai file len" in o day truoc DOT B la SAI, se khien nguoi
REM       test tuong nut tai file bien mat la loi. Bo seed Vong 14 (che do 4) cung
REM       duoc canh bao: no TRUNCATE nen supervisor_ids ve '{}', muon test duyet cay
REM       thi dung /giu hoac chon nguoi trong bieu mau.
REM
REM  2026-09-11 (chieu - sua loi nguoi dung bao khi test DOT B, KHONG co migration):
REM   (10) Nhiem vu KHONG tich "Gui BLD phe duyet" ma nut "TP/PP phe duyet" van day
REM       len PGD (CV002). Hai nguyen nhan chong nhau: (a) BANG_VERDICT cua
REM       'tp-phe-duyet' de "den" co dinh = 'cho-lanh-dao', khong doc tich; (b) van
REM       chong tu duyet can theo "nguoi luu ban cuoi", nen TP sua truc tuyen xong la
REM       mat nut "Hoan thanh / Duyet" - thanh ra chi con dung mot duong day len PGD.
REM       Nay: tich TAT thi AN nut trinh (goi thang API = 409), tich BAT thi an nut
REM       chot (403); van tu duyet NOI ra, chi con canh NGUOI THUC HIEN cua nhiem vu
REM       (Q5); nut chot co o ghi chu tuy chon. Chi doi may chu + app.js (buster
REM       20260911-04), CSDL giu nguyen - nguoi dang test chi can Ctrl+F5, KHONG can
REM       chay lai script nay. Huong dan bam: HUONG-DAN-TEST-GIAO-DIEN.md muc 9b.23 J.
REM
REM  2026-09-12 (DOT B BO SUNG - KHONG co migration, CSDL giu 029, chi can Ctrl+F5):
REM   (11) HAI chi dao nghiep vu moi, deu da xong ma + test:
REM       (a) Ban ket qua DAU TIEN cua mot nhom chi NGUOI THUC HIEN TRUC TIEP
REM           (work_items.assignee_id) nop duoc. TP/PP va PGD/GD nay nhan 403 o ban 1,
REM           chi sua/nop tu ban thu hai tro di; nhiem vu CHUA gan nguoi thuc hien thi
REM           nhan 409 (thieu du kien, khong phai thieu quyen). Guard
REM           assertNguoiNopBanDau o taskFiles/service.js:371, dat TRUOC mkdir/writeFile
REM           de khong de lai thu muc mo coi, va gac CA duong "Bao cao" (nopBaoCao).
REM           NUT "Tai len" bi an o nhom 0 ban, thay bang chu "Ban dau chi <Ten> nop
REM           duoc." - nguoi test thay 403 la DUNG LUAT, khong phai loi.
REM       (b) Hai cot cua bang "Ket qua" nay ghi O TUNG BAN. Cot "Tinh trang" truoc day
REM           TRONG o dong ban, nay in badge doc tu task_file_flow cua CHINH ban do,
REM           luon kem TEN: "Bi tra ve", "TP/PP sua truc tiep - Ten", "PGD/GD da duyet
REM           - Ten"... Cot "Nguoi thuc hien" nay la nguoi duyet/nguoi sua doi voi cac
REM           ban sau, va CHI in "Nguoi thuc hien truc tiep" khi dung nguoi do tai len
REM           lan dau hoac truc tiep sua lai ban bi tra ve. Du lieu cu in "TP/PP nop
REM           thay" - CO Y khong sua nguoc lich su.
REM       Buster 20260911-04 -> 20260912-01 (5 cho). Huong dan bam: muc 9b.24 (46 -> 60).
REM       Thiet ke + bay: KE-HOACH-DUYET-CAY.md muc 12. Test: 2043/2043 - 114 file.
REM       KHONG can chay lai script nay - Ctrl+F5 la du. Neu van chay thi buoc [7/7] se
REM       in dung buster moi vi findstr doc truc tiep web\index.html.
REM
REM  2026-09-12 (DOT B BO SUNG LUOT 2 - KHONG co migration, CSDL giu 029, chi can Ctrl+F5):
REM   (12) BON chi dao nghiep vu moi, deu da xong ma + test:
REM       (a) MOI-3 - Ba bang cho duyet nay in NHAN noi ro "duyet cai gi": "Moi" / "Sua" /
REM           "Xoa" (bang chu NHAN_DUYET dong bang, 3 khoa) kem nhan doi tuong "Cong viec
REM           cha" / "Cong viec con" / "Nhiem vu" / "File ket qua". Dong da sua co them nut
REM           "Xem cac thay doi" mo popup liet ke tung luot doi noi dung XAY RA SAU MOC cay
REM           ra nguoi duyet lan cuoi. Co da_sua va moc moc_xu_ly do MAY CHU tinh bang
REM           LEFT JOIN LATERAL tren activity_logs (approvals/repo.js:106/107/154/195/205/211)
REM           - KHONG can migration vi chi doc bang san co. Popup TAI DUNG buildNhatKyDong
REM           cua tab "Nhat ky", khong viet bo dung HTML moi. Ly do khong phan biet duoc tu
REM           works/work_items: submitted_by ghi o MOI lan gui, khong co submitted_at, con
REM           approver_id/approved_at bi XOA TRANG khi ha ve "Cho duyet" (Q9).
REM           LOGIC CU GIU NGUYEN: sua file ket qua van duyet rieng o bang "Phe duyet ket
REM           qua"; sua TY LE cua file van di cay approval_changes (R4/R4'/R4'').
REM       (b) MOI-4 - Bon nut "Xem chi tiet / Duyet / Tra lai de sua / Tu choi" BE LAI:
REM           font-size 11px, padding 3px 9px, min-height 24px, icon 10px. Luat phai phu CA
REM           BA class dong (.approval-row, .approval-delete-row, .change-row) vi ba builder
REM           khac nhau dung ba bang. Thang .btn-primary bang DAC HIEU (0,1,1) > (0,1,0),
REM           KHONG dung !important - app.css duoc nap SAU tailwind.min.css nen .py-1/.text-xs
REM           thua dac hieu. LUU Y: tailwind.min.css la artifact DONG BANG, khong co class tuy
REM           y dang text-[11px] - dung no thi nut khong be di ma khong co loi nao bao.
REM       (c) MOI-5 - Can bo (vai Nhan vien) LAP MOI nhiem vu cap 3 nay CHON DUOC hai o "Ban
REM           lanh dao kiem soat" va "Nguoi thuc hien truc tiep" - truoc day bi khoa nen form
REM           khong luu noi. assertAssignmentActor nhan them ctx { taoMoi, level };
REM           moKhiLapMoiCapBa = taoMoi va level===3 thi bo hai ve khoa. leader_ids VAN KHOA
REM           o moi truong hop (co y - ngoai pham vi chi dao, va do la o quyet dinh ai duyet
REM           cay). Hang rao MOI assertAssigneeCungPhong: chi giao duoc cho nguoi CUNG PHONG,
REM           con hoat dong; hai nguoi cung khong co phong thi KHONG coi la cung phong.
REM           assertSupervisorsByLevel van chay nen BLDKS cap 3 van phai la mot trong BLDKS
REM           cua cong viec con chua no. SUA nhiem vu co san van khoa nhu cu (403).
REM       (d) MOI-6 - TP/PP duyet file ket qua KHONG CON thay nut "Gui di duyet" khi nhiem vu
REM           KHONG tich "Gui BLD phe duyet" (nguoi dung gap that hai lan tren CV002).
REM           apTuDong thoi "chi nhin vai": nay doc lai ghiDe qua permissionsRepo.listByVai
REM           (vi nguoiNop la dong users, KHONG phai req.user - khong doc lai thi ly do thu ba
REM           cua phaiTrinhLanhDao luon dung va lai day len cho-lanh-dao y nhu loi cu) roi tra
REM           phaiTrinhLanhDao ? 'cho-lanh-dao' : 'cho-xem'. Ba ly do cua phaiTrinhLanhDao giu
REM           nguyen: tich BAT / nguoi bam la assignee / file:approve khac 'cho-phep'.
REM           Tach laChuBanNhom khoi duocGuiBanLuu de guiDiDuyet bao dung ly do: mat quyen =
REM           403, khong con ai de gui = 409 (da tra gia mot lan khi TC-V4-02 nhan 409 thay
REM           403). "Hoan thanh" mo them o luu-tam de khoi thanh the ket, nhung nhom 0 ban thi
REM           van khong hien nut chot (Q1) - verdict nem 409 va hanhDongDuocLam cat nut bang
REM           CUNG mot luat. R6 VAN GIU: apTuDong khong bao gio tra 'da-duyet'.
REM       Buster 20260912-01 -> 20260912-02 (5 cho). Huong dan bam: muc 9b.25 (61 -> 79).
REM       Thiet ke + bay: KE-HOACH-DUYET-CAY.md muc 13. Test: 2076/2076 - 115 file.
REM       Pin XSS: 101 sink / 986 noi suy, CAN-THOAT 21 -> 23 cho.
REM       KHONG can chay lai script nay - Ctrl+F5 la du. Neu van chay thi buoc [7/7] se
REM       in dung buster moi vi findstr doc truc tiep web\index.html.
REM =========================================================

set "DB=quanlycongviec_uat"
set "ARG1=%~1"
set "ARG2=%~2"
set "EPBUOC="
if /i "!ARG1!"=="/f" set "EPBUOC=1"
if /i "!ARG2!"=="/f" set "EPBUOC=1"
REM Co /f = chay tu dong (Git Bash / terminal): moi cho "pause" phai bo qua,
REM neu khong script treo mai o cho hoi loi. !DUNG! = pause hoac lenh khong lam gi.
set "DUNG=pause"
if defined EPBUOC set "DUNG=ver >nul"

REM --- [0] Bo cach "tu mo lai cua so" (chi lam man hinh nhay roi tat).
REM     Bam dup file nay trong Explorer, hoac go ten no trong cmd -> co console
REM     that nen menu dung lai duoc. Chay tu Git Bash / terminal VS Code thi
REM     KHONG bam chon duoc, hay dua san che do bang co:
REM       chay-test.bat /giu | /seed | /reset      va them /f de khoi hoi gi ca
REM       (/f = bo pause, KHONG tu dung tien trinh). ---
set "MODE="
if /i "!ARG1!"=="/giu"   set "MODE=1"
if /i "!ARG1!"=="/seed"  set "MODE=2"
if /i "!ARG1!"=="/reset" set "MODE=3"
if /i "!ARG1!"=="/v14"   set "MODE=4"

echo ===================================================
echo   QLCV - MAY CHU TEST TAY   ^(CSDL %DB%^)
echo ===================================================

if not defined MODE if defined EPBUOC set "MODE=1"
if not defined MODE (
  echo.
  echo   1 = Giu du lieu dang co                       ^(mac dinh^)
  echo   2 = Seed BO CU §8.3    - 13 tai khoan TEST001..TEST013
  echo   3 = XOA SACH CSDL test roi tao lai ^(+ seed bo cu^)
  echo   4 = Seed BO VONG 14    - luong KET QUA LA FILE
  echo       ^(7 nguoi gd/pgd/tp/pp/nv1/nv2/nvb@test.local, 5 nhiem vu du 5 trang thai^)
  echo       CANH BAO DOT A+B: bo nay de trong "Ban lanh dao kiem soat" -^> KHONG duyet
  echo       cay duoc, cung khong that duoc DIEM 12. Muon that DOT B thi chon 1.
  echo   0 = Thoat
  echo.
  echo   LUU Y: bo 2 va bo 4 LOAI TRU nhau - bo nao chay sau thi xoa bo truoc.
  echo   Muon test luong file / hang cho phe duyet ket qua thi chon 4, sau do vao tung
  echo   nhiem vu chon nguoi kiem soat; muon duyet cay that su thi chon 1.
  echo.
  choice /c 12340 /n /m "  Chon [1/2/3/4/0]: "
  set "MODE=!errorlevel!"
  if !MODE! GEQ 6 (
    echo   Khong doc duoc phim bam - lay mac dinh: giu du lieu.
    set "MODE=1"
  )
  echo.
)
if "!MODE!"=="5" (
  echo   Thoat, khong lam gi.
  !DUNG! & exit /b 0
)
set "XOASACH="
if "!MODE!"=="3" (
  echo   CANH BAO: se DROP DATABASE %DB% - mat het cong viec / nhiem vu / log da tao.
  choice /c YN /n /m "  Chac chan xoa sach? [Y/N] "
  set "DAP=!errorlevel!"
  if "!DAP!"=="1" (
    set "XOASACH=1"
  ) else (
    echo   Da huy - chuyen ve che do giu du lieu.
    set "MODE=1"
  )
  echo.
)
REM SEED: 0 = khong seed, 1 = bo cu (dev.sql, §8.3), 2 = bo Vong 14 (dev-vong14.sql).
set "SEED=0"
if "!MODE!"=="2" set "SEED=1"
if "!MODE!"=="4" set "SEED=2"
if defined XOASACH set "SEED=1"

REM --- [1/7] Doc deploy\.env (khong nhet mat khau vao file .bat) ---
echo [1/7] Doc deploy\.env ...
if not exist "deploy\.env" (
  echo   THIEU deploy\.env - tao tu deploy\.env.example truoc.
  !DUNG! & exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("deploy\.env") do (
  if /i "%%a"=="POSTGRES_USER"     set "PGU=%%b"
  if /i "%%a"=="POSTGRES_PASSWORD" set "PGP=%%b"
  if /i "%%a"=="POSTGRES_PORT"     set "PGPORT=%%b"
)
if not defined PGU set "PGU=qlcv"
if not defined PGPORT set "PGPORT=5432"
if not defined PGP (
  echo   Khong doc duoc POSTGRES_PASSWORD trong deploy\.env
  !DUNG! & exit /b 1
)
set "DATABASE_URL=postgres://!PGU!:!PGP!@127.0.0.1:!PGPORT!/%DB%"
REM HTTP local: khong muon cookie production hay lich day Zalo tu PC.
set "NODE_ENV=development"
set "PORT=3000"
set "SESSION_COOKIE_SECURE=false"
set "APP_BASE_URL=http://127.0.0.1:8099"
set "CRON_ENABLED=false"
set "ZALO_BOT_NHAN=tat"
echo   nguoi dung=!PGU!  cong=!PGPORT!  csdl=%DB%
echo.

REM --- [2/7] Bat container CSDL, giu nguyen du lieu ---
echo [2/7] Bat container CSDL ...
REM Chan truoc migration/seed neu may chu cu van chay.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 1 }" || (echo   Dong cua so server cu tren cong 3000 truoc. & !DUNG! & exit /b 1)
docker compose -f deploy/docker-compose.dev.yml up -d db adminer || (!DUNG! & exit /b 1)
set "READY=0"
for /l %%i in (1,1,30) do (
  if "!READY!"=="0" (
    docker exec qlcv-dev-db pg_isready -U !PGU! -d postgres >nul 2>&1 && set "READY=1"
    if "!READY!"=="0" timeout /t 1 /nobreak >nul
  )
)
if "!READY!"=="0" (
  echo   CSDL khong san sang sau 30 giay - xem: docker logs qlcv-dev-db
  !DUNG! & exit /b 1
)
echo   CSDL san sang.
REM BACKUP TRUOC khi bat cu buoc nao dung den du lieu (ke ca /reset o buoc [3/7]).
REM Ly do: migration 029 co DOWN = RAISE EXCEPTION, tuc khong co duong lui tu dong.
pushd "%~dp0.."
set "BKROOT=%CD%\quanlycongviec-backups"
popd
call :sao_luu_truoc || (!DUNG! & exit /b 1)
echo.
REM --- [3/7] Tao CSDL test neu chua co / xoa sach neu nguoi dung chon ---
echo [3/7] Kiem tra CSDL %DB% ...
set "CO="
for /f %%r in ('docker exec qlcv-dev-db psql -U !PGU! -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DB%'"') do set "CO=%%r"
if defined XOASACH (
  if "!CO!"=="1" (
    echo   Dang xoa %DB% ...
    docker exec qlcv-dev-db psql -U !PGU! -d postgres -c "DROP DATABASE IF EXISTS %DB% WITH (FORCE);" || (!DUNG! & exit /b 1)
    set "CO="
  )
)
if "!CO!"=="1" (
  echo   Da co - giu nguyen du lieu.
) else (
  echo   Chua co - tao moi; chi seed khi da chon che do seed.
  docker exec qlcv-dev-db psql -U !PGU! -d postgres -c "CREATE DATABASE %DB%;" || (!DUNG! & exit /b 1)
  REM CSDL moi van khong tu seed: nguoi dung chon ro che do seed.
)
echo.

REM --- [4/7] Migration + (tuy chon) du lieu mau ---
echo [4/7] Chay migration len %DB% ...
pushd server
REM Neu migration loi: node-pg-migrate tu ROLLBACK ca transaction, nen CSDL van dung o phien ban cu
REM va khong hong gi ca - nguoi dung chi can sua migration roi chay lai. Ngay 11/09/2026 029 da no
REM o day ("23514 task_file_flow_hanh_dong_check") vi dat UPDATE truoc DROP CONSTRAINT; da sua.
call npm run migrate:up || (echo   MIGRATION LOI - xem thong bao chi tiet o ngay phia tren. & echo   node-pg-migrate da TU ROLLBACK nen %DB% van dung o phien ban cu, KHONG hong gi ca. & echo   Ban backup tao o buoc [2/7] van giu nguyen, khong can khoi phuc. & echo   Sua migration xong thi chay lai script nay; TUYET DOI khong xoa CSDL de "thu lai". & popd & !DUNG! & exit /b 1)
REM Chi doc, khong lay dong: dung CHINH truy van thong ke de bat view cu thieu cot.
node --input-type=module -e "import { QUERIES } from './src/modules/stats/repo.js'; import { pool } from './src/db/pool.js'; try { for (const sql of Object.values(QUERIES)) await pool.query(sql + ' LIMIT 0'); console.log('  Schema thong ke OK - du cot, gom ty_le.'); } catch { console.error('  SCHEMA THONG KE LOI - kiem migration 019 va view v_countable_items; KHONG seed/reset.'); process.exitCode = 1; } finally { await pool.end(); }" || (popd & !DUNG! & exit /b 1)
if "!SEED!"=="1" (
  echo.
  echo   Nap du lieu mau BO CU: dat lai 13 tai khoan mau ve Test@12345, mo khoa,
  echo   bat lai "doi mat khau lan dau". Cong viec/nhiem vu da co KHONG bi xoa.
  call npm run seed:dev || (echo   SEED LOI & popd & !DUNG! & exit /b 1)
  docker exec qlcv-dev-db psql -U !PGU! -d %DB% -c "UPDATE users SET full_name = 'Giám đốc', position = 'Giám đốc' WHERE email = 'admin@test.local';" >nul
)
if "!SEED!"=="0" (
  echo   Bo qua seed - muon dat lai tai khoan mau thi chon 2 ^(bo cu^) hoac 4 ^(Vong 14^).
)
if "!SEED!"=="2" (
  echo.
  echo   Nap du lieu mau BO VONG 14 - luong KET QUA NHIEM VU LA FILE.
  echo   Seed nay TRUNCATE sach du lieu nghiep vu roi dung lai tu dau:
  echo     2 phong, 7 nguoi ^(mat khau Test@12345, KHONG bat doi lan dau^),
  echo     1 cong viec -^> 1 CV con -^> 5 nhiem vu du 5 trang thai file,
  echo     8 thong bao mau. Bo tai khoan cu TEST001..TEST013 se MAT.
  call npm run seed:v14 || (echo   SEED LOI & popd & !DUNG! & exit /b 1)
  echo.
  echo   *** CANH BAO DOT A + DOT B: seed Vong 14 KHONG dien "Ban lanh dao kiem soat"
  echo       ^(supervisor_ids^), moi nhiem vu ra '{}'. Ma R1^(a^) BAT BUOC co nguoi trong o
  echo       do moi cho duyet cay, va DIEM 12 cung lay nguoi tu o do -^> voi seed nay se
  echo       KHONG the duyet cay va KHONG that duoc DIEM 12 ^(chi BLDKS duoc phe duyet
  echo       file khi tich gui-BLD TAT^). Se thay loi "Nhiem vu chua co Ban lanh dao...".
  echo       Cach xu: hoac mo tung nhiem vu roi CHON nguoi trong bieu mau, hoac dung che
  echo       do GIU DU LIEU ^(/giu^) - du lieu UAT cu da duoc migration 028 dien san.
)
popd
echo.

REM --- [5/7] Nginx 8099 + cau socat, chi dung lai neu chua chay ---
echo [5/7] Nginx 8099 + cau socat ...
docker network create qlcv-uat >nul 2>&1
set "S="
for /f %%s in ('docker inspect -f "{{.State.Running}}" app 2^>nul') do set "S=%%s"
if /i "!S!"=="true" (
  echo   cau "app" dang chay.
) else (
  docker inspect app >nul 2>&1 && (echo   Container app da ton tai nhung dung. Kiem tra va tu khoi dong dung container. & !DUNG! & exit /b 1)
  docker run -d --name app --network qlcv-uat alpine/socat tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000 >nul || (!DUNG! & exit /b 1)
  echo   cau "app" da dung.
)
set "S="
for /f %%s in ('docker inspect -f "{{.State.Running}}" qlcv-uat-nginx 2^>nul') do set "S=%%s"
if /i "!S!"=="true" (
  echo   nginx dang chay.
) else (
  docker inspect qlcv-uat-nginx >nul 2>&1 && (echo   Container qlcv-uat-nginx da ton tai nhung dung. Tu khoi dong lai sau khi kiem tra. & !DUNG! & exit /b 1)
  docker run -d --name qlcv-uat-nginx --network qlcv-uat -p 127.0.0.1:8099:80 -v "%cd%/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" -v "%cd%/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" -v "%cd%/web:/srv/web:ro" nginx:1.27-alpine >nul || (!DUNG! & exit /b 1)
  echo   nginx da dung.
)
echo.

REM --- [6/7] Giai phong cong 3000 roi bat Node tro vao CSDL test ---
echo [6/7] Cong 3000 ...
set "PID3000="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"TCP .*:3000 .*LISTENING"') do if not defined PID3000 set "PID3000=%%p"
if defined PID3000 (
  echo   Cong 3000 dang bi giu boi PID !PID3000!.
  echo   Hay dong dung cua so QLCV cu roi chay lai. KHONG tu diet tien trinh ke ca /f.
  !DUNG! & exit /b 1
) else (
  echo   Cong 3000 dang rong.
)
REM Moi truong duoc ke thua, khong chen mat khau vao dong lenh tien trinh.
start "QLCV TEST - Node (%DB%)" /D "%~dp0server" cmd /k npm run dev
echo   Da mo cua so "QLCV TEST - Node". Cho may chu len ...
set "UP=0"
for /l %%i in (1,1,40) do (
  if "!UP!"=="0" (
    curl --max-time 5 -s -f -o nul http://127.0.0.1:3000/healthz && set "UP=1"
    if "!UP!"=="0" timeout /t 1 /nobreak >nul
  )
)
if "!UP!"=="1" (
  echo   /healthz OK.
) else (
  echo   Chua thay /healthz - doc loi trong cua so "QLCV TEST - Node".
  !DUNG! & exit /b 1
)

:xong
echo.
REM --- [7/7] Kiem lai bang mat may: ban app.js, migration, duong 8099 ---
echo [7/7] Kiem lai truoc khi test ...
node tools/local-assets-check.mjs --live || (!DUNG! & exit /b 1)
set "MIG="
for /f %%m in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1" 2^>nul') do set "MIG=%%m"
if defined MIG (
  echo   Migration moi nhat tren %DB%: !MIG!
) else (
  echo   Khong doc duoc bang pgmigrations - migration co the chua chay.
  !DUNG! & exit /b 1
)
call :kiem_dot_b || (!DUNG! & exit /b 1)
set "NHIEUTHANG="
REM Trong for /f ('...') thi < va > van la chuyen huong cua cmd -> dung
REM IS DISTINCT FROM thay cho <> de khoi phai boc dau ^.
for /f %%n in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM works WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND date_trunc('month',start_date) IS DISTINCT FROM date_trunc('month',end_date)" 2^>nul') do set "NHIEUTHANG=%%n"
if defined NHIEUTHANG echo   Cong viec dai hon 1 thang ^(co tab "Ten theo thang"^): !NHIEUTHANG!
curl --max-time 5 -s -f -o nul http://127.0.0.1:8099/healthz && (echo   8099 /healthz OK.) || (echo   8099 /healthz LOI - xem: docker logs qlcv-uat-nginx)
REM Diem quan trong nhat: may chu dang noi CSDL NAO. /readyz chi noi "db up",
REM khong noi ten CSDL -> goi /readyz de chac chan co ket noi roi dem phien
REM trong pg_stat_activity. Neu = 0 thi may chu dang noi CSDL khac (thuong la dev).
curl --max-time 5 -s -f -o nul http://127.0.0.1:8099/readyz >nul 2>&1 || (!DUNG! & exit /b 1)
set "PHIEN=0"
for /f %%d in ('docker exec qlcv-dev-db psql -U !PGU! -d postgres -tAc "SELECT count(*) FROM pg_stat_activity WHERE datname='%DB%'" 2^>nul') do set "PHIEN=%%d"
if "!PHIEN!"=="0" (
  echo   CANH BAO: khong co phien nao tren %DB% - may chu dang noi CSDL KHAC.
  echo   -^> dong cua so "QLCV TEST - Node" roi chay lai:  chay-test.bat /giu /f
  !DUNG! & exit /b 1
) else (
  echo   %DB% co !PHIEN! phien; day chi la chi bao, khong tu no chung minh danh tinh server.
)
REM --- ONLYOFFICE (Vong 14): nut "sua truc tuyen" chi hien khi CA HAI bien duoi
REM     co gia tri. Thieu thi KHONG co loi nao - nut bien mat lang le, nen phai
REM     kiem o day chu khong doi luc bam moi biet. ---
set "OOURL="
set "OOSEC="
set "OOCB="
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("deploy\.env") do (
  if /i "%%a"=="ONLYOFFICE_URL"           set "OOURL=%%b"
  if /i "%%a"=="ONLYOFFICE_JWT_SECRET"    set "OOSEC=%%b"
  if /i "%%a"=="ONLYOFFICE_CALLBACK_BASE" set "OOCB=%%b"
)
if not defined OOURL (
  echo   ONLYOFFICE: TAT ^(thieu ONLYOFFICE_URL trong deploy\.env^) - nut sua truc tuyen SE AN.
) else (
  if not defined OOSEC (
    echo   ONLYOFFICE: TAT ^(thieu ONLYOFFICE_JWT_SECRET^) - nut sua truc tuyen SE AN.
  ) else (
    echo   ONLYOFFICE: da cau hinh URL va secret.
    if defined OOCB (echo     DS callback: da cau hinh.) else (echo     CANH BAO: thieu ONLYOFFICE_CALLBACK_BASE - trong Docker phai la http://host.docker.internal:3000)
    curl --max-time 5 -s -f -o nul !OOURL!/healthcheck && (echo     Document Server song ^(/healthcheck OK^).) || (echo     Document Server KHONG tra loi - kiem: docker ps ^| findstr documentserver)
  )
)

REM --- File ket qua co that tren dia hay khong. Seed chi tao DONG CSDL, khong
REM     tao file, nen bam vao ban cua seed la editor bao "khong tai duoc file" -
REM     dung thiet ke. Dem so BAN DANG TREO co file that: chi nhung ban do moi
REM     bam sua truc tuyen duoc. (Dem tong so file trong thu muc la vo nghia:
REM     no gom ca rac cua nhung lan test truoc.) ---
set "SOBAN=0"
set "COFILE=0"
set "THIEUFILE=0"
for /f %%v in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM task_file_versions" 2^>nul') do set "SOBAN=%%v"
for /f "usebackq tokens=1,2 delims=|" %%a in (`docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT f.item_id ^|^| '\' ^|^| v.ten_luu, f.trang_thai FROM task_file_versions v JOIN task_files f ON f.id = v.file_id WHERE f.trang_thai IN ('cho-xem','can-sua','cho-lanh-dao')" 2^>nul`) do (
  if exist "server\storage\ket-qua\%%a" (set /a COFILE+=1) else (set /a THIEUFILE+=1)
)
echo   Ket qua file: !SOBAN! ban trong CSDL; ban DANG CHO XU: !COFILE! co file that, !THIEUFILE! thieu file.
if "!COFILE!"=="0" (
  echo     -^> KHONG co ban nao bam sua truc tuyen duoc: hay TU NOP mot file .docx o NV-01.
) else (
  echo     -^> Co !COFILE! ban co file; van can test editor va callback bang trinh duyet.
)
echo.
echo ===================================================
echo  Mo:  http://127.0.0.1:8099    ^(Ctrl+Shift+R^)
echo  Console phai in dung ban da kiem o buoc [7/7].
echo.
REM In dung bo tai khoan dang co trong CSDL: dem email theo tung bo thay vi doan
REM theo che do vua chon - nguoi dung co the chon 1 (giu du lieu) sau khi da seed v14.
set "COV14=0"
for /f %%u in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM users WHERE email = 'nv1@test.local'" 2^>nul') do set "COV14=%%u"
if "!COV14!"=="0" (
  echo  Tai khoan mau BO CU - mat khau Test@12345, lan dau bi bat doi:
  echo    Giam doc        admin@test.local
  echo    Pho Giam doc    pgd2@test.local    ^(phu trach Ke toan + HCNS^)
  echo    Truong phong    tp01@test.local    ^(Quan ly Dao tao^)
  echo    Nhan vien       nv01@test.local  nv01b@test.local  ^(Quan ly Dao tao^)
  echo    Nhan vien       nv03@test.local    ^(Ke toan - de test khac phong^)
  echo.
  echo  Muon test LUONG KET QUA LA FILE thi chay lai va chon 4 ^(hoac: chay-test.bat /v14 /f^).
) else (
  echo  Tai khoan mau BO VONG 14 - mat khau Test@12345, KHONG bat doi lan dau:
  echo    Giam doc        gd@test.local     ^(admin - thay tat ca; DOT B: KHONG con tu duyet file^)
  echo    Pho Giam doc    pgd@test.local    ^(PH01+PH02 - chi duyet file khi CO TEN trong o
  echo                                       "Ban lanh dao kiem soat" cua nhiem vu - DIEM 12^)
  echo    Truong phong    tp@test.local     ^(PH01 - xem/gop y/"TP-PP phe duyet"/"Day ve can bo"/hoan thanh^)
  echo    Pho phong       pp@test.local     ^(PH01 - quyen nhu Truong phong^)
  echo    Can bo          nv1@test.local    ^(chu 5 nhiem vu mau - NGUOI KHAI ROI NOP file^)
  echo    Can bo          nv2@test.local    ^(cung phong - thu "khong phai viec cua minh"^)
  echo    Can bo          nvb@test.local    ^(PH02 - NGOAI phong, moi duong file phai 403^)
  echo.
  echo  *** HAI NUT CU DA BI THAY, dung tim lai:
  echo      "Trinh lanh dao"  -^>  "TP/PP phe duyet"   ^(co luu nguoi duyet + luc duyet^)
  echo      "Yeu cau sua"     -^>  gop vao "Day ve can bo"   ^(BAT BUOC ly do, ^>= 10 ky tu^)
  echo.
  echo  Duong test nhanh DOT B ^(day du: docs\HUONG-DAN-TEST-GIAO-DIEN.md muc 9b.23, 35 buoc^):
  echo    1. Q1/Q2 - nv1 -^> TAO MOI mot nhiem vu: no ra "Cho duyet" MOT MINH no ^(R5^).
  echo       O "Ket qua" KHONG CO nut tai file, chi co "Khai bao" ten + dinh dang + ty le.
  echo       Day la DUNG, khong phai loi. 5 nhiem vu MAU cua seed deu da "Da duyet" tu truoc
  echo       nen nut tai file VAN hien o chung - muon that Q1/Q2 thi phai tao nhiem vu moi.
  echo    2. Nguoi trong "Ban lanh dao kiem soat" duyet cay -^> nut tai file MOI hien ra -^>
  echo       nop file .docx that. Khai bao di truoc, file that luon di SAU.
  echo    3. R6 - gd@test.local ^(admin^) nop file: KHONG con tu len "da-duyet", chi "cho-xem"
  echo       hoac "cho-lanh-dao". Muon admin khoi cho thi dat ghi de file:create = cho-phep.
  echo    4. DIEM 7 - tp/pp -^> "Hang cho phe duyet" -^> nut "TP/PP phe duyet"; xem moc ai ky + luc nao.
  echo    5. DIEM 9 - nut "Day ve can bo" thay cho "Yeu cau sua", va khong cho bo trong ly do.
  echo    6. R4'' - sua ty le ^(cua file / cua nhiem vu / cua cong viec con^) -^> vao hang cho
  echo       phe duyet; gia tri CU van giu nguyen cho toi khi duoc duyet, cay KHONG bi ha ve
  echo       "Cho duyet" nen so thong ke khong mat. Mot nguoi dong y la du.
  echo    LUU Y: NV-02..05 chi co dong CSDL, khong co file tren dia -^> bam nut but chi
  echo    se bao loi tai file. Dung thiet ke, khong phai loi moi.
)
echo.
echo  Xem thong bao bang chuong tren giao dien, hoac SQL:
echo    docker exec qlcv-dev-db psql -U !PGU! -d %DB% -c "SELECT content FROM notifications ORDER BY id DESC LIMIT 5;"
echo  Xem cac ban file va ai nop:
echo    docker exec qlcv-dev-db psql -U !PGU! -d %DB% -c "SELECT v.id, v.version_no, v.ten_goc, u.full_name FROM task_file_versions v JOIN users u ON u.id = v.uploaded_by ORDER BY v.id;"
echo ===================================================
echo.
REM Sau "endlocal" thi EPBUOC bien mat -> phai xet TRUOC khi ket thuc pham vi.
if not defined EPBUOC pause
endlocal
goto :eof

REM =========================================================
REM  :sao_luu_truoc - pg_dump -Fc CSDL test ra ..\quanlycongviec-backups\uat-<ngay-gio>\
REM
REM  Goi tu buoc [2/7], tuc TRUOC buoc [3/7] (co the DROP DATABASE) va TRUOC buoc
REM  [4/7] (chay migration). Dat o day chu khong dat ngay truoc migrate vi che do
REM  /reset xoa sach CSDL o [3/7] - neu backup nam o [4/7] thi luc do da muon.
REM
REM  Dung de ra file roi "docker cp" ve, KHONG dung "docker exec pg_dump > file.dump":
REM  cmd ghi stdout qua bo loc code page, dump -Fc la nhip phan nen de hong am tham.
REM
REM  Loi thi tra ve 9 de cho goi dung lai: thua backup hon mat du lieu, nhat la khi
REM  029 khong co down tu dong (lich su verdict yeu-cau-sua/trinh-lanh-dao da gop).
REM =========================================================
:sao_luu_truoc
set "DACOMIG=0"
for /f %%g in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT CASE WHEN to_regclass('pgmigrations') IS NULL THEN 0 ELSE (SELECT count(*) FROM pgmigrations) END" 2^>nul') do set "DACOMIG=%%g"
if not "!DACOMIG!"=="0" goto :sl_dump
echo   Backup: %DB% chua co bang pgmigrations ^(CSDL trong^) - khong co gi de mat, bo qua.
exit /b 0

:sl_dump
set "STAMP="
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%t"
REM PowerShell bi cam thi van phai co thu muc backup: lay so ngau nhien thay ngay gio.
REM Tuyet doi khong dung ten co dinh - lan chay thu hai se ghi de ban backup thu nhat.
if not defined STAMP set "STAMP=khong-ro-gio-%RANDOM%"
set "BKDIR=!BKROOT!\uat-!STAMP!"
echo   Backup %DB% ^(da co !DACOMIG! dong migration^) ...
echo     dich: !BKDIR!
mkdir "!BKDIR!" 2>nul
docker exec qlcv-dev-db pg_dump -U !PGU! -Fc -f /tmp/qlcv-uat.dump %DB% || (echo   PG_DUMP LOI - dung lai, chua lam gi tiep. & exit /b 9)
docker cp qlcv-dev-db:/tmp/qlcv-uat.dump "!BKDIR!\%DB%.dump" || (echo   KHONG LAY DUOC FILE DUMP RA KHOI CONTAINER & docker exec qlcv-dev-db rm -f /tmp/qlcv-uat.dump & exit /b 9)
docker exec qlcv-dev-db sh -c "pg_restore -l /tmp/qlcv-uat.dump > /tmp/qlcv-uat-list.txt" 2>nul
docker cp qlcv-dev-db:/tmp/qlcv-uat-list.txt "!BKDIR!\%DB%-restore-list.txt" 2>nul
docker exec qlcv-dev-db rm -f /tmp/qlcv-uat.dump /tmp/qlcv-uat-list.txt
set "BKSIZE=0"
for %%F in ("!BKDIR!\%DB%.dump") do set "BKSIZE=%%~zF"
if !BKSIZE! GEQ 10000 goto :sl_ok
echo   FILE BACKUP CHI !BKSIZE! BYTE - qua nho, nghi ngo. Dung lai, chua lam gi tiep.
exit /b 9

:sl_ok
echo   Backup OK: !BKSIZE! byte.
echo     Muon quay lai ban nay:
echo       docker cp "!BKDIR!\%DB%.dump" qlcv-dev-db:/tmp/r.dump
echo       docker exec qlcv-dev-db pg_restore -U !PGU! -d %DB% --clean --if-exists /tmp/r.dump
exit /b 0

REM =========================================================
REM  :kiem_dot_b - xac nhan migration 029 that su da len %DB%, va in ra nhung gi
REM  nguoi test can biet TRUOC khi bam.
REM
REM  Vi sao phai kiem rieng: 029 doi ca DU LIEU lan RANG BUOC (gop yeu-cau-sua vao
REM  tra-ve-cbo, doi trinh-lanh-dao thanh tp-phe-duyet, them change_kind 'ty-le').
REM  Neu no chua len thi giao dien da la ban DOT B con CSDL thi van la ban cu -
REM  moi hanh dong deu loi ma nhin nhu loi cua nguoi test. Nen thieu mot dau hieu
REM  la DUNG lai, khong de nguoi dung test mat 35 buoc roi moi phat hien.
REM
REM  Khong dung LIKE '%...%' o day: dau %% trong file .bat phai viet %%%%, de sai la
REM  am tham thanh rong. Dung strpos() va boc dau ^> vi cmd hieu > la chuyen huong.
REM =========================================================
:kiem_dot_b
echo.
echo   --- Dau hieu cua migration 029 ^(DOT B: gop hai truc^) ---
set "LOI029=0"

set "COTTP=0"
for /f %%c in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='task_files' AND column_name IN ('tp_duyet_boi','tp_duyet_luc')" 2^>nul') do set "COTTP=%%c"
if "!COTTP!"=="2" (echo     [OK]    task_files co du tp_duyet_boi + tp_duyet_luc) else (echo     [THIEU] task_files.tp_duyet_boi/tp_duyet_luc: chi thay !COTTP!/2 & set /a LOI029+=1)

set "VERDICTCU=0"
for /f %%c in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT strpos(pg_get_constraintdef(oid),'yeu-cau-sua') + strpos(pg_get_constraintdef(oid),'trinh-lanh-dao') FROM pg_constraint WHERE conname='task_file_flow_hanh_dong_check'" 2^>nul') do set "VERDICTCU=%%c"
if "!VERDICTCU!"=="0" (echo     [OK]    CHECK cua task_file_flow het 'yeu-cau-sua' va 'trinh-lanh-dao') else (echo     [THIEU] CHECK cua task_file_flow VAN con ma cu: !VERDICTCU! & set /a LOI029+=1)

set "KINDTYLE="
for /f %%c in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT strpos(pg_get_constraintdef(oid),'ty-le') FROM pg_constraint WHERE conname='approval_changes_change_kind_check'" 2^>nul') do set "KINDTYLE=%%c"
if not defined KINDTYLE (echo     [THIEU] khong tim thay CHECK approval_changes_change_kind_check & set /a LOI029+=1) else if "!KINDTYLE!"=="0" (echo     [THIEU] approval_changes.change_kind CHUA nhan 'ty-le' & set /a LOI029+=1) else (echo     [OK]    approval_changes.change_kind nhan 'ty-le')

set "COTFILEID=0"
for /f %%c in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='approval_changes' AND column_name='file_id'" 2^>nul') do set "COTFILEID=%%c"
if "!COTFILEID!"=="1" (echo     [OK]    approval_changes.file_id - de nghi ty le cua FILE) else (echo     [THIEU] approval_changes.file_id: !COTFILEID!/1 & set /a LOI029+=1)

set "IDXDOC=0"
REM Hai index pending nay da UNIQUE tu 023, nen "co UNIQUE" khong chung minh 029 da len.
REM Dau hieu that cua 029 la khoa index duoc THEM change_kind (va COALESCE(file_id,0) o
REM cai cua item) - khong co no thi mot de nghi doi tich dang treo chan luon de nghi doi
REM ty le cua cung nhiem vu. Khong dung "^> 0": TRONG dau ngoac kep cmd GIU NGUYEN dau ^
REM va tra no xuong PostgreSQL -> loi cu phap. BETWEEN thay cho phep so sanh >.
for /f %%c in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('approval_changes_pending_work','approval_changes_pending_item') AND strpos(indexdef,'change_kind') BETWEEN 1 AND 999" 2^>nul') do set "IDXDOC=%%c"
if "!IDXDOC!"=="2" (echo     [OK]    hai index pending cua approval_changes da theo change_kind) else (echo     [THIEU] chi !IDXDOC!/2 index pending co change_kind trong khoa & set /a LOI029+=1)

set "DONGCU=0"
for /f %%c in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM task_file_flow WHERE hanh_dong IN ('yeu-cau-sua','trinh-lanh-dao')" 2^>nul') do set "DONGCU=%%c"
if "!DONGCU!"=="0" (echo     [OK]    khong con dong lich su nao dung ma verdict cu) else (echo     [THIEU] van con !DONGCU! dong lich su dung 'yeu-cau-sua'/'trinh-lanh-dao' & set /a LOI029+=1)

if "!LOI029!"=="0" goto :kb_buster
echo.
echo   *** 029 CHUA LEN DAY DU: !LOI029! dau hieu thieu. KHONG test DOT B luc nay. ***
echo   Cach xu ly: dong cua so "QLCV TEST - Node" roi chay lai  chay-test.bat /giu /f
echo   Neu van loi: doc loi cua buoc [4/7]. TUYET DOI khong chay "npm run migrate:up"
echo   bang tay - no doc deploy\.env va trung database DEV, khong phai %DB%.
exit /b 1

:kb_buster
echo   --- Cache buster: Console trinh duyet phai in DUNG ban nay ---
findstr /c:"assets/js/app.js?v=" "%~dp0web\index.html"

echo   --- Du lieu san co de test DOT B ---
echo   Nhiem vu cap 3 theo trang thai duyet cay ^(Q1/Q2 can it nhat mot cay CHUA "Da duyet"^):
docker exec qlcv-dev-db psql -U !PGU! -d %DB% -c "SELECT approval_status, count(*) FROM work_items WHERE level=3 GROUP BY 1 ORDER BY 2 DESC;"
echo   De nghi dang cho trong approval_changes ^("ty-le" la cua DOT B, "gui-bld" cua DOT A^):
docker exec qlcv-dev-db psql -U !PGU! -d %DB% -c "SELECT change_kind, count(*) FROM approval_changes WHERE approved_at IS NULL GROUP BY 1 ORDER BY 1;"
set "SUPRONG=0"
for /f %%c in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM work_items WHERE level=3 AND cardinality(supervisor_ids) = 0" 2^>nul') do set "SUPRONG=%%c"
if not "!SUPRONG!"=="0" (
  echo   CANH BAO: !SUPRONG! nhiem vu cap 3 CHUA co ai trong "Ban lanh dao kiem soat".
  echo     - R1^(a^): KHONG ai duyet duoc nhung cay do, ke ca admin/Giam doc.
  echo     - DIEM 12: dungNguoiDuyetFile CO Y bo qua khi o trong, nen khong that duoc
  echo       cai "o ghi nguoi khac ma ai cung duyet duoc" - phai chon nguoi truoc.
  echo     -^> Mo nhiem vu, chon Ban lanh dao kiem soat roi moi test.
) else (
  echo   [OK]    moi nhiem vu cap 3 deu da co Ban lanh dao kiem soat.
)
exit /b 0

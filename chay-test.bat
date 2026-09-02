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
REM       (/f = tu dung tien trinh dang giu cong 3000 roi bat lai Node). ---
set "MODE="
if /i "!ARG1!"=="/giu"   set "MODE=1"
if /i "!ARG1!"=="/seed"  set "MODE=2"
if /i "!ARG1!"=="/reset" set "MODE=3"
if /i "!ARG1!"=="/v14"   set "MODE=4"

echo ===================================================
echo   QLCV - MAY CHU TEST TAY   ^(CSDL %DB%^)
echo ===================================================

if not defined MODE (
  echo.
  echo   1 = Giu du lieu dang co                       ^(mac dinh^)
  echo   2 = Seed BO CU §8.3    - 13 tai khoan TEST001..TEST013
  echo   3 = XOA SACH CSDL test roi tao lai ^(+ seed bo cu^)
  echo   4 = Seed BO VONG 14    - luong KET QUA LA FILE
  echo       ^(7 nguoi gd/pgd/tp/pp/nv1/nv2/nvb@test.local, 5 nhiem vu du 5 trang thai^)
  echo   0 = Thoat
  echo.
  echo   LUU Y: bo 2 va bo 4 LOAI TRU nhau - bo nao chay sau thi xoa bo truoc.
  echo   Muon test luong file / hang cho phe duyet ket qua thi chon 4.
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
echo   nguoi dung=!PGU!  cong=!PGPORT!  csdl=%DB%
echo.

REM --- [2/7] Bat container CSDL, giu nguyen du lieu ---
echo [2/7] Bat container CSDL ...
docker compose -f deploy/docker-compose.dev.yml up -d
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
  echo   Chua co - tao moi, se nap du lieu mau.
  docker exec qlcv-dev-db psql -U !PGU! -d postgres -c "CREATE DATABASE %DB%;" || (!DUNG! & exit /b 1)
  set "SEED=1"
)
echo.

REM --- [4/7] Migration + (tuy chon) du lieu mau ---
echo [4/7] Chay migration len %DB% ...
pushd server
call npm run migrate:up || (echo   MIGRATION LOI & popd & !DUNG! & exit /b 1)
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
  docker rm -f app >nul 2>&1
  docker run -d --name app --network qlcv-uat alpine/socat tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000 >nul || (!DUNG! & exit /b 1)
  echo   cau "app" da dung.
)
set "S="
for /f %%s in ('docker inspect -f "{{.State.Running}}" qlcv-uat-nginx 2^>nul') do set "S=%%s"
if /i "!S!"=="true" (
  echo   nginx dang chay.
) else (
  docker rm -f qlcv-uat-nginx >nul 2>&1
  docker run -d --name qlcv-uat-nginx --network qlcv-uat -p 127.0.0.1:8099:80 -v "%cd%/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" -v "%cd%/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" -v "%cd%/web:/srv/web:ro" nginx:1.27-alpine >nul || (!DUNG! & exit /b 1)
  echo   nginx da dung.
)
echo.

REM --- [6/7] Giai phong cong 3000 roi bat Node tro vao CSDL test ---
echo [6/7] Cong 3000 ...
set "PID3000="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"TCP .*:3000 .*LISTENING"') do if not defined PID3000 set "PID3000=%%p"
if defined PID3000 (
  echo   Co tien trinh PID !PID3000! dang giu cong 3000.
  echo   May chu cu thuong noi CSDL dev ^(khong phai %DB%^) nen phai dung no.
  if defined EPBUOC (
    echo   Co /f - dung luon, khong hoi.
    set "DAP=1"
  ) else (
    choice /c YN /n /m "  Dung PID !PID3000! va khoi dong lai voi CSDL test? [Y/N] "
    set "DAP=!errorlevel!"
  )
  if not "!DAP!"=="1" (
    echo.
    echo   Giu nguyen tien trinh cu. CANH BAO: 8099 van la may chu cu, co the sai CSDL.
    echo   Muon khoi dong lai ma khong bam chon duoc thi chay:  chay-test.bat /giu /f
    goto :xong
  )
  REM Diet CA CAY: "npm run dev" = "node --watch src/server.js" nen tien trinh
  REM giu cong 3000 chi la CON; diet mot minh no thi watcher (cha) bat lai ngay
  REM may chu CU voi DATABASE_URL cu. Tim cha (chi khi cha cung la node.exe)
  REM roi diet cha truoc -> khong dung tien trinh node cua viec khac.
  set "PIDCHA="
  for /f %%c in ('powershell -NoProfile -Command "$ds=Get-CimInstance Win32_Process; $me=$ds ^| Where-Object { $_.ProcessId -eq !PID3000! }; if ($me) { $cha=$ds ^| Where-Object { $_.ProcessId -eq $me.ParentProcessId }; if ($cha -and $cha.Name -eq 'node.exe') { $cha.ProcessId } }"') do set "PIDCHA=%%c"
  if defined PIDCHA (
    echo   Cha cua no la watcher node PID !PIDCHA! - diet cha truoc.
    taskkill /PID !PIDCHA! /T /F >nul 2>&1
  )
  taskkill /PID !PID3000! /T /F >nul 2>&1
  REM Cho cong 3000 rong THAT - watcher co the con hap hoi vai giay.
  set "RONG=0"
  for /l %%i in (1,1,15) do (
    if "!RONG!"=="0" (
      set "CON="
      for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"TCP .*:3000 .*LISTENING"') do if not defined CON set "CON=%%p"
      if not defined CON (set "RONG=1") else (timeout /t 1 /nobreak >nul)
    )
  )
  if "!RONG!"=="0" (
    echo.
    echo   CONG 3000 VAN BI GIU - dung lai de khoi bat may chu chet vi EADDRINUSE.
    echo   Xem ai giu:  netstat -ano ^| findstr :3000
    echo   Roi diet tay:  taskkill /PID ^<pid^> /T /F
    !DUNG! & exit /b 1
  )
  echo   Da dung may chu cu, cong 3000 rong.
) else (
  echo   Cong 3000 dang rong.
)
start "QLCV TEST - Node (%DB%)" cmd /k "cd /d "%~dp0server" & set "DATABASE_URL=!DATABASE_URL!" & npm run dev"
echo   Da mo cua so "QLCV TEST - Node". Cho may chu len ...
set "UP=0"
for /l %%i in (1,1,40) do (
  if "!UP!"=="0" (
    curl -s -f -o nul http://127.0.0.1:3000/healthz && set "UP=1"
    if "!UP!"=="0" timeout /t 1 /nobreak >nul
  )
)
if "!UP!"=="1" (
  echo   /healthz OK.
) else (
  echo   Chua thay /healthz - doc loi trong cua so "QLCV TEST - Node".
)

:xong
echo.
REM --- [7/7] Kiem lai bang mat may: ban app.js, migration, duong 8099 ---
echo [7/7] Kiem lai truoc khi test ...
REM Ban hieu trong app.js: dong 'console.log("[QLCV] app.js 20260828-86");'
REM -> tokens=3 lay '20260828-86");' roi cat 3 ky tu duoi.
set "BAN="
for /f "tokens=3 delims= " %%a in ('findstr /r /c:"\[QLCV\] app.js" web\assets\js\app.js') do if not defined BAN set "BAN=%%a"
if defined BAN set "BAN=!BAN:~0,-3!"
REM Bo dem trong index.html: 'app.js?v=20260828-86"></script>' -> cat 11 ky tu duoi.
set "BUS="
for /f "tokens=3 delims==" %%a in ('findstr /r /c:"app.js?v=" web\index.html') do if not defined BUS set "BUS=%%a"
if defined BUS set "BUS=!BUS:~0,-11!"
if not defined BAN (
  echo   Khong doc duoc ban hieu trong web\assets\js\app.js - kiem tra tay.
) else (
  if "!BAN!"=="!BUS!" (
    echo   Ban app.js = !BAN!  ^(index.html khop^).
  ) else (
    echo   LECH BO DEM: app.js=!BAN!  nhung index.html app.js?v=!BUS!
    echo   -^> trinh duyet se dung ban CU. Sua app.js?v= trong web\index.html cho khop.
  )
)
set "MIG="
for /f %%m in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1" 2^>nul') do set "MIG=%%m"
if defined MIG (
  echo   Migration moi nhat tren %DB%: !MIG!
) else (
  echo   Khong doc duoc bang pgmigrations - migration co the chua chay.
)
set "NHIEUTHANG="
REM Trong for /f ('...') thi < va > van la chuyen huong cua cmd -> dung
REM IS DISTINCT FROM thay cho <> de khoi phai boc dau ^.
for /f %%n in ('docker exec qlcv-dev-db psql -U !PGU! -d %DB% -tAc "SELECT count(*) FROM works WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND date_trunc('month',start_date) IS DISTINCT FROM date_trunc('month',end_date)" 2^>nul') do set "NHIEUTHANG=%%n"
if defined NHIEUTHANG echo   Cong viec dai hon 1 thang ^(co tab "Ten theo thang"^): !NHIEUTHANG!
curl -s -f -o nul http://127.0.0.1:8099/healthz && (echo   8099 /healthz OK.) || (echo   8099 /healthz LOI - xem: docker logs qlcv-uat-nginx)
REM Diem quan trong nhat: may chu dang noi CSDL NAO. /readyz chi noi "db up",
REM khong noi ten CSDL -> goi /readyz de chac chan co ket noi roi dem phien
REM trong pg_stat_activity. Neu = 0 thi may chu dang noi CSDL khac (thuong la dev).
curl -s -f -o nul http://127.0.0.1:8099/readyz >nul 2>&1
set "PHIEN=0"
for /f %%d in ('docker exec qlcv-dev-db psql -U !PGU! -d postgres -tAc "SELECT count(*) FROM pg_stat_activity WHERE datname='%DB%'" 2^>nul') do set "PHIEN=%%d"
if "!PHIEN!"=="0" (
  echo   CANH BAO: khong co phien nao tren %DB% - may chu dang noi CSDL KHAC.
  echo   -^> dong cua so "QLCV TEST - Node" roi chay lai:  chay-test.bat /giu /f
) else (
  echo   May chu dang noi %DB% ^(!PHIEN! phien^) - dung CSDL test.
)
if defined BAN (
  curl -s http://127.0.0.1:8099/assets/js/app.js 2>nul | findstr /c:"[QLCV] app.js !BAN!" >nul && (echo   Nginx dang phuc vu app.js !BAN!.) || (echo   Nginx phuc vu app.js KHAC !BAN! - Ctrl+Shift+R, hoac dung lai qlcv-uat-nginx.)
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
    echo   ONLYOFFICE: BAT  url=!OOURL!
    if defined OOCB (echo     DS goi nguoc ve app qua: !OOCB!) else (echo     CANH BAO: thieu ONLYOFFICE_CALLBACK_BASE - trong Docker phai la http://host.docker.internal:3000)
    curl -s -f -o nul !OOURL!/healthcheck && (echo     Document Server song ^(/healthcheck OK^).) || (echo     Document Server KHONG tra loi - kiem: docker ps ^| findstr documentserver)
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
  echo     -^> Co !COFILE! ban bam nut but chi la mo duoc editor.
)
echo.
echo ===================================================
echo  Mo:  http://127.0.0.1:8099    ^(Ctrl+Shift+R^)
if defined BAN (echo  Console phai in:  [QLCV] app.js !BAN!) else (echo  Console phai in:  [QLCV] app.js ^<xem web\assets\js\app.js^>)
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
  echo    Giam doc        gd@test.local     ^(admin - thay tat ca^)
  echo    Pho Giam doc    pgd@test.local    ^(phu trach PH01+PH02 - nhan "Trinh lanh dao"^)
  echo    Truong phong    tp@test.local     ^(PH01 - xem/gop y/yeu cau sua/trinh/hoan thanh^)
  echo    Pho phong       pp@test.local     ^(PH01 - quyen nhu Truong phong^)
  echo    Can bo          nv1@test.local    ^(chu 5 nhiem vu mau - NGUOI NOP file^)
  echo    Can bo          nv2@test.local    ^(cung phong - thu "khong phai viec cua minh"^)
  echo    Can bo          nvb@test.local    ^(PH02 - NGOAI phong, moi duong file phai 403^)
  echo.
  echo  Duong test nhanh luong file ^(chi tiet: docs\HUONG-DAN-TEST-GIAO-DIEN.md muc 9b^):
  echo    1. nv1@test.local -^> Nhiem vu NV-01 -^> "Tai file len" mot file .docx that
  echo    2. tp@test.local  -^> "Hang cho phe duyet" -^> tab "Phe duyet ket qua"
  echo    3. Bam nut but chi ^(sua truc tuyen^) -^> sua -^> "Luu thanh ban moi" -^> xem "Lich su"
  echo    LUU Y: NV-02..05 chi co dong CSDL, khong co file tren dia -^> bam nut but chi
  echo    se bao loi tai file. Dung thiet ke, khong phai loi moi.
)
echo.
echo  Xem thong bao ^(chua co chuong tren giao dien^):
echo    docker exec qlcv-dev-db psql -U !PGU! -d %DB% -c "SELECT content FROM notifications ORDER BY id DESC LIMIT 5;"
echo  Xem cac ban file va ai nop:
echo    docker exec qlcv-dev-db psql -U !PGU! -d %DB% -c "SELECT v.id, v.version_no, v.ten_goc, u.full_name FROM task_file_versions v JOIN users u ON u.id = v.uploaded_by ORDER BY v.id;"
echo ===================================================
echo.
REM Sau "endlocal" thi EPBUOC bien mat -> phai xet TRUOC khi ket thuc pham vi.
if not defined EPBUOC pause
endlocal

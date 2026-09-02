@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM =========================================================
REM  QLCV - DUNG LAI TU DAU (XOA SACH CSDL test roi seed lai)
REM
REM  Khac chay-test.bat: file nay LUON xoa sach va seed lai, khong hoi gi.
REM  Muon GIU du lieu, hoac chon bo seed, hoac co buoc tu kiem thi dung:
REM      chay-test.bat
REM
REM  2026-09-02 - sua 2 cho:
REM   (1) BO mat khau CSDL ghi cung trong file (truoc day nam ngay trong ma
REM       nguon) -> doc tu deploy\.env nhu chay-test.bat. Nho vay file
REM       nay commit duoc ma khong lo bi mat, va doi mat khau CSDL khong phai
REM       sua .bat nua.
REM   (2) Them lua chon bo seed: khong co co = 13 tai khoan cu §8.3 (mac dinh),
REM       /v14 = 7 tai khoan Vong 14 + 5 nhiem vu du 5 trang thai file.
REM       Hai bo LOAI TRU nhau (ca hai deu TRUNCATE bang users).
REM =========================================================

set "DB=quanlycongviec_uat"
set "SEEDCMD=seed:dev"
set "SEEDTEN=BO CU §8.3 - 13 tai khoan TEST001..TEST013"
if /i "%~1"=="/v14" (
  set "SEEDCMD=seed:v14"
  set "SEEDTEN=BO VONG 14 - 7 tai khoan gd/pgd/tp/pp/nv1/nv2/nvb@test.local"
)

echo ===================================================
echo   KHOI DONG DU AN QUAN LY CONG VIEC (XOA DATA CU)
echo   Du lieu mau: !SEEDTEN!
echo ===================================================

REM --- [0/6] Mat khau CSDL: doc tu deploy\.env, KHONG ghi trong file nay ---
if not exist "deploy\.env" (
  echo   THIEU deploy\.env - tao tu deploy\.env.example truoc.
  pause & exit /b 1
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
  pause & exit /b 1
)
set "DATABASE_URL=postgres://!PGU!:!PGP!@127.0.0.1:!PGPORT!/%DB%"

echo.
echo [1/6] Dang xoa cac container va mang cu...
docker rm -f app qlcv-uat-nginx >nul 2>&1
docker network rm qlcv-uat >nul 2>&1

echo.
echo [2/6] Khoi dong Database...
docker compose -f deploy/docker-compose.dev.yml up -d
echo Doi 3 giay de DB san sang...
timeout /t 3 /nobreak >nul

echo.
echo [3/6] Reset lai Database (Xoa sach data cu, tao moi)...
docker exec -i qlcv-dev-db psql -U !PGU! -d postgres -c "DROP DATABASE IF EXISTS %DB% WITH (FORCE);"
docker exec -i qlcv-dev-db psql -U !PGU! -d postgres -c "CREATE DATABASE %DB%;"

echo.
echo [4/6] Chay Migrate va Nap du lieu mau (Seed)...
cd server
call npm run migrate:up
call npm run !SEEDCMD!
if /i not "%~1"=="/v14" docker exec -i qlcv-dev-db psql -U !PGU! -d %DB% -c "UPDATE users SET full_name = 'Giám đốc', position = 'Giám đốc' WHERE email = 'admin@test.local';"
cd ..

echo.
echo [5/6] Khoi dong may chu Nginx va Socat...
docker network create qlcv-uat
docker run -d --name app --network qlcv-uat alpine/socat tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000
docker run -d --name qlcv-uat-nginx --network qlcv-uat -p 127.0.0.1:8099:80 -v "%cd%/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" -v "%cd%/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" -v "%cd%/web:/srv/web:ro" nginx:1.27-alpine

echo.
echo [6/6] Dang bat Server Node.js...
start "QLCV - Server Node.js" cmd /k "cd /d "%~dp0server" & set "DATABASE_URL=!DATABASE_URL!" & npm run dev"

echo.
echo ===================================================
echo HOAN THANH!
echo Ban hay mo trinh duyet va truy cap: http://127.0.0.1:8099
echo (Nho an Ctrl + F5 de xoa cache nhe)
echo.
echo Mat khau moi tai khoan mau: Test@12345
if /i "%~1"=="/v14" (
  echo Bo Vong 14: gd@ pgd@ tp@ pp@ nv1@ nv2@ nvb@test.local  ^(khong bat doi mat khau^)
  echo Test luong ket qua la file: docs\HUONG-DAN-TEST-GIAO-DIEN.md muc 9b
) else (
  echo Bo cu: admin@ pgd2@ tp01@ nv01@test.local ...  ^(bi bat doi mat khau lan dau^)
  echo Muon test luong ket qua la file thi chay:  chay.bat /v14
)
echo Muon GIU du lieu / co buoc tu kiem thi dung:  chay-test.bat
echo ===================================================
pause
endlocal
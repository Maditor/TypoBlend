@echo off
setlocal enabledelayedexpansion
title TypoBlend - Trinh cai dat CEP cho Photoshop

REM File nay dat CUNG CAP voi CSXS, client, lib (ngay trong thu muc TypoBlend)
set "EXT_NAME=TypoBlend"
set "SRC_DIR=%~dp0"
if "%SRC_DIR:~-1%"=="\" set "SRC_DIR=%SRC_DIR:~0,-1%"
set "DEST_DIR=%APPDATA%\Adobe\CEP\extensions\%EXT_NAME%"

echo ================================================
echo    TypoBlend - Trinh cai dat cho Photoshop
echo ================================================
echo.

REM ---- 1. Kiem tra dang dung dung thu muc khong ----
if not exist "%SRC_DIR%\CSXS\manifest.xml" (
    echo [LOI] Khong tim thay CSXS\manifest.xml cung cap voi file nay.
    echo Hay chac chan install_win.bat dang nam NGAY TRONG thu muc TypoBlend
    echo ^(cung cap voi CSXS, client^) roi chay lai.
    echo.
    pause
    exit /b 1
)

REM ---- 2. Bat PlayerDebugMode de Photoshop chap nhan extension chua ky ----
echo [1/3] Dang bat che do Debug cho CEP...
for %%V in (6 7 8 9 10 11 12) do (
    reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)
echo       -^> Da bat PlayerDebugMode cho CSXS.6 den CSXS.12

REM ---- 3. Kiem tra file client\CSInterface.js (da co san trong bo, chi de phong) ----
echo.
if not exist "%SRC_DIR%\client\CSInterface.js" (
    echo [CANH BAO] Chua co file "client\CSInterface.js".
    echo Panel se khong chay duoc neu thieu file nay.
    echo.
)

REM ---- 4. Copy extension vao thu muc CEP cua Adobe (theo user, khong can quyen Admin) ----
echo [2/3] Dang sao chep extension...
if exist "%DEST_DIR%" (
    echo       -^> Phat hien ban cai dat cu, dang go bo...
    rmdir /s /q "%DEST_DIR%"
)
if not exist "%APPDATA%\Adobe\CEP\extensions" (
    mkdir "%APPDATA%\Adobe\CEP\extensions" >nul 2>&1
)
xcopy "%SRC_DIR%" "%DEST_DIR%\" /E /I /H /Y >nul

if not exist "%DEST_DIR%\CSXS\manifest.xml" (
    echo [LOI] Sao chep khong thanh cong. Vui long thu lai hoac copy thu cong.
    echo Thu muc dich: %DEST_DIR%
    pause
    exit /b 1
)
echo       -^> Da cai vao: %DEST_DIR%

REM ---- 5. Hoan tat ----
echo.
echo [3/3] Cai dat hoan tat!
echo.
echo    Hay KHOI DONG LAI Photoshop, sau do vao:
echo    Window ^> Extensions ^(Legacy^) ^> TypoBlend
echo.
echo ================================================
pause

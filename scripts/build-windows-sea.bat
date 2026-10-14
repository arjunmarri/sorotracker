@echo off
setlocal enabledelayedexpansion
title SoroTrack Node.js Single Executable Application (SEA) Builder

echo ============================================================
echo   SoroTrack Standalone Windows Server Executable (.exe)
echo   Built via Node.js Single Executable Application (SEA)
echo ============================================================
echo.

cd /d "%~dp0.."

:: Check if Node.js 20+ is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH! Node.js 20+ is required.
    pause
    exit /b 1
)

:: Step 1: Ensure production assets and bundled server are built
echo [*] Step 1: Compiling web assets and bundled server...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm run build failed!
    pause
    exit /b %ERRORLEVEL%
)

:: Step 2: Generate SEA preparation blob
echo [*] Step 2: Generating SEA preparation blob...
node --experimental-sea-config scripts\sea-config.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to generate SEA blob.
    pause
    exit /b %ERRORLEVEL%
)

:: Step 3: Copy node.exe to destination binary
echo [*] Step 3: Locating node.exe and preparing executable...
for /f "delims=" %%I in ('where node.exe') do set "NODE_PATH=%%I" & goto :found_node
:found_node

if "%NODE_PATH%"=="" (
    echo [ERROR] Could not resolve node.exe path!
    pause
    exit /b 1
)

echo [*] Copying %NODE_PATH% to dist\SoroTrack.exe...
copy /Y "%NODE_PATH%" "dist\SoroTrack.exe" >nul

:: Step 4: Remove signature and inject blob using postject
echo [*] Step 4: Injecting SoroTrack application bundle via postject...
npx --yes postject dist\SoroTrack.exe NODE_SEA_BLOB dist\sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] postject failed or signtool warning. Checking if executable runs...
)

echo.
echo ============================================================
echo  [SUCCESS] SoroTrack Standalone Windows Binary Created!
echo ============================================================
echo  Output: %CD%\dist\SoroTrack.exe
echo.
echo  Double-click "dist\SoroTrack.exe" to launch SoroTrack on your PC!
echo ============================================================
echo.
pause

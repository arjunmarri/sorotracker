@echo off
setlocal enabledelayedexpansion
title SoroTrack Native Windows Binary Compiler

echo ============================================================
echo   SoroTrack Native Windows Binary (.exe) Builder
echo ============================================================
echo.

:: Locate built-in Microsoft .NET C# compiler (pre-installed on all Windows 10/11 machines)
set "CSC_EXE="
if exist "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set "CSC_EXE=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
) else if exist "%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
    set "CSC_EXE=%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

if "%CSC_EXE%"=="" (
    echo [ERROR] Microsoft .NET Framework csc.exe compiler not found in %SystemRoot%\Microsoft.NET!
    echo Please make sure .NET Framework 4.0+ is installed on this PC.
    pause
    exit /b 1
)

echo [*] Found C# Compiler: %CSC_EXE%
echo [*] Compiling scripts\SoroTrackInstaller.cs into native Windows executable...

"%CSC_EXE%" /nologo /target:winexe /optimize+ /r:System.dll,System.Windows.Forms.dll,System.Drawing.dll,System.Core.dll /out:"%~dp0SoroTrackInstaller.exe" "%~dp0SoroTrackInstaller.cs"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Compilation failed. See compiler output above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ============================================================
echo  [SUCCESS] Native Windows Binary Created!
echo ============================================================
echo  Location: %~dp0SoroTrackInstaller.exe
echo.
echo  To distribute or test:
echo   1. Keep "extension\" folder alongside "SoroTrackInstaller.exe" (optional).
echo   2. Double-click "SoroTrackInstaller.exe" to automatically detect and
echo      install SoroTrack on Microsoft Edge, Google Chrome, Brave, Arc, Firefox!
echo ============================================================
echo.
pause

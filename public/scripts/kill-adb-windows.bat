@echo off
echo ==========================================
echo    ADBZero - Kill ADB Server Helper
echo ==========================================
echo.
echo Terminando ADB server...
adb kill-server 2>nul
if %errorlevel% equ 0 (
    echo [OK] ADB server terminato con successo!
) else (
    echo [INFO] ADB server non era in esecuzione o ADB non installato.
)
echo.
echo Ora puoi tornare su ADBZero nel browser e connettere il dispositivo.
echo.
pause


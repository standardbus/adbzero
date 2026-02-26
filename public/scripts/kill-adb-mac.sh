#!/bin/bash
echo "=========================================="
echo "   ADBZero - Kill ADB Server Helper"
echo "=========================================="
echo ""
echo "Terminando ADB server..."
adb kill-server 2>/dev/null
if [ $? -eq 0 ]; then
    echo "[OK] ADB server terminato con successo!"
else
    echo "[INFO] ADB server non era in esecuzione o ADB non installato."
fi
echo ""
echo "Ora puoi tornare su ADBZero nel browser e connettere il dispositivo."
echo ""
read -p "Premi INVIO per chiudere..."


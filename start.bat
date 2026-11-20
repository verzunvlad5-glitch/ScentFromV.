@echo off
chcp 65001 >nul
echo Запуск ScentFromV: http://localhost:3000
start "" http://localhost:3000
node --disable-warning=ExperimentalWarning server\index.js
pause

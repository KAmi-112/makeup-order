@echo off
cd /d D:\test1\makeup-order
echo 🍉 西瓜椰管理端
echo.
call npx vite build --base ./
call npm run preview -- --host --port 3000
pause

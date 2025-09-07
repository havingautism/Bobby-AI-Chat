@echo off
chcp 65001 >nul
echo 修复Tauri版本兼容性问题并重新启动...
echo.

echo 1. 停止所有Node.js进程...
taskkill /f /im node.exe >nul 2>&1

echo 2. 清理node_modules和package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo 3. 重新安装依赖...
npm install

echo 4. 启动Tauri应用...
echo 这将使用修复后的Tauri v2配置
echo.
npx tauri dev --no-watch

pause

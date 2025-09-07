@echo off
chcp 65001 >nul
echo 彻底清理并重新启动Tauri应用...
echo.

echo 1. 停止所有相关进程...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im app.exe >nul 2>&1
taskkill /f /im qdrant.exe >nul 2>&1

echo 2. 清理所有缓存和依赖...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist src-tauri\target rmdir /s /q src-tauri\target

echo 3. 重新安装依赖...
npm install

echo 4. 清理Rust缓存...
cd src-tauri
cargo clean
cd ..

echo 5. 启动Tauri应用...
echo 使用最简化的配置启动
echo.
npx tauri dev --no-watch

pause

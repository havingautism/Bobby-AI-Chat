@echo off
echo 启动Tauri应用（禁用文件监控）...
echo 这将避免Qdrant数据文件变化导致的自动重启
echo.
npx tauri dev --no-watch

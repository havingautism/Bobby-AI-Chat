@echo off
chcp 65001 >nul
echo Starting Tauri application (no file watching)...
echo This will avoid automatic restarts caused by Qdrant data file changes
echo.
npx tauri dev --no-watch

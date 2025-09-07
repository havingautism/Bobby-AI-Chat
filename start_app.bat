@echo off
echo 🚀 启动AI Chat应用...
echo.

REM 检查Qdrant二进制文件是否存在
if not exist "qdrant.exe" (
    echo ❌ 未找到Qdrant二进制文件
    echo 💡 请先运行: .\compile_qdrant.bat 来编译Qdrant
    pause
    exit /b 1
)

echo ✅ 找到Qdrant二进制文件

REM 检查Qdrant是否已经在运行
netstat -an | findstr ":6333" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Qdrant服务已在运行
) else (
    echo 🚀 启动Qdrant服务...
    start "Qdrant" .\qdrant.exe
    echo ⏳ 等待Qdrant服务启动...
    timeout /t 3 /nobreak >nul
)

REM 检查Qdrant服务是否启动成功
echo 🔍 检查Qdrant服务状态...
curl -s http://localhost:6333 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Qdrant服务运行正常
) else (
    echo ⚠️ Qdrant服务可能还在启动中，继续启动应用...
)

echo.
echo 🚀 启动Tauri应用...
npm run tauri


@echo off
echo 📥 下载预编译的Qdrant二进制文件...
echo.

REM 创建临时目录
if not exist "temp" mkdir temp
cd temp

echo 📥 下载Qdrant Windows二进制文件...
curl -L -o qdrant.zip "https://github.com/qdrant/qdrant/releases/download/v1.15.4/qdrant-1.15.4-x86_64-pc-windows-msvc.zip"

if %errorlevel% neq 0 (
    echo ❌ 下载失败，请检查网络连接
    pause
    exit /b 1
)

echo ✅ 下载完成

echo 📦 解压文件...
powershell -Command "Expand-Archive -Path 'qdrant.zip' -DestinationPath '.' -Force"

if %errorlevel% neq 0 (
    echo ❌ 解压失败
    pause
    exit /b 1
)

echo ✅ 解压完成

echo 📋 复制二进制文件...
if exist "qdrant.exe" (
    copy "qdrant.exe" "..\qdrant.exe"
    echo ✅ 二进制文件已复制到项目根目录
) else (
    echo ❌ 未找到qdrant.exe文件
    pause
    exit /b 1
)

cd ..
rmdir /s /q temp

echo.
echo 🎉 Qdrant二进制文件安装完成！
echo 📍 文件位置: %cd%\qdrant.exe
echo.
echo 💡 现在可以启动应用，Qdrant会自动启动
echo.
pause

@echo off
echo 开始编译Qdrant从源代码...
echo.

REM 检查Rust是否安装
cargo --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Rust，请先安装Rust
    echo 下载地址: https://rustup.rs/
    pause
    exit /b 1
)

echo ✅ Rust已安装

REM 创建qdrant目录
if not exist "qdrant" mkdir qdrant
cd qdrant

REM 克隆Qdrant仓库（如果不存在）
if not exist ".git" (
    echo 📥 克隆Qdrant仓库...
    git clone https://github.com/qdrant/qdrant.git .
    if %errorlevel% neq 0 (
        echo ❌ 克隆仓库失败
        pause
        exit /b 1
    )
    echo ✅ 仓库克隆完成
) else (
    echo 📥 更新Qdrant仓库...
    git pull
    if %errorlevel% neq 0 (
        echo ❌ 更新仓库失败
        pause
        exit /b 1
    )
    echo ✅ 仓库更新完成
)

echo 🔨 开始编译Qdrant...
cargo build --release --bin qdrant
if %errorlevel% neq 0 (
    echo ❌ 编译失败
    pause
    exit /b 1
)

echo ✅ Qdrant编译完成！

REM 复制二进制文件到项目根目录
if exist "target\release\qdrant.exe" (
    copy "target\release\qdrant.exe" "..\qdrant.exe"
    echo ✅ 二进制文件已复制到项目根目录
) else (
    echo ❌ 未找到编译后的二进制文件
    pause
    exit /b 1
)

cd ..
echo.
echo 🎉 Qdrant编译和安装完成！
echo 📍 二进制文件位置: %cd%\qdrant.exe
echo.
pause

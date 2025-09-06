@echo off
echo 🔨 开始编译Qdrant...
echo.

REM 检查Rust是否安装
cargo --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Rust，请先安装Rust
    echo 下载地址: https://rustup.rs/
    pause
    exit /b 1
)

echo ✅ Rust已安装

REM 检查Git是否安装
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Git，请先安装Git
    echo 下载地址: https://git-scm.com/
    pause
    exit /b 1
)

echo ✅ Git已安装

REM 检查Clang是否安装
clang --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Clang，请先安装LLVM
    echo 运行: winget install LLVM.LLVM
    pause
    exit /b 1
)

echo ✅ Clang已安装

REM 检查protoc是否安装
protoc --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到protoc，请先安装Protocol Buffers
    echo 运行: winget install Google.Protobuf
    pause
    exit /b 1
)

echo ✅ protoc已安装

echo.
echo 📥 开始编译Qdrant...
echo 这可能需要几分钟时间，请耐心等待...
echo.

REM 创建qdrant源码目录
if not exist "qdrant_src" mkdir qdrant_src
cd qdrant_src

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

echo.
echo 🔨 开始编译Qdrant...
echo 编译过程可能需要5-10分钟，请耐心等待...
cargo build --release --bin qdrant
if %errorlevel% neq 0 (
    echo ❌ 编译失败
    echo.
    echo 可能的解决方案:
    echo 1. 检查网络连接
    echo 2. 确保有足够的磁盘空间
    echo 3. 检查Rust版本是否最新
    echo 4. 重新安装依赖
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
echo 💡 现在可以启动应用，Qdrant会自动启动
echo.
pause

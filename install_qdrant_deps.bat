@echo off
echo 开始安装Qdrant编译依赖...
echo.

REM 检查是否已安装Rust
cargo --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Rust，请先安装Rust
    echo 下载地址: https://rustup.rs/
    pause
    exit /b 1
)

echo ✅ Rust已安装

REM 检查是否已安装Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Git，请先安装Git
    echo 下载地址: https://git-scm.com/
    pause
    exit /b 1
)

echo ✅ Git已安装

echo.
echo 📥 安装LLVM/Clang...
echo 请访问: https://releases.llvm.org/download.html
echo 下载并安装LLVM for Windows
echo 或者使用winget安装:
echo winget install LLVM.LLVM
echo.

echo 📥 安装Protocol Buffers...
echo 请访问: https://github.com/protocolbuffers/protobuf/releases
echo 下载protoc-xx.x-win64.zip并解压到C:\protoc
echo 或者使用winget安装:
echo winget install ProtocolBuffers.Protobuf
echo.

echo 🔧 设置环境变量...
echo 请将以下路径添加到系统PATH环境变量:
echo C:\Program Files\LLVM\bin
echo C:\protoc\bin
echo.

echo 📋 验证安装...
echo 安装完成后，请运行以下命令验证:
echo clang --version
echo protoc --version
echo.

pause


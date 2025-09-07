@echo off
echo 开始安装SQLite和sqlite-vec扩展...

REM 检查是否有Chocolatey
where choco >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo 请先安装Chocolatey: https://chocolatey.org/install
    pause
    exit /b 1
)

REM 安装SQLite
echo 安装SQLite...
choco install sqlite -y

REM 检查是否有Rust
where cargo >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo 安装Rust...
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    call %USERPROFILE%\.cargo\env
)

REM 创建扩展目录
if not exist "sqlite-extensions" mkdir sqlite-extensions
cd sqlite-extensions

REM 下载sqlite-vec扩展
echo 下载sqlite-vec扩展...
curl -L -o sqlite-vec.wasm https://github.com/asg017/sqlite-vec/releases/latest/download/sqlite-vec-windows-x86_64.wasm

cd ..

echo 安装完成！
echo.
echo 下一步：
echo 1. 运行 'npm install' 安装前端依赖
echo 2. 运行 'cd src-tauri && cargo build' 构建Rust后端
echo 3. 运行 'npm run tauri dev' 启动应用
echo.
echo 注意：sqlite-vec扩展已下载到 sqlite-extensions/ 目录
echo 您可以在后续版本中集成这个扩展以获得更好的向量搜索性能
pause

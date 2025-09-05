#!/bin/bash

# SQLite和sqlite-vec安装脚本
echo "开始安装SQLite和sqlite-vec扩展..."

# 检查操作系统
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "检测到Linux系统"
    
    # 更新包管理器
    sudo apt update
    
    # 安装SQLite开发包
    sudo apt install -y sqlite3 libsqlite3-dev
    
    # 安装构建工具
    sudo apt install -y build-essential pkg-config
    
    # 安装Rust（如果未安装）
    if ! command -v cargo &> /dev/null; then
        echo "安装Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
    fi
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "检测到macOS系统"
    
    # 检查是否有Homebrew
    if ! command -v brew &> /dev/null; then
        echo "安装Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # 安装SQLite
    brew install sqlite
    
    # 安装Rust（如果未安装）
    if ! command -v cargo &> /dev/null; then
        echo "安装Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
    fi
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "检测到Windows系统"
    
    # 检查是否有Chocolatey
    if ! command -v choco &> /dev/null; then
        echo "请先安装Chocolatey: https://chocolatey.org/install"
        exit 1
    fi
    
    # 安装SQLite
    choco install sqlite
    
    # 安装Rust（如果未安装）
    if ! command -v cargo &> /dev/null; then
        echo "安装Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
    fi
    
else
    echo "不支持的操作系统: $OSTYPE"
    exit 1
fi

echo "SQLite和Rust安装完成！"

# 下载sqlite-vec扩展
echo "下载sqlite-vec扩展..."
mkdir -p sqlite-extensions
cd sqlite-extensions

# 根据系统架构下载对应的sqlite-vec扩展
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

if [[ "$OS" == "linux" ]]; then
    if [[ "$ARCH" == "x86_64" ]]; then
        wget -O sqlite-vec.wasm https://github.com/asg017/sqlite-vec/releases/latest/download/sqlite-vec-linux-x86_64.wasm
    elif [[ "$ARCH" == "aarch64" ]]; then
        wget -O sqlite-vec.wasm https://github.com/asg017/sqlite-vec/releases/latest/download/sqlite-vec-linux-aarch64.wasm
    fi
elif [[ "$OS" == "darwin" ]]; then
    if [[ "$ARCH" == "x86_64" ]]; then
        wget -O sqlite-vec.wasm https://github.com/asg017/sqlite-vec/releases/latest/download/sqlite-vec-macos-x86_64.wasm
    elif [[ "$ARCH" == "arm64" ]]; then
        wget -O sqlite-vec.wasm https://github.com/asg017/sqlite-vec/releases/latest/download/sqlite-vec-macos-aarch64.wasm
    fi
elif [[ "$OS" == "windows" ]]; then
    wget -O sqlite-vec.wasm https://github.com/asg017/sqlite-vec/releases/latest/download/sqlite-vec-windows-x86_64.wasm
fi

cd ..

echo "安装完成！"
echo ""
echo "下一步："
echo "1. 运行 'npm install' 安装前端依赖"
echo "2. 运行 'cd src-tauri && cargo build' 构建Rust后端"
echo "3. 运行 'npm run tauri dev' 启动应用"
echo ""
echo "注意：sqlite-vec扩展已下载到 sqlite-extensions/ 目录"
echo "您可以在后续版本中集成这个扩展以获得更好的向量搜索性能"

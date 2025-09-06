#!/bin/bash

echo "🔨 开始编译Qdrant..."
echo

# 检查Rust是否安装
if ! command -v cargo &> /dev/null; then
    echo "❌ 错误: 未找到Rust，请先安装Rust"
    echo "安装指南: https://rustup.rs/"
    exit 1
fi

echo "✅ Rust已安装"

# 检查Git是否安装
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 未找到Git，请先安装Git"
    echo "安装指南: https://git-scm.com/"
    exit 1
fi

echo "✅ Git已安装"

# 检查Clang是否安装
if ! command -v clang &> /dev/null; then
    echo "❌ 错误: 未找到Clang，请先安装LLVM"
    echo "Ubuntu/Debian: sudo apt install clang"
    echo "macOS: xcode-select --install"
    exit 1
fi

echo "✅ Clang已安装"

# 检查protoc是否安装
if ! command -v protoc &> /dev/null; then
    echo "❌ 错误: 未找到protoc，请先安装Protocol Buffers"
    echo "Ubuntu/Debian: sudo apt install protobuf-compiler"
    echo "macOS: brew install protobuf"
    exit 1
fi

echo "✅ protoc已安装"

echo
echo "📥 开始编译Qdrant..."
echo "这可能需要几分钟时间，请耐心等待..."
echo

# 创建qdrant源码目录
mkdir -p qdrant_src
cd qdrant_src

# 克隆Qdrant仓库（如果不存在）
if [ ! -d ".git" ]; then
    echo "📥 克隆Qdrant仓库..."
    git clone https://github.com/qdrant/qdrant.git .
    if [ $? -ne 0 ]; then
        echo "❌ 克隆仓库失败"
        exit 1
    fi
    echo "✅ 仓库克隆完成"
else
    echo "📥 更新Qdrant仓库..."
    git pull
    if [ $? -ne 0 ]; then
        echo "❌ 更新仓库失败"
        exit 1
    fi
    echo "✅ 仓库更新完成"
fi

echo
echo "🔨 开始编译Qdrant..."
echo "编译过程可能需要5-10分钟，请耐心等待..."
cargo build --release --bin qdrant
if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    echo
    echo "可能的解决方案:"
    echo "1. 检查网络连接"
    echo "2. 确保有足够的磁盘空间"
    echo "3. 检查Rust版本是否最新"
    echo "4. 重新安装依赖"
    exit 1
fi

echo "✅ Qdrant编译完成！"

# 复制二进制文件到项目根目录
if [ -f "target/release/qdrant" ]; then
    cp "target/release/qdrant" "../qdrant"
    chmod +x "../qdrant"
    echo "✅ 二进制文件已复制到项目根目录"
else
    echo "❌ 未找到编译后的二进制文件"
    exit 1
fi

cd ..
echo
echo "🎉 Qdrant编译和安装完成！"
echo "📍 二进制文件位置: $(pwd)/qdrant"
echo
echo "💡 现在可以启动应用，Qdrant会自动启动"
echo

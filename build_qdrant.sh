#!/bin/bash

echo "开始编译Qdrant从源代码..."
echo

# 检查Rust是否安装
if ! command -v cargo &> /dev/null; then
    echo "错误: 未找到Rust，请先安装Rust"
    echo "安装指南: https://rustup.rs/"
    exit 1
fi

echo "✅ Rust已安装"

# 创建qdrant目录
mkdir -p qdrant
cd qdrant

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

echo "🔨 开始编译Qdrant..."
cargo build --release --bin qdrant
if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
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

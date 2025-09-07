#!/bin/bash

echo "🚀 启动AI Chat应用..."
echo

# 检查Qdrant二进制文件是否存在
if [ ! -f "qdrant" ]; then
    echo "❌ 未找到Qdrant二进制文件"
    echo "💡 请先运行: ./compile_qdrant.sh 来编译Qdrant"
    exit 1
fi

echo "✅ 找到Qdrant二进制文件"

# 检查Qdrant是否已经在运行
if netstat -an 2>/dev/null | grep -q ":6333"; then
    echo "✅ Qdrant服务已在运行"
else
    echo "🚀 启动Qdrant服务..."
    ./qdrant &
    echo "⏳ 等待Qdrant服务启动..."
    sleep 3
fi

# 检查Qdrant服务是否启动成功
echo "🔍 检查Qdrant服务状态..."
if curl -s http://localhost:6333 >/dev/null 2>&1; then
    echo "✅ Qdrant服务运行正常"
else
    echo "⚠️ Qdrant服务可能还在启动中，继续启动应用..."
fi

echo
echo "🚀 启动Tauri应用..."
npm run tauri


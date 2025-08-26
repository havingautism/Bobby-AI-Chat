# 🔄 消息重试功能实现

## 🎯 功能概述

为 Bobby AI Chat 添加了智能重试功能，当消息发送失败时，用户可以点击重试按钮重新发送消息，无需重新输入。

## ✨ 核心功能

### 🔧 重试机制

- **自动保存重试数据**: 失败消息包含原始请求信息
- **一键重试**: 点击重试按钮即可重新发送
- **智能清理**: 重试时自动移除错误消息
- **状态管理**: 重试过程中正确显示加载状态

### 🎨 用户界面

- **重试按钮**: 错误消息下方显示醒目的重试按钮
- **视觉反馈**: 错误消息有特殊的红色边框和背景
- **图标设计**: 使用旋转箭头图标表示重试操作
- **响应式设计**: 在移动设备上也有良好的显示效果

## 🔧 技术实现

### 1. 错误消息数据结构

```javascript
const errorMessage = {
  id: (Date.now() + 1).toString(),
  role: "assistant",
  content: errorContent,
  timestamp: new Date().toISOString(),
  isError: true,
  retryData: {
    messages, // 原始消息历史
    options, // 发送选项（角色等）
    conversationId, // 对话ID
  },
};
```

### 2. 重试逻辑分离

```javascript
// 主发送函数
const handleSendMessage = async (content, options = {}) => {
  // 处理用户输入和消息创建
  await sendMessageWithRetry(updatedMessages, options, currentConversationId);
};

// 可重试的发送函数
const sendMessageWithRetry = async (messages, options, conversationId) => {
  // 实际的API调用和错误处理
};

// 重试处理函数
const handleRetryMessage = async (errorMessage) => {
  // 移除错误消息并重新发送
};
```

### 3. UI 组件更新

```javascript
// MessageList 组件新增重试按钮
{
  message.isError && message.retryData && onRetryMessage && (
    <div className="error-actions">
      <button className="retry-button" onClick={() => onRetryMessage(message)}>
        <svg>...</svg>
        重试
      </button>
    </div>
  );
}
```

## 🎨 样式设计

### 错误消息样式

```css
.message.error {
  background: rgba(239, 68, 68, 0.05);
  border-left: 4px solid var(--error-color);
}
```

### 重试按钮样式

```css
.retry-button {
  background: var(--error-color);
  color: #ffffff;
  border-radius: 8px;
  padding: 8px 16px;
  transition: all 0.2s ease;
}

.retry-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

## 🔄 工作流程

### 正常发送流程

1. 用户输入消息
2. 调用 `handleSendMessage`
3. 创建用户消息
4. 调用 `sendMessageWithRetry`
5. API 成功返回
6. 显示 AI 回复

### 错误重试流程

1. API 调用失败
2. 创建包含 `retryData` 的错误消息
3. 显示错误消息和重试按钮
4. 用户点击重试按钮
5. 调用 `handleRetryMessage`
6. 移除错误消息
7. 重新调用 `sendMessageWithRetry`
8. 显示新的加载状态

## 🛡️ 错误处理

### 错误类型识别

```javascript
if (error.message.includes("API密钥")) {
  errorContent += "请检查您的API配置。";
} else if (error.message.includes("网络")) {
  errorContent += "请检查您的网络连接。";
} else {
  errorContent += `错误信息：${error.message}`;
}
```

### 重试数据验证

```javascript
const handleRetryMessage = async (errorMessage) => {
  if (!errorMessage.retryData) return; // 安全检查

  const { messages, options, conversationId } = errorMessage.retryData;
  // 继续处理...
};
```

## 📱 响应式支持

### 移动端优化

- 重试按钮在小屏幕上适当缩小
- 触摸友好的按钮尺寸
- 简化的错误消息显示

### 主题支持

- 明亮模式和暗夜模式都有适配
- 错误颜色在不同主题下保持可读性
- 重试按钮在暗色模式下使用更深的红色

## 🎯 用户体验改进

### 便利性

- ✅ 无需重新输入消息
- ✅ 保持对话上下文
- ✅ 一键重试操作

### 可靠性

- ✅ 网络错误自动重试
- ✅ API 配置错误提示
- ✅ 状态管理准确

### 视觉反馈

- ✅ 清晰的错误标识
- ✅ 醒目的重试按钮
- ✅ 平滑的交互动画

现在用户在遇到发送失败时，可以轻松点击重试按钮重新发送消息，大大提升了使用体验！🎉

# 🐱 Bobby

一个默认为bobby猫的AI聊天应用，基于React构建，支持多种AI模型

## ✨ 功能特性

### 🎯 核心功能
- 📱 **完美响应式设计** - 无缝适配PC端和移动端，支持触摸操作
- 💾 **本地数据存储** - 聊天历史自动保存在浏览器本地存储，保护隐私
- 🔄 **多对话管理** - 支持创建、切换、删除多个对话会话
- ⚡ **实时打字动画** - 消息发送时显示优雅的打字指示器
- 📝 **完整Markdown支持** - AI回复支持代码高亮、表格、列表等格式
- 🔌 **多API兼容** - 支持硅基流动、OpenAI、DeepSeek等多种AI API服务

### 🆕 新增高级功能
- 🔍 **智能搜索** - 搜索历史对话内容，支持关键词高亮显示
- 🎛️ **侧边栏控制** - PC端支持展开/收起侧边栏，节省屏幕空间
- ⚙️ **可视化设置** - 图形化API配置界面，支持连接测试

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置API

首次使用时，应用会自动提示配置API：

1. 启动应用后，点击右上角的⚙️设置按钮
2. 选择合适的API服务商（硅基流动、OpenAI、DeepSeek或自定义）
3. 输入API密钥和相关参数
4. 点击"测试连接"验证配置
5. 保存设置开始使用

或者直接编辑 `src/utils/api.js` 文件：

```javascript
const DEFAULT_CONFIG = {
  baseURL: 'https://api.siliconflow.cn/v1/chat/completions',
  apiKey: 'YOUR_API_KEY_HERE',
  model: 'deepseek-ai/DeepSeek-V3',
  temperature: 0.7,
  maxTokens: 2000,
};
```

### 3. 启动应用

```bash
pnpm start
```

应用将在 http://localhost:3000 启动。

## 🔧 API配置说明

### 支持的API服务商

| 服务商 | 默认模型 | 说明 |
|--------|----------|------|
| 🔥 硅基流动 | deepseek-ai/DeepSeek-V3 | 国内访问友好，性价比高 |
| 🤖 OpenAI | gpt-3.5-turbo | 官方API，功能最全 |
| 🧠 DeepSeek | deepseek-chat | 国产大模型，中文优化 |
| 🛠️ 自定义 | 自定义 | 支持任何兼容OpenAI格式的API |

### 配置示例

#### 硅基流动 (推荐)
```javascript
{
  baseURL: 'https://api.siliconflow.cn/v1/chat/completions',
  apiKey: 'YOUR_SILICONFLOW_API_KEY',
  model: 'deepseek-ai/DeepSeek-V3',
  temperature: 0.7,
  maxTokens: 2000
}
```

#### OpenAI
```javascript
{
  baseURL: 'https://api.openai.com/v1/chat/completions',
  apiKey: 'YOUR_OPENAI_API_KEY',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 2000
}
```

#### DeepSeek
```javascript
{
  baseURL: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: 'YOUR_DEEPSEEK_API_KEY',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2000
}
```

## 项目结构

```
src/
├── components/          # React组件
│   ├── ChatInterface.js # 主聊天界面
│   ├── Sidebar.js       # 侧边栏
│   ├── MessageList.js   # 消息列表
│   └── MessageInput.js  # 消息输入框
├── utils/              # 工具函数
│   ├── api.js          # API调用
│   └── storage.js      # 本地存储
├── App.js              # 主应用组件
└── index.js            # 应用入口
```

## 📱 使用指南

### 基本操作
- **新建对话**: 点击"新建聊天"按钮创建新会话
- **发送消息**: 输入内容后按Enter或点击发送按钮
- **切换对话**: 点击侧边栏中的对话项
- **删除对话**: 悬停对话项，点击删除按钮

### 高级功能

#### 🔍 智能搜索
- 在搜索框输入关键词查找历史对话
- 支持搜索对话标题和消息内容
- 匹配的关键词会高亮显示
- 显示搜索结果数量统计

#### 📂 侧边栏管理
- **展开状态**: 显示完整对话列表和搜索功能
- **收起状态**: 只显示图标，节省屏幕空间（仅PC端）
- **智能分组**: 按"今天"和"之前"自动分组
- **响应式**: 移动端自动适配

#### ⚙️ 设置面板
- **API配置**: 可视化配置界面，支持多种服务商
- **连接测试**: 一键测试API连接状态
- **参数调节**: 调整温度、最大令牌数等参数
- **预设配置**: 快速选择常用API服务商

### 移动端适配
- 在移动设备上，侧边栏会自动隐藏
- 点击左上角的☰按钮可打开/关闭侧边栏
- 触摸友好的界面设计
- 完美适配各种屏幕尺寸

### 数据存储
- 所有聊天记录自动保存在浏览器的localStorage中
- API配置和用户设置同样本地保存
- 刷新页面或重新打开应用时会自动加载历史记录
- 数据完全存储在本地，保护隐私安全

## 自定义配置

### 修改主题颜色
编辑对应的CSS文件中的颜色变量：
- 主色调：`#10a37f`
- 背景色：`#343541`
- 侧边栏：`#202123`

### 添加新功能
项目采用模块化设计，可以轻松添加新功能：
- 在 `components/` 目录下添加新组件
- 在 `utils/` 目录下添加工具函数
- 修改 `App.js` 集成新功能

## 注意事项

1. **API密钥安全**：请不要将API密钥提交到公共代码仓库
2. **CORS问题**：某些API可能需要配置CORS或使用代理
3. **浏览器兼容性**：建议使用现代浏览器（Chrome、Firefox、Safari、Edge）
4. **存储限制**：localStorage有存储大小限制，大量对话可能需要清理

## 构建部署

```bash
# 构建生产版本
pnpm run build

# 构建完成后，dist目录包含可部署的静态文件
```

## 许可证

MIT License

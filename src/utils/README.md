# 数据库使用说明

## 概述

Bobby AI Chat 应用支持两种数据库后端：

- **Web端**: 使用 IndexedDB
- **Tauri端**: 使用 SQLite

## 数据库架构

### 表结构

#### roles 表 (角色数据)
- `id`: 角色唯一标识符 (主键)
- `name`: 角色名称
- `icon`: 图标 (emoji)
- `avatar`: 头像 (emoji)
- `description`: 角色描述
- `temperature`: 温度参数 (0.0-2.0)
- `systemPrompt`: 系统提示词
- `color`: 角色颜色 (hex)
- `created_at`: 创建时间
- `updated_at`: 更新时间

#### model_settings 表 (模型设置)
- `id`: 模型唯一标识符 (主键)
- `name`: 模型名称
- `provider`: 提供者 (siliconflow, openai等)
- `enabled`: 是否启用
- `created_at`: 创建时间
- `updated_at`: 更新时间

#### conversations 表 (对话数据)
- `id`: 对话唯一标识符 (主键)
- `title`: 对话标题
- `role_id`: 关联的角色ID (外键)
- `response_mode`: 响应模式 (stream/batch)
- `messages`: 消息列表 (JSON)
- `settings`: 对话设置 (JSON)
- `created_at`: 创建时间
- `updated_at`: 更新时间

#### settings 表 (应用设置)
- `key`: 设置键 (主键)
- `value`: 设置值 (JSON)
- `updated_at`: 更新时间

## 使用方法

### 1. 初始化数据库

```javascript
import { dbManager, initDatabase } from './utils/database';

// 在应用启动时初始化
await initDatabase();
```

### 2. 角色操作

```javascript
import { saveRole, getRole, getAllRoles, deleteRole } from './utils/database';

// 保存角色
await saveRole({
  id: 'custom-role',
  name: '自定义角色',
  icon: '🤖',
  avatar: '🤖',
  description: '自定义的角色',
  temperature: 0.7,
  systemPrompt: '你是一个自定义的AI助手',
  color: '#6366f1'
});

// 获取单个角色
const role = await getRole('custom-role');

// 获取所有角色
const allRoles = await getAllRoles();

// 删除角色
await deleteRole('custom-role');
```

### 3. 模型设置操作

```javascript
import { saveModelSettings, getModelSettings } from './utils/database';

// 保存模型设置
await saveModelSettings({
  id: 'gpt-4',
  name: 'GPT-4',
  provider: 'openai',
  enabled: true
});

// 获取所有模型设置
const models = await getModelSettings();
```

### 4. 应用设置操作

```javascript
import { saveSetting, getSetting } from './utils/database';

// 保存设置
await saveSetting('theme', 'dark');
await saveSetting('language', 'zh');

// 获取设置
const theme = await getSetting('theme');
const language = await getSetting('language');
```

## 自动降级机制

如果 IndexedDB 或 SQLite 不可用，系统会自动降级到 localStorage：

1. **优先级**: SQLite > IndexedDB > localStorage
2. **检测机制**: 自动检测运行环境和数据库可用性
3. **无缝切换**: 用户无需关心底层实现

## Tauri 端配置

### 1. 使用专门的 SQLite + sqlite-vec 系统

Tauri 端使用专门的 Rust 后端数据库系统，支持：
- SQLite 数据库存储
- sqlite-vec 向量搜索
- 自动数据目录管理
- 数据库健康检查

### 2. 数据库位置

- **主数据库**: `src-tauri/data/bobby_chat.db`
- **知识库数据库**: `src-tauri/data/knowledge_base.db`
- **数据目录**: 自动检测用户数据目录

## 数据备份和恢复

### Web端 (IndexedDB)

```javascript
// 导出数据
const data = {
  roles: await getAllRoles(),
  modelSettings: await getModelSettings(),
  conversations: await dbManager.getAll('conversations'),
  settings: await dbManager.getAll('settings')
};

// 下载备份
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `bobby-backup-${new Date().toISOString().split('T')[0]}.json`;
a.click();
```

### Tauri端 (SQLite + sqlite-vec)

```javascript
// 通过 Tauri 命令获取数据库统计信息
const stats = await invoke('get_database_stats');
console.log('数据库统计:', stats);

// 重置数据库
await invoke('reset_all_databases');
```

## 性能优化

### 1. 批量操作

```javascript
// 批量插入角色
const roles = [role1, role2, role3];
await dbManager.batchInsert('roles', roles);
```

### 2. 事务处理

```javascript
await dbManager.transaction([
  async () => await saveRole(role1),
  async () => await saveRole(role2),
  async () => await saveModelSettings(model1)
]);
```

### 3. 索引优化

数据库会自动创建以下索引：
- `roles.created_at`
- `conversations.created_at`
- `conversations.role_id`

## 错误处理

```javascript
try {
  await saveRole(roleData);
} catch (error) {
  console.error('保存角色失败:', error);
  // 自动降级到 localStorage 已在内部处理
}
```

## 调试和监控

### 启用调试模式

```javascript
// 在控制台查看数据库操作详情
localStorage.setItem('debug-db', 'true');
```

### 查看数据库统计

```javascript
if (window.__TAURI__) {
  const stats = await invoke('get_database_stats');
  console.log('数据库统计信息:', stats);
}
```

## 注意事项

1. **数据一致性**: 系统会自动处理字段名标准化（如 created_at → createdAt）
2. **版本兼容**: 数据库架构版本控制在 DatabaseManager 类中处理
3. **隐私安全**: 敏感数据应避免存储在客户端数据库中
4. **存储限制**: IndexedDB 有存储空间限制（通常为 50MB）
5. **并发访问**: 所有数据库操作都是异步的，注意处理并发问题

## 常见问题

### Q: 如何清除数据库数据？

```javascript
// 清除特定表
await dbManager.truncate('roles');

// 重置所有数据
if (confirm('确定要清除所有数据吗？')) {
  await dbManager.close();
  indexedDB.deleteDatabase('BobbyAIChatDB');
  location.reload();
}
```

### Q: 如何迁移数据？

```javascript
// 从 localStorage 迁移到 IndexedDB
const migrateFromLocalStorage = async () => {
  const oldRoles = JSON.parse(localStorage.getItem('custom-roles') || '[]');
  for (const role of oldRoles) {
    await saveRole(role);
  }
  localStorage.removeItem('custom-roles');
};
```
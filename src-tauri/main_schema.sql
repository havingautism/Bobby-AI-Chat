-- 主数据库Schema (bobby_chat.db)

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    avatar TEXT,
    description TEXT,
    temperature REAL DEFAULT 0.7,
    system_prompt TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);

-- 模型分组表
CREATE TABLE IF NOT EXISTS model_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);

-- 模型表
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    model_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    api_params TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (group_id) REFERENCES model_groups (id) ON DELETE CASCADE
);

-- 对话表
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    role_id TEXT,
    response_mode TEXT DEFAULT 'stream',
    messages TEXT,
    settings TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    pinned_at TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE SET NULL
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT,
    metadata TEXT,
    knowledge_references TEXT, -- JSON格式的知识库引用信息
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order);
CREATE INDEX IF NOT EXISTS idx_model_groups_sort_order ON model_groups(sort_order);
CREATE INDEX IF NOT EXISTS idx_models_group_id ON models(group_id);
CREATE INDEX IF NOT EXISTS idx_models_sort_order ON models(sort_order);
CREATE INDEX IF NOT EXISTS idx_models_enabled ON models(enabled);
CREATE INDEX IF NOT EXISTS idx_conversations_role_id ON conversations(role_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_is_favorite ON conversations(is_favorite);
CREATE INDEX IF NOT EXISTS idx_conversations_pinned_at ON conversations(pinned_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);

-- 消息标签表（用于基于标签检索会话与消息）
CREATE TABLE IF NOT EXISTS message_tags (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);

-- 标签检索索引
CREATE INDEX IF NOT EXISTS idx_message_tags_tag ON message_tags(tag);
CREATE INDEX IF NOT EXISTS idx_message_tags_conversation ON message_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_tags_message ON message_tags(message_id);

-- 触发器：更新更新时间
CREATE TRIGGER IF NOT EXISTS update_roles_timestamp
AFTER UPDATE ON roles
FOR EACH ROW
BEGIN
    UPDATE roles SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_model_groups_timestamp
AFTER UPDATE ON model_groups
FOR EACH ROW
BEGIN
    UPDATE model_groups SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_models_timestamp
AFTER UPDATE ON models
FOR EACH ROW
BEGIN
    UPDATE models SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
AFTER UPDATE ON conversations
FOR EACH ROW
BEGIN
    UPDATE conversations SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- 插入默认设置
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('theme', 'light', datetime('now')),
('language', 'zh-CN', datetime('now')),
('auto_save', 'true', datetime('now')),
('max_history', '100', datetime('now')),
('default_model', 'gpt-3.5-turbo', datetime('now')),
('api_key', '', datetime('now')),
('enable_voice', 'false', datetime('now')),
('voice_speed', '1.0', datetime('now')),
('voice_pitch', '1.0', datetime('now')),
('notification_enabled', 'true', datetime('now')),
('cache_enabled', 'true', datetime('now')),
('debug_mode', 'false', datetime('now'));
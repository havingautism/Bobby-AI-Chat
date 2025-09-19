# SQLite数据库表结构设计 (使用sqlite-vec插件)

## 数据库设计

### 1. 主数据库 (bobby_chat.db)
保留现有的用户数据表结构不变：
- roles (角色表)
- model_groups (模型分组表)
- models (模型表)
- conversations (对话表)
- settings (设置表)

### 2. 知识库数据库 (knowledge_base.db)
重新设计知识库相关表结构：

```sql
-- 知识库集合表
CREATE TABLE IF NOT EXISTS knowledge_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    embedding_model TEXT NOT NULL DEFAULT 'bge-m3',
    vector_dimensions INTEGER NOT NULL DEFAULT 384,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 文档表
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    metadata TEXT,
    chunk_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES knowledge_collections (id) ON DELETE CASCADE
);

-- 文档分块表
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES knowledge_documents (id) ON DELETE CASCADE
);

-- 向量表 (使用sqlite-vec)
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
    embedding float[384],  -- 默认384维，可根据模型调整
    chunk_id TEXT,
    collection_id TEXT,
    created_at INTEGER
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_collection_id ON knowledge_documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_chunk_index ON knowledge_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_chunk_id ON knowledge_vectors(chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_collection_id ON knowledge_vectors(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_created_at ON knowledge_vectors(created_at);

-- 触发器：确保向量与分块的一致性
CREATE TRIGGER IF NOT EXISTS delete_chunk_vectors
AFTER DELETE ON knowledge_chunks
FOR EACH ROW
BEGIN
    DELETE FROM knowledge_vectors WHERE chunk_id = OLD.id;
END;

-- 触发器：更新文档的分块计数
CREATE TRIGGER IF NOT EXISTS update_document_chunk_count
AFTER INSERT OR DELETE OR UPDATE ON knowledge_chunks
FOR EACH ROW
BEGIN
    UPDATE knowledge_documents
    SET chunk_count = (SELECT COUNT(*) FROM knowledge_chunks WHERE document_id = NEW.document_id),
        updated_at = strftime('%s', 'now')
    WHERE id = NEW.document_id;
END;
```

### 3. 多语言支持表结构

```sql
-- 语言检测表
CREATE TABLE IF NOT EXISTS language_detection (
    id TEXT PRIMARY KEY,
    text_hash TEXT NOT NULL UNIQUE,
    detected_language TEXT NOT NULL,
    confidence REAL,
    created_at INTEGER NOT NULL
);

-- 嵌入模型配置表
CREATE TABLE IF NOT EXISTS embedding_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model_id TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    language TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    max_tokens INTEGER DEFAULT 512,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 插入默认嵌入模型配置
INSERT OR IGNORE INTO embedding_models (id, name, model_id, dimensions, language, max_tokens, created_at, updated_at) VALUES
('bge-m3', 'BGE-M3', 'bge-m3', 384, 'universal', 512, strftime('%s', 'now'), strftime('%s', 'now')),
('bge-large-zh', 'BGE-Large-ZH', 'BAAI/bge-large-zh-v1.5', 1024, 'zh', 512, strftime('%s', 'now'), strftime('%s', 'now')),
('bge-large-en', 'BGE-Large-EN', 'BAAI/bge-large-en-v1.5', 1024, 'en', 512, strftime('%s', 'now'), strftime('%s', 'now'));
```

### 4. 搜索优化表结构

```sql
-- 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    query_embedding BLOB,
    collection_id TEXT,
    results_count INTEGER DEFAULT 0,
    execution_time INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- 缓存表
CREATE TABLE IF NOT EXISTS query_cache (
    id TEXT PRIMARY KEY,
    query_hash TEXT NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    collection_id TEXT,
    results TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_search_history_collection_id ON search_history(collection_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_query_cache_collection_id ON query_cache(collection_id);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires_at ON query_cache(expires_at);
```

### 5. 系统配置表

```sql
-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at INTEGER NOT NULL
);

-- 插入默认配置
INSERT OR IGNORE INTO system_config (key, value, description, updated_at) VALUES
('default_collection', 'default', '默认知识库集合', strftime('%s', 'now')),
('chunk_size', '500', '默认分块大小', strftime('%s', 'now')),
('chunk_overlap', '50', '默认分块重叠大小', strftime('%s', 'now')),
('search_limit', '10', '默认搜索结果数量', strftime('%s', 'now')),
('similarity_threshold', '0.7', '相似度阈值', strftime('%s', 'now')),
('cache_ttl', '3600', '缓存过期时间(秒)', strftime('%s', 'now'));
```

## 数据迁移脚本

### 1. 从Qdrant迁移到SQLite

```sql
-- 1. 创建新的表结构
-- (上面的所有CREATE TABLE语句)

-- 2. 迁移数据
-- 从现有的knowledge_documents表迁移到新结构
INSERT INTO knowledge_collections (id, name, description, embedding_model, vector_dimensions, created_at, updated_at)
SELECT 'default', 'Default Collection', 'Migrated from Qdrant', 'bge-m3', 384, strftime('%s', 'now'), strftime('%s', 'now')
WHERE NOT EXISTS (SELECT 1 FROM knowledge_collections WHERE id = 'default');

-- 3. 创建文档分块（需要应用程序逻辑处理）
-- 这个步骤需要在应用程序中实现，因为需要重新分块文档

-- 4. 清理旧表（可选）
-- DROP TABLE IF EXISTS knowledge_vectors_old;
-- DROP TABLE IF EXISTS knowledge_documents_old;
```

## 性能优化建议

### 1. 索引优化
- 为所有外键创建索引
- 为常用查询字段创建复合索引
- 为向量表的chunk_id和collection_id创建索引

### 2. 查询优化
- 使用sqlite-vec的向量搜索功能
- 实现查询缓存机制
- 使用预编译语句减少SQL解析开销

### 3. 存储优化
- 对大文本字段使用适当的压缩
- 定期清理过期数据
- 实现数据分片策略

### 4. 并发控制
- 使用WAL模式提高并发性能
- 实现适当的锁机制
- 使用连接池管理数据库连接

## 向量操作示例

### 1. 插入向量
```sql
-- 插入单个向量
INSERT INTO knowledge_vectors (rowid, embedding, chunk_id, collection_id, created_at)
VALUES ((SELECT max(rowid) + 1 FROM knowledge_vectors), ?, ?, ?, ?);

-- 批量插入向量
INSERT INTO knowledge_vectors (embedding, chunk_id, collection_id, created_at)
VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?);
```

### 2. 向量搜索
```sql
-- 使用sqlite-vec进行相似度搜索
SELECT
    k.chunk_id,
    k.chunk_text,
    k.document_id,
    d.title,
    d.file_name,
    vec_distance_L2(k.embedding, ?) as distance
FROM knowledge_vectors kv
JOIN knowledge_chunks k ON kv.chunk_id = k.id
JOIN knowledge_documents d ON k.document_id = d.id
WHERE kv.collection_id = ?
ORDER BY distance
LIMIT ?;
```

### 3. 删除向量
```sql
-- 删除指定集合的所有向量
DELETE FROM knowledge_vectors WHERE collection_id = ?;

-- 删除指定文档的所有向量
DELETE FROM knowledge_vectors
WHERE chunk_id IN (
    SELECT id FROM knowledge_chunks WHERE document_id = ?
);
```

这个设计提供了完整的SQLite + sqlite-vec的解决方案，支持：
- 多集合管理
- 多语言嵌入模型
- 高效的向量搜索
- 数据完整性保证
- 性能优化
- 缓存机制
- 搜索历史记录
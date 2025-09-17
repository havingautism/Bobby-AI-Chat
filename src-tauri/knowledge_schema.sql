-- 知识库数据库Schema (knowledge_base.db)

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
    embedding float[384],
    chunk_id TEXT,
    collection_id TEXT,
    created_at INTEGER
);

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

-- 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
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

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_collection_id ON knowledge_documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_updated_at ON knowledge_documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_chunk_index ON knowledge_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_chunk_id ON knowledge_vectors(chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_collection_id ON knowledge_vectors(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_created_at ON knowledge_vectors(created_at);
CREATE INDEX IF NOT EXISTS idx_language_detection_text_hash ON language_detection(text_hash);
CREATE INDEX IF NOT EXISTS idx_language_detection_created_at ON language_detection(created_at);
CREATE INDEX IF NOT EXISTS idx_embedding_models_language ON embedding_models(language);
CREATE INDEX IF NOT EXISTS idx_embedding_models_enabled ON embedding_models(enabled);
CREATE INDEX IF NOT EXISTS idx_search_history_collection_id ON search_history(collection_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_query_cache_collection_id ON query_cache(collection_id);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires_at ON query_cache(expires_at);

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

-- 触发器：更新集合的更新时间
CREATE TRIGGER IF NOT EXISTS update_collection_timestamp
AFTER INSERT OR DELETE OR UPDATE ON knowledge_documents
FOR EACH ROW
BEGIN
    UPDATE knowledge_collections
    SET updated_at = strftime('%s', 'now')
    WHERE id = (SELECT collection_id FROM knowledge_documents WHERE id = NEW.id OR id = OLD.id);
END;

-- 触发器：清理过期的缓存
CREATE TRIGGER IF NOT EXISTS clean_expired_cache
AFTER INSERT ON query_cache
FOR EACH ROW
BEGIN
    DELETE FROM query_cache WHERE expires_at < strftime('%s', 'now');
END;

-- 插入默认嵌入模型配置
INSERT OR IGNORE INTO embedding_models (id, name, model_id, dimensions, language, max_tokens, created_at, updated_at) VALUES
('bge-m3', 'BGE-M3', 'bge-m3', 384, 'universal', 512, strftime('%s', 'now'), strftime('%s', 'now')),
('bge-large-zh', 'BGE-Large-ZH', 'BAAI/bge-large-zh-v1.5', 1024, 'zh', 512, strftime('%s', 'now'), strftime('%s', 'now')),
('bge-large-en', 'BGE-Large-EN', 'BAAI/bge-large-en-v1.5', 1024, 'en', 512, strftime('%s', 'now'), strftime('%s', 'now'));

-- 插入默认系统配置
INSERT OR IGNORE INTO system_config (key, value, description, updated_at) VALUES
('default_collection', 'default', '默认知识库集合', strftime('%s', 'now')),
('chunk_size', '500', '默认分块大小', strftime('%s', 'now')),
('chunk_overlap', '50', '默认分块重叠大小', strftime('%s', 'now')),
('search_limit', '10', '默认搜索结果数量', strftime('%s', 'now')),
('similarity_threshold', '0.7', '相似度阈值', strftime('%s', 'now')),
('cache_ttl', '3600', '缓存过期时间(秒)', strftime('%s', 'now')),
('max_document_size', '10485760', '最大文档大小(10MB)', strftime('%s', 'now')),
('max_chunks_per_document', '1000', '每个文档最大分块数', strftime('%s', 'now')),
('enable_auto_language_detection', 'true', '启用自动语言检测', strftime('%s', 'now')),
('enable_search_history', 'true', '启用搜索历史', strftime('%s', 'now')),
('enable_query_cache', 'true', '启用查询缓存', strftime('%s', 'now')),
('vector_index_type', 'ivf', '向量索引类型', strftime('%s', 'now')),
('batch_insert_size', '100', '批量插入大小', strftime('%s', 'now'));

-- 创建默认集合
INSERT OR IGNORE INTO knowledge_collections (id, name, description, embedding_model, vector_dimensions, created_at, updated_at) VALUES
('default', 'Default Collection', 'Default knowledge collection for general use', 'bge-m3', 384, strftime('%s', 'now'), strftime('%s', 'now'));
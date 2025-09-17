use std::sync::Arc;
use std::str::FromStr;
use sqlx::{Pool, Sqlite, sqlite::SqlitePoolOptions, Row};
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use tracing::{info, error, warn};
use once_cell::sync::Lazy;
use lru::LruCache;
use sqlite_vec::sqlite3_vec_init;
use rusqlite::ffi::sqlite3_auto_extension;
use zerocopy::AsBytes;

use crate::types::*;

// Initialize sqlite-vec extension globally
static SQLITE_VEC_INIT: once_cell::sync::Lazy<()> = once_cell::sync::Lazy::new(|| {
    unsafe {
        sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())));
    }
});

// 数据库连接池
pub static DB_POOL: Lazy<Arc<DatabaseManager>> = Lazy::new(|| {
    // This will be initialized elsewhere
    panic!("DatabaseManager must be initialized manually")
});

// 数据库管理器
pub struct DatabaseManager {
    main_pool: Pool<Sqlite>,
    knowledge_pool: Pool<Sqlite>,
    query_cache: Arc<std::sync::Mutex<LruCache<String, Vec<SearchResult>>>>,
}

impl DatabaseManager {
    pub async fn new() -> Result<Self> {
        // Initialize sqlite-vec extension
        let _ = &*SQLITE_VEC_INIT;
        info!("sqlite-vec extension initialized");
        // Try multiple approaches to get app data directory
        let app_dir = std::env::current_dir()
            .ok()
            .and_then(|path| {
                let data_dir = path.join("data");
                if let Err(_) = std::fs::create_dir_all(&data_dir) {
                    None
                } else {
                    Some(data_dir)
                }
            })
            .or_else(|| {
                // Fallback to APPDATA environment variable
                std::env::var("APPDATA")
                    .ok()
                    .and_then(|app_data| {
                        let data_dir = std::path::PathBuf::from(app_data).join("bobby-chat");
                        if let Err(_) = std::fs::create_dir_all(&data_dir) {
                            None
                        } else {
                            Some(data_dir)
                        }
                    })
            })
            .or_else(|| {
                // Fallback to dirs crate
                dirs::data_dir()
                    .map(|path| path.join("bobby-chat"))
            })
            .ok_or_else(|| anyhow!("Failed to determine app data directory"))?;

        // Create directory with better error handling
        if let Err(e) = std::fs::create_dir_all(&app_dir) {
            return Err(anyhow!("Failed to create app directory {:?}: {}", app_dir, e));
        }

        let main_db_path = app_dir.join("bobby_chat.db");
        let knowledge_db_path = app_dir.join("knowledge_base.db");

        info!("Initializing databases:");
        info!("  App directory: {:?}", app_dir);
        info!("  Main DB: {:?}", main_db_path);
        info!("  Knowledge DB: {:?}", knowledge_db_path);

        // Verify directory exists
        if !app_dir.exists() {
            return Err(anyhow!("App directory does not exist after creation: {:?}", app_dir));
        }

        // 创建主数据库连接池
        let main_db_url = main_db_path.to_string_lossy().to_string();
        info!("Connecting to main database: {}", main_db_url);
        let main_pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::from_str(&main_db_url)?
                    .create_if_missing(true)
            )
            .await
            .map_err(|e| anyhow!("Failed to connect to main database: {}", e))?;

        // 创建知识库数据库连接池
        let knowledge_db_url = knowledge_db_path.to_string_lossy().to_string();
        info!("Connecting to knowledge database: {}", knowledge_db_url);
        let knowledge_pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::from_str(&knowledge_db_url)?
                    .create_if_missing(true)
            )
            .await
            .map_err(|e| anyhow!("Failed to connect to knowledge database: {}", e))?;

        // 启用WAL模式
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&main_pool)
            .await?;

        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&knowledge_pool)
            .await?;

        // 设置其他SQLite优化参数
        let optimize_queries = vec![
            "PRAGMA synchronous=NORMAL",
            "PRAGMA cache_size=10000",
            "PRAGMA temp_store=memory",
            "PRAGMA mmap_size=268435456", // 256MB
            "PRAGMA foreign_keys=ON",
            "PRAGMA busy_timeout=5000",
        ];

        for query in optimize_queries {
            sqlx::query(query).execute(&main_pool).await?;
            sqlx::query(query).execute(&knowledge_pool).await?;
        }

        // 初始化数据库结构
        if let Err(e) = Self::initialize_databases(&main_pool, &knowledge_pool).await {
            error!("Failed to initialize database schema: {}", e);
            return Err(anyhow!("Failed to initialize database schema: {}", e));
        }

        // 验证 sqlite-vec 扩展是否正常工作
        match sqlx::query("SELECT vec_version()")
            .fetch_one(&knowledge_pool)
            .await
        {
            Ok(row) => {
                let version: String = row.get(0);
                info!("sqlite-vec extension version: {}", version);
            }
            Err(e) => {
                warn!("Failed to get sqlite-vec version: {}", e);
                return Err(anyhow!("sqlite-vec extension not properly initialized: {}", e));
            }
        }

        Ok(Self {
            main_pool,
            knowledge_pool,
            query_cache: Arc::new(std::sync::Mutex::new(LruCache::new(std::num::NonZeroUsize::new(1000).unwrap()))),
        })
    }

    async fn initialize_databases(main_pool: &Pool<Sqlite>, knowledge_pool: &Pool<Sqlite>) -> Result<()> {
        info!("Initializing database schema...");

        // 初始化主数据库 - 使用简单的SQL语句
        let main_queries = vec![
            "CREATE TABLE IF NOT EXISTS roles (
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
            )",
            "CREATE TABLE IF NOT EXISTS model_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )",
            "CREATE TABLE IF NOT EXISTS embedding_models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model_id TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                language TEXT DEFAULT 'default',
                enabled INTEGER DEFAULT 1,
                max_tokens INTEGER DEFAULT 8192,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )"
        ];

        for query in main_queries {
            if let Err(e) = sqlx::query(query).execute(main_pool).await {
                error!("Failed to execute main query: {}", e);
                error!("Query: {}", query);
                return Err(anyhow!("Failed to initialize main database: {}", e));
            }
        }

        // 插入默认的嵌入模型数据
        let default_models = vec![
            ("bge-m3", "BAAI/bge-m3", "BAAI/bge-m3", 1024, "default", 8192),
            ("bge-large-zh", "BAAI/bge-large-zh-v1.5", "BAAI/bge-large-zh-v1.5", 1024, "zh", 8192),
            ("bge-large-en", "BAAI/bge-large-en-v1.5", "BAAI/bge-large-en-v1.5", 1024, "en", 8192),
        ];

        let now = chrono::Utc::now().timestamp();
        for (id, name, model_id, dimensions, language, max_tokens) in default_models {
            let insert_query = sqlx::query(
                "INSERT OR IGNORE INTO embedding_models (id, name, model_id, dimensions, language, enabled, max_tokens, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)"
            )
            .bind(id)
            .bind(name)
            .bind(model_id)
            .bind(dimensions)
            .bind(language)
            .bind(max_tokens)
            .bind(now)
            .bind(now);

            if let Err(e) = insert_query.execute(main_pool).await {
                error!("Failed to insert embedding model {}: {}", id, e);
            }
        }

        // 初始化知识库数据库 - 使用简单的SQL语句
        let knowledge_queries = vec![
            "CREATE TABLE IF NOT EXISTS knowledge_collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                embedding_model TEXT NOT NULL DEFAULT 'bge-m3',
                vector_dimensions INTEGER NOT NULL DEFAULT 1024,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS knowledge_documents (
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
                updated_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                chunk_text TEXT NOT NULL,
                token_count INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )",
            "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
                embedding float[1024],
                chunk_id TEXT,
                collection_id TEXT,
                created_at INTEGER
            )",
            "CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS language_detection (
                id TEXT PRIMARY KEY,
                text_hash TEXT NOT NULL UNIQUE,
                detected_language TEXT NOT NULL,
                confidence REAL,
                created_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS embedding_models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model_id TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                language TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                max_tokens INTEGER DEFAULT 512,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS search_history (
                id TEXT PRIMARY KEY,
                query_text TEXT NOT NULL,
                collection_id TEXT,
                results_count INTEGER DEFAULT 0,
                execution_time INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS query_cache (
                id TEXT PRIMARY KEY,
                query_hash TEXT NOT NULL UNIQUE,
                query_text TEXT NOT NULL,
                collection_id TEXT,
                results TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )"
        ];

        for query in knowledge_queries {
            if let Err(e) = sqlx::query(query).execute(knowledge_pool).await {
                error!("Failed to execute knowledge query: {}", e);
                error!("Query: {}", query);
                return Err(anyhow!("Failed to initialize knowledge database: {}", e));
            }
        }

        info!("Database schema initialized successfully");

        // 插入默认系统配置数据
        let default_configs = vec![
            ("default_collection", "default", "默认知识库集合"),
            ("chunk_size", "500", "默认分块大小"),
            ("chunk_overlap", "50", "默认分块重叠大小"),
            ("search_limit", "10", "默认搜索结果数量"),
            ("similarity_threshold", "0.7", "相似度阈值"),
            ("cache_ttl", "3600", "缓存过期时间(秒)"),
            ("max_document_size", "10485760", "最大文档大小(10MB)"),
            ("max_chunks_per_document", "1000", "每个文档最大分块数"),
            ("enable_auto_language_detection", "true", "启用自动语言检测"),
            ("enable_search_history", "true", "启用搜索历史"),
            ("enable_query_cache", "true", "启用查询缓存"),
            ("vector_index_type", "ivf", "向量索引类型"),
            ("batch_insert_size", "100", "批量插入大小"),
        ];

        for (key, value, description) in default_configs {
            let result = sqlx::query(
                "INSERT OR IGNORE INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, strftime('%s', 'now'))"
            )
            .bind(key)
            .bind(value)
            .bind(description)
            .execute(knowledge_pool)
            .await;

            if let Err(e) = result {
                warn!("Failed to insert default config {}: {}", key, e);
            }
        }

        // 插入默认嵌入模型配置
        let default_models = vec![
            ("bge-m3", "BGE-M3", "bge-m3", 384, "universal", 512),
            ("bge-large-zh", "BGE-Large-ZH", "BAAI/bge-large-zh-v1.5", 1024, "zh", 512),
            ("bge-large-en", "BGE-Large-EN", "BAAI/bge-large-en-v1.5", 1024, "en", 512),
        ];

        for (id, name, model_id, dimensions, language, max_tokens) in default_models {
            let result = sqlx::query(
                "INSERT OR IGNORE INTO embedding_models (id, name, model_id, dimensions, language, max_tokens, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))"
            )
            .bind(id)
            .bind(name)
            .bind(model_id)
            .bind(dimensions)
            .bind(language)
            .bind(max_tokens)
            .execute(knowledge_pool)
            .await;

            if let Err(e) = result {
                warn!("Failed to insert default model {}: {}", id, e);
            }
        }

        // 迁移：更新现有集合的vector_dimensions从384到1024
        Self::migrate_collection_dimensions(knowledge_pool).await?;

        Ok(())
    }

    async fn migrate_collection_dimensions(knowledge_pool: &Pool<Sqlite>) -> Result<()> {
        // 检查是否有vector_dimensions为384的集合
        let count = sqlx::query(
            "SELECT COUNT(*) as count FROM knowledge_collections WHERE vector_dimensions = 384"
        )
        .fetch_one(knowledge_pool)
        .await?;

        let old_dimension_count: i64 = count.get("count");

        if old_dimension_count > 0 {
            info!("Found {} collections with 384 dimensions, migrating to 1024...", old_dimension_count);

            // 更新所有384维的集合到1024维
            sqlx::query(
                "UPDATE knowledge_collections SET vector_dimensions = 1024 WHERE vector_dimensions = 384"
            )
            .execute(knowledge_pool)
            .await?;

            info!("Successfully migrated {} collections to 1024 dimensions", old_dimension_count);
        }

        Ok(())
    }

  
    // 获取主数据库连接池
    pub fn main_pool(&self) -> &Pool<Sqlite> {
        &self.main_pool
    }

    // 获取知识库数据库连接池
    pub fn knowledge_pool(&self) -> &Pool<Sqlite> {
        &self.knowledge_pool
    }

    // 清理查询缓存
    pub fn clear_cache(&self) {
        let mut cache = self.query_cache.lock().unwrap();
        cache.clear();
    }

    // 获取缓存统计
    pub fn cache_stats(&self) -> (usize, usize) {
        let cache = self.query_cache.lock().unwrap();
        (cache.len(), cache.cap().get())
    }
}

// 知识库操作
impl DatabaseManager {
    // 创建知识库集合
    pub async fn create_collection(&self, collection: &KnowledgeCollection) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO knowledge_collections (id, name, description, embedding_model, vector_dimensions, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&collection.id)
        .bind(&collection.name)
        .bind(&collection.description)
        .bind(&collection.embedding_model)
        .bind(collection.vector_dimensions)
        .bind(collection.created_at.timestamp())
        .bind(collection.updated_at.timestamp())
        .execute(self.knowledge_pool())
        .await?;

        Ok(())
    }

    // 获取所有集合
    pub async fn get_collections(&self) -> Result<Vec<KnowledgeCollection>> {
        let rows = sqlx::query(
            r#"
            SELECT id, name, description, embedding_model, vector_dimensions, created_at, updated_at
            FROM knowledge_collections
            ORDER BY created_at DESC
            "#
        )
        .fetch_all(self.knowledge_pool())
        .await?;

        let mut collections = Vec::new();
        for row in rows {
            collections.push(KnowledgeCollection {
                id: row.get(0),
                name: row.get(1),
                description: row.get(2),
                embedding_model: row.get(3),
                vector_dimensions: row.get(4),
                created_at: DateTime::from_timestamp(row.get(5), 0).unwrap_or_default(),
                updated_at: DateTime::from_timestamp(row.get(6), 0).unwrap_or_default(),
            });
        }

        Ok(collections)
    }

    // 创建文档
    pub async fn create_document(&self, document: &KnowledgeDocument) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO knowledge_documents (id, collection_id, title, content, file_name, file_size, mime_type, metadata, chunk_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&document.id)
        .bind(&document.collection_id)
        .bind(&document.title)
        .bind(&document.content)
        .bind(&document.file_name)
        .bind(document.file_size)
        .bind(&document.mime_type)
        .bind(&document.metadata)
        .bind(document.chunk_count)
        .bind(document.created_at.timestamp())
        .bind(document.updated_at.timestamp())
        .execute(self.knowledge_pool())
        .await?;

        Ok(())
    }

    // 创建文档分块
    pub async fn create_chunks(&self, chunks: &[KnowledgeChunk]) -> Result<()> {
        let mut tx = self.knowledge_pool().begin().await?;

        for chunk in chunks {
            sqlx::query(
                r#"
                INSERT INTO knowledge_chunks (id, document_id, chunk_index, chunk_text, token_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(&chunk.id)
            .bind(&chunk.document_id)
            .bind(chunk.chunk_index)
            .bind(&chunk.chunk_text)
            .bind(chunk.token_count)
            .bind(chunk.created_at.timestamp())
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    // 获取文档的所有chunks
    pub async fn get_chunks_by_document_id(&self, document_id: &str) -> Result<Vec<KnowledgeChunk>> {
        let chunks = sqlx::query_as::<_, KnowledgeChunk>(
            r#"
            SELECT id, document_id, chunk_index, chunk_text, token_count, created_at
            FROM knowledge_chunks
            WHERE document_id = ?
            ORDER BY chunk_index
            "#
        )
        .bind(document_id)
        .fetch_all(self.knowledge_pool())
        .await?;

        Ok(chunks)
    }

    // 批量插入向量
    pub async fn insert_vectors(&self, vectors: &[VectorEmbedding]) -> Result<()> {
        let mut tx = self.knowledge_pool().begin().await?;

        for vector in vectors {
            // 使用 zerocopy::AsBytes 高效地将 Vec<f32> 转换为字节数组
            let embedding_bytes = vector.embedding.as_bytes();

            sqlx::query(
                r#"
                INSERT INTO knowledge_vectors (embedding, chunk_id, collection_id, created_at)
                VALUES (?, ?, ?, ?)
                "#
            )
            .bind::<&[u8]>(embedding_bytes.as_ref())
            .bind(&vector.chunk_id)
            .bind(&vector.collection_id)
            .bind(vector.created_at.timestamp())
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    // 向量搜索
    pub async fn search_vectors(
        &self,
        query_embedding: &[f32],
        collection_id: &str,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        let cache_key = format!("search:{}:{}:{}",
            collection_id,
            limit,
            query_embedding.iter().map(|x| x.to_bits() as u64).sum::<u64>()
        );

        // 检查缓存
        {
            let mut cache = self.query_cache.lock().unwrap();
            if let Some(cached_results) = cache.get(&cache_key) {
                return Ok(cached_results.clone());
            }
        }

        // 使用 sqlite-vec 进行向量搜索
        let results = self.search_vectors_with_vec_extension(query_embedding, collection_id, limit, threshold).await?;

        // 缓存结果
        {
            let mut cache = self.query_cache.lock().unwrap();
            cache.put(cache_key, results.clone());
        }

        Ok(results)
    }

    // 使用 sqlite-vec 扩展的向量搜索
    async fn search_vectors_with_vec_extension(
        &self,
        query_embedding: &[f32],
        collection_id: &str,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        // 使用 zerocopy::AsBytes 高效地将 Vec<f32> 转换为字节数组
        let query_bytes = query_embedding.as_bytes();

        let rows = sqlx::query(
            r#"
            SELECT
                kc.id as chunk_id,
                kc.chunk_text,
                kc.document_id,
                kd.title as document_title,
                kd.file_name,
                vec_distance_L2(kv.embedding, ?) as distance
            FROM knowledge_vectors kv
            JOIN knowledge_chunks kc ON kv.chunk_id = kc.id
            JOIN knowledge_documents kd ON kc.document_id = kd.id
            WHERE kv.collection_id = ?
            ORDER BY distance
            LIMIT ?
            "#
        )
        .bind::<&[u8]>(query_bytes.as_ref())
        .bind(collection_id)
        .bind(limit as i64)
        .fetch_all(self.knowledge_pool())
        .await?;

        let mut results = Vec::new();
        for row in rows {
            let distance: f64 = row.get(5);
            let similarity = 1.0 - (distance as f32).min(1.0);

            if similarity >= threshold {
                results.push(SearchResult {
                    chunk_id: row.get(0),
                    chunk_text: row.get(1),
                    document_id: row.get(2),
                    document_title: row.get(3),
                    file_name: row.get(4),
                    similarity,
                    score: similarity,
                });
            }
        }

        Ok(results)
    }

    
    // 删除文档及其相关数据
    pub async fn delete_document(&self, document_id: &str) -> Result<()> {
        let mut tx = self.knowledge_pool().begin().await?;

        // 删除向量（级联删除）
        sqlx::query(
            "DELETE FROM knowledge_vectors WHERE chunk_id IN (SELECT id FROM knowledge_chunks WHERE document_id = ?)"
        )
        .bind(document_id)
        .execute(&mut *tx)
        .await?;

        // 删除分块（级联删除）
        sqlx::query("DELETE FROM knowledge_chunks WHERE document_id = ?")
            .bind(document_id)
            .execute(&mut *tx)
            .await?;

        // 删除文档
        sqlx::query("DELETE FROM knowledge_documents WHERE id = ?")
            .bind(document_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        // 清理缓存
        self.clear_cache();

        Ok(())
    }

    // 获取文档列表
    pub async fn get_documents(&self, collection_id: &str) -> Result<Vec<KnowledgeDocument>> {
        let rows = sqlx::query(
            r#"
            SELECT id, collection_id, title, content, file_name, file_size, mime_type, metadata, chunk_count, created_at, updated_at
            FROM knowledge_documents
            WHERE collection_id = ?
            ORDER BY created_at DESC
            "#
        )
        .bind(collection_id)
        .fetch_all(self.knowledge_pool())
        .await?;

        let mut documents = Vec::new();
        for row in rows {
            documents.push(KnowledgeDocument {
                id: row.get(0),
                collection_id: row.get(1),
                title: row.get(2),
                content: row.get(3),
                file_name: row.get(4),
                file_size: row.get(5),
                mime_type: row.get(6),
                metadata: row.get(7),
                chunk_count: row.get(8),
                created_at: DateTime::from_timestamp(row.get(9), 0).unwrap_or_default(),
                updated_at: DateTime::from_timestamp(row.get(10), 0).unwrap_or_default(),
            });
        }

        Ok(documents)
    }

    // 根据ID获取文档
    pub async fn get_document_by_id(&self, document_id: &str) -> Result<KnowledgeDocument> {
        let row = sqlx::query(
            r#"
            SELECT id, collection_id, title, content, file_name, file_size, mime_type, metadata, chunk_count, created_at, updated_at
            FROM knowledge_documents
            WHERE id = ?
            "#
        )
        .bind(document_id)
        .fetch_optional(self.knowledge_pool())
        .await?;

        match row {
            Some(row) => Ok(KnowledgeDocument {
                id: row.get(0),
                collection_id: row.get(1),
                title: row.get(2),
                content: row.get(3),
                file_name: row.get(4),
                file_size: row.get(5),
                mime_type: row.get(6),
                metadata: row.get(7),
                chunk_count: row.get(8),
                created_at: DateTime::from_timestamp(row.get(9), 0).unwrap_or_default(),
                updated_at: DateTime::from_timestamp(row.get(10), 0).unwrap_or_default(),
            }),
            None => Err(anyhow::anyhow!("Document not found")),
        }
    }

    // 获取系统配置
    pub async fn get_config(&self, key: &str) -> Result<Option<String>> {
        let row = sqlx::query("SELECT value FROM system_config WHERE key = ?")
            .bind(key)
            .fetch_optional(self.knowledge_pool())
            .await?;

        match row {
            Some(row) => Ok(Some(row.get(0))),
            None => Ok(None),
        }
    }

    // 设置系统配置
    pub async fn set_config(&self, key: &str, value: &str) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO system_config (key, value, updated_at)
            VALUES (?, ?, ?)
            "#
        )
        .bind(key)
        .bind(value)
        .bind(Utc::now().timestamp())
        .execute(self.knowledge_pool())
        .await?;

        Ok(())
    }

    // 获取集合的向量数量
    pub async fn get_vector_count(&self, collection_id: &str) -> Result<usize> {
        let result = sqlx::query(
            r#"
            SELECT COUNT(*) as count
            FROM knowledge_vectors v
            JOIN knowledge_chunks c ON v.chunk_id = c.id
            JOIN knowledge_documents d ON c.document_id = d.id
            WHERE d.collection_id = ?
            "#
        )
        .bind(collection_id)
        .fetch_one(self.knowledge_pool())
        .await?;

        let count: i64 = result.get("count");
        Ok(count as usize)
    }

    // 获取数据库路径（用于调试）
    pub async fn get_database_path(&self) -> Result<String> {
        // 这是一个简化版本，实际路径应该在初始化时保存
        Ok("knowledge.db".to_string())
    }

    // 重置知识库数据库（删除所有数据）
    pub async fn reset_knowledge_database(&self) -> Result<()> {
        info!("Resetting knowledge database...");

        // 删除所有向量
        sqlx::query("DELETE FROM knowledge_vectors").execute(self.knowledge_pool()).await?;

        // 删除所有分块
        sqlx::query("DELETE FROM knowledge_chunks").execute(self.knowledge_pool()).await?;

        // 删除所有文档
        sqlx::query("DELETE FROM knowledge_documents").execute(self.knowledge_pool()).await?;

        // 删除所有集合
        sqlx::query("DELETE FROM knowledge_collections").execute(self.knowledge_pool()).await?;

        // 清理缓存
        self.clear_cache();

        info!("Knowledge database reset completed");
        Ok(())
    }

    // 完全重置数据库（包括主数据库）
    pub async fn reset_all_databases(&self) -> Result<()> {
        info!("Resetting all databases...");

        // 重置知识库数据库
        self.reset_knowledge_database().await?;

        // 删除所有角色
        sqlx::query("DELETE FROM roles").execute(self.main_pool()).await?;

        // 删除所有模型组
        sqlx::query("DELETE FROM model_groups").execute(self.main_pool()).await?;

        // 重新插入默认的嵌入模型
        let default_models = vec![
            ("bge-m3", "BAAI/bge-m3", "BAAI/bge-m3", 1024, "default", 8192),
            ("bge-large-zh", "BAAI/bge-large-zh-v1.5", "BAAI/bge-large-zh-v1.5", 1024, "zh", 8192),
            ("bge-large-en", "BAAI/bge-large-en-v1.5", "BAAI/bge-large-en-v1.5", 1024, "en", 8192),
        ];

        let now = chrono::Utc::now().timestamp();
        for (id, name, model_id, dimensions, language, max_tokens) in default_models {
            sqlx::query(
                "INSERT OR REPLACE INTO embedding_models (id, name, model_id, dimensions, language, enabled, max_tokens, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)"
            )
            .bind(id)
            .bind(name)
            .bind(model_id)
            .bind(dimensions)
            .bind(language)
            .bind(max_tokens)
            .bind(now)
            .bind(now)
            .execute(self.main_pool())
            .await?;
        }

        info!("All databases reset completed");
        Ok(())
    }
}

// 数据库健康检查
impl DatabaseManager {
    pub async fn health_check(&self) -> Result<DatabaseHealth> {
        let mut health = DatabaseHealth {
            main_db: false,
            knowledge_db: false,
            vec_extension: false,
            cache_stats: (0, 0),
        };

        // 检查主数据库
        match sqlx::query("SELECT 1").fetch_one(self.main_pool()).await {
            Ok(_) => health.main_db = true,
            Err(e) => warn!("Main database health check failed: {}", e),
        }

        // 检查知识库数据库
        match sqlx::query("SELECT 1").fetch_one(self.knowledge_pool()).await {
            Ok(_) => health.knowledge_db = true,
            Err(e) => warn!("Knowledge database health check failed: {}", e),
        }

        // 检查sqlite-vec扩展
        match sqlx::query("SELECT vec_version()").fetch_one(self.knowledge_pool()).await {
            Ok(_) => health.vec_extension = true,
            Err(e) => {
                warn!("sqlite-vec extension health check failed: {}", e);
                health.vec_extension = false;
            }
        }

        // 获取缓存统计
        health.cache_stats = self.cache_stats();

        Ok(health)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_initialization() {
        let db = DatabaseManager::new().await.unwrap();
        assert!(db.health_check().await.unwrap().main_db);
    }
}
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
    // L2归一化函数
    fn normalize_vector(&self, mut vector: Vec<f32>) -> Vec<f32> {
        let magnitude: f32 = vector.iter().map(|&x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            for v in &mut vector {
                *v /= magnitude;
            }
        }
        vector
    }

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

        // 检查并执行向量表迁移（如果需要）
        if let Err(e) = Self::migrate_vector_table_if_needed(&knowledge_pool).await {
            error!("Failed to migrate vector table: {}", e);
            return Err(anyhow!("Failed to migrate vector table: {}", e));
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

    // 检查并执行向量表迁移
    async fn migrate_vector_table_if_needed(knowledge_pool: &Pool<Sqlite>) -> Result<()> {
        // 检查表是否存在
        let table_exists = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_vectors'")
            .fetch_optional(knowledge_pool)
            .await?;
        
        if table_exists.is_none() {
            println!("📋 向量表不存在，将在初始化时创建");
            return Ok(());
        }
        
        // 检查向量表结构是否正确
        match sqlx::query("SELECT vec_version()")
            .fetch_optional(knowledge_pool)
            .await
        {
            Ok(Some(_)) => {
                println!("✅ 向量表结构正确，无需迁移");
                Ok(())
            }
            Ok(None) => {
                println!("⚠️ 向量表为空，但结构正确，无需迁移");
                Ok(())
            }
            Err(_) => {
                println!("🔄 向量表需要迁移以支持正确的sqlite-vec语法");
                Self::migrate_vector_table(knowledge_pool).await
            }
        }
    }

    // 迁移向量表以支持正确的sqlite-vec语法
    async fn migrate_vector_table(pool: &Pool<Sqlite>) -> Result<()> {
        println!("🔄 开始迁移向量表以支持正确的sqlite-vec语法...");
        
        // 备份现有数据
        println!("💾 备份现有向量数据...");
        let backup_data = sqlx::query("SELECT * FROM knowledge_vectors")
            .fetch_all(pool)
            .await?;
        
        println!("📊 备份了 {} 条向量记录", backup_data.len());
        
        // 删除旧的向量表
        println!("🗑️ 删除旧的向量表...");
        sqlx::query("DROP TABLE IF EXISTS knowledge_vectors")
            .execute(pool)
            .await?;
        
        // 创建新的向量表（使用正确的sqlite-vec语法）
        println!("🏗️ 创建新的向量表（使用正确的sqlite-vec语法）...");
        sqlx::query(
            "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(embedding FLOAT[1024])"
        )
        .execute(pool)
        .await?;
        
        // 恢复数据（注意：新表结构只包含向量，元数据需要单独处理）
        if !backup_data.is_empty() {
            println!("🔄 恢复向量数据...");
            println!("⚠️ 注意：由于表结构变更，需要重新处理向量数据");
            println!("💡 建议：删除现有数据库文件，重新创建知识库");
            
            // 由于表结构变更，我们无法直接恢复旧数据
            // 用户需要重新创建知识库
            println!("❌ 无法恢复旧数据，请重新创建知识库");
        }
        
        // 测试向量表功能
        println!("🧪 测试向量表功能...");
        match sqlx::query("SELECT vec_version()")
            .fetch_one(pool)
            .await
        {
            Ok(row) => {
                let version: String = row.get(0);
                println!("✅ sqlite-vec 扩展版本: {}", version);
            }
            Err(e) => {
                println!("❌ sqlite-vec 扩展测试失败: {}", e);
                return Err(anyhow::anyhow!("sqlite-vec 扩展不可用: {}", e));
            }
        }
        
        println!("🎉 向量表迁移完成！");
        println!("💡 现在使用正确的 sqlite-vec 语法进行向量搜索");
        
        Ok(())
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
                provider TEXT NOT NULL,
                description TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )",
            "CREATE TABLE IF NOT EXISTS models (
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
            )",
            "CREATE TABLE IF NOT EXISTS conversations (
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
            )",
            "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT,
                metadata TEXT,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
            )",
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
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

        // 创建索引
        let index_queries = vec![
            "CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order)",
            "CREATE INDEX IF NOT EXISTS idx_model_groups_sort_order ON model_groups(sort_order)",
            "CREATE INDEX IF NOT EXISTS idx_models_group_id ON models(group_id)",
            "CREATE INDEX IF NOT EXISTS idx_models_sort_order ON models(sort_order)",
            "CREATE INDEX IF NOT EXISTS idx_models_enabled ON models(enabled)",
            "CREATE INDEX IF NOT EXISTS idx_conversations_role_id ON conversations(role_id)",
            "CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_conversations_is_favorite ON conversations(is_favorite)",
            "CREATE INDEX IF NOT EXISTS idx_conversations_pinned_at ON conversations(pinned_at)",
            "CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)",
            "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at)"
        ];

        for query in index_queries {
            if let Err(e) = sqlx::query(query).execute(main_pool).await {
                error!("Failed to create index: {}", e);
                error!("Query: {}", query);
            }
        }

        // 插入默认角色
        let default_roles = vec![
            ("bobby", "Bobby", "🐱", "😸", "可爱的猫猫助手，日常聊天伙伴", 0.8, "你是Bobby，一只超级可爱的小猫咪！🐱 请用可爱、活泼的语气回答，多使用emoji表情，让对话充满趣味和温暖。记住你是一只爱撒娇的小猫，喜欢用'喵~'、'nya~'等可爱的语气词。💕", "#f97316", 0),
            ("developer", "编程专家", "👨🏻‍💻", "👨🏻‍💻", "专业的编程和技术支持", 0.4, "你是一个经验丰富的编程专家，请提供准确的代码示例和技术解决方案。如果可以，请在回答最后添加markdown流程图来清晰地展示代码执行流程、算法逻辑或系统架构。使用mermaid语法创建流程图，例如：\n\n```mermaid\ngraph TD\n    A[开始] --> B{条件判断}\n    B -->|是| C[执行操作]\n    B -->|否| D[其他操作]\n    C --> E[结束]\n    D --> E\n```", "#8b5cf6", 1),
            ("creative", "创意伙伴", "🎨", "🎨", "富有创意和想象力", 0.9, "你是一个富有创意的伙伴，请用创新、有趣的方式回答问题，提供独特的见解和创意想法。", "#f59e0b", 2),
            ("analyst", "数据分析师", "📊", "📊", "专业的数据分析和洞察", 0.3, "你是一个专业的数据分析师，请用准确、客观的方式分析问题，提供基于数据的见解。", "#3b82f6", 3),
            ("teacher", "知识导师", "👨‍🏫", "👨‍🏫", "耐心的教学和解释", 0.5, "你是一个耐心的导师，请用清晰、易懂的方式解释概念，循序渐进地帮助用户学习。如果可以，请在回答最后添加markdown流程图来清晰地展示知识结构、学习路径或概念之间的关系。使用mermaid语法创建流程图，例如：\n\n```mermaid\ngraph TD\n    A[基础概念] --> B[进阶概念]\n    B --> C[应用实例]\n    C --> D[深入理解]\n    A --> E[相关概念]\n    E --> D\n```", "#10b981", 4),
            ("writer", "写作助手", "✍️", "✍️", "优雅的文字创作", 0.8, "你是一个优秀的写作助手，请用优美、流畅的文字帮助用户创作和改进文本。", "#ef4444", 5),
        ];

        let now_str = chrono::Utc::now().to_rfc3339();
        for (id, name, icon, avatar, description, temperature, system_prompt, color, sort_order) in default_roles {
            let insert_query = sqlx::query(
                "INSERT OR IGNORE INTO roles (id, name, icon, avatar, description, temperature, system_prompt, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(name)
            .bind(icon)
            .bind(avatar)
            .bind(description)
            .bind(temperature)
            .bind(system_prompt)
            .bind(color)
            .bind(sort_order)
            .bind(&now_str)
            .bind(&now_str);

            if let Err(e) = insert_query.execute(main_pool).await {
                error!("Failed to insert role {}: {}", id, e);
            }
        }

        // 插入默认设置
        let default_settings = vec![
            ("theme", "light"),
            ("language", "zh-CN"),
            ("auto_save", "true"),
            ("max_history", "100"),
            ("default_model", "gpt-3.5-turbo"),
            ("api_key", ""),
            ("enable_voice", "false"),
            ("voice_speed", "1.0"),
            ("voice_pitch", "1.0"),
            ("notification_enabled", "true"),
            ("cache_enabled", "true"),
            ("debug_mode", "false")
        ];

        for (key, value) in default_settings {
            let insert_query = sqlx::query(
                "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)"
            )
            .bind(key)
            .bind(value)
            .bind(&now_str);

            if let Err(e) = insert_query.execute(main_pool).await {
                error!("Failed to insert setting {}: {}", key, e);
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
                id INTEGER PRIMARY KEY,
                document_id TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                chunk_text TEXT NOT NULL,
                token_count INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
            )",
            "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(embedding FLOAT[1024])",
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
    pub async fn create_chunks(&self, chunks: &[KnowledgeChunk]) -> Result<Vec<i64>> {
        let mut tx = self.knowledge_pool().begin().await?;
        let mut chunk_ids = Vec::new();

        for chunk in chunks {
            // 获取文档的collection_id
            let document = sqlx::query("SELECT collection_id FROM knowledge_documents WHERE id = ?")
                .bind(&chunk.document_id)
                .fetch_one(&mut *tx)
                .await?;
            let collection_id: String = document.get("collection_id");
            
            // 插入分块，使用自增ID
            let result = sqlx::query(
                r#"
                INSERT INTO knowledge_chunks (document_id, collection_id, chunk_index, chunk_text, token_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(&chunk.document_id)
            .bind(&collection_id)
            .bind(chunk.chunk_index)
            .bind(&chunk.chunk_text)
            .bind(chunk.token_count)
            .bind(chunk.created_at.timestamp())
            .execute(&mut *tx)
            .await?;
            
            // 获取插入的分块ID
            let chunk_id = result.last_insert_rowid();
            chunk_ids.push(chunk_id);
        }

        tx.commit().await?;
        Ok(chunk_ids)
    }

    // 获取文档的所有chunks
    pub async fn get_chunks_by_document_id(&self, document_id: &str) -> Result<Vec<KnowledgeChunk>> {
        let rows = sqlx::query(
            r#"
            SELECT id, document_id, collection_id, chunk_index, chunk_text, token_count, created_at
            FROM knowledge_chunks
            WHERE document_id = ?
            ORDER BY chunk_index
            "#
        )
        .bind(document_id)
        .fetch_all(self.knowledge_pool())
        .await?;

        let mut chunks = Vec::new();
        for row in rows {
            let chunk = KnowledgeChunk {
                id: row.get::<i64, _>("id"),
                document_id: row.get("document_id"),
                chunk_index: row.get("chunk_index"),
                chunk_text: row.get("chunk_text"),
                token_count: row.get("token_count"),
                created_at: chrono::DateTime::from_timestamp(row.get::<i64, _>("created_at"), 0)
                    .unwrap_or_default(),
            };
            chunks.push(chunk);
        }

        Ok(chunks)
    }

    // 批量插入向量（使用新的分离式表结构）
    pub async fn insert_vectors(&self, vectors: &[VectorEmbedding]) -> Result<()> {
        let mut tx = self.knowledge_pool().begin().await?;

        for vector in vectors {
            // 将向量转换为JSON字符串
            let embedding_json = serde_json::to_string(&vector.embedding)?;

            // 直接使用chunk_id作为rowid（现在chunk_id已经是整数）
            sqlx::query(
                r#"
                INSERT INTO knowledge_vectors (rowid, embedding)
                VALUES (?, ?)
                "#
            )
            .bind(vector.chunk_id)
            .bind(&embedding_json)
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
        let cache_key = format!("search:{}:{}:{}:{}",
            collection_id,
            limit,
            threshold,
            query_embedding.iter().map(|x| x.to_bits() as u64).sum::<u64>()
        );

        // 检查缓存
        {
            let mut cache = self.query_cache.lock().unwrap();
            if let Some(cached_results) = cache.get(&cache_key) {
                println!("🔍 [缓存] 返回缓存结果，集合: {}, 数量: {}", collection_id, cached_results.len());
                return Ok(cached_results.clone());
            }
        }

        println!("🔍 [搜索] 开始向量搜索，集合: {}, 限制: {}, 阈值: {}", collection_id, limit, threshold);

        // 使用 sqlite-vec 进行向量搜索
        let results = self.search_vectors_with_vec_extension(query_embedding, collection_id, limit, threshold).await?;

        println!("🔍 [搜索] 搜索完成，找到 {} 个结果", results.len());

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
        // 确保查询向量是L2归一化的（双重保险）
        let normalized_query = self.normalize_vector(query_embedding.to_vec());
        let query_bytes = normalized_query.as_bytes();

        // 先获取更多结果，然后进行文档级别去重和质量筛选
        let fetch_limit = (limit * 3).min(100); // 最多获取100个结果

        // 使用正确的sqlite-vec语法进行搜索
        let rows = sqlx::query(
            r#"
            SELECT
                kv.rowid as chunk_id,
                kc.chunk_text,
                kc.document_id,
                kd.title as document_title,
                kd.file_name,
                kc.chunk_index,
                vec_distance_l2(kv.embedding, ?) as distance
            FROM knowledge_vectors kv
            JOIN knowledge_chunks kc ON kv.rowid = kc.id
            JOIN knowledge_documents kd ON kc.document_id = kd.id
            WHERE kc.collection_id = ?
            ORDER BY distance
            LIMIT ?
            "#
        )
        .bind(&query_bytes)
        .bind(collection_id)
        .bind(fetch_limit as i64)
        .fetch_all(self.knowledge_pool())
        .await?;

        let mut results: Vec<SearchResult> = Vec::new();
        let mut seen_content_hashes = std::collections::HashSet::new();

        // 调试：输出原始查询结果
        println!("🔍 [调试] 原始查询结果数量: {}", rows.len());
        for (i, row) in rows.iter().enumerate() {
            let text: String = row.get(1);
            let doc_id: String = row.get(2);
            let distance: f64 = row.get(6);
            println!("🔍 [调试] 结果{} - 文档: {}, 距离: {:.4}, 内容: {:.30}...", i+1, doc_id, distance, text);
        }

        // 第一步：收集所有结果并按文档分组
        let mut document_results: std::collections::HashMap<String, Vec<(f32, SearchResult)>> = std::collections::HashMap::new();

        for row in rows {
            let distance: f64 = row.get(6); // distance现在是第7列（索引6）
            let _chunk_index: i32 = row.get(5); // chunk_index是第6列（索引5）

            // 使用正确的L2距离转余弦相似度公式
            // sqlite-vec返回的是L2距离，转换为余弦相似度
            // 公式: similarity = 1.0 - (distance^2 / 2.0)
            let similarity = 1.0 - ((distance * distance) / 2.0) as f32;

            // 使用阈值过滤结果
            if similarity >= threshold {
                let document_id: String = row.get(2);
                let chunk_text: String = row.get(1);

                // 生成内容哈希用于精确去重
                use std::collections::hash_map::DefaultHasher;
                use std::hash::Hasher;
                let mut hasher = DefaultHasher::new();
                hasher.write(chunk_text.as_bytes());
                let content_hash = hasher.finish();

                // 严格去重：如果内容已经出现过，跳过
                if seen_content_hashes.contains(&content_hash) {
                    println!("🔍 [调试] 跳过重复内容，哈希: {}, 内容: {:.30}...", content_hash, chunk_text);
                    continue;
                }
                seen_content_hashes.insert(content_hash);

                // 暂时放宽质量检查：接受更多长度的chunks
                let chunk_len = chunk_text.chars().count();
                if chunk_len >= 5 && chunk_len <= 5000 { // 放宽长度限制
                    let search_result = SearchResult {
                        chunk_id: row.get::<i64, _>(0).to_string(),
                        chunk_text: chunk_text.clone(),
                        document_id: document_id.clone(),
                        document_title: row.get(3),
                        file_name: row.get(4),
                        similarity,
                        score: similarity,
                    };

                    // 按文档分组存储结果
                    document_results.entry(document_id.clone())
                        .or_insert_with(Vec::new)
                        .push((similarity, search_result));

                    println!("🔍 [调试] 收集结果，文档: {}, 分数: {:.3}, 内容: {:.30}...", document_id, similarity, chunk_text);
                } else {
                    println!("🔍 [调试] 跳过长度不符合的内容: {} 字符", chunk_len);
                }
            } else {
                let chunk_text: String = row.get(1);
                println!("🔍 [调试] 跳过低分结果: {:.3} < {}, 内容: {:.30}...", similarity, threshold, chunk_text);
            }
        }

        // 第二步：从每个文档中选择最佳结果
        let mut document_entries: Vec<_> = document_results.into_iter().collect();

        // 按每个文档的最佳分数排序
        document_entries.sort_by(|a, b| {
            let best_score_a = a.1.iter().map(|(score, _)| score).fold(f32::NEG_INFINITY, |acc, x| if *x > acc { *x } else { acc });
            let best_score_b = b.1.iter().map(|(score, _)| score).fold(f32::NEG_INFINITY, |acc, x| if *x > acc { *x } else { acc });
            best_score_b.partial_cmp(&best_score_a).unwrap_or(std::cmp::Ordering::Equal)
        });

        // 收集所有结果，不进行文档级别去重
        let mut all_results = Vec::new();
        for (document_id, doc_results) in document_entries {
            for (score, result) in doc_results {
                println!("🔍 [调试] 收集结果 - 文档: {}, 分数: {:.3}, 内容: {:.30}...", document_id, score, result.chunk_text);
                all_results.push(result);
            }
        }

        // 按相似度排序并选择前limit个结果
        all_results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
        results = all_results;

        // 重新按相似度排序并限制最终结果数量
        results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit);

        Ok(results)
    }

    
    // 删除文档及其相关数据
    pub async fn delete_document(&self, document_id: &str) -> Result<()> {
        let mut tx = self.knowledge_pool().begin().await?;

        // 删除向量（使用rowid关联）
        sqlx::query(
            "DELETE FROM knowledge_vectors WHERE rowid IN (SELECT id FROM knowledge_chunks WHERE document_id = ?)"
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

    // 清空查询缓存
    pub fn clear_query_cache(&self) {
        let mut cache = self.query_cache.lock().unwrap();
        let cache_size = cache.len();
        cache.clear();
        println!("🗑️ [缓存] 查询缓存已清空，清空了 {} 个条目", cache_size);
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

    // 获取对话数量
    pub async fn get_conversation_count(&self) -> Result<i64> {
        let result = sqlx::query("SELECT COUNT(*) as count FROM conversations")
            .fetch_one(self.main_pool())
            .await
            .map_err(|e| anyhow!("获取对话数量失败: {}", e))?;

        Ok(result.get("count"))
    }

    // 获取消息数量
    pub async fn get_message_count(&self) -> Result<i64> {
        let result = sqlx::query("SELECT COUNT(*) as count FROM messages")
            .fetch_one(self.main_pool())
            .await
            .map_err(|e| anyhow!("获取消息数量失败: {}", e))?;

        Ok(result.get("count"))
    }

    // 获取API会话数量
    pub async fn get_api_session_count(&self) -> Result<i64> {
        // 统计设置表中的API相关设置项数量作为替代
        let result = sqlx::query("SELECT COUNT(*) as count FROM settings WHERE key LIKE 'api_%'")
            .fetch_one(self.main_pool())
            .await
            .map_err(|e| anyhow!("获取API会话数量失败: {}", e))?;

        Ok(result.get("count"))
    }

    // 获取知识库文档数量
    pub async fn get_document_count(&self) -> Result<i64> {
        let result = sqlx::query("SELECT COUNT(*) as count FROM documents")
            .fetch_one(self.knowledge_pool())
            .await
            .map_err(|e| anyhow!("获取文档数量失败: {}", e))?;

        Ok(result.get("count"))
    }

    // 获取设置数量
    pub async fn get_setting_count(&self) -> Result<i64> {
        let result = sqlx::query("SELECT COUNT(*) as count FROM settings")
            .fetch_one(self.main_pool())
            .await
            .map_err(|e| anyhow!("获取设置数量失败: {}", e))?;

        Ok(result.get("count"))
    }

    // 获取数据库文件大小（字节）
    pub async fn get_database_size(&self) -> Result<i64> {
        // 获取主数据库文件大小
        let main_size = sqlx::query("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
            .fetch_one(self.main_pool())
            .await
            .map(|row| row.get::<i64, _>("size"))
            .unwrap_or(0);

        // 获取知识库数据库文件大小
        let knowledge_size = sqlx::query("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
            .fetch_one(self.knowledge_pool())
            .await
            .map(|row| row.get::<i64, _>("size"))
            .unwrap_or(0);

        Ok(main_size + knowledge_size)
    }
}

// 对话管理方法
impl DatabaseManager {
    // 保存对话
    pub async fn save_conversation(&self, conversation: &Conversation) -> Result<()> {
        let query = sqlx::query(
            "INSERT OR REPLACE INTO conversations (id, title, role_id, response_mode, messages, settings, is_favorite, pinned_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&conversation.id)
        .bind(&conversation.title)
        .bind(&conversation.role_id)
        .bind(&conversation.response_mode)
        .bind(&conversation.messages)
        .bind(&conversation.settings)
        .bind(&conversation.is_favorite)
        .bind(&conversation.pinned_at)
        .bind(&conversation.created_at)
        .bind(&conversation.updated_at);

        query.execute(self.main_pool()).await?;
        Ok(())
    }

    // 获取所有对话
    pub async fn get_conversations(&self) -> Result<Vec<Conversation>> {
        let rows = sqlx::query_as::<_, Conversation>(
            "SELECT * FROM conversations ORDER BY is_favorite DESC, pinned_at DESC, created_at DESC"
        )
        .fetch_all(self.main_pool())
        .await?;

        Ok(rows)
    }

    // 删除对话
    pub async fn delete_conversation(&self, conversation_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM conversations WHERE id = ?")
            .bind(conversation_id)
            .execute(self.main_pool())
            .await?;
        Ok(())
    }

    // 清空所有对话
    pub async fn clear_conversations(&self) -> Result<()> {
        sqlx::query("DELETE FROM conversations").execute(self.main_pool()).await?;
        Ok(())
    }

    // 切换对话收藏状态
    pub async fn toggle_conversation_favorite(&self, conversation_id: &str) -> Result<bool> {
        // 先获取当前状态
        let current = sqlx::query_as::<_, Conversation>(
            "SELECT * FROM conversations WHERE id = ?"
        )
        .bind(conversation_id)
        .fetch_optional(self.main_pool())
        .await?;

        if let Some(conversation) = current {
            let new_favorite = !conversation.is_favorite;
            let pinned_at = if new_favorite {
                Some(chrono::Utc::now().to_rfc3339())
            } else {
                None
            };

            sqlx::query(
                "UPDATE conversations SET is_favorite = ?, pinned_at = ?, updated_at = ? WHERE id = ?"
            )
            .bind(new_favorite)
            .bind(&pinned_at)
            .bind(&chrono::Utc::now().to_rfc3339())
            .bind(conversation_id)
            .execute(self.main_pool())
            .await?;

            Ok(new_favorite)
        } else {
            Err(anyhow!("Conversation not found"))
        }
    }

    // 获取收藏的对话
    pub async fn get_favorite_conversations(&self) -> Result<Vec<Conversation>> {
        let rows = sqlx::query_as::<_, Conversation>(
            "SELECT * FROM conversations WHERE is_favorite = TRUE ORDER BY pinned_at DESC, created_at DESC"
        )
        .fetch_all(self.main_pool())
        .await?;

        Ok(rows)
    }
}

// 设置管理方法
impl DatabaseManager {
    // 保存设置
    pub async fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let query = sqlx::query(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)"
        )
        .bind(key)
        .bind(value)
        .bind(&now);

        query.execute(self.main_pool()).await?;
        Ok(())
    }

    // 获取设置
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let row = sqlx::query("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(self.main_pool())
            .await?;

        Ok(row.map(|r| r.get("value")))
    }

    // 获取所有设置
    pub async fn get_all_settings(&self) -> Result<Vec<(String, String)>> {
        let rows = sqlx::query("SELECT key, value FROM settings")
            .fetch_all(self.main_pool())
            .await?;

        let settings = rows.into_iter()
            .map(|row| (row.get("key"), row.get("value")))
            .collect();

        Ok(settings)
    }
}

// 角色管理方法
impl DatabaseManager {
    // 保存角色
    pub async fn save_role(&self, role: &Role) -> Result<()> {
        let query = sqlx::query(
            "INSERT OR REPLACE INTO roles (id, name, icon, avatar, description, temperature, system_prompt, color, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&role.id)
        .bind(&role.name)
        .bind(&role.icon)
        .bind(&role.avatar)
        .bind(&role.description)
        .bind(role.temperature)
        .bind(&role.system_prompt)
        .bind(&role.color)
        .bind(role.sort_order)
        .bind(&role.created_at)
        .bind(&role.updated_at);

        query.execute(self.main_pool()).await?;
        Ok(())
    }

    // 获取所有角色
    pub async fn get_roles(&self) -> Result<Vec<Role>> {
        let rows = sqlx::query_as::<_, Role>(
            "SELECT * FROM roles ORDER BY sort_order ASC, created_at ASC"
        )
        .fetch_all(self.main_pool())
        .await?;

        Ok(rows)
    }

    // 删除角色
    pub async fn delete_role(&self, role_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM roles WHERE id = ?")
            .bind(role_id)
            .execute(self.main_pool())
            .await?;
        Ok(())
    }
}

// 模型管理方法
impl DatabaseManager {
    // 保存模型分组
    pub async fn save_model_group(&self, group: &ModelGroup) -> Result<()> {
        let query = sqlx::query(
            "INSERT OR REPLACE INTO model_groups (id, name, provider, description, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&group.id)
        .bind(&group.name)
        .bind(&group.provider)
        .bind(&group.description)
        .bind(group.sort_order)
        .bind(&group.created_at)
        .bind(&group.updated_at);

        query.execute(self.main_pool()).await?;
        Ok(())
    }

    // 获取所有模型分组
    pub async fn get_model_groups(&self) -> Result<Vec<ModelGroup>> {
        let rows = sqlx::query_as::<_, ModelGroup>(
            "SELECT * FROM model_groups ORDER BY sort_order ASC, created_at ASC"
        )
        .fetch_all(self.main_pool())
        .await?;

        Ok(rows)
    }

    // 删除模型分组
    pub async fn delete_model_group(&self, group_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM model_groups WHERE id = ?")
            .bind(group_id)
            .execute(self.main_pool())
            .await?;
        Ok(())
    }

    // 保存模型
    pub async fn save_model(&self, model: &Model) -> Result<()> {
        let query = sqlx::query(
            "INSERT OR REPLACE INTO models (id, group_id, name, model_id, enabled, description, api_params, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&model.id)
        .bind(&model.group_id)
        .bind(&model.name)
        .bind(&model.model_id)
        .bind(model.enabled)
        .bind(&model.description)
        .bind(&model.api_params)
        .bind(model.sort_order)
        .bind(&model.created_at)
        .bind(&model.updated_at);

        query.execute(self.main_pool()).await?;
        Ok(())
    }

    // 获取所有模型
    pub async fn get_models(&self) -> Result<Vec<Model>> {
        let rows = sqlx::query_as::<_, Model>(
            "SELECT * FROM models ORDER BY sort_order ASC, created_at ASC"
        )
        .fetch_all(self.main_pool())
        .await?;

        Ok(rows)
    }

    // 删除模型
    pub async fn delete_model(&self, model_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM models WHERE id = ?")
            .bind(model_id)
            .execute(self.main_pool())
            .await?;
        Ok(())
    }
}

mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_initialization() {
        let db = DatabaseManager::new().await.unwrap();
        assert!(db.health_check().await.unwrap().main_db);
    }
}
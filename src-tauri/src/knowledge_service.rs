use crate::database::DatabaseManager;
use crate::vector_service::VectorService;
use crate::types::*;
use anyhow::{Result, anyhow};
use tracing::warn;
use std::sync::Arc;
use chrono::Utc;
use sqlx::Row;
use unicode_segmentation::UnicodeSegmentation;

// 文档处理器
pub struct DocumentProcessor {
    db: Arc<DatabaseManager>,
    vector_service: Arc<VectorService>,
}

impl DocumentProcessor {
    pub fn new(db: Arc<DatabaseManager>, vector_service: Arc<VectorService>) -> Self {
        Self { db, vector_service }
    }

    // 处理文档（带API密钥）
    pub async fn process_document_with_api_key(&self, request: DocumentProcessRequest, api_key: &str) -> Result<DocumentProcessResponse> {
        // 基本处理和之前一样，但嵌入生成时使用API密钥
        let start_time = std::time::Instant::now();

        // 获取集合配置
        let collection = self.get_collection(&request.collection_id).await?;

        // 获取系统配置
        let config = self.get_system_config().await?;

        // 验证文档大小
        if let Some(size) = request.file_size {
            if size > 10485760 as i64 {
                return Err(anyhow!("Document size exceeds maximum limit"));
            }
        }

        // 创建或使用现有文档记录
        let document = if let Some(existing_id) = &request.document_id {
            // 使用现有文档
            println!("📝 使用现有文档处理: {}", existing_id);
            self.db.get_document_by_id(existing_id).await
                .map_err(|e| anyhow!("获取现有文档失败: {}", e))?
        } else {
            // 创建新文档记录
            println!("📝 创建新文档记录: {}", request.title);
            let new_doc = KnowledgeDocument::new(
                request.collection_id.clone(),
                request.title.clone(),
                request.content.clone(),
                request.file_name.clone(),
                request.file_size,
                request.mime_type.clone(),
            );

            // 批量插入数据 - 创建文档
            self.db.create_document(&new_doc).await?;
            new_doc
        };

        // 检查是否已经存在 chunks，避免重复创建
        let existing_chunks = self.db.get_chunks_by_document_id(&document.id).await
            .map_err(|e| anyhow!("获取现有chunks失败: {}", e))?;

        if !existing_chunks.is_empty() {
            println!("📄 文档 {} 已有 {} 个chunks，跳过重复创建", document.id, existing_chunks.len());

            // 返回现有chunks的统计信息
            return Ok(DocumentProcessResponse {
                document_id: document.id,
                chunks_count: existing_chunks.len(),
                vectors_count: existing_chunks.len(), // 假设每个chunk都有对应的vector
                processing_time_ms: start_time.elapsed().as_millis() as u64,
            });
        }

        // 分块处理：按模型采用推荐 chunk 参数（请求未显式提供时）
        let model_id = collection.embedding_model.to_lowercase();
        let mut chunk_size = request.chunk_size.unwrap_or(config.chunk_size);
        let mut chunk_overlap = request.chunk_overlap.unwrap_or(config.chunk_overlap);
        if request.chunk_size.is_none() {
            chunk_size = if model_id.contains("bge-m3") {
                900 // 建议 800-1024，取中位偏上
            } else if model_id.contains("bge-large-zh") {
                480 // 安全上限，避免超过512 tokens
            } else if model_id.contains("bge-large-en") {
                900 // 建议 800-1024
            } else { chunk_size };
        }
        if request.chunk_overlap.is_none() {
            chunk_overlap = if model_id.contains("bge-m3") {
                120 // 建议 100-150
            } else if model_id.contains("bge-large-zh") {
                80 // 建议 50-100
            } else if model_id.contains("bge-large-en") {
                100 // 建议 80-120
            } else { chunk_overlap };
        }
        println!("🧩 [分块参数] 模型: {}, chunk_size: {}, overlap: {}", collection.embedding_model, chunk_size, chunk_overlap);

        let mut chunks = self.chunk_document(&request.content, chunk_size, chunk_overlap).await?;

        // 验证分块数量 - 提高到5000个块，但给出警告
        if chunks.len() > 5000 {
            return Err(anyhow!("Document chunk count exceeds maximum limit (5000)"));
        } else if chunks.len() > 1000 {
            println!("⚠️  文档分块数量较大: {} 个块，建议优化分块参数", chunks.len());
        }

        // 生成嵌入向量 - 使用API密钥调用实际服务
        // 安全截断：避免单条文本超出模型 token 限制导致 413
        // 以字符近似 token 限制：CJK 1字符≈1token，其他 4字符≈1token。目标≤512 tokens
        let safe_texts: Vec<String> = chunks.iter().map(|c| {
            let s = c.chunk_text.as_str();
            let is_cjk = s.chars().any(|ch| (ch >= '\u{4E00}' && ch <= '\u{9FFF}') || (ch >= '\u{3400}' && ch <= '\u{4DBF}'));
            let max_chars = if is_cjk { 512 } else { 2048 };
            let count = s.chars().count();
            if count > max_chars { s.chars().take(max_chars).collect::<String>() } else { s.to_string() }
        }).collect();

        let embeddings = self.generate_embeddings_with_api_key(
            &safe_texts,
            &collection.embedding_model,
            api_key
        ).await?;

        // 更新所有块的document_id为实际ID
        for chunk in &mut chunks {
            chunk.document_id = document.id.clone();
        }

        let chunk_ids = self.db.create_chunks(&chunks).await?;

        // 创建向量记录
        let vector_embeddings: Vec<VectorEmbedding> = chunk_ids.iter().zip(embeddings.iter())
            .map(|(chunk_id, embedding)| VectorEmbedding::new(
                *chunk_id,
                collection.id.clone(),
                embedding.clone(),
            ))
            .collect();

        self.db.insert_vectors(&vector_embeddings).await?;

        let processing_time = start_time.elapsed();

        Ok(DocumentProcessResponse {
            document_id: document.id,
            chunks_count: chunks.len(),
            vectors_count: vector_embeddings.len(),
            processing_time_ms: processing_time.as_millis() as u64,
        })
    }

    // 生成带API密钥的嵌入向量
    pub async fn generate_embeddings_with_api_key(&self, texts: &[String], model_id: &str, api_key: &str) -> Result<Vec<Vec<f32>>> {
        let model = self.vector_service.get_embedding_model(model_id).await?;

        // 调用实际的嵌入服务，使用提供的API密钥
        let embeddings = self.vector_service.generate_embeddings_with_api_key_batch(texts, &model, api_key).await?;

        Ok(embeddings)
    }

    // 生成单个文本的嵌入向量（带API密钥）
    pub async fn generate_embedding_with_api_key(&self, text: &str, model_id: &str, api_key: &str) -> Result<Vec<f32>> {
        let embeddings = self.generate_embeddings_with_api_key(&[text.to_string()], model_id, api_key).await?;
        Ok(embeddings.into_iter().next().unwrap_or_default())
    }

    // 处理文档
    pub async fn process_document(&self, request: DocumentProcessRequest) -> Result<DocumentProcessResponse> {
        let start_time = std::time::Instant::now();

        // 获取集合配置
        let collection = self.get_collection(&request.collection_id).await?;

        // 获取系统配置
        let config = self.get_system_config().await?;

        // 验证文档大小
        if let Some(size) = request.file_size {
            if size > 10485760 as i64 {
                return Err(anyhow!("Document size exceeds maximum limit"));
            }
        }

        // 创建或使用现有文档记录
        let document = if let Some(existing_id) = &request.document_id {
            // 使用现有文档
            println!("📝 使用现有文档处理: {}", existing_id);
            self.db.get_document_by_id(existing_id).await
                .map_err(|e| anyhow!("获取现有文档失败: {}", e))?
        } else {
            // 创建新文档记录
            println!("📝 创建新文档记录: {}", request.title);
            let new_doc = KnowledgeDocument::new(
                request.collection_id.clone(),
                request.title.clone(),
                request.content.clone(),
                request.file_name.clone(),
                request.file_size,
                request.mime_type.clone(),
            );

            // 批量插入数据 - 创建文档
            self.db.create_document(&new_doc).await?;
            new_doc
        };

        // 分块处理：按模型采用推荐 chunk 参数（请求未显式提供时）
        let model_id = collection.embedding_model.to_lowercase();
        let mut chunk_size = request.chunk_size.unwrap_or(config.chunk_size);
        let mut chunk_overlap = request.chunk_overlap.unwrap_or(config.chunk_overlap);
        if request.chunk_size.is_none() {
            chunk_size = if model_id.contains("bge-m3") {
                900
            } else if model_id.contains("bge-large-zh") {
                640
            } else if model_id.contains("bge-large-en") {
                900
            } else { chunk_size };
        }
        if request.chunk_overlap.is_none() {
            chunk_overlap = if model_id.contains("bge-m3") {
                120
            } else if model_id.contains("bge-large-zh") {
                80
            } else if model_id.contains("bge-large-en") {
                100
            } else { chunk_overlap };
        }
        println!("🧩 [分块参数] 模型: {}, chunk_size: {}, overlap: {}", collection.embedding_model, chunk_size, chunk_overlap);

        let mut chunks = self.chunk_document(&request.content, chunk_size, chunk_overlap).await?;

        // 验证分块数量 - 提高到5000个块，但给出警告
        if chunks.len() > 5000 {
            return Err(anyhow!("Document chunk count exceeds maximum limit (5000)"));
        } else if chunks.len() > 1000 {
            println!("⚠️  文档分块数量较大: {} 个块，建议优化分块参数", chunks.len());
        }

        // 生成嵌入向量
        let safe_texts: Vec<String> = chunks.iter().map(|c| {
            let s = c.chunk_text.as_str();
            let is_cjk = s.chars().any(|ch| (ch >= '\u{4E00}' && ch <= '\u{9FFF}') || (ch >= '\u{3400}' && ch <= '\u{4DBF}'));
            let max_chars = if is_cjk { 512 } else { 2048 };
            let count = s.chars().count();
            if count > max_chars { s.chars().take(max_chars).collect::<String>() } else { s.to_string() }
        }).collect();

        let embeddings = self.vector_service.generate_embeddings_batch(
            &safe_texts,
            &collection.embedding_model,
        ).await?;

        // 更新所有块的document_id为实际ID
        for chunk in &mut chunks {
            chunk.document_id = document.id.clone();
        }

        let chunk_ids = self.db.create_chunks(&chunks).await?;

        // 创建向量记录
        let vector_embeddings: Vec<VectorEmbedding> = chunk_ids.iter().zip(embeddings.iter())
            .map(|(chunk_id, embedding)| VectorEmbedding::new(
                *chunk_id,
                collection.id.clone(),
                embedding.clone(),
            ))
            .collect();

        self.db.insert_vectors(&vector_embeddings).await?;

        let processing_time = start_time.elapsed();

        Ok(DocumentProcessResponse {
            document_id: document.id,
            chunks_count: chunks.len(),
            vectors_count: vector_embeddings.len(),
            processing_time_ms: processing_time.as_millis() as u64,
        })
    }

    // 文档分块
    async fn chunk_document(&self, content: &str, chunk_size: usize, chunk_overlap: usize) -> Result<Vec<KnowledgeChunk>> {
        let mut chunks = Vec::new();
        let graphemes = content.graphemes(true).collect::<Vec<_>>();
        let total_chars = graphemes.len();

        if total_chars == 0 {
            return Ok(chunks);
        }

        let mut start = 0;
        let mut chunk_index = 0;

        while start < total_chars {
            let end = (start + chunk_size).min(total_chars);
            let chunk_text = graphemes[start..end].concat();

            // 计算token数量（简化计算）
            let token_count = (chunk_text.len() + 3) / 4; // 粗略估算

            chunks.push(KnowledgeChunk::new(
                "temp_doc_id".to_string(), // 将在插入时替换为实际ID
                chunk_index,
                chunk_text,
                token_count as i32,
            ));

            start = if end >= total_chars {
                total_chars
            } else {
                end.saturating_sub(chunk_overlap)
            };

            chunk_index += 1;
        }

        Ok(chunks)
    }

    // 获取集合
    async fn get_collection(&self, collection_id: &str) -> Result<KnowledgeCollection> {
        let row = sqlx::query(
            "SELECT id, name, description, embedding_model, vector_dimensions, created_at, updated_at
             FROM knowledge_collections WHERE id = ?"
        )
        .bind(collection_id)
        .fetch_one(self.db.knowledge_pool())
        .await?;

        Ok(KnowledgeCollection {
            id: row.get(0),
            name: row.get(1),
            description: row.get(2),
            embedding_model: row.get(3),
            vector_dimensions: row.get(4),
            created_at: chrono::DateTime::from_timestamp(row.get(5), 0).unwrap_or_default(),
            updated_at: chrono::DateTime::from_timestamp(row.get(6), 0).unwrap_or_default(),
        })
    }

    // 获取系统配置
    async fn get_system_config(&self) -> Result<SystemConfig> {
        let config_items = vec![
            "chunk_size", "chunk_overlap", "search_limit", "similarity_threshold",
            "cache_ttl",
        ];

        let mut config = SystemConfig::default();

        for key in config_items {
            if let Ok(Some(value)) = self.db.get_config(key).await {
                match key {
                    "chunk_size" => config.chunk_size = value.parse().unwrap_or(500),
                    "chunk_overlap" => config.chunk_overlap = value.parse().unwrap_or(50),
                    "search_limit" => config.search_limit = value.parse().unwrap_or(10),
                    "similarity_threshold" => config.similarity_threshold = value.parse().unwrap_or(0.7),
                    "cache_ttl" => config.cache_ttl = value.parse().unwrap_or(3600),
                    _ => {}
                }
            }
        }

        Ok(config)
    }
}

// 知识库搜索服务
pub struct KnowledgeSearchService {
    db: Arc<DatabaseManager>,
    vector_service: Arc<VectorService>,
}

impl KnowledgeSearchService {
    pub fn new(db: Arc<DatabaseManager>, vector_service: Arc<VectorService>) -> Self {
        Self { db, vector_service }
    }

    // 搜索知识库
    pub async fn search(&self, request: SearchRequest) -> Result<SearchResponse> {
        let start_time = std::time::Instant::now();

        // 调试：打印请求信息
        println!("🔍 [调试] 收到搜索请求: query='{}', collection_id={:?}", request.query, request.collection_id);

        // 获取系统配置
        let config = self.get_system_config().await?;
        println!("🔍 [调试] 系统配置: default_collection='{}'", config.default_collection);

        // 确定搜索集合
        let collection_id = request.collection_id.unwrap_or_else(|| {
            println!("🔍 [调试] 使用默认集合: '{}'", config.default_collection);
            config.default_collection.clone()
        });
        println!("🔍 [调试] 最终使用集合ID: '{}'", collection_id);

        // 获取集合配置
        let collection = match self.get_collection(&collection_id).await {
            Ok(collection) => collection,
            Err(e) if e.to_string().contains("no rows returned") => {
                return Err(anyhow::anyhow!("集合 '{}' 不存在，请检查集合ID是否正确", collection_id));
            }
            Err(e) => return Err(e),
        };

        // 设置搜索参数
        let limit = request.limit.unwrap_or(config.search_limit);

        // 模型差异化默认阈值
        let model_id = collection.embedding_model.to_lowercase();
        let model_default_threshold: f32 = if model_id.contains("bge-m3") {
            0.80
        } else if model_id.contains("bge-large-zh") {
            0.75
        } else if model_id.contains("bge-large-en") {
            0.70
        } else {
            config.similarity_threshold
        };

        // 使用合理的阈值设置
        let mut threshold = request.threshold.unwrap_or(0.3); // 使用合理的阈值
        println!("🔧 [阈值调整] 使用阈值: {:.3}", threshold);

        // 生成查询向量（bge-large-zh 需要加官方查询指令前缀）
        let mut query_text = request.query.clone();
        if model_id.contains("bge-large-zh") {
            let prefix = "为这个句子生成表示以用于检索相关文章：";
            query_text = format!("{}{}", prefix, query_text);
            println!("🧩 [查询指令] 使用 bge-large-zh，已添加查询前缀");
        }

        let query_embedding = if !request.api_key.is_empty() {
            println!("🔍 使用提供的API密钥生成查询向量，密钥长度: {}", request.api_key.len());
            
            // =================================================================
            // VVVV 关键的调试日志 VVVV
            // 请把这一行日志加到你的代码里
            println!("[最终验证] 即将被BGE-ZH模型编码的字符串是: '{}'", query_text);
            // ^^^^ 关键的调试日志 ^^^^
            // =================================================================
            
            // 直接使用vector_service的方法
            let model = self.vector_service.get_embedding_model(&collection.embedding_model).await?;
            let embeddings = self.vector_service.generate_embeddings_with_api_key_batch(&[query_text.clone()], &model, &request.api_key).await?;
            embeddings.into_iter().next().unwrap_or_default()
        } else {
            println!("🔍 API密钥为空，使用无密钥方式生成查询向量");
            
            // =================================================================
            // VVVV 关键的调试日志 VVVV
            // 请把这一行日志加到你的代码里
            println!("[最终验证] 即将被BGE-ZH模型编码的字符串是: '{}'", query_text);
            // ^^^^ 关键的调试日志 ^^^^
            // =================================================================
            
            self.vector_service.generate_embedding(&query_text, &collection.embedding_model).await?
        };

        // 执行向量搜索
        let mut results = self.db.search_vectors(
            &query_embedding,
            &collection_id,
            limit,
            threshold,
        ).await?;

        // 空结果自动降阈回退：先 0.40，再 0.30
        if results.is_empty() {
            let retry_thresholds = [0.40_f32, 0.30_f32];
            for rt in retry_thresholds {
                if threshold > rt { // 仅当当前阈值高于回退阈值时才回退
                    println!("🛠️ [回退] 初次检索无结果，降阈至 {:.2} 重试", rt);
                    results = self.db.search_vectors(
                        &query_embedding,
                        &collection_id,
                        limit,
                        rt,
                    ).await?;
                    if !results.is_empty() { break; }
                }
            }
        }

        // 记录搜索历史
        if self.is_search_history_enabled().await? {
            self.record_search_history(&request.query, &collection_id, results.len(), start_time.elapsed()).await?;
        }

        let query_time = start_time.elapsed();
        let total_count = results.len();

        Ok(SearchResponse {
            results,
            total_count,
            query_time_ms: query_time.as_millis() as u64,
            collection_id,
            embedding_model: collection.embedding_model,
        })
    }

    // 多集合搜索
    pub async fn search_all_collections(&self, request: SearchRequest) -> Result<Vec<SearchResponse>> {
        let collections = self.get_all_collections().await?;
        let mut responses = Vec::new();

        for collection in collections {
            let mut collection_request = request.clone();
            collection_request.collection_id = Some(collection.id.clone());

            match self.search(collection_request).await {
                Ok(response) => {
                    responses.push(response);
                }
                Err(e) => {
                    warn!("Failed to search collection {}: {}", collection.id, e);
                }
            }
        }

        Ok(responses)
    }

    // 获取所有集合
    async fn get_all_collections(&self) -> Result<Vec<KnowledgeCollection>> {
        self.db.get_collections().await
    }

    // 获取集合
    async fn get_collection(&self, collection_id: &str) -> Result<KnowledgeCollection> {
        let row = sqlx::query(
            "SELECT id, name, description, embedding_model, vector_dimensions, created_at, updated_at
             FROM knowledge_collections WHERE id = ?"
        )
        .bind(collection_id)
        .fetch_one(self.db.knowledge_pool())
        .await?;

        Ok(KnowledgeCollection {
            id: row.get(0),
            name: row.get(1),
            description: row.get(2),
            embedding_model: row.get(3),
            vector_dimensions: row.get(4),
            created_at: chrono::DateTime::from_timestamp(row.get(5), 0).unwrap_or_default(),
            updated_at: chrono::DateTime::from_timestamp(row.get(6), 0).unwrap_or_default(),
        })
    }

    // 获取系统配置
    async fn get_system_config(&self) -> Result<SystemConfig> {
        let config_items = vec![
            "default_collection", "chunk_size", "chunk_overlap", "search_limit",
            "similarity_threshold", "cache_ttl",
        ];

        let mut config = SystemConfig::default();

        for key in config_items {
            if let Ok(Some(value)) = self.db.get_config(key).await {
                match key {
                    "default_collection" => config.default_collection = value,
                    "chunk_size" => config.chunk_size = value.parse().unwrap_or(500),
                    "chunk_overlap" => config.chunk_overlap = value.parse().unwrap_or(50),
                    "search_limit" => config.search_limit = value.parse().unwrap_or(10),
                    "similarity_threshold" => config.similarity_threshold = value.parse().unwrap_or(0.7),
                    "cache_ttl" => config.cache_ttl = value.parse().unwrap_or(3600),
                    _ => {}
                }
            }
        }

        Ok(config)
    }

    // 检查是否启用搜索历史
    async fn is_search_history_enabled(&self) -> Result<bool> {
        match self.db.get_config("enable_search_history").await? {
            Some(value) => Ok(value.parse().unwrap_or(false)),
            None => Ok(true),
        }
    }

    // 记录搜索历史
    async fn record_search_history(&self, query: &str, collection_id: &str, results_count: usize, execution_time: std::time::Duration) -> Result<()> {
        let id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO search_history (id, query_text, collection_id, results_count, execution_time, created_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(query)
        .bind(collection_id)
        .bind(results_count as i64)
        .bind(execution_time.as_millis() as i64)
        .bind(Utc::now().timestamp())
        .execute(self.db.knowledge_pool())
        .await?;

        Ok(())
    }
}

// 知识库管理服务
pub struct KnowledgeManagementService {
    db: Arc<DatabaseManager>,
    vector_service: Arc<VectorService>,
}

impl KnowledgeManagementService {
    pub fn new(db: Arc<DatabaseManager>, vector_service: Arc<VectorService>) -> Self {
        Self { db, vector_service }
    }

    // 获取所有集合
    pub async fn get_collections(&self) -> Result<Vec<KnowledgeCollection>> {
        self.db.get_collections().await
    }

    // 创建集合
    pub async fn create_collection(&self, collection: KnowledgeCollection) -> Result<()> {
        self.db.create_collection(&collection).await?;
        Ok(())
    }

    // 删除集合
    pub async fn delete_collection(&self, collection_id: &str) -> Result<()> {
        let mut tx = self.db.knowledge_pool().begin().await?;

        // 删除向量（通过关联表删除）
        sqlx::query(
            "DELETE FROM knowledge_vectors WHERE rowid IN (
                SELECT kc.id FROM knowledge_chunks kc
                JOIN knowledge_documents kd ON kc.document_id = kd.id
                WHERE kd.collection_id = ?
            )"
        )
        .bind(collection_id)
        .execute(&mut *tx)
        .await?;

        // 删除文档（级联删除分块和向量）
        sqlx::query("DELETE FROM knowledge_documents WHERE collection_id = ?")
            .bind(collection_id)
            .execute(&mut *tx)
            .await?;

        // 删除集合
        sqlx::query("DELETE FROM knowledge_collections WHERE id = ?")
            .bind(collection_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        // 清理缓存
        self.db.clear_cache();

        Ok(())
    }

    // 获取集合统计
    pub async fn get_collection_stats(&self, collection_id: &str) -> Result<CollectionStats> {
        let collection = self.get_collection(collection_id).await?;

        let documents_count = sqlx::query("SELECT COUNT(*) FROM knowledge_documents WHERE collection_id = ?")
            .bind(collection_id)
            .fetch_one(self.db.knowledge_pool())
            .await?
            .get::<i64, _>(0) as usize;

        let chunks_count = sqlx::query(
            "SELECT COUNT(*) FROM knowledge_chunks kc
             JOIN knowledge_documents kd ON kc.document_id = kd.id
             WHERE kd.collection_id = ?"
        )
        .bind(collection_id)
        .fetch_one(self.db.knowledge_pool())
        .await?
        .get::<i64, _>(0) as usize;

        let vectors_count = sqlx::query(
            "SELECT COUNT(*) FROM knowledge_vectors kv
             JOIN knowledge_chunks kc ON kv.rowid = kc.id
             JOIN knowledge_documents kd ON kc.document_id = kd.id
             WHERE kd.collection_id = ?"
        )
        .bind(collection_id)
        .fetch_one(self.db.knowledge_pool())
        .await?
        .get::<i64, _>(0) as usize;

        let total_size_bytes = sqlx::query(
            "SELECT SUM(CAST(LENGTH(kd.content) AS INTEGER)) FROM knowledge_documents kd WHERE kd.collection_id = ?"
        )
        .bind(collection_id)
        .fetch_one(self.db.knowledge_pool())
        .await?
        .get::<Option<i64>, _>(0)
        .unwrap_or(0) as usize;

        Ok(CollectionStats {
            collection_id: collection.id,
            collection_name: collection.name,
            documents_count,
            chunks_count,
            vectors_count,
            total_size_bytes,
            created_at: collection.created_at,
            last_updated: collection.updated_at,
        })
    }

    // 获取系统状态
    pub async fn get_system_status(&self) -> Result<SystemStatus> {
        let database_health = self.db.health_check().await?;
        let cache_stats = database_health.cache_stats;

        let collections_count = sqlx::query("SELECT COUNT(*) FROM knowledge_collections")
            .fetch_one(self.db.knowledge_pool())
            .await?
            .get::<i64, _>(0) as usize;

        let total_documents = sqlx::query("SELECT COUNT(*) FROM knowledge_documents")
            .fetch_one(self.db.knowledge_pool())
            .await?
            .get::<i64, _>(0) as usize;

        let total_vectors = sqlx::query("SELECT COUNT(*) FROM knowledge_vectors")
            .fetch_one(self.db.knowledge_pool())
            .await?
            .get::<i64, _>(0) as usize;

        let memory_usage = self.get_memory_usage().await?;

        Ok(SystemStatus {
            database_health,
            collections_count,
            total_documents,
            total_vectors,
            uptime_seconds: 0, // 需要记录启动时间
            memory_usage_mb: memory_usage,
            cache_stats,
        })
    }

    // 获取集合
    async fn get_collection(&self, collection_id: &str) -> Result<KnowledgeCollection> {
        let row = sqlx::query(
            "SELECT id, name, description, embedding_model, vector_dimensions, created_at, updated_at
             FROM knowledge_collections WHERE id = ?"
        )
        .bind(collection_id)
        .fetch_one(self.db.knowledge_pool())
        .await?;

        Ok(KnowledgeCollection {
            id: row.get(0),
            name: row.get(1),
            description: row.get(2),
            embedding_model: row.get(3),
            vector_dimensions: row.get(4),
            created_at: chrono::DateTime::from_timestamp(row.get(5), 0).unwrap_or_default(),
            updated_at: chrono::DateTime::from_timestamp(row.get(6), 0).unwrap_or_default(),
        })
    }

    // 获取内存使用量
    async fn get_memory_usage(&self) -> Result<usize> {
        // 简化的内存使用计算
        Ok(0)
    }

    // 清理过期缓存
    pub async fn cleanup_expired_cache(&self) -> Result<usize> {
        let result = sqlx::query("DELETE FROM query_cache WHERE expires_at < ?")
            .bind(Utc::now().timestamp())
            .execute(self.db.knowledge_pool())
            .await?;

        Ok(result.rows_affected() as usize)
    }
}
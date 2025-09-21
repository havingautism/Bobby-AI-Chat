use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use sqlx::FromRow;

// 对话结构
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Conversation {
    pub id: String,
    pub title: Option<String>,
    pub role_id: Option<String>,
    pub response_mode: String,
    pub messages: String, // JSON string
    pub settings: String, // JSON string
    pub is_favorite: bool,
    pub pinned_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// 角色结构
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub avatar: Option<String>,
    pub description: Option<String>,
    pub temperature: f64,
    pub system_prompt: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

// 模型分组结构
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ModelGroup {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

// 模型结构
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Model {
    pub id: String,
    pub group_id: String,
    pub name: String,
    pub model_id: String,
    pub enabled: bool,
    pub description: Option<String>,
    pub api_params: Option<String>, // JSON string
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

// 知识库集合
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeCollection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub embedding_model: String,
    pub vector_dimensions: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl KnowledgeCollection {
    pub fn new(name: String, embedding_model: String, vector_dimensions: i32) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description: None,
            embedding_model,
            vector_dimensions,
            created_at: now,
            updated_at: now,
        }
    }
}

// 知识库文档
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeDocument {
    pub id: String,
    pub collection_id: String,
    pub title: String,
    pub content: String,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub metadata: Option<String>,
    pub chunk_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl KnowledgeDocument {
    pub fn new(
        collection_id: String,
        title: String,
        content: String,
        file_name: Option<String>,
        file_size: Option<i64>,
        mime_type: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            collection_id,
            title,
            content,
            file_name,
            file_size,
            mime_type,
            metadata: None,
            chunk_count: 0,
            created_at: now,
            updated_at: now,
        }
    }
}

// 文档分块
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct KnowledgeChunk {
    pub id: String,
    pub document_id: String,
    pub chunk_index: i32,
    pub chunk_text: String,
    pub token_count: i32,
    pub created_at: DateTime<Utc>,
}

impl KnowledgeChunk {
    pub fn new(document_id: String, chunk_index: i32, chunk_text: String, token_count: i32) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            document_id,
            chunk_index,
            chunk_text,
            token_count,
            created_at: Utc::now(),
        }
    }
}

// 向量嵌入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorEmbedding {
    pub chunk_id: String,
    pub collection_id: String,
    pub embedding: Vec<f32>,
    pub created_at: DateTime<Utc>,
}

impl VectorEmbedding {
    pub fn new(chunk_id: String, collection_id: String, embedding: Vec<f32>) -> Self {
        Self {
            chunk_id,
            collection_id,
            embedding,
            created_at: Utc::now(),
        }
    }
}

// 搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub chunk_id: String,
    pub chunk_text: String,
    pub document_id: String,
    pub document_title: String,
    pub file_name: Option<String>,
    pub similarity: f32,
    pub score: f32,
}

// 嵌入模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingModel {
    pub id: String,
    pub name: String,
    pub model_id: String,
    pub dimensions: i32,
    pub language: String,
    pub enabled: bool,
    pub max_tokens: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl EmbeddingModel {
    pub fn new(
        name: String,
        model_id: String,
        dimensions: i32,
        language: String,
        max_tokens: i32,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            model_id,
            dimensions,
            language,
            enabled: true,
            max_tokens,
            created_at: now,
            updated_at: now,
        }
    }
}

// 搜索请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub collection_id: Option<String>,
    pub limit: Option<usize>,
    pub threshold: Option<f32>,
    pub embedding_model: Option<String>,
    pub api_key: String, // 改为必选参数
}

// 搜索响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total_count: usize,
    pub query_time_ms: u64,
    pub collection_id: String,
    pub embedding_model: String,
}

// 文档处理请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentProcessRequest {
    pub document_id: Option<String>, // 新增：现有文档ID，如果提供则不创建新文档
    pub collection_id: String,
    pub title: String,
    pub content: String,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
    pub chunk_size: Option<usize>,
    pub chunk_overlap: Option<usize>,
}

// 文档处理响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentProcessResponse {
    pub document_id: String,
    pub chunks_count: usize,
    pub vectors_count: usize,
    pub processing_time_ms: u64,
}

// 数据库健康状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseHealth {
    pub main_db: bool,
    pub knowledge_db: bool,
    pub vec_extension: bool,
    pub cache_stats: (usize, usize),
}

// 系统配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    pub default_collection: String,
    pub chunk_size: usize,
    pub chunk_overlap: usize,
    pub search_limit: usize,
    pub similarity_threshold: f32,
    pub cache_ttl: usize,
}

impl Default for SystemConfig {
    fn default() -> Self {
        Self {
            default_collection: "default".to_string(),
            chunk_size: 500,
            chunk_overlap: 50,
            search_limit: 10,
            similarity_threshold: 0.7,
            cache_ttl: 3600,
        }
    }
}

// 错误类型
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Database connection error: {0}")]
    ConnectionError(String),

    #[error("Query execution error: {0}")]
    QueryError(String),

    #[error("Vector operation error: {0}")]
    VectorError(String),

    #[error("Document processing error: {0}")]
    DocumentError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Not found: {0}")]
    NotFound(String),
}

impl From<sqlx::Error> for DatabaseError {
    fn from(err: sqlx::Error) -> Self {
        DatabaseError::QueryError(err.to_string())
    }
}

impl From<anyhow::Error> for DatabaseError {
    fn from(err: anyhow::Error) -> Self {
        DatabaseError::QueryError(err.to_string())
    }
}

// 批量操作请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOperation {
    pub operation_type: String,
    pub items: Vec<serde_json::Value>,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

// 批量操作响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOperationResponse {
    pub success_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
    pub operation_time_ms: u64,
}

// 集合统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionStats {
    pub collection_id: String,
    pub collection_name: String,
    pub documents_count: usize,
    pub chunks_count: usize,
    pub vectors_count: usize,
    pub total_size_bytes: usize,
    pub created_at: DateTime<Utc>,
    pub last_updated: DateTime<Utc>,
}

// 搜索历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistory {
    pub id: String,
    pub query_text: String,
    pub collection_id: Option<String>,
    pub results_count: usize,
    pub execution_time_ms: u64,
    pub created_at: DateTime<Utc>,
}

// 系统状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub database_health: DatabaseHealth,
    pub collections_count: usize,
    pub total_documents: usize,
    pub total_vectors: usize,
    pub uptime_seconds: u64,
    pub memory_usage_mb: usize,
    pub cache_stats: (usize, usize),
}

// 导出/导入请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub collection_id: Option<String>,
    pub include_vectors: bool,
    pub format: String, // "json", "csv", "parquet"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRequest {
    pub collection_id: String,
    pub data: Vec<serde_json::Value>,
    pub format: String,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

// 导出/导入响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResponse {
    pub exported_count: usize,
    pub file_size_bytes: usize,
    pub export_time_ms: u64,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResponse {
    pub imported_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
    pub import_time_ms: u64,
}
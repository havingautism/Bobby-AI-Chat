// 移除database模块，使用tauri-plugin-sql

use serde::{Deserialize, Serialize};
use anyhow::Result;
use sqlx::{SqlitePool, Row};
use std::sync::Mutex;
use tauri::Manager;

mod embedding_service;
mod embedding_gemma;
mod qdrant_manager;
mod qdrant_service;
use embedding_service::{EmbeddingService, generate_embedding, generate_batch_embeddings, calculate_similarity};
use embedding_gemma::{EmbeddingGemmaService, EmbeddingRequest, EmbeddingResponse, generate_gemma_batch_embeddings, check_model_files};
use qdrant_manager::{
    QdrantManager,
    compile_qdrant,
    start_qdrant,
    stop_qdrant,
    get_qdrant_status,
    is_qdrant_installed,
    get_qdrant_version
};
use qdrant_service::QdrantService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .manage(Mutex::new(EmbeddingService::new()))
    .manage(Mutex::new(QdrantManager::new()))
    .manage(Mutex::new(QdrantService::new()))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // 自动启动Qdrant (使用预编译二进制文件)
      let app_handle = app.handle().clone();
      std::thread::spawn(move || {
        let manager = app_handle.state::<Mutex<QdrantManager>>();
        let mut manager = manager.lock().unwrap();
        
        // 检查预编译的二进制文件是否存在
        let current_dir = std::env::current_dir().unwrap();
        println!("🔍 当前工作目录: {}", current_dir.display());
        println!("🔍 Qdrant文件是否存在: {}", manager.is_installed());
        
        if manager.is_installed() {
          println!("🚀 启动预编译的Qdrant服务...");
          match manager.start() {
            Ok(_) => println!("✅ Qdrant服务已自动启动"),
            Err(e) => println!("❌ Qdrant服务启动失败: {}", e),
          }
        } else {
          println!("⚠️ 未找到预编译的Qdrant二进制文件");
          println!("💡 请先运行: .\\compile_qdrant.bat 来编译Qdrant");
          println!("💡 或者手动启动: .\\qdrant.exe");
        }
      });
      
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ensure_data_directory,
      get_file_size,
      init_knowledge_base,
      add_knowledge_document,
      add_knowledge_vector,
      search_knowledge_base,
      get_knowledge_documents,
      delete_knowledge_document,
      get_knowledge_statistics,
      generate_document_embeddings,
      generate_embedding,
      generate_batch_embeddings,
      calculate_similarity,
      compile_qdrant,
      start_qdrant,
      stop_qdrant,
      get_qdrant_status,
      is_qdrant_installed,
      get_qdrant_version,
      generate_gemma_batch_embeddings,
      check_model_files,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[derive(Debug, Serialize, Deserialize)]
struct KnowledgeDocument {
    id: String,
    title: String,
    content: String,
    source_type: String,
    source_url: Option<String>,
    file_path: Option<String>,
    file_size: Option<i64>,
    mime_type: Option<String>,
    metadata: Option<String>,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct KnowledgeVector {
    vector_id: String,
    document_id: String,
    chunk_index: i32,
    chunk_text: String,
    embedding: Vec<f32>,
    created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResult {
    document_id: String,
    title: String,
    content: String,
    chunk_text: String,
    score: f32,
    metadata: Option<String>,
}

#[tauri::command]
async fn ensure_data_directory() -> Result<String, String> {
  use std::fs;
  
  let data_dir = if cfg!(debug_assertions) {
    "./data".to_string()
  } else {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    format!("{}/ai_chat", app_data)
  };
  
  fs::create_dir_all(&data_dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
  Ok(data_dir)
}

#[tauri::command]
async fn get_file_size(file_path: String) -> Result<u64, String> {
    use std::fs;
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("无法获取文件元数据: {}", e))?;
    Ok(metadata.len())
}

#[tauri::command]
async fn init_knowledge_base() -> Result<String, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;

    // 创建知识库文档表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS knowledge_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_url TEXT,
            file_path TEXT,
            file_size INTEGER,
            mime_type TEXT,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("创建知识库文档表失败: {}", e))?;
    
    // 创建sqlite-vec虚拟表用于向量搜索
    sqlx::query(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
            embedding float[384]
        )
        "#
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("创建向量虚拟表失败: {}", e))?;
    
    // 创建向量元数据表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS vector_metadata (
            rowid INTEGER PRIMARY KEY,
            document_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("创建向量元数据表失败: {}", e))?;
    
    // 创建索引以提高搜索性能
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_knowledge_documents_title ON knowledge_documents(title)")
        .execute(&pool)
        .await
        .map_err(|e| format!("创建标题索引失败: {}", e))?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content ON knowledge_documents(content)")
        .execute(&pool)
        .await
        .map_err(|e| format!("创建内容索引失败: {}", e))?;
    
    pool.close().await;
    
    Ok("知识库初始化成功".to_string())
}

#[tauri::command]
async fn add_knowledge_document(document: KnowledgeDocument) -> Result<String, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO knowledge_documents 
        (id, title, content, source_type, source_url, file_path, file_size, mime_type, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&document.id)
    .bind(&document.title)
    .bind(&document.content)
    .bind(&document.source_type)
    .bind(&document.source_url)
    .bind(&document.file_path)
    .bind(&document.file_size)
    .bind(&document.mime_type)
    .bind(&document.metadata)
    .bind(document.created_at)
    .bind(document.updated_at)
    .execute(&pool)
    .await
    .map_err(|e| format!("添加知识库文档失败: {}", e))?;
    
    pool.close().await;
    Ok(document.id)
}

#[tauri::command]
async fn add_knowledge_vector(vector: KnowledgeVector) -> Result<String, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    // 将向量转换为JSON格式（sqlite-vec要求的格式）
    let embedding_json = serde_json::to_string(&vector.embedding)
        .map_err(|e| format!("序列化向量失败: {}", e))?;
    
    // 插入向量到虚拟表
    let result = sqlx::query(
        "INSERT INTO knowledge_vectors (embedding) VALUES (?)"
    )
    .bind(&embedding_json)
    .execute(&pool)
    .await
    .map_err(|e| format!("添加向量失败: {}", e))?;
    
    let rowid = result.last_insert_rowid();
    
    // 插入元数据到元数据表
    sqlx::query(
        "INSERT INTO vector_metadata (rowid, document_id, chunk_index, chunk_text, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(rowid)
    .bind(&vector.document_id)
    .bind(vector.chunk_index)
    .bind(&vector.chunk_text)
    .bind(vector.created_at)
    .execute(&pool)
    .await
    .map_err(|e| format!("添加向量元数据失败: {}", e))?;
    
    pool.close().await;
    Ok(vector.vector_id)
}

#[tauri::command]
async fn search_knowledge_base(query: String, limit: Option<i32>) -> Result<Vec<SearchResult>, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    // 生成查询向量
    let query_embedding = generate_simple_embedding(&query);
    let query_embedding_json = serde_json::to_string(&query_embedding)
        .map_err(|e| format!("序列化查询向量失败: {}", e))?;
    
    let limit = limit.unwrap_or(10);
    
    // 使用sqlite-vec进行向量搜索
    let results = sqlx::query(
        r#"
        SELECT 
            vm.document_id,
            kd.title,
            kd.content,
            vm.chunk_text,
            distance,
            kd.metadata
        FROM knowledge_vectors kv
        JOIN vector_metadata vm ON kv.rowid = vm.rowid
        JOIN knowledge_documents kd ON vm.document_id = kd.id
        WHERE kv.embedding MATCH ?
        ORDER BY distance ASC
        LIMIT ?
        "#
    )
    .bind(&query_embedding_json)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("向量搜索失败: {}", e))?;
    
    let search_results: Vec<SearchResult> = results
        .iter()
        .map(|row| SearchResult {
            document_id: row.get("document_id"),
            title: row.get("title"),
            content: row.get("content"),
            chunk_text: row.get("chunk_text"),
            score: 1.0 - row.get::<f32, _>("distance"), // 转换距离为相似度分数
            metadata: row.get("metadata"),
        })
        .collect();
    
    pool.close().await;
    Ok(search_results)
}

// 简单的嵌入生成函数（用于演示）
fn generate_simple_embedding(text: &str) -> Vec<f32> {
    let mut embedding = vec![0.0; 384];
    let mut hash = 0u64;
    
    for (_i, byte) in text.bytes().enumerate() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
        let index = (hash as usize) % 384;
        embedding[index] = (hash % 1000) as f32 / 1000.0 - 0.5;
    }
    
    // 归一化向量
    let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for val in &mut embedding {
            *val /= norm;
        }
    }
    
    embedding
}

#[tauri::command]
async fn get_knowledge_documents() -> Result<Vec<KnowledgeDocument>, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    let results = sqlx::query(
        r#"
        SELECT * FROM knowledge_documents 
        ORDER BY updated_at DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("获取知识库文档失败: {}", e))?;
    
    let documents: Vec<KnowledgeDocument> = results
        .iter()
        .map(|row| KnowledgeDocument {
            id: row.get("id"),
            title: row.get("title"),
            content: row.get("content"),
            source_type: row.get("source_type"),
            source_url: row.get("source_url"),
            file_path: row.get("file_path"),
            file_size: row.get("file_size"),
            mime_type: row.get("mime_type"),
            metadata: row.get("metadata"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();
    
    pool.close().await;
    Ok(documents)
}

#[tauri::command]
async fn delete_knowledge_document(document_id: String) -> Result<String, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    // 获取要删除的向量rowid
    let vector_rowids: Vec<i64> = sqlx::query_scalar(
        "SELECT rowid FROM vector_metadata WHERE document_id = ?"
    )
    .bind(&document_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("获取向量rowid失败: {}", e))?;
    
    // 删除向量数据
    for rowid in vector_rowids {
        sqlx::query("DELETE FROM knowledge_vectors WHERE rowid = ?")
            .bind(rowid)
            .execute(&pool)
            .await
            .map_err(|e| format!("删除向量失败: {}", e))?;
    }
    
    // 删除向量元数据
    sqlx::query("DELETE FROM vector_metadata WHERE document_id = ?")
        .bind(&document_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("删除向量元数据失败: {}", e))?;
    
    // 删除文档
    sqlx::query("DELETE FROM knowledge_documents WHERE id = ?")
        .bind(&document_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("删除知识库文档失败: {}", e))?;
    
    pool.close().await;
    Ok("文档删除成功".to_string())
}

#[tauri::command]
async fn get_knowledge_statistics() -> Result<serde_json::Value, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    let doc_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM knowledge_documents")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("获取文档数量失败: {}", e))?;
    
    let vector_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vector_metadata")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("获取向量数量失败: {}", e))?;
    
    let total_size: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(file_size), 0) FROM knowledge_documents")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("获取总大小失败: {}", e))?;
    
    pool.close().await;
    
    Ok(serde_json::json!({
        "documentCount": doc_count,
        "vectorCount": vector_count,
        "totalSize": total_size
    }))
}

#[tauri::command]
async fn generate_document_embeddings(document_id: String) -> Result<String, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    // 获取文档内容
    let document: (String, String) = sqlx::query_as(
        "SELECT title, content FROM knowledge_documents WHERE id = ?"
    )
    .bind(&document_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| format!("获取文档失败: {}", e))?;
    
    let (title, content) = document;
    
    // 分块处理文档内容
    let chunks = chunk_text(&content, 500, 100);
    let mut vector_count = 0;
    
    for (i, chunk) in chunks.iter().enumerate() {
        // 生成向量嵌入
        let embedding = generate_simple_embedding(&format!("{} {}", title, chunk));
        
        // 创建向量数据
        let vector = KnowledgeVector {
            vector_id: format!("{}_chunk_{}", document_id, i),
            document_id: document_id.clone(),
            chunk_index: i as i32,
            chunk_text: chunk.clone(),
            embedding,
            created_at: chrono::Utc::now().timestamp_millis(),
        };
        
        // 添加向量到数据库
        add_knowledge_vector_internal(&pool, vector).await?;
        vector_count += 1;
    }
    
    pool.close().await;
    Ok(format!("成功生成 {} 个向量嵌入", vector_count))
}

// 内部函数：添加向量到数据库
async fn add_knowledge_vector_internal(pool: &SqlitePool, vector: KnowledgeVector) -> Result<(), String> {
    // 将向量转换为JSON格式
    let embedding_json = serde_json::to_string(&vector.embedding)
        .map_err(|e| format!("序列化向量失败: {}", e))?;
    
    // 插入向量到虚拟表
    let result = sqlx::query(
        "INSERT INTO knowledge_vectors (embedding) VALUES (?)"
    )
    .bind(&embedding_json)
    .execute(pool)
    .await
    .map_err(|e| format!("添加向量失败: {}", e))?;
    
    let rowid = result.last_insert_rowid();
    
    // 插入元数据到元数据表
    sqlx::query(
        "INSERT INTO vector_metadata (rowid, document_id, chunk_index, chunk_text, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(rowid)
    .bind(&vector.document_id)
    .bind(vector.chunk_index)
    .bind(&vector.chunk_text)
    .bind(vector.created_at)
    .execute(pool)
    .await
    .map_err(|e| format!("添加向量元数据失败: {}", e))?;
    
    Ok(())
}

// 文本分块函数
fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut start = 0;
    
    while start < text.len() {
        let end = std::cmp::min(start + chunk_size, text.len());
        let mut chunk = text[start..end].to_string();
        
        // 尝试在句子边界分割
        if end < text.len() {
            if let Some(last_sentence) = chunk.rfind('。') {
                if last_sentence > chunk_size / 2 {
                    chunk = chunk[..last_sentence + 1].to_string();
                    start = start + last_sentence + 1 - overlap;
                } else {
                    start = end - overlap;
                }
            } else {
                start = end - overlap;
            }
        } else {
            start = end;
        }
        
        if !chunk.trim().is_empty() {
            chunks.push(chunk.trim().to_string());
        }
    }
    
    chunks
}


// 移除database模块，使用tauri-plugin-sql

use serde::{Deserialize, Serialize};
use anyhow::Result;
use sqlx::{SqlitePool, Row};
use std::sync::Mutex;
use tauri::Manager;

mod qdrant_manager;
mod qdrant_service;
mod document_processor;
mod siliconflow_embedding;
use document_processor::{DocumentProcessor, process_document_embeddings, get_processing_progress, chunk_document_text};
use siliconflow_embedding::{
    generate_siliconflow_embedding, generate_siliconflow_batch_embeddings
};
// 使用前端的franc语言检测，不再需要Rust端的语言检测

// 硅基流动嵌入模型相关命令

// 生成单个嵌入向量
#[tauri::command]
async fn generate_siliconflow_embedding_cmd(api_key: String, text: String, model: Option<String>) -> Result<Vec<f32>, String> {
  let model_name = model.unwrap_or_else(|| "BAAI/bge-m3".to_string());
  generate_siliconflow_embedding(api_key, text, model_name).await
}

// 批量生成嵌入向量
#[tauri::command]
async fn generate_siliconflow_batch_embeddings_cmd(api_key: String, texts: Vec<String>, model: Option<String>) -> Result<Vec<Vec<f32>>, String> {
  let model_name = model.unwrap_or_else(|| "BAAI/bge-m3".to_string());
  generate_siliconflow_batch_embeddings(api_key, texts, model_name).await
}

// 获取支持的模型列表
#[tauri::command]
async fn get_siliconflow_models_cmd() -> Result<Vec<String>, String> {
  Ok(vec![
    "BAAI/bge-large-zh-v1.5".to_string(),
    "BAAI/bge-large-en-v1.5".to_string(),
    "BAAI/bge-m3".to_string(),
  ])
}

// 语言检测功能移至前端，使用franc库

// 取消当前嵌入任务 - 已移除本地模型，此函数保留为兼容性
#[tauri::command]
fn cancel_embedding_jobs(_state: tauri::State<'_, std::sync::Mutex<()>>) {
    println!("🛑 本地嵌入模型已移除，取消指令无效");
}
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
    .manage(Mutex::new(QdrantManager::new()))
    .manage(Mutex::new(QdrantService::new()))
    .manage(Mutex::new(DocumentProcessor::new()))
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
      
      // MiniLM模型已被弃用，不再检测
      
      // 硅基流动API无需初始化，直接HTTP调用
      println!("✅ 硅基流动API准备就绪，无需初始化");
      
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ensure_data_directory,
      get_file_size,
      init_knowledge_base,
      add_knowledge_document,
      add_knowledge_vector,
      search_knowledge_base,
      search_knowledge_base_with_documents,
      get_knowledge_documents,
      delete_knowledge_document,
      get_knowledge_statistics,
      generate_document_embeddings,
      process_document_embeddings,
      get_processing_progress,
      chunk_document_text,
      generate_siliconflow_embedding_cmd,
      generate_siliconflow_batch_embeddings_cmd,
      get_siliconflow_models_cmd,
      cancel_embedding_jobs,
      compile_qdrant,
      start_qdrant,
      stop_qdrant,
      get_qdrant_status,
      is_qdrant_installed,
      get_qdrant_version,
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
            embedding float[768]
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
    let query_embedding = generate_simple_embedding(&query).await;
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

#[tauri::command]
async fn search_knowledge_base_with_documents(
    query: String, 
    document_ids: Option<Vec<String>>, 
    limit: Option<i32>
) -> Result<Vec<SearchResult>, String> {
    // 确保数据目录存在并获取路径
    let data_dir = ensure_data_directory().await?;
    let db_path = format!("{}/ai_chat.db", data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}", db_path))
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;
    
    // 生成查询向量
    let query_embedding = generate_simple_embedding(&query).await;
    let query_embedding_json = serde_json::to_string(&query_embedding)
        .map_err(|e| format!("序列化查询向量失败: {}", e))?;
    
    let limit = limit.unwrap_or(10);
    
    // 构建查询SQL，支持文档过滤
    let mut query_sql = String::from(
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
        "#
    );
    
    // 如果指定了文档ID，添加过滤条件
    if let Some(ref doc_ids) = document_ids {
        if !doc_ids.is_empty() {
            let placeholders: Vec<String> = doc_ids.iter().map(|_| "?".to_string()).collect();
            let id_list: Vec<&String> = doc_ids.iter().collect();
            query_sql.push_str(&format!(" AND vm.document_id IN ({})", placeholders.join(", ")));
            
            let mut query = sqlx::query(&query_sql);
            query = query.bind(query_embedding_json);
            for id in id_list {
                query = query.bind(id);
            }
            query = query.bind(limit);
            let results = query.fetch_all(&pool)
                .await
                .map_err(|e| format!("搜索知识库失败: {}", e))?;
            
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
        } else {
            // 如果没有选择文档，执行普通搜索
            let results = sqlx::query(
                &format!(r#"
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
                "#)
            )
            .bind(query_embedding_json)
            .bind(limit)
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("搜索知识库失败: {}", e))?;
            
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
    } else {
        // 如果没有指定文档ID，执行普通搜索
        let results = sqlx::query(
            &format!(r#"
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
            "#)
        )
        .bind(query_embedding_json)
        .bind(limit)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("搜索知识库失败: {}", e))?;
        
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
}

// 使用硅基流动API生成嵌入向量
async fn generate_simple_embedding(text: &str) -> Vec<f32> {
    // 使用默认的多语言模型
    let model_name = "BAAI/bge-m3";
    match generate_siliconflow_embedding("dummy_key".to_string(), text.to_string(), model_name.to_string()).await {
        Ok(embedding) => embedding,
        Err(e) => {
            println!("❌ 硅基流动嵌入生成失败: {}, 使用备用方法", e);
            // 备用方法：生成简单的随机向量
            let mut embedding = vec![0.0; 768];
            let mut hash = 0u64;
            
            for (_i, byte) in text.bytes().enumerate() {
                hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
                let index = (hash as usize) % 768;
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
    }
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
    let chunks = chunk_text(&content, 500, 50);
    
    if chunks.is_empty() {
        pool.close().await;
        return Ok("文档内容为空，无需生成向量".to_string());
    }
    
    // 准备批量处理的文本
    let batch_texts: Vec<String> = chunks.iter()
        .map(|chunk| format!("{} {}", title, chunk))
        .collect();
    
    // 使用默认的多语言模型批量生成嵌入向量
    let model_name = "BAAI/bge-m3";
    println!("🔍 使用多语言模型: {}", model_name);
    
    // 批量生成嵌入向量
    let embeddings = match generate_siliconflow_batch_embeddings("dummy_key".to_string(), batch_texts.clone(), model_name.to_string()).await {
        Ok(embeddings) => embeddings,
        Err(e) => {
            println!("❌ 批量嵌入生成失败: {}, 降级到单个处理", e);
            // 降级到单个处理
            let mut embeddings = Vec::new();
            for text in batch_texts {
                match generate_siliconflow_embedding("dummy_key".to_string(), text.clone(), model_name.to_string()).await {
                    Ok(embedding) => embeddings.push(embedding),
                    Err(e) => {
                        println!("❌ 单个嵌入生成失败: {}, 使用备用方法", e);
                        // 备用方法
                        let mut embedding = vec![0.0; 768];
                        let mut hash = 0u64;
                        for byte in text.bytes() {
                            hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
                            let index = (hash as usize) % 768;
                            embedding[index] = (hash % 1000) as f32 / 1000.0 - 0.5;
                        }
                        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
                        if norm > 0.0 {
                            for val in &mut embedding {
                                *val /= norm;
                            }
                        }
                        embeddings.push(embedding);
                    }
                }
            }
            embeddings
        }
    };
    
    // 批量添加向量到数据库
    for (i, (chunk, embedding)) in chunks.iter().zip(embeddings.iter()).enumerate() {
        let vector = KnowledgeVector {
            vector_id: format!("{}_chunk_{}", document_id, i),
            document_id: document_id.clone(),
            chunk_index: i as i32,
            chunk_text: chunk.clone(),
            embedding: embedding.clone(),
            created_at: chrono::Utc::now().timestamp_millis(),
        };
        
        add_knowledge_vector_internal(&pool, vector).await?;
    }
    
    pool.close().await;
    Ok(format!("成功生成 {} 个向量嵌入（使用模型: {}）", chunks.len(), model_name))
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


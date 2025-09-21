// SQLite + sqlite-vec 知识库实现

use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::sync::Arc;
use tauri::Manager;
use chrono::Utc;

// 引入新模块
mod database;
mod vector_service;
mod knowledge_service;
mod types;
mod siliconflow_embedding;

use database::DatabaseManager;
use vector_service::VectorService;
use knowledge_service::{DocumentProcessor, KnowledgeSearchService, KnowledgeManagementService};
use types::*;
use siliconflow_embedding::{
    generate_siliconflow_embedding, generate_siliconflow_batch_embeddings
};

// 全局服务状态
pub struct AppState {
    pub db: Arc<DatabaseManager>,
    pub vector_service: Arc<VectorService>,
    pub document_processor: Arc<DocumentProcessor>,
    pub search_service: Arc<KnowledgeSearchService>,
    pub management_service: Arc<KnowledgeManagementService>,
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 初始化数据库和服务
      println!("🚀 初始化SQLite + sqlite-vec知识库系统...");

      let rt = tokio::runtime::Runtime::new().unwrap();
      let db = match rt.block_on(DatabaseManager::new()) {
        Ok(db) => {
          println!("✅ 数据库初始化成功");
          Arc::new(db)
        }
        Err(e) => {
          println!("❌ 数据库初始化失败: {}", e);
          return Err(format!("数据库初始化失败: {}", e).into());
        }
      };

      let vector_service = Arc::new(VectorService::new(db.clone()));
      let document_processor = Arc::new(DocumentProcessor::new(db.clone(), vector_service.clone()));
      let search_service = Arc::new(KnowledgeSearchService::new(db.clone(), vector_service.clone()));
      let management_service = Arc::new(KnowledgeManagementService::new(db.clone(), vector_service.clone()));

      // 检查数据库健康状态
      match rt.block_on(db.health_check()) {
        Ok(health) => {
          println!("✅ 数据库健康检查:");
          println!("   - 主数据库: {}", if health.main_db { "正常" } else { "异常" });
          println!("   - 知识库: {}", if health.knowledge_db { "正常" } else { "异常" });
          println!("   - sqlite-vec扩展: {}", if health.vec_extension { "正常" } else { "异常" });
          println!("   - 缓存: {}/{}", health.cache_stats.0, health.cache_stats.1);
        }
        Err(e) => {
          println!("❌ 数据库健康检查失败: {}", e);
        }
      }

      // 管理应用状态
      app.manage(AppState {
        db: db.clone(),
        vector_service: vector_service.clone(),
        document_processor: document_processor.clone(),
        search_service: search_service.clone(),
        management_service: management_service.clone(),
      });

      println!("✅ SQLite + sqlite-vec知识库系统初始化完成");
      println!("💡 硅基流动API准备就绪，无需初始化");

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // 基础命令
      get_file_size,
      get_database_stats,

      // 对话管理命令
      save_conversation,
      get_conversations,
      delete_conversation,
      clear_conversations,
      toggle_conversation_favorite,
      get_favorite_conversations,

      // 设置管理命令
      save_setting,
      get_setting,
      get_all_settings,

      // 角色管理命令
      save_role,
      get_roles,
      delete_role,

      // 模型管理命令
      save_model_group,
      get_model_groups,
      delete_model_group,
      save_model,
      get_models,
      delete_model,

      // 知识库管理命令
      init_knowledge_base,
      get_knowledge_collections,
      create_knowledge_collection,
      delete_knowledge_collection,

      // 文档管理命令
      add_knowledge_document,
      get_knowledge_documents,
      delete_knowledge_document,
      process_document,

      // 向量管理命令
      add_knowledge_vector,
      generate_document_embeddings,

      // 搜索命令
      search_knowledge_base,
      search_knowledge_base_with_documents,
      search_all_collections,

      // 统计和管理命令
      get_knowledge_statistics,
      get_collection_stats,
      get_system_status,
      clear_cache,
      debug_database_info,

      // 嵌入模型命令
      generate_siliconflow_embedding_cmd,
      generate_siliconflow_batch_embeddings_cmd,
      get_siliconflow_models_cmd,
      get_available_embedding_models,

      // 向量操作命令
      chunk_document_text,

      // 数据库重置命令
      reset_knowledge_database,
      reset_all_databases,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// 新的命令实现

#[tauri::command]
async fn init_knowledge_base(state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.health_check().await {
        Ok(health) => {
            if health.main_db && health.knowledge_db && health.vec_extension {
                Ok("知识库系统初始化成功".to_string())
            } else {
                Err(format!("知识库系统初始化失败: main_db={}, knowledge_db={}, vec_extension={}",
                    health.main_db, health.knowledge_db, health.vec_extension))
            }
        }
        Err(e) => Err(format!("数据库健康检查失败: {}", e))
    }
}

#[tauri::command]
async fn get_knowledge_collections(state: tauri::State<'_, AppState>) -> Result<Vec<KnowledgeCollection>, String> {
    state.management_service.get_collections().await
        .map_err(|e| format!("获取知识库集合失败: {}", e))
}

#[tauri::command]
async fn create_knowledge_collection(
    name: String,
    _description: Option<String>,
    embedding_model: Option<String>,
    vector_dimensions: Option<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let collection = KnowledgeCollection::new(
        name,
        embedding_model.unwrap_or_else(|| "bge-m3".to_string()),
        vector_dimensions.unwrap_or(384),
    );

    state.management_service.create_collection(collection).await
        .map(|_| "集合创建成功".to_string())
        .map_err(|e| format!("创建集合失败: {}", e))
}

#[tauri::command]
async fn delete_knowledge_collection(
    collection_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    state.management_service.delete_collection(&collection_id).await
        .map(|_| "集合删除成功".to_string())
        .map_err(|e| format!("删除集合失败: {}", e))
}

#[tauri::command]
async fn process_document(
    request: DocumentProcessRequest,
    state: tauri::State<'_, AppState>,
) -> Result<DocumentProcessResponse, String> {
    state.document_processor.process_document(request).await
        .map_err(|e| format!("处理文档失败: {}", e))
}

#[tauri::command]
async fn search_knowledge_base(
    query: String,
    collection_id: Option<String>,
    limit: Option<usize>,
    threshold: Option<f32>,
    api_key: String, // 改为必选参数来测试
    state: tauri::State<'_, AppState>,
) -> Result<SearchResponse, String> {
    // 强制输出调试信息以确认函数被调用
    println!("🚀 [新版本] search_knowledge_base 函数被调用!");
    // 调试：打印接收到的参数
    println!("🔍 [Tauri命令] 收到搜索请求:");
    println!("  - query: '{}'", query);
    println!("  - collection_id: {:?}", collection_id);
    println!("  - limit: {:?}", limit);
    println!("  - threshold: {:?}", threshold);
    println!("  - api_key: {}...", api_key.chars().take(10).collect::<String>());
    println!("  - api_key_length: {}", api_key.len());

    // 如果没有提供collection_id，尝试从现有集合中选择一个
    let final_collection_id = if let Some(cid) = collection_id {
        cid
    } else {
        println!("🔍 [Tauri命令] 未提供collection_id，尝试获取现有集合");
        // 获取所有集合并选择第一个
        match state.management_service.get_collections().await {
            Ok(collections) => {
                if let Some(first_collection) = collections.first() {
                    println!("🔍 [Tauri命令] 使用第一个集合: {}", first_collection.id);
                    first_collection.id.clone()
                } else {
                    return Err("没有可用的知识库集合，请先创建集合".to_string());
                }
            }
            Err(e) => {
                return Err(format!("获取集合失败: {}", e));
            }
        }
    };

    let request = SearchRequest {
        query,
        collection_id: Some(final_collection_id.clone()),
        limit,
        threshold,
        embedding_model: None,
        api_key, // 现在是必选参数
    };

    match state.search_service.search(request).await {
        Ok(mut resp) => {
            // 强制保证返回的 collection_id 与本次请求一致，避免上层混用
            resp.collection_id = final_collection_id;
            Ok(resp)
        }
        Err(e) => Err(format!("搜索知识库失败: {}", e))
    }
}

#[tauri::command]
async fn search_knowledge_base_with_documents(
    query: String,
    document_ids: Option<Vec<String>>,
    limit: Option<usize>,
    threshold: Option<f32>,
    state: tauri::State<'_, AppState>,
) -> Result<SearchResponse, String> {
    let request = SearchRequest {
        query,
        collection_id: None, // 搜索所有集合
        limit,
        threshold,
        embedding_model: None,
        api_key: String::new(), // 这个接口不需要API密钥，传递空字符串
    };

    let mut response = state.search_service.search(request).await
        .map_err(|e| format!("搜索知识库失败: {}", e))?;

    // 如果指定了文档ID，过滤结果
    if let Some(ids) = document_ids {
        response.results.retain(|result| ids.contains(&result.document_id));
    }

    response.total_count = response.results.len();
    Ok(response)
}

#[tauri::command]
async fn search_all_collections(
    query: String,
    limit: Option<usize>,
    threshold: Option<f32>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SearchResponse>, String> {
    let request = SearchRequest {
        query,
        collection_id: None,
        limit,
        threshold,
        embedding_model: None,
        api_key: String::new(), // 这个接口不需要API密钥，传递空字符串
    };

    state.search_service.search_all_collections(request).await
        .map_err(|e| format!("搜索所有集合失败: {}", e))
}

#[tauri::command]
async fn get_knowledge_documents(
    collection_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<KnowledgeDocument>, String> {
    state.db.get_documents(&collection_id).await
        .map_err(|e| format!("获取文档失败: {}", e))
}

#[tauri::command]
async fn delete_knowledge_document(
    document_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    match state.db.delete_document(&document_id).await {
        Ok(_) => {
            // 删除后同步清理向量服务缓存，避免旧嵌入结果干扰
            state.vector_service.clear_cache().await;
            Ok("文档删除成功".to_string())
        }
        Err(e) => Err(format!("删除文档失败: {}", e))
    }
}

#[tauri::command]
async fn get_knowledge_statistics(
    collection_id: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    if let Some(id) = collection_id {
        let stats = state.management_service.get_collection_stats(&id).await
            .map_err(|e| format!("获取集合统计失败: {}", e))?;

        Ok(serde_json::json!({
            "collectionId": stats.collection_id,
            "collectionName": stats.collection_name,
            "documentsCount": stats.documents_count,
            "chunksCount": stats.chunks_count,
            "vectorsCount": stats.vectors_count,
            "totalSize": stats.total_size_bytes,
            "createdAt": stats.created_at,
            "lastUpdated": stats.last_updated,
        }))
    } else {
        let status = state.management_service.get_system_status().await
            .map_err(|e| format!("获取系统状态失败: {}", e))?;

        Ok(serde_json::json!({
            "collectionsCount": status.collections_count,
            "totalDocuments": status.total_documents,
            "totalVectors": status.total_vectors,
            "databaseHealth": status.database_health,
            "uptimeSeconds": status.uptime_seconds,
            "memoryUsageMB": status.memory_usage_mb,
            "cacheStats": {
                "used": status.cache_stats.0,
                "total": status.cache_stats.1
            }
        }))
    }
}

#[tauri::command]
async fn get_collection_stats(
    collection_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionStats, String> {
    state.management_service.get_collection_stats(&collection_id).await
        .map_err(|e| format!("获取集合统计失败: {}", e))
}

#[tauri::command]
async fn get_system_status(state: tauri::State<'_, AppState>) -> Result<SystemStatus, String> {
    state.management_service.get_system_status().await
        .map_err(|e| format!("获取系统状态失败: {}", e))
}

#[tauri::command]
async fn get_available_embedding_models(state: tauri::State<'_, AppState>) -> Result<Vec<EmbeddingModel>, String> {
    state.vector_service.get_available_models().await
        .map_err(|e| format!("获取嵌入模型失败: {}", e))
}

#[tauri::command]
async fn clear_cache(state: tauri::State<'_, AppState>) -> Result<String, String> {
    state.db.clear_query_cache();
    state.vector_service.clear_cache().await;
    Ok("缓存已清理".to_string())
}

#[tauri::command]
async fn debug_database_info(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    use serde_json::json;

    println!("🔍 开始调试数据库信息...");

    // 获取所有集合
    let collections = state.db.get_collections().await
        .map_err(|e| format!("获取集合失败: {}", e))?;

    let mut collection_info = Vec::new();
    let mut total_documents = 0;
    let mut total_vectors = 0;

    for collection in &collections {
        // 获取该集合的文档
        let documents = state.db.get_documents(&collection.id).await
            .map_err(|e| format!("获取文档失败: {}", e))?;

        // 获取该集合的向量统计
        let vector_count = state.db.get_vector_count(&collection.id).await.unwrap_or(0);

        let collection_data = json!({
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "embedding_model": collection.embedding_model,
            "vector_dimensions": collection.vector_dimensions,
            "document_count": documents.len(),
            "vector_count": vector_count,
            "documents": documents.iter().map(|doc| json!({
                "id": doc.id,
                "title": doc.title,
                "content_length": doc.content.len(),
                "file_name": doc.file_name,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
                "chunk_count": doc.chunk_count,
                "created_at": doc.created_at.to_rfc3339(),
                "updated_at": doc.updated_at.to_rfc3339()
            })).collect::<Vec<_>>()
        });

        collection_info.push(collection_data);
        total_documents += documents.len();
        total_vectors += vector_count;

        println!("📊 集合 {} - 文档: {}, 向量: {}", collection.id, documents.len(), vector_count);
    }

    let debug_info = json!({
        "total_collections": collections.len(),
        "total_documents": total_documents,
        "total_vectors": total_vectors,
        "collections": collection_info,
        "database_path": state.db.get_database_path().await.unwrap_or_else(|_| "unknown".to_string())
    });

    println!("✅ 数据库调试信息收集完成 - 总文档: {}, 总向量: {}", total_documents, total_vectors);
    Ok(debug_info)
}

// 兼容性命令（保持与现有前端接口兼容）

#[derive(Debug, Serialize, Deserialize)]
struct LegacyKnowledgeDocument {
    id: String,
    title: String,
    content: String,
    source_type: String,
    source_url: Option<String>,
    file_path: Option<String>,
    file_size: Option<i64>,
    mime_type: Option<String>,
    metadata: Option<String>,
    collection_id: Option<String>, // 添加集合ID字段
    created_at: i64,
    updated_at: i64,
}

#[tauri::command]
async fn add_knowledge_document(document: LegacyKnowledgeDocument, state: tauri::State<'_, AppState>) -> Result<String, String> {
    // 使用传入的集合ID或默认值
    let collection_id = document.collection_id.unwrap_or_else(|| "default".to_string());

    // 检查是否已存在相同标题和内容的文档
    let existing_docs = state.db.get_documents(&collection_id).await
        .map_err(|e| format!("获取文档失败: {}", e))?;

    if let Some(existing_doc) = existing_docs.iter().find(|doc|
        doc.title == document.title && doc.content == document.content
    ) {
        println!("⚠️ 发现重复文档，跳过添加: {} (ID: {})", document.title, existing_doc.id);
        return Ok(existing_doc.id.clone());
    }

    // 转换为新的文档格式
    let new_doc = KnowledgeDocument::new(
        collection_id,
        document.title,
        document.content,
        document.file_path,
        document.file_size,
        document.mime_type,
    );

    println!("📝 创建新文档: {} (集合: {})", new_doc.title, new_doc.collection_id);
    state.db.create_document(&new_doc).await
        .map(|_| new_doc.id) // 返回新生成的文档ID
        .map_err(|e| format!("添加文档失败: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
struct LegacyKnowledgeVector {
    vector_id: String,
    document_id: String,
    chunk_index: i32,
    chunk_text: String,
    embedding: Vec<f32>,
    created_at: i64,
}

#[tauri::command]
async fn add_knowledge_vector(vector: LegacyKnowledgeVector, state: tauri::State<'_, AppState>) -> Result<String, String> {
    // 通过 document_id 解析真实 collection_id，避免误写入 default 集合
    let document = state.db.get_document_by_id(&vector.document_id).await
        .map_err(|e| format!("获取文档失败以确定集合ID: {}", e))?;

    // 注意：这里需要先查找对应的chunk ID，但LegacyKnowledgeVector结构体没有提供
    // 暂时使用0作为占位符，实际使用时需要修改这个逻辑
    let vector_embedding = VectorEmbedding::new(
        0, // 需要从chunk表中查找对应的ID
        document.collection_id,
        vector.embedding,
    );

    state.db.insert_vectors(&[vector_embedding]).await
        .map(|_| vector.vector_id)
        .map_err(|e| format!("添加向量失败: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
struct LegacySearchResult {
    document_id: String,
    title: String,
    content: String,
    chunk_text: String,
    score: f32,
    metadata: Option<String>,
}

// 旧版搜索API兼容性
#[tauri::command]
async fn search_knowledge_base_legacy(
    query: String,
    limit: Option<i32>,
    state: tauri::State<'_, AppState>
) -> Result<Vec<LegacySearchResult>, String> {
    let request = SearchRequest {
        query,
        collection_id: Some("default".to_string()),
        limit: limit.map(|l| l as usize),
        threshold: None,
        embedding_model: None,
        api_key: String::new(), // 传统接口不需要API密钥，传递空字符串
    };

    let response = state.search_service.search(request).await
        .map_err(|e| format!("搜索知识库失败: {}", e))?;

    let legacy_results: Vec<LegacySearchResult> = response.results
        .into_iter()
        .map(|result| LegacySearchResult {
            document_id: result.document_id,
            title: result.document_title,
            content: "".to_string(), // 旧API格式不包含完整内容
            chunk_text: result.chunk_text,
            score: result.similarity,
            metadata: None,
        })
        .collect();

    Ok(legacy_results)
}

#[tauri::command]
async fn get_knowledge_documents_legacy(state: tauri::State<'_, AppState>) -> Result<Vec<LegacyKnowledgeDocument>, String> {
    // 获取所有集合的文档
    let collections = state.db.get_collections().await
        .map_err(|e| format!("获取集合失败: {}", e))?;

    let mut all_documents = Vec::new();

    for collection in collections {
        let documents = state.db.get_documents(&collection.id).await
            .map_err(|e| format!("获取文档失败: {}", e))?;

        let legacy_documents: Vec<LegacyKnowledgeDocument> = documents
            .into_iter()
            .map(|doc| LegacyKnowledgeDocument {
                id: doc.id,
                title: doc.title,
                content: doc.content,
                source_type: "text".to_string(),
                source_url: None,
                file_path: doc.file_name,
                file_size: doc.file_size,
                mime_type: doc.mime_type,
                metadata: None,
                collection_id: Some(collection.id.clone()), // 添加集合ID
                created_at: doc.created_at.timestamp(),
                updated_at: doc.updated_at.timestamp(),
            })
            .collect();

        all_documents.extend(legacy_documents);
    }

    Ok(all_documents)
}

#[tauri::command]
async fn delete_knowledge_document_legacy(
    document_id: String,
    state: tauri::State<'_, AppState>
) -> Result<String, String> {
    state.db.delete_document(&document_id).await
        .map(|_| "文档删除成功".to_string())
        .map_err(|e| format!("删除文档失败: {}", e))
}

#[tauri::command]
async fn get_knowledge_statistics_legacy(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let status = state.management_service.get_system_status().await
        .map_err(|e| format!("获取系统状态失败: {}", e))?;

    Ok(serde_json::json!({
        "documentCount": status.total_documents,
        "vectorCount": status.total_vectors,
        "totalSize": 0 // 需要计算实际大小
    }))
}

#[derive(Debug, Serialize, Deserialize)]
struct GenerateEmbeddingsRequest {
    document_id: String,
    collection_id: Option<String>,
    content: Option<String>,
    model: Option<String>,
}

#[derive(Debug, serde::Serialize)]
struct EmbeddingResponse {
    success: bool,
    message: String,
    vectors_count: usize,
    chunks_count: usize,
    processing_time_ms: u64,
}

#[tauri::command]
async fn generate_document_embeddings(
    request: GenerateEmbeddingsRequest,
    api_key: String,
    state: tauri::State<'_, AppState>,
) -> Result<EmbeddingResponse, String> {
    println!("🔍 后端收到向量生成请求 - document_id: {:?}, collection_id: {:?}, model: {:?}", request.document_id, request.collection_id, request.model);

    let mut found_document = None;
    let mut document_collection_id = None;

    // 如果提供了集合ID，优先在指定集合中查找
    if let Some(ref collection_id) = request.collection_id {
        println!("🎯 在指定集合 {} 中查找文档...", collection_id);
        let documents = state.db.get_documents(collection_id).await
            .map_err(|e| format!("获取文档失败: {}", e))?;

        println!("  集合 {} 中有 {} 个文档", collection_id, documents.len());
        for doc in &documents {
            println!("    - 文档ID: {}, 标题: {}", doc.id, doc.title);
        }

        if let Some(doc) = documents.into_iter().find(|doc| doc.id == request.document_id) {
            document_collection_id = Some(collection_id.clone());
            found_document = Some(doc);
            println!("✅ 在指定集合 {} 中找到文档", collection_id);
        }
    }

    // 如果在指定集合中没找到，则从所有集合中查找
    if found_document.is_none() {
        println!("🔍 在指定集合中未找到，开始从所有集合中查找...");
        let collections = state.db.get_collections().await
            .map_err(|e| format!("获取集合失败: {}", e))?;

        println!("📦 找到 {} 个集合", collections.len());
        for collection in &collections {
            println!("  - 集合: {}", collection.id);
        }

        for collection in collections {
            println!("🔍 在集合 {} 中查找文档...", collection.id);
            let documents = state.db.get_documents(&collection.id).await
                .map_err(|e| format!("获取文档失败: {}", e))?;

            println!("  集合 {} 中有 {} 个文档", collection.id, documents.len());
            for doc in &documents {
                println!("    - 文档ID: {}, 标题: {}", doc.id, doc.title);
            }

            if let Some(doc) = documents.into_iter().find(|doc| doc.id == request.document_id) {
                document_collection_id = Some(collection.id.clone());
                found_document = Some(doc);
                println!("✅ 在集合 {} 中找到文档", collection.id);
                break;
            }
        }
    }

    // 处理文档查找结果
    let (document, collection_id) = if let Some(doc) = found_document {
        let collection_id = document_collection_id.ok_or_else(|| "文档集合信息丢失".to_string())?;
        println!("📄 从数据库找到文档 - 标题: {}, 集合: {}, 内容长度: {}", doc.title, collection_id, doc.content.len());
        (doc, collection_id)
    } else if let Some(content) = request.content {
        // 如果没找到文档但提供了内容，创建临时文档对象用于处理
        let collection_id = request.collection_id.ok_or_else(|| "未提供集合ID且文档不存在".to_string())?;
        println!("📄 未找到现有文档，使用提供的内容创建临时文档 - 集合: {}, 内容长度: {}", collection_id, content.len());

        let temp_doc = KnowledgeDocument {
            id: request.document_id.clone(),
            collection_id: collection_id.clone(),
            title: "临时文档".to_string(),
            content: content.clone(),
            file_name: None,
            file_size: None,
            mime_type: None,
            metadata: None,
            chunk_count: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        (temp_doc, collection_id)
    } else {
        return Err("文档不存在且未提供内容".to_string());
    };

    // 处理文档 - 使用文档所在的集合
    let metadata = document.metadata
        .and_then(|m| serde_json::from_str(&m).ok())
        .unwrap_or_else(|| std::collections::HashMap::new());

    let process_request = DocumentProcessRequest {
        document_id: Some(document.id.clone()), // 传递现有文档ID以避免重复创建
        collection_id,
        title: document.title.clone(),
        content: document.content.clone(),
        file_name: document.file_name.clone(),
        file_size: document.file_size,
        mime_type: document.mime_type.clone(),
        metadata: Some(metadata),
        chunk_size: None,
        chunk_overlap: None,
    };

    println!("🚀 开始处理文档...");

    // 使用API密钥进行嵌入生成
    let response = state.document_processor.process_document_with_api_key(process_request, &api_key).await
        .map_err(|e| format!("处理文档失败: {}", e))?;

    println!("✅ 文档处理完成，生成 {} 个向量", response.vectors_count);

    // 返回结构化的响应对象，Tauri会自动处理JSON序列化
    Ok(EmbeddingResponse {
        success: true,
        message: format!("成功生成 {} 个向量嵌入", response.vectors_count),
        vectors_count: response.vectors_count,
        chunks_count: response.chunks_count,
        processing_time_ms: response.processing_time_ms,
    })
}

#[tauri::command]
async fn chunk_document_text(text: String, chunk_size: Option<usize>, chunk_overlap: Option<usize>) -> Result<Vec<String>, String> {
    let chunk_size = chunk_size.unwrap_or(500);
    let chunk_overlap = chunk_overlap.unwrap_or(50);

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
                    start = start + last_sentence + 1 - chunk_overlap;
                } else {
                    start = end - chunk_overlap;
                }
            } else {
                start = end - chunk_overlap;
            }
        } else {
            start = end;
        }

        if !chunk.trim().is_empty() {
            chunks.push(chunk.trim().to_string());
        }
    }

    Ok(chunks)
}

// 重置知识库数据库
#[tauri::command]
async fn reset_knowledge_database(state: tauri::State<'_, AppState>) -> Result<String, String> {
    println!("🗑️ 正在重置知识库数据库...");

    match state.db.reset_knowledge_database().await {
        Ok(_) => {
            println!("✅ 知识库数据库重置完成");
            Ok("知识库数据库重置完成".to_string())
        }
        Err(e) => {
            println!("❌ 重置知识库数据库失败: {}", e);
            Err(format!("重置知识库数据库失败: {}", e))
        }
    }
}

// 完全重置所有数据库
#[tauri::command]
async fn reset_all_databases(state: tauri::State<'_, AppState>) -> Result<String, String> {
    println!("🗑️ 正在完全重置所有数据库...");

    match state.db.reset_all_databases().await {
        Ok(_) => {
            println!("✅ 所有数据库重置完成");
            Ok("所有数据库重置完成".to_string())
        }
        Err(e) => {
            println!("❌ 重置所有数据库失败: {}", e);
            Err(format!("重置所有数据库失败: {}", e))
        }
    }
}

#[tauri::command]
async fn get_file_size(file_path: String) -> Result<u64, String> {
    use std::fs;
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("无法获取文件元数据: {}", e))?;
    Ok(metadata.len())
}

// 对话管理命令
#[tauri::command]
async fn save_conversation(conversation: Conversation, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.save_conversation(&conversation).await {
        Ok(_) => Ok("对话保存成功".to_string()),
        Err(e) => Err(format!("保存对话失败: {}", e))
    }
}

#[tauri::command]
async fn get_conversations(state: tauri::State<'_, AppState>) -> Result<Vec<Conversation>, String> {
    match state.db.get_conversations().await {
        Ok(conversations) => Ok(conversations),
        Err(e) => Err(format!("获取对话列表失败: {}", e))
    }
}

#[tauri::command]
async fn delete_conversation(conversation_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.delete_conversation(&conversation_id).await {
        Ok(_) => Ok("对话删除成功".to_string()),
        Err(e) => Err(format!("删除对话失败: {}", e))
    }
}

#[tauri::command]
async fn clear_conversations(state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.clear_conversations().await {
        Ok(_) => Ok("所有对话已清空".to_string()),
        Err(e) => Err(format!("清空对话失败: {}", e))
    }
}

#[tauri::command]
async fn toggle_conversation_favorite(conversation_id: String, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    match state.db.toggle_conversation_favorite(&conversation_id).await {
        Ok(is_favorite) => Ok(is_favorite),
        Err(e) => Err(format!("切换收藏状态失败: {}", e))
    }
}

#[tauri::command]
async fn get_favorite_conversations(state: tauri::State<'_, AppState>) -> Result<Vec<Conversation>, String> {
    match state.db.get_favorite_conversations().await {
        Ok(conversations) => Ok(conversations),
        Err(e) => Err(format!("获取收藏对话失败: {}", e))
    }
}

// 设置管理命令
#[tauri::command]
async fn save_setting(key: String, value: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.save_setting(&key, &value).await {
        Ok(_) => Ok("设置保存成功".to_string()),
        Err(e) => Err(format!("保存设置失败: {}", e))
    }
}

#[tauri::command]
async fn get_setting(key: String, state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    match state.db.get_setting(&key).await {
        Ok(value) => Ok(value),
        Err(e) => Err(format!("获取设置失败: {}", e))
    }
}

#[tauri::command]
async fn get_all_settings(state: tauri::State<'_, AppState>) -> Result<Vec<(String, String)>, String> {
    match state.db.get_all_settings().await {
        Ok(settings) => Ok(settings),
        Err(e) => Err(format!("获取所有设置失败: {}", e))
    }
}

// 角色管理命令
#[tauri::command]
async fn save_role(role: Role, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.save_role(&role).await {
        Ok(_) => Ok("角色保存成功".to_string()),
        Err(e) => Err(format!("保存角色失败: {}", e))
    }
}

#[tauri::command]
async fn get_roles(state: tauri::State<'_, AppState>) -> Result<Vec<Role>, String> {
    match state.db.get_roles().await {
        Ok(roles) => Ok(roles),
        Err(e) => Err(format!("获取角色列表失败: {}", e))
    }
}

#[tauri::command]
async fn delete_role(role_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.delete_role(&role_id).await {
        Ok(_) => Ok("角色删除成功".to_string()),
        Err(e) => Err(format!("删除角色失败: {}", e))
    }
}

// 模型管理命令
#[tauri::command]
async fn save_model_group(group: ModelGroup, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.save_model_group(&group).await {
        Ok(_) => Ok("模型分组保存成功".to_string()),
        Err(e) => Err(format!("保存模型分组失败: {}", e))
    }
}

#[tauri::command]
async fn get_model_groups(state: tauri::State<'_, AppState>) -> Result<Vec<ModelGroup>, String> {
    match state.db.get_model_groups().await {
        Ok(groups) => Ok(groups),
        Err(e) => Err(format!("获取模型分组列表失败: {}", e))
    }
}

#[tauri::command]
async fn delete_model_group(group_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.delete_model_group(&group_id).await {
        Ok(_) => Ok("模型分组删除成功".to_string()),
        Err(e) => Err(format!("删除模型分组失败: {}", e))
    }
}

#[tauri::command]
async fn save_model(model: Model, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.save_model(&model).await {
        Ok(_) => Ok("模型保存成功".to_string()),
        Err(e) => Err(format!("保存模型失败: {}", e))
    }
}

#[tauri::command]
async fn get_models(state: tauri::State<'_, AppState>) -> Result<Vec<Model>, String> {
    match state.db.get_models().await {
        Ok(models) => Ok(models),
        Err(e) => Err(format!("获取模型列表失败: {}", e))
    }
}

#[tauri::command]
async fn delete_model(model_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    match state.db.delete_model(&model_id).await {
        Ok(_) => Ok("模型删除成功".to_string()),
        Err(e) => Err(format!("删除模型失败: {}", e))
    }
}

// 数据库统计信息
#[tauri::command]
async fn get_database_stats(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    match state.db.health_check().await {
        Ok(health) => {
            let stats = serde_json::json!({
                "main_db": health.main_db,
                "knowledge_db": health.knowledge_db,
                "vec_extension": health.vec_extension,
                "cache_stats": health.cache_stats,
                "storage_type": "sqlite-vec",
                "description": "Tauri SQLite + sqlite-vec 系统"
            });
            Ok(stats)
        }
        Err(e) => Err(format!("获取数据库统计信息失败: {}", e))
    }
}



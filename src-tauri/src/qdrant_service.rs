use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest;
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct QdrantPoint {
    pub id: String,
    pub vector: Vec<f32>,
    pub payload: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QdrantSearchRequest {
    pub query_vector: Vec<f32>,
    pub limit: u64,
    pub score_threshold: Option<f32>,
    pub filter: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QdrantSearchResult {
    pub id: String,
    pub score: f32,
    pub payload: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QdrantSearchResponse {
    pub results: Vec<QdrantSearchResult>,
    pub total: u64,
}

pub struct QdrantService {
    client: reqwest::Client,
    base_url: String,
    collection_name: String,
    vector_size: usize,
    is_initialized: bool,
}

impl QdrantService {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "http://127.0.0.1:6333".to_string(),
            collection_name: "knowledge_base".to_string(),
            vector_size: 384,
            is_initialized: false,
        }
    }

    /// 初始化Qdrant服务
    pub async fn initialize(&mut self) -> Result<()> {
        if self.is_initialized {
            return Ok(());
        }

        // 检查Qdrant是否运行
        let health_url = format!("{}/health", self.base_url);
        let response = self.client
            .get(&health_url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        match response {
            Ok(_) => {
                log::info!("✅ 成功连接到Qdrant服务器");
            }
            Err(e) => {
                log::warn!("⚠️ 无法连接到Qdrant服务器: {}", e);
                return Err(anyhow::anyhow!("Qdrant服务器连接失败: {}", e));
            }
        }

        // 确保集合存在
        self.ensure_collection().await?;
        
        self.is_initialized = true;
        log::info!("✅ Qdrant服务初始化完成");
        Ok(())
    }

    /// 确保集合存在，如果不存在则创建
    async fn ensure_collection(&self) -> Result<()> {
        // 检查集合是否存在
        let collections_url = format!("{}/collections", self.base_url);
        let response = self.client
            .get(&collections_url)
            .send()
            .await?;

        let collections: serde_json::Value = response.json().await?;
        let collection_exists = collections["result"]["collections"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .any(|c| c["name"] == self.collection_name);

        if !collection_exists {
            log::info!("📦 创建Qdrant集合: {}", self.collection_name);
            
            // 创建集合
            let create_url = format!("{}/collections/{}", self.base_url, self.collection_name);
            let create_payload = serde_json::json!({
                "vectors": {
                    "size": self.vector_size,
                    "distance": "Cosine"
                }
            });

            let response = self.client
                .put(&create_url)
                .json(&create_payload)
                .send()
                .await?;

            if !response.status().is_success() {
                let error_text = response.text().await?;
                return Err(anyhow::anyhow!("创建集合失败: {}", error_text));
            }
            
            log::info!("✅ 集合创建成功");
        } else {
            log::info!("📦 集合已存在: {}", self.collection_name);
        }

        Ok(())
    }

    /// 添加向量点
    pub async fn upsert_points(&self, points: Vec<QdrantPoint>) -> Result<()> {
        if !self.is_initialized {
            return Err(anyhow::anyhow!("Qdrant服务未初始化"));
        }

        let upsert_url = format!("{}/collections/{}/points", self.base_url, self.collection_name);
        
        let upsert_payload = serde_json::json!({
            "points": points.iter().map(|point| {
                serde_json::json!({
                    "id": point.id,
                    "vector": point.vector,
                    "payload": point.payload
                })
            }).collect::<Vec<_>>()
        });

        let response = self.client
            .put(&upsert_url)
            .json(&upsert_payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("添加向量点失败: {}", error_text));
        }
        
        log::info!("✅ 成功添加 {} 个向量点", points.len());
        Ok(())
    }

    /// 搜索相似向量
    pub async fn search(&self, request: QdrantSearchRequest) -> Result<QdrantSearchResponse> {
        if !self.is_initialized {
            return Err(anyhow::anyhow!("Qdrant服务未初始化"));
        }

        let search_url = format!("{}/collections/{}/points/search", self.base_url, self.collection_name);
        
        let mut search_payload = serde_json::json!({
            "vector": request.query_vector,
            "limit": request.limit,
            "with_payload": true,
            "with_vector": false
        });

        // 添加分数阈值
        if let Some(threshold) = request.score_threshold {
            search_payload["score_threshold"] = serde_json::Value::Number(serde_json::Number::from_f64(threshold as f64).unwrap());
        }

        // 添加过滤器
        if let Some(filter_conditions) = request.filter {
            search_payload["filter"] = serde_json::json!({
                "must": filter_conditions.iter().map(|(field, value)| {
                    serde_json::json!({
                        "key": field,
                        "match": {
                            "value": value
                        }
                    })
                }).collect::<Vec<_>>()
            });
        }

        let response = self.client
            .post(&search_url)
            .json(&search_payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("搜索失败: {}", error_text));
        }

        let search_result: serde_json::Value = response.json().await?;
        
        // 转换结果
        let results: Vec<QdrantSearchResult> = search_result["result"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|point| {
                let payload: HashMap<String, serde_json::Value> = point["payload"]
                    .as_object()
                    .unwrap_or(&serde_json::Map::new())
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect();

                QdrantSearchResult {
                    id: point["id"].as_str().unwrap_or("").to_string(),
                    score: point["score"].as_f64().unwrap_or(0.0) as f32,
                    payload,
                }
            })
            .collect();

        let total = results.len() as u64;
        Ok(QdrantSearchResponse {
            results,
            total,
        })
    }

    /// 删除向量点
    pub async fn delete_points(&self, point_ids: Vec<String>) -> Result<()> {
        if !self.is_initialized {
            return Err(anyhow::anyhow!("Qdrant服务未初始化"));
        }

        let delete_url = format!("{}/collections/{}/points/delete", self.base_url, self.collection_name);
        
        let delete_payload = serde_json::json!({
            "points": point_ids
        });

        let response = self.client
            .post(&delete_url)
            .json(&delete_payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("删除向量点失败: {}", error_text));
        }
        
        log::info!("✅ 成功删除 {} 个向量点", point_ids.len());
        Ok(())
    }

    /// 获取集合信息
    pub async fn get_collection_info(&self) -> Result<serde_json::Value> {
        if !self.is_initialized {
            return Err(anyhow::anyhow!("Qdrant服务未初始化"));
        }

        let info_url = format!("{}/collections/{}", self.base_url, self.collection_name);
        let response = self.client
            .get(&info_url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("获取集合信息失败: {}", error_text));
        }

        let info: serde_json::Value = response.json().await?;
        
        Ok(serde_json::json!({
            "name": self.collection_name,
            "vectors_count": info["result"]["vectors_count"],
            "indexed_vectors_count": info["result"]["indexed_vectors_count"],
            "points_count": info["result"]["points_count"],
            "segments_count": info["result"]["segments_count"],
            "status": info["result"]["status"]
        }))
    }

    /// 清空集合
    pub async fn clear_collection(&self) -> Result<()> {
        if !self.is_initialized {
            return Err(anyhow::anyhow!("Qdrant服务未初始化"));
        }

        // 删除集合
        let delete_url = format!("{}/collections/{}", self.base_url, self.collection_name);
        let response = self.client
            .delete(&delete_url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("删除集合失败: {}", error_text));
        }
        
        // 重新创建集合
        self.ensure_collection().await?;
        
        log::info!("✅ 集合已清空并重新创建");
        Ok(())
    }

    /// 检查服务状态
    pub fn is_available(&self) -> bool {
        self.is_initialized
    }
}

// Tauri命令：初始化Qdrant服务
#[tauri::command]
pub async fn init_qdrant_service(
    service: tauri::State<'_, std::sync::Mutex<QdrantService>>,
) -> Result<String, String> {
    let mut service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    match service.initialize().await {
        Ok(_) => Ok("Qdrant服务初始化成功".to_string()),
        Err(e) => Err(format!("Qdrant服务初始化失败: {}", e)),
    }
}

// Tauri命令：添加向量点
#[tauri::command]
pub async fn qdrant_upsert_points(
    points: Vec<QdrantPoint>,
    service: tauri::State<'_, std::sync::Mutex<QdrantService>>,
) -> Result<String, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    match service.upsert_points(points).await {
        Ok(_) => Ok("向量点添加成功".to_string()),
        Err(e) => Err(format!("向量点添加失败: {}", e)),
    }
}

// Tauri命令：搜索向量
#[tauri::command]
pub async fn qdrant_search(
    request: QdrantSearchRequest,
    service: tauri::State<'_, std::sync::Mutex<QdrantService>>,
) -> Result<QdrantSearchResponse, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    match service.search(request).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("向量搜索失败: {}", e)),
    }
}

// Tauri命令：删除向量点
#[tauri::command]
pub async fn qdrant_delete_points(
    point_ids: Vec<String>,
    service: tauri::State<'_, std::sync::Mutex<QdrantService>>,
) -> Result<String, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    match service.delete_points(point_ids).await {
        Ok(_) => Ok("向量点删除成功".to_string()),
        Err(e) => Err(format!("向量点删除失败: {}", e)),
    }
}

// Tauri命令：获取集合信息
#[tauri::command]
pub async fn qdrant_get_collection_info(
    service: tauri::State<'_, std::sync::Mutex<QdrantService>>,
) -> Result<serde_json::Value, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    match service.get_collection_info().await {
        Ok(info) => Ok(info),
        Err(e) => Err(format!("获取集合信息失败: {}", e)),
    }
}

// Tauri命令：清空集合
#[tauri::command]
pub async fn qdrant_clear_collection(
    service: tauri::State<'_, std::sync::Mutex<QdrantService>>,
) -> Result<String, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    match service.clear_collection().await {
        Ok(_) => Ok("集合已清空".to_string()),
        Err(e) => Err(format!("清空集合失败: {}", e)),
    }
}

// Tauri命令：检查服务状态
#[tauri::command]
pub async fn qdrant_check_status(
    service: tauri::State<'_, std::sync::Mutex<QdrantService>>,
) -> Result<bool, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(service.is_available())
}
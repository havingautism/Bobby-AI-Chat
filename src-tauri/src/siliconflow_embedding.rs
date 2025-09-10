use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SiliconFlowEmbeddingRequest {
    pub model: String,
    pub input: SiliconFlowInput,
    pub encoding_format: Option<String>,
    pub dimensions: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SiliconFlowInput {
    Single(String),
    Multiple(Vec<String>),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SiliconFlowEmbeddingResponse {
    pub data: Vec<EmbeddingData>,
    pub model: String,
    pub usage: Usage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingData {
    pub embedding: Vec<f32>,
    pub index: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: i32,
    pub total_tokens: i32,
}

/// 直接调用硅基流动嵌入API，无需初始化服务
pub async fn generate_siliconflow_embedding(api_key: String, text: String, model: String) -> Result<Vec<f32>, String> {
    let client = reqwest::Client::new();
    let url = "https://api.siliconflow.cn/v1/embeddings";
    
    let request = SiliconFlowEmbeddingRequest {
        model: model.clone(),
        input: SiliconFlowInput::Single(text),
        encoding_format: Some("float".to_string()),
        dimensions: None,
    };
    
    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(e) => return Err(format!("请求失败: {}", e)),
    };

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        return Err(format!("API请求失败: {} - {}", status, error_text));
    }

    let embedding_response: SiliconFlowEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if embedding_response.data.is_empty() {
        return Err("API返回空数据".to_string());
    }

    Ok(embedding_response.data[0].embedding.clone())
}

/// 直接调用硅基流动批量嵌入API，无需初始化服务
pub async fn generate_siliconflow_batch_embeddings(api_key: String, texts: Vec<String>, model: String) -> Result<Vec<Vec<f32>>, String> {
    let client = reqwest::Client::new();
    let url = "https://api.siliconflow.cn/v1/embeddings";
    
    let request = SiliconFlowEmbeddingRequest {
        model: model.clone(),
        input: SiliconFlowInput::Multiple(texts),
        encoding_format: Some("float".to_string()),
        dimensions: None,
    };
    
    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(e) => return Err(format!("请求失败: {}", e)),
    };

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        return Err(format!("API请求失败: {} - {}", status, error_text));
    }

    let embedding_response: SiliconFlowEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if embedding_response.data.is_empty() {
        return Err("API返回空数据".to_string());
    }

    let embeddings: Vec<Vec<f32>> = embedding_response.data.iter().map(|d| d.embedding.clone()).collect();
    Ok(embeddings)
}

/// 获取支持的模型列表
pub async fn get_siliconflow_models() -> Result<Vec<String>, String> {
    let models = vec![
        "BAAI/bge-large-zh-v1.5".to_string(),
        "BAAI/bge-large-en-v1.5".to_string(),
        "BAAI/bge-m3".to_string(),
    ];
    Ok(models)
}
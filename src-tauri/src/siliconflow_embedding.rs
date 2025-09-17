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
    println!("🔍 调用SiliconFlow嵌入API - 模型: {}, 文本长度: {}, API密钥长度: {}", model, text.len(), api_key.len());

    if api_key.is_empty() {
        println!("❌ API密钥为空，拒绝调用");
        return Err("API密钥为空，请在设置中配置SiliconFlow API密钥".to_string());
    }

    // 记录请求详情
    println!("📋 API请求详情:");
    println!("   - 目标URL: https://api.siliconflow.cn/v1/embeddings");
    println!("   - 模型: {}", model);
    println!("   - 输入类型: 单文本");
    println!("   - 文本长度: {} 字符", text.len());

    let client = reqwest::Client::new();
    let url = "https://api.siliconflow.cn/v1/embeddings";

    let request = SiliconFlowEmbeddingRequest {
        model: model.clone(),
        input: SiliconFlowInput::Single(text),
        encoding_format: Some("float".to_string()),
        dimensions: None,
    };

    println!("🚀 正在发送API请求...");

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await;

    let response = match response {
        Ok(r) => {
            println!("📡 SiliconFlow API响应状态: {}", r.status());
            if r.status().is_success() {
                println!("✅ API请求成功");
            } else {
                println!("❌ API请求失败，状态码: {}", r.status());
            }
            r
        },
        Err(e) => {
            println!("❌ SiliconFlow API请求发送失败: {}", e);
            println!("💡 可能的原因:");
            println!("   - 网络连接问题");
            println!("   - API服务不可用");
            println!("   - 请求超时");
            return Err(format!("SiliconFlow API请求发送失败: {}", e));
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        println!("❌ SiliconFlow API请求失败详情:");
        println!("   - 状态码: {}", status);
        println!("   - 错误信息: {}", error_text);
        println!("   - 模型: {}", model);
        println!("💡 建议检查:");
        println!("   - API密钥是否正确");
        println!("   - 模型名称是否有效");
        println!("   - API配额是否充足");
        return Err(format!("SiliconFlow API请求失败: 状态码 {} - {}", status, error_text));
    }

    println!("✅ SiliconFlow API请求成功，正在解析响应...");

    let embedding_response: SiliconFlowEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| {
            println!("❌ SiliconFlow API响应解析失败: {}", e);
            println!("💡 可能的原因: 响应格式不符合预期");
            format!("SiliconFlow API响应解析失败: {}", e)
        })?;

    if embedding_response.data.is_empty() {
        println!("❌ SiliconFlow API返回空数据");
        return Err("SiliconFlow API返回空数据".to_string());
    }

    println!("✅ SiliconFlow嵌入生成成功:");
    println!("   - 模型: {}", embedding_response.model);
    println!("   - 向量维度: {}", embedding_response.data[0].embedding.len());
    println!("   - 使用Token数: {} (提示: {})",
        embedding_response.usage.total_tokens,
        embedding_response.usage.prompt_tokens);

    Ok(embedding_response.data[0].embedding.clone())
}

/// 直接调用硅基流动批量嵌入API，无需初始化服务
pub async fn generate_siliconflow_batch_embeddings(api_key: String, texts: Vec<String>, model: String) -> Result<Vec<Vec<f32>>, String> {
    println!("🔍 调用SiliconFlow批量嵌入API - 模型: {}, 文本数量: {}, API密钥长度: {}", model, texts.len(), api_key.len());

    if api_key.is_empty() {
        println!("❌ API密钥为空，拒绝批量调用");
        return Err("API密钥为空，请在设置中配置SiliconFlow API密钥".to_string());
    }

    // 记录请求详情
    println!("📋 批量API请求详情:");
    println!("   - 目标URL: https://api.siliconflow.cn/v1/embeddings");
    println!("   - 模型: {}", model);
    println!("   - 输入类型: 多文本批量");
    println!("   - 文本数量: {} 个", texts.len());

    let client = reqwest::Client::new();
    let url = "https://api.siliconflow.cn/v1/embeddings";

    let request = SiliconFlowEmbeddingRequest {
        model: model.clone(),
        input: SiliconFlowInput::Multiple(texts),
        encoding_format: Some("float".to_string()),
        dimensions: None,
    };

    println!("🚀 正在发送批量API请求...");

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await;

    let response = match response {
        Ok(r) => {
            println!("📡 SiliconFlow API响应状态: {}", r.status());
            if r.status().is_success() {
                println!("✅ 批量API请求成功");
            } else {
                println!("❌ 批量API请求失败，状态码: {}", r.status());
            }
            r
        },
        Err(e) => {
            println!("❌ SiliconFlow API批量请求发送失败: {}", e);
            println!("💡 可能的原因:");
            println!("   - 网络连接问题");
            println!("   - API服务不可用");
            println!("   - 请求超时");
            println!("   - 批量请求过大（尝试减少文本数量）");
            return Err(format!("SiliconFlow API批量请求发送失败: {}", e));
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        println!("❌ SiliconFlow API批量请求失败详情:");
        println!("   - 状态码: {}", status);
        println!("   - 错误信息: {}", error_text);
        println!("   - 模型: {}", model);
        let batch_size = match &request.input {
    SiliconFlowInput::Single(_) => 1,
    SiliconFlowInput::Multiple(texts) => texts.len(),
};
println!("   - 批量大小: {} 个文本", batch_size);
        println!("💡 建议检查:");
        println!("   - API密钥是否正确");
        println!("   - 模型名称是否有效");
        println!("   - API配额是否充足");
        println!("   - 批量大小是否超出限制");
        return Err(format!("SiliconFlow API批量请求失败: 状态码 {} - {}", status, error_text));
    }

    println!("✅ SiliconFlow API批量请求成功，正在解析响应...");

    let embedding_response: SiliconFlowEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| {
            println!("❌ SiliconFlow API批量响应解析失败: {}", e);
            println!("💡 可能的原因: 批量响应格式不符合预期");
            format!("解析批量响应失败: {}", e)
        })?;

    if embedding_response.data.is_empty() {
        println!("❌ SiliconFlow API批量返回空数据");
        return Err("API批量返回空数据".to_string());
    }

    let embeddings: Vec<Vec<f32>> = embedding_response.data.iter().map(|d| d.embedding.clone()).collect();

    println!("✅ SiliconFlow批量嵌入生成成功:");
    println!("   - 模型: {}", embedding_response.model);
    println!("   - 向量数量: {} 个", embeddings.len());
    if let Some(first_embedding) = embeddings.first() {
        println!("   - 向量维度: {} 维", first_embedding.len());
    }
    println!("   - 总使用Token数: {} (提示: {})",
        embedding_response.usage.total_tokens,
        embedding_response.usage.prompt_tokens);
    println!("   - 平均每个文本Token数: {}",
        embedding_response.usage.total_tokens / embeddings.len() as i32);

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
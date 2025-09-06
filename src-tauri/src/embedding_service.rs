use serde::{Deserialize, Serialize};
use tauri::State;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub text: String,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
    pub model: String,
    pub dimensions: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchEmbeddingRequest {
    pub texts: Vec<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchEmbeddingResponse {
    pub embeddings: Vec<Vec<f32>>,
    pub model: String,
    pub dimensions: usize,
}

// 嵌入服务状态
pub struct EmbeddingService {
    // 可以在这里添加模型缓存等
}

impl EmbeddingService {
    pub fn new() -> Self {
        Self {}
    }

    // 使用简单的TF-IDF + 哈希生成嵌入（临时方案）
    pub fn generate_simple_embedding(&self, text: &str) -> Vec<f32> {
        let processed_text = text.to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace() || (*c as u32 >= 0x4e00 && *c as u32 <= 0x9fff))
            .collect::<String>();

        let words: Vec<&str> = processed_text
            .split_whitespace()
            .filter(|word| word.len() > 1)
            .collect();

        let mut word_freq: HashMap<&str, usize> = HashMap::new();
        for word in &words {
            *word_freq.entry(word).or_insert(0) += 1;
        }

        // 生成384维向量
        let mut embedding = vec![0.0; 384];
        let words_list: Vec<&str> = word_freq.keys().cloned().collect();

        for (i, word) in words_list.iter().enumerate() {
            let freq = word_freq[word] as f32;
            let hash = self.simple_hash(word);

            // 为每个词生成多个维度的贡献
            for j in 0..8 {
                let dim = (hash + j * 1000) % 384;
                embedding[dim] += freq * (hash as f32 + j as f32).sin() * 0.1;
            }
        }

        // 归一化
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            embedding.iter().map(|x| x / norm).collect()
        } else {
            embedding
        }
    }

    fn simple_hash(&self, s: &str) -> usize {
        let mut hash = 0usize;
        for byte in s.bytes() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as usize);
        }
        hash
    }

    // 计算余弦相似度
    pub fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot_product / (norm_a * norm_b)
        }
    }
}

// Tauri命令：生成单个嵌入
#[tauri::command]
pub async fn generate_embedding(
    request: EmbeddingRequest,
    service: State<'_, Mutex<EmbeddingService>>,
) -> Result<EmbeddingResponse, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    let embedding = service.generate_simple_embedding(&request.text);
    
    Ok(EmbeddingResponse {
        embedding,
        model: request.model.unwrap_or_else(|| "simple-tfidf".to_string()),
        dimensions: 384,
    })
}

// Tauri命令：批量生成嵌入
#[tauri::command]
pub async fn generate_batch_embeddings(
    request: BatchEmbeddingRequest,
    service: State<'_, Mutex<EmbeddingService>>,
) -> Result<BatchEmbeddingResponse, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    let embeddings: Vec<Vec<f32>> = request.texts
        .iter()
        .map(|text| service.generate_simple_embedding(text))
        .collect();
    
    Ok(BatchEmbeddingResponse {
        embeddings,
        model: request.model.unwrap_or_else(|| "simple-tfidf".to_string()),
        dimensions: 384,
    })
}

// Tauri命令：计算相似度
#[tauri::command]
pub async fn calculate_similarity(
    embedding1: Vec<f32>,
    embedding2: Vec<f32>,
    service: State<'_, Mutex<EmbeddingService>>,
) -> Result<f32, String> {
    let service = service.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    let similarity = service.cosine_similarity(&embedding1, &embedding2);
    Ok(similarity)
}

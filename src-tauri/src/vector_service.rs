use crate::database::DatabaseManager;
use crate::types::*;
use anyhow::{Result, anyhow};
use tracing::info;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use lru::LruCache;
use rayon::prelude::*;
use sqlx::Row;

// 向量服务
pub struct VectorService {
    db: Arc<DatabaseManager>,
    embedding_cache: Arc<RwLock<LruCache<String, Vec<f32>>>>,
    model_cache: Arc<RwLock<HashMap<String, EmbeddingModel>>>,
}

impl VectorService {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self {
            db,
            embedding_cache: Arc::new(RwLock::new(LruCache::new(std::num::NonZeroUsize::new(10000).unwrap()))),
            model_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // 获取嵌入模型配置
    pub async fn get_embedding_model(&self, model_id: &str) -> Result<EmbeddingModel> {
        // 检查缓存
        {
            let cache = self.model_cache.read().await;
            if let Some(model) = cache.get(model_id) {
                return Ok(model.clone());
            }
        }

        // 从数据库获取 - 尝试通过model_id查找，如果找不到则通过id查找
        let row = sqlx::query(
            "SELECT id, name, model_id, dimensions, language, enabled, max_tokens, created_at, updated_at
             FROM embedding_models WHERE model_id = ? AND enabled = 1"
        )
        .bind(model_id)
        .fetch_one(self.db.main_pool())
        .await?;

        let model = EmbeddingModel {
            id: row.get(0),
            name: row.get(1),
            model_id: row.get(2),
            dimensions: row.get(3),
            language: row.get(4),
            enabled: row.get(5),
            max_tokens: row.get(6),
            created_at: chrono::DateTime::from_timestamp(row.get(7), 0).unwrap_or_default(),
            updated_at: chrono::DateTime::from_timestamp(row.get(8), 0).unwrap_or_default(),
        };

        // 更新缓存
        {
            let mut cache = self.model_cache.write().await;
            cache.insert(model_id.to_string(), model.clone());
        }

        Ok(model)
    }

    // 获取所有可用的嵌入模型
    pub async fn get_available_models(&self) -> Result<Vec<EmbeddingModel>> {
        let rows = sqlx::query(
            "SELECT id, name, model_id, dimensions, language, enabled, max_tokens, created_at, updated_at
             FROM embedding_models WHERE enabled = 1 ORDER BY language, name"
        )
        .fetch_all(self.db.main_pool())
        .await?;

        let mut models = Vec::new();
        for row in rows {
            models.push(EmbeddingModel {
                id: row.get(0),
                name: row.get(1),
                model_id: row.get(2),
                dimensions: row.get(3),
                language: row.get(4),
                enabled: row.get(5),
                max_tokens: row.get(6),
                created_at: chrono::DateTime::from_timestamp(row.get(7), 0).unwrap_or_default(),
                updated_at: chrono::DateTime::from_timestamp(row.get(8), 0).unwrap_or_default(),
            });
        }

        Ok(models)
    }

    // 生成文本嵌入
    pub async fn generate_embedding(&self, text: &str, model_id: &str) -> Result<Vec<f32>> {
        // 生成缓存键
        let cache_key = format!("embedding:{}:{}", model_id, text);

        // 检查缓存
        {
            let mut cache = self.embedding_cache.write().await;
            if let Some(cached_embedding) = cache.get(&cache_key) {
                return Ok(cached_embedding.clone());
            }
        }

        // 获取模型配置
        let model = self.get_embedding_model(model_id).await?;

        // 调用实际的嵌入服务（使用空API密钥，将返回错误而不是回退到模拟实现）
        let embedding = self.generate_real_embedding(text, &model, "").await?;

        // 缓存结果
        {
            let mut cache = self.embedding_cache.write().await;
            cache.put(cache_key, embedding.clone());
        }

        Ok(embedding)
    }

    // 批量生成嵌入（使用API密钥）
    pub async fn generate_embeddings_with_api_key_batch(&self, texts: &[String], model: &EmbeddingModel, api_key: &str) -> Result<Vec<Vec<f32>>> {
        // 调用实际的嵌入服务，使用提供的API密钥
        let embeddings = self.generate_real_embeddings_batch(texts, model, api_key).await?;
        Ok(embeddings)
    }

    // 批量生成嵌入
    pub async fn generate_embeddings_batch(&self, texts: &[String], model_id: &str) -> Result<Vec<Vec<f32>>> {
        let model = self.get_embedding_model(model_id).await?;

        // 调用实际的嵌入服务（使用空API密钥，将回退到模拟实现）
        let embeddings = self.generate_real_embeddings_batch(texts, &model, "").await?;

        Ok(embeddings)
    }

    // 调用实际的嵌入服务
    async fn generate_real_embedding(&self, text: &str, model: &EmbeddingModel, api_key: &str) -> Result<Vec<f32>> {
        // 调用 SiliconFlow API 或其他嵌入服务
        let result = crate::siliconflow_embedding::generate_siliconflow_embedding(
            api_key.to_string(),
            text.to_string(),
            model.model_id.clone()
        ).await;

        // 转换 Result<Vec<f32>, String> 为 Result<Vec<f32>, anyhow::Error>
        result.map_err(|e| anyhow::anyhow!(e))
    }

    // 批量调用实际的嵌入服务
    async fn generate_real_embeddings_batch(&self, texts: &[String], model: &EmbeddingModel, api_key: &str) -> Result<Vec<Vec<f32>>> {
        const MAX_BATCH_SIZE: usize = 32; // SiliconFlow API限制

        if texts.len() <= MAX_BATCH_SIZE {
            // 如果数量在限制内，直接调用
            let result = crate::siliconflow_embedding::generate_siliconflow_batch_embeddings(
                api_key.to_string(),
                texts.to_vec(),
                model.model_id.clone()
            ).await;
            return result.map_err(|e| anyhow::anyhow!(e));
        }

        // 分批发送请求
        println!("📦 文本数量({})超过API限制({})，开始分批发送...", texts.len(), MAX_BATCH_SIZE);
        let mut all_embeddings = Vec::new();

        for (batch_index, chunk) in texts.chunks(MAX_BATCH_SIZE).enumerate() {
            println!("🔄 处理第 {}/{} 批 ({} 个文本)", batch_index + 1, (texts.len() + MAX_BATCH_SIZE - 1) / MAX_BATCH_SIZE, chunk.len());

            let result = crate::siliconflow_embedding::generate_siliconflow_batch_embeddings(
                api_key.to_string(),
                chunk.to_vec(),
                model.model_id.clone()
            ).await;

            match result {
                Ok(batch_embeddings) => {
                    let count = batch_embeddings.len();
                    all_embeddings.extend(batch_embeddings);
                    println!("✅ 第 {} 批处理完成，获得 {} 个向量", batch_index + 1, count);
                },
                Err(e) => {
                    println!("❌ 第 {} 批处理失败: {}", batch_index + 1, e);
                    return Err(anyhow::anyhow!("批量处理第 {} 批失败: {}", batch_index + 1, e));
                }
            }
        }

        println!("✅ 所有批次处理完成，总共生成 {} 个向量", all_embeddings.len());
        Ok(all_embeddings)
    }
    async fn mock_generate_embedding(&self, text: &str, model: &EmbeddingModel) -> Result<Vec<f32>> {
        // 简单的模拟嵌入生成
        let dimensions = model.dimensions as usize;
        let mut embedding = vec![0.0; dimensions];

        // 使用文本的简单哈希来生成伪随机向量
        let mut hash: i32 = 0;
        for byte in text.as_bytes() {
            hash = hash.wrapping_mul(31).wrapping_add(*byte as i32);
        }

        // 填充向量
        for i in 0..dimensions {
            embedding[i] = ((hash.wrapping_mul(i as i32 + 1)) as f32 / 2147483647.0) * 2.0 - 1.0;
        }

        // 归一化
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for val in &mut embedding {
                *val /= norm;
            }
        }

        Ok(embedding)
    }

    // 向量相似度计算
    pub fn cosine_similarity(&self, vec1: &[f32], vec2: &[f32]) -> Result<f32> {
        if vec1.len() != vec2.len() {
            return Err(anyhow!("Vector dimensions don't match"));
        }

        let dot_product: f32 = vec1.iter().zip(vec2.iter()).map(|(a, b)| a * b).sum();
        let norm1: f32 = vec1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm2: f32 = vec2.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm1 == 0.0 || norm2 == 0.0 {
            return Ok(0.0);
        }

        Ok(dot_product / (norm1 * norm2))
    }

    // 向量距离计算（欧几里得距离）
    pub fn euclidean_distance(&self, vec1: &[f32], vec2: &[f32]) -> Result<f32> {
        if vec1.len() != vec2.len() {
            return Err(anyhow!("Vector dimensions don't match"));
        }

        let sum_squares: f32 = vec1.iter().zip(vec2.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum();

        Ok(sum_squares.sqrt())
    }

    // 批量向量相似度计算
    pub fn batch_cosine_similarity(&self, query_vec: &[f32], vectors: &[Vec<f32>]) -> Result<Vec<f32>> {
        let similarities: Result<Vec<_>> = vectors
            .par_iter()
            .map(|vec| self.cosine_similarity(query_vec, vec))
            .collect();

        similarities
    }

    // 向量聚类（简单的K-means）
    pub fn kmeans_clustering(&self, vectors: &[Vec<f32>], k: usize, max_iterations: usize) -> Result<(Vec<Vec<f32>>, Vec<usize>)> {
        if vectors.is_empty() || k == 0 {
            return Err(anyhow!("Invalid input for clustering"));
        }

        let _dimensions = vectors[0].len();
        let mut centroids = self.initialize_centroids(vectors, k)?;
        let mut assignments = vec![0; vectors.len()];

        for iteration in 0..max_iterations {
            let mut changed = false;

            // 分配每个向量到最近的中心点
            for (i, vector) in vectors.iter().enumerate() {
                let mut min_distance = f32::INFINITY;
                let mut closest_centroid = 0;

                for (j, centroid) in centroids.iter().enumerate() {
                    let distance = self.euclidean_distance(vector, centroid)?;
                    if distance < min_distance {
                        min_distance = distance;
                        closest_centroid = j;
                    }
                }

                if assignments[i] != closest_centroid {
                    assignments[i] = closest_centroid;
                    changed = true;
                }
            }

            // 更新中心点
            for j in 0..k {
                let cluster_vectors: Vec<&Vec<f32>> = vectors.iter()
                    .enumerate()
                    .filter(|&(i, _)| assignments[i] == j)
                    .map(|(_, v)| v)
                    .collect();

                if !cluster_vectors.is_empty() {
                    let new_centroid = self.calculate_centroid(&cluster_vectors)?;
                    centroids[j] = new_centroid;
                }
            }

            if !changed {
                break;
            }

            info!("K-means iteration {} completed", iteration + 1);
        }

        Ok((centroids, assignments))
    }

    // 初始化中心点
    fn initialize_centroids(&self, vectors: &[Vec<f32>], k: usize) -> Result<Vec<Vec<f32>>> {
        if vectors.len() <= k {
            return Ok(vectors.to_vec());
        }

        let mut centroids = Vec::new();
        let mut used_indices = std::collections::HashSet::new();

        // 随机选择k个不同的向量作为初始中心点
        use rand::Rng;
        let mut rng = rand::thread_rng();

        while centroids.len() < k {
            let index = rng.gen_range(0..vectors.len());
            if !used_indices.contains(&index) {
                centroids.push(vectors[index].clone());
                used_indices.insert(index);
            }
        }

        Ok(centroids)
    }

    // 计算中心点
    fn calculate_centroid(&self, vectors: &[&Vec<f32>]) -> Result<Vec<f32>> {
        if vectors.is_empty() {
            return Err(anyhow!("Cannot calculate centroid of empty cluster"));
        }

        let dimensions = vectors[0].len();
        let mut centroid = vec![0.0; dimensions];

        for vector in vectors {
            for (i, &val) in vector.iter().enumerate() {
                centroid[i] += val;
            }
        }

        let count = vectors.len() as f32;
        for val in &mut centroid {
            *val /= count;
        }

        Ok(centroid)
    }

    // 向量降维（PCA简化版）
    pub fn pca_reduce(&self, vectors: &[Vec<f32>], target_dim: usize) -> Result<Vec<Vec<f32>>> {
        if vectors.is_empty() || target_dim == 0 {
            return Err(anyhow!("Invalid input for PCA"));
        }

        let original_dim = vectors[0].len();
        if target_dim >= original_dim {
            return Ok(vectors.to_vec());
        }

        // 简化的PCA实现
        // 1. 计算均值
        let mean = self.calculate_mean(vectors)?;

        // 2. 中心化数据
        let centered: Vec<Vec<f32>> = vectors.iter()
            .map(|v| v.iter().zip(&mean).map(|(a, b)| a - b).collect())
            .collect();

        // 3. 计算协方差矩阵
        let covariance = self.calculate_covariance(&centered)?;

        // 4. 计算特征向量（简化版）
        let eigenvectors = self.simplify_eigenvectors(&covariance, target_dim)?;

        // 5. 投影到新的空间
        let reduced: Result<Vec<_>> = centered.iter()
            .map(|v| self.project_vector(v, &eigenvectors))
            .collect();

        reduced
    }

    // 计算均值向量
    fn calculate_mean(&self, vectors: &[Vec<f32>]) -> Result<Vec<f32>> {
        if vectors.is_empty() {
            return Err(anyhow!("Cannot calculate mean of empty vectors"));
        }

        let dimensions = vectors[0].len();
        let mut mean = vec![0.0; dimensions];

        for vector in vectors {
            for (i, &val) in vector.iter().enumerate() {
                mean[i] += val;
            }
        }

        let count = vectors.len() as f32;
        for val in &mut mean {
            *val /= count;
        }

        Ok(mean)
    }

    // 计算协方差矩阵
    fn calculate_covariance(&self, vectors: &[Vec<f32>]) -> Result<Vec<Vec<f32>>> {
        if vectors.is_empty() {
            return Err(anyhow!("Cannot calculate covariance of empty vectors"));
        }

        let n = vectors.len();
        let dim = vectors[0].len();
        let mut covariance = vec![vec![0.0; dim]; dim];

        for i in 0..dim {
            for j in 0..dim {
                let sum: f32 = vectors.iter()
                    .map(|v| v[i] * v[j])
                    .sum();
                covariance[i][j] = sum / (n - 1) as f32;
            }
        }

        Ok(covariance)
    }

    // 简化的特征向量计算
    fn simplify_eigenvectors(&self, matrix: &[Vec<f32>], target_dim: usize) -> Result<Vec<Vec<f32>>> {
        // 简化实现：返回前target_dim个单位向量
        let dim = matrix.len();
        let mut eigenvectors = Vec::new();

        for i in 0..target_dim.min(dim) {
            let mut vec = vec![0.0; dim];
            vec[i] = 1.0;
            eigenvectors.push(vec);
        }

        Ok(eigenvectors)
    }

    // 向量投影
    fn project_vector(&self, vector: &[f32], eigenvectors: &[Vec<f32>]) -> Result<Vec<f32>> {
        let mut projected = Vec::new();

        for eigenvector in eigenvectors {
            let projection: f32 = vector.iter().zip(eigenvector.iter())
                .map(|(a, b)| a * b)
                .sum();
            projected.push(projection);
        }

        Ok(projected)
    }

    // 清理缓存
    pub async fn clear_cache(&self) {
        let mut cache = self.embedding_cache.write().await;
        cache.clear();

        let mut model_cache = self.model_cache.write().await;
        model_cache.clear();
    }

    // 获取缓存统计
    pub async fn cache_stats(&self) -> (usize, usize, usize) {
        let embedding_cache = self.embedding_cache.read().await;
        let model_cache = self.model_cache.read().await;

        (embedding_cache.len(), embedding_cache.cap().into(), model_cache.len())
    }
}
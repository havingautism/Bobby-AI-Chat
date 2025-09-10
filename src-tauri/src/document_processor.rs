use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentChunk {
    pub index: usize,
    pub text: String,
    pub start_pos: usize,
    pub end_pos: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmbeddingResult {
    pub chunk_index: usize,
    pub chunk_text: String,
    pub embedding: Vec<f32>,
    pub model: String,
    pub dimensions: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentProcessingRequest {
    pub content: String,
    pub model: String,
    pub chunk_size: Option<usize>,
    pub overlap: Option<usize>,
    pub batch_size: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentProcessingResponse {
    pub embeddings: Vec<EmbeddingResult>,
    pub total_chunks: usize,
    pub processing_time_ms: u64,
    pub model_used: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessingProgress {
    pub current: usize,
    pub total: usize,
    pub percentage: f32,
    pub stage: String,
    pub message: String,
}

pub struct DocumentProcessor {
    // 可以添加模型缓存等状态
}

impl DocumentProcessor {
    pub fn new() -> Self {
        Self {}
    }

    /// 智能文本分块，支持中英文
    pub fn chunk_text(&self, text: &str, chunk_size: usize, overlap: usize) -> Vec<DocumentChunk> {
        if text.is_empty() {
            return Vec::new();
        }

        let mut chunks = Vec::new();
        let mut start = 0;
        let max_chunks = 10000; // 防止无限分块
        let chars: Vec<char> = text.chars().collect();
        let total_chars = chars.len();

        while start < total_chars && chunks.len() < max_chunks {
            let end = std::cmp::min(start + chunk_size, total_chars);
            let chunk_chars = &chars[start..end];
            let mut chunk_text = chunk_chars.iter().collect::<String>();

            // 如果不是最后一块，尝试在句子边界分割
            if end < total_chars {
                if let Some(best_split) = self.find_best_split_point(&chunk_text, chunk_size) {
                    // 确保分割点在字符边界，并且不超出当前块的范围
                    let safe_split = std::cmp::min(best_split, chunk_text.chars().count());
                    let split_chars = &chars[start..start + safe_split];
                    chunk_text = split_chars.iter().collect::<String>();
                    start = start + safe_split - overlap;
                } else {
                    start = end - overlap;
                }
            } else {
                start = end;
            }

            if !chunk_text.trim().is_empty() {
                chunks.push(DocumentChunk {
                    index: chunks.len(),
                    text: chunk_text.trim().to_string(),
                    start_pos: start.saturating_sub(overlap),
                    end_pos: start + chunk_text.chars().count(),
                });
            }

            // 防止无限循环
            if start <= 0 || start >= total_chars {
                start = end;
            }
            if start >= total_chars {
                break;
            }
        }

        if chunks.len() >= max_chunks {
            println!("⚠️ 文档过大，已达到最大分块限制 {}，部分内容可能被截断", max_chunks);
        }

        println!("📄 文档分块完成: {} 个块 (原始长度: {} 字符)", chunks.len(), total_chars);
        chunks
    }

    /// 找到最佳分割点（返回字符位置）
    fn find_best_split_point(&self, chunk: &str, chunk_size: usize) -> Option<usize> {
        let min_split = chunk_size / 3; // 最小分割点
        
        // 检测多种句子结束符
        let split_chars = ['。', '.', '！', '!', '？', '?', '\n', '；', ';'];
        let mut best_split = None;
        let mut best_score = 0;

        // 将字符串转换为字符向量以便按字符位置操作
        let chars: Vec<char> = chunk.chars().collect();
        
        for &char in &split_chars {
            // 从后往前查找字符
            for (i, &c) in chars.iter().enumerate().rev() {
                if c == char {
                    if i > min_split && i > best_score {
                        best_split = Some(i + 1);
                        best_score = i;
                    }
                    break; // 找到第一个匹配的就停止
                }
            }
        }

        best_split
    }

    /// 生成简单嵌入向量（临时方案，后续可集成真实模型）
    fn generate_simple_embedding(&self, text: &str, dimensions: usize) -> Vec<f32> {
        let mut embedding = vec![0.0; dimensions];
        let mut hash = 0u64;
        
        for (_i, byte) in text.bytes().enumerate() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
            let index = (hash as usize) % dimensions;
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

    /// 批量处理文档嵌入（高效版本）
    pub async fn process_document_embeddings(
        &self,
        request: DocumentProcessingRequest,
        app_handle: AppHandle,
    ) -> Result<DocumentProcessingResponse, String> {
        let start_time = std::time::Instant::now();
        
        // 设置默认参数
        let chunk_size = request.chunk_size.unwrap_or(800);
        let overlap = request.overlap.unwrap_or(100);
        let batch_size = request.batch_size.unwrap_or(50);

        println!("🚀 开始处理文档嵌入: 内容长度={}, 分块大小={}, 重叠={}, 批次大小={}", 
                 request.content.len(), chunk_size, overlap, batch_size);

        // 发送开始事件
        let _ = app_handle.emit("document_processing_started", ProcessingProgress {
            current: 0,
            total: 0,
            percentage: 0.0,
            stage: "chunking".to_string(),
            message: "开始文档分块...".to_string(),
        });

        // 1. 文本分块
        let chunks = self.chunk_text(&request.content, chunk_size, overlap);
        let total_chunks = chunks.len();

        if total_chunks == 0 {
            return Ok(DocumentProcessingResponse {
                embeddings: Vec::new(),
                total_chunks: 0,
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                model_used: request.model.clone(),
            });
        }

        // 发送分块完成事件
        let _ = app_handle.emit("document_chunking_completed", ProcessingProgress {
            current: total_chunks,
            total: total_chunks,
            percentage: 20.0,
            stage: "embedding".to_string(),
            message: format!("分块完成，共 {} 个块，开始生成嵌入...", total_chunks),
        });

        // 2. 批量生成嵌入
        let embeddings = self.generate_embeddings_batch(
            &chunks,
            &request.model,
            batch_size,
            app_handle.clone(),
        ).await?;

        let processing_time = start_time.elapsed().as_millis() as u64;

        // 发送完成事件
        let _ = app_handle.emit("document_processing_completed", ProcessingProgress {
            current: embeddings.len(),
            total: embeddings.len(),
            percentage: 100.0,
            stage: "completed".to_string(),
            message: format!("处理完成，共生成 {} 个嵌入向量，耗时 {}ms", embeddings.len(), processing_time),
        });

        println!("🎉 文档处理完成: {} 个嵌入向量，耗时 {}ms", embeddings.len(), processing_time);

        Ok(DocumentProcessingResponse {
            embeddings,
            total_chunks,
            processing_time_ms: processing_time,
            model_used: request.model,
        })
    }

    /// 批量生成嵌入向量
    async fn generate_embeddings_batch(
        &self,
        chunks: &[DocumentChunk],
        model: &str,
        batch_size: usize,
        app_handle: AppHandle,
    ) -> Result<Vec<EmbeddingResult>, String> {
        let mut all_embeddings = Vec::new();
        let total_batches = (chunks.len() + batch_size - 1) / batch_size;
        let processed_count = Arc::new(AtomicUsize::new(0));

        for (batch_index, batch_chunks) in chunks.chunks(batch_size).enumerate() {
            let batch_num = batch_index + 1;
            println!("📦 处理第 {}/{} 批 ({} 个块)", batch_num, total_batches, batch_chunks.len());

            // 发送批次开始事件
            let _ = app_handle.emit("batch_processing_started", ProcessingProgress {
                current: batch_index * batch_size,
                total: chunks.len(),
                percentage: 20.0 + (batch_index as f32 / total_batches as f32) * 70.0,
                stage: "embedding".to_string(),
                message: format!("处理第 {} 批，共 {} 个块", batch_num, batch_chunks.len()),
            });

            // 处理当前批次
            let batch_embeddings = self.process_batch(batch_chunks, model).await?;
            all_embeddings.extend(batch_embeddings);

            // 更新进度
            let processed = processed_count.fetch_add(batch_chunks.len(), Ordering::Relaxed);
            let percentage = 20.0 + ((processed + batch_chunks.len()) as f32 / chunks.len() as f32) * 70.0;

            // 发送批次完成事件
            let _ = app_handle.emit("batch_processing_completed", ProcessingProgress {
                current: processed + batch_chunks.len(),
                total: chunks.len(),
                percentage,
                stage: "embedding".to_string(),
                message: format!("第 {} 批处理完成，已处理 {}/{} 个块", batch_num, processed + batch_chunks.len(), chunks.len()),
            });

            // 添加小延迟，避免过度占用资源
            if batch_num < total_batches {
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
        }

        Ok(all_embeddings)
    }

    /// 处理单个批次
    async fn process_batch(
        &self,
        batch_chunks: &[DocumentChunk],
        model: &str,
    ) -> Result<Vec<EmbeddingResult>, String> {
        let mut batch_embeddings = Vec::new();

        for chunk in batch_chunks {
            let embedding = self.generate_simple_embedding(&chunk.text, 768);
            
            batch_embeddings.push(EmbeddingResult {
                chunk_index: chunk.index,
                chunk_text: chunk.text.clone(),
                embedding,
                model: model.to_string(),
                dimensions: 768,
            });
        }

        Ok(batch_embeddings)
    }
}

// Tauri命令：处理文档嵌入
#[tauri::command]
pub async fn process_document_embeddings(
    request: DocumentProcessingRequest,
    app_handle: AppHandle,
) -> Result<DocumentProcessingResponse, String> {
    let processor = DocumentProcessor::new();
    processor.process_document_embeddings(request, app_handle).await
}

// Tauri命令：只进行文本分块，不生成嵌入
#[tauri::command]
pub async fn chunk_document_text(
    content: String,
    chunk_size: Option<usize>,
    overlap: Option<usize>,
) -> Result<Vec<DocumentChunk>, String> {
    let processor = DocumentProcessor::new();
    let chunk_size = chunk_size.unwrap_or(800);
    let overlap = overlap.unwrap_or(100);
    
    println!("📄 开始文档分块: 内容长度={}, 分块大小={}, 重叠={}", 
             content.len(), chunk_size, overlap);
    
    let chunks = processor.chunk_text(&content, chunk_size, overlap);
    
    println!("✅ 文档分块完成: {} 个块", chunks.len());
    
    Ok(chunks)
}

// Tauri命令：获取处理进度（可选，用于前端轮询）
#[tauri::command]
pub async fn get_processing_progress() -> Result<ProcessingProgress, String> {
    // 这里可以实现进度状态管理
    // 目前通过事件系统实时推送，不需要轮询
    Ok(ProcessingProgress {
        current: 0,
        total: 0,
        percentage: 0.0,
        stage: "idle".to_string(),
        message: "等待处理...".to_string(),
    })
}

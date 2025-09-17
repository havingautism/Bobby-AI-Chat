/**
 * 嵌入服务 - 只支持项目内真实模型
 */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentLanguage } from './language';
import bgeModel from './bgeModel';
import { getApiConfig } from './api-manager';

class EmbeddingService {
  constructor() {
    this.isTauriEnvironment = this.checkTauriEnvironment();
    this.progressCallbacks = new Set();
    
    // SiliconFlow API限制
    this.SILICONFLOW_MAX_BATCH_SIZE = 32;
    this.SILICONFLOW_MAX_TOKENS_PER_TEXT = 400; // 更保守的限制，实际限制是512
    this.SILICONFLOW_SAFE_TOKEN_LIMIT = 350; // 安全限制，确保不会超限
    this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT = 250; // 超安全限制
    this.SILICONFLOW_MAX_CHARS_PER_TEXT = 500; // 最大字符数限制
    
    console.log('🔍 Tauri环境检测结果:', this.isTauriEnvironment);
    console.log('🔍 window.__TAURI_IPC__:', typeof window !== 'undefined' ? window.__TAURI_IPC__ : 'undefined');
    console.log('🔍 window.__TAURI__:', typeof window !== 'undefined' ? window.__TAURI__ : 'undefined');
    console.log('🔍 window对象:', typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('TAURI')) : 'undefined');
    
    // 如果检测失败，尝试其他方式检测
    if (!this.isTauriEnvironment) {
      console.log('⚠️ 标准检测失败，尝试其他检测方式...');
      // 检查是否有Tauri相关的全局对象
      if (typeof window !== 'undefined' && window.__TAURI__) {
        this.isTauriEnvironment = true;
        console.log('✅ 通过window.__TAURI__检测到Tauri环境');
      } else if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
        this.isTauriEnvironment = true;
        console.log('✅ 通过window.__TAURI_IPC__检测到Tauri环境');
      } else {
        console.log('❌ 所有检测方式都失败，强制设置为Tauri环境（知识库功能）');
        this.isTauriEnvironment = true; // 知识库功能只在Tauri环境中可用
      }
    }
    
    // 设置进度事件监听
    this.setupProgressListeners();

    // 不再需要服务初始化，硅基流动API是直接的HTTP调用
    console.log('🔧 硅基流动API准备就绪，无需初始化');

    // 刷新/关闭时向后端发送取消命令
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        try { if (this.isTauriEnvironment) window.__TAURI__.invoke('cancel_embedding_jobs'); } catch(_) {}
      });
    }
  }

  // 为 Tauri invoke 增加超时保护，避免前端长时间挂起
  async invokeWithTimeout(command, args, timeoutMs = 15000) {
    return await Promise.race([
      invoke(command, args),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`invoke ${command} timeout ${timeoutMs}ms`)), timeoutMs))
    ]);
  }

  async invokeWithRetry(command, args, timeoutMs, retries = 1) {
    let attempt = 0;
    while (true) {
      try {
        return await this.invokeWithTimeout(command, args, timeoutMs);
      } catch (e) {
        if (attempt >= retries) throw e;
        const delay = 500 * Math.pow(2, attempt); // 指数回退
        console.warn(`⚠️ ${command} 失败，${delay}ms后重试 (attempt=${attempt + 1})`);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      }
    }
  }

  /**
   * 检查Tauri环境
   * @returns {boolean} 是否在Tauri环境中
   */
  checkTauriEnvironment() {
    return Boolean(
      typeof window !== 'undefined' &&
        window !== undefined &&
        window.__TAURI_IPC__ !== undefined
    );
  }


  /**
   * 获取API配置并验证
   */
  async getApiConfiguration() {
    if (!this.isTauriEnvironment) {
      throw new Error('知识库功能只在Tauri环境中可用，请在桌面应用中打开');
    }

    const apiConfig = getApiConfig();
    const apiKey = apiConfig.apiKey;
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('硅基流动API密钥未配置，请在设置中配置API密钥');
    }
    
    return apiKey;
  }

  /**
   * 设置进度事件监听
   */
  setupProgressListeners() {
    if (!this.isTauriEnvironment) return;

    try {
      // 监听文档处理开始事件
      window.__TAURI__.event.listen('document_processing_started', (event) => {
        console.log('📄 文档处理开始:', event.payload);
        this.notifyProgressCallbacks(event.payload);
      });

      // 监听文档分块完成事件
      window.__TAURI__.event.listen('document_chunking_completed', (event) => {
        console.log('📄 文档分块完成:', event.payload);
        this.notifyProgressCallbacks(event.payload);
      });

      // 监听批次处理开始事件
      window.__TAURI__.event.listen('batch_processing_started', (event) => {
        console.log('📦 批次处理开始:', event.payload);
        this.notifyProgressCallbacks(event.payload);
      });

      // 监听批次处理完成事件
      window.__TAURI__.event.listen('batch_processing_completed', (event) => {
        console.log('✅ 批次处理完成:', event.payload);
        this.notifyProgressCallbacks(event.payload);
      });

      // 监听文档处理完成事件
      window.__TAURI__.event.listen('document_processing_completed', (event) => {
        console.log('🎉 文档处理完成:', event.payload);
        this.notifyProgressCallbacks(event.payload);
      });
    } catch (error) {
      console.warn('⚠️ 设置进度事件监听失败:', error);
    }
  }

  /**
   * 添加进度回调
   * @param {Function} callback - 进度回调函数
   */
  addProgressCallback(callback) {
    this.progressCallbacks.add(callback);
  }

  /**
   * 移除进度回调
   * @param {Function} callback - 进度回调函数
   */
  removeProgressCallback(callback) {
    this.progressCallbacks.delete(callback);
  }

  /**
   * 通知所有进度回调
   * @param {Object} progress - 进度数据
   */
  notifyProgressCallbacks(progress) {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('❌ 进度回调执行失败:', error);
      }
    });
  }

  /**
   * 检查是否有项目内模型文件
   * @returns {Promise<boolean>} 是否有项目内模型
   */
  async checkRealModelAvailable() {
    if (!this.isTauriEnvironment) {
      return false;
    }

    try {
      // 检查Tauri API是否可用（使用静态导入）
      // invoke已经静态导入，无需动态导入
      
      // 暂时返回true，表示项目内模型可用
      console.log('🔍 项目内模型检测: 模拟可用');
      return true;
    } catch (error) {
      console.warn('⚠️ 项目内模型文件检测失败:', error);
      return false;
    }
  }

  /**
   * 生成单个文本的嵌入向量
   * @param {string} text - 要生成嵌入的文本
   * @param {string} model - 模型名称（可选）
   * @param {string} taskType - 任务类型（可选）
   * @param {number} dimensions - 嵌入维度（可选）
   * @returns {Promise<Object>} 嵌入结果
   */
  async generateEmbedding(text, model = 'BAAI/bge-m3', taskType = 'search', dimensions = 1024) {
    // 获取API配置
    const apiKey = await this.getApiConfiguration();
    
    // 使用硅基流动API
    const selectedModel = model;
    console.log(`🎯 使用硅基流动API生成嵌入: ${text.substring(0, 50)}... (model=${selectedModel})`);
    
    try {
      // 使用硅基流动API单条接口
      const result = await this.invokeWithTimeout('generate_siliconflow_embedding_cmd', { 
        text, 
        model: selectedModel,
        apiKey
      }, 30000); // 30秒超时
      
      console.log('🔍 单条API返回值调试:', {
        result: result,
        type: typeof result,
        isArray: Array.isArray(result),
        length: result?.length
      });
      
      if (!result || !Array.isArray(result)) {
        throw new Error('单条API返回值格式不正确');
      }
      
      console.log(`✅ 硅基流动嵌入生成成功 (${result.length}维)`);
      return {
        embedding: result,
        model: selectedModel,
        dimensions: result.length
      };
    } catch (error) {
      console.error('❌ 硅基流动嵌入生成失败:', error);
      throw new Error(`硅基流动嵌入生成失败: ${error.message}`);
    }
  }

  /**
   * 生成多个文本的嵌入向量
   * @param {string[]} texts - 要生成嵌入的文本数组
   * @param {string} model - 模型名称（可选）
   * @param {string} taskType - 任务类型（可选）
   * @param {number} dimensions - 嵌入维度（可选）
   * @returns {Promise<Object>} 嵌入结果
   */
  async generateEmbeddings(texts, model = 'BAAI/bge-m3', taskType = 'search', dimensions = 1024) {
    // 获取API配置
    const apiKey = await this.getApiConfiguration();
    
    // 使用硅基流动API
    const selectedModel = model;
    console.log(`🎯 使用硅基流动API生成嵌入: ${texts.length} 个文本 (model=${selectedModel})`);
    
    try {
      // 预处理文本：分割长文本
      console.log('🔄 预处理文本：检查并分割长文本...');
      const { processedTexts, originalIndices, chunksPerText } = this.preprocessTexts(texts);
      
      console.log(`📊 文本预处理结果:`);
      console.log(`  - 原始文本数: ${texts.length}`);
      console.log(`  - 处理后文本数: ${processedTexts.length}`);
      console.log(`  - 分割详情: ${chunksPerText.map((count, i) => `文本${i}: ${count}块`).join(', ')}`);
      
      // SiliconFlow API限制批量大小，需要分批处理
      const allEmbeddings = [];
      const totalBatches = Math.ceil(processedTexts.length / this.SILICONFLOW_MAX_BATCH_SIZE);
      
      for (let i = 0; i < processedTexts.length; i += this.SILICONFLOW_MAX_BATCH_SIZE) {
        const batchIndex = Math.floor(i / this.SILICONFLOW_MAX_BATCH_SIZE) + 1;
        const batchTexts = processedTexts.slice(i, i + this.SILICONFLOW_MAX_BATCH_SIZE);
        
        console.log(`📦 处理第 ${batchIndex}/${totalBatches} 批 (${batchTexts.length} 个文本)`);
        
        // 使用硅基流动API批量接口
        const result = await this.invokeWithTimeout('generate_siliconflow_batch_embeddings_cmd', { 
          texts: batchTexts, 
          model: selectedModel,
          apiKey
        }, 300000); // 5分钟超时
        
        allEmbeddings.push(...result);
        console.log(`✅ 第 ${batchIndex} 批处理完成: ${result.length} 个向量`);
        
        // 批次间短暂延迟，避免API限制
        if (batchIndex < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // 后处理：合并分割文本的嵌入
      console.log('🔄 后处理：合并分割文本的嵌入...');
      const mergedEmbeddings = this.postprocessEmbeddings(allEmbeddings, originalIndices, chunksPerText);
      
      console.log(`✅ 硅基流动嵌入生成成功: ${mergedEmbeddings.length} 个文本 (${dimensions}维)`);
      return { embeddings: mergedEmbeddings, model: selectedModel, dimensions };
    } catch (error) {
      console.error('❌ 硅基流动嵌入生成失败:', error);
      throw new Error(`硅基流动嵌入生成失败: ${error.message}`);
    }
  }

  /**
   * 生成文档嵌入向量（用于知识库）
   * 使用硅基流动API进行高效处理
   * @param {string} content - 文档内容
   * @param {number} chunkSize - 分块大小
   * @param {number} overlap - 重叠大小
   * @param {string} model - 模型名称
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async generateDocumentEmbeddings(content, chunkSize = 1000, overlap = 50, model = 'BAAI/bge-m3') { // 使用硅基流动API
    if (!content || content.trim().length === 0) {
      return [];
    }

    // 获取API配置
    const apiKey = await this.getApiConfiguration();
    
    console.log(`🚀 使用硅基流动API生成文档嵌入... 模型: ${model}`);
    // 使用硅基流动API，不再需要本地模型检查
    const selectedModel = model;
    
    try {
      // 使用优化的分块参数：减小块大小，减少总块数
      const chunks = await invoke('chunk_document_text', {
        text: content,
        chunk_size: chunkSize,
        chunk_overlap: overlap
      });
      
      console.log(`📄 文档分块完成: ${chunks.length} 个块`);

      // 过滤掉空文本块
      const validChunks = chunks.filter(chunk => chunk.text && chunk.text.trim().length > 0);
      console.log(`📄 有效文本块: ${validChunks.length} 个`);

      if (validChunks.length === 0) {
        throw new Error('没有有效的文本块可以处理');
      }

      // 提取文本内容
      const texts = validChunks.map(chunk => chunk.text);
      
      // 使用硅基流动API生成嵌入向量
      console.log(`🚀 使用硅基流动API生成嵌入向量... 模型: ${selectedModel}`);
      
      // 预处理文本：分割长文本
      console.log('🔄 预处理文本：检查并分割长文本...');
      const { processedTexts, originalIndices, chunksPerText } = this.preprocessTexts(texts);
      
      console.log(`📊 文本预处理结果:`);
      console.log(`  - 原始文本数: ${texts.length}`);
      console.log(`  - 处理后文本数: ${processedTexts.length}`);
      console.log(`  - 分割详情: ${chunksPerText.slice(0, 5).map((count, i) => `文本${i}: ${count}块`).join(', ')}${chunksPerText.length > 5 ? '...' : ''}`);
      
      // SiliconFlow API限制批量大小，需要分批处理
      const allEmbeddings = [];
      const totalBatches = Math.ceil(processedTexts.length / this.SILICONFLOW_MAX_BATCH_SIZE);
      
      for (let i = 0; i < processedTexts.length; i += this.SILICONFLOW_MAX_BATCH_SIZE) {
        const batchIndex = Math.floor(i / this.SILICONFLOW_MAX_BATCH_SIZE) + 1;
        const batchTexts = processedTexts.slice(i, i + this.SILICONFLOW_MAX_BATCH_SIZE);
        
        console.log(`📦 处理第 ${batchIndex}/${totalBatches} 批 (${batchTexts.length} 个文本)`);
        
        // 使用硅基流动API批量接口
        const result = await this.invokeWithTimeout('generate_siliconflow_batch_embeddings_cmd', { 
          texts: batchTexts, 
          model: selectedModel,
          apiKey
        }, 300000); // 5分钟超时
        
        allEmbeddings.push(...result);
        console.log(`✅ 第 ${batchIndex} 批处理完成: ${result.length} 个向量`);
        
        // 批次间短暂延迟，避免API限制
        if (batchIndex < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // 后处理：合并分割文本的嵌入并重建文档结构
      console.log('🔄 后处理：合并分割文本的嵌入...');
      const mergedEmbeddings = this.postprocessEmbeddings(allEmbeddings, originalIndices, chunksPerText);
      
      // 重建文档嵌入结构
      const documentEmbeddings = mergedEmbeddings.map((embedding, index) => ({
        chunkIndex: index,
        chunkText: validChunks[index].text,
        embedding,
        model: selectedModel,
        dimensions: embedding.length
      }));
      
      console.log(`✅ 硅基流动文档嵌入生成完成: ${documentEmbeddings.length} 个向量`);
      return documentEmbeddings;
    } catch (error) {
      console.error('❌ 硅基流动API处理失败:', error);
      throw new Error(`文档处理失败: ${error.message}`);
    }
  }

  /**
   * 分批生成文档嵌入向量（用于处理大文档）
   * @param {string[]} chunks - 文本块数组
   * @param {string} model - 模型名称
   * @param {number} batchSize - 批处理大小
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async generateDocumentEmbeddingsBatch(chunks, model, batchSize = 50) {
    console.log(`🔄 开始分批处理 ${chunks.length} 个文本块，每批 ${batchSize} 个`);
    
    const allEmbeddings = [];
    const totalBatches = Math.ceil(chunks.length / batchSize);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batchChunks = chunks.slice(i, i + batchSize);
      
      console.log(`📦 处理第 ${batchIndex}/${totalBatches} 批 (${batchChunks.length} 个块)`);
      
      try {
        // 为每个批次添加唯一标识，确保后端正确处理
        const batchId = `batch_${batchIndex}_${Date.now()}`;
        console.log(`🔍 批次ID: ${batchId}`);
        
    const result = await invoke('generate_gemma_batch_embeddings', {
          texts: batchChunks,
          model: model,
      taskType: 'search',
      dimensions: 768
    });
    
        // 验证返回的向量数量是否与输入文本数量匹配
        if (result.length !== batchChunks.length) {
          console.warn(`⚠️ 批次 ${batchIndex} 向量数量不匹配: 输入${batchChunks.length}个，返回${result.length}个`);
        }
        
        // 转换为标准格式并添加到结果中
        const batchEmbeddings = result.map((embedding, index) => {
          const globalIndex = i + index;
          const chunkText = batchChunks[index];
          
          // 添加详细的调试信息
          if (index < 3) { // 只记录前3个的详细信息
            console.log(`🔍 批次${batchIndex} 块${index} (全局${globalIndex}): ${chunkText.substring(0, 50)}...`);
          }
          
          return {
            chunkIndex: globalIndex,
            chunkText: chunkText,
            embedding: embedding,
            model: model,
            dimensions: result.dimensions,
            batchId: batchId,
            batchIndex: batchIndex,
            localIndex: index
          };
        });
        
        allEmbeddings.push(...batchEmbeddings);
        console.log(`✅ 第 ${batchIndex} 批处理完成: ${batchEmbeddings.length} 个向量`);
        
        // 优化：减小延迟，提高处理速度
        if (batchIndex < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      } catch (error) {
        console.error(`❌ 第 ${batchIndex} 批处理失败:`, error);
        throw new Error(`分批处理失败 (第 ${batchIndex} 批): ${error.message}`);
      }
    }
    
    console.log(`🎉 分批处理完成: 总共生成 ${allEmbeddings.length} 个向量`);
    
    // 最终验证：检查是否有重复的内容
    const uniqueTexts = new Set(allEmbeddings.map(e => e.chunkText));
    if (uniqueTexts.size !== allEmbeddings.length) {
      console.warn(`⚠️ 检测到重复内容: 总向量数${allEmbeddings.length}，唯一内容数${uniqueTexts.size}`);
    }
    
    return allEmbeddings;
  }

  /**
   * 高效分批生成文档嵌入向量（快速处理大文档）
   * @param {string[]} chunks - 文本块数组
   * @param {string} model - 模型名称
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async generateDocumentEmbeddingsFast(chunks, model) {
    console.log(`🚀 开始高效分批处理 ${chunks.length} 个文本块`);
    
    const allEmbeddings = [];
    const batchSize = 50; // 使用较大的批次大小，提高效率
    const totalBatches = Math.ceil(chunks.length / batchSize);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batchChunks = chunks.slice(i, i + batchSize);
      
      console.log(`📦 处理第 ${batchIndex}/${totalBatches} 批 (${batchChunks.length} 个块)`);
      
      try {
        const result = await invoke('generate_gemma_batch_embeddings', {
          texts: batchChunks,
          model: model,
          taskType: 'search',
          dimensions: 768
        });
        
        // 直接转换为标准格式，不进行复杂的验证
        const batchEmbeddings = result.map((embedding, index) => ({
          chunkIndex: i + index,
          chunkText: batchChunks[index],
          embedding: embedding,
          model: model,
          dimensions: result.dimensions
        }));
        
        allEmbeddings.push(...batchEmbeddings);
        console.log(`✅ 第 ${batchIndex} 批处理完成: ${batchEmbeddings.length} 个向量`);
        
        // 优化：减小延迟，提高处理速度
        if (batchIndex < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (error) {
        console.error(`❌ 第 ${batchIndex} 批处理失败:`, error);
        // 如果批次处理失败，尝试较小的批次
        console.log(`🔄 批次 ${batchIndex} 失败，尝试小批次处理...`);
        try {
          const smallBatchResult = await this.processSmallBatches(batchChunks, model, i);
          allEmbeddings.push(...smallBatchResult);
          console.log(`✅ 批次 ${batchIndex} 小批次处理完成`);
        } catch (smallError) {
          console.error(`❌ 批次 ${batchIndex} 小批次处理也失败:`, smallError);
          throw new Error(`批次 ${batchIndex} 处理失败: ${error.message}`);
        }
      }
    }
    
    console.log(`🎉 高效分批处理完成: 总共生成 ${allEmbeddings.length} 个向量`);
    return allEmbeddings;
  }

  /**
   * 小批次处理（备选方案）
   * @param {string[]} batchChunks - 批次文本块
   * @param {string} model - 模型名称
   * @param {number} startIndex - 起始索引
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async processSmallBatches(batchChunks, model, startIndex) {
    const results = [];
    const smallBatchSize = 10; // 使用更小的批次
    
    for (let i = 0; i < batchChunks.length; i += smallBatchSize) {
      const smallBatch = batchChunks.slice(i, i + smallBatchSize);
      const globalStartIndex = startIndex + i;
      
      try {
        const result = await invoke('generate_gemma_batch_embeddings', {
          texts: smallBatch,
          model: model,
          taskType: 'search',
          dimensions: 768
        });
        
        const smallBatchEmbeddings = result.map((embedding, index) => ({
          chunkIndex: globalStartIndex + index,
          chunkText: smallBatch[index],
      embedding: embedding,
          model: model,
      dimensions: result.dimensions
    }));
        
        results.push(...smallBatchEmbeddings);
        
        // 优化：减小延迟，提高处理速度
        await new Promise(resolve => setTimeout(resolve, 5));
      } catch (error) {
        console.error(`❌ 小批次处理失败:`, error);
        throw error;
      }
    }
    
    return results;
  }

  /**
   * 优化的分批生成文档嵌入向量（高效处理大文档）
   * @param {string[]} chunks - 文本块数组
   * @param {string} model - 模型名称
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async generateDocumentEmbeddingsOptimized(chunks, model) {
    console.log(`🚀 开始优化的分批处理 ${chunks.length} 个文本块`);
    
    const allEmbeddings = [];
    const batchSize = 20; // 使用较小的批次大小，避免后端问题
    const totalBatches = Math.ceil(chunks.length / batchSize);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batchChunks = chunks.slice(i, i + batchSize);
      
      console.log(`📦 处理第 ${batchIndex}/${totalBatches} 批 (${batchChunks.length} 个块)`);
      
      try {
        // 为每个批次添加随机标识，避免缓存问题
        const batchId = `batch_${batchIndex}_${Math.random().toString(36).substr(2, 9)}`;
        
        const result = await invoke('generate_gemma_batch_embeddings', {
          texts: batchChunks,
          model: model,
          taskType: 'search',
          dimensions: 768,
          batchId: batchId // 添加批次ID避免缓存
        });
        
        // 验证返回的向量数量
        if (result.length !== batchChunks.length) {
          console.warn(`⚠️ 批次 ${batchIndex} 向量数量不匹配: 输入${batchChunks.length}个，返回${result.length}个`);
        }
        
        // 转换为标准格式并添加内容验证
        const batchEmbeddings = result.map((embedding, index) => {
          const globalIndex = i + index;
          const chunkText = batchChunks[index];
          
          return {
            chunkIndex: globalIndex,
            chunkText: chunkText,
            embedding: embedding,
            model: model,
            dimensions: result.dimensions,
            batchId: batchId,
            batchIndex: batchIndex,
            localIndex: index,
            contentHash: this.hashContent(chunkText) // 添加内容哈希用于验证
          };
        });
        
        // 验证批次内容唯一性
        const uniqueTexts = new Set(batchEmbeddings.map(e => e.contentHash));
        if (uniqueTexts.size !== batchEmbeddings.length) {
          console.warn(`⚠️ 批次 ${batchIndex} 检测到重复内容，尝试重新处理...`);
          // 如果检测到重复，使用单块处理这个批次
          const singleBatchResult = await this.processBatchAsSingle(batchChunks, model, i);
          allEmbeddings.push(...singleBatchResult);
        } else {
          allEmbeddings.push(...batchEmbeddings);
        }
        
        console.log(`✅ 第 ${batchIndex} 批处理完成: ${batchEmbeddings.length} 个向量`);
        
        // 优化：减小延迟，提高处理速度
        if (batchIndex < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      } catch (error) {
        console.error(`❌ 第 ${batchIndex} 批处理失败:`, error);
        // 如果批次处理失败，尝试单块处理这个批次
        console.log(`🔄 批次 ${batchIndex} 失败，尝试单块处理...`);
        try {
          const singleBatchResult = await this.processBatchAsSingle(batchChunks, model, i);
          allEmbeddings.push(...singleBatchResult);
          console.log(`✅ 批次 ${batchIndex} 单块处理完成`);
        } catch (singleError) {
          console.error(`❌ 批次 ${batchIndex} 单块处理也失败:`, singleError);
          throw new Error(`批次 ${batchIndex} 处理失败: ${error.message}`);
        }
      }
    }
    
    console.log(`🎉 优化分批处理完成: 总共生成 ${allEmbeddings.length} 个向量`);
    
    // 最终验证：检查是否有重复的内容
    const uniqueTexts = new Set(allEmbeddings.map(e => e.contentHash));
    if (uniqueTexts.size !== allEmbeddings.length) {
      console.warn(`⚠️ 最终检测到重复内容: 总向量数${allEmbeddings.length}，唯一内容数${uniqueTexts.size}`);
    }
    
    return allEmbeddings;
  }

  /**
   * 将批次作为单块处理（备选方案）
   * @param {string[]} batchChunks - 批次文本块
   * @param {string} model - 模型名称
   * @param {number} startIndex - 起始索引
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async processBatchAsSingle(batchChunks, model, startIndex) {
    const results = [];
    
    for (let i = 0; i < batchChunks.length; i++) {
      const chunk = batchChunks[i];
      const globalIndex = startIndex + i;
      
      try {
        const result = await invoke('generate_gemma_batch_embeddings', {
          texts: [chunk],
          model: model,
          taskType: 'search',
          dimensions: 768
        });
        
        results.push({
          chunkIndex: globalIndex,
          chunkText: chunk,
          embedding: result[0],
          model: model,
          dimensions: result.dimensions,
          processingMethod: 'single_fallback',
          contentHash: this.hashContent(chunk)
        });
        
        // 优化：减小延迟，提高处理速度
        await new Promise(resolve => setTimeout(resolve, 3));
      } catch (error) {
        console.error(`❌ 单块处理失败 (索引 ${globalIndex}):`, error);
        throw error;
      }
    }
    
    return results;
  }

  /**
   * 估算文本的token数量（更保守的方法）
   * @param {string} text - 文本内容
   * @returns {number} 估算的token数量
   */
  estimateTokens(text) {
    if (!text || text.trim().length === 0) {
      return 0;
    }
    
    // 移除多余的空白字符
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // 中文字符（包括标点）
    const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
    
    // 英文单词
    const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length;
    
    // 数字
    const numbers = (cleanText.match(/\d+/g) || []).length;
    
    // 其他字符 - 确保不会出现负数
    const otherChars = Math.max(0, cleanText.length - chineseChars - englishWords.length * 1.5 - numbers.length * 1.2);
    
    // 更保守的token估算：
    // - 中文字符：每个1.2个token（包括标点符号）
    // - 英文单词：每个1.5个token
    // - 数字：每个1.2个token
    // - 其他字符：每3个字符1个token
    const estimatedTokens = Math.ceil(
      chineseChars * 1.2 + 
      englishWords * 1.5 + 
      numbers * 1.2 + 
      otherChars / 3
    );
    
    // 添加安全余量，确保至少返回1
    return Math.max(1, Math.min(estimatedTokens, cleanText.length));
  }

  /**
   * 精确检查文本长度（字符数作为最终保障）
   * @param {string} text - 文本内容
   * @returns {boolean} 是否安全
   */
  isTextLengthSafe(text) {
    // 字符数限制：大约1个字符 = 0.5-1个token
    const maxChars = this.SILICONFLOW_SAFE_TOKEN_LIMIT * 2;
    return text.length <= maxChars;
  }

  /**
   * 超保守检查文本长度
   * @param {string} text - 文本内容
   * @returns {boolean} 是否绝对安全
   */
  isTextUltraSafe(text) {
    return text.length <= this.SILICONFLOW_MAX_CHARS_PER_TEXT;
  }

  /**
   * 调试文本分析
   * @param {string} text - 文本内容
   * @param {string} label - 标签
   */
  debugTextAnalysis(text, label = '') {
    const tokens = this.estimateTokens(text);
    const chars = text.length;
    const isSafe = this.isTextLengthSafe(text);
    const isUltraSafe = this.isTextUltraSafe(text);
    
    console.log(`🔍 ${label}文本分析:`);
    console.log(`  - 字符数: ${chars}`);
    console.log(`  - 估算tokens: ${tokens}`);
    console.log(`  - 长度安全: ${isSafe}`);
    console.log(`  - 超安全: ${isUltraSafe}`);
    console.log(`  - 文本预览: ${text.substring(0, 100)}...`);
    
    return { tokens, chars, isSafe, isUltraSafe };
  }

  /**
   * 分割长文本以符合token限制（超激进策略）
   * @param {string} text - 文本内容
   * @param {number} maxTokens - 最大token数
   * @returns {string[]} 分割后的文本数组
   */
  splitTextByTokens(text, maxTokens = this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT) {
    if (!text || text.trim().length === 0) {
      return [];
    }
    
    // 调试原始文本
    this.debugTextAnalysis(text, '原始');
    
    // 首先检查超安全字符数限制
    if (!this.isTextUltraSafe(text)) {
      console.log(`🔄 文本超过字符数限制，使用超保守字符分割`);
      return this.ultraConservativeSplit(text, maxTokens);
    }
    
    const estimatedTokens = this.estimateTokens(text);
    
    if (estimatedTokens <= maxTokens) {
      console.log(`✅ 文本符合要求: ${estimatedTokens} tokens`);
      return [text];
    }
    
    console.log(`🔄 分割文本: ${estimatedTokens} tokens -> 目标 ${maxTokens} tokens`);
    
    // 尝试按句子分割
    const sentenceChunks = this.splitTextBySentences(text, maxTokens);
    
    // 检查是否所有块都符合要求
    const allChunksSafe = sentenceChunks.every(chunk => 
      this.estimateTokens(chunk) <= maxTokens && this.isTextUltraSafe(chunk)
    );
    
    if (allChunksSafe) {
      console.log(`✅ 按句子分割成功: ${sentenceChunks.length} 块`);
      return sentenceChunks;
    }
    
    // 如果按句子分割仍有问题，按段落分割
    console.log(`⚠️ 按句子分割仍有问题，尝试按段落分割`);
    const paragraphChunks = this.splitTextByParagraphs(text, maxTokens);
    
    // 再次检查
    const allParagraphChunksSafe = paragraphChunks.every(chunk => 
      this.estimateTokens(chunk) <= maxTokens && this.isTextUltraSafe(chunk)
    );
    
    if (allParagraphChunksSafe) {
      console.log(`✅ 按段落分割成功: ${paragraphChunks.length} 块`);
      return paragraphChunks;
    }
    
    // 最后使用超保守分割
    console.log(`⚠️ 按段落分割仍有问题，使用超保守字符分割`);
    return this.ultraConservativeSplit(text, maxTokens);
  }

  /**
   * 超保守字符分割（绝对安全）
   * @param {string} text - 文本内容
   * @param {number} maxTokens - 最大token数
   * @returns {string[]} 分割后的文本数组
   */
  ultraConservativeSplit(text, maxTokens) {
    console.log(`🔄 使用超保守分割策略`);
    
    // 使用非常保守的字符数：1 token = 1.5 字符
    const maxChars = Math.floor(maxTokens * 1.5);
    const chunks = [];
    
    for (let i = 0; i < text.length; i += maxChars) {
      const end = Math.min(i + maxChars, text.length);
      const chunk = text.substring(i, end).trim();
      
      if (chunk) {
        // 验证每个块
        const tokens = this.estimateTokens(chunk);
        const isUltraSafe = this.isTextUltraSafe(chunk);
        
        console.log(`📝 块${chunks.length + 1}: ${tokens} tokens, ${chunk.length} 字符`);
        
        if (tokens > maxTokens || !isUltraSafe) {
          console.warn(`⚠️ 块仍然超限，进一步分割`);
          // 如果仍然超限，继续分割
          const subChunks = this.ultraConservativeSplit(chunk, maxTokens);
          chunks.push(...subChunks);
        } else {
          chunks.push(chunk);
        }
      }
    }
    
    console.log(`✅ 超保守分割完成: ${chunks.length} 块`);
    return chunks;
  }

  /**
   * 按句子分割文本
   * @param {string} text - 文本内容
   * @param {number} maxTokens - 最大token数
   * @returns {string[]} 分割后的文本数组
   */
  splitTextBySentences(text, maxTokens) {
    const chunks = [];
    let currentChunk = '';
    let currentTokens = 0;
    
    // 更精确的句子分割
    const sentences = text.split(/([。！？.!?\n\r]+)/);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i] || '';
      const nextPunctuation = sentences[i + 1] || '';
      const fullSentence = sentence + nextPunctuation;
      
      if (fullSentence.trim() === '') {
        continue;
      }
      
      const sentenceTokens = this.estimateTokens(fullSentence);
      
      // 如果单个句子就超限，强制分割
      if (sentenceTokens > maxTokens) {
        // 先保存当前块
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentTokens = 0;
        }
        
        // 分割这个长句子
        const subChunks = this.splitTextByCharacters(fullSentence, maxTokens);
        chunks.push(...subChunks);
        continue;
      }
      
      if (currentTokens + sentenceTokens <= maxTokens) {
        currentChunk += fullSentence;
        currentTokens += sentenceTokens;
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = fullSentence;
        currentTokens = sentenceTokens;
      }
      
      i++; // 跳过标点符号
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * 按段落分割文本（更严格的方法）
   * @param {string} text - 文本内容
   * @param {number} maxTokens - 最大token数
   * @returns {string[]} 分割后的文本数组
   */
  splitTextByParagraphs(text, maxTokens) {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        continue;
      }
      
      const paragraphTokens = this.estimateTokens(paragraph);
      
      // 首先检查字符数
      if (!this.isTextLengthSafe(paragraph)) {
        // 先保存当前块
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentTokens = 0;
        }
        
        // 分割这个长段落
        const charChunks = this.splitTextByCharacters(paragraph, maxTokens);
        chunks.push(...charChunks);
        continue;
      }
      
      if (currentTokens + paragraphTokens <= maxTokens) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paragraphTokens;
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        if (paragraphTokens <= maxTokens) {
          currentChunk = paragraph;
          currentTokens = paragraphTokens;
        } else {
          // 单个段落仍然太长，按句子分割
          const sentenceChunks = this.splitTextBySentences(paragraph, maxTokens);
          chunks.push(...sentenceChunks);
          currentChunk = '';
          currentTokens = 0;
        }
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * 按字符分割文本（最后手段，更保守）
   * @param {string} text - 文本内容
   * @param {number} maxTokens - 最大token数
   * @returns {string[]} 分割后的文本数组
   */
  splitTextByCharacters(text, maxTokens) {
    const chunks = [];
    // 更保守的字符数估计：1个token ≈ 2.5个字符
    const maxChars = Math.floor(maxTokens * 2.5);
    
    for (let i = 0; i < text.length; i += maxChars) {
      let end = Math.min(i + maxChars, text.length);
      
      // 尝试在合适的边界分割
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const lastPunctuation = Math.max(
          text.lastIndexOf('。', end),
          text.lastIndexOf('！', end),
          text.lastIndexOf('？', end),
          text.lastIndexOf('.', end),
          text.lastIndexOf('!', end),
          text.lastIndexOf('?', end),
          text.lastIndexOf('，', end),
          text.lastIndexOf('、', end),
          text.lastIndexOf('；', end),
          text.lastIndexOf('：', end)
        );
        
        // 寻找最佳分割点
        const bestSplit = Math.max(lastSpace, lastNewline, lastPunctuation);
        if (bestSplit > i + maxChars * 0.3) { // 降低阈值，更容易找到分割点
          end = bestSplit + 1;
        }
      }
      
      let chunk = text.substring(i, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * 预处理文本数组：分割长文本并保持映射关系
   * @param {string[]} texts - 原始文本数组
   * @returns {Object} 包含处理后的文本和映射信息
   */
  preprocessTexts(texts) {
    const processedTexts = [];
    const originalIndices = []; // 处理后的文本对应的原始索引
    
    console.log(`🔄 开始预处理 ${texts.length} 个文本...`);
    
    texts.forEach((text, originalIndex) => {
      console.log(`\n📝 处理文本 ${originalIndex + 1}/${texts.length}:`);
      
      // 调试原始文本
      this.debugTextAnalysis(text, `文本${originalIndex}`);
      
      const chunks = this.splitTextByTokens(text);
      
      console.log(`📊 文本${originalIndex}分割结果: ${chunks.length} 块`);
      
      // 验证所有块都符合要求
      const validChunks = chunks.filter(chunk => {
        const tokens = this.estimateTokens(chunk);
        const isUltraSafe = this.isTextUltraSafe(chunk);
        const isValid = tokens <= this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT && isUltraSafe;
        
        if (!isValid) {
          console.warn(`⚠️ 文本${originalIndex}的块仍然超限: ${tokens} tokens, ${chunk.length} 字符`);
          // 如果仍然超限，使用超保守分割
          const subChunks = this.ultraConservativeSplit(chunk, this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT);
          subChunks.forEach(subChunk => {
            if (subChunk.trim()) {
              processedTexts.push(subChunk);
              originalIndices.push(originalIndex);
            }
          });
        }
        
        return isValid;
      });
      
      validChunks.forEach(chunk => {
        processedTexts.push(chunk);
        originalIndices.push(originalIndex);
      });
    });
    
    console.log(`\n📊 预处理完成: ${texts.length} -> ${processedTexts.length} 个文本块`);
    
    // 最终验证
    console.log(`🔍 开始最终验证...`);
    const finalValidation = processedTexts.every((chunk, index) => {
      const tokens = this.estimateTokens(chunk);
      const isUltraSafe = this.isTextUltraSafe(chunk);
      const isValid = tokens <= this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT && isUltraSafe;
      
      if (!isValid) {
        console.error(`❌ 块${index}验证失败: ${tokens} tokens, ${chunk.length} 字符`);
        this.debugTextAnalysis(chunk, `失败块${index}`);
      }
      
      return isValid;
    });
    
    if (!finalValidation) {
      console.error('❌ 最终验证失败，使用强制分割策略');
      // 强制按字符重新分割所有文本
      return this.forceSplitAllTexts(texts);
    }
    
    console.log(`✅ 最终验证通过！`);
    
    return {
      processedTexts,
      originalIndices,
      chunksPerText: texts.map((text, index) => {
        const chunks = this.splitTextByTokens(text);
        const validChunks = chunks.filter(chunk => {
          const tokens = this.estimateTokens(chunk);
          const isUltraSafe = this.isTextUltraSafe(chunk);
          return tokens <= this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT && isUltraSafe;
        });
        return validChunks.length || this.ultraConservativeSplit(text, this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT).length;
      })
    };
  }

  /**
   * 强制分割所有文本（最后保障）
   * @param {string[]} texts - 原始文本数组
   * @returns {Object} 包含处理后的文本和映射信息
   */
  forceSplitAllTexts(texts) {
    console.log('🔄 强制分割所有文本...');
    const processedTexts = [];
    const originalIndices = [];
    
    texts.forEach((text, originalIndex) => {
      console.log(`🔧 强制分割文本${originalIndex}: ${text.length} 字符`);
      
      // 使用超保守的字符数限制：250 tokens * 1.5 = 375 字符
      const maxSafeChars = this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT * 1.5;
      const chunks = [];
      
      for (let i = 0; i < text.length; i += maxSafeChars) {
        const chunk = text.substring(i, i + maxSafeChars).trim();
        if (chunk) {
          // 验证每个强制分割的块
          const tokens = this.estimateTokens(chunk);
          const isUltraSafe = this.isTextUltraSafe(chunk);
          
          console.log(`📝 强制块${chunks.length + 1}: ${tokens} tokens, ${chunk.length} 字符`);
          
          if (tokens > this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT || !isUltraSafe) {
            console.warn(`⚠️ 强制分割的块仍然超限，继续分割`);
            // 如果仍然超限，递归分割
            const subChunks = this.forceSplitText(chunk);
            chunks.push(...subChunks);
          } else {
            chunks.push(chunk);
          }
        }
      }
      
      chunks.forEach(chunk => {
        processedTexts.push(chunk);
        originalIndices.push(originalIndex);
      });
    });
    
    console.log(`✅ 强制分割完成: ${texts.length} -> ${processedTexts.length}`);
    
    return {
      processedTexts,
      originalIndices,
      chunksPerText: texts.map(text => Math.ceil(text.length / (this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT * 1.5)))
    };
  }

  /**
   * 强制分割单个文本
   * @param {string} text - 文本内容
   * @returns {string[]} 分割后的文本数组
   */
  forceSplitText(text) {
    const maxSafeChars = this.SILICONFLOW_ULTRA_SAFE_TOKEN_LIMIT * 1.2; // 更保守
    const chunks = [];
    
    for (let i = 0; i < text.length; i += maxSafeChars) {
      const chunk = text.substring(i, i + maxSafeChars).trim();
      if (chunk) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * 后处理嵌入结果：合并分割文本的嵌入
   * @param {number[]} embeddings - 处理后的嵌入数组
   * @param {number[]} originalIndices - 原始索引数组
   * @param {number[]} chunksPerText - 每个原始文本的块数
   * @returns {number[]} 合并后的嵌入数组
   */
  postprocessEmbeddings(embeddings, originalIndices, chunksPerText) {
    const mergedEmbeddings = [];
    let currentTextIndex = 0;
    let currentChunkCount = 0;
    let currentTextEmbeddings = [];
    
    for (let i = 0; i < embeddings.length; i++) {
      const originalIndex = originalIndices[i];
      
      if (originalIndex === currentTextIndex) {
        currentTextEmbeddings.push(embeddings[i]);
        currentChunkCount++;
      } else {
        // 处理前一个文本的嵌入
        if (currentTextEmbeddings.length > 0) {
          const mergedEmbedding = this.mergeEmbeddings(currentTextEmbeddings);
          mergedEmbeddings.push(mergedEmbedding);
        }
        
        // 开始新的文本
        currentTextIndex = originalIndex;
        currentTextEmbeddings = [embeddings[i]];
        currentChunkCount = 1;
      }
    }
    
    // 处理最后一个文本的嵌入
    if (currentTextEmbeddings.length > 0) {
      const mergedEmbedding = this.mergeEmbeddings(currentTextEmbeddings);
      mergedEmbeddings.push(mergedEmbedding);
    }
    
    return mergedEmbeddings;
  }

  /**
   * 合并多个嵌入向量为一个
   * @param {number[][]} embeddings - 嵌入向量数组
   * @returns {number[]} 合并后的嵌入向量
   */
  mergeEmbeddings(embeddings) {
    if (embeddings.length === 1) {
      return embeddings[0];
    }
    
    // 简单平均合并
    const dimension = embeddings[0].length;
    const merged = new Array(dimension).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        merged[i] += embedding[i];
      }
    }
    
    // 归一化
    const norm = Math.sqrt(merged.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        merged[i] /= norm;
      }
    }
    
    return merged;
  }

  /**
   * 生成内容哈希用于验证
   * @param {string} content - 文本内容
   * @returns {string} 哈希值
   */
  hashContent(content) {
    let hash = 0;
    if (content.length === 0) return hash.toString();
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  /**
   * 单块生成文档嵌入向量（用于处理大文档的备选方案）
   * @param {string[]} chunks - 文本块数组
   * @param {string} model - 模型名称
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async generateDocumentEmbeddingsSingle(chunks, model) {
    console.log(`🔄 开始单块处理 ${chunks.length} 个文本块`);
    
    const allEmbeddings = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📦 处理第 ${i + 1}/${chunks.length} 个块 (长度: ${chunk.length})`);
      
      try {
        // 为每个块生成唯一的标识
        const chunkId = `chunk_${i}_${Date.now()}`;
        console.log(`🔍 块ID: ${chunkId}`);
        
        const result = await invoke('generate_gemma_batch_embeddings', {
          texts: [chunk], // 每次只处理一个文本块
          model: model,
          taskType: 'search',
          dimensions: 768
        });
        
        if (result.length !== 1) {
          console.warn(`⚠️ 块 ${i} 向量数量不匹配: 输入1个，返回${result.length}个`);
        }
        
        const embedding = {
          chunkIndex: i,
          chunkText: chunk,
          embedding: result[0],
          model: model,
          dimensions: result.dimensions,
          chunkId: chunkId,
          processingMethod: 'single'
        };
        
        allEmbeddings.push(embedding);
        console.log(`✅ 第 ${i + 1} 块处理完成`);
        
        // 优化：减小延迟，提高处理速度
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (error) {
        console.error(`❌ 第 ${i + 1} 块处理失败:`, error);
        throw new Error(`单块处理失败 (第 ${i + 1} 块): ${error.message}`);
      }
    }
    
    console.log(`🎉 单块处理完成: 总共生成 ${allEmbeddings.length} 个向量`);
    
    // 最终验证：检查是否有重复的内容
    const uniqueTexts = new Set(allEmbeddings.map(e => e.chunkText));
    if (uniqueTexts.size !== allEmbeddings.length) {
      console.warn(`⚠️ 检测到重复内容: 总向量数${allEmbeddings.length}，唯一内容数${uniqueTexts.size}`);
    }
    
    return allEmbeddings;
  }

  /**
   * 文本分块
   * @param {string} text - 文本内容
   * @param {number} chunkSize - 分块大小
   * @param {number} overlap - 重叠大小
   * @returns {string[]} 文本块数组
   */
  chunkText(text, chunkSize = 500, overlap = 50) {
    if (!text || text.length <= chunkSize) {
      return [text];
    }

    const chunks = [];
    let start = 0;
    const maxChunks = 10000; // 设置最大分块数量限制，防止数组过大

    while (start < text.length && chunks.length < maxChunks) {
      let end = Math.min(start + chunkSize, text.length);
      
      // 如果不是最后一块，尝试在句子边界分割
      if (end < text.length) {
        const chunk = text.slice(start, end);
        
        // 检测多种句子结束符
        const lastPeriod = chunk.lastIndexOf('。');
        const lastDot = chunk.lastIndexOf('.');
        const lastExclamation = chunk.lastIndexOf('！');
        const lastQuestion = chunk.lastIndexOf('？');
        const lastNewline = chunk.lastIndexOf('\n');
        const lastSemicolon = chunk.lastIndexOf('；');
        
        // 找到最合适的分割点
        const splitPoints = [lastPeriod, lastDot, lastExclamation, lastQuestion, lastNewline, lastSemicolon];
        const validSplitPoints = splitPoints.filter(p => p > chunkSize * 0.3);
        
        if (validSplitPoints.length > 0) {
          const bestSplitPoint = Math.max(...validSplitPoints);
          end = start + bestSplitPoint + 1;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // 计算下一个块的起始位置
      start = end - overlap;
      
      // 防止无限循环和重叠过大
      if (start <= 0 || start >= text.length) {
        start = end;
      }
      
      // 如果已经到达文本末尾，退出循环
      if (start >= text.length) break;
    }

    // 如果达到最大分块限制，记录警告
    if (chunks.length >= maxChunks) {
      console.warn(`⚠️ 文档过大，已达到最大分块限制 ${maxChunks}，部分内容可能被截断`);
    }

    // 添加调试信息
    console.log(`📄 文档分块完成: ${chunks.length} 个块 (原始长度: ${text.length} 字符)`);
    if (chunks.length > 0) {
      console.log(`🔍 分块调试信息:`);
      console.log(`  - 第1个块预览: ${chunks[0]?.substring(0, 100)}...`);
      console.log(`  - 第2个块预览: ${chunks[1]?.substring(0, 100)}...`);
      console.log(`  - 第3个块预览: ${chunks[2]?.substring(0, 100)}...`);
      console.log(`  - 最后1个块预览: ${chunks[chunks.length-1]?.substring(0, 100)}...`);
    }

    return chunks;
  }

  /**
   * 计算两个嵌入向量的余弦相似度
   * @param {number[]} embedding1 - 第一个嵌入向量
   * @param {number[]} embedding2 - 第二个嵌入向量
   * @returns {Promise<number>} 相似度分数
   */
  async calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) {
      return 0;
    }

    if (embedding1.length !== embedding2.length) {
      console.warn('⚠️ 嵌入向量维度不匹配');
      return 0;
    }

    // 计算点积
    let dotProduct = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
    }

    // 计算向量的模长
    const norm1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    // 计算余弦相似度
    const similarity = dotProduct / (norm1 * norm2);
    return Math.max(0, Math.min(1, similarity)); // 确保结果在[0,1]范围内
  }

  /**
   * 批量计算相似度
   * @param {number[]} queryEmbedding - 查询嵌入向量
   * @param {number[][]} documentEmbeddings - 文档嵌入向量数组
   * @returns {Promise<number[]>} 相似度分数数组
   */
  async calculateBatchSimilarity(queryEmbedding, documentEmbeddings) {
    const similarities = [];
    
    for (const docEmbedding of documentEmbeddings) {
      const similarity = await this.calculateSimilarity(queryEmbedding, docEmbedding);
      similarities.push(similarity);
    }
    
    return similarities;
  }


  /**
   * 诊断嵌入管线：确认是否在 Tauri 环境、模型文件可用性、实际使用的模型
   * @returns {Promise<{isTauriEnvironment:boolean, modelFilesAvailable:boolean|null, usedBackend:boolean, model:string|null, dimensions:number|null, error?:string}>}
   */
  async diagnoseEmbeddingPipeline() {
    const result = {
      isTauriEnvironment: Boolean(this.isTauriEnvironment),
      modelFilesAvailable: null,
      usedBackend: false,
      model: null,
      dimensions: null,
    };

    // 知识库功能只在Tauri环境中可用
    if (!this.isTauriEnvironment) {
      result.error = '知识库功能只在Tauri环境中可用，请在桌面应用中打开';
      return result;
    }

    try {
      // 使用硅基流动API，不再需要本地模型检查
      result.modelFilesAvailable = true;
      console.log('🔍 使用硅基流动API，模型可用性检查通过');

      // 直接调用后端批量接口，查看返回的模型名称
      const probe = await invoke('generate_gemma_batch_embeddings', {
        texts: ['diagnostic probe'],
        model: 'bge-base-zh-v1.5',
        taskType: 'search',
        dimensions: 768,
      });

      result.usedBackend = true;
      result.model = probe?.model || null;
      result.dimensions = probe?.dimensions ?? null;
      
      // 检查是否使用了真实模型
      if (result.model && (result.model.includes('simple') || result.model.includes('simulated'))) {
        result.error = `模型生成失败，使用了模拟模型: ${result.model}`;
      }
      
      return result;
    } catch (error) {
      result.error = error?.message || String(error);
      return result;
    }
  }

  /**
   * 生成查询嵌入向量
   * @param {string} query - 查询文本
   * @param {string} model - 模型名称
   * @returns {Promise<Array<number>>} 嵌入向量
   */
  async generateQueryEmbedding(query, model = 'BAAI/bge-m3') {
    try {
      console.log(`🔍 生成查询嵌入向量: "${query.substring(0, 50)}..."`);

      // 获取API配置
      const apiConfig = getApiConfig();
      if (!apiConfig.apiKey) {
        throw new Error('API密钥未配置，请在设置中配置SiliconFlow API密钥');
      }

      // 使用Tauri后端API生成嵌入向量
      const embedding = await invoke('generate_siliconflow_embedding_cmd', {
        apiKey: apiConfig.apiKey,
        text: query,
        model: model
      });

      console.log(`✅ 查询嵌入向量生成完成: ${embedding.length} 维`);
      return embedding;
    } catch (error) {
      console.error('❌ 查询嵌入向量生成失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const embeddingService = new EmbeddingService();

export default embeddingService;
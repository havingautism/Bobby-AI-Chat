/**
 * Qdrant向量数据库服务 - 前端接口
 */
class QdrantService {
  constructor() {
    this.isTauriEnvironment = this.checkTauriEnvironment();
    this.isInitialized = false;
  }

  checkTauriEnvironment() {
    return typeof window !== 'undefined' && window.__TAURI__;
  }

  /**
   * 初始化Qdrant服务
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    if (!this.isTauriEnvironment) {
      console.warn('⚠️ 非Tauri环境，无法使用Qdrant服务');
      return false;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('init_qdrant_service');
      console.log('✅ Qdrant服务初始化成功:', result);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Qdrant服务初始化失败:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * 检查Qdrant服务状态
   * @returns {Promise<boolean>} 服务是否可用
   */
  async checkStatus() {
    if (!this.isTauriEnvironment) {
      return false;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const isAvailable = await invoke('qdrant_check_status');
      return isAvailable;
    } catch (error) {
      console.error('❌ 检查Qdrant状态失败:', error);
      return false;
    }
  }

  /**
   * 添加向量点到Qdrant
   * @param {Array} points - 向量点数组
   * @returns {Promise<boolean>} 是否成功
   */
  async upsertPoints(points) {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('qdrant_upsert_points', { points });
      console.log('✅ 向量点添加成功:', result);
      return true;
    } catch (error) {
      console.error('❌ 向量点添加失败:', error);
      return false;
    }
  }

  /**
   * 搜索相似向量
   * @param {Object} request - 搜索请求
   * @returns {Promise<Object|null>} 搜索结果
   */
  async search(request) {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return null;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const results = await invoke('qdrant_search', { request });
      console.log('🔍 Qdrant搜索完成:', results);
      return results;
    } catch (error) {
      console.error('❌ Qdrant搜索失败:', error);
      return null;
    }
  }

  /**
   * 删除向量点
   * @param {Array} pointIds - 要删除的点ID数组
   * @returns {Promise<boolean>} 是否成功
   */
  async deletePoints(pointIds) {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('qdrant_delete_points', { point_ids: pointIds });
      console.log('✅ 向量点删除成功:', result);
      return true;
    } catch (error) {
      console.error('❌ 向量点删除失败:', error);
      return false;
    }
  }

  /**
   * 获取集合信息
   * @returns {Promise<Object|null>} 集合信息
   */
  async getCollectionInfo() {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return null;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const info = await invoke('qdrant_get_collection_info');
      console.log('📊 Qdrant集合信息:', info);
      return info;
    } catch (error) {
      console.error('❌ 获取集合信息失败:', error);
      return null;
    }
  }

  /**
   * 清空集合
   * @returns {Promise<boolean>} 是否成功
   */
  async clearCollection() {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('qdrant_clear_collection');
      console.log('✅ 集合清空成功:', result);
      return true;
    } catch (error) {
      console.error('❌ 集合清空失败:', error);
      return false;
    }
  }

  /**
   * 为文档生成向量并存储到Qdrant
   * @param {string} documentId - 文档ID
   * @param {string} content - 文档内容
   * @param {Object} metadata - 文档元数据
   * @returns {Promise<boolean>} 是否成功
   */
  async addDocumentVectors(documentId, content, metadata = {}) {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      console.log(`🔄 开始为文档 ${documentId} 生成Qdrant向量...`);
      
      // 导入嵌入服务
      const { default: embeddingService } = await import('./embeddingService.js');
      
      // 生成文档嵌入
      const embeddings = await embeddingService.generateDocumentEmbeddings(content);
      
      // 准备Qdrant点数据
      const points = embeddings.map((embeddingData, index) => ({
        id: `${documentId}_chunk_${index}`,
        vector: embeddingData.embedding,
        payload: {
          document_id: documentId,
          chunk_index: index,
          chunk_text: embeddingData.chunkText,
          title: metadata.title || 'Unknown',
          source_type: metadata.sourceType || 'manual',
          file_name: metadata.fileName || null,
          file_size: metadata.fileSize || null,
          created_at: Date.now(),
          model: embeddingData.model,
          dimensions: embeddingData.dimensions
        }
      }));

      // 存储到Qdrant
      const success = await this.upsertPoints(points);
      
      if (success) {
        console.log(`✅ 文档 ${documentId} 的向量已存储到Qdrant，共 ${points.length} 个向量`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ 为文档 ${documentId} 生成Qdrant向量失败:`, error);
      return false;
    }
  }

  /**
   * 在Qdrant中搜索文档
   * @param {string} query - 搜索查询
   * @param {number} limit - 结果数量限制
   * @param {number} threshold - 相似度阈值
   * @returns {Promise<Array>} 搜索结果
   */
  async searchDocuments(query, limit = 10, threshold = 0.3) {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return [];
    }

    try {
      console.log(`🔍 在Qdrant中搜索: "${query}"`);
      
      // 导入嵌入服务
      const { default: embeddingService } = await import('./embeddingService.js');
      
      // 生成查询向量
      const queryResult = await embeddingService.generateEmbedding(query);
      const queryVector = queryResult.embedding;
      
      console.log(`📊 使用${queryResult.model}模型生成查询向量 (${queryResult.dimensions}维)`);
      
      // 构建搜索请求
      const searchRequest = {
        query_vector: queryVector,
        limit: limit,
        score_threshold: threshold,
        filter: null // 可以添加过滤条件
      };

      // 执行搜索
      const searchResponse = await this.search(searchRequest);
      
      if (!searchResponse) {
        return [];
      }

      // 转换结果格式
      const results = searchResponse.results.map(result => ({
        id: result.payload.document_id || result.id,
        title: result.payload.title || 'Unknown',
        content: result.payload.chunk_text || '',
        score: result.score,
        chunkIndex: result.payload.chunk_index || 0,
        sourceType: result.payload.source_type || 'unknown',
        fileName: result.payload.file_name || null,
        fileSize: result.payload.file_size || null,
        metadata: result.payload
      }));

      console.log(`✅ Qdrant搜索完成，找到 ${results.length} 个结果`);
      return results;
    } catch (error) {
      console.error('❌ Qdrant文档搜索失败:', error);
      return [];
    }
  }

  /**
   * 删除文档的所有向量
   * @param {string} documentId - 文档ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteDocumentVectors(documentId) {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      console.log(`🗑️ 删除文档 ${documentId} 的Qdrant向量...`);
      
      // 首先搜索该文档的所有向量点
      const searchRequest = {
        query_vector: new Array(384).fill(0), // 使用零向量
        limit: 1000, // 获取足够多的结果
        score_threshold: 0, // 不设置阈值
        filter: {
          document_id: documentId
        }
      };

      const searchResponse = await this.search(searchRequest);
      
      if (!searchResponse || searchResponse.results.length === 0) {
        console.log(`📄 文档 ${documentId} 在Qdrant中没有向量数据`);
        return true;
      }

      // 提取所有点ID
      const pointIds = searchResponse.results.map(result => result.id);
      
      // 删除所有点
      const success = await this.deletePoints(pointIds);
      
      if (success) {
        console.log(`✅ 成功删除文档 ${documentId} 的 ${pointIds.length} 个向量`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ 删除文档 ${documentId} 的Qdrant向量失败:`, error);
      return false;
    }
  }

  /**
   * 获取Qdrant统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics() {
    if (!this.isTauriEnvironment || !this.isInitialized) {
      return {
        isAvailable: false,
        pointsCount: 0,
        vectorsCount: 0,
        status: 'unavailable'
      };
    }

    try {
      const collectionInfo = await this.getCollectionInfo();
      
      if (!collectionInfo) {
        return {
          isAvailable: false,
          pointsCount: 0,
          vectorsCount: 0,
          status: 'error'
        };
      }

      return {
        isAvailable: true,
        pointsCount: collectionInfo.points_count,
        vectorsCount: collectionInfo.vectors_count,
        indexedVectorsCount: collectionInfo.indexed_vectors_count,
        segmentsCount: collectionInfo.segments_count,
        status: collectionInfo.status,
        collectionName: collectionInfo.name
      };
    } catch (error) {
      console.error('❌ 获取Qdrant统计信息失败:', error);
      return {
        isAvailable: false,
        pointsCount: 0,
        vectorsCount: 0,
        status: 'error'
      };
    }
  }
}

// 创建全局实例
const qdrantService = new QdrantService();

export default qdrantService;

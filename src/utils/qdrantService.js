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
    try {
      // 直接检查Qdrant服务是否可用
      const response = await fetch('http://localhost:6333/collections');
      if (response.ok) {
        console.log('✅ Qdrant服务连接成功');
        this.isInitialized = true;
        return true;
      } else {
        console.warn('⚠️ Qdrant服务不可用');
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
      console.error('❌ Qdrant服务连接失败:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * 检查Qdrant服务状态
   * @returns {Promise<boolean>} 服务是否可用
   */
  async checkStatus() {
    try {
      const response = await fetch('http://localhost:6333/collections');
      return response.ok;
    } catch (error) {
      console.error('❌ 检查Qdrant状态失败:', error);
      return false;
    }
  }

  /**
   * 确保集合存在
   * @returns {Promise<boolean>} 是否成功
   */
  async ensureCollection() {
    try {
      // 检查集合是否存在
      const response = await fetch('http://localhost:6333/collections/knowledge_base');
      if (response.ok) {
        return true; // 集合已存在
      }

      // 创建集合
      const createResponse = await fetch('http://localhost:6333/collections/knowledge_base', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors: {
            size: 384, // 使用384维向量（与embeddingService一致）
            distance: 'Cosine'
          }
        })
      });

      if (createResponse.ok) {
        console.log('✅ Qdrant集合创建成功');
        return true;
      } else {
        console.error('❌ Qdrant集合创建失败:', createResponse.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ 确保集合存在失败:', error);
      return false;
    }
  }

  /**
   * 添加向量点到Qdrant
   * @param {Array} points - 向量点数组
   * @returns {Promise<boolean>} 是否成功
   */
  async upsertPoints(points) {
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      // 确保集合存在
      await this.ensureCollection();
      
      // 构建Qdrant格式的点数据
      const qdrantPoints = points.map((point, index) => {
        // 确保向量是数组格式
        let vector;
        if (Array.isArray(point.vector)) {
          vector = point.vector;
        } else if (point.vector && Array.isArray(point.vector.embedding)) {
          vector = point.vector.embedding;
        } else {
          console.error('❌ 无效的向量格式:', point.vector);
          throw new Error('无效的向量格式');
        }
        
        // 确保向量是数字数组
        if (!vector.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v))) {
          console.error('❌ 向量包含非数字值:', vector);
          console.error('❌ 向量长度:', vector.length);
          console.error('❌ 向量类型检查:', vector.map((v, i) => ({ index: i, value: v, type: typeof v, isNaN: isNaN(v), isFinite: isFinite(v) })));
          throw new Error('向量必须包含有效的数字值');
        }
        
        return {
          id: typeof point.id === 'string' ? index + 1 : point.id, // 确保ID是整数
          vector: vector, // 直接使用向量数组
          payload: {
            ...point.payload,
            originalId: point.id // 保存原始ID
          }
        };
      });

      const response = await fetch('http://localhost:6333/collections/knowledge_base/points', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: qdrantPoints
        })
      });

      if (response.ok) {
        console.log('✅ 向量点添加成功');
        
        // 强制触发索引，确保向量能被搜索到
        await this.forceIndexing();
        
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ 向量点添加失败:', response.status, response.statusText);
        console.error('错误详情:', errorText);
        console.error('请求数据:', JSON.stringify({ points: qdrantPoints }, null, 2));
        return false;
      }
    } catch (error) {
      console.error('❌ 向量点添加失败:', error);
      return false;
    }
  }

  /**
   * 强制触发索引
   * @returns {Promise<boolean>} 是否成功
   */
  async forceIndexing() {
    try {
      // 设置索引阈值为1，确保所有向量都被索引
      const response = await fetch('http://localhost:6333/collections/knowledge_base', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          optimizer_config: {
            indexing_threshold: 1
          }
        })
      });

      if (response.ok) {
        console.log('✅ 索引配置更新成功');
        
        // 等待一下让索引生效
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return true;
      } else {
        console.error('❌ 索引配置更新失败:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ 强制索引失败:', error);
      return false;
    }
  }

  /**
   * 搜索相似向量
   * @param {Object} request - 搜索请求
   * @returns {Promise<Object|null>} 搜索结果
   */
  async search(request) {
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return null;
    }

    try {
      const response = await fetch('http://localhost:6333/collections/knowledge_base/points/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: request.query_vector,
          limit: request.limit || 10,
          score_threshold: request.score_threshold || 0.0,
          with_payload: true,
          with_vector: false
        })
      });

      if (response.ok) {
        const results = await response.json();
        console.log('🔍 Qdrant搜索完成:', results);
        return results;
      } else {
        console.error('❌ Qdrant搜索失败:', response.statusText);
        return null;
      }
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
      const { invoke } = await import('@tauri-apps/api');
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
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return null;
    }

    try {
      const response = await fetch('http://localhost:6333/collections/knowledge_base');
      if (response.ok) {
        const data = await response.json();
        const info = data.result;
        console.log('📊 Qdrant集合信息:', info);
        return info;
      } else {
        console.error('❌ 获取集合信息失败:', response.status, response.statusText);
        return null;
      }
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
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      // 首先获取所有点的ID
      const scrollResponse = await fetch('http://localhost:6333/collections/knowledge_base/points/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 10000,
          with_payload: false,
          with_vector: false
        })
      });

      if (!scrollResponse.ok) {
        console.error('❌ 获取点数据失败:', scrollResponse.statusText);
        return false;
      }

      const scrollData = await scrollResponse.json();
      const pointIds = scrollData.result.points.map(point => point.id);
      
      if (pointIds.length === 0) {
        console.log('ℹ️ 集合中没有任何点需要删除');
        return true;
      }

      // 删除所有点
      const deleteResponse = await fetch('http://localhost:6333/collections/knowledge_base/points/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: pointIds
        })
      });

      if (deleteResponse.ok) {
        console.log(`✅ 集合清空成功，删除了 ${pointIds.length} 个点`);
        return true;
      } else {
        console.error('❌ 集合清空失败:', deleteResponse.statusText);
        return false;
      }
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
    if (!this.isInitialized) {
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
      const points = embeddings.map((embeddingData, index) => {
        // 确保向量格式正确
        let vector;
        if (Array.isArray(embeddingData.embedding)) {
          vector = embeddingData.embedding;
        } else if (embeddingData.embedding && Array.isArray(embeddingData.embedding.embedding)) {
          vector = embeddingData.embedding.embedding;
        } else {
          console.error('❌ 无效的嵌入数据格式:', embeddingData);
          throw new Error('无效的嵌入数据格式');
        }
        
        return {
          id: `${documentId}_chunk_${index}`,
          vector: vector,
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
        };
      });

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
  async searchDocuments(query, limit = 10, threshold = 0.01) {
    if (!this.isInitialized) {
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

      console.log('🔍 Qdrant搜索响应:', JSON.stringify(searchResponse, null, 2));
      
      // 转换结果格式
      const results = (searchResponse.result || searchResponse.results || []).map(result => {
        console.log('🔍 单个搜索结果:', JSON.stringify(result, null, 2));
        return {
        id: result.payload?.document_id || result.id,
        title: result.payload?.title || 'Unknown',
        content: result.payload?.chunk_text || '',
        score: result.score || 0, // 确保score字段总是有值
        chunkIndex: result.payload?.chunk_index || 0,
        sourceType: result.payload?.source_type || 'unknown',
        fileName: result.payload?.file_name || null,
        fileSize: result.payload?.file_size || null,
        metadata: result.payload || {}
        };
      });

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
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      console.log(`🗑️ 删除文档 ${documentId} 的Qdrant向量...`);
      
      // 检查集合是否存在
      const collectionsResponse = await fetch('http://localhost:6333/collections');
      const collectionsData = await collectionsResponse.json();
      
      if (!collectionsData.result.collections.some(col => col.name === 'knowledge_base')) {
        console.log(`ℹ️ Qdrant集合不存在，无需删除向量`);
        return true;
      }
      
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
      
      if (!searchResponse || !searchResponse.results || searchResponse.results.length === 0) {
        console.log(`📄 文档 ${documentId} 在Qdrant中没有向量数据`);
        return true;
      }

      // 提取所有点ID
      const pointIds = searchResponse.results.map(result => result.id);
      
      // 删除所有点
      const success = await this.deletePoints(pointIds);
      
      if (success) {
        console.log(`✅ 成功删除文档 ${documentId} 的 ${pointIds.length} 个向量`);
        
        // 强制优化索引，确保删除的向量被正确清理
        try {
          await this.optimizeCollection();
          console.log(`✅ 索引优化完成，确保删除的向量已清理`);
        } catch (optimizeError) {
          console.warn(`⚠️ 索引优化失败: ${optimizeError.message}`);
        }
      }
      
      return success;
    } catch (error) {
      console.error(`❌ 删除文档 ${documentId} 的Qdrant向量失败:`, error);
      return false;
    }
  }

  /**
   * 优化集合索引
   * @returns {Promise<boolean>} 是否成功
   */
  async optimizeCollection() {
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      console.log('🔧 开始优化Qdrant集合索引...');
      
      // 使用正确的Qdrant优化API路径
      const response = await fetch(`http://localhost:6333/collections/knowledge_base/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          optimize_config: {
            deleted_threshold: 0.2,
            vacuum_min_vector_number: 1000,
            default_segment_number: 0
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 集合索引优化成功:', result);
      return true;
    } catch (error) {
      console.error('❌ 集合索引优化失败:', error);
      return false;
    }
  }

  /**
   * 获取Qdrant统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics() {
    if (!this.isInitialized) {
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
        vectorsCount: collectionInfo.indexed_vectors_count, // 使用indexed_vectors_count作为向量数量
        indexedVectorsCount: collectionInfo.indexed_vectors_count,
        segmentsCount: collectionInfo.segments_count,
        status: collectionInfo.status,
        collectionName: 'knowledge_base'
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

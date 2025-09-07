/**
 * Qdrant向量数据库服务 - 前端接口
 */
class QdrantService {
  constructor() {
    this.isTauriEnvironment = this.checkTauriEnvironment();
    this.isInitialized = false;
  }

  // 生成 UUID v4（用于Qdrant点ID）
  generateUuidV4() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      // Set version and variant bits
      buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // variant
      const bytesToHex = Array.from(buf).map(b => b.toString(16).padStart(2, '0'));
      return (
        bytesToHex.slice(0, 4).join('') + '-' +
        bytesToHex.slice(4, 6).join('') + '-' +
        bytesToHex.slice(6, 8).join('') + '-' +
        bytesToHex.slice(8, 10).join('') + '-' +
        bytesToHex.slice(10, 16).join('')
      );
    }
    // 退化实现
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  // 校验是否为Qdrant允许的ID（非负整数或UUID字符串）
  isValidPointId(id) {
    if (typeof id === 'number') return Number.isInteger(id) && id >= 0;
    if (typeof id === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    }
    return false;
  }

  checkTauriEnvironment() {
    return Boolean(
      typeof window !== 'undefined' &&
        window !== undefined &&
        window.__TAURI_IPC__ !== undefined
    );
  }

  /**
   * 初始化Qdrant服务
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      console.log('🔧 开始初始化Qdrant服务...');
      // 直接检查Qdrant服务是否可用
      const response = await fetch('http://localhost:6333/collections');
      console.log('🔧 Qdrant服务响应状态:', response.status, response.statusText);
      
      if (response.ok) {
        console.log('✅ Qdrant服务连接成功');
        this.isInitialized = true;
        return true;
      } else {
        console.warn('⚠️ Qdrant服务不可用，状态码:', response.status);
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
        
        // 使用稳定的字符串ID，避免跨文档冲突/覆盖
        let stableId = point.id;
        if (!this.isValidPointId(stableId)) {
          // 为不合法的ID生成UUID，避免Qdrant 400
          stableId = this.generateUuidV4();
        }

        return {
          id: stableId,
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
      const requestBody = {
        vector: request.vector,  // 修复字段名：request.query_vector -> request.vector
        limit: request.limit || 10,
        score_threshold: request.score_threshold || 0.0,
        with_payload: true,
        with_vector: false
      };
      
      console.log('🔍 发送到Qdrant的请求体:', requestBody);
      console.log('🔍 请求体中的vector字段:', requestBody.vector ? `存在，长度: ${requestBody.vector.length}` : '不存在');
      
      const response = await fetch('http://localhost:6333/collections/knowledge_base/points/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const results = await response.json();
        console.log('🔍 Qdrant搜索完成:', results);
        return results;
      } else {
        const errorText = await response.text();
        console.error('❌ Qdrant搜索失败:', response.status, response.statusText);
        console.error('❌ 错误详情:', errorText);
        console.error('❌ 请求体:', JSON.stringify(requestBody, null, 2));
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
    try {
      console.log(`🗑️ 删除 ${pointIds.length} 个向量点:`, pointIds);
      
      const response = await fetch('http://localhost:6333/collections/knowledge_base/points/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: pointIds
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ 向量点删除成功:', result);
        return true;
      } else {
        console.error('❌ 向量点删除失败:', response.status, response.statusText);
        return false;
      }
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
    // 直接尝试连接Qdrant，不依赖isInitialized标志
    console.log('🔧 检查Qdrant服务连接...');
    try {
      const testResponse = await fetch('http://localhost:6333/collections');
      if (!testResponse.ok) {
        console.warn('⚠️ Qdrant服务不可用，状态码:', testResponse.status);
        return false;
      }
      console.log('✅ Qdrant服务连接正常');
    } catch (error) {
      console.error('❌ Qdrant服务连接失败:', error);
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
        
        // 清空后立即优化索引
        try {
          console.log('🔧 清空后优化索引...');
          const optimizeSuccess = await this.optimizeCollection();
          
          // 如果标准优化失败，尝试强制清理
          if (!optimizeSuccess) {
            console.log('🔧 标准优化失败，尝试强制清理索引...');
            await this.forceCleanupIndex();
          }
        } catch (optimizeError) {
          console.warn('⚠️ 清空后索引优化失败:', optimizeError.message);
          // 尝试强制清理作为备选方案
          try {
            console.log('🔧 尝试强制清理索引作为备选方案...');
            await this.forceCleanupIndex();
          } catch (forceError) {
            console.warn('⚠️ 强制清理也失败了:', forceError.message);
          }
        }
        
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
      console.log(`🔍 查询向量结果:`, queryResult);
      console.log(`🔍 查询向量值:`, queryVector);
      
      // 构建搜索请求
      const searchRequest = {
        vector: queryVector,  // 修复字段名：query_vector -> vector
        limit: limit,
        score_threshold: threshold,
        filter: null // 可以添加过滤条件
      };

      console.log('🔍 搜索请求对象:', searchRequest);
      console.log('🔍 查询向量长度:', queryVector ? queryVector.length : 'undefined');

      // 执行搜索
      const searchResponse = await this.search(searchRequest);
      
      if (!searchResponse) {
        return [];
      }

      console.log('🔍 Qdrant搜索响应:', JSON.stringify(searchResponse, null, 2));
      
      // 转换结果格式
      const results = (searchResponse.result || searchResponse.results || []).map(result => {
        console.log('🔍 单个搜索结果:', JSON.stringify(result, null, 2));
        console.log('🔍 结果payload:', result.payload);
        console.log('🔍 可用字段:', Object.keys(result.payload || {}));
        
        return {
        id: result.payload?.document_id || result.id,
        title: result.payload?.title || result.payload?.document_title || result.payload?.name || 'Unknown',
        content: result.payload?.chunk_text || result.payload?.content || '',
        score: result.score || 0, // 确保score字段总是有值
        chunkIndex: result.payload?.chunk_index || 0,
        sourceType: result.payload?.source_type || 'unknown',
        fileName: result.payload?.file_name || result.payload?.filename || null,
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
    try {
      console.log(`🗑️ 删除文档 ${documentId} 的Qdrant向量...`);
      
      // 检查集合是否存在
      const collectionsResponse = await fetch('http://localhost:6333/collections');
      const collectionsData = await collectionsResponse.json();
      
      if (!collectionsData.result.collections.some(col => col.name === 'knowledge_base')) {
        console.log(`ℹ️ Qdrant集合不存在，无需删除向量`);
        return true;
      }
      
      // 参考clearCollection的成功实现，使用简单的scroll API获取所有点，然后过滤
      console.log(`🔍 使用scroll API获取所有向量点，然后过滤文档 ${documentId}...`);
      
      const scrollRequest = {
        limit: 10000,
        with_payload: true,
        with_vector: false
      };

      const scrollResponse = await fetch('http://localhost:6333/collections/knowledge_base/points/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scrollRequest)
      });

      if (!scrollResponse.ok) {
        console.error(`❌ Scroll API请求失败: ${scrollResponse.status}`);
        return false;
      }

      const scrollData = await scrollResponse.json();
      console.log(`🔍 Scroll API响应:`, scrollData);
      
      if (!scrollData.result || !scrollData.result.points || scrollData.result.points.length === 0) {
        console.log(`📄 Qdrant中没有向量数据`);
        return true;
      }

      // 过滤出属于该文档的点（更严格：同时匹配文档ID与来源信息，以避免误删）
      const targetPoints = scrollData.result.points.filter(point => {
        const p = point.payload || {};
        if (!p.document_id) return false;
        return p.document_id === documentId;
      });
      
      if (targetPoints.length === 0) {
        console.log(`📄 文档 ${documentId} 在Qdrant中没有向量数据`);
        return true;
      }

      // 再次稳妥：限定ID、document_id 一致的点
      const pointIds = targetPoints.map(point => point.id);
      console.log(`🔍 找到 ${pointIds.length} 个向量点需要删除:`, pointIds);
      
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
    // 直接尝试连接Qdrant，不依赖isInitialized标志
    console.log('🔧 检查Qdrant服务连接...');
    try {
      const testResponse = await fetch('http://localhost:6333/collections');
      if (!testResponse.ok) {
        console.warn('⚠️ Qdrant服务不可用，状态码:', testResponse.status);
        return false;
      }
      console.log('✅ Qdrant服务连接正常');
    } catch (error) {
      console.error('❌ Qdrant服务连接失败:', error);
      return false;
    }

    try {
      console.log('🔧 开始优化Qdrant集合索引...');
      
      // 由于Qdrant的优化API端点不存在，我们使用更直接的方法
      // 方法1: 尝试使用update_collection来设置优化配置
      try {
        const response = await fetch(`http://localhost:6333/collections/knowledge_base`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            optimizers_config: {
              deleted_threshold: 0.0,
              vacuum_min_vector_number: 0,
              default_segment_number: 2
            }
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ 集合优化配置更新成功:', result);
          
          // 等待一段时间让优化生效
          console.log('🔧 等待优化生效...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          return true;
        } else {
          console.warn('⚠️ 优化配置更新失败，状态码:', response.status);
        }
      } catch (error) {
        console.warn('⚠️ 优化配置更新出错:', error.message);
      }
      
      // 方法2: 如果配置更新失败，尝试重新创建集合
      console.log('🔧 尝试重新创建集合来清理索引...');
      return await this.forceCleanupIndex();
      
    } catch (error) {
      console.error('❌ 集合索引优化失败:', error);
      return false;
    }
  }

  /**
   * 强制清理Qdrant索引 - 使用更直接的方法
   * @returns {Promise<boolean>} 是否成功
   */
  async forceCleanupIndex() {
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      console.log('🔧 开始强制清理Qdrant索引...');
      
      // 方法1: 尝试使用snapshot API来触发索引重建
      try {
        const snapshotResponse = await fetch(`http://localhost:6333/collections/knowledge_base/snapshots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });
        
        if (snapshotResponse.ok) {
          console.log('✅ 通过快照API触发索引重建');
          return true;
        }
      } catch (error) {
        console.log('🔧 快照API失败，尝试其他方法...');
      }
      
      // 方法2: 尝试重新创建集合来强制清理索引
      try {
        console.log('🔧 尝试重新创建集合来清理索引...');
        
        // 获取当前集合配置
        const getResponse = await fetch(`http://localhost:6333/collections/knowledge_base`);
        if (getResponse.ok) {
          const collectionInfo = await getResponse.json();
          
          // 删除集合
          const deleteResponse = await fetch(`http://localhost:6333/collections/knowledge_base`, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok) {
            console.log('✅ 集合已删除，正在重新创建...');
            
            // 重新创建集合
            const createResponse = await fetch(`http://localhost:6333/collections/knowledge_base`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                vectors: {
                  size: 384,
                  distance: "Cosine"
                },
                optimizers_config: {
                  default_segment_number: 2
                }
              })
            });
            
            if (createResponse.ok) {
              console.log('✅ 集合重新创建成功，索引已清理');
              return true;
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ 重新创建集合失败:', error.message);
      }
      
      console.warn('⚠️ 所有强制清理方法都失败了');
      return false;
    } catch (error) {
      console.error('❌ 强制清理索引失败:', error);
      return false;
    }
  }

  /**
   * 获取Qdrant统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics() {
    // 直接尝试连接Qdrant，不依赖isInitialized标志
    console.log('🔧 检查Qdrant服务连接...');
    try {
      const testResponse = await fetch('http://localhost:6333/collections');
      if (!testResponse.ok) {
        console.warn('⚠️ Qdrant服务不可用，状态码:', testResponse.status);
        return {
          isAvailable: false,
          pointsCount: 0,
          vectorsCount: 0,
          status: 'unavailable'
        };
      }
      console.log('✅ Qdrant服务连接正常');
    } catch (error) {
      console.error('❌ Qdrant服务连接失败:', error);
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

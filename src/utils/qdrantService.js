/**
 * Qdrant向量数据库服务 - 前端接口
 * 支持专家模型分离方案，多Collection管理
 */
class QdrantService {
  constructor() {
    this.isTauriEnvironment = this.checkTauriEnvironment();
    this.isInitialized = false;
    this.collections = {
      zh: 'my_knowledge_bge-large-zh-v1.5',
      en: 'my_knowledge_bge-large-en-v1.5'
    };
    this.defaultCollection = 'my_knowledge_bge-m3';
  }

  // 带超时的fetch，避免无响应长时间卡住
  async fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } catch (e) {
      console.error(`❌ 请求超时或失败: ${url}`, e);
      throw e;
    } finally {
      clearTimeout(id);
    }
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

  // 检查字符串是否为UUID格式
  isUuid(str) {
    if (typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
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
   * @param {string} collectionName - 集合名称
   * @param {number} vectorSize - 向量维度
   * @returns {Promise<boolean>} 是否成功
   */
  async ensureCollection(collectionName = null, vectorSize = 384) {
    const targetCollection = collectionName || this.defaultCollection;
    try {
      // 检查集合是否存在
      const response = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}`);
      if (response.ok) {
        const collectionInfo = await response.json();
        const currentVectorSize = collectionInfo.result?.config?.params?.vectors?.size;
        
        if (currentVectorSize === vectorSize) {
          console.log(`✅ Qdrant集合 ${targetCollection} 已存在，维度正确 (${vectorSize})`);
          return true; // 集合已存在且维度正确
        } else {
          console.log(`⚠️ Qdrant集合 ${targetCollection} 存在但维度不匹配 (当前: ${currentVectorSize}, 需要: ${vectorSize})，重新创建...`);
          
          // 删除现有集合
          const deleteResponse = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}`, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok) {
            console.log(`✅ 旧集合 ${targetCollection} 删除成功`);
          } else {
            console.warn(`⚠️ 删除旧集合 ${targetCollection} 失败，继续创建新集合`);
          }
          
          // 删除后重新创建集合
          console.log(`🔧 重新创建 Qdrant集合 ${targetCollection} (维度: ${vectorSize})...`);
          const createResponse = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              vectors: {
                size: vectorSize,
                distance: 'Cosine'
              }
            })
          });

          if (createResponse.ok) {
            console.log(`✅ Qdrant集合 ${targetCollection} 重新创建成功`);
            return true;
          } else {
            const errorText = await createResponse.text();
            console.error(`❌ Qdrant集合 ${targetCollection} 重新创建失败:`, createResponse.status, createResponse.statusText);
            console.error(`❌ 错误详情:`, errorText);
            return false;
          }
        }
      }

      // 如果集合不存在（404），则创建它
      if (response.status === 404) {
        console.log(`🔧 Qdrant集合 ${targetCollection} 不存在，正在创建...`);
        
        // 创建集合
        const createResponse = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vectors: {
              size: vectorSize,
              distance: 'Cosine'
            }
          })
        });

        if (createResponse.ok) {
          console.log(`✅ Qdrant集合 ${targetCollection} 创建成功`);
          return true;
        } else {
          const errorText = await createResponse.text();
          console.error(`❌ Qdrant集合 ${targetCollection} 创建失败:`, createResponse.status, createResponse.statusText);
          console.error(`❌ 错误详情:`, errorText);
          return false;
        }
      } else {
        // 其他错误
        console.error(`❌ 检查集合 ${targetCollection} 时出错:`, response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error(`❌ 确保集合 ${targetCollection} 存在失败:`, error);
      return false;
    }
  }

  /**
   * 确保所有专家模型集合存在
   * @returns {Promise<boolean>} 是否成功
   */
  async ensureAllCollections() {
    try {
      const results = await Promise.all([
        this.ensureCollection(this.collections.zh, 1024), // BGE 1024维
        this.ensureCollection(this.collections.en, 1024)  // BGE 1024维
      ]);
      
      const allSuccess = results.every(result => result);
      if (allSuccess) {
        console.log('✅ 所有专家模型集合已就绪');
      } else {
        console.warn('⚠️ 部分专家模型集合创建失败');
      }
      
      return allSuccess;
    } catch (error) {
      console.error('❌ 确保所有集合存在失败:', error);
      return false;
    }
  }

  /**
   * 添加向量点到Qdrant
   * @param {Array} points - 向量点数组
   * @param {string} targetCollection - 目标集合名称
   * @returns {Promise<boolean>} 是否成功
   */
  async upsertPoints(points, targetCollection = null) {
        if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      // 检测向量维度
      const vectorSize = points.length > 0 && points[0].vector ? points[0].vector.length : 384;
      console.log(`🔍 检测到向量维度: ${vectorSize}`);
      
      // 确保集合存在，使用正确的维度
      await this.ensureCollection(targetCollection, vectorSize);
      
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
        
        // Qdrant要求点ID必须是无符号整数或UUID，不能是字符串
        let stableId = point.id;
        if (!this.isValidPointId(stableId)) {
          // 为不合法的ID生成UUID，避免Qdrant 400
          stableId = this.generateUuidV4();
        }
        
        // 确保ID是UUID格式（如果还不是的话）
        if (typeof stableId === 'string' && !this.isUuid(stableId)) {
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

      const response = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}/points`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: qdrantPoints
        })
      }, 20000);

      if (response.ok) {
        console.log('✅ 向量点添加成功');
        
        // 强制触发索引，确保向量能被搜索到
        await this.forceIndexing(targetCollection);
        
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
   * @param {string} targetCollection - 集合名称
   * @returns {Promise<boolean>} 是否成功
   */
  async forceIndexing(targetCollection = null) {
        try {
      // 设置索引阈值为1，确保所有向量都被索引
      const response = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}`, {
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
   * @param {string} targetCollection - 集合名称
   * @returns {Promise<Object|null>} 搜索结果
   */
  async search(request, targetCollection = null) {
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
      
      console.log(`🔍 在集合 ${targetCollection} 中搜索，请求体:`, requestBody);
      console.log('🔍 请求体中的vector字段:', requestBody.vector ? `存在，长度: ${requestBody.vector.length}` : '不存在');
      
      const response = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}/points/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }, 15000);

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
   * @param {string} targetCollection - 集合名称
   * @returns {Promise<boolean>} 是否成功
   */
  async deletePoints(pointIds, targetCollection = null) {
        try {
      console.log(`🗑️ 在集合 ${targetCollection} 中删除 ${pointIds.length} 个向量点:`, pointIds);
      
      const response = await fetch(`http://localhost:6333/collections/${targetCollection}/points/delete`, {
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
   * @param {string} targetCollection - 集合名称
   * @returns {Promise<Object|null>} 集合信息
   */
  async getCollectionInfo(targetCollection = null) {
        if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return null;
    }

    try {
      const response = await this.fetchWithTimeout(`http://localhost:6333/collections/${targetCollection}`);
      if (response.ok) {
        const data = await response.json();
        const info = data.result;
        console.log(`📊 Qdrant集合 ${targetCollection} 信息:`, info);
        return info;
      } else {
        console.error(`❌ 获取集合 ${targetCollection} 信息失败:`, response.status, response.statusText);
        return null;
      }
    } catch (error) {
      console.error(`❌ 获取集合 ${targetCollection} 信息失败:`, error);
      return null;
    }
  }

  /**
   * 获取所有专家模型集合信息
   * @returns {Promise<Object>} 所有集合信息
   */
  async getAllCollectionsInfo() {
    const info = {};
    
    for (const [lang, targetCollection] of Object.entries(this.collections)) {
      try {
        const collectionInfo = await this.getCollectionInfo(targetCollection);
        info[lang] = {
          targetCollection,
          info: collectionInfo,
          isAvailable: collectionInfo !== null
        };
      } catch (error) {
        console.error(`❌ 获取集合 ${targetCollection} 信息失败:`, error);
        info[lang] = {
          targetCollection,
          info: null,
          isAvailable: false
        };
      }
    }
    
    return info;
  }

  /**
   * 根据语言检测结果选择集合
   * @param {string} text - 要分析的文本
   * @returns {Promise<Object>} 选择的集合配置
   */
  async selectCollectionByLanguage(text) {
    try {
      // 导入语言检测器
      const { autoSelectModel } = await import('./languageDetector.js');
      
      // 自动选择模型和集合
      const config = autoSelectModel(text);
      
      console.log(`🎯 语言检测结果: ${config.detectedLanguage}, 选择集合: ${config.collection}`);
      
      return config;
    } catch (error) {
      console.error('❌ 语言检测失败，使用默认集合:', error);
      return {
        model: 'BAAI/bge-large-en-v1.5',
        collection: this.collections.en,
        dimensions: 1024,
        detectedLanguage: 'default'
      };
    }
  }

  /**
   * 多集合搜索 - 在所有专家模型集合中搜索
   * @param {string} query - 搜索查询
   * @param {number} limit - 结果数量限制
   * @param {number} threshold - 相似度阈值
   * @returns {Promise<Array>} 合并的搜索结果
   */
  async searchAllCollections(query, limit = 10, threshold = 0.01) {
    try {
      console.log(`🔍 在所有专家模型集合中搜索: "${query}"`);
      
      // 导入语言检测器和嵌入服务
      const { autoSelectModel } = await import('./languageDetector.js');
      const { default: embeddingService } = await import('./embeddingService.js');
      
      // 检测查询语言并选择主要模型
      const primaryConfig = autoSelectModel(query);
      console.log(`🎯 主要搜索语言: ${primaryConfig.detectedLanguage}, 模型: ${primaryConfig.model}`);
      
      // 生成查询向量
      const queryResult = await embeddingService.generateEmbeddings([query], primaryConfig.model);
      
      // 检查返回结果格式
      if (!queryResult || !queryResult.embeddings || !queryResult.embeddings[0]) {
        console.error('❌ 查询向量生成失败:', queryResult);
        throw new Error('查询向量生成失败');
      }
      
      const queryVector = queryResult.embeddings[0];
      
      console.log(`📊 使用${primaryConfig.model}模型生成查询向量 (${queryVector.length}维)`);
      
      // 在所有集合中搜索
      const searchPromises = Object.entries(this.collections).map(async ([lang, targetCollection]) => {
        try {
          const searchRequest = {
            vector: queryVector,
            limit: Math.ceil(limit / 2), // 每个集合搜索一半的结果
            score_threshold: threshold
          };
          
          const results = await this.search(searchRequest, targetCollection);
          
          if (results && results.result) {
            return results.result.map(result => ({
              ...result,
              collection: targetCollection,
              language: lang
            }));
          }
          
          return [];
        } catch (error) {
          console.error(`❌ 在集合 ${targetCollection} 中搜索失败:`, error);
          return [];
        }
      });
      
      // 等待所有搜索完成
      const allResults = await Promise.all(searchPromises);
      
      // 合并和排序结果
      const mergedResults = allResults.flat();
      mergedResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // 限制结果数量
      const finalResults = mergedResults.slice(0, limit);
      
      console.log(`✅ 多集合搜索完成，找到 ${finalResults.length} 个结果`);
      return finalResults;
      
    } catch (error) {
      console.error('❌ 多集合搜索失败:', error);
      return [];
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
      const scrollResponse = await fetch(`http://localhost:6333/collections/${this.defaultCollection}/points/scroll`, {
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
      const deleteResponse = await fetch(`http://localhost:6333/collections/${this.defaultCollection}/points/delete`, {
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
  async addDocumentVectors(documentId, content, metadata = {}, targetCollection) {
    if (!this.isInitialized) {
      console.warn('⚠️ Qdrant服务不可用');
      return false;
    }

    try {
      console.log(`🔄 开始为文档 ${documentId} 生成Qdrant向量...`);
      
      // 选择目标集合（按内容语言自动选择，除非外部已明确传入）
      if (!targetCollection) {
        const { autoSelectModel } = await import('./languageDetector.js');
        const cfg = autoSelectModel(content || '');
        targetCollection = cfg.collection || this.collections.zh;
      }

      // 确保目标集合已存在
      await this.ensureCollection(targetCollection, 384);

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
        
        // 使用真正的分块索引，而不是数组索引
        const chunkIndex = embeddingData.chunkIndex !== undefined ? embeddingData.chunkIndex : index;
        
        return {
          id: `${documentId}_chunk_${chunkIndex}`,
          vector: vector,
          payload: {
            document_id: documentId,
            chunk_index: chunkIndex,
            chunk_text: embeddingData.chunkText,
            title: metadata.title || 'Unknown',
            source_type: metadata.sourceType || 'text',
            file_name: metadata.fileName || null,
            file_size: metadata.fileSize || null,
            created_at: Date.now(),
            model: embeddingData.model,
            dimensions: embeddingData.dimensions
          }
        };
      });

      // 存储到Qdrant（写入到目标集合）
      const success = await this.upsertPoints(points, targetCollection);
      
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
      
      // 检查返回结果格式
      if (!queryResult || !queryResult.embedding) {
        console.error('❌ 查询向量生成失败:', queryResult);
        throw new Error('查询向量生成失败');
      }
      
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
      
      if (collectionsData.result.collections.length === 0) {
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

      const scrollResponse = await fetch(`http://localhost:6333/collections/${this.defaultCollection}/points/scroll`, {
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
        const response = await fetch(`http://localhost:6333/collections/${this.defaultCollection}`, {
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
        const snapshotResponse = await fetch(`http://localhost:6333/collections/${this.defaultCollection}/snapshots`, {
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
        const getResponse = await fetch(`http://localhost:6333/collections/${this.defaultCollection}`);
        if (getResponse.ok) {
          // 删除集合
          const deleteResponse = await fetch(`http://localhost:6333/collections/${this.defaultCollection}`, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok) {
            console.log('✅ 集合已删除，正在重新创建...');
            
            // 重新创建集合
            const createResponse = await fetch(`http://localhost:6333/collections/${this.defaultCollection}`, {
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
      // 在专家模式下，需要统计所有专家模型集合的向量数量
      let totalPointsCount = 0;
      let totalVectorsCount = 0;
      let allCollectionsInfo = [];
      
      // 统计所有专家模型集合
      const expertCollections = [
        'my_knowledge_bge-large-zh-v1.5',
        'my_knowledge_bge-large-en-v1.5',
        'my_knowledge_bge-m3'
      ];
      
      for (const targetCollection of expertCollections) {
        try {
          const collectionInfo = await this.getCollectionInfo(targetCollection);
          if (collectionInfo) {
            totalPointsCount += collectionInfo.points_count || 0;
            totalVectorsCount += collectionInfo.indexed_vectors_count || 0;
            allCollectionsInfo.push({
              name: targetCollection,
              pointsCount: collectionInfo.points_count || 0,
              vectorsCount: collectionInfo.indexed_vectors_count || 0,
              status: collectionInfo.status
            });
            console.log(`✅ 成功获取集合 ${targetCollection} 信息:`, {
              pointsCount: collectionInfo.points_count || 0,
              vectorsCount: collectionInfo.indexed_vectors_count || 0
            });
          }
        } catch (error) {
          // 如果是404错误，说明集合不存在，这是正常的，不需要警告
          if (error.message && error.message.includes('404')) {
            console.log(`ℹ️ 集合 ${targetCollection} 不存在，跳过统计`);
          } else {
            console.warn(`⚠️ 获取集合 ${targetCollection} 信息失败:`, error.message);
          }
        }
      }
      
      // 如果没有专家模型集合，回退到默认集合
      if (totalVectorsCount === 0) {
        const defaultCollectionInfo = await this.getCollectionInfo(this.defaultCollection);
        if (defaultCollectionInfo) {
          totalPointsCount = defaultCollectionInfo.points_count || 0;
          totalVectorsCount = defaultCollectionInfo.indexed_vectors_count || 0;
          allCollectionsInfo = [{
            name: 'knowledge_base',
            pointsCount: defaultCollectionInfo.points_count || 0,
            vectorsCount: defaultCollectionInfo.indexed_vectors_count || 0,
            status: defaultCollectionInfo.status
          }];
        }
      }

      console.log('📊 专家模型集合统计结果:', {
        totalPointsCount,
        totalVectorsCount,
        collectionsCount: allCollectionsInfo.length,
        allCollections: allCollectionsInfo
      });

      return {
        isAvailable: true,
        pointsCount: totalPointsCount,
        vectorsCount: totalVectorsCount, // 使用所有集合的总向量数量
        indexedVectorsCount: totalVectorsCount,
        segmentsCount: allCollectionsInfo.length,
        status: allCollectionsInfo.length > 0 ? 'green' : 'error',
        targetCollection: 'expert-collections',
        allCollections: allCollectionsInfo
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

/**
 * 知识库管理器 - 使用SQLite + sqlite-vec后端
 * 专门用于新的Tauri后端API
 */
import { invoke } from '@tauri-apps/api/core';
import embeddingService from './embeddingService.js';
import { autoSelectModel } from './languageDetector.js';
import { getApiConfig } from './api-manager.js';

class KnowledgeBaseSQLiteVec {
  constructor() {
    this.isInitialized = false;
    this.embeddingModel = 'BAAI/bge-m3'; // 默认使用BAAI/bge-m3模型
    this.embeddingDimensions = 1024; // bge-m3是1024维
    this.embeddingTaskType = 'search'; // 默认搜索任务
    this.expertModelMode = true; // 启用专家模型分离模式
  }

  // 推断文档来源类型
  inferSourceType(fileName, mimeType) {
    const name = (fileName || '').toLowerCase();
    const mime = (mimeType || '').toLowerCase();
    if (!name && !mime) return 'txt';
    if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
    if (name.endsWith('.docx') || mime.includes('word')) return 'docx';
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('sheet')) return 'xlsx';
    if (name.endsWith('.csv') || mime.includes('csv')) return 'csv';
    if (name.endsWith('.txt') || mime.includes('text/plain')) return 'txt';
    return 'manual';
  }

  /**
   * 设置嵌入模型配置
   * @param {string} model - 模型名称
   * @param {number} dimensions - 嵌入维度
   * @param {string} taskType - 任务类型
   */
  setEmbeddingConfig(model = 'BAAI/bge-m3', dimensions = 1024, taskType = 'search') {
    this.embeddingModel = model;
    this.embeddingDimensions = dimensions;
    this.embeddingTaskType = taskType;
    console.log(`🔧 嵌入模型配置已更新: ${model} (${dimensions}维, ${taskType})`);
  }

  // 初始化知识库
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔧 开始初始化SQLite + sqlite-vec知识库...');

      // 检查后端服务是否可用
      const systemStatus = await invoke('get_system_status');
      console.log('📊 系统状态检查:', systemStatus);

      if (!systemStatus.databaseHealth) {
        throw new Error('知识库数据库不可用');
      }

      console.log('✅ 数据库健康状态:', systemStatus.databaseHealth);

      console.log('✅ SQLite + sqlite-vec知识库初始化成功');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ 知识库初始化失败:', error);
      throw error;
    }
  }

  // 获取所有集合
  async getCollections() {
    try {
      const collections = await invoke('get_knowledge_collections');
      console.log('📦 获取到的集合列表:', collections);
      return collections;
    } catch (error) {
      console.error('❌ 获取集合失败:', error);
      return [];
    }
  }

  // 创建集合
  async createCollection(name, description = '', embeddingModel = 'BAAI/bge-m3', vectorDimensions = 1024) {
    try {
      console.log(`🔧 创建集合: name="${name}", description="${description}", model="${embeddingModel}", dimensions=${vectorDimensions}`);
      const collection = await invoke('create_knowledge_collection', {
        name,
        description,
        embeddingModel,
        vectorDimensions
      });
      console.log('✅ 集合创建结果:', collection);
      return collection;
    } catch (error) {
      console.error('❌ 创建集合失败:', error);
      throw error;
    }
  }

  // 添加文档到知识库
  async addDocument(collectionId, title, content, fileName = '', fileSize = 0, mimeType = '') {
    try {
      // 创建符合后端期望的文档对象
      const document = {
        id: '', // 后端会生成新的ID
        title,
        content,
        source_type: this.inferSourceType(fileName, mimeType),
        source_url: null,
        file_path: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        metadata: null,
        collection_id: collectionId, // 传递集合ID
        created_at: Date.now(),
        updated_at: Date.now()
      };

      const result = await invoke('add_knowledge_document', {
        document
      });
      return result;
    } catch (error) {
      console.error('❌ 添加文档失败:', error);
      throw error;
    }
  }

  // 为文档生成向量嵌入
  async generateDocumentEmbeddings(documentId, content = null, model = null, collectionId = null) {
    try {
      console.log(`🚀 generateDocumentEmbeddings 被调用，参数:`, { documentId, hasContent: !!content, model, collectionId });

      // 使用指定的模型或自动选择模型
      const selectedModel = model || this.embeddingModel;

      console.log(`🔄 开始为文档 ${documentId} 生成嵌入向量...`);
      console.log(`📊 向量生成状态检查: 使用模型 ${selectedModel}`);
      if (collectionId) {
        console.log(`🎯 目标集合: ${collectionId}`);
      } else {
        console.log(`⚠️ 警告: collectionId 为 null 或 undefined`);
      }

      // 如果没有提供内容，后端会从数据库获取
      let finalModel = selectedModel;
      if (content) {
        // 语言检测和模型选择
        const detectedLanguage = await this.detectLanguage(content);
        const modelConfig = await this.autoSelectModel(content);
        finalModel = modelConfig.model || selectedModel;
        console.log(`🎯 专家模型分离模式 - 检测语言: ${detectedLanguage}, 选择模型: ${finalModel}`);
        console.log(`🔍 详细模型配置:`, modelConfig);
      }

      console.log(`📋 即将调用后端API - documentId: ${documentId}, model: ${finalModel}, hasContent: ${!!content}, collectionId: ${collectionId}`);
      console.log(`🔍 详细参数检查 - collectionId类型: ${typeof collectionId}, collectionId值:`, collectionId);

      // 构建请求对象
      const requestData = {
        document_id: documentId,
        collection_id: collectionId, // 传递集合ID以优化查找
        ...(content && { content }), // 只有在提供内容时才传递
        model: finalModel
      };
      console.log(`📦 完整请求数据:`, JSON.stringify(requestData, null, 2));

      // 使用嵌入服务生成向量
      console.log(`🔄 使用嵌入服务生成向量...`);

      // 获取API配置（强制刷新缓存）
      console.log('🔍 检查localStorage中的API配置...');
      try {
        const savedConfig = localStorage.getItem("ai-chat-api-config");
        console.log('🔍 localStorage中的原始配置:', savedConfig);
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig);
          console.log('🔍 localStorage解析后的配置:', parsedConfig);
          console.log('🔍 localStorage中的API密钥:', parsedConfig.apiKey ? `${parsedConfig.apiKey.substring(0, 10)}...` : 'null');
        }
      } catch (error) {
        console.error('❌ 读取localStorage失败:', error);
      }

      const apiConfig = getApiConfig();
      console.log('🔍 搜索时获取的API配置:', apiConfig);
      console.log('🔍 API配置类型:', typeof apiConfig);
      console.log('🔍 API密钥存在性:', !!apiConfig.apiKey);
      console.log('🔍 API密钥长度:', apiConfig.apiKey ? apiConfig.apiKey.length : 'N/A');
      console.log('🔍 API密钥内容:', apiConfig.apiKey ? `${apiConfig.apiKey.substring(0, 10)}...` : 'null');

      if (!apiConfig.apiKey) {
        console.error('❌ API密钥为空，当前配置:', JSON.stringify(apiConfig, null, 2));
        throw new Error('API密钥未配置，请在设置中配置SiliconFlow API密钥');
      }
      console.log('✅ API配置获取成功，密钥长度:', apiConfig.apiKey.length);

      // 调用后端API生成嵌入向量
      const result = await invoke('generate_document_embeddings', {
        request: requestData,
        apiKey: apiConfig.apiKey
      });

      console.log(`📡 后端返回原始数据:`, result);

      // 直接使用后端返回的对象（Tauri会自动反序列化JSON）
      console.log(`✅ 文档嵌入生成完成: ${result.vectors_count} 个向量`);
      return result;
    } catch (error) {
      console.error('❌ 文档嵌入生成失败:', error);
      throw error;
    }
  }

  // 检测文本语言
  async detectLanguage(text) {
    try {
      // 直接使用 languageDetector.js 中的方法保持一致性
      const { detectLanguage } = await import('./languageDetector.js');
      return detectLanguage(text);
    } catch (error) {
      console.error('❌ 语言检测失败:', error);
      return 'default';
    }
  }

  // 自动选择模型配置
  async autoSelectModel(text) {
    try {
      // 动态导入语言检测器
      const { autoSelectModel } = await import('./languageDetector.js');
      return autoSelectModel(text);
    } catch (error) {
      console.error('❌ 模型选择失败:', error);
      // 返回默认配置
      return {
        model: 'BAAI/bge-m3',
        dimensions: 1024,
        collection: 'my_knowledge_bge-m3',
        detectedLanguage: 'default'
      };
    }
  }

  // 搜索知识库
  async searchKnowledgeBase(query, collectionId = null, limit = 10, threshold = 0.7) {
    try {
      console.log(`🔍 搜索知识库: "${query}"`);
      console.log(`🔍 搜索参数详情:`, {
        query: query,
        queryType: typeof query,
        collectionId: collectionId,
        collectionIdType: typeof collectionId,
        limit: limit,
        threshold: threshold
      });

      // 获取API配置用于搜索
      const apiConfig = getApiConfig();
      console.log('🔍 搜索前API配置检查:', {
        hasConfig: !!apiConfig,
        hasApiKey: !!apiConfig.apiKey,
        apiKeyLength: apiConfig.apiKey ? apiConfig.apiKey.length : 0,
        apiKeyPrefix: apiConfig.apiKey ? apiConfig.apiKey.substring(0, 10) + '...' : 'null'
      });

      // 调用后端搜索API - 后端会处理向量嵌入生成
      const searchParams = {
        query: query,
        collection_id: collectionId,
        limit: limit,
        threshold: threshold,
        apiKey: apiConfig.apiKey || ''
      };

      console.log('🔍 传递给后端的搜索参数:', {
        ...searchParams,
        apiKey: searchParams.apiKey ? `${searchParams.apiKey.substring(0, 10)}...` : 'null'
      });

      const response = await invoke('search_knowledge_base', searchParams);

      console.log(`✅ 搜索完成: 收到响应`);
      console.log(`🔍 响应类型: ${typeof response}`);
      console.log(`🔍 响应内容:`, response);

      // SearchResponse结构包含results字段
      if (!response || !response.results) {
        console.warn('⚠️ 搜索响应格式不正确，返回空数组');
        return [];
      }

      const results = response.results;
      console.log(`✅ 提取到 ${results.length} 个搜索结果`);
      console.log(`🔍 搜索耗时: ${response.query_time_ms}ms`);
      console.log(`🔍 搜索集合: ${response.collection_id}`);
      console.log(`🔍 嵌入模型: ${response.embedding_model}`);

      return results;
    } catch (error) {
      console.error('❌ 知识库搜索失败:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  // 获取集合中的文档
  async getDocuments(collectionId) {
    try {
      const documents = await invoke('get_knowledge_documents', { collectionId });
      return documents;
    } catch (error) {
      console.error('❌ 获取文档失败:', error);
      return [];
    }
  }

  // 删除文档
  async deleteDocument(documentId) {
    try {
      await invoke('delete_knowledge_document', { documentId });
      console.log(`✅ 文档删除成功: ${documentId}`);
    } catch (error) {
      console.error('❌ 删除文档失败:', error);
      throw error;
    }
  }

  // 获取知识库统计信息
  async getStatistics() {
    try {
      const stats = await invoke('get_knowledge_statistics');
      return stats;
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      return null;
    }
  }

  // 获取指定集合的统计信息
  async getCollectionStats(collectionId) {
    try {
      const stats = await invoke('get_knowledge_statistics', { collectionId });
      return stats;
    } catch (error) {
      console.error('❌ 获取集合统计信息失败:', error);
      return {
        documentsCount: 0,
        vectorsCount: 0,
        totalSize: 0
      };
    }
  }

  // 检查知识库状态
  async getStatus() {
    try {
      const systemStatus = await invoke('get_system_status');
      return {
        isInitialized: this.isInitialized,
        databaseConnected: systemStatus.databaseHealth,
        vectorExtension: true, // sqlite-vec已经集成到后端
        collections: await this.getCollections(),
        totalDocuments: systemStatus.totalDocuments,
        totalVectors: systemStatus.totalVectors,
        memoryUsageMB: systemStatus.memoryUsageMB,
        uptimeSeconds: systemStatus.uptimeSeconds
      };
    } catch (error) {
      console.error('❌ 获取状态失败:', error);
      return {
        isInitialized: false,
        databaseConnected: false,
        vectorExtension: false,
        collections: [],
        totalDocuments: 0,
        totalVectors: 0,
        memoryUsageMB: 0,
        uptimeSeconds: 0
      };
    }
  }

  // 获取总文档数量
  async getTotalDocumentCount() {
    try {
      const collections = await this.getCollections();
      let totalCount = 0;

      for (const collection of collections) {
        const documents = await this.getDocuments(collection.id);
        totalCount += documents.length;
      }

      return totalCount;
    } catch (error) {
      console.error('❌ 获取文档总数失败:', error);
      return 0;
    }
  }

  // 调试数据库信息
  async debugDatabaseInfo() {
    try {
      console.log('🔍 开始获取数据库调试信息...');
      const debugInfo = await invoke('debug_database_info');
      console.log('✅ 数据库调试信息:', debugInfo);
      return debugInfo;
    } catch (error) {
      console.error('❌ 获取数据库调试信息失败:', error);
      return null;
    }
  }
}

// 创建单例实例
const knowledgeBaseSQLiteVec = new KnowledgeBaseSQLiteVec();

export default knowledgeBaseSQLiteVec;
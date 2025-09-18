/**
 * 知识库管理器 - 统一的API接口
 * 封装新的SQLite + sqlite-vec后端，保持与原有Qdrant接口的兼容性
 */
import knowledgeBaseSQLiteVec from './knowledgeBaseSQLiteVec.js';

class KnowledgeBaseManager {
  constructor() {
    this.knowledgeBase = knowledgeBaseSQLiteVec;
    this.isInitialized = false;
  }

  // 初始化知识库
  async initialize() {
    try {
      await this.knowledgeBase.initialize();
      this.isInitialized = true;

      // 检查是否需要创建默认集合
      const collections = await this.knowledgeBase.getCollections();
      if (collections.length === 0) {
        console.log('🔧 初次使用，创建默认语言集合...');

        // 创建中文知识库集合
        await this.knowledgeBase.createCollection(
          'my_knowledge_bge-large-zh-v1.5',
          '中文知识库 (BAAI/bge-large-zh-v1.5)',
          'BAAI/bge-large-zh-v1.5',
          1024
        );

        // 创建英文知识库集合
        await this.knowledgeBase.createCollection(
          'my_knowledge_bge-large-en-v1.5',
          '英文知识库 (BAAI/bge-large-en-v1.5)',
          'BAAI/bge-large-en-v1.5',
          1024
        );

        // 创建默认知识库集合
        await this.knowledgeBase.createCollection(
          'my_knowledge_bge-m3',
          '默认知识库 (BAAI/bge-m3)',
          'BAAI/bge-m3',
          1024
        );

        console.log('✅ 默认语言集合创建完成');
      }

      return true;
    } catch (error) {
      console.error('❌ 知识库初始化失败:', error);
      return false;
    }
  }

  // 获取存储的文档（兼容原有接口）
  async getStoredDocuments() {
    try {
      const collections = await this.knowledgeBase.getCollections();
      let allDocuments = [];
      const seenDocuments = new Set(); // 用于去重

      for (const collection of collections) {
        const documents = await this.knowledgeBase.getDocuments(collection.id);
        // 添加集合信息到文档中，并去重
        const documentsWithCollection = documents
          .filter(doc => {
            // 基于标题和内容进行去重
            const docKey = `${doc.title}_${doc.content?.substring(0, 100)}_${doc.file_name || ''}`;
            if (seenDocuments.has(docKey)) {
              console.log(`🔄 发现重复文档，跳过: ${doc.title}`);
              return false;
            }
            seenDocuments.add(docKey);
            return true;
          })
          .map(doc => ({
            ...doc,
            collectionId: collection.id,
            collectionName: collection.name
          }));
        allDocuments.push(...documentsWithCollection);
      }

      return allDocuments;
    } catch (error) {
      console.error('❌ 获取文档失败:', error);
      return [];
    }
  }

  // 获取统计信息（兼容原有接口）
  async getStatistics() {
    try {
      // 获取所有集合的统计信息
      const collections = await this.knowledgeBase.getCollections();
      let totalDocuments = 0;
      let totalVectors = 0;
      let totalSize = 0;

      for (const collection of collections) {
        try {
          const stats = await this.knowledgeBase.getCollectionStats(collection.id);
          totalDocuments += stats.documentsCount || 0;
          totalVectors += stats.vectorsCount || 0;
          totalSize += stats.totalSize || 0;
        } catch (error) {
          console.warn(`⚠️ 获取集合 ${collection.id} 统计信息失败:`, error);
        }
      }

      const status = await this.knowledgeBase.getStatus();
      return {
        documentCount: totalDocuments,
        vectorCount: totalVectors,
        totalSize: totalSize,
        collectionsCount: collections.length,
        databaseHealth: status.databaseConnected,
        uptimeSeconds: status.uptimeSeconds,
        memoryUsageMB: status.memoryUsageMB
      };
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      return null;
    }
  }

  // 搜索（兼容原有接口）
  async search(query, options = {}) {
    try {
      const {
        limit = 5,
        threshold = 0.7,
        collectionId = null,
        useHybridSearch = false,
        documentIds = null,
      } = options;

      let results = [];

      if (collectionId) {
        // 搜索指定集合
        results = await this.knowledgeBase.searchKnowledgeBase(
          query,
          collectionId,
          limit,
          threshold,
          documentIds
        );
      } else {
        // 搜索所有集合
        const collections = await this.knowledgeBase.getCollections();
        console.log(`🔍 搜索 ${collections.length} 个集合...`);
        for (const collection of collections) {
          try {
            console.log(`🔍 搜索集合: ${collection.name} (ID: ${collection.id})`);
            const collectionResults = await this.knowledgeBase.searchKnowledgeBase(
              query,
              collection.id,
              Math.ceil(limit / collections.length), // 分配限制
              threshold,
              documentIds
            );
            console.log(`✅ 集合 ${collection.name} 搜索完成，找到 ${collectionResults ? collectionResults.length : 'undefined'} 个结果`);

            // 确保collectionResults是数组
            if (Array.isArray(collectionResults)) {
              results.push(...collectionResults);
            } else {
              console.warn(`⚠️ 集合 ${collection.name} 搜索返回了非数组结果:`, collectionResults);
            }
          } catch (error) {
            console.warn(`⚠️ 搜索集合 ${collection.name} (ID: ${collection.id}) 失败:`, error);
            // 如果集合不存在，跳过并继续搜索其他集合
            if (error.message && error.message.includes('不存在')) {
              console.log(`⏭️ 跳过不存在的集合: ${collection.name}`);
              continue;
            }
          }
        }

        // 去重（优先按 chunk_id），避免“缓存+回退”或多源累积导致的重复
        const seenIds = new Set();
        const seenText = new Set();
        const unique = [];
        for (const r of results) {
          const id = r.chunk_id || r.id;
          const textKey = (r.chunk_text || r.content || '').trim().slice(0, 200);
          const dup = (id && seenIds.has(id)) || (textKey && seenText.has(textKey));
          if (!dup) {
            if (id) seenIds.add(id);
            if (textKey) seenText.add(textKey);
            unique.push(r);
          }
        }

        // 按相似度排序并限制结果数量
        unique.sort((a, b) => (b.similarity || b.score || 0) - (a.similarity || a.score || 0));
        results = unique.slice(0, limit);
      }

      // 转换结果格式以兼容原有接口
      return results.map(result => ({
        id: result.chunk_id,
        content: result.chunk_text,
        documentId: result.document_id,
        documentTitle: result.document_title,
        fileName: result.file_name,
        score: result.score,
        similarity: result.similarity,
        metadata: {
          chunk_id: result.chunk_id,
          document_id: result.document_id,
          collection_id: result.collection_id
        }
      }));
    } catch (error) {
      console.error('❌ 搜索失败:', error);
      return [];
    }
  }

  // SQLite搜索（兼容原有接口）
  async searchSQLite(query, limit = 10, threshold = 0.7, useHybridSearch = true) {
    return this.search(query, { limit, threshold, useHybridSearch });
  }

  // 添加文档（兼容原有接口）
  async addDocument(documentData) {
    try {
      const {
        title,
        content,
        fileName = '',
        fileSize = 0,
        mimeType = '',
        collectionId = 'default'
      } = documentData;

      console.log('🚀 开始添加文档...');
      console.log(`📄 文档信息: 标题="${title}", 文件名="${fileName}", 大小=${fileSize}, 类型=${mimeType}`);
      console.log(`📝 内容长度: ${content.length} 字符`);

      // 根据内容语言自动选择模型和集合
      const modelConfig = await this.knowledgeBase.autoSelectModel(content);
      console.log(`🎯 语言检测和模型选择结果:`, modelConfig);

      // 确保存在对应的语言集合
      const collections = await this.knowledgeBase.getCollections();
      console.log(`📦 当前所有集合 (${collections.length}个):`, collections.map(c => ({ id: c.id, name: c.name })));
      console.log(`🔍 正在查找集合: "${modelConfig.collection}" (类型: ${typeof modelConfig.collection})`);

      let targetCollection = collections.find(c => c.name === modelConfig.collection || c.id === modelConfig.collection);
      console.log(`🔍 查找目标集合 "${modelConfig.collection}":`, targetCollection ? '找到' : '未找到');

      // 调试：打印所有集合的详细信息以便比较
      if (!targetCollection) {
        console.log(`🔍 调试信息：所有集合的详细名称和ID：`);
        collections.forEach((c, index) => {
          console.log(`  集合 ${index + 1}:`);
          console.log(`    ID: "${c.id}" (类型: ${typeof c.id})`);
          console.log(`    名称: "${c.name}" (类型: ${typeof c.name})`);
          console.log(`    与目标名称 "${modelConfig.collection}" 匹配: ${c.name === modelConfig.collection}`);
          console.log(`    与目标ID匹配: ${c.id === modelConfig.collection}`);
        });
      }
      console.log(`🔍 目标集合详细信息:`, targetCollection);

      if (!targetCollection) {
        console.log(`📦 创建语言集合: ${modelConfig.collection}`);
        targetCollection = await this.knowledgeBase.createCollection(
          modelConfig.collection,
          `${modelConfig.model} 知识库`,
          modelConfig.model,
          modelConfig.dimensions
        );
        console.log('✅ 集合创建成功:', targetCollection);
      }

      console.log(`📝 准备添加文档到集合: ${targetCollection.id}`);
      console.log(`🔍 targetCollection.id类型: ${typeof targetCollection.id}, 值:`, targetCollection.id);

      // 全局重复检查 - 检查所有集合中是否已存在相同文档
      const allExistingDocs = await this.getStoredDocuments();
      const globalDuplicate = allExistingDocs.find(doc =>
        doc.title === title &&
        doc.content === content &&
        doc.file_name === fileName
      );

      if (globalDuplicate) {
        console.log(`⚠️ 发现全局重复文档，跳过添加: ${title} (已存在于集合 ${globalDuplicate.collectionId})`);
        return globalDuplicate.id;
      }

      // 检查目标集合中是否已存在相同内容的文档（二次保险）
      const existingDocs = await this.knowledgeBase.getDocuments(targetCollection.id);
      const isDuplicate = existingDocs.some(doc =>
        doc.title === title &&
        doc.content === content &&
        doc.file_name === fileName
      );

      if (isDuplicate) {
        console.log(`⚠️ 发现目标集合内重复文档，跳过添加: ${title}`);
        return existingDocs.find(doc => doc.title === title && doc.content === content)?.id;
      }

      const documentId = await this.knowledgeBase.addDocument(
        targetCollection.id, // 使用找到或创建的集合ID
        title,
        content,
        fileName,
        fileSize,
        mimeType
      );

      console.log(`✅ 文档添加成功, ID: ${documentId}`);

      // 自动生成向量嵌入
      try {
        console.log('🔄 自动生成文档向量嵌入...');

        // 等待一小段时间确保数据库操作完成
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🔗 调用底层 generateDocumentEmbeddings:', { documentId, model: modelConfig.model, collectionId: targetCollection.id });
        console.log(`🔍 传递给generateDocumentEmbeddings的collectionId类型: ${typeof targetCollection.id}, 值:`, targetCollection.id);

        const embeddingResult = await this.knowledgeBase.generateDocumentEmbeddings(documentId, content, modelConfig.model, targetCollection.id);
        console.log(`✅ 文档向量嵌入生成完成: ${embeddingResult.vectors_count} 个向量, ${embeddingResult.chunks_count} 个块`);
        console.log(`📊 详细结果:`, embeddingResult);
      } catch (embeddingError) {
        console.error('❌ 自动生成向量嵌入失败:', embeddingError);
        // 不抛出错误，因为文档已经成功添加
      }

      return documentId;
    } catch (error) {
      console.error('❌ 添加文档失败:', error);
      console.error('错误堆栈:', error.stack);
      throw error;
    }
  }

  // 生成文档嵌入向量（兼容原有接口）
  async generateDocumentEmbeddings(documentId, content = null, model = null, collectionId = null) {
    try {
      // 如果需要，先获取文档内容
      let documentContent = content;
      if (!documentContent) {
        // 这里需要实现获取文档内容的逻辑
        // 暂时假设content已经传入
        throw new Error('需要提供文档内容');
      }

      const result = await this.knowledgeBase.generateDocumentEmbeddings(
        documentId,
        documentContent,
        model,
        collectionId
      );

      return result;
    } catch (error) {
      console.error('❌ 生成嵌入向量失败:', error);
      throw error;
    }
  }

  // 删除文档（兼容原有接口）
  async deleteDocument(documentId) {
    try {
      await this.knowledgeBase.deleteDocument(documentId);
      return true;
    } catch (error) {
      console.error('❌ 删除文档失败:', error);
      throw error;
    }
  }

  // 清空所有文档（兼容原有接口）
  async clearAllDocuments() {
    try {
      const collections = await this.knowledgeBase.getCollections();

      for (const collection of collections) {
        const documents = await this.knowledgeBase.getDocuments(collection.id);

        for (const document of documents) {
          await this.knowledgeBase.deleteDocument(document.id);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ 清空文档失败:', error);
      throw error;
    }
  }

  // 获取系统状态（兼容原有接口）
  async getSystemStatus() {
    try {
      return await this.knowledgeBase.getStatus();
    } catch (error) {
      console.error('❌ 获取系统状态失败:', error);
      throw error;
    }
  }

  // 获取配置（兼容原有接口）
  async getConfig() {
    return {
      useQdrant: false, // 不再使用Qdrant
      qdrantReady: true, // 使用SQLite总是就绪
      embeddingModel: this.knowledgeBase.embeddingModel,
      embeddingDimensions: this.knowledgeBase.embeddingDimensions,
      expertModelMode: this.knowledgeBase.expertModelMode
    };
  }

  // 获取文档（兼容原有接口）
  async getDocuments() {
    return await this.getStoredDocuments();
  }

  // 设置嵌入配置（兼容原有接口）
  async setEmbeddingConfig(model, dimensions = 384, taskType = 'search') {
    this.knowledgeBase.setEmbeddingConfig(model, dimensions, taskType);
  }
}

// 创建单例实例
const knowledgeBaseManager = new KnowledgeBaseManager();

export { knowledgeBaseManager };
export default knowledgeBaseManager;
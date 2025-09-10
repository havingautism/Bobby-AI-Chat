/**
 * 知识库管理器 - 集成Qdrant向量数据库和SQLite文档存储
 * 使用内置的Qdrant管理器自动处理安装和启动
 */
import Database from '@tauri-apps/plugin-sql';
import qdrantManager from './qdrantManager.js';
import qdrantService from './qdrantService.js';
import embeddingService from './embeddingService.js';
import { autoSelectModel } from './languageDetector.js';
import { invoke } from '@tauri-apps/api/core';

class KnowledgeBaseQdrant {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.useQdrant = false;
    this.qdrantReady = false;
    this.embeddingModel = 'bge-base-zh-v1.5'; // 默认使用中文专家模型
    this.embeddingDimensions = 768; // 专家模型768维
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
  setEmbeddingConfig(model = 'bge-base-zh-v1.5', dimensions = 768, taskType = 'search') {
    this.embeddingModel = model;
    this.embeddingDimensions = dimensions;
    this.embeddingTaskType = taskType;
    console.log(`🔧 嵌入模型配置已更新: ${model} (${dimensions}维, ${taskType})`);
  }

  // 初始化数据库和Qdrant服务
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔧 开始初始化知识库...');
      
      // 初始化SQLite数据库
      this.db = await Database.load('sqlite:knowledge_base.db');
      
      // 创建表结构
      await this.createTables();
      
      // 直接初始化Qdrant服务
      console.log('🚀 初始化Qdrant服务...');
      const qdrantInitSuccess = await qdrantService.initialize();
      
      if (qdrantInitSuccess) {
        this.useQdrant = true;
        this.qdrantReady = true;
        console.log('✅ 知识库已初始化 (SQLite + Qdrant)');
        console.log('📊 Qdrant状态: useQdrant=', this.useQdrant, ', qdrantReady=', this.qdrantReady);
      } else {
        console.warn('⚠️ Qdrant服务启动超时，使用SQLite模式');
        this.useQdrant = false;
        this.qdrantReady = false;
        console.log('📊 Qdrant状态: useQdrant=', this.useQdrant, ', qdrantReady=', this.qdrantReady);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ 知识库初始化失败:', error);
      throw error;
    }
  }

  // 等待Qdrant服务启动
  async waitForQdrant(maxAttempts = 30, delay = 1000) {
    console.log('⏳ 等待Qdrant服务启动...');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const success = await qdrantService.initialize();
        if (success) {
          console.log('✅ Qdrant服务已启动');
          return true;
        }
      } catch (error) {
        console.log(`⏳ 等待中... (${i + 1}/${maxAttempts})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.error('❌ Qdrant服务启动超时');
    return false;
  }

  // 创建数据库表
  async createTables() {
    // 文档表
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // 向量表（用于非Qdrant环境的降级）
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_vectors (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES knowledge_documents (id)
      )
    `);
  }

  // 添加文档
  async addDocument(document) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 统一生成文档ID，避免出现 null/undefined 被写入
      const docId = document.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      // 规范化元数据：把 sourceType 一并写入 metadata
      const mergedMetadata = {
        ...(document.metadata || {}),
        sourceType: document.sourceType || this.inferSourceType(document.fileName, document.mimeType),
      };

      // 存储文档到SQLite
      await this.db.execute(`
        INSERT OR REPLACE INTO knowledge_documents
        (id, title, content, file_name, file_size, mime_type, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        docId,
        document.title,
        document.content,
        document.fileName || null,
        document.fileSize || null,
        document.mimeType || null,
        JSON.stringify(mergedMetadata),
        document.createdAt || Date.now(),
        document.updatedAt || Date.now()
      ]);

      console.log(`✅ 文档已添加到SQLite: ${docId}`);

      // 如果Qdrant可用，也存储向量
      if (this.useQdrant && this.qdrantReady) {
        if (this.expertModelMode) {
          // 专家模型分离模式：根据内容语言选择集合
          const success = await this.addDocumentVectorsExpertMode(
            docId,
            document.content,
            {
              title: document.title,
              sourceType: mergedMetadata.sourceType,
              fileName: document.fileName,
              fileSize: document.fileSize
            }
          );
          
          if (success) {
            console.log(`✅ 文档向量已存储到专家模型集合: ${docId}`);
          } else {
            console.warn(`⚠️ 文档向量存储到专家模型集合失败: ${docId}`);
          }
        } else {
          // 传统模式：使用默认集合
          const success = await qdrantService.addDocumentVectors(
            docId,
            document.content,
            {
              title: document.title,
              sourceType: mergedMetadata.sourceType,
              fileName: document.fileName,
              fileSize: document.fileSize
            }
          );
          
          if (success) {
            console.log(`✅ 文档向量已存储到Qdrant: ${docId}`);
          } else {
            console.warn(`⚠️ 文档向量存储到Qdrant失败: ${docId}`);
          }
        }
      }

      return docId;
    } catch (error) {
      console.error('❌ 添加文档失败:', error);
      throw error;
    }
  }

  // 删除文档
  async deleteDocument(documentId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🗑️ 开始删除文档: ${documentId}`);
      
      // 检查文档是否存在
      const existingDoc = await this.db.select(`
        SELECT id, title FROM knowledge_documents WHERE id = ?
      `, [documentId]);
      
      if (existingDoc.length === 0) {
        console.warn(`⚠️ 文档不存在: ${documentId}`);
        throw new Error(`文档不存在: ${documentId}`);
      }
      
      console.log(`📄 找到文档: ${existingDoc[0].title}`);
      
      // 先删除向量数据（避免外键约束错误）
      if (this.useQdrant && this.qdrantReady) {
        try {
          if (this.expertModelMode) {
            // 专家模型分离模式：在所有集合中删除
            console.log(`🎯 专家模式：在所有集合中删除文档 ${documentId} 的向量`);
            const success = await this.deleteDocumentVectorsExpertMode(documentId);
            if (success) {
              console.log(`✅ 已从所有专家模型集合删除文档向量: ${documentId}`);
            } else {
              console.warn(`⚠️ 从专家模型集合删除文档向量失败: ${documentId}`);
            }
          } else {
            // 传统模式：在默认集合中删除
            const success = await qdrantService.deleteDocumentVectors(documentId);
            if (success) {
              console.log(`✅ 已从Qdrant删除文档向量: ${documentId}`);
            } else {
              console.warn(`⚠️ 从Qdrant删除文档向量失败: ${documentId}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Qdrant删除向量时出错: ${error.message}`);
        }
      }
      
      // 从SQLite删除向量（无论是否使用Qdrant都要删除SQLite中的向量记录）
      try {
        const vectorResult = await this.db.execute(`
          DELETE FROM knowledge_vectors WHERE document_id = ?
        `, [documentId]);
        console.log(`🗑️ 从SQLite删除向量结果:`, vectorResult);
      } catch (error) {
        console.warn(`⚠️ 删除SQLite向量时出错: ${error.message}`);
      }
      
      // 最后删除文档
      const docResult = await this.db.execute(`
        DELETE FROM knowledge_documents WHERE id = ?
      `, [documentId]);
      console.log(`🗑️ 从SQLite删除文档结果:`, docResult);
      
      console.log(`✅ 文档已删除: ${documentId}`);
    } catch (error) {
      console.error('❌ 删除文档失败:', error);
      throw error;
    }
  }

  // 获取文档列表
  async getDocuments() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const results = await this.db.select(`
        SELECT * FROM knowledge_documents 
        ORDER BY updated_at DESC
      `);

      return results.map(result => {
        const metadata = result.metadata ? JSON.parse(result.metadata) : null;
        const sourceType = metadata?.sourceType || this.inferSourceType(result.file_name, result.mime_type);
        return {
          id: result.id,
          title: result.title,
          content: result.content,
          fileName: result.file_name,
          fileSize: result.file_size,
          mimeType: result.mime_type,
          metadata: metadata,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
          sourceType: sourceType,
          sourceUrl: metadata?.sourceUrl || null
        };
      });
    } catch (error) {
      console.error('❌ 获取文档失败:', error);
      throw error;
    }
  }

  // 兼容性方法：getStoredDocuments 调用 getDocuments
  async getStoredDocuments() {
    return await this.getDocuments();
  }

  // 根据ID列表获取文档
  async getDocumentsByIds(documentIds) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!documentIds || documentIds.length === 0) {
        return [];
      }

      const placeholders = documentIds.map(() => '?').join(',');
      const results = await this.db.select(`
        SELECT * FROM knowledge_documents 
        WHERE id IN (${placeholders})
        ORDER BY updated_at DESC
      `, documentIds);

      return results.map(result => {
        const metadata = result.metadata ? JSON.parse(result.metadata) : null;
        const sourceType = metadata?.sourceType || this.inferSourceType(result.file_name, result.mime_type);
        return {
          id: result.id,
          title: result.title,
          content: result.content,
          fileName: result.file_name,
          fileSize: result.file_size,
          mimeType: result.mime_type,
          metadata: metadata,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
          sourceType: sourceType,
          sourceUrl: metadata?.sourceUrl || null
        };
      });
    } catch (error) {
      console.error('❌ 根据ID获取文档失败:', error);
      return [];
    }
  }

  // 兼容性方法：search 调用 searchDocuments
  async search(query, options = {}) {
    const { limit = 10, threshold = 0.3, includeContent = true } = options;
    return await this.searchDocuments(query, limit, threshold, includeContent);
  }

  // 兼容性方法：searchSQLite 调用 searchDocuments
  async searchSQLite(query, limit, threshold, includeContent) {
    return await this.searchDocuments(query, limit, threshold, includeContent);
  }

  // 兼容性方法：addDocumentToSQLite 调用 addDocument
  async addDocumentToSQLite(docData) {
    return await this.addDocument(docData);
  }

  // 搜索文档
  async searchDocuments(query, limit = 10, threshold = 0.01, useHybrid = true) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let results = [];

      console.log('📊 搜索状态检查: useQdrant=', this.useQdrant, ', qdrantReady=', this.qdrantReady);
      
      if (this.useQdrant && this.qdrantReady) {
        // 使用Qdrant进行向量搜索
        console.log('🔍 使用Qdrant进行向量搜索');
        let qdrantResults;
        
        if (this.expertModelMode) {
          // 专家模型分离模式：在所有集合中搜索
          console.log('🎯 专家模型分离模式：多集合搜索');
          const rawResults = await qdrantService.searchAllCollections(query, limit, threshold);
          
          // 转换结果格式以兼容现有接口
          qdrantResults = rawResults.map(result => {
            const chunkText = result.payload?.chunk_text;
            const content = result.payload?.content;
            const finalContent = chunkText || content || '';
            
            console.log(`🔍 处理搜索结果:`, {
              id: result.payload?.document_id || result.id,
              title: result.payload?.title || result.payload?.document_title || result.payload?.name || 'Unknown',
              hasChunkText: !!chunkText,
              hasContent: !!content,
              chunkTextLength: chunkText?.length || 0,
              contentLength: content?.length || 0,
              finalContentLength: finalContent.length,
              finalContentPreview: finalContent.substring(0, 100) + (finalContent.length > 100 ? '...' : '')
            });
            
            return {
              id: result.payload?.document_id || result.id,
              title: result.payload?.title || result.payload?.document_title || result.payload?.name || 'Unknown',
              content: finalContent,
              score: result.score || 0,
              chunkIndex: result.payload?.chunk_index || 0,
              sourceType: result.payload?.source_type || 'unknown',
              fileName: result.payload?.file_name || result.payload?.filename || null,
              fileSize: result.payload?.file_size || null,
              metadata: result.payload || {},
              collection: result.collection,
              language: result.language
            };
          });
        } else {
          // 传统模式：在默认集合中搜索
          console.log('🎯 传统模式：单集合搜索');
          const rawQdrantResults = await qdrantService.searchDocuments(query, limit, threshold);
          
          // 为传统模式搜索结果添加调试信息并确保content字段正确映射
          qdrantResults = rawQdrantResults.map(result => {
            console.log(`🔍 传统模式搜索结果处理:`, {
              id: result.id,
              title: result.title,
              originalContentLength: result.content?.length || 0,
              hasChunkTextInPayload: result.payload?.chunk_text ? true : false,
              hasContentInPayload: result.payload?.content ? true : false
            });
            
            // 确保content字段正确映射 - 优先使用chunk_text
            const finalContent = result.payload?.chunk_text || result.payload?.content || result.content || '';
            
            return {
              ...result,
              content: finalContent
            };
          });
          
          // 添加处理后的搜索结果调试信息
          console.log(`🔍 传统模式处理后搜索结果:`, qdrantResults.map(r => ({
            id: r.id,
            title: r.title,
            contentLength: r.content?.length || 0,
            contentPreview: r.content?.substring(0, 100) + (r.content?.length > 100 ? '...' : ''),
            score: r.score
          })));
        }
        
        if (useHybrid) {
          // 混合搜索：Qdrant向量搜索 + SQLite文本搜索
          const textResults = await this.textSearch(query, limit);
          
          // 合并结果
          const combinedResults = new Map();
          
          // 添加文本搜索结果
          textResults.forEach(result => {
            combinedResults.set(result.id, {
              ...result,
              textScore: 1.0,
              vectorScore: 0.0,
              finalScore: 1.0
            });
          });
          
          // 添加向量搜索结果
          qdrantResults.forEach(result => {
            const existing = combinedResults.get(result.id);
            if (existing) {
              existing.vectorScore = result.score;
              existing.finalScore = (existing.textScore + result.score) / 2;
            } else {
              combinedResults.set(result.id, {
                ...result,
                textScore: 0.0,
                vectorScore: result.score,
                finalScore: result.score
              });
            }
          });
          
          results = Array.from(combinedResults.values())
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, limit);
        } else {
          // 仅向量搜索
          results = qdrantResults;
        }
      } else {
        // 降级到SQLite搜索
        console.log('⚠️ Qdrant不可用，使用SQLite搜索');
        results = await this.sqliteSearch(query, limit, threshold);
      }

      // 在返回结果之前添加最终调试信息
      console.log(`🔍 最终搜索结果:`, results.map(r => ({
        id: r.id,
        title: r.title,
        contentLength: r.content?.length || 0,
        contentPreview: r.content?.substring(0, 100) + (r.content?.length > 100 ? '...' : ''),
        score: r.score,
        sourceType: r.sourceType
      })));
      
      return results;
    } catch (error) {
      console.error('❌ 搜索文档失败:', error);
      throw error;
    }
  }

  // SQLite文本搜索
  async textSearch(query, limit) {
    const results = await this.db.select(`
      SELECT * FROM knowledge_documents 
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY 
        CASE 
          WHEN title LIKE ? THEN 1
          WHEN content LIKE ? THEN 2
          ELSE 3
        END,
        updated_at DESC
      LIMIT ?
    `, [
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      limit
    ]);

    return results.map(result => {
      const metadata = result.metadata ? JSON.parse(result.metadata) : null;
      return {
        id: result.id,
        title: result.title,
        content: result.content,
        fileName: result.file_name,
        fileSize: result.file_size,
        mimeType: result.mime_type,
        metadata: metadata,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        sourceType: metadata?.sourceType || 'manual',
        sourceUrl: metadata?.sourceUrl || null
      };
    });
  }

  // SQLite向量搜索（降级方案）
  async sqliteSearch(query, limit, threshold) {
    try {
      // 生成查询向量
      const queryResult = await embeddingService.generateEmbedding(query);
      const queryEmbedding = queryResult.embedding;
      
      // 获取所有向量
      const vectors = await this.db.select(`
        SELECT kv.*, kd.title, kd.content, kd.file_name, kd.file_size, kd.mime_type, kd.metadata
        FROM knowledge_vectors kv
        JOIN knowledge_documents kd ON kv.document_id = kd.id
        ORDER BY kv.created_at DESC
      `);

      // 计算相似度并排序
      const results = [];
      for (const vector of vectors) {
        try {
          const storedEmbedding = JSON.parse(vector.embedding);
          const similarity = await embeddingService.calculateSimilarity(queryEmbedding, storedEmbedding);
          
          if (similarity >= threshold) {
            const metadata = vector.metadata ? JSON.parse(vector.metadata) : null;
            results.push({
              id: vector.document_id,
              title: vector.title,
              content: vector.chunk_text,
              full_content: vector.content,
              score: similarity || 0, // 确保score字段总是有值
              chunkIndex: vector.chunk_index,
              fileName: vector.file_name,
              fileSize: vector.file_size,
              mimeType: vector.mime_type,
              metadata: metadata,
              sourceType: metadata?.sourceType || 'manual'
            });
          }
        } catch (error) {
          console.error('❌ 处理向量失败:', error);
        }
      }

      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('❌ SQLite向量搜索失败:', error);
      return [];
    }
  }

  // 为文档生成向量嵌入
  async generateDocumentEmbeddings(documentId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 获取文档内容
      const docs = await this.db.select(`
        SELECT content FROM knowledge_documents WHERE id = ?
      `, [documentId]);

      if (docs.length === 0) {
        throw new Error(`文档不存在: ${documentId}`);
      }

      const content = docs[0].content;
      
      console.log(`🔄 开始为文档 ${documentId} 生成嵌入向量...`);
      console.log('📊 向量生成状态检查: useQdrant=', this.useQdrant, ', qdrantReady=', this.qdrantReady);
      
      if (this.useQdrant && this.qdrantReady) {
        // 使用Qdrant存储向量
        const success = await qdrantService.addDocumentVectors(
          documentId,
          content,
          {
            title: docs[0].title || 'Unknown',
            sourceType: 'manual'
          }
        );
        
        if (success) {
          console.log(`✅ 文档 ${documentId} 的向量已存储到Qdrant`);
        } else {
          throw new Error('Qdrant向量存储失败');
        }
      } else {
        // 降级到SQLite存储，使用EmbeddingGemma模型
        const embeddings = await this.generateDocumentEmbeddingsWithModel(content);
        
        // 删除旧的向量数据
        await this.db.execute(`
          DELETE FROM knowledge_vectors WHERE document_id = ?
        `, [documentId]);
        
        // 存储新的向量数据
        for (const embeddingData of embeddings) {
          await this.db.execute(`
            INSERT INTO knowledge_vectors
            (id, document_id, chunk_index, chunk_text, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            `${documentId}_chunk_${embeddingData.chunkIndex}`,
            documentId,
            embeddingData.chunkIndex,
            embeddingData.chunkText,
            JSON.stringify(embeddingData.embedding),
            Date.now()
          ]);
        }
        
        console.log(`✅ 文档 ${documentId} 的向量已存储到SQLite，共 ${embeddings.length} 个向量`);
      }
    } catch (error) {
      console.error('❌ 生成文档嵌入失败:', error);
      throw error;
    }
  }

  // 获取统计信息
  async getStatistics() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const docCount = await this.db.select(`SELECT COUNT(*) as count FROM knowledge_documents`);
      const totalSize = await this.db.select(`SELECT SUM(file_size) as total FROM knowledge_documents WHERE file_size IS NOT NULL`);
      
      let vectorCount = 0;
      let qdrantStats = null;
      
      if (this.useQdrant && this.qdrantReady) {
        qdrantStats = await qdrantService.getStatistics();
        vectorCount = qdrantStats.vectorsCount;
      } else {
        const vectorResult = await this.db.select(`SELECT COUNT(*) as count FROM knowledge_vectors`);
        vectorCount = vectorResult[0].count || 0;
      }
      
      console.log('📊 统计信息查询结果:', { 
        docCount: docCount[0].count, 
        vectorCount: vectorCount, 
        totalSize: totalSize[0].total,
        useQdrant: this.useQdrant,
        qdrantReady: this.qdrantReady,
        qdrantStats: qdrantStats
      });
      
      return {
        documentCount: docCount[0].count || 0,
        vectorCount: vectorCount,
        totalSize: totalSize[0].total || 0,
        useQdrant: this.useQdrant,
        qdrantReady: this.qdrantReady,
        qdrantStats: qdrantStats
      };
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      return {
        documentCount: 0,
        vectorCount: 0,
        totalSize: 0,
        useQdrant: false,
        qdrantReady: false,
        qdrantStats: null
      };
    }
  }

  // 清理所有文档
  async clearAllDocuments() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🧹 开始清理所有文档和向量...');
      
      // 获取所有文档数量
      const docCount = await this.db.select(`SELECT COUNT(*) as count FROM knowledge_documents`);
      
      console.log(`📊 准备删除 ${docCount[0].count} 个文档`);
      
      let vectorResult = null;
      
      if (this.useQdrant && this.qdrantReady) {
        // 清空Qdrant集合
        if (this.expertModelMode) {
          // 专家模型模式：清空所有专家模型集合
          console.log(`🎯 专家模式：清空所有专家模型集合`);
          const success = await this.clearAllExpertCollections();
          if (success) {
            console.log(`✅ 所有专家模型集合已清空`);
            
            // 清空后优化索引
            try {
              await this.optimizeAllExpertCollections();
              console.log('✅ 专家模型集合索引优化完成');
            } catch (optimizeError) {
              console.warn(`⚠️ 专家模型集合索引优化失败: ${optimizeError.message}`);
            }
          } else {
            console.warn(`⚠️ 专家模型集合清空失败`);
          }
        } else {
          // 传统模式：清空默认集合
          const success = await qdrantService.clearCollection();
          if (success) {
            console.log(`✅ Qdrant集合已清空`);
            
            // 清空后优化索引
            try {
              await qdrantService.optimizeCollection();
              console.log('✅ Qdrant索引优化完成');
            } catch (optimizeError) {
              console.warn(`⚠️ Qdrant索引优化失败: ${optimizeError.message}`);
            }
          } else {
            console.warn(`⚠️ Qdrant集合清空失败`);
          }
        }
      } else {
        // 删除SQLite向量数据
        vectorResult = await this.db.execute(`DELETE FROM knowledge_vectors`);
        console.log(`🗑️ 删除SQLite向量结果:`, vectorResult);
      }
      
      // 删除所有文档
      const docResult = await this.db.execute(`DELETE FROM knowledge_documents`);
      console.log(`🗑️ 删除SQLite文档结果:`, docResult);
      
      console.log('✅ 所有文档和向量已清理完成');
      
      return {
        deletedDocuments: docResult.changes || 0,
        deletedVectors: this.useQdrant ? 'qdrant_cleared' : (vectorResult?.changes || 0)
      };
    } catch (error) {
      console.error('❌ 清理所有文档失败:', error);
      throw error;
    }
  }

  // 获取Qdrant管理器信息
  async getQdrantInfo() {
    return await qdrantManager.getInfo();
  }

  /**
   * 诊断知识库：检查Qdrant可用性、向量统计、嵌入后端状态
   * @returns {Promise<object>}
   */
  async diagnoseKnowledgeBase() {
    const diag = {
      useQdrant: this.useQdrant,
      qdrantReady: this.qdrantReady,
      qdrantInfo: null,
      statistics: null,
      embedding: null,
      chunkDefaults: { size: 500, overlap: 50 },
    };

    try {
      try {
        diag.qdrantInfo = await qdrantManager.getInfo();
      } catch (e) {
        diag.qdrantInfo = { error: e?.message || String(e) };
      }

      try {
        diag.statistics = await this.getStatistics();
      } catch (e) {
        diag.statistics = { error: e?.message || String(e) };
      }

      try {
        diag.embedding = await embeddingService.diagnoseEmbeddingPipeline();
      } catch (e) {
        diag.embedding = { error: e?.message || String(e) };
      }

      return diag;
    } catch (error) {
      return { error: error?.message || String(error) };
    }
  }

  // 重启Qdrant服务
  async restartQdrant() {
    const success = await qdrantManager.restart();
    if (success) {
      // 重新初始化Qdrant服务
      this.qdrantReady = await qdrantService.initialize();
      this.useQdrant = this.qdrantReady;
    }
    return success;
  }

  /**
   * 强制优化单个集合
   * @param {string} collectionName - 集合名称
   * @returns {Promise<boolean>} 是否成功
   */
  async forceOptimizeCollection(collectionName) {
    try {
      console.log(`🔧 强制优化集合 ${collectionName}...`);
      
      // 方法1: 使用update_collection来设置优化配置
      const response = await fetch(`http://localhost:6333/collections/${collectionName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          optimizers_config: {
            deleted_threshold: 0.0,
            vacuum_min_vector_number: 0,
            default_segment_number: 0
          }
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ 优化集合 ${collectionName} 失败: ${response.statusText}`);
        return false;
      }

      console.log(`✅ 集合 ${collectionName} 强制优化完成`);
      return true;
    } catch (error) {
      console.error(`❌ 强制优化集合 ${collectionName} 失败:`, error);
      return false;
    }
  }

  /**
   * 专家模式：优化所有专家模型集合
   * @returns {Promise<boolean>} 是否成功
   */
  async optimizeAllExpertCollections() {
    try {
      console.log(`🔧 专家模式：开始优化所有专家模型集合...`);
      
      // 在所有专家模型集合中优化
      const optimizePromises = Object.values(qdrantService.collections).map(async (collectionName) => {
        try {
          console.log(`🔧 优化集合 ${collectionName}...`);
          
          // 使用update_collection来设置优化配置
          const response = await fetch(`http://localhost:6333/collections/${collectionName}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              optimizers_config: {
                deleted_threshold: 0.0,
                vacuum_min_vector_number: 0,
                default_segment_number: 0
              }
            })
          });

          if (!response.ok) {
            console.warn(`⚠️ 优化集合 ${collectionName} 失败: ${response.statusText}`);
            return false;
          }

          console.log(`✅ 集合 ${collectionName} 优化完成`);
          return true;
        } catch (error) {
          console.error(`❌ 优化集合 ${collectionName} 失败:`, error);
          return false;
        }
      });

      const results = await Promise.all(optimizePromises);
      const successCount = results.filter(r => r).length;
      const totalCount = results.length;
      
      console.log(`📊 专家模型集合优化结果: ${successCount}/${totalCount} 成功`);
      
      return successCount === totalCount;
    } catch (error) {
      console.error('❌ 优化专家模型集合失败:', error);
      return false;
    }
  }

  /**
   * 专家模式：清空所有专家模型集合
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAllExpertCollections() {
    try {
      console.log(`🧹 专家模式：开始清空所有专家模型集合...`);
      
      // 首先检查哪些集合存在
      const existingCollections = [];
      const checkPromises = Object.values(qdrantService.collections).map(async (collectionName) => {
        try {
          const response = await fetch(`http://localhost:6333/collections/${collectionName}`);
          if (response.ok) {
            existingCollections.push(collectionName);
            console.log(`✅ 集合 ${collectionName} 存在`);
            return { name: collectionName, exists: true };
          } else if (response.status === 404) {
            console.log(`ℹ️ 集合 ${collectionName} 不存在，跳过`);
            return { name: collectionName, exists: false };
          } else {
            console.warn(`⚠️ 检查集合 ${collectionName} 失败: ${response.status}`);
            return { name: collectionName, exists: false };
          }
        } catch (error) {
          console.warn(`⚠️ 检查集合 ${collectionName} 时出错:`, error.message);
          return { name: collectionName, exists: false };
        }
      });

      await Promise.all(checkPromises);
      
      if (existingCollections.length === 0) {
        console.log(`ℹ️ 没有找到任何专家模型集合，无需清空`);
        return true;
      }

      console.log(`📋 找到 ${existingCollections.length} 个存在的集合: ${existingCollections.join(', ')}`);
      
      // 只清空存在的集合
      const clearPromises = existingCollections.map(async (collectionName) => {
        try {
          console.log(`🔍 清空集合 ${collectionName}...`);
          
          // 使用scroll API获取所有点
          const scrollRequest = {
            limit: 10000,
            with_payload: false,
            with_vector: false
          };

          const scrollResponse = await fetch(`http://localhost:6333/collections/${collectionName}/points/scroll`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(scrollRequest)
          });

          if (!scrollResponse.ok) {
            console.warn(`⚠️ 获取集合 ${collectionName} 的点数据失败: ${scrollResponse.status}`);
            return false;
          }

          const scrollData = await scrollResponse.json();
          const pointIds = scrollData.result.points.map(point => point.id);
          
          if (pointIds.length === 0) {
            console.log(`ℹ️ 集合 ${collectionName} 中没有任何点需要删除`);
            return true;
          }

          // 删除所有点
          const deleteResponse = await fetch(`http://localhost:6333/collections/${collectionName}/points/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              points: pointIds
            })
          });

          if (!deleteResponse.ok) {
            console.error(`❌ 删除集合 ${collectionName} 的点失败: ${deleteResponse.statusText}`);
            return false;
          }

          console.log(`✅ 集合 ${collectionName} 已清空 (${pointIds.length} 个点)`);
          
          // 强制优化索引，确保向量被完全清理
          try {
            await this.forceOptimizeCollection(collectionName);
          } catch (optimizeError) {
            console.warn(`⚠️ 优化集合 ${collectionName} 失败: ${optimizeError.message}`);
          }
          
          return true;
        } catch (error) {
          console.error(`❌ 清空集合 ${collectionName} 失败:`, error);
          return false;
        }
      });

      const results = await Promise.all(clearPromises);
      const successCount = results.filter(r => r).length;
      const totalCount = results.length;
      
      console.log(`📊 专家模型集合清空结果: ${successCount}/${totalCount} 成功`);
      
      return successCount === totalCount;
    } catch (error) {
      console.error('❌ 清空专家模型集合失败:', error);
      return false;
    }
  }

  /**
   * 专家模式：在所有集合中删除文档向量
   * @param {string} documentId - 文档ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteDocumentVectorsExpertMode(documentId) {
    try {
      console.log(`🗑️ 专家模式：开始删除文档 ${documentId} 的向量...`);
      
      // 首先检查哪些集合存在
      const existingCollections = [];
      const checkPromises = Object.values(qdrantService.collections).map(async (collectionName) => {
        try {
          const response = await fetch(`http://localhost:6333/collections/${collectionName}`);
          if (response.ok) {
            existingCollections.push(collectionName);
            return { name: collectionName, exists: true };
          } else if (response.status === 404) {
            console.log(`ℹ️ 集合 ${collectionName} 不存在，跳过删除`);
            return { name: collectionName, exists: false };
          } else {
            console.warn(`⚠️ 检查集合 ${collectionName} 失败: ${response.status}`);
            return { name: collectionName, exists: false };
          }
        } catch (error) {
          console.warn(`⚠️ 检查集合 ${collectionName} 时出错:`, error.message);
          return { name: collectionName, exists: false };
        }
      });

      await Promise.all(checkPromises);
      
      if (existingCollections.length === 0) {
        console.log(`ℹ️ 没有找到任何专家模型集合，无需删除向量`);
        return true;
      }

      console.log(`📋 在 ${existingCollections.length} 个存在的集合中删除向量: ${existingCollections.join(', ')}`);
      
      // 只在存在的集合中删除
      const deletePromises = existingCollections.map(async (collectionName) => {
        try {
          console.log(`🔍 在集合 ${collectionName} 中查找文档 ${documentId} 的向量...`);
          
          // 使用scroll API获取所有点，然后过滤
          const scrollRequest = {
            limit: 10000,
            with_payload: true,
            with_vector: false
          };

          const scrollResponse = await fetch(`http://localhost:6333/collections/${collectionName}/points/scroll`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(scrollRequest)
          });

          if (!scrollResponse.ok) {
            console.log(`ℹ️ 集合 ${collectionName} 不存在或为空`);
            return { collection: collectionName, deleted: 0, success: true };
          }

          const scrollData = await scrollResponse.json();
          
          if (!scrollData.result || !scrollData.result.points || scrollData.result.points.length === 0) {
            console.log(`ℹ️ 集合 ${collectionName} 中没有向量数据`);
            return { collection: collectionName, deleted: 0, success: true };
          }

          // 过滤出属于该文档的点
          const targetPoints = scrollData.result.points.filter(point => {
            const p = point.payload || {};
            return p.document_id === documentId;
          });
          
          if (targetPoints.length === 0) {
            console.log(`ℹ️ 文档 ${documentId} 在集合 ${collectionName} 中没有向量数据`);
            return { collection: collectionName, deleted: 0, success: true };
          }

          // 删除找到的点
          const pointIds = targetPoints.map(point => point.id);
          const success = await qdrantService.deletePoints(pointIds, collectionName);
          
          if (success) {
            console.log(`✅ 在集合 ${collectionName} 中删除文档 ${documentId} 的 ${pointIds.length} 个向量`);
            return { collection: collectionName, deleted: pointIds.length, success: true };
          } else {
            console.warn(`⚠️ 在集合 ${collectionName} 中删除文档 ${documentId} 的向量失败`);
            return { collection: collectionName, deleted: 0, success: false };
          }
        } catch (error) {
          console.error(`❌ 在集合 ${collectionName} 中删除文档 ${documentId} 的向量失败:`, error);
          return { collection: collectionName, deleted: 0, success: false };
        }
      });
      
      // 等待所有删除操作完成
      const results = await Promise.all(deletePromises);
      
      // 统计结果
      const totalDeleted = results.reduce((sum, result) => sum + result.deleted, 0);
      const allSuccess = results.every(result => result.success);
      
      console.log(`✅ 专家模式删除完成：共删除 ${totalDeleted} 个向量，成功: ${allSuccess}`);
      
      return allSuccess;
    } catch (error) {
      console.error(`❌ 专家模式删除文档 ${documentId} 的向量失败:`, error);
      return false;
    }
  }

  /**
   * 专家模式：根据语言检测结果存储文档向量到对应集合
   * @param {string} documentId - 文档ID
   * @param {string} content - 文档内容
   * @param {Object} metadata - 文档元数据
   * @returns {Promise<boolean>} 是否成功
   */
  async addDocumentVectorsExpertMode(documentId, content, metadata = {}) {
    try {
      console.log(`🔄 专家模式：开始为文档 ${documentId} 生成向量...`);
      
      // 生成文档嵌入（包含语言检测和模型选择）
      const embeddings = await this.generateDocumentEmbeddingsWithModel(content);
      
      if (!embeddings || embeddings.length === 0) {
        console.warn(`⚠️ 文档 ${documentId} 没有生成任何嵌入`);
        return false;
      }
      
      // 获取第一个嵌入的语言配置（所有块应该使用相同语言）
      const firstEmbedding = embeddings[0];
      const collectionName = firstEmbedding.collection;
      const detectedLanguage = firstEmbedding.detectedLanguage;
      
      console.log(`🎯 文档 ${documentId} 检测语言: ${detectedLanguage}, 目标集合: ${collectionName}`);
      
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
            source_type: metadata.sourceType || 'manual',
            file_name: metadata.fileName || null,
            file_size: metadata.fileSize || null,
            created_at: Date.now(),
            model: embeddingData.model,
            dimensions: embeddingData.dimensions,
            detected_language: detectedLanguage,
            collection: collectionName
          }
        };
      });

      // 存储到对应的专家模型集合
      const success = await qdrantService.upsertPoints(points, collectionName);
      
      if (success) {
        console.log(`✅ 文档 ${documentId} 的 ${points.length} 个向量已存储到集合 ${collectionName}`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ 专家模式为文档 ${documentId} 生成向量失败:`, error);
      return false;
    }
  }

  /**
   * 使用项目内模型生成文档嵌入
   * @param {string} content - 文档内容
   * @returns {Promise<Array>} 嵌入数据数组
   */
  async generateDocumentEmbeddingsWithModel(content) {
    try {
      if (this.expertModelMode) {
        // 专家模型分离模式：根据内容语言自动选择模型
        const config = autoSelectModel(content);
        console.log(`🎯 专家模型分离模式 - 检测语言: ${config.detectedLanguage}, 选择模型: ${config.model}`);
        
        const result = await embeddingService.generateDocumentEmbeddings(content, 500, 50, config.model);
        
        // 为每个嵌入结果添加模型信息
        const enhancedResult = result.map(item => ({
          ...item,
          model: config.model,
          collection: config.collection,
          detectedLanguage: config.detectedLanguage
        }));
        
        console.log(`✅ 专家模型嵌入生成成功: ${enhancedResult.length} 个向量 (${config.model})`);
        return enhancedResult;
      } else {
        // 传统模式：使用固定模型
        console.log(`🎯 传统模式 - 使用模型: ${this.embeddingModel}`);
        const result = await embeddingService.generateDocumentEmbeddings(content, 500, 50, this.embeddingModel);
        
        console.log(`✅ 传统模式嵌入生成成功: ${result.length} 个向量`);
        return result;
      }
    } catch (error) {
      console.error('❌ 文档嵌入生成失败:', error);
      throw error;
    }
  }

  /**
   * 文本分块函数
   * @param {string} text - 文本内容
   * @param {number} chunkSize - 块大小
   * @param {number} overlap - 重叠大小
   * @returns {Array<string>} 文本块数组
   */
  chunkText(text, chunkSize = 500, overlap = 50) {
    if (!text || text.trim().length === 0) {
      return [];
    }
    
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end);
      
      // 尝试在句子边界分割
      if (end < text.length) {
        // 检测多种句子结束符
        const lastPeriod = chunk.lastIndexOf('。');
        const lastDot = chunk.lastIndexOf('.');
        const lastExclamation = chunk.lastIndexOf('！');
        const lastQuestion = chunk.lastIndexOf('？');
        const lastNewline = chunk.lastIndexOf('\n');
        const lastSemicolon = chunk.lastIndexOf('；');
        
        // 找到最合适的分割点
        const splitPoints = [lastPeriod, lastDot, lastExclamation, lastQuestion, lastNewline, lastSemicolon];
        const bestSplitPoint = Math.max(...splitPoints.filter(p => p > chunkSize * 0.3));
        
        if (bestSplitPoint > chunkSize * 0.3) {
          chunk = chunk.slice(0, bestSplitPoint + 1);
          start = start + bestSplitPoint + 1 - overlap;
        } else {
          start = end - overlap;
        }
      } else {
        start = end;
      }
      
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
      
      // 防止无限循环
      if (start <= 0) {
        start = end;
      }
    }
    
    return chunks;
  }

  /**
   * 检查模型可用性 - 现在使用硅基流动API，不再需要本地模型检查
   * @returns {Promise<boolean>} 模型是否可用
   */
  async checkModelAvailability() {
    try {
      // 使用硅基流动API，不再需要本地模型检查
      console.log('🔍 使用硅基流动API，模型可用性检查通过');
      return true;
    } catch (error) {
      console.error('❌ 模型可用性检查失败:', error);
      return false;
    }
  }
}

// 创建全局实例
const knowledgeBaseQdrantInstance = new KnowledgeBaseQdrant();

// 导出所有方法，保持this绑定
export const initialize = (...args) => knowledgeBaseQdrantInstance.initialize(...args);
export const addDocument = (...args) => knowledgeBaseQdrantInstance.addDocument(...args);
export const deleteDocument = (...args) => knowledgeBaseQdrantInstance.deleteDocument(...args);
export const getDocuments = (...args) => knowledgeBaseQdrantInstance.getDocuments(...args);
export const getStoredDocuments = (...args) => knowledgeBaseQdrantInstance.getStoredDocuments(...args);
export const getDocumentsByIds = (...args) => knowledgeBaseQdrantInstance.getDocumentsByIds(...args);
export const search = (...args) => knowledgeBaseQdrantInstance.search(...args);
export const searchSQLite = (...args) => knowledgeBaseQdrantInstance.searchSQLite(...args);
export const addDocumentToSQLite = (...args) => knowledgeBaseQdrantInstance.addDocumentToSQLite(...args);
export const searchDocuments = (...args) => knowledgeBaseQdrantInstance.searchDocuments(...args);
export const generateDocumentEmbeddings = (...args) => knowledgeBaseQdrantInstance.generateDocumentEmbeddings(...args);
export const generateDocumentEmbeddingsWithModel = (...args) => knowledgeBaseQdrantInstance.generateDocumentEmbeddingsWithModel(...args);

// 兼容性导出
export const generateDocumentEmbeddingsWithGemma = generateDocumentEmbeddingsWithModel;
export const setEmbeddingConfig = (...args) => knowledgeBaseQdrantInstance.setEmbeddingConfig(...args);
export const getStatistics = (...args) => knowledgeBaseQdrantInstance.getStatistics(...args);
export const clearAllDocuments = (...args) => knowledgeBaseQdrantInstance.clearAllDocuments(...args);
export const getQdrantInfo = (...args) => knowledgeBaseQdrantInstance.getQdrantInfo(...args);
export const restartQdrant = (...args) => knowledgeBaseQdrantInstance.restartQdrant(...args);
export const checkModelAvailability = (...args) => knowledgeBaseQdrantInstance.checkModelAvailability(...args);

// 导出知识库管理器实例
export const knowledgeBaseManager = knowledgeBaseQdrantInstance;

// 诊断导出
export const diagnoseKnowledgeBase = (...args) => knowledgeBaseQdrantInstance.diagnoseKnowledgeBase(...args);

// 浏览器调试入口（可选）：在开发环境下将诊断方法挂到 window
try {
  if (typeof window !== 'undefined') {
    window.__KB_DIAGNOSE__ = () => knowledgeBaseQdrantInstance.diagnoseKnowledgeBase();
  }
} catch (_e) {
  // no-op
}

export default knowledgeBaseQdrantInstance;

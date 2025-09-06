/**
 * 知识库管理器 - 集成Qdrant向量数据库和SQLite文档存储
 * 使用内置的Qdrant管理器自动处理安装和启动
 */
import Database from '@tauri-apps/plugin-sql';
import qdrantManager from './qdrantManager.js';
import qdrantService from './qdrantService.js';
import embeddingService from './embeddingService.js';

class KnowledgeBaseQdrant {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.useQdrant = false;
    this.qdrantReady = false;
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
      
      // 自动设置Qdrant
      console.log('🚀 自动设置Qdrant...');
      const qdrantSetupSuccess = await qdrantManager.autoSetup();
      
      if (qdrantSetupSuccess) {
        // 初始化Qdrant服务
        const qdrantInitSuccess = await qdrantService.initialize();
        
        if (qdrantInitSuccess) {
          this.useQdrant = true;
          this.qdrantReady = true;
          console.log('✅ 知识库已初始化 (SQLite + Qdrant)');
        } else {
          console.warn('⚠️ Qdrant服务初始化失败，使用SQLite模式');
          this.useQdrant = false;
        }
      } else {
        console.warn('⚠️ Qdrant设置失败，使用SQLite模式');
        this.useQdrant = false;
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ 知识库初始化失败:', error);
      throw error;
    }
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
      // 存储文档到SQLite
      await this.db.execute(`
        INSERT OR REPLACE INTO knowledge_documents
        (id, title, content, file_name, file_size, mime_type, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        document.id,
        document.title,
        document.content,
        document.fileName || null,
        document.fileSize || null,
        document.mimeType || null,
        document.metadata ? JSON.stringify(document.metadata) : null,
        document.createdAt || Date.now(),
        document.updatedAt || Date.now()
      ]);

      console.log(`✅ 文档已添加到SQLite: ${document.id}`);

      // 如果Qdrant可用，也存储向量
      if (this.useQdrant && this.qdrantReady) {
        const success = await qdrantService.addDocumentVectors(
          document.id,
          document.content,
          {
            title: document.title,
            sourceType: document.sourceType || 'manual',
            fileName: document.fileName,
            fileSize: document.fileSize
          }
        );
        
        if (success) {
          console.log(`✅ 文档向量已存储到Qdrant: ${document.id}`);
        } else {
          console.warn(`⚠️ 文档向量存储到Qdrant失败: ${document.id}`);
        }
      }

      return document.id;
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
        return;
      }
      
      console.log(`📄 找到文档: ${existingDoc[0].title}`);
      
      // 从Qdrant删除向量
      if (this.useQdrant && this.qdrantReady) {
        const success = await qdrantService.deleteDocumentVectors(documentId);
        if (success) {
          console.log(`✅ 已从Qdrant删除文档向量: ${documentId}`);
        } else {
          console.warn(`⚠️ 从Qdrant删除文档向量失败: ${documentId}`);
        }
      } else {
        // 从SQLite删除向量
        const vectorResult = await this.db.execute(`
          DELETE FROM knowledge_vectors WHERE document_id = ?
        `, [documentId]);
        console.log(`🗑️ 从SQLite删除向量结果:`, vectorResult);
      }
      
      // 从SQLite删除文档
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
    } catch (error) {
      console.error('❌ 获取文档失败:', error);
      throw error;
    }
  }

  // 搜索文档
  async searchDocuments(query, limit = 10, threshold = 0.3, useHybrid = true) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let results = [];

      if (this.useQdrant && this.qdrantReady) {
        // 使用Qdrant进行向量搜索
        console.log('🔍 使用Qdrant进行向量搜索');
        const qdrantResults = await qdrantService.searchDocuments(query, limit, threshold);
        
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
              score: similarity,
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
        // 降级到SQLite存储
        const embeddings = await embeddingService.generateDocumentEmbeddings(content);
        
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
      
      if (this.useQdrant && this.qdrantReady) {
        // 清空Qdrant集合
        const success = await qdrantService.clearCollection();
        if (success) {
          console.log(`✅ Qdrant集合已清空`);
        } else {
          console.warn(`⚠️ Qdrant集合清空失败`);
        }
      } else {
        // 删除SQLite向量数据
        const vectorResult = await this.db.execute(`DELETE FROM knowledge_vectors`);
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
}

// 创建全局实例
const knowledgeBaseQdrantInstance = new KnowledgeBaseQdrant();

// 导出所有方法，保持this绑定
export const initialize = (...args) => knowledgeBaseQdrantInstance.initialize(...args);
export const addDocument = (...args) => knowledgeBaseQdrantInstance.addDocument(...args);
export const deleteDocument = (...args) => knowledgeBaseQdrantInstance.deleteDocument(...args);
export const getDocuments = (...args) => knowledgeBaseQdrantInstance.getDocuments(...args);
export const searchDocuments = (...args) => knowledgeBaseQdrantInstance.searchDocuments(...args);
export const generateDocumentEmbeddings = (...args) => knowledgeBaseQdrantInstance.generateDocumentEmbeddings(...args);
export const getStatistics = (...args) => knowledgeBaseQdrantInstance.getStatistics(...args);
export const clearAllDocuments = (...args) => knowledgeBaseQdrantInstance.clearAllDocuments(...args);
export const getQdrantInfo = (...args) => knowledgeBaseQdrantInstance.getQdrantInfo(...args);
export const restartQdrant = (...args) => knowledgeBaseQdrantInstance.restartQdrant(...args);

export default knowledgeBaseQdrantInstance;

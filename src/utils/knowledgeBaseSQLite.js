// 知识库SQLite存储实现 - 使用Tauri SQL插件
import Database from '@tauri-apps/plugin-sql';
import embeddingService from './embeddingService.js';

class KnowledgeBaseSQLite {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  // 初始化数据库
  async initialize() {
    try {
      console.log('初始化知识库SQLite数据库...');
      
      // 连接到SQLite数据库
      this.db = await Database.load('sqlite:ai_chat.db');
      
      // 创建知识库表结构
      await this.createTables();
      
      console.log('✅ 知识库SQLite数据库初始化成功');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ 知识库SQLite数据库初始化失败:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  // 创建知识库表结构
  async createTables() {
    try {
      // 创建知识文档表
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

      // 创建知识向量表（使用普通表结构，暂时不使用sqlite-vec扩展）
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_vectors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_text TEXT NOT NULL,
          embedding TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (document_id) REFERENCES knowledge_documents (id) ON DELETE CASCADE
        )
      `);

      // 创建索引
      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_documents_title 
        ON knowledge_documents (title)
      `);

      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at 
        ON knowledge_documents (created_at)
      `);

      await this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_document_id 
        ON knowledge_vectors (document_id)
      `);

      console.log('✅ 知识库表结构创建成功');
    } catch (error) {
      console.error('❌ 创建知识库表结构失败:', error);
      throw error;
    }
  }

  // 添加文档
  async addDocument(document) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.db.execute(`
        INSERT OR REPLACE INTO knowledge_documents 
        (id, title, content, file_name, file_size, mime_type, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        document.id,
        document.title,
        document.content,
        document.file_name || null,
        document.file_size || null,
        document.mime_type || null,
        document.metadata || null,
        document.created_at || Date.now(),
        document.updated_at || Date.now()
      ]);

      console.log(`✅ 文档已添加: ${document.id}`);
      return document.id;
    } catch (error) {
      console.error('❌ 添加文档失败:', error);
      throw error;
    }
  }

  // 添加向量嵌入
  async addVector(vector) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 插入向量到普通表
      const embeddingJson = JSON.stringify(vector.embedding);
      await this.db.execute(`
        INSERT INTO knowledge_vectors 
        (document_id, chunk_index, chunk_text, embedding, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        vector.document_id,
        vector.chunk_index,
        vector.chunk_text,
        embeddingJson,
        vector.created_at || Date.now()
      ]);

      console.log(`✅ 向量已添加: ${vector.document_id}`);
    } catch (error) {
      console.error('❌ 添加向量失败:', error);
      throw error;
    }
  }

  // 搜索知识库（文本搜索）
  async searchDocuments(query, limit = 10) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
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

      return results.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        file_name: result.file_name,
        file_size: result.file_size,
        mime_type: result.mime_type,
        metadata: result.metadata ? JSON.parse(result.metadata) : null,
        created_at: result.created_at,
        updated_at: result.updated_at
      }));
    } catch (error) {
      console.error('❌ 搜索文档失败:', error);
      throw error;
    }
  }

  // 向量搜索（基于余弦相似度）
  async searchVectors(query, limit = 10, threshold = 0.7) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 使用新的嵌入服务生成查询向量
      const queryResult = await embeddingService.generateEmbedding(query);
      const queryEmbedding = queryResult.embedding;
      
      console.log(`🔍 使用${queryResult.model}模型生成查询向量 (${queryResult.dimensions}维)`);
      
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
            results.push({
              id: vector.document_id,
              title: vector.title,
              content: vector.chunk_text,
              full_content: vector.content,
              similarity: similarity,
              chunk_index: vector.chunk_index,
              file_name: vector.file_name,
              file_size: vector.file_size,
              mime_type: vector.mime_type,
              metadata: vector.metadata ? JSON.parse(vector.metadata) : null,
              created_at: vector.created_at
            });
          }
        } catch (error) {
          console.warn('解析向量嵌入失败:', error);
        }
      }

      // 按相似度排序并限制结果数量
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, limit);
    } catch (error) {
      console.error('❌ 向量搜索失败:', error);
      throw error;
    }
  }

  // 计算余弦相似度
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 混合搜索（结合文本搜索和向量搜索）
  async hybridSearch(query, limit = 10, vectorWeight = 0.7, textWeight = 0.3) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 并行执行文本搜索和向量搜索
      const [textResults, vectorResults] = await Promise.all([
        this.searchDocuments(query, limit * 2),
        this.searchVectors(query, limit * 2, 0.3)
      ]);

      // 合并结果并去重
      const resultMap = new Map();
      
      // 添加文本搜索结果
      textResults.forEach(result => {
        const key = result.id;
        if (!resultMap.has(key)) {
          resultMap.set(key, {
            ...result,
            textScore: 1.0,
            vectorScore: 0,
            combinedScore: textWeight
          });
        } else {
          resultMap.get(key).textScore = 1.0;
          resultMap.get(key).combinedScore += textWeight;
        }
      });

      // 添加向量搜索结果
      vectorResults.forEach(result => {
        const key = result.id;
        if (!resultMap.has(key)) {
          resultMap.set(key, {
            ...result,
            textScore: 0,
            vectorScore: result.similarity,
            combinedScore: result.similarity * vectorWeight
          });
        } else {
          const existing = resultMap.get(key);
          existing.vectorScore = result.similarity;
          existing.combinedScore += result.similarity * vectorWeight;
        }
      });

      // 转换为数组并按综合分数排序
      const results = Array.from(resultMap.values())
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('❌ 混合搜索失败:', error);
      throw error;
    }
  }

  // 获取所有文档
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
          // 从metadata中提取额外字段
          sourceType: metadata?.sourceType || 'manual',
          sourceUrl: metadata?.sourceUrl || null
        };
      });
    } catch (error) {
      console.error('❌ 获取文档失败:', error);
      throw error;
    }
  }

  // 删除文档
  async deleteDocument(documentId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🗑️ 开始删除文档和向量: ${documentId}`);
      
      // 先检查文档是否存在
      const existingDoc = await this.db.select(`
        SELECT id, title FROM knowledge_documents WHERE id = ?
      `, [documentId]);
      
      if (existingDoc.length === 0) {
        console.warn(`⚠️ 文档不存在: ${documentId}`);
        return;
      }
      
      console.log(`📄 找到文档: ${existingDoc[0].title}`);
      
      // 删除向量
      const vectorResult = await this.db.execute(`
        DELETE FROM knowledge_vectors WHERE document_id = ?
      `, [documentId]);
      
      console.log(`🗑️ 删除向量结果:`, vectorResult);

      // 删除文档
      const docResult = await this.db.execute(`
        DELETE FROM knowledge_documents WHERE id = ?
      `, [documentId]);
      
      console.log(`🗑️ 删除文档结果:`, docResult);
      console.log(`✅ 文档已删除: ${documentId}`);
    } catch (error) {
      console.error('❌ 删除文档失败:', error);
      throw error;
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
      const vectorCount = await this.db.select(`SELECT COUNT(*) as count FROM knowledge_vectors`);
      
      console.log(`📊 准备删除 ${docCount[0].count} 个文档和 ${vectorCount[0].count} 个向量`);
      
      // 删除所有向量数据
      const vectorResult = await this.db.execute(`DELETE FROM knowledge_vectors`);
      console.log(`🗑️ 删除所有向量结果:`, vectorResult);
      
      // 删除所有文档
      const docResult = await this.db.execute(`DELETE FROM knowledge_documents`);
      console.log(`🗑️ 删除所有文档结果:`, docResult);
      
      console.log('✅ 所有文档和向量已清理完成');
      
      return {
        deletedDocuments: docResult.changes || 0,
        deletedVectors: vectorResult.changes || 0
      };
    } catch (error) {
      console.error('❌ 清理所有文档失败:', error);
      throw error;
    }
  }

  // 获取统计信息
  async getStatistics() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const docCount = await this.db.select(`
        SELECT COUNT(*) as count FROM knowledge_documents
      `);

      const vectorCount = await this.db.select(`
        SELECT COUNT(*) as count FROM knowledge_vectors
      `);

      const totalSize = await this.db.select(`
        SELECT SUM(file_size) as total FROM knowledge_documents WHERE file_size IS NOT NULL
      `);

      // 调试信息
      console.log('📊 统计信息查询结果:', {
        docCount: docCount[0].count,
        vectorCount: vectorCount[0].count,
        totalSize: totalSize[0].total
      });

      return {
        documentCount: docCount[0].count || 0,
        vectorCount: vectorCount[0].count || 0,
        totalSize: totalSize[0].total || 0
      };
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      throw error;
    }
  }

  // 生成简单嵌入（基于TF-IDF和词频的改进版本）
  generateSimpleEmbedding(text) {
    // 预处理文本
    const processedText = text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中英文和数字
      .replace(/\s+/g, ' ')
      .trim();
    
    // 分词（简单的中英文分词）
    const words = this.tokenize(processedText);
    
    // 计算词频
    const wordFreq = {};
    words.forEach(word => {
      if (word.length > 1) { // 过滤单字符
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    // 生成384维向量
    const embedding = new Array(384).fill(0);
    const wordsList = Object.keys(wordFreq);
    
    // 使用多个哈希函数生成向量
    for (let i = 0; i < wordsList.length; i++) {
      const word = wordsList[i];
      const freq = wordFreq[word];
      const hash = this.simpleHash(word);
      
      // 为每个词生成多个维度的贡献
      for (let j = 0; j < 8; j++) {
        const dim = (hash + j * 1000) % 384;
        embedding[dim] += freq * Math.sin(hash + j) * 0.1;
      }
    }
    
    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return embedding.map(val => val / norm);
    }
    
    return embedding;
  }

  // 简单分词器
  tokenize(text) {
    const words = [];
    
    // 英文单词
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    words.push(...englishWords);
    
    // 中文词汇（简单按字符分割，可以后续优化）
    const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
    words.push(...chineseChars);
    
    // 数字
    const numbers = text.match(/\d+/g) || [];
    words.push(...numbers);
    
    return words;
  }

  // 简单哈希函数
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  // 文本分块
  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      
      if (end >= text.length) break;
      start = end - overlap;
    }
    
    return chunks;
  }

  // 为文档生成嵌入
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
      
      // 使用新的嵌入服务生成向量
      const embeddings = await embeddingService.generateDocumentEmbeddings(content);
      
      // 删除旧的向量数据
      await this.db.execute(`
        DELETE FROM knowledge_vectors WHERE document_id = ?
      `, [documentId]);
      
      // 存储新的向量数据
      for (const embeddingData of embeddings) {
        await this.addVector({
          document_id: documentId,
          chunk_index: embeddingData.chunkIndex,
          chunk_text: embeddingData.chunkText,
          embedding: embeddingData.embedding,
          created_at: Date.now()
        });
      }

      console.log(`✅ 文档 ${documentId} 的嵌入已生成，共 ${embeddings.length} 个块 (使用${embeddings[0]?.model || 'unknown'}模型)`);
    } catch (error) {
      console.error('❌ 生成文档嵌入失败:', error);
      throw error;
    }
  }
}

// 创建全局实例
const knowledgeBaseSQLiteInstance = new KnowledgeBaseSQLite();

// 导出实例和方法
export const knowledgeBaseSQLite = knowledgeBaseSQLiteInstance;

// 导出所有方法，保持this绑定
export const initialize = (...args) => knowledgeBaseSQLiteInstance.initialize(...args);
export const addDocument = (...args) => knowledgeBaseSQLiteInstance.addDocument(...args);
export const addVector = (...args) => knowledgeBaseSQLiteInstance.addVector(...args);
export const searchDocuments = (...args) => knowledgeBaseSQLiteInstance.searchDocuments(...args);
export const getDocuments = (...args) => knowledgeBaseSQLiteInstance.getDocuments(...args);
export const deleteDocument = (...args) => knowledgeBaseSQLiteInstance.deleteDocument(...args);
export const clearAllDocuments = (...args) => knowledgeBaseSQLiteInstance.clearAllDocuments(...args);
export const getStatistics = (...args) => knowledgeBaseSQLiteInstance.getStatistics(...args);
export const generateDocumentEmbeddings = (...args) => knowledgeBaseSQLiteInstance.generateDocumentEmbeddings(...args);

export default knowledgeBaseSQLiteInstance;

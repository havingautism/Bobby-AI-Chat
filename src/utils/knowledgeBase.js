import { storageAdapter } from './storageAdapter';

// 知识库管理器
class KnowledgeBaseManager {
  constructor() {
    this.isInitialized = false;
    this.embeddingModel = null;
  }

  // 检查是否在Tauri环境中
  isTauriEnvironment() {
    return storageAdapter.getStorageType() === 'sqlite';
  }

  // 获取SQL插件实例
  async getSQLiteInstance() {
    if (!this.sqliteInstance) {
      const { knowledgeBaseSQLite } = await import('./knowledgeBaseSQLite');
      this.sqliteInstance = knowledgeBaseSQLite;
    }
    return this.sqliteInstance;
  }

  // 等待Tauri IPC初始化
  async waitForTauriIPC() {
    if (!this.isTauriEnvironment()) {
      return false;
    }

    // 等待Tauri IPC可用
    let attempts = 0;
    const maxAttempts = 100; // 最多等待10秒
    
    while (attempts < maxAttempts) {
      try {
        // 检查Tauri IPC是否可用
        if (typeof window !== 'undefined' && 
            (window.__TAURI_IPC__ || window.__TAURI__)) {
          // 尝试导入invoke来验证IPC是否真正可用
          const { invoke } = await import('@tauri-apps/api');
          if (typeof invoke === 'function') {
            // 尝试调用一个简单的命令来验证IPC真正工作
            try {
              await invoke('ensure_data_directory');
              console.log('Tauri IPC已就绪');
              return true;
            } catch (error) {
              // 如果命令调用失败，继续等待
              console.log('Tauri IPC命令调用失败，继续等待...', error.message);
            }
          }
        }
        
        // 等待100ms后重试
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      } catch (error) {
        // 如果导入失败，继续等待
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
    
    console.warn('等待Tauri IPC超时');
    return false;
  }

  // 安全调用Tauri命令
  async safeInvoke(command, args = {}) {
    if (!this.isTauriEnvironment()) {
      throw new Error('不在Tauri环境中');
    }

    // 等待IPC就绪
    const ipcReady = await this.waitForTauriIPC();
    if (!ipcReady) {
      throw new Error('Tauri IPC未就绪');
    }

    // 导入并调用invoke
    const { invoke } = await import('@tauri-apps/api');
    return await invoke(command, args);
  }

  // 初始化知识库
  async initialize() {
    try {
      if (this.isTauriEnvironment()) {
        // 在Tauri环境中，使用SQL插件初始化知识库
        const sqlite = await this.getSQLiteInstance();
        await sqlite.initialize();
        this.isInitialized = true;
        console.log('知识库管理器已初始化（Tauri SQLite模式）');
      } else if (storageAdapter.getStorageType() === 'sqlite') {
        // 确保SQLite数据库已初始化
        await storageAdapter.loadChatHistory(); // 这会触发SQLite初始化
        this.isInitialized = true;
        console.log('知识库管理器已初始化（Web SQLite模式）');
      } else {
        console.log('知识库管理器已初始化（IndexedDB模式，向量搜索不可用）');
        this.isInitialized = true;
      }
    } catch (error) {
      console.error('知识库管理器初始化失败:', error);
      throw error;
    }
  }

  // 添加文档到知识库
  async addDocument(document) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const docId = document.id || this.generateDocumentId();

      const docData = {
        id: docId,
        title: document.title,
        content: document.content,
        sourceType: document.sourceType || 'text',
        sourceUrl: document.sourceUrl || null,
        filePath: document.filePath || null,
        fileSize: document.fileSize || null,
        mimeType: document.mimeType || null,
        metadata: document.metadata || {}
      };

      if (storageAdapter.getStorageType() === 'sqlite') {
        // 使用SQLite存储
        await this.addDocumentToSQLite(docData);
        
        // 自动生成向量嵌入
        if (this.isTauriEnvironment() && document.content.length > 100) {
          try {
            const sqlite = await this.getSQLiteInstance();
            await sqlite.generateDocumentEmbeddings(docId);
            console.log(`文档 ${docId} 的向量嵌入已生成`);
          } catch (error) {
            console.warn('生成向量嵌入失败:', error);
            // 不抛出错误，因为这是可选功能
          }
        }
      } else {
        // 使用IndexedDB存储（简化版本）
        await this.addDocumentToIndexedDB(docData);
      }

      console.log(`文档已添加到知识库: ${docId}`);
      return docId;
    } catch (error) {
      console.error('添加文档到知识库失败:', error);
      throw error;
    }
  }

  // 添加文档到SQLite
  async addDocumentToSQLite(docData) {
    try {
      if (this.isTauriEnvironment()) {
        // 在Tauri环境中，调用Rust命令
        const document = {
          id: docData.id,
          title: docData.title,
          content: docData.content,
          source_type: docData.sourceType,
          source_url: docData.sourceUrl,
          file_path: docData.filePath,
          file_size: docData.fileSize,
          mime_type: docData.mimeType,
          metadata: JSON.stringify(docData.metadata),
          created_at: Date.now(),
          updated_at: Date.now()
        };
        
        const sqlite = await this.getSQLiteInstance();
        const docId = await sqlite.addDocument(document);
        return docId;
      } else {
        // 在Web环境中，使用现有的SQLite存储
        const { sqliteStorage } = await import('./sqliteStorage');
        const docId = await sqliteStorage.addKnowledgeDocument(docData);
        return docId;
      }
    } catch (error) {
      console.error('添加文档到SQLite失败:', error);
      throw error;
    }
  }

  // 添加文档到IndexedDB
  async addDocumentToIndexedDB(docData) {
    try {
      const documents = await this.getStoredDocuments();
      documents.push(docData);
      await storageAdapter.saveSetting('knowledge-documents', documents);
    } catch (error) {
      console.error('添加文档到IndexedDB失败:', error);
      throw error;
    }
  }

  // 分块并嵌入文档
  async chunkAndEmbedDocument(docData) {
    try {
      const chunks = this.chunkText(docData.content, 500, 100);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk);
        
        // 存储向量数据到SQLite
        await this.storeVectorEmbedding({
          vectorId: `${docData.id}_chunk_${i}`,
          documentId: docData.id,
          chunkIndex: i,
          chunkText: chunk,
          embedding: embedding
        });
      }
      
      console.log(`文档已分块并嵌入: ${docData.id}, ${chunks.length} 个块`);
    } catch (error) {
      console.error('分块并嵌入文档失败:', error);
      // 不抛出错误，因为这是可选功能
    }
  }

  // 文本分块
  chunkText(text, chunkSize = 500, overlap = 100) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end);
      
      // 尝试在句子边界分割
      if (end < text.length) {
        const lastSentenceEnd = chunk.lastIndexOf('。');
        const lastNewline = chunk.lastIndexOf('\n');
        const splitPoint = Math.max(lastSentenceEnd, lastNewline);
        
        if (splitPoint > start + chunkSize * 0.5) {
          chunk = chunk.slice(0, splitPoint + 1);
          start = start + splitPoint + 1 - overlap;
        } else {
          start = end - overlap;
        }
      } else {
        start = end;
      }
      
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
    }
    
    return chunks;
  }

  // 生成文本嵌入（简化版本，实际应该调用嵌入API）
  async generateEmbedding(text) {
    try {
      // 这里应该调用实际的嵌入API
      // 为了演示，我们使用简单的哈希作为嵌入
      const hash = await this.simpleHash(text);
      return new Array(384).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
    } catch (error) {
      console.error('生成嵌入失败:', error);
      return new Array(384).fill(0);
    }
  }

  // 简单哈希函数
  async simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  // 存储向量嵌入
  async storeVectorEmbedding(vectorData) {
    try {
      if (this.isTauriEnvironment()) {
        // 在Tauri环境中，调用Rust命令
        const vector = {
          vector_id: vectorData.vectorId,
          document_id: vectorData.documentId,
          chunk_index: vectorData.chunkIndex,
          chunk_text: vectorData.chunkText,
          embedding: vectorData.embedding,
          created_at: Date.now()
        };
        
        const sqlite = await this.getSQLiteInstance();
        await sqlite.addVector(vector);
      } else if (storageAdapter.getStorageType() === 'sqlite') {
        const { sqliteStorage } = await import('./sqliteStorage');
        await sqliteStorage.execute(`
          INSERT INTO knowledge_vectors 
          (vector_id, document_id, chunk_index, chunk_text, embedding, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          vectorData.vectorId,
          vectorData.documentId,
          vectorData.chunkIndex,
          vectorData.chunkText,
          JSON.stringify(vectorData.embedding),
          Date.now()
        ]);
      }
    } catch (error) {
      console.error('存储向量嵌入失败:', error);
      throw error;
    }
  }

  // 搜索知识库
  async search(query, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const {
        limit = 10,
        threshold = 0.7,
        includeContent = true
      } = options;

      if (storageAdapter.getStorageType() === 'sqlite') {
        return await this.searchSQLite(query, limit, threshold, includeContent);
      } else {
        return await this.searchIndexedDB(query, limit, includeContent);
      }
    } catch (error) {
      console.error('搜索知识库失败:', error);
      return [];
    }
  }

  // SQLite向量搜索
  async searchSQLite(query, limit, threshold, includeContent) {
    try {
      if (this.isTauriEnvironment()) {
        // 在Tauri环境中，使用SQL插件进行搜索
        const sqlite = await this.getSQLiteInstance();
        
        // 使用混合搜索（结合文本搜索和向量搜索）
        let results;
        try {
          results = await sqlite.hybridSearch(query, limit, 0.7, 0.3);
        } catch (error) {
          console.warn('混合搜索失败，使用文本搜索:', error);
          results = await sqlite.searchDocuments(query, limit);
        }
        
        return results.map(result => ({
          id: result.id,
          title: result.title,
          content: includeContent ? (result.content || result.full_content) : null,
          score: result.combinedScore || result.similarity || 1.0, // 使用综合分数或相似度
          chunkIndex: result.chunk_index || 0,
          sourceType: 'document',
          sourceUrl: null
        }));
      } else {
        // 生成查询嵌入
        const queryEmbedding = await this.generateEmbedding(query);
        
        // 执行向量搜索（这里需要sqlite-vec扩展支持）
        const results = await this.vectorSearch(queryEmbedding, limit, threshold);
        
        return results.map(result => ({
          id: result.document_id,
          title: result.title,
          content: includeContent ? result.chunk_text : null,
          score: result.similarity,
          chunkIndex: result.chunk_index,
          sourceType: result.source_type,
          sourceUrl: result.source_url
        }));
      }
    } catch (error) {
      console.error('SQLite向量搜索失败:', error);
      // 回退到文本搜索
      return await this.textSearchSQLite(query, limit, includeContent);
    }
  }

  // 向量搜索（简化版本，不使用sqlite-vec扩展）
  async vectorSearch(queryEmbedding, limit, threshold) {
    try {
      const { sqliteStorage } = await import('./sqliteStorage');
      
      // 获取所有向量数据
      const allVectors = await sqliteStorage.query(`
        SELECT 
          kv.document_id,
          kd.title,
          kd.source_type,
          kd.source_url,
          kv.chunk_text,
          kv.chunk_index,
          kv.embedding
        FROM knowledge_vectors kv
        JOIN knowledge_documents kd ON kv.document_id = kd.id
        ORDER BY kv.created_at DESC
        LIMIT ?
      `, [limit * 3]); // 获取更多结果用于相似度计算

      // 计算相似度并排序
      const scoredResults = allVectors.map(result => {
        try {
          const embedding = JSON.parse(result.embedding || '[]');
          const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding);
          return {
            ...result,
            similarity
          };
        } catch (error) {
          return {
            ...result,
            similarity: 0
          };
        }
      }).filter(result => result.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return scoredResults;
    } catch (error) {
      console.error('向量搜索失败，回退到文本搜索:', error);
      // 回退到文本搜索
      return await this.textSearchSQLite(queryEmbedding.join(' '), limit, true);
    }
  }

  // 计算余弦相似度
  calculateCosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // 文本搜索（SQLite）
  async textSearchSQLite(query, limit, includeContent) {
    try {
      const { sqliteStorage } = await import('./sqliteStorage');
      return await sqliteStorage.searchKnowledge(query, limit);
    } catch (error) {
      console.error('SQLite文本搜索失败:', error);
      return [];
    }
  }

  // IndexedDB搜索
  async searchIndexedDB(query, limit, includeContent) {
    try {
      const documents = await this.getStoredDocuments();
      const results = documents.filter(doc => 
        doc.title.toLowerCase().includes(query.toLowerCase()) ||
        doc.content.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      return results.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: includeContent ? doc.content : null,
        score: 1.0, // 简化版本，所有结果都是完全匹配
        sourceType: doc.sourceType,
        sourceUrl: doc.sourceUrl
      }));
    } catch (error) {
      console.error('IndexedDB搜索失败:', error);
      return [];
    }
  }

  // 获取存储的文档
  async getStoredDocuments() {
    try {
      if (this.isTauriEnvironment()) {
        // 在Tauri环境中，使用SQL插件获取文档
        const sqlite = await this.getSQLiteInstance();
        const results = await sqlite.getDocuments();
        return results;
      } else if (storageAdapter.getStorageType() === 'sqlite') {
        const { sqliteStorage } = await import('./sqliteStorage');
        const results = await sqliteStorage.query(`
          SELECT * FROM knowledge_documents 
          ORDER BY updated_at DESC
        `);
        return results;
      } else {
        return await storageAdapter.loadSetting('knowledge-documents', []);
      }
    } catch (error) {
      console.error('获取存储文档失败:', error);
      return [];
    }
  }

  // 删除文档
  async deleteDocument(documentId) {
    try {
      if (this.isTauriEnvironment()) {
        // 在Tauri环境中，使用SQL插件删除文档
        const sqlite = await this.getSQLiteInstance();
        await sqlite.deleteDocument(documentId);
      } else if (storageAdapter.getStorageType() === 'sqlite') {
        const { sqliteStorage } = await import('./sqliteStorage');
        await sqliteStorage.execute(
          'DELETE FROM knowledge_documents WHERE id = ?',
          [documentId]
        );
        await sqliteStorage.execute(
          'DELETE FROM knowledge_vectors WHERE document_id = ?',
          [documentId]
        );
      } else {
        const documents = await this.getStoredDocuments();
        const filtered = documents.filter(doc => doc.id !== documentId);
        await storageAdapter.saveSetting('knowledge-documents', filtered);
      }
      
      console.log(`文档已删除: ${documentId}`);
    } catch (error) {
      console.error('删除文档失败:', error);
      throw error;
    }
  }

  // 清理所有文档
  async clearAllDocuments() {
    try {
      if (this.isTauriEnvironment()) {
        const sqlite = await this.getSQLiteInstance();
        const result = await sqlite.clearAllDocuments();
        console.log('所有文档已清理:', result);
        return result;
      } else if (storageAdapter.getStorageType() === 'sqlite') {
        const { sqliteStorage } = await import('./sqliteStorage');
        await sqliteStorage.execute(`DELETE FROM knowledge_vectors`);
        const docResult = await sqliteStorage.execute(`DELETE FROM knowledge_documents`);
        console.log('所有文档已清理');
        return {
          deletedDocuments: docResult.changes || 0,
          deletedVectors: 0
        };
      } else {
        await storageAdapter.saveSetting('knowledge-documents', []);
        console.log('所有文档已清理');
        return {
          deletedDocuments: 0,
          deletedVectors: 0
        };
      }
    } catch (error) {
      console.error('清理所有文档失败:', error);
      throw error;
    }
  }

  // 为文档生成向量嵌入
  async generateDocumentEmbeddings(documentId) {
    try {
      if (this.isTauriEnvironment()) {
        const sqlite = await this.getSQLiteInstance();
        await sqlite.generateDocumentEmbeddings(documentId);
        console.log(`文档 ${documentId} 的向量嵌入已生成`);
      } else {
        console.warn('向量嵌入生成仅在Tauri环境中支持');
      }
    } catch (error) {
      console.error('生成文档向量嵌入失败:', error);
      throw error;
    }
  }

  // 获取知识库统计信息
  async getStatistics() {
    try {
      if (this.isTauriEnvironment()) {
        // 在Tauri环境中，使用SQL插件获取统计信息
        const sqlite = await this.getSQLiteInstance();
        const stats = await sqlite.getStatistics();
        return {
          documentCount: stats.documentCount || 0,
          vectorCount: stats.vectorCount || 0,
          totalSize: stats.totalSize || 0
        };
      } else if (storageAdapter.getStorageType() === 'sqlite') {
        const { sqliteStorage } = await import('./sqliteStorage');
        const stats = await sqliteStorage.query(`
          SELECT 
            (SELECT COUNT(*) FROM knowledge_documents) as document_count,
            (SELECT COUNT(*) FROM knowledge_vectors) as vector_count,
            (SELECT SUM(file_size) FROM knowledge_documents WHERE file_size IS NOT NULL) as total_size
        `);
        
        return {
          documentCount: stats[0].document_count || 0,
          vectorCount: stats[0].vector_count || 0,
          totalSize: stats[0].total_size || 0
        };
      } else {
        const documents = await this.getStoredDocuments();
        const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
        
        return {
          documentCount: documents.length,
          vectorCount: 0, // IndexedDB模式不支持向量
          totalSize
        };
      }
    } catch (error) {
      console.error('获取知识库统计信息失败:', error);
      return {
        documentCount: 0,
        vectorCount: 0,
        totalSize: 0
      };
    }
  }

  // 生成文档ID
  generateDocumentId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 创建全局实例
export const knowledgeBaseManager = new KnowledgeBaseManager();

// 导出管理器实例
export default knowledgeBaseManager;

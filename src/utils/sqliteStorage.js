import { invoke } from '@tauri-apps/api';
// import { BaseDirectory, join } from '@tauri-apps/api/path';

// 数据库配置
const DB_NAME = 'ai_chat.db';
// const DB_VERSION = 1;

// 检查是否在Tauri环境中 - 使用CSDN文章的方法
const isTauriEnv = () => {
  return Boolean(
    typeof window !== 'undefined' &&
      window !== undefined &&
      window.__TAURI_IPC__ !== undefined
  );
};

// 获取数据库路径
const getDbPath = async () => {
  try {
    if (!isTauriEnv()) {
      throw new Error('Not in Tauri environment');
    }
    
    // 直接使用相对路径，与后端保持一致
    return `./data/${DB_NAME}`;
  } catch (error) {
    console.error('获取数据库路径失败:', error);
    // 如果获取路径失败，使用相对路径
    return `./data/${DB_NAME}`;
  }
};

// 数据库初始化SQL
const INIT_SQL = `
-- 对话表
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0,
    last_message_preview TEXT,
    metadata TEXT -- JSON格式的额外数据
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    has_reasoning BOOLEAN DEFAULT FALSE,
    reasoning TEXT,
    uploaded_file_info TEXT, -- JSON格式的文件信息
    token_count INTEGER DEFAULT 0,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    description TEXT
);

-- API会话历史表
CREATE TABLE IF NOT EXISTS api_sessions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration INTEGER DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    user_agent TEXT,
    platform TEXT,
    tauri_version TEXT,
    options TEXT, -- JSON格式的选项
    created_at INTEGER NOT NULL
);

-- API请求记录表
CREATE TABLE IF NOT EXISTS api_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('request', 'response', 'error')),
    timestamp INTEGER NOT NULL,
    content_length INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    metadata TEXT, -- JSON格式的额外数据
    FOREIGN KEY (session_id) REFERENCES api_sessions(id) ON DELETE CASCADE
);

-- 知识库文档表
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'text', 'conversation')),
    source_url TEXT,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT -- JSON格式的元数据
);

-- 知识库向量表 (暂时使用普通表，后续可升级为vec0虚拟表)
CREATE TABLE IF NOT EXISTS knowledge_vectors (
    vector_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding TEXT, -- 存储向量嵌入的JSON字符串
    similarity_score REAL DEFAULT 0.0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_sessions_conversation_id ON api_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_api_sessions_start_time ON api_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_api_requests_session_id ON api_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_document_id ON knowledge_vectors(document_id);

-- 创建触发器：自动更新对话的更新时间
CREATE TRIGGER IF NOT EXISTS update_conversation_updated_at
    AFTER INSERT ON messages
BEGIN
    UPDATE conversations 
    SET updated_at = NEW.timestamp,
        message_count = (SELECT COUNT(*) FROM messages WHERE conversation_id = NEW.conversation_id),
        last_message_preview = substr(NEW.content, 1, 100)
    WHERE id = NEW.conversation_id;
END;

-- 创建触发器：删除对话时清理相关数据
CREATE TRIGGER IF NOT EXISTS cleanup_conversation_data
    AFTER DELETE ON conversations
BEGIN
    DELETE FROM messages WHERE conversation_id = OLD.id;
    DELETE FROM api_sessions WHERE conversation_id = OLD.id;
END;
`;

// SQLite存储类
class SQLiteStorage {
  constructor() {
    this.dbPath = null;
    this.isInitialized = false;
  }

  // 初始化数据库
  async initialize() {
    try {
      if (!isTauriEnv()) {
        throw new Error('SQLite storage requires Tauri environment');
      }
      
      console.log('Tauri环境检测成功，开始初始化SQLite');
      
      this.dbPath = await getDbPath();
      console.log('数据库路径:', this.dbPath);
      
      // 确保数据目录存在
      await invoke('ensure_data_directory');
      console.log('数据目录确保成功');
      
      // 初始化数据库
      await invoke('init_sqlite_db', { 
        dbPath: this.dbPath,
        initSql: INIT_SQL 
      });
      
      this.isInitialized = true;
      console.log('SQLite数据库初始化成功:', this.dbPath);
    } catch (error) {
      console.error('SQLite数据库初始化失败:', error);
      throw error;
    }
  }

  // 执行SQL查询
  async query(sql, params = []) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      return await invoke('sqlite_query', {
        dbPath: this.dbPath,
        sql,
        params
      });
    } catch (error) {
      console.error('SQL查询失败:', error);
      throw error;
    }
  }

  // 执行SQL更新
  async execute(sql, params = []) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      return await invoke('sqlite_execute', {
        dbPath: this.dbPath,
        sql,
        params
      });
    } catch (error) {
      console.error('SQL执行失败:', error);
      throw error;
    }
  }

  // 事务执行
  async transaction(operations) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      return await invoke('sqlite_transaction', {
        dbPath: this.dbPath,
        operations
      });
    } catch (error) {
      console.error('SQL事务执行失败:', error);
      throw error;
    }
  }

  // 对话相关操作
  async loadChatHistory() {
    try {
      const conversations = await this.query(`
        SELECT 
          c.*,
          COUNT(m.id) as message_count,
          MAX(m.timestamp) as last_message_time
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY c.id
        ORDER BY c.updated_at DESC
      `);

      // 为每个对话加载消息并解析metadata
      for (const conv of conversations) {
        conv.messages = await this.query(`
          SELECT * FROM messages 
          WHERE conversation_id = ? 
          ORDER BY timestamp ASC
        `, [conv.id]);

        // 解析metadata字段，恢复role、model、responseMode等信息
        if (conv.metadata) {
          try {
            const metadata = JSON.parse(conv.metadata);
            conv.role = metadata.role;
            conv.model = metadata.model;
            conv.responseMode = metadata.responseMode;
            // 保留其他metadata字段
            conv.metadata = metadata;
          } catch (error) {
            console.warn('解析对话metadata失败:', error);
            conv.metadata = {};
          }
        }
      }

      return conversations;
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      return [];
    }
  }

  async saveConversation(conversation) {
    try {
      const now = Date.now();
      
      await this.transaction([
        {
          sql: `INSERT OR REPLACE INTO conversations 
                (id, title, created_at, updated_at, metadata) 
                VALUES (?, ?, ?, ?, ?)`,
          params: [
            conversation.id,
            conversation.title,
            conversation.createdAt || now,
            now,
            JSON.stringify(conversation.metadata || {})
          ]
        },
        {
          sql: `DELETE FROM messages WHERE conversation_id = ?`,
          params: [conversation.id]
        }
      ]);

      // 插入消息
      if (conversation.messages && conversation.messages.length > 0) {
        const messageInserts = conversation.messages.map(msg => ({
          sql: `INSERT OR REPLACE INTO messages 
                (id, conversation_id, role, content, timestamp, has_reasoning, reasoning, uploaded_file_info, token_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            msg.id,
            conversation.id,
            msg.role,
            msg.content,
            msg.timestamp,
            msg.hasReasoning || false,
            msg.reasoning || null,
            msg.uploadedFile ? JSON.stringify(msg.uploadedFile) : null,
            msg.tokenCount || 0
          ]
        }));

        await this.transaction(messageInserts);
      }

      console.log(`对话已保存: ${conversation.id}`);
    } catch (error) {
      console.error('保存对话失败:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId) {
    try {
      await this.execute(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
      console.log(`对话已删除: ${conversationId}`);
    } catch (error) {
      console.error('删除对话失败:', error);
      throw error;
    }
  }

  async clearChatHistory() {
    try {
      await this.transaction([
        { sql: 'DELETE FROM messages', params: [] },
        { sql: 'DELETE FROM conversations', params: [] }
      ]);
      console.log('所有聊天历史已清除');
    } catch (error) {
      console.error('清除聊天历史失败:', error);
      throw error;
    }
  }

  // 设置相关操作
  async saveSetting(key, value) {
    try {
      await this.execute(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
      `, [key, JSON.stringify(value), Date.now()]);
    } catch (error) {
      console.error('保存设置失败:', error);
      throw error;
    }
  }

  async loadSetting(key, defaultValue = null) {
    try {
      const result = await this.query(
        'SELECT value FROM settings WHERE key = ?',
        [key]
      );
      
      if (result.length > 0) {
        return JSON.parse(result[0].value);
      }
      return defaultValue;
    } catch (error) {
      console.error('加载设置失败:', error);
      return defaultValue;
    }
  }

  // API会话相关操作
  async saveApiSessions(sessions) {
    try {
      await this.transaction([
        { sql: 'DELETE FROM api_sessions', params: [] },
        { sql: 'DELETE FROM api_requests', params: [] }
      ]);

      if (sessions.length > 0) {
        const sessionInserts = sessions.map(session => ({
          sql: `INSERT INTO api_sessions 
                (id, conversation_id, model, provider, start_time, end_time, duration, 
                 request_count, token_count, status, user_agent, platform, tauri_version, options, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            session.id,
            session.conversationId,
            session.model,
            session.provider,
            session.startTime,
            session.endTime,
            session.duration,
            session.requestCount,
            session.tokenCount,
            session.status,
            session.userAgent,
            session.platform,
            session.tauriVersion,
            JSON.stringify(session.options || {}),
            session.startTime
          ]
        }));

        await this.transaction(sessionInserts);

        // 保存请求记录
        const requestInserts = [];
        for (const session of sessions) {
          if (session.messages) {
            for (const msg of session.messages) {
              requestInserts.push({
                sql: `INSERT INTO api_requests 
                      (id, session_id, request_type, timestamp, content_length, token_count, 
                       duration, success, error_message, metadata)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                params: [
                  msg.id,
                  session.id,
                  msg.type,
                  msg.timestamp,
                  msg.contentLength || 0,
                  msg.tokenCount || 0,
                  msg.duration || 0,
                  msg.success !== false,
                  msg.error || null,
                  JSON.stringify(msg.metadata || {})
                ]
              });
            }
          }
        }

        if (requestInserts.length > 0) {
          await this.transaction(requestInserts);
        }
      }

      console.log(`已保存 ${sessions.length} 个API会话记录`);
    } catch (error) {
      console.error('保存API会话失败:', error);
      throw error;
    }
  }

  async loadApiSessions() {
    try {
      const sessions = await this.query(`
        SELECT * FROM api_sessions 
        ORDER BY start_time DESC
      `);

      // 为每个会话加载请求记录
      for (const session of sessions) {
        session.messages = await this.query(`
          SELECT * FROM api_requests 
          WHERE session_id = ? 
          ORDER BY timestamp ASC
        `, [session.id]);
        
        session.options = JSON.parse(session.options || '{}');
      }

      return sessions;
    } catch (error) {
      console.error('加载API会话失败:', error);
      return [];
    }
  }

  // 知识库相关操作
  async addKnowledgeDocument(document) {
    try {
      const now = Date.now();
      await this.execute(`
        INSERT INTO knowledge_documents 
        (id, title, content, source_type, source_url, file_path, file_size, mime_type, created_at, updated_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        document.id,
        document.title,
        document.content,
        document.sourceType,
        document.sourceUrl || null,
        document.filePath || null,
        document.fileSize || null,
        document.mimeType || null,
        now,
        now,
        JSON.stringify(document.metadata || {})
      ]);

      console.log(`知识库文档已添加: ${document.id}`);
    } catch (error) {
      console.error('添加知识库文档失败:', error);
      throw error;
    }
  }

  async searchKnowledge(query, limit = 10) {
    try {
      // 这里需要实现向量搜索，暂时使用文本搜索
      const results = await this.query(`
        SELECT kd.*, kv.chunk_text, kv.chunk_index
        FROM knowledge_documents kd
        JOIN knowledge_vectors kv ON kd.id = kv.document_id
        WHERE kv.chunk_text LIKE ? OR kd.title LIKE ? OR kd.content LIKE ?
        ORDER BY kd.updated_at DESC
        LIMIT ?
      `, [`%${query}%`, `%${query}%`, `%${query}%`, limit]);

      return results;
    } catch (error) {
      console.error('知识库搜索失败:', error);
      return [];
    }
  }

  // 获取存储信息
  async getStorageInfo() {
    try {
      // 确保数据库已初始化
      if (!this.isInitialized) {
        await this.initialize();
      }

      const stats = await this.query(`
        SELECT 
          (SELECT COUNT(*) FROM conversations) as conversation_count,
          (SELECT COUNT(*) FROM messages) as message_count,
          (SELECT COUNT(*) FROM api_sessions) as api_session_count,
          (SELECT COUNT(*) FROM knowledge_documents) as knowledge_document_count,
          (SELECT COUNT(*) FROM settings) as setting_count
      `);

      let dbSize = 0;
      try {
        dbSize = await invoke('get_file_size', { filePath: this.dbPath });
      } catch (sizeError) {
        console.warn('获取数据库文件大小失败:', sizeError);
        dbSize = 0;
      }

      return {
        dbPath: this.dbPath,
        dbSize: dbSize > 0 ? `${(dbSize / (1024 * 1024)).toFixed(2)} MB` : '未知',
        conversationCount: stats[0]?.conversation_count || 0,
        messageCount: stats[0]?.message_count || 0,
        apiSessionCount: stats[0]?.api_session_count || 0,
        knowledgeDocumentCount: stats[0]?.knowledge_document_count || 0,
        settingCount: stats[0]?.setting_count || 0
      };
    } catch (error) {
      console.error('获取存储信息失败:', error);
      return {
        dbPath: this.dbPath || '未初始化',
        dbSize: '未知',
        conversationCount: 0,
        messageCount: 0,
        apiSessionCount: 0,
        knowledgeDocumentCount: 0,
        settingCount: 0,
        error: error.message
      };
    }
  }

  // 数据迁移
  async migrateFromJson(jsonData) {
    try {
      if (jsonData.conversations && jsonData.conversations.length > 0) {
        for (const conversation of jsonData.conversations) {
          await this.saveConversation(conversation);
        }
        console.log(`已迁移 ${jsonData.conversations.length} 个对话到SQLite`);
      }

      if (jsonData.settings) {
        for (const [key, value] of Object.entries(jsonData.settings)) {
          await this.saveSetting(key, value);
        }
        console.log(`已迁移 ${Object.keys(jsonData.settings).length} 个设置到SQLite`);
      }

      if (jsonData.apiSessions && jsonData.apiSessions.length > 0) {
        await this.saveApiSessions(jsonData.apiSessions);
        console.log(`已迁移 ${jsonData.apiSessions.length} 个API会话到SQLite`);
      }

      return true;
    } catch (error) {
      console.error('数据迁移失败:', error);
      return false;
    }
  }
}

// 创建全局实例
export const sqliteStorage = new SQLiteStorage();

// 导出所有函数，保持与原始storage.js的API兼容
// 使用bind确保this上下文正确，只导出存在的方法
export const loadChatHistory = sqliteStorage.loadChatHistory.bind(sqliteStorage);
export const saveConversation = sqliteStorage.saveConversation.bind(sqliteStorage);
export const deleteConversation = sqliteStorage.deleteConversation.bind(sqliteStorage);
export const clearChatHistory = sqliteStorage.clearChatHistory.bind(sqliteStorage);
export const saveSetting = sqliteStorage.saveSetting.bind(sqliteStorage);
export const loadSetting = sqliteStorage.loadSetting.bind(sqliteStorage);
export const getStorageInfo = sqliteStorage.getStorageInfo.bind(sqliteStorage);
export const saveApiSessions = sqliteStorage.saveApiSessions.bind(sqliteStorage);
export const loadApiSessions = sqliteStorage.loadApiSessions.bind(sqliteStorage);
export const initialize = sqliteStorage.initialize.bind(sqliteStorage);
export const migrateFromJson = sqliteStorage.migrateFromJson.bind(sqliteStorage);

// 添加缺失的saveChatHistory方法
export const saveChatHistory = async (conversations) => {
  const storage = sqliteStorage;
  for (const conversation of conversations) {
    await storage.saveConversation(conversation);
  }
};

export default sqliteStorage;

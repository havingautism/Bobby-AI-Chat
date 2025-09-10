// 真正的SQLite存储实现 - 使用Tauri SQL插件
import Database from '@tauri-apps/plugin-sql';

class SimpleSQLiteStorage {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  // 初始化数据库
  async initialize() {
    try {
      console.log('初始化SQLite数据库...');
      
      // 使用用户数据目录，避免重新构建时数据丢失
      const dbPath = await this.getDbPath();
      console.log('数据库路径:', dbPath);
      
      // 连接到SQLite数据库
      this.db = await Database.load(dbPath);
      
      // 创建表结构
      await this.createTables();
      
      console.log('✅ SQLite数据库初始化成功');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ SQLite数据库初始化失败:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  // 获取数据库路径
  async getDbPath() {
    try {
      // 检查是否在Tauri环境
      if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
        // 使用Tauri API获取用户数据目录
        const { appDataDir } = await import('@tauri-apps/api/path');
        
        const dataDir = await appDataDir();
        const dbPath = `${dataDir}ai_chat.db`;
        console.log('使用Tauri用户数据目录:', dbPath);
        return `sqlite:${dbPath}`;
      } else {
        // 非Tauri环境，使用相对路径
        console.log('非Tauri环境，使用相对路径');
        return 'sqlite:ai_chat.db';
      }
    } catch (error) {
      console.warn('获取用户数据目录失败，使用相对路径:', error);
      return 'sqlite:ai_chat.db';
    }
  }

  // 创建表结构
  async createTables() {
    try {
      // 创建对话表
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          messages TEXT NOT NULL,
          last_updated INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          metadata TEXT
        )
      `);

      // 检查并添加metadata字段（向后兼容）
      await this.migrateAddMetadataField();

      // 创建设置表
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      
      console.log('数据库表结构创建完成');
    } catch (error) {
      console.error('创建数据库表失败:', error);
      throw error;
    }
  }

  // 迁移：添加metadata字段
  async migrateAddMetadataField() {
    try {
      // 检查metadata字段是否存在
      const result = await this.db.select("PRAGMA table_info(conversations)");
      const hasMetadata = result.some(column => column.name === 'metadata');
      
      if (!hasMetadata) {
        console.log('添加metadata字段到conversations表...');
        await this.db.execute('ALTER TABLE conversations ADD COLUMN metadata TEXT');
        console.log('✅ metadata字段添加成功');
      }
    } catch (error) {
      console.error('添加metadata字段失败:', error);
    }
  }

  // 加载聊天历史
  async loadChatHistory() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.db.select('SELECT * FROM conversations ORDER BY last_updated DESC');
      const conversations = result.map(row => {
        const conversation = {
          id: row.id,
          title: row.title,
          messages: JSON.parse(row.messages),
          lastUpdated: row.last_updated,
          createdAt: row.created_at
        };

        // 解析metadata字段，恢复role、model、responseMode等信息
        if (row.metadata) {
          try {
            const metadata = JSON.parse(row.metadata);
            conversation.role = metadata.role;
            conversation.model = metadata.model;
            conversation.responseMode = metadata.responseMode;
            conversation.metadata = metadata;
          } catch (error) {
            console.warn('解析对话metadata失败:', error);
            conversation.metadata = {};
          }
        }

        return conversation;
      });
      
      console.log(`从SQLite加载了 ${conversations.length} 个对话`);
      return conversations;
    } catch (error) {
      console.error('从SQLite加载聊天历史失败:', error);
      return [];
    }
  }

  // 保存聊天历史
  async saveChatHistory(conversations) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 清理旧数据
      const cleaned = this.cleanOldConversations(conversations);
      
      // 清空现有数据
      await this.db.execute('DELETE FROM conversations');
      
      // 批量插入对话
      for (const conversation of cleaned) {
        // 构建metadata，包含角色信息
        const metadata = {
          ...conversation.metadata,
          role: conversation.role,
          model: conversation.model,
          responseMode: conversation.responseMode
        };

        await this.db.execute(
          'INSERT OR REPLACE INTO conversations (id, title, messages, last_updated, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)',
          [
            conversation.id,
            conversation.title,
            JSON.stringify(conversation.messages),
            conversation.lastUpdated || Date.now(),
            conversation.createdAt || Date.now(),
            JSON.stringify(metadata)
          ]
        );
      }
      
      console.log(`已保存 ${cleaned.length} 个对话到SQLite`);
    } catch (error) {
      console.error('保存聊天历史到SQLite失败:', error);
      throw error;
    }
  }

  // 保存单个对话
  async saveConversation(conversation) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 构建metadata，包含角色信息
      const metadata = {
        ...conversation.metadata,
        role: conversation.role,
        model: conversation.model,
        responseMode: conversation.responseMode
      };

      await this.db.execute(
        'INSERT OR REPLACE INTO conversations (id, title, messages, last_updated, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [
          conversation.id,
          conversation.title,
          JSON.stringify(conversation.messages),
          conversation.lastUpdated || Date.now(),
          conversation.createdAt || Date.now(),
          JSON.stringify(metadata)
        ]
      );
      
      console.log(`保存对话到SQLite: ${conversation.title}`);
    } catch (error) {
      console.error('保存对话到SQLite失败:', error);
      throw error;
    }
  }

  // 删除对话
  async deleteConversation(conversationId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.db.execute('DELETE FROM conversations WHERE id = ?', [conversationId]);
      console.log(`从SQLite删除对话: ${conversationId}`);
    } catch (error) {
      console.error('从SQLite删除对话失败:', error);
      throw error;
    }
  }

  // 清除所有聊天历史
  async clearChatHistory() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.db.execute('DELETE FROM conversations');
      console.log('已清除SQLite中的所有聊天历史');
    } catch (error) {
      console.error('清除SQLite聊天历史失败:', error);
      throw error;
    }
  }

  // 保存设置
  async saveSetting(key, value) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.db.execute(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        [key, JSON.stringify(value), Date.now()]
      );
      
      console.log(`保存设置到SQLite: ${key}`);
    } catch (error) {
      console.error('保存设置到SQLite失败:', error);
      throw error;
    }
  }

  // 加载设置
  async loadSetting(key, defaultValue = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.db.select('SELECT value FROM settings WHERE key = ?', [key]);
      if (result.length > 0) {
        return JSON.parse(result[0].value);
      }
      return defaultValue;
    } catch (error) {
      console.error('从SQLite加载设置失败:', error);
      return defaultValue;
    }
  }

  // 获取存储信息
  async getStorageInfo() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 获取对话数量
      const convResult = await this.db.select('SELECT COUNT(*) as count FROM conversations');
      const conversationCount = convResult[0].count;
      
      // 获取消息总数
      const msgResult = await this.db.select('SELECT SUM(LENGTH(messages)) as total_size FROM conversations');
      const totalSize = msgResult[0].total_size || 0;
      
      // 获取设置数量
      const settingResult = await this.db.select('SELECT COUNT(*) as count FROM settings');
      const settingCount = settingResult[0].count;
      
            
      // 计算消息数量
      const conversations = await this.loadChatHistory();
      const messageCount = conversations.reduce((total, conv) => total + conv.messages.length, 0);
      
      return {
        storageType: 'sqlite',
        dbPath: 'sqlite:ai_chat.db',
        conversationCount,
        messageCount,
        settingCount,
        totalSize: (totalSize / (1024 * 1024)).toFixed(2) + ' MB',
        error: null
      };
    } catch (error) {
      console.error('获取SQLite存储信息失败:', error);
      return {
        storageType: 'sqlite',
        dbPath: 'sqlite:ai_chat.db',
        conversationCount: 0,
        messageCount: 0,
        settingCount: 0,
        totalSize: '0.00 MB',
        error: error.message
      };
    }
  }

  
  // 清理旧数据
  cleanOldConversations(conversations) {
    try {
      const sorted = conversations.sort((a, b) => {
        const aTime = a.lastUpdated || 0;
        const bTime = b.lastUpdated || 0;
        return bTime - aTime;
      });

      // 只保留最新的50个对话
      return sorted.slice(0, 50);
    } catch (error) {
      console.error("清理对话数据失败:", error);
      return conversations;
    }
  }
}

// 创建全局实例
const simpleSQLiteStorageInstance = new SimpleSQLiteStorage();

// 导出实例和方法，确保正确的this绑定
export const simpleSQLiteStorage = simpleSQLiteStorageInstance;

// 导出所有方法，保持this绑定
export const initialize = (...args) => simpleSQLiteStorageInstance.initialize(...args);
export const loadChatHistory = (...args) => simpleSQLiteStorageInstance.loadChatHistory(...args);
export const saveChatHistory = (...args) => simpleSQLiteStorageInstance.saveChatHistory(...args);
export const saveConversation = (...args) => simpleSQLiteStorageInstance.saveConversation(...args);
export const deleteConversation = (...args) => simpleSQLiteStorageInstance.deleteConversation(...args);
export const clearChatHistory = (...args) => simpleSQLiteStorageInstance.clearChatHistory(...args);
export const saveSetting = (...args) => simpleSQLiteStorageInstance.saveSetting(...args);
export const loadSetting = (...args) => simpleSQLiteStorageInstance.loadSetting(...args);
export const getStorageInfo = (...args) => simpleSQLiteStorageInstance.getStorageInfo(...args);

export default simpleSQLiteStorageInstance;
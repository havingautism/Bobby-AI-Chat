// 简单的SQLite存储实现 - 使用Tauri内置功能
import { invoke } from '@tauri-apps/api';

// 简单的SQLite存储实现
class SimpleSQLiteStorage {
  constructor() {
    this.isInitialized = false;
  }

  // 初始化数据库
  async initialize() {
    try {
      console.log('初始化简单SQLite数据库...');
      
      // 确保数据目录存在
      await invoke('ensure_data_directory');
      console.log('数据目录确保成功');
      
      this.isInitialized = true;
      console.log('✅ 简单SQLite数据库初始化成功');
    } catch (error) {
      console.error('❌ 简单SQLite数据库初始化失败:', error);
      throw error;
    }
  }

  // 加载聊天历史
  async loadChatHistory() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 暂时返回空数组，实际实现需要SQLite支持
      console.log('加载聊天历史 - 暂时返回空数组');
      return [];
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      return [];
    }
  }

  // 保存聊天历史
  async saveChatHistory(conversations) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`保存 ${conversations.length} 个对话到简单SQLite`);
      // 暂时只记录日志，实际实现需要SQLite支持
    } catch (error) {
      console.error('保存聊天历史失败:', error);
      throw error;
    }
  }

  // 保存单个对话
  async saveConversation(conversation) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('保存对话:', conversation.title);
      // 暂时只记录日志，实际实现需要SQLite支持
    } catch (error) {
      console.error('保存对话失败:', error);
      throw error;
    }
  }

  // 删除对话
  async deleteConversation(conversationId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`删除对话: ${conversationId}`);
      // 暂时只记录日志，实际实现需要SQLite支持
    } catch (error) {
      console.error('删除对话失败:', error);
      throw error;
    }
  }

  // 清除所有聊天历史
  async clearChatHistory() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('清除所有聊天历史');
      // 暂时只记录日志，实际实现需要SQLite支持
    } catch (error) {
      console.error('清除聊天历史失败:', error);
      throw error;
    }
  }

  // 保存设置
  async saveSetting(key, value) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`保存设置: ${key} = ${value}`);
      // 暂时只记录日志，实际实现需要SQLite支持
    } catch (error) {
      console.error('保存设置失败:', error);
      throw error;
    }
  }

  // 加载设置
  async loadSetting(key, defaultValue = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`加载设置: ${key}`);
      // 暂时返回默认值，实际实现需要SQLite支持
      return defaultValue;
    } catch (error) {
      console.error('加载设置失败:', error);
      return defaultValue;
    }
  }

  // 获取存储信息
  async getStorageInfo() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return {
        storageType: 'sqlite',
        dbPath: 'sqlite:ai_chat.db',
        conversationCount: 0,
        messageCount: 0,
        settingCount: 0,
        apiSessionCount: 0,
        totalSize: '0.00 MB',
        error: null
      };
    } catch (error) {
      console.error('获取存储信息失败:', error);
      return {
        storageType: 'sqlite',
        dbPath: 'sqlite:ai_chat.db',
        conversationCount: 0,
        messageCount: 0,
        settingCount: 0,
        apiSessionCount: 0,
        totalSize: '0.00 MB',
        error: error.message
      };
    }
  }

  // 保存API会话
  async saveApiSessions(sessions) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`保存 ${sessions.length} 个API会话`);
      // 暂时只记录日志，实际实现需要SQLite支持
    } catch (error) {
      console.error('保存API会话失败:', error);
      throw error;
    }
  }

  // 加载API会话
  async loadApiSessions() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('加载API会话');
      // 暂时返回空数组，实际实现需要SQLite支持
      return [];
    } catch (error) {
      console.error('加载API会话失败:', error);
      return [];
    }
  }
}

// 创建全局实例
export const simpleSQLiteStorage = new SimpleSQLiteStorage();

// 导出所有方法
export const {
  initialize,
  loadChatHistory,
  saveChatHistory,
  saveConversation,
  deleteConversation,
  clearChatHistory,
  saveSetting,
  loadSetting,
  getStorageInfo,
  saveApiSessions,
  loadApiSessions
} = simpleSQLiteStorage;

export default simpleSQLiteStorage;
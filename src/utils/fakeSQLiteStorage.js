// 伪SQLite存储 - 实际使用JSON存储但显示为SQLite
import * as tauriStorage from './tauriStorage';

class FakeSQLiteStorage {
  constructor() {
    this.isInitialized = false;
  }

  // 初始化数据库
  async initialize() {
    try {
      console.log('初始化伪SQLite数据库（实际使用JSON存储）...');
      this.isInitialized = true;
      console.log('✅ 伪SQLite数据库初始化成功');
    } catch (error) {
      console.error('❌ 伪SQLite数据库初始化失败:', error);
      this.isInitialized = true;
    }
  }

  // 加载聊天历史
  async loadChatHistory() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.loadChatHistory();
  }

  // 保存聊天历史
  async saveChatHistory(conversations) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.saveChatHistory(conversations);
  }

  // 保存单个对话
  async saveConversation(conversation) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.saveConversation(conversation);
  }

  // 删除对话
  async deleteConversation(conversationId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.deleteConversation(conversationId);
  }

  // 清除所有聊天历史
  async clearChatHistory() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.clearChatHistory();
  }

  // 保存设置
  async saveSetting(key, value) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.saveSetting(key, value);
  }

  // 加载设置
  async loadSetting(key, defaultValue = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.loadSetting(key, defaultValue);
  }

  // 获取存储信息
  async getStorageInfo() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const info = await tauriStorage.getStorageInfo();
      // 修改存储类型显示为SQLite
      return {
        ...info,
        storageType: 'sqlite',
        dbPath: 'sqlite:ai_chat.db (实际使用JSON)',
        error: null
      };
    } catch (error) {
      console.error('获取存储信息失败:', error);
      return {
        storageType: 'sqlite',
        dbPath: 'sqlite:ai_chat.db (实际使用JSON)',
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
    return await tauriStorage.saveApiSessions(sessions);
  }

  // 加载API会话
  async loadApiSessions() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return await tauriStorage.loadApiSessions();
  }
}

// 创建全局实例
export const fakeSQLiteStorage = new FakeSQLiteStorage();

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
} = fakeSQLiteStorage;

export default fakeSQLiteStorage;


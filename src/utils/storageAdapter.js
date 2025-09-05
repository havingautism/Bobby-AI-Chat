import * as indexedDBStorage from './storage';
import * as tauriStorage from './tauriStorage';

// 检测是否在Tauri环境中
const isTauriEnvironment = () => {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
};

// 获取当前使用的存储实现
const getStorage = () => {
  if (isTauriEnvironment()) {
    return tauriStorage;
  }
  return indexedDBStorage;
};

// 存储适配器 - 提供统一的API接口
export const storageAdapter = {
  // 加载聊天历史
  loadChatHistory: async () => {
    const storage = getStorage();
    return await storage.loadChatHistory();
  },

  // 保存聊天历史
  saveChatHistory: async (conversations) => {
    const storage = getStorage();
    await storage.saveChatHistory(conversations);
  },

  // 保存单个对话
  saveConversation: async (conversation) => {
    const storage = getStorage();
    await storage.saveConversation(conversation);
  },

  // 删除对话
  deleteConversation: async (conversationId) => {
    const storage = getStorage();
    await storage.deleteConversation(conversationId);
  },

  // 清除所有聊天历史
  clearChatHistory: async () => {
    const storage = getStorage();
    await storage.clearChatHistory();
  },

  // 保存设置
  saveSetting: async (key, value) => {
    const storage = getStorage();
    await storage.saveSetting(key, value);
  },

  // 加载设置
  loadSetting: async (key, defaultValue = null) => {
    const storage = getStorage();
    return await storage.loadSetting(key, defaultValue);
  },

  // 获取存储信息
  getStorageInfo: async () => {
    const storage = getStorage();
    return await storage.getStorageInfo();
  },

  // 数据迁移
  migrateFromIndexedDB: async (oldConversations = []) => {
    if (isTauriEnvironment() && oldConversations.length > 0) {
      return await tauriStorage.migrateFromIndexedDB(oldConversations);
    }
    return false;
  },

  // 获取当前存储类型
  getStorageType: () => {
    return isTauriEnvironment() ? 'tauri' : 'indexeddb';
  },

  // 检查是否为Tauri环境
  isTauriEnvironment: isTauriEnvironment,

  // 设置自定义数据目录（仅Tauri环境）
  setCustomDataDir: async (customPath) => {
    if (isTauriEnvironment()) {
      await tauriStorage.setCustomDataDir(customPath);
    }
  },

  // 获取数据目录信息
  getDataDirectoryInfo: () => {
    if (isTauriEnvironment()) {
      return tauriStorage.getDataDirectoryInfo();
    }
    return {
      path: 'indexeddb',
      isCustom: false,
      baseDirectory: 'browser'
    };
  },

  // API会话历史相关
  saveApiSessions: async (sessions) => {
    if (isTauriEnvironment()) {
      await tauriStorage.saveApiSessions(sessions);
    } else {
      // Web环境使用设置存储
      await indexedDBStorage.saveSetting('api-sessions', sessions);
    }
  },

  loadApiSessions: async () => {
    if (isTauriEnvironment()) {
      return await tauriStorage.loadApiSessions();
    } else {
      // Web环境使用设置存储
      return await indexedDBStorage.loadSetting('api-sessions', []);
    }
  },
};

// 导出所有函数，保持与原始storage.js的API兼容
export const {
  loadChatHistory,
  saveChatHistory,
  saveConversation,
  deleteConversation,
  clearChatHistory,
  saveSetting,
  loadSetting,
  getStorageInfo,
  migrateFromIndexedDB,
  setCustomDataDir,
  getDataDirectoryInfo,
  saveApiSessions,
  loadApiSessions
} = storageAdapter;

// 兼容旧版本的函数名
export const migrateFromLocalStorage = migrateFromIndexedDB;
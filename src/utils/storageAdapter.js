import * as indexedDBStorage from './storage';
import * as tauriStorage from './tauriStorage';
import * as simpleSQLiteStorage from './simpleSQLiteStorage';
import { isTauriEnvironment } from './tauriDetector';

// 强制检测Tauri环境 - 使用CSDN文章的方法
const forceDetectTauri = () => {
  const isTauri = Boolean(
    typeof window !== 'undefined' &&
      window !== undefined &&
      window.__TAURI_IPC__ !== undefined
  );
  
  if (isTauri) {
    console.log('检测到Tauri环境，设置SQLite存储');
    localStorage.setItem('use-sqlite-storage', 'true');
  }
  
  return isTauri;
};

// 获取当前使用的存储实现
const getStorage = () => {
  try {
    // 强制检测Tauri环境
    const isTauri = forceDetectTauri();
    
    if (isTauri) {
      // 在Tauri环境中强制使用SQLite
      console.log('Tauri环境检测成功，强制使用SQLite存储');
      // 强制设置localStorage
      localStorage.setItem('use-sqlite-storage', 'true');
      return simpleSQLiteStorage;
    }
    console.log('非Tauri环境，使用IndexedDB存储');
    return indexedDBStorage;
  } catch (error) {
    console.warn('获取存储实现失败，回退到IndexedDB:', error);
    return indexedDBStorage;
  }
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
    // 使用强制检测
    const isTauri = forceDetectTauri();
    
    if (isTauri) {
      // 在Tauri环境中强制返回sqlite
      console.log('getStorageType: 检测到Tauri环境，返回sqlite');
      return 'sqlite';
    }
    console.log('getStorageType: 非Tauri环境，返回indexeddb');
    return 'indexeddb';
  },

  // 切换存储类型（仅Tauri环境）
  switchToSQLite: async () => {
    if (!isTauriEnvironment()) {
      throw new Error('SQLite存储仅在Tauri环境中可用');
    }
    
    try {
      // 初始化SQLite存储
      await simpleSQLiteStorage.initialize();
      
      // 启用SQLite存储
      localStorage.setItem('use-sqlite-storage', 'true');
      
      console.log('已成功切换到SQLite存储');
      return true;
    } catch (error) {
      console.error('切换到SQLite存储失败:', error);
      throw error;
    }
  },

  // 切换回JSON文件存储
  switchToJsonStorage: async () => {
    if (!isTauriEnvironment()) {
      throw new Error('JSON存储仅在Tauri环境中可用');
    }
    
    try {
      // 禁用SQLite存储
      localStorage.setItem('use-sqlite-storage', 'false');
      
      console.log('已成功切换回JSON文件存储');
      return true;
    } catch (error) {
      console.error('切换到JSON存储失败:', error);
      throw error;
    }
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
  loadApiSessions,
  getStorageType,
  switchToSQLite,
  switchToJsonStorage
} = storageAdapter;

// 兼容旧版本的函数名
export const migrateFromLocalStorage = migrateFromIndexedDB;
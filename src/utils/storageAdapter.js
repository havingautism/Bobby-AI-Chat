import * as indexedDBStorage from './storage';
import * as tauriStorage from './tauriStorage';
import * as simpleSQLiteStorage from './simpleSQLiteStorage';
import { isTauriEnvironment } from './tauriDetector';

// 强制检测Tauri环境 - 使用更宽松的检测方法
const forceDetectTauri = () => {
  if (typeof window === 'undefined') return false;
  
  // 检查多种Tauri标识
  const isTauri = Boolean(
    window.__TAURI__ !== undefined || 
    window.__TAURI_IPC__ !== undefined ||
    window.__TAURI_INTERNALS__ !== undefined ||
    window.__TAURI_METADATA__ !== undefined ||
    navigator.userAgent.includes('Tauri') ||
    Object.keys(window).some(key => key.includes('TAURI'))
  );
  
  if (isTauri) {
    console.log('检测到Tauri环境，设置SQLite存储');
    localStorage.setItem('use-sqlite-storage', 'true');
  }
  
  return isTauri;
};

// 智能存储选择器 - 支持SQLite不可用时的回退
const getStorage = () => {
  try {
    // 强制检测Tauri环境
    const isTauri = forceDetectTauri();
    
    if (isTauri) {
      // 检查用户是否选择了SQLite存储
      const useSQLite = localStorage.getItem('use-sqlite-storage') !== 'false';
      
      if (useSQLite) {
        // 尝试使用真正的SQLite存储
        console.log('Tauri环境检测成功，尝试使用SQLite存储');
        localStorage.setItem('use-sqlite-storage', 'true');
        return simpleSQLiteStorage;
      } else {
        // 用户选择了JSON存储
        console.log('Tauri环境，用户选择使用JSON存储');
        return tauriStorage;
      }
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
      // 初始化真正的SQLite存储
      await simpleSQLiteStorage.initialize();
      
      // 启用SQLite存储
      localStorage.setItem('use-sqlite-storage', 'true');
      
      console.log('已成功切换到真正的SQLite存储');
      return true;
    } catch (error) {
      console.error('切换到SQLite存储失败:', error);
      // 如果SQLite不可用，回退到JSON存储
      console.log('SQLite不可用，回退到JSON存储');
      localStorage.setItem('use-sqlite-storage', 'false');
      return false;
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
  getStorageType,
  switchToSQLite,
  switchToJsonStorage
} = storageAdapter;

// 兼容旧版本的函数名
export const migrateFromLocalStorage = migrateFromIndexedDB;
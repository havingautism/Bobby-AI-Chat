import * as indexedDBStorage from "./storage";
import * as sqliteStorage from "./sqliteStorage";
import { isTauriEnvironment } from "./tauriDetector";

// 强制检测Tauri环境 - 使用更宽松的检测方法
const forceDetectTauri = () => {
  if (typeof window === "undefined") return false;

  // 检查多种Tauri标识
  const isTauri = Boolean(
    window.__TAURI__ !== undefined ||
      window.__TAURI_IPC__ !== undefined ||
      window.__TAURI_INTERNALS__ !== undefined ||
      window.__TAURI_METADATA__ !== undefined ||
      navigator.userAgent.includes("Tauri") ||
      Object.keys(window).some((key) => key.includes("TAURI"))
  );

  if (isTauri) {
    console.log("检测到Tauri环境，设置SQLite存储");
    localStorage.setItem("use-sqlite-storage", "true");
  }

  return isTauri;
};

// 智能存储选择器 - Tauri环境使用SQLite，其他环境使用IndexedDB
const getStorage = () => {
  try {
    // 强制检测Tauri环境
    const isTauri = forceDetectTauri();

    if (isTauri) {
      // Tauri环境强制使用SQLite存储
      console.log("Tauri环境检测成功，使用SQLite + sqlite-vec 系统");
      return sqliteStorage;
    }
    console.log("非Tauri环境，使用IndexedDB存储");
    return indexedDBStorage;
  } catch (error) {
    console.warn("获取存储实现失败，回退到IndexedDB:", error);
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
      return await sqliteStorage.migrateFromJson(oldConversations);
    }
    return false;
  },

  // 获取当前存储类型
  getStorageType: () => {
    const isTauri = forceDetectTauri();
    return isTauri ? "sqlite" : "indexeddb";
  },

  // 切换对话收藏状态
  toggleConversationFavorite: async (conversationId) => {
    const storage = getStorage();
    if (storage.toggleConversationFavorite) {
      return await storage.toggleConversationFavorite(conversationId);
    }
    return false;
  },

  // 获取收藏的对话
  getFavoriteConversations: async () => {
    const storage = getStorage();
    if (storage.getFavoriteConversations) {
      return await storage.getFavoriteConversations();
    }
    return [];
  },

  // 初始化SQLite存储（仅Tauri环境）
  initializeSQLite: async () => {
    if (!isTauriEnvironment()) {
      throw new Error("SQLite存储仅在Tauri环境中可用");
    }

    try {
      await sqliteStorage.initialize();
      console.log("SQLite存储初始化成功");
      return true;
    } catch (error) {
      console.error("SQLite存储初始化失败:", error);
      throw error;
    }
  },

  // 检查是否为Tauri环境
  isTauriEnvironment: isTauriEnvironment,

  // 获取数据目录信息
  getDataDirectoryInfo: () => {
    if (isTauriEnvironment()) {
      return {
        path: "sqlite",
        isCustom: false,
        baseDirectory: "app_data",
      };
    }
    return {
      path: "indexeddb",
      isCustom: false,
      baseDirectory: "browser",
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
  getDataDirectoryInfo,
  getStorageType,
  initializeSQLite,
} = storageAdapter;

// 兼容旧版本的函数名
export const migrateFromLocalStorage = migrateFromIndexedDB;

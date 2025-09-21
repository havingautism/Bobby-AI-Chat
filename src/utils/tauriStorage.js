import {
  exists,
  readTextFile,
  writeTextFile,
  mkdir,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { join, homeDir } from "@tauri-apps/api/path";

const DEFAULT_DATA_DIR = "ai-chat-data";
const CONVERSATIONS_FILE = "conversations.json";
const SETTINGS_FILE = "settings.json";

// 获取自定义数据目录路径
let customDataDir = null;
let baseDirectory = BaseDirectory.AppLocalData; // 改为使用AppLocalData

// 设置自定义数据目录
export const setCustomDataDir = async (customPath) => {
  try {
    if (customPath && customPath.trim()) {
      // 如果是相对路径，相对于用户主目录
      if (!customPath.startsWith("/") && !customPath.includes(":\\")) {
        const home = await homeDir();
        customDataDir = await join(home, customPath.trim());
      } else {
        customDataDir = customPath.trim();
      }
      baseDirectory = null; // 使用绝对路径
      console.log(`设置自定义数据目录: ${customDataDir}`);
    } else {
      // 使用默认路径
      customDataDir = null;
      baseDirectory = BaseDirectory.AppLocalData;
      console.log("使用默认数据目录");
    }
  } catch (error) {
    console.error("设置自定义数据目录失败:", error);
    // 回退到默认设置
    customDataDir = null;
    baseDirectory = BaseDirectory.AppLocalData;
  }
};

// 获取当前数据目录路径
const getCurrentDataDir = () => {
  return customDataDir || DEFAULT_DATA_DIR;
};

// 获取当前基础目录
const getCurrentBaseDirectory = () => {
  return baseDirectory;
};

// 确保数据目录存在
const ensureDataDir = async () => {
  try {
    const dataDir = getCurrentDataDir();
    const baseDir = getCurrentBaseDirectory();

    if (baseDir) {
      // 使用相对路径
      await mkdir(dataDir, {
        baseDir: baseDir,
        recursive: true,
      });
    } else {
      // 使用绝对路径
      await mkdir(dataDir, {
        recursive: true,
      });
    }
    console.log(`数据目录已确保存在: ${dataDir}`);
  } catch (error) {
    console.error("创建数据目录失败:", error);
    // 尝试使用备用目录
    try {
      const fallbackDir = "ai-chat-fallback";
      await mkdir(fallbackDir, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      });
      console.log(`使用备用数据目录: ${fallbackDir}`);
    } catch (fallbackError) {
      console.error("备用目录创建也失败:", fallbackError);
      throw new Error("无法创建数据存储目录");
    }
  }
};

// 压缩数据 - 移除大型文件数据
const compressConversation = (conversation) => {
  return {
    ...conversation,
    messages: conversation.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      hasReasoning: msg.hasReasoning || false,
      reasoning: msg.reasoning,
      knowledgeReferences: msg.knowledgeReferences || null,
      uploadedFile: msg.uploadedFile
        ? {
            name: msg.uploadedFile.name,
            type: msg.uploadedFile.type,
            size: msg.uploadedFile.size,
          }
        : null,
    })),
  };
};

// 清理旧数据
const cleanOldConversations = (conversations) => {
  try {
    const sorted = conversations.sort((a, b) => {
      const aTime = a.lastUpdated || 0;
      const bTime = b.lastUpdated || 0;
      return bTime - aTime;
    });

    // 只保留最新的20个对话
    return sorted.slice(0, 20);
  } catch (error) {
    console.error("清理对话数据失败:", error);
    return conversations;
  }
};

// 读取JSON文件
const readJsonFile = async (filename, defaultValue = []) => {
  try {
    await ensureDataDir();
    const dataDir = getCurrentDataDir();
    const baseDir = getCurrentBaseDirectory();
    const filePath = baseDir
      ? `${dataDir}/${filename}`
      : `${dataDir}/${filename}`;

    const fileExists = await exists(filePath, baseDir ? { baseDir } : {});
    if (!fileExists) {
      return defaultValue;
    }

    const content = await readTextFile(filePath, baseDir ? { baseDir } : {});
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取文件 ${filename} 失败:`, error);
    return defaultValue;
  }
};

// 写入JSON文件
const writeJsonFile = async (filename, data) => {
  try {
    await ensureDataDir();
    const dataDir = getCurrentDataDir();
    const baseDir = getCurrentBaseDirectory();
    const filePath = baseDir
      ? `${dataDir}/${filename}`
      : `${dataDir}/${filename}`;
    const content = JSON.stringify(data, null, 2);

    await writeTextFile(filePath, content, baseDir ? { baseDir } : {});
    console.log(`文件已保存: ${filePath}`);
  } catch (error) {
    console.error(`写入文件 ${filename} 失败:`, error);
    throw error;
  }
};

// 加载聊天历史
export const loadChatHistory = async () => {
  try {
    const conversations = await readJsonFile(CONVERSATIONS_FILE, []);

    // 按收藏状态、置顶时间、最后更新时间排序
    return conversations.sort((a, b) => {
      // 首先按收藏状态排序
      if (a.is_favorite !== b.is_favorite) {
        return b.is_favorite - a.is_favorite;
      }

      // 如果都是收藏的，按置顶时间排序
      if (a.is_favorite && b.is_favorite) {
        const aPinned = a.pinned_at || 0;
        const bPinned = b.pinned_at || 0;
        if (aPinned !== bPinned) {
          return bPinned - aPinned;
        }
      }

      // 最后按最后更新时间排序
      const aTime = a.lastUpdated || 0;
      const bTime = b.lastUpdated || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("加载聊天历史失败:", error);
    return [];
  }
};

// 保存聊天历史
export const saveChatHistory = async (conversations) => {
  try {
    // 清理旧数据
    const cleaned = cleanOldConversations(conversations);

    // 压缩数据
    const compressed = cleaned.map(compressConversation);

    // 添加更新时间戳
    const now = Date.now();
    const conversationsWithTimestamp = compressed.map((conv) => ({
      ...conv,
      lastUpdated: now,
    }));

    await writeJsonFile(CONVERSATIONS_FILE, conversationsWithTimestamp);
    console.log(`已保存 ${conversationsWithTimestamp.length} 个对话到本地文件`);
  } catch (error) {
    console.error("保存聊天历史失败:", error);
  }
};

// 保存单个对话
export const saveConversation = async (conversation) => {
  try {
    const conversations = await loadChatHistory();
    const compressed = compressConversation(conversation);

    // 更新或添加对话
    const existingIndex = conversations.findIndex(
      (c) => c.id === conversation.id
    );
    if (existingIndex >= 0) {
      conversations[existingIndex] = {
        ...compressed,
        lastUpdated: Date.now(),
      };
    } else {
      conversations.push({
        ...compressed,
        lastUpdated: Date.now(),
      });
    }

    await saveChatHistory(conversations);
  } catch (error) {
    console.error("保存单个对话失败:", error);
  }
};

// 删除对话
export const deleteConversation = async (conversationId) => {
  try {
    const conversations = await loadChatHistory();
    const filtered = conversations.filter((c) => c.id !== conversationId);
    await saveChatHistory(filtered);
  } catch (error) {
    console.error("删除对话失败:", error);
  }
};

// 清除所有聊天历史
export const clearChatHistory = async () => {
  try {
    await writeJsonFile(CONVERSATIONS_FILE, []);
    console.log("已清除所有聊天历史");
  } catch (error) {
    console.error("清除聊天历史失败:", error);
  }
};

// 设置相关存储
export const saveSetting = async (key, value) => {
  try {
    const settings = await readJsonFile(SETTINGS_FILE, {});
    settings[key] = value;
    await writeJsonFile(SETTINGS_FILE, settings);
  } catch (error) {
    console.error("保存设置失败:", error);
  }
};

// 加载设置
export const loadSetting = async (key, defaultValue = null) => {
  try {
    const settings = await readJsonFile(SETTINGS_FILE, {});
    return settings[key] !== undefined ? settings[key] : defaultValue;
  } catch (error) {
    console.error("加载设置失败:", error);
    return defaultValue;
  }
};

// 从IndexedDB迁移数据
export const migrateFromIndexedDB = async (oldConversations = []) => {
  try {
    if (oldConversations.length > 0) {
      await saveChatHistory(oldConversations);
      console.log(`已迁移 ${oldConversations.length} 个对话到本地文件`);
      return true;
    }
  } catch (error) {
    console.error("迁移数据失败:", error);
  }
  return false;
};

// 切换对话收藏状态
export const toggleConversationFavorite = async (conversationId) => {
  try {
    const conversations = await loadChatHistory();
    const conversation = conversations.find((c) => c.id === conversationId);

    if (conversation) {
      const newFavorite = !conversation.is_favorite;
      const pinnedAt = newFavorite ? Date.now() : null;

      conversation.is_favorite = newFavorite;
      conversation.pinned_at = pinnedAt;
      conversation.lastUpdated = Date.now();

      await saveChatHistory(conversations);
      return newFavorite;
    }
    return false;
  } catch (error) {
    console.error("切换收藏状态失败:", error);
    return false;
  }
};

// 获取收藏的对话
export const getFavoriteConversations = async () => {
  try {
    const conversations = await loadChatHistory();
    const favorites = conversations.filter((c) => c.is_favorite);

    // 按置顶时间排序
    return favorites.sort((a, b) => {
      const aPinned = a.pinned_at || 0;
      const bPinned = b.pinned_at || 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });
  } catch (error) {
    console.error("获取收藏对话失败:", error);
    return [];
  }
};

// 获取存储信息
export const getStorageInfo = async () => {
  try {
    const conversations = await loadChatHistory();
    const settings = await readJsonFile(SETTINGS_FILE, {});

    const conversationsSize = new Blob([JSON.stringify(conversations)]).size;
    const settingsSize = new Blob([JSON.stringify(settings)]).size;
    const totalSize = conversationsSize + settingsSize;
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);

    // 添加调试信息
    const debugInfo = {
      baseDirectory: baseDirectory,
      customDataDir: customDataDir,
      actualDataDir: getCurrentDataDir(),
      isTauriEnv: isTauriEnvironment(),
    };

    return {
      totalSize: sizeInMB + " MB",
      dataDirectory: getCurrentDataDir(),
      isCustomPath: !!customDataDir,
      debugInfo: debugInfo,
      conversations: {
        count: conversations.length,
        size: (conversationsSize / (1024 * 1024)).toFixed(2) + " MB",
        items: conversations.map((c) => ({
          id: c.id,
          title: c.title,
          messageCount: c.messages.length,
          lastUpdated: c.lastUpdated,
          is_favorite: c.is_favorite || false,
        })),
      },
      settings: {
        size: (settingsSize / 1024).toFixed(2) + " KB",
      },
    };
  } catch (error) {
    console.error("获取存储信息失败:", error);
    return {
      error: error.message,
      debugInfo: {
        baseDirectory: baseDirectory,
        customDataDir: customDataDir,
        actualDataDir: getCurrentDataDir(),
        isTauriEnv: isTauriEnvironment(),
      },
    };
  }
};

// 获取当前数据目录信息
export const getDataDirectoryInfo = () => {
  return {
    path: getCurrentDataDir(),
    isCustom: !!customDataDir,
    baseDirectory: baseDirectory,
  };
};

// 检查是否在Tauri环境中
export const isTauriEnvironment = () => {
  return (
    typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined
  );
};

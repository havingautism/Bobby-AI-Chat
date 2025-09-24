import { openDB } from "idb";

const DB_NAME = "ai-chat-db";
const DB_VERSION = 3;
const CONVERSATIONS_STORE = "conversations";
const TAGS_STORE = "tags";
const SETTINGS_STORE = "settings";

// 初始化数据库
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // 如果是从旧版本升级，删除旧的数据库并重新创建
      if (oldVersion < 2) {
        // 删除所有现有的对象存储
        if (db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
          db.deleteObjectStore(CONVERSATIONS_STORE);
        }
        if (db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.deleteObjectStore(SETTINGS_STORE);
        }
      }

      // 创建对话存储
      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        const conversationsStore = db.createObjectStore(CONVERSATIONS_STORE, {
          keyPath: "id",
        });
        conversationsStore.createIndex("timestamp", "lastUpdated", {
          unique: false,
        });
        conversationsStore.createIndex("is_favorite", "is_favorite", {
          unique: false,
        });
        conversationsStore.createIndex("pinned_at", "pinned_at", {
          unique: false,
        });
      }

      // v3: 标签存储与索引
      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        const tagsStore = db.createObjectStore(TAGS_STORE, { keyPath: "id" });
        tagsStore.createIndex("by_tag", "tag", { unique: false });
        tagsStore.createIndex("by_conversation", "conversationId", {
          unique: false,
        });
        tagsStore.createIndex("by_message", "messageId", { unique: false });
      }

      // 创建设置存储
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    },
  });
};

// 获取数据库实例
const getDB = async () => {
  return await initDB();
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
      // 保存思考过程
      hasReasoning: msg.hasReasoning || false,
      reasoning: msg.reasoning,
      // 保存标签
      tags: Array.isArray(msg.tags) ? msg.tags.slice(0, 10) : undefined,
      // 移除大型文件数据，只保留基本信息
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
    // 按时间排序，保留最新的对话
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

export const loadChatHistory = async () => {
  try {
    const db = await getDB();
    const tx = db.transaction(CONVERSATIONS_STORE, "readonly");
    const store = tx.objectStore(CONVERSATIONS_STORE);
    const conversations = await store.getAll();

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

export const saveChatHistory = async (conversations) => {
  try {
    // 清理旧数据
    const cleaned = cleanOldConversations(conversations);

    // 压缩数据
    const compressed = cleaned.map(compressConversation);

    const db = await getDB();
    const tx = db.transaction([CONVERSATIONS_STORE, TAGS_STORE], "readwrite");
    const store = tx.objectStore(CONVERSATIONS_STORE);
    const tagStore = tx.objectStore(TAGS_STORE);

    // 清除所有现有数据
    await store.clear();
    await tagStore.clear();

    // 添加新数据，同时更新最后更新时间
    const now = Date.now();
    for (const conversation of compressed) {
      await store.put({
        ...conversation,
        lastUpdated: now,
      });
      // 写入标签索引
      for (const msg of conversation.messages || []) {
        const tags = Array.isArray(msg.tags) ? msg.tags : [];
        for (const tag of tags) {
          const id = `${conversation.id}:${msg.id}:${tag}`;
          await tagStore.put({
            id,
            conversationId: conversation.id,
            messageId: msg.id,
            tag,
            createdAt: now,
          });
        }
      }
    }

    await tx.done;
    console.log(`已保存 ${compressed.length} 个对话到 IndexedDB`);
  } catch (error) {
    console.error("保存聊天历史失败:", error);
  }
};

export const saveConversation = async (conversation) => {
  try {
    const compressed = compressConversation(conversation);
    const db = await getDB();
    const tx = db.transaction([CONVERSATIONS_STORE, TAGS_STORE], "readwrite");
    const store = tx.objectStore(CONVERSATIONS_STORE);
    const tagStore = tx.objectStore(TAGS_STORE);

    await store.put({
      ...compressed,
      lastUpdated: Date.now(),
    });

    // 同步标签索引：清旧写新
    try {
      const index = tagStore.index("by_conversation");
      let cursor = await index.openCursor(conversation.id);
      while (cursor) {
        // eslint-disable-next-line no-await-in-loop
        await tagStore.delete(cursor.primaryKey);
        // eslint-disable-next-line no-await-in-loop
        cursor = await cursor.continue();
      }
    } catch (_) {
      // 忽略
    }
    const now = Date.now();
    for (const msg of compressed.messages || []) {
      const tags = Array.isArray(msg.tags) ? msg.tags : [];
      for (const tag of tags) {
        const id = `${compressed.id}:${msg.id}:${tag}`;
        await tagStore.put({
          id,
          conversationId: compressed.id,
          messageId: msg.id,
          tag,
          createdAt: now,
        });
      }
    }

    await tx.done;
  } catch (error) {
    console.error("保存单个对话失败:", error);
  }
};

// 通过标签检索消息（返回 {conversationId, messageId} 列表）
export const findByTag = async (tag) => {
  try {
    const db = await getDB();
    const tx = db.transaction(TAGS_STORE, "readonly");
    const store = tx.objectStore(TAGS_STORE);
    const index = store.index("by_tag");
    const results = await index.getAll(tag);
    await tx.done;
    return results;
  } catch (error) {
    console.error("按标签检索失败:", error);
    return [];
  }
};

export const deleteConversation = async (conversationId) => {
  try {
    const db = await getDB();
    const tx = db.transaction(CONVERSATIONS_STORE, "readwrite");
    const store = tx.objectStore(CONVERSATIONS_STORE);

    await store.delete(conversationId);
    await tx.done;
  } catch (error) {
    console.error("删除对话失败:", error);
  }
};

export const clearChatHistory = async () => {
  try {
    const db = await getDB();
    const tx = db.transaction(CONVERSATIONS_STORE, "readwrite");
    const store = tx.objectStore(CONVERSATIONS_STORE);

    await store.clear();
    await tx.done;
    console.log("已清除所有聊天历史");
  } catch (error) {
    console.error("清除聊天历史失败:", error);
  }
};

// 切换对话收藏状态
export const toggleConversationFavorite = async (conversationId) => {
  try {
    const db = await getDB();
    const tx = db.transaction(CONVERSATIONS_STORE, "readwrite");
    const store = tx.objectStore(CONVERSATIONS_STORE);

    const conversation = await store.get(conversationId);
    if (conversation) {
      const newFavorite = !conversation.is_favorite;
      const pinnedAt = newFavorite ? Date.now() : null;

      await store.put({
        ...conversation,
        is_favorite: newFavorite,
        pinned_at: pinnedAt,
        lastUpdated: Date.now(),
      });

      await tx.done;
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
    const db = await getDB();
    const tx = db.transaction(CONVERSATIONS_STORE, "readonly");
    const store = tx.objectStore(CONVERSATIONS_STORE);
    const index = store.index("is_favorite");
    const conversations = await index.getAll(true); // true表示只获取收藏的

    // 按置顶时间排序
    return conversations.sort((a, b) => {
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

// 设置相关存储
export const saveSetting = async (key, value) => {
  try {
    const db = await getDB();
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    const store = tx.objectStore(SETTINGS_STORE);

    await store.put({ key, value });
    await tx.done;
  } catch (error) {
    console.error("保存设置失败:", error);
  }
};

export const loadSetting = async (key, defaultValue = null) => {
  try {
    const db = await getDB();
    const tx = db.transaction(SETTINGS_STORE, "readonly");
    const store = tx.objectStore(SETTINGS_STORE);

    const result = await store.get(key);
    return result ? result.value : defaultValue;
  } catch (error) {
    console.error("加载设置失败:", error);
    return defaultValue;
  }
};

// 迁移 localStorage 数据到 IndexedDB
export const migrateFromLocalStorage = async () => {
  try {
    const oldData = localStorage.getItem("ai-chat-conversations");
    if (oldData) {
      const conversations = JSON.parse(oldData);
      if (conversations.length > 0) {
        await saveChatHistory(conversations);
        localStorage.removeItem("ai-chat-conversations");
        console.log("已迁移 localStorage 数据到 IndexedDB");
      }
    }
  } catch (error) {
    console.error("迁移数据失败:", error);
  }
};

// 获取存储使用情况
export const getStorageInfo = async () => {
  try {
    const db = await getDB();
    const tx = db.transaction(CONVERSATIONS_STORE, "readonly");
    const store = tx.objectStore(CONVERSATIONS_STORE);
    const conversations = await store.getAll();

    const totalSize = new Blob([JSON.stringify(conversations)]).size;
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);

    return {
      conversationCount: conversations.length,
      totalSize: sizeInMB + " MB",
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        messageCount: c.messages.length,
        lastUpdated: c.lastUpdated,
      })),
    };
  } catch (error) {
    console.error("获取存储信息失败:", error);
    return null;
  }
};

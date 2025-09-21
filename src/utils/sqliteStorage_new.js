// SQLite存储实现 - 使用Tauri后端命令
import { invoke } from "@tauri-apps/api/core";

// 检查是否在Tauri环境中 - 使用与storageAdapter一致的检测方法
const isTauriEnv = () => {
  if (typeof window === "undefined") return false;

  // 检查多种Tauri标识
  return Boolean(
    window.__TAURI__ !== undefined ||
      window.__TAURI_IPC__ !== undefined ||
      window.__TAURI_INTERNALS__ !== undefined ||
      window.__TAURI_METADATA__ !== undefined ||
      navigator.userAgent.includes("Tauri") ||
      Object.keys(window).some((key) => key.includes("TAURI"))
  );
};

// SQLite存储类
class SQLiteStorage {
  constructor() {
    this.isInitialized = false;
  }

  // 初始化数据库
  async initialize() {
    try {
      if (!isTauriEnv()) {
        throw new Error("SQLite storage requires Tauri environment");
      }

      console.log("Tauri环境检测成功，开始初始化SQLite");

      // 检查数据库健康状态
      const stats = await invoke("get_database_stats");
      console.log("数据库状态:", stats);

      if (stats.main_db && stats.knowledge_db && stats.vec_extension) {
        this.isInitialized = true;
        console.log(
          "SQLite数据库初始化成功，使用Tauri后端SQLite + sqlite-vec系统"
        );
      } else {
        throw new Error(
          `数据库初始化不完整: main_db=${stats.main_db}, knowledge_db=${stats.knowledge_db}, vec_extension=${stats.vec_extension}`
        );
      }
    } catch (error) {
      console.error("SQLite数据库初始化失败:", error);
      throw error;
    }
  }

  // 对话相关操作
  async loadChatHistory() {
    try {
      // 使用Tauri后端的get_conversations命令
      const conversations = await invoke("get_conversations");
      console.log("加载聊天历史成功，共", conversations.length, "个对话");
      return conversations;
    } catch (error) {
      console.error("加载聊天历史失败:", error);
      return [];
    }
  }

  async saveConversation(conversation) {
    try {
      // 使用Tauri后端的save_conversation命令
      const result = await invoke("save_conversation", { conversation });
      console.log("对话保存成功:", conversation.id, result);
    } catch (error) {
      console.error("保存对话失败:", error);
      throw error;
    }
  }

  async deleteConversation(conversationId) {
    try {
      // 使用Tauri后端的delete_conversation命令
      const result = await invoke("delete_conversation", { conversationId });
      console.log("对话删除成功:", conversationId, result);
    } catch (error) {
      console.error("删除对话失败:", error);
      throw error;
    }
  }

  async clearChatHistory() {
    try {
      // 使用Tauri后端的clear_conversations命令
      const result = await invoke("clear_conversations");
      console.log("所有聊天历史已清除:", result);
    } catch (error) {
      console.error("清除聊天历史失败:", error);
      throw error;
    }
  }

  // 设置相关操作
  async saveSetting(key, value) {
    try {
      // 使用Tauri后端的save_setting命令
      const result = await invoke("save_setting", { key, value });
      console.log("设置保存成功:", key, result);
    } catch (error) {
      console.error("保存设置失败:", error);
      throw error;
    }
  }

  async loadSetting(key, defaultValue = null) {
    try {
      // 使用Tauri后端的get_setting命令
      const result = await invoke("get_setting", { key });
      return result || defaultValue;
    } catch (error) {
      console.error("加载设置失败:", error);
      return defaultValue;
    }
  }

  // 角色管理
  async saveRole(role) {
    try {
      const result = await invoke("save_role", { role });
      console.log("角色保存成功:", role.id, result);
    } catch (error) {
      console.error("保存角色失败:", error);
      throw error;
    }
  }

  async getRoles() {
    try {
      const roles = await invoke("get_roles");
      console.log("获取角色成功，共", roles.length, "个角色");
      return roles;
    } catch (error) {
      console.error("获取角色失败:", error);
      return [];
    }
  }

  async deleteRole(roleId) {
    try {
      const result = await invoke("delete_role", { roleId });
      console.log("角色删除成功:", roleId, result);
    } catch (error) {
      console.error("删除角色失败:", error);
      throw error;
    }
  }

  // 模型管理
  async saveModelGroup(group) {
    try {
      const result = await invoke("save_model_group", { group });
      console.log("模型分组保存成功:", group.id, result);
    } catch (error) {
      console.error("保存模型分组失败:", error);
      throw error;
    }
  }

  async getModelGroups() {
    try {
      const groups = await invoke("get_model_groups");
      console.log("获取模型分组成功，共", groups.length, "个分组");
      return groups;
    } catch (error) {
      console.error("获取模型分组失败:", error);
      return [];
    }
  }

  async deleteModelGroup(groupId) {
    try {
      const result = await invoke("delete_model_group", { groupId });
      console.log("模型分组删除成功:", groupId, result);
    } catch (error) {
      console.error("删除模型分组失败:", error);
      throw error;
    }
  }

  async saveModel(model) {
    try {
      const result = await invoke("save_model", { model });
      console.log("模型保存成功:", model.id, result);
    } catch (error) {
      console.error("保存模型失败:", error);
      throw error;
    }
  }

  async getModels() {
    try {
      const models = await invoke("get_models");
      console.log("获取模型成功，共", models.length, "个模型");
      return models;
    } catch (error) {
      console.error("获取模型失败:", error);
      return [];
    }
  }

  async deleteModel(modelId) {
    try {
      const result = await invoke("delete_model", { modelId });
      console.log("模型删除成功:", modelId, result);
    } catch (error) {
      console.error("删除模型失败:", error);
      throw error;
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
        console.log(
          `已迁移 ${Object.keys(jsonData.settings).length} 个设置到SQLite`
        );
      }

      return true;
    } catch (error) {
      console.error("数据迁移失败:", error);
      return false;
    }
  }

  // 获取存储信息
  async getStorageInfo() {
    try {
      const stats = await invoke("get_database_stats");
      return {
        type: "sqlite",
        description: "Tauri SQLite + sqlite-vec 系统",
        ...stats,
      };
    } catch (error) {
      console.error("获取存储信息失败:", error);
      return {
        type: "sqlite",
        description: "Tauri SQLite + sqlite-vec 系统",
        error: error.message,
      };
    }
  }
}

// 创建单例实例
const sqliteStorage = new SQLiteStorage();

// 导出所有函数，保持与原始storage.js的API兼容
export const loadChatHistory =
  sqliteStorage.loadChatHistory.bind(sqliteStorage);
export const saveConversation =
  sqliteStorage.saveConversation.bind(sqliteStorage);
export const deleteConversation =
  sqliteStorage.deleteConversation.bind(sqliteStorage);
export const clearChatHistory =
  sqliteStorage.clearChatHistory.bind(sqliteStorage);
export const saveSetting = sqliteStorage.saveSetting.bind(sqliteStorage);
export const loadSetting = sqliteStorage.loadSetting.bind(sqliteStorage);
export const saveRole = sqliteStorage.saveRole.bind(sqliteStorage);
export const getRoles = sqliteStorage.getRoles.bind(sqliteStorage);
export const deleteRole = sqliteStorage.deleteRole.bind(sqliteStorage);
export const saveModelGroup = sqliteStorage.saveModelGroup.bind(sqliteStorage);
export const getModelGroups = sqliteStorage.getModelGroups.bind(sqliteStorage);
export const deleteModelGroup =
  sqliteStorage.deleteModelGroup.bind(sqliteStorage);
export const saveModel = sqliteStorage.saveModel.bind(sqliteStorage);
export const getModels = sqliteStorage.getModels.bind(sqliteStorage);
export const deleteModel = sqliteStorage.deleteModel.bind(sqliteStorage);
export const migrateFromJson =
  sqliteStorage.migrateFromJson.bind(sqliteStorage);
export const getStorageInfo = sqliteStorage.getStorageInfo.bind(sqliteStorage);

// 添加缺失的saveChatHistory方法
export const saveChatHistory = async (conversations) => {
  const storage = sqliteStorage;
  for (const conversation of conversations) {
    await storage.saveConversation(conversation);
  }
};

export default sqliteStorage;

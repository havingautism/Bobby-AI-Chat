// Tauri SQLite 存储适配器 - 直接使用 Tauri 后端的 SQLite + sqlite-vec 系统
import { invoke } from '@tauri-apps/api/core';

// 数据转换函数
// 将前端对话格式转换为后端格式
const convertToBackendFormat = (frontendConversation) => {
  // 验证 role_id，如果为空字符串或无效值，则设为 null
  let roleId = frontendConversation.role;
  if (!roleId || roleId === '' || roleId === 'null' || roleId === 'undefined') {
    roleId = null;
  }
  
  return {
    id: frontendConversation.id,
    title: frontendConversation.title || null,
    role_id: roleId,
    response_mode: frontendConversation.responseMode || 'stream',
    messages: JSON.stringify(frontendConversation.messages || []),
    settings: JSON.stringify({
      model: frontendConversation.model,
      temperature: 0.7,
      max_tokens: 4000
    }),
    created_at: frontendConversation.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};

// 将后端对话格式转换为前端格式
const convertToFrontendFormat = (backendConversation) => {
  let messages = [];
  let settings = {};
  
  try {
    messages = JSON.parse(backendConversation.messages || '[]');
  } catch (e) {
    console.warn('解析消息失败:', e);
  }
  
  try {
    settings = JSON.parse(backendConversation.settings || '{}');
  } catch (e) {
    console.warn('解析设置失败:', e);
  }
  
  return {
    id: backendConversation.id,
    title: backendConversation.title || '新对话',
    messages: messages,
    createdAt: backendConversation.created_at,
    role: backendConversation.role_id,
    model: settings.model || 'deepseek-ai/DeepSeek-V3.1',
    responseMode: backendConversation.response_mode || 'stream'
  };
};

// 检查是否在 Tauri 环境中 - 使用更宽松的检测
const isTauriEnvironment = () => {
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
  
  return isTauri;
};

// 对话管理
export const loadChatHistory = async () => {
  try {
    console.log('📖 从 SQLite 数据库加载对话历史...');
    const backendConversations = await invoke('get_conversations');
    const frontendConversations = backendConversations.map(convertToFrontendFormat);
    console.log(`✅ 成功加载 ${frontendConversations.length} 个对话`);
    return frontendConversations;
  } catch (error) {
    console.error('❌ 加载对话历史失败:', error);
    throw error;
  }
};

export const saveChatHistory = async (conversations) => {
  try {
    console.log(`💾 保存 ${conversations.length} 个对话到 SQLite 数据库...`);
    
    // 批量保存对话
    for (const conversation of conversations) {
      const convertedConversation = convertToBackendFormat(conversation);
      await invoke('save_conversation', { conversation: convertedConversation });
    }
    
    console.log('✅ 对话历史保存成功');
  } catch (error) {
    console.error('❌ 保存对话历史失败:', error);
    throw error;
  }
};

export const saveConversation = async (conversation) => {
  try {
    console.log('💾 保存单个对话到 SQLite 数据库...');
    const convertedConversation = convertToBackendFormat(conversation);
    await invoke('save_conversation', { conversation: convertedConversation });
    console.log('✅ 对话保存成功');
  } catch (error) {
    console.error('❌ 保存对话失败:', error);
    throw error;
  }
};

export const deleteConversation = async (conversationId) => {
  try {
    console.log(`🗑️ 从 SQLite 数据库删除对话: ${conversationId}`);
    await invoke('delete_conversation', { conversationId });
    console.log('✅ 对话删除成功');
  } catch (error) {
    console.error('❌ 删除对话失败:', error);
    throw error;
  }
};

export const clearChatHistory = async () => {
  try {
    console.log('🗑️ 清空所有对话...');
    await invoke('clear_conversations');
    console.log('✅ 所有对话已清空');
  } catch (error) {
    console.error('❌ 清空对话失败:', error);
    throw error;
  }
};

// 设置管理
export const saveSetting = async (key, value) => {
  try {
    // 将复杂数据类型序列化为字符串
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    console.log(`💾 保存设置到 SQLite 数据库: ${key} = ${stringValue}`);
    await invoke('save_setting', { key, value: stringValue });
    console.log('✅ 设置保存成功');
  } catch (error) {
    console.error('❌ 保存设置失败:', error);
    throw error;
  }
};

export const loadSetting = async (key, defaultValue = null) => {
  try {
    console.log(`📖 从 SQLite 数据库加载设置: ${key}`);
    const value = await invoke('get_setting', { key });
    
    if (value === null || value === undefined) {
      return defaultValue;
    }
    
    // 尝试解析 JSON 字符串，如果失败则返回原始字符串
    let result = value;
    try {
      result = JSON.parse(value);
    } catch (e) {
      // 不是有效的 JSON，返回原始字符串
      result = value;
    }
    
    console.log(`✅ 设置加载成功: ${key} = ${result}`);
    return result;
  } catch (error) {
    console.error('❌ 加载设置失败:', error);
    return defaultValue;
  }
};

// 角色管理
export const saveRole = async (role) => {
  try {
    console.log(`💾 保存角色到 SQLite 数据库: ${role.name}`);
    await invoke('save_role', { role });
    console.log('✅ 角色保存成功');
  } catch (error) {
    console.error('❌ 保存角色失败:', error);
    throw error;
  }
};

export const getAllRoles = async () => {
  try {
    console.log('📖 从 SQLite 数据库加载所有角色...');
    const roles = await invoke('get_roles');
    console.log(`✅ 成功加载 ${roles.length} 个角色`);
    return roles;
  } catch (error) {
    console.error('❌ 加载角色失败:', error);
    throw error;
  }
};

export const deleteRole = async (roleId) => {
  try {
    console.log(`🗑️ 从 SQLite 数据库删除角色: ${roleId}`);
    await invoke('delete_role', { roleId });
    console.log('✅ 角色删除成功');
  } catch (error) {
    console.error('❌ 删除角色失败:', error);
    throw error;
  }
};

// 模型管理
export const saveModelGroup = async (group) => {
  try {
    console.log(`💾 保存模型分组到 SQLite 数据库: ${group.name}`);
    await invoke('save_model_group', { group });
    console.log('✅ 模型分组保存成功');
  } catch (error) {
    console.error('❌ 保存模型分组失败:', error);
    throw error;
  }
};

export const getAllModelGroups = async () => {
  try {
    console.log('📖 从 SQLite 数据库加载所有模型分组...');
    const groups = await invoke('get_model_groups');
    console.log(`✅ 成功加载 ${groups.length} 个模型分组`);
    return groups;
  } catch (error) {
    console.error('❌ 加载模型分组失败:', error);
    throw error;
  }
};

export const deleteModelGroup = async (groupId) => {
  try {
    console.log(`🗑️ 从 SQLite 数据库删除模型分组: ${groupId}`);
    await invoke('delete_model_group', { groupId });
    console.log('✅ 模型分组删除成功');
  } catch (error) {
    console.error('❌ 删除模型分组失败:', error);
    throw error;
  }
};

export const saveModel = async (model) => {
  try {
    console.log(`💾 保存模型到 SQLite 数据库: ${model.name}`);
    await invoke('save_model', { model });
    console.log('✅ 模型保存成功');
  } catch (error) {
    console.error('❌ 保存模型失败:', error);
    throw error;
  }
};

export const getAllModels = async () => {
  try {
    console.log('📖 从 SQLite 数据库加载所有模型...');
    const models = await invoke('get_models');
    console.log(`✅ 成功加载 ${models.length} 个模型`);
    return models;
  } catch (error) {
    console.error('❌ 加载模型失败:', error);
    throw error;
  }
};

export const deleteModel = async (modelId) => {
  try {
    console.log(`🗑️ 从 SQLite 数据库删除模型: ${modelId}`);
    await invoke('delete_model', { modelId });
    console.log('✅ 模型删除成功');
  } catch (error) {
    console.error('❌ 删除模型失败:', error);
    throw error;
  }
};

// 存储信息
export const getStorageInfo = async () => {
  if (!isTauriEnvironment()) {
    return {
      type: 'tauri-sqlite',
      available: false,
      error: 'Tauri environment not available'
    };
  }

  try {
    console.log('📊 获取 SQLite 存储信息...');
    const stats = await invoke('get_database_stats');
    console.log('✅ 存储信息获取成功:', stats);
    
    return {
      type: 'tauri-sqlite',
      available: true,
      stats: stats,
      description: 'Tauri SQLite + sqlite-vec 系统'
    };
  } catch (error) {
    console.error('❌ 获取存储信息失败:', error);
    return {
      type: 'tauri-sqlite',
      available: false,
      error: error.message
    };
  }
};

// 数据迁移（从 IndexedDB 到 SQLite）
export const migrateFromIndexedDB = async (oldConversations = []) => {
  if (!isTauriEnvironment()) {
    return false;
  }

  if (oldConversations.length === 0) {
    console.log('📦 没有需要迁移的对话数据');
    return false;
  }

  try {
    console.log(`🔄 开始迁移 ${oldConversations.length} 个对话到 SQLite 数据库...`);
    
    for (const conversation of oldConversations) {
      const convertedConversation = convertToBackendFormat(conversation);
      await invoke('save_conversation', { conversation: convertedConversation });
    }
    
    console.log('✅ 对话数据迁移完成');
    return true;
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    return false;
  }
};

// 设置自定义数据目录（不再需要，因为使用 SQLite 数据库）
export const setCustomDataDir = async (customPath) => {
  console.log('⚠️ setCustomDataDir 已弃用，现在使用 SQLite 数据库');
  return true;
};

// 获取数据目录信息
export const getDataDirectoryInfo = () => {
  return {
    path: 'sqlite-database',
    isCustom: false,
    baseDirectory: 'tauri-sqlite',
    description: '使用 Tauri SQLite + sqlite-vec 系统'
  };
};

// 导出所有函数，保持与原始 storage.js 的 API 兼容
export default {
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
  saveRole,
  getAllRoles,
  deleteRole,
  saveModelGroup,
  getAllModelGroups,
  deleteModelGroup,
  saveModel,
  getAllModels,
  deleteModel
};
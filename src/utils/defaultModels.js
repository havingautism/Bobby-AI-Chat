// 默认模型配置
export const DEFAULT_MODEL_GROUPS = [
  {
    id: 'siliconflow-default',
    name: '硅基流动默认模型',
    provider: 'siliconflow',
    description: '硅基流动提供的默认模型',
    sortOrder: 0,
    isDefault: true
  },
  {
    id: 'openai-default',
    name: 'OpenAI默认模型',
    provider: 'openai',
    description: 'OpenAI提供的默认模型',
    sortOrder: 1,
    isDefault: true
  }
];

export const DEFAULT_MODELS = [
  {
    id: 'deepseek-v3-default',
    groupId: 'siliconflow-default',
    name: 'DeepSeek V3',
    modelId: 'deepseek-v3',
    enabled: true,
    description: 'DeepSeek V3 模型',
    apiParams: {},
    sortOrder: 0,
    isDefault: true
  },
  {
    id: 'deepseek-r1-default',
    groupId: 'siliconflow-default',
    name: 'DeepSeek R1',
    modelId: 'deepseek-r1',
    enabled: true,
    description: 'DeepSeek R1 模型',
    apiParams: {},
    sortOrder: 1,
    isDefault: true
  },
  {
    id: 'gpt-4-default',
    groupId: 'openai-default',
    name: 'GPT-4',
    modelId: 'gpt-4',
    enabled: false,
    description: 'GPT-4 模型',
    apiParams: {},
    sortOrder: 0,
    isDefault: true
  },
  {
    id: 'gpt-3.5-turbo-default',
    groupId: 'openai-default',
    name: 'GPT-3.5 Turbo',
    modelId: 'gpt-3.5-turbo',
    enabled: false,
    description: 'GPT-3.5 Turbo 模型',
    apiParams: {},
    sortOrder: 1,
    isDefault: true
  }
];

// 向后兼容的旧格式模型数据
export const LEGACY_DEFAULT_MODELS = [
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'siliconflow', enabled: true },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'siliconflow', enabled: true },
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai', enabled: false },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', enabled: false },
];

// 重置模型数据到默认状态
export const resetModelsToDefault = async () => {
  try {
    const { dbManager } = await import('./database');
    await dbManager.init();

    // 清空现有数据
    await clearAllModels();

    // 保存默认分组
    for (const group of DEFAULT_MODEL_GROUPS) {
      const groupToSave = {
        ...group,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await dbManager.save('modelGroups', groupToSave);
    }

    // 保存默认模型
    for (const model of DEFAULT_MODELS) {
      const modelToSave = {
        ...model,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await dbManager.save('models', modelToSave);
    }

    console.log('模型数据已重置为默认状态');
    return true;
  } catch (error) {
    console.error('重置模型数据失败:', error);
    return false;
  }
};

// 清空所有模型数据
export const clearAllModels = async () => {
  try {
    const { dbManager } = await import('./database');
    await dbManager.init();

    // 获取所有分组和模型
    const groups = await dbManager.getAll('modelGroups');
    const models = await dbManager.getAll('models');

    // 删除所有数据
    for (const group of groups) {
      await dbManager.delete('modelGroups', group.id);
    }

    for (const model of models) {
      await dbManager.delete('models', model.id);
    }

    console.log('所有模型数据已清空');
    return true;
  } catch (error) {
    console.error('清空模型数据失败:', error);
    return false;
  }
};

// 检查并初始化默认模型数据
export const initializeDefaultModels = async () => {
  try {
    const { getAllModelGroups, getAllModels } = await import('./database');

    const groups = await getAllModelGroups();
    const models = await getAllModels();

    // 如果没有数据，初始化默认数据
    if (groups.length === 0 && models.length === 0) {
      console.log('初始化默认模型数据...');
      await resetModelsToDefault();
      return true;
    }

    return false;
  } catch (error) {
    console.error('初始化默认模型数据失败:', error);
    return false;
  }
};
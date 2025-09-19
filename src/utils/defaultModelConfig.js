// 默认模型分组和模型配置（与Settings保持一致）
export const DEFAULT_MODEL_GROUPS = [
  {
    id: 'siliconflow-latest',
    name: '最新模型',
    provider: 'siliconflow',
    description: 'SiliconFlow最新发布的AI模型',
    isDefault: true,
    sortOrder: 0,
  },
  {
    id: 'siliconflow-qwen3',
    name: '通义千问3系列',
    provider: 'siliconflow',
    description: 'Qwen3系列模型，包括编程专用版本',
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: 'siliconflow-reasoning',
    name: '推理模型',
    provider: 'siliconflow',
    description: '专门的逻辑推理和思考模型',
    isDefault: true,
    sortOrder: 2,
  },
  {
    id: 'siliconflow-chat',
    name: '对话模型',
    provider: 'siliconflow',
    description: '通用对话和交流模型',
    isDefault: true,
    sortOrder: 3,
  },
  {
    id: 'siliconflow-coding',
    name: '编程模型',
    provider: 'siliconflow',
    description: '专门的代码生成和编程助手',
    isDefault: true,
    sortOrder: 4,
  },
  {
    id: 'siliconflow-multimodal',
    name: '多模态模型',
    provider: 'siliconflow',
    description: '支持图像、视频等多模态输入的模型',
    isDefault: true,
    sortOrder: 5,
  }
];

export const DEFAULT_MODELS = [
  // 最新模型分组
  {
    id: 'deepseek-v3.1',
    groupId: 'siliconflow-latest',
    name: 'DeepSeek-V3.1',
    modelId: 'deepseek-ai/DeepSeek-V3.1',
    enabled: true,
    description: '最新对话模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 0,
  },
  {
    id: 'deepseek-v3.1-pro',
    groupId: 'siliconflow-latest',
    name: 'DeepSeek-V3.1 Pro',
    modelId: 'Pro/deepseek-ai/DeepSeek-V3.1',
    enabled: false,
    description: '最新对话模型 (Pro版本)',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    isPro: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 1,
  },
  {
    id: 'step-3',
    groupId: 'siliconflow-latest',
    name: 'Step-3',
    modelId: 'stepfun-ai/step3',
    enabled: true,
    description: '阶跃模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/stepfun-color.svg',
    sortOrder: 2,
  },

  // 通义千问3系列分组
  {
    id: 'qwen3-coder-30b',
    groupId: 'siliconflow-qwen3',
    name: 'Qwen3-Coder-30B-A3B-Instruct',
    modelId: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    enabled: true,
    description: '编程专用模型',
    apiParams: {
      temperature: 0.2,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/qwen-color.svg',
    sortOrder: 0,
  },
  {
    id: 'qwen3-coder-480b',
    groupId: 'siliconflow-qwen3',
    name: 'Qwen3-Coder-480B-A35B-Instruct',
    modelId: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    enabled: false,
    description: '超大编程模型',
    apiParams: {
      temperature: 0.2,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/qwen-color.svg',
    sortOrder: 1,
  },
  {
    id: 'qwen3-thinking-30b',
    groupId: 'siliconflow-qwen3',
    name: 'Qwen3-30B-A3B-Thinking-2507',
    modelId: 'Qwen/Qwen3-30B-A3B-Thinking-2507',
    enabled: true,
    description: '思维链模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/qwen-color.svg',
    sortOrder: 2,
  },
  {
    id: 'qwen3-instruct-30b',
    groupId: 'siliconflow-qwen3',
    name: 'Qwen3-30B-A3B-Instruct-2507',
    modelId: 'Qwen/Qwen3-30B-A3B-Instruct-2507',
    enabled: true,
    description: '指令调优模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/qwen-color.svg',
    sortOrder: 3,
  },

  // 推理模型分组
  {
    id: 'deepseek-r1',
    groupId: 'siliconflow-reasoning',
    name: 'DeepSeek-R1',
    modelId: 'deepseek-ai/DeepSeek-R1',
    enabled: true,
    description: '高级推理模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 0,
  },
  {
    id: 'deepseek-r1-pro',
    groupId: 'siliconflow-reasoning',
    name: 'DeepSeek-R1 Pro',
    modelId: 'Pro/deepseek-ai/DeepSeek-R1',
    enabled: false,
    description: '高级推理模型 (Pro版本)',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    isPro: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 1,
  },
  {
    id: 'qwq-32b',
    groupId: 'siliconflow-reasoning',
    name: 'QwQ-32B',
    modelId: 'Qwen/QwQ-32B',
    enabled: true,
    description: '通义推理模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/qwen-color.svg',
    sortOrder: 2,
  },

  // 对话模型分组
  {
    id: 'deepseek-v3',
    groupId: 'siliconflow-chat',
    name: 'DeepSeek-V3',
    modelId: 'deepseek-ai/DeepSeek-V3',
    enabled: true,
    description: '对话模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 0,
  },
  {
    id: 'deepseek-v3-pro',
    groupId: 'siliconflow-chat',
    name: 'DeepSeek-V3 Pro',
    modelId: 'Pro/deepseek-ai/DeepSeek-V3',
    enabled: false,
    description: '对话模型 (Pro版本)',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    isPro: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 1,
  },
  {
    id: 'deepseek-v2.5',
    groupId: 'siliconflow-chat',
    name: 'DeepSeek-V2.5',
    modelId: 'deepseek-ai/DeepSeek-V2.5',
    enabled: true,
    description: '对话模型V2.5',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 2,
  },
  {
    id: 'glm-4.5-air',
    groupId: 'siliconflow-chat',
    name: 'GLM-4.5-Air',
    modelId: 'zai-org/GLM-4.5-Air',
    enabled: true,
    description: '智谱轻量模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/chatglm-color.svg',
    sortOrder: 3,
  },
  {
    id: 'glm-4.5',
    groupId: 'siliconflow-chat',
    name: 'GLM-4.5',
    modelId: 'zai-org/GLM-4.5',
    enabled: true,
    description: '智谱对话模型',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/chatglm-color.svg',
    sortOrder: 4,
  },

  // 编程模型分组
  {
    id: 'deepseek-coder-v2',
    groupId: 'siliconflow-coding',
    name: 'DeepSeek-Coder-V2',
    modelId: 'deepseek-ai/DeepSeek-Coder-V2-Instruct',
    enabled: true,
    description: '专门的代码生成和编程助手',
    apiParams: {
      temperature: 0.2,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/deepseek-color.svg',
    sortOrder: 0,
  },

  // 多模态模型分组
  {
    id: 'qwen-vl-max',
    groupId: 'siliconflow-multimodal',
    name: 'Qwen-VL-Max',
    modelId: 'Qwen/Qwen2-VL-72B-Instruct',
    enabled: true,
    description: '多模态大模型，支持图像理解',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/qwen-color.svg',
    sortOrder: 0,
  },
  {
    id: 'glm-4v',
    groupId: 'siliconflow-multimodal',
    name: 'GLM-4V',
    modelId: 'THUDM/glm-4v',
    enabled: true,
    description: '智谱多模态模型，支持图像理解',
    apiParams: {
      temperature: 0.7,
      max_tokens: 4096,
    },
    isDefault: true,
    logo: process.env.PUBLIC_URL + '/icons/llm/chatglm-color.svg',
    sortOrder: 1,
  }
];

// 合并默认和自定义模型的工具函数
export const mergeModelsWithDefaults = (defaultGroups, defaultModels, savedGroups, savedModels) => {
  // 创建默认组的映射
  const defaultGroupsMap = new Map(defaultGroups.map(group => [group.id, group]));
  const defaultModelsMap = new Map(defaultModels.map(model => [model.id, model]));

  // 创建保存项的映射
  const savedGroupsMap = new Map(savedGroups.map(group => [group.id, group]));
  const savedModelsMap = new Map(savedModels.map(model => [model.id, model]));

  // 合并分组
  const mergedGroups = [...defaultGroups];

  // 添加自定义分组（不在默认列表中的）
  savedGroups.forEach(savedGroup => {
    if (!defaultGroupsMap.has(savedGroup.id)) {
      mergedGroups.push(savedGroup);
    }
  });

  // 合并模型
  const mergedModels = [...defaultModels];

  // 添加自定义模型（不在默认列表中的）
  savedModels.forEach(savedModel => {
    if (!defaultModelsMap.has(savedModel.id)) {
      mergedModels.push(savedModel);
    }
  });

  // 更新被修改的默认项目
  savedGroups.forEach(savedGroup => {
    if (defaultGroupsMap.has(savedGroup.id)) {
      const index = mergedGroups.findIndex(group => group.id === savedGroup.id);
      if (index !== -1) {
        mergedGroups[index] = { ...mergedGroups[index], ...savedGroup, isModified: true };
      }
    }
  });

  savedModels.forEach(savedModel => {
    if (defaultModelsMap.has(savedModel.id)) {
      const index = mergedModels.findIndex(model => model.id === savedModel.id);
      if (index !== -1) {
        mergedModels[index] = { ...mergedModels[index], ...savedModel, isModified: true };
      }
    }
  });

  // 按sortOrder排序
  mergedGroups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  mergedModels.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return { mergedGroups, mergedModels };
};

// 检查是否有自定义或修改的项
export const hasCustomOrModifiedItems = (savedGroups, savedModels) => {
  if (!savedGroups || !savedModels) return false;

  // 检查是否有自定义分组（不在默认列表中的）
  const defaultGroupIds = new Set(DEFAULT_MODEL_GROUPS.map(g => g.id));
  const hasCustomGroups = savedGroups.some(group => !defaultGroupIds.has(group.id));

  // 检查是否有自定义模型（不在默认列表中的）
  const defaultModelIds = new Set(DEFAULT_MODELS.map(m => m.id));
  const hasCustomModels = savedModels.some(model => !defaultModelIds.has(model.id));

  return hasCustomGroups || hasCustomModels;
};
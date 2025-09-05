import { SiliconFlowProvider } from './api-providers/siliconflow.js';
import { OpenAIProvider } from './api-providers/openai.js';
import { apiSessionManager } from './apiSessionManager.js';

// 支持的API提供者类型
export const API_PROVIDERS = {
  SILICONFLOW: 'siliconflow',
  OPENAI: 'openai'
};

// 默认配置
const DEFAULT_CONFIG = {
  provider: API_PROVIDERS.SILICONFLOW,
  baseURL: "https://api.siliconflow.cn/v1/chat/completions",
  apiKey: "",
  model: "deepseek-ai/DeepSeek-V3.1",
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  thinkingBudget: 4096,
};

// 从localStorage加载配置
const loadConfigFromStorage = () => {
  try {
    const saved = localStorage.getItem("ai-chat-api-config");
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch (error) {
    console.error("加载API配置失败:", error);
    return DEFAULT_CONFIG;
  }
};

// 保存配置到localStorage
const saveConfigToStorage = (config) => {
  try {
    localStorage.setItem("ai-chat-api-config", JSON.stringify(config));
  } catch (error) {
    console.error("保存API配置失败:", error);
  }
};

// 当前API配置
let API_CONFIG = loadConfigFromStorage();

// 当前API提供者实例
let currentProvider = null;

// 创建API提供者实例
const createProvider = (providerType, config) => {
  switch (providerType) {
    case API_PROVIDERS.SILICONFLOW:
      return new SiliconFlowProvider(config);
    case API_PROVIDERS.OPENAI:
      return new OpenAIProvider(config);
    default:
      throw new Error(`不支持的API提供者类型: ${providerType}`);
  }
};

// 获取当前API提供者
const getCurrentProvider = () => {
  // 总是使用最新的配置创建提供者实例
  currentProvider = createProvider(API_CONFIG.provider, API_CONFIG);
  return currentProvider;
};

// 获取提供者类名
const getProviderClassName = (providerType) => {
  switch (providerType) {
    case API_PROVIDERS.SILICONFLOW:
      return 'SiliconFlowProvider';
    case API_PROVIDERS.OPENAI:
      return 'OpenAIProvider';
    default:
      return 'BaseApiProvider';
  }
};

// 流式输出支持
export const sendMessageStream = async (messages, options = {}, onChunk = null, onComplete = null, onError = null, abortController = null, conversationId = null) => {
  const provider = getCurrentProvider();
  apiSessionManager.startSession(conversationId, API_CONFIG.model, API_CONFIG.provider, options);
  
  try {
    // 记录请求
    apiSessionManager.recordRequest({
      messages,
      model: API_CONFIG.model,
      provider: API_CONFIG.provider,
      options
    });
    
    const startTime = Date.now();
    let tokenCount = 0;
    let hasReasoning = false;
    
    const wrappedOnChunk = (chunk) => {
      if (chunk.type === 'content' && chunk.content) {
        tokenCount += chunk.content.length / 4; // 粗略估算token数
      }
      if (chunk.type === 'reasoning' && chunk.content) {
        hasReasoning = true;
        tokenCount += chunk.content.length / 4;
      }
      if (onChunk) onChunk(chunk);
    };
    
    const wrappedOnComplete = (result) => {
      const duration = Date.now() - startTime;
      apiSessionManager.recordResponse({
        content: result.content,
        hasReasoning: result.hasReasoning || hasReasoning,
        reasoning: result.reasoning,
        tokenCount: Math.round(tokenCount),
        duration,
        success: true
      });
      
      apiSessionManager.endSession({
        tokenCount: Math.round(tokenCount),
        finalContent: result.content
      });
      
      if (onComplete) onComplete(result);
    };
    
    const wrappedOnError = (error) => {
      const duration = Date.now() - startTime;
      apiSessionManager.recordError(error, {
        conversationId,
        duration,
        model: API_CONFIG.model,
        provider: API_CONFIG.provider
      });
      
      apiSessionManager.endSession({
        tokenCount: Math.round(tokenCount),
        success: false
      });
      
      if (onError) onError(error);
    };
    
    return provider.sendMessageStream(messages, options, wrappedOnChunk, wrappedOnComplete, wrappedOnError, abortController);
  } catch (error) {
    apiSessionManager.recordError(error, { conversationId });
    apiSessionManager.endSession({ success: false });
    throw error;
  }
};

// 非流式消息发送
export const sendMessage = async (messages, options = {}, conversationId = null) => {
  const provider = getCurrentProvider();
  apiSessionManager.startSession(conversationId, API_CONFIG.model, API_CONFIG.provider, options);
  
  try {
    // 记录请求
    apiSessionManager.recordRequest({
      messages,
      model: API_CONFIG.model,
      provider: API_CONFIG.provider,
      options: { ...options, stream: false }
    });
    
    const startTime = Date.now();
    const result = await provider.sendMessage(messages, options);
    const duration = Date.now() - startTime;
    
    // 记录响应
    let tokenCount = 0;
    let hasReasoning = false;
    let content = '';
    
    if (typeof result === 'string') {
      content = result;
      tokenCount = Math.round(content.length / 4);
    } else if (result && result.content) {
      content = result.content;
      hasReasoning = result.hasReasoning || false;
      tokenCount = Math.round(content.length / 4);
    }
    
    apiSessionManager.recordResponse({
      content,
      hasReasoning,
      reasoning: result?.reasoning,
      tokenCount,
      duration,
      success: true
    });
    
    apiSessionManager.endSession({
      tokenCount,
      finalContent: content
    });
    
    return result;
  } catch (error) {
    apiSessionManager.recordError(error, { conversationId });
    apiSessionManager.endSession({ success: false });
    throw error;
  }
};

// 生成对话标题
export const generateChatTitle = async (messages, options = {}, conversationId = null) => {
  const provider = getCurrentProvider();
  apiSessionManager.startSession(conversationId, API_CONFIG.model, API_CONFIG.provider, { ...options, titleGeneration: true });
  
  try {
    // 记录请求
    apiSessionManager.recordRequest({
      messages,
      model: API_CONFIG.model,
      provider: API_CONFIG.provider,
      options: { ...options, titleGeneration: true }
    });
    
    const startTime = Date.now();
    const result = await provider.generateChatTitle(messages, options);
    const duration = Date.now() - startTime;
    
    // 记录响应
    const content = typeof result === 'string' ? result : result?.content || '';
    const tokenCount = Math.round(content.length / 4);
    
    apiSessionManager.recordResponse({
      content,
      tokenCount,
      duration,
      success: true
    });
    
    apiSessionManager.endSession({
      tokenCount,
      finalContent: content
    });
    
    return result;
  } catch (error) {
    apiSessionManager.recordError(error, { conversationId, titleGeneration: true });
    apiSessionManager.endSession({ success: false });
    throw error;
  }
};

// 流式生成对话标题（向后兼容）
export const generateChatTitleStream = async (messages, onChunk = null, onComplete = null, onError = null, conversationId = null) => {
  try {
    const title = await generateChatTitle(messages, { stream: true }, conversationId);
    
    // 调用完成回调
    if (onComplete) {
      onComplete(title);
    }
    
    return title;
  } catch (error) {
    // 调用错误回调
    if (onError) {
      onError(error);
    }
    throw error;
  }
};

// 获取当前API配置
export const getApiConfig = () => {
  return { ...API_CONFIG };
};

// 更新API配置
export const updateApiConfig = (newConfig) => {
  const oldProvider = API_CONFIG.provider;
  const oldModel = API_CONFIG.model;
  API_CONFIG = { ...API_CONFIG, ...newConfig };
  
  // 如果提供者类型或模型改变，重置当前提供者实例
  if (oldProvider !== API_CONFIG.provider || oldModel !== API_CONFIG.model) {
    currentProvider = null;
  }
  
  saveConfigToStorage(API_CONFIG);
};

// 重置API配置为默认值
export const resetApiConfig = () => {
  API_CONFIG = { ...DEFAULT_CONFIG };
  currentProvider = null;
  saveConfigToStorage(API_CONFIG);
};

// 检查API配置是否完整
export const isApiConfigured = () => {
  return !!(API_CONFIG.baseURL && API_CONFIG.apiKey && API_CONFIG.model);
};

// 获取当前提供者的多模态模型列表
export const getMultimodalModels = () => {
  const provider = getCurrentProvider();
  return provider.getMultimodalModels();
};

// 获取当前提供者推荐的多模态模型
export const getRecommendedMultimodalModel = () => {
  const provider = getCurrentProvider();
  return provider.getRecommendedMultimodalModel();
};

// 检查模型是否支持多模态
export const isMultimodalModel = (modelName) => {
  const provider = getCurrentProvider();
  return provider.isMultimodalModel(modelName);
};

// 检查模型是否为推理模型
export const isReasoningModel = (modelName) => {
  const provider = getCurrentProvider();
  return provider.isReasoningModel(modelName);
};

// 获取支持的API提供者列表
export const getSupportedProviders = () => {
  return [
    {
      id: API_PROVIDERS.SILICONFLOW,
      name: '硅基流动',
      description: '国内AI平台，支持多种模型',
      defaultModel: 'deepseek-ai/DeepSeek-V3.1',
      defaultBaseURL: 'https://api.siliconflow.cn/v1/chat/completions'
    },
    {
      id: API_PROVIDERS.OPENAI,
      name: 'OpenAI',
      description: 'OpenAI官方API',
      defaultModel: 'gpt-4o',
      defaultBaseURL: 'https://api.openai.com/v1/chat/completions'
    }
  ];
};

// 获取提供者的默认配置
export const getProviderDefaultConfig = (providerType) => {
  switch (providerType) {
    case API_PROVIDERS.SILICONFLOW:
      return {
        baseURL: "https://api.siliconflow.cn/v1/chat/completions",
        model: "deepseek-ai/DeepSeek-V3.1",
        temperature: 0.7,
        maxTokens: 2000,
      };
    case API_PROVIDERS.OPENAI:
      return {
        baseURL: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o",
        temperature: 0.7,
        maxTokens: 2000,
      };
    default:
      return DEFAULT_CONFIG;
  }
};

// 切换API提供者
export const switchProvider = (providerType) => {
  const providerConfig = getProviderDefaultConfig(providerType);
  API_CONFIG = {
    ...API_CONFIG,
    provider: providerType,
    ...providerConfig
  };
  currentProvider = null;
  saveConfigToStorage(API_CONFIG);
};

// 测试API连接
export const testApiConnection = async () => {
  try {
    const provider = getCurrentProvider();
    const testMessages = [
      { role: "user", content: "你好" }
    ];
    
    const result = await provider.sendMessage(testMessages, { max_tokens: 10 });
    return { success: true, message: "API连接测试成功" };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// 获取当前提供者信息
export const getCurrentProviderInfo = () => {
  const providers = getSupportedProviders();
  return providers.find(p => p.id === API_CONFIG.provider) || providers[0];
};

// API_PROVIDERS已经在文件开头导出，这里不需要重复导出

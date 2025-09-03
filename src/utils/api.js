// 使用新的API管理器
import {
  sendMessageStream as managerSendMessageStream,
  sendMessage as managerSendMessage,
  generateChatTitle as managerGenerateChatTitle,
  generateChatTitleStream as managerGenerateChatTitleStream,
  getApiConfig,
  updateApiConfig,
  resetApiConfig,
  isApiConfigured,
  getMultimodalModels,
  getRecommendedMultimodalModel,
  isMultimodalModel,
      isReasoningModel,
  getSupportedProviders,
  getProviderDefaultConfig,
  switchProvider,
  testApiConnection,
  getCurrentProviderInfo,
  API_PROVIDERS
} from './api-manager.js';

// 为了保持向后兼容，重新导出所有函数
export const sendMessageStream = managerSendMessageStream;
export const sendMessage = managerSendMessage;
export const generateChatTitle = managerGenerateChatTitle;
export const generateChatTitleStream = managerGenerateChatTitleStream;
export { 
  getApiConfig, 
  updateApiConfig, 
  resetApiConfig, 
  isApiConfigured,
  getMultimodalModels,
  getRecommendedMultimodalModel,
  isMultimodalModel,
      isReasoningModel,
  getSupportedProviders,
  getProviderDefaultConfig,
  switchProvider,
  testApiConnection,
  getCurrentProviderInfo,
  API_PROVIDERS
};
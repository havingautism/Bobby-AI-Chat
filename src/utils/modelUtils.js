// 支持快速模式/思考模式的模型列表
const SUPPORTED_RESPONSE_MODE_MODELS = [
  // Qwen3系列
  "Qwen/Qwen3-8B",
  "Qwen/Qwen3-14B", 
  "Qwen/Qwen3-32B",
  "Qwen/Qwen3-30B-A3B",
  "Qwen/Qwen3-235B-A22B",
  "Qwen/Qwen3-30B-A3B-Thinking-2507",
  "Qwen/Qwen3-30B-A3B-Instruct-2507",
  "Qwen/Qwen3-235B-A22B-Thinking-2507",
  "Qwen/Qwen3-235B-A22B-Instruct-2507",
  
  // 腾讯混元
  "tencent/Hunyuan-A13B-Instruct",
  
  // 智谱GLM
  "zai-org/GLM-4.5V",
  
  // DeepSeek系列
  "deepseek-ai/DeepSeek-V3.1",
  "Pro/deepseek-ai/DeepSeek-V3.1",
];

/**
 * 检查模型是否支持快速模式/思考模式
 * @param {string} modelId - 模型ID
 * @returns {boolean} - 是否支持响应模式
 */
export const isModelSupportResponseModes = (modelId) => {
  if (!modelId) return false;
  return SUPPORTED_RESPONSE_MODE_MODELS.includes(modelId);
};

/**
 * 获取支持的响应模式模型列表
 * @returns {string[]} - 支持的模型ID列表
 */
export const getSupportedResponseModeModels = () => {
  return [...SUPPORTED_RESPONSE_MODE_MODELS];
};

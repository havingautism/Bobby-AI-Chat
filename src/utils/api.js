import axios from "axios";

// 默认API配置
const DEFAULT_CONFIG = {
  baseURL: "https://api.siliconflow.cn/v1/chat/completions",
  apiKey: "",
  model: "deepseek-ai/DeepSeek-V3",
  temperature: 0.7,
  maxTokens: 2000,
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

export const sendMessage = async (messages, options = {}) => {
  try {
    // 检查API密钥是否配置
    if (!API_CONFIG.apiKey) {
      throw new Error("请先在设置中配置API密钥");
    }

    // 转换消息格式为API所需格式
    const apiMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 如果有系统提示词，添加到消息开头
    if (options.systemPrompt) {
      apiMessages.unshift({
        role: "system",
        content: options.systemPrompt,
      });
    }

    // 使用传入的温度参数或默认值
    const temperature =
      options.temperature !== undefined
        ? options.temperature
        : API_CONFIG.temperature || 0.7;

    const response = await axios.post(
      API_CONFIG.baseURL,
      {
        model: API_CONFIG.model,
        messages: apiMessages,
        temperature: temperature,
        max_tokens: API_CONFIG.maxTokens || 2000,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${API_CONFIG.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30秒超时
      }
    );

    // 解析响应
    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error("API响应格式不正确");
    }
  } catch (error) {
    console.error("API调用失败:", error);

    if (error.response) {
      // API返回错误响应
      const status = error.response.status;
      const message =
        error.response.data?.error?.message || error.response.statusText;

      switch (status) {
        case 401:
          throw new Error("API密钥无效，请检查您的配置");
        case 429:
          throw new Error("请求过于频繁，请稍后再试");
        case 500:
          throw new Error("服务器内部错误，请稍后再试");
        default:
          throw new Error(`API错误 (${status}): ${message}`);
      }
    } else if (error.request) {
      // 网络错误
      throw new Error("网络连接失败，请检查您的网络连接");
    } else {
      // 其他错误
      throw new Error(error.message || "发送消息时出现未知错误");
    }
  }
};

// 获取当前API配置
export const getApiConfig = () => {
  return { ...API_CONFIG };
};

// 更新API配置
export const updateApiConfig = (newConfig) => {
  API_CONFIG = { ...API_CONFIG, ...newConfig };
  saveConfigToStorage(API_CONFIG);
};

// 重置API配置为默认值
export const resetApiConfig = () => {
  API_CONFIG = { ...DEFAULT_CONFIG };
  saveConfigToStorage(API_CONFIG);
};

// 检查API配置是否完整
export const isApiConfigured = () => {
  return !!(API_CONFIG.baseURL && API_CONFIG.apiKey && API_CONFIG.model);
};

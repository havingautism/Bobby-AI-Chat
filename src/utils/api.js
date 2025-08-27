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

// 流式输出支持
export const sendMessageStream = async (messages, options = {}, onChunk = null, onComplete = null, onError = null) => {
  try {
    // 检查API密钥是否配置
    if (!API_CONFIG.apiKey) {
      throw new Error("请先在设置中配置 API 密钥");
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

    // 检查是否为推理模型（支持DeepSeek-R1和Qwen/QwQ系列）
    const isReasoningModel = API_CONFIG.model?.includes('R1') || 
                            API_CONFIG.model?.includes('r1') ||
                            API_CONFIG.model?.includes('QwQ') ||
                            API_CONFIG.model?.includes('qwq');
    
    // 构建请求体
    const requestBody = {
      model: API_CONFIG.model,
      messages: apiMessages,
      temperature: options.temperature !== undefined ? options.temperature : API_CONFIG.temperature || 0.7,
      max_tokens: API_CONFIG.maxTokens || 2000,
      stream: true, // 启用流式输出
      "thinking_budget": 4096,
    };

    // 推理模型可能需要的额外参数
    if (isReasoningModel) {
      requestBody.max_tokens = Math.max(requestBody.max_tokens, 4000);
      if (requestBody.temperature > 0.3) {
        requestBody.temperature = 0.3;
      }
      requestBody.top_p = 0.8;
    }

    console.log('API Request (Stream):', {
      model: API_CONFIG.model,
      isReasoningModel,
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      stream: true
    });

    // 发送流式请求
    const response = await fetch(API_CONFIG.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;
      const message = errorData?.error?.message || response.statusText;

      // 特殊处理推理模型相关错误
      if (API_CONFIG.model?.includes('R1') || API_CONFIG.model?.includes('r1') ||
          API_CONFIG.model?.includes('QwQ') || API_CONFIG.model?.includes('qwq')) {
        if (status === 400 && (message?.includes('model') || message?.includes('不支持'))) {
          throw new Error(`推理模型 ${API_CONFIG.model} 可能不被硅基流动平台支持，请尝试使用 Qwen/QwQ-32B 或 deepseek-ai/DeepSeek-R1`);
        }
      }

      switch (status) {
        case 400:
          throw new Error(`请求参数错误: ${message}. 请检查模型名称是否正确`);
        case 401:
          throw new Error("API密钥无效，请检查您的配置");
        case 404:
          throw new Error(`模型 ${API_CONFIG.model} 不存在或不可用，请检查模型名称`);
        case 429:
          throw new Error("请求过于频繁，请稍后再试");
        case 500:
          throw new Error("服务器内部错误，请稍后再试");
        default:
          throw new Error(`API错误 (${status}): ${message}`);
      }
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    let hasReasoning = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留最后一行（可能不完整）

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              // 流结束
              if (onComplete) {
                const result = {
                  content: fullContent,
                  hasReasoning,
                };
                if (hasReasoning) {
                  result.reasoning = fullReasoning;
                }
                onComplete(result);
              }
              return {
                content: fullContent,
                reasoning: hasReasoning ? fullReasoning : undefined,
                hasReasoning,
              };
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]) {
                const choice = parsed.choices[0];
                const delta = choice.delta;
                
                if (delta.content) {
                  fullContent += delta.content;
                  if (onChunk) {
                    onChunk({
                      type: 'content',
                      content: delta.content,
                      fullContent,
                    });
                  }
                }
                
                // 检查推理过程（根据硅基流动API文档，字段名为reasoning_content）
                if (delta.reasoning_content || delta.reasoning) {
                  const reasoning = delta.reasoning_content || delta.reasoning;
                  fullReasoning += reasoning;
                  hasReasoning = true;
                  if (onChunk) {
                    onChunk({
                      type: 'reasoning',
                      content: reasoning,
                      fullReasoning,
                    });
                  }
                }
              }
            } catch (e) {
              // 忽略解析错误
              console.warn('解析流数据失败:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 返回最终结果
    const result = {
      content: fullContent,
      hasReasoning,
    };
    if (hasReasoning) {
      result.reasoning = fullReasoning;
    }
    return result;
    
  } catch (error) {
    console.error("API流式调用失败:", error);
    
    if (onError) {
      onError(error);
    }
    
    if (error.name === 'AbortError') {
      throw new Error('请求已取消');
    }
    
    // 网络错误 - 特别处理推理模型
    const isReasoningModel = API_CONFIG.model?.includes('R1') || API_CONFIG.model?.includes('r1') ||
                            API_CONFIG.model?.includes('QwQ') || API_CONFIG.model?.includes('qwq');
    if (isReasoningModel && !error.response) {
      throw new Error("推理模型流式连接失败。可能原因：1)推理模型需要更长处理时间 2)模型参数不兼容 3)平台不支持该推理模型。建议尝试非推理模型或检查模型名称。");
    } else if (!error.response) {
      throw new Error("流式连接失败，请检查您的网络连接");
    }
    
    throw error;
  }
};

// 保留原有的非流式接口
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

    // 检查是否为推理模型
    const isReasoningModel = API_CONFIG.model?.includes('R1') || API_CONFIG.model?.includes('r1');
    
    // 构建请求体
    const requestBody = {
      model: API_CONFIG.model,
      messages: apiMessages,
      temperature: temperature,
      max_tokens: API_CONFIG.maxTokens || 2000,
      stream: false
    };

    // 推理模型可能需要的额外参数
    if (isReasoningModel) {
      // 推理模型通常需要更多tokens和时间
      requestBody.max_tokens = Math.max(requestBody.max_tokens, 4000);
      
      // 一些平台可能需要的特殊参数
      // requestBody.reasoning = true; // 某些平台可能需要
      // requestBody.response_format = { type: "text" }; // 确保文本格式
      
      // 推理模型可能需要的参数优化
      if (requestBody.temperature > 0.3) {
        requestBody.temperature = 0.3; // 推理模型通常使用较低的温度
      }
      
      // 一些推理模型可能需要top_p参数
      requestBody.top_p = 0.8;
      requestBody.thinking_budget=4096;
    }

    console.log('API Request (Non-Stream):', {
      model: API_CONFIG.model,
      isReasoningModel,
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      timeout: isReasoningModel ? 60000 : 30000
    });

    const response = await axios.post(
      API_CONFIG.baseURL,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${API_CONFIG.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: isReasoningModel ? 60000 : 30000, // 推理模型使用更长超时
      }
    );

    // 解析响应
    if (response.data && response.data.choices && response.data.choices[0]) {
      const choice = response.data.choices[0];
      const content = choice.message.content;

      // 检查是否有推理过程（根据硅基流动API文档，字段名为reasoning_content）
      const reasoning = choice.message.reasoning_content || choice.message.reasoning;

      // 调试日志
      console.log('API Response:', {
        model: API_CONFIG.model,
        hasReasoning: !!reasoning,
        contentLength: content?.length || 0,
        reasoningLength: reasoning?.length || 0,
        responseFields: Object.keys(choice.message)
      });

      // 如果有推理过程，返回包含推理过程的对象
      if (reasoning) {
        return {
          content: content,
          reasoning: reasoning,
          hasReasoning: true,
        };
      }

      // 否则返回普通内容
      return content;
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
      // const errorCode = error.response.data?.error?.code;

      // 特殊处理推理模型相关错误
      if (API_CONFIG.model?.includes('R1') || API_CONFIG.model?.includes('r1') ||
          API_CONFIG.model?.includes('QwQ') || API_CONFIG.model?.includes('qwq')) {
        if (status === 400 && (message?.includes('model') || message?.includes('不支持'))) {
          throw new Error(`推理模型 ${API_CONFIG.model} 可能不被硅基流动平台支持，请尝试使用 Qwen/QwQ-32B 或 deepseek-ai/DeepSeek-R1`);
        }
      }

      switch (status) {
        case 400:
          throw new Error(`请求参数错误: ${message}. 请检查模型名称是否正确`);
        case 401:
          throw new Error("API密钥无效，请检查您的配置");
        case 404:
          throw new Error(`模型 ${API_CONFIG.model} 不存在或不可用，请检查模型名称`);
        case 429:
          throw new Error("请求过于频繁，请稍后再试");
        case 500:
          throw new Error("服务器内部错误，请稍后再试");
        default:
          throw new Error(`API错误 (${status}): ${message}`);
      }
    } else if (error.request) {
      // 网络错误 - 特别处理推理模型
      const isReasoningModel = API_CONFIG.model?.includes('R1') || API_CONFIG.model?.includes('r1');
      if (isReasoningModel) {
        throw new Error("推理模型网络连接失败。可能原因：1)推理模型需要更长处理时间 2)模型参数不兼容 3)平台不支持该推理模型。建议尝试非推理模型或检查模型名称。");
      } else {
        throw new Error("网络连接失败，请检查您的网络连接");
      }
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

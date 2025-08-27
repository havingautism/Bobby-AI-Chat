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
export const sendMessageStream = async (messages, options = {}, onChunk = null, onComplete = null, onError = null, abortController = null) => {
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
      signal: abortController?.signal,
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

// 清理markdown格式的函数
const cleanMarkdown = (text) => {
  if (!text) return text;
  
  return text
    // 移除markdown标题 (# ## ###)
    .replace(/^#{1,6}\s*/gm, '')
    // 移除粗体 (**text** 或 __text__)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // 移除斜体 (*text* 或 _text_)
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // 移除代码块 (`code` 或 ```code```)
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
    // 移除链接 [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 移除图片 ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 移除引用 >
    .replace(/^>\s*/gm, '')
    // 移除列表标记 - * +
    .replace(/^[\s]*[-*+]\s*/gm, '')
    // 移除数字列表 1. 2. 3.
    .replace(/^[\s]*\d+\.\s*/gm, '')
    // 移除多余的空白字符
    .replace(/\s+/g, ' ')
    .trim();
};

// 流式生成对话标题
export const generateChatTitleStream = async (messages, onChunk = null, onComplete = null, onError = null) => {
  try {
    console.log("generateChatTitleStream 被调用，消息数量:", messages.length);
    
    if (!API_CONFIG.apiKey) {
      throw new Error("请先在设置中配置API密钥");
    }

    // 获取前几条消息用于生成标题
    const relevantMessages = messages.slice(0, 2).map((msg) => ({
      role: msg.role,
      content: msg.content.length > 100 ? msg.content.substring(0, 100) + "..." : msg.content,
    }));

    console.log("用于生成标题的消息:", relevantMessages);

    const titlePrompt = {
      role: "system",
      content: "根据对话生成简洁标题，不超过20字，直接输出标题内容：",
    };

    console.log("发送流式标题生成请求...");
    
    const response = await fetch(API_CONFIG.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: [titlePrompt, ...relevantMessages],
        temperature: 0.1,
        max_tokens: 30,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let fullTitle = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              if (onComplete) {
                const cleanTitle = cleanMarkdown(fullTitle.trim());
                onComplete(cleanTitle);
              }
              return cleanMarkdown(fullTitle.trim());
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                const content = parsed.choices[0].delta.content;
                if (content) {
                  fullTitle += content;
                  if (onChunk) {
                    onChunk(fullTitle);
                  }
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const cleanTitle = cleanMarkdown(fullTitle.trim());
    return cleanTitle;
    
  } catch (error) {
    console.error("流式标题生成失败:", error);
    if (onError) {
      onError(error);
    }
    throw error;
  }
};

// 生成对话标题（保留非流式版本作为备用）
export const generateChatTitle = async (messages) => {
  try {
    console.log("generateChatTitle 被调用，消息数量:", messages.length);
    
    if (!API_CONFIG.apiKey) {
      throw new Error("请先在设置中配置API密钥");
    }

    // 直接使用用户的第一条消息作为标题
    const firstUserMessage = messages.find(msg => msg.role === "user");
    if (firstUserMessage) {
      console.log("使用用户消息作为标题:", firstUserMessage.content);
      return firstUserMessage.content; // 不截断，保留完整内容
    }
    
    return "新对话";
  } catch (error) {
    console.error("生成标题失败:", error);
    return "新对话";
  }
};

// 旧的API调用版本（已废弃，保留以防需要）
export const generateChatTitleOld = async (messages) => {
  try {
    console.log("generateChatTitle 被调用，消息数量:", messages.length);
    
    if (!API_CONFIG.apiKey) {
      throw new Error("请先在设置中配置API密钥");
    }

    // 获取前几条消息用于生成标题
    const relevantMessages = messages.slice(0, 4).map((msg) => ({
      role: msg.role,
      content: msg.content.length > 200 ? msg.content.substring(0, 200) + "..." : msg.content,
    }));

    console.log("用于生成标题的消息:", relevantMessages);

    const titlePrompt = {
      role: "system",
      content: "你是一个专门生成对话标题的助手。请根据以下对话内容，生成一个简洁明了的中文标题，不超过15个字符。直接返回标题，不要添加引号、解释或其他内容。",
    };

    console.log("发送标题生成请求...");
    
    // 添加一个示例来帮助模型理解任务
    const exampleMessages = [
      titlePrompt,
      { role: "user", content: "我想学习JavaScript编程" },
      { role: "assistant", content: "好的，我来帮你学习JavaScript..." },
      { role: "user", content: "为上面的对话生成标题" },
      { role: "assistant", content: "JavaScript学习" },
      { role: "user", content: "现在请为以下对话生成标题：" }
    ];
    
    const response = await axios.post(
      API_CONFIG.baseURL,
      {
        model: API_CONFIG.model,
        messages: [...exampleMessages, ...relevantMessages],
        temperature: 0.1,
        max_tokens: 20,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${API_CONFIG.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("标题生成API响应:", response.data);
    console.log("响应结构检查:", {
      hasData: !!response.data,
      hasChoices: !!(response.data && response.data.choices),
      choicesLength: response.data?.choices?.length,
      firstChoice: response.data?.choices?.[0],
      hasMessage: !!(response.data?.choices?.[0]?.message),
      messageContent: response.data?.choices?.[0]?.message?.content
    });

    if (response.data && response.data.choices && response.data.choices[0]) {
      const choice = response.data.choices[0];
      console.log("第一个选择:", choice);
      
      if (choice.message && typeof choice.message.content === 'string') {
        const title = choice.message.content.trim();
        console.log("原始标题:", `"${title}"`);
        console.log("标题长度:", title.length);
        
        if (!title) {
          console.warn("API返回了空标题");
          // 如果API返回空标题，使用第一条用户消息作为标题
          const firstUserMessage = messages.find(msg => msg.role === "user");
          if (firstUserMessage) {
            const fallbackTitle = firstUserMessage.content.slice(0, 20) + (firstUserMessage.content.length > 20 ? "..." : "");
            console.log("使用备用标题:", fallbackTitle);
            return fallbackTitle;
          }
          return "新对话";
        }
        
        // 清理标题，移除markdown格式、引号和多余的标点
        let cleanTitle = cleanMarkdown(title);
        cleanTitle = cleanTitle.replace(/^["']|["']$/g, "").substring(0, 30);
        console.log("清理后的标题:", `"${cleanTitle}"`);
        return cleanTitle;
      } else {
        console.error("消息内容格式错误:", choice.message);
        throw new Error("API响应中的消息内容格式不正确");
      }
    } else {
      console.error("API响应格式不正确，缺少必要字段");
      throw new Error("API响应格式不正确");
    }
  } catch (error) {
    console.error("生成标题失败:", error);
    // 如果生成失败，返回基于第一条消息的简单标题
    if (messages.length > 0) {
      const firstMessage = messages.find(msg => msg.role === "user");
      if (firstMessage) {
        return firstMessage.content.slice(0, 20) + (firstMessage.content.length > 20 ? "..." : "");
      }
    }
    return "新对话";
  }
};
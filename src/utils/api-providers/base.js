// 基础API提供者类
export class BaseApiProvider {
  constructor(config = {}) {
    this.config = {
      baseURL: '',
      apiKey: '',
      model: '',
      temperature: 0.7,
      maxTokens: 2000,
      ...config
    };
  }

  // 验证配置
  validateConfig() {
    if (!this.config.apiKey) {
      throw new Error("API密钥未配置");
    }
    if (!this.config.baseURL) {
      throw new Error("API基础URL未配置");
    }
    if (!this.config.model) {
      throw new Error("模型未配置");
    }
  }

  // 转换消息格式（子类可重写）
  transformMessages(messages, options = {}) {
    return messages.map((msg) => {
      if (msg.role === "user" && msg.uploadedFile && msg.uploadedFile.type && msg.uploadedFile.type.startsWith('image/')) {
        // 多模态消息处理
        return this.transformMultimodalMessage(msg);
      } else {
        // 普通文本消息
        return {
          role: msg.role,
          content: msg.content,
        };
      }
    });
  }

  // 转换多模态消息（子类可重写）
  transformMultimodalMessage(msg) {
    const content = [];
    
    // 添加图片
    if (msg.content.includes('data:image')) {
      const imageData = msg.content.split('\n').find(line => line.startsWith('data:image'));
      if (imageData) {
        content.push({
          type: "image_url",
          image_url: {
            url: imageData
          }
        });
      }
    }
    
    // 添加文本（排除base64数据）
    const textContent = msg.content.split('\n').filter(line => !line.startsWith('data:image')).join('\n').trim();
    if (textContent) {
      content.push({
        type: "text",
        text: textContent
      });
    }
    
    return {
      role: msg.role,
      content: content
    };
  }

  // 构建请求体（子类可重写）
  buildRequestBody(messages, options = {}) {
    const modelToUse = options.model || this.config.model;
    const temperature = options.temperature !== undefined ? options.temperature : this.config.temperature;
    
    return {
      model: modelToUse,
      messages: messages,
      temperature: temperature,
      max_tokens: this.config.maxTokens,
      stream: options.stream || false,
    };
  }

  // 处理模型特定参数（子类可重写）
  processModelSpecificParams(requestBody, options = {}) {
    const modelToUse = requestBody.model;
    
    // 检查是否为推理模型
    const isReasoningModel = this.isReasoningModel(modelToUse);
    const isMultimodalModel = this.isMultimodalModel(modelToUse);
    
    if (isReasoningModel) {
      requestBody.max_tokens = Math.max(requestBody.max_tokens, 4000);
      if (requestBody.temperature > 0.3) {
        requestBody.temperature = 0.3;
      }
      requestBody.top_p = 0.8;
      requestBody.thinking_budget = 4096;
    }

    if (isMultimodalModel) {
      requestBody.max_tokens = Math.max(requestBody.max_tokens, 1024);
    }
    
    return requestBody;
  }

  // 检查是否为推理模型（子类可重写）
  isReasoningModel(modelName) {
    if (!modelName) return false;
    return modelName.includes('R1') || 
           modelName.includes('r1') ||
           modelName.includes('QwQ') ||
           modelName.includes('qwq');
  }

  // 检查是否为多模态模型（子类可重写）
  isMultimodalModel(modelName) {
    if (!modelName) return false;
    return modelName.includes('vl') || 
           modelName.includes('VL') ||
           modelName.includes('vision') ||
           modelName.includes('Vision');
  }

  // 构建请求头（子类可重写）
  buildHeaders() {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // 处理API错误（子类可重写）
  handleApiError(error, modelName) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.response.statusText;

      // 特殊处理推理模型相关错误
      if (this.isReasoningModel(modelName)) {
        if (status === 400 && (message?.includes('model') || message?.includes('不支持'))) {
          throw new Error(`推理模型 ${modelName} 可能不被当前平台支持，请尝试使用其他推理模型`);
        }
      }

      switch (status) {
        case 400:
          throw new Error(`请求参数错误: ${message}. 请检查模型名称是否正确`);
        case 401:
          throw new Error("API密钥无效，请检查您的配置");
        case 404:
          throw new Error(`模型 ${modelName} 不存在或不可用，请检查模型名称`);
        case 429:
          throw new Error("请求过于频繁，请稍后再试");
        case 500:
          throw new Error("服务器内部错误，请稍后再试");
        default:
          throw new Error(`API错误 (${status}): ${message}`);
      }
    } else if (error.request) {
      // 网络错误
      if (this.isReasoningModel(modelName)) {
        throw new Error("推理模型网络连接失败。可能原因：1)推理模型需要更长处理时间 2)模型参数不兼容 3)平台不支持该推理模型。建议尝试非推理模型或检查模型名称。");
      } else {
        throw new Error("网络连接失败，请检查您的网络连接");
      }
    } else {
      throw new Error(error.message || "发送消息时出现未知错误");
    }
  }

  // 解析流式响应（子类可重写）
  parseStreamResponse(data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.choices && parsed.choices[0]) {
        const choice = parsed.choices[0];
        const delta = choice.delta;
        
        const result = {};
        
        if (delta.content) {
          result.content = delta.content;
        }
        
        // 检查推理过程（不同平台可能使用不同字段名）
        if (delta.reasoning_content || delta.reasoning) {
          result.reasoning = delta.reasoning_content || delta.reasoning;
        }
        
        return result;
      }
    } catch (e) {
      console.warn('解析流数据失败:', e);
    }
    return null;
  }

  // 解析非流式响应（子类可重写）
  parseResponse(response) {
    if (response.data && response.data.choices && response.data.choices[0]) {
      const choice = response.data.choices[0];
      const content = choice.message.content;
      const reasoning = choice.message.reasoning_content || choice.message.reasoning;

      if (reasoning) {
        return {
          content: content,
          reasoning: reasoning,
          hasReasoning: true,
        };
      }

      return content;
    } else {
      throw new Error("API响应格式不正确");
    }
  }

  // 发送流式消息（抽象方法，子类必须实现）
  async sendMessageStream(messages, options = {}, onChunk = null, onComplete = null, onError = null, abortController = null) {
    throw new Error("sendMessageStream 方法必须在子类中实现");
  }

  // 发送非流式消息（抽象方法，子类必须实现）
  async sendMessage(messages, options = {}) {
    throw new Error("sendMessage 方法必须在子类中实现");
  }

  // 生成对话标题（抽象方法，子类必须实现）
  async generateChatTitle(messages, options = {}) {
    throw new Error("generateChatTitle 方法必须在子类中实现");
  }

  // 获取推荐的多模态模型（子类可重写）
  getRecommendedMultimodalModel() {
    return this.config.model;
  }

  // 获取多模态模型列表（子类可重写）
  getMultimodalModels() {
    return [];
  }
}

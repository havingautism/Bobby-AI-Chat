import { BaseApiProvider } from './base.js';
import axios from 'axios';

export class OpenAIProvider extends BaseApiProvider {
  constructor(config = {}) {
    super({
      baseURL: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o",
      ...config
    });
  }

  // OpenAI特定的多模态模型列表
  getMultimodalModels() {
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-vision-preview",
      "gpt-4-turbo"
    ];
  }

  // OpenAI推荐的多模态模型
  getRecommendedMultimodalModel() {
    return "gpt-4o";
  }

  // OpenAI特定的推理模型检查
  isReasoningModel(modelName) {
    if (!modelName) return false;
    // OpenAI目前没有专门的推理模型，但可以检查特定模型
    return modelName.includes('gpt-4') && modelName.includes('turbo');
  }

  // OpenAI特定的模型参数处理
  processModelSpecificParams(requestBody, options = {}) {
    const modelToUse = requestBody.model;
    
    // 检查是否为多模态模型
    const isMultimodalModel = this.isMultimodalModel(modelToUse);
    
    if (isMultimodalModel) {
      requestBody.max_tokens = Math.max(requestBody.max_tokens, 1024);
    }
    
    // OpenAI特定参数
    if (modelToUse.includes('gpt-4')) {
      // 保持用户设置的top_p值，如果没有设置则使用默认值1
      if (requestBody.top_p === undefined) {
        requestBody.top_p = 1;
      }
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
    }
    
    return requestBody;
  }

  // OpenAI特定的错误处理
  handleApiError(error, modelName) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.response.statusText;

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
      throw new Error("网络连接失败，请检查您的网络连接");
    } else {
      throw new Error(error.message || "发送消息时出现未知错误");
    }
  }

  // OpenAI流式消息发送
  async sendMessageStream(messages, options = {}, onChunk = null, onComplete = null, onError = null, abortController = null) {
    try {
      this.validateConfig();

      // 转换消息格式
      let apiMessages = this.transformMessages(messages, options);

      // 如果有系统提示词，添加到消息开头
      if (options.systemPrompt) {
        apiMessages.unshift({
          role: "system",
          content: options.systemPrompt,
        });
      }

      // 构建请求体
      let requestBody = this.buildRequestBody(apiMessages, { ...options, stream: true });
      requestBody = this.processModelSpecificParams(requestBody, options);

      console.log('OpenAI API请求 (Stream):', {
        model: requestBody.model,
        isMultimodalModel: this.isMultimodalModel(requestBody.model),
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        stream: true
      });

      // 发送流式请求
      const response = await fetch(this.config.baseURL, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = {
          response: {
            status: response.status,
            data: errorData,
            statusText: response.statusText
          }
        };
        this.handleApiError(error, requestBody.model);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let buffer = '';
      let fullContent = '';

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
                // 流结束
                if (onComplete) {
                  onComplete({ content: fullContent });
                }
                return { content: fullContent };
              }

              const parsed = this.parseStreamResponse(data);
              if (parsed && parsed.content) {
                fullContent += parsed.content;
                if (onChunk) {
                  onChunk({
                    type: 'content',
                    content: parsed.content,
                    fullContent,
                  });
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { content: fullContent };
      
    } catch (error) {
      console.error("OpenAI API流式调用失败:", error);
      
      if (onError) {
        onError(error);
      }
      
      if (error.name === 'AbortError') {
        throw new Error('请求已取消');
      }
      
      throw error;
    }
  }

  // OpenAI非流式消息发送
  async sendMessage(messages, options = {}) {
    try {
      this.validateConfig();

      // 转换消息格式
      let apiMessages = this.transformMessages(messages, options);

      // 如果有系统提示词，添加到消息开头
      if (options.systemPrompt) {
        apiMessages.unshift({
          role: "system",
          content: options.systemPrompt,
        });
      }

      // 构建请求体
      let requestBody = this.buildRequestBody(apiMessages, { ...options, stream: false });
      requestBody = this.processModelSpecificParams(requestBody, options);

      console.log('OpenAI API请求 (Non-Stream):', {
        model: requestBody.model,
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature
      });

      const response = await axios.post(
        this.config.baseURL,
        requestBody,
        {
          headers: this.buildHeaders(),
          timeout: 30000,
        }
      );

      return this.parseResponse(response);

    } catch (error) {
      console.error("OpenAI API调用失败:", error);
      this.handleApiError(error, options.model || this.config.model);
    }
  }

  // OpenAI对话标题生成
  async generateChatTitle(messages, options = {}) {
    try {
      this.validateConfig();

      // 获取前几条消息用于生成标题
      const relevantMessages = messages.slice(0, 2).map((msg) => ({
        role: msg.role,
        content: msg.content.length > 100 ? msg.content.substring(0, 100) + "..." : msg.content,
      }));

      const titlePrompt = {
        role: "system",
        content: "You are a professional title generation assistant. Please generate a concise Chinese title based on the user's question. Requirements: 1. No more than 15 characters 2. Summarize the core content 3. Output the title directly without quotes or other formatting 4. Don't say unnecessary words like 'based on the conversation'",
      };

      const titleMessages = [
        titlePrompt,
        ...relevantMessages,
        { role: "user", content: "Please generate a concise title for the above conversation" }
      ];

      const requestBody = {
        model: this.config.model,
        messages: titleMessages,
        temperature: 0.3,
        max_tokens: 200,
        stream: false,
      };

      const response = await axios.post(
        this.config.baseURL,
        requestBody,
        {
          headers: this.buildHeaders(),
          timeout: 15000,
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const title = response.data.choices[0].message.content.trim();
        let finalTitle = this.cleanMarkdown(title);
        
        // 如果API返回空标题，尝试从用户消息中提取关键词
        if (!finalTitle) {
          const userMessage = relevantMessages.find(msg => msg.role === "user");
          if (userMessage) {
            // 过滤掉base64图片数据，只保留纯文本内容
            const textContent = userMessage.content.replace(/data:image\/[^;]+;base64,[^\s]+/g, '').trim();
            if (textContent) {
              finalTitle = textContent.slice(0, 20).trim();
              if (textContent.length > 20) {
                finalTitle += "...";
              }
            }
          }
        }
        
        return finalTitle || "新对话";
      }
      
      return "新对话";
      
    } catch (error) {
      console.error("OpenAI标题生成失败:", error);
      // 如果生成失败，返回基于第一条消息的简单标题，但过滤掉图片数据
      if (messages.length > 0) {
        const firstMessage = messages.find(msg => msg.role === "user");
        if (firstMessage) {
          // 过滤掉base64图片数据，只保留纯文本内容
          const textContent = firstMessage.content.replace(/data:image\/[^;]+;base64,[^\s]+/g, '').trim();
          if (textContent) {
            return textContent.slice(0, 20) + (textContent.length > 20 ? "..." : "");
          }
        }
      }
      return "新对话";
    }
  }

  // 清理markdown格式
  cleanMarkdown(text) {
    if (!text) return text;
    
    return text
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/^>\s*/gm, '')
      .replace(/^[\s]*[-*+]\s*/gm, '')
      .replace(/^[\s]*\d+\.\s*/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

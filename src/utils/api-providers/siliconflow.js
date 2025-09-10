import { BaseApiProvider } from './base.js';
import axios from 'axios';
import { knowledgeBaseManager } from "../knowledgeBaseQdrant.js";

export class SiliconFlowProvider extends BaseApiProvider {
  constructor(config = {}) {
    super({
      baseURL: "https://api.siliconflow.cn/v1/chat/completions",
      model: "deepseek-ai/DeepSeek-V3.1",
      ...config
    });
  }

  // 硅基流动特定的多模态模型列表
  getMultimodalModels() {
    return [
      "deepseek-ai/deepseek-vl2",
      "deepseek-ai/deepseek-vl",
      "qwen/Qwen-VL-Chat",
      "qwen/Qwen-VL-Plus",
      "qwen/Qwen-VL-Max"
    ];
  }

  // 硅基流动推荐的多模态模型
  getRecommendedMultimodalModel() {
    return "deepseek-ai/deepseek-vl2";
  }

  // 硅基流动特定的推理模型检查
  isReasoningModel(modelName) {
    if (!modelName) return false;
    return modelName.includes('R1') || 
           modelName.includes('r1') ||
           modelName.includes('QwQ') ||
           modelName.includes('qwq');
  }

  // 硅基流动特定的模型参数处理
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
      // 推理模型使用更保守的top_p值
      if (requestBody.top_p > 0.8) {
        requestBody.top_p = 0.8;
      }
      requestBody.thinking_budget = 4096;
    }

    if (isMultimodalModel) {
      requestBody.max_tokens = Math.max(requestBody.max_tokens, 1024);
    }
    
    return requestBody;
  }

  // 硅基流动特定的错误处理
  handleApiError(error, modelName) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.response.statusText;

      // 特殊处理推理模型相关错误
      if (this.isReasoningModel(modelName)) {
        if (status === 400 && (message?.includes('model') || message?.includes('不支持'))) {
          throw new Error(`推理模型 ${modelName} 可能不被硅基流动平台支持，请尝试使用 Qwen/QwQ-32B 或 deepseek-ai/DeepSeek-R1`);
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
      // 网络错误 - 特别处理推理模型
      if (this.isReasoningModel(modelName)) {
        throw new Error("推理模型流式连接失败。可能原因：1)推理模型需要更长处理时间 2)模型参数不兼容 3)平台不支持该推理模型。建议尝试非推理模型或检查模型名称。");
      } else {
        throw new Error("流式连接失败，请检查您的网络连接");
      }
    } else {
      throw new Error(error.message || "发送消息时出现未知错误");
    }
  }

  // 硅基流动流式消息发送
  async sendMessageStream(messages, options = {}, onChunk = null, onComplete = null, onError = null, abortController = null) {
    try {
      this.validateConfig();

      // 转换消息格式
      let apiMessages = this.transformMessages(messages, options);

      // 处理知识库搜索
      let knowledgeContext = "";
      if (options.selectedDocuments && options.selectedDocuments.length > 0) {
        try {
          // 使用知识库管理器进行搜索
          await knowledgeBaseManager.initialize();
          const userMessage = messages[messages.length - 1];
          
          console.log(`🔍 搜索选中的文档:`, options.selectedDocuments);
          console.log(`🔍 用户问题:`, userMessage.content);
          
          const searchResults = await knowledgeBaseManager.searchDocuments(
            userMessage.content,
            20, // 增加搜索结果数量以获得更多选择
            0.01,
            true
          );
          
          console.log(`🔍 搜索结果总数:`, searchResults.length);
          console.log(`🔍 搜索结果ID:`, searchResults.map(r => r.id));
          console.log(`🔍 搜索结果详情:`, searchResults.map(r => ({ 
            id: r.id, 
            title: r.title, 
            score: r.score,
            contentLength: r.content?.length || 0,
            contentPreview: r.content?.substring(0, 100) + (r.content?.length > 100 ? '...' : ''),
            sourceType: r.sourceType
          })));
          
                // 首先尝试过滤选中文档中的相关内容
          const filteredResults = searchResults.filter(result => {
            const isSelected = options.selectedDocuments.includes(result.id);
            console.log(`🔍 文档 "${result.title}" (ID: ${result.id}) 是否被选中: ${isSelected}`);
            return isSelected;
          });
          
          console.log(`🔍 选中文档中的相关结果数量:`, filteredResults.length);
          
          // 如果选中文档中有相关内容，优先使用这些内容
          if (filteredResults.length > 0) {
            // 按分数排序，取前5个
            const topResults = filteredResults
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .slice(0, 5);
            
            console.log(`🔍 使用选中文档中分数最高的 ${topResults.length} 个结果:`, topResults.map(d => ({ title: d.title, score: d.score })));
            knowledgeContext = "请根据以下多个知识库文档块来回答问题...\n\n";
            knowledgeContext += "<knowledge_base>\n";
            topResults.forEach((result, index) => {
              console.log(`🔍 添加文档 ${index + 1} 到上下文:`, {
                title: result.title,
                score: result.score,
                contentLength: result.content?.length || 0,
                contentPreview: result.content?.substring(0, 100) + (result.content?.length > 100 ? '...' : '')
              });
              knowledgeContext += `  <document index="${index + 1}" source="${result.title || 'Unknown'}">\n`;
              knowledgeContext += `    <content>\n`;
              knowledgeContext += `      ${result.content}\n`;
              knowledgeContext += `    </content>\n`;
              knowledgeContext += `  </document>\n\n`;
            });
            knowledgeContext += "</knowledge_base>\n\n";
          } else {
            // 如果选中文档中没有相关内容，使用所有搜索结果中分数最高的前5个
            console.log(`🔍 选中文档中未找到相关内容，使用全局搜索结果中分数最高的前5个`);
            const topResults = searchResults
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .slice(0, 5);
            
            console.log(`🔍 使用全局搜索结果中分数最高的 ${topResults.length} 个结果:`, topResults.map(d => ({ title: d.title, score: d.score })));
            knowledgeContext = "请根据以下多个知识库文档块来回答问题...\n\n";
            knowledgeContext += "<knowledge_base>\n";
            topResults.forEach((result, index) => {
              console.log(`🔍 添加文档 ${index + 1} 到上下文:`, {
                title: result.title,
                score: result.score,
                contentLength: result.content?.length || 0,
                contentPreview: result.content?.substring(0, 100) + (result.content?.length > 100 ? '...' : '')
              });
              knowledgeContext += `  <document index="${index + 1}" source="${result.title || 'Unknown'}">\n`;
              knowledgeContext += `    <content>\n`;
              knowledgeContext += `      ${result.content}\n`;
              knowledgeContext += `    </content>\n`;
              knowledgeContext += `  </document>\n\n`;
            });
            knowledgeContext += "</knowledge_base>\n\n";
          }
        } catch (error) {
          console.warn('知识库搜索失败:', error);
        }
      }

      // 如果有系统提示词，添加到消息开头
      if (options.systemPrompt) {
        apiMessages.unshift({
          role: "system",
          content: options.systemPrompt,
        });
      }

      // 如果有知识库上下文，添加到系统消息中
      if (knowledgeContext) {
        console.log(`🔍 添加知识库上下文到系统消息:`, knowledgeContext.substring(0, 200) + '...');
        if (apiMessages[0]?.role === "system") {
          apiMessages[0].content = knowledgeContext + "\n\n" + apiMessages[0].content;
        } else {
          apiMessages.unshift({
            role: "system",
            content: knowledgeContext,
          });
        }
      } else {
        console.log(`🔍 没有知识库上下文可添加`);
      }

      // 构建请求体
      let requestBody = this.buildRequestBody(apiMessages, { ...options, stream: true });
      requestBody = this.processModelSpecificParams(requestBody, options);

      console.log('硅基流动API请求 (Stream):', {
        model: requestBody.model,
        isReasoningModel: this.isReasoningModel(requestBody.model),
        isMultimodalModel: this.isMultimodalModel(requestBody.model),
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        stream: true,
        messagesCount: requestBody.messages?.length || 0,
        hasKnowledgeContext: !!knowledgeContext,
        systemMessageLength: requestBody.messages?.[0]?.content?.length || 0
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

              const parsed = this.parseStreamResponse(data);
              if (parsed) {
                if (parsed.content) {
                  fullContent += parsed.content;
                  if (onChunk) {
                    onChunk({
                      type: 'content',
                      content: parsed.content,
                      fullContent,
                    });
                  }
                }
                
                if (parsed.reasoning) {
                  fullReasoning += parsed.reasoning;
                  hasReasoning = true;
                  if (onChunk) {
                    onChunk({
                      type: 'reasoning',
                      content: parsed.reasoning,
                      fullReasoning,
                    });
                  }
                }
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
      console.error("硅基流动API流式调用失败:", error);
      
      if (onError) {
        onError(error);
      }
      
      if (error.name === 'AbortError') {
        throw new Error('请求已取消');
      }
      
      throw error;
    }
  }

  // 硅基流动非流式消息发送
  async sendMessage(messages, options = {}) {
    try {
      this.validateConfig();

      // 转换消息格式
      let apiMessages = this.transformMessages(messages, options);

      // 处理知识库搜索
      let knowledgeContext = "";
      if (options.selectedDocuments && options.selectedDocuments.length > 0) {
        try {
          // 使用知识库管理器进行搜索
          await knowledgeBaseManager.initialize();
          const userMessage = messages[messages.length - 1];
          
          console.log(`🔍 搜索选中的文档:`, options.selectedDocuments);
          console.log(`🔍 用户问题:`, userMessage.content);
          
          const searchResults = await knowledgeBaseManager.searchDocuments(
            userMessage.content,
            20, // 增加搜索结果数量以获得更多选择
            0.01,
            true
          );
          
          console.log(`🔍 搜索结果总数:`, searchResults.length);
          console.log(`🔍 搜索结果ID:`, searchResults.map(r => r.id));
          console.log(`🔍 搜索结果详情:`, searchResults.map(r => ({ 
            id: r.id, 
            title: r.title, 
            score: r.score,
            contentLength: r.content?.length || 0,
            contentPreview: r.content?.substring(0, 100) + (r.content?.length > 100 ? '...' : ''),
            sourceType: r.sourceType
          })));
          
                // 首先尝试过滤选中文档中的相关内容
          const filteredResults = searchResults.filter(result => {
            const isSelected = options.selectedDocuments.includes(result.id);
            console.log(`🔍 文档 "${result.title}" (ID: ${result.id}) 是否被选中: ${isSelected}`);
            return isSelected;
          });
          
          console.log(`🔍 选中文档中的相关结果数量:`, filteredResults.length);
          
          // 如果选中文档中有相关内容，优先使用这些内容
          if (filteredResults.length > 0) {
            // 按分数排序，取前5个
            const topResults = filteredResults
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .slice(0, 5);
            
            console.log(`🔍 使用选中文档中分数最高的 ${topResults.length} 个结果:`, topResults.map(d => ({ title: d.title, score: d.score })));
            knowledgeContext = "请根据以下多个知识库文档块来回答问题...\n\n";
            knowledgeContext += "<knowledge_base>\n";
            topResults.forEach((result, index) => {
              console.log(`🔍 添加文档 ${index + 1} 到上下文:`, {
                title: result.title,
                score: result.score,
                contentLength: result.content?.length || 0,
                contentPreview: result.content?.substring(0, 100) + (result.content?.length > 100 ? '...' : '')
              });
              knowledgeContext += `  <document index="${index + 1}" source="${result.title || 'Unknown'}">\n`;
              knowledgeContext += `    <content>\n`;
              knowledgeContext += `      ${result.content}\n`;
              knowledgeContext += `    </content>\n`;
              knowledgeContext += `  </document>\n\n`;
            });
            knowledgeContext += "</knowledge_base>\n\n";
          } else {
            // 如果选中文档中没有相关内容，使用所有搜索结果中分数最高的前5个
            console.log(`🔍 选中文档中未找到相关内容，使用全局搜索结果中分数最高的前5个`);
            const topResults = searchResults
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .slice(0, 5);
            
            console.log(`🔍 使用全局搜索结果中分数最高的 ${topResults.length} 个结果:`, topResults.map(d => ({ title: d.title, score: d.score })));
            knowledgeContext = "请根据以下多个知识库文档块来回答问题...\n\n";
            knowledgeContext += "<knowledge_base>\n";
            topResults.forEach((result, index) => {
              console.log(`🔍 添加文档 ${index + 1} 到上下文:`, {
                title: result.title,
                score: result.score,
                contentLength: result.content?.length || 0,
                contentPreview: result.content?.substring(0, 100) + (result.content?.length > 100 ? '...' : '')
              });
              knowledgeContext += `  <document index="${index + 1}" source="${result.title || 'Unknown'}">\n`;
              knowledgeContext += `    <content>\n`;
              knowledgeContext += `      ${result.content}\n`;
              knowledgeContext += `    </content>\n`;
              knowledgeContext += `  </document>\n\n`;
            });
            knowledgeContext += "</knowledge_base>\n\n";
          }
        } catch (error) {
          console.warn('知识库搜索失败:', error);
        }
      }

      // 如果有系统提示词，添加到消息开头
      if (options.systemPrompt) {
        apiMessages.unshift({
          role: "system",
          content: options.systemPrompt,
        });
      }

      // 如果有知识库上下文，添加到系统消息中
      if (knowledgeContext) {
        console.log(`🔍 添加知识库上下文到系统消息:`, knowledgeContext.substring(0, 200) + '...');
        if (apiMessages[0]?.role === "system") {
          apiMessages[0].content = knowledgeContext + "\n\n" + apiMessages[0].content;
        } else {
          apiMessages.unshift({
            role: "system",
            content: knowledgeContext,
          });
        }
      } else {
        console.log(`🔍 没有知识库上下文可添加`);
      }

      // 构建请求体
      let requestBody = this.buildRequestBody(apiMessages, { ...options, stream: false });
      requestBody = this.processModelSpecificParams(requestBody, options);

      console.log('硅基流动API请求 (Non-Stream):', {
        model: requestBody.model,
        isReasoningModel: this.isReasoningModel(requestBody.model),
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        timeout: this.isReasoningModel(requestBody.model) ? 60000 : 30000,
        messagesCount: requestBody.messages?.length || 0,
        hasKnowledgeContext: !!knowledgeContext,
        systemMessageLength: requestBody.messages?.[0]?.content?.length || 0
      });

      const response = await axios.post(
        this.config.baseURL,
        requestBody,
        {
          headers: this.buildHeaders(),
          timeout: this.isReasoningModel(requestBody.model) ? 60000 : 30000,
        }
      );

      return this.parseResponse(response);

    } catch (error) {
      console.error("硅基流动API调用失败:", error);
      this.handleApiError(error, options.model || this.config.model);
    }
  }

  // 硅基流动对话标题生成
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
        content: "你是一个专业的标题生成助手。请根据用户的问题生成一个简洁明了的中文标题，要求：1.不超过15个字 2.概括核心内容 3.直接输出标题，不要引号或其他格式 4.不要说根据对话等多余的话",
      };

      const titleMessages = [
        titlePrompt,
        ...relevantMessages,
        { role: "user", content: "请为上面的对话生成一个简洁的标题" }
      ];

      const requestBody = {
        model: this.config.model,
        messages: titleMessages,
        temperature: 0.3,
        max_tokens: 200,
        stream: true,
      };

      const response = await fetch(this.config.baseURL, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
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
                let finalTitle = this.cleanMarkdown(fullTitle.trim());
                
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

              const parsed = this.parseStreamResponse(data);
              if (parsed && parsed.content) {
                fullTitle += parsed.content;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      let finalTitle = this.cleanMarkdown(fullTitle.trim());
      
      // 如果没有收到有效标题，尝试从用户消息提取
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
      
    } catch (error) {
      console.error("硅基流动标题生成失败:", error);
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

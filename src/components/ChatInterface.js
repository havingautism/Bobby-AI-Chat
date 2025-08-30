import React, { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import WelcomeScreen from "./WelcomeScreen";
import ModelSelector from "./ModelSelector";
import { sendMessage, sendMessageStream, isApiConfigured, generateChatTitleStream } from "../utils/api";
import { getRoleById, loadSelectedRole } from "../utils/roles";


import "./ChatInterface.css";
//

const ChatInterface = ({
  conversation,
  onUpdateConversation,
  onToggleSidebar,
  onOpenSettings,
}) => {
  // 不再需要独立的加载状态管理
  // const [loadingConversations, setLoadingConversations] = useState(new Set());
  const [currentRole, setCurrentRole] = useState(() => loadSelectedRole());
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingConversationId, setStreamingConversationId] = useState(null);
  // const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [isTitleGenerating, setIsTitleGenerating] = useState(false);
  const [titleGeneratingId, setTitleGeneratingId] = useState(null);

  const messagesEndRef = useRef(null);
  
  // 停止流式输出
  const stopStreaming = () => {
    if (abortController) {
      abortController.abort();
      setIsStreaming(false);
      setStreamingConversationId(null);
      // setStreamingMessageId(null);
      setAbortController(null);
    }
  };

  // 不再需要独立的加载状态，使用流式输出的内联指示器
  // const isLoading = loadingConversations.has(conversation.id) || (isStreaming && streamingConversationId === conversation.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  // 监听角色变化
  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentRole(loadSelectedRole());
    };

    window.addEventListener("storage", handleStorageChange);
    // 也监听自定义事件，用于同一页面内的角色切换
    window.addEventListener("roleChanged", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("roleChanged", handleStorageChange);
    };
  }, []);



  const handleSendMessage = async (content, options = {}) => {
    if (!content.trim() || isStreaming) return;

    // 检查API是否配置
    if (!isApiConfigured()) {
      onOpenSettings();
      return;
    }

    // 保存当前对话ID，防止在异步操作过程中ID发生变化
    const currentConversationId = conversation.id;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
      options, // 保存模式和个性选择
    };

    // 添加用户消息
    const updatedMessages = [...conversation.messages, userMessage];
    const updates = {
      messages: updatedMessages,
      // 不在这里设置标题，让AI在回复后自动生成
    };

    // 如果是第一条消息且有角色信息，保存角色到对话中
    if (conversation.messages.length === 0 && options.role) {
      updates.role = options.role;
    }

    onUpdateConversation(currentConversationId, updates);

    // 使用流式输出，传递对话的模型信息
    await sendMessageWithStream(updatedMessages, { ...options, model: conversation.model }, currentConversationId);
  };

  // 流式消息发送
  const sendMessageWithStream = async (messages, options, conversationId) => {
    setIsStreaming(true);
    setStreamingConversationId(conversationId);
    
    // 创建 AbortController
    const controller = new AbortController();
    setAbortController(controller);
    
    // 创建初始的助手消息
    const assistantMessageId = (Date.now() + 1).toString();
    // setStreamingMessageId(assistantMessageId);
    
    const initialAssistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    
    // 立即添加空的助手消息
    onUpdateConversation(conversationId, {
      messages: [...messages, initialAssistantMessage],
    });
    
    try {
      let fullContent = "";
      let fullReasoning = "";
      let hasReasoning = false;
      
      await sendMessageStream(
        messages,
        options,
        // onChunk 回调
        (chunk) => {
          if (chunk.type === 'content') {
            fullContent = chunk.fullContent;
          } else if (chunk.type === 'reasoning') {
            fullReasoning = chunk.fullReasoning;
            hasReasoning = true;
          }
          
          // 更新流式消息内容
          const updatedMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: fullContent,
            reasoning: hasReasoning ? fullReasoning : undefined,
            hasReasoning,
            timestamp: new Date().toISOString(),
            isStreaming: true,
          };
          
          // 更新消息列表 - 查找并更新现有消息，避免重复添加
          const currentMessages = [...messages];
          const existingMessageIndex = currentMessages.findIndex(msg => msg.id === assistantMessageId);
          
          if (existingMessageIndex >= 0) {
            // 更新现有消息
            currentMessages[existingMessageIndex] = updatedMessage;
          } else {
            // 添加新消息（第一次）
            currentMessages.push(updatedMessage);
          }
          
          onUpdateConversation(conversationId, {
            messages: currentMessages,
          });
        },
        // onComplete 回调
        (result) => {
          const finalMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: result.content,
            reasoning: result.reasoning,
            hasReasoning: result.hasReasoning,
            timestamp: new Date().toISOString(),
            isStreaming: false,
          };
          
          const finalMessages = [...messages, finalMessage];
          
          // 最终更新消息
          onUpdateConversation(conversationId, {
            messages: finalMessages,
          });

          // 如果这是第一次对话（只有用户消息和AI回复），异步生成标题
          console.log("检查是否生成标题:", {
            finalMessagesLength: finalMessages.length,
            firstMessageRole: finalMessages[0]?.role,
            secondMessageRole: finalMessages[1]?.role,
            conversationId: conversationId,
            allMessages: finalMessages.map(m => ({ role: m.role, contentLength: m.content.length })),
            shouldGenerate: finalMessages.length === 2 && finalMessages[0].role === "user" && finalMessages[1].role === "assistant"
          });
          
          // 确保是用户消息+AI回复的第一次对话
          if (finalMessages.length === 2 && 
              finalMessages[0].role === "user" && 
              finalMessages[1].role === "assistant") {
            // 使用 setTimeout 来异步执行流式标题生成，不阻塞流式输出完成
            setTimeout(async () => {
              try {
                console.log("自动生成标题 - 开始...", { conversationId, finalMessages });
                
                // 设置标题生成状态
                setIsTitleGenerating(true);
                setTitleGeneratingId(conversationId);
                
                // 显示正在生成标题的状态
                onUpdateConversation(conversationId, {
                  title: "正在生成标题...",
                  isTitleGenerating: true,
                });

                // 使用流式生成标题，失败时自动回退到简单标题
                try {
                  await generateChatTitleStream(
                    finalMessages,
                    // onChunk - 实时更新标题
                    (partialTitle) => {
                      console.log("标题生成中:", partialTitle);
                      onUpdateConversation(conversationId, {
                        title: partialTitle || "正在生成标题...",
                        isTitleGenerating: true,
                      });
                    },
                    // onComplete - 完成生成
                    (finalTitle) => {
                      console.log("流式标题生成完成:", finalTitle);
                      setIsTitleGenerating(false);
                      setTitleGeneratingId(null);
                      onUpdateConversation(conversationId, {
                        title: finalTitle || finalMessages[0].content,
                        isTitleGenerating: false,
                      });
                    },
                    // onError - 生成失败时的处理
                    (error) => {
                      console.error("流式标题生成失败，尝试回退:", error);
                      // 不在这里处理，让外层catch处理
                    }
                  );
                } catch (error) {
                  console.error("流式标题生成完全失败，使用备用方案:", error);
                  setIsTitleGenerating(false);
                  setTitleGeneratingId(null);
                  // 使用用户的第一条消息作为标题
                  const userMessage = finalMessages.find(m => m.role === "user");
                  const fallbackTitle = userMessage?.content?.slice(0, 30) + 
                                      (userMessage?.content?.length > 30 ? "..." : "") || "新对话";
                  onUpdateConversation(conversationId, {
                    title: fallbackTitle,
                    isTitleGenerating: false,
                  });
                }
                
              } catch (error) {
                console.error("自动生成标题失败:", error);
                setIsTitleGenerating(false);
                setTitleGeneratingId(null);
                // 使用用户的第一条消息作为标题
                const fallbackTitle = finalMessages[0].content;
                onUpdateConversation(conversationId, {
                  title: fallbackTitle,
                  isTitleGenerating: false,
                });
              }
            }, 500); // 增加延迟，确保所有状态更新完成
          } else {
            console.log("不满足自动生成标题的条件");
          }
        },
        // onError 回调
        (error) => {
          console.error("流式发送消息失败:", error);
          
          const errorMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: `抱歉，发生了错误：${error.message}`,
            isError: true,
            timestamp: new Date().toISOString(),
            retryData: { messages, options, conversationId },
          };
          
          onUpdateConversation(conversationId, {
            messages: [...messages, errorMessage],
          });
        },
        controller
      );
      
    } catch (error) {
      console.error("流式发送消息失败:", error);
      
      const errorMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: `抱歉，发生了错误：${error.message}`,
        isError: true,
        timestamp: new Date().toISOString(),
        retryData: { messages, options, conversationId },
      };
      
      onUpdateConversation(conversationId, {
        messages: [...messages, errorMessage],
      });
    } finally {
      setIsStreaming(false);
      setStreamingConversationId(null);
      // setStreamingMessageId(null);
      setAbortController(null);
    }
  };
  
  // 带重试功能的消息发送（保留非流式版本作为备用）
  // eslint-disable-next-line no-unused-vars
  const sendMessageWithRetry = async (messages, options, conversationId) => {
    // 不再需要设置加载状态，使用流式输出的内联指示器
    // setLoadingConversations((prev) => new Set([...prev, conversationId]));

    try {
      // 传递角色选项到API
      const response = await sendMessage(messages, options);

      // 处理响应，可能包含推理过程
      let assistantMessage;

      if (typeof response === "object" && response.hasReasoning) {
        // 包含推理过程的响应
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.content,
          reasoning: response.reasoning,
          hasReasoning: true,
          timestamp: new Date().toISOString(),
        };
      } else {
        // 普通响应
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: typeof response === "string" ? response : response.content,
          timestamp: new Date().toISOString(),
        };
      }

      // 确保只更新原始对话，即使用户已经切换到其他对话
      onUpdateConversation(conversationId, {
        messages: [...messages, assistantMessage],
      });
    } catch (error) {
      console.error("发送消息失败:", error);
      let errorContent = "抱歉，发送消息时出现错误。";

      if (error.message.includes("API密钥")) {
        errorContent += "请检查您的API配置。";
      } else if (error.message.includes("网络")) {
        errorContent += "请检查您的网络连接。";
      } else {
        errorContent += `错误信息：${error.message}`;
      }

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date().toISOString(),
        isError: true,
        retryData: {
          messages,
          options,
          conversationId,
        },
      };

      // 确保只更新原始对话，即使用户已经切换到其他对话
      onUpdateConversation(conversationId, {
        messages: [...messages, errorMessage],
      });
    } finally {
      // 不再需要移除加载状态
      // setLoadingConversations((prev) => {
      //   const newSet = new Set(prev);
      //   newSet.delete(conversationId);
      //   return newSet;
      // });
    }
  };

  // 重试失败的消息
  const handleRetryMessage = async (errorMessage) => {
    if (!errorMessage.retryData) return;

    const { messages, options, conversationId } = errorMessage.retryData;

    // 如果当前正在进行流式输出，不要中断
    if (isStreaming && streamingConversationId === conversationId) {
      console.log("正在进行流式输出，跳过重试");
      return;
    }

    // 移除错误消息
    const messagesWithoutError = conversation.messages.filter(
      (msg) => msg.id !== errorMessage.id
    );

    onUpdateConversation(conversationId, {
      messages: messagesWithoutError,
    });

    // 使用流式版本重新发送消息，而不是非流式版本，传递对话的模型信息
    await sendMessageWithStream(messages, { ...options, model: conversation.model }, conversationId);
  };

  // 重新生成消息
  const handleRegenerateMessage = async (assistantMessage) => {
    // 如果当前正在进行流式输出，不要中断
    if (isStreaming) {
      console.log("正在进行流式输出，跳过重新生成");
      return;
    }

    // 找到这条助手消息在对话中的位置
    const messageIndex = conversation.messages.findIndex(
      (msg) => msg.id === assistantMessage.id
    );

    if (messageIndex === -1) return;

    // 获取这条消息之前的所有消息（包括用户消息）
    const messagesBeforeAssistant = conversation.messages.slice(0, messageIndex);
    
    // 移除这条助手消息及其之后的所有消息
    const updatedMessages = messagesBeforeAssistant;

    onUpdateConversation(conversation.id, {
      messages: updatedMessages,
    });

    // 获取最后一条用户消息的选项
    const lastUserMessage = messagesBeforeAssistant
      .slice()
      .reverse()
      .find(msg => msg.role === "user");

    if (lastUserMessage) {
      // 重新生成回复，传递对话的模型信息
      await sendMessageWithStream(
        updatedMessages, 
        { ...lastUserMessage.options, model: conversation.model }, 
        conversation.id
      );
    }
  };

  // 如果没有消息，显示欢迎界面
  if (conversation.messages.length === 0) {
    return (
      <div className="chat-interface">
        <div className="chat-header">
          <div className="header-left">
            <button className="sidebar-toggle" onClick={onToggleSidebar}>
              ☰
            </button>
          </div>
                  <div className="header-actions">
        </div>
        </div>
        <WelcomeScreen onSendMessage={handleSendMessage} disabled={isStreaming} />
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={onToggleSidebar}>
            ☰
          </button>
          <div className="conversation-header">
            <h1 className="conversation-title">
              {conversation.title || "新对话"}
            </h1>
            <button 
              className="logo-button"
              style={{ color: getRoleById(currentRole).color, display:'none' }}
              title={getRoleById(currentRole).name}
            >
              {getRoleById(currentRole).avatar}
            </button>
          </div>
        </div>
        <div className="header-actions">
          <ModelSelector
            currentModel={conversation.model || "deepseek-ai/DeepSeek-V3.1"}
            onModelChange={(model) => {
              onUpdateConversation(conversation.id, { model });
            }}
            disabled={isStreaming && streamingConversationId === conversation.id}
            className="header-model-selector"
          />
        </div>
      </div>

      <div className="chat-messages">
        <MessageList
          messages={conversation.messages}
          onOpenSettings={onOpenSettings}
          conversationRole={conversation.role}
          onRetryMessage={handleRetryMessage}
          onRegenerateMessage={handleRegenerateMessage}
          isStreaming={isStreaming && streamingConversationId === conversation.id}
        />
        {/* 移除独立的加载指示器，使用流式输出的内联指示器 */}
        <div ref={messagesEndRef} />
      </div>

              <MessageInput 
          onSendMessage={handleSendMessage} 
          disabled={isStreaming && streamingConversationId === conversation.id}
          isStreaming={isStreaming && streamingConversationId === conversation.id}
          onStopStreaming={stopStreaming}
        />
    </div>
  );
};

export default ChatInterface;

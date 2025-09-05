import React, { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import WelcomeScreen from "./WelcomeScreen";
import ModelSelector from "./ModelSelector";
import ConversationTimeline from "./ConversationTimeline";
import { sendMessage, sendMessageStream, isApiConfigured, generateChatTitleStream, getApiConfig } from "../utils/api";
import { getRoleById, loadSelectedRole } from "../utils/roles";
import { getCurrentLanguage, t } from "../utils/language";
import { initMobileOptimizer } from "../utils/mobileOptimizer";

import "./ChatInterface.css";

// 标题生成函数，避免重复代码
const generateTitle = async (
  conversationId,
  finalMessages,
  setIsTitleGenerating,
  setTitleGeneratingId,
  onUpdateConversation
) => {
  // 检查是否满足自动生成标题的条件
  if (
    finalMessages.length === 2 &&
    finalMessages[0].role === "user" &&
    finalMessages[1].role === "assistant"
  ) {
    setTimeout(async () => {
      try {
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
              onUpdateConversation(conversationId, {
                title: partialTitle || "正在生成标题...",
                isTitleGenerating: true,
              });
            },
            // onComplete - 完成生成
            (finalTitle) => {
              setIsTitleGenerating(false);
              setTitleGeneratingId(null);
              onUpdateConversation(conversationId, {
                title: finalTitle || finalMessages[0].content,
                isTitleGenerating: false,
              });
            },
            // onError - 生成失败时的处理
            (error) => {
              // 不在这里处理，让外层catch处理
            }
          );
        } catch (error) {
          setIsTitleGenerating(false);
          setTitleGeneratingId(null);
          // 使用用户的第一条消息作为标题，但过滤掉图片数据
          const userMessage = finalMessages.find((m) => m.role === "user");
          let fallbackTitle = "新对话";
          if (userMessage?.content) {
            // 过滤掉base64图片数据，只保留纯文本内容
            const textContent = userMessage.content.replace(
              /data:image\/[^;]+;base64,[^\s]+/g,
              ""
            ).trim();
            if (textContent) {
              fallbackTitle =
                textContent.slice(0, 30) +
                (textContent.length > 30 ? "..." : "");
            }
          }
          onUpdateConversation(conversationId, {
            title: fallbackTitle,
            isTitleGenerating: false,
          });
        }
      } catch (error) {
        setIsTitleGenerating(false);
        setTitleGeneratingId(null);
        // 使用用户的第一条消息作为标题，但过滤掉图片数据
        let fallbackTitle = "新对话";
        if (finalMessages[0]?.content) {
          const textContent = finalMessages[0].content.replace(
            /data:image\/[^;]+;base64,[^\s]+/g,
            ""
          ).trim();
          if (textContent) {
            fallbackTitle =
              textContent.slice(0, 30) +
              (textContent.length > 30 ? "..." : "");
          }
        }
        onUpdateConversation(conversationId, {
          title: fallbackTitle,
          isTitleGenerating: false,
        });
      }
    }, 500); // 增加延迟，确保所有状态更新完成
  }
};

const ChatInterface = ({
  conversation,
  onUpdateConversation,
  onToggleSidebar,
  onOpenSettings,
}) => {
  const [responseMode, setResponseMode] = useState(conversation.responseMode || "normal");
  const [currentRole, setCurrentRole] = useState(() => loadSelectedRole());
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingConversationId, setStreamingConversationId] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [isTitleGenerating, setIsTitleGenerating] = useState(false);
  const [titleGeneratingId, setTitleGeneratingId] = useState(null);
  const [currentMessageId, setCurrentMessageId] = useState(null);

  const messagesEndRef = useRef(null);

  // 停止流式输出
  const stopStreaming = () => {
    if (abortController) {
      abortController.abort();
      setIsStreaming(false);
      setStreamingConversationId(null);
      setAbortController(null);
    }
  };

  // 处理响应模式变化
  const handleResponseModeChange = (newMode) => {
    setResponseMode(newMode);
    onUpdateConversation(conversation.id, { responseMode: newMode });
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // 移动端使用更流畅的滚动方式
      if (window.innerWidth <= 768) {
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
          // 使用scrollTo而不是scrollIntoView，在移动端更流畅
          chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
          });
        }
      } else {
        // PC端使用scrollIntoView
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // 处理跳转到指定消息
  const handleJumpToMessage = (messageId) => {
    setCurrentMessageId(messageId);
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        setCurrentMessageId(null);
      }, 3000);
    }
  };

  useEffect(() => {
    scrollToBottom();
    
    // 移动端滚动性能优化
    if (window.innerWidth <= 768) {
      const chatMessages = document.querySelector('.chat-messages');
      if (chatMessages) {
        // 使用requestAnimationFrame确保滚动优化在下一帧执行
        requestAnimationFrame(() => {
          chatMessages.style.willChange = 'scroll-position';
          // 滚动完成后移除will-change以节省性能
          setTimeout(() => {
            chatMessages.style.willChange = 'auto';
          }, 300);
        });
      }
    }
  }, [conversation.messages]);

  // 初始化移动端优化器
  useEffect(() => {
    const mobileOptimizer = initMobileOptimizer();
    const chatMessages = document.querySelector('.chat-messages');
    
    // 移动端滚动修复函数
    const fixMobileScrolling = () => {
      if (chatMessages) {
        chatMessages.classList.add('optimized-scrolling');
        // 确保滚动容器在移动端正常工作
        chatMessages.style.overflowY = 'auto';
        chatMessages.style.webkitOverflowScrolling = 'touch';
        chatMessages.style.touchAction = 'pan-y';
        chatMessages.style.overscrollBehaviorY = 'contain';
        chatMessages.style.overscrollBehaviorX = 'none';
        // 优化滚动性能
        chatMessages.style.willChange = 'scroll-position';
        chatMessages.style.transform = 'translateZ(0)';
        chatMessages.style.scrollBehavior = 'smooth';
        // 减少重绘
        chatMessages.style.contain = 'layout style paint';
        
        // 强制重新计算样式，确保滚动正常工作
        void chatMessages.offsetHeight;
      }
    };
    
    // 立即执行修复
    fixMobileScrolling();
    
    // 延迟执行，确保DOM完全加载
    const timeoutId = setTimeout(fixMobileScrolling, 100);
    
    return () => {
      clearTimeout(timeoutId);
      if (mobileOptimizer && mobileOptimizer.disable) {
        mobileOptimizer.disable();
      }
      if (chatMessages) {
        chatMessages.classList.remove('optimized-scrolling');
        // 清理内联样式
        chatMessages.style.overflowY = '';
        chatMessages.style.webkitOverflowScrolling = '';
        chatMessages.style.touchAction = '';
        chatMessages.style.overscrollBehaviorY = '';
        chatMessages.style.overscrollBehaviorX = '';
        chatMessages.style.willChange = '';
        chatMessages.style.transform = '';
        chatMessages.style.scrollBehavior = '';
        chatMessages.style.contain = '';
      }
    };
  }, []);

  // 同步会话的响应模式
  useEffect(() => {
    if (conversation.responseMode !== undefined) {
      setResponseMode(conversation.responseMode);
    }
  }, [conversation.responseMode]);

  // 监听角色变化
  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentRole(loadSelectedRole());
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("roleChanged", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("roleChanged", handleStorageChange);
    };
  }, []);

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChange = (event) => {
      setCurrentLanguage(event.detail);
    };
    window.addEventListener("languageChanged", handleLanguageChange);
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange);
    };
  }, []);

  const handleSendMessage = async (content, uploadedFile = null, options = {}) => {
    if ((!content.trim() && !uploadedFile) || isStreaming) return;

    if (!isApiConfigured()) {
      onOpenSettings();
      return;
    }

    const currentConversationId = conversation.id;

    let fileContent = "";
    let imageData = null;
    if (uploadedFile && uploadedFile.type) {
      if (uploadedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        imageData = await new Promise((resolve) => {
          reader.onload = (e) => {
            resolve(e.target.result);
          };
          reader.readAsDataURL(uploadedFile);
        });
      } else {
        const reader = new FileReader();
        fileContent = await new Promise((resolve) => {
          reader.onload = (e) => {
            resolve(`[文件: ${uploadedFile.name}]\n${e.target.result}`);
          };
          reader.readAsText(uploadedFile);
        });
      }
    }

    const fullContent = content.trim() + (fileContent ? `\n\n${fileContent}` : "") + (imageData ? `\n${imageData}` : "");

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: fullContent,
      timestamp: new Date().toISOString(),
      options: { ...options, responseMode },
      uploadedFile: uploadedFile
        ? {
            name: uploadedFile.name,
            type: uploadedFile.type,
            size: uploadedFile.size,
          }
        : null,
    };

    const updatedMessages = [...conversation.messages, userMessage];
    const updates = {
      messages: updatedMessages,
    };

    if (conversation.messages.length === 0) {
      if (options.role) {
        updates.role = options.role;
      }
      if (options.responseMode) {
        updates.responseMode = options.responseMode;
        setResponseMode(options.responseMode);
      }
    }

    onUpdateConversation(currentConversationId, updates);

    const apiConfig = getApiConfig();
    let modelToUse = conversation.model || apiConfig.model;

    if (conversation.messages.length === 0 && conversation.model !== apiConfig.model) {
      modelToUse = apiConfig.model;
      onUpdateConversation(currentConversationId, { model: apiConfig.model });
    }

    const roleToUse = conversation.role || currentRole;
    const roleInfo = getRoleById(roleToUse);
    const systemPrompt = roleInfo.systemPrompt;
    const roleTemperature = roleInfo.temperature;

    await sendMessageWithStream(
      updatedMessages,
      { ...options, model: modelToUse, systemPrompt, temperature: roleTemperature },
      currentConversationId
    );
  };

  // 流式消息发送
  const sendMessageWithStream = async (messages, options, conversationId) => {
    setIsStreaming(true);
    setStreamingConversationId(conversationId);

    const controller = new AbortController();
    setAbortController(controller);

    const assistantMessageId = (Date.now() + 1).toString();

    const initialAssistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    onUpdateConversation(conversationId, {
      messages: [...messages, initialAssistantMessage],
    });

    let finalMessages = [];
    try {
      let fullContent = "";
      let fullReasoning = "";
      let hasReasoning = false;

      await sendMessageStream(
        messages,
        options,
        // onChunk
        (chunk) => {
          if (chunk.type === "content") {
            fullContent = chunk.fullContent;
          } else if (chunk.type === "reasoning") {
            fullReasoning = chunk.fullReasoning;
            hasReasoning = true;
          }

          const updatedMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: fullContent,
            reasoning: hasReasoning ? fullReasoning : undefined,
            hasReasoning,
            timestamp: new Date().toISOString(),
            isStreaming: true,
          };

          const currentMessages = [...messages];
          const existingMessageIndex = currentMessages.findIndex(
            (msg) => msg.id === assistantMessageId
          );

          if (existingMessageIndex >= 0) {
            currentMessages[existingMessageIndex] = updatedMessage;
          } else {
            currentMessages.push(updatedMessage);
          }

          onUpdateConversation(conversationId, {
            messages: currentMessages,
          });
        },
        // onComplete
        (result) => {
          const finalMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: result.content,
            reasoning: result.hasReasoning ? result.reasoning : undefined,
            hasReasoning: result.hasReasoning,
            timestamp: new Date().toISOString(),
            isStreaming: false,
          };

          finalMessages = [...messages];
          const existingMessageIndex = finalMessages.findIndex(
            (msg) => msg.id === assistantMessageId
          );

          if (existingMessageIndex >= 0) {
            finalMessages[existingMessageIndex] = finalMessage;
          } else {
            finalMessages.push(finalMessage);
          }

          onUpdateConversation(conversationId, {
            messages: finalMessages,
          });

          // 生成标题（如果是第一条消息）
          if (messages.length === 1) {
            generateTitle(
              conversationId,
              [...messages, finalMessage],
              setIsTitleGenerating,
              setTitleGeneratingId,
              onUpdateConversation
            );
          }
        },
        // onError
        (error) => {
          console.error("流式消息发送失败:", error);

          const errorMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: `抱歉，发生了错误：${error.message}`,
            timestamp: new Date().toISOString(),
            isStreaming: false,
            isError: true,
            retryData: {
              messages,
              options,
              conversationId,
            },
          };

          const errorMessages = [...messages];
          const existingMessageIndex = errorMessages.findIndex(
            (msg) => msg.id === assistantMessageId
          );

          if (existingMessageIndex >= 0) {
            errorMessages[existingMessageIndex] = errorMessage;
          } else {
            errorMessages.push(errorMessage);
          }

          onUpdateConversation(conversationId, {
            messages: errorMessages,
          });
        },
        controller,
        conversationId
      );
    } catch (error) {
      console.error("消息发送失败:", error);

      const errorMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: `抱歉，发生了错误：${error.message}`,
        timestamp: new Date().toISOString(),
        isStreaming: false,
        isError: true,
        retryData: {
          messages,
          options,
          conversationId,
        },
      };

      const errorMessages = [...messages];
      const existingMessageIndex = errorMessages.findIndex(
        (msg) => msg.id === assistantMessageId
      );

      if (existingMessageIndex >= 0) {
        errorMessages[existingMessageIndex] = errorMessage;
      } else {
        errorMessages.push(errorMessage);
      }

      onUpdateConversation(conversationId, {
        messages: errorMessages,
      });
    } finally {
      setIsStreaming(false);
      setStreamingConversationId(null);
      setAbortController(null);
    }
  };

  // 带重试功能的消息发送（保留非流式版本作为备用）
  // eslint-disable-next-line no-unused-vars
  const sendMessageWithRetry = async (messages, options, conversationId) => {
    try {
      const response = await sendMessage(messages, options);

      let assistantMessage;

      if (typeof response === "object" && response.hasReasoning) {
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.content,
          reasoning: response.reasoning,
          hasReasoning: true,
          timestamp: new Date().toISOString(),
        };
      } else {
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: typeof response === "string" ? response : response.content,
          timestamp: new Date().toISOString(),
        };
      }

      onUpdateConversation(conversationId, {
        messages: [...messages, assistantMessage],
      });
    } catch (error) {
      console.error("发送消息失败:", error);
      let errorContent = "抱歉，发送消息时出现错误。";

      if (error.message && error.message.includes("API密钥")) {
        errorContent += "请检查您的API配置。";
      } else if (error.message && error.message.includes("网络")) {
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

      onUpdateConversation(conversationId, {
        messages: [...messages, errorMessage],
      });
    }
  };

  // 重试失败的消息
  const handleRetryMessage = async (errorMessage) => {
    if (!errorMessage.retryData) return;

    const { messages, options, conversationId } = errorMessage.retryData;

    if (isStreaming && streamingConversationId === conversationId) {
      console.log("正在进行流式输出，跳过重试");
      return;
    }

    const messagesWithoutError = conversation.messages.filter(
      (msg) => msg.id !== errorMessage.id
    );

    onUpdateConversation(conversationId, {
      messages: messagesWithoutError,
    });

    const roleToUse = conversation.role || currentRole;
    const roleInfo = getRoleById(roleToUse);
    const systemPrompt = roleInfo.systemPrompt;
    const roleTemperature = roleInfo.temperature;

    await sendMessageWithStream(
      messages,
      { ...options, model: conversation.model, systemPrompt, temperature: roleTemperature },
      conversationId
    );
  };

  // 重新生成消息
  const handleRegenerateMessage = async (assistantMessage) => {
    if (isStreaming) {
      console.log("正在进行流式输出，跳过重新生成");
      return;
    }

    const messageIndex = conversation.messages.findIndex(
      (msg) => msg.id === assistantMessage.id
    );

    if (messageIndex === -1) return;

    const messagesBeforeAssistant = conversation.messages.slice(0, messageIndex);

    const updatedMessages = messagesBeforeAssistant;

    onUpdateConversation(conversation.id, {
      messages: updatedMessages,
    });

    const lastUserMessage = messagesBeforeAssistant
      .slice()
      .reverse()
      .find((msg) => msg.role === "user");

    if (lastUserMessage) {
      const roleToUse = conversation.role || currentRole;
      const roleInfo = getRoleById(roleToUse);
      const systemPrompt = roleInfo.systemPrompt;
      const roleTemperature = roleInfo.temperature;

      await sendMessageWithStream(
        updatedMessages,
        {
          ...lastUserMessage.options,
          model: conversation.model,
          systemPrompt,
          temperature: roleTemperature,
        },
        conversation.id
      );
    }
  };

  if (conversation.messages.length === 0) {
    return (
      <>
        <div className="chat-header">
          <div className="header-left">
            <button className="sidebar-toggle" onClick={onToggleSidebar}>
              ☰
            </button>
          </div>
          <div className="header-actions"></div>
        </div>
        <WelcomeScreen onSendMessage={handleSendMessage} disabled={isStreaming} />
        <ConversationTimeline
          messages={conversation.messages}
          onJumpToMessage={handleJumpToMessage}
          currentMessageId={currentMessageId}
        />
      </>
    );
  }

  return (
    <>
      <div className="chat-header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={onToggleSidebar}>
            ☰
          </button>
          <div className="conversation-header">
            <div className="conversation-info">
              <div
                className="conversation-avatar"
                style={{
                  color: getRoleById(conversation.role || currentRole).color,
                }}
              >
                {getRoleById(conversation.role || currentRole).avatar}
              </div>
              <div className="conversation-details">
                <div
                  className="conversation-role"
                  style={{
                    color: getRoleById(conversation.role || currentRole).color,
                    borderColor:
                      getRoleById(conversation.role || currentRole).color + "40",
                    backgroundColor:
                      getRoleById(conversation.role || currentRole).color + "20",
                  }}
                >
                  {getRoleById(conversation.role || currentRole).name}
                </div>
                <h1 className="conversation-title">
                  {conversation.title || "新对话"}
                </h1>
              </div>
            </div>
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

          {/* 移动端时间线按钮 - 只在有2条以上用户消息时显示 */}
          {conversation.messages &&
            conversation.messages.filter((msg) => msg.role === "user").length > 1 && (
              <button
                className="timeline-toggle mobile-only"
                onClick={() => {
                  const timeline = document.querySelector(".conversation-timeline");
                  if (timeline) {
                    timeline.classList.toggle("timeline-visible");
                  }
                }}
                title={t("timeline", currentLanguage)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="25px"
                  height="25px"
                  viewBox="0 0 24 24"
                >
                  {/* Icon from Google Material Icons by Material Design Authors - https://github.com/material-icons/material-icons/blob/master/LICENSE */}
                  <path
                    fill="currentColor"
                    d="M6 15h6v2H6zm6-8h6v2h-6zm-3 4h6v2H9z"
                  />
                  <path
                    fill="currentColor"
                    d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V5h14z"
                  />
                </svg>
              </button>
            )}
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
          currentMessageId={currentMessageId}
        />
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isStreaming && streamingConversationId === conversation.id}
        isStreaming={isStreaming && streamingConversationId === conversation.id}
        onStopStreaming={stopStreaming}
        showBottomToolbar={true}
        showFileUpload={true}
        expandDirection="up"
        className="chat-interface-input"
        responseMode={responseMode}
        onResponseModeChange={handleResponseModeChange}
        currentModel={conversation.model}
        onNewChat={() => {
          console.log("新建对话");
        }}
        onAddTab={() => {
          console.log("添加新标签页");
        }}
      />
      <ConversationTimeline
        messages={conversation.messages}
        onJumpToMessage={handleJumpToMessage}
        currentMessageId={currentMessageId}
      />
    </>
  );
};

export default ChatInterface;

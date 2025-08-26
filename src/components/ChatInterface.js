import React, { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import WelcomeScreen from "./WelcomeScreen";
import { sendMessage, isApiConfigured } from "../utils/api";
import { getRoleById, loadSelectedRole } from "../utils/roles";
import "./ChatInterface.css";
//

const ChatInterface = ({
  conversation,
  onUpdateConversation,
  onToggleSidebar,
  onOpenSettings,
}) => {
  const [loadingConversations, setLoadingConversations] = useState(new Set());
  const [currentRole, setCurrentRole] = useState(() => loadSelectedRole());
  const messagesEndRef = useRef(null);

  // 检查当前对话是否正在加载
  const isLoading = loadingConversations.has(conversation.id);

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
    if (!content.trim() || isLoading) return;

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
      title:
        conversation.messages.length === 0
          ? content.slice(0, 30) + (content.length > 30 ? "..." : "")
          : conversation.title,
    };

    // 如果是第一条消息且有角色信息，保存角色到对话中
    if (conversation.messages.length === 0 && options.role) {
      updates.role = options.role;
    }

    onUpdateConversation(currentConversationId, updates);

    await sendMessageWithRetry(updatedMessages, options, currentConversationId);
  };

  // 带重试功能的消息发送
  const sendMessageWithRetry = async (messages, options, conversationId) => {
    // 为特定对话设置加载状态
    setLoadingConversations((prev) => new Set([...prev, conversationId]));

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
      // 移除特定对话的加载状态
      setLoadingConversations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    }
  };

  // 重试失败的消息
  const handleRetryMessage = async (errorMessage) => {
    if (!errorMessage.retryData) return;

    const { messages, options, conversationId } = errorMessage.retryData;

    // 移除错误消息
    const messagesWithoutError = conversation.messages.filter(
      (msg) => msg.id !== errorMessage.id
    );

    onUpdateConversation(conversationId, {
      messages: messagesWithoutError,
    });

    // 重新发送消息
    await sendMessageWithRetry(messages, options, conversationId);
  };

  // 如果没有消息，显示欢迎界面
  if (conversation.messages.length === 0) {
    return (
      <div className="chat-interface">
        <div className="chat-header">
          <button className="sidebar-toggle" onClick={onToggleSidebar}>
            ☰
          </button>
        </div>
        <WelcomeScreen onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          ☰
        </button>
        <div className="app-title">
          <div className="bobby-logo">🐾</div>
          <h1>{getRoleById(currentRole).name}</h1>
          <div
            className="bobby-status"
            style={{ color: getRoleById(currentRole).color }}
          >
            {getRoleById(currentRole).avatar}
          </div>
        </div>
      </div>

      <div className="chat-messages">
        <MessageList
          messages={conversation.messages}
          onOpenSettings={onOpenSettings}
          conversationRole={conversation.role}
          onRetryMessage={handleRetryMessage}
        />
        {isLoading && (
          <div className="message assistant loading">
            <div className="message-container">
              <div className="message-avatar">
                <div
                  className="role-avatar-large"
                  style={{ color: getRoleById(currentRole).color }}
                >
                  {getRoleById(currentRole).avatar}
                </div>
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSendMessage={handleSendMessage} disabled={isLoading} />
    </div>
  );
};

export default ChatInterface;

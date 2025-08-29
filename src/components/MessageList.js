import React, { useState, useEffect } from "react";
import { isApiConfigured } from "../utils/api";
import { getRoleById } from "../utils/roles";
import { getCurrentLanguage, t } from "../utils/language";
import MarkdownRenderer from "./MarkdownRenderer";
import ReasoningDisplay from "./ReasoningDisplay";
import "./MessageList.css";
import bobbyLogo from "../imgs/bobby_logo.png";

const MessageList = ({
  messages,
  onOpenSettings,
  conversationRole,
  onRetryMessage,
  onRegenerateMessage,
  isStreaming = false,
}) => {
  // const formatTime = (timestamp) => {
  //   return new Date(timestamp).toLocaleTimeString("zh-CN", {
  //     hour: "2-digit",
  //     minute: "2-digit",
  //   });
  // };

  const apiConfigured = isApiConfigured();

  // 获取对话的角色信息
  const role = conversationRole ? getRoleById(conversationRole) : null;

  // 语言状态管理
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());

  // 复制状态管理
  const [copiedMessageId, setCopiedMessageId] = useState(null);

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

  // 复制到剪贴板功能
  const copyToClipboard = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-content">
            {!apiConfigured && (
              <div className="api-warning">
                <div className="warning-icon">⚠️</div>
                <p>请先配置API设置才能开始对话</p>
                <button className="config-button" onClick={onOpenSettings}>
                  配置API
                </button>
              </div>
            )}
            <div className="welcome-message">
              <div className="bobby-welcome">
                <div className="bobby-face">😸</div>
                <h1>喵~ 我是Bobby！</h1>
                <p>有什么可以帮忙的吗？</p>
                <div className="cat-paws">🐾 🐾 🐾</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role} ${
              message.isError ? "error" : ""
            } ${
              message.isStreaming ? "streaming" : ""
            }`}
          >
            <div className="message-container">
              <div className="message-avatar">
                {message.role === "user" ? (
                  <div className="user-avatar">🐱</div>
                ) : (
                  <div className="bobby-avatar">
                    {role ? (
                      <div
                        className="role-avatar-large"
                        style={{ color: role.color }}
                      >
                        {role.avatar}
                      </div>
                    ) : (
                      <img
                        width="30"
                        height="30"
                        src={bobbyLogo}
                        alt="Bobby"
                        className="bobby-logo"
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="message-content">
                {message.role === "assistant" ? (
                  <>
                    {message.hasReasoning && (
                      <div className="reasoning-badge">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M9 12l2 2 4-4" />
                          <path d="M21 12c0 1.66-.5 3.22-1.4 4.51a9 9 0 1 1 0-9.02C20.5 8.78 21 10.34 21 12z" />
                        </svg>
                        推理模型
                      </div>
                    )}
                    {message.hasReasoning && message.reasoning && (
                      <ReasoningDisplay 
                        reasoning={message.reasoning} 
                        isStreaming={message.isStreaming || false}
                      />
                    )}
                    <MarkdownRenderer>{message.content}</MarkdownRenderer>
                    {message.isStreaming && (
                      <div className="streaming-indicator">
                        <span className="streaming-text">正在生成回复...</span>
                      </div>
                    )}
                    {/* AI回复的操作按钮 */}
                    {!message.isStreaming && !message.isError && (
                      <div className="message-actions">
                        <button
                          className={`action-button copy-button ${copiedMessageId === message.id ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(message.content, message.id)}
                          title={copiedMessageId === message.id ? t("copied", currentLanguage) : t("copyReply", currentLanguage)}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            {copiedMessageId === message.id ? (
                              <path d="M20 6L9 17l-5-5" strokeWidth="2.5" />
                            ) : (
                              <>
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </>
                            )}
                          </svg>
                        </button>
                        <button
                          className="action-button regenerate-button"
                          onClick={() => onRegenerateMessage && onRegenerateMessage(message)}
                          title={t("regenerate", currentLanguage)}
                          disabled={isStreaming}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M3 21v-5h5" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div>{message.content}</div>
                )}
                {message.isError && message.retryData && onRetryMessage && (
                  <div className="error-actions">
                    <button
                      className="retry-button"
                      onClick={() => onRetryMessage(message)}
                      disabled={isStreaming}
                      title={isStreaming ? "请等待当前流式输出完成" : "重试发送消息"}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>
                      {isStreaming ? "等待中..." : "重试"}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        ))
      )}
    </div>
  );
};

export default MessageList;

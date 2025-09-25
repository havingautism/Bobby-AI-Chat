import React, { useState, useEffect, useRef } from "react";
import { isApiConfigured } from "../utils/api";
// import { getRoleById } from "../utils/roles";
import { getCurrentLanguage, t } from "../utils/language";
import StreamdownRenderer from "./StreamdownRenderer";
import ReasoningDisplay from "./ReasoningDisplay";
import ImagePreviewModal from "./ImagePreviewModal";
import KnowledgeReferences from "./KnowledgeReferences";
import "./MessageList.css";

const MessageList = ({
  messages,
  onOpenSettings,
  conversationRole,
  onRetryMessage,
  onRegenerateMessage,
  isStreaming = false,
  currentMessageId = null,
}) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);

    // 显示完整的年月日时间
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const apiConfigured = isApiConfigured();

  // 获取对话的角色信息（如需显示可启用）
  // const role = conversationRole ? getRoleById(conversationRole) : null;

  // 语言状态管理
  const [currentLanguage, setCurrentLanguage] = useState(() =>
    getCurrentLanguage()
  );

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
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  // 使用useRef来避免状态重置问题
  const previewStateRef = useRef({
    isOpen: false,
    imageSrc: null,
  });

  const [, triggerRender] = useState(0);

  const handleImageClick = (imageSrc) => {
    if (imageSrc) {
      previewStateRef.current = {
        isOpen: true,
        imageSrc: imageSrc,
      };
      triggerRender((prev) => prev + 1);
    }
  };

  const closePreview = () => {
    previewStateRef.current = {
      isOpen: false,
      imageSrc: null,
    };
    triggerRender((prev) => prev + 1);
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
        messages.map((message, index) => (
          <div
            key={message.id}
            id={`message-${message.id}`}
            className={`message ${message.role} ${
              message.isError ? "error" : ""
            } ${message.isStreaming ? "streaming" : ""} ${
              currentMessageId === message.id ? "jump-highlight" : ""
            }`}
          >
            <div className="message-container">
              {/* 只在用户消息上方显示时间戳 */}
              {message.role === "user" && message.timestamp && (
                <div className="message-timestamp-above">
                  {formatTime(message.timestamp)}
                </div>
              )}
              <div className="message-content">
                {message.role === "assistant" ? (
                  <>
                    {message.hasReasoning && message.reasoning && (
                      <ReasoningDisplay
                        reasoning={message.reasoning}
                        isStreaming={message.isStreaming || false}
                      />
                    )}
                    <StreamdownRenderer
                      isStreaming={message.isStreaming || false}
                    >
                      {message.content}
                    </StreamdownRenderer>
                    {/* 关键词标签展示 */}
                    {message.role === "assistant" &&
                      (message.tagsGenerating ||
                        (message.tags && message.tags.length > 0)) && (
                        <div
                          className={`message-tags ${
                            message.tagsGenerating ? "generating" : ""
                          }`}
                        >
                          {message.tagsGenerating && (
                            <span className="tag-chip loading">
                              正在生成标签…
                            </span>
                          )}
                          {Array.isArray(message.tags) &&
                            message.tags.map((tag, i) => (
                              <span className="tag-chip" key={i}>
                                #{tag}
                              </span>
                            ))}
                        </div>
                      )}
                    {message.isStreaming && (
                      <div className="streaming-indicator">
                        <span className="streaming-text">正在生成回复...</span>
                      </div>
                    )}
                    {/* AI回复的操作按钮 */}
                    {!message.isStreaming && !message.isError && (
                      <div className="message-actions">
                        <button
                          className={`action-button copy-button ${
                            copiedMessageId === message.id ? "copied" : ""
                          }`}
                          onClick={() =>
                            copyToClipboard(message.content, message.id)
                          }
                          title={
                            copiedMessageId === message.id
                              ? t("copied", currentLanguage)
                              : t("copyReply", currentLanguage)
                          }
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
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </>
                            )}
                          </svg>
                        </button>
                        <button
                          className="action-button regenerate-button"
                          onClick={() =>
                            onRegenerateMessage && onRegenerateMessage(message)
                          }
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
                    {/* 显示知识库引用 */}
                    {message.role === "assistant" &&
                      message.knowledgeReferences &&
                      message.knowledgeReferences.length > 0 && (
                        <KnowledgeReferences
                          references={message.knowledgeReferences}
                          onReferenceClick={(reference) => {
                            console.log("点击了知识库引用:", reference);
                            // 这里可以添加点击引用的处理逻辑，比如打开文档详情
                          }}
                        />
                      )}
                  </>
                ) : (
                  <>
                    {/* 显示上传的文件信息（仅非图片文件） */}
                    {message.uploadedFile &&
                      message.uploadedFile.type &&
                      !message.uploadedFile.type.startsWith("image/") && (
                        <div className="uploaded-file-info">
                          <div className="file-info-display">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            </svg>
                            <span className="file-name-display">
                              {message.uploadedFile.name}
                            </span>
                            <span className="file-size-display">
                              ({(message.uploadedFile.size / 1024).toFixed(1)}{" "}
                              KB)
                            </span>
                          </div>
                        </div>
                      )}

                    {/* 显示图片预览 */}
                    {((message.uploadedFile &&
                      ((message.uploadedFile.type &&
                        message.uploadedFile.type.startsWith("image/")) ||
                        message.uploadedFile.type === "image")) ||
                      (message.content &&
                        message.content.includes("data:image/"))) && (
                      <div className="uploaded-image-preview">
                        {(() => {
                          const imageMatch = message.content?.match(
                            /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/
                          );
                          const imageSrc = imageMatch ? imageMatch[0] : "";

                          return imageSrc ? (
                            <div style={{ position: "relative" }}>
                              <img
                                src={imageSrc}
                                alt="上传的图片"
                                className="preview-image clickable-image"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleImageClick(imageSrc);
                                }}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                                style={{
                                  pointerEvents: "auto",
                                  cursor: "pointer",
                                  position: "relative",
                                  zIndex: 1,
                                }}
                              />
                              <div
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleImageClick(imageSrc);
                                }}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  cursor: "pointer",
                                  zIndex: 2,
                                  background: "transparent",
                                }}
                              />
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* 显示文本内容（排除base64数据） */}
                    <div className="message-text-content">
                      {(() => {
                        if (!message.content) return "";
                        // 移除所有base64图片数据
                        const textContent = message.content.replace(
                          /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,
                          ""
                        );
                        // 清理多余的空行
                        return textContent.replace(/\n\s*\n/g, "\n").trim();
                      })()}
                    </div>
                  </>
                )}
                {message.isError && message.retryData && onRetryMessage && (
                  <div className="error-actions">
                    <button
                      className="retry-button"
                      onClick={() => onRetryMessage(message)}
                      disabled={isStreaming}
                      title={
                        isStreaming ? "请等待当前流式输出完成" : "重试发送消息"
                      }
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

      {/* 图片预览模态框 */}
      <ImagePreviewModal
        isOpen={previewStateRef.current.isOpen}
        imageSrc={previewStateRef.current.imageSrc}
        onClose={closePreview}
      />
    </div>
  );
};

export default MessageList;

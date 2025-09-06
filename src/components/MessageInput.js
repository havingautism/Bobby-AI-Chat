import React, { useState, useEffect, useRef } from "react";

import { getCurrentLanguage, t } from "../utils/language";
import { isTauriEnvironment } from "../utils/tauriDetector";
import "./MessageInput.css";

const MessageInput = ({ 
  onSendMessage, 
  disabled, 
  isStreaming = false, 
  onStopStreaming = () => {},
  onOpenKnowledgeBase,
  showResponseModeToggle = false,
  responseMode = "normal",
  onResponseModeChange
}) => {
  const [message, setMessage] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((message.trim() || uploadedFile) && !disabled) {
      onSendMessage(message, uploadedFile);
      setMessage("");
      setUploadedFile(null);
      setFilePreview(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

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


  // 处理文件上传
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      
      // 如果是图片文件，创建预览
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  // 删除上传的文件
  const removeFile = () => {
    setUploadedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 触发文件选择
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-wrapper-clean">
          {/* 文件预览区域 */}
          {uploadedFile && (
            <div className="file-preview-container">
              {filePreview ? (
                <div className="image-preview">
                  <img src={filePreview} alt="预览" className="preview-image" />
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={removeFile}
                    title="删除文件"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="file-info">
                  <div className="file-details">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                    <span className="file-name">{uploadedFile.name}</span>
                    <span className="file-size">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={removeFile}
                    title="删除文件"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 主要输入区域 */}
          <div className="input-main-area">
            {/* 消息输入框 */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploadedFile ? t("typeMessageWithFile", currentLanguage) : t("typeMessage", currentLanguage)}
              disabled={disabled}
              rows={1}
              className="message-textarea-clean"
              style={{
                height: "auto",
                minHeight: "24px",
                maxHeight: "128px",
                outline: "none",
                border: "none",
                boxShadow: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
              onInput={(e) => {
                e.target.style.height = "auto";
                
                // 移动端和桌面端使用不同的最大高度
                const isMobile = window.innerWidth <= 768;
                const maxHeight = isMobile ? 80 : 128;
                
                e.target.style.height =
                  Math.min(e.target.scrollHeight, maxHeight) + "px";
                
                // 自动调整输入框容器的展开方向（对话页面中向上展开）
                const container = e.target.closest('.message-input-container');
                if (container) {
                  const rect = container.getBoundingClientRect();
                  const viewportHeight = window.innerHeight;
                  const spaceBelow = viewportHeight - rect.bottom;
                  const spaceAbove = rect.top;
                  
                  // 在对话页面中，优先向上展开
                  const chatInterface = container.closest('.chat-interface');
                  const hasMessages = chatInterface && chatInterface.querySelector('.chat-messages .message');
                  
                  if (hasMessages) {
                    // 对话页面：优先向上展开，除非上方空间不足
                    if (spaceAbove < 100 && spaceBelow > spaceAbove) {
                      container.classList.remove('expand-upward');
                    } else {
                      container.classList.add('expand-upward');
                    }
                  } else {
                    // 非对话页面：默认向下展开
                    container.classList.remove('expand-upward');
                  }
                }
              }}
            />

            {/* 发送/停止按钮 */}
            {isStreaming ? (
              <button
                type="button"
                className="stop-button"
                onClick={onStopStreaming}
                title={t("stop", currentLanguage)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!message.trim() && !uploadedFile) || disabled}
                className="send-button"
                title={t("send", currentLanguage)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 3 3 9-3 9 19-9Z" />
                  <path d="m6 12 13 0" />
                </svg>
              </button>
            )}
          </div>

          {/* 输入框内工具栏 */}
          <div className="input-toolbar">
            {/* 左侧按钮组 */}
            <div className="toolbar-left">
              {/* 加号按钮 */}
              <button
                type="button"
                className="plus-button-inline"
                onClick={triggerFileUpload}
                disabled={disabled}
                title={t("upload", currentLanguage)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14m-7-7h14" />
                </svg>
              </button>

              {/* 深度思考按钮 */}
              <button 
                type="button" 
                className="deep-thinking-btn" 
                disabled={disabled}
                title="深度思考"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>深度思考</span>
              </button>

              {/* 知识库按钮 */}
              {isTauriEnvironment() && onOpenKnowledgeBase && (
                <button
                  type="button"
                  className="knowledge-base-btn"
                  onClick={onOpenKnowledgeBase}
                  disabled={disabled}
                  title="知识库"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    <path d="M8 7h8"/>
                    <path d="M8 11h8"/>
                    <path d="M8 15h5"/>
                  </svg>
                  <span>知识库</span>
                </button>
              )}
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      </form>
      
      {/* <div className="input-hint">
        {currentLanguage === "zh" 
          ? "Bobby 可能会犯错。请核查重要信息。" 
          : "Bobby may make mistakes. Please verify important information."
        }
      </div> */}
    </div>
  );
};

export default MessageInput;

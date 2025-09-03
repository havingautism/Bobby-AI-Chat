import React, { useState, useEffect, useRef } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import "./ChatInput.css";

const ChatInput = ({ 
  onSendMessage, 
  disabled, 
  isStreaming = false, 
  onStopStreaming = () => {},
  showBottomToolbar = true,
  showFileUpload = true,
  placeholder,
  expandDirection = "auto", // "up", "down", "auto"
  className = "",
  onNewChat = () => {},
  onAddTab = () => {},
  responseMode: externalResponseMode,
  onResponseModeChange,
}) => {
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQuickResponseDropdown, setShowQuickResponseDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [responseMode, setResponseMode] = useState(externalResponseMode || "normal"); // normal 或 thinking
  const dropdownRef = useRef(null);
  const quickResponseRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((message.trim() || uploadedFile) && !disabled) {
      onSendMessage(message, uploadedFile, { responseMode });
      setMessage("");
      setUploadedFile(null);
      setFilePreview(null);
      
      // 发送消息后重置输入框高度
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "24px";
          window.dispatchEvent(new CustomEvent('inputHeightChange'));
        }
      }, 100);
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

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (quickResponseRef.current && !quickResponseRef.current.contains(event.target)) {
        setShowQuickResponseDropdown(false);
      }
    };

    if (showDropdown || showQuickResponseDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown, showQuickResponseDropdown]);

  // 动态调整chat-messages的padding-bottom以适应输入框高度
  useEffect(() => {
    const updateMessagesPadding = () => {
      if (textareaRef.current) {
        const isMobile = window.innerWidth <= 768;
        const inputContainer = textareaRef.current.closest('.chat-input-container');
        const chatMessages = document.querySelector('.chat-messages');
        
        if (inputContainer && chatMessages) {
          // 获取输入框的实际高度
          const containerHeight = inputContainer.offsetHeight;
          
          // 移除所有padding bottom，不预留空白
          chatMessages.style.paddingBottom = '0px';
          setInputHeight(containerHeight);
        }
      }
    };

    // 初始化时设置一次
    updateMessagesPadding();

    // 监听窗口大小变化
    const handleResize = () => {
      updateMessagesPadding();
    };

    window.addEventListener('resize', handleResize);
    
    // 监听输入框内容变化（通过自定义事件）
    const handleInputChange = () => {
      setTimeout(updateMessagesPadding, 10); // 延迟10ms确保DOM已更新
    };

    window.addEventListener('inputHeightChange', handleInputChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('inputHeightChange', handleInputChange);
    };
  }, [className]); // 添加className依赖

  // 监听message状态变化，当消息被清空时重置输入框高度
  useEffect(() => {
    if (!message.trim() && textareaRef.current) {
      // 延迟重置以确保DOM更新完成
      setTimeout(() => {
        if (textareaRef.current && !textareaRef.current.value.trim()) {
          textareaRef.current.style.height = "24px";
          window.dispatchEvent(new CustomEvent('inputHeightChange'));
        }
      }, 50);
    }
  }, [message]);

  // 同步外部 responseMode 的变化
  useEffect(() => {
    if (externalResponseMode !== undefined) {
      setResponseMode(externalResponseMode);
    }
  }, [externalResponseMode]);

  const toggleDropdown = () => {
    const newShowState = !showDropdown;
    setShowDropdown(newShowState);
  };

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
      
      setShowDropdown(false);
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

  // 处理新建对话
  const handleNewChat = () => {
    onNewChat();
    setShowDropdown(false);
  };

  // 处理添加选项卡
  const handleAddTab = () => {
    onAddTab();
    setShowDropdown(false);
  };

  // 确定展开方向
  const getExpandDirection = () => {
    if (expandDirection !== "auto") {
      return expandDirection;
    }
    
    // 自动判断：根据组件在页面中的位置决定
    const container = document.querySelector(`.${className || 'chat-input-container'}`);
    if (container) {
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // 如果上方空间不足，向下展开
      if (spaceAbove < 100 && spaceBelow > spaceAbove) {
        return "down";
      }
      // 否则向上展开
      return "up";
    }
    
    return "up"; // 默认向上展开
  };

  return (
    <div className={`chat-input-container ${className}`}>
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-wrapper-clean">
          {/* 文件预览区域 */}
          {showFileUpload && uploadedFile && (
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
              placeholder={placeholder || (uploadedFile ? t("typeMessageWithFile", currentLanguage) : t("typeMessage", currentLanguage))}
              disabled={disabled}
              rows={1}
              ref={textareaRef}
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
                
                // 根据配置的展开方向设置样式
                const direction = getExpandDirection();
                const container = e.target.closest('.chat-input-container');
                if (container) {
                  if (direction === "up") {
                    container.classList.add('expand-upward');
                    container.classList.remove('expand-downward');
                  } else {
                    container.classList.add('expand-downward');
                    container.classList.remove('expand-upward');
                  }
                }
                
                // 触发自定义事件通知输入框高度变化
                window.dispatchEvent(new CustomEvent('inputHeightChange'));
                
                // 简化的移动端键盘处理
                if (isMobile && document.activeElement === e.target && !className.includes('welcome-chat-input')) {
                  // 简单的滚动到输入框，让CSS处理视口适配
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }, 100);
                }
              }}
              
              // 添加失焦事件处理
              onBlur={(e) => {
                // 重置输入框高度为单行高度
                e.target.style.height = "auto";
                
                // 移除键盘打开的类（如果需要）
                const isMobile = window.innerWidth <= 768;
                if (isMobile && !className.includes('welcome-chat-input')) {
                  document.body.classList.remove('keyboard-open');
                  
                  // 移动端失焦时触发padding更新
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('inputHeightChange'));
                  }, 50);
                }
                
                // 如果输入框内容为空，确保重置为最小高度
                if (!e.target.value.trim()) {
                  e.target.style.height = "24px";
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('inputHeightChange'));
                  }, 50);
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
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            )}
          </div>

          {/* 底部工具栏 */}
          {showBottomToolbar && (
            <div className="bottom-toolbar">
              {/* 快速响应下拉框 */}
              <div className="quick-response-container" ref={quickResponseRef}>
                <button 
                  type="button" 
                  className={`quick-response-btn ${showQuickResponseDropdown ? 'open' : ''}`} 
                  disabled={disabled}
                  onClick={() => setShowQuickResponseDropdown(!showQuickResponseDropdown)}
                  title="选择响应模式"
                >
                  <span>
                    {responseMode === "thinking" ? "思考模式" : "快速响应"}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* 响应模式下拉菜单 */}
                {showQuickResponseDropdown && (
                  <div className="quick-response-dropdown">
                    <div 
                      className={`quick-response-item ${responseMode === "normal" ? "active" : ""}`}
                      onClick={() => {
                        const newMode = "normal";
                        setResponseMode(newMode);
                        setShowQuickResponseDropdown(false);
                        if (onResponseModeChange) {
                          onResponseModeChange(newMode);
                        }
                      }}
                    >
                      <div className="response-mode-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                      </div>
                      <div className="response-mode-info">
                        <div className="response-mode-title">快速响应</div>
                        <div className="response-mode-desc">标准模式，快速生成回复</div>
                      </div>
                      <div className="check-mark">
                        {responseMode === "normal" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div 
                      className={`quick-response-item ${responseMode === "thinking" ? "active" : ""}`}
                      onClick={() => {
                        const newMode = "thinking";
                        setResponseMode(newMode);
                        setShowQuickResponseDropdown(false);
                        if (onResponseModeChange) {
                          onResponseModeChange(newMode);
                        }
                      }}
                    >
                      <div className="response-mode-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                          <path d="M12 8v4M12 16h.01"/>
                        </svg>
                      </div>
                      <div className="response-mode-info">
                        <div className="response-mode-title">思考模式</div>
                        <div className="response-mode-desc">展示AI的推理过程</div>
                      </div>
                      <div className="check-mark">
                        {responseMode === "thinking" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 加号按钮和下拉菜单 */}
              <div className="plus-button-container" ref={dropdownRef}>
                <button
                  type="button"
                  className="plus-button"
                  onClick={toggleDropdown}
                  disabled={disabled}
                  title={t("moreOptions", currentLanguage)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14m-7-7h14" />
                  </svg>
                </button>

                {/* 简化的下拉菜单 */}
                {showDropdown && (
                  <div className="dropdown-menu">
                    <div className="dropdown-item" onClick={handleNewChat}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14,2 14,8 20,8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10,9 9,9 8,9" />
                      </svg>
                      <span>{t("newChat", currentLanguage)}</span>
                    </div>
                    
                    {showFileUpload && (
                      <div className="dropdown-item" onClick={triggerFileUpload}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span>{t("upload", currentLanguage)}</span>
                      </div>
                    )}
                    
                    <div className="dropdown-item" onClick={handleAddTab}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="1" x2="9" y2="23" />
                        <line x1="15" y1="1" x2="15" y2="23" />
                        <line x1="1" y1="9" x2="23" y2="9" />
                        <line x1="1" y1="15" x2="23" y2="15" />
                      </svg>
                      <span>{t("addTab", currentLanguage)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 隐藏的文件输入 */}
          {showFileUpload && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          )}
        </div>
      </form>
      
      <div className="input-hint">
        {currentLanguage === "zh" 
          ? "Bobby 可能会犯错。请核查重要信息。" 
          : "Bobby may make mistakes. Please verify important information."
        }
      </div>
    </div>
  );
};

export default ChatInput;

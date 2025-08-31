import React, { useState, useEffect, useRef } from "react";

import { getCurrentLanguage, t } from "../utils/language";
import "./MessageInput.css";

const MessageInput = ({ onSendMessage, disabled, isStreaming = false, onStopStreaming = () => {} }) => {
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const dropdownRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  // 智能定位下拉菜单
  const getDropdownPosition = () => {
    if (!dropdownRef.current) return {};
    
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 120; // 预估下拉菜单高度
    const safeMargin = 30; // 增加安全边距
    
    // 如果上方空间不足，则向下显示
    if (rect.top < (dropdownHeight + safeMargin)) {
      return { 
        position: 'absolute',
        bottom: 'auto', 
        top: '100%', 
        right: '0',
        marginTop: '16px',
        marginBottom: '0'
      };
    }
    
    // 默认向上显示，确保有足够间距
    return { 
      position: 'absolute',
      bottom: 'calc(100% + 20px)', 
      top: 'auto',
      right: '0',
      marginTop: '0',
      marginBottom: '0'
    };
  };

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-wrapper-clean">
          {/* 主要输入区域 */}
          <div className="input-main-area">
            {/* 消息输入框 */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("typeMessage", currentLanguage)}
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
                disabled={!message.trim() || disabled}
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

          {/* 底部工具栏 - 在对话框内部 */}
          <div className="bottom-toolbar">
            {/* 快速响应按钮 */}
            <button 
              type="button" 
              className="quick-response-btn" 
              disabled={disabled}
              title={t("quickResponse", currentLanguage)}
            >
              <span>{t("quickResponse", currentLanguage)}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* 加号按钮和下拉菜单 */}
            <div className="plus-button-container">
              <button
                type="button"
                className="plus-button"
                onClick={toggleDropdown}
                disabled={disabled}
                title={t("moreOptions", currentLanguage)}
                ref={dropdownRef}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14m-7-7h14" />
                </svg>
              </button>

              {/* 下拉菜单 */}
              {showDropdown && (
                <div 
                  className="dropdown-menu"
                  style={getDropdownPosition()}
                >
                  <button type="button" className="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10,9 9,9 8,9" />
                    </svg>
                    <span>{t("newChat", currentLanguage)}</span>
                  </button>
                  <button type="button" className="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <span>{t("upload", currentLanguage)}</span>
                  </button>
                  <button type="button" className="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="1" x2="9" y2="23" />
                      <line x1="15" y1="1" x2="15" y2="23" />
                      <line x1="1" y1="9" x2="23" y2="9" />
                      <line x1="1" y1="15" x2="23" y2="15" />
                    </svg>
                    <span>{t("addTab", currentLanguage)}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
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

export default MessageInput;

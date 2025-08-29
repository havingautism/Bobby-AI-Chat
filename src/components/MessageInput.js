import React, { useState, useEffect } from "react";

import { getCurrentLanguage, t } from "../utils/language";
import "./MessageInput.css";

const MessageInput = ({ onSendMessage, disabled, isStreaming = false, onStopStreaming = () => {} }) => {
  const [message, setMessage] = useState("");

  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());

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

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-wrapper-clean">
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
              e.target.style.height =
                Math.min(e.target.scrollHeight, 128) + "px";
              
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

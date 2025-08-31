import React, { useState, useEffect } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import { getStorageInfo, clearChatHistory } from "../utils/storage";
import "./Settings.css";

const Settings = ({ isOpen, onClose }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [storageInfo, setStorageInfo] = useState(null);

  useEffect(() => {
    const loadStorageInfo = async () => {
      const info = await getStorageInfo();
      setStorageInfo(info);
    };
    
    if (isOpen) {
      loadStorageInfo();
    }
  }, [isOpen]);

  const handleLanguageChange = (language) => {
    setCurrentLanguage(language);
    localStorage.setItem("language", language);
    
    // 触发自定义事件
    window.dispatchEvent(
      new CustomEvent("languageChanged", { detail: language })
    );
  };

  const handleThemeChange = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    
    // 触发自定义事件
    window.dispatchEvent(
      new CustomEvent("themeChanged", { detail: theme })
    );
  };

  const handleClearHistory = async () => {
    if (window.confirm("确定要清除所有聊天历史吗？此操作不可撤销。")) {
      await clearChatHistory();
      // 重新加载存储信息
      const info = await getStorageInfo();
      setStorageInfo(info);
      alert("聊天历史已清除");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t("settings", currentLanguage)}</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="settings-content">
          {/* 语言设置 */}
          <div className="settings-section">
            <h3>{t("language", currentLanguage)}</h3>
            <div className="settings-options">
              <button
                className={`option-button ${currentLanguage === "zh" ? "active" : ""}`}
                onClick={() => handleLanguageChange("zh")}
              >
                中文
              </button>
              <button
                className={`option-button ${currentLanguage === "en" ? "active" : ""}`}
                onClick={() => handleLanguageChange("en")}
              >
                English
              </button>
            </div>
          </div>

          {/* 主题设置 */}
          <div className="settings-section">
            <h3>{t("theme", currentLanguage)}</h3>
            <div className="settings-options">
              <button
                className={`option-button ${document.documentElement.getAttribute("data-theme") === "light" ? "active" : ""}`}
                onClick={() => handleThemeChange("light")}
              >
                {t("lightMode", currentLanguage)}
              </button>
              <button
                className={`option-button ${document.documentElement.getAttribute("data-theme") === "dark" ? "active" : ""}`}
                onClick={() => handleThemeChange("dark")}
              >
                {t("darkMode", currentLanguage)}
              </button>
            </div>
          </div>

          {/* 存储信息 */}
          <div className="settings-section">
            <h3>存储信息</h3>
            {storageInfo ? (
              <div className="storage-info">
                <p>对话数量: {storageInfo.conversationCount}</p>
                <p>总大小: {storageInfo.totalSize}</p>
                <button 
                  className="danger-button" 
                  onClick={handleClearHistory}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  清除所有聊天历史
                </button>
              </div>
            ) : (
              <p>加载中...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

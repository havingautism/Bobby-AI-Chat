import React, { useState, useEffect, useRef } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import "./ConversationTimeline.css";

const ConversationTimeline = ({ messages, onJumpToMessage, currentMessageId }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [isVisible, setIsVisible] = useState(false);
  const timelineRef = useRef(null);
  
  // 检测是否为移动设备
  const [isMobile, setIsMobile] = useState(false);

  // 检测设备类型
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
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

  // 过滤出用户消息
  const userMessages = messages.filter(message => message.role === "user");

  // 格式化时间
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小时前`;
    } else {
      return date.toLocaleDateString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  };

  // 截取消息预览
  const getMessagePreview = (content, maxLength = 30) => {
    if (!content) return "";
    const text = content.replace(/[#*`]/g, "").trim();
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  // 处理跳转
  const handleJumpToMessage = (messageId) => {
    onJumpToMessage(messageId);
  };

  // 切换显示状态
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  // 点击外部关闭时间轴
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobile && isVisible && timelineRef.current && !timelineRef.current.contains(event.target)) {
        setIsVisible(false);
      }
    };

    // 总是添加事件监听器，但在回调中检查条件
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobile, isVisible]);

  // 如果用户消息少于2条，不显示时间轴
  if (userMessages.length < 2) {
    return null;
  }

  return (
    <div className={`conversation-timeline ${isVisible ? 'visible' : ''} ${isMobile ? 'mobile' : 'desktop'}`} ref={timelineRef}>
      {/* 移动端切换按钮 */}
      {isMobile && (
        <button 
          className="timeline-toggle"
          onClick={toggleVisibility}
          title={t('timeline')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </button>
      )}

      {/* 时间轴内容 */}
      <div className="timeline-content">
        <div className="timeline-header">
          <h3>{t('timeline')}</h3>
          <span className="message-count">{userMessages.length} {t('questions')}</span>
        </div>
        
        <div className="timeline-items">
          {userMessages.map((message, index) => (
            <div
              key={message.id}
              className={`timeline-item ${currentMessageId === message.id ? 'active' : ''}`}
              onClick={() => handleJumpToMessage(message.id)}
            >
              <div className="timeline-dot">
                <div className="dot-inner"></div>
              </div>
              <div className="timeline-content-wrapper">
                <div className="timeline-time">{formatTime(message.timestamp)}</div>
                <div className="timeline-preview">
                  {getMessagePreview(message.content)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversationTimeline;

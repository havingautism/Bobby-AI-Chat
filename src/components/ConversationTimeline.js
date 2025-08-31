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
    
    // 过滤掉base64图片数据
    let text = content.split('\n').filter(line => !line.startsWith('data:image')).join('\n');
    
    // 过滤掉文件信息文本（如 [图片文件: xxx] 或 [文件: xxx]）
    text = text.replace(/\[图片文件:[^\]]*\]/g, '');
    text = text.replace(/\[文件:[^\]]*\]/g, '');
    
    // 移除markdown格式
    text = text.replace(/[#*`]/g, "").trim();
    
    // 如果过滤后没有内容，返回默认文本
    if (!text) {
      return "图片消息";
    }
    
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

  // 点击外部关闭时间轴（仅移动端）
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 仅移动端需要点击外部关闭功能
      if (!isMobile) return;
      
      // 检查是否点击了header中的时间线按钮
      const timelineButton = document.querySelector('.timeline-toggle.mobile-only');
      if (timelineButton && timelineButton.contains(event.target)) {
        return; // 如果点击的是header中的时间线按钮，不关闭
      }
      
      // 检查时间轴是否可见
      const timeline = document.querySelector('.conversation-timeline');
      if (timeline && timeline.classList.contains('timeline-visible')) {
        // 检查是否点击了时间轴外部
        if (!timeline.contains(event.target)) {
          timeline.classList.remove('timeline-visible');
          setIsVisible(false);
        }
      }
    };

    // 总是添加事件监听器
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobile, isVisible]);

  // 监听模型选择下拉框状态变化（仅PC端）
  useEffect(() => {
    if (isMobile) return; // 仅PC端需要此功能

    const handleModelDropdownToggle = (event) => {
      const { isOpen } = event.detail;
      const timeline = document.querySelector('.conversation-timeline');
      
      if (timeline) {
        if (isOpen) {
          // 下拉框打开时，将时间轴移动到下拉框下方
          timeline.classList.add('dropdown-open');
        } else {
          // 下拉框关闭时，恢复时间轴原始位置
          timeline.classList.remove('dropdown-open');
        }
      }
    };

    window.addEventListener('modelDropdownToggle', handleModelDropdownToggle);
    
    return () => {
      window.removeEventListener('modelDropdownToggle', handleModelDropdownToggle);
    };
  }, [isMobile]);

  // 如果用户消息少于2条，不显示时间轴
  if (userMessages.length < 2) {
    return null;
  }

  return (
    <div className={`conversation-timeline ${isVisible ? 'visible' : ''} ${isMobile ? 'mobile' : 'desktop'}`} ref={timelineRef}>
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

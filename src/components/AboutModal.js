import React from 'react';
import './AboutModal.css';

const AboutModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="about-overlay" onClick={handleOverlayClick}>
      <div className="about-modal">
        <div className="about-header">
          <h2>Bobby AI Chat</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="about-content">
          <div className="about-section">
            <h3>项目简介</h3>
            <p>
              Bobby AI Chat 是一个现代化的AI聊天应用，支持多种AI模型和角色扮演功能。
              采用React + Vite构建，提供流畅的用户体验和丰富的功能特性。
            </p>
          </div>

          <div className="about-section">
            <h3>主要功能</h3>
            <ul className="feature-list">
              <li>🤖 支持多种AI模型（OpenAI、Claude、DeepSeek等）</li>
              <li>🎭 丰富的角色扮演功能</li>
              <li>💬 智能对话管理</li>
              <li>🖼️ 图片上传和识别</li>
              <li>🌙 深色/浅色主题切换</li>
              <li>🌍 多语言支持</li>
              <li>💾 本地数据存储</li>
              <li>📱 响应式设计</li>
            </ul>
          </div>

          <div className="about-section">
            <h3>技术栈</h3>
            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-name">React</span>
                <span className="tech-version">18.x</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Vite</span>
                <span className="tech-version">5.x</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">CSS3</span>
                <span className="tech-version">现代特性</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">LocalStorage</span>
                <span className="tech-version">数据持久化</span>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h3>版本信息</h3>
            <div className="version-info">
              <div className="version-item">
                <span className="version-label">当前版本</span>
                <span className="version-value">v1.0.0</span>
              </div>
              <div className="version-item">
                <span className="version-label">构建时间</span>
                <span className="version-value">{new Date().toLocaleDateString('zh-CN')}</span>
              </div>
              <div className="version-item">
                <span className="version-label">开发者</span>
                <span className="version-value">havingautism</span>
              </div>
            </div>
          </div>

        </div>

        <div className="about-footer">
          <div className="footer-links">
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">文档</a>
            <a href="#" className="footer-link">反馈</a>
          </div>
          <div className="footer-text">
            Made with ❤️ by havingautism
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;

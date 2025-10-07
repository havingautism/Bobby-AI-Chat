import React from "react";
import Modal from "./Modal";
import "./AboutModal.css";

const AboutModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bobby AI Chat" size="md">
      <div className="about-content">
          <div className="about-section">
            <h3>🚀 项目简介</h3>
            <p>
              Bobby AI Chat 是一个现代化的AI聊天应用，基于 React + Tauri
              构建，支持多种AI模型和知识库功能。 采用 SQLite + sqlite-vec
              向量数据库，提供高性能的本地数据存储和智能语义搜索能力。
            </p>
          </div>

          <div className="about-section">
            <h3>✨ 核心功能</h3>
            <ul className="feature-list">
              <li>🤖 多AI模型支持（DeepSeek-V3.1、Qwen3、DeepSeek-R1等）</li>
              <li>🎭 智能角色系统（程序员、教师、创意助手等）</li>
              <li>📚 知识库功能（文档上传、语义搜索、向量索引）</li>
              <li>💬 流式对话和推理过程显示</li>
              <li>💾 SQLite + sqlite-vec 本地向量数据库</li>
              <li>🌓 明暗主题切换</li>
              <li>🌍 多语言界面支持</li>
              <li>📱 跨平台响应式设计</li>
            </ul>
          </div>

          <div className="about-section">
            <h3>🛠️ 技术栈</h3>
            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-name">React</span>
                <span className="tech-version">18.2</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Tauri</span>
                <span className="tech-version">2.x</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">TypeScript</span>
                <span className="tech-version">类型安全</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">SQLite</span>
                <span className="tech-version">+ sqlite-vec</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Rust</span>
                <span className="tech-version">高性能后端</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Tailwind CSS</span>
                <span className="tech-version">实用优先</span>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h3>🎯 特色亮点</h3>
            <ul className="feature-list">
              <li>🔒 完全本地数据存储，隐私保护</li>
              <li>⚡ 高性能向量搜索和语义匹配</li>
              <li>🌐 硅基流动API集成，云端AI能力</li>
              <li>📊 智能统计和使用分析</li>
              <li>🎨 现代化UI设计和流畅交互</li>
              <li>🔄 跨平台支持（PC、Web、移动端）</li>
            </ul>
          </div>

          <div className="about-section">
            <h3>📋 版本信息</h3>
            <div className="version-info">
              <div className="version-item">
                <span className="version-label">当前版本</span>
                <span className="version-value">v0.1.2</span>
              </div>
              <div className="version-item">
                <span className="version-label">构建时间</span>
                <span className="version-value">
                  {new Date().toLocaleDateString("zh-CN")}
                </span>
              </div>
              <div className="version-item">
                <span className="version-label">数据库引擎</span>
                <span className="version-value">SQLite + sqlite-vec</span>
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
            <a
              href="https://github.com/havingautism/Bobby-AI-Chat"
              className="footer-link"
            >
              GitHub
            </a>
            <a
              href="https://github.com/havingautism/Bobby-AI-Chat"
              className="footer-link"
            >
              文档
            </a>
            <a
              href="https://github.com/havingautism/Bobby-AI-Chat/issues"
              className="footer-link"
            >
              反馈
            </a>
          </div>
          <div className="footer-text">Made with ❤️ by havingautism</div>
      </div>
    </Modal>
  );
};

export default AboutModal;

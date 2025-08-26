import React from "react";
import { isApiConfigured } from "../utils/api";
import { getRoleById } from "../utils/roles";
import MarkdownRenderer from "./MarkdownRenderer";
import "./MessageList.css";
import bobbyLogo from "../imgs/bobby_logo.png";

const MessageList = ({ messages, onOpenSettings, conversationRole }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const apiConfigured = isApiConfigured();

  // 获取对话的角色信息
  const role = conversationRole ? getRoleById(conversationRole) : null;

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
        messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role} ${
              message.isError ? "error" : ""
            }`}
          >
            <div className="message-container">
              <div className="message-avatar">
                {message.role === "user" ? (
                  <div className="user-avatar">🐱</div>
                ) : (
                  <div className="bobby-avatar">
                    {role ? (
                      <div
                        className="role-avatar-large"
                        style={{ color: role.color }}
                      >
                        {role.avatar}
                      </div>
                    ) : (
                      <img
                        width="30"
                        height="30"
                        src={bobbyLogo}
                        alt="Bobby"
                        className="bobby-logo"
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="message-content">
                {message.role === "assistant" ? (
                  <MarkdownRenderer>{message.content}</MarkdownRenderer>
                ) : (
                  <div>{message.content}</div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MessageList;

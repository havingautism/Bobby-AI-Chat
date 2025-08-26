import React, { useState, useEffect } from "react";
import { getRoleById, loadSelectedRole } from "../utils/roles";
import "./MessageInput.css";

const MessageInput = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState("");
  const [currentRole, setCurrentRole] = useState(() => loadSelectedRole());

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

  // 监听角色变化
  useEffect(() => {
    const handleRoleChange = () => {
      setCurrentRole(loadSelectedRole());
    };

    window.addEventListener("storage", handleRoleChange);
    window.addEventListener("roleChanged", handleRoleChange);

    return () => {
      window.removeEventListener("storage", handleRoleChange);
      window.removeEventListener("roleChanged", handleRoleChange);
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
            placeholder={`和${getRoleById(currentRole).name}聊天... ${
              getRoleById(currentRole).icon
            }`}
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
            }}
          />
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="send-button"
            title="发送消息"
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
        </div>
      </form>
      <div className="input-hint">Bobby 可能会犯错。请核查重要信息。</div>
    </div>
  );
};

export default MessageInput;

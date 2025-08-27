import React, { useState, useRef, useEffect } from "react";
import { AI_ROLES, saveSelectedRole, loadSelectedRole } from "../utils/roles";
import { getCurrentLanguage } from "../utils/language";
import "./WelcomeScreen.css";

const WelcomeScreen = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState(loadSelectedRole());
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const dropdownRef = useRef(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowRoleDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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

  const roles = AI_ROLES;

  const quickPrompts = currentLanguage === "zh" ? [
    "🤔 解释一个复杂的概念",
    "💻 帮我写一段代码",
    "📈 分析当前趋势",
    "✨ 创意写作帮助",
    "😸 和Bobby聊天",
    "🎯 制定学习计划",
  ] : [
    "🤔 Explain a complex concept",
    "💻 Help me write some code",
    "📈 Analyze current trends",
    "✨ Creative writing help",
    "😸 Chat with Bobby",
    "🎯 Create a learning plan",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      const selectedRoleData = roles.find((role) => role.id === selectedRole);
      onSendMessage(message, {
        role: selectedRole,
        temperature: selectedRoleData.temperature,
        systemPrompt: selectedRoleData.systemPrompt,
      });
      setMessage("");
    }
  };

  const handleRoleChange = (roleId) => {
    setSelectedRole(roleId);
    saveSelectedRole(roleId);
    setShowRoleDropdown(false);
    // 触发自定义事件，通知其他组件角色已变化
    window.dispatchEvent(new CustomEvent("roleChanged"));
  };

  const handleQuickPrompt = (prompt) => {
    const selectedRoleData = roles.find((role) => role.id === selectedRole);
    onSendMessage(prompt, {
      role: selectedRole,
      temperature: selectedRoleData.temperature,
      systemPrompt: selectedRoleData.systemPrompt,
    });
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Bobby Logo和标题 */}
        <div className="welcome-header">
          {/* <div className="bobby-logo-large">
            <div className="logo-circle">
              <span className="logo-paw">🐾</span>
            </div>
          </div> */}
          <h1 className="welcome-title">
            {roles.find((role) => role.id === selectedRole)?.name}{" "}
            {roles.find((role) => role.id === selectedRole)?.icon}
          </h1>
          <p className="welcome-subtitle">
            {roles.find((role) => role.id === selectedRole)?.description}
          </p>
        </div>

        {/* 角色扮演选择 */}
        <div className="role-selection">
          <h3 className="section-title">{currentLanguage === "zh" ? "选择AI角色" : "Choose AI Role"}</h3>
          <div className="role-dropdown-container" ref={dropdownRef}>
            <button
              className="role-dropdown-trigger"
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              disabled={disabled}
            >
              <div className="role-display">
                <span className="role-icon">
                  {roles.find((role) => role.id === selectedRole)?.icon}
                </span>
                <div className="role-info">
                  <div className="role-name">
                    {roles.find((role) => role.id === selectedRole)?.name}
                  </div>
                  <div className="role-description">
                    {
                      roles.find((role) => role.id === selectedRole)
                        ?.description
                    }
                  </div>
                </div>
              </div>
              <svg
                className={`dropdown-arrow ${showRoleDropdown ? "open" : ""}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {showRoleDropdown && (
              <div className="role-dropdown-menu">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    className={`role-option ${
                      selectedRole === role.id ? "selected" : ""
                    }`}
                    onClick={() => handleRoleChange(role.id)}
                  >
                    <span className="role-icon">{role.icon}</span>
                    <div className="role-info">
                      <div className="role-name">{role.name}</div>
                      <div className="role-description">{role.description}</div>
                    </div>
                    {selectedRole === role.id && (
                      <svg
                        className="check-icon"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 输入框 */}
        <div className="welcome-input-section">
          <form onSubmit={handleSubmit} className="welcome-input-form">
            <div className="welcome-input-wrapper-clean">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  currentLanguage === "zh" 
                    ? `和${roles.find((role) => role.id === selectedRole)?.name}开始对话...`
                    : `Start chatting with ${roles.find((role) => role.id === selectedRole)?.name}...`
                }
                disabled={disabled}
                rows={1}
                className="welcome-textarea-clean"
                style={{
                  outline: "none",
                  border: "none",
                  boxShadow: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  appearance: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!message.trim() || disabled}
                className="welcome-send-button"
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
        </div>

        {/* 快速提示 */}
        <div className="quick-prompts">
          <h3 className="section-title">{currentLanguage === "zh" ? "快速开始" : "Quick Start"}</h3>
          <div className="prompt-grid">
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                className="prompt-card"
                onClick={() => handleQuickPrompt(prompt)}
                disabled={disabled}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;

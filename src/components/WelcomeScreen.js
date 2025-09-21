import React, { useState, useRef, useEffect } from "react";
import { AI_ROLES, saveSelectedRole, loadSelectedRole } from "../utils/roles";
import { getCurrentLanguage } from "../utils/language";
import { getApiConfig } from "../utils/api";
import { getAllRoles } from "../utils/database";
import ChatInput from "./ChatInput";
import "./WelcomeScreen.css";

const WelcomeScreen = ({ onSendMessage, disabled }) => {
  const [selectedRole, setSelectedRole] = useState(loadSelectedRole());
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() =>
    getCurrentLanguage()
  );
  const [responseMode, setResponseMode] = useState(() => {
    // 从 localStorage 读取保存的响应模式
    return localStorage.getItem("lastResponseMode") || "normal";
  });
  const [defaultModel, setDefaultModel] = useState("");
  const [roles, setRoles] = useState(AI_ROLES);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef(null);

  // 组件挂载时加载角色和默认模型
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);

        // 从数据库加载角色
        const databaseRoles = await getAllRoles();
        console.log("WelcomeScreen: 从数据库加载的角色:", databaseRoles);
        if (databaseRoles && databaseRoles.length > 0) {
          setRoles(databaseRoles);
        }

        // 获取默认模型
        const config = await getApiConfig();
        setDefaultModel(config.model || "");

        setIsLoading(false);
      } catch (error) {
        console.error("加载初始数据失败:", error);
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

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

  // 监听角色更新事件
  useEffect(() => {
    const handleRolesUpdated = (event) => {
      console.log("WelcomeScreen: 角色已更新", event.detail);
      setRoles([...event.detail]);
      // 更新全局AI_ROLES引用
      const { updateGlobalRoles } = require("../utils/roles");
      updateGlobalRoles(event.detail);
    };

    const handleRolesReset = () => {
      console.log("WelcomeScreen: 角色已重置");
      setRoles([...AI_ROLES]);
    };

    const handleRoleChanged = () => {
      console.log("WelcomeScreen: 角色选择已变化");
      // 重新加载选中的角色
      const newSelectedRole = loadSelectedRole();
      setSelectedRole(newSelectedRole);
    };

    window.addEventListener("rolesUpdated", handleRolesUpdated);
    window.addEventListener("rolesReset", handleRolesReset);
    window.addEventListener("roleChanged", handleRoleChanged);

    return () => {
      window.removeEventListener("rolesUpdated", handleRolesUpdated);
      window.removeEventListener("rolesReset", handleRolesReset);
      window.removeEventListener("roleChanged", handleRoleChanged);
    };
  }, []);

  const quickPrompts =
    currentLanguage === "zh"
      ? [
          "🤔 解释一个复杂的概念",
          "👨🏻‍💻 帮我写一段代码",
          "📈 分析当前趋势",
          "✨ 创意写作帮助",
          "😸 和Bobby聊天",
          "🎯 制定学习计划",
        ]
      : [
          "🤔 Explain a complex concept",
          "👨🏻‍💻 Help me write some code",
          "📈 Analyze current trends",
          "✨ Creative writing help",
          "😸 Chat with Bobby",
          "🎯 Create a learning plan",
        ];

  const handleSubmit = (message, uploadedFile, options = {}) => {
    if ((message.trim() || uploadedFile) && !disabled) {
      const selectedRoleData = roles.find((role) => role.id === selectedRole);
      onSendMessage(message, uploadedFile, {
        role: selectedRole,
        temperature: selectedRoleData.temperature,
        systemPrompt: selectedRoleData.systemPrompt,
        responseMode: responseMode,
        selectedDocuments: options.selectedDocuments || null,
      });
    }
  };

  const handleResponseModeChange = (newMode) => {
    setResponseMode(newMode);
    // 保存到 localStorage
    localStorage.setItem("lastResponseMode", newMode);
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
    onSendMessage(prompt, null, {
      role: selectedRole,
      temperature: selectedRoleData.temperature,
      systemPrompt: selectedRoleData.systemPrompt,
      responseMode: responseMode,
      selectedDocuments: null, // 快速提示不包含知识库选择
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
          <h3 className="section-title">
            {currentLanguage === "zh" ? "选择AI角色" : "Choose AI Role"}
          </h3>
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
                {isLoading ? (
                  <div className="loading-roles">
                    <div className="loading-spinner"></div>
                    <span>
                      {currentLanguage === "zh"
                        ? "加载角色..."
                        : "Loading roles..."}
                    </span>
                  </div>
                ) : (
                  roles.map((role) => (
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
                        <div className="role-description">
                          {role.description}
                        </div>
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
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 输入框 */}
        <div className="welcome-input-section">
          <ChatInput
            onSendMessage={handleSubmit}
            disabled={disabled}
            showBottomToolbar={true}
            showFileUpload={true}
            placeholder={
              currentLanguage === "zh"
                ? `和${
                    roles.find((role) => role.id === selectedRole)?.name
                  }开始对话...`
                : `Start chatting with ${
                    roles.find((role) => role.id === selectedRole)?.name
                  }...`
            }
            expandDirection="down"
            className="welcome-chat-input"
            responseMode={responseMode}
            onResponseModeChange={handleResponseModeChange}
            currentModel={defaultModel}
          />
        </div>

        {/* 快速提示 */}
        <div className="quick-prompts">
          <h3 className="section-title">
            {currentLanguage === "zh" ? "快速开始" : "Quick Start"}
          </h3>
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

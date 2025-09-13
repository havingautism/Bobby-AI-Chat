import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { AI_ROLES, saveSelectedRole, loadSelectedRole, getRoleById } from "../utils/roles";
import { getCurrentLanguage } from "../utils/language";
import { getApiConfig, sendMessage } from "../utils/api";
import ChatInput from "./ChatInput";
import "./WelcomeScreen.css";

const WelcomeContent = ({ onToggleSidebar, onOpenSettings, onOpenKnowledgeBase }) => {
  const navigate = useNavigate();
  const { 
    createNewConversation,
    updateConversation,
    currentConversationId,
    defaultModel,
    lastResponseMode,
    setLastResponseMode
  } = useSession();
  
  const [selectedRole, setSelectedRole] = useState(loadSelectedRole());
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [responseMode, setResponseMode] = useState(lastResponseMode);
  const [apiDefaultModel, setApiDefaultModel] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const loadDefaultModel = async () => {
      try {
        const config = await getApiConfig();
        setApiDefaultModel(config.model || "");
      } catch (error) {
        console.error("获取默认模型失败:", error);
      }
    };
    loadDefaultModel();
  }, []);

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
    "👨🏻‍💻 帮我写一段代码",
    "📈 分析当前趋势",
    "✨ 创意写作帮助",
    "😸 和Bobby聊天",
    "🎯 制定学习计划",
  ] : [
    "🤔 Explain a complex concept",
    "👨🏻‍💻 Help me write some code",
    "📈 Analyze current trends",
    "✨ Creative writing help",
    "😸 Chat with Bobby",
    "🎯 Create a learning plan",
  ];

  const handleSubmit = async (message, uploadedFile, options = {}) => {
    if (message.trim() || uploadedFile) {
      const selectedRoleData = roles.find((role) => role.id === selectedRole);
      
      // 创建新对话
      createNewConversation();
      
      // 使用更长的延迟确保状态更新完成
      setTimeout(async () => {
        // 重新获取最新的currentConversationId
        const latestConversationId = currentConversationId;
        
        if (latestConversationId) {
          // 创建用户消息
          const userMessage = {
            id: Date.now().toString(),
            role: "user",
            content: message.trim(),
            timestamp: new Date().toISOString(),
            options: { ...options, responseMode },
            uploadedFile: uploadedFile
              ? {
                  name: uploadedFile.name || '未知文件',
                  type: uploadedFile.type || '未知类型',
                  size: uploadedFile.size || 0,
                }
              : null,
          };

          // 更新对话，添加用户消息和角色信息
          const updates = {
            messages: [userMessage],
            role: selectedRole,
            responseMode: responseMode,
          };
          
          updateConversation(latestConversationId, updates);

          // 导航到聊天页面
          navigate('/chat');

          // 发送消息到API
          try {
            const apiConfig = getApiConfig();
            const roleInfo = getRoleById(selectedRole);
            const systemPrompt = roleInfo.systemPrompt;
            const roleTemperature = roleInfo.temperature;

            const response = await sendMessage(
              [userMessage],
              { 
                ...options, 
                model: apiConfig.model, 
                systemPrompt, 
                temperature: roleTemperature,
                responseMode: responseMode
              },
              latestConversationId
            );

            // 添加AI回复到对话中
            if (response && response.content) {
              const assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: response.content,
                timestamp: new Date().toISOString(),
              };

              updateConversation(latestConversationId, {
                messages: [userMessage, assistantMessage]
              });
            }
          } catch (error) {
            console.error('发送消息失败:', error);
          }
        } else {
          console.error('无法获取对话ID');
        }
      }, 300); // 增加延迟时间
    }
  };

  const handleResponseModeChange = (newMode) => {
    setResponseMode(newMode);
    setLastResponseMode(newMode);
    localStorage.setItem('lastResponseMode', newMode);
  };

  const handleRoleChange = (roleId) => {
    setSelectedRole(roleId);
    saveSelectedRole(roleId);
    setShowRoleDropdown(false);
    window.dispatchEvent(new CustomEvent("roleChanged"));
  };

  const handleQuickPrompt = async (prompt) => {
    const selectedRoleData = roles.find((role) => role.id === selectedRole);
    
    // 创建新对话
    createNewConversation();
    
    // 使用更长的延迟确保状态更新完成
    setTimeout(async () => {
      // 重新获取最新的currentConversationId
      const latestConversationId = currentConversationId;
      
      if (latestConversationId) {
        // 创建用户消息
        const userMessage = {
          id: Date.now().toString(),
          role: "user",
          content: prompt,
          timestamp: new Date().toISOString(),
          options: { responseMode },
          uploadedFile: null,
        };

        // 更新对话，添加用户消息和角色信息
        const updates = {
          messages: [userMessage],
          role: selectedRole,
          responseMode: responseMode,
        };
        
        updateConversation(latestConversationId, updates);

        // 导航到聊天页面
        navigate('/chat');

        // 发送消息到API
        try {
          const apiConfig = getApiConfig();
          const roleInfo = getRoleById(selectedRole);
          const systemPrompt = roleInfo.systemPrompt;
          const roleTemperature = roleInfo.temperature;

          const response = await sendMessage(
            [userMessage],
            { 
              model: apiConfig.model, 
              systemPrompt, 
              temperature: roleTemperature,
              responseMode: responseMode
            },
            latestConversationId
          );

          // 添加AI回复到对话中
          if (response && response.content) {
            const assistantMessage = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: response.content,
              timestamp: new Date().toISOString(),
            };

            updateConversation(latestConversationId, {
              messages: [userMessage, assistantMessage]
            });
          }
        } catch (error) {
          console.error('发送消息失败:', error);
        }
      } else {
        console.error('无法获取对话ID');
      }
    }, 300); // 增加延迟时间
  };

  return (
    <>
      <div className="chat-header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={onToggleSidebar}>
            ☰
          </button>
        </div>
      </div>
      <div className="welcome-screen">
        <div className="welcome-content">
          <div className="welcome-header">
            <h1 className="welcome-title">
              {roles.find((role) => role.id === selectedRole)?.name}{" "}
              {roles.find((role) => role.id === selectedRole)?.icon}
            </h1>
            <p className="welcome-subtitle">
              {roles.find((role) => role.id === selectedRole)?.description}
            </p>
          </div>

        <div className="role-selection">
          <h3 className="section-title">{currentLanguage === "zh" ? "选择AI角色" : "Choose AI Role"}</h3>
          <div className="role-dropdown-container" ref={dropdownRef}>
            <button
              className="role-dropdown-trigger"
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
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

        <div className="welcome-input-section">
          <ChatInput
            onSendMessage={handleSubmit}
            disabled={false}
            showBottomToolbar={true}
            showFileUpload={true}
            placeholder={
              currentLanguage === "zh" 
                ? `和${roles.find((role) => role.id === selectedRole)?.name}开始对话...`
                : `Start chatting with ${roles.find((role) => role.id === selectedRole)?.name}...`
            }
            expandDirection="down"
            className="welcome-chat-input"
            responseMode={responseMode}
            onResponseModeChange={handleResponseModeChange}
            currentModel={apiDefaultModel}
          />
        </div>

        <div className="quick-prompts">
          <h3 className="section-title">{currentLanguage === "zh" ? "快速开始" : "Quick Start"}</h3>
          <div className="prompt-grid">
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                className="prompt-card"
                onClick={() => handleQuickPrompt(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default WelcomeContent;
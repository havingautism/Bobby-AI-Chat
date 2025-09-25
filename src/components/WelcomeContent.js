import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import {
  saveSelectedRole,
  loadSelectedRole,
  getRoleById,
} from "../utils/roles";
import { getCurrentLanguage } from "../utils/language";
import { getApiConfig, sendMessage } from "../utils/api";
import ChatInput from "./ChatInput";
import "./WelcomeScreen.css";

const WelcomeContent = ({
  onToggleSidebar,
  onOpenSettings,
  onOpenKnowledgeBase,
}) => {
  const navigate = useNavigate();
  const {
    createNewConversation,
    updateConversation,
    currentConversationId,
    lastResponseMode,
    setLastResponseMode,
  } = useSession();

  const [selectedRole, setSelectedRole] = useState(loadSelectedRole());
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() =>
    getCurrentLanguage()
  );
  const [responseMode, setResponseMode] = useState(lastResponseMode);
  const [apiDefaultModel, setApiDefaultModel] = useState("");
  const [roles, setRoles] = useState([]);

  // 调试：跟踪roles状态变化
  useEffect(() => {
    console.log("WelcomeContent roles状态更新:", roles);
    console.log("角色数量:", roles?.length || 0);
    console.log(
      "角色列表:",
      roles?.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt })) ||
        []
    );
  }, [roles]);
  const [debugInfo, setDebugInfo] = useState("");
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

  // 加载角色列表
  useEffect(() => {
    const loadRoles = async () => {
      console.log("WelcomeContent开始加载角色...");
      try {
        // 尝试从数据库加载角色
        const { dbManager, getAllRoles } = await import("../utils/database");
        await dbManager.init();

        const rolesFromDB = await getAllRoles();
        console.log("WelcomeContent从数据库加载的角色:", rolesFromDB);
        console.log(
          "数据库角色详情:",
          rolesFromDB?.map((r) => ({
            id: r.id,
            name: r.name,
            createdAt: r.createdAt,
          })) || []
        );

        if (rolesFromDB && rolesFromDB.length > 0) {
          console.log("设置数据库角色到状态");
          setRoles(rolesFromDB);
        } else {
          // 如果数据库中没有角色，使用默认角色
          console.log("数据库中没有角色，使用默认角色");
          const { AI_ROLES } = require("../utils/roles");
          setRoles(AI_ROLES);
        }
      } catch (error) {
        console.error("从数据库加载角色失败，降级到localStorage:", error);

        // 降级到localStorage
        try {
          const savedRoles = localStorage.getItem("ai-roles-updated");
          const customRoles = localStorage.getItem("custom-roles");

          let rolesToUse = [];

          if (savedRoles) {
            rolesToUse = JSON.parse(savedRoles);
          } else if (customRoles) {
            rolesToUse = JSON.parse(customRoles);
          } else {
            // 如果没有保存的角色，使用默认角色
            const { AI_ROLES } = require("../utils/roles");
            rolesToUse = AI_ROLES;
          }

          setRoles(rolesToUse);
        } catch (fallbackError) {
          console.error("从localStorage加载角色也失败:", fallbackError);
          // 最终降级到默认角色
          const { AI_ROLES } = require("../utils/roles");
          setRoles(AI_ROLES);
        }
      }
    };

    loadRoles();

    // 监听角色更新事件
    const handleRolesUpdated = (event) => {
      console.log("WelcomeContent接收到rolesUpdated事件:", event.detail);
      console.log("事件详情 - 角色数量:", event.detail?.length || 0);
      console.log(
        "事件详情 - 角色列表:",
        event.detail?.map((r) => ({
          id: r.id,
          name: r.name,
          createdAt: r.createdAt,
        })) || []
      );
      setRoles(event.detail);
    };

    const handleRolesReset = () => {
      console.log("WelcomeContent接收到rolesReset事件");
      const { AI_ROLES } = require("../utils/roles");
      setRoles(AI_ROLES);
    };

    window.addEventListener("rolesUpdated", handleRolesUpdated);
    window.addEventListener("rolesReset", handleRolesReset);

    return () => {
      window.removeEventListener("rolesUpdated", handleRolesUpdated);
      window.removeEventListener("rolesReset", handleRolesReset);
    };
  }, []);

  // 调试函数 - 检查数据库状态
  const checkDatabaseStatus = async () => {
    try {
      const { dbManager, getAllRoles } = await import("../utils/database");
      await dbManager.init();

      const rolesFromDB = await getAllRoles();
      const localStorageRoles = localStorage.getItem("ai-roles-updated");
      const localStorageCustom = localStorage.getItem("custom-roles");

      const debug = {
        数据库角色数量: rolesFromDB ? rolesFromDB.length : 0,
        数据库角色: rolesFromDB ? rolesFromDB.map((r) => r.name) : [],
        "localStorage(ai-roles-updated)": localStorageRoles
          ? JSON.parse(localStorageRoles).map((r) => r.name)
          : "无",
        "localStorage(custom-roles)": localStorageCustom
          ? JSON.parse(localStorageCustom).map((r) => r.name)
          : "无",
        当前roles状态: roles.map((r) => r.name),
        当前选中角色: selectedRole,
      };

      setDebugInfo(JSON.stringify(debug, null, 2));
      console.log("数据库状态:", debug);
    } catch (error) {
      setDebugInfo("检查失败: " + error.message);
      console.error("检查数据库状态失败:", error);
    }
  };

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

  // roles are now loaded dynamically in the useEffect above

  const quickPrompts =
    currentLanguage === "zh"
      ? [
          "🤔 解释一个复杂的概念",
          "👨🏻‍💻 帮我写一段代码",
          "✨ 创意写作帮助",
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

  const handleSubmit = async (message, uploadedFile, options = {}) => {
    if (message.trim() || uploadedFile) {
      // 创建新对话并获取对话ID
      const newConversationId = createNewConversation();

      // 使用更长的延迟确保状态更新完成
      setTimeout(async () => {
        // 使用新创建的对话ID，如果获取不到则使用currentConversationId
        const latestConversationId = newConversationId || currentConversationId;

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
                  name: uploadedFile.name || "未知文件",
                  type: uploadedFile.type || "未知类型",
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
          navigate("/chat");

          // 发送消息到API
          try {
            const apiConfig = getApiConfig();
            const roleInfo = getRoleById(selectedRole);
            const systemPrompt = roleInfo.systemPrompt;
            const roleTemperature = roleInfo.temperature;

            // 处理图片数据
            let processedMessage = userMessage;
            if (
              uploadedFile &&
              uploadedFile.type === "image" &&
              uploadedFile.file
            ) {
              // 检查当前模型是否支持多模态
              const multimodalModels = [
                "deepseek-ai/deepseek-vl2",
                "deepseek-ai/deepseek-vl",
                "qwen/Qwen-VL-Chat",
                "qwen/Qwen-VL-Plus",
                "qwen/Qwen-VL-Max",
              ];

              if (!multimodalModels.includes(apiConfig.model)) {
                // 当前模型不支持图片，显示错误提示
                const errorMessage = {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: `抱歉，当前模型 ${apiConfig.model} 不支持图片识别功能。\n\n请切换到支持多模态的模型，如：\n• deepseek-ai/deepseek-vl2\n• qwen/Qwen-VL-Chat\n• qwen/Qwen-VL-Plus\n\n您可以在设置中更改模型。`,
                  timestamp: new Date().toISOString(),
                };

                updateConversation(latestConversationId, {
                  messages: [userMessage, errorMessage],
                });
                return; // 不发送API请求
              }

              // 将图片转换为base64并添加到消息内容中
              const reader = new FileReader();
              const imageData = await new Promise((resolve) => {
                reader.onload = (e) => {
                  resolve(e.target.result);
                };
                reader.readAsDataURL(uploadedFile.file);
              });

              // 更新消息内容，包含图片数据
              processedMessage = {
                ...userMessage,
                content:
                  userMessage.content +
                  (userMessage.content ? "\n" : "") +
                  imageData,
              };
            }

            const response = await sendMessage(
              [processedMessage],
              {
                ...options,
                model: apiConfig.model,
                systemPrompt,
                temperature: roleTemperature,
                responseMode: responseMode,
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
                messages: [userMessage, assistantMessage],
              });
            }
          } catch (error) {
            console.error("发送消息失败:", error);

            // 显示错误消息给用户
            const errorMessage = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `发送消息时出现错误：${error.message}\n\n请检查：\n• 网络连接是否正常\n• API配置是否正确\n• 模型是否可用`,
              timestamp: new Date().toISOString(),
            };

            updateConversation(latestConversationId, {
              messages: [userMessage, errorMessage],
            });
          }
        } else {
          console.error("无法获取对话ID");
        }
      }, 300); // 增加延迟时间
    }
  };

  const handleResponseModeChange = (newMode) => {
    setResponseMode(newMode);
    setLastResponseMode(newMode);
    localStorage.setItem("lastResponseMode", newMode);
  };

  const handleRoleChange = (roleId) => {
    setSelectedRole(roleId);
    saveSelectedRole(roleId);
    setShowRoleDropdown(false);
    window.dispatchEvent(new CustomEvent("roleChanged"));
  };

  const handleQuickPrompt = async (prompt) => {
    // 创建新对话并获取对话ID
    const newConversationId = createNewConversation();

    // 使用更长的延迟确保状态更新完成
    setTimeout(async () => {
      // 使用新创建的对话ID，如果获取不到则使用currentConversationId
      const latestConversationId = newConversationId || currentConversationId;

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
        navigate("/chat");

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
              responseMode: responseMode,
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
              messages: [userMessage, assistantMessage],
            });
          }
        } catch (error) {
          console.error("发送消息失败:", error);

          // 显示错误消息给用户
          const errorMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `发送消息时出现错误：${error.message}\n\n请检查：\n• 网络连接是否正常\n• API配置是否正确\n• 模型是否可用`,
            timestamp: new Date().toISOString(),
          };

          updateConversation(latestConversationId, {
            messages: [userMessage, errorMessage],
          });
        }
      } else {
        console.error("无法获取对话ID");
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
            <h3 className="section-title">
              {currentLanguage === "zh" ? "选择AI角色" : "Choose AI Role"}
            </h3>
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
                  {console.log("渲染下拉框，roles数量:", roles?.length || 0)}
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      className={`role-option ${
                        selectedRole === role.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        console.log("选择角色:", role);
                        handleRoleChange(role.id);
                      }}
                    >
                      <span className="role-icon">{role.icon}</span>
                      <div className="role-info">
                        <div className="role-name">{role.name}</div>
                        <div className="role-description">
                          {role.description}
                        </div>
                      </div>
                      {selectedRole === role.id && (
                        <span className="check-mark">✓</span>
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
              currentModel={apiDefaultModel}
            />
          </div>

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
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* 调试面板 */}
          {process.env.NODE_ENV === "development" && (
            <div
              className="debug-panel"
              style={{
                marginTop: "20px",
                padding: "10px",
                backgroundColor: "#f5f5f5",
                borderRadius: "8px",
              }}
            >
              <button
                onClick={checkDatabaseStatus}
                style={{ marginBottom: "10px", padding: "5px 10px" }}
              >
                检查数据库状态
              </button>
              {debugInfo && (
                <pre
                  style={{
                    fontSize: "12px",
                    backgroundColor: "#fff",
                    padding: "10px",
                    borderRadius: "4px",
                    overflow: "auto",
                  }}
                >
                  {debugInfo}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default WelcomeContent;

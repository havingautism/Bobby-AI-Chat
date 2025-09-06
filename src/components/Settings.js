import React, { useState, useEffect, useRef } from "react";
import { getApiConfig, updateApiConfig } from "../utils/api";
import { getCurrentLanguage, t } from "../utils/language";
import { storageAdapter } from "../utils/storageAdapter";
import { isTauriEnvironment } from "../utils/tauriDetector";
import "./Settings.css";

// Tooltip组件
const Tooltip = ({ children, content, position = "top" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);

  const showTooltip = () => setIsVisible(true);
  const hideTooltip = () => setIsVisible(false);

  return (
    <div 
      className="tooltip-container"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      ref={tooltipRef}
    >
      {children}
      {isVisible && (
        <div className={`tooltip tooltip-${position}`}>
          {content}
        </div>
      )}
    </div>
  );
};

const Settings = ({ isOpen, onClose, onModelChange }) => {
  const [config, setConfig] = useState({
    baseURL: "",
    apiKey: "",
    model: "",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1.0,
    thinkingBudget: 1000,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const [storageInfo, setStorageInfo] = useState(null);
  const [dataDirectoryInfo, setDataDirectoryInfo] = useState(null);
  const [currentStorageType, setCurrentStorageType] = useState(() => storageAdapter.getStorageType());
  const [isSwitchingStorage, setIsSwitchingStorage] = useState(false);
  const dropdownRef = useRef(null);
  const [dropdownWidth, setDropdownWidth] = useState(undefined);

  // 获取会话数量的函数
  const getConversationCount = () => {
    if (!storageInfo) return 0;
    
    if (isTauriEnvironment()) {
      // Tauri环境：从SQLite或JSON文件读取
      return storageInfo.conversationCount || storageInfo.conversations?.count || 0;
    } else {
      // 移动端/Web环境：从IndexedDB读取
      return storageInfo.conversationCount || 0;
    }
  };

  // 硅基流动模型列表，按类型排序（与ModelSelector保持一致）
  const siliconFlowModels = {
    latest: {
      name: currentLanguage === "zh" ? "最新模型" : "Latest Models",
      models: [
        { id: "deepseek-ai/DeepSeek-V3.1", name: "DeepSeek-V3.1", description: "最新对话模型", isPro: false },
        { id: "Pro/deepseek-ai/DeepSeek-V3.1", name: "DeepSeek-V3.1", description: "最新对话模型", isPro: true },
        { id: "stepfun-ai/step3", name: "Step-3", description: "阶跃模型", isPro: false },
      ]
    },
    qwen3: {
      name: currentLanguage === "zh" ? "通义千问3系列" : "Qwen3 Series",
      models: [
        { id: "Qwen/Qwen3-Coder-30B-A3B-Instruct", name: "Qwen3-Coder-30B-A3B-Instruct", description: "编程专用模型", isPro: false },
        { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", name: "Qwen3-Coder-480B-A35B-Instruct", description: "超大编程模型", isPro: false },
        { id: "Qwen/Qwen3-30B-A3B-Thinking-2507", name: "Qwen3-30B-A3B-Thinking-2507", description: "思维链模型", isPro: false },
        { id: "Qwen/Qwen3-30B-A3B-Instruct-2507", name: "Qwen3-30B-A3B-Instruct-2507", description: "指令调优模型", isPro: false },
        { id: "Qwen/Qwen3-235B-A22B-Thinking-2507", name: "Qwen3-235B-A22B-Thinking-2507", description: "超大思维模型", isPro: false },
        { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", name: "Qwen3-235B-A22B-Instruct-2507", description: "超大指令模型", isPro: false },
        { id: "Qwen/Qwen3-30B-A3B", name: "Qwen3-30B-A3B", description: "基础模型", isPro: false },
        { id: "Qwen/Qwen3-32B", name: "Qwen3-32B", description: "中型模型", isPro: false },
        { id: "Qwen/Qwen3-14B", name: "Qwen3-14B", description: "小型模型", isPro: false },
        { id: "Qwen/Qwen3-8B", name: "Qwen3-8B", description: "轻量模型", isPro: false },
        { id: "Qwen/Qwen3-235B-A22B", name: "Qwen3-235B-A22B", description: "超大基础模型", isPro: false },
      ]
    },
    reasoning: {
      name: currentLanguage === "zh" ? "推理模型" : "Reasoning Models",
      models: [
        { id: "Pro/deepseek-ai/DeepSeek-R1", name: "DeepSeek-R1", description: "高级推理模型", isPro: true },
        { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek-R1", description: "高级推理模型", isPro: false },
        { id: "Qwen/QwQ-32B", name: "QwQ-32B", description: "通义推理模型", isPro: false },
        { id: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", name: "DeepSeek-R1-0528-Qwen3-8B", description: "R1+Qwen3混合", isPro: false },
        { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", name: "DeepSeek-R1-Distill-Qwen-32B", description: "蒸馏推理模型", isPro: false },
        { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B", name: "DeepSeek-R1-Distill-Qwen-14B", description: "中型蒸馏模型", isPro: false },
        { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", name: "DeepSeek-R1-Distill-Qwen-7B", description: "轻量蒸馏模型", isPro: false },
        { id: "Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", name: "DeepSeek-R1-Distill-Qwen-7B", description: "轻量蒸馏模型", isPro: true },
        { id: "THUDM/GLM-Z1-32B-0414", name: "GLM-Z1-32B-0414", description: "智谱推理模型", isPro: false },
        { id: "THUDM/GLM-Z1-Rumination-32B-0414", name: "GLM-Z1-Rumination-32B-0414", description: "深度思考模型", isPro: false },
      ]
    },
    chat: {
      name: currentLanguage === "zh" ? "对话模型" : "Chat Models",
      models: [
        { id: "Pro/deepseek-ai/DeepSeek-V3", name: "DeepSeek-V3", description: "对话模型", isPro: true },
        { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek-V3", description: "对话模型", isPro: false },
        { id: "deepseek-ai/DeepSeek-V2.5", name: "DeepSeek-V2.5", description: "对话模型V2.5", isPro: false },
        { id: "zai-org/GLM-4.5-Air", name: "GLM-4.5-Air", description: "智谱轻量模型", isPro: false },
        { id: "zai-org/GLM-4.5", name: "GLM-4.5", description: "智谱对话模型", isPro: false },
        { id: "baidu/ERNIE-4.5-300B-A47B", name: "ERNIE-4.5-300B-A47B", description: "百度文心模型", isPro: false },
        { id: "moonshotai/Kimi-K2-Instruct", name: "Kimi-K2-Instruct", description: "月之暗面模型", isPro: false },
        { id: "ascend-tribe/pangu-pro-moe", name: "PanGu-Pro-MoE", description: "华为盘古模型", isPro: false },
        { id: "tencent/Hunyuan-A13B-Instruct", name: "Hunyuan-A13B-Instruct", description: "腾讯混元模型", isPro: false },
        { id: "MiniMaxAI/MiniMax-M1-80k", name: "MiniMax-M1-80k", description: "海螺模型", isPro: false },
        { id: "Tongyi-Zhiwen/QwenLong-L1-32B", name: "QwenLong-L1-32B", description: "长文本模型", isPro: false },
        { id: "THUDM/GLM-4-32B-0414", name: "GLM-4-32B-0414", description: "智谱GLM-4", isPro: false },
        { id: "THUDM/GLM-4-9B-0414", name: "GLM-4-9B-0414", description: "智谱GLM-4小型", isPro: false },
        { id: "TeleAI/TeleChat2", name: "TeleChat2", description: "电信天翼模型", isPro: false },
        { id: "THUDM/glm-4-9b-chat", name: "GLM-4-9B-Chat", description: "智谱聊天模型", isPro: false },
        { id: "Pro/THUDM/glm-4-9b-chat", name: "GLM-4-9B-Chat", description: "智谱聊天模型", isPro: true },
        { id: "internlm/internlm2_5-7b-chat", name: "InternLM2.5-7B-Chat", description: "书生浦语模型", isPro: false },
      ]
    },
    qwen25: {
      name: currentLanguage === "zh" ? "通义千问2.5系列" : "Qwen2.5 Series",
      models: [
        { id: "Qwen/Qwen2.5-72B-Instruct-128K", name: "Qwen2.5-72B-Instruct-128K", description: "长上下文模型", isPro: false },
        { id: "Qwen/Qwen2.5-72B-Instruct", name: "Qwen2.5-72B-Instruct", description: "大型模型", isPro: false },
        { id: "Qwen/Qwen2.5-32B-Instruct", name: "Qwen2.5-32B-Instruct", description: "中型模型", isPro: false },
        { id: "Qwen/Qwen2.5-14B-Instruct", name: "Qwen2.5-14B-Instruct", description: "小型模型", isPro: false },
        { id: "Qwen/Qwen2.5-7B-Instruct", name: "Qwen2.5-7B-Instruct", description: "轻量模型", isPro: false },
        { id: "Pro/Qwen/Qwen2.5-7B-Instruct", name: "Qwen2.5-7B-Instruct", description: "轻量模型", isPro: true },
        { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen2.5-Coder-32B-Instruct", description: "编程模型", isPro: false },
        { id: "Qwen/Qwen2.5-Coder-7B-Instruct", name: "Qwen2.5-Coder-7B-Instruct", description: "轻量编程模型", isPro: false },
        { id: "Qwen/Qwen2-7B-Instruct", name: "Qwen2-7B-Instruct", description: "通义千问2代", isPro: false },
        { id: "Pro/Qwen/Qwen2-7B-Instruct", name: "Qwen2-7B-Instruct", description: "通义千问2代", isPro: true },
        { id: "Vendor-A/Qwen/Qwen2.5-72B-Instruct", name: "Qwen2.5-72B-Instruct (Vendor-A)", description: "第三方部署", isPro: false },
      ]
    }
  };

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        const currentConfig = getApiConfig();
        
        // 使用全局默认模型，而不是当前对话的模型
        const modelToUse = currentConfig.model || "deepseek-ai/DeepSeek-V3.1";
        
        setConfig({
          ...currentConfig,
          model: modelToUse
        });
        
        // 加载存储信息
        try {
          console.log('开始加载存储信息...');
          const info = await storageAdapter.getStorageInfo();
          console.log('存储信息加载成功:', info);
          setStorageInfo(info);
        } catch (error) {
          console.error('加载存储信息失败:', error);
          setStorageInfo({
            error: error.message,
            dbPath: '加载失败',
            dbSize: '未知',
            conversationCount: 0,
            messageCount: 0,
            apiSessionCount: 0,
            knowledgeDocumentCount: 0,
            settingCount: 0
          });
        }
        
        // 加载数据目录信息
        const dirInfo = storageAdapter.getDataDirectoryInfo();
        setDataDirectoryInfo(dirInfo);
        
        // 自动初始化为硅基流动配置
        if (!currentConfig.baseURL) {
          setConfig((prev) => ({
            ...prev,
            baseURL: "https://api.siliconflow.cn/v1",
            model: prev.model || "deepseek-ai/DeepSeek-V3.1",
          }));
        }
      };
      loadData();
    }
  }, [isOpen]);

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

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showModelDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModelDropdown]);

  const handleClearHistory = async () => {
    if (window.confirm("确定要清除所有聊天历史吗？此操作不可撤销。")) {
      await storageAdapter.clearChatHistory();
      // 重新加载存储信息
      try {
        const info = await storageAdapter.getStorageInfo();
        setStorageInfo(info);
      } catch (error) {
        console.error('重新加载存储信息失败:', error);
      }
      alert("聊天历史已清除");
    }
  };

  // 切换存储类型
  const handleSwitchStorage = async (targetType) => {
    if (isSwitchingStorage) return;
    
    setIsSwitchingStorage(true);
    try {
      if (targetType === 'sqlite') {
        await storageAdapter.switchToSQLite();
        setSaveMessage("已成功切换到SQLite数据库存储");
      } else if (targetType === 'json') {
        await storageAdapter.switchToJsonStorage();
        setSaveMessage("已成功切换到JSON文件存储");
      }
      
      setSaveSuccess(true);
      setCurrentStorageType(storageAdapter.getStorageType());
      
      // 重新加载存储信息
      try {
        const info = await storageAdapter.getStorageInfo();
        setStorageInfo(info);
      } catch (error) {
        console.error('重新加载存储信息失败:', error);
      }
      
      setTimeout(() => {
        setSaveMessage("");
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      setSaveMessage(`切换存储类型失败: ${error.message}`);
      setSaveSuccess(false);
      setTimeout(() => {
        setSaveMessage("");
      }, 5000);
    } finally {
      setIsSwitchingStorage(false);
    }
  };

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleModelChange = (modelId) => {
    handleInputChange("model", modelId);
    setShowModelDropdown(false);
    // 通知父组件模型已改变
    if (onModelChange) {
      onModelChange(modelId);
    }
  };

  const toggleModelDropdown = () => {
    const newShowState = !showModelDropdown;
    
    if (newShowState) {
      // 计算下拉菜单位置
      const container = dropdownRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        setDropdownWidth(rect.width);
        
        // 如果下方空间不足，则向上显示
        if (spaceBelow < 300 && spaceAbove > 300) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }
    }
    
    setShowModelDropdown(newShowState);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setSaveSuccess(false);

    try {
      // 验证必填字段
      if (!config.baseURL || !config.apiKey || !config.model) {
        throw new Error("请填写所有必填字段");
      }

      // 更新API配置
      updateApiConfig(config);

      // 通知父组件模型已改变
      if (onModelChange) {
        onModelChange(config.model);
      }

      setSaveSuccess(true);
      // 3秒后关闭设置窗口
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 3000);
    } catch (error) {
      setSaveMessage(`保存失败: ${error.message}`);
      // 5秒后清除错误消息
      setTimeout(() => {
        setSaveMessage("");
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestSuccess(false);
    setTestMessage("");

    try {
      // 使用当前配置进行测试
      const testConfig = { ...config };
      updateApiConfig(testConfig);

      // 发送测试消息
      const { sendMessage } = await import("../utils/api");
      const testMessages = [
        { role: "user", content: "你好，这是一个连接测试。" },
      ];

      await sendMessage(testMessages);
      setTestSuccess(true);
      setTestMessage("连接测试成功！");
      
      // 3秒后重置状态
      setTimeout(() => {
        setTestSuccess(false);
        setTestMessage("");
      }, 3000);
    } catch (error) {
      setTestSuccess(false);
      setTestMessage(`连接测试失败: ${error.message}`);
      
      // 5秒后清除错误消息
      setTimeout(() => {
        setTestMessage("");
      }, 5000);
    } finally {
      setIsTesting(false);
    }
  };


  const handleOpenDataDirectory = async () => {
    try {
      // 仅在Tauri环境中打开文件管理器
      if (isTauriEnvironment()) {
        const { open } = await import('@tauri-apps/plugin-shell');
        const dirInfo = storageAdapter.getDataDirectoryInfo();
        if (dirInfo && dirInfo.path) {
          await open(dirInfo.path);
        } else {
          setSaveMessage("无法获取数据目录路径");
          setTimeout(() => setSaveMessage(""), 3000);
        }
      }
    } catch (error) {
      setSaveMessage(`打开目录失败: ${error.message}`);
      setTimeout(() => setSaveMessage(""), 5000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t("settings", currentLanguage)}</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="settings-content">
          {/* API服务商 */}
          <div className="setting-group">
            <label>API服务商</label>
            <div className="provider-card">
              <div className="provider-logo">
                <svg height="1em" style={{flex:'none',lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>SiliconCloud</title><path clip-rule="evenodd" d="M22.956 6.521H12.522c-.577 0-1.044.468-1.044 1.044v3.13c0 .577-.466 1.044-1.043 1.044H1.044c-.577 0-1.044.467-1.044 1.044v4.174C0 17.533.467 18 1.044 18h10.434c.577 0 1.044-.467 1.044-1.043v-3.13c0-.578.466-1.044 1.043-1.044h9.391c.577 0 1.044-.467 1.044-1.044V7.565c0-.576-.467-1.044-1.044-1.044z" fill="#6E29F6" fill-rule="evenodd"></path></svg>
              </div>
              <div className="provider-info">
                <div className="provider-name">硅基流动</div>
                <div className="provider-english">SiliconFlow</div>
              </div>
            </div>
          </div>

          {/* API密钥 */}
          <div className="setting-group">
            <label>API密钥 *</label>
            <div className="api-key-container">
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => handleInputChange("apiKey", e.target.value)}
                placeholder="请输入硅基流动API密钥"
                className="setting-input api-key-input"
              />
              <button
                className={`test-button ${testSuccess ? 'success' : ''}`}
                onClick={handleTestConnection}
                disabled={
                  isTesting || 
                  !config.baseURL || 
                  !config.apiKey || 
                  !config.model ||
                  testSuccess
                }
              >
                {isTesting ? "测试中..." : testSuccess ? "连接成功 ✓" : "测试连接"}
              </button>
            </div>
          </div>

          {/* 模型选择 */}
          <div className="setting-group">
            <label>默认模型选择 *</label>
            <div className="simple-dropdown" ref={dropdownRef}>
              <button
                type="button"
                className="dropdown-trigger"
                onClick={toggleModelDropdown}
              >
                <div className="dropdown-display">
                  {config.model ? (
                    <>
                      <div className="dropdown-info">
                        <div className="dropdown-name">
                          {(() => {
                            const selectedModel = Object.values(siliconFlowModels)
                              .flatMap(category => category.models)
                              .find(model => model.id === config.model);
                            return selectedModel ? (
                              <>
                                {selectedModel.name}
                                {selectedModel.isPro && <span className="pro-badge">Pro</span>}
                              </>
                            ) : (
                              "请选择模型"
                            );
                          })()}
                        </div>
                        <div className="dropdown-description">
                          {(() => {
                            const selectedModel = Object.values(siliconFlowModels)
                              .flatMap(category => category.models)
                              .find(model => model.id === config.model);
                            return selectedModel ? selectedModel.description : "";
                          })()}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="dropdown-info">
                        <div className="dropdown-name">请选择模型</div>
                        <div className="dropdown-description">选择适合的AI模型</div>
                      </div>
                    </>
                  )}
                </div>
                <svg
                  className={`dropdown-arrow ${showModelDropdown ? "open" : ""}`}
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

              {showModelDropdown && (
                <div className={`dropdown-menu ${dropdownPosition}`}
                     style={{  width: dropdownWidth, right: 'auto' }}>
                  {Object.entries(siliconFlowModels).map(([categoryKey, category]) => (
                    <div key={categoryKey} className="dropdown-category">
                      <div className="dropdown-category-header">{category.name}</div>
                      {category.models.map((model) => (
                        <button
                          key={model.id}
                          className={`dropdown-option ${
                            config.model === model.id ? "selected" : ""
                          }`}
                          onClick={() => handleModelChange(model.id)}
                        >
                          <div className="dropdown-option-info">
                            <div className="dropdown-option-name">
                              {model.name}
                              {model.isPro && <span className="pro-badge">Pro</span>}
                            </div>
                            <div className="dropdown-option-description">
                              {model.description}
                            </div>
                          </div>
                          {config.model === model.id && (
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
                  ))}
                </div>
              )}
            </div>
            <div className="setting-hint">
              推荐: DeepSeek-V3.1 (最新) | DeepSeek-R1 (推理) | Qwen3系列 (编程) | Pro版本性能更强
            </div>
          </div>


          {/* 高级设置 */}
          <details className="advanced-settings">
            <summary>高级设置</summary>
            <div className="advanced-content">
              {/* API地址 */}
              <div className="setting-group">
                <label>
                  API地址
                  <Tooltip content="硅基流动API服务地址，通常不需要修改">
                    <span className="tooltip-trigger">?</span>
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={config.baseURL}
                  onChange={(e) => handleInputChange("baseURL", e.target.value)}
                  placeholder="https://api.siliconflow.cn/v1"
                  className="setting-input"
                />
              </div>
              
              {/* 第一行：温度和Top P */}
              <div className="setting-row">
                <div className="setting-group">
                  <label>
                    温度 (0-2)
                    <Tooltip content="控制回复的随机性，值越高越随机，值越低越确定">
                      <span className="tooltip-trigger">?</span>
                    </Tooltip>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) =>
                      handleInputChange("temperature", parseFloat(e.target.value))
                    }
                    className="setting-input"
                  />
                </div>

                <div className="setting-group">
                  <label>
                    Top P (0-1)
                    <Tooltip content="控制输出的多样性，值越小越保守，值越大越随机">
                      <span className="tooltip-trigger">?</span>
                    </Tooltip>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.topP}
                    onChange={(e) =>
                      handleInputChange("topP", parseFloat(e.target.value))
                    }
                    className="setting-input"
                  />
                </div>
              </div>

              {/* 第二行：Thinking Budget和最大令牌数 */}
              <div className="setting-row">
                <div className="setting-group">
                  <label>
                    Thinking Budget
                    <Tooltip content="思考模式的预算限制，控制AI推理过程的长度，仅对支持思考链的模型有效">
                      <span className="tooltip-trigger">?</span>
                    </Tooltip>
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={config.thinkingBudget}
                    onChange={(e) =>
                      handleInputChange("thinkingBudget", parseInt(e.target.value))
                    }
                    className="setting-input"
                  />
                </div>

                <div className="setting-group">
                  <label>
                    最大令牌数
                    <Tooltip content="单次对话的最大输出长度，影响回复的详细程度">
                      <span className="tooltip-trigger">?</span>
                    </Tooltip>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8000"
                    value={config.maxTokens}
                    onChange={(e) =>
                      handleInputChange("maxTokens", parseInt(e.target.value))
                    }
                    className="setting-input"
                  />
                </div>
              </div>
              
              {/* 存储信息 */}
              <div className="setting-group">
                <label>存储信息</label>
                {storageInfo ? (
                  <div className="storage-info">
                    <div className="storage-stats">
                      <p>对话数量: {getConversationCount()}</p>
                      <p>总大小: {storageInfo.totalSize}</p>
                      <p>存储类型: {currentStorageType === 'sqlite' ? 'SQLite数据库' : 
                                   currentStorageType === 'tauri' ? 'JSON文件' : 'IndexedDB'}</p>
                    </div>
                    
                    {/* 存储类型切换 - 仅在Tauri环境中显示 */}
                    {isTauriEnvironment() && (
                      <div className="storage-type-section">
                        <h4>存储类型切换</h4>
                        <div className="storage-buttons">
                          <button 
                            className={`storage-button ${currentStorageType === 'sqlite' ? 'active' : ''}`}
                            onClick={() => handleSwitchStorage('sqlite')}
                            disabled={isSwitchingStorage || currentStorageType === 'sqlite'}
                          >
                            {isSwitchingStorage && currentStorageType !== 'sqlite' ? '切换中...' : 'SQLite数据库'}
                          </button>
                          <button 
                            className={`storage-button ${currentStorageType === 'tauri' ? 'active' : ''}`}
                            onClick={() => handleSwitchStorage('json')}
                            disabled={isSwitchingStorage || currentStorageType === 'tauri'}
                          >
                            {isSwitchingStorage && currentStorageType !== 'tauri' ? '切换中...' : 'JSON文件'}
                          </button>
                        </div>
                        <div className="storage-description">
                          <p><strong>SQLite数据库:</strong> 支持向量搜索，性能更好，适合大量数据</p>
                          <p><strong>JSON文件:</strong> 简单易用，兼容性好，适合小量数据</p>
                        </div>
                      </div>
                    )}
                    
                    {/* 打开数据目录 - 仅在Tauri环境中显示 */}
                    {isTauriEnvironment() && (
                      <div className="data-directory-section">
                        <button 
                          className="secondary-button" 
                          onClick={handleOpenDataDirectory}
                        >
                          📁 打开数据目录
                        </button>
                        {dataDirectoryInfo && (
                          <div className="directory-info">
                            <small>数据目录: {dataDirectoryInfo.path}</small>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <button 
                      className="danger-button" 
                      onClick={handleClearHistory}
                    >
                      清除所有聊天历史
                    </button>
                  </div>
                ) : (
                  <p>加载中...</p>
                )}
              </div>
            </div>
          </details>
          
          {/* 保存消息 */}
          {saveMessage && (
            <div
              className={`save-message ${
                saveMessage.includes("失败") || saveMessage.includes("错误")
                  ? "error"
                  : "success"
              }`}
            >
              {saveMessage}
            </div>
          )}
        </div>

        <div className="settings-footer">
          {/* 状态信息显示区域 */}
          <div className="status-section">
            {saveMessage && (
              <div className={`status-message ${
                saveMessage.includes("成功") ? "success" : "error"
              }`}>
                {saveMessage}
              </div>
            )}
           
          </div>
          
          <div className="footer-buttons">
            <button className="cancel-button" onClick={onClose}>
              取消
            </button>
            <button
              className={`save-button ${saveSuccess ? 'success' : ''}`}
              onClick={handleSave}
              disabled={
                isSaving || 
                !config.baseURL || 
                !config.apiKey || 
                !config.model ||
                saveSuccess
              }
            >
              {isSaving ? "保存中..." : saveSuccess ? "保存成功 ✓" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from 'react-dom';
import { getApiConfig, updateApiConfig } from "../utils/api";
import { getCurrentLanguage, t } from "../utils/language";
import { storageAdapter } from "../utils/storageAdapter";
import { isTauriEnvironment } from "../utils/tauriDetector";
import ModelIcon from "./ModelIcon";
import { getAllModelGroups, getAllModels } from "../utils/database";
import { DEFAULT_MODEL_GROUPS, DEFAULT_MODELS, mergeModelsWithDefaults } from "../utils/defaultModelConfig";
import "./Settings.css";

// 优化的Tooltip组件
const Tooltip = React.memo(({ children, content, position = "top" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);

  const showTooltip = useCallback(() => setIsVisible(true), []);
  const hideTooltip = useCallback(() => setIsVisible(false), []);

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
});

// 优化的模型选项组件
const ModelOption = React.memo(({ 
  model, 
  isSelected, 
  onSelect, 
  isMobile 
}) => {
  const handleClick = useCallback(() => {
    onSelect(model.id);
  }, [model.id, onSelect]);

  return (
    <button
      className={`dropdown-option ${isSelected ? "selected" : ""}`}
      onClick={handleClick}
      style={{
        willChange: 'transform',
        transform: isSelected ? 'translateX(2px)' : 'none'
      }}
    >
      <ModelIcon modelId={model.id} size={16} className={model.isPro ? 'pro' : ''} />
      <div className="dropdown-option-info">
        <div className="dropdown-option-name">
          {model.name}
          {model.isPro && <span className="pro-badge">PRO</span>}
        </div>
        <div className="dropdown-option-description">
          {model.description}
        </div>
      </div>
      {isSelected && (
        <svg className="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </button>
  );
});

// 优化的模型分类组件
const ModelCategory = React.memo(({ 
  category, 
  selectedModel, 
  onModelSelect, 
  isMobile 
}) => {
  return (
    <div className="dropdown-category">
      <div className="dropdown-category-header">{category.name}</div>
      {category.models.map((model) => (
        <ModelOption
          key={model.id}
          model={model}
          isSelected={selectedModel === model.id}
          onSelect={onModelSelect}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
});

const Settings = ({ isOpen, onClose, onModelChange }) => {
  const [activeTab, setActiveTab] = useState('model-service'); // 默认显示模型服务标签页
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
  const [currentStorageType, setCurrentStorageType] = useState(() => storageAdapter.getStorageType());
  const dropdownRef = useRef(null);
  const [dropdownWidth, setDropdownWidth] = useState(undefined);
  
  // 检测是否为移动设备
  const isMobile = useMemo(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }, []);

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

  // 从模型管理获取（合并默认+自定义）的模型分组
  const [modelCategories, setModelCategories] = useState({});

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

        // 加载模型分组与模型（以模型管理为准）
        try {
          const savedGroups = await getAllModelGroups() || [];
          const savedModels = await getAllModels() || [];
          const { mergedGroups, mergedModels } = mergeModelsWithDefaults(
            DEFAULT_MODEL_GROUPS,
            DEFAULT_MODELS,
            savedGroups,
            savedModels
          );
          // 仅使用启用的模型，按分组组织
          const categories = {};
          mergedGroups.forEach(group => {
            categories[group.id] = {
              name: group.name,
              models: []
            };
          });
          mergedModels.filter(m => m.enabled !== false).forEach(model => {
            if (categories[model.groupId]) {
              categories[model.groupId].models.push({
                id: model.modelId,
                name: model.name,
                description: model.description || '',
                isPro: !!model.isPro
              });
            }
          });
          setModelCategories(categories);
        } catch (e) {
          console.error('加载模型列表失败，使用默认列表:', e);
          const categories = {};
          DEFAULT_MODEL_GROUPS.forEach(group => {
            categories[group.id] = { name: group.name, models: [] };
          });
          DEFAULT_MODELS.forEach(model => {
            if (categories[model.groupId]) {
              categories[model.groupId].models.push({
                id: model.modelId,
                name: model.name,
                description: model.description || '',
                isPro: !!model.isPro
              });
            }
          });
          setModelCategories(categories);
        }
        
        
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

  // 锁定背景滚动与 ESC 关闭（Hook 必须在任何 return 之前）
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous || 'unset';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
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

        {/* 标签页导航 */}
        <div className="settings-tabs">
          <button 
            className={`tab-button ${activeTab === 'model-service' ? 'active' : ''}`}
            onClick={() => setActiveTab('model-service')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            模型服务
          </button>
          <button 
            className={`tab-button ${activeTab === 'global-memory' ? 'active' : ''}`}
            onClick={() => setActiveTab('global-memory')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4"/>
              <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
              <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
              <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
              <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
            </svg>
            全局记忆
          </button>
          <button 
            className={`tab-button ${activeTab === 'web-search' ? 'active' : ''}`}
            onClick={() => setActiveTab('web-search')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            网络搜索
          </button>
        </div>

        <div className="settings-content">
          {/* 模型服务标签页 */}
          {activeTab === 'model-service' && (
            <div className="tab-content">
              {/* API服务商 */}
              <div className="setting-group">
            <label>API服务商</label>
            <div className="provider-card">
              <div className="provider-logo">
                <svg height="1em" style={{flex:'none',lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>SiliconCloud</title><path clipRule="evenodd" d="M22.956 6.521H12.522c-.577 0-1.044.468-1.044 1.044v3.13c0 .577-.466 1.044-1.043 1.044H1.044c-.577 0-1.044.467-1.044 1.044v4.174C0 17.533.467 18 1.044 18h10.434c.577 0 1.044-.467 1.044-1.043v-3.13c0-.578.466-1.044 1.043-1.044h9.391c.577 0 1.044-.467 1.044-1.044V7.565c0-.576-.467-1.044-1.044-1.044z" fill="#6E29F6" fillRule="evenodd"></path></svg>
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
                            const selectedModel = Object.values(modelCategories)
                              .flatMap(category => category.models)
                              .find(model => model.id === config.model);
                            return selectedModel ? (
                              <>
                                <ModelIcon modelId={selectedModel.id} size={16} className="settings-model-icon" />
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
                            const selectedModel = Object.values(modelCategories)
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
                  {Object.entries(modelCategories).map(([categoryKey, category]) => (
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
                          <ModelIcon modelId={model.id} size={16} className={model.isPro ? 'pro' : ''} />
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
            </div>
          )}

          {/* 全局记忆标签页 */}
          {activeTab === 'global-memory' && (
            <div className="tab-content">
              <div className="setting-group">
                <label>全局记忆功能</label>
                <div className="feature-description">
                  <p>全局记忆功能允许AI记住跨对话的重要信息，提供更个性化的体验。</p>
                </div>
                
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                    />
                    <span className="checkmark"></span>
                    启用全局记忆
                  </label>
                  <p className="setting-description">允许AI记住用户偏好和重要信息</p>
                </div>

                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                    />
                    <span className="checkmark"></span>
                    自动记忆重要信息
                  </label>
                  <p className="setting-description">AI自动识别并记忆对话中的重要信息</p>
                </div>

                <div className="setting-item">
                  <label>记忆保留时间</label>
                  <select className="setting-input">
                    <option value="7">7天</option>
                    <option value="30">30天</option>
                    <option value="90">90天</option>
                    <option value="365">1年</option>
                    <option value="permanent">永久</option>
                  </select>
                </div>

                <div className="setting-item">
                  <button className="danger-button">
                    清除所有记忆
                  </button>
                  <p className="setting-description">删除所有已保存的全局记忆信息</p>
                </div>
              </div>
            </div>
          )}

          {/* 网络搜索标签页 */}
          {activeTab === 'web-search' && (
            <div className="tab-content">
              <div className="setting-group">
                <label>网络搜索功能</label>
                <div className="feature-description">
                  <p>网络搜索功能允许AI获取实时信息，提供更准确和最新的回答。</p>
                </div>
                
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                    />
                    <span className="checkmark"></span>
                    启用网络搜索
                  </label>
                  <p className="setting-description">允许AI搜索网络获取实时信息</p>
                </div>

                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                    />
                    <span className="checkmark"></span>
                    自动搜索最新信息
                  </label>
                  <p className="setting-description">当AI检测到需要最新信息时自动搜索</p>
                </div>

                <div className="setting-item">
                  <label>搜索引擎</label>
                  <select className="setting-input">
                    <option value="google">Google</option>
                    <option value="bing">Bing</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label>搜索API密钥</label>
                  <input
                    type="password"
                    placeholder="请输入搜索引擎API密钥"
                    className="setting-input"
                  />
                  <p className="setting-description">用于访问搜索引擎API的密钥</p>
                </div>

                <div className="setting-item">
                  <label>搜索结果数量</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="3"
                    className="setting-input"
                  />
                  <p className="setting-description">每次搜索返回的结果数量</p>
                </div>
              </div>
            </div>
          )}
          
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
    </div>,
    document.body
  );
};

export default Settings;

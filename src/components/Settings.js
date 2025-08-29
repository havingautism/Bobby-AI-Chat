import React, { useState, useEffect, useRef } from "react";
import { getApiConfig, updateApiConfig, testTitleGeneration } from "../utils/api";
import { getCurrentLanguage } from "../utils/language";
import "./Settings.css";

const Settings = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState({
    baseURL: "",
    apiKey: "",
    model: "",
    temperature: 0.7,
    maxTokens: 2000,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const modelDropdownRef = useRef(null);

  // 硅基流动模型列表，按类型排序
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
      const currentConfig = getApiConfig();
      setConfig(currentConfig);
      // 自动初始化为硅基流动配置
      if (!currentConfig.baseURL) {
        setConfig((prev) => ({
          ...prev,
          baseURL: "https://api.siliconflow.cn/v1/chat/completions",
          model: prev.model || "deepseek-ai/DeepSeek-V3.1",
        }));
      }
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

  // 点击外部关闭模型下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleModelChange = (modelId) => {
    handleInputChange("model", modelId);
    setShowModelDropdown(false);
  };

  const toggleModelDropdown = () => {
    if (!showModelDropdown) {
      // 计算下拉菜单位置
      const container = modelDropdownRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // 如果下方空间不足，则向上显示
        if (spaceBelow < 300 && spaceAbove > 300) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }
    }
    setShowModelDropdown(!showModelDropdown);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      // 验证必填字段
      if (!config.baseURL || !config.apiKey || !config.model) {
        throw new Error("请填写所有必填字段");
      }

      // 更新API配置
      updateApiConfig(config);

      setSaveMessage("设置保存成功！");
      setTimeout(() => {
        setSaveMessage("");
        onClose();
      }, 1500);
    } catch (error) {
      setSaveMessage(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsSaving(true);
    setSaveMessage("正在测试连接...");

    try {
      // 临时更新配置进行测试
      const tempConfig = { ...config };
      updateApiConfig(tempConfig);

      // 发送测试消息
      const { sendMessage } = await import("../utils/api");
      const testMessages = [
        { role: "user", content: "你好，这是一个连接测试。" },
      ];

      await sendMessage(testMessages);
      setSaveMessage("连接测试成功！");
    } catch (error) {
      setSaveMessage(`连接测试失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestTitleGeneration = async () => {
    setIsTesting(true);
    setTestMessage("正在测试标题生成...");

    try {
      // 临时更新配置进行测试
      const tempConfig = { ...config };
      updateApiConfig(tempConfig);

      // 测试标题生成
      const result = await testTitleGeneration();
      
      if (result.success) {
        setTestMessage(`标题生成测试成功！生成的标题: "${result.title}"`);
      } else {
        setTestMessage(`标题生成测试失败: ${result.error}`);
      }
    } catch (error) {
      setTestMessage(`标题生成测试失败: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>设置</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="setting-group">
            <label>API服务商</label>
            <div className="provider-card">
              <div className="provider-logo">
                <svg height="1em" style={{flex:'none',lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>SiliconCloud</title><path clip-rule="evenodd" d="M22.956 6.521H12.522c-.577 0-1.044.468-1.044 1.044v3.13c0 .577-.466 1.044-1.043 1.044H1.044c-.577 0-1.044.467-1.044 1.044v4.174C0 17.533.467 18 1.044 18h10.434c.577 0 1.044-.467 1.044-1.043v-3.13c0-.578.466-1.044 1.043-1.044h9.391c.577 0 1.044-.467 1.044-1.044V7.565c0-.576-.467-1.044-1.044-1.044z" fill="#6E29F6" fill-rule="evenodd"></path></svg>
              </div>
              <div className="provider-info">
                <div className="provider-name">硅基流动</div>
                <div className="provider-english">SiliconFlow</div>
                {/* <div className="provider-description">国内访问友好，性价比高</div> */}
              </div>
            </div>
          </div>

          <div className="setting-group">
            <label>API密钥 *</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => handleInputChange("apiKey", e.target.value)}
              placeholder="请输入硅基流动API密钥"
              className="setting-input"
            />
          </div>

          <div className="setting-group">
            <label>模型选择 *</label>
            <div className="model-dropdown-container" ref={modelDropdownRef}>
                              <button
                  type="button"
                  className="model-dropdown-trigger"
                  onClick={toggleModelDropdown}
                >
                <div className="model-display">
                  {config.model ? (
                    <>
                      <div className="model-info">
                        <div className="model-name">
                          {(() => {
                            const selectedModel = Object.values(siliconFlowModels)
                              .flatMap(category => category.models)
                              .find(model => model.id === config.model);
                            return selectedModel ? 
                              `${selectedModel.isPro ? "Pro/" : ""}${selectedModel.name}` : 
                              "请选择模型";
                          })()}
                        </div>
                        <div className="model-description">
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
                      <div className="model-info">
                        <div className="model-name">请选择模型</div>
                        <div className="model-description">选择适合的AI模型</div>
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
                <div className={`model-dropdown-menu ${dropdownPosition}`}>
                  {Object.entries(siliconFlowModels).map(([categoryKey, category]) => (
                    <div key={categoryKey} className="model-category">
                      <div className="model-category-header">{category.name}</div>
                      {category.models.map((model) => (
                        <button
                          key={model.id}
                          className={`model-option ${
                            config.model === model.id ? "selected" : ""
                          }`}
                          onClick={() => handleModelChange(model.id)}
                        >
                          <div className="model-option-info">
                            <div className="model-option-name">
                              {model.isPro ? "Pro/" : ""}{model.name}
                            </div>
                            <div className="model-option-description">
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

          <details className="advanced-settings">
            <summary>高级设置</summary>
            <div className="advanced-content">
              <div className="setting-group">
                <label>API地址</label>
                <input
                  type="text"
                  value={config.baseURL}
                  onChange={(e) => handleInputChange("baseURL", e.target.value)}
                  placeholder="https://api.siliconflow.cn/v1/chat/completions"
                  className="setting-input"
                  readOnly
                />
                <div className="setting-hint">
                  硅基流动API地址（已固定）
                </div>
              </div>
              
              <div className="setting-row">
                <div className="setting-group">
                  <label>温度 (0-2)</label>
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
                  <label>最大令牌数</label>
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
            </div>
          </details>

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
          {testMessage && (
            <div
              className={`save-message ${
                testMessage.includes("成功") ? "success" : "error"
              }`}
            >
              {testMessage}
            </div>
          )}
        </div>

        <div className="settings-footer">
          <div className="test-buttons">
            <button
              className="test-button"
              onClick={handleTestConnection}
              disabled={
                isSaving || !config.baseURL || !config.apiKey || !config.model
              }
            >
              {isSaving && saveMessage.includes("测试")
                ? "测试中..."
                : "测试连接"}
            </button>
            {/* <button
              className="test-button"
              onClick={handleTestTitleGeneration}
              disabled={
                isTesting || !config.baseURL || !config.apiKey || !config.model
              }
            >
              {isTesting ? "测试中..." : "测试标题生成"}
            </button> */}
          </div>
          <div className="footer-buttons">
            <button className="cancel-button" onClick={onClose}>
              取消
            </button>
            <button
              className="save-button"
              onClick={handleSave}
              disabled={
                isSaving || !config.baseURL || !config.apiKey || !config.model
              }
            >
              {isSaving && !saveMessage.includes("测试") ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

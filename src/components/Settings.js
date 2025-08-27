import React, { useState, useEffect } from "react";
import { getApiConfig, updateApiConfig } from "../utils/api";
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

  const presetConfigs = {
    siliconflow: {
      name: currentLanguage === "zh" ? "硅基流动" : "SiliconFlow",
      baseURL: "https://api.siliconflow.cn/v1/chat/completions",
      model: "deepseek-ai/DeepSeek-V3",
      placeholder: currentLanguage === "zh" ? "请输入硅基流动API密钥" : "Enter SiliconFlow API key",
    },
    openai: {
      name: "OpenAI",
      baseURL: "https://api.openai.com/v1/chat/completions",
      model: "gpt-3.5-turbo",
      placeholder: currentLanguage === "zh" ? "请输入OpenAI API密钥" : "Enter OpenAI API key",
    },
    deepseek: {
      name: "DeepSeek",
      baseURL: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
      placeholder: currentLanguage === "zh" ? "请输入DeepSeek API密钥" : "Enter DeepSeek API key",
    },
    custom: {
      name: currentLanguage === "zh" ? "自定义" : "Custom",
      baseURL: "",
      model: "",
      placeholder: currentLanguage === "zh" ? "请输入API密钥" : "Enter API key",
    },
  };

  useEffect(() => {
    if (isOpen) {
      const currentConfig = getApiConfig();
      setConfig(currentConfig);
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

  const handlePresetChange = (presetKey) => {
    const preset = presetConfigs[presetKey];
    setConfig((prev) => ({
      ...prev,
      baseURL: preset.baseURL,
      model: preset.model,
    }));
  };

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
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
            <div className="preset-buttons">
              {Object.entries(presetConfigs).map(([key, preset]) => (
                <button
                  key={key}
                  className={`preset-button ${
                    config.baseURL === preset.baseURL ? "active" : ""
                  }`}
                  onClick={() => handlePresetChange(key)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label>API密钥 *</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => handleInputChange("apiKey", e.target.value)}
              placeholder={
                Object.values(presetConfigs).find(
                  (preset) => preset.baseURL === config.baseURL
                )?.placeholder || "请输入API密钥"
              }
              className="setting-input"
            />
          </div>

          <div className="setting-group">
            <label>模型名称 *</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => handleInputChange("model", e.target.value)}
              placeholder="deepseek-ai/DeepSeek-V3, deepseek-ai/DeepSeek-R1, Qwen/QwQ-32B"
              className="setting-input"
            />
            <div className="setting-hint">
              推理模型: Qwen/QwQ-32B, deepseek-ai/DeepSeek-R1 | 普通模型: deepseek-ai/DeepSeek-V3
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
                />
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
        </div>

        <div className="settings-footer">
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

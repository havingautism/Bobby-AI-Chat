import React, { useState, useEffect, useRef } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import "./ModelSelector.css";

const ModelSelector = ({ 
  currentModel, 
  onModelChange, 
  disabled = false,
  className = "" 
}) => {
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const dropdownRef = useRef(null);

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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 获取当前模型信息
  const getCurrentModelInfo = () => {
    for (const category of Object.values(siliconFlowModels)) {
      const model = category.models.find(m => m.id === currentModel);
      if (model) {
        return model;
      }
    }
    // 如果找不到，返回默认模型信息
    return {
      id: currentModel,
      name: currentModel.split('/').pop() || currentModel,
      description: "自定义模型",
      isPro: false
    };
  };

  const currentModelInfo = getCurrentModelInfo();

  const handleModelSelect = (modelId) => {
    onModelChange(modelId);
    setShowDropdown(false);
  };

  const toggleDropdown = () => {
    if (disabled) return;
    
    const newShowDropdown = !showDropdown;
    
    if (!showDropdown) {
      // 计算下拉菜单位置
      const container = dropdownRef.current;
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
    
    setShowDropdown(newShowDropdown);
    
    // 通知其他组件下拉框状态变化
    const event = new CustomEvent('modelDropdownToggle', {
      detail: { isOpen: newShowDropdown }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className={`model-selector ${className}`} ref={dropdownRef}>
      <button
        className={`model-selector-trigger ${disabled ? 'disabled' : ''} ${isMobile ? 'mobile-mode' : ''}`}
        onClick={toggleDropdown}
        disabled={disabled}
        title={t("switchModel", currentLanguage)}
      >
                 {isMobile ? (
           // 移动端只显示图标
           <div className="model-icon">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
               <path d="M2 17L12 22L22 17"/>
               <path d="M2 12L12 17L22 12"/>
             </svg>
           </div>
         ) : (
          // PC端显示完整信息
          <div className="model-info">
            <span className="model-name">
              {currentModelInfo.name}
              {currentModelInfo.isPro && <span className="pro-badge">Pro</span>}
            </span>
            <span className="model-description">{currentModelInfo.description}</span>
          </div>
        )}
        <span className="dropdown-arrow">▼</span>
      </button>

      {showDropdown && (
        <div className={`model-dropdown ${dropdownPosition}`}>
          {Object.entries(siliconFlowModels).map(([categoryKey, category]) => (
            <div key={categoryKey} className="model-category">
              <div className="category-header">{category.name}</div>
              <div className="category-models">
                {category.models.map((model) => (
                  <button
                    key={model.id}
                    className={`model-option ${model.id === currentModel ? 'selected' : ''}`}
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <div className="model-option-info">
                      <span className="model-option-name">
                        {model.name}
                        {model.isPro && <span className="pro-badge">Pro</span>}
                      </span>
                      <span className="model-option-description">{model.description}</span>
                    </div>
                    {model.id === currentModel && (
                      <span className="selected-indicator">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;

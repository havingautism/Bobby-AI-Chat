import React, { useState, useEffect, useRef } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import ModelIcon from "./ModelIcon";
import { getAllModelGroups, getAllModels } from "../utils/database";
import {
  DEFAULT_MODEL_GROUPS,
  DEFAULT_MODELS,
  mergeModelsWithDefaults,
} from "../utils/defaultModelConfig";
import "./ModelSelector.css";

const ModelSelector = ({
  currentModel,
  onModelChange,
  disabled = false,
  className = "",
}) => {
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState("bottom");
  const [currentLanguage, setCurrentLanguage] = useState(() =>
    getCurrentLanguage()
  );
  const dropdownRef = useRef(null);

  // 动态模型分类（来自模型管理：数据库合并默认值）
  const [modelCategories, setModelCategories] = useState({});

  useEffect(() => {
    const loadModels = async () => {
      try {
        const savedGroups = (await getAllModelGroups()) || [];
        const savedModels = (await getAllModels()) || [];
        const { mergedGroups, mergedModels } = mergeModelsWithDefaults(
          DEFAULT_MODEL_GROUPS,
          DEFAULT_MODELS,
          savedGroups,
          savedModels
        );
        const categories = {};
        mergedGroups.forEach((group) => {
          categories[group.id] = { name: group.name, models: [] };
        });
        mergedModels
          .filter((m) => m.enabled !== false)
          .forEach((model) => {
            if (categories[model.groupId]) {
              categories[model.groupId].models.push({
                id: model.modelId,
                name: model.name,
                description: model.description || "",
                isPro: !!model.isPro,
              });
            }
          });
        setModelCategories(categories);
      } catch (e) {
        console.error("加载模型列表失败，使用默认列表:", e);
        const categories = {};
        DEFAULT_MODEL_GROUPS.forEach((group) => {
          categories[group.id] = { name: group.name, models: [] };
        });
        DEFAULT_MODELS.forEach((model) => {
          if (categories[model.groupId]) {
            categories[model.groupId].models.push({
              id: model.modelId,
              name: model.name,
              description: model.description || "",
              isPro: !!model.isPro,
            });
          }
        });
        setModelCategories(categories);
      }
    };
    loadModels();
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
    for (const category of Object.values(modelCategories)) {
      const model = category.models.find((m) => m.id === currentModel);
      if (model) {
        return model;
      }
    }
    // 如果找不到，返回默认模型信息
    return {
      id: currentModel,
      name: currentModel.split("/").pop() || currentModel,
      description: "自定义模型",
      isPro: false,
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
          setDropdownPosition("top");
        } else {
          setDropdownPosition("bottom");
        }
      }
    }

    setShowDropdown(newShowDropdown);

    // 通知其他组件下拉框状态变化
    const event = new CustomEvent("modelDropdownToggle", {
      detail: { isOpen: newShowDropdown },
    });
    window.dispatchEvent(event);
  };

  return (
    <div className={`model-selector ${className}`} ref={dropdownRef}>
      <button
        className={`model-selector-trigger ${disabled ? "disabled" : ""} ${
          isMobile ? "mobile-mode" : ""
        }`}
        onClick={toggleDropdown}
        disabled={disabled}
        title={t("switchModel", currentLanguage)}
      >
        {isMobile ? (
          // 移动端只显示图标
          <div className="model-icon">
            <ModelIcon modelId={currentModel} size={20} />
          </div>
        ) : (
          // PC端显示完整信息
          <div className="model-info">
            <div className="model-name-container">
              <ModelIcon
                modelId={currentModel}
                size={18}
                className="model-selector-icon"
              />
              <span className="model-name">
                {currentModelInfo.name}
                {currentModelInfo.isPro && (
                  <span className="pro-badge">Pro</span>
                )}
              </span>
            </div>
            <span className="model-description">
              {currentModelInfo.description}
            </span>
          </div>
        )}
        <span className="dropdown-arrow">▼</span>
      </button>

      {showDropdown && (
        <div className={`model-dropdown ${dropdownPosition}`}>
          {Object.entries(modelCategories).map(([categoryKey, category]) => (
            <div key={categoryKey} className="model-category">
              <div className="category-header">{category.name}</div>
              <div className="category-models">
                {category.models.map((model) => (
                  <button
                    key={model.id}
                    className={`model-option ${
                      model.id === currentModel ? "selected" : ""
                    }`}
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <ModelIcon
                      modelId={model.id}
                      size={16}
                      className={model.isPro ? "pro" : ""}
                    />
                    <div className="model-option-info">
                      <span className="model-option-name">
                        {model.name}
                        {model.isPro && <span className="pro-badge">Pro</span>}
                      </span>
                      <span className="model-option-description">
                        {model.description}
                      </span>
                    </div>
                    {model.id === currentModel && (
                      <span className="selected-checkmark">✓</span>
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

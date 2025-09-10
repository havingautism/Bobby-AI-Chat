import React from 'react';
import { 
  DeepSeek, 
  Qwen, 
  Kimi, 
  ChatGLM, 
  Baidu, 
  Tencent,
  Stepfun,
  Minimax,
  Gemma,
  OpenAI
} from '@lobehub/icons';
import './ModelIcon.css';

// 模型图标组件
const ModelIcon = ({ modelId, size = 24, className = "" }) => {
  // 根据模型ID获取图标组件
  const getModelIcon = (modelId) => {
    const modelLower = modelId.toLowerCase();
    
    // DeepSeek系列
    if (modelLower.includes('deepseek')) {
      return {
        component: DeepSeek,
        color: '#4D6BFE',
        name: 'DeepSeek',
        hasIcon: true
      };
    }
    
    // Qwen系列
    if (modelLower.includes('qwen')) {
      return {
        component: Qwen,
        color: '#059669',
        name: 'Qwen',
        hasIcon: true
      };
    }
    
    // Step系列
    if (modelLower.includes('step')) {
      return {
        component: Stepfun,
        color: '#f59e0b',
        name: 'Stepfun',
        hasIcon: true
      };
    }
    
    // GLM系列
    if (modelLower.includes('glm')) {
      return {
        component: ChatGLM,
        color: '#dc2626',
        name: 'GLM',
        hasIcon: true
      };
    }
    
    // ERNIE系列
    if (modelLower.includes('ernie') || modelLower.includes('baidu')) {
      return {
        component: Baidu,
        color: '#3b82f6',
        name: 'Baidu',
        hasIcon: true
      };
    }
    
    // Kimi系列
    if (modelLower.includes('kimi') || modelLower.includes('moonshot')) {
      return {
        component: Kimi,
        color: '#ec4899',
        name: 'Kimi',
        hasIcon: true
      };
    }
    
    // Hunyuan系列
    if (modelLower.includes('hunyuan') || modelLower.includes('tencent')) {
      return {
        component: Tencent,
        color: '#f97316',
        name: 'Tencent',
        hasIcon: true
      };
    }
    
    // MiniMax系列
    if (modelLower.includes('minimax')) {
      return {
        component: Minimax,
        color: '#06b6d4',
        name: 'Minimax',
        hasIcon: true
      };
    }
    
    // Gemma系列
    if (modelLower.includes('gemma')) {
      return {
        component: Gemma,
        color: '#a855f7',
        name: 'Gemma',
        hasIcon: true
      };
    }
    
    // 没有lobehub图标
    return {
      component: null,
      color: '#6b7280',
      name: 'Default',
      hasIcon: false
    };
  };

  const iconInfo = getModelIcon(modelId);
  const IconComponent = iconInfo.component;
  
  // 如果没有图标，返回null
  if (!iconInfo.hasIcon || !IconComponent) {
    return null;
  }
  
  return (
    <div 
      className={`model-icon ${className}`}
      style={{
        width: size,
        height: size,
      }}
      title={iconInfo.name}
    >
      <IconComponent 
        size={size}
        style={{
          width: size,
          height: size,
          color: iconInfo.color
        }}
      />
    </div>
  );
};

export default ModelIcon;
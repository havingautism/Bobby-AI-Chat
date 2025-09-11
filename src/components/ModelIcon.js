import React, { useMemo, useCallback } from 'react';
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
} from './icons';
import './ModelIcon.css';

// 优化的模型图标组件
const ModelIcon = React.memo(({ modelId, size = 24, className = "" }) => {
  // 使用useMemo缓存图标信息计算
  const iconInfo = useMemo(() => {
    const modelLower = modelId.toLowerCase();
    
    // 图标映射配置
    const iconMap = {
      'deepseek': { component: DeepSeek, color: '#4D6BFE', name: 'DeepSeek' },
      'qwen': { component: Qwen, color: '#059669', name: 'Qwen' },
      'step': { component: Stepfun, color: '#f59e0b', name: 'Stepfun' },
      'glm': { component: ChatGLM, color: '#dc2626', name: 'GLM' },
      'ernie': { component: Baidu, color: '#3b82f6', name: 'Baidu' },
      'baidu': { component: Baidu, color: '#3b82f6', name: 'Baidu' },
      'kimi': { component: Kimi, color: '#ec4899', name: 'Kimi' },
      'moonshot': { component: Kimi, color: '#ec4899', name: 'Kimi' },
      'hunyuan': { component: Tencent, color: '#f97316', name: 'Tencent' },
      'tencent': { component: Tencent, color: '#f97316', name: 'Tencent' },
      'minimax': { component: Minimax, color: '#06b6d4', name: 'Minimax' },
      'gemma': { component: Gemma, color: '#a855f7', name: 'Gemma' },
      'openai': { component: OpenAI, color: '#10b981', name: 'OpenAI' }
    };
    
    // 查找匹配的图标
    for (const [key, icon] of Object.entries(iconMap)) {
      if (modelLower.includes(key)) {
        return { ...icon, hasIcon: true };
      }
    }
    
    // 默认图标
    return {
      component: null,
      color: '#6b7280',
      name: 'Default',
      hasIcon: false
    };
  }, [modelId]);

  const IconComponent = iconInfo.component;
  
  // 如果没有图标，返回null
  if (!iconInfo.hasIcon || !IconComponent) {
    return null;
  }
  
  // 使用useCallback优化事件处理
  const handleClick = useCallback(() => {
    // 可以在这里添加点击事件
  }, []);
  
  return (
    <div 
      className={`model-icon ${className}`}
      style={{
        width: size,
        height: size,
        // 添加硬件加速
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
      title={iconInfo.name}
      onClick={handleClick}
    >
      <IconComponent 
        size={size}
        style={{
          width: size,
          height: size,
          color: iconInfo.color,
          // 添加硬件加速
          transform: 'translateZ(0)',
          willChange: 'transform'
        }}
      />
    </div>
  );
});

ModelIcon.displayName = 'ModelIcon';

export default ModelIcon;
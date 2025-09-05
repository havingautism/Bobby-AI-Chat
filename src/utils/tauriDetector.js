// Tauri环境检测工具
export const isTauriEnvironment = () => {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
};

// 获取Tauri版本信息
export const getTauriVersion = () => {
  if (isTauriEnvironment()) {
    return window.__TAURI_INTERNALS__?.version || 'unknown';
  }
  return null;
};

// 获取平台信息
export const getPlatform = () => {
  if (isTauriEnvironment()) {
    return 'tauri';
  }
  return 'web';
};

// 测试Tauri功能
export const testTauriFeatures = () => {
  const features = {
    isTauri: isTauriEnvironment(),
    version: getTauriVersion(),
    platform: getPlatform(),
    hasShell: false,
    hasFs: false
  };

  if (features.isTauri) {
    // 检查可用的Tauri插件
    try {
      features.hasShell = typeof window.__TAURI_INTERNALS__?.shell !== 'undefined';
      features.hasFs = typeof window.__TAURI_INTERNALS__?.fs !== 'undefined';
    } catch (error) {
      console.warn('检查Tauri插件时出错:', error);
    }
  }

  return features;
};

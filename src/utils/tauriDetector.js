// Tauri环境检测工具 - 使用更宽松的检测方法
export const isTauriEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  // 检查多种Tauri标识
  return Boolean(
    window.__TAURI__ !== undefined || 
    window.__TAURI_IPC__ !== undefined ||
    window.__TAURI_INTERNALS__ !== undefined ||
    window.__TAURI_METADATA__ !== undefined ||
    navigator.userAgent.includes('Tauri') ||
    Object.keys(window).some(key => key.includes('TAURI'))
  );
};

// 获取Tauri版本信息
export const getTauriVersion = () => {
  if (isTauriEnvironment()) {
    return window.__TAURI__?.version || 'unknown';
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
      features.hasShell = typeof window.__TAURI__?.shell !== 'undefined';
      features.hasFs = typeof window.__TAURI__?.fs !== 'undefined';
    } catch (error) {
      console.warn('检查Tauri插件时出错:', error);
    }
  }

  return features;
};

// 强制Tauri环境检测和SQLite设置
console.log('=== 强制Tauri环境检测 ===');

// 1. 检查所有可能的Tauri标识
const tauriChecks = {
  '__TAURI__': !!window.__TAURI__,
  '__TAURI_INTERNALS__': !!window.__TAURI_INTERNALS__,
  '__TAURI_METADATA__': !!window.__TAURI_METADATA__,
  'userAgent': navigator.userAgent.includes('Tauri'),
  'tauriKeys': Object.keys(window).filter(key => key.includes('TAURI'))
};

console.log('Tauri检测结果:', tauriChecks);

// 2. 如果有任何Tauri标识，强制设置SQLite
const hasTauri = Object.values(tauriChecks).some(check => 
  Array.isArray(check) ? check.length > 0 : check
);

if (hasTauri) {
  console.log('✅ 检测到Tauri环境，强制设置SQLite存储');
  localStorage.setItem('use-sqlite-storage', 'true');
  
  // 3. 测试存储类型
  import('./src/utils/storageAdapter.js').then(async (module) => {
    const { storageAdapter } = module;
    const storageType = storageAdapter.getStorageType();
    console.log('设置后存储类型:', storageType);
    
    if (storageType === 'sqlite') {
      console.log('✅ SQLite存储设置成功');
    } else {
      console.log('❌ SQLite存储设置失败，当前类型:', storageType);
    }
  });
} else {
  console.log('❌ 未检测到Tauri环境');
}

console.log('=== 检测完成 ===');

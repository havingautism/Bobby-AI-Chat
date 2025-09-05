// 详细调试Tauri环境检测
console.log('=== 详细Tauri环境调试 ===');

// 1. 检查window对象
console.log('1. window对象存在:', typeof window !== 'undefined');

if (typeof window !== 'undefined') {
  // 2. 检查所有可能的Tauri对象
  console.log('2. window.__TAURI__:', !!window.__TAURI__);
  console.log('3. window.__TAURI_INTERNALS__:', !!window.__TAURI_INTERNALS__);
  console.log('4. window.__TAURI_METADATA__:', !!window.__TAURI_METADATA__);
  
  // 3. 详细检查__TAURI__对象
  if (window.__TAURI__) {
    console.log('5. __TAURI__对象内容:', Object.keys(window.__TAURI__));
    console.log('6. __TAURI__.version:', window.__TAURI__.version);
    console.log('7. __TAURI__.platform:', window.__TAURI__.platform);
  }
  
  // 4. 检查navigator.userAgent
  console.log('8. navigator.userAgent:', navigator.userAgent);
  
  // 5. 检查是否有Tauri相关的全局变量
  const tauriVars = Object.keys(window).filter(key => key.includes('TAURI'));
  console.log('9. 所有Tauri相关变量:', tauriVars);
}

// 6. 测试环境检测函数
import('./src/utils/tauriDetector.js').then(async (module) => {
  const { isTauriEnvironment, testTauriFeatures } = module;
  
  console.log('10. isTauriEnvironment():', isTauriEnvironment());
  
  const features = testTauriFeatures();
  console.log('11. Tauri功能测试:', features);
  
  // 7. 测试存储适配器
  import('./src/utils/storageAdapter.js').then(async (storageModule) => {
    const { storageAdapter } = storageModule;
    
    console.log('12. 存储类型:', storageAdapter.getStorageType());
    
    // 8. 检查localStorage中的设置
    console.log('13. use-sqlite-storage设置:', localStorage.getItem('use-sqlite-storage'));
    
    // 9. 手动测试存储实现
    const storage = storageAdapter.getStorage();
    console.log('14. 当前存储实现:', storage);
    console.log('15. 存储实现类型:', typeof storage);
    console.log('16. 存储实现构造函数:', storage.constructor.name);
    
  }).catch(error => {
    console.error('存储适配器测试失败:', error);
  });
  
}).catch(error => {
  console.error('Tauri检测器测试失败:', error);
});

console.log('=== 调试完成 ===');

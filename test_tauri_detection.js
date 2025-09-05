// 测试Tauri环境检测
console.log('=== Tauri环境检测测试 ===');

// 检查window对象
console.log('1. window对象:', typeof window !== 'undefined' ? '存在' : '不存在');

// 检查Tauri相关对象
console.log('2. window.__TAURI__:', typeof window !== 'undefined' && window.__TAURI__ ? '存在' : '不存在');
console.log('3. window.__TAURI_INTERNALS__:', typeof window !== 'undefined' && window.__TAURI_INTERNALS__ ? '存在' : '不存在');

// 测试环境检测函数
import('./src/utils/tauriDetector.js').then(async (module) => {
  const { isTauriEnvironment, testTauriFeatures } = module;
  
  console.log('4. isTauriEnvironment():', isTauriEnvironment());
  
  const features = testTauriFeatures();
  console.log('5. Tauri功能测试:', features);
  
  // 测试存储适配器
  import('./src/utils/storageAdapter.js').then(async (storageModule) => {
    const { storageAdapter } = storageModule;
    
    console.log('6. 存储类型:', storageAdapter.getStorageType());
    
    try {
      const storageInfo = await storageAdapter.getStorageInfo();
      console.log('7. 存储信息:', storageInfo);
    } catch (error) {
      console.error('7. 获取存储信息失败:', error);
    }
  }).catch(error => {
    console.error('存储适配器测试失败:', error);
  });
  
}).catch(error => {
  console.error('Tauri检测器测试失败:', error);
});

console.log('=== 测试完成 ===');

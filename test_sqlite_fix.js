// 测试SQLite修复
console.log('=== 测试SQLite修复 ===');

// 1. 测试Tauri环境检测
console.log('1. 测试Tauri环境检测:');
const isTauri = typeof window !== 'undefined' && (
  window.__TAURI__ || 
  window.__TAURI_INTERNALS__ || 
  window.__TAURI_METADATA__ ||
  window.navigator?.userAgent?.includes('Tauri') ||
  Object.keys(window).some(key => key.includes('TAURI'))
);
console.log('Tauri环境检测结果:', isTauri);

// 2. 测试存储类型
console.log('2. 测试存储类型:');
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  const storageType = storageAdapter.getStorageType();
  console.log('当前存储类型:', storageType);
  
  // 3. 测试SQLite存储
  if (storageType === 'sqlite') {
    console.log('3. 测试SQLite存储:');
    try {
      const storage = storageAdapter.getStorage();
      console.log('获取存储实例成功:', !!storage);
      
      // 测试加载聊天历史
      const history = await storage.loadChatHistory();
      console.log('加载聊天历史成功:', Array.isArray(history));
      
      // 测试获取存储信息
      const info = await storage.getStorageInfo();
      console.log('获取存储信息成功:', info);
      
    } catch (error) {
      console.error('SQLite存储测试失败:', error);
    }
  }
});

console.log('=== 测试完成 ===');

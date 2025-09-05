// 测试Tauri IPC修复
console.log('=== 测试Tauri IPC修复 ===');

// 1. 检查Tauri环境
console.log('1. 检查Tauri环境:');
const isTauri = typeof window !== 'undefined' && (
  window.__TAURI__ || 
  window.__TAURI_INTERNALS__ || 
  window.__TAURI_METADATA__ ||
  window.navigator?.userAgent?.includes('Tauri') ||
  Object.keys(window).some(key => key.includes('TAURI'))
);
console.log('Tauri环境检测:', isTauri);

// 2. 检查Tauri IPC
console.log('2. 检查Tauri IPC:');
const ipcAvailable = typeof window.__TAURI_IPC__ === 'function';
console.log('Tauri IPC可用:', ipcAvailable);

// 3. 测试存储适配器
console.log('3. 测试存储适配器:');
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  
  try {
    const storageType = storageAdapter.getStorageType();
    console.log('当前存储类型:', storageType);
    
    const storage = storageAdapter.getStorage();
    console.log('获取存储实例成功:', !!storage);
    
    // 测试获取存储信息
    const info = await storage.getStorageInfo();
    console.log('获取存储信息成功:', info);
    
  } catch (error) {
    console.error('存储测试失败:', error);
  }
}).catch(error => {
  console.error('存储适配器导入失败:', error);
});

console.log('=== 测试完成 ===');

// 测试SQLite初始化
console.log('=== 测试SQLite初始化 ===');

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

// 2. 测试SQLite存储
console.log('2. 测试SQLite存储:');
import('./src/utils/sqliteStorage.js').then(async (module) => {
  const { sqliteStorage } = module;
  
  try {
    console.log('开始初始化SQLite...');
    await sqliteStorage.initialize();
    console.log('✅ SQLite初始化成功');
    
    // 测试获取存储信息
    const info = await sqliteStorage.getStorageInfo();
    console.log('✅ 获取存储信息成功:', info);
    
  } catch (error) {
    console.error('❌ SQLite初始化失败:', error);
  }
}).catch(error => {
  console.error('❌ SQLite存储导入失败:', error);
});

// 3. 测试存储适配器
console.log('3. 测试存储适配器:');
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  
  try {
    const storageType = storageAdapter.getStorageType();
    console.log('存储类型:', storageType);
    
    const storage = storageAdapter.getStorage();
    console.log('存储实例:', storage.constructor.name);
    
    const info = await storage.getStorageInfo();
    console.log('存储信息:', info);
    
  } catch (error) {
    console.error('存储适配器测试失败:', error);
  }
}).catch(error => {
  console.error('存储适配器导入失败:', error);
});

console.log('=== 测试完成 ===');

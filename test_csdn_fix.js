// 测试CSDN文章的修复方案
console.log('=== 测试CSDN文章的修复方案 ===');

// 1. 测试Tauri环境检测
console.log('1. 测试Tauri环境检测:');
const isTauri = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    window.__TAURI_IPC__ !== undefined
);
console.log('Tauri环境检测结果:', isTauri);
console.log('window.__TAURI_IPC__:', typeof window.__TAURI_IPC__);

// 2. 测试SQLite存储
if (isTauri) {
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
} else {
  console.log('2. 非Tauri环境，跳过SQLite测试');
}

// 3. 测试存储适配器
console.log('3. 测试存储适配器:');
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  
  try {
    const storageType = storageAdapter.getStorageType();
    console.log('存储类型:', storageType);
    
    const storage = storageAdapter.getStorage();
    console.log('存储实例:', storage.constructor.name);
    
  } catch (error) {
    console.error('存储适配器测试失败:', error);
  }
}).catch(error => {
  console.error('存储适配器导入失败:', error);
});

console.log('=== 测试完成 ===');

// 强制修复SQLite存储问题
console.log('🚀 强制修复SQLite存储问题');

// 1. 检查当前环境
console.log('1. 检查当前环境:');
console.log('window.__TAURI_IPC__:', typeof window.__TAURI_IPC__);
console.log('window.__TAURI__:', typeof window.__TAURI__);

// 2. 强制设置SQLite存储
console.log('2. 强制设置SQLite存储:');
localStorage.setItem('use-sqlite-storage', 'true');
console.log('已设置 use-sqlite-storage = true');

// 3. 测试存储适配器
console.log('3. 测试存储适配器:');
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  
  try {
    const storageType = storageAdapter.getStorageType();
    console.log('当前存储类型:', storageType);
    
    const storage = storageAdapter.getStorage();
    console.log('存储实例:', storage.constructor.name);
    
    if (storageType === 'sqlite') {
      console.log('✅ SQLite存储设置成功');
      
      // 测试SQLite初始化
      try {
        const info = await storage.getStorageInfo();
        console.log('✅ SQLite存储信息:', info);
      } catch (error) {
        console.error('❌ SQLite存储信息获取失败:', error);
      }
    } else {
      console.log('❌ 存储类型仍然是:', storageType);
    }
    
  } catch (error) {
    console.error('存储适配器测试失败:', error);
  }
}).catch(error => {
  console.error('存储适配器导入失败:', error);
});

// 4. 重新加载页面
console.log('4. 3秒后重新加载页面...');
setTimeout(() => {
  console.log('重新加载页面');
  location.reload();
}, 3000);

console.log('=== 强制修复完成 ===');

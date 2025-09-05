// 测试存储信息修复
console.log('测试存储信息修复...');

// 模拟Tauri环境
if (typeof window !== 'undefined') {
  window.__TAURI__ = true;
}

// 测试存储适配器
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  
  try {
    console.log('1. 检查存储类型:', storageAdapter.getStorageType());
    
    console.log('2. 获取存储信息...');
    const info = await storageAdapter.getStorageInfo();
    console.log('存储信息:', info);
    
    if (info && info.error) {
      console.error('存储信息加载失败:', info.error);
    } else {
      console.log('✅ 存储信息加载成功!');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}).catch(error => {
  console.error('❌ 模块加载失败:', error);
});

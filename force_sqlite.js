// 强制设置SQLite存储
console.log('=== 强制设置SQLite存储 ===');

// 1. 检查当前环境
console.log('1. 检查Tauri环境...');
if (typeof window !== 'undefined' && window.__TAURI__) {
  console.log('✅ Tauri环境检测成功');
  
  // 2. 设置SQLite存储
  console.log('2. 设置SQLite存储...');
  localStorage.setItem('use-sqlite-storage', 'true');
  console.log('✅ 已设置use-sqlite-storage为true');
  
  // 3. 测试存储类型检测
  console.log('3. 测试存储类型检测...');
  import('./src/utils/storageAdapter.js').then(async (module) => {
    const { storageAdapter } = module;
    
    const storageType = storageAdapter.getStorageType();
    console.log('当前存储类型:', storageType);
    
    if (storageType === 'sqlite') {
      console.log('✅ 存储类型检测正确');
      
      // 4. 测试存储信息
      console.log('4. 测试存储信息...');
      try {
        const storageInfo = await storageAdapter.getStorageInfo();
        console.log('存储信息:', storageInfo);
        console.log('✅ 存储信息获取成功');
      } catch (error) {
        console.error('❌ 存储信息获取失败:', error);
      }
    } else {
      console.log('❌ 存储类型检测失败，当前类型:', storageType);
    }
  }).catch(error => {
    console.error('❌ 存储适配器测试失败:', error);
  });
  
} else {
  console.log('❌ 不在Tauri环境中');
  console.log('window.__TAURI__:', typeof window !== 'undefined' && window.__TAURI__);
}

console.log('=== 设置完成 ===');

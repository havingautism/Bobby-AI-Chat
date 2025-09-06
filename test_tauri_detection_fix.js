// 测试Tauri环境检测修复
console.log('=== 测试Tauri环境检测修复 ===');

// 1. 运行详细调试
console.log('1. 运行详细调试:');
import('./debug_tauri_env_detailed.js').then(() => {
  console.log('详细调试完成');
}).catch(error => {
  console.error('详细调试失败:', error);
});

// 2. 测试修复后的环境检测
console.log('2. 测试修复后的环境检测:');
import('./src/utils/tauriDetector.js').then(async (module) => {
  const { isTauriEnvironment } = module;
  
  const isTauri = isTauriEnvironment();
  console.log('修复后的Tauri环境检测结果:', isTauri);
  
  if (isTauri) {
    console.log('✅ Tauri环境检测成功');
  } else {
    console.log('❌ Tauri环境检测失败');
  }
}).catch(error => {
  console.error('Tauri环境检测测试失败:', error);
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
    
    if (storageType === 'sqlite') {
      console.log('✅ SQLite存储设置成功');
    } else {
      console.log('❌ 存储类型仍然是:', storageType);
    }
    
  } catch (error) {
    console.error('存储适配器测试失败:', error);
  }
}).catch(error => {
  console.error('存储适配器导入失败:', error);
});

console.log('=== 测试完成 ===');


// 调试存储信息加载问题
const { storageAdapter } = require('./src/utils/storageAdapter');

async function debugStorageInfo() {
  console.log('开始调试存储信息加载...');
  
  try {
    // 1. 检查存储类型
    console.log('\n1. 检查存储类型:');
    const storageType = storageAdapter.getStorageType();
    console.log('存储类型:', storageType);
    
    // 2. 检查存储实例
    console.log('\n2. 检查存储实例:');
    const storage = storageAdapter.getStorage();
    console.log('存储实例:', storage);
    console.log('存储实例类型:', typeof storage);
    
    // 3. 尝试获取存储信息
    console.log('\n3. 尝试获取存储信息:');
    const storageInfo = await storageAdapter.getStorageInfo();
    console.log('存储信息:', storageInfo);
    
    // 4. 如果是SQLite，检查数据库路径
    if (storageType === 'sqlite') {
      console.log('\n4. 检查SQLite数据库:');
      console.log('数据库路径:', storage.dbPath);
      console.log('是否已初始化:', storage.isInitialized);
      
      // 尝试初始化
      if (!storage.isInitialized) {
        console.log('尝试初始化数据库...');
        await storage.initialize();
        console.log('初始化后状态:', storage.isInitialized);
      }
      
      // 再次尝试获取存储信息
      console.log('\n5. 重新获取存储信息:');
      const newStorageInfo = await storageAdapter.getStorageInfo();
      console.log('新的存储信息:', newStorageInfo);
    }
    
  } catch (error) {
    console.error('调试过程中出现错误:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行调试
debugStorageInfo();

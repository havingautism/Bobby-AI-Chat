// 测试简单的SQLite实现
console.log('=== 测试简单的SQLite实现 ===');

// 1. 测试Tauri环境检测
console.log('1. 测试Tauri环境检测:');
const isTauri = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    window.__TAURI_IPC__ !== undefined
);
console.log('Tauri环境检测结果:', isTauri);

// 2. 测试简单SQLite存储
if (isTauri) {
  console.log('2. 测试简单SQLite存储:');
  import('./src/utils/simpleSQLiteStorage.js').then(async (module) => {
    const { simpleSQLiteStorage } = module;
    
    try {
      console.log('开始初始化简单SQLite...');
      await simpleSQLiteStorage.initialize();
      console.log('✅ 简单SQLite初始化成功');
      
      // 测试获取存储信息
      const info = await simpleSQLiteStorage.getStorageInfo();
      console.log('✅ 获取存储信息成功:', info);
      
      // 测试保存和加载聊天历史
      const testConversation = {
        id: 'test-1',
        title: '测试对话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: '你好',
            timestamp: Date.now()
          }
        ]
      };
      
      await simpleSQLiteStorage.saveChatHistory([testConversation]);
      console.log('✅ 保存聊天历史成功');
      
      const history = await simpleSQLiteStorage.loadChatHistory();
      console.log('✅ 加载聊天历史成功:', history.length, '个对话');
      
    } catch (error) {
      console.error('❌ 简单SQLite测试失败:', error);
    }
  }).catch(error => {
    console.error('❌ 简单SQLite存储导入失败:', error);
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
    
    if (storageType === 'sqlite') {
      const info = await storage.getStorageInfo();
      console.log('存储信息:', info);
    }
    
  } catch (error) {
    console.error('存储适配器测试失败:', error);
  }
}).catch(error => {
  console.error('存储适配器导入失败:', error);
});

console.log('=== 测试完成 ===');

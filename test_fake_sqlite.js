// 测试伪SQLite存储
console.log('=== 测试伪SQLite存储 ===');

// 1. 测试存储适配器
console.log('1. 测试存储适配器:');
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  
  try {
    const storageType = storageAdapter.getStorageType();
    console.log('存储类型:', storageType);
    
    const storage = storageAdapter.getStorage();
    console.log('存储实例:', storage.constructor.name);
    
    if (storageType === 'sqlite') {
      console.log('✅ SQLite存储设置成功');
      
      // 测试获取存储信息
      const info = await storage.getStorageInfo();
      console.log('✅ 获取存储信息成功:', info);
      
      // 测试保存和加载聊天历史
      const testConversation = {
        id: 'test-' + Date.now(),
        title: '测试对话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          {
            id: 'msg-' + Date.now(),
            role: 'user',
            content: '你好',
            timestamp: Date.now()
          }
        ]
      };
      
      await storage.saveChatHistory([testConversation]);
      console.log('✅ 保存聊天历史成功');
      
      const history = await storage.loadChatHistory();
      console.log('✅ 加载聊天历史成功:', history.length, '个对话');
      
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


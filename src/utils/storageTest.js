import { storageAdapter } from './storageAdapter';

// 存储测试工具
export const testStorage = async () => {
  console.log('=== 存储系统测试开始 ===');
  
  try {
    // 1. 检查存储类型
    const storageType = storageAdapter.getStorageType();
    console.log(`存储类型: ${storageType}`);
    
    // 2. 获取数据目录信息
    const dirInfo = storageAdapter.getDataDirectoryInfo();
    console.log('数据目录信息:', dirInfo);
    
    // 3. 测试保存设置
    const testKey = 'storage-test';
    const testValue = { timestamp: Date.now(), message: '存储测试' };
    await storageAdapter.saveSetting(testKey, testValue);
    console.log('✅ 设置保存测试通过');
    
    // 4. 测试读取设置
    const retrievedValue = await storageAdapter.loadSetting(testKey);
    console.log('✅ 设置读取测试通过:', retrievedValue);
    
    // 5. 测试保存对话
    const testConversation = {
      id: 'test-conversation-' + Date.now(),
      title: '存储测试对话',
      messages: [
        {
          id: 'test-msg-1',
          role: 'user',
          content: '这是一个测试消息',
          timestamp: Date.now()
        }
      ],
      lastUpdated: Date.now()
    };
    
    await storageAdapter.saveConversation(testConversation);
    console.log('✅ 对话保存测试通过');
    
    // 6. 测试读取对话
    const conversations = await storageAdapter.loadChatHistory();
    const foundConversation = conversations.find(c => c.id === testConversation.id);
    if (foundConversation) {
      console.log('✅ 对话读取测试通过');
    } else {
      console.log('❌ 对话读取测试失败');
    }
    
    // 7. 获取存储信息
    const storageInfo = await storageAdapter.getStorageInfo();
    console.log('存储信息:', storageInfo);
    
    // 8. 清理测试数据
    await storageAdapter.deleteConversation(testConversation.id);
    await storageAdapter.saveSetting(testKey, null);
    console.log('✅ 测试数据清理完成');
    
    console.log('=== 存储系统测试完成 ===');
    return {
      success: true,
      storageType,
      dirInfo,
      storageInfo
    };
    
  } catch (error) {
    console.error('❌ 存储系统测试失败:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};

// 在开发模式下自动运行测试
if (process.env.NODE_ENV === 'development') {
  // 延迟执行，确保应用完全加载
  setTimeout(() => {
    testStorage();
  }, 2000);
}

// 测试SQLite存储修复效果
console.log('=== 测试SQLite存储修复效果 ===');

// 1. 测试Tauri环境检测
console.log('1. 测试Tauri环境检测:');
const isTauri = typeof window !== 'undefined' && (
  window.__TAURI__ || 
  window.__TAURI_INTERNALS__ || 
  window.__TAURI_METADATA__ ||
  window.navigator?.userAgent?.includes('Tauri') ||
  Object.keys(window).some(key => key.includes('TAURI'))
);
console.log('Tauri环境检测结果:', isTauri);

// 2. 测试存储类型和功能
console.log('2. 测试存储类型和功能:');
import('./src/utils/storageAdapter.js').then(async (module) => {
  const { storageAdapter } = module;
  
  try {
    // 获取存储类型
    const storageType = storageAdapter.getStorageType();
    console.log('当前存储类型:', storageType);
    
    // 测试存储切换功能
    if (isTauri) {
      console.log('3. 测试存储切换功能:');
      
      // 尝试切换到SQLite
      try {
        const sqliteSuccess = await storageAdapter.switchToSQLite();
        console.log('切换到SQLite结果:', sqliteSuccess);
        
        if (sqliteSuccess) {
          // 测试SQLite存储操作
          console.log('4. 测试SQLite存储操作:');
          
          // 测试设置保存/加载
          await storageAdapter.saveSetting('test_key', 'test_value_' + Date.now());
          const loadedValue = await storageAdapter.loadSetting('test_key');
          console.log('设置测试 - 保存值成功, 加载值:', loadedValue);
          
          // 测试聊天历史
          const testConversation = {
            id: 'test_conv_' + Date.now(),
            title: 'SQLite测试对话',
            messages: [
              { id: 'msg1', role: 'user', content: '你好', timestamp: Date.now() },
              { id: 'msg2', role: 'assistant', content: '你好！我是AI助手', timestamp: Date.now() }
            ],
            lastUpdated: Date.now()
          };
          
          await storageAdapter.saveConversation(testConversation);
          console.log('测试对话已保存到SQLite');
          
          const conversations = await storageAdapter.loadChatHistory();
          console.log('从SQLite加载的对话数量:', conversations.length);
          
          // 获取存储信息
          const storageInfo = await storageAdapter.getStorageInfo();
          console.log('SQLite存储信息:', storageInfo);
          
        } else {
          console.log('SQLite不可用，使用JSON存储');
          
          // 测试JSON存储操作
          await storageAdapter.saveSetting('json_test_key', 'json_test_value');
          const jsonValue = await storageAdapter.loadSetting('json_test_key');
          console.log('JSON存储测试 - 加载值:', jsonValue);
        }
        
      } catch (error) {
        console.error('存储切换测试失败:', error);
        
        // 回退到JSON存储
        await storageAdapter.switchToJsonStorage();
        console.log('已回退到JSON存储');
      }
    } else {
      console.log('3. 非Tauri环境，测试IndexedDB存储:');
      
      // 测试IndexedDB存储
      await storageAdapter.saveSetting('indexeddb_test', 'indexeddb_value');
      const indexeddbValue = await storageAdapter.loadSetting('indexeddb_test');
      console.log('IndexedDB存储测试 - 加载值:', indexeddbValue);
    }
    
    console.log('\n✅ 所有测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
    console.error('错误详情:', error.stack);
  }
});

console.log('=== 测试初始化完成 ===');

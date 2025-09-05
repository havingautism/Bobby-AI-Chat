// 测试bind修复
console.log('=== 测试bind修复 ===');

// 1. 测试sqliteStorage导入
console.log('1. 测试sqliteStorage导入:');
try {
  import('./src/utils/sqliteStorage.js').then(module => {
    console.log('✅ sqliteStorage导入成功');
    console.log('可用方法:', Object.keys(module).filter(key => typeof module[key] === 'function'));
    
    // 测试关键方法是否存在
    const requiredMethods = [
      'loadChatHistory',
      'saveChatHistory', 
      'saveConversation',
      'deleteConversation',
      'clearChatHistory',
      'saveSetting',
      'loadSetting',
      'getStorageInfo',
      'saveApiSessions',
      'loadApiSessions',
      'initialize',
      'migrateFromJson'
    ];
    
    const missingMethods = requiredMethods.filter(method => !module[method]);
    if (missingMethods.length === 0) {
      console.log('✅ 所有必需方法都存在');
    } else {
      console.log('❌ 缺失方法:', missingMethods);
    }
    
  }).catch(error => {
    console.error('❌ sqliteStorage导入失败:', error);
  });
} catch (error) {
  console.error('❌ sqliteStorage导入失败:', error);
}

// 2. 测试storageAdapter导入
console.log('2. 测试storageAdapter导入:');
try {
  import('./src/utils/storageAdapter.js').then(module => {
    console.log('✅ storageAdapter导入成功');
    console.log('storageAdapter方法:', Object.keys(module.storageAdapter));
  }).catch(error => {
    console.error('❌ storageAdapter导入失败:', error);
  });
} catch (error) {
  console.error('❌ storageAdapter导入失败:', error);
}

console.log('=== 测试完成 ===');

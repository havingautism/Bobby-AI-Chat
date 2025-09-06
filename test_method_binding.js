// 测试SQLite方法绑定修复
console.log('=== 测试SQLite方法绑定修复 ===');

// 测试Tauri环境检测
const isTauri = typeof window !== 'undefined' && (
  window.__TAURI__ || 
  window.__TAURI_INTERNALS__ || 
  window.__TAURI_METADATA__ ||
  window.navigator?.userAgent?.includes('Tauri') ||
  Object.keys(window).some(key => key.includes('TAURI'))
);
console.log('Tauri环境检测结果:', isTauri);

if (isTauri) {
  console.log('✅ 在Tauri环境中，开始测试方法绑定...');
  
  import('./src/utils/simpleSQLiteStorage.js').then(async (module) => {
    const { simpleSQLiteStorage, initialize, getStorageInfo } = module;
    
    try {
      console.log('🔧 测试1: 检查实例方法...');
      
      // 检查实例是否有所有必要的方法
      const methods = [
        'initialize', 'createTables', 'loadChatHistory', 'saveChatHistory',
        'saveConversation', 'deleteConversation', 'clearChatHistory',
        'saveSetting', 'loadSetting', 'getStorageInfo',
        'saveApiSessions', 'loadApiSessions', 'cleanOldConversations'
      ];
      
      const missingMethods = methods.filter(method => typeof simpleSQLiteStorage[method] !== 'function');
      if (missingMethods.length > 0) {
        console.error('❌ 缺少方法:', missingMethods);
        return;
      }
      console.log('✅ 所有实例方法都存在');
      
      console.log('🔧 测试2: 检查导出方法...');
      
      // 检查导出的方法
      const exportedMethods = [
        'initialize', 'loadChatHistory', 'saveChatHistory', 'saveConversation',
        'deleteConversation', 'clearChatHistory', 'saveSetting', 'loadSetting',
        'getStorageInfo', 'saveApiSessions', 'loadApiSessions'
      ];
      
      const missingExports = exportedMethods.filter(method => typeof module[method] !== 'function');
      if (missingExports.length > 0) {
        console.error('❌ 缺少导出方法:', missingExports);
        return;
      }
      console.log('✅ 所有导出方法都存在');
      
      console.log('🔧 测试3: 测试方法调用...');
      
      // 测试初始化
      console.log('调用initialize方法...');
      await initialize();
      console.log('✅ initialize方法调用成功');
      
      // 测试获取存储信息
      console.log('调用getStorageInfo方法...');
      const info = await getStorageInfo();
      console.log('✅ getStorageInfo方法调用成功');
      console.log('存储信息:', info);
      
      // 测试设置操作
      console.log('测试设置保存和加载...');
      await module.saveSetting('test_binding_key', 'test_binding_value_' + Date.now());
      const loadedValue = await module.loadSetting('test_binding_key');
      console.log('✅ 设置操作成功，加载值:', loadedValue);
      
      console.log('\n🎉 所有方法绑定测试通过！');
      console.log('✅ 方法绑定问题已修复');
      console.log('✅ SQLite存储现在可以正常工作');
      
    } catch (error) {
      console.error('❌ 方法绑定测试失败:', error.message);
      console.error('错误堆栈:', error.stack);
      
      if (error.message.includes('is not a function')) {
        console.log('\n🔧 方法绑定问题分析:');
        console.log('1. 可能是方法解构导致this绑定丢失');
        console.log('2. 可能是方法定义有问题');
        console.log('3. 建议检查simpleSQLiteStorage.js文件');
      } else if (error.message.includes('sql.load not allowed')) {
        console.log('\n🔧 SQL权限问题:');
        console.log('1. 请确保Tauri权限配置正确');
        console.log('2. 重新构建Tauri应用');
        console.log('3. 重启应用');
      }
    }
  }).catch(error => {
    console.error('❌ 导入SQLite存储模块失败:', error);
  });
  
} else {
  console.log('❌ 非Tauri环境，无法测试方法绑定');
  console.log('请在Tauri应用中运行此测试');
}
// 测试SQL权限修复
console.log('=== 测试SQL权限修复 ===');

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
  console.log('✅ 在Tauri环境中，开始测试SQL权限...');
  
  // 动态导入SQL插件进行测试
  import('@tauri-apps/plugin-sql').then(async (Database) => {
    try {
      console.log('🔧 尝试连接SQLite数据库...');
      
      // 测试数据库连接
      const db = await Database.default.load('sqlite:test_permissions.db');
      console.log('✅ 数据库连接成功！');
      
      // 测试创建表
      await db.execute(`
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      console.log('✅ 创建表成功！');
      
      // 测试插入数据
      await db.execute('INSERT INTO test_table (name) VALUES (?)', ['test']);
      console.log('✅ 插入数据成功！');
      
      // 测试查询数据
      const result = await db.select('SELECT * FROM test_table');
      console.log('✅ 查询数据成功！结果:', result);
      
      // 测试删除表
      await db.execute('DROP TABLE test_table');
      console.log('✅ 清理测试表成功！');
      
      console.log('\n🎉 所有SQL权限测试通过！');
      console.log('✅ SQL权限已正确配置');
      console.log('✅ 数据库操作正常');
      console.log('✅ SQLite存储现在应该可以正常工作');
      
    } catch (error) {
      console.error('❌ SQL权限测试失败:', error.message);
      
      if (error.message.includes('not allowed') || error.message.includes('Permissions')) {
        console.log('\n🔧 权限配置建议:');
        console.log('1. 确保src-tauri/capabilities/default.json包含SQL权限');
        console.log('2. 重新构建Tauri应用: cd src-tauri && cargo build');
        console.log('3. 重启应用');
      } else {
        console.log('\n🔧 其他错误建议:');
        console.log('1. 检查SQL插件是否正确安装');
        console.log('2. 检查数据库路径是否可写');
      }
    }
  }).catch(error => {
    console.error('❌ 导入SQL插件失败:', error);
  });
  
} else {
  console.log('❌ 非Tauri环境，无法测试SQL权限');
  console.log('请在Tauri应用中运行此测试');
}
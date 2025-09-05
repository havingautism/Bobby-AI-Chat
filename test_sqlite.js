// SQLite功能测试脚本
const { invoke } = require('@tauri-apps/api/core');
const { storageAdapter } = require('./src/utils/storageAdapter');

async function testSQLiteSetup() {
  console.log('开始测试SQLite设置...');
  
  try {
    // 1. 测试Tauri环境检测
    console.log('\n1. 测试Tauri环境检测...');
    const isTauri = typeof window !== 'undefined' && window.__TAURI__;
    console.log('Tauri环境:', isTauri ? '已检测到' : '未检测到');
    
    // 2. 测试存储适配器
    console.log('\n2. 测试存储适配器...');
    const storage = storageAdapter.getStorage();
    const storageType = storageAdapter.getStorageType();
    console.log('存储类型:', storageType);
    console.log('存储实例:', storage ? '已创建' : '创建失败');
    
    // 3. 测试SQLite数据库初始化
    if (isTauri && storageType === 'sqlite') {
      console.log('\n3. 测试SQLite数据库初始化...');
      
      try {
        // 测试数据库连接
        const result = await invoke('init_sqlite_db');
        console.log('数据库初始化结果:', result);
        
        // 测试基本查询
        const testQuery = await invoke('sqlite_query', {
          sql: 'SELECT name FROM sqlite_master WHERE type="table"',
          params: []
        });
        console.log('数据库表列表:', testQuery);
        
        // 测试插入操作
        const insertResult = await invoke('sqlite_execute', {
          sql: 'INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
          params: ['test-conv-1', '测试对话', Date.now(), Date.now()]
        });
        console.log('插入测试结果:', insertResult);
        
        // 测试查询操作
        const selectResult = await invoke('sqlite_query', {
          sql: 'SELECT * FROM conversations WHERE id = ?',
          params: ['test-conv-1']
        });
        console.log('查询测试结果:', selectResult);
        
        // 清理测试数据
        await invoke('sqlite_execute', {
          sql: 'DELETE FROM conversations WHERE id = ?',
          params: ['test-conv-1']
        });
        console.log('测试数据已清理');
        
      } catch (error) {
        console.error('SQLite测试失败:', error);
      }
    }
    
    // 4. 测试知识库功能
    console.log('\n4. 测试知识库功能...');
    try {
      const { knowledgeBaseManager } = require('./src/utils/knowledgeBase');
      await knowledgeBaseManager.initialize();
      console.log('知识库管理器初始化成功');
      
      // 测试添加文档
      const testDoc = {
        title: '测试文档',
        content: '这是一个测试文档的内容。',
        sourceType: 'manual'
      };
      
      const docId = await knowledgeBaseManager.addDocument(testDoc);
      console.log('添加测试文档成功，ID:', docId);
      
      // 测试搜索
      const searchResults = await knowledgeBaseManager.search('测试', { limit: 5 });
      console.log('搜索测试结果:', searchResults.length, '个结果');
      
      // 清理测试数据
      await knowledgeBaseManager.deleteDocument(docId);
      console.log('测试文档已清理');
      
    } catch (error) {
      console.error('知识库测试失败:', error);
    }
    
    console.log('\n✅ SQLite设置测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 运行测试
if (typeof window !== 'undefined' && window.__TAURI__) {
  testSQLiteSetup();
} else {
  console.log('此测试需要在Tauri环境中运行');
  console.log('请运行: npm run tauri dev');
}

module.exports = { testSQLiteSetup };

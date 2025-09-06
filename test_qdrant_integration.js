/**
 * 测试Qdrant集成
 * 验证知识库是否正确使用Qdrant而不是SQLite
 */

// 模拟Tauri环境
global.window = {
  __TAURI_IPC__: true,
  __TAURI__: true
};

async function testQdrantIntegration() {
  console.log('🧪 开始测试Qdrant集成...');
  
  try {
    // 导入Qdrant知识库管理器
    const { knowledgeBaseManager } = await import('./src/utils/knowledgeBaseQdrant.js');
    
    console.log('✅ 成功导入Qdrant知识库管理器');
    
    // 初始化知识库
    console.log('🔧 初始化知识库...');
    await knowledgeBaseManager.initialize();
    
    console.log('✅ 知识库初始化完成');
    
    // 检查Qdrant状态
    console.log('🔍 检查Qdrant状态...');
    const qdrantInfo = await knowledgeBaseManager.getQdrantInfo();
    console.log('Qdrant信息:', qdrantInfo);
    
    // 添加测试文档
    console.log('📄 添加测试文档...');
    const testDoc = {
      title: 'Qdrant测试文档',
      content: '这是一个测试文档，用于验证Qdrant集成是否正常工作。',
      sourceType: 'text'
    };
    
    const docId = await knowledgeBaseManager.addDocument(testDoc);
    console.log('✅ 文档添加成功，ID:', docId);
    
    // 生成向量嵌入
    console.log('🧠 生成向量嵌入...');
    await knowledgeBaseManager.generateDocumentEmbeddings(docId);
    console.log('✅ 向量嵌入生成完成');
    
    // 搜索测试
    console.log('🔍 执行搜索测试...');
    const searchResults = await knowledgeBaseManager.searchDocuments('测试文档', 5);
    console.log('搜索结果:', searchResults);
    
    // 获取统计信息
    console.log('📊 获取统计信息...');
    const stats = await knowledgeBaseManager.getStatistics();
    console.log('统计信息:', stats);
    
    console.log('🎉 Qdrant集成测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testQdrantIntegration();

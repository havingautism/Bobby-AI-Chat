/**
 * 测试文档上传和向量生成
 */

// 模拟Tauri环境
global.window = {
  __TAURI_IPC__: true,
  __TAURI__: true
};

async function testDocumentUpload() {
  console.log('🧪 开始测试文档上传和向量生成...');
  
  try {
    // 导入知识库管理器
    const { knowledgeBaseManager } = await import('./src/utils/knowledgeBaseQdrant.js');
    
    console.log('✅ 成功导入知识库管理器');
    
    // 初始化知识库
    console.log('🔧 初始化知识库...');
    await knowledgeBaseManager.initialize();
    
    console.log('✅ 知识库初始化完成');
    
    // 添加测试文档
    console.log('📄 添加测试文档...');
    const testDoc = {
      title: '测试文档 - 代码质量',
      content: '如何提高代码质量是一个重要的话题。代码质量包括可读性、可维护性、性能等多个方面。良好的代码应该遵循编程规范，有清晰的注释，并且经过充分的测试。',
      sourceType: 'text'
    };
    
    const docId = await knowledgeBaseManager.addDocument(testDoc);
    console.log('✅ 文档添加成功，ID:', docId);
    
    // 生成向量嵌入
    console.log('🧠 生成向量嵌入...');
    await knowledgeBaseManager.generateDocumentEmbeddings(docId);
    console.log('✅ 向量嵌入生成完成');
    
    // 等待一下让向量处理完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 搜索测试
    console.log('🔍 执行搜索测试...');
    const searchResults = await knowledgeBaseManager.searchDocuments('代码质量', 5, 0.1);
    console.log('搜索结果:', searchResults);
    
    // 获取统计信息
    console.log('📊 获取统计信息...');
    const stats = await knowledgeBaseManager.getStatistics();
    console.log('统计信息:', stats);
    
    // 检查Qdrant集合状态
    console.log('🔍 检查Qdrant集合状态...');
    const response = await fetch('http://localhost:6333/collections/knowledge_base');
    if (response.ok) {
      const info = await response.json();
      console.log('Qdrant集合信息:', {
        points_count: info.result.points_count,
        indexed_vectors_count: info.result.indexed_vectors_count
      });
    }
    
    console.log('🎉 文档上传测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testDocumentUpload();

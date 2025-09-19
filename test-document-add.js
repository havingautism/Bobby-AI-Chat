/**
 * 测试文档添加功能
 * 用于验证文档是否正确添加到数据库中
 */

const testDocumentAdd = async () => {
  try {
    // 假设我们可以访问 knowledgeBaseManager
    const { knowledgeBaseManager } = require('./src/utils/knowledgeBaseManager.js');

    console.log('🧪 开始测试文档添加功能...');

    // 初始化知识库
    await knowledgeBaseManager.initialize();
    console.log('✅ 知识库初始化完成');

    // 测试添加一个简单的中文文档
    const testDocument = {
      title: '测试文档 - 中文',
      content: '这是一个测试文档，用于验证中文文档的添加功能。文档包含中文内容，应该被正确识别并存储到对应的中文知识库中。',
      fileName: 'test-chinese.txt',
      fileSize: 1024,
      mimeType: 'text/plain'
    };

    console.log('📝 添加测试文档...');
    const documentId = await knowledgeBaseManager.addDocument(testDocument);

    console.log(`✅ 文档添加成功，ID: ${documentId}`);

    // 等待一下让数据库操作完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 获取统计信息
    const stats = await knowledgeBaseManager.getStatistics();
    console.log('📊 统计信息:', stats);

    // 获取存储的文档
    const documents = await knowledgeBaseManager.getStoredDocuments();
    console.log(`📄 存储的文档数量: ${documents.length}`);

    if (documents.length > 0) {
      console.log('📋 文档列表:');
      documents.forEach((doc, index) => {
        console.log(`[${index + 1}] ${doc.title} (ID: ${doc.id})`);
      });
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
};

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  window.testDocumentAdd = testDocumentAdd;
  console.log('💡 测试函数已注册为 window.testDocumentAdd()');
}

export default testDocumentAdd;
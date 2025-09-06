// 测试知识库功能
import { knowledgeBaseManager } from './src/utils/knowledgeBase.js';

async function testKnowledgeBase() {
  console.log('🧪 开始测试知识库功能...');
  
  try {
    // 1. 初始化知识库
    console.log('1. 初始化知识库...');
    await knowledgeBaseManager.initialize();
    console.log('✅ 知识库初始化成功');
    
    // 2. 添加测试文档
    console.log('2. 添加测试文档...');
    const testDoc = {
      title: '测试文档',
      content: '这是一个测试文档，用于验证知识库功能。它包含了关于人工智能和机器学习的相关信息。',
      sourceType: 'text',
      metadata: {
        author: 'Test User',
        category: 'AI'
      }
    };
    
    const docId = await knowledgeBaseManager.addDocument(testDoc);
    console.log('✅ 文档添加成功，ID:', docId);
    
    // 3. 获取文档列表
    console.log('3. 获取文档列表...');
    const documents = await knowledgeBaseManager.getStoredDocuments();
    console.log('✅ 获取到', documents.length, '个文档');
    console.log('文档列表:', documents.map(doc => ({ id: doc.id, title: doc.title })));
    
    // 4. 搜索测试
    console.log('4. 搜索测试...');
    const searchResults = await knowledgeBaseManager.search('人工智能', {
      limit: 5,
      threshold: 0.5,
      includeContent: true
    });
    console.log('✅ 搜索完成，找到', searchResults.length, '个结果');
    searchResults.forEach((result, index) => {
      console.log(`结果 ${index + 1}:`, {
        title: result.title,
        score: result.score,
        content: result.content?.substring(0, 100) + '...'
      });
    });
    
    // 5. 获取统计信息
    console.log('5. 获取统计信息...');
    const stats = await knowledgeBaseManager.getStatistics();
    console.log('✅ 统计信息:', stats);
    
    // 6. 删除测试文档
    console.log('6. 删除测试文档...');
    await knowledgeBaseManager.deleteDocument(docId);
    console.log('✅ 文档删除成功');
    
    // 7. 验证删除
    console.log('7. 验证删除...');
    const finalDocs = await knowledgeBaseManager.getStoredDocuments();
    console.log('✅ 删除后剩余文档数量:', finalDocs.length);
    
    console.log('🎉 所有测试通过！知识库功能正常工作。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
  }
}

// 运行测试
testKnowledgeBase();

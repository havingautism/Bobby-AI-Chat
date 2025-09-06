// 测试向量搜索功能
import { knowledgeBaseManager } from './src/utils/knowledgeBase.js';

async function testVectorSearch() {
  console.log('🧪 开始测试向量搜索功能...');
  
  try {
    // 1. 初始化知识库
    console.log('1. 初始化知识库...');
    await knowledgeBaseManager.initialize();
    console.log('✅ 知识库初始化成功');
    
    // 2. 添加测试文档
    console.log('2. 添加测试文档...');
    const testDocs = [
      {
        title: '人工智能基础',
        content: '人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。该领域的研究包括机器人、语言识别、图像识别、自然语言处理和专家系统等。',
        sourceType: 'text'
      },
      {
        title: '机器学习算法',
        content: '机器学习是人工智能的核心，它使计算机能够在没有明确编程的情况下学习。常见的机器学习算法包括线性回归、决策树、随机森林、支持向量机和神经网络等。',
        sourceType: 'text'
      },
      {
        title: '深度学习技术',
        content: '深度学习是机器学习的一个子集，它使用多层神经网络来模拟人脑的工作方式。深度学习在图像识别、语音识别、自然语言处理等领域取得了突破性进展。',
        sourceType: 'text'
      },
      {
        title: '自然语言处理',
        content: '自然语言处理是人工智能和语言学领域的交叉学科，它研究如何让计算机理解、生成和处理人类语言。NLP技术广泛应用于机器翻译、情感分析、问答系统等。',
        sourceType: 'text'
      }
    ];
    
    const docIds = [];
    for (const doc of testDocs) {
      const docId = await knowledgeBaseManager.addDocument(doc);
      docIds.push(docId);
      console.log(`✅ 文档添加成功: ${doc.title} (ID: ${docId})`);
    }
    
    // 等待一下让向量生成完成
    console.log('3. 等待向量生成...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. 测试向量搜索
    console.log('4. 测试向量搜索...');
    const searchQueries = [
      '什么是人工智能？',
      '机器学习算法有哪些？',
      '深度学习在哪些领域应用？',
      '自然语言处理技术'
    ];
    
    for (const query of searchQueries) {
      console.log(`\n🔍 搜索: "${query}"`);
      const results = await knowledgeBaseManager.search(query, {
        limit: 3,
        threshold: 0.1,
        includeContent: true
      });
      
      console.log(`找到 ${results.length} 个结果:`);
      results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} (相似度: ${(result.score * 100).toFixed(1)}%)`);
        console.log(`     内容: ${result.content.substring(0, 100)}...`);
      });
    }
    
    // 5. 获取统计信息
    console.log('\n5. 获取统计信息...');
    const stats = await knowledgeBaseManager.getStatistics();
    console.log('✅ 统计信息:', {
      文档数量: stats.documentCount,
      向量数量: stats.vectorCount,
      总大小: `${(stats.totalSize / 1024).toFixed(2)} KB`
    });
    
    // 6. 清理测试数据
    console.log('\n6. 清理测试数据...');
    for (const docId of docIds) {
      await knowledgeBaseManager.deleteDocument(docId);
      console.log(`✅ 文档删除成功: ${docId}`);
    }
    
    console.log('\n🎉 向量搜索测试完成！所有功能正常工作。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
  }
}

// 运行测试
testVectorSearch();

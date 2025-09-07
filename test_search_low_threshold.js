/**
 * 测试低阈值搜索
 */

async function testLowThresholdSearch() {
  console.log('🧪 开始测试低阈值搜索...');
  
  try {
    // 导入Qdrant服务
    const { default: qdrantService } = await import('./src/utils/qdrantService.js');
    
    // 初始化Qdrant服务
    await qdrantService.initialize();
    
    // 测试不同的搜索查询和阈值
    const testQueries = [
      { query: '测试文档', threshold: 0.0 },
      { query: '测试', threshold: 0.0 },
      { query: '文档', threshold: 0.0 },
      { query: 'Qdrant', threshold: 0.0 },
      { query: '验证', threshold: 0.0 }
    ];
    
    for (const test of testQueries) {
      console.log(`\n🔍 搜索: "${test.query}" (阈值: ${test.threshold})`);
      const results = await qdrantService.searchDocuments(test.query, 5, test.threshold);
      console.log(`结果数量: ${results.length}`);
      if (results.length > 0) {
        console.log('搜索结果:', results[0]);
      }
    }
    
    // 直接测试Qdrant API
    console.log('\n🔍 直接测试Qdrant API...');
    const { default: embeddingService } = await import('./src/utils/embeddingService.js');
    const queryResult = await embeddingService.generateEmbedding('测试文档');
    const queryVector = queryResult.embedding;
    
    const response = await fetch('http://localhost:6333/collections/knowledge_base/points/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryVector,
        limit: 5,
        score_threshold: 0.0
      })
    });
    
    if (response.ok) {
      const searchResults = await response.json();
      console.log('直接API搜索结果:', searchResults);
    } else {
      console.error('直接API搜索失败:', response.statusText);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testLowThresholdSearch();


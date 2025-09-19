// 简化的测试脚本 - 可以在Tauri应用中运行
// 这个脚本检查基本的搜索功能

async function simpleSearchTest() {
  console.log('🧪 开始简单搜索测试...\n');
  
  try {
    // 检查是否有Tauri环境
    if (typeof window.__TAURI__ === 'undefined') {
      console.log('❌ 不在Tauri环境中，无法运行测试');
      return;
    }
    
    // 1. 检查系统状态
    console.log('📊 检查系统状态:');
    const systemStatus = await window.__TAURI__.core.invoke('get_system_status');
    console.log(`   文档数: ${systemStatus.total_documents}`);
    console.log(`   向量数: ${systemStatus.total_vectors}`);
    console.log(`   集合数: ${systemStatus.collections_count}`);
    
    // 2. 检查集合
    const collections = await window.__TAURI__.core.invoke('get_knowledge_collections');
    console.log(`\n📋 找到 ${collections.length} 个集合`);
    
    if (collections.length === 0) {
      console.log('❌ 没有集合，无法测试搜索');
      return;
    }
    
    // 3. 测试搜索
    const firstCollection = collections[0];
    console.log(`\n🔍 测试搜索集合: ${firstCollection.name}`);
    
    const searchResults = await window.__TAURI__.core.invoke('search_knowledge_base', {
      query: "代码报错怎么办",
      collectionId: firstCollection.id,
      limit: 5,
      threshold: 0.01,
      apiKey: ''
    });
    
    console.log(`   搜索结果: ${searchResults.results?.length || 0} 个`);
    
    if (searchResults.results && searchResults.results.length > 0) {
      console.log('✅ 搜索功能正常！');
      searchResults.results.forEach((result, index) => {
        console.log(`     ${index + 1}. ${result.document_title} (${result.similarity?.toFixed(4)})`);
      });
    } else {
      console.log('❌ 搜索无结果');
      if (systemStatus.total_vectors === 0) {
        console.log('💡 原因：没有向量数据，需要生成向量嵌入');
      } else {
        console.log('💡 原因：可能是API密钥或相似度阈值问题');
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
simpleSearchTest();

// 简单的无阈值搜索测试
// 在Tauri应用的浏览器控制台中运行

async function simpleNoThresholdTest() {
  try {
    console.log('🧪 简单无阈值搜索测试...\n');
    
    // 获取invoke方法
    let invoke;
    if (window.__TAURI__.core && window.__TAURI__.core.invoke) {
      invoke = window.__TAURI__.core.invoke;
    } else if (window.__TAURI__.invoke) {
      invoke = window.__TAURI__.invoke;
    } else {
      console.log('❌ 无法找到invoke方法');
      return;
    }
    
    // 检查系统状态
    const systemStatus = await invoke('get_system_status');
    console.log(`📊 文档数: ${systemStatus.total_documents}, 向量数: ${systemStatus.total_vectors}`);
    
    if (systemStatus.total_vectors === 0) {
      console.log('❌ 没有向量数据！这是搜索无结果的主要原因。');
      console.log('💡 建议：在知识库界面点击"生成向量"按钮');
      return;
    }
    
    // 获取集合
    const collections = await invoke('get_knowledge_collections');
    if (collections.length === 0) {
      console.log('❌ 没有集合');
      return;
    }
    
    const firstCollection = collections[0];
    console.log(`📋 使用集合: ${firstCollection.name}`);
    
    // 测试无阈值搜索
    console.log('\n🔍 测试无阈值搜索 (阈值: 0.001):');
    
    const searchResults = await invoke('search_knowledge_base', {
      query: "代码报错怎么办",
      collectionId: firstCollection.id,
      limit: 10,
      threshold: 0.001, // 极低阈值
      apiKey: ''
    });
    
    console.log(`   结果数量: ${searchResults.results?.length || 0}`);
    console.log(`   查询时间: ${searchResults.query_time_ms || 0}ms`);
    
    if (searchResults.results && searchResults.results.length > 0) {
      console.log('✅ 搜索功能正常！');
      searchResults.results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.document_title} (相似度: ${result.similarity?.toFixed(4)})`);
        console.log(`      内容: ${result.chunk_text?.substring(0, 80)}...`);
      });
    } else {
      console.log('❌ 仍然无结果');
      console.log('💡 可能的原因：');
      console.log('   - API密钥未配置');
      console.log('   - 查询文本与文档内容不匹配');
      console.log('   - 向量嵌入质量有问题');
    }
    
    // 测试简单查询
    console.log('\n🔍 测试简单查询 "代码":');
    const simpleResults = await invoke('search_knowledge_base', {
      query: "代码",
      collectionId: firstCollection.id,
      limit: 5,
      threshold: 0.001,
      apiKey: ''
    });
    
    console.log(`   结果数量: ${simpleResults.results?.length || 0}`);
    
    if (simpleResults.results && simpleResults.results.length > 0) {
      console.log('✅ 简单查询有结果！');
      simpleResults.results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.document_title} (相似度: ${result.similarity?.toFixed(4)})`);
      });
    } else {
      console.log('❌ 简单查询也无结果');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
simpleNoThresholdTest();

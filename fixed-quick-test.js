// 修复的快速测试脚本
// 在Tauri应用的浏览器控制台中运行

async function quickTest() {
  try {
    console.log('🧪 快速测试开始...');
    
    // 检查Tauri环境
    if (typeof window.__TAURI__ === 'undefined') {
      console.log('❌ 不在Tauri环境中');
      return;
    }
    
    console.log('✅ 检测到Tauri环境');
    
    // 方法1：尝试使用window.__TAURI__.core.invoke
    let invoke;
    try {
      invoke = window.__TAURI__.core.invoke;
      console.log('✅ 使用 window.__TAURI__.core.invoke');
    } catch (e) {
      // 方法2：尝试使用window.__TAURI__.invoke
      try {
        invoke = window.__TAURI__.invoke;
        console.log('✅ 使用 window.__TAURI__.invoke');
      } catch (e2) {
        // 方法3：尝试动态导入
        try {
          const tauriCore = await import('@tauri-apps/api/core');
          invoke = tauriCore.invoke;
          console.log('✅ 使用动态导入的 invoke');
        } catch (e3) {
          console.log('❌ 无法找到Tauri invoke方法');
          console.log('可用的Tauri对象:', Object.keys(window.__TAURI__ || {}));
          return;
        }
      }
    }
    
    // 检查系统状态
    console.log('📊 检查系统状态...');
    const systemStatus = await invoke('get_system_status');
    console.log(`   文档数: ${systemStatus.total_documents}`);
    console.log(`   向量数: ${systemStatus.total_vectors}`);
    console.log(`   集合数: ${systemStatus.collections_count}`);
    console.log(`   数据库健康: ${systemStatus.database_health.main_db ? '✅' : '❌'}`);
    console.log(`   知识库健康: ${systemStatus.database_health.knowledge_db ? '✅' : '❌'}`);
    console.log(`   向量扩展: ${systemStatus.database_health.vec_extension ? '✅' : '❌'}`);
    
    // 检查集合
    console.log('\n📋 检查知识库集合...');
    const collections = await invoke('get_knowledge_collections');
    console.log(`   找到 ${collections.length} 个集合`);
    
    if (collections.length === 0) {
      console.log('❌ 没有找到任何集合！');
      return;
    }
    
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name} (ID: ${col.id})`);
      console.log(`      模型: ${col.embedding_model}, 维度: ${col.vector_dimensions}`);
    });
    
    // 检查文档
    const firstCollection = collections[0];
    console.log(`\n📄 检查集合 "${firstCollection.name}" 的文档...`);
    const documents = await invoke('get_knowledge_documents', { 
      collectionId: firstCollection.id 
    });
    console.log(`   找到 ${documents.length} 个文档`);
    
    if (documents.length === 0) {
      console.log('❌ 没有找到任何文档！');
      console.log('💡 建议：上传一些文档到知识库');
      return;
    }
    
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.title}`);
      console.log(`      大小: ${doc.file_size || 'N/A'} bytes`);
      console.log(`      分块数: ${doc.chunk_count || 0}`);
      console.log(`      内容长度: ${doc.content?.length || 0} 字符`);
    });
    
    // 测试搜索
    console.log('\n🔍 测试搜索功能...');
    const testQuery = "代码报错怎么办";
    console.log(`   测试查询: "${testQuery}"`);
    
    try {
      const searchResults = await invoke('search_knowledge_base', {
        query: testQuery,
        collectionId: firstCollection.id,
        limit: 5,
        threshold: 0.01,
        apiKey: ''
      });
      
      console.log(`   搜索结果: ${searchResults.results?.length || 0} 个`);
      console.log(`   查询时间: ${searchResults.query_time_ms || 0}ms`);
      console.log(`   使用模型: ${searchResults.embedding_model || 'N/A'}`);
      
      if (searchResults.results && searchResults.results.length > 0) {
        console.log('✅ 搜索功能正常！');
        searchResults.results.forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.document_title} (相似度: ${result.similarity?.toFixed(4) || 'N/A'})`);
        });
      } else {
        console.log('❌ 搜索无结果');
        if (systemStatus.total_vectors === 0) {
          console.log('💡 原因：没有向量数据，需要生成向量嵌入');
        } else {
          console.log('💡 可能原因：');
          console.log('   - API密钥未配置');
          console.log('   - 相似度阈值过高');
          console.log('   - 查询文本与文档内容不匹配');
        }
      }
      
    } catch (searchError) {
      console.log(`❌ 搜索测试失败: ${searchError.message}`);
    }
    
    // 检查API密钥
    console.log('\n🔑 检查API密钥配置...');
    try {
      const settings = await invoke('get_all_settings');
      const apiKeySetting = settings.find(s => s[0] === 'api_key');
      if (apiKeySetting && apiKeySetting[1]) {
        console.log(`   API密钥: 已配置 (长度: ${apiKeySetting[1].length})`);
      } else {
        console.log('   API密钥: 未配置');
        console.log('💡 建议：在设置中配置API密钥');
      }
    } catch (error) {
      console.log(`   ⚠️ 无法检查API密钥: ${error.message}`);
    }
    
    console.log('\n🎯 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.log('错误详情:', error);
  }
}

// 运行测试
quickTest();


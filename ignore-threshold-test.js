// 忽略阈值的搜索测试脚本
// 在Tauri应用的浏览器控制台中运行

async function testWithoutThreshold() {
  try {
    console.log('🧪 忽略阈值的搜索测试开始...\n');
    
    // 检查Tauri环境
    if (typeof window.__TAURI__ === 'undefined') {
      console.log('❌ 不在Tauri环境中');
      return;
    }
    
    // 尝试不同的invoke方式
    let invoke;
    if (window.__TAURI__.core && window.__TAURI__.core.invoke) {
      invoke = window.__TAURI__.core.invoke;
      console.log('✅ 使用 window.__TAURI__.core.invoke');
    } else if (window.__TAURI__.invoke) {
      invoke = window.__TAURI__.invoke;
      console.log('✅ 使用 window.__TAURI__.invoke');
    } else {
      console.log('❌ 无法找到invoke方法');
      return;
    }
    
    // 1. 检查系统状态
    console.log('📊 1. 检查系统状态:');
    const systemStatus = await invoke('get_system_status');
    console.log(`   总文档数: ${systemStatus.total_documents}`);
    console.log(`   总向量数: ${systemStatus.total_vectors}`);
    console.log(`   集合数: ${systemStatus.collections_count}`);
    
    // 2. 检查集合
    console.log('\n📋 2. 检查知识库集合:');
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
    
    // 3. 检查文档
    const firstCollection = collections[0];
    console.log(`\n📄 3. 检查集合 "${firstCollection.name}" 的文档:`);
    const documents = await invoke('get_knowledge_documents', { 
      collectionId: firstCollection.id 
    });
    console.log(`   找到 ${documents.length} 个文档`);
    
    if (documents.length === 0) {
      console.log('❌ 没有找到任何文档！');
      return;
    }
    
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.title}`);
      console.log(`      大小: ${doc.file_size || 'N/A'} bytes`);
      console.log(`      分块数: ${doc.chunk_count || 0}`);
      console.log(`      内容长度: ${doc.content?.length || 0} 字符`);
      console.log(`      内容预览: ${doc.content?.substring(0, 100)}...`);
    });
    
    // 4. 测试不同阈值的搜索
    console.log('\n🔍 4. 测试不同阈值的搜索:');
    const testQuery = "代码报错怎么办";
    console.log(`   测试查询: "${testQuery}"`);
    
    const thresholds = [0.01, 0.1, 0.3, 0.5, 0.7, 0.9];
    
    for (const threshold of thresholds) {
      try {
        console.log(`\n   🎯 测试阈值: ${threshold}`);
        
        const searchResults = await invoke('search_knowledge_base', {
          query: testQuery,
          collectionId: firstCollection.id,
          limit: 10, // 增加限制数量
          threshold: threshold,
          apiKey: ''
        });
        
        console.log(`      结果数量: ${searchResults.results?.length || 0}`);
        console.log(`      查询时间: ${searchResults.query_time_ms || 0}ms`);
        console.log(`      使用模型: ${searchResults.embedding_model || 'N/A'}`);
        
        if (searchResults.results && searchResults.results.length > 0) {
          console.log('      ✅ 找到结果！');
          searchResults.results.forEach((result, index) => {
            console.log(`         ${index + 1}. ${result.document_title} (相似度: ${result.similarity?.toFixed(4) || 'N/A'})`);
            console.log(`            内容: ${result.chunk_text?.substring(0, 50)}...`);
          });
        } else {
          console.log('      ❌ 无结果');
        }
        
      } catch (searchError) {
        console.log(`      ❌ 搜索失败: ${searchError.message}`);
      }
    }
    
    // 5. 测试无阈值限制的搜索（使用极低阈值）
    console.log('\n🔍 5. 测试无阈值限制的搜索:');
    try {
      const searchResults = await invoke('search_knowledge_base', {
        query: testQuery,
        collectionId: firstCollection.id,
        limit: 20, // 增加限制数量
        threshold: 0.001, // 极低阈值
        apiKey: ''
      });
      
      console.log(`   结果数量: ${searchResults.results?.length || 0}`);
      console.log(`   查询时间: ${searchResults.query_time_ms || 0}ms`);
      
      if (searchResults.results && searchResults.results.length > 0) {
        console.log('   ✅ 找到结果！');
        searchResults.results.forEach((result, index) => {
          console.log(`      ${index + 1}. ${result.document_title} (相似度: ${result.similarity?.toFixed(4) || 'N/A'})`);
          console.log(`         内容: ${result.chunk_text?.substring(0, 100)}...`);
        });
      } else {
        console.log('   ❌ 仍然无结果');
        console.log('   💡 可能的原因：');
        console.log('      - 没有向量数据');
        console.log('      - API密钥未配置');
        console.log('      - 查询文本与文档内容完全不匹配');
        console.log('      - 向量嵌入生成失败');
      }
      
    } catch (searchError) {
      console.log(`   ❌ 搜索失败: ${searchError.message}`);
    }
    
    // 6. 测试不同的查询
    console.log('\n🔍 6. 测试不同的查询:');
    const testQueries = [
      "代码",
      "错误",
      "问题",
      "帮助",
      "如何",
      "编程",
      "开发"
    ];
    
    for (const query of testQueries) {
      try {
        console.log(`\n   🎯 测试查询: "${query}"`);
        
        const searchResults = await invoke('search_knowledge_base', {
          query: query,
          collectionId: firstCollection.id,
          limit: 5,
          threshold: 0.001, // 极低阈值
          apiKey: ''
        });
        
        console.log(`      结果数量: ${searchResults.results?.length || 0}`);
        
        if (searchResults.results && searchResults.results.length > 0) {
          console.log('      ✅ 找到结果！');
          searchResults.results.forEach((result, index) => {
            console.log(`         ${index + 1}. ${result.document_title} (相似度: ${result.similarity?.toFixed(4) || 'N/A'})`);
          });
        } else {
          console.log('      ❌ 无结果');
        }
        
      } catch (searchError) {
        console.log(`      ❌ 搜索失败: ${searchError.message}`);
      }
    }
    
    console.log('\n🎯 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.log('错误详情:', error);
  }
}

// 运行测试
testWithoutThreshold();



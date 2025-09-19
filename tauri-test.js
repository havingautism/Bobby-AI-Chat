// Tauri应用中的测试函数
// 这个文件可以在Tauri应用中导入和使用

export async function testKnowledgeBaseSearch() {
  console.log('🧪 开始知识库搜索测试...\n');
  
  try {
    // 1. 检查系统状态
    console.log('📊 1. 检查系统状态:');
    const { invoke } = await import('@tauri-apps/api/core');
    
    const systemStatus = await invoke('get_system_status');
    console.log(`   总文档数: ${systemStatus.total_documents}`);
    console.log(`   总向量数: ${systemStatus.total_vectors}`);
    console.log(`   集合数: ${systemStatus.collections_count}`);
    console.log(`   数据库健康: ${systemStatus.database_health.main_db ? '✅' : '❌'}`);
    console.log(`   知识库健康: ${systemStatus.database_health.knowledge_db ? '✅' : '❌'}`);
    console.log(`   向量扩展: ${systemStatus.database_health.vec_extension ? '✅' : '❌'}`);
    
    // 2. 检查集合
    console.log('\n📋 2. 检查知识库集合:');
    const collections = await invoke('get_knowledge_collections');
    console.log(`   找到 ${collections.length} 个集合:`);
    
    if (collections.length === 0) {
      console.log('❌ 没有找到任何集合！');
      return { success: false, reason: 'no_collections' };
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
    console.log(`   找到 ${documents.length} 个文档:`);
    
    if (documents.length === 0) {
      console.log('❌ 没有找到任何文档！');
      return { success: false, reason: 'no_documents' };
    }
    
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.title}`);
      console.log(`      大小: ${doc.file_size || 'N/A'} bytes`);
      console.log(`      分块数: ${doc.chunk_count || 0}`);
      console.log(`      内容长度: ${doc.content?.length || 0} 字符`);
    });
    
    // 4. 测试搜索
    console.log('\n🔍 4. 测试搜索功能:');
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
        return { success: true, results: searchResults.results };
      } else {
        console.log('❌ 搜索无结果');
        return { success: false, reason: 'no_search_results' };
      }
      
    } catch (searchError) {
      console.log(`❌ 搜索测试失败: ${searchError.message}`);
      return { success: false, reason: 'search_error', error: searchError.message };
    }
    
  } catch (error) {
    console.error('❌ 测试过程失败:', error);
    return { success: false, reason: 'test_error', error: error.message };
  }
}

// 测试向量生成功能
export async function testVectorGeneration() {
  console.log('🔧 测试向量生成功能...\n');
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // 获取第一个文档
    const collections = await invoke('get_knowledge_collections');
    if (collections.length === 0) {
      console.log('❌ 没有集合');
      return { success: false, reason: 'no_collections' };
    }
    
    const documents = await invoke('get_knowledge_documents', { 
      collectionId: collections[0].id 
    });
    
    if (documents.length === 0) {
      console.log('❌ 没有文档');
      return { success: false, reason: 'no_documents' };
    }
    
    const firstDoc = documents[0];
    console.log(`📄 为文档 "${firstDoc.title}" 生成向量...`);
    
    const response = await invoke('generate_document_embeddings', {
      request: {
        document_id: firstDoc.id,
        collection_id: collections[0].id,
        content: null,
        model: null
      },
      apiKey: ''
    });
    
    console.log(`✅ 向量生成完成:`, response);
    return { success: true, response };
    
  } catch (error) {
    console.error('❌ 向量生成失败:', error);
    return { success: false, reason: 'vector_generation_error', error: error.message };
  }
}

// 运行完整测试
export async function runFullTest() {
  console.log('🚀 开始完整测试...\n');
  
  const searchResult = await testKnowledgeBaseSearch();
  
  if (!searchResult.success && searchResult.reason === 'no_search_results') {
    console.log('\n🔧 搜索无结果，尝试生成向量...');
    const vectorResult = await testVectorGeneration();
    
    if (vectorResult.success) {
      console.log('\n🔄 重新测试搜索...');
      const retryResult = await testKnowledgeBaseSearch();
      return retryResult;
    }
  }
  
  return searchResult;
}

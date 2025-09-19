// 诊断知识库搜索问题的完整脚本
const { invoke } = require('@tauri-apps/api/core');

async function diagnoseSearchIssue() {
  console.log('🔍 开始诊断知识库搜索问题...\n');
  
  try {
    // 1. 检查系统状态
    console.log('📊 1. 检查系统状态:');
    const systemStatus = await invoke('get_system_status');
    console.log(`   总文档数: ${systemStatus.total_documents}`);
    console.log(`   总向量数: ${systemStatus.total_vectors}`);
    console.log(`   集合数: ${systemStatus.collections_count}`);
    console.log(`   数据库健康: ${systemStatus.database_health.main_db ? '✅' : '❌'}`);
    console.log(`   知识库健康: ${systemStatus.database_health.knowledge_db ? '✅' : '❌'}`);
    console.log(`   向量扩展: ${systemStatus.database_health.vec_extension ? '✅' : '❌'}`);
    
    if (systemStatus.total_vectors === 0) {
      console.log('\n❌ 问题发现：没有向量数据！');
      console.log('💡 这可能是搜索无结果的主要原因。');
    }
    
    // 2. 检查集合
    console.log('\n📋 2. 检查知识库集合:');
    const collections = await invoke('get_knowledge_collections');
    console.log(`   找到 ${collections.length} 个集合:`);
    
    if (collections.length === 0) {
      console.log('❌ 没有找到任何集合！');
      return;
    }
    
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name} (ID: ${col.id})`);
      console.log(`      模型: ${col.embedding_model}, 维度: ${col.vector_dimensions}`);
    });
    
    // 3. 检查第一个集合的文档
    const firstCollection = collections[0];
    console.log(`\n📄 3. 检查集合 "${firstCollection.name}" 的文档:`);
    const documents = await invoke('get_knowledge_documents', { 
      collectionId: firstCollection.id 
    });
    console.log(`   找到 ${documents.length} 个文档:`);
    
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
      console.log(`      内容预览: ${doc.content?.substring(0, 100)}...`);
    });
    
    // 4. 测试搜索功能
    console.log('\n🔍 4. 测试搜索功能:');
    const testQuery = "代码报错怎么办";
    console.log(`   测试查询: "${testQuery}"`);
    
    try {
      const searchResults = await invoke('search_knowledge_base', {
        query: testQuery,
        collectionId: firstCollection.id,
        limit: 5,
        threshold: 0.01,
        apiKey: '' // 先测试无API密钥的情况
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
        console.log('💡 可能的原因：');
        console.log('   - 没有向量数据');
        console.log('   - API密钥未配置');
        console.log('   - 相似度阈值过高');
        console.log('   - 查询文本与文档内容不匹配');
      }
      
    } catch (searchError) {
      console.log(`❌ 搜索测试失败: ${searchError.message}`);
    }
    
    // 5. 检查API密钥配置
    console.log('\n🔑 5. 检查API密钥配置:');
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
    
    // 6. 建议的解决方案
    console.log('\n💡 6. 建议的解决方案:');
    if (systemStatus.total_vectors === 0) {
      console.log('   - 为现有文档生成向量嵌入');
      console.log('   - 检查文档内容是否有效');
      console.log('   - 确保API密钥已正确配置');
    } else if (documents.length === 0) {
      console.log('   - 上传一些测试文档');
      console.log('   - 确保文档格式正确');
    } else {
      console.log('   - 检查相似度阈值设置');
      console.log('   - 尝试不同的搜索查询');
      console.log('   - 检查向量嵌入质量');
    }
    
  } catch (error) {
    console.error('❌ 诊断过程失败:', error);
  }
}

diagnoseSearchIssue();


// 检查数据库内容的脚本
const { invoke } = require('@tauri-apps/api/core');

async function checkDatabase() {
  console.log('🔍 检查数据库内容...\n');
  
  try {
    // 检查集合
    console.log('📋 检查知识库集合:');
    const collections = await invoke('get_knowledge_collections');
    console.log(`   找到 ${collections.length} 个集合:`);
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name} (ID: ${col.id})`);
      console.log(`      模型: ${col.embedding_model}, 维度: ${col.vector_dimensions}`);
    });
    
    if (collections.length === 0) {
      console.log('❌ 没有找到任何集合！');
      return;
    }
    
    // 检查第一个集合的文档
    const firstCollection = collections[0];
    console.log(`\n📄 检查集合 "${firstCollection.name}" 的文档:`);
    const documents = await invoke('get_knowledge_documents', { 
      collectionId: firstCollection.id 
    });
    console.log(`   找到 ${documents.length} 个文档:`);
    
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.title}`);
      console.log(`      大小: ${doc.file_size || 'N/A'} bytes`);
      console.log(`      分块数: ${doc.chunk_count || 0}`);
      console.log(`      内容预览: ${doc.content?.substring(0, 100)}...`);
    });
    
    if (documents.length === 0) {
      console.log('❌ 没有找到任何文档！');
      return;
    }
    
    // 检查系统状态（包含向量数量）
    console.log(`\n🧮 检查系统状态:`);
    try {
      const systemStatus = await invoke('get_system_status');
      console.log(`   总文档数: ${systemStatus.total_documents}`);
      console.log(`   总向量数: ${systemStatus.total_vectors}`);
      console.log(`   集合数: ${systemStatus.collections_count}`);
      
      if (systemStatus.total_vectors === 0) {
        console.log('❌ 没有找到任何向量！这可能是问题所在。');
        console.log('💡 建议：重新上传文档并生成向量嵌入');
      }
    } catch (error) {
      console.log('⚠️ 无法获取系统状态:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 检查数据库失败:', error);
  }
}

checkDatabase();

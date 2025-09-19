/**
 * 数据库调试测试脚本
 * 用于验证SQLite数据库中的文档和向量存储
 */

import knowledgeBaseSQLiteVec from './utils/knowledgeBaseSQLiteVec.js';

async function debugDatabase() {
  console.log('🚀 开始数据库调试测试...');

  try {
    // 初始化知识库
    await knowledgeBaseSQLiteVec.initialize();

    // 获取数据库调试信息
    const debugInfo = await knowledgeBaseSQLiteVec.debugDatabaseInfo();

    if (debugInfo) {
      console.log('📊 数据库统计信息:');
      console.log(`- 总集合数: ${debugInfo.total_collections}`);
      console.log(`- 总文档数: ${debugInfo.total_documents}`);
      console.log(`- 总向量数: ${debugInfo.total_vectors}`);
      console.log(`- 数据库路径: ${debugInfo.database_path}`);

      console.log('\n📦 集合详细信息:');
      debugInfo.collections.forEach(collection => {
        console.log(`\n集合: ${collection.name} (${collection.id})`);
        console.log(`- 嵌入模型: ${collection.embedding_model}`);
        console.log(`- 向量维度: ${collection.vector_dimensions}`);
        console.log(`- 文档数量: ${collection.document_count}`);
        console.log(`- 向量数量: ${collection.vector_count}`);

        console.log('- 文档列表:');
        collection.documents.forEach(doc => {
          console.log(`  * ${doc.title} (ID: ${doc.id})`);
          console.log(`    内容长度: ${doc.content_length}`);
          console.log(`    文件名: ${doc.file_name || 'N/A'}`);
          console.log(`    分块数: ${doc.chunk_count}`);
          console.log(`    创建时间: ${doc.created_at}`);
        });
      });
    }

    // 测试添加一个简单的文档
    console.log('\n🧪 测试添加文档...');
    const testDocId = await knowledgeBaseSQLiteVec.addDocument(
      'test_collection',
      '测试文档',
      '这是一个测试文档的内容，用于验证数据库存储功能。',
      'test.txt',
      1024,
      'text/plain'
    );

    console.log(`✅ 测试文档添加成功，ID: ${testDocId}`);

    // 再次获取调试信息
    console.log('\n🔍 重新获取数据库调试信息...');
    const updatedDebugInfo = await knowledgeBaseSQLiteVec.debugDatabaseInfo();

    if (updatedDebugInfo) {
      console.log(`📈 更新后统计 - 总文档数: ${updatedDebugInfo.total_documents}, 总向量数: ${updatedDebugInfo.total_vectors}`);
    }

  } catch (error) {
    console.error('❌ 数据库调试测试失败:', error);
  }
}

// 如果直接运行此脚本
if (typeof window !== 'undefined') {
  window.debugDatabase = debugDatabase;
  console.log('💡 调试函数已注册为 window.debugDatabase()');
}

export default debugDatabase;
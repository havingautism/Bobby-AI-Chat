/**
 * 测试数据库内容调试
 */

// 模拟Tauri invoke函数（用于测试）
const mockInvoke = async (command, params = {}) => {
  console.log(`🔍 调用命令: ${command}`, params);

  // 这里我们需要实际运行Tauri应用来测试
  // 暂时返回模拟数据
  if (command === 'get_knowledge_collections') {
    return [
      { id: '32f4a39f-fe32-472d-b480-c9e370e164af', name: '默认知识库 (BAAI/bge-m3)' }
    ];
  }

  if (command === 'get_knowledge_documents') {
    return [
      {
        id: 'doc1',
        title: '测试文档',
        content: '这是测试文档的内容，用于验证数据库中是否有重复数据。',
        file_name: 'test.txt',
        chunk_count: 1
      }
    ];
  }

  if (command === 'debug_database_info') {
    return {
      collections_count: 1,
      total_documents: 1,
      total_chunks: 1,
      total_vectors: 1
    };
  }

  return null;
};

// 在浏览器控制台中运行的实际代码
const actualCode = `
// 在浏览器控制台中运行以下代码：
const { invoke } = window.__TAURI__?.core?.invoke || window.__TAURI__.invoke;

async function debugDatabase() {
  console.log('🔍 ===== 开始调试数据库内容 =====');

  try {
    // 1. 获取所有集合
    const collections = await invoke('get_knowledge_collections');
    console.log('📦 集合列表:', collections);

    // 2. 检查每个集合的文档
    for (const collection of collections) {
      console.log(\`\\n📄 检查集合: \${collection.name}\`);

      const documents = await invoke('get_knowledge_documents', {
        collectionId: collection.id
      });
      console.log(\`文档数量: \${documents?.length || 0}\`);

      if (documents && documents.length > 0) {
        for (const doc of documents) {
          console.log(\`📝 文档: \${doc.title}\`);
          console.log(\`   内容预览: \${doc.content?.substring(0, 100)}...\`);
        }
      }
    }

    // 3. 调试信息
    const debugInfo = await invoke('debug_database_info');
    console.log('🔍 数据库调试信息:', debugInfo);

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugDatabase();
`;

console.log('请在浏览器控制台中运行以下代码:');
console.log(actualCode);

console.log('\n或者直接在浏览器中访问应用，然后在控制台中运行debugDatabase()函数');
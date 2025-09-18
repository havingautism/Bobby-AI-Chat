/**
 * 调试数据库内容 - 检查实际存储的数据
 */

const { invoke } = window.__TAURI__.invoke || window.__TAURI__?.core?.invoke;

async function debugDatabaseContents() {
  console.log('🔍 ===== 开始调试数据库内容 =====');

  try {
    // 1. 获取所有集合
    console.log('\n📦 获取所有集合...');
    const collections = await invoke('get_knowledge_collections');
    console.log('集合列表:', collections);

    if (!collections || collections.length === 0) {
      console.log('❌ 没有找到任何集合');
      return;
    }

    // 2. 检查每个集合的文档
    for (const collection of collections) {
      console.log(`\n📄 检查集合: ${collection.name} (ID: ${collection.id})`);

      const documents = await invoke('get_knowledge_documents', {
        collectionId: collection.id
      });
      console.log(`集合 ${collection.name} 中的文档数量: ${documents?.length || 0}`);

      if (documents && documents.length > 0) {
        // 检查是否有重复文档
        const docTitles = {};
        const docContents = {};

        for (const doc of documents) {
          console.log(`\n📝 文档: ${doc.title}`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   文件名: ${doc.file_name || 'N/A'}`);
          console.log(`   内容长度: ${doc.content?.length || 0}`);
          console.log(`   Chunk数量: ${doc.chunk_count || 0}`);

          // 检查标题重复
          if (docTitles[doc.title]) {
            console.log(`   ⚠️ 发现重复标题: "${doc.title}"`);
            docTitles[doc.title]++;
          } else {
            docTitles[doc.title] = 1;
          }

          // 检查内容重复（前100个字符作为标识）
          const contentSignature = doc.content?.substring(0, 100) || '';
          if (docContents[contentSignature]) {
            console.log(`   ⚠️ 发现重复内容 (前100字符): "${contentSignature.substring(0, 50)}..."`);
            docContents[contentSignature]++;
          } else {
            docContents[contentSignature] = 1;
          }
        }

        console.log(`\n📊 集合 ${collection.name} 重复统计:`);
        console.log(`   重复标题数: ${Object.values(docTitles).filter(count => count > 1).length}`);
        console.log(`   重复内容数: ${Object.values(docContents).filter(count => count > 1).length}`);
      }
    }

    // 3. 检查chunks表
    console.log('\n🔍 检查数据库debug信息...');
    const debugInfo = await invoke('debug_database_info');
    console.log('数据库调试信息:', debugInfo);

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 执行调试
debugDatabaseContents();
/**
 * 测试搜索功能调试
 * 在浏览器控制台中运行此代码
 */

// 在浏览器控制台中运行：
async function testSearchWithDebug() {
  console.log('🧪 ===== 开始搜索调试测试 =====');

  try {
    // 1. 清空缓存
    console.log('\n🗑️ 清空缓存...');
    const cacheResult = await invoke('clear_cache');
    console.log('缓存清理结果:', cacheResult);

    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. 执行搜索
    console.log('\n🔍 执行搜索测试...');
    const searchQuery = '如何提高代码质量';
    console.log('搜索查询:', searchQuery);

    const searchResults = await invoke('search_knowledge_base', {
      query: searchQuery,
      collection_id: null,
      limit: 5,
      threshold: 0.01,
      apiKey: 'sk-cedctmnrqgqyfzqyqyqyqyqyqyqyqyqyqyqyqyqyqyqyqy' // 替换为实际API密钥
    });

    console.log('🔍 搜索结果:');
    console.log('- 结果数量:', searchResults.results?.length || 0);
    console.log('- 查询时间:', searchResults.query_time_ms, 'ms');
    console.log('- 集合ID:', searchResults.collection_id);
    console.log('- 嵌入模型:', searchResults.embedding_model);

    // 分析结果
    if (searchResults.results && searchResults.results.length > 0) {
      console.log('\n📊 结果分析:');
      const contentMap = new Map();

      searchResults.results.forEach((result, index) => {
        console.log(`\n结果 ${index + 1}:`);
        console.log(`  分数: ${result.similarity || result.score}`);
        console.log(`  文档ID: ${result.document_id}`);
        console.log(`  文档标题: ${result.document_title}`);
        console.log(`  内容预览: ${(result.chunk_text || '').substring(0, 100)}...`);

        // 检查重复内容
        const content = result.chunk_text || '';
        if (contentMap.has(content)) {
          console.log(`  ⚠️ 发现重复内容! 与结果 ${contentMap.get(content)} 相同`);
        } else {
          contentMap.set(content, index + 1);
        }
      });

      console.log(`\n📈 统计信息:`);
      console.log(`  唯一内容数量: ${contentMap.size}`);
      console.log(`  重复内容数量: ${searchResults.results.length - contentMap.size}`);
    } else {
      console.log('❌ 搜索结果为空');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 输出使用说明
console.log(`
请在浏览器控制台中运行以下命令：

1. 清空缓存并测试搜索:
   testSearchWithDebug()

2. 仅清空缓存:
   invoke('clear_cache')

3. 获取数据库调试信息:
   invoke('debug_database_info')

4. 获取所有集合:
   invoke('get_knowledge_collections')

注意: 确保在应用运行状态下执行，并且已配置正确的API密钥。
`);
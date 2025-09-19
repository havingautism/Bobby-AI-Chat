// 测试知识库搜索修复
// 这个脚本用于验证搜索功能是否正常工作

const { knowledgeBaseManager } = require('./src/utils/knowledgeBase.js');

async function testSearchFix() {
  console.log('🧪 开始测试知识库搜索修复...\n');
  
  try {
    // 测试搜索功能
    const testQuery = "代码报错怎么办";
    console.log(`🔍 测试查询: "${testQuery}"`);
    
    const results = await knowledgeBaseManager.searchSQLite(testQuery, 5, 0.01, false);
    
    console.log(`📊 搜索结果: 找到 ${results.length} 个匹配文档`);
    
    if (results.length > 0) {
      console.log('✅ 搜索功能正常工作！');
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.title} (相似度: ${result.score?.toFixed(4) || 'N/A'})`);
      });
    } else {
      console.log('❌ 仍然没有找到结果，可能需要检查：');
      console.log('   1. 数据库中是否有文档');
      console.log('   2. 文档是否已生成向量嵌入');
      console.log('   3. API密钥是否正确配置');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testSearchFix();
}

module.exports = { testSearchFix };

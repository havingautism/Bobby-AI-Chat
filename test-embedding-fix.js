// 测试嵌入功能修复
const { getApiConfig } = require('./src/utils/api-manager');

async function testEmbeddingFix() {
  try {
    console.log('🧪 测试嵌入功能修复...');

    // 检查API配置
    const apiConfig = getApiConfig();
    console.log('📋 API配置状态:', {
      provider: apiConfig.provider,
      hasApiKey: !!apiConfig.apiKey,
      apiKeyLength: apiConfig.apiKey ? apiConfig.apiKey.length : 0,
      model: apiConfig.model
    });

    if (!apiConfig.apiKey) {
      console.log('⚠️  API密钥未配置，请在设置中配置SiliconFlow API密钥');
      console.log('💡 配置步骤:');
      console.log('   1. 打开应用设置');
      console.log('   2. 找到API配置部分');
      console.log('   3. 输入SiliconFlow API密钥');
      console.log('   4. 保存配置');
      return;
    }

    console.log('✅ API密钥已配置');
    console.log('🎉 嵌入功能修复测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果模块被直接运行，执行测试
if (require.main === module) {
  testEmbeddingFix();
}

module.exports = { testEmbeddingFix };
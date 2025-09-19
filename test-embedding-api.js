// 测试嵌入API调用
const { invoke } = window.__TAURI__.core;

async function testEmbeddingAPI() {
  try {
    console.log('🧪 测试嵌入API调用...');

    // 获取API配置
    const { getApiConfig } = await import('./src/utils/api-manager.js');
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

    console.log('✅ API密钥已配置，测试嵌入生成...');

    // 测试单个嵌入生成
    console.log('🔍 测试单个嵌入生成...');
    const singleEmbedding = await invoke('generate_siliconflow_embedding_cmd', {
      apiKey: apiConfig.apiKey,
      text: '测试文本',
      model: 'BAAI/bge-m3'
    });

    console.log(`✅ 单个嵌入生成成功: ${singleEmbedding.length} 维`);

    // 测试批量嵌入生成
    console.log('🔍 测试批量嵌入生成...');
    const batchEmbeddings = await invoke('generate_siliconflow_batch_embeddings_cmd', {
      apiKey: apiConfig.apiKey,
      texts: ['测试文本1', '测试文本2', '测试文本3'],
      model: 'BAAI/bge-m3'
    });

    console.log(`✅ 批量嵌入生成成功: ${batchEmbeddings.length} 个向量，每个 ${batchEmbeddings[0].length} 维`);

    console.log('🎉 嵌入API测试完成！所有API调用正常工作。');

  } catch (error) {
    console.error('❌ 嵌入API测试失败:', error);
    console.log('📋 错误详情:', error.message || error);
  }
}

// 如果运行在Tauri环境中，自动执行测试
if (window.__TAURI__) {
  testEmbeddingAPI();
} else {
  console.log('⚠️ 请在Tauri环境中运行此测试脚本');
  console.log('💡 使用方法：');
  console.log('   1. 确保已配置SiliconFlow API密钥');
  console.log('   2. 在应用控制台中运行 testEmbeddingAPI()');
}

export { testEmbeddingAPI };
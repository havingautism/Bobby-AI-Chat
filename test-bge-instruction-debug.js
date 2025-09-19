// BGE指令前缀调试测试脚本
// 在浏览器控制台中运行此脚本

console.log('🔍 开始BGE指令前缀调试测试...');

async function testBGEInstruction() {
    try {
        // 检查Tauri环境
        if (typeof window.__TAURI__ === 'undefined') {
            console.error('❌ 未检测到Tauri环境，请在Tauri应用中运行此脚本');
            return;
        }

        const { invoke } = window.__TAURI__.core || window.__TAURI__;
        
        console.log('✅ Tauri环境检测成功');
        
        // 测试查询
        const testQuery = "Transformer模型的核心创新是什么";
        console.log(`🧪 测试查询: "${testQuery}"`);
        
        // 获取API密钥
        const settings = await invoke('get_settings');
        const apiKey = settings?.siliconflowApiKey || '';
        
        if (!apiKey) {
            console.error('❌ 未找到SiliconFlow API密钥，请在设置中配置');
            return;
        }
        
        console.log(`🔑 API密钥长度: ${apiKey.length}`);
        
        // 执行搜索
        console.log('🚀 开始执行搜索...');
        console.log('📋 请观察控制台输出中的 [最终验证] 日志');
        
        const response = await invoke('search_knowledge_base', {
            query: testQuery,
            collectionId: null,
            limit: 5,
            threshold: 0.3,
            apiKey: apiKey
        });
        
        console.log('📊 搜索结果:', response);
        
        if (response.results && response.results.length > 0) {
            console.log(`✅ 找到 ${response.results.length} 个结果`);
            response.results.forEach((result, index) => {
                console.log(`   [${index + 1}] 相似度: ${result.similarity.toFixed(3)}, 内容: ${result.chunk_text.substring(0, 50)}...`);
            });
        } else {
            console.log('❌ 未找到任何结果');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

// 运行测试
testBGEInstruction();


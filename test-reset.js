// 测试数据库重置功能
const { invoke } = window.__TAURI__.core;

async function testResetDatabase() {
    try {
        console.log('🗑️ 正在重置知识库数据库...');

        // 调用重置知识库数据库命令
        const result = await invoke('reset_knowledge_database');
        console.log('✅', result);

        // 测试创建新集合
        console.log('📚 正在创建测试集合...');
        const collectionResult = await invoke('create_knowledge_collection', {
            name: '测试集合',
            description: '用于测试的集合'
        });
        console.log('✅ 集合创建成功:', collectionResult);

        // 获取集合列表
        console.log('📋 获取集合列表...');
        const collections = await invoke('get_knowledge_collections');
        console.log('📋 当前集合数量:', collections.length);

        return true;
    } catch (error) {
        console.error('❌ 测试失败:', error);
        return false;
    }
}

// 如果运行在Tauri环境中，自动执行测试
if (window.__TAURI__) {
    testResetDatabase().then(success => {
        if (success) {
            console.log('🎉 数据库重置测试完成！');
        }
    });
} else {
    console.log('⚠️ 请在Tauri环境中运行此测试脚本');
}
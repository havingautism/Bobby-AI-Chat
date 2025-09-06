// 测试知识库环境检测
import { knowledgeBaseManager } from './src/utils/knowledgeBase.js';
import { storageAdapter } from './src/utils/storageAdapter.js';

async function testKnowledgeBaseEnvironment() {
  console.log('🧪 测试知识库环境检测...');
  
  try {
    // 1. 检查存储适配器的环境检测
    console.log('1. 存储适配器环境检测:');
    console.log('   - 存储类型:', storageAdapter.getStorageType());
    console.log('   - Tauri IPC存在:', typeof window !== 'undefined' && window.__TAURI_IPC__ !== undefined);
    
    // 2. 检查知识库管理器的环境检测
    console.log('2. 知识库管理器环境检测:');
    console.log('   - isTauriEnvironment():', knowledgeBaseManager.isTauriEnvironment());
    
    // 3. 尝试初始化知识库
    console.log('3. 尝试初始化知识库...');
    await knowledgeBaseManager.initialize();
    console.log('✅ 知识库初始化成功');
    
    // 4. 尝试获取统计信息
    console.log('4. 尝试获取统计信息...');
    const stats = await knowledgeBaseManager.getStatistics();
    console.log('✅ 统计信息获取成功:', stats);
    
    // 5. 尝试获取文档列表
    console.log('5. 尝试获取文档列表...');
    const documents = await knowledgeBaseManager.getStoredDocuments();
    console.log('✅ 文档列表获取成功，数量:', documents.length);
    
    console.log('🎉 所有测试通过！知识库环境检测正常。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testKnowledgeBaseEnvironment();

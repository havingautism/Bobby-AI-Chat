/**
 * 测试Qdrant服务
 */

async function testQdrantService() {
  console.log('🧪 开始测试Qdrant服务...');
  
  try {
    // 导入Qdrant服务
    const { default: qdrantService } = await import('./src/utils/qdrantService.js');
    
    console.log('✅ 成功导入Qdrant服务');
    
    // 初始化Qdrant服务
    console.log('🔧 初始化Qdrant服务...');
    const initSuccess = await qdrantService.initialize();
    
    if (initSuccess) {
      console.log('✅ Qdrant服务初始化成功');
    } else {
      console.error('❌ Qdrant服务初始化失败');
      return;
    }
    
    // 测试添加文档向量
    console.log('📄 测试添加文档向量...');
    const testContent = '这是一个测试文档，用于验证Qdrant向量存储功能。';
    const testMetadata = {
      title: 'Qdrant测试文档',
      sourceType: 'test'
    };
    
    const addSuccess = await qdrantService.addDocumentVectors('test_doc_123', testContent, testMetadata);
    
    if (addSuccess) {
      console.log('✅ 文档向量添加成功');
    } else {
      console.error('❌ 文档向量添加失败');
      return;
    }
    
    // 等待一下让向量处理完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试搜索
    console.log('🔍 测试搜索...');
    const searchResults = await qdrantService.searchDocuments('测试文档', 5, 0.1);
    console.log('搜索结果:', searchResults);
    
    // 检查Qdrant集合状态
    console.log('🔍 检查Qdrant集合状态...');
    const response = await fetch('http://localhost:6333/collections/knowledge_base');
    if (response.ok) {
      const info = await response.json();
      console.log('Qdrant集合信息:', {
        points_count: info.result.points_count,
        indexed_vectors_count: info.result.indexed_vectors_count
      });
    }
    
    console.log('🎉 Qdrant服务测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testQdrantService();


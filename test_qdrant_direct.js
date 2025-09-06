/**
 * 直接测试Qdrant HTTP API
 */

async function testQdrantDirect() {
  console.log('🧪 开始直接测试Qdrant HTTP API...');
  
  try {
    // 1. 检查Qdrant服务状态
    console.log('1️⃣ 检查Qdrant服务状态...');
    const statusResponse = await fetch('http://localhost:6333/collections');
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('✅ Qdrant服务正常:', status);
    } else {
      console.error('❌ Qdrant服务不可用');
      return;
    }

    // 2. 创建集合
    console.log('2️⃣ 创建知识库集合...');
    const createResponse = await fetch('http://localhost:6333/collections/knowledge_base', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      })
    });

    if (createResponse.ok) {
      console.log('✅ 集合创建成功');
    } else {
      const error = await createResponse.text();
      console.log('ℹ️ 集合可能已存在:', error);
    }

    // 3. 添加测试向量
    console.log('3️⃣ 添加测试向量...');
    const testVector = new Array(384).fill(0.1); // 简单的测试向量
    const addResponse = await fetch('http://localhost:6333/collections/knowledge_base/points', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        points: [{
          id: 1,
          vector: testVector,
          payload: {
            title: '测试文档',
            content: '这是一个测试文档的内容',
            documentId: 'test_doc_1'
          }
        }]
      })
    });

    if (addResponse.ok) {
      console.log('✅ 测试向量添加成功');
    } else {
      const error = await addResponse.text();
      console.error('❌ 测试向量添加失败:', error);
      return;
    }

    // 4. 搜索测试
    console.log('4️⃣ 执行搜索测试...');
    const searchResponse = await fetch('http://localhost:6333/collections/knowledge_base/points/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: testVector,
        limit: 5,
        score_threshold: 0.0
      })
    });

    if (searchResponse.ok) {
      const searchResults = await searchResponse.json();
      console.log('✅ 搜索测试成功:', searchResults);
    } else {
      const error = await searchResponse.text();
      console.error('❌ 搜索测试失败:', error);
    }

    // 5. 检查集合信息
    console.log('5️⃣ 检查集合信息...');
    const infoResponse = await fetch('http://localhost:6333/collections/knowledge_base');
    if (infoResponse.ok) {
      const info = await infoResponse.json();
      console.log('✅ 集合信息:', info);
    }

    console.log('🎉 Qdrant直接测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testQdrantDirect();

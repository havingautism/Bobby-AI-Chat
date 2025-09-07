// 监控Qdrant启动状态
const http = require('http');

function checkQdrantStatus() {
  console.log('🔍 检查Qdrant服务状态...');
  
  const options = {
    hostname: '127.0.0.1',
    port: 6333,
    path: '/',
    method: 'GET',
    timeout: 2000
  };
  
  const req = http.request(options, (res) => {
    console.log('✅ Qdrant服务正在运行!');
    console.log('📊 状态码:', res.statusCode);
    console.log('🌐 Web UI: http://localhost:6333');
    
    // 检查集合信息
    checkCollections();
  });
  
  req.on('error', (err) => {
    console.log('❌ Qdrant服务未运行:', err.message);
    console.log('⏳ 等待服务启动...');
    
    // 5秒后重试
    setTimeout(checkQdrantStatus, 5000);
  });
  
  req.on('timeout', () => {
    console.log('⏰ 连接超时，Qdrant可能正在启动中...');
    req.destroy();
    setTimeout(checkQdrantStatus, 5000);
  });
  
  req.end();
}

function checkCollections() {
  console.log('\n📋 检查Qdrant集合...');
  
  const options = {
    hostname: '127.0.0.1',
    port: 6333,
    path: '/collections',
    method: 'GET',
    timeout: 2000
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const collections = JSON.parse(data);
        console.log('📊 集合信息:', JSON.stringify(collections, null, 2));
      } catch (error) {
        console.log('📄 响应数据:', data);
      }
    });
  });
  
  req.on('error', (err) => {
    console.log('❌ 无法获取集合信息:', err.message);
  });
  
  req.end();
}

// 开始监控
console.log('🚀 开始监控Qdrant服务...');
console.log('📍 服务地址: http://127.0.0.1:6333');
console.log('⏰ 检查间隔: 5秒');
console.log('');

checkQdrantStatus();


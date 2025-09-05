// 测试StreamdownRenderer修复
console.log('=== 测试StreamdownRenderer修复 ===');

// 1. 测试StreamdownRenderer导入
console.log('1. 测试StreamdownRenderer导入:');
try {
  import('./src/components/StreamdownRenderer.js').then(module => {
    console.log('✅ StreamdownRenderer导入成功:', !!module.default);
    
    // 测试组件是否可以正常创建
    const StreamdownRenderer = module.default;
    if (typeof StreamdownRenderer === 'function') {
      console.log('✅ StreamdownRenderer是一个有效的React组件');
    } else {
      console.log('❌ StreamdownRenderer不是有效的React组件:', typeof StreamdownRenderer);
    }
    
  }).catch(error => {
    console.error('❌ StreamdownRenderer导入失败:', error);
  });
} catch (error) {
  console.error('❌ StreamdownRenderer导入失败:', error);
}

// 2. 测试MessageList导入（使用StreamdownRenderer的组件）
console.log('2. 测试MessageList导入:');
try {
  import('./src/components/MessageList.js').then(module => {
    console.log('✅ MessageList导入成功:', !!module.default);
  }).catch(error => {
    console.error('❌ MessageList导入失败:', error);
  });
} catch (error) {
  console.error('❌ MessageList导入失败:', error);
}

console.log('=== 测试完成 ===');

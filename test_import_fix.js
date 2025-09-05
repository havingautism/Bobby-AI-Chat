// 测试导入修复
console.log('=== 测试导入修复 ===');

// 1. 测试StreamdownRenderer导入
console.log('1. 测试StreamdownRenderer导入:');
try {
  import('./src/components/StreamdownRenderer.js').then(module => {
    console.log('✅ StreamdownRenderer导入成功:', !!module.default);
  }).catch(error => {
    console.error('❌ StreamdownRenderer导入失败:', error);
  });
} catch (error) {
  console.error('❌ StreamdownRenderer导入失败:', error);
}

// 2. 测试Settings组件导入
console.log('2. 测试Settings组件导入:');
try {
  import('./src/components/Settings.js').then(module => {
    console.log('✅ Settings导入成功:', !!module.default);
  }).catch(error => {
    console.error('❌ Settings导入失败:', error);
  });
} catch (error) {
  console.error('❌ Settings导入失败:', error);
}

// 3. 测试storageAdapter导入
console.log('3. 测试storageAdapter导入:');
try {
  import('./src/utils/storageAdapter.js').then(module => {
    console.log('✅ storageAdapter导入成功:', !!module.storageAdapter);
    console.log('storageAdapter方法:', Object.keys(module.storageAdapter));
  }).catch(error => {
    console.error('❌ storageAdapter导入失败:', error);
  });
} catch (error) {
  console.error('❌ storageAdapter导入失败:', error);
}

console.log('=== 测试完成 ===');

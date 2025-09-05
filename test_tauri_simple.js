// 简单的Tauri环境测试
console.log('=== 简单Tauri环境测试 ===');

// 直接检查window对象
if (typeof window !== 'undefined') {
  console.log('window对象存在');
  console.log('window.__TAURI__:', !!window.__TAURI__);
  console.log('window.__TAURI_INTERNALS__:', !!window.__TAURI_INTERNALS__);
  
  if (window.__TAURI__) {
    console.log('Tauri对象存在，键:', Object.keys(window.__TAURI__));
  }
  
  // 检查localStorage设置
  console.log('use-sqlite-storage设置:', localStorage.getItem('use-sqlite-storage'));
  
  // 手动设置SQLite存储
  localStorage.setItem('use-sqlite-storage', 'true');
  console.log('设置后use-sqlite-storage:', localStorage.getItem('use-sqlite-storage'));
  
} else {
  console.log('window对象不存在');
}

console.log('=== 测试完成 ===');

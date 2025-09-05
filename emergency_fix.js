// 紧急修复脚本 - 停止等待循环
console.log('🚨 紧急修复：停止等待循环');

// 1. 强制设置Tauri IPC为可用（临时解决方案）
if (typeof window.__TAURI_IPC__ !== 'function') {
  console.log('强制设置Tauri IPC为可用');
  window.__TAURI_IPC__ = () => {
    console.log('模拟Tauri IPC调用');
    return Promise.resolve();
  };
}

// 2. 清除localStorage中的SQLite设置，暂时回退到JSON
console.log('暂时回退到JSON存储');
localStorage.setItem('use-sqlite-storage', 'false');

// 3. 重新加载页面
console.log('重新加载页面...');
setTimeout(() => {
  location.reload();
}, 1000);

console.log('✅ 紧急修复完成，页面将在1秒后重新加载');

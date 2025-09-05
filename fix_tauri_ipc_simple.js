// 简单的Tauri IPC修复方案
console.log('=== 简单修复Tauri IPC问题 ===');

// 1. 等待Tauri IPC准备就绪
const waitForTauriIPC = () => {
  return new Promise((resolve) => {
    const checkIPC = () => {
      if (typeof window.__TAURI_IPC__ === 'function') {
        console.log('✅ Tauri IPC已准备就绪');
        resolve(true);
      } else {
        console.log('⏳ 等待Tauri IPC准备...');
        setTimeout(checkIPC, 100);
      }
    };
    checkIPC();
  });
};

// 2. 修复sqliteStorage.js
const fixSQLiteStorage = async () => {
  console.log('开始修复SQLite存储...');
  
  // 等待IPC准备就绪
  await waitForTauriIPC();
  
  // 现在可以安全地使用SQLite
  try {
    const { sqliteStorage } = await import('./src/utils/sqliteStorage.js');
    await sqliteStorage.initialize();
    console.log('✅ SQLite初始化成功');
    return true;
  } catch (error) {
    console.error('❌ SQLite初始化失败:', error);
    return false;
  }
};

// 3. 执行修复
fixSQLiteStorage().then(success => {
  if (success) {
    console.log('🎉 修复完成！现在应该可以正常使用SQLite了');
  } else {
    console.log('😞 修复失败，可能需要重启应用');
  }
});

console.log('=== 修复脚本运行中 ===');

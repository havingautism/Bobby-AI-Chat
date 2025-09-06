// 测试数据库路径配置
import { invoke } from '@tauri-apps/api/core';

async function testDbPath() {
  try {
    console.log('🔍 测试数据库路径配置...');
    
    // 测试获取数据目录
    const dataDir = await invoke('ensure_data_directory');
    console.log('✅ 数据目录:', dataDir);
    
    // 测试前端数据库路径
    const { Database } = await import('@tauri-apps/plugin-sql');
    
    // 模拟前端获取数据库路径的逻辑
    let dbPath;
    if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
      const { appDataDir } = await import('@tauri-apps/api/path');
      const dataDir = await appDataDir();
      dbPath = `${dataDir}ai_chat.db`;
      console.log('✅ 前端数据库路径:', dbPath);
    } else {
      dbPath = 'ai_chat.db';
      console.log('✅ 前端数据库路径 (非Tauri):', dbPath);
    }
    
    console.log('🎉 数据库路径配置测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testDbPath();

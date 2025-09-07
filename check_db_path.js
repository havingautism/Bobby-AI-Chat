// 检查当前数据库路径
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';

async function checkDbPath() {
  try {
    console.log('🔍 检查数据库路径...');
    
    // 1. 检查后端数据目录
    const dataDir = await invoke('ensure_data_directory');
    console.log('📁 后端数据目录:', dataDir);
    
    // 2. 检查前端数据目录
    const frontendDataDir = await appDataDir();
    console.log('📁 前端数据目录:', frontendDataDir);
    
    // 3. 显示完整数据库路径
    const dbPath = `${dataDir}/ai_chat.db`;
    console.log('🗄️ 数据库文件路径:', dbPath);
    
    // 4. 检查文件是否存在
    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      const fileExists = await exists(dbPath);
      console.log('✅ 数据库文件存在:', fileExists);
      
      if (fileExists) {
        const { metadata } = await import('@tauri-apps/plugin-fs');
        const fileInfo = await metadata(dbPath);
        console.log('📊 文件大小:', fileInfo.size, 'bytes');
        console.log('📅 创建时间:', new Date(fileInfo.createdAt).toLocaleString());
        console.log('📅 修改时间:', new Date(fileInfo.modifiedAt).toLocaleString());
      }
    } catch (error) {
      console.log('⚠️ 无法检查文件信息:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

// 运行检查
checkDbPath();


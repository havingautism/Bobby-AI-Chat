import React, { useState, useEffect } from 'react';
import { storageAdapter } from '../utils/storageAdapter';
// import { runStorageTests } from '../utils/storageTest'; // 不再自动运行测试

const TauriInitializer = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageType, setStorageType] = useState('indexeddb');

  useEffect(() => {
    const initializeTauri = async () => {
      try {
        // 强制检测Tauri环境 - 检查多种标识
        const isTauri = typeof window !== 'undefined' && (
          window.__TAURI__ || 
          window.__TAURI_INTERNALS__ || 
          window.__TAURI_METADATA__ ||
          window.navigator?.userAgent?.includes('Tauri') ||
          Object.keys(window).some(key => key.includes('TAURI'))
        );
        
        if (isTauri) {
          console.log('检测到Tauri环境，强制使用SQLite存储');
          // 强制设置SQLite存储
          localStorage.setItem('use-sqlite-storage', 'true');
        }
        
        // 检测存储类型
        const type = storageAdapter.getStorageType();
        setStorageType(type);
        console.log('当前存储类型:', type);
        
        // 如果是在Tauri环境中，可以尝试从IndexedDB迁移数据
        if (type === 'tauri' || type === 'sqlite') {
          console.log('使用本地存储:', type);
          
          // 注释掉自动存储测试，避免每次启动都运行测试
          // const testResult = await runStorageTests();
          // if (!testResult.success) {
          //   console.error('存储系统测试失败:', testResult.error);
          // }
          
          // 尝试从localStorage获取旧的对话数据并迁移
          const oldData = localStorage.getItem('ai-chat-conversations');
          if (oldData) {
            try {
              const oldConversations = JSON.parse(oldData);
              if (oldConversations.length > 0) {
                const migrated = await storageAdapter.migrateFromIndexedDB(oldConversations);
                if (migrated) {
                  console.log('成功迁移旧数据到Tauri文件系统');
                  localStorage.removeItem('ai-chat-conversations');
                }
              }
            } catch (error) {
              console.error('数据迁移失败:', error);
            }
          }
        } else {
          console.log('使用IndexedDB存储');
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('初始化失败:', error);
        setIsInitialized(true); // 即使失败也继续运行
      }
    };

    initializeTauri();
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-base-200">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-lg">初始化应用...</p>
          <p className="text-sm text-base-content/70">正在配置存储系统</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {/* 显示存储类型指示器 */}
      {/* {storageType === 'tauri' && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="badge badge-success gap-2 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-4 h-4 stroke-current">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            桌面版 - 本地存储
          </div>
        </div>
      )} */}
    </>
  );
};

export default TauriInitializer;
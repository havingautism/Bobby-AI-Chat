// 存储诊断工具 - 用于识别当前使用的存储系统
import { storageAdapter } from './storageAdapter';
import { isTauriEnvironment } from './tauriDetector';

export class StorageDiagnostic {
  static async runDiagnostics() {
    console.log('🔍 开始存储系统诊断...');
    
    const results = {
      environment: {},
      localStorage: {},
      storageType: null,
      testData: null,
      storageInfo: null,
      recommendations: []
    };

    // 1. 检测环境
    results.environment = {
      isTauri: isTauriEnvironment(),
      hasTauriIPC: typeof window !== 'undefined' && !!window.__TAURI_IPC__,
      hasTauri: typeof window !== 'undefined' && !!window.__TAURI__,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A'
    };

    // 2. 检查localStorage设置
    if (typeof window !== 'undefined') {
      results.localStorage = {
        useSqliteStorage: localStorage.getItem('use-sqlite-storage'),
        allKeys: Object.keys(localStorage)
      };
    }

    // 3. 检测当前存储类型
    try {
      results.storageType = storageAdapter.getStorageType();
      console.log('📁 当前存储类型:', results.storageType);
    } catch (error) {
      console.error('❌ 检测存储类型失败:', error);
      results.storageType = 'unknown';
      results.recommendations.push('存储类型检测失败，可能存在配置问题');
    }

    // 4. 测试数据读写
    try {
      const testKey = 'diagnostic_test_' + Date.now();
      const testValue = { timestamp: Date.now(), message: '诊断测试数据' };
      
      // 测试写入
      await storageAdapter.saveSetting(testKey, testValue);
      
      // 测试读取
      const retrievedValue = await storageAdapter.loadSetting(testKey);
      
      results.testData = {
        writeSuccess: JSON.stringify(retrievedValue) === JSON.stringify(testValue),
        testKey,
        originalValue: testValue,
        retrievedValue
      };
      
      // 清理测试数据
      // 注意：这里不删除测试数据，以便后续检查
      
      console.log('✅ 数据读写测试成功');
    } catch (error) {
      console.error('❌ 数据读写测试失败:', error);
      results.testData = { error: error.message };
      results.recommendations.push('数据读写测试失败，存储系统可能存在问题');
    }

    // 5. 获取存储信息
    try {
      results.storageInfo = await storageAdapter.getStorageInfo();
      console.log('📊 存储信息:', results.storageInfo);
    } catch (error) {
      console.error('❌ 获取存储信息失败:', error);
      results.storageInfo = { error: error.message };
    }

    // 6. 生成建议
    this.generateRecommendations(results);

    return results;
  }

  static generateRecommendations(results) {
    const { environment, localStorage, storageType, testData, storageInfo } = results;

    // 检查Tauri环境检测
    if (!environment.isTauri && environment.hasTauriIPC) {
      results.recommendations.push('检测到Tauri IPC但环境检测失败，可能需要更新tauriDetector');
    }

    // 检查localStorage设置
    if (environment.isTauri && localStorage.useSqliteStorage === null) {
      results.recommendations.push('Tauri环境下未设置存储偏好，建议明确设置use-sqlite-storage');
    }

    // 检查存储类型一致性
    if (environment.isTauri && storageType === 'indexeddb') {
      results.recommendations.push('Tauri环境但使用IndexedDB，可能不是预期的配置');
    }

    // 检查数据持久性
    if (testData && !testData.writeSuccess) {
      results.recommendations.push('数据读写测试失败，会话历史可能无法正确保存');
    }

    // 检查存储信息
    if (storageInfo && storageInfo.error) {
      results.recommendations.push(`存储信息获取失败: ${storageInfo.error}`);
    }

    // 检查会话历史数量
    if (storageInfo && storageInfo.conversationCount === 0) {
      results.recommendations.push('未找到会话历史，可能数据已丢失或存储位置不正确');
    }
  }

  static async checkIndexedDB() {
    if (typeof window === 'undefined') return null;
    
    try {
      return new Promise((resolve) => {
        const request = indexedDB.open('ai_chat_db', 1);
        
        request.onerror = () => resolve({ error: '无法打开IndexedDB' });
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const stores = Array.from(db.objectStoreNames);
          
          if (stores.includes('conversations')) {
            const tx = db.transaction('conversations', 'readonly');
            const store = tx.objectStore('conversations');
            const getAll = store.getAll();
            
            getAll.onsuccess = () => {
              resolve({
                hasIndexedDB: true,
                stores,
                conversationCount: getAll.result.length,
                conversations: getAll.result.slice(0, 3) // 只返回前3个作为样本
              });
            };
            
            getAll.onerror = () => resolve({
              hasIndexedDB: true,
              stores,
              conversationCount: 0,
              error: '无法读取会话数据'
            });
          } else {
            resolve({
              hasIndexedDB: true,
              stores,
              conversationCount: 0
            });
          }
        };
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  static async locateDatabaseFile() {
    if (!isTauriEnvironment()) {
      return { location: 'browser', message: '非Tauri环境，数据存储在浏览器中' };
    }

    try {
      // 尝试获取用户数据目录
      const { appDataDir } = await import('@tauri-apps/api/path');
      const dataDir = await appDataDir();
      
      return {
        possibleLocations: [
          `${dataDir}ai_chat.db`,
          `${dataDir}/ai_chat.db`,
          `./data/ai_chat.db`,
          `sqlite:${dataDir}ai_chat.db`
        ],
        message: 'Tauri环境，数据库文件可能在用户数据目录'
      };
    } catch (error) {
      return {
        possibleLocations: [
          './data/ai_chat.db',
          'sqlite:ai_chat.db'
        ],
        message: '无法获取用户数据目录，使用相对路径'
      };
    }
  }

  static async generateReport() {
    console.log('🔍 生成存储诊断报告...');
    
    const diagnostics = await this.runDiagnostics();
    const indexedDB = await this.checkIndexedDB();
    const dbLocation = await this.locateDatabaseFile();
    
    const report = {
      timestamp: new Date().toISOString(),
      diagnostics,
      indexedDB,
      dbLocation,
      summary: {
        primaryStorage: diagnostics.storageType,
        hasData: (diagnostics.storageInfo?.conversationCount || 0) > 0 || (indexedDB?.conversationCount || 0) > 0,
        issues: diagnostics.recommendations.length,
        recommendations: diagnostics.recommendations
      }
    };

    console.log('📋 诊断报告:', report);
    return report;
  }
}

// 导出便捷函数
export const runStorageDiagnostics = () => StorageDiagnostic.runDiagnostics();
export const generateStorageReport = () => StorageDiagnostic.generateReport();

// 在浏览器控制台中快速诊断
if (typeof window !== 'undefined') {
  window.storageDiagnostic = StorageDiagnostic;
  console.log('💡 存储诊断工具已加载到 window.storageDiagnostic');
  console.log('💡 使用方法:');
  console.log('  - window.storageDiagnostic.runDiagnostics()');
  console.log('  - window.storageDiagnostic.generateReport()');
  console.log('  - window.storageDiagnostic.checkIndexedDB()');
  console.log('  - window.storageDiagnostic.locateDatabaseFile()');
}

export default StorageDiagnostic;
// 缓存管理工具 - 保护IndexedDB数据
class CacheManager {
  constructor() {
    this.cacheVersion = 'v1.0.1';
  }

  // 清理浏览器缓存，但保护IndexedDB
  async clearBrowserCache() {
    try {
      // 清理Service Worker缓存
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.includes('static-') || cacheName.includes('dynamic-')) {
              console.log('Clearing cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }

      // 清理localStorage（可选）
      // localStorage.clear();

      // 清理sessionStorage
      sessionStorage.clear();

      console.log('Browser cache cleared successfully');
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }

  // 强制更新Service Worker
  async updateServiceWorker() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // 发送更新消息
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          
          // 重新加载页面
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Failed to update service worker:', error);
    }
  }

  // 检查缓存状态
  async getCacheStatus() {
    try {
      const cacheNames = await caches.keys();
      const cacheInfo = await Promise.all(
        cacheNames.map(async (cacheName) => {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          return {
            name: cacheName,
            size: keys.length,
            keys: keys.map(req => req.url)
          };
        })
      );
      return cacheInfo;
    } catch (error) {
      console.error('Failed to get cache status:', error);
      return [];
    }
  }

  // 智能缓存清理 - 只清理过期的缓存
  async smartCacheCleanup() {
    try {
      const cacheNames = await caches.keys();
      const currentVersion = this.cacheVersion;
      
      await Promise.all(
        cacheNames.map(cacheName => {
          // 删除不包含当前版本的缓存
          if (!cacheName.includes(currentVersion)) {
            console.log('Deleting outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      
      console.log('Smart cache cleanup completed');
    } catch (error) {
      console.error('Failed to perform smart cache cleanup:', error);
    }
  }

  // 获取IndexedDB使用情况（不删除数据）
  async getIndexedDBInfo() {
    try {
      if ('indexedDB' in window) {
        // 这里可以添加获取IndexedDB信息的逻辑
        // 但不删除任何数据
        return {
          available: true,
          message: 'IndexedDB数据已保护'
        };
      }
      return { available: false };
    } catch (error) {
      console.error('Failed to get IndexedDB info:', error);
      return { available: false, error: error.message };
    }
  }
}

// 创建全局实例
const cacheManager = new CacheManager();

// 导出工具函数
export const clearBrowserCache = () => cacheManager.clearBrowserCache();
export const updateServiceWorker = () => cacheManager.updateServiceWorker();
export const getCacheStatus = () => cacheManager.getCacheStatus();
export const smartCacheCleanup = () => cacheManager.smartCacheCleanup();
export const getIndexedDBInfo = () => cacheManager.getIndexedDBInfo();

export default cacheManager;
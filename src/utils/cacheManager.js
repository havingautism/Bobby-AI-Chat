/**
 * PWA缓存管理工具
 * 用于处理Service Worker缓存更新，保护IndexedDB数据
 */

class CacheManager {
  constructor() {
    this.registration = null;
    this.isUpdateAvailable = false;
  }

  /**
   * 初始化Service Worker监听
   */
  async init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Service Worker已更新，可以提示用户刷新
        this.showUpdateNotification();
      });

      // 检查是否有新版本
      this.checkForUpdates();
    }
  }

  /**
   * 检查是否有新版本
   */
  async checkForUpdates() {
    try {
      if (navigator.serviceWorker.controller) {
        const version = await this.getServiceWorkerVersion();
        console.log('Current Service Worker version:', version);
        
        // 这里可以比较版本号，如果有新版本就提示用户
        this.listenForWaitingServiceWorker();
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  /**
   * 获取当前Service Worker版本
   */
  async getServiceWorkerVersion() {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject('No active service worker');
        return;
      }

      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version);
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_VERSION' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * 监听等待中的Service Worker
   */
  listenForWaitingServiceWorker() {
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration.waiting) {
        this.registration = registration;
        this.isUpdateAvailable = true;
        this.showUpdateNotification();
      }

      // 监听新Service Worker安装
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.registration = registration;
            this.isUpdateAvailable = true;
            this.showUpdateNotification();
          }
        });
      });
    });
  }

  /**
   * 显示更新提示
   */
  showUpdateNotification() {
    // 创建更新提示DOM元素
    const notification = document.createElement('div');
    notification.id = 'pwa-update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007bff;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
      <span>有新版本可用，立即更新？</span>
      <button onclick="cacheManager.updateNow()" style="
        background: white;
        color: #007bff;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">立即更新</button>
      <button onclick="cacheManager.dismissNotification()" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">稍后</button>
    `;

    document.body.appendChild(notification);
  }

  /**
   * 立即更新
   */
  async updateNow() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    this.dismissNotification();
  }

  /**
   * 关闭通知
   */
  dismissNotification() {
    const notification = document.getElementById('pwa-update-notification');
    if (notification) {
      notification.remove();
    }
  }

  /**
   * 强制清理所有缓存（用于调试）
   */
  async clearAllCaches() {
    try {
      if (navigator.serviceWorker.controller) {
        return new Promise((resolve, reject) => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            if (event.data.success) {
              resolve(true);
            } else {
              reject('Failed to clear caches');
            }
          };

          navigator.serviceWorker.controller.postMessage(
            { type: 'CLEAR_ALL_CACHES' },
            [messageChannel.port2]
          );
        });
      } else {
        // 如果没有Service Worker，直接清理缓存
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        return true;
      }
    } catch (error) {
      console.error('Error clearing caches:', error);
      throw error;
    }
  }

  /**
   * 清理缓存并重新加载页面
   */
  async hardRefresh() {
    try {
      await this.clearAllCaches();
      window.location.reload(true);
    } catch (error) {
      console.error('Error during hard refresh:', error);
    }
  }
}

// 创建全局实例
const cacheManager = new CacheManager();

// 自动初始化
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    cacheManager.init();
  });
}

export default cacheManager;
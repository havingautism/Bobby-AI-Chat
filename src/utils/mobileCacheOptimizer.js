// 移动端缓存优化器
class MobileCacheOptimizer {
  constructor() {
    this.isMobile = window.innerWidth <= 768;
    this.init();
  }

  init() {
    if (this.isMobile) {
      this.optimizeForMobile();
    }
  }

  // 移动端优化
  optimizeForMobile() {
    // 1. 减少动画复杂度
    this.reduceAnimations();
    
    // 2. 优化图片加载
    this.optimizeImageLoading();
    
    // 3. 延迟非关键资源加载
    this.deferNonCriticalResources();
    
    // 4. 优化缓存策略
    this.optimizeCacheStrategy();
  }

  // 减少动画复杂度
  reduceAnimations() {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        * {
          animation-duration: 0.2s !important;
          transition-duration: 0.2s !important;
        }
        
        .sidebar {
          transition: left 0.2s ease !important;
        }
        
        .chat-interface {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 优化图片加载
  optimizeImageLoading() {
    // 使用Intersection Observer延迟加载图片
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      // 观察所有延迟加载的图片
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  // 延迟非关键资源加载
  deferNonCriticalResources() {
    // 延迟加载非关键CSS
    const nonCriticalCSS = [
      // 可以在这里添加非关键的CSS文件
    ];

    nonCriticalCSS.forEach(cssFile => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = cssFile;
      link.onload = function() {
        this.rel = 'stylesheet';
      };
      document.head.appendChild(link);
    });
  }

  // 优化缓存策略
  optimizeCacheStrategy() {
    // 为移动端设置更激进的缓存策略
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_STRATEGY') {
          // 移动端使用更简单的缓存策略
          event.ports[0].postMessage({
            strategy: 'cache-first',
            maxAge: 86400 // 24小时
          });
        }
      });
    }
  }

  // 清理移动端特定缓存
  async clearMobileCache() {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.includes('mobile-') || cacheName.includes('static-')) {
              return caches.delete(cacheName);
            }
          })
        );
      }
    } catch (error) {
      console.error('Failed to clear mobile cache:', error);
    }
  }

  // 检测网络状态并调整策略
  handleNetworkChange() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      // 根据网络速度调整缓存策略
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        // 慢网络：更激进的缓存
        this.enableAggressiveCaching();
      } else {
        // 快网络：标准缓存
        this.enableStandardCaching();
      }
    }
  }

  enableAggressiveCaching() {
    // 启用更激进的缓存策略
    console.log('启用激进缓存策略（慢网络）');
  }

  enableStandardCaching() {
    // 启用标准缓存策略
    console.log('启用标准缓存策略（快网络）');
  }
}

// 创建全局实例
const mobileCacheOptimizer = new MobileCacheOptimizer();

// 监听网络变化
if ('connection' in navigator) {
  navigator.connection.addEventListener('change', () => {
    mobileCacheOptimizer.handleNetworkChange();
  });
}

export default mobileCacheOptimizer;

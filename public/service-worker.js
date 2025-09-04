const CACHE_VERSION = 'v3';
const CACHE_NAME = `bobby-ai-chat-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `bobby-ai-chat-dynamic-${CACHE_VERSION}`;

// 静态资源缓存列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/favicon.ico',
  '/favicon.svg',
  '/manifest.json'
];

// 需要跳过缓存的API和数据路径
const SKIP_CACHE_PATTERNS = [
  /\/api\//,
  /\/data\//,
  /\.json$/,
  /idb/,
  /indexeddb/
];

// 安装Service Worker - 预缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets:', STATIC_ASSETS);
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活Service Worker - 清理旧版本缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 只清理应用缓存，保留IndexedDB数据
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截网络请求 - 智能缓存策略
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 跳过API和数据请求
  if (SKIP_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return fetch(request);
  }
  
  // 跳过非GET请求
  if (request.method !== 'GET') {
    return fetch(request);
  }
  
  // 静态资源使用缓存优先策略
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          return response;
        }
        return fetchAndCache(request, CACHE_NAME);
      })
    );
    return;
  }
  
  // JS/CSS文件使用网络优先策略（确保获取最新版本）
  if (/\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      fetchAndCache(request, DYNAMIC_CACHE_NAME).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }
  
  // 其他资源使用缓存优先策略
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        return response;
      }
      return fetchAndCache(request, DYNAMIC_CACHE_NAME);
    })
  );
});

// 辅助函数：获取并缓存响应
function fetchAndCache(request, cacheName) {
  return fetch(request).then(response => {
    if (!response || response.status !== 200 || response.type !== 'basic') {
      return response;
    }
    
    const responseToCache = response.clone();
    caches.open(cacheName).then(cache => {
      cache.put(request, responseToCache);
    });
    
    return response;
  });
}

// 处理后台同步
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 这里可以添加后台同步逻辑
      Promise.resolve()
    );
  }
});

// 处理推送通知
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 处理消息 - 用于客户端通知缓存更新
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

// 处理通知点击
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 强制清理所有缓存（用于调试）
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('Clearing cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});
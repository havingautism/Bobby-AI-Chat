// 移动端优化的Service Worker
console.log('Service Worker registered');

// 缓存版本控制
const CACHE_VERSION = 'v2.0-mobile-optimized';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// 需要缓存的静态资源（精简列表）
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.png'
];

// 不需要缓存的资源
const NO_CACHE_PATTERNS = [
  /\/api\//,
  /\/socket\.io\//,
  /\.hot-update\./,
  /service-worker\.js$/,
  /\/_next\//,
  /\.map$/
];

// 移动端检测
const isMobileRequest = (request) => {
  return request.headers.get('User-Agent')?.includes('Mobile') || 
         request.headers.get('Sec-CH-UA-Mobile') === '?1';
};

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker installed');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // 删除旧版本的缓存
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过不需要缓存的请求
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return;
  }

  // 跳过非GET请求
  if (request.method !== 'GET') {
    return;
  }

  // 移动端优化策略
  const isMobile = isMobileRequest(request);
  
  // 移动端使用更激进的缓存策略
  if (isMobile) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // 移动端减少后台更新，避免性能问题
            if (request.destination === 'document') {
              // 降低后台更新频率
              if (Math.random() < 0.1) { // 10%概率更新
                fetchAndUpdateCache(request);
              }
            }
            return response;
          }

          // 缓存未命中，从网络获取
          return fetch(request)
            .then(fetchResponse => {
              if (fetchResponse.ok) {
                const responseClone = fetchResponse.clone();
                caches.open(DYNAMIC_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return fetchResponse;
            })
            .catch(() => {
              if (request.destination === 'document') {
                return caches.match('/');
              }
            });
        })
    );
  } else {
    // 桌面端使用标准策略
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // 桌面端可以更积极地更新缓存
            if (request.destination === 'document' || request.destination === 'style') {
              fetchAndUpdateCache(request);
            }
            return response;
          }

          return fetch(request)
            .then(fetchResponse => {
              if (fetchResponse.ok) {
                const responseClone = fetchResponse.clone();
                caches.open(DYNAMIC_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return fetchResponse;
            })
            .catch(() => {
              if (request.destination === 'document') {
                return caches.match('/');
              }
            });
        })
    );
  }
});

// 后台更新缓存函数
function fetchAndUpdateCache(request) {
  fetch(request)
    .then(fetchResponse => {
      if (fetchResponse.ok) {
        caches.open(DYNAMIC_CACHE)
          .then(cache => cache.put(request, fetchResponse.clone()));
      }
    })
    .catch(() => {
      // 静默失败
    });
}

// 定期清理过期缓存
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

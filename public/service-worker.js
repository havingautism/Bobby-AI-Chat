// 优化的Service Worker - 解决移动端卡顿问题
console.log('Service Worker registered');

// 缓存版本控制
const CACHE_VERSION = 'v1.0.1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.png'
];

// 不需要缓存的资源（避免冲突）
const NO_CACHE_PATTERNS = [
  /\/api\//,
  /\/socket\.io\//,
  /\.hot-update\./,
  /service-worker\.js$/
];

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

  // 策略：缓存优先，但允许更新
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          // 对于HTML和CSS文件，总是尝试网络更新
          if (request.destination === 'document' || request.destination === 'style') {
            // 后台更新缓存
            fetch(request)
              .then(fetchResponse => {
                if (fetchResponse.ok) {
                  caches.open(DYNAMIC_CACHE)
                    .then(cache => cache.put(request, fetchResponse.clone()));
                }
              })
              .catch(() => {
                // 网络失败，使用缓存
              });
          }
          return response;
        }

        // 缓存未命中，从网络获取
        return fetch(request)
          .then(fetchResponse => {
            // 只缓存成功的响应
            if (fetchResponse.ok) {
              const responseClone = fetchResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(request, responseClone));
            }
            return fetchResponse;
          })
          .catch(() => {
            // 网络失败，返回离线页面（如果有）
            if (request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// 定期清理过期缓存
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

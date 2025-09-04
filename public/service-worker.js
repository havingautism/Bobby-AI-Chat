// 最小化Service Worker - 仅用于PWA安装
console.log('Service Worker registered');

self.addEventListener('install', event => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// 让浏览器正常处理所有请求
self.addEventListener('fetch', event => {
  // 不拦截任何请求，避免空白页问题
});
// X-Note Service Worker
// ・アプリ本体（同じ場所のファイル）: 保存済みをすぐ返し、裏で最新を取得。変わっていたら画面に知らせる
// ・ライブラリ（jsDelivr / Firebase SDK）: バージョン固定なので保存済みを使い続ける
// ・それ以外（Firebaseのデータ通信・ログイン・外部画像など）: 何もしない
const CACHE = 'xnote-v1';
const CDN_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isLibrary(url) {
  return CDN_HOSTS.includes(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const key = req.mode === 'navigate' ? new Request(new URL('./index.html', self.registration.scope)) : req;
  const hit = await cache.match(key);
  const refresh = (async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) {
        if (hit && req.mode === 'navigate') {
          const a = hit.headers.get('etag') || hit.headers.get('last-modified');
          const b = res.headers.get('etag') || res.headers.get('last-modified');
          if (a && b && a !== b) {
            const client = event.resultingClientId ? await self.clients.get(event.resultingClientId) : null;
            const targets = client ? [client] : await self.clients.matchAll({ type: 'window' });
            setTimeout(() => targets.forEach(c => c.postMessage({ type: 'xnote-update' })), 1500);
          }
        }
        await cache.put(key, res.clone());
      }
      return res;
    } catch (e) {
      return null;
    }
  })();
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  const res = await refresh;
  return res || new Response('オフラインです。通信できる場所でもう一度開いてください。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    event.respondWith(staleWhileRevalidate(req, event));
  } else if (isLibrary(url)) {
    event.respondWith(cacheFirst(req));
  }
});

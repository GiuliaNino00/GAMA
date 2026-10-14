/*
 * PRESENZE GAMA — Service worker
 * Riceve le notifiche anche ad app chiusa e tiene in memoria stile e codice
 * per aprire l'app piu' in fretta. Il numero di versione lo mette il server.
 */
const VERSIONE = '__VERSIONE__';
const CACHE = 'gama-' + VERSIONE;
const STATICI = [
  '/statici/app.css?v=' + VERSIONE,
  '/statici/app.js?v=' + VERSIONE,
  '/statici/icone/icona-192.png'
];

const PAGINA_SENZA_CAMPO = '<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Senza campo</title></head>' +
  '<body style="margin:0;padding:48px 24px;font:16px/1.5 -apple-system,Roboto,sans-serif;background:#eef1f4;color:#131820;text-align:center">' +
  '<div style="font-size:48px">📵</div><h1 style="font-size:20px">Niente campo</h1>' +
  '<p style="color:#57616d">Per aprirsi l’app ha bisogno di internet.<br>Se avevi già confermato una giornata senza campo, ' +
  'è salvata sul telefono e partirà da sola.</p>' +
  '<button onclick="location.reload()" style="margin-top:16px;background:#1c3f5e;color:#fff;border:0;border-radius:12px;padding:14px 26px;font-size:16px;font-weight:700">Riprova</button>' +
  '</body></html>';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATICI)).catch(() => null).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((chiavi) => Promise.all(chiavi.filter((k) => k.startsWith('gama-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/statici/')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(PAGINA_SENZA_CAMPO, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { testo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titolo || 'Presenze GAMA', {
    body: d.testo || '',
    icon: '/statici/icone/icona-192.png',
    badge: '/statici/icone/badge-96.png',
    tag: d.tag || 'gama',
    renotify: true,
    lang: 'it',
    data: { url: d.url || self.registration.scope }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  const percorso = new URL(url).hash;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
    for (const f of finestre) {
      if (f.url.startsWith(self.registration.scope)) {
        f.postMessage({ apri: percorso });
        return f.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

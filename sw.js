const CACHE='abr-v6611-20261124';
const FILES=['./','./index.html','./app.js','./cloud.js','./config.js','./abr-v5.js','./abr-v5.css','./abr-dia.js','./abr-dia.css','./abr-caixa.css','./abr-vendas.css','./abr-vendas.js','./abr-troco-pendente.js','./abr-evolucao.css','./abr-evolucao.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('abr-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith((async()=>{try{const response=await fetch(e.request);if(response.ok){const cache=await caches.open(CACHE);cache.put(e.request,response.clone())}return response}catch{const cache=await caches.open(CACHE);return (await cache.match(e.request,{ignoreSearch:true}))||(e.request.mode==='navigate'?await cache.match('./index.html'):Response.error())}})());
});

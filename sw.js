'use strict';
const RELEASE='20261012-report-1';
const BASE=new URL(self.registration.scope),PREFIX='margen-shell:'+BASE.pathname+':',CACHE=PREFIX+RELEASE;
const FILES=['index.html','app.html','offline.html','aviso-legal.html','privacidad.html','cookies.html','landing.css','styles.css','legal.css','landing.js','app.js','margin-core.js','margin-panel.js','product-matching.js','matching-panel.js','report-core.js','metrics.js','pdf-text-parser.js','electricity.js','official-prices.js','switch-demo.js','offline.js','manifest.webmanifest','icons/margen-192.png','icons/margen-512.png','icons/margen.svg','vendor/xlsx.full.min.js','vendor/pdf.min.js','vendor/pdf.worker.min.js'];
const PATHS=new Set(FILES.map(path=>new URL(path,BASE).pathname));
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES.map(path=>new Request(new URL(path,BASE),{cache:'reload'})));})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const ready=(await Promise.all(FILES.map(path=>cache.match(new URL(path,BASE))))).every(Boolean);event.ports[0]?.postMessage({ready,release:RELEASE});})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Never store forms, private endpoints, provider calls or external requests.
 if(request.method!=='GET'||url.origin!==BASE.origin)return;
 if(url.pathname===BASE.pathname)url.pathname=new URL('index.html',BASE).pathname;
 if(!PATHS.has(url.pathname))return;
 url.search='';url.hash='';
 event.respondWith((async()=>{const cached=await (await caches.open(CACHE)).match(url.href);if(cached)return cached;try{return await fetch(request);}catch{if(request.mode==='navigate')return (await (await caches.open(CACHE)).match(new URL('offline.html',BASE)))||Response.error();return Response.error();}})());
});

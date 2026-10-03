const CACHE='ayk-english-classroom-v7';
const CORE=['./','./index.html','./assets/css/styles.css?v=classroom-v7','./assets/js/app.js?v=classroom-v7','./assets/js/curriculum.js','./assets/js/store.js?v=classroom-v7','./assets/js/ai.js','./assets/js/firebase.js','./assets/js/firebase-config.js','./assets/js/starter-data.js','./assets/images/learning-girl.webp','./assets/icons/icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});

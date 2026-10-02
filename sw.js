const CACHE='ayk-english-v1';
const CORE=['./','./index.html','./assets/css/styles.css','./assets/js/app.js','./assets/js/store.js','./assets/js/ai.js','./assets/js/firebase.js','./assets/js/firebase-config.js','./assets/js/starter-data.js','./assets/icons/icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});

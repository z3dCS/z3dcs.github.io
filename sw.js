const CACHE="z3d-cs-enhancer-pwa-v01";
const FILES=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./assets/logo.png","./assets/icon-192.png","./assets/icon-512.png","./assets/apple-touch-icon.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.hostname==="open.faceit.com") return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
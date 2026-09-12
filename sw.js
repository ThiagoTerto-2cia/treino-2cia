const CACHE='t2cia-v67.22';
const RUNTIME='t2cia-runtime-v67.22';
const SHELL=[
  './',
  'index.html',
  'styles-v67-22.css',
  'app-v67-22.js',
  'data.js',
  'cloud-config.js',
  'manifest.json'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(SHELL.map(async url=>{
      try{await cache.add(url)}catch(e){console.warn('Falha ao pré-cachear',url,e)}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE&&k!==RUNTIME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

function isAppShell(url){
  return url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/app-v67-22.js') ||
    url.pathname.endsWith('/styles-v67-22.css') ||
    url.pathname.endsWith('/data.js') ||
    url.pathname.endsWith('/cloud-config.js') ||
    url.pathname.endsWith('/manifest.json');
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(isAppShell(url)){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        if(fresh&&fresh.ok){
          const cache=await caches.open(CACHE);
          cache.put(req,fresh.clone()).catch(()=>{});
        }
        return fresh;
      }catch(e){
        return (await caches.match(req)) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    try{
      const fresh=await fetch(req);
      if(fresh&&fresh.ok){
        const cache=await caches.open(RUNTIME);
        cache.put(req,fresh.clone()).catch(()=>{});
      }
      return fresh;
    }catch(e){
      return Response.error();
    }
  })());
});

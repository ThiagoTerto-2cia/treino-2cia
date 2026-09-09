const CACHE='t2cia-v20.0';
const SHELL=['./','index.html','styles.css','data.js','app.js','app-v16.js','app-v17.js','app-v18.js','app-v19.js','app-v20.js','manifest.json','icon-192.png','icon-512.png','qrcodes.html','assets/exercises/1-inicio.webp','assets/exercises/1-fim.webp','assets/exercises/supino-inclinado-inicio.webp','assets/exercises/supino-inclinado-fim.webp','assets/exercises/crucifixo-halteres-inicio.webp','assets/exercises/crucifixo-halteres-fim.webp','assets/exercises/crossover-medio-inicio.webp','assets/exercises/crossover-medio-fim.webp','assets/exercises/triceps-corda-inicio.webp','assets/exercises/triceps-corda-fim.webp','assets/exercises/triceps-testa-inicio.webp','assets/exercises/triceps-testa-fim.webp','assets/exercises/triceps-frances-inicio.webp','assets/exercises/triceps-frances-fim.webp'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;

  const url=new URL(req.url);
  const isAppFile =
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/app-v16.js') ||
    url.pathname.endsWith('/app-v17.js') ||
    url.pathname.endsWith('/app-v18.js') ||
    url.pathname.endsWith('/app-v19.js') ||
    url.pathname.endsWith('/app-v20.js') ||
    url.pathname.endsWith('/data.js') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/styles.css') ||
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.endsWith('/');

  if(isAppFile){
    event.respondWith(
      fetch(req)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy));
          return res;
        })
        .catch(()=>caches.match(req).then(r=>r||caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>{
      if(cached) return cached;
      return fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy));
        return res;
      });
    })
  );
});

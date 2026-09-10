const CACHE='t2cia-v58.0';
const SHELL=['./','index.html','styles-v58.css','data.js','app.js','app-v16.js','app-v17.js','app-v18.js','app-v19.js','app-v20.js','app-v21.js','app-v22.js','app-v23.js','app-v24.js','app-v25.js','app-v26.js','app-v27.js','app-v28.js','app-v29.js','app-v30.js','app-v31.js','app-v32.js','app-v33.js','app-v34.js','app-v35.js','app-v36.js','app-v37.js','app-v58.js','cloud-config.js','manifest.json','icon-192.png','icon-512.png','qrcodes.html','assets/exercises/1-inicio.webp','assets/exercises/1-fim.webp','assets/exercises/supino-inclinado-inicio.webp','assets/exercises/supino-inclinado-fim.webp','assets/exercises/crucifixo-halteres-inicio.webp','assets/exercises/crucifixo-halteres-fim.webp','assets/exercises/crossover-medio-inicio.webp','assets/exercises/crossover-medio-fim.webp','assets/exercises/triceps-corda-inicio.webp','assets/exercises/triceps-corda-fim.webp','assets/exercises/triceps-testa-inicio.webp','assets/exercises/triceps-testa-fim.webp','assets/exercises/puxada-frontal-inicio.webp','assets/exercises/puxada-frontal-fim.webp','assets/exercises/remada-baixa-inicio.webp','assets/exercises/remada-baixa-fim.webp','assets/exercises/remada-curvada-inicio.webp','assets/exercises/remada-curvada-fim.webp','assets/exercises/levantamento-terra-inicio.webp','assets/exercises/levantamento-terra-fim.webp','assets/exercises/barra-fixa-inicio.webp','assets/exercises/barra-fixa-fim.webp','assets/exercises/remada-unilateral-inicio.webp','assets/exercises/remada-unilateral-fim.webp','assets/exercises/rosca-direta-inicio.webp','assets/exercises/rosca-direta-fim.webp','assets/exercises/rosca-alternada-inicio.webp','assets/exercises/rosca-alternada-fim.webp','assets/exercises/rosca-martelo-inicio.webp','assets/exercises/rosca-martelo-fim.webp','assets/exercises/rosca-concentrada-inicio.webp','assets/exercises/rosca-concentrada-fim.webp','assets/exercises/pullover-polia-inicio.webp','assets/exercises/pullover-polia-fim.webp','assets/exercises/rosca-scott-inicio.webp','assets/exercises/rosca-scott-fim.webp','assets/exercises/rosca-direta-inicio.webp','assets/exercises/rosca-direta-fim.webp','assets/exercises/agachamento-livre-inicio.webp','assets/exercises/agachamento-livre-fim.webp','assets/exercises/leg-press-inicio.webp','assets/exercises/leg-press-fim.webp','assets/exercises/cadeira-extensora-inicio.webp','assets/exercises/cadeira-extensora-fim.webp','assets/exercises/cadeira-flexora-inicio.webp','assets/exercises/cadeira-flexora-fim.webp','assets/exercises/avanco-inicio.webp','assets/exercises/avanco-fim.webp','assets/exercises/stiff-inicio.webp','assets/exercises/stiff-fim.webp','assets/exercises/cadeira-adutora-inicio.webp','assets/exercises/cadeira-adutora-fim.webp','assets/exercises/cadeira-abdutora-inicio.webp','assets/exercises/cadeira-abdutora-fim.webp','assets/exercises/panturrilha-em-pe-inicio.webp','assets/exercises/panturrilha-em-pe-fim.webp','assets/exercises/panturrilha-sentado-inicio.webp','assets/exercises/panturrilha-sentado-fim.webp','assets/exercises/desenvolvimento-barra-inicio.webp','assets/exercises/desenvolvimento-barra-fim.webp','assets/exercises/desenvolvimento-halteres-inicio.webp','assets/exercises/desenvolvimento-halteres-fim.webp','assets/exercises/elevacao-lateral-inicio.webp','assets/exercises/elevacao-lateral-fim.webp','assets/exercises/elevacao-frontal-inicio.webp','assets/exercises/elevacao-frontal-fim.webp','assets/exercises/crucifixo-invertido-inicio.webp','assets/exercises/crucifixo-invertido-fim.webp','assets/exercises/encolhimento-inicio.webp','assets/exercises/encolhimento-fim.webp','assets/exercises/face-pull-inicio.webp','assets/exercises/face-pull-fim.webp','assets/exercises/elevacao-lateral-cabo-inicio.webp','assets/exercises/elevacao-lateral-cabo-fim.webp','assets/exercises/prancha-frontal-inicio.webp','assets/exercises/prancha-frontal-fim.webp','assets/exercises/elevacao-pernas-inicio.webp','assets/exercises/elevacao-pernas-fim.webp','assets/exercises/abdominal-maquina-inicio.webp','assets/exercises/abdominal-maquina-fim.webp','assets/exercises/prancha-lateral-inicio.webp','assets/exercises/prancha-lateral-fim.webp','assets/exercises/triceps-frances-inicio.webp','assets/exercises/triceps-frances-fim.webp',
  'assets/mobility/quadril/90-90-a.webp',
  'assets/mobility/quadril/90-90-b.webp',
  'assets/mobility/quadril/afundo-a.webp',
  'assets/mobility/quadril/afundo-b.webp',
  'assets/mobility/quadril/agachamento-a.webp',
  'assets/mobility/quadril/agachamento-b.webp',
  'assets/mobility/quadril/ponte-a.webp',
  'assets/mobility/quadril/ponte-b.webp',
  'assets/mobility/quadril/rotacao-quadril-a.webp',
  'assets/mobility/quadril/rotacao-quadril-b.webp',
  'assets/mobility/quadril/gluteo-a.webp',
  'assets/mobility/quadril/gluteo-b.webp'
];

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
    url.pathname.endsWith('/app-v21.js') ||
    url.pathname.endsWith('/app-v22.js') ||
    url.pathname.endsWith('/app-v23.js') ||
    url.pathname.endsWith('/app-v24.js') ||
    url.pathname.endsWith('/app-v25.js') ||
    url.pathname.endsWith('/app-v26.js') ||
    url.pathname.endsWith('/app-v27.js') ||
    url.pathname.endsWith('/app-v28.js') ||
    url.pathname.endsWith('/app-v29.js') ||
    url.pathname.endsWith('/app-v30.js') ||
    url.pathname.endsWith('/app-v31.js') ||
    url.pathname.endsWith('/app-v32.js') ||
    url.pathname.endsWith('/app-v33.js') ||
    url.pathname.endsWith('/app-v34.js') ||
    url.pathname.endsWith('/app-v35.js') ||
    url.pathname.endsWith('/app-v36.js') ||
    url.pathname.endsWith('/app-v37.js') ||
    url.pathname.endsWith('/app-v58.js') ||
    url.pathname.endsWith('/cloud-config.js') ||
    url.pathname.endsWith('/data.js') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/styles-v58.css') ||
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


const DATA=window.APP_DATA;
let currentGroup="", currentListMode="group", currentExercise=null, currentSet=1, timer=90, tick=null;
let activePlanName="", activePlanExercises=[], activePlanIndex=-1, workoutStartedAt=null;

const byId=id=>document.getElementById(id);
const NAV_STATE_KEY='t2_nav_state_v47';
let navRestoring=false;
let navHistoryIndex=null;

function navStateSnapshot(viewId){
  return {
    matricula: cloudSession?.matricula || '',
    view: viewId || document.querySelector('.view.active')?.id || 'home',
    currentGroup,
    currentListMode,
    activePlanName,
    activePlanIndex,
    currentExerciseId: currentExercise?.id ?? null,
    currentSet,
    workoutStartedAt,
    customBuilderEditingId: typeof customBuilderEditingId!=='undefined' ? customBuilderEditingId : null,
    historyIndex: navHistoryIndex,
    scrollY: window.scrollY || 0,
    savedAt: Date.now()
  };
}
function saveNavigationState(viewId){
  if(navRestoring || !cloudSession?.token) return;
  try{
    localStorage.setItem(NAV_STATE_KEY,JSON.stringify(navStateSnapshot(viewId)));
  }catch(e){}
}
function clearNavigationState(){
  try{localStorage.removeItem(NAV_STATE_KEY)}catch(e){}
}
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  byId(id).classList.add('active');
  if(!navRestoring) scrollTo({top:0,behavior:'smooth'});
  saveNavigationState(id);
}
function exByName(n){return DATA.exercises.find(x=>x.name===n)}
function openGroups(){
  currentListMode="group";
  const gs=[...new Set(DATA.exercises.map(x=>x.group))].filter(g=>g!=="Alongamento");
  byId('groupGrid').innerHTML=gs.map(g=>`<button class="rowbtn" onclick="openGroup('${g.replaceAll("'","\\'")}')"><b>${g}</b><span>${DATA.exercises.filter(x=>x.group===g).length} exercícios</span></button>`).join('');
  showView('groups');
}
function openGroup(g){
  currentGroup=g;currentListMode="group";byId('listTitle').textContent=g;
  renderExerciseButtons(DATA.exercises.filter(x=>x.group===g));showView('list');
}
function openPlans(){
  const grid=byId('planGrid');
  grid.innerHTML=Object.entries(DATA.plans).map(([name,list],idx)=>`
    <button class="rowbtn plan-btn" data-plan-index="${idx}">
      <b>${name}</b><span>${list.length} exercícios</span>
    </button>`).join('');
  const names=Object.keys(DATA.plans);
  grid.querySelectorAll('.plan-btn').forEach(btn=>{
    btn.onclick=()=>openPlan(names[Number(btn.dataset.planIndex)]);
  });
  renderPlansWithCustom();
  showView('plans');
}
function openPlan(name){
  const plan = DATA.plans[name];
  if(!plan){
    alert('Não foi possível abrir este treino.');
    return;
  }
  currentListMode='plan';
  activePlanName=name;
  activePlanExercises=plan.map(exByName).filter(Boolean);
  activePlanIndex=-1;
  byId('listTitle').textContent=name;
  renderExerciseButtons(activePlanExercises);
  const startBox=byId('planStartBox');
  if(startBox) startBox.innerHTML=`<button class="big red plan-start" onclick="startPlanWorkout()">▶ INICIAR ${name.split('—')[0].trim()}</button><small>${activePlanExercises.length} exercícios • registro série por série</small>`;
  showView('list');
}
function goListBack(){showView(currentListMode==="plan"?"plans":"groups")}
function renderExerciseButtons(list){
  byId('exerciseList').innerHTML=list.map((x,i)=>`<button class="rowbtn" onclick="${currentListMode==='plan'?`openPlanExercise(${i})`:`openExercise(${x.id})`}"><b>${i+1}. ${x.name}</b><span>${x.sets} séries • ${x.reps} • descanso ${x.rest}s</span></button>`).join('');
}

function startPlanWorkout(){
  if(!activePlanExercises.length)return;
  workoutStartedAt=new Date().toISOString();
  activePlanIndex=0;
  localStorage.setItem('t2_active_plan',JSON.stringify({name:activePlanName,index:0,startedAt:workoutStartedAt}));
  openExercise(activePlanExercises[0].id,true);
}
function openPlanExercise(index){
  if(!activePlanExercises[index])return;
  activePlanIndex=index;
  if(!workoutStartedAt) workoutStartedAt=new Date().toISOString();
  openExercise(activePlanExercises[index].id,true);
}
function workoutHistory(){return JSON.parse(localStorage.getItem('t2_workouts')||'[]')}
function saveWorkoutHistory(h){localStorage.setItem('t2_workouts',JSON.stringify(h))}

function getActiveWorkoutMetrics(){
  const h=history();
  if(!workoutStartedAt) return {sets:0,reps:0,volume:0,exerciseCount:0,byExercise:[]};
  const startedMs=new Date(workoutStartedAt).getTime();
  const relevant=h.filter(x=>{
    const t=new Date(x.date).getTime();
    return t>=startedMs && x.plan===activePlanName;
  });
  const by={};
  let totalReps=0,totalVolume=0;
  relevant.forEach(x=>{
    const repsNum=numericRepValue(x.reps);
    const weightNum=Number(x.weight)||0;
    totalReps+=repsNum;
    totalVolume+=weightNum>0?weightNum*repsNum:0;
    if(!by[x.exercise]) by[x.exercise]={name:x.exercise,sets:0,reps:0,volume:0,maxWeight:0};
    by[x.exercise].sets++;
    by[x.exercise].reps+=repsNum;
    by[x.exercise].volume+=weightNum>0?weightNum*repsNum:0;
    by[x.exercise].maxWeight=Math.max(by[x.exercise].maxWeight,weightNum);
  });
  return {
    sets:relevant.length,
    reps:totalReps,
    volume:Math.round(totalVolume*10)/10,
    exerciseCount:Object.keys(by).length,
    byExercise:Object.values(by)
  };
}

function finishPlanWorkout(){
  const ended=new Date();
  const started=workoutStartedAt?new Date(workoutStartedAt):ended;
  const minutes=Math.max(1,Math.round((ended-started)/60000));
  const metrics=getActiveWorkoutMetrics();

  const wh=workoutHistory();
  const record={
    date:ended.toISOString(),
    startedAt:workoutStartedAt,
    plan:activePlanName,
    duration:minutes,
    exercisesPlanned:activePlanExercises.length,
    exercisesDone:metrics.exerciseCount,
    sets:metrics.sets,
    reps:metrics.reps,
    volume:metrics.volume,
    byExercise:metrics.byExercise,
    schemaVersion:12,
    excludedFromStats:false
  };
  wh.unshift(record);
  saveWorkoutHistory(wh);

  localStorage.setItem('t2_last',`${activePlanName} • ${metrics.sets} séries • ${minutes} min`);
  localStorage.removeItem('t2_active_plan');
  pauseTimer();
  updateLast();

  byId('finishPlanName').textContent=activePlanName;
  byId('finishPlanStats').innerHTML=`
    <div class="finish-stats">
      <div><strong>${metrics.exerciseCount}</strong><span>exercícios</span></div>
      <div><strong>${metrics.sets}</strong><span>séries</span></div>
      <div><strong>${minutes}</strong><span>min</span></div>
      <div><strong>${metrics.volume.toLocaleString('pt-BR')}</strong><span>kg de volume</span></div>
    </div>`;
  byId('finishExerciseSummary').innerHTML=metrics.byExercise.length
    ? metrics.byExercise.map(x=>`
      <div class="finish-ex-row">
        <div><b>${x.name}</b><small>${x.sets} séries • ${isLegacyRangeValue(x.reps)?x.reps+' reps (registro antigo)':x.reps+' reps'}</small></div>
        <span>${x.maxWeight ? `${x.maxWeight} kg máx.` : 'peso corporal'}</span>
      </div>`).join('')
    : '<div class="hist">Nenhuma série registrada.</div>';
  const fc=byId('finishComparison');
  if(fc) fc.innerHTML=smartComparisonHtml(record);

  activePlanIndex=-1;
  workoutStartedAt=null;
  showView('workoutDone');
}
function nextPlanExercise(){
  if(activePlanIndex<0)return;
  if(activePlanIndex < activePlanExercises.length-1){
    activePlanIndex++;
    localStorage.setItem('t2_active_plan',JSON.stringify({name:activePlanName,index:activePlanIndex,startedAt:workoutStartedAt}));
    openExercise(activePlanExercises[activePlanIndex].id,true);
  }else finishPlanWorkout();
}



function numericRepValue(value){
  if(typeof value==='number' && Number.isFinite(value)) return value;
  const s=String(value??'').trim().replace(',','.');
  if(!s) return 0;
  const exact=Number(s);
  if(Number.isFinite(exact)) return exact;
  const m=s.match(/\d+(?:\.\d+)?/);
  return m?Number(m[0]):0;
}


function normText(value){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
}
function isBodyweightName(name){
  const n=normText(name);
  return [
    'barra fixa','pull up','pull-up','chin up','chin-up',
    'prancha','dead bug','crunch','abdominal','flexao','flexão'
  ].some(k=>n.includes(normText(k)));
}
function workoutQuality(w){
  const sets=getWorkoutSets(w);
  const reasons=[];

  if(sets.some(x=>isLegacyRangeValue(x.reps))){
    reasons.push('repetições antigas em faixa');
  }

  if(sets.some(x=>isBodyweightName(x.exercise) && Number(x.weight||0)>0)){
    reasons.push('carga corporal registrada como carga externa');
  }

  return {legacy:reasons.length>0,reasons};
}
function migrateWorkoutQuality(){
  const wh=workoutHistory();
  let changed=false;

  wh.forEach(w=>{
    const q=workoutQuality(w);
    const modern=Number(w.schemaVersion||0)>=12;

    if(q.legacy){
      if(!w.legacyData){w.legacyData=true;changed=true}
      const rs=q.reasons.join(' • ');
      if(w.qualityReason!==rs){w.qualityReason=rs;changed=true}
    }else{
      // Treinos produzidos pelas versões atuais voltam automaticamente
      // para a evolução caso tenham sido marcados por engano.
      if(modern && w.legacyData){
        w.legacyData=false;
        changed=true;
      }
      if(modern && w.qualityReason){
        delete w.qualityReason;
        changed=true;
      }
    }

    if(w.excludedFromStats==null){
      w.excludedFromStats=false;
      changed=true;
    }
  });

  if(changed) saveWorkoutHistory(wh);
  return wh;
}
function reliableWorkouts(){
  return migrateWorkoutQuality().filter(w=>!w.legacyData && !w.excludedFromStats);
}
function toggleWorkoutStats(index){
  const wh=migrateWorkoutQuality(), w=wh[index]; if(!w)return;
  w.excludedFromStats=!w.excludedFromStats;
  saveWorkoutHistory(wh);
  openWorkoutHistory(index);
}

function isLegacyRangeValue(value){
  const s=String(value??'').trim();
  return /^\d+\s*[–—-]\s*\d+/.test(s);
}
function hasUsableSetForVolume(x){
  return Number(x.weight||0)>0 && !isLegacyRangeValue(x.reps) && numericRepValue(x.reps)>0;
}

function setVolume(x){
  if(!hasUsableSetForVolume(x)) return 0;
  const w=Number(x.weight||0);
  const r=numericRepValue(x.reps);
  return w*r;
}
function getWorkoutSets(w){
  const all=history();
  const end=new Date(w.date).getTime();
  let start=w.startedAt?new Date(w.startedAt).getTime():NaN;
  if(!Number.isFinite(start)){
    const wh=workoutHistory();
    const idx=wh.findIndex(x=>x.date===w.date && x.plan===w.plan);
    if(idx>=0 && wh[idx+1]) start=new Date(wh[idx+1].date).getTime()+1;
    else start=end-6*60*60*1000;
  }

  const rows=all.filter(x=>{
    const t=new Date(x.date).getTime();
    return x.plan===w.plan && t>=start && t<=end;
  });

  // Se a mesma série tiver sido gravada duas vezes (ex.: recarga/sincronização),
  // usa apenas o registro mais recente, em vez de invalidar o treino inteiro.
  const byKey=new Map();
  rows
    .slice()
    .sort((a,b)=>new Date(a.date)-new Date(b.date))
    .forEach(x=>{
      const key=`${normText(x.exercise)}|${Number(x.set)||0}`;
      byKey.set(key,x);
    });

  return [...byKey.values()].sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function deriveWorkoutMetrics(w){
  const sets=getWorkoutSets(w);
  const by={};
  let volume=0,reps=0,legacy=false,usableWeightedSets=0;
  sets.forEach(x=>{
    if(isLegacyRangeValue(x.reps)) legacy=true;
    if(hasUsableSetForVolume(x)) usableWeightedSets++;
    volume+=setVolume(x);
    reps+=numericRepValue(x.reps);
    if(!by[x.exercise]) by[x.exercise]={name:x.exercise,sets:0,reps:0,volume:0,maxWeight:0};
    by[x.exercise].sets++;
    by[x.exercise].reps+=numericRepValue(x.reps);
    by[x.exercise].volume+=setVolume(x);
    by[x.exercise].maxWeight=Math.max(by[x.exercise].maxWeight,Number(x.weight||0));
  });
  return {
    sets:sets.length,
    reps,
    volume:Math.round(volume*10)/10,
    legacy,
    usableWeightedSets,
    exercisesDone:Object.keys(by).length,
    byExercise:Object.values(by)
  };
}
function reconcileWorkoutHistory(){
  const wh=workoutHistory();
  let changed=false;
  wh.forEach(w=>{
    const d=deriveWorkoutMetrics(w);
    if((!Number(w.sets)||Number(w.sets)===0) && d.sets){w.sets=d.sets;changed=true}
    if((!Number(w.exercisesDone)||Number(w.exercisesDone)===0) && d.exercisesDone){w.exercisesDone=d.exercisesDone;changed=true}
    // Recompute volume whenever we can derive a better value from the raw set history.
    if(d.volume>0 && Number(w.volume||0)!==d.volume){w.volume=d.volume;changed=true}
    if(d.legacy && !w.legacyData){w.legacyData=true;changed=true}
    if(d.byExercise.length && (!Array.isArray(w.byExercise)||!w.byExercise.length)){w.byExercise=d.byExercise;changed=true}
    if(d.reps>0 && !Number(w.reps)){w.reps=d.reps;changed=true}
  });
  if(changed) saveWorkoutHistory(wh);
  return wh;
}

function isTimedExercise(ex){
  if(!ex) return false;
  const r=String(ex.reps||'').toLowerCase();
  return /\bseg\b|\bsegundos?\b|\d+\s*s\b|prancha|isometr/i.test(r+' '+ex.name);
}
function isBodyweightExercise(ex){
  if(!ex) return false;
  const t=normText(ex.name+' '+ex.group+' '+ex.muscle);
  return isTimedExercise(ex) || isBodyweightName(ex.name) || /dead bug|abdominal|crunch|prancha|alongamento|mobilidade/.test(t);
}
function formatSetRecord(x){
  const ex=exByName(x.exercise);
  const timed=isTimedExercise(ex);
  const w=Number(x.weight||0);
  const val=String(x.reps??'');
  if(timed) return `${val || ex?.reps || ''}${/s|seg/i.test(val)?'':' s'}`;
  return `${w>0?`${w} kg • `:''}${val || ex?.reps || ''} reps`;
}

function openExercise(id,inPlan=false){
  currentExercise=DATA.exercises.find(x=>x.id===id); if(!currentExercise)return;
  currentGroup=currentExercise.group;currentSet=1;timer=currentExercise.rest;pauseTimer();
  byId('exTitle').textContent=currentExercise.name;
  const realisticByName={
    // Treino A
    'Supino reto':'1',
    'Supino inclinado':'supino-inclinado',
    'Crucifixo com halteres':'crucifixo-halteres',
    'Crucifixo':'crucifixo-halteres',
    'Crossover médio':'crossover-medio',
    'Crossover':'crossover-medio',
    'Tríceps corda':'triceps-corda',
    'Tríceps na polia (corda)':'triceps-corda',
    'Tríceps testa':'triceps-testa',
    'Tríceps testa (barra W)':'triceps-testa',
    'Tríceps francês':'triceps-frances',
    'Tríceps francês (halter)':'triceps-frances',

    // Treino B
    'Puxada frontal':'puxada-frontal',
    'Puxada alta':'puxada-frontal',
    'Puxada alta pronada':'puxada-frontal',
    'Puxada pronada':'puxada-frontal',
    'Remada baixa':'remada-baixa',
    'Remada baixa (cabo)':'remada-baixa',
    'Remada curvada':'remada-curvada',
    'Remada curvada (barra)':'remada-curvada',
    'Levantamento terra':'levantamento-terra',
    'Terra':'levantamento-terra',
    'Barra fixa':'barra-fixa',
    'Barra fixa pronada':'barra-fixa',
    'Barra fixa (pegada pronada)':'barra-fixa',
    'Remada unilateral':'remada-unilateral',
    'Remada unilateral (halter)':'remada-unilateral',
    'Rosca direta':'rosca-direta',
    'Rosca direta (barra)':'rosca-direta',
    'Elevação pélvica':'elevacao-pelvica',
    'Elevacao pelvica':'elevacao-pelvica',
    'Hip thrust':'elevacao-pelvica',
    "Supino declinado":"supino-declinado",
    "Supino declinado (barra)":"supino-declinado",
    "Crossover alto":"crossover-alto",
    "Crossover baixo":"crossover-baixo",
    "Peck deck":"peck-deck",
    "Peck deck (voador)":"peck-deck",
    "Flexão de braços":"flexao-bracos",
    "Flexao de bracos":"flexao-bracos",
    "Puxada neutra":"puxada-neutra",
    "Remada cavalinho":"remada-cavalinho",
    "Remada cavalinho (T-bar)":"remada-cavalinho",
    "Desenvolvimento na máquina":"desenvolvimento-maquina",
    "Desenvolvimento na maquina":"desenvolvimento-maquina",
    "Crucifixo inverso":"crucifixo-inverso",
    "Remada alta":"remada-alta",
    "Rosca na polia":"rosca-polia",
    "Rosca inclinada":"rosca-inclinada",
    "Tríceps barra":"triceps-barra",
    "Triceps barra":"triceps-barra",
    "Tríceps unilateral polia":"triceps-unilateral-polia",
    "Tríceps unilateral na polia":"triceps-unilateral-polia",
    "Mergulho em banco":"mergulho-banco",
    "Paralelas":"paralelas",
    "Mergulho em paralelas":"paralelas",
    "Mesa flexora":"mesa-flexora",
    "Afundo":"afundo",
    "Agachamento búlgaro":"agachamento-bulgaro",
    "Agachamento bulgaro":"agachamento-bulgaro",
    "Crunch tradicional":"crunch-tradicional",
    "Crunch na polia":"crunch-polia",
    "Abdominal bicicleta":"abdominal-bicicleta",
    "Abdominal oblíquo":"abdominal-obliquo",
    "Abdominal obliquo":"abdominal-obliquo",
    "Dead bug":"dead-bug",
    'Rosca alternada':'rosca-alternada',
    'Rosca alternada (halteres)':'rosca-alternada',
    'Rosca martelo':'rosca-martelo',
    'Rosca concentrada':'rosca-concentrada',
    'Pullover na polia':'pullover-polia',
    'Pullover polia':'pullover-polia',
    'Pullover no cabo':'pullover-polia',
    'Rosca Scott':'rosca-scott',
    'Rosca scott':'rosca-scott',
    'Rosca direta barra':'rosca-direta',
    'Rosca direta (barra)':'rosca-direta',

    // Treino C
    'Agachamento livre':'agachamento-livre',
    'Agachamento':'agachamento-livre',
    'Agachamento livre (barra)':'agachamento-livre',
    'Leg press':'leg-press',
    'Leg press 45°':'leg-press',
    'Leg press 45':'leg-press',
    'Cadeira extensora':'cadeira-extensora',
    'Extensora':'cadeira-extensora',
    'Cadeira flexora':'cadeira-flexora',
    'Flexora':'cadeira-flexora',
    'Avanço':'avanco',
    'Passada':'avanco',
    'Avanço (passada)':'avanco',
    'Stiff':'stiff',
    'Stiff (barra)':'stiff',
    'Cadeira adutora':'cadeira-adutora',
    'Adutora':'cadeira-adutora',
    'Cadeira abdutora':'cadeira-abdutora',
    'Abdutora':'cadeira-abdutora',
    'Panturrilha em pé':'panturrilha-em-pe',
    'Panturrilha em pé (máquina)':'panturrilha-em-pe',
    'Panturrilha sentado':'panturrilha-sentado',
    'Panturrilha sentada':'panturrilha-sentado',

    // Treino D — Ombros + Core
    'Desenvolvimento com barra':'desenvolvimento-barra',
    'Desenvolvimento (barra)':'desenvolvimento-barra',
    'Desenvolvimento com halteres':'desenvolvimento-halteres',
    'Desenvolvimento halteres':'desenvolvimento-halteres',
    'Desenvolvimento (halteres)':'desenvolvimento-halteres',
    'Elevação lateral':'elevacao-lateral',
    'Elevação lateral com halteres':'elevacao-lateral',
    'Elevação frontal':'elevacao-frontal',
    'Elevação frontal com halteres':'elevacao-frontal',
    'Crucifixo invertido':'crucifixo-invertido',
    'Crucifixo invertido (peck deck)':'crucifixo-invertido',
    'Encolhimento':'encolhimento',
    'Encolhimento de ombros':'encolhimento',
    'Encolhimento de ombros (halteres)':'encolhimento',
    'Face pull':'face-pull',
    'Face pull (corda)':'face-pull',
    'Elevação lateral no cabo':'elevacao-lateral-cabo',
    'Prancha':'prancha-frontal',
    'Prancha frontal':'prancha-frontal',
    'Prancha abdominal':'prancha-frontal',
    'Elevação de pernas':'elevacao-pernas',
    'Elevação de pernas (barra)':'elevacao-pernas',
    'Abdominal na máquina':'abdominal-maquina',
    'Abdominal máquina':'abdominal-maquina',
    'Prancha lateral':'prancha-lateral'
  };
  const realisticKey=realisticByName[currentExercise.name];
  const hasRealistic=!!realisticKey;
  const imgStart=byId('imgStart'), imgEnd=byId('imgEnd');
  imgStart.classList.toggle('realistic-exercise',hasRealistic);
  imgEnd.classList.toggle('realistic-exercise',hasRealistic);
  imgStart.onerror=()=>{imgStart.onerror=null;imgStart.src=`assets/exercises/${currentExercise.id}-inicio.svg`;imgStart.classList.remove('realistic-exercise');};
  imgEnd.onerror=()=>{imgEnd.onerror=null;imgEnd.src=`assets/exercises/${currentExercise.id}-fim.svg`;imgEnd.classList.remove('realistic-exercise');};
  imgStart.src=hasRealistic?`assets/exercises/${realisticKey}-inicio.webp?v=37.0`:`assets/exercises/${currentExercise.id}-inicio.svg`;
  imgEnd.src=hasRealistic?`assets/exercises/${realisticKey}-fim.webp?v=37.0`:`assets/exercises/${currentExercise.id}-fim.svg`;
  bindExerciseImageZoom();
  updateMotionButton(hasRealistic);
  const hdPortrait=[
    'Elevação pélvica','Elevacao pelvica','Hip thrust',
    'Pullover na polia','Pullover polia','Pullover no cabo','Rosca Scott','Rosca scott','Rosca direta','Rosca direta barra','Rosca direta (barra)',
    'Desenvolvimento com halteres','Desenvolvimento com barra','Desenvolvimento (barra)',
    'Elevação lateral','Elevação lateral com halteres','Elevação frontal','Elevação frontal com halteres',
    'Crucifixo invertido','Crucifixo invertido (peck deck)','Encolhimento','Encolhimento de ombros',
    'Encolhimento de ombros (halteres)','Face pull','Face pull (corda)','Elevação lateral no cabo',
    'Prancha','Prancha frontal','Prancha abdominal','Elevação de pernas','Elevação de pernas (barra)',
    'Abdominal na máquina','Abdominal máquina','Prancha lateral'
  ].includes(currentExercise.name);
  imgStart.classList.toggle('hd-portrait',hdPortrait);
  imgEnd.classList.toggle('hd-portrait',hdPortrait);
  byId('exMuscle').textContent=currentExercise.muscle;
  byId('exPrescription').textContent=`${currentExercise.sets} x ${currentExercise.reps}`;
  byId('exTip').textContent=currentExercise.tip;byId('exAvoid').textContent=currentExercise.avoid;
  byId('setLabel').textContent=`Série 1 de ${currentExercise.sets}`;byId('weight').value=getLastWeight(currentExercise.name)||"";
  byId('reps').value="";
  const timed=isTimedExercise(currentExercise);
  const bodyweight=isBodyweightExercise(currentExercise);
  const weightField=byId('weightField'), repsLabel=byId('repsLabel'), repsInput=byId('reps');
  if(weightField) weightField.style.display=bodyweight?'none':'block';
  if(repsLabel) repsLabel.textContent=timed?'Tempo (segundos)':'Repetições';
  if(repsInput){
    repsInput.type='number';
    repsInput.placeholder=timed?'Ex.: 30':'';
  }
  if(bodyweight) byId('weight').value='';
  const wp=byId('workoutProgress');
  if(wp){
    if(inPlan && activePlanIndex>=0){
      wp.style.display='block';
      byId('workoutPlanLabel').textContent=activePlanName;
      byId('workoutStepLabel').textContent=`Exercício ${activePlanIndex+1} de ${activePlanExercises.length}`;
    }else wp.style.display='none';
  }
  const next=byId('nextExerciseBtn'); if(next) next.style.display='none';
  updateClock();showView('exercise');
}
function history(){return JSON.parse(localStorage.getItem('t2_history')||'[]')}
function saveHistory(h){localStorage.setItem('t2_history',JSON.stringify(h))}
function getLastWeight(name){const h=history().find(x=>x.exercise===name&&Number(x.weight)>0);return h?h.weight:""}
function completeSet(){
  if(!currentExercise)return;
  const timed=isTimedExercise(currentExercise), bodyweight=isBodyweightExercise(currentExercise);
  const repsRaw=String(byId('reps').value||'').trim();
  if(!repsRaw){
    alert(timed?'Informe o tempo realizado em segundos.':'Informe quantas repetições você realizou.');
    byId('reps').focus();
    return;
  }
  const reps=numericRepValue(repsRaw);
  if(!(reps>0)){
    alert(timed?'Informe um tempo válido em segundos.':'Informe uma quantidade válida de repetições.');
    byId('reps').focus();
    return;
  }
  const weight=bodyweight?0:Number(byId('weight').value||0);
  const h=history();
  h.unshift({
    date:new Date().toISOString(),group:currentExercise.group,exercise:currentExercise.name,
    set:currentSet,weight,reps,plan:activePlanIndex>=0?activePlanName:""
  });
  const wasPR=!bodyweight && checkNewPR(currentExercise.name,weight);
  saveHistory(h);
  localStorage.setItem('t2_last',`${currentExercise.group} • ${currentExercise.name} • ${weight} kg • ${reps} reps`);
  updateLast();
  if(wasPR && weight>0){
    const toast=byId('prToast');
    if(toast){
      const prev=previousBestBefore(currentExercise.name,new Date().toISOString());
      const diff=prev>0?weight-prev:0;
      const pct=prev>0?diff/prev*100:null;
      toast.innerHTML=`🏆 <b>NOVO RECORDE</b><span>${currentExercise.name}: ${weight} kg</span>${prev>0?`<small>${prev} → ${weight} kg • +${diff.toFixed(diff%1?1:0)} kg • +${pct.toFixed(1)}%</small>`:''}`;
      toast.classList.add('show');
      setTimeout(()=>toast.classList.remove('show'),3200);
    }
  }

  if(currentSet<currentExercise.sets){
    currentSet++;
    saveNavigationState('exercise');
    byId('setLabel').textContent=`Série ${currentSet} de ${currentExercise.sets}`;
    byId('reps').value="";
    resetTimer();startTimer();
  }else{
    pauseTimer();
    saveNavigationState('exercise');
    const btn=byId('nextExerciseBtn');
    byId('setLabel').innerHTML=`<span class="done-inline">✓ Exercício concluído</span><small>${currentExercise.sets}/${currentExercise.sets} séries realizadas</small>`;
    if(activePlanIndex>=0 && btn){
      btn.style.display='block';
      btn.textContent=activePlanIndex<activePlanExercises.length-1
        ? `PRÓXIMO EXERCÍCIO → ${activePlanExercises[activePlanIndex+1].name}`
        : 'FINALIZAR TREINO ✓';
      btn.scrollIntoView({behavior:'smooth',block:'center'});
    }else{
      alert("Exercício concluído. Bom treino!");
    }
  }
}
function updateClock(){byId('clock').textContent=`${String(Math.floor(timer/60)).padStart(2,'0')}:${String(timer%60).padStart(2,'0')}`}
function startTimer(){if(tick)return;tick=setInterval(()=>{timer=Math.max(0,timer-1);updateClock();if(timer===0){pauseTimer();if(navigator.vibrate)navigator.vibrate([250,100,250])}},1000)}
function pauseTimer(){clearInterval(tick);tick=null}
function resetTimer(){pauseTimer();timer=currentExercise?currentExercise.rest:90;updateClock()}
function updateLast(){byId('lastWorkout').textContent=localStorage.getItem('t2_last')||"Nenhum treino registrado."}
function renderHistory(){
  const h=history(); reconcileWorkoutHistory(); const wh=migrateWorkoutQuality();
  const detail=byId('historyDetail'); if(detail) detail.style.display='none';
  const list=byId('historyList'); if(list) list.style.display='block';
  let out='';
  if(wh.length){
    out+=`<div class="card"><h3>Treinos concluídos</h3><p class="muted">Toque em um treino para ver o resumo completo.</p>${wh.slice(0,30).map((x,i)=>`
      <button class="workout-hist workout-open" onclick="openWorkoutHistory(${i})">
        <b>${x.plan}</b>
        <span>${x.exercisesDone??x.exercises??0} exercícios • ${x.sets??0} séries • ${x.duration} min</span>
        <span>${x.legacyData?'Registro antigo — fora da evolução':(x.excludedFromStats?'Ignorado na evolução':Number(x.volume||0).toLocaleString('pt-BR')+' kg de volume')}</span>
        <small>${new Date(x.date).toLocaleString('pt-BR')}</small>
      </button>`).join('')}</div>`;
  } else out='<div class="card">Nenhum treino concluído ainda.</div>';
  byId('historyList').innerHTML=out;
}
function openWorkoutHistory(index){
  navHistoryIndex=index;
  saveNavigationState('history');
  reconcileWorkoutHistory(); const wh=migrateWorkoutQuality(), w=wh[index]; if(!w)return;
  const all=history();
  const start=w.startedAt?new Date(w.startedAt).getTime():0, end=new Date(w.date).getTime();
  let sets=all.filter(x=>{
    const t=new Date(x.date).getTime();
    return x.plan===w.plan && t>=start && t<=end;
  });
  const grouped={};
  sets.forEach(x=>{(grouped[x.exercise]??=[]).push(x)});
  const rows=Object.entries(grouped).map(([name,items])=>`
    <div class="detail-ex">
      <b>${name}</b>
      ${items.sort((a,b)=>a.set-b.set).map(x=>`<span>Série ${x.set}: ${formatSetRecord(x)}</span>`).join('')}
    </div>`).join('');
  byId('historyList').style.display='none';
  const d=byId('historyDetail'); d.style.display='block';
  d.innerHTML=`<div class="bar"><button onclick="closeWorkoutHistory()">←</button><h2>Resumo do treino</h2></div>
    <div class="card workout-summary">
      <div class="eyebrow">TREINO CONCLUÍDO</div><h3>${w.plan}</h3>
      <div class="finish-stats">
        <div><strong>${w.exercisesDone??0}</strong><span>exercícios</span></div>
        <div><strong>${w.sets??0}</strong><span>séries</span></div>
        <div><strong>${w.duration??0}</strong><span>min</span></div>
        <div><strong>${Number(w.volume||0).toLocaleString('pt-BR')}</strong><span>kg volume</span></div>
      </div>
      <small>${new Date(w.date).toLocaleString('pt-BR')}</small>
      ${w.legacyData?`<div class="quality-warning">⚠ Registro antigo/inconsistente. Não entra nos cálculos de evolução.${w.qualityReason?`<small>${w.qualityReason}</small>`:''}</div>`:''}
      ${!w.legacyData?`<button class="big stats-toggle" onclick="toggleWorkoutStats(${index})">${w.excludedFromStats?'INCLUIR NA EVOLUÇÃO':'IGNORAR NA EVOLUÇÃO'}</button>`:''}
    </div>
    ${!w.legacyData&&!w.excludedFromStats?`<div class="card"><h3>Comparação com treino anterior</h3>${smartComparisonHtml(w)}</div>`:''}
    <div class="card"><h3>Séries realizadas</h3>${rows||'<p>Sem séries detalhadas.</p>'}</div>`;
  scrollTo({top:0,behavior:'smooth'});
}
function closeWorkoutHistory(){
  navHistoryIndex=null;
  saveNavigationState('history');
  byId('historyDetail').style.display='none';byId('historyList').style.display='block';scrollTo({top:0,behavior:'smooth'});
}


function validTrainingSets(){
  return reliableWorkouts().flatMap(w=>getWorkoutSets(w));
}
function standaloneSets(){
  return history().filter(x=>!x.plan);
}
function exercisePRHistory(exercise){
  return validTrainingSets()
    .filter(x=>x.exercise===exercise && Number(x.weight)>0 && !isLegacyRangeValue(x.reps))
    .slice()
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function previousBestBefore(exercise,date){
  const t=new Date(date).getTime();
  const vals=exercisePRHistory(exercise).filter(x=>new Date(x.date).getTime()<t).map(x=>Number(x.weight));
  return vals.length?Math.max(...vals):0;
}

function personalRecords(){
  const sets=validTrainingSets();
  const prs={};
  sets.forEach(x=>{
    const ex=exByName(x.exercise);
    if(Number(x.weight)>0 && !isBodyweightExercise(ex) && !isBodyweightName(x.exercise) && !isLegacyRangeValue(x.reps)){
      const w=Number(x.weight);
      if(!prs[x.exercise] || w>prs[x.exercise].weight){
        prs[x.exercise]={exercise:x.exercise,weight:w,date:x.date};
      }
    }
  });
  return Object.values(prs).map(p=>{
    const prev=previousBestBefore(p.exercise,p.date);
    const gain=prev>0?p.weight-prev:0;
    const pct=prev>0?gain/prev*100:null;
    return {...p,previous:prev,gain,pct};
  }).sort((a,b)=>b.weight-a.weight);
}

function workoutExerciseBestMap(w){
  const sets=getWorkoutSets(w);
  const map={};
  sets.forEach(x=>{
    const ex=exByName(x.exercise);
    if(Number(x.weight)>0 && !isBodyweightExercise(ex) && !isBodyweightName(x.exercise) && !isLegacyRangeValue(x.reps)){
      map[x.exercise]=Math.max(map[x.exercise]||0,Number(x.weight));
    }
  });
  return map;
}

function validWorkoutsSorted(){
  return getWorkouts().filter(w=>!w.ignored && Number(w.series||0)>0).sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function dayKey(d){
  const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
}
function consistencyStats(){
  const ws=validWorkoutsSorted();
  const days=[...new Set(ws.map(w=>dayKey(w.date)))].sort();
  if(!days.length) return {current:0,best:0,last7:0,last30:0};
  const toDay=s=>Math.floor(new Date(s+"T12:00:00").getTime()/86400000);
  let best=1, run=1;
  for(let i=1;i<days.length;i++){
    if(toDay(days[i])-toDay(days[i-1])===1) run++; else run=1;
    best=Math.max(best,run);
  }
  let current=1;
  for(let i=days.length-1;i>0;i--){
    if(toDay(days[i])-toDay(days[i-1])===1) current++; else break;
  }
  const now=Date.now();
  return {
    current,best,
    last7:ws.filter(w=>now-new Date(w.date).getTime()<=7*86400000).length,
    last30:ws.filter(w=>now-new Date(w.date).getTime()<=30*86400000).length
  };
}
function weeklySummaryHtml(){
  const s=consistencyStats();
  const ws=validWorkoutsSorted();
  if(!ws.length) return '';
  const recent=ws.filter(w=>Date.now()-new Date(w.date).getTime()<=7*86400000);
  const volume=recent.reduce((a,w)=>a+Number(w.volume||0),0);
  return `<section class="card weekly-card">
    <h2>Consistência</h2>
    <div class="weekly-grid">
      <div><strong>${s.last7}</strong><span>treinos / 7 dias</span></div>
      <div><strong>${s.current}</strong><span>dias em sequência</span></div>
      <div><strong>${s.best}</strong><span>melhor sequência</span></div>
      <div><strong>${Math.round(volume).toLocaleString('pt-BR')}</strong><span>kg / 7 dias</span></div>
    </div>
  </section>`;
}


function openExerciseImageZoom(src,label){
  let overlay=document.getElementById('exerciseZoom');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='exerciseZoom';
    overlay.className='exercise-zoom';
    overlay.innerHTML=`<button class="exercise-zoom-close" aria-label="Fechar">×</button>
      <div class="exercise-zoom-card">
        <div class="exercise-zoom-label"></div>
        <img alt="">
        <div class="exercise-zoom-hint">Toque fora da imagem para fechar</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{
      if(e.target===overlay || e.target.classList.contains('exercise-zoom-close')) overlay.classList.remove('show');
    });
  }
  overlay.querySelector('img').src=src;
  overlay.querySelector('img').alt=label||'Execução do exercício';
  overlay.querySelector('.exercise-zoom-label').textContent=label||'Execução';
  overlay.classList.add('show');
}
function bindExerciseImageZoom(){
  const s=byId('imgStart'), e=byId('imgEnd');
  if(s && !s.dataset.zoomBound){
    s.dataset.zoomBound='1';
    s.addEventListener('click',()=>openExerciseImageZoom(s.src,'POSIÇÃO INICIAL'));
  }
  if(e && !e.dataset.zoomBound){
    e.dataset.zoomBound='1';
    e.addEventListener('click',()=>openExerciseImageZoom(e.src,'POSIÇÃO FINAL'));
  }
}


let exerciseMotionTimer=null;
function stopExerciseMotion(){
  if(exerciseMotionTimer){ clearInterval(exerciseMotionTimer); exerciseMotionTimer=null; }
  const ov=document.getElementById('exerciseMotion');
  if(ov) ov.classList.remove('show');
}
function openExerciseMotion(){
  const start=byId('imgStart'), end=byId('imgEnd');
  if(!start || !end) return;
  let ov=document.getElementById('exerciseMotion');
  if(!ov){
    ov=document.createElement('div');
    ov.id='exerciseMotion';
    ov.className='exercise-motion';
    ov.innerHTML=`<button class="exercise-motion-close" aria-label="Fechar">×</button>
      <div class="exercise-motion-card">
        <div class="exercise-motion-top"><b>EXECUÇÃO DO MOVIMENTO</b><span id="motionLabel">POSIÇÃO INICIAL</span></div>
        <img id="motionImage" alt="Animação da execução">
        <div class="exercise-motion-progress"><i></i></div>
        <small>Visualização alternada entre início e fim • movimento real deve ser controlado</small>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{
      if(e.target===ov || e.target.classList.contains('exercise-motion-close')) stopExerciseMotion();
    });
  }
  const img=ov.querySelector('#motionImage');
  const label=ov.querySelector('#motionLabel');
  const frames=[{src:start.src,label:'POSIÇÃO INICIAL'},{src:end.src,label:'POSIÇÃO FINAL'}];
  let frame=0;
  img.src=frames[0].src; label.textContent=frames[0].label;
  ov.classList.add('show');
  if(exerciseMotionTimer) clearInterval(exerciseMotionTimer);
  exerciseMotionTimer=setInterval(()=>{
    frame=(frame+1)%2;
    img.classList.remove('motion-pop');
    void img.offsetWidth;
    img.src=frames[frame].src;
    label.textContent=frames[frame].label;
    img.classList.add('motion-pop');
  },950);
}
function updateMotionButton(hasRealistic){
  let btn=document.getElementById('motionBtn');
  const visual=document.querySelector('.visual');
  if(!visual) return;
  if(!btn){
    btn=document.createElement('button');
    btn.id='motionBtn';
    btn.className='motion-btn';
    btn.type='button';
    btn.innerHTML='▶ VER MOVIMENTO';
    visual.insertAdjacentElement('afterend',btn);
    btn.addEventListener('click',openExerciseMotion);
  }
  btn.style.display=hasRealistic?'flex':'none';
}

function smartWorkoutComparison(current){
  const prev=previousWorkoutSamePlan(current);
  if(!prev) return null;
  const curMap=workoutExerciseBestMap(current);
  const prevMap=workoutExerciseBestMap(prev);
  let increased=0, maintained=0, decreased=0, newPRs=0;
  const details=[];
  Object.keys(curMap).forEach(name=>{
    const cur=curMap[name];
    const old=prevMap[name];
    if(old==null){
      details.push({name,status:'novo',old:null,cur,diff:null,pct:null});
      return;
    }
    const diff=cur-old;
    const pct=old>0?diff/old*100:null;
    if(diff>0){
      increased++;
      const allBefore=validTrainingSets().filter(x=>x.exercise===name && new Date(x.date)<new Date(current.date) && Number(x.weight)>0);
      const bestBefore=allBefore.length?Math.max(...allBefore.map(x=>Number(x.weight))):0;
      if(cur>bestBefore) newPRs++;
    }else if(diff===0) maintained++;
    else decreased++;
    details.push({name,status:diff>0?'up':diff<0?'down':'same',old,cur,diff,pct});
  });
  const curVol=Number(current.volume||0), prevVol=Number(prev.volume||0);
  const volDiff=curVol-prevVol;
  const volPct=prevVol>0?volDiff/prevVol*100:null;
  return {prev,increased,maintained,decreased,newPRs,details,curVol,prevVol,volDiff,volPct};
}
function smartComparisonHtml(current){
  const c=smartWorkoutComparison(current);
  if(!c) return '<p class="muted">Ainda não há treino anterior válido deste mesmo plano para comparar.</p>';
  const sign=c.volDiff>0?'+':'';
  const top=c.details.slice().sort((a,b)=>(b.diff||0)-(a.diff||0)).slice(0,5);
  return `<div class="smart-compare">
    <div class="smart-grid">
      <div><strong class="${c.volDiff>0?'pos':c.volDiff<0?'neg':'neu'}">${sign}${Math.round(c.volDiff).toLocaleString('pt-BR')} kg</strong><span>volume</span></div>
      <div><strong>${c.increased}</strong><span>cargas ↑</span></div>
      <div><strong>${c.maintained}</strong><span>mantidas</span></div>
      <div><strong>${c.decreased}</strong><span>abaixo</span></div>
    </div>
    <div class="smart-volume">
      <span>${Math.round(c.prevVol).toLocaleString('pt-BR')} kg</span>
      <b>→</b>
      <span>${Math.round(c.curVol).toLocaleString('pt-BR')} kg</span>
      <strong class="${c.volDiff>0?'pos':c.volDiff<0?'neg':'neu'}">${c.volPct==null?'':`${sign}${c.volPct.toFixed(1)}%`}</strong>
    </div>
    ${c.newPRs?`<div class="smart-pr">🏆 ${c.newPRs} novo${c.newPRs===1?' recorde':'s recordes'} neste treino</div>`:''}
    <div class="smart-detail">${top.map(x=>`<div><span>${x.name}</span><b class="${x.status==='up'?'pos':x.status==='down'?'neg':'neu'}">${
      x.old==null?`${x.cur} kg`
      : x.status==='same'?'mantido'
      : `${x.old} → ${x.cur} kg (${x.diff>0?'+':''}${x.diff} kg)`
    }</b></div>`).join('')}</div>
  </div>`;
}

function previousWorkoutSamePlan(current){
  const wh=reliableWorkouts().slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const same=wh.filter(x=>x.plan===current.plan);
  const idx=same.findIndex(x=>x.date===current.date);
  return idx>=0?same[idx+1]||null:null;
}
function workoutComparisonHtmlLegacy(current){
  const prev=previousWorkoutSamePlan(current);
  if(!prev) return '<p class="muted">Ainda não há treino anterior válido deste mesmo plano para comparar.</p>';
  const curVol=Number(current.volume||0), prevVol=Number(prev.volume||0);
  const diff=curVol-prevVol;
  const pct=prevVol>0?diff/prevVol*100:null;
  const sign=diff>0?'+':'';
  return `<div class="compare-box">
    <div><span>Treino anterior</span><b>${Math.round(prevVol).toLocaleString('pt-BR')} kg</b></div>
    <div><span>Treino atual</span><b>${Math.round(curVol).toLocaleString('pt-BR')} kg</b></div>
    <div class="${diff>0?'compare-up':diff<0?'compare-down':'compare-flat'}">
      <span>Diferença</span><b>${sign}${Math.round(diff).toLocaleString('pt-BR')} kg${pct===null?'':` • ${sign}${pct.toFixed(1)}%`}</b>
    </div>
  </div>`;
}
function checkNewPR(exercise, weight){
  if(!(weight>0) || !exercise) return false;
  const ex=exByName(exercise);
  if(isBodyweightExercise(ex) || isBodyweightName(exercise)) return false;
  const prior=history().filter(x=>
    x.exercise===exercise &&
    Number(x.weight)>0 &&
    Number(x.weight)<Number(weight) &&
    !isLegacyRangeValue(x.reps)
  );
  const previousBest=prior.length?Math.max(...prior.map(x=>Number(x.weight))):0;
  return Number(weight)>previousBest;
}

function renderProgress(){
  const h=history(); reconcileWorkoutHistory(); const whAll=migrateWorkoutQuality(), wh=reliableWorkouts(), now=new Date();
  const reliableDates=new Set(wh.map(w=>w.date.slice(0,10)));
  const days=new Set([...reliableDates]);
  const totalVolume=wh.reduce((sum,x)=>sum+Number(x.volume||0),0);
  const reliableSeries=wh.reduce((sum,w)=>sum+Number(w.sets||0),0);
  byId('progressSummary').innerHTML=`<div class="stat"><strong>${wh.length}</strong><small>treinos válidos</small></div><div class="stat"><strong>${reliableSeries}</strong><small>séries válidas</small></div><div class="stat"><strong>${days.size}</strong><small>dias treinados</small></div><div class="stat"><strong>${Math.round(totalVolume).toLocaleString('pt-BR')}</strong><small>kg de volume</small></div>`;

  const weekAgo=Date.now()-7*86400000, monthAgo=Date.now()-30*86400000;
  const week=wh.filter(x=>new Date(x.date).getTime()>=weekAgo).length;
  const month=wh.filter(x=>new Date(x.date).getTime()>=monthAgo).length;
  byId('periodStats').innerHTML=`<div class="period-row"><span>Últimos 7 dias</span><b>${week} treino${week===1?'':'s'}</b></div><div class="period-row"><span>Últimos 30 dias</span><b>${month} treino${month===1?'':'s'}</b></div>`;
  const ignored=whAll.filter(x=>x.legacyData||x.excludedFromStats).length;
  const dq=byId('dataQuality'); if(dq) dq.innerHTML=ignored?`<div class="quality-note">ℹ ${ignored} treino${ignored===1?'':'s'} antigo${ignored===1?'':'s'} ou ignorado${ignored===1?'':'s'} não entra${ignored===1?'':'m'} na evolução.</div>`:'<div class="quality-ok">✓ Todos os treinos contabilizados são válidos.</div>';

  const reliableSets=wh.flatMap(w=>getWorkoutSets(w));
  const best={};reliableSets.forEach(x=>{
    const ex=exByName(x.exercise);
    if(Number(x.weight)>0 && !isBodyweightExercise(ex) && !isBodyweightName(x.exercise) && !isLegacyRangeValue(x.reps)){
      best[x.exercise]=Math.max(best[x.exercise]||0,Number(x.weight));
    }
  });
  const rows=Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,15);
  byId('bestLoads').innerHTML=rows.length?rows.map(([n,w])=>`<div class="best"><span>${n}</span><b>${w} kg</b></div>`).join(''):'Sem cargas registradas ainda.';
  const prs=personalRecords();
  const prBox=byId('personalRecords');
  if(prBox) prBox.innerHTML=prs.length?prs.slice(0,12).map(p=>{
    const increased=p.previous>0 && p.gain>0;
    const maintained=p.previous>0 && p.gain===0;
    return `<div class="pr-card ${increased?'pr-new':'pr-steady'}">
      <div class="pr-title-row">
        <span class="pr-medal">${increased?'🏆':'◆'}</span>
        <div class="pr-title"><b>${p.exercise}</b><small class="pr-date">${new Date(p.date).toLocaleDateString('pt-BR')}</small></div>
      </div>
      <div class="pr-weight">${p.weight} kg</div>
      <div class="pr-meta">${
        increased
          ? `Anterior: ${p.previous} kg <span>→</span> Atual: ${p.weight} kg <strong>+${p.gain.toFixed(p.gain%1?1:0)} kg (+${p.pct.toFixed(1)}%)</strong>`
          : maintained
            ? `Recorde mantido: <strong>${p.weight} kg</strong>`
            : 'Primeiro recorde válido registrado'
      }</div>
    </div>`;
  }).join(''):'<p class="muted">Registre cargas para criar seus recordes pessoais.</p>';

  const recent=wh.slice(0,8).reverse();
  const maxVol=Math.max(1,...recent.map(x=>Number(x.volume||0)));
  byId('volumeChart').innerHTML=recent.length?recent.map(x=>{
    const pct=Math.max(4,Math.round(Number(x.volume||0)/maxVol*100));
    return `<div class="chart-row"><span>${String(x.plan).split('—')[0].trim()}</span><div class="bar-track"><i style="width:${pct}%"></i></div><b>${Math.round(Number(x.volume||0)).toLocaleString('pt-BR')} kg</b></div>`;
  }).join(''):'<p class="muted">Conclua treinos para gerar o gráfico.</p>';

  const avulsos=standaloneSets().filter(x=>Number(x.weight)>0 && !isBodyweightName(x.exercise));
  const avBox=byId('standaloneRecords');
  if(avBox){
    avBox.innerHTML=avulsos.length?avulsos.slice(0,10).map(x=>{
      const dt=new Date(x.date);
      return `<div class="standalone-card">
        <b>${x.exercise}</b>
        <span>${x.weight} kg × ${x.reps} reps</span>
        <small>${dt.toLocaleDateString('pt-BR')} • ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>
      </div>`;
    }).join(''):'<p class="muted">Nenhum registro avulso.</p>';
  }

  const names=[...new Set(reliableSets.filter(x=>
    Number(x.weight)>0 &&
    !isBodyweightExercise(exByName(x.exercise)) &&
    !isBodyweightName(x.exercise) &&
    !isLegacyRangeValue(x.reps)
  ).map(x=>x.exercise))].sort();
  const sel=byId('progressExercise');
  sel.innerHTML=names.length?names.map(n=>`<option value="${n.replaceAll('"','&quot;')}">${n}</option>`).join(''):'<option>Sem dados</option>';
  if(names.length) renderExerciseProgress(names[0]); else byId('exerciseProgressChart').innerHTML='<p class="muted">Registre cargas para acompanhar a evolução.</p>';
}
function renderExerciseProgress(name){
  const pts=validTrainingSets()
    .filter(x=>x.exercise===name&&Number(x.weight)>0&&!isLegacyRangeValue(x.reps))
    .slice()
    .sort((a,b)=>new Date(a.date)-new Date(b.date));

  const daily={};
  pts.forEach(x=>{
    const d=x.date.slice(0,10);
    daily[d]=Math.max(daily[d]||0,Number(x.weight));
  });
  const entries=Object.entries(daily).slice(-12);
  const box=byId('exerciseProgressChart');
  if(!entries.length){
    box.innerHTML='<p class="muted">Sem dados para este exercício.</p>';
    return;
  }

  const first=entries[0][1], last=entries[entries.length-1][1];
  const diff=last-first;
  const pct=first>0?diff/first*100:0;
  const max=Math.max(...entries.map(x=>x[1]),1);

  const summary=entries.length>1
    ? `<div class="exercise-summary">
        <div><span>Primeira carga</span><b>${first} kg</b></div>
        <div><span>Melhor atual</span><b>${last} kg</b></div>
        <div class="${diff>0?'gain-positive':diff<0?'gain-negative':'gain-neutral'}">
          <span>Evolução</span><b>${diff>0?'+':''}${diff} kg • ${diff>0?'+':''}${pct.toFixed(1)}%</b>
        </div>
      </div>`
    : `<div class="exercise-summary one"><div><span>Primeiro registro</span><b class="summary-value">${last} kg</b></div></div>`;

  const timeline=`<div class="progress-timeline">${entries.map(([d,w],i)=>{
    const prev=i?entries[i-1][1]:null;
    const delta=prev===null?null:w-prev;
    return `<div class="progress-point">
      <div class="progress-date">${new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</div>
      <div class="progress-track"><i style="width:${Math.max(6,Math.round(w/max*100))}%"></i></div>
      <div class="progress-value"><b>${w} kg</b>${delta===null?'':`<small class="${delta>0?'up':delta<0?'down':'same'}">${delta>0?'+':''}${delta} kg</small>`}</div>
    </div>`;
  }).join('')}</div>`;

  box.innerHTML=summary+timeline;
}
function renderStretch(){
  const list=DATA.exercises.filter(x=>x.group==="Alongamento");
  byId('stretchList').innerHTML=list.map(x=>`<button class="rowbtn" onclick="openExercise(${x.id})"><b>${x.name}</b><span>${x.muscle} • ${x.reps}</span></button>`).join('');
}
function exportHistory(){
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),version:'v37',history:history(),workouts:migrateWorkoutQuality()},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='treino-2cia-backup.json';a.click();URL.revokeObjectURL(a.href);
}
function importHistory(ev){
  const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!Array.isArray(o.history))throw 0;saveHistory(o.history);if(Array.isArray(o.workouts))saveWorkoutHistory(o.workouts);alert('Backup importado com sucesso.');renderHistory()}catch(e){alert('Arquivo de backup inválido.')}};r.readAsText(f)
}
function clearData(){if(confirm('Apagar todo o histórico deste celular?')){localStorage.removeItem('t2_history');localStorage.removeItem('t2_workouts');localStorage.removeItem('t2_active_plan');localStorage.removeItem('t2_last');updateLast();alert('Histórico apagado.')}}
function copyCurrentBase(){navigator.clipboard?.writeText(location.origin+location.pathname).then(()=>alert('Endereço copiado.')).catch(()=>alert(location.origin+location.pathname))}
reconcileWorkoutHistory();
migrateWorkoutQuality();
updateLast();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
const params=new URLSearchParams(location.search);const direct=Number(params.get('exercise'));if(direct)setTimeout(()=>openExercise(direct),50);

window.addEventListener('load',()=>setTimeout(()=>document.getElementById('splash')?.classList.add('hide'),700));

localStorage.setItem('t2_app_version','v37.0');



/* ===== V35 — TREINOS PERSONALIZADOS ===== */
const CUSTOM_WORKOUTS_KEY='t2_custom_workouts';
let customBuilderSelected=[];
let customBuilderEditingId=null;

function getCustomWorkouts(){
  try{
    const x=JSON.parse(localStorage.getItem(CUSTOM_WORKOUTS_KEY)||'[]');
    return Array.isArray(x)?x:[];
  }catch(e){ return []; }
}
function saveCustomWorkouts(list){
  localStorage.setItem(CUSTOM_WORKOUTS_KEY,JSON.stringify(list));
}
function customWorkoutById(id){
  return getCustomWorkouts().find(x=>x.id===id);
}
function customWorkoutExercise(name){
  return DATA.exercises.find(x=>x.name===name);
}

function renderPlansWithCustom(){
  const customBox=byId('customPlanList');
  if(!customBox) return;
  const list=getCustomWorkouts();
  if(!list.length){
    customBox.innerHTML='<div class="custom-empty">Você ainda não criou nenhum treino personalizado.</div>';
    return;
  }
  customBox.innerHTML=list.map(w=>`
    <div class="custom-plan-card">
      <button class="custom-plan-open" onclick="openCustomPlan('${w.id}')">
        <b>${escapeCustomHtml(w.name)}</b>
        <span>${w.exercises.length} exercícios</span>
      </button>
      <div class="custom-plan-actions">
        <button onclick="editCustomWorkout('${w.id}')" aria-label="Editar ${escapeCustomHtml(w.name)}">✎</button>
        <button class="danger-mini" onclick="deleteCustomWorkout('${w.id}')" aria-label="Excluir ${escapeCustomHtml(w.name)}">×</button>
      </div>
    </div>
  `).join('');
}
function escapeCustomHtml(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function openCustomPlan(id){
  const w=customWorkoutById(id);
  if(!w){ alert('Treino personalizado não encontrado.'); return; }

  activePlanName='Personalizado — '+w.name;
  activePlanExercises=w.exercises.map(customWorkoutExercise).filter(Boolean);
  activePlanIndex=-1;
  currentListMode='plan';

  if(!activePlanExercises.length){
    alert('Este treino não possui exercícios disponíveis.');
    return;
  }

  byId('listTitle').textContent=w.name;
  renderExerciseButtons(activePlanExercises);

  const startBox=byId('planStartBox');
  if(startBox){
    startBox.innerHTML=`
      <button class="big red plan-start" onclick="startPlanWorkout()">▶ INICIAR TREINO</button>
      <small>${activePlanExercises.length} exercícios • treino personalizado</small>`;
  }
  showView('list');
}

function openCustomBuilder(id=null){
  customBuilderEditingId=id;
  const saved=id?customWorkoutById(id):null;
  customBuilderSelected=saved?[...saved.exercises]:[];

  const name=byId('customWorkoutName');
  if(name) name.value=saved?saved.name:'';

  const title=byId('customBuilderTitle');
  if(title) title.textContent=saved?'Editar treino':'Montar meu treino';

  renderCustomBuilder();
  showView('customBuilder');
}

function renderCustomBuilder(){
  const groups=[...new Set(DATA.exercises.map(x=>x.group))]
    .filter(g=>g!=='Alongamento');

  const library=byId('customExerciseLibrary');
  if(library){
    library.innerHTML=groups.map(g=>{
      const exercises=DATA.exercises.filter(x=>x.group===g);
      return `
        <div class="builder-group">
          <div class="builder-group-title">${escapeCustomHtml(g)}</div>
          ${exercises.map(ex=>{
            const selected=customBuilderSelected.includes(ex.name);
            return `
              <button type="button"
                class="builder-exercise ${selected?'selected':''}"
                onclick="toggleCustomExercise(${JSON.stringify(ex.name).replace(/"/g,'&quot;')})">
                <span class="builder-check">${selected?'✓':'+'}</span>
                <span><b>${escapeCustomHtml(ex.name)}</b><small>${ex.sets} séries • ${escapeCustomHtml(ex.reps)}</small></span>
              </button>`;
          }).join('')}
        </div>`;
    }).join('');
  }

  const selected=byId('customSelectedExercises');
  const count=byId('customSelectedCount');
  if(count) count.textContent=`${customBuilderSelected.length} selecionado${customBuilderSelected.length===1?'':'s'}`;

  if(selected){
    selected.innerHTML=customBuilderSelected.length
      ? customBuilderSelected.map((name,i)=>`
          <div class="selected-exercise-row">
            <span class="selected-order">${i+1}</span>
            <span class="selected-name">${escapeCustomHtml(name)}</span>
            <div class="selected-move">
              <button ${i===0?'disabled':''} onclick="moveCustomExercise(${i},-1)">↑</button>
              <button ${i===customBuilderSelected.length-1?'disabled':''} onclick="moveCustomExercise(${i},1)">↓</button>
              <button class="remove" onclick="removeCustomExercise(${i})">×</button>
            </div>
          </div>`).join('')
      : '<div class="custom-empty">Escolha os exercícios na biblioteca abaixo.</div>';
  }
}

function toggleCustomExercise(name){
  const i=customBuilderSelected.indexOf(name);
  if(i>=0) customBuilderSelected.splice(i,1);
  else customBuilderSelected.push(name);
  renderCustomBuilder();
}
function removeCustomExercise(i){
  customBuilderSelected.splice(i,1);
  renderCustomBuilder();
}
function moveCustomExercise(i,dir){
  const j=i+dir;
  if(j<0||j>=customBuilderSelected.length) return;
  [customBuilderSelected[i],customBuilderSelected[j]]=[customBuilderSelected[j],customBuilderSelected[i]];
  renderCustomBuilder();
}
function saveCustomWorkout(){
  const name=(byId('customWorkoutName')?.value||'').trim();
  if(!name){
    alert('Digite um nome para o treino.');
    byId('customWorkoutName')?.focus();
    return;
  }
  if(!customBuilderSelected.length){
    alert('Escolha pelo menos um exercício.');
    return;
  }

  const list=getCustomWorkouts();
  if(customBuilderEditingId){
    const i=list.findIndex(x=>x.id===customBuilderEditingId);
    if(i>=0){
      list[i]={...list[i],name,exercises:[...customBuilderSelected],updatedAt:new Date().toISOString()};
    }
  }else{
    list.unshift({
      id:'cw_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),
      name,
      exercises:[...customBuilderSelected],
      createdAt:new Date().toISOString()
    });
  }
  saveCustomWorkouts(list);
  customBuilderEditingId=null;
  customBuilderSelected=[];
  openPlans();
}
function editCustomWorkout(id){
  openCustomBuilder(id);
}
function deleteCustomWorkout(id){
  const w=customWorkoutById(id);
  if(!w) return;
  if(!confirm(`Excluir o treino "${w.name}"?`)) return;
  saveCustomWorkouts(getCustomWorkouts().filter(x=>x.id!==id));
  renderPlansWithCustom();
}




/* ===== V47 — RESTAURA A MESMA TELA APÓS ATUALIZAR ===== */
function restorePlanContext(state){
  activePlanName=state.activePlanName||'';
  activePlanIndex=Number.isInteger(state.activePlanIndex)?state.activePlanIndex:-1;
  workoutStartedAt=state.workoutStartedAt||null;

  if(activePlanName && DATA.plans[activePlanName]){
    activePlanExercises=DATA.plans[activePlanName].map(exByName).filter(Boolean);
    return true;
  }

  if(activePlanName.startsWith('Personalizado — ')){
    const customName=activePlanName.replace(/^Personalizado — /,'');
    const w=getCustomWorkouts().find(x=>x.name===customName);
    if(w){
      activePlanExercises=w.exercises.map(customWorkoutExercise).filter(Boolean);
      return true;
    }
  }

  activePlanExercises=[];
  return false;
}

function restoreNavigationState(){
  if(!cloudSession?.token)return;
  let state=null;
  try{state=JSON.parse(localStorage.getItem(NAV_STATE_KEY)||'null')}catch(e){}
  if(!state || state.matricula!==cloudSession.matricula)return;

  navRestoring=true;
  try{
    currentGroup=state.currentGroup||'';
    currentListMode=state.currentListMode||'group';
    currentSet=Math.max(1,Number(state.currentSet)||1);
    navHistoryIndex=Number.isInteger(state.historyIndex)?state.historyIndex:null;
    restorePlanContext(state);

    switch(state.view){
      case 'plans':
        openPlans();
        break;
      case 'groups':
        openGroups();
        break;
      case 'list':
        if(state.currentListMode==='plan' && state.activePlanName){
          if(state.activePlanName.startsWith('Personalizado — ')){
            const customName=state.activePlanName.replace(/^Personalizado — /,'');
            const w=getCustomWorkouts().find(x=>x.name===customName);
            if(w) openCustomPlan(w.id); else openPlans();
          }else if(DATA.plans[state.activePlanName]){
            openPlan(state.activePlanName);
          }else{
            openPlans();
          }
        }else if(state.currentGroup){
          openGroup(state.currentGroup);
        }else{
          openGroups();
        }
        break;
      case 'exercise':
        if(state.currentExerciseId!=null){
          const inPlan=!!state.activePlanName && state.activePlanIndex>=0;
          openExercise(state.currentExerciseId,inPlan);
          currentSet=Math.max(1,Number(state.currentSet)||1);
          if(currentExercise){
            const finished=currentSet>currentExercise.sets;
            byId('setLabel').textContent=finished
              ? `Série ${currentExercise.sets} de ${currentExercise.sets}`
              : `Série ${currentSet} de ${currentExercise.sets}`;
          }
        }else showView('home');
        break;
      case 'history':
        renderHistory();
        showView('history');
        if(navHistoryIndex!==null) openWorkoutHistory(navHistoryIndex);
        break;
      case 'progress':
        showView('progress');
        renderProgress();
        break;
      case 'stretch':
        showView('stretch');
        renderStretch();
        break;
      case 'tools':
        showView('tools');
        break;
      case 'customBuilder':
        openCustomBuilder(state.customBuilderEditingId||null);
        break;
      case 'workoutDone':
        renderHistory();
        showView('history');
        break;
      case 'home':
      default:
        showView('home');
        break;
    }

    requestAnimationFrame(()=>window.scrollTo({top:Number(state.scrollY)||0,behavior:'auto'}));
  }catch(e){
    console.warn('Não foi possível restaurar a tela anterior:',e);
    showView('home');
  }finally{
    navRestoring=false;
    saveNavigationState(document.querySelector('.view.active')?.id||'home');
  }
}

window.addEventListener('beforeunload',()=>{
  const active=document.querySelector('.view.active')?.id||'home';
  try{
    const s=navStateSnapshot(active);
    s.scrollY=window.scrollY||0;
    localStorage.setItem(NAV_STATE_KEY,JSON.stringify(s));
  }catch(e){}
});

/* ===== V41 — ACESSO INDIVIDUAL POR MATRÍCULA / SUPABASE ===== */
const CLOUD_SESSION_KEY='t2_matricula_session_v41';
const CLOUD_TRACKED_KEYS=['t2_history','t2_workouts','t2_active_plan','t2_last','t2_custom_workouts'];
let cloudSession=null, cloudApplying=false, cloudSyncTimer=null;
const _t2SetItem=Storage.prototype.setItem;
const _t2RemoveItem=Storage.prototype.removeItem;

Storage.prototype.setItem=function(k,v){
  _t2SetItem.call(this,k,v);
  if(this===localStorage && CLOUD_TRACKED_KEYS.includes(k) && !cloudApplying) cloudScheduleSync();
};
Storage.prototype.removeItem=function(k){
  _t2RemoveItem.call(this,k);
  if(this===localStorage && CLOUD_TRACKED_KEYS.includes(k) && !cloudApplying) cloudScheduleSync();
};

function cloudCfg(){ return window.T2_CLOUD_CONFIG||{}; }
function cloudConfigured(){
  const c=cloudCfg();
  return !!(c.enabled && c.supabaseUrl && (c.publishableKey || c.anonKey));
}
async function cloudApi(path,options={}){
  const c=cloudCfg();
  const key=c.publishableKey || c.anonKey;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    return await fetch(c.supabaseUrl.replace(/\/$/,'')+path,{
      ...options,
      signal:controller.signal,
      headers:Object.assign({
        apikey:key,
        Authorization:'Bearer '+key,
        'Content-Type':'application/json'
      },options.headers||{})
    });
  }finally{
    clearTimeout(timeout);
  }
}
async function cloudRpc(fn,payload={}){
  const r=await cloudApi('/rest/v1/rpc/'+fn,{method:'POST',body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>null);
  if(!r.ok) throw new Error((data&&(data.message||data.details||data.hint))||'Falha no servidor');
  return Array.isArray(data)?data[0]:data;
}
function cloudNormalize(v){ return String(v||'').trim().replace(/\s+/g,'').toUpperCase(); }
function cloudMask(v){ const s=String(v||''); return s.length<=4?s:'••••'+s.slice(-4); }
function cloudMsg(t,type=''){ const e=document.getElementById('authMessage'); if(e){e.textContent=t||'';e.className='auth-message '+type;} }
function cloudShowGate(){ document.body.classList.add('auth-locked'); document.getElementById('authGate')?.classList.add('show'); }
function cloudHideGate(){
  document.body.classList.remove('auth-locked');
  document.getElementById('authGate')?.classList.remove('show');
  cloudRenderUser();
  setTimeout(restoreNavigationState,0);
}
function cloudSaveSession(s){
  cloudSession=s||null;
  if(s) _t2SetItem.call(localStorage,CLOUD_SESSION_KEY,JSON.stringify(s));
  else _t2RemoveItem.call(localStorage,CLOUD_SESSION_KEY);
  cloudRenderUser();
}
function cloudLoadSession(){
  try{ const s=JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null'); cloudSession=s?.token?s:null; }
  catch(e){ cloudSession=null; }
}
function cloudRenderUser(){
  const bar=document.getElementById('cloudUserBar');
  if(!bar)return;
  if(!cloudSession?.token){bar.style.display='none';return;}
  bar.style.display='flex';
  document.getElementById('cloudUserName').textContent=cloudSession.nome||'Militar';
  document.getElementById('cloudUserGraduacao').textContent=cloudSession.graduacao||'Militar';
  document.getElementById('cloudUserMatricula').textContent='Matrícula '+cloudMask(cloudSession.matricula);
  document.getElementById('cloudUserStatus').textContent=navigator.onLine?'Sincronizado':'Offline';
}
function cloudSnapshot(){
  let active=null;
  try{active=JSON.parse(localStorage.getItem('t2_active_plan')||'null')}catch(e){}
  return {
    history:history(),
    workouts:workoutHistory(),
    customWorkouts:typeof getCustomWorkouts==='function'?getCustomWorkouts():[],
    activePlan:active,
    last:localStorage.getItem('t2_last')||'',
    savedAt:new Date().toISOString()
  };
}
function cloudMergeArray(a,b){
  const out=[],seen=new Set();
  [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].forEach(x=>{
    let k;
    try{k=x?.id||x?.workoutId||x?.sessionId||[x?.date,x?.finishedAt,x?.exercise,x?.exerciseName,x?.weight,x?.reps,x?.set].join('|')||JSON.stringify(x)}
    catch(e){k=JSON.stringify(x)}
    if(!seen.has(k)){seen.add(k);out.push(x)}
  });
  return out;
}
function cloudMergeCustom(a,b){
  const m=new Map();
  [...(Array.isArray(b)?b:[]),...(Array.isArray(a)?a:[])].forEach(x=>{const k=x?.id||x?.name;if(k)m.set(k,x)});
  return [...m.values()];
}
function cloudMerge(local,remote={}){
  return {
    history:cloudMergeArray(local.history,remote.history),
    workouts:cloudMergeArray(local.workouts,remote.workouts),
    customWorkouts:cloudMergeCustom(local.customWorkouts,remote.customWorkouts),
    activePlan:local.activePlan||remote.activePlan||null,
    last:local.last||remote.last||'',
    savedAt:new Date().toISOString()
  };
}
function cloudApply(d){
  cloudApplying=true;
  try{
    _t2SetItem.call(localStorage,'t2_history',JSON.stringify(d.history||[]));
    _t2SetItem.call(localStorage,'t2_workouts',JSON.stringify(d.workouts||[]));
    _t2SetItem.call(localStorage,'t2_custom_workouts',JSON.stringify(d.customWorkouts||[]));
    if(d.activePlan)_t2SetItem.call(localStorage,'t2_active_plan',JSON.stringify(d.activePlan)); else _t2RemoveItem.call(localStorage,'t2_active_plan');
    if(d.last)_t2SetItem.call(localStorage,'t2_last',d.last); else _t2RemoveItem.call(localStorage,'t2_last');
  }finally{cloudApplying=false}
  try{reconcileWorkoutHistory();migrateWorkoutQuality();updateLast()}catch(e){}
}
async function cloudLogin(){
  const matricula=cloudNormalize(document.getElementById('loginMatricula')?.value);
  if(!matricula){cloudMsg('Informe sua matrícula.','error');return;}
  cloudMsg('Verificando matrícula…');
  try{
    const row=await cloudRpc('entrar_por_matricula',{p_matricula:matricula});
    if(!row?.autorizado||!row?.token){cloudMsg('Matrícula não autorizada. Procure o administrador.','error');return;}
    cloudSaveSession({token:row.token,matricula:row.matricula||matricula,nome:row.nome||'Militar',graduacao:row.graduacao||''});
    await cloudInitialSync();
    cloudMsg('');
    cloudHideGate();
  }catch(e){
    console.error(e);
    if(e && e.name==='AbortError') cloudMsg('O Supabase demorou para responder. Tente novamente.','error');
    else cloudMsg('Não foi possível acessar. Verifique sua conexão e tente novamente.','error');
  }
}
async function cloudValidate(){
  if(!cloudSession?.token)return false;
  if(!navigator.onLine)return null;
  try{
    const row=await cloudRpc('validar_sessao_matricula',{p_token:cloudSession.token});
    if(row?.valido===false)return false;
    if(!row || row?.valido!==true)return null;
    cloudSession.nome=row.nome||cloudSession.nome;
    cloudSession.graduacao=row.graduacao||cloudSession.graduacao;
    cloudSession.matricula=row.matricula||cloudSession.matricula;
    cloudSaveSession(cloudSession);
    return true;
  }catch(e){
    console.warn('Falha temporária ao validar sessão:',e);
    return null;
  }
}
async function cloudInitialSync(){
  if(!navigator.onLine||!cloudSession?.token)return;
  try{
    const remoteRow=await cloudRpc('ler_dados_matricula',{p_token:cloudSession.token});
    if(!remoteRow?.autorizado)throw new Error('Sessão inválida');
    const merged=cloudMerge(cloudSnapshot(),remoteRow.dados||{});
    cloudApply(merged);
    await cloudRpc('salvar_dados_matricula',{p_token:cloudSession.token,p_dados:merged});
    document.getElementById('cloudUserStatus').textContent='Sincronizado';
  }catch(e){console.warn(e);const s=document.getElementById('cloudUserStatus');if(s)s.textContent='Pendente';}
}
function cloudScheduleSync(){
  if(!cloudConfigured()||!cloudSession?.token||cloudApplying||!navigator.onLine)return;
  clearTimeout(cloudSyncTimer);
  const s=document.getElementById('cloudUserStatus');if(s)s.textContent='Salvando…';
  cloudSyncTimer=setTimeout(cloudPushNow,1200);
}
async function cloudPushNow(){
  if(!cloudSession?.token||!navigator.onLine)return;
  const status=document.getElementById('cloudUserStatus');
  try{
    const result=await cloudRpc('salvar_dados_matricula',{
      p_token:cloudSession.token,
      p_dados:cloudSnapshot()
    });

    // Só encerra o acesso quando o Supabase disser explicitamente
    // que a sessão/matrícula não está autorizada.
    if(result?.salvo===false){
      const validity=await cloudValidate();
      if(validity===false){
        cloudSaveSession(null);
        cloudShowGate();
        cloudMsg('Matrícula inativa ou acesso encerrado. Procure o administrador.','error');
        return;
      }
      if(status)status.textContent='Pendente';
      return;
    }

    if(status)status.textContent='Sincronizado';
  }catch(e){
    console.warn('Falha temporária de sincronização:',e);
    // Importante: não faz logout por erro de rede/RPC.
    if(status)status.textContent='Pendente';
  }
}
async function cloudLogout(){
  if(!confirm('Sair deste acesso neste aparelho?'))return;
  try{if(cloudSession?.token&&navigator.onLine)await cloudRpc('sair_sessao_matricula',{p_token:cloudSession.token});}catch(e){}
  clearNavigationState();
  cloudSaveSession(null);cloudMsg('');cloudShowGate();
}
async function cloudInit(){
  cloudLoadSession();

  if(!cloudConfigured()){
    cloudShowGate();
    cloudMsg('Configuração da nuvem ausente.','error');
    return;
  }

  if(cloudSession?.token){
    // Mantém a sessão local quando estiver offline.
    if(!navigator.onLine){
      cloudHideGate();
      return;
    }

    const validity=await cloudValidate();

    if(validity===true){
      await cloudInitialSync();
      cloudHideGate();
      return;
    }

    // Falha temporária de rede/RPC: mantém o militar dentro do app.
    if(validity===null){
      cloudHideGate();
      const status=document.getElementById('cloudUserStatus');
      if(status)status.textContent='Pendente';
      return;
    }

    // Somente uma invalidação explícita apaga a sessão.
    if(validity===false){
      cloudSaveSession(null);
      cloudShowGate();
      cloudMsg('Matrícula inativa ou acesso encerrado.','error');
      return;
    }
  }

  cloudShowGate();
}
window.addEventListener('online',async()=>{
  cloudRenderUser();
  if(!cloudSession?.token)return;
  const validity=await cloudValidate();
  if(validity===false){
    cloudSaveSession(null);
    cloudShowGate();
    cloudMsg('Matrícula inativa ou acesso encerrado.','error');
    return;
  }
  if(validity===true)await cloudInitialSync();
});
window.addEventListener('offline',cloudRenderUser);
window.addEventListener('load',()=>setTimeout(cloudInit,700));

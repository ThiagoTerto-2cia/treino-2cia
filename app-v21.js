
const DATA=window.APP_DATA;
let currentGroup="", currentListMode="group", currentExercise=null, currentSet=1, timer=90, tick=null;
let activePlanName="", activePlanExercises=[], activePlanIndex=-1, workoutStartedAt=null;

const byId=id=>document.getElementById(id);
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));byId(id).classList.add('active');scrollTo({top:0,behavior:'smooth'})}
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
  if(sets.some(x=>isLegacyRangeValue(x.reps))) reasons.push('repetições antigas em faixa');
  const seen=new Set();
  let duplicate=false;
  sets.forEach(x=>{
    const key=`${normText(x.exercise)}|${x.set}`;
    if(seen.has(key)) duplicate=true;
    seen.add(key);
  });
  if(duplicate) reasons.push('séries duplicadas');
  if(sets.some(x=>isBodyweightName(x.exercise) && Number(x.weight||0)>0)) reasons.push('carga corporal registrada como carga externa');
  return {legacy:reasons.length>0,reasons};
}
function migrateWorkoutQuality(){
  const wh=workoutHistory();
  let changed=false;
  wh.forEach(w=>{
    const q=workoutQuality(w);
    if(q.legacy && !w.legacyData){w.legacyData=true;changed=true}
    const rs=q.reasons.join(' • ');
    if(rs && w.qualityReason!==rs){w.qualityReason=rs;changed=true}
    if(w.excludedFromStats==null){w.excludedFromStats=false;changed=true}
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
    // Fallback for older records: use the previous completed workout as lower bound.
    const wh=workoutHistory();
    const idx=wh.findIndex(x=>x.date===w.date && x.plan===w.plan);
    if(idx>=0 && wh[idx+1]) start=new Date(wh[idx+1].date).getTime()+1;
    else start=end-6*60*60*1000;
  }
  return all.filter(x=>{
    const t=new Date(x.date).getTime();
    return x.plan===w.plan && t>=start && t<=end;
  });
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
    'Rosca alternada':'rosca-alternada',
    'Rosca alternada (halteres)':'rosca-alternada',
    'Rosca martelo':'rosca-martelo',
    'Rosca concentrada':'rosca-concentrada'
  };
  const realisticKey=realisticByName[currentExercise.name];
  const hasRealistic=!!realisticKey;
  const imgStart=byId('imgStart'), imgEnd=byId('imgEnd');
  imgStart.classList.toggle('realistic-exercise',hasRealistic);
  imgEnd.classList.toggle('realistic-exercise',hasRealistic);
  imgStart.onerror=()=>{imgStart.onerror=null;imgStart.src=`assets/exercises/${currentExercise.id}-inicio.svg`;imgStart.classList.remove('realistic-exercise');};
  imgEnd.onerror=()=>{imgEnd.onerror=null;imgEnd.src=`assets/exercises/${currentExercise.id}-fim.svg`;imgEnd.classList.remove('realistic-exercise');};
  imgStart.src=hasRealistic?`assets/exercises/${realisticKey}-inicio.webp?v=21.0`:`assets/exercises/${currentExercise.id}-inicio.svg`;
  imgEnd.src=hasRealistic?`assets/exercises/${realisticKey}-fim.webp?v=21.0`:`assets/exercises/${currentExercise.id}-fim.svg`;
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
    byId('setLabel').textContent=`Série ${currentSet} de ${currentExercise.sets}`;
    byId('reps').value="";
    resetTimer();startTimer();
  }else{
    pauseTimer();
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
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),version:'v21',history:history(),workouts:migrateWorkoutQuality()},null,2)],{type:'application/json'});
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

localStorage.setItem('t2_app_version','v21.0');

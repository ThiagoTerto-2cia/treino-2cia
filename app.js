
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
    const repsNum=Number(x.reps)||0;
    const weightNum=Number(x.weight)||0;
    totalReps+=repsNum;
    totalVolume+=weightNum*repsNum;
    if(!by[x.exercise]) by[x.exercise]={name:x.exercise,sets:0,reps:0,volume:0,maxWeight:0};
    by[x.exercise].sets++;
    by[x.exercise].reps+=repsNum;
    by[x.exercise].volume+=weightNum*repsNum;
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
    byExercise:metrics.byExercise
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
        <div><b>${x.name}</b><small>${x.sets} séries • ${x.reps} reps</small></div>
        <span>${x.maxWeight ? `${x.maxWeight} kg máx.` : 'peso corporal'}</span>
      </div>`).join('')
    : '<div class="hist">Nenhuma série registrada.</div>';

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


function isTimedExercise(ex){
  if(!ex) return false;
  const r=String(ex.reps||'').toLowerCase();
  return /\bseg\b|\bsegundos?\b|\d+\s*s\b|prancha|isometr/i.test(r+' '+ex.name);
}
function isBodyweightExercise(ex){
  if(!ex) return false;
  const t=(ex.name+' '+ex.group+' '+ex.muscle).toLowerCase();
  return isTimedExercise(ex) || /dead bug|abdominal|crunch|prancha|alongamento|mobilidade/.test(t);
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
  byId('imgStart').src=`assets/exercises/${currentExercise.id}-inicio.svg`;
  byId('imgEnd').src=`assets/exercises/${currentExercise.id}-fim.svg`;
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
  const weight=Number(byId('weight').value||0), reps=byId('reps').value||currentExercise.reps;
  const h=history();
  h.unshift({
    date:new Date().toISOString(),group:currentExercise.group,exercise:currentExercise.name,
    set:currentSet,weight,reps,plan:activePlanIndex>=0?activePlanName:""
  });
  saveHistory(h);
  localStorage.setItem('t2_last',`${currentExercise.group} • ${currentExercise.name} • ${weight} kg • ${reps} reps`);
  updateLast();

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
  const h=history(), wh=workoutHistory();
  const detail=byId('historyDetail'); if(detail) detail.style.display='none';
  const list=byId('historyList'); if(list) list.style.display='block';
  let out='';
  if(wh.length){
    out+=`<div class="card"><h3>Treinos concluídos</h3><p class="muted">Toque em um treino para ver o resumo completo.</p>${wh.slice(0,30).map((x,i)=>`
      <button class="workout-hist workout-open" onclick="openWorkoutHistory(${i})">
        <b>${x.plan}</b>
        <span>${x.exercisesDone??x.exercises??0} exercícios • ${x.sets??0} séries • ${x.duration} min</span>
        <span>${Number(x.volume||0).toLocaleString('pt-BR')} kg de volume</span>
        <small>${new Date(x.date).toLocaleString('pt-BR')}</small>
      </button>`).join('')}</div>`;
  } else out='<div class="card">Nenhum treino concluído ainda.</div>';
  byId('historyList').innerHTML=out;
}
function openWorkoutHistory(index){
  const wh=workoutHistory(), w=wh[index]; if(!w)return;
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
    </div>
    <div class="card"><h3>Séries realizadas</h3>${rows||'<p>Sem séries detalhadas.</p>'}</div>`;
  scrollTo({top:0,behavior:'smooth'});
}
function closeWorkoutHistory(){
  byId('historyDetail').style.display='none';byId('historyList').style.display='block';scrollTo({top:0,behavior:'smooth'});
}
function renderProgress(){
  const h=history(), wh=workoutHistory(), now=new Date();
  const days=new Set(h.map(x=>x.date.slice(0,10)));
  const totalVolume=wh.reduce((sum,x)=>sum+Number(x.volume||0),0);
  byId('progressSummary').innerHTML=`<div class="stat"><strong>${wh.length}</strong><small>treinos</small></div><div class="stat"><strong>${h.length}</strong><small>séries</small></div><div class="stat"><strong>${days.size}</strong><small>dias treinados</small></div><div class="stat"><strong>${Math.round(totalVolume).toLocaleString('pt-BR')}</strong><small>kg de volume</small></div>`;

  const weekAgo=Date.now()-7*86400000, monthAgo=Date.now()-30*86400000;
  const week=wh.filter(x=>new Date(x.date).getTime()>=weekAgo).length;
  const month=wh.filter(x=>new Date(x.date).getTime()>=monthAgo).length;
  byId('periodStats').innerHTML=`<div class="period-row"><span>Últimos 7 dias</span><b>${week} treino${week===1?'':'s'}</b></div><div class="period-row"><span>Últimos 30 dias</span><b>${month} treino${month===1?'':'s'}</b></div>`;

  const best={};h.forEach(x=>{if(Number(x.weight)>0)best[x.exercise]=Math.max(best[x.exercise]||0,Number(x.weight))});
  const rows=Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,15);
  byId('bestLoads').innerHTML=rows.length?rows.map(([n,w])=>`<div class="best"><span>${n}</span><b>${w} kg</b></div>`).join(''):'Sem cargas registradas ainda.';

  const recent=wh.slice(0,8).reverse();
  const maxVol=Math.max(1,...recent.map(x=>Number(x.volume||0)));
  byId('volumeChart').innerHTML=recent.length?recent.map(x=>{
    const pct=Math.max(4,Math.round(Number(x.volume||0)/maxVol*100));
    return `<div class="chart-row"><span>${String(x.plan).split('—')[0].trim()}</span><div class="bar-track"><i style="width:${pct}%"></i></div><b>${Math.round(Number(x.volume||0)).toLocaleString('pt-BR')} kg</b></div>`;
  }).join(''):'<p class="muted">Conclua treinos para gerar o gráfico.</p>';

  const names=[...new Set(h.filter(x=>Number(x.weight)>0).map(x=>x.exercise))].sort();
  const sel=byId('progressExercise');
  sel.innerHTML=names.length?names.map(n=>`<option value="${n.replaceAll('"','&quot;')}">${n}</option>`).join(''):'<option>Sem dados</option>';
  if(names.length) renderExerciseProgress(names[0]); else byId('exerciseProgressChart').innerHTML='<p class="muted">Registre cargas para acompanhar a evolução.</p>';
}
function renderExerciseProgress(name){
  const pts=history().filter(x=>x.exercise===name&&Number(x.weight)>0).slice().reverse();
  const daily={}; pts.forEach(x=>{const d=x.date.slice(0,10);daily[d]=Math.max(daily[d]||0,Number(x.weight))});
  const entries=Object.entries(daily).slice(-10), max=Math.max(1,...entries.map(x=>x[1]));
  byId('exerciseProgressChart').innerHTML=entries.length?entries.map(([d,w])=>`
    <div class="chart-row"><span>${new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span><div class="bar-track"><i style="width:${Math.max(5,Math.round(w/max*100))}%"></i></div><b>${w} kg</b></div>`).join(''):'<p class="muted">Sem dados para este exercício.</p>';
}
function renderStretch(){
  const list=DATA.exercises.filter(x=>x.group==="Alongamento");
  byId('stretchList').innerHTML=list.map(x=>`<button class="rowbtn" onclick="openExercise(${x.id})"><b>${x.name}</b><span>${x.muscle} • ${x.reps}</span></button>`).join('');
}
function exportHistory(){
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),version:'v9',history:history(),workouts:workoutHistory()},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='treino-2cia-backup.json';a.click();URL.revokeObjectURL(a.href);
}
function importHistory(ev){
  const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!Array.isArray(o.history))throw 0;saveHistory(o.history);if(Array.isArray(o.workouts))saveWorkoutHistory(o.workouts);alert('Backup importado com sucesso.');renderHistory()}catch(e){alert('Arquivo de backup inválido.')}};r.readAsText(f)
}
function clearData(){if(confirm('Apagar todo o histórico deste celular?')){localStorage.removeItem('t2_history');localStorage.removeItem('t2_workouts');localStorage.removeItem('t2_active_plan');localStorage.removeItem('t2_last');updateLast();alert('Histórico apagado.')}}
function copyCurrentBase(){navigator.clipboard?.writeText(location.origin+location.pathname).then(()=>alert('Endereço copiado.')).catch(()=>alert(location.origin+location.pathname))}
updateLast();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
const params=new URLSearchParams(location.search);const direct=Number(params.get('exercise'));if(direct)setTimeout(()=>openExercise(direct),50);

window.addEventListener('load',()=>setTimeout(()=>document.getElementById('splash')?.classList.add('hide'),700));

localStorage.setItem('t2_app_version','v9.0');

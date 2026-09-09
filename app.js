
const DATA=window.APP_DATA;
let currentGroup="", currentListMode="group", currentExercise=null, currentSet=1, timer=90, tick=null;

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
  byId('listTitle').textContent=name;
  const list=plan.map(exByName).filter(Boolean);
  renderExerciseButtons(list);
  showView('list');
}
function goListBack(){showView(currentListMode==="plan"?"plans":"groups")}
function renderExerciseButtons(list){
  byId('exerciseList').innerHTML=list.map((x,i)=>`<button class="rowbtn" onclick="openExercise(${x.id})"><b>${i+1}. ${x.name}</b><span>${x.sets} séries • ${x.reps} • descanso ${x.rest}s</span></button>`).join('');
}
function openExercise(id){
  currentExercise=DATA.exercises.find(x=>x.id===id); if(!currentExercise)return;
  currentGroup=currentExercise.group;currentSet=1;timer=currentExercise.rest;pauseTimer();
  byId('exTitle').textContent=currentExercise.name;
  byId('imgStart').src=`assets/exercises/${currentExercise.id}-inicio.svg`;
  byId('imgEnd').src=`assets/exercises/${currentExercise.id}-fim.svg`;
  byId('exMuscle').textContent=currentExercise.muscle;
  byId('exPrescription').textContent=`${currentExercise.sets} x ${currentExercise.reps}`;
  byId('exTip').textContent=currentExercise.tip;byId('exAvoid').textContent=currentExercise.avoid;
  byId('setLabel').textContent=`Série 1 de ${currentExercise.sets}`;byId('weight').value=getLastWeight(currentExercise.name)||"";
  byId('reps').value="";updateClock();showView('exercise');
}
function history(){return JSON.parse(localStorage.getItem('t2_history')||'[]')}
function saveHistory(h){localStorage.setItem('t2_history',JSON.stringify(h))}
function getLastWeight(name){const h=history().find(x=>x.exercise===name&&Number(x.weight)>0);return h?h.weight:""}
function completeSet(){
  if(!currentExercise)return;
  const weight=Number(byId('weight').value||0), reps=byId('reps').value||currentExercise.reps;
  const h=history();h.unshift({date:new Date().toISOString(),group:currentExercise.group,exercise:currentExercise.name,set:currentSet,weight,reps});
  saveHistory(h);localStorage.setItem('t2_last',`${currentExercise.group} • ${currentExercise.name} • ${weight} kg • ${reps} reps`);updateLast();
  if(currentSet<currentExercise.sets){currentSet++;byId('setLabel').textContent=`Série ${currentSet} de ${currentExercise.sets}`;resetTimer();startTimer()}else{pauseTimer();alert("Exercício concluído. Bom treino!")}
}
function updateClock(){byId('clock').textContent=`${String(Math.floor(timer/60)).padStart(2,'0')}:${String(timer%60).padStart(2,'0')}`}
function startTimer(){if(tick)return;tick=setInterval(()=>{timer=Math.max(0,timer-1);updateClock();if(timer===0){pauseTimer();if(navigator.vibrate)navigator.vibrate([250,100,250])}},1000)}
function pauseTimer(){clearInterval(tick);tick=null}
function resetTimer(){pauseTimer();timer=currentExercise?currentExercise.rest:90;updateClock()}
function updateLast(){byId('lastWorkout').textContent=localStorage.getItem('t2_last')||"Nenhum treino registrado."}
function renderHistory(){
  const h=history();byId('historyList').innerHTML=h.length?h.slice(0,100).map(x=>`<div class="hist"><b>${x.exercise}</b><br>${x.group} • Série ${x.set} • ${x.weight} kg • ${x.reps} reps<br><small>${new Date(x.date).toLocaleString('pt-BR')}</small></div>`).join(''):'<div class="card">Nenhum registro ainda.</div>'
}
function renderProgress(){
  const h=history(), days=new Set(h.map(x=>x.date.slice(0,10))), month=new Date().toISOString().slice(0,7);
  const monthDays=new Set(h.filter(x=>x.date.startsWith(month)).map(x=>x.date.slice(0,10)));
  byId('progressSummary').innerHTML=`<div class="stat"><strong>${h.length}</strong><small>séries</small></div><div class="stat"><strong>${days.size}</strong><small>dias treinados</small></div><div class="stat"><strong>${monthDays.size}</strong><small>dias no mês</small></div>`;
  const best={};h.forEach(x=>{if(Number(x.weight)>0)best[x.exercise]=Math.max(best[x.exercise]||0,Number(x.weight))});
  const rows=Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,15);
  byId('bestLoads').innerHTML=rows.length?rows.map(([n,w])=>`<div class="best"><span>${n}</span><b>${w} kg</b></div>`).join(''):'Sem cargas registradas ainda.';
}
function renderStretch(){
  const list=DATA.exercises.filter(x=>x.group==="Alongamento");
  byId('stretchList').innerHTML=list.map(x=>`<button class="rowbtn" onclick="openExercise(${x.id})"><b>${x.name}</b><span>${x.muscle} • ${x.reps}</span></button>`).join('');
}
function exportHistory(){
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),history:history()},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='treino-2cia-backup.json';a.click();URL.revokeObjectURL(a.href);
}
function importHistory(ev){
  const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!Array.isArray(o.history))throw 0;saveHistory(o.history);alert('Histórico importado com sucesso.');renderHistory()}catch(e){alert('Arquivo de backup inválido.')}};r.readAsText(f)
}
function clearData(){if(confirm('Apagar todo o histórico deste celular?')){localStorage.removeItem('t2_history');localStorage.removeItem('t2_last');updateLast();alert('Histórico apagado.')}}
function copyCurrentBase(){navigator.clipboard?.writeText(location.origin+location.pathname).then(()=>alert('Endereço copiado.')).catch(()=>alert(location.origin+location.pathname))}
updateLast();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
const params=new URLSearchParams(location.search);const direct=Number(params.get('exercise'));if(direct)setTimeout(()=>openExercise(direct),50);

window.addEventListener('load',()=>setTimeout(()=>document.getElementById('splash')?.classList.add('hide'),700));

localStorage.setItem('t2_app_version','v6.2');


const DATA=window.APP_DATA;
let currentGroup="", currentListMode="group", currentExercise=null, currentSet=1, timer=90, tick=null;
let activePlanName="", activePlanExercises=[], activePlanIndex=-1, workoutStartedAt=null;


const byId=id=>document.getElementById(id);

function footerGoHome(){
  try{ if(typeof stopExerciseMotion==='function') stopExerciseMotion(); }catch(e){}
  showView('home');
}

function footerGoTools(){
  showView('tools');
}


// V65.2 — fail-safe: nunca deixar o app preso na tela de abertura.
function releaseSplash(){
  try{document.getElementById('splash')?.classList.add('hide')}catch(e){}
}
window.addEventListener('load',()=>setTimeout(releaseSplash,700));
setTimeout(releaseSplash,2200);
window.addEventListener('error',()=>setTimeout(releaseSplash,50));
window.addEventListener('unhandledrejection',()=>setTimeout(releaseSplash,50));

const NAV_STATE_KEY='t2_nav_state_v6730_session';
const LEGACY_NAV_STATE_KEY='t2_nav_state_v47';
function navigationLoadType(){
  try{return performance.getEntriesByType('navigation')[0]?.type||'navigate'}catch(e){return 'navigate'}
}
const NAV_RESTORE_ON_BOOT = navigationLoadType()==='reload';
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
    mobilityRoutineKey: typeof mobilityRoutineKey!=='undefined' ? mobilityRoutineKey : null,
    mobilityStep: typeof mobilityStep!=='undefined' ? mobilityStep : 0,
    mobilityRemaining: typeof mobilityRemaining!=='undefined' ? mobilityRemaining : 0,
    mobilityRunning: typeof mobilityRunning!=='undefined' ? mobilityRunning : false,
    coreRoutineKey: typeof coreRoutineKey!=='undefined' ? coreRoutineKey : null,
    coreStep: typeof coreStep!=='undefined' ? coreStep : 0,
    coreRemaining: typeof coreRemaining!=='undefined' ? coreRemaining : 0,
    coreRunning: typeof coreRunning!=='undefined' ? coreRunning : false,
    officialTafEdition: typeof officialTafState!=='undefined' ? officialTafState.edition : null,
    officialTafScope: typeof officialTafState!=='undefined' ? officialTafState.scope : 'all',
    officialTafExercise: typeof officialTafState!=='undefined' ? officialTafState.exercise : 'pushup',
    serviceDay: typeof v66WorkoutServiceDay!=='undefined' ? v66WorkoutServiceDay : null,
    freeWorkoutGroups: [...document.querySelectorAll('#freeMuscleGroups .free-muscle.selected')].map(x=>x.dataset.group),
    freeWorkoutMinutes: document.getElementById('freeWorkoutMinutes')?.value || '',
    cardioMachine: typeof cardioSelectedMachine!=='undefined' ? cardioSelectedMachine : '',
    cardioMinutes: document.getElementById('cardioMinutes')?.value || '',
    cardioDistance: document.getElementById('cardioDistance')?.value || '',
    cardioCalories: document.getElementById('cardioCalories')?.value || '',
    scrollY: window.scrollY || 0,
    savedAt: Date.now()
  };
}
function saveNavigationState(viewId){
  if(navRestoring || !cloudSession?.token) return;
  try{
    sessionStorage.setItem(NAV_STATE_KEY,JSON.stringify(navStateSnapshot(viewId)));
  }catch(e){}
}
function clearNavigationState(){
  try{sessionStorage.removeItem(NAV_STATE_KEY)}catch(e){}
  try{localStorage.removeItem(LEGACY_NAV_STATE_KEY)}catch(e){}
}
let browserNavHandling=false;

function appHistorySnapshot(viewId){
  try{
    const snap=navStateSnapshot(viewId);
    return {...snap, view:viewId};
  }catch(e){
    return {view:viewId};
  }
}

function ensureAppHistoryState(){
  try{
    const active=document.querySelector('.view.active')?.id||'home';
    if(!window.history.state?.t2App){
      window.history.replaceState(
        {t2App:true,snapshot:appHistorySnapshot(active)},
        '',
        location.href
      );
    }
  }catch(e){}
}

function showView(id){
  const target=byId(id);
  if(!target)return;

  const previous=document.querySelector('.view.active')?.id||null;

  // V67.27 — antes de abrir a próxima tela, sincroniza SEMPRE a entrada
  // atual do histórico com a tela que está realmente visível. Isso é importante
  // porque algumas versões anteriores alteravam a view sem atualizar o History API.
  if(!navRestoring && !browserNavHandling && previous && previous!==id){
    try{
      window.history.replaceState(
        {t2App:true,snapshot:appHistorySnapshot(previous)},
        '',
        location.href
      );
    }catch(e){}
  }

  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  target.classList.add('active');

  if(!navRestoring)scrollTo({top:0,behavior:'smooth'});
  saveNavigationState(id);

  if(!navRestoring && !browserNavHandling && previous!==id){
    try{
      window.history.pushState(
        {t2App:true,snapshot:appHistorySnapshot(id)},
        '',
        location.href
      );
    }catch(e){}
  }
}

function appBack(fallbackView='home', fallbackAction=null){
  try{
    const active=document.querySelector('.view.active')?.id||'home';
    const st=window.history.state;
    // Mantém a entrada atual coerente com a tela visível antes de voltar.
    if(!st?.t2App || st?.snapshot?.view!==active){
      window.history.replaceState(
        {t2App:true,snapshot:appHistorySnapshot(active)},
        '',
        location.href
      );
    }
    if(window.history.length>1){
      window.history.back();
      return;
    }
  }catch(e){}
  if(typeof fallbackAction==='function'){
    fallbackAction();
    return;
  }
  showView(fallbackView);
}

window.addEventListener('popstate',(event)=>{
  if(!cloudSession?.token)return;

  const st=event.state;
  browserNavHandling=true;
  try{
    if(st?.t2App && st.snapshot){
      sessionStorage.setItem(NAV_STATE_KEY,JSON.stringify({
        ...st.snapshot,
        matricula:cloudSession.matricula
      }));
      restoreNavigationState(true);
      return;
    }

    // Fallback defensivo: se o navegador voltar para uma entrada antiga sem
    // estado do app, preserva a experiência interna em vez de deixar a tela
    // sem resposta. No próximo Voltar, o comportamento normal do sistema segue.
    const active=document.querySelector('.view.active')?.id||'home';
    if(active!=='home'){
      const snap=appHistorySnapshot('home');
      window.history.replaceState({t2App:true,snapshot:snap},'',location.href);
      sessionStorage.setItem(NAV_STATE_KEY,JSON.stringify({...snap,matricula:cloudSession.matricula}));
      restoreNavigationState(true);
    }
  }catch(e){
    console.warn('Falha ao restaurar tela pelo botão Voltar:',e);
  }finally{
    setTimeout(()=>{browserNavHandling=false},0);
  }
});


// V67.27 — inicializa o History API assim que o documento estiver pronto.
// O botão Voltar físico/gesto do Android depende de haver uma entrada real
// representando a tela inicial antes das próximas navegações internas.
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>ensureAppHistoryState(),{once:true});
}else{
  ensureAppHistoryState();
}
window.addEventListener('pageshow',()=>ensureAppHistoryState());


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


function showSavedConfirmation(onClose){
  let overlay=document.getElementById('savedConfirmOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='savedConfirmOverlay';
    overlay.className='saved-confirm-overlay';
    overlay.innerHTML=`<div class="saved-confirm-box">
      <div class="saved-confirm-check">✓</div>
      <h3>Treino salvo.</h3>
      <button type="button" id="savedConfirmOk">OK</button>
    </div>`;
    document.body.appendChild(overlay);
  }
  overlay.classList.add('show');
  const ok=document.getElementById('savedConfirmOk');
  ok.onclick=()=>{
    overlay.classList.remove('show');
    if(typeof onClose==='function')onClose();
  };
}

// V66.1 — confirmação visual universal ao salvar treino
function showWorkoutSavedMessage(){
  let el=document.getElementById('workoutSavedToast');
  if(!el){
    el=document.createElement('div');
    el.id='workoutSavedToast';
    el.className='workout-saved-toast';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    document.body.appendChild(el);
  }
  el.textContent='✓ Treino salvo.';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showWorkoutSavedMessage._t);
  showWorkoutSavedMessage._t=setTimeout(()=>el.classList.remove('show'),2400);
}

// ===== V66 — Planejamento do treino + situação de serviço =====
const V66_SERVICE_KEY='t2_workout_service_choice_v66';
const V66_FREE_GROUPS=['Peito','Costas','Ombros','Bíceps','Tríceps','Pernas','Glúteos','Core','Corpo inteiro'];
let v66WorkoutServiceDay=null;

function openWorkoutChooser(){
  v66WorkoutServiceDay=null;
  sessionStorage.removeItem(V66_SERVICE_KEY);
  updateServiceChoiceUI();
  showView('workoutChooser');
}
function setWorkoutServiceDay(value){
  v66WorkoutServiceDay=!!value;
  sessionStorage.setItem(V66_SERVICE_KEY,v66WorkoutServiceDay?'1':'0');
  updateServiceChoiceUI();
}
function updateServiceChoiceUI(){
  const y=byId('serviceYes'),n=byId('serviceNo'),h=byId('serviceChoiceHint');
  if(y)y.classList.toggle('selected',v66WorkoutServiceDay===true);
  if(n)n.classList.toggle('selected',v66WorkoutServiceDay===false);
  if(h)h.textContent=v66WorkoutServiceDay===null?'Selecione uma opção para continuar.':
    (v66WorkoutServiceDay?'Treino marcado como realizado em dia de serviço.':'Treino marcado como realizado fora do serviço.');
}
function requireServiceChoice(){
  if(v66WorkoutServiceDay===null){
    const s=sessionStorage.getItem(V66_SERVICE_KEY);
    if(s==='1'||s==='0')v66WorkoutServiceDay=s==='1';
  }
  if(v66WorkoutServiceDay===null){alert('Informe primeiro se você está de serviço hoje.');return false}
  return true;
}

function restoreWorkoutChooserV667(state){
  if(state && (state.serviceDay===true || state.serviceDay===false)){
    v66WorkoutServiceDay=state.serviceDay;
    sessionStorage.setItem(V66_SERVICE_KEY,v66WorkoutServiceDay?'1':'0');
  }else{
    const s=sessionStorage.getItem(V66_SERVICE_KEY);
    v66WorkoutServiceDay=(s==='1')?true:(s==='0'?false:null);
  }
  updateServiceChoiceUI();
  showView('workoutChooser');
}

function restoreFreeWorkoutV667(state){
  if(state && (state.serviceDay===true || state.serviceDay===false)){
    v66WorkoutServiceDay=state.serviceDay;
    sessionStorage.setItem(V66_SERVICE_KEY,v66WorkoutServiceDay?'1':'0');
  }else{
    const s=sessionStorage.getItem(V66_SERVICE_KEY);
    v66WorkoutServiceDay=(s==='1')?true:(s==='0'?false:null);
  }

  const box=byId('freeMuscleGroups');
  const selected=new Set(Array.isArray(state?.freeWorkoutGroups)?state.freeWorkoutGroups:[]);
  if(box){
    box.innerHTML=V66_FREE_GROUPS.map(g=>
      `<button type="button" class="free-muscle${selected.has(g)?' selected':''}" data-group="${g}" onclick="this.classList.toggle('selected');saveNavigationState('freeWorkout')">${g}</button>`
    ).join('');
  }

  const mins=byId('freeWorkoutMinutes');
  if(mins) mins.value=state?.freeWorkoutMinutes||'';

  const savedMsg=document.getElementById('freeWorkoutSavedMessage');
  if(savedMsg){
    savedMsg.classList.remove('show');
    savedMsg.style.display='none';
  }

  const saveBtn=document.getElementById('saveFreeWorkoutBtn');
  if(saveBtn){
    saveBtn.disabled=false;
    saveBtn.textContent='SALVAR TREINO LIVRE';
  }

  showView('freeWorkout');
}
const CARDIO_MACHINE_META={
  treadmill:{label:'Esteira',icon:'🏃'},
  bike:{label:'Bicicleta ergométrica',icon:'🚴'},
  rower:{label:'Simulador de remo',icon:'🚣'}
};
let cardioSelectedMachine='';
function isCardioRecord(w){return !!(w&&['treadmill','bike','rower'].includes(w.cardioMachine))}

function cardioResetSavedState(){
  const msg=byId('cardioSavedMessage');
  if(msg){msg.classList.remove('show');msg.style.display='none';msg.textContent='✓ Cardio salvo.'}
  const btn=byId('saveCardioWorkoutBtn');
  if(btn){btn.disabled=false;btn.textContent='SALVAR CARDIO'}
}
function cardioFormatPace(minutes,distanceKm){
  const mins=Number(minutes), km=Number(String(distanceKm??'').replace(',','.'));
  if(!Number.isFinite(mins)||mins<=0||!Number.isFinite(km)||km<=0)return '--:-- min/km';
  const totalSeconds=Math.round((mins*60)/km);
  const paceMin=Math.floor(totalSeconds/60), paceSec=totalSeconds%60;
  return `${paceMin}:${String(paceSec).padStart(2,'0')} min/km`;
}
function updateCardioPace(){
  const el=byId('cardioPace'); if(!el)return;
  el.textContent=cardioSelectedMachine==='treadmill'
    ? cardioFormatPace(byId('cardioMinutes')?.value,byId('cardioDistance')?.value)
    : '--:-- min/km';
}
function cardioBindInputs(){
  ['cardioMinutes','cardioDistance','cardioCalories'].forEach(id=>{
    const el=byId(id); if(el)el.oninput=()=>{updateCardioPace();updateCardioRankingHint();saveNavigationState('cardioWorkout')};
  });
  updateCardioPace();
}
function openCardioWorkout(){
  if(!requireServiceChoice())return;
  cardioSelectedMachine='';
  document.querySelectorAll('.cardio-machine').forEach(x=>x.classList.remove('selected'));
  const form=byId('cardioFormCard'); if(form)form.style.display='none';
  ['cardioMinutes','cardioDistance','cardioCalories'].forEach(id=>{const el=byId(id);if(el)el.value=''});
  cardioResetSavedState();
  cardioBindInputs();
  showView('cardioWorkout');
  saveNavigationState('cardioWorkout');
}
function selectCardioMachine(machine,restoring=false){
  if(!CARDIO_MACHINE_META[machine])return;
  cardioSelectedMachine=machine;
  document.querySelectorAll('.cardio-machine').forEach(x=>x.classList.toggle('selected',x.dataset.cardio===machine));
  const meta=CARDIO_MACHINE_META[machine];
  const form=byId('cardioFormCard'); if(form)form.style.display='block';
  const title=byId('cardioFormTitle'); if(title)title.textContent=`${meta.icon} ${meta.label}`;
  const treadmill=byId('cardioTreadmillFields'); if(treadmill)treadmill.style.display=machine==='treadmill'?'block':'none';
  if(machine!=='treadmill'){
    const d=byId('cardioDistance'),c=byId('cardioCalories'); if(d)d.value=''; if(c)c.value='';
  }
  cardioResetSavedState();
  cardioBindInputs();
  updateCardioPace();
  updateCardioRankingHint();
  if(!restoring){saveNavigationState('cardioWorkout');form?.scrollIntoView({behavior:'smooth',block:'start'})}
}
function updateCardioRankingHint(){
  const hint=byId('cardioRankingHint'); if(!hint)return;
  const minutes=Number(byId('cardioMinutes')?.value||0);
  if(minutes>=30){
    hint.className='cardio-ranking-hint eligible';
    hint.textContent=v66WorkoutServiceDay===true
      ? '✓ Critério de tempo atingido. O Cardio pode gerar +1 ponto se ainda não houver outro Cardio pontuado nesta validação.'
      : '✓ Critério de tempo atingido. Fora do serviço, será salvo no histórico, mas não pontua.';
  }else{
    hint.className='cardio-ranking-hint';
    hint.textContent=`Mínimo de 30 minutos para pontuar${minutes>0?` • faltam ${Math.max(0,30-minutes)} min`:'.'}`;
  }
}
function restoreCardioWorkoutV6733(state){
  if(state && (state.serviceDay===true || state.serviceDay===false)){
    v66WorkoutServiceDay=state.serviceDay;
    sessionStorage.setItem(V66_SERVICE_KEY,v66WorkoutServiceDay?'1':'0');
  }
  showView('cardioWorkout');
  cardioResetSavedState();
  cardioBindInputs();
  cardioSelectedMachine='';
  document.querySelectorAll('.cardio-machine').forEach(x=>x.classList.remove('selected'));
  const form=byId('cardioFormCard'); if(form)form.style.display='none';
  if(state?.cardioMachine && CARDIO_MACHINE_META[state.cardioMachine]){
    selectCardioMachine(state.cardioMachine,true);
    const m=byId('cardioMinutes'),d=byId('cardioDistance'),c=byId('cardioCalories');
    if(m)m.value=state.cardioMinutes||'';
    if(d)d.value=state.cardioDistance||'';
    if(c)c.value=state.cardioCalories||'';
    updateCardioPace();
    updateCardioRankingHint();
  }
}
function saveCardioWorkout(){
  if(!requireServiceChoice())return;
  const machine=cardioSelectedMachine, meta=CARDIO_MACHINE_META[machine];
  if(!meta){alert('Escolha o equipamento de cardio.');return}
  const minutes=Number(byId('cardioMinutes')?.value||0);
  if(!Number.isFinite(minutes)||minutes<1){alert('Informe o tempo da atividade em minutos.');return}
  let distance=null,calories=null;
  if(machine==='treadmill'){
    distance=Number(String(byId('cardioDistance')?.value||'').replace(',','.'));
    calories=Number(byId('cardioCalories')?.value||0);
    if(!Number.isFinite(distance)||distance<=0){alert('Informe a distância percorrida na esteira.');return}
    if(!Number.isFinite(calories)||calories<=0){alert('Informe as calorias registradas na esteira.');return}
  }
  const ended=new Date();
  const record={
    date:ended.toISOString(),startedAt:new Date(ended.getTime()-minutes*60000).toISOString(),
    plan:`Cardio — ${meta.label}`,duration:minutes,
    exercisesPlanned:0,exercisesDone:0,sets:0,reps:0,volume:0,byExercise:[],
    // Compatibilidade com o ranking em nuvem: cardio usa a estrutura de treino livre,
    // mas só recebe serviceDay=true quando atingir os 30 min exigidos.
    schemaVersion:6736,excludedFromStats:false,workoutType:'cardio',rankingCategory:'cardio',muscleGroups:['Cardio'],cardioMachine:machine,
    cardioDistanceKm:machine==='treadmill'?Math.round(distance*100)/100:null,
    cardioCalories:machine==='treadmill'?Math.round(calories):null,
    cardioPaceSecondsPerKm:machine==='treadmill'?Math.round((minutes*60)/distance):null,
    cardioEligible:minutes>=30,cardioServiceDay:v66WorkoutServiceDay===true,
    serviceDay:v66WorkoutServiceDay===true && minutes>=30,
    // V67.35 — identifica a mesma janela de validação operacional (até 24 h).
    // Isso permite contar até 2 atividades válidas dentro da mesma validação,
    // inclusive 2 cardios diferentes ou repetidos, sem depender do dia do calendário.
    serviceValidatedAt:(v66WorkoutServiceDay===true&&serviceValidationStatus?.validatedAt)||null,
    serviceExpiresAt:(v66WorkoutServiceDay===true&&serviceValidationStatus?.expiresAt)||null,
    serviceWindowKey:(v66WorkoutServiceDay===true&&serviceValidationStatus?.validatedAt)
      ? String(serviceValidationStatus.validatedAt)
      : null
  };
  const wh=workoutHistory(); wh.unshift(record); saveWorkoutHistory(wh);
  localStorage.setItem('t2_last',`${record.plan} • ${minutes} min`);
  showWorkoutSavedMessage();
  try{updateLast()}catch(e){}
  if(typeof cloudPushNow==='function'&&cloudSession?.token&&navigator.onLine)setTimeout(()=>cloudPushNow(),50);
  const msg=byId('cardioSavedMessage');
  if(msg){
    const eligible=minutes>=30&&v66WorkoutServiceDay===true;
    msg.textContent=eligible
      ? '✓ Cardio salvo. Com 30 minutos ou mais, pode gerar +1 ponto se a categoria Cardio ainda não tiver pontuado nesta validação.'
      : minutes>=30
        ? '✓ Cardio salvo. Critério de 30 minutos atingido, mas fora do serviço não gera ponto.'
        : '✓ Cardio salvo. Com menos de 30 minutos, a atividade fica no histórico, mas não gera ponto.';
    msg.style.display='block';msg.classList.add('show');msg.style.visibility='visible';msg.style.opacity='1';
  }
  const btn=byId('saveCardioWorkoutBtn'); if(btn){btn.textContent='✓ CARDIO SALVO';btn.disabled=true}
  ['cardioMinutes','cardioDistance','cardioCalories'].forEach(id=>{const el=byId(id);if(el)el.value=''});
  updateCardioRankingHint();
  requestAnimationFrame(()=>msg?.scrollIntoView({behavior:'smooth',block:'center'}));
}

function openReadyPlans(){
  if(!requireServiceChoice())return;
  openPlans('ready');
}
function openPersonalizedWorkouts(){
  if(!requireServiceChoice())return;
  openPlans('custom');
}
function openFreeWorkout(){
  if(!requireServiceChoice())return;
  const savedMsg=document.getElementById('freeWorkoutSavedMessage');
  if(savedMsg){
    savedMsg.classList.remove('show');
    savedMsg.style.display='none';
    savedMsg.textContent='✓ Treino salvo.';
  }
  const saveBtn=document.getElementById('saveFreeWorkoutBtn');
  if(saveBtn){
    saveBtn.disabled=false;
    saveBtn.textContent='SALVAR TREINO LIVRE';
  }
  const box=byId('freeMuscleGroups');
  if(box)box.innerHTML=V66_FREE_GROUPS.map(g=>`<button type="button" class="free-muscle" data-group="${g}" onclick="this.classList.toggle('selected');saveNavigationState('freeWorkout')">${g}</button>`).join('');
  const mins=byId('freeWorkoutMinutes');
  if(mins){
    mins.value='';
    mins.oninput=()=>saveNavigationState('freeWorkout');
  }
  showView('freeWorkout');
}
function saveFreeWorkout(){
  if(!requireServiceChoice())return;
  const groups=[...document.querySelectorAll('#freeMuscleGroups .free-muscle.selected')].map(x=>x.dataset.group);
  const minutes=Number(byId('freeWorkoutMinutes')?.value||0);
  if(!groups.length){alert('Selecione pelo menos um grupo muscular.');return}
  if(!Number.isFinite(minutes)||minutes<1){alert('Informe o tempo do treino em minutos.');return}
  const ended=new Date(), wh=workoutHistory();
  const record={
    date:ended.toISOString(),startedAt:new Date(ended.getTime()-minutes*60000).toISOString(),
    plan:'Treino livre — '+groups.join(' + '),duration:minutes,
    exercisesPlanned:0,exercisesDone:0,sets:0,reps:0,volume:0,byExercise:[],
    schemaVersion:663,excludedFromStats:false,workoutType:'free',muscleGroups:groups,
    serviceDay:v66WorkoutServiceDay===true
  };
  wh.unshift(record);saveWorkoutHistory(wh);
  localStorage.setItem('t2_last',`${record.plan} • ${minutes} min`);

  // V66.8: confirmação vem imediatamente após a gravação do registro.
  // Assim nenhuma atualização secundária da interface pode impedir o feedback visual.
  showWorkoutSavedMessage();

  try{ updateLast(); }catch(e){ console.warn('updateLast:',e); }
  if(typeof cloudPushNow==='function'&&cloudSession?.token&&navigator.onLine)setTimeout(()=>cloudPushNow(),50);

  // Confirmação também permanece visível dentro da própria tela.
  // Não depende de toast, alert ou troca de tela.
  const savedMsg=document.getElementById('freeWorkoutSavedMessage');
  const saveBtn=document.getElementById('saveFreeWorkoutBtn');

  if(savedMsg){
    savedMsg.textContent='✓ Treino salvo.';
    savedMsg.classList.add('show');
    savedMsg.style.display='block';
    savedMsg.style.visibility='visible';
    savedMsg.style.opacity='1';
  }

  if(saveBtn){
    saveBtn.textContent='✓ TREINO SALVO';
    saveBtn.disabled=true;
  }

  // Mantém a mesma tela e limpa apenas os campos do registro já salvo.
  document.querySelectorAll('#freeMuscleGroups .free-muscle.selected')
    .forEach(el=>el.classList.remove('selected'));
  const mins=byId('freeWorkoutMinutes');
  if(mins) mins.value='';

  // Reforça a exibição depois do repaint e também após pequenas rotinas assíncronas.
  requestAnimationFrame(()=>{
    const msg=document.getElementById('freeWorkoutSavedMessage');
    if(msg){
      msg.style.display='block';
      msg.classList.add('show');
      msg.scrollIntoView({behavior:'smooth',block:'center'});
    }
  });
  setTimeout(()=>{
    const msg=document.getElementById('freeWorkoutSavedMessage');
    if(msg){
      msg.style.display='block';
      msg.classList.add('show');
    }
  },300);
}
function v66ServiceDayForActiveWorkout(){
  if(v66WorkoutServiceDay===null){
    const s=sessionStorage.getItem(V66_SERVICE_KEY);
    if(s==='1'||s==='0')v66WorkoutServiceDay=s==='1';
  }
  return v66WorkoutServiceDay===true;
}
function openPlans(mode='all'){
  if(mode!=='all'&&!requireServiceChoice())return;
  const grid=byId('planGrid');
  const customLabel=document.querySelector('#plans .custom-label');
  const customBox=byId('customPlanList');
  const build=document.querySelector('#plans .build-workout-cta');
  const readyLabel=document.querySelector('#plans .section-label:not(.custom-label)');
  const title=byId('plansModeTitle');

  if(mode==='custom'){
    if(title)title.textContent='Treino personalizado';
    if(grid)grid.style.display='none';
    if(readyLabel)readyLabel.style.display='none';
    if(build)build.style.display='';
    if(customLabel)customLabel.style.display='';
    if(customBox)customBox.style.display='';
  }else if(mode==='ready'){
    if(title)title.textContent='Treino pronto';
    if(grid)grid.style.display='';
    if(readyLabel)readyLabel.style.display='';
    if(build)build.style.display='none';
    if(customLabel)customLabel.style.display='none';
    if(customBox)customBox.style.display='none';
  }else{
    if(title)title.textContent='Treinos';
    if(grid)grid.style.display='';
    if(readyLabel)readyLabel.style.display='';
    if(build)build.style.display='';
    if(customLabel)customLabel.style.display='';
    if(customBox)customBox.style.display='';
  }

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
  localStorage.setItem('t2_active_plan',JSON.stringify({name:activePlanName,index:0,startedAt:workoutStartedAt,serviceDay:v66ServiceDayForActiveWorkout()}));
  openExercise(activePlanExercises[0].id,true);
}
function openPlanExercise(index){
  if(!activePlanExercises[index])return;
  activePlanIndex=index;
  if(!workoutStartedAt) workoutStartedAt=new Date().toISOString();
  openExercise(activePlanExercises[index].id,true);
}
function workoutHistory(){
  try{const x=JSON.parse(localStorage.getItem('t2_workouts')||'[]');return Array.isArray(x)?x:[]}
  catch(e){console.warn('Histórico de treinos local inválido; usando lista vazia.',e);return []}
}
function saveWorkoutHistory(h){
  localStorage.setItem('t2_workouts',JSON.stringify(h));
  if(typeof cloudScheduleSync==='function') cloudScheduleSync();
}

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
    schemaVersion:663,
    workoutType: String(activePlanName||'').toLowerCase().includes('personal')?'custom':'structured',
    serviceDay:v66ServiceDayForActiveWorkout(),
    excludedFromStats:false
  };
  wh.unshift(record);
  saveWorkoutHistory(wh);
  showWorkoutSavedMessage();

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
  showSavedConfirmation();
  // Ao finalizar, envia imediatamente o treino completo para a nuvem.
  if(typeof cloudPushNow==='function' && cloudSession?.token && navigator.onLine){
    setTimeout(()=>cloudPushNow(),50);
  }

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
  // V67.35 — Cardio é um treino válido para a Evolução.
  // Ele participa das contagens de treinos/minutos/dias, mas continua fora
  // dos gráficos de carga/volume em kg, onde não faria sentido.
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
  updateClock();const skipBtn=byId('skipSetBtn');
  if(skipBtn) skipBtn.style.display=activePlanIndex>=0?'block':'none';
  showView('exercise');
}
function history(){
  try{const x=JSON.parse(localStorage.getItem('t2_history')||'[]');return Array.isArray(x)?x:[]}
  catch(e){console.warn('Histórico de séries local inválido; usando lista vazia.',e);return []}
}
function saveHistory(h){
  localStorage.setItem('t2_history',JSON.stringify(h));
  if(typeof cloudScheduleSync==='function') cloudScheduleSync();
}
function getLastWeight(name){const h=history().find(x=>x.exercise===name&&Number(x.weight)>0);return h?h.weight:""}
function skipCurrentSet(){
  if(!currentExercise || activePlanIndex<0)return;

  // Série pulada não é registrada. Portanto, não aumenta séries,
  // exercícios concluídos nem pontuação do ranking.
  if(currentSet<currentExercise.sets){
    currentSet++;
    saveNavigationState('exercise');
    byId('setLabel').textContent=`Série ${currentSet} de ${currentExercise.sets}`;
    byId('weight').value="";
    byId('reps').value="";
    resetTimer();
    startTimer();
    return;
  }

  pauseTimer();
  saveNavigationState('exercise');
  const btn=byId('nextExerciseBtn');
  byId('setLabel').innerHTML=`<span class="done-inline">↷ Série pulada</span><small>Avance para o próximo exercício ou finalize o treino</small>`;
  if(btn){
    btn.style.display='block';
    btn.textContent=activePlanIndex<activePlanExercises.length-1
      ? `PRÓXIMO EXERCÍCIO → ${activePlanExercises[activePlanIndex+1].name}`
      : 'FINALIZAR TREINO ✓';
    btn.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

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
function updateLast(){
  const el=byId('lastWorkout');
  if(el) el.textContent=localStorage.getItem('t2_last')||"Nenhum treino registrado.";
}
function cardioHistoryMeta(w){
  const meta=CARDIO_MACHINE_META[w?.cardioMachine]||{label:'Cardio',icon:'❤️'};
  const extras=[];
  if(w?.cardioMachine==='treadmill'){
    if(Number(w?.cardioDistanceKm)>0)extras.push(`${Number(w.cardioDistanceKm).toLocaleString('pt-BR',{maximumFractionDigits:2})} km`);
    const paceSec=Number(w?.cardioPaceSecondsPerKm)>0?Number(w.cardioPaceSecondsPerKm):(Number(w?.duration)>0&&Number(w?.cardioDistanceKm)>0?Math.round(Number(w.duration)*60/Number(w.cardioDistanceKm)):0);
    if(paceSec>0)extras.push(`${Math.floor(paceSec/60)}:${String(Math.round(paceSec%60)).padStart(2,'0')} min/km`);
    if(Number(w?.cardioCalories)>0)extras.push(`${Math.round(Number(w.cardioCalories))} kcal`);
  }
  return `${meta.icon} ${meta.label} • ${Number(w?.duration||0)} min${extras.length?' • '+extras.join(' • '):''}`;
}
function renderHistory(){
  const h=history(); reconcileWorkoutHistory(); const wh=migrateWorkoutQuality();
  const tafList=(typeof tafGetRecords==='function'?tafGetRecords():[]);
  const detail=byId('historyDetail'); if(detail) detail.style.display='none';
  const list=byId('historyList'); if(list) list.style.display='block';
  let out='';

  if(wh.length){
    out+=`<div class="card"><h3>Treinos concluídos</h3><p class="muted">Toque em um treino para ver o resumo completo.</p>${wh.slice(0,30).map((x,i)=>`
      <button class="workout-hist workout-open" onclick="openWorkoutHistory(${i})">
        <b>${x.plan}</b>
        <span>${isCardioRecord(x)
          ? cardioHistoryMeta(x)
          : x.workoutType==='free'
            ? `${(x.muscleGroups||[]).join(' • ')||'Treino livre'} • ${x.duration} min`
            : `${x.exercisesDone??x.exercises??0} exercícios • ${x.sets??0} séries • ${x.duration} min`}</span>
        <span>${isCardioRecord(x)
          ? `${x.cardioServiceDay===true?'🚒 Serviço':'🏠 Fora do serviço'} • ${Number(x.duration||0)>=30?'mínimo de 30 min atingido':'menos de 30 min — não pontua'}`
          : x.workoutType==='free'
            ? (x.serviceDay===true?'🚒 Realizado em dia de serviço':'🏠 Realizado fora do serviço')
            : (x.legacyData?'Registro antigo — fora da evolução':(x.excludedFromStats?'Ignorado na evolução':Number(x.volume||0).toLocaleString('pt-BR')+' kg de volume'))}</span>
        <small>${new Date(x.date).toLocaleString('pt-BR')}</small>
      </button>`).join('')}</div>`;
  } else {
    out+='<div class="card">Nenhum treino concluído ainda.</div>';
  }

  out+=`<div class="card history-taf-card">
    <div class="history-taf-title">
      <div><span class="eyebrow">MEU TAF</span><h3>Histórico de TAF</h3></div>
      <span class="history-taf-count">${tafList.length} ${tafList.length===1?'registro':'registros'}</span>
    </div>
    ${tafList.length
      ? tafList.slice(0,30).map(r=>{
          const max=r.mode==='4'?40:30;
          const d=new Date((r.date||'')+'T12:00:00');
          const dateText=Number.isNaN(d.getTime())?String(r.date||''):d.toLocaleDateString('pt-BR');
          return `<div class="history-taf-item">
            <div class="history-taf-head">
              <div><b>TAF • ${r.mode} exercícios</b><small>${dateText} • ${r.age} anos</small></div>
              <div class="history-taf-result"><strong>${r.sum}/${max}</strong><span>${escapeCustomHtml(r.classification||'')}</span></div>
            </div>
            <div class="history-taf-data">
              ${r.mode==='4'||r.choice==='pushup'?`<span>Flexão <b>${Number.isFinite(r.values?.pushup)?r.values.pushup:'—'}</b> • ${r.points?.pushup??'—'} pts</span>`:''}
              ${r.mode==='4'||r.choice==='bar'?`<span>Barra <b>${Number.isFinite(r.values?.bar)?r.values.bar:'—'}</b> • ${r.points?.bar??'—'} pts</span>`:''}
              <span>Abdominal <b>${Number.isFinite(r.values?.abs)?r.values.abs:'—'}</b> • ${r.points?.abs??'—'} pts</span>
              <span>Corrida <b>${tafFmtTime(r.values?.run)}</b> • ${r.points?.run??'—'} pts</span>
              ${r.values?.swim!=null?`<span>Natação extra <b>${tafFmtTime(r.values.swim)}</b> • ${r.points?.swim??'—'} pts</span>`:''}
            </div>
          </div>`;
        }).join('')
      : '<div class="custom-empty">Nenhum TAF realizado ainda.</div>'}
  </div>`;

  byId('historyList').innerHTML=out;
}
function openWorkoutHistory(index){
  navHistoryIndex=index;
  saveNavigationState('history');
  reconcileWorkoutHistory(); const wh=migrateWorkoutQuality(), w=wh[index]; if(!w)return;
  if(isCardioRecord(w)){
    byId('historyList').style.display='none';
    const d=byId('historyDetail'); d.style.display='block';
    const meta=CARDIO_MACHINE_META[w.cardioMachine]||{label:'Cardio',icon:'❤️'};
    const extra=w.cardioMachine==='treadmill'
      ? (()=>{const ps=Number(w.cardioPaceSecondsPerKm)>0?Number(w.cardioPaceSecondsPerKm):(Number(w.duration)>0&&Number(w.cardioDistanceKm)>0?Math.round(Number(w.duration)*60/Number(w.cardioDistanceKm)):0);const pace=ps>0?`${Math.floor(ps/60)}:${String(Math.round(ps%60)).padStart(2,'0')}`:'--:--';return `<div><strong>${Number(w.cardioDistanceKm||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong><span>km</span></div><div><strong>${pace}</strong><span>min/km</span></div><div><strong>${Math.round(Number(w.cardioCalories||0))}</strong><span>kcal</span></div>`})()
      : '';
    d.innerHTML=`<div class="bar"><button onclick="closeWorkoutHistory()">←</button><h2>Resumo do cardio</h2></div>
      <div class="card workout-summary cardio-summary">
        <div class="eyebrow">CARDIO CONCLUÍDO</div><h3>${meta.icon} ${meta.label}</h3>
        <div class="finish-stats cardio-finish-stats">
          <div><strong>${Number(w.duration||0)}</strong><span>min</span></div>${extra}
        </div>
        <p class="cardio-detail-status">${Number(w.duration||0)>=30?'✓ Critério mínimo de 30 minutos atingido.':'Atividade abaixo de 30 minutos: não gera ponto no ranking.'}</p>
        <p class="muted">${w.cardioServiceDay===true?'🚒 Registrado durante serviço operacional.':'🏠 Registrado fora do serviço operacional.'}</p>
        <small>${new Date(w.date).toLocaleString('pt-BR')}</small>
      </div>`;
    scrollTo({top:0,behavior:'smooth'});
    return;
  }
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

  // Volume só faz sentido quando houve carga externa registrada.
  // Treino livre, exercícios apenas com peso corporal e treinos sem carga não aparecem neste gráfico.
  const volumeEligible=wh.filter(w=>{
    if(isCardioRecord(w))return false;
    if(w.workoutType==='free')return false;
    return getWorkoutSets(w).some(s=>{
      const ex=exByName(s.exercise);
      return Number(s.weight||0)>0 && !isBodyweightExercise(ex) && !isBodyweightName(s.exercise);
    });
  });
  const recent=volumeEligible.slice(0,8).reverse();
  const maxVol=Math.max(1,...recent.map(x=>Number(x.volume||0)));
  byId('volumeChart').innerHTML=recent.length?recent.map(x=>{
    const pct=Math.max(4,Math.round(Number(x.volume||0)/maxVol*100));
    return `<div class="chart-row"><span>${String(x.plan).split('—')[0].trim()}</span><div class="bar-track"><i style="width:${pct}%"></i></div><b>${Math.round(Number(x.volume||0)).toLocaleString('pt-BR')} kg</b></div>`;
  }).join(''):'<p class="muted">Nenhum treino com carga registrada ainda.</p>';

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


const CORE_VISUALS = {
  'Prancha frontal': {demo:'assets/core-operacional/prancha_frontal-demo.webp',guide:'assets/core-operacional/prancha_frontal-guia.webp'},
  'Wood chop controlado — direita': {demo:'assets/core-operacional/woodchopper-demo.webp',guide:'assets/core-operacional/woodchopper-guia.webp'},
  'Wood chop controlado — esquerda': {demo:'assets/core-operacional/woodchopper-demo.webp',guide:'assets/core-operacional/woodchopper-guia.webp'},
  'Cable chop alto-baixo — direita': {demo:'assets/core-operacional/cable_chop-demo.webp',guide:'assets/core-operacional/cable_chop-guia.webp'},
  'Cable chop alto-baixo — esquerda': {demo:'assets/core-operacional/cable_chop-demo.webp',guide:'assets/core-operacional/cable_chop-guia.webp'},
  'Farmer carry': {demo:'assets/core-operacional/farmer_carry-demo.webp',guide:'assets/core-operacional/farmer_carry-guia.webp'},
  'Farmer carry pesado': {demo:'assets/core-operacional/farmer_carry-demo.webp',guide:'assets/core-operacional/farmer_carry-guia.webp'},
  'Suitcase carry — direita': {demo:'assets/core-operacional/suitcase_carry-demo.webp',guide:'assets/core-operacional/suitcase_carry-guia.webp'},
  'Suitcase carry — esquerda': {demo:'assets/core-operacional/suitcase_carry-demo.webp',guide:'assets/core-operacional/suitcase_carry-guia.webp'},
  'Suitcase carry pesado — direita': {demo:'assets/core-operacional/suitcase_carry-demo.webp',guide:'assets/core-operacional/suitcase_carry-guia.webp'},
  'Suitcase carry pesado — esquerda': {demo:'assets/core-operacional/suitcase_carry-demo.webp',guide:'assets/core-operacional/suitcase_carry-guia.webp'},
  'Suitcase carry pesado': {demo:'assets/core-operacional/suitcase_carry-demo.webp',guide:'assets/core-operacional/suitcase_carry-guia.webp'},
  'Bear-hug carry com sandbag': {demo:'assets/core-operacional/bear_hug_carry-demo.webp',guide:'assets/core-operacional/bear_hug_carry-guia.webp'},
  'Carga frontal abraçada': {demo:'assets/core-operacional/bear_hug_carry-demo.webp',guide:'assets/core-operacional/bear_hug_carry-guia.webp'},
  'Arrasto de peso em prancha': {demo:'assets/core-operacional/prancha_arrasto-demo.webp',guide:'assets/core-operacional/prancha_arrasto-guia.webp'},
  'Prancha com arrasto lateral': {demo:'assets/core-operacional/prancha_arrasto-demo.webp',guide:'assets/core-operacional/prancha_arrasto-guia.webp'},
  'Plank drag com anilha': {demo:'assets/core-operacional/prancha_arrasto-demo.webp',guide:'assets/core-operacional/prancha_arrasto-guia.webp'},
  'Plank drag pesado': {demo:'assets/core-operacional/prancha_arrasto-demo.webp',guide:'assets/core-operacional/prancha_arrasto-guia.webp'},
  'Arrasto de sled': {demo:'assets/core-operacional/arrasto_sled-demo.webp',guide:'assets/core-operacional/arrasto_sled-guia.webp'},
  'Desenvolvimento com halteres': {demo:'assets/core-operacional/shoulder_press-demo.webp',guide:'assets/core-operacional/shoulder_press-guia.webp'}
};


// V67.4 — cobertura visual ampliada do Core Operacional.
Object.assign(CORE_VISUALS,{
  'Respiração 360° + brace': {demo:'assets/core-operacional/respiracao_brace-demo2.webp',guide:'assets/core-operacional/respiracao_brace-painel.webp'},
  'Dead bug': {demo:'assets/core-operacional/dead_bug-demo2.webp',guide:'assets/core-operacional/dead_bug-painel.webp'},
  'Dead bug com puxada': {demo:'assets/core-operacional/dead_bug-demo2.webp',guide:'assets/core-operacional/dead_bug-painel.webp'},
  'Dead bug com pulldown': {demo:'assets/core-operacional/dead_bug-demo2.webp',guide:'assets/core-operacional/dead_bug-painel.webp'},
  'Bird dog': {demo:'assets/core-operacional/bird_dog-demo2.webp',guide:'assets/core-operacional/bird_dog-painel.webp'},
  'Prancha frontal': {demo:'assets/core-operacional/prancha_frontal-demo2.webp',guide:'assets/core-operacional/prancha_frontal-painel.webp'},
  'Prancha lateral direita': {demo:'assets/core-operacional/prancha_lateral_direita-demo2.webp',guide:'assets/core-operacional/prancha_lateral_direita-painel.webp'},
  'Prancha lateral esquerda': {demo:'assets/core-operacional/prancha_lateral_esquerda-demo2.webp',guide:'assets/core-operacional/prancha_lateral_esquerda-painel.webp'},
  'Prancha lateral alternada': {demo:'assets/core-operacional/prancha_lateral_direita-demo2.webp',guide:'assets/core-operacional/prancha_lateral_direita-painel.webp'},
  'Prancha lateral com alcance — direita': {demo:'assets/core-operacional/prancha_lateral_direita-demo2.webp',guide:'assets/core-operacional/prancha_lateral_direita-painel.webp'},
  'Prancha lateral com alcance — esquerda': {demo:'assets/core-operacional/prancha_lateral_esquerda-demo2.webp',guide:'assets/core-operacional/prancha_lateral_esquerda-painel.webp'},
  'Ponte com marcha': {demo:'assets/core-operacional/ponte_marcha-demo2.webp',guide:'assets/core-operacional/ponte_marcha-painel.webp'},
  'Prancha com arrasto lateral': {demo:'assets/core-operacional/prancha_arrasto-demo2.webp',guide:'assets/core-operacional/prancha_arrasto-painel.webp'},
  'Arrasto de peso em prancha': {demo:'assets/core-operacional/prancha_arrasto-demo2.webp',guide:'assets/core-operacional/prancha_arrasto-painel.webp'},
  'Prancha com puxada de halter': {demo:'assets/core-operacional/prancha_arrasto-demo2.webp',guide:'assets/core-operacional/prancha_arrasto-painel.webp'},
  'Plank drag com anilha': {demo:'assets/core-operacional/prancha_arrasto-demo2.webp',guide:'assets/core-operacional/prancha_arrasto-painel.webp'},
  'Plank drag pesado': {demo:'assets/core-operacional/prancha_arrasto-demo2.webp',guide:'assets/core-operacional/prancha_arrasto-painel.webp'},
  'Cable chop alto-baixo — direita': {demo:'assets/core-operacional/cable_chop-demo2.webp',guide:'assets/core-operacional/cable_chop-painel.webp'},
  'Cable chop alto-baixo — esquerda': {demo:'assets/core-operacional/cable_chop-demo2.webp',guide:'assets/core-operacional/cable_chop-painel.webp'},
  'Wood chop controlado — direita': {demo:'assets/core-operacional/cable_chop-demo2.webp',guide:'assets/core-operacional/cable_chop-painel.webp'},
  'Wood chop controlado — esquerda': {demo:'assets/core-operacional/cable_chop-demo2.webp',guide:'assets/core-operacional/cable_chop-painel.webp'},
  'Bear-hug carry com sandbag': {demo:'assets/core-operacional/bear_hug_carry-demo2.webp',guide:'assets/core-operacional/bear_hug_carry-painel.webp'},
  'Carga frontal abraçada': {demo:'assets/core-operacional/bear_hug_carry-demo2.webp',guide:'assets/core-operacional/bear_hug_carry-painel.webp'},
  'Suitcase carry — direita': {demo:'assets/core-operacional/suitcase_carry-demo2.webp',guide:'assets/core-operacional/suitcase_carry-painel.webp'},
  'Suitcase carry — esquerda': {demo:'assets/core-operacional/suitcase_carry-demo2.webp',guide:'assets/core-operacional/suitcase_carry-painel.webp'},
  'Suitcase carry pesado — direita': {demo:'assets/core-operacional/suitcase_carry-demo2.webp',guide:'assets/core-operacional/suitcase_carry-painel.webp'},
  'Suitcase carry pesado — esquerda': {demo:'assets/core-operacional/suitcase_carry-demo2.webp',guide:'assets/core-operacional/suitcase_carry-painel.webp'},
  'Suitcase carry pesado': {demo:'assets/core-operacional/suitcase_carry-demo2.webp',guide:'assets/core-operacional/suitcase_carry-painel.webp'},
  'Arrasto de sled': {demo:'assets/core-operacional/arrasto_sled-demo2.webp',guide:'assets/core-operacional/arrasto_sled-painel.webp'}
});


// V67.5 — novas artes específicas das sequências restantes.
Object.assign(CORE_VISUALS,{
  'Prancha com toque no ombro': {demo:'assets/core-operacional/prancha_toque_ombro-demo.webp',guide:'assets/core-operacional/prancha_toque_ombro-painel.webp'},

  'Pallof press': {demo:'assets/core-operacional/pallof_press-demo.webp',guide:'assets/core-operacional/pallof_press-painel.webp'},
  'Pallof press — direita': {demo:'assets/core-operacional/pallof_press-demo.webp',guide:'assets/core-operacional/pallof_press-painel.webp'},
  'Pallof press — esquerda': {demo:'assets/core-operacional/pallof_press-demo.webp',guide:'assets/core-operacional/pallof_press-painel.webp'},
  'Pallof press pesado — direita': {demo:'assets/core-operacional/pallof_press-demo.webp',guide:'assets/core-operacional/pallof_press-painel.webp'},
  'Pallof press pesado — esquerda': {demo:'assets/core-operacional/pallof_press-demo.webp',guide:'assets/core-operacional/pallof_press-painel.webp'},

  // A marcha unilateral usa o mesmo padrão visual do suitcase carry:
  // carga unilateral + tronco vertical + deslocamento sem inclinação.
  'Marcha unilateral — direita': {demo:'assets/core-operacional/suitcase_carry-demo2.webp',guide:'assets/core-operacional/suitcase_carry-painel.webp'},
  'Marcha unilateral — esquerda': {demo:'assets/core-operacional/suitcase_carry-demo2.webp',guide:'assets/core-operacional/suitcase_carry-painel.webp'}
});


// V67.6 — artes avançadas restantes.
Object.assign(CORE_VISUALS,{
  'Marcha front rack': {demo:'assets/core-operacional/front_rack-demo.webp',guide:'assets/core-operacional/front_rack-painel.webp'},
  'Front rack hold': {demo:'assets/core-operacional/front_rack-demo.webp',guide:'assets/core-operacional/front_rack-painel.webp'},
  'Front rack carry': {demo:'assets/core-operacional/front_rack-demo.webp',guide:'assets/core-operacional/front_rack-painel.webp'},

  'Goblet squat com pausa': {demo:'assets/core-operacional/front_squat-demo.webp',guide:'assets/core-operacional/front_squat-painel.webp'},
  'Front squat': {demo:'assets/core-operacional/front_squat-demo.webp',guide:'assets/core-operacional/front_squat-painel.webp'},

  'Step-up com carga frontal': {demo:'assets/core-operacional/step_up_carga-demo.webp',guide:'assets/core-operacional/step_up_carga-painel.webp'},
  'Step-up com farmer carry': {demo:'assets/core-operacional/step_up_carga-demo.webp',guide:'assets/core-operacional/step_up_carga-painel.webp'},
  'Step-up unilateral — carga direita': {demo:'assets/core-operacional/step_up_carga-demo.webp',guide:'assets/core-operacional/step_up_carga-painel.webp'},
  'Step-up unilateral — carga esquerda': {demo:'assets/core-operacional/step_up_carga-demo.webp',guide:'assets/core-operacional/step_up_carga-painel.webp'},

  'Landmine press meio-ajoelhado — direita': {demo:'assets/core-operacional/landmine_press-demo.webp',guide:'assets/core-operacional/landmine_press-painel.webp'},
  'Landmine press meio-ajoelhado — esquerda': {demo:'assets/core-operacional/landmine_press-demo.webp',guide:'assets/core-operacional/landmine_press-painel.webp'},
  'Meio-ajoelhado com press': {demo:'assets/core-operacional/landmine_press-demo.webp',guide:'assets/core-operacional/landmine_press-painel.webp'},

  'Remada unilateral em meio-ajoelhado — direita': {demo:'assets/core-operacional/remada_unilateral-demo.webp',guide:'assets/core-operacional/remada_unilateral-painel.webp'},
  'Remada unilateral em meio-ajoelhado — esquerda': {demo:'assets/core-operacional/remada_unilateral-demo.webp',guide:'assets/core-operacional/remada_unilateral-painel.webp'},

  'Suitcase deadlift — direita': {demo:'assets/core-operacional/deadlift-demo.webp',guide:'assets/core-operacional/deadlift-painel.webp'},
  'Suitcase deadlift — esquerda': {demo:'assets/core-operacional/deadlift-demo.webp',guide:'assets/core-operacional/deadlift-painel.webp'},

  'Battle rope alternada': {demo:'assets/core-operacional/battle_rope_alternada-demo.webp',guide:'assets/core-operacional/battle_rope_alternada-painel.webp'},
  'Battle rope slam': {demo:'assets/core-operacional/battle_rope_slam-demo.webp',guide:'assets/core-operacional/battle_rope_slam-painel.webp'},

  'Farmer hold pesado': {demo:'assets/core-operacional/farmer_carry_dupla-demo.webp',guide:'assets/core-operacional/farmer_carry_dupla-painel.webp'},
  'Overhead carry': {demo:'assets/core-operacional/overhead_carry-demo.webp',guide:'assets/core-operacional/overhead_carry-painel.webp'}
});


// V67.7 — cobertura visual 100% dos exercícios atualmente citados no Core Operacional.
Object.assign(CORE_VISUALS,{
  'Bear crawl controlado': {demo:'assets/core-operacional/bear_crawl-demo.webp',guide:'assets/core-operacional/bear_crawl-painel.webp'},
  'Crawl reverso': {demo:'assets/core-operacional/crawl_reverso-demo.webp',guide:'assets/core-operacional/crawl_reverso-painel.webp'},
  'Suitcase carry': {demo:'assets/core-operacional/suitcase_carry_exato-demo.webp',guide:'assets/core-operacional/suitcase_carry_exato-painel.webp'}
});



// V67.8 — substituição das 17 ilustrações defeituosas por artes HD com enquadramento completo.
Object.assign(CORE_VISUALS,{
  'Pallof press — direita': {demo:'assets/core-operacional/v67-8-hd/pallof_press_direita.webp',guide:'assets/core-operacional/v67-8-hd/pallof_press_direita.webp'},
  'Pallof press pesado — direita': {demo:'assets/core-operacional/v67-8-hd/pallof_press_direita.webp',guide:'assets/core-operacional/v67-8-hd/pallof_press_direita.webp'},
  'Pallof press — esquerda': {demo:'assets/core-operacional/v67-8-hd/pallof_press_esquerda.webp',guide:'assets/core-operacional/v67-8-hd/pallof_press_esquerda.webp'},
  'Pallof press pesado — esquerda': {demo:'assets/core-operacional/v67-8-hd/pallof_press_esquerda.webp',guide:'assets/core-operacional/v67-8-hd/pallof_press_esquerda.webp'},
  'Front rack hold': {demo:'assets/core-operacional/v67-8-hd/front_rack_hold.webp',guide:'assets/core-operacional/v67-8-hd/front_rack_hold.webp'},
  'Front rack carry': {demo:'assets/core-operacional/v67-8-hd/front_rack_hold.webp',guide:'assets/core-operacional/v67-8-hd/front_rack_hold.webp'},
  'Front squat': {demo:'assets/core-operacional/v67-8-hd/front_squat.webp',guide:'assets/core-operacional/v67-8-hd/front_squat.webp'},
  'Step-up com carga frontal': {demo:'assets/core-operacional/v67-8-hd/step_up_carga_frontal.webp',guide:'assets/core-operacional/v67-8-hd/step_up_carga_frontal.webp'},
  'Step-up unilateral — carga esquerda': {demo:'assets/core-operacional/v67-8-hd/step_up_unilateral_esquerda.webp',guide:'assets/core-operacional/v67-8-hd/step_up_unilateral_esquerda.webp'},
  'Remada unilateral em meio-ajoelhado — direita': {demo:'assets/core-operacional/v67-8-hd/remada_meio_ajoelhado_direita.webp',guide:'assets/core-operacional/v67-8-hd/remada_meio_ajoelhado_direita.webp'},
  'Remada unilateral em meio-ajoelhado — esquerda': {demo:'assets/core-operacional/v67-8-hd/remada_meio_ajoelhado_esquerda.webp',guide:'assets/core-operacional/v67-8-hd/remada_meio_ajoelhado_esquerda.webp'},
  'Suitcase deadlift — direita': {demo:'assets/core-operacional/v67-8-hd/suitcase_deadlift_direita.webp',guide:'assets/core-operacional/v67-8-hd/suitcase_deadlift_direita.webp'},
  'Suitcase deadlift — esquerda': {demo:'assets/core-operacional/v67-8-hd/suitcase_deadlift_esquerda.webp',guide:'assets/core-operacional/v67-8-hd/suitcase_deadlift_esquerda.webp'},
  'Farmer hold pesado': {demo:'assets/core-operacional/v67-8-hd/farmer_hold_pesado.webp',guide:'assets/core-operacional/v67-8-hd/farmer_hold_pesado.webp'},
  'Overhead carry': {demo:'assets/core-operacional/v67-8-hd/overhead_carry.webp',guide:'assets/core-operacional/v67-8-hd/overhead_carry.webp'},
  'Battle rope alternada': {demo:'assets/core-operacional/v67-8-hd/battle_rope_alternada.webp',guide:'assets/core-operacional/v67-8-hd/battle_rope_alternada.webp'},
  'Battle rope slam': {demo:'assets/core-operacional/v67-8-hd/battle_rope_slam.webp',guide:'assets/core-operacional/v67-8-hd/battle_rope_slam.webp'},
  'Landmine press meio-ajoelhado — direita': {demo:'assets/core-operacional/v67-8-hd/landmine_press_direita.webp',guide:'assets/core-operacional/v67-8-hd/landmine_press_direita.webp'},
  'Landmine press meio-ajoelhado — esquerda': {demo:'assets/core-operacional/v67-8-hd/landmine_press_esquerda.webp',guide:'assets/core-operacional/v67-8-hd/landmine_press_esquerda.webp'},
  'Dead bug com pulldown': {demo:'assets/core-operacional/v67-8-hd/dead_bug_pulldown.webp',guide:'assets/core-operacional/v67-8-hd/dead_bug_pulldown.webp'},
  'Dead bug com puxada': {demo:'assets/core-operacional/v67-8-hd/dead_bug_pulldown.webp',guide:'assets/core-operacional/v67-8-hd/dead_bug_pulldown.webp'}
});

// V67.9 — 29 ilustrações revisadas do Core Operacional.
Object.assign(CORE_VISUALS,{
  'Pallof press — direita': {demo:'assets/core-operacional/v67-9-hd/01_pallof_press_direita.webp',guide:'assets/core-operacional/v67-9-hd/01_pallof_press_direita.webp'},
  'Pallof press — esquerda': {demo:'assets/core-operacional/v67-9-hd/02_pallof_press_esquerda.webp',guide:'assets/core-operacional/v67-9-hd/02_pallof_press_esquerda.webp'},
  'Marcha front rack': {demo:'assets/core-operacional/v67-9-hd/03_marcha_front_rack.webp',guide:'assets/core-operacional/v67-9-hd/03_marcha_front_rack.webp'},
  'Dead bug com puxada': {demo:'assets/core-operacional/v67-9-hd/04_dead_bug_com_puxada.webp',guide:'assets/core-operacional/v67-9-hd/04_dead_bug_com_puxada.webp'},
  'Meio-ajoelhado com press': {demo:'assets/core-operacional/v67-9-hd/05_meio_ajoelhado_com_press.webp',guide:'assets/core-operacional/v67-9-hd/05_meio_ajoelhado_com_press.webp'},
  'Crawl reverso': {demo:'assets/core-operacional/v67-9-hd/06_crawl_reverso.webp',guide:'assets/core-operacional/v67-9-hd/06_crawl_reverso.webp'},
  'Pallof press': {demo:'assets/core-operacional/v67-9-hd/07_pallof_press.webp',guide:'assets/core-operacional/v67-9-hd/07_pallof_press.webp'},
  'Suitcase carry': {demo:'assets/core-operacional/v67-9-hd/08_suitcase_carry.webp',guide:'assets/core-operacional/v67-9-hd/08_suitcase_carry.webp'},
  'Goblet squat com pausa': {demo:'assets/core-operacional/v67-9-hd/09_goblet_squat_com_pausa.webp',guide:'assets/core-operacional/v67-9-hd/09_goblet_squat_com_pausa.webp'},
  'Front rack hold': {demo:'assets/core-operacional/v67-9-hd/10_front_rack_hold.webp',guide:'assets/core-operacional/v67-9-hd/10_front_rack_hold.webp'},
  'Suitcase deadlift — direita': {demo:'assets/core-operacional/v67-9-hd/11_suitcase_deadlift_direita.webp',guide:'assets/core-operacional/v67-9-hd/11_suitcase_deadlift_direita.webp'},
  'Suitcase deadlift — esquerda': {demo:'assets/core-operacional/v67-9-hd/12_suitcase_deadlift_esquerda.webp',guide:'assets/core-operacional/v67-9-hd/12_suitcase_deadlift_esquerda.webp'},
  'Overhead carry': {demo:'assets/core-operacional/v67-9-hd/13_overhead_carry.webp',guide:'assets/core-operacional/v67-9-hd/13_overhead_carry.webp'},
  'Remada unilateral em meio-ajoelhado — direita': {demo:'assets/core-operacional/v67-9-hd/14_remada_unilateral_meio_ajoelhado_direita.webp',guide:'assets/core-operacional/v67-9-hd/14_remada_unilateral_meio_ajoelhado_direita.webp'},
  'Remada unilateral em meio-ajoelhado — esquerda': {demo:'assets/core-operacional/v67-9-hd/15_remada_unilateral_meio_ajoelhado_esquerda.webp',guide:'assets/core-operacional/v67-9-hd/15_remada_unilateral_meio_ajoelhado_esquerda.webp'},
  'Battle rope alternada': {demo:'assets/core-operacional/v67-9-hd/16_battle_rope_alternada.webp',guide:'assets/core-operacional/v67-9-hd/16_battle_rope_alternada.webp'},
  'Battle rope slam': {demo:'assets/core-operacional/v67-9-hd/17_battle_rope_slam.webp',guide:'assets/core-operacional/v67-9-hd/17_battle_rope_slam.webp'},
  'Front rack carry': {demo:'assets/core-operacional/v67-9-hd/18_front_rack_carry.webp',guide:'assets/core-operacional/v67-9-hd/18_front_rack_carry.webp'},
  'Step-up com carga frontal': {demo:'assets/core-operacional/v67-9-hd/19_step_up_com_carga_frontal.webp',guide:'assets/core-operacional/v67-9-hd/19_step_up_com_carga_frontal.webp'},
  'Step-up com farmer carry': {demo:'assets/core-operacional/v67-9-hd/20_step_up_com_farmer_carry.webp',guide:'assets/core-operacional/v67-9-hd/20_step_up_com_farmer_carry.webp'},
  'Step-up unilateral — carga direita': {demo:'assets/core-operacional/v67-9-hd/21_step_up_unilateral_carga_direita.webp',guide:'assets/core-operacional/v67-9-hd/21_step_up_unilateral_carga_direita.webp'},
  'Step-up unilateral — carga esquerda': {demo:'assets/core-operacional/v67-9-hd/22_step_up_unilateral_carga_esquerda.webp',guide:'assets/core-operacional/v67-9-hd/22_step_up_unilateral_carga_esquerda.webp'},
  'Farmer hold pesado': {demo:'assets/core-operacional/v67-9-hd/23_farmer_hold_pesado.webp',guide:'assets/core-operacional/v67-9-hd/23_farmer_hold_pesado.webp'},
  'Front squat': {demo:'assets/core-operacional/v67-9-hd/24_front_squat.webp',guide:'assets/core-operacional/v67-9-hd/24_front_squat.webp'},
  'Pallof press pesado — direita': {demo:'assets/core-operacional/v67-9-hd/25_pallof_press_pesado_direita.webp',guide:'assets/core-operacional/v67-9-hd/25_pallof_press_pesado_direita.webp'},
  'Pallof press pesado — esquerda': {demo:'assets/core-operacional/v67-9-hd/26_pallof_press_pesado_esquerda.webp',guide:'assets/core-operacional/v67-9-hd/26_pallof_press_pesado_esquerda.webp'},
  'Landmine press meio-ajoelhado — direita': {demo:'assets/core-operacional/v67-9-hd/27_landmine_press_meio_ajoelhado_direita.webp',guide:'assets/core-operacional/v67-9-hd/27_landmine_press_meio_ajoelhado_direita.webp'},
  'Landmine press meio-ajoelhado — esquerda': {demo:'assets/core-operacional/v67-9-hd/28_landmine_press_meio_ajoelhado_esquerda.webp',guide:'assets/core-operacional/v67-9-hd/28_landmine_press_meio_ajoelhado_esquerda.webp'},
  'Dead bug com pulldown': {demo:'assets/core-operacional/v67-9-hd/29_dead_bug_com_pulldown.webp',guide:'assets/core-operacional/v67-9-hd/29_dead_bug_com_pulldown.webp'}
});
function coreVisualFor(name){ return CORE_VISUALS[name] || null; }

function openCoreVisual(src,title){
  let overlay=document.getElementById('coreVisualOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='coreVisualOverlay';
    overlay.className='core-visual-overlay';
    overlay.innerHTML=`
      <div class="core-visual-modal">
        <div class="core-visual-modal-head">
          <b id="coreVisualTitle">Execução visual</b>
          <button type="button" onclick="closeCoreVisual()">✕</button>
        </div>
        <img id="coreVisualFull" alt="Demonstração detalhada do exercício">
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeCoreVisual()});
  }
  const img=document.getElementById('coreVisualFull');
  const ttl=document.getElementById('coreVisualTitle');
  if(img)img.src=src;
  if(ttl)ttl.textContent=title||'Execução visual';
  overlay.classList.add('show');
  document.body.style.overflow='hidden';
}
function closeCoreVisual(){
  const overlay=document.getElementById('coreVisualOverlay');
  if(overlay)overlay.classList.remove('show');
  document.body.style.overflow='';
}

const CORE_OPERATIONAL_ROUTINES={
  base:{
    title:'Base Blindada',
    icon:'🛡️',
    subtitle:'Estabilidade lombopélvica e controle do tronco',
    duration:'6 min',
    mission:'Protege o tronco em flexões, agachamentos, levantamento de materiais e permanência com EPI.',
    steps:[
      {name:'Respiração 360° + brace',time:40,why:'Cria pressão abdominal antes de levantar, puxar ou transportar carga.',detail:'Deitado ou em pé, inspire expandindo abdômen e laterais das costelas. Trave o abdômen como se fosse receber um impacto, sem prender a respiração.'},
      {name:'Dead bug',time:45,why:'Treina estabilidade da lombar enquanto braços e pernas se movimentam.',detail:'Mantenha a lombar neutra e alterne braço e perna opostos. Reduza a amplitude se a lombar sair do controle.'},
      {name:'Bird dog',time:45,why:'Melhora estabilidade cruzada útil em deslocamentos, subida e trabalho assimétrico.',detail:'Em quatro apoios, estenda braço e perna opostos sem girar o quadril.'},
      {name:'Prancha frontal',time:40,why:'Aumenta resistência do tronco para sustentar equipamento e postura sob fadiga.',detail:'Contraia abdômen e glúteos. Mantenha cabeça, tronco e quadril alinhados.'},
      {name:'Prancha lateral direita',time:35,why:'Reforça controle lateral para carga unilateral e movimentos de tração.',detail:'Cotovelos sob o ombro, quadril elevado e corpo alinhado.'},
      {name:'Prancha lateral esquerda',time:35,why:'Reforça controle lateral para carga unilateral e movimentos de tração.',detail:'Cotovelos sob o ombro, quadril elevado e corpo alinhado.'},
      {name:'Ponte com marcha',time:45,why:'Integra glúteos e core para estabilizar a pelve ao caminhar com peso.',detail:'Eleve o quadril e alterne a retirada de um pé do chão sem deixar a pelve cair ou girar.'}
    ]
  },
  antiRotation:{
    title:'Anti-rotação & Mangueiras',
    icon:'↔️',
    subtitle:'Resistir à rotação durante tração e trabalho unilateral',
    duration:'7 min',
    mission:'Ajuda no controle do tronco ao manejar mangueiras, ferramentas e cargas que puxam o corpo para um lado.',
    steps:[
      {name:'Pallof press — direita',time:45,why:'Treina o tronco a resistir à rotação sob força lateral.',detail:'Com elástico ou cabo ao lado do corpo, empurre as mãos à frente sem deixar o tronco girar.'},
      {name:'Pallof press — esquerda',time:45,why:'Equilibra a capacidade anti-rotação nos dois lados.',detail:'Repita do lado oposto, mantendo quadris e ombros voltados para frente.'},
      {name:'Marcha unilateral — direita',time:50,why:'Simula caminhar com ferramenta ou equipamento pesado em um lado.',detail:'Segure uma carga ao lado direito e marche sem inclinar o tronco.'},
      {name:'Marcha unilateral — esquerda',time:50,why:'Reforça controle lateral do lado oposto.',detail:'Segure a carga ao lado esquerdo e mantenha o tronco vertical.'},
      {name:'Prancha com toque no ombro',time:45,why:'Treina estabilidade sem deixar o quadril rodar enquanto um apoio é retirado.',detail:'Em prancha alta, toque a mão no ombro oposto alternando os lados. Afaste mais os pés se necessário.'},
      {name:'Wood chop controlado — direita',time:45,why:'Integra quadril e tronco em movimentos diagonais usados em ferramentas e resgate.',detail:'Com elástico ou cabo, conduza o movimento em diagonal com abdômen firme e sem puxar apenas com os braços.'},
      {name:'Wood chop controlado — esquerda',time:45,why:'Treina a diagonal oposta.',detail:'Repita o padrão para o outro lado com a mesma postura.'}
    ]
  },
  carry:{
    title:'Carga & Transporte',
    icon:'🧰',
    subtitle:'Core firme para maca, ferramentas e equipamentos',
    duration:'7 min',
    mission:'Foca na habilidade de caminhar e transportar carga sem perder alinhamento do tronco.',
    steps:[
      {name:'Farmer carry',time:60,why:'Fortalece brace, pegada e postura durante transporte bilateral de carga.',detail:'Caminhe com uma carga em cada mão. Costelas alinhadas, abdômen firme e passos controlados.'},
      {name:'Suitcase carry — direita',time:50,why:'Simula transporte unilateral de ferramenta ou cilindro.',detail:'Segure uma carga apenas à direita e resista à inclinação lateral.'},
      {name:'Suitcase carry — esquerda',time:50,why:'Equilibra a resistência lateral.',detail:'Repita com a carga no lado esquerdo.'},
      {name:'Carga frontal abraçada',time:60,why:'Aproxima o padrão de carregar mangueira enrolada, bolsa ou material junto ao corpo.',detail:'Abrance uma carga junto ao tórax e caminhe mantendo o tronco alto e abdômen ativo.'},
      {name:'Marcha front rack',time:50,why:'Exige estabilidade do tronco com carga mais alta e anterior.',detail:'Segure a carga junto aos ombros e marche sem arquear a lombar.'},
      {name:'Arrasto de peso em prancha',time:45,why:'Une apoio, tração e resistência à rotação.',detail:'Em prancha alta, arraste uma carga leve de um lado para o outro sem girar excessivamente a pelve.'}
    ]
  },
  rescue:{
    title:'Resgate & Arrasto',
    icon:'🚒',
    subtitle:'Controle do tronco em solo, tração e deslocamento',
    duration:'7 min',
    mission:'Prepara padrões usados ao aproximar-se baixo, puxar, arrastar e estabilizar o corpo durante resgates.',
    steps:[
      {name:'Bear crawl controlado',time:45,why:'Integra ombros, quadris e core em deslocamento baixo.',detail:'Joelhos poucos centímetros do chão. Avance mão e pé opostos mantendo o tronco estável.'},
      {name:'Prancha com arrasto lateral',time:45,why:'Treina puxar carga sem perder o controle da pelve.',detail:'Arraste uma carga pequena por baixo do corpo alternando as mãos.'},
      {name:'Dead bug com puxada',time:45,why:'Combina tração de braços com estabilidade lombar.',detail:'Use elástico acima da cabeça e faça uma puxada leve enquanto mantém o dead bug controlado.'},
      {name:'Meio-ajoelhado com press',time:45,why:'Reforça estabilidade do tronco em base estreita e posições de trabalho ajoelhadas.',detail:'Em meio-ajoelhado, empurre elástico ou carga à frente sem arquear a lombar.'},
      {name:'Prancha lateral com alcance — direita',time:40,why:'Integra estabilidade lateral e alcance.',detail:'Na prancha lateral, alcance o braço livre à frente sem perder a linha do corpo.'},
      {name:'Prancha lateral com alcance — esquerda',time:40,why:'Treina o lado oposto.',detail:'Repita do outro lado com controle.'},
      {name:'Crawl reverso',time:45,why:'Exige coordenação e brace ao deslocar-se para trás em posição baixa.',detail:'Mantenha joelhos próximos do chão e recue lentamente sem balançar o quadril.'},
      {name:'Arrasto de sled',time:60,why:'Integra força de pernas, pegada e rigidez do tronco em um padrão diretamente transferível para arrasto de cargas.',detail:'Prenda as alças/arnês ao trenó, incline levemente o tronco e avance com passos curtos e firmes sem perder a postura.',load:'Carga desafiadora com passada contínua e técnica preservada.'}
    ]
  },
  complete:{
    title:'Circuito Operacional',
    icon:'🔥',
    subtitle:'Core completo para resistência sob fadiga',
    duration:'8 min',
    mission:'Combina estabilidade, anti-rotação, transporte e deslocamento em uma rotina única.',
    steps:[
      {name:'Respiração 360° + brace',time:35,why:'Prepara o tronco antes da carga.',detail:'Crie tensão abdominal sem prender a respiração.'},
      {name:'Dead bug',time:45,why:'Controle lombar com movimento dos membros.',detail:'Movimente braço e perna opostos mantendo a lombar estável.'},
      {name:'Prancha com toque no ombro',time:45,why:'Anti-rotação em apoio.',detail:'Alterne toques no ombro evitando girar o quadril.'},
      {name:'Farmer carry',time:60,why:'Resistência de tronco e postura com carga.',detail:'Caminhe com carga bilateral e abdômen ativo.'},
      {name:'Pallof press',time:50,why:'Resistência à rotação.',detail:'Faça metade do tempo com cada lado voltado para o ponto de ancoragem.'},
      {name:'Bear crawl controlado',time:45,why:'Deslocamento baixo com estabilidade global.',detail:'Avance devagar mantendo o quadril baixo e estável.'},
      {name:'Suitcase carry',time:60,why:'Controle lateral sob carga unilateral.',detail:'Troque o lado na metade do tempo.'},
      {name:'Prancha lateral alternada',time:50,why:'Resistência lateral do core.',detail:'Faça metade do tempo de cada lado.'},
      {name:'Ponte com marcha',time:45,why:'Estabilidade de pelve e extensão de quadril.',detail:'Mantenha o quadril alto enquanto alterna os pés.'}
    ]
  },
  strength:{
    title:'Força Bruta do Core',
    icon:'🏋️',
    subtitle:'Carga externa e tensão máxima com técnica',
    duration:'10 min',
    mission:'Desenvolve força do tronco para levantar, estabilizar e transferir cargas pesadas sem perder a posição.',
    level:'AVANÇADO',
    equipment:'Halteres • barra • anilha',
    steps:[
      {name:'Goblet squat com pausa',time:60,why:'Integra pernas e core para levantar cargas do solo com tronco firme.',detail:'Segure halter pesado junto ao peito. Desça controlado, pause 2 s no fundo e suba mantendo abdômen travado.',load:'Carga desafiadora, sem perder profundidade ou alinhamento.'},
      {name:'Front rack hold',time:45,why:'Exige brace intenso para sustentar carga anterior semelhante ao controle de equipamentos pesados.',detail:'Segure barra ou halteres na posição frontal e permaneça alto, sem hiperestender a lombar.',load:'Carga alta que permita postura perfeita por todo o intervalo.'},
      {name:'Suitcase deadlift — direita',time:50,why:'Treina levantamento assimétrico e resistência à inclinação.',detail:'Carga ao lado direito. Levante usando quadril e pernas sem inclinar ou girar o tronco.',load:'Moderada/alta, mantendo ombros nivelados.'},
      {name:'Suitcase deadlift — esquerda',time:50,why:'Fortalece o padrão assimétrico do lado oposto.',detail:'Repita com a carga à esquerda, mantendo coluna neutra.',load:'Moderada/alta, mesma técnica do lado direito.'},
      {name:'Overhead carry',time:50,why:'Exige estabilidade do core e cintura escapular com carga acima da cabeça.',detail:'Caminhe com um ou dois halteres acima da cabeça, costelas baixas e abdômen firme.',load:'Moderada; reduza se perder alinhamento dos ombros ou lombar.'},
      {name:'Plank drag com anilha',time:50,why:'Combina força de apoio, tração e anti-rotação.',detail:'Em prancha alta, arraste uma anilha ou halter por baixo do corpo alternando os lados.',load:'Carga que permita quadril praticamente imóvel.'}
    ]
  },
  hosePower:{
    title:'Potência de Mangueira',
    icon:'🚒',
    subtitle:'Tração, rotação controlada e base forte',
    duration:'10 min',
    mission:'Treina padrões de puxar, recolher, estabilizar e redirecionar forças semelhantes às impostas por mangueiras e ferramentas.',
    level:'INTENSO',
    equipment:'Cabo/elástico • corda • anilha',
    steps:[
      {name:'Remada unilateral em meio-ajoelhado — direita',time:50,why:'Une tração forte com estabilidade pélvica e anti-rotação.',detail:'Puxe cabo ou elástico com o braço direito sem rodar o tronco.',load:'Pesado, mas sem compensar com a lombar.'},
      {name:'Remada unilateral em meio-ajoelhado — esquerda',time:50,why:'Equilibra a capacidade de tração.',detail:'Repita do lado esquerdo com quadril e costelas alinhados.',load:'Mesmo esforço do lado oposto.'},
      {name:'Cable chop alto-baixo — direita',time:50,why:'Treina transferência diagonal de força entre tronco, quadril e braços.',detail:'Conduza o cabo em diagonal com rotação controlada do tronco e quadril.',load:'Moderada; velocidade firme sem perder controle.'},
      {name:'Cable chop alto-baixo — esquerda',time:50,why:'Treina a diagonal contrária.',detail:'Repita para o outro lado com o mesmo padrão.',load:'Moderada.'},
      {name:'Battle rope alternada',time:40,why:'Exige brace contínuo enquanto os braços produzem força repetida.',detail:'Base atlética, joelhos semiflexionados e ondas fortes sem balançar excessivamente o tronco.',load:'Máxima intensidade sustentável com técnica.'},
      {name:'Battle rope slam',time:35,why:'Integra quadril, tronco e membros superiores em produção rápida de força.',detail:'Eleve a corda e golpeie o chão usando o corpo inteiro, recuperando a posição a cada repetição.',load:'Explosivo; pare se a lombar assumir o movimento.'}
    ]
  },
  victimCarry:{
    title:'Transporte de Vítima',
    icon:'🧑‍🚒',
    subtitle:'Carga pesada, marcha e estabilidade total',
    duration:'10 min',
    mission:'Eleva a tolerância do tronco para transporte de cargas pesadas e assimétricas, mantendo postura durante deslocamento.',
    level:'AVANÇADO',
    equipment:'Halteres • kettlebell • sandbag',
    steps:[
      {name:'Farmer carry pesado',time:60,why:'Desenvolve resistência global para transportar carga bilateral.',detail:'Caminhe com cargas pesadas nas duas mãos, passos firmes e tronco alto.',load:'Pesado: termine o intervalo exigido, mas sem perder postura.'},
      {name:'Bear-hug carry com sandbag',time:60,why:'Aproxima o transporte de uma carga volumosa junto ao tronco.',detail:'Abrace sandbag ou carga segura contra o peito e caminhe sem arredondar a lombar.',load:'Moderada/alta.'},
      {name:'Front rack carry',time:55,why:'Aumenta demanda anterior sobre o core e respiração sob carga.',detail:'Caminhe com kettlebells/halteres junto aos ombros mantendo costelas alinhadas.',load:'Moderada/alta.'},
      {name:'Suitcase carry pesado — direita',time:50,why:'Resistência lateral intensa com carga unilateral.',detail:'Caminhe sem inclinar o tronco para compensar o peso.',load:'Pesado com controle.'},
      {name:'Suitcase carry pesado — esquerda',time:50,why:'Treina o lado oposto.',detail:'Repita mantendo a mesma postura e distância.',load:'Pesado com controle.'},
      {name:'Step-up com carga frontal',time:55,why:'Integra subida, carga e estabilidade do tronco.',detail:'Suba em caixa baixa/estável segurando carga junto ao peito. Alterne as pernas.',load:'Moderada; prioridade total à estabilidade do joelho e tronco.'}
    ]
  },
  stairSCBA:{
    title:'Escadas & EPI',
    icon:'🪜',
    subtitle:'Core sob fadiga, carga e deslocamento vertical',
    duration:'9 min',
    mission:'Prepara o tronco para manter controle durante subida, descida e deslocamento carregado, cenário comum com EPI e equipamentos.',
    level:'INTENSO',
    equipment:'Halteres • caixa/step • colete opcional',
    steps:[
      {name:'Step-up com farmer carry',time:60,why:'Combina subida e transporte bilateral.',detail:'Suba e desça de um step estável segurando halteres ao lado do corpo.',load:'Moderada/alta, cadência constante.'},
      {name:'Marcha front rack',time:55,why:'Eleva demanda respiratória e do core com carga anterior.',detail:'Marche elevando joelhos de forma controlada com cargas junto aos ombros.',load:'Moderada.'},
      {name:'Step-up unilateral — carga direita',time:50,why:'Cria desafio assimétrico durante subida.',detail:'Carga em uma mão, suba alternando as pernas sem inclinar o tronco.',load:'Moderada.'},
      {name:'Step-up unilateral — carga esquerda',time:50,why:'Equilibra o padrão assimétrico.',detail:'Repita com carga no lado oposto.',load:'Moderada.'},
      {name:'Prancha com puxada de halter',time:50,why:'Mantém o core ativo após fadiga de deslocamento.',detail:'Em prancha, faça remada ou arrasto alternado com carga leve/moderada sem girar o quadril.',load:'Carga controlável.'},
      {name:'Farmer hold pesado',time:45,why:'Finaliza exigindo brace e pegada sob fadiga acumulada.',detail:'Fique em pé segurando cargas pesadas, postura alta e respiração controlada.',load:'Pesado, sem perder alinhamento.'}
    ]
  },
  steelCore:{
    title:'Core de Aço',
    icon:'⚙️',
    subtitle:'Circuito avançado de academia',
    duration:'12 min',
    mission:'Sessão de alta exigência para militares já treinados, combinando carga, anti-rotação, transporte e resistência do tronco.',
    level:'MÁXIMO CONTROLADO',
    equipment:'Barra • halteres • cabo • anilha',
    steps:[
      {name:'Front squat',time:55,why:'Alta demanda de brace com transferência para levantar e sustentar cargas.',detail:'Barra na posição frontal, desça mantendo tronco firme e suba sem colapsar a postura.',load:'RPE 7–8/10; deixe 2–3 repetições em reserva.'},
      {name:'Pallof press pesado — direita',time:45,why:'Anti-rotação sob tensão elevada.',detail:'Pressione o cabo à frente sem permitir rotação.',load:'Pesado com controle.'},
      {name:'Pallof press pesado — esquerda',time:45,why:'Equilibra a resistência anti-rotação.',detail:'Repita para o outro lado.',load:'Pesado com controle.'},
      {name:'Farmer carry pesado',time:60,why:'Core, pegada e postura sob carga.',detail:'Caminhe com passos firmes e sem encurtar a postura.',load:'RPE 8/10, técnica preservada.'},
      {name:'Landmine press meio-ajoelhado — direita',time:50,why:'Integra empurrar, anti-extensão e estabilidade do quadril.',detail:'Pressione a barra em diagonal sem arquear a lombar.',load:'Moderada/alta.'},
      {name:'Landmine press meio-ajoelhado — esquerda',time:50,why:'Treina o lado oposto.',detail:'Repita mantendo pelve e costelas alinhadas.',load:'Moderada/alta.'},
      {name:'Plank drag pesado',time:50,why:'Anti-rotação dinâmica com carga.',detail:'Arraste halter/anilha alternando lados, mantendo quadril estável.',load:'Moderada.'},
      {name:'Suitcase carry pesado',time:60,why:'Resistência lateral máxima controlada.',detail:'Troque o lado aos 30 segundos sem inclinar o tronco.',load:'RPE 8/10.'},
      {name:'Dead bug com pulldown',time:50,why:'Finaliza reforçando controle lombar sob tração.',detail:'Faça pulldown com cabo/elástico enquanto alterna pernas sem perder a lombar neutra.',load:'Leve/moderada; execução perfeita.'},
      {name:'Desenvolvimento com halteres',time:55,why:'Exige estabilização do tronco ao produzir força acima da cabeça, útil em tarefas elevadas e manejo de equipamentos.',detail:'Sentado ou em pé, pressione os halteres acima da cabeça sem arquear a lombar. Mantenha costelas alinhadas e core firme.',load:'Moderada/alta; pare antes de perder o alinhamento lombar.'}
    ]
  }

};

let coreRoutineKey=null;
let coreStep=0;
let coreRemaining=0;
let coreTick=null;
let coreRunning=false;
let coreRoutineStartedAt=null;
let coreCompletionSaved=false;
let coreLastCompletionMessage='';
const CORE_SERVICE_KEY='t2_core_service_choice_v67_10';
let coreServiceDay=null;

function coreLocalDateKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function loadCoreServiceChoice(){
  coreServiceDay=null;
  try{
    const x=JSON.parse(localStorage.getItem(CORE_SERVICE_KEY)||'null');
    if(x&&x.date===coreLocalDateKey()&&(x.value===true||x.value===false)) coreServiceDay=x.value;
  }catch(e){}
  return coreServiceDay;
}
function setCoreServiceDay(value){
  coreServiceDay=!!value;
  localStorage.setItem(CORE_SERVICE_KEY,JSON.stringify({date:coreLocalDateKey(),value:coreServiceDay}));
  updateCoreServiceChoiceUI();
  saveNavigationState('coreOperational');
}
function updateCoreServiceChoiceUI(){
  const y=byId('coreServiceYes'),n=byId('coreServiceNo'),h=byId('coreServiceChoiceHint');
  if(y)y.classList.toggle('selected',coreServiceDay===true);
  if(n)n.classList.toggle('selected',coreServiceDay===false);
  if(h)h.textContent=coreServiceDay===null?'Selecione uma opção antes de iniciar uma rotina.':
    (coreServiceDay?'Serviço validado pelo sistema. Uma rotina completa pode valer 1 ponto; o limite é 1 ponto de Core por dia.':'Core marcado como realizado fora do serviço. A rotina será salva, mas não pontuará.');
}
function requireCoreServiceChoice(){
  if(coreServiceDay===null)loadCoreServiceChoice();
  if(coreServiceDay===null){
    alert('Informe primeiro se você está de serviço hoje.');
    return false;
  }
  return true;
}
function saveCompletedCoreRoutine(r){
  if(!r||coreCompletionSaved)return;
  coreCompletionSaved=true;
  const ended=new Date();
  const started=coreRoutineStartedAt?new Date(coreRoutineStartedAt):ended;
  const minutes=Math.max(1,Math.round((ended-started)/60000));
  const wh=workoutHistory();
  const corePointAlreadyUsed=coreServiceDay===true && wh.some(w=>v55ValidWorkout(w)&&v6711LocalDayKey(w)===coreLocalDateKey()&&v6711RankingCategory(w)==='core');
  const record={
    date:ended.toISOString(),
    startedAt:coreRoutineStartedAt||ended.toISOString(),
    plan:`Core Operacional — ${r.title}`,
    duration:minutes,
    exercisesPlanned:r.steps.length,
    exercisesDone:r.steps.length,
    sets:0,reps:0,volume:0,byExercise:[],
    schemaVersion:6711,
    workoutType:'core',
    coreComplete:true,
    coreRoutineKey:coreRoutineKey,
    coreStepsPlanned:r.steps.length,
    coreStepsCompleted:r.steps.length,
    serviceDay:coreServiceDay===true,
    excludedFromStats:false
  };
  wh.unshift(record);
  saveWorkoutHistory(wh);
  localStorage.setItem('t2_last',`${record.plan} • concluído`);
  try{updateLast();}catch(e){console.warn('updateLast core:',e)}
  if(typeof cloudPushNow==='function'&&cloudSession?.token&&navigator.onLine)setTimeout(()=>cloudPushNow(),50);
  coreLastCompletionMessage=coreServiceDay===true
    ? (corePointAlreadyUsed
      ? `✅ ${r.title} concluído e salvo. O ponto de Core de hoje já havia sido registrado; esta rotina não gera ponto extra.`
      : `✅ ${r.title} concluído. Core válido registrado: +1 ponto no Ranking de Frequência.`)
    : `✅ ${r.title} concluído e salvo. Sem validação de serviço ativa, não contará no ranking.`;
}

function coreFmt(sec){
  const s=Math.max(0,Number(sec)||0);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function coreStopTick(){
  if(coreTick){clearInterval(coreTick);coreTick=null}
  coreRunning=false;
}
function openCoreOperational(){
  coreStopTick();
  coreRoutineKey=null;
  coreStep=0;
  coreRemaining=0;
  coreRoutineStartedAt=null;
  coreCompletionSaved=false;
  loadCoreServiceChoice();
  showView('coreOperational');
  renderCoreOperational();
}
function renderCoreOperational(){
  coreStopTick();
  coreRoutineKey=null;
  const box=byId('coreOperationalList');
  if(!box)return;
  box.innerHTML=`
    <div class="core-op-hero">
      <div class="eyebrow">CORE OPERACIONAL</div>
      <h3>Força que transfere para a ocorrência</h3>
      <p>Rotinas progressivas para estabilizar e fortalecer o tronco em transporte de carga, tração, arrasto, escadas, ferramentas e trabalho com EPI. Há opções com peso livre, cabo, corda, sandbag e equipamentos de academia.</p>
      <div class="core-op-principles">
        <span>🛡️ Estabilidade</span>
        <span>↔️ Anti-rotação</span>
        <span>🧰 Transporte</span>
        <span>🚒 Resgate</span>
      </div>
      <button type="button" class="core-atlas-btn" onclick="openCoreVisual('assets/core-operacional/core_operacional_final_100-guia.webp','Atlas visual completo — Core Operacional')">🗂️ VER ATLAS VISUAL DO CORE</button>
    </div>
    ${coreLastCompletionMessage?`<div class="card core-ranking-result"><b>${coreLastCompletionMessage}</b></div>`:''}
    <div id="coreServiceValidationCard" class="card service-validation-card pending">
      <span class="eyebrow">SITUAÇÃO DO CORE</span>
      <h3 id="coreServiceValidationTitle">Verificando validação…</h3>
      <p id="coreServiceValidationText">Escolha se esta rotina será durante serviço operacional ou fora dele.</p>
      <div class="service-mode-grid">
        <button id="coreServiceValidationOperational" class="service-mode-btn operational" type="button" onclick="chooseOperationalService()">🚒 VALIDAR SERVIÇO OPERACIONAL</button>
        <button id="coreServiceValidationOff" class="service-mode-btn off" type="button" onclick="chooseOffDutyTraining()">🏠 NÃO ESTOU DE SERVIÇO OPERACIONAL</button>
      </div>
      <small id="coreServiceValidationHint">Core completo fora de serviço continua no histórico, mas não pontua.</small>
    </div>
    <div class="core-op-grid">
      ${Object.entries(CORE_OPERATIONAL_ROUTINES).map(([key,r])=>`
        <button class="core-op-card" onclick="openCoreRoutine('${key}')">
          <span class="core-op-icon">${r.icon}</span>
          <span class="core-op-copy">
            <b>${r.title}</b>
            <small>${r.subtitle}</small>
            <em>${r.mission}</em>
            ${r.equipment?`<i class="core-op-equipment">${r.equipment}</i>`:''}
          </span>
          <span class="core-op-time">${r.duration}${r.level?`<small>${r.level}</small>`:''}<small class="core-visual-count">${r.steps.filter(s=>coreVisualFor(s.name)).length}/${r.steps.length} HD</small></span>
        </button>`).join('')}
    </div>
    <div class="core-op-note"><b>Alta exigência, técnica primeiro.</b> Nas rotinas avançadas, trabalhe em torno de RPE 7–8/10: pesado e desafiador, mas sem chegar à falha técnica. Aumente a carga somente com tronco e pelve estáveis. Dor aguda, formigamento, tontura ou perda de controle são sinais para interromper.</div>`;
  updateCoreServiceChoiceUI();
  saveNavigationState('coreOperational');
}
function openCoreRoutine(key){
  const r=CORE_OPERATIONAL_ROUTINES[key];
  if(!r)return;
  if(!requireCoreServiceChoice())return;
  coreStopTick();
  coreRoutineKey=key;
  coreStep=0;
  coreRemaining=r.steps[0]?.time||0;
  coreRoutineStartedAt=new Date().toISOString();
  coreCompletionSaved=false;
  coreLastCompletionMessage='';
  showView('coreOperational');
  renderCoreRoutine();
  saveNavigationState('coreOperational');
}
function backToCoreHome(){
  coreStopTick();
  coreRoutineKey=null;
  coreStep=0;
  coreRemaining=0;
  coreRoutineStartedAt=null;
  coreCompletionSaved=false;
  renderCoreOperational();
  saveNavigationState('coreOperational');
}
function renderCoreRoutine(){
  const r=CORE_OPERATIONAL_ROUTINES[coreRoutineKey];
  const box=byId('coreOperationalList');
  if(!r||!box)return;
  const step=r.steps[coreStep];
  const pct=Math.round((coreStep/r.steps.length)*100);
  box.innerHTML=`
    <div class="core-op-routine-head">
      <button class="mobility-mini-back" onclick="backToCoreHome()">← Rotinas</button>
      <div class="eyebrow">CORE OPERACIONAL</div>
      <h3>${r.icon} ${r.title}</h3>
      <p>${r.mission}</p>
      ${r.equipment?`<div class="core-routine-meta"><span>🏋️ ${r.equipment}</span><span>${r.level||'GUIADO'}</span></div>`:''}
    </div>
    <div class="mobility-progress"><span style="width:${pct}%"></span></div>
    <div class="core-op-step-card">
      <div class="mobility-step-label">ETAPA ${coreStep+1} DE ${r.steps.length}</div>
      <h2>${step.name}</h2>
      ${(()=>{const v=coreVisualFor(step.name);return v?`
        <div class="core-step-visual">
          <img src="${v.demo}" alt="Posição inicial e final de ${step.name}" loading="lazy">
          <button type="button" onclick="openCoreVisual('${v.guide}','${step.name.replace(/'/g,"&#39;")}')">🔎 VER GUIA COMPLETO EM HD</button>
        </div>`:''})()}
      <div class="core-op-why"><b>Transferência para o serviço</b><span>${step.why}</span></div>
      <p>${step.detail}</p>
      ${step.load?`<div class="core-op-load"><b>CARGA / INTENSIDADE</b><span>${step.load}</span></div>`:''}
      <div class="core-op-cue">
        <b>COMANDO</b>
        <span>Costelas alinhadas • abdômen firme • respiração controlada • movimento sem compensar</span>
      </div>
      <div id="coreClock" class="mobility-clock">${coreFmt(coreRemaining)}</div>
      <div class="mobility-controls">
        <button class="ghost" onclick="corePrev()" ${coreStep===0?'disabled':''}>ANTERIOR</button>
        <button id="corePlayBtn" class="primary" onclick="coreToggle()">${coreRunning?'PAUSAR':'INICIAR'}</button>
        <button class="ghost" onclick="coreNext()">${coreStep===r.steps.length-1?'CONCLUIR':'PRÓXIMO'}</button>
      </div>
    </div>
    <div class="mobility-list">
      ${r.steps.map((s,i)=>`
        <div class="mobility-list-row ${i===coreStep?'active':''} ${i<coreStep?'done':''}">
          <span>${i<coreStep?'✓':i+1}</span>
          <div><b>${s.name}${coreVisualFor(s.name)?' <i class="core-hd-badge">HD</i>':''}</b><small>${coreFmt(s.time)}</small></div>
        </div>`).join('')}
    </div>`;
}
function coreToggle(){
  const r=CORE_OPERATIONAL_ROUTINES[coreRoutineKey];
  if(!r)return;
  if(coreRunning){
    coreStopTick();
    renderCoreRoutine();
    saveNavigationState('coreOperational');
    return;
  }
  if(coreRemaining<=0)coreRemaining=r.steps[coreStep].time;
  coreRunning=true;
  saveNavigationState('coreOperational');
  const btn=byId('corePlayBtn');
  if(btn)btn.textContent='PAUSAR';
  coreTick=setInterval(()=>{
    coreRemaining=Math.max(0,coreRemaining-1);
    const clock=byId('coreClock');
    if(clock)clock.textContent=coreFmt(coreRemaining);
    if(coreRemaining<=0){
      coreStopTick();
      if(coreStep<r.steps.length-1){
        coreStep++;
        coreRemaining=r.steps[coreStep].time;
        renderCoreRoutine();
      }else{
        renderCoreRoutine();
      }
      saveNavigationState('coreOperational');
    }
  },1000);
}
function corePrev(){
  const r=CORE_OPERATIONAL_ROUTINES[coreRoutineKey];
  if(!r)return;
  coreStopTick();
  coreStep=Math.max(0,coreStep-1);
  coreRemaining=r.steps[coreStep].time;
  renderCoreRoutine();
  saveNavigationState('coreOperational');
}
function coreNext(){
  const r=CORE_OPERATIONAL_ROUTINES[coreRoutineKey];
  if(!r)return;
  coreStopTick();
  if(coreStep>=r.steps.length-1){
    saveCompletedCoreRoutine(r);
    coreRoutineKey=null;
    coreStep=0;
    coreRemaining=0;
    coreRoutineStartedAt=null;
    renderCoreOperational();
    return;
  }
  coreStep++;
  coreRemaining=r.steps[coreStep].time;
  renderCoreRoutine();
  saveNavigationState('coreOperational');
}

const MOBILITY_ROUTINES={
  shoulders:{
    title:'Ombros',
    icon:'◒',
    subtitle:'Mobilidade, estabilidade e saúde articular dos ombros',
    duration:'8 min',
    steps:[
      {name:'Rotação externa com elástico',time:45,detail:'Mantenha o cotovelo junto ao corpo e gire o antebraço para fora sem rodar o tronco.'},
      {name:'Rotação interna com elástico',time:45,detail:'Mantenha o cotovelo junto ao corpo e puxe o antebraço para dentro de forma lenta e controlada.'},
      {name:'Elevação frontal',time:40,detail:'Eleve os braços à frente até a altura dos ombros, sem arquear a lombar ou encolher os ombros.'},
      {name:'Elevação lateral',time:40,detail:'Eleve os braços lateralmente até a linha dos ombros, mantendo os cotovelos levemente flexionados.'},
      {name:'Desenvolvimento de ombros',time:45,detail:'Partindo dos cotovelos flexionados, eleve os braços acima da cabeça sem compensar com a lombar.'},
      {name:'Mobilidade com bastão',time:50,detail:'Segure o bastão com pegada confortável e conduza-o acima da cabeça dentro de uma amplitude sem dor.'},
      {name:'Alongamento de ombro atrás do corpo',time:40,detail:'Cruze um braço à frente do peito e use o outro para aproximá-lo suavemente do corpo.'},
      {name:'Mobilidade torácica em quadrupedia',time:50,detail:'Em quatro apoios, gire o tronco e leve um braço para cima, mantendo os quadris estáveis.'},
      {name:'Círculos de ombro',time:40,detail:'Faça círculos amplos e lentos com os ombros, mantendo o tronco estável e o movimento confortável.'}
    ]
  },
  spine:{
    title:'Coluna & Lombar',
    icon:'↕',
    subtitle:'Mobilidade de coluna e relaxamento do tronco',
    duration:'6 min',
    steps:[
      {name:'Gato-vaca',time:50,detail:'Alterne extensão e flexão da coluna de forma lenta, coordenando o movimento com a respiração.'},
      {name:'Rotação torácica',time:50,detail:'Em quatro apoios, gire o tórax mantendo o quadril estável e sem forçar a amplitude.'},
      {name:'Postura da criança com alcance lateral',time:50,detail:'Leve o quadril em direção aos calcanhares e alcance os braços à frente e levemente para cada lado.'},
      {name:'Rotação lombar deitado',time:50,detail:'Deitado com os joelhos flexionados, mova-os suavemente de um lado ao outro.'},
      {name:'Extensão de tronco',time:50,detail:'Eleve o peito gradualmente, mantendo o movimento confortável e sem comprimir a lombar.'},
      {name:'Alongamento lateral do tronco',time:50,detail:'Incline o tronco para o lado com controle, mantendo os quadris estáveis e sem girar o corpo.'}
    ]
  },
  hips:{
    title:'Quadril',
    icon:'◇',
    subtitle:'Amplitude do quadril e preparação para membros inferiores',
    duration:'7 min',
    steps:[
      {name:'90/90 de quadril',time:60,detail:'Alterne os joelhos de um lado para o outro mantendo controle.'},
      {name:'Afundo com mobilidade',time:50,detail:'Leve o quadril suavemente à frente mantendo o tronco ereto.'},
      {name:'Agachamento profundo assistido',time:50,detail:'Segure em um apoio e permaneça em posição confortável.'},
      {name:'Rotação interna do quadril',time:50,detail:'Movimento lento, sem tirar o pé do chão de forma brusca.'},
      {name:'Ponte de glúteos',time:50,detail:'Eleve o quadril contraindo glúteos sem hiperestender a lombar.'},
      {name:'Alongamento de glúteo',time:45,detail:'Cruze uma perna sobre a outra e aproxime suavemente.'}
    ]
  },
  knees:{
    title:'Joelhos',
    icon:'⌁',
    subtitle:'Mobilidade, estabilidade e preparação dos joelhos',
    duration:'5 min',
    steps:[
      {name:'Flexão e extensão de joelho',time:40,detail:'Com apoio, flexione o joelho levando o calcanhar em direção ao glúteo e retorne lentamente.'},
      {name:'Agachamento parcial controlado',time:50,detail:'Desça apenas até uma amplitude confortável, mantendo joelhos alinhados com os pés.'},
      {name:'Passada reversa curta',time:50,detail:'Dê um passo para trás, flexione os joelhos com controle e retorne à posição inicial.'},
      {name:'Elevação de panturrilha',time:50,detail:'Eleve os calcanhares, sustente brevemente no alto e desça de forma controlada.'},
      {name:'Isometria de parede leve',time:35,detail:'Apoie as costas na parede e mantenha uma flexão confortável dos joelhos, sem buscar fadiga máxima.'}
    ]
  },
  ankles:{
    title:'Tornozelos',
    icon:'◜',
    subtitle:'Mobilidade, estabilidade e amplitude dos tornozelos',
    duration:'5 min',
    steps:[
      {name:'Círculos de tornozelo',time:40,detail:'Sentado, eleve o pé e faça círculos lentos e completos nas duas direções, sem movimentar o joelho.'},
      {name:'Joelho à parede',time:50,detail:'Leve o joelho à frente em direção à parede mantendo o calcanhar totalmente apoiado no chão.'},
      {name:'Elevação de panturrilha',time:50,detail:'Eleve os calcanhares até ficar apoiado nas pontas dos pés, sustente brevemente e desça com controle.'},
      {name:'Inversão e eversão do tornozelo',time:45,detail:'Sentado, mova o pé lentamente para dentro e para fora, controlando a amplitude sem girar o joelho.'},
      {name:'Alongamento de panturrilha na parede',time:50,detail:'Com as mãos na parede, mantenha o calcanhar de trás no chão e avance o corpo até sentir alongamento confortável.'}
    ]
  },
  full:{
    title:'Corpo Inteiro',
    icon:'✦',
    subtitle:'Mobilidade global, estabilidade e recuperação',
    duration:'9 min',
    steps:[
      {name:'Agachamento profundo com alcance',time:50,detail:'Desça em agachamento profundo dentro da amplitude confortável e alcance um braço para cima, mantendo o peito aberto.'},
      {name:'Avanço com rotação de tronco',time:50,detail:'Entre em posição de avanço e gire o tronco para o lado da perna da frente, mantendo o quadril estável.'},
      {name:'Toque de pé com joelhos estendidos',time:45,detail:'Com os joelhos estendidos sem travar, incline o tronco à frente e alcance em direção aos pés sem forçar.'},
      {name:'Prancha com alcance alternado',time:45,detail:'Em prancha alta, eleve um braço à frente por vez sem deixar o quadril girar excessivamente.'},
      {name:'Mobilidade de quadril em pé',time:45,detail:'Eleve um joelho à frente e movimente o quadril de forma controlada, mantendo equilíbrio e tronco ereto.'},
      {name:'Rotação de coluna em quadrupedia',time:50,detail:'Em quatro apoios, gire o tronco levando um braço para cima, mantendo os quadris estáveis.'},
      {name:'Alongamento global em Y',time:40,detail:'Em pé, eleve os braços formando um Y e alongue o corpo para cima, respirando de forma lenta.'},
      {name:'Passada lateral com alcance',time:50,detail:'Desloque o peso para um lado, flexione o joelho e alcance em direção ao chão sem perder o alinhamento.'},
      {name:'Respiração e mobilidade global',time:45,detail:'Inspire abrindo os braços e o peito; expire retornando com controle e relaxando ombros e tronco.'}
    ]
  }
};
let mobilityRoutineKey=null;
let mobilityStep=0;
let mobilityRemaining=0;
let mobilityTick=null;
let mobilityRunning=false;

function mobilityFmt(sec){
  const s=Math.max(0,Number(sec)||0);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function mobilityStopTick(){
  if(mobilityTick){clearInterval(mobilityTick);mobilityTick=null}
  mobilityRunning=false;
}
function backToMobilityHome(){
  mobilityStopTick();
  mobilityRoutineKey=null;
  mobilityStep=0;
  mobilityRemaining=0;
  renderStretch();
  saveNavigationState('stretch');
}
function renderStretch(){
  mobilityStopTick();
  mobilityRoutineKey=null;
  const box=byId('stretchList');
  if(!box)return;
  box.innerHTML=`
    <div class="mobility-hero">
      <div class="eyebrow">MOBILIDADE & RECUPERAÇÃO</div>
      <h3>Escolha a região</h3>
      <p>Rotinas curtas para preparar o movimento, reduzir rigidez e recuperar a amplitude com controle.</p>
    </div>
    <div class="mobility-grid">
      ${Object.entries(MOBILITY_ROUTINES).map(([key,r])=>`
        <button class="mobility-card" onclick="openMobilityRoutine('${key}')">
          <span class="mobility-icon">${r.icon}</span>
          <span class="mobility-copy"><b>${r.title}</b><small>${r.subtitle}</small></span>
          <span class="mobility-time">${r.duration}</span>
        </button>`).join('')}
    </div>
    <div class="mobility-note"><b>Movimento sem dor.</b> Use amplitude confortável e interrompa se surgir dor aguda, tontura ou mal-estar.</div>`;
}
function openMobilityRoutine(key){
  const r=MOBILITY_ROUTINES[key];
  if(!r)return;
  mobilityStopTick();
  mobilityRoutineKey=key;
  mobilityStep=0;
  mobilityRemaining=r.steps[0]?.time||0;
  renderMobilityRoutine();
  saveNavigationState('stretch');
}

function mobilityVisualType(name=''){
  const n=normText(name);
  if(/circulos de ombro/.test(n)) return 'shoulder';
  if(/deslizamento na parede|passagem de bracos/.test(n)) return 'arms';
  if(/rotacao toracica|rotacao lombar/.test(n)) return 'twist';
  if(/peitoral/.test(n)) return 'pec';
  if(/respiracao|cervical|soltura escapular/.test(n)) return 'breath';
  if(/gato-vaca/.test(n)) return 'catcow';
  if(/postura da crianca/.test(n)) return 'child';
  if(/joelhos ao peito/.test(n)) return 'knees';
  if(/bird-dog/.test(n)) return 'birddog';
  if(/90\/90/.test(n)) return 'hip90';
  if(/afundo|passada reversa/.test(n)) return 'lunge';
  if(/agachamento/.test(n)) return 'squat';
  if(/rotacao interna do quadril/.test(n)) return 'hiprot';
  if(/ponte de gluteos/.test(n)) return 'bridge';
  if(/alongamento de gluteo/.test(n)) return 'glute';
  if(/flexao e extensao de joelho/.test(n)) return 'kneeflex';
  if(/panturrilha/.test(n)) return 'calf';
  if(/isometria de parede/.test(n)) return 'wallsit';
  if(/circulos de tornozelo/.test(n)) return 'ankle';
  if(/joelho a parede/.test(n)) return 'kneewall';
  if(/ponta do pe/.test(n)) return 'toe';
  if(/transferencia de peso/.test(n)) return 'shift';
  return 'general';
}


const MOBILITY_HD={
  'Rotação externa com elástico':['assets/mobility/ombros/rotacao-externa-a.webp','assets/mobility/ombros/rotacao-externa-b.webp'],
  'Rotação interna com elástico':['assets/mobility/ombros/rotacao-interna-a.webp','assets/mobility/ombros/rotacao-interna-b.webp'],
  'Elevação frontal':['assets/mobility/ombros/elevacao-frontal-a.webp','assets/mobility/ombros/elevacao-frontal-b.webp'],
  'Elevação lateral':['assets/mobility/ombros/elevacao-lateral-a.webp','assets/mobility/ombros/elevacao-lateral-b.webp'],
  'Desenvolvimento de ombros':['assets/mobility/ombros/desenvolvimento-a.webp','assets/mobility/ombros/desenvolvimento-b.webp'],
  'Mobilidade com bastão':['assets/mobility/ombros/bastao-a.webp','assets/mobility/ombros/bastao-b.webp'],
  'Alongamento de ombro atrás do corpo':['assets/mobility/ombros/alongamento-ombro-a.webp','assets/mobility/ombros/alongamento-ombro-b.webp'],
  'Mobilidade torácica em quadrupedia':['assets/mobility/ombros/toracica-quadrupedia-a.webp','assets/mobility/ombros/toracica-quadrupedia-b.webp'],
  'Círculos de ombro':['assets/mobility/ombros/circulos-a.webp','assets/mobility/ombros/circulos-b.webp'],
  'Agachamento profundo com alcance':['assets/mobility/corpo-inteiro/agachamento-alcance-a.webp','assets/mobility/corpo-inteiro/agachamento-alcance-b.webp'],
  'Avanço com rotação de tronco':['assets/mobility/corpo-inteiro/avanco-rotacao-a.webp','assets/mobility/corpo-inteiro/avanco-rotacao-b.webp'],
  'Toque de pé com joelhos estendidos':['assets/mobility/corpo-inteiro/toque-pe-a.webp','assets/mobility/corpo-inteiro/toque-pe-b.webp'],
  'Prancha com alcance alternado':['assets/mobility/corpo-inteiro/prancha-alcance-a.webp','assets/mobility/corpo-inteiro/prancha-alcance-b.webp'],
  'Mobilidade de quadril em pé':['assets/mobility/corpo-inteiro/quadril-em-pe-a.webp','assets/mobility/corpo-inteiro/quadril-em-pe-b.webp'],
  'Rotação de coluna em quadrupedia':['assets/mobility/corpo-inteiro/rotacao-coluna-a.webp','assets/mobility/corpo-inteiro/rotacao-coluna-b.webp'],
  'Alongamento global em Y':['assets/mobility/corpo-inteiro/alongamento-y-a.webp','assets/mobility/corpo-inteiro/alongamento-y-b.webp'],
  'Passada lateral com alcance':['assets/mobility/corpo-inteiro/passada-lateral-a.webp','assets/mobility/corpo-inteiro/passada-lateral-b.webp'],
  'Respiração e mobilidade global':['assets/mobility/corpo-inteiro/respiracao-global-a.webp','assets/mobility/corpo-inteiro/respiracao-global-b.webp'],
  'Círculos de tornozelo':['assets/mobility/tornozelos/circulos-a.webp','assets/mobility/tornozelos/circulos-b.webp'],
  'Joelho à parede':['assets/mobility/tornozelos/joelho-parede-a.webp','assets/mobility/tornozelos/joelho-parede-b.webp'],
  'Elevação de panturrilha':['assets/mobility/tornozelos/panturrilha-a.webp','assets/mobility/tornozelos/panturrilha-b.webp'],
  'Inversão e eversão do tornozelo':['assets/mobility/tornozelos/inversao-eversao-a.webp','assets/mobility/tornozelos/inversao-eversao-b.webp'],
  'Alongamento de panturrilha na parede':['assets/mobility/tornozelos/alongamento-panturrilha-a.webp','assets/mobility/tornozelos/alongamento-panturrilha-b.webp'],  'Flexão e extensão de joelho':['assets/mobility/joelhos/flexao-extensao-a.webp','assets/mobility/joelhos/flexao-extensao-b.webp'],
  'Agachamento parcial controlado':['assets/mobility/joelhos/agachamento-parcial-a.webp','assets/mobility/joelhos/agachamento-parcial-b.webp'],
  'Passada reversa curta':['assets/mobility/joelhos/passada-reversa-a.webp','assets/mobility/joelhos/passada-reversa-b.webp'],
  'Elevação de panturrilha':['assets/mobility/joelhos/panturrilha-a.webp','assets/mobility/joelhos/panturrilha-b.webp'],
  'Isometria de parede leve':['assets/mobility/joelhos/isometria-parede-a.webp','assets/mobility/joelhos/isometria-parede-b.webp'],
  'Gato-vaca':['assets/mobility/coluna-lombar/gato-vaca-a.webp','assets/mobility/coluna-lombar/gato-vaca-b.webp'],
  'Rotação torácica':['assets/mobility/coluna-lombar/rotacao-toracica-a.webp','assets/mobility/coluna-lombar/rotacao-toracica-b.webp'],
  'Postura da criança com alcance lateral':['assets/mobility/coluna-lombar/crianca-a.webp','assets/mobility/coluna-lombar/crianca-b.webp'],
  'Rotação lombar deitado':['assets/mobility/coluna-lombar/rotacao-lombar-a.webp','assets/mobility/coluna-lombar/rotacao-lombar-b.webp'],
  'Extensão de tronco':['assets/mobility/coluna-lombar/extensao-tronco-a.webp','assets/mobility/coluna-lombar/extensao-tronco-b.webp'],
  'Alongamento lateral do tronco':['assets/mobility/coluna-lombar/alongamento-lateral-a.webp','assets/mobility/coluna-lombar/alongamento-lateral-b.webp'],  '90/90 de quadril':['assets/mobility/quadril/90-90-a.webp','assets/mobility/quadril/90-90-b.webp'],
  'Afundo com mobilidade':['assets/mobility/quadril/afundo-a.webp','assets/mobility/quadril/afundo-b.webp'],
  'Agachamento profundo assistido':['assets/mobility/quadril/agachamento-a.webp','assets/mobility/quadril/agachamento-b.webp'],
  'Ponte de glúteos':['assets/mobility/quadril/ponte-a.webp','assets/mobility/quadril/ponte-b.webp'],
  'Rotação interna do quadril':['assets/mobility/quadril/rotacao-quadril-a.webp','assets/mobility/quadril/rotacao-quadril-b.webp'],
  'Alongamento de glúteo':['assets/mobility/quadril/gluteo-a.webp','assets/mobility/quadril/gluteo-b.webp']
};
function mobilityHdVisual(name=''){
  const pair=MOBILITY_HD[name];
  if(!pair)return '';
  return `
    <div class="mobility-hd-stage" aria-label="Demonstração visual de ${name}">
      <div class="mobility-hd-badge">MOVIMENTO REALISTA</div>
      <div class="mobility-hd-frame-wrap">
        <img class="mobility-hd-frame mobility-hd-a" src="${pair[0]}" alt="Posição inicial de ${name}">
        <img class="mobility-hd-frame mobility-hd-b" src="${pair[1]}" alt="Posição final de ${name}">
        <div class="mobility-hd-label mobility-hd-label-a">INÍCIO</div>
        <div class="mobility-hd-label mobility-hd-label-b">MOVIMENTO</div>
      </div>
      <div class="mobility-hd-caption">A imagem alterna entre as duas posições para facilitar a assimilação do movimento.</div>
    </div>`;
}

function mobilityAnimationSvg(name=''){
  const type=mobilityVisualType(name);

  const anim={
    shoulder:{
      left:`<animateTransform attributeName="transform" type="rotate" values="0 160 78;-70 160 78;0 160 78" dur="2.4s" repeatCount="indefinite"/>`,
      right:`<animateTransform attributeName="transform" type="rotate" values="0 160 78;70 160 78;0 160 78" dur="2.4s" repeatCount="indefinite"/>`
    },
    arms:{
      left:`<animateTransform attributeName="transform" type="rotate" values="0 160 78;-85 160 78;0 160 78" dur="2.2s" repeatCount="indefinite"/>`,
      right:`<animateTransform attributeName="transform" type="rotate" values="0 160 78;85 160 78;0 160 78" dur="2.2s" repeatCount="indefinite"/>`
    },
    twist:{
      torso:`<animateTransform attributeName="transform" type="rotate" values="-12 160 110;12 160 110;-12 160 110" dur="2.4s" repeatCount="indefinite"/>`
    },
    lunge:{
      body:`<animateTransform attributeName="transform" type="translate" values="0 0;0 24;0 0" dur="2s" repeatCount="indefinite"/>`,
      left:`<animateTransform attributeName="transform" type="rotate" values="0 160 126;24 160 126;0 160 126" dur="2s" repeatCount="indefinite"/>`,
      right:`<animateTransform attributeName="transform" type="rotate" values="0 160 126;-28 160 126;0 160 126" dur="2s" repeatCount="indefinite"/>`
    },
    squat:{
      body:`<animateTransform attributeName="transform" type="translate" values="0 0;0 34;0 0" dur="1.8s" repeatCount="indefinite"/>`,
      left:`<animateTransform attributeName="transform" type="rotate" values="0 160 126;26 160 126;0 160 126" dur="1.8s" repeatCount="indefinite"/>`,
      right:`<animateTransform attributeName="transform" type="rotate" values="0 160 126;-26 160 126;0 160 126" dur="1.8s" repeatCount="indefinite"/>`
    },
    ankle:{
      right:`<animateTransform attributeName="transform" type="rotate" from="0 188 184" to="360 188 184" dur="1.8s" repeatCount="indefinite"/>`
    },
    kneewall:{
      body:`<animateTransform attributeName="transform" type="translate" values="0 0;18 0;0 0" dur="2s" repeatCount="indefinite"/>`
    },
    calf:{
      body:`<animateTransform attributeName="transform" type="translate" values="0 0;0 -15;0 0" dur="1.6s" repeatCount="indefinite"/>`
    },
    bridge:{
      torso:`<animateTransform attributeName="transform" type="translate" values="0 0;0 -25;0 0" dur="1.9s" repeatCount="indefinite"/>`
    },
    birddog:{
      right:`<animateTransform attributeName="transform" type="rotate" values="0 160 78;-55 160 78;0 160 78" dur="2s" repeatCount="indefinite"/>`,
      leftleg:`<animateTransform attributeName="transform" type="rotate" values="0 160 126;52 160 126;0 160 126" dur="2s" repeatCount="indefinite"/>`
    },
    hip90:{
      leftleg:`<animateTransform attributeName="transform" type="rotate" values="-30 160 126;35 160 126;-30 160 126" dur="2.2s" repeatCount="indefinite"/>`,
      rightleg:`<animateTransform attributeName="transform" type="rotate" values="30 160 126;-35 160 126;30 160 126" dur="2.2s" repeatCount="indefinite"/>`
    },
    hiprot:{
      leftleg:`<animateTransform attributeName="transform" type="rotate" values="-22 160 126;24 160 126;-22 160 126" dur="2.2s" repeatCount="indefinite"/>`,
      rightleg:`<animateTransform attributeName="transform" type="rotate" values="22 160 126;-24 160 126;22 160 126" dur="2.2s" repeatCount="indefinite"/>`
    },
    kneeflex:{
      rightleg:`<animateTransform attributeName="transform" type="rotate" values="0 160 126;-58 160 126;0 160 126" dur="1.8s" repeatCount="indefinite"/>`
    },
    toe:{
      body:`<animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" dur="1.5s" repeatCount="indefinite"/>`
    },
    shift:{
      body:`<animateTransform attributeName="transform" type="translate" values="-16 0;16 0;-16 0" dur="2.2s" repeatCount="indefinite"/>`
    },
    breath:{
      focus:`<animate attributeName="r" values="25;42;25" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values=".2;.65;.2" dur="3s" repeatCount="indefinite"/>`
    },
    general:{focus:`<animate attributeName="opacity" values=".15;.65;.15" dur="2s" repeatCount="indefinite"/>`}
  }[type]||{};

  const torsoAnim=anim.torso||anim.body||'';
  const headAnim=anim.body||'';
  const armLAnim=anim.left||anim.body||'';
  const armRAnim=anim.right||anim.body||'';
  const legLAnim=anim.leftleg||anim.left||anim.body||'';
  const legRAnim=anim.rightleg||anim.right||anim.body||'';
  const focusAnim=anim.focus||'';

  return `
    <svg viewBox="0 0 320 220" role="img" aria-label="Animação auxiliar de ${name}"
         style="display:block;width:100%;max-height:220px;margin:0 auto;overflow:visible">
      <defs>
        <filter id="mobGlow"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <marker id="mobArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3.5" orient="auto"><polygon points="0 0,7 3.5,0 7" fill="#e1262f"/></marker>
      </defs>

      <circle cx="160" cy="81" r="34" fill="none" stroke="#e1262f" stroke-width="3" opacity=".28">${focusAnim}</circle>

      <g>
        ${headAnim}
        <circle cx="160" cy="45" r="18" fill="#171717" stroke="#f4f4f4" stroke-width="5"/>
        <line x1="160" y1="63" x2="160" y2="126" stroke="#f4f4f4" stroke-width="9" stroke-linecap="round">${torsoAnim}</line>

        <line x1="160" y1="78" x2="115" y2="104" stroke="#f4f4f4" stroke-width="9" stroke-linecap="round">${armLAnim}</line>
        <line x1="160" y1="78" x2="205" y2="104" stroke="#f4f4f4" stroke-width="9" stroke-linecap="round">${armRAnim}</line>

        <line x1="160" y1="126" x2="132" y2="184" stroke="#f4f4f4" stroke-width="9" stroke-linecap="round">${legLAnim}</line>
        <line x1="160" y1="126" x2="188" y2="184" stroke="#f4f4f4" stroke-width="9" stroke-linecap="round">${legRAnim}</line>
      </g>

      <path d="M76 100 Q52 56 96 30" fill="none" stroke="#e1262f" stroke-width="6" stroke-linecap="round" marker-end="url(#mobArrowHead)" filter="url(#mobGlow)"/>
      <path d="M244 100 Q268 56 224 30" fill="none" stroke="#e1262f" stroke-width="6" stroke-linecap="round" marker-end="url(#mobArrowHead)" filter="url(#mobGlow)"/>

      <text x="160" y="210" text-anchor="middle" fill="#b7b7b7" font-size="12" font-weight="700">${name}</text>
    </svg>`;
}

function renderMobilityRoutine(){
  const r=MOBILITY_ROUTINES[mobilityRoutineKey];
  const box=byId('stretchList');
  if(!r||!box){renderStretch();return}
  const step=r.steps[mobilityStep];
  const pct=Math.round(((mobilityStep)/r.steps.length)*100);
  box.innerHTML=`
    <div class="mobility-routine-head">
      <button class="mobility-mini-back" onclick="backToMobilityHome()">← Rotinas</button>
      <div class="eyebrow">${r.title.toUpperCase()}</div>
      <h3>${r.title}</h3>
      <p>${r.subtitle}</p>
    </div>
    <div class="mobility-progress"><span style="width:${pct}%"></span></div>
    <div class="mobility-step-card">
      <div class="mobility-step-label">ETAPA ${mobilityStep+1} DE ${r.steps.length}</div>
      <h2>${step.name}</h2>
      <p>${step.detail}</p>
      <div class="mobility-animation-card">
        <div class="mobility-animation-label">ANIMAÇÃO GUIADA</div>
        ${mobilityHdVisual(step.name) || mobilityAnimationSvg(step.name)}
        <div class="mobility-animation-hint">Observe a mudança de posição e execute de forma lenta e controlada.</div>
      </div>
      <div id="mobilityClock" class="mobility-clock">${mobilityFmt(mobilityRemaining)}</div>
      <div class="mobility-controls">
        <button class="ghost" onclick="mobilityPrev()" ${mobilityStep===0?'disabled':''}>ANTERIOR</button>
        <button id="mobilityPlayBtn" class="primary" onclick="mobilityToggle()">${mobilityRunning?'PAUSAR':'INICIAR'}</button>
        <button class="ghost" onclick="mobilityNext()">${mobilityStep===r.steps.length-1?'CONCLUIR':'PRÓXIMO'}</button>
      </div>
    </div>
    <div class="mobility-list">
      ${r.steps.map((s,i)=>`
        <div class="mobility-list-row ${i===mobilityStep?'active':''} ${i<mobilityStep?'done':''}">
          <span>${i<mobilityStep?'✓':i+1}</span>
          <div><b>${s.name}</b><small>${mobilityFmt(s.time)}</small></div>
        </div>`).join('')}
    </div>`;
}
function mobilityToggle(){
  const r=MOBILITY_ROUTINES[mobilityRoutineKey];
  if(!r)return;
  if(mobilityRunning){mobilityStopTick();renderMobilityRoutine();saveNavigationState('stretch');return}
  if(mobilityRemaining<=0)mobilityRemaining=r.steps[mobilityStep].time;
  mobilityRunning=true;
  saveNavigationState('stretch');
  const btn=byId('mobilityPlayBtn'); if(btn)btn.textContent='PAUSAR';
  mobilityTick=setInterval(()=>{
    mobilityRemaining=Math.max(0,mobilityRemaining-1);
    const clock=byId('mobilityClock'); if(clock)clock.textContent=mobilityFmt(mobilityRemaining);
    if(mobilityRemaining<=0){
      mobilityStopTick();
      try{navigator.vibrate?.([120,80,120])}catch(e){}
      if(mobilityStep<r.steps.length-1){
        mobilityStep++;
        mobilityRemaining=r.steps[mobilityStep].time;
        renderMobilityRoutine();
        saveNavigationState('stretch');
      }else{
        renderMobilityComplete();
      }
    }
  },1000);
}
function mobilityPrev(){
  const r=MOBILITY_ROUTINES[mobilityRoutineKey]; if(!r)return;
  mobilityStopTick();
  mobilityStep=Math.max(0,mobilityStep-1);
  mobilityRemaining=r.steps[mobilityStep].time;
  renderMobilityRoutine();
  saveNavigationState('stretch');
}
function mobilityNext(){
  const r=MOBILITY_ROUTINES[mobilityRoutineKey]; if(!r)return;
  mobilityStopTick();
  if(mobilityStep>=r.steps.length-1){renderMobilityComplete();saveNavigationState('stretch');return}
  mobilityStep++;
  mobilityRemaining=r.steps[mobilityStep].time;
  renderMobilityRoutine();
  saveNavigationState('stretch');
}
function renderMobilityComplete(){
  mobilityStopTick();
  const r=MOBILITY_ROUTINES[mobilityRoutineKey];
  const box=byId('stretchList'); if(!box||!r)return;
  box.innerHTML=`
    <div class="mobility-complete">
      <div class="mobility-complete-icon">✓</div>
      <div class="eyebrow">ROTINA CONCLUÍDA</div>
      <h2>${r.title}</h2>
      <p>${r.steps.length} etapas finalizadas • ${r.duration}</p>
      <button class="primary" onclick="backToMobilityHome()">VOLTAR ÀS ROTINAS</button>
    </div>`;
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
try{reconcileWorkoutHistory();}catch(e){console.warn('Reconcile startup:',e)}
try{migrateWorkoutQuality();}catch(e){console.warn('Migration startup:',e)}
try{updateLast();}catch(e){console.warn('Last startup:',e)}
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
const params=new URLSearchParams(location.search);const direct=Number(params.get('exercise'));if(direct)setTimeout(()=>openExercise(direct),50);



localStorage.setItem('t2_app_version','v67.36');



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
  openPlans('custom');
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




/* ===== V67.26 — NAVEGAÇÃO INTERNA + RESTAURAÇÃO ===== */
function restorePlanContext(state){
  try{
    const saved=JSON.parse(localStorage.getItem('t2_active_plan')||'null');
    if(saved&&typeof saved.serviceDay==='boolean'){
      v66WorkoutServiceDay=saved.serviceDay;
      sessionStorage.setItem(V66_SERVICE_KEY,saved.serviceDay?'1':'0');
    }
  }catch(e){}

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

function restoreNavigationState(force=false){
  if(!cloudSession?.token)return;

  // V67.29 — em uma abertura nova do PWA/site, começa sempre na página inicial.
  // A restauração da tela anterior fica restrita a recarregamento da página
  // (F5/atualizar) e ao botão Voltar/Avançar do navegador.
  if(!force && !NAV_RESTORE_ON_BOOT){
    clearNavigationState();
    navRestoring=true;
    try{
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      byId('home')?.classList.add('active');
      window.scrollTo({top:0,behavior:'auto'});
      window.history.replaceState({t2App:true,snapshot:appHistorySnapshot('home')},'',location.href);
    }catch(e){}
    finally{navRestoring=false}
    return;
  }

  let state=null;
  try{state=JSON.parse(sessionStorage.getItem(NAV_STATE_KEY)||'null')}catch(e){}
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
        if(state.mobilityRoutineKey && MOBILITY_ROUTINES[state.mobilityRoutineKey]){
          mobilityStopTick();
          mobilityRoutineKey=state.mobilityRoutineKey;
          const r=MOBILITY_ROUTINES[mobilityRoutineKey];
          mobilityStep=Math.max(0,Math.min(Number(state.mobilityStep)||0,r.steps.length-1));
          mobilityRemaining=Math.max(0,Number(state.mobilityRemaining)||r.steps[mobilityStep]?.time||0);
          mobilityRunning=false;
          renderMobilityRoutine();
        }else{
          renderStretch();
        }
        break;
      case 'coreOperational':
        loadCoreServiceChoice();
        showView('coreOperational');
        if(state.coreRoutineKey && CORE_OPERATIONAL_ROUTINES[state.coreRoutineKey]){
          if(coreServiceDay===null){ renderCoreOperational(); break; }
          coreRoutineStartedAt=new Date().toISOString();
          coreCompletionSaved=false;
          coreStopTick();
          coreRoutineKey=state.coreRoutineKey;
          const r=CORE_OPERATIONAL_ROUTINES[coreRoutineKey];
          coreStep=Math.max(0,Math.min(Number(state.coreStep)||0,r.steps.length-1));
          coreRemaining=Math.max(0,Number(state.coreRemaining)||r.steps[coreStep]?.time||0);
          coreRunning=false;
          renderCoreRoutine();
        }else{
          renderCoreOperational();
        }
        break;
      case 'tools':
        showView('tools');
        break;
      case 'taf':
        openTAF();
        break;
      case 'v55Profile':
        openV55Profile();
        break;
      case 'v55Ranking':
        showView('v55Ranking');
        v55LoadRanking();
        break;
      case 'officialTafRanking':
        if(typeof officialTafState!=='undefined'){
          officialTafState.edition=state.officialTafEdition||officialTafState.edition;
          officialTafState.scope=state.officialTafScope||'all';
          officialTafState.exercise=state.officialTafExercise||'pushup';
        }
        openOfficialTafRanking();
        break;
      case 'admin':
        openAdmin();
        break;
      case 'customBuilder':
        openCustomBuilder(state.customBuilderEditingId||null);
        break;
      case 'workoutDone':
        renderHistory();
        showView('history');
        break;
      case 'workoutChooser':
        restoreWorkoutChooserV667(state);
        break;
      case 'freeWorkout':
        restoreFreeWorkoutV667(state);
        break;
      case 'cardioWorkout':
        restoreCardioWorkoutV6733(state);
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
    const activeNow=document.querySelector('.view.active')?.id||'home';
    saveNavigationState(activeNow);

    // Se uma tela foi restaurada após um reload, garante que o History API
    // represente de fato essa tela. Assim, o botão Voltar do Android retorna
    // para a tela anterior em vez de encerrar o PWA.
    try{
      const currentState=window.history.state;
      if(activeNow!=='home' && (!currentState?.t2App || currentState?.snapshot?.view!==activeNow)){
        if(!currentState?.t2App){
          window.history.replaceState({t2App:true,snapshot:appHistorySnapshot('home')},'',location.href);
        }
        window.history.pushState({t2App:true,snapshot:appHistorySnapshot(activeNow)},'',location.href);
      }else if(activeNow==='home'){
        window.history.replaceState({t2App:true,snapshot:appHistorySnapshot('home')},'',location.href);
      }
    }catch(e){}
  }
}

window.addEventListener('beforeunload',()=>{
  const active=document.querySelector('.view.active')?.id||'home';
  try{
    const s=navStateSnapshot(active);
    s.scrollY=window.scrollY||0;
    sessionStorage.setItem(NAV_STATE_KEY,JSON.stringify(s));
  }catch(e){}
});

/* ===== V41 — ACESSO INDIVIDUAL POR MATRÍCULA / SUPABASE ===== */
const CLOUD_SESSION_KEY='t2_matricula_session_v41';
const CLOUD_TRACKED_KEYS=['t2_history','t2_workouts','t2_active_plan','t2_last','t2_custom_workouts','t2_taf_records','t2_taf_profile','t2_profile_photo_v6717'];
const CLOUD_LOCAL_OWNER_KEY='t2_local_owner_v52';
const CLOUD_CLEAN_MIGRATION_PREFIX='t2_clean_migration_v53_';
let cloudSession=null, cloudApplying=false, cloudSyncTimer=null;
let cloudPushPromise=null, cloudRetryTimer=null, cloudRetryCount=0;
let v6719StorageAlertShown=false;
const _t2SetItem=Storage.prototype.setItem;
const _t2RemoveItem=Storage.prototype.removeItem;

function v6719IsQuotaError(e){
  return !!e && (e.name==='QuotaExceededError' || e.name==='NS_ERROR_DOM_QUOTA_REACHED' || e.code===22 || e.code===1014);
}
function v6719StorageWarning(){
  if(v6719StorageAlertShown)return;
  v6719StorageAlertShown=true;
  setTimeout(()=>alert('O armazenamento deste navegador está quase cheio. Seus dados já sincronizados continuam na nuvem. Evite limpar os dados do site e conecte-se à internet para concluir a sincronização.'),0);
}
Storage.prototype.setItem=function(k,v){
  try{
    _t2SetItem.call(this,k,v);
  }catch(e){
    if(this===localStorage && v6719IsQuotaError(e))v6719StorageWarning();
    throw e;
  }
  if(this===localStorage && CLOUD_TRACKED_KEYS.includes(k) && !cloudApplying) cloudScheduleSync();
};
Storage.prototype.removeItem=function(k){
  _t2RemoveItem.call(this,k);
  if(this===localStorage && CLOUD_TRACKED_KEYS.includes(k) && !cloudApplying) cloudScheduleSync();
};


function cloudCurrentOwner(){ return String(localStorage.getItem(CLOUD_LOCAL_OWNER_KEY)||''); }
function cloudSetOwner(matricula){
  const m=cloudNormalize(matricula);
  if(m) _t2SetItem.call(localStorage,CLOUD_LOCAL_OWNER_KEY,m);
  else _t2RemoveItem.call(localStorage,CLOUD_LOCAL_OWNER_KEY);
}
function cloudClearTrackedLocal(){
  cloudApplying=true;
  try{
    CLOUD_TRACKED_KEYS.forEach(k=>_t2RemoveItem.call(localStorage,k));
    try{sessionStorage.removeItem(NAV_STATE_KEY)}catch(e){}
    try{_t2RemoveItem.call(localStorage,LEGACY_NAV_STATE_KEY)}catch(e){}
  }finally{cloudApplying=false}
  try{updateLast()}catch(e){}
}
function cloudEnsureOwner(matricula,clearOnMismatch=true){
  const next=cloudNormalize(matricula);
  const current=cloudNormalize(cloudCurrentOwner());
  if(!next)return false;
  if(current!==next){
    if(clearOnMismatch)cloudClearTrackedLocal();
    cloudSetOwner(next);
    return false;
  }
  return true;
}

function cloudMigrationKey(matricula){
  return CLOUD_CLEAN_MIGRATION_PREFIX+cloudNormalize(matricula);
}
function cloudNeedsCleanMigration(matricula){
  const m=cloudNormalize(matricula);
  if(!m)return false;
  return localStorage.getItem(cloudMigrationKey(m))!=='1';
}
function cloudMarkCleanMigration(matricula){
  const m=cloudNormalize(matricula);
  if(m)_t2SetItem.call(localStorage,cloudMigrationKey(m),'1');
}

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
  try{serviceDirectAfterAuth()}catch(e){}
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
  v6718RenderHomeProfilePhoto();
}
function cloudSnapshot(){
  let active=null;
  try{active=JSON.parse(localStorage.getItem('t2_active_plan')||'null')}catch(e){}
  return {
    ownerMatricula: cloudSession?.matricula || cloudCurrentOwner() || '',
    history:history(),
    workouts:workoutHistory(),
    customWorkouts:typeof getCustomWorkouts==='function'?getCustomWorkouts():[],
    tafRecords:typeof tafGetRecords==='function'?tafGetRecords():[],
    tafProfile:typeof tafGetProfile==='function'?tafGetProfile():{},
    profilePhoto:localStorage.getItem('t2_profile_photo_v6717')||'',
    activePlan:active,
    last:localStorage.getItem('t2_last')||'',
    savedAt:new Date().toISOString()
  };
}
function cloudNormalizeRemoteData(v){
  if(!v)return {};
  if(typeof v==='string'){
    try{return JSON.parse(v)||{}}catch(e){return {}}
  }
  return (typeof v==='object')?v:{};
}
function cloudDataCounts(d={}){
  return {
    history:Array.isArray(d.history)?d.history.length:0,
    workouts:Array.isArray(d.workouts)?d.workouts.length:0,
    custom:Array.isArray(d.customWorkouts)?d.customWorkouts.length:0
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
    tafRecords:cloudMergeArray(local.tafRecords,remote.tafRecords),
    tafProfile:Object.assign({},remote.tafProfile||{},local.tafProfile||{}),
    profilePhoto:local.profilePhoto||remote.profilePhoto||'',
    activePlan:local.activePlan||remote.activePlan||null,
    last:local.last||remote.last||'',
    savedAt:new Date().toISOString()
  };
}
function cloudApply(d){
  if(cloudSession?.matricula) cloudSetOwner(cloudSession.matricula);
  cloudApplying=true;
  try{
    _t2SetItem.call(localStorage,'t2_history',JSON.stringify(d.history||[]));
    _t2SetItem.call(localStorage,'t2_workouts',JSON.stringify(d.workouts||[]));
    _t2SetItem.call(localStorage,'t2_custom_workouts',JSON.stringify(d.customWorkouts||[]));
    _t2SetItem.call(localStorage,'t2_taf_records',JSON.stringify(d.tafRecords||[]));
    _t2SetItem.call(localStorage,'t2_taf_profile',JSON.stringify(d.tafProfile||{}));
    if(d.profilePhoto)_t2SetItem.call(localStorage,'t2_profile_photo_v6717',d.profilePhoto); else _t2RemoveItem.call(localStorage,'t2_profile_photo_v6717');
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
    const nextSession={token:row.token,matricula:cloudNormalize(row.matricula||matricula),nome:row.nome||'Militar',graduacao:row.graduacao||''};
    cloudEnsureOwner(nextSession.matricula,true);
    cloudSaveSession(nextSession);
    await cloudInitialSync(true);
    await adminRefreshVisibility();
    cloudMsg('');
    cloudHideGate();
  }catch(e){
    console.error(e);
    if(e&&e.name==='AbortError')cloudMsg('O Supabase demorou para responder. Tente novamente.','error');
    else cloudMsg('Não foi possível acessar. Verifique sua conexão e tente novamente.','error');
  }
}
async function cloudValidate(){
  if(!cloudSession?.token)return false;
  if(!navigator.onLine)return null;
  try{
    const row=await cloudRpc('validar_sessao_militar',{p_token:cloudSession.token});
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
async function cloudInitialSync(freshLogin=false){
  if(!navigator.onLine||!cloudSession?.token)return false;
  const status=document.getElementById('cloudUserStatus');
  const sameOwner=cloudEnsureOwner(cloudSession.matricula,true);
  try{
    if(status)status.textContent='Sincronizando…';
    const remoteRow=await cloudRpc('ler_dados_militar',{p_token:cloudSession.token});
    if(!remoteRow?.autorizado)throw new Error('Sessão inválida');
    const remote=cloudNormalizeRemoteData(remoteRow.dados);
    let finalData;
    if(freshLogin||!sameOwner){
      finalData={
        ownerMatricula:cloudSession.matricula,
        history:Array.isArray(remote.history)?remote.history:[],
        workouts:Array.isArray(remote.workouts)?remote.workouts:[],
        customWorkouts:Array.isArray(remote.customWorkouts)?remote.customWorkouts:[],
        tafRecords:Array.isArray(remote.tafRecords)?remote.tafRecords:[],
        tafProfile:(remote.tafProfile&&typeof remote.tafProfile==='object')?remote.tafProfile:{},
        profilePhoto:typeof remote.profilePhoto==='string'?remote.profilePhoto:'',
        activePlan:remote.activePlan||null,
        last:remote.last||'',
        savedAt:remote.savedAt||new Date().toISOString()
      };
    }else{
      finalData=cloudMerge(cloudSnapshot(),remote);
      finalData.ownerMatricula=cloudSession.matricula;
    }
    cloudApply(finalData);
    if(freshLogin||!sameOwner) cloudMarkCleanMigration(cloudSession.matricula);
    const saved=await cloudRpc('salvar_dados_militar',{p_token:cloudSession.token,p_dados:finalData});
    if(saved?.salvo!==true)throw new Error('Servidor não confirmou o salvamento');
    if(status)status.textContent='Sincronizado';
    const active=document.querySelector('.view.active')?.id;
    if(active==='history')renderHistory();
    if(active==='progress')renderProgress();
    updateLast();
    return true;
  }catch(e){
    console.warn('Falha de sincronização inicial:',e);
    if(status)status.textContent='Pendente';
    return false;
  }
}
function cloudScheduleSync(){
  if(!cloudConfigured()||!cloudSession?.token||cloudApplying||!navigator.onLine)return;
  if(cloudNormalize(cloudCurrentOwner())!==cloudNormalize(cloudSession.matricula))return;
  clearTimeout(cloudSyncTimer);
  const s=document.getElementById('cloudUserStatus');if(s)s.textContent='Salvando…';
  cloudSyncTimer=setTimeout(cloudPushNow,1200);
}
function v6719ScheduleCloudRetry(){
  if(!cloudSession?.token||!navigator.onLine)return;
  clearTimeout(cloudRetryTimer);
  const waits=[5000,15000,45000,90000];
  const wait=waits[Math.min(cloudRetryCount,waits.length-1)];
  cloudRetryCount=Math.min(cloudRetryCount+1,waits.length-1);
  cloudRetryTimer=setTimeout(()=>{cloudRetryTimer=null;cloudPushNow();},wait);
}
async function v6719CloudPushInner(){
  if(!cloudSession?.token||!navigator.onLine)return false;
  if(cloudNormalize(cloudCurrentOwner())!==cloudNormalize(cloudSession.matricula))return false;
  const status=document.getElementById('cloudUserStatus');
  try{
    if(status)status.textContent='Salvando…';
    const snapshot=cloudSnapshot();
    let result=null,lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      try{
        result=await cloudRpc('salvar_dados_militar',{p_token:cloudSession.token,p_dados:snapshot});
        if(result?.salvo===true)break;
      }catch(e){
        lastError=e;
        if(attempt===0)await new Promise(r=>setTimeout(r,900));
      }
    }
    if(result?.salvo===true){
      clearTimeout(cloudRetryTimer);cloudRetryTimer=null;cloudRetryCount=0;
      if(status)status.textContent='Sincronizado';
      return true;
    }
    if(lastError)throw lastError;
    const validity=await cloudValidate();
    if(validity===false){
      cloudSaveSession(null);
      cloudShowGate();
      cloudMsg('Matrícula inativa ou acesso encerrado. Procure o administrador.','error');
      return false;
    }
    if(status)status.textContent='Pendente';
    v6719ScheduleCloudRetry();
    return false;
  }catch(e){
    console.warn('Falha temporária de sincronização:',e);
    if(status)status.textContent='Pendente';
    v6719ScheduleCloudRetry();
    return false;
  }
}
async function cloudPushNow(){
  if(cloudPushPromise)return cloudPushPromise;
  cloudPushPromise=v6719CloudPushInner().finally(()=>{cloudPushPromise=null});
  return cloudPushPromise;
}
async function cloudLogout(){
  if(!confirm('Sair deste acesso neste aparelho?'))return;
  try{if(cloudSession?.token&&navigator.onLine)await cloudPushNow();}catch(e){}
  try{if(cloudSession?.token&&navigator.onLine)await cloudRpc('encerrar_sessao_militar',{p_token:cloudSession.token});}catch(e){}
  try{adminSessionToken='';sessionStorage.removeItem(ADMIN_SESSION_KEY);}catch(e){}
  adminSetEntryVisible(false);
  clearNavigationState();
  cloudClearTrackedLocal();
  cloudSetOwner('');
  cloudSaveSession(null);
  cloudMsg('');
  cloudShowGate();
}
async function cloudInit(){
  cloudLoadSession();
  if(!cloudConfigured()){cloudShowGate();cloudMsg('Configuração da nuvem ausente.','error');return;}

  if(cloudSession?.token){
    const owner=cloudNormalize(cloudCurrentOwner());
    const currentMat=cloudNormalize(cloudSession.matricula);

    // V53: uma única vez por matrícula neste aparelho, descarta qualquer
    // dado local herdado das versões anteriores e restaura da nuvem.
    // Isso corrige aparelhos que já estavam contaminados antes da V52.
    const forceClean=cloudNeedsCleanMigration(currentMat);
    const needsFreshRestore=forceClean || owner!==currentMat;

    if(needsFreshRestore){
      cloudClearTrackedLocal();
      cloudSetOwner(currentMat);
    }

    if(!navigator.onLine){
      adminSetEntryVisible(false);
      cloudHideGate();
      const status=document.getElementById('cloudUserStatus');
      if(status && forceClean) status.textContent='Aguardando internet';
      return;
    }

    const validity=await cloudValidate();

    if(validity===true){
      await cloudInitialSync(needsFreshRestore);
      await adminRefreshVisibility();
      cloudHideGate();
      return;
    }

    if(validity===null){
      cloudHideGate();
      const status=document.getElementById('cloudUserStatus');
      if(status)status.textContent='Pendente';
      return;
    }

    if(validity===false){
      cloudClearTrackedLocal();
      cloudSetOwner('');
      cloudSaveSession(null);
      cloudShowGate();
      cloudMsg('Matrícula inativa ou acesso encerrado.','error');
      return;
    }
  }

  cloudShowGate();
}


/* ===== V65 — MEU TAF ===== */
const TAF_RECORDS_KEY='t2_taf_records';
const TAF_PROFILE_KEY='t2_taf_profile';

function tafGetRecords(){
  try{const x=JSON.parse(localStorage.getItem(TAF_RECORDS_KEY)||'[]');return Array.isArray(x)?x:[]}
  catch(e){return []}
}
function tafSaveRecords(list){ localStorage.setItem(TAF_RECORDS_KEY,JSON.stringify(list||[])); }
function tafGetProfile(){
  try{const x=JSON.parse(localStorage.getItem(TAF_PROFILE_KEY)||'{}');return x&&typeof x==='object'?x:{}}
  catch(e){return {}}
}
function tafSaveProfile(p){ localStorage.setItem(TAF_PROFILE_KEY,JSON.stringify(p||{})); }

function tafAgeBand(age){
  age=Number(age);
  if(age>=18&&age<=22)return 0;if(age<=27)return 1;if(age<=32)return 2;if(age<=37)return 3;
  if(age<=42)return 4;if(age<=47)return 5;if(age<=52)return 6;if(age<=56)return 7;if(age<=60)return 8;
  return -1;
}
function tafSwimBand(age){
  age=Number(age);
  if(age>=18&&age<=22)return 0;if(age<=27)return 1;if(age<=32)return 2;if(age<=37)return 3;if(age>=38)return 4;
  return -1;
}
function tafTimeInput(el){
  if(!el)return;
  const raw=String(el.value||'').replace(/\D/g,'').slice(0,4);
  if(!raw){el.value='';return}
  if(raw.length<=2){el.value=raw;return}
  const sec=raw.slice(-2);
  const min=raw.slice(0,-2).replace(/^0+(?=\d)/,'')||'0';
  el.value=`${min}:${sec}`;
}
function tafParseTime(v){
  const s=String(v||'').trim();
  if(!s)return null;
  if(/^\d+:\d{1,2}$/.test(s)){
    const [m,sec]=s.split(':').map(Number);
    if(sec>=60)return null;
    return m*60+sec;
  }
  const digits=s.replace(/\D/g,'');
  if(digits.length>=3){
    const sec=Number(digits.slice(-2)), min=Number(digits.slice(0,-2));
    if(sec>=60)return null;
    return min*60+sec;
  }
  const n=Number(digits);
  return Number.isFinite(n)?n:null;
}
function tafFmtTime(sec){
  if(sec==null||!Number.isFinite(sec))return '—';
  sec=Math.max(0,Math.round(sec));
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}
function tafPace1600(sec){
  if(sec==null)return '—';
  return tafFmtTime(sec/1.6)+'/km';
}
function tafPaceSwim(sec){
  if(sec==null)return '—';
  return tafFmtTime(sec)+'/100m';
}
function tafScoreRange(value, rows, lowerBetter=false){
  value=Number(value);
  if(!Number.isFinite(value))return null;
  for(let pts=10;pts>=0;pts--){
    const r=rows[pts];
    if(!r)continue;
    const [min,max]=r;
    if(lowerBetter){
      if(value>=min && value<=max)return pts;
    }else{
      if(value>=min && value<=max)return pts;
    }
  }
  return 0;
}
function tafRepScore(kind,age,reps){
  const b=tafAgeBand(age); if(b<0)return null;
  const tables={
    pushup:[
      [[0,24],[25,27],[28,30],[31,34],[35,37],[38,40],[41,44],[45,47],[48,50],[51,54],[55,999]],
      [[0,19],[20,22],[23,26],[27,29],[30,32],[33,36],[37,39],[40,42],[43,46],[47,49],[50,999]],
      [[0,15],[16,18],[19,22],[23,25],[26,28],[29,32],[33,35],[36,38],[39,42],[43,45],[46,999]],
      [[0,12],[13,15],[16,18],[19,22],[23,25],[26,28],[29,32],[33,35],[36,38],[39,42],[43,999]],
      [[0,9],[10,12],[13,15],[16,19],[20,22],[23,25],[26,29],[30,32],[33,35],[36,39],[40,999]],
      [[0,6],[7,9],[10,12],[13,16],[17,19],[20,22],[23,26],[27,29],[30,32],[33,36],[37,999]],
      [[0,3],[4,7],[8,10],[11,13],[14,17],[18,20],[21,23],[24,27],[28,30],[31,33],[34,999]],
      [[0,2],[3,3],[4,6],[7,9],[10,13],[14,16],[17,19],[20,23],[24,26],[27,29],[30,999]],
      [[0,0],[1,1],[2,2],[3,5],[6,9],[10,12],[13,15],[16,19],[20,22],[23,25],[26,999]]
    ],
    bar:[
      [[0,4],[5,6],[7,7],[8,8],[9,10],[11,12],[13,14],[15,15],[16,17],[18,20],[21,999]],
      [[0,2],[3,3],[4,5],[6,6],[7,7],[8,9],[10,11],[12,13],[14,15],[16,17],[18,999]],
      [[0,0],[1,1],[2,3],[4,4],[5,6],[7,7],[8,9],[10,11],[12,13],[14,15],[16,999]],
      [[0,0],[1,1],[2,3],[4,4],[5,6],[7,8],[9,10],[11,12],[13,14],[15,15],[16,999]],
      [[0,0],[1,1],[2,2],[3,5],[6,7],[8,8],[9,9],[10,10],[11,11],[12,12],[13,999]],
      [[0,0],[1,1],[2,3],[4,6],[7,7],[8,8],[9,9],[10,10],[11,11],[12,999],[13,999]],
      [[0,0],[999,998],[999,998],[999,998],[1,2],[3,5],[4,6],[7,7],[8,8],[9,9],[10,999]],
      [[0,0],[999,998],[999,998],[999,998],[1,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,999]],
      [[0,0],[999,998],[999,998],[999,998],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,999]]
    ],
    abs:[
      [[0,31],[32,33],[34,36],[37,39],[40,41],[42,44],[45,47],[48,49],[50,52],[53,55],[56,999]],
      [[0,27],[28,30],[31,32],[33,35],[36,38],[39,40],[41,43],[44,46],[47,48],[49,51],[52,999]],
      [[0,23],[24,26],[27,29],[30,32],[33,34],[35,37],[38,40],[41,42],[43,45],[46,48],[49,999]],
      [[0,20],[21,23],[24,26],[27,28],[29,31],[32,34],[35,36],[37,39],[40,42],[43,44],[45,999]],
      [[0,17],[18,20],[21,23],[24,26],[27,28],[29,31],[32,34],[35,36],[37,39],[40,42],[43,999]],
      [[0,15],[16,18],[19,20],[21,23],[24,26],[27,28],[29,31],[32,34],[35,36],[37,39],[40,999]],
      [[0,12],[13,15],[16,18],[19,21],[22,23],[24,26],[27,29],[29,31],[32,34],[35,37],[38,999]],
      [[0,8],[9,11],[12,14],[15,17],[18,19],[20,22],[23,25],[24,27],[28,30],[31,33],[34,999]],
      [[0,4],[5,7],[8,10],[11,13],[14,15],[16,18],[19,21],[22,23],[24,26],[27,29],[30,999]]
    ]
  };
  const col=tables[kind]?.[b]; if(!col)return null;
  for(let pts=10;pts>=0;pts--){const r=col[pts];if(reps>=r[0]&&reps<=r[1])return pts}
  return 0;
}
function tafRunScore(age,sec){
  const b=tafAgeBand(age); if(b<0||sec==null)return null;
  const cols=[
    [531,850,819,787,716,404,390,379,366,354,332],
    [547,906,514,484,452,420,408,395,382,369,350],
    [566,925,532,500,469,438,425,412,400,387,366],
    [583,942,550,519,487,456,443,429,418,405,385],
    [601,1000,568,537,505,474,462,449,436,423,403],
    [620,1019,587,556,525,493,481,468,456,442,423],
    [653,1052,621,589,557,526,513,501,488,475,456],
    [713,1152,681,649,617,586,573,561,548,535,516],
    [773,1252,741,709,677,646,633,621,608,595,576]
  ];
  // Exact ranges from table, represented as max thresholds by score.
  const thresholds=[
    [530,499,467,436,404,390,379,366,354,332],
    [546,514,484,452,420,408,395,382,369,350],
    [565,532,500,469,438,425,412,400,387,366],
    [582,550,519,487,456,443,429,418,405,385],
    [600,568,537,505,474,462,449,436,423,403],
    [619,587,556,525,493,481,468,456,442,423],
    [652,621,589,557,526,513,501,488,475,456],
    [712,681,649,617,586,573,561,548,535,516],
    [772,741,709,677,646,633,621,608,595,576]
  ][b];
  // score 10 if faster than the score-9 lower boundary shown in table
  if(sec < thresholds[9]) return 10;
  // Score ranges, descending from 9 to 1, based on table boundaries
  const ranges=[
    null,
    [b===0?500:b===1?515:b===2?533:b===3?551:b===4?569:b===5?588:b===6?622:b===7?682:742, b===0?530:b===1?546:b===2?565:b===3?582:b===4?600:b===5?619:b===6?652:b===7?712:772],
    [b===0?468:b===1?485:b===2?501:b===3?520:b===4?538:b===5?557:b===6?590:b===7?650:710, b===0?499:b===1?514:b===2?532:b===3?550:b===4?568:b===5?587:b===6?621:b===7?681:741],
    [b===0?437:b===1?453:b===2?470:b===3?488:b===4?506:b===5?526:b===6?558:b===7?618:678, b===0?467:b===1?484:b===2?500:b===3?519:b===4?537:b===5?556:b===6?589:b===7?649:709],
    [b===0?405:b===1?421:b===2?439:b===3?457:b===4?475:b===5?494:b===6?527:b===7?587:647, b===0?436:b===1?452:b===2?469:b===3?487:b===4?505:b===5?525:b===6?557:b===7?617:677],
    [b===0?391:b===1?409:b===2?426:b===3?444:b===4?463:b===5?482:b===6?514:b===7?574:634, b===0?404:b===1?420:b===2?438:b===3?456:b===4?474:b===5?493:b===6?526:b===7?586:646],
    [b===0?380:b===1?396:b===2?413:b===3?430:b===4?450:b===5?469:b===6?502:b===7?562:622, b===0?390:b===1?408:b===2?425:b===3?443:b===4?462:b===5?481:b===6?513:b===7?573:633],
    [b===0?367:b===1?383:b===2?401:b===3?419:b===4?437:b===5?457:b===6?489:b===7?549:609, b===0?379:b===1?395:b===2?412:b===3?429:b===4?449:b===5?468:b===6?501:b===7?561:621],
    [b===0?355:b===1?370:b===2?388:b===3?406:b===4?424:b===5?443:b===6?476:b===7?536:596, b===0?366:b===1?382:b===2?400:b===3?418:b===4?436:b===5?456:b===6?488:b===7?548:608],
    [b===0?333:b===1?351:b===2?367:b===3?386:b===4?404:b===5?424:b===6?457:b===7?517:577, b===0?354:b===1?369:b===2?387:b===3?405:b===4?423:b===5?442:b===6?475:b===7?535:595]
  ];
  for(let pts=9;pts>=1;pts--){const r=ranges[pts];if(sec>=r[0]&&sec<=r[1])return pts}
  return 0;
}
function tafSwimScore(age,sec){
  const b=tafSwimBand(age); if(b<0||sec==null)return null;
  const ranges=[
    [[124,999],[117,123],[110,116],[105,109],[100,104],[96,99],[92,95],[88,91],[83,87],[78,82],[0,77]],
    [[127,999],[120,126],[113,119],[108,112],[103,107],[99,102],[95,98],[91,94],[86,90],[81,85],[0,80]],
    [[130,999],[123,129],[116,122],[111,115],[106,110],[102,105],[98,101],[94,97],[89,93],[84,88],[0,83]],
    [[134,999],[127,133],[120,126],[115,119],[110,114],[106,109],[102,105],[98,101],[93,97],[88,92],[0,87]],
    [[141,999],[134,140],[127,133],[122,126],[117,121],[113,116],[109,112],[105,108],[100,104],[95,99],[0,94]]
  ][b];
  for(let pts=10;pts>=0;pts--){const r=ranges[pts];if(sec>=r[0]&&sec<=r[1])return pts}
  return 0;
}
function tafClassify(sum,count,zeroed){
  if(zeroed)return {label:'INAPTO',cls:'bad'};
  if(count===4){
    if(sum<=8)return {label:'INAPTO',cls:'bad'};
    if(sum<=18)return {label:'REGULAR',cls:'warn'};
    if(sum<=28)return {label:'BOM',cls:'ok'};
    if(sum<=36)return {label:'MUITO BOM',cls:'great'};
    return {label:'EXCEPCIONAL',cls:'excellent'};
  }
  if(count===3){
    if(sum<=6)return {label:'INAPTO',cls:'bad'};
    if(sum<=14)return {label:'REGULAR',cls:'warn'};
    if(sum<=22)return {label:'BOM',cls:'ok'};
    if(sum<=27)return {label:'MUITO BOM',cls:'great'};
    return {label:'EXCEPCIONAL',cls:'excellent'};
  }
  return {label:'—',cls:''};
}
function openTAF(){
  renderTAF();
  showView('taf');
}
function renderTAF(){
  const box=byId('tafContent'); if(!box)return;
  const p=tafGetProfile();
  const rec=tafGetRecords();
  box.innerHTML=`
    <div class="taf-hero">
      <span class="eyebrow">APTIDÃO FÍSICA • CBMRN</span>
      <h3>Meu TAF</h3>
      <p>Registre seus índices oficiais e acompanhe sua evolução individual.</p>
    </div>

    <div class="card">
      <h3>Configuração</h3>
      <div class="taf-grid">
        <label>Idade
          <input id="tafAge" type="number" min="18" max="80" inputmode="numeric" value="${p.age||''}" oninput="tafProfileChanged()">
        </label>
        <label>Modalidade
          <select id="tafMode" onchange="tafProfileChanged()">
            <option value="4" ${String(p.mode||'4')==='4'?'selected':''}>4 exercícios</option>
            <option value="3" ${String(p.mode)==='3'?'selected':''}>3 exercícios (38+)</option>
          </select>
        </label>
        <label id="tafChoiceWrap" style="display:none">Escolha da força
          <select id="tafChoice" onchange="tafProfileChanged()">
            <option value="pushup" ${p.choice==='pushup'?'selected':''}>Flexão no chão</option>
            <option value="bar" ${p.choice==='bar'?'selected':''}>Flexão na barra</option>
          </select>
        </label>
      </div>
      <div id="tafRuleNote" class="taf-note"></div>
    </div>

    <div class="card">
      <h3>Novo registro</h3>
      <label>Data<input id="tafDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
      <div class="taf-test-grid">
        <div class="taf-test"><b>Flexão no chão</b><label>Repetições<input id="tafPushup" type="number" min="0" inputmode="numeric" oninput="tafPreview()"></label><span id="tafPushupPts">—</span></div>
        <div class="taf-test"><b>Flexão na barra</b><label>Repetições<input id="tafBar" type="number" min="0" inputmode="numeric" oninput="tafPreview()"></label><span id="tafBarPts">—</span></div>
        <div class="taf-test"><b>Abdominal remador</b><label>Repetições<input id="tafAbs" type="number" min="0" inputmode="numeric" oninput="tafPreview()"></label><span id="tafAbsPts">—</span></div>
        <div class="taf-test"><b>Corrida 1.600 m</b>
          <label>Seu tempo<input id="tafRun" placeholder="Digite 730 → 7:30" inputmode="numeric" maxlength="5" oninput="tafTimeInput(this);tafPreview()"></label>
          <div class="taf-metric"><span>Pace</span><b id="tafRunPace">—</b></div>
          <label>Tempo-meta<input id="tafRunGoal" placeholder="Digite 640 → 6:40" inputmode="numeric" maxlength="5" oninput="tafTimeInput(this);tafPreview()"></label>
          <div class="taf-metric"><span>Pace da meta</span><b id="tafRunGoalPace">—</b></div>
          <span id="tafRunPts">—</span>
        </div>
      </div>

      <div class="taf-extra">
        <div>
          <span class="eyebrow">EXERCÍCIO EXTRA • NÃO ALTERA O TAF PRINCIPAL</span>
          <h3>Natação 100 m</h3>
        </div>
        <label>Seu tempo<input id="tafSwim" placeholder="Digite 140 → 1:40" inputmode="numeric" maxlength="5" oninput="tafTimeInput(this);tafPreview()"></label>
        <div class="taf-metric"><span>Pace 100 m</span><b id="tafSwimPace">—</b></div>
        <label>Tempo-meta<input id="tafSwimGoal" placeholder="Digite 130 → 1:30" inputmode="numeric" maxlength="5" oninput="tafTimeInput(this);tafPreview()"></label>
        <div class="taf-metric"><span>Pace da meta</span><b id="tafSwimGoalPace">—</b></div>
        <div class="taf-swim-score-grid">
          <div><span>Pontuação provável</span><b id="tafSwimPts">—</b><small>resultado atual • máximo 10</small></div>
          <div><span>Pontuação da meta</span><b id="tafSwimGoalPts">—</b><small>simulação • máximo 10</small></div>
        </div>
      </div>

      <div id="tafPreviewBox" class="taf-result-box"></div>
      <label>Observação<input id="tafObs" placeholder="Ex.: simulado, teste oficial, pós-serviço"></label>
      <button class="big red" onclick="tafSaveCurrent()">SALVAR RESULTADO</button>
    </div>

    <div class="card">
      <h3>Histórico do TAF</h3>
      <div id="tafHistory">${rec.length?'':'<div class="custom-empty">Nenhum registro salvo ainda.</div>'}</div>
    </div>`;
  tafProfileChanged(false);
  tafRenderHistory();
}
function tafProfileChanged(save=true){
  const age=Number(byId('tafAge')?.value||0);
  const mode=String(byId('tafMode')?.value||'4');
  const choice=String(byId('tafChoice')?.value||'pushup');
  const wrap=byId('tafChoiceWrap');
  const note=byId('tafRuleNote');
  if(wrap)wrap.style.display=mode==='3'?'block':'none';
  if(note){
    if(mode==='3'&&age<38)note.innerHTML='<b>3 exercícios:</b> disponível apenas para militar com 38 anos ou mais.';
    else if(mode==='3')note.innerHTML='<b>3 exercícios:</b> corrida + abdominal + escolha entre flexão no chão ou barra.';
    else note.innerHTML='<b>4 exercícios:</b> corrida + abdominal + flexão no chão + barra.';
  }
  if(save)tafSaveProfile({age,mode,choice});
  tafPreview();
}
function tafPreview(){
  const age=Number(byId('tafAge')?.value||0);
  const mode=String(byId('tafMode')?.value||'4');
  const choice=String(byId('tafChoice')?.value||'pushup');
  const push=Number(byId('tafPushup')?.value);
  const bar=Number(byId('tafBar')?.value);
  const abs=Number(byId('tafAbs')?.value);
  const run=tafParseTime(byId('tafRun')?.value);
  const swim=tafParseTime(byId('tafSwim')?.value);
  const runGoal=tafParseTime(byId('tafRunGoal')?.value);
  const swimGoal=tafParseTime(byId('tafSwimGoal')?.value);
  const pp=Number.isFinite(push)?tafRepScore('pushup',age,push):null;
  const bp=Number.isFinite(bar)?tafRepScore('bar',age,bar):null;
  const ap=Number.isFinite(abs)?tafRepScore('abs',age,abs):null;
  const rp=run!=null?tafRunScore(age,run):null;
  const sp=swim!=null?tafSwimScore(age,swim):null;
  const sgp=swimGoal!=null?tafSwimScore(age,swimGoal):null;
  if(byId('tafPushupPts'))byId('tafPushupPts').textContent=pp==null?'—':`${pp} ponto${pp===1?'':'s'}`;
  if(byId('tafBarPts'))byId('tafBarPts').textContent=bp==null?'—':`${bp} ponto${bp===1?'':'s'}`;
  if(byId('tafAbsPts'))byId('tafAbsPts').textContent=ap==null?'—':`${ap} ponto${ap===1?'':'s'}`;
  if(byId('tafRunPts'))byId('tafRunPts').textContent=rp==null?'—':`${rp} ponto${rp===1?'':'s'}`;
  if(byId('tafSwimPts'))byId('tafSwimPts').textContent=sp==null?'—':`${sp}/10`;
  if(byId('tafSwimGoalPts'))byId('tafSwimGoalPts').textContent=sgp==null?'—':`${sgp}/10`;
  if(byId('tafRunPace'))byId('tafRunPace').textContent=tafPace1600(run);
  if(byId('tafRunGoalPace'))byId('tafRunGoalPace').textContent=tafPace1600(runGoal);
  if(byId('tafSwimPace'))byId('tafSwimPace').textContent=tafPaceSwim(swim);
  if(byId('tafSwimGoalPace'))byId('tafSwimGoalPace').textContent=tafPaceSwim(swimGoal);

  let selected=[];
  if(mode==='4')selected=[pp,bp,ap,rp];
  else selected=[choice==='pushup'?pp:bp,ap,rp];
  const complete=selected.every(x=>x!=null);
  const sum=selected.reduce((a,b)=>a+(b||0),0);
  const zeroed=complete&&selected.some(x=>x===0);
  const cls=complete?tafClassify(sum,mode==='4'?4:3,zeroed):{label:'PREENCHA OS ÍNDICES',cls:''};
  const box=byId('tafPreviewBox');
  if(box)box.innerHTML=`<div><span>Pontuação principal</span><b>${complete?sum:'—'}${complete?` / ${mode==='4'?40:30}`:''}</b></div><div><span>Classificação</span><b class="${cls.cls}">${cls.label}</b></div>`;
}
function tafSaveCurrent(){
  const age=Number(byId('tafAge')?.value||0), mode=String(byId('tafMode')?.value||'4'), choice=String(byId('tafChoice')?.value||'pushup');
  if(age<18){alert('Informe a idade do militar.');return}
  if(mode==='3'&&age<38){alert('A opção de 3 exercícios é permitida somente a partir de 38 anos.');return}
  const vals={
    pushup:Number(byId('tafPushup')?.value),
    bar:Number(byId('tafBar')?.value),
    abs:Number(byId('tafAbs')?.value),
    run:tafParseTime(byId('tafRun')?.value),
    swim:tafParseTime(byId('tafSwim')?.value),
    runGoal:tafParseTime(byId('tafRunGoal')?.value),
    swimGoal:tafParseTime(byId('tafSwimGoal')?.value)
  };
  const pts={
    pushup:Number.isFinite(vals.pushup)?tafRepScore('pushup',age,vals.pushup):null,
    bar:Number.isFinite(vals.bar)?tafRepScore('bar',age,vals.bar):null,
    abs:Number.isFinite(vals.abs)?tafRepScore('abs',age,vals.abs):null,
    run:vals.run!=null?tafRunScore(age,vals.run):null,
    swim:vals.swim!=null?tafSwimScore(age,vals.swim):null
  };
  const selected=mode==='4'?[pts.pushup,pts.bar,pts.abs,pts.run]:[choice==='pushup'?pts.pushup:pts.bar,pts.abs,pts.run];
  if(!selected.every(x=>x!=null)){alert('Preencha todos os índices obrigatórios do TAF principal.');return}
  const sum=selected.reduce((a,b)=>a+b,0), zeroed=selected.some(x=>x===0), classification=tafClassify(sum,mode==='4'?4:3,zeroed).label;
  const r={
    id:'taf-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
    date:byId('tafDate')?.value||new Date().toISOString().slice(0,10),
    age,mode,choice,values:vals,points:pts,sum,classification,
    obs:String(byId('tafObs')?.value||'').trim(),
    savedAt:new Date().toISOString()
  };
  const list=tafGetRecords(); list.unshift(r); tafSaveRecords(list);
  tafSaveProfile({age,mode,choice});
  tafRenderHistory();
  alert('Resultado do TAF salvo.');
}
function tafDelete(id){
  if(!confirm('Excluir este registro do TAF?'))return;
  tafSaveRecords(tafGetRecords().filter(x=>x.id!==id)); tafRenderHistory();
}
function tafRenderHistory(){
  const box=byId('tafHistory'); if(!box)return;
  const list=tafGetRecords();
  if(!list.length){box.innerHTML='<div class="custom-empty">Nenhum registro salvo ainda.</div>';return}
  box.innerHTML=list.map(r=>`
    <div class="taf-history-item">
      <div class="taf-history-head"><div><b>${new Date(r.date+'T12:00:00').toLocaleDateString('pt-BR')}</b><small>${r.mode} exercícios • ${r.age} anos</small></div><button onclick="tafDelete('${r.id}')">×</button></div>
      <div class="taf-history-score"><strong>${r.sum}/${r.mode==='4'?40:30}</strong><span>${r.classification}</span></div>
      <div class="taf-history-grid">
        ${r.mode==='4'||r.choice==='pushup'?`<span>Flexão: <b>${Number.isFinite(r.values.pushup)?r.values.pushup:'—'}</b> (${r.points.pushup??'—'} pts)</span>`:''}
        ${r.mode==='4'||r.choice==='bar'?`<span>Barra: <b>${Number.isFinite(r.values.bar)?r.values.bar:'—'}</b> (${r.points.bar??'—'} pts)</span>`:''}
        <span>Abdominal: <b>${Number.isFinite(r.values.abs)?r.values.abs:'—'}</b> (${r.points.abs??'—'} pts)</span>
        <span>Corrida: <b>${tafFmtTime(r.values.run)}</b> • ${tafPace1600(r.values.run)} (${r.points.run??'—'} pts)</span>
        ${r.values.runGoal!=null?`<span>Meta corrida: <b>${tafFmtTime(r.values.runGoal)}</b> • ${tafPace1600(r.values.runGoal)}</span>`:''}
        ${r.values.swim!=null?`<span>Natação extra: <b>${tafFmtTime(r.values.swim)}</b> • ${tafPaceSwim(r.values.swim)} (${r.points.swim??'—'} pts)</span>`:''}
        ${r.values.swimGoal!=null?`<span>Meta natação: <b>${tafFmtTime(r.values.swimGoal)}</b> • ${tafPaceSwim(r.values.swimGoal)}</span>`:''}
      </div>
      ${r.obs?`<small class="taf-history-obs">${escapeCustomHtml(r.obs)}</small>`:''}
    </div>`).join('');
}

/* ===== V51 — ÁREA DO ADMINISTRADOR ===== */
const ADMIN_SESSION_KEY='t2_admin_session_v51';
let adminSessionToken=sessionStorage.getItem(ADMIN_SESSION_KEY)||'';
let adminMilitaresCache=[];
let adminIsAuthorized=!!adminSessionToken;


function adminSetEntryVisible(visible){
  adminIsAuthorized=!!visible;
  const card=document.getElementById('adminEntryCard');
  if(card)card.style.display=adminIsAuthorized?'block':'none';

  // Se a sessão administrativa ficou salva, mas a matrícula atual não é admin,
  // encerra apenas a sessão administrativa local.
  if(!adminIsAuthorized){
    adminSessionToken='';
    try{sessionStorage.removeItem(ADMIN_SESSION_KEY);}catch(e){}
    if(document.querySelector('.view.active')?.id==='admin') showView('tools');
  }
}

async function adminRefreshVisibility(){
  // V67.22: não apaga a sessão administrativa durante uma simples atualização da página.
  // Enquanto a verificação está em andamento, preserva o token já existente em sessionStorage.
  const card=document.getElementById('adminEntryCard');
  if(card && !adminIsAuthorized)card.style.display='none';
  if(!cloudSession?.token) return false;
  if(!navigator.onLine){
    if(adminSessionToken){adminIsAuthorized=true;if(card)card.style.display='block';return true;}
    return false;
  }
  try{
    const row=await cloudRpc('verificar_admin_militar',{p_token_militar:cloudSession.token});
    const ok=row?.administrador===true;
    adminSetEntryVisible(ok);
    return ok;
  }catch(e){
    console.warn('Não foi possível verificar perfil administrativo:',e);
    // Falha transitória de rede não deve deslogar o administrador.
    if(adminSessionToken){adminIsAuthorized=true;if(card)card.style.display='block';return true;}
    return false;
  }
}

function adminMsg(text,type=''){
  const el=document.getElementById('adminMessage');
  if(!el)return;
  el.textContent=text||'';
  el.className='admin-message '+type;
}
function adminEscape(v){
  return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
}
function openAdmin(){
  if(!adminIsAuthorized){
    showView('tools');
    return;
  }
  showView('admin');
  const login=document.getElementById('adminLoginBox');
  const panel=document.getElementById('adminPanel');
  if(adminSessionToken){
    login.style.display='none';
    panel.style.display='block';
    adminLoadMilitares();
  }else{
    login.style.display='block';
    panel.style.display='none';
    setTimeout(()=>document.getElementById('adminCode')?.focus(),100);
  }
}
async function adminLogin(){
  if(!cloudSession?.token){
    adminMsg('Entre primeiro com sua matrícula.','error');
    return;
  }
  const code=String(document.getElementById('adminCode')?.value||'').trim();
  if(!code){
    adminMsg('Informe o código administrativo.','error');
    return;
  }
  adminMsg('Verificando acesso…');
  try{
    const row=await cloudRpc('entrar_admin',{
      p_token_militar:cloudSession.token,
      p_codigo:code
    });
    if(!row?.autorizado||!row?.token){
      adminMsg('Acesso administrativo não autorizado.','error');
      return;
    }
    adminSessionToken=row.token;
    sessionStorage.setItem(ADMIN_SESSION_KEY,adminSessionToken);
    document.getElementById('adminCode').value='';
    document.getElementById('adminLoginBox').style.display='none';
    document.getElementById('adminPanel').style.display='block';
    adminMsg('');
    await adminLoadMilitares();
  }catch(e){
    console.error(e);
    adminMsg('Não foi possível validar o acesso administrativo.','error');
  }
}
async function adminLoadMilitares(){
  if(!adminSessionToken)return;
  const list=document.getElementById('adminMilitaryList');
  if(list) list.innerHTML='<div class="admin-loading">Carregando militares…</div>';
  try{
    const res=await cloudApi('/rest/v1/rpc/admin_listar_militares',{
      method:'POST',
      body:JSON.stringify({p_token:adminSessionToken})
    });
    const data=await res.json().catch(()=>[]);
    if(!res.ok) throw new Error(data?.message||'Falha ao listar');
    adminMilitaresCache=Array.isArray(data)?data:[];
    adminRenderMilitares();
  }catch(e){
    console.error(e);
    if(list)list.innerHTML='<div class="admin-empty">Não foi possível carregar a lista.</div>';
  }
}
function adminRenderMilitares(){
  const list=document.getElementById('adminMilitaryList');
  const search=String(document.getElementById('adminSearch')?.value||'').toLowerCase().trim();
  if(!list)return;
  const rows=adminMilitaresCache.filter(m=>{
    const hay=`${m.nome||''} ${m.matricula||''} ${m.graduacao||''}`.toLowerCase();
    return !search||hay.includes(search);
  });
  document.getElementById('adminMilitaryCount').textContent=`${adminMilitaresCache.length} militar${adminMilitaresCache.length===1?'':'es'}`;
  if(!rows.length){
    list.innerHTML='<div class="admin-empty">Nenhum militar encontrado.</div>';
    return;
  }
  list.innerHTML=rows.map(m=>`
    <div class="admin-military-row ${m.ativo?'':'is-inactive'}">
      <div class="admin-military-main">
        <b>${adminEscape(m.nome||'Sem nome')}</b>
        <span>${adminEscape(m.graduacao||'')} • Matrícula ${adminEscape(m.matricula||'')}</span>
      </div>
      <button class="${m.ativo?'admin-disable':'admin-enable'}"
        onclick="adminToggleMilitary('${adminEscape(m.matricula)}',${!m.ativo})">
        ${m.ativo?'DESATIVAR':'ATIVAR'}
      </button>
    </div>`).join('');
}
async function adminSaveMilitary(){
  if(!adminSessionToken)return;
  const matricula=cloudNormalize(document.getElementById('adminNewMatricula')?.value);
  const nome=String(document.getElementById('adminNewNome')?.value||'').trim();
  const graduacao=String(document.getElementById('adminNewGraduacao')?.value||'').trim();
  if(!matricula||!nome||!graduacao){
    adminMsg('Preencha matrícula, nome e graduação.','error');
    return;
  }
  adminMsg('Salvando militar…');
  try{
    const row=await cloudRpc('admin_salvar_militar',{
      p_token:adminSessionToken,
      p_matricula:matricula,
      p_nome:nome,
      p_graduacao:graduacao,
      p_ativo:true
    });
    if(row?.salvo!==true){
      adminMsg('O Supabase não confirmou o cadastro.','error');
      return;
    }
    document.getElementById('adminNewMatricula').value='';
    document.getElementById('adminNewNome').value='';
    document.getElementById('adminNewGraduacao').value='';
    adminMsg('Militar salvo com sucesso.','success');
    await adminLoadMilitares();
  }catch(e){
    console.error(e);
    adminMsg('Não foi possível salvar o militar.','error');
  }
}
async function adminToggleMilitary(matricula,ativo){
  if(!adminSessionToken)return;
  const action=ativo?'reativar':'desativar';
  if(!confirm(`Deseja ${action} a matrícula ${matricula}?`))return;
  try{
    const row=await cloudRpc('admin_alterar_status',{
      p_token:adminSessionToken,
      p_matricula:matricula,
      p_ativo:ativo
    });
    if(row?.salvo!==true)throw new Error('Não confirmado');
    adminMsg(`Matrícula ${ativo?'ativada':'desativada'} com sucesso.`,'success');
    await adminLoadMilitares();
  }catch(e){
    console.error(e);
    adminMsg('Não foi possível alterar o acesso.','error');
  }
}
async function adminChangeCode(){
  const atual=String(document.getElementById('adminCurrentCode')?.value||'').trim();
  const novo=String(document.getElementById('adminNewCode')?.value||'').trim();
  const confirmar=String(document.getElementById('adminConfirmCode')?.value||'').trim();
  if(!atual||!novo||!confirmar){
    adminMsg('Preencha os três campos do código.','error');
    return;
  }
  if(novo.length<8){
    adminMsg('O novo código deve ter pelo menos 8 caracteres.','error');
    return;
  }
  if(novo!==confirmar){
    adminMsg('A confirmação do novo código não confere.','error');
    return;
  }
  try{
    const row=await cloudRpc('admin_trocar_codigo',{
      p_token:adminSessionToken,
      p_codigo_atual:atual,
      p_codigo_novo:novo
    });
    if(row?.alterado!==true){
      adminMsg('Código atual incorreto ou alteração recusada.','error');
      return;
    }
    ['adminCurrentCode','adminNewCode','adminConfirmCode'].forEach(id=>document.getElementById(id).value='');
    adminMsg('Código administrativo alterado com sucesso.','success');
  }catch(e){
    console.error(e);
    adminMsg('Não foi possível alterar o código.','error');
  }
}
async function adminLogout(){
  try{
    if(adminSessionToken){
      await cloudRpc('admin_sair',{p_token:adminSessionToken});
    }
  }catch(e){}
  adminSessionToken='';
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  document.getElementById('adminPanel').style.display='none';
  document.getElementById('adminLoginBox').style.display='block';
  adminMsg('');
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
  if(validity===true)await cloudInitialSync(false);
});
window.addEventListener('offline',cloudRenderUser);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && cloudSession?.token && navigator.onLine){
    cloudInitialSync(false);
  }
});
async function v6719ImproveStorageDurability(){
  try{
    if(navigator.storage?.persist)await navigator.storage.persist();
    if(navigator.storage?.estimate){
      const est=await navigator.storage.estimate();
      if(est?.quota&&est?.usage&&est.usage/est.quota>0.88)v6719StorageWarning();
    }
  }catch(e){}
}
window.addEventListener('load',()=>{setTimeout(cloudInit,700);setTimeout(v6719ImproveStorageDurability,1200)});


/* V55 — PERFIL DO MILITAR + RANKING DE CONSTÂNCIA */
function v55Esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function v55MonthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function v55WorkoutDate(w){const d=new Date(w?.date||w?.finishedAt||w?.endedAt||0);return isNaN(d)?null:d}
function v55ValidWorkout(w){
  if(w?.excludedFromStats===true||w?.serviceDay!==true)return false;
  if(w?.workoutType==='core'){
    return w?.coreComplete===true && Number(w?.coreStepsPlanned||0)>=1 && Number(w?.coreStepsCompleted||0)>=Number(w?.coreStepsPlanned||0);
  }
  if(isCardioRecord(w))return Number(w?.duration||0)>=30&&w?.cardioServiceDay===true;
  if(w?.workoutType==='free')return Number(w?.duration||0)>=20&&Array.isArray(w?.muscleGroups)&&w.muscleGroups.length>=1;
  return Number(w?.exercisesDone||0)>=3&&Number(w?.sets||0)>=6;
}
function v6711LocalDayKey(w){
  const d=v55WorkoutDate(w); if(!d)return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function v6711RankingCategory(w){
  if(w?.workoutType==='core')return 'core';
  if(isCardioRecord(w)||w?.workoutType==='cardio'||w?.rankingCategory==='cardio')return 'cardio';
  return 'treino';
}
function v6735ServiceWindowKey(w){
  if(w?.serviceWindowKey)return String(w.serviceWindowKey);
  if(w?.serviceValidatedAt)return String(w.serviceValidatedAt);
  // Compatibilidade com registros anteriores à V67.35: enquanto não existe
  // identificador da janela, agrupa pelo dia local. Novos registros usam
  // serviceValidatedAt, inclusive quando a validação atravessa a meia-noite.
  const day=v6711LocalDayKey(w);
  return day?`legacy-day:${day}`:'';
}
function v6711CappedValidCount(records){
  // V67.36 — cada categoria pode pontuar no máximo uma vez por janela de validação.
  // Combinações permitidas para 2 pontos: treino + cardio, cardio + Core ou treino + Core.
  // Repetições da mesma categoria (treino+treino, cardio+cardio, Core+Core) permanecem
  // no Histórico e na Evolução, mas não acrescentam um segundo ponto.
  const groups=new Map();
  records.forEach(w=>{
    if(!v55ValidWorkout(w))return;
    const key=v6735ServiceWindowKey(w); if(!key)return;
    const cats=groups.get(key)||new Set();
    cats.add(v6711RankingCategory(w));
    groups.set(key,cats);
  });
  let total=0;
  groups.forEach(cats=>{ total+=Math.min(2,cats.size); });
  return total;
}
function v55Stats(){
 const all=workoutHistory().filter(w=>w?.excludedFromStats!==true), mk=v55MonthKey();
 const month=all.filter(w=>{const d=v55WorkoutDate(w);return d&&v55MonthKey(d)===mk});
 return {all:all.length,month:month.length,valid:v6711CappedValidCount(month),
 sets:all.reduce((a,w)=>a+(Number(w.sets)||0),0),volume:all.reduce((a,w)=>a+(Number(w.volume)||0),0),
 minutes:all.reduce((a,w)=>a+(Number(w.duration)||0),0)};
}
const V6717_PROFILE_PHOTO_KEY='t2_profile_photo_v6717';
function v6717ProfilePhoto(){return localStorage.getItem(V6717_PROFILE_PHOTO_KEY)||''}
function v6718RenderHomeProfilePhoto(){
  const badge=document.getElementById('cloudUserBadge');
  if(!badge)return;
  const photo=v6717ProfilePhoto();
  if(photo){
    badge.classList.add('has-photo');
    badge.innerHTML=`<img src="${photo}" alt="Foto do militar">`;
  }else{
    badge.classList.remove('has-photo');
    badge.textContent='BM';
  }
}
async function v6717ChooseProfilePhoto(input){
  const file=input?.files?.[0];
  if(!file)return;
  if(!String(file.type||'').startsWith('image/')){alert('Selecione uma imagem válida.');input.value='';return;}
  if(file.size>12*1024*1024){alert('A foto é muito grande. Escolha uma imagem de até 12 MB.');input.value='';return;}
  let url='';
  try{
    url=URL.createObjectURL(file);
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
    const side=Math.min(img.naturalWidth,img.naturalHeight);
    const sx=Math.max(0,(img.naturalWidth-side)/2), sy=Math.max(0,(img.naturalHeight-side)/2);
    let size=256,quality=0.74,data='';
    for(let attempt=0;attempt<5;attempt++){
      const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
      data=canvas.toDataURL('image/jpeg',quality);
      if(data.length<=135000)break;
      quality=Math.max(0.52,quality-0.08);
      if(attempt>=2)size=Math.max(192,size-32);
    }
    try{
      localStorage.setItem(V6717_PROFILE_PHOTO_KEY,data);
    }catch(e){
      if(v6719IsQuotaError(e)){
        alert('Não há espaço local suficiente para salvar a foto. Seus treinos não foram apagados. Libere espaço do navegador ou tente novamente depois.');
        input.value='';return;
      }
      throw e;
    }
    v6718RenderHomeProfilePhoto();
    input.value='';
    openV55Profile();
  }catch(e){
    console.error(e);alert('Não foi possível processar a foto. Tente outra imagem.');input.value='';
  }finally{
    if(url)try{URL.revokeObjectURL(url)}catch(e){}
  }
}
function openV55Profile(){
 const s=v55Stats(), box=document.getElementById('v55ProfileContent');
 const n=v55Esc(cloudSession?.nome||'Militar'),g=v55Esc(cloudSession?.graduacao||'BM'),m=cloudMask(cloudSession?.matricula||'');
 const photo=v6717ProfilePhoto();
 const avatar=photo?`<div class="v55-avatar has-photo" onclick="document.getElementById('v6717ProfilePhotoInput')?.click()" title="Trocar foto"><img src="${photo}" alt="Foto do perfil"></div>`:`<div class="v55-avatar" onclick="document.getElementById('v6717ProfilePhotoInput')?.click()" title="Adicionar foto">BM</div>`;
 box.innerHTML=`<div class="v55-profile-hero"><div class="v6717-avatar-wrap">${avatar}<button class="v6717-photo-btn" type="button" onclick="document.getElementById('v6717ProfilePhotoInput')?.click()">📷 ${photo?'Trocar foto':'Adicionar foto'}</button><input id="v6717ProfilePhotoInput" type="file" accept="image/*" hidden onchange="v6717ChooseProfilePhoto(this)"></div><div><small>PERFIL OPERACIONAL</small><h2>${n}</h2><span>${g} • Matrícula ${m}</span></div></div>
 <div class="v55-stat-grid"><div class="v55-stat"><b>${s.month}</b><span>Treinos no mês</span></div><div class="v55-stat"><b>${s.all}</b><span>Treinos totais</span></div><div class="v55-stat"><b>${s.sets}</b><span>Séries registradas</span></div><div class="v55-stat"><b>${s.minutes}</b><span>Minutos treinados</span></div></div>
 <div class="card"><h3>CONSTÂNCIA DO MÊS</h3><div class="v55-big">${s.month} <small>treinos realizados</small></div><p>A constância considera todos os treinos registrados no mês, mesmo quando não geram ponto no Ranking de Frequência. A pontuação do ranking continua seguindo as regras de validação de serviço e o limite diário.</p></div>
 <div class="card"><h3>VOLUME ACUMULADO</h3><div class="v55-big">${Math.round(s.volume).toLocaleString('pt-BR')} <small>kg</small></div></div>`;
 showView('v55Profile');
 saveNavigationState('v55Profile');
}
async function v55RpcAll(fn,payload){
 const r=await cloudApi('/rest/v1/rpc/'+fn,{method:'POST',body:JSON.stringify(payload)});const d=await r.json().catch(()=>[]);
 if(!r.ok)throw new Error((d&&(d.message||d.details))||'Falha no servidor');return Array.isArray(d)?d:[d];
}
let v55RankingMode='monthly';
let v55RankingMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);

function v55SetRankingMode(mode){
  v55RankingMode=mode==='annual'?'annual':'monthly';
  v55LoadRanking();
}

function v55RankingShiftMonth(delta){
  const now=new Date();
  const current=new Date(now.getFullYear(),now.getMonth(),1);
  const next=new Date(v55RankingMonth.getFullYear(),v55RankingMonth.getMonth()+Number(delta||0),1);
  if(next>current)return;
  v55RankingMonth=next;
  v55LoadRanking();
}

function v55RankingMonthNav(){
  if(v55RankingMode!=='monthly')return '';
  const now=new Date();
  const current=new Date(now.getFullYear(),now.getMonth(),1);
  const isCurrent=v55RankingMonth.getFullYear()===current.getFullYear()&&v55RankingMonth.getMonth()===current.getMonth();
  const label=v55RankingMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  return `<div class="v6715-month-nav" aria-label="Navegação por mês">
    <button type="button" onclick="v55RankingShiftMonth(-1)" aria-label="Mês anterior">‹</button>
    <strong>${label}</strong>
    <button type="button" onclick="v55RankingShiftMonth(1)" aria-label="Próximo mês" ${isCurrent?'disabled':''}>›</button>
  </div>`;
}

function v55RankingTabs(){
  return `<div class="v6714-ranking-tabs" role="tablist" aria-label="Período do ranking">
    <button type="button" class="${v55RankingMode==='monthly'?'active':''}" onclick="v55SetRankingMode('monthly')">MENSAL</button>
    <button type="button" class="${v55RankingMode==='annual'?'active':''}" onclick="v55SetRankingMode('annual')">ANUAL</button>
  </div>${v55RankingMonthNav()}`;
}

function v55RenderRankingRows(rows,mine){
  if(!rows.length)return '<div class="card"><p>Nenhum militar disponível para o ranking.</p></div>';
  return rows.map((r,i)=>`<div class="card v55-rank ${cloudNormalize(r.matricula)===mine?'me':''}"><div class="v55-pos">${i==0?'🥇':i==1?'🥈':i==2?'🥉':(i+1)+'º'}</div><div class="v55-person"><b>${v55Esc(r.nome)}</b><span>${v55Esc(r.graduacao||'BM')}</span></div><div class="v55-score"><b>${Number(r.treinos_validos||0)}</b><span>pontos</span></div></div>`).join('');
}

async function v55LoadAnnualRanking(year){
  const months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`);
  const batches=await Promise.all(months.map(p_mes=>v55RpcAll('ranking_constancia',{p_token_militar:cloudSession.token,p_mes})));
  const map=new Map();
  batches.flat().forEach(r=>{
    const key=cloudNormalize(r.matricula);
    if(!key)return;
    const cur=map.get(key)||{matricula:r.matricula,nome:r.nome,graduacao:r.graduacao,treinos_validos:0};
    cur.nome=r.nome||cur.nome;
    cur.graduacao=r.graduacao||cur.graduacao;
    cur.treinos_validos+=Number(r.treinos_validos||0);
    map.set(key,cur);
  });
  return [...map.values()].sort((a,b)=>Number(b.treinos_validos||0)-Number(a.treinos_validos||0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
}

async function openV55Ranking(){
  showView('v55Ranking');
  try{saveNavigationState()}catch(e){}
  try{await cloudPushNow();}catch(e){console.warn('Ranking: sincronização prévia pendente',e)}
  await v55LoadRanking();
  try{saveNavigationState()}catch(e){}
}
async function v55LoadRanking(){
 const box=document.getElementById('v55RankingContent');
 box.innerHTML=`${v55RankingTabs()}<div class="card"><p>Atualizando ranking…</p></div>`;
 if(!navigator.onLine||!cloudSession?.token){box.innerHTML=`${v55RankingTabs()}<div class="card"><p>Conecte-se à internet para consultar o ranking.</p></div>`;return}
 try{
   const now=new Date();
   const isAnnual=v55RankingMode==='annual';
   const rows=isAnnual
     ? await v55LoadAnnualRanking(now.getFullYear())
     : await v55RpcAll('ranking_constancia',{p_token_militar:cloudSession.token,p_mes:v55MonthKey(v55RankingMonth)});
   const mine=cloudNormalize(cloudSession.matricula);
   const periodLabel=isAnnual
     ? `Ranking ${now.getFullYear()} • acumulado de janeiro a dezembro`
     : '';
   const explain=isAnnual
     ? '<b>O Ranking Anual soma os pontos dos rankings mensais do ano.</b> Em cada janela de validação, cada categoria (Treino, Cardio ou Core) pode pontuar uma única vez, com teto de 2 pontos e apenas por combinação de categorias diferentes.'
     : '<b>Cada categoria válida pode somar no máximo 1 ponto de frequência dentro da mesma validação de serviço.</b> <b>Somente atividades realizadas durante uma validação de serviço ativa entram no ranking.</b> A validação exige o QR fixo da unidade e confirmação de localização no momento da leitura. Nos treinos prontos e personalizados, é necessário registrar pelo menos <b>3 exercícios e 6 séries</b>. No treino livre, é necessário informar grupo muscular e registrar pelo menos <b>20 minutos</b>. No <b>Cardio</b>, Esteira, Bicicleta Ergométrica e Simulador de Remo precisam ter pelo menos <b>30 minutos</b>; na Esteira também são registrados distância, calorias e pace. No <b>Core Operacional</b>, é necessário concluir <b>uma rotina completa</b>. O militar pode somar no máximo <b>2 pontos por validação</b>, somente com categorias diferentes: <b>Treino + Cardio</b>, <b>Cardio + Core</b> ou <b>Treino + Core</b>. Repetições da mesma categoria — <b>Treino + Treino</b>, <b>Cardio + Cardio</b> ou <b>Core + Core</b> — continuam aparecendo no Histórico e na Evolução, mas valem apenas 1 ponto daquela categoria. Atividades sem validação ativa ou que não atinjam os critérios valem 0 ponto.';
   box.innerHTML=`${v55RankingTabs()}<div class="v55-rank-title"><small>2ª CIA / 4º BBM</small><h2>Ranking de Frequência</h2>${periodLabel?`<p>${periodLabel}</p>`:''}</div>
   <div class="card v55-rank-explain"><h3>${isAnnual?'Como funciona o ranking anual?':'Como funciona a pontuação?'}</h3><p>${explain}</p></div>`+
   v55RenderRankingRows(rows,mine)+
   `<p class="v55-note">${isAnnual?'O total anual é a soma dos pontos mensais do ano, mantendo o teto de 2 pontos por janela e sem repetir a mesma categoria para pontuação.':'O ranking considera apenas registros válidos durante uma validação de serviço confirmada, com teto de 2 pontos por janela e no máximo 1 ponto por categoria.'} Cargas individuais não são exibidas.</p>`;
 }catch(e){console.error(e);box.innerHTML=`${v55RankingTabs()}<div class="card"><p>Não foi possível carregar o ranking agora.</p></div>`}
 saveNavigationState('v55Ranking');
}

// V66.4 — prepara a entrada atual sem criar uma tela duplicada no histórico.
window.addEventListener('load',()=>{
  setTimeout(ensureAppHistoryState,50);
});

window.addEventListener('pageshow',()=>setTimeout(ensureAppHistoryState,80));


/* ===== V67.13 — MODO DE TREINO + VALIDAÇÃO DE SERVIÇO OPERACIONAL ===== */
const SERVICE_DEVICE_KEY='t2_service_device_v6713';
const SERVICE_MODE_KEY='t2_service_activity_mode_v6713';
const SERVICE_DIRECT_KEY='t2_service_direct_entry_v6725';
const SERVICE_DIRECT_DONE_KEY='t2_service_direct_done_v6732';
// V67.31 — a entrada via QR só pode disparar o fluxo direto uma vez por abertura.
// Enquanto o usuário ainda não fez login, o QR fica no sessionStorage. Assim que a
// tela de escolha é exibida, ele é movido para memória e removido do sessionStorage;
// portanto, atualizar qualquer tela não reabre a validação.
let serviceDirectRuntimeEntry=null;
let serviceValidationStatus={valid:false,configured:false,loading:false};
let serviceActivityMode=null; // null | 'operational' | 'off'
let serviceValidationPendingChoice=false;
let serviceQrStream=null;
let serviceQrTimer=null;

/* ===== V67.25 — QR ÚNICO: ABRIR APP OU VALIDAR SERVIÇO ===== */
function serviceNormalizeQrValue(raw){
  const value=String(raw||'').trim();
  if(!value)return '';
  try{
    const u=new URL(value,location.href);
    const token=String(u.searchParams.get('qr')||u.searchParams.get('token')||'').trim();
    if(token)return token;
  }catch(e){}
  return value;
}
function serviceNavigationType(){
  try{return performance.getEntriesByType('navigation')?.[0]?.type||''}catch(e){return ''}
}
function serviceCleanDirectUrl(u){
  try{
    u=u||new URL(location.href);
    u.searchParams.delete('entrada');
    u.searchParams.delete('qr');
    u.searchParams.delete('token');
    const clean=u.pathname+(u.search?u.search:'')+(u.hash||'');
    window.history.replaceState(window.history.state||{},'',clean);
  }catch(e){}
}
function serviceMarkDirectDone(){
  try{sessionStorage.setItem(SERVICE_DIRECT_DONE_KEY,'1')}catch(e){}
}
function serviceCaptureDirectEntry(){
  try{
    const u=new URL(location.href);
    const mode=String(u.searchParams.get('entrada')||'').toLowerCase();
    const qr=String(u.searchParams.get('qr')||'').trim();
    const hasDirect=(mode==='servico'||mode==='treino'||mode==='quartel')&&qr;
    const isReload=serviceNavigationType()==='reload';
    const wasDone=sessionStorage.getItem(SERVICE_DIRECT_DONE_KEY)==='1';

    // V67.33 — se o militar já escolheu/validou e apenas atualizou a página,
    // jamais reabre o fluxo do QR, mesmo que o Android/PWA reapresente a URL original.
    if(isReload&&wasDone){
      sessionStorage.removeItem(SERVICE_DIRECT_KEY);
      serviceCleanDirectUrl(u);
      return null;
    }

    if(hasDirect){
      // Uma leitura nova do QR inicia um novo fluxo e libera a escolha novamente.
      sessionStorage.removeItem(SERVICE_DIRECT_DONE_KEY);
      const entry={qr:serviceNormalizeQrValue(qr),capturedAt:Date.now()};
      sessionStorage.setItem(SERVICE_DIRECT_KEY,JSON.stringify(entry));
      serviceCleanDirectUrl(u);
      return entry;
    }

    // Remove qualquer entrada antiga que tenha sobrado após um refresh concluído.
    if(isReload&&wasDone)sessionStorage.removeItem(SERVICE_DIRECT_KEY);
  }catch(e){}
  return null;
}
function serviceGetDirectEntry(){
  if(serviceDirectRuntimeEntry?.qr)return serviceDirectRuntimeEntry;
  try{
    const x=JSON.parse(sessionStorage.getItem(SERVICE_DIRECT_KEY)||'null');
    if(!x?.qr)return null;
    if(Date.now()-Number(x.capturedAt||0)>6*60*60*1000){sessionStorage.removeItem(SERVICE_DIRECT_KEY);return null}
    return x;
  }catch(e){return null}
}
function serviceConsumeDirectEntry(){
  const entry=serviceGetDirectEntry();
  if(!entry?.qr)return null;
  serviceDirectRuntimeEntry=entry;
  try{sessionStorage.removeItem(SERVICE_DIRECT_KEY)}catch(e){}
  return serviceDirectRuntimeEntry;
}
function serviceClearDirectEntry(){
  serviceDirectRuntimeEntry=null;
  try{sessionStorage.removeItem(SERVICE_DIRECT_KEY)}catch(e){}
}
function serviceDirectSetStatus(text,type=''){
  const el=byId('serviceDirectStatus');
  if(!el)return;
  el.textContent=text||'';
  el.className='service-direct-status '+type;
}
function serviceEnsureDirectModal(){
  let modal=byId('serviceDirectModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='serviceDirectModal';
  modal.className='service-direct-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="service-direct-sheet">
    <div class="service-direct-badge">🚒 2ª CIA / 4º BBM</div>
    <h2>QR DO APLICATIVO</h2>
    <p>Escolha como deseja acessar agora.</p>
    <button class="service-direct-btn operational" type="button" onclick="serviceDirectValidate()">
      <span>🚒</span><b>ESTOU DE SERVIÇO</b><small>Validar presença e liberar pontuação do treino</small>
    </button>
    <button class="service-direct-btn app" type="button" onclick="serviceDirectOpenApp()">
      <span>🏠</span><b>NÃO ESTOU DE SERVIÇO</b><small>Entrar normalmente no aplicativo</small>
    </button>
    <div id="serviceDirectStatus" class="service-direct-status"></div>
    <small class="service-direct-privacy">A localização é solicitada somente se você escolher validar o serviço operacional.</small>
  </div>`;
  document.body.appendChild(modal);
  return modal;
}
function serviceShowDirectChoice(){
  const entry=serviceGetDirectEntry();
  if(!entry)return false;
  if(!cloudSession?.token){
    const gate=document.querySelector('#authGate .auth-panel')||document.querySelector('#authGate .auth-shell')||byId('authGate');
    if(gate&&!byId('serviceDirectLoginHint')){
      const hint=document.createElement('div');
      hint.id='serviceDirectLoginHint';
      hint.className='service-direct-login-hint';
      hint.innerHTML='<b>📱 QR do aplicativo reconhecido.</b><br>Entre com sua matrícula. Depois você poderá escolher entre validar o serviço ou entrar normalmente no app.';
      const panel=document.querySelector('#authGate .auth-panel');
      if(panel && gate===panel) panel.insertBefore(hint, panel.firstChild); else gate.appendChild(hint);
    }
    return false;
  }
  byId('serviceDirectLoginHint')?.remove();
  // Consome a entrada persistida antes de exibir a escolha. O QR permanece somente
  // em memória nesta abertura, suficiente para serviceDirectValidate(), mas não
  // sobrevive a um refresh da Home, Treinos, Histórico, TAF, Core etc.
  if(!serviceConsumeDirectEntry())return false;
  const modal=serviceEnsureDirectModal();
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  serviceDirectSetStatus('');
  return true;
}
function serviceHideDirectChoice(){
  const modal=byId('serviceDirectModal');
  if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}
}
function serviceDirectOpenApp(){
  serviceMarkDirectDone();
  serviceClearDirectEntry();
  serviceHideDirectChoice();
  resetServiceActivityMode();
  showView('home');
}
async function serviceFinishDirectAsOperational(message){
  serviceMarkDirectDone();
  serviceClearDirectEntry();
  serviceHideDirectChoice();
  byId('serviceDirectLoginHint')?.remove();
  try{
    const u=new URL(location.href);
    serviceCleanDirectUrl(u);
    window.history.replaceState({t2App:true,snapshot:appHistorySnapshot('home')},'',location.href);
    sessionStorage.setItem(NAV_STATE_KEY,JSON.stringify({...appHistorySnapshot('home'),matricula:cloudSession?.matricula||''}));
  }catch(e){}
  setServiceActivityMode('operational');
  browserNavHandling=true;
  try{showView('home')}finally{browserNavHandling=false}
  try{window.history.replaceState({t2App:true,snapshot:appHistorySnapshot('home')},'',location.href)}catch(e){}
  saveNavigationState('home');
  if(message)alert(message);
}
async function serviceDirectValidate(){
  const entry=serviceGetDirectEntry();
  if(!entry?.qr){serviceDirectSetStatus('QR não reconhecido. Leia novamente o QR oficial do aplicativo.','error');return}
  if(!cloudSession?.token){serviceHideDirectChoice();cloudShowGate();serviceShowDirectChoice();return}
  if(!navigator.onLine){serviceDirectSetStatus('É necessário estar conectado à internet para validar o serviço.','error');return}
  serviceDirectSetStatus('Verificando validação atual…','loading');
  try{
    // V67.33 — uma validação já ativa nunca é renovada por uma nova leitura do QR.
    // Mantém exatamente o mesmo horário de expiração definido na primeira validação.
    const current=await refreshServiceValidationStatus();
    if(current?.valid===true){
      const expiry=current.expiresAt;
      await serviceFinishDirectAsOperational(`Serviço operacional já estava validado. Validade mantida até ${serviceFmtDate(expiry)}.`);
      return;
    }
    serviceDirectSetStatus('Confirmando sua localização…','loading');
    const pos=await getServicePosition();
    serviceDirectSetStatus('Validando presença na unidade…','loading');
    const row=await cloudRpc('validar_presenca_servico',{
      p_token_militar:cloudSession.token,
      p_qr_token:serviceNormalizeQrValue(entry.qr),
      p_lat:pos.coords.latitude,
      p_lon:pos.coords.longitude,
      p_accuracy:pos.coords.accuracy,
      p_device_id:serviceDeviceId()
    });
    if(row?.validado!==true)throw new Error(row?.mensagem||'Validação recusada.');
    serviceValidationStatus={...serviceValidationStatus,valid:true,configured:true,validatedAt:row.validado_em||new Date().toISOString(),expiresAt:row.expira_em||null,loading:false};
    await refreshServiceValidationStatus();
    const expiry=serviceValidationStatus.expiresAt||row.expira_em;
    await serviceFinishDirectAsOperational(`Serviço operacional validado com sucesso. Validade até ${serviceFmtDate(expiry)}.`);
  }catch(e){
    console.error(e);
    let msg=e?.message||'Não foi possível validar. Confirme sua localização e tente novamente.';
    if(e?.code===1)msg='Permissão de localização negada. Libere a localização para validar o serviço.';
    serviceDirectSetStatus(msg,'error');
  }
}
function serviceDirectAfterAuth(){setTimeout(()=>serviceShowDirectChoice(),120)}
const serviceDirectCaptured=serviceCaptureDirectEntry();
window.addEventListener('load',()=>setTimeout(()=>{
  if(serviceGetDirectEntry())serviceShowDirectChoice();
},900));

function serviceDeviceId(){
  let id=localStorage.getItem(SERVICE_DEVICE_KEY)||'';
  if(!id){
    try{id=crypto.randomUUID()}catch(e){id='dev-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
    localStorage.setItem(SERVICE_DEVICE_KEY,id);
  }
  return id;
}
function serviceFmtDate(v){
  if(!v)return '';
  try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return String(v)}
}
function resetServiceActivityMode(){
  serviceActivityMode=null;
  serviceValidationPendingChoice=false;
  try{sessionStorage.removeItem(SERVICE_MODE_KEY);sessionStorage.removeItem(V66_SERVICE_KEY)}catch(e){}
  v66WorkoutServiceDay=null;
  coreServiceDay=null;
}
function setServiceActivityMode(mode){
  serviceActivityMode=(mode==='operational'||mode==='off')?mode:null;
  try{
    if(serviceActivityMode)sessionStorage.setItem(SERVICE_MODE_KEY,serviceActivityMode);
    else sessionStorage.removeItem(SERVICE_MODE_KEY);
  }catch(e){}
  applyServiceValidationToWorkoutState();
  renderServiceValidationCards();
}
function applyServiceValidationToWorkoutState(){
  let value=null;
  if(serviceActivityMode==='off')value=false;
  if(serviceActivityMode==='operational')value=serviceValidationStatus?.valid===true?true:null;
  v66WorkoutServiceDay=value;
  coreServiceDay=value;
  try{
    if(value===true||value===false)sessionStorage.setItem(V66_SERVICE_KEY,value?'1':'0');
    else sessionStorage.removeItem(V66_SERVICE_KEY);
  }catch(e){}
}
function chooseOffDutyTraining(){
  serviceValidationPendingChoice=false;
  setServiceActivityMode('off');
}
async function chooseOperationalService(){
  if(serviceValidationStatus?.valid===true){
    serviceValidationPendingChoice=false;
    setServiceActivityMode('operational');
    return;
  }
  serviceValidationPendingChoice=true;
  await startServiceValidation();
}
function renderServiceValidationCards(){
  applyServiceValidationToWorkoutState();
  const targets=[
    ['serviceValidationCard','serviceValidationTitle','serviceValidationText','serviceValidationOperational','serviceValidationOff','serviceValidationHint'],
    ['coreServiceValidationCard','coreServiceValidationTitle','coreServiceValidationText','coreServiceValidationOperational','coreServiceValidationOff','coreServiceValidationHint']
  ];
  for(const ids of targets){
    const [cardId,titleId,textId,opId,offId,hintId]=ids;
    const card=byId(cardId),title=byId(titleId),text=byId(textId),op=byId(opId),off=byId(offId),hint=byId(hintId);
    if(!card)continue;
    card.classList.remove('valid','invalid','pending','off-duty');
    if(op)op.classList.toggle('selected',serviceActivityMode==='operational');
    if(off)off.classList.toggle('selected',serviceActivityMode==='off');

    if(serviceValidationStatus.loading){
      card.classList.add('pending');
      if(title)title.textContent='Verificando validação…';
      if(text)text.textContent='Consultando o servidor. Você também pode escolher treinar fora de serviço operacional.';
      if(hint)hint.textContent='Somente atividades com serviço operacional validado podem pontuar.';
      continue;
    }

    if(serviceActivityMode==='off'){
      card.classList.add('off-duty');
      if(title)title.textContent='🏠 FORA DE SERVIÇO OPERACIONAL';
      if(text)text.textContent='Treino liberado normalmente para histórico e evolução, sem pontuação no Ranking de Frequência.';
      if(hint)hint.textContent='Você pode treinar em academia particular, em casa ou durante a folga.';
      return void 0;
    }

    if(serviceActivityMode==='operational' && serviceValidationStatus.valid){
      card.classList.add('valid');
      if(title)title.textContent='🚒 SERVIÇO OPERACIONAL VALIDADO';
      if(text)text.innerHTML=`Presença confirmada. Validação disponível até <b>${serviceFmtDate(serviceValidationStatus.expiresAt)}</b>.`;
      if(hint)hint.textContent='Cada atividade válida: +1 ponto. Limite: até 2 pontos nesta validação operacional.';
      continue;
    }

    if(!serviceValidationStatus.configured){
      card.classList.add('invalid');
      if(title)title.textContent='COMO VOCÊ VAI TREINAR?';
      if(text)text.textContent='A validação operacional ainda precisa ser configurada pelo administrador. Treinos fora de serviço continuam disponíveis normalmente.';
      if(hint)hint.textContent='Escolha “Não estou de serviço operacional” para treinar sem pontuação.';
      continue;
    }

    card.classList.add('invalid');
    if(title)title.textContent='COMO VOCÊ VAI TREINAR?';
    if(serviceValidationStatus.valid){
      if(text)text.innerHTML=`Existe uma validação de presença ativa até <b>${serviceFmtDate(serviceValidationStatus.expiresAt)}</b>. Escolha se este treino é durante serviço operacional ou fora dele.`;
      if(hint)hint.textContent='Mesmo com validação ativa, escolher “Não estou de serviço operacional” impede pontuação.';
    }else{
      if(text)text.textContent='Se estiver de serviço operacional, valide sua presença pelo QR + localização. Se estiver de folga, continue sem pontuação.';
      if(hint)hint.textContent='A localização é consultada somente durante a validação operacional.';
    }
  }
}
async function refreshServiceValidationStatus(){
  if(!cloudSession?.token||!navigator.onLine){serviceValidationStatus={valid:false,configured:false,loading:false};renderServiceValidationCards();return serviceValidationStatus}
  serviceValidationStatus={...serviceValidationStatus,loading:true};renderServiceValidationCards();
  try{
    const row=await cloudRpc('status_validacao_servico',{p_token_militar:cloudSession.token});
    serviceValidationStatus={
      valid:row?.valido===true,
      configured:row?.configurado===true,
      validatedAt:row?.validado_em||null,
      expiresAt:row?.expira_em||null,
      unit:row?.unidade||'2ª CIA / 4º BBM',
      loading:false
    };
  }catch(e){console.warn('status_validacao_servico:',e);serviceValidationStatus={valid:false,configured:false,loading:false,error:true}}
  renderServiceValidationCards();return serviceValidationStatus;
}
function requireServiceChoice(){
  applyServiceValidationToWorkoutState();
  if(serviceActivityMode===null){alert('Escolha primeiro: “Validar serviço operacional” ou “Não estou de serviço operacional”.');return false}
  if(serviceActivityMode==='operational' && serviceValidationStatus?.valid!==true){alert('Para pontuar como serviço operacional, valide sua presença pelo QR da unidade e localização.');return false}
  return true;
}
function requireCoreServiceChoice(){return requireServiceChoice()}
function setWorkoutServiceDay(){return false}
function setCoreServiceDay(){return false}
function updateServiceChoiceUI(){renderServiceValidationCards()}
function updateCoreServiceChoiceUI(){renderServiceValidationCards()}
function loadCoreServiceChoice(){applyServiceValidationToWorkoutState();return coreServiceDay}

const _v6711OpenWorkoutChooser=openWorkoutChooser;
openWorkoutChooser=function(){
  resetServiceActivityMode();
  _v6711OpenWorkoutChooser();
  resetServiceActivityMode();
  refreshServiceValidationStatus();
};
const _v6711OpenCoreOperational=openCoreOperational;
openCoreOperational=function(){
  resetServiceActivityMode();
  _v6711OpenCoreOperational();
  resetServiceActivityMode();
  renderCoreOperational();
  refreshServiceValidationStatus();
};
const _v6711RenderCoreOperational=renderCoreOperational;
renderCoreOperational=function(){
  _v6711RenderCoreOperational();
  renderServiceValidationCards();
};

function stopServiceQrCamera(){
  if(serviceQrTimer){clearInterval(serviceQrTimer);serviceQrTimer=null}
  if(serviceQrStream){for(const t of serviceQrStream.getTracks())t.stop();serviceQrStream=null}
  const v=byId('serviceQrVideo');if(v)v.srcObject=null;
}
function closeServiceValidationScanner(){
  stopServiceQrCamera();
  serviceValidationPendingChoice=false;
  const m=byId('serviceQrModal');if(m){m.style.display='none';m.setAttribute('aria-hidden','true')}
}
async function startServiceValidation(){
  if(!cloudSession?.token){alert('Entre com sua matrícula antes de validar o serviço operacional.');return}
  if(!navigator.onLine){alert('A validação de serviço operacional precisa de internet.');return}
  if(serviceValidationStatus?.valid===true){setServiceActivityMode('operational');return}
  const m=byId('serviceQrModal'),st=byId('serviceQrScanStatus');
  if(m){m.style.display='flex';m.setAttribute('aria-hidden','false')}
  if(st)st.textContent='Abrindo câmera…';
  stopServiceQrCamera();
  if(!('BarcodeDetector' in window)){
    if(st)st.textContent='Leitura direta de QR indisponível neste navegador. Use a opção manual abaixo.';
    return;
  }
  try{
    const detector=new BarcodeDetector({formats:['qr_code']});
    serviceQrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const video=byId('serviceQrVideo');video.srcObject=serviceQrStream;await video.play();
    if(st)st.textContent='Aponte a câmera para o QR fixado na academia.';
    let busy=false;
    serviceQrTimer=setInterval(async()=>{
      if(busy||!video||video.readyState<2)return;busy=true;
      try{
        const codes=await detector.detect(video);
        const raw=String(codes?.[0]?.rawValue||'').trim();
        if(raw){clearInterval(serviceQrTimer);serviceQrTimer=null;await validateServiceQr(raw)}
      }catch(e){}
      busy=false;
    },350);
  }catch(e){console.error(e);if(st)st.textContent='Não foi possível usar a câmera. Verifique a permissão ou use a opção manual.'}
}
function getServicePosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Geolocalização indisponível.'));
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });
}
async function validateServiceQr(qr){
  const st=byId('serviceQrScanStatus');if(st)st.textContent='QR lido. Verificando validação atual…';
  try{
    const current=await refreshServiceValidationStatus();
    if(current?.valid===true){
      stopServiceQrCamera();
      const m=byId('serviceQrModal');if(m){m.style.display='none';m.setAttribute('aria-hidden','true')}
      serviceValidationPendingChoice=false;
      setServiceActivityMode('operational');
      alert(`Serviço operacional já estava validado. Validade mantida até ${serviceFmtDate(current.expiresAt)}.`);
      return;
    }
    if(st)st.textContent='QR lido. Confirmando localização…';
    const pos=await getServicePosition();
    if(st)st.textContent='Validando presença no servidor…';
    const row=await cloudRpc('validar_presenca_servico',{
      p_token_militar:cloudSession.token,p_qr_token:serviceNormalizeQrValue(qr),p_lat:pos.coords.latitude,p_lon:pos.coords.longitude,p_accuracy:pos.coords.accuracy,p_device_id:serviceDeviceId()
    });
    if(row?.validado!==true)throw new Error(row?.mensagem||'Validação recusada.');
    stopServiceQrCamera();
    const m=byId('serviceQrModal');if(m){m.style.display='none';m.setAttribute('aria-hidden','true')}
    serviceValidationStatus={...serviceValidationStatus,valid:true,configured:true,validatedAt:row.validado_em||new Date().toISOString(),expiresAt:row.expira_em||null,loading:false};
    serviceValidationPendingChoice=false;
    setServiceActivityMode('operational');
    await refreshServiceValidationStatus();
    setServiceActivityMode('operational');
    alert(`Serviço operacional validado com sucesso. Validade até ${serviceFmtDate(row.expira_em)}.`);
  }catch(e){console.error(e);if(st)st.textContent=e?.message||'Não foi possível validar. Confirme localização, QR e conexão.'}
}
function submitManualServiceQr(){
  const v=String(byId('serviceQrManual')?.value||'').trim();
  if(!v){alert('Cole o conteúdo do QR.');return}
  validateServiceQr(v);
}

async function adminLoadServiceConfig(){
  if(!adminSessionToken)return;
  const el=byId('adminServiceConfigStatus');
  try{
    const row=await cloudRpc('admin_ler_config_validacao',{p_token:adminSessionToken});
    if(byId('adminServiceRadius')&&row?.raio_m)byId('adminServiceRadius').value=row.raio_m;
    if(byId('adminServiceHours')&&row?.validade_horas)byId('adminServiceHours').value=row.validade_horas;
    if(el)el.innerHTML=row?.configurado===true
      ? `✅ Local configurado • raio de <b>${row.raio_m} m</b> • validação por <b>${row.validade_horas} h</b>.`
      : '⚠️ Local ainda não configurado. Vá fisicamente à academia e toque em “Definir local”.';
  }catch(e){if(el)el.textContent='Não foi possível consultar a configuração.'}
}
function adminServiceDateTime(value){
  if(!value)return '—';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '—';
  return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function adminServiceRemaining(value){
  if(!value)return '';
  const ms=new Date(value).getTime()-Date.now();
  if(!Number.isFinite(ms))return '';
  if(ms<=0)return 'Período encerrado';
  const mins=Math.ceil(ms/60000);
  const h=Math.floor(mins/60),m=mins%60;
  if(h>=24){const d=Math.floor(h/24),rh=h%24;return `${d}d ${rh}h restantes`;}
  return h>0?`${h}h ${m}min restantes`:`${m}min restantes`;
}
async function adminLoadServiceValidations(){
  if(!adminSessionToken)return;
  const box=byId('adminServiceValidations');
  if(box)box.innerHTML='<div class="admin-loading">Carregando validações…</div>';
  try{
    const res=await cloudApi('/rest/v1/rpc/admin_listar_validacoes_servico',{
      method:'POST',
      body:JSON.stringify({p_token:adminSessionToken})
    });
    const data=await res.json().catch(()=>[]);
    if(!res.ok)throw new Error(data?.message||'Falha ao listar validações');
    const rows=Array.isArray(data)?data:[];
    if(!box)return;
    if(!rows.length){
      box.innerHTML='<div class="admin-empty">Nenhuma validação de serviço encontrada nos últimos 7 dias.</div>';
      return;
    }
    box.innerHTML=rows.map(v=>{
      const active=v.ativo===true;
      const nome=adminEscape(v.nome||'Militar');
      const grad=adminEscape(v.graduacao||'');
      const mat=adminEscape(v.matricula||'');
      const distance=Number.isFinite(Number(v.distancia_m))?` • ${Math.round(Number(v.distancia_m))} m do ponto`:' ';
      return `<div class="admin-service-validation-row ${active?'is-active':'is-expired'}">
        <div class="admin-service-validation-main">
          <b>${grad?grad+' ':''}${nome}</b>
          <span>Matrícula ${mat}${distance}</span>
          <span class="admin-service-validation-period">Validado: <b>${adminServiceDateTime(v.validado_em)}</b><br>Até: <b>${adminServiceDateTime(v.expira_em)}</b></span>
        </div>
        <div class="admin-service-validation-meta">
          <span class="admin-service-validation-badge ${active?'active':'expired'}">${active?'ATIVO':'ENCERRADO'}</span>
          <span class="admin-service-validation-remain">${adminEscape(adminServiceRemaining(v.expira_em))}</span>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    console.error('admin_listar_validacoes_servico:',e);
    if(box)box.innerHTML='<div class="admin-empty">Não foi possível carregar as validações. Instale a atualização SQL da V67.14.</div>';
  }
}

async function adminConfigureServiceLocation(){
  if(!adminSessionToken)return;
  const radius=Math.max(30,Math.min(1000,Number(byId('adminServiceRadius')?.value||150)));
  const hours=Math.max(1,Math.min(48,Number(byId('adminServiceHours')?.value||26)));
  const el=byId('adminServiceConfigStatus');
  if(el)el.textContent='Obtendo localização precisa…';
  try{
    const pos=await getServicePosition();
    if(pos.coords.accuracy>150&&!confirm(`A precisão atual é de aproximadamente ${Math.round(pos.coords.accuracy)} m. Deseja salvar mesmo assim?`)){await adminLoadServiceConfig();return}
    const row=await cloudRpc('admin_configurar_validacao_servico',{p_token:adminSessionToken,p_lat:pos.coords.latitude,p_lon:pos.coords.longitude,p_raio_m:radius,p_validade_horas:hours});
    if(row?.salvo!==true)throw new Error('Configuração não confirmada.');
    if(el)el.textContent='✅ Localização da academia configurada com sucesso.';
    await adminLoadServiceConfig();
  }catch(e){console.error(e);if(el)el.textContent='❌ Não foi possível configurar. Libere a localização e tente novamente.'}
}

const _v6711OpenAdmin=openAdmin;
openAdmin=function(){_v6711OpenAdmin();if(adminSessionToken)setTimeout(()=>{adminLoadServiceConfig();adminLoadServiceValidations();},50)};
const _v6711AdminLoadMilitares=adminLoadMilitares;
adminLoadMilitares=async function(){const r=await _v6711AdminLoadMilitares();if(adminSessionToken){adminLoadServiceConfig();adminLoadServiceValidations();}return r};

window.addEventListener('online',()=>refreshServiceValidationStatus());
try{localStorage.setItem('t2_app_version','v67.36')}catch(e){}

/* ===== V67.21 — RANKING OFICIAL TAF ===== */
let officialTafState={edition:null,editions:[],rows:[],scope:'all',exercise:'pushup'};
const OFFICIAL_TAF_EXERCISES={bar:'Barras',pushup:'Flexões',abs:'Abdominais',run:'Corrida',swim:'Natação'};
function otEsc(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]))}
function otSec(v){if(v==null||v==='')return null;if(typeof v==='number')return v;const m=String(v).match(/(\d+)\D+(\d+)/);return m?Number(m[1])*60+Number(m[2]):Number(v)||null}
function otTime(sec){sec=Number(sec);if(!Number.isFinite(sec))return '—';return `${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,'0')}`}
function otNormalizeTimeInput(el){
  if(!el)return;
  let v=String(el.value||'').trim();
  if(!v)return;
  // Aceita 655 -> 6:55, 1255 -> 12:55, além de 6:55 / 6.55 / 6,55.
  if(/^\d{3,4}$/.test(v)){
    const mins=v.slice(0,-2);
    const secs=v.slice(-2);
    v=`${Number(mins)}:${secs}`;
  }
  const sec=otSec(v);
  if(sec!=null && Number.isFinite(Number(sec))) el.value=otTime(sec);
}
function otValue(r,k){
  if(k==='run')return otSec(r.run_seconds ?? r.run);
  if(k==='swim')return otSec(r.swim_seconds ?? r.swim);
  const n=Number(r[k]);return Number.isFinite(n)&&r[k]!==null&&r[k]!==''?n:null;
}
function otValueLabel(r,k){const v=otValue(r,k);if(v==null)return '—';return (k==='run'||k==='swim')?otTime(v):String(v)}
function otEligible(r,k){return otValue(r,k)!=null}
function otScopeRows(rows,scope){return scope==='38plus'?rows.filter(r=>r.faixa_etaria==='38+') : scope==='upto37'?rows.filter(r=>r.faixa_etaria==='ATE37') : rows}
function otRankExercise(rows,k){return rows.filter(r=>otEligible(r,k)).sort((a,b)=>{const av=otValue(a,k),bv=otValue(b,k);return (k==='run'||k==='swim'?av-bv:bv-av)||String(a.nome).localeCompare(String(b.nome),'pt-BR')})}
function otCompetitionRanks(rows,k){let last=null,rank=0;return otRankExercise(rows,k).map((r,i)=>{const v=otValue(r,k);if(last===null||v!==last)rank=i+1;last=v;return {r,rank,value:v}})}
function otScopeTabs(){return `<div class="ot-seg"><button class="${officialTafState.scope==='all'?'active':''}" onclick="officialTafSetScope('all')">GERAL</button><button class="${officialTafState.scope==='upto37'?'active':''}" onclick="officialTafSetScope('upto37')">ATÉ 37</button><button class="${officialTafState.scope==='38plus'?'active':''}" onclick="officialTafSetScope('38plus')">38+</button></div>`}
function otExerciseTabs(){return `<div class="ot-exercises">${Object.entries(OFFICIAL_TAF_EXERCISES).map(([k,n])=>`<button class="${officialTafState.exercise===k?'active':''}" onclick="officialTafSetExercise('${k}')">${n}</button>`).join('')}</div>`}
function officialTafSetScope(v){officialTafState.scope=v;saveNavigationState('officialTafRanking');renderOfficialTafRanking()}
function officialTafSetExercise(v){officialTafState.exercise=v;saveNavigationState('officialTafRanking');renderOfficialTafRanking()}
function officialTafSetEdition(v){officialTafState.edition=v;saveNavigationState('officialTafRanking');officialTafLoadRows()}
async function openOfficialTafRanking(){showView('officialTafRanking');const box=byId('officialTafRankingContent');if(box)box.innerHTML='<div class="card"><p>Carregando ranking oficial…</p></div>';try{const ed=await v55RpcAll('taf_oficial_listar_edicoes',{p_token_militar:cloudSession.token});officialTafState.editions=ed;officialTafState.edition=(officialTafState.edition&&ed.some(x=>x.codigo===officialTafState.edition))?officialTafState.edition:(ed[0]?.codigo||null);await officialTafLoadRows()}catch(e){console.error(e);if(box)box.innerHTML='<div class="card"><p>Não foi possível carregar o Ranking Oficial TAF.</p></div>'}}
async function officialTafLoadRows(){if(!officialTafState.edition)return renderOfficialTafRanking();try{officialTafState.rows=await v55RpcAll('taf_oficial_listar_resultados',{p_token_militar:cloudSession.token,p_edicao:officialTafState.edition});renderOfficialTafRanking()}catch(e){console.error(e);const box=byId('officialTafRankingContent');if(box)box.innerHTML='<div class="card"><p>Não foi possível carregar os índices desta edição.</p></div>'}}
function renderOfficialTafRanking(){
 const box=byId('officialTafRankingContent');if(!box)return;const ed=officialTafState.editions.find(x=>x.codigo===officialTafState.edition);const rows=otScopeRows(officialTafState.rows.filter(r=>r.participou!==false),officialTafState.scope);
 const editionSelect=officialTafState.editions.map(e=>`<option value="${otEsc(e.codigo)}" ${e.codigo===officialTafState.edition?'selected':''}>${otEsc(e.titulo||e.codigo)}</option>`).join('');
 const k=officialTafState.exercise;const ranked=otCompetitionRanks(rows,k);
 const content=otExerciseTabs()+(ranked.length?ranked.map(x=>`<div class="card ot-rank"><div class="ot-pos">${x.rank<=3?['🥇','🥈','🥉'][x.rank-1]:x.rank+'º'}</div><div class="ot-person"><b>${otEsc(x.r.nome)}</b><span>${otEsc(x.r.graduacao||'BM')} • ${x.r.faixa_etaria==='38+'?'38+':'Até 37'}</span></div><div class="ot-index"><b>${otValueLabel(x.r,k)}</b><span>${k==='run'||k==='swim'?'tempo':'repetições'}</span></div></div>`).join(''):`<div class="card"><p>Nenhum índice registrado para este exercício nesta seleção.</p></div>`);
 box.innerHTML=`<div class="ot-hero"><span class="eyebrow">2ª CIA / 4º BBM • RESULTADO OFICIAL</span><h2>🏆 Ranking Oficial TAF</h2><p>Classificação motivacional pelos melhores índices oficiais de cada exercício.</p><label>Edição<select onchange="officialTafSetEdition(this.value)">${editionSelect}</select></label></div>${otScopeTabs()}<div class="card ot-rule"><b>Como funciona o ranking?</b><p>Mais repetições classificam melhor em Barras, Flexões e Abdominais. Na Corrida e na Natação, o menor tempo fica à frente. Use GERAL para todo o efetivo ou filtre por Até 37 e 38+. Campo sem índice não é tratado como zero.</p></div>${content}<p class="v55-note">${ed?.observacao?otEsc(ed.observacao):'Dados oficiais alimentados pela Administração da unidade.'}</p>`;
}

/* Administração do TAF oficial — carregamento otimizado V67.21 */
const officialTafAdminCache={editions:[],rows:new Map()};
function officialTafAdminSetImmediateEdition(){
  const sel=byId('officialTafAdminEdition');
  if(!sel)return '2026.1';
  if(!sel.options.length){sel.innerHTML='<option value="2026.1">TAF 2026.1</option>';sel.value='2026.1'}
  return sel.value||'2026.1';
}
async function officialTafAdminLoad(){
  if(!adminSessionToken){
    const box=byId('officialTafAdminList');
    if(box)box.innerHTML='<div class="admin-empty">Sessão administrativa não encontrada. Entre novamente no Admin.</div>';
    return;
  }
  const sel=byId('officialTafAdminEdition'),box=byId('officialTafAdminList');
  const initialCode=officialTafAdminSetImmediateEdition();
  if(officialTafAdminCache.rows.has(initialCode))officialTafAdminRender(officialTafAdminCache.rows.get(initialCode));
  else if(box)box.innerHTML='<div class="admin-loading">Carregando índices oficiais…</div>';

  try{
    // V67.22: dispara as duas consultas juntas, mas mostra as edições assim que a
    // consulta pequena terminar. A lista não fica mais esperando todos os índices.
    const editionsPromise=v55RpcAll('admin_taf_oficial_listar_edicoes',{p_token:adminSessionToken});
    const initialRowsPromise=v55RpcAll('admin_taf_oficial_listar_resultados',{p_token:adminSessionToken,p_edicao:initialCode});

    const ed=await editionsPromise;
    officialTafAdminCache.editions=ed;

    let code=initialCode;
    if(sel){
      const keep=sel.value||initialCode;
      sel.innerHTML=ed.map(e=>`<option value="${otEsc(e.codigo)}">${otEsc(e.titulo||e.codigo)}</option>`).join('');
      code=ed.some(e=>e.codigo===keep)?keep:(ed[0]?.codigo||'');
      if(code)sel.value=code;
    }

    if(!code){
      if(box)box.innerHTML='<div class="admin-empty">Nenhuma edição cadastrada.</div>';
      return;
    }

    if(code===initialCode){
      const initialRows=await initialRowsPromise;
      officialTafAdminCache.rows.set(initialCode,initialRows);
      officialTafAdminRender(initialRows);
      return;
    }

    // A consulta inicial pode terminar em segundo plano; guarda no cache sem bloquear a edição escolhida.
    initialRowsPromise.then(rows=>officialTafAdminCache.rows.set(initialCode,rows)).catch(()=>{});

    if(officialTafAdminCache.rows.has(code)){
      officialTafAdminRender(officialTafAdminCache.rows.get(code));
      return;
    }

    if(box)box.innerHTML='<div class="admin-loading">Carregando índices oficiais…</div>';
    const rows=await v55RpcAll('admin_taf_oficial_listar_resultados',{p_token:adminSessionToken,p_edicao:code});
    officialTafAdminCache.rows.set(code,rows);
    officialTafAdminRender(rows);
  }catch(e){
    console.error(e);
    if(box)box.innerHTML='<div class="admin-empty">Não foi possível carregar o TAF oficial. Toque em ATUALIZAR ou reabra a Administração.</div>';
  }
}
function officialTafAdminRender(rows){const box=byId('officialTafAdminList');if(!box)return;box.innerHTML=rows.map(r=>`<div class="ot-admin-row" data-id="${r.id}"><div class="ot-admin-name"><b>${otEsc(r.nome)}</b><small>${otEsc(r.graduacao||'BM')}</small></div><div class="ot-admin-grid"><label>Faixa<select class="ot-age"><option value="ATE37" ${r.faixa_etaria==='ATE37'?'selected':''}>Até 37</option><option value="38+" ${r.faixa_etaria==='38+'?'selected':''}>38+</option></select></label><label>Barras<input class="ot-bar" type="number" min="0" value="${r.bar??''}"></label><label>Flexões<input class="ot-push" type="number" min="0" value="${r.pushup??''}"></label><label>Abd.<input class="ot-abs" type="number" min="0" value="${r.abs??''}"></label><label>Corrida<input class="ot-run" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="6:55" onblur="otNormalizeTimeInput(this)" value="${r.run_seconds!=null?otTime(r.run_seconds):''}"></label><label>Natação<input class="ot-swim" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="1:29" onblur="otNormalizeTimeInput(this)" value="${r.swim_seconds!=null?otTime(r.swim_seconds):''}"></label></div><div class="ot-admin-actions"><label><input class="ot-part" type="checkbox" ${r.participou!==false?'checked':''}> Participou</label><button onclick="officialTafAdminSave(${r.id})">SALVAR</button></div></div>`).join('')}
async function officialTafAdminSave(id){const row=document.querySelector(`.ot-admin-row[data-id="${id}"]`);if(!row)return;const val=(q)=>row.querySelector(q)?.value??'';try{await cloudRpc('admin_taf_oficial_salvar_resultado',{p_token:adminSessionToken,p_id:id,p_faixa_etaria:val('.ot-age'),p_bar:val('.ot-bar')===''?null:Number(val('.ot-bar')),p_pushup:val('.ot-push')===''?null:Number(val('.ot-push')),p_abs:val('.ot-abs')===''?null:Number(val('.ot-abs')),p_run_seconds:otSec(val('.ot-run')),p_swim_seconds:otSec(val('.ot-swim')),p_participou:row.querySelector('.ot-part').checked});officialTafAdminCache.rows.clear();adminMsg('Índice oficial salvo.','success')}catch(e){console.error(e);adminMsg('Não foi possível salvar o índice.','error')}}
async function officialTafAdminDeleteEdition(){
  if(!adminSessionToken)return;
  const sel=byId('officialTafAdminEdition');
  const code=String(sel?.value||'').trim();
  if(!code){adminMsg('Selecione uma edição para excluir.','error');return}
  const title=sel?.selectedOptions?.[0]?.textContent||code;
  if(!confirm(`Excluir definitivamente a edição ${title} e todos os índices vinculados a ela?\n\nEsta ação não pode ser desfeita.`))return;
  try{
    adminMsg('Excluindo edição…','');
    const row=await cloudRpc('admin_taf_oficial_excluir_edicao',{p_token:adminSessionToken,p_codigo:code});
    if(row?.excluido!==true){adminMsg('A edição não foi excluída.','error');return}
    officialTafAdminCache.editions=officialTafAdminCache.editions.filter(e=>e.codigo!==code);
    officialTafAdminCache.rows.delete(code);
    if(sel)Array.from(sel.options).find(o=>o.value===code)?.remove();
    const next=sel?.value||officialTafAdminCache.editions[0]?.codigo||'';
    if(sel&&next)sel.value=next;
    const box=byId('officialTafAdminList');
    if(!next){if(box)box.innerHTML='<div class="admin-empty">Nenhuma edição cadastrada.</div>';}
    else{
      if(box)box.innerHTML='<div class="admin-loading">Carregando edição…</div>';
      const rows=await v55RpcAll('admin_taf_oficial_listar_resultados',{p_token:adminSessionToken,p_edicao:next});
      officialTafAdminCache.rows.set(next,rows);officialTafAdminRender(rows);
    }
    adminMsg('Edição excluída com sucesso.','success');
  }catch(e){console.error(e);adminMsg('Não foi possível excluir a edição. Verifique se o SQL da V67.22 foi instalado.','error')}
}
async function officialTafAdminNewEdition(){const codeRaw=prompt('Código da nova edição (ex.: 2026.2):');if(!codeRaw)return;const code=codeRaw.trim();const title=(prompt('Título da edição:',`TAF ${code}`)||`TAF ${code}`).trim();try{adminMsg('Criando nova edição…','');await cloudRpc('admin_taf_oficial_criar_edicao',{p_token:adminSessionToken,p_codigo:code,p_titulo:title});const sel=byId('officialTafAdminEdition');if(sel&&!Array.from(sel.options).some(o=>o.value===code)){sel.insertAdjacentHTML('afterbegin',`<option value="${otEsc(code)}">${otEsc(title)}</option>`)}if(sel)sel.value=code;const box=byId('officialTafAdminList');if(box)box.innerHTML='<div class="admin-loading">Preparando nova edição…</div>';const rows=await v55RpcAll('admin_taf_oficial_listar_resultados',{p_token:adminSessionToken,p_edicao:code});officialTafAdminCache.rows.set(code,rows);officialTafAdminRender(rows);adminMsg('Nova edição criada com a tropa cadastrada.','success')}catch(e){console.error(e);adminMsg('Não foi possível criar a edição.','error')}}
const _v6721OpenAdmin=openAdmin;openAdmin=function(){_v6721OpenAdmin();if(adminSessionToken){officialTafAdminSetImmediateEdition();setTimeout(officialTafAdminLoad,20)}};

try{localStorage.setItem('t2_app_version','v67.36')}catch(e){}

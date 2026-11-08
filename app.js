'use strict';

// RepTrack v1 — all personal records remain in the browser unless explicitly exported.
const STORE_KEY = 'reptrack.data.v1';
const EXERCISES = [
  { id: 'chest', name: 'Chest press', type: 'machine', repLabel: 'Reps', target: '8–12 reps', note: 'Push handles forward; lower under control.' },
  { id: 'lat', name: 'Lat pulldown', type: 'machine', repLabel: 'Reps', target: '8–12 reps', note: 'Pull towards upper chest; avoid swinging.' },
  { id: 'squat', name: 'Squat to chair', type: 'body', repLabel: 'Reps', target: '10–12 reps', note: 'Sit back towards a stable chair, then stand.' },
  { id: 'row', name: 'Seated cable row', type: 'machine', repLabel: 'Reps', target: '8–12 reps', note: 'Pull handle towards waist, keeping back neutral.' },
  { id: 'leg', name: 'Leg extension', type: 'machine', repLabel: 'Reps', target: '10–15 reps', note: 'Straighten knees gently; avoid locking out.' },
  { id: 'bridge', name: 'Glute bridge', type: 'body', repLabel: 'Reps', target: '10–15 reps', note: 'Drive through heels, lifting hips without arching back.' },
  { id: 'plank', name: 'Plank', type: 'timed', repLabel: 'Seconds', target: '20–30 sec', note: 'Keep a straight line through shoulders, hips and heels.' }
];
const NAV = [
  { id: 'dashboard', name: 'Overview', icon: '◫' },
  { id: 'workout', name: 'Workout', icon: '▥' },
  { id: 'progress', name: 'Progress', icon: '↗' },
  { id: 'settings', name: 'Settings', icon: '⚙' }
];
const app = document.getElementById('app');
let currentTab = 'dashboard';
let toastTimer;
const dateLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateFromStr = str => new Date(`${str}T12:00:00`);
const offsetDate = n => { const d = new Date(); d.setDate(d.getDate() + n); return dateLocal(d); };
const id = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, places=0) => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-GB',{minimumFractionDigits:places, maximumFractionDigits:places}) : '—';
const niceDate = d => dateFromStr(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const today = () => dateLocal();
const blankSet = weight => ({ id:id(), kg:weight == null ? '' : String(weight), reps:'', done:false });
const defaultState = () => ({
  version:1, settings:{weightGoal:195, proteinGoal:170, caloriesGoal:2200, creatineDose:5},
  bodyWeights:[{id:id(),date:today(),lbs:208,note:'Starting weight'}],
  creatine:[], workouts:[], activeWorkoutId:null
});
function validData(v){
  return !!(v && v.version === 1 && Array.isArray(v.workouts) && Array.isArray(v.bodyWeights) && Array.isArray(v.creatine) && v.settings && typeof v.settings === 'object' && v.workouts.length < 5000 && v.bodyWeights.length < 50000 && v.creatine.length < 50000);
}
function load(){
  try {const raw=localStorage.getItem(STORE_KEY); if(!raw) return defaultState(); const val=JSON.parse(raw); return validData(val) ? val : defaultState();}
  catch {return defaultState();}
}
let state=load();
function save(fromCloud=false){try{localStorage.setItem(STORE_KEY, JSON.stringify(state));if(!fromCloud)window.RepTrackCloud?.markDirty();}catch{showToast('Storage blocked or full. Export a backup now.');}}
function showToast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
function navigate(tab){currentTab=tab;render();window.scrollTo({top:0,behavior:'instant'});}
function activeWorkout(){return state.workouts.find(s=>s.id===state.activeWorkoutId && !s.completedAt) || null;}
function completedWorkouts(){return state.workouts.filter(w=>w.completedAt).sort((a,b)=>(b.completedAt||'').localeCompare(a.completedAt||''));}
function latestBody(){return [...state.bodyWeights].sort((a,b)=>b.date.localeCompare(a.date))[0] || null;}
function firstBody(){return [...state.bodyWeights].sort((a,b)=>a.date.localeCompare(b.date))[0] || null;}
function weekStart(ref=today()){
  const d=dateFromStr(ref);d.setDate(d.getDate()-((d.getDay()+6)%7));return dateLocal(d);
}
function thisWeekWorkouts(){const start=weekStart();return completedWorkouts().filter(w=>w.date>=start && w.date<=today()).length;}
function markedSets(w){return w.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.done).length,0);}
function totalSets(w){return w.exercises.reduce((sum,e)=>sum+e.sets.length,0);}
function lastSet(exerciseId){
  for(const workout of completedWorkouts()){
    const item=workout.exercises.find(e=>e.exerciseId===exerciseId);
    const matched=item?.sets?.find(s=>s.done && Number(s.kg)>0);
    if(matched)return matched;
  }
  return null;
}
function creatineStreak(){
  const taken=new Set(state.creatine); let streak=0;
  for(let i=0;i<366;i++){const d=offsetDate(-i);if(taken.has(d))streak++;else if(i===0)continue;else break;}
  return streak;
}
function navButton(item){return `<button class="nav-button ${currentTab===item.id?'active':''}" data-action="nav" data-tab="${item.id}" ${currentTab===item.id?'aria-current="page"':''}><span class="nav-glyph" aria-hidden="true">${item.icon}</span><span>${item.name}</span></button>`;}
function render(){
  const t={dashboard:'Overview',workout:'Workout log',progress:'Progress',settings:'Settings'}[currentTab];
  app.innerHTML=`<div class="shell">
    <aside class="sidebar"><div class="brand"><div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div><span class="brand-name">REP<em>TRACK</em></span><span class="brand-sub">Strength & progress</span></div></div><nav class="nav-links" aria-label="Main navigation">${NAV.map(navButton).join('')}</nav><div class="sidebar-foot"><div class="caps">Weekly commitment</div><strong>${Math.min(thisWeekWorkouts(),3)} / 3</strong><div class="progress-track"><div class="progress-fill" style="width:${Math.min(thisWeekWorkouts()/3,1)*100}%"></div></div><div class="tiny muted">Full-body strength sessions</div></div></aside>
    <div class="main-area"><header class="topbar"><div class="topbar-title">${esc(t)} <span class="subtle"> / ${new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</span></div><div class="private">${window.RepTrackCloud?.badge() || '● LOCAL ONLY'}</div></header><main class="content">${currentTab==='dashboard'?renderDashboard():currentTab==='workout'?renderWorkout():currentTab==='progress'?renderProgress():renderSettings()}</main><nav class="mobile-nav" aria-label="Mobile navigation">${NAV.map(navButton).join('')}</nav></div>
  </div>`;
}
function heading(kicker,title,desc,extra=''){return `<div class="heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${desc?`<p class="description">${desc}</p>`:''}</div>${extra}</div>`;}
function bodyLogForm(compact=false){
  return `<form data-form="body"><div class="form-grid"><div class="field"><label for="bw-${compact?'quick':'main'}">Body weight (lb)</label><input id="bw-${compact?'quick':'main'}" name="lbs" type="number" min="65" max="700" step="0.1" placeholder="e.g. 207.5" required></div><div class="field"><label for="date-${compact?'quick':'main'}">Date</label><input id="date-${compact?'quick':'main'}" name="date" type="date" value="${today()}" max="${today()}" required></div></div>${compact?'':`<div class="field" style="margin-top:12px"><label for="body-note">Optional note</label><input id="body-note" name="note" placeholder="e.g. after golf / morning weigh-in" maxlength="250"></div>`}<div class="form-actions"><button type="submit" class="btn primary ${compact?'wide':''}">Save weight</button></div></form>`;
}
function creatineCalendar(n=7){
  const dates=Array.from({length:n},(_,i)=>offsetDate(i-n+1));
  return `<div class="creatine-days">${dates.map(d=>{const taken=state.creatine.includes(d);const dt=dateFromStr(d);const label=dt.toLocaleDateString('en-GB',{weekday:'short'});return `<button class="day-button ${taken?'taken':''} ${d===today()?'today':''}" data-action="creatine-toggle" data-date="${d}" aria-label="${label} ${niceDate(d)}: ${taken?'remove':'mark'} creatine" title="${niceDate(d)}"><span class="day-dot">${taken?'✓':'·'}</span><span class="day-label">${label.slice(0,2)} ${dt.getDate()}</span></button>`;}).join('')}</div>`;
}
function recentActivity(){
  const sessions=completedWorkouts().slice(0,3);
  if(!sessions.length)return `<div class="empty"><strong>No completed workouts yet</strong>Start a workout to create your first training record.</div>`;
  return sessions.map(s=>`<div class="list-row"><div><strong>${niceDate(s.date)}</strong><div class="tiny muted">${markedSets(s)} sets completed · ${s.exercises.filter(e=>e.sets.some(st=>st.done)).length} exercises</div></div><button data-action="nav" data-tab="progress" class="btn sm ghost">Details →</button></div>`).join('');
}
function renderDashboard(){
  const current=latestBody();const first=firstBody();const done=thisWeekWorkouts();const workout=activeWorkout();const creatine=state.creatine.includes(today());
  const weightChange=current&&first?current.lbs-first.lbs:0;
  return `${heading('Your training dashboard','Build strength. Lose fat.','A straightforward plan: three full-body sessions, consistent creatine, and a sustainable weight trend.')}
  <div class="grid cols-4">
    <div class="card stat"><div class="caps">Current weight</div><div class="stat-value">${current?fmt(current.lbs,1):'—'} <small>lb</small></div><div class="stat-detail">${current?niceDate(current.date):'No weigh-ins yet'}</div></div>
    <div class="card stat"><div class="caps">To first goal</div><div class="stat-value">${current?fmt(Math.max(0,current.lbs-state.settings.weightGoal),1):'—'} <small>lb</small></div><div class="stat-detail">Goal ${fmt(state.settings.weightGoal,0)} lb</div></div>
    <div class="card stat"><div class="caps">Sessions this week</div><div class="stat-value">${done} <small>/ 3</small></div><div class="stat-detail">${Math.max(0,3-done)} remaining this week</div></div>
    <div class="card stat"><div class="caps">Creatine streak</div><div class="stat-value">${creatineStreak()} <small>days</small></div><div class="stat-detail">${creatine?'Taken today':'Not yet logged today'}</div></div>
  </div>
  <div class="section-spacer card hero"><div><div class="eyebrow">Your next session</div><h2>Show up. Log your sets. Repeat.</h2><p>Full-body strength, seven movements, about 35–40 minutes. Every completed session counts.</p><button class="btn primary" data-action="start-workout">${workout?'Resume workout':'Start workout'} →</button></div><div class="hero-ornament">3×<small>PER WEEK</small></div></div>
  <div class="grid cols-2 section-spacer">
    <section class="card"><div class="card-hd"><h2>Creatine check-in</h2><span class="badge ${creatine?'':'plain'}">${creatine?'✓ Taken':'Not taken'}</span></div><div class="creatine-action"><div class="creatine-icon">5g</div><div><strong>Creatine monohydrate</strong><p class="muted tiny">Daily, including rest days</p></div></div><div style="margin-top:15px"><button class="btn ${creatine?'ghost':'primary'} wide" data-action="creatine-toggle" data-date="${today()}">${creatine?'Undo today’s entry':'Mark today as taken'}</button></div>${creatineCalendar()}</section>
    <section class="card"><div class="card-hd"><h2>Record body weight</h2><span class="pill">Morning preferred</span></div>${bodyLogForm(true)}<p class="muted tiny" style="margin-top:13px">Your original baseline is 208 lb. Track the weekly average rather than reacting to daily changes.</p></section>
  </div>
  <div class="grid cols-2 section-spacer"><section class="card"><div class="card-hd"><h2>Recent sessions</h2><button class="links-inline" data-action="nav" data-tab="progress">View history</button></div>${recentActivity()}</section>
  <section class="card"><div class="card-hd"><h2>Current nutrition targets</h2><span class="badge plain">Guidance</span></div><div class="list-row"><span class="muted">Calories</span><strong>${fmt(state.settings.caloriesGoal)} kcal/day</strong></div><div class="list-row"><span class="muted">Protein</span><strong>${fmt(state.settings.proteinGoal)} g/day</strong></div><div class="list-row"><span class="muted">Weight change since baseline</span><strong>${weightChange===0?'—':`${weightChange>0?'+':''}${fmt(weightChange,1)} lb`}</strong></div><p class="tiny muted" style="margin-top:15px">Food intake is not tracked in v1. Targets are editable in Settings.</p></section></div>`;
}
function renderExercise(workout, ex, n){
  const definition=EXERCISES.find(x=>x.id===ex.exerciseId);
  if(!definition)return '';
  const machine=definition.type==='machine';const body=definition.type==='body';
  const cols=machine?'':' '+(body?'bodyweight':'timed');
  const colLabel=machine?'<div>Weight (kg)</div>':'';
  const last=machine?lastSet(ex.exerciseId):null;
  const tip=last?`Last logged: ${esc(last.kg)} kg × ${esc(last.reps)} reps`:definition.note;
  return `<section class="card exercise-card"><div class="exercise-top"><div><div class="exercise-title"><span class="exercise-number">${String(n+1).padStart(2,'0')}</span><h3>${definition.name}</h3></div><p class="exercise-description">${definition.target} · ${esc(tip)}</p></div><span class="pill">${ex.sets.filter(s=>s.done).length} / ${ex.sets.length} done</span></div>
  <div class="exercise-grid${cols} exercise-head"><div>Set</div>${colLabel}<div>${definition.repLabel}</div><div>Done</div><div></div></div>
  ${ex.sets.map((set,si)=>`<div class="exercise-grid${cols} set-row"><div class="set-number">${si+1}</div>${machine?`<input type="number" min="0" max="600" step="0.5" inputmode="decimal" placeholder="kg" value="${esc(set.kg)}" data-field="set-kg" data-exercise="${ex.exerciseId}" data-set="${set.id}" aria-label="${definition.name} set ${si+1} weight in kilograms">`:''}<input type="number" min="0" max="1000" step="1" inputmode="numeric" placeholder="${definition.type==='timed'?'sec':'reps'}" value="${esc(set.reps)}" data-field="set-reps" data-exercise="${ex.exerciseId}" data-set="${set.id}" aria-label="${definition.name} set ${si+1} ${definition.type==='timed'?'seconds':'repetitions'}"><button class="done-button ${set.done?'is-done':''}" data-action="toggle-set" data-exercise="${ex.exerciseId}" data-set="${set.id}" aria-label="${set.done?'Unmark':'Mark'} ${definition.name} set ${si+1} complete" aria-pressed="${set.done}">${set.done?'✓':'○'}</button><button class="icon-button" data-action="remove-set" data-exercise="${ex.exerciseId}" data-set="${set.id}" aria-label="Remove set ${si+1}" title="Remove set">×</button></div>`).join('')}
  <div class="exercise-actions"><button class="btn sm ghost" data-action="add-set" data-exercise="${ex.exerciseId}">+ Add set</button><span class="tiny muted">${machine?'Use the machine’s kg selector':'Bodyweight exercise'}</span></div>
  <div class="field exercise-note"><label for="note-${ex.exerciseId}">Exercise note (optional)</label><input id="note-${ex.exerciseId}" data-field="exercise-note" data-exercise="${ex.exerciseId}" value="${esc(ex.note||'')}" placeholder="Technique, effort, adjustments…" maxlength="280"></div></section>`;
}
function renderWorkout(){
  const workout=activeWorkout();
  if(!workout){
    return `${heading('Train with purpose','Full-body workout','One routine, three days per week. Log the actual weight and repetitions you complete.')}
      <div class="card hero"><div><div class="eyebrow">Today’s plan</div><h2>Seven essential exercises.</h2><p>Chest press, lat pulldown, squats, seated row, leg extension, glute bridge and plank. Warm up for five minutes first.</p><button class="btn primary" data-action="start-workout">Start a new session →</button></div><div class="hero-ornament">7<small>MOVEMENTS</small></div></div>
      <div class="grid cols-2 section-spacer"><div class="card"><h2>How to log</h2><p class="muted" style="margin-top:12px">Enter each machine weight in kilograms, enter reps or seconds, then tick the set as done. Bodyweight exercises only need repetitions. Add a technique note if helpful.</p></div><div class="card"><h2>Progression</h2><p class="muted" style="margin-top:12px">When both sets reach the top of the repetition range in two consecutive sessions with good technique, increase by one selector increment.</p></div></div>
      <div class="section-spacer">${renderSessionHistory(3)}</div>`;
  }
  const done=markedSets(workout);const total=totalSets(workout);
  return `${heading('Training in progress','Today’s workout','Warm up for five minutes. Use smooth, controlled movements and leave around two reps in reserve.',`<span class="badge">● Active session</span>`)}
    <div class="card session-banner"><div class="flex between wrap"><div><div class="caps">${niceDate(workout.date)} · Full body</div><strong>${done} of ${total} sets completed</strong></div><span class="pill">Rest 60–90 seconds</span></div><div class="progress-track" style="margin-top:14px"><div class="progress-fill" style="width:${total?Math.round(100*done/total):0}%"></div></div></div>
    <div class="stack section-spacer">${workout.exercises.map((ex,i)=>renderExercise(workout,ex,i)).join('')}</div>
    <div class="card section-spacer"><div class="field"><label for="session-note">Overall session notes</label><textarea id="session-note" data-field="workout-note" placeholder="Energy, technique, soreness, anything to remember…">${esc(workout.note||'')}</textarea></div><p class="tiny muted" style="margin-top:9px">Your entries save instantly on this device, then sync when you’re connected.</p></div>
    <div class="workout-footer"><div><strong>${done} sets logged</strong><div class="tiny muted">${workout.exercises.filter(e=>e.sets.some(s=>s.done)).length} of 7 exercises</div></div><div class="flex"><button class="btn ghost sm" data-action="discard-workout">Discard</button><button class="btn primary" data-action="finish-workout">Finish workout</button></div></div>`;
}
function renderSessionHistory(limit){
  const sessions=completedWorkouts().slice(0,limit||100);
  if(!sessions.length)return `<div class="empty"><strong>Your session history will appear here</strong>Complete your first workout to start building a strength record.</div>`;
  return `<div class="stack">${sessions.map(workout=>{
    const recorded=workout.exercises.map(ex=>{
      const definition=EXERCISES.find(d=>d.id===ex.exerciseId);
      const sets=ex.sets.filter(s=>s.done);
      if(!definition || !sets.length)return '';
      const results=sets.map(s=>definition.type==='machine'?`${esc(s.kg)} kg × ${esc(s.reps)}`:definition.type==='timed'?`${esc(s.reps)} sec`:`${esc(s.reps)} reps`).join(' / ');
      return `<li><strong>${definition.name}:</strong> ${results}${ex.note?`<br><span class="muted">${esc(ex.note)}</span>`:''}</li>`;
    }).filter(Boolean).join('');
    return `<details class="history-summary"><summary class="history-head" style="cursor:pointer"><span><strong>${niceDate(workout.date)}</strong><br><span class="tiny muted">${markedSets(workout)} completed sets · ${workout.exercises.filter(e=>e.sets.some(s=>s.done)).length} movements</span></span><span class="pill">View details</span></summary><div class="history-details">${recorded?`<ul>${recorded}</ul>`:'No marked sets'}${workout.note?`<p><strong>Session note:</strong> ${esc(workout.note)}</p>`:''}<div class="flex wrap" style="margin-top:13px"><button class="btn sm ghost" data-action="edit-workout" data-id="${workout.id}">Edit session</button><button class="btn sm danger" data-action="delete-workout" data-id="${workout.id}">Delete</button></div></div></details>`;
  }).join('')}</div>`;
}
function bodyChart(){
  const entries=[...state.bodyWeights].sort((a,b)=>a.date.localeCompare(b.date));
  if(entries.length<2)return `<div class="empty" style="margin-top:10px"><strong>One more weigh-in creates your graph</strong>Log body weight regularly to see your trend.</div>`;
  const width=760,height=235,margin={left:45,right:18,top:14,bottom:36};
  const vals=entries.map(d=>Number(d.lbs)), min=Math.floor((Math.min(...vals)-2)/2)*2,max=Math.ceil((Math.max(...vals)+2)/2)*2;
  const lo=Math.min(min,max-2),hi=Math.max(max,lo+2);
  const start=dateFromStr(entries[0].date).getTime(),end=dateFromStr(entries.at(-1).date).getTime(),span=Math.max(86400000,end-start);
  const X=d=>margin.left+(dateFromStr(d.date).getTime()-start)/span*(width-margin.left-margin.right);
  const Y=v=>height-margin.bottom-(v-lo)/(hi-lo)*(height-margin.top-margin.bottom);
  const points=entries.map(d=>`${X(d).toFixed(1)},${Y(d.lbs).toFixed(1)}`).join(' ');
  const ticks=Array.from({length:4},(_,i)=>lo+(hi-lo)*i/3);
  return `<div class="chart-container"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Body weight trend from ${fmt(entries[0].lbs,1)} lb to ${fmt(entries.at(-1).lbs,1)} lb"><g>${ticks.map(v=>`<line class="chart-grid" x1="${margin.left}" y1="${Y(v)}" x2="${width-margin.right}" y2="${Y(v)}"/><text class="chart-label" x="${margin.left-7}" y="${Y(v)+4}" text-anchor="end">${fmt(v,0)}</text>`).join('')}</g><polyline class="chart-line" points="${points}"/>${entries.map(d=>`<circle class="chart-dot" r="5" cx="${X(d).toFixed(1)}" cy="${Y(d.lbs).toFixed(1)}"><title>${niceDate(d.date)}: ${d.lbs} lb</title></circle>`).join('')}<text class="chart-label" x="${margin.left}" y="${height-7}">${niceDate(entries[0].date)}</text><text class="chart-label" x="${width-margin.right}" y="${height-7}" text-anchor="end">${niceDate(entries.at(-1).date)}</text></svg></div>`;
}
function renderProgress(){
  const curr=latestBody(),first=firstBody(),startDelta=curr&&first?curr.lbs-first.lbs:null;
  const sorted=[...state.bodyWeights].sort((a,b)=>b.date.localeCompare(a.date));
  const currStreak=creatineStreak();const last14=Array.from({length:14},(_,i)=>offsetDate(-i)).filter(d=>state.creatine.includes(d)).length;
  return `${heading('Track the trend','Progress & history','The goal is a falling weight trend and stable or improving strength — not perfect individual workouts.')}
    <div class="grid cols-3"><div class="card stat"><div class="caps">Body weight</div><div class="stat-value">${curr?fmt(curr.lbs,1):'—'} <small>lb</small></div><div class="stat-detail">Most recent check-in</div></div><div class="card stat"><div class="caps">Change since start</div><div class="stat-value">${startDelta===null?'—':`${startDelta>0?'+':''}${fmt(startDelta,1)}`} <small>lb</small></div><div class="stat-detail">Negative = weight lost</div></div><div class="card stat"><div class="caps">Creatine adherence</div><div class="stat-value">${last14} <small>/ 14</small></div><div class="stat-detail">Days marked, last fortnight · streak ${currStreak}</div></div></div>
    <div class="section-spacer card"><div class="card-hd"><h2>Body weight trend</h2><span class="pill">lb</span></div>${bodyChart()}<p class="tiny muted">Expect normal day-to-day fluctuations. Creatine can initially increase muscle water weight.</p></div>
    <div class="grid cols-2 section-spacer"><section class="card"><div class="card-hd"><h2>Add weigh-in</h2></div>${bodyLogForm()}</section><section class="card"><div class="card-hd"><h2>Weight log</h2><span class="pill">${state.bodyWeights.length} entries</span></div><div style="max-height:295px;overflow:auto">${sorted.length?sorted.map(w=>`<div class="list-row"><div><strong>${fmt(w.lbs,1)} lb</strong><div class="tiny muted">${niceDate(w.date)}${w.note?` · ${esc(w.note)}`:''}</div></div><button class="icon-button" data-action="delete-weight" data-id="${w.id}" title="Delete this entry" aria-label="Delete weight logged ${niceDate(w.date)}">×</button></div>`).join(''):'<p class="muted">No weigh-ins yet.</p>'}</div></section></div>
    <div class="section-spacer"><div class="section-title"><h2>Workout history</h2><span class="pill">${completedWorkouts().length} sessions</span></div>${renderSessionHistory()}</div>
    <div class="section-spacer card"><div class="card-hd"><h2>Creatine record</h2><span class="pill">${state.settings.creatineDose} g / day</span></div><p class="muted tiny">Tap a date to add or remove a daily dose; the calendar shows the past seven days.</p>${creatineCalendar()}</div>`;
}
function renderSettings(){
  return `${heading('Make it yours','Preferences & data','Edit your targets, connect secure cloud sync and retain a local backup.')}
  <div class="grid cols-2"><section class="card"><div class="card-hd"><h2>Your targets</h2></div><form data-form="settings"><div class="goal-row"><div class="field"><label for="weightGoal">Target body weight (lb)</label><input id="weightGoal" name="weightGoal" type="number" min="70" max="700" step="0.5" value="${esc(state.settings.weightGoal)}" required></div><div class="field"><label for="proteinGoal">Daily protein (g)</label><input id="proteinGoal" name="proteinGoal" type="number" min="10" max="400" step="1" value="${esc(state.settings.proteinGoal)}" required></div><div class="field"><label for="caloriesGoal">Daily calories</label><input id="caloriesGoal" name="caloriesGoal" type="number" min="900" max="8000" step="25" value="${esc(state.settings.caloriesGoal)}" required></div><div class="field"><label for="creatineDose">Daily creatine (g)</label><input id="creatineDose" name="creatineDose" type="number" min="1" max="10" step="0.5" value="${esc(state.settings.creatineDose)}" required></div></div><div class="form-actions"><button class="btn primary" type="submit">Save targets</button></div></form></section>
  <section class="card"><div class="card-hd"><h2>Backup & exports</h2></div><div class="stack"><p class="muted">Your data is saved locally in this browser. Export it regularly, particularly before changing phones or clearing browser data.</p><button class="btn" data-action="export-json">Download full backup (JSON)</button><button class="btn" data-action="export-csv">Export workout sets (CSV)</button><button class="btn ghost" data-action="import-json">Restore from backup</button><input class="hide" type="file" id="import-file" accept="application/json,.json" aria-label="Choose RepTrack backup file"><div class="privacy"><strong>Privacy & multi-device use</strong><p class="muted tiny" style="margin-top:8px">Records save locally first. With Supabase connected and signed in, records also sync securely between devices. Until then, use JSON backup and restore.</p></div></div></section></div>
  ${window.RepTrackCloud?.panel() || ''}<div class="card section-spacer"><div class="card-hd"><h2>Reset your data</h2></div><p class="muted">Resets this device to defaults. If cloud sync is connected, the reset will also sync to the cloud. Export a backup first.</p><div style="margin-top:15px"><button class="btn danger" data-action="clear-data">Delete all local records</button></div></div>`;
}
function startWorkout(){
  if(!activeWorkout()){
    const workout={id:id(),date:today(),startedAt:new Date().toISOString(),completedAt:null,note:'',exercises:EXERCISES.map(ex=>{
      const previous=ex.type==='machine'?lastSet(ex.id):null;
      return {exerciseId:ex.id,note:'',sets:[blankSet(previous?.kg),blankSet(previous?.kg)]};
    })};
    state.workouts.push(workout);state.activeWorkoutId=workout.id;save();showToast('Workout started. Entries save automatically.');
  }
  navigate('workout');
}
function updateSet(exerciseId,setId,field,value){
  const ex=activeWorkout()?.exercises.find(e=>e.exerciseId===exerciseId);
  const set=ex?.sets.find(s=>s.id===setId);
  if(!set)return;
  if(field==='kg'){set.kg=value;}else{set.reps=value;}
  if(set.done && !(Number(set.reps)>0 && (EXERCISES.find(d=>d.id===exerciseId)?.type!=='machine'||Number(set.kg)>0))){set.done=false;}
  save();
}
function clickAction(action,button){
  const workout=activeWorkout();const exId=button.dataset.exercise,setId=button.dataset.set;
  switch(action){
    case 'nav':navigate(button.dataset.tab);return;
    case 'start-workout':startWorkout();return;
    case 'creatine-toggle':{
      const d=button.dataset.date;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>today())return;
      if(state.creatine.includes(d))state.creatine=state.creatine.filter(v=>v!==d);else state.creatine.push(d);
      save();render();return;
    }
    case 'add-set':{
      if(!workout)return;const ex=workout.exercises.find(e=>e.exerciseId===exId);if(!ex||ex.sets.length>=10)return;
      ex.sets.push(blankSet(ex.sets.at(-1)?.kg));save();render();return;
    }
    case 'remove-set':{
      if(!workout)return;const ex=workout.exercises.find(e=>e.exerciseId===exId);if(!ex||ex.sets.length<=1){showToast('Keep at least one set.');return;}
      ex.sets=ex.sets.filter(s=>s.id!==setId);save();render();return;
    }
    case 'toggle-set':{
      if(!workout)return;const ex=workout.exercises.find(e=>e.exerciseId===exId);const set=ex?.sets.find(s=>s.id===setId);const definition=EXERCISES.find(d=>d.id===exId);if(!set||!definition)return;
      if(!set.done && (!(Number(set.reps)>0)||definition.type==='machine'&&!(Number(set.kg)>0))){showToast(definition.type==='machine'?'Enter weight and reps first.':'Enter reps or seconds first.');return;}
      set.done=!set.done;save();render();return;
    }
    case 'finish-workout':{
      if(!workout)return;
      if(markedSets(workout)===0){showToast('Mark at least one completed set first.');return;}
      workout.completedAt=new Date().toISOString();state.activeWorkoutId=null;save();showToast('Session saved. Well done.');navigate('dashboard');return;
    }
    case 'discard-workout':{
      if(!workout)return;if(!confirm('Discard this entire workout? This cannot be undone.'))return;
      state.workouts=state.workouts.filter(s=>s.id!==workout.id);state.activeWorkoutId=null;save();navigate('workout');return;
    }
    case 'edit-workout':{
      if(activeWorkout()){showToast('Finish or discard your active workout first.');return;}
      const item=state.workouts.find(w=>w.id===button.dataset.id);if(!item)return;
      item.completedAt=null;state.activeWorkoutId=item.id;save();navigate('workout');return;
    }
    case 'delete-workout':{
      const item=state.workouts.find(w=>w.id===button.dataset.id);if(!item)return;
      if(!confirm(`Delete the workout dated ${niceDate(item.date)}?`))return;
      state.workouts=state.workouts.filter(w=>w.id!==item.id);save();render();return;
    }
    case 'delete-weight':{
      const item=state.bodyWeights.find(w=>w.id===button.dataset.id);if(!item)return;
      if(!confirm(`Delete the ${item.lbs} lb entry from ${niceDate(item.date)}?`))return;
      state.bodyWeights=state.bodyWeights.filter(w=>w.id!==item.id);save();render();return;
    }
    case 'export-json':download(JSON.stringify(state,null,2),`reptrack-backup-${today()}.json`,'application/json');showToast('Full backup downloaded.');return;
    case 'export-csv':exportSetsCsv();return;
    case 'import-json':document.getElementById('import-file')?.click();return;
    case 'clear-data':{
      if(!confirm('Delete ALL workout, weight and creatine records? With cloud sync enabled this reset will also update the cloud. Export a backup first.'))return;
      if(!confirm('Final confirmation: permanently reset RepTrack on this device?'))return;
      state=defaultState();save();navigate('dashboard');showToast('Local records reset.');return;
    }
  }
}
function download(content,filename,mime){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportSetsCsv(){
  const headers=['Date','Exercise','Set','Weight kg','Reps or seconds','Units','Completed','Exercise note','Session note'];
  const rows=[headers];
  for(const w of completedWorkouts())for(const ex of w.exercises){
    const info=EXERCISES.find(e=>e.id===ex.exerciseId);if(!info)continue;
    ex.sets.forEach((s,index)=>{if(s.done)rows.push([w.date,info.name,index+1,info.type==='machine'?s.kg:'',s.reps,info.type==='timed'?'seconds':'reps','Yes',ex.note||'',w.note||'']);});
  }
  const csv=rows.map(row=>row.map(v=>{
    let str=String(v??'');if(/^[=+@\-\t\r]/.test(str.trimStart()))str=`'${str}`;
    return `"${str.replaceAll('"','""')}"`;
  }).join(',')).join('\r\n');
  download('\uFEFF'+csv,`reptrack-workouts-${today()}.csv`,'text/csv;charset=utf-8');showToast('Workout CSV downloaded.');
}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(button){event.preventDefault();clickAction(button.dataset.action,button);}
});
document.addEventListener('input',event=>{
  const input=event.target;
  const field=input.dataset?.field;if(!field)return;
  const workout=activeWorkout();if(!workout)return;
  if(field==='set-kg'||field==='set-reps')updateSet(input.dataset.exercise,input.dataset.set,field==='set-kg'?'kg':'reps',input.value);
  else if(field==='workout-note'){workout.note=input.value;save();}
  else if(field==='exercise-note'){
    const ex=workout.exercises.find(e=>e.exerciseId===input.dataset.exercise);if(ex){ex.note=input.value;save();}
  }
});
document.addEventListener('submit',event=>{
  const form=event.target;const type=form.dataset?.form;if(!type)return;
  event.preventDefault();const data=new FormData(form);
  if(type==='body'){
    const lbs=Number(data.get('lbs')),date=String(data.get('date')||''),note=String(data.get('note')||'').trim();
    if(!Number.isFinite(lbs)||lbs<65||lbs>700||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today()){showToast('Please enter a valid weight and date.');return;}
    const existing=state.bodyWeights.find(w=>w.date===date);
    if(existing){existing.lbs=lbs;if(note)existing.note=note;}
    else state.bodyWeights.push({id:id(),date,lbs,note});
    save();render();showToast(existing?'Weigh-in updated.':'Weigh-in saved.');return;
  }
  if(type==='settings'){
    const values=Object.fromEntries(['weightGoal','proteinGoal','caloriesGoal','creatineDose'].map(k=>[k,Number(data.get(k))]));
    if(!Number.isFinite(values.weightGoal)||values.weightGoal<70||values.weightGoal>700||!Number.isFinite(values.proteinGoal)||values.proteinGoal<10||values.proteinGoal>400||!Number.isFinite(values.caloriesGoal)||values.caloriesGoal<900||values.caloriesGoal>8000||!Number.isFinite(values.creatineDose)||values.creatineDose<1||values.creatineDose>10){showToast('Check the target values.');return;}
    Object.assign(state.settings,values);save();render();showToast('Targets updated.');return;
  }
});
document.addEventListener('change',async event=>{
  if(event.target.id!=='import-file')return;
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>10_000_000){showToast('Backup exceeds 10 MB.');return;}
  try{
    const incoming=JSON.parse(await file.text());
    if(!validData(incoming))throw new Error('Unrecognised RepTrack v1 backup');
    if(!confirm(`Restore ${incoming.workouts.length} workouts, ${incoming.bodyWeights.length} weigh-ins and ${incoming.creatine.length} creatine days? This REPLACES all local records.`))return;
    state=incoming;save();navigate('dashboard');showToast('Backup restored.');
  }catch(error){showToast(`Import failed: ${error.message}`);}
});

render();save(true);
window.RepTrackCloud?.start({
  getState:()=>state,
  validData,
  replaceState:(incoming)=>{if(!validData(incoming))throw Error('Invalid cloud data');state=incoming;save(true);render();},
  redraw:()=>{if(currentTab==='settings'||currentTab==='dashboard')render();},
  downloadLocal:()=>download(JSON.stringify(state,null,2),`reptrack-local-backup-${today()}.json`,'application/json')
});
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

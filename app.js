
const API="https://open.faceit.com/data/v4";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const state={settings:{},player:null,matches:[],schedule:[]};

function defaultSchedule(){return DAYS.map((d,i)=>({day:i,name:d,enabled:i===1||i===3,time:"19:00",weekend:i===0||i===6}))}
function load(){
  state.settings=JSON.parse(localStorage.getItem("z3d_settings")||"{}");
  state.player=JSON.parse(localStorage.getItem("z3d_player")||"null");
  state.matches=JSON.parse(localStorage.getItem("z3d_matches")||"[]");
  state.schedule=JSON.parse(localStorage.getItem("z3d_schedule")||"null")||defaultSchedule();
}
function save(){
  localStorage.setItem("z3d_settings",JSON.stringify(state.settings));
  localStorage.setItem("z3d_player",JSON.stringify(state.player));
  localStorage.setItem("z3d_matches",JSON.stringify(state.matches));
  localStorage.setItem("z3d_schedule",JSON.stringify(state.schedule));
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),2600)}
function nicknameFromUrl(v){
  try{const u=new URL(v);const parts=u.pathname.split("/").filter(Boolean);const idx=parts.findIndex(x=>x.toLowerCase()==="players");if(idx>=0&&parts[idx+1])return decodeURIComponent(parts[idx+1])}catch{}
  return (v||"").trim().replace(/^@/,"");
}
async function faceit(path){
  const key=state.settings.apiKey;
  if(!key)throw new Error("Add a FACEIT client-side API key in Settings.");
  const r=await fetch(API+path,{headers:{Authorization:`Bearer ${key}`}});
  if(!r.ok){let text=await r.text();throw new Error(`FACEIT ${r.status}: ${text.slice(0,120)}`)}
  return r.json();
}
function val(o,names,def=null){for(const n of names){if(o&&o[n]!=null&&o[n]!=="")return o[n]}return def}
function num(v){const x=parseFloat(String(v??"").replace("%",""));return Number.isFinite(x)?x:null}
function normalize(item){
  const s=item.stats||item||{};
  const kills=num(val(s,["Kills","kills"])), deaths=num(val(s,["Deaths","deaths"]));
  return {
    id:String(val(s,["Match Id","Match ID","match_id"],item.match_id||crypto.randomUUID())),
    date:num(val(s,["Match Finished At","Match Finished","match_finished_at"]))||Date.now(),
    map:String(val(s,["Map","map"],"Unknown")).replace(/^de_/,""),
    kills,deaths,
    assists:num(val(s,["Assists","assists"])),
    adr:num(val(s,["ADR","Average Damage per Round","Average Damage Per Round","Damage / Round"])),
    hs:num(val(s,["Headshots %","Headshots % ","Headshot %","Headshots"])),
    kd:num(val(s,["K/D Ratio","K/D","KD"])) ?? (kills!=null&&deaths? kills/deaths:null),
    result:String(val(s,["Result","result"],"")),
    score:String(val(s,["Score","Final Score","score"],""))
  };
}
async function sync(){
  const nick=nicknameFromUrl(state.settings.faceitUrl);
  if(!nick)throw new Error("Add your FACEIT profile URL in Settings.");
  toast("Connecting to FACEIT…");
  const p=await faceit(`/players?nickname=${encodeURIComponent(nick)}&game=cs2`);
  state.player=p;
  const stats=await faceit(`/players/${encodeURIComponent(p.player_id)}/games/cs2/stats?offset=0&limit=100`);
  const incoming=(stats.items||[]).map(normalize);
  const byId=new Map(state.matches.map(m=>[m.id,m]));
  for(const m of incoming)byId.set(m.id,m);
  state.matches=[...byId.values()].sort((a,b)=>b.date-a.date).slice(0,300);
  save();render();toast(`Synced ${incoming.length} recent FACEIT matches`);
}
function avg(arr,key){const xs=arr.map(x=>x[key]).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
function fmt(v,d=1){return Number.isFinite(v)?v.toFixed(d):"—"}
function recent(n){return state.matches.slice(0,n)}
function trend(key){
  const a=avg(recent(5),key), b=avg(state.matches.slice(5,20),key);
  if(!Number.isFinite(a)||!Number.isFinite(b))return {a,b,cls:"flat",txt:"Need more matches"};
  const pct=b?((a-b)/Math.abs(b))*100:0;
  return {a,b,cls:pct>4?"up":pct<-4?"down":"flat",txt:`${pct>=0?"+":""}${pct.toFixed(1)}% vs baseline`};
}
function coachData(){
  const a=trend("adr"), k=trend("kd"), h=trend("hs");
  let focus="Consistency", reason="Keep your current mechanics balanced while more data accumulates.", severity="stable";
  if(a.cls==="down"&&k.cls==="down"){focus="Gunfight conversion";reason="Recent ADR and K/D are both below your recent baseline. Prioritise clean first bullets, counter-strafing and realistic duel reps.";severity="down"}
  else if(h.cls==="down"&&k.cls!=="up"){focus="First-bullet mechanics";reason="Headshot rate has dropped without a compensating K/D improvement. Use accuracy-focused reps rather than speed chasing.";severity="down"}
  else if(a.cls==="down"){focus="Round impact";reason="ADR is below baseline. Use dynamic fights plus map-specific clearing rather than pure static aim.";severity="down"}
  else if(k.cls==="up"&&a.cls==="up"){focus="Maintain form";reason="Recent ADR and K/D are both above baseline. Keep the warm-up short and preserve energy for FACEIT.";severity="up"}
  return {a,k,h,focus,reason,severity};
}
function todaysTeam(){
  const d=new Date().getDay();
  return state.schedule.find(x=>x.day===d&&x.enabled);
}
function plan(){
  const c=coachData(), team=todaysTeam(), drills=training(c);
  if(team){
    const [hh,mm]=team.time.split(":").map(Number);
    const start=new Date(); start.setHours(hh,mm,0,0); start.setMinutes(start.getMinutes()-35);
    return [
      ["Warm-up",`${start.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})} — 5 min Prefire, 10 min Crossfire Smart, 10 min ${c.focus}, then 5–10 min map activation.`],
      ["Team",`${team.time} onward — team practice, then ${state.settings.teamGames==="1"?"1":"1–2"} team FACEIT game${state.settings.teamGames==="1"?"":"s"}.`],
      ["Reset","5–10 min away from the game after the team block. Water, stand up, then a short activation if you continue."],
      ["Pugs",state.settings.pugAfter===false?"No solo-pug block planned.":"Solo FACEIT afterward while mechanics and decision-making remain stable."],
      ["Finish",`10 min max: ${drills[0].name}. Stop rather than forcing volume if the last games show a clear performance drop.`]
    ];
  }
  return [
    ["Warm-up","20–25 min — Prefire → Crossfire Smart → clean counter-strafe / first-bullet work."],
    ["Target",`20–30 min focused work: ${c.focus}. ${c.reason}`],
    ["FACEIT","Play your normal pug block. The app evaluates the session against your own rolling baseline."],
    ["Finish",`8–12 min ${drills[0].name}; reinforce the day's issue rather than repeating the entire warm-up.`]
  ];
}
function training(c=coachData()){
  if(c.focus==="Gunfight conversion")return [
    {name:"Crossfire Smart",mins:12,why:"Realistic peeks, micro-adjustments and duel conversion."},
    {name:"Prefire",mins:10,why:"Clean angle clearing and first-bullet accuracy."},
    {name:"Xfire",mins:8,why:"Dynamic clearing against moving/peeking opponents."}
  ];
  if(c.focus==="First-bullet mechanics")return [
    {name:"Prefire",mins:12,why:"Accuracy first. Clear every angle with deliberate counter-strafes."},
    {name:"Crossfire Smart",mins:10,why:"Transfer clean mechanics into realistic fights."},
    {name:"Spray Transfer",mins:6,why:"Short controlled finish; don't turn this into fatigue volume."}
  ];
  if(c.focus==="Round impact")return [
    {name:"Xfire",mins:12,why:"Dynamic map engagements and clearing."},
    {name:"Crossfire Smart",mins:10,why:"Increase realistic fight reps."},
    {name:"NADR / map utility",mins:8,why:"Add useful round impact without relying only on aim."}
  ];
  return [
    {name:"Crossfire Smart",mins:10,why:"Maintain realistic duel sharpness."},
    {name:"Prefire",mins:8,why:"Maintain crosshair placement and clearing."},
    {name:"Xfire",mins:7,why:"Keep dynamic reactions active."}
  ];
}
function render(){
  $("#faceitUrl").value=state.settings.faceitUrl||"";
  $("#apiKey").value=state.settings.apiKey||"";
  $("#refragUrl").value=state.settings.refragUrl||"";
  $("#teamGames").value=state.settings.teamGames||"2";
  $("#pugAfter").checked=state.settings.pugAfter!==false;

  if(state.player){
    $("#playerName").textContent=state.player.nickname||"Connected";
    const cs=state.player.games?.cs2||{};
    $("#elo").textContent=cs.faceit_elo??"—"; $("#level").textContent=`Level ${cs.skill_level??"—"}`;
    $("#playerMeta").textContent=`${(cs.region||"").toUpperCase()} • ${state.player.country?.toUpperCase()||""}`;
  } else {$("#playerName").textContent="Not connected";$("#playerMeta").textContent="Connect FACEIT in Settings";$("#elo").textContent="—";$("#level").textContent="Level —"}

  const ad=trend("adr"), kd=trend("kd"), hs=trend("hs");
  $("#adr5").textContent=fmt(ad.a);$("#kd5").textContent=fmt(kd.a,2);$("#hs5").textContent=Number.isFinite(hs.a)?`${fmt(hs.a,0)}%`:"—";
  [["#adrTrend",ad],["#kdTrend",kd],["#hsTrend",hs]].forEach(([s,t])=>{$(s).textContent=t.txt;$(s).className=t.cls});
  $("#matchCount").textContent=state.matches.length;

  $("#todayPlan").innerHTML=plan().map(([a,b])=>`<div class="planPhase"><b>${a}</b><p>${b}</p></div>`).join("");

  const c=coachData();
  $("#coachSummary").innerHTML=`<div class="eyebrow">PRIMARY FOCUS</div><h2>${c.focus}</h2><p>${c.reason}</p>`;
  $("#focusList").innerHTML=training(c).map(d=>`<div class="metricRow"><div><strong>${d.name}</strong><span>${d.mins} min</span></div><span>${d.why}</span></div>`).join("");
  $("#trendList").innerHTML=[["ADR",c.a],["K/D",c.k],["HS%",c.h]].map(([n,t])=>`<div class="metricRow"><strong>${n}</strong><span class="${t.cls}">${t.txt}</span></div>`).join("");

  $("#trainingPlan").innerHTML=training(c).map((d,i)=>`<div class="drill"><div><strong>${i+1}. ${d.name}</strong><p>${d.why}</p></div><span class="pill">${d.mins} min</span></div>`).join("");

  $("#matchesList").innerHTML=state.matches.length?state.matches.slice(0,30).map(m=>{
    const dt=new Date(m.date>1e12?m.date:m.date*1000);
    const won=/^(1|win)$/i.test(m.result), lost=/^(0|loss)$/i.test(m.result);
    return `<div class="matchRow"><div class="matchMain"><strong>${m.map}</strong><small>${dt.toLocaleDateString()} ${m.score||""}</small></div><div class="matchStats"><strong>${m.kills??"—"} / ${m.deaths??"—"}</strong><small class="${won?"resultWin":lost?"resultLoss":""}">${m.adr!=null?`ADR ${fmt(m.adr)}`:""} ${m.result?` • ${won?"W":lost?"L":m.result}`:""}</small></div></div>`
  }).join(""):`<div class="note">No matches stored yet. Connect FACEIT and tap Sync.</div>`;

  $("#trendCards").innerHTML=[["ADR",ad,1],["K/D",kd,2],["HS%",hs,0]].map(([n,t,d])=>`<article><span>Last 5 ${n}</span><strong>${Number.isFinite(t.a)?fmt(t.a,d)+(n==="HS%"?"%":""):"—"}</strong><small class="${t.cls}">${t.txt}</small></article>`).join("");
  const maps={}; for(const m of state.matches.slice(0,50)){if(!maps[m.map])maps[m.map]=[];maps[m.map].push(m)}
  const mapRows=Object.entries(maps).map(([name,ms])=>({name,n:ms.length,adr:avg(ms,"adr"),kd:avg(ms,"kd")})).filter(x=>x.n>=2).sort((a,b)=>(b.adr||0)-(a.adr||0));
  $("#mapForm").innerHTML=mapRows.length?mapRows.map(x=>`<div class="mapBar"><div class="mapBarHead"><span>${x.name} • ${x.n} matches</span><span>ADR ${fmt(x.adr)} • K/D ${fmt(x.kd,2)}</span></div><div class="bar"><i style="width:${Math.max(8,Math.min(100,(x.adr||0)))}%"></i></div></div>`).join(""):`<div class="muted">Need at least two tracked matches on a map.</div>`;

  $("#scheduleList").innerHTML=state.schedule.map((x,i)=>`<div class="scheduleRow"><input type="checkbox" data-sidx="${i}" class="sen" ${x.enabled?"checked":""}><label>${x.name}<small>${x.weekend?"Enable whichever weekend day the team uses":"Team training day"}</small></label><input type="time" data-sidx="${i}" class="stime" value="${x.time}"></div>`).join("");
}
function renderScheduleSave(){
  $$(".sen").forEach(el=>state.schedule[+el.dataset.sidx].enabled=el.checked);
  $$(".stime").forEach(el=>state.schedule[+el.dataset.sidx].time=el.value||"19:00");
  save();render();toast("Team schedule saved");
}
$$(".tab").forEach(b=>b.addEventListener("click",()=>{$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(v=>v.classList.toggle("active",v.dataset.view===b.dataset.target));window.scrollTo({top:0,behavior:"smooth"})}));
$("#settingsForm").addEventListener("submit",async e=>{e.preventDefault();state.settings={...state.settings,faceitUrl:$("#faceitUrl").value.trim(),apiKey:$("#apiKey").value.trim(),refragUrl:$("#refragUrl").value.trim(),teamGames:$("#teamGames").value,pugAfter:$("#pugAfter").checked};save();try{await sync()}catch(err){toast(err.message)}});
$("#syncBtn").addEventListener("click",async()=>{try{await sync()}catch(err){toast(err.message)}});
$("#saveSchedule").addEventListener("click",renderScheduleSave);
$("#clearData").addEventListener("click",()=>{if(confirm("Clear all locally stored settings and match data on this device?")){localStorage.removeItem("z3d_settings");localStorage.removeItem("z3d_player");localStorage.removeItem("z3d_matches");localStorage.removeItem("z3d_schedule");load();render();toast("Local data cleared")}});
load();render();
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});

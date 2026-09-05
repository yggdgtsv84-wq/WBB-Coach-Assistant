let sb=null, user=null, teams=[], players=[], T=null, S="home", G={}, drills=[];
let timer={id:null,left:0,running:false}, int=null;

const $=id=>document.getElementById(id);
const team=()=>teams.find(t=>t.id===T);
const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const jersey=p=>`<span class="jersey">${esc(p.jersey_number)}</span>`;

function configured(){
  const url=String(window.SUPABASE_URL||"").trim();
  const key=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();
  return !!url && !!key && !url.startsWith("PASTE-") && !key.startsWith("PASTE-");
}

function showFatal(message){
  $("app").innerHTML=`<div class="auth"><div class="card">
    <h1>Coach Assistant</h1>
    <p class="sub">The app could not start.</p>
    <div class="error">${esc(message)}</div>
    <p class="sub">Check config.js and your Supabase project, then reload this page.</p>
  </div></div>`;
}

function go(s){S=s;$("drawer").classList.add("hide");render()}

function auth(err=""){
  $("app").innerHTML=`<div class="auth"><div class="card">
    <h1>Coach Assistant</h1>
    <p class="sub">Sign in to sync your coaching data across your iPhone and iPad.</p>
    ${err?`<div class="error">${esc(err)}</div>`:""}
    <input id="email" type="email" autocomplete="email" placeholder="Email">
    <input id="pw" type="password" autocomplete="current-password" placeholder="Password">
    <div class="buttons">
      <button class="primary" onclick="signin()">SIGN IN</button>
      <button class="secondary" onclick="signup()">CREATE ACCOUNT</button>
    </div>
  </div></div>`;
}

async function signin(){
  const email=$("email")?.value.trim(), password=$("pw")?.value||"";
  if(!email||!password)return auth("Enter your email and password.");
  const r=await sb.auth.signInWithPassword({email,password});
  if(r.error)auth(r.error.message);
}

async function signup(){
  const email=$("email")?.value.trim(), password=$("pw")?.value||"";
  if(!email||!password)return auth("Enter an email and password.");
  if(password.length<6)return auth("Use a password of at least 6 characters.");
  const r=await sb.auth.signUp({email,password});
  if(r.error)return auth(r.error.message);
  auth("Account created. If Supabase asks you to confirm your email, do that first, then sign in.");
}

async function boot(){
  if(!configured()){
    return showFatal("Supabase is not configured. Open config.js and enter your Project URL and Publishable Key.");
  }
  try{
    const key=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();
    sb=window.supabase.createClient(String(window.SUPABASE_URL).trim(),key,{
      auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
    });
  }catch(e){
    return showFatal("Supabase could not be initialised: "+(e.message||e));
  }

  const r=await sb.auth.getSession();
  if(r.error)return showFatal(r.error.message);
  user=r.data.session?.user||null;
  if(user) await load(); else auth();

  sb.auth.onAuthStateChange(async(_event,session)=>{
    user=session?.user||null;
    if(user) await load(); else auth();
  });
}

async function load(){
  try{
    let r=await sb.from("teams").select("*").order("created_at");
    if(r.error)throw r.error;
    teams=r.data||[];

    if(!teams.length){
      r=await sb.from("teams").insert([
        {user_id:user.id,name:"West Belconnen Team 1"},
        {user_id:user.id,name:"West Belconnen Team 2"}
      ]).select();
      if(r.error)throw r.error;
      teams=r.data||[];
    }

    T=T&&teams.some(t=>t.id===T)?T:teams[0]?.id;
    await loadTeam();

    r=await sb.from("drills").select("*").order("created_at");
    if(r.error)throw r.error;
    drills=r.data||[];
    render();
  }catch(e){
    showFatal("Could not load your coaching data: "+(e.message||e));
  }
}

async function loadTeam(){
  if(!T){players=[];G={};return}
  let r=await sb.from("players").select("*").eq("team_id",T).order("jersey_number");
  if(r.error)throw r.error;
  players=r.data||[];

  if(!players.length){
    r=await sb.from("players").insert([4,7,9,11,12].map((n,i)=>({
      team_id:T,name:"Player "+(i+1),jersey_number:n
    }))).select();
    if(r.error)throw r.error;
    players=r.data||[];
  }

  G={};
  players.forEach((p,i)=>G[p.id]={one:0,two:0,three:0,foul:0,off:0,on:i<5});
}

async function sw(id){T=id;await loadTeam();render()}

function render(){
  $("team").textContent=(team()?.name||"TEAM").toUpperCase();
  ({home,game,bench,history,practice,season,teams:teamsScreen,settings}[S]||home)();
}

function home(){
  $("app").innerHTML=`<h1>Coach Assistant</h1>
  <p class="sub">Cloud synced · no game clock</p>
  <div class="card"><div class="buttons">${teams.map(t=>`<button class="secondary" onclick="sw('${t.id}')">${esc(t.name)}</button>`).join("")}</div></div>
  <div class="grid" style="margin-top:10px">
    <button class="action" onclick="go('game')"><b>🏀 Game</b><span>Points and fouls</span></button>
    <button class="action" onclick="go('bench')"><b>🔄 Bench</b><span>Substitutions</span></button>
    <button class="action" onclick="go('history')"><b>📅 History</b><span>Completed games</span></button>
    <button class="action" onclick="go('practice')"><b>⏱ Practice</b><span>Custom drills</span></button>
    <button class="action" onclick="go('season')"><b>📊 Season</b><span>Cumulative totals</span></button>
    <button class="action" onclick="go('teams')"><b>👕 Teams</b><span>Players</span></button>
  </div>`;
}

function game(){
  let pts=Object.values(G).reduce((a,g)=>a+g.one+2*g.two+3*g.three,0);
  $("app").innerHTML=`<h1>Game</h1><p class="sub">${esc(team()?.name||"")}</p>
  <div class="card"><div class="scorebox">
    <div><div class="score">${pts}</div><div class="sub">YOUR SCORE</div></div>
    <div><input id="opp" placeholder="Who are we playing?"><input id="os" type="number" min="0" placeholder="Opposition final score"></div>
  </div><div class="buttons">
    <button class="primary" onclick="go('bench')">OPEN BENCH</button>
    <button class="success" onclick="endGame()">END / SAVE GAME</button>
    <button class="danger" onclick="clearLive()">CLEAR</button>
  </div></div><h2>Players</h2><div class="players">${players.map(pc).join("")}</div>`;
}

function pc(p){
  let g=G[p.id],pts=g.one+2*g.two+3*g.three;
  return `<div class="player">${jersey(p)}<b>${esc(p.name)} #${esc(p.jersey_number)}</b>
  <div class="stats">PTS ${pts} · FOUL ${g.foul}/5 · SUB OFF ${g.off}${g.foul===5?" · FOULED OUT":""}</div>
  <div class="buttons">
    <button class="primary" onclick="pts('${p.id}',1)">+1</button>
    <button class="primary" onclick="pts('${p.id}',2)">+2</button>
    <button class="primary" onclick="pts('${p.id}',3)">+3</button>
    <button class="foul" onclick="foul('${p.id}')">FOUL</button>
    <button class="${g.on?"danger":"success"}" onclick="sub('${p.id}')">${g.on?"SUB OFF":"SUB ON"}</button>
  </div></div>`;
}

function pts(id,n){G[id][n===1?"one":n===2?"two":"three"]++;render()}
function foul(id){if(G[id].foul<5)G[id].foul++;render()}
function sub(id){
  let g=G[id];
  if(g.on){g.on=false;g.off++}
  else if(Object.values(G).filter(x=>x.on).length<5)g.on=true;
  else return alert("Five players are already on court.");
  render();
}
function clearLive(){
  if(confirm("Clear current live game?")){
    players.forEach((p,i)=>G[p.id]={one:0,two:0,three:0,foul:0,off:0,on:i<5});
    render();
  }
}

async function endGame(){
  let opponent=$("opp")?.value.trim(), os=Number($("os")?.value);
  if(!opponent)return alert("Enter who you are playing.");
  if(!Number.isInteger(os)||os<0)return alert("Enter opposition final score.");
  let my=Object.values(G).reduce((a,g)=>a+g.one+2*g.two+3*g.three,0);
  let r=await sb.from("games").insert({team_id:T,opponent,team_score:my,opponent_score:os}).select().single();
  if(r.error)return alert(r.error.message);
  let rows=players.map(p=>{let g=G[p.id];return{
    game_id:r.data.id,player_id:p.id,points_1:g.one,points_2:g.two,
    points_3:g.three,fouls:g.foul,sub_off:g.off
  }});
  r=await sb.from("game_player_stats").insert(rows);
  if(r.error)return alert(r.error.message);
  alert(`Saved ${my}-${os} vs ${opponent}`);
  clearLive();go("history");
}

function bench(){
  $("app").innerHTML=`<h1>Bench</h1><p class="sub">Quick substitution screen.</p>
  <div class="benchcols"><div class="bench"><h3>ON COURT · ${players.filter(p=>G[p.id].on).length}/5</h3>${players.filter(p=>G[p.id].on).map(bi).join("")}</div>
  <div class="bench"><h3>BENCH · ${players.filter(p=>!G[p.id].on).length}</h3>${players.filter(p=>!G[p.id].on).map(bi).join("")}</div></div>`;
}
function bi(p){
  let g=G[p.id];
  return `<div class="benchitem">${jersey(p)}<b>${esc(p.name)}<br><small>${g.foul}/5 fouls · ${g.off} sub offs</small></b>
  <button class="${g.on?"danger":"success"}" onclick="sub('${p.id}')">${g.on?"SUB OFF":"SUB ON"}</button></div>`;
}

async function history(){
  let r=await sb.from("games").select("*").eq("team_id",T).order("game_date",{ascending:false}).order("created_at",{ascending:false});
  if(r.error)return showFatal(r.error.message);
  let gs=r.data||[];
  $("app").innerHTML=`<h1>Game History</h1><p class="sub">${esc(team()?.name||"")}</p>
  <div class="list">${gs.map(g=>{
    let x=g.team_score>g.opponent_score?"WIN":g.team_score<g.opponent_score?"LOSS":"DRAW";
    return `<div class="row"><b>${g.game_date}<br>vs ${esc(g.opponent)}<br><span class="badge ${x==="LOSS"?"loss":""}">${x}</span></b>
    <strong>${g.team_score} - ${g.opponent_score}</strong><button class="secondary" onclick="viewGame('${g.id}')">VIEW</button></div>`;
  }).join("")||"<div class=\"card\">No games saved.</div>"}</div>`;
}

async function viewGame(id){
  let a=await sb.from("games").select("*").eq("id",id).single();
  if(a.error)return alert(a.error.message);
  let b=await sb.from("game_player_stats").select("*,players(name,jersey_number)").eq("game_id",id);
  if(b.error)return alert(b.error.message);
  let g=a.data,r=b.data||[];
  $("app").innerHTML=`<h1>vs ${esc(g.opponent)}</h1><p class="sub">${g.game_date}</p>
  <div class="card"><div class="scorebox"><div class="score">${g.team_score}</div><div class="score">${g.opponent_score}</div></div>
  <button class="secondary" onclick="go('history')">BACK</button></div><h2>Player Stats</h2>
  <div class="card" style="overflow:auto"><table><tr><th>Player</th><th>PTS</th><th>1</th><th>2</th><th>3</th><th>FOUL</th><th>SUB OFF</th></tr>
  ${r.map(x=>`<tr><td>#${x.players.jersey_number} ${esc(x.players.name)}</td><td>${x.points_1+2*x.points_2+3*x.points_3}</td>
  <td>${x.points_1}</td><td>${x.points_2}</td><td>${x.points_3}</td><td>${x.fouls}/5</td><td>${x.sub_off}</td></tr>`).join("")}</table></div>`;
}

function practice(){
  $("app").innerHTML=`<h1>Practice</h1><p class="sub">Cloud-saved custom drills.</p>
  <div class="timer"><div>${esc(drills.find(x=>x.id===timer.id)?.name||"Select a drill")}</div><div class="time">${fmt(timer.left)}</div>
  <div class="buttons" style="justify-content:center"><button class="success" onclick="start()">START</button>
  <button class="secondary" onclick="pause()">PAUSE</button><button class="danger" onclick="resetTimer()">RESET</button></div></div>
  <div class="card"><button class="primary" onclick="addDrill()">＋ ADD DRILL</button>
  <div class="list" style="margin-top:8px">${drills.map(d=>`<div class="row"><b>${esc(d.name)}<br><small>${d.minutes} min</small></b>
  <button class="secondary" onclick="sel('${d.id}')">SELECT</button><button class="danger" onclick="delDrill('${d.id}')">×</button></div>`).join("")}</div></div>
  <div class="notice">Short sound at 1:00 remaining and at the end.</div>`;
}
function fmt(x){return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0")}
function sel(id){timer.id=id;timer.left=(drills.find(x=>x.id===id)?.minutes||0)*60;render()}
function start(){
  if(!timer.id)return alert("Select a drill.");
  clearInterval(int);timer.running=true;
  int=setInterval(()=>{
    timer.left--;
    if(timer.left===60||timer.left===0)beep();
    if(timer.left<=0){timer.left=0;timer.running=false;clearInterval(int)}
    render();
  },1000);
  render();
}
function pause(){timer.running=false;clearInterval(int);render()}
function resetTimer(){pause();timer.left=timer.id?(drills.find(x=>x.id===timer.id)?.minutes||0)*60:0;render()}
function beep(){
  try{
    let c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();
    o.frequency.value=1800;g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start();
    setTimeout(()=>{o.stop();c.close()},180);
  }catch(e){}
}
async function addDrill(){
  let n=prompt("Drill name:"),m=+prompt("Minutes:","10");
  if(!n||!Number.isInteger(m)||m<=0)return;
  let r=await sb.from("drills").insert({user_id:user.id,name:n.trim(),minutes:m});
  if(r.error)return alert(r.error.message);
  r=await sb.from("drills").select("*").order("created_at");
  if(r.error)return alert(r.error.message);
  drills=r.data||[];render();
}
async function delDrill(id){
  if(!confirm("Delete drill?"))return;
  let r=await sb.from("drills").delete().eq("id",id);
  if(r.error)return alert(r.error.message);
  r=await sb.from("drills").select("*").order("created_at");
  if(r.error)return alert(r.error.message);
  drills=r.data||[];render();
}

async function teamsScreen(){
  $("app").innerHTML=`<h1>Teams & Players</h1><p class="sub">Changes sync across signed-in devices.</p>
  <div class="buttons">${teams.map(t=>`<button class="secondary" onclick="sw('${t.id}')">${esc(t.name)}</button>`).join("")}</div>
  <div class="card" style="margin-top:10px"><input id="tn" value="${esc(team()?.name||"")}"><button class="primary" onclick="saveTeam()">SAVE TEAM NAME</button></div>
  <h2>Roster</h2><button class="primary" onclick="addPlayer()">＋ ADD PLAYER</button>
  <div class="list" style="margin-top:8px">${players.map(p=>`<div class="row">${jersey(p)}<b>${esc(p.name)} #${esc(p.jersey_number)}</b>
  <button class="secondary" onclick="editPlayer('${p.id}')">EDIT</button><button class="danger" onclick="removePlayer('${p.id}')">×</button></div>`).join("")}</div>`;
}
async function saveTeam(){
  let n=$("tn").value.trim();
  if(!n)return;
  let r=await sb.from("teams").update({name:n}).eq("id",T);
  if(r.error)return alert(r.error.message);
  team().name=n;render();
}
async function addPlayer(){
  let n=prompt("Player name:"),num=+prompt("Jersey number:");
  if(!n||!Number.isInteger(num)||num<0)return;
  let r=await sb.from("players").insert({team_id:T,name:n.trim(),jersey_number:num});
  if(r.error)return alert(r.error.message);
  await loadTeam();render();
}
async function editPlayer(id){
  let p=players.find(x=>x.id===id),n=prompt("Player name:",p.name),num=+prompt("Jersey number:",p.jersey_number);
  if(!n||!Number.isInteger(num)||num<0)return;
  let r=await sb.from("players").update({name:n.trim(),jersey_number:num}).eq("id",id);
  if(r.error)return alert(r.error.message);
  await loadTeam();render();
}
async function removePlayer(id){
  if(!confirm("Remove player from roster?"))return;
  let r=await sb.from("players").delete().eq("id",id);
  if(r.error)return alert(r.error.message);
  await loadTeam();render();
}
async function season(){
  let a=await sb.from("games").select("id").eq("team_id",T);
  if(a.error)return showFatal(a.error.message);
  let ids=(a.data||[]).map(x=>x.id);
  let rows=ids.length?(await sb.from("game_player_stats").select("*").in("game_id",ids)):{data:[],error:null};
  if(rows.error)return showFatal(rows.error.message);
  rows=rows.data||[];
  $("app").innerHTML=`<h1>Season Totals</h1><p class="sub">${esc(team()?.name||"")}</p>
  <div class="card" style="overflow:auto"><table><tr><th>Player</th><th>GP</th><th>PTS</th><th>PPG</th><th>1</th><th>2</th><th>3</th><th>FOULS</th><th>SUB OFF</th></tr>
  ${players.map(p=>{
    let x=rows.filter(r=>r.player_id===p.id),pts=x.reduce((a,r)=>a+r.points_1+2*r.points_2+3*r.points_3,0);
    return `<tr><td>#${p.jersey_number} ${esc(p.name)}</td><td>${x.length}</td><td>${pts}</td><td>${x.length?(pts/x.length).toFixed(1):"0.0"}</td>
    <td>${x.reduce((a,r)=>a+r.points_1,0)}</td><td>${x.reduce((a,r)=>a+r.points_2,0)}</td><td>${x.reduce((a,r)=>a+r.points_3,0)}</td>
    <td>${x.reduce((a,r)=>a+r.fouls,0)}</td><td>${x.reduce((a,r)=>a+r.sub_off,0)}</td></tr>`;
  }).join("")}</table></div>`;
}
function settings(){
  $("app").innerHTML=`<h1>Settings</h1><p class="sub">Signed in as ${esc(user?.email||"")}</p>
  <div class="card"><button class="danger full" onclick="sb.auth.signOut()">SIGN OUT</button></div>
  <div class="notice">Games, player stats, rosters and drills are stored in Supabase. Use the same login on every device.</div>`;
}

$("menu").onclick=()=>$("drawer").classList.remove("hide");
$("close").onclick=()=>$("drawer").classList.add("hide");
document.querySelectorAll("[data-s]").forEach(x=>x.onclick=()=>go(x.dataset.s));
boot();

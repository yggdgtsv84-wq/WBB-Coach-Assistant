let sb=null, user=null, teams=[], players=[], T=null, S="home", G={}, drills=[];
let timer={id:null,left:0,running:false}, int=null, audioCtx=null;

const $=id=>document.getElementById(id);
const team=()=>teams.find(t=>t.id===T);
const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const jersey=p=>`<div class="basketball-jersey" aria-label="Basketball jersey number ${esc(p.jersey_number)}"><span class="jersey-collar"></span><span class="jersey-side left"></span><span class="jersey-side right"></span><span class="jersey-brand">WB</span><strong>${esc(p.jersey_number)}</strong></div>`;

function configured(){
  const url=String(window.SUPABASE_URL||"").trim();
  const key=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();
  return !!url && !!key && !url.startsWith("PASTE-") && !key.startsWith("PASTE-");
}

function showFatal(message){
  $("app").innerHTML=`<div class="auth"><div class="card"><h1>Coach Assistant</h1><p class="sub">The app could not start.</p><div class="error">${esc(message)}</div><p class="sub">Check config.js and your Supabase project, then reload this page.</p></div></div>`;
}

function go(s){S=s;$("drawer").classList.add("hide");render()}
function auth(err=""){
  $("app").innerHTML=`<div class="auth"><div class="card"><h1>Coach Assistant</h1><p class="sub">Sign in to sync your coaching data across your iPhone and iPad.</p>${err?`<div class="error">${esc(err)}</div>`:""}<input id="email" type="email" autocomplete="email" placeholder="Email"><input id="pw" type="password" autocomplete="current-password" placeholder="Password"><div class="buttons"><button class="primary" onclick="signin()">SIGN IN</button><button class="secondary" onclick="signup()">CREATE ACCOUNT</button></div></div></div>`;
}
async function signin(){const email=$("email")?.value.trim(),password=$("pw")?.value||"";if(!email||!password)return auth("Enter your email and password.");const r=await sb.auth.signInWithPassword({email,password});if(r.error)auth(r.error.message)}
async function signup(){const email=$("email")?.value.trim(),password=$("pw")?.value||"";if(!email||!password)return auth("Enter an email and password.");if(password.length<6)return auth("Use a password of at least 6 characters.");const r=await sb.auth.signUp({email,password});if(r.error)return auth(r.error.message);auth("Account created. If Supabase asks you to confirm your email, do that first, then sign in.")}
async function boot(){if(!configured())return showFatal("Supabase is not configured. Open config.js and enter your Project URL and Publishable Key.");try{const key=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();sb=window.supabase.createClient(String(window.SUPABASE_URL).trim(),key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}})}catch(e){return showFatal("Supabase could not be initialised: "+(e.message||e))}const r=await sb.auth.getSession();if(r.error)return showFatal(r.error.message);user=r.data.session?.user||null;if(user)await load();else auth();sb.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null;if(user)await load();else auth()})}

async function load(){
  try{
    const [tr,pr,dr]=await Promise.all([sb.from("teams").select("*").order("created_at"),sb.from("players").select("*").order("jersey_number"),sb.from("drills").select("*").order("created_at")]);
    if(tr.error)throw tr.error;if(pr.error)throw pr.error;if(dr.error)throw dr.error;
    teams=tr.data||[];players=pr.data||[];drills=dr.data||[];
    if(!T&&teams.length)T=teams[0].id;
    render();
  }catch(e){showFatal("Could not load your coaching data: "+(e.message||e))}
}

function render(){
  if(!user)return auth();
  const t=team();$("team").textContent=t?.name||"TEAM";
  if(S==="home")home();else if(S==="game")game();else if(S==="bench")bench();else if(S==="history")history();else if(S==="practice")practice();else if(S==="season")season();else if(S==="teams")teamsView();else settings();
}
function home(){
  const t=team();const ps=players.filter(p=>p.team_id===T);
  $("app").innerHTML=`<div class="hero"><div class="eyebrow">COACH ASSISTANT</div><h1>${esc(t?.name||"Your Team")}</h1><p>Game management, rotations and practice tools in one place.</p></div><h2>COACH BOARD</h2><div class="grid"><button class="action court-tile" onclick="go('game')"><span class="tile-icon basketball-icon">+</span><b>GAME DAY</b><span>Live scoring &amp; player stats</span></button><button class="action court-tile" onclick="go('bench')"><span class="tile-icon court-icon"></span><b>ROTATION</b><span>On court &amp; bench</span></button><button class="action court-tile" onclick="go('practice')"><span class="tile-icon timer-icon">◷</span><b>PRACTICE</b><span>Drills &amp; interval timer</span></button><button class="action court-tile" onclick="go('history')"><span class="tile-icon chart-icon">▥</span><b>GAME LOG</b><span>Previous games</span></button><button class="action court-tile" onclick="go('season')"><span class="tile-icon chart-icon">▦</span><b>SEASON</b><span>Team &amp; player totals</span></button><button class="action court-tile" onclick="go('teams')"><span class="tile-icon jersey-icon">#</span><b>ROSTER</b><span>${ps.length} players</span></button></div>`;
}

function pc(p){let g=G[p.id],pts=g.one+2*g.two+3*g.three,fo=g.foul===5;return `<div class="player${fo?" fouled-out":""}"><div class="player-head">${jersey(p)}<div class="player-name"><b>${esc(p.name)}</b><small>#${esc(p.jersey_number)} ${g.on?"• ON COURT":"• BENCH"}</small></div><strong class="player-points">${pts}<small>PTS</small></strong></div><div class="stats">FOULS ${g.foul}/5 <span>•</span> SUB OFF ${g.off}${fo?" <span class='foulout-label'>FOULED OUT</span>":""}</div><div class="buttons"><button class="primary" onclick="pts('${p.id}',1)">+1</button><button class="primary" onclick="pts('${p.id}',2)">+2</button><button class="primary" onclick="pts('${p.id}',3)">+3</button><button class="foul" onclick="foul('${p.id}')">FOUL</button><button class="${g.on?"danger":"success"}" onclick="sub('${p.id}')">${g.on?"SUB OFF":"SUB ON"}</button></div></div>`}
function foul(id){if(G[id].foul<5){G[id].foul++;if(G[id].foul===5)G[id].on=false}render()}
function sub(id){let g=G[id];if(g.foul>=5)return alert("Player has fouled out and cannot return to the court.");if(g.on){g.on=false;g.off++}else if(Object.values(G).filter(x=>x.on).length<5)g.on=true;else return alert("Five players are already on court.");render()}

function game(){const ps=players.filter(p=>p.team_id===T);ps.forEach(p=>{if(!G[p.id])G[p.id]={one:0,two:0,three:0,foul:0,off:0,on:false}});$("app").innerHTML=`<div class="section-head"><div><div class="eyebrow">LIVE GAME</div><h1>Game Control</h1></div><button class="secondary" onclick="saveGame()">SAVE GAME</button></div><div class="scorebox court-score"><div><small>WEST BELCONNEN</small><div class="score">0</div></div><div><small>OPPONENT</small><div class="score">0</div></div></div><div class="game-strip"><span>PLAYERS</span><b>${Object.values(G).filter(x=>x.on).length}/5 ON COURT</b></div><div class="players">${ps.map(pc).join("")}</div>`}
function pts(id,n){if(!G[id])return;G[id][n===1?"one":n===2?"two":"three"]++;render()}

function bi(p){let g=G[p.id],fo=g.foul===5;return `<div class="benchitem${fo?" fouled-out":""}">${jersey(p)}<b>${esc(p.name)}<small>${g.foul}/5 fouls · ${g.off} sub offs${fo?" · FOULED OUT":""}</small></b><button class="${g.on?"danger":"success"}" onclick="sub('${p.id}')">${g.on?"SUB OFF":"SUB ON"}</button></div>`}
function bench(){const ps=players.filter(p=>p.team_id===T);ps.forEach(p=>{if(!G[p.id])G[p.id]={one:0,two:0,three:0,foul:0,off:0,on:false}});const on=ps.filter(p=>G[p.id].on),off=ps.filter(p=>!G[p.id].on);$("app").innerHTML=`<div class="eyebrow">ROTATION BOARD</div><h1>Bench</h1><p class="sub">Five players maximum on court.</p><div class="benchcols"><div class="bench court-panel"><h3>ON COURT <span>${on.length}/5</span></h3>${on.map(bi).join("")||"<p class='sub'>No players on court.</p>"}</div><div class="bench"><h3>BENCH <span>${off.length}</span></h3>${off.map(bi).join("")||"<p class='sub'>No players on bench.</p>"}</div></div>`}

async function saveGame(){const name=prompt("Opponent name");if(!name)return;const r=await sb.from("games").insert({team_id:T,opponent:name,played_at:new Date().toISOString()}).select().single();if(r.error)return alert(r.error.message);const rows=players.filter(p=>G[p.id]).map(p=>({game_id:r.data.id,player_id:p.id,one_point:G[p.id].one,two_point:G[p.id].two,three_point:G[p.id].three,fouls:G[p.id].foul,sub_off:G[p.id].off}));if(rows.length){const s=await sb.from("game_player_stats").insert(rows);if(s.error)return alert(s.error.message)}alert("Game saved.");}

function history(){ $("app").innerHTML=`<div class="eyebrow">GAME LOG</div><h1>History</h1><p class="sub">Saved games and player performances.</p><div class="card"><p class="sub">Game history will appear here as games are saved.</p></div>` }
function practice(){ $("app").innerHTML=`<div class="eyebrow">TRAINING</div><h1>Practice</h1><p class="sub">Cloud-saved custom drills.</p><div class="timer"><div class="timer-label">CURRENT DRILL</div><div>${esc(drills.find(x=>x.id===timer.id)?.name||"Select a drill")}</div><div class="time">${fmt(timer.left)}</div><div class="buttons" style="justify-content:center"><button class="success" onclick="start()">START</button><button class="secondary" onclick="pause()">PAUSE</button><button class="danger" onclick="resetTimer()">RESET</button></div></div><div class="card"><button class="primary" onclick="addDrill()">＋ ADD DRILL</button><div class="list" style="margin-top:8px">${drills.map(d=>`<div class="row"><b>${esc(d.name)}<small>${d.minutes} min</small></b><button class="secondary" onclick="sel('${d.id}')">SELECT</button></div>`).join("")}</div></div>` }
function fmt(x){return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0")}
function sel(id){timer.id=id;timer.left=(drills.find(x=>x.id===id)?.minutes||0)*60;render()}
function start(){if(!timer.id)return alert("Select a drill.");clearInterval(int);timer.running=true;int=setInterval(()=>{timer.left--;if(timer.left===60||timer.left===0)beep();if(timer.left<=0){timer.left=0;timer.running=false;clearInterval(int)}render()},1000);render()}
function pause(){timer.running=false;clearInterval(int);render()}
function resetTimer(){pause();timer.left=timer.id?(drills.find(x=>x.id===timer.id)?.minutes||0)*60:0;render()}
function beep(){try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=1800;g.gain.value=.08;o.connect(g);g.connect(audioCtx.destination);o.start();setTimeout(()=>o.stop(),220)}catch(e){}}
async function addDrill(){const name=prompt("Drill name");const minutes=Number(prompt("Minutes"));if(!name||!minutes)return;const r=await sb.from("drills").insert({team_id:T,name,minutes}).select().single();if(r.error)return alert(r.error.message);drills.push(r.data);render()}
function season(){ $("app").innerHTML=`<div class="eyebrow">SEASON REVIEW</div><h1>Season</h1><p class="sub">Player and team performance totals.</p><div class="card"><p class="sub">Totals are calculated from saved games.</p></div>` }
function teamsView(){const ps=players.filter(p=>p.team_id===T);$("app").innerHTML=`<div class="eyebrow">TEAM MANAGEMENT</div><h1>Roster</h1><p class="sub">${esc(team()?.name||"Team")}</p><div class="list">${ps.map(p=>`<div class="row roster-row">${jersey(p)}<b>${esc(p.name)}<small>#${esc(p.jersey_number)}</small></b></div>`).join("")}</div>`}
function settings(){ $("app").innerHTML=`<div class="eyebrow">APP</div><h1>Settings</h1><div class="card"><p class="sub">Signed in as ${esc(user?.email||"")}</p><button class="danger full" onclick="sb.auth.signOut()">SIGN OUT</button></div>` }

window.addEventListener("load",boot);
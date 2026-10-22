/* Team-based practice session builder. Session plans are stored locally per team, so no database migration is required. */
(function(){
  const key=()=>`wbb_practice_session_${T||"default"}`;
  const read=()=>{try{return JSON.parse(localStorage.getItem(key())||"[]")}catch(e){return[]}};
  const write=x=>localStorage.setItem(key(),JSON.stringify(x));
  const drillsInSession=()=>{const ids=read();return ids.map(id=>drills.find(d=>d.id===id)).filter(Boolean)};
  let sessionIndex=0;
  let timerEndsAt=0;
  let lastTimerSecond=null;
  const note=d=>d.notes?`<small class="drill-notes">${esc(d.notes)}</small>`:"";

  window.addToPracticeSession=function(id){const ids=read();if(!ids.includes(id))ids.push(id);write(ids);practice()};
  window.removeFromPracticeSession=function(id){write(read().filter(x=>x!==id));if(sessionIndex>=read().length)sessionIndex=Math.max(0,read().length-1);practice()};
  window.movePracticeDrill=function(id,dir){const ids=read(),i=ids.indexOf(id),j=i+dir;if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];write(ids);practice()};
  window.clearPracticeSession=function(){if(confirm(`Clear the practice session for ${team()?.name||"this team"}?`)){write([]);sessionIndex=0;practice()}};

  window.editDrill=async function(id){
    const drill=drills.find(d=>d.id===id);
    if(!drill)return;
    const name=prompt("Drill name",drill.name||"");
    if(name===null)return;
    const minutesInput=prompt("Minutes",String(drill.minutes||""));
    if(minutesInput===null)return;
    const minutes=Number(minutesInput);
    if(!Number.isFinite(minutes)||minutes<=0)return alert("Minutes must be a number greater than 0.");
    const notesInput=prompt("Brief description / notes (optional)",drill.notes||"");
    if(notesInput===null)return;
    try{
      const keyValue=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();
      const client=window.supabase.createClient(String(window.SUPABASE_URL).trim(),keyValue,{auth:{persistSession:true}});
      const r=await client.from("drills").update({name:name.trim(),minutes,notes:notesInput.trim()}).eq("id",id).select().single();
      if(r.error)return alert(r.error.message);
      const i=drills.findIndex(d=>d.id===id);if(i>=0)drills[i]=r.data;
      if(timer.id===id){timer.left=minutes*60}
      practice();
    }catch(e){alert(e.message||e)}
  };

  window.deleteDrill=async function(id){
    const drill=drills.find(d=>d.id===id);
    if(!drill)return;
    if(!confirm(`Delete “${drill.name}”? This will remove it from your saved drills and any practice sessions on this device.`))return;
    try{
      const keyValue=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();
      const client=window.supabase.createClient(String(window.SUPABASE_URL).trim(),keyValue,{auth:{persistSession:true}});
      const r=await client.from("drills").delete().eq("id",id);
      if(r.error)return alert(r.error.message);
      write(read().filter(x=>x!==id));
      const i=drills.findIndex(d=>d.id===id);if(i>=0)drills.splice(i,1);
      if(timer.id===id){timer.id=null;timer.left=0;timer.running=false;clearInterval(int)}
      sessionIndex=0;practice();
    }catch(e){alert(e.message||e)}
  };

  window.addDrill=async function(){
    const name=prompt("Drill name");if(!name)return;
    const minutes=Number(prompt("Minutes"));if(!Number.isFinite(minutes)||minutes<=0)return;
    const notes=prompt("Brief description / notes (optional)")||"";
    try{
      const keyValue=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();
      const client=window.supabase.createClient(String(window.SUPABASE_URL).trim(),keyValue,{auth:{persistSession:true}});
      const session=await client.auth.getSession();const currentUser=session.data?.session?.user;
      if(!currentUser)return alert("Please sign in again.");
      const r=await client.from("drills").insert({user_id:currentUser.id,name:name.trim(),minutes,notes:notes.trim()}).select().single();
      if(r.error)return alert(r.error.message);
      drills.push(r.data);timer.id=r.data.id;timer.left=minutes*60;S="practice";practice();
    }catch(e){alert(e.message||e)}
  };

  window.practice=function(){
    const all=drills||[],ids=read(),session=ids.map(id=>all.find(d=>d.id===id)).filter(Boolean);
    if(ids.length!==session.length)write(session.map(d=>d.id));
    const current=all.find(d=>d.id===timer.id),total=session.reduce((n,d)=>n+Number(d.minutes||0),0),title=team()?.name||"Current Team";
    const sessionRows=session.map((d,i)=>`<div class="row"><b>${esc(d.name)}<small>${d.minutes} min</small>${note(d)}</b><button class="secondary" onclick="movePracticeDrill('${d.id}',-1)" ${i===0?'disabled':''}>↑</button><button class="secondary" onclick="movePracticeDrill('${d.id}',1)" ${i===session.length-1?'disabled':''}>↓</button><button class="danger" onclick="removeFromPracticeSession('${d.id}')">REMOVE</button></div>`).join("");
    const library=all.map(d=>`<div class="row"><b>${esc(d.name)}<small>${d.minutes} min</small>${note(d)}</b>${ids.includes(d.id)?'<span class="badge">IN SESSION</span>':'<button class="secondary" onclick="addToPracticeSession(\''+d.id+'\')">ADD</button>'}<button class="secondary" onclick="selPracticeDrill('${d.id}')">SELECT</button><button class="secondary" onclick="editDrill('${d.id}')">EDIT</button><button class="danger" onclick="deleteDrill('${d.id}')">DELETE</button></div>`).join("");
    $("app").innerHTML=`<h1>Practice</h1><p class="sub">${esc(title)} · build a session from your saved drills.</p><div class="timer"><div>${esc(current?.name||"Select a drill")}</div><div class="time">${fmt(timer.left)}</div><div class="buttons" style="justify-content:center"><button class="success" onclick="startPracticeSession()">START SESSION</button><button class="secondary" onclick="pausePracticeSession()">PAUSE</button><button class="danger" onclick="resetPracticeSession()">RESET</button></div></div><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><h2 style="margin:0">${esc(title)} SESSION</h2><small>${session.length} drills · ${total} min total</small></div>${session.length?'<button class="danger" onclick="clearPracticeSession()">CLEAR</button>':''}</div><div class="list" style="margin-top:10px">${sessionRows||'<div class="notice">No drills in this session yet. Add saved drills below.</div>'}</div></div><div class="card"><h2 style="margin-top:0">SAVED DRILLS</h2><div class="list">${library||'<div class="notice">No saved drills yet. Add your first drill below.</div>'}</div><button class="primary full" style="margin-top:10px" onclick="addDrill()">＋ ADD DRILL</button></div>`;
  };

  window.selPracticeDrill=function(id){timer.id=id;timer.left=(drills.find(x=>x.id===id)?.minutes||0)*60;sessionIndex=Math.max(0,drillsInSession().findIndex(d=>d.id===id));practice()};
  function prepareAudio(){try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){if(!audioCtx)audioCtx=new AC();if(audioCtx.state==="suspended")audioCtx.resume()}}catch(e){}}
  function alertCoach(){
    beep();
    try{if("vibrate" in navigator)navigator.vibrate([300,120,300])}catch(e){}
  }
  function timerTick(){if(!timer.running)return;timer.left=Math.max(0,Math.ceil((timerEndsAt-Date.now())/1000));if(timer.left!==lastTimerSecond){lastTimerSecond=timer.left;if(timer.left===60)alertCoach();if(timer.left===0){beep();const s=drillsInSession();sessionIndex++;if(sessionIndex>=s.length){timer.running=false;clearInterval(int);int=null;timerEndsAt=0;practice();return;}timer.id=s[sessionIndex].id;timer.left=Math.max(0,Math.round(Number(s[sessionIndex].minutes)||0)*60);timerEndsAt=Date.now()+timer.left*1000;lastTimerSecond=null;}practice()}}
  window.startPracticeSession=function(){const s=drillsInSession();if(!s.length)return alert("Add at least one drill to the session.");prepareAudio();if(sessionIndex>=s.length)sessionIndex=0;timer.id=s[sessionIndex].id;if(timer.left<=0)timer.left=Math.round(Number(s[sessionIndex].minutes)||0)*60;clearInterval(int);timer.running=true;timerEndsAt=Date.now()+timer.left*1000;lastTimerSecond=null;int=setInterval(timerTick,200);practice()};
  window.pausePracticeSession=function(){if(timer.running){timer.left=Math.max(0,Math.ceil((timerEndsAt-Date.now())/1000));timer.running=false;}clearInterval(int);int=null;timerEndsAt=0;lastTimerSecond=null;practice()};
  window.resetPracticeSession=function(){window.pausePracticeSession();sessionIndex=0;const s=drillsInSession();timer.id=s[0]?.id||null;timer.left=s[0]?Math.round(Number(s[0].minutes)||0)*60:0;practice()};
})();

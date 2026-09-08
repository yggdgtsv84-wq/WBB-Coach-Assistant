/* Team-based practice session builder. Session plans are stored locally per team, so no database migration is required. */
(function(){
  const key=()=>`wbb_practice_session_${window.T||"default"}`;
  const read=()=>{try{return JSON.parse(localStorage.getItem(key())||"[]")}catch(e){return[]}};
  const write=x=>localStorage.setItem(key(),JSON.stringify(x));
  const drillsInSession=()=>{const ids=read();return ids.map(id=>window.drills.find(d=>d.id===id)).filter(Boolean)};
  let sessionIndex=0;

  window.addToPracticeSession=function(id){
    const ids=read();
    if(!ids.includes(id))ids.push(id);
    write(ids);
    window.practice();
  };
  window.removeFromPracticeSession=function(id){
    write(read().filter(x=>x!==id));
    if(sessionIndex>=read().length)sessionIndex=Math.max(0,read().length-1);
    window.practice();
  };
  window.movePracticeDrill=function(id,dir){
    const ids=read(),i=ids.indexOf(id),j=i+dir;
    if(i<0||j<0||j>=ids.length)return;
    [ids[i],ids[j]]=[ids[j],ids[i]];write(ids);window.practice();
  };
  window.clearPracticeSession=function(){
    if(confirm(`Clear the practice session for ${window.team()?.name||"this team"}?`)){write([]);sessionIndex=0;window.practice();}
  };

  window.addDrill=async function(){
    const name=prompt("Drill name");
    if(!name)return;
    const minutes=Number(prompt("Minutes"));
    if(!Number.isFinite(minutes)||minutes<=0)return;
    try{
      const keyValue=String(window.SUPABASE_PUBLISHABLE_KEY||window.SUPABASE_ANON_KEY||"").trim();
      const client=window.supabase.createClient(String(window.SUPABASE_URL).trim(),keyValue,{auth:{persistSession:true}});
      const session=await client.auth.getSession();
      const currentUser=session.data?.session?.user;
      if(!currentUser)return alert("Please sign in again.");
      const r=await client.from("drills").insert({user_id:currentUser.id,name:name.trim(),minutes}).select().single();
      if(r.error)return alert(r.error.message);
      window.drills.push(r.data);
      window.timer.id=r.data.id;
      window.timer.left=minutes*60;
      window.S="practice";
      window.practice();
    }catch(e){alert(e.message||e)}
  };

  window.practice=function(){
    const all=window.drills||[], ids=read(), session=ids.map(id=>all.find(d=>d.id===id)).filter(Boolean);
    if(ids.length!==session.length)write(session.map(d=>d.id));
    const current=session.find(d=>d.id===window.timer.id);
    const total=session.reduce((n,d)=>n+Number(d.minutes||0),0);
    const title=window.team()?.name||"Current Team";
    const sessionRows=session.map((d,i)=>`<div class="row"><b>${window.esc(d.name)}<small>${d.minutes} min</small></b><button class="secondary" onclick="movePracticeDrill('${d.id}',-1)" ${i===0?'disabled':''}>↑</button><button class="secondary" onclick="movePracticeDrill('${d.id}',1)" ${i===session.length-1?'disabled':''}>↓</button><button class="danger" onclick="removeFromPracticeSession('${d.id}')">REMOVE</button></div>`).join("");
    const library=all.map(d=>`<div class="row"><b>${window.esc(d.name)}<small>${d.minutes} min</small></b>${ids.includes(d.id)?'<span class="badge">IN SESSION</span>':'<button class="secondary" onclick="addToPracticeSession(\''+d.id+'\')">ADD</button>'}<button class="secondary" onclick="selPracticeDrill('${d.id}')">SELECT</button></div>`).join("");
    $("app").innerHTML=`<h1>Practice</h1><p class="sub">${window.esc(title)} · build a session from your saved drills.</p><div class="timer"><div>${window.esc(current?.name||"Select a drill")}</div><div class="time">${window.fmt(window.timer.left)}</div><div class="buttons" style="justify-content:center"><button class="success" onclick="startPracticeSession()">START SESSION</button><button class="secondary" onclick="pausePracticeSession()">PAUSE</button><button class="danger" onclick="resetPracticeSession()">RESET</button></div></div><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><h2 style="margin:0">${window.esc(title)} SESSION</h2><small>${session.length} drills · ${total} min total</small></div>${session.length?'<button class="danger" onclick="clearPracticeSession()">CLEAR</button>':''}</div><div class="list" style="margin-top:10px">${sessionRows||'<div class="notice">No drills in this session yet. Add saved drills below.</div>'}</div></div><div class="card"><h2 style="margin-top:0">SAVED DRILLS</h2><div class="list">${library||'<div class="notice">No saved drills yet. Add your first drill below.</div>'}</div><button class="primary full" style="margin-top:10px" onclick="addDrill()">＋ ADD DRILL</button></div>`;
  };

  window.selPracticeDrill=function(id){window.timer.id=id;window.timer.left=(window.drills.find(x=>x.id===id)?.minutes||0)*60;sessionIndex=Math.max(0,drillsInSession().findIndex(d=>d.id===id));window.practice();};
  function prepareAudio(){try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){if(!window.audioCtx)window.audioCtx=new AC();if(window.audioCtx.state==="suspended")window.audioCtx.resume()}}catch(e){}}
  window.startPracticeSession=function(){
    const s=drillsInSession();if(!s.length)return alert("Add at least one drill to the session.");prepareAudio();if(sessionIndex>=s.length)sessionIndex=0;window.timer.id=s[sessionIndex].id;if(window.timer.left<=0)window.timer.left=s[sessionIndex].minutes*60;clearInterval(window.int);window.timer.running=true;window.int=setInterval(()=>{window.timer.left--;if(window.timer.left===60||window.timer.left===0)window.beep();if(window.timer.left<=0){window.beep();sessionIndex++;if(sessionIndex>=s.length){window.timer.left=0;window.timer.running=false;clearInterval(window.int)}else{window.timer.id=s[sessionIndex].id;window.timer.left=s[sessionIndex].minutes*60}}window.practice()},1000);window.practice();
  };
  window.pausePracticeSession=function(){window.timer.running=false;clearInterval(window.int);window.practice();};
  window.resetPracticeSession=function(){window.pausePracticeSession();sessionIndex=0;const s=drillsInSession();window.timer.id=s[0]?.id||null;window.timer.left=s[0]?(s[0].minutes||0)*60:0;window.practice();};
})();

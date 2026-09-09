// Keep every navigation entry behind authentication.
// app.js owns the auth state; this guard controls navigation UI and the
// published app's sign-in experience.
const _coachGo=go;
go=function(s){
  if(!user){
    $("drawer").classList.add("hide");
    return auth("Please sign in to use Coach Assistant.");
  }
  return _coachGo(s);
};

$("menu").onclick=()=>{
  if(!user)return auth("Please sign in to use Coach Assistant.");
  $("drawer").classList.remove("hide");
};

// This app is private. Keep the existing sign-in function from app.js,
// but replace its screen so there is no public account-creation option.
function auth(err=""){
  $("app").innerHTML=`<div class="auth"><div class="card"><h1>Coach Assistant</h1><p class="sub">Sign in to sync your coaching data across your iPhone and iPad.</p>${err?`<div class="error">${esc(err)}</div>`:""}<input id="email" type="email" autocomplete="email" placeholder="Email"><input id="pw" type="password" autocomplete="current-password" placeholder="Password"><div class="buttons"><button class="primary" onclick="signin()">SIGN IN</button></div></div></div>`;
}

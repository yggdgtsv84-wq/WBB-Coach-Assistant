// Keep every navigation entry behind authentication.
// app.js owns the auth state; this guard only controls navigation UI.
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

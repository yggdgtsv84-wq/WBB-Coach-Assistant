// Keep every navigation entry behind authentication.
// app.js owns the auth state; this guard controls navigation UI and the
// email-confirmation redirect so Supabase never falls back to localhost.
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

function coachAuthRedirect(){
  return window.location.origin + window.location.pathname;
}

// Override signup so confirmation emails return to the published site.
// This is important because Supabase defaults to localhost when no redirect
// URL/site URL has been configured.
async function signup(){
  const email=$("email")?.value.trim(), password=$("pw")?.value||"";
  if(!email||!password)return auth("Enter your email and password.");
  if(password.length<6)return auth("Use a password of at least 6 characters.");
  const r=await sb.auth.signUp({
    email,
    password,
    options:{emailRedirectTo:coachAuthRedirect()}
  });
  if(r.error)return auth(r.error.message);
  auth("Account created. Check your email and tap the confirmation link. You’ll return to Coach Assistant automatically.");
}

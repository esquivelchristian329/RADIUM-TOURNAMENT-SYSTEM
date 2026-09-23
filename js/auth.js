/* RADIUM AUTHENTICATION
   Separate Supabase Auth accounts for RADIUM staff roles.
   Role is read from public.profiles and cannot be selected on the login form.
*/
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const allowed={
    ADMIN:new Set(['dashboardPage','bracketPage','anyoPage','drawLotsPage','queuePage','resultsPage','reportsPage','setupPage','playersPage','teamsPage','categoriesPage','entryFormsPage','controlPage','systemCheckPage','weighinPage','operatorPage','tvPage','staffPage','accountingPage']),
    TOURNAMENT_MANAGER:new Set(['dashboardPage','bracketPage','anyoPage','drawLotsPage','queuePage','resultsPage','reportsPage','setupPage','playersPage','teamsPage','categoriesPage','entryFormsPage','controlPage','systemCheckPage','weighinPage','operatorPage','tvPage']),
    ACCOUNTANT:new Set(['dashboardPage','resultsPage','reportsPage','accountingPage','systemCheckPage','playersPage','teamsPage','categoriesPage','weighinPage']),
    TABLE_OFFICIAL:new Set(['dashboardPage','anyoPage','queuePage','resultsPage','reportsPage','operatorPage','tvPage','systemCheckPage','playersPage'])
  };
  let current=null;
  window.RADIUM_AUTH={
    user:null, role:null,
    openLogin(){showLogin();},
    isAdmin(){return this.role==='ADMIN'},
    isOfficial(){return this.role==='TABLE_OFFICIAL'},
    isManager(){return this.role==='TOURNAMENT_MANAGER'},
    isAccountant(){return this.role==='ACCOUNTANT'},
    can(page){return !!(this.role&&allowed[this.role]?.has(page))},
    async logout(){
      try{if(window.RADIUM_DB?.state?.client) await window.RADIUM_DB.signOut();}catch(e){console.warn('Logout:',e)}
      this.user=null;this.role=null;current=null;
      try{sessionStorage.removeItem('RADIUM_AUTH_ROLE')}catch(e){}
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      window.RADIUM_LANDING?.show?.();
      const dash=document.getElementById('dashboardPage');if(dash)dash.classList.add('active');
      try{history.replaceState({},'',location.pathname)}catch(e){}
      showLogin();
    }
  };
  function ensureGate(){
    if($('radiumAuthGate'))return;
    const d=document.createElement('div');d.id='radiumAuthGate';d.innerHTML=`
      <div class="auth-card">
        <div class="auth-brand"><div class="auth-mark">R</div><div><div class="auth-title">RADIUM</div><div class="auth-sub">TOURNAMENT SYSTEM</div></div></div>
        <div class="auth-kicker">SECURE OPERATOR LOGIN</div>
        <h1>Sign in to RADIUM</h1>
        <p class="auth-help">Use your assigned <b>RADIUM staff</b> account. Your role is detected automatically after login.</p>
        <form id="radiumLoginForm" autocomplete="on">
          <label>Email<input id="radiumLoginEmail" type="email" autocomplete="username" required placeholder="Email address"></label>
          <label>Password<input id="radiumLoginPassword" type="password" autocomplete="current-password" required placeholder="Password"></label>
          <button class="auth-login" id="radiumLoginBtn" type="submit">SIGN IN</button>
        </form>
        <button type="button" id="radiumForgotBtn" class="auth-link">Forgot password?</button>
        <div id="radiumResetPanel" class="auth-reset-panel" hidden>
          <h2>Reset password</h2>
          <p>Enter your RADIUM staff email. We will send a secure password-reset link.</p>
          <form id="radiumResetRequestForm">
            <label>Email<input id="radiumResetEmail" type="email" autocomplete="email" required placeholder="Email address"></label>
            <button class="auth-login" id="radiumResetRequestBtn" type="submit">SEND RESET LINK</button>
          </form>
          <button type="button" id="radiumBackToLogin" class="auth-link">Back to sign in</button>
        </div>
        <div id="radiumRecoveryPanel" class="auth-reset-panel" hidden>
          <h2>Create new password</h2>
          <p>Choose a new password for this RADIUM account.</p>
          <form id="radiumRecoveryForm">
            <label>New password<input id="radiumNewPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label>
            <label>Confirm password<input id="radiumConfirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Repeat new password"></label>
            <button class="auth-login" id="radiumRecoveryBtn" type="submit">UPDATE PASSWORD</button>
          </form>
        </div>
        <div id="radiumLoginError" class="auth-error" hidden></div>
        <div class="auth-note"><span>🔒</span> Staff roles protect tournament setup, accounting, and court operations.</div>
      </div>`;
    document.body.prepend(d);
    $('radiumLoginForm').addEventListener('submit',e=>{e.preventDefault();login();});
    $('radiumForgotBtn').addEventListener('click',showResetRequest);
    $('radiumBackToLogin').addEventListener('click',showLogin);
    $('radiumResetRequestForm').addEventListener('submit',e=>{e.preventDefault();requestPasswordReset();});
    $('radiumRecoveryForm').addEventListener('submit',e=>{e.preventDefault();updatePassword();});
  }
  function hideLogin(){const g=$('radiumAuthGate');if(g)g.style.display='none';document.body.classList.remove('auth-required');document.body.classList.remove('auth-checking');window.RADIUM_LANDING?.hide?.();}
  function showLanding(){const g=$('radiumAuthGate');if(g)g.style.display='none';document.body.classList.add('auth-required');document.body.classList.remove('auth-checking');window.RADIUM_LANDING?.show?.();}
  function setHeader(){
    const role=current?.role||''; const email=current?.user?.email||'';
    document.querySelectorAll('[data-auth-role]').forEach(e=>e.textContent=role);
    const sb=document.querySelector('.sidebar-user');
    if(sb){
      const strong=sb.querySelector('strong'), span=sb.querySelector('span'), small=sb.querySelector('small');
      if(strong)strong.textContent=({ADMIN:'RADIUM ADMIN',TOURNAMENT_MANAGER:'TOURNAMENT MANAGER',ACCOUNTANT:'RADIUM ACCOUNTANT',TABLE_OFFICIAL:'TABLE OFFICIAL'})[role]||'RADIUM STAFF';
      if(span)span.textContent=email||'Authenticated account';
      if(small)small.innerHTML='<i></i> '+role+' • ONLINE';
    }
    const badge=$('modeBadge'); if(badge){badge.textContent=role.replace('_',' ')+' ACCOUNT';badge.className='mode-badge '+(role==='TABLE_OFFICIAL'?'official':'');}
  }
  function applyRoleUI(){
    const role=current?.role; if(!role)return;
    document.querySelectorAll('[data-page]').forEach(btn=>{
      const p=btn.getAttribute('data-page');
      if(p&&!allowed[role].has(p)){btn.style.display='none';btn.setAttribute('aria-hidden','true');}
      else if(p){btn.style.display='';btn.removeAttribute('aria-hidden');}
    });
    document.querySelectorAll('[data-auth-admin]').forEach(e=>e.style.display=role==='ADMIN'?'':'none');
    document.querySelectorAll('[data-auth-official]').forEach(e=>e.style.display=role==='TABLE_OFFICIAL'?'':'none');
    document.querySelectorAll('[data-auth-accountant]').forEach(e=>e.style.display=(role==='ACCOUNTANT'||role==='ADMIN')?'':'none');
    document.querySelectorAll('[data-auth-manager]').forEach(e=>e.style.display=(role==='TOURNAMENT_MANAGER'||role==='ADMIN')?'':'none');
    document.querySelectorAll('[data-action=backup],[data-action=settings]').forEach(e=>e.style.display=role==='ADMIN'?'':'none');
    const navGroups=[...document.querySelectorAll('.nav-group')];navGroups.forEach(g=>{const visible=[...g.querySelectorAll('.nav-item')].some(x=>getComputedStyle(x).display!=='none');g.style.display=visible?'':'none';});
    const readOnlyCompetition=['TABLE_OFFICIAL','ACCOUNTANT'].includes(role);
    const playerEditor=document.querySelector('#playersPage .page-heading + .card');
    if(playerEditor)playerEditor.style.display=readOnlyCompetition?'none':'';
    const anyoEntryEditor=document.getElementById('anyoEntryRegistrationCard');
    if(anyoEntryEditor)anyoEntryEditor.style.display=readOnlyCompetition?'none':'';
  }
  function patchNavigation(){
    document.addEventListener('click',function(e){
      const b=e.target?.closest?.('[data-page]'); if(!b||!current)return;
      const p=b.getAttribute('data-page'); if(p&&!RADIUM_AUTH.can(p)){e.preventDefault();e.stopImmediatePropagation();alert('Access restricted. Sign in with an Admin account to open this section.');return false;}
    },true);
  }
  function clearAuthPanels(){
    ['radiumResetPanel','radiumRecoveryPanel'].forEach(id=>{const e=$(id);if(e)e.hidden=true;});
    const f=$('radiumLoginForm'), forgot=$('radiumForgotBtn');
    if(f)f.style.display=''; if(forgot)forgot.style.display='';
  }
  function showLogin(msg){
    ensureGate();
    clearAuthPanels();
    document.body.classList.add('auth-required');
    document.body.classList.remove('auth-checking');
    const gate=$('radiumAuthGate'); gate.style.display='grid';
    if($('radiumLoginError')){ $('radiumLoginError').hidden=!msg; $('radiumLoginError').textContent=msg||''; }
    const btn=$('radiumLoginBtn'); if(btn){btn.disabled=false;btn.textContent='SIGN IN';}
  }
  function showResetRequest(){
    ensureGate();
    const f=$('radiumLoginForm'), forgot=$('radiumForgotBtn'), panel=$('radiumResetPanel'), err=$('radiumLoginError');
    if(f)f.style.display='none'; if(forgot)forgot.style.display='none'; if(panel)panel.hidden=false;
    if(err){err.hidden=true;err.textContent='';}
    const email=$('radiumLoginEmail')?.value.trim(); if(email&&$('radiumResetEmail'))$('radiumResetEmail').value=email;
  }
  function showRecovery(){
    ensureGate();
    const f=$('radiumLoginForm'), forgot=$('radiumForgotBtn'), panel=$('radiumRecoveryPanel');
    if(f)f.style.display='none'; if(forgot)forgot.style.display='none'; if(panel)panel.hidden=false;
    document.body.classList.add('auth-required');
    document.body.classList.remove('auth-checking');
    $('radiumAuthGate').style.display='grid';
    const err=$('radiumLoginError'); if(err){err.hidden=true;err.textContent='';}
  }
  async function requestPasswordReset(){
    const email=$('radiumResetEmail').value.trim(), btn=$('radiumResetRequestBtn'), err=$('radiumLoginError');
    btn.disabled=true;btn.textContent='SENDING...'; if(err){err.hidden=true;err.textContent='';}
    try{
      if(!window.RADIUM_DB)throw new Error('Database bridge is not loaded.');
      const init=await window.RADIUM_DB.init(); if(!init.enabled)throw new Error('Supabase is not configured or could not be initialized.');
      const result=await window.RADIUM_DB.resetPassword(email, window.location.href.split('#')[0]);
      if(result.error)throw result.error;
      if(err){err.hidden=false;err.textContent='Reset link sent. Check your email, then open the link on this same RADIUM site.';}
      btn.textContent='RESET LINK SENT';
    }catch(e){
      console.error('RADIUM password reset request',e);
      if(err){err.hidden=false;err.textContent=e?.message||String(e);}
      btn.disabled=false;btn.textContent='SEND RESET LINK';
    }
  }
  async function updatePassword(){
    const p=$('radiumNewPassword').value, c=$('radiumConfirmPassword').value, btn=$('radiumRecoveryBtn'), err=$('radiumLoginError');
    if(p!==c){if(err){err.hidden=false;err.textContent='Passwords do not match.';}return;}
    if(p.length<8){if(err){err.hidden=false;err.textContent='Password must be at least 8 characters.';}return;}
    btn.disabled=true;btn.textContent='UPDATING...'; if(err){err.hidden=true;err.textContent='';}
    try{
      const init=await window.RADIUM_DB.init(); if(!init.enabled)throw new Error('Supabase is not configured or could not be initialized.');
      const result=await window.RADIUM_DB.updatePassword(p);
      if(result.error)throw result.error;
      if(err){err.hidden=false;err.textContent='Password updated successfully. You can now sign in with your new password.';}
      $('radiumRecoveryForm').reset();
      setTimeout(()=>showLogin(),1200);
    }catch(e){
      console.error('RADIUM password update',e);
      if(err){err.hidden=false;err.textContent=e?.message||String(e);}
      btn.disabled=false;btn.textContent='UPDATE PASSWORD';
    }
  }
  async function handleRecoverySession(){
    try{
      const hash=window.location.hash||'';
      if(!hash.includes('access_token=') && !/[?&]code=/.test(window.location.search))return false;
      await new Promise(r=>setTimeout(r,300));
      const s=await window.RADIUM_DB.session();
      if(s.data?.session){showRecovery();return true;}
    }catch(e){console.warn('Recovery session:',e)}
    return false;
  }

  async function login(){
    const email=$('radiumLoginEmail').value.trim(), password=$('radiumLoginPassword').value;
    const btn=$('radiumLoginBtn'), err=$('radiumLoginError');
    btn.disabled=true;btn.textContent='SIGNING IN...';err.hidden=true;
    try{
      if(!window.RADIUM_DB)throw new Error('Database bridge is not loaded.');
      const init=await window.RADIUM_DB.init(); if(!init.enabled)throw new Error('Supabase is not configured or could not be initialized.');
      const result=await window.RADIUM_DB.signIn(email,password);
      if(result.error)throw result.error;
      const user=result.data?.user;
      if(!user)throw new Error('Login succeeded but no user session was returned.');
      const q=await window.RADIUM_DB.select('profiles',{select:'role',eq:{id:user.id},limit:1});
      if(q.error)throw new Error('Profile lookup failed: '+q.error.message+'\nCreate the profiles table and assign this account a role.');
      const profile=Array.isArray(q.data)?q.data[0]:null;
      const role=String(profile?.role||'').toUpperCase();
      if(!allowed[role]){await window.RADIUM_DB.signOut();throw new Error('This account has no RADIUM role. Assign a valid RADIUM staff role in public.profiles.');}
      current={user,role};RADIUM_AUTH.user=user;RADIUM_AUTH.role=role;
      try{sessionStorage.setItem('RADIUM_AUTH_ROLE',role)}catch(e){}
      hideLogin();applyRoleUI();setHeader();
      document.dispatchEvent(new CustomEvent('radium-auth-ready',{detail:{user,role}}));
      if(window.toast)window.toast(role==='ADMIN'?'Admin account signed in':'Official account signed in');
    }catch(e){
      console.error('RADIUM login',e);
      let msg=e?.message||String(e);
      if(e?.status) msg='Login error '+e.status+': '+msg;
      err.hidden=false;err.textContent=msg;
      btn.disabled=false;btn.textContent='SIGN IN';
    }
  }
  async function boot(){
    ensureGate();
    showLanding();
    document.body.classList.add('auth-required');
    try{
      const init=await window.RADIUM_DB.init();
      if(!init.enabled){showLanding();return;}
      window.RADIUM_DB.client().auth.onAuthStateChange((event)=>{
        if(event==='PASSWORD_RECOVERY') showRecovery();
      });
      if(await handleRecoverySession()) return;
      const s=await window.RADIUM_DB.session();
      const user=s.data?.session?.user;
      // Public visitors stay on the landing page. Login is opened only when
      // the visitor presses a LOGIN / GET STARTED button. A valid Supabase
      // session skips the landing page and enters the protected application.
      if(!user){showLanding();return;}
      const q=await window.RADIUM_DB.select('profiles',{select:'role',eq:{id:user.id},limit:1});
      const role=String(q.data?.[0]?.role||'').toUpperCase();
      if(q.error||!allowed[role]){await window.RADIUM_DB.signOut();showLogin(q.error?'Profile lookup failed: '+q.error.message:'Account has no assigned RADIUM role.');return;}
      current={user,role};RADIUM_AUTH.user=user;RADIUM_AUTH.role=role;hideLogin();applyRoleUI();setHeader();document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));const requested=new URLSearchParams(location.search).get('view');const initialPage=(requested&&allowed[role]?.has(requested))?requested:'dashboardPage';const target=document.getElementById(initialPage);if(target)target.classList.add('active');document.dispatchEvent(new CustomEvent('radium-auth-ready',{detail:{user,role}}));
    }catch(e){showLanding();console.warn('RADIUM auth bootstrap:',e);}
  }
  function addLogout(){
    const footer=document.querySelector('.sidebar-user'); if(!footer||$('radiumLogoutBtn'))return;
    const b=document.createElement('button');b.id='radiumLogoutBtn';b.type='button';b.className='auth-logout';b.textContent='LOG OUT';b.addEventListener('click',()=>RADIUM_AUTH.logout());footer.appendChild(b);
    const top=document.querySelector('.top-actions'); if(top&&!$('topLogoutBtn')){const x=b.cloneNode(true);x.id='topLogoutBtn';x.addEventListener('click',()=>RADIUM_AUTH.logout());top.appendChild(x);}
  }
  function init(){ensureGate();addLogout();patchNavigation();setTimeout(boot,0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

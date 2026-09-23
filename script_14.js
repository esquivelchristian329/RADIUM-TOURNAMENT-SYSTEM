
/* RADIUM DATABASE STATUS — Supabase publishable-key aware health check */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const DASHBOARD='https://supabase.com/dashboard/project/slxwiqpbkkhixjvllsyy';
  function baseUrl(v){
    return String(v||'').trim()
      .replace(/\/+(?:rest\/v1)\/?$/i,'')
      .replace(/\/+$/,'');
  }
  function setStatus(kind,text,supabase,tournament,error){
    const pill=$('dbStatusPill'), status=$('dbStatusText');
    if(!pill||!status)return;
    pill.className='db-status-pill '+(kind==='ok'?'db-ok':kind==='fail'?'db-fail':'db-warn');
    status.textContent=text;
    if($('dbSupabaseState'))$('dbSupabaseState').textContent=supabase;
    if($('dbTournamentState'))$('dbTournamentState').textContent=tournament;
    if($('dbLastCheck'))$('dbLastCheck').textContent=new Date().toLocaleString();
    const er=$('dbStatusError');
    if(er){er.textContent=error||'';er.style.display=error?'block':'none';}
  }
  function getConfig(){
    const cfg=window.RADIUM_SUPABASE_CONFIG||{};
    return {base:baseUrl(cfg.url), key:String(cfg.anonKey||'').trim()};
  }
  async function testDatabase(){
    setStatus('warn','CHECKING...','Checking server...','Checking...','');
    const {base,key}=getConfig();
    if(!base||!key){
      setStatus('fail','NOT CONFIGURED','Missing configuration','Not checked','Set the Supabase project URL and publishable key in db/supabase-config.js?v=20260905final.');
      return;
    }
    const endpoint=base+'/rest/v1/tournaments?select=id&limit=1';
    try{
      // Supabase publishable keys are sent in the apikey header. Do NOT send a
      // publishable key as a Bearer token; it is not a JWT access token.
      const headers={apikey:key,Accept:'application/json'};
      const res=await fetch(endpoint,{method:'GET',headers,cache:'no-store',credentials:'omit'});
      const body=await res.text();
      let data=null; try{data=body?JSON.parse(body):null;}catch(_){ }
      if(!res.ok){
        const detail=(data&&(data.message||data.error_description||data.hint||data.error))||body||('HTTP '+res.status);
        if(res.status===401||res.status===403){
          setStatus('warn','SUPABASE REACHABLE','Server connected','Access restricted',
            'HTTP '+res.status+': '+detail+'\n\nThe Supabase server is reachable, but the current browser key/session cannot read public.tournaments. Sign in through RADIUM or add the appropriate RLS policy.');
        }else{
          setStatus('fail','DATABASE ERROR','Server responded','HTTP '+res.status,
            'Request URL: '+endpoint+'\n'+detail);
        }
        return;
      }
      setStatus('ok','DATABASE CONNECTED','Connected','Tournament table readable',
        Array.isArray(data)&&data.length ? 'Tournament service connection verified. At least one tournament record is visible.' : 'Tournament service connection verified. No saved tournament rows are currently visible.');
    }catch(e){
      setStatus('fail','DATABASE ERROR','Connection failed','Request failed',
        (e&&e.message?e.message:String(e))+'\n\nRequest URL: '+endpoint+'\n\nIf the page is loaded from the Android HTTP server, check that Chrome allows the request and that the Supabase project is online.');
    }
  }
  function init(){
    const btn=$('testDatabaseBtn');
    if(btn){btn.onclick=testDatabase;}
    const open=$('openSupabaseBtn');
    if(open)open.onclick=()=>window.open(DASHBOARD,'_blank','noopener');
    testDatabase();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,50);
  window.radiumTestDatabase=testDatabase;
})();

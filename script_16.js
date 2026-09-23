
/* RADIUM DATA ISOLATION / DELETE CONTROLS */
(function(){
  function clearLocalCurrent(){ /* Supabase-only mode: there is no local tournament store to clear. */ }
  function finishReload(message){alert(message);window.location.replace(window.location.pathname+'?reset='+Date.now());}
  async function deleteCurrent(e){
    if(e){e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();}
    if(window.RADIUM_AUTH?.isAdmin && !window.RADIUM_AUTH.isAdmin()){alert('Admin account required. Please sign in as ADMIN.');return false;}
    const id=window.RADIUM_CLOUD?.getId?.()||'';
    if(!id){clearLocalCurrent();finishReload('No active tournament. No local tournament data exists in Supabase-only mode.');return false;}
    if(!confirm('DELETE CURRENT TOURNAMENT?\n\nThis permanently removes the selected tournament from the RADIUM Tournament Service and its isolated local data folder. Players, matches, results, history, Anyo scores, audit logs and all related records will be deleted.\n\nThis cannot be undone.'))return false;
    if(String(prompt('Type DELETE to confirm.')||'').trim().toUpperCase()!=='DELETE'){alert('Delete cancelled.');return false;}
    try{const ok=await window.RADIUM_CLOUD.deleteTournament(id);if(!ok)throw new Error('Cloud deletion failed.');clearLocalCurrent();finishReload('Current tournament deleted from the RADIUM Tournament Service.');}catch(err){alert('Could not delete current tournament. '+(err?.message||err));}
    return false;
  }
  async function deleteAll(e){
    if(e){e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();}
    if(window.RADIUM_AUTH?.isAdmin && !window.RADIUM_AUTH.isAdmin()){alert('Admin account required. Please sign in as ADMIN.');return false;}
    if(!confirm('DELETE ALL TOURNAMENT DATA?\n\nThis permanently removes EVERY RADIUM tournament from Supabase, including players, teams, categories, brackets, matches, results, history, Anyo scores, medals and audit logs.\n\nThis cannot be undone.'))return false;
    if(String(prompt('Type DELETE ALL to confirm.')||'').trim().toUpperCase()!=='DELETE ALL'){alert('Delete cancelled.');return false;}
    try{const ok=await window.RADIUM_CLOUD.deleteAllTournaments();if(!ok)throw new Error('Cloud deletion failed.');finishReload('ALL RADIUM tournament data was deleted from the RADIUM Tournament Service.');}catch(err){alert('Could not delete all tournament data. '+(err?.message||err));}
    return false;
  }
  function bind(){
    const current=document.getElementById('resetTournamentBtn'),all=document.getElementById('resetAllBtn');
    if(current){current.type='button';current.onclick=deleteCurrent;current.style.touchAction='manipulation';}
    if(all){all.type='button';all.onclick=deleteAll;all.style.touchAction='manipulation';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.addEventListener('load',bind);window.addEventListener('pageshow',bind);
})();

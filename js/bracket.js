// --- RADIUM V14 category rules ---
function radiumCategoryUsesWeight(category){
  if(!category) return false;
  return !!(category.weightRequired || category.requireWeight ||
    category.weight_required || category.weightFrom > 0 || category.weightTo < 999);
}
function radiumCategoryGrouping(category){
  if(!category) return "age";
  // User rule: if weight is required, bracket by weight.
  // If weight is not required, bracket by age.
  return radiumCategoryUsesWeight(category) ? "weight" : "age";
}
function radiumNormalizeCategory(category){
  category = category || {};
  const usesWeight = radiumCategoryUsesWeight(category);
  category.weightRequired = usesWeight;
  category.bracketBy = usesWeight ? "weight" : "age";
  if(!usesWeight){
    category.weightFrom = 0;
    category.weightTo = 999;
  }
  return category;
}

'use strict';
const ACTIVE_ID_KEY='RADIUM_SUPABASE_TOURNAMENT_ID';
function activeTournamentId(){return String(window.RADIUM_CLOUD?.getId?.()||window.RADIUM_CLOUD?.state?.tournamentId||'');}
// Shared tournament category ordering used by every category selector/list.
// Combative weight order: Pinweight, Bantamweight, Featherweight, Extra Lightweight, Half Lightweight.
// Anyo order: Elementary/Secondary, then Single Weapon, Double Weapon, Espada y Daga.
function radiumCategoryDivision(c){
  if(String(c?.event||'')==='Arnis Anyo'){
    const n=String(c?.name||'').toLowerCase();
    return /\bsecondary\b/.test(n)||String(c?.division||'').toLowerCase()==='secondary'?'Secondary':'Elementary';
  }
  return 'Secondary';
}
function radiumWeightRank(c){
  const s=String(c?.weightClass||c?.weight_class||c?.name||'').toLowerCase();
  if(s.includes('pinweight')) return 1;
  if(s.includes('bantamweight')) return 2;
  if(s.includes('featherweight')) return 3;
  if(s.includes('extra lightweight')) return 4;
  if(s.includes('half lightweight')) return 5;
  return 99;
}
function radiumWeaponRank(c){
  const s=String(c?.anyoWeapon||c?.weapon||c?.name||'').toLowerCase();
  if(s.includes('single weapon')) return 1;
  if(s.includes('double weapon')) return 2;
  if(s.includes('espada y daga')||s.includes('espada y saga')) return 3;
  return 99;
}
function radiumCategorySort(a,b){
  const aa=String(a?.event||'')==='Arnis Anyo', bb=String(b?.event||'')==='Arnis Anyo';
  if(aa!==bb) return aa?-1:1;
  if(aa){
    const da=radiumCategoryDivision(a),db=radiumCategoryDivision(b);
    if(da!==db)return da==='Elementary'?-1:1;
    const wa=radiumWeaponRank(a),wb=radiumWeaponRank(b);
    if(wa!==wb)return wa-wb;
    const ta=String(a?.anyoType||a?.division||''),tb=String(b?.anyoType||b?.division||'');
    const tr={Individual:1,Synchronized:2,Mixed:3};
    if((tr[ta]||99)!==(tr[tb]||99))return (tr[ta]||99)-(tr[tb]||99);
  }else{
    const wa=radiumWeightRank(a),wb=radiumWeightRank(b);
    if(wa!==wb)return wa-wb;
  }
  return String(a?.name||'').localeCompare(String(b?.name||''),undefined,{numeric:true,sensitivity:'base'});
}
function radiumSortedCategories(list){return [...(Array.isArray(list)?list:[])].sort(radiumCategorySort);}
window.RADIUM_SORT_CATEGORIES=radiumSortedCategories;
const $=id=>document.getElementById(id);const uid=()=>`tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
let data={version:17,setup:{name:'',date:new Date().toISOString().slice(0,10),venue:'',organizer:'',courts:2,duration:60,type:'single',competitionProgram:'GENERAL',matchFlow:'ROUND_CATEGORY',gold:5,silver:3,bronze:1,pin:'',billingMode:'PAID',currency:'PHP',scoreboardLogos:['','','','']},teams:[],players:[],categories:[],results:[],medals:[],audit:[],activeCategory:null,locked:false,anyoResults:[],weighIns:{},anyoEntries:[]};
// Early mock-loader bridge: binds independently of later controller initialization.
// This is intentionally installed before the rest of the UI handlers so the mock
// tournament can still be loaded if another optional feature fails to initialize.
window.radiumLoadMockTournament=function(){
  try{
    const status=document.getElementById('mockLoaderStatus');
    if(status)status.textContent='Loading mock tournament…';
    if(typeof loadMockTournament==='function') return loadMockTournament();
    throw new Error('Mock tournament loader is unavailable. Reload the page and try again.');
  }catch(err){
    console.error('RADIUM mock loader error:',err);
    const msg='Mock tournament could not be loaded: '+(err&&err.message?err.message:err);
    const status=document.getElementById('mockLoaderStatus');
    if(status)status.textContent=msg;
    if(typeof toast==='function') toast(msg); else alert(msg);
  }
};
function bindMockLoader(){
  const b=document.getElementById('loadMockTournamentBtn');
  if(!b)return;
  b.type='button';
  b.onclick=function(e){e.preventDefault();e.stopPropagation();window.radiumLoadMockTournament();return false;};
  b.setAttribute('data-mock-loader','ready');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindMockLoader,{once:true});else bindMockLoader();

function load(){ data=createFreshData(); }

// Keep Individual Anyo entry state normalized before any renderer or cloud restore runs.
// This must be side-effect free: it only guarantees the array exists.
function ensureIndividualAnyoEntries(){
  if(!Array.isArray(data.anyoEntries)) data.anyoEntries=[];
  return data.anyoEntries;
}

// ANYO renderer compatibility: this build's controller calls renderAnyo()
// during every state restore, but the function was missing from the bundle.
// Keep the renderer self-contained so a cloud tournament can load even when
// there are no Anyo categories yet. It only renders the category/performer
// overview; scoring remains handled by the dedicated Anyo workflow.
let __anyoCloudLoadKey='';
let __anyoCloudLoading=false;
let __anyoDirectDirectoryLoading=false;
let __anyoDirectoryRetryCount=0;
let __anyoDirectoryLastTid='';

async function loadAnyoPerformerDirectory(){
  const host=$('anyoContent');
  const tid=window.RADIUM_CLOUD?.getId?.()||activeTournamentId();
  if(!host||!tid||__anyoDirectDirectoryLoading)return;
  __anyoDirectoryLastTid=String(tid);
  if(!window.RADIUM_DB){
    host.innerHTML='<div class="card"><div class="empty">LOADING ANYO PERFORMERS…</div></div>';
    if(__anyoDirectoryRetryCount<5){const retry=++__anyoDirectoryRetryCount;setTimeout(()=>{if(String(window.RADIUM_CLOUD?.getId?.()||activeTournamentId())===String(tid))loadAnyoPerformerDirectory();},500*retry);}
    return;
  }
  __anyoDirectDirectoryLoading=true;
  host.innerHTML='<div class="card"><div class="empty">LOADING ANYO PERFORMERS DIRECTLY FROM SUPABASE…</div></div>';
  try{
    const init=await window.RADIUM_DB.init();
    if(!init?.enabled){
      if(__anyoDirectoryRetryCount<5){const retry=++__anyoDirectoryRetryCount;setTimeout(()=>loadAnyoPerformerDirectory(),500*retry);return;}
      throw new Error('Supabase database bridge is not enabled.');
    }
    // Do not depend on cloud-sync state. The ANYO page reads the authoritative
    // tournament rows directly, which avoids the old empty-list state problem.
    const [cr,er,mr,pr,tr]=await Promise.all([
      window.RADIUM_DB.select('categories',{select:'id,name,event_type,gender,event_number,judges,preset,division,style,weapon,age_min,age_max,status',eq:{tournament_id:tid}}),
      window.RADIUM_DB.select('anyo_entries',{select:'id,tournament_id,category_id,entry_type,entry_number,style,weapon,group_reference,status,draw_order,draw_type,drawn_at',eq:{tournament_id:tid}}),
      window.RADIUM_DB.select('anyo_entry_members',{select:'entry_id,tournament_id,player_id,member_position',eq:{tournament_id:tid}}),
      window.RADIUM_DB.select('players',{select:'id,first_name,middle_name,last_name,gender,age,weight,player_number,team_id,status',eq:{tournament_id:tid}}),
      window.RADIUM_DB.select('teams',{select:'id,name',eq:{tournament_id:tid}})
    ]);
    for(const q of [cr,er,mr,pr,tr])if(q?.error)throw q.error;

    const categories=(cr.data||[]).filter(c=>String(c.event_type||'').trim().toLowerCase()==='anyo');
    const players=new Map((pr.data||[]).map(p=>[String(p.id),p]));
    const teams=new Map((tr.data||[]).map(t=>[String(t.id),t]));
    const membersByEntry=new Map();
    (mr.data||[]).forEach(m=>{
      const k=String(m.entry_id);
      if(!membersByEntry.has(k))membersByEntry.set(k,[]);
      membersByEntry.get(k).push(m);
    });
    const entries=(er.data||[]).filter(e=>!['deleted','withdrawn'].includes(String(e.status||'').toLowerCase())).map(e=>{
      const members=(membersByEntry.get(String(e.id))||[]).sort((a,b)=>Number(a.member_position||0)-Number(b.member_position||0));
      const people=members.map(m=>players.get(String(m.player_id))).filter(Boolean);
      const names=people.map(p=>[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(' ')).filter(Boolean);
      const teamNames=[...new Set(people.map(p=>teams.get(String(p.team_id))?.name).filter(Boolean))];
      return {id:e.id,categoryId:e.category_id,number:e.entry_number||'',type:e.entry_type||'Individual',style:e.style||'Traditional',weapon:e.weapon||'Any',drawOrder:Number.isFinite(Number(e.draw_order))?Number(e.draw_order):null,names,team:teamNames.join(' / ')||'No Team',memberCount:people.length,rawMemberCount:members.length};
    });
    const entryIds=new Set(entries.map(e=>String(e.id)));
    const activeCategories=categories.filter(c=>entries.some(e=>String(e.categoryId)===String(c.id))||categories.length);
    const unresolved=entries.filter(e=>e.rawMemberCount>0&&e.memberCount===0).length;
    const orphan=entries.filter(e=>!categories.some(c=>String(c.id)===String(e.categoryId))).length;

    const weaponOrder={'Single Weapon':1,'Double Weapon':2,'Espada y Daga':3,'Espada y Saga':3};
    const divisionOrder={'Individual':1,'Synchronized':2,'Mixed':3};
    const divisionOf=c=>String(c.name||'').toLowerCase().includes('secondary')?'Secondary':'Elementary';
    const sortedCategories=[...categories].sort((a,b)=>{
      const da=divisionOf(a),db=divisionOf(b); if(da!==db)return da==='Elementary'?-1:1;
      const wa=weaponOrder[a.weapon]||99,wb=weaponOrder[b.weapon]||99; if(wa!==wb)return wa-wb;
      const xa=divisionOrder[a.division]||99,xb=divisionOrder[b.division]||99; if(xa!==xb)return xa-xb;
      return String(a.name).localeCompare(String(b.name));
    });
    const currentId=String(data.activeCategory||'');
    const selectedCategory=sortedCategories.find(c=>String(c.id)===currentId)||sortedCategories[0]||null;
    if(selectedCategory)data.activeCategory=selectedCategory.id;
    const options=(division)=>sortedCategories.filter(c=>divisionOf(c)===division).map(c=>`<option value="${esc(c.id)}">${esc(c.name.replace(/^Elementary\s*•\s*|^Secondary\s*•\s*/i,''))}</option>`).join('');
    const selector=`<div class="anyo-category-selector card"><div><b>SELECT ANYO CATEGORY</b><div class="muted">Choose one category to display its performer list.</div></div><select id="anyoPerformerCategory" class="search"><option value="">SELECT CATEGORY</option>${sortedCategories.filter(c=>divisionOf(c)==='Elementary').length?`<optgroup label="ELEMENTARY">${options('Elementary')}</optgroup>`:''}${sortedCategories.filter(c=>divisionOf(c)==='Secondary').length?`<optgroup label="SECONDARY">${options('Secondary')}</optgroup>`:''}</select></div>`;
    const toolbar=`<div class="anyo-cloud-toolbar"><div><b>ANYO PERFORMERS — SUPABASE</b><span class="muted">${categories.length} categories • ${entries.length} entries • ${entries.reduce((n,e)=>n + (Number(e.memberCount) || 0), 0)} performers</span></div><button type="button" class="btn" id="refreshAnyoPerformersBtn">REFRESH</button></div>`;
    const warning=(unresolved||orphan)?`<div class="card" style="margin-bottom:16px;border-left:4px solid #d97706"><b>ANYO DATA CHECK</b><div class="muted" style="margin-top:5px">${unresolved} entries have member rows whose players could not be resolved; ${orphan} entries reference a missing category. Existing Supabase data was not changed.</div></div>`:'';
    let cards='';
    if(selectedCategory){
      const c=selectedCategory;
      const rawRows=entries.filter(e=>String(e.categoryId)===String(c.id));
      const rows=[...rawRows].sort((a,b)=>{const ad=Number(a.drawOrder),bd=Number(b.drawOrder);if(Number.isFinite(ad)&&Number.isFinite(bd))return ad-bd||String(a.number).localeCompare(String(b.number));if(Number.isFinite(ad))return -1;if(Number.isFinite(bd))return 1;return String(a.number).localeCompare(String(b.number));});
      const body=rows.length?rows.map((e,i)=>{
        const name=e.names.length?e.names.join(' + '):(e.rawMemberCount?`PLAYER RECORD NOT RESOLVED • ${e.number||e.id}`:(e.number||e.id));
        const displayNo=Number.isFinite(Number(e.drawOrder))?Number(e.drawOrder):i+1;
        return `<tr><td>${displayNo}</td><td><b>${esc(name)}</b>${e.number?`<div class="muted">${esc(e.number)}</div>`:''}</td><td>${esc(e.team)}</td><td>${esc(e.type)}</td></tr>`;
      }).join(''):'<tr><td colspan="4" class="empty">No registered performers found for this category.</td></tr>';
      const table=`<div class="table-wrap"><table><thead><tr><th>#</th><th>PERFORMER / ENTRY</th><th>TEAM</th><th>TYPE</th></tr></thead><tbody>${body}</tbody></table></div>`;
      const list=rows.length>12?`<details class="anyo-performer-collapse" open><summary><b>PERFORMER LIST</b><span>${rows.length} entries • ${rows.reduce((n,e)=>n + (Number(e.memberCount)||0),0)} performers</span></summary>${table}</details>`:table;
      const division=c.division||'Individual',style=c.style||'Traditional',weapon=c.weapon||'Any';
      const scoreboardUrl=`${location.origin}/anyo-scoreboard/?tournament=${encodeURIComponent(tid)}&categoryId=${encodeURIComponent(c.id)}&category=${encodeURIComponent(c.name)}&division=${encodeURIComponent(division)}&style=${encodeURIComponent(style)}&weapon=${encodeURIComponent(weapon)}&judges=${encodeURIComponent(Number(c.judges)||5)}`;
      cards=`<div class="card anyo-category-card"><div class="section-header"><div><h3>${esc(c.name)}</h3><p class="muted">${esc(sexLabel(c.gender||'Male'))} • ${esc(division)} • ${esc(style)} • ${esc(weapon)}</p></div><span class="mode-badge">${rows.length} ENTRIES</span></div><div class="anyo-scoreboard-open"><button type="button" class="btn primary" id="openSelectedAnyoScoreboard">ANYO SCOREBOARD</button></div>${list}</div>`;
      setTimeout(()=>{
        const sel=$('anyoPerformerCategory'); if(sel)sel.value=String(c.id);
        $('openSelectedAnyoScoreboard')?.addEventListener('click',()=>window.open(scoreboardUrl,'_blank','noopener,noreferrer'));
      },0);
    }else cards='<div class="card"><div class="empty">No Anyo categories are available.</div></div>';
    host.innerHTML=toolbar+selector+warning+cards;
    $('refreshAnyoPerformersBtn')?.addEventListener('click',()=>{__anyoDirectoryRetryCount=0;__anyoCloudLoadKey='';loadAnyoPerformerDirectory();});
    $('anyoPerformerCategory')?.addEventListener('change',e=>{data.activeCategory=e.target.value||null;renderAnyo();});

    // Keep the normal application state synchronized for scoreboards/forms, but
    // the visible directory above no longer depends on that state being complete.
    const mappedCats=categories.map(c=>({id:c.id,name:c.name,sex:c.gender||'Male',event:'Arnis Anyo',eventNumber:c.event_number||'',judges:Number(c.judges)||5,preset:c.preset||'',anyoType:c.division||'Individual',anyoStyle:c.style||'Traditional',anyoWeapon:c.weapon||'Any',ageFrom:Number(c.age_min)||0,ageTo:Number(c.age_max)||99,weightFrom:0,weightTo:999,weightRequired:false,bracketBy:null,draw:'random',bracket:null}));
    const catMap=new Map((data.categories||[]).map(c=>[String(c.id),c]));
    mappedCats.forEach(c=>catMap.set(String(c.id),{...(catMap.get(String(c.id))||{}),...c}));
    data.categories=[...catMap.values()];
    data.players=[...players.values()].map(p=>({id:p.id,number:p.player_number||'',name:[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(' '),sex:p.gender||'',age:p.age,weight:p.weight,teamId:p.team_id||'',events:p.events||{}}));
    data.anyoEntries=entries.map(e=>({id:e.id,number:e.number,type:e.type,categoryId:e.categoryId,style:e.style,weapon:e.weapon,memberIds:(membersByEntry.get(String(e.id))||[]).sort((a,b)=>Number(a.member_position||0)-Number(b.member_position||0)).map(m=>m.player_id),status:'active'}));
    __anyoCloudLoadKey=tid;
    __anyoDirectoryRetryCount=0;
  }catch(e){
    console.error('ANYO direct performer directory failed:',e);
    if(__anyoDirectoryRetryCount<3){const retry=++__anyoDirectoryRetryCount;setTimeout(()=>loadAnyoPerformerDirectory(),700*retry);return;}
    host.innerHTML=`<div class="card"><div class="empty"><b>ANYO PERFORMER LIST COULD NOT BE LOADED.</b><div style="margin-top:8px">${esc(e?.message||e||'Unknown Supabase error')}</div></div><div style="margin-top:12px"><button type="button" class="btn primary" id="retryAnyoPerformersBtn">RETRY LOAD PERFORMERS</button></div></div>`;
    $('retryAnyoPerformersBtn')?.addEventListener('click',()=>loadAnyoPerformerDirectory());
  }finally{__anyoDirectDirectoryLoading=false;}
}

// Compatibility wrapper retained for other RADIUM code paths.
async function loadAssignedAnyoCategoriesFromCloud(){return loadAnyoPerformerDirectory()}

function renderAnyo(){
  const host=$('anyoContent');
  if(!host)return;
  if(!__anyoDirectDirectoryLoading)loadAnyoPerformerDirectory();
}
const __anyoToolbarStyle=(()=>{if(document.getElementById('anyoPerformerToolbarStyle'))return;const st=document.createElement('style');st.id='anyoPerformerToolbarStyle';st.textContent='.anyo-cloud-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 16px;padding:12px 14px;border:1px solid #d9e0e8;border-radius:8px;background:#f8fafc}.anyo-cloud-toolbar div{display:flex;flex-direction:column;gap:3px}.anyo-cloud-toolbar .muted{font-size:11px}.anyo-category-selector{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 16px}.anyo-category-selector select{min-width:min(100%,620px);flex:1}.anyo-scoreboard-open{margin:0 0 14px}.anyo-scoreboard-open .btn{min-height:42px;font-weight:900}@media(max-width:700px){.anyo-category-selector{flex-direction:column;align-items:stretch}.anyo-category-selector select{width:100%}.anyo-scoreboard-open .btn{width:100%}}@media(max-width:700px){.anyo-cloud-toolbar{align-items:stretch;flex-direction:column}.anyo-cloud-toolbar button{width:100%}}';document.head.appendChild(st)})();

// Safe category navigation for Anyo categories. The full scoring screen can
// be opened by the dedicated Anyo controls without making state restoration
// depend on an optional renderer.
function openAnyoCategoryDetail(id){
  const c=cat(id);
  if(!c)return alert('Anyo category not found.');
  data.activeCategory=id;
  renderAnyo();
  showPage('anyoPage');
}

function normalizeBracketPlayerIds(){const ids=new Set((Array.isArray(data.players)?data.players:[]).map(p=>p.id));(Array.isArray(data.categories)?data.categories:[]).forEach(c=>{const b=c?.bracket;if(!b)return;const rounds=Array.isArray(b.rounds)?b.rounds:[];rounds.forEach(r=>{if(!Array.isArray(r))return;r.forEach(m=>{if(!m||typeof m!=='object')return;['red','blue','winner'].forEach(k=>{const v=m[k];if(v&&typeof v==='object')m[k]=v.id||v.playerId||null;else if(v&&!ids.has(v)&&typeof v==='string')m[k]=v;});});});if(b.champion&&typeof b.champion==='object')b.champion=b.champion.id||null;});}
function save(options={}){const st=$('saveState');if(st)st.textContent='CLOUD SAVE QUEUED '+new Date().toLocaleTimeString();try{window.RADIUM_CLOUD?.scheduleSync?.()}catch(e){console.warn('Cloud sync schedule:',e)}return true;}
function createFreshData(){return {version:16,tournamentId:activeTournamentId()||null,storageNamespace:null,setup:{name:'',date:new Date().toISOString().slice(0,10),venue:'',organizer:'',courts:2,duration:60,type:'single',competitionProgram:'GENERAL',matchFlow:'ROUND_CATEGORY',gold:5,silver:3,bronze:1,pin:'',billingMode:'PAID',currency:'PHP',scoreboardLogos:['','','','']},teams:[],players:[],categories:[],results:[],medals:[],audit:[],activeCategory:null,locked:false,anyoResults:[],weighIns:{},anyoEntries:[]};}
function resetAllData(){
  if(!confirm('DELETE ALL TOURNAMENT DATA?\n\nThis permanently deletes every RADIUM tournament from this device and the tournament service, including players, teams, categories, brackets, matches, results, medal tallies, Anyo scores, history and audit logs.\n\nThis cannot be undone.')) return;
  const typed=prompt('Type DELETE ALL to confirm.');
  if(String(typed||'').trim().toUpperCase()!=='DELETE ALL'){toast('Delete cancelled');return;}
  window.RADIUM_CLOUD?.deleteAllTournaments?.().then(ok=>{
    if(!ok){toast('Cloud deletion failed. Local data was not cleared.');return;}
    data=createFreshData();
    $('saveState').textContent='ALL DATA DELETED';
    alert('All RADIUM tournament data was deleted from this device and the tournament service.');
    window.location.replace(window.location.pathname+'?reset='+Date.now());
  }).catch(e=>{console.error(e);toast('Cloud deletion failed: '+(e?.message||e));});
}
function log(action,detail){data.audit.unshift({id:uid(),time:new Date().toISOString(),action,detail});data.audit=data.audit.slice(0,500);save()}
function toast(s){const t=$('toast');t.textContent=s;t.style.display='block';clearTimeout(window._toast);window._toast=setTimeout(()=>t.style.display='none',2500)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function age(v){if(v===null||v===undefined||v==='')return '';if(typeof v==='number'&&Number.isFinite(v))return Math.floor(v);if(typeof v==='string'&&/^\d+(?:\.0+)?$/.test(v.trim()))return Math.floor(Number(v));const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a}
function nextPow(n){let x=1;while(x<n)x*=2;return x}
function team(id){return data.teams.find(x=>x.id===id)}function cat(id){return data.categories.find(x=>x.id===id)}function player(id){if(id&&typeof id==='object')id=id.id||id.playerId;return data.players.find(x=>x.id===id)}
function sexLabel(v){return v==='Male'?'Boys':v==='Female'?'Girls':'Mixed'}
function anyoTypeLabel(v){return v==='Traditional'?'Traditional':v==='Non-Traditional'?'Non-Traditional':v||'—'}
function isAnyoEvent(c){return c&&c.event==='Arnis Anyo'}
function isLivestickEvent(c){return c&&c.event==='Livestick'}
function anyoEventCombos(e,division){const key=division==='Individual'?'anyoIndividualEvents':'anyoSynchronizedEvents';const arr=Array.isArray(e?.[key])?e[key].filter(Boolean):[];if(arr.length)return arr;return typeof legacyStyleCombos==='function'?legacyStyleCombos(e):[]}
function anyoStyleWeapons(e,style,division){const combos=anyoEventCombos(e,division);const arr=combos.filter(x=>String(x).startsWith(style+'|')).map(x=>String(x).split('|')[1]).filter(Boolean);if(arr.length)return arr;const key=style==='Traditional'?'anyoTraditionalWeapons':'anyoNonTraditionalWeapons';return Array.isArray(e?.[key])?e[key].filter(Boolean):[]}
function combatWeighInRecord(p,c){if(!p||!c)return null;const key=String(c.id)+'|'+String(p.id);const wi=data.weighIns?.[key]||null;if(!wi||wi.verified!==true)return null;const w=Number(wi.weight);return Number.isFinite(w)?{...wi,weight:w}:null}
function categoryRequiresVerifiedWeighIn(c){return !!(c&&(c.weightRequirement==='required'||c.weightRequired===true||c.bracketBy==='weight'||String(c.preset||'').toUpperCase()==='DEPED-PEKAF-COMBATIVES-12-17'));}
function eligible(p,c){const a=age(p.age ?? p.birth);if(a===''||a<c.ageFrom||a>c.ageTo)return false;if(c.sex&&c.sex!=='Mixed'&&c.sex!==p.sex)return false;const ev=c.event||'';if(ev==='Arnis Anyo'){const e=p.events||{};if(c.anyoType==='Individual'&&!e.anyoIndividual)return false;if(c.anyoType==='Synchronized'&&!e.anyoTeam)return false;if(c.anyoType==='Mixed')return false;const style=c.anyoStyle||'Traditional';const styleFlag=style==='Traditional'?e.anyoTraditional:e.anyoNonTraditional;if(styleFlag===false)return false;const weapons=anyoStyleWeapons(e,style,c.anyoType==='Individual'?'Individual':'Synchronized');if(c.anyoWeapon&&c.anyoWeapon!=='Any'&&!weapons.includes(c.anyoWeapon))return false;return true}if(ev==='Livestick')return p.events?.livestick===true&&p.weight>=c.weightFrom&&p.weight<=c.weightTo;if(!eCombat(p))return false;if(categoryRequiresVerifiedWeighIn(c)){const wi=combatWeighInRecord(p,c);return !!wi&&wi.weight>=Number(c.weightFrom)&&wi.weight<=Number(c.weightTo)}return p.weight>=c.weightFrom&&p.weight<=c.weightTo}function eCombat(p){return p.events?.combat!==false&&(p.events?.combat===true||!p.events)}
function showPage(id){const page=$(id);if(!page)return;const lockedPages=new Set(['setupPage','playersPage','teamsPage','categoriesPage','entryFormsPage','drawLotsPage','weighinPage']);if(data.locked&&lockedPages.has(id)){toast('Tournament is active and locked. Preparation controls are unavailable.');return;}document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));page.classList.add('active');document.querySelectorAll('.nav-item[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===id));const title=page.querySelector('.page-heading h2')?.textContent||({'dashboardPage':'Dashboard','bracketPage':'Brackets','anyoPage':'Anyo','queuePage':'Match Queue','resultsPage':'Results','reportsPage':'Reports'}[id]||'RADIUM');if($('topPageTitle'))$('topPageTitle').textContent=title;renderAll(id);if(id==='bracketPage')setTimeout(()=>loadBracketReview($('bracketCategory')?.value||data.activeCategory||''),0)}
function renderAll(){ensureIndividualAnyoEntries();renderDashboard();renderSetup();window.RADIUM_DRAW_LOTS?.refreshVisibility?.();renderTeamSelect();renderPlayers();renderTeams();renderCategories();renderCategorySelect();renderBracket();renderAnyo();renderAnyoEntryForm();renderQueue();renderMatchFlow();renderResults();renderReports()}
document.querySelectorAll('.nav-item[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));$('resetAllBtn').onclick=resetAllData; $('resetTournamentBtn')?.addEventListener('click',resetAllData);
$('sidebarToggle')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'));document.querySelectorAll('.sidebar .nav-item[data-page]').forEach(b=>b.addEventListener('click',()=>{if(window.innerWidth<=800)document.querySelector('.sidebar')?.classList.remove('open')}));$('fullscreenBtn')?.addEventListener('click',()=>document.documentElement.requestFullscreen?.());document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.go));
function renderDashboard(){ $('dashTitle').textContent=data.setup.name||'NEW TOURNAMENT';$('dashMeta').textContent=[data.setup.date,data.setup.venue,data.setup.organizer].filter(Boolean).join(' • ')||'Online tournament control center';const brackets=data.categories.filter(c=>c&&c.bracket);const matches=brackets.flatMap(c=>{const b=c.bracket||{};if(b.mode==='single'){const count=Array.isArray(b.players)?b.players.length:(Array.isArray(b.rounds)?b.rounds.reduce((n,r)=>n+(Array.isArray(r)?r.length:0),0):0);return [...Array(Math.max(0,count>1?count-1:0))];}return Array.isArray(b.rounds)?b.rounds.flatMap(r=>Array.isArray(r)?r:[]):[];});const completed=data.results.filter(r=>r.finished).length;const active=matches.length-completed;$('dashStats').innerHTML=[['PLAYERS',data.players.length],['CATEGORIES',data.categories.length],['MATCHES',matches.length],['COMPLETED',completed]].map(x=>`<div class="stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');$('liveCourts').innerHTML=Array.from({length:Number(data.setup.courts)||1},(_,i)=>{const m=data.results.find(r=>r.court===i+1&&!r.finished);return `<div class="activity-row"><b>COURT ${i+1}</b> — ${m?esc(m.blue)+' vs '+esc(m.red):'<span class="muted">AVAILABLE</span>'}</div>`}).join('');$('activity').innerHTML=data.audit.slice(0,7).map(a=>`<div class="activity-row"><b>${new Date(a.time).toLocaleTimeString()}</b> ${esc(a.action)} — ${esc(a.detail)}</div>`).join('')||'<div class="empty">No activity yet.</div>';const checks=[['Tournament setup',!!data.setup.name&&!!data.setup.date&&!!data.setup.venue,'setupPage'],['Teams',data.teams.length>0,'teamsPage'],['Players',data.players.length>0,'playersPage'],['Categories',data.categories.length>0,'categoriesPage'],['Brackets',data.categories.some(c=>c.bracket),'bracketPage']];$('setupChecklist').innerHTML=`<div class="section-header"><div><h3>TOURNAMENT CHECKLIST</h3><div class="muted">Complete these steps before competition.</div></div></div><div class="checklist">${checks.map(x=>`<button class="check-item ${x[1]?'done':''}" data-go="${x[2]}"><span class="check-icon">${x[1]?'✓':'○'}</span><span>${x[0]}</span><span class="check-action">${x[1]?'READY':'SET UP'}</span></button>`).join('')}</div>`;document.querySelectorAll('#setupChecklist [data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.go))}
function isFreeTournament(){return String(data.setup?.billingMode||'PAID').toUpperCase()==='FREE'}
function syncBillingUI(){const free=isFreeTournament(),sel=$('tBillingMode'),help=$('billingModeHelp');if(sel){sel.disabled=!(window.RADIUM_AUTH?.isAdmin?.());if(document.activeElement!==sel)sel.value=free?'FREE':'PAID';}if(help)help.textContent=free?'Free tournament: no registration fees or payment accounting are required.':'Paid tournament: registration fees and accounting are available.';const feeField=$('categoryFeeField'),fee=$('catRegistrationFee'),feeHelp=$('categoryFeeHelp');if(feeField)feeField.style.display=free?'none':'';if(fee){fee.disabled=free;if(free)fee.value=0}if(feeHelp)feeHelp.textContent=free?'Registration is FREE for this tournament.':'';document.body.classList.toggle('free-tournament',free);}
function renderSetup(){const rn=$('resetTournamentName'); if(rn) rn.textContent=data.setup?.name||'NO TOURNAMENT SELECTED';const s=data.setup||{};s.scoreboardLogos=Array.isArray(s.scoreboardLogos)?s.scoreboardLogos.slice(0,4):['','','',''];while(s.scoreboardLogos.length<4)s.scoreboardLogos.push('');data.setup=s;['tName','tDate','tVenue','tOrganizer','tCourts','tDuration','tCombativeRounds','tType','tCompetitionProgram','goldPts','silverPts','bronzePts','officialPin'].forEach(id=>{const el=$(id);if(el&&document.activeElement!==el){const k={tName:'name',tDate:'date',tVenue:'venue',tOrganizer:'organizer',tCourts:'courts',tDuration:'duration',tCombativeRounds:'combativeRounds',tType:'type',tCompetitionProgram:'competitionProgram',goldPts:'gold',silverPts:'silver',bronzePts:'bronze',officialPin:'pin'}[id];el.value=s[k]??''}});renderScoreboardLogoManager();syncBillingUI()}
async function loadScoreboardLogoRecords(){
  const tid=window.RADIUM_CLOUD?.getId?.();if(!tid||!window.RADIUM_DB)return [];
  try{const r=await window.RADIUM_DB.select('scoreboard_logos',{select:'id,slot,storage_path,file_name,mime_type,width,height,display_mode',eq:{tournament_id:tid}});if(r.error)throw r.error;return r.data||[]}catch(e){console.warn('Scoreboard branding load failed:',e);return []}
}
function renderScoreboardLogoManager(){const host=$('scoreboardLogoManager');if(!host)return;const can=!!(window.RADIUM_AUTH?.isAdmin?.()||window.RADIUM_AUTH?.isManager?.());host.querySelectorAll('input[type=file]').forEach(i=>i.disabled=!can);host.querySelectorAll('[data-logo-remove]').forEach(b=>b.disabled=!can);const logos=Array.isArray(data.setup?.scoreboardLogos)?data.setup.scoreboardLogos:['','','',''];host.querySelectorAll('[data-logo-slot]').forEach((card,i)=>{const src=logos[i]||'';const img=card.querySelector('[data-logo-preview]');const empty=card.querySelector('[data-logo-empty]');const remove=card.querySelector('[data-logo-remove]');if(img){img.src=src||'';img.style.display=src?'':'none'}if(empty)empty.style.display=src?'none':'';if(remove)remove.style.display=src?'':'none';card.classList.toggle('has-logo',!!src)});const note=$('scoreboardLogoPermission');if(note)note.textContent=can?'Tournament Manager or Admin can upload, replace, or remove scoreboard logos. Each logo has a permanent ID and is stored as a scoreboard branding asset.':'Only Tournament Manager or Admin can change scoreboard logos.';loadScoreboardLogoRecords().then(rows=>{if(!rows.length)return;rows.forEach(r=>{const idx=Number(r.slot)-1;if(idx>=0&&idx<4&&r.storage_path&&window.RADIUM_DB?.state?.client){const {data:u}=window.RADIUM_DB.state.client.storage.from('radium-scoreboard-logos').getPublicUrl(r.storage_path);if(u?.publicUrl){data.setup.scoreboardLogos[idx]=u.publicUrl;const card=host.querySelector(`[data-logo-slot="${idx}"]`);const img=card?.querySelector('[data-logo-preview]');const empty=card?.querySelector('[data-logo-empty]');if(img){img.src=u.publicUrl;img.style.display=''}if(empty)empty.style.display='none';card?.classList.add('has-logo')}}});});}
async function setupScoreboardLogoUpload(index,file){if(!(window.RADIUM_AUTH?.isAdmin?.()||window.RADIUM_AUTH?.isManager?.()))return alert('Only Tournament Manager or Admin can change scoreboard logos.');if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))return alert('Use PNG, JPEG, or WebP images only.');if(file.size>1024*1024)return alert('Each scoreboard logo must be 1 MB or smaller.');const tid=window.RADIUM_CLOUD?.getId?.();if(!tid||!window.RADIUM_DB?.state?.client)return alert('Select a tournament before changing scoreboard logos.');try{const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=URL.createObjectURL(file)});if(img.width<32||img.height<32)return alert('Logo image is too small. Use at least 32×32 pixels.');const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${tid}/${index+1}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;const storage=window.RADIUM_DB.state.client.storage.from('radium-scoreboard-logos');const up=await storage.upload(path,file,{contentType:file.type,upsert:false,cacheControl:'31536000'});if(up.error)throw up.error;const pub=storage.getPublicUrl(path)?.data?.publicUrl||'';const old=await window.RADIUM_DB.select('scoreboard_logos',{select:'id,storage_path',eq:{tournament_id:tid,slot:index+1},limit:1});if(old.error)throw old.error;const previousPath=old.data?.[0]?.storage_path||'';const row={tournament_id:tid,slot:index+1,storage_path:path,file_name:file.name,mime_type:file.type,width:img.width,height:img.height,display_mode:'contain',created_by:window.RADIUM_AUTH.user?.id||null,updated_at:new Date().toISOString()};let rr;if(old.data?.[0])rr=await window.RADIUM_DB.update('scoreboard_logos',row,{id:old.data[0].id});else rr=await window.RADIUM_DB.insert('scoreboard_logos',row);if(rr.error)throw rr.error;if(previousPath&&previousPath!==path){const removed=await storage.remove([previousPath]);if(removed?.error)console.warn('Previous scoreboard logo cleanup failed:',removed.error)}data.setup.scoreboardLogos[index]=pub;renderScoreboardLogoManager();toast(`Scoreboard logo ${index+1} saved. Permanent logo ID assigned by RADIUM.`)}catch(e){console.error('Logo upload failed:',e);alert('The scoreboard logo could not be saved. Please check the tournament connection and try again. '+(e?.message||e));}}
async function removeScoreboardLogo(index){if(!(window.RADIUM_AUTH?.isAdmin?.()||window.RADIUM_AUTH?.isManager?.()))return;const tid=window.RADIUM_CLOUD?.getId?.();if(!tid)return;try{const q=await window.RADIUM_DB.select('scoreboard_logos',{select:'id,storage_path',eq:{tournament_id:tid,slot:index+1},limit:1});if(q.error)throw q.error;if(q.data?.[0]){const path=q.data[0].storage_path;if(path)await window.RADIUM_DB.state.client.storage.from('radium-scoreboard-logos').remove([path]);const d=await window.RADIUM_DB.remove('scoreboard_logos',{id:q.data[0].id});if(d.error)throw d.error;}data.setup.scoreboardLogos[index]='';renderScoreboardLogoManager();toast(`Scoreboard logo ${index+1} removed.`)}catch(e){console.error('Logo removal failed:',e);alert('The scoreboard logo could not be removed. Please check the tournament connection. '+(e?.message||e));}}

function bindScoreboardLogoManager(){document.querySelectorAll('[data-logo-file]').forEach(input=>{if(input.dataset.logoBound==='1')return;input.dataset.logoBound='1';input.addEventListener('change',()=>{const i=Number(input.dataset.logoFile);setupScoreboardLogoUpload(i,input.files?.[0]);input.value=''})});document.querySelectorAll('[data-logo-remove]').forEach(btn=>{if(btn.dataset.logoBound==='1')return;btn.dataset.logoBound='1';btn.addEventListener('click',()=>removeScoreboardLogo(Number(btn.dataset.logoRemove)))})}
bindScoreboardLogoManager();
$('tBillingMode')?.addEventListener('change',()=>{if(!(window.RADIUM_AUTH?.isAdmin?.())){alert('Only Admin can change the tournament billing type.');syncBillingUI();return}syncBillingUI()});
$('saveSetup').onclick=async()=>{
  if(data.locked)return alert('Tournament is active and locked. Setup can no longer be changed.');
  const tournamentName=$('tName').value.trim();
  if(!tournamentName)return alert('Tournament name is required.');
  const requestedBilling=String($('tBillingMode')?.value||data.setup.billingMode||'PAID').toUpperCase()==='FREE'?'FREE':'PAID';
  if(requestedBilling!==String(data.setup.billingMode||'PAID').toUpperCase()&&!(window.RADIUM_AUTH?.isAdmin?.()))return alert('Only Admin can change the tournament billing type.');
  const setupBeforeSave={...data.setup};
  data.setup={...data.setup,name:tournamentName,date:$('tDate').value,venue:$('tVenue').value.trim(),organizer:$('tOrganizer').value.trim(),courts:Math.max(1,Number($('tCourts').value)||1),duration:Math.max(30,Number($('tDuration').value)||60),combativeRounds:Number($('tCombativeRounds')?.value)===1?1:3,type:$('tType').value,competitionProgram:$('tCompetitionProgram').value==='DEPED_PEKAF'?'DEPED_PEKAF':'GENERAL',gold:Math.max(0,Number($('goldPts').value)||0),silver:Math.max(0,Number($('silverPts').value)||0),bronze:Math.max(0,Number($('bronzePts').value)||0),pin:$('officialPin').value,billingMode:requestedBilling,currency:'PHP'};
  if(data.setup.billingMode==='FREE'){data.categories.forEach(c=>c.registrationFee=0);try{const tid=window.RADIUM_CLOUD?.getId?.();if(tid&&window.RADIUM_DB){const u=await window.RADIUM_DB.update('category_registrations',{fee_amount:0},{tournament_id:tid});if(u.error)throw u.error;}}catch(e){data.setup=setupBeforeSave;renderAll?.();return alert('Could not update registration fees for this FREE tournament. '+(e?.message||e));}}
  const saveButton=$('saveSetup');
  if(saveButton)saveButton.disabled=true;
  const st=$('saveState');
  if(st)st.textContent='SAVING TO SUPABASE...';
  try{
    const cloud=window.RADIUM_CLOUD;
    if(!cloud?.getId?.())throw new Error('No active tournament selected.');
    const saved=await (cloud.saveNow?cloud.saveNow(JSON.parse(JSON.stringify(data))):cloud.push?.(JSON.parse(JSON.stringify(data))));
    if(!saved)throw cloud.state?.lastError||new Error('Supabase did not confirm the tournament save.');
    log('SETUP SAVED',data.setup.name+' • '+data.setup.billingMode);
    if(st)st.textContent='SAVED TO SUPABASE '+new Date().toLocaleTimeString();
    toast(data.setup.billingMode==='FREE'?'Free tournament setup saved':'Tournament setup saved');
    syncBillingUI();
    window.renderAll?.();
  }catch(e){
    data.setup=setupBeforeSave;
    renderAll?.();
    if(st)st.textContent='SAVE FAILED';
    alert('Tournament setup was not saved to Supabase. '+(e?.message||e));
  }finally{if(saveButton)saveButton.disabled=false}
};
$('backupBtn').onclick=()=>download('RADIUM_Export_'+data.setup.date+'.json',JSON.stringify(data,null,2),'application/json');
function renderTeamSelect(){const s=$('pTeam');s.innerHTML='<option value="">Unassigned</option>'+data.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}
function clearPlayer(){['playerId','pId','pName','pNick','pSeed','pAge','pWeight','pCoach','pPhoto'].forEach(id=>$(id).value='');$('pSex').value='Male';$('pTeam').value='';$('pCombat').checked=true;$('pAnyoIndividual').checked=false;$('pAnyoTeam').checked=false;$('pLivestick').checked=false;setAnyoComboChecks('pInd',[]);setAnyoComboChecks('pSync',[]);togglePlayerAnyoWeapon()}$('clearPlayer').onclick=clearPlayer;
$('pAnyoIndividual')?.addEventListener('change',togglePlayerAnyoWeapon);$('pAnyoTeam')?.addEventListener('change',togglePlayerAnyoWeapon);$('pAnyoTraditional')?.addEventListener('change',togglePlayerAnyoWeapon);$('pAnyoNonTraditional')?.addEventListener('change',togglePlayerAnyoWeapon);function togglePlayerAnyoWeapon(){const show=!!($('pAnyoIndividual')?.checked||$('pAnyoTeam')?.checked);if($('playerAnyoEventsField'))$('playerAnyoEventsField').style.display=show?'':'none'}
const ANYO_WEAPON_OPTIONS=[['Traditional','Single','Single Weapon'],['Traditional','Double','Double Weapon'],['Traditional','Espada','Espada y Daga'],['Non-Traditional','Single','Single Weapon'],['Non-Traditional','Double','Double Weapon'],['Non-Traditional','Espada','Espada y Daga']];
function selectedAnyoCombos(prefix){return ANYO_WEAPON_OPTIONS.map(([style,key,weapon])=>{const el=$(prefix+style.replace('-','')+key);return el?.checked?`${style}|${weapon}`:null}).filter(Boolean)}
function setAnyoComboChecks(prefix,arr){const set=new Set(Array.isArray(arr)?arr:[]);ANYO_WEAPON_OPTIONS.forEach(([style,key,weapon])=>{const el=$(prefix+style.replace('-','')+key);if(el)el.checked=set.has(`${style}|${weapon}`)})}
function combosToStyleWeapons(combos){const out={Traditional:[],'Non-Traditional':[]};(combos||[]).forEach(x=>{const [style,weapon]=String(x).split('|');if(out[style]&&weapon)out[style].push(weapon)});return out}
function legacyStyleCombos(e){const out=[];for(const style of ['Traditional','Non-Traditional']){const key=style==='Traditional'?'anyoTraditionalWeapons':'anyoNonTraditionalWeapons';for(const w of (Array.isArray(e?.[key])?e[key]:[]))out.push(`${style}|${w}`)}return out}
$('savePlayer').onclick=()=>{if(data.locked)return alert('Tournament is locked. Unlock with official PIN.');const name=$('pName').value.trim();if(!name)return alert('Full name is required');const playerAge=Math.floor(Number($('pAge').value));if(!Number.isFinite(playerAge)||playerAge<1||playerAge>100)return alert('Enter a valid player age.');const indCombos=selectedAnyoCombos('pInd'),syncCombos=selectedAnyoCombos('pSync');const anyoI=indCombos.length>0||!!$('pAnyoIndividual')?.checked,anyoS=syncCombos.length>0||!!$('pAnyoTeam')?.checked;if((anyoI||anyoS)&&!indCombos.length&&!syncCombos.length)return alert('Select at least one Anyo style and weapon combination.');let id=$('playerId').value||uid();let existing=player(id);const displayId=$('pId').value.trim()||id.slice(0,6).toUpperCase();const duplicate=data.players.find(p=>p.number===displayId&&p.id!==id);if(duplicate)return alert('Player ID already exists. Use a unique Player ID.');const allCombos=[...new Set([...indCombos,...syncCombos])],sw=combosToStyleWeapons(allCombos);const p={id,number:displayId,seed:Number($('pSeed').value)||null,name,nick:$('pNick').value.trim(),sex:$('pSex').value,age:playerAge,birth:'',weight:Number($('pWeight').value)||0,teamId:$('pTeam').value,coach:$('pCoach').value.trim(),photo:$('pPhoto').value.trim(),events:{combat:$('pCombat')?.checked||false,anyoIndividual:anyoI,anyoTeam:anyoS,livestick:$('pLivestick')?.checked||false,anyoTraditional:sw.Traditional.length>0,anyoNonTraditional:sw['Non-Traditional'].length>0,anyoTraditionalWeapons:sw.Traditional,anyoNonTraditionalWeapons:sw['Non-Traditional'],anyoIndividualEvents:indCombos,anyoSynchronizedEvents:syncCombos,anyoWeapons:allCombos[0]?.split('|')[1]||''}};if(existing)Object.assign(existing,p);else data.players.push(p);log(existing?'PLAYER UPDATED':'PLAYER REGISTERED',name);clearPlayer();renderAll();toast('Player saved')};
$('samplePlayers').onclick=()=>{if(data.teams.length===0){data.teams.push({id:uid(),name:'RADIUM CCIS',coach:'Coach RADIUM'});data.teams.push({id:uid(),name:'SAMPLE CLUB',coach:'Coach Sample'})}const names=['Juan Dela Cruz','Pedro Santos','Carlo Reyes','Mark Garcia','Luis Cruz','Angelo Ramos','Miguel Flores','Jose Mendoza'];names.forEach((n,i)=>data.players.push({id:uid(),number:'S'+(i+1),name:n,nick:'',sex:i%2?'Female':'Male',age:16-(i%4),birth:'',weight:40+i,teamId:data.teams[i%data.teams.length].id,coach:'',photo:'',events:{combat:true,anyoIndividual:true,anyoTeam:true,livestick:true,anyoTraditional:true,anyoNonTraditional:true,anyoTraditionalWeapons:['Single Weapon','Double Weapon','Espada y Daga'],anyoNonTraditionalWeapons:['Single Weapon','Double Weapon','Espada y Daga'],anyoIndividualEvents:['Traditional|Single Weapon','Traditional|Double Weapon','Traditional|Espada y Daga','Non-Traditional|Single Weapon','Non-Traditional|Double Weapon','Non-Traditional|Espada y Daga'],anyoSynchronizedEvents:['Traditional|Single Weapon','Traditional|Double Weapon','Traditional|Espada y Daga','Non-Traditional|Single Weapon','Non-Traditional|Double Weapon','Non-Traditional|Espada y Daga'],anyoWeapons:'Single Weapon'}}));save();renderAll();toast('Sample players added')};
$('samplePlayers').onclick=()=>{if(data.teams.length===0){data.teams.push({id:uid(),name:'RADIUM CCIS',coach:'Coach RADIUM'});data.teams.push({id:uid(),name:'SAMPLE CLUB',coach:'Coach Sample'})}const names=['Juan Dela Cruz','Pedro Santos','Carlo Reyes','Mark Garcia','Luis Cruz','Angelo Ramos','Miguel Flores','Jose Mendoza'];names.forEach((n,i)=>data.players.push({id:uid(),number:'S'+(i+1),name:n,nick:'',sex:i%2?'Female':'Male',age:16-(i%4),birth:'',weight:40+i,teamId:data.teams[i%data.teams.length].id,coach:'',photo:'',events:{combat:true,anyoIndividual:false,anyoTeam:false,livestick:false,anyoWeapons:'Single Weapon'}}));save();renderAll();toast('Sample players added')};
$('playerSearch').oninput=renderPlayers;
async function renderPlayers(){
  const q=($('playerSearch')?.value||'').toLowerCase();
  const role=String(window.RADIUM_AUTH?.role||'').toUpperCase();
  const readOnly=['TABLE_OFFICIAL','ACCOUNTANT'].includes(role);
  const tid=window.RADIUM_CLOUD?.getId?.()||'';
  let regs=[],attendance=[],anyoEntriesDb=[],anyoMembersDb=[];
  if(tid&&window.RADIUM_DB){
    try{
      const [rr,aa,ae,am]=await Promise.all([
        window.RADIUM_DB.select('category_registrations',{select:'id,player_id,category_id,anyo_entry_id,status,team_id',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('team_participations',{select:'team_id,status',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('anyo_entries',{select:'id,category_id,entry_type,entry_number,style,weapon,status',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('anyo_entry_members',{select:'entry_id,player_id,member_position',eq:{tournament_id:tid}})
      ]);
      regs=rr.data||[]; attendance=aa.data||[]; anyoEntriesDb=ae.data||[]; anyoMembersDb=am.data||[];
    }catch(e){console.warn('Player status read failed:',e)}
  }
  const attMap=new Map(attendance.map(x=>[String(x.team_id),String(x.status||'EXPECTED')]));
  const byPlayer=new Map();
  regs.forEach(r=>{if(!r.player_id)return;const k=String(r.player_id);if(!byPlayer.has(k))byPlayer.set(k,[]);byPlayer.get(k).push(r)});

  // ANYO registrations are entry-based: category_registrations may have
  // player_id=NULL and instead point to anyo_entry_id. Resolve the entry
  // members back to each performer so Player List does not falsely show
  // "NO REGISTRATION RECORD" for Elementary/Secondary ANYO players.
  const anyoEntryMap=new Map(anyoEntriesDb.map(e=>[String(e.id),e]));
  const anyoCategoryRegMap=new Map();
  regs.forEach(r=>{if(r.anyo_entry_id)anyoCategoryRegMap.set(String(r.anyo_entry_id),r)});
  anyoMembersDb.forEach(m=>{
    const entry=anyoEntryMap.get(String(m.entry_id));
    if(!entry||!m.player_id)return;
    const k=String(m.player_id);
    if(!byPlayer.has(k))byPlayer.set(k,[]);
    const cr=anyoCategoryRegMap.get(String(m.entry_id));
    byPlayer.get(k).push({
      id:cr?.id||('anyo-'+entry.id+'-'+m.player_id),
      player_id:m.player_id,
      category_id:entry.category_id,
      anyo_entry_id:entry.id,
      status:String(cr?.status||entry.status||'ACTIVE').toUpperCase(),
      _anyoEntry:true,
      _anyoType:entry.entry_type,
      _anyoNumber:entry.entry_number,
      _anyoStyle:entry.style,
      _anyoWeapon:entry.weapon
    });
  });
  const statusBadge=st=>`<span class="mode-badge status-${String(st||'ACTIVE').toLowerCase().replace(/_/g,'-')}">${esc(st||'ACTIVE')}</span>`;
  const rows=data.players.filter(p=>{const t=team(p.teamId)?.name||'';return [p.id,p.number,p.name,t].join(' ').toLowerCase().includes(q)}).map(p=>{
    const rs=byPlayer.get(String(p.id))||[];
    const statusHtml=rs.length?rs.map(r=>{const c=cat(r.categoryId);const label=r._anyoEntry?`${c?.name||'ANYO'}${r._anyoType?' • '+r._anyoType:''}${r._anyoStyle?' • '+r._anyoStyle:''}${r._anyoWeapon?' • '+r._anyoWeapon:''}`:(c?.name||'Registration');return `<div>${statusBadge(r.status)} <small>${esc(label)}</small></div>`}).join(''):'<span class="muted">NO REGISTRATION RECORD</span>';
    const cs=data.categories.filter(c=>eligible(p,c)).map(c=>c.name).join(', ')||'—';
    const att=attMap.get(String(p.teamId))||'EXPECTED';
    const action=readOnly?'<span class="muted">VIEW ONLY</span>':`<button class="btn small" onclick="editPlayer('${p.id}')">EDIT</button> <button class="btn small danger" onclick="deletePlayer('${p.id}')">DELETE</button>`;
    return `<tr><td>${esc(p.number)}</td><td><b>${esc(p.name)}</b>${p.nick?'<br><small>'+esc(p.nick)+'</small>':''}</td><td>${esc(p.sex)}</td><td>${age(p.age ?? p.birth)}</td><td>${Number.isFinite(Number(p.weight))?Number(p.weight).toFixed(1)+' kg':'—'}</td><td>${esc(team(p.teamId)?.name||'—')}<br>${statusBadge(att)}</td><td>${statusHtml}</td><td>${esc(cs)}</td><td>${action}</td></tr>`;
  }).join('');
  $('playersTable').innerHTML=rows||'<tr><td colspan="9" class="empty">No players.</td></tr>';
}

window.editPlayer=id=>{if(['TABLE_OFFICIAL','ACCOUNTANT'].includes(String(window.RADIUM_AUTH?.role||'').toUpperCase()))return alert('This staff role has view-only player access.');const p=player(id);if(!p)return;$('playerId').value=p.id;$('pId').value=p.number;$('pName').value=p.name;$('pNick').value=p.nick;$('pSeed').value=p.seed||'';$('pSex').value=p.sex;$('pAge').value=age(p.age ?? p.birth);$('pWeight').value=p.weight;$('pTeam').value=p.teamId;$('pCoach').value=p.coach;$('pPhoto').value=p.photo; if($('pCombat'))$('pCombat').checked=!!p.events?.combat; if($('pAnyoIndividual'))$('pAnyoIndividual').checked=!!p.events?.anyoIndividual; if($('pAnyoTeam'))$('pAnyoTeam').checked=!!p.events?.anyoTeam; if($('pLivestick'))$('pLivestick').checked=!!p.events?.livestick; if($('pAnyoTraditional'))$('pAnyoTraditional').checked=Array.isArray(p.events?.anyoTraditionalWeapons)?p.events.anyoTraditionalWeapons.length>0:!!p.events?.anyoTraditional; if($('pAnyoNonTraditional'))$('pAnyoNonTraditional').checked=Array.isArray(p.events?.anyoNonTraditionalWeapons)?p.events.anyoNonTraditionalWeapons.length>0:!!p.events?.anyoNonTraditional; setAnyoComboChecks('pInd',p.events?.anyoIndividualEvents||legacyStyleCombos(p.events).filter(x=>p.events?.anyoIndividual));setAnyoComboChecks('pSync',p.events?.anyoSynchronizedEvents||legacyStyleCombos(p.events).filter(x=>p.events?.anyoTeam));togglePlayerAnyoWeapon();showPage('playersPage')};window.deletePlayer=id=>{if(['TABLE_OFFICIAL','ACCOUNTANT'].includes(String(window.RADIUM_AUTH?.role||'').toUpperCase()))return alert('This staff role has view-only player access.');if(data.locked)return alert('Unlock first');if(confirm('Delete player?')){data.players=data.players.filter(p=>p.id!==id);log('PLAYER DELETED',id);save();renderAll()}};
function anyoCategoryEntries(){return data.categories.filter(c=>isAnyoEvent(c)&&['Synchronized','Mixed'].includes(c.anyoType))}
function renderAnyoEntryForm(){const cs=radiumSortedCategories(anyoCategoryEntries());const sel=$('anyoEntryCategory');if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">SELECT GROUP ANYO CATEGORY</option>'+cs.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} • ${esc(c.anyoType)} • ${esc(c.anyoStyle)} • ${esc(c.anyoWeapon)}</option>`).join('');if(cs.some(c=>c.id===current))sel.value=current;else if(cs[0])sel.value=cs[0].id;const c=cat(sel.value);const isMixed=c?.anyoType==='Mixed';$('anyoEntryMember3Field').style.display=isMixed?'none':'';['anyoEntryMember1','anyoEntryMember2','anyoEntryMember3'].forEach((id,i)=>{const el=$(id);if(!el)return;const prev=el.value;el.innerHTML='<option value="">SELECT PLAYER</option>'+data.players.filter(p=>{if(!c)return true;if(!p.events?.anyoTeam)return false;const style=c.anyoStyle||'Traditional',weapons=anyoStyleWeapons(p.events,style,'Synchronized');return (c.sex==='Mixed'||p.sex===c.sex)&&weapons.includes(c.anyoWeapon)}).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} • ${sexLabel(p.sex)} • ${esc(team(p.teamId)?.name||'No Team')}</option>`).join('');if([...el.options].some(o=>o.value===prev))el.value=prev;});renderAnyoEntriesTable()}
function renderAnyoEntriesTable(){const host=$('anyoEntriesTable');if(!host)return;const rows=(data.anyoEntries||[]).filter(e=>['Synchronized','Mixed'].includes(e.type)).map(e=>{const c=cat(e.categoryId);const members=(e.memberIds||[]).map(id=>player(id)?.name||id).join(' + ');return `<tr><td class="anyo-entry-id">${esc(e.number||e.id)}</td><td class="anyo-entry-type">${esc(e.type)}</td><td>${esc(c?.name||e.categoryId)}</td><td>${esc(e.style)}</td><td>${esc(e.weapon)}</td><td>${esc(e.groupReference||'—')}</td><td class="anyo-entry-members">${esc(members)}</td><td><button class="btn small danger" onclick="deleteAnyoEntry('${esc(e.id)}')">DELETE</button></td></tr>`}).join('');host.innerHTML=rows||'<tr><td colspan="8" class="empty">No Synchronized/Mixed entries registered.</td></tr>'}
$('anyoEntryCategory')?.addEventListener('change',renderAnyoEntryForm);$('anyoEntryMember1')?.addEventListener('change',()=>{});$('anyoEntryMember2')?.addEventListener('change',()=>{});$('anyoEntryMember3')?.addEventListener('change',()=>{});
$('clearAnyoEntry')?.addEventListener('click',()=>{['anyoEntryMember1','anyoEntryMember2','anyoEntryMember3'].forEach(id=>{if($(id))$(id).value=''});renderAnyoEntryForm()});
$('saveAnyoEntry')?.addEventListener('click',()=>{if(data.locked)return alert('Tournament is locked. Unlock with official PIN.');const c=cat($('anyoEntryCategory')?.value);if(!c)return alert('Select a Synchronized or Mixed Anyo category.');const ids=[$('anyoEntryMember1')?.value,$('anyoEntryMember2')?.value,$('anyoEntryMember3')?.value].filter(Boolean);const unique=[...new Set(ids)];const needed=c.anyoType==='Mixed'?2:2;if(ids.length!==needed&&c.anyoType==='Mixed')return alert('Mixed Anyo requires exactly 2 players: 1 male and 1 female.');if((c.anyoType==='Synchronized')&&(ids.length<2||ids.length>3))return alert('Synchronized Anyo requires 2 or 3 players.');if(unique.length!==ids.length)return alert('A player cannot be registered twice in the same Anyo entry.');const ps=ids.map(id=>player(id)).filter(Boolean);if(ps.length!==ids.length)return alert('One or more selected players could not be found.');if(c.anyoType==='Mixed'&&!(ps.some(p=>p.sex==='Male')&&ps.some(p=>p.sex==='Female')))return alert('Mixed Anyo requires exactly one male and one female.');if(c.anyoType==='Synchronized'&&c.sex!=='Mixed'&&!ps.every(p=>p.sex===c.sex))return alert('All Synchronized Anyo members must match the category division.');for(const p of ps){if(!p.events?.anyoTeam)return alert(`${p.name} is not registered for Synchronized Anyo. Edit the player first.`);const weapons=anyoStyleWeapons(p.events,c.anyoStyle||'Traditional','Synchronized');if(!weapons.includes(c.anyoWeapon))return alert(`${p.name} is not registered for ${c.anyoStyle} • ${c.anyoWeapon}.`);if(age(p.age??p.birth)<Number(c.ageFrom)||age(p.age??p.birth)>Number(c.ageTo))return alert(`${p.name} is outside the category age range.`);}const id=uid();const prefix=c.anyoType==='Mixed'?'MA':'SA';const number=prefix+'-'+String((data.anyoEntries||[]).filter(e=>e.categoryId===c.id).length+1).padStart(3,'0');data.anyoEntries.push({id,number,type:c.anyoType,categoryId:c.id,style:c.anyoStyle,weapon:c.anyoWeapon,memberIds:ids,groupReference:'',status:'active'});log('ANYO ENTRY REGISTERED',`${number} • ${c.name}`);renderAll();toast(`${c.anyoType} Anyo entry registered.`)});
window.deleteAnyoEntry=id=>{if(data.locked)return alert('Unlock first');const e=(data.anyoEntries||[]).find(x=>x.id===id);if(!e)return;if(confirm('Delete this Anyo entry?')){data.anyoEntries=data.anyoEntries.filter(x=>x.id!==id);data.anyoResults=(data.anyoResults||[]).filter(r=>r.entryId!==id);log('ANYO ENTRY DELETED',e.number||id);renderAll()}};
$('saveTeam').onclick=()=>{if(data.locked)return alert('Unlock first');const name=$('teamName').value.trim();if(!name)return alert('Team name required');data.teams.push({id:uid(),name,coach:$('teamCoach').value.trim()});$('teamName').value='';$('teamCoach').value='';log('TEAM CREATED',name);save();renderAll();toast('Team saved')};
function medalCounts(tid){return data.medals.filter(m=>m.teamId===tid).reduce((a,r)=>{if(r.medal)a[r.medal]++;return a},{gold:0,silver:0,bronze:0})}
function renderTeams(){const rows=data.teams.map(t=>{const m=medalCounts(t.id),pts=m.gold*data.setup.gold+m.silver*data.setup.silver+m.bronze*data.setup.bronze,n=data.players.filter(p=>p.teamId===t.id).length;return `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.coach)}</td><td>${n}</td><td>${m.gold}</td><td>${m.silver}</td><td>${m.bronze}</td><td>${pts}</td><td><button class="btn small danger" onclick="deleteTeam('${t.id}')">DELETE</button></td></tr>`}).join('');$('teamsTable').innerHTML=rows||'<tr><td colspan="8" class="empty">No teams.</td></tr>'}window.deleteTeam=id=>{if(data.locked)return alert('Unlock first');if(data.players.some(p=>p.teamId===id))return alert('Cannot delete a team with players. Reassign players first.');if(confirm('Delete team?')){data.teams=data.teams.filter(t=>t.id!==id);save();renderAll()}};
function syncCategoryFields(){const ev=$('catEvent')?.value;const anyo=ev==='Arnis Anyo';const deped=String(data.setup?.competitionProgram||'').toUpperCase()==='DEPED_PEKAF';if(ev!=='Arnis Anyo'&&deped&&$('catWeightRequirement')){$('catWeightRequirement').value='required';$('catWeightRequirement').disabled=true;}else if($('catWeightRequirement'))$('catWeightRequirement').disabled=false;const live=ev==='Livestick';['anyoDivisionField','anyoStyleField','anyoWeaponField'].forEach(id=>{const el=$(id);if(el)el.style.display=anyo?'':'none'});['weightFromField','weightToField'].forEach(id=>{const el=$(id);if(el)el.style.display=anyo?'none':''});if($('drawField'))$('drawField').style.display=anyo?'none':'';const type=$('catAnyoType')?.value||'Individual';if($('catSex')){const mix=$('catSex').querySelector('option[value="Mixed"]');if(mix)mix.disabled=anyo&&type!=='Mixed';if(anyo&&type==='Mixed')$('catSex').value='Mixed';else if(anyo&&$('catSex').value==='Mixed')$('catSex').value='Male';}if($('anyoCategoryHelp'))$('anyoCategoryHelp').textContent=anyo?'Anyo: Individual, Synchronized (2–3), or Mixed (1 male + 1 female) × Traditional/Non-Traditional × Weapon.':live?'Livestick: Boys/Girls divisions with age and weight ranges.':'Combative: Boys/Girls/Mixed divisions with age and weight ranges.'}
function saveCategory(){if(data.locked)return alert('Unlock first');const n=$('catName').value.trim(),af=Number($('catAgeFrom').value),at=Number($('catAgeTo').value),wf=Number($('catWeightFrom').value)||0,wt=Number($('catWeightTo').value)||999;if(!n||!Number.isFinite(af)||!Number.isFinite(at)||af>at)return alert('Complete valid age ranges');const ev=$('catEvent').value;const type=ev==='Arnis Anyo'?$('catAnyoType').value:'';const deped=String(data.setup?.competitionProgram||'').toUpperCase()==='DEPED_PEKAF';if(ev!=='Arnis Anyo'&&(!Number.isFinite(wf)||!Number.isFinite(wt)||wf>wt))return alert('Complete a valid weight range');if(ev!=='Arnis Anyo'&&deped&&(!Number.isFinite(wf)||!Number.isFinite(wt)||wf>=wt))return alert('DepEd–PEKAF Combative categories require a valid weight range.');if(ev==='Arnis Anyo'&&type==='Mixed'&&$('catSex').value!=='Mixed')return alert('Mixed Anyo category must use Mixed division.');if(ev==='Arnis Anyo'&&type==='Synchronized'&&$('catSex').value==='Mixed')return alert('Synchronized Anyo category must use Boys or Girls division.');const id=$('catId').value||uid(),x={id,name:n,sex:$('catSex').value,event:ev,anyoType:type,anyoStyle:ev==='Arnis Anyo'?$('catAnyoStyle').value:'',anyoWeapon:ev==='Arnis Anyo'?$('catAnyoWeapon').value:'Any',ageFrom:af,ageTo:at,weightFrom:wf,weightTo:wt,weightRequirement:ev!=='Arnis Anyo'&&deped?'required':($('catWeightRequirement')?.value||'not_required'),bracketBy:ev!=='Arnis Anyo'&&deped?'weight':null,registrationFee:isFreeTournament()?0:Math.max(0,Number($('catRegistrationFee')?.value)||0),draw:ev==='Arnis Anyo'?'random':$('catDraw').value,bracket:cat(id)?.bracket||null};const old=cat(id);if(old)Object.assign(old,x);else data.categories.push(x);data.activeCategory=id;log(old?'CATEGORY UPDATED':'CATEGORY CREATED',n);clearCategory();renderAll();toast('Category saved')}$('saveCategory').onclick=saveCategory;$('catEvent').onchange=syncCategoryFields;$('catAnyoType').onchange=syncCategoryFields;$('catSex').onchange=syncCategoryFields;$('catDraw').onchange=()=>{const v=$('catDraw').value;$('drawHelp').textContent=v==='seed'?'Uses the Seed field to place higher seeds first.':v==='team'?'Spreads players by team to reduce same-team Round 1 matches.':'Randomly places eligible players.'};$('clearCategory').onclick=clearCategory;function clearCategory(){['catId','catName','catAgeFrom','catAgeTo','catWeightFrom','catWeightTo'].forEach(id=>$(id).value='');$('catSex').value='Male';$('catEvent').value='Padded Stick';$('catAnyoType').value='Individual';$('catAnyoStyle').value='Traditional';$('catAnyoWeapon').value='Any';$('catDraw').value='random';if($('catRegistrationFee'))$('catRegistrationFee').value=isFreeTournament()?0:400;if($('catWeightRequirement'))$('catWeightRequirement').value='not_required';syncCategoryFields()}const DEPED_PEKAF_COMBATIVES_12_17={Male:[{name:'Pinweight',from:43,to:47},{name:'Bantamweight',from:47.01,to:51},{name:'Featherweight',from:51.01,to:55},{name:'Extra Lightweight',from:55.01,to:60},{name:'Half Lightweight',from:60.01,to:65}],Female:[{name:'Pinweight',from:37,to:40},{name:'Bantamweight',from:40.01,to:44},{name:'Featherweight',from:44.01,to:48},{name:'Extra Lightweight',from:48.01,to:52},{name:'Half Lightweight',from:52.01,to:56}]};
function addDepEdPEKAFCombativesPreset(){if(data.locked)return alert('Unlock first');const added=[];for(const sex of ['Male','Female'])for(const w of DEPED_PEKAF_COMBATIVES_12_17[sex]){const ageFrom=12,ageTo=17,eventName='Padded Stick';const name=`${sexLabel(sex)} ${ageFrom}–${ageTo} • ${w.name} • DepEd–PEKAF Combatives`;const existing=data.categories.find(c=>c.event===eventName&&c.preset==='DEPED-PEKAF-COMBATIVES-12-17'&&c.sex===sex&&c.weightFrom===w.from&&c.weightTo===w.to);if(existing){existing.ageFrom=ageFrom;existing.ageTo=ageTo;existing.weightRequirement='required';existing.bracketBy='weight';existing.draw='seed';existing.weightClass=w.name;continue;}data.categories.push({id:uid(),name,sex,event:eventName,anyoType:'',anyoStyle:'',anyoWeapon:'Any',ageFrom,ageTo,weightFrom:w.from,weightTo:w.to,draw:'seed',bracket:null,preset:'DEPED-PEKAF-COMBATIVES-12-17',weightClass:w.name,weightRequirement:'required',bracketBy:'weight'});added.push(name)}save();renderAll();toast(added.length?`${added.length} DepEd–PEKAF Combatives categories added with automatic seeded draw.`:'DepEd–PEKAF Combatives categories are already present; automatic seeded draw is enabled.')}
const DEPED_PEKAF_ANYO_ELEMENTARY=[
  ['Male','Individual','Non-Traditional','Single Weapon'],['Male','Individual','Non-Traditional','Double Weapon'],['Male','Individual','Non-Traditional','Espada y Daga'],
  ['Female','Individual','Non-Traditional','Single Weapon'],['Female','Individual','Non-Traditional','Double Weapon'],['Female','Individual','Non-Traditional','Espada y Daga'],
  ['Male','Synchronized','Non-Traditional','Single Weapon'],['Male','Synchronized','Non-Traditional','Double Weapon'],['Male','Synchronized','Non-Traditional','Espada y Daga'],
  ['Female','Synchronized','Non-Traditional','Single Weapon'],['Female','Synchronized','Non-Traditional','Double Weapon'],['Female','Synchronized','Non-Traditional','Espada y Daga'],
  ['Mixed','Mixed','Non-Traditional','Double Weapon']
];
const DEPED_PEKAF_ANYO_SECONDARY=[
  ['Male','Individual','Non-Traditional','Single Weapon'],['Male','Individual','Non-Traditional','Double Weapon'],['Male','Individual','Non-Traditional','Espada y Daga'],
  ['Female','Individual','Non-Traditional','Single Weapon'],['Female','Individual','Non-Traditional','Double Weapon'],['Female','Individual','Non-Traditional','Espada y Daga'],
  ['Male','Synchronized','Non-Traditional','Single Weapon'],['Male','Synchronized','Non-Traditional','Double Weapon'],['Male','Synchronized','Non-Traditional','Espada y Daga'],
  ['Female','Synchronized','Non-Traditional','Single Weapon'],['Female','Synchronized','Non-Traditional','Double Weapon'],['Female','Synchronized','Non-Traditional','Espada y Daga']
];
function addDepEdPEKAFAnyoPreset(level){if(data.locked)return alert('Unlock first');const source=level==='Elementary'?DEPED_PEKAF_ANYO_ELEMENTARY:DEPED_PEKAF_ANYO_SECONDARY;const preset=level==='Elementary'?'DEPED-PEKAF-ANYO-ELEMENTARY':'DEPED-PEKAF-ANYO-SECONDARY';let added=0;for(const [sex,division,style,weapon] of source){const name=`${level} • ${sexLabel(sex)} • ${division==='Mixed'?'Synchronized Mixed':division} Likha Anyo • ${style} • ${weapon}`;if(data.categories.some(c=>c.event==='Arnis Anyo'&&c.preset===preset&&c.sex===sex&&c.anyoType===division&&c.anyoStyle===style&&c.anyoWeapon===weapon))continue;data.categories.push({id:uid(),name,sex,event:'Arnis Anyo',anyoType:division,anyoStyle:style,anyoWeapon:weapon,ageFrom:1,ageTo:99,weightFrom:0,weightTo:999,weightRequirement:'not_required',draw:'random',bracket:null,preset});added++}save();renderAll();toast(added?`${added} DepEd–PEKAF ${level} Anyo categories added.`:`DepEd–PEKAF ${level} Anyo categories are already present.`)}
const depedCombativesPresetBtn=$('depedCombativesPreset');if(depedCombativesPresetBtn){depedCombativesPresetBtn.type='button';depedCombativesPresetBtn.onclick=e=>{e.preventDefault();e.stopPropagation();addDepEdPEKAFCombativesPreset()}}
const depedAnyoElementaryPresetBtn=$('depedAnyoElementaryPreset');if(depedAnyoElementaryPresetBtn){depedAnyoElementaryPresetBtn.type='button';depedAnyoElementaryPresetBtn.onclick=e=>{e.preventDefault();e.stopPropagation();addDepEdPEKAFAnyoPreset('Elementary')}}
const depedAnyoSecondaryPresetBtn=$('depedAnyoSecondaryPreset');if(depedAnyoSecondaryPresetBtn){depedAnyoSecondaryPresetBtn.type='button';depedAnyoSecondaryPresetBtn.onclick=e=>{e.preventDefault();e.stopPropagation();addDepEdPEKAFAnyoPreset('Secondary')}}
function renderCategories(){
  const groups=[['Combative / Padded Stick',data.categories.filter(c=>c.event==='Padded Stick')],['Livestick',data.categories.filter(c=>c.event==='Livestick')],['Anyo — Traditional',data.categories.filter(c=>c.event==='Arnis Anyo'&&(c.anyoStyle||'Traditional')==='Traditional')],['Anyo — Non-Traditional',data.categories.filter(c=>c.event==='Arnis Anyo'&&c.anyoStyle==='Non-Traditional')]];
  $('categoriesList').innerHTML=groups.map(([title,items])=>`<div class="category-group"><div class="category-group-title"><h3>${esc(title)}</h3><span class="badge">${items.length} categories</span></div>${(window.RADIUM_SORT_CATEGORIES?window.RADIUM_SORT_CATEGORIES(items):items).map(c=>`<div class="category-row"><div><b>${esc(c.name)}</b><div class="muted">${sexLabel(c.sex)} • ${c.event}${c.event==='Arnis Anyo'&&c.anyoType?' • '+c.anyoType:''}${c.event==='Arnis Anyo'&&c.anyoStyle?' • '+c.anyoStyle:''}${c.anyoWeapon&&c.anyoWeapon!=='Any'?' • '+c.anyoWeapon:''} • ${c.ageFrom}-${c.ageTo} yrs • ${c.event==='Arnis Anyo'?'No weight limit':c.weightFrom+'-'+c.weightTo+' kg'} • ${isAnyoEvent(c)&&c.anyoType!=='Individual'?(data.anyoEntries||[]).filter(e=>e.categoryId===c.id&&e.status!=='deleted').length:data.players.filter(p=>eligible(p,c)).length} eligible • ${c.bracket?.locked?'BRACKET LOCKED':''}</div></div><div><button class="btn small" onclick="editCategory('${c.id}')">EDIT</button> <button class="btn small" onclick="openCategory('${c.id}')">OPEN</button> <button class="btn small danger" onclick="deleteCategory('${c.id}')">DELETE</button></div></div>`).join('')||'<div class="empty">No categories in this group.</div>'}</div>`).join('');
}
window.editCategory=id=>{if(data.locked)return alert('Tournament is active and locked. Categories can no longer be edited.');const c=cat(id);$('catId').value=id;$('catName').value=c.name;$('catSex').value=c.sex;$('catEvent').value=c.event;$('catAnyoType').value=c.anyoType||'Individual';$('catAnyoStyle').value=c.anyoStyle||'Traditional';$('catAnyoWeapon').value=c.anyoWeapon||'Any';$('catAgeFrom').value=c.ageFrom;$('catAgeTo').value=c.ageTo;$('catWeightFrom').value=c.weightFrom;$('catWeightTo').value=c.weightTo;if($('catRegistrationFee'))$('catRegistrationFee').value=isFreeTournament()?0:(c.registrationFee??400);syncBillingUI();if($('catWeightRequirement'))$('catWeightRequirement').value=c.weightRequirement||'not_required';$('catDraw').value=c.draw;showPage('categoriesPage')};window.openCategory=id=>{const c=cat(id);if(!c)return alert('Category not found.');data.activeCategory=id;save();if(isAnyoEvent(c)){openAnyoCategoryDetail(id)}else{showPage('bracketPage')}};window.deleteCategory=id=>{if(data.locked)return alert('Unlock first');if(confirm('Delete category and its bracket?')){data.categories=data.categories.filter(c=>c.id!==id);if(data.activeCategory===id)data.activeCategory=null;save();renderAll()}};

let matchFlowDraft=null;
function updateMatchFlowBadge(){
  const sel=$('matchFlowSelect'),badge=$('matchFlowBadge'); if(!sel)return;
  const labels={ROUND_CATEGORY:'ROUND BY ROUND',ROUND_BOYS_FIRST:'ROUND + BOYS FIRST',ROUND_GIRLS_FIRST:'ROUND + GIRLS FIRST',BOYS_FIRST:'BOYS FIRST',GIRLS_FIRST:'GIRLS FIRST'};
  if(badge)badge.textContent=labels[sel.value]||'ROUND BY ROUND';
}
function renderMatchFlow(){
  const card=$('matchFlowCard'),sel=$('matchFlowSelect');
  if(!card||!sel)return;
  const deped=String(data.setup?.competitionProgram||'').toUpperCase()==='DEPED_PEKAF';
  card.style.display=deped?'':'none';
  if(matchFlowDraft==null)matchFlowDraft=data.setup?.matchFlow||'ROUND_CATEGORY';
  sel.value=matchFlowDraft;
  updateMatchFlowBadge();
}
$('saveMatchFlow')?.addEventListener('click',async()=>{if(!['admin','tournament_manager'].includes(String(window.RADIUM_AUTH?.role||'').toLowerCase()))return alert('Admin or Tournament Manager account required.');const selected=$('matchFlowSelect')?.value||'ROUND_CATEGORY';const tid=activeTournamentId();if(!tid)return alert('No active tournament is selected.');const previous=data.setup?.matchFlow||'ROUND_CATEGORY';const nextSetup={...(data.setup||{}),matchFlow:selected};try{if(!window.RADIUM_DB)throw new Error('Supabase database client is not available.');await window.RADIUM_DB.init();const incoming={version:16,setup:nextSetup,activeCategory:data.activeCategory||null,locked:!!data.locked};const r=await window.RADIUM_DB.rpc('radium_save_tournament',{tid,incoming});if(r.error)throw r.error;const verify=await window.RADIUM_DB.select('tournaments',{select:'id,settings',eq:{id:tid},limit:1});if(verify.error)throw verify.error;const saved=String(verify.data?.[0]?.settings?.setup?.matchFlow||'ROUND_CATEGORY').toUpperCase();if(saved!==String(selected).toUpperCase())throw new Error('Supabase read-back returned '+saved+' instead of '+selected+'.');data.setup.matchFlow=selected;matchFlowDraft=selected;renderMatchFlow();renderQueue();toast('Match flow saved and confirmed by Supabase.');}catch(e){data.setup.matchFlow=previous;console.error('Match flow save failed:',e);alert('Match flow was NOT saved to Supabase. '+(e?.message||e));}});
$('matchFlowSelect')?.addEventListener('change',e=>{matchFlowDraft=e.target.value;updateMatchFlowBadge();});
function renderCategorySelect(){const s=$('bracketCategory');const regs=Array.isArray(data.registrations)?data.registrations:[];s.innerHTML='<option value="">SELECT COMBAT CATEGORY</option>'+radiumSortedCategories(data.categories.filter(c=>!isAnyoEvent(c))).map(c=>{const registered=new Set(regs.filter(r=>String(r.categoryId)===String(c.id)&&!['CANCELLED','DELETED','WITHDRAWN'].includes(String(r.status||'').toUpperCase())).map(r=>String(r.playerId)).filter(Boolean)).size;const verified=data.players.filter(p=>combatWeighInRecord(p,c)).length;const n=registered||verified;return `<option value="${c.id}">${esc(c.name)} — ${n} registered • ${verified} verified</option>`}).join('');if(data.activeCategory&&data.categories.some(c=>c.id===data.activeCategory))s.value=data.activeCategory}
$('bracketCategory').onchange=async e=>{data.activeCategory=e.target.value||null;save();renderBracket();await loadBracketReview(data.activeCategory)};

async function loadBracketReview(categoryId){
  const card=$('bracketReviewCard'),body=$('bracketReviewBody'),summary=$('bracketReviewSummary'),badge=$('bracketReviewBadge');
  if(!card||!body||!summary||!badge)return null;
  if(!categoryId){badge.textContent='SELECT A CATEGORY';summary.innerHTML='';body.innerHTML='<tr><td colspan="5" class="empty">Select a category to review players.</td></tr>';return null;}
  const c=cat(categoryId); if(!c||isAnyoEvent(c)){badge.textContent='NOT A COMBATIVE CATEGORY';body.innerHTML='<tr><td colspan="5" class="empty">Select a Combative category.</td></tr>';return null;}
  try{
    if(!window.RADIUM_DB)throw new Error('Supabase database bridge is unavailable.');
    const init=await window.RADIUM_DB.init(); if(!init?.enabled)throw new Error('The tournament service is not connected.');
    const tid=window.RADIUM_CLOUD?.getId?.(); if(!tid)throw new Error('No tournament is selected.');
    const [reg,pr,wi,cp,tm]=await Promise.all([
      window.RADIUM_DB.select('category_registrations',{select:'player_id,status',eq:{tournament_id:tid,category_id:categoryId}}),
      window.RADIUM_DB.select('players',{select:'id,first_name,middle_name,last_name,gender,age,weight,player_number,team_id,status',eq:{tournament_id:tid}}),
      window.RADIUM_DB.select('weigh_ins',{select:'player_id,weight,verified,verified_at',eq:{tournament_id:tid,category_id:categoryId}}),
      window.RADIUM_DB.select('category_players',{select:'player_id,seed,draw_number,draw_type,drawn_at',eq:{category_id:categoryId}}),
      window.RADIUM_DB.select('teams',{select:'id,name',eq:{tournament_id:tid}})
    ]);
    for(const r of [reg,pr,wi,cp,tm])if(r.error)throw r.error;
    const registeredIds=[...new Set((reg.data||[]).filter(r=>!['CANCELLED','DELETED','WITHDRAWN'].includes(String(r.status||'').toUpperCase())).map(r=>String(r.player_id)).filter(Boolean))];
    const players=new Map((pr.data||[]).map(x=>[String(x.id),x]));
    const weigh=new Map((wi.data||[]).map(x=>[String(x.player_id),x]));
    const seeds=new Map((cp.data||[]).map(x=>[String(x.player_id),x]));
    const teams=new Map((tm.data||[]).map(x=>[String(x.id),x.name||'']));
    const rows=registeredIds.map(pid=>{
      const p=players.get(pid),w=weigh.get(pid),sr=seeds.get(pid);
      const weight=Number(w?.weight),ageNum=Number(p?.age);
      const ageOk=Number.isFinite(ageNum)&&ageNum>=Number(c.ageFrom)&&ageNum<=Number(c.ageTo);
      const genderOk=!c.sex||c.sex==='Mixed'||c.sex===p?.gender;
      const combatOk=eCombat(p||{});
      const weightOk=Number.isFinite(weight)&&weight>=Number(c.weightFrom)&&weight<=Number(c.weightTo);
      const verified=w?.verified===true&&ageOk&&genderOk&&combatOk&&weightOk;
      return {p,w,sr,verified,weight,team:teams.get(String(p?.team_id||''))||'—'};
    });
    const verifiedCount=rows.filter(x=>x.verified).length;
    const seededCount=rows.filter(x=>Number.isFinite(Number(x.sr?.seed))).length;
    badge.textContent=`${registeredIds.length} REGISTERED • ${verifiedCount} VERIFIED`;
    summary.innerHTML=`<span class="review-stat">REGISTERED: ${registeredIds.length}</span><span class="review-stat">VERIFIED: ${verifiedCount}</span><span class="review-stat">SEEDED: ${seededCount}/${registeredIds.length}</span>`;
    const escLocal=v=>esc(String(v??''));
    body.innerHTML=rows.length?rows.map(x=>{
      const name=[x.p?.first_name,x.p?.middle_name,x.p?.last_name].filter(Boolean).join(' ')||x.p?.player_number||'—';
      const seed=Number.isFinite(Number(x.sr?.seed))?Number(x.sr.seed):'—';
      const wiText=x.verified?'✓ VERIFIED':(x.w?.verified===true?'⚠ VERIFIED BUT NOT CATEGORY-ELIGIBLE':'✗ NOT VERIFIED');
      return `<tr><td class="seed-cell">${seed}</td><td><b>${escLocal(name)}</b><div class="muted">${escLocal(x.p?.player_number||'')}</div></td><td>${escLocal(x.team)}</td><td class="weight-cell">${Number.isFinite(x.weight)?escLocal(x.weight.toFixed(2))+' kg':'—'}</td><td class="${x.verified?'verified':'not-verified'}">${wiText}</td></tr>`;
    }).join(''):'<tr><td colspan="5" class="empty">No registered players found for this category.</td></tr>';
    const select=$('bracketCategory'),opt=select?.querySelector(`option[value="${CSS.escape(String(categoryId))}"]`);
    if(opt)opt.textContent=`${c.name} — ${registeredIds.length} registered • ${verifiedCount} verified`;
    return {registered:registeredIds.length,verified:verifiedCount,seeded:seededCount,rows};
  }catch(e){
    console.error('Bracket review load failed:',e);
    badge.textContent='REVIEW ERROR';summary.innerHTML='';body.innerHTML=`<tr><td colspan="5" class="empty">Could not load the player review: ${esc(String(e?.message||e))}</td></tr>`;return null;
  }
}

function createMatch(red=null,blue=null){return{id:uid(),red,blue,redScore:0,blueScore:0,completed:false,winner:null,redBye:false,blueBye:false,court:null,matchFormat:Number(data?.setup?.combativeRounds)===1?'single':'best3',history:[]}}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function playerSeedForCategory(p,c){const cs=p?.categorySeeds?.[c?.id];const n=Number(cs?.seed);return Number.isFinite(n)&&n>0?n:(Number.isFinite(Number(p?.seed))&&Number(p.seed)>0?Number(p.seed):null)}
function standardSeedOrder(size){let seeds=[1];for(let n=2;n<=size;n*=2)seeds=seeds.flatMap(x=>[x,n+1-x]);return seeds}
function seedPlayers(ps,c){let a=[...ps];if(c.draw==='seed'){const size=nextPow(a.length);const autoDepEd=String(c.preset||'').toUpperCase()==='DEPED-PEKAF-COMBATIVES-12-17';if(autoDepEd){a.sort((x,y)=>{const xs=playerSeedForCategory(x,c),ys=playerSeedForCategory(y,c);if(xs&&ys&&xs!==ys)return xs-ys;if(xs&&!ys)return -1;if(!xs&&ys)return 1;return String(x.id).localeCompare(String(y.id));});a.forEach((p,i)=>{p.categorySeeds=p.categorySeeds||{};const current=playerSeedForCategory(p,c);if(!current){p.categorySeeds[c.id]={...(p.categorySeeds[c.id]||{}),seed:i+1,drawNumber:i+1,drawType:'AUTO_SEEDED',drawnAt:new Date().toISOString()};}});const seeded=a.map(p=>({p,seed:playerSeedForCategory(p,c)})).sort((x,y)=>x.seed-y.seed);const bySeed=new Map(seeded.map(x=>[x.seed,x.p]));return standardSeedOrder(size).map(seed=>bySeed.get(seed)||null)}const bySeed=new Map();a.forEach(p=>{const seed=playerSeedForCategory(p,c);if(seed&&seed<=size&&!bySeed.has(seed))bySeed.set(seed,p)});return standardSeedOrder(size).map(seed=>bySeed.get(seed)||null)}if(c.draw==='random')return shuffle(a);if(c.draw==='team'){a.sort((x,y)=>(team(x.teamId)?.name||'').localeCompare(team(y.teamId)?.name||''));let out=[];let teams=[...new Set(a.map(x=>x.teamId))];let k=0;while(a.length){const idx=a.findIndex(p=>p.teamId===teams[k%teams.length]);if(idx>=0)out.push(a.splice(idx,1)[0]);k++}return out}return a}
function byeMatchIndexes(matchCount,byeCount){
  if(!byeCount)return new Set();
  const size=matchCount*2;
  const order=[];let seeds=[1];
  for(let n=2;n<=size;n*=2)seeds=seeds.flatMap(x=>[x,n+1-x]);
  const set=new Set();
  for(let seed=1;seed<=byeCount;seed++){const pos=seeds.indexOf(seed);if(pos>=0)set.add(Math.floor(pos/2));}
  return set;
}
function buildBracket(c){
  const ps=data.players.filter(p=>eligible(p,c));
  if(ps.length<2)throw Error('At least 2 eligible players are required.');
  if(data.setup.type==='roundrobin')return buildRoundRobin(c,ps);
  if(c.draw==='seed' && String(c.preset||'').toUpperCase()!=='DEPED-PEKAF-COMBATIVES-12-17'){
    const seeds=ps.map(p=>playerSeedForCategory(p,c)).filter(Number.isFinite);
    const unique=new Set(seeds);
    if(seeds.length!==ps.length||unique.size!==ps.length||Math.min(...seeds)!==1||Math.max(...seeds)!==ps.length)
      throw Error('Seeded bracket requires every eligible competitor to have a unique seed from 1 to '+ps.length+'. Use Draw Lots or assign category seeds first.');
  }
  const size=nextPow(ps.length),ordered=seedPlayers(ps,c),slots=Array(size).fill(null);
  if(c.draw==='seed'){
    const seedOrder=standardSeedOrder(size),bySeed=new Map(ordered.map(p=>[playerSeedForCategory(p,c),p]));
    seedOrder.forEach((seed,i)=>{slots[i]=bySeed.get(seed)?.id||null;});
  }else ordered.forEach((p,i)=>{if(i<size)slots[i]=p.id;});
  const roundLists=[],byeEntries=[];
  let current=slots.map((playerId,slot)=>({kind:playerId?'player':'bye',playerId:playerId||null,count:playerId?1:0,slot}));
  const first=[];
  for(let i=0;i<current.length;i+=2){
    const left=current[i],right=current[i+1];
    if(!left||(!left.count&&!right?.count))continue;
    if(left.count===1&&right?.count===1){
      const m=createMatch(left.playerId,right.playerId);m.firstRoundPosition=i/2;
      if(!roundLists[0])roundLists[0]=[];roundLists[0].push(m);first.push({kind:'match',matchId:m.id,count:2,playerId:null});
    }else{
      const one=left.count===1?left:right;
      if(one?.playerId){first.push({kind:'player',playerId:one.playerId,count:1});byeEntries.push({playerId:one.playerId,targetMatchId:null,targetSlot:null,firstRoundPosition:i/2});}
    }
  }
  current=first;
  while(current.length>1){
    const parents=[],next=[];
    for(let i=0;i<current.length;i+=2){
      const left=current[i],right=current[i+1];
      if(!left)continue;if(!right){next.push(left);continue;}
      const total=(left.count||0)+(right.count||0);if(total===0)continue;
      if(total===1){next.push(left.count===1?left:right);continue;}
      const m=createMatch(left.kind==='player'?left.playerId:null,right.kind==='player'?right.playerId:null);
      if(left.kind==='match'){const child=findMatch(roundLists,left.matchId);if(child){child.nextMatchId=m.id;child.nextSlot='red';}}
      if(right.kind==='match'){const child=findMatch(roundLists,right.matchId);if(child){child.nextMatchId=m.id;child.nextSlot='blue';}}
      if(left.kind==='player'){const b=byeEntries.find(x=>x.playerId===left.playerId&&!x.targetMatchId);if(b){b.targetMatchId=m.id;b.targetSlot='red';}}
      if(right.kind==='player'){const b=byeEntries.find(x=>x.playerId===right.playerId&&!x.targetMatchId);if(b){b.targetMatchId=m.id;b.targetSlot='blue';}}
      parents.push(m);next.push({kind:'match',matchId:m.id,count:total,playerId:null});
    }
    if(parents.length)roundLists.push(parents);current=next;
  }
  const expected=Math.max(0,ps.length-1),actual=roundLists.reduce((n,r)=>n+r.length,0);
  if(actual!==expected)throw new Error(`Bracket generation error: expected ${expected} matches but built ${actual}.`);
  return {mode:'single',size,players:ps.map(p=>p.id),byes:size-ps.length,rounds:roundLists.filter(Boolean),byeEntries,playableMatches:expected,champion:null,locked:false,createdAt:new Date().toISOString()};
}
function findMatch(roundLists,id){
  for(const round of roundLists)for(const m of round)if(m.id===id)return m;
  return null;
}
function buildRoundRobin(c,ps){let arr=seedPlayers(ps,c),list=arr.map(p=>p.id);if(list.length%2)list.push(null);const n=list.length,rounds=[];for(let r=0;r<n-1;r++){const matches=[];for(let i=0;i<n/2;i++){const a=list[i],d=list[n-1-i];if(a&&d)matches.push(createMatch(a,d))}rounds.push(matches);list=[list[0],list[n-1],...list.slice(1,n-1)]}return{mode:'roundrobin',size:ps.length,players:ps.map(p=>p.id),byes:0,rounds,champion:null,locked:false,createdAt:new Date().toISOString()}}
function advance(b,r,mi,w,auto=false){
  if(!w||b.mode==='roundrobin')return;
  const m=b.rounds?.[r]?.[mi];
  if(!m)return;
  if(r===b.rounds.length-1){b.champion=w;return}
  // Exact bracket topology is stored on each match, so compact brackets with
  // BYEs do not incorrectly route two Round-1 matches into the same semifinal.
  if(m.nextMatchId){
    for(const round of b.rounds){
      const nm=round.find(x=>x.id===m.nextMatchId);
      if(nm){nm[m.nextSlot||'red']=w;return;}
    }
  }
}
function autoByes(b){
  // Compatibility hook for older saved brackets. New brackets do not create
  // BYE match records, so there is nothing to auto-complete here.
}
async function loadBracketPlayersFromSupabase(categoryId){
  if(!categoryId) throw new Error('Category ID is missing.');
  if(!window.RADIUM_DB) throw new Error('Supabase database bridge is unavailable.');
  const init=await window.RADIUM_DB.init();
  if(!init?.enabled) throw new Error('The tournament service is not connected.');
  const tid=window.RADIUM_CLOUD?.getId?.();
  if(!tid) throw new Error('No tournament is selected.');
  // category_registrations is the authoritative registration source. The old
  // loader depended only on category_players, which can become stale after a
  // registration sync. We also load the actual weigh-in records so the bracket
  // cannot silently admit an unverified competitor.
  const reg=await window.RADIUM_DB.select('category_registrations',{select:'player_id,status',eq:{tournament_id:tid,category_id:categoryId}});
  if(reg?.error) throw reg.error;
  const registered=[...new Set((reg.data||[]).filter(r=>!['CANCELLED','DELETED','WITHDRAWN'].includes(String(r.status||'').toUpperCase())).map(r=>String(r.player_id)).filter(Boolean))];
  if(!registered.length) throw new Error('No players are registered in this category in the tournament data.');
  const pr=await window.RADIUM_DB.select('players',{select:'id,first_name,middle_name,last_name,gender,age,weight,player_number,team_id,status',eq:{tournament_id:tid}});
  if(pr?.error) throw pr.error;
  const wi=await window.RADIUM_DB.select('weigh_ins',{select:'player_id,weight,verified,verified_at',eq:{tournament_id:tid,category_id:categoryId}});
  if(wi?.error) throw wi.error;
  const cp=await window.RADIUM_DB.select('category_players',{select:'player_id,category_id,seed,draw_number,draw_type,drawn_at',eq:{category_id:categoryId}});
  if(cp?.error) throw cp.error;
  const seedMap=new Map((cp.data||[]).map(x=>[String(x.player_id),x]));
  const weighMap=new Map((wi.data||[]).map(x=>[String(x.player_id),x]));
  const playerMap=new Map((Array.isArray(pr?.data)?pr.data:[]).map(x=>[String(x.id),x]));
  const players=[];
  for(const pid of registered){
    const p=playerMap.get(pid); if(!p || (p.status && String(p.status).toLowerCase()!=='active')) continue;
    const w=weighMap.get(pid); if(!w || w.verified!==true) continue;
    const actual=Number(w.weight); if(!Number.isFinite(actual)) continue;
    const sr=seedMap.get(String(p.id));
    players.push({id:p.id,name:[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(' '),sex:p.gender||'',gender:p.gender||'',age:Number(p.age),weight:actual,registeredWeight:Number(p.weight),number:p.player_number??'',teamId:p.team_id||null,seed:Number.isFinite(Number(sr?.seed))?Number(sr.seed):null,categorySeeds:{[categoryId]:{seed:Number(sr?.seed),drawNumber:Number(sr?.draw_number),drawType:sr?.draw_type||null,drawnAt:sr?.drawn_at||null}}});
  }
  if(players.length<2) throw new Error(`Only ${players.length} verified eligible player(s) were found in this category. Complete and verify the weigh-in for at least 2 registered players first.`);
  const c=cat(categoryId);
  if(c?.draw==='seed'){
    const missing=players.filter(p=>!Number.isFinite(Number(p.categorySeeds?.[categoryId]?.seed))).map(p=>p.name);
    const seeds=players.map(p=>Number(p.categorySeeds?.[categoryId]?.seed)).filter(Number.isFinite);
    if(missing.length||seeds.length!==new Set(seeds).size||Math.min(...seeds)!==1||Math.max(...seeds)!==players.length)throw new Error('This category is set to DRAW LOTS seeding. Complete and SAVE unique seed numbers 1 to '+players.length+' before generating the bracket.');
  }
  return players;
}

async function clearCloudBracketMatches(categoryId){
  if(!categoryId||!window.RADIUM_DB)return;
  try{
    const init=await window.RADIUM_DB.init();
    if(!init?.enabled)return;
    const r=await window.RADIUM_DB.remove('matches',{category_id:categoryId});
    if(r?.error)throw r.error;
  }catch(e){
    throw new Error('Could not delete the old database matches for this category. No new bracket was generated. '+(e?.message||e));
  }
}
function clearLocalBracketResults(categoryId){
  data.results=Array.isArray(data.results)?data.results.filter(x=>String(x.categoryId)!==String(categoryId)):[];
  data.medals=Array.isArray(data.medals)?data.medals.filter(x=>String(x.categoryId)!==String(categoryId)):[];
}
$('generateBracket').onclick=async()=>{
  if(data.locked)return alert('Unlock tournament first');
  const id=$('bracketCategory').value,c=cat(id);
  if(!c)return alert('Select a category');
  if(c.event==='Arnis Anyo')return alert('Anyo events do not use brackets. Use the ANYO page and separate Anyo Scoreboard for Individual, Synchronized, and Mixed Anyo events.');
  try{
    await loadBracketReview(id);
    const cloudPlayers=await loadBracketPlayersFromSupabase(id);
    const eligibleCount=cloudPlayers.length;
    const hasCompleted=!!c.bracket?.rounds?.some(r=>r.some(m=>m.completed));
    if(c.bracket&&hasCompleted&&!confirm('This category already has completed matches. Regenerating will permanently replace the old bracket, database matches, and category results. Continue?'))return;
    // Build and validate the replacement before touching the existing cloud bracket.
    const originalPlayers=data.players;
    let newBracket;
    try{ data.players=cloudPlayers; newBracket=buildBracket(c); }
    finally{ data.players=originalPlayers; }
    if(!newBracket||newBracket.playableMatches!==Math.max(0,eligibleCount-1))throw new Error('Generated bracket failed validation.');
    // Only now remove stale database matches, preventing a failed generation from destroying a valid bracket.
    await clearCloudBracketMatches(id);
    c.bracket=newBracket;
    clearLocalBracketResults(id);
    data.activeCategory=id;
    c.bracket.locked=false;
    log('BRACKET GENERATED',c.name+' — '+c.bracket.players.length+' eligible players, '+c.bracket.byes+' BYEs');
    save();
    await window.RADIUM_CLOUD?.flush?.();
    renderAll();
    toast(`Clean bracket generated: ${eligibleCount} eligible, ${c.bracket.byes} BYE(s)`);
  }catch(e){
    console.error('Bracket regeneration failed:',e);
    alert(e?.message||e);
    try{await window.RADIUM_CLOUD?.pull?.();renderAll()}catch(_){renderAll()}
  }
};
$('lockBracket').onclick=()=>{const c=cat($('bracketCategory').value);if(!c?.bracket)return alert('Generate a bracket first');c.bracket.locked=!c.bracket.locked;save();renderBracket();toast(c.bracket.locked?'Bracket locked':'Bracket unlocked')};
function roundName(i,total){const n=total-i;if(n===1)return'FINAL';if(n===2)return'SEMIFINAL';if(n===3)return'QUARTERFINAL';if(n===4)return'ROUND OF 16';return'ROUND '+(i+1)}
function bracketPlayable(m){return !!(m&&m.red&&m.blue)}
function bracketActualMatchCount(b){
  if(!b)return 0;
  // Single elimination always needs exactly N-1 played matches. BYEs are
  // advances, not matches, so they are excluded from this total.
  if(b.mode==='single')return Number.isFinite(Number(b.playableMatches))?Number(b.playableMatches):Math.max(0,(b.players?.length||0)-1);
  return (b.rounds||[]).reduce((n,r)=>n+r.length,0);
}
function renderBracket(){
  const c=cat($('bracketCategory').value),el=$('bracketCanvas');
  el.style.transform='none';el.style.left='0px';el.style.top='0px';
  if(c&&c.event==='Arnis Anyo'){
    el.innerHTML='<div class="empty"><b>Anyo has no bracket.</b><br>Use the separate Anyo scoreboard for judging and final scoring.</div>';
    $('bracketInfo').innerHTML='<span>ANYO — NO BRACKET</span>';return;
  }
  if(!c||!c.bracket){el.innerHTML='<div class="empty">Select a category and generate its bracket.</div>';$('bracketInfo').innerHTML='';return}
  const b=c.bracket;
  const actualMatches=bracketActualMatchCount(b);
  $('bracketInfo').innerHTML=[`${c.name}`,`${b.players.length} ELIGIBLE`,b.mode==='roundrobin'?'ROUND ROBIN':`${b.size}-SLOT`,`${b.byes} BYES`,`${actualMatches} MATCHES`,b.locked?'BRACKET LOCKED':'BRACKET OPEN'].map(x=>`<span>${esc(x)}</span>`).join('');
  el.innerHTML='';let globalMatch=1;
  b.rounds.forEach((r,ri)=>{
    const col=document.createElement('div');col.className='bracket-round';
    const title=b.mode==='roundrobin'?'ROUND '+(ri+1):roundName(ri,b.rounds.length);
    col.innerHTML=`<div class="bracket-round-title"><b>${esc(title)}</b><span>${b.mode==='single'?((r||[]).length+' MATCH'+((r||[]).length===1?'':'ES')):''}</span></div><div class="round-matches"></div>`;
    const list=col.querySelector('.round-matches');
    list.style.gap=(24*Math.pow(2,ri))+'px';

    if(ri===0&&b.mode==='single'){
      // Recreate the visual first-round order from the photo while keeping
      // BYEs out of the matches array/database. BYE cards are display-only.
      const entries=[];
      (r||[]).forEach(m=>entries.push({pos:Number.isFinite(m.firstRoundPosition)?m.firstRoundPosition:999,type:'match',m}));
      (b.byeEntries||[]).forEach(x=>entries.push({pos:x.firstRoundPosition,type:'bye',x}));
      entries.sort((a,z)=>a.pos-z.pos||({bye:0,match:1}[a.type]-({bye:0,match:1}[z.type])));
      entries.forEach(e=>{
        if(e.type==='match'){
          const m=e.m,mi=r.indexOf(m),matchNo=globalMatch++;
          list.appendChild(renderMatch(m,c,b,ri,mi,matchNo,mi+1));
        }else{
          const x=e.x,bye=document.createElement('div');
          bye.className='bracket-bye-entry';bye.dataset.targetMatch=x.targetMatchId||'';
          bye.dataset.targetSlot=x.targetSlot||'';
          bye.innerHTML=`<div class="bye-player"><span class="bye-tag">BYE</span><span class="bye-name">${esc(player(x.playerId)?.name||x.playerId)}</span><small>ADVANCES</small></div>`;
          list.appendChild(bye);
        }
      });
    }else{
      r.forEach((m,mi)=>list.appendChild(renderMatch(m,c,b,ri,mi,globalMatch++,mi+1)));
    }
    el.appendChild(col);
  });
  if(b.champion){const x=document.createElement('div');x.className='champion-card';x.innerHTML=`<div class="champion-label">🏆 CHAMPION</div><div class="champion-name">${esc(player(b.champion)?.name||b.champion)}</div>`;el.appendChild(x)}
  requestAnimationFrame(()=>{drawBracketConnectors();fitBracketToViewport()});
}
function fitBracketToViewport(){
  const viewport=document.querySelector('.bracket-viewport'),canvas=$('bracketCanvas');
  if(!viewport||!canvas)return;
  canvas.style.transform='none';canvas.style.left='0px';canvas.style.top='0px';
  const naturalWidth=canvas.scrollWidth,naturalHeight=canvas.scrollHeight;
  const vw=viewport.clientWidth,vh=viewport.clientHeight;
  if(!naturalWidth||!naturalHeight||!vw||!vh)return;
  let scale=Math.min(1,vw/naturalWidth,vh/naturalHeight);
  // Never shrink a large bracket into illegible text. Below this floor,
  // keep it readable and let the viewport scroll instead of clipping.
  const MIN_SCALE=0.42;
  if(scale<MIN_SCALE){scale=MIN_SCALE;viewport.style.overflow='auto'}else{viewport.style.overflow='hidden'}
  canvas.style.transformOrigin='top left';
  canvas.style.transform=`scale(${scale})`;
  const scaledW=naturalWidth*scale,scaledH=naturalHeight*scale;
  canvas.style.left=Math.max(0,(vw-scaledW)/2)+'px';
  canvas.style.top=Math.max(0,(vh-scaledH)/2)+'px';
}

function drawBracketConnectors(){
  const el=$('bracketCanvas');if(!el||!el.offsetParent)return;
  el.querySelector('.bracket-connectors')?.remove();
  const c=cat($('bracketCategory')?.value);const b=c?.bracket;
  if(!b||b.mode!=='single')return;
  const all=[...el.querySelectorAll('.bracket-match[data-id],.bracket-bye-entry[data-target-match]')];
  const byId=new Map([...el.querySelectorAll('.bracket-match[data-id]')].map(x=>[x.dataset.id,x]));
  if(!all.length)return;
  const width=Math.max(el.scrollWidth,el.clientWidth),height=Math.max(el.scrollHeight,el.clientHeight);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('bracket-connectors');svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-hidden','true');
  const canvasRect=el.getBoundingClientRect();
  const draw=(from,target)=>{
    if(!from||!target)return;
    const a=from.getBoundingClientRect(),z=target.getBoundingClientRect();
    const x1=a.right-canvasRect.left+el.scrollLeft,y1=a.top+a.height/2-canvasRect.top+el.scrollTop;
    const x2=z.left-canvasRect.left+el.scrollLeft,y2=z.top+z.height/2-canvasRect.top+el.scrollTop;
    const mid=x1+(x2-x1)/2;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);path.setAttribute('class','bracket-connector');svg.appendChild(path);
  };
  for(const round of b.rounds){for(const m of round){if(m.nextMatchId)draw(byId.get(m.id),byId.get(m.nextMatchId));}}
  for(const x of (b.byeEntries||[])){if(x.targetMatchId)draw(el.querySelector(`.bracket-bye-entry[data-target-match="${CSS.escape(x.targetMatchId)}"]`),byId.get(x.targetMatchId));}
  el.prepend(svg);
}
window.addEventListener('resize',()=>requestAnimationFrame(()=>{drawBracketConnectors();fitBracketToViewport()}));
function roundAbbrev(i,total){const n=total-i;if(n===1)return'Final';if(n===2)return'SF';if(n===3)return'QF';if(n===4)return'R16';return'R'+(i+1)}
function renderMatch(m,c,b,ri,mi,globalNo,gameNo){
  const x=document.createElement('div');x.className='bracket-match';x.dataset.round=ri;x.dataset.match=mi;x.dataset.id=m.id;
  const info=p=>{const pl=player(p);if(!pl)return {name:'',meta:''};return{name:pl.name,meta:[team(pl.teamId)?.name,pl.seed?'SEED '+pl.seed:''].filter(Boolean).join(' • ')}};
  const nm=p=>{const i=info(p);return `<span class="fighter-name">${esc(i.name)}</span>${i.meta?`<small class="fighter-meta">${esc(i.meta)}</small>`:''}`};
  const scoreBox=(side)=>{
    const isBye=side==='red'?m.redBye:m.blueBye;
    if(isBye)return '<span class="score-box bye-box">BYE</span>';
    if(!m.completed)return '';
    const val=side==='red'?m.redScore:m.blueScore;
    return `<span class="score-box">${val}</span>`;
  };
  const label=b.mode==='roundrobin'?`R${ri+1} · Game ${mi+1}`:`${roundAbbrev(ri,b.rounds.length)} · Game ${gameNo}`;
  const isFinal=ri===b.rounds.length-1&&b.mode!=='roundrobin';
  x.innerHTML=`<div class="match-label">${isFinal?'🏆 ':''}${esc(label)}</div><div class="match-card"><div class="fighter red ${m.winner===m.red?'winner':''} ${!m.red?'waiting':''}"><span>${nm(m.red)}</span>${scoreBox('red')}</div><div class="vs-badge">VS</div><div class="fighter blue ${m.winner===m.blue?'winner':''} ${!m.blue?'waiting':''}"><span>${nm(m.blue)}</span>${scoreBox('blue')}</div></div>`;
  const btn=document.createElement('button');btn.className='match-btn';
  if(m.completed){btn.textContent=m.winner?'RESULT CONFIRMED':'BYE ADVANCED';btn.disabled=true}
  else if(m.red&&m.blue){btn.textContent='START MATCH';btn.onclick=()=>openScore(c.id,ri,mi)}
  else{btn.textContent='';btn.disabled=true;btn.classList.add('hidden-btn')}
  x.appendChild(btn);return x;
}
function allMatches(){const rows=[];for(const c of data.categories||[])for(const [ri,round] of (c.bracket?.rounds||[]).entries())for(const [mi,m] of (round||[]).entries())if(m)rows.push({c,ri,mi,m});return rows;}
function matchFlowSexRank(c,flow){const sex=String(c?.sex||c?.gender||'Mixed').toLowerCase();if(flow==='BOYS_FIRST'||flow==='ROUND_BOYS_FIRST')return sex==='male'||sex==='boys'?0:sex==='female'||sex==='girls'?1:2;if(flow==='GIRLS_FIRST'||flow==='ROUND_GIRLS_FIRST')return sex==='female'||sex==='girls'?0:sex==='male'||sex==='boys'?1:2;return 0;}
function matchFlowCategoryRank(c){
  const n=String(c?.name||'').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  const event=String(c?.event||c?.event_type||'').toLowerCase();
  // Official DepEd–PEKAF Combative order. Match specific terms before the generic "lightweight" terms.
  if(/\bpinweight\b/.test(n))return 0;
  if(/\bbantamweight\b|\bbantam\b/.test(n))return 1;
  if(/\bfeatherweight\b|\bfeather\b/.test(n))return 2;
  if(/\bextra\s*lightweight\b|\bextra\s*light\s*weight\b/.test(n))return 3;
  if(/\bhalf\s*lightweight\b|\bhalf\s*light\s*weight\b/.test(n))return 4;
  // Anyo order. This is also used by category-based selectors/queues.
  if(/\bespada\s*y\s*daga\b/.test(n))return 12;
  if(/\bdouble\s+weapon\b/.test(n))return 11;
  if(/\bsingle\s+weapon\b/.test(n))return 10;
  // Preserve a deterministic fallback without relying on database insertion order.
  return 100 + n.localeCompare(n);
}
function matchFlowOrderRows(rows,flow,getCategory){
  const f=String(flow||'ROUND_CATEGORY').toUpperCase();
  const resolve=typeof getCategory==='function'?getCategory:(row=>row?.c||null);
  return (rows||[]).slice().sort((a,b)=>{
    const ca=resolve(a)||{}, cb=resolve(b)||{};
    const sa=matchFlowSexRank(ca,f), sb=matchFlowSexRank(cb,f);
    const ra=Number(a?.ri??a?.round)-0||0, rb=Number(b?.ri??b?.round)-0||0;
    const ma=Number(a?.mi??a?.match_number)-0||0, mb=Number(b?.mi??b?.match_number)-0||0;
    const ka=matchFlowCategoryRank(ca), kb=matchFlowCategoryRank(cb);
    const na=String(ca?.name||''), nb=String(cb?.name||'');
    if(f==='BOYS_FIRST'||f==='GIRLS_FIRST') return sa-sb||ka-kb||na.localeCompare(nb)||ra-rb||ma-mb;
    if(f==='ROUND_BOYS_FIRST'||f==='ROUND_GIRLS_FIRST') return ra-rb||sa-sb||ka-kb||na.localeCompare(nb)||ma-mb;
    return ra-rb||ka-kb||na.localeCompare(nb)||sa-sb||ma-mb;
  });
}
window.RADIUM_MATCH_FLOW_ORDER=matchFlowOrderRows;
function orderedReadyMatches(rows){
  const flow=String(matchFlowDraft||data.setup?.matchFlow||'ROUND_CATEGORY').toUpperCase();
  const ready=(rows||[]).filter(x=>{const st=String(x.m?.status||'READY').toUpperCase();return x.m&&x.m.red&&x.m.blue&&!x.m.completed&&st==='READY';});
  // Round-by-round flows are a true tournament execution gate, not merely a
  // display sort. Do not release Round 2 while ANY playable Round 1 match is
  // still unfinished, even if a later-category match is already READY.
  if(flow==='ROUND_CATEGORY'||flow==='ROUND_BOYS_FIRST'||flow==='ROUND_GIRLS_FIRST'){
    const unfinished=(rows||[]).filter(x=>x.m&&!x.m.completed&&x.m.red&&x.m.blue);
    if(!unfinished.length)return [];
    const minRound=Math.min(...unfinished.map(x=>Number(x.ri)||0));
    return matchFlowOrderRows(ready.filter(x=>(Number(x.ri)||0)===minRound),flow,x=>x.c);
  }
  return matchFlowOrderRows(ready,flow,x=>x.c);
}
function available(){return orderedReadyMatches(allMatches());}
async function openScore(cid,ri,mi,court=1){const c=cat(cid),m=c?.bracket?.rounds?.[ri]?.[mi];if(!c||!m||!m.red||!m.blue||m.completed)return;const tid=activeTournamentId();if(!tid)return alert('No active tournament is selected.');let actualCourt=Number(court)||1;let matchFormat=String(m.matchFormat||'')==='single'?'single':(String(m.matchFormat||'')==='best3'?'best3':(Number(data.setup?.combativeRounds)===1?'single':'best3'));try{if(window.RADIUM_DB&&m.id){await window.RADIUM_DB.init();const existing=await window.RADIUM_DB.select('matches',{select:'id,court_id,match_format,status',eq:{id:m.id,tournament_id:tid},limit:1});if(existing.error)throw existing.error;const row=existing.data?.[0];if(row?.match_format)matchFormat=row.match_format;const cr=await window.RADIUM_DB.select('courts',{select:'id,court_number',eq:{tournament_id:tid,court_number:actualCourt},limit:1});if(cr.error)throw cr.error;if(cr.data?.[0]){actualCourt=Number(cr.data[0].court_number)||actualCourt;const ur=await window.RADIUM_DB.update('matches',{court_id:cr.data[0].id,match_format:matchFormat},{id:m.id});if(ur.error)throw ur.error;m.court=actualCourt;m.matchFormat=matchFormat;}}}catch(e){return alert('Could not assign this match to Court '+actualCourt+'. '+(e.message||e))}const q=new URLSearchParams({court:String(actualCourt),tournament:tid,matchId:m.id,categoryId:cid,categoryName:c.name,event:c.event,round:String(ri+1),match:String(mi+1),red:m.red,blue:m.blue,redName:player(m.red)?.name||m.red,blueName:player(m.blue)?.name||m.blue,matchFormat});window.location.href='scoreboard/index.html?'+q.toString()}
$('nextMatchBtn').onclick=async()=>{const a=available()[0];if(!a)return alert('No ready matches.');const court=await firstAvailableCourt();await openScore(a.c.id,a.ri,a.mi,court)};window.radiumStartQueuedMatch=async function(cid,ri,mi){const court=await firstAvailableCourt();await openScore(cid,ri,mi,court)};$('autoAssignBtn').onclick=async()=>{let i=0;const rows=available();const tid=activeTournamentId();for(const x of rows){const court=(i++%Math.max(1,Number(data.setup.courts)||1))+1;x.m.court=court;if(tid&&window.RADIUM_DB){try{await window.RADIUM_DB.init();const cr=await window.RADIUM_DB.select('courts',{select:'id',eq:{tournament_id:tid,court_number:court},limit:1});if(cr.data?.[0]&&x.m.id){const ur=await window.RADIUM_DB.update('matches',{court_id:cr.data[0].id},{id:x.m.id});if(ur.error)throw ur.error;}}catch(e){console.error('Court assignment save failed:',e);return alert('Court assignment could not be saved to Supabase. '+(e.message||e))}}}save();await renderQueue();toast('Matches assigned to courts and saved to Supabase')};async function firstAvailableCourt(){const count=Math.max(1,Number(data.setup.courts)||1);const tid=activeTournamentId();if(tid&&window.RADIUM_DB){try{await window.RADIUM_DB.init();const courts=await window.RADIUM_DB.select('courts',{select:'id,court_number',eq:{tournament_id:tid,active:true}});const matches=await window.RADIUM_DB.select('matches',{select:'court_id,status',eq:{tournament_id:tid}});if(!courts.error&&!matches.error){const used=new Set((matches.data||[]).filter(m=>['IN_PROGRESS','READY'].includes(String(m.status||'').toUpperCase())&&m.court_id).map(m=>String(m.court_id)));for(const c of (courts.data||[]).sort((a,b)=>Number(a.court_number)-Number(b.court_number)))if(!used.has(String(c.id)))return Number(c.court_number)||1;}}catch(e){console.warn('Supabase court availability check failed:',e)}}const used=new Set(allMatches().map(x=>Number(x.court)||0));for(let i=1;i<=count;i++)if(!used.has(i))return i;return 1}
async function renderQueue(){
  const courts=$('courts');
  let liveByCourt=new Map();
  const tid=activeTournamentId();
  if(tid&&window.RADIUM_DB){try{await window.RADIUM_DB.init();const q=await window.RADIUM_DB.select('matches',{select:'id,court_id,category_id,round,match_number,blue_player_id,red_player_id,status,metadata',eq:{tournament_id:tid}});if(!q.error){const cats=new Map(data.categories.map(c=>[String(c.id),c]));const players=new Map(data.players.map(p=>[String(p.id),p]));const courtRows=await window.RADIUM_DB.select('courts',{select:'id,court_number',eq:{tournament_id:tid}});const noById=new Map((courtRows.data||[]).map(c=>[String(c.id),Number(c.court_number)]));(q.data||[]).filter(m=>String(m.status||'').toUpperCase()==='IN_PROGRESS'&&m.court_id).forEach(m=>{const cno=noById.get(String(m.court_id));if(!cno)return;const c=cats.get(String(m.category_id));liveByCourt.set(cno,{blueName:players.get(String(m.blue_player_id))?.name||m.blue_player_id,redName:players.get(String(m.red_player_id))?.name||m.red_player_id,categoryName:c?.name||''})});}}catch(e){console.warn('Supabase live court load failed:',e)}}
  courts.innerHTML=Array.from({length:data.setup.courts},(_,i)=>{const cno=i+1,live=liveByCourt.get(cno);return `<div class="court ${live?'live':''}"><h3>COURT ${cno} ${live?'<span class="live-dot">● LIVE</span>':''}</h3>${live?`<div><b>${esc(live.blueName)}</b> vs <b>${esc(live.redName)}</b></div><div class="muted">${esc(live.categoryName)}</div>`:'<div class="muted">AVAILABLE</div>'}</div>`}).join('');
  const rows=available().slice(0,20);
  $('upcomingMatches').innerHTML=rows.length?`<div class="queue-match-list">${rows.map((x,i)=>{const red=player(x.m.red)?.name||x.m.red||'TBD',blue=player(x.m.blue)?.name||x.m.blue||'TBD';return `<div class="queue-match ${i===0?'next':''}"><div class="queue-match-num">${i===0?'NEXT':'#'+(i+1)}</div><div class="queue-match-category">${esc(x.c.name)}<small>ROUND ${x.ri+1} • MATCH ${x.mi+1}</small></div><div class="queue-match-players">${esc(red)} <span class="muted">VS</span> ${esc(blue)}</div><button class="btn small primary" onclick="window.radiumStartQueuedMatch('${x.c.id}',${x.ri},${x.mi})">START</button></div>`}).join('')}</div>`:'<div class="empty">No ready matches.</div>';
}

function awardMedal(categoryId,playerId,medal){
  if(!playerId)return;
  if(data.medals.some(m=>m.categoryId===categoryId&&m.playerId===playerId&&m.medal===medal))return;
  data.medals.push({id:uid(),categoryId,playerId,teamId:player(playerId)?.teamId||'',medal,awardedAt:new Date().toISOString()});
}
async function processResultPayload(r){
  if(!r)return false;
  try{
    // Refresh first so validation and display use the same authoritative Supabase state.
    const ok=await window.RADIUM_CLOUD?.pull?.();
    if(ok===false)return false;
    const c=cat(r.categoryId),m=c?.bracket?.rounds?.[Number(r.round)-1]?.[Number(r.match)-1];
    if(!c||!m||!r.winner||(m.red!==r.winner&&m.blue!==r.winner))return false;
    renderAll();
    return true;
  }catch(e){console.error('RADIUM result refresh failed:',e);return false;}
}
async function processOneResult(rawKey){const r=window[rawKey];return r?processResultPayload(r):false}
async function processResult(){return window.__RADIUM_PENDING_RESULT_PROMISE||true}
function renderResults(){$('resultsTable').innerHTML=data.results.slice(0,300).map(r=>`<tr><td>${new Date(r.completedAt||r.time||Date.now()).toLocaleString()}</td><td>${esc(r.category)}</td><td>${Number(r.match)}</td><td>${esc(r.blue)}</td><td>${esc(r.red)}</td><td>${r.blueScore}-${r.redScore}</td><td><b>${esc(player(r.winner)?.name||r.winner)}</b></td><td>${esc(r.official||'Scoreboard')}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No confirmed results.</td></tr>';$('auditLog').innerHTML=data.audit.slice(0,100).map(a=>`<div class="activity-row"><b>${new Date(a.time).toLocaleString()}</b> — ${esc(a.action)} — ${esc(a.detail)}</div>`).join('')||'<div class="empty">No audit entries.</div>'}
function renderReports(){const rows=data.teams.map(t=>{const m=medalCounts(t.id),pts=m.gold*data.setup.gold+m.silver*data.setup.silver+m.bronze*data.setup.bronze;return {...t,m,pts}}).sort((a,b)=>b.pts-a.pts||b.m.gold-a.m.gold);$('medalTable').innerHTML=rows.map((t,i)=>`<tr><td>${i+1}</td><td>${esc(t.name)}</td><td>${t.m.gold}</td><td>${t.m.silver}</td><td>${t.m.bronze}</td><td>${t.pts}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No teams.</td></tr>';const winners=data.categories.map(c=>{const w=c.bracket?.champion;return `<tr><td>${esc(c.name)}</td><td>${esc(w?(player(w)?.name||w):'—')}</td><td>${esc(w?team(player(w)?.teamId)?.name||'—':'—')}</td></tr>`}).join('');$('reportBody').innerHTML=`<h3>${esc(data.setup.name)}</h3><p>${esc(data.setup.date)} • ${esc(data.setup.venue)} • ${esc(data.setup.organizer)}</p><p>${data.players.length} players • ${data.categories.length} categories • ${data.results.length} confirmed matches</p><h3>Category Winners</h3><div class="table-wrap"><table><thead><tr><th>CATEGORY</th><th>WINNER</th><th>TEAM</th></tr></thead><tbody>${winners||'<tr><td colspan="3">No winners yet.</td></tr>'}</tbody></table></div>`}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('printReport').onclick=()=>showPage('reportsPage')||setTimeout(()=>window.print(),50);$('printBrackets').onclick=()=>{showPage('bracketPage');setTimeout(()=>window.print(),50)};$('exportCsv').onclick=()=>{const rows=[['Time','Category','Blue','Red','Blue Score','Red Score','Winner'],...data.results.map(r=>[r.completedAt||'',r.category,r.blue,r.red,r.blueScore,r.redScore,player(r.winner)?.name||r.winner])];download('RADIUM_Results.csv',rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv')};
$('lockBtn').onclick=async()=>{const configured=String(data.setup.pin||data.setup.pinHash||'');if(!data.locked&&!configured)return alert('Set an Official PIN in SETUP before locking the tournament.');const hash=async v=>{const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(v||'')));return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')};if(data.locked){const pin=prompt('Enter official PIN');if(pin==null)return;const ok=data.setup.pin?pin===data.setup.pin:(await hash(pin))===data.setup.pinHash;if(ok){data.locked=false;document.body.classList.remove('locked');save();toast('Controls unlocked')}else alert('Incorrect PIN')}else{data.locked=true;document.body.classList.add('locked');save();toast('Tournament controls locked')}};
$('helpBtn').onclick=()=>{$('helpModal').classList.add('show');$('helpModal').setAttribute('aria-hidden','false')};$('closeHelp').onclick=()=>{$('helpModal').classList.remove('show');$('helpModal').setAttribute('aria-hidden','true')};$('helpModal').onclick=e=>{if(e.target.id==='helpModal')$('closeHelp').click()};window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('helpModal').classList.contains('show'))$('closeHelp').click()});window.addEventListener('message',async e=>{if(e.data?.type==='RADIUM_MATCH_RESULT'&&e.data.payload){try{if(e.origin!==window.location.origin)return;window.__RADIUM_PENDING_RESULT_PROMISE=processResultPayload(e.data.payload);await window.__RADIUM_PENDING_RESULT_PROMISE;window.__RADIUM_PENDING_RESULT_PROMISE=null;renderAll()}catch(err){console.warn('Invalid combat result message',err)}}});window.addEventListener('focus',()=>{try{window.RADIUM_CLOUD?.pull?.()}catch(e){console.warn('Cloud refresh:',e)}});
// ===== RADIUM MOCK TOURNAMENT TEST DATA =====
function loadMockTournament(){
  if(data.locked)return alert('Unlock the tournament first.');
  if((data.players.length||data.teams.length||data.categories.length)&&!confirm('Load the mock tournament and replace the current tournament data?\
\
Your current data will be replaced. Use BACKUP first if you need it.'))return;
  const T=[
    ['RMA','RADIUM Martial Arts Academy','Coach Adrian Velasco'],
    ['CAW','Cabanatuan Arnis Warriors','Coach Marco Villanueva'],
    ['NEEC','Nueva Ecija Eskrima Club','Coach Daniel Santiago'],
    ['CLAT','Central Luzon Arnis Team','Coach Rafael Mendoza'],
    ['SIMA','San Isidro Martial Arts','Coach Jerome Castillo'],
    ['NVAA','North Valley Arnis Academy','Coach Paolo Reyes'],
    ['GSTC','Golden Sticks Training Center','Coach Miguel Navarro'],
    ['LAC','Lakandula Arnis Club','Coach Andres Bautista']
  ];
  const first=['Aiden','Miguel','Rafael','Joshua','Liam','Noah','Ethan','Gabriel','Marco','Nathan','Adrian','Carlos','Daniel','Paolo','Enzo','Lucas','Mateo','Joaquin','Andre','Elijah'];
  const last=['Santos','Reyes','Garcia','Mendoza','Cruz','Dela Peña','Villanueva','Castillo','Navarro','Bautista','Ramos','Flores','Aquino','Torres','Rivera','Salazar','Manalo','Santiago','Velasco','Morales'];
  const femaleFirst=['Alyssa','Sofia','Mia','Ella','Chloe','Zoe','Nina','Leah','Maya','Isabel','Camille','Jasmine','Angela','Bianca','Nicole','Kira','Bea','Amara','Trisha','Dana'];
  const teams=T.map(x=>({id:uid(),code:x[0],name:x[1],coach:x[2]}));
  const players=[]; let serial=1;
  const cohorts=[
    {label:'12 & Below',year:2014,base:40},
    {label:'13–15',year:2011,base:45},
    {label:'16–17',year:2009,base:55},
    {label:'18 & Above',year:2004,base:65}
  ];
  cohorts.forEach((cohort,ci)=>{
    for(let sexIdx=0;sexIdx<2;sexIdx++){
      for(let i=0;i<10;i++){
        const sex=sexIdx===0?'Male':'Female';
        const fn=sexIdx===0?first[i+ci*2]:femaleFirst[i+ci*2];
        const ln=last[(i+ci*3+sexIdx)%last.length];
        const team=teams[(i+ci*2+sexIdx)%teams.length];
        const month=(i%9)+1, day=((i*3+7)%25)+1;
        const birthYear=ci===0?2014+(i%2):ci===1?2011+(i%3):ci===2?2008+(i%2):2004-(i%7);
        players.push({id:uid(),number:'M'+String(serial++).padStart(3,'0'),seed:(i%8)+1,name:`${fn} ${ln}`,nick:'',sex,birth:`${birthYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,weight:cohort.base+i,teamId:team.id,coach:team.coach,photo:'',events:{combat:true,anyoIndividual:true,anyoTeam:i<6,livestick:true,anyoTraditional:true,anyoNonTraditional:true,anyoTraditionalWeapons:['Single Weapon','Double Weapon','Espada y Daga'],anyoNonTraditionalWeapons:['Single Weapon','Double Weapon','Espada y Daga'],anyoWeapons:'Single Weapon'}});
      }
    }
  });
  const cats=[];
  const add=(name,sex,event,af,at,wf,wt,extra={})=>cats.push({id:uid(),name,sex,event,anyoType:extra.anyoType||'',anyoStyle:extra.anyoStyle||'',anyoWeapon:extra.anyoWeapon||'Any',ageFrom:af,ageTo:at,weightFrom:wf,weightTo:wt,draw:extra.draw||'team',bracket:null});
  // Padded Stick: deliberately mixed odd/even participant counts for bracket testing.
  add('Boys 12 & Below • Padded Stick • 40–46 kg','Male','Padded Stick',0,12,40,46);
  add('Girls 13–15 • Padded Stick • 45–52 kg','Female','Padded Stick',13,15,45,52);
  add('Boys 16–17 • Padded Stick • 55–64 kg','Male','Padded Stick',16,17,55,64);
  add('Girls 18 & Above • Padded Stick • 65–71 kg','Female','Padded Stick',18,99,65,71);
  // Livestick.
  add('Girls 12 & Below • Livestick • 40–48 kg','Female','Livestick',0,12,40,48);
  add('Boys 13–15 • Livestick • 45–53 kg','Male','Livestick',13,15,45,53);
  add('Girls 16–17 • Livestick • 55–62 kg','Female','Livestick',16,17,55,62);
  add('Boys 18 & Above • Livestick • 65–73 kg','Male','Livestick',18,99,65,73);
  // Traditional and Non-Traditional Anyo, kept separate.
  [['Traditional','Single Weapon'],['Traditional','Double Weapon'],['Traditional','Espada y Daga'],['Non-Traditional','Single Weapon'],['Non-Traditional','Double Weapon'],['Non-Traditional','Espada y Daga']].forEach(([style,weapon])=>{
    ['Male','Female'].forEach(sex=>{
      add(`${sexLabel(sex)} Individual Anyo • ${style} • ${weapon}`,sex,'Arnis Anyo',0,99,0,999,{anyoType:'Individual',anyoStyle:style,anyoWeapon:weapon,draw:'random'});
    });
  });
  // Group Anyo categories for testing registration/eligibility (no player bracket).
  ['Traditional','Non-Traditional'].forEach(style=>{
    ['Male','Female'].forEach(sex=>add(`${sexLabel(sex)} Synchronized Anyo • ${style} • Double Weapon`,sex,'Arnis Anyo',0,99,0,999,{anyoType:'Synchronized',anyoStyle:style,anyoWeapon:'Double Weapon',draw:'random'}));
  });
  data=createFreshData();
  data.version=14;
  data.setup={name:'RADIUM NATIONAL ARNIS OPEN 2026 — MOCK TEST',date:new Date().toISOString().slice(0,10),venue:'Cabanatuan City Sports Complex (Mock)',organizer:'RADIUM Martial Arts & Healing Center',courts:4,duration:60,type:'single',gold:5,silver:3,bronze:1,pin:'2468'};
  data.teams=teams;data.players=players;data.categories=cats;data.locked=false;
  // Build combat brackets now so the bracket, BYE and queue systems can be tested immediately.
  cats.filter(c=>c.event!=='Arnis Anyo').forEach(c=>{try{c.bracket=buildBracket(c)}catch(e){console.warn('Mock bracket skipped',c.name,e.message)}});
  data.activeCategory=cats.find(c=>c.event==='Padded Stick')?.id||null;
  // Add a small audit trail and a completed sample result on the first ready match without corrupting the bracket.
  log('MOCK TOURNAMENT LOADED',`${players.length} players, ${teams.length} teams, ${cats.length} categories`);
  save();renderAll();
  if($('bracketCategory'))$('bracketCategory').value=data.activeCategory;
  renderBracket();
  showPage('dashboardPage');
  const mockStatus=$('mockLoaderStatus');
  if(mockStatus)mockStatus.textContent=`Loaded successfully: ${players.length} players • ${teams.length} teams • ${cats.length} categories.`;
  toast(`Mock tournament loaded: ${players.length} players • ${teams.length} teams • ${cats.length} categories`);
}
const mockBtn=$('loadMockTournamentBtn');
if(mockBtn){mockBtn.type='button';mockBtn.onclick=e=>{e.preventDefault();e.stopPropagation();window.radiumLoadMockTournament()}}

/* V14 TEST CLEAN START: remove only local tournament/mock data once; preserve Supabase auth/session. */

load();
window.__RADIUM_GET_DATA=function(){return data};
window.RADIUM_STATE=()=>data;
window.__RADIUM_SET_DATA=function(next,opts={}){if(!next||typeof next!=='object')return false;const incomingSetup={...(next.setup||{})};if(!incomingSetup.competitionProgram)incomingSetup.competitionProgram='GENERAL';data={...createFreshData(),...next,version:16,setup:{...createFreshData().setup,...incomingSetup},anyoResults:Array.isArray(next.anyoResults)?next.anyoResults:[],weighIns:next.weighIns&&typeof next.weighIns==='object'?next.weighIns:{},anyoEntries:Array.isArray(next.anyoEntries)?next.anyoEntries:[]};normalizeBracketPlayerIds();if(!opts.fromCloud)save();window.RADIUM_DRAW_LOTS?.refreshVisibility?.();return true};
window.renderAll=renderAll;
window.RADIUM_MAIN_READY=true;rebuildAnyoMedals();syncCategoryFields();togglePlayerAnyoWeapon();if(data.locked)document.body.classList.add('locked');renderAll();const __initialParams=new URLSearchParams(location.search);const initialView=__initialParams.get('view');
if(initialView==='bracket')showPage('bracketPage');
else if(initialView==='anyo')showPage('anyoPage');
else if(initialView==='queue'){
  showPage('queuePage');
  // Coming back from the scoreboard after a single-round match: show what
  // just happened to the bracket, then jump straight into the next ready
  // match instead of silently landing on the Match Queue page.
  if(__initialParams.get('autostart')==='1'){
    const a=available()[0];
    if(a){
      const last=data.results[0];
      let msg='Loading next match…';
      if(last){
        const c=cat(last.categoryId),b=c?.bracket,winnerName=player(last.winner)?.name||last.winner;
        if(b){
          msg=(b.champion===last.winner)
            ?`${winnerName} is the CHAMPION of ${c.name}! Loading next match…`
            :`${winnerName} advances to ${roundName(Number(last.round)+1,b.rounds.length)} — ${c.name}. Loading next match…`;
        }
      }
      toast(msg);
      const preferredCourt=Number(__initialParams.get('court'))||0;
      setTimeout(async()=>{
        let court=await firstAvailableCourt();
        if(preferredCourt&&window.RADIUM_DB){try{await window.RADIUM_DB.init();const cr=await window.RADIUM_DB.select('courts',{select:'id',eq:{tournament_id:activeTournamentId(),court_number:preferredCourt},limit:1});const cid=cr.data?.[0]?.id;if(cid){const mr=await window.RADIUM_DB.select('matches',{select:'id,status',eq:{tournament_id:activeTournamentId(),court_id:cid}});const busy=(mr.data||[]).some(m=>['IN_PROGRESS','READY'].includes(String(m.status||'').toUpperCase()));if(!busy)court=preferredCourt;}}catch(e){console.warn('Preferred court check failed:',e)}}
        await openScore(a.c.id,a.ri,a.mi,court);
      },1400);
    }else{
      toast('No more ready matches in this bracket.');
    }
  }
}


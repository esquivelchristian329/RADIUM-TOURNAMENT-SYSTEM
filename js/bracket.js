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
function activeTournamentId(){try{return localStorage.getItem(ACTIVE_ID_KEY)||sessionStorage.getItem(ACTIVE_ID_KEY)||''}catch(e){return ''}}
const $=id=>document.getElementById(id);const uid=()=>`tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
let data={version:14,setup:{name:'',date:new Date().toISOString().slice(0,10),venue:'',organizer:'',courts:2,duration:60,type:'single',competitionProgram:'GENERAL',matchFlow:'ROUND_CATEGORY',gold:5,silver:3,bronze:1,pin:'',billingMode:'PAID',currency:'PHP',scoreboardLogos:['','','','']},teams:[],players:[],categories:[],results:[],medals:[],audit:[],activeCategory:null,locked:false,anyoResults:[],weighIns:{},anyoEntries:[]};
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
function normalizeBracketPlayerIds(){const ids=new Set(data.players.map(p=>p.id));data.categories.forEach(c=>{const b=c.bracket;if(!b)return;(b.rounds||[]).forEach(r=>r.forEach(m=>{['red','blue','winner'].forEach(k=>{const v=m[k];if(v&&typeof v==='object')m[k]=v.id||v.playerId||null;else if(v&&!ids.has(v)&&typeof v==='string')m[k]=v;});}));if(b.champion&&typeof b.champion==='object')b.champion=b.champion.id||null;});}
function save(options={}){const st=$('saveState');if(st)st.textContent='CLOUD SAVE QUEUED '+new Date().toLocaleTimeString();try{window.RADIUM_CLOUD?.scheduleSync?.()}catch(e){console.warn('Cloud sync schedule:',e)}return true;}
function createFreshData(){return {version:14,tournamentId:activeTournamentId()||null,storageNamespace:null,setup:{name:'',date:new Date().toISOString().slice(0,10),venue:'',organizer:'',courts:2,duration:60,type:'single',competitionProgram:'GENERAL',matchFlow:'ROUND_CATEGORY',gold:5,silver:3,bronze:1,pin:'',billingMode:'PAID',currency:'PHP',scoreboardLogos:['','','','']},teams:[],players:[],categories:[],results:[],medals:[],audit:[],activeCategory:null,locked:false,anyoResults:[],weighIns:{},anyoEntries:[]};}
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
function ensureIndividualAnyoEntries(){
  // Individual Anyo entries are derived from player registrations.  This helper
  // must always exist because renderAll() runs after every cloud load/create.
  // Keep it idempotent so repeated renders never create duplicate entries.
  if(!Array.isArray(data.anyoEntries))data.anyoEntries=[];
  const individualCategories=(data.categories||[]).filter(c=>isAnyoEvent(c)&&String(c.anyoType||'Individual')==='Individual'&&c.id);
  for(const c of individualCategories){
    for(const p of (data.players||[])){
      if(!eligible(p,c)||p.events?.anyoIndividual!==true)continue;
      const exists=data.anyoEntries.find(e=>String(e.categoryId)===String(c.id)&&e.type==='Individual'&&e.status!=='deleted'&&Array.isArray(e.memberIds)&&e.memberIds.length===1&&String(e.memberIds[0])===String(p.id));
      if(exists){
        exists.style=exists.style||c.anyoStyle||'Traditional';
        exists.weapon=exists.weapon||c.anyoWeapon||'Any';
        continue;
      }
      const count=data.anyoEntries.filter(e=>String(e.categoryId)===String(c.id)&&e.type==='Individual'&&e.status!=='deleted').length+1;
      data.anyoEntries.push({
        id:uid(),
        number:'IND-'+String(count).padStart(3,'0'),
        type:'Individual',
        categoryId:c.id,
        style:c.anyoStyle||'Traditional',
        weapon:c.anyoWeapon||'Any',
        groupReference:'',
        memberIds:[p.id],
        status:'active'
      });
    }
  }
}
function eligible(p,c){const a=age(p.age ?? p.birth);if(a===''||a<c.ageFrom||a>c.ageTo)return false;if(c.sex&&c.sex!=='Mixed'&&c.sex!==p.sex)return false;const ev=c.event||'';if(ev==='Arnis Anyo'){const e=p.events||{};if(c.anyoType==='Individual'&&!e.anyoIndividual)return false;if(c.anyoType==='Synchronized'&&!e.anyoTeam)return false;if(c.anyoType==='Mixed')return false;const style=c.anyoStyle||'Traditional';const styleFlag=style==='Traditional'?e.anyoTraditional:e.anyoNonTraditional;if(styleFlag===false)return false;const weapons=anyoStyleWeapons(e,style,c.anyoType==='Individual'?'Individual':'Synchronized');if(c.anyoWeapon&&c.anyoWeapon!=='Any'&&!weapons.includes(c.anyoWeapon))return false;return true}if(ev==='Livestick')return p.events?.livestick===true&&p.weight>=c.weightFrom&&p.weight<=c.weightTo;if(!eCombat(p))return false;return p.weight>=c.weightFrom&&p.weight<=c.weightTo}function eCombat(p){return p.events?.combat!==false&&(p.events?.combat===true||!p.events)}
function showPage(id){const page=$(id);if(!page)return;document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));page.classList.add('active');document.querySelectorAll('.nav-item[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===id));const title=page.querySelector('.page-heading h2')?.textContent||({'dashboardPage':'Dashboard','bracketPage':'Brackets','anyoPage':'Anyo','queuePage':'Match Queue','resultsPage':'Results','reportsPage':'Reports'}[id]||'RADIUM');if($('topPageTitle'))$('topPageTitle').textContent=title;renderAll(id)}
function renderAll(){ensureIndividualAnyoEntries();renderDashboard();renderSetup();window.RADIUM_DRAW_LOTS?.refreshVisibility?.();renderTeamSelect();renderPlayers();renderTeams();renderCategories();renderCategorySelect();renderBracket();renderAnyo();renderAnyoEntryForm();renderQueue();renderMatchFlow();renderResults();renderReports()}
document.querySelectorAll('.nav-item[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));$('resetAllBtn').onclick=resetAllData; $('resetTournamentBtn')?.addEventListener('click',resetAllData);
$('sidebarToggle')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'));document.querySelectorAll('.sidebar .nav-item[data-page]').forEach(b=>b.addEventListener('click',()=>{if(window.innerWidth<=800)document.querySelector('.sidebar')?.classList.remove('open')}));$('fullscreenBtn')?.addEventListener('click',()=>document.documentElement.requestFullscreen?.());document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.go));
function renderDashboard(){ $('dashTitle').textContent=data.setup.name||'NEW TOURNAMENT';$('dashMeta').textContent=[data.setup.date,data.setup.venue,data.setup.organizer].filter(Boolean).join(' • ')||'Online tournament control center';const brackets=data.categories.filter(c=>c.bracket);const matches=brackets.flatMap(c=>c.bracket.mode==='single'?[...Array(Math.max(0,c.bracket.players.length-1))]:c.bracket.rounds.flat());const completed=data.results.filter(r=>r.finished).length;const active=matches.length-completed;$('dashStats').innerHTML=[['PLAYERS',data.players.length],['CATEGORIES',data.categories.length],['MATCHES',matches.length],['COMPLETED',completed]].map(x=>`<div class="stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');$('liveCourts').innerHTML=Array.from({length:Number(data.setup.courts)||1},(_,i)=>{const m=data.results.find(r=>r.court===i+1&&!r.finished);return `<div class="activity-row"><b>COURT ${i+1}</b> — ${m?esc(m.blue)+' vs '+esc(m.red):'<span class="muted">AVAILABLE</span>'}</div>`}).join('');$('activity').innerHTML=data.audit.slice(0,7).map(a=>`<div class="activity-row"><b>${new Date(a.time).toLocaleTimeString()}</b> ${esc(a.action)} — ${esc(a.detail)}</div>`).join('')||'<div class="empty">No activity yet.</div>';const checks=[['Tournament setup',!!data.setup.name&&!!data.setup.date&&!!data.setup.venue,'setupPage'],['Teams',data.teams.length>0,'teamsPage'],['Players',data.players.length>0,'playersPage'],['Categories',data.categories.length>0,'categoriesPage'],['Brackets',data.categories.some(c=>c.bracket),'bracketPage']];$('setupChecklist').innerHTML=`<div class="section-header"><div><h3>TOURNAMENT CHECKLIST</h3><div class="muted">Complete these steps before competition.</div></div></div><div class="checklist">${checks.map(x=>`<button class="check-item ${x[1]?'done':''}" data-go="${x[2]}"><span class="check-icon">${x[1]?'✓':'○'}</span><span>${x[0]}</span><span class="check-action">${x[1]?'READY':'SET UP'}</span></button>`).join('')}</div>`;document.querySelectorAll('#setupChecklist [data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.go))}
function isFreeTournament(){return String(data.setup?.billingMode||'PAID').toUpperCase()==='FREE'}
function syncBillingUI(){const free=isFreeTournament(),sel=$('tBillingMode'),help=$('billingModeHelp');if(sel){sel.disabled=!(window.RADIUM_AUTH?.isAdmin?.());if(document.activeElement!==sel)sel.value=free?'FREE':'PAID';}if(help)help.textContent=free?'Free tournament: no registration fees or payment accounting are required.':'Paid tournament: registration fees and accounting are available.';const feeField=$('categoryFeeField'),fee=$('catRegistrationFee'),feeHelp=$('categoryFeeHelp');if(feeField)feeField.style.display=free?'none':'';if(fee){fee.disabled=free;if(free)fee.value=0}if(feeHelp)feeHelp.textContent=free?'Registration is FREE for this tournament.':'';document.body.classList.toggle('free-tournament',free);}
function renderSetup(){const rn=$('resetTournamentName'); if(rn) rn.textContent=data.setup?.name||'NO TOURNAMENT SELECTED';const s=data.setup||{};s.scoreboardLogos=Array.isArray(s.scoreboardLogos)?s.scoreboardLogos.slice(0,4):['','','',''];while(s.scoreboardLogos.length<4)s.scoreboardLogos.push('');data.setup=s;['tName','tDate','tVenue','tOrganizer','tCourts','tDuration','tCombativeRounds','tType','tCompetitionProgram','goldPts','silverPts','bronzePts','officialPin'].forEach(id=>{const el=$(id);if(el&&document.activeElement!==el){const k={tName:'name',tDate:'date',tVenue:'venue',tOrganizer:'organizer',tCourts:'courts',tDuration:'duration',tCombativeRounds:'combativeRounds',tType:'type',tCompetitionProgram:'competitionProgram',goldPts:'gold',silverPts:'silver',bronzePts:'bronze',officialPin:'pin'}[id];el.value=s[k]??''}});renderScoreboardLogoManager();syncBillingUI()}
async function loadScoreboardLogoRecords(){
  const tid=window.RADIUM_CLOUD?.getId?.();if(!tid||!window.RADIUM_DB)return [];
  try{const r=await window.RADIUM_DB.select('scoreboard_logos',{select:'id,slot,storage_path,file_name,mime_type,width,height,display_mode',eq:{tournament_id:tid}});if(r.error)throw r.error;return r.data||[]}catch(e){console.warn('Scoreboard branding load failed:',e);return []}
}
function renderScoreboardLogoManager(){const host=$('scoreboardLogoManager');if(!host)return;const can=!!(window.RADIUM_AUTH?.isAdmin?.()||window.RADIUM_AUTH?.isManager?.());host.querySelectorAll('input[type=file]').forEach(i=>i.disabled=!can);host.querySelectorAll('[data-logo-remove]').forEach(b=>b.disabled=!can);const logos=Array.isArray(data.setup?.scoreboardLogos)?data.setup.scoreboardLogos:['','','',''];host.querySelectorAll('[data-logo-slot]').forEach((card,i)=>{const src=logos[i]||'';const img=card.querySelector('[data-logo-preview]');const empty=card.querySelector('[data-logo-empty]');const remove=card.querySelector('[data-logo-remove]');if(img){img.src=src||'';img.style.display=src?'':'none'}if(empty)empty.style.display=src?'none':'';if(remove)remove.style.display=src?'':'none';card.classList.toggle('has-logo',!!src)});const note=$('scoreboardLogoPermission');if(note)note.textContent=can?'Tournament Manager or Admin can upload, replace, or remove scoreboard logos. Each logo has a permanent ID and is stored as a scoreboard branding asset.':'Only Tournament Manager or Admin can change scoreboard logos.';loadScoreboardLogoRecords().then(rows=>{if(!rows.length)return;rows.forEach(r=>{const idx=Number(r.slot)-1;if(idx>=0&&idx<4&&r.storage_path&&window.RADIUM_DB?.state?.client){const {data:u}=window.RADIUM_DB.state.client.storage.from('radium-scoreboard-logos').getPublicUrl(r.storage_path);if(u?.publicUrl){data.setup.scoreboardLogos[idx]=u.publicUrl;const card=host.querySelector(`[data-logo-slot="${idx}"]`);const img=card?.querySelector('[data-logo-preview]');const empty=card?.querySelector('[data-logo-empty]');if(img){img.src=u.publicUrl;img.style.display=''}if(empty)empty.style.display='none';card?.classList.add('has-logo')}}});});}
async function setupScoreboardLogoUpload(index,file){if(!(window.RADIUM_AUTH?.isAdmin?.()||window.RADIUM_AUTH?.isManager?.()))return alert('Only Tournament Manager or Admin can change scoreboard logos.');if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))return alert('Use PNG, JPEG, or WebP images only.');if(file.size>1024*1024)return alert('Each scoreboard logo must be 1 MB or smaller.');const tid=window.RADIUM_CLOUD?.getId?.();if(!tid||!window.RADIUM_DB?.state?.client)return alert('Select a tournament before changing scoreboard logos.');try{const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=URL.createObjectURL(file)});if(img.width<32||img.height<32)return alert('Logo image is too small. Use at least 32×32 pixels.');const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${tid}/${index+1}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;const storage=window.RADIUM_DB.state.client.storage.from('radium-scoreboard-logos');const up=await storage.upload(path,file,{contentType:file.type,upsert:false,cacheControl:'31536000'});if(up.error)throw up.error;const pub=storage.getPublicUrl(path)?.data?.publicUrl||'';const old=await window.RADIUM_DB.select('scoreboard_logos',{select:'id,storage_path',eq:{tournament_id:tid,slot:index+1},limit:1});if(old.error)throw old.error;if(old.data?.[0]?.storage_path&&old.data[0].storage_path!==path)await storage.remove([old.data[0].storage_path]);const row={tournament_id:tid,slot:index+1,storage_path:path,file_name:file.name,mime_type:file.type,width:img.width,height:img.height,display_mode:'contain',created_by:window.RADIUM_AUTH.user?.id||null,updated_at:new Date().toISOString()};let rr;if(old.data?.[0])rr=await window.RADIUM_DB.update('scoreboard_logos',row,{id:old.data[0].id});else rr=await window.RADIUM_DB.insert('scoreboard_logos',row);if(rr.error)throw rr.error;data.setup.scoreboardLogos[index]=pub;renderScoreboardLogoManager();save();toast(`Scoreboard logo ${index+1} saved. Permanent logo ID assigned by RADIUM.`)}catch(e){console.error('Logo upload failed:',e);alert('The scoreboard logo could not be saved. Please check the tournament connection and try again. '+(e?.message||e));}}
async function removeScoreboardLogo(index){if(!(window.RADIUM_AUTH?.isAdmin?.()||window.RADIUM_AUTH?.isManager?.()))return;const tid=window.RADIUM_CLOUD?.getId?.();if(!tid)return;try{const q=await window.RADIUM_DB.select('scoreboard_logos',{select:'id,storage_path',eq:{tournament_id:tid,slot:index+1},limit:1});if(q.error)throw q.error;if(q.data?.[0]){const path=q.data[0].storage_path;if(path)await window.RADIUM_DB.state.client.storage.from('radium-scoreboard-logos').remove([path]);const d=await window.RADIUM_DB.remove('scoreboard_logos',{id:q.data[0].id});if(d.error)throw d.error;}data.setup.scoreboardLogos[index]='';renderScoreboardLogoManager();save();toast(`Scoreboard logo ${index+1} removed.`)}catch(e){console.error('Logo removal failed:',e);alert('The scoreboard logo could not be removed. Please check the tournament connection. '+(e?.message||e));}}

function bindScoreboardLogoManager(){document.querySelectorAll('[data-logo-file]').forEach(input=>{input.addEventListener('change',()=>{const i=Number(input.dataset.logoFile);setupScoreboardLogoUpload(i,input.files?.[0]);input.value=''})});document.querySelectorAll('[data-logo-remove]').forEach(btn=>btn.addEventListener('click',()=>removeScoreboardLogo(Number(btn.dataset.logoRemove))))}
$('tBillingMode')?.addEventListener('change',()=>{if(!(window.RADIUM_AUTH?.isAdmin?.())){alert('Only Admin can change the tournament billing type.');syncBillingUI();return}syncBillingUI()});
$('saveSetup').onclick=async()=>{const tournamentName=$('tName').value.trim();if(!tournamentName)return alert('Tournament name is required.');const requestedBilling=String($('tBillingMode')?.value||data.setup.billingMode||'PAID').toUpperCase()==='FREE'?'FREE':'PAID';if(requestedBilling!==String(data.setup.billingMode||'PAID').toUpperCase()&&!(window.RADIUM_AUTH?.isAdmin?.()))return alert('Only Admin can change the tournament billing type.');data.setup={...data.setup,name:tournamentName,date:$('tDate').value,venue:$('tVenue').value.trim(),organizer:$('tOrganizer').value.trim(),courts:Math.max(1,Number($('tCourts').value)||1),duration:Math.max(30,Number($('tDuration').value)||60),combativeRounds:Number($('tCombativeRounds')?.value)===1?1:3,type:$('tType').value,competitionProgram:$('tCompetitionProgram').value==='DEPED_PEKAF'?'DEPED_PEKAF':'GENERAL',gold:Math.max(0,Number($('goldPts').value)||0),silver:Math.max(0,Number($('silverPts').value)||0),bronze:Math.max(0,Number($('bronzePts').value)||0),pin:$('officialPin').value,billingMode:requestedBilling,currency:'PHP'};if(data.setup.billingMode==='FREE'){data.categories.forEach(c=>c.registrationFee=0);try{const tid=window.RADIUM_CLOUD?.getId?.();if(tid&&window.RADIUM_DB){const u=await window.RADIUM_DB.update('category_registrations',{fee_amount:0},{tournament_id:tid});if(u.error)throw u.error;}}catch(e){return alert('Could not update registration fees for this FREE tournament. '+(e?.message||e));}}log('SETUP SAVED',data.setup.name+' • '+data.setup.billingMode);save();toast(data.setup.billingMode==='FREE'?'Free tournament setup saved':'Tournament setup saved');syncBillingUI()};
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
  let regs=[],attendance=[];
  if(tid&&window.RADIUM_DB){
    try{
      const [rr,aa]=await Promise.all([
        window.RADIUM_DB.select('category_registrations',{select:'id,player_id,category_id,anyo_entry_id,status,team_id',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('team_participations',{select:'team_id,status',eq:{tournament_id:tid}})
      ]);
      regs=rr.data||[]; attendance=aa.data||[];
    }catch(e){console.warn('Player status read failed:',e)}
  }
  const attMap=new Map(attendance.map(x=>[String(x.team_id),String(x.status||'EXPECTED')]));
  const byPlayer=new Map();
  regs.forEach(r=>{if(!r.player_id)return;const k=String(r.player_id);if(!byPlayer.has(k))byPlayer.set(k,[]);byPlayer.get(k).push(r)});
  const statusBadge=st=>`<span class="mode-badge status-${String(st||'ACTIVE').toLowerCase().replace(/_/g,'-')}">${esc(st||'ACTIVE')}</span>`;
  const rows=data.players.filter(p=>{const t=team(p.teamId)?.name||'';return [p.id,p.number,p.name,t].join(' ').toLowerCase().includes(q)}).map(p=>{
    const rs=byPlayer.get(String(p.id))||[];
    const statusHtml=rs.length?rs.map(r=>{const c=cat(r.categoryId);return `<div>${statusBadge(r.status)} <small>${esc(c?.name||'Registration')}</small></div>`}).join(''):'<span class="muted">NO REGISTRATION RECORD</span>';
    const cs=data.categories.filter(c=>eligible(p,c)).map(c=>c.name).join(', ')||'—';
    const att=attMap.get(String(p.teamId))||'EXPECTED';
    const action=readOnly?'<span class="muted">VIEW ONLY</span>':`<button class="btn small" onclick="editPlayer('${p.id}')">EDIT</button> <button class="btn small danger" onclick="deletePlayer('${p.id}')">DELETE</button>`;
    return `<tr><td>${esc(p.number)}</td><td><b>${esc(p.name)}</b>${p.nick?'<br><small>'+esc(p.nick)+'</small>':''}</td><td>${esc(p.sex)}</td><td>${age(p.age ?? p.birth)}</td><td>${Number.isFinite(Number(p.weight))?Number(p.weight).toFixed(1)+' kg':'—'}</td><td>${esc(team(p.teamId)?.name||'—')}<br>${statusBadge(att)}</td><td>${statusHtml}</td><td>${esc(cs)}</td><td>${action}</td></tr>`;
  }).join('');
  $('playersTable').innerHTML=rows||'<tr><td colspan="9" class="empty">No players.</td></tr>';
}

window.editPlayer=id=>{if(['TABLE_OFFICIAL','ACCOUNTANT'].includes(String(window.RADIUM_AUTH?.role||'').toUpperCase()))return alert('This staff role has view-only player access.');const p=player(id);if(!p)return;$('playerId').value=p.id;$('pId').value=p.number;$('pName').value=p.name;$('pNick').value=p.nick;$('pSeed').value=p.seed||'';$('pSex').value=p.sex;$('pAge').value=age(p.age ?? p.birth);$('pWeight').value=p.weight;$('pTeam').value=p.teamId;$('pCoach').value=p.coach;$('pPhoto').value=p.photo; if($('pCombat'))$('pCombat').checked=!!p.events?.combat; if($('pAnyoIndividual'))$('pAnyoIndividual').checked=!!p.events?.anyoIndividual; if($('pAnyoTeam'))$('pAnyoTeam').checked=!!p.events?.anyoTeam; if($('pLivestick'))$('pLivestick').checked=!!p.events?.livestick; if($('pAnyoTraditional'))$('pAnyoTraditional').checked=Array.isArray(p.events?.anyoTraditionalWeapons)?p.events.anyoTraditionalWeapons.length>0:!!p.events?.anyoTraditional; if($('pAnyoNonTraditional'))$('pAnyoNonTraditional').checked=Array.isArray(p.events?.anyoNonTraditionalWeapons)?p.events.anyoNonTraditionalWeapons.length>0:!!p.events?.anyoNonTraditional; setAnyoComboChecks('pInd',p.events?.anyoIndividualEvents||legacyStyleCombos(p.events).filter(x=>p.events?.anyoIndividual));setAnyoComboChecks('pSync',p.events?.anyoSynchronizedEvents||legacyStyleCombos(p.events).filter(x=>p.events?.anyoTeam));togglePlayerAnyoWeapon();showPage('playersPage')};window.deletePlayer=id=>{if(['TABLE_OFFICIAL','ACCOUNTANT'].includes(String(window.RADIUM_AUTH?.role||'').toUpperCase()))return alert('This staff role has view-only player access.');if(data.locked)return alert('Unlock first');if(confirm('Delete player?')){data.players=data.players.filter(p=>p.id!==id);log('PLAYER DELETED',id);save();renderAll()}};
function anyoCategoryEntries(){return data.categories.filter(c=>isAnyoEvent(c)&&['Synchronized','Mixed'].includes(c.anyoType))}
function renderAnyoEntryForm(){const cs=anyoCategoryEntries();const sel=$('anyoEntryCategory');if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">SELECT GROUP ANYO CATEGORY</option>'+cs.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} • ${esc(c.anyoType)} • ${esc(c.anyoStyle)} • ${esc(c.anyoWeapon)}</option>`).join('');if(cs.some(c=>c.id===current))sel.value=current;else if(cs[0])sel.value=cs[0].id;const c=cat(sel.value);const isMixed=c?.anyoType==='Mixed';$('anyoEntryMember3Field').style.display=isMixed?'none':'';['anyoEntryMember1','anyoEntryMember2','anyoEntryMember3'].forEach((id,i)=>{const el=$(id);if(!el)return;const prev=el.value;el.innerHTML='<option value="">SELECT PLAYER</option>'+data.players.filter(p=>{if(!c)return true;if(!p.events?.anyoTeam)return false;const style=c.anyoStyle||'Traditional',weapons=anyoStyleWeapons(p.events,style,'Synchronized');return (c.sex==='Mixed'||p.sex===c.sex)&&weapons.includes(c.anyoWeapon)}).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} • ${sexLabel(p.sex)} • ${esc(team(p.teamId)?.name||'No Team')}</option>`).join('');if([...el.options].some(o=>o.value===prev))el.value=prev;});renderAnyoEntriesTable()}
function renderAnyoEntriesTable(){const host=$('anyoEntriesTable');if(!host)return;const rows=(data.anyoEntries||[]).filter(e=>['Synchronized','Mixed'].includes(e.type)).map(e=>{const c=cat(e.categoryId);const members=(e.memberIds||[]).map(id=>player(id)?.name||id).join(' + ');return `<tr><td class="anyo-entry-id">${esc(e.number||e.id)}</td><td class="anyo-entry-type">${esc(e.type)}</td><td>${esc(c?.name||e.categoryId)}</td><td>${esc(e.style)}</td><td>${esc(e.weapon)}</td><td>${esc(e.groupReference||'—')}</td><td class="anyo-entry-members">${esc(members)}</td><td><button class="btn small danger" onclick="deleteAnyoEntry('${esc(e.id)}')">DELETE</button></td></tr>`}).join('');host.innerHTML=rows||'<tr><td colspan="8" class="empty">No Synchronized/Mixed entries registered.</td></tr>'}
$('anyoEntryCategory')?.addEventListener('change',renderAnyoEntryForm);$('anyoEntryMember1')?.addEventListener('change',()=>{});$('anyoEntryMember2')?.addEventListener('change',()=>{});$('anyoEntryMember3')?.addEventListener('change',()=>{});
$('clearAnyoEntry')?.addEventListener('click',()=>{['anyoEntryMember1','anyoEntryMember2','anyoEntryMember3'].forEach(id=>{if($(id))$(id).value=''});renderAnyoEntryForm()});
$('saveAnyoEntry')?.addEventListener('click',()=>{if(data.locked)return alert('Tournament is locked. Unlock with official PIN.');const c=cat($('anyoEntryCategory')?.value);if(!c)return alert('Select a Synchronized or Mixed Anyo category.');const ids=[$('anyoEntryMember1')?.value,$('anyoEntryMember2')?.value,$('anyoEntryMember3')?.value].filter(Boolean);const unique=[...new Set(ids)];const needed=c.anyoType==='Mixed'?2:2;if(ids.length!==needed&&c.anyoType==='Mixed')return alert('Mixed Anyo requires exactly 2 players: 1 male and 1 female.');if((c.anyoType==='Synchronized')&&(ids.length<2||ids.length>3))return alert('Synchronized Anyo requires 2 or 3 players.');if(unique.length!==ids.length)return alert('A player cannot be registered twice in the same Anyo entry.');const ps=ids.map(id=>player(id)).filter(Boolean);if(ps.length!==ids.length)return alert('One or more selected players could not be found.');if(c.anyoType==='Mixed'&&!(ps.some(p=>p.sex==='Male')&&ps.some(p=>p.sex==='Female')))return alert('Mixed Anyo requires exactly one male and one female.');if(c.anyoType==='Synchronized'&&c.sex!=='Mixed'&&!ps.every(p=>p.sex===c.sex))return alert('All Synchronized Anyo members must match the category division.');for(const p of ps){if(!p.events?.anyoTeam)return alert(`${p.name} is not registered for Synchronized Anyo. Edit the player first.`);const weapons=anyoStyleWeapons(p.events,c.anyoStyle||'Traditional','Synchronized');if(!weapons.includes(c.anyoWeapon))return alert(`${p.name} is not registered for ${c.anyoStyle} • ${c.anyoWeapon}.`);if(age(p.age??p.birth)<Number(c.ageFrom)||age(p.age??p.birth)>Number(c.ageTo))return alert(`${p.name} is outside the category age range.`);}const id=uid();const prefix=c.anyoType==='Mixed'?'MA':'SA';const number=prefix+'-'+String((data.anyoEntries||[]).filter(e=>e.categoryId===c.id).length+1).padStart(3,'0');data.anyoEntries.push({id,number,type:c.anyoType,categoryId:c.id,style:c.anyoStyle,weapon:c.anyoWeapon,memberIds:ids,groupReference:'',status:'active'});log('ANYO ENTRY REGISTERED',`${number} • ${c.name}`);renderAll();toast(`${c.anyoType} Anyo entry registered.`)});
window.deleteAnyoEntry=id=>{if(data.locked)return alert('Unlock first');const e=(data.anyoEntries||[]).find(x=>x.id===id);if(!e)return;if(confirm('Delete this Anyo entry?')){data.anyoEntries=data.anyoEntries.filter(x=>x.id!==id);data.anyoResults=(data.anyoResults||[]).filter(r=>r.entryId!==id);log('ANYO ENTRY DELETED',e.number||id);renderAll()}};
$('saveTeam').onclick=()=>{if(data.locked)return alert('Unlock first');const name=$('teamName').value.trim();if(!name)return alert('Team name required');data.teams.push({id:uid(),name,coach:$('teamCoach').value.trim()});$('teamName').value='';$('teamCoach').value='';log('TEAM CREATED',name);save();renderAll();toast('Team saved')};
function medalCounts(tid){return data.medals.filter(m=>m.teamId===tid).reduce((a,r)=>{if(r.medal)a[r.medal]++;return a},{gold:0,silver:0,bronze:0})}
function renderTeams(){const rows=data.teams.map(t=>{const m=medalCounts(t.id),pts=m.gold*data.setup.gold+m.silver*data.setup.silver+m.bronze*data.setup.bronze,n=data.players.filter(p=>p.teamId===t.id).length;return `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.coach)}</td><td>${n}</td><td>${m.gold}</td><td>${m.silver}</td><td>${m.bronze}</td><td>${pts}</td><td><button class="btn small danger" onclick="deleteTeam('${t.id}')">DELETE</button></td></tr>`}).join('');$('teamsTable').innerHTML=rows||'<tr><td colspan="8" class="empty">No teams.</td></tr>'}window.deleteTeam=id=>{if(data.locked)return alert('Unlock first');if(data.players.some(p=>p.teamId===id))return alert('Cannot delete a team with players. Reassign players first.');if(confirm('Delete team?')){data.teams=data.teams.filter(t=>t.id!==id);save();renderAll()}};
function syncCategoryFields(){const ev=$('catEvent')?.value;const anyo=ev==='Arnis Anyo';const live=ev==='Livestick';['anyoDivisionField','anyoStyleField','anyoWeaponField'].forEach(id=>{const el=$(id);if(el)el.style.display=anyo?'':'none'});['weightFromField','weightToField'].forEach(id=>{const el=$(id);if(el)el.style.display=anyo?'none':''});if($('drawField'))$('drawField').style.display=anyo?'none':'';const type=$('catAnyoType')?.value||'Individual';if($('catSex')){const mix=$('catSex').querySelector('option[value="Mixed"]');if(mix)mix.disabled=anyo&&type!=='Mixed';if(anyo&&type==='Mixed')$('catSex').value='Mixed';else if(anyo&&$('catSex').value==='Mixed')$('catSex').value='Male';}if($('anyoCategoryHelp'))$('anyoCategoryHelp').textContent=anyo?'Anyo: Individual, Synchronized (2–3), or Mixed (1 male + 1 female) × Traditional/Non-Traditional × Weapon.':live?'Livestick: Boys/Girls divisions with age and weight ranges.':'Combative: Boys/Girls/Mixed divisions with age and weight ranges.'}
function saveCategory(){if(data.locked)return alert('Unlock first');const n=$('catName').value.trim(),af=Number($('catAgeFrom').value),at=Number($('catAgeTo').value),wf=Number($('catWeightFrom').value)||0,wt=Number($('catWeightTo').value)||999;if(!n||!Number.isFinite(af)||!Number.isFinite(at)||af>at)return alert('Complete valid age ranges');const ev=$('catEvent').value;const type=ev==='Arnis Anyo'?$('catAnyoType').value:'';if(ev!=='Arnis Anyo'&&(!Number.isFinite(wf)||!Number.isFinite(wt)||wf>wt))return alert('Complete a valid weight range');if(ev==='Arnis Anyo'&&type==='Mixed'&&$('catSex').value!=='Mixed')return alert('Mixed Anyo category must use Mixed division.');if(ev==='Arnis Anyo'&&type==='Synchronized'&&$('catSex').value==='Mixed')return alert('Synchronized Anyo category must use Boys or Girls division.');const id=$('catId').value||uid(),x={id,name:n,sex:$('catSex').value,event:ev,anyoType:type,anyoStyle:ev==='Arnis Anyo'?$('catAnyoStyle').value:'',anyoWeapon:ev==='Arnis Anyo'?$('catAnyoWeapon').value:'Any',ageFrom:af,ageTo:at,weightFrom:wf,weightTo:wt,weightRequirement:$('catWeightRequirement')?.value||'not_required',registrationFee:isFreeTournament()?0:Math.max(0,Number($('catRegistrationFee')?.value)||0),draw:ev==='Arnis Anyo'?'random':$('catDraw').value,bracket:cat(id)?.bracket||null};const old=cat(id);if(old)Object.assign(old,x);else data.categories.push(x);data.activeCategory=id;log(old?'CATEGORY UPDATED':'CATEGORY CREATED',n);clearCategory();renderAll();toast('Category saved')}$('saveCategory').onclick=saveCategory;$('catEvent').onchange=syncCategoryFields;$('catAnyoType').onchange=syncCategoryFields;$('catSex').onchange=syncCategoryFields;$('catDraw').onchange=()=>{const v=$('catDraw').value;$('drawHelp').textContent=v==='seed'?'Uses the Seed field to place higher seeds first.':v==='team'?'Spreads players by team to reduce same-team Round 1 matches.':'Randomly places eligible players.'};$('clearCategory').onclick=clearCategory;function clearCategory(){['catId','catName','catAgeFrom','catAgeTo','catWeightFrom','catWeightTo'].forEach(id=>$(id).value='');$('catSex').value='Male';$('catEvent').value='Padded Stick';$('catAnyoType').value='Individual';$('catAnyoStyle').value='Traditional';$('catAnyoWeapon').value='Any';$('catDraw').value='random';if($('catRegistrationFee'))$('catRegistrationFee').value=isFreeTournament()?0:400;if($('catWeightRequirement'))$('catWeightRequirement').value='not_required';syncCategoryFields()}const DEPED_PEKAF_COMBATIVES_12_17={Male:[{name:'Pinweight',from:43,to:47},{name:'Bantamweight',from:47.01,to:51},{name:'Featherweight',from:51.01,to:55},{name:'Extra Lightweight',from:55.01,to:60},{name:'Half Lightweight',from:60.01,to:65}],Female:[{name:'Pinweight',from:37,to:40},{name:'Bantamweight',from:40.01,to:44},{name:'Featherweight',from:44.01,to:48},{name:'Extra Lightweight',from:48.01,to:52},{name:'Half Lightweight',from:52.01,to:56}]};
function addDepEdPEKAFCombativesPreset(){if(data.locked)return alert('Unlock first');const added=[];for(const sex of ['Male','Female'])for(const w of DEPED_PEKAF_COMBATIVES_12_17[sex]){const ageFrom=12,ageTo=17,eventName='Padded Stick';const name=`${sexLabel(sex)} ${ageFrom}–${ageTo} • ${w.name} • DepEd–PEKAF Combatives`;if(!data.categories.some(c=>c.event===eventName&&c.preset==='DEPED-PEKAF-COMBATIVES-12-17'&&c.sex===sex&&c.weightFrom===w.from&&c.weightTo===w.to)){data.categories.push({id:uid(),name,sex,event:eventName,anyoType:'',anyoStyle:'',anyoWeapon:'Any',ageFrom,ageTo,weightFrom:w.from,weightTo:w.to,draw:'random',bracket:null,preset:'DEPED-PEKAF-COMBATIVES-12-17',weightClass:w.name,weightRequirement:'required'});added.push(name)}}save();renderAll();toast(added.length?`${added.length} DepEd–PEKAF Combatives categories added.`:'DepEd–PEKAF Combatives categories are already present.')}
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
  $('categoriesList').innerHTML=groups.map(([title,items])=>`<div class="category-group"><div class="category-group-title"><h3>${esc(title)}</h3><span class="badge">${items.length} categories</span></div>${items.map(c=>`<div class="category-row"><div><b>${esc(c.name)}</b><div class="muted">${sexLabel(c.sex)} • ${c.event}${c.event==='Arnis Anyo'&&c.anyoType?' • '+c.anyoType:''}${c.event==='Arnis Anyo'&&c.anyoStyle?' • '+c.anyoStyle:''}${c.anyoWeapon&&c.anyoWeapon!=='Any'?' • '+c.anyoWeapon:''} • ${c.ageFrom}-${c.ageTo} yrs • ${c.event==='Arnis Anyo'?'No weight limit':c.weightFrom+'-'+c.weightTo+' kg'} • ${isAnyoEvent(c)&&c.anyoType!=='Individual'?(data.anyoEntries||[]).filter(e=>e.categoryId===c.id&&e.status!=='deleted').length:data.players.filter(p=>eligible(p,c)).length} eligible • ${c.bracket?.locked?'BRACKET LOCKED':''}</div></div><div><button class="btn small" onclick="editCategory('${c.id}')">EDIT</button> <button class="btn small" onclick="openCategory('${c.id}')">OPEN</button> <button class="btn small danger" onclick="deleteCategory('${c.id}')">DELETE</button></div></div>`).join('')||'<div class="empty">No categories in this group.</div>'}</div>`).join('');
}
window.editCategory=id=>{const c=cat(id);$('catId').value=id;$('catName').value=c.name;$('catSex').value=c.sex;$('catEvent').value=c.event;$('catAnyoType').value=c.anyoType||'Individual';$('catAnyoStyle').value=c.anyoStyle||'Traditional';$('catAnyoWeapon').value=c.anyoWeapon||'Any';$('catAgeFrom').value=c.ageFrom;$('catAgeTo').value=c.ageTo;$('catWeightFrom').value=c.weightFrom;$('catWeightTo').value=c.weightTo;if($('catRegistrationFee'))$('catRegistrationFee').value=isFreeTournament()?0:(c.registrationFee??400);syncBillingUI();if($('catWeightRequirement'))$('catWeightRequirement').value=c.weightRequirement||'not_required';$('catDraw').value=c.draw;showPage('categoriesPage')};window.openCategory=id=>{const c=cat(id);if(!c)return alert('Category not found.');data.activeCategory=id;save();if(isAnyoEvent(c)){openAnyoCategoryDetail(id)}else{showPage('bracketPage')}};window.deleteCategory=id=>{if(data.locked)return alert('Unlock first');if(confirm('Delete category and its bracket?')){data.categories=data.categories.filter(c=>c.id!==id);if(data.activeCategory===id)data.activeCategory=null;save();renderAll()}};

function renderMatchFlow(){
  const card=$('matchFlowCard'),sel=$('matchFlowSelect'),badge=$('matchFlowBadge');
  if(!card||!sel)return;
  const deped=String(data.setup?.competitionProgram||'').toUpperCase()==='DEPED_PEKAF';
  card.style.display=deped?'':'none';
  sel.value=data.setup?.matchFlow||'ROUND_CATEGORY';
  if(badge){const labels={ROUND_CATEGORY:'ROUND BY ROUND',ROUND_BOYS_FIRST:'ROUND + BOYS FIRST',ROUND_GIRLS_FIRST:'ROUND + GIRLS FIRST',BOYS_FIRST:'BOYS FIRST',GIRLS_FIRST:'GIRLS FIRST'};badge.textContent=labels[sel.value]||'ROUND BY ROUND';}
}
$('saveMatchFlow')?.addEventListener('click',async()=>{if(!['admin','tournament_manager'].includes(String(window.RADIUM_AUTH?.role||'').toLowerCase()))return alert('Admin or Tournament Manager account required.');data.setup.matchFlow=$('matchFlowSelect')?.value||'ROUND_CATEGORY';save();const ok=await window.RADIUM_CLOUD?.flush?.();if(ok===false)return alert('Match flow was not confirmed by Supabase.');renderMatchFlow();renderQueue();toast('Match flow saved to Supabase queue settings.');});
$('matchFlowSelect')?.addEventListener('change',renderMatchFlow);
function renderCategorySelect(){const s=$('bracketCategory');s.innerHTML='<option value="">SELECT COMBAT CATEGORY</option>'+data.categories.filter(c=>!isAnyoEvent(c)).map(c=>`<option value="${c.id}">${esc(c.name)} — ${isAnyoEvent(c)&&c.anyoType!=='Individual'?(data.anyoEntries||[]).filter(e=>e.categoryId===c.id&&e.status!=='deleted').length:data.players.filter(p=>eligible(p,c)).length} eligible</option>`).join('');if(data.activeCategory&&data.categories.some(c=>c.id===data.activeCategory))s.value=data.activeCategory}
$('bracketCategory').onchange=e=>{data.activeCategory=e.target.value||null;save();renderBracket()};
function createMatch(red=null,blue=null){return{id:uid(),red,blue,redScore:0,blueScore:0,completed:false,winner:null,redBye:false,blueBye:false,court:null,matchFormat:Number(data?.setup?.combativeRounds)===1?'single':'best3',history:[]}}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function playerSeedForCategory(p,c){const cs=p?.categorySeeds?.[c?.id];const n=Number(cs?.seed);return Number.isFinite(n)&&n>0?n:(Number.isFinite(Number(p?.seed))&&Number(p.seed)>0?Number(p.seed):null)}
function standardSeedOrder(size){let seeds=[1];for(let n=2;n<=size;n*=2)seeds=seeds.flatMap(x=>[x,n+1-x]);return seeds}
function seedPlayers(ps,c){let a=[...ps];if(c.draw==='seed'){const size=nextPow(a.length);const bySeed=new Map();a.forEach(p=>{const seed=playerSeedForCategory(p,c);if(seed&&seed<=size&&!bySeed.has(seed))bySeed.set(seed,p)});return standardSeedOrder(size).map(seed=>bySeed.get(seed)||null)}if(c.draw==='random')return shuffle(a);if(c.draw==='team'){a.sort((x,y)=>(team(x.teamId)?.name||'').localeCompare(team(y.teamId)?.name||''));let out=[];let teams=[...new Set(a.map(x=>x.teamId))];let k=0;while(a.length){const idx=a.findIndex(p=>p.teamId===teams[k%teams.length]);if(idx>=0)out.push(a.splice(idx,1)[0]);k++}return out}return a}
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
  if(c.draw==='seed'){const seeds=ps.map(p=>playerSeedForCategory(p,c)).filter(Number.isFinite);const unique=new Set(seeds);if(seeds.length!==ps.length||unique.size!==ps.length||Math.min(...seeds)!==1||Math.max(...seeds)!==ps.length)throw Error('Seeded bracket requires every eligible competitor to have a unique seed from 1 to '+ps.length+'. Use Draw Lots or assign category seeds first.');}

  const size=nextPow(ps.length),arr=seedPlayers(ps,c),byes=size-ps.length,firstPairCount=size/2;
  const seededSlots=c.draw==='seed' ? arr : null;
  const byeMatches=c.draw==='seed' ? new Set() : byeMatchIndexes(firstPairCount,byes);
  const rounds=[];
  const byeEntries=[];
  let pi=0;
  let nextDescriptors=[];

  // Build only REAL match records. A BYE is an automatic advancement and is
  // represented in bracket metadata, never as a row in matches.
  for(let mi=0;mi<firstPairCount;mi++){
    const left=(seededSlots?seededSlots[mi*2]:arr[pi++])?.id||null;
    const right=(seededSlots?seededSlots[mi*2+1]:(byeMatches.has(mi)?null:arr[pi++]))?.id||null;
    if(left&&right){
      const m=createMatch(left,right);
      m.firstRoundPosition=mi;
      rounds.push(m);
      nextDescriptors.push({kind:'match',matchId:m.id,count:2,playerId:null});
    }else if(left||right){
      const playerId=left||right;
      byeEntries.push({playerId,targetMatchId:null,targetSlot:null,firstRoundPosition:mi});
      nextDescriptors.push({kind:'player',playerId,count:1,playerId});
    }
  }

  // The first-round real matches need to remain in their own round.
  const firstRound=rounds.splice(0);
  const roundLists=[firstRound];

  // Collapse the bracket tree. A subtree with one player is not a match and
  // simply advances that player into the next real match. Every subtree with
  // two or more players creates exactly one match node.
  while(nextDescriptors.length>1){
    const parents=[];
    const parentDescriptors=[];
    for(let i=0;i<nextDescriptors.length;i+=2){
      const left=nextDescriptors[i],right=nextDescriptors[i+1]||null;
      const total=(left?.count||0)+(right?.count||0);
      if(total===0)continue;
      if(total===1){
        const one=left?.count?left:right;
        parentDescriptors.push({kind:'player',playerId:one.playerId,count:1,playerId:one.playerId});
        continue;
      }
      // Keep the visual orientation used by the reference bracket: when a
      // feeder match meets a BYE player, the feeder winner is the TOP/red
      // side and the BYE player is the BOTTOM/blue side.
      const redPlayer=(left?.kind==='player'&&right?.kind!=='match')?left.playerId:null;
      const bluePlayer=(right?.kind==='player'&&left?.kind!=='match')?right.playerId:
                       (left?.kind==='player'&&right?.kind==='match')?left.playerId:null;
      const m=createMatch(redPlayer,bluePlayer);
      m.nextMatchId=null;
      m.nextSlot=null;
      if(left?.kind==='match'){
        const child=findMatch(roundLists,left.matchId);
        if(child){child.nextMatchId=m.id;child.nextSlot='red';}
      }
      if(right?.kind==='match'){
        const child=findMatch(roundLists,right.matchId);
        if(child){child.nextMatchId=m.id;child.nextSlot=left?.kind==='match'?'blue':'red';}
      }
      // If a BYE player enters this match, remember the exact destination.
      if(left?.kind==='player'){
        const b=byeEntries.find(x=>x.playerId===left.playerId&&!x.targetMatchId);
        if(b){b.targetMatchId=m.id;b.targetSlot=right?.kind==='match'?'blue':'red';}
      }
      if(right?.kind==='player'){
        const b=byeEntries.find(x=>x.playerId===right.playerId&&!x.targetMatchId);
        if(b){b.targetMatchId=m.id;b.targetSlot=left?.kind==='match'?'blue':'blue';}
      }
      parents.push(m);
      parentDescriptors.push({kind:'match',matchId:m.id,count:total,playerId:null});
    }
    if(parents.length)roundLists.push(parents);
    nextDescriptors=parentDescriptors;
  }

  // A six-player bracket becomes [2,2,1] actual matches; five players become
  // [2,1,1]; in all cases the total is exactly players - 1.
  const b={
    mode:'single',size,players:ps.map(p=>p.id),byes,
    rounds:roundLists,
    byeEntries,
    playableMatches:Math.max(0,ps.length-1),
    champion:null,locked:false,createdAt:new Date().toISOString()
  };
  return b;
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
  const cp=await window.RADIUM_DB.select('category_players',{select:'category_id,player_id,seed,status',eq:{category_id:categoryId}});
  if(cp?.error) throw cp.error;
  const categoryPlayers=Array.isArray(cp?.data)?cp.data:[];
  if(!categoryPlayers.length) throw new Error('No players are registered in this category in the tournament data.');
  const pr=await window.RADIUM_DB.select('players',{select:'id,first_name,middle_name,last_name,gender,age,weight,player_number,team_id,status',eq:{tournament_id:tid}});
  if(pr?.error) throw pr.error;
  const playerMap=new Map((Array.isArray(pr?.data)?pr.data:[]).map(x=>[String(x.id),x]));
  const players=[];
  for(const cpRow of categoryPlayers){
    const p=playerMap.get(String(cpRow.player_id));
    if(!p || (p.status && p.status!=='active')) continue;
    players.push({id:p.id,name:[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(' '),sex:p.gender||'',gender:p.gender||'',age:Number(p.age),weight:Number(p.weight),number:p.player_number??'',teamId:p.team_id||null,seed:Number.isFinite(Number(cpRow.seed))?Number(cpRow.seed):null});
  }
  if(players.length<2) throw new Error(`Only ${players.length} eligible player(s) were found in the tournament data. At least 2 are required.`);
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
    const cloudPlayers=await loadBracketPlayersFromSupabase(id);
    const eligibleCount=cloudPlayers.length;
    const hasCompleted=!!c.bracket?.rounds?.some(r=>r.some(m=>m.completed));
    if(c.bracket&&hasCompleted&&!confirm('This category already has completed matches. Regenerating will permanently replace the old bracket, database matches, and category results. Continue?'))return;
    // First remove the old bracket representation and its result records from the
    // local/cloud JSON state. This prevents a stale bracket from being merged back.
    c.bracket=null;
    clearLocalBracketResults(id);
    data.activeCategory=id;
    save();
    await window.RADIUM_CLOUD?.flush?.();
    // Also remove legacy/standalone rows from public.matches. Older versions of
    // RADIUM could leave these rows behind, producing phantom matches such as 119
    // matches for a 10-player category.
    await clearCloudBracketMatches(id);
    // Now create exactly one fresh bracket from the current eligible player list.
    const originalPlayers=data.players;
    try{ data.players=cloudPlayers; c.bracket=buildBracket(c); }
    finally{ data.players=originalPlayers; }
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
    const c=cat(r.categoryId),b=c?.bracket;const rr=Number(r.round),mm=Number(r.match);const ri=Number.isInteger(rr)?rr-1:NaN,mi=Number.isInteger(mm)?mm-1:NaN;const m=(Number.isInteger(ri)&&Number.isInteger(mi))?b?.rounds?.[ri]?.[mi]:null;
    if(!c||!b||!m){console.warn('RADIUM result ignored: match context not found',r);return false;}
    if(m.completed){
      if(r.correction){
        m.redScore=Number(r.redScore)||0;m.blueScore=Number(r.blueScore)||0;m.winner=r.winner;m.history=m.history||[];m.history.push({...r,correctedAt:new Date().toISOString()});
        try{await window.RADIUM_CLOUD?.pull?.()}catch(e){console.warn('Cloud correction refresh:',e)}
        renderAll();
        return true;
      }
      return false;
    }
    if(!r.winner||(r.winner!==m.red&&r.winner!==m.blue)){console.warn('RADIUM result ignored: winner is not one of the bracket fighters',r);return false;}
    m.redScore=Number(r.redScore)||0;m.blueScore=Number(r.blueScore)||0;m.winner=r.winner;m.completed=true;m.history=m.history||[];m.history.push(r);
    if(b.mode==='roundrobin'){const standings={};b.players.forEach(id=>standings[id]={id,w:0,l:0,pts:0});b.rounds.flat().filter(x=>x.completed).forEach(x=>{if(!standings[x.winner])return;standings[x.winner].w++;standings[x.winner].pts+=3;const loser=x.red===x.winner?x.blue:x.red;if(standings[loser])standings[loser].l++});const order=Object.values(standings).sort((a,d)=>d.pts-a.pts||d.w-a.w);if(b.rounds.flat().every(x=>x.completed)&&order.length){b.champion=order[0].id;awardMedal(c.id,order[0].id,'gold');if(order[1])awardMedal(c.id,order[1].id,'silver');if(order[2])awardMedal(c.id,order[2].id,'bronze')}}else advance(b,ri,mi,r.winner);
    data.results=data.results.filter(x=>x.id!==r.id);data.results.unshift({...r,blue:player(m.blue)?.name||m.blue,red:player(m.red)?.name||m.red,category:c.name,categoryId:c.id,teamWinnerId:player(r.winner)?.teamId||'',finished:true});
    if(b.champion===r.winner){const finalLoser=m.red===r.winner?m.blue:m.red;awardMedal(c.id,b.champion,'gold');awardMedal(c.id,finalLoser,'silver');const semi=b.rounds[b.rounds.length-2]||[];semi.forEach(sm=>{if(sm.completed&&sm.winner){const loser=sm.red===sm.winner?sm.blue:sm.red;if(loser&&loser!==finalLoser)awardMedal(c.id,loser,'bronze')}})}
    log('MATCH CONFIRMED',`${c.name} — ${player(m.red)?.name||m.red} vs ${player(m.blue)?.name||m.blue} — winner ${player(r.winner)?.name||r.winner}`);save();renderAll();try{await window.RADIUM_CLOUD?.flush?.()}catch(e){console.warn('Cloud result flush:',e)}return true;
  }catch(e){console.error('RADIUM result processing failed:',e);return false}
}
async function processOneResult(rawKey){const r=window[rawKey];return r?processResultPayload(r):false}
async function processResult(){return window.__RADIUM_PENDING_RESULT_PROMISE||true}
function renderResults(){$('resultsTable').innerHTML=data.results.slice(0,300).map(r=>`<tr><td>${new Date(r.completedAt||r.time||Date.now()).toLocaleString()}</td><td>${esc(r.category)}</td><td>${Number(r.match)}</td><td>${esc(r.blue)}</td><td>${esc(r.red)}</td><td>${r.blueScore}-${r.redScore}</td><td><b>${esc(player(r.winner)?.name||r.winner)}</b></td><td>${esc(r.official||'Scoreboard')}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No confirmed results.</td></tr>';$('auditLog').innerHTML=data.audit.slice(0,100).map(a=>`<div class="activity-row"><b>${new Date(a.time).toLocaleString()}</b> — ${esc(a.action)} — ${esc(a.detail)}</div>`).join('')||'<div class="empty">No audit entries.</div>'}
function reportDivision(category){
  if(!category)return '';
  const preset=String(category.preset||'').toUpperCase();
  const name=String(category.name||'').toUpperCase();
  if(preset==='DEPED-PEKAF-ANYO-ELEMENTARY'||name.startsWith('ELEMENTARY'))return 'Elementary';
  if(preset==='DEPED-PEKAF-ANYO-SECONDARY'||name.startsWith('SECONDARY'))return 'Secondary';
  // DepEd–PEKAF 12–17 combatives are a Secondary competition.
  if(preset==='DEPED-PEKAF-COMBATIVES-12-17')return 'Secondary';
  if(/\bELEMENTARY\b/.test(name))return 'Elementary';
  if(/\bSECONDARY\b/.test(name))return 'Secondary';
  return '';
}
function reportTeamMedals(teamId,division){
  return data.medals.filter(m=>{
    if(String(m.teamId||'')!==String(teamId))return false;
    return reportDivision(cat(m.categoryId))===division;
  }).reduce((a,m)=>{if(m.medal)a[m.medal]++;return a},{gold:0,silver:0,bronze:0});
}
function renderReportDivisionTable(division,teamIds){
  const rows=Array.from(teamIds).map(id=>{
    const t=team(id);if(!t)return null;
    const m=reportTeamMedals(id,division);
    const pts=m.gold*data.setup.gold+m.silver*data.setup.silver+m.bronze*data.setup.bronze;
    return {...t,m,pts};
  }).filter(Boolean).sort((a,b)=>b.pts-a.pts||b.m.gold-a.m.gold||b.m.silver-a.m.silver||b.m.bronze-a.m.bronze||String(a.name).localeCompare(String(b.name)));
  return `<div class="report-division-tally"><h4>${division} Medal Tally</h4><div class="table-wrap"><table><thead><tr><th>RANK</th><th>TEAM</th><th>GOLD</th><th>SILVER</th><th>BRONZE</th><th>POINTS</th></tr></thead><tbody>${rows.map((t,i)=>`<tr><td>${i+1}</td><td>${esc(t.name)}</td><td>${t.m.gold}</td><td>${t.m.silver}</td><td>${t.m.bronze}</td><td>${t.pts}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No registered teams in this division.</td></tr>'}</tbody></table></div></div>`;
}
async function renderReports(){
  const host=$('medalTable');
  const wrap=host?.closest('.table-wrap');
  if(!host||!wrap)return;
  const tid=window.RADIUM_CLOUD?.getId?.();
  const teamIds={Elementary:new Set(),Secondary:new Set()};
  // Build the team list from actual tournament category registrations. This keeps
  // a team in the correct school division and also shows teams with zero medals.
  if(tid&&window.RADIUM_DB){
    try{
      const rr=await window.RADIUM_DB.select('category_registrations',{select:'id,player_id,category_id,anyo_entry_id,status,team_id',eq:{tournament_id:tid}});
      const regs=Array.isArray(rr?.data)?rr.data:[];
      for(const r of regs){
        const status=String(r.status||'ACTIVE').toUpperCase();
        if(['DELETED','WITHDRAWN'].includes(status))continue;
        const div=reportDivision(cat(r.category_id));
        if(!div)continue;
        let teamId=r.team_id||'';
        if(!teamId&&r.player_id)teamId=player(r.player_id)?.teamId||'';
        if(teamId)teamIds[div].add(String(teamId));
      }
    }catch(e){console.warn('Report registration read failed:',e)}
  }
  // Keep already-loaded tournament registrations as a fallback when cloud rows are
  // temporarily unavailable, but still classify them by their actual category.
  if(!teamIds.Elementary.size&&!teamIds.Secondary.size){
    for(const c of data.categories){
      const div=reportDivision(c);if(!div)continue;
      const ids=new Set();
      (c.bracket?.players||[]).forEach(pid=>{const p=player(pid);if(p?.teamId)ids.add(String(p.teamId))});
      ids.forEach(id=>teamIds[div].add(id));
    }
  }
  // The original single-table target is retained only as an anchor for compatibility.
  wrap.innerHTML=renderReportDivisionTable('Elementary',teamIds.Elementary)+renderReportDivisionTable('Secondary',teamIds.Secondary);
  const winners=data.categories.map(c=>{const w=c.bracket?.champion;const div=reportDivision(c);return `<tr><td>${esc(div||'—')}</td><td>${esc(c.name)}</td><td>${esc(w?(player(w)?.name||w):'—')}</td><td>${esc(w?team(player(w)?.teamId)?.name||'—':'—')}</td></tr>`}).join('');
  $('reportBody').innerHTML=`<h3>${esc(data.setup.name)}</h3><p>${esc(data.setup.date)} • ${esc(data.setup.venue)} • ${esc(data.setup.organizer)}</p><p>${data.players.length} players • ${data.categories.length} categories • ${data.results.length} confirmed matches</p><h3>Category Winners</h3><div class="table-wrap"><table><thead><tr><th>DIVISION</th><th>CATEGORY</th><th>WINNER</th><th>TEAM</th></tr></thead><tbody>${winners||'<tr><td colspan="4">No winners yet.</td></tr>'}</tbody></table></div>`;
}
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

load();rebuildAnyoMedals();syncCategoryFields();togglePlayerAnyoWeapon();if(data.locked)document.body.classList.add('locked');renderAll();const __initialParams=new URLSearchParams(location.search);const initialView=__initialParams.get('view');
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
window.__RADIUM_GET_DATA=function(){return data};
window.RADIUM_STATE=()=>data;
window.__RADIUM_SET_DATA=function(next,opts={}){if(!next||typeof next!=='object')return false;const incomingSetup={...(next.setup||{})};if(!incomingSetup.competitionProgram)incomingSetup.competitionProgram='GENERAL';data={...createFreshData(),...next,version:14,setup:{...createFreshData().setup,...incomingSetup},anyoResults:Array.isArray(next.anyoResults)?next.anyoResults:[],weighIns:next.weighIns&&typeof next.weighIns==='object'?next.weighIns:{},anyoEntries:Array.isArray(next.anyoEntries)?next.anyoEntries:[]};normalizeBracketPlayerIds();if(!opts.fromCloud)save();window.RADIUM_DRAW_LOTS?.refreshVisibility?.();return true};
window.renderAll=renderAll;
window.RADIUM_MAIN_READY=true;

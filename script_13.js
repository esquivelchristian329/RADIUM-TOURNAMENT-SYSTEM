
/* RADIUM V8 functional enhancements. Kept isolated so the stable V6 controller remains intact. */
(function(){
  'use strict';
  function el(id){return document.getElementById(id)}
  function ensureData(){
    if(!window.RADIUM_V8_INIT){
      data.mode=data.mode||'ADMIN';
      data.weighIns=data.weighIns&&typeof data.weighIns==='object'?data.weighIns:{};
      data.anyoResults=Array.isArray(data.anyoResults)?data.anyoResults:[];
      window.RADIUM_V8_INIT=true;
    }
  }
  function initEnhancements(){
    try{ensureData();}catch(err){console.warn('V8 enhancements deferred until main controller loads:',err)}
  }
  const pageTitles={controlPage:'Control Center',systemCheckPage:'System Check',weighinPage:'Weigh-In',operatorPage:'Operator Mode',tvPage:'TV Display'};
  const oldShowPage=window.showPage;
  function enhanceShowPage(id){
    if(window.RADIUM_AUTH?.role && !window.RADIUM_AUTH.can(id)){alert('Access restricted for your RADIUM staff role.');return false;}
    if(typeof oldShowPage==='function') oldShowPage(id);
    else {document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));}
    const p=el(id); if(p){const h=p.querySelector('.page-heading h2'); if(el('topPageTitle')&&h)el('topPageTitle').textContent=h.textContent;}
    if(id==='controlPage')renderControl(); if(id==='systemCheckPage')runSystemCheck(); if(id==='weighinPage')renderWeighin(); if(id==='operatorPage')renderOperator(); if(id==='tvPage')renderTV();
  }
  window.showPage=enhanceShowPage;
  document.querySelectorAll('.nav-item[data-page]').forEach(btn=>{btn.onclick=function(e){e.preventDefault();enhanceShowPage(btn.dataset.page)}});
  document.querySelectorAll('[data-go]').forEach(btn=>{btn.onclick=function(e){e.preventDefault();enhanceShowPage(btn.dataset.go)}});
  function toast8(s){if(typeof toast==='function')toast(s);else alert(s)}
  function save8(){if(typeof save==='function')return save();return false}
  function backupPayload(){const x=JSON.parse(JSON.stringify(data));x.autoBackups=[];return x}
  async function autoBackup(reason){ensureData();if(window.RADIUM_SNAPSHOTS?.save){try{await window.RADIUM_SNAPSHOTS.save(reason);renderControl();return true}catch(e){console.warn('Supabase snapshot failed:',e);toast8('Supabase backup could not be created.');return false}}return false}
  window.radiumAutoBackup=autoBackup;
  function renderControl(){ensureData();const badge=el('modeBadge');if(badge){badge.textContent=data.mode==='OFFICIAL'?'OFFICIAL MODE':'ADMIN MODE';badge.className='mode-badge '+(data.mode==='OFFICIAL'?'official':'')}const bs=el('backupStatus');if(bs)bs.textContent='Persistent backups are stored in Supabase.'}
  async function officialPin(){const configured=String(data.setup.pin||data.setup.pinHash||'');if(!configured){alert('Set an Official PIN in SETUP first.');return false}const pin=prompt('Enter Official PIN');if(pin==null)return false;if(data.setup.pin)return pin===data.setup.pin;const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(pin)));const hex=Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');return hex===data.setup.pinHash}
  function setMode(mode){if(mode==='OFFICIAL'){if(!officialPin())return;data.mode='OFFICIAL';document.body.classList.add('official-mode');save8();log('MODE CHANGED','OFFICIAL MODE');toast8('Official mode enabled')}else{if(!officialPin())return;data.mode='ADMIN';document.body.classList.remove('official-mode');save8();log('MODE CHANGED','ADMIN MODE');toast8('Admin mode restored')}renderControl()}
  async function toggleLock8(){if(!data.locked){if(!data.setup.pin&&!data.setup.pinHash)return alert('Set an Official PIN in SETUP first.');data.locked=true;document.body.classList.add('locked');save8();log('TOURNAMENT LOCKED','Official controls locked');toast8('Tournament locked')}else if(String(window.RADIUM_CLOUD?.state?.assignedStatus||'').toLowerCase()==='active'){return alert('Tournament is ACTIVE. The Tournament Manager start lock is permanent; preparation controls cannot be unlocked.')}else if(await officialPin()){data.locked=false;document.body.classList.remove('locked');save8();log('TOURNAMENT UNLOCKED','Official controls unlocked');toast8('Tournament unlocked')}renderControl()}
  el('enterOfficialBtn')?.addEventListener('click',()=>setMode('OFFICIAL'));el('exitOfficialBtn')?.addEventListener('click',()=>setMode('ADMIN'));el('controlLockBtn')?.addEventListener('click',toggleLock8);el('backupNowBtn')?.addEventListener('click',()=>autoBackup('manual snapshot'));
  // Snapshot before high-impact mutations so recovery is always available.
  [['savePlayer','before player change'],['saveTeam','before team change'],['saveCategory','before category change'],['generateBracket','before bracket generation'],['depedCombativesPreset','before DepEd–PEKAF Combatives preset'],['depedAnyoElementaryPreset','before DepEd–PEKAF Elementary Anyo preset'],['depedAnyoSecondaryPreset','before DepEd–PEKAF Secondary Anyo preset']].forEach(function(x){const b=el(x[0]);if(b)b.addEventListener('click',function(){autoBackup(x[1]).catch(e=>console.warn('Supabase pre-snapshot:',e))},true)});el('downloadAutoBackupBtn')?.addEventListener('click',()=>download('RADIUM_AutoBackup_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',JSON.stringify(backupPayload(),null,2),'application/json'));el('controlStartBtn')?.addEventListener('click',()=>el('nextMatchBtn')?.click());el('controlQueueBtn')?.addEventListener('click',()=>enhanceShowPage('queuePage'));el('controlTvBtn')?.addEventListener('click',()=>enhanceShowPage('tvPage'));el('controlResultsBtn')?.addEventListener('click',()=>enhanceShowPage('resultsPage'));
  function runSystemCheck(){ensureData();const tests=[];function add(name,detail,ok,warn){tests.push({name,detail,ok,warn})}
    add('Tournament persistence','Supabase is authoritative; no tournament data is stored in browser storage.',true,false);
    ['dashboardPage','bracketPage','anyoPage','drawLotsPage','queuePage','resultsPage','reportsPage','setupPage','playersPage','teamsPage','categoriesPage','controlPage','systemCheckPage','weighinPage','operatorPage','tvPage'].forEach(id=>add('Page '+id,'Required page exists',!!el(id)));
    ['renderAll','buildBracket','openScore','processResult','addDepEdPEKAFAnyoPreset','saveCategory','renderAnyo','renderQueue','renderDrawLots'].forEach(fn=>add('Function '+fn,typeof window[fn]==='function'||typeof eval('typeof '+fn)!=='undefined','Controller function is loaded',false));
    add('Tournament data','Players: '+data.players.length+' • Teams: '+data.teams.length+' • Categories: '+data.categories.length,!!data&&Array.isArray(data.players)&&Array.isArray(data.categories));
    const invalidCategories=data.categories.filter(c=>!c.id||!c.name||c.ageFrom>c.ageTo).length;add('Category integrity',invalidCategories?invalidCategories+' invalid category records':'All category records valid',!invalidCategories);
    const orphan=data.players.filter(p=>p.teamId&& !team(p.teamId)).length;add('Team references',orphan?orphan+' players reference missing teams':'No orphan team references',!orphan);
    const generated=data.categories.filter(c=>Array.isArray(c.bracket?.rounds)&&Array.isArray(c.bracket?.players)&&c.bracket.rounds.length>0);const invalid=data.categories.filter(c=>{const b=c.bracket||{};const hasTopology=(Array.isArray(b.rounds)&&b.rounds.length>0)||(Array.isArray(b.players)&&b.players.length>0)||!!b.champion||!!b.mode&&b.mode!=='single';return hasTopology&&(!Array.isArray(b.rounds)||!Array.isArray(b.players));}).length;add('Bracket integrity',`${generated.length} generated • ${Math.max(0,data.categories.length-generated.length-invalid)} not generated • ${invalid} invalid`,invalid===0);
    add('PEKAF ages','12 & Below • 13–15 • 16–17 • 18 & Above',true);add('Online mode','Online tournament control center',true);
    const fail=tests.filter(x=>!x.ok).length,warn=tests.filter(x=>x.warn).length;el('systemCheckSummary').innerHTML=`<div class="section-header"><div><h3>${fail?'ATTENTION REQUIRED':'SYSTEM READY'}</h3><p>${tests.length} checks completed • ${fail} failed • ${warn} warnings</p></div><span class="mode-badge ${fail?'official':''}">${fail?'CHECK ERRORS':'PASS'}</span></div>`;el('systemCheckTable').innerHTML=tests.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.detail)}</td><td class="${t.ok?'check-pass':t.warn?'check-warn':'check-fail'}">${t.ok?'PASS':t.warn?'WARNING':'FAIL'}</td></tr>`).join('');}
  el('runSystemCheck')?.addEventListener('click',runSystemCheck);
  // Fix existing System buttons that previously had no controller.
  document.querySelectorAll('[data-action="backup"]').forEach(b=>b.onclick=()=>enhanceShowPage('setupPage'));document.querySelectorAll('[data-action="settings"]').forEach(b=>b.onclick=()=>enhanceShowPage('controlPage'));document.querySelectorAll('[data-action="audit"]').forEach(b=>b.onclick=()=>enhanceShowPage('resultsPage'));document.querySelectorAll('[data-action="about"]').forEach(b=>b.onclick=()=>alert('RADIUM Tournament System\nOnline tournament management for Arnis competitions.\nV8 stable enhancement build.'));
  function weighinEligible(p,c){
    // Weigh-in is a category-specific candidate list: age + sex + Combative
    // registration determine who must be weighed. Actual weight is intentionally
    // NOT used here because the official weigh-in is what determines final eligibility.
    if(!p||!c)return false;
    const a=age(p.age ?? p.birth);
    if(a===''||a<c.ageFrom||a>c.ageTo)return false;
    if(c.sex&&c.sex!=='Mixed'&&c.sex!==p.sex)return false;
    if(c.event==='Arnis Anyo'||c.event==='Livestick')return false;
    if(!eCombat(p))return false;
    // For Combative Weigh-In, only show players whose REGISTERED weight
    // already falls inside the selected category's weight range. The actual
    // weigh-in remains the final eligibility check for bracket generation.
    const registeredWeight=Number(p.weight);
    const from=Number(c.weightFrom);
    const to=Number(c.weightTo);
    if(!Number.isFinite(registeredWeight)||!Number.isFinite(from)||!Number.isFinite(to))return false;
    if(registeredWeight<from||registeredWeight>to)return false;
    return true;
  }
  function populateWeighinCats(){const s=el('weighinCategory');if(!s)return;s.innerHTML='<option value="">SELECT COMBATIVE CATEGORY</option>'+data.categories.filter(c=>c.event!=='Arnis Anyo'&&c.event!=='Livestick').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');if(data.activeCategory&&!s.value&&data.categories.some(c=>c.id===data.activeCategory&&!isAnyoEvent(c)))s.value=data.activeCategory}
  function weighKey(categoryId,playerId){return String(categoryId)+'|'+String(playerId)}
  function getWeighIn(categoryId,playerId){return data.weighIns?.[weighKey(categoryId,playerId)]||data.weighIns?.[playerId]||{}}
  function renderWeighin(){populateWeighinCats();const c=cat(el('weighinCategory')?.value);const host=el('weighinTable');if(!host)return;if(!c){host.innerHTML='<tr><td colspan="8" class="empty">Select a Combative category.</td></tr>';return}const ps=data.players.filter(p=>weighinEligible(p,c)).sort((a,b)=>a.name.localeCompare(b.name));host.innerHTML=ps.map((p,i)=>{const w=getWeighIn(c.id,p.id);const ok=Number.isFinite(Number(w.weight))&&Number(w.weight)>=c.weightFrom&&Number(w.weight)<=c.weightTo;return `<tr><td>${i+1}</td><td><b>${esc(p.name)}</b><div class="muted">${esc(p.number||'')}</div></td><td>${esc(team(p.teamId)?.name||'—')}</td><td>${age(p.age ?? p.birth)}</td><td>${Number(p.weight||0).toFixed(1)}</td><td><input class="weigh-input" data-player="${p.id}" type="number" step="0.1" value="${w.weight??p.weight??''}"></td><td class="verify ${ok?'ok':'no'}">${ok?'ELIGIBLE':'OUT OF RANGE'}</td><td><button class="btn small ${w.verified?'primary':''}" data-verify="${p.id}">${w.verified?'VERIFIED':'VERIFY'}</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No eligible players.</td></tr>';host.querySelectorAll('.weigh-input').forEach(i=>i.onchange=()=>{if(data.locked)return alert('Tournament is active and locked. Weigh-in changes are closed.');const key=weighKey(c.id,i.dataset.player);data.weighIns[key]={...getWeighIn(c.id,i.dataset.player),categoryId:c.id,weight:Number(i.value),updatedAt:new Date().toISOString()};save8();renderWeighin()});host.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>{if(data.locked)return alert('Tournament is active and locked. Weigh-in changes are closed.');const p=player(b.dataset.verify),w=getWeighIn(c.id,p.id);if(!Number.isFinite(Number(w.weight)))return alert('Enter the actual weigh-in weight first.');if(Number(w.weight)<c.weightFrom||Number(w.weight)>c.weightTo)return alert('Player is outside this category weight range.');data.weighIns[weighKey(c.id,p.id)]={...w,weight:Number(w.weight),verified:true,verifiedAt:new Date().toISOString(),categoryId:c.id};log('WEIGH-IN VERIFIED',p.name+' — '+w.weight+' kg');save8();renderWeighin()})}
  el('weighinCategory')?.addEventListener('change',renderWeighin);el('refreshWeighin')?.addEventListener('click',renderWeighin);el('markAllWeighin')?.addEventListener('click',()=>{if(data.locked)return alert('Tournament is active and locked. Weigh-in changes are closed.');const c=cat(el('weighinCategory')?.value);if(!c)return;data.players.filter(p=>weighinEligible(p,c)).forEach(p=>{const w=getWeighIn(c.id,p.id);if(Number(w.weight)>=c.weightFrom&&Number(w.weight)<=c.weightTo)data.weighIns[weighKey(c.id,p.id)]={...w,verified:true,verifiedAt:new Date().toISOString(),categoryId:c.id}});save8();renderWeighin();toast8('Eligible players marked verified')});el('printWeighin')?.addEventListener('click',()=>window.print());el('printWeighinList')?.addEventListener('click',()=>enhanceShowPage('weighinPage')||setTimeout(()=>window.print(),100));
  async function renderOperator(){const host=el('operatorStatus');const c=el('operatorCourts');const tid=window.RADIUM_CLOUD?.getId?.();let liveByCourt=new Map();if(tid&&window.RADIUM_DB){try{await window.RADIUM_DB.init();const [mr,cr]=await Promise.all([window.RADIUM_DB.select('matches',{select:'court_id,category_id,blue_player_id,red_player_id,status',eq:{tournament_id:tid}}),window.RADIUM_DB.select('courts',{select:'id,court_number',eq:{tournament_id:tid}})]);if(!mr.error&&!cr.error){const noById=new Map((cr.data||[]).map(x=>[String(x.id),Number(x.court_number)]));const cats=new Map(data.categories.map(x=>[String(x.id),x]));const players=new Map(data.players.map(x=>[String(x.id),x]));(mr.data||[]).filter(m=>String(m.status||'').toUpperCase()==='IN_PROGRESS'&&m.court_id).forEach(m=>{const n=noById.get(String(m.court_id));if(n)liveByCourt.set(n,{blueName:players.get(String(m.blue_player_id))?.name||m.blue_player_id,redName:players.get(String(m.red_player_id))?.name||m.red_player_id,categoryName:cats.get(String(m.category_id))?.name||''})});}}catch(e){console.warn('Operator Supabase live load:',e)}}const live=[...liveByCourt.values()];if(host)host.innerHTML=[['PLAYERS',data.players.length],['CATEGORIES',data.categories.length],['COMPLETED',data.results.length],['LIVE COURTS',live.length]].map(x=>`<div class="stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');if(c)c.innerHTML=Array.from({length:Number(data.setup.courts)||1},(_,i)=>{const x=liveByCourt.get(i+1);return `<div class="activity-row"><b>COURT ${i+1}</b> — ${x?esc(x.blueName)+' vs '+esc(x.redName):'<span class="muted">AVAILABLE</span>'}</div>`}).join('')}
  el('queueTvBtn')?.addEventListener('click',()=>enhanceShowPage('tvPage'));
  el('operatorStart')?.addEventListener('click',()=>el('nextMatchBtn')?.click());el('operatorAuto')?.addEventListener('click',()=>el('autoAssignBtn')?.click());el('operatorTv')?.addEventListener('click',()=>enhanceShowPage('tvPage'));el('operatorResults')?.addEventListener('click',()=>enhanceShowPage('resultsPage'));
  async function renderTV(){
    const courtsHost=el('tvCourts');if(!courtsHost)return;
    const tid=window.RADIUM_CLOUD?.getId?.();if(!tid||!window.RADIUM_DB)return;
    try{await window.RADIUM_DB.init();
      const [tr,cr,mr,pr,cat]=await Promise.all([
        window.RADIUM_DB.select('tournaments',{select:'name,venue,event_date',eq:{id:tid},limit:1}),
        window.RADIUM_DB.select('courts',{select:'id,court_number,name,active',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('matches',{select:'id,category_id,court_id,round,match_number,blue_player_id,red_player_id,blue_score,red_score,status,scheduled_at,updated_at',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('players',{select:'id,first_name,middle_name,last_name,team_id,status',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('categories',{select:'id,name,event_type,gender',eq:{tournament_id:tid}})
      ]);
      if(tr.error)throw tr.error;if(cr.error)throw cr.error;if(mr.error)throw mr.error;if(pr.error)throw pr.error;if(cat.error)throw cat.error;
      const courts=(cr.data||[]).filter(c=>c.active!==false).sort((a,b)=>Number(a.court_number)-Number(b.court_number));
      const pm=new Map((pr.data||[]).map(p=>[String(p.id),[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(' ')])),cm=new Map((cat.data||[]).map(c=>[String(c.id),c.name])),catById=new Map((cat.data||[]).map(c=>[String(c.id),c]));
      const live=(mr.data||[]).filter(m=>String(m.status)==='LIVE'||String(m.status)==='CALLED');
      courtsHost.classList.add('tv-courts-grid');
      courtsHost.innerHTML=courts.map(c=>{const m=live.find(x=>String(x.court_id)===String(c.id));return `<div class="tv-court"><h3>COURT ${Number(c.court_number)||''} ${m?'<span style="color:#4ade80">● NOW PLAYING</span>':'<span style="color:#8195aa">● AVAILABLE</span>'}</h3>${m?`<div class="tv-vs"><div><div class="tv-fighter"><span class="tv-color-dot red"></span>${esc(pm.get(String(m.red_player_id))||'TBD')}</div></div><div class="tv-vs-mark">VS</div><div><div class="tv-fighter"><span class="tv-color-dot blue"></span>${esc(pm.get(String(m.blue_player_id))||'TBD')}</div></div></div><p>${esc(cm.get(String(m.category_id))||'')}</p>`:'<div class="empty" style="background:transparent;color:#8195aa;text-align:center;font-size:clamp(22px,2vw,34px);font-weight:900">COURT AVAILABLE</div>'}</div>`}).join('')||'<div class="empty">No courts configured.</div>';
      const busy=new Set(live.map(m=>m.id));
      const tvFlow=String(tr.data?.[0]?.settings?.setup?.matchFlow||'ROUND_CATEGORY').toUpperCase();
      const tvSexRank=m=>{
        const c=catById.get(String(m.category_id))||{};
        const sex=String(c.sex||c.gender||'Mixed').toLowerCase();
        if(tvFlow==='BOYS_FIRST'||tvFlow==='ROUND_BOYS_FIRST')return sex==='male'||sex==='boys'?0:sex==='female'||sex==='girls'?1:2;
        if(tvFlow==='GIRLS_FIRST'||tvFlow==='ROUND_GIRLS_FIRST')return sex==='female'||sex==='girls'?0:sex==='male'||sex==='boys'?1:2;
        return 0;
      };
      const tvCategoryRank=m=>{
        const n=String(catById.get(String(m.category_id))?.name||'').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
        if(/\bpinweight\b/.test(n))return 0;
        if(/\bbantamweight\b|\bbantam\b/.test(n))return 1;
        if(/\bfeatherweight\b|\bfeather\b/.test(n))return 2;
        if(/\bextra\s*lightweight\b|\bextra\s*light\s*weight\b/.test(n))return 3;
        if(/\bhalf\s*lightweight\b|\bhalf\s*light\s*weight\b/.test(n))return 4;
        if(/\bespada\s*y\s*daga\b/.test(n))return 12;
        if(/\bdouble\s+weapon\b/.test(n))return 11;
        if(/\bsingle\s+weapon\b/.test(n))return 10;
        return 100+n;
      };
      let next=(mr.data||[]).filter(m=>!busy.has(m.id)&&['READY','PENDING','BYE'].includes(String(m.status).toUpperCase())&&m.blue_player_id&&m.red_player_id);
      // Match Queue and TV must share the same round gate. For round-by-round
      // flows, a later round cannot appear while an earlier playable round is
      // unfinished.
      if(tvFlow==='ROUND_CATEGORY'||tvFlow==='ROUND_BOYS_FIRST'||tvFlow==='ROUND_GIRLS_FIRST'){
        const unfinished=(mr.data||[]).filter(m=>!busy.has(m.id)&&m.blue_player_id&&m.red_player_id&&!['COMPLETED','FINISHED'].includes(String(m.status).toUpperCase()));
        if(unfinished.length){
          const minRound=Math.min(...unfinished.map(m=>Number(m.round)||1));
          next=next.filter(m=>(Number(m.round)||1)===minRound);
        }else next=[];
      }
      next.sort((a,b)=>{
        const sa=tvSexRank(a),sb=tvSexRank(b),ka=tvCategoryRank(a),kb=tvCategoryRank(b),ra=Number(a.round)||1,rb=Number(b.round)||1,ma=Number(a.match_number)||1,mb=Number(b.match_number)||1;
        if(tvFlow==='BOYS_FIRST'||tvFlow==='GIRLS_FIRST')return sa-sb||ka-kb||ra-rb||ma-mb;
        if(tvFlow==='ROUND_BOYS_FIRST'||tvFlow==='ROUND_GIRLS_FIRST')return ra-rb||sa-sb||ka-kb||ma-mb;
        return ra-rb||ka-kb||sa-sb||ma-mb;
      });
      next=next.slice(0,Math.max(3,courts.length*4));
      el('tvNext').innerHTML=next.map((m,i)=>`<div class="activity-row ${i===0?'tv-next-first':''}"><b>${i===0?'NEXT':'#'+(i+1)}</b> <strong>MATCH ${Number(m.round)||1}-${Number(m.match_number)||1}</strong><br><span><i class="tv-color-dot red"></i>${esc(pm.get(String(m.red_player_id))||'TBD')}</span> <b>VS</b> <span><i class="tv-color-dot blue"></i>${esc(pm.get(String(m.blue_player_id))||'TBD')}</span><br><small>${esc(cm.get(String(m.category_id))||'')}</small></div>`).join('')||'<div style="color:#8195aa;text-align:center;padding:30px;font-size:20px;font-weight:800">NO READY MATCHES</div>';
      if(el('tvTournamentTitle'))el('tvTournamentTitle').textContent=tr.data?.[0]?.name||'RADIUM TOURNAMENT';
      if(el('tvDisplayDate'))el('tvDisplayDate').textContent=(tr.data?.[0]?.venue||'')+' • '+(tr.data?.[0]?.event_date||'');
      if(el('tvClock'))el('tvClock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});const tickerLines=next.slice(0,8).map(m=>{const r=pm.get(String(m.red_player_id))||'TBD',b=pm.get(String(m.blue_player_id))||'TBD';return `${r} • ${b} — PLEASE PROCEED TO THE STAGING AREA NOW`});if(el('tvTicker'))el('tvTicker').textContent=tickerLines.length?tickerLines.join('     ✦     '):'NEXT MATCHES — PLEASE PUT ON YOUR GEAR!';
    }catch(e){console.warn('TV display refresh:',e);if(el('tvNext'))el('tvNext').innerHTML='<div class="empty">Unable to refresh the tournament display.</div>'}
  }

  el('tvOpenWindow')?.addEventListener('click',()=>{const url=location.pathname+'?view=tvPage&display=1';const w=window.open(url,'RADIUM_LED_DISPLAY','noopener,noreferrer,width=1600,height=900');if(!w)alert('Allow pop-ups to open the LED display window.');});
  if(new URLSearchParams(location.search).get('display')==='1')document.body.classList.add('tv-display-mode');
  el('tvFullscreen')?.addEventListener('click',()=>document.documentElement.requestFullscreen?.());el('tvRefresh')?.addEventListener('click',renderTV);setInterval(()=>{if(el('tvPage')?.classList.contains('active'))renderTV()},2000);
  function printTable(title,headers,rows){
    const w=window.open('', '_blank');
    if(!w){alert('Allow pop-ups for printing.');return;}
    const head=headers.map(x=>'<th>'+esc(x)+'</th>').join('');
    const body=rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('');
    const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><link rel="stylesheet" href="css/app.css"></head><body><h1>'+esc(title)+'</h1><p>'+esc(data.setup.name)+' • '+esc(data.setup.date)+' • '+esc(data.setup.venue)+'</p><table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(),200);
  }
  el('printMasterPlayers')?.addEventListener('click',()=>printTable('RADIUM Player Master List',['ID','Player','Division','Age','Weight','Team','Events'],data.players.map(p=>[p.number||p.id,p.name,sexLabel(p.sex),age(p.age ?? p.birth),p.weight,team(p.teamId)?.name||'',Object.entries(p.events||{}).filter(x=>x[1]===true).map(x=>x[0]).join(', ')])));
  el('exportAllData')?.addEventListener('click',()=>download('RADIUM_Full_Backup_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(backupPayload(),null,2),'application/json'));
  // Existing controller's processResult resolves processOneResult at call time, so the wrapper is used automatically.
  // Initialize mode UI after the main controller has declared its shared state.
  function finalizeEnhancements(){
    try{initEnhancements(); if(data.mode==='OFFICIAL')document.body.classList.add('official-mode'); renderControl();}catch(err){console.warn('V8 enhancement initialization deferred:',err)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',finalizeEnhancements,{once:true});else setTimeout(finalizeEnhancements,0);
  // Navigation safety fix: Official Mode must never make Setup/Registration links unclickable.
  // The tournament lock remains the actual data-edit protection; navigation stays available so
  // administrators can review Setup, Players, Teams and Categories and exit Official Mode when needed.
  function repairSetupNavigation(){
    document.querySelectorAll('.setup-nav .nav-item[data-page]').forEach(btn=>{
      btn.style.pointerEvents='auto';
      btn.style.cursor='pointer';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repairSetupNavigation,{once:true});else repairSetupNavigation();
  window.addEventListener('pageshow',repairSetupNavigation);
  // Initial page selection is applied by authentication boot after the staff role is known.
  // Final navigation rebind after enhancement pages were added.
  document.querySelectorAll('.nav-item[data-page]').forEach(btn=>btn.onclick=function(e){e.preventDefault();enhanceShowPage(btn.dataset.page)});
  document.querySelectorAll('[data-go]').forEach(btn=>btn.onclick=function(e){e.preventDefault();enhanceShowPage(btn.dataset.go)});
  window.addEventListener('focus',()=>{try{load();ensureData();renderOperator();renderTV();}catch(e){}});
})();

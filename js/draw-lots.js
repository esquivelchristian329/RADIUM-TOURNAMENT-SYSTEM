/* RADIUM V36 - Official DepEd Draw Lots
   Physical draw is performed by coaches. TM/Admin records the drawn number.
   Supabase is authoritative; no randomization is performed by this screen. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=()=>window.__RADIUM_GET_DATA?window.__RADIUM_GET_DATA():null;
  const isAdminOrManager=()=>!!(window.RADIUM_AUTH?.isAdmin?.()||window.RADIUM_AUTH?.isManager?.());
  const isDepEdTournament=()=>{const d=state();if(!d)return false;return String(d.setup?.competitionProgram||'').toUpperCase()==='DEPED_PEKAF';};
  const isAnyo=c=>c?.event==='Arnis Anyo';
  const isCombative=c=>c?.event!=='Arnis Anyo'&&c?.event!=='Livestick';
  const eligible=(p,c)=>typeof window.eligible==='function'?window.eligible(p,c):true;
  function refreshVisibility(){
    const visible=isDepEdTournament()&&isAdminOrManager();
    document.querySelectorAll('.nav-item[data-page="drawLotsPage"]').forEach(b=>{b.style.display=visible?'':'none';b.setAttribute('aria-hidden',visible?'false':'true');});
    const page=$('drawLotsPage');if(page&&!visible&&page.classList.contains('active')){page.classList.remove('active');$('dashboardPage')?.classList.add('active');}
    document.querySelectorAll('.nav-group').forEach(g=>{const items=[...g.querySelectorAll('.nav-item')];if(items.length)g.style.display=items.some(x=>getComputedStyle(x).display!=='none')?'':'none';});
  }
  function categories(){const d=state();return d?(d.categories||[]).filter(c=>isDepEdTournament()&&(isAnyo(c)||isCombative(c))):[];}
  function categoryDivision(c){
    // DepEd-PEKAF Combative is a secondary/high-school-only event.
    // Do not infer its division from the category name because the official
    // category names (e.g. Boys 12–17 / weight classes) do not contain
    // the word "Secondary". Anyo categories still use their explicit
    // Elementary/Secondary naming.
    if(isDepEdTournament() && isCombative(c)) return 'Secondary';
    const n=String(c?.name||'').toLowerCase();
    return n.includes('secondary')?'Secondary':'Elementary';
  }
  function weaponRank(c){return ({'Single Weapon':1,'Double Weapon':2,'Espada y Daga':3,'Espada y Saga':3})[String(c?.weapon||'')]||99;}
  function sortedCategories(list){return [...list].sort((a,b)=>{const da=categoryDivision(a),db=categoryDivision(b);if(da!==db)return da==='Elementary'?-1:1;const wa=weaponRank(a),wb=weaponRank(b);if(wa!==wb)return wa-wb;return String(a.name||'').localeCompare(String(b.name||''));});}
  function selected(){const d=state();return d?.categories?.find(c=>String(c.id)===String($('drawLotsCategory')?.value))||null;}
  function teamName(id){const d=state();return d?.teams?.find(t=>String(t.id)===String(id))?.name||'—';}
  function anyoAgeOK(p,c){
    const a=Number(p?.age);if(!Number.isFinite(a))return false;
    const label=(String(c?.preset||'')+' '+String(c?.name||'')).toLowerCase();
    if(label.includes('elementary'))return a>=1&&a<=12;
    if(label.includes('secondary'))return a>=13&&a<=17;
    return a>=Number(c?.ageFrom||0)&&a<=Number(c?.ageTo||99);
  }
  function anyoComboOK(p,c,type){
    const e=p?.events||{};
    const combos=Array.isArray(e[type==='Individual'?'anyoIndividualEvents':'anyoSynchronizedEvents'])?e[type==='Individual'?'anyoIndividualEvents':'anyoSynchronizedEvents']:[];
    if(!c.anyoWeapon||c.anyoWeapon==='Any')return true;
    const wanted=`${c.anyoStyle||'Traditional'}|${c.anyoWeapon}`;
    if(combos.length)return combos.includes(wanted);
    const key=(c.anyoStyle||'Traditional')==='Traditional'?'anyoTraditionalWeapons':'anyoNonTraditionalWeapons';
    return Array.isArray(e[key])&&e[key].includes(c.anyoWeapon);
  }
  function localAnyoRegistrationPlayerIds(c){
    const d=state();if(!d)return new Set();
    return new Set((d.registrations||[]).filter(r=>String(r.categoryId||r.category_id)===String(c.id)&&!['CANCELLED','DELETED','WITHDRAWN'].includes(String(r.status||'ACTIVE').toUpperCase())&&r.playerId).map(r=>String(r.playerId)));
  }
  function competitors(c){
    const d=state();if(!d||!c)return [];
    if(isAnyo(c)){
      const type=c.anyoType||'Individual';
      if(type==='Individual'){
        const registeredIds=localAnyoRegistrationPlayerIds(c);
        const rows=[];
        for(const p of d.players||[]){
          // For Anyo, an explicit category registration is authoritative. The
          // legacy player.events flags are only a fallback for older records.
          const explicitlyRegistered=registeredIds.has(String(p.id));
          const legacyRegistered=p.events?.anyoIndividual===true;
          if(!explicitlyRegistered&&!legacyRegistered)continue;
          if(!anyoAgeOK(p,c)|| (c.sex&&c.sex!=='Mixed'&&c.sex!==p.sex))continue;
          if(!anyoComboOK(p,c,'Individual'))continue;
          let e=(d.anyoEntries||[]).find(x=>String(x.categoryId)===String(c.id)&&x.type==='Individual'&&x.memberIds?.some(id=>String(id)===String(p.id))&&x.status!=='deleted');
          if(!e)e={id:`tmp-${c.id}-${p.id}`,memberIds:[p.id],number:p.number||p.id};
          const cs=p.categorySeeds?.[c.id]||{};
          rows.push({kind:'player',id:p.id,name:p.name,teamId:p.teamId||'',draw:Number.isFinite(Number(e.drawOrder))?Number(e.drawOrder):(Number.isFinite(Number(cs.drawNumber))?Number(cs.drawNumber):null),player:p,entry:e});
        }
        return rows;
      }
      return (d.anyoEntries||[]).filter(e=>String(e.categoryId)===String(c.id)&&e.type===type&&e.status!=='deleted').filter(e=>{
        const members=(e.memberIds||[]).map(id=>(d.players||[]).find(p=>String(p.id)===String(id))).filter(Boolean);
        if(!members.length)return false;
        const max=type==='Synchronized'?3:2;
        if(members.length<2||members.length>max)return false;
        return members.every(p=>anyoAgeOK(p,c))&&(c.sex==='Mixed'||!c.sex||members.every(p=>(p.sex||p.gender)===c.sex));
      }).map(e=>({kind:'entry',id:e.id,name:e.number||e.id,teamId:(e.memberIds||[]).map(id=>(d.players||[]).find(p=>String(p.id)===String(id))).find(Boolean)?.teamId||'',draw:Number.isFinite(Number(e.drawOrder))?Number(e.drawOrder):null,entry:e}));
    }
    // Combative draw lots must use the same authoritative roster as the bracket:
    // active category registration + verified weigh-in. This makes the saved seed
    // list the exact source of the bracket competitor count.
    const regs=Array.isArray(d.registrations)?d.registrations.filter(r=>String(r.categoryId)===String(c.id)&&!['CANCELLED','DELETED','WITHDRAWN'].includes(String(r.status||'').toUpperCase())):[];
    const regIds=new Set(regs.map(r=>String(r.playerId)).filter(Boolean));
    // Combative draw lots must follow the actual registered category roster.
    // Do NOT require players.events.combat here: category registration already
    // establishes that the player is entered in this Combative category, and
    // some valid registered players have an empty legacy events object ({}).
    // For DepEd-PEKAF, use the verified category weigh-in as the weight source,
    // matching the roster that the bracket generator will later accept.
    const weighMap=d.weighIns&&typeof d.weighIns==='object'?d.weighIns:{};
    const isRegisteredCombativeEligible=(p)=>{
      const age=Number(p.age);
      if(!Number.isFinite(age)||age<Number(c.ageFrom)||age>Number(c.ageTo))return false;
      if(c.sex&&c.sex!=='Mixed'&&c.sex!==p.sex)return false;
      if(isDepEdTournament()){
        const w=weighMap[String(c.id)+'|'+String(p.id)];
        if(!w||w.verified!==true)return false;
        const actual=Number(w.weight);
        return Number.isFinite(actual)&&actual>=Number(c.weightFrom||0)&&actual<=Number(c.weightTo||999);
      }
      const weight=Number(p.weight);
      return !c.weightRequired || (Number.isFinite(weight)&&weight>=Number(c.weightFrom||0)&&weight<=Number(c.weightTo||999));
    };
    return (d.players||[]).filter(p=>regIds.has(String(p.id))&&isRegisteredCombativeEligible(p)).map(p=>{const cs=p.categorySeeds?.[c.id]||{};return {kind:'player',id:p.id,name:p.name,teamId:p.teamId||'',draw:Number.isFinite(Number(cs.drawNumber))?Number(cs.drawNumber):null,seed:Number.isFinite(Number(cs.seed))?Number(cs.seed):null,player:p};});
  }
  function renderSelect(options={}){
    const s=$('drawLotsCategory'),d=state();if(!s||!d)return;
    const cats=(window.RADIUM_SORT_CATEGORIES||sortedCategories)(categories());
    let event=$('drawLotsEvent');
    if(!event){event=document.createElement('select');event.id='drawLotsEvent';event.className=s.className||'search';s.parentNode.insertBefore(event,s);}
    let div=$('drawLotsDivision');
    if(!div){div=document.createElement('select');div.id='drawLotsDivision';div.className=s.className||'search';s.parentNode.insertBefore(div,s);}

    // Preserve the user's current EVENT/DIVISION selection when refreshing.
    // The previous implementation rebuilt the selectors and then derived the
    // division from d.activeCategory, which could immediately force SECONDARY
    // back after the user selected ELEMENTARY.
    const existingEvent=String(event.value||'');
    const existingDivision=String(div.value||'');
    const events=[...new Set(cats.map(c=>isAnyo(c)?'ANYO':'COMBATIVE'))];
    const active=d.activeCategory?cats.find(c=>String(c.id)===String(d.activeCategory)):null;
    const activeEvent=active?(isAnyo(active)?'ANYO':'COMBATIVE'):'';
    const currentEvent=events.includes(existingEvent)?existingEvent:(events.includes(activeEvent)?activeEvent:(events[0]||'COMBATIVE'));

    event.innerHTML=events.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    event.value=currentEvent;

    const eventCats=cats.filter(c=>(isAnyo(c)?'ANYO':'COMBATIVE')===currentEvent);
    const divisions=[...new Set(eventCats.map(categoryDivision))];
    const activeDivision=active&&activeEvent===currentEvent?categoryDivision(active):'';
    const currentDivision=divisions.includes(existingDivision)?existingDivision:(divisions.includes(activeDivision)?activeDivision:(divisions[0]||'Elementary'));

    div.innerHTML=divisions.map(x=>`<option value="${esc(x)}">${esc(x.toUpperCase())}</option>`).join('');
    div.value=currentDivision;

    const filtered=eventCats.filter(c=>categoryDivision(c)===currentDivision);
    const currentCategory=String(s.value||'');
    s.innerHTML='<option value="">SELECT '+esc(currentDivision.toUpperCase())+' CATEGORY</option>'+filtered.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');

    if(filtered.some(c=>String(c.id)===currentCategory)){
      s.value=currentCategory;
    }else if(active&&activeEvent===currentEvent&&categoryDivision(active)===currentDivision&&filtered.some(c=>String(c.id)===String(active.id))){
      s.value=active.id;
    }else if(filtered[0]){
      s.value=filtered[0].id;
    }else{
      s.value='';
    }
    d.activeCategory=s.value||null;

    // These selectors are created dynamically, so their listeners must be
    // attached after creation. Use property handlers so we never stack
    // duplicate listeners during refreshes.
    event.onchange=()=>{
      const nd=state();
      if(nd)nd.activeCategory=null;
      renderSelect({resetDivision:true});
    };
    div.onchange=()=>{
      const nd=state();
      if(nd)nd.activeCategory=null;
      renderSelect({resetCategory:true});
    };
    renderSelected();
  }
  let drawHydrationToken=0;
  async function hydrateSavedDraw(c,list){
    const token=++drawHydrationToken;
    if(!c||!list?.length||!window.RADIUM_DB)return;
    try{
      const init=await window.RADIUM_DB.init();
      if(!init?.enabled)return;
      const tid=String(window.RADIUM_CLOUD?.getId?.()||state()?.tournamentId||'');
      if(!tid)return;
      if(isAnyo(c)){
        const r=await window.RADIUM_DB.select('anyo_entries',{select:'id,category_id,entry_type,entry_number,draw_order,draw_type,drawn_at,status',eq:{tournament_id:tid,category_id:c.id}});
        if(r?.error)throw r.error;
        if(token!==drawHydrationToken)return;
        const byId=new Map((r.data||[]).map(x=>[String(x.id),x]));
        const byKey=new Map((r.data||[]).map(x=>[String(x.category_id)+'|'+String(x.entry_type)+'|'+String(x.entry_number||''),x]));
        for(const x of list){
          const e=x.kind==='entry'?x.entry:x.entry;
          const row=e&&byId.get(String(e.id)) || (e&&byKey.get(String(c.id)+'|'+String(e.type||'Individual')+'|'+String(e.number||'')));
          if(!row)continue;
          const n=Number(row.draw_order);
          if(Number.isInteger(n)){x.draw=n;if(e){e.drawOrder=n;e.drawType=row.draw_type||e.drawType||null;e.drawnAt=row.drawn_at||e.drawnAt||null;}}
        }
      }else{
        const r=await window.RADIUM_DB.select('category_players',{select:'player_id,category_id,seed,draw_number,draw_type,drawn_at,status',eq:{category_id:c.id}});
        if(r?.error)throw r.error;
        if(token!==drawHydrationToken)return;
        const byId=new Map((r.data||[]).map(x=>[String(x.player_id),x]));
        for(const x of list){
          const row=byId.get(String(x.id));
          if(!row)continue;
          const n=Number(row.draw_number);
          if(Number.isInteger(n)){
            x.draw=n;x.seed=Number.isFinite(Number(row.seed))?Number(row.seed):x.seed;
            const p=x.player;p.categorySeeds=p.categorySeeds||{};p.categorySeeds[c.id]={...(p.categorySeeds[c.id]||{}),seed:x.seed,drawNumber:n,drawType:row.draw_type||null,drawnAt:row.drawn_at||null};
          }
        }
      }
      const d=state();
      if(d&&String(d.activeCategory||'')===String(c.id))renderSelected({skipHydrate:true});
    }catch(e){console.warn('Saved draw hydration failed:',e);}
  }
  let anyoCloudHydrationToken=0;
  async function hydrateAnyoRosterFromCloud(c){
    if(!isAnyo(c)||!window.RADIUM_DB)return false;
    const token=++anyoCloudHydrationToken;
    try{
      const init=await window.RADIUM_DB.init();if(!init?.enabled)return false;
      const tid=String(window.RADIUM_CLOUD?.getId?.()||state()?.tournamentId||'');if(!tid)return false;
      const [er,rr,pr,mr]=await Promise.all([
        window.RADIUM_DB.select('anyo_entries',{select:'id,category_id,entry_type,entry_number,style,weapon,draw_order,draw_type,drawn_at,status,group_reference',eq:{tournament_id:tid,category_id:c.id}}),
        window.RADIUM_DB.select('category_registrations',{select:'id,player_id,anyo_entry_id,status,category_id,team_id',eq:{tournament_id:tid,category_id:c.id}}),
        window.RADIUM_DB.select('players',{select:'id,first_name,middle_name,last_name,gender,age,weight,player_number,team_id,status,events',eq:{tournament_id:tid}}),
        window.RADIUM_DB.select('anyo_entry_members',{select:'entry_id,player_id,member_position',eq:{tournament_id:tid}})
      ]);
      if(er?.error||rr?.error||pr?.error||mr?.error)throw er?.error||rr?.error||pr?.error||mr?.error;
      if(token!==anyoCloudHydrationToken)return false;
      const d=state();if(!d)return false;
      const players=new Map((pr.data||[]).map(p=>[String(p.id),p]));
      const localPlayers=d.players||[];
      for(const p of localPlayers){
        const cp=players.get(String(p.id));if(!cp)continue;
        if(cp.events&&typeof cp.events==='object'&&Object.keys(cp.events).length)p.events={...p.events,...cp.events};
        if(cp.team_id)p.teamId=cp.team_id;
        if(cp.age!=null)p.age=Number(cp.age)||p.age;
        if(cp.gender)p.sex=cp.gender;
      }
      const membersByEntry=new Map();
      for(const m of mr.data||[]){const k=String(m.entry_id);if(!membersByEntry.has(k))membersByEntry.set(k,[]);membersByEntry.get(k).push(m);}
      const cloudEntries=(er.data||[]).filter(e=>!['DELETED','WITHDRAWN','CANCELLED'].includes(String(e.status||'').toUpperCase())).map(e=>({
        id:e.id,number:e.entry_number||e.id,type:e.entry_type||'Individual',categoryId:e.category_id,style:e.style||c.anyoStyle||'Traditional',weapon:e.weapon||c.anyoWeapon||'Any',groupReference:e.group_reference||'',memberIds:(membersByEntry.get(String(e.id))||[]).sort((a,b)=>Number(a.member_position||0)-Number(b.member_position||0)).map(m=>m.player_id),drawOrder:Number.isFinite(Number(e.draw_order))?Number(e.draw_order):null,drawType:e.draw_type||null,drawnAt:e.drawn_at||null,status:String(e.status||'active').toLowerCase()}));
      const regPlayers=(rr.data||[]).filter(r=>r.player_id&&!['CANCELLED','DELETED','WITHDRAWN'].includes(String(r.status||'').toUpperCase())).map(r=>String(r.player_id));
      // Build missing Individual entries from the authoritative category registration.
      // This repairs the common case where category_registrations was saved before
      // anyo_entries was created. It never guesses a player for an orphan row whose
      // player_id is NULL.
      if((c.anyoType||'Individual')==='Individual'){
        for(const pid of regPlayers){
          const p=localPlayers.find(x=>String(x.id)===pid);if(!p)continue;
          if(!cloudEntries.some(e=>e.type==='Individual'&&e.memberIds.some(x=>String(x)===pid))){
            const num=p.number||p.id.slice(0,6).toUpperCase();
            cloudEntries.push({id:`tmp-${c.id}-${pid}`,number:num,type:'Individual',categoryId:c.id,style:c.anyoStyle||'Traditional',weapon:c.anyoWeapon||'Any',groupReference:'',memberIds:[p.id],drawOrder:null,drawType:null,drawnAt:null,status:'active'});
          }
        }
      }
      d.anyoEntries=Array.isArray(d.anyoEntries)?d.anyoEntries:[];
      // Replace only entries for this Anyo category; Combative data is untouched.
      d.anyoEntries=d.anyoEntries.filter(e=>String(e.categoryId)!==String(c.id));
      d.anyoEntries.push(...cloudEntries);
      // Rebuild the local registration rows for players that are explicitly linked.
      d.registrations=Array.isArray(d.registrations)?d.registrations:[];
      const otherRegs=d.registrations.filter(r=>String(r.categoryId)!==String(c.id));
      const categoryRegs=(rr.data||[]).map(r=>({id:r.id,teamId:r.team_id||'',playerId:r.player_id||'',categoryId:r.category_id,anyoEntryId:r.anyo_entry_id||null,status:String(r.status||'ACTIVE').toUpperCase()}));
      d.registrations=[...otherRegs,...categoryRegs];
      window.__RADIUM_SET_DATA?.(d);
      return true;
    }catch(e){console.warn('Anyo cloud roster hydration failed:',e);return false;}
  }
  function renderSelected(options={}){
    const c=selected(),info=$('drawLotsInfo'),tb=$('drawLotsTable'),status=$('drawLotsStatus');
    if(!c){if(info)info.innerHTML='<strong>Select a category.</strong> The Tournament Manager records the physical draw result here.';if(tb)tb.innerHTML='<tr><td colspan="5" class="draw-lots-empty">No category selected.</td></tr>';if(status)status.textContent='NOT DRAWN';return;}
    const list=competitors(c),any=isAnyo(c),type=any?(c.anyoType||'Individual'):'Combative';
    if(any&&!options.skipCloudHydrate){
      hydrateAnyoRosterFromCloud(c).then(changed=>{
        if(changed&&selected()&&String(selected().id)===String(c.id))renderSelected({skipCloudHydrate:true});
      });
    }
    if(!options.skipHydrate)hydrateSavedDraw(c,list);
    if(info)info.innerHTML=any?`<strong>DepEd Anyo:</strong> Coaches physically draw numbered papers. Enter each drawn number for <b>${esc(c.name)}</b>. The order is independent for this category.`:`<strong>DepEd Combative:</strong> Coaches physically draw seed numbers for <b>${esc(c.name)}</b>. Enter each drawn seed below; the bracket will use these category-specific seeds.`;
    const drawn=list.length>0&&list.every(x=>Number.isInteger(x.draw)&&x.draw>=1&&x.draw<=list.length)&&new Set(list.map(x=>x.draw)).size===list.length;
    if(status)status.textContent=drawn?'DRAW COMPLETE':'ENTER DRAW';
    const rows=[...list].sort((a,b)=>{const ad=Number(a.draw),bd=Number(b.draw);if(Number.isFinite(ad)&&Number.isFinite(bd))return ad-bd; if(Number.isFinite(ad))return -1;if(Number.isFinite(bd))return 1;return a.name.localeCompare(b.name);});
    if(tb)tb.innerHTML=rows.length?rows.map(x=>`<tr data-draw-row="${esc(x.id)}"><td><input class="draw-number-input" data-draw-id="${esc(x.id)}" type="number" min="1" max="${list.length}" step="1" value="${Number.isInteger(x.draw)?x.draw:''}" inputmode="numeric" aria-label="Draw number for ${esc(x.name)}"></td><td><b>${esc(x.name)}</b></td><td>${esc(teamName(x.teamId))}</td><td>${x.kind==='entry'?'GROUP ENTRY':'PLAYER REGISTRATION'}</td><td>${any?'PERFORMANCE ORDER':'SEED'}</td></tr>`).join(''):'<tr><td colspan="5" class="draw-lots-empty">No eligible competitors or entries found.</td></tr>';
  }

  async function persistDrawDirectlyToSupabase(c,list,values,now){
    const tid=String(window.RADIUM_CLOUD?.getId?.()||state()?.tournamentId||'');
    if(!tid||!window.RADIUM_DB)throw new Error('Supabase connection is not available.');
    const init=await window.RADIUM_DB.init();
    if(!init?.enabled)throw new Error('Supabase database bridge is not enabled.');

    if(isAnyo(c)){
      for(const x of list){
        const n=Number(values.get(String(x.id)));
        if(x.kind==='player'){
          const e=x.entry;
          if(!e?.id||String(e.id).startsWith('tmp-'))continue;
          const r=await window.RADIUM_DB.update('anyo_entries',{draw_order:n,draw_type:'DEPED_PHYSICAL_LOTS',drawn_at:now},{id:e.id,tournament_id:tid});
          if(r?.error)throw new Error('ANYO draw save failed for '+(e.number||e.id)+': '+(r.error.message||r.error));
        }else{
          const r=await window.RADIUM_DB.update('anyo_entries',{draw_order:n,draw_type:'DEPED_PHYSICAL_LOTS',drawn_at:now},{id:x.entry.id,tournament_id:tid});
          if(r?.error)throw new Error('ANYO group draw save failed for '+(x.entry.number||x.entry.id)+': '+(r.error.message||r.error));
        }
      }
      return;
    }

    const rows=list.map(x=>{
      const n=Number(values.get(String(x.id)));
      return {category_id:c.id,player_id:x.player.id,seed:n,draw_number:n,draw_type:'DEPED_PHYSICAL_LOTS',drawn_at:now,status:'active'};
    });
    const r=await window.RADIUM_DB.upsertNoReturn('category_players',rows,{onConflict:'category_id,player_id'});
    if(r?.error)throw new Error('Combative seed save failed: '+(r.error.message||r.error));

    // Read-back verification prevents the UI from claiming success when RLS or
    // another database error silently prevents persistence.
    const check=await window.RADIUM_DB.select('category_players',{select:'player_id,seed,draw_number,draw_type,drawn_at',eq:{category_id:c.id}});
    if(check?.error)throw new Error('Seed save verification failed: '+(check.error.message||check.error));
    const wanted=new Map(rows.map(x=>[String(x.player_id),x.draw_number]));
    const verified=new Set((check.data||[]).filter(x=>wanted.has(String(x.player_id))&&Number(x.draw_number)===Number(wanted.get(String(x.player_id)))).map(x=>String(x.player_id)));
    if(verified.size!==rows.length)throw new Error(`Supabase verification found only ${verified.size} of ${rows.length} saved seeds.`);
  }

  async function saveDraw(){
    const c=selected(),d=state();if(!c||!d)return alert('Select a category first.');
    const tid=String(window.RADIUM_CLOUD?.getId?.()||state()?.tournamentId||'');
    if(!tid) return alert('No active tournament is loaded.');
    if(!isAdminOrManager())return alert('Only Admin or Tournament Manager can record the official draw.');
    if(d.locked)return alert('Tournament is locked. Unlock it before recording draw lots.');
    const list=competitors(c);if(!list.length)return alert('No eligible competitors or Anyo entries are available for this category.');
    const values=new Map();for(const input of document.querySelectorAll('.draw-number-input'))values.set(String(input.dataset.drawId),Number(input.value));
    const nums=list.map(x=>values.get(String(x.id)));if(nums.some(n=>!Number.isInteger(n)||n<1||n>list.length))return alert(`Enter every draw number from 1 to ${list.length}.`);
    if(new Set(nums).size!==list.length)return alert('Duplicate draw numbers are not allowed. Each number must be unique.');
    const now=new Date().toISOString();
    for(const x of list){
      const n=values.get(String(x.id));
      if(isAnyo(c)){
        if(x.kind==='player'){
          const p=x.player;p.categorySeeds=p.categorySeeds||{};p.categorySeeds[c.id]={...(p.categorySeeds[c.id]||{}),drawNumber:n,drawType:'DEPED_PHYSICAL_LOTS',drawnAt:now};
          const e=(d.anyoEntries||[]).find(y=>String(y.categoryId)===String(c.id)&&y.type==='Individual'&&y.memberIds?.[0]===p.id&&y.status!=='deleted');
          if(e){e.drawOrder=n;e.drawType='DEPED_PHYSICAL_LOTS';e.drawnAt=now;}
        }else{x.entry.drawOrder=n;x.entry.drawType='DEPED_PHYSICAL_LOTS';x.entry.drawnAt=now;}
      }else{
        const p=x.player;p.categorySeeds=p.categorySeeds||{};p.categorySeeds[c.id]={...(p.categorySeeds[c.id]||{}),seed:n,drawNumber:n,drawType:'DEPED_PHYSICAL_LOTS',drawnAt:now};
      }
    }
    c.draw=isAnyo(c)?(c.draw||'random'):'seed';
    d.activeCategory=c.id;
    try{
      // Primary persistence path: write the official draw directly to the
      // authoritative Supabase rows. The normal cloud sync then backs up the
      // complete tournament state without being the only save mechanism.
      await persistDrawDirectlyToSupabase(c,list,values,now);
      window.__RADIUM_SET_DATA?.(d);
      // IMPORTANT: Do not run the full tournament-state cloud sync here. Draw Lots
      // is an official physical result and its direct Supabase rows are already the
      // authoritative record. A full-state sync can rebuild category_players or
      // anyo_entries from a stale browser state and overwrite the freshly saved
      // draw. We verify the exact rows directly instead.
      // For Combative, also permanently mark the category as seed-drawn so the
      // bracket generator is required to use the saved category_players seeds.
      if(!isAnyo(c)){
        const catRow=await window.RADIUM_DB.select('categories',{select:'id,rules',eq:{id:c.id,tournament_id:tid},limit:1});
        if(catRow?.error)throw new Error('Category draw-mode verification failed: '+(catRow.error.message||catRow.error));
        const rules={...(catRow.data?.[0]?.rules||{}),draw:'seed'};
        const cr=await window.RADIUM_DB.update('categories',{rules},{id:c.id,tournament_id:tid});
        if(cr?.error)throw new Error('Category seed mode save failed: '+(cr.error.message||cr.error));
      }
      // Final read-back directly from Supabase. This is the authoritative value
      // that the bracket/performer list will use later.
      if(!isAnyo(c)){
        const verify=await window.RADIUM_DB.select('category_players',{select:'player_id,seed,draw_number,draw_type,drawn_at',eq:{category_id:c.id}});
        if(verify?.error)throw new Error('Final seed verification failed: '+(verify.error.message||verify.error));
        const wanted=new Map(list.map(x=>[String(x.id),Number(values.get(String(x.id)))]));
        const good=new Set((verify.data||[]).filter(x=>wanted.has(String(x.player_id))&&Number(x.seed)===wanted.get(String(x.player_id))&&Number(x.draw_number)===wanted.get(String(x.player_id))).map(x=>String(x.player_id)));
        if(good.size!==list.length)throw new Error(`Final Supabase verification found ${good.size} of ${list.length} saved seeds.`);
      }
      renderSelect();renderSelected();window.renderAll?.();
      alert(isAnyo(c)?'Official Anyo performance order saved to Supabase.':'Official seed numbers saved to Supabase.');
    }catch(e){
      console.error('Draw save failed:',e);
      alert('Draw result was NOT confirmed by Supabase. '+(e?.message||e));
    }
  }
  window.renderDrawLots=renderSelect;window.RADIUM_DRAW_LOTS={isDepEdTournament,refreshVisibility};
  function bind(){
    $('drawLotsCategory')?.addEventListener('change',()=>{const d=state();if(d)d.activeCategory=$('drawLotsCategory').value||null;renderSelected();});
    $('runDrawLotsBtn')?.addEventListener('click',saveDraw);
    $('redrawLotsBtn')?.addEventListener('click',()=>{if(confirm('Replace the saved draw numbers for this category? Enter the new physical draw results and save.'))renderSelected();});
    $('refreshDrawLotsBtn')?.addEventListener('click',renderSelect);
    document.querySelectorAll('.nav-item[data-page="drawLotsPage"]').forEach(b=>b.addEventListener('click',()=>setTimeout(renderSelect,0)));
    refreshVisibility();renderSelect();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();

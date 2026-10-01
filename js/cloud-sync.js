/* RADIUM V34 - SUPABASE AUTHORITATIVE DATA LAYER
   Tournament state and active-tournament selection are held in Supabase/cloud session state.
   The application never persists tournament records locally. */
(function(){
  'use strict';
  function ensureEmergencyBanner(){let el=document.getElementById('radiumEmergencyBanner');if(el)return el;el=document.createElement('div');el.id='radiumEmergencyBanner';el.style.cssText='position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99999;padding:9px 16px;border-radius:999px;background:#8a1c1c;color:#fff;font:700 12px Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);display:none;max-width:92vw;text-align:center;';document.body?.appendChild(el);return el}
  function updateEmergencyBanner(){const el=ensureEmergencyBanner();if(!el)return;const offline=navigator.onLine===false;const pending=!!window.RADIUM_CLOUD?.state?.pendingCount;const syncing=!!window.RADIUM_CLOUD?.state?.syncing;if(offline||pending){el.textContent=offline?'🔴 OFFLINE — EMERGENCY MODE • Data protected locally':'🟡 SYNC PENDING — Waiting for Supabase confirmation';el.style.display='block';el.style.background=offline?'#8a1c1c':'#8a6500';}else if(syncing){el.textContent='🔄 SYNCING TO SUPABASE…';el.style.display='block';el.style.background='#1456a0';}else el.style.display='none'}
  const ID_KEY='RADIUM_SUPABASE_TOURNAMENT_ID';
  const uid=()=>`tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function replaceIds(obj,from,to){if(!obj||from===to)return;const seen=new WeakSet();const walk=v=>{if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);for(const k of Object.keys(v)){if(typeof v[k]==='string'&&v[k]===from)v[k]=to;else if(typeof v[k]==='object')walk(v[k]);}};walk(obj);}
  let timer=null,syncing=false,startingPush=false,initialized=false,categoryDeleteInProgress=false,syncAgain=false,changeVersion=0;
  const activeId=()=>String(cloud?.state?.tournamentId||'');
  const cleanId=id=>UUID.test(String(id||''))?String(id):uid();
  async function hashPin(pin){const bytes=new TextEncoder().encode(String(pin||''));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');}
  const fresh=()=>({version:15,tournamentId:null,storageNamespace:null,setup:{name:'',date:new Date().toISOString().slice(0,10),venue:'',organizer:'',courts:2,duration:60,type:'single',competitionProgram:'GENERAL',combativeRounds:3,gold:5,silver:3,bronze:1,pin:'',billingMode:'PAID',currency:'PHP',scoreboardLogos:['','','','']},teams:[],players:[],categories:[],results:[],medals:[],audit:[],activeCategory:null,locked:false,anyoResults:[],weighIns:{},anyoEntries:[]});
  const role=()=>String(window.RADIUM_AUTH?.role||'').toLowerCase();
     /*
   * RADIUM V34 - INDIVIDUAL ANYO ENTRY STATE BRIDGE
   *
   * bracket.js calls ensureIndividualAnyoEntries() from renderAll().
   * The current build was missing that function, which caused:
   *
   *   ReferenceError: ensureIndividualAnyoEntries is not defined
   *
   * This implementation derives Individual Anyo entries from the
   * authoritative tournament state without creating duplicate entries.
   */
  window.ensureIndividualAnyoEntries=function(){
    try{
      const state=window.__RADIUM_GET_DATA?.();

      if(!state) return;

      if(!Array.isArray(state.categories)) return;

      if(!Array.isArray(state.players)) return;

      const entries=Array.isArray(state.anyoEntries)
        ? state.anyoEntries.slice()
        : [];

      let changed=false;

      function eligibleIndividualAnyo(player,category){

        if(!player||!category) return false;

        if(category.event!=='Arnis Anyo') return false;

        if((category.anyoType||'Individual')!=='Individual') return false;

        const playerAge=Number(player.age);

        if(
          !Number.isFinite(playerAge) ||
          playerAge<Number(category.ageFrom) ||
          playerAge>Number(category.ageTo)
        ){
          return false;
        }

        if(
          category.sex &&
          category.sex!=='Mixed' &&
          category.sex!==player.sex
        ){
          return false;
        }

        const events=player.events||{};

        if(events.anyoIndividual!==true){
          return false;
        }

        const style=category.anyoStyle||'Traditional';

        const weapon=category.anyoWeapon||'Any';

        const combos=Array.isArray(events.anyoIndividualEvents)
          ? events.anyoIndividualEvents
          : [];

        if(weapon!=='Any'){

          const wanted=style+'|'+weapon;

          if(combos.length){
            if(!combos.includes(wanted)){
              return false;
            }
          }else{

            const legacyWeapons=
              style==='Traditional'
                ? events.anyoTraditionalWeapons
                : events.anyoNonTraditionalWeapons;

            if(
              !Array.isArray(legacyWeapons) ||
              !legacyWeapons.includes(weapon)
            ){
              return false;
            }
          }
        }

        return true;
      }

      for(const category of state.categories){

        if(
          category?.event!=='Arnis Anyo' ||
          (category.anyoType||'Individual')!=='Individual'
        ){
          continue;
        }

        for(const player of state.players){

          if(!eligibleIndividualAnyo(player,category)){
            continue;
          }

          /*
           * One real Individual Anyo registration must have exactly
           * one Individual Anyo entry for this category/player pair.
           */
          const existing=entries.find(entry=>
            entry &&
            entry.status!=='deleted' &&
            entry.type==='Individual' &&
            String(entry.categoryId)===String(category.id) &&
            Array.isArray(entry.memberIds) &&
            String(entry.memberIds[0])===String(player.id)
          );

          if(existing){
            continue;
          }

          const categoryCount=entries.filter(entry=>
            entry &&
            String(entry.categoryId)===String(category.id) &&
            entry.status!=='deleted'
          ).length;

          entries.push({
            id:`tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
            number:
              player.number ||
              (
                'IND-' +
                String(categoryCount+1).padStart(3,'0')
              ),
            type:'Individual',
            categoryId:category.id,
            style:category.anyoStyle||'Traditional',
            weapon:category.anyoWeapon||'Any',
            groupReference:'',
            status:'active',
            memberIds:[player.id]
          });

          changed=true;
        }
      }

      if(changed){

        state.anyoEntries=entries;

        /*
         * fromCloud=true is important.
         * This normalization must NOT immediately create a local
         * save loop. Supabase synchronization will materialize the
         * temporary IDs into real Supabase UUIDs.
         */
        window.__RADIUM_SET_DATA?.(
          state,
          {fromCloud:true}
        );
      }

    }catch(error){

      console.warn(
        'RADIUM Individual Anyo entry normalization skipped:',
        error
      );
    }
  };


  /*
   * Wait for bracket.js to install the application state bridge.
   *
   * cloud-sync.js and bracket.js are independent scripts, so on a
   * fast page load cloud-sync.js can attempt to load Supabase data
   * before __RADIUM_SET_DATA exists.
   */
  const waitForStateBridge=async(timeoutMs=5000)=>{

    const started=Date.now();

    while(
      typeof window.__RADIUM_SET_DATA!=='function'
    ){

      if(Date.now()-started>=timeoutMs){
        return false;
      }

      await new Promise(resolve=>setTimeout(resolve,50));
    }

    return true;
  };
  // Strict Supabase mode: no tournament snapshots are written to browser storage.
  async function emergencyWrite(){return false}
  async function emergencyRead(){return null}
  async function emergencyClear(){return true}
  function emergencyMessage(){return 'SUPABASE REQUIRED • Tournament changes are not saved while offline.'}
  function browserOnline(){return typeof navigator==='undefined'||navigator.onLine!==false;}
  const cloud={
    state:{ready:false,syncing:false,lastSync:null,lastError:null,tournamentId:null,loaded:false,dirty:false,pendingCount:0},
    async init(){
      if(initialized && window.RADIUM_DB?.state?.client && window.RADIUM_DB?.state?.enabled) return true;
      if(!window.RADIUM_DB){this.state.ready=false;this.state.lastError=new Error('Supabase database bridge is unavailable.');return false;}
      try{
        const r=await window.RADIUM_DB.init();
        initialized=!!r?.enabled;
        this.state.ready=initialized;
        if(!initialized)this.state.lastError=new Error(r?.reason||'Supabase could not initialize');
        else this.state.lastError=null;
        return initialized;
      }catch(e){
        initialized=false;this.state.ready=false;this.state.lastError=e;
        console.error('RADIUM Supabase initialization failed:',e);
        return false;
      }
    },
    getId(){return String(this.state.tournamentId||'')},
    setId(id){this.state.tournamentId=id||null;updateTournamentIdBadge(this.state.tournamentId)},
    clearId(){this.state.tournamentId=null;this.state.loaded=false;updateTournamentIdBadge(null)},
    payload(){const x=JSON.parse(JSON.stringify(window.__RADIUM_GET_DATA?window.__RADIUM_GET_DATA():fresh()));if(x.setup){delete x.setup.pin;delete x.setup.scoreboardLogos;}delete x.autoBackups;delete x.resultUndo;x.tournamentId=this.getId()||x.tournamentId||null;x.storageNamespace=null;x._cloud={version:3,clientSavedAt:Date.now(),savedAt:new Date().toISOString()};return x},
    setStatus(text,ok,errorText){setTimeout(updateEmergencyBanner,0);const el=document.getElementById('dbTournamentState');if(el)el.textContent=text;const err=document.getElementById('dbStatusError');if(err){err.hidden=!errorText;err.textContent=errorText||''}},
    errorText(e){const raw=e?.message||e?.details?.message||e?.details?.hint||String(e||'Unknown error');return role()==='admin'?raw:'Please check the tournament connection and try again.'},
    async deleteCategory(categoryId){
      if(!(await this.init()))throw new Error('Supabase is not configured.');
      if(!['admin','tournament_manager'].includes(role()))throw new Error('Admin or Tournament Manager account required.');
      const tid=this.getId();if(!tid)throw new Error('No active tournament selected.');
      if(!UUID.test(String(categoryId||'')))throw new Error('Category ID is invalid; reload categories from Supabase and try again.');
      categoryDeleteInProgress=true;clearTimeout(timer);timer=null;
      try{
        while(syncing||startingPush)await new Promise(resolve=>setTimeout(resolve,50));
        const db=window.RADIUM_DB;
        const before=await db.select('categories',{select:'id,tournament_id,name',eq:{id:categoryId,tournament_id:tid},limit:1});
        if(before.error)throw before.error;
        if(!before.data?.length)throw new Error('This category is not present in Supabase. Refresh the page and check the selected tournament.');
        const removed=await db.remove('categories',{id:categoryId,tournament_id:tid});
        if(removed?.error)throw removed.error;
        const verify=await db.select('categories',{select:'id',eq:{id:categoryId,tournament_id:tid},limit:1});
        if(verify.error)throw verify.error;
        if(verify.data?.length)throw new Error('Supabase did not confirm category deletion. The category was kept in the page.');
        syncAgain=false;
        return true;
      }finally{categoryDeleteInProgress=false;if(syncAgain){syncAgain=false;clearTimeout(timer);timer=setTimeout(()=>this.push(),200);}}
    },
    async syncNormalized(tid,state){
      if(!tid||!state)throw new Error('Tournament ID is missing.');
      const db=window.RADIUM_DB;
      const fail=async(label,r)=>{if(r?.error)throw new Error(label+': '+this.errorText(r.error));return r};
      const materialize=async(table,rows,label)=>{
        const out=[];
        for(const original of rows){
          const row={...original}; const oldId=row.id;
          if(UUID.test(String(oldId||''))){out.push(row);continue}
          delete row.id;
          const r=await fail(label,await db.insert(table,row));
          const made=r.data?.[0]; if(!made?.id)throw new Error(label+': Supabase did not return the generated ID.');
          out.push({...row,id:made.id});
          if(oldId) replaceIds(state,oldId,made.id);
        }
        const existing=out.filter(x=>UUID.test(String(x.id||'')));
        if(existing.length) await fail(label,await db.upsertNoReturn(table,existing,{onConflict:'id'}));
        return out;
      };
      const splitName=name=>{const a=String(name||'').trim().split(/\s+/).filter(Boolean);if(a.length<=1)return{first:a[0]||'Player',middle:null,last:'Player'};return{first:a[0],middle:a.length>2?a.slice(1,-1).join(' '):null,last:a[a.length-1]}};
      const teams0=(state.teams||[]).map(t=>({id:t.id,tournament_id:tid,name:String(t.name||'Team'),abbreviation:t.code||t.abbreviation||null,logo_url:t.logo||t.logo_url||null,coach:t.coach||null,manager:t.manager||null}));
      const teams=await materialize('teams',teams0,'Teams sync');
      const teamIds=new Set(teams.map(t=>t.id));
      const players0=(state.players||[]).map(p=>{const n=splitName(p.name);return{id:p.id,tournament_id:tid,team_id:teamIds.has(p.teamId)?p.teamId:null,first_name:n.first,middle_name:n.middle,last_name:n.last,nickname:p.nick||p.nickname||null,gender:p.sex||p.gender||null,birthdate:p.birth||p.birthdate||null,age:Number.isFinite(Number(p.age))?Number(p.age):null,weight:Number.isFinite(Number(p.weight))?Number(p.weight):null,school:p.school||null,player_number:p.number||null,seed:Number.isFinite(Number(p.seed))?Number(p.seed):null,coach:p.coach||null,photo_url:p.photo||p.photo_url||null,events:p.events||{},status:p.status||'active'};});
      const players=await materialize('players',players0,'Players sync'); const playerIds=new Set(players.map(p=>p.id));
      // Normalize each player's Anyo registrations into Supabase. The player.events JSON remains a compatibility/cache field, but this table is the authoritative event registration list.
      await fail('Anyo player event cleanup',await db.remove('player_anyo_events',{tournament_id:tid}));
      const anyoEventRows=[];for(const p of state.players||[]){if(!playerIds.has(p.id))continue;const e=p.events||{};const byDivision={Individual:Array.isArray(e.anyoIndividualEvents)?e.anyoIndividualEvents:[],Synchronized:Array.isArray(e.anyoSynchronizedEvents)?e.anyoSynchronizedEvents:[]};if(!byDivision.Individual.length&&!byDivision.Synchronized.length){const legacy=[];if(e.anyoTraditional)for(const w of (e.anyoTraditionalWeapons||[e.anyoWeapons||'Single Weapon']))legacy.push(`Traditional|${w}`);if(e.anyoNonTraditional)for(const w of (e.anyoNonTraditionalWeapons||[e.anyoWeapons||'Single Weapon']))legacy.push(`Non-Traditional|${w}`);if(e.anyoIndividual)byDivision.Individual=legacy;if(e.anyoTeam)byDivision.Synchronized=legacy;}for(const division of ['Individual','Synchronized'])for(const combo of byDivision[division]){const [style,weapon]=String(combo).split('|');if(style&&weapon)anyoEventRows.push({tournament_id:tid,player_id:p.id,division,style,weapon});}}
      if(anyoEventRows.length)await fail('Anyo player events sync',await db.insert('player_anyo_events',anyoEventRows));
      const depedPekaf=String(state.setup?.competitionProgram||'').toUpperCase()==='DEPED_PEKAF';
      const cats0=(state.categories||[]).map(c=>({id:c.id,tournament_id:tid,name:String(c.name||'Category'),event_type:c.event==='Arnis Anyo'?'Anyo':(c.event==='Livestick'?'Livestick':'Combative'),gender:c.sex||null,event_number:c.eventNumber||c.number||null,judges:Math.min(5,Math.max(3,Number(c.judges)||5)),preset:c.preset||null,weight_required:c.event!=='Arnis Anyo'&&depedPekaf?true:!!(c.weightRequired||c.requireWeight||c.weightFrom>0||c.weightTo<999),bracket_by:c.event!=='Arnis Anyo'&&depedPekaf?'weight':(c.bracketBy||null),bracket:c.bracket||{},age_min:Number.isFinite(Number(c.ageFrom))?Number(c.ageFrom):null,age_max:Number.isFinite(Number(c.ageTo))?Number(c.ageTo):null,weight_min:Number.isFinite(Number(c.weightFrom))?Number(c.weightFrom):null,weight_max:Number.isFinite(Number(c.weightTo))?Number(c.weightTo):null,division:c.anyoType||null,style:c.anyoStyle||null,weapon:c.anyoWeapon||null,scoring_type:c.event==='Arnis Anyo'?'judge_average':'combat',rules:{draw:c.draw||'random',weightRequired:c.event!=='Arnis Anyo'&&depedPekaf?true:!!c.weightRequired},status:'active'}));
      const cats=await materialize('categories',cats0,'Categories sync'); const catIds=new Set(cats.map(c=>c.id));
      // category_players is the authoritative seed/roster table used by the
      // bracket. DepEd-PEKAF Combative is special: its authoritative roster is
      // category registration + verified category weigh-in, not the legacy
      // players.events.combat flag. The Draw Lots screen uses the same rule.
      // Keeping this branch here prevents the normal tournament sync from
      // deleting freshly-saved physical draw seeds immediately after SAVE.
      const activeRegIds=new Map();
      for(const r of (state.registrations||[])){
        const st=String(r.status||'ACTIVE').toUpperCase();
        if(['CANCELLED','DELETED','WITHDRAWN'].includes(st)||!r.playerId||!r.categoryId)continue;
        const key=String(r.categoryId);
        if(!activeRegIds.has(key))activeRegIds.set(key,new Set());
        activeRegIds.get(key).add(String(r.playerId));
      }
      const verifiedWeighins=new Set();
      for(const [key,w] of Object.entries(state.weighIns||{})){
        if(w?.verified===true&&w?.categoryId&&w?.playerId)verifiedWeighins.add(String(w.categoryId)+'|'+String(w.playerId));
      }
      // Preserve authoritative Draw Lots values already stored in Supabase.
      // category_players intentionally has no tournament_id column; category_id is
      // scoped through the tournament's categories. Never replace a saved seed or
      // draw number with null merely because the browser state is stale.
      const existingCategoryPlayersRes=await db.select('category_players',{select:'category_id,player_id,seed,draw_number,draw_type,drawn_at,status'});
      if(existingCategoryPlayersRes?.error)throw existingCategoryPlayersRes.error;
      const existingCategoryPlayers=new Map((existingCategoryPlayersRes.data||[]).map(x=>[String(x.category_id)+'|'+String(x.player_id),x]));
      const cp=[];
      for(const c of state.categories||[]){
        if(!catIds.has(c.id))continue;
        const depedCombative=depedPekaf&&c.event!=='Arnis Anyo'&&c.event!=='Livestick';
        if(depedCombative){
          const registered=activeRegIds.get(String(c.id))||new Set();
          for(const p of state.players||[]){
            if(!playerIds.has(p.id)||!registered.has(String(p.id))||!verifiedWeighins.has(String(c.id)+'|'+String(p.id)))continue;
            const age=Number(p.age),weightKey=String(c.id)+'|'+String(p.id),w=state.weighIns?.[weightKey],weight=Number(w?.weight);
            if(!Number.isFinite(age)||age<Number(c.ageFrom)||age>Number(c.ageTo))continue;
            if(c.sex&&c.sex!=='Mixed'&&c.sex!==p.sex)continue;
            if(!Number.isFinite(weight)||weight<Number(c.weightFrom||0)||weight>Number(c.weightTo||999))continue;
            const cs=p.categorySeeds?.[c.id]||{},existing=existingCategoryPlayers.get(String(c.id)+'|'+String(p.id));
            const seed=Number.isFinite(Number(cs.seed))?Number(cs.seed):(Number.isFinite(Number(existing?.seed))?Number(existing.seed):(Number.isFinite(Number(p.seed))?Number(p.seed):null));
            const drawNumber=Number.isFinite(Number(cs.drawNumber))?Number(cs.drawNumber):(Number.isFinite(Number(existing?.draw_number))?Number(existing.draw_number):null);
            cp.push({category_id:c.id,player_id:p.id,seed,draw_number:drawNumber,draw_type:cs.drawType||existing?.draw_type||null,drawn_at:cs.drawnAt||existing?.drawn_at||null,status:existing?.status||'active'});
          }
        }else{
          for(const p of state.players||[]){
            if(playerIds.has(p.id)&&eligibleForCategory(p,c)){
              const cs=p.categorySeeds?.[c.id]||{},existing=existingCategoryPlayers.get(String(c.id)+'|'+String(p.id));
              const seed=Number.isFinite(Number(cs.seed))?Number(cs.seed):(Number.isFinite(Number(existing?.seed))?Number(existing.seed):(Number.isFinite(Number(p.seed))?Number(p.seed):null));
              const drawNumber=Number.isFinite(Number(cs.drawNumber))?Number(cs.drawNumber):(Number.isFinite(Number(existing?.draw_number))?Number(existing.draw_number):null);
              cp.push({category_id:c.id,player_id:p.id,seed,draw_number:drawNumber,draw_type:cs.drawType||existing?.draw_type||null,drawn_at:cs.drawnAt||existing?.drawn_at||null,status:existing?.status||'active'});
            }
          }
        }
      }
      // Never delete category_players for DepEd-PEKAF Combative during a general
      // tournament sync. Physical Draw Lots seeds are permanent tournament data;
      // deleting them here would make a successful SAVE revert to registration
      // order when the user changes tabs or refreshes. Stale registration rows are
      // harmless because bracket loading still filters by active registration and
      // verified weigh-in. Other event types retain the existing cleanup behavior.
      for(const c of cats){
        const depedCombative=depedPekaf&&String((state.categories||[]).find(x=>String(x.id)===String(c.id))?.event||'')!=='Arnis Anyo'&&String((state.categories||[]).find(x=>String(x.id)===String(c.id))?.event||'')!=='Livestick';
        if(!depedCombative)await fail('Category players cleanup',await db.remove('category_players',{category_id:c.id}));
      }
      if(cp.length)await fail('Category players sync',await db.upsertNoReturn('category_players',cp,{onConflict:'category_id,player_id'}));
      // Normalize Anyo competition entries. Individual entries are derived from player registrations;
      // Synchronized/Mixed entries come from the dedicated registration UI.
      // Preserve Supabase Anyo draw order if the browser state is stale.
      // Draw order is an official physical-draw result and must never be cleared
      // by a background tournament sync.
      const existingAnyoRes=await db.select('anyo_entries',{select:'id,tournament_id,category_id,entry_type,entry_number,draw_order,draw_type,drawn_at,status',eq:{tournament_id:tid}});
      if(existingAnyoRes?.error)throw existingAnyoRes.error;
      const existingAnyo=new Map((existingAnyoRes.data||[]).map(x=>[String(x.id),x]));
      const existingAnyoByKey=new Map((existingAnyoRes.data||[]).map(x=>[String(x.category_id)+'|'+String(x.entry_type)+'|'+String(x.entry_number||''),x]));
      const entryRows0=[];const memberRows0=[];const stateEntries=Array.isArray(state.anyoEntries)?state.anyoEntries:[];
      for(const c of state.categories||[]){if(c.event!=='Arnis Anyo')continue;const type=c.anyoType||'Individual';
        if(type==='Individual'){
          for(const pl of state.players||[]){if(!playerIds.has(pl.id)||!eligibleForCategory(pl,c)||pl.events?.anyoIndividual!==true)continue;let existing=stateEntries.find(e=>e.categoryId===c.id&&e.type==='Individual'&&Array.isArray(e.memberIds)&&e.memberIds[0]===pl.id&&e.status!=='deleted');if(!existing){existing={id:uid(),number:pl.number||('IND-'+String(stateEntries.filter(e=>e.categoryId===c.id).length+1).padStart(3,'0')),type:'Individual',categoryId:c.id,style:c.anyoStyle||'Traditional',weapon:c.anyoWeapon,groupReference:'',status:'active'};stateEntries.push(existing);if(Array.isArray(state.anyoEntries))state.anyoEntries.push(existing);}entryRows0.push({id:existing.id,tournament_id:tid,category_id:c.id,entry_type:'Individual',entry_number:existing.number||pl.number||null,style:c.anyoStyle||'Traditional',weapon:c.anyoWeapon,group_reference:existing.groupReference||null,status:existing.status||'active',draw_order:Number.isFinite(Number(existing.drawOrder))?Number(existing.drawOrder):(Number.isFinite(Number((existingAnyo.get(String(existing.id))||existingAnyoByKey.get(String(c.id)+'|Individual|'+String(existing.number||pl.number||'')))?.draw_order))?Number((existingAnyo.get(String(existing.id))||existingAnyoByKey.get(String(c.id)+'|Individual|'+String(existing.number||pl.number||''))).draw_order):null),draw_type:existing.drawType||((existingAnyo.get(String(existing.id))||existingAnyoByKey.get(String(c.id)+'|Individual|'+String(existing.number||pl.number||'')))?.draw_type)||null,drawn_at:existing.drawnAt||((existingAnyo.get(String(existing.id))||existingAnyoByKey.get(String(c.id)+'|Individual|'+String(existing.number||pl.number||'')))?.drawn_at)||null});memberRows0.push({entry_id:existing.id,tournament_id:tid,player_id:pl.id,member_position:1});}
        }else{
          for(const e of stateEntries.filter(e=>e.categoryId===c.id&&e.type===type&&e.status!=='deleted')){const mids=(e.memberIds||[]).filter(x=>playerIds.has(x));if((type==='Mixed'&&mids.length!==2)||(type==='Synchronized'&&(mids.length<2||mids.length>3)))continue;entryRows0.push({id:e.id,tournament_id:tid,category_id:c.id,entry_type:type,entry_number:e.number||null,style:e.style||c.anyoStyle||'Traditional',weapon:e.weapon||c.anyoWeapon,group_reference:e.groupReference||null,status:e.status||'active',draw_order:Number.isFinite(Number(e.drawOrder))?Number(e.drawOrder):(Number.isFinite(Number((existingAnyo.get(String(e.id))||existingAnyoByKey.get(String(c.id)+'|'+String(type)+'|'+String(e.number||'')))?.draw_order))?Number((existingAnyo.get(String(e.id))||existingAnyoByKey.get(String(c.id)+'|'+String(type)+'|'+String(e.number||''))).draw_order):null),draw_type:e.drawType||((existingAnyo.get(String(e.id))||existingAnyoByKey.get(String(c.id)+'|'+String(type)+'|'+String(e.number||'')))?.draw_type)||null,drawn_at:e.drawnAt||((existingAnyo.get(String(e.id))||existingAnyoByKey.get(String(c.id)+'|'+String(type)+'|'+String(e.number||'')))?.drawn_at)||null});mids.forEach((pid,i)=>memberRows0.push({entry_id:e.id,tournament_id:tid,player_id:pid,member_position:i+1}));}
        }
      }
      const anyoEntries=await materialize('anyo_entries',entryRows0,'Anyo entries sync');
      // Keep an explicit local-entry -> Supabase-entry ID map. This is important when
      // a freshly-created local Anyo entry has a temporary/non-UUID ID: performance,
      // registration, and medal rows must always reference the generated Supabase UUID,
      // even if another state object still contains the old local ID during this sync.
      const entryIdMap=new Map();
      for(let i=0;i<entryRows0.length;i++){
        const localId=entryRows0[i]?.id;
        const cloudId=anyoEntries[i]?.id;
        if(localId&&cloudId)entryIdMap.set(String(localId),String(cloudId));
      }
      const toCloudEntryId=id=>entryIdMap.get(String(id))||String(id||'');
      const entryIdSet=new Set(anyoEntries.map(e=>String(e.id)));
      for(const row of memberRows0){row.entry_id=toCloudEntryId(row.entry_id);}
      await fail('Anyo entry members cleanup',await db.remove('anyo_entry_members',{tournament_id:tid}));
      if(memberRows0.length)await fail('Anyo entry members sync',await db.insert('anyo_entry_members',memberRows0));
      // Keep competition registrations authoritative while preserving existing status.
      const existingRegs=await fail('Registration status read',await db.select('category_registrations',{select:'id,player_id,category_id,anyo_entry_id,status,fee_amount,team_id',eq:{tournament_id:tid}}));
      const regByPlayer=new Map((existingRegs.data||[]).filter(r=>r.player_id).map(r=>[String(r.player_id)+'|'+String(r.category_id),r]));
      const regByEntry=new Map((existingRegs.data||[]).filter(r=>r.anyo_entry_id).map(r=>[String(r.anyo_entry_id),r]));
      const regRows=[]; const free=String(state.setup?.billingMode||'PAID').toUpperCase()==='FREE';
      const explicitRegistrationKeys=new Set((state.registrations||[]).filter(r=>r&&r.playerId&&r.categoryId&&!['CANCELLED','DELETED','WITHDRAWN'].includes(String(r.status||'ACTIVE').toUpperCase())).map(r=>String(r.playerId)+'|'+String(r.categoryId)));
      for(const c of state.categories||[]) for(const pl of state.players||[]){
        if(!playerIds.has(pl.id))continue;
        if(c.event==='Arnis Anyo') continue;
        const key=String(pl.id)+'|'+String(c.id),explicit=explicitRegistrationKeys.has(key);
        if(explicit){
          // Explicit registration records preserve the category selected on the entry
          // form; age/sex remain checks here, while actual weight eligibility is decided
          // from the verified weigh-in and never silently changes the selected class.
          const age=Number(pl.age),min=Number(c.ageFrom??c.age_min??0),max=Number(c.ageTo??c.age_max??99),sex=c.sex||c.gender||'';
          if(!Number.isFinite(age)||age<min||age>max)continue;
          if(sex&&sex!=='Mixed'&&sex!==(pl.sex||pl.gender))continue;
        }else if(!eligibleForCategory(pl,c))continue;
        const old=regByPlayer.get(key);
        regRows.push({id:old?.id||null,tournament_id:tid,team_id:teamIds.has(pl.teamId)?pl.teamId:null,player_id:pl.id,category_id:c.id,anyo_entry_id:null,status:old?.status||'ACTIVE',fee_amount:free?0:(old?.fee_amount!=null?Number(old.fee_amount):Number(c.registrationFee)||0),registered_at:old?.registered_at||new Date().toISOString(),updated_at:new Date().toISOString()});
      }
      for(const e of anyoEntries){
        const c=(state.categories||[]).find(x=>String(x.id)===String(e.category_id)); if(!c)continue;
        const old=regByEntry.get(String(e.id));
        const member=(state.anyoEntries||[]).find(x=>String(x.id)===String(e.id));
        const first=(member?.memberIds||[]).map(x=>state.players?.find(p=>String(p.id)===String(x))).find(Boolean);
        regRows.push({id:old?.id||null,tournament_id:tid,team_id:first&&teamIds.has(first.teamId)?first.teamId:null,player_id:null,category_id:c.id,anyo_entry_id:e.id,status:old?.status||((member?.status||'active').toUpperCase()==='WITHDRAWN'?'WITHDRAWN':'ACTIVE'),fee_amount:free?0:(old?.fee_amount!=null?Number(old.fee_amount):Number(c.registrationFee)||0),registered_at:old?.registered_at||new Date().toISOString(),updated_at:new Date().toISOString()});
      }
      const anyoEntryIds=new Set(anyoEntries.map(e=>String(e.id)));const anyoMemberKeys=new Set();for(const e of anyoEntries){const members=(state.anyoEntries||[]).find(x=>String(x.id)===String(e.id))?.memberIds||[];for(const pid of members)anyoMemberKeys.add(String(pid)+'|'+String(e.category_id));}
      for(const old of existingRegs.data||[]){if(old.player_id&&anyoMemberKeys.has(String(old.player_id)+'|'+String(old.category_id))){await fail('Duplicate Anyo registration cleanup',await db.remove('category_registrations',{id:old.id}));}}
      for(const r of regRows){
        if(r.id) await fail('Registration update',await db.update('category_registrations',r,{id:r.id}));
        else { delete r.id; const made=await fail('Registration insert',await db.insert('category_registrations',r)); if(made.data?.[0]?.id)r.id=made.data[0].id; }
      }

      const existingEntries=await fail('Anyo entries cleanup read',await db.select('anyo_entries',{select:'id',eq:{tournament_id:tid}}));for(const old of existingEntries.data||[])if(!entryIdSet.has(old.id))await fail('Stale Anyo entry cleanup',await db.remove('anyo_entries',{id:old.id}));
      const courtCount=Math.max(1,Number(state.setup?.courts)||1);const existingCourts=await fail('Courts read',await db.select('courts',{select:'id,tournament_id,name,court_number,active',eq:{tournament_id:tid}}));const oldByNo=new Map((existingCourts.data||[]).map(x=>[Number(x.court_number),x]));const courtRows=[];for(let i=1;i<=courtCount;i++){const old=oldByNo.get(i);courtRows.push({id:old?.id||null,tournament_id:tid,name:old?.name||('COURT '+i),court_number:i,active:true});}for(const row of courtRows){if(row.id)await fail('Court update',await db.upsertNoReturn('courts',[row],{onConflict:'id'}));else{const x={...row};delete x.id;const r=await fail('Court insert',await db.insert('courts',x));row.id=r.data?.[0]?.id;if(!row.id)throw new Error('Court insert: Supabase did not return generated ID.');}}const courtMap=new Map(courtRows.map(x=>[Number(x.court_number),x.id]));
      const existingMatchState=await fail('Matches state read',await db.select('matches',{select:'id,status,started_at,completed_at,court_id,match_format,category_id,round,match_number,bracket_position,blue_player_id,red_player_id,blue_score,red_score,winner_player_id,metadata',eq:{tournament_id:tid}}));const existingMatchById=new Map((existingMatchState.data||[]).map(x=>[String(x.id),x]));
      const matchRows0=[];const resultByMatch=[];
      for(const c of state.categories||[])for(const [ri,round] of (c.bracket?.rounds||[]).entries())for(const [mi,m] of (round||[]).entries()){
        if(!m?.id)continue;
        const existing=existingMatchById.get(String(m.id));
        const bye=!!(m.redBye||m.blueBye),completed=!!m.completed;
        if(existing){
          // Supabase is authoritative for an existing match. Local UI state may only
          // contribute topology metadata; it must never roll back a completed result,
          // winner, participants, scores, or live status.
          const dbCompleted=String(existing.status).toUpperCase()==='COMPLETED';
          matchRows0.push({id:existing.id,tournament_id:tid,category_id:existing.category_id,court_id:existing.court_id,round:existing.round,match_number:existing.match_number,bracket_position:existing.bracket_position,blue_player_id:existing.blue_player_id,red_player_id:existing.red_player_id,blue_score:Number(existing.blue_score)||0,red_score:Number(existing.red_score)||0,winner_player_id:existing.winner_player_id,status:existing.status,scheduled_at:null,started_at:existing.started_at||null,completed_at:existing.completed_at||null,match_format:existing.match_format||'single',metadata:{...(existing.metadata||{}),redBye:!!(existing.metadata?.redBye||m.redBye),blueBye:!!(existing.metadata?.blueBye||m.blueBye),history:m.history||existing.metadata?.history||[],nextMatchId:m.nextMatchId||existing.metadata?.nextMatchId||null,nextSlot:m.nextSlot||existing.metadata?.nextSlot||null,firstRoundPosition:m.firstRoundPosition??existing.metadata?.firstRoundPosition??null,roundScores:m.roundScores||existing.metadata?.roundScores||null}});
          continue;
        }
        matchRows0.push({id:m.id,tournament_id:tid,category_id:c.id,court_id:m.court&&courtMap.has(Number(m.court))?courtMap.get(Number(m.court)):null,round:ri+1,match_number:mi+1,bracket_position:mi,blue_player_id:playerIds.has(m.blue)?m.blue:null,red_player_id:playerIds.has(m.red)?m.red:null,blue_score:Number(m.blueScore)||0,red_score:Number(m.redScore)||0,winner_player_id:null,status:bye?'BYE':(completed?'COMPLETED':(m.red&&m.blue?'READY':'PENDING')),scheduled_at:null,started_at:null,completed_at:null,match_format:(String(m.matchFormat||m.format||'single')==='single'?'single':'best3'),metadata:{redBye:!!m.redBye,blueBye:!!m.blueBye,history:m.history||[],nextMatchId:m.nextMatchId||null,nextSlot:m.nextSlot||null,firstRoundPosition:m.firstRoundPosition??null,roundScores:m.roundScores||null}});
      }
      for(const r of state.results||[]){const c=(state.categories||[]).find(x=>x.id===r.categoryId||x.name===r.category);if(!c)continue;const rr=Number(r.round),mm=Number(r.match);const row=matchRows0.find(x=>x.category_id===c.id&&x.round===rr&&x.match_number===mm);if(!row||existingMatchById.has(String(row.id)))continue;const winnerId=playerIds.has(r.winner)?r.winner:(state.players||[]).find(p=>p.name===r.winner)?.id||null;row.blue_score=Number(r.blueScore)||0;row.red_score=Number(r.redScore)||0;row.winner_player_id=winnerId;row.status='COMPLETED';row.completed_at=r.completedAt||r.time||new Date().toISOString();row.metadata={...(row.metadata||{}),roundScores:r.roundScores||null};resultByMatch.push({r,row,winnerId});}
      const matches=await materialize('matches',matchRows0,'Matches sync');
      // Match topology references are kept in the in-memory bracket; after generated IDs are known, persist the resolved metadata.
      for(const c of state.categories||[])for(const round of c.bracket?.rounds||[])for(const m of round||[])if(m?.id&&UUID.test(String(m.id))) { const dbm=matches.find(x=>x.id===m.id); if(dbm) await fail('Match metadata update',await db.update('matches',{metadata:{...(dbm.metadata||{}),nextMatchId:UUID.test(String(m.nextMatchId||''))?m.nextMatchId:null,nextSlot:m.nextSlot||null,firstRoundPosition:m.firstRoundPosition??null,history:m.history||[],roundScores:m.roundScores||null,redBye:!!m.redBye,blueBye:!!m.blueBye}},{id:m.id})); }
      const resultRows=[];for(const x of resultByMatch){const row=matches.find(m=>m.category_id===x.row.category_id&&m.round===x.row.round&&m.match_number===x.row.match_number);if(row)resultRows.push({match_id:row.id,blue_score:Number(x.r.blueScore)||0,red_score:Number(x.r.redScore)||0,blue_round_wins:Number(x.r.blueRoundWins)||0,red_round_wins:Number(x.r.redRoundWins)||0,winner_player_id:x.winnerId,blue_fouls:Number(x.r.blueFouls)||0,red_fouls:Number(x.r.redFouls)||0,blue_disarms:Number(x.r.blueDisarms)||0,red_disarms:Number(x.r.redDisarms)||0,submitted_by:null});}
      for(const row of resultRows){const old=await fail('Match result lookup',await db.select('match_results',{select:'id',eq:{match_id:row.match_id},limit:1}));if(old.data?.length)await fail('Match result update',await db.update('match_results',row,{match_id:row.match_id}));else await fail('Match result insert',await db.insert('match_results',row));}
      const matchIdSet=new Set(matches.map(m=>m.id));const existingMatches=await fail('Matches cleanup read',await db.select('matches',{select:'id',eq:{tournament_id:tid}}));const staleMatchIds=(existingMatches.data||[]).filter(old=>!matchIdSet.has(old.id)).map(old=>old.id);if(staleMatchIds.length){if(typeof db.removeIn==='function')await fail('Stale match cleanup',await db.removeIn('matches','id',staleMatchIds,{tournament_id:tid}));else for(const staleId of staleMatchIds)await fail('Stale match cleanup',await db.remove('matches',{id:staleId,tournament_id:tid}));}
      await cleanupTop('players',playerIds,tid,db,fail);await cleanupTop('categories',catIds,tid,db,fail);await cleanupTop('teams',teamIds,tid,db,fail);
      const existingJudges=await fail('Anyo judges read',await db.select('anyo_judges',{select:'id,tournament_id,name,judge_number,active',eq:{tournament_id:tid}}));const judgesByNo=new Map((existingJudges.data||[]).map(j=>[Number(j.judge_number),j]));const judgeByNo=new Map();for(let i=1;i<=5;i++){const old=judgesByNo.get(i);if(old){judgeByNo.set(i,old.id);await fail('Anyo judge update',await db.update('anyo_judges',{name:old.name||('JUDGE '+i),active:true},{id:old.id}));}else{const r=await fail('Anyo judge insert',await db.insert('anyo_judges',{tournament_id:tid,name:'JUDGE '+i,judge_number:i,active:true}));const id=r.data?.[0]?.id;if(!id)throw new Error('Anyo judge insert: Supabase did not return generated ID.');judgeByNo.set(i,id);}}
      const perfRows0=[],scoreRows0=[],deductRows0=[];const anyoCats=new Set(cats.filter(c=>c.event_type==='Anyo').map(c=>c.id));const entryIds=new Set(anyoEntries.map(e=>String(e.id)));for(const r of (state.anyoResults||[])){if(!anyoCats.has(r.categoryId)||!r.competitorId)continue;const entryId=toCloudEntryId(r.entryId||r.competitorId);if(!entryIds.has(String(entryId)))continue;const perfId=r.id;perfRows0.push({id:perfId,tournament_id:tid,category_id:r.categoryId,entry_id:entryId,attempt_number:Math.max(1,Number(r.attemptNumber)||1),player_id:null,team_id:null,performer_index:Number(r.performerIndex)||0,judge_count:Math.min(5,Math.max(3,Number(r.judgeCount)||5)),raw_total:Number(r.rawTotal)||0,kept_total:Number(r.keptTotal)||0,average:Number(r.average)||0,judge_average:Number(r.judgeAverage??r.average)||0,final_score:Number(r.finalScore??r.average)||0,total_deduction:Number(r.totalDeduction)||0,deduction_rates:r.deductionRates||{},dropped_scores:r.dropped||[],elapsed_ms:Number(r.elapsedMs)||0,elapsed_time:r.elapsedTime||null,finished:r.finished!==false,started_at:null,finished_at:r.finishedAt||r.time||new Date().toISOString(),metadata:{categoryName:r.categoryName||'',competitorType:'entry',entryId:entryId}});(r.scores||[]).forEach((score,i)=>{if(score!=null&&judgeByNo.has(i+1))scoreRows0.push({id:null,performance_id:perfId,judge_id:judgeByNo.get(i+1),score:Number(score)});});Object.entries(r.deductions||{}).forEach(([k,q])=>{const qty=Number(q)||0;if(qty>0)deductRows0.push({id:null,performance_id:perfId,violation_type:k==='tv'?'TIME':k==='dv'?'DISARM':k==='lv'?'OUT_OF_MAT':'OTHER',quantity:qty,deduction_amount:(Number(r.deductionRates?.[k])||0)*qty,recorded_by:null});});}
      const existingPerf=await fail('Anyo performance cleanup read',await db.select('anyo_performances',{select:'id',eq:{tournament_id:tid}}));const perfIds0=new Set(perfRows0.filter(x=>UUID.test(String(x.id||''))).map(x=>x.id));for(const old of existingPerf.data||[])if(!perfIds0.has(old.id))await fail('Stale Anyo performance cleanup',await db.remove('anyo_performances',{id:old.id}));
      const perfs=await materialize('anyo_performances',perfRows0,'Anyo performances sync');
      const perfMap=new Map();for(let i=0;i<perfs.length;i++){const old=perfRows0[i]?.id;if(old&&!UUID.test(String(old)))perfMap.set(old,perfs[i].id);}
      for(const row of scoreRows0)if(perfMap.has(row.performance_id))row.performance_id=perfMap.get(row.performance_id);for(const row of deductRows0)if(perfMap.has(row.performance_id))row.performance_id=perfMap.get(row.performance_id);
      for(const perf of perfs) {await fail('Anyo score cleanup',await db.remove('anyo_performance_scores',{performance_id:perf.id}));await fail('Anyo deduction cleanup',await db.remove('anyo_performance_deductions',{performance_id:perf.id}));}
      for(const row of scoreRows0){delete row.id;await fail('Anyo score insert',await db.insert('anyo_performance_scores',row));}for(const row of deductRows0){delete row.id;await fail('Anyo deduction insert',await db.insert('anyo_performance_deductions',row));}
      const medals=(state.medals||[]).filter(m=>m.categoryId&&m.medal).map(m=>{const isAnyo=String(m.source||'')==='anyo';const isTeam=!!m.teamId&&!m.playerId;return{tournament_id:tid,category_id:m.categoryId,entry_id:isAnyo?(m.entryId?toCloudEntryId(m.entryId):null):null,player_id:isAnyo?null:(isTeam?null:(m.playerId||null)),team_id:isAnyo?null:(isTeam?m.teamId:null),medal:m.medal,source:m.source||'combat',score:Number.isFinite(Number(m.score))?Number(m.score):null,awarded_at:m.awardedAt||new Date().toISOString()}});await fail('Medals cleanup',await db.remove('tournament_medals',{tournament_id:tid}));for(const m of medals)await fail('Medal insert',await db.insert('tournament_medals',m));
      const wi=[];Object.entries(state.weighIns||{}).forEach(([key,w])=>{if(!w?.categoryId||!w?.playerId||!playerIds.has(String(w.playerId))||!catIds.has(String(w.categoryId)))return;wi.push({id:UUID.test(String(w.id||''))?w.id:null,tournament_id:tid,category_id:w.categoryId,player_id:w.playerId,weight:Number.isFinite(Number(w.weight))?Number(w.weight):null,verified:!!w.verified,verified_at:w.verifiedAt||null,updated_at:w.updatedAt||new Date().toISOString()})});for(const row of wi){if(row.id){await fail('Weigh-in update',await db.update('weigh_ins',row,{id:row.id}));}else{const existing=await fail('Weigh-in lookup',await db.select('weigh_ins',{select:'id',eq:{tournament_id:tid,category_id:row.category_id,player_id:row.player_id},limit:1}));if(existing.data?.[0]){row.id=existing.data[0].id;await fail('Weigh-in update',await db.update('weigh_ins',row,{id:row.id}));}else{delete row.id;const made=await fail('Weigh-in insert',await db.insert('weigh_ins',row));const id=made.data?.[0]?.id;if(id)replaceIds(state,Object.values(state.weighIns||{}).find(x=>x&&x.categoryId===row.category_id&&String(x.playerId||'')===String(row.player_id))?.id,id);}}}
      const auditRows=(state.audit||[]).map(a=>({id:a.id,tournament_id:tid,user_id:null,role:role()||'admin',action:String(a.action||'TOURNAMENT EVENT'),entity_type:a.entityType||null,entity_id:UUID.test(String(a.entityId||''))?a.entityId:null,old_value:a.oldValue??null,new_value:a.newValue??(a.detail!=null?{detail:String(a.detail)}:null),created_at:a.time||new Date().toISOString()}));for(const a of auditRows){if(UUID.test(String(a.id||''))){const existing=await fail('Audit lookup',await db.select('audit_logs',{select:'id',eq:{id:a.id},limit:1}));if(!existing.data?.length){const x={...a};delete x.id;const r=await fail('Audit insert',await db.insert('audit_logs',x));const made=r.data?.[0]?.id;if(made)replaceIds(state,a.id,made);}}else{const x={...a};delete x.id;const r=await fail('Audit insert',await db.insert('audit_logs',x));const made=r.data?.[0]?.id;if(made)replaceIds(state,a.id,made);}}
    },
    async ensureMembership(tid){const s=await window.RADIUM_DB.session();const uidUser=s.data?.session?.user?.id;if(!uidUser)throw new Error('Supabase session is missing after login.');if(role()==='admin'){const r=await window.RADIUM_DB.upsertNoReturn('tournament_users',{tournament_id:tid,user_id:uidUser,role:'admin'},{onConflict:'tournament_id,user_id'});if(r.error)throw r.error;return true}if(['tournament_manager','accountant','table_official'].includes(role())){const a=await window.RADIUM_DB.rpc('radium_get_my_assigned_tournament',{});if(a.error)throw a.error;const row=Array.isArray(a.data)?a.data[0]:a.data;if(!row?.id)throw new Error('No tournament is assigned to this account. Ask the Admin to assign one.');if(String(row.id)!==String(tid))throw new Error('This staff account can only use its assigned tournament.');return true}throw new Error('Authorized RADIUM staff account required.')},
    async ensureParent(tid,p){const setup=p.setup||{};const existing=await window.RADIUM_DB.select('tournaments',{select:'id,official_pin_hash',eq:{id:tid},limit:1});if(existing.error)throw existing.error;const oldHash=existing.data?.[0]?.official_pin_hash||null;const pinHash=String(setup.pin||'')?await hashPin(setup.pin):(setup.pinHash||oldHash||null);const billingMode=String(setup.billingMode||'PAID').toUpperCase()==='FREE'?'FREE':'PAID';const incoming={version:15,setup:{...setup,billingMode,currency:'PHP',pin:undefined,pinHash:undefined},activeCategory:p.activeCategory||null,locked:!!p.locked,_cloud:{version:3,officialPinHash:pinHash,billingMode,currency:'PHP'}};delete incoming.setup.pin;delete incoming.setup.pinHash;if(!existing.data?.length){if(role()!=='admin')throw new Error('Only Admin can create the initial tournament record.');const row={id:tid,name:setup.name||'Untitled Tournament',venue:setup.venue||null,event_date:setup.date||null,organizer:setup.organizer||null,status:'draft',official_pin_hash:pinHash,billing_mode:billingMode,currency:'PHP',settings:incoming};const r=await window.RADIUM_DB.insertNoReturn('tournaments',row);if(r.error)throw r.error;return}const r=await window.RADIUM_DB.rpc('radium_save_tournament',{tid,incoming});if(r.error)throw r.error;},
    async push(overridePayload=null){
      if(categoryDeleteInProgress||syncing||startingPush){syncAgain=true;return false;}
      startingPush=true;
      const startedVersion=changeVersion;
      if(!(await this.init())){startingPush=false;return false;}
      if(!window.RADIUM_AUTH?.user){this.state.lastError=new Error('No authenticated RADIUM user.');startingPush=false;return false}
      if(!['admin','tournament_manager'].includes(role())){this.state.lastError=new Error('Admin or Tournament Manager account required.');startingPush=false;return false}
      const id=this.getId();
      if(!id){this.state.lastError=new Error('No active tournament selected.');startingPush=false;return false}
      const p=overridePayload||this.payload();
      this.state.dirty=true;
      if(!browserOnline()){
        this.state.pendingCount=0;this.state.lastError=new Error(emergencyMessage());
        this.setStatus('OFFLINE • NOT SAVED',false,emergencyMessage());
        startingPush=false;return false;
      }
      startingPush=false;syncing=true;this.state.syncing=true;this.setStatus('SYNCING TO SUPABASE...',true);
      try{
        if(!this.state.loaded){const loaded=await this.pull();if(!loaded)throw new Error('Cloud state is not loaded yet. Refusing to overwrite Supabase with an uninitialized local state.');}
        await this.ensureParent(id,p);await this.ensureMembership(id);await this.syncNormalized(id,p);
        const verify=await window.RADIUM_DB.select('tournaments',{select:'id,name,venue,event_date,organizer,settings,updated_at',eq:{id},limit:1});
        if(verify.error)throw verify.error;
        const saved=verify.data?.[0];
        if(!saved)throw new Error('The tournament save could not be verified.');
        const expected=String(p.setup?.name||'').trim();
        const actual=String(saved.name||saved.settings?.setup?.name||'').trim();
        if(expected && actual!==expected){
          throw new Error(`Supabase save verification failed: expected tournament name "${expected}" but Supabase returned "${actual||'empty'}".`);
        }
        this.state.lastSync=saved.updated_at||new Date().toISOString();this.state.tournamentId=id;this.state.lastError=null;this.state.dirty=changeVersion>startedVersion;
        await emergencyClear(id);this.state.pendingCount=0;this.setStatus('ONLINE • SYNCED',true);return true;
      }catch(e){
        this.state.lastError=e;this.state.pendingCount=0;
        this.setStatus('SUPABASE SAVE FAILED',false,'Supabase sync failed. No local tournament copy was written. Please retry when connected.');
        console.error('RADIUM cloud push failed:',e);
        return false;
      }finally{syncing=false;this.state.syncing=false;const shouldRetry=syncAgain||changeVersion>startedVersion;if(shouldRetry){syncAgain=false;clearTimeout(timer);timer=setTimeout(()=>{if(!categoryDeleteInProgress)this.push();else syncAgain=true},150);}}
    },
    async flushEmergency(){return false},
    async pendingEmergency(){this.state.pendingCount=0;return null},
    async pull(){if(!(await this.init()))return false;const id=this.getId();if(!id)return false;try{const db=window.RADIUM_DB;const t=await db.select('tournaments',{select:'id,name,venue,event_date,organizer,status,official_pin_hash,settings,updated_at',eq:{id},limit:1});if(t.error)throw t.error;const row=t.data?.[0];if(!row)throw new Error('Tournament not found in Supabase.');// Load the tournament core first. A problem in an optional operational table
      // must never make the entire tournament (especially Categories/Anyo) disappear.
      // Load core collections independently. Categories are authoritative and must
      // never disappear because an auxiliary registration/eligibility table has an
      // RLS or legacy-schema problem.
      const safeCore=async(name,promise)=>{try{const r=await promise;return r.error?{data:[],error:null,_coreError:r.error}:r}catch(e){return {data:[],error:null,_coreError:e}}};
      const [teams,players,playerAnyoEvents,cats,cps,registrations]=await Promise.all([
        safeCore('teams',db.select('teams',{select:'*',eq:{tournament_id:id}})),
        safeCore('players',db.select('players',{select:'*',eq:{tournament_id:id}})),
        safeCore('playerAnyoEvents',db.select('player_anyo_events',{select:'*',eq:{tournament_id:id}})),
        safeCore('categories',db.select('categories',{select:'*',eq:{tournament_id:id}})),
        safeCore('category_players',db.select('category_players',{select:'*'})),
        safeCore('registrations',db.select('category_registrations',{select:'id,team_id,player_id,category_id,anyo_entry_id,status,fee_amount,registered_at,updated_at',eq:{tournament_id:id}}))
      ]);
      const coreErrors=Object.entries({teams,players,playerAnyoEvents,cats,cps,registrations}).filter(([,r])=>r._coreError);
      if(coreErrors.length)console.warn('RADIUM core cloud collections with read issues; available data will still render:',coreErrors.map(([n,r])=>n+': '+this.errorText(r._coreError)).join(' | '));
      // A second, minimal categories read protects the ANYO page from a malformed
      // combined request or legacy category relation.
      if(!Array.isArray(cats.data)||!cats.data.length){
        const directCats=await safeCore('categories-direct',db.select('categories',{select:'id,tournament_id,name,event_type,gender,event_number,judges,preset,weight_required,bracket_by,bracket,age_min,age_max,weight_min,weight_max,division,style,weapon,scoring_type,rules,status,created_at,updated_at',eq:{tournament_id:id}}));
        if(Array.isArray(directCats.data)&&directCats.data.length) cats.data=directCats.data;
      }

      // Secondary tables are optional for rendering the core UI. Keep their data
      // when available, but degrade gracefully when an empty/legacy table or an
      // operational RLS policy prevents reading it.
      const safe=async(name,promise)=>{try{const r=await promise;return r.error?{data:[],error:null,_optionalError:r.error}:r}catch(e){return {data:[],error:null,_optionalError:e}}};
      const [courts,matches,results,judges,anyoEntries,anyoEntryMembers,perfs,perfScores,perfDeductions,medals,weighins,audit]=await Promise.all([
        safe('courts',db.select('courts',{select:'*',eq:{tournament_id:id}})),
        safe('matches',db.select('matches',{select:'*',eq:{tournament_id:id}})),
        safe('results',db.select('match_results',{select:'*'})),
        safe('judges',db.select('anyo_judges',{select:'*',eq:{tournament_id:id}})),
        safe('anyoEntries',db.select('anyo_entries',{select:'*',eq:{tournament_id:id}})),
        safe('anyoEntryMembers',db.select('anyo_entry_members',{select:'*',eq:{tournament_id:id}})),
        safe('perfs',db.select('anyo_performances',{select:'*',eq:{tournament_id:id}})),
        safe('perfScores',db.select('anyo_performance_scores',{select:'*'})),
        safe('perfDeductions',db.select('anyo_performance_deductions',{select:'*'})),
        safe('medals',db.select('tournament_medals',{select:'*',eq:{tournament_id:id}})),
        safe('weighins',db.select('weigh_ins',{select:'*',eq:{tournament_id:id}})),
        safe('audit',db.select('audit_logs',{select:'*',eq:{tournament_id:id},order:{column:'created_at',ascending:false}}))
      ]);
      const optionalErrors=Object.entries({courts,matches,results,judges,anyoEntries,anyoEntryMembers,perfs,perfScores,perfDeductions,medals,weighins,audit}).filter(([,r])=>r._optionalError);
      if(optionalErrors.length)console.warn('RADIUM optional cloud tables unavailable; core tournament still loaded:',optionalErrors.map(([n,r])=>n+': '+this.errorText(r._optionalError)).join(' | '));
      const setup={...(row.settings?.setup||{}),name:row.name||row.settings?.setup?.name||'',date:row.event_date||row.settings?.setup?.date||new Date().toISOString().slice(0,10),venue:row.venue||row.settings?.setup?.venue||'',organizer:row.organizer||row.settings?.setup?.organizer||'',billingMode:(row.billing_mode||row.settings?.setup?.billingMode||'PAID')==='FREE'?'FREE':'PAID',currency:row.currency||'PHP',combativeRounds:Number(row.settings?.setup?.combativeRounds)===1?1:3,pin:'',pinHash:row.official_pin_hash||'',scoreboardLogos:['','','','']};
      const teamRows=teams.data||[],playerRows=players.data||[],catRows=cats.data||[],cpRows=cps.data||[];const categoryPlayers=new Map();cpRows.filter(x=>catRows.some(c=>c.id===x.category_id)&&playerRows.some(p=>p.id===x.player_id)).forEach(x=>{if(!categoryPlayers.has(x.category_id))categoryPlayers.set(x.category_id,new Map());categoryPlayers.get(x.category_id).set(x.player_id,{seed:x.seed,drawNumber:x.draw_number,drawType:x.draw_type,drawnAt:x.drawn_at});});
      const localPlayers=playerRows.map(p=>({id:p.id,number:p.player_number||p.id.slice(0,6).toUpperCase(),seed:p.seed||null,categorySeeds:{},name:[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(' '),nick:p.nickname||'',sex:p.gender||'Male',birth:p.birthdate||'',age:Number(p.age)||0,weight:Number(p.weight)||0,school:p.school||'',teamId:p.team_id||'',coach:p.coach||'',photo:p.photo_url||'',events:p.events||{}}));
      const anyoByPlayer=new Map();for(const r of (playerAnyoEvents.data||[])){if(!anyoByPlayer.has(r.player_id))anyoByPlayer.set(r.player_id,[]);anyoByPlayer.get(r.player_id).push(r)}
      const localTeams=teamRows.map(t=>({id:t.id,name:t.name,code:t.abbreviation||'',logo:t.logo_url||'',coach:t.coach||'',manager:t.manager||''}));
      localPlayers.forEach(p=>{cpRows.filter(x=>x.player_id===p.id).forEach(x=>{p.categorySeeds[x.category_id]={seed:x.seed,drawNumber:x.draw_number,drawType:x.draw_type,drawnAt:x.drawn_at}});const rows=anyoByPlayer.get(p.id)||[];if(rows.length){const ind=rows.filter(r=>r.division==='Individual'),syncRows=rows.filter(r=>r.division==='Synchronized'),comboRows=a=>a.map(r=>`${r.style}|${r.weapon}`);p.events={...(p.events||{}),anyoIndividual:ind.length>0,anyoTeam:syncRows.length>0,anyoIndividualEvents:[...new Set(comboRows(ind))],anyoSynchronizedEvents:[...new Set(comboRows(syncRows))],anyoTraditional:rows.some(r=>r.style==='Traditional'),anyoNonTraditional:rows.some(r=>r.style==='Non-Traditional'),anyoTraditionalWeapons:[...new Set(rows.filter(r=>r.style==='Traditional').map(r=>r.weapon))],anyoNonTraditionalWeapons:[...new Set(rows.filter(r=>r.style==='Non-Traditional').map(r=>r.weapon))]};p.events.anyoWeapons=p.events.anyoTraditionalWeapons[0]||p.events.anyoNonTraditionalWeapons[0]||'Single Weapon';}});
      const matchRows=matches.data||[];const resultRows=results.data||[];const resultByMatch=new Map(resultRows.map(r=>[r.match_id,r]));const categoryLocal=catRows.map(c=>{const rounds=[];const ms=matchRows.filter(m=>m.category_id===c.id).sort((a,b)=>a.round-b.round||a.match_number-b.match_number);for(const m of ms){const ri=Math.max(0,Number(m.round)-1),mi=Math.max(0,Number(m.match_number)-1);if(!rounds[ri])rounds[ri]=[];const meta=m.metadata||{};const rr=resultByMatch.get(m.id);const courtNo=Number((courts.data||[]).find(x=>x.id===m.court_id)?.court_number)||null;rounds[ri][mi]={id:m.id,red:m.red_player_id||null,blue:m.blue_player_id||null,redScore:Number(m.red_score)||0,blueScore:Number(m.blue_score)||0,completed:['COMPLETED','BYE'].includes(String(m.status)),winner:m.winner_player_id||null,redBye:!!meta.redBye,blueBye:!!meta.blueBye,court:courtNo,matchFormat:m.match_format==='single'?'single':'best3',history:meta.history||[],nextMatchId:meta.nextMatchId||null,nextSlot:meta.nextSlot||null,firstRoundPosition:meta.firstRoundPosition??null};}
        let b=c.bracket||{};b={...b,rounds:rounds.map(r=>r||[]),locked:!!(b.locked||row.settings?.locked)};const depedCat=String(row.settings?.competitionProgram||row.settings?.competition_program||'').toUpperCase()==='DEPED_PEKAF'&&c.event_type!=='Anyo';return{id:c.id,name:c.name,sex:c.gender||'Male',event:c.event_type==='Anyo'?'Arnis Anyo':(c.event_type==='Livestick'?'Livestick':'Padded Stick'),eventNumber:c.event_number||'',judges:Number(c.judges)||5,preset:c.preset||'',anyoType:c.division||'',anyoStyle:c.style||'',anyoWeapon:c.weapon||'Any',ageFrom:Number(c.age_min)||0,ageTo:Number(c.age_max)||99,weightFrom:Number(c.weight_min)||0,weightTo:Number(c.weight_max)||999,weightRequired:depedCat||!!c.weight_required,bracketBy:depedCat?'weight':(c.bracket_by||null),draw:c.rules?.draw||'random',bracket:b};});
      const localResults=resultRows.map(r=>{const m=matchRows.find(x=>x.id===r.match_id),c=categoryLocal.find(x=>x.id===m?.category_id),bp=localPlayers.find(p=>p.id===m?.blue_player_id),rp=localPlayers.find(p=>p.id===m?.red_player_id),wp=localPlayers.find(p=>p.id===r.winner_player_id);return{id:r.id,time:r.created_at,completedAt:r.created_at,court:m?.court_id?((courts.data||[]).find(x=>x.id===m.court_id)?.court_number||1):1,categoryId:c?.id||m?.category_id,category:c?.name||'',round:m?.round||1,match:m?.match_number||1,blue:bp?.name||m?.blue_player_id||'',red:rp?.name||m?.red_player_id||'',blueScore:Number(r.blue_score)||0,redScore:Number(r.red_score)||0,winner:r.winner_player_id||'',winnerSide:r.winner_player_id===m?.blue_player_id?'BLUE':'RED',blueFouls:r.blue_fouls||0,redFouls:r.red_fouls||0,blueDisarms:r.blue_disarms||0,redDisarms:r.red_disarms||0,roundScores:m?.metadata?.roundScores||[],official:'Scoreboard',finished:true};});
      const judgeById=new Map((judges.data||[]).map(j=>[j.id,j]));const scoreByPerf=new Map();(perfScores.data||[]).forEach(s=>{if(!scoreByPerf.has(s.performance_id))scoreByPerf.set(s.performance_id,[]);scoreByPerf.get(s.performance_id).push(s)});const dedByPerf=new Map();(perfDeductions.data||[]).forEach(d=>{if(!dedByPerf.has(d.performance_id))dedByPerf.set(d.performance_id,[]);dedByPerf.get(d.performance_id).push(d)});const localAnyo=(perfs.data||[]).map(p=>{const ss=(scoreByPerf.get(p.id)||[]).sort((a,b)=>Number(judgeById.get(a.judge_id)?.judge_number||0)-Number(judgeById.get(b.judge_id)?.judge_number||0)).map(s=>Number(s.score));const ds=dedByPerf.get(p.id)||[];const deductions={tv:0,dv:0,lv:0,fp:0};ds.forEach(d=>{const k=d.violation_type==='TIME'?'tv':d.violation_type==='DISARM'?'dv':d.violation_type==='OUT_OF_MAT'?'lv':'fp';deductions[k]=(deductions[k]||0)+Number(d.quantity||0)});return{id:p.id,time:p.created_at,finishedAt:p.finished_at,finished:p.finished,attemptNumber:Math.max(1,Number(p.attempt_number)||1),categoryId:p.category_id,categoryName:categoryLocal.find(c=>c.id===p.category_id)?.name||'',competitorType:'entry',competitorId:p.entry_id||p.id,entryId:p.entry_id||p.id,judgeCount:p.judge_count,rawTotal:Number(p.raw_total)||0,dropped:p.dropped_scores||[],keptTotal:Number(p.kept_total)||0,average:Number(p.average)||0,judgeAverage:Number(p.judge_average)||0,finalScore:Number(p.final_score)||0,deductions,deductionRates:p.deduction_rates||{},totalDeduction:Number(p.total_deduction)||0,scores:ss,elapsedMs:Number(p.elapsed_ms)||0,elapsedTime:p.elapsed_time||'',performerIndex:Number(p.performer_index)||0};});
      const localMedals=(medals.data||[]).map(m=>({id:m.id,categoryId:m.category_id,entryId:m.entry_id||'',playerId:m.player_id||'',teamId:m.team_id||'',medal:m.medal,source:m.source,score:Number(m.score)||0,awardedAt:m.awarded_at}));const localWi={};(weighins.data||[]).forEach(w=>{localWi[String(w.category_id)+'|'+String(w.player_id)]={id:w.id,categoryId:w.category_id,weight:Number(w.weight)||0,verified:!!w.verified,verifiedAt:w.verified_at,updatedAt:w.updated_at}});const localAudit=(audit.data||[]).map(a=>({id:a.id,time:a.created_at,action:a.action,detail:a.new_value?.detail||'',entityType:a.entity_type,entityId:a.entity_id,oldValue:a.old_value,newValue:a.new_value}));const membersByEntry=new Map();(anyoEntryMembers.data||[]).forEach(m=>{if(!membersByEntry.has(m.entry_id))membersByEntry.set(m.entry_id,[]);membersByEntry.get(m.entry_id).push(m)});const localEntries=(anyoEntries.data||[]).map(e=>({id:e.id,number:e.entry_number||'',type:e.entry_type,categoryId:e.category_id,style:e.style,weapon:e.weapon,groupReference:e.group_reference||'',status:e.status,drawOrder:Number.isFinite(Number(e.draw_order))?Number(e.draw_order):null,drawType:e.draw_type||null,drawnAt:e.drawn_at||null,memberIds:(membersByEntry.get(e.id)||[]).sort((a,b)=>a.member_position-b.member_position).map(m=>m.player_id)}));
      const localRegistrations=(registrations.data||[]).map(r=>({id:r.id,teamId:r.team_id||'',playerId:r.player_id||'',categoryId:r.category_id||'',anyoEntryId:r.anyo_entry_id||null,status:String(r.status||'ACTIVE').toUpperCase(),feeAmount:Number(r.fee_amount)||0,registeredAt:r.registered_at||null,updatedAt:r.updated_at||null}));const incoming={version:16,tournamentId:id,storageNamespace:null,setup,teams:localTeams,players:localPlayers,categories:categoryLocal,registrations:localRegistrations,results:localResults,medals:localMedals,audit:localAudit,activeCategory:row.settings?.activeCategory||null,locked:!!row.settings?.locked,anyoResults:localAnyo,weighIns:localWi,anyoEntries:localEntries};this.setId(id);

if(!(await waitForStateBridge())){
  throw new Error(
    'Tournament state is not ready after application initialization.'
  );
}

window.__RADIUM_SET_DATA(
  incoming,
  {fromCloud:true}
);this.state.lastSync=row.updated_at||new Date().toISOString();this.state.tournamentId=id;this.state.assignedStatus=String(row.status||'').toLowerCase();this.state.loaded=true;document.body.classList.toggle('locked',String(row.status||'').toLowerCase()==='active' || !!incoming.locked);this.state.lastError=null;this.setStatus('TOURNAMENT DATA LOADED',true);try{window.renderAll?.();}catch(renderErr){console.error('RADIUM render after cloud load failed; cloud data remains loaded:',renderErr);}return true;
    }catch(e){this.state.lastError=e;this.setStatus('LOAD ERROR',false,'The tournament data could not be loaded: '+this.errorText(e));console.error('RADIUM cloud pull failed:',e);return false}},
    scheduleSync(){if(!window.RADIUM_AUTH?.user||!this.getId())return;changeVersion++;this.state.dirty=true;if(syncing||startingPush||categoryDeleteInProgress){syncAgain=true;return;}clearTimeout(timer);timer=setTimeout(()=>{if(syncing||startingPush||categoryDeleteInProgress){syncAgain=true;return;}this.push();},350)},
    async saveNow(overridePayload=null){
      clearTimeout(timer);
      timer=null;
      return await this.push(overridePayload);
    },
    flush(){clearTimeout(timer);timer=null;return this.push()},
    async loadAssignedTournamentForStaff(){
      if(!(await this.init()))throw new Error('Supabase is not configured.');
      if(!['tournament_manager','accountant','table_official'].includes(role()))throw new Error('Assigned staff account required.');
      const a=await window.RADIUM_DB.rpc('radium_get_my_assigned_tournament',{});
      if(a.error)throw new Error('Assigned-tournament lookup failed: '+(a.error.message||String(a.error)));
      const row=Array.isArray(a.data)?a.data[0]:a.data;
      if(!row?.id)throw new Error('No tournament is assigned to this account. Ask the Admin to assign one.');
      this.setId(row.id);
      this.state.assignedStatus=String(row.status||'').toLowerCase();
      const ok=await this.pull();
      if(!ok)throw this.state.lastError||new Error('Could not load the assigned tournament.');
      document.body.classList.toggle('locked',String(row.status||'').toLowerCase()==='active' || !!window.__RADIUM_GET_DATA?.()?.locked);
      this.setStatus('ASSIGNED TOURNAMENT • '+String(row.id).slice(0,8),true);
      window.renderAll?.();
      return row;
    },
    async startAssignedTournament(){
      if(!(await this.init()))throw new Error('Supabase is not configured.');
      if(String(window.RADIUM_AUTH?.role||'').toUpperCase()!=='TOURNAMENT_MANAGER')throw new Error('Only the assigned Tournament Manager can start this tournament.');
      const tid=this.getId();
      if(!tid)throw new Error('No assigned tournament is loaded.');
      const r=await window.RADIUM_DB.rpc('radium_start_assigned_tournament',{p_tournament_id:tid});
      if(r.error)throw r.error;
      const row=Array.isArray(r.data)?r.data[0]:r.data;
      if(!row?.id)throw new Error('Supabase did not return the started tournament.');
      const ok=await this.pull();
      if(!ok)throw this.state.lastError||new Error('Tournament started, but the locked tournament state could not be reloaded.');
      document.body.classList.add('locked');
      window.renderAll?.();
      this.setStatus('TOURNAMENT ACTIVE • '+String(tid).slice(0,8),true);
      return row;
    },
    async onAuth(){
      if(!(await this.init()))return;
      const currentRole=role();
      if(['TOURNAMENT_MANAGER','ACCOUNTANT','TABLE_OFFICIAL'].includes(String(currentRole).toUpperCase())){
        try{
          this.clearId();
          const assigned=await window.RADIUM_DB.rpc('radium_get_my_assigned_tournament',{});
          if(assigned.error)throw assigned.error;
          const row=Array.isArray(assigned.data)?assigned.data[0]:assigned.data;
          if(row?.id){
            this.setId(row.id);
            this.state.assignedStatus=String(row.status||'').toLowerCase();
            const ok=await this.pull();
            if(!ok)throw this.state.lastError||new Error('Could not load the assigned tournament.');
            document.body.classList.toggle('locked',String(row.status||'').toLowerCase()==='active' || !!window.__RADIUM_GET_DATA?.()?.locked);
            this.setStatus('ASSIGNED TOURNAMENT • '+String(row.id).slice(0,8),true);
            window.renderAll?.();
          }else{
            this.setStatus('NO TOURNAMENT ASSIGNED',true,'Ask the Admin to assign a tournament to this account.');
          }
        }catch(e){this.state.lastError=e;this.setStatus('ASSIGNMENT LOAD ERROR',false,this.errorText(e));}
        return;
      }
      let id=this.getId();
      if(id){try{await this.pull();return}catch(e){this.clearId();this.state.lastError=e;}}
      try{
        const rows=await this.listTournaments();
        const safeRows=Array.isArray(rows)?rows:[];
        const unfinished=safeRows.filter(r=>r&&['draft','active'].includes(String(r.status||'').toLowerCase())).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
        if(unfinished.length){
          id=unfinished[0].id;
          this.setId(id);
          await this.ensureMembership(id);
          await this.pull();
          this.setStatus('ACTIVE CLOUD TOURNAMENT • '+String(id).slice(0,8),true);
          window.renderAll?.();
          return;
        }
      }catch(e){this.state.lastError=e;this.setStatus('TOURNAMENT LOOKUP ERROR',false,this.errorText(e));return}
      this.setStatus('READY FOR NEW TOURNAMENT',true);
    },
    async listTournaments(){
      if(!(await this.init()))throw this.state.lastError||new Error('Supabase is not configured or could not initialize.');
      const r=await window.RADIUM_DB.select('tournaments',{select:'id,name,venue,event_date,organizer,status,settings,created_at,updated_at',order:{column:'created_at',ascending:false}});
      if(!r)throw new Error('Tournament lookup returned no response from Supabase.');
      if(r.error)throw r.error;
      if(!Array.isArray(r.data)){
        console.warn('RADIUM tournament lookup returned a non-array payload:',r.data);
        return [];
      }
      return r.data;
    },
    async loadTournament(id){
      if(!(await this.init()))throw new Error('Supabase is not configured or could not initialize.');
      this.setId(id);
      await this.ensureMembership(id);
      const ok=await this.pull();
      if(!ok)throw this.state.lastError||new Error('Could not load tournament.');
      return id;
    },
    async startNewTournament(){

  if(!(await this.init())){
    throw new Error(
      'Supabase is not configured or could not initialize.'
    );
  }

  if(role()!=='admin'){
    throw new Error(
      'Only Admin can create a new tournament.'
    );
  }

  /*
   * STEP 1
   *
   * Ask Supabase to create the tournament.
   *
   * Supabase generates the real tournament UUID.
   */
  const r=await window.RADIUM_DB.rpc(
    'radium_start_tournament',
    {}
  );

  if(r.error){
    throw r.error;
  }

  const row=Array.isArray(r.data)
    ? r.data[0]
    : r.data;

  if(!row?.id){
    throw new Error(
      'Supabase did not return the generated tournament ID.'
    );
  }

  /*
   * STEP 2
   *
   * Store the Supabase-generated tournament ID.
   */
  this.setId(row.id);

  /*
   * STEP 3
   *
   * Establish the creator's tournament membership BEFORE loading the
   * normalized tournament tables. Their RLS policies require membership,
   * so pulling first can make a valid newly-created tournament appear
   * impossible to load.
   */
  await this.ensureMembership(row.id);

  /*
   * STEP 4
   *
   * Wait until bracket.js has installed
   * __RADIUM_SET_DATA().
   */
  if(!(await waitForStateBridge())){
    throw new Error(
      'Tournament state is not ready after application initialization.'
    );
  }

  /*
   * STEP 5
   *
   * IMPORTANT:
   *
   * Do NOT create the application's authoritative state from
   * the temporary object returned by the RPC.
   *
   * Reload the tournament from Supabase.
   *
   * Supabase is the source of truth.
   */
  const loaded=await this.pull();

  if(!loaded){

    throw this.state.lastError ||
      new Error(
        'Supabase created the tournament but its state could not be loaded.'
      );
  }

  /*
   * STEP 6
   *
   * Return the state that was actually loaded from Supabase.
   */
  const authoritativeState=
    window.__RADIUM_GET_DATA?.() ||
    fresh();

  this.state.loaded=true;

  this.setStatus(
    'NEW CLOUD TOURNAMENT • '+row.id.slice(0,8),
    true
  );

  return authoritativeState;
},
    async deleteTournament(id){if(!(await this.init()))throw new Error('Supabase is not configured.');if(role()!=='admin')throw new Error('Admin account required.');const r=await window.RADIUM_DB.remove('tournaments',{id});if(r.error)throw r.error;if(String(this.getId())===String(id))this.clearId();return true},
    async deleteAllTournaments(){if(!(await this.init()))throw new Error('Supabase is not configured.');if(role()!=='admin')throw new Error('Admin account required.');for(const row of await this.listTournaments()){const r=await window.RADIUM_DB.remove('tournaments',{id:row.id});if(r.error)throw r.error}this.clearId();return true},
    async saveAnyoPerformance(payload){if(!(await this.init()))throw new Error('Supabase is not configured.');const tid=this.getId();if(!tid)throw new Error('No active tournament selected.');if(!payload?.categoryId||!(payload?.entryId||payload?.competitorId))throw new Error('Anyo performance context is incomplete.');const p=JSON.parse(JSON.stringify(payload));p.entryId=p.entryId||p.competitorId;p.competitorId=p.entryId;p.performerIndex=Number(p.performerIndex)||0;const r=await window.RADIUM_DB.rpc('radium_save_anyo_performance',{p_tournament_id:tid,p_payload:p});if(r.error)throw r.error;const row=Array.isArray(r.data)?r.data[0]:r.data;if(row?.id)p.id=row.id;if(row?.attempt_number!=null)p.attemptNumber=Number(row.attempt_number);return p},
    async unfinishAnyoPerformance(categoryId,type,competitorId){if(!(await this.init()))throw new Error('Supabase is not configured.');const q={entry_id:competitorId,category_id:categoryId};const r=await window.RADIUM_DB.remove('anyo_performances',q);if(r.error)throw r.error;return true}
  };
  function eligibleForCategory(p,c){const age=Number(p.age);if(!Number.isFinite(age)||age<Number(c.ageFrom)||age>Number(c.ageTo))return false;if(c.sex&&c.sex!=='Mixed'&&c.sex!==p.sex)return false;if(c.event==='Arnis Anyo'){const e=p.events||{};const type=c.anyoType||'Individual';if(type==='Individual'&&!e.anyoIndividual)return false;if(type==='Synchronized'&&!e.anyoTeam)return false;if(type==='Mixed')return false;const combos=type==='Individual'?(Array.isArray(e.anyoIndividualEvents)?e.anyoIndividualEvents:[]):(Array.isArray(e.anyoSynchronizedEvents)?e.anyoSynchronizedEvents:[]);const style=c.anyoStyle||'Traditional';const wanted=`${style}|${c.anyoWeapon||'Any'}`;if(c.anyoWeapon&&c.anyoWeapon!=='Any'){if(combos.length&&!combos.includes(wanted))return false;const key=style==='Traditional'?'anyoTraditionalWeapons':'anyoNonTraditionalWeapons';const legacy=Array.isArray(e[key])?e[key]:[];if(!combos.length&&!legacy.includes(c.anyoWeapon))return false;}return true}if(c.event==='Livestick'&&!p.events?.livestick)return false;if(c.event!=='Arnis Anyo'&&p.events?.combat===false)return false;const w=Number(p.weight);return Number.isFinite(w)&&w>=Number(c.weightFrom||0)&&w<=Number(c.weightTo||999)}
  async function cleanupTop(table,ids,tid,db,fail){const r=await db.select(table,{select:'id',eq:{tournament_id:tid}});await fail(table+' cleanup read',r);const stale=(r.data||[]).filter(old=>!ids.has(old.id)).map(old=>old.id);if(stale.length){if(typeof db.removeIn==='function')await fail(table+' stale cleanup',await db.removeIn(table,'id',stale,{tournament_id:tid}));else for(const id of stale)await fail(table+' stale cleanup',await db.remove(table,{id,tournament_id:tid}));}}
  window.RADIUM_CLOUD=cloud;
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function updateTournamentIdBadge(id){
    const el=document.getElementById('currentTournamentIdBadge');
    if(!el)return;
    const tid=String(id||'');
    const tm=String(window.RADIUM_AUTH?.role||'').toUpperCase()==='TOURNAMENT_MANAGER';
    el.hidden=!tid;
    el.style.display=tid?'inline-flex':'none';
    if(tid){
      const full=esc(tid);
      el.innerHTML='<span class=\"tid-label\">TOURNAMENT ID</span><code>'+full+'</code>'+(tm?'<button type=\"button\" id=\"copyTournamentIdBtn\" title=\"Copy Tournament ID\">COPY</button>':'');
      el.querySelector('#copyTournamentIdBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(tid);window.toast?.('Tournament ID copied.')}catch(e){window.prompt('Copy Tournament ID:',tid)}});
    }
  }
  async function renderTournamentList(){
    const el=document.getElementById('tournamentList');if(!el)return;
    const currentRole=String(window.RADIUM_AUTH?.role||'').toUpperCase();
    el.innerHTML='<div class=\"empty\">Loading current tournament...</div>';
    try{
      if(['TOURNAMENT_MANAGER','ACCOUNTANT','TABLE_OFFICIAL'].includes(currentRole)){
        let id=cloud.getId();
        const card=document.getElementById('tournamentManagerCard');
        const title=card?.querySelector('h3');
        const desc=card?.querySelector('.section-header .muted');
        if(title)title.textContent='ASSIGNED TOURNAMENT';
        if(desc)desc.textContent='Your Admin-assigned tournament loads automatically when you sign in. You can only access this assigned tournament.';
        if(!cloud.state.loaded||!id){
          el.innerHTML='<div class="empty">Loading your assigned tournament…</div>';updateTournamentIdBadge('');
          try{const row=await cloud.loadAssignedTournamentForStaff();id=String(row.id);}catch(e){el.innerHTML='<div class="empty">'+esc(cloud.errorText(e))+'</div>';updateTournamentIdBadge('');return;}
        }else id=String(id);
        const d=window.__RADIUM_GET_DATA?.()||{};const name=d.setup?.name||'Untitled Tournament',date=d.setup?.date||'',venue=d.setup?.venue||'';
        const loaded=!!cloud.state.loaded&&String(cloud.getId())===String(id);
        const roleLabel=currentRole.replaceAll('_',' ');
        const assignedStatus=String((cloud.state?.assignedStatus)||'').toLowerCase();
        const currentData=window.__RADIUM_GET_DATA?.()||{};
        const activeNow=assignedStatus==='active' || !!currentData.locked;
        el.innerHTML='<div class="tm-current-tournament"><div class="tm-current-label">ASSIGNED TOURNAMENT • '+esc(roleLabel)+'</div><div class="tm-current-name">'+esc(name)+'</div><div class="tm-current-id-label">TOURNAMENT ID</div><div class="tm-current-id"><code>'+esc(id)+'</code><button type="button" class="btn small primary" id="tmCopyTournamentId">COPY ID</button><button type="button" class="btn small '+(loaded?'':'primary')+'" id="tmLoadCurrentTournament">'+(loaded?'RELOAD TOURNAMENT':'LOAD TOURNAMENT')+'</button></div><div class="muted">'+esc(date)+(venue?' • '+esc(venue):'')+' • STATUS: <b>'+esc(activeNow?'ACTIVE':'DRAFT')+'</b></div>'+(currentRole==='TOURNAMENT_MANAGER'&&!activeNow?'<button type="button" class="btn primary" id="tmStartTournament" style="margin-top:12px">START TOURNAMENT</button><div class="tm-current-note">Starting the tournament permanently locks setup, player registration, teams, categories, and other preparation controls. Match scoring and results remain available.</div>':'<div class="tm-current-note">'+(activeNow?'Tournament is ACTIVE. Preparation data is locked; scoring and results remain available. ':'')+'This tournament was assigned to your staff account by the Admin. Changing the Tournament ID manually is not permitted.</div>')+'</div>';
        el.querySelector('#tmCopyTournamentId')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(id));window.toast?.('Tournament ID copied.')}catch(e){window.prompt('Copy Tournament ID:',String(id))}});
        el.querySelector('#tmLoadCurrentTournament')?.addEventListener('click',async(ev)=>{const b=ev.currentTarget;try{b.disabled=true;b.textContent='LOADING...';await cloud.loadAssignedTournamentForStaff();await renderTournamentList();window.toast?.('Assigned tournament loaded.')}catch(e){alert('Could not load assigned tournament. '+cloud.errorText(e));b.disabled=false;b.textContent=loaded?'RELOAD TOURNAMENT':'LOAD TOURNAMENT';}});
        el.querySelector('#tmStartTournament')?.addEventListener('click',async(ev)=>{if(!confirm('START THIS TOURNAMENT?\n\nAfter starting, tournament setup, player registration, teams, categories and preparation controls will be locked. Scoring and results will remain available.\n\nThis cannot be reversed from the Tournament Manager account.'))return;const b=ev.currentTarget;try{b.disabled=true;b.textContent='STARTING...';await cloud.startAssignedTournament();await renderTournamentList();window.toast?.('Tournament started. Preparation controls are now locked.');}catch(e){alert('Could not start the tournament. '+cloud.errorText(e));b.disabled=false;b.textContent='START TOURNAMENT';}});
        updateTournamentIdBadge(id);return;
      }
      const rows=(await cloud.listTournaments()).filter(r=>['draft','active'].includes(String(r.status||'').toLowerCase()));
      if(!rows.length){el.innerHTML='<div class=\"empty\">No current tournament. Click + NEW TOURNAMENT to create one.</div>';return}
      const current=cloud.getId();
      el.innerHTML=rows.map(r=>{const s=r.settings||{},name=r.name||s.setup?.name||'Untitled Tournament',date=r.event_date||s.setup?.date||'',venue=r.venue||s.setup?.venue||'',active=String(current)===String(r.id);return '<div class=\"tournament-row\"><div class=\"tournament-info\"><div class=\"tournament-name\">'+esc(name)+(active?' <span class=\"mode-badge\">CURRENT</span>':'')+'</div><div class=\"muted\">'+esc(date)+(venue?' • '+esc(venue):'')+'</div><div class=\"muted\">Tournament ID: <code>'+esc(String(r.id))+'</code></div></div><div class=\"tournament-actions\"><button type=\"button\" class=\"btn small primary\" data-load-tournament=\"'+esc(r.id)+'\">LOAD</button><button type=\"button\" class=\"btn small danger\" data-delete-tournament=\"'+esc(r.id)+'\">DELETE</button></div></div>'}).join('');
      el.querySelectorAll('[data-load-tournament]').forEach(b=>b.onclick=async()=>{try{b.disabled=true;b.textContent='LOADING...';await cloud.loadTournament(b.dataset.loadTournament);alert('Tournament loaded successfully.');await renderTournamentList()}catch(e){alert('Could not load tournament. '+cloud.errorText(e));b.disabled=false;b.textContent='LOAD'}});
      el.querySelectorAll('[data-delete-tournament]').forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.deleteTournament));if(!confirm('DELETE CURRENT TOURNAMENT?\n\n'+(r?.name||'this tournament')+'\n\nThis permanently deletes all tournament data for this tournament.\n\nThis cannot be undone.'))return;try{b.disabled=true;await cloud.deleteTournament(b.dataset.deleteTournament);await renderTournamentList();alert('Tournament deleted.')}catch(e){alert('Could not delete tournament. '+cloud.errorText(e));b.disabled=false}})
    }catch(e){el.innerHTML='<div class=\"empty\">Unable to load current tournament: '+esc(cloud.errorText(e))+'</div>'}
  }
  let cloudAuthHydrated=false;
  async function hydrateCloudForCurrentSession(){
    if(cloudAuthHydrated)return true;
    if(!window.RADIUM_AUTH?.user)return false;
    cloudAuthHydrated=true;
    try{await cloud.onAuth();}catch(e){console.error('RADIUM cloud auth hydration failed:',e);cloudAuthHydrated=false;return false}
    bindTournamentManager();
    return true;
  }
  function bindTournamentManager(){
    const n=document.getElementById('newTournamentBtn'),r=document.getElementById('refreshTournamentListBtn');
    const isAdmin=String(window.RADIUM_AUTH?.role||'').toUpperCase()==='ADMIN';
    if(n){n.style.display=isAdmin?'':'none';n.onclick=async()=>{if(!isAdmin)return;if(!confirm('START A NEW TOURNAMENT?\n\nOnly one current tournament is allowed.'))return;try{await cloud.startNewTournament();alert('New tournament created successfully. Enter the tournament details and click SAVE SETUP.');await renderTournamentList()}catch(e){alert('Could not start a new tournament. '+cloud.errorText(e))}}}
    if(r){r.style.display=isAdmin?'':'none';r.onclick=renderTournamentList;}
    updateTournamentIdBadge(cloud.getId());
    renderTournamentList();
  }
  document.addEventListener('radium-auth-ready',()=>setTimeout(hydrateCloudForCurrentSession,50));
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(async()=>{
      if(!(await hydrateCloudForCurrentSession())){
        setTimeout(hydrateCloudForCurrentSession,500);
        setTimeout(hydrateCloudForCurrentSession,1500);
      }
      bindTournamentManager();
    },150);
    ensureEmergencyBanner();updateEmergencyBanner();setInterval(updateEmergencyBanner,1000)
  });
  window.addEventListener('online',async()=>{if(!window.RADIUM_AUTH?.user)return;await cloud.pull();});
  window.addEventListener('offline',()=>{if(cloud.getId()){cloud.state.pendingCount=0;cloud.setStatus('OFFLINE • NOT SAVED',false,emergencyMessage());}});
})();

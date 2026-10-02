/* RADIUM V66 — CAPRISAA import + deterministic DepEd-PEKAF weight-class category resolution */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const role=()=>String(window.RADIUM_AUTH?.role||window.RADIUM_AUTH?.profile?.role||'').toUpperCase();
  const canManage=()=>['ADMIN','TOURNAMENT_MANAGER'].includes(role());
  const state=()=>window.RADIUM_STATE?.()||{};
  const teamByName=n=>(state().teams||[]).find(t=>String(t.name||'').trim().toLowerCase()===String(n||'').trim().toLowerCase());
  const playerByName=(name,teamId)=>(state().players||[]).find(p=>String(p.name||'').trim().toLowerCase()===String(name||'').trim().toLowerCase()&&(!teamId||String(p.teamId||'')===String(teamId)));
  // Imported records need stable UUIDs before the cloud sync begins. Temporary IDs
  // are rematerialized on every retry and can create duplicate teams after a partial failure.
  const uid=()=>{try{if(typeof window.uid==='function'){const v=window.uid();if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v)))return v;}}catch(_){}try{if(window.crypto?.randomUUID)return window.crypto.randomUUID();}catch(_){}return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});};
  const isoBirthdate=v=>{const d=parseDate(v);if(!d)return '';return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;};
  const toast=m=>window.toast?window.toast(m):alert(m);
  const split=v=>{const raw=String(v??'').trim();if(!raw)return [];let a=raw.split(/[;\n]+/).map(x=>x.trim()).filter(Boolean);if(a.length===1 && raw.includes(','))a=raw.split(',').map(x=>x.trim()).filter(Boolean);return a};
  const asNum=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null};
  const normalize=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  const headerKey=s=>normalize(s).replace(/[^a-z0-9]+/g,'');
  const notify=(text,type='info')=>{const box=$('entryImportNotice');if(!box)return;box.className='entry-notice '+type;box.innerHTML=text;box.style.display='block'};
  async function readFile(file){
    if(!file)throw new Error('No registration file was selected.');
    if(typeof file.arrayBuffer==='function')return await file.arrayBuffer();
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('The selected file could not be read by the browser.'));r.readAsArrayBuffer(file)});
  }

  function excelSerialToDate(v){
    const n=Number(v); if(!Number.isFinite(n)||n<20000||n>100000)return null;
    const d=new Date(Date.UTC(1899,11,30)+n*86400000);
    return Number.isNaN(d.getTime())?null:d;
  }
  function parseDate(v){
    if(v instanceof Date&&!Number.isNaN(v.getTime()))return v;
    if(typeof v==='number'){const x=excelSerialToDate(v);if(x)return x;}
    const s=String(v??'').trim(); if(!s)return null;
    if(/^\d+(?:\.\d+)?$/.test(s)){const x=excelSerialToDate(Number(s));if(x)return x;}
    let d=new Date(s); if(!Number.isNaN(d.getTime()))return d;
    let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if(m){d=new Date(Number(m[3]),Number(m[1])-1,Number(m[2]));if(!Number.isNaN(d.getTime()))return d;}
    m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/); if(m){d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));if(!Number.isNaN(d.getTime()))return d;}
    return null;
  }
  function ageFromBirth(v){const d=parseDate(v);if(!d)return null;const configured=state()?.setup?.ageReferenceDate||state()?.setup?.age_reference_date||state()?.setup?.date;const now=configured?parseDate(configured):new Date();const ref=now||new Date();let a=ref.getFullYear()-d.getFullYear();const md=ref.getMonth()-d.getMonth();if(md<0||(md===0&&ref.getDate()<d.getDate()))a--;return a;}
  function normalizedSex(v){
    const x=headerKey(v);
    if(['f','female','girl','girls','woman','women','lady','ladies'].includes(x))return 'Female';
    if(['m','male','boy','boys','man','men','gentleman','gentlemen'].includes(x))return 'Male';
    return '';
  }
  function inferSexFromHeaders(r){
    for(const k of Object.keys(r||{})){
      const x=normalize(k);
      if(/\b(female|girls?|women|lady|ladies)\b/.test(x))return 'Female';
      if(/\b(male|boys?|men|gentlemen)\b/.test(x))return 'Male';
    }
    return '';
  }

  function canonicalRow(r){
    const lower={};Object.entries(r||{}).forEach(([k,v])=>lower[headerKey(k)]=v);
    const val=(...keys)=>{for(const k of keys){const v=lower[headerKey(k)];if(v!==undefined&&String(v).trim()!=='')return v}return ''};
    const birth=val('birthdate','birth date','date of birth','dob','birth','birth day','birthday');
    const age=asNum(val('age','competition age','current age','years old','years')) ?? ageFromBirth(birth);
    const events=String(val('events selected','events / categories','events','event selection','which events are you going to participate','which events do you want to participate','which event(s) do you want to participate','what events do you want to join','event(s)','event','events joined','events chosen')).trim();
    const rawFields=Object.entries(r||{}).filter(([k,v])=>String(v??'').trim()!=='');
    const categoryText=rawFields.map(([k,v])=>`${k}: ${v}`).join(' | ');
    const inferredEvents=[];
    for(const [k,v] of rawFields){
      const text=`${k} ${v}`;
      const parsed=parseEventChoice(text);
      if(parsed.length)inferredEvents.push(...parsed);
    }
    const inferred=[...inferredEvents];
    const unique=new Set();
    const hints=inferred.filter(e=>{const key=[e.event,e.anyoType,e.style,e.weapon].join('|');if(unique.has(key))return false;unique.add(key);return true});
    return {
      name:String(val('full name','full name:','player name','participant name','athlete name','name','player','name of player','name of player female','name of player male')).trim(),
      nick:String(val('nickname','nickname:','nick','alias')).trim(),
      sex:normalizedSex(val('sex','sex:','gender','division','category sex','male female','boys girls'))||inferSexFromHeaders(r),
      birth:String(birth??'').trim(), age,
      weight:asNum(val('weight (kg)','weight(kg)','weight(kg):','weight','body weight','weight kg','kg','kilos','actual weight')),
      team:String(val('team / club','team/club','team/club:','team','club','school/team','school','club/team','team name','school name')).trim(),
      coach:String(val('coach name','coach name:','coach','trainer')).trim(),
      contact:String(val('mobile/contact','mobile/contact:','contact number','parent contact number','contact','phone','phone number','mobile','mobile number')).trim(),
      email:String(val('email address','email address:','email','email:')).trim(),
      eventsRaw:events || hints.map(e=>e.label||e.event).join(', '),
      parent:String(val('parent/guardian name','parent / guardian name','parent / guardian name:','parent guardian name','guardian name','parent name')).trim(),
      parentContact:String(val('parent/guardian contact','parent / guardian contact','parent / guardian contact number','parent guardian contact','parent guardian contact number','guardian contact','guardian contact number')).trim(),
      consent:String(val('parent/guardian consent','parent / guardian consent','parent guardian consent','guardian consent')).trim(),
      groupMode:String(val('synchronized group','group anyo','group anyo?','anyo group','group option')).trim(),
      groupReference:String(val('group name / group reference','group name/group reference','group reference','group name','group code','group id')).trim(),
      categoryText,
      categoryHints:hints
    };
  }

  function aiCanonicalRows(aiRows){
    return (aiRows||[]).map(a=>{
      const f=a?.fields||{};
      const events=(a?.events||[]).filter(e=>e?.event).map(e=>{
        if(e.event==='Arnis Anyo')return `${e.anyoType||'Individual'} ${e.style||'Traditional'} ${e.weapon||'Any'} Anyo`;
        return e.event;
      }).join(', ');
      return {
        'Full Name':f.name||'',Nickname:f.nickname||'',Sex:f.sex||'',Birthdate:f.birthdate||'',Age:f.age??'',
        'Weight (kg)':f.weightKg??'', 'Team / Club':f.team||'', 'Coach Name':f.coach||'', 'Mobile/Contact':f.contact||'', 'Email Address':f.email||'',
        'Events Selected':events||f.eventsText||'', 'Parent/Guardian Name':f.parentGuardianName||'', 'Parent/Guardian Contact':f.parentGuardianContact||'', 'Parent/Guardian Consent':f.consent||'', 'Synchronized Group':f.groupMode||'', 'Group Name / Group Reference':f.groupReference||'',
        __radiumAi:a
      };
    });
  }

  async function understandWithAI(rawRows){
    if(!rawRows?.length)return null;
    if(!window.RADIUM_DB?.session||!window.RADIUM_SUPABASE_CONFIG?.url)throw new Error('Supabase AI gateway is not configured.');
    const sessionResult=await window.RADIUM_DB.session();
    const token=sessionResult?.data?.session?.access_token;
    if(!token)throw new Error('Your RADIUM staff session has expired. Sign in again before using AI import understanding.');
    const categories=(state().categories||[]).map(c=>({name:c.name,preset:c.preset,event:c.event,event_type:c.event_type,sex:c.sex,gender:c.gender,ageFrom:c.ageFrom,ageTo:c.ageTo,age_min:c.age_min,age_max:c.age_max,weightFrom:c.weightFrom,weightTo:c.weightTo,weight_min:c.weight_min,weight_max:c.weight_max,anyoType:c.anyoType,anyoStyle:c.anyoStyle,anyoWeapon:c.anyoWeapon,division:c.division,style:c.style,weapon:c.weapon}));
    const base=String(window.RADIUM_SUPABASE_CONFIG.url).replace(/\/+$/,'');
    const res=await fetch(base+'/functions/v1/radium-ai-import',{method:'POST',headers:{'Content-Type':'application/json','apikey':window.RADIUM_SUPABASE_CONFIG.anonKey||'','Authorization':'Bearer '+token},body:JSON.stringify({rows:rawRows,categories})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data?.error||`AI gateway failed (${res.status}).`);
    return data;
  }

  function parseWeightRange(text){
    const x=normalize(text),exclusiveFrom=/\bover\b/.test(x);
    let m=x.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)\s*(?:and\s+above|above|upwards)/);
    if(m)return {from:Number(m[1]),to:999,exclusiveFrom};
    m=x.match(/(?:over\s*)?(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)?\s*(?:up\s*to|to|[-–])\s*(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)/);
    if(m)return {from:Number(m[1]),to:Number(m[2]),exclusiveFrom};
    m=x.match(/(?:below|under)\s*(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)/);
    if(m)return {from:0,to:Number(m[1])-0.01,exclusiveFrom:false};
    if(/weight|kg|kgs|kilos/.test(x)){
      m=x.match(/(\d+(?:\.\d+)?)[^0-9]+(\d+(?:\.\d+)?)/);
      if(m)return {from:Number(m[1]),to:Number(m[2]),exclusiveFrom};
    }
    return null;
  }

  function parseEventChoice(choice){
    const x=normalize(choice),out=[];
    const schoolLevel=/\belementary\b/.test(x)?'Elementary':/\bsecondary\b/.test(x)?'Secondary':'';
    const add=(event,anyoType='',style='',weapon='')=>out.push({event,anyoType,style,weapon,schoolLevel,label:String(choice),weightRange:parseWeightRange(choice)});
    const isAnyo=/anyo|likha|form|forms|kata/.test(x)&&(/single|double|espada|sword|dagger|traditional|trad\b|non[- ]?trad|synchronized|sync|mixed|solo|weapon/.test(x));
    const style=/non[- ]?trad|modern|freestyle/.test(x)?'Non-Traditional':/traditional|trad\b|classic|old[- ]?style/.test(x)?'Traditional':'';
    let weapon='';
    if(/espada\s*(y|and|&)\s*daga|sword\s*(and|&)\s*dagger|sword.*dagger|spada/.test(x))weapon='Espada y Daga';
    else if(/double\s*(weapon|stick)?|two\s*weapon|2\s*weapon|double\s*w\b|double\s*wea/.test(x))weapon='Double Weapon';
    else if(/single\s*(weapon|stick)?|solo|one\s*weapon|1\s*weapon|single\s*w\b|single\s*wea/.test(x))weapon='Single Weapon';
    if(isAnyo){
      const type=/synchronized|sync\b/.test(x)?'Synchronized':/mixed|male.*female|female.*male/.test(x)?'Mixed':'Individual';
      add('Arnis Anyo',type,style||'Non-Traditional',weapon||'Any');
    }else if(/padded\s*-?\s*stick|padd(?:ed)?\s*stick|paddd\s*stik|padded\b.*(age|kg|weight)|(?:age|kg|weight).*padded\b|combative.*padded|padded.*combat/.test(x))add('Padded Stick');
    else if(/live\s*-?\s*stick|livestick|live\s*combat|live\s*stick\s*fighting/.test(x))add('Livestick');
    else if(/knifepoint|knife\s*point|knife\s*combat/.test(x))add('Knifepoint');
    return out;
  }

  function eventSelections(raw){
    const pieces=split(raw); let out=[];
    pieces.forEach(p=>{const q=parseEventChoice(p);if(q.length)out.push(...q)});
    if(!out.length&&raw){const q=parseEventChoice(raw);if(q.length)out=q}
    const seen=new Set();return out.filter(e=>{const k=[e.event,e.schoolLevel,e.anyoType,e.style,e.weapon].join('|');if(seen.has(k))return false;seen.add(k);return true});
  }

  function isDepEdPEKAF(){return String(state().setup?.competitionProgram||'').toUpperCase()==='DEPED_PEKAF';}
  function categoryUsesWeight(c){
    if(!c||c.event==='Arnis Anyo')return false;
    if(isDepEdPEKAF())return true;
    return !!(c.weightRequired||c.requireWeight||c.weight_required||Number(c.weightFrom)>0||Number(c.weightTo)<999);
  }
  function categoryEligibleForPlayer(c,r,sel){
    if(!c)return false;
    const cSex=c.sex??c.gender??'';
    const cEvent=c.event??(c.event_type==='Anyo'?'Arnis Anyo':c.event_type==='Livestick'?'Livestick':c.event_type==='Combative'?'Padded Stick':'');
    // Some legacy Anyo categories in Supabase were created with a broad 1–99
    // age range. Their preset is authoritative for Elementary/Secondary matching.
    let ageFrom=Number(c.ageFrom??c.age_min??0), ageTo=Number(c.ageTo??c.age_max??99);
    const preset=String(c.preset??'').toUpperCase();
    const categoryName=String(c.name??'');
    const categoryLevel=preset.includes('ANYO-ELEMENTARY')||/^\s*elementary\b/i.test(categoryName)?'Elementary':
      preset.includes('ANYO-SECONDARY')||/^\s*secondary\b/i.test(categoryName)?'Secondary':'';
    // The CAPRISAA workbook explicitly separates Elementary and Secondary
    // event sections. Use that section as a matching constraint because the
    // configured age ranges overlap (Elementary 1–13, Secondary 1–18).
    const requestedLevel=String(sel?.schoolLevel||'');
    if(requestedLevel&&categoryLevel&&requestedLevel!==categoryLevel)return false;
    if(preset.includes('ANYO-ELEMENTARY')){ ageFrom=1; ageTo=13; }
    else if(preset.includes('ANYO-SECONDARY')){ ageFrom=1; ageTo=18; }
    const weightFrom=Number(c.weightFrom??c.weight_min??0), weightTo=Number(c.weightTo??c.weight_max??999);
    const weightRequired=isDepEdPEKAF() && cEvent!=='Arnis Anyo' ? true : !!(c.weightRequired||c.requireWeight||c.weight_required||weightFrom>0||weightTo<999);
    const anyoType=c.anyoType??c.division??'Individual';
    const anyoStyle=c.anyoStyle??c.style??'Traditional';
    const anyoWeapon=c.anyoWeapon??c.weapon??'Any';
    if(cSex&&cSex!=='Mixed'&&cSex!==r.sex)return false;
    if(r.age===null||r.age<ageFrom||r.age>ageTo)return false;
    if(cEvent!=='Arnis Anyo' && weightRequired){
      // For workbook category selections, match the category the coach selected.
      // The athlete's actual weight is an eligibility check at weigh-in, not a
      // reason to erase or reject their intended registration category.
      if(sel?.weightRange?.from!=null&&Number.isFinite(Number(sel.weightRange.from))){
        const selectedFrom=Number(sel.weightRange.from),selectedTo=Number(sel.weightRange.to??999);
        if(Math.abs(weightFrom-selectedFrom)>0.51||Math.abs(weightTo-selectedTo)>0.51)return false;
      }else{
        const effectiveWeight=r.weight;
        if(effectiveWeight===null||!Number.isFinite(effectiveWeight))return false;
        if(effectiveWeight<weightFrom||effectiveWeight>weightTo)return false;
      }
    }
    if(cEvent==='Arnis Anyo'){
      if(anyoType!==sel.anyoType)return false;
      if(anyoStyle!==sel.style)return false;
      if(anyoWeapon&&anyoWeapon!=='Any'&&anyoWeapon!==sel.weapon)return false;
    }
    return cEvent===sel.event;
  }

  function weightClassFromText(value){
    const x=normalize(value);
    const classes=[
      ['Half Lightweight',/\bhalf\s*light(?:\s*weight)?\b/],
      ['Extra Lightweight',/\bextra\s*light(?:\s*weight)?\b/],
      ['Featherweight',/\bfeather(?:\s*weight)?\b/],
      ['Bantamweight',/\bbantam(?:\s*weight)?\b/],
      ['Pinweight',/\bpin(?:\s*weight)?\b/]
    ];
    for(const [name,re] of classes)if(re.test(x))return name;
    return '';
  }
  function categoryClass(c){return weightClassFromText(c?.weightClass)||weightClassFromText(c?.name||'');}
  function categoryPreference(c,expectedClass){
    const name=String(c?.name||'').trim();
    const preset=String(c?.preset||'').toUpperCase();
    let score=0;
    // Prefer the canonical preset category and its standard display name. This
    // resolves legacy rows with rounded boundaries (e.g. 51–55) alongside the
    // preset's intentional 51.01–55 range without deleting either database row.
    if(preset.includes('DEPED-PEKAF-COMBATIVES-12-17'))score+=100;
    if(/^Secondary\s+(Boys|Girls)\s+/i.test(name))score+=40;
    if(categoryClass(c)===expectedClass&&String(c?.weightClass||'').trim())score+=20;
    if(categoryClass(c)===expectedClass)score+=10;
    if(/\bPadded\s*Stick\b/i.test(name))score+=5;
    return score;
  }
  function resolveCategory(r,sel){
    const matches=(state().categories||[]).filter(c=>categoryEligibleForPlayer(c,r,sel));
    const expectedClass=sel.event==='Padded Stick'?weightClassFromText(sel.label):'';
    const classMatches=expectedClass?matches.filter(c=>categoryClass(c)===expectedClass):[];
    if(classMatches.length===1)return {category:classMatches[0]};
    if(classMatches.length>1){
      // Workbook choices include the named class (Pinweight/Bantamweight/etc.).
      // Prefer the canonical PEKAF preset where legacy rows have rounded bounds
      // (e.g. 51–55) beside the preset's intentional 51.01–55 range.
      const ranked=[...classMatches].sort((a,b)=>categoryPreference(b,expectedClass)-categoryPreference(a,expectedClass));
      const selected=ranked[0];
      return {category:selected,warning:`Duplicate/overlapping ${expectedClass} categories were detected. RADIUM selected “${selected.name}” for this import; please review the Categories page when convenient.`};
    }
    // If only a generic legacy category exists and its name has no class label,
    // retain compatibility. Do not silently map a named workbook class into a
    // different named class merely because its numeric interval overlaps.
    if(matches.length===1&&(!expectedClass||!categoryClass(matches[0])))return {category:matches[0]};
    if(matches.length>1){
      const details=matches.map(c=>`${c.name||'Unnamed category'} [${c.id||'no ID'}]`).join('; ');
      return {error:`Multiple matching categories for ${sel.label}. Conflicting categories: ${details}. Staff must resolve the overlap.`};
    }
    if(matches.length===1&&expectedClass&&categoryClass(matches[0])&&categoryClass(matches[0])!==expectedClass){
      return {error:`The workbook selected ${expectedClass}, but the only matching range belongs to ${categoryClass(matches[0])}: ${matches[0].name||'Unnamed category'} [${matches[0].id||'no ID'}]. Please correct the category range or name before importing.`};
    }
    return {error:`No RADIUM category matches ${sel.label} for ${r.sex||'unknown sex'}, age ${r.age??'unknown'}${r.weight!==null?`, ${r.weight} kg`:''}.`};
  }

  let imported=null, lastRawRows=[];
  function renderPreview(){
    const body=$('entryImportTable');if(!body)return;
    const filter=$('entryTeamFilter');
    if(!imported){body.innerHTML='<tr><td colspan="7" class="empty">No file loaded.</td></tr>';if(filter)filter.innerHTML='<option value="">ALL TEAMS</option>';if($('copyTeamRegistrationBtn'))$('copyTeamRegistrationBtn').disabled=true;return}
    const teams=[...new Set(imported.players.map(r=>r.team||'Unassigned'))].sort((a,b)=>a.localeCompare(b));
    if(filter){const old=filter.value;filter.innerHTML='<option value="">ALL TEAMS</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(teams.includes(old))filter.value=old;}
    const selected=filter?.value||'';const rows=imported.players.filter(r=>!selected||String(r.team||'Unassigned')===selected);
    const eventCount=r=>Array.isArray(r.selections)?r.selections.length:0;
    body.innerHTML=rows.map((r,i)=>{const ai=r.ai?`<span class="entry-ai">${r.ai.needsReview?'AI REVIEW':'AI OK'}${r.ai.confidence!=null?` • ${Math.round(Number(r.ai.confidence)*100)}%`:''}</span>`:'LOCAL';const msg=[...r.errors,...r.warnings].join('; ');const cats=r.categories?.join('<br>')||'—';return `<tr><td>${i+1}</td><td><b>${esc(r.name||'—')}</b><div class="muted">${esc(r.team||'Unassigned')}</div></td><td>${esc(r.sex||'—')}</td><td>${esc(r.age??'—')}</td><td>${r.weight==null?'—':esc(r.weight+' kg')}</td><td>${eventCount(r)} event(s)<br>${cats}</td><td class="${r.errors.length?'entry-bad':'entry-ok'}">${r.errors.length?esc(r.errors.join('; ')):msg?esc(msg):'READY'}${r.ai?.notes?`<div class="entry-ai-note">${esc(r.ai.notes)}</div>`:''}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty">No matching team rows.</td></tr>';
    const totalEvents=imported.players.reduce((n,r)=>n+eventCount(r),0);$('entryImportCount').textContent=`${imported.players.length} response rows • ${totalEvents} event registrations • ${imported.players.reduce((n,r)=>n+r.errors.length,0)} errors • ${imported.players.reduce((n,r)=>n+r.warnings.length,0)} warnings`;
    $('importEntryBtn').disabled=imported.players.some(r=>r.errors.length)||!imported.players.length;if($('entryAiRetryBtn'))$('entryAiRetryBtn').disabled=!lastRawRows.length;if($('copyTeamRegistrationBtn'))$('copyTeamRegistrationBtn').disabled=!selected||!rows.length;
  }
  async function copyTeamRegistration(){const team=$('entryTeamFilter')?.value;if(!team||!imported)return;const rows=imported.players.filter(r=>String(r.team||'Unassigned')===team);if(!rows.length)return;const lines=[`TEAM REGISTRATION — ${team}`,`Players: ${rows.length}`,`Event registrations: ${rows.reduce((n,r)=>n+(r.selections?.length||0),0)}`,''];rows.forEach((r,i)=>{lines.push(`${i+1}. ${r.name} | ${r.sex||'—'} | Age ${r.age??'—'} | ${r.weight??'—'} kg`);lines.push(`   Events: ${(r.selections||[]).map((e,j)=>{const c=r.categories?.[j]||r.categories?.[0]||'Review';return `${e.label||e.event}${c?' → '+c:''}`}).join('; ')||'—'}`);if(r.groupReference)lines.push(`   Anyo Group Reference: ${r.groupReference}`);});try{await navigator.clipboard.writeText(lines.join('\n'));toast(`Copied ${team} registration to the clipboard.`)}catch(e){const ta=document.createElement('textarea');ta.value=lines.join('\n');document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(`Copied ${team} registration to the clipboard.`)}}

  function parseCsv(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return [];
    const parseLine=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out};
    const h=parseLine(lines[0]);return lines.slice(1).map(line=>{const a=parseLine(line),o={};h.forEach((k,i)=>o[k]=a[i]??'');return o});
  }
  function parseCsv(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return [];
    const parseLine=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out};
    const h=parseLine(lines[0]);return lines.slice(1).map(line=>{const a=parseLine(line),o={};h.forEach((k,i)=>o[k]=a[i]??'');return o});
  }
  function cleanCell(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function looksLikeHeaderRow(row){
    const text=row.map(cleanCell).join(' | ');
    const h=headerKey(text);
    return ['name','player','athlete','gender','sex','birthday','birthdate','dob','age','team','school','weight','event','anyo','category'].some(k=>h.includes(k));
  }
  function isPlayerHeaderRow(row){
    return /(name|player|athlete|participant|competitor|student)/.test(row.map(cleanCell).join(' | ').toLowerCase());
  }
  function multiTableRowsToObjects(rows){
    if(!Array.isArray(rows)||!rows.length)return [];
    rows=rows.map(row=>Array.isArray(row)?row:[]);
    const starts=[];rows.forEach((row,i)=>{if(isPlayerHeaderRow(row))starts.push(i)});
    if(!starts.length)return tableRowsToObjects(rows);
    const all=[];
    starts.forEach((start,i)=>{const end=i+1<starts.length?starts[i+1]:rows.length;all.push(...tableRowsToObjects(rows.slice(start,end)))});
    return all;
  }
  function tableRowsToObjects(rows){
    if(!Array.isArray(rows)||rows.length<2)return [];
    rows=rows.map(row=>Array.isArray(row)?row:[]);
    let hi=rows.findIndex(row=>/(name|player|athlete|participant|competitor|student)/.test(row.map(cleanCell).join(' | ').toLowerCase()));
    if(hi<0)hi=rows.findIndex(looksLikeHeaderRow);
    if(hi<0)return [];
    const headers=(rows[hi]||[]).map((x,i)=>cleanCell(x)||`Column ${i+1}`);
    const headerText=headers.join(' | ').toLowerCase();
    if(!/(name|player|athlete|participant|competitor|student)/.test(headerText))return [];
    return rows.slice(hi+1).filter(row=>row.some(x=>cleanCell(x))).map(row=>{
      const o={};headers.forEach((h,i)=>o[h]=cleanCell(row[i]));return o;
    }).filter(o=>Object.values(o).some(v=>cleanCell(v)));
  }
  function parseWordXml(xml){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('The Word document XML could not be read.');
    const tables=[...doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','tbl')];
    const all=[];
    for(const tbl of tables){
      const trs=[...tbl.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','tr')];
      const rows=trs.map(tr=>[...tr.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','tc')].map(tc=>[...tc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','t')].map(t=>t.textContent||'').join('')));
      all.push(...multiTableRowsToObjects(rows));
    }
    if(all.length)return all;
    // A few Word exports are paragraph-based rather than tables. Convert simple tab-delimited paragraphs.
    const paras=[...doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','p')].map(p=>[...p.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','t')].map(t=>t.textContent||'').join('')).filter(Boolean);
    const tabbed=paras.map(x=>x.split(/\t+/).map(cleanCell)).filter(x=>x.length>=2);
    return tableRowsToObjects(tabbed);
  }
  async function readZipEntries(buf,wanted){
    const bytes=new Uint8Array(buf),dv=new DataView(buf);const sig=0x06054b50;let eocd=-1;
    const start=Math.max(0,bytes.length-65557);
    for(let i=bytes.length-22;i>=start;i--){if(dv.getUint32(i,true)===sig){eocd=i;break}}
    if(eocd<0)throw new Error('The Word file is not a valid ZIP-based .docx document.');
    const cdSize=dv.getUint32(eocd+12,true),cdOffset=dv.getUint32(eocd+16,true);let pos=cdOffset;const out={};
    while(pos<cdOffset+cdSize){
      if(dv.getUint32(pos,true)!==0x02014b50)break;
      const method=dv.getUint16(pos+10,true),compSize=dv.getUint32(pos+20,true),nameLen=dv.getUint16(pos+28,true),extraLen=dv.getUint16(pos+30,true),commentLen=dv.getUint16(pos+32,true),localOffset=dv.getUint32(pos+42,true);
      const name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nameLen));
      if(wanted.includes(name)){
        if(dv.getUint32(localOffset,true)!==0x04034b50)throw new Error('Invalid Word ZIP entry.');
        const localNameLen=dv.getUint16(localOffset+26,true),localExtraLen=dv.getUint16(localOffset+28,true);
        const data=bytes.slice(localOffset+30+localNameLen+localExtraLen,localOffset+30+localNameLen+localExtraLen+compSize);
        let raw;
        if(method===0)raw=data;
        else if(method===8){
          if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress the Word document. Please use a current Chrome, Edge, Safari, or Firefox.');
          const ds=new DecompressionStream('deflate-raw');raw=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer());
        }else throw new Error(`Word compression method ${method} is not supported.`);
        out[name]=new TextDecoder('utf-8').decode(raw);
      }
      pos+=46+nameLen+extraLen+commentLen;
    }
    return out;
  }
  async function parseDocx(buf){
    const entries=await readZipEntries(buf,['word/document.xml']);
    if(!entries['word/document.xml'])throw new Error('The Word document does not contain a readable main document.');
    return parseWordXml(entries['word/document.xml']);
  }
  function parseCaprisaaWorkbook(wb){
    const findSheet=(re)=>wb.SheetNames.find(n=>re.test(normalize(n)));
    const masterName=findSheet(/athlete masterlist/),eventName=findSheet(/event registration/);
    if(!masterName||!eventName)return null;
    const toRows=name=>window.XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',blankrows:true});
    const masterRows=toRows(masterName),eventRows=toRows(eventName);
    const cell=(rows,r,c)=>cleanCell(rows?.[r]?.[c]??'');
    const schoolRow=masterRows.findIndex(r=>headerKey(r?.[0])==='schoolteam');
    const team=schoolRow>=0?cell(masterRows,schoolRow,1):'';
    const coachRow=masterRows.findIndex(r=>headerKey(r?.[0])==='coachname');
    const coach=coachRow>=0?cell(masterRows,coachRow,1):'';
    const athletes=new Map();
    let level='';
    for(let i=0;i<masterRows.length;i++){
      const marker=normalize(cell(masterRows,i,0));
      if(marker.includes('elementary athlete masterlist')){level='Elementary';continue;}
      if(marker.includes('secondary athlete masterlist')){level='Secondary';continue;}
      if(!level||headerKey(cell(masterRows,i,0))!=='fullname')continue;
      for(let r=i+1;r<masterRows.length;r++){
        const first=normalize(cell(masterRows,r,0));
        if(first.includes('elementary athlete masterlist')||first.includes('secondary athlete masterlist'))break;
        const name=cell(masterRows,r,0);
        if(!name||/^(select from masterlist|full name|athlete|player)$/i.test(name))continue;
        const sex=normalizedSex(cell(masterRows,r,1));
        const birthRaw=cell(masterRows,r,2);
        const birth=isoBirthdate(birthRaw);
        const age=asNum(cell(masterRows,r,3))??ageFromBirth(birthRaw);
        const weight=level==='Secondary'?asNum(cell(masterRows,r,4)):null;
        const key=normalize(name);
        athletes.set(key,{name,sex,birth,age,weight,team,coach,events:[],groupRefs:[]});
      }
    }
    const getAthlete=name=>athletes.get(normalize(name));
    const unmatchedNames=new Set();
    const addSelection=(name,eventText,groupReference='',meta={})=>{
      if(!name||/^select from/i.test(name)||/^select (boy|girl)$/i.test(name))return;
      const a=getAthlete(name);if(!a){unmatchedNames.add(name);return;}
      if(!a.events.includes(eventText))a.events.push(eventText);
      if(groupReference&&!a.groupRefs.includes(groupReference))a.groupRefs.push(groupReference);
      if(meta&&meta.event==='Arnis Anyo'){
        a.anyoSelections=Array.isArray(a.anyoSelections)?a.anyoSelections:[];
        const key=[meta.schoolLevel||'',meta.anyoType||'',meta.style||'',meta.weapon||'',groupReference||''].join('|');
        if(!a.anyoSelections.some(x=>[x.schoolLevel||'',x.anyoType||'',x.style||'',x.weapon||'',x.groupReference||''].join('|')===key))
          a.anyoSelections.push({schoolLevel:meta.schoolLevel||'',anyoType:meta.anyoType||'',style:meta.style||'',weapon:meta.weapon||'',groupReference:groupReference||''});
      }
    };
    let section='',grade='',combat=false;
    for(let r=0;r<eventRows.length;r++){
      const a=normalize(cell(eventRows,r,0)),d=normalize(cell(eventRows,r,3));
      if(a.includes('elementary - anyo')||a.includes('elementary anyo')){grade='Elementary';combat=false;section='';continue;}
      if(a.includes('secondary - anyo')||a.includes('secondary anyo')){grade='Secondary';combat=false;section='';continue;}
      if(a.includes('secondary - combative')||a.includes('secondary combative')){grade='Secondary';combat=true;section='';continue;}
      if(combat){
        const weightRow=/pinweight|bantamweight|featherweight|extra lightweight|half lightweight/.test(a);
        if(!weightRow)continue;
        const range=cell(eventRows,r,1),boy=cell(eventRows,r,2),girl=cell(eventRows,r,5);
        const label=cell(eventRows,r,0);
        if(boy&&!/^select boy$/i.test(boy))addSelection(boy,`Padded Stick ${label} ${range}`);
        if(girl&&!/^select girl$/i.test(girl))addSelection(girl,`Padded Stick ${label} ${cell(eventRows,r,4)}`);
        continue;
      }
      if(/individual|synchronized|synchronised|team \(synchronized mixed\)/.test(a)){
        section=a;
        continue;
      }
      if(!section||!grade)continue;
      const isPlayerRow=/^(athlete|player\s*\d+|boy|girl)$/.test(a)||/^(athlete|player\s*\d+|boy|girl)$/.test(d);
      if(!isPlayerRow)continue;
      const weapon=/espada\s*y\s*daga/.test(section)?'Espada y Daga':/double weapon/.test(section)?'Double Weapon':/single weapon/.test(section)?'Single Weapon':'';
      if(!weapon)continue;
      const type=/mixed/.test(section)?'Mixed':/synchronized|synchronised/.test(section)?'Synchronized':'Individual';
      const groupReference=type==='Individual'?'':`CAPRISAA-${grade}-${type}`;
      const leftName=cell(eventRows,r,1),rightName=cell(eventRows,r,4);
      if(leftName&&!/^select from/i.test(leftName))addSelection(leftName,`Arnis Anyo ${type} Non-Traditional ${weapon} Anyo ${grade}`,groupReference,{event:'Arnis Anyo',schoolLevel:grade,anyoType:type,style:'Non-Traditional',weapon});
      if(rightName&&!/^select from/i.test(rightName))addSelection(rightName,`Arnis Anyo ${type} Non-Traditional ${weapon} Anyo ${grade}`,groupReference,{event:'Arnis Anyo',schoolLevel:grade,anyoType:type,style:'Non-Traditional',weapon});
    }
    if(unmatchedNames.size)throw new Error('These selected names in EVENT REGISTRATION were not found in ATHLETE MASTERLIST: '+[...unmatchedNames].join(', ')+'. Correct the spelling or add the athlete to the masterlist, then upload again.');
    const rows=[];
    for(const a of athletes.values()){
      // Import the complete masterlist, not only athletes who selected an event.
      // Event selection is optional for a masterlist-only player.
      rows.push({
        'Full Name':a.name,'Sex':a.sex,'Birthdate':a.birth,'Age':a.age??'',
        'Weight (kg)':a.weight??'','Team / Club':a.team,'Coach Name':a.coach,
        'Events Selected':a.events.join('; '),'Group Name / Group Reference':a.groupRefs.join('; '),
        __radiumAnyoSelections:a.anyoSelections||[],
        __radiumStructuredWorkbook:true
      });
    }
    if(!rows.length)throw new Error('The CAPRISAA workbook was recognized, but no athletes were found in ATHLETE MASTERLIST. Add the athletes to the masterlist, then upload again.');
    return rows;
  }

  async function parseWorkbook(buf,name){
    if(/\.csv$/i.test(name))return parseCsv(new TextDecoder().decode(buf));
    if(/\.docx$/i.test(name))return await parseDocx(buf);
    if(/\.doc$/i.test(name))throw new Error('Legacy .doc files are not supported in the browser importer. Please save the Word file as .docx and upload it again.');
    if(!window.XLSX)throw new Error('Excel reader is not available. Check the internet connection and reload RADIUM.');
    try{
      const wb=window.XLSX.read(buf,{type:'array',cellDates:false,WTF:false});
      if(!Array.isArray(wb.SheetNames)||!wb.SheetNames.length)throw new Error('The Excel file has no worksheet.');
      const caprisaaRows=parseCaprisaaWorkbook(wb);
      if(caprisaaRows)return caprisaaRows;
      const all=[];
      for(const sheetName of wb.SheetNames){
        const ws=wb.Sheets?.[sheetName];if(!ws)continue;
        if(!window.XLSX.utils||typeof window.XLSX.utils.sheet_to_json!=='function')throw new Error('The Excel reader loaded, but its worksheet parser is unavailable. Reload RADIUM and try again.');
        const rawRows=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',blankrows:false});
        const rows=Array.isArray(rawRows)?rawRows:[];
        const objects=multiTableRowsToObjects(rows);
        if(objects.length)objects.forEach(o=>o.__sheet=sheetName);
        all.push(...objects);
      }
      if(!all.length)throw new Error('No readable registration rows were found in the Excel workbook.');
      return all;
    }catch(err){
      const msg=String(err?.message||err||'Unknown Excel parser error');
      if(/unsupported zip compression method/i.test(msg)||/compression method\s+nan/i.test(msg))throw new Error('This Excel file uses a ZIP compression format that the current Excel reader cannot decode. RADIUM uses the current SheetJS browser reader; please resave the workbook as .xlsx or .xls and retry.');
      throw new Error('Excel file could not be parsed: '+msg);
    }
  }

  function validate(rows){
    if(!Array.isArray(rows))throw new Error('The importer received invalid registration rows. Please choose a valid Excel/CSV/DOCX file.');
    const players=rows.map((row,i)=>{
      const r=canonicalRow(row);
      r.anyoSelections=Array.isArray(row?.__radiumAnyoSelections)?row.__radiumAnyoSelections.map(x=>({...x})):[];
      return r;
    });
    const teamsNeedingCreation=new Set();
    const teamsAlreadyKnown=new Set((state().teams||[]).map(t=>String(t.name??t.team_name??'').trim().toLowerCase()).filter(Boolean));
    players.forEach((r,i)=>{
      r.errors=[];r.warnings=[];r.categories=[];r.categorySelections=[];r.selections=eventSelections(r.eventsRaw);
      if(rows[i]?.__radiumAi)r.ai=rows[i].__radiumAi;
      if(!r.name)r.errors.push('Full Name required');
      if(!r.sex)r.errors.push('Sex required (Male/Female)');
      if(r.age===null&&r.birth==='')r.errors.push('Birthdate or Age required');
      if(!r.eventsRaw && !r.categoryHints?.length && rows[i]?.__radiumStructuredWorkbook!==true)r.errors.push('Events Selected required');
      if(!r.selections.length&&r.categoryHints?.length)r.selections=[...r.categoryHints];
      if(!r.selections.length&&r.eventsRaw)r.errors.push(`Unrecognized event choice: ${r.eventsRaw}`);
      for(const sel of r.selections){
        if(sel.event==='Knifepoint'){r.errors.push('Knifepoint is selected, but RADIUM currently has no Knifepoint category type.');continue;}
        if(categoryUsesWeight({event:sel.event})&&r.weight===null)r.errors.push(`${sel.label}: Weight required`);
        const found=resolveCategory(r,sel);
        if(found.error)r.errors.push(found.error);
        else{
          if(found.warning)r.warnings.push(found.warning);
          r.categories.push(found.category.name);
          r.categorySelections.push({id:String(found.category.id),name:found.category.name,event:sel.event});
          if(sel.event==='Padded Stick'&&r.weight!==null){
            const c=found.category;
            const min=Number(c.weightFrom??c.weight_min);
            const max=Number(c.weightTo??c.weight_max);
            const hasBounds=Number.isFinite(min)&&Number.isFinite(max)&&(min>0||max<999);
            const wr=sel.weightRange;
            const tooLight=hasBounds?r.weight<min:(wr?.from!=null?(wr.exclusiveFrom?r.weight<=Number(wr.from):r.weight<Number(wr.from)):false);
            const tooHeavy=hasBounds?r.weight>max:(wr?.to!=null?r.weight>Number(wr.to):false);
            if(tooLight||tooHeavy)r.warnings.push(`Recorded weight ${r.weight} kg is outside selected category ${found.category.name}. Registration is retained; official eligibility is determined by verified weigh-in.`);
          }
        }
      }
      r.categories=[...new Set(r.categories)];
      if(r.team){
        const teamKey=String(r.team).trim().toLowerCase();
        if(teamKey&&!teamsAlreadyKnown.has(teamKey)&&!teamsNeedingCreation.has(teamKey)){
          teamsNeedingCreation.add(teamKey);
          // New teams are expected during registration import; do not flag as a warning.
        }
      }
      if(r.selections.some(x=>x.anyoType==='Synchronized')&&!r.groupReference)r.warnings.push('Synchronized Anyo selected without a Group Name / Group Reference; staff must assign the player to a group.');
      if(r.ai?.needsReview)r.warnings.push('AI marked this response for review: '+(r.ai.notes||'ambiguous wording'));
    });
    return {players};
  }

  async function importRows(){
    if(!canManage())return alert('Admin or Tournament Manager access is required to import registration files.');
    if(state().locked)return alert('Tournament is locked. Unlock it before importing registrations.');
    if(!imported)return;
    const s=state();let created=0,updated=0,createdTeams=0,registrations=0;
    for(const r of imported.players){
      let t=r.team?teamByName(r.team):null;
      if(r.team&&!t){t={id:uid(),name:r.team,coach:r.coach||''};s.teams.push(t);createdTeams++}
      let p=playerByName(r.name,t?.id);
      if(!p){p={id:uid(),number:'',name:r.name,nick:r.nick||'',sex:r.sex,age:r.age??'',birth:r.birth||'',weight:r.weight??'',teamId:t?.id||'',coach:r.coach||t?.coach||'',photo:'',events:{combat:false,anyoIndividual:false,anyoTeam:false,livestick:false,anyoIndividualEvents:[],anyoSynchronizedEvents:[]}};s.players.push(p);created++}
      else{p.name=r.name;p.nick=r.nick||p.nick;p.sex=r.sex||p.sex;p.age=r.age??p.age;p.birth=r.birth||p.birth;p.weight=r.weight??p.weight;if(t)p.teamId=t.id;if(r.coach)p.coach=r.coach;updated++}
      p.events=p.events||{};
      p.events.anyoIndividualEvents=[];p.events.anyoSynchronizedEvents=[];
      p.events.anyoIndividualRegistrations=[];p.events.anyoSynchronizedRegistrations=[];
      p.events.anyoIndividual=false;p.events.anyoTeam=false;
      p.events.anyoTraditional=false;p.events.anyoNonTraditional=false;
      p.events.anyoTraditionalWeapons=[];p.events.anyoNonTraditionalWeapons=[];
      for(const sel of r.selections){
        if(sel.event==='Padded Stick')p.events.combat=true;
        else if(sel.event==='Livestick')p.events.livestick=true;
        else if(sel.event==='Arnis Anyo'){
          const combo=`${sel.style}|${sel.weapon}`;
          if(sel.anyoType==='Individual'){
            p.events.anyoIndividual=true;
            if(!p.events.anyoIndividualEvents.includes(combo))p.events.anyoIndividualEvents.push(combo);
          }else if(sel.anyoType==='Synchronized'){
            p.events.anyoTeam=true;
            if(!p.events.anyoSynchronizedEvents.includes(combo))p.events.anyoSynchronizedEvents.push(combo);
          }
          if(sel.style==='Traditional'){p.events.anyoTraditional=true;p.events.anyoTraditionalWeapons=Array.from(new Set([...(p.events.anyoTraditionalWeapons||[]),sel.weapon]))}
          if(sel.style==='Non-Traditional'){p.events.anyoNonTraditional=true;p.events.anyoNonTraditionalWeapons=Array.from(new Set([...(p.events.anyoNonTraditionalWeapons||[]),sel.weapon]))}
        }
      }
      // CAPRISAA's Elementary/Secondary sections are the authoritative school
      // division for Anyo. Store that selection on the player so a later cloud
      // sync cannot recreate the same athlete in the other overlapping division.
      const importedAnyo=Array.isArray(r.anyoSelections)?r.anyoSelections:[];
      p.events.anyoIndividualRegistrations=importedAnyo.filter(x=>x.anyoType==='Individual').map(x=>({schoolLevel:x.schoolLevel||'',style:x.style||'',weapon:x.weapon||'Any'}));
      p.events.anyoSynchronizedRegistrations=importedAnyo.filter(x=>['Synchronized','Mixed'].includes(x.anyoType)).map(x=>({schoolLevel:x.schoolLevel||'',anyoType:x.anyoType,style:x.style||'',weapon:x.weapon||'Any',groupReference:x.groupReference||''}));
      p.registrationSource='File Import';p.registrationContact=r.contact||p.registrationContact||'';p.email=r.email||p.email||'';p.parentGuardianName=r.parent||p.parentGuardianName||'';p.parentGuardianContact=r.parentContact||p.parentGuardianContact||'';
      p.anyoGroupReference=r.groupReference||p.anyoGroupReference||'';p.anyoGroupMode=r.groupMode||p.anyoGroupMode||'';
      // Keep the coach's explicit Combative category selection even when declared
      // weight is outside that class. Verified weigh-in controls eligibility later.
      s.registrations=Array.isArray(s.registrations)?s.registrations:[];
      const importedAnyoIndividualKeys=new Set();
      for(const sel of (r.selections||[])){
        if(sel.event!=='Arnis Anyo'||sel.anyoType!=='Individual')continue;
        const matches=(s.categories||[]).filter(c=>categoryEligibleForPlayer(c,r,sel));
        let chosen=matches;
        if(matches.length>1&&sel.schoolLevel){
          const level=String(sel.schoolLevel).toLowerCase();
          chosen=matches.filter(c=>{
            const preset=String(c.preset||'').toUpperCase(),name=String(c.name||'');
            const cl=preset.includes('ANYO-ELEMENTARY')||/^\s*elementary\b/i.test(name)?'elementary':preset.includes('ANYO-SECONDARY')||/^\s*secondary\b/i.test(name)?'secondary':'';
            return cl===level;
          });
        }
        if(chosen.length===1)importedAnyoIndividualKeys.add(String(p.id)+'|'+String(chosen[0].id));
      }
      // The uploaded registration workbook is authoritative for these players.
      // Remove stale Anyo individual registrations from an earlier import before
      // adding the exact selected category. This is what prevents Hanz-like
      // athletes from remaining in both Elementary and Secondary.
      s.registrations=s.registrations.filter(x=>{
        const key=String(x.playerId||x.player_id||'')+'|'+String(x.categoryId||x.category_id||'');
        const c=(s.categories||[]).find(cat=>String(cat.id)===String(x.categoryId||x.category_id||''));
        if(String(x.playerId||x.player_id||'')!==String(p.id))return true;
        if(c?.event==='Arnis Anyo'&&(c.anyoType||'Individual')==='Individual')return importedAnyoIndividualKeys.has(key);
        return true;
      });
      // Preserve the exact Anyo category selected by the registration file.
      // Elementary and Secondary Anyo age ranges overlap, so player age alone
      // must never create registrations in both school divisions.
      const addRegistration=(c,anyoEntryId=null)=>{
        if(!c)return;
        const key=String(p.id)+'|'+String(c.id);
        if(!s.registrations.some(x=>String(x.playerId||x.player_id||'')+'|'+String(x.categoryId||x.category_id||'')===key&& !['CANCELLED','DELETED','WITHDRAWN'].includes(String(x.status||'ACTIVE').toUpperCase())))
          s.registrations.push({id:null,teamId:p.teamId||'',playerId:p.id,categoryId:c.id,anyoEntryId, status:'ACTIVE',feeAmount:Number(c.registrationFee)||0,registeredAt:new Date().toISOString()});
      };
      for(const choice of (r.categorySelections||[])){
        const c=(s.categories||[]).find(x=>String(x.id)===String(choice.id));
        if(!c||choice.event==='Arnis Anyo'||choice.event==='Livestick')continue;
        addRegistration(c);
      }
      for(const sel of (r.selections||[])){
        if(sel.event!=='Arnis Anyo'||sel.anyoType!=='Individual')continue;
        const matches=(s.categories||[]).filter(c=>categoryEligibleForPlayer(c,r,sel));
        if(matches.length===1){
          addRegistration(matches[0]);
        }else if(matches.length>1 && sel.schoolLevel){
          const level=String(sel.schoolLevel).toLowerCase();
          const levelMatches=matches.filter(c=>{
            const preset=String(c.preset||'').toUpperCase(),name=String(c.name||'');
            const cl=preset.includes('ANYO-ELEMENTARY')||/^\s*elementary\b/i.test(name)?'elementary':preset.includes('ANYO-SECONDARY')||/^\s*secondary\b/i.test(name)?'secondary':'';
            return cl===level;
          });
          if(levelMatches.length===1)addRegistration(levelMatches[0]);
        }
      }
      registrations+=r.categories.length;
    }
    // Build Synchronized/Mixed Anyo entries from individual Google Form responses.
    // Matching uses team + submitted group reference + exact Anyo style/weapon/category.
    // The permanent Supabase entry ID is created later by the normalized sync layer.
    const groups=new Map();
    for(const r of imported.players){
      if(!r.groupReference)continue;
      const p=playerByName(r.name,teamByName(r.team)?.id); if(!p)continue;
      for(const sel of (r.selections||[])){
        if(sel.event!=='Arnis Anyo'||!['Synchronized','Mixed'].includes(sel.anyoType))continue;
        const matches=(state().categories||[]).filter(c=>{
          if(String(c.event)!=='Arnis Anyo')return false;
          if(String(c.anyoType||'')!==String(sel.anyoType))return false;
          if(String(c.anyoStyle||'Traditional')!==String(sel.style||'Traditional'))return false;
          if(String(c.anyoWeapon||'Any')!=='Any'&&String(c.anyoWeapon)!==String(sel.weapon||'Any'))return false;
          if(c.sex!=='Mixed'&&c.sex!==p.sex)return false;
          const preset=String(c.preset||'').toUpperCase(),name=String(c.name||'');
          const categoryLevel=preset.includes('ANYO-ELEMENTARY')||/^\s*elementary\b/i.test(name)?'Elementary':preset.includes('ANYO-SECONDARY')||/^\s*secondary\b/i.test(name)?'Secondary':'';
          if(sel.schoolLevel&&categoryLevel&&String(sel.schoolLevel)!==categoryLevel)return false;
          return true;
        });
        for(const c of matches){
          const key=[p.teamId||'',String(r.groupReference).trim().toLowerCase(),c.id].join('|');
          if(!groups.has(key))groups.set(key,{category:c,reference:String(r.groupReference).trim(),players:[]});
          const g=groups.get(key);if(!g.players.some(x=>x.id===p.id))g.players.push(p);
        }
      }
    }
    let groupsCreated=0;
    for(const g of groups.values()){
      const c=g.category;
      const valid=c.anyoType==='Mixed' ? g.players.length===2 && new Set(g.players.map(x=>x.sex)).size===2 : g.players.length>=2&&g.players.length<=3;
      if(!valid)continue;
      const same=(state().anyoEntries||[]).find(e=>e.categoryId===c.id&&String(e.groupReference||'').trim().toLowerCase()===g.reference.toLowerCase()&&e.type===c.anyoType&&e.status!=='deleted');
      if(same){same.memberIds=[...new Set([...(same.memberIds||[]),...g.players.map(x=>x.id)])].slice(0,3);continue;}
      const prefix=c.anyoType==='Mixed'?'MA':'SA';
      const number=prefix+'-'+String((state().anyoEntries||[]).filter(e=>e.categoryId===c.id).length+1).padStart(3,'0');
      state().anyoEntries.push({id:uid(),number,type:c.anyoType,categoryId:c.id,style:c.anyoStyle,weapon:c.anyoWeapon,groupReference:g.reference,memberIds:g.players.map(x=>x.id),status:'active'});
      groupsCreated++;
    }
    if(groupsCreated)log('ANYO GROUPS MATCHED',`${groupsCreated} Synchronized/Mixed group entr${groupsCreated===1?'y':'ies'} created from Group Name / Group Reference.`);
    if(typeof save==='function')save();
    const cloudOk=await window.RADIUM_CLOUD?.flush?.();
    if(!cloudOk){
      window.renderAll?.();
      const cloudReason=window.RADIUM_CLOUD?.state?.lastError?.message||'The service did not confirm the save.';
      notify('<b>Import was not confirmed by the RADIUM Tournament Service.</b> '+esc(cloudReason)+' RADIUM kept the import preview so it is not silently lost. Correct the reported issue before retrying.','error');
      return;
    }
    window.renderAll?.();
    imported=null;renderPreview();notify(`<b>Registration file import saved successfully.</b> ${created} new players, ${updated} existing players updated, ${createdTeams} teams created, ${registrations} category selections prepared, ${groupsCreated} Anyo group entries matched. The saved tournament data is now confirmed.`,'success');toast('Registration file imported and saved successfully.');
  }

  async function runAI(rows){
    if(!rows?.length)return;
    try{
      notify('File read successfully. AI is understanding different headers, wording and event descriptions…','info');
      const chunkSize=100, merged=[];let model='';
      for(let i=0;i<rows.length;i+=chunkSize){
        const ai=await understandWithAI(rows.slice(i,i+chunkSize));
        if(ai?.model)model=ai.model;
        merged.push(...(ai?.rows||[]));
        notify(`AI understanding: ${Math.min(i+chunkSize,rows.length)} of ${rows.length} rows processed…`,'info');
      }
      const aiRows=aiCanonicalRows(merged);
      if(aiRows.length!==rows.length){
        notify('<b>AI returned an incomplete result.</b> RADIUM kept the normal importer result and did not guess missing data.','info');
        return;
      }
      imported=validate(aiRows);imported.aiModel=model;renderPreview();
      const review=imported.players.filter(r=>r.ai?.needsReview).length;
      notify(`<b>AI understanding complete.</b> ${imported.players.length} response row(s) analyzed.${review?` ${review} row(s) need human review.`:' All rows are clear.'}`,review?'info':'success');
    }catch(aiErr){
      console.warn('RADIUM AI import fallback',aiErr);
      const errors=imported?.players?.reduce((n,r)=>n+r.errors.length,0)||0;
      notify(`<b>AI understanding is unavailable.</b> RADIUM continued with its built-in tolerant importer.${errors?` ${errors} issue(s) still need review.`:' The response file is otherwise ready.'}<br><small>${esc(aiErr.message||aiErr)}</small>`,errors?'error':'info');
    }
  }

  async function ensureCloudStateReady(){
    const cloud=window.RADIUM_CLOUD;
    if(!cloud?.getId?.())throw new Error('No active tournament is selected. Load the tournament before importing File import registrations.');
    if(cloud.state?.loaded&&((state().categories||[]).length>0||(state().players||[]).length>0))return;
    notify('Loading the current tournament before matching categories…','info');
    const ok=await cloud.pull?.();
    if(!ok)throw new Error(cloud.state?.lastError?.message||'RADIUM could not load the current tournament.');
    if(!cloud.state?.loaded)throw new Error('RADIUM is still loading the tournament. Please wait a moment and try again.');
  }
  async function loadFile(file){
    let stage='starting';
    try{
      stage='loading tournament';
      await ensureCloudStateReady();
      stage='reading file';
      notify('Reading registration file…','info');
      const buf=await readFile(file);
      if(!buf||typeof buf.byteLength!=='number'||buf.byteLength===0)throw new Error('The selected file is empty or could not be read.');
      stage='parsing workbook';
      const parsed=await parseWorkbook(buf,String(file?.name||''));
      const rows=Array.isArray(parsed)?parsed:[];
      if(!rows.length)throw new Error('No readable registration rows were found in the selected file.');
      stage='validating registration rows';
      const structuredWorkbook=rows.some(r=>r?.__radiumStructuredWorkbook===true);
      lastRawRows=structuredWorkbook?[]:rows;
      imported=validate(rows);
      if(!imported||!Array.isArray(imported.players))throw new Error('The importer could not create a registration preview.');
      renderPreview();
      if(!(state().categories||[]).length){
        notify('<b>No tournament categories are loaded.</b> RADIUM will not guess categories. Create/load the categories first, then import again.','error');
        return;
      }
      if(structuredWorkbook){
        notify('<b>CAPRISAA workbook recognized.</b> Only selected event entries were read. DepEd-PEKAF Anyo is set to Non-Traditional automatically; weight mismatches are warnings and will be checked at weigh-in.','success');
      }else{
        stage='AI understanding';
        await runAI(rows);
      }
    }catch(e){
      console.error('RADIUM entry import failed at '+stage,e);
      notify('<b>Could not import this file.</b><br><small>Stage: '+esc(stage)+'</small><br>'+esc(e?.message||e),'error');
    }
  }
  function renderPage(){const s=state(),cur=$('entryCurrentTournament');if(cur)cur.innerHTML='<b>'+esc(s.setup?.name||'Untitled Tournament')+'</b>'+(s.setup?.date?' • '+esc(s.setup.date):'')+(s.setup?.venue?' • '+esc(s.setup.venue):'');}
  function init(){
    $('entryFormFile')?.addEventListener('change',e=>e.target.files[0]&&loadFile(e.target.files[0]));
    $('importEntryBtn')?.addEventListener('click',importRows);
    $('clearEntryImportBtn')?.addEventListener('click',()=>{imported=null;lastRawRows=[];if($('entryFormFile'))$('entryFormFile').value='';renderPreview();notify('Ready to import an Excel, Word (.docx), or CSV registration file.','info')});
    $('entryAiRetryBtn')?.addEventListener('click',()=>lastRawRows.length&&runAI(lastRawRows));$('entryTeamFilter')?.addEventListener('change',renderPreview);$('copyTeamRegistrationBtn')?.addEventListener('click',copyTeamRegistration);
    document.addEventListener('DOMContentLoaded',renderPage);document.addEventListener('radium-auth-ready',renderPage);window.addEventListener('radium-data-changed',renderPage);document.addEventListener('click',e=>{if(e.target.closest('[data-page="entryFormsPage"]'))setTimeout(renderPage,80)});
    renderPage();renderPreview();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.RADIUM_ENTRY_FORMS={loadFile,renderPage,parseEventChoice,eventSelections,validate,understandWithAI,parseWorkbook,parseDocx,readZipEntries};
})();

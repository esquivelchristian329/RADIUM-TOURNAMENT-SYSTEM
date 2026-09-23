import { createClient } from 'jsr:@supabase/supabase-js@2'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const roles = ['ADMIN','TOURNAMENT_MANAGER','ACCOUNTANT','TABLE_OFFICIAL']
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})

async function caller(req:Request){
  const auth=req.headers.get('authorization')||''
  if(!auth.startsWith('Bearer ')) throw new Error('Missing authorization.')
  const token=auth.slice(7)
  const {data,error}=await admin.auth.getUser(token)
  if(error||!data.user) throw new Error('Invalid session.')
  const {data:p,error:pe}=await admin.from('profiles').select('id,role,full_name').eq('id',data.user.id).maybeSingle()
  if(pe||!p||p.role!=='ADMIN') throw new Error('Admin account required.')
  return data.user
}

Deno.serve(async req=>{
  try{
    if(req.method!=='POST') return json({error:'POST required'},405)
    const actor=await caller(req)
    const body=await req.json().catch(()=>({}))
    const action=body.action||'list'
    if(action==='list'){
      const {data:profiles,error}=await admin.from('profiles').select('id,full_name,role,created_at,updated_at').order('created_at',{ascending:false})
      if(error) throw error
      const {data:tournaments,error:te}=await admin.from('tournaments').select('id,name,status,event_date,venue,updated_at').order('updated_at',{ascending:false})
      if(te) throw te
      const out=[]
      for(const p of (profiles||[]).filter(x=>roles.includes(String(x.role||'').toUpperCase()))){
        const {data:u}=await admin.auth.admin.getUserById(p.id)
        const {data:a}=await admin.from('staff_court_assignments').select('id,court_id,active,court:courts(id,name,court_number)').eq('user_id',p.id).eq('active',true)
        const {data:tuRows}=await admin.from('tournament_users').select('tournament_id,role').eq('user_id',p.id).order('created_at',{ascending:false}).limit(1)
        const tu=tuRows?.[0]||null
        const tournament=(tournaments||[]).find(t=>String(t.id)===String(tu?.tournament_id))||null
        out.push({...p,email:u.user?.email||'',assignments:a||[],tournament})
      }
      return json({staff:out,tournaments:tournaments||[]})
    }
    if(action==='create'){
      const role=String(body.role||'').toUpperCase()
      if(!roles.includes(role)) throw new Error('Invalid staff role.')
      const tournamentId=body.tournament_id||null
      const courtId=body.court_id||null
      if(role==='TABLE_OFFICIAL' && courtId && !tournamentId) throw new Error('A Table Official court requires a tournament assignment.')
      if(tournamentId){ const {data:t,error:te}=await admin.from('tournaments').select('id').eq('id',tournamentId).maybeSingle(); if(te||!t) throw new Error('Tournament not found.') }
      if(courtId){ const {data:c,error:ce}=await admin.from('courts').select('id,tournament_id').eq('id',courtId).maybeSingle(); if(ce||!c||String(c.tournament_id)!==String(tournamentId)) throw new Error('Court does not belong to the selected tournament.') }
      const generated = !body.email
      const email=String(body.email||`staff.${role.toLowerCase()}.${crypto.randomUUID().slice(0,8)}@radium.local`).toLowerCase()
      const password=String(body.password||`RADIUM-${role.slice(0,4)}-${crypto.randomUUID().replaceAll('-','').slice(0,10)}!`)
      const {data:u,error:ue}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:body.full_name||''},app_metadata:{radium_role:role}})
      if(ue||!u.user) throw ue||new Error('Could not create Auth user.')
      const {error:pe}=await admin.from('profiles').upsert({id:u.user.id,full_name:body.full_name||null,role},{onConflict:'id'})
      if(pe){await admin.auth.admin.deleteUser(u.user.id);throw pe}
      if(tournamentId && role!=='ADMIN'){ const {data:assigned,error:ae}=await admin.rpc('radium_assign_staff_tournament',{p_user_id:u.user.id,p_tournament_id:tournamentId}); if(ae) throw ae }
      if(role==='TABLE_OFFICIAL' && tournamentId && courtId){ const {error:ce}=await admin.from('staff_court_assignments').insert({tournament_id:tournamentId,user_id:u.user.id,court_id:courtId,active:true}); if(ce) throw ce }
      return json({user_id:u.user.id,email,password,generated})
    }
    if(action==='update'){
      const id=body.user_id
      if(!id) throw new Error('user_id required.')
      const patch:any={}
      if(body.email) patch.email=String(body.email).toLowerCase()
      if(body.password) patch.password=String(body.password)
      if(body.full_name!==undefined) patch.user_metadata={full_name:body.full_name}
      if(body.role){ const r=String(body.role).toUpperCase(); if(!roles.includes(r)) throw new Error('Invalid role.'); patch.app_metadata={radium_role:r}; const {error:re}=await admin.from('profiles').update({role:r,full_name:body.full_name??undefined}).eq('id',id); if(re) throw re }
      if(Object.keys(patch).length){const {error:e}=await admin.auth.admin.updateUserById(id,patch);if(e)throw e}
      return json({ok:true})
    }
    if(action==='assign_tournament'){
      const id=body.user_id,tournamentId=body.tournament_id
      if(!id||!tournamentId) throw new Error('user_id and tournament_id are required.')
      const {data:assigned,error}=await admin.rpc('radium_assign_staff_tournament',{p_user_id:id,p_tournament_id:tournamentId})
      if(error) throw error
      return json({ok:true,assignment:assigned})
    }
    if(action==='clear_tournament'){
      const id=body.user_id
      if(!id) throw new Error('user_id required.')
      const {data:ok,error}=await admin.rpc('radium_clear_staff_tournament',{p_user_id:id})
      if(error) throw error
      return json({ok:!!ok})
    }
    if(action==='assign_court'){
      const id=body.user_id,tournamentId=body.tournament_id,courtId=body.court_id
      if(!id||!tournamentId||!courtId) throw new Error('user_id, tournament_id and court_id are required.')
      const {data:p}=await admin.from('profiles').select('role').eq('id',id).maybeSingle(); if(p?.role!=='TABLE_OFFICIAL') throw new Error('Only TABLE_OFFICIAL accounts can be assigned to courts.')
      const {data:c}=await admin.from('courts').select('id,tournament_id').eq('id',courtId).maybeSingle(); if(!c||String(c.tournament_id)!==String(tournamentId)) throw new Error('Court mismatch.')
      await admin.from('staff_court_assignments').update({active:false}).eq('user_id',id).eq('tournament_id',tournamentId)
      const {error}=await admin.from('staff_court_assignments').insert({tournament_id:tournamentId,user_id:id,court_id:courtId,active:true}); if(error)throw error
      return json({ok:true})
    }
    if(action==='remove'){
      const id=body.user_id;if(!id)throw new Error('user_id required.')
      if(id===actor.id)throw new Error('You cannot delete the currently signed-in admin account.')
      const {error}=await admin.auth.admin.deleteUser(id);if(error)throw error
      return json({ok:true})
    }
    throw new Error('Unknown action.')
  }catch(e){ console.error(e); return json({error:e?.message||String(e)},400) }
})

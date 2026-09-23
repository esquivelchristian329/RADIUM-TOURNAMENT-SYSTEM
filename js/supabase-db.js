/* RADIUM DB bridge: online-only Supabase database connection. */
(function(){
  const cfg = window.RADIUM_SUPABASE_CONFIG || {};
  const state = { enabled:false, client:null, online:navigator.onLine, lastError:null };
  window.RADIUM_DB = {
    state,
    isConfigured(){ return !!(cfg.url && cfg.anonKey && !cfg.url.includes('YOUR_PROJECT') && !cfg.anonKey.includes('YOUR_')); },
    async init(){
      if(!this.isConfigured()) return {enabled:false, reason:'not-configured'};
      try{
        const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        state.client = mod.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        state.enabled = true;
        return {enabled:true};
      }catch(e){ state.lastError=e; return {enabled:false, reason:e.message}; }
    },
    client(){ if(!state.client) throw new Error('Supabase is not initialized'); return state.client; },
    async signIn(email,password){
      // Use a direct Auth request so Android/local-server failures return the
      // real HTTP status/message instead of the generic "Failed to fetch".
      const base=String(cfg.url||'').replace(/\/+$/,'');
      const key=cfg.anonKey;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),15000);
      try{
        const res=await fetch(base+'/auth/v1/token?grant_type=password',{
          method:'POST',
          headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+key},
          body:JSON.stringify({email,password}),
          signal:controller.signal,
          cache:'no-store'
        });
        const text=await res.text();
        let data=null; try{data=text?JSON.parse(text):null;}catch(e){}
        if(!res.ok){
          const msg=data?.msg||data?.message||data?.error_description||data?.error||text||('HTTP '+res.status);
          console.warn('RADIUM sign-in service response:',res.status,msg); const err=new Error(res.status===400?'Sign-in failed. Check your email and password.':res.status===429?'Too many sign-in attempts. Please wait and try again.':'Sign-in could not be completed. Please check the tournament connection and try again.');
          err.status=res.status; err.details=data||text;
          return {data:null,error:err};
        }
        if(!data?.access_token || !data?.refresh_token){
          const err=new Error('Sign-in could not be completed. Please try again.');
          err.details=data;
          return {data:null,error:err};
        }
        // Hand the tokens to the normal Supabase client so the rest of RADIUM
        // keeps using the existing session/profile/RLS/realtime code.
        const set=await this.client().auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
        if(set.error) return {data:null,error:set.error};
        return {data:{user:set.data?.user||data.user,session:set.data?.session||data},error:null};
      }catch(e){
        if(e?.name==='AbortError'){
          return {data:null,error:new Error('Sign-in timed out. Check the device internet connection and try again.')};
        }
        const detail=e?.message||String(e); console.warn('RADIUM sign-in request failed:',detail);
        return {data:null,error:new Error('Sign-in could not be completed. Check the tournament connection and try again.')};
      }finally{clearTimeout(timer);}
    },
    async resetPassword(email,redirectTo){ return this.client().auth.resetPasswordForEmail(email,{redirectTo}); },
    async updatePassword(password){ return this.client().auth.updateUser({password}); },
    async signOut(){ return this.client().auth.signOut(); },
    async session(){ return this.client().auth.getSession(); },
    async select(table, query){
      let q=this.client().from(table).select(query?.select||'*');
      if(query?.eq) Object.entries(query.eq).forEach(([k,v])=>q=q.eq(k,v));
      if(query?.order) q=q.order(query.order.column,{ascending:query.order.ascending!==false});
      if(query?.limit) q=q.limit(query.limit);
      return q;
    },
    async upsert(table, rows, options){ return this.client().from(table).upsert(rows,options||{onConflict:'id'}).select(); },
    async insert(table, rows){ return this.client().from(table).insert(rows).select(); },
    async insertOne(table, row){ const r=await this.client().from(table).insert(row).select().single(); return r; },
    async insertNoReturn(table, rows){ return this.client().from(table).insert(rows); },
    async upsertNoReturn(table, rows, options){ return this.client().from(table).upsert(rows,options||{onConflict:'id'}); },
    async update(table, values, filters){
      let q=this.client().from(table).update(values); Object.entries(filters||{}).forEach(([k,v])=>q=q.eq(k,v)); return q.select();
    },
    async rpc(functionName, args){ return this.client().rpc(functionName, args || {}); },
    async remove(table, filters){
      let q=this.client().from(table).delete(); Object.entries(filters||{}).forEach(([k,v])=>q=q.eq(k,v)); return q;
    },
    subscribeMatches(tournamentId, callback){
      if(!state.enabled) return null;
      return this.client().channel('radium-matches-'+tournamentId).on('postgres_changes',{event:'*',schema:'public',table:'matches',filter:'tournament_id=eq.'+tournamentId},callback).subscribe();
    },
    subscribeAudit(tournamentId, callback){
      if(!state.enabled) return null;
      return this.client().channel('radium-audit-'+tournamentId).on('postgres_changes',{event:'INSERT',schema:'public',table:'audit_logs',filter:'tournament_id=eq.'+tournamentId},callback).subscribe();
    },
    statusText(){ return state.enabled && state.online ? 'CLOUD CONNECTED' : 'CLOUD DISCONNECTED'; }
  };
  window.addEventListener('online',()=>{state.online=true;document.dispatchEvent(new CustomEvent('radium-db-status',{detail:state}));});
  window.addEventListener('offline',()=>{state.online=false;document.dispatchEvent(new CustomEvent('radium-db-status',{detail:state}));});
})();

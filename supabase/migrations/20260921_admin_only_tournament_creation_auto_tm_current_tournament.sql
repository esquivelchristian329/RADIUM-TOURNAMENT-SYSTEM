-- RADIUM: one current tournament, Admin creates it, Tournament Manager uses it automatically.
-- Applied to the live Supabase project as migration:
-- admin_only_tournament_creation_auto_tm_current_tournament

create or replace function public.radium_start_tournament()
returns public.tournaments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  profile_role text;
  new_row public.tournaments;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select upper(coalesce(p.role,'')) into profile_role from public.profiles p where p.id=uid;
  if profile_role <> 'ADMIN' then raise exception 'Only Admin can create a new tournament'; end if;
  if exists(select 1 from public.tournaments where status in ('draft','active')) then
    raise exception 'An unfinished tournament already exists. Complete or archive it before starting a new tournament.';
  end if;
  insert into public.tournaments(name,venue,event_date,organizer,status,official_pin_hash,billing_mode,currency,settings)
  values('Untitled Tournament',null,current_date,null,'draft',null,'PAID','PHP',
    jsonb_build_object('version',14,'setup',jsonb_build_object('name','Untitled Tournament','date',current_date,'venue','','organizer','', 'courts',2,'duration',60,'type','single','competitionProgram','GENERAL','combativeRounds',3,'gold',5,'silver',3,'bronze',1,'billingMode','PAID','currency','PHP','scoreboardLogos',jsonb_build_array('','','','')),'activeCategory',null,'locked',false,'_cloud',jsonb_build_object('version',4)))
  returning * into new_row;
  insert into public.tournament_users(tournament_id,user_id,role) values(new_row.id,uid,'admin') on conflict(tournament_id,user_id) do update set role='admin';
  return new_row;
exception when unique_violation then
  raise exception 'An unfinished tournament already exists. Complete or archive it before starting a new tournament.';
end;
$function$;

create or replace function public.radium_bootstrap_current_tournament()
returns public.tournaments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid(); profile_role text; current_row public.tournaments;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select upper(coalesce(p.role,'')) into profile_role from public.profiles p where p.id=uid;
  if profile_role <> 'TOURNAMENT_MANAGER' then raise exception 'Tournament Manager account required'; end if;
  select * into current_row from public.tournaments where status in ('draft','active') order by updated_at desc nulls last, created_at desc limit 1;
  if not found then return null; end if;
  insert into public.tournament_users(tournament_id,user_id,role) values(current_row.id,uid,'tournament_manager') on conflict(tournament_id,user_id) do update set role='tournament_manager';
  return current_row;
end;
$function$;

revoke all on function public.radium_start_tournament() from public;
grant execute on function public.radium_start_tournament() to authenticated;
revoke all on function public.radium_bootstrap_current_tournament() from public;
grant execute on function public.radium_bootstrap_current_tournament() to authenticated;

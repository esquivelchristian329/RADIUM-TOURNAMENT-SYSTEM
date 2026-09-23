-- RADIUM: Tournament Manager can start only the tournament assigned by Admin.
-- Starting changes status draft -> active and permanently locks preparation/setup state.
-- Scoring, matches, results and Anyo performances remain available through their dedicated paths.

CREATE OR REPLACE FUNCTION public.radium_start_assigned_tournament(p_tournament_id uuid)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  role_name text;
  row_out public.tournaments;
  s jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT upper(coalesce(p.role,'')) INTO role_name FROM public.profiles p WHERE p.id=uid;
  IF role_name <> 'TOURNAMENT_MANAGER' THEN
    RAISE EXCEPTION 'Only the assigned Tournament Manager can start this tournament';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_users
    WHERE tournament_id=p_tournament_id AND user_id=uid
      AND lower(role)='tournament_manager'
  ) THEN
    RAISE EXCEPTION 'This Tournament Manager is not assigned to this tournament';
  END IF;
  SELECT * INTO row_out FROM public.tournaments WHERE id=p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF row_out.status='completed' THEN RAISE EXCEPTION 'Tournament is already completed'; END IF;
  IF row_out.status='active' THEN RETURN row_out; END IF;

  s := coalesce(row_out.settings,'{}'::jsonb);
  s := jsonb_set(s,'{locked}','true'::jsonb,true);
  s := jsonb_set(s,'{_cloud,tournamentStatus}','"active"'::jsonb,true);
  s := jsonb_set(s,'{_cloud,startedAt}',to_jsonb(clock_timestamp()),true);

  UPDATE public.tournaments
  SET status='active', settings=s, updated_at=clock_timestamp()
  WHERE id=p_tournament_id
  RETURNING * INTO row_out;
  RETURN row_out;
END;
$$;

REVOKE ALL ON FUNCTION public.radium_start_assigned_tournament(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.radium_start_assigned_tournament(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.radium_save_tournament(tid uuid, incoming jsonb)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_row public.tournaments;
  new_settings jsonb;
  result_row public.tournaments;
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT upper(coalesce(p.role,'')) INTO caller_role FROM public.profiles p WHERE p.id=auth.uid();
  IF NOT (public.has_tournament_role(tid,array['ADMIN'::text,'TOURNAMENT_MANAGER'::text]) OR caller_role='ADMIN') THEN
    RAISE EXCEPTION 'Tournament Manager or Admin permission required';
  END IF;
  SELECT * INTO old_row FROM public.tournaments WHERE id=tid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament % not found',tid; END IF;

  new_settings:=public.radium_jsonb_merge(coalesce(old_row.settings,'{}'::jsonb),coalesce(incoming,'{}'::jsonb));

  IF old_row.status='active' THEN
    -- Preparation/setup state is frozen after the Tournament Manager starts the event.
    new_settings:=jsonb_set(new_settings,'{setup}',coalesce(old_row.settings->'setup',new_settings->'setup','{}'::jsonb),true);
    new_settings:=jsonb_set(new_settings,'{locked}','true'::jsonb,true);
    new_settings:=jsonb_set(new_settings,'{_cloud,tournamentStatus}','"active"'::jsonb,true);
  END IF;

  IF upper(trim(coalesce(caller_role,'')))<>'ADMIN' THEN
    new_settings:=jsonb_set(new_settings,'{setup,billingMode}',to_jsonb(coalesce(old_row.billing_mode,'PAID')),true);
    new_settings:=jsonb_set(new_settings,'{_cloud,billingMode}',to_jsonb(coalesce(old_row.billing_mode,'PAID')),true);
  END IF;
  new_settings:=jsonb_set(new_settings,'{_cloud,serverMergedAt}',to_jsonb(clock_timestamp()),true);
  new_settings:=jsonb_set(new_settings,'{_cloud,serverRevision}',to_jsonb(extract(epoch from clock_timestamp())::bigint),true);

  UPDATE public.tournaments
  SET name=coalesce(new_settings->'setup'->>'name',old_row.name),
      venue=nullif(new_settings->'setup'->>'venue',''),
      event_date=case when nullif(new_settings->'setup'->>'date','') is null then old_row.event_date else (new_settings->'setup'->>'date')::date end,
      organizer=nullif(new_settings->'setup'->>'organizer',''),
      official_pin_hash=coalesce(new_settings->'_cloud'->>'officialPinHash',old_row.official_pin_hash),
      billing_mode=coalesce(new_settings->'_cloud'->>'billingMode',old_row.billing_mode),
      currency=coalesce(new_settings->'_cloud'->>'currency',old_row.currency),
      settings=new_settings
  WHERE id=tid
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.radium_save_tournament(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.radium_save_tournament(uuid,jsonb) TO authenticated;

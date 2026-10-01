-- RADIUM V59: preserve each Anyo performance attempt independently.
-- Safe for existing rows: current records become attempt_number = 1.

alter table public.anyo_performances
  add column if not exists attempt_number integer not null default 1;

-- The previous indexes permitted only one saved row per competitor/category.
-- Replace them with per-attempt uniqueness so repeat performances are separate rows.
drop index if exists public.uq_anyo_performer_entry;
drop index if exists public.uq_anyo_performer_player;
drop index if exists public.uq_anyo_performer_team;

create unique index if not exists uq_anyo_performer_entry
  on public.anyo_performances (tournament_id, category_id, entry_id, attempt_number)
  where entry_id is not null;
create unique index if not exists uq_anyo_performer_player
  on public.anyo_performances (tournament_id, category_id, player_id, attempt_number)
  where player_id is not null;
create unique index if not exists uq_anyo_performer_team
  on public.anyo_performances (tournament_id, category_id, team_id, attempt_number)
  where team_id is not null;

create index if not exists idx_anyo_perf_entry_attempt
  on public.anyo_performances (tournament_id, category_id, entry_id, attempt_number desc);

create or replace function public.radium_save_anyo_performance(
  p_tournament_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_entry_id uuid := nullif(p_payload->>'entryId','')::uuid;
  v_category_id uuid := nullif(p_payload->>'categoryId','')::uuid;
  v_perf_id uuid;
  v_attempt_number integer := 1;
  v_repeat boolean := coalesce((p_payload->>'repeatAttempt')::boolean, false);
  v_judges integer := greatest(3, least(5, coalesce((p_payload->>'judgeCount')::integer, 5)));
  v_entry public.anyo_entries%rowtype;
  v_category public.categories%rowtype;
  v_judge_id uuid;
  v_score jsonb;
  v_key text;
  v_judge_no integer;
  v_qty integer;
  v_rate numeric;
  v_violation text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.has_tournament_role(p_tournament_id, array['admin','official','table_official']) then
    raise exception 'Authorized tournament official required';
  end if;
  if v_entry_id is null or v_category_id is null then
    raise exception 'Anyo entry and category are required';
  end if;

  -- Lock the entry row to serialize attempt numbering for this performer.
  select * into v_entry
  from public.anyo_entries
  where id=v_entry_id and tournament_id=p_tournament_id
    and category_id=v_category_id and status='active'
  for update;
  if not found then raise exception 'Anyo entry is not confirmed in this tournament/category'; end if;

  select * into v_category
  from public.categories
  where id=v_category_id and tournament_id=p_tournament_id;
  if not found or v_category.event_type <> 'Anyo' then
    raise exception 'Selected category is not an Anyo category';
  end if;

  if v_repeat then
    select coalesce(max(attempt_number), 1) + 1 into v_attempt_number
    from public.anyo_performances
    where tournament_id=p_tournament_id and category_id=v_category_id and entry_id=v_entry_id;
  else
    v_attempt_number := greatest(1, coalesce(nullif(p_payload->>'attemptNumber','')::integer, 1));
  end if;

  for v_judge_no in 1..v_judges loop
    insert into public.anyo_judges(tournament_id,name,judge_number,active)
    values(p_tournament_id,'JUDGE '||v_judge_no,v_judge_no,true)
    on conflict(tournament_id,judge_number) do update set active=true
    returning id into v_judge_id;
  end loop;

  -- A regular save edits only the same numbered attempt (normally attempt 1).
  -- A repeat always gets a new row and never updates the original attempt.
  if not v_repeat then
    select id into v_perf_id
    from public.anyo_performances
    where tournament_id=p_tournament_id and category_id=v_category_id
      and entry_id=v_entry_id and attempt_number=v_attempt_number
    limit 1;
  end if;

  if v_perf_id is null then
    insert into public.anyo_performances(
      tournament_id,category_id,entry_id,player_id,team_id,attempt_number,
      performer_index,judge_count,raw_total,kept_total,average,judge_average,
      final_score,total_deduction,deduction_rates,dropped_scores,elapsed_ms,
      elapsed_time,finished,started_at,finished_at,metadata
    ) values (
      p_tournament_id,v_category_id,v_entry_id,null,null,v_attempt_number,
      coalesce((p_payload->>'performerIndex')::integer,0),v_judges,
      coalesce((p_payload->>'rawTotal')::numeric,0),
      coalesce((p_payload->>'keptTotal')::numeric,0),
      coalesce((p_payload->>'average')::numeric,0),
      coalesce((p_payload->>'judgeAverage')::numeric,coalesce((p_payload->>'average')::numeric,0)),
      coalesce((p_payload->>'finalScore')::numeric,coalesce((p_payload->>'average')::numeric,0)),
      coalesce((p_payload->>'totalDeduction')::numeric,0),
      coalesce(p_payload->'deductionRates','{}'::jsonb),
      coalesce(p_payload->'dropped','[]'::jsonb),
      coalesce((p_payload->>'elapsedMs')::bigint,0),p_payload->>'elapsedTime',true,
      nullif(p_payload->>'startedAt','')::timestamptz,
      coalesce(nullif(p_payload->>'finishedAt','')::timestamptz,now()),
      jsonb_build_object('categoryName',coalesce(p_payload->>'categoryName',''),
        'competitorType','entry','entryId',v_entry_id,
        'attemptNumber',v_attempt_number,'repeatAttempt',v_repeat)
    ) returning id into v_perf_id;
  else
    update public.anyo_performances set
      performer_index=coalesce((p_payload->>'performerIndex')::integer,performer_index),
      judge_count=v_judges,
      raw_total=coalesce((p_payload->>'rawTotal')::numeric,0),
      kept_total=coalesce((p_payload->>'keptTotal')::numeric,0),
      average=coalesce((p_payload->>'average')::numeric,0),
      judge_average=coalesce((p_payload->>'judgeAverage')::numeric,coalesce((p_payload->>'average')::numeric,0)),
      final_score=coalesce((p_payload->>'finalScore')::numeric,coalesce((p_payload->>'average')::numeric,0)),
      total_deduction=coalesce((p_payload->>'totalDeduction')::numeric,0),
      deduction_rates=coalesce(p_payload->'deductionRates','{}'::jsonb),
      dropped_scores=coalesce(p_payload->'dropped','[]'::jsonb),
      elapsed_ms=coalesce((p_payload->>'elapsedMs')::bigint,0),
      elapsed_time=p_payload->>'elapsedTime',finished=true,
      started_at=nullif(p_payload->>'startedAt','')::timestamptz,
      finished_at=coalesce(nullif(p_payload->>'finishedAt','')::timestamptz,now()),
      metadata=jsonb_build_object('categoryName',coalesce(p_payload->>'categoryName',''),
        'competitorType','entry','entryId',v_entry_id,
        'attemptNumber',v_attempt_number,'repeatAttempt',false)
    where id=v_perf_id;
  end if;

  delete from public.anyo_performance_scores where performance_id=v_perf_id;
  for v_score,v_key in
    select value, ordinality::text
    from jsonb_array_elements(coalesce(p_payload->'scores','[]'::jsonb)) with ordinality
  loop
    if v_score is not null and v_score <> 'null'::jsonb and v_key::integer between 1 and v_judges then
      select id into v_judge_id from public.anyo_judges
      where tournament_id=p_tournament_id and judge_number=v_key::integer;
      insert into public.anyo_performance_scores(performance_id,judge_id,score)
      values(v_perf_id,v_judge_id,(v_score::text)::numeric);
    end if;
  end loop;

  delete from public.anyo_performance_deductions where performance_id=v_perf_id;
  for v_key in select key from jsonb_object_keys(coalesce(p_payload->'deductions','{}'::jsonb)) key loop
    v_qty := coalesce((p_payload->'deductions'->>v_key)::integer,0);
    if v_qty > 0 then
      v_rate := coalesce((p_payload->'deductionRates'->>v_key)::numeric,0);
      v_violation := case v_key when 'tv' then 'TIME' when 'dv' then 'DISARM'
        when 'lv' then 'OUT_OF_MAT' when 'fp' then 'FOUL_PLAY' else 'OTHER' end;
      insert into public.anyo_performance_deductions(
        performance_id,violation_type,quantity,deduction_amount,recorded_by
      ) values(v_perf_id,v_violation,v_qty,v_rate*v_qty,v_uid);
    end if;
  end loop;

  return jsonb_build_object('id',v_perf_id,'tournament_id',p_tournament_id,
    'category_id',v_category_id,'entry_id',v_entry_id,'attempt_number',v_attempt_number,
    'repeat_attempt',v_repeat);
end;
$$;

-- Existing execute grants are retained by CREATE OR REPLACE FUNCTION.

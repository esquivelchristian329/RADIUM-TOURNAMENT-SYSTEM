-- RADIUM: allow ADMIN, TOURNAMENT_MANAGER and ACCOUNTANT to save team attendance.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_participations' and policyname='teampart_manager_accountant_insert') then
    create policy "teampart_manager_accountant_insert"
    on public.team_participations
    for insert
    to authenticated
    with check (private.has_tournament_role(tournament_id, array['ADMIN'::text, 'TOURNAMENT_MANAGER'::text, 'ACCOUNTANT'::text]));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_participations' and policyname='teampart_manager_accountant_update') then
    create policy "teampart_manager_accountant_update"
    on public.team_participations
    for update
    to authenticated
    using (private.has_tournament_role(tournament_id, array['ADMIN'::text, 'TOURNAMENT_MANAGER'::text, 'ACCOUNTANT'::text]))
    with check (private.has_tournament_role(tournament_id, array['ADMIN'::text, 'TOURNAMENT_MANAGER'::text, 'ACCOUNTANT'::text]));
  end if;
end $$;

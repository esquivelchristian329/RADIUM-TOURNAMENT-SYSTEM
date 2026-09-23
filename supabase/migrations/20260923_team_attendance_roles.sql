-- RADIUM V55: Team Attendance permissions
-- Safe to re-run. Does not modify attendance data.

DROP POLICY IF EXISTS "teampart_manager_accountant_insert" ON public.team_participations;
DROP POLICY IF EXISTS "teampart_manager_accountant_update" ON public.team_participations;

CREATE POLICY "teampart_manager_accountant_insert"
ON public.team_participations
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_tournament_role(
    tournament_id,
    ARRAY['ADMIN'::text, 'TOURNAMENT_MANAGER'::text, 'ACCOUNTANT'::text]
  )
);

CREATE POLICY "teampart_manager_accountant_update"
ON public.team_participations
FOR UPDATE
TO authenticated
USING (
  private.has_tournament_role(
    tournament_id,
    ARRAY['ADMIN'::text, 'TOURNAMENT_MANAGER'::text, 'ACCOUNTANT'::text]
  )
)
WITH CHECK (
  private.has_tournament_role(
    tournament_id,
    ARRAY['ADMIN'::text, 'TOURNAMENT_MANAGER'::text, 'ACCOUNTANT'::text]
  )
);

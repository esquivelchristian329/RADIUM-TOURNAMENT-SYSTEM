RADIUM V55 UPDATE

Fixes included:
1. Team Attendance saving supports ADMIN, TOURNAMENT_MANAGER and ACCOUNTANT (Supabase RLS migration included; live database policy was already applied).
2. Accounting always loads the tournament team directory, including FREE tournaments, so valid team_id records display real team names instead of Unassigned.
3. Team Attendance loads the authoritative Supabase teams table so team names remain visible even when local state is incomplete.
4. SET CHECKLIST text/action contrast improved for readability without changing layout.
5. Landing-page low-contrast text improved.
6. Landing-page Arnis Community logo section background changed to white; logo images/cards/layout are unchanged.
7. LIVE BRACKET now reads the saved setup.matchFlow and uses the same category/sex/round ordering and round-release gate as Match Queue/TV. It highlights released matches with FLOW numbers without changing bracket topology, BYEs, advancement, or layout.

Preserved:
- players, teams, registrations, attendance records, brackets, bracket topology, BYEs, winner advancement, scoreboard logos, realtime behavior, and responsive design.
- No player/registration data was changed by this package.

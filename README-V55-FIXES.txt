RADIUM V55 — TEAM ATTENDANCE / ACCOUNTING / LANDING / LIVE BRACKET FIXES

Base: RADIUM V54 SCOREBOARD LOGO PERSISTENCE FIX

FIXED:
1. TEAM ATTENDANCE SAVE
   - Live Supabase RLS allows ADMIN, TOURNAMENT_MANAGER, and ACCOUNTANT to INSERT/UPDATE team_participations.
   - Migration included under supabase/migrations/20260923_team_attendance_roles.sql.
   - The live project already has these policies applied.

2. ACCOUNTING — UNASSIGNED TEAM NAMES
   - Accounting now loads teams from Supabase even when billing mode is FREE.
   - Payment loading remains separate from team loading.
   - Registration, payment, and team displays use the live team-name map.

3. TEAM ATTENDANCE — TEAM NAMES
   - Attendance now loads teams directly from Supabase instead of depending on the browser's local team state.

4. SET CHECKLIST READABILITY
   - Increased text contrast and action text weight without changing the checklist layout.

5. LANDING PAGE TEXT READABILITY
   - Improved contrast for landing-page text on light backgrounds.

6. LANDING PAGE LOGO AREA
   - Logo section background is now white. Logo cards/images and layout were preserved.

7. LIVE BRACKET — MATCH FLOW
   - Live Bracket now reads saved setup.matchFlow.
   - Category selector is ordered using the same Match Flow rules as Queue/TV.
   - Round-by-round flows enforce the earliest unfinished playable round.
   - Pinweight → Bantamweight → Featherweight → Extra Lightweight → Half Lightweight ordering is preserved.
   - The next Match Flow match is highlighted.
   - The bracket topology and match positions are not rebuilt or rearranged.
   - Manual category selection is still supported.

VALIDATION:
- All standalone JavaScript files pass `node --check`.
- Embedded JavaScript in bracket-display.html passes `node --check`.

IMPORTANT:
- No player, team, category, bracket, or tournament data was modified by this ZIP.
- The live Supabase attendance policy was already applied separately; the included migration is for reproducible deployment to another Supabase project.

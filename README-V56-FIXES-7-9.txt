RADIUM V56 — FIXES 7–9
=======================

This build contains ONLY the requested fixes #7, #8 and #9. Fixes #1–#6 are preserved from the V55 source.

FIX #7 — LIVE BRACKET REFRESH
- Removed the 2-second automatic full live-bracket reload.
- Live Bracket now relies on Supabase Realtime events for tournament, match and category changes.
- Realtime events are lightly debounced to avoid duplicate reloads when several database events arrive together.
- Manual REFRESH NOW remains available.
- TV display refresh behavior was not changed.

FIX #8 — COMBATIVE SCOREBOARD CONTROLS
- Centered Blue and Red +/- score buttons under each score.
- Made score buttons larger and easier to use on touchscreens.
- Reworked center control buttons into a compact 2-column layout.
- Reduced center-button text size and allowed wrapping so labels no longer overlap or overflow.

FIX #9 — ANYO SCOREBOARD HEADER / DEDUCTIONS
- Fixed tournament title wrapping/clipping in the Anyo scoreboard header.
- Preserved the full title within the header using responsive sizing and ellipsis only when necessary.
- Increased/cleaned up the Table Official deduction controls and spacing.
- Hid the visible 0.50 deduction-rate configuration row from the operator scoreboard; the underlying default 0.50 rates and scoring calculation remain intact.
- Kept the 5-judge system, final score calculation, deductions, stopwatch, performer information and Supabase save workflow intact.

Source:
RADIUM-V55-TEAM-ATTENDANCE-ACCOUNTING-LANDING-LIVE-BRACKET-FLOW-FIX.zip

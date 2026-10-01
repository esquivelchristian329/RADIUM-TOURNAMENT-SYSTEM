RADIUM V59 — Anyo Repeat History, Detailed Results, CAPRISAA Header, Score Controls

Changes included:
1. Anyo repeat attempts are stored as separate anyo_performances rows with attempt_number. Existing rows are kept as attempt 1. The RPC migration serializes saves per Anyo entry and stores each repeat's judge scores and deductions against its own performance row.
2. Anyo category results and printable category reports include an expandable/print-open attempt history showing all five judge scores, judge average, TV/DV/LV/OV deduction quantities and amounts, total deductions, final score, and elapsed time per attempt.
3. Anyo scoreboard header is forced to CAPRISAA ARNIS TOURNAMENT. Logo slots remain reserved while hidden so one/two/four uploaded logos do not shift the title off-center.
4. Combative scoreboard logo slots remain reserved when no logo is uploaded, and the Blue/Red +/− controls are centered directly beneath each score.
5. After an Anyo score saves, the parent tournament window refreshes from Supabase so repeat history is loaded before a later full-state sync.

IMPORTANT DATABASE STEP:
Before deploying the updated front-end, run the SQL file:
supabase/migrations/20260930_anyo_repeat_attempt_history.sql
in the Supabase SQL Editor for the RADIUM project. This is a migration file only; it has NOT been applied to the live database by creating this ZIP. It adds the attempt_number column, replaces the old one-row-per-performer unique indexes with per-attempt indexes, and updates the RPC function.

Build source based on RADIUM V58. Test on a staging tournament first. Existing saved records remain attempt 1; past repeat scores that were overwritten before this fix cannot be reconstructed by this migration.

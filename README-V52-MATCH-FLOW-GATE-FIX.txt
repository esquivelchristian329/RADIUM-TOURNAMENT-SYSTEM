RADIUM V52 — MATCH FLOW ROUND GATE FIX

Fixes:
- Match Queue now treats ROUND_* match flow as an execution gate, not only a sort.
- A later round cannot enter the ready queue while an earlier playable round is unfinished.
- Match Queue and START NEXT AVAILABLE use the same ordering engine.
- Category priority remains:
  1. Pinweight
  2. Bantamweight
  3. Featherweight
  4. Extra Lightweight
  5. Half Lightweight
- TV/LED upcoming matches use the same round gate and category priority.
- TV uses the saved Supabase matchFlow setting.
- Existing brackets, match results, winner advancement, seeding, and scoring are not regenerated or altered by this fix.

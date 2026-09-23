RADIUM V53 — ONLY MISSING FIXES FROM V52

Baseline: V52 MATCH FLOW / ROUND GATE / PINWEIGHT-TO-HALF FIX.

Implemented only items that were missing in V52:

1. Tournament Setup scoreboard logo controls
   - The upload/replace/remove functions already existed in V52.
   - Added the missing event binding call.
   - Made the binding idempotent so repeated renders do not create duplicate handlers.
   - Existing Supabase Storage and scoreboard_logos persistence logic was not changed.

2. TV Display upcoming-match count
   - Existing Match Flow ordering, round gate, category order, winner announcement,
     transition animation, one/multiple-court handling, and title were already present.
   - Left those existing implementations unchanged.
   - Added a dynamic upcoming-match count based on the visible TV NEXT MATCHES panel height,
     with a safe 3–12 range.

3. TV ticker on small screens
   - Desktop ticker was already using the faster 24-second animation in the active inline TV CSS.
   - The external V50 mobile override was still slowing small screens to 52 seconds.
   - Changed only that mobile override to 24 seconds so the ticker speed is consistent.

No bracket logic, scoring logic, Supabase match-flow logic, layout redesign, or existing
winner/transition implementation was changed.

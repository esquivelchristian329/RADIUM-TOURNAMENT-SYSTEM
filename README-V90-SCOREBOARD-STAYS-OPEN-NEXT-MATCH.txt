RADIUM V90 — DIRECT NEXT MATCH SCOREBOARD LOAD

Fix:
- NEXT MATCH no longer redirects through the admin dashboard or Match Queue page.
- After the completed result is saved, the scoreboard queries online matches for the same tournament and selects the next eligible match assigned to the current court (or unassigned on that court).
- The same scoreboard window navigates directly to the next match scoreboard URL.
- Loads next category and competitor names, match ID, round/match number, court and match format. The scoreboard initializes the next match's round/timer controls on load.
- If there is no next eligible match, it displays a message and keeps the scoreboard open.

Validation performed: ZIP integrity and JavaScript syntax checks. Not browser-tested or deployed to Vercel. Please test with the live Supabase project before tournament use.

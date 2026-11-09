RADIUM V89 — COMBATIVE NEXT MATCH AUTO-START FIX

Changes:
- Combative scoreboard NEXT MATCH now saves/flushes the result and returns to the Match Queue with a one-time auto-start request.
- The queue waits until its ready-match list is loaded, then launches the next ready match on the same court directly into the Combative Scoreboard.
- If no eligible next match exists, the operator receives a clear message rather than being left on the admin default page.
- The one-time auto-start URL flag is removed before launching, preventing a normal refresh from triggering a second auto-start.

Testing: ZIP integrity and JavaScript syntax checks are performed when packaging. This has not been browser-tested or deployed to Vercel.

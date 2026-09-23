RADIUM V54 - SCOREBOARD LOGO PERSISTENCE FIX

Fixes:
- scoreboard_logos table + Storage are now authoritative for scoreboard logos.
- General tournament cloud payload no longer writes scoreboardLogos into tournaments.settings.
- Cloud pull initializes the legacy scoreboardLogos setting as four empty slots; the UI loads permanent logo records from scoreboard_logos.
- Prevents queued/general tournament saves from overwriting logo URLs with stale values.
- Upload now updates scoreboard_logos before deleting the previous Storage object, preventing a successful upload from losing the old/new reference if cleanup fails.
- Removing a logo no longer schedules a general tournament save that could restore a stale URL.
- Existing Match Flow, TV layout, scoring, brackets, Anyo, and other tournament data logic were not changed.
- Live tournament legacy scoreboardLogos setting was normalized to four empty slots; the permanent scoreboard_logos record remains authoritative.

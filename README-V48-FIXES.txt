RADIUM V48 targeted upgrades

ANYO SCOREBOARD
- Kept the existing scoreboard layout.
- Existing performer-name box now displays the performer name.
- Added NEXT PERFORMER authorization for ADMIN, TOURNAMENT_MANAGER, and TABLE_OFFICIAL accounts.
- Next performer follows the saved Supabase draw_order.
- Added FULL SCREEN button.
- Added text fitting/overflow protection without redesigning the scoreboard.
- Tournament title remains centered with uploaded logos and long titles.

BRACKETS
- Added pre-generation player review showing registered players, team/school, weight, weigh-in status, and saved seed.
- Review counts are read directly from Supabase category_registrations, weigh_ins, and category_players.
- Bracket generation still uses the existing verified-player loader and saved Draw Lots seeds.
- Existing gameplay/advancement logic was not redesigned.

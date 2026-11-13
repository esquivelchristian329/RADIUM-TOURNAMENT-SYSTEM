RADIUM V106 — ANYO INDIVIDUAL DRAW LOTS ROSTER FIX

Problem:
Individual Anyo registrations can be stored with category_registrations.player_id = NULL
and category_registrations.anyo_entry_id populated. Athlete IDs are stored in
anyo_entry_members. The previous Draw Lots competitor builder only read direct
player_id registrations (or the legacy player.events.anyoIndividual flag), so valid
entry-linked Individual registrations could be omitted.

Fix:
- Expands active Individual Anyo category registrations through anyo_entry_id.
- Resolves linked athlete IDs from the hydrated anyo_entry_members list.
- Includes registered athletes individually in Draw Lots.
- Uses linked entry style/weapon for category matching without requiring the legacy
  player.events Anyo cache for explicitly registered athletes.
- Retains age, sex, active registration, category, and linked entry style/weapon checks.
- Leaves Synchronized Anyo and Combative Draw Lots logic unchanged.
- Adds a script cache-buster so browsers load the corrected Draw Lots code.

No Supabase data or schema was modified.

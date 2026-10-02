RADIUM V70 — ANYO REGISTRATION + DRAW LOTS FULL FIX

BASELINE:
- V70 Anyo Division and Bracket Review Fix
- V70 Player Review Fix

THIS BUILD INCLUDES:
1. V70 Player Review fix for Combative category preview.
2. Anyo cloud roster hydration from Supabase.
3. Individual Anyo category registrations linked by player_id are used as the authoritative roster.
4. Missing Individual Anyo entries can be represented locally for Draw Lots when a valid player-linked registration exists.
5. Synchronized Anyo entries and members are loaded directly from anyo_entries / anyo_entry_members.
6. Elementary/Secondary Anyo age checks: Elementary 1–12; Secondary 13–17.
7. Anyo synchronization no longer wipes the entire player_anyo_events cache when Anyo flags are temporarily absent.
8. Existing Anyo registrations are not deleted by this build.
9. No database schema changes are included.

COMBATIVE SAFETY:
- Combative bracket, weigh-in, Draw Lots roster logic, match flow, and scoring are not intentionally changed by the Anyo-specific additions.
- The Player Review fix remains limited to the existing Combative Player Review path.
- The Anyo cloud hydration code only runs when the selected category is an Anyo category.

IMPORTANT CURRENT-DATABASE LIMITATION:
Some existing Individual Anyo category_registrations in the current tournament have player_id=NULL and anyo_entry_id=NULL. The application does NOT guess which athlete those orphan rows belong to. They must be corrected/re-imported from the original registration source so a player can be safely identified.

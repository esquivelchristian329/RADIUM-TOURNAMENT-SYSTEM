RADIUM V57 — ANYO TITLE + CATEGORY RESULTS FIX

Fixes in this build:
1. ANYO scoreboard tournament title
   - Uses the current tournament name from Supabase.
   - Long names wrap to a maximum of two centered lines.
   - Responsive sizing prevents clipping/overlap with logos and Event/category area.
   - Preserves fullscreen/mobile/desktop behavior.

2. Category Results
   - Results page is organized by category.
   - Event filter: ALL / COMBATIVE / ANYO.
   - Category selector filters to one category.
   - ANYO results show performer/entry, team, five judge scores, judge average, deduction, final score and time.
   - COMBATIVE results show Blue, Red, score, winner, decision, round, match and official.
   - PRINT SELECTED CATEGORY creates an official printable category sheet.
   - PRINT ALL CATEGORIES creates separate printable pages for every category in the selected event filter.
   - Existing database separation between Anyo performances and Combative match results is preserved.

No database schema changes were made by this fix.

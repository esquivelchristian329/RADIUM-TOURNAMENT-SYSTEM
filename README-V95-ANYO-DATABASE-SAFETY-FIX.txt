RADIUM V95 — ANYO DATABASE SAFETY / ORPHAN REGISTRATION DIAGNOSTICS

BASE:
- RADIUM-TOURNAMENT-SYSTEM-V94-ROUND-GATE-CATEGORY-ORDER-FINALS-LAST.zip only.
- No GitHub repository files were used as a code source.

CHANGES:
1. Anyo performer page now reads category_registrations and displays a warning when active Anyo registrations have neither player_id nor anyo_entry_id, or reference a missing Anyo entry.
2. Anyo Draw Lots now shows a category-specific warning for registrations that cannot be tied to an identified athlete/entry. It does not guess athlete identities or create fake competitors.
3. Cloud sync now preserves existing cloud Anyo entries and member rows if a browser sync has zero Anyo entry rows to write, instead of clearing existing cloud rows because local state is empty/stale.
4. Combative match flow and scoring code were not intentionally changed.

LIVE DATABASE CHECK (tournament 6db64227-4beb-4f14-98a4-60f4c9ac8071):
- players: 55
- Anyo category_registrations: 34
- anyo_entries: 0
- anyo_entry_members: 0
- player_anyo_events: 0
- anyo_performances: 0
- CSV export: 47 category rows, including empty categories; 34 rows have registration IDs, but all 34 have blank player_id and anyo_entry_id and no athlete identity fields.

IMPORTANT:
- No live database records were modified by this package.
- The existing 34 unlinked registration rows cannot be safely assigned to athletes from the export alone. The original entry/registration source is required to restore the athlete-to-category links. Do not infer identities from school counts or category totals.

VALIDATION:
- JavaScript syntax checks run for js/bracket.js, js/cloud-sync.js, and js/draw-lots.js.
- ZIP integrity checked after packaging.
- No browser/runtime test or Vercel deployment has been performed.

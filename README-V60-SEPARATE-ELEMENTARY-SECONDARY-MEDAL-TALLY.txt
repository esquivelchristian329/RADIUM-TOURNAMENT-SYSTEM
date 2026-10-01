RADIUM V60 — SEPARATE ELEMENTARY AND SECONDARY MEDAL TALLY

CHANGE
- Reports & Medal Tally now displays separate Elementary and Secondary tables.
- Each table ranks teams/schools using medals and the tournament's configured medal points.
- Only teams with at least one medal in that division are listed.
- Medal division is determined from the category name/preset first, then the category age range, then the medal recipient's age when available.
- A note warns when any medal records cannot confidently be assigned to Elementary or Secondary.
- Updated bracket.js cache version to v60.

FILES CHANGED
- index.html
- js/bracket.js

NOTES
- No database schema changes are required for this UI/reporting update.
- This change groups existing records in data.medals; it does not create new medals or alter existing medal records.
- Categories with ambiguous names and broad age ranges may need their names/presets or age ranges corrected for reliable classification.

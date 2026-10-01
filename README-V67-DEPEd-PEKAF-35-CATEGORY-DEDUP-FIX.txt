RADIUM V67 — DepEd–PEKAF 35-Category Preset Deduplication

Base: RADIUM V66 Entry Import Category Match Fix.

Changes in this ZIP:
- Makes the DepEd–PEKAF Secondary Combative preset idempotent across existing preset IDs, canonical category names, and matching weight classes.
- Consolidates duplicate preset categories in the current browser state only when the duplicate being removed has no linked registration/result/seed/bracket data. If such data exists, the system stops and warns instead of risking data loss.
- Remaps Anyo results and the active category when consolidating duplicate Anyo preset categories.
- Waits for the cloud save to complete and verifies the expected preset count in Supabase before showing a success message.
- Adds a database-backed unique-index safeguard for DepEd–PEKAF Anyo and Combative preset identities. The live database migration also repaired CAPRISA ARNIS TOURNAMENT to 35 categories.

Expected categories:
- Elementary Anyo: 13
- Secondary Anyo: 12
- Secondary Combative: 10
- Total: 35

The live Supabase repair was applied separately and verified for tournament ID 877ce9a6-e788-4151-b6d5-75c07284bbc1. This ZIP does not contain credentials or a database dump.

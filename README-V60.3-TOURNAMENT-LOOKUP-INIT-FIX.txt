RADIUM V60.3 — TOURNAMENT LOOKUP / DATABASE INITIALIZATION FIX

Based on RADIUM V60.2 — Entry Form Import Save Fix.

Changes:
- Reuses one Supabase client instead of creating a new client on every RADIUM_DB.init() call.
- Deduplicates concurrent initialization calls with a shared initialization promise.
- Handles initialization failures consistently in RADIUM_CLOUD and records the underlying error.
- Validates the tournament lookup response before filtering it, preventing invalid payloads from causing follow-on lookup exceptions.
- Separates database health-check messages from cloud tournament lookup errors so the health probe does not overwrite cloud status/error details. The database-connected pill is owned by the health check; cloud sync updates only the tournament-table status.
- Does not change the Supabase schema or modify/delete any live database records.

Validation:
- JavaScript syntax checks passed for supabase-db.js and cloud-sync.js.
- ZIP integrity check passed after packaging.
- Static checks confirm init reuses the existing client, shares concurrent initialization, validates tournament lookup data, and uses separate health/cloud error elements.

Note: A live browser retest is still required in the user's local RADIUM runtime to confirm the original error is resolved in that environment.

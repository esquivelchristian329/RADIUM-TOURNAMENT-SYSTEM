RADIUM V60.2 — ENTRY FORM IMPORT SAVE FIX

Based on RADIUM-V60-DEPEd-PEKAF-ENTRY-FORM-IMPORT-FIXED.zip.

Fixes:
- Converts Excel serial birthdates into ISO YYYY-MM-DD before saving to Supabase. This fixes the observed PostgreSQL error: invalid input syntax for type date: "40017".
- Generates UUIDs for imported players, teams, and generated Anyo groups so retries do not keep rematerializing temporary IDs as duplicate rows.
- Stores explicit selected Combative category registrations and preserves the selected class when declared weight is outside the class range. Verified weigh-in remains the eligibility check.
- Shows the actual cloud-save error in the import notice rather than only a generic confirmation message.
- Does not change Supabase schema or delete existing database rows.

Validation performed: JavaScript syntax checks for entry-forms.js and cloud-sync.js; Excel serial 40017 date conversion check; ZIP integrity check.

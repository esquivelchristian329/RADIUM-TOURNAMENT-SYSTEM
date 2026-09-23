RADIUM V47 fixes:
1. Fixes Draw Lots 'tid is not defined' runtime error by resolving active tournament ID inside saveDraw before category draw-mode persistence.
2. Keeps direct Supabase Draw Lots persistence and verification intact.
3. Makes ANYO performer directory loading resilient to Supabase initialization/race timing with automatic retries.
4. Refreshes ANYO performer directory directly from authoritative Supabase data and preserves existing category/performer behavior.

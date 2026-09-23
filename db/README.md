# RADIUM database configuration

RADIUM uses Supabase as the authoritative source for tournament data.

## Runtime

The web application only needs `db/supabase-config.js` at runtime. It contains the Supabase project URL and browser publishable/anon key. Never put a Supabase `service_role` key in this repository.

## Existing production database

This repository is configured for the existing RADIUM Supabase project. The production database schema, RLS policies, RPC functions, indexes, and security hardening are managed in Supabase SQL Editor/migrations and are **not required by the browser application at runtime**.

If recreating the database from scratch, use the SQL migrations from the project's database history rather than executing historical RADIUM SQL files in arbitrary order.

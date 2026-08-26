-- Enable Row-Level Security on all tables.
--
-- The app accesses Supabase exclusively via server-side API routes using the
-- SERVICE_ROLE key, which bypasses RLS entirely. Enabling RLS therefore:
--   1. Does NOT affect the app's API routes (service role is unaffected).
--   2. Blocks any direct access via the anon / authenticated key, which
--      closes the "table publicly accessible" security alert.
--
-- No permissive policies are added intentionally — all legitimate access
-- goes through the API layer, not through direct Supabase client calls.

ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

-- Revoke default public/anon privileges (belt-and-suspenders).
REVOKE ALL ON events       FROM anon, authenticated;
REVOKE ALL ON participants FROM anon, authenticated;
REVOKE ALL ON availability FROM anon, authenticated;

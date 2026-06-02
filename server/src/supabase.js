import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy server/.env.example to server/.env and fill in your Supabase project credentials.'
  );
}

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'cvs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function unwrap({ data, error }) {
  if (error) {
    const e = new Error(error.message || 'Supabase error');
    e.status = error.code === 'PGRST116' ? 404 : 500;
    e.cause = error;
    throw e;
  }
  return data;
}

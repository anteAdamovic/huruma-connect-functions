// supabaseClient.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
/**
 * Creates a Supabase client with the service role key
 * Use this for admin operations that bypass RLS
 */ export function createSupabaseAdmin() {
  return createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
}
/**
 * Creates a Supabase client with the auth header from the request
 * Use this to respect RLS policies based on the authenticated user
 */ export function createSupabaseClient(req) {
  return createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization')
      }
    }
  });
}
// Export a pre-initialized admin client for convenience
export const supabase = createSupabaseAdmin();

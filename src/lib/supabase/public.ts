import { createClient } from "@supabase/supabase-js";

/** Anonymous client with no cookies: keeps public pages cacheable (ISR). Only sees what RLS allows the public. */
export function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

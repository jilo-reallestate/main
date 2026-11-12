import "server-only";
import { createClient } from "@supabase/supabase-js";

export const hasServiceKey = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;
/** Server-only client with full database power. Used ONLY for inviting users. Never import this in a client component. */
export function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { IS_DEMO } from "@/lib/data";

export type Role = "admin" | "agent" | "client";
export type SessionProfile = { id: string; role: Role; full_name: string | null; email: string | null };

export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (IS_DEMO) return null; // demo mode: no database, so nobody is signed in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, role, full_name, email").eq("id", user.id).single();
  return (data as SessionProfile | null) ?? null;
}

/** Server-side gate. The UI hiding links is NOT security; this and RLS are. */
export async function requireRole(locale: string, roles: Role[]): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect({ href: "/login", locale });
  if (!roles.includes(profile!.role)) redirect({ href: "/dashboard", locale });
  return profile!;
}

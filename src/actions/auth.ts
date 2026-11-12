"use server";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/seo";
import { IS_DEMO } from "@/lib/data";

export type AuthState = { error?: string; notice?: string } | null;

export async function login(_prev: AuthState, fd: FormData): Promise<AuthState> {
  if (IS_DEMO) return { error: "demo" };
  const locale = String(fd.get("locale") ?? "en");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? "").trim(),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { error: "invalid" };
  redirect({ href: "/dashboard", locale });
  return null;
}

export async function signup(_prev: AuthState, fd: FormData): Promise<AuthState> {
  if (IS_DEMO) return { error: "demo" };
  const locale = String(fd.get("locale") ?? "en");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "weak" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(fd.get("email") ?? "").trim(),
    password,
    options: {
      data: { full_name: String(fd.get("full_name") ?? "").trim(), locale },
      emailRedirectTo: `${SITE_URL}/auth/callback?locale=${locale}`,
    },
  });
  if (error) return { error: "failed" };
  return { notice: "check_email" };
}

export async function logout(fd: FormData) {
  if (IS_DEMO) return;
  const locale = String(fd.get("locale") ?? "en");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale });
}

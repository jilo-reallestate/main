import type { SupabaseClient } from "@supabase/supabase-js";

type R = { error?: string };
const fail = (e: { message: string } | null): R => (e ? { error: e.message } : {});
export const ALLOWED_FILTERS = ["purpose", "offplan", "type", "area", "beds", "maxPrice"] as const;
const FREQ = ["instant", "daily", "weekly"];

/** Keeps only known filter keys, so nothing unexpected is stored (and the alert engine only sees safe values). */
export function cleanFilters(f: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ALLOWED_FILTERS) { const v = f[k]; if (v !== undefined && v !== null && String(v) !== "") out[k] = String(v).slice(0, 40); }
  return out;
}
export async function saveSearch(sb: SupabaseClient, uid: string, name: string, filters: Record<string, unknown>, frequency = "daily"): Promise<R> {
  const clean = cleanFilters(filters);
  if (!Object.keys(clean).length) return { error: "Choose at least one filter first" };
  const { count } = await sb.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", uid);
  if ((count ?? 0) >= 20) return { error: "limit" };
  const { error } = await sb.from("saved_searches").insert({ user_id: uid, name: name.trim().slice(0, 80) || "My search", filters: clean, frequency: FREQ.includes(frequency) ? frequency : "daily", alerts_enabled: true });
  return fail(error);
}
export async function updateSearch(sb: SupabaseClient, id: string, patch: { alerts_enabled?: boolean; frequency?: string }): Promise<R> {
  const p: Record<string, unknown> = {};
  if (patch.alerts_enabled !== undefined) p.alerts_enabled = patch.alerts_enabled;
  if (patch.frequency && FREQ.includes(patch.frequency)) p.frequency = patch.frequency;
  const { error } = await sb.from("saved_searches").update(p).eq("id", id); return fail(error);
}
export async function deleteSearch(sb: SupabaseClient, id: string): Promise<R> { const { error } = await sb.from("saved_searches").delete().eq("id", id); return fail(error); }

export async function cancelViewing(sb: SupabaseClient, id: string): Promise<R> {
  const { data, error } = await sb.from("viewings").update({ status: "cancelled" }).eq("id", id).select("id");
  return error ? fail(error) : data?.length ? {} : { error: "This viewing can no longer be cancelled" };
}
export async function sendMessage(sb: SupabaseClient, uid: string, leadId: string, body: string): Promise<R & { id?: string }> {
  const b = body.trim(); if (!b) return { error: "Write a message first" }; if (b.length > 4000) return { error: "Message is too long" };
  const { data, error } = await sb.from("lead_messages").insert({ lead_id: leadId, sender_id: uid, body: b }).select("id").single();
  return error ? fail(error) : { id: data.id };
}
export async function markThreadRead(sb: SupabaseClient, uid: string, leadId: string): Promise<R> {
  const { error } = await sb.from("lead_messages").update({ read_at: new Date().toISOString() }).eq("lead_id", leadId).neq("sender_id", uid).is("read_at", null); return fail(error);
}
export const DOC_KINDS = ["passport", "emirates_id", "visa", "proof_of_funds", "salary_certificate", "other"] as const;
export const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"], DOC_MAX = 10 * 1024 * 1024;
export const safeName = (n: string) => n.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\.{2,}/g, ".").replace(/^\.+/, "").replace(/\s+/g, "-").slice(-80) || "file";
export async function markNotificationsRead(sb: SupabaseClient, uid: string): Promise<R> {
  const { error } = await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", uid).is("read_at", null); return fail(error);
}
export async function updateProfile(sb: SupabaseClient, uid: string, p: { full_name: string; phone: string; preferred_locale: string; preferred_currency: string }): Promise<R> {
  if (!["en", "ar"].includes(p.preferred_locale) || !["AED", "USD", "GBP"].includes(p.preferred_currency)) return { error: "Invalid choice" };
  const { error } = await sb.from("profiles").update({ full_name: p.full_name.trim().slice(0, 120), phone: p.phone.trim() || null, preferred_locale: p.preferred_locale, preferred_currency: p.preferred_currency }).eq("id", uid);
  return fail(error);
}

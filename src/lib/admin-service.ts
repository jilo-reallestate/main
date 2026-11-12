import type { SupabaseClient } from "@supabase/supabase-js";

type R = { error?: string };
const fail = (e: { message: string } | null): R => (e ? { error: e.message } : {});

export type StaffInput = Record<string, string | string[] | undefined>;
/** Creates/edits a team member. Runs as the logged-in admin; the database refuses anyone else and protects against admin lock-out. */
export async function setStaff(sb: SupabaseClient, p: Record<string, unknown>): Promise<R & { id?: string; moved?: number }> {
  const { data, error } = await sb.rpc("admin_set_staff", { p });
  return error ? fail(error) : { id: data.id, moved: data.leads_reassigned };
}
export function staffPayloadFromForm(get: (k: string) => string): Record<string, unknown> {
  const langs = get("languages").split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return {
    id: get("id") || undefined, role: get("role") || undefined, is_active: get("is_active") === "" ? undefined : get("is_active") === "on" || get("is_active") === "true" ? "true" : "false",
    full_name: get("full_name"), phone: get("phone"), display_name_en: get("display_name_en"), display_name_ar: get("display_name_ar"), title_en: get("title_en"), title_ar: get("title_ar"),
    license_number: get("license_number"), public_phone: get("public_phone"), whatsapp: get("whatsapp"), languages: langs, commission_rate: get("commission_rate"), monthly_target_aed: get("monthly_target_aed"),
    accepts_leads: get("accepts_leads") === "on" ? "true" : "false", is_public: get("is_public") === "on" ? "true" : "false", reassign_to: get("reassign_to") || undefined,
  };
}
export async function setCommissionStatus(sb: SupabaseClient, id: string, status: string): Promise<R> {
  const { error } = await sb.rpc("set_commission_status", { p_id: id, p_status: status });
  return fail(error);
}
const SETTING_KEYS = ["lead_sla_minutes", "reservation_hours", "listing_expiry_days"] as const;
export async function saveSettings(sb: SupabaseClient, uid: string, f: { lead_sla_minutes: string; reservation_hours: string; listing_expiry_days: string; require_permit: boolean; company: Record<string, string> }): Promise<R> {
  const rows: { key: string; value: unknown; is_public: boolean; updated_by: string }[] = [];
  for (const k of SETTING_KEYS) { const n = Number(f[k]); if (!Number.isInteger(n) || n < 1 || n > 10000) return { error: `${k}: enter a whole number between 1 and 10000` }; rows.push({ key: k, value: n, is_public: false, updated_by: uid }); }
  rows.push({ key: "require_permit_number", value: f.require_permit, is_public: false, updated_by: uid });
  rows.push({ key: "company", value: f.company, is_public: true, updated_by: uid });
  const { error } = await sb.from("site_settings").upsert(rows, { onConflict: "key" });
  return fail(error);
}

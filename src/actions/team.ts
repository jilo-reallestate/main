"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasServiceKey, serviceClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";
import { SITE_URL } from "@/lib/seo";
import { saveSettings, setCommissionStatus, setStaff, staffPayloadFromForm } from "@/lib/admin-service";

export type AdmState = { ok?: boolean; error?: string; notice?: string } | null;
async function adminCtx() { const me = await getSessionProfile(); return me?.role === "admin" ? { me, sb: await createClient() } : null; }
const val = (fd: FormData) => (k: string) => String(fd.get(k) ?? "").trim();

export async function inviteStaffAction(_p: AdmState, fd: FormData): Promise<AdmState> {
  const c = await adminCtx(); if (!c) return { error: "forbidden" };
  const g = val(fd), email = g("email").toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email" };
  if (!hasServiceKey()) return { error: "nokey" };
  const { data, error } = await serviceClient().auth.admin.inviteUserByEmail(email, { data: { full_name: g("full_name"), locale: g("locale") || "en" }, redirectTo: `${SITE_URL}/auth/callback?locale=${g("locale") || "en"}` });
  // already registered: fall back to promoting that account by email
  const r = await setStaff(c.sb, error && /already|registered|exists/i.test(error.message) ? { email, role: g("role") || "agent", full_name: g("full_name") } : data?.user ? { id: data.user.id, role: g("role") || "agent", full_name: g("full_name") } : { email });
  if (error && !/already|registered|exists/i.test(error.message)) return { error: error.message };
  revalidatePath("/", "layout"); return r.error ? { error: r.error } : { ok: true, notice: "invited" };
}
export async function promoteStaffAction(_p: AdmState, fd: FormData): Promise<AdmState> {
  const c = await adminCtx(); if (!c) return { error: "forbidden" };
  const g = val(fd), r = await setStaff(c.sb, { email: g("email"), role: g("role") || "agent" });
  revalidatePath("/", "layout"); return r.error ? { error: r.error } : { ok: true };
}
export async function saveStaffAction(_p: AdmState, fd: FormData): Promise<AdmState> {
  const c = await adminCtx(); if (!c) return { error: "forbidden" };
  const r = await setStaff(c.sb, staffPayloadFromForm(val(fd)));
  revalidatePath("/", "layout"); return r.error ? { error: r.error } : { ok: true, notice: r.moved ? String(r.moved) : undefined };
}
export async function commissionStatusAction(fd: FormData) {
  const c = await adminCtx(); if (!c) return;
  await setCommissionStatus(c.sb, String(fd.get("id")), String(fd.get("status"))); revalidatePath("/", "layout");
}
export async function saveSettingsAction(_p: AdmState, fd: FormData): Promise<AdmState> {
  const c = await adminCtx(); if (!c) return { error: "forbidden" };
  const g = val(fd);
  const r = await saveSettings(c.sb, c.me.id, { lead_sla_minutes: g("lead_sla_minutes"), reservation_hours: g("reservation_hours"), listing_expiry_days: g("listing_expiry_days"), require_permit: g("require_permit_number") === "on",
    company: { name: g("company_name"), phone: g("company_phone"), email: g("company_email"), whatsapp: g("company_whatsapp") } });
  revalidatePath("/", "layout"); return r.error ? { error: r.error } : { ok: true };
}

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import * as O from "@/lib/offplan-service";

export type OpState = { error?: string; ok?: boolean; msg?: string } | null;
async function ctx(adminOnly: boolean) {
  const me = await getSessionProfile();
  if (!me || me.role === "client" || (adminOnly && me.role !== "admin")) return null;
  return { me, sb: await createClient() };
}
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string) => (s(fd, k) === "" ? "" : s(fd, k));
const refresh = () => revalidatePath("/", "layout");
const done = (r: { error?: string }, msg?: string): OpState => { refresh(); return r.error ? { error: r.error } : { ok: true, msg }; };

/* ---------- agent + admin ---------- */
export async function reserveAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(false); if (!c) return { error: "forbidden" };
  return done(await O.reserveUnit(c.sb, s(fd, "unit_id"), s(fd, "lead_id"), s(fd, "notes")));
}
export async function cancelReservationAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(false); if (!c) return { error: "forbidden" };
  return done(await O.cancelReservation(c.sb, s(fd, "id")));
}
export async function extendReservationAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(false); if (!c) return { error: "forbidden" };
  return done(await O.extendReservation(c.sb, s(fd, "id"), Number(s(fd, "hours"))));
}
export async function convertReservationAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(false); if (!c) return { error: "forbidden" };
  const price = s(fd, "price");
  const r = await O.convertReservation(c.sb, s(fd, "id"), { planId: s(fd, "plan_id") || undefined, price: price ? Number(price) : undefined, start: s(fd, "start") || undefined });
  return done(r, r.installments ? String(r.installments) : undefined);
}

/* ---------- admin ---------- */
export async function saveProjectAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  const tr = (l: string) => ({ name: s(fd, `name_${l}`), slug: s(fd, `slug_${l}`), tagline: s(fd, `tagline_${l}`), description: s(fd, `desc_${l}`), meta_title: s(fd, `mt_${l}`), meta_description: s(fd, `md_${l}`) });
  const r = await O.saveProject(c.sb, {
    id: s(fd, "id"), developer_id: s(fd, "developer_id"), area_code: s(fd, "area_code"), status: s(fd, "status"), launch_date: s(fd, "launch_date"), handover_date: s(fd, "handover_date"),
    completion_pct: s(fd, "completion_pct"), lat: n(fd, "lat"), lng: n(fd, "lng"), brochure_url: s(fd, "brochure_url"), permit_number: s(fd, "permit_number"),
    is_published: fd.get("is_published") === "on", is_featured: fd.get("is_featured") === "on", tr: { en: tr("en"), ar: tr("ar") },
  });
  refresh();
  if (r.error) return { error: r.error };
  if (!s(fd, "id")) redirect({ href: `/admin/projects/${r.id}`, locale: s(fd, "locale") || "en" });
  return { ok: true };
}
export async function addUpdateAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  return done(await O.addProjectUpdate(c.sb, { project_id: s(fd, "project_id"), update_date: s(fd, "update_date"), title_en: s(fd, "title_en"), title_ar: s(fd, "title_ar"), body_en: s(fd, "body_en"), body_ar: s(fd, "body_ar"), completion_pct: s(fd, "completion_pct") }));
}
export async function deleteUpdateAction(fd: FormData) { const c = await ctx(true); if (!c) return; await O.deleteProjectUpdate(c.sb, s(fd, "id")); refresh(); }
export async function saveDeveloperAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  return done(await O.saveDeveloper(c.sb, { id: s(fd, "id") || undefined, name_en: s(fd, "name_en"), name_ar: s(fd, "name_ar"), slug_en: s(fd, "slug_en"), slug_ar: s(fd, "slug_ar"), website: s(fd, "website"), logo_url: s(fd, "logo_url"), description_en: s(fd, "description_en"), description_ar: s(fd, "description_ar"), is_active: fd.get("is_active") === "on" }));
}
export async function addUnitAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  const row = { unit_number: s(fd, "unit_number"), unit_type: s(fd, "unit_type"), bedrooms: s(fd, "bedrooms"), size_sqft: s(fd, "size_sqft"), price: s(fd, "price"), status: s(fd, "status") };
  const r = await O.importUnits(c.sb, s(fd, "project_id"), [row], true);
  if (r.error) return { error: r.error };
  const bad = r.result?.rows[0]?.errors?.[0]; if (bad) return { error: `code:${bad}` };
  if (s(fd, "plan_id")) { const u = await c.sb.from("units").select("id").eq("project_id", s(fd, "project_id")).eq("unit_number", row.unit_number).maybeSingle(); if (u.data) await O.assignPaymentPlan(c.sb, s(fd, "plan_id"), [u.data.id as string]); }
  return done({});
}
/** Called from the CSV importer: commit=false is the validation preview, commit=true imports only if every row is valid. */
export async function importUnitsAction(projectId: string, rows: Record<string, string>[], commit: boolean): Promise<O.R & { result?: O.ImportResult }> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  const r = await O.importUnits(c.sb, projectId, rows, commit); if (commit) refresh(); return r;
}
export async function assignPlanAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  const r = await O.assignPaymentPlan(c.sb, s(fd, "plan_id") || null, fd.getAll("unit").map(String));
  return done(r, r.n !== undefined ? String(r.n) : undefined);
}
export async function savePlanAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  let payload: Record<string, unknown>; try { payload = JSON.parse(s(fd, "payload")); } catch { return { error: "Invalid form" }; }
  const r = await O.savePaymentPlan(c.sb, payload); refresh();
  if (r.error) return { error: r.error };
  if (!payload.id) redirect({ href: `/admin/payment-plans/${r.id}`, locale: s(fd, "locale") || "en" });
  return { ok: true };
}
export async function recordPaymentAction(_p: OpState, fd: FormData): Promise<OpState> {
  const c = await ctx(true); if (!c) return { error: "forbidden" };
  return done(await O.recordInstallmentPayment(c.sb, { installment_id: s(fd, "installment_id"), amount: s(fd, "amount"), method: s(fd, "method"), reference: s(fd, "reference"), paid_at: s(fd, "paid_at"), notes: s(fd, "notes") }));
}

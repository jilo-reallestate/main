import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";

/** Off-plan operations. They take a Supabase client acting as the logged-in person, so Row Level Security decides what is allowed.
 *  Anything that changes several rows together is a database function (supabase/07_offplan.sql), so it succeeds or fails as a whole. */
export type R = { error?: string };
const fail = (e: { message: string } | null): R => (e ? { error: e.message } : {});

export async function reserveUnit(sb: SupabaseClient, unitId: string, leadId: string, notes?: string): Promise<R & { expiresAt?: string }> {
  const { data, error } = await sb.rpc("reserve_unit", { p_unit: unitId, p_lead: leadId, p_notes: notes || null });
  return error ? fail(error) : { expiresAt: data.expires_at };
}
export async function cancelReservation(sb: SupabaseClient, id: string): Promise<R> { return fail((await sb.rpc("cancel_reservation", { p_id: id })).error); }
export async function extendReservation(sb: SupabaseClient, id: string, hours: number): Promise<R> { return fail((await sb.rpc("extend_reservation", { p_id: id, p_hours: hours })).error); }
export async function convertReservation(sb: SupabaseClient, id: string, o: { planId?: string; price?: number; start?: string }): Promise<R & { dealId?: string; installments?: number }> {
  const { data, error } = await sb.rpc("convert_reservation", { p_id: id, p_plan: o.planId || null, p_price: o.price ?? null, p_start: o.start || new Date().toISOString().slice(0, 10) });
  return error ? fail(error) : { dealId: data.deal_id, installments: data.installments };
}

export async function saveProject(sb: SupabaseClient, p: Record<string, unknown>): Promise<R & { id?: string }> {
  const { data, error } = await sb.rpc("save_project", { p });
  return error ? fail(error) : { id: data.id };
}
export async function addProjectUpdate(sb: SupabaseClient, p: Record<string, unknown>): Promise<R> { return fail((await sb.rpc("add_project_update", { p })).error); }
export async function deleteProjectUpdate(sb: SupabaseClient, id: string): Promise<R> { return fail((await sb.from("project_updates").delete().eq("id", id)).error); }

export type ImportResult = { valid: number; invalid: number; inserted: number; rows: { line: number; unit_number: string; unit_type: string | null; bedrooms: string | null; size_sqft: string | null; price: string | null; status: string; errors: string[] }[] };
export async function importUnits(sb: SupabaseClient, projectId: string, rows: Record<string, string>[], commit: boolean): Promise<R & { result?: ImportResult }> {
  const { data, error } = await sb.rpc("import_units", { p_project: projectId, p_rows: rows, p_commit: commit });
  return error ? fail(error) : { result: data as ImportResult };
}

export async function savePaymentPlan(sb: SupabaseClient, p: Record<string, unknown>): Promise<R & { id?: string }> {
  const { data, error } = await sb.rpc("save_payment_plan", { p });
  return error ? fail(error) : { id: data as string };
}
export async function assignPaymentPlan(sb: SupabaseClient, planId: string | null, unitIds: string[]): Promise<R & { n?: number }> {
  if (!unitIds.length) return { error: "No units selected" };
  const { data, error } = await sb.rpc("assign_payment_plan", { p_plan: planId, p_unit_ids: unitIds });
  return error ? fail(error) : { n: data as number };
}
export async function recordInstallmentPayment(sb: SupabaseClient, p: Record<string, unknown>): Promise<R> { return fail((await sb.rpc("record_installment_payment", { p })).error); }

export async function saveDeveloper(sb: SupabaseClient, d: { id?: string; name_en: string; name_ar?: string; slug_en?: string; slug_ar?: string; website?: string; logo_url?: string; description_en?: string; description_ar?: string; is_active: boolean }): Promise<R> {
  if (!d.name_en.trim()) return { error: "Name is required" };
  const row = {
    name_en: d.name_en.trim(), name_ar: d.name_ar?.trim() || null, slug_en: (d.slug_en?.trim() || slugify(d.name_en)) || null,
    slug_ar: d.slug_ar?.trim() || (d.name_ar ? slugify(d.name_ar) : null), website: d.website?.trim() || null, logo_url: d.logo_url?.trim() || null,
    description_en: d.description_en?.trim() || null, description_ar: d.description_ar?.trim() || null, is_active: d.is_active,
  };
  if (!row.slug_en) return { error: "Slug is required" };
  const q = d.id ? sb.from("developers").update(row).eq("id", d.id) : sb.from("developers").insert(row);
  return fail((await q).error);
}

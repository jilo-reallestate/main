import type { SupabaseClient } from "@supabase/supabase-js";

/** CRM operations. They take a Supabase client acting as the logged-in person, so the database's Row Level Security decides what is allowed. */
type R = { error?: string };
const fail = (e: { message: string } | null): R => (e ? { error: e.message } : {});

export async function moveLead(sb: SupabaseClient, leadId: string, stageKey: string, lostReason?: string): Promise<R> {
  const { data: st } = await sb.from("pipeline_stages").select("id, is_lost").eq("key", stageKey).maybeSingle();
  if (!st) return { error: "Unknown stage" };
  const { data, error } = await sb.from("leads").update({ stage_id: st.id, lost_reason: st.is_lost ? lostReason || "other" : null }).eq("id", leadId).select("id");
  return error ? fail(error) : data?.length ? {} : { error: "Lead not found or not yours" };
}
export async function addActivity(sb: SupabaseClient, uid: string, a: { leadId: string; type: string; direction?: string; summary: string; body?: string }): Promise<R> {
  if (!a.summary.trim()) return { error: "Summary is required" };
  const outbound = ["call", "email", "whatsapp", "sms", "meeting"].includes(a.type);
  const { error } = await sb.from("activities").insert({ lead_id: a.leadId, type: a.type, direction: a.direction || (outbound ? "outbound" : null), summary: a.summary.trim(), body: a.body?.trim() || null, created_by: uid });
  return fail(error);
}
export async function addTask(sb: SupabaseClient, uid: string, t: { leadId?: string; title: string; dueAt?: string; priority?: string }): Promise<R> {
  if (!t.title.trim()) return { error: "Title is required" };
  const { error } = await sb.from("tasks").insert({ lead_id: t.leadId || null, assigned_to: uid, created_by: uid, title: t.title.trim(), priority: t.priority || "medium", due_at: t.dueAt ? new Date(`${t.dueAt}:00+04:00`).toISOString() : null });
  return fail(error);
}
export async function toggleTask(sb: SupabaseClient, id: string, done: boolean): Promise<R> {
  const { error } = await sb.from("tasks").update({ completed_at: done ? new Date().toISOString() : null }).eq("id", id);
  return fail(error);
}
export async function setViewingStatus(sb: SupabaseClient, id: string, status: string): Promise<R> {
  const { data, error } = await sb.from("viewings").update({ status }).eq("id", id).select("id");
  return error ? fail(error) : data?.length ? {} : { error: "Viewing not found or not yours" };
}
export async function reassignLead(sb: SupabaseClient, leadId: string, agentId: string): Promise<R> {
  const { data, error } = await sb.from("leads").update({ assigned_agent_id: agentId }).eq("id", leadId).select("id");
  return error ? fail(error) : data?.length ? {} : { error: "Only an admin can reassign leads" };
}
export async function createLead(sb: SupabaseClient, p: Record<string, unknown>): Promise<R & { leadId?: string }> {
  const { data, error } = await sb.rpc("create_lead", { p });
  return error ? fail(error) : { leadId: data.lead_id };
}
export async function createDeal(sb: SupabaseClient, p: Record<string, unknown>): Promise<R & { dealId?: string }> {
  const { data, error } = await sb.rpc("create_deal", { p });
  return error ? fail(error) : { dealId: data.deal_id };
}
export async function setDealStatus(sb: SupabaseClient, id: string, status: string): Promise<R> {
  const { data, error } = await sb.from("deals").update({ status }).eq("id", id).select("id");
  return error ? fail(error) : data?.length ? {} : { error: "Deal not found or not yours" };
}

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import * as C from "@/lib/crm-service";

export type CrmState = { error?: string; ok?: boolean } | null;
async function ctx() { const me = await getSessionProfile(); if (!me || me.role === "client") return null; return { me, sb: await createClient() }; }
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const refresh = () => revalidatePath("/", "layout");

export async function moveLeadAction(leadId: string, stageKey: string, lostReason?: string): Promise<CrmState> {
  const c = await ctx(); if (!c) return { error: "forbidden" };
  const r = await C.moveLead(c.sb, leadId, stageKey, lostReason); refresh(); return r.error ? { error: r.error } : { ok: true };
}
export async function moveLeadForm(fd: FormData) { await moveLeadAction(s(fd, "lead_id"), s(fd, "stage"), s(fd, "reason") || undefined); }
export async function addActivityAction(fd: FormData) {
  const c = await ctx(); if (!c) return;
  await C.addActivity(c.sb, c.me.id, { leadId: s(fd, "lead_id"), type: s(fd, "type") || "note", direction: s(fd, "direction") || undefined, summary: s(fd, "summary"), body: s(fd, "body") }); refresh();
}
export async function addTaskAction(fd: FormData) {
  const c = await ctx(); if (!c) return;
  await C.addTask(c.sb, c.me.id, { leadId: s(fd, "lead_id") || undefined, title: s(fd, "title"), dueAt: s(fd, "due_at") || undefined, priority: s(fd, "priority") }); refresh();
}
export async function toggleTaskAction(fd: FormData) { const c = await ctx(); if (!c) return; await C.toggleTask(c.sb, s(fd, "id"), s(fd, "done") === "1"); refresh(); }
export async function viewingStatusAction(fd: FormData) { const c = await ctx(); if (!c) return; await C.setViewingStatus(c.sb, s(fd, "id"), s(fd, "status")); refresh(); }
export async function reassignLeadAction(fd: FormData) { const c = await ctx(); if (!c || c.me.role !== "admin") return; await C.reassignLead(c.sb, s(fd, "lead_id"), s(fd, "agent_id")); refresh(); }
export async function dealStatusAction(fd: FormData) { const c = await ctx(); if (!c) return; await C.setDealStatus(c.sb, s(fd, "id"), s(fd, "status")); refresh(); }

export async function createLeadAction(_p: CrmState, fd: FormData): Promise<CrmState> {
  const c = await ctx(); if (!c) return { error: "forbidden" };
  const r = await C.createLead(c.sb, { full_name: s(fd, "full_name"), phone: s(fd, "phone"), email: s(fd, "email"), intent: s(fd, "intent"), source_key: s(fd, "source_key"), budget_min: s(fd, "budget_min"), budget_max: s(fd, "budget_max"), message: s(fd, "message") });
  if (r.error) return { error: r.error };
  refresh(); redirect({ href: `/agent/leads/${r.leadId}`, locale: s(fd, "locale") || "en" }); return null;
}
export async function createDealAction(_p: CrmState, fd: FormData): Promise<CrmState> {
  const c = await ctx(); if (!c) return { error: "forbidden" };
  const r = await C.createDeal(c.sb, { lead_id: s(fd, "lead_id"), type: s(fd, "type"), price: s(fd, "price"), currency: s(fd, "currency") || "AED" });
  refresh(); return r.error ? { error: r.error } : { ok: true };
}

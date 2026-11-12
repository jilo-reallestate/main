"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import * as P from "@/lib/portal-service";

export type PState = { ok?: boolean; error?: string; id?: string } | null;
async function ctx() { const me = await getSessionProfile(); return me ? { me, sb: await createClient() } : null; }
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const refresh = () => revalidatePath("/", "layout");

export async function saveSearchAction(name: string, filters: Record<string, string>): Promise<PState> {
  const c = await ctx(); if (!c) return { error: "login" };
  const r = await P.saveSearch(c.sb, c.me.id, name, filters); refresh(); return r.error ? { error: r.error } : { ok: true };
}
export async function updateSearchAction(fd: FormData) {
  const c = await ctx(); if (!c) return;
  await P.updateSearch(c.sb, s(fd, "id"), { alerts_enabled: fd.has("alerts_enabled") ? s(fd, "alerts_enabled") === "true" : undefined, frequency: s(fd, "frequency") || undefined }); refresh();
}
export async function deleteSearchAction(fd: FormData) { const c = await ctx(); if (!c) return; await P.deleteSearch(c.sb, s(fd, "id")); refresh(); }
export async function cancelViewingAction(fd: FormData) { const c = await ctx(); if (!c) return; await P.cancelViewing(c.sb, s(fd, "id")); refresh(); }
export async function sendMessageAction(leadId: string, body: string): Promise<PState> {
  const c = await ctx(); if (!c) return { error: "login" };
  const r = await P.sendMessage(c.sb, c.me.id, leadId, body); return r.error ? { error: r.error } : { ok: true, id: r.id };
}
export async function markReadAction(leadId: string) { const c = await ctx(); if (!c) return; await P.markThreadRead(c.sb, c.me.id, leadId); refresh(); }
export async function markAllNotificationsRead() { const c = await ctx(); if (!c) return; await P.markNotificationsRead(c.sb, c.me.id); refresh(); }
export async function updateProfileAction(_p: PState, fd: FormData): Promise<PState> {
  const c = await ctx(); if (!c) return { error: "login" };
  const r = await P.updateProfile(c.sb, c.me.id, { full_name: s(fd, "full_name"), phone: s(fd, "phone"), preferred_locale: s(fd, "preferred_locale"), preferred_currency: s(fd, "preferred_currency") }); refresh();
  return r.error ? { error: r.error } : { ok: true };
}

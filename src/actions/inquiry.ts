"use server";
import { publicClient } from "@/lib/supabase/public";
import { IS_DEMO } from "@/lib/data";

export type InquiryState = { ok?: boolean; error?: string } | null;

/**
 * Sends the enquiry into the CRM through the database function submit_inquiry():
 * it validates input, de-duplicates the contact, assigns an agent (listing agent or round-robin),
 * starts the response-time clock and records any viewing request.
 * TODO before launch: add Cloudflare Turnstile/hCaptcha and an IP rate limit in front of this action.
 */
export async function submitInquiry(_prev: InquiryState, fd: FormData): Promise<InquiryState> {
  if (fd.get("company")) return { ok: true }; // honeypot: bots fill hidden fields

  if (IS_DEMO) return { ok: true }; // demo mode: nothing is stored
  const viewing = String(fd.get("viewing_at") ?? "");
  const viewingIso = viewing ? new Date(`${viewing}:00+04:00`).toISOString() : null; // entered as Gulf time

  const { error } = await publicClient().rpc("submit_inquiry", {
    p_full_name: String(fd.get("full_name") ?? ""),
    p_email: String(fd.get("email") ?? "") || null,
    p_phone: String(fd.get("phone") ?? "") || null,
    p_message: String(fd.get("message") ?? "") || null,
    p_listing_id: String(fd.get("listing_id") ?? "") || null,
    p_project_id: String(fd.get("project_id") ?? "") || null,
    p_intent: String(fd.get("intent") ?? "buy"),
    p_locale: String(fd.get("locale") ?? "en"),
    p_source_key: "website",
    p_viewing_at: viewingIso,
    p_utm: {},
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

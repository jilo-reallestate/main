"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";

/** Admin only: moves a listing from pending_review to published. The database also enforces this. */
export async function approveListing(fd: FormData) {
  const profile = await getSessionProfile();
  if (profile?.role !== "admin") return;
  const supabase = await createClient();
  await supabase.from("listings").update({ status: "published" }).eq("id", String(fd.get("id")));
  revalidatePath("/", "layout");
}

/** Agent/admin: logs an outbound contact. This stops the lead's response-time clock (first_response_at). */
export async function logContact(fd: FormData) {
  const profile = await getSessionProfile();
  if (!profile || profile.role === "client") return;
  const supabase = await createClient();
  await supabase.from("activities").insert({
    lead_id: String(fd.get("lead_id")),
    type: "call",
    direction: "outbound",
    summary: "Contacted the lead",
    created_by: profile.id,
  });
  revalidatePath("/", "layout");
}

"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { buildListingPayload } from "@/lib/listing-form";

export type FormState = { ok?: boolean; error?: string; status?: string; created?: { listingId: string; propertyId: string } } | null;

/** Saves or submits a listing through the atomic database function. Permissions are enforced by the database (RLS + triggers). */
export async function saveListingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await getSessionProfile();
  if (!me || me.role === "client") return { error: "forbidden" };
  const sb = await createClient();
  const { data, error } = await sb.rpc("save_listing", { p: buildListingPayload((k) => String(fd.get(k) ?? ""), (k) => fd.getAll(k).map(String)) });
  if (error) return { error: error.message };
  revalidatePath("/", "layout"); // public pages refresh immediately
  // A new listing returns its ids: the form uploads the chosen photos, then opens the listing.
  return { ok: true, status: data.status, created: fd.get("listing_id") ? undefined : { listingId: data.listing_id, propertyId: data.property_id } };
}

export async function archiveListing(fd: FormData) {
  const me = await getSessionProfile();
  if (!me || me.role === "client") return;
  const sb = await createClient();
  await sb.from("listings").update({ status: "archived" }).eq("id", String(fd.get("id")));
  revalidatePath("/", "layout");
}

/** Called after photo changes so the public property page updates right away. */
export async function refreshSite() { revalidatePath("/", "layout"); }

/** Admin adds a new amenity (shared by all listings). Returns the amenity so the form can show it ticked at once. */
export async function addAmenityAction(nameEn: string, nameAr: string): Promise<{ error?: string; amenity?: { code: string; name_en: string; name_ar: string } }> {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin") return { error: "forbidden" };
  const { data, error } = await (await createClient()).rpc("add_amenity", { p_name_en: nameEn, p_name_ar: nameAr || null });
  return error ? { error: error.message } : { amenity: data };
}

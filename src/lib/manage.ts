import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreas } from "@/lib/data";
import type { Initial } from "@/components/ListingForm";
import type { Photo } from "@/components/PhotoManager";

export async function loadFormRefs(sb: SupabaseClient, locale: string, isAdmin: boolean) {
  const [areas, { data: am }, ag] = await Promise.all([
    getAreas(locale),
    sb.from("amenities").select("code, name_en, name_ar, category").order("sort_order"),
    isAdmin ? sb.from("agent_profiles").select("id, display_name_en").order("display_name_en") : Promise.resolve({ data: null }),
  ]);
  return {
    areas: areas.map((a) => ({ code: a.code, name: a.name })),
    amenities: (am ?? []).map((a) => ({ code: a.code as string, name: (locale === "ar" ? a.name_ar : a.name_en) as string, cat: a.category as string })),
    agents: ag.data ? (ag.data as { id: string; display_name_en: string }[]).map((a) => ({ code: a.id, name: a.display_name_en })) : undefined,
  };
}

type Tr = { locale: string; title: string; description: string | null };
export async function loadListingForEdit(sb: SupabaseClient, id: string): Promise<{ init: Initial; propertyId: string; status: string; ref: string; photos: Photo[] } | null> {
  const { data: l } = await sb.from("listings").select(`id, purpose, status, price, currency, price_period, cheques, deposit_amount, permit_number, agent_id,
    property:properties(id, reference_code, type, building_name, bedrooms, bathrooms, size_sqft, plot_sqft, floor_number, parking_spaces, furnishing, view_type, completion_status, lat, lng,
      area:areas(code, area_translations(locale, name)), property_translations(locale, title, description), property_amenities(amenity:amenities(code)), property_media(id, path, is_cover, sort_order))`).eq("id", id).maybeSingle();
  if (!l) return null;
  const p = (Array.isArray(l.property) ? l.property[0] : l.property) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const tr = (loc: string) => (p.property_translations as Tr[]).find((x) => x.locale === loc);
  const s = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  return {
    propertyId: p.id, status: l.status as string, ref: p.reference_code,
    photos: (p.property_media ?? []) as Photo[],
    init: {
      status: l.status as string, amenities: (p.property_amenities as { amenity: { code: string } | null }[]).map((a) => a.amenity?.code).filter(Boolean) as string[],
      values: {
        purpose: s(l.purpose), type: s(p.type), area_name: s((p.area?.area_translations as { locale: string; name: string }[] | undefined)?.find((x) => x.locale === "en")?.name ?? p.area?.area_translations?.[0]?.name), building_name: s(p.building_name), completion_status: s(p.completion_status), agent_id: s(l.agent_id),
        bedrooms: s(p.bedrooms), bathrooms: s(p.bathrooms), size_sqft: s(p.size_sqft), plot_sqft: s(p.plot_sqft), floor_number: s(p.floor_number), parking_spaces: s(p.parking_spaces),
        furnishing: s(p.furnishing), view_type: s(p.view_type), lat: s(p.lat), lng: s(p.lng),
        price: s(l.price), currency: s(l.currency), price_period: s(l.price_period), cheques: s(l.cheques), deposit_amount: s(l.deposit_amount), permit_number: s(l.permit_number),
        title_en: s(tr("en")?.title), desc_en: s(tr("en")?.description), title_ar: s(tr("ar")?.title), desc_ar: s(tr("ar")?.description),
      },
    },
  };
}

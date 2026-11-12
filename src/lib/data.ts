import { publicClient } from "@/lib/supabase/public";
import type { Currency } from "@/lib/money";
import { DEMO_AGENT, DEMO_AREAS, DEMO_AVG_PPSF, DEMO_ITEMS, DEMO_PLAN, slugOf, type DemoItem } from "@/lib/demo-data";

export const PAGE_SIZE = 12;
export const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_DEMO === "1";

type Tr = { locale: string; slug: string; title: string };
type Media = { path: string; kind?: string; is_cover: boolean; sort_order: number; alt_en?: string | null; alt_ar?: string | null };
export type ListingRow = {
  id: string; purpose: "sale" | "rent"; status: string; price: number; currency: Currency;
  price_period: "yearly" | "monthly" | "weekly" | "daily" | null; is_featured: boolean; published_at?: string | null;
  flags?: { isNew?: boolean; drop?: boolean };
  property: {
    id: string; reference_code: string; type: string; bedrooms: number | null; bathrooms: number | null; size_sqft: number | null;
    lat: number | null; lng: number | null; completion_status: string;
    area: { code: string; area_translations: { locale: string; name: string }[] } | null;
    property_translations: Tr[]; property_media: Media[];
  };
};

export type Filters = {
  purpose?: "sale" | "rent"; offplan?: boolean; type?: string; beds?: "s" | number; area?: string; maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc"; page?: number;
};

export function pick<T extends { locale: string }>(arr: T[] | null | undefined, locale: string): T | undefined {
  return arr?.find((x) => x.locale === locale) ?? arr?.[0];
}
export const mediaUrl = (path: string, bucket = "property-media") => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
export function coverOf(media: Media[]) {
  return [...(media ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0]?.path;
}

/* ---------- demo mapping ---------- */
function demoRow(it: DemoItem): ListingRow {
  const a = DEMO_AREAS.find((x) => x.code === it.area)!;
  return {
    id: it.id, purpose: it.purpose, status: "published", price: it.price, currency: it.cur, price_period: it.period, is_featured: !!it.featured, published_at: null,
    flags: { isNew: it.nw, drop: it.dr },
    property: {
      id: it.id, reference_code: it.ref, type: it.type, bedrooms: it.beds, bathrooms: it.baths, size_sqft: it.sqft, lat: it.lat, lng: it.lng,
      completion_status: it.off ? "off_plan" : "ready",
      area: { code: a.code, area_translations: [{ locale: "en", name: a.en }, { locale: "ar", name: a.ar }] },
      property_translations: [{ locale: "en", slug: slugOf(it, "en"), title: it.en.title }, { locale: "ar", slug: slugOf(it, "ar"), title: it.ar.title }],
      property_media: [],
    },
  };
}
function demoFilter(f: Filters) {
  let r = DEMO_ITEMS.filter((it) =>
    (!f.purpose || it.purpose === f.purpose) && (!f.offplan || it.off) && (!f.type || it.type === f.type) && (!f.area || it.area === f.area) &&
    (f.beds === undefined || (f.beds === "s" ? it.beds === 0 : it.beds >= f.beds)) && (!f.maxPrice || it.aed <= f.maxPrice));
  if (f.sort === "price_asc") r = [...r].sort((a, b) => a.aed - b.aed);
  else if (f.sort === "price_desc") r = [...r].sort((a, b) => b.aed - a.aed);
  return r;
}

/* ---------- queries (work on server and in the browser) ---------- */
export type AreaOpt = { id: string; code: string; name: string };
export async function getAreas(locale: string): Promise<AreaOpt[]> {
  if (IS_DEMO) return DEMO_AREAS.map((a) => ({ id: a.id, code: a.code, name: locale === "ar" ? a.ar : a.en }));
  try {
    const { data } = await publicClient().from("areas").select("id, code, area_translations(locale, name)").eq("level", "community").eq("is_active", true).order("sort_order");
    return (data ?? []).map((a) => ({ id: a.id as string, code: a.code as string, name: pick(a.area_translations as { locale: string; name: string }[], locale)?.name ?? (a.code as string) }));
  } catch { return []; }
}

const LISTING_SELECT = `
  id, purpose, status, price, currency, price_period, is_featured, published_at,
  property:properties!inner(
    id, reference_code, type, bedrooms, bathrooms, size_sqft, lat, lng, completion_status, area_id,
    area:areas(code, area_translations(locale, name)),
    property_translations(locale, slug, title),
    property_media(path, is_cover, sort_order)
  )`;

function withFlags(rows: ListingRow[]): ListingRow[] {
  const cutoff = Date.now() - 14 * 864e5;
  return rows.map((r) => ({ ...r, flags: { isNew: !!r.published_at && new Date(r.published_at).getTime() > cutoff } }));
}

export async function searchListings(f: Filters, locale: string) {
  if (IS_DEMO) {
    const all = demoFilter(f), page = Math.max(1, f.page ?? 1);
    return { rows: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(demoRow), total: all.length };
  }
  try {
    const db = publicClient();
    let q = db.from("listings").select(LISTING_SELECT, { count: "exact" }).eq("status", "published");
    if (f.purpose) q = q.eq("purpose", f.purpose);
    if (f.offplan) q = q.eq("property.completion_status", "off_plan");
    if (f.type) q = q.eq("property.type", f.type);
    if (f.beds === "s") q = q.eq("property.bedrooms", 0);
    else if (f.beds !== undefined) q = q.gte("property.bedrooms", f.beds);
    if (f.maxPrice) q = q.lte("price_aed_normalized", f.maxPrice);
    if (f.area) {
      const id = (await getAreas(locale)).find((a) => a.code === f.area)?.id;
      if (!id) return { rows: [] as ListingRow[], total: 0 }; // unknown area code: no results (never "everything")
      q = q.eq("property.area_id", id);
    }
    if (f.sort === "price_asc") q = q.order("price_aed_normalized", { ascending: true });
    else if (f.sort === "price_desc") q = q.order("price_aed_normalized", { ascending: false });
    else q = q.order("is_featured", { ascending: false }).order("published_at", { ascending: false });
    const page = Math.max(1, f.page ?? 1);
    const { data, count, error } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;
    return { rows: withFlags((data ?? []) as unknown as ListingRow[]), total: count ?? 0 };
  } catch { return { rows: [] as ListingRow[], total: 0 }; }
}

export async function getFeatured(locale: string, n = 5) {
  const { rows } = await searchListings({ sort: "newest" }, locale);
  return rows.slice(0, n);
}

export async function getListingsByPropertyIds(ids: string[], locale: string): Promise<ListingRow[]> {
  if (!ids.length) return [];
  if (IS_DEMO) return DEMO_ITEMS.filter((i) => ids.includes(i.id)).map(demoRow);
  try {
    const { data } = await publicClient().from("listings").select(LISTING_SELECT).in("property_id", ids).in("status", ["published", "reserved"]);
    return withFlags((data ?? []) as unknown as ListingRow[]);
  } catch { return []; }
}

export async function getSimilar(l: ListingRow, locale: string): Promise<ListingRow[]> {
  if (IS_DEMO) return DEMO_ITEMS.filter((i) => i.id !== l.property.id && i.purpose === l.purpose).slice(0, 3).map(demoRow);
  try {
    const { data } = await publicClient().from("listings").select(LISTING_SELECT).eq("status", "published").eq("purpose", l.purpose).neq("property_id", l.property.id).limit(3);
    return withFlags((data ?? []) as unknown as ListingRow[]);
  } catch { return []; }
}

export type Hit = { slug: string; title: string; area: string };
/** Used by the command palette. Searches public property titles in the current language. */
export async function searchProperties(q: string, locale: string): Promise<Hit[]> {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  if (IS_DEMO) return DEMO_ITEMS.filter((i) => (i.en.title + i.ar.title).toLowerCase().includes(s)).slice(0, 5)
    .map((i) => ({ slug: slugOf(i, locale === "ar" ? "ar" : "en"), title: locale === "ar" ? i.ar.title : i.en.title, area: DEMO_AREAS.find((a) => a.code === i.area)![locale === "ar" ? "ar" : "en"] }));
  try {
    const { data } = await publicClient().from("property_translations").select("slug, title").eq("locale", locale).ilike("title", `%${s.replace(/[%_]/g, "")}%`).limit(5);
    return (data ?? []).map((r) => ({ slug: r.slug as string, title: r.title as string, area: "" }));
  } catch { return []; }
}

export type PlanStep = { label_en: string; label_ar: string | null; percentage: number };
export type PropertyDetail = {
  translation: { property_id: string; slug: string; title: string; description: string | null; meta_title: string | null; meta_description: string | null; og_image_url: string | null };
  property: {
    id: string; reference_code: string; type: string; bedrooms: number | null; bathrooms: number | null; size_sqft: number | null; plot_sqft: number | null;
    floor_number: number | null; parking_spaces: number | null; furnishing: string | null; view_type: string | null; building_name: string | null;
    completion_status: string; year_built: number | null; lat: number | null; lng: number | null; area_id?: string | null;
    area: { code: string; area_translations: { locale: string; name: string }[] } | null;
    property_translations: { locale: string; slug: string }[];
    property_media: Media[];
    property_amenities: { amenity: { code: string; name_en: string; name_ar: string } | null }[];
  };
  listings: { id: string; purpose: "sale" | "rent"; status: string; price: number; currency: Currency; price_period: string | null; cheques: number | null; deposit_amount: number | null; permit_number: string | null; agent_id: string | null; published_at: string | null; updated_at: string }[];
  agent: { id: string; display_name_en: string; display_name_ar: string | null; title_en: string | null; title_ar: string | null; license_number: string | null; photo_url: string | null; public_phone: string | null; whatsapp: string | null; languages: string[] } | null;
  areaAvgPpsf: number | null;
  plan: PlanStep[] | null;
};

export async function getPropertyBySlug(locale: string, slug: string): Promise<{ redirectTo: string } | { detail: PropertyDetail } | null> {
  if (IS_DEMO) {
    const it = DEMO_ITEMS.find((i) => slugOf(i, locale === "ar" ? "ar" : "en") === slug);
    if (!it) return null;
    const row = demoRow(it);
    return { detail: {
      translation: { property_id: it.id, slug, title: locale === "ar" ? it.ar.title : it.en.title, description: locale === "ar" ? it.ar.desc : it.en.desc, meta_title: null, meta_description: null, og_image_url: null },
      property: { ...row.property, plot_sqft: null, floor_number: 12, parking_spaces: 2, furnishing: it.purpose === "rent" ? "furnished" : null, view_type: null, building_name: null, year_built: null,
        property_amenities: [["pool", "Swimming pool", "مسبح"], ["gym", "Gym", "نادي رياضي"], ["parking", "Parking", "موقف سيارات"], ["security", "24/7 security", "حراسة على مدار الساعة"], ["balcony", "Balcony", "شرفة"]].map(([code, name_en, name_ar]) => ({ amenity: { code, name_en, name_ar } })) },
      listings: [{ id: it.id, purpose: it.purpose, status: "published", price: it.price, currency: it.cur, price_period: it.period, cheques: it.purpose === "rent" ? 4 : null, deposit_amount: null, permit_number: "12345678", agent_id: DEMO_AGENT.id, published_at: null, updated_at: "2026-10-28T10:15:00Z" }],
      agent: DEMO_AGENT, areaAvgPpsf: DEMO_AVG_PPSF[it.area] ?? null, plan: it.off ? DEMO_PLAN : null,
    } };
  }
  try {
    const db = publicClient();
    const { data: tr } = await db.from("property_translations").select("property_id, slug, title, description, meta_title, meta_description, og_image_url").eq("locale", locale).eq("slug", slug).maybeSingle();
    if (!tr) {
      const { data: r } = await db.from("slug_redirects").select("new_slug").eq("entity_type", "property").eq("locale", locale).eq("old_slug", slug).maybeSingle();
      return r ? { redirectTo: r.new_slug as string } : null;
    }
    const [{ data: property }, { data: listings }, { data: unit }] = await Promise.all([
      db.from("properties").select(`id, reference_code, type, bedrooms, bathrooms, size_sqft, plot_sqft, floor_number, parking_spaces, furnishing, view_type, building_name, completion_status, year_built, lat, lng, area_id,
        area:areas(code, area_translations(locale, name)), property_translations(locale, slug),
        property_media(path, kind, alt_en, alt_ar, is_cover, sort_order), property_amenities(amenity:amenities(code, name_en, name_ar))`).eq("id", tr.property_id).maybeSingle(),
      db.from("listings").select("id, purpose, status, price, currency, price_period, cheques, deposit_amount, permit_number, agent_id, published_at, updated_at").eq("property_id", tr.property_id).in("status", ["published", "reserved", "sold", "rented"]),
      db.from("units").select("payment_plan_id").eq("property_id", tr.property_id).maybeSingle(),
    ]);
    if (!property || !listings?.length) return null;
    const agentId = listings.find((l) => l.agent_id)?.agent_id;
    const purpose = listings[0].purpose;
    const [{ data: agent }, { data: stat }, { data: ms }] = await Promise.all([
      agentId ? db.from("agent_profiles").select("id, display_name_en, display_name_ar, title_en, title_ar, license_number, photo_url, public_phone, whatsapp, languages").eq("id", agentId).maybeSingle() : Promise.resolve({ data: null }),
      property.area_id ? db.from("area_stats").select("avg_price_per_sqft_aed").eq("area_id", property.area_id).eq("purpose", purpose).maybeSingle() : Promise.resolve({ data: null }),
      unit?.payment_plan_id ? db.from("payment_plan_milestones").select("label_en, label_ar, percentage").eq("payment_plan_id", unit.payment_plan_id).order("sort_order") : Promise.resolve({ data: null }),
    ]);
    return { detail: {
      translation: tr as PropertyDetail["translation"], property: property as unknown as PropertyDetail["property"], listings: listings as PropertyDetail["listings"],
      agent: (agent as PropertyDetail["agent"]) ?? null, areaAvgPpsf: stat ? Number((stat as { avg_price_per_sqft_aed: number }).avg_price_per_sqft_aed) : null,
      plan: (ms as PlanStep[] | null)?.length ? (ms as PlanStep[]) : null,
    } };
  } catch { return null; }
}

/** One row shaped like a search result, built from a detail page (used to fetch similar properties). */
export function rowFromDetail(d: PropertyDetail): ListingRow {
  const l = d.listings[0];
  return { id: l.id, purpose: l.purpose, status: l.status, price: l.price, currency: l.currency, price_period: l.price_period as ListingRow["price_period"], is_featured: false,
    property: { id: d.property.id, reference_code: d.property.reference_code, type: d.property.type, bedrooms: d.property.bedrooms, bathrooms: d.property.bathrooms, size_sqft: d.property.size_sqft,
      lat: d.property.lat, lng: d.property.lng, completion_status: d.property.completion_status, area: d.property.area, property_translations: d.property.property_translations as Tr[], property_media: d.property.property_media } };
}

/** Public company details edited by the admin in Settings (phone, email, WhatsApp). Empty when not set. */
export async function getCompany(): Promise<{ name?: string; phone?: string; email?: string; whatsapp?: string }> {
  if (IS_DEMO) return {};
  try {
    const { data } = await publicClient().from("site_settings").select("value").eq("key", "company").maybeSingle();
    return (data?.value as Record<string, string>) ?? {};
  } catch { return {}; }
}

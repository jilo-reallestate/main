import { publicClient } from "@/lib/supabase/public";
import { IS_DEMO, getAreas, pick } from "@/lib/data";

/** Public off-plan reads. Anonymous client: Row Level Security returns only published projects. */
type Tr = { locale: string; slug: string; name: string; tagline?: string | null };
type Media = { path: string; kind?: string; is_cover: boolean; sort_order: number; alt_en?: string | null; alt_ar?: string | null };
type NamedEN = { name_en: string; name_ar: string | null };
export type ProjectCard = {
  id: string; code: string; status: string; handover_date: string | null; completion_pct: number; starting_price: number | null; currency: string; is_featured: boolean;
  developer: (NamedEN & { id: string }) | null; area: { code: string; area_translations: { locale: string; name: string }[] } | null;
  project_translations: Tr[]; project_media: Media[];
};
export type ProjectFilters = { area?: string; developer?: string; year?: number; maxPrice?: number };

const CARD = `id, code, status, handover_date, completion_pct, starting_price, currency, is_featured,
  developer:developers(id, name_en, name_ar), area:areas(code, area_translations(locale, name)),
  project_translations(locale, slug, name, tagline), project_media(path, kind, is_cover, sort_order)`;

export async function searchProjects(f: ProjectFilters, locale: string): Promise<ProjectCard[]> {
  if (IS_DEMO) return [];
  try {
    let q = publicClient().from("projects").select(CARD).order("is_featured", { ascending: false }).order("handover_date", { ascending: true, nullsFirst: false });
    if (f.developer) q = q.eq("developer_id", f.developer);
    if (f.year) q = q.gte("handover_date", `${f.year}-01-01`).lte("handover_date", `${f.year}-12-31`);
    if (f.maxPrice) q = q.lte("starting_price", f.maxPrice);
    if (f.area) {
      const id = (await getAreas(locale)).find((a) => a.code === f.area)?.id;
      if (!id) return [];
      q = q.eq("area_id", id);
    }
    const { data, error } = await q.limit(100);
    if (error) throw error;
    return ((data ?? []) as unknown as ProjectCard[]).filter((p) => p.project_translations.length > 0);
  } catch { return []; }
}

export async function projectFilterOptions(): Promise<{ developers: { id: string; name_en: string; name_ar: string | null }[]; years: number[] }> {
  if (IS_DEMO) return { developers: [], years: [] };
  try {
    const db = publicClient();
    const [{ data: d }, { data: p }] = await Promise.all([db.from("developers").select("id, name_en, name_ar").order("name_en"), db.from("projects").select("handover_date").not("handover_date", "is", null)]);
    const years = [...new Set((p ?? []).map((x) => new Date(x.handover_date as string).getUTCFullYear()))].sort();
    return { developers: (d ?? []) as { id: string; name_en: string; name_ar: string | null }[], years };
  } catch { return { developers: [], years: [] }; }
}

export type Milestone = { sort_order: number; label_en: string; label_ar: string | null; percentage: number; trigger_type: string; due_offset_days: number | null; fixed_date: string | null; construction_stage: string | null };
export type PublicPlan = { id: string; name_en: string; name_ar: string | null; description_en: string | null; description_ar: string | null; milestones: Milestone[]; units: number };
export type PublicUnit = { id: string; unit_number: string; unit_type: string | null; bedrooms: number | null; size_sqft: number | null; price: number; currency: string; status: string; payment_plan_id: string | null };
export type ProjectDetail = ProjectCard & {
  launch_date: string | null; lat: number | null; lng: number | null; brochure_url: string | null; permit_number: string | null;
  tr: { locale: string; slug: string; name: string; tagline: string | null; description: string | null; meta_title: string | null; meta_description: string | null; og_image_url: string | null };
  updates: { id: string; update_date: string; title_en: string; title_ar: string | null; body_en: string | null; body_ar: string | null; completion_pct: number | null }[];
  units: PublicUnit[]; plans: PublicPlan[];
};

/** A hold whose time ran out but that the hourly job has not released yet counts as available (the database re-checks when someone reserves). */
export const effectiveStatus = (u: { status: string; reserved_until?: string | null }) =>
  u.status === "reserved" && u.reserved_until && new Date(u.reserved_until).getTime() < Date.now() ? "available" : u.status;

export async function getProjectBySlug(locale: string, slug: string): Promise<{ project: ProjectDetail } | { redirectTo: string } | null> {
  if (IS_DEMO) return null;
  try {
    const db = publicClient();
    const { data: tr } = await db.from("project_translations").select("project_id, locale, slug, name, tagline, description, meta_title, meta_description, og_image_url").eq("locale", locale).eq("slug", slug).maybeSingle();
    if (!tr) {
      const { data: r } = await db.from("slug_redirects").select("new_slug").eq("entity_type", "project").eq("locale", locale).eq("old_slug", slug).maybeSingle();
      return r ? { redirectTo: r.new_slug as string } : null;
    }
    const pid = tr.project_id as string;
    const [{ data: p }, { data: ups }, { data: us }] = await Promise.all([
      db.from("projects").select(`${CARD}, launch_date, lat, lng, brochure_url, permit_number`).eq("id", pid).maybeSingle(),
      db.from("project_updates").select("id, update_date, title_en, title_ar, body_en, body_ar, completion_pct").eq("project_id", pid).order("update_date", { ascending: false }).limit(12),
      db.from("units").select("id, unit_number, unit_type, bedrooms, size_sqft, price, currency, status, reserved_until, payment_plan_id").eq("project_id", pid).order("unit_number"),
    ]);
    if (!p) return null;
    const units = ((us ?? []) as (PublicUnit & { reserved_until: string | null })[]).map((u) => ({ ...u, status: effectiveStatus(u) }));
    const planIds = [...new Set(units.filter((u) => u.status === "available" && u.payment_plan_id).map((u) => u.payment_plan_id as string))];
    let plans: PublicPlan[] = [];
    if (planIds.length) {
      const { data } = await db.from("payment_plans").select("id, name_en, name_ar, description_en, description_ar, payment_plan_milestones(sort_order, label_en, label_ar, percentage, trigger_type, due_offset_days, fixed_date, construction_stage)").in("id", planIds);
      plans = ((data ?? []) as unknown as (Omit<PublicPlan, "milestones" | "units"> & { payment_plan_milestones: Milestone[] })[])
        .map((x) => ({ id: x.id, name_en: x.name_en, name_ar: x.name_ar, description_en: x.description_en, description_ar: x.description_ar, milestones: [...x.payment_plan_milestones].sort((a, b) => a.sort_order - b.sort_order), units: units.filter((u) => u.status === "available" && u.payment_plan_id === x.id).length }))
        .sort((a, b) => b.units - a.units);
    }
    const project = { ...(p as unknown as ProjectCard & { launch_date: string | null; lat: number | null; lng: number | null; brochure_url: string | null; permit_number: string | null }),
      tr: { locale: tr.locale, slug: tr.slug, name: tr.name, tagline: tr.tagline ?? null, description: tr.description ?? null, meta_title: tr.meta_title ?? null, meta_description: tr.meta_description ?? null, og_image_url: tr.og_image_url ?? null },
      updates: (ups ?? []) as ProjectDetail["updates"], units, plans } as unknown as ProjectDetail;
    return { project };
  } catch { return null; }
}

export async function projectSlugs(): Promise<{ project_id: string; locale: string; slug: string }[]> {
  if (IS_DEMO) return [];
  try { const { data } = await publicClient().from("project_translations").select("project_id, locale, slug").limit(2000); return (data ?? []) as { project_id: string; locale: string; slug: string }[]; } catch { return []; }
}
export { pick };

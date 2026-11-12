import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/seo";
import { projectSlugs } from "@/lib/projects-data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = ["", "/properties", "/projects", "/about"].map((p) => ({
    url: `${SITE_URL}/en${p}`, lastModified: now,
    alternates: { languages: { "en-AE": `${SITE_URL}/en${p}`, "ar-AE": `${SITE_URL}/ar${p}` } },
  }));
  try {
    const { data } = await publicClient().from("property_translations").select("property_id, locale, slug").limit(5000);
    const byProp = new Map<string, Record<string, string>>();
    (data ?? []).forEach((r) => byProp.set(r.property_id, { ...(byProp.get(r.property_id) ?? {}), [r.locale]: r.slug }));
    byProp.forEach((slugs) => {
      const languages: Record<string, string> = {};
      if (slugs.en) languages["en-AE"] = `${SITE_URL}/en/properties/${slugs.en}`;
      if (slugs.ar) languages["ar-AE"] = `${SITE_URL}/ar/properties/${slugs.ar}`;
      for (const [loc, slug] of Object.entries(slugs)) entries.push({ url: `${SITE_URL}/${loc}/properties/${slug}`, lastModified: now, alternates: { languages } });
    });
    const bySlug = new Map<string, Record<string, string>>();
    (await projectSlugs()).forEach((r) => bySlug.set(r.project_id, { ...(bySlug.get(r.project_id) ?? {}), [r.locale]: r.slug }));
    bySlug.forEach((slugs) => {
      const languages: Record<string, string> = {};
      if (slugs.en) languages["en-AE"] = `${SITE_URL}/en/projects/${slugs.en}`;
      if (slugs.ar) languages["ar-AE"] = `${SITE_URL}/ar/projects/${slugs.ar}`;
      for (const [loc, slug] of Object.entries(slugs)) entries.push({ url: `${SITE_URL}/${loc}/projects/${slug}`, lastModified: now, alternates: { languages } });
    });
  } catch { /* database unreachable at build time: sitemap regenerates hourly */ }
  return entries;
}

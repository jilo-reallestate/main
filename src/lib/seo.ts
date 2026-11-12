export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.jilo-realestate.com").replace(/\/$/, "");

/** hreflang map for a page that exists in both languages. */
export function hreflang(paths: { en?: string; ar?: string }) {
  const languages: Record<string, string> = {};
  if (paths.en) languages["en-AE"] = `${SITE_URL}${paths.en}`;
  if (paths.ar) languages["ar-AE"] = `${SITE_URL}${paths.ar}`;
  if (paths.en) languages["x-default"] = `${SITE_URL}${paths.en}`;
  return languages;
}

/** Schema.org BreadcrumbList. `path` values start with "/" and include the locale. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, item: `${SITE_URL}${x.path}` })) };
}

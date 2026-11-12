import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { Footer } from "@/components/Footer";
import { FilterBar } from "@/components/FilterBar";
import { ListingCard } from "@/components/ListingCard";
import { MapLoader, type Pin } from "@/components/MapLoader";
import { Art, seedOf } from "@/components/Art";
import { SaveSearchButton } from "@/components/SaveSearchButton";
import { PAGE_SIZE, getAreas, pick, searchListings, type Filters } from "@/lib/data";
import { formatMoney, short } from "@/lib/money";
import { SITE_URL, hreflang } from "@/lib/seo";

export const revalidate = 300;
type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parse(sp: SP): Filters & { view: "grid" | "map" } {
  const purpose = first(sp.purpose), sort = first(sp.sort), beds = first(sp.beds), max = Number(first(sp.maxPrice));
  return {
    purpose: purpose === "sale" || purpose === "rent" ? purpose : undefined, offplan: first(sp.offplan) === "1" || undefined,
    type: first(sp.type) || undefined, area: first(sp.area) || undefined,
    beds: beds === "s" ? "s" : beds && Number.isFinite(Number(beds)) ? Number(beds) : undefined, maxPrice: Number.isFinite(max) && max > 0 ? max : undefined,
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "newest", page: Math.max(1, Number(first(sp.page)) || 1), view: first(sp.view) === "map" ? "map" : "grid",
  };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }): Promise<Metadata> {
  const { locale } = await params, f = parse(await searchParams), t = await getTranslations({ locale, namespace: "list" });
  const title = f.purpose === "sale" ? t("titleSale") : f.purpose === "rent" ? t("titleRent") : t("title");
  // Plain pages (optionally by purpose) are indexed. Filter combinations stay out of Google until they earn a landing page.
  const filtered = !!(f.type || f.area || f.beds !== undefined || f.maxPrice || f.offplan || f.sort !== "newest" || f.view === "map");
  const q = f.purpose ? `?purpose=${f.purpose}` : "";
  return { title, robots: filtered ? { index: false, follow: true } : undefined,
    alternates: { canonical: `${SITE_URL}/${locale}/properties${q}`, languages: hreflang({ en: `/en/properties${q}`, ar: `/ar/properties${q}` }) } };
}

export default async function PropertiesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params; setRequestLocale(locale);
  const sp = await searchParams, f = parse(sp), t = await getTranslations();
  const [areas, { rows, total }] = await Promise.all([getAreas(locale), searchListings(f, locale)]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)), page = f.page ?? 1;
  const qs = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams(); const base: Record<string, string | number | undefined> = { purpose: first(sp.purpose), offplan: first(sp.offplan), type: first(sp.type), area: first(sp.area), beds: first(sp.beds), maxPrice: first(sp.maxPrice), sort: first(sp.sort), view: first(sp.view), ...over };
    Object.entries(base).forEach(([k, v]) => v !== undefined && v !== "" && u.set(k, String(v)));
    return `/properties${u.toString() ? `?${u}` : ""}`;
  };
  const chips: [string, string, string][] = [
    f.purpose && !f.offplan ? ["purpose", f.purpose === "sale" ? t("nav.buy") : t("nav.rent"), qs({ purpose: undefined, page: undefined })] : null,
    f.offplan ? ["offplan", t("nav.offplan"), qs({ offplan: undefined, purpose: undefined })] : null,
    f.area ? ["area", areas.find((a) => a.code === f.area)?.name ?? f.area, qs({ area: undefined })] : null,
    f.type ? ["type", t(`types.${f.type}` as "types.villa"), qs({ type: undefined })] : null,
    f.beds !== undefined ? ["beds", f.beds === "s" ? t("v2.x.studio") : `${f.beds}+ ${t("list.beds")}`, qs({ beds: undefined })] : null,
    f.maxPrice ? ["max", `${t("v2.x.up")} ${short(f.maxPrice)}`, qs({ maxPrice: undefined })] : null,
  ].filter(Boolean) as [string, string, string][];
  const pins: Pin[] = rows.filter((l) => l.property.lat && l.property.lng).map((l) => {
    const tr = pick(l.property.property_translations, locale);
    return { id: l.property.id, lat: l.property.lat!, lng: l.property.lng!, label: short(l.price), title: tr?.title ?? "", area: pick(l.property.area?.area_translations, locale)?.name ?? "", price: formatMoney(l.price, l.currency, locale), href: `/properties/${tr?.slug}`, seed: seedOf(l.property.id) };
  });
  const heading = f.offplan ? t("nav.offplan") : f.purpose === "sale" ? t("list.titleSale") : f.purpose === "rent" ? t("list.titleRent") : t("list.title");

  return (
    <>
      <Header locale={locale} switchHref="/properties" />
      <BreadcrumbLd locale={locale} crumbs={[{ key: "crumbProperties", path: "/properties" }]} />
      <main className="wrap pt-10">
        <div className="eyebrow">{t("v2.x.ey2")}</div>
        <h1 className="mt-3 text-[clamp(40px,7vw,84px)]">{heading}</h1>
        <FilterBar areas={areas} />
        <div className="mb-1.5 mt-6 flex min-h-[34px] flex-wrap items-center gap-2" aria-live="polite">
          <span className="me-2 font-bold">{t("list.results", { count: total })}</span>
          {chips.map(([k, l, href]) => <Link key={k} href={href} className="rounded-full bg-surf px-3.5 py-1.5 text-[13px] font-medium">{l} <span className="text-mu">×</span></Link>)}
          {chips.length > 0 && <Link href="/properties" className="text-[13px] underline">{t("v2.x.rst")}</Link>}
          {chips.length > 0 && <span className="ms-auto"><SaveSearchButton defaultName={chips.map((c) => c[1]).join(" · ").slice(0, 80)} filters={Object.fromEntries(Object.entries({ purpose: f.purpose, offplan: f.offplan ? "1" : undefined, type: f.type, area: f.area, beds: f.beds === undefined ? undefined : String(f.beds), maxPrice: f.maxPrice ? String(f.maxPrice) : undefined }).filter(([, v]) => v !== undefined)) as Record<string, string>} /></span>}
        </div>
        {!rows.length ? (
          <div className="mt-4 rounded-lg bg-surf p-14 text-center"><h2 className="text-2xl">{t("v2.x.em")}</h2><p className="mb-5 mt-2 text-mu">{t("v2.x.em2")}</p><Link href="/properties" className="inline-flex min-h-[46px] items-center rounded-full bg-tx px-6 font-semibold text-bg">{t("v2.x.rst")}</Link></div>
        ) : f.view === "map" ? (
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(300px,420px)_1fr]">
            <div className="grid max-h-[640px] content-start gap-3 overflow-auto pe-1.5">{rows.map((l) => {
              const tr = pick(l.property.property_translations, locale);
              return <Link key={l.id} href={`/properties/${tr?.slug}`} className="flex gap-3.5 rounded-lg bg-surf p-3 transition hover:bg-ln">
                <Art seed={seedOf(l.property.id)} className="h-24 w-24 flex-none overflow-hidden rounded-2xl [&_svg]:h-full [&_svg]:w-full" />
                <span><small className="text-mu">{pick(l.property.area?.area_translations, locale)?.name}</small><b className="block leading-tight">{tr?.title}</b><em className="mt-1 block font-bold not-italic">{formatMoney(l.price, l.currency, locale)}</em></span></Link>; })}</div>
            <div className="lg:sticky lg:top-24 lg:self-start"><MapLoader pins={pins} className="h-[clamp(360px,60vh,640px)]" /></div>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows.map((l, i) => <ListingCard key={l.id} l={l} locale={locale} priority={i < 4} />)}</div>
        )}
        {pages > 1 && (
          <nav className="mt-10 flex items-center justify-between gap-4" aria-label="Pagination">
            {page > 1 ? <Link href={qs({ page: page - 1 })} rel="prev" className="underline">{t("list.prev")}</Link> : <span />}
            <span className="text-sm text-mu">{t("list.page", { page, pages })}</span>
            {page < pages ? <Link href={qs({ page: page + 1 })} rel="next" className="underline">{t("list.next")}</Link> : <span />}
          </nav>)}
      </main>
      <Footer />
    </>
  );
}

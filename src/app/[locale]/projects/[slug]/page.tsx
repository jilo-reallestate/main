import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { Footer } from "@/components/Footer";
import { Gallery, type Slide } from "@/components/Gallery";
import { MapLoader } from "@/components/MapLoader";
import { PlanTimeline } from "@/components/PlanTimeline";
import { ProjectEnquiry } from "@/components/ProjectEnquiry";
import { seedOf } from "@/components/Art";
import { btn } from "@/components/ui/Button";
import { formatMoney, short, type Currency } from "@/lib/money";
import { formatNumber } from "@/lib/format";
import { SITE_URL, hreflang } from "@/lib/seo";
import { mediaUrl, pick } from "@/lib/data";
import { getProjectBySlug, type ProjectDetail } from "@/lib/projects-data";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
type Props = { params: Promise<{ locale: string; slug: string }> };
const day = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

async function load(locale: string, slug: string): Promise<ProjectDetail> {
  const r = await getProjectBySlug(locale, decodeURIComponent(slug));
  if (!r) notFound();
  if ("redirectTo" in r) redirect({ href: `/projects/${r.redirectTo}`, locale }); // old slug: send people (and Google) to the new address
  return (r as { project: ProjectDetail }).project;
}
const mainMedia = (p: ProjectDetail) => p.project_media.filter((m) => !m.kind || m.kind === "image").sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const r = await getProjectBySlug(locale, decodeURIComponent(slug));
  if (!r || "redirectTo" in r) return {};
  const p = r.project, tr = p.tr, slugs = Object.fromEntries(p.project_translations.map((x) => [x.locale, x.slug]));
  const path = (l: string) => (slugs[l] ? `/${l}/projects/${slugs[l]}` : undefined), cover = mainMedia(p)[0];
  const description = tr.meta_description ?? tr.description?.slice(0, 160) ?? undefined, image = tr.og_image_url ?? (cover ? mediaUrl(cover.path, "project-media") : undefined);
  return { title: tr.meta_title ?? tr.name, description, alternates: { canonical: `${SITE_URL}/${locale}/projects/${tr.slug}`, languages: hreflang({ en: path("en"), ar: path("ar") }) },
    openGraph: { title: tr.meta_title ?? tr.name, description, images: image ? [image] : undefined, locale: locale === "ar" ? "ar_AE" : "en_AE", type: "website" } };
}

export default async function ProjectPage({ params }: Props) {
  const { locale, slug } = await params; setRequestLocale(locale);
  const p = await load(locale, slug), t = await getTranslations("op"), c = await getTranslations("op.c"), tr = p.tr;
  const other = locale === "ar" ? "en" : "ar", otherSlug = p.project_translations.find((x) => x.locale === other)?.slug;
  const area = pick(p.area?.area_translations, locale)?.name ?? "", dev = p.developer ? ((locale === "ar" ? p.developer.name_ar : null) ?? p.developer.name_en) : null;
  const media = mainMedia(p), seed = seedOf(p.id), cur = p.currency as Currency;
  const slides: Slide[] = media.length ? media.map((m) => ({ src: mediaUrl(m.path, "project-media"), alt: (locale === "ar" ? m.alt_ar : m.alt_en) ?? tr.name, seed })) : [0, 1, 2, 3, 4].map(() => ({ alt: tr.name, seed }));
  const avail = p.units.filter((u) => u.status === "available"), prices = avail.map((u) => Number(u.price));
  const h2 = "text-2xl font-semibold md:text-3xl", box = "rounded-lg bg-surf p-6";
  const unitMeta = (u: ProjectDetail["units"][number]) => [u.unit_type, u.bedrooms === null ? null : u.bedrooms === 0 ? c("studio") : c("beds", { n: u.bedrooms }), u.size_sqft ? `${formatNumber(Math.round(u.size_sqft), locale)} ${c("sqft")}` : null].filter(Boolean).join(" · ");
  const facts: [string, string][] = [[t("pub.statusLabel"), t(`pstat.${p.status}` as "pstat.upcoming")], [t("proj.handover"), p.handover_date ? day(p.handover_date, locale) : "—"], [t("pub.progress"), t("pub.completion", { n: p.completion_pct })], [t("pub.availableUnits"), formatNumber(avail.length, locale)], ...(p.permit_number ? [[t("pub.permit"), p.permit_number] as [string, string]] : [])];
  const jsonLd = { "@context": "https://schema.org", "@type": "ApartmentComplex", name: tr.name, description: tr.description ?? undefined, url: `${SITE_URL}/${locale}/projects/${tr.slug}`, image: media.slice(0, 5).map((m) => mediaUrl(m.path, "project-media")),
    address: { "@type": "PostalAddress", addressLocality: area, addressCountry: "AE" }, geo: p.lat !== null && p.lng !== null ? { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } : undefined,
    brand: dev ? { "@type": "Organization", name: dev } : undefined, numberOfAvailableAccommodationUnits: avail.length,
    offers: prices.length ? { "@type": "AggregateOffer", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), priceCurrency: p.currency, offerCount: prices.length, availability: "https://schema.org/PreOrder" } : undefined };
  return (
    <>
      <Header locale={locale} switchHref={otherSlug ? `/projects/${otherSlug}` : "/projects"} />
      <BreadcrumbLd locale={locale} crumbs={[{ key: "crumbProjects", path: "/projects" }, { label: tr.name, path: `/projects/${tr.slug}` }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="wrap pb-20 pt-6">
        <Gallery slides={slides} />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="grid min-w-0 gap-10">
            <header>
              <p className="text-sm text-mu">{[dev ? t("pub.by", { d: dev }) : null, area].filter(Boolean).join(" · ")}</p>
              <h1 className="mt-1 break-words text-3xl font-semibold sm:text-4xl md:text-5xl">{tr.name}</h1>
              {tr.tagline && <p className="mt-3 text-lg text-mu">{tr.tagline}</p>}
              <p className="mt-4 text-2xl font-semibold">{p.starting_price ? t("pub.from", { p: formatMoney(p.starting_price, cur, locale) }) : null}</p>
              {p.brochure_url && <a href={p.brochure_url} target="_blank" rel="noreferrer" className={btn("outline", true, "mt-4")}>↓ {t("pub.brochure")}</a>}
            </header>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{facts.slice(0, 4).map(([l, v]) => <div key={l} className="rounded-lg bg-surf p-4"><dt className="text-sm text-mu">{l}</dt><dd className="mt-1 font-semibold">{v}</dd></div>)}</dl>
            {tr.description && <section><h2 className={h2}>{t("pub.overview")}</h2><p className="mt-4 whitespace-pre-line leading-relaxed">{tr.description}</p></section>}

            {p.plans.length > 0 && <section><h2 className={h2}>{t("pub.paymentPlan")}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">{p.plans.slice(0, 2).map((pl) => (
                <div key={pl.id} className={box}><h3 className="mb-1 text-lg font-semibold">{(locale === "ar" ? pl.name_ar : null) ?? pl.name_en}</h3>
                  {((locale === "ar" ? pl.description_ar : null) ?? pl.description_en) && <p className="mb-4 text-sm text-mu">{(locale === "ar" ? pl.description_ar : null) ?? pl.description_en}</p>}
                  <PlanTimeline milestones={pl.milestones} locale={locale} handover={p.handover_date} /></div>))}</div></section>}

            <section><h2 className={h2}>{t("pub.availableUnits")}</h2>
              {avail.length ? <>
                <ul className="mt-4 grid gap-3 sm:hidden">{avail.map((u) => (
                  <li key={u.id} className="rounded-lg bg-surf p-4"><div className="flex items-baseline justify-between gap-3"><b dir="ltr">{u.unit_number}</b><b>{formatMoney(u.price, u.currency as Currency, locale)}</b></div><p className="mt-1 text-sm text-mu">{unitMeta(u) || "—"}</p></li>))}</ul>
                <div className="mt-4 hidden overflow-x-auto rounded-lg bg-surf sm:block"><table className="w-full text-sm">
                <thead><tr>{[t("pub.unitNo"), t("pub.type"), t("unit.beds"), t("pub.size"), t("pub.price")].map((h) => <th key={h} className="p-4 text-start text-xs font-semibold text-mu">{h}</th>)}</tr></thead>
                <tbody>{avail.map((u) => (
                  <tr key={u.id} className="border-t border-ln"><td className="p-4 font-semibold" dir="ltr">{u.unit_number}</td><td className="p-4">{u.unit_type ?? "—"}</td><td className="p-4">{u.bedrooms === null ? "—" : u.bedrooms === 0 ? c("studio") : u.bedrooms}</td>
                    <td className="p-4 whitespace-nowrap">{u.size_sqft ? `${formatNumber(Math.round(u.size_sqft), locale)} ${c("sqft")}` : "—"}</td><td className="p-4 whitespace-nowrap font-semibold">{formatMoney(u.price, u.currency as Currency, locale)}</td></tr>))}</tbody></table></div></>
                : <p className="mt-4 rounded-lg bg-surf p-8 text-center text-mu">{t("pub.soldOut")}</p>}</section>

            <section><h2 className={h2}>{t("pub.progress")}</h2>
              <div className={`${box} mt-4`}><div className="flex items-baseline justify-between"><b className="text-3xl" dir="ltr">{p.completion_pct}%</b><span className="text-sm text-mu">{p.handover_date ? t("pub.handoverAt", { d: day(p.handover_date, locale) }) : ""}</span></div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={p.completion_pct} aria-valuemin={0} aria-valuemax={100}><span className="block h-full bg-goldgrad" style={{ width: `${p.completion_pct}%` }} /></div>
                {p.updates.length ? <ol className="mt-6 border-s-2 border-ln">{p.updates.map((u) => (
                  <li key={u.id} className="relative pb-5 ps-6 last:pb-0"><span className="absolute -start-[9px] top-1 h-4 w-4 rounded-full border-2 border-bg bg-goldgrad" />
                    <p className="text-xs text-mu">{day(u.update_date, locale)}{u.completion_pct !== null ? ` · ${u.completion_pct}%` : ""}</p><b>{(locale === "ar" ? u.title_ar : null) ?? u.title_en}</b>
                    {((locale === "ar" ? u.body_ar : null) ?? u.body_en) && <p className="mt-1 text-sm text-mu">{(locale === "ar" ? u.body_ar : null) ?? u.body_en}</p>}</li>))}</ol> : <p className="mt-4 text-sm text-mu">{t("pub.updatesNone")}</p>}</div></section>

            {p.lat !== null && p.lng !== null && <section><h2 className={h2}>{t("pub.location")}</h2>
              <MapLoader className="mt-4 h-[360px]" pins={[{ id: p.id, lat: Number(p.lat), lng: Number(p.lng), label: p.starting_price ? short(Number(p.starting_price)) : "", title: tr.name, area, price: p.starting_price ? formatMoney(Number(p.starting_price), cur, locale) : "", href: `/projects/${tr.slug}`, seed }]} /></section>}
          </div>
          <aside className="min-w-0"><div className={`${box} lg:sticky lg:top-24`}><ProjectEnquiry projectId={p.id} locale={locale} /></div></aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

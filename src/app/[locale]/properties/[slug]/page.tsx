import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { Footer } from "@/components/Footer";
import { Gallery, type Slide } from "@/components/Gallery";
import { BookingBox } from "@/components/BookingBox";
import { MortgageCalc } from "@/components/MortgageCalc";
import { MapLoader } from "@/components/MapLoader";
import { PropertyActionBar } from "@/components/PropertyActionBar";
import { ListingCard } from "@/components/ListingCard";
import { SaveLabelButton, ShareButton } from "@/components/CardActions";
import { seedOf } from "@/components/Art";
import { Tag } from "@/components/ui/Tag";
import { formatMoney } from "@/lib/money";
import { formatDate, formatNumber } from "@/lib/format";
import { SITE_URL, hreflang } from "@/lib/seo";
import { getPropertyBySlug, getSimilar, mediaUrl, pick, rowFromDetail, type PropertyDetail } from "@/lib/data";

export const revalidate = 300;
/** Pages are built on first visit, then cached and refreshed every 5 minutes. */
export async function generateStaticParams() { return []; }
type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(locale: string, slug: string) {
  const r = await getPropertyBySlug(locale, decodeURIComponent(slug));
  if (!r) notFound();
  if ("redirectTo" in r) redirect({ href: `/properties/${r.redirectTo}`, locale }); // old slug: send people (and Google) to the new URL
  return (r as { detail: PropertyDetail }).detail;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const r = await getPropertyBySlug(locale, decodeURIComponent(slug));
  if (!r || "redirectTo" in r) return {};
  const { translation: tr, property } = r.detail;
  const slugs = Object.fromEntries(property.property_translations.map((x) => [x.locale, x.slug]));
  const path = (l: string) => (slugs[l] ? `/${l}/properties/${slugs[l]}` : undefined);
  const description = tr.meta_description ?? tr.description?.slice(0, 160) ?? undefined;
  const cover = property.property_media.find((m) => m.is_cover) ?? property.property_media[0];
  const image = tr.og_image_url ?? (cover ? mediaUrl(cover.path) : undefined);
  return { title: tr.meta_title ?? tr.title, description, alternates: { canonical: `${SITE_URL}/${locale}/properties/${tr.slug}`, languages: hreflang({ en: path("en"), ar: path("ar") }) },
    openGraph: { title: tr.meta_title ?? tr.title, description, images: image ? [image] : undefined, locale: locale === "ar" ? "ar_AE" : "en_AE", type: "website" } };
}

export default async function PropertyPage({ params }: Props) {
  const { locale, slug } = await params; setRequestLocale(locale);
  const d = await load(locale, slug), t = await getTranslations();
  const { translation: tr, property: p, listings, agent } = d;
  const listing = listings.find((l) => l.status === "published") ?? listings[0], rent = listing.purpose === "rent";
  const live = listing.status === "published" || listing.status === "reserved", offplan = p.completion_status === "off_plan";
  const area = pick(p.area?.area_translations, locale)?.name ?? "", other = locale === "ar" ? "en" : "ar";
  const otherSlug = p.property_translations.find((x) => x.locale === other)?.slug;
  const media = p.property_media.filter((m) => !m.kind || m.kind === "image").sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  const seed = seedOf(p.id);
  const slides: Slide[] = media.length ? media.map((m) => ({ src: mediaUrl(m.path), alt: (locale === "ar" ? m.alt_ar : m.alt_en) ?? tr.title, seed })) : [0, 1, 2, 3, 4].map(() => ({ alt: tr.title, seed }));
  const amenities = p.property_amenities.map((x) => x.amenity).filter(Boolean) as { code: string; name_en: string; name_ar: string }[];
  const price = formatMoney(listing.price, listing.currency, locale), period = rent && listing.price_period ? ` ${t(`period.${listing.price_period}` as "period.yearly")}` : "";
  const ppsf = !rent && p.size_sqft && listing.currency === "AED" ? Math.round(listing.price / p.size_sqft) : 0;
  const delta = ppsf && d.areaAvgPpsf ? Math.round((ppsf / d.areaAvgPpsf - 1) * 100) : null;
  const sim = await getSimilar(rowFromDetail(d), locale);
  const tabs = t.raw("v2.x.tabs") as string[], kf = t.raw("v2.x.kf") as string[], nb = t.raw("v2.x.nb") as [string, string][];
  const sq = p.size_sqft ? `${formatNumber(Math.round(p.size_sqft), locale)} ${t("prop.sqft")}` : null;
  const beds = p.bedrooms !== null ? t("prop.beds", { n: p.bedrooms }) : null;
  const facts: [string, string | number | null | undefined][] = [
    [t("prop.ref"), p.reference_code], [t("prop.type"), t(`types.${p.type}` as "types.villa")], [t("prop.bedrooms"), p.bedrooms === 0 ? t("prop.studio") : p.bedrooms], [t("prop.bathrooms"), p.bathrooms],
    [t("prop.size"), sq], [t("prop.plot"), p.plot_sqft ? `${formatNumber(Math.round(p.plot_sqft), locale)} ${t("prop.sqft")}` : null], [t("prop.floor"), p.floor_number], [t("prop.parking"), p.parking_spaces],
    [t("prop.furnishing"), p.furnishing ? t(`prop.${p.furnishing}` as "prop.furnished") : null], [t("prop.view"), p.view_type], [t("prop.building"), p.building_name], [t("prop.year"), p.year_built],
    [t("prop.completion"), t(`prop.${p.completion_status}` as "prop.ready")], [t("prop.permit"), listing.permit_number],
  ];
  const jsonLd = { "@context": "https://schema.org", "@type": "RealEstateListing", name: tr.title, description: tr.description ?? undefined, url: `${SITE_URL}/${locale}/properties/${tr.slug}`, datePosted: listing.published_at ?? undefined,
    image: media.slice(0, 5).map((m) => mediaUrl(m.path)), offers: { "@type": "Offer", price: listing.price, priceCurrency: listing.currency, availability: live ? "https://schema.org/InStock" : "https://schema.org/SoldOut" },
    about: { "@type": "Residence", numberOfBedrooms: p.bedrooms ?? undefined, numberOfBathroomsTotal: p.bathrooms ?? undefined, floorSize: p.size_sqft ? { "@type": "QuantitativeValue", value: p.size_sqft, unitCode: "FTK" } : undefined, address: { "@type": "PostalAddress", addressLocality: area, addressCountry: "AE" } } };
  const h2 = "mb-4 text-[28px]", sec = "scroll-mt-40 pt-10";
  const agentName = agent ? (locale === "ar" ? agent.display_name_ar ?? agent.display_name_en : agent.display_name_en) : "";

  return (
    <>
      <Header locale={locale} switchHref={otherSlug ? `/properties/${otherSlug}` : "/properties"} />
      <BreadcrumbLd locale={locale} crumbs={[{ key: "crumbProperties", path: "/properties" }, { label: tr.title, path: `/properties/${tr.slug}` }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="wrap pt-6 pb-24 md:pb-0">
        <nav aria-label="Breadcrumb" className="mb-3.5 text-[13px] text-mu"><Link href="/" className="underline">{t("prop.breadcrumbHome")}</Link> / <Link href={`/properties?purpose=${listing.purpose}`} className="underline">{t("list.title")}</Link>{area && <> / {area}</>}</nav>
        <Gallery slides={slides} />
        <nav aria-label="Sections" className="glass no-scrollbar sticky top-[84px] z-20 mt-5 flex w-max max-w-full gap-1.5 overflow-x-auto rounded-full p-1.5">
          {tabs.map((x, k) => <a key={x} href={`#s${k}`} className="whitespace-nowrap rounded-full px-[18px] py-2 text-sm font-semibold text-mu hover:bg-surf hover:text-tx">{x}</a>)}
        </nav>

        <div className="mt-2 grid items-start gap-9 lg:grid-cols-[1fr_380px]">
          <div>
            <section id="s0" className={sec}>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={listing.status === "published" ? "success" : listing.status === "reserved" ? "warning" : "danger"}>{t(`status.${listing.status}` as "status.published")}</Tag>
                <span className="text-mu">{area}</span><span className="flex-1" /><SaveLabelButton id={p.id} /><ShareButton />
              </div>
              <h1 className="mt-3.5 text-[clamp(32px,5vw,58px)]">{tr.title}</h1>
              <p className="mt-2.5 text-[clamp(26px,3.6vw,38px)] font-bold tracking-tight"><span className="gt">{price}</span><small className="text-base font-medium text-mu">{period}</small></p>
              {!live && <p className="mt-4 rounded-lg border border-warning p-4">{t("prop.unavailable")}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{[[kf[0], beds ?? "–"], [kf[1], p.bathrooms !== null ? t("prop.baths", { n: p.bathrooms }) : "–"], [kf[2], sq ?? "–"], [kf[3], t(`types.${p.type}` as "types.villa")]].map(([k, v]) => <div key={k} className="rounded-lg bg-surf px-[18px] py-4"><dt className="text-xs text-mu">{k}</dt><dd className="text-[17px] font-bold tracking-tight">{v}</dd></div>)}</dl>
              {ppsf > 0 && (
                <div className="mt-5 rounded-lg bg-surf p-5"><div className="flex flex-wrap justify-between gap-2"><span>{t("v2.x.pf")}: <b>AED {formatNumber(ppsf, locale)}</b></span>
                  {delta !== null && <span className={`font-semibold ${delta <= 0 ? "text-success" : "text-warning"}`}>{Math.abs(delta)}% {delta <= 0 ? t("v2.x.ba") : t("v2.x.aa")}</span>}</div>
                  {delta !== null && <div className="relative mt-4 h-2 rounded-full bg-ln"><i className="absolute -top-1 h-4 w-4 rounded-full border-[3px] border-bg bg-goldgrad shadow" style={{ insetInlineStart: `${Math.max(4, Math.min(92, 50 + delta * 2.5))}%` }} /></div>}</div>)}
              {tr.description && <p className="mt-6 max-w-[62ch] whitespace-pre-line text-mu">{tr.description}</p>}
            </section>
            <section id="s1" className={sec}>
              <h2 className={h2}>{t("prop.details")}</h2>
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">{facts.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => <div key={k} className="rounded-lg bg-surf p-4"><dt className="text-xs text-mu">{k}</dt><dd className="font-bold tracking-tight">{v}</dd></div>)}</dl>
              {amenities.length > 0 && <ul className="mt-6 grid grid-cols-2 gap-2.5 text-sm sm:grid-cols-3">{amenities.map((a) => <li key={a.code}><span className="text-ac" aria-hidden>◆</span> {locale === "ar" ? a.name_ar : a.name_en}</li>)}</ul>}
              <p className="mt-6 text-[13px] text-mu">{t("prop.updated")}: {formatDate(listing.updated_at, locale)}</p>
            </section>
            <section id="s2" className={sec}>
              <h2 className={h2}>{tabs[2]}</h2>
              {p.lat && p.lng ? <MapLoader className="h-[340px]" pins={[{ id: p.id, lat: p.lat, lng: p.lng, label: area || "•", title: tr.title, area, price, href: `/properties/${tr.slug}`, seed }]} /> : null}
              <h3 className="mb-0 mt-5 text-[13px] font-semibold tracking-normal text-mu">{t("v2.x.nr2")}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">{nb.map(([n, m]) => <div key={n} className="rounded-lg bg-surf p-3.5 text-center"><b className="block text-xl tracking-tight">{m}</b><span className="text-xs text-mu">{n}</span></div>)}</div>
            </section>
            <section id="s3" className={sec}>
              <h2 className={h2}>{offplan ? t("v2.x.pay") : !rent ? t("v2.x.mort") : tabs[3]}</h2>
              {offplan && d.plan ? (
                <div className="rounded-lg bg-surf p-7"><div className="flex h-[18px] gap-1.5 overflow-hidden rounded-full">{d.plan.map((s, i) => <i key={i} style={{ flex: s.percentage, background: ["#C9A66B", "#0B0D0E", "#2C5364", "#7A6238"][i % 4] }} />)}</div>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">{d.plan.map((s) => <div key={s.label_en}><b className="block text-[clamp(26px,4vw,40px)] tracking-tight">{s.percentage}%</b><span className="text-sm text-mu">{locale === "ar" ? s.label_ar ?? s.label_en : s.label_en}</span></div>)}</div></div>
              ) : !rent ? <MortgageCalc price={listing.price} currency={listing.currency} />
                : <p className="text-mu">{listing.cheques ? t("prop.cheques", { n: listing.cheques }) : ""} {t("v2.x.ri")}</p>}
            </section>
          </div>

          <aside className="grid gap-4 lg:sticky lg:top-40 lg:self-start">
            <BookingBox listingId={listing.id} intent={rent ? "rent" : "buy"} locale={locale} whatsapp={agent?.whatsapp} phone={agent?.public_phone} />
            {agent && (
              <div className="flex items-center gap-3.5 rounded-lg border border-ln p-5">
                {agent.photo_url ? <Image src={agent.photo_url} alt="" width={54} height={54} className="h-[54px] w-[54px] rounded-full object-cover" /> : <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-goldgrad font-bold text-[#1a1409]">{agentName[0]}</span>}
                <div><b className="block">{agentName}</b><span className="text-[13px] text-mu">{locale === "ar" ? agent.title_ar : agent.title_en}{agent.license_number ? ` · ${t("prop.license")} ${agent.license_number}` : ""}</span></div>
              </div>)}
          </aside>
        </div>

        {sim.length > 0 && <section className="pt-16"><h2 className="text-[clamp(28px,4vw,44px)]">{t("v2.x.sim")}</h2><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{sim.map((l) => <ListingCard key={l.id} l={l} locale={locale} />)}</div></section>}
      </main>
      <PropertyActionBar whatsapp={agent?.whatsapp} phone={agent?.public_phone} />
      <Footer />
    </>
  );
}

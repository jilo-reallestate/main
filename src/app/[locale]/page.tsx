import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { COMPANY } from "@/lib/company";
import { SITE_URL, hreflang } from "@/lib/seo";
import { Link } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import { HeroSearch } from "@/components/HeroSearch";
import { ListingCard } from "@/components/ListingCard";
import { Counter } from "@/components/Counter";
import { Reveal } from "@/components/Reveal";
import { MapLoader, type Pin } from "@/components/MapLoader";
import { seedOf } from "@/components/Art";
import { btn } from "@/components/ui/Button";
import { getAreas, getFeatured, pick } from "@/lib/data";
import { formatMoney, short } from "@/lib/money";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params, t = await getTranslations({ locale, namespace: "seo" });
  return { title: { absolute: t("homeTitle") }, description: t("homeDesc"), keywords: t("keywords").split(",").map((k) => k.trim()),
    alternates: { canonical: `${SITE_URL}/${locale}`, languages: hreflang({ en: "/en", ar: "/ar" }) },
    openGraph: { title: t("homeTitle"), description: t("homeDesc"), url: `${SITE_URL}/${locale}`, locale: locale === "ar" ? "ar_AE" : "en_AE", type: "website" } };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [areas, featured] = await Promise.all([getAreas(locale), getFeatured(locale, 5)]);
  const counters = t.raw("v2.x.cn") as [number, string, string][];
  const h = t.raw("v2.h") as string[];
  const reviews = t.raw("v2.x.rv") as [string, string, string][];
  const why = t.raw("v2.why3") as [string, string][];
  const pins: Pin[] = featured.filter((l) => l.property.lat && l.property.lng).map((l) => {
    const tr = pick(l.property.property_translations, locale);
    return { id: l.property.id, lat: l.property.lat!, lng: l.property.lng!, label: short(l.price), title: tr?.title ?? "", area: pick(l.property.area?.area_translations, locale)?.name ?? "", price: formatMoney(l.price, l.currency, locale), href: `/properties/${tr?.slug}`, seed: seedOf(l.property.id) };
  });
  const names = areas.map((a) => a.name);

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "RealEstateAgent", "@id": `${SITE_URL}/#organization`, name: COMPANY.name, legalName: COMPANY.legalName || undefined, url: `${SITE_URL}/${locale}`,
        description: t("seo.orgDesc"), telephone: COMPANY.phone || undefined, email: COMPANY.email || undefined, identifier: COMPANY.license || undefined,
        address: { "@type": "PostalAddress", streetAddress: COMPANY.street || undefined, addressLocality: COMPANY.city, addressCountry: "AE" },
        areaServed: ["Dubai", "Abu Dhabi", "United Arab Emirates"], knowsAbout: ["Off-plan property", "Apartments for sale", "Villas for sale", "Property rentals"],
        availableLanguage: ["English", "Arabic"], sameAs: COMPANY.social.length ? COMPANY.social : undefined }} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: COMPANY.name, url: `${SITE_URL}/${locale}`, inLanguage: locale === "ar" ? "ar-AE" : "en-AE", publisher: { "@id": `${SITE_URL}/#organization` } }} />
      <Header locale={locale} />
      <section className="relative -mt-[86px] flex min-h-[clamp(620px,88vh,820px)] items-end overflow-hidden rounded-b-[48px] bg-[#07090a] text-white">
        <Image src="/hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[70%_center] rtl:object-[30%_center]" />
        {/* darkens the text side only; the other side of the photo stays clear */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent rtl:bg-gradient-to-l" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />
        <div className="wrap relative z-10 pb-14 pt-40">
          <div className="max-w-[820px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium backdrop-blur before:h-[7px] before:w-[7px] before:rounded-full before:bg-success before:shadow-[0_0_0_4px_rgba(31,157,97,.25)]">{t("v2.kick")}</span>
            <h1 className="mt-5 text-[clamp(32px,4.2vw,56px)] font-semibold leading-[1.08] tracking-[-.025em] rtl:leading-[1.3] rtl:tracking-normal">{h[0]} <span className="gt">{h[1]}</span></h1>
            <p className="mt-4 max-w-[500px] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-white/80">{t("v2.sub")}</p>
            <HeroSearch areas={areas} />
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-b border-ln py-6"><div className="flex w-max animate-marquee gap-12 rtl:[animation-direction:reverse]">{[...names, ...names].map((n, i) => <i key={i} className={`whitespace-nowrap text-[clamp(22px,3.4vw,38px)] font-bold not-italic tracking-tight ${i % 2 ? "text-gold-3" : "text-mu"}`}>{n}</i>)}</div></div>

      <div className="wrap">
        <Reveal className="grid grid-cols-2 gap-5 pt-16 md:grid-cols-4">{counters.map(([n, s, l]) => <div key={l}><Counter to={n} suffix={s} /><span className="mt-2 block text-sm text-mu">{l}</span></div>)}</Reveal>

        <Reveal as="section" className="pt-[clamp(48px,8vw,96px)]">
          <div className="eyebrow">{t("v2.x.ey1")}</div>
          <h2 className="mt-3.5 text-[clamp(32px,5.5vw,60px)]">{t("v2.feat")}</h2>
          <p className="mt-3 max-w-[520px] text-mu">{t("v2.featS")}</p>
          {featured.length ? <div className="mt-8 grid auto-rows-auto gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map((l, i) => <ListingCard key={l.id} l={l} locale={locale} big={i === 0} priority={i < 3} />)}</div>
            : <p className="mt-8 text-mu">{t("featured.empty")}</p>}
          <p className="mt-8"><Link href="/properties" className={btn("outline")}>{t("v2.all")} →</Link></p>
        </Reveal>
      </div>

      {pins.length > 0 && (
        <Reveal as="section" className="dark-panel relative mx-2.5 mt-[clamp(48px,8vw,96px)] overflow-hidden rounded-2xl p-[clamp(24px,5vw,64px)]">
          <div className="eyebrow !text-gold-1">{t("v2.x.ey2")}</div>
          <h2 className="mt-3.5 max-w-[14ch] text-[clamp(32px,5.5vw,60px)]">{t("v2.x.m2")}</h2>
          <p className="mt-2.5 text-[#A9AFB4]">{t("v2.x.ms")}</p>
          <div className="mt-8"><MapLoader pins={pins} className="h-[clamp(320px,50vw,520px)]" /></div>
        </Reveal>)}

      <div className="wrap">
        <Reveal as="section" className="pt-[clamp(48px,8vw,96px)]">
          <div className="eyebrow">{t("v2.x.ey3")}</div>
          <h2 className="mt-3.5 text-[clamp(32px,5.5vw,60px)]">{t("v2.why")}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">{why.map(([h, d], i) => <div key={h} className="rounded-lg bg-surf p-7"><span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-goldgrad font-extrabold text-[#1a1409]">{["✓", "⚡", "ع"][i]}</span><b className="mb-1.5 block text-lg">{h}</b><span className="text-mu">{d}</span></div>)}</div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">{reviews.map(([q, n, m]) => <figure key={n} className="rounded-lg bg-surf p-7"><span className="tracking-[3px] text-gold-3" aria-label="5/5">★★★★★</span><blockquote className="my-3.5 text-[17px]">{q}</blockquote><figcaption><b>{n}</b><br /><small className="text-mu">{m}</small></figcaption></figure>)}</div>
        </Reveal>
      </div>

      <Reveal as="section" className="mx-2.5 mt-[clamp(48px,8vw,96px)] rounded-2xl bg-goldgrad px-6 py-[clamp(40px,7vw,90px)] text-center text-[#1a1409]">
        <h2 className="mx-auto max-w-[14ch] text-[clamp(34px,6.5vw,72px)]">{t("v2.cta")}</h2>
        <Link href="/properties" className="mt-7 inline-flex min-h-[46px] items-center rounded-full bg-[#0B0D0E] px-7 font-semibold text-white">{t("v2.cta2")} →</Link>
      </Reveal>
      <Footer />
    </>
  );
}

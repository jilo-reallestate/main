import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { Counter } from "@/components/Counter";
import { Art } from "@/components/Art";
import { btn } from "@/components/ui/Button";
import { SITE_URL, hreflang } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: "v2.x" });
  return { title: t("fo"), alternates: { canonical: `${SITE_URL}/${locale}/about`, languages: hreflang({ en: "/en/about", ar: "/ar/about" }) } };
}

/** Founder story page. ALL copy here is placeholder (see messages v2.x.f): replace with the client's real story, photo and team. */
export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations("v2.x"), cta = (await getTranslations("v2"))("cta2");
  const ms = t.raw("f.ms") as string[][], vl = t.raw("f.vl") as string[][], tm = t.raw("f.tm") as string[][], cn = t.raw("cn") as [number, string, string][];
  return (
    <>
      <Header locale={locale} switchHref="/about" />
      <main className="wrap pb-24 md:pb-0">
        <div className="grid items-center gap-[clamp(24px,5vw,72px)] pt-12 md:grid-cols-[5fr_6fr]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl max-md:aspect-square"><Art seed={3} h={500} className="absolute inset-0 [&_svg]:h-full [&_svg]:w-full" />
            <span className="absolute inset-0 grid place-items-center text-[clamp(80px,14vw,170px)] font-extrabold tracking-[-.05em] text-white/90">{locale === "ar" ? "م" : "MN"}</span>
            <small className="absolute bottom-4 start-4 rounded-full bg-white/20 px-3.5 py-1.5 text-xs text-white backdrop-blur-md">{t("f.ph")}</small></div>
          <div><div className="eyebrow">{t("fo")}</div>
            <p className="mt-5 text-[clamp(26px,4.4vw,54px)] font-bold leading-[1.1] tracking-[-.04em] rtl:leading-normal rtl:tracking-normal">“{t("f.q")}”</p>
            <p className="mt-6"><b className="text-lg">{t("f.nm")}</b><br /><span className="text-mu">{t("f.rl")}</span></p></div>
        </div>
        <Reveal as="section" className="pt-[clamp(48px,8vw,96px)]"><div className="eyebrow">{t("f.e2")}</div><h2 className="mt-3.5 text-[clamp(32px,5.5vw,60px)]">{t("f.t2")}</h2><p className="mt-3 text-mu">{t("f.s2")}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{ms.map(([y, h, d]) => <div key={h} className="rounded-lg bg-surf p-6"><em className="mb-3 block text-[13px] font-bold not-italic text-ac">{y}</em><b className="mb-1.5 block text-[22px] tracking-tight">{h}</b><span className="text-sm text-mu">{d}</span></div>)}</div></Reveal>
      </main>
      <Reveal as="section" className="dark-panel mx-2.5 mt-[clamp(48px,8vw,96px)] rounded-2xl p-[clamp(24px,5vw,64px)]"><div className="eyebrow !text-gold-1">JILO</div><h2 className="mt-3.5 max-w-[16ch] text-[clamp(32px,5.5vw,60px)]">{t("f.t3")}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">{vl.map(([ic, h, d]) => <div key={h} className="rounded-lg border border-white/10 bg-white/5 p-7"><span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-goldgrad font-extrabold text-[#1a1409]">{ic}</span><b className="mb-1.5 block text-lg">{h}</b><span className="text-[#A9AFB4]">{d}</span></div>)}</div></Reveal>
      <div className="wrap">
        <Reveal className="grid grid-cols-2 gap-5 pt-16 md:grid-cols-4">{cn.map(([n, s, l]) => <div key={l}><Counter to={n} suffix={s} /><span className="mt-2 block text-sm text-mu">{l}</span></div>)}</Reveal>
        <Reveal as="section" className="pt-[clamp(48px,8vw,96px)]"><div className="eyebrow">{t("f.e4")}</div><h2 className="mt-3.5 text-[clamp(32px,5.5vw,60px)]">{t("f.t4")}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">{tm.map(([n, r, l], i) => <div key={i} className="rounded-xl bg-surf p-8 text-center"><span className="mx-auto mb-4 grid h-[88px] w-[88px] place-items-center rounded-full bg-goldgrad text-2xl font-bold text-[#1a1409]">{n[0]}</span><b className="block text-[19px]">{n}</b><span className="block text-sm text-mu">{r}</span><span className="mt-1 block text-sm text-mu">{l}</span></div>)}</div></Reveal>
      </div>
      <Reveal as="section" className="mx-2.5 mt-[clamp(48px,8vw,96px)] rounded-2xl bg-goldgrad px-6 py-[clamp(40px,7vw,90px)] text-center text-[#1a1409]"><h2 className="mx-auto max-w-[14ch] text-[clamp(34px,6.5vw,72px)]">{t("f.cta")}</h2><Link href="/properties" className={btn("primary", false, "mt-7 !bg-[#0B0D0E] !text-white")}>{cta} →</Link></Reveal>
      <Footer />
    </>
  );
}

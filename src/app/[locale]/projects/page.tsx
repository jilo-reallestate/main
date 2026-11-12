import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/Header";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { Footer } from "@/components/Footer";
import { ProjectCard } from "@/components/ProjectCard";
import { Link } from "@/i18n/routing";
import { btn } from "@/components/ui/Button";
import { fieldCls } from "@/components/ui/Input";
import { SITE_URL, hreflang } from "@/lib/seo";
import { getAreas } from "@/lib/data";
import { projectFilterOptions, searchProjects } from "@/lib/projects-data";

export const revalidate = 300;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params, sp = await searchParams, t = await getTranslations({ locale, namespace: "op.pub" });
  const filtered = ["area", "developer", "year", "maxPrice"].some((k) => first(sp[k]));
  return { title: t("title"), description: t("metaDesc"), robots: filtered ? { index: false, follow: true } : undefined,
    alternates: { canonical: `${SITE_URL}/${locale}/projects`, languages: hreflang({ en: "/en/projects", ar: "/ar/projects" }) } };
}

export default async function ProjectsPage({ params, searchParams }: Props) {
  const { locale } = await params, sp = await searchParams; setRequestLocale(locale);
  const t = await getTranslations("op.pub");
  const f = { area: first(sp.area), developer: first(sp.developer), year: Number(first(sp.year)) || undefined, maxPrice: Number(first(sp.maxPrice)) || undefined };
  const [projects, areas, opts] = await Promise.all([searchProjects(f, locale), getAreas(locale), projectFilterOptions()]);
  const filtered = !!(f.area || f.developer || f.year || f.maxPrice);
  return (
    <>
      <Header locale={locale} switchHref="/projects" />
      <BreadcrumbLd locale={locale} crumbs={[{ key: "crumbProjects", path: "/projects" }]} />
      <main className="wrap pb-20 pt-10">
        <h1 className="text-4xl font-semibold md:text-5xl">{t("heading")}</h1>
        <p className="mt-3 max-w-2xl text-mu">{t("sub")}</p>
        <form method="get" className="mt-8 grid gap-3 rounded-lg bg-surf p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <label className="grid gap-1 text-sm"><span className="label">{t("area")}</span><select name="area" defaultValue={f.area ?? ""} className={fieldCls}><option value="">{t("any")}</option>{areas.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm"><span className="label">{t("developer")}</span><select name="developer" defaultValue={f.developer ?? ""} className={fieldCls}><option value="">{t("any")}</option>{opts.developers.map((d) => <option key={d.id} value={d.id}>{(locale === "ar" ? d.name_ar : null) ?? d.name_en}</option>)}</select></label>
          <label className="grid gap-1 text-sm"><span className="label">{t("handover")}</span><select name="year" defaultValue={f.year ? String(f.year) : ""} className={fieldCls}><option value="">{t("any")}</option>{opts.years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
          <label className="grid gap-1 text-sm"><span className="label">{t("maxPrice")}</span><input name="maxPrice" type="number" min={0} step={50000} defaultValue={f.maxPrice ?? ""} dir="ltr" className={fieldCls} /></label>
          <div className="flex gap-2"><button className={btn("primary", false, "flex-1")}>{t("apply")}</button>{filtered && <Link href="/projects" className={btn("outline")}>{t("reset")}</Link>}</div>
        </form>
        <p className="mt-6 text-sm text-mu">{t("results", { n: projects.length })}</p>
        {projects.length ? <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} p={p} locale={locale} />)}</div> : <p className="mt-4 rounded-lg bg-surf p-10 text-center text-mu">{t("noResults")}</p>}
      </main>
      <Footer />
    </>
  );
}

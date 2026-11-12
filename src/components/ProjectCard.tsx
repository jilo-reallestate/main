import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Art, seedOf } from "@/components/Art";
import { mediaUrl, pick } from "@/lib/data";
import { formatMoney, type Currency } from "@/lib/money";
import type { ProjectCard as P } from "@/lib/projects-data";

const month = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

export function ProjectCard({ p, locale }: { p: P; locale: string }) {
  const t = useTranslations("op"), tr = pick(p.project_translations, locale)!;
  const cover = [...p.project_media].filter((m) => !m.kind || m.kind === "image").sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
  const dev = p.developer ? ((locale === "ar" ? p.developer.name_ar : null) ?? p.developer.name_en) : null, area = pick(p.area?.area_translations, locale)?.name;
  return (
    <Link href={`/projects/${tr.slug}`} className="group block overflow-hidden rounded-lg bg-surf transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-bg">
        {cover ? <Image src={mediaUrl(cover.path, "project-media")} alt={tr.name} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" /> : <Art seed={seedOf(p.id)} h={300} className="h-full w-full" />}
        <span className="absolute start-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-black">{t(`pstat.${p.status}` as "pstat.upcoming")}</span>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-semibold">{tr.name}</h3>
        <p className="mt-1 text-sm text-mu">{[dev, area].filter(Boolean).join(" · ")}</p>
        {tr.tagline && <p className="mt-2 line-clamp-2 text-sm">{tr.tagline}</p>}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
          <b className="text-lg">{p.starting_price ? t("pub.from", { p: formatMoney(p.starting_price, p.currency as Currency, locale) }) : "—"}</b>
          {p.handover_date && <span className="text-sm text-mu">{t("pub.handoverAt", { d: month(p.handover_date, locale) })}</span>}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={p.completion_pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("pub.progress")}><span className="block h-full bg-goldgrad" style={{ width: `${p.completion_pct}%` }} /></div>
      </div>
    </Link>
  );
}

import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, type Currency } from "@/lib/money";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
type P = { id: string; code: string; status: string; is_published: boolean; handover_date: string | null; completion_pct: number; starting_price: number | null; currency: Currency;
  developer: { name_en: string; name_ar: string | null } | null; project_translations: { locale: string; name: string }[] };

export default async function ProjectsAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("op"), sb = await createClient();
  const [{ data: ps }, { data: us }] = await Promise.all([
    sb.from("projects").select("id, code, status, is_published, handover_date, completion_pct, starting_price, currency, developer:developers(name_en, name_ar), project_translations(locale, name)").order("created_at", { ascending: false }),
    sb.from("units").select("project_id, status").limit(20000),
  ]);
  const count = new Map<string, { a: number; n: number }>();
  (us ?? []).forEach((u) => { const c = count.get(u.project_id as string) ?? { a: 0, n: 0 }; c.n++; if (u.status === "available") c.a++; count.set(u.project_id as string, c); });
  const rows = (ps ?? []) as unknown as P[];
  return (
    <DashboardShell profile={me} locale={locale} active="projects">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{t("proj.title")}</h2><Link href="/admin/projects/new" className={btn("gold", true)}>+ {t("proj.new")}</Link></div>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("c.none")}</p> : (
        <div className="overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[760px] text-sm">
          <thead><tr>{[t("c.project"), t("proj.developer"), t("proj.status"), t("proj.handover"), t("proj.units"), ""].map((h, i) => <th key={i} className="p-4 text-start text-xs font-semibold text-mu">{h}</th>)}</tr></thead>
          <tbody>{rows.map((p) => { const c = count.get(p.id) ?? { a: 0, n: 0 }, name = (p.project_translations.find((x) => x.locale === locale) ?? p.project_translations[0])?.name ?? p.code;
            return (
              <tr key={p.id} className="border-t border-ln align-middle">
                <td className="p-4"><b>{name}</b><br /><span className="text-xs text-mu" dir="ltr">{p.code}</span> <span className={clsx("ms-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", p.is_published ? "bg-success/10 text-success" : "bg-surf text-mu")}>{p.is_published ? t("c.published") : t("c.draft")}</span></td>
                <td className="p-4 text-mu">{(locale === "ar" ? p.developer?.name_ar : null) ?? p.developer?.name_en ?? "—"}</td>
                <td className="p-4">{t(`pstat.${p.status}` as "pstat.upcoming")} · {p.completion_pct}%</td>
                <td className="p-4 text-mu" dir="ltr">{p.handover_date ?? "—"}</td>
                <td className="p-4">{t("c.unit")}: {c.n} · {t("proj.available", { n: c.a })}{p.starting_price ? <><br /><span className="text-xs text-mu">{t("proj.from")} {formatMoney(p.starting_price, p.currency, locale)}</span></> : null}</td>
                <td className="p-4"><div className="flex flex-wrap justify-end gap-1.5"><Link href={`/admin/projects/${p.id}`} className={btn("outline", true)}>{t("c.edit")}</Link><Link href={`/admin/projects/${p.id}/units`} className={btn("ghost", true)}>{t("proj.manageUnits")}</Link></div></td>
              </tr>); })}</tbody></table></div>)}
    </DashboardShell>
  );
}

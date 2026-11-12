import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
type P = { id: string; name_en: string; name_ar: string | null; is_active: boolean; project_id: string | null; project: { project_translations: { locale: string; name: string }[] } | null; payment_plan_milestones: { percentage: number; label_en: string }[] };

export default async function PlansAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("op"), sb = await createClient();
  const [{ data: ps }, { data: us }] = await Promise.all([
    sb.from("payment_plans").select("id, name_en, name_ar, is_active, project_id, project:projects(project_translations(locale, name)), payment_plan_milestones(percentage, label_en)").order("created_at", { ascending: false }),
    sb.from("units").select("payment_plan_id").not("payment_plan_id", "is", null).limit(20000),
  ]);
  const used = (id: string) => (us ?? []).filter((u) => u.payment_plan_id === id).length;
  const rows = (ps ?? []) as unknown as P[];
  return (
    <DashboardShell profile={me} locale={locale} active="plans">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{t("plan.title")}</h2><Link href="/admin/payment-plans/new" className={btn("gold", true)}>+ {t("plan.new")}</Link></div>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("c.none")}</p> : (
        <ul className="divide-y divide-ln rounded-lg bg-surf">{rows.map((p) => {
          const split = p.payment_plan_milestones.map((m) => Number(m.percentage)).join(" / "), pn = (p.project?.project_translations.find((x) => x.locale === locale) ?? p.project?.project_translations[0])?.name;
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span><b>{(locale === "ar" ? p.name_ar : null) ?? p.name_en}</b> <span className="text-mu" dir="ltr">· {split}</span><br /><span className="text-xs text-mu">{pn ?? t("plan.template")} · {t("plan.used", { n: used(p.id) })}{p.is_active ? "" : ` · ${t("c.draft")}`}</span></span>
              <Link href={`/admin/payment-plans/${p.id}`} className={btn("outline", true)}>{t("c.edit")}</Link></li>); })}</ul>)}
    </DashboardShell>
  );
}

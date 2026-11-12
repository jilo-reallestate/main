import clsx from "clsx";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { OpForm } from "@/components/OpForm";
import { UnitImporter } from "@/components/UnitImporter";
import { addUnitAction, assignPlanAction } from "@/actions/offplan";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";
import { btn } from "@/components/ui/Button";
import { fieldCls } from "@/components/ui/Input";

export const dynamic = "force-dynamic";
const TONE: Record<string, string> = { available: "bg-success/10 text-success", reserved: "bg-warning/15 text-warning", booked: "bg-info/10 text-info", sold: "bg-surf text-mu", blocked: "bg-surf text-mu" };
type U = { id: string; unit_number: string; unit_type: string | null; bedrooms: number | null; size_sqft: number | null; price: number; currency: Currency; status: string; payment_plan_id: string | null };

export default async function UnitsAdmin({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("op"), sb = await createClient();
  const [{ data: p }, { data: us }, { data: pl }] = await Promise.all([
    sb.from("projects").select("id, code, project_translations(locale, name)").eq("id", id).maybeSingle(),
    sb.from("units").select("id, unit_number, unit_type, bedrooms, size_sqft, price, currency, status, payment_plan_id").eq("project_id", id).order("unit_number").limit(3000),
    sb.from("payment_plans").select("id, name_en, name_ar, project_id").eq("is_active", true).or(`project_id.is.null,project_id.eq.${id}`).order("name_en"),
  ]);
  if (!p) notFound();
  const units = (us ?? []) as unknown as U[], plans = (pl ?? []) as { id: string; name_en: string; name_ar: string | null }[];
  const planName = (pid: string | null) => { const x = plans.find((q) => q.id === pid); return x ? ((locale === "ar" ? x.name_ar : null) ?? x.name_en) : "—"; };
  const name = ((p.project_translations as { locale: string; name: string }[]).find((x) => x.locale === locale) ?? (p.project_translations as { name: string }[])[0])?.name ?? p.code;
  return (
    <DashboardShell profile={me} locale={locale} active="projects">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{name} · {t("unit.title")} <span className="text-base text-mu">({t("unit.count", { n: units.length })})</span></h2>
        <div className="flex gap-2"><Link href={`/admin/projects/${id}`} className={btn("ghost", true)}>← {t("c.back")}</Link><Link href="/admin/payment-plans" className={btn("outline", true)}>{t("nav.plans")}</Link></div></div>

      <div className="grid gap-8">
        <section className="rounded-lg bg-surf p-6">
          <h3 className="text-xl font-semibold">{t("unit.add")}</h3>
          <OpForm action={addUnitAction} submit={t("c.add")} okText={t("unit.added")} variant="gold" reset className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <input type="hidden" name="project_id" value={id} />
            <label className="grid gap-1 text-sm"><span className="label">{t("unit.number")} *</span><input name="unit_number" required className={fieldCls} dir="ltr" /></label>
            <label className="grid gap-1 text-sm"><span className="label">{t("unit.type")}</span><input name="unit_type" className={fieldCls} dir="ltr" /></label>
            <label className="grid gap-1 text-sm"><span className="label">{t("unit.beds")}</span><input name="bedrooms" type="number" min={0} className={fieldCls} dir="ltr" /></label>
            <label className="grid gap-1 text-sm"><span className="label">{t("unit.size")}</span><input name="size_sqft" inputMode="decimal" className={fieldCls} dir="ltr" /></label>
            <label className="grid gap-1 text-sm"><span className="label">{t("unit.price")} *</span><input name="price" inputMode="decimal" required className={fieldCls} dir="ltr" /></label>
            <label className="grid gap-1 text-sm"><span className="label">{t("unit.status")}</span><select name="status" defaultValue="available" className={fieldCls}>{["available", "blocked", "booked", "sold"].map((x) => <option key={x} value={x}>{t(`ustat.${x}` as "ustat.available")}</option>)}</select></label>
            <label className="grid gap-1 text-sm"><span className="label">{t("unit.plan")}</span><select name="plan_id" defaultValue="" className={fieldCls}><option value="">{t("unit.noPlan")}</option>{plans.map((x) => <option key={x.id} value={x.id}>{planName(x.id)}</option>)}</select></label>
          </OpForm>
        </section>

        <UnitImporter projectId={id} locale={locale} />

        <section>
          {!units.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("c.none")}</p> : (
            <OpForm action={assignPlanAction} submit={t("unit.assign")} okText={t("unit.assigned", { n: "{n}" })} variant="outline" small className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3"><select name="plan_id" defaultValue="" aria-label={t("unit.plan")} className={fieldCls + " !w-auto"}><option value="">{t("unit.noPlan")}</option>{plans.map((x) => <option key={x.id} value={x.id}>{planName(x.id)}</option>)}</select></div>
              <div className="overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[760px] text-sm">
                <thead><tr><th className="w-10 p-3" /><>{[t("unit.number"), t("unit.type"), t("unit.beds"), t("unit.size"), t("unit.price"), t("unit.status"), t("unit.plan")].map((h) => <th key={h} className="p-3 text-start text-xs font-semibold text-mu">{h}</th>)}</></tr></thead>
                <tbody>{units.map((u) => (
                  <tr key={u.id} className="border-t border-ln"><td className="p-3"><input type="checkbox" name="unit" value={u.id} aria-label={u.unit_number} className="h-4 w-4" /></td>
                    <td className="p-3 font-semibold" dir="ltr">{u.unit_number}</td><td className="p-3">{u.unit_type ?? "—"}</td><td className="p-3">{u.bedrooms ?? "—"}</td>
                    <td className="p-3">{u.size_sqft ? formatNumber(Math.round(u.size_sqft), locale) : "—"}</td><td className="p-3 whitespace-nowrap">{formatMoney(u.price, u.currency, locale)}</td>
                    <td className="p-3"><span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", TONE[u.status])}>{t(`ustat.${u.status}` as "ustat.available")}</span></td><td className="p-3 text-mu">{planName(u.payment_plan_id)}</td></tr>))}</tbody></table></div>
            </OpForm>)}
        </section>
      </div>
    </DashboardShell>
  );
}

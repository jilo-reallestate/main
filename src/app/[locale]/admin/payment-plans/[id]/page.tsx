import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { PlanBuilder, type PlanInit } from "@/components/PlanBuilder";
import { PlanTimeline } from "@/components/PlanTimeline";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
const s = (x: unknown) => (x === null || x === undefined ? "" : String(x));

export default async function PlanEdit({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("op"), sb = await createClient(), isNew = id === "new";
  const { data: pr } = await sb.from("projects").select("id, code, project_translations(locale, name)").order("created_at", { ascending: false });
  const projects = (pr ?? []).map((p) => ({ value: p.id as string, label: ((p.project_translations as { locale: string; name: string }[]).find((x) => x.locale === locale) ?? (p.project_translations as { name: string }[])[0])?.name ?? (p.code as string) }));
  let init: PlanInit = { project_id: "", name_en: "", name_ar: "", description_en: "", description_ar: "", is_active: true, milestones: [] };
  let ms: { sort_order: number; label_en: string; label_ar: string | null; percentage: number; trigger_type: string; due_offset_days: number | null; fixed_date: string | null; construction_stage: string | null }[] = [];
  if (!isNew) {
    const { data: p } = await sb.from("payment_plans").select("*, payment_plan_milestones(*)").eq("id", id).maybeSingle();
    if (!p) notFound();
    ms = [...(p.payment_plan_milestones as typeof ms)].sort((a, b) => a.sort_order - b.sort_order);
    init = { id: p.id, project_id: s(p.project_id), name_en: s(p.name_en), name_ar: s(p.name_ar), description_en: s(p.description_en), description_ar: s(p.description_ar), is_active: !!p.is_active,
      milestones: ms.map((m) => ({ label_en: s(m.label_en), label_ar: s(m.label_ar), percentage: s(m.percentage), trigger_type: m.trigger_type, due_offset_days: s(m.due_offset_days), fixed_date: s(m.fixed_date), construction_stage: s(m.construction_stage) })) };
  }
  return (
    <DashboardShell profile={me} locale={locale} active="plans">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl">{isNew ? t("plan.new") : t("plan.edit")}</h2><Link href="/admin/payment-plans" className={btn("ghost", true)}>← {t("c.back")}</Link></div>
      <PlanBuilder locale={locale} init={init} projects={projects} />
      {ms.length > 0 && <section className="mt-8 max-w-xl rounded-lg bg-surf p-6"><h3 className="mb-4 text-xl font-semibold">{t("plan.timeline")}</h3><PlanTimeline milestones={ms} locale={locale} /></section>}
    </DashboardShell>
  );
}

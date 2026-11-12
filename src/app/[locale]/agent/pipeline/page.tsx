import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { PipelineBoard, type BoardLead, type BoardStage } from "@/components/PipelineBoard";
import { btn } from "@/components/ui/Button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { short } from "@/lib/money";

export const dynamic = "force-dynamic";
type L = { id: string; created_at: string; intent: string; sla_due_at: string | null; first_response_at: string | null; budget_min: number | null; budget_max: number | null; budget_currency: string;
  assigned_agent_id: string | null; stage: { key: string } | null; contact: { full_name: string; phone: string | null } | null; source: { name_en: string; name_ar: string } | null; agent: { full_name: string | null } | null };

export default async function PipelinePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ agent?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const { agent } = await searchParams, me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("crm"), sb = await createClient();
  let q = sb.from("leads").select("id, created_at, intent, sla_due_at, first_response_at, budget_min, budget_max, budget_currency, assigned_agent_id, stage:pipeline_stages(key), contact:contacts(full_name, phone), source:lead_sources(name_en, name_ar), agent:profiles!assigned_agent_id(full_name)").order("created_at", { ascending: false }).limit(400);
  if (me.role !== "admin") q = q.eq("assigned_agent_id", me.id); else if (agent) q = q.eq("assigned_agent_id", agent);
  const [{ data: st }, { data: ls }, { data: ag }] = await Promise.all([
    sb.from("pipeline_stages").select("key, name_en, name_ar, color, is_won, is_lost").order("sort_order"), q,
    me.role === "admin" ? sb.from("agent_profiles").select("id, display_name_en").order("display_name_en") : Promise.resolve({ data: null }),
  ]);
  const stages: BoardStage[] = (st ?? []).map((s) => ({ key: s.key, name: locale === "ar" ? s.name_ar : s.name_en, color: s.color, won: s.is_won, lost: s.is_lost }));
  const now = Date.now();
  const leads: BoardLead[] = ((ls ?? []) as unknown as L[]).map((l) => ({
    id: l.id, name: l.contact?.full_name ?? "—", phone: l.contact?.phone ?? null, intent: l.intent, source: l.source ? (locale === "ar" ? l.source.name_ar : l.source.name_en) : "",
    budget: l.budget_max ? `${l.budget_min ? short(l.budget_min) + " – " : "≤ "}${short(l.budget_max)} ${l.budget_currency}` : "", createdAt: l.created_at, stage: l.stage?.key ?? "new",
    overdue: !l.first_response_at && !!l.sla_due_at && new Date(l.sla_due_at).getTime() < now, agent: me.role === "admin" ? l.agent?.full_name ?? t("board.unassigned") : null }));
  return (
    <DashboardShell profile={me} locale={locale} active="pipeline">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {me.role === "admin" && ag ? <nav className="flex flex-wrap gap-1.5"><Link href="/agent/pipeline" className={btn(!agent ? "primary" : "outline", true)}>{t("board.allAgents")}</Link>
          {(ag as { id: string; display_name_en: string }[]).map((a) => <Link key={a.id} href={`/agent/pipeline?agent=${a.id}`} className={btn(agent === a.id ? "primary" : "outline", true)}>{a.display_name_en}</Link>)}</nav> : <span />}
        <Link href="/agent/leads/new" className={btn("gold")}>＋ {t("board.newLead")}</Link>
      </div>
      <PipelineBoard stages={stages} initial={leads} />
    </DashboardShell>
  );
}

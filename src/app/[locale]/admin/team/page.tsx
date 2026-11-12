import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { InviteForm, PromoteForm } from "@/components/AdminForms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
type S = { agent_id: string; name: string; email: string; role: string; is_active: boolean; open_leads: number; new_leads_30d: number; won_30d: number; lost_30d: number; avg_response_min: number | null; deals_closed_30d: number; deal_value_aed_30d: number; commission_pending_aed: number; commission_paid_aed: number };

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("adm.team"), sb = await createClient();
  const { data } = await sb.rpc("admin_team_stats"); const rows = (data ?? []) as S[], n = (x: number | null) => formatNumber(Math.round(Number(x ?? 0)), locale);
  const th = ["name", "status", "open", "new30", "won", "win", "resp", "deals", "value", "pending", "paid"] as const;
  return (
    <DashboardShell profile={me} locale={locale} active="team">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl">{t("title")}</h2><span className="text-sm text-mu">{t("stats")}</span></div>
      <div className="overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[980px] text-sm">
        <thead><tr>{th.map((k) => <th key={k} className="p-4 text-start text-xs font-semibold text-mu">{t(`cols.${k}`)}</th>)}<th /></tr></thead>
        <tbody>{rows.map((r) => {
          const done = r.won_30d + r.lost_30d, win = done ? Math.round((100 * r.won_30d) / done) + "%" : "–";
          return (
            <tr key={r.agent_id} className={clsx("border-t border-ln", !r.is_active && "opacity-60")}>
              <td className="p-4"><b>{r.name}</b><br /><span className="text-xs text-mu" dir="ltr">{r.email}</span> <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold">{r.role === "admin" ? t("admin") : t("agent")}</span></td>
              <td className="p-4"><span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", r.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{r.is_active ? t("active") : t("inactive")}</span></td>
              <td className="p-4 font-semibold">{r.open_leads}</td><td className="p-4">{r.new_leads_30d}</td><td className="p-4">{r.won_30d}</td><td className="p-4">{win}</td>
              <td className={clsx("p-4", Number(r.avg_response_min) > 15 && "font-bold text-danger")}>{r.avg_response_min === null ? "–" : r.avg_response_min}</td>
              <td className="p-4">{r.deals_closed_30d}</td><td className="p-4 whitespace-nowrap">{n(r.deal_value_aed_30d)}</td><td className="p-4 whitespace-nowrap text-warning">{n(r.commission_pending_aed)}</td><td className="p-4 whitespace-nowrap text-success">{n(r.commission_paid_aed)}</td>
              <td className="p-4"><Link href={`/admin/team/${r.agent_id}`} className={btn("outline", true)}>{t("edit")}</Link></td>
            </tr>);
        })}</tbody></table></div>
      <div className="mt-8 grid items-start gap-5 md:grid-cols-2"><InviteForm locale={locale} /><PromoteForm /></div>
    </DashboardShell>
  );
}

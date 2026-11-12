import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/Button";
import { approveListing } from "@/actions/staff";
import { reassignLeadAction } from "@/actions/crm";
import { Link } from "@/i18n/routing";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";
import { installmentSelect, instName, type InstRow } from "@/lib/installments";

type Kpis = Record<"active_listings" | "open_leads" | "new_leads_30d" | "won_leads_30d" | "revenue_mtd_aed" | "overdue_rent_aed" | "leads_breaching_sla" | "leases_expiring_90d", number>;
type Pending = { id: string; purpose: string; price: number; currency: Currency; property: { reference_code: string; property_translations: { locale: string; title: string }[] } | null };
type RecentLead = { id: string; created_at: string; status: string; contact: { full_name: string } | null; agent: { full_name: string | null } | null };

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const profile = await requireRole(locale, ["admin"]);
  const t = await getTranslations("dash"), o = await getTranslations("adm.ov"), op = await getTranslations("op");
  const sb = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: kpiData }, { data: pending }, { data: recent }, { data: unassigned }, { data: agents }, { data: overdueRaw }] = await Promise.all([
    sb.rpc("admin_kpis"),
    sb.from("listings").select("id, purpose, price, currency, property:properties(reference_code, property_translations(locale, title))").eq("status", "pending_review").limit(20),
    sb.from("leads").select("id, created_at, status, contact:contacts(full_name), agent:profiles!assigned_agent_id(full_name)").order("created_at", { ascending: false }).limit(10),
    sb.from("leads").select("id, created_at, contact:contacts!contact_id(full_name)").is("assigned_agent_id", null).eq("status", "open").order("created_at", { ascending: false }).limit(10),
    sb.from("agent_profiles").select("id, display_name_en").order("display_name_en"),
    sb.from("deal_installments").select(installmentSelect).in("status", ["scheduled", "partial", "overdue"]).lt("due_date", today).order("due_date").limit(200),
  ]);
  const overdue = ((overdueRaw ?? []) as unknown as InstRow[]).filter((r) => r.amount > r.paid_amount);
  const k = (kpiData ?? {}) as Partial<Kpis>;
  const cards: [string, number | undefined, boolean?][] = [
    [t("kpiListings"), k.active_listings], [t("kpiOpenLeads"), k.open_leads], [t("kpiNewLeads"), k.new_leads_30d], [t("kpiWon"), k.won_leads_30d],
    [t("kpiRevenue"), k.revenue_mtd_aed], [t("kpiOverdue"), k.overdue_rent_aed, (k.overdue_rent_aed ?? 0) > 0],
    [t("kpiSla"), k.leads_breaching_sla, (k.leads_breaching_sla ?? 0) > 0], [t("kpiExpiring"), k.leases_expiring_90d],
  ];

  return (
    <DashboardShell profile={profile} locale={locale} active="overview">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([label, value, warn]) => (
          <div key={label} className="rounded-lg bg-surf p-4">
            <dt className="text-sm text-mu">{label}</dt>
            <dd className={`mt-1 text-2xl font-semibold ${warn ? "text-danger" : ""}`}>{formatNumber(Math.round(value ?? 0), locale)}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl font-semibold">{op("pay.overdue")} <span className={`text-base ${overdue.length ? "text-danger" : "text-mu"}`}>({formatNumber(overdue.length, locale)})</span></h2><Link href="/admin/installments?f=overdue" className="text-sm underline">{op("pay.viewAll")} →</Link></div>
        <ul className="mt-4 divide-y divide-ln rounded-lg bg-surf">
          {overdue.length ? overdue.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"><span><b>{r.deal?.contact?.full_name}</b> · {instName(r, locale)} · {(locale === "ar" ? r.label_ar : null) ?? r.label_en}</span>
              <span className="text-danger">{formatMoney(Math.round((r.amount - r.paid_amount) * 100) / 100, r.currency as Currency, locale)} · {op("pay.daysLate", { n: Math.max(1, Math.round((Date.parse(today) - Date.parse(r.due_date)) / 864e5)) })}</span></li>)) : <li className="p-4 text-mu">{op("pay.overdueNone")}</li>}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("pending")}</h2>
        <ul className="mt-4 divide-y divide-ln rounded-lg bg-surf">
          {((pending as unknown as Pending[]) ?? []).length ? (pending as unknown as Pending[]).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
              <span>{l.property?.property_translations?.find((x) => x.locale === locale)?.title ?? l.property?.reference_code} · {formatMoney(l.price, l.currency, locale)}</span>
              <form action={approveListing}><input type="hidden" name="id" value={l.id} /><Button type="submit">{t("approve")}</Button></form>
            </li>)) : <li className="p-4 text-mu">{t("none")}</li>}
        </ul>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl font-semibold">{o("assign")}</h2><Link href="/admin/team" className="text-sm underline">{o("teamLink")} →</Link></div>
        <ul className="mt-4 divide-y divide-ln rounded-lg bg-surf">
          {((unassigned ?? []) as unknown as { id: string; created_at: string; contact: { full_name: string } | null }[]).length ? ((unassigned ?? []) as unknown as { id: string; created_at: string; contact: { full_name: string } | null }[]).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><Link href={`/agent/leads/${l.id}`} className="font-semibold underline">{l.contact?.full_name}</Link>
              <form action={reassignLeadAction} className="flex gap-2"><input type="hidden" name="lead_id" value={l.id} /><select name="agent_id" className="rounded-full bg-bg px-3 py-2 text-sm" aria-label={o("assign")}>{(agents ?? []).map((a) => <option key={a.id as string} value={a.id as string}>{a.display_name_en as string}</option>)}</select><button className="rounded-full bg-goldgrad px-4 py-2 text-sm font-semibold text-[#1a1409]">{o("assignBtn")}</button></form></li>)) : <li className="p-4 text-mu">{o("none")}</li>}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("recentLeads")}</h2>
        <ul className="mt-4 divide-y divide-ln rounded-lg bg-surf">
          {((recent as unknown as RecentLead[]) ?? []).length ? (recent as unknown as RecentLead[]).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span className="font-medium">{l.contact?.full_name}</span>
              <span className="text-mu">{formatDate(l.created_at, locale)} · {l.agent?.full_name ?? t("unassigned")} · {l.status}</span>
            </li>)) : <li className="p-4 text-mu">{t("none")}</li>}
        </ul>
      </section>
    </DashboardShell>
  );
}

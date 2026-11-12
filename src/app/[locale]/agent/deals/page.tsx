import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { dealStatusAction } from "@/actions/crm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
const TONE: Record<string, string> = { negotiation: "bg-info/10 text-info", reserved: "bg-warning/15 text-warning", contract_signed: "bg-gold-1/40 text-gold-d", closed: "bg-success/10 text-success", cancelled: "bg-surf text-mu" };

export default async function DealsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("crm"), sb = await createClient(), admin = me.role === "admin";
  let dq = sb.from("deals").select("id, type, status, price, currency, created_at, lead_id, contact:contacts!contact_id(full_name), property:properties!property_id(reference_code, property_translations(locale, title)), unit:units!unit_id(unit_number, project:projects(project_translations(locale, name))), agent:profiles!agent_id(full_name)").order("created_at", { ascending: false }).limit(200);
  let cq = sb.from("commissions").select("status, amount_aed");
  if (!admin) { dq = dq.eq("agent_id", me.id); cq = cq.eq("agent_id", me.id); }
  const [{ data: ds }, { data: cs }] = await Promise.all([dq, cq]);
  const deals = (ds ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const sum = (s: string) => (cs ?? []).filter((c) => c.status === s).reduce((a, c) => a + Number(c.amount_aed ?? 0), 0);
  const cards: [string, number, string][] = [[t("deals.pending"), sum("pending"), "text-warning"], [t("deals.approved"), sum("approved"), "text-info"], [t("deals.paid"), sum("paid"), "text-success"]];
  return (
    <DashboardShell profile={me} locale={locale} active="deals">
      <h2 className="mb-3 text-xl">{admin ? t("deals.commissions") + " (AED)" : t("deals.commissions") + " (AED)"}</h2>
      <dl className="mb-8 grid gap-3 sm:grid-cols-3">{cards.map(([l, v, c]) => <div key={l} className="rounded-lg bg-surf p-5"><dt className="text-sm text-mu">{l}</dt><dd className={clsx("mt-1 text-3xl font-bold tracking-tight", c)}>{formatNumber(Math.round(v), locale)}</dd></div>)}</dl>
      {!deals.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("deals.none")}</p> : (
        <div className="overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[760px] text-sm">
          <thead><tr>{[t("deals.client"), t("deals.property"), t("deals.price"), t("deals.status"), ""].map((h, i) => <th key={i} className="p-4 text-start text-xs font-semibold text-mu">{h}</th>)}</tr></thead>
          <tbody>{deals.map((d) => {
            const ptr = d.property?.property_translations?.find((x: { locale: string }) => x.locale === locale) ?? d.property?.property_translations?.[0];
            return (
              <tr key={d.id} className="border-t border-ln align-middle">
                <td className="p-4"><b>{d.contact?.full_name}</b><br /><span className="text-xs text-mu">{t(`dtype.${d.type}` as "dtype.sale")} · {formatDate(d.created_at, locale)}{admin && d.agent?.full_name ? ` · ${d.agent.full_name}` : ""}</span></td>
                <td className="p-4 text-mu">{ptr?.title ?? (d.unit ? `${(d.unit.project?.project_translations?.find((x: { locale: string }) => x.locale === locale) ?? d.unit.project?.project_translations?.[0])?.name ?? ""} · ${d.unit.unit_number}` : "—")}</td><td className="p-4 whitespace-nowrap font-semibold">{formatMoney(d.price, d.currency as Currency, locale)}</td>
                <td className="p-4"><span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[d.status])}>{t(`dstat.${d.status}` as "dstat.closed")}</span></td>
                <td className="p-4"><div className="flex flex-wrap justify-end gap-1.5">
                  {d.status !== "closed" && d.status !== "cancelled" && <form action={dealStatusAction} className="flex gap-1.5"><input type="hidden" name="id" value={d.id} />
                    <select name="status" defaultValue={d.status} aria-label={t("deals.status")} className="rounded-full bg-bg px-3 py-1.5 text-xs font-semibold">{["negotiation", "reserved", "contract_signed", ...(admin ? ["closed"] : []), "cancelled"].map((s) => <option key={s} value={s}>{t(`dstat.${s}` as "dstat.closed")}</option>)}</select>
                    <button className={btn("outline", true)}>{t("deals.updateStatus")}</button></form>}
                  {d.lead_id && <Link href={`/agent/leads/${d.lead_id}`} className={btn("ghost", true)}>→</Link>}</div></td>
              </tr>);
          })}</tbody></table></div>)}
    </DashboardShell>
  );
}

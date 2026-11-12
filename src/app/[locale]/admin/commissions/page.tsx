import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { commissionStatusAction } from "@/actions/team";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
const TONE: Record<string, string> = { pending: "bg-warning/15 text-warning", approved: "bg-info/10 text-info", paid: "bg-success/10 text-success", cancelled: "bg-surf text-mu" };

export default async function CommissionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const { status } = await searchParams, me = await requireRole(locale, ["admin"]), t = await getTranslations("adm.com"), sb = await createClient();
  const { data } = await sb.from("commissions").select("id, status, rate, amount, currency, amount_aed, created_at, agent:profiles!agent_id(full_name), deal:deals!deal_id(price, currency, type, contact:contacts!contact_id(full_name))").order("created_at", { ascending: false }).limit(300);
  const all = (data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows = status ? all.filter((r) => r.status === status) : all;
  const sum = (s: string) => all.filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount_aed ?? 0), 0);
  const act = (id: string, st: string, label: string, v: "gold" | "outline" | "ghost") => <form action={commissionStatusAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={st} /><button className={btn(v, true)}>{label}</button></form>;
  return (
    <DashboardShell profile={me} locale={locale} active="commissions">
      <dl className="mb-6 grid gap-3 sm:grid-cols-3">{(["pending", "approved", "paid"] as const).map((k) => <div key={k} className="rounded-lg bg-surf p-5"><dt className="text-sm text-mu">{t(k)} · {t("aed")}</dt><dd className="mt-1 text-3xl font-bold tracking-tight">{formatNumber(Math.round(sum(k)), locale)}</dd></div>)}</dl>
      <nav className="mb-4 flex flex-wrap gap-1.5">{[["", t("total")], ["pending", t("pending")], ["approved", t("approved")], ["paid", t("paid")], ["cancelled", t("cancelled")]].map(([k, l]) => <Link key={k} href={k ? `/admin/commissions?status=${k}` : "/admin/commissions"} className={clsx("rounded-full px-4 py-2 text-sm font-semibold", (status ?? "") === k ? "bg-tx text-bg" : "bg-surf text-mu")}>{k ? l : t("title")}</Link>)}</nav>
      <p className="mb-4 text-sm text-mu">{t("hint")}</p>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("none")}</p> : (
        <div className="overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[780px] text-sm">
          <thead><tr>{[t("agent"), t("deal"), t("amount"), t("aed"), t("status"), t("date"), ""].map((h, i) => <th key={i} className="p-4 text-start text-xs font-semibold text-mu">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-t border-ln">
              <td className="p-4 font-semibold">{r.agent?.full_name}</td><td className="p-4">{r.deal?.contact?.full_name}<br /><span className="text-xs text-mu">{formatMoney(r.deal?.price ?? 0, (r.deal?.currency ?? "AED") as Currency, locale)} · {r.rate}%</span></td>
              <td className="p-4 whitespace-nowrap">{formatMoney(r.amount, r.currency as Currency, locale)}</td><td className="p-4 whitespace-nowrap font-semibold">{formatNumber(Math.round(r.amount_aed ?? 0), locale)}</td>
              <td className="p-4"><span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[r.status])}>{t(r.status as "pending")}</span></td><td className="p-4 whitespace-nowrap text-mu">{formatDate(r.created_at, locale)}</td>
              <td className="p-4"><div className="flex justify-end gap-1.5">
                {r.status === "pending" && <>{act(r.id, "approved", t("approve"), "gold")}{act(r.id, "cancelled", t("cancel"), "ghost")}</>}
                {r.status === "approved" && <>{act(r.id, "paid", t("pay"), "gold")}{act(r.id, "cancelled", t("cancel"), "ghost")}</>}</div></td>
            </tr>))}</tbody></table></div>)}
    </DashboardShell>
  );
}

import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { Countdown } from "@/components/Countdown";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, type Currency } from "@/lib/money";
import { effStatus } from "@/lib/installments";

export const dynamic = "force-dynamic";
type PT = { locale: string; name: string; slug: string }[];
type Proj = { handover_date: string | null; project_translations: PT } | null;
type Inst = { id: string; sort_order: number; label_en: string; label_ar: string | null; due_date: string; amount: number; paid_amount: number; status: string; currency: Currency };
type Deal = { id: string; price: number; currency: Currency; status: string; created_at: string; unit: { unit_number: string; unit_type: string | null; project: Proj } | null; deal_installments: Inst[] };
type Res = { id: string; status: string; expires_at: string; unit: { unit_number: string; unit_type: string | null; price: number; currency: Currency; project: Proj } | null };
const TONE: Record<string, string> = { scheduled: "bg-info/10 text-info", partial: "bg-warning/15 text-warning", paid: "bg-success/10 text-success", overdue: "bg-danger/10 text-danger", waived: "bg-surf text-mu" };
const day = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
const pick = (p: Proj, locale: string) => p?.project_translations.find((x) => x.locale === locale) ?? p?.project_translations[0];

export default async function PurchasePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["client"]), t = await getTranslations("op"), sb = await createClient();
  // Row Level Security returns only this person's own deals, installments and reservations
  const [{ data: ds }, { data: rs }] = await Promise.all([
    sb.from("deals").select("id, price, currency, status, created_at, unit:units!unit_id(unit_number, unit_type, project:projects(handover_date, project_translations(locale, name, slug))), deal_installments(id, sort_order, label_en, label_ar, due_date, amount, paid_amount, status, currency)").eq("type", "offplan_sale").order("created_at", { ascending: false }),
    sb.from("unit_reservations").select("id, status, expires_at, unit:units(unit_number, unit_type, price, currency, project:projects(handover_date, project_translations(locale, name, slug)))").eq("status", "active").order("reserved_at", { ascending: false }),
  ]);
  const deals = (ds ?? []) as unknown as Deal[], reservations = ((rs ?? []) as unknown as Res[]).filter((r) => new Date(r.expires_at).getTime() > Date.now());
  const today = new Date().toISOString().slice(0, 10);
  return (
    <DashboardShell profile={me} locale={locale} active="purchase">
      {!deals.length && !reservations.length && <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("buy.none")}</p>}

      {reservations.map((r) => { const pr = pick(r.unit?.project ?? null, locale); return (
        <section key={r.id} className="mb-8 rounded-lg bg-surf p-6">
          <p className="label">{t("buy.reservation")}</p>
          <h2 className="mt-1 text-2xl font-semibold">{pr?.name} · {r.unit?.unit_number}</h2>
          <p className="mt-2 text-sm text-mu">{t("buy.reservedUntil", { d: new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(new Date(r.expires_at)) })} · <Countdown to={r.expires_at} /></p>
          {r.unit && <p className="mt-1 font-semibold">{formatMoney(r.unit.price, r.unit.currency, locale)}</p>}
        </section>); })}

      {deals.map((d) => {
        const pr = pick(d.unit?.project ?? null, locale), ins = [...d.deal_installments].sort((a, b) => a.sort_order - b.sort_order);
        const paid = ins.reduce((a, i) => a + Number(i.paid_amount), 0), next = ins.find((i) => effStatus(i, today) !== "paid" && effStatus(i, today) !== "waived");
        const cards: [string, string, string?][] = [[t("buy.price"), formatMoney(d.price, d.currency, locale)], [t("buy.totalPaid"), formatMoney(paid, d.currency, locale)], [t("buy.remaining"), formatMoney(Math.max(0, d.price - paid), d.currency, locale)],
          [t("buy.nextDue"), next ? `${day(next.due_date, locale)} · ${formatMoney(next.amount - next.paid_amount, next.currency, locale)}` : "—", next && effStatus(next, today) === "overdue" ? "text-danger" : undefined]];
        return (
          <section key={d.id} className="mb-10">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl font-semibold">{pr?.name} · {d.unit?.unit_number}{d.unit?.unit_type ? <span className="text-base text-mu"> · {d.unit.unit_type}</span> : null}</h2>
              {pr?.slug && <Link href={`/projects/${pr.slug}`} className="text-sm underline">→</Link>}</div>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([l, v, c]) => <div key={l} className="rounded-lg bg-surf p-4"><dt className="text-sm text-mu">{l}</dt><dd className={clsx("mt-1 text-lg font-semibold", c)}>{v}</dd></div>)}</dl>
            {d.unit?.project?.handover_date && <p className="mt-3 text-sm text-mu">{t("buy.handover")}: {day(d.unit.project.handover_date, locale)}</p>}
            <h3 className="mb-3 mt-6 text-xl font-semibold">{t("buy.schedule")}</h3>
            <div className="overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[560px] text-sm">
              <thead><tr>{[t("buy.label"), t("buy.due"), t("buy.amount"), t("buy.paid"), t("buy.status")].map((h) => <th key={h} className="p-4 text-start text-xs font-semibold text-mu">{h}</th>)}</tr></thead>
              <tbody>{ins.map((i) => { const st = effStatus(i, today); return (
                <tr key={i.id} className="border-t border-ln"><td className="p-4 font-medium">{(locale === "ar" ? i.label_ar : null) ?? i.label_en}</td><td className="p-4 whitespace-nowrap">{day(i.due_date, locale)}</td>
                  <td className="p-4 whitespace-nowrap">{formatMoney(i.amount, i.currency, locale)}</td><td className="p-4 whitespace-nowrap">{formatMoney(i.paid_amount, i.currency, locale)}</td>
                  <td className="p-4"><span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[st])}>{t(`pay.status.${st}` as "pay.status.paid")}</span></td></tr>); })}</tbody></table></div>
            <Link href="/account/messages" className="mt-4 inline-block text-sm font-semibold underline">{t("buy.contact")} →</Link>
          </section>); })}
    </DashboardShell>
  );
}

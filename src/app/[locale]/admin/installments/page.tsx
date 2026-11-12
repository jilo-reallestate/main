import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { OpForm } from "@/components/OpForm";
import { recordPaymentAction } from "@/actions/offplan";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, type Currency } from "@/lib/money";
import { btn } from "@/components/ui/Button";
import { fieldCls } from "@/components/ui/Input";
import { installmentSelect, effStatus, type InstRow, instName } from "@/lib/installments";

export const dynamic = "force-dynamic";
const TONE: Record<string, string> = { scheduled: "bg-info/10 text-info", partial: "bg-warning/15 text-warning", overdue: "bg-danger/10 text-danger" };
const METHODS = ["bank_transfer", "cheque", "cash", "card", "online"];

export default async function InstallmentsAdmin({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params, { f } = await searchParams; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("op"), sb = await createClient();
  const { data } = await sb.from("deal_installments").select(installmentSelect).in("status", ["scheduled", "partial", "overdue"]).order("due_date").limit(500);
  const today = new Date().toISOString().slice(0, 10);
  let rows = ((data ?? []) as unknown as InstRow[]).filter((r) => r.amount > r.paid_amount);
  if (f === "overdue") rows = rows.filter((r) => r.due_date < today);
  return (
    <DashboardShell profile={me} locale={locale} active="installments">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{t("pay.title")}</h2>
        <div className="flex gap-2"><Link href="/admin/installments" className={btn(f === "overdue" ? "outline" : "primary", true)}>{t("pay.all")}</Link><Link href="/admin/installments?f=overdue" className={btn(f === "overdue" ? "primary" : "outline", true)}>{t("pay.onlyOverdue")}</Link></div></div>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("pay.overdueNone")}</p> : (
        <ul className="grid gap-3">{rows.map((r) => {
          const st = effStatus(r, today), out = Math.round((r.amount - r.paid_amount) * 100) / 100, who = r.deal?.contact?.full_name, where = instName(r, locale);
          return (
            <li key={r.id} className="rounded-lg bg-surf p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><b>{(locale === "ar" ? r.label_ar : null) ?? r.label_en}</b> <span className="text-mu">· {where}</span><p className="text-sm text-mu">{t("pay.buyer")}: {who} · {t("pay.due")}: <span dir="ltr">{r.due_date}</span></p></div>
                <div className="text-end"><span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[st])}>{t(`pay.status.${st}` as "pay.status.overdue")}</span>
                  <p className="mt-1 text-sm">{t("pay.outstanding")}: <b>{formatMoney(out, r.currency as Currency, locale)}</b> <span className="text-mu">/ {formatMoney(r.amount, r.currency as Currency, locale)}</span></p></div></div>
              <OpForm action={recordPaymentAction} submit={t("pay.record")} okText={t("pay.recorded")} variant="outline" small className="mt-4 grid gap-2 border-t border-ln pt-4 sm:grid-cols-5 sm:items-end">
                <input type="hidden" name="installment_id" value={r.id} />
                <label className="grid gap-1 text-xs"><span className="label">{t("pay.amount")}</span><input name="amount" inputMode="decimal" required defaultValue={out} dir="ltr" className={fieldCls} /></label>
                <label className="grid gap-1 text-xs"><span className="label">{t("pay.method")}</span><select name="method" defaultValue="bank_transfer" className={fieldCls}>{METHODS.map((m) => <option key={m} value={m}>{t(`pay.m.${m}` as "pay.m.cash")}</option>)}</select></label>
                <label className="grid gap-1 text-xs"><span className="label">{t("pay.reference")}</span><input name="reference" maxLength={120} dir="ltr" className={fieldCls} /></label>
                <label className="grid gap-1 text-xs"><span className="label">{t("pay.date")}</span><input type="date" name="paid_at" max={today} defaultValue={today} dir="ltr" className={fieldCls} /></label>
              </OpForm>
            </li>);
        })}</ul>)}
    </DashboardShell>
  );
}

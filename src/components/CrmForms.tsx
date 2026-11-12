"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createDealAction, createLeadAction, type CrmState } from "@/actions/crm";
import { fieldCls } from "@/components/ui/Input";

const lbl = "grid gap-1.5 text-sm";
const Err = ({ s }: { s: CrmState }) => (s?.error ? <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">{s.error}</p> : null);

export function NewLeadForm({ locale, sources }: { locale: string; sources: { key: string; name: string }[] }) {
  const t = useTranslations("crm"), [s, action, pending] = useActionState<CrmState, FormData>(createLeadAction, null);
  return (
    <form action={action} className="grid max-w-3xl gap-4 rounded-lg bg-surf p-6">
      <input type="hidden" name="locale" value={locale} /><Err s={s} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={lbl}><span className="label">{t("newlead.name")} *</span><input name="full_name" required minLength={2} className={fieldCls} /></label>
        <label className={lbl}><span className="label">{t("newlead.phone")}</span><input name="phone" type="tel" dir="ltr" className={fieldCls} /></label>
        <label className={lbl}><span className="label">{t("newlead.email")}</span><input name="email" type="email" dir="ltr" className={fieldCls} /></label>
        <label className={lbl}><span className="label">{t("newlead.intent")}</span><select name="intent" className={fieldCls}>{["buy", "rent", "invest", "sell", "list_property"].map((i) => <option key={i} value={i}>{t(`intent.${i}` as "intent.buy")}</option>)}</select></label>
        <label className={lbl}><span className="label">{t("newlead.source")}</span><select name="source_key" defaultValue="phone" className={fieldCls}>{sources.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select></label>
        <span />
        <label className={lbl}><span className="label">{t("newlead.budgetMin")}</span><input name="budget_min" type="number" min={0} className={fieldCls} dir="ltr" /></label>
        <label className={lbl}><span className="label">{t("newlead.budgetMax")}</span><input name="budget_max" type="number" min={0} className={fieldCls} dir="ltr" /></label>
      </div>
      <label className={lbl}><span className="label">{t("newlead.note")}</span><textarea name="message" rows={3} className={fieldCls + " py-3"} /></label>
      <p className="text-xs text-mu">{t("newlead.phone")} / {t("newlead.email")} *</p>
      <button disabled={pending} className="min-h-[48px] rounded-full bg-goldgrad px-8 font-bold text-[#1a1409] disabled:opacity-50 sm:w-fit">{t("newlead.create")}</button>
    </form>
  );
}

export function DealForm({ leadId }: { leadId: string }) {
  const t = useTranslations("crm"), [s, action, pending] = useActionState<CrmState, FormData>(createDealAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="lead_id" value={leadId} /><Err s={s} />{s?.ok && <p role="status" className="text-sm font-semibold text-success">✓</p>}
      <div className="grid grid-cols-2 gap-3">
        <select name="type" className={fieldCls} aria-label={t("lead.dealType")}>{["sale", "rent", "offplan_sale"].map((x) => <option key={x} value={x}>{t(`dtype.${x}` as "dtype.sale")}</option>)}</select>
        <select name="currency" className={fieldCls} aria-label="Currency"><option>AED</option><option>USD</option><option>GBP</option></select>
      </div>
      <input name="price" type="number" min={1} required placeholder={t("lead.dealPrice")} aria-label={t("lead.dealPrice")} className={fieldCls} dir="ltr" />
      <button disabled={pending} className="min-h-[44px] rounded-full bg-tx font-semibold text-bg disabled:opacity-50">{t("lead.create")}</button>
    </form>
  );
}

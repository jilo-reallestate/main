"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviteStaffAction, promoteStaffAction, saveSettingsAction, saveStaffAction, type AdmState } from "@/actions/team";
import { fieldCls } from "@/components/ui/Input";

const lbl = "grid gap-1.5 text-sm", cap = "label";
function Msg({ s, ok }: { s: AdmState; ok: string }) {
  const t = useTranslations("adm.team");
  if (s?.error) return <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">{s.error === "nokey" ? t("nokey") : s.error}</p>;
  return s?.ok ? <p role="status" className="rounded-2xl bg-success/10 p-3 text-sm font-semibold text-success">✓ {ok}</p> : null;
}
function Field({ d, k, l, type = "text", hint, ...r }: { d: Record<string, string>; k: string; l: string; type?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={lbl}><span className={cap}>{l}</span><input name={k} type={type} defaultValue={d[k] ?? ""} className={fieldCls} {...r} />{hint && <small className="text-xs text-mu">{hint}</small>}</label>;
}
const Btn = ({ pending, children }: { pending: boolean; children: React.ReactNode }) => <button disabled={pending} className="min-h-[46px] rounded-full bg-goldgrad px-7 font-bold text-[#1a1409] disabled:opacity-50 sm:w-fit">{children}</button>;

export function InviteForm({ locale }: { locale: string }) {
  const t = useTranslations("adm.team"), [s, a, p] = useActionState<AdmState, FormData>(inviteStaffAction, null);
  return (
    <form action={a} className="grid gap-3 rounded-lg bg-surf p-5"><h3 className="text-lg">{t("invite")}</h3><p className="text-sm text-mu">{t("inviteHint")}</p>
      <input type="hidden" name="locale" value={locale} /><Msg s={s} ok={t("invited")} />
      <label className={lbl}><span className={cap}>{t("name")}</span><input name="full_name" required className={fieldCls} /></label>
      <label className={lbl}><span className={cap}>{t("email")}</span><input name="email" type="email" required dir="ltr" className={fieldCls} /></label>
      <label className={lbl}><span className={cap}>{t("role")}</span><select name="role" className={fieldCls}><option value="agent">{t("agent")}</option><option value="admin">{t("admin")}</option></select></label>
      <Btn pending={p}>{t("send")}</Btn></form>
  );
}
export function PromoteForm() {
  const t = useTranslations("adm.team"), [s, a, p] = useActionState<AdmState, FormData>(promoteStaffAction, null);
  return (
    <form action={a} className="grid gap-3 rounded-lg bg-surf p-5"><h3 className="text-lg">{t("promote")}</h3><p className="text-sm text-mu">{t("promoteHint")}</p><Msg s={s} ok={t("done")} />
      <label className={lbl}><span className={cap}>{t("email")}</span><input name="email" type="email" required dir="ltr" className={fieldCls} /></label>
      <label className={lbl}><span className={cap}>{t("role")}</span><select name="role" className={fieldCls}><option value="agent">{t("agent")}</option><option value="admin">{t("admin")}</option></select></label>
      <Btn pending={p}>{t("promoteBtn")}</Btn></form>
  );
}
export type StaffInit = Record<string, string>;
export function StaffForm({ init, others, self }: { init: StaffInit; others: { id: string; name: string }[]; self: boolean }) {
  const t = useTranslations("adm.edit"), [s, a, p] = useActionState<AdmState, FormData>(saveStaffAction, null);
  return (
    <form action={a} className="grid gap-5 rounded-lg bg-surf p-6">
      <input type="hidden" name="id" value={init.id} /><Msg s={s} ok={t("saved") + (s?.notice ? ` (${s.notice})` : "")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field d={init} k="full_name" l={t("fullName")} /><Field d={init} k="phone" l={t("phone")} dir="ltr" />
        <label className={lbl}><span className={cap}>{t("role")}</span><select name="role" defaultValue={init.role} disabled={self} className={fieldCls}><option value="agent">Agent</option><option value="admin">Admin</option><option value="client">{t("roleClient")}</option></select></label>
        <Field d={init} k="display_name_en" l={t("displayEn")} /><Field d={init} k="display_name_ar" l={t("displayAr")} dir="rtl" /><Field d={init} k="license_number" l={t("license")} dir="ltr" />
        <Field d={init} k="title_en" l={t("titleEn")} /><Field d={init} k="title_ar" l={t("titleAr")} dir="rtl" /><Field d={init} k="languages" l={t("languages")} dir="ltr" />
        <Field d={init} k="public_phone" l={t("publicPhone")} dir="ltr" /><Field d={init} k="whatsapp" l={t("whatsapp")} dir="ltr" />
        <Field d={init} k="commission_rate" l={t("rate")} type="number" step="0.01" min={0} max={100} dir="ltr" /><Field d={init} k="monthly_target_aed" l={t("target")} type="number" min={0} dir="ltr" />
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="accepts_leads" defaultChecked={init.accepts_leads === "true"} className="h-4 w-4 accent-gold-3" />{t("accepts")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_public" defaultChecked={init.is_public !== "false"} className="h-4 w-4 accent-gold-3" />{t("public")}</label>
      </div>
      <div className="grid gap-4 rounded-2xl bg-bg p-4 sm:grid-cols-2">
        <label className={lbl}><span className={cap}>{t("active")}</span><select name="is_active" defaultValue={init.is_active} disabled={self} className={fieldCls}><option value="true">✓</option><option value="false">✕</option></select></label>
        <label className={lbl}><span className={cap}>{t("reassign")}</span><select name="reassign_to" className={fieldCls}><option value="">{t("none")}</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <p className="text-xs text-mu sm:col-span-2">{t("warn")}</p>
      </div>
      <Btn pending={p}>{t("save")}</Btn>
    </form>
  );
}
export function SettingsForm({ v }: { v: Record<string, string> }) {
  const t = useTranslations("adm.set"), [s, a, p] = useActionState<AdmState, FormData>(saveSettingsAction, null);
  return (
    <form action={a} className="grid max-w-3xl gap-5">
      <Msg s={s} ok={t("saved")} />
      <section className="grid gap-4 rounded-lg bg-surf p-6 sm:grid-cols-2"><h3 className="text-lg sm:col-span-2">{t("ops")}</h3>
        <Field d={v} k="lead_sla_minutes" l={t("sla")} type="number" hint={t("slaHint")} dir="ltr" /><Field d={v} k="reservation_hours" l={t("res")} type="number" dir="ltr" /><Field d={v} k="listing_expiry_days" l={t("exp")} type="number" dir="ltr" />
        <label className="flex items-start gap-2.5 text-sm sm:col-span-2"><input type="checkbox" name="require_permit_number" defaultChecked={v.require_permit_number === "true"} className="mt-1 h-4 w-4 accent-gold-3" /><span>{t("permit")}<br /><small className="text-mu">{t("permitHint")}</small></span></label></section>
      <section className="grid gap-4 rounded-lg bg-surf p-6 sm:grid-cols-2"><h3 className="text-lg sm:col-span-2">{t("company")}</h3>
        <Field d={v} k="company_name" l={t("cname")} /><Field d={v} k="company_phone" l={t("phone")} dir="ltr" /><Field d={v} k="company_email" l={t("email")} type="email" dir="ltr" /><Field d={v} k="company_whatsapp" l={t("whatsapp")} dir="ltr" /></section>
      <Btn pending={p}>{t("save")}</Btn>
    </form>
  );
}

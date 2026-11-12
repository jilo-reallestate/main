"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfileAction, type PState } from "@/actions/portal";
import { fieldCls } from "@/components/ui/Input";

export function ProfileForm({ init }: { init: { full_name: string; phone: string; preferred_locale: string; preferred_currency: string } }) {
  const t = useTranslations("portal.profile"), [s, a, p] = useActionState<PState, FormData>(updateProfileAction, null);
  return (
    <form action={a} className="grid max-w-xl gap-4 rounded-lg bg-surf p-6">
      {s?.ok && <p role="status" className="rounded-2xl bg-success/10 p-3 text-sm font-semibold text-success">✓ {t("saved")}</p>}{s?.error && <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">{s.error}</p>}
      <label className="grid gap-1.5 text-sm"><span className="label">{t("name")}</span><input name="full_name" defaultValue={init.full_name} className={fieldCls} /></label>
      <label className="grid gap-1.5 text-sm"><span className="label">{t("phone")}</span><input name="phone" type="tel" dir="ltr" defaultValue={init.phone} className={fieldCls} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm"><span className="label">{t("language")}</span><select name="preferred_locale" defaultValue={init.preferred_locale} className={fieldCls}><option value="en">English</option><option value="ar">العربية</option></select></label>
        <label className="grid gap-1.5 text-sm"><span className="label">{t("currency")}</span><select name="preferred_currency" defaultValue={init.preferred_currency} className={fieldCls}><option>AED</option><option>USD</option><option>GBP</option></select></label></div>
      <button disabled={p} className="min-h-[46px] rounded-full bg-goldgrad px-8 font-bold text-[#1a1409] disabled:opacity-50 sm:w-fit">{t("save")}</button>
    </form>
  );
}

"use client";
import clsx from "clsx";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { submitInquiry, type InquiryState } from "@/actions/inquiry";
import { fieldCls } from "@/components/ui/Input";

const SLOTS = ["10:00", "11:30", "13:00", "15:00", "16:30", "18:00"];
const gulfNow = () => new Date(Date.now() + 4 * 3600e3); // UTC+4 as a UTC-clock date
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Viewing scheduler + message form. Sends to the CRM through submit_inquiry(); a requested viewing becomes a row in `viewings`. */
export function BookingBox({ listingId, intent, locale, whatsapp, phone }: { listingId: string; intent: "buy" | "rent"; locale: string; whatsapp?: string | null; phone?: string | null }) {
  const t = useTranslations(), x = useTranslations("v2.x"), [mode, setMode] = useState<"v" | "m">("v"), [day, setDay] = useState(0), [slot, setSlot] = useState(-1);
  const [days, setDays] = useState<{ date: string; w: string; d: string }[]>([]);
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitInquiry, null);
  useEffect(() => {
    const l = locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", base = gulfNow();
    setDays([...Array(5)].map((_, k) => { const d = new Date(base.getTime() + (k + 1) * 864e5); return { date: iso(d), w: new Intl.DateTimeFormat(l, { weekday: "short", timeZone: "UTC" }).format(d), d: new Intl.DateTimeFormat(l, { day: "numeric", month: "short", timeZone: "UTC" }).format(d) }; }));
  }, [locale]);
  const wa = whatsapp?.replace(/\D/g, "");
  if (state?.ok) return <div id="enquire" className="rounded-xl border border-ln p-6 text-success">✓ {mode === "v" ? x("vok") : x("mok")}</div>;
  const chip = (on: boolean) => clsx("flex-none rounded-2xl border-[1.5px] px-3.5 py-2.5 text-[13px] font-semibold transition", on ? "border-tx bg-tx text-bg" : "border-ln hover:border-mu");
  return (
    <div id="enquire" className="scroll-mt-28 rounded-xl border border-ln bg-bg p-6 shadow-[0_20px_50px_rgba(0,0,0,.08)]">
      <p className="mb-3.5 flex items-center gap-2 text-[13px] text-mu"><span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_4px_rgba(31,157,97,.18)]" />{x("rt")}</p>
      <div className="flex gap-2">
        {wa ? <a href={`https://wa.me/${wa}`} className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-full bg-goldgrad font-semibold text-[#1a1409]">{x("wa")}</a> : null}
        {phone ? <a href={`tel:${phone}`} dir="ltr" className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-full border-[1.5px] border-ln font-semibold">{x("cl2")}</a> : null}
      </div>
      <div className="my-3.5 flex gap-0.5 rounded-full bg-surf p-1">{(["v", "m"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={clsx("flex-1 rounded-full px-4 py-2.5 text-[13px] font-semibold", mode === m ? "bg-tx text-bg" : "text-mu")}>{m === "v" ? x("vw") : x("msg")}</button>)}</div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="listing_id" value={listingId} /><input type="hidden" name="intent" value={intent} /><input type="hidden" name="locale" value={locale} />
        <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        {mode === "v" && days.length > 0 && <>
          <input type="hidden" name="viewing_at" value={slot >= 0 ? `${days[day].date}T${SLOTS[slot]}` : ""} />
          <p className="label">{x("dy")}</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">{days.map((d, k) => <button key={d.date} type="button" onClick={() => setDay(k)} className={chip(day === k)}>{d.w}<small className="block text-[11px] font-medium opacity-70">{d.d}</small></button>)}</div>
          <p className="label">{x("tm")}</p>
          <div className="grid grid-cols-3 gap-2">{SLOTS.map((s, j) => <button key={s} type="button" onClick={() => setSlot(j)} className={chip(slot === j)}>{s}</button>)}</div></>}
        <input name="full_name" required minLength={2} placeholder={t("v2.name")} aria-label={t("v2.name")} autoComplete="name" className={fieldCls} />
        <input name="phone" type="tel" dir="ltr" placeholder={t("v2.phone")} aria-label={t("v2.phone")} autoComplete="tel" className={fieldCls} />
        {mode === "m" && <>
          <input name="email" type="email" dir="ltr" placeholder={t("v2.email")} aria-label={t("v2.email")} autoComplete="email" className={fieldCls} />
          <textarea name="message" rows={3} maxLength={2000} placeholder={t("inquiry.message")} className={clsx(fieldCls, "py-3")} /></>}
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending || (mode === "v" && slot < 0)} className="min-h-[48px] w-full rounded-full bg-goldgrad font-bold text-[#1a1409] transition hover:shadow-lg disabled:opacity-50">{pending ? t("inquiry.sending") : mode === "v" ? x("vw") : t("v2.send")}</button>
      </form>
    </div>
  );
}

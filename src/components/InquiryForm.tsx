"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitInquiry, type InquiryState } from "@/actions/inquiry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function InquiryForm({ listingId, intent, locale }: { listingId: string; intent: "buy" | "rent"; locale: string }) {
  const t = useTranslations("inquiry");
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitInquiry, null);

  if (state?.ok) {
    return <p role="status" className="rounded-md border border-success bg-white p-4 text-success">✓ {t("success")}</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <h2 className="text-2xl font-semibold">{t("title")}</h2>
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="locale" value={locale} />
      {/* honeypot, hidden from people */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="block text-sm">{t("name")}<Input name="full_name" required minLength={2} autoComplete="name" className="mt-1" /></label>
      <label className="block text-sm">{t("email")}<Input name="email" type="email" autoComplete="email" dir="ltr" className="mt-1" /></label>
      <label className="block text-sm">{t("phone")}<Input name="phone" type="tel" autoComplete="tel" dir="ltr" className="mt-1" /></label>
      <p className="text-xs text-charcoal/60">{t("contactHint")}</p>
      <label className="block text-sm">{t("viewing")}<Input name="viewing_at" type="datetime-local" dir="ltr" className="mt-1" /></label>
      <label className="block text-sm">{t("message")}
        <textarea name="message" rows={3} maxLength={2000} className="mt-1 w-full rounded-sm border border-ivory-dark bg-white px-3 py-2 text-charcoal focus-visible:border-bronze-deep" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? t("sending") : t("send")}</Button>
    </form>
  );
}

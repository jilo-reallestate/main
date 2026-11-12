"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitInquiry, type InquiryState } from "@/actions/inquiry";
import { Button } from "@/components/ui/Button";
import { Input, fieldCls } from "@/components/ui/Input";

/** Enquiry form for a project: creates a CRM lead linked to the project (database function submit_inquiry). */
export function ProjectEnquiry({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations("inquiry"), p = useTranslations("op.pub");
  const [s, action, pending] = useActionState<InquiryState, FormData>(submitInquiry, null);
  if (s?.ok) return <p role="status" className="rounded-2xl bg-success/10 p-4 font-semibold text-success">✓ {p("success")}</p>;
  return (
    <form action={action} className="grid gap-3">
      <h2 className="text-2xl font-semibold">{p("enquiryTitle")}</h2><p className="text-sm text-mu">{p("enquiryNote")}</p>
      <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="intent" value="invest" /><input type="hidden" name="locale" value={locale} />
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="grid gap-1 text-sm">{t("name")}<Input name="full_name" required minLength={2} autoComplete="name" /></label>
      <label className="grid gap-1 text-sm">{t("email")}<Input name="email" type="email" autoComplete="email" dir="ltr" /></label>
      <label className="grid gap-1 text-sm">{t("phone")}<Input name="phone" type="tel" autoComplete="tel" dir="ltr" /></label>
      <p className="text-xs text-mu">{t("contactHint")}</p>
      <label className="grid gap-1 text-sm">{p("message")}<textarea name="message" rows={3} maxLength={2000} className={fieldCls + " py-3"} /></label>
      {s?.error && <p role="alert" className="text-sm font-semibold text-danger">{s.error}</p>}
      <Button type="submit" variant="gold" disabled={pending}>{pending ? p("sending") : p("send")}</Button>
    </form>
  );
}

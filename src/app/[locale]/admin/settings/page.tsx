import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/DashboardShell";
import { SettingsForm } from "@/components/AdminForms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("adm.set"), sb = await createClient();
  const { data } = await sb.from("site_settings").select("key, value");
  const m = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const c = (m.get("company") ?? {}) as Record<string, string>;
  const v = { lead_sla_minutes: String(m.get("lead_sla_minutes") ?? 5), reservation_hours: String(m.get("reservation_hours") ?? 48), listing_expiry_days: String(m.get("listing_expiry_days") ?? 90),
    require_permit_number: String(m.get("require_permit_number") ?? false), company_name: c.name ?? "", company_phone: c.phone ?? "", company_email: c.email ?? "", company_whatsapp: c.whatsapp ?? "" };
  return (<DashboardShell profile={me} locale={locale} active="settings"><h2 className="mb-5 text-2xl">{t("title")}</h2><SettingsForm v={v} /></DashboardShell>);
}

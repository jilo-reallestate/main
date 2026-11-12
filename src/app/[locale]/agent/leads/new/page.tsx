import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { NewLeadForm } from "@/components/CrmForms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function NewLeadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("crm"), sb = await createClient();
  const { data } = await sb.from("lead_sources").select("key, name_en, name_ar").order("name_en");
  return (
    <DashboardShell profile={me} locale={locale} active="pipeline">
      <Link href="/agent/pipeline" className="text-sm text-mu underline">← {t("lead.back")}</Link>
      <h2 className="mb-6 mt-3 text-3xl">{t("newlead.title")}</h2>
      <NewLeadForm locale={locale} sources={(data ?? []).map((s) => ({ key: s.key, name: locale === "ar" ? s.name_ar : s.name_en }))} />
    </DashboardShell>
  );
}

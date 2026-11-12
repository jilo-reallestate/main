import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/DashboardShell";
import { ListingForm } from "@/components/ListingForm";
import { Link } from "@/i18n/routing";
import { requireRole } from "@/lib/auth";
import { loadFormRefs } from "@/lib/manage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function NewListing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("mgr");
  const refs = await loadFormRefs(await createClient(), locale, me.role === "admin");
  return (
    <DashboardShell profile={me} locale={locale} active="listings">
      <Link href="/agent/listings" className="text-sm text-mu underline">← {t("back")}</Link>
      <h2 className="mb-6 mt-3 text-3xl">{t("new")}</h2>
      <ListingForm locale={locale} isAdmin={me.role === "admin"} initial={{ values: { purpose: "sale", type: "apartment", currency: "AED", completion_status: "ready", agent_id: me.id }, amenities: [] }} {...refs} />
    </DashboardShell>
  );
}

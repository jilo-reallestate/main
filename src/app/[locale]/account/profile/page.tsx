import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/DashboardShell";
import { ProfileForm } from "@/components/ProfileForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["client"]), t = await getTranslations("portal.profile"), sb = await createClient();
  const { data } = await sb.from("profiles").select("full_name, phone, preferred_locale, preferred_currency").eq("id", me.id).single();
  return (<DashboardShell profile={me} locale={locale} active="profile"><h2 className="mb-5 text-2xl">{t("title")}</h2><ProfileForm init={{ full_name: data?.full_name ?? "", phone: data?.phone ?? "", preferred_locale: data?.preferred_locale ?? "en", preferred_currency: data?.preferred_currency ?? "AED" }} /></DashboardShell>);
}

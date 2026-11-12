import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/DashboardShell";
import { DocumentManager, type Doc } from "@/components/DocumentManager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["client"]), t = await getTranslations("portal.docs"), sb = await createClient();
  const { data } = await sb.from("client_documents").select("id, kind, file_name, path, size_bytes, created_at").eq("owner_id", me.id).order("created_at", { ascending: false });
  return (<DashboardShell profile={me} locale={locale} active="documents"><h2 className="mb-4 text-2xl">{t("title")}</h2><DocumentManager ownerId={me.id} initial={(data ?? []) as Doc[]} /></DashboardShell>);
}

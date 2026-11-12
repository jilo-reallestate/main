import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/DashboardShell";
import { ListingForm } from "@/components/ListingForm";
import { PhotoManager } from "@/components/PhotoManager";
import { Link } from "@/i18n/routing";
import { requireRole } from "@/lib/auth";
import { loadFormRefs, loadListingForEdit } from "@/lib/manage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function EditListing({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("mgr"), sb = await createClient();
  const [data, refs] = await Promise.all([loadListingForEdit(sb, id), loadFormRefs(sb, locale, me.role === "admin")]);
  if (!data) notFound();
  return (
    <DashboardShell profile={me} locale={locale} active="listings">
      <Link href="/agent/listings" className="text-sm text-mu underline">← {t("back")}</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-3"><h2 className="text-3xl">{t("edit")}</h2><span className="font-mono text-sm text-mu">{data.ref}</span><span className="rounded-full bg-surf px-3 py-1 text-xs font-semibold">{t(`st.${data.status}` as "st.draft")}</span></div>
      <div className="grid gap-5">
        <PhotoManager propertyId={data.propertyId} initial={data.photos} />
        <ListingForm locale={locale} listingId={id} isAdmin={me.role === "admin"} initial={data.init} {...refs} />
      </div>
    </DashboardShell>
  );
}

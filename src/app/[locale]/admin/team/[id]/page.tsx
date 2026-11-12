import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { StaffForm } from "@/components/AdminForms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function EditStaff({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("adm.edit"), sb = await createClient();
  const [{ data: p }, { data: ap }, { data: st }, { data: others }] = await Promise.all([
    sb.from("profiles").select("id, role, full_name, email, phone, is_active").eq("id", id).maybeSingle(),
    sb.from("agent_profiles").select("*").eq("id", id).maybeSingle(), sb.from("agent_settings").select("*").eq("id", id).maybeSingle(),
    sb.from("agent_profiles").select("id, display_name_en").neq("id", id),
  ]);
  if (!p) notFound();
  const s = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  const init = { id, role: p.role, full_name: s(p.full_name), phone: s(p.phone), is_active: String(p.is_active), display_name_en: s(ap?.display_name_en), display_name_ar: s(ap?.display_name_ar), title_en: s(ap?.title_en), title_ar: s(ap?.title_ar),
    license_number: s(ap?.license_number), public_phone: s(ap?.public_phone), whatsapp: s(ap?.whatsapp), languages: (ap?.languages ?? []).join(", "), is_public: String(ap?.is_public ?? true),
    commission_rate: s(st?.commission_rate), monthly_target_aed: s(st?.monthly_target_aed), accepts_leads: String(st?.accepts_leads ?? true) };
  return (
    <DashboardShell profile={me} locale={locale} active="team">
      <Link href="/admin/team" className="text-sm text-mu underline">← {t("back")}</Link>
      <div className="mb-6 mt-3"><p className="eyebrow mb-2">{t("title")}</p><h2 className="text-3xl">{p.full_name || p.email}</h2><p className="text-sm text-mu" dir="ltr">{p.email}</p></div>
      <StaffForm init={init} self={p.id === me.id} others={(others ?? []).map((o) => ({ id: o.id as string, name: o.display_name_en as string }))} />
    </DashboardShell>
  );
}

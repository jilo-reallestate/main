import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { OpForm } from "@/components/OpForm";
import { UploadField } from "@/components/UploadField";
import { saveDeveloperAction } from "@/actions/offplan";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btn } from "@/components/ui/Button";
import { fieldCls } from "@/components/ui/Input";

export const dynamic = "force-dynamic";
type D = { id: string; name_en: string; name_ar: string | null; slug_en: string; slug_ar: string | null; website: string | null; logo_url: string | null; description_en: string | null; description_ar: string | null; is_active: boolean };

export default async function DevelopersAdmin({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { locale } = await params, { edit } = await searchParams; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("op"), sb = await createClient();
  const [{ data: ds }, { data: ps }] = await Promise.all([sb.from("developers").select("*").order("name_en"), sb.from("projects").select("developer_id")]);
  const list = (ds ?? []) as D[], cur = edit === "new" ? ({ is_active: true } as Partial<D>) : list.find((d) => d.id === edit);
  const n = (id: string) => (ps ?? []).filter((p) => p.developer_id === id).length;
  const lbl = "grid gap-1.5 text-sm";
  return (
    <DashboardShell profile={me} locale={locale} active="developers">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{t("dev.title")}</h2>{!cur && <Link href="/admin/developers?edit=new" className={btn("gold", true)}>+ {t("dev.new")}</Link>}</div>
      {cur && (
        <OpForm key={cur.id ?? "new"} action={saveDeveloperAction} submit={t("c.save")} variant="gold" className="mb-8 grid gap-4 rounded-lg bg-surf p-6 sm:grid-cols-2">
          <input type="hidden" name="id" value={cur.id ?? ""} />
          <label className={lbl}><span className="label">{t("dev.nameEn")} *</span><input name="name_en" required defaultValue={cur.name_en ?? ""} className={fieldCls} /></label>
          <label className={lbl}><span className="label">{t("dev.nameAr")}</span><input name="name_ar" dir="rtl" defaultValue={cur.name_ar ?? ""} className={fieldCls} /></label>
          <label className={lbl}><span className="label">{t("dev.slugEn")}</span><input name="slug_en" dir="ltr" defaultValue={cur.slug_en ?? ""} className={fieldCls} /></label>
          <label className={lbl}><span className="label">{t("dev.slugAr")}</span><input name="slug_ar" dir="ltr" defaultValue={cur.slug_ar ?? ""} className={fieldCls} /></label>
          <label className={lbl}><span className="label">{t("dev.website")}</span><input name="website" type="url" dir="ltr" defaultValue={cur.website ?? ""} className={fieldCls} /></label>
          <div className={lbl}><span className="label">{t("dev.logo")}</span><UploadField name="logo_url" folder="developers" accept="image/png,image/jpeg,image/webp" initial={cur.logo_url ?? ""} /></div>
          <label className={lbl}><span className="label">{t("dev.descEn")}</span><textarea name="description_en" rows={3} defaultValue={cur.description_en ?? ""} className={fieldCls + " py-3"} /></label>
          <label className={lbl}><span className="label">{t("dev.descAr")}</span><textarea name="description_ar" rows={3} dir="rtl" defaultValue={cur.description_ar ?? ""} className={fieldCls + " py-3"} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={cur.is_active ?? true} className="h-5 w-5" />{t("dev.active")}</label>
          <div className="sm:col-span-2"><Link href="/admin/developers" className="text-sm underline">{t("c.back")}</Link></div>
        </OpForm>)}
      {!list.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("c.none")}</p> : (
        <ul className="divide-y divide-ln rounded-lg bg-surf">{list.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span><b>{(locale === "ar" ? d.name_ar : null) ?? d.name_en}</b> <span className={clsx("ms-2 rounded-full px-2 py-0.5 text-[11px] font-semibold", d.is_active ? "bg-success/10 text-success" : "bg-surf text-mu")}>{d.is_active ? t("c.published") : t("c.draft")}</span> <span className="text-mu">· {t("dev.projects", { n: n(d.id) })}</span></span>
            <Link href={`/admin/developers?edit=${d.id}`} className={btn("outline", true)}>{t("c.edit")}</Link></li>))}</ul>)}
    </DashboardShell>
  );
}

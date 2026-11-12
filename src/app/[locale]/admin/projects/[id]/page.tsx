import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { ProjectForm, type ProjectInit } from "@/components/ProjectForm";
import { PhotoManager, type Photo } from "@/components/PhotoManager";
import { OpForm } from "@/components/OpForm";
import { addUpdateAction, deleteUpdateAction } from "@/actions/offplan";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAreas } from "@/lib/data";
import { btn } from "@/components/ui/Button";
import { fieldCls } from "@/components/ui/Input";

export const dynamic = "force-dynamic";
const s = (x: unknown) => (x === null || x === undefined ? "" : String(x));

export default async function ProjectEdit({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("op"), sb = await createClient(), isNew = id === "new";
  const [areas, { data: devs }] = await Promise.all([getAreas(locale), sb.from("developers").select("id, name_en, name_ar").order("name_en")]);
  const refs = { areas: areas.map((a) => ({ value: a.code, label: a.name })), developers: (devs ?? []).map((d) => ({ value: d.id as string, label: ((locale === "ar" ? d.name_ar : null) ?? d.name_en) as string })) };
  let init: ProjectInit = { status: "upcoming", completion_pct: "0" }, photos: Photo[] = [], updates: { id: string; update_date: string; title_en: string; title_ar: string | null; completion_pct: number | null }[] = [];
  if (!isNew) {
    const [{ data: p }, { data: m }, { data: u }] = await Promise.all([
      sb.from("projects").select("*, area:areas(code), project_translations(*)").eq("id", id).maybeSingle(),
      sb.from("project_media").select("id, path, is_cover, sort_order").eq("project_id", id).order("sort_order"),
      sb.from("project_updates").select("id, update_date, title_en, title_ar, completion_pct").eq("project_id", id).order("update_date", { ascending: false }),
    ]);
    if (!p) notFound();
    const tr = (l: string) => (p.project_translations as Record<string, string>[]).find((x) => x.locale === l) ?? {};
    const area = (Array.isArray(p.area) ? p.area[0] : p.area) as { code: string } | null;
    init = { id: p.id, developer_id: s(p.developer_id), area_code: s(area?.code), status: s(p.status), launch_date: s(p.launch_date), handover_date: s(p.handover_date), completion_pct: s(p.completion_pct), lat: s(p.lat), lng: s(p.lng),
      brochure_url: s(p.brochure_url), permit_number: s(p.permit_number), is_published: p.is_published ? "1" : "", is_featured: p.is_featured ? "1" : "",
      ...Object.fromEntries(["en", "ar"].flatMap((l) => [[`name_${l}`, s(tr(l).name)], [`slug_${l}`, s(tr(l).slug)], [`tagline_${l}`, s(tr(l).tagline)], [`desc_${l}`, s(tr(l).description)], [`mt_${l}`, s(tr(l).meta_title)], [`md_${l}`, s(tr(l).meta_description)]])) };
    photos = (m ?? []) as Photo[]; updates = (u ?? []) as typeof updates;
  }
  return (
    <DashboardShell profile={me} locale={locale} active="projects">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{isNew ? t("proj.new") : t("proj.edit")}</h2>
        <div className="flex gap-2"><Link href="/admin/projects" className={btn("ghost", true)}>← {t("c.back")}</Link>{!isNew && <Link href={`/admin/projects/${id}/units`} className={btn("outline", true)}>{t("proj.manageUnits")}</Link>}</div></div>
      <ProjectForm locale={locale} init={init} developers={refs.developers} areas={refs.areas} />
      {isNew ? <p className="mt-6 text-sm text-mu">{t("proj.saveFirst")}</p> : (
        <div className="mt-10 grid gap-8">
          <PhotoManager propertyId={id} initial={photos} table="project_media" bucket="project-media" fk="project_id" />
          <section className="rounded-lg bg-surf p-6">
            <h3 className="text-xl font-semibold">{t("proj.updates")}</h3>
            <OpForm action={addUpdateAction} submit={t("proj.post")} okText={t("c.saved")} variant="gold" reset className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="project_id" value={id} />
              <label className="grid gap-1 text-sm"><span className="label">{t("proj.updTitleEn")} *</span><input name="title_en" required className={fieldCls} /></label>
              <label className="grid gap-1 text-sm"><span className="label">{t("proj.updTitleAr")}</span><input name="title_ar" dir="rtl" className={fieldCls} /></label>
              <label className="grid gap-1 text-sm"><span className="label">{t("proj.updBodyEn")}</span><textarea name="body_en" rows={3} className={fieldCls + " py-3"} /></label>
              <label className="grid gap-1 text-sm"><span className="label">{t("proj.updBodyAr")}</span><textarea name="body_ar" rows={3} dir="rtl" className={fieldCls + " py-3"} /></label>
              <label className="grid gap-1 text-sm"><span className="label">{t("proj.updDate")}</span><input type="date" name="update_date" defaultValue={new Date().toISOString().slice(0, 10)} dir="ltr" className={fieldCls} /></label>
              <label className="grid gap-1 text-sm"><span className="label">{t("proj.updPct")}</span><input type="number" name="completion_pct" min={0} max={100} dir="ltr" className={fieldCls} /></label>
            </OpForm>
            {updates.length > 0 && <ul className="mt-5 divide-y divide-ln rounded-2xl bg-bg">{updates.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><b>{(locale === "ar" ? u.title_ar : null) ?? u.title_en}</b> <span className="text-mu" dir="ltr">· {u.update_date}{u.completion_pct !== null ? ` · ${u.completion_pct}%` : ""}</span></span>
                <form action={deleteUpdateAction}><input type="hidden" name="id" value={u.id} /><button className="text-danger">{t("c.delete")}</button></form></li>))}</ul>}
          </section>
        </div>)}
    </DashboardShell>
  );
}

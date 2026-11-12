"use client";
import { useTranslations } from "next-intl";
import { saveProjectAction } from "@/actions/offplan";
import { OpForm } from "@/components/OpForm";
import { UploadField } from "@/components/UploadField";
import { fieldCls } from "@/components/ui/Input";
import { slugify } from "@/lib/slug";

export type ProjectInit = Record<string, string> & { id?: string; is_published?: string; is_featured?: string };
type Opt = { value: string; label: string };
const lbl = "grid gap-1.5 text-sm", cap = "label";

export function ProjectForm({ locale, init, developers, areas }: { locale: string; init: ProjectInit; developers: Opt[]; areas: Opt[] }) {
  const t = useTranslations("op"), v = (k: string) => init[k] ?? "";
  const auto = (l: string) => (e: React.FocusEvent<HTMLInputElement>) => {
    const f = e.currentTarget.form!, slug = f.elements.namedItem(`slug_${l}`) as HTMLInputElement;
    if (slug && !slug.value) slug.value = slugify(e.currentTarget.value);
  };
  const lang = (l: "en" | "ar") => (
    <fieldset className="grid gap-4 rounded-lg bg-bg p-5" dir={l === "ar" ? "rtl" : "ltr"}>
      <legend className="px-2 text-sm font-semibold">{t(`proj.${l}`)}</legend>
      <label className={lbl}><span className={cap}>{t("proj.name")} *</span><input name={`name_${l}`} defaultValue={v(`name_${l}`)} onBlur={auto(l)} className={fieldCls} /></label>
      <label className={lbl}><span className={cap}>{t("proj.slug")} *</span><input name={`slug_${l}`} defaultValue={v(`slug_${l}`)} dir="ltr" className={fieldCls} /></label>
      <label className={lbl}><span className={cap}>{t("proj.tagline")}</span><input name={`tagline_${l}`} defaultValue={v(`tagline_${l}`)} className={fieldCls} /></label>
      <label className={lbl}><span className={cap}>{t("proj.description")}</span><textarea name={`desc_${l}`} defaultValue={v(`desc_${l}`)} rows={6} className={fieldCls + " py-3"} /></label>
      <label className={lbl}><span className={cap}>{t("proj.metaTitle")}</span><input name={`mt_${l}`} defaultValue={v(`mt_${l}`)} maxLength={70} className={fieldCls} /></label>
      <label className={lbl}><span className={cap}>{t("proj.metaDesc")}</span><textarea name={`md_${l}`} defaultValue={v(`md_${l}`)} rows={2} maxLength={170} className={fieldCls + " py-3"} /></label>
    </fieldset>
  );
  return (
    <OpForm action={saveProjectAction} submit={t("c.save")} okText={t("proj.savedOk")} variant="gold" className="grid gap-6">
      <input type="hidden" name="id" value={init.id ?? ""} /><input type="hidden" name="locale" value={locale} />
      <div className="grid gap-6 lg:grid-cols-2">{lang("en")}{lang("ar")}</div>
      <div className="grid gap-4 rounded-lg bg-surf p-6 sm:grid-cols-2 lg:grid-cols-3">
        <label className={lbl}><span className={cap}>{t("proj.developer")}</span><select name="developer_id" defaultValue={v("developer_id")} className={fieldCls}><option value="">{t("proj.noDev")}</option>{developers.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
        <label className={lbl}><span className={cap}>{t("proj.area")}</span><select name="area_code" defaultValue={v("area_code")} className={fieldCls}><option value="">{t("proj.noArea")}</option>{areas.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
        <label className={lbl}><span className={cap}>{t("proj.status")}</span><select name="status" defaultValue={v("status") || "upcoming"} className={fieldCls}>{["upcoming", "launched", "under_construction", "completed"].map((x) => <option key={x} value={x}>{t(`pstat.${x}` as "pstat.upcoming")}</option>)}</select></label>
        <label className={lbl}><span className={cap}>{t("proj.launch")}</span><input type="date" name="launch_date" defaultValue={v("launch_date")} dir="ltr" className={fieldCls} /></label>
        <label className={lbl}><span className={cap}>{t("proj.handover")}</span><input type="date" name="handover_date" defaultValue={v("handover_date")} dir="ltr" className={fieldCls} /></label>
        <label className={lbl}><span className={cap}>{t("proj.completion")}</span><input type="number" name="completion_pct" min={0} max={100} defaultValue={v("completion_pct") || "0"} dir="ltr" className={fieldCls} /></label>
        <label className={lbl}><span className={cap}>{t("proj.lat")}</span><input name="lat" inputMode="decimal" defaultValue={v("lat")} dir="ltr" className={fieldCls} /></label>
        <label className={lbl}><span className={cap}>{t("proj.lng")}</span><input name="lng" inputMode="decimal" defaultValue={v("lng")} dir="ltr" className={fieldCls} /></label>
        <label className={lbl}><span className={cap}>{t("proj.permit")}</span><input name="permit_number" defaultValue={v("permit_number")} dir="ltr" className={fieldCls} /></label>
        <p className="text-xs text-mu sm:col-span-2 lg:col-span-3">{t("proj.mapHint")}</p>
        <div className={lbl + " sm:col-span-2"}><span className={cap}>{t("proj.brochure")}</span><UploadField name="brochure_url" folder="brochures" accept="application/pdf" initial={v("brochure_url")} /><span className="text-xs text-mu">{t("proj.uploadHint")}</span></div>
        <div className="grid content-start gap-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={init.is_published === "1"} className="h-5 w-5" />{t("proj.publish")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="is_featured" defaultChecked={init.is_featured === "1"} className="h-5 w-5" />{t("proj.featured")}</label>
        </div>
        <p className="text-xs text-mu sm:col-span-2 lg:col-span-3">{t("proj.publishHint")}</p>
      </div>
    </OpForm>
  );
}

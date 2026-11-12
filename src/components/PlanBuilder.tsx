"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { savePlanAction } from "@/actions/offplan";
import { OpForm } from "@/components/OpForm";
import { Button } from "@/components/ui/Button";
import { fieldCls } from "@/components/ui/Input";

export type MilestoneIn = { label_en: string; label_ar: string; percentage: string; trigger_type: string; due_offset_days: string; fixed_date: string; construction_stage: string };
export type PlanInit = { id?: string; project_id: string; name_en: string; name_ar: string; description_en: string; description_ar: string; is_active: boolean; milestones: MilestoneIn[] };
const blank = (): MilestoneIn => ({ label_en: "", label_ar: "", percentage: "", trigger_type: "on_booking", due_offset_days: "0", fixed_date: "", construction_stage: "" });
const TRIG = ["on_booking", "fixed_date", "construction_stage", "on_handover", "post_handover"];

/** Milestones must total exactly 100%. The total updates as you type; the database enforces it too. */
export function PlanBuilder({ locale, init, projects }: { locale: string; init: PlanInit; projects: { value: string; label: string }[] }) {
  const t = useTranslations("op"), [f, setF] = useState<PlanInit>({ ...init, milestones: init.milestones.length ? init.milestones : [blank(), blank()] });
  const cents = f.milestones.reduce((a, m) => a + Math.round((parseFloat(m.percentage) || 0) * 100), 0), ok = cents === 10000;
  const set = (k: keyof PlanInit, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const mod = (i: number, k: keyof MilestoneIn, v: string) => setF((x) => ({ ...x, milestones: x.milestones.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const payload = JSON.stringify({ ...f, milestones: f.milestones.map((m) => ({ ...m, due_offset_days: m.trigger_type === "fixed_date" || m.trigger_type === "on_handover" ? "" : m.due_offset_days, fixed_date: ["fixed_date", "construction_stage"].includes(m.trigger_type) ? m.fixed_date : "" })) });
  const lbl = "grid gap-1.5 text-sm";
  return (
    <OpForm action={savePlanAction} submit={t("c.save")} okText={t("plan.saved")} variant="gold" className="grid gap-6">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="payload" value={payload} />
      <div className="grid gap-4 rounded-lg bg-surf p-6 sm:grid-cols-2">
        <label className={lbl}><span className="label">{t("plan.name")} *</span><input value={f.name_en} onChange={(e) => set("name_en", e.target.value)} className={fieldCls} /></label>
        <label className={lbl}><span className="label">{t("plan.nameAr")}</span><input value={f.name_ar} dir="rtl" onChange={(e) => set("name_ar", e.target.value)} className={fieldCls} /></label>
        <label className={lbl}><span className="label">{t("plan.descEn")}</span><input value={f.description_en} onChange={(e) => set("description_en", e.target.value)} className={fieldCls} /></label>
        <label className={lbl}><span className="label">{t("plan.descAr")}</span><input value={f.description_ar} dir="rtl" onChange={(e) => set("description_ar", e.target.value)} className={fieldCls} /></label>
        <label className={lbl}><span className="label">{t("plan.scope")}</span>
          <select value={f.project_id} disabled={!!init.id} onChange={(e) => set("project_id", e.target.value)} className={fieldCls}><option value="">{t("plan.template")}</option>{projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-5 w-5" />{t("plan.active")}</label>
      </div>
      <section className="rounded-lg bg-surf p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">{t("plan.milestones")}</h3>
          <p className={`rounded-full px-4 py-1.5 text-sm font-bold ${ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`} dir="ltr">{t("plan.total")}: {(cents / 100).toFixed(2).replace(/\.00$/, "")}%{!ok && <span className="ms-2 font-semibold">· {t("plan.mustBe100")}</span>}</p></div>
        <ol className="mt-4 grid gap-3">
          {f.milestones.map((m, i) => (
            <li key={i} className="grid gap-3 rounded-2xl bg-bg p-4 sm:grid-cols-12">
              <label className={lbl + " sm:col-span-4"}><span className="label">{t("plan.label")}</span><input value={m.label_en} onChange={(e) => mod(i, "label_en", e.target.value)} className={fieldCls} /></label>
              <label className={lbl + " sm:col-span-4"}><span className="label">{t("plan.labelAr")}</span><input value={m.label_ar} dir="rtl" onChange={(e) => mod(i, "label_ar", e.target.value)} className={fieldCls} /></label>
              <label className={lbl + " sm:col-span-2"}><span className="label">{t("plan.pct")}</span><input inputMode="decimal" value={m.percentage} dir="ltr" onChange={(e) => mod(i, "percentage", e.target.value)} className={fieldCls} /></label>
              <div className="flex items-end sm:col-span-2"><button type="button" onClick={() => setF((x) => ({ ...x, milestones: x.milestones.filter((_, j) => j !== i) }))} disabled={f.milestones.length < 2} className="min-h-[46px] text-sm text-danger disabled:opacity-40">{t("plan.remove")}</button></div>
              <label className={lbl + " sm:col-span-4"}><span className="label">{t("plan.trigger")}</span><select value={m.trigger_type} onChange={(e) => mod(i, "trigger_type", e.target.value)} className={fieldCls}>{TRIG.map((x) => <option key={x} value={x}>{t(`plan.trig.${x}` as "plan.trig.on_booking")}</option>)}</select></label>
              {["on_booking", "construction_stage", "post_handover"].includes(m.trigger_type) && <label className={lbl + " sm:col-span-2"}><span className="label">{t("plan.days")}</span><input type="number" min={0} value={m.due_offset_days} dir="ltr" onChange={(e) => mod(i, "due_offset_days", e.target.value)} className={fieldCls} /></label>}
              {["fixed_date", "construction_stage"].includes(m.trigger_type) && <label className={lbl + " sm:col-span-3"}><span className="label">{t("plan.date")}</span><input type="date" value={m.fixed_date} dir="ltr" onChange={(e) => mod(i, "fixed_date", e.target.value)} className={fieldCls} /></label>}
              {m.trigger_type === "construction_stage" && <label className={lbl + " sm:col-span-3"}><span className="label">{t("plan.stage")}</span><input value={m.construction_stage} onChange={(e) => mod(i, "construction_stage", e.target.value)} className={fieldCls} /></label>}
            </li>))}
        </ol>
        <Button type="button" variant="outline" small className="mt-4" onClick={() => setF((x) => ({ ...x, milestones: [...x.milestones, blank()] }))}>+ {t("plan.addRow")}</Button>
      </section>
    </OpForm>
  );
}

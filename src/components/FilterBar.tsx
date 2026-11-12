"use client";
import clsx from "clsx";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import type { AreaOpt } from "@/lib/data";
import { short } from "@/lib/money";

const TYPES = ["apartment", "villa", "townhouse", "studio", "penthouse", "duplex", "land", "office"] as const;
const sliderToMax = (s: number) => (s >= 100 ? 0 : Math.round((50000 * Math.pow(400, s / 100)) / 1e4) * 1e4);
const maxToSlider = (m: number) => (m ? Math.round((Math.log(m / 50000) / Math.log(400)) * 100) : 100);

/** URL is the single source of truth: every change updates the query string, so results are shareable and server-rendered. */
export function FilterBar({ areas }: { areas: AreaOpt[] }) {
  const t = useTranslations(), sp = useSearchParams(), router = useRouter(), path = usePathname();
  const [pending, start] = useTransition(), [open, setOpen] = useState(false);
  const get = (k: string) => sp.get(k) ?? "";
  const purpose = get("offplan") ? "off" : get("purpose"), view = get("view") === "map" ? "map" : "grid";
  const [slide, setSlide] = useState(maxToSlider(Number(get("maxPrice")) || 0));
  useEffect(() => setSlide(maxToSlider(Number(sp.get("maxPrice")) || 0)), [sp]);

  const set = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(sp.toString()); q.delete("page");
    Object.entries(patch).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    start(() => router.replace(`${path}${q.toString() ? `?${q}` : ""}`, { scroll: false }));
  };
  useEffect(() => { const h = setTimeout(() => { const m = sliderToMax(slide); if (String(m || "") !== (sp.get("maxPrice") ?? "")) set({ maxPrice: m ? String(m) : undefined }); }, 350); return () => clearTimeout(h); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slide]);

  const sel = "min-h-11 rounded-full bg-bg px-4 text-sm font-semibold text-tx";
  const seg = (items: [string, string][], cur: string, on: (v: string) => void, extra = "") => (
    <div className={clsx("inline-flex gap-0.5 rounded-full bg-bg p-1", extra)}>{items.map(([v, l]) => (
      <button key={v} type="button" onClick={() => on(v)} className={clsx("rounded-full px-4 py-2 text-[13px] font-semibold transition", cur === v ? "bg-tx text-bg" : "text-mu")}>{l}</button>))}</div>
  );
  const L = ({ l, children }: { l: string; children: React.ReactNode }) => <label className="grid gap-1.5"><span className="label">{l}</span>{children}</label>;
  return (
    <div className={clsx("mt-7", pending && "opacity-70 transition-opacity")}>
      <button type="button" onClick={() => setOpen(!open)} className="rounded-full border-[1.5px] border-ln px-5 py-2 text-[13px] font-semibold md:hidden" aria-expanded={open}>{t("v2.x.fil")}</button>
      <div className={clsx("mt-3 flex-wrap items-end gap-3.5 rounded-xl bg-surf p-4 md:mt-0 md:flex", open ? "flex" : "hidden")}>
        {seg([["", t("v2.x.all")], ["sale", t("nav.buy")], ["rent", t("nav.rent")], ["off", t("nav.offplan")]], purpose,
          (v) => set({ purpose: v === "off" ? "sale" : v || undefined, offplan: v === "off" ? "1" : undefined }))}
        <L l={t("search.area")}><select className={sel} value={get("area")} onChange={(e) => set({ area: e.target.value || undefined })}><option value="">{t("v2.x.any")}</option>{areas.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</select></L>
        <L l={t("search.type")}><select className={sel} value={get("type")} onChange={(e) => set({ type: e.target.value || undefined })}><option value="">{t("v2.x.any")}</option>{TYPES.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}</select></L>
        <L l={t("list.beds")}><select className={sel} value={get("beds")} onChange={(e) => set({ beds: e.target.value || undefined })}><option value="">{t("v2.x.any")}</option><option value="s">{t("v2.x.studio")}</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}</select></L>
        <L l={t("list.maxPrice")}><span className="grid gap-1"><input type="range" min={0} max={100} value={slide} onChange={(e) => setSlide(+e.target.value)} aria-label={t("list.maxPrice")} className="mt-3 w-44 accent-gold-3" /><b className="text-sm normal-case tracking-normal text-tx">{slide >= 100 ? t("v2.x.any") : `AED ${short(sliderToMax(slide))}`}</b></span></L>
        <L l={t("list.sort")}><select className={sel} value={get("sort") || "newest"} onChange={(e) => set({ sort: e.target.value === "newest" ? undefined : e.target.value })}><option value="newest">{t("list.newest")}</option><option value="price_asc">{t("v2.x.lo")}</option><option value="price_desc">{t("v2.x.hi")}</option></select></L>
        {seg([["grid", t("v2.x.gr")], ["map", t("v2.x.mpv")]], view, (v) => set({ view: v === "map" ? "map" : undefined }), "ms-auto")}
      </div>
    </div>
  );
}

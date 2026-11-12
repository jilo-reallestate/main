"use client";
import clsx from "clsx";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { AreaOpt } from "@/lib/data";

const TYPES = ["apartment", "villa", "townhouse", "studio", "penthouse"] as const;

/** Buy / Rent / Off-plan tabs + a search box with suggestions. Sends people to /properties with the filters applied. */
export function HeroSearch({ areas }: { areas: AreaOpt[] }) {
  const t = useTranslations(), r = useRouter();
  const [mode, setMode] = useState("sale"), [q, setQ] = useState(""), [key, setKey] = useState(""), [open, setOpen] = useState(false), [type, setType] = useState(""), [beds, setBeds] = useState("");
  const sug = areas.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const area = key || areas.find((a) => q && a.name.toLowerCase().includes(q.toLowerCase()))?.code || "";
    const p = new URLSearchParams({ purpose: mode === "rent" ? "rent" : "sale" });
    if (mode === "off") p.set("offplan", "1"); if (area) p.set("area", area); if (type) p.set("type", type); if (beds) p.set("beds", beds);
    if (mode === "off") { r.push(`/projects${area ? `?area=${encodeURIComponent(area)}` : ""}`); return; }
    r.push(`/properties?${p}`);
  };
  const field = "relative min-w-0 flex-1 border-white/20 px-5 py-1.5 sm:border-e max-sm:basis-[40%]";
  const ctl = "w-full appearance-none bg-transparent text-[15px] font-semibold text-white outline-none";
  return (
    <div className="mt-7">
      <div className="inline-flex gap-0.5 rounded-full bg-white/15 p-1 backdrop-blur-md" role="tablist">
        {[["sale", t("nav.buy")], ["rent", t("nav.rent")], ["off", t("nav.offplan")]].map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={mode === v} onClick={() => setMode(v)} className={clsx("rounded-full px-5 py-2.5 text-[13px] font-semibold transition", mode === v ? "bg-white text-[#0B0D0E]" : "text-white/75")}>{l}</button>))}
      </div>
      <form onSubmit={submit} autoComplete="off" className="mt-3 flex max-w-[940px] flex-wrap items-center gap-1.5 rounded-[36px] border border-white/25 bg-white/10 p-2 shadow-[0_30px_80px_rgba(0,0,0,.4)] backdrop-blur-2xl sm:flex-nowrap sm:rounded-full">
        <div className={field}>
          <span className="label !text-white/65">{t("search.area")}</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setKey(""); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)} placeholder={t("v2.x.ph2")} aria-label={t("v2.x.ph2")} className={clsx(ctl, "placeholder:text-white/55")} />
          {open && sug.length > 0 && (
            <div className="absolute bottom-[calc(100%+18px)] start-0 z-30 w-[360px] max-w-[80vw] rounded-lg bg-bg p-2 text-tx shadow-2xl max-sm:bottom-auto max-sm:top-[calc(100%+10px)]">
              {sug.map((a) => <button key={a.code} type="button" onMouseDown={() => { setQ(a.name); setKey(a.code); setOpen(false); }} className="flex w-full justify-between rounded-2xl px-3.5 py-2.5 text-start text-sm hover:bg-surf">{a.name}<i className="text-[11px] font-bold not-italic text-ac">{t("v2.x.sa")}</i></button>)}
            </div>)}
        </div>
        <div className={field}><span className="label !text-white/65">{t("search.type")}</span><select value={type} onChange={(e) => setType(e.target.value)} className={ctl}><option className="text-black" value="">{t("v2.x.any")}</option>{TYPES.map((x) => <option className="text-black" key={x} value={x}>{t(`types.${x}`)}</option>)}</select></div>
        <div className={clsx(field, "sm:border-e-0")}><span className="label !text-white/65">{t("list.beds")}</span><select value={beds} onChange={(e) => setBeds(e.target.value)} className={ctl}><option className="text-black" value="">{t("v2.x.any")}</option><option className="text-black" value="s">{t("v2.x.studio")}</option>{[1, 2, 3, 4].map((n) => <option className="text-black" key={n} value={n}>{n}+</option>)}</select></div>
        <button className="min-h-[50px] w-full rounded-full bg-goldgrad px-7 font-bold text-[#1a1409] transition hover:shadow-lg sm:w-auto">{t("v2.go")}</button>
      </form>
    </div>
  );
}

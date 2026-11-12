"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Overlay } from "@/components/Overlay";
import { searchProperties, type AreaOpt, type Hit } from "@/lib/data";
import { useApp } from "@/components/Providers";

const TYPES = ["apartment", "villa", "townhouse", "studio", "penthouse"] as const;

export function CommandPalette({ areas, locale }: { areas: AreaOpt[]; locale: string }) {
  const { searchOpen, setSearchOpen } = useApp();
  const t = useTranslations(), r = useRouter();
  const [q, setQ] = useState(""), [hits, setHits] = useState<Hit[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (searchOpen) { setQ(""); setTimeout(() => ref.current?.focus(), 30); } }, [searchOpen]);
  useEffect(() => { const h = setTimeout(() => searchProperties(q, locale).then(setHits), 180); return () => clearTimeout(h); }, [q, locale]);
  const v = q.trim().toLowerCase();
  const A = useMemo(() => areas.filter((a) => !v || a.name.toLowerCase().includes(v)), [areas, v]);
  const Ty = TYPES.filter((x) => !v || t(`types.${x}`).toLowerCase().includes(v));
  if (!searchOpen) return null;
  const go = (href: string) => { setSearchOpen(false); r.push(href); };
  const first = () => (A[0] ? go(`/properties?area=${A[0].code}`) : Ty[0] ? go(`/properties?type=${Ty[0]}`) : hits[0] ? go(`/properties/${hits[0].slug}`) : null);
  const row = "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-start text-[15px] hover:bg-surf focus-visible:bg-surf";
  const gr = (s: string) => <div className="label px-2 pb-1 pt-4">{s}</div>;
  return (
    <Overlay onClose={() => setSearchOpen(false)} align="top">
      <div className="w-full max-w-[640px] rounded-lg bg-bg p-3.5 shadow-2xl">
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && first()}
          placeholder={t("v2.x.q1")} aria-label={t("v2.x.q1")} autoComplete="off" className="min-h-[58px] w-full rounded-2xl bg-surf px-5 text-lg text-tx outline-none placeholder:text-mu" />
        <div className="max-h-[55vh] overflow-auto">
          {A.length > 0 && <>{gr(t("v2.x.pop"))}{A.map((a) => <button key={a.code} className={row} onClick={() => go(`/properties?area=${a.code}`)}>{a.name}<i className="text-sm not-italic text-mu">{t("v2.x.sa")}</i></button>)}</>}
          {Ty.length > 0 && <>{gr(t("v2.x.typ"))}{Ty.map((x) => <button key={x} className={row} onClick={() => go(`/properties?type=${x}`)}>{t(`types.${x}`)}</button>)}</>}
          {hits.length > 0 && <>{gr(t("v2.x.prp"))}{hits.map((h) => <button key={h.slug} className={row} onClick={() => go(`/properties/${h.slug}`)}>{h.title}<i className="text-sm not-italic text-mu">{h.area}</i></button>)}</>}
          {!A.length && !Ty.length && !hits.length && gr(t("v2.x.nr"))}
        </div>
        <p className="mt-2 text-center text-xs text-mu">{t("v2.x.esc")}</p>
      </div>
    </Overlay>
  );
}

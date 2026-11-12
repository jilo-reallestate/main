"use client";
import clsx from "clsx";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Overlay } from "@/components/Overlay";
import { Art } from "@/components/Art";

export type Slide = { src?: string; alt: string; seed: number };

/** Photo grid + full-screen viewer (arrow keys, Esc). Falls back to generated artwork until real photos are uploaded. */
export function Gallery({ slides }: { slides: Slide[] }) {
  const t = useTranslations("v2.x"), [k, setK] = useState<number | null>(null), n = slides.length;
  const nav = useCallback((d: number) => setK((x) => (x === null ? x : (x + d + n) % n)), [n]);
  useEffect(() => { if (k === null) return; const h = (e: KeyboardEvent) => { if (e.key === "ArrowRight") nav(1); if (e.key === "ArrowLeft") nav(-1); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [k, nav]);
  const tile = (s: Slide, i: number, big: boolean) => (
    <button key={i} type="button" onClick={() => setK(i)} aria-label={`${t("pho")} ${i + 1}`} className={clsx("group relative overflow-hidden rounded-lg bg-surf", big ? "col-span-2 row-span-2" : "max-md:hidden")}>
      {s.src ? <Image src={s.src} alt={s.alt} fill priority={i === 0} sizes={big ? "(min-width:768px) 50vw, 100vw" : "25vw"} className="object-cover transition-transform duration-700 group-hover:scale-105" />
        : <Art seed={s.seed + i} h={big ? 420 : 300} className="absolute inset-0 transition-transform duration-700 group-hover:scale-105 [&_svg]:h-full [&_svg]:w-full" />}
      {i === 4 && n > 5 && <span className="absolute inset-0 grid place-items-center bg-black/45 font-bold text-white">+{n - 5} {t("pho")}</span>}
    </button>
  );
  return (
    <>
      <div className="grid h-[clamp(260px,44vw,540px)] grid-cols-2 gap-2.5 md:grid-cols-4 md:grid-rows-2">{slides.slice(0, 5).map((s, i) => tile(s, i, i === 0))}</div>
      {k !== null && (
        <Overlay onClose={() => setK(null)}>
          <div className="relative w-full max-w-[1000px]">
            <button aria-label="Close" onClick={() => setK(null)} className="absolute end-3 top-3 z-10 h-10 w-10 rounded-full bg-white/85 text-black">✕</button>
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-surf">{slides[k].src ? <Image src={slides[k].src!} alt={slides[k].alt} fill sizes="1000px" className="object-contain" /> : <Art seed={slides[k].seed + k} h={420} className="h-full [&_svg]:h-full [&_svg]:w-full" />}</div>
            {n > 1 && <>
              <button aria-label="Previous" onClick={() => nav(-1)} className="absolute start-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/85 text-xl text-black">‹</button>
              <button aria-label="Next" onClick={() => nav(1)} className="absolute end-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/85 text-xl text-black">›</button></>}
            <p className="mt-3.5 text-center font-semibold text-white">{k + 1} / {n}</p>
          </div>
        </Overlay>)}
    </>
  );
}

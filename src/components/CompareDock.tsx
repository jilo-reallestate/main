"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Overlay } from "@/components/Overlay";
import { Art } from "@/components/Art";
import { useApp } from "@/components/Providers";

export function CompareDock() {
  const { cmp, clearCmp, removeCmp, compareOpen, setCompareOpen, toast } = useApp();
  const t = useTranslations("v2.x");
  const kf = t.raw("kf") as string[];
  const rows: [string, (i: (typeof cmp)[number]) => string][] = [
    [t("sa"), (i) => i.area], [t("cp"), (i) => i.price], [t("pf"), (i) => i.ppsf], [kf[3], (i) => i.type], [kf[0], (i) => i.beds], [kf[1], (i) => i.baths], [kf[2], (i) => i.size],
  ];
  return (
    <>
      {cmp.length > 0 && (
        <div className="fixed inset-x-3 bottom-24 z-[60] flex items-center justify-between gap-3 rounded-full bg-ink py-2 pe-2 ps-5 text-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2">
          <span className="flex items-center">{cmp.map((i) => <span key={i.id} className="-me-2.5 h-9 w-9 overflow-hidden rounded-full border-2 border-ink [&_svg]:h-full [&_svg]:w-full"><Art seed={i.seed} /></span>)}</span>
          <b className="ms-3 text-sm">{cmp.length}/3</b>
          <button onClick={clearCmp} className="text-[13px] text-white/60">{t("cl")}</button>
          <button onClick={() => (cmp.length < 2 ? toast(`${t("cp")} 2+`) : setCompareOpen(true))} className="min-h-10 rounded-full bg-goldgrad px-4 font-bold text-[#1a1409]">{t("cp")} →</button>
        </div>
      )}
      {compareOpen && cmp.length > 1 && (
        <Overlay onClose={() => setCompareOpen(false)}>
          <div className="relative max-h-[92vh] w-full max-w-[920px] overflow-auto rounded-xl bg-bg p-6">
            <button aria-label="Close" onClick={() => setCompareOpen(false)} className="absolute end-4 top-4 h-10 w-10 rounded-full bg-surf">✕</button>
            <h2 className="mb-5 text-3xl">{t("cpT")}</h2>
            <div className="overflow-x-auto"><table className="min-w-[560px] w-full border-collapse text-sm">
              <thead><tr><th className="w-32" />{cmp.map((i) => (
                <td key={i.id} className="p-2.5 align-top"><Art seed={i.seed} className="mb-2 aspect-[4/3] overflow-hidden rounded-2xl [&_svg]:h-full [&_svg]:w-full" />
                  <Link href={i.href} onClick={() => setCompareOpen(false)} className="font-bold">{i.title}</Link><br />
                  <button onClick={() => { removeCmp(i.id); if (cmp.length <= 2) setCompareOpen(false); }} className="text-xs text-danger">{t("rm")}</button></td>))}</tr></thead>
              <tbody>{rows.map(([l, f]) => <tr key={l} className="border-t border-ln"><th className="p-2.5 text-start font-semibold text-mu">{l}</th>{cmp.map((i) => <td key={i.id} className="p-2.5">{f(i)}</td>)}</tr>)}</tbody>
            </table></div>
          </div>
        </Overlay>
      )}
    </>
  );
}

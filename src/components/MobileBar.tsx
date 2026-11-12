"use client";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { useApp } from "@/components/Providers";

/** Bottom tab bar on phones. Hidden on property pages (they have their own action bar) and in the dashboards. */
export function MobileBar() {
  const p = usePathname(), t = useTranslations("v2.x"), { saved, setSearchOpen } = useApp();
  if (/^\/(admin|agent|account|login|signup|dashboard)/.test(p) || /^\/properties\/.+/.test(p)) return null;
  const tab = "relative flex flex-1 flex-col items-center rounded-full px-1 py-2 text-[11px] font-semibold";
  const on = (a: boolean) => (a ? "bg-tx text-bg" : "text-mu");
  return (
    <nav aria-label="Primary" className="glass fixed inset-x-3 bottom-3 z-50 flex gap-1 rounded-full p-1.5 shadow-2xl md:hidden">
      <Link href="/" className={clsx(tab, on(p === "/"))}><span className="text-xl leading-none">⌂</span>{t("hm")}</Link>
      <button onClick={() => setSearchOpen(true)} className={clsx(tab, on(false))}><span className="text-xl leading-none">⌕</span>{t("sr")}</button>
      <Link href="/saved" className={clsx(tab, on(p === "/saved"))}><span className="text-xl leading-none">♡</span>{t("svT")}{saved.size > 0 && <b className="absolute end-3 top-0.5 min-w-4 rounded-full bg-goldgrad px-1 text-[10px] text-[#1a1409]">{saved.size}</b>}</Link>
      <Link href="/dashboard" className={clsx(tab, on(false))}><span className="text-xl leading-none">◉</span>{t("ac")}</Link>
    </nav>
  );
}

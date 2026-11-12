"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Live countdown to a reservation's expiry. Renders after mount so server and browser never disagree about the time. */
export function Countdown({ to, className = "" }: { to: string; className?: string }) {
  const t = useTranslations("op.res"), [now, setNow] = useState<number | null>(null), end = new Date(to).getTime();
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (now === null) return <span className={className}>…</span>;
  const ms = end - now;
  if (ms <= 0) return <span className={`font-semibold text-danger ${className}`}>{t("expired")}</span>;
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), sec = Math.floor((ms % 60e3) / 1e3);
  const txt = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  return <span dir="ltr" className={`font-semibold tabular-nums ${ms < 3600e3 ? "text-danger" : ms < 6 * 3600e3 ? "text-warning" : "text-success"} ${className}`}>{t("left", { t: txt })}</span>;
}

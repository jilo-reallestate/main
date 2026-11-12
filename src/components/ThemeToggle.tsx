"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Light / dark switch. Starts from the visitor's system setting; once they choose, the choice is remembered in this browser. */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const t = useTranslations("nav"), [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => { const d = document.documentElement.dataset.theme; setDark(d ? d === "dark" : matchMedia("(prefers-color-scheme: dark)").matches); }, []);
  function flip() {
    const next = !dark; setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("jilo-theme", next ? "dark" : "light"); } catch { /* private mode: still switches for this visit */ }
  }
  return (
    <button type="button" onClick={flip} aria-label={t("theme")} aria-pressed={dark === true} title={t("theme")}
      className={`grid h-10 w-10 place-items-center rounded-full text-lg ${onDark ? "text-white/80 hover:text-white" : "text-mu hover:bg-surf hover:text-tx"}`}>
      <span aria-hidden>{dark === null ? "◐" : dark ? "☀" : "☾"}</span>
    </button>
  );
}

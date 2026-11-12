"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney, type Currency } from "@/lib/money";

/** Indicative only: 25 years at 4.5%. A real quote needs a bank. */
export function MortgageCalc({ price, currency }: { price: number; currency: Currency }) {
  const t = useTranslations("v2"), locale = useLocale(), [dp, setDp] = useState(20);
  const r = 0.045 / 12, n = 300, p = price * (1 - dp / 100), m = (p * r) / (1 - Math.pow(1 + r, -n));
  return (
    <div className="rounded-lg border border-ln p-6">
      <span className="label">{t("calc")}</span>
      <p className="my-2 mb-4 text-4xl font-bold tracking-tight">{formatMoney(Math.round(m), currency, locale)} <small className="text-sm font-medium text-mu">{t("pm")}</small></p>
      <label className="text-sm text-mu">{t("down")}: <b className="text-tx">{dp}%</b>
        <input type="range" min={10} max={60} value={dp} onChange={(e) => setDp(+e.target.value)} className="mt-2 w-full accent-gold-3" /></label>
    </div>
  );
}

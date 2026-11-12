export type Currency = "AED" | "USD" | "GBP";

/** Display-only formatting. Store money as numeric(14,2) + currency_code in the DB. Latin digits are forced for Arabic. */
export function formatMoney(amount: number, currency: Currency, locale: string) {
  const tag = locale === "ar" ? "ar-AE-u-nu-latn" : "en-AE";
  return new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
export const short = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(".0", "") + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);

export function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai",
  }).format(new Date(iso));
}
export function formatNumber(n: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-AE").format(n);
}
export function formatDay(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dubai" }).format(new Date(iso));
}
export function formatTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }).format(new Date(iso));
}
export function dayKey(iso: string) { return new Date(new Date(iso).getTime() + 4 * 3600e3).toISOString().slice(0, 10); }
export function timeAgo(iso: string, locale: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000), f = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  return m < 60 ? f.format(-Math.max(m, 0), "minute") : m < 1440 ? f.format(-Math.round(m / 60), "hour") : f.format(-Math.round(m / 1440), "day");
}

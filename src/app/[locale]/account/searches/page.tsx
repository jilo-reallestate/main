import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { deleteSearchAction, updateSearchAction } from "@/actions/portal";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { short } from "@/lib/money";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
export default async function SearchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["client"]), t = await getTranslations("portal.search"), ty = await getTranslations("types"), nav = await getTranslations("nav"), sb = await createClient();
  const [{ data }, { data: areas }] = await Promise.all([
    sb.from("saved_searches").select("id, name, filters, alerts_enabled, frequency, created_at").order("created_at", { ascending: false }),
    sb.from("areas").select("code, area_translations(locale, name)").eq("level", "community"),
  ]);
  const aname = (code: string) => { const a = (areas ?? []).find((x) => x.code === code); return (a?.area_translations as { locale: string; name: string }[] | undefined)?.find((x) => x.locale === locale)?.name ?? code; };
  const summary = (f: Record<string, string>) => [f.offplan ? nav("offplan") : f.purpose === "sale" ? nav("buy") : f.purpose === "rent" ? nav("rent") : "", f.area ? aname(f.area) : "", f.type ? ty(f.type as "villa") : "", f.beds ? (f.beds === "s" ? "Studio" : `${f.beds}+ bd`) : "", f.maxPrice ? `≤ AED ${short(Number(f.maxPrice))}` : ""].filter(Boolean).join(" · ") || t("all");
  const qs = (f: Record<string, string>) => new URLSearchParams(f).toString();
  return (
    <DashboardShell profile={me} locale={locale} active="searches">
      <h2 className="mb-5 text-2xl">{t("title")}</h2>
      {!data?.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("empty")}</p> : (
        <ul className="grid gap-3">{data.map((s) => {
          const f = s.filters as Record<string, string>;
          return (
            <li key={s.id as string} className="flex flex-wrap items-center gap-4 rounded-lg bg-surf p-5">
              <div className="min-w-0 flex-1"><b className="block text-lg">{s.name as string}</b><span className="text-sm text-mu">{summary(f)} · {formatDate(s.created_at as string, locale)}</span></div>
              <form action={updateSearchAction} className="flex items-center gap-2"><input type="hidden" name="id" value={s.id as string} />
                <AutoSubmitSelect name="frequency" defaultValue={s.frequency as string} className="rounded-full bg-bg px-3 py-2 text-sm font-semibold">{["instant", "daily", "weekly"].map((x) => <option key={x} value={x}>{t(`frequency.${x}` as "frequency.daily")}</option>)}</AutoSubmitSelect></form>
              <form action={updateSearchAction}><input type="hidden" name="id" value={s.id as string} /><input type="hidden" name="alerts_enabled" value={s.alerts_enabled ? "false" : "true"} />
                <button aria-pressed={s.alerts_enabled as boolean} className={btn(s.alerts_enabled ? "gold" : "outline", true)}>🔔 {t("alerts")}: {s.alerts_enabled ? t("on") : t("off")}</button></form>
              <Link href={`/properties?${qs(f)}`} className={btn("outline", true)}>{t("view")} →</Link>
              <form action={deleteSearchAction}><input type="hidden" name="id" value={s.id as string} /><button className={btn("ghost", true, "!text-danger")}>{t("delete")}</button></form>
            </li>); })}</ul>)}
    </DashboardShell>
  );
}

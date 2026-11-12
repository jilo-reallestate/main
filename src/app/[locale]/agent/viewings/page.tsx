import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { viewingStatusAction } from "@/actions/crm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayKey, formatDay, formatTime } from "@/lib/format";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
const TONE: Record<string, string> = { requested: "bg-warning/15 text-warning", confirmed: "bg-info/10 text-info", completed: "bg-success/10 text-success", cancelled: "bg-surf text-mu", no_show: "bg-danger/10 text-danger" };

export default async function ViewingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const { tab } = await searchParams, past = tab === "past", me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("crm"), sb = await createClient();
  const cutoff = new Date(Date.now() - 3 * 3600e3).toISOString();
  let q = sb.from("viewings").select("id, scheduled_at, status, lead_id, contact:contacts(full_name, phone), listing:listings(property:properties(reference_code, property_translations(locale, title)))").limit(200);
  q = past ? q.lt("scheduled_at", cutoff).order("scheduled_at", { ascending: false }) : q.gte("scheduled_at", cutoff).order("scheduled_at", { ascending: true });
  if (me.role !== "admin") q = q.eq("agent_id", me.id);
  const { data } = await q; const rows = (data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const groups = new Map<string, any[]>(); rows.forEach((r) => groups.set(dayKey(r.scheduled_at), [...(groups.get(dayKey(r.scheduled_at)) ?? []), r]));
  const act = (id: string, status: string, label: string, v: "gold" | "outline" | "ghost" = "outline") => <form action={viewingStatusAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><button className={btn(v, true)}>{label}</button></form>;
  return (
    <DashboardShell profile={me} locale={locale} active="viewings">
      <nav className="mb-5 flex gap-1.5">{[["", t("viewings.upcoming")], ["past", t("viewings.past")]].map(([k, l]) => <Link key={k} href={k ? "/agent/viewings?tab=past" : "/agent/viewings"} className={clsx("rounded-full px-4 py-2 text-sm font-semibold", (tab ?? "") === k ? "bg-tx text-bg" : "bg-surf text-mu")}>{l}</Link>)}</nav>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("viewings.none")}</p> : [...groups.entries()].map(([k, list]) => (
        <section key={k} className="mb-7"><h3 className="mb-3 text-lg tracking-tight">{formatDay(list[0].scheduled_at, locale)}</h3>
          <ul className="grid gap-2.5">{list.map((v) => {
            const ptr = v.listing?.property?.property_translations?.find((x: { locale: string }) => x.locale === locale) ?? v.listing?.property?.property_translations?.[0];
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-4 rounded-lg bg-surf p-4">
                <b className="w-16 text-lg tabular-nums" dir="ltr">{formatTime(v.scheduled_at, locale)}</b>
                <div className="min-w-0 flex-1"><p className="font-semibold">{v.contact?.full_name} <span className="font-normal text-mu" dir="ltr">{v.contact?.phone}</span></p><p className="text-sm text-mu">{ptr?.title ?? v.listing?.property?.reference_code ?? "—"}</p></div>
                <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[v.status])}>{t(`vstat.${v.status}` as "vstat.requested")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {v.status === "requested" && act(v.id, "confirmed", t("viewings.confirm"), "gold")}
                  {(v.status === "requested" || v.status === "confirmed") && <>{act(v.id, "completed", t("viewings.complete"))}{act(v.id, "no_show", t("viewings.noShow"), "ghost")}{act(v.id, "cancelled", t("viewings.cancel"), "ghost")}</>}
                  {v.lead_id && <Link href={`/agent/leads/${v.lead_id}`} className={btn("ghost", true)}>→</Link>}
                </div>
              </li>);
          })}</ul></section>))}
    </DashboardShell>
  );
}

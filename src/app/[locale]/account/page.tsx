import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { cancelViewingAction } from "@/actions/portal";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
const TONE: Record<string, string> = { requested: "bg-warning/15 text-warning", confirmed: "bg-info/10 text-info", completed: "bg-success/10 text-success", cancelled: "bg-surf text-mu", no_show: "bg-danger/10 text-danger" };
type V = { id: string; scheduled_at: string; status: string; listing: { property: { reference_code: string; property_translations: { locale: string; slug: string; title: string }[] } | null } | null };
type L = { id: string; created_at: string; status: string; message: string | null; assigned_agent_id: string | null };

export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["client"]), t = await getTranslations("portal.ov"), c = await getTranslations("crm"), sb = await createClient();
  // Row Level Security returns only this person's own rows
  const [{ data: vs }, { data: ls }] = await Promise.all([
    sb.from("viewings").select("id, scheduled_at, status, listing:listings(property:properties(reference_code, property_translations(locale, slug, title)))").order("scheduled_at", { ascending: true }).limit(30),
    sb.from("leads").select("id, created_at, status, message, assigned_agent_id").order("created_at", { ascending: false }).limit(20),
  ]);
  const views = (vs ?? []) as unknown as V[], leads = (ls ?? []) as unknown as L[], cutoff = Date.now() - 3 * 3600e3;
  const upcoming = views.filter((v) => new Date(v.scheduled_at).getTime() >= cutoff && v.status !== "cancelled"), rest = views.filter((v) => !upcoming.includes(v)).reverse();
  const row = (v: V, canCancel: boolean) => {
    const tr = v.listing?.property?.property_translations.find((x) => x.locale === locale) ?? v.listing?.property?.property_translations[0];
    return (
      <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surf p-4">
        <div className="min-w-0 flex-1"><b className="block">{formatDate(v.scheduled_at, locale)}</b><span className="text-sm text-mu">{tr ? <Link href={`/properties/${tr.slug}`} className="underline">{tr.title}</Link> : "—"}</span></div>
        <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[v.status])}>{c(`vstat.${v.status}` as "vstat.requested")}</span>
        {canCancel && (v.status === "requested" || v.status === "confirmed") && <form action={cancelViewingAction}><input type="hidden" name="id" value={v.id} /><button className={btn("outline", true, "!text-danger")}>{t("cancel")}</button></form>}
      </li>);
  };
  return (
    <DashboardShell profile={me} locale={locale} active="overview">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-8">
          <section><h2 className="mb-4 text-2xl">{t("viewings")}</h2>
            {upcoming.length ? <ul className="grid gap-2.5">{upcoming.map((v) => row(v, true))}</ul> : <p className="rounded-lg bg-surf p-8 text-center text-mu">{t("none")}</p>}
            <p className="mt-3 text-sm text-mu">{t("help")}</p>
            {rest.length > 0 && <ul className="mt-5 grid gap-2.5 opacity-80">{rest.slice(0, 5).map((v) => row(v, false))}</ul>}</section>
          <section><h2 className="mb-4 text-2xl">{t("enquiries")}</h2>
            {leads.length ? <ul className="grid gap-2.5">{leads.map((l) => <li key={l.id} className="rounded-lg bg-surf p-4 text-sm"><b>{formatDate(l.created_at, locale)}</b>{l.message && <p className="mt-1 text-mu">{l.message}</p>}
              {l.assigned_agent_id && <Link href={`/account/messages?lead=${l.id}`} className="mt-2 inline-block font-semibold underline">{t("msgAgent")} →</Link>}</li>)}</ul> : <p className="rounded-lg bg-surf p-8 text-center text-mu">{t("noEnq")}</p>}</section>
        </div>
        <aside className="grid content-start gap-4">
          <Link href="/saved" className="rounded-lg bg-surf p-6 hover:bg-ln"><span className="text-3xl">♡</span><b className="mt-2 block text-lg">{t("saved")}</b></Link>
          <Link href="/properties" className={btn("gold")}>{t("browse")} →</Link>
        </aside>
      </div>
    </DashboardShell>
  );
}

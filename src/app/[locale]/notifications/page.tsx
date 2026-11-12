import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { markAllNotificationsRead } from "@/actions/portal";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
type N = { id: string; type: string; title: string; body: string | null; data: Record<string, string>; read_at: string | null; created_at: string };

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["client", "agent", "admin"]), t = await getTranslations("portal.notif"), sb = await createClient();
  const { data } = await sb.from("notifications").select("id, type, title, body, data, read_at, created_at").order("created_at", { ascending: false }).limit(60);
  const rows = (data ?? []) as N[], unread = rows.some((r) => !r.read_at);
  const href = (n: N) => n.type === "new_message" ? (me.role === "client" ? `/account/messages?lead=${n.data.lead_id}` : `/agent/leads/${n.data.lead_id}`)
    : n.type === "lead_assigned" || n.type === "lead_sla_breach" ? `/agent/leads/${n.data.lead_id}` : n.type === "saved_search" ? `/properties?${n.data.qs ?? ""}` : me.role === "client" ? "/account" : null;
  return (
    <DashboardShell profile={me} locale={locale}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{t("title")}</h2>
        {unread && <form action={markAllNotificationsRead}><button className={btn("outline", true)}>{t("markAll")}</button></form>}</div>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("none")}</p> : (
        <ul className="grid gap-2.5">{rows.map((n) => { const h = href(n), label = t.has(n.type as "new_message") ? t(n.type as "new_message") : n.title; return (
          <li key={n.id} className={clsx("flex flex-wrap items-center gap-3 rounded-lg p-4", n.read_at ? "bg-surf" : "bg-surf ring-2 ring-gold-3")}>
            {!n.read_at && <span className="h-2.5 w-2.5 rounded-full bg-goldgrad" aria-label="unread" />}
            <div className="min-w-0 flex-1"><b className="block">{n.type === "saved_search" ? n.title : label}</b>{n.body && <span className="block truncate text-sm text-mu">{n.body}</span>}<small className="text-mu">{formatDate(n.created_at, locale)}</small></div>
            {h && <Link href={h} className={btn("outline", true)}>{t("open")} →</Link>}</li>); })}</ul>)}
    </DashboardShell>
  );
}

import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { ChatThread, type Msg } from "@/components/ChatThread";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";
export default async function MessagesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ lead?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const { lead } = await searchParams, me = await requireRole(locale, ["client"]), t = await getTranslations("portal.msg"), sb = await createClient();
  const { data: ls } = await sb.from("leads").select("id, created_at, assigned_agent_id, listing:listings(property:properties(property_translations(locale, title)))").order("created_at", { ascending: false }).limit(30);
  const leads = (ls ?? []) as unknown as { id: string; created_at: string; assigned_agent_id: string | null; listing: { property: { property_translations: { locale: string; title: string }[] } | null } | null }[];
  const agentIds = [...new Set(leads.map((l) => l.assigned_agent_id).filter(Boolean))] as string[];
  const [{ data: ag }, { data: all }] = await Promise.all([
    agentIds.length ? sb.from("agent_profiles").select("id, display_name_en, display_name_ar").in("id", agentIds) : Promise.resolve({ data: [] }),
    leads.length ? sb.from("lead_messages").select("id, lead_id, sender_id, body, created_at, read_at").in("lead_id", leads.map((l) => l.id)).order("created_at") : Promise.resolve({ data: [] }),
  ]);
  const agentName = (id: string | null) => { const a = (ag ?? []).find((x) => x.id === id); return a ? (locale === "ar" ? a.display_name_ar ?? a.display_name_en : a.display_name_en) : t("advisor"); };
  const msgs = (all ?? []) as (Msg & { lead_id: string; read_at: string | null })[];
  const sel = leads.find((l) => l.id === lead) ?? leads[0], thread = sel ? msgs.filter((m) => m.lead_id === sel.id) : [];
  const title = (l: (typeof leads)[number]) => l.listing?.property?.property_translations.find((x) => x.locale === locale)?.title ?? agentName(l.assigned_agent_id);
  return (
    <DashboardShell profile={me} locale={locale} active="messages">
      {!leads.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("none")}</p> : (
        <div className="grid items-start gap-5 lg:grid-cols-[300px_1fr]">
          <ul className="grid gap-2">{leads.map((l) => {
            const m = msgs.filter((x) => x.lead_id === l.id), last = m[m.length - 1], unread = m.filter((x) => x.sender_id !== me.id && !x.read_at).length;
            return (
              <li key={l.id}><Link href={`/account/messages?lead=${l.id}`} className={clsx("block rounded-lg p-4", sel?.id === l.id ? "bg-tx text-bg" : "bg-surf")}>
                <b className="flex items-center justify-between gap-2">{title(l)}{unread > 0 && <i className="rounded-full bg-goldgrad px-2 text-[11px] not-italic text-[#1a1409]">{unread}</i>}</b>
                <span className={clsx("mt-0.5 block truncate text-sm", sel?.id === l.id ? "text-bg/70" : "text-mu")}>{last ? last.body : t("pick")}{last && ` · ${timeAgo(last.created_at, locale)}`}</span></Link></li>); })}</ul>
          {sel && (sel.assigned_agent_id ? <div><h2 className="mb-3 text-xl">{agentName(sel.assigned_agent_id)}</h2><ChatThread key={sel.id} leadId={sel.id} meId={me.id} initial={thread} /></div>
            : <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("unassigned")}</p>)}
        </div>)}
    </DashboardShell>
  );
}

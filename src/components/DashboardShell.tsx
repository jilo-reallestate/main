import clsx from "clsx";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { logout } from "@/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/lib/auth";

type Key = "overview" | "pipeline" | "tasks" | "viewings" | "deals" | "listings" | "team" | "commissions" | "audit" | "settings" | "projects" | "developers" | "plans" | "installments" | "reservations" | "purchase" | "searches" | "messages" | "documents" | "profile";

export async function DashboardShell({ profile, locale, active, children }: { profile: SessionProfile; locale: string; active?: Key; children: React.ReactNode }) {
  const t = await getTranslations("dash"), n = await getTranslations("nav"), c = await getTranslations("crm.nav"), o = await getTranslations("op.nav"), a = await getTranslations("adm.nav"), p = await getTranslations("portal");
  const sb = await createClient(), staff = profile.role !== "client";
  const [{ count: unread }, { count: msgUnread }] = await Promise.all([
    sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    sb.from("lead_messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", profile.id),
  ]);
  const links: [string, string, Key, number?][] = staff
    ? [[profile.role === "admin" ? "/admin" : "/agent", t("navOverview"), "overview"], ["/agent/pipeline", c("pipeline"), "pipeline"], ["/agent/tasks", c("tasks"), "tasks"], ["/agent/viewings", c("viewings"), "viewings"], ["/agent/deals", c("deals"), "deals"], ["/agent/reservations", o("reservations"), "reservations"], ["/agent/listings", t("navListings"), "listings"],
       ...(profile.role === "admin" ? ([["/admin/team", a("team"), "team"], ["/admin/commissions", a("commissions"), "commissions"], ["/admin/audit", a("audit"), "audit"], ["/admin/projects", o("projects"), "projects"], ["/admin/developers", o("developers"), "developers"], ["/admin/payment-plans", o("plans"), "plans"], ["/admin/installments", o("installments"), "installments"], ["/admin/settings", a("settings"), "settings"]] as [string, string, Key][]) : [])]
    : [["/account", p("nav.overview"), "overview"], ["/account/purchase", o("purchase"), "purchase"], ["/account/searches", p("nav.searches"), "searches"], ["/account/messages", p("nav.messages"), "messages", msgUnread ?? 0], ["/account/documents", p("nav.documents"), "documents"], ["/account/profile", p("nav.profile"), "profile"]];
  return (
    <div className="min-h-screen bg-bg">
      <header className="dark-panel rounded-b-2xl">
        <div className="wrap flex items-center justify-between gap-4 py-3.5">
          <div className="flex items-center gap-4"><Link href="/"><Logo light /></Link><span className="rounded-full border border-gold-3 px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-gold-2 rtl:tracking-normal">{t(profile.role)}</span></div>
          <div className="flex items-center gap-4">
            <Link href="/notifications" aria-label={p("bell")} className="relative text-lg text-white/80 hover:text-white">🔔{(unread ?? 0) > 0 && <b className="absolute -end-2 -top-2 min-w-[17px] rounded-full bg-goldgrad px-1 text-center text-[10px] leading-[17px] text-[#1a1409]">{unread}</b>}</Link>
            <ThemeToggle onDark />
            <form action={logout}><input type="hidden" name="locale" value={locale} /><button className="text-sm text-white/80 hover:text-white">{n("logout")}</button></form>
          </div>
        </div>
        <nav className="wrap no-scrollbar flex gap-1.5 overflow-x-auto pb-3.5">{links.map(([href, label, key, badge]) => (
          <Link key={key} href={href} className={clsx("flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold", active === key ? "bg-white text-[#0B0D0E]" : "text-white/70 hover:text-white")}>{label}{!!badge && <b className="rounded-full bg-goldgrad px-1.5 text-[10px] text-[#1a1409]">{badge}</b>}</Link>))}</nav>
      </header>
      <main className="wrap py-10">
        <h1 className="text-3xl font-semibold md:text-4xl">{t("hello", { name: profile.full_name || profile.email || "" })}</h1>
        <div className="mt-2 h-px w-16 bg-goldgrad" />
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

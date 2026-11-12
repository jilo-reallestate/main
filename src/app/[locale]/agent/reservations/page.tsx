import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { OpForm } from "@/components/OpForm";
import { Countdown } from "@/components/Countdown";
import { cancelReservationAction, convertReservationAction, extendReservationAction } from "@/actions/offplan";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";
import { fieldCls } from "@/components/ui/Input";

export const dynamic = "force-dynamic";
type PT = { locale: string; name: string }[];
type Row = { id: string; status: string; reserved_at: string; expires_at: string; notes: string | null; deal_id: string | null; lead_id: string | null;
  unit: { id: string; unit_number: string; price: number; currency: Currency; payment_plan_id: string | null; project_id: string; project: { project_translations: PT } | null } | null;
  contact: { full_name: string } | null; agent: { full_name: string | null } | null };
const TONE: Record<string, string> = { active: "bg-success/10 text-success", expired: "bg-surf text-mu", converted: "bg-info/10 text-info", cancelled: "bg-surf text-mu" };

export default async function ReservationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("op"), sb = await createClient(), admin = me.role === "admin";
  // Row Level Security: an agent receives only their own reservations; an admin receives all
  const [{ data: rs }, { data: pl }] = await Promise.all([
    sb.from("unit_reservations").select("id, status, reserved_at, expires_at, notes, deal_id, lead_id, unit:units(id, unit_number, price, currency, payment_plan_id, project_id, project:projects(project_translations(locale, name))), contact:contacts(full_name), agent:profiles!agent_id(full_name)").order("reserved_at", { ascending: false }).limit(200),
    sb.from("payment_plans").select("id, name_en, name_ar, project_id").eq("is_active", true).order("name_en"),
  ]);
  const rows = (rs ?? []) as unknown as Row[], plans = (pl ?? []) as { id: string; name_en: string; name_ar: string | null; project_id: string | null }[];
  return (
    <DashboardShell profile={me} locale={locale} active="reservations">
      <h2 className="mb-4 text-2xl">{t("res.title")}</h2>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("res.none")}</p> : (
        <ul className="grid gap-3">{rows.map((r) => {
          const live = r.status === "active" && new Date(r.expires_at).getTime() > Date.now(), shown = r.status === "active" && !live ? "expired" : r.status;
          const pn = (r.unit?.project?.project_translations.find((x) => x.locale === locale) ?? r.unit?.project?.project_translations[0])?.name ?? "";
          const myPlans = plans.filter((p) => !p.project_id || p.project_id === r.unit?.project_id);
          return (
            <li key={r.id} className="rounded-lg bg-surf p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><b className="text-lg">{r.unit?.unit_number}</b> <span className="text-mu">· {pn}</span>
                  <p className="text-sm text-mu">{t("res.buyer")}: {r.lead_id ? <Link href={`/agent/leads/${r.lead_id}`} className="underline">{r.contact?.full_name}</Link> : r.contact?.full_name}{r.unit ? ` · ${formatMoney(r.unit.price, r.unit.currency, locale)}` : ""}{admin && r.agent?.full_name ? ` · ${t("res.admin")}: ${r.agent.full_name}` : ""}</p>
                  <p className="text-xs text-mu">{formatDate(r.reserved_at, locale)}{r.notes ? ` · ${r.notes}` : ""}</p></div>
                <div className="text-end"><span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[shown])}>{t(`res.status.${shown}` as "res.status.active")}</span>
                  {live && <p className="mt-2 text-sm"><Countdown to={r.expires_at} /></p>}
                  {live && <p className="text-xs text-mu">{t("res.expires")}: {formatDate(r.expires_at, locale)}</p>}
                  {r.status === "converted" && <Link href="/agent/deals" className="mt-2 inline-block text-sm font-semibold underline">{t("res.viewDeal")} →</Link>}</div>
              </div>
              {live && (
                <div className="mt-4 grid gap-3 border-t border-ln pt-4 lg:grid-cols-3">
                  <OpForm action={extendReservationAction} submit={t("res.extend")} variant="outline" small className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={r.id} />
                    <select name="hours" defaultValue="24" aria-label={t("res.extendBy")} className={fieldCls + " !w-auto !min-h-[38px]"}>{[12, 24, 48, 72].map((h) => <option key={h} value={h}>{h}h</option>)}</select></OpForm>
                  <OpForm action={cancelReservationAction} submit={t("res.cancel")} variant="outline" small confirm={t("res.confirmCancel")} buttonClassName="!text-danger"><input type="hidden" name="id" value={r.id} /></OpForm>
                  <OpForm action={convertReservationAction} submit={t("res.convert")} okText={t("res.converted", { n: "{n}" })} variant="gold" small className="grid gap-2 lg:col-span-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><input type="hidden" name="id" value={r.id} />
                    <label className="grid gap-1 text-xs"><span className="label">{t("res.plan")}</span><select name="plan_id" defaultValue="" className={fieldCls}><option value="">{t("res.planDefault")}</option>{myPlans.map((p) => <option key={p.id} value={p.id}>{(locale === "ar" ? p.name_ar : null) ?? p.name_en}</option>)}</select></label>
                    <label className="grid gap-1 text-xs"><span className="label">{t("res.start")}</span><input type="date" name="start" defaultValue={new Date().toISOString().slice(0, 10)} dir="ltr" className={fieldCls} /></label>
                    {admin && r.unit && <label className="grid gap-1 text-xs"><span className="label">{t("res.price")}</span><input name="price" inputMode="decimal" defaultValue={r.unit.price} dir="ltr" className={fieldCls} /></label>}</OpForm>
                </div>)}
            </li>);
        })}</ul>)}
    </DashboardShell>
  );
}

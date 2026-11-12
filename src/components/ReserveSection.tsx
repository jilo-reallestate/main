import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { reserveAction } from "@/actions/offplan";
import { OpForm } from "@/components/OpForm";
import { Countdown } from "@/components/Countdown";
import { fieldCls } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, type Currency } from "@/lib/money";

type PT = { locale: string; name: string }[];
const pname = (p: { project_translations: PT } | null | undefined, locale: string) => (p?.project_translations.find((x) => x.locale === locale) ?? p?.project_translations[0])?.name ?? "";

/** "Reserve a unit" box on the lead page. The database starts the timer and refuses a unit that is already held. */
export async function ReserveSection({ leadId, locale }: { leadId: string; locale: string }) {
  const t = await getTranslations("op"), sb = await createClient();
  const now = new Date().toISOString();
  const [{ data: us }, { data: rs }] = await Promise.all([
    sb.from("units").select("id, unit_number, unit_type, price, currency, project:projects(id, project_translations(locale, name))").or(`status.eq.available,and(status.eq.reserved,reserved_until.lt.${now})`).order("unit_number").limit(500),
    sb.from("unit_reservations").select("id, status, expires_at, unit:units(unit_number, project:projects(project_translations(locale, name)))").eq("lead_id", leadId).order("reserved_at", { ascending: false }),
  ]);
  type U = { id: string; unit_number: string; unit_type: string | null; price: number; currency: Currency; project: { id: string; project_translations: PT } | null };
  const groups = new Map<string, U[]>();
  ((us ?? []) as unknown as U[]).forEach((u) => { const k = pname(u.project, locale) || "—"; groups.set(k, [...(groups.get(k) ?? []), u]); });
  type R = { id: string; status: string; expires_at: string; unit: { unit_number: string; project: { project_translations: PT } | null } | null };
  const res = (rs ?? []) as unknown as R[];
  return (
    <section className="rounded-lg bg-surf p-6">
      <h3 className="mb-3 text-lg font-semibold">{t("res.reserve")}</h3>
      {res.length > 0 && <ul className="mb-4 grid gap-2 text-sm">{res.map((r) => {
        const live = r.status === "active" && new Date(r.expires_at).getTime() > Date.now();
        return <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-bg p-3"><span><b>{r.unit?.unit_number}</b> · {pname(r.unit?.project, locale)}</span>
          {live ? <Countdown to={r.expires_at} /> : <span className="text-mu">{t(`res.status.${r.status === "active" ? "expired" : r.status}` as "res.status.active")}</span>}</li>;
      })}<li><Link href="/agent/reservations" className="text-sm font-semibold underline">{t("nav.reservations")} →</Link></li></ul>}
      {groups.size === 0 ? <p className="text-sm text-mu">{t("res.noLeadUnits")}</p> : (
        <OpForm action={reserveAction} submit={t("res.reserve")} okText={t("res.reserved")} variant="gold" reset className="grid gap-3">
          <input type="hidden" name="lead_id" value={leadId} />
          <select name="unit_id" required defaultValue="" aria-label={t("res.unit")} className={fieldCls}><option value="" disabled>{t("res.pick")}</option>
            {[...groups].map(([name, list]) => <optgroup key={name} label={name}>{list.map((u) => <option key={u.id} value={u.id}>{u.unit_number}{u.unit_type ? ` · ${u.unit_type}` : ""} · {formatMoney(u.price, u.currency, locale)}</option>)}</optgroup>)}</select>
          <input name="notes" maxLength={300} placeholder={t("res.notes")} className={fieldCls} />
        </OpForm>)}
    </section>
  );
}

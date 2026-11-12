import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { logContact } from "@/actions/staff";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";

type Lead = { id: string; created_at: string; sla_due_at: string | null; first_response_at: string | null; intent: string; message: string | null;
  contact: { full_name: string; phone: string | null; email: string | null } | null };
type Listing = { id: string; purpose: string; status: string; price: number; currency: Currency; property: { reference_code: string; property_translations: { locale: string; title: string }[] } | null };

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const profile = await requireRole(locale, ["agent", "admin"]);
  const t = await getTranslations("dash");
  const sb = await createClient();
  const [{ data: leads }, { data: listings }] = await Promise.all([
    sb.from("leads").select("id, created_at, sla_due_at, first_response_at, intent, message, contact:contacts(full_name, phone, email)")
      .eq("status", "open").eq("assigned_agent_id", profile.id).order("created_at", { ascending: false }).limit(50),
    sb.from("listings").select("id, purpose, status, price, currency, property:properties(reference_code, property_translations(locale, title))")
      .eq("agent_id", profile.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const now = Date.now();

  return (
    <DashboardShell profile={profile} locale={locale} active="overview">
      <section>
        <h2 className="text-2xl font-semibold">{t("openLeads")}</h2>
        <ul className="mt-4 space-y-3">
          {((leads as unknown as Lead[]) ?? []).length ? (leads as unknown as Lead[]).map((l) => {
            const overdue = !l.first_response_at && l.sla_due_at && new Date(l.sla_due_at).getTime() < now;
            return (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surf p-4">
                <div className="text-sm">
                  <p className="text-base font-semibold">{l.contact?.full_name}</p>
                  <p dir="ltr" className="text-mu">{l.contact?.phone ?? l.contact?.email}</p>
                  <p className="mt-1 text-mu">{formatDate(l.created_at, locale)} · {l.intent}</p>
                  {l.message && <p className="mt-2">{l.message}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {l.first_response_at ? <Tag tone="success"><span aria-hidden>✓</span>{t("responded")}</Tag>
                    : overdue ? <Tag tone="danger"><span aria-hidden>!</span>{t("slaOverdue")}</Tag>
                    : <Tag tone="info"><span aria-hidden>●</span>{t("slaOk")}</Tag>}
                  {!l.first_response_at && (
                    <form action={logContact}><input type="hidden" name="lead_id" value={l.id} /><Button variant="secondary" type="submit">{t("contacted")}</Button></form>
                  )}
                </div>
              </li>
            );
          }) : <li className="text-mu">{t("none")}</li>}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{t("myListings")}</h2>
        <ul className="mt-4 divide-y divide-ln rounded-lg bg-surf">
          {((listings as unknown as Listing[]) ?? []).length ? (listings as unknown as Listing[]).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-4 p-4 text-sm">
              <span>{l.property?.property_translations?.find((x) => x.locale === locale)?.title ?? l.property?.reference_code}</span>
              <span className="flex items-center gap-4"><span>{formatMoney(l.price, l.currency, locale)}</span><span className="rounded-full border border-ln px-2 py-0.5 text-xs">{l.status}</span></span>
            </li>)) : <li className="p-4 text-mu">{t("none")}</li>}
        </ul>
      </section>
    </DashboardShell>
  );
}

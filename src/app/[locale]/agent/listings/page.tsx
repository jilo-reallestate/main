import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { approveListing } from "@/actions/staff";
import { archiveListing } from "@/actions/listings";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
type Row = { id: string; status: string; price: number; currency: Currency; purpose: string; updated_at: string;
  property: { reference_code: string; area: { area_translations: { locale: string; name: string }[] } | null; property_translations: { locale: string; slug: string; title: string }[] } | null };
const TONE: Record<string, string> = { published: "bg-success/10 text-success", pending_review: "bg-warning/15 text-warning", draft: "bg-surf text-mu", archived: "bg-surf text-mu", sold: "bg-info/10 text-info", rented: "bg-info/10 text-info", reserved: "bg-warning/15 text-warning", expired: "bg-danger/10 text-danger" };

export default async function ListingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const { status } = await searchParams;
  const me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("mgr");
  const sb = await createClient();
  let q = sb.from("listings").select("id, status, price, currency, purpose, updated_at, property:properties(reference_code, area:areas(area_translations(locale, name)), property_translations(locale, slug, title))").order("updated_at", { ascending: false }).limit(200);
  if (me.role !== "admin") q = q.eq("agent_id", me.id);
  if (status) q = q.eq("status", status);
  const { data } = await q; const rows = (data ?? []) as unknown as Row[];
  const tabs: [string, string][] = [["", t("all")], ["pending_review", t("st.pending_review")], ["published", t("st.published")], ["draft", t("st.draft")], ["archived", t("st.archived")]];
  return (
    <DashboardShell profile={me} locale={locale} active="listings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5">{tabs.map(([k, l]) => <Link key={k} href={k ? `/agent/listings?status=${k}` : "/agent/listings"} className={clsx("rounded-full px-4 py-2 text-sm font-semibold", (status ?? "") === k ? "bg-tx text-bg" : "bg-surf text-mu")}>{l}</Link>)}</nav>
        <Link href="/agent/listings/new" className={btn("gold")}>＋ {t("new")}</Link>
      </div>
      {!rows.length ? <p className="mt-8 rounded-lg bg-surf p-10 text-center text-mu">{t("none")}</p> : (
        <div className="mt-6 overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-start text-xs text-mu">{[t("ref"), t("name"), t("area"), t("price"), t("status"), t("updated"), ""].map((h, i) => <th key={i} className="p-4 text-start font-semibold">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => {
            const tr = r.property?.property_translations.find((x) => x.locale === locale) ?? r.property?.property_translations[0];
            const area = r.property?.area?.area_translations.find((x) => x.locale === locale)?.name;
            return (
              <tr key={r.id} className="border-t border-ln">
                <td className="p-4 font-mono text-xs text-mu">{r.property?.reference_code}</td>
                <td className="p-4 font-semibold">{tr?.title ?? "—"}</td><td className="p-4 text-mu">{area}</td>
                <td className="p-4 whitespace-nowrap">{formatMoney(r.price, r.currency, locale)}</td>
                <td className="p-4"><span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", TONE[r.status])}>{t(`st.${r.status}` as "st.draft")}</span></td>
                <td className="p-4 whitespace-nowrap text-mu">{formatDate(r.updated_at, locale)}</td>
                <td className="p-4"><div className="flex flex-wrap justify-end gap-1.5">
                  <Link href={`/agent/listings/${r.id}`} className={btn("outline", true)}>{t("edit")}</Link>
                  {r.status === "published" && tr && <Link href={`/properties/${tr.slug}`} className={btn("ghost", true)}>{t("view")} ↗</Link>}
                  {me.role === "admin" && r.status === "pending_review" && <form action={approveListing}><input type="hidden" name="id" value={r.id} /><button className={btn("gold", true)}>{t("approve")}</button></form>}
                  {r.status !== "archived" && <form action={archiveListing}><input type="hidden" name="id" value={r.id} /><button className={btn("ghost", true, "text-mu")}>{t("archive")}</button></form>}
                </div></td>
              </tr>);
          })}</tbody></table></div>)}
    </DashboardShell>
  );
}

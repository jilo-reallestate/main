import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import clsx from "clsx";

export const dynamic = "force-dynamic";
const PAGE = 40, AREAS = ["listings", "deals", "commissions", "payments", "profiles", "agent_settings", "leases", "invoices", "units", "exchange_rates"];
type Row = { id: number; table_name: string; record_id: string | null; action: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; changed_by: string | null; changed_at: string };
const SKIP = new Set(["updated_at", "created_at"]);
const diff = (r: Row) => r.action !== "UPDATE" || !r.old_data || !r.new_data ? [] : Object.keys(r.new_data).filter((k) => !SKIP.has(k) && JSON.stringify(r.new_data![k]) !== JSON.stringify(r.old_data![k]));

export default async function AuditPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ area?: string; page?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const { area, page: pg } = await searchParams, page = Math.max(1, Number(pg) || 1);
  const me = await requireRole(locale, ["admin"]), t = await getTranslations("adm.audit"), sb = await createClient();
  let q = sb.from("audit_logs").select("id, table_name, record_id, action, old_data, new_data, changed_by, changed_at").order("changed_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * PAGE, page * PAGE);
  if (area) q = q.eq("table_name", area);
  const { data } = await q; const all = (data ?? []) as Row[], rows = all.slice(0, PAGE), more = all.length > PAGE;
  const ids = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const { data: ps } = ids.length ? await sb.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = new Map((ps ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string)]));
  const href = (o: { area?: string; page?: number }) => { const u = new URLSearchParams(); const a = "area" in o ? o.area : area; if (a) u.set("area", a); if (o.page && o.page > 1) u.set("page", String(o.page)); return `/admin/audit${u.toString() ? `?${u}` : ""}`; };
  return (
    <DashboardShell profile={me} locale={locale} active="audit">
      <nav className="mb-5 flex flex-wrap gap-1.5">{[["", t("all")], ...AREAS.map((a) => [a, a.replace("_", " ")])].map(([k, l]) => <Link key={k} href={href({ area: k })} className={clsx("rounded-full px-3.5 py-1.5 text-[13px] font-semibold capitalize", (area ?? "") === k ? "bg-tx text-bg" : "bg-surf text-mu")}>{l}</Link>)}</nav>
      {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("none")}</p> : (
        <div className="overflow-x-auto rounded-lg bg-surf"><table className="w-full min-w-[820px] text-sm">
          <thead><tr>{[t("when"), t("who"), t("table"), t("action"), t("changes")].map((h) => <th key={h} className="p-4 text-start text-xs font-semibold text-mu">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => { const d = diff(r); return (
            <tr key={r.id} className="border-t border-ln align-top">
              <td className="p-4 whitespace-nowrap text-mu">{formatDate(r.changed_at, locale)}</td><td className="p-4">{r.changed_by ? who.get(r.changed_by) ?? r.changed_by.slice(0, 8) : t("system")}</td>
              <td className="p-4 capitalize">{r.table_name.replace("_", " ")}<br /><span className="font-mono text-[11px] text-mu">{r.record_id?.slice(0, 8)}</span></td>
              <td className="p-4"><span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", r.action === "DELETE" ? "bg-danger/10 text-danger" : r.action === "INSERT" ? "bg-success/10 text-success" : "bg-info/10 text-info")}>{t(r.action as "INSERT")}</span></td>
              <td className="p-4">{d.length ? <details><summary className="cursor-pointer">{d.join(", ")}</summary><ul className="mt-2 grid gap-1 text-xs text-mu">{d.map((k) => <li key={k} dir="ltr"><b>{k}</b>: {String(r.old_data![k] ?? "∅").slice(0, 60)} → {String(r.new_data![k] ?? "∅").slice(0, 60)}</li>)}</ul></details> : <span className="text-mu">—</span>}</td>
            </tr>); })}</tbody></table></div>)}
      <div className="mt-5 flex justify-between text-sm">{page > 1 ? <Link href={href({ page: page - 1 })} className="underline">← {t("prev")}</Link> : <span />}{more ? <Link href={href({ page: page + 1 })} className="underline">{t("next")} →</Link> : <span />}</div>
    </DashboardShell>
  );
}

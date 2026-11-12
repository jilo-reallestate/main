import clsx from "clsx";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { DealForm } from "@/components/CrmForms";
import { ReserveSection } from "@/components/ReserveSection";
import { ChatThread, type Msg } from "@/components/ChatThread";
import { addActivityAction, addTaskAction, moveLeadForm, reassignLeadAction, toggleTaskAction } from "@/actions/crm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { formatMoney, short, type Currency } from "@/lib/money";
import { fieldCls } from "@/components/ui/Input";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
const box = "rounded-lg bg-surf p-5", h3 = "mb-3 text-lg tracking-tight";
const REASONS = ["price", "competitor", "noresp", "notready", "other"];

export default async function LeadPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("crm"), sb = await createClient();
  const nm = (o: { name_en: string; name_ar: string } | null) => (o ? (locale === "ar" ? o.name_ar : o.name_en) : "");
  const { data: lead } = await sb.from("leads").select(`id, created_at, status, intent, message, budget_min, budget_max, budget_currency, sla_due_at, first_response_at, lost_reason, assigned_agent_id,
    stage:pipeline_stages(key, name_en, name_ar), source:lead_sources(name_en, name_ar), contact:contacts(id, full_name, phone, email, whatsapp, profile_id),
    listing:listings(property:properties(reference_code, property_translations(locale, slug, title))), agent:profiles!assigned_agent_id(full_name)`).eq("id", id).maybeSingle();
  if (!lead) notFound();
  const [{ data: acts }, { data: tasks }, { data: views }, { data: deals }, { data: stages }, { data: agents }] = await Promise.all([
    sb.from("activities").select("id, type, direction, summary, body, created_at, author:profiles!created_by(full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
    sb.from("tasks").select("id, title, due_at, completed_at, priority").eq("lead_id", id).order("due_at", { ascending: true, nullsFirst: false }),
    sb.from("viewings").select("id, scheduled_at, status").eq("lead_id", id).order("scheduled_at"),
    sb.from("deals").select("id, type, status, price, currency").eq("lead_id", id),
    sb.from("pipeline_stages").select("key, name_en, name_ar, is_lost").order("sort_order"),
    me.role === "admin" ? sb.from("agent_profiles").select("id, display_name_en") : Promise.resolve({ data: null }),
  ]);
  const L = lead as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const clientId: string | null = L.contact?.profile_id ?? null;
  const [{ data: chat }, { data: cdocs }] = clientId ? await Promise.all([
    sb.from("lead_messages").select("id, sender_id, body, created_at").eq("lead_id", id).order("created_at"),
    sb.from("client_documents").select("id, kind, file_name, path, created_at").eq("owner_id", clientId).order("created_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  const signed = await Promise.all((cdocs ?? []).map(async (d: any) => ({ ...d, url: (await sb.storage.from("documents").createSignedUrl(d.path, 300)).data?.signedUrl as string | undefined })));
  const pt = await getTranslations("portal");
  const c = L.contact, prop = L.listing?.property, ptr = prop?.property_translations?.find((x: { locale: string }) => x.locale === locale) ?? prop?.property_translations?.[0];
  const overdue = !L.first_response_at && L.sla_due_at && new Date(L.sla_due_at).getTime() < Date.now();
  const wa = (c?.whatsapp ?? c?.phone ?? "").replace(/\D/g, "");
  const dt = (iso: string | null) => (iso ? formatDate(iso, locale) : t("tasks.noDue"));
  return (
    <DashboardShell profile={me} locale={locale} active="pipeline">
      <Link href="/agent/pipeline" className="text-sm text-mu underline">← {t("lead.back")}</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-3">
        <h2 className="text-3xl">{c?.full_name}</h2>
        <span className="rounded-full bg-surf px-3 py-1 text-xs font-semibold">{nm(L.stage)}</span>
        {L.status === "lost" && L.lost_reason && <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">{t(`reasons.${L.lost_reason}` as "reasons.other")}</span>}
        {L.first_response_at ? <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">✓ {t("lead.responded")}</span>
          : <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", overdue ? "bg-danger/10 text-danger" : "bg-info/10 text-info")}>{overdue ? "! " + t("lead.slaOverdue") : "● " + t("lead.slaOk")}</span>}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-5">
          <section className={box}><h3 className={h3}>{t("lead.logActivity")}</h3>
            <form action={addActivityAction} className="grid gap-3"><input type="hidden" name="lead_id" value={id} />
              <div className="grid gap-3 sm:grid-cols-2"><select name="type" className={fieldCls} aria-label={t("lead.type")}>{["call", "whatsapp", "email", "meeting", "sms", "note"].map((x) => <option key={x} value={x}>{t(`act.${x}` as "act.call")}</option>)}</select>
                <select name="direction" className={fieldCls} aria-label="Direction"><option value="outbound">{t("dir.outbound")}</option><option value="inbound">{t("dir.inbound")}</option></select></div>
              <input name="summary" required placeholder={t("lead.summary")} aria-label={t("lead.summary")} className={fieldCls} />
              <textarea name="body" rows={2} placeholder={t("lead.details")} aria-label={t("lead.details")} className={clsx(fieldCls, "py-3")} />
              <button className="min-h-[44px] rounded-full bg-tx font-semibold text-bg sm:w-fit sm:px-8">{t("lead.save")}</button></form></section>
          <section className={box}><h3 className={h3}>{t("lead.timeline")}</h3>
            <ol className="grid gap-3.5 border-s-2 border-ln ps-5">{(acts ?? []).map((a: any) => (
              <li key={a.id} className="relative"><span className="absolute -start-[27px] top-1.5 h-3 w-3 rounded-full bg-goldgrad" />
                <p className="text-sm"><b>{t(`act.${a.type}` as "act.call")}</b>{a.direction && <span className="text-mu"> · {t(`dir.${a.direction}` as "dir.inbound")}</span>} <span className="text-mu">· {formatDate(a.created_at, locale)} · {t("lead.by")} {a.author?.full_name ?? t("lead.system")}</span></p>
                <p className="mt-0.5">{a.summary}</p>{a.body && <p className="mt-1 whitespace-pre-line text-sm text-mu">{a.body}</p>}</li>))}</ol>
            {!acts?.length && <p className="text-mu">{t("lead.none")}</p>}</section>
          <section className={box}><h3 className={h3}>{pt("msg.staffTitle")}</h3>
            {clientId ? <ChatThread key={id} leadId={id} meId={me.id} initial={(chat ?? []) as Msg[]} /> : <p className="text-sm text-mu">{pt("msg.noAccount")}</p>}</section>

        </div>

        <aside className="grid gap-5">
          <section className={box}><h3 className={h3}>{t("lead.contact")}</h3>
            <p className="text-sm" dir="ltr">{c?.phone}</p><p className="text-sm text-mu" dir="ltr">{c?.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">{c?.phone && <a href={`tel:${c.phone}`} className={btn("outline", true)}>{t("lead.call")}</a>}{wa && <a href={`https://wa.me/${wa}`} className={btn("gold", true)}>{t("lead.whatsapp")}</a>}{c?.email && <a href={`mailto:${c.email}`} className={btn("outline", true)}>{t("lead.email")}</a>}</div>
            <dl className="mt-4 grid gap-1.5 text-sm"><div className="flex justify-between"><dt className="text-mu">{t("lead.intent")}</dt><dd>{t(`intent.${L.intent}` as "intent.buy")}</dd></div>
              <div className="flex justify-between"><dt className="text-mu">{t("lead.source")}</dt><dd>{nm(L.source) || "—"}</dd></div>
              {L.budget_max && <div className="flex justify-between"><dt className="text-mu">{t("lead.budget")}</dt><dd dir="ltr">{L.budget_min ? short(L.budget_min) + " – " : "≤ "}{short(L.budget_max)} {L.budget_currency}</dd></div>}
              <div className="flex justify-between"><dt className="text-mu">{t("lead.created")}</dt><dd>{formatDate(L.created_at, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-mu">{t("lead.assigned")}</dt><dd>{L.agent?.full_name ?? "—"}</dd></div></dl>
            {ptr && <Link href={`/properties/${ptr.slug}`} className="mt-3 block rounded-2xl bg-bg p-3 text-sm"><span className="text-mu">{t("lead.property")}</span><br /><b>{ptr.title}</b> ↗</Link>}
            {L.message && <p className="mt-3 rounded-2xl bg-bg p-3 text-sm"><span className="text-mu">{t("lead.message")}</span><br />{L.message}</p>}</section>

          <section className={box}><h3 className={h3}>{t("lead.stage")}</h3>
            <form action={moveLeadForm}><input type="hidden" name="lead_id" value={id} />
              <AutoSubmitSelect name="stage" defaultValue={L.stage?.key} className={fieldCls}>{(stages ?? []).filter((s: any) => !s.is_lost).map((s: any) => <option key={s.key} value={s.key}>{nm(s)}</option>)}</AutoSubmitSelect></form>
            <form action={moveLeadForm} className="mt-3 flex gap-2"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="stage" value="lost" />
              <select name="reason" className={fieldCls} aria-label={t("board.lostWhy")}>{REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}` as "reasons.other")}</option>)}</select><button className="rounded-full border-[1.5px] border-ln px-4 text-sm font-semibold text-danger">{t("board.lost")}</button></form>
            {me.role === "admin" && agents && <form action={reassignLeadAction} className="mt-4 flex gap-2"><input type="hidden" name="lead_id" value={id} />
              <select name="agent_id" defaultValue={L.assigned_agent_id ?? ""} className={fieldCls} aria-label={t("lead.reassign")}>{(agents as any[]).map((a) => <option key={a.id} value={a.id}>{a.display_name_en}</option>)}</select><button className={btn("outline", true, "self-center")}>{t("lead.reassign")}</button></form>}</section>

          <section className={box}><h3 className={h3}>{pt("docs.staffTitle")}</h3>
            {signed.length ? <ul className="grid gap-2 text-sm">{signed.map((d: any) => <li key={d.id} className="flex items-center justify-between gap-3 rounded-2xl bg-bg p-3"><span className="min-w-0"><b className="block truncate">{d.file_name}</b><small className="text-mu">{pt(`docs.kinds.${d.kind}` as "docs.kinds.other")}</small></span>{d.url && <a href={d.url} target="_blank" rel="noopener" className={btn("outline", true)}>{pt("docs.download")}</a>}</li>)}</ul> : <p className="text-sm text-mu">{clientId ? pt("docs.staffNone") : pt("msg.noAccount")}</p>}</section>

          <section className={box}><h3 className={h3}>{t("lead.tasks")}</h3>
            <ul className="grid gap-2">{(tasks ?? []).map((k: any) => (
              <li key={k.id} className="flex items-center gap-3 rounded-2xl bg-bg p-3 text-sm"><form action={toggleTaskAction}><input type="hidden" name="id" value={k.id} /><input type="hidden" name="done" value={k.completed_at ? "0" : "1"} />
                <button aria-label={k.completed_at ? t("tasks.reopen") : t("tasks.complete")} className={clsx("grid h-6 w-6 place-items-center rounded-full border-2", k.completed_at ? "border-success bg-success text-white" : "border-ln")}>{k.completed_at ? "✓" : ""}</button></form>
                <span className={clsx("flex-1", k.completed_at && "text-mu line-through")}>{k.title}<br /><small className="text-mu">{dt(k.due_at)}</small></span></li>))}</ul>
            <form action={addTaskAction} className="mt-3 grid gap-2"><input type="hidden" name="lead_id" value={id} /><input name="title" required placeholder={t("lead.taskTitle")} aria-label={t("lead.taskTitle")} className={fieldCls} />
              <div className="grid grid-cols-2 gap-2"><input name="due_at" type="datetime-local" dir="ltr" className={fieldCls} aria-label={t("lead.due")} /><select name="priority" defaultValue="medium" className={fieldCls} aria-label={t("lead.priority")}>{["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`pri.${p}` as "pri.low")}</option>)}</select></div>
              <button className={btn("outline", true)}>{t("lead.addTask")}</button></form></section>

          {(views?.length ?? 0) > 0 && <section className={box}><h3 className={h3}>{t("lead.viewings")}</h3><ul className="grid gap-2 text-sm">{(views ?? []).map((v: any) => <li key={v.id} className="flex justify-between rounded-2xl bg-bg p-3"><span>{formatDate(v.scheduled_at, locale)}</span><b>{t(`vstat.${v.status}` as "vstat.requested")}</b></li>)}</ul></section>}

          <section className={box}><h3 className={h3}>{t("lead.deals")}</h3>
            <ul className="mb-3 grid gap-2 text-sm">{(deals ?? []).map((d: any) => <li key={d.id} className="flex justify-between rounded-2xl bg-bg p-3"><span>{t(`dtype.${d.type}` as "dtype.sale")} · {formatMoney(d.price, d.currency as Currency, locale)}</span><b>{t(`dstat.${d.status}` as "dstat.closed")}</b></li>)}</ul>
            <p className="label mb-2">{t("lead.openDeal")}</p><DealForm leadId={id} /></section>
          <ReserveSection leadId={id} locale={locale} />
        </aside>
      </div>
    </DashboardShell>
  );
}

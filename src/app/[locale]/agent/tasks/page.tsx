import clsx from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DashboardShell } from "@/components/DashboardShell";
import { addTaskAction, toggleTaskAction } from "@/actions/crm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { fieldCls } from "@/components/ui/Input";
import { btn } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
const PRI: Record<string, string> = { urgent: "bg-danger/10 text-danger", high: "bg-warning/15 text-warning", medium: "bg-surf text-mu", low: "bg-surf text-mu" };

export default async function TasksPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const { tab } = await searchParams, done = tab === "done", me = await requireRole(locale, ["agent", "admin"]), t = await getTranslations("crm"), sb = await createClient();
  let q = sb.from("tasks").select("id, title, due_at, completed_at, priority, lead:leads(id, contact:contacts(full_name))").eq("assigned_to", me.id).limit(200);
  q = done ? q.not("completed_at", "is", null).order("completed_at", { ascending: false }) : q.is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false });
  const { data } = await q; const rows = (data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const now = Date.now();
  return (
    <DashboardShell profile={me} locale={locale} active="tasks">
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <nav className="mb-4 flex gap-1.5">{[["", t("tasks.open")], ["done", t("tasks.done")]].map(([k, l]) => <Link key={k} href={k ? "/agent/tasks?tab=done" : "/agent/tasks"} className={clsx("rounded-full px-4 py-2 text-sm font-semibold", (tab ?? "") === k ? "bg-tx text-bg" : "bg-surf text-mu")}>{l}</Link>)}</nav>
          {!rows.length ? <p className="rounded-lg bg-surf p-10 text-center text-mu">{t("tasks.none")}</p> : (
            <ul className="grid gap-2.5">{rows.map((k) => {
              const late = !k.completed_at && k.due_at && new Date(k.due_at).getTime() < now;
              return (
                <li key={k.id} className="flex items-center gap-3.5 rounded-lg bg-surf p-4">
                  <form action={toggleTaskAction}><input type="hidden" name="id" value={k.id} /><input type="hidden" name="done" value={k.completed_at ? "0" : "1"} />
                    <button aria-label={k.completed_at ? t("tasks.reopen") : t("tasks.complete")} className={clsx("grid h-7 w-7 place-items-center rounded-full border-2", k.completed_at ? "border-success bg-success text-white" : "border-mu/40 hover:border-success")}>{k.completed_at ? "✓" : ""}</button></form>
                  <div className="min-w-0 flex-1"><p className={clsx("font-semibold", k.completed_at && "text-mu line-through")}>{k.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mu"><span className={clsx(late && "font-bold text-danger")}>{late ? "! " + t("tasks.overdue") + " · " : ""}{k.due_at ? formatDate(k.due_at, locale) : t("tasks.noDue")}</span>
                      {k.lead && <Link href={`/agent/leads/${k.lead.id}`} className="underline">{k.lead.contact?.full_name}</Link>}</p></div>
                  <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", PRI[k.priority])}>{t(`pri.${k.priority}` as "pri.low")}</span>
                </li>);
            })}</ul>)}
        </div>
        <form action={addTaskAction} className="grid gap-3 rounded-lg bg-surf p-5 lg:sticky lg:top-6">
          <h3 className="text-lg">{t("lead.addTask")}</h3>
          <input name="title" required placeholder={t("lead.taskTitle")} aria-label={t("lead.taskTitle")} className={fieldCls} />
          <input name="due_at" type="datetime-local" dir="ltr" aria-label={t("lead.due")} className={fieldCls} />
          <select name="priority" defaultValue="medium" aria-label={t("lead.priority")} className={fieldCls}>{["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`pri.${p}` as "pri.low")}</option>)}</select>
          <button className={btn("gold")}>{t("lead.addTask")}</button>
        </form>
      </div>
    </DashboardShell>
  );
}

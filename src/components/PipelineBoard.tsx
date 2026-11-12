"use client";
import clsx from "clsx";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Overlay } from "@/components/Overlay";
import { moveLeadAction } from "@/actions/crm";
import { timeAgo } from "@/lib/format";

export type BoardStage = { key: string; name: string; color: string | null; won: boolean; lost: boolean };
export type BoardLead = { id: string; name: string; phone: string | null; intent: string; source: string; budget: string; createdAt: string; stage: string; overdue: boolean; agent: string | null };
const REASONS = ["price", "competitor", "noresp", "notready", "other"];

/** Kanban board. Drag a card to another column (desktop) or use the Move menu (phones). Moves save immediately. */
export function PipelineBoard({ stages, initial }: { stages: BoardStage[]; initial: BoardLead[] }) {
  const t = useTranslations("crm"), locale = useLocale(), [leads, setLeads] = useState(initial), [over, setOver] = useState(""), [lost, setLost] = useState<string | null>(null), [err, setErr] = useState(""), [, start] = useTransition();
  const move = (id: string, stage: string, reason?: string) => {
    const prev = leads; setErr("");
    setLeads((l) => l.map((x) => (x.id === id ? { ...x, stage } : x)));
    start(async () => { const r = await moveLeadAction(id, stage, reason); if (r?.error) { setLeads(prev); setErr(r.error); } });
  };
  const request = (id: string, stage: string) => { const cur = leads.find((l) => l.id === id)?.stage; if (cur === stage) return; stages.find((s) => s.key === stage)?.lost ? setLost(id + "|" + stage) : move(id, stage); };
  return (
    <div>
      <p className="mb-3 text-sm text-mu">{t("board.hint")}</p>
      {err && <p role="alert" className="mb-3 rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">{err}</p>}
      <div className="no-scrollbar -mx-1 flex gap-3.5 overflow-x-auto px-1 pb-4">
        {stages.map((st) => {
          const col = leads.filter((l) => l.stage === st.key), shown = st.won || st.lost ? col.slice(0, 10) : col;
          return (
            <section key={st.key} onDragOver={(e) => { e.preventDefault(); setOver(st.key); }} onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); setOver(""); const id = e.dataTransfer.getData("text/plain"); if (id) request(id, st.key); }}
              className={clsx("w-[290px] flex-none rounded-lg bg-surf p-3 transition", over === st.key && "ring-2 ring-gold-3")} aria-label={st.name}>
              <h3 className="mb-3 flex items-center justify-between px-1.5 text-[15px] tracking-tight"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: st.color ?? "#999" }} />{st.name}</span><span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-bold text-mu">{col.length}</span></h3>
              <div className="grid gap-2.5">
                {shown.map((l) => (
                  <article key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)} className="cursor-grab rounded-2xl bg-bg p-3.5 shadow-sm active:cursor-grabbing">
                    <Link href={`/agent/leads/${l.id}`} className="block"><b className="block leading-tight">{l.name}</b>
                      <span className="mt-0.5 block text-xs text-mu" dir="ltr">{l.phone}</span></Link>
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                      <i className="rounded-full bg-surf px-2 py-0.5 not-italic">{t(`intent.${l.intent}` as "intent.buy")}</i>
                      {l.source && <i className="rounded-full bg-surf px-2 py-0.5 not-italic text-mu">{l.source}</i>}
                      {l.overdue && <i className="rounded-full bg-danger/10 px-2 py-0.5 not-italic text-danger">! {t("board.overdue")}</i>}
                    </p>
                    {l.budget && <p className="mt-1.5 text-xs text-mu">{l.budget}</p>}
                    <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-mu"><span>{timeAgo(l.createdAt, locale)}{l.agent ? ` · ${l.agent}` : ""}</span>
                      <select aria-label={t("board.move")} value="" onChange={(e) => e.target.value && request(l.id, e.target.value)} className="max-w-[120px] rounded-full bg-surf px-2 py-1 text-[11px] font-semibold text-tx">
                        <option value="">{t("board.move")}</option>{stages.filter((s) => s.key !== l.stage).map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select></div>
                  </article>))}
                {!col.length && <p className="rounded-2xl border border-dashed border-ln p-5 text-center text-xs text-mu">{t("board.empty")}</p>}
              </div>
            </section>);
        })}
      </div>
      {lost && (
        <Overlay onClose={() => setLost(null)}>
          <form onSubmit={(e) => { e.preventDefault(); const [id, st] = lost.split("|"); move(id, st, String(new FormData(e.currentTarget).get("reason"))); setLost(null); }} className="w-full max-w-sm rounded-xl bg-bg p-6">
            <h3 className="mb-4 text-xl">{t("board.lostWhy")}</h3>
            <div className="grid gap-2">{REASONS.map((r, i) => <label key={r} className="flex items-center gap-3 rounded-2xl bg-surf px-4 py-3 text-sm"><input type="radio" name="reason" value={r} defaultChecked={i === 0} className="accent-gold-3" />{t(`reasons.${r}` as "reasons.other")}</label>)}</div>
            <div className="mt-5 flex gap-2"><button type="button" onClick={() => setLost(null)} className="min-h-[44px] flex-1 rounded-full border-[1.5px] border-ln font-semibold">{t("board.cancel")}</button><button className="min-h-[44px] flex-1 rounded-full bg-tx font-semibold text-bg">{t("board.confirm")}</button></div>
          </form>
        </Overlay>)}
    </div>
  );
}

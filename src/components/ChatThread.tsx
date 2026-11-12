"use client";
import clsx from "clsx";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { markReadAction, sendMessageAction } from "@/actions/portal";
import { formatDate } from "@/lib/format";
import { fieldCls } from "@/components/ui/Input";

export type Msg = { id: string; sender_id: string; body: string; created_at: string };

/** Live conversation. New messages arrive instantly through Supabase Realtime (row-level security still applies); a 15 s refresh is the safety net. */
export function ChatThread({ leadId, meId, initial }: { leadId: string; meId: string; initial: Msg[] }) {
  const t = useTranslations("portal.msg"), locale = useLocale(), [msgs, setMsgs] = useState<Msg[]>(initial), [text, setText] = useState(""), [err, setErr] = useState(""), [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const add = (m: Msg) => setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m].sort((a, b) => a.created_at.localeCompare(b.created_at))));
  useEffect(() => {
    const sb = createClient();
    const ch = sb.channel(`lead-${leadId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "lead_messages", filter: `lead_id=eq.${leadId}` }, (e) => { add(e.new as Msg); if ((e.new as Msg).sender_id !== meId) void markReadAction(leadId); }).subscribe();
    const poll = setInterval(async () => { const { data } = await sb.from("lead_messages").select("id, sender_id, body, created_at").eq("lead_id", leadId).order("created_at"); data?.forEach((m) => add(m as Msg)); }, 15000);
    void markReadAction(leadId);
    return () => { void sb.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, meId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  const send = (e: React.FormEvent) => {
    e.preventDefault(); const body = text.trim(); if (!body) return; setErr("");
    start(async () => { const r = await sendMessageAction(leadId, body); if (r?.error) setErr(r.error); else { setText(""); if (r?.id) add({ id: r.id, sender_id: meId, body, created_at: new Date().toISOString() }); } });
  };
  return (
    <div className="flex h-[min(70vh,560px)] flex-col rounded-lg bg-surf">
      <div className="flex-1 space-y-2.5 overflow-y-auto p-4" aria-live="polite">
        {msgs.map((m) => { const mine = m.sender_id === meId; return (
          <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}><p className={clsx("max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px]", mine ? "bg-tx text-bg" : "bg-bg")}>{m.body}<small className={clsx("mt-1 block text-[11px]", mine ? "text-bg/60" : "text-mu")}>{formatDate(m.created_at, locale)}</small></p></div>); })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-ln p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={t("placeholder")} aria-label={t("placeholder")} className={clsx(fieldCls, "!rounded-full")} />
        <button disabled={pending || !text.trim()} className="min-h-[46px] rounded-full bg-goldgrad px-6 font-bold text-[#1a1409] disabled:opacity-50">{pending ? t("sending") : t("send")}</button>
      </form>
      {err && <p role="alert" className="px-4 pb-3 text-sm text-danger">{err}</p>}
    </div>
  );
}

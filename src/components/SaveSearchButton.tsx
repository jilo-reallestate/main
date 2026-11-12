"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveSearchAction } from "@/actions/portal";
import { fieldCls } from "@/components/ui/Input";

/** "Save this search" on the Properties page. The person must be logged in; we then email them when new homes match. */
export function SaveSearchButton({ filters, defaultName }: { filters: Record<string, string>; defaultName: string }) {
  const t = useTranslations("portal.search"), [open, setOpen] = useState(false), [name, setName] = useState(defaultName), [msg, setMsg] = useState<"" | "ok" | "login" | string>(""), [pending, start] = useTransition();
  const save = (e: React.FormEvent) => { e.preventDefault(); start(async () => { const r = await saveSearchAction(name, filters); setMsg(r?.ok ? "ok" : r?.error ?? "error"); }); };
  if (msg === "ok") return <p role="status" className="rounded-full bg-success/10 px-4 py-2 text-sm font-semibold text-success">✓ {t("saved")} <Link href="/account/searches" className="underline">{t("title")}</Link></p>;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-full border-[1.5px] border-ln px-4 py-2 text-[13px] font-semibold hover:bg-surf">🔔 {t("save")}</button>
      {open && (
        <form onSubmit={save} className="absolute start-0 top-[calc(100%+8px)] z-30 grid w-[min(340px,86vw)] gap-3 rounded-lg bg-bg p-4 shadow-2xl ring-1 ring-ln">
          <label className="grid gap-1.5 text-sm"><span className="label">{t("name")}</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={fieldCls} /></label>
          {msg === "login" && <p className="text-sm text-danger">{t("needLogin")} <Link href="/login" className="underline">{t("login")}</Link></p>}
          {msg === "limit" && <p className="text-sm text-danger">{t("tooMany")}</p>}
          {msg && !["login", "limit"].includes(msg) && <p className="text-sm text-danger">{msg}</p>}
          <button disabled={pending} className="min-h-[44px] rounded-full bg-goldgrad font-bold text-[#1a1409] disabled:opacity-50">{t("saveBtn")}</button>
        </form>)}
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { DOC_KINDS, DOC_MAX, DOC_TYPES, safeName } from "@/lib/portal-service";
import { formatDate } from "@/lib/format";
import { fieldCls } from "@/components/ui/Input";

export type Doc = { id: string; kind: string; file_name: string; path: string; size_bytes: number | null; created_at: string };

/** Uploads straight to the PRIVATE "documents" bucket under the client's own folder. Downloads use short-lived signed links. */
export function DocumentManager({ ownerId, initial }: { ownerId: string; initial: Doc[] }) {
  const t = useTranslations("portal.docs"), locale = useLocale(), sb = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState(initial), [kind, setKind] = useState<string>("passport"), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function upload(f: File | undefined) {
    if (!f) return; setErr("");
    if (!DOC_TYPES.includes(f.type)) return setErr(t("badType")); if (f.size > DOC_MAX) return setErr(t("tooBig"));
    setBusy(true);
    try {
      const path = `${ownerId}/${crypto.randomUUID()}-${safeName(f.name)}`;
      const up = await sb.storage.from("documents").upload(path, f, { contentType: f.type }); if (up.error) throw up.error;
      const { data, error } = await sb.from("client_documents").insert({ owner_id: ownerId, kind, file_name: f.name.slice(0, 200), path, size_bytes: f.size }).select("id, kind, file_name, path, size_bytes, created_at").single();
      if (error) { await sb.storage.from("documents").remove([path]); throw error; }
      setDocs([data as Doc, ...docs]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  async function open(d: Doc) { const { data } = await sb.storage.from("documents").createSignedUrl(d.path, 60); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener"); }
  async function remove(d: Doc) { await sb.from("client_documents").delete().eq("id", d.id); await sb.storage.from("documents").remove([d.path]); setDocs(docs.filter((x) => x.id !== d.id)); }
  return (
    <div className="grid gap-5">
      <p className="text-mu">{t("hint")}</p>
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-surf p-5">
        <label className="grid gap-1.5 text-sm"><span className="label">{t("kind")}</span><select value={kind} onChange={(e) => setKind(e.target.value)} className={fieldCls}>{DOC_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}</select></label>
        <label className={`inline-flex min-h-[46px] cursor-pointer items-center rounded-full bg-goldgrad px-7 font-bold text-[#1a1409] ${busy ? "pointer-events-none opacity-60" : ""}`}>{busy ? t("uploading") : t("upload")}
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
      {!docs.length ? <p className="rounded-lg bg-surf p-8 text-center text-mu">{t("none")}</p> : (
        <ul className="grid gap-2.5">{docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surf p-4"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-bg">📄</span>
            <div className="min-w-0 flex-1"><b className="block truncate">{d.file_name}</b><small className="text-mu">{t(`kinds.${d.kind as "other"}`)} · {formatDate(d.created_at, locale)}{d.size_bytes ? ` · ${Math.round(d.size_bytes / 1024)} KB` : ""}</small></div>
            <button onClick={() => open(d)} className="rounded-full border-[1.5px] border-ln px-4 py-2 text-[13px] font-semibold hover:bg-bg">{t("download")}</button>
            <button onClick={() => remove(d)} className="rounded-full px-3 py-2 text-[13px] font-semibold text-danger hover:bg-danger/10">{t("delete")}</button></li>))}</ul>)}
    </div>
  );
}

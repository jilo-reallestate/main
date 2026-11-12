"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { mediaUrl } from "@/lib/data";

/** Uploads one file from the browser to the project-media bucket (admins only) and stores its public URL in a hidden input. */
export function UploadField({ name, folder, accept, initial = "" }: { name: string; folder: string; accept: string; initial?: string }) {
  const t = useTranslations("op.c"), sb = useMemo(() => createClient(), []);
  const [url, setUrl] = useState(initial), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function pick(f: File | undefined) {
    if (!f) return; setBusy(true); setErr("");
    const path = `${folder}/${crypto.randomUUID()}.${(f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const { error } = await sb.storage.from("project-media").upload(path, f, { contentType: f.type });
    if (error) setErr(error.message); else setUrl(mediaUrl(path, "project-media"));
    setBusy(false);
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name={name} value={url} />
      <label className="inline-flex min-h-[38px] cursor-pointer items-center rounded-full border-[1.5px] border-ln px-4 text-[13px] font-semibold hover:bg-surf">{busy ? t("uploading") : t("upload")}
        <input type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} /></label>
      {url && <><a href={url} target="_blank" rel="noreferrer" className="text-sm underline" dir="ltr">{t("open")}</a><button type="button" className="text-sm text-danger" onClick={() => setUrl("")}>{t("delete")}</button></>}
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
    </div>
  );
}
